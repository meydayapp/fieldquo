// lib/planRead/fallbacks.js
//
// Every input the drawing read and the quote builder's costing price with
// that a company may not have set — and what happens when it hasn't. The
// owner (2026-10-05): "we shouldn't let it fail silently because something
// was missing." Each one now either uses a STATED default with a visible
// "using default — set yours" and a link, or shows a specific message naming
// the missing setting and linking to it. Never a silent zero.
//
// scripts/check-plan-read-first-pass.mjs pins this list: every entry's
// `shownAs` words must be in the file that says them, so a fallback cannot
// quietly lose its label.
//
// Pure data.

export const FALLBACKS = Object.freeze([
  { input: "Access rental rates", missing: "no rate of the company's for the equipment", now: "FieldQuo default (Craftsman 2023 rental table, converted) — labelled on the line, link to Settings → Services → Equipment & access", shownAs: "FieldQuo default, not your rate", file: "lib/pricing/paintHeightPrep.js", link: "/app/settings/services#equipment-access" },
  { input: "Access rental rates (no exchange rate / no cited figure)", missing: "a currency FieldQuo has no dated rate for, or a crane", now: "NOT priced, with the reason and the setting to fill — never $0", shownAs: "NOT priced:", file: "lib/pricing/paintHeightPrep.js", link: "/app/settings/services#equipment-access" },
  { input: "Delivery and pickup", missing: "no per-trip figure", now: "left out, said on the crew plan and as a check", shownAs: "Delivery and pickup of lifts and towers are not included", file: "lib/planRead/firstPass.js", link: "/app/settings/services#equipment-access" },
  { input: "Painting production rates", missing: "company never edited its painting rates", now: "FieldQuo's preset rates — said on the draft, and a check with a link", shownAs: "Priced at FieldQuo's default painting rates, not yours", file: "lib/planRead/review.js", link: "/app/settings/services" },
  { input: "Trade rates (drywall, electrical…)", missing: "no rate card or service for the item", now: "FieldQuo suggestion (labelled, cited) or \"No rate — add one\"", shownAs: "No rate — add one", file: "lib/planRead/tradePricing.js", link: "/app/settings/services" },
  { input: "Labour cost rate", missing: "no field worker with a pay rate", now: "FieldQuo's $35/h default — labelled on the recommendation, a check with a link", shownAs: "Labour cost at FieldQuo's", file: "lib/planRead/review.js", link: "/app/settings/team/workers#pay-rates" },
  { input: "Overhead and billable hours", missing: "no fixed costs / billable hours", now: "10% of price (or per job) — labelled, a check with a link", shownAs: "a FieldQuo estimate", file: "lib/planRead/review.js", link: "/app/settings/overhead" },
  { input: "Paint price", missing: "a product with no cost per gallon", now: "counted, not costed — the line count is said, and a check", shownAs: "use a paint with no price", file: "lib/planRead/review.js", link: "/app/settings/services" },
  { input: "Prep material prices", missing: "no price of the company's", now: "US shelf price default — labelled \"FieldQuo default … set yours\" on the line; masonry primer follows primer", shownAs: "FieldQuo default —", file: "lib/pricing/paintHeightPrep.js", link: "/app/settings/services#prep-materials" },
  { input: "Target margin", missing: "no target set", now: "20% default — labelled, a check with a link", shownAs: "Target margin at FieldQuo's", file: "lib/planRead/review.js", link: "/app/settings/overhead" },
  { input: "Crew size", missing: "no crew on the read, the company or the Team page", now: "2 painters — said on the crew plan, a check", shownAs: "FieldQuo's default of", file: "lib/planRead/firstPass.js", link: "/app/settings/team/workers" },
  { input: "Productive hours a day", missing: "no figure on the read or the company", now: "7.5 h (6 on restricted sites) — said on the crew plan", shownAs: "productive hours a painter a day", file: "lib/planRead/firstPass.js", link: "/app/settings/services#prep-materials" },
  { input: "Height factors", missing: "company never set its own", now: "the book's factors (NPC 2014 p. 139) — named on every height line", shownAs: "High Time Difficulty Factors", file: "lib/pricing/paintHeightPrep.js", link: "/app/settings/services#prep-materials" },
  { input: "Prep allowances", missing: "company never set its own", now: "Resene productivity figures — named on every prep line", shownAs: "Resene Paints, Productivity Tables", file: "lib/pricing/paintHeightPrep.js", link: "/app/settings/services#prep-materials" },
  { input: "Wall / storey height", missing: "nothing on the set states it", now: "assumed 3.0 m (9 ft) — said on the quantity, a check", shownAs: "storey height — nothing on the set states one, verify", file: "lib/planRead/takeoff.js", link: null },
  { input: "A surface's quantity", missing: "nothing measured it", now: "named as not priced — a banner and a check, never a silent 0", shownAs: "has no quantity and is not priced", file: "lib/planRead/review.js", link: null },
]);
