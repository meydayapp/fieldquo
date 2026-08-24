// lib/links/theme.js
//
// The bio-link page's palette, derived from the company's one brand hex.
//
// ── Why not just use documentTheme directly ─────────────────────────────────
//
// It is used directly — every value below comes out of it. What this adds is
// the MEASUREMENTS, returned alongside the colours.
//
// This page is a wall of text on coloured surfaces and nothing else. There is
// no photograph to look at and no table to read, so a pairing that lands at
// 4.3:1 is not a detail here, it is the page. documentTheme's helpers already
// guarantee 4.5:1 for the pairings they were designed for; returning the ratio
// means a check script can prove it against the brand colours contractors
// actually pick — silver (#c0c0c0), near-white (#fefcdd) and near-black
// (#1a1a1a) are all live in the database today — instead of the code merely
// claiming it.
//
// ── Every field here is painted ─────────────────────────────────────────────
//
// A theme is the easiest place in a codebase to leave a colour nobody uses,
// and then to "check the contrast" of a pairing that never reaches a screen.
// Nothing is exported that app/l/[slug]/page.js does not set, and every
// exported colour appears in one of the two ratio maps.
//
// Plain hex out, no CSS variables: the page is server-rendered for a stranger
// who may have JavaScript off, on a phone, on a bad connection. Literal values
// in a style attribute is the whole of it.

import { documentTheme, fillPair, washPair, ruleColor } from "@/lib/documents/theme";
import { contrastRatio, ensureContrast } from "@/lib/brand/colour";

/** WCAG 1.4.3 for body text. */
export const TEXT_TARGET = 4.5;
/** WCAG 1.4.11 for the edge of a control you have to be able to find. */
export const NON_TEXT_TARGET = 3;

/**
 * @param company  needs only `brandColor`
 * @returns the colours the page paints, plus `ratios` (text, floor 4.5) and
 *          `nonTextRatios` (the card edge, floor 3).
 */
export function linkPageTheme(company = {}) {
  const theme = documentTheme(company);
  const wash = washPair(theme);
  const primary = fillPair(theme);

  // The page sits on the wash — a very light version of their colour, or the
  // neutral chip when the brand is too pale to tint with. Both come with text
  // colours already measured against them by washPair.
  const pageBg = wash.bg;

  // The rows are paper cards on that wash. Paper on a near-white wash is very
  // nearly invisible, so the card's EDGE is what makes it a control, and the
  // edge is held to 3:1 rather than left at whatever the brand tint happened
  // to give: accentRule against accentWash is about 1.6:1 on most hues, which
  // is a card you can only see if you already know it is there.
  const cardBg = theme.paper;
  const cardInk = theme.ink;
  const cardBorder = ensureContrast(theme.accentRule, pageBg, NON_TEXT_TARGET);
  // The row's icon. ruleColor keeps a near-white brand from producing an
  // invisible glyph; ensureContrast then holds it to text contrast, because it
  // is the only thing distinguishing one row from the next at a glance.
  const cardAccent = ensureContrast(ruleColor(theme), cardBg, TEXT_TARGET);

  return {
    pageBg,
    pageInk: wash.ink,
    pageMuted: wash.muted,

    primaryBg: primary.bg,
    primaryFg: primary.fg,

    cardBg,
    cardInk,
    cardAccent,
    cardBorder,

    // Nothing on this page qualifies as large-scale text by WCAG's definition
    // (the heading is bold at 20px, under the 18.66px-bold threshold), so all
    // of it is held to the body-text bar rather than 3:1.
    ratios: {
      pageInkOnPage: contrastRatio(wash.ink, pageBg),
      pageMutedOnPage: contrastRatio(wash.muted, pageBg),
      primaryFgOnPrimary: contrastRatio(primary.fg, primary.bg),
      cardInkOnCard: contrastRatio(cardInk, cardBg),
      cardAccentOnCard: contrastRatio(cardAccent, cardBg),
    },
    nonTextRatios: {
      cardBorderOnPage: contrastRatio(cardBorder, pageBg),
    },
  };
}

/**
 * Every ratio the theme reports, against the bar that applies to it.
 *
 * Returns the numbers rather than a boolean alone, for the same reason
 * foregroundContrast does in lib/brand/colour.js: "white, 12:1" and "white,
 * 4.51:1" are different situations and a caller that can only see `true`
 * cannot tell them apart.
 */
export function themeContrastReport(theme) {
  const entries = [
    ...Object.entries(theme?.ratios || {}).map(([name, ratio]) => ({
      name,
      ratio,
      target: TEXT_TARGET,
      ok: ratio >= TEXT_TARGET,
    })),
    ...Object.entries(theme?.nonTextRatios || {}).map(([name, ratio]) => ({
      name,
      ratio,
      target: NON_TEXT_TARGET,
      ok: ratio >= NON_TEXT_TARGET,
    })),
  ];
  return { entries, ok: entries.every((e) => e.ok) };
}
