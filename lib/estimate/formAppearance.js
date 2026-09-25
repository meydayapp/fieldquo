// lib/estimate/formAppearance.js
//
// How the public request / instant-estimate form LOOKS, so it can sit inside
// the company's own website without reading as somebody else's widget.
//
// ── Why presets and not free CSS ───────────────────────────────────────────
//
// The owner (2026-09-24): "what if they want to change the look and feel so
// that it helps them match better their website.. can we make some
// variations in the look and feel of the text boxes?" — pointing at four real
// sites (docs/research/form-look-references.md). Between them they cover
// outlined inputs on a warm page with gold pill-ish buttons (TrueFinish),
// square ghost buttons and filled grey inputs under a Cinzel headline (Ugly
// Duckling), Wix's uppercase-tracked sans and square outlined CTAs
// (Jamieson), and a serif-display WordPress theme with 4px corners
// (your-painter). Six small choices reach all four:
//
//   fieldStyle   outlined | underlined | filled | pill
//   radius       none | small | medium | full
//   fontPreset   system | humanist | classic_serif | display_serif | geometric
//   density      comfortable | compact
//   buttonStyle  solid | outline | pill
//   surface      light | dark | brand-wash
//
// Free CSS was rejected because a stranger on a phone in a driveway is the
// person who pays for a contractor's typo, and because the form is a
// white-label surface whose legibility we promise (AGENTS.md: contrast is
// measured, not assumed). Every colour below still derives from the one brand
// hex through lib/documents/theme.js and is measured against the surface it
// lands on; a preset that cannot reach 4.5:1 for some text is reported as a
// failure, and the settings route refuses to save it.
//
// ── The default is exactly today ───────────────────────────────────────────
//
// DEFAULT_FORM_APPEARANCE is what the two flows rendered before this file
// existed. `isDefaultAppearance` is the switch the wrapper component reads:
// on the default it renders its children with NO wrapper, no stylesheet and
// no font link, so a company that never opens the setting sees a byte-for-
// byte identical form. The presets only ever ADD a scoped stylesheet.
//
// Pure apart from the colour maths; no React, no DOM.

import {
  contrastRatio,
  ensureContrast,
  readableForeground,
  adjustLightness,
  tint,
  isValidHex,
} from "@/lib/brand/colour";
import { documentTheme, fillPair, accentIsWashedOut, FALLBACK_BRAND } from "@/lib/documents/theme";

export const FIELD_STYLES = ["outlined", "underlined", "filled", "pill"];
export const RADII = ["none", "small", "medium", "full"];
export const DENSITIES = ["comfortable", "compact"];
export const BUTTON_STYLES = ["solid", "outline", "pill"];
export const SURFACES = ["light", "dark", "brand-wash"];

// Google Fonts only inside the public form and the embed — the app shell is
// untouched. `google` is the css2 family query; null means "whatever the
// page already uses", which is the default and today's look.
export const FONT_PRESETS = {
  system: { heading: null, body: null, google: null },
  humanist: {
    heading: `"Manrope", ui-sans-serif, system-ui, sans-serif`,
    body: `"Manrope", ui-sans-serif, system-ui, sans-serif`,
    google: "family=Manrope:wght@400;500;600;700",
  },
  classic_serif: {
    heading: `"Lora", Georgia, "Times New Roman", serif`,
    body: `"Lora", Georgia, "Times New Roman", serif`,
    google: "family=Lora:wght@400;500;600;700",
  },
  display_serif: {
    heading: `"Cormorant Garamond", Georgia, serif`,
    body: `"Manrope", ui-sans-serif, system-ui, sans-serif`,
    google: "family=Cormorant+Garamond:wght@500;600;700&family=Manrope:wght@400;500;600",
  },
  geometric: {
    heading: `"Poppins", ui-sans-serif, system-ui, sans-serif`,
    body: `"Poppins", ui-sans-serif, system-ui, sans-serif`,
    google: "family=Poppins:wght@400;500;600",
  },
};
export const FONT_PRESET_KEYS = Object.keys(FONT_PRESETS);

export const DEFAULT_FORM_APPEARANCE = Object.freeze({
  fieldStyle: "outlined",
  radius: "medium",
  fontPreset: "system",
  density: "comfortable",
  buttonStyle: "solid",
  surface: "light",
});

const CHOICES = {
  fieldStyle: FIELD_STYLES,
  radius: RADII,
  fontPreset: FONT_PRESET_KEYS,
  density: DENSITIES,
  buttonStyle: BUTTON_STYLES,
  surface: SURFACES,
};

/**
 * A saved (or posted) appearance, cleaned: unknown keys dropped and named,
 * a value outside its set replaced by the default and named. Never throws.
 *
 * @returns {{ appearance: object, problems: Array<{key:string, problem:string}> }}
 */
export function normaliseFormAppearance(raw) {
  const appearance = { ...DEFAULT_FORM_APPEARANCE };
  const problems = [];
  if (raw === undefined || raw === null) return { appearance, problems };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    problems.push({ key: "appearance", problem: "not_an_object" });
    return { appearance, problems };
  }
  for (const [key, value] of Object.entries(raw)) {
    const set = CHOICES[key];
    if (!set) {
      problems.push({ key, problem: "unknown_key" });
      continue;
    }
    if (!set.includes(value)) {
      problems.push({ key, problem: "unknown_value" });
      continue;
    }
    appearance[key] = value;
  }
  return { appearance, problems };
}

/** True when the (normalised) appearance is the one the form always had. */
export function isDefaultAppearance(appearance) {
  const a = normaliseFormAppearance(appearance).appearance;
  return Object.keys(DEFAULT_FORM_APPEARANCE).every((k) => a[k] === DEFAULT_FORM_APPEARANCE[k]);
}

/** The Google Fonts stylesheet for a preset, or null for the system stack. */
export function fontStylesheetUrl(fontPreset) {
  const preset = FONT_PRESETS[fontPreset];
  if (!preset?.google) return null;
  return `https://fonts.googleapis.com/css2?${preset.google}&display=swap`;
}

const norm = (hex) => (isValidHex(hex) ? (String(hex).startsWith("#") ? hex : `#${hex}`) : FALLBACK_BRAND);

// ── The palette ────────────────────────────────────────────────────────────

/**
 * Every colour the styled form paints, derived from the brand hex and the
 * chosen surface, each foreground measured against the background it will
 * actually sit on. `checks` lists every pair with its ratio; `failures` is
 * the subset of TEXT pairs under 4.5:1 — empty for every brand the product
 * has seen, kept because the settings screen must be able to say so rather
 * than assume it.
 */
export function formPalette(brandColor, appearance) {
  const a = normaliseFormAppearance(appearance).appearance;
  const brand = norm(brandColor);
  const theme = documentTheme({ brandColor: brand });
  const washedOut = accentIsWashedOut(theme);
  const dark = a.surface === "dark";

  // Surfaces. Light is the app's own page-and-card pair; brand-wash tints
  // the page with the brand (a near-white brand gets the neutral chip
  // instead, or the tint is invisible); dark is a deep low-saturation
  // version of the brand hue so a navy company gets a navy-black, a gold
  // company a warm one, rather than everyone getting the same #111.
  let page;
  let card;
  let border;
  let muted;
  if (dark) {
    page = tint(brand, 0.08, 0.14);
    card = tint(brand, 0.12, 0.12);
    border = tint(brand, 0.26, 0.12);
    muted = tint(brand, 0.17, 0.12);
  } else if (a.surface === "brand-wash") {
    page = washedOut ? "#f3f4f6" : theme.accentWash;
    card = "#ffffff";
    border = washedOut ? "#d7dce3" : tint(brand, 0.86, 0.14);
    muted = washedOut ? "#eef0f3" : theme.accentWashStrong;
  } else {
    page = "#f4f7fa";
    card = "#ffffff";
    border = "#d7e2ef";
    muted = "#eef3f9";
  }

  const ink = dark ? "#f5f5f4" : "#0b1a2e";
  // Measured against the HARDER of the two surfaces: on a light look the page
  // is a shade darker than the card, on a dark look the card is a shade
  // lighter than the page, and a colour that clears the harder one clears
  // both. Measured against the card alone, plain red (#dc2626) sat at
  // 4.49:1 on the page — under the bar by a hundredth, on every site.
  const harder = dark ? card : page;
  const inkMuted = dark
    ? ensureContrast(tint(brand, 0.7, 0.1), harder, 4.5)
    : ensureContrast("#4d6076", harder, 4.5);
  const inkFaint = ensureContrast(dark ? tint(brand, 0.55, 0.1) : "#9099a6", card, 3);
  // The brand as TEXT on the card: the estimate figure, the outline button's
  // label, the selection ring.
  const accentText = ensureContrast(brand, harder, 4.5);
  // A line that can be seen: the underline under an underlined field, the
  // hairline under a filled one. Borders are decoration at 1.3:1 on the
  // default look; a line that IS the field needs 3:1 (WCAG 1.4.11).
  const line = ensureContrast(border, card, 3);

  // Inputs.
  let inputBg;
  if (a.fieldStyle === "filled") {
    inputBg = dark ? muted : washedOut ? "#f1f3f6" : tint(brand, 0.95, 0.08);
  } else if (a.fieldStyle === "underlined") {
    inputBg = card; // transparent over the card; measured against it
  } else {
    inputBg = card;
  }
  const inputInk = ensureContrast(ink, inputBg, 4.5);
  const placeholder = ensureContrast(inkMuted, inputBg, 4.5);
  const inputBorder = a.fieldStyle === "underlined" || a.fieldStyle === "filled" ? line : border;

  // The primary button. fillPair measures the label on the fill; on a dark
  // surface the fill also has to stand off the CARD (3:1, a shape, not text)
  // or a navy button on a navy-black card is a label floating in space. The
  // fill is walked lighter until it does, re-measuring the label each step.
  let button;
  if (a.buttonStyle === "outline") {
    button = { bg: "transparent", fg: accentText, border: accentText, borderWidth: 2, edge: contrastRatio(accentText, card) };
  } else {
    let { bg, fg } = fillPair(theme);
    if (dark) {
      for (let i = 0; i < 14 && contrastRatio(bg, card) < 3; i++) {
        bg = adjustLightness(bg, 0.05);
        fg = readableForeground(bg);
      }
      if (contrastRatio(bg, card) < 3 || contrastRatio(fg, bg) < 4.5) {
        bg = ink;
        fg = page;
      }
    }
    button = { bg, fg, border: dark ? bg : theme.accentText, borderWidth: 1, edge: contrastRatio(bg, card) };
  }

  // The selected trade chip is the button's pair; every other selection is
  // a ring in accentText, as today.
  const chip = a.buttonStyle === "outline"
    ? { bg: fillPair(theme).bg, fg: fillPair(theme).fg, border: accentText }
    : { bg: button.bg, fg: button.fg, border: button.border };
  if (dark) {
    // Same edge rule as the button — the chip is the same shape.
    chip.bg = button.bg;
    chip.fg = button.fg;
  }

  // Measured, listed, and the text pairs are what a save is refused on.
  // `key` is what the settings screen translates; `label` is the English
  // the route's refusal and the check script print.
  const pair = (key, label, fg, bg, need) => ({ key, label, fg, bg, ratio: Math.round(contrastRatio(fg, bg) * 100) / 100, need, ok: contrastRatio(fg, bg) >= need });
  const checks = [
    pair("text_card", "text on card", ink, card, 4.5),
    pair("text_page", "text on page", ink, page, 4.5),
    pair("muted_card", "muted text on card", inkMuted, card, 4.5),
    pair("muted_page", "muted text on page", inkMuted, page, 4.5),
    pair("brand_card", "brand text on card", accentText, card, 4.5),
    pair("brand_page", "brand text on page", accentText, page, 4.5),
    pair("input_text", "input text", inputInk, inputBg, 4.5),
    pair("placeholder", "placeholder", placeholder, inputBg, 4.5),
    pair("button_label", "button label", button.fg, button.bg === "transparent" ? card : button.bg, 4.5),
    pair("chip_label", "selected chip label", chip.fg, chip.bg, 4.5),
    pair("field_line", "field line on card", inputBorder, card, a.fieldStyle === "outlined" || a.fieldStyle === "pill" ? 1.2 : 3),
    // The edge is whichever of the fill and the border stands off the card
    // more — on a light look the fill can be pale (silver, gold) and the
    // accentText border is what draws the shape, exactly as the default look
    // does it.
    pair("button_edge", "button edge on card", contrastRatio(button.bg === "transparent" ? button.border : button.bg, card) >= contrastRatio(button.border, card) ? (button.bg === "transparent" ? button.border : button.bg) : button.border, card, 3),
  ];
  const failures = checks.filter((c) => !c.ok && c.need >= 4.5);
  const warnings = checks.filter((c) => !c.ok && c.need < 4.5);

  return {
    appearance: a,
    brand,
    dark,
    page,
    card,
    border,
    muted,
    ink,
    inkMuted,
    inkFaint,
    accentText,
    line,
    inputBg,
    inputInk,
    inputBorder,
    placeholder,
    button,
    chip,
    checks,
    failures,
    warnings,
  };
}

// ── CSS ────────────────────────────────────────────────────────────────────

const RADIUS = {
  // field, control (buttons, chips), card
  none: ["0px", "0px", "0px"],
  small: ["4px", "4px", "8px"],
  // Tailwind's own tokens — the default look, untouched.
  medium: ["var(--radius-lg)", "var(--radius-lg)", "var(--radius-2xl)"],
  full: ["9999px", "9999px", "24px"],
};

/**
 * The custom properties the wrapper sets. The `--background` … `--ring`
 * group are Tailwind's theme variables: globals.css declares them with
 * `@theme inline`, so `bg-card`, `text-foreground`, `border-border` and the
 * rest compile to `var(--card)` etc. and follow these on every element
 * inside the wrapper without a class being touched. The `--fq-*` group is
 * read by FORM_LOOK_CSS.
 */
export function formLookVars(palette) {
  const a = palette.appearance;
  const font = FONT_PRESETS[a.fontPreset] || FONT_PRESETS.system;
  const [field, control, card] = RADIUS[a.radius] || RADIUS.medium;
  const compact = a.density === "compact";
  return {
    "--background": palette.page,
    "--card": palette.card,
    "--card-foreground": palette.ink,
    "--popover": palette.card,
    "--popover-foreground": palette.ink,
    "--foreground": palette.ink,
    "--muted": palette.muted,
    "--muted-foreground": palette.inkMuted,
    "--border": palette.border,
    "--input": palette.border,
    "--ring": palette.accentText,
    "--fq-font-body": font.body || "inherit",
    "--fq-font-heading": font.heading || "inherit",
    "--fq-input-bg": palette.inputBg,
    "--fq-input-ink": palette.inputInk,
    "--fq-input-border": palette.inputBorder,
    "--fq-placeholder": palette.placeholder,
    "--fq-accent-text": palette.accentText,
    "--fq-field-radius": field,
    "--fq-control-radius": control,
    "--fq-card-radius": card,
    "--fq-input-py": compact ? "0.4rem" : "0.6rem",
    "--fq-input-px": a.fieldStyle === "pill" ? "1.1rem" : "0.75rem",
  };
}

/**
 * The scoped stylesheet. One static string, rendered by the wrapper only
 * when a non-default look is active. Selectors are scoped to `.fq-look` and
 * keyed on data attributes, so nothing here can reach the app shell or a
 * form that kept the default.
 *
 * Un-layered author rules beat Tailwind's `@layer utilities` whatever their
 * specificity, which is why no `!important` appears.
 */
export const FORM_LOOK_CSS = `
.fq-look{font-family:var(--fq-font-body);color:var(--foreground);background-color:var(--background)}
.fq-look :is(h1,h2,h3){font-family:var(--fq-font-heading)}
.fq-look[data-font="display_serif"] :is(h1,h2,h3){font-size:1.12em;letter-spacing:0.01em}
.fq-look :is(input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),select,textarea){background-color:var(--fq-input-bg);color:var(--fq-input-ink);border:1px solid var(--fq-input-border);border-radius:var(--fq-field-radius);padding:var(--fq-input-py) var(--fq-input-px);font-family:var(--fq-font-body)}
.fq-look ::placeholder{color:var(--fq-placeholder);opacity:1}
.fq-look :is(input,select,textarea):focus-visible{outline:2px solid var(--fq-accent-text);outline-offset:1px}
.fq-look[data-field="underlined"] :is(input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),select,textarea){border-width:0 0 2px 0;border-radius:0;background-color:transparent;padding-left:0;padding-right:0}
.fq-look[data-field="filled"] :is(input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),select,textarea){border-width:0 0 1px 0;border-bottom-left-radius:0;border-bottom-right-radius:0}
.fq-look[data-field="pill"] :is(input:not([type="checkbox"]):not([type="radio"]):not([type="file"]),select){border-radius:9999px}
.fq-look[data-field="pill"] textarea{border-radius:var(--fq-card-radius)}
.fq-look button,.fq-look a[href^="tel:"],.fq-look a[href^="/quote/"]{font-family:var(--fq-font-body)}
.fq-look button{border-radius:var(--fq-control-radius)}
.fq-look button.rounded-full,.fq-look[data-button="pill"] button{border-radius:9999px}
.fq-look[data-radius="none"] button.rounded-full{border-radius:0}
.fq-look .rounded-2xl,.fq-look .rounded-xl{border-radius:var(--fq-card-radius)}
.fq-look .rounded-lg{border-radius:var(--fq-control-radius)}
.fq-look .bg-white{background-color:var(--card)}
.fq-look .border-black\\/5,.fq-look .border-black\\/10,.fq-look .border-black\\/15{border-color:var(--border)}
.fq-look[data-density="compact"] .space-y-6>:not(:last-child){margin-block-end:0.9rem}
.fq-look[data-density="compact"] .space-y-3>:not(:last-child){margin-block-end:0.5rem}
.fq-look[data-density="compact"] .py-8{padding-block:1rem}
.fq-look[data-density="compact"] .mb-8{margin-bottom:1rem}
.fq-look[data-density="compact"] .gap-8{gap:1.25rem}
.fq-look[data-density="compact"] .p-5{padding:0.85rem}
.fq-look[data-density="compact"] .py-5{padding-block:0.85rem}
.fq-look[data-density="compact"] .py-6{padding-block:1rem}
`;

/**
 * lib/documents/theme.js's palette with this look's surfaces in it — for
 * the request-a-quote form, which paints from `theme.ink` and friends
 * inline (a dark surface would otherwise draw dark ink on a dark card).
 * On a light surface the theme is returned untouched.
 */
export function themeUnderLook(theme, palette) {
  if (!palette) return theme;
  // A light or brand-washed look changes the PAGE the card sits on and
  // nothing the card paints; the inks stay the document's own.
  if (!palette.dark) return { ...theme, page: palette.page };
  const wash = palette.muted;
  return {
    ...theme,
    paper: palette.card,
    page: palette.page,
    ink: palette.ink,
    inkMuted: palette.inkMuted,
    inkFaint: palette.inkFaint,
    border: palette.border,
    borderSoft: palette.border,
    accentText: palette.accentText,
    accentWash: wash,
    accentWashStrong: palette.border,
    accentRule: palette.accentText,
    inkOnWash: ensureContrast(palette.ink, wash, 4.5),
    inkMutedOnWash: ensureContrast(palette.inkMuted, wash, 4.5),
  };
}
