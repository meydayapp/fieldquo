// lib/estimate/roomPresets.js
//
// A painted room from three things a homeowner can answer without a tape
// measure: what room it is, whether it is small, medium or large, and
// whether the ceiling is standard or high.
//
// ══ The pattern this follows ═══════════════════════════════════════════════
//
// The stairs instant estimate (lib/estimate/stairsFromSteps.js): the
// homeowner answers plain questions ("how many steps, does it turn"), a pure
// rule turns them into the counts a contractor would have measured, the
// SERVER prices those counts from the company's own rates, and every derived
// figure says where it came from — on the range's assumptions, on the draft's
// takeoff and on the report — so the estimator corrects it on site. Here the
// rule is a table: typical floor dimensions per room type and size, and the
// typical ceiling height, for the company's region (lib/estimate/
// roomPresetData.js, researched and cited in docs/research/ROOM-SIZES-2026.md).
//
// ══ Why this is allowed when PAINT_AREA_TYPE_DEFAULTS forbids it ═══════════
//
// lib/pricing/paintTakeoff.js refuses a default square footage per room type
// — "picking Living Room must never put 300 sqft into a price" — and it is
// right, for the QUOTE: an estimator standing in the room measures it. The
// instant form is the other case: a stranger in a driveway who will not
// measure, asked for a ballpark the owner (2026-10-03) wants built from
// typical sizes "similarly to how we simplified the instant estimate for
// stairs". What keeps that honest is what kept the stairs rule honest:
//
//   • the homeowner CHOOSES the size (small / medium / large), so the figure
//     answers something they said, not something we assumed in silence;
//   • every room carries `assumed: true` and its source ids wherever it goes,
//     and every surface that prints it says "typical size, confirm on site";
//   • the draft's takeoff gets the dimensions in the estimator's own boxes,
//     where one typed number replaces the assumption.
//
// ══ One formula, not two ═══════════════════════════════════════════════════
//
// The wall and ceiling areas come from areaGeometry() in paintTakeoff.js —
// the same function the quote builder's Room (4 walls) runs — so a room the
// picker sized at 11 × 12 × 8 ft has, to the cent, the wall area the builder
// shows for 11 × 12 × 8. That function deliberately does NOT deduct doors and
// windows ("cutting in around an opening costs about what the missing area
// saves, and every production rate was recovered against gross area"), so
// neither does this. A second formula with openings taken off would be the
// copy that disagrees with the builder (AGENTS.md recurring failure 4).
//
// ══ Units ══════════════════════════════════════════════════════════════════
//
// Each region's table is in the unit its sources state (feet for North
// America, metres elsewhere) and is shown to the homeowner in that unit. The
// arithmetic runs in feet because every painting rate in this codebase is per
// square foot; the conversion is exact (0.3048 m to the foot) and happens once,
// here.
//
// Pure. Hostile input returns null rather than a room made of NaN.

import { areaGeometry } from "@/lib/pricing/paintTakeoff";
import { M_PER_FT, dimsText, heightText } from "@/lib/estimate/roomDisplay";
import { roomCopy, roomCopyLocale } from "@/lib/i18n/roomPresetCopy";
import {
  ROOM_REGIONS,
  ROOM_SOURCES,
  REGION_BY_COUNTRY,
  DEFAULT_ROOM_REGION,
  STAIRWELL_STOREYS,
} from "@/lib/estimate/roomPresetData";

export { ROOM_REGIONS, ROOM_SOURCES, REGION_BY_COUNTRY, DEFAULT_ROOM_REGION, STAIRWELL_STOREYS };
export { M_PER_FT, SQM_PER_SQFT, areaInUnit, areaUnitLabel, dimsText, heightText, areaText } from "@/lib/estimate/roomDisplay";

export const ROOM_TYPES = Object.freeze([
  "living",
  "kitchen",
  "dining",
  "primary_bedroom",
  "bedroom",
  "bathroom",
  "ensuite",
  "hallway",
  "stairwell",
  "office",
  "laundry",
  "basement",
]);
export const ROOM_SIZES = Object.freeze(["small", "medium", "large"]);
export const DEFAULT_ROOM_SIZE = "medium";
export const CEILING_HEIGHTS = Object.freeze(["standard", "high"]);
export const DEFAULT_CEILING_HEIGHT = "standard";

// A house has fewer rooms than this; a list past it is a bot, and a door
// count past MAX_DOORS in one room is a typo that would otherwise be billed.
export const MAX_ROOMS = 30;
export const MAX_DOORS = 10;


const round2 = (n) => Math.round(n * 100) / 100;

/**
 * The region a company's rooms are sized for, from the country the company
 * STATES (lib/company/resolveCountry.js statedCountry). Never the homeowner's
 * IP or browser: the contractor's market is the contractor's.
 *
 * `stated: false` means no country was on the record and the default region
 * was used — said out loud on the draft, never passed off as a fact.
 */
export function regionForCountry(country) {
  const code = typeof country === "string" ? country.trim().toUpperCase() : "";
  const region = Object.prototype.hasOwnProperty.call(REGION_BY_COUNTRY, code) ? REGION_BY_COUNTRY[code] : null;
  return region ? { region, stated: true } : { region: DEFAULT_ROOM_REGION, stated: false };
}

/** A region key when it is one, else the default. */
export function roomRegion(key) {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(ROOM_REGIONS, key) ? key : DEFAULT_ROOM_REGION;
}

/** "imperial" for a table in feet, "metric" for one in metres. */
export function unitSystemForRegion(key) {
  return ROOM_REGIONS[roomRegion(key)].unit === "ft" ? "imperial" : "metric";
}

/** The room types a region offers — basement only where it is a room people paint. */
export function roomTypesFor(key) {
  const rooms = ROOM_REGIONS[roomRegion(key)].rooms;
  return ROOM_TYPES.filter((type) => rooms[type] && rooms[type].offered !== false);
}

const intIn = (v, lo, hi) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};

/**
 * One room as the browser described it → the room as priced, with its
 * assumed dimensions. Null for anything that is not a room the region offers,
 * or a room with nothing to paint in it.
 *
 * Only KEYS are read from the choice: type, size, height, which parts to
 * paint and a door count. Dimensions a request body carries are ignored —
 * they come from the table, here, on the server (non-negotiable #5's rule
 * for anything that becomes a price).
 */
export function resolveRoom(choice, regionKey) {
  if (!choice || typeof choice !== "object" || Array.isArray(choice)) return null;
  const type = ROOM_TYPES.includes(choice.type) ? choice.type : null;
  if (!type) return null;
  const region = roomRegion(regionKey);
  const table = ROOM_REGIONS[region];
  const preset = table.rooms[type];
  if (!preset || preset.offered === false) return null;

  const size = ROOM_SIZES.includes(choice.size) ? choice.size : DEFAULT_ROOM_SIZE;
  const height = CEILING_HEIGHTS.includes(choice.height) ? choice.height : DEFAULT_CEILING_HEIGHT;
  const walls = choice.walls !== false;
  const ceiling = choice.ceiling === true;
  const trim = choice.trim === true;
  const doors = intIn(choice.doors, 0, MAX_DOORS);
  if (!walls && !ceiling && !trim && doors === 0) return null;

  const [length, width] = preset[size];
  // A stairwell's wall is open through both floors it joins; one storey's
  // height would paint half of it. The multiplier is stated, not hidden:
  // the room row on the report prints the height it used.
  const storeys = type === "stairwell" ? STAIRWELL_STOREYS : 1;
  // A room with its own ceiling (a North American basement, 7–8 ft) uses it;
  // every other room the region's.
  const heights = preset.ceiling || table.ceiling;
  const ceilingHeight = round2(heights[height] * storeys);
  const toFt = table.unit === "ft" ? 1 : 1 / M_PER_FT;
  const lengthFt = round2(length * toFt);
  const widthFt = round2(width * toFt);
  const heightFt = round2(ceilingHeight * toFt);
  // The builder's own arithmetic, recorded with the room so the panel and the
  // review screen can print "walls about 37 m²" without importing the
  // takeoff engine. The estimator does NOT read these back — it recomputes
  // from the dimensions (roomGeometry) every time it prices.
  const g = areaGeometry({ measurement: "area", lengthFt, widthFt, heightFt });

  return {
    type,
    size,
    height,
    walls,
    ceiling,
    trim,
    doors,
    region,
    unit: table.unit,
    // As the region states them — what the homeowner and the report read.
    length,
    width,
    ceilingHeight,
    // In feet — what areaGeometry and every per-sqft rate read.
    lengthFt,
    widthFt,
    heightFt,
    wallSqft: g.wallSqft,
    ceilingSqft: g.ceilingSqft,
    assumed: true,
    sources: [...preset.sources, ...table.ceiling.sources.filter((s) => !preset.sources.includes(s))],
  };
}

/** Every room in a posted list, resolved; null when none survives. */
export function roomsFromIntake(raw, regionKey) {
  if (!Array.isArray(raw)) return null;
  const rooms = raw.slice(0, MAX_ROOMS).map((r) => resolveRoom(r, regionKey)).filter(Boolean);
  return rooms.length ? rooms : null;
}

// Finite, positive and house-sized. A saved room whose dimensions are any
// less than that is not priced — the estimator prices only what it can trust,
// and a stored measurement is still input to a pure function.
const MAX_FT = 200;
const dim = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n <= MAX_FT ? n : 0;
};

/**
 * The areas a PRICED room implies, through the builder's own geometry.
 * `{ wallSqft, ceilingSqft, linearFt, floorSqft }`, or null for a room whose
 * stored dimensions cannot be trusted.
 */
export function roomGeometry(room) {
  if (!room || typeof room !== "object") return null;
  const lengthFt = dim(room.lengthFt);
  const widthFt = dim(room.widthFt);
  const heightFt = dim(room.heightFt);
  if (!lengthFt || !widthFt || !heightFt) return null;
  return areaGeometry({ measurement: "area", lengthFt, widthFt, heightFt });
}

/**
 * What the public page needs to draw the picker for one region: the room
 * types it offers and, per size, the dimensions it will assume — so "Medium"
 * reads "about 3.4 × 3.0 m" BEFORE anything is priced, and the homeowner
 * can see what they are agreeing to. Sizes and heights are not rates: they
 * are the published research in docs/research/ROOM-SIZES-2026.md, and a
 * competitor learns nothing about the company's prices from them.
 */
export function publicRoomPicker(regionKey) {
  const region = roomRegion(regionKey);
  const table = ROOM_REGIONS[region];
  return {
    region,
    unit: table.unit,
    unitSystem: unitSystemForRegion(region),
    heights: { standard: table.ceiling.standard, high: table.ceiling.high },
    stairwellStoreys: STAIRWELL_STOREYS,
    types: roomTypesFor(region).map((type) => ({
      type,
      sizes: Object.fromEntries(ROOM_SIZES.map((s) => [s, [...table.rooms[type][s]]])),
      ...(table.rooms[type].ceiling && {
        heights: { standard: table.rooms[type].ceiling.standard, high: table.rooms[type].ceiling.high },
      }),
    })),
  };
}

/**
 * One priced room as a sentence, in a language: what was told (the room, the
 * size, what to paint) and what was assumed (the dimensions), with the
 * assumption marked — "Bedroom (medium): walls, 1 door — 11 × 12 ft, 8 ft
 * ceiling — typical size, confirm on site". For the lead's "What they told
 * us" row, which the reviewer reads before opening the draft.
 */
export function roomSummary(room, language = "en") {
  if (!room || typeof room !== "object") return "";
  const t = roomCopy(language);
  const locale = roomCopyLocale(language);
  const parts = [
    room.walls !== false ? t.parts.walls : null,
    room.ceiling === true ? t.parts.ceiling : null,
    room.trim === true ? t.parts.trim : null,
    Number(room.doors) > 0 ? `${t.parts.doors} × ${Math.floor(Number(room.doors))}` : null,
  ].filter(Boolean);
  const name = t.rooms[room.type] || String(room.type || "");
  const size = t.sizes[room.size] || String(room.size || "");
  return `${name} (${size}): ${parts.join(", ")} — ${t.roomRow(dimsText(room, locale), heightText(room, locale))}`;
}
