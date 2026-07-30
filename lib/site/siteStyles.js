// lib/site/siteStyles.js
//
// Design "styles" for a generated site. This is what makes two companies' sites
// LOOK different, not just read differently — the missing piece behind "there's
// only one template". Each style is a small set of visual knobs the renderer
// applies (type scale, weight, section rhythm, corner radius, serif vs sans,
// whether sections alternate a tinted background). Colours and logo still come
// from the company's brand — a style changes the FEEL, never the palette.
//
// A closed set, on purpose: every style was designed to hold up on a phone with
// any brand colour, so the AI (or the company) picking one can never produce a
// broken page. That's the trade for not letting a model emit raw CSS.

export const SITE_STYLES = {
  modern: {
    label: "Modern",
    hint: "Clean, spacious, confident. The safe premium default.",
    sectionPad: "py-16 sm:py-24",
    h1: "text-4xl sm:text-6xl font-extrabold tracking-[-0.03em]",
    h2: "text-3xl sm:text-4xl font-extrabold tracking-[-0.02em]",
    radius: "rounded-2xl",
    heroPad: "py-24 sm:py-32",
    serif: false,
    alternate: true,
  },
  bold: {
    label: "Bold",
    hint: "Big, loud, high-impact. Oversized headlines, hard edges.",
    sectionPad: "py-20 sm:py-32",
    h1: "text-5xl sm:text-7xl font-black tracking-[-0.04em] uppercase",
    h2: "text-4xl sm:text-5xl font-black tracking-[-0.03em]",
    radius: "rounded-none",
    heroPad: "py-28 sm:py-40",
    serif: false,
    alternate: true,
  },
  minimal: {
    label: "Minimal",
    hint: "Understated, lots of whitespace, light weights.",
    sectionPad: "py-20 sm:py-28",
    h1: "text-3xl sm:text-5xl font-medium tracking-[-0.02em]",
    h2: "text-2xl sm:text-3xl font-semibold tracking-[-0.01em]",
    radius: "rounded-xl",
    heroPad: "py-24 sm:py-32",
    serif: false,
    alternate: false,
  },
  classic: {
    label: "Classic",
    hint: "Traditional and trustworthy — serif headings, refined.",
    sectionPad: "py-16 sm:py-24",
    h1: "text-4xl sm:text-6xl font-bold tracking-[-0.01em]",
    h2: "text-3xl sm:text-4xl font-bold",
    radius: "rounded-lg",
    heroPad: "py-24 sm:py-32",
    serif: true,
    alternate: true,
  },
  warm: {
    label: "Warm",
    hint: "Friendly and rounded — softer corners, approachable.",
    sectionPad: "py-16 sm:py-24",
    h1: "text-4xl sm:text-6xl font-extrabold tracking-[-0.02em]",
    h2: "text-3xl sm:text-4xl font-extrabold tracking-[-0.01em]",
    radius: "rounded-3xl",
    heroPad: "py-24 sm:py-32",
    serif: false,
    alternate: true,
  },
};

export const DEFAULT_SITE_STYLE = "modern";
export const SITE_STYLE_KEYS = Object.keys(SITE_STYLES);

export function resolveSiteStyle(key) {
  return SITE_STYLES[key] || SITE_STYLES[DEFAULT_SITE_STYLE];
}
