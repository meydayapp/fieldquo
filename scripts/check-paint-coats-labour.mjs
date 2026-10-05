// scripts/check-paint-coats-labour.mjs
//
// Coats change labour time (owner, 2026-10-05): "it takes about the same
// amount of time to paint the 1st, 2nd or 3rd coat; depending on dry time,
// the next coat can start as soon as the last piece is done, or they need to
// wait for it to dry, adding more labour."
//
// Executes lib/pricing/paintTakeoff.js — no database, no network, no key:
//
//   1. a line at its substrate's STANDARD coats is byte-identical to before —
//      md5 of the engine's output on the painting preset fixtures, pinned
//      from origin/main before this change, and every substrate of every
//      estimate type with the rule on vs the rule off (the old path);
//   2. any other coat count scales the coat share of the hours linearly —
//      1 coat is half of 2, 3 coats one and a half times — and prep, the
//      area's extra prep and per-piece prep inside a rate never scale;
//   3. a company's own rate scales on the same basis; a flat rate keeps its
//      price; "Coats change labour time" off restores the old rule;
//   4. the Extra coat option is ONE coat's hours (one formula), and the old
//      share only with the rule off;
//   5. the dry-time wait is labour only when the crew waits on site;
//   6. the drawing read prices coats as the builder does and says why;
//   7. the strings exist in all nine languages, and the screens use them.
//
// Prints the before/after price table for 1- and 3-coat lines.
//
//   node --import ./scripts/alias-loader.mjs scripts/check-paint-coats-labour.mjs

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  paintTakeoff,
  paintFormula,
  paintCoatHours,
  paintDryWait,
  newPaintArea,
  newPaintSubstrate,
  newPaintOption,
  sanitisePaintTakeoffOverrides,
  PAINT_TAKEOFF_DEFAULTS,
  PAINT_SUBSTRATE_DEFAULTS,
  PAINT_ESTIMATE_TYPES,
} from "@/lib/pricing/paintTakeoff";
import { CABINET_LABOUR_DEFAULTS } from "@/lib/pricing/cabinetLabour";
import { getPriceBook } from "@/app/data/tradePriceBooks";
import { presetFixtures } from "./fixtures/paintPresetFixtures.mjs";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

let passed = 0;
let failed = 0;
function ok(name, cond, detail) {
  if (cond) {
    passed += 1;
    return;
  }
  failed += 1;
  console.error(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
}
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const md5 = (v) => createHash("md5").update(JSON.stringify(v)).digest("hex");
const code = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const ON = PAINT_TAKEOFF_DEFAULTS;
const OFF = { ...PAINT_TAKEOFF_DEFAULTS, coatsChangeLabour: false };
const row = (key, patch = {}, type = null) => ({ ...newPaintSubstrate(key, ON, { estimateType: type }), ...patch });
const area = (patch, substrates, type = null) => ({ ...newPaintArea(patch.areaType || "den", ON, { estimateType: type }), ...patch, substrates });
const take = (type, areas) => ({ model: "area_substrate", estimateType: type, areas, notes: "" });
const first = (r) => r.areas[0].lines.find((l) => l.kind === "substrate");

// ═══════════════════════════════════════════════════════════════════════════
console.log("1. a line at its standard coats is byte-identical");
// ═══════════════════════════════════════════════════════════════════════════

// The engine's output on the painting preset fixtures, through origin/main
// (e78e7cea and 45928ecb — the two agree) before coats moved hours.
const BEFORE = {
  room_8ft: "2ac93b35e0ec3a791eb37115fdabb745",
  room_7ft: "90458583e900dc3a0e24657424e3cc40",
  den_9ft: "6b7b29f595d3d2a7f5f3c55becbb7d5d",
  living_9ft: "939d6b6bf32575d1d9645a86fed3e961",
  walls_16ft_situation: "abe116dc877cf123ac70c1abda829282",
  two_storey_18ft: "c525c410d48f8233807ec9ed7d406b88",
  exterior_surface_measured: "2e463b3d8ab72ed9375255f0ae5e2db7",
  baseboard_doors_10ft: "81dc7cbe921b53ad73c943114e14a531",
  walls_16ft_default: "a441bd012dfa6abc9ebee3cd1cf49934",
  ceiling_15ft: "7b469e8fac5b26a18486dd11def0844c",
  row_height_14ft: "08d19e6b22c7222503c50ea6ff884fa5",
  condition_painted_plaster: "7175ec9d35aafc1a84300a939c56d6ab",
  exterior_24ft: "f5453ad7e7046f0ea9ea8a64f8941587",
};
const fx = presetFixtures();
for (const [name, want] of Object.entries(BEFORE)) ok(`md5 unchanged: ${name}`, md5(paintTakeoff(fx[name], ON)) === want, md5(paintTakeoff(fx[name], ON)));

// Every substrate of every estimate type, at its own coats, with prep, a
// height and an extra-coat option: the LINES with the rule on are the lines
// with it off — the old path — to the byte.
const linesOf = (r) => r.areas.map((a) => a.lines);
for (const type of Object.keys(PAINT_ESTIMATE_TYPES)) {
  const surfaces = PAINT_ESTIMATE_TYPES[type].surfaces;
  const keys = Object.keys(PAINT_SUBSTRATE_DEFAULTS).filter((k) => k !== "custom" && surfaces.includes(PAINT_SUBSTRATE_DEFAULTS[k].surface));
  const t = take(type, keys.map((k, i) => area({ label: `A${i}`, lengthFt: 12, widthFt: 14, heightFt: i % 2 ? 8 : 12, prepHours: i % 3 ? 0 : 1.5, options: [newPaintOption("extra_coat", { substrateIndex: 0 })] }, [row(k, { quantity: PAINT_SUBSTRATE_DEFAULTS[k].driver ? null : 7, prepHours: i % 2 ? 0.5 : 0, showFormula: true }, type)], type)));
  const on = paintTakeoff(t, ON);
  const off = paintTakeoff(t, OFF);
  ok(`${type}: every line at its standard coats is the same bytes with the rule on as off`, md5(linesOf(on)) === md5(linesOf(off)));
  ok(`${type}: …and so is every total`, on.total === off.total && on.hours === off.hours);
  ok(`${type}: no line carries coatLabour at its standard coats`, on.areas.every((a) => a.lines.every((l) => !("coatLabour" in l))));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log("2. other coat counts scale the coat hours linearly; prep never scales");
// ═══════════════════════════════════════════════════════════════════════════

const den = (coats, patch = {}) => take("interior", [area({ lengthFt: 10, widthFt: 13, heightFt: 9, ...patch.area }, [row("walls", { coats, ...patch.row }, "interior")], "interior")]);
const w = [1, 2, 3].map((c) => first(paintTakeoff(den(c), ON)));
ok("walls: 414 sqft at 2 coats is 4.14 h (the recovered den)", near(w[1].workHours, 4.14));
ok("walls: 1 coat is half — 2.07 h", near(w[0].workHours, 2.07));
ok("walls: 3 coats is one and a half — 6.21 h", near(w[2].workHours, 6.21));
ok("walls: labour follows at $85", w[0].labour === 175.95 && w[2].labour === 527.85, [w[0].labour, w[2].labour]);
ok("walls: the paint still follows the coats", near(w[0].gallons * 2, w[1].gallons) && near(w[2].gallons, w[0].gallons * 3));
ok("walls: the line says how its coats moved it", w[0].coatLabour && w[0].coatLabour.coats === 1 && w[0].coatLabour.standardCoats === 2 && w[0].coatLabour.share === 1);
const wp = [1, 3].map((c) => first(paintTakeoff(den(c, { row: { prepHours: 2 }, area: { prepHours: 1 } }), ON)));
ok("prep: a line's own prep hours never scale", near(wp[0].hours, 2.07 + 2) && near(wp[1].hours, 6.21 + 2), wp.map((l) => l.hours));
ok("prep: the area's extra prep never scales", near(paintTakeoff(den(1, { area: { prepHours: 1 } }), ON).hours, 2.07 + 1));
const cond = first(paintTakeoff(den(1, { row: { prepCondition: "painted_plaster" } }), ON));
const cond2 = first(paintTakeoff(den(2, { row: { prepCondition: "painted_plaster" } }), ON));
ok("prep: a condition's allowance never scales", cond.prepAuto && near(cond.prepHours, cond2.prepHours) && near(cond.workHours, cond2.workHours / 2));
const tall = first(paintTakeoff(den(1, { area: { heightFt: 16 } }), ON));
const tall2 = first(paintTakeoff(den(2, { area: { heightFt: 16 } }), ON));
ok("height: the factor and the coats compose — 1 coat at 16 ft is half the 2-coat 16 ft hours", tall.height && near(tall.workHours, tall2.workHours / 2));

// Siding is a ONE-coat rate (his exterior job): 2 coats doubles it.
const siding = (coats) => first(paintTakeoff(take("exterior", [area({ areaType: "exterior", surface: "exterior", measurement: "surface", surfaceSqft: 2340 }, [row("siding_trim", { coats }, "exterior")], "exterior")]), ON));
ok("siding: 1 coat is his 23.4 h, untouched", near(siding(1).workHours, 23.4) && !siding(1).coatLabour);
ok("siding: 2 coats is 46.8 h", near(siding(2).workHours, 46.8));

// Per-piece prep INSIDE the cabinet rate (the owner's sand, degrease, tack).
const cab = (key, coats, type = "cabinets") => first(paintTakeoff(take(type, [area({ areaType: "kitchen", surface: type }, [row(key, { quantity: 20, coats }, type)], type)]), ON));
const C = CABINET_LABOUR_DEFAULTS;
const prepMin = C.sandMinutesPerDoor + C.degreaseMinutesNormal + C.tackMinutesPerPiece;
ok("cabinet doors: 1 coat is 20 × (11.5 + 3) min — the prep minutes stay", near(cab("cab_door", 1).workHours, (20 * (prepMin + C.paintMinutesPerPiecePerCoat)) / 60));
ok("cabinet doors: 3 coats is 20 × (11.5 + 9) min", near(cab("cab_door", 3).workHours, (20 * (prepMin + 3 * C.paintMinutesPerPiecePerCoat)) / 60));
ok("cabinet doors: coatShare is the owner's paint minutes over his door", near(PAINT_SUBSTRATE_DEFAULTS.cab_door.coatShare, (2 * C.paintMinutesPerPiecePerCoat) / (prepMin + 2 * C.paintMinutesPerPiecePerCoat)));
ok("drawer fronts: likewise (4 min sanding)", near(cab("cab_drawer", 1).workHours, (20 * (C.sandMinutesPerDrawer + C.degreaseMinutesNormal + C.tackMinutesPerPiece + 3)) / 60));
// A stained door: 1 stain + 2 clear is the standard three; 1 stain + 3 clear is four.
const stainRow = (clear) => row("stain_cab_door", { quantity: 20, products: [{ productKey: "stain_oil", coats: 1 }, { productKey: "clear_water", coats: clear }] }, "staining");
const stained = (clear) => first(paintTakeoff(take("staining", [area({ areaType: "kitchen", surface: "staining" }, [stainRow(clear)], "staining")]), ON));
ok("stained doors: 1 + 2 is the standard — untouched", !stained(2).coatLabour && near(stained(2).workHours, (20 * 20.5) / 60));
ok("stained doors: 1 + 3 adds one 3-minute coat a door", near(stained(3).workHours, (20 * 23.5) / 60) && stained(3).coatLabour.coats === 4 && stained(3).coatLabour.standardCoats === 3);
ok("stair treads: an extra coat adds NPC's coating minutes, not the sanding", near(PAINT_SUBSTRATE_DEFAULTS.stain_tread.coatShare * 0.5, 3.5 / 91.4));
// Wallpaper and custom lines: coats are not labour.
const paper = first(paintTakeoff(take("interior", [area({ lengthFt: 10, widthFt: 13, heightFt: 9 }, [row("wallpaper_install", { coats: 3 }, "interior")], "interior")]), ON));
ok("wallpaper: coats never move its hours", near(paper.workHours, 414 / 35) && !paper.coatLabour);
const custom = first(paintTakeoff(take("interior", [area({}, [{ key: "custom", label: "Mural", coats: 3, quantity: 1, unit: "each", rate: { basis: "production", hoursPerUnit: 6 }, productKey: "wall_interior" }], "interior")]), ON));
ok("custom line: the estimator's hours stand whatever the coats", near(custom.workHours, 6));

// ═══════════════════════════════════════════════════════════════════════════
console.log("3. a company's rate scales on the same basis; flat keeps its price; off restores the old rule");
// ═══════════════════════════════════════════════════════════════════════════

const own = getPriceBook("interior_painting", { takeoff: { rateSets: { interior: { rates: { walls: { label: "My walls", substrate: "walls", basis: "production", productionRate: 80 } } } } } }).takeoff;
const ownLine = (coats) => first(paintTakeoff(den(coats), own));
ok("company rate: 80 sqft/hr at 2 coats is 5.175 h", near(ownLine(2).workHours, 414 / 80));
ok("company rate: 1 coat is half of it", near(ownLine(1).workHours, 414 / 80 / 2));
const inline = first(paintTakeoff(den(1, { row: { rateKey: null, rate: { basis: "production", productionRate: 90, label: "typed" } } }), ON));
ok("inline rate (the drawing read's height bands): scales too", near(inline.workHours, 414 / 90 / 2));
const flat = (coats) => first(paintTakeoff(den(coats, { row: { rateKey: "walls_bad_condition" } }), ON));
ok("flat $/sqft: the price is the stated price at any coats", flat(1).labour === flat(2).labour && flat(3).labour === flat(2).labour);
ok("flat $/sqft: its scheduling hours scale", near(flat(1).hours, flat(2).hours / 2));
const offLines = [1, 2, 3].map((c) => first(paintTakeoff(den(c), OFF)));
ok("rule off: 1, 2 and 3 coats are the same hours (the old rule)", offLines.every((l) => l.workHours === offLines[1].workHours && !l.coatLabour));
ok("rule off: …and the paint still follows the coats", offLines[2].gallons > offLines[0].gallons * 2.9);
const offCompany = getPriceBook("interior_painting", { takeoff: { coatsChangeLabour: false } }).takeoff;
ok("rule off through a company's saved book", first(paintTakeoff(den(1), offCompany)).workHours === first(paintTakeoff(den(2), offCompany)).workHours);
ok("sanitise: false is kept", sanitisePaintTakeoffOverrides({ coatsChangeLabour: false })?.coatsChangeLabour === false);
ok("sanitise: true is kept", sanitisePaintTakeoffOverrides({ coatsChangeLabour: true })?.coatsChangeLabour === true);
ok("sanitise: \"false\" the string is dropped (the default stays on)", sanitisePaintTakeoffOverrides({ coatsChangeLabour: "false" }) === null);
ok("default: on", PAINT_TAKEOFF_DEFAULTS.coatsChangeLabour === true);

// ═══════════════════════════════════════════════════════════════════════════
console.log("4. the Extra coat option is one coat's hours — one formula");
// ═══════════════════════════════════════════════════════════════════════════

const withExtra = (coats, book, patch = {}) => paintTakeoff(den(coats, { area: { options: [newPaintOption("extra_coat", { substrateIndex: 0 })], ...patch } }), book).areas[0].options[0];
const x2on = withExtra(2, ON);
const x2off = withExtra(2, OFF);
ok("2-coat walls: one coat's hours is 50% — the same bytes as the old 50% share", md5(x2on) === md5(x2off) && near(x2on.hours, 2.07), [x2on.hours, x2off.hours]);
ok("1-coat walls: the extra coat is still one coat — 2.07 h", near(withExtra(1, ON).hours, 2.07));
ok("3-coat walls: a fourth coat is one coat — 2.07 h, the line's 6.21 h ÷ 3", near(withExtra(3, ON).hours, 2.07) && near(withExtra(3, ON).hours, first(paintTakeoff(den(3), ON)).workHours / 3));
ok("the old share is read only with the rule off", near(withExtra(2, { ...OFF, extraCoatHoursPct: 30 }).hours, 4.14 * 0.3) && near(withExtra(2, { ...ON, extraCoatHoursPct: 30 }).hours, 2.07));
const sidingExtra = paintTakeoff(take("exterior", [area({ areaType: "exterior", surface: "exterior", measurement: "surface", surfaceSqft: 2340, options: [newPaintOption("extra_coat", { substrateIndex: 0 })] }, [row("siding_trim", {}, "exterior")], "exterior")]), ON).areas[0].options[0];
ok("siding: an extra coat on a one-coat rate is the whole 23.4 h", near(sidingExtra.hours, 23.4));
const cabExtra = paintTakeoff(take("cabinets", [area({ areaType: "kitchen", surface: "cabinets", options: [newPaintOption("extra_coat", { substrateIndex: 0 })] }, [row("cab_door", { quantity: 20 }, "cabinets")], "cabinets")]), ON).areas[0].options[0];
ok("cabinet doors: an extra coat is 3 min a door, not 50% of the sanding", near(cabExtra.hours, 1));
const paperExtra = paintTakeoff(take("interior", [area({ lengthFt: 10, widthFt: 13, heightFt: 9, options: [newPaintOption("extra_coat", { substrateIndex: 0 })] }, [row("wallpaper_install", {}, "interior")], "interior")]), ON).areas[0].options[0];
ok("wallpaper: no coat hours to charge (and the builder does not offer it)", paperExtra.hours === 0 && /coatLines = includedLines\.filter/.test(code("app/components/quotes/builder/PaintAreas.js")));
ok("one formula: no other extra-coat share in the engine", (code("lib/pricing/paintTakeoff.js").match(/extraCoatPct \/ 100/g) || []).length === 1);

// ═══════════════════════════════════════════════════════════════════════════
console.log("5. the dry-time wait — labour only when the crew waits on site");
// ═══════════════════════════════════════════════════════════════════════════

const kitchen = (patch = {}, coats = 2) => take("cabinets", [area({ areaType: "kitchen", surface: "cabinets", ...patch }, [row("cab_door", { quantity: 20, coats }, "cabinets"), row("cab_drawer", { quantity: 8, coats }, "cabinets")], "cabinets")]);
const k0 = paintTakeoff(kitchen(), ON);
const kWait = paintTakeoff(kitchen({ crewWaitsOnSite: true }), ON);
ok("not ticked: no wait line and no new key — the area is the object it was", md5(k0) === md5(paintTakeoff(kitchen({ crewWaitsOnSite: false }), ON)) && !k0.areas[0].lines.some((l) => l.dryWait) && !("waitHours" in k0.areas[0]));
ok("ticked: one gap at 2 coats × the cabinet preset 1 h (the owner's dryHoursPerCoat) — doors and drawers dry side by side", kWait.areas[0].waitHours === 1 && near(kWait.hours - k0.hours, 1) && PAINT_SUBSTRATE_DEFAULTS.cab_door.dryWaitHours === C.dryHoursPerCoat);
ok("ticked: billed at the area's hourly rate", near(kWait.total - k0.total, 85));
const waitLine = kWait.areas[0].lines.find((l) => l.dryWait);
ok("ticked: its own line, said as waiting, not prep", waitLine && waitLine.kind === "prep" && /waiting for coats to dry/.test(waitLine.label) && waitLine.waitGaps === 1);
ok("3 coats: two gaps", paintTakeoff(kitchen({ crewWaitsOnSite: true }, 3), ON).areas[0].waitHours === 2);
ok("1 coat: nothing to wait between", paintTakeoff(kitchen({ crewWaitsOnSite: true }, 1), ON).areas[0].waitHours === undefined);
ok("a typed dry time wins over the preset", paintTakeoff(kitchen({ crewWaitsOnSite: true, dryWaitHours: 2.5 }), ON).areas[0].waitHours === 2.5);
ok("a typed 0 says no wait", paintTakeoff(kitchen({ crewWaitsOnSite: true, dryWaitHours: 0 }), ON).areas[0].waitHours === undefined);
ok("hostile dry time: Infinity and negatives come to nothing", [Infinity, -4, "abc"].every((v) => paintTakeoff(kitchen({ crewWaitsOnSite: true, dryWaitHours: v }), ON).total === k0.total || paintTakeoff(kitchen({ crewWaitsOnSite: true, dryWaitHours: v }), ON).areas[0].waitHours <= 72));
ok("walls: no preset — ticking with no dry time adds nothing", paintTakeoff(den(2, { area: { crewWaitsOnSite: true } }), ON).total === paintTakeoff(den(2), ON).total);
ok("walls: a typed dry time is waited once per gap", paintTakeoff(den(3, { area: { crewWaitsOnSite: true, dryWaitHours: 1 } }), ON).areas[0].waitHours === 2);
const stainWait = paintTakeoff(take("staining", [area({ areaType: "kitchen", surface: "staining", crewWaitsOnSite: true }, [stainRow(2)], "staining")]), ON);
ok("stained doors: stain + two clear is two gaps", stainWait.areas[0].waitHours === 2);
const kExtra = paintTakeoff(kitchen({ crewWaitsOnSite: true, options: [newPaintOption("extra_coat", { substrateIndex: 0 })] }), ON).areas[0].options[0];
ok("an extra coat with the crew waiting is one more coat and one more wait", near(kExtra.hours, 1 + 1));
ok("the builder's reading is the engine's", paintDryWait(kitchen({ crewWaitsOnSite: true }).areas[0], kWait.areas[0].lines, ON).hours === 1);
ok("the work order says waiting, not prep", /l\.dryWait \? `waiting for coats to dry/.test(code("lib/workOrder/build.js")));
ok("the wait is optional-area aware: an optional kitchen's offer includes it", (() => {
  const r = paintTakeoff(take("cabinets", [area({ areaType: "kitchen", surface: "cabinets", optional: true, crewWaitsOnSite: true }, [row("cab_door", { quantity: 20 }, "cabinets")], "cabinets")]), ON);
  return r.total === 0 && r.optionalAreas[0].lines.some((l) => l.dryWait);
})());

// ═══════════════════════════════════════════════════════════════════════════
console.log("6. the formula, the why line, the drawing read");
// ═══════════════════════════════════════════════════════════════════════════

ok("formula: a 2-coat line reads as it always did", paintFormula({ ...w[1], showFormula: true }) === "414 sqft ÷ 100 sqft/hr = 4.1 h × $85.00/hr = $351.90");
ok("formula: a 1-coat line says its coats", paintFormula({ ...w[0], showFormula: true }) === "414 sqft ÷ 100 sqft/hr × 1/2 coats = 2.1 h × $85.00/hr = $175.95");
const why1 = paintCoatHours(w[0], ON);
ok("why: 1 coat × 2.07 h a coat, rate for 2", why1.applies && why1.coats === 1 && near(why1.perCoatHours, 2.07) && why1.standardCoats === 2 && why1.fixedHours === 0);
const why2 = paintCoatHours(w[1], ON);
ok("why: 2 coats × 2.07 h a coat = 4.14 h", why2.coats === 2 && near(why2.perCoatHours, 2.07) && near(why2.workHours, 4.14));
const whyCab = paintCoatHours(cab("cab_door", 2), ON);
ok("why: cabinet doors split coats from per-piece prep", near(whyCab.perCoatHours, 1) && near(whyCab.fixedHours, (20 * prepMin) / 60));
ok("why: rule off — not applied", paintCoatHours(offLines[0], OFF).applies === false);
ok("why: the builder and the read print one sentence from one helper", /coatHoursText\(paintCoatHours\(priced, book\), t\)/.test(code("app/components/quotes/builder/PaintAreas.js")) && /coatHoursText\(l\.coatHours, t\)/.test(code("app/components/planRead/PlanReadWorkspace.js")));
ok("read: each draft line carries coatHours from the same book", /coatHours: paintCoatHours\(l, b\.book\)/.test(code("lib/planRead/pricing.js")));
ok("read: the chat is told the new rule", /Coats change the hours and the paint/.test(code("lib/planRead/prompts.js")) && !/Coats change the paint, not the hours/.test(code("lib/planRead/prompts.js")));

// ═══════════════════════════════════════════════════════════════════════════
console.log("7. the screens and the strings");
// ═══════════════════════════════════════════════════════════════════════════

const settings = code("app/app/settings/services/PaintRateSets.js");
ok("settings: the toggle writes takeoff.coatsChangeLabour (false, or back to the default)", /setPath\("takeoff\.coatsChangeLabour", e\.target\.checked \? undefined : false\)/.test(settings));
ok("settings: the extra-coat share shows only with the rule off", /coatsChangeLabour \? \(\s*<p[^>]*data-extra-coat-linear/.test(settings));
const builder = code("app/components/quotes/builder/PaintAreas.js");
ok("builder: the area has the dry time and the crew-waits tick", /crewWaitsOnSite: e\.target\.checked/.test(builder) && /dryWaitHours: e\.target\.value === "" \? null/.test(builder));
ok("builder: the Coats box steers a products row (deck, fence, stain) — it was dead there", /firstProduct \? \{ coats, products: row\.products\.map/.test(builder));
const KEYS = ["app.paint.coatsLabour", "app.paint.coatsLabourHint", "app.paint.extraCoatLinear", "app.paint.coatsWhy", "app.paint.coatsWhyPrep", "app.paint.dryWait", "app.paint.crewWaits", "app.paint.dryWaitCharged", "app.paint.dryWaitNotCharged", "app.paint.dryWaitShort", "app.planRead.draft.coatsNote", "app.planRead.draft.coatsNoteOff"];
const LANGS = Object.keys(APP_MESSAGES);
ok("nine catalogues", LANGS.length === 9, LANGS);
for (const key of KEYS) {
  for (const lang of LANGS) ok(`${lang} has ${key}`, typeof APP_MESSAGES[lang][key] === "string" && APP_MESSAGES[lang][key].trim().length > 0);
  const en = APP_MESSAGES.en[key];
  const vars = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
  for (const lang of LANGS) ok(`${lang} ${key} keeps the placeholders`, vars(APP_MESSAGES[lang][key]) === vars(en));
}
for (const key of KEYS.filter((k) => k !== "app.planRead.draft.coatsNoteOff")) ok(`${key} is used`, [builder, settings, code("app/components/planRead/PlanReadWorkspace.js"), code("app/components/quotes/builder/coatHoursText.js")].some((s) => s.includes(`"${key}"`)));
ok("help article (en/fr/es) explains the rule", ["en", "fr", "es"].every((l) => /coatsChangeLabour|Coats change labour time|Les couches changent le temps|Las capas cambian el tiempo/.test(code(`content/help/${l}/leads-and-quotes-1.js`))));
ok("wired into check:all", /npm run check:paint-coats-labour/.test(code("package.json")));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\nPrice impact — rule off (before) → on (after), default rates");
// ═══════════════════════════════════════════════════════════════════════════

const money = (n) => `$${n.toFixed(2)}`;
const rows = [
  ["Den walls 414 sqft, 1 coat", den(1)],
  ["Den walls 414 sqft, 2 coats", den(2)],
  ["Den walls 414 sqft, 3 coats", den(3)],
  ["Den ceiling 130 sqft, 1 coat", take("interior", [area({ lengthFt: 10, widthFt: 13, heightFt: 9 }, [row("ceiling", { coats: 1 }, "interior")], "interior")])],
  ["Siding 2,340 sqft, 1 coat (his rate)", take("exterior", [area({ areaType: "exterior", surface: "exterior", measurement: "surface", surfaceSqft: 2340 }, [row("siding_trim", { coats: 1 }, "exterior")], "exterior")])],
  ["Siding 2,340 sqft, 2 coats", take("exterior", [area({ areaType: "exterior", surface: "exterior", measurement: "surface", surfaceSqft: 2340 }, [row("siding_trim", { coats: 2 }, "exterior")], "exterior")])],
  ["20 cabinet doors, 1 coat", take("cabinets", [area({ areaType: "kitchen", surface: "cabinets" }, [row("cab_door", { quantity: 20, coats: 1 }, "cabinets")], "cabinets")])],
  ["20 cabinet doors, 3 coats", take("cabinets", [area({ areaType: "kitchen", surface: "cabinets" }, [row("cab_door", { quantity: 20, coats: 3 }, "cabinets")], "cabinets")])],
  ["10 interior doors (sides), 1 coat", take("interior", [area({}, [row("door", { quantity: 10, coats: 1 }, "interior")], "interior")])],
  ["10 interior doors (sides), 3 coats", take("interior", [area({}, [row("door", { quantity: 10, coats: 3 }, "interior")], "interior")])],
  ["Deck 400 sqft, 1 coat", take("staining", [area({ areaType: "deck", surface: "staining" }, [row("stain_deck", { quantity: 400, coats: 1, products: [{ productKey: "stain_exterior", coats: 1 }] }, "staining")], "staining")])],
  ["Deck 400 sqft, 3 coats", take("staining", [area({ areaType: "deck", surface: "staining" }, [row("stain_deck", { quantity: 400, coats: 3, products: [{ productKey: "stain_exterior", coats: 3 }] }, "staining")], "staining")])],
  ["20 stained doors, stain + 3 clear", take("staining", [area({ areaType: "kitchen", surface: "staining" }, [stainRow(3)], "staining")])],
];
console.log("  | line | hours before → after | total before → after |");
for (const [label, t] of rows) {
  const b = paintTakeoff(t, OFF);
  const a = paintTakeoff(t, ON);
  console.log(`  | ${label} | ${b.hours.toFixed(2)} → ${a.hours.toFixed(2)} | ${money(b.total)} → ${money(a.total)} |`);
}

console.log(`\ncheck-paint-coats-labour: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
