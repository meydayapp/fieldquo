// scripts/check-product-analytics.mjs
//
// FieldQuo's own page-view measurement, executed.
//
//   npm run check:product-analytics
//
// Every claim the analytics makes is a claim about a function, and each one
// is run here against real and hostile input rather than read off the source:
//
//   1. the route catalogue is the page tree (regenerated in memory, compared);
//   2. a URL becomes a route pattern — ids stripped, query dropped, the
//      literal beats the parameter, an unknown path is null;
//   3. the allow-list refuses unknown events, browser-sent feature_used, a
//      path that is not ours, an over-long query, our own host as a referrer;
//   4. the roll-up keys and the compaction plan — which never names a table
//      but AnalyticsEvent and never deletes outside the day it aggregated;
//   5. the store, through a stub: raw insert + daily increments in ONE
//      transaction; compaction SETS uniqueVisitors, never adds, and deletes
//      exactly the day's raw rows;
//   6. the funnel drop-off maths, the 150-view sales gate (149 → no, 150 →
//      yes; marketing and demo rows never count), demo exclusion, the
//      "never used" list;
//   7. the /app page catalogue matches both sidebars and names only real
//      routes, matrix keys and registry keys;
//   8. every feature_used writer contains its call; the layout mounts the
//      beacon; the cron is scheduled; the privacy sentence exists; the nine
//      languages carry the card's strings.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { collectRoutes } from "./build-route-catalogue.mjs";
import { ROUTE_PATTERNS } from "@/lib/analytics/product/routeCatalogue.generated.js";
import {
  normalisePath, cleanPath, surfaceOf, tenantHostPath, TENANT_PASSTHROUGH, isRoutePattern,
} from "@/lib/analytics/product/routes.js";
import {
  sanitiseBatch, sanitiseEvent, cleanReferrerHost, cleanHelpQuery, cleanLanguage, cleanVisitorId,
  foldReferrerHost, cleanClickNetwork, trafficSource,
  BROWSER_EVENTS, FEATURES, FEATURE_KEYS, SIGNUP_FUNNEL, MAX_EVENTS_PER_BATCH,
} from "@/lib/analytics/product/events.js";
import {
  rollup, dailyKey, distinctVisitors, compactionPlan, retentionCutoff, utcDay, RAW_RETENTION_DAYS,
} from "@/lib/analytics/product/rollup.js";
import { recordRows, compactOlderThan, analyticsAvailable } from "@/lib/analytics/product/store.js";
import {
  signupFunnel, salesTopFeatures, featureUsage, excludeDemo, topPaths, byLanguage, dimension, companyScreens,
  SALES_MIN_APP_VIEWS, SALES_TOP_N,
} from "@/lib/analytics/product/aggregate.js";
import { APP_PAGES, APP_ROUTE_PATTERNS, PREFIX_ONLY_HREFS, featurePageFor } from "@/lib/analytics/product/appPages.js";
import { MATRIX_KEYS } from "@/lib/marketing/featureMatrix.js";
import { FEATURE_KEYS as REGISTRY_KEYS } from "@/lib/features/registry.js";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let passed = 0;
const failures = [];
const ok = (name, cond, detail = "") => {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
};
const section = (t) => console.log(`\n── ${t}`);

// ── 1. The catalogue is the tree ──────────────────────────────────────────
section("1. Route catalogue");
{
  const fresh = collectRoutes();
  ok("the generated catalogue matches app/ (run npm run build:route-catalogue)", JSON.stringify(fresh) === JSON.stringify([...ROUTE_PATTERNS]),
    `tree ${fresh.length} vs file ${ROUTE_PATTERNS.length}`);
  ok("no /api route is in it", ROUTE_PATTERNS.every((p) => !p.startsWith("/api")));
  ok("route groups are stripped", ROUTE_PATTERNS.includes("/pricing") && !ROUTE_PATTERNS.some((p) => p.includes("(")));
  ok("dynamic segments keep their brackets", ROUTE_PATTERNS.includes("/app/quotes/[id]") && ROUTE_PATTERNS.includes("/site/[subdomain]/[...path]"));
}

// ── 2. Normalisation ──────────────────────────────────────────────────────
section("2. URL → pattern");
{
  ok("an id is stripped", normalisePath("/app/quotes/cmf3k2j9x0001abc") === "/app/quotes/[id]");
  ok("…and a deeper one", normalisePath("/app/quotes/cmf3k2j9x0001abc/edit") === "/app/quotes/[id]/edit");
  ok("the literal wins over the parameter", normalisePath("/app/quotes/new") === "/app/quotes/new");
  ok("a token is stripped", normalisePath("/portal/abcdef123456/invoices/inv_9") === "/portal/[token]/invoices/[id]");
  ok("the query is dropped", normalisePath("/pricing?utm_source=x&plan=secret") === "/pricing");
  ok("the hash is dropped", normalisePath("/help/en#top") === "/help/[lang]");
  ok("a trailing slash is dropped", normalisePath("/app/jobs/") === "/app/jobs");
  ok("double slashes collapse", normalisePath("//app//jobs") === "/app/jobs");
  ok("the root resolves", normalisePath("/") === "/");
  ok("a tenant site sub-page hits the catch-all", normalisePath("/site/sunset/services/painting") === "/site/[subdomain]/[...path]");
  ok("a tenant site root is its own pattern", normalisePath("/site/sunset") === "/site/[subdomain]");
  ok("an unknown path is null", normalisePath("/wp-admin/login.php") === null);
  ok("an unknown deep path is null", normalisePath("/app/quotes/x/y/z/w") === null);
  ok("a non-path is null", normalisePath("javascript:alert(1)") === null && normalisePath("") === null && normalisePath(null) === null);
  ok("a control character is null", normalisePath("/app/\u0000jobs") === null);
  ok("an over-long path is null", normalisePath("/app/" + "a".repeat(600)) === null);
  ok("a bad percent-escape is null", normalisePath("/app/%E0%A4%A") === null);
  ok("an empty segment is null", cleanPath("/app/ /x") !== null && normalisePath("/app//") === "/app");
  ok("every pattern normalises to itself", ROUTE_PATTERNS.every((p) => isRoutePattern(p) && (p.includes("[...") || normalisePath(p.replace(/\[[^\]]+\]/g, "x")) === p)));

  ok("surface: app", surfaceOf("/app/quotes/[id]") === "app" && surfaceOf("/app") === "app");
  ok("surface: platform / sales / help", surfaceOf("/platform/companies") === "platform" && surfaceOf("/sales/leads") === "sales" && surfaceOf("/help/[lang]") === "help");
  ok("surface: client pages", ["/q/[token]", "/book/[companySlug]", "/portal/[token]", "/site/[subdomain]", "/embed/[companySlug]/[widget]", "/f/[companySlug]/[funnelSlug]", "/visit/[token]", "/instant-quote/[companySlug]"].every((p) => surfaceOf(p) === "client"));
  ok("surface: everything else is marketing", surfaceOf("/pricing") === "marketing" && surfaceOf("/signup") === "marketing" && surfaceOf("/") === "marketing");
  ok("an /application prefix is not /app", surfaceOf("/applications") === "marketing");

  ok("a tenant host folds into /site/…", normalisePath(tenantHostPath("/about", "sunset")) === "/site/[subdomain]/[...path]" && normalisePath(tenantHostPath("/", "sunset")) === "/site/[subdomain]");
  ok("…but a passthrough path stays itself", normalisePath(tenantHostPath("/quote/sunset", "sunset")) === "/quote/[companySlug]" && normalisePath(tenantHostPath("/book/sunset", "sunset")) === "/book/[companySlug]");
  ok("no subdomain, no fold", tenantHostPath("/about", null) === "/about");
  const mw = read("middleware.js");
  const mwList = mw.match(/const SUBDOMAIN_PASSTHROUGH = \[([\s\S]*?)\];/)[1].replace(/\/\/.*$/gm, "").match(/"([^"]+)"/g).map((s) => s.slice(1, -1));
  ok("TENANT_PASSTHROUGH mirrors middleware.js SUBDOMAIN_PASSTHROUGH", JSON.stringify([...mwList].sort()) === JSON.stringify([...TENANT_PASSTHROUGH].sort()), `${mwList.join(",")} vs ${TENANT_PASSTHROUGH.join(",")}`);
}

// ── 3. The allow-list ─────────────────────────────────────────────────────
section("3. sanitiseBatch");
{
  ok("browser events are exactly the four", JSON.stringify([...BROWSER_EVENTS].sort()) === JSON.stringify(["checkout_started", "help_search", "page_view", "signup_step"]));
  ok("feature_used from a browser is refused", sanitiseEvent({ e: "feature_used", p: "quote_sent" }) === null);
  ok("an unknown event is refused", sanitiseEvent({ e: "purchase", p: "/pricing" }) === null && sanitiseEvent({ e: "__proto__", p: "/" }) === null);
  ok("a page_view with a foreign path is refused", sanitiseEvent({ e: "page_view", p: "/evil" }) === null);
  const pv = sanitiseEvent({ e: "page_view", p: "/app/quotes/cm123/edit?x=1", r: "https://www.google.com/search?q=x", us: "Google", um: "cpc", uc: "Spring Push" });
  ok("a good page_view is normalised", pv && pv.path === "/app/quotes/[id]/edit" && pv.surface === "app" && pv.referrerHost === "google.com" && pv.utmSource === "google" && pv.utmCampaign === "spring push");
  // 2026-09-13: "are we able to see if people come from facebook?" — the
  // referrer table showed google.com and nothing else, because Facebook's
  // app sends no referrer and its web redirector is l.facebook.com.
  ok("referrer redirectors fold to one family host", cleanReferrerHost("https://l.facebook.com/l.php?u=x") === "facebook.com" && cleanReferrerHost("lm.facebook.com") === "facebook.com" && cleanReferrerHost("https://l.instagram.com/") === "instagram.com" && cleanReferrerHost("www.google.ca") === "google.com" && foldReferrerHost("t.co") === "x.com" && foldReferrerHost("yelp.com") === "yelp.com");
  ok("a click network is a closed list", cleanClickNetwork("facebook") === "facebook" && cleanClickNetwork("instagram") === "instagram" && cleanClickNetwork("evil") === null && cleanClickNetwork(null) === null);
  ok("traffic source: click id beats utm beats referrer beats direct", trafficSource({ clickNetwork: "facebook", utmSource: "google", referrerHost: "bing.com" }) === "facebook" && trafficSource({ utmSource: "IG", referrerHost: "google.com" }) === "instagram" && trafficSource({ utmSource: "google", utmMedium: "cpc" }) === "google_ads" && trafficSource({ referrerHost: "facebook.com" }) === "facebook" && trafficSource({ referrerHost: "yelp.com" }) === "yelp.com" && trafficSource({}) === "direct" && trafficSource({ utmSource: "<b>weird source</b>" }) === "_b_weird_source_b_");
  {
    const landing = sanitiseEvent({ e: "page_view", p: "/pricing", r: null, c: "facebook" });
    const later = sanitiseEvent({ e: "page_view", p: "/pricing" });
    ok("only a landing carries a source; an in-site view is never 'direct'", landing?.meta?.src === "facebook" && later?.meta === null);
    ok("a landing with nothing is direct", sanitiseEvent({ e: "page_view", p: "/pricing", r: null })?.meta?.src === "direct");
  }
  ok("our own host is not a referrer", cleanReferrerHost("https://www.fieldquo.com/pricing") === null && cleanReferrerHost("sunset.fieldquo.com") === null && cleanReferrerHost("http://localhost:3000/") === null && cleanReferrerHost("x.vercel.app") === null);
  ok("a bare word is not a referrer host", cleanReferrerHost("google") === null && cleanReferrerHost("<script>") === null);
  ok("a signup step must be one of the four", sanitiseEvent({ e: "signup_step", p: "trades" })?.path === "trades" && sanitiseEvent({ e: "signup_step", p: "completed" }) === null && sanitiseEvent({ e: "signup_step", p: "card" }) === null);
  ok("checkout_started only for signup", sanitiseEvent({ e: "checkout_started", p: "signup" })?.surface === "marketing" && sanitiseEvent({ e: "checkout_started", p: "topup" }) === null);
  const hs = sanitiseEvent({ e: "help_search", p: "  Invoice   REMINDERS ", m: { results: 3 } });
  ok("a help query is trimmed, lower-cased, collapsed", hs && hs.path === "invoice reminders" && hs.meta.results === 3 && hs.surface === "help");
  ok("a help query is bounded", cleanHelpQuery("a".repeat(500)).length === 80 && cleanHelpQuery("<b>") === null && cleanHelpQuery("x") === null);
  ok("a negative or absurd result count is clamped", sanitiseEvent({ e: "help_search", p: "quotes", m: { results: -1 } }).meta.results === 0 && sanitiseEvent({ e: "help_search", p: "quotes", m: { results: 1e9 } }).meta.results === 9999);
  ok("language is two letters or empty", cleanLanguage("fr-CA") === "fr" && cleanLanguage("english") === "" && cleanLanguage(42) === "");
  ok("a visitor id must look minted", cleanVisitorId("abcdefghijklmnop") === "abcdefghijklmnop" && cleanVisitorId("short") === null && cleanVisitorId("has space in it here") === null);
  ok("a bad envelope is null", sanitiseBatch(null) === null && sanitiseBatch({ v: 2, ev: [] }) === null && sanitiseBatch({ v: 1 }) === null && sanitiseBatch("[]") === null);
  const mixed = sanitiseBatch({ v: 1, l: "es", a: "abcdefghijklmnop", vp: "phone", ev: [{ e: "page_view", p: "/pricing" }, { e: "feature_used", p: "quote_sent" }, { e: "page_view", p: "/nope" }] });
  ok("bad events inside a good envelope are dropped one by one", mixed.events.length === 1 && mixed.language === "es" && mixed.viewport === "phone" && mixed.visitorId === "abcdefghijklmnop");
  const flood = sanitiseBatch({ v: 1, ev: Array.from({ length: 100 }, () => ({ e: "page_view", p: "/" })) });
  ok(`a flood is capped at ${MAX_EVENTS_PER_BATCH}`, flood.events.length === MAX_EVENTS_PER_BATCH);
  ok("a page_view cannot claim a surface", sanitiseEvent({ e: "page_view", p: "/pricing", surface: "app" }).surface === "marketing");
}

// ── 4. Roll-up and compaction plan ────────────────────────────────────────
section("4. rollup / compactionPlan");
const T = new Date("2026-09-10T15:30:00Z");
const row = (over = {}) => ({
  event: "page_view", surface: "marketing", path: "/pricing", language: "en", visitorId: "v_aaaaaaaaaaaaaaaa",
  companyId: null, memberId: null, repId: null, isDemo: false, referrerHost: null, utmSource: null, utmMedium: null,
  utmCampaign: null, viewport: "desktop", meta: null, createdAt: T, ...over,
});
{
  const daily = rollup([row(), row(), row({ referrerHost: "google.com", utmCampaign: "spring" }), row({ path: "/", language: "fr" }), row({ event: "help_search", surface: "help", path: "invoices", meta: { results: 0 } })]);
  const get = (event, p, lang = "en") => daily.get(dailyKey({ date: T, surface: event === "help_search" || event === "help_search_empty" ? "help" : "marketing", event, path: p, language: lang, companyId: null, isDemo: false }));
  ok("three views of /pricing become one key with count 3", get("page_view", "/pricing")?.count === 3);
  ok("a different language is a different key", get("page_view", "/", "fr")?.count === 1);
  ok("a referrer adds a referrer row", get("referrer", "google.com")?.count === 1);
  ok("a campaign adds a utm_campaign row", get("utm_campaign", "spring")?.count === 1);
  ok("a search with no results adds help_search_empty beside help_search", get("help_search", "invoices")?.count === 1 && get("help_search_empty", "invoices")?.count === 1);
  ok("the day is UTC midnight", get("page_view", "/pricing").date.toISOString() === "2026-09-10T00:00:00.000Z");
  ok("a demo row keys apart from a real one", dailyKey({ date: T, surface: "app", event: "page_view", path: "/app", language: "en", companyId: "c1", isDemo: true }) !== dailyKey({ date: T, surface: "app", event: "page_view", path: "/app", language: "en", companyId: "c1", isDemo: false }));
  ok("an unknown surface is ignored", rollup([row({ surface: "evil" })]).size === 0);

  const u = distinctVisitors([row(), row(), row({ visitorId: "v_bbbbbbbbbbbbbbbb" }), row({ visitorId: null })]);
  const k = dailyKey({ date: T, surface: "marketing", event: "page_view", path: "/pricing", language: "en", companyId: null, isDemo: false });
  ok("distinct visitors: 2 of 4 hits, a null visitor not counted", u.get(k).uniqueVisitors === 2 && u.get(k).count === 4);

  const day = utcDay(T);
  const plan = compactionPlan(day, [row({ id: "e1" }), row({ id: "e2", visitorId: "v_bbbbbbbbbbbbbbbb" })]);
  ok("the plan deletes only analyticsEvent, only that day", plan.deleteWhere.model === "analyticsEvent" && plan.deleteWhere.createdAt.gte.toISOString() === "2026-09-10T00:00:00.000Z" && plan.deleteWhere.createdAt.lt.toISOString() === "2026-09-11T00:00:00.000Z");
  ok("the plan writes uniqueVisitors per key", plan.writes.length === 1 && plan.writes[0].uniqueVisitors === 2 && plan.writes[0].countIfMissing === 2);
  let threw = false;
  try {
    compactionPlan(day, [row({ createdAt: new Date("2026-09-11T00:00:00Z") })]);
  } catch {
    threw = true;
  }
  ok("a row from another day is refused, so the delete range can never exceed what was aggregated", threw);
  ok("the retention cutoff is 30 days back at UTC midnight", retentionCutoff(new Date("2026-10-15T13:00:00Z")).toISOString() === "2026-09-15T00:00:00.000Z" && RAW_RETENTION_DAYS === 30);
}

// ── 5. The store, through a stub ──────────────────────────────────────────
section("5. store (stub)");
function makeStub() {
  const events = [];
  const daily = new Map();
  const log = [];
  let idn = 0;
  const client = {
    analyticsEvent: {
      createMany: async ({ data }) => {
        log.push({ model: "analyticsEvent", op: "createMany", n: data.length });
        for (const d of data) events.push({ id: `e${(idn += 1)}`, ...d });
        return { count: data.length };
      },
      findFirst: async ({ where, orderBy }) => {
        const lt = where.createdAt.lt;
        const hits = events.filter((e) => e.createdAt < lt).sort((a, b) => a.createdAt - b.createdAt);
        log.push({ model: "analyticsEvent", op: "findFirst", orderBy });
        return hits[0] ? { createdAt: hits[0].createdAt } : null;
      },
      findMany: async ({ where }) => {
        log.push({ model: "analyticsEvent", op: "findMany", where });
        return events.filter((e) => e.createdAt >= where.createdAt.gte && e.createdAt < where.createdAt.lt);
      },
      deleteMany: async ({ where }) => {
        log.push({ model: "analyticsEvent", op: "deleteMany", where });
        const before = events.length;
        for (let i = events.length - 1; i >= 0; i -= 1) {
          if (events[i].createdAt >= where.createdAt.gte && events[i].createdAt < where.createdAt.lt) events.splice(i, 1);
        }
        return { count: before - events.length };
      },
    },
    analyticsDaily: {
      upsert: async ({ where, create, update }) => {
        log.push({ model: "analyticsDaily", op: "upsert", key: where.key, update });
        const cur = daily.get(where.key);
        if (cur) {
          if (update.count?.increment) cur.count += update.count.increment;
          if (typeof update.count === "number") cur.count = update.count;
          if ("uniqueVisitors" in update) cur.uniqueVisitors = update.uniqueVisitors;
          return cur;
        }
        const fresh = { uniqueVisitors: null, ...create };
        daily.set(where.key, fresh);
        return fresh;
      },
    },
    company: { findUnique: async () => ({ isDemo: false }) },
    $transaction: async (ops) => {
      log.push({ op: "$transaction", n: ops.length });
      return Promise.all(ops);
    },
  };
  return { client, events, daily, log };
}
{
  const s = makeStub();
  ok("availability needs both delegates", analyticsAvailable(s.client) && !analyticsAvailable({ analyticsEvent: s.client.analyticsEvent }) && !analyticsAvailable(null));
  const n = await recordRows(s.client, [row(), row(), row({ referrerHost: "bing.com" })], T);
  ok("three rows written", n === 3 && s.events.length === 3);
  const tx = s.log.filter((l) => l.op === "$transaction");
  ok("raw insert and daily upserts ride ONE transaction", tx.length === 1 && tx[0].n === 1 + 2);
  const k = dailyKey({ date: T, surface: "marketing", event: "page_view", path: "/pricing", language: "en", companyId: null, isDemo: false });
  ok("the daily count is 3 and uniqueVisitors is still unknown", s.daily.get(k).count === 3 && s.daily.get(k).uniqueVisitors === null);
  await recordRows(s.client, [row()], T);
  ok("a second batch INCREMENTS the daily count", s.daily.get(k).count === 4);
  ok("nothing written for an empty batch", (await recordRows(s.client, [], T)) === 0);

  // Compaction: T is 2026-09-10; "now" 60 days later puts it past retention.
  const olderDay = new Date("2026-09-09T12:00:00Z");
  await recordRows(s.client, [row({ createdAt: olderDay, visitorId: "v_cccccccccccccccc" }), row({ createdAt: olderDay })], olderDay);
  const before = s.log.length;
  const result = await compactOlderThan(s.client, { now: new Date("2026-11-10T04:00:00Z"), maxDays: 10 });
  const after = s.log.slice(before);
  ok("two days compacted, oldest first", result.days.length === 2 && result.days[0].day.toISOString().startsWith("2026-09-09") && result.days[1].day.toISOString().startsWith("2026-09-10"));
  const deletes = after.filter((l) => l.op === "deleteMany");
  ok("exactly one deleteMany per day, on analyticsEvent, for that day's range", deletes.length === 2 && deletes.every((d) => d.model === "analyticsEvent") && deletes[0].where.createdAt.gte.toISOString() === "2026-09-09T00:00:00.000Z" && deletes[0].where.createdAt.lt.toISOString() === "2026-09-10T00:00:00.000Z");
  ok("the deletion removed the raw rows and nothing is left older than the cutoff", s.events.length === 0 && result.days.reduce((a, d) => a + d.deleted, 0) === 6);
  ok("compaction SETS uniqueVisitors (2 distinct on 09-10 across 4 hits) and does not touch the count", s.daily.get(k).count === 4 && s.daily.get(k).uniqueVisitors === 1);
  const setUpdates = after.filter((l) => l.op === "upsert").map((l) => l.update);
  ok("no compaction upsert increments a count", setUpdates.every((u) => !("count" in u) && "uniqueVisitors" in u));
  ok("the delete is the LAST statement of its transaction", after.filter((l) => l.op === "$transaction").every((l) => l.n >= 2));
  ok("nothing inside the window is touched", (await compactOlderThan(s.client, { now: new Date("2026-09-20T00:00:00Z") })).days.length === 0);
  const models = new Set(after.map((l) => l.model).filter(Boolean));
  ok("compaction names only the two analytics tables", [...models].every((m) => m === "analyticsEvent" || m === "analyticsDaily"));
}

// ── 6. Aggregation ────────────────────────────────────────────────────────
section("6. aggregate");
const D = new Date("2026-09-10T00:00:00Z");
const drow = (over = {}) => ({ date: D, surface: "app", event: "page_view", path: "/app/quotes", language: "en", companyId: "c1", isDemo: false, count: 1, uniqueVisitors: null, ...over });
{
  const f = signupFunnel({ visited: 200, account: 100, trades: 80, services: 80, plan: 50, checkout_started: 20, completed: 10 }, { visited: 100, account: 20, trades: 0, services: 30, plan: 30, checkout_started: 20, completed: 0 });
  ok("the funnel keeps the step order", f.steps.map((s) => s.key).join(",") === SIGNUP_FUNNEL.join(","));
  ok("drop-off is against the step before", f.steps[1].dropPct === 50 && f.steps[1].dropFromPrevious === 100 && f.steps[3].dropPct === 0 && f.steps[5].dropPct === 60);
  ok("the first step has no drop", f.steps[0].dropPct === null && f.steps[0].dropFromPrevious === null);
  ok("of-first is the conversion from visited", f.steps[6].ofFirstPct === 5 && f.steps[0].ofFirstPct === 100);
  ok("stopped-at is a share of everyone who stopped", f.stoppedAt.find((s) => s.key === "visited").pct === 50 && f.stoppedAt.every((s) => s.key !== "completed"));
  const empty = signupFunnel({});
  ok("an empty funnel divides nothing", empty.steps.every((s) => s.count === 0 && s.dropPct === null && s.ofFirstPct === null) && empty.stoppedAt === null);
  ok("a later step larger than the one before is a zero drop, not a negative", signupFunnel({ visited: 5, account: 9 }).steps[1].dropFromPrevious === 0);

  const rows149 = Array.from({ length: 149 }, (_, i) => drow({ path: i % 2 ? "/app/jobs" : "/app/quotes", companyId: `c${i % 3}` }));
  ok("149 /app views: the sales card is held back", salesTopFeatures(rows149).eligible === false && salesTopFeatures(rows149).totalViews === 149 && salesTopFeatures(rows149).items.length === 0);
  const rows150 = [...rows149, drow({ path: "/app/quotes/[id]/edit" })];
  const g = salesTopFeatures(rows150);
  ok("150 /app views: the card shows", g.eligible === true && g.totalViews === 150 && g.threshold === SALES_MIN_APP_VIEWS);
  ok("a sub-page counts under its feature row", g.items[0].href === "/app/quotes" && g.items[0].views === 76 && g.items[0].navKey === "app.nav.quotes");
  ok("companies is a count, not a list", g.items[0].companies === 3 && !("companyIds" in g.items[0]));
  const padded = [...rows149, drow({ surface: "marketing", path: "/pricing", count: 500 }), drow({ surface: "help", path: "/help/[lang]", count: 500 }), drow({ surface: "client", path: "/q/[token]", count: 500 })];
  ok("marketing, help and client views never count toward the gate", salesTopFeatures(padded).eligible === false);
  ok("…nor do demo companies", salesTopFeatures([...rows149, drow({ isDemo: true, count: 100 })]).eligible === false);
  ok("…nor feature_used rows", salesTopFeatures([...rows149, drow({ event: "feature_used", path: "quote_sent", count: 100 })]).eligible === false);
  const many = Array.from({ length: 200 }, (_, i) => drow({ path: APP_ROUTE_PATTERNS[i % APP_ROUTE_PATTERNS.length] }));
  ok(`at most ${SALES_TOP_N} items`, salesTopFeatures(many).items.length === SALES_TOP_N);
  ok("items are ranked by views", (() => { const it = salesTopFeatures(many).items; return it.every((x, i) => i === 0 || it[i - 1].views >= x.views) && it[0].rank === 1; })());

  const usage = featureUsage([drow({ count: 5 }), drow({ path: "/app/jobs", companyId: "c2" }), drow({ event: "feature_used", path: "quote_sent", count: 3 })], { totalCompanies: 40 });
  ok("pages are ranked most → least with a company count", usage.pages[0].key === "/app/quotes" && usage.pages[0].count === 5 && usage.pages[0].companies === 1 && usage.pages[0].totalCompanies === 40);
  ok("never-used lists every /app pattern with no views", usage.neverUsed.length === APP_ROUTE_PATTERNS.length - 2 && usage.neverUsed.some((p) => p.key === "/app/invoices") && !usage.neverUsed.some((p) => p.key === "/app/jobs"));
  ok("actions list every feature key, used or not, used first", usage.actions.length === FEATURE_KEYS.length && usage.actions[0].key === "quote_sent" && usage.actionsNeverUsed.length === FEATURE_KEYS.length - 1);
  ok("excludeDemo drops demo rows only", excludeDemo([drow(), drow({ isDemo: true })]).length === 1);
  ok("topPaths is per surface", topPaths([drow(), drow({ surface: "marketing", path: "/pricing" })], "marketing").length === 1);
  ok("byLanguage names the unknown", byLanguage([drow({ language: "" })])[0].key === "unknown");
  ok("dimension reads only its event", dimension([drow({ event: "referrer", path: "google.com" }), drow()], "referrer").length === 1);
  ok("uniqueVisitors stays null when no row knew", topPaths([drow(), drow()], "app")[0].uniqueVisitors === null && topPaths([drow({ uniqueVisitors: 2 }), drow()], "app")[0].uniqueVisitors === 2);
  const cs = companyScreens([drow(), drow({ companyId: "c9" })], "c1");
  ok("a company drill-down sees only that company", cs.pages.length === 1 && cs.pages[0].count === 1);
}

// ── 7. The /app page catalogue ────────────────────────────────────────────
section("7. appPages");
{
  const rowsIn = (file) => [...read(file).matchAll(/\{ key: "(app\.[a-zA-Z.]+)", href: "(\/app[^"]*)"/g)].map((m) => ({ key: m[1], href: m[2] }));
  const sidebar = [...rowsIn("app/components/layout/AdminSidebar.js"), ...rowsIn("app/components/layout/SettingsSidebar.js")].filter((r) => !r.key.startsWith("app.quickAdd."));
  const byHref = new Map(APP_PAGES.map((p) => [p.href, p]));
  const missing = sidebar.filter((r) => !byHref.has(r.href));
  ok("every sidebar and settings row has a catalogue line", missing.length === 0, missing.map((m) => m.href).join(", "));
  // An href both sidebars list under different keys keeps the NAV key (the
  // one on the main rail): that is the word a rep should say.
  const navFirst = new Map();
  for (const r of rowsIn("app/components/layout/AdminSidebar.js")) if (!navFirst.has(r.href)) navFirst.set(r.href, r.key);
  const wrongKey = sidebar.filter((r) => byHref.has(r.href) && (navFirst.get(r.href) || r.key) !== byHref.get(r.href).navKey);
  ok("…with the sidebar's own key", wrongKey.length === 0, wrongKey.map((w) => `${w.href}:${w.key}`).join(", "));
  ok("every catalogue href is a real route (or a declared prefix with a page beneath it)", APP_PAGES.every((p) => isRoutePattern(p.href) || (PREFIX_ONLY_HREFS.includes(p.href) && ROUTE_PATTERNS.some((r) => r.startsWith(`${p.href}/`)))), APP_PAGES.filter((p) => !isRoutePattern(p.href)).map((p) => p.href).join(", "));
  ok("no duplicate href", new Set(APP_PAGES.map((p) => p.href)).size === APP_PAGES.length);
  ok("every matrix key exists on the pricing page", APP_PAGES.every((p) => p.matrix === null || MATRIX_KEYS.includes(p.matrix)), APP_PAGES.filter((p) => p.matrix && !MATRIX_KEYS.includes(p.matrix)).map((p) => p.matrix).join(", "));
  ok("every registry key exists", APP_PAGES.every((p) => p.feature === null || REGISTRY_KEYS.includes(p.feature)));
  ok("every /app pattern resolves to a row", APP_ROUTE_PATTERNS.every((p) => featurePageFor(p)), APP_ROUTE_PATTERNS.filter((p) => !featurePageFor(p)).join(", "));
  ok("the longest prefix wins", featurePageFor("/app/settings/team/timesheets").href === "/app/settings/team/timesheets" && featurePageFor("/app/settings/team/new").href === "/app/settings/team" && featurePageFor("/app/marketing/designer/[id]").href === "/app/marketing/designer");
  ok("/app matches only itself", featurePageFor("/app").navKey === "app.nav.home" && featurePageFor("/app/quotes/[id]").navKey === "app.nav.quotes");
  ok("every navKey is an English catalogue key", APP_PAGES.every((p) => typeof APP_MESSAGES.en[p.navKey] === "string"), APP_PAGES.filter((p) => typeof APP_MESSAGES.en[p.navKey] !== "string").map((p) => p.navKey).join(", "));
}

// ── 8. Wiring ─────────────────────────────────────────────────────────────
section("8. wiring");
{
  for (const [key, where] of Object.entries(FEATURES)) {
    const files = where.split(" + ");
    ok(`feature_used "${key}" is emitted by ${where}`, files.every((f) => read(f).includes(`recordFeatureUse("${key}"`)));
  }
  const rsp = read("lib/invoices/recordStripePayment.js");
  ok("the Stripe payment writer forwards ITS db to the emitter and skips a replay", /if \(!already\) await recordFeatureUse\("payment_collected", \{ companyId: inv\.companyId \}, \{ client: db \}\)/.test(rsp));
  const reply = read("app/api/messaging/threads/[id]/reply/route.js");
  ok("message_sent is recorded only after the !result.ok return", reply.indexOf('recordFeatureUse("message_sent"') > reply.indexOf("if (!result.ok) {"));
  const review = read("app/api/quotes/[id]/review/route.js");
  ok("ai_review_run is recorded after the review is stored", review.indexOf('recordFeatureUse("ai_review_run"') > review.indexOf("data: { aiReview: review"));
  const billing = read("lib/platform/stripeBilling.js");
  ok("signup completion is recorded where the Subscription row is written", billing.indexOf("recordSignupCompleted({ companyId })") > billing.indexOf("db.subscription.upsert("));
  ok("the root layout mounts the beacon once", (read("app/layout.js").match(/<AnalyticsBeacon \/>/g) || []).length === 1);
  const track = read("app/api/track/route.js");
  ok("the track route rate-limits, parses text, and answers 204", /rateLimit\(request, "track"/.test(track) && /request\.text\(\)/.test(track) && /status: 204/.test(track));
  ok("…drops an impersonation session", /!member\.impersonation/.test(track));
  ok("…and never trusts the browser's surface", !/body\.s\b/.test(track.replace(/\/\/.*$/gm, "")));
  const signup = read("app/signup/page.js");
  ok("the signup page emits each step and checkout_started at both handoffs", /trackSignupStep\(funnelStep\)/.test(signup) && (signup.match(/trackCheckoutStarted\(\);/g) || []).length === 2);
  ok("the help search emits after the typing settles", /trackHelpSearch\(q, results\.length\)/.test(read("app/components/help-centre/HelpSearch.js")));
  const trackLib = read("lib/analytics/track.js");
  ok("only a page view schedules a flush; hide and pagehide flush", /if \(event === "page_view"\) scheduleFlush\(\);/.test(trackLib) && /addEventListener\("pagehide", flush\)/.test(trackLib) && /visibilitychange/.test(trackLib));
  ok("the tracker normalises before queueing and sends no cookie", /normalisePath\(/.test(trackLib) && !/document\.cookie/.test(trackLib));
  ok("localhost sends nothing unless opted in", /fieldquo:track-local/.test(trackLib));
  const vercel = JSON.parse(read("vercel.json"));
  ok("the compaction cron is scheduled", vercel.crons.some((c) => c.path === "/api/cron/analytics-compact"));
  ok("the cron route requires the secret", /requireCronSecret\(request\)/.test(read("app/api/cron/analytics-compact/route.js")));
  ok("the platform rail has the row", /href: "\/platform\/analytics"/.test(read("app/components/platform/PlatformSidebar.js")));
  const platformApi = read("app/api/platform/analytics/product/route.js");
  ok("the platform route admits superadmin and admin only and writes nothing", /new Set\(\["superadmin", "admin"\]\)/.test(platformApi) && !/\.(create|update|upsert|delete)\w*\(/.test(platformApi));
  const salesApi = read("app/api/sales/product-usage/route.js");
  ok("the sales route rides requireSalesRep, reads the app surface only, and uses the gated aggregate", /requireSalesRep\(request\)/.test(salesApi) && /surface: "app"/.test(salesApi) && /salesTopFeatures\(rows/.test(salesApi) && !/companyId|name:/.test(salesApi.replace(/\/\/.*$/gm, "")));
  ok("the card is on /sales and in the Playbook", /<ProductUsageCard \/>/.test(read("app/sales/page.js")) && /<ProductUsageCard compact \/>/.test(read("app/sales/playbook/PlaybookView.js")));
  ok("the privacy page says page views are measured first-party", /without any third-party\s+analytics service, tracking cookie or advertising pixel/.test(read("app/(marketing)/privacy/page.js")));
  for (const lang of ["en", "fr", "es"]) {
    ok(`the ${lang} data-and-privacy article carries the sentence`, /(analytic|analyse Web|analítica web)/i.test(read(`content/help/${lang}/integrations.js`)) && /(cookie|témoin)/i.test(read(`content/help/${lang}/integrations.js`)) && /\bIP\b/.test(read(`content/help/${lang}/integrations.js`)));
  }
  const keys = ["title", "lastDays", "intro", "playbookIntro", "notEnough", "companies", "loadFailed", "loading", "tryAgain"].map((k) => `app.salesUsage.${k}`);
  for (const lang of Object.keys(APP_MESSAGES)) {
    ok(`${lang} carries every app.salesUsage key`, keys.every((k) => typeof APP_MESSAGES[lang][k] === "string" && APP_MESSAGES[lang][k].length > 0));
  }
  ok("notEnough names the threshold and the count in every language", Object.values(APP_MESSAGES).every((d) => /\{threshold\}/.test(d["app.salesUsage.notEnough"]) && /\{count\}/.test(d["app.salesUsage.notEnough"])));
  const schema = read("prisma/schema.prisma");
  ok("the two models are additive (no @relation)", /model AnalyticsEvent \{[\s\S]*?\n\}/.test(schema) && !/model AnalyticsEvent \{[\s\S]*?@relation[\s\S]*?\n\}/.test(schema.match(/model AnalyticsEvent \{[\s\S]*?\n\}/)[0]) && !/@relation/.test(schema.match(/model AnalyticsDaily \{[\s\S]*?\n\}/)[0]));
  ok("no IP column exists on either table", !/ip\b/i.test(schema.match(/model AnalyticsEvent \{[\s\S]*?\n\}/)[0].replace(/\/\/\/.*$/gm, "")));
  const storeSrc = read("lib/analytics/product/store.js").replace(/\/\/.*$/gm, "");
  ok("the store's only deleteMany is on analyticsEvent by createdAt range", (storeSrc.match(/deleteMany\(/g) || []).length === 1 && /analyticsEvent\.deleteMany\(\{\s*where: \{ createdAt: \{ gte: plan\.deleteWhere\.createdAt\.gte, lt: plan\.deleteWhere\.createdAt\.lt \} \}/.test(storeSrc));
  const libDeletes = ["lib/analytics/product/server.js", "lib/analytics/product/queries.js", "lib/analytics/product/aggregate.js", "lib/analytics/product/rollup.js", "app/api/track/route.js", "app/api/platform/analytics/product/route.js", "app/api/sales/product-usage/route.js"].filter((f) => /\.delete(Many)?\(/.test(read(f).replace(/\/\/.*$/gm, "")));
  ok("no other analytics file deletes anything", libDeletes.length === 0, libDeletes.join(", "));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
