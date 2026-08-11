// app/data/electricalMaterials.js
//
// ── Nothing here is client-facing ───────────────────────────────────────────
//
// Internal material COST defaults, the same role app/data/materialRecipes.js
// plays for cabinets and paint: they feed the Cost & Margin panel so the margin
// on a quote is computed against a real number instead of a guess. They are not
// prices, they are not marked up, and they must never reach /quote, /book, /q,
// /portal, /site or /embed — non-negotiable #4, and enforced by
// scripts/check-electrical-catalog.mjs.
//
// Companies override these for their own supplier via getElectricalMaterials()
// below, which merges exactly the way getRecipe() does.
//
// ── Currency is CAD. The benchmarks file is USD. Do not subtract them. ──────
//
// Every figure below was read off homedepot.ca in Canadian dollars.
// app/data/electricalBenchmarks.js is US market research in US dollars. §3.10
// measured CAD ≈ 1.24–1.31 × USD list across the only two SKUs that could be
// matched, and then said plainly: do NOT derive CAD defaults by converting USD
// ones, because at a live rate of 1.35–1.40 Canadian shelf prices are at or
// below US prices after conversion and a naive `USD × FX` overprices Canadian
// materials by 5–10%. The FX ratio is deliberately not exported here; two
// matched SKUs is enough to sanity-check a conversion and not enough to make
// one.
//
// ── These are RETAIL prices, and that is a direction, not a defect ──────────
//
// §3.11: wholesale and contractor pricing (Nedco, Gescan, Westburne, Ideal
// Supply) was entirely inaccessible. A contractor on account pays meaningfully
// less on commodities — wire, breakers, boxes — and close to retail on
// homeowner-choice items. Every `source` string says "retail" so a user knows
// which way to adjust, which is Part 4 rule #10 and the whole reason the field
// is mandatory.
//
// One retailer, one region, one day. There is no cross-retailer validation:
// lowes.com, supplyhouse.com, rona.ca, canadiantire.ca, amazon.ca and
// homedepot.com all blocked automated access (§3.0).
//
// ── The three fields a naive schema omits (§3.1) ────────────────────────────
//
// A material default cannot be a single number keyed on a name. Three
// dimensions each swing the price further than brand choice normally does, so
// all three are mandatory on every entry:
//
//   brand   Legacy panels are a routine service call, not an edge case:
//           Federal Pioneer / Stab-Lok runs 2–3× every modern equivalent.
//           "Square D" is not one brand either — Schneider sells QO (premium)
//           and Homeline (mid) at materially different prices, and its AFCI
//           splits plug-on from pigtail within the same brand and rating.
//   pack    Wire is priced per unit of quantity purchased. 12/2 NMD90 is
//           $2.46/m on a 150 m roll and $11.99/m on a 5 m coil — 4.9×, the
//           same cable. `cost` is the price of ONE `pack` as sold, so the
//           per-unit figure is cost ÷ pack.size and the roll size is never
//           implicit. Where §3 published a low that is only reachable in a
//           multi-pack, that pack is its own entry or is named in `note` —
//           never folded into the single-unit band.
//   scope   The dangerous one, because the names look alike and nothing on the
//           shelf flags the difference: a 200 A 20-space panel is $259 bare and
//           $1,563.41 as an AFCI plug-on-neutral package. 6×.
//
// ── Three types, and the two that carry no cost are the honest ones ─────────
//
//   material   A cost default. Carries `cost` {low, typical, high}.
//   allowance  Part 4 rule #9. Items whose spread is homeowner taste, not
//              trade: ceiling fans 10.7×, exterior lanterns 13.3× (§3.9 ranks
//              1–2). A default there is a fiction, so there is no `cost` at
//              all — the client picks and an allowance line carries the number.
//   unpriced   §3.11's honest gaps. Interlock kits are not sold by this
//              retailer at all, and they are the cheapest and most common
//              alternative to a transfer switch. Bare copper #6 and #4 — the
//              two sizes actually used for residential grounding electrode
//              conductors — are not stocked. Meter-main combination units
//              returned zero results. These ship as entries with a `gap`
//              instead of being dropped, because a missing key reads as "we
//              forgot" and an empty price reads as "nobody has this number":
//              absence of a statement is not a statement.
//
// ── Copper moves within a quarter ───────────────────────────────────────────
//
// §2.6: wire needs a 1.92× escalation from 2019 against labour's 1.40×, and
// copper rose 35.4% in 2021 and 18.2% in 2026 YTD. Re-read the wire section
// before shipping to a new market. §3.0 documents the working refresh path:
// homedepot.ca's own product API, called from inside a real browser session —
// `GET /api/search/v1/search?q=<term>&pageSize=<n>&lang=en` returns 40 priced
// products per call with `pricing.displayPrice.value` and `currencyIso`.
// Scraping the product tiles does not work.

/** One read, one store, one day. Quoted once rather than pasted 100 times —
 *  the copy is the one that rots because it is the one nobody looks at. */
const HD_CA = "Home Depot Canada retail shelf price (store #7140/7274, Gatineau QC), pre-tax, non-promotional — read 2026-08-10";

/** For the one entry whose number is computed rather than read. Says so. */
const HD_CA_DERIVED = `Derived, not read — ${HD_CA}`;

const EACH = { size: 1, unit: "each" };
const STICK_10FT = { size: 10, unit: "ft stick" };
const METRE_CUT = { size: 1, unit: "m, cut to length" };

export const ELECTRICAL_MATERIALS = {
  // ── Breakers (§3.2) ───────────────────────────────────────────────────────
  //
  // Brand is doing real work in this section. Eaton BR is the cheap end on
  // nearly every rating and Schneider QO the premium mainstream; GE is not
  // carried in Canada at all, so offering it as a brand gives Canadian users an
  // option with no retail reference behind it.

  breaker_1p_15a: {
    label: "Breaker — 1-pole 15 A",
    type: "material",
    brand: "Eaton BR / Schneider Homeline at the low end, Schneider QO at the high",
    pack: EACH,
    scope: "Plug-on thermal-magnetic breaker, device only. No AFCI or GFCI protection.",
    cost: { low: 12.98, typical: 14.97, high: 29.71 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.2: the one item in the whole section that can safely carry a single default — three of five brands cluster at $12.98–14.97, so ~$14 is honest.",
  },
  breaker_1p_20a: {
    label: "Breaker — 1-pole 20 A",
    type: "material",
    brand: "Eaton BR / Schneider Homeline at the low end, Schneider QO at the high",
    pack: EACH,
    scope: "Plug-on thermal-magnetic breaker, device only.",
    cost: { low: 12.98, typical: 14.75, high: 29.71 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_1p_30a: {
    label: "Breaker — 1-pole 30 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Plug-on thermal-magnetic breaker, device only.",
    cost: { low: 22.85, typical: 22.85, high: 22.85 },
    currency: "CAD",
    source: HD_CA,
    note: "One listing found. A point, not a range.",
  },
  breaker_2p_15a: {
    label: "Breaker — 2-pole 15 A",
    type: "material",
    brand: "Eaton BR to Schneider QO",
    pack: EACH,
    scope: "Two-pole 240 V breaker, device only.",
    cost: { low: 29.85, typical: 32.94, high: 57.97 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_2p_20a: {
    label: "Breaker — 2-pole 20 A",
    type: "material",
    brand: "Eaton BR to Schneider QO",
    pack: EACH,
    scope: "Two-pole 240 V breaker, device only.",
    cost: { low: 27.97, typical: 35.95, high: 57.97 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_2p_30a: {
    label: "Breaker — 2-pole 30 A",
    type: "material",
    brand: "Eaton BR to Schneider QO",
    pack: EACH,
    scope: "Two-pole 240 V breaker, device only. Dryer and small-load rating.",
    cost: { low: 32.95, typical: 36.97, high: 64.95 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_2p_40a: {
    label: "Breaker — 2-pole 40 A",
    type: "material",
    brand: "Eaton BR to Schneider QO",
    pack: EACH,
    scope: "Two-pole 240 V breaker, device only. Range and EV-charger rating.",
    cost: { low: 36.85, typical: 40.75, high: 64.95 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_2p_50a: {
    label: "Breaker — 2-pole 50 A",
    type: "material",
    brand: "Eaton BR to Schneider QO",
    pack: EACH,
    scope: "Two-pole 240 V breaker, device only. Range, EV charger, subpanel feed.",
    cost: { low: 44.98, typical: 84.45, high: 133.0 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_2p_60a: {
    label: "Breaker — 2-pole 60 A",
    type: "material",
    brand: "Eaton BR to Schneider QO",
    pack: EACH,
    scope: "Two-pole 240 V breaker, device only. Subpanel feed rating.",
    cost: { low: 44.98, typical: 57.75, high: 148.0 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.9 ranks this 8th for misleading defaults — a 3.3× spread, entirely brand.",
  },
  breaker_tandem: {
    label: "Breaker — tandem (two circuits, one space)",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Two 1-pole circuits in a single panel space. Only legal where the panel is listed for it.",
    cost: { low: 28.97, typical: 40.97, high: 61.75 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_quad: {
    label: "Breaker — quad",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Two 2-pole circuits in two panel spaces.",
    cost: { low: 39.47, typical: 59.97, high: 65.51 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_afci_1p: {
    label: "Breaker — AFCI 1-pole",
    type: "material",
    brand: "Schneider, Eaton, Siemens",
    pack: EACH,
    scope: "Arc-fault protection, device only. Not a dual-function device — see breaker_dual_function_1p.",
    cost: { low: 89.97, typical: 94.37, high: 194.0 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.2: Schneider's AFCI splits plug-on ($90.57) from pigtail ($135–137) — a within-brand, within-rating split that has nothing to do with brand tier. Check which the panel takes before costing.",
  },
  breaker_afci_2p_15a: {
    label: "Breaker — AFCI 2-pole 15 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Arc-fault protection on a 240 V circuit. The CEC kitchen requirement drives this one.",
    cost: { low: 195.0, typical: 195.0, high: 195.0 },
    currency: "CAD",
    source: HD_CA,
    note: "One listing found. A point, not a range.",
  },
  breaker_gfci_1p: {
    label: "Breaker — GFCI 1-pole",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Ground-fault protection for a whole circuit, device only.",
    cost: { low: 152.0, typical: 164.0, high: 177.0 },
    currency: "CAD",
    source: HD_CA,
    note: "§2C.2⑧: protecting the whole circuit at the breaker is cheaper than a GFCI receptacle at each location. Compare against gfci_receptacle_15a × the device count before specifying.",
  },
  breaker_gfci_2p: {
    label: "Breaker — GFCI 2-pole",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Ground-fault protection on a 240 V circuit — pool, spa, some EV installs.",
    cost: { low: 202.78, typical: 249.0, high: 287.0 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_dual_function_1p: {
    label: "Breaker — dual-function AFCI/GFCI 1-pole",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Arc-fault AND ground-fault in one device.",
    cost: { low: 114.0, typical: 147.0, high: 197.0 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_main_2p_100a: {
    label: "Main breaker — 2-pole 100 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel main only. Not a panel.",
    cost: { low: 83.97, typical: 108.98, high: 119.0 },
    currency: "CAD",
    source: HD_CA,
  },
  breaker_main_2p_125a: {
    label: "Main breaker — 2-pole 125 A",
    type: "material",
    brand: "Wide — this rating is where brand hurts most",
    pack: EACH,
    scope: "Panel main only.",
    cost: { low: 103.29, typical: 157.48, high: 526.59 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.9 ranks this 5th for misleading defaults: a 5.1× spread, entirely brand.",
  },
  breaker_main_2p_200a: {
    label: "Main breaker — 2-pole 200 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel main only.",
    cost: { low: 119.98, typical: 119.98, high: 119.98 },
    currency: "CAD",
    source: HD_CA,
    note: "One listing found. A point, not a range — and note it reads cheaper than the 125 A typical, which is a stocking artefact, not a market fact.",
  },
  breaker_main_2p_225a: {
    label: "Main breaker — 2-pole 225 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel main only.",
    cost: { low: 178.0, typical: 178.0, high: 178.0 },
    currency: "CAD",
    source: HD_CA,
    note: "One listing found. A point, not a range.",
  },
  breaker_legacy_stablok_1p: {
    label: "Breaker — legacy Federal Pioneer / Stab-Lok 1-pole",
    type: "material",
    brand: "Federal Pioneer (Stab-Lok) — the legacy panel line, not a modern equivalent",
    pack: EACH,
    scope: "Replacement breaker for a 1970s–80s Stab-Lok panel. The panel it fits is the one most likely to be the reason for the call.",
    cost: { low: 29.94, typical: 37.43, high: 44.91 },
    currency: "CAD",
    source: HD_CA_DERIVED,
    note: "Computed, not read: §3.2 puts Stab-Lok at 2–3× the modern equivalent across the board, applied to breaker_1p_15a's $14.97 typical (2×, 2.5×, 3×). §3.9 ranks it 9th for misleading defaults. It exists as its own entry because a legacy panel is a routine service call, not an edge case — and a contractor whose panel work is all Federal Pioneer has no way to say so if the schema only has one 'breaker'.",
  },

  // ── Panels and service equipment (§3.3) ───────────────────────────────────
  //
  // Split three ways on SCOPE — bare panel, panel with breakers, code-compliant
  // AFCI package — or the 200 A default is wrong by 6× at the extremes. That is
  // the §3.1 headline, and these three entries are what it looks like.

  subpanel_main_lug_small: {
    label: "Subpanel enclosure — main-lug, small (4/8–8/16 circuit)",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Bare enclosure and bus. No breakers, no main.",
    cost: { low: 57.98, typical: 88.75, high: 119.0 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_main_lug_125a_20sp: {
    label: "Panel — main-lug 125 A, 20-space indoor",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Bare panel. No breakers, no main breaker.",
    cost: { low: 174.0, typical: 188.5, high: 232.0 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_main_breaker_100a_20ckt: {
    label: "Panel — main-breaker 100 A, 20 circuit",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel with main breaker. Branch breakers NOT included.",
    cost: { low: 168.0, typical: 168.0, high: 203.0 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_main_breaker_150a_30_42ckt: {
    label: "Panel — main-breaker 150 A, 30–42 circuit",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel with main breaker. Branch breakers NOT included.",
    cost: { low: 239.25, typical: 279.0, high: 319.0 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_main_breaker_200a_30ckt_bare: {
    label: "Panel — main-breaker 200 A, 30 circuit, BARE",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel and main breaker only. No branch breakers of any kind. This is the cheap end of the 6× scope spread — quoting a service upgrade off this number and then buying the AFCI package is how a panel job loses $1,300 of material.",
    cost: { low: 259.0, typical: 259.0, high: 259.0 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_package_200a_20sp: {
    label: "Panel package — 200 A, 20 space, with breakers",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel plus a set of standard branch breakers. No AFCI.",
    cost: { low: 429.0, typical: 429.0, high: 429.0 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_package_200a_30sp_afci: {
    label: "Panel package — 200 A, 30 space, AFCI plug-on-neutral",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel plus plug-on-neutral AFCI branch breakers — the code-compliant package for a dwelling under current AFCI scope. 6.0× the bare panel of the same rating, and the item names look almost identical on the shelf.",
    cost: { low: 1563.41, typical: 1563.41, high: 1563.41 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_package_100a_16sp: {
    label: "Panel package — 100 A, 16 space, with breakers",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel plus a set of standard branch breakers. No AFCI.",
    cost: { low: 339.0, typical: 339.0, high: 339.0 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_main_breaker_225a_42ckt: {
    label: "Panel — main-breaker 225 A, 42 circuit",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel with main breaker. Branch breakers NOT included.",
    cost: { low: 288.0, typical: 321.9, high: 350.0 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_outdoor_100a: {
    label: "Panel — outdoor / rainproof 100 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Rainproof enclosure rating. Branch breakers NOT included.",
    cost: { low: 217.0, typical: 217.0, high: 217.0 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_outdoor_125a: {
    label: "Panel — outdoor / rainproof 125 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Rainproof enclosure rating. Branch breakers NOT included.",
    cost: { low: 227.85, typical: 227.85, high: 227.85 },
    currency: "CAD",
    source: HD_CA,
  },
  panel_outdoor_200a: {
    label: "Panel — outdoor / rainproof 200 A",
    type: "unpriced",
    brand: "Unknown — not carried",
    pack: EACH,
    scope: "Rainproof 200 A enclosure, the common outdoor service-upgrade item.",
    currency: "CAD",
    source: HD_CA,
    gap: "§3.11: not found. This retailer's outdoor panel stock tops out at 125 A, so the rating an outdoor service upgrade actually needs has no retail reference here. Needs a supply-house figure.",
  },
  loadcentre_service_entrance_200a: {
    label: "Service-entrance loadcentre — 200 A, 40–60 circuit",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Service-entrance rated loadcentre. A different product from an indoor panel of the same amperage, and roughly 3.7× the price.",
    cost: { low: 943.0, typical: 953.0, high: 963.0 },
    currency: "CAD",
    source: HD_CA,
  },
  meter_socket_100a: {
    label: "Meter socket — 100 A, overhead or underground",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Meter socket only. Not a meter-main combination.",
    cost: { low: 197.0, typical: 197.0, high: 197.0 },
    currency: "CAD",
    source: HD_CA,
  },
  meter_main_combo: {
    label: "Meter-main combination unit",
    type: "unpriced",
    brand: "Unknown — not carried",
    pack: EACH,
    scope: "Combined meter socket and main disconnect, the usual item on a modern service upgrade.",
    currency: "CAD",
    source: HD_CA,
    gap: "§3.11: zero search results. Exactly one meter socket SKU exists at this retailer. Part 1 bills $3,740 to replace or add a 200 A meter combo including the riser, so the installed price is known and the equipment cost is not.",
  },
  surge_protector_whole_home: {
    label: "Surge protector — whole home, Type 1/2",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Panel-mounted whole-home surge protective device. Warranty tier is what varies on the client-facing side, not the part.",
    cost: { low: 206.0, typical: 217.5, high: 229.0 },
    currency: "CAD",
    source: HD_CA,
  },

  // ── Transfer switches and generator connection (§3.4) ─────────────────────

  transfer_switch_manual_1ckt_15a: {
    label: "Transfer switch — manual, single-circuit 15 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "One circuit. Switch only — no inlet, no cord.",
    cost: { low: 198.0, typical: 198.0, high: 198.0 },
    currency: "CAD",
    source: HD_CA,
  },
  transfer_switch_manual_60a: {
    label: "Transfer switch — manual, single-load 60 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "One load. Switch only — no inlet, no cord.",
    cost: { low: 238.0, typical: 268.5, high: 299.0 },
    currency: "CAD",
    source: HD_CA,
  },
  transfer_switch_manual_6ckt_inlet: {
    label: "Transfer switch — manual, 6 circuit with inlet",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Six circuits, inlet box INCLUDED. Cord not included.",
    cost: { low: 519.0, typical: 519.0, high: 519.0 },
    currency: "CAD",
    source: HD_CA,
  },
  transfer_switch_manual_8_10ckt_kit: {
    label: "Transfer switch — manual, 8–10 circuit kit",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Eight to ten circuits, kit form. Check the specific SKU for whether the inlet is in the box.",
    cost: { low: 679.0, typical: 698.0, high: 798.0 },
    currency: "CAD",
    source: HD_CA,
  },
  transfer_switch_manual_10ckt_inlet: {
    label: "Transfer switch — manual, 10 circuit with inlet",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Ten circuits, inlet box INCLUDED. Cord not included.",
    cost: { low: 749.0, typical: 749.0, high: 749.0 },
    currency: "CAD",
    source: HD_CA,
  },
  transfer_switch_auto_100a: {
    label: "Transfer switch — automatic 100 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Whole-panel automatic transfer. Not service-entrance rated.",
    cost: { low: 799.0, typical: 799.0, high: 799.0 },
    currency: "CAD",
    source: HD_CA,
  },
  transfer_switch_auto_200a: {
    label: "Transfer switch — automatic 200 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Whole-panel automatic transfer. Not service-entrance rated.",
    cost: { low: 1139.0, typical: 1139.0, high: 1139.0 },
    currency: "CAD",
    source: HD_CA,
  },
  transfer_switch_auto_200a_se_rated: {
    label: "Transfer switch — automatic 200 A, service-entrance rated (CSA)",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Service-entrance rated, so it replaces the main disconnect. A different scope from the non-SE unit above at the same amperage, and 1.24× the price.",
    cost: { low: 1409.0, typical: 1409.0, high: 1409.0 },
    currency: "CAD",
    source: HD_CA,
  },
  generator_inlet_30a: {
    label: "Generator inlet box — 30 A (L14-30)",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Inlet box only. No cord, no interlock, no transfer switch.",
    cost: { low: 74.28, typical: 105.0, high: 129.0 },
    currency: "CAD",
    source: HD_CA,
  },
  generator_inlet_50a: {
    label: "Generator inlet box — 50 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Inlet box only. No cord, no interlock, no transfer switch.",
    cost: { low: 129.0, typical: 129.0, high: 129.0 },
    currency: "CAD",
    source: HD_CA,
  },
  generator_cord_50a_20ft: {
    label: "Generator cord — 50 A, 20 ft",
    type: "material",
    brand: "Mainstream residential lines",
    pack: { size: 20, unit: "ft cord" },
    scope: "Cord set only. Part 1's $2,470 generator line includes a cord — check before pricing one twice.",
    cost: { low: 394.0, typical: 394.0, high: 394.0 },
    currency: "CAD",
    source: HD_CA,
  },
  interlock_kit: {
    label: "Panel interlock kit",
    type: "unpriced",
    brand: "Panel-specific — an interlock is listed for one panel line and will not fit another",
    pack: EACH,
    scope: "Mechanical interlock between the main and a backfed generator breaker. The cheapest and most common alternative to a transfer switch.",
    currency: "CAD",
    source: HD_CA,
    gap: "§3.4 and §3.11: not sold by this retailer — the search returns nothing — and no price was found from any other source. This is the most-used generator connection method in the trade and the price book has no number for it. Needs a supply-house figure.",
  },

  // ── Wire and cable (§3.5) — ⚠️ copper is volatile ─────────────────────────
  //
  // `cost` is the price of the whole roll or coil; per-metre is cost ÷
  // pack.size. That is not pedantry: it is the only way the 4.9× packaging
  // spread on identical cable stays visible instead of being averaged away.
  // Southwire throughout. 75 m ≈ 246 ft, 150 m ≈ 492 ft.

  nmd90_14_2_75m: {
    label: "NMD90 14/2 — 75 m roll",
    type: "material",
    brand: "Southwire",
    pack: { size: 75, unit: "m roll" },
    scope: "Indoor branch-circuit cable, 15 A general purpose. Copper conductors with ground.",
    cost: { low: 138.0, typical: 143.5, high: 149.0 },
    currency: "CAD",
    source: HD_CA,
  },
  nmd90_14_2_150m: {
    label: "NMD90 14/2 — 150 m roll",
    type: "material",
    brand: "Southwire",
    pack: { size: 150, unit: "m roll" },
    scope: "Indoor branch-circuit cable, 15 A general purpose. The bulk roll — $1.52/m against $1.91/m on the 75 m.",
    cost: { low: 228.0, typical: 228.0, high: 228.0 },
    currency: "CAD",
    source: HD_CA,
  },
  nmd90_14_3_150m: {
    label: "NMD90 14/3 — 150 m roll",
    type: "material",
    brand: "Southwire",
    pack: { size: 150, unit: "m roll" },
    scope: "Three-conductor indoor cable — three-way switching and shared-neutral runs.",
    cost: { low: 329.0, typical: 329.0, high: 329.0 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.11: the 75 m listing at $399 is internally inconsistent with this 150 m roll at $329 and was excluded.",
  },
  nmd90_12_2_75m: {
    label: "NMD90 12/2 — 75 m roll",
    type: "material",
    brand: "Southwire",
    pack: { size: 75, unit: "m roll" },
    scope: "Indoor branch-circuit cable, 20 A. Kitchen, laundry and dedicated circuits.",
    cost: { low: 242.0, typical: 254.5, high: 267.0 },
    currency: "CAD",
    source: HD_CA,
  },
  nmd90_12_2_150m: {
    label: "NMD90 12/2 — 150 m roll",
    type: "material",
    brand: "Southwire",
    pack: { size: 150, unit: "m roll" },
    scope: "Indoor branch-circuit cable, 20 A. The bulk roll — $2.46/m.",
    cost: { low: 369.0, typical: 369.0, high: 369.0 },
    currency: "CAD",
    source: HD_CA,
  },
  nmd90_12_2_coil_5m: {
    label: "NMD90 12/2 — 5 m coil",
    type: "material",
    brand: "Southwire",
    pack: { size: 5, unit: "m coil" },
    scope: "The identical cable as nmd90_12_2_150m, packaged short. $11.99/m against $2.46/m — 4.9×, and §3.9's rank 6. This entry exists to make the `pack` field impossible to ignore: any wire default that does not state its roll size is wrong by up to five times.",
    cost: { low: 59.95, typical: 59.95, high: 59.95 },
    currency: "CAD",
    source: HD_CA,
  },
  nmd90_12_3_75m: {
    label: "NMD90 12/3 — 75 m roll",
    type: "material",
    brand: "Southwire",
    pack: { size: 75, unit: "m roll" },
    scope: "Three-conductor 20 A cable.",
    cost: { low: 325.0, typical: 325.0, high: 325.0 },
    currency: "CAD",
    source: HD_CA,
  },
  nmd90_10_2_75m: {
    label: "NMD90 10/2 — 75 m roll",
    type: "material",
    brand: "Southwire",
    pack: { size: 75, unit: "m roll" },
    scope: "30 A cable — water heater, small subpanel feed, some EV circuits.",
    cost: { low: 435.0, typical: 435.0, high: 435.0 },
    currency: "CAD",
    source: HD_CA,
  },
  nmd90_10_3_75m: {
    label: "NMD90 10/3 — 75 m roll",
    type: "material",
    brand: "Southwire",
    pack: { size: 75, unit: "m roll" },
    scope: "30 A three-conductor — dryer circuits.",
    cost: { low: 575.0, typical: 575.0, high: 575.0 },
    currency: "CAD",
    source: HD_CA,
  },
  nmd90_8_3_40m: {
    label: "NMD90 8/3 — 40 m roll",
    type: "material",
    brand: "Southwire",
    pack: { size: 40, unit: "m roll" },
    scope: "40 A three-conductor — range circuits. Note the pack is 40 m, not 75: comparing its price to a 75 m roll without reading `pack` makes it look cheap.",
    cost: { low: 588.0, typical: 588.0, high: 588.0 },
    currency: "CAD",
    source: HD_CA,
  },
  nmd90_6_3_cut: {
    label: "NMD90 6/3 — cut to length",
    type: "material",
    brand: "Southwire",
    pack: METRE_CUT,
    scope: "60 A three-conductor — subpanel feeds and large appliance circuits. Sold by the metre off a reel.",
    cost: { low: 11.32, typical: 11.32, high: 11.32 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.5: the same cable in a 10 m coil is $19.80/m — a 75% premium for packaging. Buy cut where the run is known.",
  },
  rw90_14: {
    label: "RW90 #14 single conductor",
    type: "material",
    brand: "Southwire",
    pack: METRE_CUT,
    scope: "Single conductor for conduit. Sold by the metre.",
    cost: { low: 1.11, typical: 1.11, high: 1.11 },
    currency: "CAD",
    source: HD_CA,
  },
  rw90_12: {
    label: "RW90 #12 single conductor",
    type: "material",
    brand: "Southwire",
    pack: METRE_CUT,
    scope: "Single conductor for conduit. Sold by the metre.",
    cost: { low: 1.47, typical: 1.47, high: 1.47 },
    currency: "CAD",
    source: HD_CA,
  },
  rw90_10: {
    label: "RW90 #10 single conductor",
    type: "material",
    brand: "Southwire",
    pack: METRE_CUT,
    scope: "Single conductor for conduit. Sold by the metre.",
    cost: { low: 2.45, typical: 2.45, high: 2.45 },
    currency: "CAD",
    source: HD_CA,
  },
  rw90_8: {
    label: "RW90 #8 single conductor",
    type: "material",
    brand: "Southwire",
    pack: METRE_CUT,
    scope: "Single conductor for conduit — subpanel feeders.",
    cost: { low: 4.45, typical: 4.45, high: 4.45 },
    currency: "CAD",
    source: HD_CA,
  },
  rw90_6: {
    label: "RW90 #6 single conductor",
    type: "material",
    brand: "Southwire",
    pack: METRE_CUT,
    scope: "Single conductor for conduit — subpanel feeders, 60 A.",
    cost: { low: 5.97, typical: 5.97, high: 5.97 },
    currency: "CAD",
    source: HD_CA,
  },
  rw90_2: {
    label: "RW90 #2 single conductor",
    type: "material",
    brand: "Southwire",
    pack: METRE_CUT,
    scope: "Service and feeder conductor, 100–125 A range.",
    cost: { low: 12.37, typical: 12.37, high: 12.37 },
    currency: "CAD",
    source: HD_CA,
  },
  rw90_3_0: {
    label: "RW90 3/0 single conductor",
    type: "material",
    brand: "Southwire",
    pack: METRE_CUT,
    scope: "Service conductor, 200 A range. Four of these is most of the copper on a service upgrade.",
    cost: { low: 26.75, typical: 26.75, high: 26.75 },
    currency: "CAD",
    source: HD_CA,
  },
  rw90_2_0: {
    label: "RW90 2/0 single conductor",
    type: "unpriced",
    brand: "Southwire",
    pack: METRE_CUT,
    scope: "Service conductor between #2 and 3/0.",
    currency: "CAD",
    source: HD_CA,
    gap: "§3.11: the listing shows '$4,799 each' against a cut-by-the-metre description — either a reel price or a data error, and not usable either way. The $21–23/m figure in circulation is interpolated between #2 and 3/0, not read. Interpolating it here would launder a guess into a default.",
  },
  bare_copper_gec: {
    label: "Bare copper grounding electrode conductor — #6 and #4",
    type: "unpriced",
    brand: "Unknown — not stocked",
    pack: METRE_CUT,
    scope: "The two sizes actually used for residential grounding electrode conductors.",
    currency: "CAD",
    source: HD_CA,
    gap: "§3.5 and §3.11: not stocked. Only #3 stranded exists ($8.23/m), which is not the size the job uses. A genuine gap on a part that appears on every service upgrade and every grounding line. Needs a supply-house figure.",
  },

  // ── Conduit, fittings and boxes (§3.6) ────────────────────────────────────

  pvc_sch40_half: {
    label: 'PVC Sch 40 conduit — ½"',
    type: "material",
    brand: "Grey rigid PVC, mainstream",
    pack: STICK_10FT,
    scope: "Conduit only. Fittings, straps and conductors all separate.",
    cost: { low: 8.35, typical: 8.35, high: 8.35 },
    currency: "CAD",
    source: HD_CA,
  },
  pvc_sch40_three_quarter: {
    label: 'PVC Sch 40 conduit — ¾"',
    type: "material",
    brand: "Grey rigid PVC, mainstream",
    pack: STICK_10FT,
    scope: "Conduit only.",
    cost: { low: 10.88, typical: 10.88, high: 10.88 },
    currency: "CAD",
    source: HD_CA,
  },
  pvc_sch40_1: {
    label: 'PVC Sch 40 conduit — 1"',
    type: "material",
    brand: "Grey rigid PVC, mainstream",
    pack: STICK_10FT,
    scope: "Conduit only.",
    cost: { low: 14.87, typical: 14.87, high: 14.87 },
    currency: "CAD",
    source: HD_CA,
    note: '§3.6 also read 1¼" $21.45 and 1½" $26.95, not carried as entries because residential runs are almost always ½"–1" or 2".',
  },
  pvc_sch40_2: {
    label: 'PVC Sch 40 conduit — 2"',
    type: "material",
    brand: "Grey rigid PVC, mainstream",
    pack: STICK_10FT,
    scope: "Conduit only. Service-entrance and underground-feeder size.",
    cost: { low: 35.55, typical: 35.55, high: 35.55 },
    currency: "CAD",
    source: HD_CA,
  },
  emt_half: {
    label: 'EMT steel conduit — ½"',
    type: "material",
    brand: "Steel EMT, mainstream",
    pack: STICK_10FT,
    scope: "Conduit only. Exposed and surface work.",
    cost: { low: 17.45, typical: 17.45, high: 17.45 },
    currency: "CAD",
    source: HD_CA,
  },
  emt_three_quarter: {
    label: 'EMT steel conduit — ¾"',
    type: "material",
    brand: "Steel EMT, mainstream",
    pack: STICK_10FT,
    scope: "Conduit only.",
    cost: { low: 26.94, typical: 26.94, high: 26.94 },
    currency: "CAD",
    source: HD_CA,
  },
  emt_1: {
    label: 'EMT steel conduit — 1"',
    type: "material",
    brand: "Steel EMT, mainstream",
    pack: STICK_10FT,
    scope: "Conduit only.",
    cost: { low: 37.48, typical: 37.48, high: 37.48 },
    currency: "CAD",
    source: HD_CA,
    note: '§3.6 also read 1¼" $49.95 and 1½" $59.95.',
  },
  emt_2: {
    label: 'EMT steel conduit — 2"',
    type: "material",
    brand: "Steel EMT, mainstream",
    pack: STICK_10FT,
    scope: "Conduit only. Service-entrance size.",
    cost: { low: 78.88, typical: 78.88, high: 78.88 },
    currency: "CAD",
    source: HD_CA,
  },
  pvc_elbow_90_half: {
    label: 'PVC 90° elbow — ½"',
    type: "material",
    brand: "Grey rigid PVC, mainstream",
    pack: EACH,
    scope: "Fitting only.",
    cost: { low: 2.63, typical: 2.63, high: 2.63 },
    currency: "CAD",
    source: HD_CA,
    note: '§3.6 also read 1" $4.42 and 2" $15.97. Bulk boxes run 20–30% under the each price — a real saving on a job that uses forty of them.',
  },
  pvc_elbow_90_three_quarter: {
    label: 'PVC 90° elbow — ¾"',
    type: "material",
    brand: "Grey rigid PVC, mainstream",
    pack: EACH,
    scope: "Fitting only.",
    cost: { low: 3.27, typical: 3.27, high: 3.27 },
    currency: "CAD",
    source: HD_CA,
  },
  pvc_lb_body_half: {
    label: 'PVC LB conduit body — ½"',
    type: "material",
    brand: "Grey rigid PVC, mainstream",
    pack: EACH,
    scope: "Fitting only. The wall-penetration fitting on nearly every exterior run.",
    cost: { low: 8.66, typical: 8.66, high: 8.66 },
    currency: "CAD",
    source: HD_CA,
    note: '§3.6 also read 1" $13.42 and 2" $35.53.',
  },
  pvc_lb_body_three_quarter: {
    label: 'PVC LB conduit body — ¾"',
    type: "material",
    brand: "Grey rigid PVC, mainstream",
    pack: EACH,
    scope: "Fitting only.",
    cost: { low: 9.88, typical: 9.88, high: 9.88 },
    currency: "CAD",
    source: HD_CA,
  },
  box_plastic_1gang: {
    label: "Box — plastic 1-gang, 18 in³",
    type: "material",
    brand: "Mainstream",
    pack: EACH,
    scope: "New-work box, nail-on. Not old-work, not fan-rated.",
    cost: { low: 2.87, typical: 2.87, high: 2.87 },
    currency: "CAD",
    source: HD_CA,
  },
  box_steel_1gang_each: {
    label: "Box — steel 1-gang, 12.5 in³ (each)",
    type: "material",
    brand: "Mainstream",
    pack: EACH,
    scope: "New-work steel box bought singly.",
    cost: { low: 2.22, typical: 2.22, high: 2.22 },
    currency: "CAD",
    source: HD_CA,
  },
  box_steel_1gang_30pk: {
    label: "Box — steel 1-gang, 12.5 in³ (30-pack)",
    type: "material",
    brand: "Mainstream",
    pack: { size: 30, unit: "pack" },
    scope: "Identical box to box_steel_1gang_each, bought in a contractor pack: $1.67 each against $2.22, a 25% saving that only exists at pack quantity. A rewire uses well over thirty.",
    cost: { low: 50.1, typical: 50.1, high: 50.1 },
    currency: "CAD",
    source: HD_CA,
  },
  box_old_work_steel: {
    label: "Box — old-work / cut-in, steel",
    type: "material",
    brand: "Mainstream",
    pack: EACH,
    scope: "Retrofit box with wing clamps, for a hole cut in finished drywall. 4–6× the new-work box it replaces.",
    cost: { low: 10.53, typical: 12.5, high: 14.48 },
    currency: "CAD",
    source: HD_CA,
    note: "Typical is the midpoint of the published range; §3.6 publishes a range only.",
  },
  box_octagon_ceiling_4in: {
    label: 'Box — octagon ceiling 4"',
    type: "material",
    brand: "Mainstream",
    pack: EACH,
    scope: "Light-fixture box. NOT rated for a ceiling fan — see the fan-rated entries.",
    cost: { low: 13.67, typical: 13.67, high: 13.67 },
    currency: "CAD",
    source: HD_CA,
  },
  box_weatherproof_pvc_1gang: {
    label: "Box — weatherproof PVC 1-gang",
    type: "material",
    brand: "Mainstream",
    pack: EACH,
    scope: "Exterior box. In-use cover separate.",
    cost: { low: 12.67, typical: 12.67, high: 12.67 },
    currency: "CAD",
    source: HD_CA,
  },
  box_fan_rated_new_work: {
    label: "Box — fan-rated with bar hanger, new work",
    type: "material",
    brand: "Mainstream",
    pack: EACH,
    scope: "Fan-rated box fixed to joists with the ceiling open.",
    cost: { low: 21.97, typical: 21.97, high: 21.97 },
    currency: "CAD",
    source: HD_CA,
  },
  box_fan_rated_rework: {
    label: "Box — fan-rated with bar hanger, rework",
    type: "material",
    brand: "Mainstream",
    pack: EACH,
    scope: "Fan-rated box installed through the existing ceiling hole. A 45% premium over new-work for the same function — two items, not one item with a note, because the choice is made by the ceiling, not by the buyer.",
    cost: { low: 31.95, typical: 31.95, high: 31.95 },
    currency: "CAD",
    source: HD_CA,
  },

  // ── Devices (§3.7) ────────────────────────────────────────────────────────

  receptacle_15a_duplex: {
    label: "Receptacle — 15 A duplex, standard (each)",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Standard-grade duplex receptacle, device only. No plate.",
    cost: { low: 3.28, typical: 3.28, high: 5.97 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.7's $2.60 low is the unit price inside a 10-pack, not an each price — see receptacle_15a_duplex_10pk. Folding it into this band would make a single receptacle look 21% cheaper than it can be bought.",
  },
  receptacle_15a_duplex_10pk: {
    label: "Receptacle — 15 A duplex, standard (10-pack)",
    type: "material",
    brand: "Mainstream residential lines",
    pack: { size: 10, unit: "pack" },
    scope: "The same device as receptacle_15a_duplex at pack quantity: $2.60 each.",
    cost: { low: 26.0, typical: 26.0, high: 26.0 },
    currency: "CAD",
    source: HD_CA,
  },
  receptacle_15a_weather_resistant: {
    label: "Receptacle — 15 A weather-resistant",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "WR-rated duplex for damp and wet locations. Device only.",
    cost: { low: 5.38, typical: 5.68, high: 5.97 },
    currency: "CAD",
    source: HD_CA,
  },
  receptacle_15a_commercial: {
    label: "Receptacle — 15 A commercial grade",
    type: "material",
    brand: "Mainstream commercial lines",
    pack: EACH,
    scope: "Spec-grade device, 6–8× the residential one. Worth naming separately because a contractor who fits spec grade as standard has no way to say so otherwise.",
    cost: { low: 21.58, typical: 26.52, high: 31.45 },
    currency: "CAD",
    source: HD_CA,
  },
  gfci_receptacle_15a: {
    label: "GFCI receptacle — 15 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Self-testing GFCI device, no plate.",
    cost: { low: 23.87, typical: 29.98, high: 98.48 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.9 ranks this 7th for misleading defaults — a 4.1× spread the research attributes to aesthetics only, not function.",
  },
  gfci_receptacle_20a: {
    label: "GFCI receptacle — 20 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Self-testing 20 A GFCI device, no plate.",
    cost: { low: 36.98, typical: 36.98, high: 37.97 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.7's $24.98 low is the unit price inside a 3-pack, not an each price.",
  },
  afci_receptacle: {
    label: "AFCI receptacle",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Outlet-branch-circuit AFCI device — the retrofit alternative to an AFCI breaker where the panel will not take one.",
    cost: { low: 46.57, typical: 46.57, high: 51.93 },
    currency: "CAD",
    source: HD_CA,
  },
  dual_function_receptacle: {
    label: "Dual-function AFCI/GFCI receptacle",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Arc-fault and ground-fault in one device.",
    cost: { low: 41.98, typical: 41.98, high: 41.98 },
    currency: "CAD",
    source: HD_CA,
  },
  usb_receptacle: {
    label: "USB receptacle",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Duplex with integrated USB charging.",
    cost: { low: 30.95, typical: 41.97, high: 91.97 },
    currency: "CAD",
    source: HD_CA,
  },
  weatherproof_in_use_cover_1gang: {
    label: "Weatherproof in-use cover — 1-gang",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: 'The "while-in-use" bubble cover required on exterior receptacles.',
    cost: { low: 49.0, typical: 49.0, high: 49.0 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.7's $24.50 is the unit price inside a 2-pack.",
  },
  switch_single_pole_15a: {
    label: "Switch — single-pole 15 A",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Standard toggle or decora switch, device only.",
    cost: { low: 1.58, typical: 2.57, high: 3.38 },
    currency: "CAD",
    source: HD_CA,
  },
  switch_3way: {
    label: "Switch — 3-way",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Three-way switch, device only.",
    cost: { low: 3.38, typical: 4.48, high: 28.22 },
    currency: "CAD",
    source: HD_CA,
  },
  dimmer_led_compatible: {
    label: "Dimmer — LED-compatible",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "LED-rated dimmer, device only. LED compatibility is the spec that matters and the cheap ones do not have it.",
    cost: { low: 18.97, typical: 33.95, high: 46.98 },
    currency: "CAD",
    source: HD_CA,
  },
  smart_switch_wifi: {
    label: "Smart switch — Wi-Fi",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Wi-Fi switch, device only. Most require a neutral in the box; the ones that do not cost more.",
    cost: { low: 21.95, typical: 55.98, high: 115.0 },
    currency: "CAD",
    source: HD_CA,
    note: "§3.9 ranks this 4th for misleading defaults — a 5.2× spread on feature tier, not taste, which is why it stays a cost default rather than becoming an allowance.",
  },
  wall_plate_1gang: {
    label: "Wall plate — 1-gang standard",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Standard plate. Individually trivial and collectively not: a rewire needs one per opening.",
    cost: { low: 0.68, typical: 1.91, high: 2.34 },
    currency: "CAD",
    source: HD_CA,
  },
  wall_plate_designer: {
    label: "Wall plate — screwless / designer",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Screwless plate, 3× the standard one.",
    cost: { low: 3.37, typical: 6.28, high: 11.98 },
    currency: "CAD",
    source: HD_CA,
  },

  // ── Lighting, fans and safety (§3.8) ──────────────────────────────────────

  recessed_led_retrofit: {
    label: 'Recessed LED — 4"/6" retrofit',
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Retrofit disc or canless unit that fits an existing hole. No housing.",
    cost: { low: 16.47, typical: 30.73, high: 44.98 },
    currency: "CAD",
    source: HD_CA,
    note: "Typical is the midpoint of the published range; §3.8 publishes a range only.",
  },
  recessed_led_premium_tunable: {
    label: "Recessed LED — premium / tunable",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Tunable-white or high-CRI unit.",
    cost: { low: 44.98, typical: 89.49, high: 134.0 },
    currency: "CAD",
    source: HD_CA,
    note: "Typical is the midpoint of the published range; §3.8 publishes a range only.",
  },
  recessed_housing_new_construction: {
    label: "Recessed housing — new construction, IC / airtight",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Housing only, fixed to joists with the ceiling open. Trim and lamp separate.",
    cost: { low: 19.98, typical: 51.85, high: 83.72 },
    currency: "CAD",
    source: HD_CA,
    note: "Typical is the midpoint of the published range; §3.8 publishes a range only.",
  },
  bath_fan_basic: {
    label: "Bath fan — basic",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Fan only, no light, no humidity sensor. Ducting separate.",
    cost: { low: 39.99, typical: 67.49, high: 94.98 },
    currency: "CAD",
    source: HD_CA,
    note: "Typical is the midpoint of the published range; §3.8 publishes a range only.",
  },
  bath_fan_light_humidity: {
    label: "Bath fan — with light or humidity sensor",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Fan with integrated light and/or humidity sensing. 3.3× the basic unit.",
    cost: { low: 138.0, typical: 223.5, high: 309.0 },
    currency: "CAD",
    source: HD_CA,
    note: "Typical is the midpoint of the published range; §3.8 publishes a range only.",
  },
  smoke_alarm_hardwired: {
    label: "Smoke alarm — hardwired with battery backup",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Smoke only, hardwired, interconnectable by wire.",
    cost: { low: 52.0, typical: 59.49, high: 66.97 },
    currency: "CAD",
    source: HD_CA,
    note: "Typical is the midpoint of the published range; §3.8 publishes a range only.",
  },
  smoke_co_combo_hardwired: {
    label: "Smoke/CO combination — hardwired",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Smoke and carbon monoxide, hardwired, interconnectable by wire.",
    cost: { low: 99.97, typical: 104.49, high: 109.0 },
    currency: "CAD",
    source: HD_CA,
    note: "Typical is the midpoint of the published range; §3.8 publishes a range only.",
  },
  smoke_co_wireless_interconnect: {
    label: "Smoke/CO — wireless interconnect",
    type: "material",
    brand: "Mainstream residential lines",
    pack: EACH,
    scope: "Interconnects by radio, so no interconnect wire has to be fished. That is the whole point on a retrofit and it is why this is a separate item, not a variant: 2.6× the hardwired combo for the same functional description (§3.8).",
    cost: { low: 269.0, typical: 279.0, high: 289.0 },
    currency: "CAD",
    source: HD_CA,
  },

  // ── Allowances (§3.9 ranks 1–2, Part 4 rule #9) ───────────────────────────
  //
  // Not cost defaults. The spread on these is the homeowner's taste, not the
  // trade's, so a default is a fiction — the same treatment the plumbing set
  // gives fixtures. The client picks, an allowance line carries the number, and
  // the difference reconciles on the invoice.

  ceiling_fan_allowance: {
    label: "Ceiling fan — allowance",
    type: "allowance",
    brand: "Client's choice — no brand default is meaningful",
    pack: EACH,
    scope: "Fixture supply only. Installation is billed on the catalogue's ceiling-fan lines, which are priced on the box and the ceiling, not on the fan.",
    currency: "CAD",
    source: HD_CA,
    spread: "10.7× across functionally interchangeable units — §3.9 rank 2, cause: homeowner choice.",
    guidance:
      "Agree an allowance figure with the client and show it on the quote as an allowance referencing a selection list (§2.5). Anything they pick above it is a change order with a signature, not a surprise on the invoice.",
  },
  exterior_lantern_allowance: {
    label: "Exterior wall lantern — allowance",
    type: "allowance",
    brand: "Client's choice — no brand default is meaningful",
    pack: EACH,
    scope: "Fixture supply only. Installation is billed on the catalogue's fixture line.",
    currency: "CAD",
    source: HD_CA,
    spread: "13.3× — §3.9 rank 1, the widest spread on any functionally interchangeable item in the whole material set.",
    guidance:
      "Agree an allowance figure with the client and show it on the quote as an allowance referencing a selection list (§2.5).",
  },
  decorative_fixture_allowance: {
    label: "Chandelier or decorative fixture — allowance",
    type: "allowance",
    brand: "Client's choice — no brand default is meaningful",
    pack: EACH,
    scope: "Fixture supply only. Installation is billed on the catalogue's fixture or heavy-fixture line, and heavy fixtures carry their own weight-tiered adders.",
    currency: "CAD",
    source: HD_CA,
    spread:
      "Not measured. §3.9 measured lanterns and fans; this item follows the same logic and Part 1 corroborates the practice — its 'Level 1 light fixture' line is explicitly customer-supplied at $300 of labour.",
    guidance:
      "Client-supplied is the norm here. Where the contractor supplies, use an allowance and note that a fixture over 50 lb or a ceiling over 12 ft changes the labour line too, not just the allowance.",
  },
};

/** §3.5 and §3.6 give these as multipliers rather than second tables, because
 *  the ratio held consistently across every size read. AC90 and NMWU are the
 *  same cable in a different jacket and the ratio is stable enough to use;
 *  EMT-over-PVC was consistent at every trade size read.
 *
 *  Deliberately absent: a CAD/USD factor. §3.10 measured 1.235 and 1.307 on the
 *  only two matched SKUs and then said do not derive CAD defaults by converting
 *  USD ones. Exporting the ratio would invite exactly that. */
export const ELECTRICAL_MATERIAL_MULTIPLIERS = {
  ac90OverNmd90: { low: 1.6, high: 1.9, note: "Armoured (BX) against NMD90 at bulk quantity — §3.5." },
  nmwuOverNmd90: { low: 1.9, high: 2.4, note: "Direct-burial against NMD90 at bulk quantity — §3.5. This is the trenching multiplier." },
  emtOverPvc: { low: 2.1, high: 2.2, note: "EMT against PVC at the same trade size — §3.6." },
};

// Fields that are themselves keyed objects need a nested merge, the same
// reasoning as materialRecipes.js: a company overriding just `cost.typical`
// should not blow away `cost.low`, and overriding `pack.size` should not lose
// `pack.unit` — which would leave a wire default whose roll size is unknown,
// the exact failure §3.1 exists to prevent.
const NESTED_KEYS = ["cost", "pack", "allowance"];

/**
 * Merge a company's saved material-cost overrides on top of these defaults.
 * Same semantics as getRecipe() in app/data/materialRecipes.js: `overrides`
 * only needs the keys that differ, everything else falls through untouched,
 * and it is safe to call with nothing.
 *
 * Two deliberate refusals, both documented rather than silent:
 *
 *   * A key that is not in ELECTRICAL_MATERIALS is IGNORED. The override map
 *     comes from a settings form built from these keys, so an unknown key is a
 *     typo or a stale key from a removed item. Materialising it would create a
 *     phantom material with no brand, pack, scope or source — the three fields
 *     §3.1 proves a schema cannot omit — and the check script would reject it.
 *
 *   * `type` is not overridable, and `cost` is dropped on anything that is not
 *     a `material`. Allowance and unpriced entries carry no cost ON PURPOSE
 *     (Part 4 rule #9, §3.11): a company that wants its own ceiling-fan figure
 *     is setting an ALLOWANCE, not a cost, and `allowance` is overridable for
 *     exactly that. Letting a cost land on an allowance would quietly convert
 *     the honest "we don't know, you choose" into a fabricated default.
 */
export function getElectricalMaterials(overrides) {
  if (!overrides || Object.keys(overrides).length === 0) return ELECTRICAL_MATERIALS;

  const result = { ...ELECTRICAL_MATERIALS };

  for (const key of Object.keys(overrides)) {
    const base = ELECTRICAL_MATERIALS[key];
    if (!base) continue; // unknown key — see the refusal above

    const patch = { ...overrides[key] };
    delete patch.type;
    if (base.type !== "material") delete patch.cost;

    const merged = { ...base, ...patch };
    for (const nestedKey of NESTED_KEYS) {
      if (patch[nestedKey]) merged[nestedKey] = { ...base[nestedKey], ...patch[nestedKey] };
    }
    result[key] = merged;
  }

  return result;
}

/** True when the key names a shipped material, allowance or known gap. */
export function hasElectricalMaterial(key) {
  return Object.prototype.hasOwnProperty.call(ELECTRICAL_MATERIALS, key);
}
