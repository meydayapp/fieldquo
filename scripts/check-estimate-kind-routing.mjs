// scripts/check-estimate-kind-routing.mjs
//
// "What kind of estimate is this?" — each kind opens its own calculator.
//
//   npm run check:estimate-kind-routing
//
// The owner, 2026-10-03, on TrueFinish Cabinets (cabinet refinishing,
// refacing and stairs; Interior Painting switched on): Cabinets & millwork
// opened a ROOM — W × L × H, then tick cabinet doors — and Refinish, Reface
// and Stairs were nowhere. The room is right for interior only.
//
//   1. Routing      lib/quotes/estimateKindRouting.js, executed: cabinets →
//                   the cabinet trade (Refinish | Reface), staining → cabinets
//                   | stairs | decks & fences, everything else → the painting
//                   takeoff; only trades the company sells.
//   2. Rendering    the builder and the takeoff, rendered: interior is a room,
//                   exterior is surfaces, commercial is both under its own
//                   rate set, cabinets carry the Refinish | Reface switch,
//                   stairs render the staircase form; stairs are reachable.
//   3. Byte-identical existing quotes: every painting kind, a stair takeoff
//                   and both cabinet trades, md5-pinned to what origin/main
//                   produced before this landed (scripts/estimateKindFixtures.mjs).
//
// And the second set, later the same day:
//
//   4. A painter without the cabinet trade COUNTS cabinets (doors, drawer
//      fronts, box lf, built-in sqft from the book's cab_* rates) — no W × L × H.
//   5. Siding & trim and Trim boards exclude each other on one area; a stored
//      area with both keeps its price and is flagged.
//   6. Plain drywall's repairs are fixed-price items (the live repair book),
//      not a room; drywall_install is untouched.
//   7. No "Floor area" label prices walls; walls are wall area, ceilings
//      ceiling area.
//   8. The researched exterior defaults, the cabinet stain add-on, and a second
//      md5 set (drywall, drywall_install, cabinet upgrades, the legacy room
//      grid, an area with both trims) pinned against origin/main f74dd7f9.
//
// Bundled through esbuild like check-doc-builder (the components are JSX).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  routeEstimateKind,
  routedAddOns,
  stainingChoices,
  usesSurfaceCalculator,
  usesCountCalculator,
  excludedBy,
  trimCountedTwice,
  EXCLUSIVE_SUBSTRATES,
  placeRoutedGroup,
  isUntouchedPaintGroup,
} from "../lib/quotes/estimateKindRouting.js";
import { newScopeGroup, scopeGroupPayload, groupSubtotal, cabinetAddOnLinesFor } from "../lib/quotes/builderPayload.js";
import {
  drywallRepairItems,
  drywallRepairLine,
  drywallCallOutMinimum,
  drywallRepairShortfall,
  drywallMinimumLine,
  isDrywallRepairLine,
  repairItemText,
} from "../lib/quotes/drywallRepairs.js";
import { addOnsForCategory } from "../lib/pricing/offerings.js";
import { createTradeConfig, buildTradeLineItems, tradeSubtotal } from "../lib/pricing/tradeScope.js";
import {
  paintTakeoff,
  newPaintArea,
  newPaintSubstrate,
  rateSetFor,
  PAINT_TAKEOFF_DEFAULTS,
  PAINT_QUICK_PICKS,
  PAINT_SUBSTRATE_DEFAULTS,
} from "../lib/pricing/paintTakeoff.js";
import { getPriceBook, keepsOwnRate } from "../app/data/tradePriceBooks.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { QuoteBuilderForm, initialStateFromQuote } from "../app/components/quotes/builder/QuoteBuilder.js";
import PaintAreas, { EstimateTypeCards } from "../app/components/quotes/builder/PaintAreas.js";
import TradeTakeoff from "../app/components/quotes/builder/TradeTakeoff.js";
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import { PermissionProvider } from "../app/providers/PermissionProvider.js";
import { fixtureDigests, moreFixtureDigests, PAINT_FIXTURES, LEGACY_ROOMS, STORED_BOTH_TRIMS } from "./estimateKindFixtures.mjs";

let pass = 0;
const fails = [];
const ok = (name, cond, detail = "") => {
  if (cond) pass += 1;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
};
const eq = (name, a, b) => ok(name, Object.is(a, b), `got ${JSON.stringify(a)}, want ${JSON.stringify(b)}`);

// TrueFinish's enabled trades, as the builder receives them (enabled only).
const TF = [
  { id: "c-ip", key: "interior_painting", label: "Interior Painting", enabled: true },
  { id: "c-rf", key: "cabinet_refinishing", label: "Cabinet Refinishing", enabled: true },
  { id: "c-rc", key: "cabinet_refacing", label: "Cabinet Refacing", enabled: true },
  { id: "c-st", key: "stairs", label: "Stairs", enabled: true },
  { id: "c-fl", key: "flooring", label: "Flooring", enabled: true },
  { id: "c-sd", key: "siding", label: "Siding", enabled: true },
];
const PAINTER = [
  { id: "p-ip", key: "interior_painting", label: "Interior Painting", enabled: true },
  { id: "p-ep", key: "exterior_painting", label: "Exterior Painting", enabled: true },
];

// ───────────────────────────────────────────────────────────────────────────
console.log("1. routing");
// ───────────────────────────────────────────────────────────────────────────
for (const kind of ["interior", "exterior", "commercial"]) {
  eq(`${kind} → the painting takeoff`, routeEstimateKind(kind, TF), null);
}
eq("cabinets → cabinet refinishing (first, the higher-volume trade)", routeEstimateKind("cabinets", TF)?.category?.key, "cabinet_refinishing");
eq("cabinets → the cabinet calculator", routeEstimateKind("cabinets", TF)?.calculator, "cabinet");
eq("cabinets is not a stain", routeEstimateKind("cabinets", TF)?.stain, false);
eq("cabinets, a refacing-only company → refacing", routeEstimateKind("cabinets", TF.filter((c) => c.key !== "cabinet_refinishing"))?.category?.key, "cabinet_refacing");
eq("cabinets, a painter with no cabinet trade → the painting takeoff, as before", routeEstimateKind("cabinets", PAINTER), null);
eq("staining asks cabinets | stairs | decks & fences when both are sold", stainingChoices(TF).join(","), "cabinets,stairs,surfaces");
eq("staining → cabinets opens the cabinet trade", routeEstimateKind("staining", TF, "cabinets")?.category?.key, "cabinet_refinishing");
eq("staining → cabinets is a stain", routeEstimateKind("staining", TF, "cabinets")?.stain, true);
eq("staining → stairs opens the stair trade", routeEstimateKind("staining", TF, "stairs")?.category?.key, "stairs");
eq("staining → stairs calculator", routeEstimateKind("staining", TF, "stairs")?.calculator, "stairs");
eq("staining → decks & fences stays the painting takeoff", routeEstimateKind("staining", TF, "surfaces"), null);
eq("staining with no choice stays the painting takeoff", routeEstimateKind("staining", TF), null);
eq("a painter with neither trade: nothing to ask", stainingChoices(PAINTER).join(","), "surfaces");
eq("staining → stairs, stairs not sold → no route", routeEstimateKind("staining", PAINTER, "stairs"), null);
eq("junk categories never route", routeEstimateKind("cabinets", "nope"), null);
eq("the route hands back the company's own row", routeEstimateKind("cabinets", TF)?.category, TF[1]);

// The surface calculator: exterior, and commercial set to exterior, while
// nothing room-shaped is stored.
const blankExt = newPaintArea("exterior", PAINT_TAKEOFF_DEFAULTS, { estimateType: "exterior" });
ok("exterior, a fresh area → surfaces", usesSurfaceCalculator("exterior", blankExt));
ok("exterior, measured by surface → surfaces", usesSurfaceCalculator("exterior", { ...blankExt, measurement: "surface", surfaceSqft: 900 }));
ok("exterior, stored with room dimensions → keeps its room", !usesSurfaceCalculator("exterior", PAINT_FIXTURES.exterior_room.areas[0]));
ok("exterior, stored as a wall run → keeps it", !usesSurfaceCalculator("exterior", { ...blankExt, measurement: "wall", linearFt: 30, heightFt: 9 }));
ok("exterior, a typed-over figure → keeps the room", !usesSurfaceCalculator("exterior", { ...blankExt, wallSqftOverride: 400 }));
ok("interior is never surfaces", !usesSurfaceCalculator("interior", { ...blankExt, surface: "interior" }));
const blankCom = newPaintArea("commercial_unit", PAINT_TAKEOFF_DEFAULTS, { estimateType: "commercial" });
ok("commercial, interior area → room", !usesSurfaceCalculator("commercial", blankCom));
ok("commercial, exterior area → surfaces", usesSurfaceCalculator("commercial", { ...blankCom, surface: "exterior" }));
ok("no type (a quote written before types) → never surfaces", !usesSurfaceCalculator(null, blankExt));

// In-takeoff picks: replace an untouched painting group, else add after it.
const paintGroup = (tempId, takeoff, lineItems = []) => ({ tempId, persisted: false, categoryKey: "interior_painting", takeoff, lineItems });
const fresh = { tempId: "new", categoryKey: "cabinet_refinishing" };
const untouched = paintGroup("p1", createTradeConfig("interior_painting"));
ok("a fresh interior painting group is untouched", isUntouchedPaintGroup(untouched));
ok("a fresh exterior painting group (one blank area) is untouched", isUntouchedPaintGroup(paintGroup("p", createTradeConfig("exterior_painting"))));
{
  const placed = placeRoutedGroup([{ tempId: "a" }, untouched, { tempId: "z" }], "p1", fresh);
  eq("untouched: replaced in place", placed.map((g) => g.categoryKey || g.tempId).join(","), "a,cabinet_refinishing,z");
  eq("untouched: the replacement keeps the open group's tempId", placed[1].tempId, "p1");
}
{
  const worked = paintGroup("p2", PAINT_FIXTURES.interior);
  ok("a group with a measured room is not untouched", !isUntouchedPaintGroup(worked));
  const placed = placeRoutedGroup([worked], "p2", fresh);
  eq("worked: kept, the trade added after it", placed.map((g) => g.tempId).join(","), "p2,new");
  ok("worked: the painting group is the same object", placed[0] === worked);
  ok("a group with a line is not untouched", !isUntouchedPaintGroup(paintGroup("p3", createTradeConfig("interior_painting"), [{ description: "x" }])));
  ok("a persisted group is never replaced", !isUntouchedPaintGroup({ ...untouched, persisted: true }));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("2. each kind renders its calculator");
// ───────────────────────────────────────────────────────────────────────────
const wrap = (node) =>
  renderToStaticMarkup(
    <LanguageProvider initialLanguage="en">
      <PermissionProvider role="owner" permissions={{}}>{node}</PermissionProvider>
    </LanguageProvider>,
  );
const book = getPriceBook("interior_painting", null).takeoff;
const ROOM_TOGGLE = 'Room (4 walls)';
const paintHtml = (takeoff) => wrap(<PaintAreas takeoff={takeoff} book={book} onChange={() => {}} routing={{ stainChoices: stainingChoices(TF), onRoute: () => true }} />);

{
  const html = paintHtml({ model: "area_substrate", estimateType: "interior", areas: [newPaintArea("living_room", book, { estimateType: "interior" })] });
  ok("interior: the room calculator (Room · Surface toggle)", html.includes(ROOM_TOGGLE));
  ok("interior: W × L × H", html.includes("Width (ft)") && html.includes("Length (ft)") && html.includes("Height (ft)"));
  ok("interior: no surface calculator", !html.includes("data-surface-calculator"));
}
{
  const html = paintHtml(createTradeConfig("exterior_painting"));
  ok("exterior: the surface calculator", html.includes("data-surface-calculator"));
  ok("exterior: no room toggle, no W × L × H", !html.includes(ROOM_TOGGLE) && !html.includes("Width (ft)") && !html.includes("Length (ft)"));
  ok("exterior: siding area and trim run", html.includes("Measured area (sqft)") && html.includes("Linear feet"));
  for (const pick of PAINT_QUICK_PICKS.exterior) {
    ok(`exterior: offers ${pick.key}`, html.includes(book.substrates[pick.key].label.replace(/&/g, "&amp;")));
  }
  const keys = PAINT_QUICK_PICKS.exterior.map((p) => p.key);
  ok("exterior: doors, window frames, trim and shutters are counted", ["ext_door", "ext_window_frame", "ext_trim", "shutters", "soffit_fascia", "siding_trim"].every((k) => keys.includes(k)));
}
{
  const html = paintHtml(PAINT_FIXTURES.exterior_room);
  ok("exterior stored as a room keeps its room form", html.includes(ROOM_TOGGLE) && !html.includes("data-surface-calculator"));
}
{
  const takeoff = {
    model: "area_substrate",
    estimateType: "commercial",
    areas: [newPaintArea("commercial_unit", book, { estimateType: "commercial" }), { ...newPaintArea("commercial_unit", book, { estimateType: "commercial" }), surface: "exterior" }],
  };
  const html = paintHtml(takeoff);
  const [first, second] = html.split('data-paint-area="1"');
  ok("commercial: the interior area is a room", first.includes(ROOM_TOGGLE) && !first.includes("data-surface-calculator"));
  ok("commercial: the exterior area is surfaces", (second || "").includes("data-surface-calculator") && !(second || "").includes(ROOM_TOGGLE));
  ok("commercial: the exterior area ticks the exterior list", (second || "").includes("Exterior door") && (second || "").includes("Shutters"));
  ok("commercial: priced from its own rate set", html.includes("Rate set") && html.includes("Commercial"));
  // A commercial exterior row prices at the COMMERCIAL set's rate.
  const row = newPaintSubstrate("ext_door", book, { estimateType: "commercial" });
  eq("commercial: an exterior door row keys the commercial set", row.rateKey, "ext_door");
  ok("commercial: the commercial set carries it", Boolean(rateSetFor(book, "commercial").rates.ext_door));
  const priced = paintTakeoff({ ...takeoff, areas: [{ ...takeoff.areas[1], substrates: [{ ...row, quantity: 2 }] }] }, book);
  eq("commercial: the engine reports the commercial set", priced.rateSet?.label, "Commercial");
  ok("commercial: a door prices", priced.total > 0, String(priced.total));
}
{
  // The staining card asks only when there is something to choose.
  const asks = wrap(<EstimateTypeCards value={null} onPick={() => {}} t={(k, d) => d} stainChoices={stainingChoices(TF)} />);
  ok("staining asks what is stained (cabinets or stairs sold)", asks.includes('aria-expanded="false"'));
  const plain = wrap(<EstimateTypeCards value={null} onPick={() => {}} t={(k, d) => d} stainChoices={stainingChoices(PAINTER)} />);
  ok("a painter with neither trade: Staining picks at once", !plain.includes("aria-expanded"));
}

// The wiring a static render cannot press: the takeoff's cards hand a pick
// to the builder's routePaintGroup before taking it themselves, the first
// screen's cards reach addPaintingEstimate with the stain choice, and both
// builder paths ask the one routing function.
{
  const src = (p) => readFileSync(join(process.cwd(), p), "utf8");
  const paint = src("app/components/quotes/builder/PaintAreas.js");
  const builder = src("app/components/quotes/builder/QuoteBuilder.js");
  const first = src("app/components/quotes/builder/EstimateTypeFirst.js");
  const trade = src("app/components/quotes/builder/TradeTakeoff.js");
  ok("wiring: the takeoff's cards try the route first", /if \(routing\?\.onRoute && routing\.onRoute\(key, choice\)\) return;\s*onChange\(\{ \.\.\.takeoff, estimateType: key \}\)/.test(paint));
  ok("wiring: the builder hands the takeoff routePaintGroup", /routing=\{\{[\s\S]{0,200}routePaintGroup\(group\.tempId, kind, choice\)/.test(builder));
  ok("wiring: TradeTakeoff passes routing to both painting forms", (trade.match(/<PaintAreas [^>]*routing=\{routing\}/g) || []).length === 2 && /routing=\{routing\}\s*\/>/.test(trade));
  ok("wiring: addPaintingEstimate asks routeEstimateKind", /function addPaintingEstimate\(estimateType, choice = null\) \{[\s\S]{0,900}routeEstimateKind\(estimateType, categories, choice\)/.test(builder));
  ok("wiring: routePaintGroup asks routeEstimateKind and places with placeRoutedGroup", /function routePaintGroup[\s\S]{0,300}routeEstimateKind\(kind, categories, choice\)[\s\S]{0,500}placeRoutedGroup\(prev, groupTempId, fresh\)/.test(builder));
  ok("wiring: the first screen offers the stain choices", /stainChoices=\{stainingChoices\(categories\)\}/.test(first));
  ok("wiring: the area card asks usesSurfaceCalculator", /usesSurfaceCalculator\(estimateType, area\)/.test(paint));
}

// The builder, after each routed pick — the group the pick creates, rendered
// by the same QuoteBuilderForm the screen mounts.
const BOOTSTRAP = {
  clients: [{ id: "c1", name: "Alice", email: "a@example.com", address: "1 Main St" }],
  categories: TF,
  products: [],
  workers: [],
  members: [],
  recipeOverrides: {},
  companyLanguage: "en",
  companyCurrency: "CAD",
  defaultProcessNotes: "",
  taxConfig: { taxRate: 13, autoApplyLocalTax: false, taxRates: [], country: "CA", province: "ON" },
  overheadPerJob: 0,
  overheadSource: null,
  company: { name: "TrueFinish", brandColor: "#1d4ed8", country: "CA" },
};
const builderWith = (groups, layout = "classic") =>
  wrap(<QuoteBuilderForm mode="create" quoteId={null} bootstrap={{ ...BOOTSTRAP, layout }} initial={{ ...initialStateFromQuote(null), client: BOOTSTRAP.clients[0], groups }} />);
// Exactly what QuoteBuilder routePaintGroup does with a route.
const routed = (kind, choice, label) => {
  const r = routeEstimateKind(kind, TF, choice);
  return newScopeGroup(r.category, label ?? r.category.label, null, { tempId: `r-${kind}-${choice}`, fieldDefaults: true, language: "en" });
};
const interiorGroup = { ...newScopeGroup(TF[0], "Interior Painting", null, { tempId: "ip" }) };
for (const layout of ["classic", "document"]) {
  {
    const groups = placeRoutedGroup([interiorGroup], "ip", routed("cabinets"));
    eq(`${layout}: cabinets replaced the untouched painting group`, groups.map((g) => g.categoryKey).join(","), "cabinet_refinishing");
    const html = builderWith(groups, layout);
    // The document layout draws the editor when a group is opened; the
    // classic layout always. Both render from the same group.
    if (layout === "classic") {
      ok("cabinets: the Refinish | Reface switch", html.includes('data-cabinet-service="cabinet_refinishing"') && html.includes('data-cabinet-service="cabinet_refacing"'));
      ok("cabinets: Refinish and Reface are labelled", html.includes(">Refinish<") && html.includes(">Reface<"));
      ok("cabinets: door and drawer counts (the refinishing calculator)", html.includes(">Doors<") && html.includes(">Drawers<") && html.includes(">Total units<") && html.includes(">Final / unit<"));
      ok("cabinets: no room geometry", !html.includes(ROOM_TOGGLE) && !html.includes("Width (ft)"));
    }
    ok(`${layout}: cabinets renders without NaN`, !html.includes("NaN"));
  }
  {
    const label = APP_MESSAGES.en["app.paint.stainHeading.cabinets"];
    const groups = placeRoutedGroup([interiorGroup], "ip", routed("staining", "cabinets", label));
    eq(`${layout}: staining → cabinets is the cabinet trade`, groups[0].categoryKey, "cabinet_refinishing");
    const html = builderWith(groups, layout);
    ok(`${layout}: staining → cabinets says so on the document`, html.includes(label));
    if (layout === "classic") ok("staining → cabinets: Refinish | Reface", html.includes('data-cabinet-service="cabinet_refacing"'));
  }
  {
    const label = APP_MESSAGES.en["app.paint.stainHeading.stairs"];
    const groups = placeRoutedGroup([interiorGroup], "ip", routed("staining", "stairs", label));
    eq(`${layout}: staining → stairs is the stair trade`, groups[0].categoryKey, "stairs");
    ok(`${layout}: the stair group carries the stair takeoff`, Array.isArray(groups[0].takeoff?.sections));
    const html = builderWith(groups, layout);
    if (layout === "classic") {
      ok("staining → stairs: the staircase form", html.includes('data-testid="stairs-fill-steps"'));
      ok("staining → stairs: no room geometry", !html.includes(ROOM_TOGGLE));
    }
    ok(`${layout}: staining → stairs renders without NaN`, !html.includes("NaN"));
  }
}
{
  const html = wrap(<TradeTakeoff categoryKey="stairs" takeoff={createTradeConfig("stairs")} book={getPriceBook("stairs", null)} onChange={() => {}} />);
  ok("stairs: the takeoff renders on its own", html.includes('data-testid="stairs-fill-steps"'));
}
// Stairs are reachable wherever they are sold: under Staining, and in the
// "Other trades" tiles of the first screen (the non-painting trades).
ok("stairs reachable: a Staining choice", stainingChoices(TF).includes("stairs"));
{
  const html = builderWith([]);
  ok("stairs reachable: the first screen offers Other trades", html.includes("data-other-trades") && html.includes("data-estimate-type-first"));
}
ok("stairs not offered where not sold", !stainingChoices(PAINTER).includes("stairs"));
// Each new label exists in every catalogue language.
for (const key of ["app.paint.stainWhat", "app.paint.stainChoice.cabinets", "app.paint.stainChoice.stairs", "app.paint.stainChoice.surfaces", "app.paint.stainHeading.cabinets", "app.paint.stainHeading.stairs", "app.paint.surfaceCalc", "app.paint.surfaceHint"]) {
  for (const lang of Object.keys(APP_MESSAGES)) ok(`${lang} has ${key}`, typeof APP_MESSAGES[lang][key] === "string" && APP_MESSAGES[lang][key].length > 0);
}

// ───────────────────────────────────────────────────────────────────────────
console.log("3. existing quotes are byte-identical");
// ───────────────────────────────────────────────────────────────────────────
// Taken from origin/main (1ae5a1a0) through the same fixtures, before the
// routing landed. A stored quote of any of these kinds must print the same.
const PINNED = {
  "legacy_untyped/interior_painting": "b648ef385964b55b0ea7c04acb7d0a9b",
  "legacy_untyped/exterior_painting": "b648ef385964b55b0ea7c04acb7d0a9b",
  "interior/interior_painting": "59f2c24621f08da543d478aae53f40f7",
  "interior/exterior_painting": "59f2c24621f08da543d478aae53f40f7",
  "exterior_room/interior_painting": "b7ac4ee0d435a3faea2b8ffc280ed1d5",
  "exterior_room/exterior_painting": "b7ac4ee0d435a3faea2b8ffc280ed1d5",
  "exterior_surface/interior_painting": "6405b9a556aed07fdc79f67c6826d155",
  "exterior_surface/exterior_painting": "6405b9a556aed07fdc79f67c6826d155",
  "cabinets/interior_painting": "31933a62cfeb6957da00b8ca54a59754",
  "cabinets/exterior_painting": "31933a62cfeb6957da00b8ca54a59754",
  "staining/interior_painting": "cad188fae530e2edf3810c2078789d9a",
  "staining/exterior_painting": "cad188fae530e2edf3810c2078789d9a",
  "commercial/interior_painting": "832c061d82b1b29fd787b69d5c1f48a1",
  "commercial/exterior_painting": "832c061d82b1b29fd787b69d5c1f48a1",
  "stairs/live": "07ace69015133fb88bfdb14ce72518ea",
  "stairs/stored": "cfb2a8b9da81daf6c0cb8d31f0eb0ce9",
  "cabinet_refinishing/live": "79b3b1e4a3704dfa10e47d8acf4af9d5",
  "cabinet_refinishing/stored": "2abe634cdd5959b43f2b3370dd0c4326",
  "cabinet_refacing/live": "a1bdb8e9738e7f66229486fe2edcd35d",
  "cabinet_refacing/stored": "d6ad21037914ebff7b369490ff66160c",
};
const digests = fixtureDigests({ paintTakeoff, getPriceBook, buildTradeLineItems, tradeSubtotal, scopeGroupPayload, groupSubtotal, newScopeGroup });
eq("every pinned fixture is computed", Object.keys(digests).sort().join(","), Object.keys(PINNED).sort().join(","));
for (const [name, want] of Object.entries(PINNED)) eq(`byte-identical: ${name}`, digests[name], want);
// The fixtures price something — a pin over $0 everywhere proves nothing.
for (const [name, t] of Object.entries(PAINT_FIXTURES)) ok(`fixture ${name} prices above zero`, tradeSubtotal("interior_painting", t, null) > 0);
// A new painting group opens exactly as it did.
eq("a new interior painting takeoff is unchanged", JSON.stringify(createTradeConfig("interior_painting")), JSON.stringify({ model: "area_substrate", estimateType: "interior", areas: [], notes: "" }));

// ═══════════════════════════════════════════════════════════════════════════
// The second set (owner, 2026-10-03, later): a painter without the cabinet
// trade counts cabinets; trim is counted once; drywall repairs are fixed
// prices; walls are wall area; and existing quotes still print the same.
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
console.log("4. a painter without the cabinet trade gets the COUNT calculator");
// ───────────────────────────────────────────────────────────────────────────
{
  eq("PAINTER: Cabinets & millwork stays in the painting takeoff (no cabinet trade to open)", routeEstimateKind("cabinets", PAINTER), null);
  const fresh = newPaintArea("kitchen", book, { estimateType: "cabinets" });
  ok("a fresh cabinets area takes the count calculator", usesCountCalculator("cabinets", fresh));
  ok("...not under any other estimate type", !usesCountCalculator("interior", { ...fresh, surface: "interior" }) && !usesCountCalculator("staining", fresh) && !usesCountCalculator(null, fresh));
  ok("a stored cabinets area WITH room dimensions keeps its room", !usesCountCalculator("cabinets", PAINT_FIXTURES.cabinets.areas[0]));
  ok("a stored cabinets area with a typed-over figure keeps its room", !usesCountCalculator("cabinets", { ...fresh, wallSqftOverride: 120 }));
  ok("junk is never the count calculator", !usesCountCalculator("cabinets", null) && !usesCountCalculator("cabinets", "x"));
  const html = paintHtml({ model: "area_substrate", estimateType: "cabinets", areas: [fresh] });
  ok("cabinets (painter): the count calculator is drawn", html.includes("data-count-calculator"));
  ok("cabinets (painter): no Room · Surface toggle", !html.includes(ROOM_TOGGLE));
  ok("cabinets (painter): no width, length or height", !html.includes("Width (ft)") && !html.includes("Length (ft)") && !html.includes("Height (ft)"));
  ok("cabinets (painter): no 'calculated from measurements' strip", !html.includes("Gross area — openings are not deducted"));
  for (const pick of PAINT_QUICK_PICKS.cabinets) {
    ok(`cabinets (painter): counts ${pick.key} from the painting book`, html.includes(book.substrates[pick.key].label.replace(/&/g, "&amp;")) && /^cab_/.test(pick.key));
  }
  ok("every cabinets substrate is counted, none driven by geometry", PAINT_QUICK_PICKS.cabinets.every((p) => p.count && book.substrates[p.key].driver === null));
  // It prices from the cab_* rates, by count alone.
  const rows = ["cab_door", "cab_drawer", "cab_box", "cab_builtin"].map((key, i) => ({ ...newPaintSubstrate(key, book, { estimateType: "cabinets" }), quantity: [20, 8, 24, 12][i] }));
  const priced = paintTakeoff({ model: "area_substrate", estimateType: "cabinets", areas: [{ ...fresh, substrates: rows }] }, book);
  ok("a counted cabinets area prices", priced.total > 0, String(priced.total));
  const roomy = paintTakeoff({ model: "area_substrate", estimateType: "cabinets", areas: [{ ...fresh, lengthFt: 12, widthFt: 14, heightFt: 8, substrates: rows }] }, book);
  eq("...and room dimensions never moved its price (nothing reads them)", roomy.total, priced.total);
  const stored = paintHtml(PAINT_FIXTURES.cabinets);
  ok("a stored cabinets area with dimensions keeps its room form", stored.includes(ROOM_TOGGLE) && !stored.includes("data-count-calculator"));
  ok("wiring: the area card asks usesCountCalculator", /usesCountCalculator\(estimateType, area\)/.test(readFileSync(join(process.cwd(), "app/components/quotes/builder/PaintAreas.js"), "utf8")));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("5. Siding & trim and Trim boards never both apply to one area");
// ───────────────────────────────────────────────────────────────────────────
{
  ok("the pair is declared", EXCLUSIVE_SUBSTRATES.some((p) => p.includes("siding_trim") && p.includes("ext_trim")));
  const area = (keys) => ({ ...newPaintArea("exterior", book, { estimateType: "exterior" }), substrates: keys.map((k) => newPaintSubstrate(k, book, { estimateType: "exterior" })) });
  eq("siding & trim on the area rules out trim boards", excludedBy(area(["siding_trim"]), "ext_trim"), "siding_trim");
  eq("trim boards on the area rules out siding & trim", excludedBy(area(["ext_trim"]), "siding_trim"), "ext_trim");
  eq("a trim-only area takes trim boards freely", excludedBy(area(["soffit_fascia"]), "ext_trim"), null);
  eq("nothing else is ruled out", excludedBy(area(["siding_trim"]), "soffit_fascia"), null);
  ok("junk substrates never throw", excludedBy({ substrates: [null, 3, { key: 5 }] }, "ext_trim") === null && excludedBy(null, "ext_trim") === null);
  {
    const html = paintHtml({ model: "area_substrate", estimateType: "exterior", areas: [area(["siding_trim"])] });
    ok("ticking Siding & trim disables Trim boards", html.includes('data-excluded-substrate="ext_trim"') && !html.includes('data-excluded-substrate="siding_trim"'));
    ok("...with a one-line explanation", html.includes('data-trim-exclusive="ext_trim"') && html.includes("already includes the trim"));
  }
  {
    const html = paintHtml({ model: "area_substrate", estimateType: "exterior", areas: [area(["ext_trim"])] });
    ok("ticking Trim boards disables Siding & trim", html.includes('data-excluded-substrate="siding_trim"') && html.includes('data-trim-exclusive="siding_trim"'));
  }
  {
    const html = paintHtml({ model: "area_substrate", estimateType: "exterior", areas: [area([])] });
    ok("with neither ticked, both are offered", !html.includes("data-excluded-substrate") && !html.includes("data-trim-exclusive"));
  }
  const paint = readFileSync(join(process.cwd(), "app/components/quotes/builder/PaintAreas.js"), "utf8");
  ok("the Add substrate list drops the excluded half too", /if \(area && excludedBy\(area, key\)\) return false;/.test(paint));
  // An area stored with BOTH keeps its price and says so.
  const both = STORED_BOTH_TRIMS.takeoff;
  ok("a stored area with both is recognised", trimCountedTwice(both.areas[0]) && !trimCountedTwice(area(["siding_trim"])));
  const html = paintHtml(both);
  ok("...and the builder warns on it", html.includes("data-trim-twice") && html.includes("may be priced twice"));
  const keys = both.areas[0].substrates.map((s) => s.key);
  ok("...without removing either row", keys.includes("siding_trim") && keys.includes("ext_trim"));
  const live = paintTakeoff(both, book);
  const lines = live.areas[0].lines.filter((l) => l.kind === "substrate");
  ok("...and still prices both rows (its price is kept, not repriced to one)", lines.length === 2 && lines.every((l) => l.amount > 0));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("6. drywall repairs are fixed-price items, not a room");
// ───────────────────────────────────────────────────────────────────────────
{
  const dbook = getPriceBook("drywall", null);
  ok("plain drywall has a live repair book", Boolean(dbook) && Array.isArray(dbook.items));
  const items = drywallRepairItems(dbook, "standard");
  const ids = items.map((i) => i.id);
  for (const id of ["small_patch", "medium_patch", "large_patch", "sheet_replace", "texture_match", "skim_coat", "popcorn_removal", "corner_repair", "nail_pops", "return_visit", "dust_containment", "furniture_moving"]) {
    ok(`repairs offer ${id}`, ids.includes(id));
  }
  // The researched defaults (standard tier; docs/research/PRICING-EXTERIOR-STAIN-DRYWALL-2026.md).
  const rate = (id) => items.find((i) => i.id === id)?.rate;
  eq("small patch $170", rate("small_patch"), 170);
  eq("medium patch $275", rate("medium_patch"), 275);
  eq("large patch $400", rate("large_patch"), 400);
  eq("sheet replacement $600 a sheet", rate("sheet_replace"), 600);
  eq("texture match $80 a patch", rate("texture_match"), 80);
  eq("call-out minimum $200", drywallCallOutMinimum(dbook, "standard"), 200);
  ok("tiers move the price", drywallRepairItems(dbook, "high").find((i) => i.id === "small_patch").rate > rate("small_patch"));
  // A pick is ONE line at a fixed price — quantity 1, amount = rate, no area.
  for (const item of items) {
    const line = drywallRepairLine(item, { language: "en" });
    ok(`${item.id}: one line, quantity 1, amount = the book's rate`, line && line.quantity === 1 && line.rate === item.rate && line.amount === item.rate && isDrywallRepairLine(line));
  }
  // Nothing about a room moves it.
  const small = drywallRepairItems(dbook).find((i) => i.id === "small_patch");
  eq("the same line whatever the room (no geometry in)", JSON.stringify(drywallRepairLine(small)), JSON.stringify(drywallRepairLine({ ...small, squareFootage: 900, lengthFt: 20 })));
  // The company's own price wins, and a zeroed item is not offered.
  const own = getPriceBook("drywall", { complexity: { standard: { smallPatchPrice: 199, mediumPatchPrice: 0 } } });
  eq("a company that edited a repair price keeps it", drywallRepairItems(own).find((i) => i.id === "small_patch").rate, 199);
  ok("a zeroed repair is not a button", !drywallRepairItems(own).some((i) => i.id === "medium_patch"));
  // The document's language.
  ok("lines are written in the document's language", /gypse/.test(drywallRepairLine(small, { language: "fr" }).description) && /yeso/.test(drywallRepairLine(small, { language: "es" }).description));
  ok("every repair item has words in every app language", Object.keys(APP_MESSAGES).every((l) => [...ids, "minimum"].every((id) => typeof repairItemText(id, l) === "string" && repairItemText(id, l).length > 3)));
  // The minimum: offered as the difference, never added silently.
  {
    const one = [drywallRepairLine(small)];
    const s = drywallRepairShortfall(one, 200);
    ok("one $170 patch is $30 under a $200 call-out", s.total === 170 && s.shortfall === 30);
    const top = drywallMinimumLine(s.shortfall);
    ok("...the top-up line is the difference", top.amount === 30 && isDrywallRepairLine(top));
    eq("...and once added, nothing is short", drywallRepairShortfall([...one, top], 200).shortfall, 0);
    eq("no repair lines, no shortfall", drywallRepairShortfall([{ description: "x", amount: 5 }], 200).shortfall, 0);
  }
  // It bills no board, so a drywall group opens as it did (its own rate line).
  const DW = { id: "cat-dw", key: "drywall", label: "Drywall", unit: "sqft", defaultRate: 3.25 };
  const g = newScopeGroup(DW, "Drywall", null, { tempId: "dw", fieldDefaults: true, language: "en" });
  ok("a new drywall group still opens on the company's own rate line", g.lineItems.length === 1 && g.lineItems[0].rate === 3.25);
  ok("drywall_install's hang + finish book is untouched", newScopeGroup({ id: "i", key: "drywall_install", label: "Drywall Installation" }, "Drywall Installation", null, { tempId: "di", fieldDefaults: true, language: "en", intakeValues: { squareFootage: 400 } }).lineItems.length === 2);
  // The builder draws the panel on a drywall group, in both layouts.
  for (const layout of ["classic", "document"]) {
    const html = builderWith([g], layout);
    if (layout === "classic") {
      ok("builder: a drywall group shows the Repairs panel", html.includes("data-drywall-repairs"));
      for (const id of ["small_patch", "medium_patch", "large_patch", "sheet_replace", "texture_match"]) ok(`builder: a ${id} button`, html.includes(`data-drywall-repair="${id}"`));
    }
    ok(`${layout}: drywall renders without NaN`, !html.includes("NaN"));
  }
  const builderSrc = readFileSync(join(process.cwd(), "app/components/quotes/builder/QuoteBuilder.js"), "utf8");
  ok("wiring: a repair pick appends the line to its group", /<DrywallRepairPicker[\s\S]{0,600}onAdd=\{\(line\) => addLibraryLine\(group\.tempId, line\)\}/.test(builderSrc));
  // Settings keeps the rate box for drywall beside the rate card.
  ok("drywall keeps its own rate box beside the repair book", keepsOwnRate("drywall") && !keepsOwnRate("drywall_install"));
  ok("wiring: Services shows the box when the book keeps the rate", /const priced = Boolean\(def\?\.hasPriceBook\) && !def\?\.keepsOwnRate;/.test(readFileSync(join(process.cwd(), "app/app/settings/services/ServicesEditor.js"), "utf8")));
}

// ───────────────────────────────────────────────────────────────────────────
console.log("7. painting walls are WALL area — no 'Floor area' label on wall pricing");
// ───────────────────────────────────────────────────────────────────────────
{
  const html = wrap(<TradeTakeoff categoryKey="interior_painting" takeoff={LEGACY_ROOMS} book={getPriceBook("interior_painting", null)} onChange={() => {}} />);
  ok("the legacy room calculator labels its wall box 'Wall area (sqft)'", html.includes("Wall area (sqft)"));
  ok("...and says 'Floor area' nowhere", !/floor area/i.test(html));
  // Every painting form in the builder: no "Floor area" box prices walls.
  const takeoffSrc = readFileSync(join(process.cwd(), "app/components/quotes/builder/TradeTakeoff.js"), "utf8");
  const paintRoom = takeoffSrc.slice(takeoffSrc.indexOf("function PaintRoom("), takeoffSrc.indexOf("function PaintRoom(") + 4000);
  ok("PaintRoom source: no 'Floor area' label or hint", paintRoom.length > 100 && !/label="Floor area/.test(paintRoom) && !/Enter the floor area/.test(paintRoom));
  ok("...the wall rate multiplies the wall box", /room\.walls && sqft > 0 \? sqft \* num\(c\.wallPricePerSqft\)/.test(paintRoom));
  for (const est of ["interior", "commercial"]) {
    const h = paintHtml({ model: "area_substrate", estimateType: est, areas: [newPaintArea(est === "commercial" ? "commercial_unit" : "living_room", book, { estimateType: est })] });
    ok(`${est}: walls read the Wall area figure, never Floor`, book.substrates.walls.driver === "wallSqft" && !/Floor area \(sqft\)/.test(h));
  }
  ok("ceilings are priced on ceiling area", book.substrates.ceiling.driver === "ceilingSqft");
}

// ───────────────────────────────────────────────────────────────────────────
console.log("8. researched defaults, the stain distinction, and existing quotes");
// ───────────────────────────────────────────────────────────────────────────
{
  const S = PAINT_SUBSTRATE_DEFAULTS;
  eq("exterior door: 1.5 h a side", S.ext_door.hoursPerUnit, 1.5);
  eq("window frame: 1 h each", S.ext_window_frame.hoursPerUnit, 1);
  eq("trim boards: 25 lf an hour", S.ext_trim.productionRate, 25);
  eq("shutters: 2 h a pair", S.shutters.hoursPerUnit, 2);
  ok("all four say they are market rates", ["ext_door", "ext_window_frame", "ext_trim", "shutters"].every((k) => S[k].provenance === "market"));
  // Prices those hours produce at the exterior $80/h, against the research.
  const one = (key, qty, extra = {}) => {
    const a = { ...newPaintArea("exterior", book, { estimateType: "exterior" }), measurement: "surface", ...extra };
    const row = { ...newPaintSubstrate(key, book, { estimateType: "exterior" }), ...(qty == null ? {} : { quantity: qty }) };
    return paintTakeoff({ model: "area_substrate", estimateType: "exterior", areas: [{ ...a, substrates: [row] }] }, book).total;
  };
  eq("a door, both sides: $265.85", one("ext_door", 2), 265.85);
  eq("a window frame: $87.75", one("ext_window_frame", 1), 87.75);
  eq("100 lf of trim boards: $350.77", one("ext_trim", null, { linearFt: 100 }), 350.77);
  eq("a pair of shutters: $167.38", one("shutters", 1), 167.38);
  // A company that edited one keeps it: the set merges key by key.
  const edited = getPriceBook("exterior_painting", { takeoff: { rateSets: { exterior: { rates: { ext_door: { hoursPerUnit: 0.75 } } } } } })?.takeoff;
  eq("a company's own exterior-door rate survives the new default", edited?.rateSets?.exterior?.rates?.ext_door?.hoursPerUnit, 0.75);
  // The stain distinction, additive on the refinishing calculator.
  ok("refinishing offers the stain finish", addOnsForCategory("cabinet_refinishing").some((a) => a.key === "stainFinish"));
  ok("refacing does not (a refaced door arrives finished)", !addOnsForCategory("cabinet_refacing").some((a) => a.key === "stainFinish"));
  eq("Staining → Cabinets opens with the stain finish ticked", JSON.stringify(routedAddOns(routeEstimateKind("staining", TF, "cabinets"))), '["stainFinish"]');
  eq("Cabinets & millwork (paint) opens with nothing ticked", JSON.stringify(routedAddOns(routeEstimateKind("cabinets", TF))), "[]");
  eq("Staining → Stairs ticks nothing", JSON.stringify(routedAddOns(routeEstimateKind("staining", TF, "stairs"))), "[]");
  {
    const cat = TF.find((c) => c.key === "cabinet_refinishing");
    const stained = newScopeGroup(cat, "Stained cabinets", null, { tempId: "s", intakeValues: { doorCount: 20, drawerCount: 8 }, addOns: ["stainFinish"] });
    const lines = cabinetAddOnLinesFor(stained);
    const line = lines.find((l) => /Stain finish/.test(l.description));
    ok("a stained kitchen carries the premium per piece: 28 × $45 = $1,260", line && line.quantity === 28 && line.rate === 45 && line.amount === 1260, lines);
    const painted = newScopeGroup(cat, "Painted cabinets", null, { tempId: "p", intakeValues: { doorCount: 20, drawerCount: 8 } });
    ok("a painted kitchen carries no stain line", !cabinetAddOnLinesFor(painted).some((l) => /Stain/.test(l.description)));
    // Since gel vs liquid (2026-10-03, check:stain-finish): the tick is
    // offered while EITHER stain type is priced — zeroing the liquid rate
    // leaves gel to sell; zeroing both takes the tick away.
    const zeroed = newScopeGroup(cat, "x", { addOns: { stainFinishPerUnit: 0, gelStainPerUnit: 0 } }, { tempId: "z", intakeValues: { doorCount: 20 }, addOns: ["stainFinish"] });
    ok("a company that zeroed both stain rates cannot tick it", !zeroed.stainFinish);
    const liquidOnlyZeroed = newScopeGroup(cat, "x", { addOns: { stainFinishPerUnit: 0 } }, { tempId: "z", intakeValues: { doorCount: 20 }, addOns: ["stainFinish"] });
    ok("…zeroing the liquid rate alone leaves gel to sell", liquidOnlyZeroed.stainFinish === true);
  }
  // Existing quotes, the second set, against origin/main f74dd7f9.
  const PINNED_MORE = {
    "drywall/live": "902e26ea4d4faaba63525a594ca3a96c",
    "drywall/stored": "509d2e2b077904ef3086e173e9206ba1",
    "drywall_install/live": "d4d47873750dac7e034f4b33fe74ca59",
    "drywall_install/stored": "3491a7120c1b2f9596dee2ebf0dc3957",
    "cabinet_refinishing_upgrades/live": "40945a44986c10f43ea38c6fd4708ceb",
    "cabinet_refinishing_upgrades/stored": "b34420805b3bb58534d433875ba130c3",
    "legacy_rooms/interior_painting": "3c6fb0e54e7a8b9c87b50367d6ec61da",
    "both_trims/stored": "4ec1f1e25e8068b33d2bb7a8573449c7",
  };
  const more = moreFixtureDigests({ paintTakeoff, getPriceBook, buildTradeLineItems, tradeSubtotal, scopeGroupPayload, groupSubtotal, newScopeGroup });
  eq("every second-set fixture is computed", Object.keys(more).sort().join(","), Object.keys(PINNED_MORE).sort().join(","));
  for (const [name, want] of Object.entries(PINNED_MORE)) eq(`byte-identical: ${name}`, more[name], want);
}
// Each new label exists in every catalogue language.
for (const key of [
  "app.paint.provMarket", "app.paint.countCalc", "app.paint.countHint", "app.paint.trimExclusive.trim", "app.paint.trimExclusive.siding", "app.paint.trimTwice",
  "app.drywallRepair.title", "app.drywallRepair.priceAt", "app.drywallRepair.tier.standard", "app.drywallRepair.tier.moderate", "app.drywallRepair.tier.high",
  "app.drywallRepair.hint", "app.drywallRepair.belowMinimum", "app.drywallRepair.addMinimum",
]) {
  for (const lang of Object.keys(APP_MESSAGES)) ok(`${lang} has ${key}`, typeof APP_MESSAGES[lang][key] === "string" && APP_MESSAGES[lang][key].length > 0);
}

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
