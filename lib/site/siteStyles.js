// lib/site/siteStyles.js
//
// Design systems for a generated site. This is half of what makes two
// companies' sites LOOK different rather than just read differently; the other
// half is composition (which sections, in what order) and lives in
// lib/site/composition.js.
//
// ── Why this got much bigger ────────────────────────────────────────────────
//
// The first version varied five tokens: two heading sizes, a corner radius, a
// section padding and a serif flag. That is not enough to tell two sites apart.
// Every generated page still read as the same template with different words,
// which is exactly what was reported.
//
// A design system that actually reads as different has to move the things the
// eye picks up first:
//
//   • how the header behaves (transparent over the hero vs a solid bar)
//   • whether the accent colour is a whole section background or just a detail
//   • the shape language (square, soft, pill)
//   • the type pairing and how hard the scale jumps between h1 and body
//   • section rhythm — tight and dense, or airy with a lot of nothing
//   • whether section headings are centred or ranged left
//   • the divider language (hairline rules, tinted bands, nothing at all)
//
// So each style below is a real design opinion applied consistently, not a
// nudge to two numbers.
//
// ── Still a closed set, still no model-authored CSS ─────────────────────────
//
// Every value here was written by hand and checked to hold up at 375px with a
// hostile brand colour. The generator picks a KEY; it never emits a style rule.
// That's what keeps "the AI designed it" from meaning "the AI can ship an
// unreadable page". Colours always derive from the company's own brand hex
// through lib/documents/theme.js, which measures contrast rather than assuming.

export const SITE_STYLES = {
  modern: {
    label: "Modern",
    hint: "Clean, spacious, confident. The safe premium default.",
    // Type
    h1: "text-4xl sm:text-6xl font-extrabold tracking-[-0.03em] leading-[1.05]",
    h2: "text-3xl sm:text-4xl font-extrabold tracking-[-0.02em]",
    h3: "text-lg font-bold",
    body: "text-base sm:text-lg leading-relaxed",
    eyebrow: "text-[11px] font-bold uppercase tracking-[0.18em]",
    serif: false,
    // Rhythm
    sectionPad: "py-16 sm:py-24",
    heroPad: "py-24 sm:py-32",
    gap: "gap-6",
    // Shape
    radius: "rounded-2xl",
    radiusSm: "rounded-xl",
    pill: "rounded-full",
    // Composition feel
    headingAlign: "left",
    alternate: true,
    // How loudly the brand colour is used: "detail" = accents only,
    // "band" = whole sections filled, "wash" = tinted backgrounds.
    accentUse: "band",
    header: "solid",
    divider: "none",
    imageTreatment: "rounded",
  },

  bold: {
    label: "Bold",
    hint: "Loud and industrial. Oversized type, hard edges, filled bands.",
    h1: "text-5xl sm:text-8xl font-black tracking-[-0.045em] uppercase leading-[0.92]",
    h2: "text-4xl sm:text-6xl font-black tracking-[-0.03em] uppercase leading-[0.95]",
    h3: "text-xl font-black uppercase tracking-tight",
    body: "text-base sm:text-lg leading-snug font-medium",
    eyebrow: "text-xs font-black uppercase tracking-[0.24em]",
    serif: false,
    sectionPad: "py-20 sm:py-32",
    heroPad: "py-28 sm:py-44",
    gap: "gap-4",
    radius: "rounded-none",
    radiusSm: "rounded-none",
    pill: "rounded-none",
    headingAlign: "left",
    alternate: true,
    accentUse: "band",
    // Transparent over the hero image — the loud styles want the photo to run
    // to the top of the viewport.
    header: "overlay",
    divider: "thick",
    imageTreatment: "square",
  },

  minimal: {
    label: "Minimal",
    hint: "Quiet and editorial. Lots of air, light weights, hairline rules.",
    h1: "text-3xl sm:text-5xl font-medium tracking-[-0.02em] leading-[1.1]",
    h2: "text-2xl sm:text-3xl font-medium tracking-[-0.01em]",
    h3: "text-base font-semibold",
    body: "text-base leading-loose",
    eyebrow: "text-[11px] font-medium uppercase tracking-[0.2em]",
    serif: false,
    sectionPad: "py-24 sm:py-36",
    heroPad: "py-28 sm:py-40",
    gap: "gap-10",
    radius: "rounded-none",
    radiusSm: "rounded-none",
    pill: "rounded-full",
    headingAlign: "left",
    // No alternating bands at all: the whole point is one continuous quiet page
    // separated by rules, not by colour changes.
    alternate: false,
    accentUse: "detail",
    header: "solid",
    divider: "hairline",
    imageTreatment: "square",
  },

  classic: {
    label: "Classic",
    hint: "Established and traditional. Serif headings, centred, restrained.",
    h1: "text-4xl sm:text-6xl font-bold tracking-[-0.01em] leading-[1.08]",
    h2: "text-3xl sm:text-4xl font-bold",
    h3: "text-lg font-bold",
    body: "text-base sm:text-lg leading-relaxed",
    eyebrow: "text-[11px] font-semibold uppercase tracking-[0.22em]",
    serif: true,
    sectionPad: "py-16 sm:py-24",
    heroPad: "py-24 sm:py-32",
    gap: "gap-8",
    radius: "rounded-md",
    radiusSm: "rounded",
    pill: "rounded-md",
    // Centred headings are the single strongest signal of a traditional firm.
    headingAlign: "center",
    alternate: true,
    accentUse: "wash",
    header: "solid",
    divider: "hairline",
    imageTreatment: "square",
  },

  warm: {
    label: "Warm",
    hint: "Friendly and rounded. Soft shapes, generous spacing, tinted washes.",
    h1: "text-4xl sm:text-6xl font-extrabold tracking-[-0.02em] leading-[1.06]",
    h2: "text-3xl sm:text-4xl font-extrabold tracking-[-0.01em]",
    h3: "text-lg font-bold",
    body: "text-base sm:text-lg leading-relaxed",
    eyebrow: "text-[11px] font-bold uppercase tracking-[0.16em]",
    serif: false,
    sectionPad: "py-16 sm:py-24",
    heroPad: "py-24 sm:py-32",
    gap: "gap-6",
    radius: "rounded-3xl",
    radiusSm: "rounded-2xl",
    pill: "rounded-full",
    headingAlign: "center",
    alternate: true,
    accentUse: "wash",
    header: "solid",
    divider: "none",
    imageTreatment: "rounded",
  },

  // ── Two additions, because five styles all landed in the same register ────
  //
  // Every original style was some flavour of "clean sans-serif marketing page".
  // These two are deliberately different KINDS of website, which is what makes
  // a regenerate feel like a redesign rather than a reword.

  editorial: {
    label: "Editorial",
    hint: "Magazine-like. Serif display type, big photography, asymmetric.",
    h1: "text-4xl sm:text-7xl font-bold tracking-[-0.025em] leading-[0.98]",
    h2: "text-3xl sm:text-5xl font-bold tracking-[-0.015em]",
    h3: "text-xl font-semibold",
    body: "text-lg leading-loose",
    eyebrow: "text-[11px] font-semibold uppercase tracking-[0.28em]",
    serif: true,
    sectionPad: "py-20 sm:py-32",
    heroPad: "py-24 sm:py-40",
    gap: "gap-8",
    radius: "rounded-none",
    radiusSm: "rounded-none",
    pill: "rounded-full",
    headingAlign: "left",
    alternate: false,
    accentUse: "detail",
    header: "overlay",
    divider: "hairline",
    imageTreatment: "square",
  },

  technical: {
    label: "Technical",
    hint: "Precise and utilitarian. Dense grid, mono labels, boxed sections.",
    h1: "text-3xl sm:text-5xl font-bold tracking-[-0.02em] leading-[1.08]",
    h2: "text-2xl sm:text-4xl font-bold tracking-[-0.01em]",
    h3: "text-base font-bold",
    body: "text-[15px] sm:text-base leading-relaxed",
    // The one place a monospace label earns its keep: it reads as spec-sheet
    // precision, which is what a company describing itself as meticulous wants.
    eyebrow: "text-[10px] font-bold uppercase tracking-[0.3em] font-mono",
    serif: false,
    sectionPad: "py-14 sm:py-20",
    heroPad: "py-20 sm:py-28",
    gap: "gap-3",
    radius: "rounded-sm",
    radiusSm: "rounded-sm",
    pill: "rounded-sm",
    headingAlign: "left",
    alternate: true,
    accentUse: "detail",
    header: "solid",
    divider: "thick",
    imageTreatment: "square",
  },
};

export const DEFAULT_SITE_STYLE = "modern";
export const SITE_STYLE_KEYS = Object.keys(SITE_STYLES);

export function resolveSiteStyle(key) {
  return SITE_STYLES[key] || SITE_STYLES[DEFAULT_SITE_STYLE];
}

/** For the builder UI's style picker. */
export const SITE_STYLE_LIST = SITE_STYLE_KEYS.map((key) => ({
  key,
  label: SITE_STYLES[key].label,
  hint: SITE_STYLES[key].hint,
}));
