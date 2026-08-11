// app/data/plumbingCatalog.js
//
// The plumbing price book — the LIST of things a plumber bills for.
//
// ── Why this file has no prices in it ───────────────────────────────────────
//
// Same rule as app/data/defaultLineItems.js, and for the same reason: knowing
// that a water heater swap also bills an expansion tank, a pan, a vent
// modification, a haul-away and a permit is the part people forget on a busy
// day. What to charge for each is the part they already know, and a
// plausible-looking default would land on a document a homeowner signs.
//
// So `rate` is not merely null here — it is **absent**, on every line, with no
// exceptions. Even the two liability clauses (which really do print at $0.00 on
// the real estimate they came from) carry `zeroPriced: true` rather than a
// zero, because a zero is a number and numbers in this file are how the rule
// erodes. scripts/check-plumbing-catalog.mjs fails the build if one appears.
//
// Guidance ranges live in app/data/plumbingBenchmarks.js, which is INTERNAL —
// a contractor sees "typical range — set your price" in the back office, and
// nothing reaches a client until they have set it.
//
// ── Where the list came from ────────────────────────────────────────────────
//
// docs/trade-pricing-research.md §2B (teardown of 8 real plumbing estimates)
// and §2D (market benchmarks). Five structures in §2B are visible in the shape
// of this list rather than in a comment:
//
//   1. Repipe is priced PER FIXTURE, not per square foot and not as a lump sum
//      (§2B.1 #4, confirmed standard in §2D.4). A 12-fixture count itemised on
//      the document survives scope change; a lump sum does not.
//   2. PEX and copper repipe are SEPARATE LINES, not one line with a material
//      swap. Half the copper premium is labour (plumbing-material-costs.md §8),
//      so swapping only the material understates copper by ~$2,000–2,500 on a
//      whole house.
//   3. Equipment and its install package are separate lines (§2B.1 #2). The
//      equipment price stays shoppable, the install carries its own warranty,
//      and the tank's 6-year manufacturer term and the labour's 1–2 year term
//      cannot both live on one line.
//   4. Client-supplied fixtures get their own install-only lines (§7 of
//      plumbing-material-costs.md, rank 4: homeowners routinely buy their own
//      faucet, and that line is then pure labour and must be structured so).
//   5. Exclusions are line items, not a terms paragraph (§2B.1 #1). Buried
//      exclusions are a top dispute cause; a visible $0.00 clause the client
//      reads while reading the price is the fix, and it costs nothing.
//
// ── What is deliberately NOT here ───────────────────────────────────────────
//
// No per-square-foot repipe line. It is how repipes get advertised and it is
// not how they get built — the same finding lib/estimate/rewireTakeoff.js
// documents for electrical. §8 of plumbing-material-costs.md shows the
// published per-sq-ft bands and the published whole-house bands disagree by a
// factor of two because they come from different markets; shipping a per-sq-ft
// line would invite averaging them.

// Unit vocabulary. FLAT / EACH / LF match app/data/defaultLineItems.js exactly
// so a line built from this catalogue is indistinguishable from one built from
// that one. HOUR is added here because plumbing genuinely bills time (§2D.2:
// $80–130/hr standard, $150–300 emergency) and no other trade in that file
// does; `unit` is free-form on the line item, so this is additive, not a
// change to the shared vocabulary.
const FLAT = "flat";
const EACH = "each";
const LF = "linear_ft";
const HOUR = "hour";

/** Groups exist because 80-odd chips in one strip is not a control anyone can
 *  use. Order is roughly "what a service plumber gets called about", not
 *  alphabetical. */
export const PLUMBING_LINE_ITEM_GROUPS = [
  { key: "service", label: "Service & diagnostics" },
  { key: "drain", label: "Drains & sewer clearing" },
  { key: "repipe", label: "Repipe & supply lines" },
  { key: "water_heater", label: "Water heaters" },
  { key: "fixtures", label: "Fixtures & appliances" },
  { key: "valves", label: "Valves & controls" },
  { key: "gas", label: "Gas" },
  { key: "underground", label: "Underground, sewer & excavation" },
  { key: "treatment", label: "Water treatment & pumps" },
  { key: "extras", label: "Permits, access & the habitually forgotten" },
];

/**
 * Every plumbing line, flat, in the `{ description, unit }` shape
 * DEFAULT_LINE_ITEMS uses.
 *
 * `key` is additional and load-bearing: app/data/plumbingBenchmarks.js is keyed
 * to it, and keying guidance to the description string instead would break the
 * first time somebody rewords a chip or translates one. `group` drives the
 * chip grouping above. Neither affects how a line renders — the consumer reads
 * `description` and `unit`, exactly as it does for every other trade.
 */
export const PLUMBING_LINE_ITEMS = [
  // ── Service & diagnostics ─────────────────────────────────────────────────
  {
    key: "service_call",
    description: "Service call / diagnostic visit",
    unit: FLAT,
    group: "service",
  },
  {
    key: "emergency_callout",
    description: "Emergency call-out — after hours",
    unit: FLAT,
    group: "service",
  },
  {
    key: "labour_standard",
    description: "Plumbing labour — standard hours",
    unit: HOUR,
    group: "service",
  },
  {
    key: "labour_emergency",
    description: "Plumbing labour — emergency / after hours",
    unit: HOUR,
    group: "service",
  },
  {
    key: "leak_detection",
    description: "Leak detection — electronic / acoustic",
    unit: FLAT,
    group: "service",
  },
  {
    key: "pressure_test",
    description: "Water system pressure test",
    unit: FLAT,
    group: "service",
  },
  {
    key: "camera_inspection",
    description: "Sewer camera inspection — with service",
    unit: FLAT,
    group: "service",
  },
  {
    key: "camera_inspection_standalone",
    description: "Sewer camera inspection — standalone",
    unit: FLAT,
    group: "service",
  },

  // ── Drains & sewer clearing ───────────────────────────────────────────────
  {
    key: "drain_clear_fixture",
    description: "Drain clearing — fixture / branch line",
    unit: EACH,
    group: "drain",
  },
  {
    key: "drain_clear_main",
    description: "Drain clearing — main line",
    unit: FLAT,
    group: "drain",
  },
  {
    key: "toilet_auger",
    description: "Toilet auger — clear stoppage",
    unit: EACH,
    group: "drain",
  },
  {
    key: "hydro_jet_branch",
    description: "Hydro-jetting — branch line",
    unit: FLAT,
    group: "drain",
  },
  {
    key: "hydro_jet_main",
    description: "Hydro-jetting — main line",
    unit: FLAT,
    group: "drain",
  },
  {
    key: "cleanout_install",
    description: "Cleanout — supply & install",
    unit: EACH,
    group: "drain",
  },

  // ── Repipe & supply lines ─────────────────────────────────────────────────
  {
    key: "repipe_base_fee",
    description: "Whole-house repipe — base fee",
    unit: FLAT,
    group: "repipe",
  },
  {
    key: "repipe_pex_per_fixture",
    description: "Whole-house repipe in PEX — per fixture",
    unit: EACH,
    group: "repipe",
  },
  {
    key: "repipe_copper_per_fixture",
    description: "Whole-house repipe in copper — per fixture",
    unit: EACH,
    group: "repipe",
  },
  {
    key: "repipe_sheetrock_demo",
    description: "Wall & ceiling demolition for repipe access",
    unit: FLAT,
    group: "repipe",
  },
  {
    key: "galvanised_removal",
    description: "Galvanised supply pipe — removal & disposal",
    unit: FLAT,
    group: "repipe",
  },
  {
    key: "water_line_repair",
    description: "Water supply line — spot repair",
    unit: FLAT,
    group: "repipe",
  },

  // ── Water heaters ─────────────────────────────────────────────────────────
  {
    key: "wh_tank_supply_install",
    description: "Water heater, tank — supply & install",
    unit: EACH,
    group: "water_heater",
  },
  {
    // The description carries the dependency in words because §2B.1 #2's
    // "Must be Combined with Install Package" is real and a tech quoting a
    // heater with no install is the failure it prevents. It is stated, not
    // enforced by a flag nothing reads.
    key: "wh_tank_equipment_only",
    description: "Water heater, tank — equipment only (requires an install package)",
    unit: EACH,
    group: "water_heater",
  },
  {
    key: "wh_install_package_gas",
    description: "Water heater install package — gas",
    unit: EACH,
    group: "water_heater",
  },
  {
    key: "wh_install_package_electric",
    description: "Water heater install package — electric",
    unit: EACH,
    group: "water_heater",
  },
  {
    key: "wh_tankless_supply_install",
    description: "Tankless water heater — supply & install",
    unit: EACH,
    group: "water_heater",
  },
  {
    key: "wh_tankless_retrofit",
    description: "Tankless retrofit — new gas line & venting from the meter",
    unit: FLAT,
    group: "water_heater",
  },
  {
    key: "wh_expansion_tank",
    description: "Thermal expansion tank",
    unit: EACH,
    group: "water_heater",
  },
  {
    key: "wh_venting",
    description: "Water heater venting — new or modified",
    unit: FLAT,
    group: "water_heater",
  },
  {
    key: "wh_pan_drain",
    description: "Drain pan & pan drain line",
    unit: EACH,
    group: "water_heater",
  },
  {
    key: "wh_seismic_strap",
    description: "Seismic strapping",
    unit: EACH,
    group: "water_heater",
  },
  {
    key: "wh_removal_disposal",
    description: "Old water heater — removal & disposal",
    unit: EACH,
    group: "water_heater",
  },
  {
    key: "wh_recirculation_pump",
    description: "Hot water recirculation pump",
    unit: EACH,
    group: "water_heater",
  },

  // ── Fixtures & appliances ─────────────────────────────────────────────────
  {
    key: "toilet_supply_install",
    description: "Toilet — supply & install",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "toilet_install_only",
    description: "Toilet — install only, client-supplied fixture",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "lav_faucet_supply_install",
    description: "Bathroom faucet — supply & install",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "kitchen_faucet_supply_install",
    description: "Kitchen faucet — supply & install",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "faucet_install_only",
    description: "Faucet — install only, client-supplied fixture",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "sink_supply_install",
    description: "Sink — supply & install",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "tub_supply_install",
    description: "Bathtub — supply & install",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "tub_shower_valve",
    description: "Tub / shower valve — rough-in & trim",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "shower_pan_install",
    description: "Shower pan / base — install",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "disposal_supply_install",
    description: "Garbage disposal — supply & install",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "dishwasher_hookup",
    description: "Dishwasher — hookup",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "washer_box_install",
    description: "Washer outlet box — install",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "angle_stop_replace",
    description: "Angle stop / fixture shut-off — replace",
    unit: EACH,
    group: "fixtures",
  },
  {
    key: "hose_bib_replace",
    description: "Hose bib / frost-free sillcock — replace",
    unit: EACH,
    group: "fixtures",
  },

  // ── Valves & controls ─────────────────────────────────────────────────────
  {
    key: "prv_supply_install",
    description: "Pressure reducing valve (PRV) — supply & install",
    unit: EACH,
    group: "valves",
  },
  {
    key: "main_shutoff_replace",
    description: "Main water shut-off valve — replace",
    unit: EACH,
    group: "valves",
  },
  {
    key: "mixing_valve_install",
    description: "Thermostatic mixing valve — supply & install",
    unit: EACH,
    group: "valves",
  },
  {
    key: "backflow_install",
    description: "Backflow preventer — supply & install",
    unit: EACH,
    group: "valves",
  },
  {
    key: "backflow_test",
    description: "Backflow preventer — annual test & certification",
    unit: EACH,
    group: "valves",
  },

  // ── Gas ───────────────────────────────────────────────────────────────────
  {
    key: "gas_line_run_simple",
    description: "Gas line — new run, simple routing",
    unit: LF,
    group: "gas",
  },
  {
    key: "gas_line_run_complex",
    description: "Gas line — new run, complex routing",
    unit: LF,
    group: "gas",
  },
  {
    key: "gas_appliance_connection",
    description: "Gas appliance connection",
    unit: EACH,
    group: "gas",
  },
  {
    key: "gas_repair_minor",
    description: "Gas line repair — minor",
    unit: FLAT,
    group: "gas",
  },
  {
    key: "gas_pressure_test",
    description: "Gas line pressure test",
    unit: FLAT,
    group: "gas",
  },

  // ── Underground, sewer & excavation ───────────────────────────────────────
  {
    key: "water_main_open_trench",
    description: "Water main replacement — open trench",
    unit: LF,
    group: "underground",
  },
  {
    key: "water_main_bore",
    description: "Water main replacement — directional bore",
    unit: LF,
    group: "underground",
  },
  {
    key: "bore_base_fee",
    description: "Directional bore — base fee including the first 50 ft",
    unit: FLAT,
    group: "underground",
  },
  {
    key: "pipe_bursting",
    description: "Pipe bursting — trenchless replacement",
    unit: LF,
    group: "underground",
  },
  {
    key: "sewer_excavation_replace",
    description: "Sewer line — excavation & replacement",
    unit: LF,
    group: "underground",
  },
  {
    key: "sewer_spot_repair",
    description: "Sewer line — spot repair",
    unit: FLAT,
    group: "underground",
  },
  {
    key: "sewer_lining",
    description: "Sewer line — CIPP lining",
    unit: LF,
    group: "underground",
  },
  {
    key: "cast_iron_replace",
    description: "Cast iron drain line — replacement",
    unit: LF,
    group: "underground",
  },
  {
    key: "underground_obstruction",
    description: "Underground obstruction encountered — water, sewer or gas in the path",
    unit: EACH,
    group: "underground",
  },
  {
    key: "driveway_cut_patch",
    description: "Driveway saw-cut & patch",
    unit: FLAT,
    group: "underground",
  },
  {
    key: "landscape_restoration",
    description: "Landscape restoration",
    unit: FLAT,
    group: "underground",
  },
  {
    key: "slab_leak_spot_repair",
    description: "Slab leak — spot repair",
    unit: FLAT,
    group: "underground",
  },
  {
    key: "slab_leak_reroute",
    description: "Slab leak — overhead or perimeter reroute",
    unit: FLAT,
    group: "underground",
  },

  // ── Water treatment & pumps ───────────────────────────────────────────────
  {
    key: "water_softener_install",
    description: "Water softener — supply & install",
    unit: EACH,
    group: "treatment",
  },
  {
    key: "water_filtration_install",
    description: "Water filtration / treatment system — supply & install",
    unit: EACH,
    group: "treatment",
  },
  {
    key: "sump_pump_install",
    description: "Sump pump — supply & install",
    unit: EACH,
    group: "treatment",
  },
  {
    key: "sewage_ejector_install",
    description: "Sewage ejector pump — supply & install",
    unit: EACH,
    group: "treatment",
  },

  // ── Permits, access & the habitually forgotten ────────────────────────────
  //
  // Everything below is money the company has already spent or a liability it
  // has already taken on, and every one of them gets typed by hand today, which
  // means on a busy day it gets forgotten.
  {
    key: "permit_plumbing",
    description: "Plumbing permit fee",
    unit: FLAT,
    group: "extras",
  },
  {
    key: "inspection_coordination",
    description: "Inspection scheduling & attendance",
    unit: FLAT,
    group: "extras",
  },
  {
    key: "travel_fee",
    description: "Travel / call-out fee",
    unit: FLAT,
    group: "extras",
  },
  {
    key: "disposal_fee",
    description: "Disposal / haul-away fee",
    unit: FLAT,
    group: "extras",
  },
  {
    key: "access_opening",
    description: "Access opening — drywall, ceiling or floor",
    unit: FLAT,
    group: "extras",
  },
  {
    key: "concrete_cut_patch",
    description: "Concrete cutting & patching",
    unit: FLAT,
    group: "extras",
  },
  {
    key: "additional_labour",
    description: "Additional labour — difficult install",
    unit: FLAT,
    group: "extras",
  },
  {
    // §2B.1 #1. On the real $18,164 repipe these print in the price table at
    // $0.00, so the client reads them while reading the price and accepts them
    // by accepting the quote. `clauseText` is our own paraphrase — the original
    // wording belongs to the contractor who wrote it.
    key: "clause_excavation",
    description: "Excavation clause — what excavation does not cover",
    unit: FLAT,
    group: "extras",
    zeroPriced: true,
    clauseText:
      "Excavation can disturb landscaping and vegetation, and can encounter buried utilities that were not marked. We are not liable for either. If rock or another unforeseen obstruction is found in the path, the cost of the work may increase and we will tell you before we continue.",
  },
  {
    key: "clause_general_damage",
    description: "General damage clause — access & restoration",
    unit: FLAT,
    group: "extras",
    zeroPriced: true,
    clauseText:
      "Reaching pipe means opening walls and ceilings, cutting concrete, lifting flooring and moving appliances. Making the pipe right is included; making the surfaces right again is not, unless a restoration line appears on this quote.",
  },
];

/** Quick lookup by key. Built once — the list is static. */
export const PLUMBING_LINE_ITEMS_BY_KEY = Object.fromEntries(
  PLUMBING_LINE_ITEMS.map((item) => [item.key, item]),
);

/** Every line, or one group's worth. Unknown group returns nothing rather than
 *  everything: silently widening a filter is how a chip strip becomes 80 chips
 *  and stops being usable. */
export function getPlumbingLineItems(groupKey) {
  if (!groupKey) return PLUMBING_LINE_ITEMS;
  return PLUMBING_LINE_ITEMS.filter((item) => item.group === groupKey);
}

/** The fixture count a repipe is priced against — §2D.1 confirms this published
 *  convention matches the owner's estimate exactly (master bath 3, hallway bath
 *  3, kitchen/laundry 3, heater + two hose spigots 3 = 12). It is here so the
 *  count can be itemised on the document rather than asserted, which is what
 *  makes a per-fixture price survive a scope change. */
export const REPIPE_FIXTURE_TYPES = [
  { key: "bathroom_sink", label: "Bathroom sink" },
  { key: "toilet", label: "Toilet" },
  { key: "shower_tub", label: "Shower / tub" },
  { key: "kitchen_sink", label: "Kitchen sink" },
  { key: "water_heater", label: "Water heater" },
  { key: "washer_connection", label: "Washer connection" },
  { key: "hose_bib", label: "Hose bib" },
];
