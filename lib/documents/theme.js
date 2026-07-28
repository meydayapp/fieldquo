// lib/documents/theme.js
//
// One palette for every client-facing document.
//
// ── The problem this solves ─────────────────────────────────────────────────
//
// A quote is the most important document a contractor sends. It's the thing
// that gets forwarded to a spouse, compared against two competitors, and read
// on a phone in a driveway. FieldQuo's default looked like a bank statement:
// centred logo, thin grey rules, an untitled table of numbers. Three quotes
// from three companies were indistinguishable.
//
// This module makes the default good, and makes it THEIRS — every colour on
// the page derives from the one hex the company already picked in Settings →
// Branding. Nothing is hardcoded, so a navy roofer and a lime-green landscaper
// both get a document that looks deliberate.
//
// ── Why derived rather than a set of presets ────────────────────────────────
//
// A preset palette means the company's logo sits on a page in someone else's
// colours. Deriving means the accent rule at the top of the page is the same
// colour as the van outside. That's the whole pitch of white-labelling, and it
// costs nothing beyond the arithmetic below.
//
// ── Why contrast is measured, not assumed ───────────────────────────────────
//
// Contractors pick yellow. They pick pale grey. They pick black. The naive
// "is it dark? use white text" rule fails on exactly the mid-tones that brand
// colours occupy, and the failure mode is a quote a client can't read. So
// every foreground here goes through ensureContrast(), and the accent used for
// TEXT is a separately-darkened value from the accent used for FILLS — the
// same distinction the app chrome already makes in globals.css.
//
// Plain hex out, no CSS variables: this feeds @react-pdf/renderer (which has
// no cascade) and the public quote page (which is server-rendered for a
// stranger who may have no JS). Both need literal values.

import {
  isValidHex,
  ensureContrast,
  readableForeground,
  adjustLightness,
  tint,
  contrastRatio,
} from "@/lib/brand/colour";

// FieldQuo navy. Used when a company hasn't set anything, or set something
// unparseable — never left to produce NaN colours downstream.
export const FALLBACK_BRAND = "#06356b";

const norm = (hex, fallback = FALLBACK_BRAND) =>
  isValidHex(hex) ? (String(hex).startsWith("#") ? hex : `#${hex}`) : fallback;

/**
 * The document palette.
 *
 * @param company  needs only `brandColor`; anything else is ignored
 * @param accentOverride  a per-scope colour (see serviceContent.js) that
 *                        should be blended into the page instead of the brand
 *                        colour. Used for the per-service cards so a
 *                        three-trade quote reads as three sections rather than
 *                        one long list.
 */
export function documentTheme(company = {}, accentOverride) {
  const brand = norm(company.brandColor);
  const accent = norm(accentOverride, brand);

  // Paper is near-white rather than pure white. Pure white on a screen next to
  // a browser chrome looks like an unstyled page; a hair of warmth reads as a
  // printed document, which is what this is pretending to be.
  const paper = "#ffffff";
  const page = "#f6f4f0";

  // Ink is a very dark neutral, not black. Black on white is harsh at body
  // size and prints heavier than it looks on screen.
  const ink = "#20242b";
  const inkMuted = ensureContrast("#6b7280", paper, 4.5);

  return {
    brand,
    accent,

    // The accent as a FILL: badges, the rule at the top of the page, the
    // number bubbles on the process steps. Text placed on it must use
    // accentOn, which is measured rather than assumed white.
    accentFill: accent,
    accentOn: readableForeground(accent),

    // The accent as TEXT on paper. Distinct from accentFill on purpose:
    // FieldQuo's own orange is 5.6:1 as a fill and 2.9:1 as text. Same colour,
    // two jobs, two values.
    accentText: ensureContrast(accent, paper, 4.5),

    // Washes. `tint` keeps the hue and drops saturation, so a card background
    // reads as "a lighter version of their colour" rather than grey.
    accentWash: tint(accent, 0.96, 0.1),
    accentWashStrong: tint(accent, 0.9, 0.16),
    accentRule: tint(accent, 0.78, 0.22),

    // A second brand-derived colour for the gradient bar. Slightly lighter and
    // less saturated, which reads as a highlight rather than a second colour.
    accentSoft: adjustLightness(accent, 0.14),

    paper,
    page,
    ink,
    inkMuted,
    inkFaint: ensureContrast("#9099a6", paper, 3),
    border: "#e4e2dd",
    borderSoft: "#efedE8",

    // Status colours stay fixed. Green means approved everywhere on earth and
    // deriving it from a brand colour would make an approved quote look
    // declined for anyone whose brand is red.
    positive: "#15803d",
    positiveWash: "#f0fdf4",
    negative: "#b91c1c",
    warning: "#b45309",
  };
}

/**
 * Whether an accent is too close to the page to be seen against it.
 *
 * A company whose brand colour is white or near-white would otherwise get an
 * invisible rule across the top of every quote. Callers substitute ink.
 */
export function accentIsWashedOut(theme) {
  return contrastRatio(theme.accent, theme.paper) < 1.6;
}

/**
 * Safe accent for a hairline or rule — falls back to ink when the brand colour
 * would vanish against paper.
 */
export function ruleColor(theme) {
  return accentIsWashedOut(theme) ? theme.ink : theme.accent;
}

/**
 * Safe fill for a solid band — the totals bar, the step bubbles.
 *
 * Distinct from ruleColor only in what it returns text-wise: a caller needs
 * BOTH the fill and something legible on it, and a near-white brand colour
 * makes a band that has readable text and no visible edges, which reads as a
 * rendering bug rather than as a design choice. Substituting ink keeps the
 * most important number on the document inside a shape you can see.
 */
export function fillPair(theme) {
  if (accentIsWashedOut(theme)) {
    return { bg: theme.ink, fg: "#ffffff" };
  }
  return { bg: theme.accentFill, fg: theme.accentOn };
}

/** Status pill colours for the document header. */
export function statusStyle(status, theme) {
  switch (status) {
    case "accepted":
    case "paid":
      return { fg: theme.positive, bg: theme.positiveWash };
    case "declined":
    case "overdue":
      return { fg: theme.negative, bg: "#fef2f2" };
    case "sent":
      return { fg: theme.accentText, bg: theme.accentWash };
    default:
      return { fg: theme.inkMuted, bg: "#f3f4f6" };
  }
}
