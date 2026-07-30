
"use client";

/**
 * KitchenDesigner — 2D technical drawing tool for new-kitchen quotes.
 * Phone-first. Inches throughout. No external state libs, no localStorage.
 *
 * Views: Plan (top-down) + 4 wall elevations (A back / B right / C front / D left).
 *
 * Placement & touch:
 *  - Drag base/tall/appliances along X (they sit on the floor).
 *  - Drag wall cabinets + window along X and Y.
 *  - Door drags along X. Island is free in plan.
 *  - Pieces SNAP flush to walls, corners, and each other's edges (~2"), so
 *    base/drawer runs butt together cleanly. Overlap is allowed and, when two
 *    non-corner boxes overlap in a corner, it's flagged so you add a corner box.
 *
 * Corners:
 *  - Corner cabinets (L or 45° diagonal, base & wall) belong to a corner
 *    junction (AD/AB/BC/CD) and render in BOTH adjacent elevations + the L/▲
 *    footprint in plan.
 *  - On a wall elevation you also see a thin "return" strip for any box on the
 *    perpendicular wall sitting in that corner (the side of the adjacent box).
 *
 * Emits onChange({ room, elements, bom }). Pricing delegated to priceItem().
 */

import { useState, useRef, useMemo, useCallback, useEffect } from "react";
import {
  Square,
  Trash2,
  Refrigerator,
  Flame,
  Box,
  PanelTop,
  RectangleHorizontal,
  DoorOpen,
  Columns2,
  CookingPot,
  Move,
  Maximize2,
  Microwave,
  CornerDownRight,
  Triangle,
  DollarSign,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import {
  priceCabinet,
  getKitchenBreakdown,
  countKitchenFaces,
  DEFAULT_CABINET_RATES,
  DOOR_MATERIALS,
  BOX_MATERIALS,
  KITCHEN_ACCESSORIES,
} from "@/lib/kitchen/pricing";

import CabinetFace from "./CabinetFace";
import ApplianceGlyph from "./ApplianceGlyph";

/* ─────────────────────────── defaults / theme ─────────────────────────── */
const DEFAULT_THEME = {
  bg: "#0e0f13",
  card: "#16181f",
  text: "#f3f4f6",
  textMuted: "#9ca3af",
  border: "#2a2d36",
  gold: "#bd9d60",
};

// rough luminance of a #rrggbb / #rgb colour → is the surface light?
function isLightColor(hex) {
  if (typeof hex !== "string") return false;
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}

const WALL_HEIGHT_CLASSES = ["12", "24", "30", "34", "36", "42"];
const COUNTER_HEIGHT = 36;
const BASE_HEIGHT = 34.5;
const UPPER_BOTTOM = 54;
const SNAP = 2; // inches
const RETURN_DEPTH = 30; // corner-zone depth for "return" detection

const WALLS = [
  { id: "A", label: "Wall A (back)", short: "Back" },
  { id: "B", label: "Wall B (right)", short: "Right" },
  { id: "C", label: "Wall C (front)", short: "Front" },
  { id: "D", label: "Wall D (left)", short: "Left" },
];

// corner → the two walls it joins, in [first, second] order (legA, legB)
const CORNER_WALLS = {
  AD: ["A", "D"],
  AB: ["A", "B"],
  BC: ["B", "C"],
  CD: ["C", "D"],
};
// which end of a faced wall a corner sits at (elevation left→right)
const CORNER_END = {
  A: { AD: "start", AB: "end" },
  B: { AB: "start", BC: "end" },
  C: { BC: "start", CD: "end" },
  D: { CD: "start", AD: "end" },
};

function defaultCornerForView(view) {
  // If user is currently viewing a wall elevation,
  // add the corner cabinet to the most logical corner of that wall.
  if (view === "A") return "AD"; // Wall A starts at AD, ends at AB
  if (view === "B") return "AB"; // Wall B starts at AB, ends at BC
  if (view === "C") return "BC"; // Wall C starts at BC, ends at CD
  if (view === "D") return "CD"; // Wall D starts at CD, ends at AD

  // Plan view default
  return "AD";
}

const KINDS = {
  base: {
    label: "Base",
    group: "cabinet",
    plane: "floor",
    dragY: false,
    w: 24,
    h: BASE_HEIGHT,
    d: 24,
    icon: Box,
  },
  drawerBase: {
    label: "Drawer base",
    group: "cabinet",
    plane: "floor",
    dragY: false,
    w: 18,
    h: BASE_HEIGHT,
    d: 24,
    icon: Columns2,
  },
  sinkBase: {
    label: "Sink base",
    group: "cabinet",
    plane: "floor",
    dragY: false,
    w: 30,
    h: BASE_HEIGHT,
    d: 24,
    icon: CookingPot,
  },
  spiceBase: {
    label: "Spice/pull-out",
    group: "cabinet",
    plane: "floor",
    dragY: false,
    w: 6,
    h: BASE_HEIGHT,
    d: 24,
    icon: Box,
  },
  tall: {
    label: "Tall/pantry",
    group: "cabinet",
    plane: "full",
    dragY: false,
    w: 24,
    h: 84,
    d: 24,
    icon: PanelTop,
  },
  fridgeSurround: {
    label: "Fridge surround",
    group: "cabinet",
    plane: "full",
    dragY: false,
    w: 36,
    h: 84,
    d: 26,
    icon: PanelTop,
  },

  hoodCabinet: {
    label: "Hood cabinet",
    group: "cabinet",
    plane: "upper",
    dragY: true,
    w: 30,
    h: 24,
    d: 12,
    icon: PanelTop,
  },
  wall: {
    label: "Wall",
    group: "cabinet",
    plane: "upper",
    dragY: true,
    w: 24,
    h: 30,
    d: 12,
    icon: Box,
  },
  microwave: {
    label: "Microwave",
    group: "cabinet",
    plane: "upper",
    dragY: true,
    w: 24,
    h: 18,
    d: 13,
    icon: Microwave,
  },
  island: {
    label: "Island",
    group: "island",
    plane: "floor",
    dragY: false,
    w: 60,
    h: BASE_HEIGHT,
    d: 36,
    icon: Box,
    free: true,
  },

  cornerBase: {
    label: "Corner base (L)",
    group: "cabinet",
    plane: "floor",
    corner: true,
    h: BASE_HEIGHT,
    d: 24,
    icon: CornerDownRight,
  },
  cornerBaseDiag: {
    label: "Corner base (45°)",
    group: "cabinet",
    plane: "floor",
    corner: true,
    h: BASE_HEIGHT,
    d: 24,
    icon: Triangle,
  },
  cornerWall: {
    label: "Corner wall (L)",
    group: "cabinet",
    plane: "upper",
    corner: true,
    h: 30,
    d: 12,
    icon: CornerDownRight,
  },
  cornerWallDiag: {
    label: "Corner wall (45°)",
    group: "cabinet",
    plane: "upper",
    corner: true,
    h: 30,
    d: 12,
    icon: Triangle,
  },

  fridge: {
    label: "Fridge",
    group: "appliance",
    plane: "floor",
    dragY: false,
    w: 36,
    h: 70,
    d: 30,
    icon: Refrigerator,
  },
  stove: {
    label: "Range/stove",
    group: "appliance",
    plane: "floor",
    dragY: false,
    w: 30,
    h: 36,
    d: 26,
    icon: Flame,
  },
  hoodVent: {
    label: "Hood vent",
    group: "appliance",
    plane: "upper",
    dragY: true,
    w: 30,
    h: 12,
    d: 18,
    icon: CookingPot,
  },
  dishwasher: {
    label: "Dishwasher",
    group: "appliance",
    plane: "floor",
    dragY: false,
    w: 24,
    h: 34,
    d: 24,
    icon: Square,
  },

  window: {
    label: "Window",
    group: "opening",
    plane: "free",
    dragY: true,
    w: 36,
    h: 36,
    d: 0,
    icon: RectangleHorizontal,
  },
  door: {
    label: "Door",
    group: "opening",
    plane: "floor",
    dragY: false,
    w: 32,
    h: 80,
    d: 0,
    icon: DoorOpen,
  },
};

const PALETTE_GROUPS = [
  { title: "Base", kinds: ["base", "drawerBase", "sinkBase", "spiceBase"] },
  { title: "Upper", kinds: ["wall", "microwave", "hoodCabinet"] },
  { title: "Tall", kinds: ["tall", "fridgeSurround", "island"] },
  {
    title: "Corner",
    kinds: ["cornerBase", "cornerBaseDiag", "cornerWall", "cornerWallDiag"],
  },
  { title: "Appliance", kinds: ["fridge", "stove", "dishwasher", "hoodVent"] },
  { title: "Opening", kinds: ["window", "door"] },
];

let _seq = 0;
const uid = () => `el_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ── family helpers (geometry uses these; pricing lives in kitchen-services) ── */
const WALL_FAMILY = [
  "wall",
  "cornerWall",
  "cornerWallDiag",
  "microwave",
  "hoodCabinet",
];
const TALL_FAMILY = ["tall", "fridgeSurround"];
const CORNER_KINDS = [
  "cornerBase",
  "cornerBaseDiag",
  "cornerWall",
  "cornerWallDiag",
];

/* ───────────────────────── element factories ──────────────────────────── */
// RTI rule: 7–23" → single door, 24–36" → double doors
const doorsForWidth = (w) => (w >= 24 ? 2 : 1);

function defaultCabinetConfig(kind) {
  if (kind === "hoodCabinet")
    return {
      doors: 2,

      doorRows: 1,

      drawers: [],

      heightClass: "24",
    };

  if (WALL_FAMILY.includes(kind) && !CORNER_KINDS.includes(kind))
    return {
      doors: kind === "microwave" ? 0 : 2,

      doorRows: 1,

      drawers: [],

      heightClass: kind === "microwave" ? "24" : "30",
    };

  if (kind === "cornerWall" || kind === "cornerWallDiag")
    return {
      doors: 1,

      doorRows: 1,

      drawers: [],

      heightClass: "30",

      legA: 24,

      legB: 24,
    };

  if (kind === "cornerBase" || kind === "cornerBaseDiag")
    return { doors: 1, doorRows: 1, drawers: [], legA: 36, legB: 36 };

  if (kind === "drawerBase")
    return {
      doors: 0,

      doorRows: 1,

      drawers: ["big", "big", "big"],

      sink: false,
    };

  if (kind === "sinkBase")
    return { doors: 2, doorRows: 1, drawers: [], sink: true };

  if (kind === "spiceBase") return { doors: 1, doorRows: 1, drawers: [] };

  if (kind === "tall" || kind === "fridgeSurround")
    return { doors: 2, doorRows: 1, drawers: [], drawersAtBottom: true };

  if (kind === "island")
    return {
      modules: [
        {
          id: uid(),

          kind: "drawerBase",

          width: 24,

          depth: 24,

          height: BASE_HEIGHT,

          side: "front",

          config: defaultCabinetConfig("drawerBase"),
        },

        {
          id: uid(),

          kind: "base",

          width: 36,

          depth: 24,

          height: BASE_HEIGHT,

          side: "front",

          config: defaultCabinetConfig("base"),
        },
      ],

      backSide: false,

      finishedBackPanel: true,

      finishedLeftPanel: true,

      finishedRightPanel: true,
    };

  if (["fridge", "stove", "dishwasher", "hoodVent"].includes(kind)) {
    return {
      billable: false,

      supplyPrice: 0,

      installPrice: 0,
    };
  }

  return { doors: 2, doorRows: 1, drawers: ["small"], sink: false };
}

function isApplianceKind(kind) {
  return ["fridge", "stove", "dishwasher", "hoodVent"].includes(kind);
}

function priceAppliance(el) {
  if (!isApplianceKind(el.kind)) return null;

  const c = el.config || {};

  if (!c.billable) {
    return {
      cabinet: 0,
      install: 0,
      total: 0,
    };
  }

  const supply = Number(c.supplyPrice || 0);
  const install = Number(c.installPrice || 0);

  return {
    cabinet: supply,
    install,
    total: supply + install,
  };
}

function makeElement(kind, wall, activeView = "plan") {
  const k = KINDS[kind];

  const config =
    k.group === "cabinet" || k.group === "island" || k.group === "appliance"
      ? defaultCabinetConfig(kind)
      : {};

  if (k.group === "cabinet") {
    if (!k.corner && (config.doors || 0) > 0) {
      config.doors = doorsForWidth(k.w);
    }

    config.doorMaterial = config.doorMaterial || "mdf";
    config.boxMaterial = config.boxMaterial || "melamine";
  }

  if (k.corner) {
    const corner = defaultCornerForView(activeView);
    const legA = config.legA ?? 36;
    const legB = config.legB ?? 36;

    return {
      id: uid(),
      kind,
      corner,
      plane: k.plane,
      width: Math.max(legA, legB),
      height: k.h,
      depth: k.d,
      label: k.label,
      config,
    };
  }

  return {
    id: uid(),
    kind,
    wall: k.free ? null : wall || "A",
    pos: 0,
    y: k.plane === "upper" ? UPPER_BOTTOM : k.plane === "free" ? 40 : 0,
    width: k.w,
    height: k.h,
    depth: k.d,
    label: k.label,
    config,
    ...(kind === "island" ? { pos: 36, y: 36 } : {}),
  };
}

/* ────────────────────────────── geometry ──────────────────────────────── */
function wallLength(wallId, room) {
  if (room.walls?.[wallId]?.length) {
    return room.walls[wallId].length;
  }

  return wallId === "A" || wallId === "C" ? room.width : room.depth;
}

function wallCeiling(wallId, room) {
  if (room.walls?.[wallId]?.ceiling) {
    return room.walls[wallId].ceiling;
  }

  return room.ceiling || 96;
}

function planWidth(room) {
  return Math.max(
    room.width || 0,
    room.walls?.A?.length || 0,
    room.walls?.C?.length || 0,
    12,
  );
}

function planDepth(room) {
  return Math.max(
    room.depth || 0,
    room.walls?.B?.length || 0,
    room.walls?.D?.length || 0,
    12,
  );
}

function islandModules(el) {
  return el.config?.modules || [];
}

function islandSideModules(el, side) {
  return islandModules(el).filter((m) => (m.side || "front") === side);
}

function islandFrontModules(el) {
  return islandSideModules(el, "front");
}

function islandBackModules(el) {
  return islandSideModules(el, "back");
}

function islandLeftModules(el) {
  return islandSideModules(el, "left");
}

function islandRightModules(el) {
  return islandSideModules(el, "right");
}

function islandSideRun(modules) {
  return modules.reduce((sum, m) => sum + (m.width || 0), 0);
}

function islandTotalWidth(el) {
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

function islandTotalDepth(el) {
  const frontD = Math.max(
    0,
    ...islandFrontModules(el).map((m) => m.depth || 24),
  );
  const backD = Math.max(0, ...islandBackModules(el).map((m) => m.depth || 24));

  const leftW = islandSideRun(islandLeftModules(el));
  const rightW = islandSideRun(islandRightModules(el));

  return Math.max(frontD + backD, leftW, rightW, el.depth || 0, 24);
}

// plan AABB for a normal (non-corner) element
function planRect(el, room) {
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

// the two legs of an L corner, as plan rects
function cornerLegs(el, room) {
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

// diagonal (45°) corner footprint → svg polygon points (plan), leg = depth-ish
// diagonal 45° corner footprint → 5-sided cabinet shape in plan view
function cornerDiagPoints(el, room, sx, syPlan) {
  const d = el.depth || 24; // cabinet depth
  const la = el.config?.legA ?? 36; // run on first wall
  const lb = el.config?.legB ?? 36; // run on second wall
  const W = planWidth(room);
  const D = planDepth(room);

  let pts;

  switch (el.corner) {
    case "AD": // back-left
      pts = [
        [0, 0],
        [la, 0],
        [la, d],
        [d, lb],
        [0, lb],
      ];
      break;

    case "AB": // back-right
      pts = [
        [W, 0],
        [W - la, 0],
        [W - la, d],
        [W - d, lb],
        [W, lb],
      ];
      break;

    case "BC": // front-right
      pts = [
        [W, D],
        [W, D - lb],
        [W - d, D - lb],
        [W - la, D - d],
        [W - la, D],
      ];
      break;

    case "CD": // front-left
      pts = [
        [0, D],
        [la, D],
        [la, D - d],
        [d, D - lb],
        [0, D - lb],
      ];
      break;

    default:
      pts = [];
  }

  return pts.map(([x, y]) => `${sx(x)},${syPlan(y)}`).join(" ");
}

// angled door/front line for 45° corner cabinet
function cornerDiagDoorLine(el, room) {
  const d = el.depth || 24;
  const la = el.config?.legA ?? 36;
  const lb = el.config?.legB ?? 36;
  const W = planWidth(room);
  const D = planDepth(room);

  switch (el.corner) {
    case "AD":
      return [
        [la, d],
        [d, lb],
      ];

    case "AB":
      return [
        [W - la, d],
        [W - d, lb],
      ];

    case "BC":
      return [
        [W - d, D - lb],
        [W - la, D - d],
      ];

    case "CD":
      return [
        [la, D - d],
        [d, D - lb],
      ];

    default:
      return null;
  }
}

// leg length of a corner cabinet that lies on a given wall
function legOnWall(el, wall) {
  const idx = CORNER_WALLS[el.corner]?.indexOf(wall);

  if (idx === -1 || idx == null) return null;

  return idx === 0 ? (el.config?.legA ?? 36) : (el.config?.legB ?? 36);
}

// map a plan rect's wall-parallel extent → elevation x-range on `wall`
function planToElev(wall, rect, room) {
  switch (wall) {
    case "A":
      return { x: rect.x, w: rect.w };
    case "B":
      return { x: rect.y, w: rect.h };
    case "C":
      return { x: planWidth(room) - (rect.x + rect.w), w: rect.w };
    case "D":
      return { x: planDepth(room) - (rect.y + rect.h), w: rect.h };
    default:
      return { x: rect.x, w: rect.w };
  }
}

// does a perpendicular cabinet's plan rect sit in `wall`'s corner band?
function touchesWallBand(wall, rect, room) {
  switch (wall) {
    case "A":
      return rect.y < RETURN_DEPTH;
    case "C":
      return rect.y + rect.h > planDepth(room) - RETURN_DEPTH;
    case "B":
      return rect.x + rect.w > planWidth(room) - RETURN_DEPTH;
    case "D":
      return rect.x < RETURN_DEPTH;
    default:
      return false;
  }
}

/* ── The old outline-only CabinetFace lived here ─────────────────────────────
   Superseded by ./CabinetFace, the painted version, which both call sites in
   this file already used — they pass `color`, where this one wanted `theme`.
   Removed rather than left: two components with the same name and different
   props is how someone "fixes" a drawing by editing the copy nobody renders. */


/* ──────────────────────────── main component ──────────────────────────── */
/**
 * @param value       the saved design ({ room, elements, ... })
 * @param onChange    fires with the whole design on every edit
 * @param theme       host colours — see DEFAULT_THEME for the shape
 * @param rates       THE COMPANY'S rate card. Required for anything that will
 *                    become a quote; see the note below.
 * @param readOnly    show the drawing and the totals, refuse the edits
 * @param clientMode  the public homeowner view — layout and finish only, no
 *                    money, no rate card, no supply/install switch
 */
export default function KitchenDesigner({
  value,
  onChange,
  theme: themeProp,
  rates: ratesProp,
  readOnly = false,
  clientMode = false,
}) {
  const theme = { ...DEFAULT_THEME, ...(themeProp || {}) };
  // adapt to the host light/dark theme: translucent surfaces inherit the parent
  const dark = !isLightColor(theme.bg);
  const grid = dark ? "#ffffff10" : "#11182710";
  const surface = `${theme.text}0a`; // faint tint that reads on light & dark
  const surfaceSoft = `${theme.text}06`;
  const [room, setRoomRaw] = useState(
    value?.room || {
      width: 144,
      depth: 120,
      ceiling: 96,
      walls: {
        A: { length: 144, ceiling: 96 },
        B: { length: 120, ceiling: 96 },
        C: { length: 144, ceiling: 96 },
        D: { length: 120, ceiling: 96 },
      },
    },
  );
  const [elements, setElementsRaw] = useState(value?.elements || []);
  // ancillary config: pricing + modules (seeded from value, editable here, saved upstream)
  const [cfg, setCfgRaw] = useState(() => ({
    supplyMode: value?.supplyMode || "supply_install",
    // ── Whose prices are these ─────────────────────────────────────────────
    //
    // `ratesProp` is the COMPANY's card and wins over anything carried on the
    // design. A saved design can hold a stale copy from before the shop put its
    // prices up, and quoting today's kitchen at last year's rate is a loss the
    // contractor finds out about at the end of the job.
    //
    // DEFAULT_CABINET_RATES underneath both is a fallback, not a price: it's one
    // cabinet maker's real numbers. Anything that ends up on a quote passes
    // `rates`; the settings page is where a shop replaces them.
    //
    // None of this is authoritative anyway — the server reprices from
    // Company.cabinetRates before a line item is written. This is what the
    // person drawing sees while they draw.
    rates: { ...DEFAULT_CABINET_RATES, ...(value?.rates || {}), ...(ratesProp || {}) },
    // Custom Finish is ON by default — every new kitchen gets its doors/drawers finished
    modules: {
      delivery: true,
      removeOld: false,
      refinish: true,
      countertop: false,
      ...(value?.modules || {}),
    },
    refinish: {
      mode: "auto",
      doors: 0,
      drawers: 0,
      ...(value?.refinish || {}),
    },
    countertop: {
      sqft: 0,
      materialPerSqft: 65,
      fabInstallPerSqft: 45,
      edgeFt: 0,
      edgePerFt: 15,
      ...(value?.countertop || {}),
    },
    accessories: value?.accessories || [],
    finish: {
      cabinetColor: "#EDE8DD",
      countertopColor: "#3A3A3A",
      backsplashColor: "#E8E2D6",
      backsplashHeight: 18,
      ...(value?.finish || {}),
    },
  }));

  // ── readOnly, enforced at the setter ───────────────────────────────────
  //
  // Wrapping the three state setters rather than guarding the dozen call sites
  // that use them. Every edit in this component — adding a box, dragging one,
  // editing the inspector, resizing the room, toggling a pricing module — ends
  // in one of these three, so this is a choke point rather than a checklist.
  //
  // A checklist is what fails: the toolbar is hidden below, and if that were the
  // whole guard then dragging a cabinet on a SENT quote would still silently
  // reprice it. Guarding here also means code added later is covered by
  // default rather than by someone remembering.
  const guard = useCallback(
    (setter) => (updater) => {
      if (readOnly) return;
      setter(updater);
    },
    [readOnly],
  );
  const setElements = useMemo(() => guard(setElementsRaw), [guard]);
  const setRoom = useMemo(() => guard(setRoomRaw), [guard]);
  const setCfg = useMemo(() => guard(setCfgRaw), [guard]);

  const [islandSide, setIslandSide] = useState("front");

  const rates = cfg.rates;
  const priceItem = useCallback(
    (el) => {
      if (isApplianceKind(el.kind)) {
        return priceAppliance(el);
      }

      if (KINDS[el.kind]?.group !== "cabinet") {
        return {
          cabinet: 0,
          install: 0,
          total: 0,
        };
      }

      return priceCabinet(el, rates);
    },
    [rates],
  );
  const [view, setView] = useState("plan");
  const [selectedId, setSelectedId] = useState(null);
  const [showPricing, setShowPricing] = useState(true);
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const [boxW, setBoxW] = useState(760);

  const selected = elements.find((e) => e.id === selectedId) || null;

  /* ── island layout helpers ── */
  const islands = elements.filter((e) => e.kind === "island");

  const selectedIsland =
    selected?.kind === "island" ? selected : islands[0] || null;

  const islandView = view === "island";

  const islandSideMods = selectedIsland
    ? islandSideModules(selectedIsland, islandSide)
    : [];
  const islandContentW = Math.max(islandSideRun(islandSideMods), 24);
  const islandContentH =
    Math.max(
      BASE_HEIGHT,
      ...islandSideMods.map((m) => m.height || BASE_HEIGHT),
    ) + 8;

  // responsive viewBox: measure container width, derive a comfortable height
  useEffect(() => {
    if (!wrapRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setBoxW(Math.max(280, Math.round(w)));
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  const fullConfig = useCallback(
    (els = elements, rm = room, cf = cfg) => ({
      serviceType: "kitchen",

      room: rm,

      elements: els,

      supplyMode: cf.supplyMode,

      rates: cf.rates,

      modules: cf.modules,

      refinish: cf.refinish,

      countertop: cf.countertop,

      accessories: cf.accessories,

      finish: cf.finish,
    }),

    [elements, room, cfg],
  );

  // Keep a live ref to onChange so the emit effect never re-runs just because
  // the parent passed a new function identity.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Emit upward only when OUR inputs actually change. Comparing a signature of
  // the inputs (not the derived payload) means the parent storing our payload
  // back into `value` cannot bounce an update back into this effect.
  const lastSigRef = useRef(null);
  useEffect(() => {
    const sig = JSON.stringify({ room, elements, cfg });
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;

    const bom = cabinetPricingElements(elements).map((e) => ({
      ...e,
      pricing: isApplianceKind(e.kind)
        ? priceAppliance(e)
        : priceCabinet(e, cfg.rates),
    }));
    onChangeRef.current?.({ ...fullConfig(elements, room, cfg), bom });
  }, [elements, room, cfg, fullConfig]);

  //   const emit = useCallback(
  //     (nextEls, nextRoom, nextCfg) => {
  //       const els = nextEls || elements;
  //       const rm = nextRoom || room;
  //       const cf = nextCfg || cfg;
  //       const bom = els
  //         .filter((e) => KINDS[e.kind]?.group === "cabinet")
  //         .map((e) => ({ ...e, pricing: priceCabinet(e, cf.rates) }));
  //       onChange?.({ ...fullConfig(els, rm, cf), bom });
  //     },
  //     [elements, room, cfg, onChange],
  //   );

  // edit ancillary config

  const patchCfg = (patch) =>
    setCfg((prev) => ({
      ...prev,

      ...patch,
    }));

  const patchRates = (patch) =>
    setCfg((prev) => ({
      ...prev,

      rates: {
        ...prev.rates,

        ...patch,
      },
    }));

  const patchModules = (patch) =>
    setCfg((prev) => ({
      ...prev,

      modules: {
        ...prev.modules,

        ...patch,
      },
    }));

  const update = (id, patch) =>
    setElements((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );

  const updateConfig = (id, patch) =>
    setElements((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;

        const merged = {
          ...e,

          config: {
            ...e.config,

            ...patch,
          },
        };

        if (KINDS[e.kind]?.corner) {
          merged.width = Math.max(
            merged.config.legA ?? 36,

            merged.config.legB ?? 36,
          );
        }

        return merged;
      }),
    );

  const addIslandModule = (kind, side = "front") => {
    if (!selectedIsland) return;

    const base = KINDS[kind];

    const module = {
      id: uid(),
      kind,
      width: base?.w || 24,
      depth: base?.d || 24,
      height: base?.h || BASE_HEIGHT,
      side,
      config: defaultCabinetConfig(kind),
    };

    updateConfig(selectedIsland.id, {
      modules: [...(selectedIsland.config?.modules || []), module],
    });
  };

  const add = (kind) => {
    if (
      view === "island" &&
      selectedIsland &&
      ["base", "drawerBase", "sinkBase", "spiceBase"].includes(kind)
    ) {
      addIslandModule(kind, islandSide);
      return;
    }

    const wall = view === "plan" || view === "island" ? "A" : view;
    const el = makeElement(kind, wall, view);

    setElements((prev) => [...prev, el]);
    setSelectedId(el.id);
  };

  const remove = (id) => {
    setElements((prev) => prev.filter((e) => e.id !== id));

    if (selectedId === id) {
      setSelectedId(null);
    }
  };

  const setRoomDim = (patch) =>
    setRoom((prev) => ({
      ...prev,

      ...patch,
    }));

  /* ── island elevation helpers ── */
  function cabinetPricingElements(elements) {
    const out = [];

    elements.forEach((el) => {
      if (KINDS[el.kind]?.group === "cabinet") {
        out.push(el);
      }

      if (isApplianceKind(el.kind) && el.config?.billable) {
        out.push({
          ...el,
          label: `${el.label || KINDS[el.kind]?.label} supply/install`,
        });
      }

      if (el.kind === "island") {
        (el.config?.modules || []).forEach((m) => {
          out.push({
            id: `${el.id}_${m.id}`,
            kind: m.kind,
            wall: null,
            pos: 0,
            y: 0,
            width: m.width,
            height: m.height || BASE_HEIGHT,
            depth: m.depth || 24,
            label: `Island ${KINDS[m.kind]?.label || m.kind}`,
            config: m.config || defaultCabinetConfig(m.kind),
            islandId: el.id,
            islandSide: m.side || "front",
          });
        });
      }
    });

    return out;
  }

  /* ── view sizing ── */
  const PAD = 26;
  const VIEW_W = boxW;
  // NEW:
  let VIEW_H;
  if (view === "plan") {
    const aspect = planDepth(room) / planWidth(room);
    VIEW_H = Math.round(clamp(VIEW_W * aspect + PAD * 2, 220, 540));
  } else if (islandView) {
    const aspect = islandContentH / islandContentW;
    VIEW_H = Math.round(clamp(VIEW_W * aspect + PAD * 2, 160, 400));
  } else {
    // Wall elevation: fit BOTH wall width AND ceiling into the viewport.
    // Never let height exceed 65% of width → walls B/D stay readable.
    const wallW = wallLength(view, room);
    const wallH = wallCeiling(view, room);
    const maxH = clamp(Math.round(VIEW_W * 0.65), 200, 460);
    const s = Math.min((VIEW_W - PAD * 2) / wallW, (maxH - PAD * 2) / wallH);
    VIEW_H = Math.round(clamp(wallH * s + PAD * 2, 200, 460));
  }

  const { scale, contentW, contentH, offX, offY } = useMemo(() => {
    const cw =
      view === "plan"
        ? planWidth(room)
        : islandView
          ? islandContentW
          : wallLength(view, room);

    const ch =
      view === "plan"
        ? planDepth(room)
        : islandView
          ? islandContentH
          : wallCeiling(view, room);
    const s = Math.min((VIEW_W - PAD * 2) / cw, (VIEW_H - PAD * 2) / ch);
    return {
      scale: s,
      contentW: cw,
      contentH: ch,
      offX: (VIEW_W - cw * s) / 2,
      offY: (VIEW_H - ch * s) / 2,
    };
  }, [view, room, VIEW_W, VIEW_H, islandView, islandContentW, islandContentH]);

  const sx = (inch) => offX + inch * scale;
  const syPlan = (inch) => offY + inch * scale;
  const syElev = (heightFromFloor, objH) =>
    offY + (contentH - heightFromFloor - objH) * scale;

  /* ── pointer drag w/ snapping ── */
  const pointerToInches = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    const py = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    return { ix: (px - offX) / scale, iy: (py - offY) / scale };
  };

  // snap a wall-bound piece's pos to walls/corners/neighbor edges
  const snapPos = (el, pos) => {
    const len = wallLength(el.wall, room);
    const cands = [0, len - el.width];
    elements.forEach((o) => {
      if (o.id === el.id || o.wall !== el.wall || KINDS[o.kind]?.corner) return;
      cands.push(o.pos - el.width, o.pos + o.width); // butt right / left
    });
    let best = pos;
    let bestD = SNAP;
    cands.forEach((c) => {
      const d = Math.abs(pos - c);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    });
    return clamp(best, 0, Math.max(0, len - el.width));
  };

  const onPointerDown = (e, el) => {
    e.stopPropagation();
    setSelectedId(el.id);
    if (KINDS[el.kind]?.corner) return; // corners locked to junction
    dragRef.current = { id: el.id, start: pointerToInches(e), orig: { ...el } };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const p = pointerToInches(e);
    const dx = p.ix - d.start.ix;
    const dy = p.iy - d.start.iy;
    const el = d.orig;
    const k = KINDS[el.kind];
    const patch = {};
    if (view === "plan") {
      if (el.kind === "island") {
        patch.pos = clamp(
          el.pos + dx,
          0,
          planWidth(room) - islandTotalWidth(el),
        );
        patch.y = clamp(el.y + dy, 0, planDepth(room) - islandTotalDepth(el));
      } else {
        const along = el.wall === "A" || el.wall === "C" ? dx : dy;
        const sign = el.wall === "C" || el.wall === "D" ? -1 : 1;
        patch.pos = snapPos(el, el.pos + sign * along);
      }
    } else {
      patch.pos = snapPos(el, el.pos + dx);
      if (k.dragY) {
        let ny = el.y - dy;
        // vertical snap: counter, upper line, neighbor y's
        const ceil = wallCeiling(view, room);

        [0, COUNTER_HEIGHT, UPPER_BOTTOM, ceil - el.height].forEach((c) => {
          if (Math.abs(ny - c) < SNAP) ny = c;
        });

        patch.y = clamp(ny, 0, ceil - el.height);
      }
    }
    update(d.id, patch);
  };
  const onPointerUp = (e) => {
    dragRef.current = null;
    e.currentTarget?.releasePointerCapture?.(e.pointerId);
  };

  /* ── overlap conflicts (plan) ── */
  const conflicts = useMemo(() => {
    const rects = elements
      .filter((e) => {
        const k = KINDS[e.kind];
        return (
          k &&
          !k.corner &&
          (k.plane === "floor" || k.plane === "full") &&
          (k.group === "cabinet" || k.group === "appliance")
        );
      })
      .map((e) => ({ id: e.id, r: planRect(e, room) }));
    const out = [];
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i].r,
          b = rects[j].r;
        const ix = Math.max(a.x, b.x),
          iy = Math.max(a.y, b.y);
        const ax = Math.min(a.x + a.w, b.x + b.w),
          ay = Math.min(a.y + a.h, b.y + b.h);
        if (ax - ix > 1 && ay - iy > 1)
          out.push({ x: ix, y: iy, w: ax - ix, h: ay - iy });
      }
    return out;
  }, [elements, room]);

  /* ── totals (full breakdown incl. modules) ── */
  const breakdownConfig = useMemo(
    () => ({
      ...fullConfig(elements, room, cfg),
      elements: cabinetPricingElements(elements),
    }),
    [elements, room, cfg, fullConfig],
  );

  const breakdown = useMemo(
    () => getKitchenBreakdown(breakdownConfig),
    [breakdownConfig],
  );

  /* ── renderers ── */
  const renderPlan = () => {
    const nodes = [];
    elements.forEach((el) => {
      const k = KINDS[el.kind];
      const isSel = el.id === selectedId;
      if (k.corner) {
        if (el.kind === "cornerBaseDiag" || el.kind === "cornerWallDiag") {
          const doorLine = cornerDiagDoorLine(el, room);

          nodes.push(
            <g
              key={el.id}
              onPointerDown={(e) => onPointerDown(e, el)}
              style={{ cursor: "pointer" }}
            >
              <polygon
                points={cornerDiagPoints(el, room, sx, syPlan)}
                fill={`${theme.gold}22`}
                stroke={isSel ? theme.gold : `${theme.text}66`}
                strokeWidth={isSel ? 2 : 1.2}
                strokeDasharray={k.plane === "upper" ? "5 3" : "0"}
              />

              {doorLine && (
                <line
                  x1={sx(doorLine[0][0])}
                  y1={syPlan(doorLine[0][1])}
                  x2={sx(doorLine[1][0])}
                  y2={syPlan(doorLine[1][1])}
                  stroke={theme.gold}
                  strokeWidth={1.5}
                />
              )}

              <text
                x={
                  doorLine
                    ? (sx(doorLine[0][0]) + sx(doorLine[1][0])) / 2
                    : sx(0)
                }
                y={
                  doorLine
                    ? (syPlan(doorLine[0][1]) + syPlan(doorLine[1][1])) / 2 - 3
                    : syPlan(0)
                }
                fill={theme.text}
                fontSize="8.5"
                textAnchor="middle"
              >
                {shortLabel(el)}
              </text>
            </g>,
          );
        } else {
          cornerLegs(el, room).forEach((r, idx) => {
            nodes.push(
              <rect
                key={`${el.id}_${idx}`}
                x={sx(r.x)}
                y={syPlan(r.y)}
                width={r.w * scale}
                height={r.h * scale}
                rx={2}
                fill={`${theme.gold}22`}
                stroke={isSel ? theme.gold : `${theme.text}66`}
                strokeWidth={isSel ? 2 : 1.2}
                strokeDasharray={k.plane === "upper" ? "5 3" : "0"}
                onPointerDown={(e) => onPointerDown(e, el)}
                style={{ cursor: "pointer" }}
              />,
            );
          });
        }
        return;
      }
      const r = planRect(el, room);
      const isOpening = k.group === "opening";
      nodes.push(
        <g
          key={el.id}
          onPointerDown={(e) => onPointerDown(e, el)}
          style={{ cursor: "grab" }}
        >
          <rect
            x={sx(r.x)}
            y={syPlan(r.y)}
            width={r.w * scale}
            height={r.h * scale}
            rx={3}
            fill={
              isOpening
                ? "transparent"
                : k.group === "appliance"
                  ? `${theme.textMuted}22`
                  : `${theme.gold}1f`
            }
            stroke={
              isOpening ? theme.gold : isSel ? theme.gold : `${theme.text}55`
            }
            strokeWidth={isSel ? 2 : 1}
            strokeDasharray={
              isOpening ? "4 3" : k.plane === "upper" ? "5 3" : "0"
            }
          />
          {el.kind === "island" && (
            <IslandPlanModules
              island={el}
              x={r.x}
              y={r.y}
              sx={sx}
              syPlan={syPlan}
              scale={scale}
              theme={theme}
            />
          )}

          <text
            x={sx(r.x) + 3}
            y={syPlan(r.y) + 11}
            fill={theme.text}
            fontSize="8.5"
          >
            {shortLabel(el)}
          </text>
        </g>,
      );
    });
    // conflict hatches
    conflicts.forEach((c, i) =>
      nodes.push(
        <rect
          key={`cf${i}`}
          x={sx(c.x)}
          y={syPlan(c.y)}
          width={c.w * scale}
          height={c.h * scale}
          fill="#ef444433"
          stroke="#ef4444"
          strokeWidth={1}
          strokeDasharray="3 2"
        />,
      ),
    );
    return nodes;
  };

  const renderElevation = () => {
    const nodes = [];
    const len = wallLength(view, room);

    // corner cabinets that include this wall → hatched leg flush to corner
    elements.forEach((el) => {
      if (!KINDS[el.kind]?.corner) return;
      if (!CORNER_WALLS[el.corner]?.includes(view)) return;
      const leg = legOnWall(el, view);
      const end = CORNER_END[view]?.[el.corner];
      const x = end === "start" ? 0 : len - leg;
      const isSel = el.id === selectedId;
      const ey = syElev(el.plane === "upper" ? UPPER_BOTTOM : 0, el.height);
      nodes.push(
        <g
          key={`c_${el.id}`}
          onPointerDown={(e) => onPointerDown(e, el)}
          style={{ cursor: "pointer" }}
        >
          <rect
            x={sx(x)}
            y={ey}
            width={leg * scale}
            height={el.height * scale}
            rx={2}
            fill={`${theme.gold}18`}
            stroke={isSel ? theme.gold : `${theme.text}66`}
            strokeWidth={isSel ? 2 : 1.2}
          />
          <line
            x1={sx(x)}
            y1={ey}
            x2={sx(x) + leg * scale}
            y2={ey + el.height * scale}
            stroke={`${theme.gold}55`}
            strokeWidth={0.6}
          />
          <line
            x1={sx(x) + leg * scale}
            y1={ey}
            x2={sx(x)}
            y2={ey + el.height * scale}
            stroke={`${theme.gold}55`}
            strokeWidth={0.6}
          />
          <text
            x={sx(x) + (leg * scale) / 2}
            y={ey - 3}
            fill={theme.textMuted}
            fontSize="8"
            textAnchor="middle"
          >
            corner
          </text>
        </g>,
      );
    });

    // return strips: perpendicular-wall boxes sitting in this wall's corners
    elements.forEach((el) => {
      const k = KINDS[el.kind];
      if (
        !k ||
        k.corner ||
        k.group === "opening" ||
        el.wall === view ||
        el.kind === "island"
      )
        return;
      if (el.wall == null) return;
      const r = planRect(el, room);
      if (!touchesWallBand(view, r, room)) return;
      const e = planToElev(view, r, room);
      if (e.x + e.w < -1 || e.x > len + 1) return;
      const isUpper = k.plane === "upper";
      const yTop = isUpper ? el.y : 0;
      const hgt = el.height;
      nodes.push(
        <g key={`ret_${el.id}`}>
          <rect
            x={sx(clamp(e.x, 0, len))}
            y={syElev(yTop, hgt)}
            width={Math.max(2, e.w) * scale}
            height={hgt * scale}
            fill={`${theme.textMuted}14`}
            stroke={`${theme.textMuted}66`}
            strokeWidth={0.8}
            strokeDasharray="2 2"
          />
          <text
            x={sx(clamp(e.x, 0, len)) + 3}
            y={syElev(yTop, hgt) + 10}
            fill={theme.textMuted}
            fontSize="7.5"
          >
            return
          </text>
        </g>,
      );
    });

    // normal pieces on this wall
    elements.forEach((el) => {
      const k = KINDS[el.kind];
      if (!k || k.corner || el.wall !== view) return;
      const isSel = el.id === selectedId;
      const ex = sx(el.pos),
        ew = el.width * scale,
        ey = syElev(el.y, el.height),
        eh = el.height * scale;
      const isCab = k.group === "cabinet";
      nodes.push(
        <g
          key={el.id}
          onPointerDown={(e) => onPointerDown(e, el)}
          style={{ cursor: "grab" }}
        >
          <rect
            x={ex}
            y={ey}
            width={ew}
            height={eh}
            rx={2}
            fill={
              k.group === "opening"
                ? "transparent"
                : k.group === "appliance"
                  ? `${theme.textMuted}1c`
                  : `${theme.gold}14`
            }
            stroke={
              k.group === "opening"
                ? theme.gold
                : isSel
                  ? theme.gold
                  : `${theme.text}55`
            }
            strokeWidth={isSel ? 2 : 1}
            strokeDasharray={k.group === "opening" ? "4 3" : "0"}
          />
          {isCab && eh > 16 && (
            <CabinetFace
              x={ex}
              y={ey}
              w={ew}
              h={eh}
              el={el}
              color={cfg.finish?.cabinetColor}
            />
          )}
          {k.group === "appliance" && (
            <ApplianceGlyph
              kind={el.kind}
              x={ex}
              y={ey}
              w={ew}
              h={eh}
              theme={theme}
              variant={el.config?.hoodVariant || "standalone"}
            />
          )}
          <text
            x={ex + ew / 2}
            y={ey - 3}
            fill={theme.textMuted}
            fontSize="8"
            textAnchor="middle"
          >
            {el.width}"
          </text>
        </g>,
      );
    });
    return nodes;
  };

  const renderIslandElevation = () => {
    const nodes = [];
    const island = selectedIsland;
    if (!island) {
      nodes.push(
        <text
          key="empty"
          x={sx(contentW / 2)}
          y={syElev(islandContentH / 2, 0)}
          fill={theme.textMuted}
          fontSize="11"
          textAnchor="middle"
        >
          No island selected — add or select an island first.
        </text>,
      );
      return nodes;
    }
    const mods = islandSideModules(island, islandSide);
    if (!mods.length) {
      nodes.push(
        <text
          key="empty"
          x={sx(contentW / 2)}
          y={syElev(islandContentH / 2, 0)}
          fill={theme.textMuted}
          fontSize="11"
          textAnchor="middle"
        >
          No cabinets on the {islandSide} side yet — add some below.
        </text>,
      );
      return nodes;
    }
    let cursor = 0;
    mods.forEach((m) => {
      const h = m.height || BASE_HEIGHT;
      const faceEl = {
        kind: m.kind,
        width: m.width,
        height: h,
        depth: m.depth,
        config: m.config || {},
      };
      const ex = sx(cursor),
        ew = (m.width || 0) * scale,
        ey = syElev(0, h),
        eh = h * scale;
      nodes.push(
        <g
          key={m.id}
          onPointerDown={(e) => {
            e.stopPropagation();
            setSelectedId(island.id);
          }}
          style={{ cursor: "pointer" }}
        >
          <rect
            x={ex}
            y={ey}
            width={ew}
            height={eh}
            rx={2}
            fill={`${theme.gold}14`}
            stroke={`${theme.text}55`}
            strokeWidth={1}
          />
          {eh > 16 && (
            <CabinetFace
              x={ex}
              y={ey}
              w={ew}
              h={eh}
              el={faceEl}
              color={cfg.finish?.cabinetColor}
            />
          )}
          <text
            x={ex + ew / 2}
            y={ey - 3}
            fill={theme.textMuted}
            fontSize="8"
            textAnchor="middle"
          >
            {m.width}"
          </text>
        </g>,
      );
      cursor += m.width || 0;
    });
    return nodes;
  };

  return (
    <div style={{ color: theme.text, fontFamily: "ui-sans-serif, system-ui" }}>
      {/* room dims */}
      {/* wall dimensions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
          gap: "0.6rem",
          marginBottom: "0.8rem",
        }}
      >
        {WALLS.map((w) => (
          <div
            key={w.id}
            style={{
              border: `1px solid ${theme.border}`,
              borderRadius: "0.65rem",
              padding: "0.55rem",
              background: `${theme.text}06`,
            }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                color: theme.gold,
                fontWeight: 700,
                marginBottom: "0.35rem",
              }}
            >
              {w.label}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "0.45rem",
              }}
            >
              <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
                Length
                <input
                  type="number"
                  inputMode="numeric"
                  // setRoom is guarded, so typing here would already do nothing.
                  // Disabled as well: a field that accepts keystrokes and
                  // discards them reads as a bug, not as a closed quote.
                  disabled={readOnly}
                  value={wallLength(w.id, room)}
                  onChange={(e) => {
                    const length = Math.max(12, parseInt(e.target.value) || 0);

                    setRoomDim({
                      walls: {
                        ...(room.walls || {}),
                        [w.id]: {
                          ...(room.walls?.[w.id] || {}),
                          length,
                          ceiling: wallCeiling(w.id, room),
                        },
                      },
                      width:
                        w.id === "A" || w.id === "C"
                          ? Math.max(
                              length,
                              room.walls?.[w.id === "A" ? "C" : "A"]?.length ||
                                room.width ||
                                12,
                            )
                          : room.width,
                      depth:
                        w.id === "B" || w.id === "D"
                          ? Math.max(
                              length,
                              room.walls?.[w.id === "B" ? "D" : "B"]?.length ||
                                room.depth ||
                                12,
                            )
                          : room.depth,
                    });
                  }}
                  style={inputStyle(theme)}
                />
              </label>

              <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
                Height
                <input
                  type="number"
                  inputMode="numeric"
                  disabled={readOnly}
                  value={wallCeiling(w.id, room)}
                  onChange={(e) => {
                    const ceiling = Math.max(12, parseInt(e.target.value) || 0);

                    setRoomDim({
                      walls: {
                        ...(room.walls || {}),
                        [w.id]: {
                          ...(room.walls?.[w.id] || {}),
                          length: wallLength(w.id, room),
                          ceiling,
                        },
                      },
                      ceiling,
                    });
                  }}
                  style={inputStyle(theme)}
                />
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* view tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          flexWrap: "wrap",
          marginBottom: "0.7rem",
        }}
      >
        <ViewTab
          active={view === "plan"}
          onClick={() => setView("plan")}
          theme={theme}
        >
          <Maximize2 size={13} /> Plan
        </ViewTab>
        {WALLS.map((w) => (
          <ViewTab
            key={w.id}
            active={view === w.id}
            onClick={() => setView(w.id)}
            theme={theme}
          >
            {w.short}
          </ViewTab>
        ))}
        {elements.some((e) => e.kind === "island") && (
          <ViewTab
            active={view === "island"}
            onClick={() => setView("island")}
            theme={theme}
          >
            <Box size={13} /> Island Layout
          </ViewTab>
        )}
      </div>
      {/* Paint colour — drives every door and drawer fill live.

          Hidden when read-only for the same reason as the palette: setCfg is
          guarded, so these swatches would change nothing. On a closed quote the
          colour shown IS the colour agreed. */}
      {!readOnly && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: "0.7rem",
        }}
      >
        <span style={{ fontSize: "0.7rem", color: theme.textMuted }}>
          Paint colour:
        </span>
        {[
          ["Chantilly Lace", "#F4F4EF"],
          ["Classic White", "#EDE8DD"],
          ["Sage", "#9AA487"],
          ["Navy", "#2E3B4E"],
          ["Charcoal", "#3A3A3A"],
          ["Taupe", "#B9A98F"],
          ["Espresso", "#4A3B30"],
          ["Gold", "#bd9d60"],
        ].map(([name, hex]) => (
          <button
            key={hex}
            type="button"
            title={name}
            onClick={() =>
              patchCfg({ finish: { ...cfg.finish, cabinetColor: hex } })
            }
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              cursor: "pointer",
              background: hex,
              border: `2px solid ${
                cfg.finish?.cabinetColor === hex ? theme.gold : theme.border
              }`,
            }}
          />
        ))}
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.7rem",
            color: theme.textMuted,
          }}
        >
          Custom
          <input
            type="color"
            value={cfg.finish?.cabinetColor || "#EDE8DD"}
            onChange={(e) =>
              patchCfg({
                finish: { ...cfg.finish, cabinetColor: e.target.value },
              })
            }
            style={{
              width: 30,
              height: 26,
              border: "none",
              background: "transparent",
              cursor: "pointer",
            }}
          />
          <input
            type="text"
            value={cfg.finish?.cabinetColor || ""}
            onChange={(e) => {
              let v = e.target.value.trim();
              if (v && !v.startsWith("#")) v = "#" + v;
              patchCfg({ finish: { ...cfg.finish, cabinetColor: v } });
            }}
            placeholder="#EDE8DD"
            style={{
              width: 84,
              padding: "0.35rem 0.5rem",
              borderRadius: 6,
              border: `1px solid ${theme.border}`,
              background: `${theme.text}0d`,
              color: theme.text,
              fontSize: "0.8rem",
            }}
          />
        </label>
      </div>
      )}
      {islandView && selectedIsland && (
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginBottom: "0.7rem",
          }}
        >
          <span
            style={{
              fontSize: "0.7rem",
              color: theme.textMuted,
              alignSelf: "center",
            }}
          >
            Island side:
          </span>
          {["front", "back", "left", "right"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setIslandSide(s)}
              style={{
                ...miniToggle(theme, islandSide === s),
                textTransform: "capitalize",
              }}
            >
              {s} ({islandSideModules(selectedIsland, s).length})
            </button>
          ))}
        </div>
      )}

      {/* palette — grouped, horizontally scrollable on phones.

          Hidden when read-only. The setters are guarded above, so leaving it
          visible would be a row of buttons that do nothing — which is worse
          than not offering them: the person clicking concludes the app is
          broken rather than that the quote is closed. The banner on the page
          above says why. */}
      {!readOnly && (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          marginBottom: "0.7rem",
        }}
      >
        {PALETTE_GROUPS.map((g) => (
          <div
            key={g.title}
            style={{
              display: "flex",
              gap: "0.35rem",
              alignItems: "center",
              overflowX: "auto",
              paddingBottom: 2,
            }}
          >
            <span
              style={{
                fontSize: "0.6rem",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: theme.textMuted,
                minWidth: 54,
                flexShrink: 0,
              }}
            >
              {g.title}
            </span>
            {g.kinds.map((kind) => {
              const K = KINDS[kind];
              const Icon = K.icon || Box;
              return (
                <button
                  key={kind}
                  type="button"
                  onClick={() => add(kind)}
                  style={chipBtn(theme)}
                  title={`Add ${K.label}`}
                >
                  <Icon size={13} /> {K.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      )}

      {/* drawing surface */}
      <div
        ref={wrapRef}
        style={{
          border: `1px solid ${theme.border}`,
          borderRadius: "0.9rem",
          background:
            `repeating-linear-gradient(0deg,#0000 0 23px,${grid} 23px 24px),` +
            `repeating-linear-gradient(90deg,#0000 0 23px,${grid} 23px 24px),` +
            surfaceSoft,
          overflow: "hidden",
          touchAction: "none",
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width="100%"
          height={VIEW_H}
          style={{ display: "block", touchAction: "none" }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerDown={() => setSelectedId(null)}
        >
          {view === "plan" ? (
            <rect
              x={sx(0)}
              y={syPlan(0)}
              width={planWidth(room) * scale}
              height={planDepth(room) * scale}
              fill="none"
              stroke={theme.textMuted}
              strokeWidth={2}
            />
          ) : islandView ? (
            <line
              x1={sx(0)}
              y1={syElev(0, 0)}
              x2={sx(contentW)}
              y2={syElev(0, 0)}
              stroke={theme.textMuted}
              strokeWidth={2}
            />
          ) : (
            <>
              <rect
                x={sx(0)}
                y={syElev(0, wallCeiling(view, room))}
                width={contentW * scale}
                height={wallCeiling(view, room) * scale}
                fill="none"
                stroke={theme.textMuted}
                strokeWidth={2}
              />
              {[
                [COUNTER_HEIGHT, 'counter 36"'],
                [UPPER_BOTTOM, 'uppers 54"'],
              ].map(([hLine, lab]) => (
                <g key={lab}>
                  <line
                    x1={sx(0)}
                    y1={syElev(hLine, 0)}
                    x2={sx(contentW)}
                    y2={syElev(hLine, 0)}
                    stroke={theme.gold}
                    strokeWidth={0.5}
                    strokeDasharray="3 4"
                    opacity={0.5}
                  />
                  <text
                    x={sx(contentW) - 2}
                    y={syElev(hLine, 0) - 2}
                    fill={theme.gold}
                    fontSize="7.5"
                    textAnchor="end"
                    opacity={0.7}
                  >
                    {lab}
                  </text>
                </g>
              ))}
            </>
          )}
          {view === "plan"
            ? renderPlan()
            : islandView
              ? renderIslandElevation()
              : renderElevation()}
          <text
            x={sx(contentW / 2)}
            y={VIEW_H - 6}
            fill={theme.textMuted}
            fontSize="9"
            textAnchor="middle"
          >
            {view === "plan"
              ? `${planWidth(room)}" × ${planDepth(room)}"`
              : islandView
                ? `Island — ${islandSide} elevation`
                : `${WALLS.find((w) => w.id === view)?.label} — ${contentW}"W × ${wallCeiling(view, room)}"H`}
          </text>
        </svg>
      </div>

      {/* editor */}
      {selected ? (
        <ElementEditor
          el={selected}
          theme={theme}
          room={room}
          rates={rates}
          onUpdate={(patch) => update(selected.id, patch)}
          onConfig={(patch) => updateConfig(selected.id, patch)}
          onRemove={() => remove(selected.id)}
          pricing={priceItem(selected)}
        />
      ) : (
        <p
          style={{
            color: theme.textMuted,
            fontSize: "0.78rem",
            marginTop: "0.7rem",
          }}
        >
          <Move
            size={12}
            style={{ display: "inline", verticalAlign: "-2px" }}
          />{" "}
          Tap a piece to select, then drag. Boxes snap flush to walls, corners
          &amp; each other. Red hatch = two boxes overlapping a corner (add a
          corner cabinet).
        </p>
      )}

      {/* ── Pricing & modules ───────────────────────────────────────────────
          Hidden entirely in clientMode, and not merely collapsed.

          This panel is the company's RATE CARD — dollars per linear foot per
          tier, material multipliers, install and finishing rates. AGENTS.md §4
          is explicit that public surfaces never return prices: publishing a rate
          card openly hands it to every competitor in the city, and the client
          designer is reachable by anyone holding a share link.

          The homeowner is not left guessing. They are choosing layout and
          finish; the contractor reprices from the company's own rates and sends
          an updated quote, which is the document where a number belongs. */}
      {!clientMode && (
      <div
        style={{
          marginTop: "1rem",
          border: `1px solid ${theme.border}`,
          borderRadius: "0.9rem",
          overflow: "hidden",
        }}
      >
        <button
          type="button"
          onClick={() => setShowPricing((s) => !s)}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.7rem 0.9rem",
            background: `${theme.text}08`,
            border: "none",
            color: theme.text,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: "0.9rem",
          }}
        >
          <DollarSign size={15} style={{ color: theme.gold }} />
          Pricing &amp; modules
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.78rem",
              color: theme.textMuted,
              fontWeight: 400,
            }}
          >
            {breakdown.linearFeet} lf · ${breakdown.total.toFixed(0)}
          </span>
          <ChevronRight
            size={15}
            style={{
              transform: showPricing ? "rotate(90deg)" : "none",
              transition: "transform 0.2s",
              color: theme.textMuted,
            }}
          />
        </button>
        {showPricing && (
          <PricingPanel
            theme={theme}
            cfg={cfg}
            rates={rates}
            breakdown={breakdown}
            faceCounts={countKitchenFaces(elements)}
            patchRates={patchRates}
            patchModules={patchModules}
            patchCfg={patchCfg}
          />
        )}
      </div>
      )}

      {/* breakdown footer — money, so equally not for the client view */}
      {!clientMode && (
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          gap: "1rem",
          flexWrap: "wrap",
          padding: "0.75rem 1rem",
          background: `${theme.gold}10`,
          border: `1px solid ${theme.gold}33`,
          borderRadius: "0.75rem",
        }}
      >
        <Tot
          label={`Cabinetry (${breakdown.linearFeet} lf)`}
          v={breakdown.cabinetry}
          theme={theme}
        />
        {breakdown.install > 0 && (
          <Tot label="Install" v={breakdown.install} theme={theme} />
        )}
        {breakdown.appliances > 0 && (
          <Tot label="Appliances" v={breakdown.appliances} theme={theme} />
        )}
        {breakdown.accessories > 0 && (
          <Tot label="Accessories" v={breakdown.accessories} theme={theme} />
        )}
        {breakdown.refinish > 0 && (
          <Tot label="Finishing" v={breakdown.refinish} theme={theme} />
        )}
        {breakdown.countertop > 0 && (
          <Tot label="Countertop" v={breakdown.countertop} theme={theme} />
        )}
        {breakdown.logistics > 0 && (
          <Tot label="Delivery/removal" v={breakdown.logistics} theme={theme} />
        )}
        <div style={{ flex: 1, minWidth: 8 }} />
        <Tot label="Quote subtotal" v={breakdown.total} theme={theme} big />
      </div>
      )}
    </div>
  );
}

/* ─────────────────────────── pricing panel ────────────────────────────── */
function PricingPanel({
  theme,
  cfg,
  rates,
  breakdown,
  faceCounts,
  patchRates,
  patchModules,
  patchCfg,
}) {
  const perLf = (rates.cabinetPricingMode || "perLinearFt") === "perLinearFt";
  const m = cfg.modules || {};
  const Row = ({ children }) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
        gap: "0.55rem",
        marginBottom: "0.7rem",
      }}
    >
      {children}
    </div>
  );
  const Money = ({ label, k, step = 5 }) => (
    <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
      {label}
      <input
        type="number"
        inputMode="decimal"
        step={step}
        value={rates[k]}
        onChange={(e) => patchRates({ [k]: parseFloat(e.target.value) || 0 })}
        style={inputStyle(theme)}
      />
    </label>
  );
  const Toggle = ({ on, onClick, children }) => (
    <button
      type="button"
      onClick={onClick}
      style={{ ...miniToggle(theme, on), marginRight: 6 }}
    >
      {children}
    </button>
  );

  return (
    <div
      style={{
        padding: "0.9rem",
        background: `${theme.text}05`,
        borderTop: `1px solid ${theme.border}`,
      }}
    >
      {/* mode */}
      <div style={{ marginBottom: "0.7rem" }}>
        <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
          Cabinet pricing:&nbsp;
        </span>
        <Toggle
          on={perLf}
          onClick={() => patchRates({ cabinetPricingMode: "perLinearFt" })}
        >
          Per linear ft
        </Toggle>
        <Toggle
          on={!perLf}
          onClick={() => patchRates({ cabinetPricingMode: "material" })}
        >
          Material cost-plus
        </Toggle>
      </div>

      {perLf ? (
        <>
          <Row>
            <Money label="Base $/lf" k="lfBase" />
            <Money label="Upper $/lf" k="lfUpper" />
            <Money label="Tall $/lf" k="lfTall" />
            <Money label="Island $/lf" k="lfIsland" />
            <Money label="Drawer surcharge $" k="drawerSurcharge" />
          </Row>
          <label
            style={{
              fontSize: "0.74rem",
              color: theme.text,
              display: "flex",
              alignItems: "center",
              gap: 5,
              marginBottom: "0.7rem",
            }}
          >
            <input
              type="checkbox"
              checked={rates.installIncludedInLf !== false}
              onChange={(e) =>
                patchRates({ installIncludedInLf: e.target.checked })
              }
            />
            Install included in the linear-foot rate
          </label>
        </>
      ) : (
        <Row>
          <Money label="Material markup %" k="materialMarkup" step={0.01} />
          <Money label="Install / box $" k="installPerBox" />
          <Money label="Corner premium ×" k="cornerPremium" step={0.05} />
        </Row>
      )}

      {/* modules */}
      <div
        style={{ borderTop: `1px solid ${theme.border}`, paddingTop: "0.7rem" }}
      >
        <p
          style={{
            fontSize: "0.68rem",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: theme.textMuted,
            margin: "0 0 0.5rem",
          }}
        >
          Add to this quote
        </p>
        <div style={{ marginBottom: "0.6rem" }}>
          <Toggle
            on={!!m.delivery}
            onClick={() => patchModules({ delivery: !m.delivery })}
          >
            Delivery
          </Toggle>
          <Toggle
            on={!!m.removeOld}
            onClick={() => patchModules({ removeOld: !m.removeOld })}
          >
            Remove old
          </Toggle>
          <Toggle
            on={!!m.refinish}
            onClick={() => patchModules({ refinish: !m.refinish })}
          >
            Custom Finish
          </Toggle>
          <Toggle
            on={!!m.countertop}
            onClick={() => patchModules({ countertop: !m.countertop })}
          >
            Countertop
          </Toggle>
        </div>

        {m.delivery && (
          <Row>
            <Money label="Delivery flat $" k="deliveryFlat" />
            <Money label="Removal $/box" k="removalPerBox" />
          </Row>
        )}

        {m.refinish &&
          (() => {
            const manual = cfg.refinish?.mode === "manual";
            const doors = manual
              ? cfg.refinish.doors || 0
              : faceCounts?.doors || 0;
            const drawers = manual
              ? cfg.refinish.drawers || 0
              : faceCounts?.drawers || 0;
            const finishTotal =
              doors * (rates.refinishPerDoor || 0) +
              drawers * (rates.refinishPerDrawer || 0);
            return (
              <div
                style={{
                  marginBottom: "0.6rem",
                  border: `1px solid ${theme.gold}40`,
                  background: `${theme.gold}10`,
                  borderRadius: "0.7rem",
                  padding: "0.7rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  <strong style={{ color: theme.gold, fontSize: "0.85rem" }}>
                    Custom Finish
                  </strong>
                  <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                    strip · prime · spray colour, per piece
                  </span>
                </div>
                {/* doors / drawers / total — same shape as your refinish scope cards */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "0.5rem",
                    marginBottom: "0.6rem",
                  }}
                >
                  <FinishStat theme={theme} label="Doors" value={doors} />
                  <FinishStat theme={theme} label="Drawers" value={drawers} />
                  <FinishStat
                    theme={theme}
                    label="Finish total"
                    value={`$${finishTotal.toFixed(0)}`}
                    accent
                  />
                </div>
                <Row>
                  <Money label="$ / door" k="refinishPerDoor" />
                  <Money label="$ / drawer" k="refinishPerDrawer" />
                </Row>
                <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                  Count:&nbsp;
                </span>
                <Toggle
                  on={!manual}
                  onClick={() =>
                    patchCfg({ refinish: { ...cfg.refinish, mode: "auto" } })
                  }
                >
                  Auto from layout
                </Toggle>
                <Toggle
                  on={manual}
                  onClick={() =>
                    patchCfg({ refinish: { ...cfg.refinish, mode: "manual" } })
                  }
                >
                  Manual
                </Toggle>
                {manual && (
                  <Row>
                    <label
                      style={{ fontSize: "0.7rem", color: theme.textMuted }}
                    >
                      Doors
                      <input
                        type="number"
                        value={cfg.refinish.doors}
                        onChange={(e) =>
                          patchCfg({
                            refinish: {
                              ...cfg.refinish,
                              doors: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        style={inputStyle(theme)}
                      />
                    </label>
                    <label
                      style={{ fontSize: "0.7rem", color: theme.textMuted }}
                    >
                      Drawers
                      <input
                        type="number"
                        value={cfg.refinish.drawers}
                        onChange={(e) =>
                          patchCfg({
                            refinish: {
                              ...cfg.refinish,
                              drawers: parseInt(e.target.value) || 0,
                            },
                          })
                        }
                        style={inputStyle(theme)}
                      />
                    </label>
                  </Row>
                )}
              </div>
            );
          })()}

        {m.countertop && (
          <Row>
            <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
              Sqft
              <input
                type="number"
                value={cfg.countertop.sqft}
                onChange={(e) =>
                  patchCfg({
                    countertop: {
                      ...cfg.countertop,
                      sqft: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                style={inputStyle(theme)}
              />
            </label>
            <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
              Material $/sqft
              <input
                type="number"
                value={cfg.countertop.materialPerSqft}
                onChange={(e) =>
                  patchCfg({
                    countertop: {
                      ...cfg.countertop,
                      materialPerSqft: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                style={inputStyle(theme)}
              />
            </label>
            <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
              Fab+install $/sqft
              <input
                type="number"
                value={cfg.countertop.fabInstallPerSqft}
                onChange={(e) =>
                  patchCfg({
                    countertop: {
                      ...cfg.countertop,
                      fabInstallPerSqft: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                style={inputStyle(theme)}
              />
            </label>
            <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
              Edge ft
              <input
                type="number"
                value={cfg.countertop.edgeFt}
                onChange={(e) =>
                  patchCfg({
                    countertop: {
                      ...cfg.countertop,
                      edgeFt: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                style={inputStyle(theme)}
              />
            </label>
          </Row>
        )}

        <KitchenAccessoryPicker theme={theme} cfg={cfg} patchCfg={patchCfg} />
      </div>
    </div>
  );
}

/* ───────────────────────────── subcomponents ──────────────────────────── */

function IslandPlanModules({ island, x, y, sx, syPlan, scale, theme }) {
  const W = islandTotalWidth(island);
  const D = islandTotalDepth(island);

  const front = islandFrontModules(island);
  const back = islandBackModules(island);
  const left = islandLeftModules(island);
  const right = islandRightModules(island);

  const nodes = [];

  let cursor = 0;
  front.forEach((m) => {
    const mw = m.width || 24;
    const md = m.depth || 24;

    nodes.push(
      <g key={m.id}>
        <rect
          x={sx(x + cursor)}
          y={syPlan(y + D - md)}
          width={mw * scale}
          height={md * scale}
          fill={`${theme.gold}18`}
          stroke={`${theme.gold}88`}
          strokeWidth={0.8}
        />
        <line
          x1={sx(x + cursor)}
          y1={syPlan(y + D)}
          x2={sx(x + cursor + mw)}
          y2={syPlan(y + D)}
          stroke={theme.gold}
          strokeWidth={1.4}
        />
      </g>,
    );

    cursor += mw;
  });

  cursor = 0;
  back.forEach((m) => {
    const mw = m.width || 24;
    const md = m.depth || 24;

    nodes.push(
      <g key={m.id}>
        <rect
          x={sx(x + cursor)}
          y={syPlan(y)}
          width={mw * scale}
          height={md * scale}
          fill={`${theme.textMuted}18`}
          stroke={`${theme.textMuted}88`}
          strokeWidth={0.8}
        />
        <line
          x1={sx(x + cursor)}
          y1={syPlan(y)}
          x2={sx(x + cursor + mw)}
          y2={syPlan(y)}
          stroke={theme.gold}
          strokeWidth={1.4}
        />
      </g>,
    );

    cursor += mw;
  });

  cursor = 0;
  left.forEach((m) => {
    const mw = m.width || 24;
    const md = m.depth || 24;

    nodes.push(
      <g key={m.id}>
        <rect
          x={sx(x)}
          y={syPlan(y + cursor)}
          width={md * scale}
          height={mw * scale}
          fill={`${theme.gold}12`}
          stroke={`${theme.gold}88`}
          strokeWidth={0.8}
        />
        <line
          x1={sx(x)}
          y1={syPlan(y + cursor)}
          x2={sx(x)}
          y2={syPlan(y + cursor + mw)}
          stroke={theme.gold}
          strokeWidth={1.4}
        />
      </g>,
    );

    cursor += mw;
  });

  cursor = 0;
  right.forEach((m) => {
    const mw = m.width || 24;
    const md = m.depth || 24;

    nodes.push(
      <g key={m.id}>
        <rect
          x={sx(x + W - md)}
          y={syPlan(y + cursor)}
          width={md * scale}
          height={mw * scale}
          fill={`${theme.gold}12`}
          stroke={`${theme.gold}88`}
          strokeWidth={0.8}
        />
        <line
          x1={sx(x + W)}
          y1={syPlan(y + cursor)}
          x2={sx(x + W)}
          y2={syPlan(y + cursor + mw)}
          stroke={theme.gold}
          strokeWidth={1.4}
        />
      </g>,
    );

    cursor += mw;
  });

  return <>{nodes}</>;
}

function KitchenAccessoryPicker({ theme, cfg, patchCfg }) {
  const [open, setOpen] = useState(false);
  const [openCats, setOpenCats] = useState({});
  const current = cfg.accessories || [];

  const qtyOf = (id) => current.find((a) => a.id === id)?.quantity || 0;
  const setQty = (item, q) => {
    const qty = Math.max(0, q);
    const others = current.filter((a) => a.id !== item.id);
    patchCfg({
      accessories:
        qty > 0
          ? [
              ...others,
              {
                id: item.id,
                name: item.name,
                unit: item.unit,
                price: item.price,
                quantity: qty,
              },
            ]
          : others,
    });
  };

  // group preserving catalog order
  const cats = [];
  KITCHEN_ACCESSORIES.forEach((a) => {
    const c = a.category || "Other";
    if (!cats.includes(c)) cats.push(c);
  });

  const accTotal = current.reduce(
    (s, a) => s + (a.price || 0) * (a.quantity || 0),
    0,
  );
  const accCount = current.reduce((s, a) => s + (a.quantity || 0), 0);

  const stepBtn = {
    width: 26,
    height: 26,
    borderRadius: 6,
    border: `1px solid ${theme.border}`,
    background: "transparent",
    color: theme.text,
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    lineHeight: 1,
    flexShrink: 0,
  };

  return (
    <div
      style={{
        marginTop: "0.8rem",
        border: `1px solid ${theme.border}`,
        borderRadius: "0.75rem",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          padding: "0.7rem 0.9rem",
          background: `${theme.text}06`,
          border: "none",
          color: theme.text,
          cursor: "pointer",
          fontWeight: 700,
          fontSize: "0.86rem",
        }}
      >
        Storage &amp; accessories
        <span
          style={{
            marginLeft: "auto",
            fontSize: "0.76rem",
            color: theme.textMuted,
            fontWeight: 400,
          }}
        >
          {accCount > 0
            ? `${accCount} item${accCount !== 1 ? "s" : ""} · $${accTotal.toFixed(0)}`
            : "none added"}
        </span>
        <span
          style={{
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform .2s",
            color: theme.textMuted,
          }}
        >
          ›
        </span>
      </button>

      {open && (
        <div
          style={{
            padding: "0.6rem 0.8rem",
            borderTop: `1px solid ${theme.border}`,
            background: `${theme.text}03`,
          }}
        >
          <p
            style={{
              fontSize: "0.7rem",
              color: theme.textMuted,
              margin: "0 0 0.6rem",
            }}
          >
            Add-ons attach to the quote with a quantity — they aren't drawn on
            the layout. Prices are supply cost; adjust as needed.
          </p>

          {cats.map((cat) => {
            const items = KITCHEN_ACCESSORIES.filter(
              (a) => (a.category || "Other") === cat,
            );
            const catCount = items.reduce((s, it) => s + qtyOf(it.id), 0);
            const isOpen = openCats[cat] ?? false;
            return (
              <div
                key={cat}
                style={{
                  marginBottom: "0.5rem",
                  border: `1px solid ${theme.border}`,
                  borderRadius: "0.6rem",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => setOpenCats((m) => ({ ...m, [cat]: !isOpen }))}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.5rem 0.7rem",
                    background: "transparent",
                    border: "none",
                    color: theme.text,
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.8rem",
                  }}
                >
                  {cat}
                  {catCount > 0 && (
                    <span
                      style={{
                        background: `${theme.gold}22`,
                        color: theme.gold,
                        borderRadius: 999,
                        fontSize: "0.66rem",
                        fontWeight: 800,
                        padding: "0.05rem 0.4rem",
                      }}
                    >
                      {catCount}
                    </span>
                  )}
                  <span
                    style={{
                      marginLeft: "auto",
                      transform: isOpen ? "rotate(90deg)" : "none",
                      transition: "transform .2s",
                      color: theme.textMuted,
                    }}
                  >
                    ›
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: "0.2rem 0.6rem 0.5rem" }}>
                    {items.map((item) => {
                      const q = qtyOf(item.id);
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.6rem",
                            padding: "0.4rem 0",
                            borderTop: `1px solid ${theme.border}40`,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "0.78rem",
                                color: theme.text,
                                fontWeight: q > 0 ? 700 : 500,
                              }}
                            >
                              {item.name}
                            </div>
                            <div
                              style={{
                                fontSize: "0.68rem",
                                color: theme.textMuted,
                              }}
                            >
                              ${item.price.toFixed(2)} / {item.unit}
                            </div>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <button
                              type="button"
                              style={stepBtn}
                              onClick={() => setQty(item, q - 1)}
                              disabled={q === 0}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              inputMode="numeric"
                              value={q}
                              onChange={(e) =>
                                setQty(item, parseInt(e.target.value) || 0)
                              }
                              style={{
                                width: 44,
                                textAlign: "center",
                                padding: "0.35rem 0.2rem",
                                borderRadius: 6,
                                border: `1px solid ${theme.border}`,
                                background: `${theme.text}0d`,
                                color: theme.text,
                                fontSize: "0.85rem",
                              }}
                            />
                            <button
                              type="button"
                              style={stepBtn}
                              onClick={() => setQty(item, q + 1)}
                            >
                              +
                            </button>
                          </div>
                          <div
                            style={{
                              width: 56,
                              textAlign: "right",
                              fontSize: "0.78rem",
                              fontWeight: 700,
                              color: q > 0 ? theme.gold : theme.textMuted,
                            }}
                          >
                            ${(item.price * q).toFixed(0)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {accCount > 0 && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.5rem",
                paddingTop: "0.5rem",
                borderTop: `1px solid ${theme.border}`,
              }}
            >
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: theme.text,
                }}
              >
                Accessories subtotal
              </span>
              <span
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  color: theme.gold,
                }}
              >
                ${accTotal.toFixed(2)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
function IslandModuleEditor({ el, theme, onConfig }) {
  const modules = el.config?.modules || [];

  const updateModule = (moduleId, patch) => {
    onConfig({
      modules: modules.map((m) => (m.id === moduleId ? { ...m, ...patch } : m)),
    });
  };

  const updateModuleConfig = (moduleId, patch) => {
    onConfig({
      modules: modules.map((m) =>
        m.id === moduleId
          ? {
              ...m,
              config: {
                ...m.config,
                ...patch,
              },
            }
          : m,
      ),
    });
  };

  const addModule = (kind, side = "front") => {
    const base = KINDS[kind];

    onConfig({
      modules: [
        ...modules,
        {
          id: uid(),
          kind,
          width: base?.w || 24,
          depth: base?.d || 24,
          height: base?.h || BASE_HEIGHT,
          side,
          config: defaultCabinetConfig(kind),
        },
      ],
    });
  };

  const removeModule = (moduleId) => {
    onConfig({ modules: modules.filter((m) => m.id !== moduleId) });
  };

  // Move a module earlier/later among the modules ON ITS OWN SIDE,
  // so the visual order on Front/Back/Left/Right reflects the list order.
  const moveModule = (moduleId, dir) => {
    const target = modules.find((m) => m.id === moduleId);
    if (!target) return;
    const side = target.side || "front";
    const sideIds = modules
      .filter((m) => (m.side || "front") === side)
      .map((m) => m.id);
    const pos = sideIds.indexOf(moduleId);
    const swapWith = sideIds[pos + dir];
    if (swapWith == null) return; // already at an edge
    const next = [...modules];
    const a = next.findIndex((m) => m.id === moduleId);
    const b = next.findIndex((m) => m.id === swapWith);
    [next[a], next[b]] = [next[b], next[a]];
    onConfig({ modules: next });
  };

  const frontWidth = islandSideRun(
    modules.filter((m) => (m.side || "front") === "front"),
  );

  const backWidth = islandSideRun(modules.filter((m) => m.side === "back"));
  const leftWidth = islandSideRun(modules.filter((m) => m.side === "left"));
  const rightWidth = islandSideRun(modules.filter((m) => m.side === "right"));

  return (
    <div
      style={{
        marginTop: "0.8rem",
        border: `1px solid ${theme.gold}40`,
        borderRadius: "0.75rem",
        padding: "0.75rem",
        background: `${theme.gold}0d`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "0.5rem",
          alignItems: "center",
          marginBottom: "0.65rem",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ color: theme.gold, fontSize: "0.86rem" }}>
          Island layout
        </strong>

        <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
          Front {frontWidth}" · Back {backWidth}" · Left {leftWidth}" · Right{" "}
          {rightWidth}"
        </span>
      </div>

      <div style={{ display: "grid", gap: "0.55rem" }}>
        {["front", "back", "left", "right"].map((side) => (
          <div key={side}>
            <span
              style={{
                fontSize: "0.68rem",
                color: theme.textMuted,
                textTransform: "uppercase",
                marginRight: 6,
              }}
            >
              {side}
            </span>

            <button
              type="button"
              onClick={() => addModule("base", side)}
              style={chipBtn(theme)}
            >
              + Base
            </button>

            <button
              type="button"
              onClick={() => addModule("drawerBase", side)}
              style={chipBtn(theme)}
            >
              + Drawer
            </button>

            <button
              type="button"
              onClick={() => addModule("sinkBase", side)}
              style={chipBtn(theme)}
            >
              + Sink
            </button>

            <button
              type="button"
              onClick={() => addModule("spiceBase", side)}
              style={chipBtn(theme)}
            >
              + Spice
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.55rem" }}>
        {modules.map((m, index) => (
          <div
            key={m.id}
            style={{
              border: `1px solid ${theme.border}`,
              borderRadius: "0.6rem",
              padding: "0.6rem",
              background: `${theme.text}08`,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "0.5rem",
                alignItems: "center",
                marginBottom: "0.5rem",
              }}
            >
              <strong style={{ fontSize: "0.78rem", color: theme.text }}>
                {index + 1}. {KINDS[m.kind]?.label || m.kind}
                <span
                  style={{
                    color: theme.textMuted,
                    fontWeight: 400,
                    marginLeft: 6,
                    textTransform: "capitalize",
                  }}
                >
                  · {m.side || "front"}
                </span>
              </strong>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => moveModule(m.id, -1)}
                  style={{
                    ...miniToggle(theme, false),
                    padding: "0.25rem 0.5rem",
                  }}
                  title="Move earlier"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => moveModule(m.id, 1)}
                  style={{
                    ...miniToggle(theme, false),
                    padding: "0.25rem 0.5rem",
                  }}
                  title="Move later"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeModule(m.id)}
                  style={ghostBtn("#ef4444")}
                >
                  Remove
                </button>
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))",
                gap: "0.5rem",
              }}
            >
              <NumField
                label="Width"
                v={m.width || 0}
                onChange={(v) => updateModule(m.id, { width: v })}
                theme={theme}
              />

              <NumField
                label="Depth"
                v={m.depth || 24}
                onChange={(v) => updateModule(m.id, { depth: v })}
                theme={theme}
              />

              <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
                Type
                <select
                  value={m.kind}
                  onChange={(e) =>
                    updateModule(m.id, {
                      kind: e.target.value,
                      config: defaultCabinetConfig(e.target.value),
                    })
                  }
                  style={inputStyle(theme)}
                >
                  <option value="base">Base</option>
                  <option value="drawerBase">Drawer base</option>
                  <option value="sinkBase">Sink base</option>
                  <option value="spiceBase">Spice/pull-out</option>
                </select>
              </label>

              <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
                Side
                <select
                  value={m.side || "front"}
                  onChange={(e) => updateModule(m.id, { side: e.target.value })}
                  style={inputStyle(theme)}
                >
                  <option value="front">Front</option>
                  <option value="back">Back</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </label>
            </div>

            <div style={{ marginTop: "0.5rem" }}>
              <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                Doors:&nbsp;
              </span>

              {[0, 1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateModuleConfig(m.id, { doors: n })}
                  style={{
                    ...miniToggle(theme, (m.config?.doors || 0) === n),
                    marginRight: 4,
                  }}
                >
                  {n}
                </button>
              ))}

              <span
                style={{
                  fontSize: "0.72rem",
                  color: theme.textMuted,
                  marginLeft: 8,
                }}
              >
                Drawers:&nbsp;
              </span>

              {[0, 1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    updateModuleConfig(m.id, {
                      drawers: Array.from(
                        { length: n },
                        (_, i) => m.config?.drawers?.[i] || "small",
                      ),
                    })
                  }
                  style={{
                    ...miniToggle(
                      theme,
                      (m.config?.drawers || []).length === n,
                    ),
                    marginRight: 4,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ElementEditor({
  el,
  theme,
  room,
  rates,
  onUpdate,
  onConfig,
  onRemove,
  pricing,
}) {
  const k = KINDS[el.kind];
  const isCab = k.group === "cabinet";
  const isCorner = !!k.corner;
  const isWallCab = WALL_FAMILY.includes(el.kind);
  const isDiag = el.kind === "cornerBaseDiag" || el.kind === "cornerWallDiag";
  const canDrawers = [
    "base",
    "drawerBase",
    "sinkBase",
    "spiceBase",
    "tall",
    "fridgeSurround",
    "island",
  ].includes(el.kind);

  const isPantry = ["tall", "fridgeSurround"].includes(el.kind);
  const c = el.config || {};
  const isIsland = el.kind === "island";
  const isAppliance = k.group === "appliance";
  const nextSize = (s) =>
    s === "small" ? "medium" : s === "medium" ? "big" : "small";
  const sizeLabel = (s) => (s === "big" ? "Lg" : s === "medium" ? "Md" : "Sm");
  const setDrawerCount = (n) => {
    const cur = c.drawers || [];
    onConfig({
      drawers: Array.from({ length: n }, (_, i) => cur[i] || "small"),
    });
  };

  return (
    <div
      style={{
        marginTop: "0.85rem",
        border: `1px solid ${theme.border}`,
        borderRadius: "0.9rem",
        padding: "0.9rem",
        background: `${theme.text}06`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.7rem",
        }}
      >
        <strong style={{ color: theme.gold, fontSize: "0.92rem" }}>
          {el.label}
        </strong>
        <button type="button" onClick={onRemove} style={ghostBtn("#ef4444")}>
          <Trash2 size={14} /> Remove
        </button>
      </div>

      {/* dimensions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(86px,1fr))",
          gap: "0.55rem",
        }}
      >
        {!isCorner && (
          <NumField
            label="Width"
            v={el.width}
            onChange={(v) => onUpdate({ width: v })}
            theme={theme}
          />
        )}
        {!isWallCab && !isCorner && (
          <NumField
            label="Height"
            v={el.height}
            onChange={(v) => onUpdate({ height: v })}
            theme={theme}
          />
        )}
        {k.group !== "opening" && (
          <NumField
            label={isWallCab ? "Depth (14/cust)" : "Depth"}
            v={el.depth}
            onChange={(v) => onUpdate({ depth: v })}
            theme={theme}
          />
        )}
        {!isCorner && (
          <NumField
            label="Pos along wall"
            v={Math.round(el.pos)}
            onChange={(v) =>
              onUpdate({
                pos: clamp(v, 0, wallLength(el.wall, room) - el.width),
              })
            }
            theme={theme}
          />
        )}
        {k.dragY && !isCorner && (
          <NumField
            label="Bottom from floor"
            v={Math.round(el.y)}
            onChange={(v) =>
              onUpdate({
                y: clamp(v, 0, wallCeiling(el.wall, room) - el.height),
              })
            }
            theme={theme}
          />
        )}
        {isCorner && !isDiag && (
          <>
            <NumField
              label={`Leg ${CORNER_WALLS[el.corner][0]}`}
              v={c.legA ?? 36}
              onChange={(v) => onConfig({ legA: v })}
              theme={theme}
            />
            <NumField
              label={`Leg ${CORNER_WALLS[el.corner][1]}`}
              v={c.legB ?? 36}
              onChange={(v) => onConfig({ legB: v })}
              theme={theme}
            />
          </>
        )}
        {isCorner && isDiag && (
          <NumField
            label="Wall legs"
            v={c.legA ?? 36}
            onChange={(v) => onConfig({ legA: v, legB: v })}
            theme={theme}
          />
        )}
      </div>

      {isIsland && (
        <IslandModuleEditor el={el} theme={theme} onConfig={onConfig} />
      )}

      {isAppliance && (
        <div
          style={{
            marginTop: "0.75rem",
            border: `1px solid ${theme.border}`,
            borderRadius: "0.7rem",
            padding: "0.7rem",
            background: `${theme.text}06`,
          }}
        >
          <label
            style={{
              fontSize: "0.74rem",
              color: theme.text,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: "0.6rem",
            }}
          >
            <input
              type="checkbox"
              checked={!!c.billable}
              onChange={(e) => onConfig({ billable: e.target.checked })}
            />
            Charge client for this appliance / install
          </label>

          {el.kind === "hoodVent" && (
            <div style={{ marginBottom: "0.6rem" }}>
              <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                Hood type:&nbsp;
              </span>
              {[
                ["standalone", "Standalone hood"],
                ["insert", "Insert (under cabinet)"],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => onConfig({ hoodVariant: val })}
                  style={{
                    ...miniToggle(
                      theme,
                      (c.hoodVariant || "standalone") === val,
                    ),
                    marginRight: 4,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {c.billable && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))",
                gap: "0.55rem",
              }}
            >
              <NumField
                label="Supply price"
                v={c.supplyPrice || 0}
                onChange={(v) => onConfig({ supplyPrice: v })}
                theme={theme}
              />

              <NumField
                label="Install price"
                v={c.installPrice || 0}
                onChange={(v) => onConfig({ installPrice: v })}
                theme={theme}
              />
            </div>
          )}

          <div
            style={{
              marginTop: "0.55rem",
              fontSize: "0.72rem",
              color: theme.textMuted,
            }}
          >
            By default, appliances are visual placeholders only and are not
            included in the quote unless this option is enabled.
          </div>
        </div>
      )}

      {/* corner junction picker */}
      {isCorner && (
        <div style={{ marginTop: "0.65rem" }}>
          <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
            Corner:&nbsp;
          </span>
          {Object.keys(CORNER_WALLS).map((cn) => (
            <button
              key={cn}
              type="button"
              onClick={() => onUpdate({ corner: cn })}
              style={{ ...miniToggle(theme, el.corner === cn), marginRight: 4 }}
            >
              {cn}
            </button>
          ))}
        </div>
      )}

      {/* wall picker (non-corner, non-island) */}
      {!isCorner && !k.free && (
        <div style={{ marginTop: "0.65rem" }}>
          <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
            Wall:&nbsp;
          </span>
          {WALLS.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onUpdate({ wall: w.id, pos: 0 })}
              style={{ ...miniToggle(theme, el.wall === w.id), marginRight: 4 }}
            >
              {w.id}
            </button>
          ))}
        </div>
      )}

      {/* wall height class */}
      {isWallCab && (
        <div style={{ marginTop: "0.65rem" }}>
          <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
            Wall height:&nbsp;
          </span>
          {WALL_HEIGHT_CLASSES.map((hc) => (
            <button
              key={hc}
              type="button"
              onClick={() => {
                onConfig({ heightClass: hc });
                onUpdate({ height: parseInt(hc) });
              }}
              style={{
                ...miniToggle(theme, c.heightClass === hc),
                marginRight: 4,
              }}
            >
              {hc}"
            </button>
          ))}
        </div>
      )}

      {/* faces */}
      {isCab && !isIsland && (
        <div
          style={{
            marginTop: "0.75rem",
            display: "flex",
            gap: "1.1rem",
            flexWrap: "wrap",
          }}
        >
          <div>
            <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
              Doors:&nbsp;
            </span>
            {[0, 1, 2].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onConfig({ doors: n })}
                style={{
                  ...miniToggle(theme, (c.doors || 0) === n),
                  marginRight: 4,
                }}
              >
                {n}
              </button>
            ))}
          </div>
          {(c.doors || 0) > 0 && (
            <div title="Two doors stacked one above the other">
              <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                Door rows:&nbsp;
              </span>
              {[1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onConfig({ doorRows: n })}
                  style={{
                    ...miniToggle(theme, (c.doorRows || 1) === n),
                    marginRight: 4,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {canDrawers && (
            <div>
              <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                Drawers:&nbsp;
              </span>
              {[0, 1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setDrawerCount(n)}
                  style={{
                    ...miniToggle(theme, (c.drawers || []).length === n),
                    marginRight: 4,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {canDrawers && (c.drawers || []).length > 0 && (
            <div>
              <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                Sizes (tap to cycle):&nbsp;
              </span>
              {(c.drawers || []).map((dz, i) => (
                <button
                  key={i}
                  type="button"
                  title="small → medium → large"
                  onClick={() => {
                    const nx = [...c.drawers];
                    nx[i] = nextSize(dz);
                    onConfig({ drawers: nx });
                  }}
                  style={{ ...miniToggle(theme, true), marginRight: 4 }}
                >
                  {sizeLabel(dz)}
                </button>
              ))}
            </div>
          )}
          {isPantry && (c.drawers || []).length > 0 && (
            <label
              style={{
                fontSize: "0.74rem",
                color: theme.text,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <input
                type="checkbox"
                checked={c.drawersAtBottom !== false}
                onChange={(e) =>
                  onConfig({ drawersAtBottom: e.target.checked })
                }
              />
              Drawers at base
            </label>
          )}
          {(el.kind === "sinkBase" || el.kind === "base") && (
            <label
              style={{
                fontSize: "0.74rem",
                color: theme.text,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <input
                type="checkbox"
                checked={!!c.sink}
                onChange={(e) => onConfig({ sink: e.target.checked })}
              />
              Farmhouse sink
            </label>
          )}
        </div>
      )}

      {/* materials — shown on the itemized quote line */}
      {isCab && !isIsland && (
        <div
          style={{
            marginTop: "0.75rem",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.6rem",
          }}
        >
          <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
            Door material
            <div style={{ position: "relative", marginTop: 3 }}>
              <select
                value={c.doorMaterial || "mdf"}
                onChange={(e) => onConfig({ doorMaterial: e.target.value })}
                style={{
                  ...inputStyle(theme),
                  appearance: "none",
                  paddingRight: "1.6rem",
                }}
              >
                {Object.entries(DOOR_MATERIALS).map(([k2, v]) => (
                  <option key={k2} value={k2}>
                    {v.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: theme.textMuted,
                  pointerEvents: "none",
                }}
              />
            </div>
          </label>
          <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
            Box material
            <div style={{ position: "relative", marginTop: 3 }}>
              <select
                value={c.boxMaterial || "melamine"}
                onChange={(e) => onConfig({ boxMaterial: e.target.value })}
                style={{
                  ...inputStyle(theme),
                  appearance: "none",
                  paddingRight: "1.6rem",
                }}
              >
                {Object.entries(BOX_MATERIALS).map(([k2, v]) => (
                  <option key={k2} value={k2}>
                    {v.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: theme.textMuted,
                  pointerEvents: "none",
                }}
              />
            </div>
          </label>
        </div>
      )}

      {isCab && !isIsland && (
        <div
          style={{
            marginTop: "0.75rem",
            fontSize: "0.74rem",
            color: theme.textMuted,
          }}
        >
          Cabinet ${pricing.cabinet?.toFixed(2)}
          {pricing.install > 0 && (
            <> · Install ${pricing.install?.toFixed(2)}</>
          )}{" "}
          ·{" "}
          <strong style={{ color: theme.gold }}>
            ${pricing.total?.toFixed(2)}
          </strong>
        </div>
      )}

      {isAppliance && c.billable && (
        <div
          style={{
            marginTop: "0.75rem",
            fontSize: "0.74rem",
            color: theme.textMuted,
          }}
        >
          Supply ${pricing.cabinet?.toFixed(2)} · Install $
          {pricing.install?.toFixed(2)} ·{" "}
          <strong style={{ color: theme.gold }}>
            ${pricing.total?.toFixed(2)}
          </strong>
        </div>
      )}
    </div>
  );
}

const ViewTab = ({ active, onClick, theme, children }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: "0.3rem",
      padding: "0.45rem 0.8rem",
      borderRadius: "999px",
      fontSize: "0.8rem",
      fontWeight: 600,
      cursor: "pointer",
      minHeight: 36,
      border: `1.5px solid ${active ? theme.gold : theme.border}`,
      background: active ? `${theme.gold}1c` : "transparent",
      color: active ? theme.gold : theme.textMuted,
    }}
  >
    {children}
  </button>
);

const Tot = ({ label, v, theme, big }) => (
  <div>
    <div style={{ fontSize: "0.68rem", color: theme.textMuted }}>{label}</div>
    <div
      style={{
        fontSize: big ? "1.15rem" : "0.95rem",
        fontWeight: 700,
        color: big ? theme.gold : theme.text,
      }}
    >
      ${Number(v).toFixed(2)}
    </div>
  </div>
);

const FinishStat = ({ label, value, theme, accent }) => (
  <div
    style={{
      textAlign: "center",
      padding: "0.4rem 0.3rem",
      borderRadius: "0.5rem",
      background: `${theme.text}08`,
      border: `1px solid ${theme.border}`,
    }}
  >
    <div
      style={{
        fontSize: "0.62rem",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: theme.textMuted,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: "1rem",
        fontWeight: 800,
        color: accent ? theme.gold : theme.text,
      }}
    >
      {value}
    </div>
  </div>
);

const NumField = ({ label, v, onChange, theme }) => (
  <label style={{ fontSize: "0.7rem", color: theme.textMuted }}>
    {label}
    <input
      type="number"
      inputMode="decimal"
      value={v}
      onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      style={inputStyle(theme)}
    />
  </label>
);

/* ───────────────────────────── style helpers ──────────────────────────── */
const inputStyle = (theme) => ({
  display: "block",
  width: "100%",
  marginTop: 3,
  padding: "0.5rem 0.55rem",
  borderRadius: "0.45rem",
  border: `1px solid ${theme.border}`,
  background: `${theme.text}0d`,
  color: theme.text,
  fontSize: "0.9rem",
});
const chipBtn = (theme) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  padding: "0.45rem 0.65rem",
  borderRadius: "0.55rem",
  border: `1px solid ${theme.border}`,
  background: `${theme.text}0a`,
  color: theme.text,
  fontSize: "0.76rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
  minHeight: 34,
});
const ghostBtn = (color) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "0.3rem",
  padding: "0.4rem 0.55rem",
  borderRadius: "0.5rem",
  border: "none",
  background: "transparent",
  color,
  fontSize: "0.78rem",
  cursor: "pointer",
});
const miniToggle = (theme, active) => ({
  padding: "0.35rem 0.6rem",
  borderRadius: "0.4rem",
  fontSize: "0.78rem",
  fontWeight: 600,
  cursor: "pointer",
  minHeight: 32,
  border: `1.5px solid ${active ? theme.gold : theme.border}`,
  background: active ? `${theme.gold}22` : "transparent",
  color: active ? theme.gold : theme.textMuted,
});

function shortLabel(el) {
  const m = {
    base: "Base",
    drawerBase: "Drawers",
    sinkBase: "Sink",
    spiceBase: "Spice",
    tall: "Tall",
    fridgeSurround: "Fridge surround",
    hoodCabinet: "Hood cab",
    wall: "Wall",
    microwave: "Micro",
    island: "Island",
    cornerBase: "Cnr",
    cornerBaseDiag: "Cnr45",
    cornerWall: "CnrW",
    cornerWallDiag: "CnrW45",
    fridge: "Fridge",
    stove: "Range",
    hoodVent: "Hood",
    dishwasher: "DW",
    window: "Window",
    door: "Door",
  };

  return `${m[el.kind] || el.kind} ${el.width}"`;
}
