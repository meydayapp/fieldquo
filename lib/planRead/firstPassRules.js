// lib/planRead/firstPassRules.js
//
// What the first pass PRICES ON instead of asking. The owner's live test
// (2026-10-05): the read listed good open questions — substrate, colours,
// heritage, site access, an occupied building — and priced as if none of them
// mattered. Now the synthesis states, for each, the assumption it priced on
// and why ("assumed"); the estimator changes one with a single tap, and the
// read re-prices in code (lib/planRead/firstPass.js) — no model call.
//
// Each option's effect on the price is in firstPass.js, from the cited
// figures in lib/planRead/referenceTables.js. Every option here does
// something; there is no choice on this list that changes nothing.
//
// Pure.

import { PREP_CONDITIONS } from "./referenceTables";

export const ASSUMED = Object.freeze({
  exteriorSurface: Object.freeze({
    label: "Outside walls are",
    options: Object.freeze(["painted_masonry", "bare_masonry", "render", "timber", "mixed", "none"]),
  }),
  interiorSurface: Object.freeze({
    label: "Inside walls are",
    options: Object.freeze(["painted_plaster", "bare_plaster", "drywall", "painted_masonry", "bare_masonry", "mixed", "none"]),
  }),
  colours: Object.freeze({ label: "Colours", options: Object.freeze(["1", "2", "3", "4"]) }),
  heritage: Object.freeze({ label: "Heritage restrictions", options: Object.freeze(["none", "listed"]) }),
  siteHours: Object.freeze({ label: "Site access and working hours", options: Object.freeze(["normal", "restricted", "out_of_hours"]) }),
  occupied: Object.freeze({ label: "Building in use while we work", options: Object.freeze(["no", "yes"]) }),
});

export const ASSUMED_KEYS = Object.freeze(Object.keys(ASSUMED));

/** "none" as a substrate means "no prep allowance" — the option list keeps it
 *  for a scope with no walls on that side. Every other one maps to steps. */
export function substratePrep(value) {
  return value && Object.hasOwn(PREP_CONDITIONS, value) ? PREP_CONDITIONS[value] : null;
}

/** The synthesis's `assumed` object (or a stored one) cleaned. Pure. */
export function cleanAssumed(raw, source = "ai") {
  const out = {};
  for (const key of ASSUMED_KEYS) {
    const v = raw?.[key];
    const value = typeof v === "object" && v ? v.value : v;
    if (typeof value !== "string" || !ASSUMED[key].options.includes(value)) continue;
    const basis = typeof v?.basis === "string" ? v.basis.replace(/\s+/g, " ").trim().slice(0, 200) : "";
    out[key] = { value, basis, source: v?.source === "person" ? "person" : source };
  }
  return out;
}

/** The JSON-schema fragment the synthesis fills (strict: every key, enums). */
export function assumedSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [...ASSUMED_KEYS],
    properties: Object.fromEntries(
      ASSUMED_KEYS.map((k) => [
        k,
        {
          type: "object",
          additionalProperties: false,
          required: ["value", "basis"],
          properties: { value: { type: "string", enum: [...ASSUMED[k].options] }, basis: { type: "string" } },
        },
      ]),
    ),
  };
}
