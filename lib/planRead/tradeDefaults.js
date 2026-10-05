// lib/planRead/tradeDefaults.js
//
// FieldQuo's own starting figures for a drawing-read item the company has no
// rate for — the pricing ladder's third rung (lib/planRead/tradePricing.js).
// Every figure here is IMPORTED from the module that already holds it, with
// that module's own source and tag; nothing is restated as a new number,
// because a copy is the one that rots (AGENTS.md failure class 4). Where no
// module in the repo states a figure, there is none: the item is "No rate —
// add one", never a plausible guess.
//
// ══ What a suggestion is ═══════════════════════════════════════════════════
//
// Hours (a production default × the quantity) and a material cost per unit —
// the COST of the work. It is never the company's price. The sell side is
// worked out from the company's own target margin by the recommendation
// (lib/planRead/recommendation.js), or, for framing, read from the framing
// price book (app/data/priceBooks/structural.js — the owner, 2026-10-04:
// "switch it on"), and it is shown everywhere as "FieldQuo suggestion — not
// your price yet". It reaches a quote only through a person's button.
//
// ══ The hours are PRESETS the company can change (2026-10-05) ══════════════
//
// The labour figures for electrical, plumbing, framing, drywall and flooring
// come from lib/pricing/labourPresets.js — FieldQuo's defaults calibrated
// against the Craftsman estimating guides, each one editable on the trade's
// rate card in Settings → Services. A figure the company has stated wins
// ("Your Electrical rate card"); one it has not is the preset ("FieldQuo
// default — industry reference (Craftsman estimating guides)"). The owner:
// "this is only for the preset; the company can modify them to adjust to
// their own rates." The full book citation of each figure lives in code
// beside it; the screen names the guides, never a book table.
//
// ══ Commercial electrical (the owner's decision, 2026-10-04) ═══════════════
//
// NECA Manual of Labor Units minutes as PUBLISHED (factor 1.0) for a
// commercial job's devices; a HOUSE prices each device with its wiring run
// (Craftsman NRI's renovation rows) since 2026-10-05 — see labourPresets.js.
//
// Each coefficient: { name, value, unit, source, tag } — tag READ (published,
// or the company's own figure), DERIVED (computed from read figures) or GUESS
// (stated as such where it is).
//
// Pure.

import {
  NECA_ROUGH_IN_MINUTES,
  TRIM_SHARE_OF_ROUGH_IN,
  MATERIAL_COSTS as ELECTRICAL_MATERIAL_COSTS,
} from "@/lib/estimate/rewireTakeoff";
import { getInteriorRecipe, interiorCost } from "@/app/data/priceBooks/interior";
import { STRUCTURAL_PRICE_BOOKS, STRUCTURAL_RECIPES, flattenPriceBook, flattenRecipe } from "@/app/data/priceBooks/structural";
import { HD } from "@/app/data/serviceSeeds/_materialCosts";
import {
  presetReader,
  PRESET_HOME,
  SOURCE_LABEL,
  CONDUIT_SIZES,
  parseConduit,
  parseInches,
  nearestSize,
  parsePipeMaterial,
  pipeSizesFor,
} from "@/lib/pricing/labourPresets";
import { ITEM_ATTRIBUTE_CHOICES } from "./tradeCatalogue";

const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;
const c = (name, value, unit, source, tag) => ({ name, value, unit, source, tag });

/** Complexity → a stated multiplier on HOURS only, applied once per line
 *  (the rule lib/pricing/roofLabour.js keeps).
 *
 *  1.0 / 1.15 / 1.35 / 1.6. Until 2026-10-05 tagged GUESS — the plan's
 *  opening position. The values are unchanged; their provenance is now the
 *  published ranges they sit inside (owner: "use their numbers as reference"):
 *    Craftsman NHI 2019 p.13 — small, occupied job with fitting, matching and
 *      protection: +20–50% (1.20–1.50)
 *    Craftsman NEE 2025 p.6 — conditions: minor ×1.10, very poor ×1.50 and up
 *    Craftsman NRR (2018/2019) — small-volume over large-volume crews:
 *      ×1.18 roofing (1.33 / 1.13) to ×1.54 windows and doors (2.56 / 1.67)
 *  medium 1.15 and high 1.35 are inside every one of those bands; very high
 *  1.6 is NEE's "very poor, 1.50 and up". */
export const COMPLEXITY_HOUR_FACTORS = Object.freeze({ low: 1.0, medium: 1.15, high: 1.35, very_high: 1.6 });

/** What a complexity coefficient cites on the screen. */
export const COMPLEXITY_SOURCE = `Within the published ranges — ${SOURCE_LABEL}: small occupied jobs +20–50%, poor conditions ×1.10–1.50, small-volume crews ×1.18–1.54`;

export function complexityFactor(level) {
  return Object.hasOwn(COMPLEXITY_HOUR_FACTORS, level) ? COMPLEXITY_HOUR_FACTORS[level] : COMPLEXITY_HOUR_FACTORS.medium;
}

/** The drywall / framing books' tier for a trade's complexity level. */
export function tierFor(level) {
  if (level === "very_high") return "high";
  if (level === "high") return "moderate";
  return "standard";
}

// ═══════════════════════════════════════════════════════════════════════════
// PRESETS — one figure, with where it came from
// ═══════════════════════════════════════════════════════════════════════════

const HOME_LABEL = Object.freeze({ electrical: "Electrical", plumbing: "Plumbing", framing: "Carpentry", drywall: "Drywall installation", flooring: "Flooring installation" });

/**
 * A preset's value and its coefficient line. The company's own figure (its
 * rate card) wins; otherwise FieldQuo's preset, said to be one.
 */
function preset(get, group, key, name, unit) {
  const p = get(group, key);
  if (!p.def) return { value: null, coef: null };
  const card = `your ${HOME_LABEL[group] || PRESET_HOME[group]} rate card (Settings → Services)`;
  const coef = p.own
    ? c(name, p.value, unit, `Your figure — ${card}`, "READ")
    : c(name, p.value, unit, `FieldQuo default — ${SOURCE_LABEL}. Change it on ${card}.`, p.def.tag === "ASSUMPTION" ? "GUESS" : p.def.tag);
  return { value: p.value, coef, own: p.own };
}

/** Sum of presets, each with its own line. */
function presetSum(get, group, parts) {
  let total = 0;
  const coefficients = [];
  for (const [key, name, unit, times = 1] of parts) {
    const p = preset(get, group, key, name, unit);
    if (p.value === null) return { total: null, coefficients };
    total += p.value * times;
    coefficients.push(p.coef);
  }
  return { total: round4(total), coefficients };
}

// ═══════════════════════════════════════════════════════════════════════════
// ELECTRICAL
// ═══════════════════════════════════════════════════════════════════════════

const NECA_SRC = "NECA Manual of Labor Units rough-in minutes (lib/estimate/rewireTakeoff.js NECA_ROUGH_IN_MINUTES)";

/** item → { neca (commercial base), premium (commercial add), res (house preset), material } */
const ELECTRICAL_DEVICE = Object.freeze({
  receptacle: { neca: "receptacle", tag: "READ", res: "resReceptacle", material: ["receptacle", "box", "plate"] },
  receptacle_gfci: { neca: "receptacle", tag: "READ", premium: "gfciPremium", res: "resGfci", material: ["gfciReceptacle", "box", "plate"] },
  receptacle_dedicated: { neca: "dedicated", tag: "GUESS", res: "resDedicated", material: ["receptacle", "box", "plate"] },
  switch: { neca: "switch", tag: "READ", res: "resSwitch", material: ["switchDevice", "box", "plate"] },
  switch_3way: { neca: "switch", tag: "READ", premium: "threeWayPremium", res: "resSwitch3Way", material: null },
  dimmer: { neca: "switch", tag: "READ", premium: "dimmerPremium", res: "resDimmer", material: null },
  light_fixture: { neca: "fixture", tag: "READ", res: "resLightFixture", material: ["fixture"] },
  smoke_co: { neca: "smokeCo", tag: "GUESS", res: "resSmokeCo", material: ["smokeCoDetector"] },
});

const DISCONNECT_BY_AMPS = Object.freeze([[30, "disconnect30"], [60, "disconnect60"], [100, "disconnect100"], [Infinity, "disconnect200"]]);

/** Hours per foot of conduit from its printed description. */
function conduitPerFoot(get, text, notes) {
  const parsed = parseConduit(text);
  const type = parsed.type || "emtConcealed";
  if (!parsed.type) notes.push("Conduit type not printed — priced as EMT concealed in walls and ceilings. Confirm it.");
  const sizes = CONDUIT_SIZES.filter((s) => get("electrical", `conduit_${type}_${s.replace(".", "_")}`).def);
  let size = parsed.size ? nearestSize(sizes, parsed.size) : null;
  if (!size) {
    size = nearestSize(sizes, 0.75);
    notes.push("Conduit size not printed — priced at 3/4 in. Confirm it.");
  } else if (Math.abs(size - parsed.size) > 1e-9) {
    notes.push(`Conduit ${parsed.size} in priced at the next size up the table holds (${size} in).`);
  }
  const key = `conduit_${type}_${String(size).replace(".", "_")}`;
  const p = preset(get, "electrical", key, `Conduit (${type}, ${size} in)`, "h per 100 ft");
  return { perFoot: p.value / 100, coef: p.coef };
}

function electricalSuggestion(itemKey, { commercial, currency, attributes, get }) {
  const notes = [];
  const done = (hoursPerUnit, coefficients, materialNote = "No material default for this item.") => ({ hoursPerUnit, materialPerUnit: null, materialNote: [materialNote, ...notes].filter(Boolean).join(" "), coefficients });
  if (itemKey === "panel") {
    const p = preset(get, "electrical", "panelSwap", "Panel swap (remove and replace)", "h each");
    return done(p.value, [p.coef], "No panel material default — FieldQuo's $2,250 figure is an installed price, not a material cost.");
  }
  if (itemKey === "circuit") {
    const p = commercial ? preset(get, "electrical", "comCircuit", "Branch circuit, 30 ft in EMT with wire", "h each") : preset(get, "electrical", "resCircuit", "Circuit: breaker and home run", "h each");
    return done(p.value, [p.coef]);
  }
  if (itemKey === "data_drop") {
    const p = preset(get, "electrical", "resDataDrop", "Data drop: outlet and its wiring", "h each");
    return done(p.value, [p.coef]);
  }
  if (itemKey === "demo_device") {
    const p = preset(get, "electrical", "removeDevice", "Remove a device", "h each");
    return done(p.value, [p.coef]);
  }
  if (itemKey === "fire_alarm_device") {
    const p = preset(get, "electrical", "fireAlarmSmoke", "Fire alarm device (AC smoke detector, wired)", "h each");
    notes.push("Priced as a wired smoke detector; a pull station or heat detector has its own figure on your rate card.");
    return done(p.value, [p.coef]);
  }
  if (itemKey === "disconnect") {
    const amps = Number(attributes?.amps) > 0 ? Number(attributes.amps) : null;
    if (!amps) notes.push("Disconnect rating not printed — priced as 30 A. Confirm it.");
    const key = DISCONNECT_BY_AMPS.find(([max]) => (amps || 30) <= max)[1];
    const p = preset(get, "electrical", key, `Disconnect (${key.replace("disconnect", "")} A)`, "h each");
    return done(p.value, [p.coef]);
  }
  if (itemKey === "conduit") {
    const k = conduitPerFoot(get, attributes?.conduit, notes);
    return done(round4(k.perFoot), [k.coef]);
  }
  if (itemKey === "feeder") {
    // A run printed in conduit (or any commercial run) is conduit plus wire
    // pulled into it; a house run with no conduit is cable.
    if (commercial || parseConduit(attributes?.conduit).type) {
      const k = conduitPerFoot(get, attributes?.conduit, notes);
      const w = preset(get, "electrical", "thhn_12", "Wire pulled, #12 THHN, per conductor", "h per ft");
      notes.push("Three #12 conductors assumed — set the wire on the line if the feeder is larger.");
      return done(round4(k.perFoot + 3 * w.value), [k.coef, w.coef, c("Conductors", 3, "per foot of run", "FieldQuo assumption, stated", "GUESS")]);
    }
    const p = preset(get, "electrical", "romexNewPerLf", "Cable (NM-B 12/2), new work", "h per ft");
    notes.push("Priced as new-work cable; renovation (fishing) cable has its own figure on your rate card.");
    return done(p.value, [p.coef]);
  }
  const dev = ELECTRICAL_DEVICE[itemKey];
  if (!dev) return null;
  let hoursPerUnit;
  let coefficients;
  if (commercial) {
    const minutes = NECA_ROUGH_IN_MINUTES[dev.neca];
    const base = (minutes / 60) * (1 + TRIM_SHARE_OF_ROUGH_IN);
    coefficients = [
      c(`Rough-in, ${dev.neca}`, minutes, "min each", NECA_SRC, dev.tag),
      c("Trim-out", TRIM_SHARE_OF_ROUGH_IN, "× rough-in", "lib/estimate/rewireTakeoff.js TRIM_SHARE_OF_ROUGH_IN (published 30–50%)", "READ"),
      c("Productivity", 1, "× NECA", "Commercial job: NECA units as published (the owner's decision, 2026-10-04)", "READ"),
    ];
    hoursPerUnit = base;
    if (dev.premium) {
      const p = preset(get, "electrical", dev.premium, `${itemKey === "switch_3way" ? "3-way" : itemKey === "dimmer" ? "Dimmer" : "GFCI"} premium over the plain device`, "h each");
      hoursPerUnit += p.value;
      coefficients.push(p.coef);
    }
  } else {
    const p = preset(get, "electrical", dev.res, `${itemKey.replace(/_/g, " ")} with its wiring run and box`, "h each");
    hoursPerUnit = p.value;
    coefficients = [p.coef];
  }
  let materialPerUnit = null;
  let materialNote = null;
  if (dev.material && currency === "USD") {
    materialPerUnit = dev.material.reduce((n, k) => n + ELECTRICAL_MATERIAL_COSTS[k], 0);
    for (const k of dev.material) coefficients.push(c(`Material: ${k}`, ELECTRICAL_MATERIAL_COSTS[k], "USD each", "lib/estimate/rewireTakeoff.js MATERIAL_COSTS (Caudill trade prices; box and plate GUESS)", k === "box" || k === "plate" ? "GUESS" : "READ"));
  } else if (dev.material) {
    materialNote = "FieldQuo's device costs are US trade prices; none is held in your currency — add your own.";
  } else {
    materialNote = "No material default for this item.";
  }
  return { hoursPerUnit: round4(hoursPerUnit), materialPerUnit, materialNote, coefficients };
}

// ═══════════════════════════════════════════════════════════════════════════
// PLUMBING
// ═══════════════════════════════════════════════════════════════════════════

/** The water heater types a person can choose on the item (and the read can
 *  print): the four the owner named — tradeCatalogue.js's closed list. */
export const WATER_HEATER_TYPES = ITEM_ATTRIBUTE_CHOICES.heaterType;

/** fixture item → [house set key, house rough-in key, commercial budget key | null, label] */
const FIXTURES = Object.freeze({
  water_closet: ["wcSet", "wcRough", "comWc", "Toilet"],
  lavatory: ["lavSet", "lavRough", "comLav", "Lavatory"],
  sink: ["sinkSet", "sinkRough", "comSink", "Sink"],
  tub: ["tubSet", "tubRough", "comTub", "Tub"],
  shower: ["showerSet", "showerRough", "comShower", "Shower"],
  urinal: ["urinalSet", "urinalRough", null, "Urinal"],
  mop_sink: ["mopSinkSet", "mopSinkRough", null, "Mop sink"],
  drinking_fountain: ["fountainSet", "fountainRough", null, "Drinking fountain"],
});

/** Water heater hours by type, each part on its own line. */
export function waterHeaterHours(type, get) {
  const g = (key, name, unit, times) => [key, name, unit, times];
  const ventFt = get("plumbing", "heaterVentFt").value;
  const gasTank = [g("heaterGasSet", "Gas tank, set", "h each"), g("heaterConnection", "Connection assembly", "h each"), g("heaterVentPerLf", `B-vent × ${ventFt} ft`, "h per ft", ventFt)];
  const parts = {
    electric: [g("heaterElectricSet", "Electric tank, set", "h each"), g("heaterConnection", "Connection assembly", "h each")],
    gas: gasTank,
    gas_replacement: [...gasTank, g("heaterRemoveGas", "Remove the old gas tank", "h each")],
    tankless: [g("heaterTanklessSet", "Tankless gas heater, set", "h each"), g("heaterConnection", "Connection assembly", "h each"), g("heaterTanklessVent", "Tankless vent kit", "h each")],
  }[type];
  if (!parts) return null;
  const sum = presetSum(get, "plumbing", parts);
  sum.coefficients.push(c("B-vent length", ventFt, "ft", get("plumbing", "heaterVentFt").own ? "Your figure — your Plumbing rate card" : "FieldQuo assumption, stated (editable on your Plumbing rate card)", "GUESS"));
  return sum;
}

const HEIGHT_FACTORS = Object.freeze([[40, "height40"], [30, "height30"], [25, "height25"], [20, "height20"], [15, "height15"]]);

function plumbingSuggestion(itemKey, { commercial, attributes, get }) {
  const notes = [];
  const out = (hoursPerUnit, coefficients, materialNote = "No material default for this item.") => ({ hoursPerUnit, materialPerUnit: null, materialNote: [materialNote, ...notes].filter(Boolean).join(" "), coefficients });
  if (Object.hasOwn(FIXTURES, itemKey)) {
    const [setKey, roughKey, budgetKey, label] = FIXTURES[itemKey];
    if (commercial && budgetKey) {
      const p = preset(get, "plumbing", budgetKey, `${label}, all-in budget (set, rough-in, 35 ft of branch)`, "h each");
      notes.push("The commercial budget includes the fixture's branch piping — pipe measured on the same job is counted twice; leave one out.");
      return out(p.value, [p.coef]);
    }
    const sum = presetSum(get, "plumbing", [[setKey, `${label}, set`, "h each"], [roughKey, `${label}, rough-in`, "h each"]]);
    return out(sum.total, sum.coefficients);
  }
  if (itemKey === "floor_drain") {
    const p = commercial ? preset(get, "plumbing", "comFloorDrain", "Floor drain, all-in budget", "h each") : preset(get, "plumbing", "floorDrainSet", "Floor drain, set", "h each");
    return out(p.value, [p.coef]);
  }
  if (itemKey === "cleanout") {
    const p = commercial ? preset(get, "plumbing", "comCleanout", "Cleanout, all-in budget", "h each") : preset(get, "plumbing", "cleanoutEach", "Cleanout, in-line", "h each");
    return out(p.value, [p.coef]);
  }
  if (itemKey === "gas_outlet") {
    const p = preset(get, "plumbing", "gasOutletEach", "Gas outlet (appliance gas trim)", "h each");
    return out(p.value, [p.coef]);
  }
  if (itemKey === "water_heater") {
    let type = WATER_HEATER_TYPES.includes(attributes?.heaterType) ? attributes.heaterType : null;
    if (!type) {
      notes.push("Water heater type not stated — priced as a new gas tank. Choose the type on the item.");
      type = "gas";
    }
    const sum = waterHeaterHours(type, get);
    return out(sum.total, sum.coefficients, "A water heater is an allowance — FieldQuo holds no unit cost for one.");
  }
  if (itemKey === "supply_pipe" || itemKey === "drain_pipe") {
    const supply = itemKey === "supply_pipe";
    let material = parsePipeMaterial(attributes?.material);
    if (!material) {
      material = supply ? "copper" : "plastic";
      notes.push(`Pipe material not printed — priced as ${supply ? "copper" : "plastic (ABS/PVC)"}. Confirm it.`);
    }
    const sizes = pipeSizesFor(material);
    const asked = parseInches(attributes?.pipeSize);
    let size = asked ? nearestSize(sizes, asked) : null;
    if (!size) {
      size = nearestSize(sizes, supply ? 0.5 : 2);
      notes.push(`Pipe size not printed — priced at ${size} in. Confirm it.`);
    } else if (Math.abs(size - asked) > 1e-9) {
      notes.push(`${asked} in pipe priced at the nearest size the table holds (${size} in).`);
    }
    const base = preset(get, "plumbing", `pipe_${material}_${String(size).replace(".", "_")}`, `${material} pipe, ${size} in`, "h per ft");
    let perFoot = base.value;
    const coefficients = [base.coef];
    if (attributes?.access === "attic" || attributes?.access === "crawl") {
      const a = preset(get, "plumbing", attributes.access === "attic" ? "accessAttic" : "accessCrawl", attributes.access === "attic" ? "Run in an attic" : "Run in a crawl space", "× hours");
      perFoot *= a.value;
      coefficients.push(a.coef);
    }
    const h = Number(attributes?.heightFt);
    const band = h >= 15 ? HEIGHT_FACTORS.find(([min]) => h >= min) : null;
    if (band) {
      const f = preset(get, "plumbing", band[1], `Working height ${h} ft`, "× hours");
      perFoot *= f.value;
      coefficients.push(f.coef);
    }
    if (commercial) notes.push("On a commercial job the fixture budgets already carry 35 ft of branch each — count this pipe or those, not both.");
    return out(round4(perFoot), coefficients);
  }
  return null; // hose bibs and risers: no Craftsman preview prints them
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOORING — the staged flooring_install recipe, through the presets
// ═══════════════════════════════════════════════════════════════════════════

const FLOOR_RECIPE_SRC = "app/data/priceBooks/interior.js INTERIOR_RECIPES.flooring_install (staged; ASSUMPTION per its own comments)";

/** A finish code or name → the recipe's material. Null = not one FieldQuo
 *  holds a production figure for (tile, carpet). */
export function floorMaterialOf(text) {
  const s = String(text || "").toLowerCase();
  if (/sheet vinyl|vinyl sheet|\blinoleum\b|\bsv-?\d|\bsv\b/.test(s)) return "sheet_vinyl";
  if (/\bvct\b|vinyl (composition )?tile|\bvt-?\d|\bvt\b/.test(s)) return "vinyl_tile";
  if (/\blv[pt]\b|luxury vinyl|vinyl plank|\bspc\b/.test(s)) return "lvp";
  if (/laminate/.test(s)) return "laminate";
  if (/engineered/.test(s)) return "engineered";
  if (/hardwood|\boak\b|maple|\bwood\b|solid/.test(s)) return "solid";
  return null;
}

/** "Unfinished", "site-finished", "sand and finish" — a wood floor finished
 *  in place, which adds the sanding and coats to the install. */
export function finishedOnSite(text) {
  return /unfinished|site.?finish|finish(ed)? (on|in) site|sand (and|&) finish/i.test(String(text || ""));
}

/** What a tear-out item removes → its recipe key. */
export function tearOutKeyOf(text) {
  const s = String(text || "").toLowerCase();
  if (/carpet/.test(s)) return "tearOutCarpetPerSqft";
  if (/ceramic|porcelain|\btile\b|stone/.test(s) && !/vinyl|vct|resilient/.test(s)) return "tearOutTilePerSqft";
  if (/glue|glued/.test(s) && /wood|hardwood|oak|maple|engineered/.test(s)) return "tearOutHardwoodGluedPerSqft";
  if (/wood|hardwood|oak|maple|engineered/.test(s)) return "tearOutHardwoodNailedPerSqft";
  if (/vinyl|vct|lino|resilient|lvp|lvt|sheet/.test(s)) return "tearOutResilientPerSqft";
  return null;
}

const FLOOR_MATERIAL = Object.freeze({
  lvp: { labour: "lvpPerSqft", stock: "lvp_click", label: "luxury vinyl plank" },
  laminate: { labour: "laminatePerSqft", stock: "laminate", label: "laminate" },
  engineered: { labour: "engineeredNailPerSqft", stock: "engineered_hardwood", label: "engineered hardwood" },
  solid: { labour: "solidNailPerSqft", stock: "solid_hardwood", label: "solid hardwood" },
  sheet_vinyl: { labour: "sheetVinylPerSqft", stock: null, label: "sheet vinyl" },
  vinyl_tile: { labour: "vinylTilePerSqft", stock: null, label: "vinyl tile" },
});

function flooringSuggestion(itemKey, { currency, attributes, get }) {
  const recipe = getInteriorRecipe("flooring_install");
  const L = recipe?.labour || {};
  const cost = (key) => (key ? interiorCost(recipe?.materials?.[key]?.cost, currency) : null);
  if (itemKey === "floor_area") {
    const kind = floorMaterialOf(attributes?.material);
    if (!kind) return null;
    const m = FLOOR_MATERIAL[kind];
    const unit = cost(m.stock);
    const install = preset(get, "flooring", m.labour, `Install, ${m.label}`, "h per sq ft");
    let hours = install.value;
    const coefficients = [install.coef];
    const onSite = (kind === "solid" || kind === "engineered") && finishedOnSite(attributes?.material);
    if (onSite) {
      const f = preset(get, "flooring", "sandAndFinishPerSqft", "Sand and finish on site", "h per sq ft");
      hours += f.value;
      coefficients.push(f.coef);
    }
    if (unit !== null) coefficients.push(c(`Material, ${kind}`, unit, `${currency} per sq ft`, "app/data/priceBooks/interior.js flooring_install materials — trade-typical band, typical", "READ"));
    return {
      hoursPerUnit: round4(hours),
      materialPerUnit: unit,
      materialNote: unit === null ? (m.stock ? "No material default in your currency." : `No material default for ${m.label} — add your own.`) : null,
      coefficients,
    };
  }
  if (itemKey === "tear_out") {
    const key = tearOutKeyOf(attributes?.material);
    if (!key) return null;
    const p = preset(get, "flooring", key, "Remove the existing floor", "h per sq ft");
    return { hoursPerUnit: p.value, materialPerUnit: null, materialNote: "Disposal is not costed — add a dumpster or tip fee if the job needs one.", coefficients: [p.coef] };
  }
  const simple = {
    base: ["shoeMouldingPerLf", "shoe_moulding", 8, "per 8 ft length"],
    transition: ["transitionEach", "transition_strip", 1, "each"],
    stair_tread: ["stairTreadEach", "stair_tread_retrofit", 1, "each"],
    floor_prep: ["levellingPerSqft", "self_leveller", 20, "per 50 lb bag (20 sq ft at 1/4 in)"],
  }[itemKey];
  if (!simple) return null;
  const [labourKey, stockKey, per, perText] = simple;
  const pack = cost(stockKey);
  const unit = pack === null ? null : pack / per;
  return {
    hoursPerUnit: L[labourKey],
    materialPerUnit: unit,
    materialNote: unit === null ? "No material default in your currency." : null,
    coefficients: [
      c(labourKey, L[labourKey], "h per unit", FLOOR_RECIPE_SRC, "DERIVED"),
      ...(pack !== null ? [c(`Material, ${stockKey}`, pack, `${currency} ${perText}`, "app/data/priceBooks/interior.js flooring_install materials — trade-typical band, typical", "READ")] : []),
    ],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FRAMING — the framing price book (sell) and the presets (hours)
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner (2026-10-04): switch it on. The book is a SELL book with a
// labour-and-material recipe beside it, every figure with its basis and a
// read/derived tag, in USD and CAD reasoned separately (never converted). It
// has no ServiceCategory yet (its proposedCatalogEntry is not merged), so a
// company cannot edit its SELL prices in Settings → Services: here it is the
// framing price a read suggests, labelled as FieldQuo's starting rates. Its
// HOURS are presets a company edits on its carpentry rate card (2026-10-05).

export const FRAMING_BOOK_SRC = "app/data/priceBooks/structural.js FRAMING (published-range midpoints, North American residential, 2025)";

export function framingBook(currency) {
  const cur = String(currency || "").toUpperCase();
  if (cur !== "USD" && cur !== "CAD") return null;
  return {
    book: flattenPriceBook(STRUCTURAL_PRICE_BOOKS.framing, cur),
    recipe: flattenRecipe(STRUCTURAL_RECIPES.framing, cur),
    raw: STRUCTURAL_PRICE_BOOKS.framing,
    rawRecipe: STRUCTURAL_RECIPES.framing,
    currency: cur,
  };
}

/** Is a wall line exterior / bearing (2x6, wallFrame) or a partition (2x4)? */
function framingWallKind(attributes) {
  const size = String(attributes?.studSize || "").toLowerCase();
  if (attributes?.bearing === true || /2\s*x\s*6|2x6|140/.test(size)) return "wallFrame";
  return "partition";
}

/** The sheathing item's surface → its preset. */
const SHEATHING_SURFACE = Object.freeze({
  wall: ["labourSheathingHoursPerSqft", "Wall sheathing"],
  roof: ["labourRoofSheathingHoursPerSqft", "Roof sheathing"],
  floor: ["labourSubfloorHoursPerSqft", "Subfloor"],
});

function framingSuggestion(itemKey, { currency, attributes, level, get }) {
  const fb = framingBook(currency);
  if (!fb) return null;
  if (String(attributes?.material || "").toLowerCase().includes("metal") && itemKey === "wall_framing") {
    return null; // the recipe is wood; a steel-stud wall has no figure here
  }
  const tier = tierFor(level);
  const R = fb.recipe;
  const basisOf = (path) => {
    const node = path.reduce((o, k) => (o ? o[k] : null), fb.raw);
    return node?.basis ? `${FRAMING_BOOK_SRC} — ${node.basis}` : FRAMING_BOOK_SRC;
  };
  const tagOf = (path) => {
    const node = path.reduce((o, k) => (o ? o[k] : null), fb.raw);
    return node?.confidence === "read" ? "READ" : "DERIVED";
  };
  const recipeBasis = (key) => {
    const node = fb.rawRecipe[key];
    return { source: `app/data/priceBooks/structural.js FRAMING_RECIPE.${key}${node?.basis ? ` — ${node.basis}` : ""}`, tag: node?.confidence === "read" ? "READ" : "DERIVED" };
  };
  const waste = 1 + R.wasteLumberPct;
  if (itemKey === "wall_framing") {
    const kind = framingWallKind(attributes);
    const sell = fb.book.complexity[tier][kind];
    const labourKey = kind === "wallFrame" ? "labourWallFrameHoursPerLf" : "labourPartitionHoursPerLf";
    const studKey = kind === "wallFrame" ? "matStud2x6x8" : "matStud2x4x8";
    const hours = preset(get, "framing", labourKey, kind === "wallFrame" ? "Exterior 2x6 wall, framed" : "Interior 2x4 wall, framed", "h per lin ft");
    // Studs at the stated spacing plus three plates (bottom and a doubled
    // top), stated as the assumption it is: 3 lf of plate per lf of wall,
    // cut from 8-ft stock, so 3 ÷ 8 of a stud length per foot.
    const spacing = Number(attributes?.studSpacingIn) > 0 ? Number(attributes.studSpacingIn) : R.specStudSpacingIn;
    const studsPerLf = 12 / spacing;
    const piecesPerLf = studsPerLf + 3 / 8;
    return {
      sellPerUnit: sell,
      hoursPerUnit: hours.value,
      materialPerUnit: round2(piecesPerLf * R[studKey] * waste * 100) / 100,
      coefficients: [
        c(`Framing book, ${kind} (${tier})`, sell, `${fb.currency} per lin ft`, basisOf(["complexity", tier, kind]), tagOf(["complexity", tier, kind])),
        hours.coef,
        c("Studs per lin ft", round2(studsPerLf), `at ${spacing} in o.c.`, recipeBasis("specStudsPerLf").source, "DERIVED"),
        c("Plates", 3, "lin ft per lin ft of wall (assumption: one bottom, doubled top)", "FieldQuo assumption, stated", "GUESS"),
        c(studKey, R[studKey], `${fb.currency} each`, recipeBasis(studKey).source, recipeBasis(studKey).tag),
        c("Lumber waste", R.wasteLumberPct, "share", recipeBasis("wasteLumberPct").source, recipeBasis("wasteLumberPct").tag),
      ],
    };
  }
  if (itemKey === "header") {
    const span = Number(attributes?.spanFt) > 0 ? Number(attributes.spanFt) : null;
    const hours = preset(get, "framing", "labourHeaderHoursPerOpening", "Header, built and set", "h each");
    return {
      sellPerUnit: fb.book.flats.headerEach,
      hoursPerUnit: hours.value,
      materialPerUnit: span ? round2(span * R.matLvlPerLf * waste) : null,
      materialNote: span ? null : "No span printed — the header's LVL is not costed.",
      coefficients: [
        c("Framing book, header", fb.book.flats.headerEach, `${fb.currency} each`, basisOf(["flats", "headerEach"]), tagOf(["flats", "headerEach"])),
        hours.coef,
        ...(span ? [c("matLvlPerLf", R.matLvlPerLf, `${fb.currency} per lin ft × ${span} ft span`, recipeBasis("matLvlPerLf").source, recipeBasis("matLvlPerLf").tag)] : []),
      ],
    };
  }
  if (itemKey === "sheathing") {
    const surface = Object.hasOwn(SHEATHING_SURFACE, attributes?.surface) ? attributes.surface : "wall";
    const [key, name] = SHEATHING_SURFACE[surface];
    const hours = preset(get, "framing", key, name, "h per sq ft");
    const sheet = surface === "floor" ? R.matSubfloorPerSheet : R.matOsbSheathingPerSheet;
    const perSqft = (sheet / R.specSqftPerSheet) * (1 + R.wasteSheathingPct);
    return {
      sellPerUnit: fb.book.complexity[tier].sheathing,
      hoursPerUnit: hours.value,
      materialPerUnit: round2(perSqft * 1000) / 1000,
      materialNote: attributes?.surface ? null : "Sheathing surface not stated — timed as wall sheathing.",
      coefficients: [
        c(`Framing book, sheathing (${tier})`, fb.book.complexity[tier].sheathing, `${fb.currency} per sq ft`, basisOf(["complexity", tier, "sheathing"]), tagOf(["complexity", tier, "sheathing"])),
        hours.coef,
        c(surface === "floor" ? "matSubfloorPerSheet" : "matOsbSheathingPerSheet", sheet, `${fb.currency} per 32 sq ft sheet`, recipeBasis(surface === "floor" ? "matSubfloorPerSheet" : "matOsbSheathingPerSheet").source, recipeBasis("matOsbSheathingPerSheet").tag),
        c("Sheathing waste", R.wasteSheathingPct, "share", recipeBasis("wasteSheathingPct").source, recipeBasis("wasteSheathingPct").tag),
      ],
    };
  }
  if (itemKey === "blocking" || itemKey === "ceiling_joists") {
    const hours = itemKey === "blocking" ? preset(get, "framing", "labourBlockingHoursPerLf", "Blocking", "h per lin ft") : preset(get, "framing", "labourCeilingJoistHoursPerSqft", "Ceiling joists", "h per sq ft");
    return {
      hoursPerUnit: hours.value,
      materialPerUnit: null,
      materialNote: "No material default for this item — the framing book prices walls, headers and sheathing.",
      coefficients: [hours.coef],
    };
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DRYWALL & ROOFING — only what their ENGINE does not cover (rung 1 handles
// board, finish levels, roof squares and the edges; see tradePricing.js)
// ═══════════════════════════════════════════════════════════════════════════

/** The texture types a drywall texture item can carry (Craftsman NHI's five). */
export const TEXTURE_TYPES = ITEM_ATTRIBUTE_CHOICES.textureType;
const TEXTURE_PRESET = Object.freeze({ orange_peel: "texture_orangePeel", spatter: "texture_spatter", knockdown: "texture_knockdown", skip_trowel: "texture_skipTrowel", popcorn: "texture_popcorn" });

/** Drywall's cost side for the engine's lines and the read's other drywall
 *  items: the staged drywall recipe, its hours through the presets. */
export function drywallCostParts({ itemKey, level, layers = 1, currency, boardType = null, textureType = null, get = presetReader({}) }) {
  const recipe = getInteriorRecipe("drywall_install");
  const L = recipe?.labour;
  const M = recipe?.materials || {};
  if (!L) return null;
  const lvl = Math.max(0, Math.min(5, Number(level) || 0));
  if (itemKey === "corner_bead") {
    const stick = interiorCost(M.corner_bead?.cost, currency);
    const h = preset(get, "drywall", "cornerBeadPerLf", "Corner bead, installed (mudding is in the finish)", "h per lin ft");
    return {
      hoursPerUnit: h.value,
      materialPerUnit: stick === null ? null : stick / 8,
      coefficients: [h.coef, ...(stick !== null ? [c("Corner bead", stick, `${currency} per 8 ft`, "interior.js drywall_install materials — trade-typical band", "READ")] : [])],
    };
  }
  if (itemKey === "patch" || itemKey === "demo") {
    const h = itemKey === "patch" ? preset(get, "drywall", "patchEach", "Patch: cut back, back, three coats, sand", "h each") : preset(get, "drywall", "demoPerSqft", "Remove drywall", "h per sq ft");
    return { hoursPerUnit: h.value, materialPerUnit: null, materialNote: itemKey === "patch" ? "No material default for a patch." : "Disposal is not costed — add a dumpster if the job needs one.", coefficients: [h.coef] };
  }
  if (itemKey === "texture") {
    const type = TEXTURE_PRESET[textureType] ? textureType : "knockdown";
    const h = preset(get, "drywall", TEXTURE_PRESET[type], `Texture, ${type.replace("_", " ")}`, "h per sq ft");
    return { hoursPerUnit: h.value, materialPerUnit: null, materialNote: [TEXTURE_PRESET[textureType] ? null : "Texture type not stated — priced as knockdown.", "No material default for texture."].filter(Boolean).join(" "), coefficients: [h.coef] };
  }
  if (itemKey !== "wall_board" && itemKey !== "ceiling_board") return null;
  const ceiling = itemKey === "ceiling_board";
  const hang = preset(get, "drywall", "hangPerSqft", "Hang", "h per sq ft of board");
  const ceilingHang = ceiling ? preset(get, "drywall", "hangCeilingMultiplier", "Ceiling hang", "× hang") : null;
  const typeX = /type.?x|fire/i.test(String(boardType || "")) ? preset(get, "drywall", "typeXHangAdderPerSqft", "5/8 in Type X board", "h per sq ft added") : null;
  const finish = lvl > 0 ? preset(get, "drywall", `finishLevel${lvl}`, `Finish, Level ${lvl}`, "h per sq ft") : null;
  const ceilingFinish = ceiling && finish ? preset(get, "drywall", "finishCeilingMultiplier", "Ceiling finish", "× finish") : null;
  const hangHours = (hang.value * (ceilingHang ? ceilingHang.value : 1) + (typeX ? typeX.value : 0)) * Math.max(1, layers);
  const finishHours = finish ? finish.value * (ceilingFinish ? ceilingFinish.value : 1) : 0;
  const board = interiorCost(M.board_half_4x8?.cost, currency);
  const compound = interiorCost(M.compound_allpurpose?.cost, currency);
  const tape = interiorCost(M.tape_paper?.cost, currency);
  const screws = interiorCost(M.screws?.cost, currency);
  const per = board === null || compound === null || tape === null || screws === null
    ? null
    : (board / 32) * 1.1 * Math.max(1, layers) +
      (lvl > 0 ? (compound / 475) * (lvl === 5 ? 2 : lvl / 4) : 0) +
      (tape / 500) * 0.4 +
      (screws / 1300) * 1.0 * Math.max(1, layers);
  return {
    hoursPerUnit: round4(hangHours + finishHours),
    materialPerUnit: per === null ? null : round2(per * 1000) / 1000,
    coefficients: [
      hang.coef,
      ...(ceilingHang ? [ceilingHang.coef] : []),
      ...(typeX ? [typeX.coef] : []),
      ...(finish ? [finish.coef] : []),
      ...(ceilingFinish ? [ceilingFinish.coef] : []),
      ...(per !== null ? [c("Board, compound, tape, screws", round2(per * 1000) / 1000, `${currency} per sq ft`, "interior.js drywall_install materials and consumption — trade-typical bands, 10% board waste", "READ")] : []),
    ],
  };
}

/** Roofing's material cost per square: architectural shingles, Home Depot. */
export function roofingShingleCostPerSquare(currency) {
  const hd = HD.shingles_bundle;
  if (!hd) return null;
  const cur = String(currency || "").toUpperCase();
  const bundle = cur === "USD" ? hd.cost : cur === "CAD" ? hd.ca?.cost ?? null : null;
  if (!(bundle > 0)) return null;
  return { perSquare: round2(bundle * 3), coefficient: c("Architectural shingles", bundle, `${cur} per bundle × 3 per square`, "app/data/materialReference.js shingles_bundle (Home Depot, 2026-09-24)", "READ") };
}

/**
 * The third rung for one item: { hoursPerUnit, materialPerUnit, sellPerUnit?,
 * materialNote?, coefficients } or null — "No rate — add one".
 *
 * @param presetRates  { [categoryKey]: CompanyServiceCategory.rates } — the
 *                     company's saved rate cards; its `presets` win over
 *                     FieldQuo's (lib/pricing/labourPresets.js). Read only.
 */
export function suggestionFor(tradeKey, itemKey, { commercial = false, currency = "USD", attributes = {}, level = "medium", presetRates = {} } = {}) {
  const cur = String(currency || "USD").toUpperCase();
  const get = presetReader(presetRates);
  switch (tradeKey) {
    case "electrical":
      return electricalSuggestion(itemKey, { commercial, currency: cur, attributes, get });
    case "plumbing":
      return plumbingSuggestion(itemKey, { commercial, attributes, get });
    case "flooring":
      return flooringSuggestion(itemKey, { currency: cur, attributes, get });
    case "framing":
      return framingSuggestion(itemKey, { currency: cur, attributes, level, get });
    case "drywall":
      return drywallCostParts({ itemKey, level: attributes?.finishLevel, layers: attributes?.layers || 1, currency: cur, boardType: attributes?.boardType, textureType: attributes?.textureType, get });
    default:
      return null;
  }
}
