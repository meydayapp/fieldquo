// lib/pricing/labourPresets.js
//
// FieldQuo's starting LABOUR figures for the trades whose hours had no
// editable home — the PRESETS a company inherits until it states its own.
// The owner (2026-10-05): "this is only for the preset; the company can
// modify them to adjust to their own rates."
//
// ══ What lives here, and what does not ═════════════════════════════════════
//
// Each figure here has a LIVE reader:
//
//   the drawing read's third rung   lib/planRead/tradeDefaults.js prices an
//                                   electrical, plumbing, framing, drywall or
//                                   flooring item the company has no service
//                                   for from these (lib/planRead/tradePricing.js)
//   the services' suggested rates   lib/services/productionRates.js
//                                   SUGGESTED_PRODUCTION is DERIVED from them,
//                                   so the "suggested" placeholder beside a
//                                   service's production rate and the read's
//                                   hours are one number, not two
//
// A figure with no reader is not here. A rate-card box that nothing reads is
// the control that appears to work and doesn't (AGENTS.md) — so HVAC
// equipment hours, the brick bond adders and the window/door install figures
// live in their staged recipes until the trade that reads them ships.
//
// Roofing is not here either: its labour already lives in the roofing book
// (lib/pricing/roofLabour.js ROOF_LABOUR_DEFAULTS), edited on the roofing rate
// card. Framing, drywall and flooring figures that already had a home in a
// staged recipe are READ from that recipe below, never restated — the copy is
// the one that rots (AGENTS.md failure class 4). The recipe is where each
// carries its Craftsman citation.
//
// ══ Units ══════════════════════════════════════════════════════════════════
//
// Every figure is PAID LABOUR-HOURS per unit — one person for one hour — the
// unit lib/services/productionRates.js and the cost panel already use. The
// Craftsman books state theirs the same way ("manhours, not crew hours",
// NPH 2025 p.5; NCE 2026 p.7), so a book figure is copied, not converted.
//
// ══ Where a company edits them ═════════════════════════════════════════════
//
// Settings → Services → the trade's rate card (app/app/settings/services/
// RateCard.js), stored sparse on CompanyServiceCategory.rates under
// `presets.<key>` and sanitised by lib/pricing/sanitiseRates.js — no schema
// change. A company's own value wins; with none, the preset applies and the
// card says "FieldQuo default". Nothing here ever writes to a company's row.
//
// ══ Sources ════════════════════════════════════════════════════════════════
//
// FieldQuo's own defaults, calibrated against the Craftsman estimating guides
// (owner decision 2026-10-05: "fill the gaps and fix the mismatches using
// their numbers as reference"). Labour figures only — no book dollar figure is
// used anywhere. Each entry carries `src`, the book, year, printed page and
// row it was calibrated against, and `tag`:
//   READ     the book's figure as printed
//   DERIVED  arithmetic on book figures, the arithmetic stated in `src`
//   ASSUMPTION  FieldQuo's own allowance where no book row exists, said so
// A screen that shows a source says "industry reference (Craftsman
// estimating guides)" — SOURCE_LABEL below — never a book table.
//
// Pure — runs in the browser (the rate card) and in Node.

import { getInteriorRecipe } from "@/app/data/priceBooks/interior";
import { STRUCTURAL_RECIPES } from "@/app/data/priceBooks/structural";
import { PANEL_SWAP_HOURS } from "@/lib/estimate/rewireTakeoff";

/** What a screen says about where these figures come from. */
export const SOURCE_LABEL = "industry reference (Craftsman estimating guides)";

const round4 = (n) => Math.round(n * 10000) / 10000;

// ═══════════════════════════════════════════════════════════════════════════
// LABEL PARTS — every preset label is composed from these, so the nine
// languages translate ~70 words rather than ~150 sentences
// (app/i18n/appMessages.js app.labourPresets.part.<key>).
// ═══════════════════════════════════════════════════════════════════════════

export const LABEL_PARTS = Object.freeze({
  // electrical
  house: "House",
  commercial: "Commercial",
  receptacle: "Receptacle",
  gfci: "GFCI receptacle",
  switch1: "Switch",
  switch3: "3-way switch",
  dimmer: "Dimmer",
  lightFixture: "Light fixture",
  smokeCo: "Smoke / CO detector",
  dedicated: "Dedicated 240 V outlet",
  circuit: "Circuit (home run and breaker)",
  dataDrop: "Data drop",
  panelSwap: "Panel swap (remove and replace)",
  removeDevice: "Remove a device",
  romexNew: "Cable (NM-B), new work",
  romexReno: "Cable (NM-B), renovation",
  withRun: "with its wiring run and box",
  premium: "added to the device",
  disconnect: "Disconnect",
  fireAlarm: "Fire alarm device",
  smokeDetector: "smoke detector",
  pullStation: "pull station",
  heatDetector: "heat detector",
  emtSlab: "EMT in slab",
  emtConcealed: "EMT concealed",
  emtExposed: "EMT exposed",
  pvc: "PVC Schedule 40",
  grs: "Rigid steel (GRS)",
  ent: "ENT (flexible non-metallic)",
  flex: "Flexible steel",
  liquidTight: "Liquid-tight",
  thhn: "Wire pulled (THHN), per conductor",
  // plumbing
  toilet: "Toilet",
  lavatory: "Lavatory",
  sink: "Kitchen sink",
  tub: "Tub",
  shower: "Shower",
  urinal: "Urinal",
  mopSink: "Mop sink",
  fountain: "Drinking fountain",
  floorDrain: "Floor drain",
  cleanout: "Cleanout",
  gasOutlet: "Gas outlet",
  set: "set",
  roughIn: "rough-in",
  budget: "all-in budget",
  heaterGasSet: "Gas tank water heater, set",
  heaterElectricSet: "Electric tank water heater, set",
  heaterTanklessSet: "Tankless water heater, set",
  heaterConnection: "Water heater connection",
  heaterVent: "B-vent, per foot",
  heaterVentFt: "B-vent length assumed",
  heaterTanklessVent: "Tankless vent kit",
  heaterRemove: "Remove the old tank",
  copper: "Copper pipe",
  plastic: "Plastic pipe",
  castIron: "Cast iron pipe",
  noHub: "No-hub cast iron pipe",
  steel: "Threaded steel pipe",
  attic: "In an attic",
  crawl: "In a crawl space",
  height: "Working height",
  // framing
  partition: "Interior 2x4 wall",
  exteriorWall: "Exterior 2x6 wall",
  wallSheathing: "Wall sheathing",
  roofSheathing: "Roof sheathing",
  subfloor: "Subfloor",
  blocking: "Blocking",
  ceilingJoists: "Ceiling joists",
  header: "Header",
  // drywall
  hang: "Hang board",
  ceilingHang: "Ceiling hang",
  typeX: "5/8 in Type X",
  finishL1: "Finish, Level 1",
  finishL2: "Finish, Level 2",
  finishL3: "Finish, Level 3",
  finishL4: "Finish, Level 4",
  finishL5: "Finish, Level 5",
  ceilingFinish: "Ceiling finish",
  cornerBead: "Corner bead, installed",
  patch: "Patch",
  demo: "Remove drywall",
  orangePeel: "Orange peel texture",
  spatter: "Spatter texture",
  knockdown: "Knockdown texture",
  skipTrowel: "Skip trowel texture",
  popcorn: "Popcorn texture",
  // flooring
  lvp: "Luxury vinyl plank",
  laminate: "Laminate (click)",
  engineered: "Engineered hardwood",
  solid: "Solid hardwood, nailed",
  sheetVinyl: "Sheet vinyl",
  vinylTile: "Vinyl tile",
  sandFinish: "Sand and finish on site",
  tearOutHardwoodNailed: "Tear out nailed hardwood",
  tearOutHardwoodGlued: "Tear out glued hardwood",
  tearOutCarpet: "Tear out carpet",
  tearOutResilient: "Tear out resilient",
  tearOutTile: "Tear out tile",
});

export const UNIT_LABELS = Object.freeze({
  each: "h each",
  lf: "h per ft",
  clf: "h per 100 ft",
  sqft: "h per sq ft",
  factor: "×",
  ft: "ft",
});

// A preset: { key, value, unit, parts: [LABEL_PARTS keys or literal "½ in"],
// src, tag, step, group }. `parts` items that are not LABEL_PARTS keys print
// as they are (sizes, gauges).
const P = (group, key, value, unit, parts, src, tag = "READ", step) =>
  Object.freeze({ group, key, value, unit, parts: Object.freeze(parts), src, tag, step: step ?? (unit === "factor" ? 0.05 : value >= 1 ? 0.1 : 0.001) });

// ═══════════════════════════════════════════════════════════════════════════
// ELECTRICAL
// ═══════════════════════════════════════════════════════════════════════════
//
// A HOUSE prices each device WITH its wiring run and box — NRI's renovation
// rows, the only Craftsman residential productivity data (NRI 2018 p.127:
// "install switch or outlet with wiring run & box"). Before this, a house
// device was NECA's commercial minutes × 0.456 (lib/estimate/rewireTakeoff.js
// RESIDENTIAL_PRODUCTIVITY_FACTOR), which lands at NRI's ECONOMY whole-house
// grade and a third of NRI's per-device hours, because it carries no run.
// A COMMERCIAL job keeps NECA as published (the owner, 2026-10-04) — its
// devices were within 1.15× of NCE's — except the circuit, which NCE prints at
// 2.49 h against NECA's 1.40.

const E = "electrical";
const NRI127 = "Craftsman NRI 2018 p.127";
const ELECTRICAL = [
  P(E, "resReceptacle", 0.977, "each", ["house", "receptacle", "withRun"], `${NRI127}, "install switch or outlet with wiring run & box" → 0.977 mh/ea`),
  P(E, "resSwitch", 0.977, "each", ["house", "switch1", "withRun"], `${NRI127}, "install switch or outlet with wiring run & box" → 0.977 mh/ea`),
  P(E, "resSwitch3Way", 1.95, "each", ["house", "switch3", "withRun"], `${NRI127}, "install 3-way switch with wiring run & box" → 1.95 mh/ea`),
  // GFCI and dimmer: NRI prints no separate row. The device's own premium
  // from NCE (GFCI .324 vs duplex .162; dimmer .417–.626 vs one-pole switch
  // .112–.187, midpoints) is added to NRI's device-with-run.
  P(E, "resGfci", round4(0.977 + 0.162), "each", ["house", "gfci", "withRun"], `${NRI127} 0.977 + GFCI premium, Craftsman NCE 2019 p.563, "Ground fault circuit interrupter receptacle" .324 − "grounded duplex" .162 → 1.139 mh/ea`, "DERIVED"),
  P(E, "resDimmer", round4(0.977 + 0.37), "each", ["house", "dimmer", "withRun"], `${NRI127} 0.977 + dimmer premium, Craftsman NCE 2019 p.564, dimmer .417–.626 (mid .52) − one-pole switch .112–.187 (mid .15) → 1.347 mh/ea`, "DERIVED"),
  P(E, "resLightFixture", round4(0.574 + 0.802), "each", ["house", "lightFixture", "withRun"], `Craftsman NRI 2018 p.129, "interior incandescent light fixture" .574 + p.127 "wiring run, typical 120 volt outlet or light" .802 → 1.376 mh/ea`, "DERIVED"),
  P(E, "resSmokeCo", round4(0.398 + 0.802), "each", ["house", "smokeCo", "withRun"], `Craftsman NRI 2018 p.128, "detector, direct-wired" .398 + p.127 wiring run .802 → 1.20 mh/ea`, "DERIVED"),
  P(E, "resDedicated", 1.34, "each", ["house", "dedicated", "withRun"], `${NRI127}, "240 volt system, install outlet or switch with wiring run & box" → 1.34 mh/ea`),
  P(E, "resCircuit", round4(0.636 + 0.802), "each", ["house", "circuit"], `Craftsman NRI 2018 p.128, "single-pole circuit breaker" .636 + p.127 wiring run .802 → 1.438 mh/ea`, "DERIVED"),
  P(E, "resDataDrop", round4(0.256 + 0.358), "each", ["house", "dataDrop"], `Craftsman NRI 2018 p.128, "low-voltage outlet, install outlet" .256 + "wiring (per outlet)" .358 → 0.614 mh/ea`, "DERIVED"),
  P(E, "romexNewPerLf", 0.03, "lf", ["romexNew"], `Craftsman NCE 2019 p.559, NM-B "12 gauge, 2 conductor" E4@.030 → 0.030 mh/LF`),
  P(E, "romexRenoPerLf", 0.047, "lf", ["romexReno"], `Craftsman NRI 2018 p.127, "#12 2 wire with ground Romex" → 0.047 mh/LF`),
  P(E, "comCircuit", 2.49, "each", ["commercial", "circuit"], `Craftsman NCE 2019 p.547, EMT branch circuit 30', "3 #12 wire, 1/2" conduit" E4@2.49 → 2.49 mh/ea`),
  P(E, "gfciPremium", 0.162, "each", ["commercial", "gfci", "premium"], `Craftsman NCE 2019 p.563, GFCI receptacle .324 − grounded duplex .162 → 0.162 mh/ea`, "DERIVED"),
  P(E, "dimmerPremium", 0.37, "each", ["commercial", "dimmer", "premium"], `Craftsman NCE 2019 p.564, dimmer .417–.626 (mid .52) − one-pole switch .112–.187 (mid .15) → 0.37 mh/ea`, "DERIVED"),
  P(E, "threeWayPremium", 0.11, "each", ["commercial", "switch3", "premium"], `Craftsman NCE 2019 p.564, "Three-way switch" .227–.291 (mid .259) − one-pole .112–.187 (mid .15) → 0.11 mh/ea`, "DERIVED"),
  // Shared by both.
  P(E, "panelSwap", PANEL_SWAP_HOURS, "each", ["panelSwap"], `Craftsman NRI 2018 p.126, "remove breaker panel" 6.09 + p.128 "200 amp int. breaker panel" 9.77 → 15.86 mh/ea (lib/estimate/rewireTakeoff.js PANEL_SWAP_HOURS)`, "DERIVED"),
  P(E, "removeDevice", 0.15, "each", ["removeDevice"], `Craftsman NRI 2018 p.126, "remove 120 volt switch or outlet" 1D@.150 → 0.150 mh/ea`),
  P(E, "disconnect30", 3.06, "each", ["disconnect", "30 A"], `Craftsman NCE 2019 p.568, NEMA-1 safety switch "30 amp" E4@3.06 → 3.06 mh/ea`),
  P(E, "disconnect60", 3.89, "each", ["disconnect", "60 A"], `Craftsman NCE 2019 p.568, NEMA-1 safety switch "60 amp" E4@3.89 → 3.89 mh/ea`),
  P(E, "disconnect100", 4.2, "each", ["disconnect", "100 A"], `Craftsman NCE 2019 p.568, NEMA-1 safety switch "100 amp" E4@4.20 → 4.20 mh/ea`),
  P(E, "disconnect200", 6.92, "each", ["disconnect", "200 A"], `Craftsman NCE 2019 p.568, NEMA-1 safety switch "200 amp" E4@6.92 → 6.92 mh/ea`),
  P(E, "fireAlarmSmoke", 0.71, "each", ["fireAlarm", "smokeDetector"], `Craftsman NCE 2019 p.591, "Ionization AC smoke detector, with wiring" E4@.710 → 0.710 mh/ea`),
  P(E, "fireAlarmPull", 0.497, "each", ["fireAlarm", "pullStation"], `Craftsman NCE 2019 p.591, "Fire alarm pull stations, manual operation" E4@.497 → 0.497 mh/ea`),
  P(E, "fireAlarmHeat", 0.746, "each", ["fireAlarm", "heatDetector"], `Craftsman NCE 2019 p.591, "Fixed temp. and rate of rise smoke detector" E4@.746 → 0.746 mh/ea`),
];

// Conduit, per 100 ft (CLF), one journeyman — NEE 2025, units unchanged
// 2014 → 2026. Includes bending and boring studs; excludes fittings and wire.
// NEE's own adjustments are stated on p.16 and NOT applied silently here:
// mostly exposed +20% is already the "exposed" column; 18 ft up +15% and
// trapeze runs −40% are the estimator's to apply.
const CONDUIT_SIZES = Object.freeze(["0.5", "0.75", "1", "1.25", "1.5", "2"]);
const SIZE_LABEL = { "0.5": "½″", "0.75": "¾″", 1: "1″", 1.25: "1¼″", 1.5: "1½″", 2: "2″" };
const CONDUIT_TABLE = Object.freeze({
  emtSlab: { page: 17, row: "EMT in slab", values: [3.25, 3.5, 4.0, 4.5, 5.5, 7.0] },
  emtConcealed: { page: 17, row: "EMT concealed in walls and closed ceilings", values: [3.5, 3.75, 4.25, 5.0, 6.0, 8.0] },
  emtExposed: { page: 17, row: "EMT exposed", values: [3.75, 4.0, 4.5, 6.0, 8.0, 10.0] },
  pvc: { page: 37, row: "PVC Schedule 40", values: [3.1, 3.2, 3.3, 3.4, null, 3.5] },
  grs: { page: 49, row: "galvanized rigid steel", values: [4.0, 4.5, 5.0, 7.0, null, 10.0] },
  ent: { page: 48, row: "ENT", values: [2.15, 2.25, 2.5, null, null, null] },
  flex: { page: 28, row: "flexible steel conduit", values: [2.75, 3.0, 3.25, 3.5, 3.75, 4.0] },
  liquidTight: { page: 33, row: "liquid-tight flexible conduit", values: [4.0, 4.5, 5.0, 6.0, 7.0, null] },
});
export const CONDUIT_TYPES = Object.freeze(Object.keys(CONDUIT_TABLE));
export { CONDUIT_SIZES };
for (const [type, t] of Object.entries(CONDUIT_TABLE)) {
  CONDUIT_SIZES.forEach((size, i) => {
    const v = t.values[i];
    if (v === null) return;
    ELECTRICAL.push(P(E, `conduit_${type}_${size.replace(".", "_")}`, v, "clf", [type, SIZE_LABEL[size]], `Craftsman NEE 2025 p.${t.page}, ${t.row} ${SIZE_LABEL[size]} L1@${v} per CLF → ${v} mh/100 LF`, "READ", 0.05));
  });
}
// THHN pulled into conduit, per conductor-foot (NCE 2019 p.558, E4).
const THHN = Object.freeze([["14", 0.006], ["12", 0.007], ["10", 0.008], ["8", 0.009], ["6", 0.01], ["4", 0.012], ["1/0", 0.015], ["4/0", 0.018], ["250", 0.02]]);
export const THHN_GAUGES = Object.freeze(THHN.map(([g]) => g));
for (const [g, v] of THHN) {
  ELECTRICAL.push(P(E, `thhn_${g.replace("/", "_")}`, v, "lf", ["thhn", g === "250" ? "250 kcmil" : `#${g}`], `Craftsman NCE 2019 p.558, THHN "${g === "250" ? "250 MCM" : `${g} gauge`}" pulled, E4@${v} → ${v} mh per conductor-LF`, "READ", 0.001));
}

// ═══════════════════════════════════════════════════════════════════════════
// PLUMBING
// ═══════════════════════════════════════════════════════════════════════════
//
// A house: the fixture SET (NPH 2025 p.27–30) plus its residential ROUGH-IN
// (p.31–32, PE supply and ABS waste), both new construction, both one
// plumber-hour basis. A commercial job: NPH's all-in budget per fixture
// (plastic piping, 35 ft of branch plus mains — NPH 2019 p.436) where NPH
// prints one; urinals, mop sinks and fountains have none, so they take the set
// plus the commercial rough-in. The budget INCLUDES branch piping: a read that
// also measures pipe on a commercial job counts that pipe twice, and the
// line says so.

const PL = "plumbing";
const NPH = "Craftsman NPH 2025";
const PLUMBING = [
  P(PL, "wcSet", 2.1, "each", ["toilet", "set"], `${NPH} p.27, "Water closet, floor mounted, tank type" P1@2.10 → 2.10 mh/ea`),
  P(PL, "wcRough", 2.0, "each", ["toilet", "roughIn"], `${NPH} p.31, residential rough-in "Water closet" → 2.00 mh/ea`),
  P(PL, "lavSet", 2.0, "each", ["lavatory", "set"], `${NPH} p.28, "Lavatory, countertop" → 2.00 mh/ea`),
  P(PL, "lavRough", 1.75, "each", ["lavatory", "roughIn"], `${NPH} p.31, residential rough-in "Lavatory" → 1.75 mh/ea`),
  P(PL, "sinkSet", 2.15, "each", ["sink", "set"], `${NPH} p.29, "Kitchen sink, double, stainless" → 2.15 mh/ea`),
  P(PL, "sinkRough", 1.75, "each", ["sink", "roughIn"], `${NPH} p.31, residential rough-in "Sink" → 1.75 mh/ea`),
  P(PL, "tubSet", 2.5, "each", ["tub", "set"], `${NPH} p.29, "Bathtub, steel / fiberglass / acrylic" → 2.50 mh/ea`),
  P(PL, "tubRough", 2.1, "each", ["tub", "roughIn"], `${NPH} p.31, residential rough-in "Bathtub" → 2.10 mh/ea`),
  P(PL, "showerSet", 3.5, "each", ["shower", "set"], `${NPH} p.30, "Shower stall, 1-piece" → 3.50 mh/ea`),
  P(PL, "showerRough", 2.45, "each", ["shower", "roughIn"], `${NPH} p.31, residential rough-in "Shower" → 2.45 mh/ea`),
  P(PL, "urinalSet", 3.0, "each", ["urinal", "set"], `${NPH} p.28, "Urinal, wall hung" → 3.00 mh/ea`),
  P(PL, "urinalRough", 2.75, "each", ["urinal", "roughIn"], `${NPH} p.32, commercial rough-in "Water closet, flush valve" 2.75 — NPH prints no urinal rough-in; the flush-valve closet is the nearest row`, "DERIVED"),
  P(PL, "mopSinkSet", 2.5, "each", ["mopSink", "set"], `${NPH} p.30, "Mop sink" 2.35–2.65 → midpoint 2.50 mh/ea`, "DERIVED"),
  P(PL, "mopSinkRough", 2.4, "each", ["mopSink", "roughIn"], `${NPH} p.32, commercial rough-in "Mop sink" → 2.40 mh/ea`),
  P(PL, "fountainSet", 2.25, "each", ["fountain", "set"], `${NPH} p.30, "Drinking fountain" 2.00–2.50 → midpoint 2.25 mh/ea`, "DERIVED"),
  P(PL, "fountainRough", 1.9, "each", ["fountain", "roughIn"], `${NPH} p.32, commercial rough-in "Lavatory" 1.90 — NPH prints no fountain rough-in; a lavatory's supply and waste is the nearest row`, "DERIVED"),
  P(PL, "floorDrainSet", 0.5, "each", ["floorDrain", "set"], `Craftsman NPH 2018 p.168, "Floor drain" P1@.500 → 0.50 mh/ea`),
  P(PL, "cleanoutEach", 0.33, "each", ["cleanout"], `Craftsman NPH 2018 p.169, "Cleanout, in-line, ABS/PVC 2–4"" .30–.35 → midpoint 0.33 mh/ea`, "DERIVED"),
  P(PL, "gasOutletEach", 1.15, "each", ["gasOutlet"], `${NPH} p.26, "Kitchen appliance gas trim, 1/2"" P1@1.15 → 1.15 mh/ea`),
  // Commercial all-in budgets (plastic piping), NPH 2019 p.436.
  P(PL, "comWc", 8, "each", ["commercial", "toilet", "budget"], `Craftsman NPH 2019 p.436, budget per fixture, plastic, "Water closet, tank" → 8 mh/ea`),
  P(PL, "comLav", 9, "each", ["commercial", "lavatory", "budget"], `Craftsman NPH 2019 p.436, budget per fixture, plastic, "Lavatory" → 9 mh/ea`),
  P(PL, "comSink", 10, "each", ["commercial", "sink", "budget"], `Craftsman NPH 2019 p.436, budget per fixture, plastic, "Kitchen sink" → 10 mh/ea`),
  P(PL, "comTub", 12, "each", ["commercial", "tub", "budget"], `Craftsman NPH 2019 p.436, budget per fixture, plastic, "Tub" → 12 mh/ea`),
  P(PL, "comShower", 7, "each", ["commercial", "shower", "budget"], `Craftsman NPH 2019 p.436, budget per fixture, plastic, "Shower" → 7 mh/ea`),
  P(PL, "comFloorDrain", 7, "each", ["commercial", "floorDrain", "budget"], `Craftsman NPH 2019 p.436, budget per fixture, plastic, "Floor drain" → 7 mh/ea`),
  P(PL, "comCleanout", 4, "each", ["commercial", "cleanout", "budget"], `Craftsman NPH 2019 p.436, budget per fixture, plastic, "Cleanout" → 4 mh/ea`),
  // Water heaters (NPH 2025 p.19–21; removal NPH 2019 p.432). Composed by
  // type in lib/planRead/tradeDefaults.js waterHeaterHours().
  P(PL, "heaterGasSet", 1.0, "each", ["heaterGasSet"], `${NPH} p.19, gas-fired residential "40 gallon" P1@1.00, set in place only → 1.00 mh/ea`),
  P(PL, "heaterElectricSet", 1.2, "each", ["heaterElectricSet"], `${NPH} p.19, electric residential "40 gallon" P1@1.20, set in place only → 1.20 mh/ea`),
  P(PL, "heaterTanklessSet", 18, "each", ["heaterTanklessSet"], `${NPH} p.20, tankless natural gas P1@16.0–20.0 → midpoint 18 mh/ea`, "DERIVED"),
  P(PL, "heaterConnection", 1.75, "each", ["heaterConnection"], `${NPH} p.21, "connection assembly, 3/4" residential" P1@1.75 → 1.75 mh/ea`),
  P(PL, "heaterVentPerLf", 0.11, "lf", ["heaterVent"], `${NPH} p.21, "4" B-vent" P1@.110 → 0.110 mh/LF`),
  P(PL, "heaterVentFt", 10, "ft", ["heaterVentFt"], "FieldQuo assumption: 10 ft of B-vent from a basement heater to the chimney or roof jack (NPH: allow more past 25 ft)", "ASSUMPTION", 1),
  P(PL, "heaterTanklessVent", 2.5, "each", ["heaterTanklessVent"], `${NPH} p.21, "Tankless heater vent kit" P1@2.50 → 2.50 mh/ea`),
  P(PL, "heaterRemoveGas", 2.0, "each", ["heaterRemove"], `Craftsman NPH 2019 p.432, "remove gas water heater, 40 gal" → 2.00 mh/ea`),
];
// Pipe per foot by material and size — NRI 2018 p.334–336 (renovation, the
// only per-foot pipe rows in any preview). Printed plastic is SLOWER than
// copper; that is as the book prints it, not a typo here.
const PIPE_TABLE = Object.freeze({
  copper: { "0.5": 0.104, "0.75": 0.109, 1: 0.122, 2: 0.202 },
  plastic: { "0.5": 0.153, "0.75": 0.162, 1: 0.189, 2: 0.251, 3: 0.281, 4: 0.31 },
  castIron: { 2: 0.236, 4: 0.27 },
  noHub: { 2: 0.21, 4: 0.242 },
  steel: { "0.5": 0.127, "0.75": 0.136 },
});
export const PIPE_MATERIALS = Object.freeze(Object.keys(PIPE_TABLE));
export function pipeSizesFor(material) {
  return Object.hasOwn(PIPE_TABLE, material) ? Object.keys(PIPE_TABLE[material]).map(Number).sort((a, b) => a - b) : [];
}
const PIPE_SIZE_LABEL = { 0.5: "½″", 0.75: "¾″", 1: "1″", 2: "2″", 3: "3″", 4: "4″" };
for (const [mat, sizes] of Object.entries(PIPE_TABLE)) {
  for (const [size, v] of Object.entries(sizes)) {
    PLUMBING.push(P(PL, `pipe_${mat}_${String(size).replace(".", "_")}`, v, "lf", [mat, PIPE_SIZE_LABEL[size]], `Craftsman NRI 2018 p.334–336, ${mat === "noHub" ? "no-hub cast iron" : mat === "castIron" ? "cast iron" : mat} pipe ${PIPE_SIZE_LABEL[size]} → ${v} mh/LF`));
  }
}
// Access (NPH 2025 p.6, Table 1). Applied to pipe hours only.
PLUMBING.push(
  P(PL, "accessAttic", 1.5, "factor", ["attic"], `${NPH} p.6, labour adjustment "attic" ×1.50`),
  P(PL, "accessCrawl", 1.2, "factor", ["crawl"], `${NPH} p.6, labour adjustment "crawl space" ×1.20`),
  P(PL, "height15", 1.1, "factor", ["height", "15 ft"], `${NPH} p.6, work height 15' ×1.10`),
  P(PL, "height20", 1.2, "factor", ["height", "20 ft"], `${NPH} p.6, work height 20' ×1.20`),
  P(PL, "height25", 1.3, "factor", ["height", "25 ft"], `${NPH} p.6, work height 25' ×1.30`),
  P(PL, "height30", 1.4, "factor", ["height", "30 ft"], `${NPH} p.6, work height 30' ×1.40`),
  P(PL, "height40", 1.5, "factor", ["height", "35–40 ft"], `${NPH} p.6, work height 35–40' ×1.50`),
);

// ═══════════════════════════════════════════════════════════════════════════
// FRAMING, DRYWALL, FLOORING — read from their recipes (one copy)
// ═══════════════════════════════════════════════════════════════════════════

const FR = STRUCTURAL_RECIPES.framing;
const fromSpec = (node) => (node && typeof node === "object" ? node.value : node);
const FRAMING = [
  ["labourPartitionHoursPerLf", "lf", ["partition"]],
  ["labourWallFrameHoursPerLf", "lf", ["exteriorWall"]],
  ["labourSheathingHoursPerSqft", "sqft", ["wallSheathing"]],
  ["labourRoofSheathingHoursPerSqft", "sqft", ["roofSheathing"]],
  ["labourSubfloorHoursPerSqft", "sqft", ["subfloor"]],
  ["labourBlockingHoursPerLf", "lf", ["blocking"]],
  ["labourCeilingJoistHoursPerSqft", "sqft", ["ceilingJoists"]],
  ["labourHeaderHoursPerOpening", "each", ["header"]],
].map(([key, unit, parts]) =>
  P("framing", key, fromSpec(FR[key]), unit, parts, `app/data/priceBooks/structural.js FRAMING_RECIPE.${key} — ${FR[key]?.basis || ""}`, FR[key]?.confidence === "read" ? "READ" : "DERIVED"),
);

const DL = getInteriorRecipe("drywall_install")?.labour || {};
const DRY_SRC = (k) => `app/data/priceBooks/interior.js INTERIOR_RECIPES.drywall_install.labour.${k}`;
const DRYWALL = [
  P("drywall", "hangPerSqft", DL.hangPerSqft, "sqft", ["hang"], DRY_SRC("hangPerSqft"), "DERIVED"),
  P("drywall", "hangCeilingMultiplier", DL.hangCeilingMultiplier, "factor", ["ceilingHang"], DRY_SRC("hangCeilingMultiplier"), "DERIVED"),
  P("drywall", "typeXHangAdderPerSqft", DL.typeXHangAdderPerSqft, "sqft", ["typeX"], DRY_SRC("typeXHangAdderPerSqft"), "DERIVED"),
  ...[1, 2, 3, 4, 5].map((lvl) => P("drywall", `finishLevel${lvl}`, DL.finishPerSqftByLevel?.[lvl], "sqft", [`finishL${lvl}`], DRY_SRC(`finishPerSqftByLevel[${lvl}]`), lvl === 4 ? "READ" : "DERIVED")),
  P("drywall", "finishCeilingMultiplier", DL.finishCeilingMultiplier, "factor", ["ceilingFinish"], DRY_SRC("finishCeilingMultiplier"), "DERIVED"),
  P("drywall", "cornerBeadPerLf", DL.cornerBeadPerLf, "lf", ["cornerBead"], DRY_SRC("cornerBeadPerLf"), "DERIVED"),
  P("drywall", "patchEach", DL.patchEach, "each", ["patch"], DRY_SRC("patchEach")),
  P("drywall", "demoPerSqft", DL.demoPerSqft, "sqft", ["demo"], DRY_SRC("demoPerSqft")),
  ...["orangePeel", "spatter", "knockdown", "skipTrowel", "popcorn"].map((k) => P("drywall", `texture_${k}`, DL.texturePerSqft?.[k], "sqft", [k], DRY_SRC(`texturePerSqft.${k}`))),
];

const FL = getInteriorRecipe("flooring_install")?.labour || {};
const FLOOR_SRC = (k) => `app/data/priceBooks/interior.js INTERIOR_RECIPES.flooring_install.labour.${k}`;
const FLOORING = [
  ["lvpPerSqft", "lvp"],
  ["laminatePerSqft", "laminate"],
  ["engineeredNailPerSqft", "engineered"],
  ["solidNailPerSqft", "solid"],
  ["sheetVinylPerSqft", "sheetVinyl"],
  ["vinylTilePerSqft", "vinylTile"],
  ["sandAndFinishPerSqft", "sandFinish"],
  ["tearOutCarpetPerSqft", "tearOutCarpet"],
  ["tearOutResilientPerSqft", "tearOutResilient"],
  ["tearOutTilePerSqft", "tearOutTile"],
  ["tearOutHardwoodNailedPerSqft", "tearOutHardwoodNailed"],
  ["tearOutHardwoodGluedPerSqft", "tearOutHardwoodGlued"],
].map(([key, part]) => P("flooring", key, FL[key], "sqft", [part], FLOOR_SRC(key), "DERIVED"));

// ═══════════════════════════════════════════════════════════════════════════
// THE REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Preset group → the ONE ServiceCategory whose rate card edits it, and whose
 * saved `presets` the read uses. One home per figure on purpose: two cards
 * editing the same number would be two answers to one question.
 */
export const PRESET_HOME = Object.freeze({
  electrical: "electrical",
  plumbing: "plumbing",
  framing: "carpentry",
  drywall: "drywall_install",
  flooring: "flooring_install",
});

const ALL = Object.freeze([...ELECTRICAL, ...PLUMBING, ...FRAMING, ...DRYWALL, ...FLOORING]);
export const LABOUR_PRESETS = Object.freeze(Object.fromEntries(Object.keys(PRESET_HOME).map((g) => [g, Object.freeze(ALL.filter((p) => p.group === g))])));

/** Every preset, flat. */
export function allPresets() {
  return ALL;
}

/** The preset groups a category's rate card edits ([] for most). */
export function presetGroupsFor(categoryKey) {
  return Object.keys(PRESET_HOME).filter((g) => PRESET_HOME[g] === categoryKey);
}

/** The presets a category's rate card shows. */
export function presetsForCategory(categoryKey) {
  return presetGroupsFor(categoryKey).flatMap((g) => LABOUR_PRESETS[g]);
}

/** One preset's definition, or null. */
export function presetDef(group, key) {
  const list = Object.hasOwn(LABOUR_PRESETS, group) ? LABOUR_PRESETS[group] : [];
  return list.find((p) => p.key === key) || null;
}

const own = (o, k) => (o && typeof o === "object" && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);

/**
 * The value a company prices on: its own (CompanyServiceCategory.rates.
 * presets.<key> on the group's home category) when it has stated one, else
 * FieldQuo's preset. Never writes.
 *
 * @param ratesByCategory  { [categoryKey]: rates JSON | null }
 * @returns {{ value: number, own: boolean, def }}
 */
export function presetValue(group, key, ratesByCategory) {
  const def = presetDef(group, key);
  if (!def) return { value: null, own: false, def: null };
  const home = PRESET_HOME[group];
  const saved = own(own(own(ratesByCategory, home), "presets"), key);
  const n = typeof saved === "number" ? saved : saved === undefined || saved === null || saved === "" ? NaN : Number(saved);
  if (Number.isFinite(n) && n >= 0) return { value: n, own: true, def };
  return { value: def.value, own: false, def };
}

/** A reader bound to one company's rates: get(group, key) → presetValue. */
export function presetReader(ratesByCategory = {}) {
  return (group, key) => presetValue(group, key, ratesByCategory);
}

/** The categories whose saved rates a preset reader needs. */
export const PRESET_HOME_CATEGORIES = Object.freeze([...new Set(Object.values(PRESET_HOME))]);

// ═══════════════════════════════════════════════════════════════════════════
// THE RATE CARD — RateCard.js renders these beside (or instead of) a book
// ═══════════════════════════════════════════════════════════════════════════

/** Field descriptors in RateCard's shape: path `presets.<key>`. */
export function presetFieldsFor(categoryKey) {
  return presetsForCategory(categoryKey).map((p) => ({
    path: `presets.${p.key}`,
    preset: p,
    group: `labourPresets.${p.group}`,
    step: p.step,
    internal: true,
  }));
}

/** The defaults as a book fragment ({ presets: { key: value } }) with a
 *  company's overrides laid over, so RateCard's readField() sees one shape. */
export function presetBook(categoryKey, overrides) {
  const out = {};
  for (const p of presetsForCategory(categoryKey)) {
    const saved = own(own(overrides, "presets"), p.key);
    out[p.key] = typeof saved === "number" && Number.isFinite(saved) ? saved : p.value;
  }
  return { presets: out };
}

/**
 * The `presets` part of a company's rate override, cleaned: only declared
 * keys for this category, finite and not negative. Null when nothing is left
 * — "this company has not customised anything". Used by
 * lib/pricing/sanitiseRates.js, the one boundary for CompanyServiceCategory.rates.
 */
export function sanitisePresetOverrides(categoryKey, presets) {
  if (!presets || typeof presets !== "object" || Array.isArray(presets)) return null;
  const out = {};
  for (const p of presetsForCategory(categoryKey)) {
    const v = own(presets, p.key);
    if (v === undefined || v === null || v === "" || typeof v === "boolean") continue;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 10000) continue;
    out[p.key] = n;
  }
  return Object.keys(out).length ? out : null;
}

/** A preset's label in English (the screen translates each part). */
export function presetLabel(p, translate = (key, fallback) => fallback) {
  return (p?.parts || [])
    .map((part) => (Object.hasOwn(LABEL_PARTS, part) ? translate(`app.labourPresets.part.${part}`, LABEL_PARTS[part]) : part))
    .join(" — ");
}

/** A preset's unit suffix in English (translated by the screen). */
export function presetUnit(p, translate = (key, fallback) => fallback) {
  const u = p?.unit;
  return Object.hasOwn(UNIT_LABELS, u) ? translate(`app.labourPresets.unit.${u}`, UNIT_LABELS[u]) : "";
}

// ═══════════════════════════════════════════════════════════════════════════
// LOOKUPS the read uses
// ═══════════════════════════════════════════════════════════════════════════

/** "3/4 in EMT", "1-1/4" PVC" → { type, size } on NEE's table, or nulls. */
export function parseConduit(text) {
  const s = String(text || "").toLowerCase();
  let type = null;
  if (/liquid|\blfmc\b|sealtite/.test(s)) type = "liquidTight";
  else if (/\bent\b|smurf|non-?metallic flex/.test(s)) type = "ent";
  else if (/\bflex|\bfmc\b|greenfield/.test(s)) type = "flex";
  else if (/\bgrs\b|\brigid\b|\brmc\b|\bimc\b/.test(s)) type = "grs";
  else if (/\bpvc\b|sch(edule)?\s*40|sch(edule)?\s*80/.test(s)) type = "pvc";
  else if (/\bemt\b/.test(s)) type = /slab|under ?floor|in ?concrete/.test(s) ? "emtSlab" : /expos|surface/.test(s) ? "emtExposed" : "emtConcealed";
  return { type, size: parseInches(s) };
}

/** The first trade size printed in a string, in inches: '1-1/4"', "3/4 in", "1.25", "½". */
export function parseInches(text) {
  const s = String(text || "").replace(/½/g, "1/2").replace(/¾/g, "3/4").replace(/¼/g, "1/4");
  const m = /(\d+)\s*[- ]\s*(\d)\/(\d)|(\d)\/(\d)|(\d+(?:\.\d+)?)/.exec(s);
  if (!m) return null;
  if (m[1]) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  if (m[4]) return Number(m[4]) / Number(m[5]);
  const n = Number(m[6]);
  return Number.isFinite(n) && n > 0 && n <= 12 ? n : null;
}

/** The nearest size a table prints, at or above the asked size (the larger
 *  conduit is the slower one, so rounding up never under-prices). */
export function nearestSize(sizes, asked) {
  const list = sizes.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (!list.length) return null;
  if (!(asked > 0)) return null;
  return list.find((s) => s >= asked - 1e-9) ?? list[list.length - 1];
}

/** "PEX", "Type L copper", "no-hub CI", "ABS" → the NRI pipe material. */
export function parsePipeMaterial(text) {
  const s = String(text || "").toLowerCase();
  if (/no.?hub/.test(s)) return "noHub";
  if (/cast.?iron|\bci\b/.test(s)) return "castIron";
  if (/copper|\bcu\b|type\s*[klm]\b/.test(s)) return "copper";
  if (/\bpex\b|\bpvc\b|\bcpvc\b|\babs\b|plastic|\bpp\b|\bhdpe\b/.test(s)) return "plastic";
  if (/galv|steel|black iron|threaded/.test(s)) return "steel";
  return null;
}
