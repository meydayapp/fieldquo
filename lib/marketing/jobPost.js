// lib/marketing/jobPost.js
//
// A social post built out of the photos a crew already took, laid out on the
// designer's own canvas — two real job photos side by side, labelled BEFORE
// and AFTER, a headline, and a footer that names the trade and the town.
//
// ── This is a COMPOSITION, not a generated picture ─────────────────────────
//
// Nothing here asks a model for an image. The pixels are the contractor's own
// photographs; what this file decides is where they sit, how big the words
// are, and which colours are safe. That distinction is the whole point: a
// generated "kitchen" is a kitchen nobody refinished, and a homeowner who
// books off it has been sold a picture of somebody else's work.
//
// ── What the model may and may not decide ──────────────────────────────────
//
// The same boundary lib/site/generateSite.js draws, for the same reason (read
// its header — the argument is written out there in full). The model writes
// SENTENCES: a headline and a caption. It does not choose the layout, pick the
// ratio, decide which photo is the "before", name a service, or emit a colour.
// Every one of those comes from data:
//
//   • which photo is before/after — lib/marketing/jobPostSource.js, off the
//     JobPhoto.stage the crew tagged;
//   • the trade and the town — the company's own enabled service categories
//     and its city/province;
//   • every colour — lib/documents/theme.js, measured against 4.5:1, never
//     chosen;
//   • the frame — lib/marketing/ratios.js's AD_RATIOS.
//
// So the worst case when the model is unavailable, over quota or talking
// nonsense is a PLAINER post — factualHeadline() below builds one from the
// scope of work alone — never a broken one, and never a claim about work
// nobody did.
//
// ── Pure ───────────────────────────────────────────────────────────────────
//
// No fabric, no DOM, no database, no network. It returns a plain fabric
// `canvas.toJSON()` document (the same shape MarketingDesignLayout.json
// stores and lib/marketing/ratios.js's reflow()/overflowing() operate on), so
// scripts/check-job-post.mjs can execute every case against hostile input the
// way check-ad-ratios.mjs executes reflow(). fabric@5.3.0-browser touches
// `window` at import time and can never be imported here.
import { fillPair } from "@/lib/documents/theme";
import { filledUrl } from "@/lib/media/cloudinaryUrl";

// ── Proportions ────────────────────────────────────────────────────────────
//
// Fractions of the frame, not pixels: the same composition has to hold at
// 1080x1080, 1080x1920 and 1200x630, and a pixel constant tuned on the square
// puts the footer through the middle of the landscape banner. Expressed
// against HEIGHT for the bands and WIDTH for the gutters, because that is the
// axis each one actually reads along.
const HEADER_FRACTION = 0.17;
const FOOTER_FRACTION = 0.1;
const GUTTER_FRACTION = 0.012;
const MARGIN_FRACTION = 0.05;

// The label pill on each photo — "BEFORE" / "AFTER".
const PILL_HEIGHT_FRACTION = 0.052;
const PILL_TEXT_FRACTION = 0.6; // of the pill's own height

const HEADLINE_FRACTION = 0.068;
const HEADLINE_MIN_FRACTION = 0.034;
const FOOTER_TEXT_FRACTION = 0.026;

// Arial Black at a given fontSize averages a shade over half that in advance
// width per character across normal English/French copy. This is an
// ESTIMATE and it is used only to shrink text that would otherwise wrap past
// its band — never to claim a measurement. Erring high (assuming characters
// are wider than they are) shrinks a borderline headline one step too far,
// which looks slightly small; erring low would let it run into the photos,
// which looks broken. So it errs high on purpose.
const AVG_ADVANCE_RATIO = 0.58;

/** The document version fabric 5 writes, so a composed doc round-trips. */
const FABRIC_VERSION = "5.3.0";

/**
 * A cap on how much text a caller can put in a band. Not cosmetic: a headline
 * is fitted by SHRINKING, and an unbounded string shrinks to unreadable
 * rather than being refused. Trimmed here so the fitting maths below always
 * has a bounded problem, and so a model that ignores its instruction to be
 * short cannot produce a post with 400pt of 6px type on it.
 */
export const MAX_HEADLINE_CHARS = 72;
const MAX_FOOTER_CHARS = 64;

const clean = (value, max) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

/**
 * The footer: the trade and the service area, from company data.
 *
 * "CABINET REFINISHING · OTTAWA" — the two facts a stranger scrolling past
 * needs in order to know whether this post is for them.
 *
 * ── Absence is not a statement ─────────────────────────────────────────────
 *
 * A company with no enabled service category gets NO trade in the footer, and
 * one with no city gets no place. It never falls back to an invented trade,
 * the company's name in place of its trade, or a province standing in for a
 * town — AGENTS.md's fifth recurring failure class, applied to the one line on
 * the post that a homeowner reads as a claim about where the contractor works.
 * With neither fact on file this returns "" and composeJobPost() omits the
 * band entirely rather than printing an empty bar.
 *
 * @param {Object} args
 * @param {string[]} [args.trades]  enabled service category labels, in the
 *   company's own order. Only the FIRST is used: a company offering nine
 *   trades has nine posts to make, not one footer listing all nine.
 * @param {string} [args.city]
 * @param {string} [args.province]
 * @returns {string} uppercase, " · "-joined, or "" when nothing is known.
 */
export function tradeFooter({ trades = [], city = "", province = "" } = {}) {
  const trade = (Array.isArray(trades) ? trades : [])
    .map((t) => clean(t, MAX_FOOTER_CHARS))
    .find(Boolean);

  // The town, not the province. "ONTARIO" under a photo of one kitchen reads
  // as a franchise; the province only stands in when there is no city at all,
  // because a contractor who filled in one and not the other still told us
  // something true.
  const place = clean(city, MAX_FOOTER_CHARS) || clean(province, MAX_FOOTER_CHARS);

  return [trade, place]
    .filter(Boolean)
    .map((part) => part.toUpperCase())
    .join(" · ")
    .slice(0, MAX_FOOTER_CHARS);
}

/**
 * The headline when there is no model output to use — AI unconfigured, over
 * quota, rate-limited, or returning nonsense.
 *
 * Built from facts alone and in a fixed order of preference:
 *
 *   1. the first scope-of-work category on the job's own quote — the truest
 *      short description of what was actually done, and the same field
 *      lib/marketing/jobPhotoContext.js's scopeOfWorkFacts() already decided
 *      was safe to show (a label a contractor typed about a SERVICE, never a
 *      client's name);
 *   2. the company's first enabled trade;
 *   3. nothing at all.
 *
 * There is deliberately no fourth fallback to the company's NAME. A headline
 * reading "NORTHLINE PAINTING" over a before/after is not a headline, it is a
 * signature — and the footer already carries the identity. Returning "" lets
 * composeJobPost() leave the band empty rather than fill it with a word that
 * says nothing.
 *
 * Note what this does NOT do: it never says "BEFORE & AFTER" as the headline
 * just because a pair exists. The pills on the photos already say that, and a
 * headline repeating the labels underneath it is the padding-absent-data
 * failure wearing a different hat.
 *
 * @param {Object} args
 * @param {{hasScope?: boolean, groups?: Array<{category: string}>}} [args.scope]
 * @param {string[]} [args.trades]
 */
export function factualHeadline({ scope = {}, trades = [] } = {}) {
  const groups = Array.isArray(scope?.groups) ? scope.groups : [];
  const fromScope = groups.map((g) => clean(g?.category, MAX_HEADLINE_CHARS)).find(Boolean);
  if (fromScope) return fromScope.toUpperCase();

  const fromTrade = (Array.isArray(trades) ? trades : [])
    .map((t) => clean(t, MAX_HEADLINE_CHARS))
    .find(Boolean);
  return fromTrade ? fromTrade.toUpperCase() : "";
}

/**
 * The largest font size at which `text` fits in `maxLines` lines of `boxWidth`.
 *
 * Estimated from AVG_ADVANCE_RATIO, never measured — there is no font metric
 * available in a pure module and pretending otherwise would be worse than
 * saying so. Callers pair it with overflowing() (lib/marketing/ratios.js),
 * which IS exact about the box, so a bad estimate produces small type rather
 * than a headline through the photos.
 */
export function fitFontSize(text, boxWidth, { maxLines = 2, max = 48, min = 12 } = {}) {
  const chars = typeof text === "string" ? text.length : 0;
  if (!chars) return max;
  const width = Math.max(1, Number(boxWidth) || 1);
  // How wide one line of this text would be at `max`, versus how much line
  // length `maxLines` of the box actually offers.
  const affordable = (width * Math.max(1, maxLines)) / (chars * AVG_ADVANCE_RATIO);
  return Math.max(min, Math.min(max, Math.floor(affordable)));
}

/** A fabric object with the properties every one of ours shares. */
function base(name, extra) {
  return {
    name,
    // Serialised on every object because fabric's own defaults differ per
    // type and a document that omits them loads with fabric's, not ours.
    originX: "left",
    originY: "top",
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    ...extra,
  };
}

function rect(name, { left, top, width, height, fill }) {
  return base(name, { type: "rect", left, top, width, height, fill, stroke: null, strokeWidth: 0, rx: 0, ry: 0 });
}

function textbox(name, text, { left, top, width, fontSize, fill, fontWeight = "bold", textAlign = "center", charSpacing = 0, fontFamily = "Arial" }) {
  return base(name, {
    type: "textbox",
    text,
    left,
    top,
    width,
    fontSize,
    fontFamily,
    fontWeight,
    fill,
    textAlign,
    charSpacing,
    lineHeight: 1.1,
    // Fabric's own default. Named rather than left off so a document composed
    // here and a document typed in the editor serialise the same shape, which
    // is what stops a round-trip through the editor moving the text.
    styles: [],
  });
}

function imageObject(name, { url, left, top, width, height }) {
  return base(name, {
    type: "image",
    // The delivered size is fixed by filledUrl() above, which is what makes
    // these two numbers knowable server-side. See that function's header.
    src: filledUrl(url, { width, height }),
    left,
    top,
    width,
    height,
    // Without this the exported canvas is TAINTED and toDataURL() throws a
    // SecurityError — the publish flow would fail at rasterise time with a
    // browser error naming nothing anybody on this screen chose. useEditor.js's
    // own addImage() passes the same option for the same reason.
    crossOrigin: "anonymous",
    cropX: 0,
    cropY: 0,
    filters: [],
  });
}

/**
 * Where the photographs go.
 *
 * ── Side by side, EXCEPT in a portrait frame ──────────────────────────────
 *
 * Two photos beside each other in a 1080x1920 Story are two slivers: each
 * panel ends up narrower than a phone's thumb and neither picture is
 * readable. Stacking them is what a before/after Story actually looks like,
 * and it is a property of the FRAME, not a preference — which is why the
 * branch is on the frame's own proportions and not on a flag somebody has to
 * remember to set.
 *
 * The 1.2 threshold rather than a bare `H > W`: a 1080x1080 square is not
 * portrait, and neither is anything close enough to square that side-by-side
 * still reads. Above it (9:16 Story, 9:16 TikTok) it stacks; at or below it
 * (square, 1.91:1 Facebook, 16:9 thumbnail) it does not.
 *
 * One photo always fills the whole block, whatever the frame.
 */
function panelsFor(count, { W, photosTop, photosH, gutter }) {
  if (count <= 1) return [{ left: 0, top: photosTop, width: W, height: photosH }];

  const portrait = photosH > W * 1.2;
  if (portrait) {
    const panelH = Math.floor((photosH - gutter) / 2);
    return [
      { left: 0, top: photosTop, width: W, height: panelH },
      { left: 0, top: photosTop + photosH - panelH, width: W, height: panelH },
    ];
  }
  const panelW = Math.floor((W - gutter) / 2);
  return [
    { left: 0, top: photosTop, width: panelW, height: photosH },
    { left: W - panelW, top: photosTop, width: panelW, height: photosH },
  ];
}

/**
 * Lay a job's photos out as a post.
 *
 * @param {Object} args
 * @param {{width: number, height: number}} args.frame  an AD_RATIOS frame.
 * @param {Array<{url: string, role: "before"|"after"|"single"}>} args.photos
 *   one or two photos, already CHOSEN — this function does not decide which
 *   photo is the before (lib/marketing/jobPostSource.js does, off the crew's
 *   own stage tag) and does not filter anything out (jobPhotoContext.js's
 *   issue-photo rule runs before a URL ever reaches here).
 * @param {string} args.headline  the model's sentence, or factualHeadline()'s.
 * @param {string} args.footer    tradeFooter()'s output.
 * @param {Object} args.theme     lib/documents/theme.js's documentTheme().
 * @param {(key: string) => string} [args.label]  translator for the BEFORE /
 *   AFTER pills. A function, not two strings, so a caller that has no
 *   translator (a check script) gets the English default without this module
 *   holding a copy of the catalogue.
 * @returns {{version: string, objects: object[]}} a fabric document. Never
 *   throws: an empty photo list yields the bands and no panels, which is a
 *   post a person can drop a photo onto, not a crash.
 */
export function composeJobPost({ frame, photos = [], headline = "", footer = "", theme, label }) {
  const W = Math.max(1, Math.round(Number(frame?.width) || 1080));
  const H = Math.max(1, Math.round(Number(frame?.height) || 1080));

  // fillPair() rather than theme.accent directly: a contractor whose brand is
  // yellow, white or a mid-grey is exactly the case lib/documents/theme.js's
  // header says the naive "is it dark? use white" rule fails on, and the
  // footer band is the one place on this post where brand colour carries
  // text. Measured, not guessed — see scripts/check-job-post.mjs, which runs
  // the pairing over hostile brand colours.
  const band = fillPair(theme);

  const margin = Math.round(W * MARGIN_FRACTION);
  const gutter = Math.round(W * GUTTER_FRACTION);
  const headerH = Math.round(H * HEADER_FRACTION);
  const footerText = clean(footer, MAX_FOOTER_CHARS);
  const footerH = footerText ? Math.round(H * FOOTER_FRACTION) : 0;
  const photosTop = headerH;
  const photosH = Math.max(1, H - headerH - footerH);

  const objects = [];

  // The workspace rect. `name: "clip"` is load-bearing in four places —
  // ratios.js's reflow()/overflowing() skip it, CampaignEditor's rasterize()
  // crops to it, and useEditor repoints canvas.clipPath at it after a load.
  //
  // At (0,0), unlike the live editor's centred one. reflow() maps every
  // position as a FRACTION of the frame, which is only the same thing as a
  // position inside the frame when the frame starts at the origin; composing
  // anywhere else would put a correct-looking document through a reflow that
  // walks it off the page.
  objects.push({
    ...rect("clip", { left: 0, top: 0, width: W, height: H, fill: theme.paper }),
    selectable: false,
    hasControls: false,
  });

  const usable = (Array.isArray(photos) ? photos : [])
    .filter((p) => p && typeof p.url === "string" && p.url)
    .slice(0, 2);

  const panels = panelsFor(usable.length, { W, photosTop, photosH, gutter });
  usable.forEach((photo, i) => {
    objects.push(imageObject(`jobpost-photo-${i}`, { url: photo.url, ...panels[i] }));
  });

  // ── The pills ────────────────────────────────────────────────────────────
  //
  // Only on a genuine pair. A single photo gets NO label: "AFTER" on its own
  // is a before/after with the before missing, which lib/gallery/albums.js
  // already refuses to publish for the same reason — it promises a comparison
  // the post cannot show.
  if (usable.length === 2) {
    const t = typeof label === "function" ? label : (_, fallback) => fallback;
    const pillH = Math.round(H * PILL_HEIGHT_FRACTION);
    const pillFont = Math.round(pillH * PILL_TEXT_FRACTION);
    const inset = gutter * 2;

    usable.forEach((photo, i) => {
      const panel = panels[i];
      const pillW = Math.max(1, Math.min(panel.width - inset * 2, Math.round(W * 0.3)));
      const left = panel.left + inset;
      const pillTop = panel.top + panel.height - pillH - inset;
      const text = (
        photo.role === "before"
          ? t("app.marketingDesigner.jobPost.before", "BEFORE")
          : t("app.marketingDesigner.jobPost.after", "AFTER")
      ).toUpperCase();
      objects.push(
        rect(`jobpost-pill-${i}`, { left, top: pillTop, width: pillW, height: pillH, fill: band.bg }),
      );
      objects.push(
        textbox(`jobpost-pill-text-${i}`, text, {
          left,
          // Fabric's textbox grows down from `top`; centring it in the pill by
          // hand rather than with a vertical-align property fabric does not
          // have.
          top: pillTop + Math.round((pillH - pillFont * 1.1) / 2),
          width: pillW,
          fontSize: pillFont,
          fill: band.fg,
          charSpacing: 80,
        }),
      );
    });
  }

  const headlineText = clean(headline, MAX_HEADLINE_CHARS);
  if (headlineText) {
    const boxWidth = W - margin * 2;
    const fontSize = fitFontSize(headlineText, boxWidth, {
      maxLines: 2,
      max: Math.round(H * HEADLINE_FRACTION),
      min: Math.round(H * HEADLINE_MIN_FRACTION),
    });
    // Two lines' worth of height, centred in the header band. A one-line
    // headline sits a little low rather than a two-line one running into the
    // photos — the band is fixed and the copy is not.
    const blockH = Math.min(headerH, fontSize * 1.1 * 2);
    objects.push(
      textbox("jobpost-headline", headlineText, {
        left: margin,
        top: Math.max(0, Math.round((headerH - blockH) / 2)),
        width: boxWidth,
        fontSize,
        // On paper, not on the brand band — theme.ink against theme.paper is
        // the highest-contrast pairing this palette has, and the headline is
        // the one thing on the post that has to survive a phone in sunlight.
        fill: theme.ink,
      }),
    );
  }

  if (footerText) {
    const footerTop = H - footerH;
    const fontSize = fitFontSize(footerText, W - margin * 2, {
      maxLines: 1,
      max: Math.round(H * FOOTER_TEXT_FRACTION),
      min: Math.round(H * FOOTER_TEXT_FRACTION * 0.6),
    });
    objects.push(rect("jobpost-footer-band", { left: 0, top: footerTop, width: W, height: footerH, fill: band.bg }));
    objects.push(
      textbox("jobpost-footer", footerText, {
        left: margin,
        top: footerTop + Math.round((footerH - fontSize * 1.1) / 2),
        width: W - margin * 2,
        fontSize,
        fill: band.fg,
        charSpacing: 140,
      }),
    );
  }

  return { version: FABRIC_VERSION, objects };
}
