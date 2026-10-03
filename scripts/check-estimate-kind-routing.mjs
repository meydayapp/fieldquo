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
// Bundled through esbuild like check-doc-builder (the components are JSX).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  routeEstimateKind,
  stainingChoices,
  usesSurfaceCalculator,
  placeRoutedGroup,
  isUntouchedPaintGroup,
} from "../lib/quotes/estimateKindRouting.js";
import { newScopeGroup, scopeGroupPayload, groupSubtotal } from "../lib/quotes/builderPayload.js";
import { createTradeConfig, buildTradeLineItems, tradeSubtotal } from "../lib/pricing/tradeScope.js";
import {
  paintTakeoff,
  newPaintArea,
  newPaintSubstrate,
  rateSetFor,
  PAINT_TAKEOFF_DEFAULTS,
  PAINT_QUICK_PICKS,
} from "../lib/pricing/paintTakeoff.js";
import { getPriceBook } from "../app/data/tradePriceBooks.js";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { QuoteBuilderForm, initialStateFromQuote } from "../app/components/quotes/builder/QuoteBuilder.js";
import PaintAreas, { EstimateTypeCards } from "../app/components/quotes/builder/PaintAreas.js";
import TradeTakeoff from "../app/components/quotes/builder/TradeTakeoff.js";
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import { PermissionProvider } from "../app/providers/PermissionProvider.js";
import { fixtureDigests, PAINT_FIXTURES } from "./estimateKindFixtures.mjs";

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

console.log(`\n${pass} passed, ${fails.length} failed`);
if (fails.length) {
  for (const f of fails) console.log(`  ✗ ${f}`);
  process.exit(1);
}
