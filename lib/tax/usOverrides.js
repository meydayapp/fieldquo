// lib/tax/usOverrides.js
//
// A company's per-state US overrides — Company.usTaxOverrides — read and
// written through one place so the shape has one definition.
//
//   { "NY": { "mode": "rate", "rate": 8.875 }, "FL": { "mode": "none" } }
//
//   "rate"  charge this on the whole quote in that state. For a company whose
//           registration the tables cannot see: a Texas contractor who writes
//           separated contracts, a New York contractor-retailer, someone whose
//           accountant told them a number.
//   "none"  collect nothing in that state, and say so on the document. A
//           stated position — no nexus there, or "we pay it at the counter".
//
// Absent = automatic (lib/tax/usTaxability.js × the ZIP table). Sits above
// the automatic rung and below a rate typed on the quote itself, and below a
// company TaxRate NAMED after the state, which is the older mechanism and
// still the loudest signal a contractor can give.

import { US_STATES } from "@/lib/tax/usTaxability";

const MODES = new Set(["rate", "none"]);

/** Company.usTaxOverrides → a clean map, dropping anything malformed. */
export function normaliseUsOverrides(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    const state = String(key || "").trim().toUpperCase();
    if (!US_STATES.includes(state)) continue;
    if (!value || typeof value !== "object") continue;
    const mode = String(value.mode || "").trim();
    if (!MODES.has(mode)) continue;
    if (mode === "rate") {
      const rate = Number(value.rate);
      // 0 typed as a rate is "none" said the long way; store the meaning.
      if (!Number.isFinite(rate) || rate < 0 || rate > 30) continue;
      out[state] = rate === 0 ? { mode: "none" } : { mode: "rate", rate: Math.round(rate * 1000) / 1000 };
    } else {
      out[state] = { mode: "none" };
    }
  }
  return out;
}

/** The override for one state, or null. */
export function usOverrideFor(company, state) {
  const map = normaliseUsOverrides(company?.usTaxOverrides);
  const code = String(state || "").trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(map, code) ? map[code] : null;
}

/**
 * Validates a PATCH body's `usTaxOverrides` for the settings route. Returns
 * the map to store, or throws with a message the screen can show. A state
 * with `mode: "auto"` (or null) is removed — that is how "back to automatic"
 * is spelled on the wire.
 */
export function parseUsOverridesInput(raw) {
  if (raw == null) return {};
  if (typeof raw !== "object" || Array.isArray(raw)) throw new Error("usTaxOverrides must be an object keyed by state");
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    const state = String(key || "").trim().toUpperCase();
    if (!US_STATES.includes(state)) throw new Error(`Unknown state "${key}"`);
    if (value == null || value.mode === "auto") continue;
    if (typeof value !== "object") throw new Error(`Bad override for ${state}`);
    const mode = String(value.mode || "");
    if (!MODES.has(mode)) throw new Error(`Bad mode "${value.mode}" for ${state}`);
    if (mode === "rate") {
      const rate = Number(value.rate);
      if (!Number.isFinite(rate) || rate < 0 || rate > 30)
        throw new Error(`Rate for ${state} must be a percentage between 0 and 30`);
      out[state] = rate === 0 ? { mode: "none" } : { mode: "rate", rate: Math.round(rate * 1000) / 1000 };
    } else {
      out[state] = { mode: "none" };
    }
  }
  return out;
}
