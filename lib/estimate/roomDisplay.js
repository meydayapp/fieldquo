// lib/estimate/roomDisplay.js
//
// How a preset room's sizes are WRITTEN — "11 × 12 ft", "3,4 × 3,0 m",
// "42 m²" — kept apart from lib/estimate/roomPresets.js so the public form
// can format a size without pulling the painting takeoff engine into the
// browser bundle. No imports; roomPresets.js re-exports all of it, so the
// server, the report and the page format a room through one set of functions.

export const M_PER_FT = 0.3048;
export const SQM_PER_SQFT = M_PER_FT * M_PER_FT; // 0.09290304, exact

const fmt = (n, locale, digits) => {
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(n);
  } catch {
    return String(n);
  }
};

/** Square feet → the region's display area unit, rounded for reading. */
export function areaInUnit(sqft, unit) {
  const n = Number(sqft);
  if (!Number.isFinite(n)) return 0;
  return unit === "ft" ? Math.round(n) : Math.round(n * SQM_PER_SQFT * 10) / 10;
}

/** "sq ft" or "m²" — the unit the area is shown in. */
export function areaUnitLabel(unit) {
  return unit === "ft" ? "sq ft" : "m²";
}

/** "11 × 12 ft" / "3,4 × 3,0 m" in a locale. */
export function dimsText(room, locale = "en-CA") {
  if (!room) return "";
  const digits = room.unit === "ft" ? 0 : 1;
  const unit = room.unit === "ft" ? "ft" : "m";
  return `${fmt(room.length, locale, digits)} × ${fmt(room.width, locale, digits)} ${unit}`;
}

/** "8 ft" / "2,4 m" in a locale. */
export function heightText(room, locale = "en-CA") {
  if (!room) return "";
  return room.unit === "ft"
    ? `${fmt(room.ceilingHeight, locale, 1)} ft`
    : `${fmt(room.ceilingHeight, locale, 2)} m`;
}

/** "452 sq ft" / "42 m²" in a locale. */
export function areaText(sqft, unit, locale = "en-CA") {
  return `${fmt(areaInUnit(sqft, unit), locale, unit === "ft" ? 0 : 1)} ${areaUnitLabel(unit)}`;
}

