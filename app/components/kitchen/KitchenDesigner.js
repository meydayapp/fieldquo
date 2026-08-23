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
  Palette,
  Maximize2,
  Microwave,
  CornerDownRight,
  Triangle,
  DollarSign,
  ChevronRight,
  ChevronDown,
  WashingMachine,
  Shirt,
  Layers,
  Archive,
  Footprints,
  Rows3,
  Table2,
  AlertTriangle,
} from "lucide-react";
import {
  priceCabinet,
  getKitchenBreakdown,
  countKitchenFaces,
  DEFAULT_CABINET_RATES,
  DOOR_MATERIALS,
  BOX_MATERIALS,
  KITCHEN_ACCESSORIES,
  ROOM_TYPES,
  ROOM_ELEMENT_KINDS,
} from "@/lib/kitchen/pricing";

// Geometry lives in lib/kitchen/geometry.js so the presentation drawing and the
// PDF can use the SAME wall-to-XY mapping this editor drags against. A second
// copy is a drawing that slowly stops matching what the client moved.
import {
  WALLS,
  KINDS as KITCHEN_KINDS,
  islandModules,
  islandSideModules,
  islandFrontModules,
  islandBackModules,
  islandLeftModules,
  islandRightModules,
  islandSideRun,
  planRect,
  planWidth,
  planDepth,
  cornerLegs,
  islandTotalWidth,
  islandTotalDepth,
  COUNTER_HEIGHT,
  BASE_HEIGHT,
  UPPER_BOTTOM,
  SNAP,
  RETURN_DEPTH,
} from "@/lib/kitchen/geometry";

// Every element this designer can place, kitchen and otherwise.
//
// The closet and laundry half lives in lib/kitchen/pricing.js rather than in
// geometry.js beside the kitchen half — see the comment on ROOM_ELEMENT_KINDS
// for why, and for what it costs. Merged here so everything below reads one
// table; a component that had to ask "which of the two KINDS is this?" at every
// lookup would get it wrong somewhere.
// KITCHEN_KINDS already contains the room elements — geometry.js spreads
// ROOM_ELEMENT_KINDS into KINDS so the PDF plan can see them. Merged again
// here would be a no-op that outlives the reason for it.
const KINDS = KITCHEN_KINDS;

// The palette buttons' icons. Split from KINDS when the geometry moved out —
// lucide components can't be imported by a PDF renderer or a bare-node test.
const KIND_ICONS = {
  base: Box,
  drawerBase: Columns2,
  sinkBase: CookingPot,
  spiceBase: Box,
  tall: PanelTop,
  fridgeSurround: PanelTop,
  hoodCabinet: PanelTop,
  wall: Box,
  microwave: Microwave,
  island: Box,
  cornerBase: CornerDownRight,
  cornerBaseDiag: Triangle,
  cornerWall: CornerDownRight,
  cornerWallDiag: Triangle,
  fridge: Refrigerator,
  stove: Flame,
  hoodVent: CookingPot,
  dishwasher: Square,
  window: RectangleHorizontal,
  door: DoorOpen,

  // Laundry
  washer: WashingMachine,
  dryer: WashingMachine,
  washerDryerStacked: Layers,
  washTower: Layers,
  laundryCentre: Layers,
  laundrySinkBase: CookingPot,
  foldingCounter: Table2,
  laundryUpper: Box,
  broomTall: Archive,

  // Closet
  closetSingleHang: Shirt,
  closetDoubleHang: Shirt,
  closetShelfStack: Rows3,
  closetDrawerBank: Columns2,
  closetShoeRack: Footprints,
  closetCorner: CornerDownRight,
};

import CabinetFace from "./CabinetFace";
import FinishPicker from "./FinishPicker";
import { colorFor, DEFAULT_FINISH } from "@/lib/kitchen/finishes";
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

// One palette per room, the way IKEA ships one planner per room: somebody
// laying out a walk-in should not have to scroll past sink bases to reach a
// shoe rack. Only the PALETTE changes — the drawing, the drag, the snapping and
// the pricing are the same tool underneath, and nothing stops a laundry room
// from holding a run of kitchen bases, because plenty of them do.
const PALETTE_GROUPS_BY_ROOM = {
  kitchen: [
    { title: "Base", kinds: ["base", "drawerBase", "sinkBase", "spiceBase"] },
    { title: "Upper", kinds: ["wall", "microwave", "hoodCabinet"] },
    { title: "Tall", kinds: ["tall", "fridgeSurround", "island"] },
    {
      title: "Corner",
      kinds: ["cornerBase", "cornerBaseDiag", "cornerWall", "cornerWallDiag"],
    },
    {
      title: "Appliance",
      kinds: ["fridge", "stove", "dishwasher", "hoodVent"],
    },
    { title: "Opening", kinds: ["window", "door"] },
  ],
  laundry: [
    {
      title: "Appliance",
      kinds: [
        "washer",
        "dryer",
        "washerDryerStacked",
        "washTower",
        "laundryCentre",
      ],
    },
    { title: "Base", kinds: ["laundrySinkBase", "base", "drawerBase"] },
    { title: "Counter", kinds: ["foldingCounter"] },
    { title: "Upper", kinds: ["laundryUpper", "wall"] },
    { title: "Tall", kinds: ["broomTall", "tall"] },
    { title: "Opening", kinds: ["window", "door"] },
  ],
  closet: [
    { title: "Hanging", kinds: ["closetSingleHang", "closetDoubleHang"] },
    { title: "Storage", kinds: ["closetShelfStack", "closetShoeRack"] },
    { title: "Drawers", kinds: ["closetDrawerBank"] },
    { title: "Corner", kinds: ["closetCorner"] },
    // The walk-in island IS the kitchen island: a free-standing run of boxes
    // with a finished top, laid out side by side. Reused rather than cloned as
    // `closetIsland`, which would have been a second copy of the island module
    // editor and the plan footprint maths to keep in step with this one.
    { title: "Island", kinds: ["island"] },
    { title: "Opening", kinds: ["window", "door"] },
  ],
};

function paletteFor(roomType) {
  return PALETTE_GROUPS_BY_ROOM[roomType] || PALETTE_GROUPS_BY_ROOM.kitchen;
}

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
  "laundryUpper",
];
const TALL_FAMILY = ["tall", "fridgeSurround", "broomTall"];
const CORNER_KINDS = [
  "cornerBase",
  "cornerBaseDiag",
  "cornerWall",
  "cornerWallDiag",
  "closetCorner",
];

// Closet units carry rails and open shelves instead of doors, so the inspector
// offers different controls for them. Listed by kind rather than inferred from
// the config, so an empty config still gets the right editor.
const CLOSET_KINDS = [
  "closetSingleHang",
  "closetDoubleHang",
  "closetShelfStack",
  "closetShoeRack",
  "closetCorner",
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

  /* ── Laundry ── */
  if (kind === "laundrySinkBase")
    return { doors: 2, doorRows: 1, drawers: [], sink: true };

  // A counter surface: no box, no faces, nothing to finish. Doors: 0 keeps it
  // out of the refinishing count, which would otherwise bill spray-finishing a
  // door that doesn't exist.
  if (kind === "foldingCounter") return { doors: 0, doorRows: 1, drawers: [] };

  if (kind === "laundryUpper")
    return { doors: 2, doorRows: 1, drawers: [], heightClass: "24" };

  if (kind === "broomTall")
    return { doors: 1, doorRows: 1, drawers: [], shelves: 3 };

  /* ── Closet ── */
  if (kind === "closetSingleHang")
    return { doors: 0, doorRows: 1, drawers: [], rods: 1, shelves: 1 };

  if (kind === "closetDoubleHang")
    return { doors: 0, doorRows: 1, drawers: [], rods: 2, shelves: 1 };

  if (kind === "closetShelfStack")
    return { doors: 0, doorRows: 1, drawers: [], rods: 0, shelves: 5 };

  if (kind === "closetShoeRack")
    return { doors: 0, doorRows: 1, drawers: [], rods: 0, shelves: 4 };

  if (kind === "closetCorner")
    return {
      doors: 0,
      doorRows: 1,
      drawers: [],
      rods: 0,
      shelves: 4,
      legA: 24,
      legB: 24,
    };

  if (kind === "closetDrawerBank")
    return {
      doors: 0,
      doorRows: 1,
      drawers: ["medium", "medium", "medium", "medium"],
    };

  if (isApplianceKind(kind)) {
    return {
      billable: false,

      supplyPrice: 0,

      installPrice: 0,
    };
  }

  return { doors: 2, doorRows: 1, drawers: ["small"], sink: false };
}

// Asked of the merged KINDS table rather than a hand-kept list. The list was
// the kitchen's four appliances; five laundry units later, a list is a thing
// somebody forgets to extend and a washtower quietly starts pricing as a
// cabinet at $850/lf.
function isApplianceKind(kind) {
  return KINDS[kind]?.group === "appliance";
}

/**
 * Guard an element patch before it lands.
 *
 * One rule, and it earns its place: a closet or laundry element must never end
 * up with a zero depth. lib/kitchen/geometry.js's planRect falls back to
 * `KINDS[el.kind].plane` when `el.depth` is falsy, and that KINDS is the KITCHEN
 * table — it has no entry for a shoe rack, so a 0 typed into the Depth field
 * throws while the plan is drawing and takes the whole designer down.
 *
 * Clamped rather than rejected, matching how pricing.js treats a hostile width:
 * one silly number should not stop the other twenty pieces rendering while
 * somebody is standing in a driveway looking at it.
 */
function safePatch(el, patch) {
  if (!patch || !("depth" in patch)) return patch;
  if (KITCHEN_KINDS[el.kind]) return patch; // geometry knows it; 0 is survivable
  const d = Number(patch.depth);
  return { ...patch, depth: Number.isFinite(d) && d >= 1 ? d : 1 };
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
    // `defaultY` overrides the kitchen's 54" upper line where a kind has a
    // reason to sit somewhere else — an upper over a 39" washer, a folding
    // counter at waist height. Absent, the kitchen rule stands.
    y:
      k.plane === "upper"
        ? (k.defaultY ?? UPPER_BOTTOM)
        : k.plane === "free"
          ? 40
          : 0,
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

// The island module helpers, planRect and cornerLegs all moved to
// lib/kitchen/geometry.js — see the import at the top of this file.

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
    // Which planner this design is. Kitchen unless the saved design says
    // otherwise, so every design drawn before closets existed opens as what it
    // is rather than as an empty closet.
    roomType: ROOM_TYPES.some((r) => r.id === value?.roomType)
      ? value.roomType
      : "kitchen",
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
    rates: {
      ...DEFAULT_CABINET_RATES,
      ...(value?.rates || {}),
      ...(ratesProp || {}),
    },
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
    // From lib/kitchen/finishes.js, not a fourth copy of the defaults. The
    // presentation drawing, the public API and this editor all normalise
    // through the same module, so a design opened here and rendered on the
    // quote can't start from different colours.
    finish: { ...DEFAULT_FINISH, ...(value?.finish || {}) },
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
  const [showFinishes, setShowFinishes] = useState(false);
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

      roomType: cf.roomType,

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
      prev.map((e) => (e.id === id ? { ...e, ...safePatch(e, patch) } : e)),
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
              color={colorFor(el, cfg.finish)}
              style={cfg.finish?.doorStyle}
            />
          )}
          {k.group === "appliance" && (
            <>
              <ApplianceGlyph
                kind={el.kind}
                x={ex}
                y={ey}
                w={ew}
                h={eh}
                theme={theme}
                variant={el.config?.hoodVariant || "standalone"}
              />
              {/* ApplianceGlyph only knows the kitchen's four and returns null
                  for anything else — leaving a 74" washtower as an empty
                  rectangle, which tells a homeowner nothing about whether it
                  fits under the shelf above it. Drawn here rather than there
                  because that file is outside this pass. */}
              <LaundryGlyph
                kind={el.kind}
                x={ex}
                y={ey}
                w={ew}
                h={eh}
                theme={theme}
              />
            </>
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
              color={colorFor(faceEl, cfg.finish)}
              style={cfg.finish?.doorStyle}
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
      {/* ── Which room ─────────────────────────────────────────────────────
          Switching swaps the PALETTE, nothing else. Pieces already drawn stay
          drawn and stay priced: a laundry room really can contain a run of
          kitchen bases, and silently deleting somebody's work because they
          tapped a tab is the destructive-operation-labelled-as-cosmetic
          failure AGENTS.md lists. */}
      {!readOnly && (
        <div
          style={{
            display: "flex",
            gap: "0.4rem",
            flexWrap: "wrap",
            marginBottom: "0.8rem",
          }}
        >
          {ROOM_TYPES.map((r) => (
            <ViewTab
              key={r.id}
              active={cfg.roomType === r.id}
              onClick={() => patchCfg({ roomType: r.id })}
              theme={theme}
            >
              {r.label}
            </ViewTab>
          ))}
        </div>
      )}

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
      {/* ── Finishes ───────────────────────────────────────────────────────
          Replaces a one-line row of paint chips. That row only ever set the
          cabinet colour, which is a fraction of what makes a drawing look like
          somebody's actual kitchen — floor, counter, wall and door STYLE do the
          rest, and a homeowner picturing their room needs all of them.

          Collapsed by default: on a phone this is the tallest panel here, and
          the drawing is what someone opens the page for. */}
      {!readOnly && (
        <div
          style={{
            marginBottom: "0.7rem",
            border: `1px solid ${theme.border}`,
            borderRadius: "0.9rem",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => setShowFinishes((v) => !v)}
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
            <Palette size={15} style={{ color: theme.gold }} />
            Colours &amp; finishes
            <span
              style={{
                marginLeft: "auto",
                display: "inline-flex",
                gap: 4,
                alignItems: "center",
              }}
            >
              {/* The current choice, as chips. Someone deciding whether to open
                  this can see what's set without opening it. */}
              {[
                cfg.finish?.cabinetColor,
                cfg.finish?.countertopColor,
                cfg.finish?.floorColor,
              ]
                .filter(Boolean)
                .map((c, i) => (
                  <span
                    key={i}
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 4,
                      background: c,
                      border: `1px solid ${theme.border}`,
                    }}
                  />
                ))}
              <ChevronRight
                size={15}
                style={{
                  transform: showFinishes ? "rotate(90deg)" : "none",
                  transition: "transform 0.2s",
                  color: theme.textMuted,
                }}
              />
            </span>
          </button>
          {showFinishes && (
            <div style={{ padding: "0.9rem" }}>
              <FinishPicker
                value={cfg.finish}
                onChange={(finish) => patchCfg({ finish })}
                // A custom hex is a contractor tool — see FinishPicker's header.
                allowCustom={!clientMode}
              />
            </div>
          )}
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
          {paletteFor(cfg.roomType).map((g) => (
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
                // From KIND_ICONS now, not K.icon — the geometry module can't
                // carry lucide components. Without this the whole palette would
                // have silently fallen back to the generic Box glyph and every
                // button would look identical.
                const Icon = KIND_ICONS[kind] || Box;
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

      {/* ── Pieces with no rate ────────────────────────────────────────────
          A closet that totals $0 reads as a bug or as a gift, and either way it
          goes out. This says which it is, before the quote does.

          Contractor-side only, like every other number here: the client's copy
          of the quote carries the $0 line without this notice, because "we
          haven't set a price for this" is a conversation between the shop and
          its rate card, not something to print on a document. */}
      {!clientMode && breakdown.unpriced > 0 && (
        <div
          style={{
            marginTop: "1rem",
            display: "flex",
            gap: "0.6rem",
            alignItems: "flex-start",
            padding: "0.75rem 1rem",
            background: "#f59e0b18",
            border: "1px solid #f59e0b66",
            borderRadius: "0.75rem",
          }}
        >
          <AlertTriangle
            size={16}
            style={{ color: "#f59e0b", flexShrink: 0 }}
          />
          <div style={{ fontSize: "0.78rem", lineHeight: 1.5 }}>
            <strong>
              {breakdown.unpriced} piece{breakdown.unpriced === 1 ? "" : "s"} on
              this drawing {breakdown.unpriced === 1 ? "has" : "have"} no rate
              on your card, so {breakdown.unpriced === 1 ? "it is" : "they are"}{" "}
              priced at $0.
            </strong>{" "}
            <span style={{ color: theme.textMuted }}>
              Closet and laundry casework ships with no starting rate on purpose
              — the kitchen rates are one shop&apos;s real prices, and a guessed
              closet rate would be a number nobody chose going out on a signed
              quote. Set them before sending this.
            </span>
          </div>
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
            <Tot
              label="Delivery/removal"
              v={breakdown.logistics}
              theme={theme}
            />
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

/**
 * The laundry appliances on an elevation.
 *
 * Same rules as ApplianceGlyph, deliberately: proportional to the rect it is
 * given, line-work over a wash, no photorealism. A drawn stainless washtower
 * would suggest the contractor is supplying that exact machine.
 *
 * One drum for a washer or a dryer; two for anything stacked, split where the
 * real units split — the WashTower's washer is the lower half, the GE laundry
 * centre's washer is the wider lower box. What a client is checking here is
 * whether the door swings clear of the cabinet beside it.
 */
function LaundryGlyph({ kind, x = 0, y = 0, w = 0, h = 0, theme = {} }) {
  const stacked = ["washerDryerStacked", "washTower", "laundryCentre"].includes(
    kind,
  );
  if (!stacked && kind !== "washer" && kind !== "dryer") return null;
  if (w <= 0 || h <= 0) return null;

  const stroke = theme.textMuted || "#9ca3af";
  const sw = Math.max(0.6, Math.min(w, h) * 0.012);
  const drums = stacked ? [0.25, 0.72] : [0.58];
  // Control panel band sits at the top of each machine, which is where the
  // split is on a stacked pair — hence one band per drum.
  const r = Math.min(w, stacked ? h / 2 : h) * 0.3;

  return (
    <g pointerEvents="none">
      {drums.map((f, i) => (
        <circle
          key={i}
          cx={x + w / 2}
          cy={y + h * f}
          r={r}
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
        />
      ))}
      {drums.map((f, i) => (
        <line
          key={`b${i}`}
          x1={x + w * 0.08}
          y1={y + h * (f - (stacked ? 0.19 : 0.4))}
          x2={x + w * 0.92}
          y2={y + h * (f - (stacked ? 0.19 : 0.4))}
          stroke={stroke}
          strokeWidth={sw}
        />
      ))}
    </g>
  );
}

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
    // Laundry & closet. A hanging section with a drawer bank under the rail is
    // the commonest closet unit there is.
    "laundrySinkBase",
    "broomTall",
    "closetDrawerBank",
    ...CLOSET_KINDS,
  ].includes(el.kind);

  // Rails and shelves — the closet's equivalent of doors and drawers. Shown
  // where they exist so the number reaching the quote line is the one the
  // contractor set, not a default nobody looked at.
  const canRods = ["closetSingleHang", "closetDoubleHang"].includes(el.kind);
  const canShelves = [...CLOSET_KINDS, "broomTall"].includes(el.kind);

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
          {canRods && (
            <div>
              <span style={{ fontSize: "0.72rem", color: theme.textMuted }}>
                Hanging rails:&nbsp;
              </span>
              {[1, 2].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onConfig({ rods: n })}
                  style={{
                    ...miniToggle(theme, (c.rods || 0) === n),
                    marginRight: 4,
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {canShelves && (
            <div style={{ minWidth: 110 }}>
              <NumField
                label="Shelves"
                v={c.shelves ?? 0}
                onChange={(v) =>
                  onConfig({ shelves: clamp(Math.round(v), 0, 20) })
                }
                theme={theme}
              />
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
          {/* Said at the piece, not only in the summary above. Somebody
              inspecting a shoe rack should not have to scroll to find out why
              their closet costs nothing. */}
          {pricing.rateMissing && (
            <div
              style={{
                marginTop: "0.35rem",
                display: "flex",
                gap: 5,
                alignItems: "flex-start",
                color: "#f59e0b",
              }}
            >
              <AlertTriangle
                size={13}
                style={{ flexShrink: 0, marginTop: 1 }}
              />
              <span>
                No rate on your card for{" "}
                {(KINDS[el.kind]?.label || el.kind).toLowerCase()}, so this line
                is $0. It ships blank rather than guessed.
              </span>
            </div>
          )}
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

    // Laundry & closet. Short on purpose — these are 8.5pt labels printed
    // inside a cabinet footprint on a phone, and "Laundry centre (unitized)"
    // spills across the piece next to it.
    washer: "Washer",
    dryer: "Dryer",
    washerDryerStacked: "W/D stack",
    washTower: "Washtower",
    laundryCentre: "Laundry ctr",
    laundrySinkBase: "Laundry sink",
    foldingCounter: "Folding",
    laundryUpper: "Upper",
    broomTall: "Broom",
    closetSingleHang: "Hang",
    closetDoubleHang: "Dbl hang",
    closetShelfStack: "Shelves",
    closetDrawerBank: "Drawers",
    closetShoeRack: "Shoes",
    closetCorner: "Cnr",
  };

  return `${m[el.kind] || el.kind} ${el.width}"`;
}
