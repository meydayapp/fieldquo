// lib/site/styleLayout.js
//
// Per-template STRUCTURE — the hero layout and the services layout each template
// leads with. This is the piece that was missing, and the reason three
// "different templates" rendered as the same page in different fonts: the style
// tokens changed type and button shape, but every template still emitted the
// SAME hero variant and the SAME service grid. A template has to change the
// ARRANGEMENT, not just the typeface, to read as a different website.
//
// The renderer already knows how to draw each of these variants (see the Hero
// and Services components in SiteBlocks.js); this just decides WHICH one a given
// template uses, so the choice follows the template instead of being fixed.

// hero:     one of centered | split | banner | overlay | sidebyside | minimal | editorial
// services: one of cards | list | numbered | tiles | alternating | feature
const STYLE_LAYOUT = {
  modern:    { hero: "centered",   services: "cards" },
  bold:      { hero: "overlay",    services: "tiles" },
  minimal:   { hero: "minimal",    services: "list" },
  classic:   { hero: "sidebyside", services: "alternating" },
  warm:      { hero: "split",      services: "cards" },
  editorial: { hero: "editorial",  services: "feature" },
  technical: { hero: "split",      services: "numbered" },
  couture:   { hero: "minimal",    services: "alternating" },
  gallery:   { hero: "banner",     services: "feature" },
  playful:   { hero: "centered",   services: "tiles" },
  noir:      { hero: "overlay",    services: "feature" },
  future:    { hero: "split",      services: "numbered" },
  monument:  { hero: "editorial",  services: "list" },
};

// Image-led hero variants need a background image. Without one they'd render
// blank, so they fall back to a type-led hero that still looks deliberate.
const HERO_NEEDS_IMAGE = new Set(["overlay", "banner", "split", "sidebyside"]);

/** The structural preset for a style key (defaults to modern's). */
export function styleLayout(styleKey) {
  return STYLE_LAYOUT[styleKey] || STYLE_LAYOUT.modern;
}

/**
 * Stamp a template's structure onto its blocks: the hero gets the template's
 * hero variant (downgraded to a type-led one when there's no photo), and the
 * services block gets the template's services layout. Everything else is left
 * alone. Returns a new array; inputs are not mutated.
 */
export function applyStyleStructure(blocks, styleKey) {
  const layout = STYLE_LAYOUT[styleKey];
  if (!layout || !Array.isArray(blocks)) return blocks;

  return blocks.map((b) => {
    if (b?.type === "hero") {
      const hasImage = Boolean(b.content?.backgroundImage);
      const hero =
        HERO_NEEDS_IMAGE.has(layout.hero) && !hasImage
          ? // No photo: minimal/couture keep the type-only "minimal" hero; the
            // rest fall to "centered" rather than a blank image band.
            (styleKey === "minimal" || styleKey === "couture" ? "minimal" : "centered")
          : layout.hero;
      return { ...b, content: { ...b.content, variant: hero } };
    }
    if (b?.type === "services") {
      return { ...b, content: { ...b.content, variant: layout.services } };
    }
    return b;
  });
}
