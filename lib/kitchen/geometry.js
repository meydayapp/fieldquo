// lib/kitchen/geometry.js
//
// Where every cabinet sits, in inches.
//
// Extracted from KitchenDesigner so the interactive editor and the presentation
// drawing share ONE source of truth for the layout. They were about to be two:
// the plan render needs the same wall-to-XY mapping the editor drags against,
// and a copy of that mapping is a drawing that slowly stops matching the thing
// the client dragged.
//
// Pure — no React, no DOM. That's what lets the same geometry drive the SVG on
// screen and the @react-pdf primitives on the quote, which is the only way those
// two can be guaranteed to agree.
//
// ── The coordinate system ──────────────────────────────────────────────────
//
// Room space, in inches, origin at the top-left of the plan:
//
//        A (back)
//   D  ┌──────────┐  B
// (left)│          │(right)
//      └──────────┘
//        C (front)
//
// `pos` is always measured ALONG its own wall, left-to-right as you face that
// wall — which is why C and D subtract: facing the front wall from inside the
// room, "left" runs the opposite way in room space.

// Real cabinetry dimensions, in inches. Standard North American shop practice:
// a 34.5" box plus a 1.5" counter lands the work surface at 36", and uppers
// start at 54" to leave an 18" backsplash gap — the two numbers a homeowner
// notices immediately if they're wrong.
export const COUNTER_HEIGHT = 36;
export const BASE_HEIGHT = 34.5;
export const UPPER_BOTTOM = 54;

// How close a dragged box has to get before it snaps flush. Two inches is a
// deliberate compromise: tight enough not to grab a neighbour you meant to
// leave a gap beside, loose enough to catch a thumb on a phone.
export const SNAP = 2;

// The corner zone an adjacent box counts as "returning" into.
export const RETURN_DEPTH = 30;

export const WALLS = [
  { id: "A", label: "Wall A (back)", short: "Back" },
  { id: "B", label: "Wall B (right)", short: "Right" },
  { id: "C", label: "Wall C (front)", short: "Front" },
  { id: "D", label: "Wall D (left)", short: "Left" },
];

// Icons deliberately absent. They were on these entries, which is what stopped
// this file being importable outside React at all — geometry that can't run in
// a PDF renderer or a test is geometry that gets copied instead of shared. The
// lucide components live in KIND_ICONS, in the component that draws buttons.
export const KINDS = {
  base: {
    label: "Base",
    group: "cabinet",
    plane: "floor",
    dragY: false,
    w: 24,
    h: BASE_HEIGHT,
    d: 24,
  },
  drawerBase: {
    label: "Drawer base",
    group: "cabinet",
    plane: "floor",
    dragY: false,
    w: 18,
    h: BASE_HEIGHT,
    d: 24,
  },
  sinkBase: {
    label: "Sink base",
    group: "cabinet",
    plane: "floor",
    dragY: false,
    w: 30,
    h: BASE_HEIGHT,
    d: 24,
  },
  spiceBase: {
    label: "Spice/pull-out",
    group: "cabinet",
    plane: "floor",
    dragY: false,
    w: 6,
    h: BASE_HEIGHT,
    d: 24,
  },
  tall: {
    label: "Tall/pantry",
    group: "cabinet",
    plane: "full",
    dragY: false,
    w: 24,
    h: 84,
    d: 24,
  },
  fridgeSurround: {
    label: "Fridge surround",
    group: "cabinet",
    plane: "full",
    dragY: false,
    w: 36,
    h: 84,
    d: 26,
  },

  hoodCabinet: {
    label: "Hood cabinet",
    group: "cabinet",
    plane: "upper",
    dragY: true,
    w: 30,
    h: 24,
    d: 12,
  },
  wall: {
    label: "Wall",
    group: "cabinet",
    plane: "upper",
    dragY: true,
    w: 24,
    h: 30,
    d: 12,
  },
  microwave: {
    label: "Microwave",
    group: "cabinet",
    plane: "upper",
    dragY: true,
    w: 24,
    h: 18,
    d: 13,
  },
  island: {
    label: "Island",
    group: "island",
    plane: "floor",
    dragY: false,
    w: 60,
    h: BASE_HEIGHT,
    d: 36,
    free: true,
  },

  cornerBase: {
    label: "Corner base (L)",
    group: "cabinet",
    plane: "floor",
    corner: true,
    h: BASE_HEIGHT,
    d: 24,
  },
  cornerBaseDiag: {
    label: "Corner base (45°)",
    group: "cabinet",
    plane: "floor",
    corner: true,
    h: BASE_HEIGHT,
    d: 24,
  },
  cornerWall: {
    label: "Corner wall (L)",
    group: "cabinet",
    plane: "upper",
    corner: true,
    h: 30,
    d: 12,
  },
  cornerWallDiag: {
    label: "Corner wall (45°)",
    group: "cabinet",
    plane: "upper",
    corner: true,
    h: 30,
    d: 12,
  },

  fridge: {
    label: "Fridge",
    group: "appliance",
    plane: "floor",
    dragY: false,
    w: 36,
    h: 70,
    d: 30,
  },
  stove: {
    label: "Range/stove",
    group: "appliance",
    plane: "floor",
    dragY: false,
    w: 30,
    h: 36,
    d: 26,
  },
  hoodVent: {
    label: "Hood vent",
    group: "appliance",
    plane: "upper",
    dragY: true,
    w: 30,
    h: 12,
    d: 18,
  },
  dishwasher: {
    label: "Dishwasher",
    group: "appliance",
    plane: "floor",
    dragY: false,
    w: 24,
    h: 34,
    d: 24,
  },

  window: {
    label: "Window",
    group: "opening",
    plane: "free",
    dragY: true,
    w: 36,
    h: 36,
    d: 0,
  },
  door: {
    label: "Door",
    group: "opening",
    plane: "floor",
    dragY: false,
    w: 32,
    h: 80,
    d: 0,
  },
};

export function planWidth(room) {
  return Math.max(
    room.width || 0,
    room.walls?.A?.length || 0,
    room.walls?.C?.length || 0,
    12,
  );
}

export function planDepth(room) {
  return Math.max(
    room.depth || 0,
    room.walls?.B?.length || 0,
    room.walls?.D?.length || 0,
    12,
  );
}

// Island module helpers. Missed by the first extraction pass, which the Next
// build did not catch — it compiles fine and throws the moment anyone draws an
// island. That is the whole reason these modules get executed against real
// input rather than reviewed.
export function islandModules(el) {
  return el.config?.modules || [];
}

export function islandSideModules(el, side) {
  return islandModules(el).filter((m) => (m.side || "front") === side);
}

export function islandFrontModules(el) {
  return islandSideModules(el, "front");
}

export function islandBackModules(el) {
  return islandSideModules(el, "back");
}

export function islandLeftModules(el) {
  return islandSideModules(el, "left");
}

export function islandRightModules(el) {
  return islandSideModules(el, "right");
}

export function islandSideRun(modules) {
  return modules.reduce((sum, m) => sum + (m.width || 0), 0);
}

export function islandTotalWidth(el) {
  const frontW = islandSideRun(islandFrontModules(el));
  const backW = islandSideRun(islandBackModules(el));

  const sideDepths =
    Math.max(
      0,
      ...islandLeftModules(el).map((m) => m.depth || 24),
      ...islandRightModules(el).map((m) => m.depth || 24),
    ) * 2;

  return Math.max(frontW, backW, el.width || 0, 24) + sideDepths;
}

export function islandTotalDepth(el) {
  const frontD = Math.max(
    0,
    ...islandFrontModules(el).map((m) => m.depth || 24),
  );
  const backD = Math.max(0, ...islandBackModules(el).map((m) => m.depth || 24));

  const leftW = islandSideRun(islandLeftModules(el));
  const rightW = islandSideRun(islandRightModules(el));

  return Math.max(frontD + backD, leftW, rightW, el.depth || 0, 24);
}

export function planRect(el, room) {
  const k = KINDS[el.kind];
  const W = planWidth(room);
  const D = planDepth(room);
  const w = el.width;
  const d = el.depth || (k.plane === "upper" ? 12 : 24);

  if (el.kind === "island") {
    return {
      x: el.pos,
      y: el.y,
      w: islandTotalWidth(el),
      h: islandTotalDepth(el),
    };
  }

  switch (el.wall) {
    case "A":
      return { x: el.pos, y: 0, w, h: d };
    case "B":
      return { x: W - d, y: el.pos, w: d, h: w };
    case "C":
      return { x: W - el.pos - w, y: D - d, w, h: d };
    case "D":
      return { x: 0, y: D - el.pos - w, w: d, h: w };
    default:
      return { x: el.pos, y: 0, w, h: d };
  }
}

export function cornerLegs(el, room) {
  const d = el.depth || 24;
  const la = el.config?.legA ?? 36;
  const lb = el.config?.legB ?? 36;
  const W = planWidth(room);
  const D = planDepth(room);
  switch (el.corner) {
    case "AD":
      return [
        { x: 0, y: 0, w: la, h: d },
        { x: 0, y: 0, w: d, h: lb },
      ];
    case "AB":
      return [
        { x: W - la, y: 0, w: la, h: d },
        { x: W - d, y: 0, w: d, h: lb },
      ];
    case "BC":
      return [
        { x: W - d, y: D - lb, w: d, h: lb },
        { x: W - la, y: D - d, w: la, h: d },
      ];
    case "CD":
      return [
        { x: 0, y: D - d, w: la, h: d },
        { x: 0, y: D - lb, w: d, h: lb },
      ];
    default:
      return [];
  }
}
