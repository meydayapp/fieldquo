// scripts/check-roofing-example-live.mjs
//
// Part four of check:roofing-example: the showcase's "use a real address"
// path — POST /api/showcase/roof-measure and the fixture it turns into.
//
//   node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//        scripts/check-roofing-example-live.mjs
//
// ══ No live Google, no live database ══════════════════════════════════════
//
// Google is a stubbed global fetch that answers geocode and buildingInsights
// from fixtures here and records every URL, so the check can COUNT the calls
// a try costs. The store is the shipped one (showcase/liveStore.js) over
// PGlite — an in-process Postgres — so the reservation SQL that enforces the
// cap runs for real, on a throwaway in-memory database. PGlite is not a
// direct dependency; without it the store sections say they were skipped
// and the rest still runs against an in-memory stand-in.
//
// What it proves, each against the handler the route mounts:
//   success, cache hit, no Solar data, outside Canada/US (both the picker's
//   word and the geocode's), geocode failure, the burst limit, the per-
//   visitor and global daily caps (exact under concurrency), bad origin —
//   and that no response carries the server key or a price, and that the
//   showcase priced on a measured house is what priceAllMaterials /
//   priceOneMaterial give for that measurement.

import { readFileSync } from "node:fs";
import { rows, resetDbStub } from "@/lib/db";
import { measureRoof } from "@/lib/measure/roofMeasurement";
import { priceAllMaterials, priceOneMaterial } from "@/lib/estimate/instantQuoteServer";
import { primaryCategoryForInstantTrade } from "@/lib/trades/catalog";
import { resolveDocumentTax } from "@/lib/tax/documentTax";
import { buildRoofingShowcase, SHOWCASE_COMPANY } from "@/app/(marketing)/industries/[slug]/showcase/buildRoofingShowcase.js";
import {
  createShowcaseMeasureHandler,
  normaliseAddress,
  cacheKeyFor,
  dailyCap,
  visitorTag,
  DEFAULT_DAILY_CAP,
  PER_VISITOR_PER_DAY,
} from "@/app/(marketing)/industries/[slug]/showcase/liveMeasure.js";
import { platformSettingStore, RESERVE_SQL } from "@/app/(marketing)/industries/[slug]/showcase/liveStore.js";
import { fixtureForHouse, fixtureWithSquares, cleanSquares, MANUAL_SQUARES } from "@/app/(marketing)/industries/[slug]/showcase/houseFixture.js";
import { runRequest, defaultBody, measurementFor } from "@/app/(marketing)/industries/[slug]/showcase/roofingRun.js";
import { industryShowcaseFor } from "@/app/i18n/industries";

let pass = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    fails.push(name);
    console.log(`  FAIL ${name}${detail !== undefined ? `\n       ${String(JSON.stringify(detail)).slice(0, 600)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}`);

/* ═════════════════ Google, stubbed ═══════════════════════════════════════ */

const SERVER_KEY = "SERVER-KEY-MUST-NOT-LEAK";
const PUBLIC_KEY = "public-browser-key";
process.env.GOOGLE_MAPS_SERVER_KEY = SERVER_KEY;
process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY = PUBLIC_KEY;

// A 2,412.5 sq ft, 8/12 roof (the sample's harness roof) centred on the pin.
const SQFT_PER_M2 = 10.7639104;
const deg8 = (Math.atan(8 / 12) * 180) / Math.PI;
function insightsAt(lat, lng, { areaSqft = 2412.5, pitch = deg8 } = {}) {
  const m2 = areaSqft / SQFT_PER_M2;
  const ground = m2 * Math.cos((pitch * Math.PI) / 180);
  const d = 0.0001;
  return {
    center: { latitude: lat, longitude: lng },
    imageryDate: { year: 2024, month: 6, day: 3 },
    imageryQuality: "HIGH",
    boundingBox: { sw: { latitude: lat - d, longitude: lng - d }, ne: { latitude: lat + d, longitude: lng + d } },
    solarPotential: {
      wholeRoofStats: { areaMeters2: m2, groundAreaMeters2: ground },
      roofSegmentStats: [0, 90, 180, 270].map((az) => ({
        pitchDegrees: pitch,
        azimuthDegrees: az,
        stats: { areaMeters2: m2 / 4, groundAreaMeters2: ground / 4 },
      })),
    },
  };
}

// address -> { formatted, lat, lng, solar: "roof" | "none" }
const WORLD = {
  "742 Maple Ave, Kingston, ON": { formatted: "742 Maple Ave, Kingston, ON K7L 1A1, Canada", lat: 44.23, lng: -76.48, solar: "roof" },
  "1200 Oak St, Austin, TX": { formatted: "1200 Oak St, Austin, TX 78701, USA", lat: 30.27, lng: -97.74, solar: "roof" },
  "9 Lonely Rd, Nowhere, SK": { formatted: "9 Lonely Rd, Nowhere, SK S0K 0A0, Canada", lat: 52.1, lng: -106.6, solar: "none" },
  "10 High St, Oxford": { formatted: "10 High St, Oxford OX1 4DB, UK", lat: 51.75, lng: -1.25, solar: "roof" },
};
const calls = [];
globalThis.fetch = async (input) => {
  const url = String(input);
  calls.push(url);
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  if (url.startsWith("https://maps.googleapis.com/maps/api/geocode/json")) {
    const address = decodeURIComponent(new URL(url).searchParams.get("address") || "");
    const hit = WORLD[address];
    if (!hit) return json(200, { status: "ZERO_RESULTS", results: [] });
    return json(200, { status: "OK", results: [{ formatted_address: hit.formatted, geometry: { location: { lat: hit.lat, lng: hit.lng }, location_type: "ROOFTOP" } }] });
  }
  if (url.startsWith("https://solar.googleapis.com/v1/buildingInsights:findClosest")) {
    const p = new URL(url).searchParams;
    const lat = Number(p.get("location.latitude"));
    const lng = Number(p.get("location.longitude"));
    const hit = Object.values(WORLD).find((w) => Math.abs(w.lat - lat) < 0.01 && Math.abs(w.lng - lng) < 0.01);
    if (!hit || hit.solar === "none") return json(404, { error: { code: 404, status: "NOT_FOUND" } });
    return json(200, insightsAt(hit.lat, hit.lng));
  }
  throw new Error(`unexpected fetch in a check: ${url}`);
};
const googleCalls = (since) => calls.slice(since).filter((u) => /googleapis\.com/.test(u));

/* ═════════════════ The store: shipped SQL on PGlite, or a stand-in ═══════ */

let PGlite = null;
try {
  ({ PGlite } = await import("@electric-sql/pglite"));
} catch {
  PGlite = null;
}

// Every PGlite opened here, closed at the end: an unclosed one ends the
// process with exit code 99 even when every assertion passed.
const openDatabases = [];

/** A Prisma-shaped client over PGlite, for the three calls liveStore makes. */
async function pgliteDb() {
  const pg = new PGlite();
  openDatabases.push(pg);
  await pg.exec(`CREATE TABLE "PlatformSetting" ("key" TEXT PRIMARY KEY, "value" JSONB NOT NULL, "updatedAt" TIMESTAMP(3) NOT NULL);`);
  return {
    pg,
    platformSetting: {
      async findUnique({ where: { key } }) {
        const r = await pg.query(`SELECT "key", "value" FROM "PlatformSetting" WHERE "key" = $1`, [key]);
        return r.rows[0] || null;
      },
      async upsert({ where: { key }, create, update }) {
        await pg.query(
          `INSERT INTO "PlatformSetting" ("key","value","updatedAt") VALUES ($1,$2,NOW()) ON CONFLICT ("key") DO UPDATE SET "value" = $3, "updatedAt" = NOW()`,
          [key, JSON.stringify(create.value), JSON.stringify(update.value)],
        );
      },
    },
    async $queryRawUnsafe(sql, ...params) {
      return (await pg.query(sql, params)).rows;
    },
  };
}

/** The same contract in memory — only when PGlite is not installed. */
function memoryStore() {
  const kv = new Map();
  return {
    kv,
    async readCache(key) {
      return kv.get(key) ?? null;
    },
    async writeCache(key, value) {
      kv.set(key, value);
    },
    async reserve({ dayKey, visitor, cap, perVisitor }) {
      if (!(cap >= 1)) return { ok: false, why: "cap" };
      const day = kv.get(dayKey) || { count: 0, visitors: {} };
      if (day.count >= cap) return { ok: false, why: "cap" };
      if ((day.visitors[visitor] || 0) >= perVisitor) return { ok: false, why: "visitor" };
      day.count += 1;
      day.visitors[visitor] = (day.visitors[visitor] || 0) + 1;
      kv.set(dayKey, day);
      return { ok: true, count: day.count };
    },
  };
}

async function freshStore() {
  if (PGlite) {
    const db = await pgliteDb();
    return { store: platformSettingStore(db), db, real: true };
  }
  return { store: memoryStore(), db: null, real: false };
}

/* ═════════════════ Requests ══════════════════════════════════════════════ */

const HOST = "fieldquo.test";
function req(body, { ip = "203.0.113.7", origin = `https://${HOST}`, referer = `https://${HOST}/industries/roofing`, host = HOST } = {}) {
  const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": ip, host });
  if (origin) headers.set("origin", origin);
  if (referer) headers.set("referer", referer);
  return new Request(`https://${HOST}/api/showcase/roof-measure`, { method: "POST", headers, body: JSON.stringify(body) });
}
// Each handler gets its own burst limiter so one section's ten-second window
// does not leak into the next; the shipped one is lib/rateLimit.js hit().
function burstLimiter() {
  const last = new Map();
  let clock = 0;
  const limiter = (key, { windowMs }) => {
    const t = last.get(key);
    if (t != null && clock - t < windowMs) return { ok: false, retryAfter: Math.ceil((t + windowMs - clock) / 1000) };
    last.set(key, clock);
    return { ok: true, retryAfter: 0 };
  };
  limiter.advance = (ms) => {
    clock += ms;
  };
  return limiter;
}
async function handlerWith({ cap = "100", now = new Date("2026-09-28T15:00:00Z") } = {}) {
  const s = await freshStore();
  const burst = burstLimiter();
  const clock = { now };
  const handle = createShowcaseMeasureHandler({ store: s.store, measure: measureRoof, now: () => clock.now, env: { SHOWCASE_MEASURE_DAILY_CAP: cap, BETTER_AUTH_SECRET: "s" }, burst });
  // Every call a fresh ten seconds later, unless a section says otherwise.
  const call = async (body, opts = {}) => {
    if (!opts.sameInstant) burst.advance(11000);
    const res = await handle(req(body, opts));
    const text = await res.text();
    return { status: res.status, body: JSON.parse(text), text, headers: res.headers };
  };
  return { ...s, call, clock, burst };
}
const noPrices = (text) => !/ratePerSquare|"low"|"high"|"point"|"subtotal"|"total"|materials/.test(text);

/* ═════════════════ 1. Success, and what one try costs ════════════════════ */

section(`1. A real Canadian address (store: ${PGlite ? "shipped SQL on PGlite" : "in-memory stand-in — PGlite not installed"})`);
let measuredHouse = null;
{
  const h = await handlerWith();
  const before = calls.length;
  const r = await h.call({ address: "742 Maple Ave, Kingston, ON", country: "CA" });
  const g = googleCalls(before);
  ok("200 with a house", r.status === 200 && r.body.ok === true && r.body.cached === false, r.body);
  ok("…one geocode and one buildingInsights — two Google calls on the server", g.length === 2 && /geocode/.test(g[0]) && /buildingInsights/.test(g[1]), g);
  const house = r.body.house;
  measuredHouse = house;
  ok("the roof is measureRoof()'s summary: 24.1 squares, 8/12, tiered moderate", house.measurement.squares === 24.1 && house.measurement.predominantPitch.rise === 8 && house.measurement.steepness === "moderate" && house.measurement.source === "google_solar", house.measurement);
  ok("country, province and currency from the GEOCODE's formatted address", house.country === "CA" && house.region === "ON" && house.currency === "CAD" && house.address === WORLD["742 Maple Ave, Kingston, ON"].formatted);
  const expectTax = resolveDocumentTax({ company: { province: "ON", country: "CA" }, taxRates: null, client: { province: "ON", country: "CA", address: house.address }, workType: null, lang: "en" });
  ok("tax is resolveDocumentTax's for that province (13% HST)", house.tax.rate === 13 && house.tax.rate === Number(expectTax.rate) && house.tax.headline.en?.key, house.tax);
  ok("the still is Static Maps with the PUBLIC key", /^https:\/\/maps\.googleapis\.com\/maps\/api\/staticmap\?/.test(house.satelliteImageUrl) && house.satelliteImageUrl.includes(`key=${PUBLIC_KEY}`) && house.measurement.satelliteImageUrl === house.satelliteImageUrl);
  ok("the server key is in no response", !r.text.includes(SERVER_KEY));
  ok("no price, rate or material list in the response (non-negotiable #4)", noPrices(r.text), r.text.slice(0, 300));
  if (h.real) {
    const day = await h.db.platformSetting.findUnique({ where: { key: "showcase.roofMeasure.day.2026-09-28" } });
    ok("today's row counts one paid measurement, under a hashed visitor tag (no IP stored)", day?.value?.count === 1 && Object.values(day.value.visitors).join() === "1" && !JSON.stringify(day.value).includes("203.0.113.7"), day?.value);
    const cached = await h.db.platformSetting.findUnique({ where: { key: cacheKeyFor("742 Maple Ave, Kingston, ON") } });
    ok("the verdict is cached — facts only, no image URL, no key", cached?.value?.outcome === "ok" && !JSON.stringify(cached.value).includes("key=") && !JSON.stringify(cached.value).includes(SERVER_KEY), cached?.value);
  }

  // ── 2. The cache ───────────────────────────────────────────────────────
  section("2. The same house again, typed differently: cached, free");
  const before2 = calls.length;
  const again = await h.call({ address: "  742 maple ave., KINGSTON, on ", country: "CA" }, { ip: "198.51.100.9" });
  ok("served from the cache", again.status === 200 && again.body.cached === true && again.body.house.measurement.squares === 24.1, again.body);
  ok("…with no Google call", googleCalls(before2).length === 0, googleCalls(before2));
  if (h.real) {
    const day = await h.db.platformSetting.findUnique({ where: { key: "showcase.roofMeasure.day.2026-09-28" } });
    ok("…and not counted against the day", day?.value?.count === 1, day?.value);
  }
  ok("normaliseAddress folds case, punctuation and spacing only", normaliseAddress("  742 Maple Ave., KINGSTON, on ") === normaliseAddress("742 Maple Ave, Kingston, ON") && normaliseAddress("742 Maple St") !== normaliseAddress("742 Maple Street"));
  h.clock.now = new Date("2026-10-29T15:00:00Z");
  const before3 = calls.length;
  const stale = await h.call({ address: "742 Maple Ave, Kingston, ON", country: "CA" }, { ip: "198.51.100.10" });
  ok("after 30 days the answer is measured again", stale.status === 200 && stale.body.cached === false && googleCalls(before3).length === 2);
}

/* ═════════════════ 3. The refusals ═══════════════════════════════════════ */

section("3. Honest refusals");
{
  const h = await handlerWith();
  let before = calls.length;
  const none = await h.call({ address: "9 Lonely Rd, Nowhere, SK", country: "CA" });
  const g = googleCalls(before);
  ok("no Solar model: 422 no_roof_coverage", none.status === 422 && none.body.reason === "no_roof_coverage", none.body);
  ok("…with the house's jurisdiction and still but NO measurement", none.body.house && none.body.house.measurement === null && none.body.house.region === "SK" && none.body.house.currency === "CAD" && /staticmap/.test(none.body.house.satelliteImageUrl));
  ok("…after the pin and the eight-point ring were tried (1 geocode + 9 Solar — the worst case)", g.length === 10 && g.filter((u) => /buildingInsights/.test(u)).length === 9, g.length);
  before = calls.length;
  const none2 = await h.call({ address: "9 Lonely Rd, Nowhere, SK", country: "CA" }, { ip: "198.51.100.20" });
  ok("…and that verdict is cached too", none2.status === 422 && none2.body.cached === true && googleCalls(before).length === 0);

  before = calls.length;
  const abroadHint = await h.call({ address: "10 High St, Oxford", country: "GB" }, { ip: "198.51.100.21" });
  ok("the picker said GB: refused before any call", abroadHint.status === 422 && abroadHint.body.reason === "outside" && googleCalls(before).length === 0);
  before = calls.length;
  const abroadGeo = await h.call({ address: "10 High St, Oxford" }, { ip: "198.51.100.22" });
  ok("no hint, the geocode says UK: refused as outside, and no measurement returned", abroadGeo.status === 422 && abroadGeo.body.reason === "outside" && !abroadGeo.body.house, abroadGeo.body);
  ok("…having spent the geocode and Solar calls it took to know", googleCalls(before).length === 2);

  before = calls.length;
  const lost = await h.call({ address: "1 Nonexistent Pl, Atlantis" }, { ip: "198.51.100.23" });
  ok("a geocode that finds nothing: 404 not_found, one call, not cached", lost.status === 404 && lost.body.reason === "not_found" && googleCalls(before).length === 1);

  const us = await h.call({ address: "1200 Oak St, Austin, TX", country: "US" }, { ip: "198.51.100.24" });
  ok("a US house bills in USD with the state's tax", us.status === 200 && us.body.house.currency === "USD" && us.body.house.region === "TX" && us.body.house.country === "US" && us.body.house.tax.rate > 0, us.body.house && { c: us.body.house.currency, t: us.body.house.tax.rate });

  const bad = await h.call({ address: "x" }, { ip: "198.51.100.25" });
  ok("an address too short to be one: 400, no call", bad.status === 400 && bad.body.reason === "bad_request");
}

section("4. Same origin only");
{
  const h = await handlerWith();
  const before = calls.length;
  const cases = [
    ["no Origin", { origin: null }],
    ["no Referer", { referer: null }],
    ["another site's Origin", { origin: "https://evil.example" }],
    ["another site's Referer", { referer: "https://evil.example/industries/roofing" }],
    ["our host, another page", { referer: `https://${HOST}/pricing` }],
    ["a look-alike host", { origin: `https://${HOST}.evil.example`, referer: `https://${HOST}.evil.example/industries/roofing` }],
  ];
  for (const [name, opts] of cases) {
    const r = await h.call({ address: "742 Maple Ave, Kingston, ON", country: "CA" }, opts);
    ok(`${name}: 403`, r.status === 403 && r.body.reason === "bad_origin", r.status);
  }
  ok("…and not one Google call among them", googleCalls(before).length === 0);
  const fine = await h.call({ address: "742 Maple Ave, Kingston, ON", country: "CA" }, { referer: `https://${HOST}/industries/roofing#instant-quote-example` });
  ok("the showcase page itself (anchor and all) is let through", fine.status === 200);
}

section("5. The burst limit: one request per ten seconds per IP");
{
  const h = await handlerWith();
  const a = await h.call({ address: "742 Maple Ave, Kingston, ON", country: "CA" });
  const before = calls.length;
  const b = await h.call({ address: "1200 Oak St, Austin, TX", country: "US" }, { sameInstant: true });
  ok("a second request inside ten seconds: 429 rate_limited with Retry-After, no call", a.status === 200 && b.status === 429 && b.body.reason === "rate_limited" && Number(b.headers.get("retry-after")) > 0 && googleCalls(before).length === 0, b.body);
  const c = await h.call({ address: "1200 Oak St, Austin, TX", country: "US" }, { ip: "192.0.2.50", sameInstant: true });
  ok("…another IP is not held up by it", c.status === 200);
}

section("6. The daily caps");
{
  const h = await handlerWith();
  const addresses = ["742 Maple Ave, Kingston, ON", "1200 Oak St, Austin, TX", "9 Lonely Rd, Nowhere, SK"];
  const results = [];
  for (const a of addresses) results.push(await h.call({ address: a }, { ip: "192.0.2.77" }));
  ok("three paid tries per visitor go through", results.every((r) => r.status === 200 || r.status === 422), results.map((r) => r.status));
  WORLD["55 Elm St, Ottawa, ON"] = { formatted: "55 Elm St, Ottawa, ON K1A 0B1, Canada", lat: 45.4, lng: -75.7, solar: "roof" };
  const before = calls.length;
  const fourth = await h.call({ address: "55 Elm St, Ottawa, ON" }, { ip: "192.0.2.77" });
  ok("the fourth: 429 daily_limit, before any call", fourth.status === 429 && fourth.body.reason === "daily_limit" && googleCalls(before).length === 0, fourth.body);
  const cachedStill = await h.call({ address: "742 Maple Ave, Kingston, ON" }, { ip: "192.0.2.77" });
  ok("…a cached house is still served to them (it costs nothing)", cachedStill.status === 200 && cachedStill.body.cached === true);
  const tomorrow = await (async () => {
    h.clock.now = new Date("2026-09-29T00:00:05Z");
    return h.call({ address: "55 Elm St, Ottawa, ON" }, { ip: "192.0.2.77" });
  })();
  ok("…and tomorrow they have three again", tomorrow.status === 200 && tomorrow.body.cached === false);
}
{
  const h = await handlerWith({ cap: "2" });
  WORLD["1 A St, Regina, SK"] = { formatted: "1 A St, Regina, SK S4P 0A1, Canada", lat: 50.44, lng: -104.61, solar: "roof" };
  WORLD["2 B St, Regina, SK"] = { formatted: "2 B St, Regina, SK S4P 0A2, Canada", lat: 50.45, lng: -104.62, solar: "roof" };
  WORLD["3 C St, Regina, SK"] = { formatted: "3 C St, Regina, SK S4P 0A3, Canada", lat: 50.46, lng: -104.63, solar: "roof" };
  const r1 = await h.call({ address: "1 A St, Regina, SK" }, { ip: "192.0.2.1" });
  const r2 = await h.call({ address: "2 B St, Regina, SK" }, { ip: "192.0.2.2" });
  const before = calls.length;
  const r3 = await h.call({ address: "3 C St, Regina, SK" }, { ip: "192.0.2.3" });
  ok("SHOWCASE_MEASURE_DAILY_CAP=2: the third visitor of the day gets 429 capped, before any call", r1.status === 200 && r2.status === 200 && r3.status === 429 && r3.body.reason === "capped" && googleCalls(before).length === 0, r3.body);
  ok("…with the page's own sentence as the fallback wording", r3.body.error === "The live example has reached today's limit — try the sample house.");
}
{
  const h = await handlerWith({ cap: "0" });
  const before = calls.length;
  const r = await h.call({ address: "742 Maple Ave, Kingston, ON" }, { ip: "192.0.2.90" });
  ok("a cap of 0 switches live measuring off (capped, no call)", r.status === 429 && r.body.reason === "capped" && googleCalls(before).length === 0);
}
ok("dailyCap(): unset → 100, '25' → 25, '0' → 0, junk → 100", dailyCap({}) === DEFAULT_DAILY_CAP && dailyCap({ SHOWCASE_MEASURE_DAILY_CAP: "25" }) === 25 && dailyCap({ SHOWCASE_MEASURE_DAILY_CAP: "0" }) === 0 && dailyCap({ SHOWCASE_MEASURE_DAILY_CAP: "lots" }) === 100 && dailyCap({ SHOWCASE_MEASURE_DAILY_CAP: "-4" }) === 100);
ok("three per visitor per day", PER_VISITOR_PER_DAY === 3);
ok("a visitor tag is a keyed hash — not the IP, and different tomorrow", visitorTag("203.0.113.7", "d1", "k") !== visitorTag("203.0.113.7", "d2", "k") && !visitorTag("203.0.113.7", "d1", "k").includes("203"));

if (PGlite) {
  section("7. The reservation is exact under concurrency (shipped SQL, PGlite)");
  const db = await pgliteDb();
  const store = platformSettingStore(db);
  const attempts = await Promise.all(
    Array.from({ length: 40 }, (_, i) => store.reserve({ dayKey: "showcase.roofMeasure.day.2026-09-30", visitor: `v${i % 10}`, cap: 25, perVisitor: 3 })),
  );
  const granted = attempts.filter((a) => a.ok).length;
  const day = await db.platformSetting.findUnique({ where: { key: "showcase.roofMeasure.day.2026-09-30" } });
  ok("40 simultaneous tries against a cap of 25 grant exactly 25", granted === 25 && day.value.count === 25, { granted, count: day?.value?.count });
  ok("…and no visitor got more than three", Object.values(day.value.visitors).every((n) => n <= 3), day.value.visitors);
  const refused = attempts.filter((a) => !a.ok).map((a) => a.why);
  ok("…the refusals name the cap", refused.every((w) => w === "cap" || w === "visitor") && refused.includes("cap"), refused);
  ok("RESERVE_SQL increments only under both limits, in one statement", /ON CONFLICT \("key"\) DO UPDATE/.test(RESERVE_SQL) && /WHERE COALESCE[\s\S]*< \$3::int[\s\S]*< \$4::int[\s\S]*RETURNING/.test(RESERVE_SQL));
} else {
  console.log("\n7. skipped — PGlite (@electric-sql/pglite) is not installed, so the reservation SQL was not executed here.");
}

/* ═════════════════ 8. The fixture on the house ═══════════════════════════ */

section("8. Priced on the measured house = the real pricing functions on that measurement");
const base = buildRoofingShowcase();
{
  const shown = fixtureForHouse(base, measuredHouse);
  ok("the house fixture keeps the sample's price book, company name and homeowner", shown.config === base.config && shown.company.name === SHOWCASE_COMPANY.name && shown.homeowner.name === base.homeowner.name);
  ok("…and takes the house's address, roof, currency and tax", shown.address === measuredHouse.address && shown.measurement.squares === 24.1 && shown.company.currency === "CAD" && shown.tax.rate === 13);
  const COMPANY_ID = "co_live";
  const categoryKey = primaryCategoryForInstantTrade("roofing");
  resetDbStub();
  rows.company = [{ id: COMPANY_ID, slug: "x", name: "X", defaultLanguage: "en", currency: "CAD", province: "ON", country: "CA", taxRates: null, financing: null }];
  rows.instantQuoteConfig = [{ companyId: COMPANY_ID, trade: "roofing", enabled: true, config: base.config }];
  rows.serviceCategory = [{ id: "cat_roof", key: categoryKey, label: "Roofing" }];
  rows.companyServiceCategory = [{ id: "ccs_roof", companyId: COMPANY_ID, enabled: true, rates: null, category: { key: categoryKey } }];
  let compared = 0;
  const mismatches = [];
  for (const layers of [0, 1, 2]) {
    const intake = { tearOffLayers: String(layers) };
    const measurement = measurementFor(shown, intake);
    const all = await priceAllMaterials({ companyId: COMPANY_ID, trade: "roofing", measurement });
    for (const m of base.config.materials) {
      const run = runRequest(shown, { ...defaultBody(shown, "en"), materialKey: m.key, intake });
      const one = await priceOneMaterial({ companyId: COMPANY_ID, trade: "roofing", materialKey: m.key, measurement });
      const real = all.options.find((o) => o.materialKey === m.key);
      const mine = run.options.options.find((o) => o.materialKey === m.key);
      compared += 1;
      const same = one.ok && real && mine && [real.low, real.point, real.high].join() === [mine.low, mine.point, mine.high].join() && [one.estimate.low, one.estimate.point, one.estimate.high].join() === [run.estimate.low, run.estimate.point, run.estimate.high].join() && JSON.stringify(one.estimate.breakdown.map((b) => b.amount)) === JSON.stringify(run.estimate.breakdown.map((b) => b.amount)) && JSON.stringify(one.estimate.assumptions) === JSON.stringify(run.estimate.assumptions);
      if (!same) mismatches.push({ layers, key: m.key, real, mine });
    }
  }
  ok(`all ${compared} option × tear-off combinations match priceAllMaterials and priceOneMaterial, assumptions included`, mismatches.length === 0 && compared === 15, mismatches[0]);
  const run = runRequest(shown, defaultBody(shown, "en"));
  ok("the draft carries the house's address, currency and 13% tax", run.lead.intake && run.review.client.address === measuredHouse.address && run.draft.currency === "CAD" && run.draft.taxRate === 13 && Math.round((run.draft.subtotal * 0.13) * 100) === Math.round(run.draft.tax * 100));
  ok("a steep 8/12 roof carries the moderate surcharge line", run.estimate.breakdown.length === 3, run.estimate.breakdown.map((b) => b.label));

  const us = fixtureForHouse(base, { ...measuredHouse, country: "US", region: "TX", currency: "USD", tax: { rate: 6.25, resolution: null, headline: {} } });
  ok("a US house re-labels the budget question in USD and bills USD", us.company.currency === "USD" && us.payloads.en.currency === "USD" && us.payloads.fr.trades[0].budgetBands.length === base.payloads.fr.trades[0].budgetBands.length);
  ok("fixtureForHouse refuses a house outside CA/US", fixtureForHouse(base, { ...measuredHouse, country: "GB" }) === null);
}

section("9. A typed roof size: priced, and said to be typed");
{
  ok("cleanSquares keeps a house-sized roof and refuses the rest", cleanSquares("24.14") === 24.1 && cleanSquares("22,5") === 22.5 && cleanSquares("3") === null && cleanSquares("201") === null && cleanSquares("abc") === null && cleanSquares("") === null && MANUAL_SQUARES.min === 4);
  const typed = fixtureWithSquares(base, 30);
  ok("only squares and their area are stated; pitch, steepness, imagery are null", typed.measurement.source === "manual" && typed.measurement.squares === 30 && typed.measurement.areaSqft === 3000 && typed.measurement.predominantPitch === null && typed.measurement.steepness === null && typed.measurement.imageryDate === null);
  ok("…on the sample house (address, CAD, Ontario) when the address could not be placed", typed.address === base.address && typed.company.currency === "CAD" && typed.tax.rate === base.tax.rate);
  const run = runRequest(typed, defaultBody(typed, "en"));
  ok("no pitch measured → no steep-roof line", run.estimate.breakdown.length === 2 && run.estimate.ok, run.estimate.breakdown.map((b) => b.label));
  ok("the assumption says TYPED, not 'measured from satellite'", run.estimate.assumptions.length === 1 && /typed/.test(run.estimate.assumptions[0]) && !/satellite/.test(JSON.stringify(run.draft.estimateData.assumptions)), run.estimate.assumptions);
  ok("…in the form's language", /30/.test(runRequest(typed, defaultBody(typed, "fr")).estimate.assumptions[0]) && runRequest(typed, defaultBody(typed, "fr")).estimate.assumptions[0] === industryShowcaseFor("fr").typedAssumption.replace("{squares}", "30"));
  const noRoof = fixtureWithSquares(fixtureForHouse(base, { ...measuredHouse, measurement: null, region: "SK" }), 18);
  ok("Google placed it but had no roof: the house's jurisdiction and still, at the typed size", noRoof.company.province === "SK" && noRoof.measurement.squares === 18 && noRoof.measurement.satelliteImageUrl === measuredHouse.satelliteImageUrl);
  ok("the sample fixture is untouched by all of it", base.measurement.source === "google_solar" && base.measurement.squares === 24.1 && !base.live);
}

section("10. The route mounts this handler, with the real pieces");
{
  const src = readFileSync("app/api/showcase/roof-measure/route.js", "utf8");
  ok("POST only, nodejs runtime", /export async function POST\(request\)/.test(src) && /export const runtime = "nodejs"/.test(src) && !/export async function GET/.test(src));
  ok("…the real measureRoof and the PlatformSetting store", /createShowcaseMeasureHandler\(\{ store: platformSettingStore\(db\), measure: measureRoof \}\)/.test(src));
  const mod = await import("@/app/api/showcase/roof-measure/route.js");
  ok("…and it loads", typeof mod.POST === "function");
  const measure = readFileSync("lib/measure/roofMeasurement.js", "utf8");
  ok("roofMeasurement.js's still is still built on the PUBLIC key (the one the handler hands out)", /const key = process\.env\.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;[\s\S]{0,200}staticmap/.test(measure));
}

console.log(`\n${pass} passed, ${fails.length} failed`);
for (const pg of openDatabases) await pg.close().catch(() => {});
process.exit(fails.length ? 1 : 0);
