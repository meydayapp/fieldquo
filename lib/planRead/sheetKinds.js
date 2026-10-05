// lib/planRead/sheetKinds.js
//
// What KIND of sheet a drawing is — elevation, plan, section, site, schedule,
// photo/3D view, detail, cover — read in code from the sheet's own printed
// titles, so the first pass knows where to measure before any model call.
//
// The owner's live test (St Paul's, 2026-10-05): the set had elevations at
// 1:100 with printed heights (6.8 m), an existing floor plan at 1:100 and a
// cross-section — and the read left every quantity at 0, "no usable
// dimensions", until the estimator named the sheets in chat. A UK planning
// set prints almost no dimension strings; an estimator SCALES it. So the
// measurable sheets get a measurement pass of their own
// (lib/planRead/measurePrompts.js), and this file is how they are found.
//
// A sheet whose titles say nothing (a scan; a set read before the title-block
// fix, every sheet stored as "A-3") is "unknown" — measured anyway, and the
// measurement pass says what it is. Skipping it would be a guess.
//
// Pure.

export const SHEET_KINDS = Object.freeze(["elevation", "plan", "section", "site", "schedule", "photo", "detail", "cover", "unknown"]);

/** Kinds the first pass measures on. */
export const MEASURABLE_KINDS = Object.freeze(["elevation", "plan", "section", "unknown"]);

// Most specific first: "Cross Section - looking south" is a section even
// though it says nothing else; "Roof Plan" is a plan; "3D views" is a photo.
const RULES = Object.freeze([
  ["cover", /\b(?:COVER SHEET|TITLE SHEET|DRAWING (?:INDEX|LIST|SCHEDULE)|SHEET INDEX|CODE (?:ANALYSIS|REVIEW))\b/],
  ["site", /\b(?:LOCATION(?: AND BLOCK)? PLAN|BLOCK PLAN|SITE PLAN|SITE LAYOUT|SURVEY|LANDSCAPE)\b/],
  ["photo", /\b(?:3D|THREE[- ]DIMENSIONAL|PERSPECTIVES?|VIEWS?|VISUALI[SZ]ATIONS?|RENDERS?|RENDERINGS?|PHOTOS?|PHOTOGRAPHS?)\b/],
  ["schedule", /\b(?:SCHEDULES?|LEGEND|SPECIFICATIONS?|NOTES)\b/],
  ["section", /\b(?:SECTIONS?|SECTIONAL)\b/],
  ["elevation", /\bELEVATIONS?\b/],
  ["detail", /\bDETAILS?\b/],
  ["plan", /\bPLANS?\b|\bREFLECTED CEILING\b|\bRCP\b|\bLAYOUT\b/],
]);

function titleText(facts) {
  return [facts?.title, ...(Array.isArray(facts?.titles) ? facts.titles : [])].filter(Boolean).join(" · ").toUpperCase();
}

/**
 * The kind a sheet's titles state, or "unknown". An elevation sheet that is
 * also titled "views" ("Elevations and views") is an elevation: a drawing
 * kind wins over a photo kind when both are printed.
 */
export function sheetKind(facts) {
  const t = titleText(facts);
  if (!t) return "unknown";
  const hits = RULES.filter(([, re]) => re.test(t)).map(([k]) => k);
  if (!hits.length) return "unknown";
  for (const k of ["cover", "site"]) if (hits.includes(k)) return k;
  for (const k of ["elevation", "section", "plan"]) if (hits.includes(k)) return k;
  return hits[0];
}

export function isMeasurableKind(kind) {
  return MEASURABLE_KINDS.includes(kind);
}
