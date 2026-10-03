// scripts/check-room-presets.mjs
//
// Interior painting from a room picker, the way stairs prices from a step
// count: the homeowner names rooms and sizes, the SERVER assumes dimensions
// from the company's region and prices them from the company's own rates.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-room-presets.mjs
//
// What this proves, by running the shipped code:
//
//   1. The table is complete and cited. Every region has every room type
//      (basement may be "not offered" — with a cited reason), three sizes
//      that grow, a standard and a high ceiling, and every source id it
//      names exists in the source list (docs/research/ROOM-SIZES-2026.md).
//   2. Units follow the country. North America is feet; everywhere else the
//      sources are metric and so is the table. Every country the product
//      sells in maps to a region; no stated country is said so.
//   3. The browser sends no money and no size. resolveRoom reads keys only:
//      a posted length, wall area or rate changes nothing.
//   4. The public payload carries no rate — executed through
//      loadCompanyInstantTrades and the /measure route on the db stub.
//   5. The area maths IS the builder's: every preset's wall and ceiling area
//      equals areaGeometry() for the same dimensions, the draft's takeoff
//      reproduces it, and a walls-only room list prices to the cent what
//      typing the same wall area into the measured box prices.
//   6. The presets are labelled as assumptions wherever they land — the
//      estimate's assumptions and line details, the draft's takeoff notes,
//      the lead's row and the report — in every catalogue language.
//   7. The typed path did not move: an md5 over 672 typed estimates, 168
//      option lists, the costing seed, two stored quotes and the derived seed
//      equals the one recorded on the commit before this feature.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { register } from "node:module";
import { createHash } from "node:crypto";

// The /measure route imports next/server, which bare node cannot resolve —
// stubbed the way check-public-payload.mjs stubs it. @/lib/db is already the
// db stub (db-stub-loader on the command line).
register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") return { url: "fq-stub:next", shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:next")
    return { format: "module", shortCircuit: true, source: "export const NextResponse = { json: (body, init) => ({ status: init?.status ?? 200, body, json: async () => body }) };" };
  return nextLoad(url, context);
}`)}`,
);

const {
  ROOM_TYPES,
  ROOM_SIZES,
  CEILING_HEIGHTS,
  ROOM_REGIONS,
  ROOM_SOURCES,
  REGION_BY_COUNTRY,
  DEFAULT_ROOM_REGION,
  regionForCountry,
  unitSystemForRegion,
  roomTypesFor,
  resolveRoom,
  roomsFromIntake,
  roomGeometry,
  roomSummary,
  publicRoomPicker,
  M_PER_FT,
} = await import("@/lib/estimate/roomPresets");
const { areaGeometry } = await import("@/lib/pricing/paintTakeoff");
const { computeInstantEstimate, INSTANT_ESTIMATE_DEFAULTS } = await import("@/lib/estimate/instantEstimate");
const { priceOptionsFor } = await import("@/lib/estimate/instantQuoteReadiness");
const { costingInputsForInstantTrade } = await import("@/lib/estimate/instantQuoteCosting");
const { buildTradeLineItems } = await import("@/lib/pricing/tradeScope");
const { deriveInstantSeed, seedInputsFor, seedFields } = await import("@/lib/estimate/instantSeed");
const { measurementRows } = await import("@/lib/estimate/report/model");
const { ROOM_COPY, ROOM_COPY_LANGUAGES, roomCopy } = await import("@/lib/i18n/roomPresetCopy");
const { LANGUAGES } = await import("@/app/i18n/languages");
const { COUNTRIES } = await import("@/lib/currency");
const { loadCompanyInstantTrades, measureForTrade, priceAllMaterials } = await import("@/lib/estimate/instantQuoteServer");
const { rows, resetDbStub } = await import("@/lib/db");

const ROOT = join(import.meta.dirname, "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
  } else {
    fail++;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got).slice(0, 300)}` : ""}`);
  }
};
const section = (t) => console.log(`\n${t}`);
const near = (a, b, eps = 1e-9) => Math.abs(Number(a) - Number(b)) < eps;

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every region has every room type, with a cited source");
const REGIONS = Object.keys(ROOM_REGIONS);
ok("eight regions: north_america, uk, australia, germany, france, spain, italy, eu",
  ["north_america", "uk", "australia", "germany", "france", "spain", "italy", "eu"].every((r) => REGIONS.includes(r)), REGIONS);
for (const region of REGIONS) {
  const table = ROOM_REGIONS[region];
  ok(`${region}: unit is ft or m`, table.unit === "ft" || table.unit === "m", table.unit);
  const cites = (ids) => Array.isArray(ids) && ids.length > 0 && ids.every((id) => ROOM_SOURCES[id] && ROOM_SOURCES[id].url);
  ok(`${region}: ceiling heights standard < high, cited`,
    table.ceiling && table.ceiling.standard > 0 && table.ceiling.high > table.ceiling.standard && cites(table.ceiling.sources), table.ceiling);
  const [lo, hi] = table.unit === "ft" ? [7, 11] : [2.1, 3.6];
  ok(`${region}: ceiling heights are house-sized (${lo}–${hi} ${table.unit})`,
    table.ceiling.standard >= lo && table.ceiling.high <= hi, table.ceiling);
  for (const type of ROOM_TYPES) {
    const p = table.rooms[type];
    ok(`${region}/${type}: present`, Boolean(p));
    if (!p) continue;
    ok(`${region}/${type}: cites a source that exists`, cites(p.sources), p.sources);
    if (p.offered === false) {
      ok(`${region}/${type}: not offered, and says why`, typeof p.why === "string" && p.why.length > 10, p);
      ok(`${region}/${type}: only basement may be held back`, type === "basement", type);
      continue;
    }
    ok(`${region}/${type}: states what kind of figure it is`, typeof p.kind === "string" && p.kind.length > 0, p.kind);
    if (p.ceiling) {
      ok(`${region}/${type}: its own ceiling is house-sized and standard < high`,
        p.ceiling.standard >= lo && p.ceiling.high <= hi && p.ceiling.standard < p.ceiling.high, p.ceiling);
    }
    const [min, max] = table.unit === "ft" ? [3, 40] : [0.75, 12];
    let prev = 0;
    for (const size of ROOM_SIZES) {
      const pair = p[size];
      ok(`${region}/${type}/${size}: [length, width], length ≥ width, within ${min}–${max} ${table.unit}`,
        Array.isArray(pair) && pair.length === 2 && pair.every((n) => Number.isFinite(n) && n >= min && n <= max) && pair[0] >= pair[1], pair);
      const area = Array.isArray(pair) ? pair[0] * pair[1] : 0;
      ok(`${region}/${type}: ${size} is bigger than the size below it`, area > prev, { size, area, prev });
      prev = area;
    }
  }
}
for (const [id, s] of Object.entries(ROOM_SOURCES)) {
  ok(`source ${id} has a title, an https URL and an access date`, s.title && /^https?:\/\//.test(s.url) && s.accessed, s);
}
const doc = read("docs/research/ROOM-SIZES-2026.md");
for (const id of Object.keys(ROOM_SOURCES)) {
  ok(`source ${id} is written up in docs/research/ROOM-SIZES-2026.md`, doc.includes(ROOM_SOURCES[id].url), ROOM_SOURCES[id].url);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Units follow the country; the region is the company's, stated");
for (const [country, region] of Object.entries(REGION_BY_COUNTRY)) {
  const want = country === "US" || country === "CA" ? "imperial" : "metric";
  ok(`${country} → ${region} → ${want}`, unitSystemForRegion(region) === want && ROOM_REGIONS[region], { region, got: unitSystemForRegion(region) });
}
for (const c of COUNTRIES) {
  ok(`every country the product sells in maps to a region: ${c.code}`, regionForCountry(c.code).stated === true, regionForCountry(c.code));
}
ok("a lower-case or padded code still reads", regionForCountry(" gb ").region === "uk");
ok("no country → the default region, said to be unstated",
  regionForCountry(null).region === DEFAULT_ROOM_REGION && regionForCountry(null).stated === false);
ok("a code that is not a country is not believed", regionForCountry("__proto__").stated === false && regionForCountry("ZZ").stated === false);
for (const region of REGIONS) {
  const r = resolveRoom({ type: "bedroom" }, region);
  ok(`${region}: a room's dimensions are in the table's unit`, r.unit === ROOM_REGIONS[region].unit, r.unit);
  const toFt = r.unit === "ft" ? 1 : 1 / M_PER_FT;
  ok(`${region}: the feet are the stated size converted exactly`,
    near(r.lengthFt, Math.round(r.length * toFt * 100) / 100) && near(r.heightFt, Math.round(r.ceilingHeight * toFt * 100) / 100), r);
}
ok("basement is offered in North America", roomTypesFor("north_america").includes("basement"));

// ═══════════════════════════════════════════════════════════════════════════
section("3. The browser sends keys — never a size, never money");
{
  const clean = resolveRoom({ type: "bedroom", size: "large" }, "north_america");
  const forged = resolveRoom(
    { type: "bedroom", size: "large", lengthFt: 1000, widthFt: 1000, heightFt: 100, wallSqft: 1, ceilingSqft: 1, length: 1, rate: 999, ratePerSqft: 999, amount: 1, price: 1, sources: ["X"], assumed: false, region: "uk", unit: "m" },
    "north_america",
  );
  ok("a posted length, area, rate, region or unit changes nothing", JSON.stringify(clean) === JSON.stringify(forged), { clean, forged });
  ok("every resolved room is marked assumed", forged.assumed === true);
  ok("an unknown type is not a room", resolveRoom({ type: "garage" }, "uk") === null && resolveRoom({ type: "__proto__" }, "uk") === null);
  ok("garbage is not a room", [null, undefined, 7, "bedroom", [], [{ type: "bedroom" }]].every((x) => resolveRoom(x, "uk") === null));
  ok("an unknown size is medium, an unknown height standard",
    JSON.stringify(resolveRoom({ type: "kitchen", size: "huge", height: "sky" }, "uk")) === JSON.stringify(resolveRoom({ type: "kitchen" }, "uk")));
  ok("a room with nothing to paint is dropped", resolveRoom({ type: "kitchen", walls: false }, "uk") === null);
  ok("doors clamp to 0–10", resolveRoom({ type: "kitchen", doors: 999 }, "uk").doors === 10 && resolveRoom({ type: "kitchen", doors: -4 }, "uk").doors === 0);
  ok("a basement is not a room where the region does not offer one",
    REGIONS.filter((r) => ROOM_REGIONS[r].rooms.basement.offered === false).every((r) => resolveRoom({ type: "basement" }, r) === null));
  ok("a list is capped at 30 rooms", roomsFromIntake(Array.from({ length: 80 }, () => ({ type: "bedroom" })), "uk").length === 30);
  ok("an empty or hostile list is null", roomsFromIntake([], "uk") === null && roomsFromIntake("x", "uk") === null && roomsFromIntake([{}, null], "uk") === null);
  ok("an unknown region falls to the default table", resolveRoom({ type: "bedroom" }, "mars").region === DEFAULT_ROOM_REGION);

  const picker = read("app/instant-quote/[companySlug]/RoomPicker.js");
  const body = picker.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  ok("the picker's room holds keys only — type, size, height, the ticks, a door count",
    /return \{ type, size: "medium", height: "standard", walls: true, ceiling: false, trim: false, doors: 0 \};/.test(body));
  ok("the picker never mentions a rate, a price or an amount", !/\b(rate|price|amount|cents|ratePerSqft)\b/i.test(body));
  const flow = read("app/instant-quote/[companySlug]/InstantQuoteFlow.js");
  ok("both requests post the intake through postedIntake", (flow.match(/intake: postedIntake\(trade, intake\)/g) || []).length === 2);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The public payload and /measure carry no rate");
const RATE_SHAPED = /ratePerSqft|scopeSurcharge|conditionSurcharge|minCharge|rangeBandPct|budgetThresholds|ceilingPerRoom|trimPerRoom|doorEach|"rate"/;
const company = {
  id: "c1", slug: "acme", name: "Acme Painting", logoUrl: null, brandColor: "#123456",
  defaultLanguage: "en", currency: "GBP", bookingModes: [], bookingSlug: null, eventTypes: [],
  financing: null, country: "GB", address: "1 High St, Leeds", province: null,
};
const paintingRow = {
  companyId: "c1", trade: "painting", enabled: true,
  config: { ...INSTANT_ESTIMATE_DEFAULTS.painting, estimateVisibility: "range" },
};
const service = (key) => ({ companyId: "c1", enabled: true, rates: null, category: { key } });
function seedDb(keys, co = company) {
  resetDbStub();
  rows.company = [co];
  rows.instantQuoteConfig = [paintingRow];
  rows.companyServiceCategory = keys.map(service);
}
{
  seedDb(["interior_painting", "exterior_painting"]);
  const data = await loadCompanyInstantTrades("acme");
  const painting = data.trades.find((t) => t.trade === "painting");
  ok("interior sold: the payload offers the room picker", Boolean(painting?.rooms), painting);
  ok("...for the company's own region (GB → uk, metric)", painting?.rooms?.region === "uk" && painting.rooms.unit === "m" && painting.rooms.unitSystem === "metric", painting?.rooms);
  ok("...and carries no rate", !RATE_SHAPED.test(JSON.stringify(data.trades)), JSON.stringify(painting).slice(0, 300));
  ok("...the payload's sizes are the table's", JSON.stringify(painting.rooms) === JSON.stringify(publicRoomPicker("uk")));

  seedDb(["exterior_painting"]);
  const ext = (await loadCompanyInstantTrades("acme")).trades.find((t) => t.trade === "painting");
  ok("exterior only: no room picker on the page", ext && !("rooms" in ext), ext);

  seedDb(["interior_painting"], { ...company, country: null, address: "12 Elm St, Ottawa, ON K1A 0B1, Canada" });
  const ca = (await loadCompanyInstantTrades("acme")).trades.find((t) => t.trade === "painting");
  ok("a company whose country is only in its address reads as Canada → feet", ca?.rooms?.region === "north_america" && ca.rooms.unit === "ft", ca?.rooms);

  // /measure, executed.
  seedDb(["interior_painting", "exterior_painting"]);
  const { POST } = await import("@/app/api/instant-quote/[companySlug]/measure/route");
  const req = (body) => ({ json: async () => body });
  const res = await POST(
    req({
      trade: "painting",
      language: "en",
      intake: {
        mode: "rooms",
        rooms: [{ type: "living", size: "large", ceiling: true, doors: 2, lengthFt: 999, rate: 1 }, { type: "bedroom" }],
      },
    }),
    { params: Promise.resolve({ companySlug: "acme" }) },
  );
  const body = res.body;
  ok("/measure prices the rooms", res.status === 200 && Array.isArray(body.options) && body.options.length > 0, body);
  ok("/measure returns the rooms it assumed, marked assumed", Array.isArray(body.measurement?.rooms) && body.measurement.rooms.every((r) => r.assumed === true));
  ok("/measure ignored the posted length", body.measurement.rooms[0].lengthFt === resolveRoom({ type: "living", size: "large" }, "uk").lengthFt);
  ok("/measure returns no rate and no breakdown", !RATE_SHAPED.test(JSON.stringify(body)) && !/breakdown/.test(JSON.stringify(body)), JSON.stringify(body).slice(0, 400));
  ok("/measure options carry only a range", body.options.every((o) => Object.keys(o).every((k) => ["materialKey", "label", "low", "high", "unit", "minimumApplied"].includes(k))), body.options);

  const empty = await POST(req({ trade: "painting", language: "fr", intake: { mode: "rooms", rooms: [], squareFootage: 400 } }), { params: Promise.resolve({ companySlug: "acme" }) });
  ok("an empty picker is refused, not priced off a hidden surface box", empty.status === 422 && empty.body.reason === "no_rooms", empty);
  ok("...in the form's language", empty.body.error === roomCopy("fr").noRooms, empty.body.error);
  const measured = await POST(req({ trade: "painting", language: "en", intake: { mode: "measured", rooms: [{ type: "living" }], squareFootage: 400 } }), { params: Promise.resolve({ companySlug: "acme" }) });
  ok("'I know my measurements' prices the typed box and ignores the rooms", measured.status === 200 && measured.body.measurement.areaSqft === 400 && !measured.body.measurement.rooms, measured.body);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The area maths is the builder's areaGeometry");
let presets = 0;
for (const region of REGIONS) {
  for (const type of roomTypesFor(region)) {
    for (const size of ROOM_SIZES) {
      for (const height of CEILING_HEIGHTS) {
        const r = resolveRoom({ type, size, height, ceiling: true }, region);
        const g = areaGeometry({ measurement: "area", lengthFt: r.lengthFt, widthFt: r.widthFt, heightFt: r.heightFt });
        const mine = roomGeometry(r);
        presets += 1;
        if (!(near(mine.wallSqft, g.wallSqft) && near(mine.ceilingSqft, g.ceilingSqft) && near(r.wallSqft, g.wallSqft) && near(r.ceilingSqft, g.ceilingSqft))) {
          ok(`${region}/${type}/${size}/${height}: wall and ceiling area equal areaGeometry`, false, { mine, g, r });
        }
        if (!near(g.wallSqft, Math.round(2 * (r.lengthFt + r.widthFt) * r.heightFt * 100) / 100, 0.011)) {
          ok(`${region}/${type}/${size}/${height}: gross 2 × (L + W) × H, openings not deducted`, false, g);
        }
      }
    }
  }
}
ok(`all ${presets} preset × height combinations match areaGeometry`, presets > 300, presets);
{
  // The draft's takeoff reproduces the same areas through the same engine.
  const rooms = roomsFromIntake(
    [{ type: "living", size: "large", ceiling: true }, { type: "stairwell", height: "high" }, { type: "bedroom", trim: true, doors: 1 }],
    "north_america",
  );
  const { takeoff } = costingInputsForInstantTrade("painting", "standard", { rooms, roomRegion: "north_america", roomRegionStated: true });
  ok("the takeoff is the area/substrate model, interior", takeoff?.model === "area_substrate" && takeoff.estimateType === "interior");
  ok("one builder area per room, measured as a Room (4 walls)", takeoff.areas.length === 3 && takeoff.areas.every((a) => a.measurement === "area"));
  ok("each area's geometry is the room's", takeoff.areas.every((a, i) => near(areaGeometry(a).wallSqft, rooms[i].wallSqft)));
  ok("the stairwell's wall is the two-storey substrate, at its full area",
    takeoff.areas[1].substrates[0].key === "wall_two_storey" && near(takeoff.areas[1].substrates[0].quantity, rooms[1].wallSqft));
  ok("ceiling, trim (baseboard) and a door side follow the ticks",
    takeoff.areas[0].substrates.some((s) => s.key === "ceiling") && takeoff.areas[2].substrates.some((s) => s.key === "baseboard") && takeoff.areas[2].substrates.some((s) => s.key === "door" && s.quantity === 1));
  const lines = buildTradeLineItems("interior_painting", takeoff, null);
  ok("the builder prices the takeoff (the cost side opens with real hours)", lines.length > 0 && lines.every((l) => Number.isFinite(l.amount ?? l.rate)), lines.slice(0, 2));

  // The stairwell is priced on WALL area too (owner, 2026-10-03: walls by wall
  // area, never floor) — two storeys of it: 14 × 3 ft footprint, 2 × 8 ft high.
  {
    const sw = roomsFromIntake([{ type: "stairwell" }], "north_america")[0];
    const swCfg = { ...INSTANT_ESTIMATE_DEFAULTS.painting, enabled: true, minCharge: 0 };
    const swEst = computeInstantEstimate({ trade: "painting", measurements: { rooms: [sw], scope: "interior" }, materialKey: "standard", config: swCfg });
    ok("a stairwell's wall is two storeys high (16 ft) and 2 × (14 + 3) × 16 = 544 sq ft", sw.heightFt === 16 && sw.wallSqft === 544, sw);
    ok("...priced as that wall area × the $/sqft, not the 42 sq ft floor",
      near(swEst.point, Math.round((544 * swCfg.materials[0].ratePerSqft) / 10) * 10) && /\(544 sq ft\)/.test(swEst.breakdown[0].label), swEst);
  }

  // Walls only: the picker prices exactly as typing its wall area.
  const cfg = { ...INSTANT_ESTIMATE_DEFAULTS.painting, enabled: true };
  for (const region of REGIONS) {
    const list = roomsFromIntake([{ type: "living" }, { type: "kitchen", size: "small" }, { type: "bedroom", size: "large", height: "high" }], region);
    const wall = list.reduce((s, r) => s + roomGeometry(r).wallSqft, 0);
    for (const surfaceCondition of ["good", "fair", "poor"]) {
      const viaRooms = computeInstantEstimate({ trade: "painting", measurements: { rooms: list, scope: "interior", surfaceCondition }, materialKey: "standard", config: cfg });
      const viaBox = computeInstantEstimate({ trade: "painting", measurements: { areaSqft: wall, scope: "interior", surfaceCondition }, materialKey: "standard", config: cfg });
      ok(`${region}, ${surfaceCondition}: three rooms price as their ${Math.round(wall)} sq ft of wall typed in`,
        viaRooms.ok && viaRooms.low === viaBox.low && viaRooms.point === viaBox.point && viaRooms.high === viaBox.high, { viaRooms: [viaRooms.low, viaRooms.point, viaRooms.high], viaBox: [viaBox.low, viaBox.point, viaBox.high] });
      ok(`${region}, ${surfaceCondition}: the lines add up to the point`,
        Math.abs(viaRooms.breakdown.reduce((s, b) => s + b.amount, 0) - viaRooms.point) < 0.005, viaRooms.breakdown);
    }
  }
  // Ceilings, trim and doors price at the company's own per-room / per-door rates.
  const d = deriveInstantSeed("painting", seedInputsFor("painting", [
    { key: "interior_painting", rates: { complexity: { standard: { ceilingPrice: 190, trimPrice: 160, doorPrice: 50 } } } },
  ]));
  ok("the seed carries the company's ceiling, trim and door prices", d.ceilingPerRoom === 190 && d.trimPerRoom === 160 && d.doorEach === 50, d);
  ok("...and the settings screen lists all three as read-only rates", ["ceilingPerRoom", "trimPerRoom", "doorEach"].every((p) => seedFields("painting").some((f) => f.path === p && f.kind === "money")));
  const zeroed = deriveInstantSeed("painting", seedInputsFor("painting", [
    { key: "interior_painting", rates: { complexity: { standard: { ceilingPrice: 0 } } } },
  ]));
  ok("a ceiling price zeroed under Services derives as 0 (so it overwrites a saved row)", zeroed.ceilingPerRoom === 0, zeroed);
  ok("exterior only: no room rates at all", !("ceilingPerRoom" in deriveInstantSeed("painting", seedInputsFor("painting", [{ key: "exterior_painting", rates: null }]))));
  const c2 = { ...cfg, ...d };
  const one = roomsFromIntake([{ type: "living", ceiling: true, trim: true, doors: 2 }], "north_america");
  const est = computeInstantEstimate({ trade: "painting", measurements: { rooms: one, scope: "interior", surfaceCondition: "good" }, materialKey: "standard", config: c2 });
  const wallAmt = one[0].wallSqft * c2.materials[0].ratePerSqft;
  ok("walls + $190 ceiling + $160 trim + 2 × $50 doors", near(est.point, Math.round(Math.max(wallAmt + 190 + 160 + 100, c2.minCharge) / 10) * 10), { point: est.point, wallAmt });
  ok("the range is a range", est.low < est.point && est.point < est.high);
  const noCeil = computeInstantEstimate({ trade: "painting", measurements: { rooms: one, scope: "interior" }, materialKey: "standard", config: { ...c2, ceilingPerRoom: 0 } });
  ok("a zeroed ceiling rate leaves the ceiling out and SAYS so",
    !noCeil.breakdown.some((b) => /Ceiling/.test(b.label)) && noCeil.assumptions.some((a) => a === roomCopy("en").notPriced("Ceiling")), noCeil.assumptions);
  const fairBox = computeInstantEstimate({ trade: "painting", measurements: { rooms: one, scope: "interior", surfaceCondition: "poor" }, materialKey: "standard", config: c2 });
  ok("the condition surcharge applies to the walls only", near(fairBox.point - est.point, Math.round((wallAmt * c2.conditionSurcharge.poor) / 10) * 10, 10.0001), { diff: fairBox.point - est.point });
  ok("rooms under an exterior scope are refused, not priced as exterior",
    computeInstantEstimate({ trade: "painting", measurements: { rooms: one, scope: "exterior" }, materialKey: "standard", config: c2 }).reason === "rooms_interior_only");
  ok("hostile saved dimensions are not priced",
    computeInstantEstimate({ trade: "painting", measurements: { rooms: [{ ...one[0], lengthFt: "1e400" }, { ...one[0], heightFt: -3 }, null] }, materialKey: "standard", config: c2 }).reason === "no_measurement");
  ok("a metric room's line is in m² at the same price",
    (() => {
      const uk = roomsFromIntake([{ type: "bedroom" }], "uk");
      const e = computeInstantEstimate({ trade: "painting", measurements: { rooms: uk }, materialKey: "standard", config: c2, language: "en" });
      const line = e.breakdown[0].line;
      return line.unit === "m²" && Math.abs(line.quantity * line.rate - uk[0].wallSqft * c2.materials[0].ratePerSqft) < 2;
    })());
  // priceAllMaterials over the db stub — what /measure and the report re-price with.
  seedDb(["interior_painting"]);
  const all = await priceAllMaterials({ companyId: "c1", trade: "painting", measurement: { rooms: one, scope: "interior" } });
  ok("the server pricer prices a room list", all.ok && all.options.length > 0, all);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Every place a preset lands, it says it is typical and unmeasured");
const cfg6 = { ...INSTANT_ESTIMATE_DEFAULTS.painting, enabled: true };
for (const lang of ROOM_COPY_LANGUAGES) {
  const t = roomCopy(lang);
  const list = roomsFromIntake([{ type: "living", ceiling: true }, { type: "bedroom" }, { type: "bedroom", trim: true, doors: 1 }], "france");
  const est = computeInstantEstimate({ trade: "painting", measurements: { rooms: list, scope: "interior" }, materialKey: "standard", config: cfg6, language: lang });
  ok(`${lang}: the estimate's first assumption says the sizes are typical, not measured`, est.assumptions[0] === t.assumption(t.regions.france), est.assumptions);
  ok(`${lang}: every room line carries the 'confirm on site' detail`,
    est.breakdown.filter((b) => b.line).every((b) => b.line.detail && b.line.detail.includes(t.typical.split(",")[0])), est.breakdown.map((b) => b.line?.detail));
  ok(`${lang}: a second room of a type is numbered`, est.breakdown.some((b) => b.label.startsWith(`${t.rooms.bedroom} 2`)), est.breakdown.map((b) => b.label));
  ok(`${lang}: the lead's row marks the size as typical`, list.every((r) => roomSummary(r, lang).includes(t.roomRow("", "").split("—").pop().trim())), roomSummary(list[0], lang));
  const rowsFor = measurementRows("painting", { rooms: list }, lang);
  ok(`${lang}: the report prints a row per room and the wall area, each marked typical`,
    rowsFor.filter((r) => r.value.includes(t.typical) || r.value.includes(t.roomRow("", "").split("—").pop().trim())).length >= 4, rowsFor);
}
{
  const list = roomsFromIntake([{ type: "kitchen" }], "germany");
  const { takeoff } = costingInputsForInstantTrade("painting", "standard", { rooms: list, roomRegion: "germany", roomRegionStated: false });
  ok("the draft's takeoff note says assumed, not measured, confirm on site", /assumed, not measured\. Confirm on site\./.test(takeoff.areas[0].crewNote), takeoff.areas[0].crewNote);
  ok("...names the region and the dimensions", /Germany/.test(takeoff.areas[0].crewNote) && /× .* m/.test(takeoff.areas[0].crewNote), takeoff.areas[0].crewNote);
  ok("...and says when the company's country was not set", /company country not set/.test(takeoff.areas[0].crewNote));
  ok("...and the takeoff as a whole says so", /typical dimensions, not measured/.test(takeoff.notes));
  const route = read("app/api/instant-quote/[companySlug]/request/route.js");
  ok("the draft's stored measurement keeps the rooms (sanitiseMeasurement)", /rooms: Array\.isArray\(m\.rooms\) \? m\.rooms : null/.test(route));
  ok("...the region and whether it was stated", /roomRegion: m\.roomRegion/.test(route) && /roomRegionStated: m\.roomRegionStated/.test(route));
  ok("the lead carries the rooms, from the PRICED measurement", /rooms: pricedMeasurement\.rooms\.map\(\(r\) => roomSummary\(r, language\)\)/.test(route));
  ok("...and not the posted list or the mode switch", /if \(k === "mode" \|\| k === "rooms"\) continue;/.test(route));
}

section("Copy: all nine catalogue languages, key for key");
{
  const keysOf = (o, p = "") =>
    Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" && !Array.isArray(v) ? keysOf(v, `${p}${k}.`) : [`${p}${k}`]));
  const en = keysOf(ROOM_COPY.en).sort().join(",");
  const catalogue = LANGUAGES.map((l) => l.code);
  for (const code of ["en", "fr", "es", "it", "de", "uk", "pa", "tl", "zh"]) {
    ok(`${code}: has a room-picker table`, Boolean(ROOM_COPY[code]));
    if (!ROOM_COPY[code]) continue;
    ok(`${code}: every key English has`, keysOf(ROOM_COPY[code]).sort().join(",") === en, code);
    ok(`${code}: every room type and region named`, ROOM_TYPES.every((r) => ROOM_COPY[code].rooms[r]) && REGIONS.every((r) => ROOM_COPY[code].regions[r]));
    ok(`${code}: functions return text`, typeof ROOM_COPY[code].hint("X") === "string" && typeof ROOM_COPY[code].roomRow("a", "b") === "string" && typeof ROOM_COPY[code].roomsCount(3) === "string");
  }
  ok("every document language the product offers has the picker's words", catalogue.every((c) => ROOM_COPY_LANGUAGES.includes(c)), catalogue);
  ok("non-English tables are not English copied across", ROOM_COPY_LANGUAGES.filter((c) => c !== "en").every((c) => ROOM_COPY[c].typical !== ROOM_COPY.en.typical));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The typed path and stored quotes did not move (md5 against the commit before)");
{
  const BEFORE = "db55e9e53070a7be309c47d1fd4ac1e7"; // e7481ff9, before the room picker
  const pickKeys = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));
  const DEF = INSTANT_ESTIMATE_DEFAULTS.painting;
  const configs = {
    seed: { ...pickKeys(DEF, ["materials", "scopeSurcharge", "conditionSurcharge", "rangeBandPct", "minCharge"]), enabled: true },
    grades: {
      materials: [
        { key: "economy", label: "Economy", ratePerSqft: 2 },
        { key: "standard", label: "Standard", ratePerSqft: 2.75 },
        { key: "premium", label: "Premium", ratePerSqft: 3.75 },
      ],
      scopeSurcharge: { interior: 0, exterior: 0.3 },
      conditionSurcharge: { good: 0, fair: 0.15, poor: 0.3 },
      rangeBandPct: 0.15,
      minCharge: 400,
      enabled: true,
    },
  };
  const out = { estimates: [], options: [], costing: [], quotes: [], seed: null };
  for (const [cname, config] of Object.entries(configs)) {
    for (const areaSqft of [1, 50, 120, 300, 452, 1000, 2500.5]) {
      for (const scope of [undefined, "interior", "exterior"]) {
        for (const surfaceCondition of [undefined, "good", "fair", "poor"]) {
          for (const materialKey of [undefined, "standard", "premium", "nope"]) {
            const measurements = { areaSqft, scope, surfaceCondition };
            out.estimates.push([cname, areaSqft, scope, surfaceCondition, materialKey,
              computeInstantEstimate({ trade: "painting", measurements, materialKey, config })]);
          }
          out.options.push([cname, areaSqft, scope, surfaceCondition,
            priceOptionsFor({ trade: "painting", config, measurement: { areaSqft, scope, surfaceCondition } })]);
          out.costing.push([areaSqft, scope, surfaceCondition,
            costingInputsForInstantTrade("painting", "standard", { areaSqft, scope, surfaceCondition }, { categoryKey: scope === "exterior" ? "exterior_painting" : "interior_painting" })]);
        }
      }
    }
  }
  const legacy = {
    rooms: [
      { title: "Living", sqft: 300, walls: true, ceiling: true, trim: true, doors: true, doorsCount: 2, closets: true, closetsCount: 1, colorChange: true, drywallPrep: false, complexityLevel: "standard" },
      { title: "Bed", sqft: 150, walls: true, ceiling: false, trim: true, doors: true, doorsCount: 1, complexityLevel: "moderate" },
    ],
    popcornRemoval: true, popcornSqft: 120, furnitureMoving: true,
  };
  const sub = (key, quantity, driver) => ({ key, coats: 2, prepHours: 0, quantity, driver, productKey: null, noProduct: false, optional: false, showFormula: false, roundGallonsUp: null });
  const area = {
    model: "area_substrate", estimateType: "interior",
    areas: [{ areaType: "den", label: "Den", surface: "interior", measurement: "area", lengthFt: 10, widthFt: 13, heightFt: 9, linearFt: 0, surfaceSqft: 0, prepHours: 0, optional: false, roundGallonsUp: null, crewNote: "", clientNote: "",
      substrates: [sub("walls", null, "wallSqft"), sub("ceiling", null, "ceilingSqft"), sub("door", 3, null)] }],
  };
  out.quotes.push(buildTradeLineItems("interior_painting", legacy, null));
  out.quotes.push(buildTradeLineItems("interior_painting", area, null));
  const d = deriveInstantSeed("painting", seedInputsFor("painting", [{ key: "interior_painting", rates: null }, { key: "exterior_painting", rates: null }]));
  out.seed = pickKeys(d, ["materials", "scopeSurcharge", "conditionSurcharge"]);
  const md5 = createHash("md5").update(JSON.stringify(out)).digest("hex");
  ok(`672 typed estimates, 168 option lists, the costing, two stored quotes and the seed: md5 ${md5} = ${BEFORE}`, md5 === BEFORE, md5);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILED"} — ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
