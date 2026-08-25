// lib/pricing/takeoffTrades.js
//
// Which trades are quoted from a structured takeoff.
//
// ── Why it isn't just "does tradeScope have a builder for it" ───────────────
//
// BUILDERS in lib/pricing/tradeScope.js also covers cabinet_refinishing and
// cabinet_refacing, which are NOT takeoff trades: they are priced per door and
// per drawer through app/data/cabinetPricing, and the builder screen gives them
// unit-pricing fields instead of a takeoff form. Treating "has a builder" as
// "has a takeoff" would give a cabinet group BOTH — the derived lines and the
// units × price base line — and double-charge the client.
//
// ── Why it isn't left in the component either ───────────────────────────────
//
// It used to live next to the takeoff form components in TradeTakeoff.js, which
// meant the money code could only ask the question by importing a React
// component — and lib/quotes/builderPayload.js has to ask it, from a module a
// plain-node check script executes. So the LIST lives here and the component
// map lives there, and scripts/check-takeoff-render.jsx asserts the two match
// so a form added without a list entry (or the reverse) fails the build rather
// than rendering a takeoff whose lines never price.

export const TAKEOFF_TRADES = [
  "stairs",
  "countertop",
  "garage_door",
  "interior_painting",
  "exterior_painting",
  "flooring",
  "driveway_sealing",
  "home_inspection",
  "paving",
  "roofing_service",
  "siding",
  "insulation",
  "snow_removal",
];

export function hasTakeoff(categoryKey) {
  return TAKEOFF_TRADES.includes(categoryKey);
}
