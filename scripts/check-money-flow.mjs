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
// 10 checks REASONS is the actual closed vocabulary. Section 12 does the
// same for lib/invoices/computeInvoiceState.js, and Section 14 for
// lib/paymentSchedule/engine.js — the payment-schedule engine's halfway
// math, trigger resolution, cent-exact allocation and validity gate,
// executed against the owner's own worked example, odd durations, missing
// dates, a backwards range and a DST-spanning job. Section 17 does the
// identical thing for lib/analytics/payrollCost.js — the Business costs
// section's payroll figure, a different table (TimeEntry, not Expense) with
// its own everRecorded rule and its own "hours with no resolvable rate"
// refusal. Section 11 mutates all
// four files on disk, one bug at a time, and re-runs this file as a
// subprocess to confirm each bug makes an assertion above fail —
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
import { buildPayrollCost, REASONS as PAYROLL_REASONS } from "@/lib/analytics/payrollCost";
import { computeInvoiceState } from "@/lib/invoices/computeInvoiceState";
import {
  jobDurationDays,
  halfwayDate,
  resolveStageDueDate,
  validateSchedulePercentages,
  allocateAmountCents,
  computeSchedule,
  isStageDue,
  scheduleToText,
} from "@/lib/paymentSchedule/engine";

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
// Section 14 — lib/paymentSchedule/engine.js: the halfway math and friends
// ═══════════════════════════════════════════════════════════════════════════
//
// This touches money on a schedule nobody is watching in real time (a cron
// fires it, not a person clicking "charge"), which is the money-fixes brief's
// own bar for "execute it against hostile input, don't just read it." Pure,
// no database — same discipline as lib/servicePlans/schedule.js, mutation-
// tested in Section 15 below the same way moneyFlow.js and
// computeInvoiceState.js already are in this file.

console.log("\n14. lib/paymentSchedule/engine.js — the halfway math and friends\n");

const UTC2 = (s) => new Date(`${s}T00:00:00.000Z`);
const isoOrNull = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

// ── The owner's own worked example, to the day ──────────────────────────────
const SIX_DAY = halfwayDate(UTC2("2026-09-01"), UTC2("2026-09-06"));
ok("6-day job (Sept 1 → Sept 6): halfway lands on Sept 3, exactly as the owner worked it out",
  isoOrNull(SIX_DAY) === "2026-09-03", isoOrNull(SIX_DAY));
ok("…and the duration behind it is 6 days, inclusive, not 5",
  jobDurationDays(UTC2("2026-09-01"), UTC2("2026-09-06")) === 6);

// ── A 1-day job: every date-based trigger collapses onto the same day ──────
const ONE_DAY = { startDate: UTC2("2026-04-10"), endDate: UTC2("2026-04-10") };
ok("1-day job: duration is 1, not 0", jobDurationDays(ONE_DAY.startDate, ONE_DAY.endDate) === 1);
ok("1-day job: halfway falls on the start/end day itself",
  isoOrNull(halfwayDate(ONE_DAY.startDate, ONE_DAY.endDate)) === "2026-04-10");
for (const trig of ["job_start", "job_end", "halfway"]) {
  const r = resolveStageDueDate(trig, ONE_DAY);
  ok(`1-day job: ${trig} resolves to the same single date, not blocked`,
    isoOrNull(r.dueDate) === "2026-04-10" && r.blockedReason === null, r);
}

// ── A 5-day job: the odd-duration rounding decision, exercised ─────────────
// Sept 1 → Sept 5 inclusive = 5 days. 5/2 = 2.5, and this codebase rounds UP
// (day 3 = Sept 3) rather than down (day 2 = Sept 2) — see engine.js's own
// header for why: asking for the halfway payment only once MORE than half
// the job is done, never before.
const FIVE_DAY = halfwayDate(UTC2("2026-09-01"), UTC2("2026-09-05"));
ok("5-day job: halfway rounds UP to day 3 (Sept 3), not day 2",
  isoOrNull(FIVE_DAY) === "2026-09-03", isoOrNull(FIVE_DAY));

// ── No end date: halfway and job_end are BLOCKED, visibly, never a guess ───
const NO_END = { startDate: UTC2("2026-09-01"), endDate: null };
const halfwayNoEnd = resolveStageDueDate("halfway", NO_END);
ok("halfway with no end date: blocked as awaiting_end_date, dueDate stays null",
  halfwayNoEnd.dueDate === null && halfwayNoEnd.blockedReason === "awaiting_end_date", halfwayNoEnd);
const jobEndNoEnd = resolveStageDueDate("job_end", NO_END);
ok("job_end with no end date: blocked the same way",
  jobEndNoEnd.dueDate === null && jobEndNoEnd.blockedReason === "awaiting_end_date", jobEndNoEnd);
const jobStartStillWorks = resolveStageDueDate("job_start", NO_END);
ok("job_start with no end date: unaffected — it never needed one",
  isoOrNull(jobStartStillWorks.dueDate) === "2026-09-01" && jobStartStillWorks.blockedReason === null);
ok("on_invoice_created never blocks and never dates itself — it fires at creation, not off a clock",
  resolveStageDueDate("on_invoice_created", NO_END).blockedReason === null &&
    resolveStageDueDate("on_invoice_created", NO_END).dueDate === null);

// ── No start date either: nothing date-based can resolve ────────────────────
const NOTHING_SET = { startDate: null, endDate: null };
ok("job_start with NO dates at all: blocked as awaiting_start_date",
  resolveStageDueDate("job_start", NOTHING_SET).blockedReason === "awaiting_start_date");
ok("halfway with NO dates at all: blocked on the start, not the end — start is checked first",
  resolveStageDueDate("halfway", NOTHING_SET).blockedReason === "awaiting_start_date");

// ── End before start: an invalid range, not a negative duration ────────────
const BACKWARDS = { startDate: UTC2("2026-09-10"), endDate: UTC2("2026-09-01") };
ok("jobDurationDays refuses a negative range rather than returning -8",
  jobDurationDays(BACKWARDS.startDate, BACKWARDS.endDate) === null);
ok("halfwayDate refuses the same range",
  halfwayDate(BACKWARDS.startDate, BACKWARDS.endDate) === null);
const jobEndBackwards = resolveStageDueDate("job_end", BACKWARDS);
ok("job_end on a backwards range: blocked as invalid_date_range, not a nonsense date",
  jobEndBackwards.dueDate === null && jobEndBackwards.blockedReason === "invalid_date_range", jobEndBackwards);
const halfwayBackwards = resolveStageDueDate("halfway", BACKWARDS);
ok("halfway on a backwards range: blocked the same way",
  halfwayBackwards.dueDate === null && halfwayBackwards.blockedReason === "invalid_date_range", halfwayBackwards);

// ── A job spanning the 2026 US DST change (March 8) ─────────────────────────
// March 5 → March 12 is 8 days inclusive, straddling the spring-forward
// transition. UTC-midnight arithmetic has no DST, so the answer must be
// exactly what plain day-counting says regardless of where the server runs.
const DST_START = UTC2("2026-03-05");
const DST_END = UTC2("2026-03-12");
ok("DST-spanning job: duration is a plain 8 days, unaffected by the clock change",
  jobDurationDays(DST_START, DST_END) === 8);
const dstHalfway = halfwayDate(DST_START, DST_END);
// ceil(8/2) = day 4 = March 5 + 3 = March 8 — the transition day itself.
ok("DST-spanning job: halfway lands on March 8 (day 4), the transition day, exactly as UTC arithmetic says",
  isoOrNull(dstHalfway) === "2026-03-08", isoOrNull(dstHalfway));

// ── Percentages: must sum to exactly 100, reported, never auto-corrected ───
ok("30/40/15/15 sums to exactly 100",
  validateSchedulePercentages([{ percentage: 30 }, { percentage: 40 }, { percentage: 15 }, { percentage: 15 }]).valid);
const NINETY_NINE = validateSchedulePercentages([{ percentage: 50 }, { percentage: 49 }]);
ok("99% is reported invalid, with the real sum attached — never silently accepted",
  NINETY_NINE.valid === false && NINETY_NINE.sum === 99, NINETY_NINE);
const HUNDRED_ONE = validateSchedulePercentages([{ percentage: 51 }, { percentage: 50 }]);
ok("101% is reported invalid too — over-collecting is just as wrong as under",
  HUNDRED_ONE.valid === false && HUNDRED_ONE.sum === 101, HUNDRED_ONE);

// ── computeSchedule still resolves every stage on an invalid set ───────────
// so a Settings screen can show the contractor WHY, not just a bare error.
const invalidComputed = computeSchedule({
  stages: [
    { seq: 0, label: "Deposit", trigger: "on_invoice_created", percentage: 50 },
    { seq: 1, label: "On completion", trigger: "job_end", percentage: 49 },
  ],
  job: { startDate: UTC2("2026-01-01"), endDate: UTC2("2026-01-10") },
  totalCents: 100000,
});
ok("an invalid (99%) set is flagged invalid but still returns every stage, resolved",
  invalidComputed.valid === false && invalidComputed.stages.length === 2, invalidComputed);

// ── Zero-percent stage: no money, never a real request for it ──────────────
const zeroStageAmounts = allocateAmountCents(
  [{ seq: 0, percentage: 0 }, { seq: 1, percentage: 100 }],
  100000,
);
ok("a 0% stage allocates exactly $0, the other absorbs the whole total",
  zeroStageAmounts.find((s) => s.seq === 0).amountCents === 0 &&
    zeroStageAmounts.find((s) => s.seq === 1).amountCents === 100000,
  zeroStageAmounts);

// ── A £0 quote: every stage is $0 regardless of its percentage ─────────────
const zeroQuote = allocateAmountCents(
  [{ seq: 0, percentage: 30 }, { seq: 1, percentage: 70 }],
  0,
);
ok("a £0 quote: both stages allocate exactly $0, not a negative or NaN",
  zeroQuote.every((s) => s.amountCents === 0), zeroQuote);

// ── Remainder-exact allocation: the whole point of allocateAmountCents ─────
// 33.333/33.333/33.334 against $100.00 (10000 cents) — none of the three
// naive per-stage roundings sums back to 10000 on their own; the last stage
// absorbing the remainder must make it exact regardless.
const thirds = allocateAmountCents(
  [{ seq: 0, percentage: 33.333 }, { seq: 1, percentage: 33.333 }, { seq: 2, percentage: 33.334 }],
  10000,
);
ok("three near-equal stages still sum to EXACTLY the total, to the cent",
  thirds.reduce((s, a) => s + a.amountCents, 0) === 10000, thirds);
// The owner's real 30/40/15/15 example against an odd total that doesn't
// divide evenly — $100.01 — to prove the remainder lands on the LAST stage
// (seq 3, job_end) rather than getting lost or duplicated.
const realSplit = allocateAmountCents(
  [
    { seq: 0, percentage: 30 },
    { seq: 1, percentage: 40 },
    { seq: 2, percentage: 15 },
    { seq: 3, percentage: 15 },
  ],
  10001,
);
ok("30/40/15/15 against $100.01 sums to exactly 10001 cents",
  realSplit.reduce((s, a) => s + a.amountCents, 0) === 10001, realSplit);

// ── isStageDue: on_invoice_created never fires off a clock ──────────────────
ok("on_invoice_created is never 'due' by date, however far in the past dueDate would read",
  isStageDue({ trigger: "on_invoice_created", dueDate: UTC2("2020-01-01") }, { now: UTC2("2026-01-01") }) === false);
ok("a job_end stage due yesterday IS due today",
  isStageDue({ trigger: "job_end", dueDate: UTC2("2026-01-01") }, { now: UTC2("2026-01-02") }) === true);
ok("a job_end stage due tomorrow is NOT due today",
  isStageDue({ trigger: "job_end", dueDate: UTC2("2026-01-03") }, { now: UTC2("2026-01-02") }) === false);
ok("a stage with no dueDate at all is never due",
  isStageDue({ trigger: "job_end", dueDate: null }, { now: UTC2("2026-01-02") }) === false);

// ── scheduleToText: keeps Company.paymentTerms honest, or writes nothing ───
ok("a valid schedule renders the exact sentence parsePaymentSchedule already knows how to read",
  scheduleToText([
    { seq: 0, label: "Deposit", percentage: 30 },
    { seq: 1, label: "Job start", percentage: 70 },
  ]) === "30% Deposit, 70% Job start");
ok("an invalid (non-100) schedule renders nothing — never overwrites paymentTerms with a broken sentence",
  scheduleToText([{ seq: 0, label: "Deposit", percentage: 50 }]) === "");
ok("an empty schedule renders nothing",
  scheduleToText([]) === "");

// ═══════════════════════════════════════════════════════════════════════════
// Section 17 — lib/analytics/payrollCost.js: payroll cost, the Business
// costs section's own figure, mutation-tested in Section 18 below
// ═══════════════════════════════════════════════════════════════════════════

console.log("\n17. lib/analytics/payrollCost.js — approved hours × each worker's own rate\n");

const PAYROLL_RESULTS = [];
function payrollRun(overrides) {
  const r = buildPayrollCost({
    workers: [],
    laborCostByUser: new Map(),
    approvedHoursByWorker: {},
    pendingHoursByWorker: {},
    everRecordedTime: false,
    ...overrides,
  });
  PAYROLL_RESULTS.push(r);
  return r;
}

// ── No approved time ever, at any date — unknown, not a $0 ─────────────────
const NO_TIME = payrollRun({});
ok("value is null, unavailable, no_time_entries_recorded",
  NO_TIME.value === null && !NO_TIME.available && NO_TIME.reason === "no_time_entries_recorded");
ok("a real sentence rides along", NO_TIME.reasonText === PAYROLL_REASONS.no_time_entries_recorded);
ok("sampleSize is 0 with nobody paid", NO_TIME.sampleSize === 0);

// ── Approved time exists as a fact, none clocked THIS period — a real $0 ───
const PAYROLL_QUIET_PERIOD = payrollRun({
  everRecordedTime: true,
  workers: [{ id: "w1", userId: "u1", hourlyRate: 25 }],
});
ok("a real $0 — the crew has clocked before, just not this period",
  PAYROLL_QUIET_PERIOD.value === 0 && PAYROLL_QUIET_PERIOD.available === true);

// ── One rated worker, straightforward arithmetic ───────────────────────────
const ONE_WORKER = payrollRun({
  everRecordedTime: true,
  workers: [{ id: "w1", userId: "u1", hourlyRate: 25 }],
  approvedHoursByWorker: { w1: 10 },
});
ok("10h × $25 = $250", ONE_WORKER.value === 250, ONE_WORKER.value);
ok("one worker paid", ONE_WORKER.sampleSize === 1);
ok("not incomplete — the one worker who logged hours has a rate", ONE_WORKER.incomplete === false);

// ── effectiveWageRate's own fallback: Worker.hourlyRate wins when set, else
// Member.laborCostPerHour by userId — reused from buildPayRun.js, not
// re-decided (docs/ROADMAP.md §5's three drifted pay-rate paths) ───────────
const FALLBACK_RATE = payrollRun({
  everRecordedTime: true,
  workers: [{ id: "w2", userId: "u2", hourlyRate: null }],
  laborCostByUser: new Map([["u2", 20]]),
  approvedHoursByWorker: { w2: 5 },
});
ok("5h × the Member fallback rate ($20) = $100, when Worker.hourlyRate is unset",
  FALLBACK_RATE.value === 100, FALLBACK_RATE.value);

const EXPLICIT_WINS = payrollRun({
  everRecordedTime: true,
  workers: [{ id: "w1", userId: "u1", hourlyRate: 25 }],
  laborCostByUser: new Map([["u1", 999]]), // must never be read — hourlyRate is set
  approvedHoursByWorker: { w1: 4 },
});
ok("Worker.hourlyRate ($25) wins over a Member fallback that's also on file",
  EXPLICIT_WINS.value === 100, EXPLICIT_WINS.value);

// ── Hours with no resolvable rate: excluded, named, never free ─────────────
const UNRATED = payrollRun({
  everRecordedTime: true,
  workers: [
    { id: "w1", userId: "u1", hourlyRate: 25 },
    { id: "w3", userId: null, hourlyRate: null }, // no Worker rate, no Member to fall back to
  ],
  approvedHoursByWorker: { w1: 10, w3: 8 },
});
ok("only the rated worker's hours are priced: 10h × $25 = $250, the unrated 8h excluded",
  UNRATED.value === 250, UNRATED.value);
ok("incomplete — a real worker logged real hours this file can't price",
  UNRATED.incomplete === true);
ok("the excluded hours and the worker count both ride along, not silently dropped",
  UNRATED.raw.unratedHours === 8 && UNRATED.raw.unratedWorkers === 1);
ok("the rated worker's hours are counted separately from the unrated ones",
  UNRATED.raw.ratedHours === 10);

// ── Pending hours: counted for visibility, never priced ─────────────────────
const PENDING = payrollRun({
  everRecordedTime: true,
  workers: [{ id: "w1", userId: "u1", hourlyRate: 25 }],
  approvedHoursByWorker: { w1: 10 },
  pendingHoursByWorker: { w1: 6 },
});
ok("pending hours don't inflate the paid total", PENDING.value === 250, PENDING.value);
ok("pending hours are reported so the screen can say what's still awaiting approval",
  PENDING.raw.pendingHours === 6);

// ── Float precision — moneyFlow.js's own 0.10 + 0.20 proof, restated for a
// running total accumulated across MULTIPLE workers rather than summed once
// at the end ──────────────────────────────────────────────────────────────
const PAYROLL_FLOAT = payrollRun({
  everRecordedTime: true,
  workers: [
    { id: "w1", userId: "u1", hourlyRate: 0.1 },
    { id: "w2", userId: "u2", hourlyRate: 0.2 },
  ],
  approvedHoursByWorker: { w1: 1, w2: 1 },
});
ok("0.1 + 0.2, accumulated one worker at a time, still lands on exactly $0.30",
  PAYROLL_FLOAT.value === 0.3, PAYROLL_FLOAT.value);

// ── The required boolean, not defaulted ─────────────────────────────────────
let payrollThrew = false;
try {
  buildPayrollCost({ workers: [], everRecordedTime: undefined });
} catch (err) {
  payrollThrew = err.status === 500;
}
ok("refuses to guess everRecordedTime when the caller doesn't supply it", payrollThrew);

// ── Generic invariant, same shape Section 9 asserts for moneyFlow.js ───────
ok("payrollCost: value is null exactly when unavailable, over every fixture above",
  PAYROLL_RESULTS.every((r) => (r.value === null) === !r.available));
ok("payrollCost: a reason is only ever attached when unavailable",
  PAYROLL_RESULTS.every((r) => r.available || r.reason !== null));

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
// lib/paymentSchedule/engine.js — Section 14's own guarantees, mutated the
// same way, same reason: money moves off this file's arithmetic with no
// person watching (a cron fires it), which is exactly the case the money-
// fixes brief singles out for execution over reading.
const LIB3 = fileURLToPath(new URL("../lib/paymentSchedule/engine.js", import.meta.url));
// lib/analytics/payrollCost.js — Section 17's own guarantees, mutated the
// same way, same reason: this is the arithmetic behind the Business costs
// section's payroll figure, which nobody hand-checks against a payslip.
const LIB4 = fileURLToPath(new URL("../lib/analytics/payrollCost.js", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));

const backupDir = mkdtempSync(join(tmpdir(), "money-flow-"));
const ORIGINAL = readFileSync(LIB, "utf8");
const ORIGINAL2 = readFileSync(LIB2, "utf8");
const ORIGINAL3 = readFileSync(LIB3, "utf8");
const ORIGINAL4 = readFileSync(LIB4, "utf8");
writeFileSync(join(backupDir, "moneyFlow.js.bak"), ORIGINAL);
writeFileSync(join(backupDir, "computeInvoiceState.js.bak"), ORIGINAL2);
writeFileSync(join(backupDir, "paymentScheduleEngine.js.bak"), ORIGINAL3);
writeFileSync(join(backupDir, "payrollCost.js.bak"), ORIGINAL4);

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

// lib/paymentSchedule/engine.js's own mutants — Section 14's guarantees,
// mutated the same way, run in Section 16 below.
const MUTATIONS3 = [
  [
    "the odd-duration halfway rounding flips from UP to DOWN — the 5-day job would land on day 2 (Sept 2) instead of day 3 (Sept 3), asking for the payment before the midpoint of the work",
    (s) => s.replace(
      "const halfwayDayIndex = Math.ceil(duration / 2); // round UP — see header",
      "const halfwayDayIndex = Math.floor(duration / 2); // round UP — see header",
    ),
  ],
  [
    "jobDurationDays stops refusing a backwards range — a job ending before it starts would compute a NEGATIVE duration instead of null",
    (s) => s.replace(
      "  if (diff < 0) return null;\n  return diff + 1;",
      "  return diff + 1;",
    ),
  ],
  [
    "job_end stops checking for a backwards range on its own — would resolve a due date even when start is after end",
    (s) => s.replace(
      'if (trigger === "job_end") {\n    if (!end) return { dueDate: null, blockedReason: "awaiting_end_date" };\n    if (start && daysBetweenUTC(start, end) < 0) {\n      return { dueDate: null, blockedReason: "invalid_date_range" };\n    }',
      'if (trigger === "job_end") {\n    if (!end) return { dueDate: null, blockedReason: "awaiting_end_date" };',
    ),
  ],
  [
    "on_invoice_created stops being special-cased in isStageDue — a stale dueDate (there should never be one) would make it fire off a clock instead of only at creation",
    (s) => s.replace(
      'if (!stage || stage.trigger === "on_invoice_created") return false;',
      "if (!stage) return false;",
    ),
  ],
  [
    "the last stage stops absorbing the rounding remainder in allocateAmountCents — 30/40/15/15 against an odd total would drift by a cent instead of landing exactly on it",
    (s) => s.replace(
      "cents[cents.length - 1] = Math.max(0, total - allocated);",
      'cents[cents.length - 1] = Math.max(0, Math.round((num(ordered[ordered.length - 1]?.percentage) / 100) * total));',
    ),
  ],
  [
    "PERCENT_EPSILON widens enough to wave 99% and 101% through as valid",
    (s) => s.replace(
      "const PERCENT_EPSILON = 0.001;",
      "const PERCENT_EPSILON = 5;",
    ),
  ],
  [
    "scheduleToText stops checking validity — would generate (and let a caller write to Company.paymentTerms) a sentence for a schedule that doesn't sum to 100",
    (s) => s.replace(
      "  const { valid } = validateSchedulePercentages(list);\n  if (!valid || list.length === 0) return \"\";",
      '  if (list.length === 0) return "";',
    ),
  ],
];

// lib/analytics/payrollCost.js's own mutants — Section 17's guarantees, run
// in Section 18 below, the same technique as the three lists above.
const MUTATIONS4 = [
  [
    "shows a real $0 of payroll for a company that has never had approved time — the everRecorded refusal stops being load-bearing",
    (s) => s.replace(
      "  const available = everRecordedTime;",
      "  const available = true;",
    ),
  ],
  [
    "folds unrated hours in as free labour instead of excluding them",
    (s) => s.replace(
      "    if (rate === null) {\n      unratedHours = round2(unratedHours + hours);\n      unratedWorkers += 1;\n      continue;\n    }",
      "    if (rate === null) {\n      unratedHours = round2(unratedHours + hours);\n      unratedWorkers += 1;\n    }",
    ),
  ],
  [
    "stops flagging incomplete when a real worker's hours couldn't be priced",
    (s) => s.replace(
      "  const incomplete = unratedWorkers > 0;",
      "  const incomplete = false;",
    ),
  ],
  [
    "prices PENDING hours as if they were approved — buildPayRun.js's own 'only approved time is paid' rule, unenforced here",
    (s) => s.replace(
      "  for (const worker of workers) {\n    const hours = num(approvedHoursByWorker[worker.id]);",
      "  for (const worker of workers) {\n    const hours = num(approvedHoursByWorker[worker.id]) + num(pendingHoursByWorker[worker.id]);",
    ),
  ],
  [
    "stops rounding the running total, letting float dust leak into every figure",
    (s) => s.replace(
      "    total = round2(total + hours * rate);",
      "    total = total + hours * rate;",
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

  console.log("\n16. lib/paymentSchedule/engine.js mutants\n");
  const r3 = runMutations(LIB3, ORIGINAL3, MUTATIONS3);
  caught += r3.caught;
  escaped.push(...r3.escaped);

  console.log("\n18. lib/analytics/payrollCost.js mutants\n");
  const r4 = runMutations(LIB4, ORIGINAL4, MUTATIONS4);
  caught += r4.caught;
  escaped.push(...r4.escaped);
} finally {
  writeFileSync(LIB, ORIGINAL);
  writeFileSync(LIB2, ORIGINAL2);
  writeFileSync(LIB3, ORIGINAL3);
  writeFileSync(LIB4, ORIGINAL4);
  rmSync(backupDir, { recursive: true, force: true });
}
ok(`all ${MUTATIONS.length} moneyFlow.js mutants caught`,
  escaped.length === 0 || !escaped.some((e) => MUTATIONS.some(([l]) => e.startsWith(l))),
  escaped.join(" | "));
ok(`all ${MUTATIONS2.length} computeInvoiceState.js mutants caught`,
  !escaped.some((e) => MUTATIONS2.some(([l]) => e.startsWith(l))),
  escaped.join(" | "));
ok(`all ${MUTATIONS3.length} lib/paymentSchedule/engine.js mutants caught`,
  !escaped.some((e) => MUTATIONS3.some(([l]) => e.startsWith(l))),
  escaped.join(" | "));
ok(`all ${MUTATIONS4.length} payrollCost.js mutants caught`,
  !escaped.some((e) => MUTATIONS4.some(([l]) => e.startsWith(l))),
  escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
