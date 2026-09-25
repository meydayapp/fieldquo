// scripts/check-reuse-takeoffs.mjs
//
//   npm run check:reuse-takeoffs
//
// Flooring, tile, drywall, siding, fencing and concrete measured with the
// calculators that already exist (lib/measure/reuseTakeoffs.js), and those
// figures flowing into a service's template lines (lib/quotes/
// serviceTemplateLines.js) — executed against hostile input, not read.
//
//   A. Rooms: paint's geometry per room, only the ticked surfaces, the
//      openings off the walls (never below zero), the trade's generic area,
//      a stated waste per material; zero, junk and absurd inputs.
//   B. Drywall sheets: 4 × 8 and 4 × 12, the stated sheet waste inside the
//      count, whole sheets; siding walls with a gable, less openings.
//   C. Fence and concrete: posts every 8 ft plus the closing post; cubic
//      yards at the chosen thickness, waste inside, up to the quarter yard;
//      no thickness → no yards (never an assumed 4 in).
//   D. Into the template lines: groupMeasurements / measurementsFromGroups
//      read every figure by its registered name; a seeded flooring template
//      and a seeded fence template fill; a stated waste REPLACES the line's
//      template waste on material lines only; sheets and yards add none;
//      refill uses the stated waste; figures that state none leave every
//      other trade's lines byte-identical.
//   E. The double-billing guard: none of these takeoffs prices, so nothing
//      is held back on them — and a siding group whose walls were measured
//      still holds back wallSqft, because its takeoff prices that box.
//   F. The tracer's intake patch: with no options it IS lotIntakePatch; a
//      fence writes Linear Feet less the unfenced sides; concrete Square
//      Footage; a form with neither box gets nothing.
//   G. Registry: every key TRADE_MEASUREMENTS lists for these trades is a
//      name this module (or the trade's intake) really produces.
//   H. The panels render — blank, filled, sparse, junk — the room panel is
//      mounted in the quote builder for the three room trades and the
//      tracer for fence and concrete, and the painting card's HTML is the
//      md5 it was before its geometry controls were shared.
//   I. Every string the panels ask for exists in all nine app languages.
//
// Bundled through esbuild (the panels are JSX), like check-doc-builder.

import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ROOM_MEASURE_TRADES,
  TRACE_MEASURE_TRADES,
  REUSE_TAKEOFF_TRADES,
  newRoomMeasure,
  newMeasureRoom,
  newSidingWall,
  newOpening,
  roomFigures,
  roomMeasureFigures,
  roomMeasureMeasurements,
  sidingWallsFigures,
  drywallSheets,
  fencePosts,
  fenceMeasurements,
  concreteCuYd,
  concreteMeasurements,
  statedWaste,
  openingsSqft,
} from "../lib/measure/reuseTakeoffs.js";
import {
  groupMeasurements,
  measurementsFromGroups,
  expandServiceTemplate,
  refillTemplateRun,
  keysPricedByGroup,
  calculatorFor,
  calculatorOfTrade,
} from "../lib/quotes/serviceTemplateLines.js";
import { lotIntakePatch, traceIntakePatch } from "../lib/measure/lotTakeoff.js";
import { isMeasurementKey, TRADE_MEASUREMENTS } from "../lib/services/measurementKeys.js";
import { hasTakeoff } from "../lib/pricing/takeoffTrades.js";
import { newScopeGroup, scopeGroupPayload, groupSubtotal } from "../lib/quotes/builderPayload.js";
import { createTradeConfig } from "../lib/pricing/tradeScope.js";
import { getPriceBook } from "../app/data/tradePriceBooks.js";
import { SERVICE_SEEDS } from "../app/data/serviceSeeds/index.js";
import { seedTemplateFor } from "../lib/services/seeds.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { fieldsForCategory } from "../app/data/quoteIntakeFields.js";
import { RoomMeasure, SidingWalls, TraceMeasure } from "../app/components/quotes/builder/ReuseTakeoff.js";
import TradeTakeoff from "../app/components/quotes/builder/TradeTakeoff.js";
import { QuoteBuilderForm, initialStateFromQuote } from "../app/components/quotes/builder/QuoteBuilder.js";
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import { PermissionProvider } from "../app/providers/PermissionProvider.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) => {
  if (cond) pass += 1;
  else fails.push(`${label}${detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
};
const section = (t) => console.log(t);
const md5 = (x) => createHash("md5").update(typeof x === "string" ? x : JSON.stringify(x)).digest("hex");

const room = (patch) => ({ ...newMeasureRoom("flooring_install"), ...patch });
const takeoff = (trade, rooms, extra = {}) => ({ ...newRoomMeasure(trade), rooms, ...extra });

section("A — rooms");
{
  // 12 × 15 × 8: floor 180, perimeter 54, walls 432 gross.
  const kitchen = room({ label: "Kitchen", lengthFt: 15, widthFt: 12, heightFt: 8 });
  const f = roomMeasureFigures(takeoff("flooring_install", [kitchen]), "flooring_install");
  ok("flooring: floor 180, perimeter 54, walls not ticked → 0", f.floorSqft === 180 && f.linearFt === 54 && f.wallSqft === 0 && f.ceilingSqft === 0, f);
  ok("flooring: the generic area is the floor", f.areaSqFt === 180, f.areaSqFt);
  const m = roomMeasureMeasurements(takeoff("flooring_install", [kitchen]), "flooring_install");
  ok("flooring exports floorSqft, linearFt, areaSqFt — and no zero wall figure", Object.keys(m).sort().join() === "areaSqFt,floorSqft,linearFt" && !("wastePct" in m.floorSqft), m);

  // A backsplash on the same flooring job: single wall 10 ft × 1.5 ft,
  // walls ticked, floor not — the generic area stays the floor.
  const splash = room({ label: "Backsplash", measurement: "wall", linearFt: 10, heightFt: 1.5, surfaces: { walls: true, floor: false, perimeter: false } });
  const f2 = roomMeasureFigures(takeoff("flooring_install", [kitchen, splash]), "flooring_install");
  ok("flooring + backsplash: wall 15, floor still 180, generic area still the floor", f2.wallSqft === 15 && f2.floorSqft === 180 && f2.areaSqFt === 180, f2);
  ok("a single wall has no floor even if ticked", roomFigures({ measurement: "wall", linearFt: 10, heightFt: 8 }, { surfaces: { floor: true, walls: true } }).floorSqft === 0);

  // Tile: floor 5 × 8 = 40; backsplash 10 × 1.5 = 15 → tiled area 55.
  const bath = { ...newMeasureRoom("tiling"), lengthFt: 8, widthFt: 5, heightFt: 8 };
  const tsplash = { ...newMeasureRoom("tiling"), measurement: "wall", linearFt: 10, heightFt: 1.5, surfaces: { walls: true } };
  const tile = takeoff("tiling", [bath, tsplash], { waste: { floorSqft: 10, wallSqft: 15, linearFt: null } });
  const tf = roomMeasureFigures(tile, "tiling");
  ok("tile: floor 40 + wall 15 = tiled area 55", tf.floorSqft === 40 && tf.wallSqft === 15 && tf.areaSqFt === 55, tf);
  const tm = roomMeasureMeasurements(tile, "tiling");
  ok("tile: floor waste 10, wall waste 15 carried per material", tm.floorSqft.wastePct === 10 && tm.wallSqft.wastePct === 15, tm);
  ok("tile: the tiled area's waste is the area-weighted blend — exact: 55 × (1 + w) = 40 × 1.10 + 15 × 1.15", Math.abs(55 * (1 + tm.areaSqFt.wastePct / 100) - (44 + 17.25)) < 0.001, tm.areaSqFt);
  const half = roomMeasureMeasurements({ ...tile, waste: { floorSqft: 10, wallSqft: null } }, "tiling");
  ok("tile: half a statement is not one — the blended area states no waste", !("wastePct" in half.areaSqFt) && half.floorSqft.wastePct === 10 && !("wastePct" in half.wallSqft), half);

  // Openings come off the walls, never below zero, only where walls are ticked.
  const withDoors = { ...newMeasureRoom("drywall_install"), lengthFt: 12, widthFt: 10, heightFt: 8, openings: [newOpening("door"), newOpening("window")] };
  const rf = roomFigures(withDoors);
  ok("openings: 352 gross − 21 (3 × 7 door) − 15 (3 × 5 window) = 316", rf.grossWallSqft === 352 && rf.openingsSqft === 36 && rf.wallSqft === 316, rf);
  const huge = roomFigures({ ...withDoors, openings: [{ kind: "other", count: 40, widthFt: 20, heightFt: 20 }] });
  ok("openings bigger than the walls → walls 0, never negative", huge.wallSqft === 0 && huge.openingsSqft === huge.grossWallSqft, huge);
  ok("openings ignored where walls are not ticked", roomFigures({ ...withDoors, surfaces: { ceiling: true } }).openingsSqft === 0);
  ok("openings: junk rows, fractional and negative counts", openingsSqft({ openings: [null, "x", { count: 2.7, widthFt: 3, heightFt: 7 }, { count: -3, widthFt: 3, heightFt: 7 }, { count: 1, widthFt: "abc", heightFt: 7 }] }) === 42);

  // Zero, junk, huge.
  ok("a room of zeroes measures nothing", Object.keys(roomMeasureMeasurements(takeoff("flooring_install", [newMeasureRoom("flooring_install")]), "flooring_install")).length === 0);
  ok("junk rooms and a non-room takeoff → nothing", Object.keys(roomMeasureMeasurements({ model: "room_measure", rooms: [null, 7, "x", { lengthFt: -10, widthFt: "abc", heightFt: Infinity }] }, "tiling")).length === 0 && roomMeasureFigures({ model: "area_substrate", areas: [] }, "tiling") === null && roomMeasureFigures(null, "tiling") === null && roomMeasureFigures(takeoff("tiling", []), "flooring") === null);
  const big = roomMeasureFigures(takeoff("flooring_install", [room({ lengthFt: 1e308, widthFt: 1e308, heightFt: 1e308 })]), "flooring_install");
  ok("absurd dimensions are capped (a mile a side), never Infinity", Number.isFinite(big.floorSqft) && big.floorSqft === 5280 * 5280, big.floorSqft);
  ok("a stored tick for a surface the trade does not offer is ignored", roomMeasureFigures(takeoff("flooring_install", [room({ lengthFt: 10, widthFt: 10, heightFt: 8, surfaces: { floor: true, ceiling: true } })]), "flooring_install").ceilingSqft === 0);
  ok("strip overrides are honoured (paint's own rule)", roomMeasureFigures(takeoff("flooring_install", [room({ lengthFt: 10, widthFt: 10, heightFt: 8, floorSqftOverride: 95 })]), "flooring_install").floorSqft === 95);
  ok("statedWaste: blank/null/junk → null (the template's); 0 is a statement; clamped to 50", statedWaste("") === null && statedWaste(null) === null && statedWaste("abc") === null && statedWaste(-5) === null && statedWaste(true) === null && statedWaste(0) === 0 && statedWaste(80) === 50 && statedWaste("12.34") === 12.3);
}

section("B — drywall sheets; siding walls");
{
  const dw = { ...newMeasureRoom("drywall_install"), lengthFt: 12, widthFt: 10, heightFt: 8, openings: [newOpening("door"), newOpening("window")] };
  const t32 = roomMeasureFigures(takeoff("drywall_install", [dw]), "drywall_install");
  ok("drywall: board = walls 316 + ceiling 120 = 436", t32.sheets.boardSqft === 436 && t32.areaSqFt === 436, t32.sheets);
  ok("drywall: new takeoff states 10% sheet waste, 4 × 8 → ceil(436 × 1.10 ÷ 32) = 15 sheets", t32.sheets.count === 15 && t32.sheets.sheetSqft === 32 && t32.sheets.wastePct === 10, t32.sheets);
  const t48 = roomMeasureFigures(takeoff("drywall_install", [dw], { sheetSqft: 48 }), "drywall_install");
  ok("drywall: 4 × 12 → ceil(479.6 ÷ 48) = 10 sheets", t48.sheets.count === 10 && t48.sheets.label === "4 × 12", t48.sheets);
  ok("drywall: an unknown sheet size falls back to 4 × 8", roomMeasureFigures(takeoff("drywall_install", [dw], { sheetSqft: 7 }), "drywall_install").sheets.sheetSqft === 32);
  ok("drywall: whole sheets — exactly 32 sq ft is 1 sheet, 32.01 is 2", drywallSheets(32, 32, 0) === 1 && drywallSheets(32.01, 32, 0) === 2 && drywallSheets(0, 32, 10) === 0 && drywallSheets(-5, 32, 10) === 0);
  const dm = roomMeasureMeasurements(takeoff("drywall_install", [dw]), "drywall_install");
  ok("drywall exports walls, ceiling, board area and sheets — sheets with waste 0 (inside the count)", dm.wallSqft.value === 316 && dm.ceilingSqft.value === 120 && dm.areaSqFt.value === 436 && dm.drywallSheets.value === 15 && dm.drywallSheets.wastePct === 0 && !("wastePct" in dm.wallSqft), dm);
  const noWaste = roomMeasureMeasurements(takeoff("drywall_install", [dw], { sheetWastePct: null }), "drywall_install");
  ok("drywall with no stated sheet waste: net sheets, and the template's waste applies", noWaste.drywallSheets.value === 14 && !("wastePct" in noWaste.drywallSheets), noWaste.drywallSheets);

  // Siding: 40 ft run × 10 ft with an 8 ft gable = 400 + 160; two 3 × 5 windows off.
  const front = { ...newSidingWall("Front"), linearFt: 40, heightFt: 10, gableRiseFt: 8, openings: [{ kind: "window", count: 2, widthFt: 3, heightFt: 5 }] };
  const side = { ...newSidingWall("Side"), linearFt: 30, heightFt: 10, openings: [newOpening("door")] };
  const sw = sidingWallsFigures([front, side]);
  ok("siding: 560 + 300 gross, gable 160, openings 51 → 809 net", sw.grossSqft === 860 && sw.gableSqft === 160 && sw.openingsSqft === 51 && sw.netSqft === 809, sw);
  ok("siding: no walls → null (the typed box is left alone)", sidingWallsFigures([]) === null && sidingWallsFigures(null) === null);
  ok("siding: a gable only on a single-wall run, never on a 4-wall room", sidingWallsFigures([{ ...front, measurement: "area", lengthFt: 40, widthFt: 30 }]).gableSqft === 0);
}

section("C — fence posts, concrete yards");
{
  ok("posts: 160 ft → 21 (20 bays + the closing post)", fencePosts(160) === 21);
  ok("posts: 8 ft → 2, 8.01 ft → 3, 7.9 ft → 2, 0 → 0, junk → 0", fencePosts(8) === 2 && fencePosts(8.01) === 3 && fencePosts(7.9) === 2 && fencePosts(0) === 0 && fencePosts("abc") === 0 && fencePosts(-40) === 0);
  ok("posts: absurd runs are capped, finite", Number.isFinite(fencePosts(1e308)));
  const fm = fenceMeasurements({ linearFeet: "160", gateCount: 1 });
  ok("fence exports the run (edgingFt, perimeterLf) and posts — gates are left to the intake pass", fm.edgingFt.value === 160 && fm.perimeterLf.value === 160 && fm.fencePosts.value === 21 && !("gateCount" in fm), fm);
  ok("fence: no run → nothing", Object.keys(fenceMeasurements({})).length === 0 && Object.keys(fenceMeasurements(null)).length === 0);

  ok("yards: 810 sq ft × 4 in = 10 cu yd exactly", concreteCuYd(810, 4) === 10);
  ok("yards: 810 at 4 in + 5% = 10.5", concreteCuYd(810, 4, 5) === 10.5);
  ok("yards: 810 at 6 in = 15; at 5 in = 12.5", concreteCuYd(810, 6) === 15 && concreteCuYd(810, 5) === 12.5);
  ok("yards: 100 sq ft at 4 in = 1.23 → 1.25 (the quarter yard up)", concreteCuYd(100, 4) === 1.25);
  ok("yards: no thickness, or no area → 0 (never an assumed 4 in)", concreteCuYd(810, null) === 0 && concreteCuYd(810, "") === 0 && concreteCuYd(0, 4) === 0 && concreteCuYd("abc", 4) === 0);
  ok("yards: absurd inputs capped, finite", Number.isFinite(concreteCuYd(1e308, 1e308, 1e308)));
  const cm = concreteMeasurements({ squareFootage: 810, thicknessInches: "4", wasteFactorPercent: 5 });
  ok("concrete exports areaSqft + areaSqFt (net) and yards with the waste inside (wastePct 0)", cm.areaSqft.value === 810 && cm.areaSqFt.value === 810 && !("wastePct" in cm.areaSqft) && cm.concreteCuYd.value === 10.5 && cm.concreteCuYd.wastePct === 0, cm);
  const cn = concreteMeasurements({ squareFootage: 810, thicknessInches: "4" });
  ok("concrete with no stated waste: net yards, no wastePct (the template's applies)", cn.concreteCuYd.value === 10 && !("wastePct" in cn.concreteCuYd), cn);
  ok("concrete with no thickness: area only", !("concreteCuYd" in concreteMeasurements({ squareFootage: 810 })));
}

// A fixture service template for each trade, with a material line that has
// its own template waste — to see the stated waste replace it.
const flooringProduct = {
  id: "p_lvp", name: "LVP install", templateEnabled: true, categories: [{ id: "c_fl" }],
  templateLines: [
    { kind: "labour", name: "Install", qty: 1, unit: "sqft", unitPrice: 3.5, unitCost: 1.75, measurementKey: "floorSqft" },
    { kind: "material", name: "LVP", qty: 1, unit: "sqft", unitPrice: 3, unitCost: 2.2, measurementKey: "floorSqft", wastePct: 8 },
    { kind: "material", name: "LVP box", qty: 1, unit: "box", unitPrice: 55, unitCost: 40, measurementKey: "areaSqFt", coverage: { per: 22, unit: "sqft" } },
    { kind: "material", name: "Baseboard", qty: 1, unit: "linear_ft", unitPrice: 2, unitCost: 1.2, measurementKey: "linearFt", wastePct: 5 },
    { kind: "other", name: "Haul-away", qty: 1, unit: "flat", unitPrice: 150 },
  ],
};
const drywallProduct = {
  id: "p_dw", name: "Hang and finish", templateEnabled: true, categories: [{ id: "c_dw" }],
  templateLines: [
    { kind: "material", name: "Board", qty: 1, unit: "each", unitPrice: 18, unitCost: 13, measurementKey: "drywallSheets", wastePct: 10 },
    { kind: "material", name: "Mud and tape", qty: 1, unit: "each", unitPrice: 4, unitCost: 2.5, measurementKey: "drywallSheets" },
    { kind: "labour", name: "Hang and tape", qty: 1, unit: "sqft", unitPrice: 2.1, unitCost: 1, measurementKey: "areaSqFt" },
  ],
};
const concreteProduct = {
  id: "p_cc", name: "Slab", templateEnabled: true, categories: [{ id: "c_cc" }],
  templateLines: [
    { kind: "material", name: "Ready-mix", qty: 1, unit: "each", unitPrice: 180, unitCost: 150, measurementKey: "concreteCuYd", wastePct: 10 },
    { kind: "labour", name: "Place and finish", qty: 1, unit: "sqft", unitPrice: 4, unitCost: 2, measurementKey: "areaSqft" },
    { kind: "material", name: "Wire mesh", qty: 1, unit: "sqft", unitPrice: 0.4, unitCost: 0.3, measurementKey: "areaSqft", wastePct: 10 },
  ],
};
const lineBy = (lines, name) => lines.find((l) => l.description === name);

section("D — into the template lines");
{
  const kitchen = room({ label: "Kitchen", lengthFt: 15, widthFt: 12, heightFt: 8 });
  const fl = { tempId: "fl", label: "Floors", categoryKey: "flooring_install", takeoff: takeoff("flooring_install", [kitchen]), intakeValues: {}, lineItems: [] };
  const gm = groupMeasurements(fl);
  ok("groupMeasurements: flooring figures under the registry's names, calc roomMeasure", gm.floorSqft.value === 180 && gm.linearFt.value === 54 && gm.areaSqFt.value === 180 && gm.floorSqft.calc === "roomMeasure" && Object.keys(gm).every(isMeasurementKey), gm);

  // No stated waste: the template's own waste applies (8% LVP, 5% baseboard).
  const plain = expandServiceTemplate(flooringProduct, { measurements: measurementsFromGroups([fl], { targetTempId: "fl" }), currency: "USD", runId: "a", heading: false, pricedKeys: keysPricedByGroup(fl) });
  ok("no stated waste: install 180, LVP 180 × 1.08 = 194.4, boxes ceil(180 ÷ 22) = 9, baseboard 54 × 1.05 = 56.7", lineBy(plain.lines, "Install").quantity === 180 && lineBy(plain.lines, "LVP").quantity === 194.4 && lineBy(plain.lines, "LVP box").quantity === 9 && lineBy(plain.lines, "Baseboard").quantity === 56.7, plain.lines.map((l) => [l.description, l.quantity]));
  ok("…the note says where each came from", lineBy(plain.lines, "Install").meta.template.filled.calc === "roomMeasure" && lineBy(plain.lines, "Install").meta.template.filled.groupLabel === "Floors");

  // Stated waste 12% on the floor: replaces 8% on LVP, reaches the box via
  // areaSqFt (the floor), leaves labour alone; baseboard keeps its 5%.
  const wasted = { ...fl, takeoff: { ...fl.takeoff, waste: { floorSqft: 12, linearFt: null, wallSqft: null } } };
  const w = expandServiceTemplate(flooringProduct, { measurements: measurementsFromGroups([wasted], { targetTempId: "fl" }), currency: "USD", runId: "b", heading: false });
  ok("stated 12%: LVP 180 × 1.12 = 201.6 (not × 1.08, not × 1.08 × 1.12)", lineBy(w.lines, "LVP").quantity === 201.6 && lineBy(w.lines, "LVP").meta.template.wastePct === 12, lineBy(w.lines, "LVP"));
  ok("stated 12%: boxes ceil(201.6 ÷ 22) = 10; labour untouched at 180; baseboard keeps its template 5%", lineBy(w.lines, "LVP box").quantity === 10 && lineBy(w.lines, "Install").quantity === 180 && lineBy(w.lines, "Baseboard").quantity === 56.7, w.lines.map((l) => [l.description, l.quantity]));
  const zero = { ...fl, takeoff: { ...fl.takeoff, waste: { floorSqft: 0 } } };
  ok("stated 0%: no waste on the line at all", lineBy(expandServiceTemplate(flooringProduct, { measurements: measurementsFromGroups([zero], { targetTempId: "fl" }), currency: "USD", runId: "z", heading: false }).lines, "LVP").quantity === 180);

  // Refill: added before measuring, then measured with a stated waste.
  const empty = { ...fl, takeoff: null };
  const added = expandServiceTemplate(flooringProduct, { measurements: measurementsFromGroups([empty], { targetTempId: "fl" }), currency: "USD", runId: "r", heading: false });
  ok("added before measuring: every measured line awaits at 0", added.lines.filter((l) => l.meta.template.measurementKey).every((l) => l.quantity === 0 && l.meta.template.awaiting), added.summary);
  const refilled = refillTemplateRun(added.lines, "r", measurementsFromGroups([wasted], { targetTempId: "fl" }));
  ok("refill uses the stated waste on material lines (LVP 201.6), and the template's where none is stated (baseboard 56.7)", lineBy(refilled, "LVP").quantity === 201.6 && lineBy(refilled, "Baseboard").quantity === 56.7 && lineBy(refilled, "Install").quantity === 180 && lineBy(refilled, "LVP box").quantity === 10, refilled.map((l) => [l.description, l.quantity]));

  // Drywall: sheets with the waste inside — the template's 10% on Board is not added again.
  const dwRoom = { ...newMeasureRoom("drywall_install"), lengthFt: 12, widthFt: 10, heightFt: 8, openings: [newOpening("door"), newOpening("window")] };
  const dw = { tempId: "dw", label: "Drywall", categoryKey: "drywall_install", takeoff: takeoff("drywall_install", [dwRoom]), lineItems: [] };
  const d = expandServiceTemplate(drywallProduct, { measurements: measurementsFromGroups([dw], { targetTempId: "dw" }), currency: "USD", runId: "d", heading: false });
  ok("drywall: board 15 sheets (waste inside — not 16.5), mud and tape per sheet 15, hang 436 sq ft", lineBy(d.lines, "Board").quantity === 15 && lineBy(d.lines, "Mud and tape").quantity === 15 && lineBy(d.lines, "Hang and tape").quantity === 436, d.lines.map((l) => [l.description, l.quantity]));
  ok("drywall: $ = 15 × 18 + 15 × 4 + 436 × 2.10", d.lines.reduce((s, l) => s + l.amount, 0) === Math.round((270 + 60 + 915.6) * 100) / 100);

  // Concrete: 810 sq ft at 4 in + 5% → 10.5 yd; the template's 10% on ready-mix not added.
  const cc = { tempId: "cc", label: "Patio slab", categoryKey: "concrete", intakeValues: { squareFootage: 810, thicknessInches: "4", wasteFactorPercent: 5 }, lineItems: [] };
  const c = expandServiceTemplate(concreteProduct, { measurements: measurementsFromGroups([cc], { targetTempId: "cc" }), currency: "USD", runId: "c", heading: false });
  ok("concrete: ready-mix 10.5 yd (not 11.55), place 810 sq ft, mesh keeps its own 10% → 891", lineBy(c.lines, "Ready-mix").quantity === 10.5 && lineBy(c.lines, "Place and finish").quantity === 810 && lineBy(c.lines, "Wire mesh").quantity === 891, c.lines.map((l) => [l.description, l.quantity]));

  // A seeded fence template and a seeded flooring template, through the loader.
  const seeded = (trade, key) => {
    const s = SERVICE_SEEDS[trade].services.find((x) => x.seedKey === key);
    return { id: key, name: s.name.en || s.name, ...seedTemplateFor(s, { language: "en", currency: "USD" }) };
  };
  const fence = { tempId: "fe", label: "Fence", categoryKey: "fence_services", intakeValues: { linearFeet: 160, gateCount: 1, driveGateCount: 1 }, lineItems: [] };
  const fg = groupMeasurements(fence);
  ok("fence group: run, posts and both gate counts by their registered names", fg.edgingFt.value === 160 && fg.fencePosts.value === 21 && fg.gateCount.value === 1 && fg.driveGateCount.value === 1 && fg.gateCount.calc === "fence", fg);
  const wood = expandServiceTemplate(seeded("fence_services", "fq.fence_services.install.wood"), { measurements: measurementsFromGroups([fence], { targetTempId: "fe" }), currency: "USD", runId: "f", heading: false });
  ok("seeded wood fence: labour 160 ft, panels ceil(160 ÷ 8) = 20, the gate line still asks (it is keyed `each`)", wood.lines[0].quantity === 160 && wood.lines[1].quantity === 20 && wood.lines[2].meta.template.awaiting === true, wood.lines.map((l) => [l.description, l.quantity]));
  const vinyl = expandServiceTemplate(seeded("flooring_install", "fq.flooring_install.install.vinyl_interior"), { measurements: measurementsFromGroups([fl], { targetTempId: "fl" }), currency: "USD", runId: "v", heading: false });
  ok("seeded vinyl floor (keyed areaSqFt): labour 180 sq ft, boxes ceil(180 ÷ 22) = 9", vinyl.lines[0].quantity === 180 && vinyl.lines[1].quantity === 9 && vinyl.summary.awaiting === 0, vinyl.lines.map((l) => [l.description, l.quantity]));

  // Calculator notes and the calculator a trade names.
  ok("calculatorFor: a flooring group's areaSqFt → roomMeasure; a fence's posts → fence; a slab's yards → concrete", calculatorFor("areaSqFt", [fl]).calc === "roomMeasure" && calculatorFor("fencePosts", [fence]).calc === "fence" && calculatorFor("concreteCuYd", [cc]).calc === "concrete");
  ok("calculatorOfTrade for the reuse trades", ["flooring_install", "tiling", "drywall_install"].every((k) => calculatorOfTrade(k) === "roomMeasure") && calculatorOfTrade("fence_services") === "fence" && calculatorOfTrade("concrete") === "concrete");
  ok("a paint group still wins the wall figure's calculator note on a quote that has both", calculatorFor("wallSqft", [{ tempId: "p", categoryKey: "interior_painting" }, dw]).calc === "paint");

  // Every other trade: no stated waste anywhere, so their figures and lines are what they were.
  const paint = { tempId: "ip", label: "Interior", categoryKey: "interior_painting", takeoff: { model: "area_substrate", areas: [{ lengthFt: 10, widthFt: 13, heightFt: 8 }] }, lineItems: [] };
  const roof = { tempId: "rf", label: "Roof", categoryKey: "roofing_service", takeoff: { areaSqft: 2140, measuredFrom: "satellite", valleyFt: 0, dripEdgeFt: 180, ridgeVentFt: 44, ridgeHipFt: 60 }, lineItems: [] };
  const src = measurementsFromGroups([paint, roof, fl], { targetTempId: "ip" }).sources;
  ok("existing trades' sources carry no wastePct", ["wallSqft", "ceilingSqft", "areaSqft", "squares", "ridgeFt"].every((k) => src[k] && !("wastePct" in src[k])), src);
  const paintProduct = { templateLines: [{ kind: "material", name: "Wall paint", qty: 1, unit: "gallon", unitPrice: 70, measurementKey: "wallSqft", wastePct: 10, coverage: { per: 350, unit: "sqft" } }] };
  const a = expandServiceTemplate(paintProduct, { measurements: measurementsFromGroups([paint], { targetTempId: "ip" }), currency: "USD", runId: "p", heading: false });
  ok("a painting template with its own 10% waste expands as always: ceil(368 × 1.1 ÷ 350) = 2 gallons", a.lines[0].quantity === 2 && a.lines[0].meta.template.wastePct === 10);
}

section("E — the double-billing guard");
{
  for (const trade of [...Object.keys(ROOM_MEASURE_TRADES), ...Object.keys(TRACE_MEASURE_TRADES)]) {
    ok(`${trade}: not a pricing takeoff trade, and nothing is held back`, !hasTakeoff(trade) && keysPricedByGroup({ categoryKey: trade, takeoff: newRoomMeasure(trade) }).length === 0);
    const g = newScopeGroup({ id: `c_${trade}`, key: trade, label: trade }, trade, null, { tempId: trade });
    const withTakeoff = { ...g, takeoff: trade in ROOM_MEASURE_TRADES ? { ...newRoomMeasure(trade), rooms: [{ ...newMeasureRoom(trade), lengthFt: 20, widthFt: 20, heightFt: 8 }] } : { notFencedFt: 20 } };
    const p0 = scopeGroupPayload(g, null, "en");
    const p1 = scopeGroupPayload(withTakeoff, null, "en");
    ok(`${trade}: a measured takeoff adds no line and moves no total — it is saved beside the lines`, JSON.stringify(p0.lineItems) === JSON.stringify(p1.lineItems) && groupSubtotal(g, null) === groupSubtotal(withTakeoff, null) && p1.takeoff === withTakeoff.takeoff, { l0: p0.lineItems.length, l1: p1.lineItems.length });
  }
  // Siding: the walls fill the priced box, so wallSqft stays held back.
  const base = createTradeConfig("siding");
  const walls = [{ ...newSidingWall("Front"), linearFt: 40, heightFt: 10 }];
  const measured = { ...base, walls, sqft: Math.round(sidingWallsFigures(walls).netSqft) };
  const siding = { tempId: "sd", label: "Siding", categoryId: "c_sd", categoryKey: "siding", takeoff: measured, lineItems: [], persisted: false };
  ok("siding: the walls fill the takeoff's own sqft (400)", measured.sqft === 400 && groupMeasurements(siding).wallSqft.value === 400);
  ok("siding: wallSqft is still held back — the takeoff prices it", JSON.stringify(keysPricedByGroup(siding)) === JSON.stringify(["wallSqft"]));
  const sidingProduct = { templateLines: [
    { kind: "material", name: "Vinyl siding", qty: 1, unit: "sqft", unitPrice: 6, measurementKey: "wallSqft" },
    { kind: "other", name: "Permit", qty: 1, unit: "flat", unitPrice: 90 },
  ] };
  const guarded = expandServiceTemplate(sidingProduct, { measurements: measurementsFromGroups([siding], { targetTempId: "sd" }), currency: "USD", runId: "s", heading: false, pricedKeys: keysPricedByGroup(siding) });
  const takeoffOnly = groupSubtotal(siding, null);
  ok("siding: takeoff + permit, never the walls twice", takeoffOnly > 0 && groupSubtotal({ ...siding, lineItems: guarded.lines }, null) === Math.round((takeoffOnly + 90) * 100) / 100 && guarded.summary.skipped?.[0]?.measurementKey === "wallSqft", { takeoffOnly, lines: guarded.lines.length });
  const book = getPriceBook("siding");
  ok("siding: measuring walls changes the price exactly as typing the same sqft would", groupSubtotal(siding, null) === groupSubtotal({ ...siding, takeoff: { ...base, sqft: 400 } }, null) && Boolean(book));
}

section("F — the tracer's intake patch");
{
  const lawnFields = fieldsForCategory({ key: "landscaping_design" });
  const mow = fieldsForCategory({ key: "lawn_mowing" });
  for (const [totals, fields] of [[{ areaSqFt: 4371.26, perimeterFt: 263.44 }, lawnFields], [{ areaSqFt: 900, perimeterFt: 120 }, mow], [undefined, lawnFields], [{ areaSqFt: NaN, perimeterFt: "x" }, lawnFields], [{ areaSqFt: 5, perimeterFt: 5 }, null]]) {
    ok("no options: traceIntakePatch IS lotIntakePatch", JSON.stringify(traceIntakePatch(totals, fields)) === JSON.stringify(lotIntakePatch(totals, fields)), [totals]);
  }
  const fenceFields = fieldsForCategory({ key: "fence_services" });
  ok("fence: the outline less the unfenced side → Linear Feet, no area written", JSON.stringify(traceIntakePatch({ areaSqFt: 3000, perimeterFt: 220.04 }, fenceFields, { areaField: null, edgeField: "linearFeet", edgeDeductFt: 60 })) === JSON.stringify({ linearFeet: 160 }));
  ok("fence: a deduction longer than the outline → 0, never negative; a negative deduction is ignored", traceIntakePatch({ perimeterFt: 50 }, fenceFields, { areaField: null, edgeField: "linearFeet", edgeDeductFt: 80 }).linearFeet === 0 && traceIntakePatch({ perimeterFt: 50 }, fenceFields, { areaField: null, edgeField: "linearFeet", edgeDeductFt: -80 }).linearFeet === 50);
  const concreteFields = fieldsForCategory({ key: "concrete" });
  ok("concrete: the traced area → Square Footage, whole feet", JSON.stringify(traceIntakePatch({ areaSqFt: 809.6, perimeterFt: 120 }, concreteFields, { areaField: "squareFootage", edgeField: null })) === JSON.stringify({ squareFootage: 810 }));
  ok("a form with neither box gets nothing", Object.keys(traceIntakePatch({ areaSqFt: 1, perimeterFt: 1 }, [{ key: "x" }], { areaField: "squareFootage", edgeField: "linearFeet" })).length === 0);
  ok("the intake boxes the tracer fills exist on those forms", fenceFields.some((f) => f.key === "linearFeet") && fenceFields.some((f) => f.key === "gateCount") && fenceFields.some((f) => f.key === "driveGateCount") && concreteFields.some((f) => f.key === "squareFootage") && concreteFields.some((f) => f.key === "thicknessInches") && concreteFields.some((f) => f.key === "wasteFactorPercent"));
}

section("G — the registry: real names only");
{
  const filled = {
    flooring_install: roomMeasureMeasurements(takeoff("flooring_install", [room({ lengthFt: 10, widthFt: 10, heightFt: 8, surfaces: { floor: true, perimeter: true, walls: true } })]), "flooring_install"),
    tiling: roomMeasureMeasurements(takeoff("tiling", [{ ...newMeasureRoom("tiling"), lengthFt: 10, widthFt: 10, heightFt: 8, surfaces: { floor: true, walls: true, perimeter: true } }]), "tiling"),
    drywall_install: roomMeasureMeasurements(takeoff("drywall_install", [{ ...newMeasureRoom("drywall_install"), lengthFt: 10, widthFt: 10, heightFt: 8 }]), "drywall_install"),
    fence_services: groupMeasurements({ categoryKey: "fence_services", intakeValues: { linearFeet: 100, gateCount: 1, driveGateCount: 1 } }),
    concrete: groupMeasurements({ categoryKey: "concrete", intakeValues: { squareFootage: 500, thicknessInches: "4" } }),
    siding: groupMeasurements({ categoryKey: "siding", takeoff: { sqft: 400 } }),
  };
  for (const [trade, out] of Object.entries(filled)) {
    const listed = TRADE_MEASUREMENTS[trade];
    ok(`${trade}: every key TRADE_MEASUREMENTS lists is produced`, listed.every((k) => isMeasurementKey(k) && k in out), listed.filter((k) => !(k in out)));
  }
  ok("REUSE_TAKEOFF_TRADES is the six trades", REUSE_TAKEOFF_TRADES.slice().sort().join() === "concrete,drywall_install,fence_services,flooring_install,siding,tiling");
}

section("H — the panels render and are mounted");
{
  const wrap = (node, lang = "en") => renderToStaticMarkup(<LanguageProvider initialLanguage={lang}>{node}</LanguageProvider>);
  for (const trade of Object.keys(ROOM_MEASURE_TRADES)) {
    const cases = [
      ["no takeoff yet", null],
      ["blank", newRoomMeasure(trade)],
      ["filled", takeoff(trade, [{ ...newMeasureRoom(trade), label: "Kitchen", lengthFt: 12, widthFt: 10, heightFt: 8, surfaces: { floor: true, walls: true, perimeter: true, ceiling: true }, openings: [newOpening("door")] }, { ...newMeasureRoom(trade), measurement: "wall", linearFt: 10, heightFt: 1.5, wallSqftOverride: 20 }], { waste: { floorSqft: 12, wallSqft: null } })],
      ["sparse", { model: "room_measure" }],
      ["junk", { model: "room_measure", rooms: [null, 7, { openings: "x", surfaces: 5 }], waste: "x", sheetSqft: "abc" }],
      ["another model's takeoff", { measureFrame: { zoom: 20 } }],
    ];
    for (const [label, t] of cases) {
      try {
        const html = wrap(<RoomMeasure trade={trade} takeoff={t} onChange={() => {}} />);
        ok(`${trade} (${label}) renders`, html.includes(`data-reuse-takeoff="${trade}"`) && !/NaN|undefined|Infinity/.test(html), html.length);
        if (label === "filled") {
          ok(`${trade} (filled): the same geometry controls as the painting room (Room / Surface, the strip)`, html.includes("Room (4 walls)") && html.includes("Calculated from measurements"));
          ok(`${trade} (filled): the figures for the template lines are listed`, html.includes("data-reuse-figures"));
          if (trade === "drywall_install") ok("drywall (filled): the sheet count is shown", html.includes("data-reuse-sheets") && /→ \d+ sheets/.test(html));
        }
      } catch (err) {
        fails.push(`${trade} (${label}): ${err.message}`);
      }
    }
    // French, for the strings.
    try {
      const fr = wrap(<RoomMeasure trade={trade} takeoff={newRoomMeasure(trade)} onChange={() => {}} />, "fr");
      ok(`${trade}: French renders French`, fr.includes("Mesurer les pièces"));
    } catch (err) {
      fails.push(`${trade} (fr): ${err.message}`);
    }
  }
  for (const trade of Object.keys(TRACE_MEASURE_TRADES)) {
    for (const [label, iv, t] of [["blank", {}, null], ["filled", { linearFeet: 160, squareFootage: 810, thicknessInches: "4", wasteFactorPercent: 5 }, { notFencedFt: 20 }], ["junk", { linearFeet: "abc", squareFootage: -4, fenceDrawing: 7, slabDrawing: "x" }, 42]]) {
      try {
        const html = wrap(<TraceMeasure trade={trade} intakeValues={iv} fields={fieldsForCategory({ key: trade })} onIntakeChange={() => {}} takeoff={t} siteAddress="1 Main St" onTakeoffChange={() => {}} />);
        ok(`${trade} (${label}) renders the tracer`, html.includes(`data-reuse-takeoff="${trade}"`) && html.includes("<svg") && !/NaN|Infinity/.test(html), html.length);
        if (label === "filled") ok(`${trade} (filled) states its figures`, trade === "fence_services" ? html.includes("21 posts") : html.includes("10.5 cu yd"));
      } catch (err) {
        fails.push(`${trade} (${label}): ${err.message}`);
      }
    }
  }
  for (const [label, t] of [["no walls", createTradeConfig("siding")], ["walls", { ...createTradeConfig("siding"), walls: [{ ...newSidingWall("Front"), linearFt: 40, heightFt: 10, gableRiseFt: 8, openings: [newOpening("window")] }], sqft: 545 }], ["junk walls", { ...createTradeConfig("siding"), walls: [null, "x"] }]]) {
    try {
      const html = wrap(<TradeTakeoff categoryKey="siding" takeoff={t} book={getPriceBook("siding")} onChange={() => {}} siteAddress="" />);
      ok(`siding takeoff (${label}) renders its walls measure`, html.includes("data-siding-walls") && !/NaN|Infinity/.test(html));
      if (label === "walls") ok("siding (walls): the net figure is stated", html.includes("= 545 sq ft to clad"));
    } catch (err) {
      fails.push(`siding (${label}): ${err.message}`);
    }
  }

  // Mounted in the builder, for each trade, in the classic layout (the
  // document layout opens the same renderGroupEditor closure on click).
  const categories = [...REUSE_TAKEOFF_TRADES].map((key, i) => ({ id: `cat${i}`, key, label: key, enabled: true, unit: "flat", defaultRate: 0 }));
  const bootstrap = { clients: [], categories, products: [], workers: [], recipeOverrides: {}, companyLanguage: "en", companyCurrency: "CAD", taxConfig: { taxRate: 13, taxRates: [] }, layout: "classic" };
  const groups = categories.map((c) => {
    const g = newScopeGroup(c, c.label, null, { tempId: `g_${c.key}` });
    return { ...g, categoryId: c.id };
  });
  try {
    const html = renderToStaticMarkup(
      <LanguageProvider initialLanguage="en">
        <PermissionProvider role="owner" permissions={{}}>
          <QuoteBuilderForm mode="create" quoteId={null} bootstrap={bootstrap} initial={{ ...initialStateFromQuote(null), groups }} />
        </PermissionProvider>
      </LanguageProvider>,
    );
    for (const trade of [...Object.keys(ROOM_MEASURE_TRADES), ...Object.keys(TRACE_MEASURE_TRADES)]) {
      ok(`builder: ${trade} group mounts its measure`, html.includes(`data-reuse-takeoff="${trade}"`));
    }
    ok("builder: the siding group's takeoff carries its walls measure", html.includes("data-siding-walls"));
  } catch (err) {
    fails.push(`builder render: ${err.message}`);
  }
  const docSrc = readFileSync("app/components/quotes/builder/DocumentBuilder.js", "utf8");
  ok("the document layout opens the same group editor (renderGroupEditor)", /b\.renderGroupEditor\(group\)/.test(docSrc));

  // The painting card: its geometry controls moved into AreaGeometry.js, and
  // its HTML is byte-for-byte what it was (md5 taken before the move).
  const areas = [
    { areaType: "den", label: "Den", surface: "interior", measurement: "area", lengthFt: 10, widthFt: 13, heightFt: 9, substrates: [{ key: "walls", label: "Walls", coats: 2, quantity: null, driver: "wallSqft", productKey: "wall_interior" }] },
    { areaType: "den", label: "Hall", surface: "interior", measurement: "area", lengthFt: 4, widthFt: 20, heightFt: 8, wallSqftOverride: 150, floorSqftOverride: 0, substrates: [] },
    { areaType: "exterior", label: "Front", surface: "exterior", measurement: "wall", linearFt: 40, heightFt: 12, ceilingSqftOverride: 5, substrates: [] },
    { areaType: "exterior", label: "Legacy", surface: "exterior", measurement: "surface", surfaceSqft: 2340, linearFt: 260, substrates: [] },
    { label: "" },
  ];
  let all = "";
  for (const [key, type] of [["interior_painting", "interior"], ["exterior_painting", "exterior"], ["interior_painting", null]]) {
    for (const lang of ["en", "fr"]) {
      all += md5(wrap(<TradeTakeoff categoryKey={key} takeoff={{ model: "area_substrate", estimateType: type, areas }} book={getPriceBook(key)} onChange={() => {}} siteAddress="x" />, lang));
    }
  }
  ok("the painting room card's HTML is unchanged by sharing its geometry controls (md5 cd845c5e…)", md5(all) === "cd845c5ee8ed1f25c17cf1328b5d4246", md5(all));
}

section("I — nine languages");
{
  const src = ["app/components/quotes/builder/ReuseTakeoff.js"].map((f) => readFileSync(f, "utf8")).join("\n");
  const keys = new Set([...src.matchAll(/"(app\.reuseTakeoff\.[A-Za-z_]+)"/g)].map((m) => m[1]));
  for (const k of ["drywallSheets", "fencePosts", "concreteCuYd", "gateCount", "driveGateCount"]) keys.add(`app.serviceTemplates.measure_${k}`);
  for (const k of ["roomMeasure", "fence", "concrete"]) keys.add(`app.templateLines.calc_${k}`);
  const langs = Object.keys(APP_MESSAGES);
  ok("nine app languages", langs.length === 9, langs);
  for (const lang of langs) {
    const missing = [...keys].filter((k) => typeof APP_MESSAGES[lang][k] !== "string" || !APP_MESSAGES[lang][k]);
    ok(`${lang}: all ${keys.size} strings present`, missing.length === 0, missing);
    const ph = [...keys].filter((k) => {
      const want = new Set((APP_MESSAGES.en[k].match(/\{\w+\}/g) || []));
      const got = new Set((APP_MESSAGES[lang][k].match(/\{\w+\}/g) || []));
      return want.size !== got.size || [...want].some((x) => !got.has(x));
    });
    ok(`${lang}: every placeholder kept`, ph.length === 0, ph);
  }
}

console.log(`\n${pass} passed, ${fails.length} failed`);
for (const f of fails) console.log(`  ✗ ${f}`);
if (fails.length) process.exit(1);
