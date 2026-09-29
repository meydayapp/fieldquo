// lib/designer/templateCatalog.js
//
// FieldQuo's own starter templates for contractors — the Marketing Designer's
// catalogue (DesignTemplate rows with companyId null, seeded by
// prisma/seed-design-templates.js).
//
// ══ Original work, layout patterns only ═══════════════════════════════════
//
// Every template here is drawn from primitives in this file: rectangles,
// text, circles, a line, and photo SLOTS. No artwork, photo, font file or
// layout document was copied from Canva or anywhere else — the only thing
// borrowed is the idea of a pattern (a before/after split, a review card),
// which is common to the whole trade-marketing genre. There are no stock
// photos: a slot is filled from the company's own job photos when a template
// is applied (lib/designer/templateFill.js), or stays an obvious "Add a photo"
// placeholder the person must replace before anything can be published.
//
// ══ One template, every format ════════════════════════════════════════════
//
// Each template is a list of SLIDES, and each slide is a function of the frame
// it is being drawn for. buildTemplateSlides() calls it once per format in
// TEMPLATE_FORMATS — 4:5 portrait (Instagram and Facebook feed), 9:16 (TikTok,
// Reels, Stories) and 1.91:1 (Facebook link-style) — so every format is laid
// out on purpose rather than reflowed from another one. No template has a
// square layout; scripts/check-design-templates.mjs holds every one of them to
// exactly those three.
//
// ══ What is NOT decided here ══════════════════════════════════════════════
//
// Colours are ROLES ("@brand", "@onBrand", "@wash"…) and words are COPY KEYS
// ("§freeEstimate") or company TOKENS ("{phone}"). This file never knows the
// company, so it never picks a colour or a language. templateFill.js resolves
// both against the company's brand colour — through lib/documents/theme.js,
// which measures contrast rather than guessing — and its own language. Every
// text object also names the role it sits ON (`fqOn`), which is what lets the
// check script measure every text/background pair against hostile brand
// colours (yellow, white, black, mid-grey) without rendering anything.
//
// Pure: no fabric, no DOM, no database.
import { ratio as ratioByKey } from "@/lib/marketing/ratios";
import { TEMPLATE_FORMATS } from "@/lib/marketing/destinations";

export const FABRIC_VERSION = "5.3.0";

export const TEMPLATE_CATEGORIES = Object.freeze(["before_after", "win_work", "trust", "tips", "people"]);

// ── Frames ──────────────────────────────────────────────────────────────────

export function frameFor(ratioKey) {
  const r = ratioByKey(ratioKey);
  if (!r) return null;
  const kind = ratioKey === "facebook_feed" ? "landscape" : r.height > r.width * 1.5 ? "vertical" : "portrait";
  return { key: ratioKey, W: r.width, H: r.height, kind, L: kind === "landscape", V: kind === "vertical", P: kind === "portrait" };
}

/** Type scale: a fraction of the frame's geometric mean, so a headline is the
 * same visual weight on a 1080x1350 post and a 1200x630 link card. */
const fs = (f, frac) => Math.round(frac * Math.sqrt(f.W * f.H));
const R = Math.round;

// ── Primitives ──────────────────────────────────────────────────────────────

function base(name, extra) {
  return { name, originX: "left", originY: "top", angle: 0, scaleX: 1, scaleY: 1, opacity: 1, ...extra };
}

function rect(name, { x, y, w, h, fill, rx = 0, opacity = 1, stroke = null, strokeWidth = 0 }) {
  return base(name, {
    type: "rect",
    left: R(x),
    top: R(y),
    width: R(w),
    height: R(h),
    fill,
    rx,
    ry: rx,
    opacity,
    stroke,
    strokeWidth,
  });
}

function circle(name, { cx, cy, r, fill, stroke = null, strokeWidth = 0 }) {
  return base(name, {
    type: "circle",
    left: R(cx - r),
    top: R(cy - r),
    radius: R(r),
    width: R(r * 2),
    height: R(r * 2),
    fill,
    stroke,
    strokeWidth,
  });
}

/**
 * A text box. `text` is a copy key ("§ctaEstimate"), a token string
 * ("{company} · {town}"), or a literal glyph. `on` is the role it sits on —
 * required, because a text colour is only legible relative to something.
 */
function text(name, textSpec, { x, y, w, size, color, on, weight = "bold", align = "left", spacing = 0, font = "Arial", lh = 1.15, fit, ph, italic = false, vars }) {
  return base(name, {
    type: "textbox",
    text: textSpec,
    fqText: textSpec,
    ...(vars ? { fqVars: vars } : {}),
    ...(fit ? { fqFit: fit } : {}),
    ...(ph ? { fqPh: ph } : {}),
    fqOn: on,
    left: R(x),
    top: R(y),
    width: R(w),
    fontSize: size,
    fontFamily: font,
    fontWeight: weight,
    fontStyle: italic ? "italic" : "normal",
    fill: color,
    textAlign: align,
    charSpacing: spacing,
    lineHeight: lh,
    styles: [],
  });
}

const PHOTO_LABEL = { before: "§ph.photoBefore", after: "§ph.photoAfter", during: "§ph.photoDuring" };

/**
 * Where a photograph goes. A GROUP (a grey panel and a label) named as a
 * placeholder, so one delete removes it and the publish gate counts it once.
 * templateFill.js swaps it for the company's own photo when there is one that
 * honestly fits the role — a before/after pair only when the crew tagged both
 * ends of a job.
 *
 * `clip` "diagonal-before" cuts the slot along the diagonal split used by the
 * diagonal before/after template; the polygon travels with the photo.
 */
function photo(role, { x, y, w, h, clip, labelSide }) {
  const W = R(w);
  const H = R(h);
  const labelSize = Math.max(14, R(Math.min(W, H) * 0.06));
  const label = {
    type: "textbox",
    originX: "left",
    originY: "top",
    left: -R(W / 2) + R(W * 0.1),
    top: -R(labelSize * 0.6),
    width: R(W * 0.8),
    fontSize: labelSize,
    fontFamily: "Arial",
    fontWeight: "bold",
    fill: "@phInk",
    fqOn: "phFill",
    text: PHOTO_LABEL[role] || "§ph.photo",
    fqText: PHOTO_LABEL[role] || "§ph.photo",
    fqFit: { maxLines: 2, max: labelSize, min: 12 },
    textAlign: "center",
    lineHeight: 1.1,
    styles: [],
  };
  const panel =
    clip === "diagonal-before"
      ? {
          type: "polygon",
          originX: "left",
          originY: "top",
          left: -R(W / 2),
          top: -R(H / 2),
          points: diagonalPoints(W, H),
          fill: "@phFill",
          stroke: "@line",
          strokeWidth: 0,
        }
      : { type: "rect", originX: "left", originY: "top", left: -R(W / 2), top: -R(H / 2), width: W, height: H, fill: "@phFill" };
  if (clip === "diagonal-before") {
    // Centre the label in the triangle's heavier half, not the frame's middle.
    label.left = -R(W / 2) + R(W * 0.05);
    label.width = R(W * 0.45);
    label.top = -R(H * 0.25);
  } else if (labelSide === "right") {
    // The slot under a diagonal "before": its label sits in the half that
    // stays visible, lower down, where the split leaves the most room.
    label.left = R(W * 0.05);
    label.width = R(W * 0.42);
    label.top = R(H * 0.18);
  }
  return base(`fq-ph:photo:${role}`, {
    type: "group",
    left: R(x),
    top: R(y),
    width: W,
    height: H,
    fqSlot: { role, ...(clip ? { clip } : {}) },
    objects: [panel, label],
  });
}

/** The diagonal split: top edge at 62% across, bottom edge at 38%. */
export function diagonalPoints(W, H) {
  return [
    { x: 0, y: 0 },
    { x: R(W * 0.62), y: 0 },
    { x: R(W * 0.38), y: H },
    { x: 0, y: H },
  ];
}

/**
 * The company's logo, or its name in `color` when it has no logo FieldQuo can
 * size exactly (templateFill.js). Never a placeholder: a company always has a
 * name, and its name is an honest mark.
 */
function logo({ x, y, w, h, color, on, align = "left" }) {
  return base("fq-slot:logo", {
    type: "rect",
    left: R(x),
    top: R(y),
    width: R(w),
    height: R(h),
    fill: "rgba(0,0,0,0)",
    fqSlot: { role: "logo", color, on, align },
  });
}

/** A small-caps label on a dark pill — BEFORE / AFTER / DURING. */
function pill(name, key, { x, y, f, align = "left", maxW }) {
  const size = fs(f, f.L ? 0.024 : 0.02);
  const w = Math.min(R(f.W * (f.L ? 0.22 : 0.3)), maxW || Infinity);
  const h = R(size * 2.1);
  const left = align === "right" ? x - w : x;
  return [
    rect(`${name}-pill`, { x: left, y, w, h, fill: "@scrim", rx: R(h / 2) }),
    text(name, key, {
      x: left,
      y: y + R((h - size * 1.15) / 2),
      w,
      size,
      color: "@onScrim",
      on: "scrim",
      align: "center",
      spacing: 220,
      fit: { maxLines: 1, max: size, min: 10 },
    }),
  ];
}

/** A full-width band carrying the call to action and the phone number. */
function ctaBand(f, { y, h, role = "brand" }) {
  const m = margin(f);
  const onRole = role === "brand" ? "onBrand" : role === "dark" ? "onDark" : "ink";
  const size = fs(f, f.L ? 0.03 : 0.026);
  const half = (f.W - m * 2) * (f.L ? 0.58 : 0.6);
  return [
    rect("cta-band", { x: 0, y, w: f.W, h, fill: `@${role}` }),
    text("cta", "§ctaEstimate", {
      x: m,
      y: y + R((h - size * 1.15) / 2),
      w: half,
      size,
      color: `@${onRole}`,
      on: role,
      fit: { maxLines: 1, max: size, min: R(size * 0.6) },
    }),
    text("cta-phone", "{phone}", {
      x: m + half,
      y: y + R((h - size * 1.15) / 2),
      w: f.W - m * 2 - half,
      size,
      color: `@${onRole}`,
      on: role,
      align: "right",
      weight: "normal",
      fit: { maxLines: 1, max: size, min: R(size * 0.6) },
    }),
  ];
}

const margin = (f) => R(f.W * (f.L ? 0.045 : 0.065));

function background(role) {
  return { fqBackground: `@${role}` };
}

// ── The templates ───────────────────────────────────────────────────────────
//
// A slide function returns the objects drawn on top of the frame; returning
// { background, objects } sets the frame's own fill. Kept deliberately plain:
// one idea per post, large type, generous margins — posts are read at thumb
// size on a phone.

const slide = (bg, objects) => ({ ...background(bg), objects: objects.flat(Infinity).filter(Boolean) });

// ─ Before / after ─

function baSplitSlider(f) {
  const footerH = R(f.H * (f.L ? 0.13 : 0.085));
  const photoH = f.H - footerH;
  const half = R(f.W / 2);
  const m = margin(f);
  const knob = R(fs(f, 0.035));
  const cy = R(photoH / 2);
  const cap = fs(f, f.L ? 0.024 : 0.02);
  return slide("paper", [
    photo("before", { x: 0, y: 0, w: half, h: photoH }),
    photo("after", { x: half, y: 0, w: f.W - half, h: photoH }),
    rect("divider", { x: half - 2, y: 0, w: 4, h: photoH, fill: "@line" }),
    circle("handle", { cx: half, cy, r: knob, fill: "@paper" }),
    text("handle-arrows", "‹  ›", {
      x: half - knob,
      y: cy - R(knob * 0.62),
      w: knob * 2,
      size: R(knob * 1.05),
      color: "@ink",
      on: "paper",
      align: "center",
      font: "Georgia",
    }),
    pill("label-before", "§before", { x: m, y: m, f, maxW: R(half - m * 2) }),
    pill("label-after", "§after", { x: f.W - m, y: m, f, align: "right", maxW: R(half - m * 2) }),
    text("caption", "{company} · {town}", {
      x: m,
      y: photoH + R((footerH - cap * 1.15) / 2),
      w: f.W - m * 2,
      size: cap,
      color: "@muted",
      on: "paper",
      align: "center",
      weight: "normal",
      spacing: 80,
      fit: { maxLines: 1, max: cap, min: 12 },
    }),
  ]);
}

function baStacked(f) {
  const m = margin(f);
  const bandH = R(f.H * (f.L ? 0.16 : 0.1));
  const area = f.H - bandH;
  if (f.L) {
    const half = R(f.W / 2);
    return slide("paper", [
      photo("before", { x: 0, y: 0, w: half, h: area }),
      photo("after", { x: half, y: 0, w: f.W - half, h: area }),
      rect("divider", { x: half - 3, y: 0, w: 6, h: area, fill: "@line" }),
      pill("label-before", "§before", { x: m, y: area - m - fs(f, 0.05), f }),
      pill("label-after", "§after", { x: half + m, y: area - m - fs(f, 0.05), f }),
      ctaBand(f, { y: area, h: bandH }),
    ]);
  }
  const top = R(area / 2);
  return slide("paper", [
    photo("before", { x: 0, y: 0, w: f.W, h: top }),
    photo("after", { x: 0, y: top, w: f.W, h: area - top }),
    rect("divider", { x: 0, y: top - 3, w: f.W, h: 6, fill: "@line" }),
    pill("label-before", "§before", { x: m, y: m, f }),
    pill("label-after", "§after", { x: m, y: top + m, f }),
    ctaBand(f, { y: area, h: bandH }),
  ]);
}

function baDiagonal(f) {
  const m = margin(f);
  const pillH = R(fs(f, f.L ? 0.024 : 0.02) * 2.1);
  const cap = fs(f, f.L ? 0.026 : 0.022);
  return slide("dark", [
    photo("after", { x: 0, y: 0, w: f.W, h: f.H, labelSide: "right" }),
    photo("before", { x: 0, y: 0, w: f.W, h: f.H, clip: "diagonal-before" }),
    base("diagonal", {
      type: "line",
      left: R(f.W * 0.38),
      top: 0,
      width: R(f.W * 0.24),
      height: f.H,
      x1: R(f.W * 0.12),
      y1: -R(f.H / 2),
      x2: -R(f.W * 0.12),
      y2: R(f.H / 2),
      stroke: "@line",
      strokeWidth: 6,
      fill: "@line",
    }),
    pill("label-before", "§before", { x: m, y: m, f }),
    pill("label-after", "§after", { x: f.W - m, y: f.H - m - pillH, f, align: "right" }),
    rect("caption-bg", { x: f.W - m - R(f.W * 0.42), y: m, w: R(f.W * 0.42), h: R(cap * 2.2), fill: "@scrim", rx: R(cap * 1.1) }),
    text("caption", "{company}", {
      x: f.W - m - R(f.W * 0.42),
      y: m + R(cap * 0.55),
      w: R(f.W * 0.42),
      size: cap,
      color: "@onScrim",
      on: "scrim",
      align: "center",
      fit: { maxLines: 1, max: cap, min: 11 },
    }),
  ]);
}

function baInset(f) {
  const m = margin(f);
  const bandH = R(f.H * (f.L ? 0.16 : 0.1));
  const area = f.H - bandH;
  const insetW = R(f.W * (f.L ? 0.3 : 0.4));
  const insetH = R(insetW * (f.L ? 0.75 : 1.1));
  const border = R(fs(f, 0.006)) + 2;
  const ix = m;
  const iy = area - m - insetH;
  return slide("paper", [
    photo("after", { x: 0, y: 0, w: f.W, h: area }),
    rect("inset-frame", { x: ix - border, y: iy - border, w: insetW + border * 2, h: insetH + border * 2, fill: "@paper" }),
    photo("before", { x: ix, y: iy, w: insetW, h: insetH }),
    pill("label-before", "§before", { x: ix + R(border * 2), y: iy + R(border * 2), f, maxW: insetW - border * 4 }),
    pill("label-after", "§after", { x: f.W - m, y: m, f, align: "right" }),
    ctaBand(f, { y: area, h: bandH }),
  ]);
}

function baTriptych(f) {
  const m = margin(f);
  const bandH = R(f.H * (f.L ? 0.15 : 0.1));
  const area = f.H - bandH;
  const gap = 6;
  const roles = ["before", "during", "after"];
  const out = [];
  if (f.L) {
    const w = R((f.W - gap * 2) / 3);
    roles.forEach((role, i) => {
      const x = i * (w + gap);
      out.push(photo(role, { x, y: 0, w, h: area }));
      out.push(pill(`label-${role}`, `§${role}`, { x: x + R(m / 2), y: R(m / 2), f, maxW: w - m }));
    });
  } else {
    const h = R((area - gap * 2) / 3);
    roles.forEach((role, i) => {
      const y = i * (h + gap);
      out.push(photo(role, { x: 0, y, w: f.W, h }));
      out.push(pill(`label-${role}`, `§${role}`, { x: m, y: y + R(m / 2), f }));
    });
  }
  return slide("line", [out, ctaBand(f, { y: area, h: bandH, role: "dark" })]);
}

// A carousel: the pair, two details, and the ask. Instagram crops every slide
// to the first one's shape, so all four are drawn for the same frame.
function baStoryCover(f) {
  return baSplitSlider(f);
}

function detailSlide(n) {
  return (f) => {
    const m = margin(f);
    const cap = fs(f, f.L ? 0.024 : 0.02);
    return slide("paper", [
      photo(`detail${n}`, { x: 0, y: 0, w: f.W, h: f.H }),
      rect("caption-bg", { x: m, y: f.H - m - R(cap * 2.2), w: R(f.W * 0.5), h: R(cap * 2.2), fill: "@scrim", rx: R(cap * 1.1) }),
      text("caption", "{company}", {
        x: m,
        y: f.H - m - R(cap * 2.2) + R(cap * 0.55),
        w: R(f.W * 0.5),
        size: cap,
        color: "@onScrim",
        on: "scrim",
        align: "center",
        fit: { maxLines: 1, max: cap, min: 11 },
      }),
    ]);
  };
}

function ctaSlide(f) {
  const m = margin(f);
  const big = fs(f, f.L ? 0.075 : 0.07);
  const mid = fs(f, f.L ? 0.034 : 0.03);
  const logoH = R(f.H * (f.L ? 0.14 : 0.08));
  const topY = f.L ? R(f.H * 0.24) : R(f.H * 0.3);
  return slide("brand", [
    logo({ x: m, y: m, w: R(f.W * 0.4), h: logoH, color: "@onBrand", on: "brand" }),
    text("headline", "§ctaEstimate", {
      x: m,
      y: topY,
      w: f.W - m * 2,
      size: big,
      color: "@onBrand",
      on: "brand",
      fit: { maxLines: 3, max: big, min: R(big * 0.55) },
    }),
    text("phone", "§ctaCall", {
      x: m,
      y: topY + R(big * (f.L ? 2.6 : 3.6)),
      w: f.W - m * 2,
      size: mid,
      color: "@onBrand",
      on: "brand",
      weight: "normal",
      fit: { maxLines: 2, max: mid, min: R(mid * 0.6) },
    }),
    text("website", "{website}", {
      x: m,
      y: f.H - m - R(mid * 1.3),
      w: f.W - m * 2,
      size: R(mid * 0.85),
      color: "@onBrand",
      on: "brand",
      weight: "normal",
      fit: { maxLines: 1, max: R(mid * 0.85), min: 11 },
    }),
  ]);
}

// ─ Win work ─

/** A photo with the headline over a scrim and the ask in a band. */
function hero({ headline, sub, photoRole = "hero", badge }) {
  return (f) => {
    const m = margin(f);
    const bandH = R(f.H * (f.L ? 0.16 : 0.1));
    const area = f.H - bandH;
    const big = fs(f, f.L ? 0.06 : 0.062);
    const small = fs(f, f.L ? 0.028 : 0.026);
    const scrimH = R(area * (f.L ? 0.62 : 0.46));
    const textTop = area - scrimH + R(m * (f.L ? 0.9 : 1.2));
    const logoH = R(f.H * (f.L ? 0.12 : 0.07));
    return slide("dark", [
      photo(photoRole, { x: 0, y: 0, w: f.W, h: area }),
      rect("scrim", { x: 0, y: area - scrimH, w: f.W, h: scrimH, fill: "@scrim" }),
      rect("logo-bg", { x: m - R(m * 0.3), y: m - R(m * 0.3), w: R(f.W * 0.36) + R(m * 0.6), h: logoH + R(m * 0.6), fill: "@paper", rx: 8 }),
      logo({ x: m, y: m, w: R(f.W * 0.36), h: logoH, color: "@ink", on: "paper" }),
      badge ? pill("badge", badge, { x: f.W - m, y: m, f, align: "right" }) : null,
      text("headline", headline, {
        x: m,
        y: textTop,
        w: f.W - m * 2,
        size: big,
        color: "@onScrim",
        on: "scrim",
        fit: { maxLines: f.L ? 2 : 3, max: big, min: R(big * 0.55) },
      }),
      sub
        ? text("sub", sub, {
            x: m,
            y: textTop + R(big * (f.L ? 2.5 : 3.6)),
            w: f.W - m * 2,
            size: small,
            color: "@onScrim",
            on: "scrim",
            weight: "normal",
            fit: { maxLines: 2, max: small, min: R(small * 0.65) },
          })
        : null,
      ctaBand(f, { y: area, h: bandH }),
    ]);
  };
}

/** A coloured card: headline, body, an ask — with an optional photo panel. */
function card({ bg = "brand", headline, body, stat, statPh, list, photoRole, footer = "cta", eyebrow }) {
  return (f) => {
    const m = margin(f);
    const onRole = { brand: "onBrand", wash: "onWash", dark: "onDark", paper: "ink" }[bg];
    const mutedRole = { brand: "onBrand", wash: "mutedOnWash", dark: "mutedOnDark", paper: "muted" }[bg];
    const accentRole = { brand: "onBrand", wash: "accentOnWash", dark: "accentOnDark", paper: "accent" }[bg];
    const bandH = footer ? R(f.H * (f.L ? 0.15 : 0.09)) : 0;
    // The photo panel: the right 42% of a landscape card, the lower 40% of a
    // portrait/vertical one.
    const photoBox = photoRole
      ? f.L
        ? { x: R(f.W * 0.58), y: 0, w: f.W - R(f.W * 0.58), h: f.H - bandH }
        : { x: 0, y: R((f.H - bandH) * (f.V ? 0.58 : 0.6)), w: f.W, h: f.H - bandH - R((f.H - bandH) * (f.V ? 0.58 : 0.6)) }
      : null;
    const textW = (photoBox && f.L ? photoBox.x : f.W) - m * 2;
    const textBottom = photoBox && !f.L ? photoBox.y : f.H - bandH;
    const logoH = R(f.H * (f.L ? 0.1 : 0.06));
    let y = m + logoH + R(m * (f.V ? 1.6 : 0.9));
    // Nominal sizes, then ONE factor that shrinks everything together when
    // the stack would run into the photo or the band — a card keeps its
    // proportions rather than letting its last line fall off the frame.
    let big = fs(f, f.L ? 0.062 : f.V ? 0.058 : 0.064);
    let statSize = fs(f, f.L ? 0.11 : 0.12);
    let small = fs(f, f.L ? 0.027 : 0.026);
    const needed =
      (eyebrow ? small * 2 : 0) +
      (stat || statPh ? statSize * 1.3 : 0) +
      big * (f.L ? 2.5 : 3.6) +
      (list ? small * 1.6 * list.length : body ? small * 1.15 * (f.L ? 3 : 4) : 0);
    const room = textBottom - y - m;
    const k = needed > room ? Math.max(0.5, room / needed) : 1;
    big = R(big * k);
    statSize = R(statSize * k);
    small = R(small * k);
    const out = [logo({ x: m, y: m, w: R(textW * 0.6), h: logoH, color: `@${onRole}`, on: bg })];
    if (eyebrow) {
      out.push(
        text("eyebrow", eyebrow, { x: m, y, w: textW, size: small, color: `@${accentRole}`, on: bg, spacing: 160, fit: { maxLines: 1, max: small, min: 11 } }),
      );
      y += R(small * 2);
    }
    if (stat || statPh) {
      out.push(
        text("stat", stat || statPh, {
          x: m,
          y,
          w: textW,
          size: statSize,
          color: `@${accentRole}`,
          on: bg,
          ph: statPh ? "stat" : undefined,
          fit: { maxLines: 1, max: statSize, min: R(statSize * 0.45) },
        }),
      );
      y += R(statSize * 1.3);
    }
    out.push(
      text("headline", headline, {
        x: m,
        y,
        w: textW,
        size: big,
        color: `@${onRole}`,
        on: bg,
        fit: { maxLines: f.L ? 2 : 3, max: big, min: R(big * 0.5) },
      }),
    );
    y += R(big * (f.L ? 2.5 : 3.6));
    if (list) {
      const rows = list.length;
      const avail = textBottom - y - m;
      const rowH = Math.max(small * 1.6, Math.min(small * 3.2, avail / Math.max(1, rows)));
      list.forEach((item, i) => {
        const marker = item.marker || "•";
        out.push(
          text(`item-${i + 1}-marker`, marker, { x: m, y: y + i * rowH, w: R(small * 2), size: small, color: `@${accentRole}`, on: bg, vars: item.vars }),
          text(`item-${i + 1}`, item.text, {
            x: m + R(small * 2.1),
            y: y + i * rowH,
            w: textW - R(small * 2.1),
            size: small,
            color: `@${onRole}`,
            on: bg,
            weight: "normal",
            ph: item.ph,
            fit: { maxLines: 2, max: small, min: R(small * 0.6) },
          }),
        );
      });
    } else if (body) {
      out.push(
        text("body", body, {
          x: m,
          y,
          w: textW,
          size: small,
          color: `@${mutedRole}`,
          on: bg,
          weight: "normal",
          ph: body.startsWith("§ph.") ? "text" : undefined,
          fit: { maxLines: f.L ? 3 : 4, max: small, min: R(small * 0.6) },
        }),
      );
    }
    if (photoBox) out.push(photo(photoRole, photoBox));
    if (footer === "cta") out.push(ctaBand(f, { y: f.H - bandH, h: bandH, role: bg === "dark" ? "brand" : bg === "brand" ? "dark" : "brand" }));
    return slide(bg, out);
  };
}

// ─ Trust ─

function reviewCard({ withPhoto }) {
  return (f) => {
    const m = margin(f);
    const photoH = withPhoto ? R(f.L ? f.H : f.H * 0.42) : 0;
    const photoW = withPhoto && f.L ? R(f.W * 0.42) : f.W;
    const left = withPhoto && f.L ? photoW + m : m;
    const w = f.W - left - m;
    const top = withPhoto && !f.L ? photoH + m : m;
    const quoteMark = fs(f, f.L ? 0.12 : 0.13);
    const stars = fs(f, f.L ? 0.04 : 0.038);
    const quote = fs(f, f.L ? 0.034 : 0.036);
    const small = fs(f, f.L ? 0.024 : 0.024);
    const out = [];
    if (withPhoto) out.push(photo("hero", { x: 0, y: 0, w: photoW, h: photoH }));
    out.push(
      text("title", "§reviewTitle", { x: left, y: top, w, size: small, color: "@accentOnWash", on: "wash", spacing: 140, fit: { maxLines: 1, max: small, min: 11 } }),
      // The three "@review.*" texts are placeholders only when the company
      // has no real review to print — decided at fill time (templateFill.js
      // resolveText), never flagged here, or a real review would still block
      // publishing.
      text("stars", "@review.stars", { x: left, y: top + R(small * 2), w, size: stars, color: "@accentOnWash", on: "wash" }),
      text("quote-mark", "“", { x: left - R(quoteMark * 0.08), y: top + R(small * 2 + stars * 1.4), w: R(quoteMark), size: quoteMark, color: "@accentOnWash", on: "wash", font: "Georgia", lh: 1 }),
      text("quote", "@review.text", {
        x: left,
        y: top + R(small * 2 + stars * 1.4 + quoteMark * 0.7),
        w,
        size: quote,
        color: "@onWash",
        on: "wash",
        weight: "normal",
        font: "Georgia",
        lh: 1.25,
        fit: { maxLines: withPhoto ? (f.L ? 6 : 5) : f.L ? 5 : 9, max: quote, min: R(quote * 0.5) },
      }),
      text("reviewer", "@review.name", {
        x: left,
        y: f.H - m - R(small * 3.2),
        w,
        size: small,
        color: "@onWash",
        on: "wash",
        fit: { maxLines: 1, max: small, min: 11 },
      }),
      text("company", "{company}", { x: left, y: f.H - m - R(small * 1.4), w, size: R(small * 0.9), color: "@mutedOnWash", on: "wash", weight: "normal", fit: { maxLines: 1, max: R(small * 0.9), min: 10 } }),
    );
    return slide("wash", out);
  };
}

// ─ Tips ─

function mythFact(f) {
  const m = margin(f);
  const big = fs(f, f.L ? 0.034 : 0.036);
  const label = fs(f, f.L ? 0.03 : 0.028);
  const title = fs(f, f.L ? 0.05 : 0.05);
  const titleH = R(title * 2.2) + m;
  const panels = f.L
    ? [
        { x: 0, y: titleH, w: R(f.W / 2), h: f.H - titleH },
        { x: R(f.W / 2), y: titleH, w: f.W - R(f.W / 2), h: f.H - titleH },
      ]
    : [
        { x: 0, y: titleH, w: f.W, h: R((f.H - titleH) / 2) },
        { x: 0, y: titleH + R((f.H - titleH) / 2), w: f.W, h: f.H - titleH - R((f.H - titleH) / 2) },
      ];
  const [a, b] = panels;
  return slide("paper", [
    text("title", "§mythTitle", { x: m, y: m, w: f.W - m * 2, size: title, color: "@ink", on: "paper", fit: { maxLines: 1, max: title, min: R(title * 0.6) } }),
    rect("myth-bg", { ...a, fill: "@dark" }),
    text("myth-label", "§myth", { x: a.x + m, y: a.y + m, w: a.w - m * 2, size: label, color: "@mutedOnDark", on: "dark", spacing: 200 }),
    text("myth", "§ph.myth", { x: a.x + m, y: a.y + m + R(label * 2), w: a.w - m * 2, size: big, color: "@onDark", on: "dark", ph: "text", fit: { maxLines: 4, max: big, min: R(big * 0.6) } }),
    rect("fact-bg", { ...b, fill: "@brand" }),
    text("fact-label", "§fact", { x: b.x + m, y: b.y + m, w: b.w - m * 2, size: label, color: "@onBrand", on: "brand", spacing: 200 }),
    text("fact", "§ph.fact", { x: b.x + m, y: b.y + m + R(label * 2), w: b.w - m * 2, size: big, color: "@onBrand", on: "brand", ph: "text", fit: { maxLines: 4, max: big, min: R(big * 0.6) } }),
  ]);
}

function faq(f) {
  const m = margin(f);
  const title = fs(f, f.L ? 0.05 : 0.055);
  const q = fs(f, f.L ? 0.028 : 0.03);
  const logoH = R(f.H * (f.L ? 0.1 : 0.06));
  const top = m + logoH + R(m * 0.8);
  const bandH = R(f.H * (f.L ? 0.15 : 0.09));
  const avail = f.H - bandH - top - R(title * 2.9) - m;
  const block = R(avail / 2);
  const out = [
    logo({ x: m, y: m, w: R(f.W * 0.4), h: logoH, color: "@onWash", on: "wash" }),
    text("title", "§faqTitle", { x: m, y: top, w: f.W - m * 2, size: title, color: "@onWash", on: "wash", fit: { maxLines: 2, max: title, min: R(title * 0.6) } }),
  ];
  // Two Q&A pairs: stacked on a tall frame, side by side on the link card,
  // where two stacked pairs would not fit the height.
  const colW = f.L ? R((f.W - m * 3) / 2) : f.W - m * 2;
  for (let i = 0; i < 2; i++) {
    const y = top + R(title * 2.9) + (f.L ? 0 : i * block);
    const x = f.L ? m + i * (colW + m) : m;
    out.push(
      text(`q${i + 1}-mark`, "§q", { x, y, w: R(q * 2), size: q, color: "@accentOnWash", on: "wash" }),
      text(`q${i + 1}`, "§ph.question", { x: x + R(q * 2), y, w: colW - R(q * 2), size: q, color: "@onWash", on: "wash", ph: "text", fit: { maxLines: 2, max: q, min: R(q * 0.6) } }),
      text(`a${i + 1}-mark`, "§a", { x, y: y + R(q * 2.8), w: R(q * 2), size: q, color: "@accentOnWash", on: "wash" }),
      text(`a${i + 1}`, "§ph.answer", {
        x: x + R(q * 2),
        y: y + R(q * 2.8),
        w: colW - R(q * 2),
        size: q,
        color: "@mutedOnWash",
        on: "wash",
        weight: "normal",
        ph: "text",
        fit: { maxLines: 3, max: q, min: R(q * 0.6) },
      }),
    );
  }
  return slide("wash", [out, ctaBand(f, { y: f.H - bandH, h: bandH })]);
}

function howCover(f) {
  const m = margin(f);
  const big = fs(f, f.L ? 0.09 : 0.1);
  const small = fs(f, f.L ? 0.03 : 0.03);
  const logoH = R(f.H * (f.L ? 0.12 : 0.07));
  return slide("brand", [
    logo({ x: m, y: m, w: R(f.W * 0.4), h: logoH, color: "@onBrand", on: "brand" }),
    text("headline", "§howTitle", { x: m, y: R(f.H * 0.36), w: f.W - m * 2, size: big, color: "@onBrand", on: "brand", fit: { maxLines: 2, max: big, min: R(big * 0.55) } }),
    text("swipe", "§swipe", { x: m, y: f.H - m - R(small * 1.3), w: f.W - m * 2, size: small, color: "@onBrand", on: "brand", align: "right", weight: "normal" }),
  ]);
}

function howStep(n) {
  return (f) => {
    const m = margin(f);
    const num = fs(f, f.L ? 0.22 : 0.26);
    const label = fs(f, f.L ? 0.03 : 0.03);
    const big = fs(f, f.L ? 0.055 : 0.06);
    const y0 = f.L ? m : R(f.H * 0.18);
    return slide("wash", [
      text("step-number", String(n), { x: m, y: y0, w: R(num * 1.2), size: num, color: "@accentOnWash", on: "wash", lh: 1 }),
      text("step-label", "§stepLabel", { x: f.L ? m + R(num * 1.1) : m, y: f.L ? y0 + R(num * 0.2) : y0 + R(num * 1.15), w: f.L ? f.W - m * 2 - R(num * 1.1) : f.W - m * 2, size: label, color: "@mutedOnWash", on: "wash", spacing: 160, vars: { n } }),
      text("step", `§step${n}`, {
        x: f.L ? m + R(num * 1.1) : m,
        y: f.L ? y0 + R(num * 0.2) + R(label * 2.2) : y0 + R(num * 1.15) + R(label * 2.4),
        w: f.L ? f.W - m * 2 - R(num * 1.1) : f.W - m * 2,
        size: big,
        color: "@onWash",
        on: "wash",
        fit: { maxLines: 3, max: big, min: R(big * 0.55) },
      }),
      text("company", "{company}", { x: m, y: f.H - m - R(label * 1.3), w: f.W - m * 2, size: R(label * 0.9), color: "@mutedOnWash", on: "wash", weight: "normal", fit: { maxLines: 1, max: R(label * 0.9), min: 10 } }),
    ]);
  };
}

// ─ People ─

function meetTeam(f) {
  const m = margin(f);
  const title = fs(f, f.L ? 0.05 : 0.056);
  const name = fs(f, f.L ? 0.034 : 0.036);
  const role = fs(f, f.L ? 0.024 : 0.026);
  const photoBox = f.L ? { x: 0, y: 0, w: R(f.W * 0.5), h: f.H } : { x: 0, y: 0, w: f.W, h: R(f.H * 0.62) };
  const tx = f.L ? photoBox.w + m : m;
  const tw = f.W - tx - m;
  const ty = f.L ? R(f.H * 0.18) : photoBox.h + m;
  return slide("paper", [
    photo("team", photoBox),
    text("title", "§teamTitle", { x: tx, y: ty, w: tw, size: title, color: "@ink", on: "paper", fit: { maxLines: 2, max: title, min: R(title * 0.6) } }),
    rect("rule", { x: tx, y: ty + R(title * (f.L ? 2.5 : 1.5)), w: R(tw * 0.2), h: R(fs(f, 0.006)) + 2, fill: "@brand" }),
    text("name", "§ph.name", { x: tx, y: ty + R(title * (f.L ? 2.9 : 1.9)), w: tw, size: name, color: "@ink", on: "paper", ph: "text", fit: { maxLines: 1, max: name, min: R(name * 0.6) } }),
    text("role", "§ph.role", { x: tx, y: ty + R(title * (f.L ? 2.9 : 1.9)) + R(name * 1.5), w: tw, size: role, color: "@muted", on: "paper", weight: "normal", ph: "text", fit: { maxLines: 1, max: role, min: 11 } }),
    text("company", "{company}", { x: tx, y: f.H - m - R(role * 1.3), w: tw, size: role, color: "@accent", on: "paper", fit: { maxLines: 1, max: role, min: 10 } }),
  ]);
}

function thankYou(f) {
  const m = margin(f);
  const big = fs(f, f.L ? 0.11 : 0.12);
  const small = fs(f, f.L ? 0.032 : 0.032);
  const logoH = R(f.H * (f.L ? 0.16 : 0.09));
  const cy = R(f.H * (f.L ? 0.34 : 0.38));
  return slide("wash", [
    circle("accent-dot", { cx: R(f.W * 0.86), cy: R(f.H * 0.16), r: R(fs(f, 0.05)), fill: "@brand" }),
    circle("accent-dot-2", { cx: R(f.W * 0.12), cy: R(f.H * 0.88), r: R(fs(f, 0.03)), fill: "@brand" }),
    text("headline", "§thanks", { x: m, y: cy, w: f.W - m * 2, size: big, color: "@accentOnWash", on: "wash", align: "center", fit: { maxLines: 2, max: big, min: R(big * 0.5) } }),
    text("sub", "§thanksSub", { x: m, y: cy + R(big * 1.5), w: f.W - m * 2, size: small, color: "@onWash", on: "wash", align: "center", weight: "normal", fit: { maxLines: 2, max: small, min: R(small * 0.6) } }),
    logo({ x: R(f.W * 0.3), y: f.H - m - logoH, w: R(f.W * 0.4), h: logoH, color: "@onWash", on: "wash", align: "center" }),
  ]);
}

// ── The catalogue ───────────────────────────────────────────────────────────
//
// `key` is the stable identity the seed upserts on — never renamed; the
// sidebar prints the translated name `app.designerTemplates.name.<key>`.

export const TEMPLATE_CATALOG = [
  // Before / after
  { key: "ba-split-slider", category: "before_after", slides: [baSplitSlider] },
  { key: "ba-top-bottom", category: "before_after", slides: [baStacked] },
  { key: "ba-diagonal", category: "before_after", slides: [baDiagonal] },
  { key: "ba-inset", category: "before_after", slides: [baInset] },
  { key: "ba-progress", category: "before_after", slides: [baTriptych] },
  { key: "ba-project-story", category: "before_after", slides: [baStoryCover, detailSlide(1), detailSlide(2), ctaSlide] },

  // Win work
  { key: "win-just-completed", category: "win_work", slides: [hero({ headline: "§justCompleted", sub: "§justCompletedSub", photoRole: "hero" })] },
  { key: "win-free-estimate", category: "win_work", slides: [card({ bg: "brand", headline: "§freeEstimate", body: "§freeEstimateSub", photoRole: "hero" })] },
  { key: "win-now-booking", category: "win_work", slides: [hero({ headline: "§nowBooking", sub: "§nowBookingSub", photoRole: "hero" })] },
  { key: "win-seasonal-promo", category: "win_work", slides: [card({ bg: "wash", eyebrow: "§seasonalSpecial", statPh: "§ph.offer", headline: "§promoSub", body: null })] },
  { key: "win-limited-slots", category: "win_work", slides: [card({ bg: "dark", headline: "§limitedSlots", body: "§limitedSlotsSub", photoRole: "hero" })] },
  { key: "win-service-menu", category: "win_work", slides: [card({ bg: "paper", headline: "§whatWeDo", body: "{services}" })] },
  { key: "win-now-serving", category: "win_work", slides: [card({ bg: "wash", eyebrow: "§nowServing", headline: "{areas}", body: "§freeEstimateSub" })] },

  // Trust
  { key: "trust-review-card", category: "trust", slides: [reviewCard({ withPhoto: false })] },
  { key: "trust-review-photo", category: "trust", slides: [reviewCard({ withPhoto: true })] },
  { key: "trust-licensed", category: "trust", slides: [card({ bg: "brand", eyebrow: "✓", headline: "§licensed", body: "§ph.licence" })] },
  { key: "trust-warranty", category: "trust", slides: [card({ bg: "wash", statPh: "§ph.years", headline: "§warrantyTitle", body: "§warrantySub" })] },
  { key: "trust-years", category: "trust", slides: [card({ bg: "dark", statPh: "§ph.years", headline: "§yearsTitle", body: "§servingTown" })] },
  { key: "trust-milestone", category: "trust", slides: [card({ bg: "paper", statPh: "§ph.number", headline: "§milestoneTitle", body: "§thankYouCustomers", photoRole: "hero" })] },

  // Tips
  {
    key: "tips-three-signs",
    category: "tips",
    slides: [
      card({
        bg: "wash",
        headline: "§signsTitle",
        list: [1, 2, 3].map((n) => ({ marker: String(n), text: "§ph.sign", ph: "text" })),
      }),
    ],
  },
  {
    key: "tips-maintenance-checklist",
    category: "tips",
    slides: [
      card({
        bg: "paper",
        headline: "§checklistTitle",
        list: [1, 2, 3, 4].map(() => ({ marker: "☐", text: "§ph.task", ph: "text" })),
      }),
    ],
  },
  { key: "tips-myth-fact", category: "tips", slides: [mythFact] },
  { key: "tips-faq", category: "tips", slides: [faq] },
  { key: "tips-how-it-works", category: "tips", slides: [howCover, howStep(1), howStep(2), howStep(3), ctaSlide] },

  // People
  { key: "people-meet-team", category: "people", slides: [meetTeam] },
  { key: "people-hiring", category: "people", slides: [card({ bg: "brand", headline: "§hiringTitle", body: "§ph.hiringRole", footer: null, photoRole: "work" })] },
  { key: "people-crew-at-work", category: "people", slides: [hero({ headline: "§crewTitle", sub: "{company} · {town}", photoRole: "work" })] },
  { key: "people-thank-you", category: "people", slides: [thankYou] },
  { key: "people-referral", category: "people", slides: [card({ bg: "wash", headline: "§referralTitle", body: "§referralSub", statPh: "§ph.reward" })] },
];

/** The frame's workspace rect — `name: "clip"`, at the origin (see jobPost.js). */
function clipFor(f, fill) {
  return {
    ...base("clip", { type: "rect", left: 0, top: 0, width: f.W, height: f.H, fill, stroke: null, strokeWidth: 0, rx: 0, ry: 0 }),
    selectable: false,
    hasControls: false,
  };
}

/**
 * Every slide of one template, in every format.
 *
 * @returns {Array<Record<string, {json: object, width: number, height: number}>>}
 *   one map per slide: { instagram_portrait, tiktok, facebook_feed }.
 */
export function buildTemplateSlides(template, formats = TEMPLATE_FORMATS) {
  return template.slides.map((draw) => {
    const out = {};
    for (const key of formats) {
      const f = frameFor(key);
      if (!f) continue;
      const drawn = draw(f);
      out[key] = {
        json: { version: FABRIC_VERSION, objects: [clipFor(f, drawn.fqBackground || "@paper"), ...drawn.objects] },
        width: f.W,
        height: f.H,
      };
    }
    return out;
  });
}

export function catalogTemplate(key) {
  return TEMPLATE_CATALOG.find((t) => t.key === key) || null;
}
