// lib/brand/colour.js
//
// Colour maths for white-labelling.
//
// A company picks ONE colour in Settings → Branding, and the whole app chrome
// takes it: sidebar, buttons, active states. That only works if everything
// derived from it is legible, and a contractor is going to pick lime green,
// or pale grey, or black. So nothing here trusts the input to be reasonable —
// foregrounds are chosen by measured contrast, not by assuming dark text on
// light backgrounds.
//
// Everything is plain functions over hex strings so the same code runs in the
// browser, in a server component injecting CSS variables, and in the email
// renderer where CSS variables don't reach.

// ── conversions ─────────────────────────────────────────────────────────────

export function hexToRgb(hex) {
  const clean = String(hex || "").trim().replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function isValidHex(hex) {
  return /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(hex || "").trim());
}

// ── contrast, per WCAG 2.1 ──────────────────────────────────────────────────

function channelLuminance(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  return (
    0.2126 * channelLuminance(rgb.r) +
    0.7152 * channelLuminance(rgb.g) +
    0.0722 * channelLuminance(rgb.b)
  );
}

/** 1 (identical) to 21 (black on white). 4.5 is the floor for body text. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text colour for a given background, chosen by measurement.
 *
 * The naive version — "luminance > 0.5 ? black : white" — gets mid-tones
 * wrong, and mid-tones are exactly what brand colours are. #ff5a00 has a
 * luminance of about 0.32, which that rule would put white text on, at
 * 3.1:1. Comparing both candidates picks the one that actually wins.
 *
 * It returns the BETTER candidate, not necessarily a GOOD one. A mid-tone —
 * #808080 tops out at 4.43:1, the scope-card ochre at 4.39:1 — beats nothing.
 * Callers that must clear 4.5:1 should ask `hasAccessibleForeground` first, or
 * use `accessiblePair`, which moves the background instead of pretending. The
 * return type stays a bare hex string on purpose: dozens of call sites drop it
 * straight into `color:`.
 */
export function readableForeground(background, { light = "#ffffff", dark = "#0b1a2e" } = {}) {
  return contrastRatio(background, dark) >= contrastRatio(background, light)
    ? dark
    : light;
}

/**
 * The same choice, with the measurement it was made on.
 *
 * Exists because `readableForeground` throws away the number it computed, so a
 * caller had no way to tell "white, 12:1" from "white, 4.36:1" — and the second
 * is a bug the caller can usually fix by choosing a different background.
 */
export function foregroundContrast(
  background,
  { light = "#ffffff", dark = "#0b1a2e", target = 4.5 } = {},
) {
  const colour = readableForeground(background, { light, dark });
  const ratio = contrastRatio(background, colour);
  return { colour, ratio, meetsTarget: ratio >= target };
}

/** Can ANY foreground clear `target` on this background? */
export function hasAccessibleForeground(background, opts) {
  return foregroundContrast(background, opts).meetsTarget;
}

// ── HSL adjustment ──────────────────────────────────────────────────────────

export function hexToHsl(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

export function hslToHex({ h, s, l }) {
  if (s === 0) {
    const v = l * 255;
    return rgbToHex({ r: v, g: v, b: v });
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return rgbToHex({
    r: hue(h + 1 / 3) * 255,
    g: hue(h) * 255,
    b: hue(h - 1 / 3) * 255,
  });
}

/** amount is -1..1; negative darkens. */
export function adjustLightness(hex, amount) {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex({ ...hsl, l: Math.max(0, Math.min(1, hsl.l + amount)) });
}

/** Same hue, dialled towards or away from grey. */
export function adjustSaturation(hex, amount) {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex({ ...hsl, s: Math.max(0, Math.min(1, hsl.s + amount)) });
}

/**
 * A very low-saturation tint of a hue — the "paper" a brand sits on.
 *
 * Used for muted surfaces so a navy app has faintly blue greys and an orange
 * one faintly warm greys, rather than both having the same dead neutral.
 */
export function tint(hex, lightness, saturation = 0.12) {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex({ h: hsl.h, s: Math.min(hsl.s, saturation), l: lightness });
}

/**
 * Nudges a foreground until it clears a contrast target against its
 * background, walking away from the background's luminance in steps.
 *
 * Returns the best it managed rather than failing — a slightly-short colour
 * beats a blank screen, and the caller usually has no better option.
 */
export function ensureContrast(foreground, background, target = 4.5) {
  if (contrastRatio(foreground, background) >= target) return foreground;

  const bgIsDark = relativeLuminance(background) < 0.5;
  const step = bgIsDark ? 0.04 : -0.04;

  let candidate = foreground;
  for (let i = 0; i < 25; i++) {
    candidate = adjustLightness(candidate, step);
    if (contrastRatio(candidate, background) >= target) return candidate;
  }
  // Ran out of room — fall back to whichever pure end actually wins.
  return readableForeground(background);
}

/**
 * A background/foreground pair that actually clears `target`.
 *
 * When no foreground works — the mid-tone case `readableForeground` warns
 * about — the FILL moves rather than the text, in small steps away from the
 * chosen foreground, so a slightly deeper clay is still recognisably their
 * clay. Same trick and the same reasoning as `fillPair` in
 * lib/documents/theme.js, generalised here because a per-trade accent and a
 * per-funnel accent need it too and neither has a document theme to hand.
 *
 * Returns the best it managed even when nothing reaches the target, with the
 * achieved `ratio`, so a caller can log or degrade instead of believing it.
 */
export function accessiblePair(
  background,
  { light = "#ffffff", dark = "#0b1a2e", target = 4.5, steps = 14 } = {},
) {
  // Unlike readableForeground, this hands back a colour the caller PAINTS, so
  // the input can't be passed through unexamined. An invalid hex has a
  // luminance of 0, so it reads as black and wins white text — and the browser
  // then drops the unparseable background and renders white on whatever is
  // underneath. Ink is the honest answer, the same one fillPair lands on.
  if (!isValidHex(background)) {
    return { bg: dark, fg: light, ratio: contrastRatio(dark, light), adjusted: true };
  }
  const first = foregroundContrast(background, { light, dark, target });
  if (first.meetsTarget) {
    return { bg: background, fg: first.colour, ratio: first.ratio, adjusted: false };
  }

  // Step AWAY from the foreground. A light foreground wants a darker fill and
  // vice versa; getting this backwards walks the fill towards the text and
  // never converges.
  const fgIsLight =
    contrastRatio(first.colour, "#000000") > contrastRatio(first.colour, "#ffffff");

  let bg = background;
  let best = { bg: background, fg: first.colour, ratio: first.ratio, adjusted: false };
  for (let i = 0; i < steps; i++) {
    bg = adjustLightness(bg, fgIsLight ? -0.04 : 0.04);
    const ratio = contrastRatio(bg, first.colour);
    if (ratio > best.ratio) best = { bg, fg: first.colour, ratio, adjusted: true };
    if (ratio >= target) return { bg, fg: first.colour, ratio, adjusted: true };
  }
  return best;
}

/**
 * Builds the full set of theme tokens from one seed colour.
 *
 * This is what makes "full white-label" safe. The company supplies a brand
 * colour; every surface, border and text colour that touches it is computed
 * from measured contrast rather than assumed.
 *
 * @param seed      the company's brand hex
 * @param opts.dark produce the dark-theme variant
 * @param opts.accent optional second brand colour; defaults to a derived
 *                    complement so a company that sets only one still gets
 *                    somewhere for highlights to live.
 */
export function deriveBrandTokens(seed, { dark = false, accent } = {}) {
  const brand = isValidHex(seed) ? (seed.startsWith("#") ? seed : `#${seed}`) : "#06356b";
  const hsl = hexToHsl(brand);

  // On dark backgrounds a mid-tone brand goes muddy; lift it so it keeps the
  // same hue while staying legible.
  const primary = dark && hsl.l < 0.55 ? adjustLightness(brand, 0.18) : brand;

  const secondary =
    accent && isValidHex(accent)
      ? accent.startsWith("#") ? accent : `#${accent}`
      // No second colour set: rotate 30° and saturate. Close enough to feel
      // related, far enough to read as a different thing.
      : hslToHex({ h: (hsl.h + 0.085) % 1, s: Math.min(1, hsl.s + 0.25), l: 0.5 });

  const background = dark ? tint(brand, 0.06, 0.16) : tint(brand, 0.985, 0.06);
  const card       = dark ? tint(brand, 0.11, 0.14) : "#ffffff";
  const muted      = dark ? tint(brand, 0.16, 0.12) : tint(brand, 0.96, 0.08);
  const border     = dark ? tint(brand, 0.22, 0.12) : tint(brand, 0.90, 0.10);
  const foreground = dark ? tint(brand, 0.95, 0.05) : tint(brand, 0.13, 0.25);

  return {
    brand,
    primary,
    primaryForeground: readableForeground(primary),
    secondary,
    secondaryForeground: readableForeground(secondary),
    background,
    foreground,
    card,
    cardForeground: foreground,
    muted,
    mutedForeground: ensureContrast(
      dark ? tint(brand, 0.72, 0.10) : tint(brand, 0.42, 0.14),
      muted,
      4.5,
    ),
    border,
    ring: primary,
    // The chrome slab: sidebar and primary buttons. In a white-label this IS
    // the company's colour, with a foreground picked to survive it.
    inverted: dark ? adjustLightness(brand, 0.12) : brand,
    invertedForeground: readableForeground(dark ? adjustLightness(brand, 0.12) : brand),
  };
}

/** Serialises tokens into a CSS custom-property block for injection. */
export function tokensToCss(tokens, selector = ":root") {
  const map = {
    "--background": tokens.background,
    "--foreground": tokens.foreground,
    "--card": tokens.card,
    "--card-foreground": tokens.cardForeground,
    "--popover": tokens.card,
    "--popover-foreground": tokens.cardForeground,
    "--primary": tokens.primary,
    "--primary-foreground": tokens.primaryForeground,
    // shadcn's --secondary is a NEUTRAL SURFACE (secondary buttons), not
    // "the brand's second colour". Mapping the accent onto it would turn every
    // secondary button orange — louder than any of them are meant to be. The
    // accent gets its own token instead.
    "--secondary": tokens.muted,
    "--secondary-foreground": tokens.foreground,
    "--brand-accent": tokens.secondary,
    "--brand-accent-foreground": tokens.secondaryForeground,
    "--muted": tokens.muted,
    "--muted-foreground": tokens.mutedForeground,
    "--accent": tokens.muted,
    "--accent-foreground": tokens.foreground,
    "--border": tokens.border,
    "--input": tokens.border,
    "--ring": tokens.ring,
    "--inverted": tokens.inverted,
    "--inverted-foreground": tokens.invertedForeground,
    "--sidebar": tokens.inverted,
    "--sidebar-foreground": tokens.invertedForeground,
    "--sidebar-primary": tokens.secondary,
    "--sidebar-primary-foreground": tokens.secondaryForeground,
    "--sidebar-accent": tokens.muted,
    "--sidebar-accent-foreground": tokens.foreground,
    "--sidebar-border": tokens.border,
    "--sidebar-ring": tokens.ring,
  };
  const body = Object.entries(map)
    .map(([k, v]) => `${k}:${v};`)
    .join("");
  return `${selector}{${body}}`;
}
