// lib/kitchen/designerTheme.js
//
// Translate FieldQuo's document theme into the shape the kitchen designer wants.
//
// The designer came from a single-tenant app and carries its own six-key theme
// ({ bg, card, text, textMuted, border, gold }) through ~175 style props. Renaming
// those in place would be a large, silent, entirely cosmetic diff across 4,000
// lines of working drawing code — precisely the kind of change that breaks a
// technical drawing in a way nobody notices until a client sees it.
//
// So the designer keeps its vocabulary and this file is the one place the two
// meet. `gold` is a historical name for "the accent"; the value is the company's
// brand colour, which is what matters.
//
// ── Contrast is measured, not assumed ──────────────────────────────────────
//
// Contractors pick yellow, white, black and mid-grey. `documentTheme` already
// solves this — `accentText` is the brand colour adjusted until it reads on the
// page, and it is a DIFFERENT value from `accentFill`, which is the same hex used
// as a background. The designer uses its accent for both label text and fills, so
// it gets `accentText`: a fill that is slightly too dark is invisible as a
// problem, whereas a dimension label nobody can read makes the drawing useless.
import { documentTheme } from "@/lib/documents/theme";

/**
 * @param company  { brandColor }
 * @param dark     render for the app's dark theme
 */
export function designerTheme(company = {}, dark = false) {
  const t = documentTheme(company);

  if (!dark) {
    return {
      bg: t.paper,
      card: t.paperSoft || t.paper,
      text: t.ink,
      textMuted: t.inkMuted,
      border: t.border,
      gold: t.accentText,
    };
  }

  // Dark surfaces are the app's, not the document's — a quote PDF is always on
  // paper, so documentTheme has no dark palette to borrow. These match the
  // sidebar so the drawing doesn't look like a pasted-in window.
  //
  // The accent is the raw brand colour here rather than `accentText`: that value
  // was contrast-corrected against WHITE paper, and a colour darkened to read on
  // white is the wrong direction on a near-black panel.
  return {
    bg: "#0e1116",
    card: "#161a21",
    text: "#f3f4f6",
    textMuted: "#9ca3af",
    border: "#262b34",
    gold: onDark(t.accent),
  };
}

/**
 * Lift a colour until it reads against the dark panel above.
 *
 * Deliberately not a "is it dark? go white" rule — that is the naive test
 * lib/documents/theme.js exists because of, and it throws away the company's
 * brand entirely on any mid-tone. This nudges lightness up in steps and stops as
 * soon as the contrast is good enough, so a navy contractor gets a lighter navy
 * rather than white.
 */
function onDark(hex, bg = "#161a21", target = 4.5) {
  let c = hex;
  for (let i = 0; i < 12; i++) {
    if (contrast(c, bg) >= target) return c;
    c = lighten(c, 0.06);
  }
  return c;
}

function parse(hex) {
  const h = String(hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6) || "888888", 16);
  return Number.isFinite(n)
    ? [(n >> 16) & 255, (n >> 8) & 255, n & 255]
    : [136, 136, 136];
}

function lighten(hex, amt) {
  const [r, g, b] = parse(hex);
  const up = (v) => Math.round(Math.min(255, v + (255 - v) * amt));
  return `#${[up(r), up(g), up(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function luminance(hex) {
  const [r, g, b] = parse(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export { contrast as _contrast };
