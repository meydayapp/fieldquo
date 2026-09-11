// scripts/check-spend-currency.mjs
//
//   npm run check:spend-currency
//
// A CAD company connected a USD ad account, and the KPI card said
// "MARKETING SPEND $0.00" over 43 rows of real spend. This file asserts the
// three things the fix has to hold at once, executed against fixtures rather
// than read off the code:
//
//   1. A company with rows in another currency gets a total that INCLUDES
//      them, converted at lib/marketing/fx.js's pinned rate, marked
//      approximate, with the original amount and the rate's age beside it.
//   2. When the rate is refused — past its 45-day window, or a pair fx.js
//      does not hold — the rows are EXCLUDED and the payload names the
//      currency, the amount and the reason. Absence is never silent.
//   3. A same-currency company's numbers are unchanged: every figure the old
//      exclusion path produced is reproduced byte-for-byte, so nobody whose
//      rows never carried a currency sees a different number after this.
//
// Then it mutates lib/analytics/spendCurrency.js and marketingRollup.js on
// disk, one bug at a time, and re-runs itself to prove each assertion is
// load-bearing (the technique scripts/check-kpis.mjs explains).
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs scripts/check-spend-currency.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { priceSpendRows, spendRate } from "@/lib/analytics/spendCurrency";
import { rollupSpendRows } from "@/lib/analytics/marketingRollup";
import { RATES, RATE_STALE_AFTER_DAYS } from "@/lib/marketing/fx";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

const USD_CAD = RATES.find((r) => r.base === "USD" && r.quote === "CAD");
// A fixed clock, 14 days after the rate's date — inside the window, and the
// age the note under the card will print. Never the wall clock: a check whose
// answer depends on what day it is passes on Monday and fails on Tuesday.
const dayAfter = (iso, n) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const FRESH = dayAfter(USD_CAD.rateDate, 14);
const STALE = dayAfter(USD_CAD.rateDate, RATE_STALE_AFTER_DAYS + 1);

// The owner's shape: three campaigns, ~14 days, USD, plus a hand-typed CAD
// pamphlet row so the total has something native to add to.
const OWNER_ROWS = [
  { platform: "facebook", amount: 300.25, currency: "USD", leads: 0, conversions: 4, clicks: 100, impressions: 5000 },
  { platform: "facebook", amount: 321.25, currency: "USD", leads: 0, conversions: 2, clicks: 80, impressions: 4000 },
  { platform: "facebook", amount: 200.0, currency: "USD", leads: 0, conversions: 1, clicks: 20, impressions: 1000 },
  { platform: "pamphlet", amount: 150.0, currency: null, leads: 3, conversions: null, clicks: null, impressions: null },
];
const USD_TOTAL = 821.5;

console.log("\n1. A CAD company with USD rows gets an approximate total, not $0.00\n");
{
  const r = rollupSpendRows({ rows: OWNER_ROWS, companyCurrency: "CAD", asOf: FRESH });
  const expectedConverted = Math.round(USD_TOTAL * USD_CAD.rate * 100) / 100;
  ok("the total INCLUDES the USD rows", r.totals.spend > 150, r.totals.spend);
  ok("…converted at the pinned rate, to the cent", r.totals.spend === Math.round((expectedConverted + 150) * 100) / 100, [r.totals.spend, expectedConverted + 150]);
  ok("…and is flagged approximate", r.totals.approximate === true);
  ok("…naming the currency it was converted from", JSON.stringify(r.totals.convertedFrom) === '["USD"]', r.totals.convertedFrom);
  const c = r.totals.currencyConversions[0];
  ok("…with the original amount, US$821.50", c && c.currency === "USD" && c.amount === USD_TOTAL, c);
  ok("…the converted amount", c && c.convertedAmount === expectedConverted, c && c.convertedAmount);
  ok("…the rate and its date", c && c.rate === USD_CAD.rate && c.rateDate === USD_CAD.rateDate, c);
  ok("…and the rate's age in days (14, on this clock)", c && c.rateAgeDays === 14, c && c.rateAgeDays);
  ok("…and the rate's source, in words", c && typeof c.rateSourceName === "string" && c.rateSourceName.includes("Bank of Canada"), c && c.rateSourceName);
  ok("nothing was excluded", r.totals.excluded.length === 0 && r.excludedCurrencyMismatch.count === 0, r.totals.excluded);
  const fb = r.channels.find((x) => x.platform === "facebook");
  const pam = r.channels.find((x) => x.platform === "pamphlet");
  ok("the Facebook channel is approximate and says what it converted", fb && fb.approximate === true && fb.convertedFrom[0].currency === "USD" && fb.convertedFrom[0].amount === USD_TOTAL, fb);
  ok("…its spend is the converted figure", fb && fb.spend === expectedConverted, fb && fb.spend);
  ok("the pamphlet channel is NOT approximate — nothing in it was converted", pam && pam.approximate === false && pam.convertedFrom.length === 0, pam);
  ok("the Facebook channel's non-money counts are untouched by the conversion", fb && fb.clicks === 200 && fb.impressions === 10000 && fb.conversions === 7, fb);
  ok("cost per conversion is computed off the converted spend", fb && fb.costPerConversion === Math.round((USD_TOTAL * USD_CAD.rate) / 7 * 100) / 100, fb && fb.costPerConversion);
}

console.log("\n2. A stale rate refuses, names the amount, and the total says what is missing\n");
{
  const r = rollupSpendRows({ rows: OWNER_ROWS, companyCurrency: "CAD", asOf: STALE });
  ok("the USD rows are left OUT of the total", r.totals.spend === 150, r.totals.spend);
  ok("…and the total is not marked approximate (nothing in it was converted)", r.totals.approximate === false);
  ok("…the exclusion names the currency and the amount", r.totals.excluded.length === 1 && r.totals.excluded[0].currency === "USD" && r.totals.excluded[0].amount === USD_TOTAL, r.totals.excluded);
  ok("…and the reason, in fx.js's own words", /days old, past the \d+-day window/.test(r.totals.excluded[0].reason), r.totals.excluded[0].reason);
  ok("…and how many rows", r.totals.excluded[0].count === 3, r.totals.excluded[0]);
  ok("…and a reason CODE a translated screen can key on, with the rate's age and the window",
    r.totals.excluded[0].reasonCode === "stale_rate" && r.totals.excluded[0].rateAgeDays === RATE_STALE_AFTER_DAYS + 1 && r.totals.excluded[0].windowDays === RATE_STALE_AFTER_DAYS,
    r.totals.excluded[0]);
  ok("the legacy excludedCurrencyMismatch shape still reports it", r.excludedCurrencyMismatch.count === 3 && r.excludedCurrencyMismatch.byCurrency.USD === USD_TOTAL, r.excludedCurrencyMismatch);
  ok("no Facebook channel appears from refused rows alone", !r.channels.some((x) => x.platform === "facebook"), r.channels.map((x) => x.platform));
}
{
  const r = rollupSpendRows({ rows: [{ platform: "google", amount: 99, currency: "CHF", leads: 0 }], companyCurrency: "CAD", asOf: FRESH });
  ok("a pair fx.js does not hold is refused, with the amount named", r.totals.excluded.length === 1 && r.totals.excluded[0].amount === 99 && r.totals.excluded[0].currency === "CHF", r.totals.excluded);
  ok("…and the reason says there is no rate", /no rate/.test(r.totals.excluded[0].reason), r.totals.excluded[0].reason);
  ok("…with the matching code", r.totals.excluded[0].reasonCode === "no_rate" && r.totals.excluded[0].rateAgeDays === null, r.totals.excluded[0]);
  ok("…and the total is 0 with nothing approximate about it", r.totals.spend === 0 && r.totals.approximate === false);
}
{
  const r = rollupSpendRows({ rows: [{ platform: "facebook", amount: 10, currency: "USD" }, { platform: "google", amount: 5, currency: "CHF" }], companyCurrency: "CAD", asOf: FRESH });
  ok("one currency can convert while another is refused, and both are reported", r.totals.approximate === true && r.totals.excluded.length === 1 && r.totals.excluded[0].currency === "CHF" && r.totals.convertedFrom[0] === "USD");
}
{
  // The reverse direction: a US company whose ad account reports in CAD
  // — the pinned rate applied in reverse, inverted, still approximate.
  const r = rollupSpendRows({ rows: [{ platform: "facebook", amount: 138.88, currency: "CAD" }], companyCurrency: "USD", asOf: FRESH });
  ok("a USD company with CAD rows converts too, with the rate applied in reverse", r.totals.approximate === true && r.totals.currencyConversions[0].inverted === true && r.totals.spend === 100, r.totals);
}

console.log("\n3. A same-currency company's numbers are unchanged\n");
{
  // The ORIGINAL rollup arithmetic, as it stood before conversion existed,
  // reproduced here so the comparison is against what the code USED to say
  // rather than against what it says now.
  const legacy = (rows) => {
    const round2 = (n) => Math.round(n * 100) / 100;
    const round4 = (n) => Math.round(n * 10000) / 10000;
    const byChannel = {};
    for (const entry of rows) {
      const key = entry.platform;
      if (!byChannel[key]) byChannel[key] = { platform: key, spend: 0, leads: 0, conversions: 0, clicks: 0, impressions: 0 };
      byChannel[key].spend += Number(entry.amount);
      byChannel[key].leads += entry.leads || 0;
      byChannel[key].conversions += entry.conversions || 0;
      byChannel[key].clicks += entry.clicks || 0;
      byChannel[key].impressions += entry.impressions || 0;
    }
    const channels = Object.values(byChannel).map((c) => ({
      ...c,
      spend: round2(c.spend),
      costPerLead: c.leads > 0 ? round2(c.spend / c.leads) : null,
      costPerConversion: c.conversions > 0 ? round2(c.spend / c.conversions) : null,
      clickThroughRate: c.impressions > 0 ? round4(c.clicks / c.impressions) : null,
      leadConversionRate: c.leads > 0 ? round4(c.conversions / c.leads) : null,
    }));
    const totalSpend = channels.reduce((s, c) => s + c.spend, 0);
    const totalLeads = channels.reduce((s, c) => s + c.leads, 0);
    return {
      channels: channels.sort((a, b) => b.spend - a.spend),
      totals: { spend: round2(totalSpend), leads: totalLeads, handTypedBlendedCostPerLead: totalLeads > 0 ? round2(totalSpend / totalLeads) : null },
    };
  };
  const NATIVE_ROWS = [
    // 0.1 + 1.05 is 1.1500000000000001 in floating point, and over 2
    // conversions the old code divided that UNROUNDED sum (0.58); rounding
    // the sum first gives 0.57. A fixture chosen on purpose, by brute force,
    // so "byte-identical" is measured at a point where it can fail.
    { platform: "facebook", amount: "0.1", currency: null, leads: 2, conversions: 1, clicks: 7, impressions: 999 },
    { platform: "facebook", amount: 1.05, currency: null, leads: 0, conversions: 1, clicks: 3, impressions: 1 },
    { platform: "google", amount: 0.2, currency: null, leads: 1, conversions: 0, clicks: null, impressions: null },
    { platform: "referral", amount: 12.5, currency: "CAD", leads: 0 },
  ];
  const now = rollupSpendRows({ rows: NATIVE_ROWS, companyCurrency: "CAD", asOf: FRESH });
  const then = legacy(NATIVE_ROWS);
  const LEGACY_CHANNEL_KEYS = ["platform", "spend", "leads", "conversions", "clicks", "impressions", "costPerLead", "costPerConversion", "clickThroughRate", "leadConversionRate"];
  const pick = (o, keys) => Object.fromEntries(keys.map((k) => [k, o[k]]));
  ok("every channel figure the old code produced is byte-identical",
    JSON.stringify(now.channels.map((c) => pick(c, LEGACY_CHANNEL_KEYS))) === JSON.stringify(then.channels),
    [now.channels, then.channels]);
  ok("…and so are the totals", now.totals.spend === then.totals.spend && now.totals.leads === then.totals.leads && now.totals.handTypedBlendedCostPerLead === then.totals.handTypedBlendedCostPerLead, [now.totals, then.totals]);
  ok("nothing is approximate", now.totals.approximate === false && now.channels.every((c) => c.approximate === false));
  ok("nothing was converted or excluded", now.totals.convertedFrom.length === 0 && now.totals.currencyConversions.length === 0 && now.totals.excluded.length === 0);
  ok("a row carrying the company's OWN code is native, not converted", now.channels.find((c) => c.platform === "referral").approximate === false);
  ok("the same-currency answer does not depend on the clock", JSON.stringify(rollupSpendRows({ rows: NATIVE_ROWS, companyCurrency: "CAD", asOf: STALE })) === JSON.stringify(now));
}

console.log("\n4. The pure pieces, against hostile input\n");
ok("spendRate refuses to guess what day it is", (() => { try { spendRate({ from: "USD", to: "CAD" }); return false; } catch { return true; } })());
ok("priceSpendRows refuses to guess what day it is", (() => { try { priceSpendRows({ rows: [], companyCurrency: "CAD" }); return false; } catch { return true; } })());
ok("a garbage currency code is a refusal, not a crash", spendRate({ from: "dollars", to: "CAD", asOf: FRESH }).refusedBecause !== null);
ok("same currency is a multiplier of exactly 1 with no rate", (() => { const r = spendRate({ from: "CAD", to: "CAD", asOf: FRESH }); return r.multiplier === 1 && r.rate === null && r.refusedBecause === null; })());
ok("a Prisma Decimal-shaped amount (object with toString) is read as a number",
  rollupSpendRows({ rows: [{ platform: "facebook", amount: { toString: () => "12.34" }, currency: null }], companyCurrency: "CAD", asOf: FRESH }).totals.spend === 12.34);
ok("empty rows produce an empty, honest rollup",
  (() => { const r = rollupSpendRows({ rows: [], companyCurrency: "CAD", asOf: FRESH }); return r.totals.spend === 0 && r.channels.length === 0 && r.totals.approximate === false && r.totals.excluded.length === 0; })());
ok("null rows do not throw", rollupSpendRows({ rows: null, companyCurrency: "CAD", asOf: FRESH }).totals.spend === 0);

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);

if (process.argv.includes("--no-mutate")) {
  process.exit(fails.length ? 1 : 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Mutation pass
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n5. Mutation pass\n");

const FX_LIB = fileURLToPath(new URL("../lib/analytics/spendCurrency.js", import.meta.url));
const ROLLUP_LIB = fileURLToPath(new URL("../lib/analytics/marketingRollup.js", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));
const DB_STUB = fileURLToPath(new URL("./db-stub-loader.mjs", import.meta.url));
const ORIGINALS = new Map([[FX_LIB, readFileSync(FX_LIB, "utf8")], [ROLLUP_LIB, readFileSync(ROLLUP_LIB, "utf8")]]);

const MUTATIONS = [
  ["spendCurrency.js", FX_LIB, "converts anyway when the rate is refused (stale rate silently applied)",
    (s) => s.replace("if (r.refusedBecause) {\n      excluded.push({", "if (false) {\n      excluded.push({")],
  ["spendCurrency.js", FX_LIB, "drops the refused rows without reporting them",
    (s) => s.replace("      excluded.push({\n        currency,", "      void 0; ({\n        currency,")],
  ["spendCurrency.js", FX_LIB, "reports the total as exact after converting",
    (s) => s.replace("approximate: converted.length > 0,", "approximate: false,")],
  ["spendCurrency.js", FX_LIB, "forgets the rate's age",
    (s) => s.replace("      rateAgeDays: r.ageDays,\n      rateSourceName", "      rateAgeDays: null,\n      rateSourceName")],
  ["spendCurrency.js", FX_LIB, "codes every refusal as stale",
    (s) => s.replace('reasonCode: !rate ? "no_rate" : /days old/.test(refusedBecause) ? "stale_rate" : "unusable_rate",', 'reasonCode: "stale_rate",')],
  ["spendCurrency.js", FX_LIB, "reports the converted amount as the original amount",
    (s) => s.replace("convertedAmount: round2(g.amount * r.multiplier),", "convertedAmount: round2(g.amount),")],
  ["spendCurrency.js", FX_LIB, "sums the foreign amount unconverted (the bug the exclusion existed to prevent)",
    (s) => s.replace("return { row, amountInCompanyCurrency: (Number(row.amount) || 0) * m, converted: true };", "return { row, amountInCompanyCurrency: (Number(row.amount) || 0), converted: true };")],
  ["spendCurrency.js", FX_LIB, "treats a row carrying the company's own currency code as foreign",
    (s) => s.replace("const isNative = (row) => !row?.currency || row.currency === companyCurrency;", "const isNative = (row) => !row?.currency;")],
  ["spendCurrency.js", FX_LIB, "applies the pinned rate in the wrong direction for a USD company",
    (s) => s.replace("multiplier: inverted ? 1 / rate.rate : rate.rate,", "multiplier: rate.rate,")],
  ["marketingRollup.js", ROLLUP_LIB, "counts a refused row's spend into its channel anyway",
    (s) => s.replace("if (amountInCompanyCurrency === null) continue;", "if (amountInCompanyCurrency === null) { /* fall through */ }")],
  ["marketingRollup.js", ROLLUP_LIB, "marks every channel approximate, not only the one with converted rows",
    (s) => s.replace("        approximate: false,\n        conversions_: {},", "        approximate: true,\n        conversions_: {},")],
  ["marketingRollup.js", ROLLUP_LIB, "loses the per-channel record of what was converted",
    (s) => s.replace("      byChannel[key].conversions_[cur] = c;", "")],
  ["marketingRollup.js", ROLLUP_LIB, "stops passing the exclusions through to the totals",
    (s) => s.replace("      excluded: pricing.excluded,", "      excluded: [],")],
  ["marketingRollup.js", ROLLUP_LIB, "rounds each channel's spend before dividing for cost per conversion (changes the same-currency figures)",
    (s) => s.replace("costPerConversion:\n      c.conversions > 0 ? round2(c.spend / c.conversions) : null,", "costPerConversion:\n      c.conversions > 0 ? round2(round2(c.spend) / c.conversions) : null,")],
];

let caught = 0;
const escaped = [];
try {
  for (const [fileLabel, filePath, label, mutate] of MUTATIONS) {
    const original = ORIGINALS.get(filePath);
    const mutated = mutate(original);
    if (mutated === original) {
      escaped.push(`${fileLabel}: ${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(filePath, mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, "--import", DB_STUB, SELF, "--no-mutate"], { stdio: ["ignore", "pipe", "pipe"] });
      survived = true;
    } catch {
      /* non-zero exit = caught */
    }
    writeFileSync(filePath, original);
    if (survived) escaped.push(`${fileLabel}: ${label} — NOT caught`);
    else {
      caught++;
      console.log(`  ✓ caught: ${fileLabel}: ${label}`);
    }
  }
} finally {
  for (const [filePath, original] of ORIGINALS) writeFileSync(filePath, original);
}
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
