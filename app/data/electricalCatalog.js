// app/data/electricalCatalog.js
//
// The electrical price book: the LIST of things a residential electrician
// habitually bills, and habitually forgets to bill.
//
// This is the client-facing half of the electrical price book. It plugs into
// app/data/defaultLineItems.js (which owns the `electrical` key and wires this
// array in) and is consumed by the quote builder's suggestion chips, which read
// `description` and `unit` and nothing else.
//
// Its two internal companions must never reach a client surface:
//   app/data/electricalBenchmarks.js  — "typical range, set your price"
//   app/data/electricalMaterials.js   — internal cost defaults
//
// ── Prices are deliberately absent ──────────────────────────────────────────
//
// No entry carries a `rate`, and adding one would be a regression, not an
// improvement. defaultLineItems.js states the rule and the reason: a plausible
// default lands on a document a homeowner signs, unread. Part 1 of
// docs/trade-pricing-research.md is fifteen real estimates and the same
// nominal job spans 2.1× across them ($21,915 vs $46,433 for a whole-house
// rewire) — there is no number that is right for the trade.
//
// What ships instead is the list plus, in electricalBenchmarks.js, a range the
// contractor is shown and asked to price against. Part 4 rule #2.
//
// ── Every line is something a real estimate bills ───────────────────────────
//
// Each entry's evidence lives in the matching benchmark's `basis` string.
// Nothing was added because it seemed plausible: the granular ones
// (`cut_in_box`, `wire_fishing`, `emt_first_10ft`) are literal task codes off
// Part 1's pricebook estimates, and the two `*_clause` lines at $0 are Part
// 2B.1's strongest finding — exclusions read as line items in the price table
// instead of buried in a terms paragraph, where §2.5 says they cause disputes.
//
// ── Why entries carry a `key` ───────────────────────────────────────────────
//
// DEFAULT_LINE_ITEMS entries are `{ description, unit }` and the builder reads
// exactly those two fields, so the extra `key` is inert there. It exists
// because electricalBenchmarks.js has to point at these lines, and pointing by
// description string would silently break the moment somebody improves the
// wording — the written-never-read failure class, arriving as a benchmark
// nobody can reach. scripts/check-electrical-catalog.mjs asserts the two files
// stay 1:1 in both directions.

// unit values match what the quote builder writes onto a line item, and the
// first four are byte-identical to defaultLineItems.js. HOUR is defined here
// rather than there because electrical is the first trade to need it: §2C.3
// found that "per circuit" troubleshooting does not exist in the market —
// everyone prices diagnosis per visit or per hour — and Part 1's chandelier
// line ("2 men required") is billed in man-hours. `unit` is a free String in
// the schema, so adding one costs nothing.
const FLAT = "flat";
const EACH = "each";
const SQFT = "sqft";
const LF = "linear_ft";
const HOUR = "hour";

export const ELECTRICAL_UNITS = { FLAT, EACH, SQFT, LF, HOUR };

const RAW_LINE_ITEMS = [
  // ── Attending the call ────────────────────────────────────────────────────
  // Part 1 shows dispatch and service fees as separate, visible lines; §2.2
  // shows the trip fee is a different thing again, and whether it is credited
  // back on approval is a live fork in the trade, not a default.
  { key: "service_call", description: "Service call / dispatch fee", unit: FLAT },
  { key: "diagnostic", description: "Diagnostic & troubleshooting — first hour", unit: FLAT },
  { key: "labour_hourly", description: "Additional labour", unit: HOUR },
  { key: "second_electrician", description: "Second electrician — additional labour", unit: HOUR },
  { key: "after_hours", description: "After-hours / emergency premium", unit: FLAT },
  { key: "travel_fee", description: "Travel fee — outside standard service area", unit: FLAT },

  // ── Service, panel and grounding ──────────────────────────────────────────
  { key: "panel_replacement", description: "Electrical panel replacement — same amperage", unit: EACH },
  {
    key: "service_upgrade_200a",
    description: "Service upgrade to 200 A — panel, meter base, riser, grounding and utility coordination",
    unit: EACH,
  },
  { key: "service_upgrade_400a", description: "Service upgrade to 400 A", unit: EACH },
  { key: "meter_base", description: "Meter base / meter-main combination & service riser — replace", unit: EACH },
  { key: "subpanel", description: "Subpanel — supply & install", unit: EACH },
  { key: "subpanel_feeder", description: "Feeder run to subpanel", unit: LF },
  { key: "firewall_enclosure", description: "Fire-rated enclosure for panel", unit: EACH },
  { key: "grounding_system", description: "Grounding electrode system — install or upgrade", unit: FLAT },
  { key: "surge_protector", description: "Whole-home surge protector — supply & install", unit: EACH },

  // ── Breakers and circuits ─────────────────────────────────────────────────
  { key: "breaker_standard", description: "Circuit breaker — supply & install", unit: EACH },
  { key: "breaker_afci_gfci", description: "AFCI / GFCI breaker — supply & install", unit: EACH },
  { key: "dedicated_circuit", description: "Dedicated 15/20 A circuit — new", unit: EACH },
  { key: "circuit_240v", description: "240 V dedicated circuit — range, dryer, air conditioner or EV", unit: EACH },
  { key: "ev_charger_install", description: "EV charger installation — charger supplied by client", unit: EACH },

  // ── Rewiring and remediation ──────────────────────────────────────────────
  { key: "whole_house_rewire", description: "Whole-house rewire", unit: SQFT },
  { key: "rewire_per_opening", description: "Rewiring — per opening (outlet, switch or fixture)", unit: EACH },
  { key: "knob_tube_replacement", description: "Knob & tube wiring replacement", unit: SQFT },
  { key: "aluminium_pigtail", description: "Aluminium wiring remediation — pigtail connectors, whole home", unit: FLAT },
  { key: "aluminium_copalum", description: "Aluminium wiring remediation — COPALUM crimp, whole home", unit: FLAT },
  { key: "wire_fishing", description: "Wire fishing through a finished wall or ceiling", unit: EACH },
  { key: "cut_in_box", description: "Cut-in box, new location", unit: EACH },
  { key: "junction_box", description: "Junction box — replace or install", unit: EACH },
  { key: "emt_first_10ft", description: "Surface conduit run — first 10 ft, wiring extra", unit: FLAT },
  { key: "cable_run_50ft", description: "Cable run to an existing circuit — up to 50 ft", unit: FLAT },

  // ── Receptacles and switches ──────────────────────────────────────────────
  { key: "receptacle_replace", description: "Receptacle — replace existing", unit: EACH },
  { key: "receptacle_new", description: "Receptacle — new location", unit: EACH },
  { key: "gfci_receptacle", description: "GFCI receptacle — supply & install", unit: EACH },
  { key: "weatherproof_cover", description: "Weatherproof in-use cover — exterior receptacle", unit: EACH },
  { key: "switch_replace", description: "Switch — replace existing", unit: EACH },
  { key: "dimmer_smart_switch", description: "Dimmer or smart switch — supply & install", unit: EACH },

  // ── Lighting and fans ─────────────────────────────────────────────────────
  { key: "fixture_swap", description: "Light fixture — replace (fixture supplied by client)", unit: EACH },
  { key: "recessed_new", description: "Recessed light — new install", unit: EACH },
  { key: "recessed_retrofit", description: "Recessed light — retrofit into existing ceiling", unit: EACH },
  { key: "ceiling_fan_existing_box", description: "Ceiling fan — install on existing fan-rated box", unit: EACH },
  { key: "ceiling_fan_new_box", description: "Ceiling fan — install with new fan-rated box", unit: EACH },
  { key: "fixture_support_brace", description: "Fan / heavy-fixture support brace & box", unit: EACH },
  { key: "heavy_fixture", description: "Chandelier or heavy fixture — over 50 lb, or ceiling above 12 ft", unit: EACH },

  // ── Safety and low voltage ────────────────────────────────────────────────
  { key: "smoke_co_alarm", description: "Smoke / CO alarm — interconnected, hardwired", unit: EACH },
  { key: "data_drop", description: "Data or coax drop — per drop", unit: EACH },

  // ── Generator ─────────────────────────────────────────────────────────────
  { key: "generator_inlet_interlock", description: "Generator inlet & panel interlock", unit: EACH },
  { key: "transfer_switch", description: "Transfer switch — supply & install", unit: EACH },

  // ── Site work ─────────────────────────────────────────────────────────────
  { key: "trenching", description: "Trenching for underground circuit", unit: LF },

  // ── Permits, inspection and the extras that get forgotten ─────────────────
  { key: "permit", description: "Electrical permit", unit: FLAT },
  { key: "reinspection", description: "Re-inspection — failed or rescheduled inspection", unit: FLAT },
  { key: "drywall_patch", description: "Drywall patch & paint after wall access", unit: EACH },
  { key: "disposal", description: "Disposal — removed panel, fixtures and cable", unit: FLAT },

  // Zero-priced clause lines. Part 2B.1: an $18k repipe carried its excavation
  // and general-damage exclusions as $0.00 rows inside the price table, so the
  // client reads them while reading the price and accepts them by accepting the
  // quote. §2.5 names buried exclusions as a top dispute cause and this is the
  // fix; it costs nothing. They are offers like every other chip — nothing is
  // added to a quote automatically.
  { key: "drywall_exclusion", description: "Drywall and paint repair — not included", unit: FLAT },
  { key: "concealed_conditions_clause", description: "Concealed conditions behind walls — not included", unit: FLAT },
];

// ── Grouping ────────────────────────────────────────────────────────────────
//
// Fifty-four chips in one undifferentiated row is not a picker, it's a wall.
// The other trades in defaultLineItems.js ship six to nine lines and get away
// without groups; this one and plumbing don't, so both carry a `group` and the
// builder renders them as sections.
//
// Assignment lives in one map rather than on each line above, so re-grouping is
// one edit instead of fifty-four. check:electrical fails on a line missing from
// the map — an ungrouped chip would silently disappear from a sectioned picker,
// which is the quiet version of a control that doesn't work.
export const ELECTRICAL_LINE_ITEM_GROUPS = [
  { key: "service", label: "Service calls & labour" },
  { key: "service_panel", label: "Service, panels & grounding" },
  { key: "circuits", label: "Circuits & breakers" },
  { key: "rewire", label: "Rewiring & cable runs" },
  { key: "devices", label: "Outlets, switches & data" },
  { key: "lighting", label: "Lighting, fans & alarms" },
  { key: "backup", label: "Generators & site work" },
  { key: "admin", label: "Permits, repairs & exclusions" },
];

const GROUP_BY_KEY = {
  service_call: "service", diagnostic: "service", labour_hourly: "service",
  second_electrician: "service", after_hours: "service", travel_fee: "service",

  panel_replacement: "service_panel", service_upgrade_200a: "service_panel",
  service_upgrade_400a: "service_panel", meter_base: "service_panel",
  subpanel: "service_panel", subpanel_feeder: "service_panel",
  firewall_enclosure: "service_panel", grounding_system: "service_panel",
  surge_protector: "service_panel",

  breaker_standard: "circuits", breaker_afci_gfci: "circuits",
  dedicated_circuit: "circuits", circuit_240v: "circuits",
  ev_charger_install: "circuits",

  whole_house_rewire: "rewire", rewire_per_opening: "rewire",
  knob_tube_replacement: "rewire", aluminium_pigtail: "rewire",
  aluminium_copalum: "rewire", wire_fishing: "rewire", cut_in_box: "rewire",
  junction_box: "rewire", emt_first_10ft: "rewire", cable_run_50ft: "rewire",

  receptacle_replace: "devices", receptacle_new: "devices",
  gfci_receptacle: "devices", weatherproof_cover: "devices",
  switch_replace: "devices", dimmer_smart_switch: "devices",
  data_drop: "devices",

  fixture_swap: "lighting", recessed_new: "lighting",
  recessed_retrofit: "lighting", ceiling_fan_existing_box: "lighting",
  ceiling_fan_new_box: "lighting", fixture_support_brace: "lighting",
  heavy_fixture: "lighting", smoke_co_alarm: "lighting",

  generator_inlet_interlock: "backup", transfer_switch: "backup",
  trenching: "backup",

  permit: "admin", reinspection: "admin", drywall_patch: "admin",
  disposal: "admin", drywall_exclusion: "admin",
  concealed_conditions_clause: "admin",
};

export const ELECTRICAL_LINE_ITEMS = RAW_LINE_ITEMS.map((item) => ({
  ...item,
  group: GROUP_BY_KEY[item.key],
}));
