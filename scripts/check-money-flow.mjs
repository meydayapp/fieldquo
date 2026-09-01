// scripts/check-money-flow.mjs
//
// lib/analytics/moneyFlow.js executed against scripted fixtures — no
// database — the same discipline scripts/check-kpis.mjs keeps for its own
// pure builder.
//
// ══ How this runs ═══════════════════════════════════════════════════════════
//
// Section 1 is the hostile fixture that matters most: a company with no
// payments and no expenses ever. Sections 2–8 drive one honesty rule each —
// a real zero vs unknown territory, the amended-invoice non-issue, the
// prior-window arithmetic across a month boundary, the uncategorised-expense
// slice, the materials-buy-list flag, float precision, and the required-
// boolean refusal. Section 9 is a GENERIC invariant walked over every figure
// every fixture produced: `value === null` exactly when `available` is
// false, and `available` is always false when a reason is attached. Section
// 10 checks REASONS is the actual closed vocabulary. Section 11 mutates
// lib/analytics/moneyFlow.js on disk, one bug at a time, and re-runs this
// file as a subprocess to confirm each bug makes an assertion above fail —
// check-kpis.mjs's own technique, and the same reason: a mutation that
// ISN'T caught means the assertion guarding that line has no teeth.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-money-flow.mjs

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildMoneyFlow, priorWindow, categoryBreakdown, REASONS } from "@/lib/analytics/moneyFlow";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond
    ? (pass++, console.log(`  ✓ ${label}`))
    : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

const d = (s) => new Date(`${s}T12:00:00.000Z`);
const pay = (amount, date, extra = {}) => ({ amount, date: d(date), ...extra });
const exp = (amount, date, category, extra = {}) => ({ amount, date: d(date), category, ...extra });

// A minimal, valid buildMoneyFlow() call — every field overridable, the same
// pattern check-kpis.mjs's kpisCall() uses.
function flowCall(overrides = {}) {
  return buildMoneyFlow({
    from: "2026-06-01",
    to: "2026-06-30",
    payments: [],
    expenses: [],
    priorPayments: [],
    priorExpenses: [],
    everRecordedIncome: false,
    everRecordedExpense: false,
    materialsTrap: null,
    ...overrides,
  });
}

// Every result this file produces, for the generic invariant pass in
// Section 9 — collected as we go rather than re-run, so that pass exercises
// exactly the fixtures the named sections already reasoned about.
const RESULTS = [];
function run(overrides) {
  const r = flowCall(overrides);
  RESULTS.push(r);
  return r;
}

// ═══════════════════════════════════════════════════════════════════════════
// Section 1 — no data at all
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n1. No data at all — every figure is absent, never a zero\n");

const EMPTY = run({});

ok("income: value null, unavailable, no_payments_recorded",
  EMPTY.income.value === null && !EMPTY.income.available && EMPTY.income.reason === "no_payments_recorded");
ok("…and a real sentence rides along", EMPTY.income.reasonText === REASONS.no_payments_recorded);
ok("expenses: value null, unavailable, no_expenses_recorded",
  EMPTY.expenses.value === null && !EMPTY.expenses.available && EMPTY.expenses.reason === "no_expenses_recorded");
ok("remaining: value null, no_activity_recorded (both sides absent)",
  EMPTY.remaining.value === null && EMPTY.remaining.reason === "no_activity_recorded");
ok("no trend on any of the three — an absent figure grows no arrow",
  EMPTY.trends.income === null && EMPTY.trends.expenses === null && EMPTY.trends.remaining === null);
ok("chart unavailable — neither side has ever been recorded", EMPTY.chartAvailable === false);
ok("every day's income AND expenses is null, never 0",
  EMPTY.days.every((day) => day.income === null && day.expenses === null));
ok("30 days for June, gap-free", EMPTY.days.length === 30);
ok("no categories", Array.isArray(EMPTY.categories) && EMPTY.categories.length === 0);

// ═══════════════════════════════════════════════════════════════════════════
// Section 2 — one payment, no expenses: a real number beside a real absence
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n2. One payment, no expenses — real income, unknown expenses, unknown remaining\n");

const ONE_PAYMENT = run({
  payments: [pay(500, "2026-06-15")],
  everRecordedIncome: true,
  everRecordedExpense: false,
});

ok("income: a real $500, available", ONE_PAYMENT.income.value === 500 && ONE_PAYMENT.income.available);
ok("expenses: still absent — no expense has ever been logged",
  ONE_PAYMENT.expenses.value === null && ONE_PAYMENT.expenses.reason === "no_expenses_recorded");
ok("remaining: absent too — income known, expenses not, so 'what's left' can't be said",
  ONE_PAYMENT.remaining.value === null && ONE_PAYMENT.remaining.reason === "no_expenses_recorded");
ok("income trend: up from a $0 prior, no percentage — trend.js's own zero rule",
  ONE_PAYMENT.trends.income.direction === "up" && ONE_PAYMENT.trends.income.deltaPct === null);
ok("no expenses trend, no remaining trend",
  ONE_PAYMENT.trends.expenses === null && ONE_PAYMENT.trends.remaining === null);
ok("the $500 lands on June 15 and nowhere else",
  ONE_PAYMENT.days.find((day) => day.date === "2026-06-15").income === 500 &&
    ONE_PAYMENT.days.filter((day) => day.income === 500).length === 1);
ok("every OTHER day is a real $0, not null — income has real history this period",
  ONE_PAYMENT.days.filter((day) => day.date !== "2026-06-15").every((day) => day.income === 0));
ok("expense side of every day stays null — expenses have no history at all",
  ONE_PAYMENT.days.every((day) => day.expenses === null));
ok("chart available on income alone", ONE_PAYMENT.chartAvailable === true);

// ═══════════════════════════════════════════════════════════════════════════
// Section 3 — an amended invoice family: proof, not a workaround
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n3. An amended invoice family — income is Payment-based, so nothing to double-count\n");

// v1 of an invoice was raised at $200 and partially paid; the invoice was
// then amended to v2 ($500) and the rest was paid against the NEW row. Two
// real cash events, two Payment rows, each carrying whichever invoiceId it
// was actually recorded against — exactly what lib/export/accountingExport's
// invoiceFamilies exists to reassemble for RECEIVABLES. This file never reads
// invoiceId, version or invoice.total at all, so there is no family logic to
// get right or wrong here: summing the two Payment rows is already correct,
// by construction, regardless of what happened to the document in between.
const AMENDED_FAMILY = run({
  payments: [
    pay(200, "2026-06-05", { invoiceId: "inv-v1", version: 1 }),
    pay(300, "2026-06-20", { invoiceId: "inv-v2", parentInvoiceId: "inv-v1", version: 2 }),
  ],
  everRecordedIncome: true,
  everRecordedExpense: true,
  expenses: [],
});
ok("both payments counted once each: $200 + $300 = $500, not $700 and not $200 alone",
  AMENDED_FAMILY.income.value === 500, AMENDED_FAMILY.income.value);

// The sharper version of the same proof: if this file ever grew a bug that
// substituted an invoice's TOTAL for what was actually paid against it, a
// partially-paid amended document would overstate income by however much of
// the new total was still unpaid. Only $200 was ever actually received here —
// the v2 amendment raised the invoice to $500 but nothing further was paid.
const PARTIALLY_PAID_AMENDMENT = run({
  payments: [pay(200, "2026-06-05", { invoiceId: "inv-v1", version: 1, invoiceTotalAtTheTime: 200 })],
  everRecordedIncome: true,
  everRecordedExpense: true,
  expenses: [],
});
ok("income is exactly what was PAID ($200), never the amended invoice's total ($500)",
  PARTIALLY_PAID_AMENDMENT.income.value === 200, PARTIALLY_PAID_AMENDMENT.income.value);

// ═══════════════════════════════════════════════════════════════════════════
// Section 4 — period-over-period: a real prior, a zero prior, and no claim
//              at all when the metric itself has no history
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n4. Prior-period comparison — a real prior, a zero prior, and none at all\n");

const REAL_PRIOR = run({
  payments: [pay(600, "2026-06-10")],
  priorPayments: [pay(400, "2026-05-10")],
  everRecordedIncome: true,
  everRecordedExpense: true,
  expenses: [],
});
ok("a real, nonzero prior gives a real signed percentage: (600-400)/400 = 50%",
  REAL_PRIOR.trends.income.direction === "up" && REAL_PRIOR.trends.income.deltaPct === 0.5,
  REAL_PRIOR.trends.income);

const QUIET_PERIOD = run({
  payments: [], // real $0 this period — the company HAS taken payments before
  priorPayments: [pay(500, "2026-05-10")],
  everRecordedIncome: true,
  everRecordedExpense: true,
  expenses: [],
});
ok("income is a real $0, not absent — this company has payment history, just none this period",
  QUIET_PERIOD.income.value === 0 && QUIET_PERIOD.income.available);
ok("the drop from a real prior reads as 'down 100%', not suppressed",
  QUIET_PERIOD.trends.income.direction === "down" && QUIET_PERIOD.trends.income.deltaPct === -1);

const NO_HISTORY_AT_ALL = run({
  payments: [],
  // A caller that (wrongly) still fetched prior-period rows for a company
  // with NO history must not let them leak into a trend — the metric itself
  // is unknown territory, and no comparison can be built on an unknown.
  priorPayments: [pay(9999, "2026-05-10")],
  everRecordedIncome: false,
  everRecordedExpense: false,
});
ok("no trend at all when the metric itself is absent, whatever priorPayments contains",
  NO_HISTORY_AT_ALL.trends.income === null);

// ═══════════════════════════════════════════════════════════════════════════
// Section 5 — uncategorised expenses: named, never dropped
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n5. Uncategorised expenses — an honest slice, not the reference's silent exclusion\n");

const UNCATEGORISED = categoryBreakdown([
  exp(100, "2026-06-02", "Fuel"),
  exp(50, "2026-06-03", ""),
  exp(30, "2026-06-04", null),
  exp(10, "2026-06-05", "   "),
]);
const uncatRow = UNCATEGORISED.find((r) => r.name === "Uncategorised");
ok("blank, null and whitespace categories all fold into ONE 'Uncategorised' row",
  Boolean(uncatRow) && uncatRow.value === 90, UNCATEGORISED);
ok("the real category survives alongside it",
  UNCATEGORISED.find((r) => r.name === "Fuel")?.value === 100);
ok("nothing dropped: rows sum to the full $190 ($100 Fuel + $50 + $30 + $10)",
  UNCATEGORISED.reduce((s, r) => s + r.value, 0) === 190);

// Six categories: three named, two collapsed into "Other", the "Other" bucket
// itself preserving every dollar of what it swallowed.
const MANY_CATEGORIES = categoryBreakdown([
  exp(500, "2026-06-01", "Materials"),
  exp(400, "2026-06-02", "Fuel"),
  exp(300, "2026-06-03", "Subcontractor"),
  exp(80, "2026-06-04", "Parking"),
  exp(20, "2026-06-05", ""), // Uncategorised, smallest — should be folded too
]);
ok("top 3 by size, the rest folded into Other",
  MANY_CATEGORIES.length === 4 && MANY_CATEGORIES[3].name === "Other");
ok("Other carries the two smallest, $80 + $20 = $100, and NAMES what's inside it",
  MANY_CATEGORIES[3].value === 100 &&
    MANY_CATEGORIES[3].collapsed.sort().join(",") === "Parking,Uncategorised");
ok("top + Other still sums to the full $1,300 — nothing quietly shorted",
  MANY_CATEGORIES.reduce((s, r) => s + r.value, 0) === 1300);

// ═══════════════════════════════════════════════════════════════════════════
// Section 6 — a range spanning a month boundary
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n6. A range spanning a month boundary\n");

const BOUNDARY = run({
  from: "2026-05-28",
  to: "2026-06-03",
  payments: [
    { amount: 100, date: new Date("2026-05-31T23:59:59.000Z") }, // last instant of May, UTC
    { amount: 200, date: new Date("2026-06-01T00:00:00.000Z") }, // first instant of June, UTC
  ],
  everRecordedIncome: true,
  everRecordedExpense: false,
});
ok("exactly the 7 UTC calendar days May 28 – Jun 3, in order",
  BOUNDARY.days.map((day) => day.date).join(",") ===
    ["2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31", "2026-06-01", "2026-06-02", "2026-06-03"].join(","));
ok("the two payments land on the two different calendar days either side of midnight UTC",
  BOUNDARY.days.find((day) => day.date === "2026-05-31").income === 100 &&
    BOUNDARY.days.find((day) => day.date === "2026-06-01").income === 200);
ok("priorWindow: a 7-day window immediately before May 28, ending May 27",
  JSON.stringify(priorWindow("2026-05-28", "2026-06-03")) ===
    JSON.stringify({ from: "2026-05-21", to: "2026-05-27" }));
ok("priorWindow across a year boundary too: Jan 1–5 → Dec 27–31 of the year before",
  JSON.stringify(priorWindow("2026-01-01", "2026-01-05")) ===
    JSON.stringify({ from: "2025-12-27", to: "2025-12-31" }));

// ═══════════════════════════════════════════════════════════════════════════
// Section 7 — the materials buy-list trap: flagged, never suppressed
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n7. Materials buy-list trap — expenses stay visible, just flagged\n");

const TRAP = run({
  payments: [pay(1000, "2026-06-10")],
  expenses: [exp(50, "2026-06-11", "Materials", { projectId: "job-1" })],
  everRecordedIncome: true,
  everRecordedExpense: true,
  materialsTrap: { triggered: true, buyListTotal: 900, expenseTotal: 50 },
});
ok("the expense total is the REAL sum of what was logged ($50), not suppressed to null",
  TRAP.expenses.value === 50 && TRAP.expenses.available);
ok("…but flagged incomplete, and so is remaining, which is built from it",
  TRAP.expenses.incomplete === true && TRAP.remaining.incomplete === true);
ok("income carries no such flag — the trap is about expenses, not what came in",
  TRAP.income.incomplete === false);
ok("the trap object rides along unchanged, for the UI's own banner",
  TRAP.materialsTrap.buyListTotal === 900 && TRAP.materialsTrap.expenseTotal === 50);

const NO_TRAP = run({
  payments: [],
  expenses: [exp(50, "2026-06-11", "Materials")],
  everRecordedIncome: false,
  everRecordedExpense: true,
  materialsTrap: { triggered: false, buyListTotal: 0, expenseTotal: 50 },
});
ok("no trap, no flag", NO_TRAP.expenses.incomplete === false);

// ═══════════════════════════════════════════════════════════════════════════
// Section 8 — float precision and the required-boolean refusal
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n8. Float precision, and the two booleans this file will not assume\n");

const FLOAT = run({
  payments: [pay(0.1, "2026-06-01"), pay(0.2, "2026-06-02")],
  everRecordedIncome: true,
  everRecordedExpense: false,
});
ok("0.10 + 0.20 rounds to exactly $0.30, no float dust",
  FLOAT.income.value === 0.3, FLOAT.income.value);

let threw = null;
try {
  buildMoneyFlow({ from: "2026-06-01", to: "2026-06-30", everRecordedIncome: true });
} catch (err) {
  threw = err;
}
ok("everRecordedExpense left unanswered → refuses rather than assumes, 500",
  threw?.status === 500);

let rangeThrew = null;
try {
  buildMoneyFlow({
    from: "2026-06-30",
    to: "2026-06-01",
    everRecordedIncome: true,
    everRecordedExpense: true,
  });
} catch (err) {
  rangeThrew = err;
}
ok("a backwards range refuses too, 400", rangeThrew?.status === 400);

// ═══════════════════════════════════════════════════════════════════════════
// Section 9 — generic invariant over every figure every fixture produced
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n9. Generic invariant: value is null iff unavailable, over every result above\n");

let invariantHolds = true;
const invariantBreaks = [];
for (const result of RESULTS) {
  for (const [key, figureValue] of [
    ["income", result.income],
    ["expenses", result.expenses],
    ["remaining", result.remaining],
  ]) {
    const nullMatchesAvailability = figureValue.available ? figureValue.value !== null : figureValue.value === null;
    const reasonOnlyWhenAbsent = figureValue.available ? figureValue.reason === null : Boolean(figureValue.reason);
    if (!nullMatchesAvailability || !reasonOnlyWhenAbsent) {
      invariantHolds = false;
      invariantBreaks.push(`${key}: ${JSON.stringify(figureValue)}`);
    }
  }
}
ok("value === null exactly when available === false, on every figure, every fixture",
  invariantHolds, invariantBreaks);

// ═══════════════════════════════════════════════════════════════════════════
// Section 10 — REASONS is the actual closed vocabulary
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n10. REASONS is the real closed vocabulary\n");

const producedReasons = new Set();
for (const result of RESULTS) {
  for (const figureValue of [result.income, result.expenses, result.remaining]) {
    if (figureValue.reason) producedReasons.add(figureValue.reason);
  }
}
ok("every reason code any fixture produced is a real REASONS key",
  [...producedReasons].every((code) => code in REASONS), [...producedReasons]);
ok("every REASONS key was produced by at least one fixture above",
  Object.keys(REASONS).every((code) => producedReasons.has(code)),
  Object.keys(REASONS).filter((code) => !producedReasons.has(code)));

// ═══════════════════════════════════════════════════════════════════════════
// Section 12 — computeInvoiceState: a refund or a chargeback must not leave
//               an invoice reading "paid" (money-fixes: finding #1)
// ═══════════════════════════════════════════════════════════════════════════
//
// lib/invoices/computeInvoiceState.js is the one place recordStripePayment.js,
// recordStripeRefund.js, recordStripeDispute.js and app/api/payments/route.js
// all derive an invoice's amountPaid/amountDue/amountRefunded/status from its
// Payment rows. Fixture-tested here the same way buildMoneyFlow is above —
// pure function, no database — and mutation-tested alongside it in Section 13.

console.log("\n12. computeInvoiceState — refunds and disputes never read as 'paid'\n");

const pay2 = (amount, extra = {}) => ({ amount, refundedAmount: 0, disputeStatus: null, ...extra });

const NO_PAYMENTS = computeInvoiceState({ total: 500, payments: [], priorStatus: "sent" });
ok("no payments: nothing paid, nothing due changes, status untouched",
  NO_PAYMENTS.amountPaid === 0 && NO_PAYMENTS.amountDue === 500 &&
    NO_PAYMENTS.amountRefunded === 0 && NO_PAYMENTS.status === "sent" && !NO_PAYMENTS.isPaid);

const FULLY_PAID = computeInvoiceState({ total: 500, payments: [pay2(500)], priorStatus: "sent" });
ok("one payment covering the total: paid, isPaid true",
  FULLY_PAID.amountPaid === 500 && FULLY_PAID.amountDue === 0 &&
    FULLY_PAID.status === "paid" && FULLY_PAID.isPaid === true);

const ZERO_TOTAL_NO_PAYMENTS = computeInvoiceState({ total: 0, payments: [], priorStatus: "draft" });
ok("a $0 invoice with nothing paid is NOT 'paid' — amountDue<=0 alone must not imply isPaid (lib/invoices/lifecycle.js draws exactly this distinction)",
  ZERO_TOTAL_NO_PAYMENTS.isPaid === false, ZERO_TOTAL_NO_PAYMENTS);

const FULL_REFUND = computeInvoiceState({
  total: 500,
  payments: [pay2(500, { refundedAmount: 500 })],
  priorStatus: "paid",
});
ok("fully refunded: status becomes 'refunded', not 'paid', and amountDue reopens",
  FULL_REFUND.status === "refunded" && FULL_REFUND.amountPaid === 0 &&
    FULL_REFUND.amountDue === 500 && FULL_REFUND.amountRefunded === 500,
  FULL_REFUND);

const PARTIAL_REFUND = computeInvoiceState({
  total: 500,
  payments: [pay2(500, { refundedAmount: 200 })],
  priorStatus: "paid",
});
ok("partially refunded: a DIFFERENT status from a full refund, per the brief's own instruction",
  PARTIAL_REFUND.status === "partially_refunded" && PARTIAL_REFUND.amountPaid === 300 &&
    PARTIAL_REFUND.amountDue === 200 && PARTIAL_REFUND.amountRefunded === 200,
  PARTIAL_REFUND);

const MIXED_PAYMENTS = computeInvoiceState({
  total: 500,
  payments: [pay2(200), pay2(300, { refundedAmount: 300 })],
  priorStatus: "paid",
});
ok("two payments, only one refunded: nets out per-payment, not per-invoice",
  MIXED_PAYMENTS.amountPaid === 200 && MIXED_PAYMENTS.amountRefunded === 300 &&
    MIXED_PAYMENTS.status === "partially_refunded", MIXED_PAYMENTS);

const OPEN_DISPUTE = computeInvoiceState({
  total: 500,
  payments: [pay2(500, { disputeStatus: "needs_response" })],
  priorStatus: "paid",
});
ok("an open dispute outranks 'paid' — different from both paid and unpaid, per the brief",
  OPEN_DISPUTE.status === "disputed" && OPEN_DISPUTE.amountRefunded === 0,
  OPEN_DISPUTE);

const WON_DISPUTE = computeInvoiceState({
  total: 500,
  payments: [pay2(500, { disputeStatus: "won" })],
  priorStatus: "disputed",
});
ok("a WON dispute clears back to an ordinary paid invoice — nothing was actually taken",
  WON_DISPUTE.status === "paid" && WON_DISPUTE.amountPaid === 500, WON_DISPUTE);

const LOST_DISPUTE = computeInvoiceState({
  total: 500,
  payments: [pay2(500, { disputeStatus: "lost" })],
  priorStatus: "disputed",
});
ok("a LOST dispute reads as refunded — Stripe never fires charge.refunded for one, so this is the only place that fact gets recorded",
  LOST_DISPUTE.status === "refunded" && LOST_DISPUTE.amountRefunded === 500 &&
    LOST_DISPUTE.amountPaid === 0, LOST_DISPUTE);

const OVERPAID = computeInvoiceState({ total: 500, payments: [pay2(600)], priorStatus: "sent" });
ok("amountDue never goes negative on an overpayment", OVERPAID.amountDue === 0, OVERPAID);

const OVER_REFUNDED = computeInvoiceState({
  total: 500,
  payments: [pay2(300, { refundedAmount: 400 })],
  priorStatus: "paid",
});
ok("amountPaid never goes negative even if refundedAmount somehow exceeds the payment",
  OVER_REFUNDED.amountPaid === 0, OVER_REFUNDED);

// ═══════════════════════════════════════════════════════════════════════════
// Section 11 — mutation pass: every guarantee above must be load-bearing
// ═══════════════════════════════════════════════════════════════════════════

const MUTATING = !process.argv.includes("--no-mutate");
if (!MUTATING) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);
}

console.log("\n11. Mutation pass — every guarantee above must actually be load-bearing\n");

const LIB = fileURLToPath(new URL("../lib/analytics/moneyFlow.js", import.meta.url));
// computeInvoiceState.js — mutated alongside moneyFlow.js below (Section 12's
// own guarantees) rather than in a second script, since this file already
// carries the exact machinery (backup, mutate, re-run as a subprocess,
// restore) a second pure-function mutation pass needs.
const LIB2 = fileURLToPath(new URL("../lib/invoices/computeInvoiceState.js", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));

const backupDir = mkdtempSync(join(tmpdir(), "money-flow-"));
const ORIGINAL = readFileSync(LIB, "utf8");
const ORIGINAL2 = readFileSync(LIB2, "utf8");
writeFileSync(join(backupDir, "moneyFlow.js.bak"), ORIGINAL);
writeFileSync(join(backupDir, "computeInvoiceState.js.bak"), ORIGINAL2);

const MUTATIONS = [
  [
    "shows a real $0 of income for a company that has never been paid",
    (s) =>
      s.replace(
        '  const income = figure({\n    value: incomeTotal,\n    available: everRecordedIncome,',
        '  const income = figure({\n    value: incomeTotal,\n    available: true,',
      ),
  ],
  [
    "shows a real $0 of expenses for a company that has never logged one",
    (s) =>
      s.replace(
        '  const expensesFigure = figure({\n    value: expenseTotal,\n    available: everRecordedExpense,',
        '  const expensesFigure = figure({\n    value: expenseTotal,\n    available: true,',
      ),
  ],
  [
    "computes 'remaining' when only ONE side of the ledger is known",
    (s) => s.replace(
      "const bothKnown = everRecordedIncome && everRecordedExpense;",
      "const bothKnown = everRecordedIncome || everRecordedExpense;",
    ),
  ],
  [
    "drops the materials-trap incomplete flag off the expenses figure",
    (s) =>
      s.replace(
        "was actually logged is a right number about a partial picture).\n    incomplete: materialsIncomplete,",
        "was actually logged is a right number about a partial picture).\n    incomplete: false,",
      ),
  ],
  [
    "blames the wrong side for 'remaining' being unavailable",
    (s) =>
      s.replace(
        '      : !everRecordedIncome\n        ? "no_payments_recorded"\n        : "no_expenses_recorded",',
        '      : !everRecordedIncome\n        ? "no_expenses_recorded"\n        : "no_payments_recorded",',
      ),
  ],
  [
    "computes an income trend even when income itself has no history",
    (s) =>
      s.replace(
        "income: income.available ? compare(incomeTotal, priorIncomeTotal) : null,",
        "income: compare(incomeTotal, priorIncomeTotal),",
      ),
  ],
  [
    "fills a day with a fabricated $0 of income for a company with no income history",
    (s) => s.replace(
      "const incomeByDay = everRecordedIncome ? sumByDay(payments) : null;",
      "const incomeByDay = sumByDay(payments);",
    ),
  ],
  [
    "hides the chart unless BOTH income and expenses have history",
    (s) => s.replace(
      "chartAvailable: everRecordedIncome || everRecordedExpense,",
      "chartAvailable: everRecordedIncome && everRecordedExpense,",
    ),
  ],
  [
    "excludes uncategorised expenses instead of naming them — the reference's own bug",
    (s) => s.replace(
      "const name = raw || UNCATEGORISED_LABEL;",
      "if (!raw) continue;\n    const name = raw;",
    ),
  ],
  [
    "stops rounding sums to the cent, letting float dust leak into every total",
    (s) =>
      s.replace(
        "function sumAmount(rows) {\n  return round2((rows || []).reduce((s, r) => s + num(r?.amount), 0));\n}",
        "function sumAmount(rows) {\n  return (rows || []).reduce((s, r) => s + num(r?.amount), 0);\n}",
      ),
  ],
  [
    "the prior window overlaps the current period by a day instead of ending the day before it starts",
    (s) => s.replace(
      "const priorEnd = new Date(start.getTime() - DAY_MS);",
      "const priorEnd = new Date(start.getTime());",
    ),
  ],
];

// computeInvoiceState.js's own mutants — the money-fixes brief's own
// instruction: "mutation-test every assertion and report which mutations
// you ran."
const MUTATIONS2 = [
  [
    "a lost dispute stops reading as a refund — Stripe never fires charge.refunded for one, so this would leave the invoice claiming money that's actually gone",
    (s) => s.replace(
      'p.disputeStatus === "lost" ? Math.max(0, num(p.amount) - refunded) : 0;',
      "0;",
    ),
  ],
  [
    "an open dispute stops outranking 'paid'",
    (s) => s.replace(
      'if (hasOpenDispute) {\n    // Outranks "refunded" and "paid" alike',
      'if (false) {\n    // Outranks "refunded" and "paid" alike',
    ),
  ],
  [
    "a $0 invoice with nothing paid reads as isPaid — amountDue<=0 alone starts to mean 'paid'",
    (s) => s.replace(
      "isPaid = amountDue <= PAID_EPSILON && netPaid > PAID_EPSILON;",
      "isPaid = amountDue <= PAID_EPSILON;",
    ),
  ],
  [
    "a partial refund reads as a FULL refund — the brief's own instruction was that these must stay distinguishable",
    (s) => s.replace(
      'status = netPaid <= PAID_EPSILON ? "refunded" : "partially_refunded";',
      'status = "refunded";',
    ),
  ],
  [
    "amountDue can go negative on an overpayment",
    (s) => s.replace(
      "const amountDue = Math.max(0, num(total) - netPaid);",
      "const amountDue = num(total) - netPaid;",
    ),
  ],
  [
    "amountPaid (netPaid) can go negative when refundedAmount exceeds the payment",
    (s) => s.replace(
      "const netPaid = Math.max(0, grossPaid - amountRefunded);",
      "const netPaid = grossPaid - amountRefunded;",
    ),
  ],
];

// ── One mutation that was tried and is NOT in the list above ────────────────
//
// There is no line in this file that reads Invoice.total, invoiceId or
// version — income is a straight sum of whatever `payments` rows the caller
// hands in, full stop. So "make income double-count an amended invoice" has
// no code to mutate INTO existing; Section 3's fixtures are a regression
// proof against the route ever changing that (feeding this file
// Invoice-shaped rows instead of Payment-shaped ones), not a mutation this
// file's own arithmetic could introduce. Asserting a mutation that can't be
// expressed would be the same "check that can never fail" check-kpis.mjs's
// own header warns against.

// Runs one file's mutation list, one mutant at a time: mutate, re-run this
// whole script (minus mutation) as a subprocess, restore, repeat. Shared by
// moneyFlow.js's own mutants above and computeInvoiceState.js's below —
// same technique, different target file, so this is the one place either
// list is actually applied.
function runMutations(file, original, mutations) {
  let localCaught = 0;
  const localEscaped = [];
  for (const [label, mutate] of mutations) {
    const mutated = mutate(original);
    if (mutated === original) {
      localEscaped.push(`${label} — the mutation did not apply (the source moved under it)`);
      continue;
    }
    writeFileSync(file, mutated);
    let survived = false;
    try {
      execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], {
        stdio: ["ignore", "pipe", "pipe"],
      });
      survived = true;
    } catch {
      /* non-zero exit = the mutant was caught, which is the point */
    }
    writeFileSync(file, original);
    if (survived) localEscaped.push(`${label} — NOT caught`);
    else {
      localCaught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
  return { caught: localCaught, escaped: localEscaped };
}

let caught = 0;
const escaped = [];
try {
  const r1 = runMutations(LIB, ORIGINAL, MUTATIONS);
  caught += r1.caught;
  escaped.push(...r1.escaped);

  console.log("\n13. computeInvoiceState.js mutants\n");
  const r2 = runMutations(LIB2, ORIGINAL2, MUTATIONS2);
  caught += r2.caught;
  escaped.push(...r2.escaped);
} finally {
  writeFileSync(LIB, ORIGINAL);
  writeFileSync(LIB2, ORIGINAL2);
  rmSync(backupDir, { recursive: true, force: true });
}
ok(`all ${MUTATIONS.length} moneyFlow.js mutants caught`,
  escaped.length === 0 || !escaped.some((e) => MUTATIONS.some(([l]) => e.startsWith(l))),
  escaped.join(" | "));
ok(`all ${MUTATIONS2.length} computeInvoiceState.js mutants caught`,
  !escaped.some((e) => MUTATIONS2.some(([l]) => e.startsWith(l))),
  escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
