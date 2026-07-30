// lib/kitchen/planShapes.js
//
// A kitchen design turned into a presentation drawing — the thing a homeowner
// looks at, not the thing a contractor drags.
//
// ── Why a shape list instead of SVG ────────────────────────────────────────
//
// This returns plain objects ({ type: "rect", x, y, ... }) rather than markup,
// because the same drawing has to appear in two places that share no rendering
// code: the browser (SVG) and the quote/invoice PDF (@react-pdf primitives).
//
// Generating SVG here and re-parsing it for the PDF, or writing the drawing
// twice, both end the same way — a client approves one picture and the crew
// builds from another. One geometry pass, two thin adapters, and the two
// literally cannot disagree.
//
// Layout geometry itself comes from ./geometry.js, the same module the editor
// drags against.
//
// ── What makes it read as a drawing ────────────────────────────────────────
//
// Not decoration. Each of these answers a question a homeowner actually asks:
//
//   * wall thickness    — where the room ends and the cabinetry begins
//   * floor fill        — which parts are open floor (can I walk here?)
//   * countertop        — what's a work surface vs. a wall cabinet above it
//   * dimension lines   — will my table fit; how wide is that run
//   * appliance labels  — that's the fridge, not another cupboard
//   * door swing        — the arc is why the cabinet next to it stops short
//   * scale bar         — makes the whole thing measurable on paper
//
// Everything is in ROOM INCHES. The adapters apply one scale.

import {
  KINDS,
  WALLS,
  planRect,
  planWidth,
  planDepth,
  cornerLegs,
} from "./geometry";

/** Wall thickness drawn around the room, in inches. Nominal 2×4 plus board. */
const WALL_THICKNESS = 5;

/** Counter overhang past the cabinet face. */
const COUNTER_OVERHANG = 1;

/** The palette. Muted and warm, so cabinetry reads as joinery rather than UI. */
export const PLAN_COLORS = {
  wall: "#3f4448",
  floor: "#e8d9c3",
  floorLine: "#d8c5aa",
  counter: "#f4f2ee",
  counterEdge: "#c9c4bb",
  cabinet: "#ffffff",
  cabinetEdge: "#9aa0a6",
  upper: "#f7f7f5",
  upperEdge: "#c2c7cc",
  appliance: "#dfe3e6",
  applianceEdge: "#9aa0a6",
  island: "#ffffff",
  ink: "#2b2f33",
  inkMuted: "#6b7178",
  dim: "#8a9096",
  pull: "#b08d57",
};

const r1 = (n) => Math.round(n * 10) / 10;

/** 42 → `3'-6"`. The unit a cabinet shop and a homeowner both read. */
export function feetInches(inches) {
  const total = Math.round(Number(inches) || 0);
  const ft = Math.floor(Math.abs(total) / 12);
  const inch = Math.abs(total) % 12;
  const sign = total < 0 ? "-" : "";
  return `${sign}${ft}'-${inch}"`;
}

/**
 * Is this element drawn as a wall (upper) cabinet?
 *
 * All three tolerate an unknown kind. A design saved by an older version of the
 * designer — or edited by hand — can name a kind this build no longer has, and
 * `KINDS[kind].plane` on that would throw while rendering a quote a client is
 * looking at. Unknown kinds fall through to "base cabinet", which draws a plain
 * box: wrong in detail, but a drawing rather than a stack trace.
 */
function isUpper(kind) {
  return KINDS[kind]?.plane === "upper";
}
function isAppliance(kind) {
  return KINDS[kind]?.group === "appliance";
}
function isOpening(kind) {
  return KINDS[kind]?.group === "opening";
}
/** Elements this build understands. Anything else is skipped by planRect. */
function known(el) {
  return Boolean(el && KINDS[el.kind]);
}

/** The label an appliance carries on the plan. */
const APPLIANCE_LABEL = {
  fridge: "FRIDGE",
  stove: "RANGE",
  dishwasher: "DW",
  hoodVent: "HOOD",
  microwave: "MICRO",
  sinkBase: "SINK",
};

/**
 * A dimension line: the two ticks, the rule, the arrows and the label.
 *
 * `side` places it outside the room — "top" and "left" for the overall room
 * dimensions, matching how a drafted plan is read.
 */
function dimension(shapes, { x1, y1, x2, y2, label, offset = 0, side = "top" }) {
  const horizontal = y1 === y2;
  const ox = horizontal ? 0 : -offset;
  const oy = horizontal ? -offset : 0;

  const ax = x1 + ox;
  const ay = y1 + oy;
  const bx = x2 + ox;
  const by = y2 + oy;

  // Witness lines back to what's being measured, so the reader can see WHICH
  // edge the number belongs to — the single thing that makes a dimension
  // trustworthy rather than decorative.
  shapes.push({ type: "line", x1, y1, x2: ax, y2: ay, stroke: PLAN_COLORS.dim, width: 0.5 });
  shapes.push({ type: "line", x1: x2, y1: y2, x2: bx, y2: by, stroke: PLAN_COLORS.dim, width: 0.5 });
  shapes.push({ type: "line", x1: ax, y1: ay, x2: bx, y2: by, stroke: PLAN_COLORS.dim, width: 0.8 });

  const tick = 3;
  for (const [px, py, dir] of [
    [ax, ay, 1],
    [bx, by, -1],
  ]) {
    if (horizontal) {
      shapes.push({
        type: "polygon",
        points: [[px, py], [px + tick * dir, py - tick / 2], [px + tick * dir, py + tick / 2]],
        fill: PLAN_COLORS.dim,
      });
    } else {
      shapes.push({
        type: "polygon",
        points: [[px, py], [px - tick / 2, py + tick * dir], [px + tick / 2, py + tick * dir]],
        fill: PLAN_COLORS.dim,
      });
    }
  }

  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  shapes.push({
    type: "text",
    x: mx,
    y: horizontal ? my - 4 : my,
    text: label,
    size: 8,
    fill: PLAN_COLORS.ink,
    anchor: "middle",
    weight: 600,
    rotate: horizontal ? 0 : -90,
  });
}

/**
 * The whole plan, as shapes.
 *
 * @param design  { room, elements, finish }
 * @returns { shapes, width, height, pad } — all in inches
 */
export function planShapes(design) {
  // `design = {}` in the signature does NOT cover an explicit null, and null is
  // exactly what arrives: Quote.scopeDetails is nullable, and a quote with no
  // design yet reads through to here. A drawing that throws takes the whole
  // quote page down with it.
  if (!design || typeof design !== "object") design = {};
  const room = design.room || { width: 144, depth: 120 };
  const W = planWidth(room);
  const D = planDepth(room);
  const elements = (Array.isArray(design.elements) ? design.elements : []).filter(known);
  const cabinetColor = design.finish?.cabinetColor || PLAN_COLORS.cabinet;

  // Room for the dimension lines and their labels, outside the walls. Generous
  // on purpose: the vertical label is ROTATED, so its height becomes horizontal
  // extent, and a tighter margin clipped it off the left edge of the sheet.
  const pad = 44;
  const shapes = [];

  // ── Walls ───────────────────────────────────────────────────────────────
  // Drawn as a thick stroked rect centred on the room boundary, which is how a
  // wall reads on a plan: a solid band, not a hairline.
  shapes.push({
    type: "rect",
    x: -WALL_THICKNESS / 2,
    y: -WALL_THICKNESS / 2,
    w: W + WALL_THICKNESS,
    h: D + WALL_THICKNESS,
    fill: "none",
    stroke: PLAN_COLORS.wall,
    width: WALL_THICKNESS,
  });

  // ── Floor ───────────────────────────────────────────────────────────────
  shapes.push({ type: "rect", x: 0, y: 0, w: W, h: D, fill: PLAN_COLORS.floor });
  // Board lines. Coarse enough to read as flooring at quote size and not turn
  // into moiré when the PDF is printed.
  for (let x = 8; x < W; x += 8) {
    shapes.push({
      type: "line",
      x1: x, y1: 0, x2: x, y2: D,
      stroke: PLAN_COLORS.floorLine,
      width: 0.4,
    });
  }

  // ── Cabinetry ───────────────────────────────────────────────────────────
  //
  // Base boxes first with their counter, then uppers over the top with a dashed
  // edge. Uppers are ABOVE the counter in reality, so on a plan they're an
  // overlay — solid would claim floor space that's actually walkable.
  const bases = elements.filter(
    (el) => !isUpper(el.kind) && !isAppliance(el.kind) && !isOpening(el.kind),
  );
  const uppers = elements.filter((el) => isUpper(el.kind));
  const appliances = elements.filter((el) => isAppliance(el.kind));
  const openings = elements.filter((el) => isOpening(el.kind));

  for (const el of bases) {
    // A corner box is two legs, not one rectangle — drawing its bounding box
    // would swallow the corner and hide the very thing a corner unit solves.
    const rects = KINDS[el.kind]?.corner ? cornerLegs(el, room) : [planRect(el, room)];
    for (const rc of rects) {
      // Counter, slightly proud of the box.
      shapes.push({
        type: "rect",
        x: rc.x - COUNTER_OVERHANG,
        y: rc.y - COUNTER_OVERHANG,
        w: rc.w + COUNTER_OVERHANG * 2,
        h: rc.h + COUNTER_OVERHANG * 2,
        fill: PLAN_COLORS.counter,
        stroke: PLAN_COLORS.counterEdge,
        width: 0.6,
      });
      shapes.push({
        type: "rect",
        x: rc.x, y: rc.y, w: rc.w, h: rc.h,
        fill: cabinetColor,
        stroke: PLAN_COLORS.cabinetEdge,
        width: 0.7,
      });
      addPulls(shapes, rc, el);
    }
    if (el.kind === "sinkBase") addSink(shapes, planRect(el, room));
    if (el.kind === "island") addStools(shapes, planRect(el, room));
  }

  for (const el of uppers) {
    const rects = KINDS[el.kind]?.corner ? cornerLegs(el, room) : [planRect(el, room)];
    for (const rc of rects) {
      shapes.push({
        type: "rect",
        x: rc.x, y: rc.y, w: rc.w, h: rc.h,
        fill: "none",
        stroke: PLAN_COLORS.upperEdge,
        width: 0.7,
        dash: [3, 2],
      });
    }
  }

  for (const el of appliances) {
    const rc = planRect(el, room);
    shapes.push({
      type: "rect",
      x: rc.x, y: rc.y, w: rc.w, h: rc.h,
      fill: PLAN_COLORS.appliance,
      stroke: PLAN_COLORS.applianceEdge,
      width: 0.7,
    });
    if (el.kind === "stove") addBurners(shapes, rc);
    const label = APPLIANCE_LABEL[el.kind];
    if (label) {
      // Along the BOTTOM edge, not centred. Centred put "RANGE" straight
      // through its own burners — legible in isolation, unreadable together,
      // which is the state a drawing is worst in: it looks fine until someone
      // tries to use it.
      shapes.push({
        type: "text",
        x: rc.x + rc.w / 2,
        y: rc.y + rc.h - 2.5,
        text: label,
        size: 6.5,
        fill: PLAN_COLORS.inkMuted,
        anchor: "middle",
        weight: 600,
      });
    }
  }

  // ── Openings ────────────────────────────────────────────────────────────
  for (const el of openings) {
    const rc = planRect(el, room);
    if (el.kind === "door") addDoorSwing(shapes, el, rc, W, D);
    else {
      // A window is a break in the wall band, drawn as a thin light strip.
      shapes.push({
        type: "rect",
        x: rc.x, y: rc.y, w: rc.w, h: Math.min(rc.h, WALL_THICKNESS),
        fill: "#ffffff",
        stroke: PLAN_COLORS.wall,
        width: 0.6,
      });
    }
  }

  // ── Dimensions ──────────────────────────────────────────────────────────
  dimension(shapes, {
    x1: 0, y1: 0, x2: W, y2: 0,
    label: feetInches(W),
    offset: 18,
  });
  dimension(shapes, {
    x1: 0, y1: 0, x2: 0, y2: D,
    label: feetInches(D),
    offset: 18,
  });

  // ── The island gets its own two dimensions ──────────────────────────────
  //
  // And nothing else does. An earlier pass dimensioned every continuous RUN of
  // cabinetry, which was accurate and unreadable: the numbers landed inside the
  // room on top of the boxes they measured.
  //
  // A drafted kitchen plan carries the room and the island, because those are
  // the two that decide whether the layout WORKS — can you walk round it, does
  // the fridge door clear. Cabinet runs are dimensioned on the elevations,
  // where there's room for them.
  const island = elements.find((el) => el.kind === "island");
  if (island) {
    const rc = planRect(island, room);
    dimension(shapes, {
      x1: rc.x, y1: rc.y, x2: rc.x + rc.w, y2: rc.y,
      label: feetInches(rc.w), offset: 14,
    });
    dimension(shapes, {
      x1: rc.x, y1: rc.y, x2: rc.x, y2: rc.y + rc.h,
      label: feetInches(rc.h), offset: 14,
    });
  }

  return { shapes, width: W, height: D, pad };
}

/** Continuous stretches of cabinetry along one wall. */
export function runsOnWall(bases, wallId, room) {
  const onWall = bases
    .filter((el) => el.wall === wallId && !KINDS[el.kind]?.corner)
    .map((el) => planRect(el, room))
    .filter(Boolean)
    .sort((a, b) => a.x - b.x);
  if (!onWall.length) return [];

  const runs = [];
  let cur = { from: onWall[0].x, to: onWall[0].x + onWall[0].w, depth: onWall[0].h };
  for (const rc of onWall.slice(1)) {
    // 2" is the same tolerance the editor snaps at, so a run that LOOKS
    // continuous on screen dimensions as one number here.
    if (rc.x - cur.to <= 2) {
      cur.to = Math.max(cur.to, rc.x + rc.w);
      cur.depth = Math.max(cur.depth, rc.h);
    } else {
      runs.push(cur);
      cur = { from: rc.x, to: rc.x + rc.w, depth: rc.h };
    }
  }
  runs.push(cur);
  return runs.map((r) => ({ ...r, length: r1(r.to - r.from) }));
}

/** Door and drawer pulls — the detail that makes a box read as cabinetry. */
function addPulls(shapes, rc, el) {
  const doors = Math.max(1, Math.min(el.config?.doors || 1, 4));
  const horizontal = rc.w >= rc.h;
  const span = horizontal ? rc.w : rc.h;
  const seg = span / doors;
  const len = Math.min(4, seg * 0.35);

  for (let i = 0; i < doors; i++) {
    const centre = (i + 0.5) * seg;
    if (horizontal) {
      const x = rc.x + centre;
      const y = rc.y + rc.h - 1.2;
      shapes.push({ type: "line", x1: x - len / 2, y1: y, x2: x + len / 2, y2: y, stroke: PLAN_COLORS.pull, width: 1 });
    } else {
      const y = rc.y + centre;
      const x = rc.x + rc.w - 1.2;
      shapes.push({ type: "line", x1: x, y1: y - len / 2, x2: x, y2: y + len / 2, stroke: PLAN_COLORS.pull, width: 1 });
    }
  }
}

function addSink(shapes, rc) {
  const inset = 3;
  shapes.push({
    type: "rect",
    x: rc.x + inset, y: rc.y + inset,
    w: Math.max(4, rc.w - inset * 2), h: Math.max(4, rc.h - inset * 2),
    rx: 1.5,
    fill: "#cfd6db",
    stroke: PLAN_COLORS.applianceEdge,
    width: 0.6,
  });
}

function addBurners(shapes, rc) {
  const cx = [0.3, 0.7];
  // Biased above centre, leaving the bottom band clear for the RANGE label.
  const cy = [0.24, 0.56];
  const r = Math.min(rc.w, rc.h) * 0.13;
  for (const fx of cx) {
    for (const fy of cy) {
      shapes.push({
        type: "circle",
        cx: rc.x + rc.w * fx, cy: rc.y + rc.h * fy, r,
        fill: "none", stroke: PLAN_COLORS.inkMuted, width: 0.6,
      });
    }
  }
}

/** Stools along the open side of an island. */
function addStools(shapes, rc) {
  const n = Math.max(0, Math.min(Math.floor(rc.w / 26), 5));
  const r = 6;
  for (let i = 0; i < n; i++) {
    shapes.push({
      type: "circle",
      cx: rc.x + ((i + 0.5) * rc.w) / n,
      cy: rc.y + rc.h + r + 2,
      r,
      fill: "#e2d3bd",
      stroke: PLAN_COLORS.applianceEdge,
      width: 0.6,
    });
  }
}

/**
 * The quarter-circle a door sweeps.
 *
 * Drawn because it is the reason a cabinet next to a doorway stops short. A
 * plan without it looks like there's room for another base unit, and that
 * mistake is only discovered on install day.
 */
function addDoorSwing(shapes, el, rc, W, D) {
  // The door LEAF, from the element — not rc.w. planRect rotates elements on
  // walls B and D, so there rc.w is the wall depth (~5") and the swing came out
  // as a 5" stub instead of a 32" arc. The arc is the whole point: it's why the
  // cabinet beside a doorway has to stop short.
  const w = Number(el.width) > 0 ? Number(el.width) : 32;
  let hinge, sweep;
  switch (el.wall) {
    case "A": hinge = [rc.x, 0]; sweep = [rc.x, w]; break;
    case "C": hinge = [rc.x, D]; sweep = [rc.x, D - w]; break;
    case "B": hinge = [W, rc.y]; sweep = [W - w, rc.y]; break;
    default:  hinge = [0, rc.y]; sweep = [w, rc.y]; break;
  }
  const open = el.wall === "A" || el.wall === "C" ? [hinge[0] + w, hinge[1]] : [hinge[0], hinge[1] + w];

  shapes.push({
    type: "line",
    x1: hinge[0], y1: hinge[1], x2: sweep[0], y2: sweep[1],
    stroke: PLAN_COLORS.inkMuted, width: 0.8,
  });
  shapes.push({
    type: "path",
    d: `M ${sweep[0]} ${sweep[1]} A ${w} ${w} 0 0 1 ${open[0]} ${open[1]}`,
    fill: "none",
    stroke: PLAN_COLORS.dim,
    width: 0.6,
    dash: [2, 2],
  });
}

/**
 * The scale bar, as its own shape list.
 *
 * Separate from the plan because it belongs to the SHEET, not the room — it
 * sits below the drawing at a fixed size regardless of how big the kitchen is.
 */
export function scaleBarShapes({ x = 0, y = 0, unitPx = 1 } = {}) {
  const shapes = [];
  const footPx = 12 * unitPx;
  const feet = 8;
  const h = 4;

  for (let i = 0; i < feet; i++) {
    shapes.push({
      type: "rect",
      x: x + i * footPx, y, w: footPx, h,
      fill: i % 2 ? "#ffffff" : PLAN_COLORS.ink,
      stroke: PLAN_COLORS.ink,
      width: 0.5,
    });
  }
  for (const ft of [0, 1, 2, 3, 4, 8]) {
    shapes.push({
      type: "text",
      x: x + ft * footPx, y: y - 2,
      text: ft === 0 ? "0'" : `${ft}'`,
      size: 6,
      fill: PLAN_COLORS.inkMuted,
      anchor: "middle",
    });
  }
  shapes.push({
    type: "text",
    x, y: y + h + 7, text: "SCALE", size: 6.5,
    fill: PLAN_COLORS.ink, anchor: "start", weight: 700,
  });
  return shapes;
}

/**
 * What to call each elevation.
 *
 * "Cooktop wall" / "Sink wall" / "Fridge wall", derived from what's actually on
 * it — the way the reference drawing labels them, and the way a homeowner
 * thinks. "Wall B" is a coordinate system; nobody stands in their kitchen and
 * thinks about wall B.
 *
 * Falls back to the compass name only when a wall has nothing distinguishing on
 * it, because two walls both called "Cabinet wall" is worse than one called
 * "Right wall".
 */
export function elevationTitle(wallId, elements = []) {
  const on = elements.filter((el) => el.wall === wallId);
  const has = (kind) => on.some((el) => el.kind === kind);

  if (has("stove") || has("hoodVent")) return "Cooktop wall";
  if (has("sinkBase")) return "Sink wall";
  if (has("fridge") || has("fridgeSurround")) return "Fridge wall";
  if (has("dishwasher")) return "Dishwasher wall";
  if (has("tall")) return "Pantry wall";
  if (on.some((el) => KINDS[el.kind]?.group === "cabinet")) return "Cabinet wall";
  return WALLS.find((w) => w.id === wallId)?.label || `Wall ${wallId}`;
}


/**
 * Gaps between cabinets that are too small to be intentional.
 *
 * The editor snaps a dragged box flush at 2", so anything under that closes on
 * its own. What this catches is the band ABOVE the snap threshold and below a
 * real filler: a 3" hole nobody meant to leave, which looks like nothing on
 * screen at 1/50 scale and is a visible strip of wall in the finished kitchen.
 *
 * Reported rather than auto-closed. Closing it would move a cabinet the person
 * placed deliberately — some gaps are real (a dishwasher not yet drawn, a
 * radiator, a run that stops at a doorway). The designer flags them and lets a
 * human decide, which is also why the message names the size and the wall.
 *
 * @returns [{ wall, from, to, size }]
 */
export function findGaps(design, { min = 0.25, max = 6 } = {}) {
  if (!design || typeof design !== "object") return [];
  const room = design.room || { width: 144, depth: 120 };
  const elements = (Array.isArray(design.elements) ? design.elements : []).filter(known);
  const bases = elements.filter(
    (el) => !isUpper(el.kind) && !isOpening(el.kind) && el.kind !== "island",
  );

  const gaps = [];
  for (const wall of WALLS) {
    const runs = runsOnWall(bases, wall.id, room);
    for (let i = 1; i < runs.length; i++) {
      const size = r1(runs[i].from - runs[i - 1].to);
      if (size > min && size < max) {
        gaps.push({ wall: wall.id, from: runs[i - 1].to, to: runs[i].from, size });
      }
    }
  }
  return gaps;
}
