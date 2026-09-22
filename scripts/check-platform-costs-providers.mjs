#!/usr/bin/env node
//
// scripts/check-platform-costs-providers.mjs
//
//   npm run check:platform-costs-providers
//
// /platform/costs, executed: the OpenAI Costs parser against the shape the
// docs publish, the Neon consumption parser and its list-price arithmetic,
// Stripe balance transactions from the TEST account (a fixture when the
// account is empty or unreachable), the hand-entered bill's validation,
// statement and proration, the reconciliation arithmetic, the "waiting for
// <VAR>" states, and the three-way split summing to the page total.
//
// ══ Pure, judged by exit code, and it never writes ════════════════════════
//
// The local .env points at the PRODUCTION database, so nothing here writes
// a ledger row: the pull functions are exercised through the pure
// normalisers and an in-memory client, and the Stripe read is a read.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  OPENAI_TOTAL_CATEGORY,
  normaliseOpenaiCosts,
  openaiAdminConfigured,
  openaiCategory,
  reconcileOpenai,
  splitOpenaiCategory,
} from "@/lib/platform/costs/openaiCosts";
import {
  NEON_LIST_RATES,
  NEON_METRICS,
  hoursInMonthOf,
  neonPlanKey,
  normaliseNeonConsumption,
  priceNeonMetric,
} from "@/lib/platform/costs/neonConsumption";
import {
  fetchStripeBalanceTransactions,
  normaliseStripeBalanceTransactions,
  splitStripeCategory,
} from "@/lib/platform/costs/stripeFees";
import {
  FIXED_BILL_PROVIDERS,
  createFixedBill,
  fixedBillSection,
  fixedBillStatement,
  fixedBillsForPeriod,
  listFixedBills,
  monthDate,
  parseFixedBillInput,
  updateFixedBill,
} from "@/lib/platform/costs/fixedBills";
import { DAILY_PROVIDERS, PULL_MAX_AGE_MS, pullDailyProvidersIfStale, pullProvider, providerConfiguration } from "@/lib/platform/costs/providerPulls";
import { writeDailyRows } from "@/lib/platform/costs/ledgerWrite";
import { SECTION_KEYS, buildSections, groupOpenaiBilled, perUnitStatement } from "@/lib/platform/costs/sections";
import { periodBounds, RANGES } from "@/lib/platform/costs/summary";
import { applyDailyRows } from "@/lib/platform/costs/dailyLedger";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) => src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (t) => console.log(`\n${t}\n`);
const near = (a, b, eps = 0.01) => Math.abs(Number(a) - Number(b)) <= eps;

/** An in-memory PlatformCostDaily / PlatformFixedBill, enough for the writers. */
function fakeClient() {
  const daily = new Map();
  const bills = new Map();
  let seq = 0;
  const key = (w) => `${w.day.toISOString().slice(0, 10)}|${w.provider}|${w.category}`;
  return {
    daily,
    bills,
    platformCostDaily: {
      async upsert({ where, create, update }) {
        const k = key(where.day_provider_category);
        daily.set(k, daily.has(k) ? { ...daily.get(k), ...update } : { ...create });
        return daily.get(k);
      },
      async groupBy() {
        const out = new Map();
        for (const r of daily.values()) {
          const cur = out.get(r.provider);
          if (!cur || r.fetchedAt > cur) out.set(r.provider, r.fetchedAt);
        }
        return [...out.entries()].map(([provider, fetchedAt]) => ({ provider, _max: { fetchedAt } }));
      },
    },
    platformFixedBill: {
      async create({ data }) {
        const id = `bill_${++seq}`;
        const row = { id, ...data, enteredAt: new Date("2026-09-19T12:00:00Z"), updatedAt: new Date("2026-09-19T12:00:00Z"), voidedAt: null, enteredBy: { id: data.enteredById, email: "emilio.boves@example.com" } };
        bills.set(id, row);
        return row;
      },
      async update({ where, data }) {
        const row = bills.get(where.id);
        if (!row) {
          const e = new Error("not found");
          e.code = "P2025";
          throw e;
        }
        Object.assign(row, data, { updatedAt: new Date("2026-09-20T12:00:00Z") });
        return row;
      },
      async findMany({ where }) {
        return [...bills.values()].filter((b) => b.periodMonth >= where.periodMonth.gte && b.periodMonth <= where.periodMonth.lte && (where.voidedAt === undefined || b.voidedAt === null));
      },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
section("OpenAI — the organisation Costs endpoint's shape, parsed");
{
  // The response the docs print for `usage-costs` (openai/openai-openapi,
  // read 2026-09-19), plus a grouped bucket in the same schema.
  const docsSample = {
    object: "page",
    data: [
      {
        object: "bucket",
        start_time: 1730419200,
        end_time: 1730505600,
        results: [{ object: "organization.costs.result", amount: { value: 0.06, currency: "usd" }, line_item: null, project_id: null, api_key_id: null, quantity: null, quantity_unit: null }],
      },
    ],
    has_more: false,
    next_page: null,
  };
  const { rows, dropped } = normaliseOpenaiCosts(docsSample.data, { fetchedAt: new Date("2026-09-19T10:00:00Z") });
  ok("the docs sample yields one line and one total row for 2024-11-01", rows.length === 2 && rows.every((r) => r.day === "2024-11-01" && r.provider === "openai") && dropped === 0, rows);
  ok("…the line is 6 cents under org/all and the total is 6 cents", rows.find((r) => r.category === openaiCategory(null, null)).cents === 6 && rows.find((r) => r.category === OPENAI_TOTAL_CATEGORY).cents === 6);
  const grouped = [
    {
      object: "bucket",
      start_time: Date.UTC(2026, 8, 18) / 1000,
      end_time: Date.UTC(2026, 8, 19) / 1000,
      results: [
        { object: "organization.costs.result", amount: { value: 0.4105, currency: "usd" }, line_item: "gpt-5-mini, input_tokens", project_id: "proj_sales", quantity: 3_150_000, quantity_unit: "tokens" },
        { object: "organization.costs.result", amount: { value: 0.02, currency: "usd" }, line_item: "gpt-5-mini, output_tokens", project_id: "proj_sales", quantity: 20_000, quantity_unit: "tokens" },
        { object: "organization.costs.result", amount: { value: 0.0, currency: "usd" }, line_item: "whisper-1, audio", project_id: "proj_sales", quantity: 0, quantity_unit: "seconds" },
        { object: "organization.costs.result", amount: { value: "not a number" }, line_item: "garbage", project_id: "proj_sales" },
      ],
    },
    { object: "bucket", start_time: Date.UTC(2026, 8, 19) / 1000, end_time: Date.UTC(2026, 8, 20) / 1000, results: [] },
    { object: "bucket", start_time: "yesterday", results: [{ amount: { value: 1 } }] },
  ];
  const g = normaliseOpenaiCosts(grouped, { fetchedAt: new Date("2026-09-19T10:00:00Z") });
  ok("a grouped bucket keeps the project and the line item verbatim in the category", g.rows.some((r) => r.category === "proj_sales/gpt-5-mini, input_tokens" && near(r.cents, 41.05, 0.0001) && r.units === 3_150_000 && r.unit === "tokens"));
  ok("the day's total is the sum of its readable results", near(g.rows.find((r) => r.day === "2026-09-18" && r.category === OPENAI_TOTAL_CATEGORY).cents, 43.05, 0.0001));
  ok("an empty bucket still writes a $0 total row, so 'no spend' and 'never pulled' differ", g.rows.some((r) => r.day === "2026-09-19" && r.category === OPENAI_TOTAL_CATEGORY && r.cents === 0 && r.count === 0));
  ok("an unreadable amount and an unreadable bucket are dropped and counted, never guessed", g.dropped === 2 && !g.rows.some((r) => r.category.includes("garbage")), g.dropped);
  const split = splitOpenaiCategory("proj_sales/gpt-5-mini, input_tokens");
  ok("the category splits back into project and line item", split.projectId === "proj_sales" && split.lineItem === "gpt-5-mini, input_tokens");
  ok("org/all splits to nulls", splitOpenaiCategory(openaiCategory(null, null)).projectId === null && splitOpenaiCategory(openaiCategory(null, null)).lineItem === null);
  const ledger = applyDailyRows(new Map(), g.rows);
  applyDailyRows(ledger, normaliseOpenaiCosts(grouped, { fetchedAt: new Date() }).rows);
  ok("pulling the same day twice replaces, never doubles", ledger.size === g.rows.length && near(ledger.get("2026-09-18|openai|total").cents, 43.05, 0.0001));
  const byProject = groupOpenaiBilled(g.rows.filter((r) => r.category !== OPENAI_TOTAL_CATEGORY));
  ok("the page groups billed lines per project with the project's sum", byProject.length === 1 && byProject[0].projectId === "proj_sales" && near(byProject[0].cents, 43.05, 0.0001) && byProject[0].lines.length === 3);
}

section("OpenAI — computed beside billed, the reconciliation sentence");
{
  const r = reconcileOpenai({ computedCents: 4120, billedCents: 4305, daysBilled: 18, daysInPeriod: 18 });
  ok("computed $41.20 / billed $43.05 is 4.3% under and the table may be stale", r.pct === -4.3 && /computed \$41\.20 \/ billed \$43\.05 — 4\.3% under; price table may be stale/.test(r.statement), r.statement);
  const partial = reconcileOpenai({ computedCents: 1000, billedCents: 1000, daysBilled: 10, daysInPeriod: 19 });
  ok("when only some days are billed the sentence says how many, and level is level", /over the 10 of 19 days OpenAI has billed/.test(partial.statement) && /level/.test(partial.statement) && partial.pct === 0, partial.statement);
  const none = reconcileOpenai({ computedCents: 2031, billedCents: null });
  ok("with nothing billed there is no percentage and the sentence says nothing was pulled", none.pct === null && /nothing billed has been pulled/.test(none.statement), none.statement);
  const zero = reconcileOpenai({ computedCents: 2031, billedCents: 0, daysBilled: 3, daysInPeriod: 3 });
  ok("billed $0 against a computed figure names the likely cause rather than dividing by zero", zero.pct === null && /check the admin key/.test(zero.statement), zero.statement);
  const over = reconcileOpenai({ computedCents: 1100, billedCents: 1000 });
  ok("computed above billed reads 'over'", over.pct === 10 && /10% over/.test(over.statement));
  const close = reconcileOpenai({ computedCents: 1010, billedCents: 1000 });
  ok("within 2% the table is not accused of being stale", /1% over$/.test(close.statement), close.statement);
}

// ═══════════════════════════════════════════════════════════════════════════
section("Neon — consumption units, and dollars only at a published rate");
{
  // The response shape api-docs.neon.tech prints (read 2026-09-19).
  const docsSample = {
    projects: [
      {
        project_id: "proj-fieldquo",
        periods: [
          {
            period_id: "uuid",
            period_plan: "launch",
            period_start: "2026-09-01T00:00:00Z",
            period_end: "2026-09-30T23:59:59Z",
            consumption: [
              {
                timeframe_start: "2026-09-18T00:00:00Z",
                timeframe_end: "2026-09-19T00:00:00Z",
                active_time_seconds: 27853,
                compute_time_seconds: 3600,
                written_data_bytes: 1073741824,
                synthetic_storage_size_bytes: 5368709120,
                data_storage_bytes_hour: 5 * 1024 ** 3 * 24,
              },
              { timeframe_start: "not a date", compute_time_seconds: 1 },
            ],
          },
        ],
      },
    ],
    pagination: { cursor: "" },
  };
  const { rows, dropped, plans } = normaliseNeonConsumption(docsSample, { fetchedAt: new Date("2026-09-19T10:00:00Z") });
  ok("one row per metric for the day, the unreadable timeframe dropped and counted", rows.length === NEON_METRICS.length && dropped === 1 && plans.join() === "launch", rows.map((r) => r.category));
  const compute = rows.find((r) => r.category === "proj-fieldquo/compute_time_seconds");
  ok("3,600 CU-seconds on Launch is one CU-hour at US$0.106 — 10.6 cents", compute && near(compute.cents, 10.6, 0.0001) && compute.units === 3600 && /CU-seconds · launch/.test(compute.unit), compute);
  const storage = rows.find((r) => r.category === "proj-fieldquo/data_storage_bytes_hour");
  const expectedStorage = (5 * 24 / hoursInMonthOf("2026-09-18")) * 35;
  ok("5 GiB held for a day in September is 5×24 of 720 GB-hours × US$0.35 a GB-month", storage && near(storage.cents, expectedStorage, 0.0001) && hoursInMonthOf("2026-09-18") === 720, [storage?.cents, expectedStorage]);
  ok("active time and bytes written carry units and NO price — they are not billed metrics", rows.filter((r) => /active_time|written_data|synthetic_storage/.test(r.category)).every((r) => r.cents === null && r.units !== null));
  const scale = normaliseNeonConsumption({ projects: [{ project_id: "p", periods: [{ period_plan: "Scale", consumption: [{ timeframe_start: "2026-09-18T00:00:00Z", compute_time_seconds: 3600 }] }] }] });
  ok("Scale prices compute at US$0.222 a CU-hour", near(scale.rows[0].cents, 22.2, 0.0001), scale.rows[0]);
  const free = normaliseNeonConsumption({ projects: [{ project_id: "p", periods: [{ period_plan: "free", consumption: [{ timeframe_start: "2026-09-18T00:00:00Z", compute_time_seconds: 3600 }] }] }] });
  ok("the Free plan bills nothing, so compute is $0 — a real price, not a guess", free.rows[0].cents === 0);
  const enterprise = normaliseNeonConsumption({ projects: [{ project_id: "p", periods: [{ period_plan: "enterprise-contract", consumption: [{ timeframe_start: "2026-09-18T00:00:00Z", compute_time_seconds: 3600, data_storage_bytes_hour: 100 }] }] }] });
  ok("a plan with no published rate stores the units and cents NULL — never a zero standing in for a price", enterprise.rows.every((r) => r.cents === null && r.units !== null) && enterprise.rows[0].unit === "CU-seconds · enterprise-contract", enterprise.rows);
  ok("neonPlanKey reads the docs' plan names and nothing else", neonPlanKey("Launch") === "launch" && neonPlanKey("scale_plan") === null && neonPlanKey("scale plan") === "scale" && neonPlanKey(undefined) === null);
  ok("priceNeonMetric refuses an unknown plan and an unpriced metric", priceNeonMetric({ metric: "compute_time_seconds", units: 3600, day: "2026-09-18", planKey: null }) === null && priceNeonMetric({ metric: "written_data_bytes", units: 1, day: "2026-09-18", planKey: "launch" }) === null);
  ok("the rate table names its source and date", Object.values(NEON_LIST_RATES).every((r) => /neon\.com\/pricing/.test(r.source) && /2026-09-19/.test(r.source)));
  ok("the module header states the GB-month and CU-hour conversions", /GB-month\s+= data_storage_bytes_hour ÷ 2\^30/.test(read("lib/platform/costs/neonConsumption.js")) && /CU-hours\s+= compute_time_seconds ÷ 3,600/.test(read("lib/platform/costs/neonConsumption.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Stripe — what Stripe kept, per day and reporting category");
{
  // A fixture in the balance_transaction shape the test account returned on
  // 2026-09-19 (CAD, subscription charge with two stripe_fee details).
  const fixture = [
    { id: "txn_1", amount: 55744, currency: "cad", fee: 3208, fee_details: [{ amount: 2093, type: "stripe_fee" }, { amount: 1115, type: "stripe_fee" }], net: 52536, reporting_category: "charge", type: "charge", created: Date.UTC(2026, 8, 16, 12) / 1000 },
    { id: "txn_2", amount: 12443, currency: "cad", fee: 769, fee_details: [], reporting_category: "charge", type: "charge", created: Date.UTC(2026, 8, 16, 18) / 1000 },
    { id: "txn_3", amount: -4158871, currency: "cad", fee: 0, reporting_category: "transfer", type: "transfer", created: Date.UTC(2026, 8, 16, 19) / 1000 },
    { id: "txn_4", amount: -250, currency: "cad", fee: 0, reporting_category: "fee", type: "stripe_fee", description: "Billing", created: Date.UTC(2026, 8, 16, 20) / 1000 },
    { id: "txn_5", amount: 1000, currency: "usd", fee: 59, reporting_category: "application_fee", type: "application_fee", created: Date.UTC(2026, 8, 17) / 1000 },
    { id: "txn_6", amount: "??", created: Date.UTC(2026, 8, 17) / 1000 },
    { id: "txn_7", amount: 100, fee: 3, created: "never" },
  ];
  const { rows, dropped } = normaliseStripeBalanceTransactions(fixture, { fetchedAt: new Date("2026-09-19T10:00:00Z") });
  const charge = rows.find((r) => r.category === "charge/cad");
  ok("two charges on one day become one row: fee summed, gross summed, count 2", charge && charge.cents === 3208 + 769 && charge.units === 55744 + 12443 && charge.count === 2 && charge.day === "2026-09-16", charge);
  ok("a transfer kept nothing", rows.find((r) => r.category === "transfer/cad").cents === 0);
  ok("Stripe's own fee line (type stripe_fee, negative amount) is money Stripe kept", rows.find((r) => r.category === "fee/cad").cents === 250);
  ok("currencies never share a row", rows.some((r) => r.category === "application_fee/usd" && r.cents === 59 && r.currency === "USD"));
  ok("an unreadable amount and an unreadable created are dropped and counted", dropped === 2 && rows.length === 4, [dropped, rows.length]);
  ok("the category splits back into reporting category and currency", splitStripeCategory("charge/cad").reportingCategory === "charge" && splitStripeCategory("charge/cad").currency === "CAD");
  ok("every row is provider stripe with the source named", rows.every((r) => r.provider === "stripe" && r.source === "stripe_balance_transactions"));

  // The test account, when the key is present and the network is up.
  let live = null;
  if (/^sk_test_/.test(process.env.STRIPE_SECRET_KEY || "")) {
    try {
      const to = new Date();
      live = await fetchStripeBalanceTransactions({ from: new Date(to.getTime() - 30 * 86400000), to });
    } catch (err) {
      console.log(`  (test-mode Stripe not reachable: ${err?.message}; the fixture stands in)`);
    }
  } else {
    console.log("  (no sk_test_ key in the environment; the fixture stands in)");
  }
  if (live) {
    const parsed = normaliseStripeBalanceTransactions(live, { fetchedAt: new Date() });
    ok(`the test account's ${live.length} transactions parse with nothing dropped`, parsed.dropped === 0);
    ok("…every row has a day, a category with a currency, and a non-negative kept figure", parsed.rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.day) && /\/[a-z]{3}$/.test(r.category) && r.cents >= 0));
    ok("…a charge row's gross is at least what Stripe kept of it", parsed.rows.filter((r) => r.category.startsWith("charge/")).every((r) => r.units >= r.cents));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("Fixed bills — validated, attributed, prorated, never estimated");
{
  ok("a missing amount is an error, not zero", parseFixedBillInput({ provider: "vercel", periodMonth: "2026-09" }).ok === false);
  ok("a missing month is an error, not this month", parseFixedBillInput({ provider: "vercel", amount: "113.18" }).ok === false);
  ok("a missing supplier is an error", parseFixedBillInput({ periodMonth: "2026-09", amount: "1" }).ok === false);
  const good = parseFixedBillInput({ provider: " Vercel ", periodMonth: "2026-09", amount: "$113.18", invoiceRef: " INV-1 ", note: "x" });
  ok("'$113.18' for Vercel in 2026-09 becomes 11318 cents on the first of the month", good.ok && good.data.provider === "vercel" && good.data.amountCents === 11318 && good.data.periodMonth.toISOString() === "2026-09-01T00:00:00.000Z" && good.data.invoiceRef === "INV-1", good);
  ok("cents are accepted as an integer and refused as a fraction", parseFixedBillInput({ provider: "neon", periodMonth: "2026-09", amountCents: 500 }).data.amountCents === 500 && parseFixedBillInput({ provider: "neon", periodMonth: "2026-09", amountCents: 5.5 }).ok === false);
  ok("three decimals, a negative and a month 13 are refused", parseFixedBillInput({ provider: "x", periodMonth: "2026-09", amount: "1.234" }).ok === false && parseFixedBillInput({ provider: "x", periodMonth: "2026-09", amount: "-1" }).ok === false && parseFixedBillInput({ provider: "x", periodMonth: "2026-13", amount: "1" }).ok === false);
  ok("a currency is three letters or defaults to USD; never invented from the amount", parseFixedBillInput({ provider: "x", periodMonth: "2026-09", amount: "1", currency: "cad" }).data.currency === "CAD" && parseFixedBillInput({ provider: "x", periodMonth: "2026-09", amount: "1", currency: "dollars" }).data.currency === "USD");
  ok("monthDate reads YYYY-MM only", monthDate("2026-09") instanceof Date && monthDate("2026-9") === null && monthDate("2026-09-01") === null);

  const statement = fixedBillStatement({ provider: "vercel", periodMonth: new Date("2026-09-01T00:00:00Z"), amountCents: 11318, currency: "USD", enteredBy: { email: "emilio.boves@fieldquo.com" }, enteredAt: new Date("2026-09-19T15:00:00Z"), updatedAt: new Date("2026-09-19T15:00:00Z") });
  ok("the statement is 'Vercel · September 2026 · $113.18 · entered by Emilio Boves on 2026-09-19'", statement === "Vercel · September 2026 · $113.18 · entered by Emilio Boves on 2026-09-19", statement);
  const edited = fixedBillStatement({ provider: "namecheap", periodMonth: new Date("2026-08-01T00:00:00Z"), amountCents: 1599, currency: "USD", enteredBy: { email: "ops@fieldquo.com" }, enteredAt: new Date("2026-09-19T15:00:00Z"), updatedAt: new Date("2026-09-21T15:00:00Z"), voidedAt: new Date("2026-09-22T00:00:00Z") });
  ok("an edited then voided row says both, keeping who entered it", /entered by Ops on 2026-09-19, edited 2026-09-21 — voided 2026-09-22/.test(edited), edited);

  // Round trip through the writers against an in-memory client.
  const client = fakeClient();
  const created = await createFixedBill({ data: good.data, adminId: "admin_1", client });
  ok("createFixedBill returns the shaped row with its statement and source", created.source === "hand_entered" && created.enteredByName === "Emilio Boves" && created.periodMonth === "2026-09" && /Vercel · September 2026 · \$113\.18/.test(created.statement), created);
  const listed = await listFixedBills({ from: new Date("2026-09-10T00:00:00Z"), to: new Date("2026-09-19T00:00:00Z"), client });
  ok("listFixedBills finds a bill whose month overlaps the period", listed.length === 1 && listed[0].id === created.id);
  const updated = await updateFixedBill({ id: created.id, data: parseFixedBillInput({ provider: "vercel", periodMonth: "2026-09", amount: "120.00" }).data, client });
  ok("updateFixedBill edits in place and the statement says edited", updated.amountCents === 12000 && /edited 2026-09-20/.test(updated.statement), updated.statement);
  const voided = await updateFixedBill({ id: created.id, voided: true, client });
  ok("voiding keeps the row and marks it", voided.voidedAt && client.bills.size === 1 && /voided/.test(voided.statement));
  const restored = await updateFixedBill({ id: created.id, voided: false, client });
  ok("…and it can be restored", restored.voidedAt === null);
  let missing = null;
  try {
    await updateFixedBill({ id: "nope", voided: true, client });
  } catch (err) {
    missing = err;
  }
  ok("a bill that does not exist is P2025, which the route turns into a 404", missing?.code === "P2025");

  // Proration.
  const bills = [
    { id: "a", provider: "vercel", providerLabel: "Vercel", periodMonth: "2026-09", amountCents: 3000, currency: "USD", statement: "Vercel · September 2026 · $30.00 · entered by Emilio on 2026-09-19", voidedAt: null },
    { id: "b", provider: "vercel", providerLabel: "Vercel", periodMonth: "2026-09", amountCents: 1000, currency: "USD", statement: "second", voidedAt: new Date() },
    { id: "c", provider: "namecheap", providerLabel: "Namecheap", periodMonth: "2026-08", amountCents: 1599, currency: "USD", statement: "Namecheap · August 2026", voidedAt: null },
  ];
  const whole = fixedBillsForPeriod(bills, new Date("2026-09-01T00:00:00Z"), new Date("2026-10-01T00:00:00Z"));
  ok("a whole month counts the whole bill, a voided row counts nothing, and last month's bill is not in this month", whole.totalCents === 3000 && whole.byProvider.length === 1 && whole.byProvider[0].bills.length === 1);
  const tenDays = fixedBillsForPeriod(bills, new Date("2026-09-01T00:00:00Z"), new Date("2026-09-11T00:00:00Z"));
  ok("ten days of September is a third of the month's bill, and the share is printed", near(tenDays.totalCents, 1000, 0.01) && near(tenDays.byProvider[0].bills[0].share, 0.333, 0.001) && tenDays.byProvider[0].wholeMonthCents === 3000, tenDays);
  const straddle = fixedBillsForPeriod(bills, new Date("2026-08-25T00:00:00Z"), new Date("2026-09-05T00:00:00Z"));
  ok("a period across two months takes each month's share", straddle.byProvider.length === 2 && near(straddle.totalCents, 3000 * (4 / 30) + 1599 * (7 / 31), 0.02), straddle.totalCents);
  ok("every listed supplier belongs to one of the three sections", FIXED_BILL_PROVIDERS.every((p) => SECTION_KEYS.includes(p.section)) && fixedBillSection("vercel") === "platform" && fixedBillSection("retell") === "companies" && fixedBillSection("unknown_thing") === "platform");

  const route = decomment(read("app/api/platform/costs/fixed-bills/route.js"));
  ok("the fixed-bills route is superadmin-only on GET, POST and PATCH", /admin\.role !== "superadmin"/.test(route) && (route.match(/await gate\(request\)/g) || []).length === 3);
  ok("…it never deletes: no DELETE export, voided is the only way out", !/export async function DELETE/.test(route) && /voided/.test(route) && !/platformFixedBill\.delete/.test(read("lib/platform/costs/fixedBills.js")));
  ok("…and it validates through parseFixedBillInput, not by hand", (route.match(/parseFixedBillInput\(body\)/g) || []).length === 2);
  const schema = read("prisma/schema.prisma");
  ok("PlatformFixedBill carries who, when, what and a void flag; the ledger's cents is nullable", /model PlatformFixedBill \{[\s\S]*enteredById String[\s\S]*enteredAt[\s\S]*voidedAt DateTime\?[\s\S]*\n\}/.test(schema) && /cents\s+Decimal\? @db\.Decimal\(14, 4\)/.test(schema));
}

// ═══════════════════════════════════════════════════════════════════════════
section("Provider pulls — waiting for the key, logged with the provider named, once a day");
{
  const saved = { OPENAI_ADMIN_API_KEY: process.env.OPENAI_ADMIN_API_KEY, NEON_API_KEY: process.env.NEON_API_KEY, STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY };
  delete process.env.OPENAI_ADMIN_API_KEY;
  delete process.env.NEON_API_KEY;
  delete process.env.STRIPE_SECRET_KEY;
  const cfg = providerConfiguration();
  ok("with no keys every daily provider says which variable it waits for", cfg.openai.configured === false && cfg.openai.envVar === "OPENAI_ADMIN_API_KEY" && cfg.neon.envVar === "NEON_API_KEY" && cfg.stripe.envVar === "STRIPE_SECRET_KEY" && !openaiAdminConfigured());
  const client = fakeClient();
  const skipped = await pullDailyProvidersIfStale({ client, now: new Date("2026-09-19T10:00:00Z") });
  ok("the cron entry skips an unconfigured provider without logging or writing", Object.values(skipped).every((r) => r.pulled === false && r.reason === "not_configured") && client.daily.size === 0, skipped);
  const notConfigured = await pullProvider("openai", { client, now: new Date() });
  ok("a manual pull of an unconfigured provider says so, names the variable, and is not ok", notConfigured.ok === false && notConfigured.reason === "not_configured" && notConfigured.envVar === "OPENAI_ADMIN_API_KEY");
  ok("an unknown provider is refused", (await pullProvider("vercel", { client })).reason === "unknown_provider");
  process.env.OPENAI_ADMIN_API_KEY = "sk-admin-test";
  const failing = await pullProvider("openai", { client, now: new Date("2026-09-19T10:00:00Z"), deps: { fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: "Invalid admin key" } }) }) } });
  // OpenAI's costs pull is OPTIONAL (DAILY_PROVIDERS.optional): the owner has
  // decided not to hold an org-level admin key, so a refusal is a settled
  // configuration fact. It still returns not-ok and still carries the vendor's
  // own words — what changed on 2026-09-22 is that it no longer writes a
  // PlatformErrorLog row every day for a decision already taken.
  ok("an optional provider's refusal returns not-ok with the provider and the vendor's words, never throws", failing.ok === false && failing.provider === "openai" && failing.reason === "refused" && failing.optional === true && /Invalid admin key/.test(failing.error), failing);
  const pullsSrc = read("lib/platform/costs/providerPulls.js");
  ok("…and the recordError is inside the NOT-optional branch only", /if \(p\.optional\) \{[\s\S]*?\} else \{\s*await recordError\(/.test(pullsSrc) && /optional: true/.test(pullsSrc));
  ok("…logged at info, at most once a day per provider", /console\.info\(/.test(pullsSrc) && /24 \* 60 \* 60 \* 1000/.test(pullsSrc));
  const wide = await pullProvider("openai", { client, from: new Date("2026-01-01T00:00:00Z"), to: new Date("2026-09-19T00:00:00Z") });
  ok("a range wider than Neon's sixty days is refused rather than partly pulled", wide.reason === "range_too_wide");
  const sample = { object: "page", data: [{ object: "bucket", start_time: Date.UTC(2026, 8, 18) / 1000, results: [{ amount: { value: 0.5, currency: "usd" }, line_item: "gpt-5-mini, input_tokens", project_id: "proj_a", quantity: 1000, quantity_unit: "tokens" }] }], has_more: false };
  const pulled = await pullProvider("openai", { client, from: new Date("2026-09-18T00:00:00Z"), to: new Date("2026-09-18T00:00:00Z"), now: new Date("2026-09-19T10:00:00Z"), deps: { fetchImpl: async () => ({ ok: true, json: async () => sample }) } });
  ok("a good pull writes the line and the total through the shared upsert", pulled.ok && pulled.written === 2 && client.daily.has("2026-09-18|openai|proj_a/gpt-5-mini, input_tokens") && client.daily.get("2026-09-18|openai|total").cents === 50, pulled);
  const again = await pullDailyProvidersIfStale({ client, now: new Date("2026-09-19T20:00:00Z") });
  ok("within a day of the last pull the cron does nothing for that provider", again.openai.pulled === false && again.openai.lastPullAt instanceof Date);
  const later = await pullDailyProvidersIfStale({ client, now: new Date("2026-09-20T11:00:00Z"), deps: { openai: { fetchImpl: async () => ({ ok: true, json: async () => ({ data: [], has_more: false }) }) } } });
  ok("a day later it pulls again, three days back", later.openai.pulled === true && later.openai.ok === true && later.openai.from === "2026-09-17" && later.openai.to === "2026-09-20", later.openai);
  ok("the staleness window is one day", PULL_MAX_AGE_MS === 86_400_000 && Object.keys(DAILY_PROVIDERS).sort().join() === "neon,openai,stripe");
  for (const [k, v] of Object.entries(saved)) if (v !== undefined) process.env[k] = v;
  else delete process.env[k];

  const pulls = decomment(read("lib/platform/costs/providerPulls.js"));
  ok("a failure is recorded under platform_costs with the provider in the code", /area: "platform_costs"/.test(pulls) && /code: `\$\{provider\}_pull_failed`/.test(pulls));
  const cron = decomment(read("app/api/cron/sales-pipeline/route.js"));
  ok("the every-minute cron calls the daily pulls beside the hourly Twilio one", /pullTwilioUsageIfStale\(/.test(cron) && /pullDailyProvidersIfStale\(/.test(cron));
  const nullable = await writeDailyRows([{ day: "2026-09-18", provider: "neon", category: "p/compute_time_seconds", cents: null, units: 10, unit: "CU-seconds", source: "neon_consumption_history", fetchedAt: new Date() }], { client });
  ok("the shared writer stores a null price with its units", nullable === 1 && client.daily.get("2026-09-18|neon|p/compute_time_seconds").cents === null);
  ok("the ledger writer refuses a row with no provider or category", (await writeDailyRows([{ day: "2026-09-18", cents: 1 }], { client })) === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("The three sections — sum to the total, say their source, add or reconcile a bill");
{
  const twilio = {
    lines: [
      { category: "calls-outbound", cents: 1000, units: 50, unit: "minutes", count: 40 },
      { category: "sms-outbound", cents: 400, units: 100, unit: "messages", count: 100 },
      { category: "phonenumbers", cents: 600, units: 6, unit: "numbers", count: 6 },
    ],
    sides: {
      sales: { cents: 1500, lines: [{ category: "calls-outbound", cents: 1000, how: "voice is sales" }, { category: "sms-outbound", cents: 100, how: "25 of 100" }, { category: "phonenumbers", cents: 400, how: "4 of 6" }] },
      tenants: { cents: 500, lines: [{ category: "calls-outbound", cents: 0, how: "" }, { category: "sms-outbound", cents: 300, how: "75 of 100" }, { category: "phonenumbers", cents: 200, how: "2 of 6" }] },
      unattributed: { cents: 20, lines: [{ category: "other", cents: 20, how: "in Twilio's total, under no pulled category" }] },
    },
    lastPullAt: new Date("2026-09-19T09:00:00Z"),
  };
  const openai = {
    platform: { byArea: [{ area: "research_brief", micros: 8_610_000, calls: 16636, unpriced: 0, tokens: 12_000_000 }, { area: "call_script", micros: 4_200_000, calls: 2152, unpriced: 0, tokens: 10_000_000 }], micros: 12_810_000, unpricedCalls: 0 },
    tenants: { byFeature: [{ feature: "copilot", micros: 25_000, calls: 22 }], micros: 25_000, companies: 6 },
    asOf: new Date("2026-09-19T10:00:00Z"),
  };
  const retell = { platform: { calls: 3, cents: 90, unknownCalls: 0 }, tenants: { calls: 69, cents: 1200, unknownCalls: 0, seconds: 7200 }, rent: { cents: 985.6, monthlyCents: 1000 }, numbersHeld: 5, asOf: new Date() };
  const places = { cents: 416.5, requests: 119, source: "places", asOf: new Date() };
  const localScrape = { cents: 0, places: 3873, source: "scrape", asOf: new Date() };
  const apify = { cents: 250, count: 4, source: "apify", asOf: new Date() };
  const neon = { configured: true, envVar: "NEON_API_KEY", lastPullAt: new Date(), lines: [{ category: "proj/compute_time_seconds", cents: 106, units: 36000, unit: "CU-seconds · launch" }, { category: "proj/data_storage_bytes_hour", cents: 5.8, units: 1e12, unit: "byte-hours · launch" }, { category: "proj/written_data_bytes", cents: null, units: 1e9, unit: "bytes · launch" }] };
  const stripe = { configured: true, envVar: "STRIPE_SECRET_KEY", lastPullAt: new Date(), lines: [{ category: "charge/cad", cents: 3977, units: 68187, count: 2 }, { category: "transfer/cad", cents: 0, units: -4158871, count: 1 }] };
  const charged = { byKind: { call: 2520, number_rent: 2000, crew_line_rent: 400, crew_text: 500, image_generation: 162 } };
  const fixed = fixedBillsForPeriod(
    [
      { id: "v", provider: "vercel", providerLabel: "Vercel", section: "platform", periodMonth: "2026-09", amountCents: 11318, currency: "USD", statement: "Vercel · September 2026 · $113.18 · entered by Emilio on 2026-09-19", voidedAt: null },
      { id: "r", provider: "retell", providerLabel: "Retell (invoice)", section: "companies", periodMonth: "2026-09", amountCents: 2500, currency: "USD", statement: "Retell (invoice) · September 2026 · $25.00 · entered by Emilio on 2026-09-19", voidedAt: null },
    ],
    new Date("2026-09-01T00:00:00Z"),
    new Date("2026-10-01T00:00:00Z"),
  );
  const out = buildSections({ twilio, openai, retell, places, localScrape, apify, neon, stripe, charged, fixed, now: new Date("2026-09-19T10:00:00Z") });
  const s = out.sections;
  const sum = SECTION_KEYS.reduce((a, k) => a + s[k].totalCents, 0);
  ok("the three section totals sum to the page total", near(sum, out.totalCents, 0.0001), [s.sales.totalCents, s.companies.totalCents, s.platform.totalCents, out.totalCents]);
  ok("section 1 is the sales floor's Twilio share + the pipeline AI + its own Retell line + Places + Apify", near(s.sales.totalCents, 1500 + 1281 + 90 + 416.5 + 250, 0.0001), s.sales.totalCents);
  ok("section 2 is the companies' Retell minutes and rent, their Twilio share, and their AI", near(s.companies.totalCents, 1200 + 985.6 + 500 + 2.5, 0.0001), s.companies.totalCents);
  ok("section 3 is Neon priced + Stripe kept + Twilio's unattributed + Vercel's invoice", near(s.platform.totalCents, 106 + 5.8 + 3977 + 0 + 20 + 11318, 0.0001), s.platform.totalCents);
  ok("every line carries provider, a source kind, a source and an as-of key", SECTION_KEYS.every((k) => s[k].lines.every((l) => l.provider && ["api", "computed", "hand"].includes(l.sourceKind) && l.source && "asOf" in l)));
  ok("no line says 'FieldQuo's own' — the section says whose it is", SECTION_KEYS.every((k) => s[k].lines.every((l) => !/FieldQuo's own/.test(l.label))));
  const brief = s.sales.lines.find((l) => l.key === "openai:research_brief");
  ok("research briefs: 16,636 for $8.61 — 5.2¢ per 100, the owner's example", brief && near(brief.cents, 861, 0.0001) && brief.count === 16636 && brief.units === 12_000_000 && brief.perUnit === "5.2¢ per 100", brief);
  ok("perUnitStatement scales: cents, per 100, per 1,000", perUnitStatement(861, 16636, "brief") === "5.2¢ per 100" && perUnitStatement(250, 2, "run") === "$1.25 per run" && perUnitStatement(1, 500, "x") === "2¢ per 1,000" && perUnitStatement(1, 0) === null);
  const minutes = s.companies.lines.find((l) => l.key === "retell:tenant_calls");
  ok("companies' minutes show the cost beside what was charged (kind = call)", minutes && minutes.cents === 1200 && minutes.charged.cents === 2520 && /kind = call/.test(minutes.charged.how));
  ok("rent is charged under number_rent + number_setup, crew lines under crew_line_*, texts under crew_text", s.companies.lines.find((l) => l.key === "retell:rent").charged.cents === 2000 && s.companies.lines.find((l) => l.key === "twilio:tenants:phonenumbers").charged.cents === 400 && s.companies.lines.find((l) => l.key === "twilio:tenants:sms-outbound").charged.cents === 500);
  ok("the companies section's charged total is the sum of its lines' charges", s.companies.chargedCents === 2520 + 2000 + 400 + 500 + 162);
  ok("a zero-cent Twilio share is not printed as a line", !s.companies.lines.some((l) => l.key === "twilio:tenants:calls-outbound"));
  ok("Vercel's invoice, with no API line, IS the line and the section says it includes hand-entered bills", s.platform.lines.some((l) => l.key === "fixed:vercel" && l.sourceKind === "hand" && l.cents === 11318 && /entered by Emilio/.test(l.note)) && s.platform.includesHandEntered && out.includesHandEntered);
  ok("Retell's invoice, beside computed Retell lines, is a reconciliation and NOT added", out.reconciliations.length === 1 && out.reconciliations[0].provider === "retell" && near(out.reconciliations[0].pulledCents, 1200 + 985.6, 0.0001) && /invoice \$25\.00/.test(out.reconciliations[0].statement) && !s.companies.lines.some((l) => l.key === "fixed:retell") && !s.companies.includesHandEntered, out.reconciliations);
  ok("Neon's unbilled metric carries units and no price and does not make the section a floor", s.platform.lines.some((l) => l.key === "neon:proj/written_data_bytes" && l.cents === 0 && l.units === 1e9) && s.platform.complete);
  ok("Stripe's charge line says what it was kept on", /on \$681\.87 gross CAD in 2 charges/.test(s.platform.lines.find((l) => l.key === "stripe:charge/cad").note));
  ok("Twilio's unattributed remainder lands in section 3 under its own name", s.platform.lines.some((l) => l.key === "twilio:unattributed:other" && l.cents === 20));
  ok("the section blurbs and counts by source kind are set", s.sales.sourceKinds.api === 5 && s.sales.sourceKinds.computed === 4 && s.platform.sourceKinds.hand === 1, s.sales.sourceKinds);

  // Waiting for a key: not a zero, not a spinner.
  const waiting = buildSections({ twilio, openai, retell, places, localScrape, apify, neon: { configured: false, envVar: "NEON_API_KEY", lines: [] }, stripe: { configured: false, envVar: "STRIPE_SECRET_KEY", lines: [] }, charged, fixed: { byProvider: [] } });
  const neonLine = waiting.sections.platform.lines.find((l) => l.key === "neon");
  ok("an unconfigured Neon prints 'waiting for NEON_API_KEY' with an unknown cost, and the section is a floor", neonLine && neonLine.cents === null && /waiting for NEON_API_KEY/.test(neonLine.note) && waiting.sections.platform.isFloor && !waiting.complete);
  ok("an unconfigured Stripe likewise", /waiting for STRIPE_SECRET_KEY/.test(waiting.sections.platform.lines.find((l) => l.key === "stripe").note));
  const unpriced = buildSections({ twilio, openai, retell, neon: { configured: true, envVar: "NEON_API_KEY", lastPullAt: new Date(), lines: [{ category: "proj/compute_time_seconds", cents: null, units: 36000, unit: "CU-seconds · enterprise" }] }, charged, fixed: { byProvider: [] } });
  const u = unpriced.sections.platform.lines.find((l) => l.key === "neon:proj/compute_time_seconds");
  ok("Neon compute on an unpublished plan prints units × your plan's rate and points at Fixed bills, cost unknown", u && u.cents === null && /36,000 CU-seconds · enterprise × your plan's rate — enter Neon's invoice under Fixed bills/.test(u.note) && unpriced.sections.platform.isFloor, u);
  const floorRetell = buildSections({ twilio, openai, retell: { ...retell, tenants: { calls: 69, cents: null, unknownCalls: 69, seconds: 0 } }, charged, fixed: { byProvider: [] } });
  ok("69 Retell calls with no figure is an unknown cost and a floor, never $0", floorRetell.sections.companies.lines.find((l) => l.key === "retell:tenant_calls").cents === null && floorRetell.sections.companies.isFloor);
  const empty = buildSections({});
  ok("with nothing at all the sections exist, sum to zero and are complete", SECTION_KEYS.every((k) => empty.sections[k].lines.length === 0) && empty.totalCents === 0 && empty.complete);
}

// ═══════════════════════════════════════════════════════════════════════════
section("The page, the route and the docs");
{
  const page = read("app/platform/costs/page.js");
  const order = ["costs-sales", "costs-companies", "costs-platform"].map((id) => page.indexOf(`id="${id}"`));
  ok("the page renders the three sections in order: sales floor, companies, platform", order.every((i) => i > 0) && order[0] < order[1] && order[1] < order[2], order);
  ok("each section heading carries its total and last month's", /\{index\}\. \{section\.title\} — \{money\(section\.totalCents\)\}/.test(page) && /last month \{prevState/.test(page));
  ok("the companies section prints charged and margin beside each line", /withCharged/.test(page) && /Charged to companies/.test(page) && /money\(l\.charged\.cents - l\.cents\)/.test(page));
  ok("every line prints provider · source kind · as of", /SOURCE_KIND\[l\.sourceKind\]/.test(page) && /when\(l\.asOf\)/.test(page) && /\{l\.provider\}/.test(page));
  ok("a missing admin key is a sentence, not a spinner or a zero", /OpenAI&rsquo;s own invoice figures aren&rsquo;t connected/.test(page) && /\{data\.openai\.billed\.envVar\}/.test(page) && !/billed\.configured \? .*Loader2/.test(page));
  ok("…and it says FieldQuo's own metered spend is what is shown", /FieldQuo&rsquo;s metered spend is shown/.test(page) && /would enable the comparison/.test(page));
  ok("an optional provider's row reads as settled, not as amber waiting", /p\.optional \? \(/.test(page) && /not connected — \{p\.envVar\}/.test(page));
  ok("the reconciliation line is printed", /data-openai-reconciliation/.test(page) && /reconciliation\.statement/.test(page));
  ok("the per-rep and per-agency tables are inside section 1", page.indexOf(">Per rep</h3>") > page.indexOf('id="costs-sales"') && page.indexOf(">Per rep</h3>") < page.indexOf('id="costs-companies"'));
  ok("the fixed-bills form lives in section 3 and prints each row's statement", page.indexOf("data-fixed-bills") > page.indexOf('id="costs-platform"') && /r\.statement/.test(page) && /Void/.test(page) && !/Delete/.test(page));
  ok("every provider's last pull is printed with a Pull now for the API-pulled ones", /data-provider-pulls/.test(page) && /waiting for \{p\.envVar\}/.test(page) && /pullNow\(key\)/.test(page));
  ok("Stripe is shown as what it kept beside subscription revenue", /data-stripe-kept/.test(page) && /beside subscription revenue/.test(page));
  ok("the month total marks itself when it includes hand-entered bills", /includes hand-entered bills/.test(page));
  ok("no line on the page says 'FieldQuo's own' without its section", !/FieldQuo&rsquo;s own —/.test(page) && !/FieldQuo's own —/.test(page));

  const route = decomment(read("app/api/platform/costs/route.js"));
  ok("the costs route pulls a named provider through providerPulls and stays superadmin-only", /pullProvider\(provider/.test(route) && /DAILY_PROVIDERS\[provider\]/.test(route) && /admin\.role !== "superadmin"/.test(route));
  ok("prevmonth is a range the API accepts, bounded to the whole of last month", RANGES.includes("prevmonth") && periodBounds({ range: "prevmonth", now: new Date("2026-09-19T10:00:00Z") }).from.toISOString() === "2026-08-01T00:00:00.000Z" && periodBounds({ range: "prevmonth", now: new Date("2026-09-19T10:00:00Z") }).to.toISOString() === "2026-08-31T23:59:59.999Z");

  const summary = decomment(read("lib/platform/costs/summary.js"));
  ok("the summary reads the four new providers from the ledger and builds the sections", /in: \["openai", "neon", "stripe", "apify"\]/.test(summary) && /buildSections\(\{/.test(summary) && /reconcileOpenai\(/.test(summary));
  ok("…and the page total is the sections' sum, so a reconciling bill is not counted twice", /const knownTotalCents = split\.totalCents/.test(summary));
  ok("…charged-to-companies comes from the credit ledger's debits by kind", /voiceCreditEntry[\s\S]*groupBy\(\{ by: \["kind"\][\s\S]*cents: \{ lt: 0 \}/.test(summary));

  const vercel = read("docs/VERCEL.md");
  ok("docs/VERCEL.md documents OPENAI_ADMIN_API_KEY and NEON_API_KEY with where to create them", /`OPENAI_ADMIN_API_KEY`/.test(vercel) && /`NEON_API_KEY`/.test(vercel) && /Admin keys/.test(vercel) && /console\.neon\.tech/.test(vercel) && /NEON_ORG_ID/.test(vercel));
  const pkg = JSON.parse(read("package.json"));
  ok("the script is registered and in check:all", typeof pkg.scripts["check:platform-costs-providers"] === "string" && /check:platform-costs-providers/.test(pkg.scripts["check:all"]));
  const openaiSrc = decomment(read("lib/platform/costs/openaiCosts.js"));
  ok("the OpenAI module reads OPENAI_ADMIN_API_KEY and never OPENAI_API_KEY", /process\.env\.OPENAI_ADMIN_API_KEY/.test(openaiSrc) && !/process\.env\.OPENAI_API_KEY/.test(openaiSrc));
  ok("…and hits the documented endpoint with group_by project_id and line_item", /organization\/costs/.test(openaiSrc) && /q\.append\("group_by", "project_id"\)/.test(openaiSrc) && /q\.append\("group_by", "line_item"\)/.test(openaiSrc));
  const neonSrc = decomment(read("lib/platform/costs/neonConsumption.js"));
  ok("the Neon module hits the documented endpoint with daily granularity and the metrics named", /consumption_history\/projects/.test(neonSrc) && /granularity: "daily"/.test(neonSrc) && /q\.append\("metrics", m\.key\)/.test(neonSrc));
  const stripeSrc = decomment(read("lib/platform/costs/stripeFees.js"));
  ok("the Stripe module uses the platform client from lib/stripe.js and pages balance transactions", /from "@\/lib\/stripe"/.test(stripeSrc) && /balanceTransactions\.list/.test(stripeSrc) && /starting_after/.test(stripeSrc));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
process.exit(0);
