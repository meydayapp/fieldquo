// scripts/check-fx-refresh.mjs
//
//   npm run check:fx-refresh
//
// The automatic exchange rate (owner's decision, 2026-10-03): a daily cron
// fetches the Bank of Canada's rate (lib/marketing/fxRefresh.js), stores it
// (ExchangeRate), and the converters read the newest stored rate with the
// checked-in one as the fallback (lib/marketing/fxLive.js).
//
// No network: every fetch here is a scripted fake, and globalThis.fetch is
// replaced with one that FAILS the check if anything reaches for it.
//
// What has to hold:
//   • a good answer is stored once per pair per day; a bad one writes nothing
//     and lands on /platform/errors — HTTP error, network error, a changed
//     JSON shape, an implausible value, a database refusal
//   • a stored rate is used only when it is usable and at least as new as the
//     checked-in one; an empty, missing, broken or stale store falls back
//   • while the cron is healthy the 45-day refusal cannot drop spend, even
//     when the checked-in fallback itself is long past it
//   • /platform's measure is days since the last SUCCESSFUL fetch

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RATES, RATE_STALE_AFTER_DAYS, rateHealth, rateFor } from "@/lib/marketing/fx";
import { mergeRates, refreshHealth, loadLiveRates, rateFromRow, FX_PAIRS, FETCH_FAILING_AFTER_DAYS, clearLiveRatesCache } from "@/lib/marketing/fxLive";
import { parseValet, plausible, refreshRates, valetUrl } from "@/lib/marketing/fxRefresh";
import { priceSpendRows } from "@/lib/analytics/spendCurrency";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const code = (p) =>
  readFileSync(path.join(ROOT, p), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");

let passed = 0;
const fails = [];
const ok = (name, cond, detail) => {
  if (cond) passed++;
  else fails.push(`${name}${detail === undefined ? "" : ` — ${String(JSON.stringify(detail)).slice(0, 300)}`}`);
};

// Nothing in this check may touch the network.
let networkTouched = false;
globalThis.fetch = async () => {
  networkTouched = true;
  throw new Error("check-fx-refresh: the real network was reached");
};

const USD_CAD = RATES.find((r) => r.base === "USD" && r.quote === "CAD");
const day = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000);
const iso = (d) => d.toISOString().slice(0, 10);
const NOW = new Date("2026-10-05T22:15:00Z");

const valetBody = (obs) => ({
  terms: { url: "https://www.bankofcanada.ca/terms/" },
  seriesDetail: { FXUSDCAD: { label: "USD/CAD" } },
  observations: obs,
});
const okResponse = (body) => ({ ok: true, status: 200, json: async () => body });

// ══════════════════════════════════════════════════════════════════════════
console.log("\nParsing the Valet answer");
{
  const p = parseValet(valetBody([{ d: "2026-10-02", FXUSDCAD: { v: "1.4246" } }, { d: "2026-10-01", FXUSDCAD: { v: "1.4243" } }]), { base: "USD", quote: "CAD" });
  ok("the newest observation wins", p.ok && p.rate === 1.4246 && p.rateDate === "2026-10-02", p);
  const unordered = parseValet(valetBody([{ d: "2026-09-29", FXUSDCAD: { v: "1.4188" } }, { d: "2026-10-02", FXUSDCAD: { v: "1.4246" } }]), { base: "USD", quote: "CAD" });
  ok("…whatever order the API lists them in", unordered.ok && unordered.rateDate === "2026-10-02");
  const gap = parseValet(valetBody([{ d: "2026-10-05", FXUSDCAD: { v: "" } }, { d: "2026-10-02", FXUSDCAD: { v: "1.4246" } }]), { base: "USD", quote: "CAD" });
  ok("a blank (holiday) observation is skipped, not read as 0", gap.ok && gap.rateDate === "2026-10-02", gap);
  ok("no observations → refused", parseValet({}, { base: "USD", quote: "CAD" }).ok === false);
  ok("a renamed series → refused", parseValet(valetBody([{ d: "2026-10-02", FXUSDCADX: { v: "1.42" } }]), { base: "USD", quote: "CAD" }).ok === false);
  ok("a non-number → refused", parseValet(valetBody([{ d: "2026-10-02", FXUSDCAD: { v: "n/a" } }]), { base: "USD", quote: "CAD" }).ok === false);
  ok("zero or negative → refused", parseValet(valetBody([{ d: "2026-10-02", FXUSDCAD: { v: "0" } }]), { base: "USD", quote: "CAD" }).ok === false);
  ok("plausible: within half to double of the last known rate", plausible(1.42, 1.39) && !plausible(142.46, 1.39) && !plausible(0.5, 1.39));
  ok("the URL is the Valet series for the pair", valetUrl("USD", "CAD") === "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=5");
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe refresh: fetch mocked, store faked");
const fakeStore = ({ failUpsert = false } = {}) => {
  const upserts = [];
  return {
    upserts,
    prisma: {
      exchangeRate: {
        upsert: async (args) => {
          if (failUpsert) throw new Error('relation "ExchangeRate" does not exist');
          upserts.push(args);
          return args.create;
        },
      },
    },
  };
};
const run = async (fetchImpl, opts = {}) => {
  const store = fakeStore(opts);
  const errors = [];
  const results = await refreshRates({ prisma: store.prisma, fetchImpl, recordError: async (e) => errors.push(e), now: NOW });
  return { results, upserts: store.upserts, errors };
};
{
  const urls = [];
  const good = await run(async (url) => {
    urls.push(url);
    return okResponse(valetBody([{ d: "2026-10-02", FXUSDCAD: { v: "1.4246" } }]));
  });
  ok("one fetch per pair fx.js holds", urls.length === FX_PAIRS.length && urls[0].includes("FXUSDCAD"), urls);
  ok("a good answer is stored once", good.upserts.length === 1 && good.results[0].ok === true, good);
  const u = good.upserts[0];
  ok("…keyed on (base, quote, rateDate) so a second run the same day updates, not duplicates", u.where.base_quote_rateDate.base === "USD" && iso(u.where.base_quote_rateDate.rateDate) === "2026-10-02");
  ok("…with the rate, its date, a https source and a named source", u.create.rate === 1.4246 && u.create.source.startsWith("https://www.bankofcanada.ca/") && /Bank of Canada/.test(u.create.sourceName));
  ok("…and fetchedAt = now on both create and update (the 'update is working' clock)", +u.create.fetchedAt === +NOW && +u.update.fetchedAt === +NOW);
  ok("…nothing logged", good.errors.length === 0);

  const cases = [
    ["HTTP 503", async () => ({ ok: false, status: 503, json: async () => ({}) }), /HTTP 503/],
    ["network failure", async () => { throw new TypeError("fetch failed"); }, /could not be reached/],
    ["a changed JSON shape", async () => okResponse({ data: [] }), /observations/],
    ["an implausible value (a unit change upstream)", async () => okResponse(valetBody([{ d: "2026-10-02", FXUSDCAD: { v: "142.46" } }])), /half to double/],
    ["the body is not JSON", async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("Unexpected token <"); } }), /could not be reached/],
  ];
  for (const [label, impl, why] of cases) {
    const r = await run(impl);
    ok(`${label}: nothing is stored`, r.upserts.length === 0, r.upserts);
    ok(`${label}: one fx_refresh_failed row on /platform/errors, with the reason`, r.errors.length === 1 && r.errors[0].code === "fx_refresh_failed" && r.errors[0].area === "cron" && why.test(r.errors[0].message), r.errors);
    ok(`${label}: the result says so and the run does not throw`, r.results[0].ok === false);
  }
  const dbDown = await run(async () => okResponse(valetBody([{ d: "2026-10-02", FXUSDCAD: { v: "1.4246" } }])), { failUpsert: true });
  ok("the table is missing (deploy before CREATE TABLE): logged, not thrown", dbDown.errors.length === 1 && /could not be stored/.test(dbDown.errors[0].message) && dbDown.results[0].ok === false);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nReading: the stored rate, else the checked-in one");
const row = (over = {}) => ({
  base: "USD",
  quote: "CAD",
  rate: "1.4301",
  rateDate: day(USD_CAD.rateDate, 10),
  source: "https://www.bankofcanada.ca/valet/observations/FXUSDCAD/json?recent=1",
  sourceName: "Bank of Canada, daily average USD/CAD (series FXUSDCAD)",
  fetchedAt: day(USD_CAD.rateDate, 10),
  ...over,
});
{
  const asOf = day(USD_CAD.rateDate, 12);
  const live = mergeRates({ stored: [row()], asOf });
  const usd = live.find((r) => r.base === "USD");
  ok("a newer stored rate is used (a Decimal string becomes a number)", usd.live === true && usd.rate === 1.4301 && usd.rateDate === iso(day(USD_CAD.rateDate, 10)), usd);
  ok("…and fx.js's rules accept it as a rate", rateFor("USD", "CAD", live) === usd);
  ok("an empty store → the checked-in rate, unchanged", mergeRates({ stored: [], asOf })[0] === USD_CAD);
  const older = mergeRates({ stored: [row({ rateDate: day(USD_CAD.rateDate, -60), fetchedAt: day(USD_CAD.rateDate, -60) })], asOf })[0];
  ok("STALE STORE: a stored rate older than the checked-in one never wins", older === USD_CAD, older);
  ok("a future-dated row is a bad row, not a fresh one", mergeRates({ stored: [row({ rateDate: day(iso(asOf), 3) })], asOf })[0] === USD_CAD);
  ok("a non-positive rate is refused", rateFromRow(row({ rate: "0" })) === null && rateFromRow(row({ rate: "-1.2" })) === null);
  ok("a row with no https source is refused", rateFromRow(row({ source: "manual" })) === null);

  clearLiveRatesCache();
  const broken = await loadLiveRates({ prisma: { exchangeRate: { findFirst: async () => { throw new Error('relation "ExchangeRate" does not exist'); } } }, asOf, useCache: false });
  ok("a missing or unreadable table never throws — the checked-in rate, with the error named", broken.rates[0] === USD_CAD && broken.source === "fallback" && /does not exist/.test(broken.error), broken);
  const fine = await loadLiveRates({ prisma: { exchangeRate: { findFirst: async () => row() } }, asOf, useCache: false });
  ok("a readable table → the live rate", fine.source === "live" && fine.rates[0].rate === 1.4301);
  ok("…never fewer pairs than fx.js holds", fine.rates.length === RATES.length && broken.rates.length === RATES.length);
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nThe 45-day cutoff cannot drop spend while the cron is healthy");
{
  // Two hundred days after the checked-in rate's own date: the fallback alone
  // would refuse, and USD spend would be left out of the total.
  const asOf = day(USD_CAD.rateDate, 200);
  const rows = [{ amount: 100, currency: "USD" }, { amount: 50, currency: null }];
  const fallbackOnly = priceSpendRows({ rows, companyCurrency: "CAD", asOf: iso(asOf) });
  ok("(the premise) the checked-in rate alone would be refused by then", fallbackOnly.excluded.length === 1);
  // A healthy cron: its newest observation is Friday's, read on Monday.
  const healthy = mergeRates({ stored: [row({ rate: "1.40", rateDate: day(iso(asOf), -3), fetchedAt: day(iso(asOf), 0) })], asOf });
  const priced = priceSpendRows({ rows, companyCurrency: "CAD", asOf: iso(asOf), rates: healthy });
  ok("with a healthy daily fetch, the USD spend is converted, not dropped", priced.excluded.length === 0 && priced.approximate === true && priced.conversions[0].rate === 1.4, priced);
  ok("…for any weekend or long weekend the API can leave (Valet's newest is never > 4 days old)", 4 < RATE_STALE_AFTER_DAYS);
  ok("rateHealth judges the rate actually in use", rateHealth(iso(asOf), healthy)[0].state === "fresh" && rateHealth(iso(asOf))[0].state === "refused");
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\n/platform's measure: days since the last successful fetch");
{
  const asOf = new Date("2026-10-12T12:00:00Z");
  const h = (stored) => refreshHealth({ stored, asOf })[0];
  ok("fetched today → not failing", h([row({ fetchedAt: new Date("2026-10-12T09:00:00Z") })]).failing === false);
  ok("a weekend (Friday's rate, fetched today) is not a failure", h([row({ rateDate: new Date("2026-10-09T00:00:00Z"), fetchedAt: new Date("2026-10-12T09:00:00Z") })]).failing === false);
  const three = h([row({ fetchedAt: new Date("2026-10-09T09:00:00Z") })]);
  ok(`no success for ${FETCH_FAILING_AFTER_DAYS}+ days → failing, with the count`, three.failing === true && three.daysSinceFetch === 3, three);
  ok("no row at all → 'never ran', failing", h([]).neverRan === true && h([]).failing === true);
  const route = code("app/api/platform/fx-health/route.js");
  ok("the banner route reads the live list and the update health", /loadLiveRates\(/.test(route) && /refreshHealth\(/.test(route) && /rateHealth\(now, live\.rates\)/.test(route));
  ok("the banner says 'failed for N days'", /has failed for \$\{u\.daysSinceFetch\} days/.test(route));
}

// ══════════════════════════════════════════════════════════════════════════
console.log("\nWiring");
{
  const vercel = JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const cron = vercel.crons.find((c) => c.path === "/api/cron/fx-refresh");
  ok("the refresh is scheduled daily", cron && /^\d+ \d+ \* \* \*$/.test(cron.schedule), cron);
  const routeSrc = code("app/api/cron/fx-refresh/route.js");
  ok("the cron route is secret-gated", /requireCronSecret\(request\)/.test(routeSrc));
  ok("the spend converters read the live list", /loadLiveRates\(/.test(code("lib/analytics/marketingRollup.js")) && /loadLiveRates\(/.test(code("lib/analytics/campaignRollupData.js")));
  ok("the refresh writes only ExchangeRate", !/\.(create|update|delete|createMany|updateMany|deleteMany)\(/.test(code("lib/marketing/fxRefresh.js").replace(/exchangeRate\.upsert\(/, "")) && /exchangeRate\.upsert\(/.test(code("lib/marketing/fxRefresh.js")));
  const schema = readFileSync(path.join(ROOT, "prisma/schema.prisma"), "utf8");
  ok("the ExchangeRate model exists, unique per pair per day", /model ExchangeRate \{[\s\S]*?@@unique\(\[base, quote, rateDate\]\)/.test(schema));
  ok("fx.js records the owner's decision", /OVERRIDDEN by the owner, 2026-10-03/.test(readFileSync(path.join(ROOT, "lib/marketing/fx.js"), "utf8")));
}

ok("nothing in this check reached the network", networkTouched === false);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${passed + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${passed}/${passed} assertions`,
);
process.exit(fails.length ? 1 : 0);
