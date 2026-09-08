// lib/links/theme.js
//
// The bio-link page's palette, derived from the company's one brand hex — in
// two schemes, because this page follows the visitor's prefers-color-scheme.
//
// ── Why not just use documentTheme directly ─────────────────────────────────
//
// It is used directly — every LIGHT value below comes out of it. What this
// adds is the MEASUREMENTS, returned alongside the colours, and a dark scheme.
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
// ── Why a dark scheme here and nowhere else client-facing ───────────────────
//
// app/layout.js forces every client-facing route to light, and says why: a
// quote that arrives dark because the homeowner's phone is dark is a document
// that looks wrong. This page is not a document. It is a menu, opened from a
// social app that is itself following the phone's setting, and a white flash
// between a dark Instagram and a dark website is the one thing about it a
// visitor would notice. So it follows prefers-color-scheme, with no JavaScript
// and no toggle — a `@media` block in an inline <style> that the page emits
// per company, holding the same measured bar in both schemes.
//
// The dark scheme is not "the light scheme inverted". A brand that carries a
// light page (navy) needs LIFTING on a dark one, and a brand that had to be
// swapped for ink on paper (yellow, white) is perfectly legible on near-black
// — so dark mode is where a yellow contractor finally sees their yellow. The
// washed-out test is therefore re-run against the dark surfaces rather than
// inherited from documentTheme's paper.
//
// ── The brand must be SEEN, not only measured ───────────────────────────────
//
// The owner's note on the redrawn page (2026-09-08): "it should use the theme
// colour of the company". The measured rules above are right — yellow on a
// near-white page is not a colour anyone can see, and swapping it for ink is
// what keeps the page legible — but a page that swaps the brand out of every
// element is a page that is no longer theirs. So every scheme guarantees at
// least one element that carries the brand at the bar that applies to it:
//
//   ring       the brand as a 3px halo — 3:1 against the page
//   primary    the featured pill's fill — 3:1 against the page, text 4.5:1
//   on-primary the featured pill's TEXT — 4.5:1 against the fill
//   accent     the row icons — 4.5:1 against the card
//
// The one that does the work for a hostile brand is `on-primary`. When the
// fill has to invert to ink (yellow on a light page; black on a dark one),
// the brand goes ON the ink instead: yellow text and arrow on a near-black
// pill measures 10:1, black text on a near-white pill 16:1. That is the
// device every monochrome or neon brand's own website uses for its one
// button, and it means the pill is never "FieldQuo's black button" — it is
// their colour on the one surface that can carry it. brandCarriers() below
// reports which elements carry the brand per scheme, and
// scripts/check-bio-link.mjs asserts one always does for the four brands the
// owner named (#FFD500, #111111, #808080, #1D4ED8).
//
// ── Every field here is painted ─────────────────────────────────────────────
//
// A theme is the easiest place in a codebase to leave a colour nobody uses,
// and then to "check the contrast" of a pairing that never reaches a screen.
// Nothing is exported that app/components/links/LinkPageView.js does not set,
// and every exported colour appears in one of the ratio maps.
//
// Plain hex out. The page turns them into CSS custom properties itself (see
// linkPageTokenCss in the view), which needs no JavaScript — a stranger with
// scripts off gets the media query for free. documentTheme avoids variables
// because it also feeds @react-pdf, which has no cascade; that constraint does
// not reach here.

import {
  documentTheme,
  fillPair,
  washPair,
  ruleColor,
  accentIsWashedOut,
} from "@/lib/documents/theme";
import {
  contrastRatio,
  ensureContrast,
  accessiblePair,
  adjustLightness,
  hexToHsl,
  hslToHex,
  hexToRgb,
  rgbToHex,
  isValidHex,
  tint,
} from "@/lib/brand/colour";

/** WCAG 1.4.3 for body text. */
export const TEXT_TARGET = 4.5;
/** WCAG 1.4.11 for the edge of a control you have to be able to find. */
export const NON_TEXT_TARGET = 3;
/**
 * The bar for a FILL against the page — the featured pill, whose text is
 * already at 4.5:1 and identifies it as a control on its own. The same 1.6
 * accentIsWashedOut uses for "can this colour be seen at all": sand (#bd9d60)
 * and FieldQuo's own orange sit at 2.3–2.6:1 against a near-white page and
 * are plainly visible because they have chroma the page does not; holding
 * them to 3:1 would swap both for ink on the one control that carries the
 * brand.
 */
export const VISIBLE_TARGET = 1.6;

/** The two schemes the page emits, in the order the CSS declares them. */
export const SCHEMES = ["light", "dark"];

/**
 * @param company  needs only `brandColor`
 * @param scheme   "light" (default) or "dark"
 * @returns the colours the page paints, plus `ratios` (text, floor 4.5),
 *          `nonTextRatios` (edges, floor 3) and `visibleRatios` (the one
 *          fill, floor 1.6 — see VISIBLE_TARGET).
 */
export function linkPageTheme(company = {}, { scheme = "light" } = {}) {
  return scheme === "dark" ? darkScheme(company) : lightScheme(company);
}

/** Both schemes at once — what the page renders from. */
export function linkPageSchemes(company = {}) {
  return {
    light: linkPageTheme(company, { scheme: "light" }),
    dark: linkPageTheme(company, { scheme: "dark" }),
  };
}

// documentTheme passes a three-digit brand ("#fff") through as typed, which
// is a valid colour and an invalid token for the CSS below (six digits, so
// the injection guard can be a strict shape check). Expanded here, once, so
// both schemes see the same six-digit brand.
function sixDigit(company) {
  const hex = company?.brandColor;
  return { brandColor: isValidHex(hex) ? rgbToHex(hexToRgb(hex)) : hex };
}

function lightScheme(company) {
  const theme = documentTheme(sixDigit(company));
  const wash = washPair(theme);

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
  // A brand too pale to carry anything (yellow, white) has already been
  // swapped for ink and the neutral chip everywhere else on this page, so
  // the edge goes neutral with it: accentRule darkened to 3:1 from a yellow
  // is an olive that appears nowhere else and reads as a mistake, not as
  // the brand.
  const washedOut = accentIsWashedOut(theme);
  const cardBorder = ensureContrast(washedOut ? "#d1d5db" : theme.accentRule, pageBg, NON_TEXT_TARGET);

  // The hover wash. nxt-lnk's is a fixed pink-to-blue; ours is the brand,
  // tinted nearly to white at one end and rotated a few degrees of hue at the
  // other, so the sweep reads as "their colour, lit" rather than as a second
  // colour. A brand too pale to tint with gets the neutral pair the page
  // already uses. Held brighter than the card edge on purpose: it is a
  // highlight, and the row's text is measured against its DARKER stop below.
  const hoverFrom = washedOut ? "#eef0f3" : tint(theme.accent, 0.945, 0.4);
  const hoverTo = washedOut ? "#f7f8fa" : rotated(theme.accent, 0.07, 0.97, 0.4);
  const hoverBorder = ensureContrast(adjustLightness(cardBorder, -0.12), pageBg, NON_TEXT_TARGET);

  // The row's icon. ruleColor keeps a near-white brand from producing an
  // invisible glyph; ensureContrast then holds it to text contrast against
  // the darkest surface it sits on — the hover stop — which clears paper too.
  // It is the only thing distinguishing one row from the next at a glance.
  const cardAccent = ensureContrast(ruleColor(theme), hoverFrom, TEXT_TARGET);

  // The avatar ring: the brand as a 3px halo. Same substitution as the icon
  // when the brand would vanish against the page.
  const ring = ensureContrast(ruleColor(theme), pageBg, NON_TEXT_TARGET);

  // The featured pill: the one filled control on the page, so it has no
  // border to find it by and its fill must clear the page on its own.
  //
  // fillPair already answers "ink" for a washed-out brand, but with white
  // text; the brand-on-ink rule (file header) wants the brand there when it
  // measures, so the washed-out case is settled here rather than trusted to
  // fillPair's foreground.
  const primary = washedOut
    ? { bg: cardInk, fg: brandOnInk(theme.accent, cardInk, cardBg) }
    : visibleFill(fillPair(theme), pageBg, VISIBLE_TARGET, { ink: cardInk, paper: cardBg, brand: theme.accent });

  return finish({
    pageBg,
    pageInk: wash.ink,
    pageMuted: wash.muted,
    primaryBg: primary.bg,
    primaryFg: primary.fg,
    cardBg,
    cardInk,
    cardAccent,
    cardBorder,
    hoverFrom,
    hoverTo,
    hoverBorder,
    ring,
  });
}

function darkScheme(company) {
  // documentTheme is used for one thing here: the brand hex, normalised and
  // falling back the same way the light scheme does, so both schemes agree on
  // what "their colour" is.
  const brand = documentTheme(sixDigit(company)).accent;
  const hsl = hexToHsl(brand);

  // nxt-lnk's dark tokens are #11181C on #ecedee — a cold near-black and a
  // warm near-white. These are the same two, tinted towards the brand the way
  // deriveBrandTokens tints the app chrome, so a navy page is faintly navy in
  // the dark and a grey brand gets a true neutral.
  const pageBg = tint(brand, 0.07, 0.18);
  const cardBg = tint(brand, 0.11, 0.16);
  const ink = tint(brand, 0.93, 0.06);
  const muted = ensureContrast(tint(brand, 0.66, 0.1), pageBg, TEXT_TARGET);

  // The brand as an accent on a dark card. A dark brand goes muddy there, so
  // it is lifted first (the same +0.18 the app chrome uses); a brand that is
  // still invisible against the card after that — black on near-black — is
  // replaced by ink, which is the light text colour in this scheme. This is
  // the light scheme's washed-out test, re-run against the dark card rather
  // than against paper: white was washed out there and is not here.
  const lifted = hsl.l < 0.55 ? adjustLightness(brand, 0.18) : brand;
  const accentBase = contrastRatio(lifted, cardBg) < 1.6 ? ink : lifted;

  const hoverFrom = tint(brand, 0.17, 0.3);
  const hoverTo = rotated(brand, 0.07, 0.13, 0.3);
  const cardBorder = ensureContrast(tint(brand, 0.3, 0.16), pageBg, NON_TEXT_TARGET);
  const hoverBorder = ensureContrast(adjustLightness(cardBorder, 0.12), pageBg, NON_TEXT_TARGET);
  // Light text on a dark hover: the LIGHTER stop is the worst case.
  const cardAccent = ensureContrast(accentBase, hoverFrom, TEXT_TARGET);
  const ring = ensureContrast(accentBase, pageBg, NON_TEXT_TARGET);

  // accessiblePair moves the fill, not the text, when a mid-tone can't carry
  // either — the same trick fillPair plays on the light side. The bar for
  // the fill against the page is the full 3:1 here, not VISIBLE_TARGET: on a
  // near-black page a lifted black brand is a dark grey pill with no chroma
  // to set it apart, which the light scheme's sand and orange have.
  const pair = accessiblePair(lifted, { light: ink, dark: pageBg, target: TEXT_TARGET });
  const primary = visibleFill({ bg: pair.bg, fg: pair.fg }, pageBg, NON_TEXT_TARGET, {
    ink,
    paper: pageBg,
    brand,
  });

  return finish({
    pageBg,
    pageInk: ink,
    pageMuted: muted,
    primaryBg: primary.bg,
    primaryFg: primary.fg,
    cardBg,
    cardInk: ink,
    cardAccent,
    cardBorder,
    hoverFrom,
    hoverTo,
    hoverBorder,
    ring,
  });
}

/**
 * A fill you can see against the page, or the inverse of the page.
 *
 * A black brand in dark mode, lifted, is a dark grey pill on a near-black
 * page: legible text, no visible shape. Rather than lift it further until it
 * stops being their colour, the pill inverts — ink on paper in the light
 * scheme, the light ink on the page colour in the dark one — which is what
 * every monochrome brand's own website does with its one button.
 */
function visibleFill(pair, pageBg, target, { ink, paper, brand }) {
  if (contrastRatio(pair.bg, pageBg) >= target) return pair;
  return { bg: ink, fg: brandOnInk(brand, ink, paper) };
}

/**
 * The brand as the TEXT of an ink-filled pill, when it measures there.
 *
 * The inverted pill is where a brand the page cannot show goes: yellow on a
 * light page becomes yellow on the near-black pill, black on a dark page
 * becomes black on the near-white one. Only when even that fails 4.5:1 —
 * a brand that is itself near the ink, like a navy on the light scheme's
 * charcoal — does the text fall to the paper colour, which is the pairing
 * the page had before this rule.
 */
function brandOnInk(brand, ink, fallback) {
  return isValidHex(brand) && contrastRatio(brand, ink) >= TEXT_TARGET ? brand : fallback;
}

// ── Which elements carry the brand ──────────────────────────────────────────

/**
 * The elements that can show the brand, each with the surface it sits on and
 * the bar that applies there. The featured pill's fill is held to the FULL
 * 3:1 here rather than VISIBLE_TARGET: the question this answers is "can a
 * visitor see their colour", and a 1.6:1 fill is visible without being
 * something you would call a colour.
 */
export const BRAND_ELEMENTS = [
  { element: "ring", field: "ring", on: "pageBg", target: NON_TEXT_TARGET },
  { element: "primary", field: "primaryBg", on: "pageBg", target: NON_TEXT_TARGET },
  { element: "on-primary", field: "primaryFg", on: "primaryBg", target: TEXT_TARGET },
  { element: "accent", field: "cardAccent", on: "cardBg", target: TEXT_TARGET },
  { element: "border", field: "cardBorder", on: "pageBg", target: NON_TEXT_TARGET },
];

/**
 * Whether a painted colour is still recognisably the brand.
 *
 * Not equality: the dark scheme lifts a navy, fillPair deepens a mid grey,
 * ensureContrast walks a blue two steps darker — all of those are "their
 * colour" to anyone looking. A tint that dropped the saturation to make a
 * wash is not, and neither is the ink a washed-out brand was swapped for.
 *
 * Chromatic brand: same hue (within 6% of the wheel) and still saturated.
 * Achromatic brand (black, grey, white): still achromatic, and within a
 * quarter of the lightness range — a black lifted to mid grey has stopped
 * being black, which is exactly the case the on-primary rule exists for.
 */
export function carriesBrand(hex, brand) {
  if (!isValidHex(hex) || !isValidHex(brand)) return false;
  const a = hexToHsl(hex);
  const b = hexToHsl(brand);
  if (!a || !b) return false;
  if (b.s < 0.1) return a.s < 0.2 && Math.abs(a.l - b.l) <= 0.25;
  const hueGap = Math.abs(a.h - b.h);
  return Math.min(hueGap, 1 - hueGap) <= 0.06 && a.s >= 0.3;
}

/**
 * For one scheme: each brand-capable element, whether it carries the brand,
 * and how it measures against its own surface.
 *
 * @param theme    from linkPageTheme()
 * @param company  the same object the theme was built from — `brandColor`
 * @returns { entries: [{ element, hex, on, ratio, target, carries, ok }], visible }
 *          where `visible` is true when at least one element carries the
 *          brand at its bar. The check script asserts it for every brand.
 */
export function brandCarriers(theme, company = {}) {
  const brand = documentTheme(sixDigit(company)).accent;
  const entries = BRAND_ELEMENTS.map(({ element, field, on, target }) => {
    const hex = theme?.[field];
    const surface = theme?.[on];
    const ratio = isValidHex(hex) && isValidHex(surface) ? contrastRatio(hex, surface) : 0;
    const carries = carriesBrand(hex, brand);
    return { element, hex, on: surface, ratio, target, carries, ok: carries && ratio >= target };
  });
  return { brand, entries, visible: entries.some((e) => e.ok) };
}

/** The brand's hue turned by `by` (0..1 of the wheel), at a set lightness. */
function rotated(hex, by, l, s) {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex({ h: (hsl.h + by) % 1, s: Math.min(hsl.s, s), l });
}

/** Attach the measurements to a finished palette. */
function finish(c) {
  return {
    ...c,
    // Nothing on this page qualifies as large-scale text by WCAG's definition
    // except the name, so all of it is held to the body-text bar rather than
    // 3:1. The hover pairings take the worse of the gradient's two stops.
    ratios: {
      pageInkOnPage: contrastRatio(c.pageInk, c.pageBg),
      pageMutedOnPage: contrastRatio(c.pageMuted, c.pageBg),
      primaryFgOnPrimary: contrastRatio(c.primaryFg, c.primaryBg),
      cardInkOnCard: contrastRatio(c.cardInk, c.cardBg),
      cardAccentOnCard: contrastRatio(c.cardAccent, c.cardBg),
      cardInkOnHover: Math.min(
        contrastRatio(c.cardInk, c.hoverFrom),
        contrastRatio(c.cardInk, c.hoverTo),
      ),
      cardAccentOnHover: Math.min(
        contrastRatio(c.cardAccent, c.hoverFrom),
        contrastRatio(c.cardAccent, c.hoverTo),
      ),
    },
    nonTextRatios: {
      cardBorderOnPage: contrastRatio(c.cardBorder, c.pageBg),
      hoverBorderOnPage: contrastRatio(c.hoverBorder, c.pageBg),
      ringOnPage: contrastRatio(c.ring, c.pageBg),
    },
    visibleRatios: {
      primaryBgOnPage: contrastRatio(c.primaryBg, c.pageBg),
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
    ...Object.entries(theme?.visibleRatios || {}).map(([name, ratio]) => ({
      name,
      ratio,
      target: VISIBLE_TARGET,
      ok: ratio >= VISIBLE_TARGET,
    })),
  ];
  return { entries, ok: entries.every((e) => e.ok) };
}

// ── The CSS the page emits ──────────────────────────────────────────────────

/** Token name → palette field. The view reads var(--lp-<name>). */
export const TOKEN_FIELDS = {
  page: "pageBg",
  ink: "pageInk",
  muted: "pageMuted",
  primary: "primaryBg",
  "on-primary": "primaryFg",
  card: "cardBg",
  "card-ink": "cardInk",
  accent: "cardAccent",
  border: "cardBorder",
  "border-hover": "hoverBorder",
  ring: "ring",
};

const HEX = /^#[0-9a-f]{6}$/i;

/**
 * The custom-property block for one company, both schemes.
 *
 * Every value is a hex this module computed, but it is still checked before
 * it is written into a <style> — a theme function that ever returned a string
 * with a brace in it would otherwise be a CSS injection on a public page. A
 * value that fails the check falls to the scheme's ink or page colour, the
 * two that are always well-formed, rather than to an empty declaration.
 *
 * @param schemes   from linkPageSchemes()
 * @param selector  the element the tokens live on
 * @param scheme    "auto" (default) follows prefers-color-scheme, which is
 *                  what the public page does. "light" or "dark" emits that
 *                  scheme alone, with no media query — for the settings
 *                  preview, where the contractor wants to SEE the dark page
 *                  on a light laptop. The public route never passes this.
 */
export function linkPageTokenCss(schemes, selector = ".lp", { scheme = "auto" } = {}) {
  const block = (c, scheme) => {
    const safe = (v, fallback) => (HEX.test(String(v)) ? v : fallback);
    const decls = Object.entries(TOKEN_FIELDS).map(
      ([token, field]) => `--lp-${token}:${safe(c[field], scheme === "dark" ? c.pageInk : c.pageBg)}`,
    );
    decls.push(
      `--lp-hover:linear-gradient(270deg,${safe(c.hoverFrom, c.pageBg)} 0%,${safe(c.hoverTo, c.pageBg)} 100%)`,
    );
    // app/layout.js pins color-scheme:light on <html> for client-facing
    // routes. This page opts its own subtree back out so scrollbars and the
    // <img> placeholder follow the scheme the media query chose.
    decls.push(`color-scheme:${scheme}`);
    return `${selector}{${decls.join(";")}}`;
  };
  if (scheme === "light") return block(schemes.light, "light");
  if (scheme === "dark") return block(schemes.dark, "dark");
  return (
    block(schemes.light, "light") +
    `@media (prefers-color-scheme:dark){${block(schemes.dark, "dark")}}`
  );
}
