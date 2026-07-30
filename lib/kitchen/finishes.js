// lib/kitchen/finishes.js
//
// What the kitchen is made of and what colour it is.
//
// One module, because these choices are made in three places that must agree:
// the contractor's designer, the homeowner's public designer, and the drawing
// that ends up on the quote. A palette defined separately in any of them is a
// client approving a colour the crew never sees.
//
// ── Why named finishes and not a colour picker alone ───────────────────────
//
// A raw picker lets a homeowner choose #7B2FF7 for their cabinets, and the
// contractor then has to explain that no cabinet shop stocks it. The named
// options below are colours joinery is actually finished in, so choosing from
// them produces a drawing the contractor can price and build.
//
// A custom hex is still allowed on the cabinet colour — a company matching a
// client's existing millwork needs it — and the drawing accepts any hex it's
// given. The palette is the fast path, not a cage.
//
// ── These are appearance only ──────────────────────────────────────────────
//
// Nothing here touches price. Door STYLE looks like it should — a raised panel
// is more work than a slab — but cabinet pricing runs off width, tier and
// MATERIAL (see pricing.js), and quietly making a colour swatch move a quote
// total would be a control that changes money without saying so.
//
// If door style should carry a multiplier, it belongs in the rate card next to
// the material multipliers, where a company sets it and can see it.

/** Cabinet paint colours, in the order a showroom would lay them out. */
export const CABINET_COLORS = [
  { key: "warm_white", label: "Warm white", hex: "#F1ECE3" },
  { key: "pure_white", label: "Pure white", hex: "#FBFBF9" },
  { key: "greige", label: "Greige", hex: "#D9D2C5" },
  { key: "sage", label: "Sage", hex: "#A8B3A0" },
  { key: "olive", label: "Olive", hex: "#6E7358" },
  { key: "forest", label: "Forest green", hex: "#3F4F45" },
  { key: "navy", label: "Navy", hex: "#2E3B4E" },
  { key: "slate", label: "Slate blue", hex: "#5A6B7B" },
  { key: "charcoal", label: "Charcoal", hex: "#3A3D42" },
  { key: "black", label: "Soft black", hex: "#22242A" },
  { key: "walnut", label: "Walnut", hex: "#6B4A33" },
  { key: "oak", label: "Natural oak", hex: "#C9A87C" },
];

/**
 * Door styles.
 *
 * `frame` is the stile width in INCHES — a real dimension, so the drawing keeps
 * a believable frame thickness whatever size the cabinet is. That's the detail
 * a stretched photograph gets wrong and a drafted elevation gets right.
 *
 * `panelDepth` is how much darker the recessed panel reads than the face, 0 for
 * a door with no panel at all.
 */
export const DOOR_STYLES = [
  {
    key: "shaker",
    label: "Shaker",
    hint: "Recessed flat panel in a square frame. The default in most kitchens.",
    frame: 2.25,
    panelDepth: 0.06,
    profile: "square",
  },
  {
    key: "flat",
    label: "Flat / slab",
    hint: "One flat face, no frame. Modern, and the easiest to keep clean.",
    frame: 0,
    panelDepth: 0,
    profile: "none",
  },
  {
    key: "raised",
    label: "Raised panel",
    hint: "A frame with a bevelled panel that stands proud. Traditional.",
    frame: 2.5,
    panelDepth: -0.05, // negative: the panel is LIGHTER, because it catches light
    profile: "bevel",
  },
  {
    key: "beadboard",
    label: "Beadboard",
    hint: "A framed panel with vertical grooves. Cottage and farmhouse work.",
    frame: 2.25,
    panelDepth: 0.05,
    profile: "bead",
  },
];

/** Countertop surfaces. */
export const COUNTER_COLORS = [
  { key: "white_quartz", label: "White quartz", hex: "#F4F2EE", veined: true },
  { key: "carrara", label: "Carrara marble", hex: "#EDEDE9", veined: true },
  { key: "grey_quartz", label: "Grey quartz", hex: "#CFCEC9", veined: true },
  { key: "concrete", label: "Concrete", hex: "#B7B5AF", veined: false },
  { key: "butcher", label: "Butcher block", hex: "#C08A52", veined: false },
  { key: "black_granite", label: "Black granite", hex: "#33343A", veined: true },
  { key: "soapstone", label: "Soapstone", hex: "#4A4E52", veined: true },
];

/** Floors. `plank` draws board lines; the rest read as a continuous surface. */
export const FLOOR_COLORS = [
  { key: "white_oak", label: "White oak", hex: "#E4D3B8", plank: true },
  { key: "honey_oak", label: "Honey oak", hex: "#D8B98A", plank: true },
  { key: "walnut_floor", label: "Walnut", hex: "#9C7350", plank: true },
  { key: "grey_wash", label: "Grey wash", hex: "#CFC8BE", plank: true },
  { key: "dark_stain", label: "Dark stain", hex: "#6B5443", plank: true },
  { key: "porcelain", label: "Porcelain tile", hex: "#DCDAD4", plank: false },
  { key: "slate_tile", label: "Slate tile", hex: "#8E9095", plank: false },
];

/** Wall paint — the surface behind the uppers, seen on the elevations. */
export const WALL_COLORS = [
  { key: "chalk", label: "Chalk white", hex: "#F5F3EE" },
  { key: "linen", label: "Linen", hex: "#EAE3D7" },
  { key: "mist", label: "Mist grey", hex: "#DDDFE0" },
  { key: "clay", label: "Clay", hex: "#D7C3B2" },
  { key: "sage_wall", label: "Sage", hex: "#CBD2C4" },
  { key: "deep_blue", label: "Deep blue", hex: "#41525F" },
];

/** Backsplashes. */
export const BACKSPLASH_COLORS = [
  { key: "white_subway", label: "White subway tile", hex: "#F2F1ED", tile: true },
  { key: "cream_zellige", label: "Cream zellige", hex: "#EDE6D8", tile: true },
  { key: "sage_tile", label: "Sage tile", hex: "#C3CDBF", tile: true },
  { key: "slab_match", label: "Slab (matches counter)", hex: null, tile: false },
  { key: "charcoal_tile", label: "Charcoal tile", hex: "#3E4046", tile: true },
];

/** Everything a design's `finish` can carry, with the defaults. */
export const DEFAULT_FINISH = {
  cabinetColor: "#F1ECE3",
  doorStyle: "shaker",
  // Islands are very often a different colour from the perimeter — it's the
  // single most common request in a kitchen, so it's a first-class field rather
  // than something a contractor fakes.
  islandColor: null, // null = same as the perimeter
  countertopColor: "#F4F2EE",
  countertopVeined: true,
  floorColor: "#E4D3B8",
  floorPlank: true,
  wallColor: "#F5F3EE",
  backsplashColor: "#F2F1ED",
  backsplashTile: true,
  backsplashHeight: 18,
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A hex we're willing to paint with, else the fallback. */
function hex(value, fallback) {
  return typeof value === "string" && HEX.test(value.trim()) ? value.trim() : fallback;
}

/** The door style object for a key, always something. */
export function doorStyle(key) {
  return DOOR_STYLES.find((d) => d.key === key) || DOOR_STYLES[0];
}

/**
 * A complete, safe finish.
 *
 * Every colour validated as a hex. The public designer posts this straight from
 * a browser, and an unvalidated value lands in `fill` on an SVG that renders
 * inside the contractor's app and the client's PDF — so a string that isn't a
 * colour must not get that far.
 *
 * Merged over the defaults so a design saved before a field existed still
 * renders, rather than painting that surface `undefined`.
 */
export function normaliseFinish(input) {
  const f = { ...DEFAULT_FINISH, ...(input && typeof input === "object" ? input : {}) };
  const style = doorStyle(f.doorStyle);

  return {
    cabinetColor: hex(f.cabinetColor, DEFAULT_FINISH.cabinetColor),
    doorStyle: style.key,
    islandColor: f.islandColor ? hex(f.islandColor, null) : null,
    countertopColor: hex(f.countertopColor, DEFAULT_FINISH.countertopColor),
    countertopVeined: Boolean(f.countertopVeined),
    floorColor: hex(f.floorColor, DEFAULT_FINISH.floorColor),
    floorPlank: Boolean(f.floorPlank),
    wallColor: hex(f.wallColor, DEFAULT_FINISH.wallColor),
    // Null is meaningful: "slab, matching the counter". Kept rather than
    // defaulted, so the renderer can follow the counter colour instead of
    // painting a tile colour nobody chose.
    backsplashColor: f.backsplashColor === null ? null : hex(f.backsplashColor, DEFAULT_FINISH.backsplashColor),
    backsplashTile: Boolean(f.backsplashTile),
    backsplashHeight: Math.min(Math.max(Number(f.backsplashHeight) || 18, 0), 60),
  };
}

/** The colour a given element's doors are painted. */
export function colorFor(el, finish) {
  const f = normaliseFinish(finish);
  if (el?.kind === "island" && f.islandColor) return f.islandColor;
  return f.cabinetColor;
}

/** A one-line description for the quote's finish schedule. */
export function describeFinish(finish) {
  const f = normaliseFinish(finish);
  const name = (list, value) =>
    list.find((x) => x.hex?.toLowerCase() === String(value).toLowerCase())?.label || value;

  const parts = [
    `${doorStyle(f.doorStyle).label} doors in ${name(CABINET_COLORS, f.cabinetColor)}`,
  ];
  if (f.islandColor) parts.push(`island in ${name(CABINET_COLORS, f.islandColor)}`);
  parts.push(`${name(COUNTER_COLORS, f.countertopColor)} countertop`);
  parts.push(`${name(FLOOR_COLORS, f.floorColor)} floor`);
  return parts.join(" · ");
}
