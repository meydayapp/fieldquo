// lib/planRead/dimensions.js
//
// Dimension strings and drawing scales, read in CODE — never by a model.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// A drawing set states its own lengths. "42'-6"" printed on an elevation is
// a fact the architect wrote down; a model asked "how long is this wall?" is
// a guess that looks exactly as trustworthy on screen. So the arithmetic that
// turns a printed dimension into feet, and two of them into square feet, is
// done here, deterministically, and the model's only job is saying WHICH
// printed dimensions belong to which surface (lib/planRead/projectModel.js).
//
// ══ What it reads ══════════════════════════════════════════════════════════
//
//   imperial   12'-6"   12' 6"   12'6"   12 ft 6 in   12'-6 1/2"   12'-6½"
//              12'      6"       3/4"    12.5'        1'-0"
//   metric     3800 mm  3,800 mm 3.8 m   380 cm       3800 (bare — only on a
//              sheet whose scale is metric, and flagged unitAssumed)
//   scale      1/4" = 1'-0"   3/32"=1'-0"   1 1/2" = 1'-0"   1" = 20'
//              1:100   1 : 50   N.T.S.   NOT TO SCALE
//
// Anything it cannot read with certainty is dropped, not guessed: an inches
// figure of 12 or more after a feet mark ("12'-14"") is a typo on the sheet,
// and a number with no unit on an imperial sheet is a room number, a door
// tag or a grid line until proven otherwise.
//
// ══ No imports ═════════════════════════════════════════════════════════════
//
// Runs in the browser (the measure tool reads a sheet's scale), on the server
// and in scripts/check-plan-deep-read.mjs.

export const FEET_PER_METRE = 3.280839895;
export const METRES_PER_FOOT = 0.3048;
export const SQFT_PER_M2 = 10.7639104;

const round = (n, dp = 4) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

const VULGAR = {
  "½": " 1/2",
  "¼": " 1/4",
  "¾": " 3/4",
  "⅛": " 1/8",
  "⅜": " 3/8",
  "⅝": " 5/8",
  "⅞": " 7/8",
  "⅓": " 1/3",
  "⅔": " 2/3",
  "⅙": " 1/6",
};

/**
 * One spelling for the marks a PDF can carry: primes, curly quotes, en and
 * em dashes, vulgar fractions, the fraction slash. Pure.
 */
export function normaliseDimensionText(raw) {
  let s = String(raw ?? "");
  s = s.replace(/[½¼¾⅛⅜⅝⅞⅓⅔⅙]/g, (c) => VULGAR[c] || c);
  s = s
    .replace(/[′’‘`´]/g, "'")
    .replace(/[″“”]/g, '"')
    .replace(/''/g, '"')
    .replace(/[‐‑‒–—−]/g, "-")
    .replace(/⁄/g, "/")
    .replace(/ /g, " ");
  return s;
}

const frac = (n, d) => {
  const a = Number(n);
  const b = Number(d);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0 || a < 0 || a >= b * 16) return null;
  return a / b;
};

// feet, then optional inches (whole/decimal) with an optional fraction, or a
// fraction alone. The feet mark is required; the inch mark is optional after
// it ("12'-6" is how half the world's CAD exports print it).
const FEET_INCH =
  /(?<![\d./])(\d{1,4}(?:\.\d+)?)\s*(?:'|ft\.?|feet)(?:\s*-?\s*(?:(\d{1,2}(?:\.\d+)?)(?:\s*[- ]\s*(\d{1,2})\/(\d{1,2}))?|(\d{1,2})\/(\d{1,2}))\s*(?:"|in\.?\b|inch(?:es)?\b)?)?/gi;
// inches alone: 6"  6 1/2"  3/4"  — the inch MARK is required here, so a
// bare "6" never becomes six inches.
const INCH_ONLY = /(?<![\d./'])(?:(\d{1,3}(?:\.\d+)?)(?:\s*[- ]\s*(\d{1,2})\/(\d{1,2}))?|(\d{1,2})\/(\d{1,2}))\s*(?:"|in\.(?!\w)|inch(?:es)?\b)/gi;
// metric with a unit. Thousands may be grouped with a comma or a thin space.
// The unit spelled out too — a UK planning drawing writes "6.75 metres" and
// "2.1 metres", which the symbol-only pattern read as nothing (the Egham
// Hythe church set, 2026-10-04). Longest spelling first in the alternation.
const METRIC =
  /(?<![\d.,])(\d{1,3}(?:[, ]\d{3})+|\d+(?:\.\d+)?)\s*(millimet(?:re|er)s?|centimet(?:re|er)s?|met(?:re|er)s?|mm|cm|m)\b(?!²|2)/gi;
// a bare 4–5 digit number standing alone — millimetres on a metric sheet.
// Not 3 digits: "101" on a metric plan is far more often a room number than
// a 101 mm dimension, and a dropped dimension costs less than an invented one.
const BARE_MM = /^(\d{4,5})$/;
// a bare ONE-decimal number standing alone — metres on a metric sheet: a UK
// planning plan prints a room as "4.7" by "5.2" with no unit at all. One
// decimal only: "1.01" / "2.14" is how UK plans number rooms (floor.room),
// and a room number read as a wall would be an invented dimension.
const BARE_M = /^(\d{1,2}\.\d)$/;

/**
 * Every dimension in one line of drawing text. Pure.
 *
 * @param {string} text
 * @param {{ metric?: boolean }} opts  metric: the sheet's scale is a ratio
 *   (1:100) — then a bare 3–5 digit number that IS the whole text item is
 *   taken as millimetres, flagged `unitAssumed`.
 * @returns {{ raw, feet, metres, system, unitAssumed, index }[]}
 */
export function findDimensions(text, { metric = false } = {}) {
  const s = normaliseDimensionText(text);
  const out = [];
  const taken = [];
  const overlaps = (a, b) => taken.some(([x, y]) => a < y && b > x);
  const push = (m, feet, system, unitAssumed = false, assumedUnit = null) => {
    if (!Number.isFinite(feet) || feet <= 0 || feet > 5000) return;
    const start = m.index;
    const end = m.index + m[0].length;
    if (overlaps(start, end)) return;
    taken.push([start, end]);
    out.push({
      raw: m[0].trim(),
      feet: round(feet),
      metres: round(feet * METRES_PER_FOOT),
      system,
      unitAssumed,
      // Which unit was assumed for a bare number — "mm" or "m" — so the
      // source sentence says what it took the number to be.
      ...(unitAssumed ? { assumedUnit } : {}),
      index: start,
    });
  };

  for (const m of s.matchAll(FEET_INCH)) {
    const ft = Number(m[1]);
    let inches = 0;
    if (m[2] !== undefined) {
      inches = Number(m[2]);
      if (m[3] !== undefined) {
        const f = frac(m[3], m[4]);
        if (f === null) continue;
        inches += f;
      }
    } else if (m[5] !== undefined) {
      const f = frac(m[5], m[6]);
      if (f === null) continue;
      inches = f;
    }
    // 12'-14" is a typo, not 13'-2". Refused rather than normalised — and
    // the span is claimed, so the inches-only reader below cannot pick the
    // "14"" back out of it and call it fourteen inches.
    if (!Number.isFinite(inches) || inches >= 12) {
      taken.push([m.index, m.index + m[0].length]);
      continue;
    }
    push(m, ft + inches / 12, "imperial");
  }
  for (const m of s.matchAll(INCH_ONLY)) {
    let inches;
    if (m[1] !== undefined) {
      inches = Number(m[1]);
      if (m[2] !== undefined) {
        const f = frac(m[2], m[3]);
        if (f === null) continue;
        inches += f;
      }
    } else {
      inches = frac(m[4], m[5]);
      if (inches === null) continue;
    }
    push(m, inches / 12, "imperial");
  }
  for (const m of s.matchAll(METRIC)) {
    const n = Number(m[1].replace(/[, ]/g, ""));
    const unit = m[2].toLowerCase();
    const metres = unit === "mm" || unit.startsWith("millim") ? n / 1000 : unit === "cm" || unit.startsWith("centim") ? n / 100 : n;
    push(m, metres * FEET_PER_METRE, "metric");
  }
  if (metric && !out.length) {
    const m = BARE_MM.exec(s.trim());
    if (m) {
      const n = Number(m[1]);
      // 1–60 m: a wall, a room, a storey. Outside that it is a code.
      if (n >= 1000 && n <= 60000) {
        push({ index: 0, 0: m[1] }, (n / 1000) * FEET_PER_METRE, "metric", true, "mm");
      }
    }
    const dm = BARE_M.exec(s.trim());
    if (dm) {
      const n = Number(dm[1]);
      // 0.5–60 m. Below half a metre a bare decimal is a level or a note.
      if (n >= 0.5 && n <= 60) push({ index: 0, 0: dm[1] }, n * FEET_PER_METRE, "metric", true, "m");
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

/** The first dimension in a string, or null. Pure. */
export function parseDimension(text, opts) {
  return findDimensions(text, opts)[0] || null;
}

/**
 * "12'-6" x 14'-0"" — a room size, two dimensions joined by x / × / by.
 * Returns the pairs found in one line. Pure.
 */
export function findDimensionPairs(text, opts) {
  const s = normaliseDimensionText(text);
  const dims = findDimensions(s, opts);
  const pairs = [];
  for (let i = 0; i + 1 < dims.length; i++) {
    const a = dims[i];
    const b = dims[i + 1];
    const between = s.slice(a.index + a.raw.length, b.index);
    if (/^\s*(?:x|×|X|by)\s*$/.test(between)) pairs.push([a, b]);
  }
  return pairs;
}

/**
 * What a line says about the dimension in it: an overall length, a height
 * (ceiling height, A.F.F., wall height) or a level (EL. / T.O.). Pure.
 */
export function dimensionKind(lineText) {
  const s = String(lineText || "").toUpperCase();
  if (/\b(?:EL\.?|ELEV\.?|T\.?\s?O\.?|B\.?\s?O\.?|TOP OF|BOTTOM OF|F\.?F\.?E\.?|LEVEL)\b/.test(s)) return "elevation";
  if (/\b(?:CLG|CEILING|C\.?L\.?G\.?|HT\.?|HEIGHT|HGT|A\.?F\.?F\.?|PLATE|EAVE|RIDGE|PARAPET)\b/.test(s)) return "height";
  return "length";
}

// ═══════════════════════════════════════════════════════════════════════════
// SCALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * A drawing scale, as REAL inches per PAPER inch (`ratio`): 1/4" = 1'-0" is
 * 48, 1:100 is 100, 1" = 20' is 240. Null when the text states none; `nts`
 * when it says the drawing is not to scale — which is a statement, and the
 * measure tool must refuse to measure on it rather than assume one. Pure.
 */
export function parseScale(text) {
  const s = normaliseDimensionText(text);
  if (/\bN\.?\s?T\.?\s?S\.?(?![A-Z])|NOT\s+TO\s+SCALE/i.test(s)) return { text: "NTS", ratio: null, nts: true, system: null };

  // 1/4" = 1'-0"   1 1/2" = 1'-0"   3" = 1'-0"
  const arch = /(?:(\d{1,2})\s+)?(\d{1,2})(?:\/(\d{1,3}))?\s*"\s*=\s*1\s*'\s*(?:-?\s*0\s*"?)?/.exec(s);
  if (arch) {
    const whole = arch[1] ? Number(arch[1]) : 0;
    const part = arch[3] ? frac(arch[2], arch[3]) : Number(arch[2]);
    const paperInchesPerFoot = whole + (part ?? NaN);
    if (Number.isFinite(paperInchesPerFoot) && paperInchesPerFoot > 0 && paperInchesPerFoot <= 12) {
      return { text: arch[0].trim(), ratio: round(12 / paperInchesPerFoot, 6), nts: false, system: "imperial" };
    }
  }
  // 1" = 20'   1" = 20'-0"  (engineering)
  const eng = /1\s*"\s*=\s*(\d{1,4})\s*'(?:\s*-?\s*0\s*"?)?/.exec(s);
  if (eng) {
    const ft = Number(eng[1]);
    if (ft > 0) return { text: eng[0].trim(), ratio: ft * 12, nts: false, system: "imperial" };
  }
  // 1:100   1 : 50   SCALE 1/100 (a European title block's spelling)
  const met = /(?<![\d.])1\s*:\s*(\d{1,5})(?![\d.])/.exec(s) || /SCALE\s*:?\s*1\s*\/\s*(\d{2,5})(?![\d"])/i.exec(s);
  if (met) {
    const n = Number(met[1]);
    if (n >= 1 && n <= 10000) return { text: met[0].trim(), ratio: n, nts: false, system: "metric" };
  }
  return null;
}

/**
 * Feet on the ground per PIXEL of a rendered sheet image, from the sheet's
 * scale. The page's width in PDF points (1/72 in) and the image's width in
 * pixels fix how much paper one pixel is; the scale says how much ground a
 * paper inch is. Null when anything is missing — never a default scale.
 */
export function feetPerPixelFromScale({ ratio, pointsWidth, pixelWidth }) {
  const r = Number(ratio);
  const pw = Number(pointsWidth);
  const px = Number(pixelWidth);
  if (!(r > 0) || !(pw > 0) || !(px > 0)) return null;
  const paperInchesPerPixel = pw / 72 / px;
  return (paperInchesPerPixel * r) / 12;
}

/** "42'-6"" for a length in feet; metric as "12.95 m". Pure. */
export function formatFeet(feet, { system = "imperial" } = {}) {
  const f = Number(feet);
  if (!Number.isFinite(f) || f < 0) return "";
  if (system === "metric") return `${round(f * METRES_PER_FOOT, 2)} m`;
  let whole = Math.floor(f);
  let inches = Math.round((f - whole) * 12 * 2) / 2;
  if (inches >= 12) {
    whole += 1;
    inches -= 12;
  }
  const inchText = Number.isInteger(inches) ? String(inches) : `${Math.floor(inches)} 1/2`;
  return `${whole}'-${inchText}"`;
}
