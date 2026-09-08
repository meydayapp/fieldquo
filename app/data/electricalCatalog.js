// app/data/electricalCatalog.js
//
// The electrical price book: the LIST of things a residential electrician
// habitually bills, and habitually forgets to bill.
//
// This is the client-facing half of the electrical price book. It plugs into
// app/data/defaultLineItems.js (which owns the `electrical` key and wires this
// array in) and is consumed by the quote builder's suggestion chips, which read
// `description`, `unit` and — since ELECTRICAL_LINE_DETAILS below — `detail`,
// the scope sentence copied under the name when a chip becomes a line.
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
// DEFAULT_LINE_ITEMS entries are `{ description, unit, detail }` and the
// builder reads exactly those fields, so the extra `key` is inert there. It exists
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

// ── Scope lines ─────────────────────────────────────────────────────────────
//
// The sentence printed under each line on the client's document and handed to
// the AI review beside the name — see the `detail` note in defaultLineItems.js.
// Keyed like the groups, and for the same reason: one map, checked for 1:1
// coverage by scripts/check-addon-descriptions.mjs, rather than a field on
// each of fifty-four lines. What is done, per what unit. Nothing here states a
// price, a brand, a code clause or a permit outcome — those are the company's
// to promise, in the scope paragraph or on the line itself.
export const ELECTRICAL_LINE_DETAILS = {
  service_call: "Electrician dispatched to the site to assess the work, per visit.",
  diagnostic: "Trace and diagnose the fault, first hour on site included.",
  labour_hourly: "Additional electrician time beyond the scope described above, per hour.",
  second_electrician: "Second electrician on site for work that needs two people, per hour.",
  after_hours: "Premium for attending outside standard working hours.",
  travel_fee: "Travel to a site outside the standard service area.",
  panel_replacement: "Remove the existing panel and install a new one at the same amperage, circuits re-landed and labelled.",
  service_upgrade_200a: "Replace the service with 200 A equipment: panel, meter base, riser and grounding, coordinated with the utility.",
  service_upgrade_400a: "Replace the service with 400 A equipment, coordinated with the utility.",
  meter_base: "Replace the meter base or meter-main combination and the service riser.",
  subpanel: "Supply and install a subpanel, feeder breaker landed in the main panel.",
  subpanel_feeder: "Run the feeder cable from the main panel to the subpanel, per linear foot.",
  firewall_enclosure: "Build a fire-rated enclosure around the panel where required.",
  grounding_system: "Install or upgrade the grounding electrodes and bonding to current requirements.",
  surge_protector: "Supply and install a whole-home surge protector at the panel.",
  breaker_standard: "Supply and install a standard circuit breaker in the panel, per breaker.",
  breaker_afci_gfci: "Supply and install an AFCI or GFCI breaker in the panel, per breaker.",
  dedicated_circuit: "Run a new dedicated 15 or 20 A circuit from the panel to one outlet, per circuit.",
  circuit_240v: "Run a new 240 V circuit from the panel to the appliance location, per circuit.",
  ev_charger_install: "Mount and wire the client's EV charger on its own circuit, per charger.",
  whole_house_rewire: "Replace the wiring throughout the house, new devices at every opening, per square foot.",
  rewire_per_opening: "Rewire one outlet, switch or fixture location back to the panel, per opening.",
  knob_tube_replacement: "Remove the knob and tube wiring and replace it with new cable, per square foot.",
  aluminium_pigtail: "Pigtail copper onto every aluminium branch-circuit termination in the home with rated connectors.",
  aluminium_copalum: "Crimp COPALUM connectors onto every aluminium branch-circuit termination in the home.",
  wire_fishing: "Fish cable through a finished wall or ceiling without opening it, per run.",
  cut_in_box: "Cut in and mount a box at a new location in a finished wall, per box.",
  junction_box: "Install or replace a junction box and make up the splices inside it, per box.",
  emt_first_10ft: "Surface-mounted conduit run, first 10 ft, wiring priced separately.",
  cable_run_50ft: "Cable run of up to 50 ft extending an existing circuit to a new point.",
  receptacle_replace: "Replace an existing receptacle with a new device and cover, per receptacle.",
  receptacle_new: "Add a receptacle at a new location, wired from the nearest suitable circuit, per receptacle.",
  gfci_receptacle: "Supply and install a GFCI receptacle, per receptacle.",
  weatherproof_cover: "Fit a weatherproof in-use cover on an exterior receptacle, per cover.",
  switch_replace: "Replace an existing switch with a new device and cover, per switch.",
  dimmer_smart_switch: "Supply and install a dimmer or smart switch in place of the existing switch, per switch.",
  fixture_swap: "Remove the existing light fixture and hang the client's replacement, per fixture.",
  recessed_new: "Cut in, wire and trim a new recessed light, per light.",
  recessed_retrofit: "Fit a retrofit recessed light into an existing ceiling opening, per light.",
  ceiling_fan_existing_box: "Assemble and hang a ceiling fan on an existing fan-rated box, per fan.",
  ceiling_fan_new_box: "Install a fan-rated box and brace, then assemble and hang the ceiling fan, per fan.",
  fixture_support_brace: "Install a support brace and box rated for a fan or heavy fixture, per location.",
  heavy_fixture: "Hang a chandelier or heavy fixture with the lift, bracing and second person the weight or height requires, per fixture.",
  smoke_co_alarm: "Install a hardwired, interconnected smoke or CO alarm, per alarm.",
  data_drop: "Run a data or coax cable from the distribution point to a wall jack, per drop.",
  generator_inlet_interlock: "Install a generator inlet and a panel interlock kit so the generator can feed the panel safely.",
  transfer_switch: "Supply and install a transfer switch between the generator and the panel.",
  trenching: "Dig and backfill the trench for an underground circuit, per linear foot.",
  permit: "Electrical permit applied for on the client's behalf.",
  reinspection: "Attend a re-inspection after a failed or rescheduled inspection, per visit.",
  drywall_patch: "Patch, sand and paint the drywall opened for access, per opening.",
  disposal: "Haul away and dispose of the removed panel, fixtures and cable.",
  drywall_exclusion: "Repair of drywall and paint after access openings is not part of this quote.",
  concealed_conditions_clause: "Conditions concealed behind walls, ceilings or floors are not part of this quote and are priced when found.",
};

export const ELECTRICAL_LINE_ITEMS = RAW_LINE_ITEMS.map((item) => ({
  ...item,
  group: GROUP_BY_KEY[item.key],
  detail: ELECTRICAL_LINE_DETAILS[item.key],
}));
