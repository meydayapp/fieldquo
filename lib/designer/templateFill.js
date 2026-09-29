// lib/designer/templateFill.js
//
// Turns a catalogue template (lib/designer/templateCatalog.js) into THIS
// company's post: its brand colour, its logo, its name, phone, website and
// town, its words in its own language, its own job photos — and nothing it
// did not say.
//
// ══ The rules ═════════════════════════════════════════════════════════════
//
//  • Colours come from lib/documents/theme.js — fillPair() for a brand band,
//    washPair() for a tinted card — never a hand-picked "white on brand".
//    Those two MEASURE contrast, which is the only thing that survives a
//    contractor whose brand is yellow, white, black or mid-grey.
//  • A token with no data behind it ({town} for a company that never entered
//    one) becomes that token's bracketed placeholder, tagged so the publish
//    routes refuse while it is still there (lib/designer/placeholders.js).
//    Absence of a fact is not a fact; the template never guesses one.
//  • A review is a REAL review — one the company approved for publication
//    (Testimonial.approved) or chose to show from Google (showOnSite), the
//    words unaltered — or it is the placeholder. Stars match that review's own
//    rating; a placeholder review has placeholder stars.
//  • A before/after slot is filled only from a job whose crew tagged BOTH a
//    start and a finish photo (lib/marketing/jobPostSource.js's rule): two
//    arbitrary photos labelled BEFORE and AFTER would be a comparison the post
//    cannot actually show.
//
// Pure — the route (app/api/designer/templates/[id]/fill) loads the rows and
// hands them in. scripts/check-design-templates.mjs runs it against hostile
// brand colours and empty companies.
import { documentTheme, fillPair, washPair } from "@/lib/documents/theme";
import { ensureContrast } from "@/lib/brand/colour";
import { fitFontSize } from "@/lib/marketing/jobPost";
import { filledUrl, paddedUrl } from "@/lib/media/cloudinaryUrl";
import { copyFor } from "@/lib/designer/templateCopy";
import { PLACEHOLDER_PREFIX } from "@/lib/designer/placeholders";
import { diagonalPoints } from "@/lib/designer/templateCatalog";

const DARK = "#16181d";

/**
 * Every colour role a template may name, for one company.
 *
 * `scrim` is translucent black over a photograph; the text on it is white.
 * Its worst case is a pure white photo underneath, which composites to
 * SCRIM_WORST_CASE — the value the contrast check measures against.
 */
export function templatePalette(company = {}) {
  const theme = documentTheme(company);
  const band = fillPair(theme);
  const wash = washPair(theme);
  return {
    brand: band.bg,
    onBrand: band.fg,
    paper: "#ffffff",
    ink: theme.ink,
    muted: theme.inkMuted,
    accent: theme.accentText,
    wash: wash.bg,
    onWash: wash.ink,
    mutedOnWash: wash.muted,
    accentOnWash: wash.accent,
    dark: DARK,
    onDark: "#ffffff",
    mutedOnDark: ensureContrast("#b4bac4", DARK, 4.5),
    accentOnDark: ensureContrast(theme.accent, DARK, 4.5),
    scrim: "rgba(0,0,0,0.55)",
    onScrim: "#ffffff",
    line: "#ffffff",
    phFill: "#e5e7eb",
    phInk: "#374151",
  };
}

/** A pure white pixel under a 55% black scrim. */
export const SCRIM_WORST_CASE = "#737373";

/** The solid colour a role is measured against. */
export function measurableBackground(palette, role) {
  if (role === "scrim") return SCRIM_WORST_CASE;
  return palette[role];
}

// ── Seasons ─────────────────────────────────────────────────────────────────

// Countries whose seasons run opposite the north's. A company with no country
// is treated as northern: FieldQuo's customers are overwhelmingly in Canada
// and the US, and Company.country defaults to CA.
const SOUTHERN = new Set(["AU", "NZ", "ZA", "AR", "CL", "UY", "PY", "BR", "PE", "BO"]);

export function seasonKey(date = new Date(), country = "CA") {
  const m = new Date(date).getMonth(); // 0 = January
  const north = m >= 2 && m <= 4 ? "spring" : m >= 5 && m <= 7 ? "summer" : m >= 8 && m <= 10 ? "fall" : "winter";
  if (!SOUTHERN.has(String(country || "").toUpperCase())) return north;
  return { spring: "fall", summer: "winter", fall: "spring", winter: "summer" }[north];
}

// ── Photos ──────────────────────────────────────────────────────────────────

/**
 * Which of one job's photos goes in which slot role.
 *
 * @param {Array<{url: string, stage: string, createdAt: Date|string}>} rows
 *   one job's JobPhoto rows, company-scoped by the caller, Cloudinary URLs only.
 * @returns {Record<string, string>} role -> url. Missing roles stay missing.
 */
export function assignPhotos(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && typeof r.url === "string" && r.url && r.stage !== "issue");
  const t = (r) => {
    const v = new Date(r?.createdAt).getTime();
    return Number.isNaN(v) ? Number.POSITIVE_INFINITY : v;
  };
  const byOldest = (a, b) => t(a) - t(b);
  const starts = list.filter((r) => r.stage === "start").sort(byOldest);
  const finishes = list.filter((r) => r.stage === "finish").sort(byOldest);
  const progress = list.filter((r) => r.stage === "progress").sort(byOldest);
  const out = {};
  const used = new Set();
  const take = (role, row) => {
    if (row && !used.has(row.url)) {
      out[role] = row.url;
      used.add(row.url);
    }
  };
  // The pair only when both ends were tagged — see this file's header.
  if (starts.length && finishes.length) {
    take("before", starts[0]);
    take("after", finishes[finishes.length - 1]);
  }
  if (out.before && progress.length) take("during", progress[Math.floor(progress.length / 2)]);
  // The finished result is the best single picture of a job.
  const newestFinish = finishes[finishes.length - 1];
  const newest = list.slice().sort(byOldest).pop();
  if (newestFinish || newest) out.hero = (newestFinish || newest).url;
  if (progress.length) out.work = progress[progress.length - 1].url;
  const rest = [...finishes.slice().reverse(), ...progress.slice().reverse(), ...starts].filter((r) => !used.has(r.url) && r.url !== out.hero);
  if (rest[0]) out.detail1 = rest[0].url;
  if (rest[1]) out.detail2 = rest[1].url;
  return out;
}

// ── Reviews ─────────────────────────────────────────────────────────────────

/**
 * The review a template may print, or null. Approved testimonials first (the
 * company chose them for publication), then Google reviews the company chose
 * to show, marked as Google's. Words are never trimmed or edited — a review
 * that is too long for a card is skipped for a shorter one, not shortened.
 */
export function pickReview({ testimonials = [], googleReviews = [] } = {}, { maxChars = 320 } = {}) {
  const fromTestimonials = (Array.isArray(testimonials) ? testimonials : [])
    .filter((r) => r && typeof r.quote === "string" && r.quote.trim() && r.quote.trim().length <= maxChars)
    .map((r) => ({ text: r.quote.trim(), name: String(r.authorName || "").trim(), rating: Number.isInteger(r.rating) ? r.rating : null, via: null }));
  const fromGoogle = (Array.isArray(googleReviews) ? googleReviews : [])
    .filter((r) => r && typeof r.comment === "string" && r.comment.trim() && r.comment.trim().length <= maxChars)
    .map((r) => ({ text: r.comment.trim(), name: String(r.reviewerName || "").trim(), rating: Number.isInteger(r.starRating) ? r.starRating : null, via: "Google" }));
  const all = [...fromTestimonials, ...fromGoogle].filter((r) => r.name);
  // A five-star review first when there is one; otherwise the first on the list.
  return all.find((r) => r.rating === 5) || all[0] || null;
}

function stars(rating) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

// ── Tokens ──────────────────────────────────────────────────────────────────

const TOKEN = /\{(\w+)\}/g;

function cleanWebsite(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  return url.trim().replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

/**
 * The company facts a template may print. Null means "not known" and becomes
 * a placeholder — never a default.
 */
export function companyTokens({ company = {}, services = [], areas = null, now = new Date() } = {}) {
  const language = company.defaultLanguage || "en";
  const svc = (Array.isArray(services) ? services : []).map((s) => String(s || "").trim()).filter(Boolean);
  return {
    company: String(company.name || "").trim() || null,
    phone: String(company.phone || "").trim() || null,
    website: cleanWebsite(company.website),
    town: String(company.city || "").trim() || null,
    areas: typeof areas === "string" && areas.trim() ? areas.trim() : null,
    services: svc.length ? svc.slice(0, 8).join(" · ") : null,
    season: copyFor(seasonKey(now, company.country), language),
  };
}

/** Which placeholder a missing token becomes, and what kind it counts as. */
const TOKEN_PLACEHOLDER = {
  phone: ["ph.phone", "contact"],
  website: ["ph.website", "contact"],
  town: ["ph.town", "text"],
  areas: ["ph.areas", "text"],
  services: ["ph.services", "text"],
  company: ["ph.name", "text"],
};

/**
 * One text spec, resolved. Returns the words and, when any part of them is a
 * placeholder, the placeholder kind.
 */
export function resolveText(spec, { language, tokens, review, vars } = {}) {
  let ph = null;
  let text;
  const s = String(spec ?? "");
  if (s === "@review.text" || s === "@review.name" || s === "@review.stars") {
    if (!review) {
      ph = "review";
      text = s === "@review.text" ? copyFor("ph.review", language) : s === "@review.name" ? copyFor("ph.reviewer", language) : "★★★★★";
    } else {
      text =
        s === "@review.text"
          ? review.text
          : s === "@review.name"
            ? `— ${review.name}${review.via ? ` · ${review.via}` : ""}`
            : review.rating
              ? stars(review.rating)
              : "";
    }
    return { text, ph };
  }
  if (s.startsWith("§")) {
    const key = s.slice(1);
    text = copyFor(key, language);
    if (key.startsWith("ph.")) ph = "text";
  } else {
    text = s;
  }
  text = text.replace(TOKEN, (whole, name) => {
    if (vars && Object.prototype.hasOwnProperty.call(vars, name)) return String(vars[name]);
    if (!tokens || !Object.prototype.hasOwnProperty.call(tokens, name)) return whole;
    const value = tokens[name];
    if (value) return value;
    const [key, kind] = TOKEN_PLACEHOLDER[name] || ["ph.number", "text"];
    ph = ph || kind;
    return copyFor(key, language);
  });
  return { text, ph };
}

// ── The walk ────────────────────────────────────────────────────────────────

function colour(value, palette) {
  if (typeof value !== "string" || !value.startsWith("@")) return value;
  return palette[value.slice(1)] ?? value;
}

function stripFq(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (!k.startsWith("fq")) out[k] = v;
  return out;
}

function imageFor(slot, url) {
  const w = Math.round(Number(slot.width) || 1);
  const h = Math.round(Number(slot.height) || 1);
  const img = {
    type: "image",
    name: `template-photo:${slot.fqSlot?.role || "photo"}`,
    originX: "left",
    originY: "top",
    left: slot.left,
    top: slot.top,
    width: w,
    height: h,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    // Cloudinary crops to exactly this size, so the document's width/height
    // are true without anybody fetching the file — see filledUrl().
    src: filledUrl(url, { width: w, height: h }),
    // Or the exported canvas is tainted and publishing fails at rasterise
    // time — the same reason jobPost.js and useEditor's addImage() set it.
    crossOrigin: "anonymous",
    cropX: 0,
    cropY: 0,
    filters: [],
  };
  if (slot.fqSlot?.clip === "diagonal-before") {
    // Relative to the image's own centre, so it moves and scales with it.
    img.clipPath = {
      type: "polygon",
      originX: "left",
      originY: "top",
      left: -Math.round(w / 2),
      top: -Math.round(h / 2),
      points: diagonalPoints(w, h),
      fill: "#000000",
    };
  }
  return img;
}

function logoFor(slot, ctx) {
  // `on` (the role behind it) is read only by the contrast check, off the
  // template itself.
  const { color, align } = slot.fqSlot || {};
  const url = ctx.logoUrl ? paddedUrl(ctx.logoUrl, { width: slot.width, height: slot.height }) : null;
  if (url) {
    return {
      type: "image",
      name: "template-logo",
      originX: "left",
      originY: "top",
      left: slot.left,
      top: slot.top,
      width: Math.round(slot.width),
      height: Math.round(slot.height),
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      opacity: 1,
      src: url,
      crossOrigin: "anonymous",
      cropX: 0,
      cropY: 0,
      filters: [],
    };
  }
  // No logo FieldQuo can size: the company's name, in the slot's colour. A
  // name is an honest mark; a grey "your logo here" box would be neither.
  const name = ctx.tokens?.company || "";
  if (!name) return null;
  const size = fitFontSize(name, slot.width, { maxLines: 1, max: Math.round(slot.height * 0.7), min: 12 });
  return {
    type: "textbox",
    name: "template-company-name",
    originX: "left",
    originY: "top",
    left: slot.left,
    top: slot.top + Math.round((slot.height - size * 1.15) / 2),
    width: Math.round(slot.width),
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    text: name,
    fontSize: size,
    fontFamily: "Arial",
    fontWeight: "bold",
    fill: colour(color || "@ink", ctx.palette),
    textAlign: align || "left",
    charSpacing: 0,
    lineHeight: 1.15,
    styles: [],
  };
}

function fillObject(o, ctx) {
  if (!o || typeof o !== "object") return o;

  // Slots first — they are replaced, not coloured.
  if (o.fqSlot?.role === "logo") return logoFor(o, ctx);
  if (o.fqSlot && o.type === "group") {
    const url = ctx.photos?.[o.fqSlot.role];
    if (url) return imageFor(o, url);
  }

  const out = stripFq(o);
  for (const key of ["fill", "stroke"]) if (key in out) out[key] = colour(out[key], ctx.palette);
  if (out.clipPath && typeof out.clipPath === "object") out.clipPath = fillObject(out.clipPath, ctx);

  if (typeof o.fqText === "string") {
    const { text, ph } = resolveText(o.fqText, { language: ctx.language, tokens: ctx.tokens, review: ctx.review, vars: o.fqVars });
    out.text = text;
    if (o.fqFit) {
      out.fontSize = fitFontSize(text, Number(o.width) || 1, {
        maxLines: o.fqFit.maxLines || 1,
        max: o.fqFit.max || o.fontSize,
        min: o.fqFit.min || 10,
      });
    }
    const kind = o.fqPh || ph;
    // A text inside a photo placeholder group is the group's label; the
    // group already carries the placeholder name.
    if (kind && !ctx.insideGroup) out.name = `${PLACEHOLDER_PREFIX}${kind}${o.name ? `:${o.name}` : ""}`;
  }

  if (Array.isArray(o.objects)) {
    out.objects = o.objects.map((child) => fillObject(child, { ...ctx, insideGroup: true })).filter(Boolean);
  }
  return out;
}

/**
 * One template layout document, filled for one company.
 *
 * @param {object} doc  a fabric document from buildTemplateSlides()
 * @param {Object} ctx
 * @param {string} ctx.language
 * @param {object} ctx.palette   templatePalette(company)
 * @param {object} ctx.tokens    companyTokens(...)
 * @param {object|null} ctx.review  pickReview(...)
 * @param {Record<string,string>} [ctx.photos]  assignPhotos(...), or {} for a preview
 * @param {string|null} [ctx.logoUrl]
 * @returns {object} a NEW document; the template is never mutated.
 */
export function fillTemplateDoc(doc, ctx) {
  const objects = Array.isArray(doc?.objects) ? doc.objects : [];
  return { ...stripFq(doc || {}), objects: objects.map((o) => fillObject(o, ctx)).filter(Boolean) };
}

/**
 * Every slide of a template, filled. A company template (already concrete,
 * no roles or tokens) passes through unchanged apart from the walk itself —
 * which is what lets the sidebar treat both kinds the same way.
 */
export function fillTemplateSlides(slides, ctx) {
  return (Array.isArray(slides) ? slides : []).map((slideMap) => {
    const out = {};
    for (const [ratioKey, layout] of Object.entries(slideMap || {})) {
      if (!layout?.json) continue;
      out[ratioKey] = { json: fillTemplateDoc(layout.json, ctx), width: layout.width, height: layout.height };
    }
    return out;
  });
}
