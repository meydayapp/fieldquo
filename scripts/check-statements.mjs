// scripts/check-statements.mjs
//
// The four statements an accountant or a lender accepts, and the eight ways a
// report like this quietly lies.
//
// ══ Why this file executes rather than reads ═══════════════════════════════
//
// Every claim below is a claim about ARITHMETIC — that an amended invoice is
// counted once, that loan principal never reaches the profit line, that a total
// containing an unknown says so. None of those can be established by matching a
// regex against lib/accounting/statements.js: a check that reads the source
// passes just as happily against a guard someone disabled with `false &&`. So
// the real builder is imported and run against a scripted month, and the
// assertions are made against the numbers that come back.
//
// The permission half is executed too, for the same reason and by the same
// technique as scripts/check-crew-access.mjs section 10: the real GET handler
// is imported with "@/lib/db", "@/lib/currentMember" and "next/server" swapped
// for stubs, and every shipped preset is pushed through it. Its evaluator lives
// inside that file and is not exported, so a smaller one is built here — the
// same choice scripts/check-ungated-routes.mjs made and for the same reason.
//
// ══ The scripted month ═════════════════════════════════════════════════════
//
// March 2026, for one contractor, containing on purpose every case that has
// ever made a statement wrong:
//
//   INV-100  raised at 1130, AMENDED to 1356. Two rows, one document. A deposit
//            of 565 was taken against the SUPERSEDED row, which is where a real
//            part-payment lands.
//   INV-200  565, issued and paid inside the month.
//   INV-300  issued in FEBRUARY and amended in March. It is February's revenue,
//            and dating it from the amendment would move it.
//   a job    with materials, approved hours, pending hours, and four hours from
//            somebody with no rate on file.
//   a pay run whose gross OVERLAPS the job hours.
//   two loans — one with a rate, one with the schema's default 0, which cannot
//            be told apart from a rate nobody typed.
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-statements.mjs

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { register } from "node:module";

import { buildFinancialStatements, scheduledDebtService, MAX_RANGE_DAYS } from "@/lib/accounting/statements";
import { PERMISSION_PRESETS, PRESET_TO_ROLE } from "@/lib/permissions";
import { canReadCostBasis } from "@/lib/permissions/costBasis";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

const near = (a, b) => typeof a === "number" && Math.abs(a - b) < 0.005;

// ── The fixtures ───────────────────────────────────────────────────────────

const CURRENCY = "CAD";
const FROM = "2026-03-01";
const TO = "2026-03-31";

const CLIENT = { id: "c1", name: "Homeowner", province: "ON", country: "CA" };

const INVOICES = [
  // INV-100 v1 — issued 5 March, superseded.
  {
    id: "i1", invoiceNumber: "INV-100", status: "sent", parentInvoiceId: null, version: 1,
    subtotal: 1000, discount: 0, tax: 130, taxEnabled: true, total: 1130,
    sentAt: "2026-03-05T10:00:00Z", createdAt: "2026-03-05T09:00:00Z", client: CLIENT,
  },
  // INV-100 v2 — the amendment. Same document, more money.
  {
    id: "i2", invoiceNumber: "INV-100", status: "sent", parentInvoiceId: "i1", version: 2,
    subtotal: 1200, discount: 0, tax: 156, taxEnabled: true, total: 1356,
    sentAt: null, createdAt: "2026-03-20T09:00:00Z", client: CLIENT,
  },
  // INV-200 — plain, issued and settled in the month.
  {
    id: "i3", invoiceNumber: "INV-200", status: "paid", parentInvoiceId: null, version: 1,
    subtotal: 500, discount: 0, tax: 65, taxEnabled: true, total: 565,
    sentAt: "2026-03-10T10:00:00Z", createdAt: "2026-03-10T09:00:00Z", client: CLIENT,
  },
  // INV-300 — FEBRUARY's document, amended in March. The trap for the date rule.
  {
    id: "i4", invoiceNumber: "INV-300", status: "sent", parentInvoiceId: null, version: 1,
    subtotal: 800, discount: 0, tax: 104, taxEnabled: true, total: 904,
    sentAt: "2026-02-25T10:00:00Z", createdAt: "2026-02-25T09:00:00Z", client: CLIENT,
  },
  {
    id: "i5", invoiceNumber: "INV-300", status: "sent", parentInvoiceId: "i4", version: 2,
    subtotal: 900, discount: 0, tax: 117, taxEnabled: true, total: 1017,
    sentAt: null, createdAt: "2026-03-10T09:00:00Z", client: CLIENT,
  },
];

const PAYMENTS = [
  // Recorded against the SUPERSEDED row — which is where a deposit taken before
  // an amendment actually lands.
  { id: "p1", invoiceId: "i1", amount: 565, date: "2026-03-12T00:00:00Z", method: "e_transfer" },
  { id: "p2", invoiceId: "i3", amount: 565, date: "2026-03-15T00:00:00Z", method: "card" },
];

const EXPENSES = [
  { id: "e1", category: "materials", amount: 300, date: "2026-03-08T00:00:00Z", isOverhead: false, recurring: false, frequency: "one_time", projectId: "job1" },
  { id: "e2", category: "rent", amount: 400, date: "2026-03-01T00:00:00Z", isOverhead: true, recurring: true, frequency: "monthly", projectId: null },
  // Deliberately on the LAST day of the period: an off-by-one at the closing
  // boundary is invisible without a row sitting on it.
  { id: "e3", category: "software", amount: 50, date: "2026-03-31T00:00:00Z", isOverhead: false, recurring: false, frequency: "one_time", projectId: null },
];

const TIME_ENTRIES = [
  { id: "t1", jobId: "job1", hours: 10, status: "approved", clockIn: "2026-03-07T08:00:00Z", worker: { id: "w1", hourlyRate: 30 } },
  // Approved hours are a cost; PENDING hours are a claim. Same rate, so the
  // only thing separating them is the rule.
  { id: "t2", jobId: "job1", hours: 5, status: "pending", clockIn: "2026-03-09T08:00:00Z", worker: { id: "w1", hourlyRate: 30 } },
  // Approved, and nobody has priced this person.
  { id: "t3", jobId: "job1", hours: 4, status: "approved", clockIn: "2026-03-11T08:00:00Z", worker: { id: "w2", hourlyRate: null } },
];

const PAY_RUNS = [
  {
    id: "pr1", periodStart: "2026-03-01T00:00:00Z", periodEnd: "2026-03-31T00:00:00Z",
    status: "approved", grossTotal: 900, deductionTotal: 200, netTotal: 700,
    paidAt: "2026-03-31T00:00:00Z",
  },
];

const DEBTS = [
  // 12% a year on 12000 → 120 of interest in the first month, 880 of principal.
  { id: "d1", name: "Truck loan", principal: 12000, interestRate: 12, monthlyPayment: 1000, startDate: "2026-03-01T00:00:00Z" },
  // interestRate 0 — the schema default. An interest-free loan and a loan
  // nobody finished entering are the same row.
  { id: "d2", name: "Trailer finance", principal: 5000, interestRate: 0, monthlyPayment: 200, startDate: "2026-01-01T00:00:00Z" },
];

const COMPANY = { name: "Acme Painting", currency: CURRENCY, country: "CA", province: "ON", vatRegistered: null, taxRate: 0 };

const base = (over = {}) => ({
  from: FROM, to: TO, currency: CURRENCY,
  invoices: INVOICES, payments: PAYMENTS, expenses: EXPENSES,
  timeEntries: TIME_ENTRIES, payRuns: PAY_RUNS, debts: DEBTS,
  company: COMPANY, taxRates: [],
  ...over,
});

const cash = buildFinancialStatements(base({ basis: "cash" }));
const accrual = buildFinancialStatements(base({ basis: "accrual" }));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n1. The accounting basis is STATED, and the two bases really differ\n");
//
// An accountant's first question is which basis they are holding. A statement
// that cannot answer it is not a statement, and one that silently mixes the two
// is worse than none — so the mixed half of the accrual view has to announce
// itself as well.

ok("the cash statement says so", cash.basis === "cash");
ok("...in a full sentence, not a code", /CASH basis/.test(cash.basisStatement || ""));
ok("...which explains what it means", /money received/i.test(cash.basisStatement || ""));
ok("the accrual statement says so", accrual.basis === "accrual");
ok("...in its own sentence", /ACCRUAL basis/.test(accrual.basisStatement || ""));
// The whole reason the choice matters: the numbers are not the same.
ok("cash revenue is what was RECEIVED", near(cash.profitAndLoss.revenue.amount, 1000), cash.profitAndLoss.revenue.amount);
ok("accrual revenue is what was INVOICED", near(accrual.profitAndLoss.revenue.amount, 1700), accrual.profitAndLoss.revenue.amount);
ok("...so the two bases disagree, as they must", cash.profitAndLoss.revenue.amount !== accrual.profitAndLoss.revenue.amount);
// FieldQuo has no supplier-bill ledger, so accrual costs cannot be produced.
// Pairing accrual revenue with cash costs and calling it accrual is the lie
// this warning exists to prevent.
ok("cash carries no mixed-basis warning", cash.mixedBasisWarning === null);
ok("accrual admits its costs are still cash-recorded", /costs are cash/i.test(accrual.mixedBasisWarning || ""));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n2. An amended invoice counts ONCE, at the version that stands\n");
//
// app/api/invoices/[id]/route.js writes a NEW row on every edit of a sent
// invoice. INV-100 is two rows at 1130 and 1356; a naive sum makes March look
// 1130 better than it was, every time anyone ever corrected a line item.

const revenueComponents = accrual.profitAndLoss.revenue.components || [];
ok("accrual revenue counts 2 documents, not the 3 rows dated in March",
  accrual.profitAndLoss.revenue.count === 2, accrual.profitAndLoss.revenue.count);
ok("...INV-100 appears exactly once",
  revenueComponents.filter((c) => /INV-100/.test(c.label)).length === 1);
ok("...at the AMENDED figure, not the original",
  revenueComponents.some((c) => /INV-100/.test(c.label) && near(c.amount, 1200)));
ok("...and it is labelled as the version that stands",
  revenueComponents.some((c) => /INV-100 \(v2 of 2\)/.test(c.label)));
// 1200 + 500 = 1700. Both rows would be 1000 + 1200 + 500 = 2700.
ok("...so the total is 1700, not the 2700 a naive sum produces",
  near(accrual.profitAndLoss.revenue.amount, 1700), accrual.profitAndLoss.revenue.amount);

// The date belongs to the ROOT. INV-300 went out in February and was corrected
// in March; a correction does not re-issue a document.
ok("an invoice amended in March but ISSUED in February is not March revenue",
  !revenueComponents.some((c) => /INV-300/.test(c.label)));
ok("...and its tax is not March's either", near(accrual.salesTax.charged.amount, 221), accrual.salesTax.charged.amount);

// A payment taken against the superseded row still counts — dropping it would
// understate what was received.
ok("a payment recorded against the superseded row is still cash received",
  near(cash.cashFlow.cashIn.amount, 1130), cash.cashFlow.cashIn.amount);
// And it is apportioned in the LATEST version's tax ratio, not the original's.
ok("...and its tax share comes from the version that stands",
  near(cash.profitAndLoss.revenue.amount, 1000), cash.profitAndLoss.revenue.amount);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n3. The loan: principal is cash, interest is cost, and never the reverse\n");
//
// The classic small-business statement error. A 1000 repayment is 1000 out of
// the bank and 120 of expense; booking the whole payment as a cost understates
// profit by 880 a month, and booking none of it overstates it by 120.

const d1 = scheduledDebtService(DEBTS[0], FROM, TO);
ok("one month of the truck loan is 120 interest", near(d1.interest, 120), d1.interest);
ok("...and 880 of principal", near(d1.principal, 880), d1.principal);
ok("...which together are the whole payment", near(d1.cashOut, 1000), d1.cashOut);
ok("...leaving 11120 owed", near(d1.closingBalance, 11120), d1.closingBalance);

const interestLine = cash.profitAndLoss.overhead.loanInterest;
ok("the P&L charges the INTEREST", near(interestLine.amount, 120), interestLine.amount);
ok("...and nothing else — the principal is not in it", !near(interestLine.amount, 1000));
ok("...and the line says principal is excluded, out loud",
  (interestLine.excludes || []).some((s) => /principal/i.test(s) && /not a cost|reduces a liability|cash out/i.test(s)));

const fin = cash.cashFlow.financing;
ok("the cash flow carries the FULL repayment", near(fin.debtService.amount, 1200), fin.debtService.amount);
ok("...broken out so the principal half is visible", near(fin.principalPortion.amount, 880), fin.principalPortion.amount);
ok("...and it names the same interest figure the P&L used", fin.interestPortion === interestLine);
// The identity that proves the split is a split and not two guesses.
ok("interest + principal = the truck loan's cash out",
  near(d1.interest + d1.principal, d1.cashOut));
ok("the financing block is kept OUT of the recorded movement",
  near(cash.cashFlow.netCashMovement.amount, -320), cash.cashFlow.netCashMovement.amount);
ok("...because nothing records that a loan payment was made",
  fin.recorded === false && /records loan TERMS, not loan payments/i.test(fin.statement || ""));

// interestRate defaults to 0 in the schema, so a zero rate cannot be told apart
// from a rate nobody typed. Booking $0 of interest would be inventing a fact.
const d2 = scheduledDebtService(DEBTS[1], FROM, TO);
ok("a loan with no rate on file yields NO interest figure", d2.interest === null, d2.interest);
ok("...and no principal figure either", d2.principal === null);
ok("...but its cash out is still known", near(d2.cashOut, 200), d2.cashOut);
ok("...and the statement names the loan rather than zeroing it",
  cash.warnings.some((w) => w.code === "loan_without_rate" && /Trailer finance/.test(w.message)));
ok("...the interest line reports itself PARTIAL", interestLine.partial === true);
ok("...and the overhead total says it is incomplete because of it",
  cash.profitAndLoss.overhead.total.complete === false &&
    cash.profitAndLoss.overhead.total.missing.some((m) => /Loan interest/.test(m.line)));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n4. Every total reconciles against the lines above it\n");
//
// A reader who adds the column up must get the printed total. These are the
// figures a lender recomputes by hand.

const p = cash.profitAndLoss;
ok("materials are the job-tagged expenses", near(p.costOfWorkDone.materials.amount, 300), p.costOfWorkDone.materials.amount);
ok("direct labour is 10 APPROVED hours at 30", near(p.costOfWorkDone.labour.amount, 300), p.costOfWorkDone.labour.amount);
ok("cost of work done = materials + labour",
  near(p.costOfWorkDone.total.amount, p.costOfWorkDone.materials.amount + p.costOfWorkDone.labour.amount));
ok("gross profit = revenue − cost of work done",
  near(p.grossProfit.amount, p.revenue.amount - p.costOfWorkDone.total.amount), p.grossProfit.amount);
ok("overhead = overhead + other costs + unlogged wages + loan interest",
  near(
    p.overhead.total.amount,
    p.overhead.overheadExpenses.amount + p.overhead.generalExpenses.amount + p.overhead.otherLabour.amount + p.overhead.loanInterest.amount,
  ), p.overhead.total.amount);
ok("net profit = gross profit − overhead",
  near(p.netProfit.amount, p.grossProfit.amount - p.overhead.total.amount), p.netProfit.amount);
ok("...which is −770 on this month", near(p.netProfit.amount, -770), p.netProfit.amount);

// Every subtotal carries its own workings, so "what is in that number" is
// answerable on screen rather than by reading this file.
ok("a subtotal shows what it was added up from", (p.grossProfit.from || []).length === 2);
ok("...with the sign it was applied with",
  p.grossProfit.from.some((f) => f.sign === -1 && /Cost of work done/.test(f.line)));

// Wages and job hours are the same money. Adding a pay run's gross to the hours
// already charged to jobs counts the crew twice.
ok("wages not on a job = gross payroll − labour already charged to jobs",
  near(p.overhead.otherLabour.amount, 600), p.overhead.otherLabour.amount);
ok("...and the line says the subtraction happened",
  (p.overhead.otherLabour.excludes || []).some((s) => /counted twice|already counted/i.test(s)));

// Cash flow reconciles the same way.
const c = cash.cashFlow;
ok("money in is every payment at face value", near(c.cashIn.amount, 1130), c.cashIn.amount);
ok("money out is expenses plus net wages paid", near(c.cashOut.amount, 750 + 700), c.cashOut.amount);
ok("net movement = in − out", near(c.netCashMovement.amount, c.cashIn.amount - c.cashOut.amount));
ok("net after scheduled loan repayments = movement − debt service",
  near(c.netAfterScheduledDebtService.amount, c.netCashMovement.amount - c.financing.debtService.amount));

// The balance sheet's receivable is as at the STATEMENT date, not as at today.
const bs = cash.balanceSheet;
ok("receivables are 1356 − 565 owed on INV-100 plus 1017 on INV-300",
  near(bs.assets.available[0].amount, 791 + 1017), bs.assets.available[0].amount);
ok("...and a fully paid invoice is not in them",
  !(bs.assets.available[0].components || []).some((x) => /INV-200/.test(x.label)));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n5. A period with nothing in it reports ABSENCE, not a column of zeros\n");
//
// AGENTS.md failure class 5. A P&L of zeros looks like a filed statement saying
// the business did nothing; "we have no records for these dates" is a different
// claim and the only true one.

const quiet = buildFinancialStatements(base({ from: "2027-01-01", to: "2027-01-31" }));
ok("an empty period is flagged as empty", quiet.empty === true);
ok("...with a sentence that says records are absent, not activity",
  /absence of records, not a period of zero activity/i.test(quiet.emptyStatement || ""));
ok("...naming the dates it looked at", /2027-01-01/.test(quiet.emptyStatement || ""));
ok("the busy month is NOT flagged empty", cash.empty === false);
ok("...and says nothing about absence", cash.emptyStatement === null);

// One line with nothing behind it is a different thing again: it is worth zero
// and must not render as "$0.00".
const noJobs = buildFinancialStatements(base({ expenses: EXPENSES.filter((e) => !e.projectId) }));
ok("a line with no rows behind it is `stated: false`", noJobs.profitAndLoss.costOfWorkDone.materials.stated === false);
ok("...and it is still available — nothing recorded IS an answer",
  noJobs.profitAndLoss.costOfWorkDone.materials.available === true);
ok("...contributing an honest 0 to its subtotal",
  near(noJobs.profitAndLoss.costOfWorkDone.total.amount, 300));
ok("...without making the subtotal incomplete", noJobs.profitAndLoss.costOfWorkDone.total.complete === true);

// A genuinely unknown line is the third case: it contributes NOTHING and it
// poisons every total that contains it.
ok("cash at bank is unavailable, not zero", cash.cashFlow.openingBalance.available === false);
ok("...with amount null, so nothing can add it up", cash.cashFlow.openingBalance.amount === null);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n6. The sales-tax summary refuses to look like a filed return\n");
//
// This is the figure a contractor needs at filing time and it is emphatically
// not a filing: nothing nets input tax credits, nothing is remitted, and one
// tax amount per invoice cannot be split into GST and QST.

const tax = cash.salesTax;
ok("it says out loud that it is not a return", tax.isFiling === false);
ok("...in words, at the top of the limitations",
  /not a tax return/i.test(tax.limitations[0] || ""));
ok("...and that nothing has been remitted", tax.limitations.some((l) => /remitted/i.test(l)));
ok("...and that input tax credits are NOT netted off",
  tax.limitations.some((l) => /input tax credit/i.test(l)));
ok("...and that a two-rate jurisdiction cannot be split out",
  tax.limitations.some((l) => /single amount per invoice/i.test(l)));
ok("tax charged is the latest version's tax, once per document", near(tax.charged.amount, 221), tax.charged.amount);
ok("tax inside money actually received is a different number", near(tax.collected.amount, 130), tax.collected.amount);
ok("...and they are not confused with each other", tax.charged.amount !== tax.collected.amount);
// lib/tax/documentTax.js already decides what a tax line MEANS. Reusing it is
// what lets this report count a hole as a hole rather than as a zero.
ok("every invoice's tax line is classified, not just summed",
  (tax.documentTaxStatements.charged || 0) === 2, tax.documentTaxStatements);

// An invoice saying tax applies and charging none is a hole to go and look at.
const holed = buildFinancialStatements(base({
  invoices: [{ ...INVOICES[2], tax: 0, total: 500, taxEnabled: true, client: { id: "c9", name: "Nobody" } }],
  payments: [], company: { ...COMPANY, taxRate: 0, country: null, province: null },
}));
ok("an unresolved tax line is counted as unresolved, not as zero tax",
  (holed.salesTax.documentTaxStatements.unresolved || 0) === 1, holed.salesTax.documentTaxStatements);
ok("...and named in the warnings", holed.warnings.some((w) => w.code === "tax_unresolved"));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n7. What cannot be produced says so, by name, instead of printing zeros\n");
//
// A balance sheet showing $0 of fixed assets because nobody was ever asked is a
// worse document than one that names the half it can produce. This is the
// single most likely way a task like this goes wrong.

ok("the balance sheet admits it does not balance", bs.balances === false);
ok("...in its own sentence, before any figure",
  /PARTIAL balance sheet and it does not balance/i.test(bs.balanceStatement || ""));
ok("total assets are unavailable, not a sum of what happens to be there", bs.assets.total.available === false);
ok("total liabilities likewise", bs.liabilities.total.available === false);
ok("equity likewise", bs.equity.total.available === false);
ok("...and equity explains that it needs both sides",
  bs.equity.unavailable[0].reason === "requires_complete_sides");

const unavailableLabels = [...bs.assets.unavailable, ...bs.liabilities.unavailable].map((f) => f.label);
ok("cash at bank is named as missing", unavailableLabels.some((l) => /Cash at bank/i.test(l)));
ok("fixed assets are named as missing", unavailableLabels.some((l) => /Fixed assets/i.test(l)));
ok("supplier bills are named as missing", unavailableLabels.some((l) => /owe suppliers/i.test(l)));
ok("every one of them has amount null", [...bs.assets.unavailable, ...bs.liabilities.unavailable].every((f) => f.amount === null));
// Worded as a limit of THIS report, never as a claim about the product: an
// asset register and a bill ledger are being built alongside this, and a
// sentence saying "FieldQuo does not record assets" becomes a lie the day one
// lands. A report that lies about the product is worse than one that admits its
// own scope.
ok("...and they describe this REPORT's scope, not the product's",
  [...bs.assets.unavailable, ...bs.liabilities.unavailable]
    .flatMap((f) => f.excludes || [])
    .every((s) => !/does not (record|hold) (vehicles|assets|supplier)/i.test(s)));
ok("...saying plainly that they are not read here",
  bs.assets.unavailable.some((f) => (f.excludes || []).some((s) => /not read by this statement/i.test(s))));

// Payroll is a separate permission dial. Without it the line is a stated
// absence — an overhead figure quietly missing the wage bill reads as a
// profitable month.
const noPay = buildFinancialStatements(base({ payrollVisible: false, payRuns: [] }));
ok("a reader without payroll access gets an ABSENT wage line",
  noPay.profitAndLoss.overhead.otherLabour.available === false);
ok("...with the reason on it", noPay.profitAndLoss.overhead.otherLabour.reason === "payroll_restricted");
ok("...and the overhead total reports itself incomplete",
  noPay.profitAndLoss.overhead.total.complete === false);
ok("...naming the line that is missing",
  noPay.profitAndLoss.overhead.total.missing.some((m) => m.reason === "payroll_restricted"));
ok("...and the incompleteness reaches net profit",
  noPay.profitAndLoss.netProfit.complete === false);
ok("...while the number itself is NOT inflated by treating the unknown as 0",
  near(noPay.profitAndLoss.overhead.total.amount, 570), noPay.profitAndLoss.overhead.total.amount);
ok("...and wages paid drops out of cash flow too", noPay.cashFlow.cashOut.complete === false);

// Every figure is traceable. An accountant asking "what is in that number" has
// to be answerable without reading the source.
const everyFigure = [];
(function walk(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach(walk);
  if (typeof node.label === "string" && "available" in node) everyFigure.push(node);
  Object.values(node).forEach(walk);
})(cash);
ok("every figure on the payload carries a label", everyFigure.length > 20 && everyFigure.every((f) => f.label));
ok("...and every unavailable one carries a reason",
  everyFigure.filter((f) => !f.available).every((f) => typeof f.reason === "string" && f.reason.length > 0));
ok("...and the headline lines say what they include and exclude",
  (p.revenue.includes.length > 0 && p.revenue.excludes.length > 0));
ok("...including that tax is not revenue",
  p.revenue.excludes.some((s) => /Sales tax/i.test(s) && /held on the authority/i.test(s)));

// Things that make the numbers short are surfaced rather than swallowed.
ok("pending hours are reported, not costed", cash.warnings.some((w) => w.code === "hours_awaiting_approval"));
ok("unrated hours are reported, not costed at zero", cash.warnings.some((w) => w.code === "unrated_hours"));
ok("recurring overhead being a template, not a monthly row, is stated",
  cash.warnings.some((w) => w.code === "recurring_overhead_is_a_template"));

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n8. Hostile input produces a refusal or a fact — never NaN\n");
//
// A statement is read as authoritative. A NaN, an Infinity or an impossible
// negative in one is worse than an error page, because somebody would act on it.

const throws = (fn) => {
  try {
    fn();
    return null;
  } catch (err) {
    return err;
  }
};

const backwards = throws(() => buildFinancialStatements(base({ from: "2026-03-31", to: "2026-03-01" })));
ok("an inverted range throws rather than returning three empty statements", backwards !== null);
ok("...as a 400, because it is a caller mistake", backwards?.status === 400);
ok("...saying which way round it was", /runs backwards/i.test(backwards?.message || ""));

ok("a junk date throws", throws(() => buildFinancialStatements(base({ from: "banana" }))) !== null);
ok("a missing currency throws rather than assuming CAD",
  /never assumed/i.test(throws(() => buildFinancialStatements(base({ currency: undefined })))?.message || ""));
ok("an unknown basis throws", throws(() => buildFinancialStatements(base({ basis: "hybrid" }))) !== null);

const absurd = throws(() => buildFinancialStatements(base({ from: "1900-01-01", to: "2099-12-31" })));
ok("an absurd range is refused rather than walked one month at a time", absurd !== null);
ok(`...naming the ${MAX_RANGE_DAYS}-day cap`, new RegExp(String(MAX_RANGE_DAYS)).test(absurd?.message || ""));

const future = buildFinancialStatements(base({ from: "2099-01-01", to: "2099-01-31" }));
ok("a range entirely in the future is empty, not an error", future.empty === true);
ok("...and its receivables reflect everything issued by then, not a negative",
  future.balanceSheet.assets.available[0].amount >= 0);

// Overflow, junk and a negative payment, all at once.
const nasty = buildFinancialStatements(base({
  payments: [
    { id: "x1", invoiceId: "i3", amount: 1e308, date: "2026-03-02T00:00:00Z", method: "cash" },
    { id: "x2", invoiceId: "i3", amount: -50, date: "2026-03-03T00:00:00Z", method: "cash" },
    { id: "x3", invoiceId: "nope", amount: "not a number", date: "2026-03-04T00:00:00Z", method: null },
  ],
  expenses: [{ id: "x4", category: null, amount: undefined, date: "2026-03-05T00:00:00Z", isOverhead: false, projectId: null }],
  debts: [{ id: "x5", name: "Bad terms", principal: 1000, interestRate: 5, monthlyPayment: 1, startDate: "2020-01-01T00:00:00Z" }],
}));

const numbers = [];
(function collect(node) {
  if (node === null || node === undefined) return;
  if (typeof node === "number") return numbers.push(node);
  if (typeof node !== "object") return;
  Object.values(node).forEach(collect);
})(nasty);
ok(`no NaN anywhere in ${numbers.length} numbers`, numbers.every((n) => !Number.isNaN(n)));
ok("no Infinity either", numbers.every((n) => Number.isFinite(n)));
ok("a negative payment is reported, not silently netted away",
  nasty.warnings.some((w) => w.code === "negative_payment"));
ok("a payment naming an invoice we do not hold is reported",
  nasty.warnings.some((w) => w.code === "unmatched_receipt"));
ok("a loan whose payment cannot cover its interest is reported, not smoothed over",
  nasty.warnings.some((w) => w.code === "negative_amortisation"));
// The one impossible-negative worth naming: a loan balance below zero would
// mean the schedule repaid more than was borrowed.
ok("no loan balance goes below zero",
  scheduledDebtService({ principal: 100, interestRate: 1, monthlyPayment: 1000, startDate: "2020-01-01" }, FROM, TO).closingBalance >= 0);
ok("...and a loan that starts after the period is due nothing in it",
  scheduledDebtService({ principal: 100, interestRate: 5, monthlyPayment: 10, startDate: "2030-01-01" }, FROM, TO).months === 0);

// ═══════════════════════════════════════════════════════════════════════════
console.log("\n9. The gate, EXECUTED — a crew member cannot read the company's P&L\n");
//
// Hiding a menu row is not access control (AGENTS.md). The real GET handler is
// imported with the database, the session and next/server stubbed, and every
// shipped preset is pushed through it.

globalThis.__FQ_ROWS = {
  member: [],
  company: [{ id: "co1", name: "Acme", currency: CURRENCY, country: "CA", province: "ON", vatRegistered: null, taxRate: 0 }],
  taxRate: [],
  invoice: INVOICES,
  payment: PAYMENTS,
  expense: EXPENSES,
  timeEntry: TIME_ENTRIES,
  payRun: PAY_RUNS,
  debt: DEBTS,
};

// Deliberately ignores `where`. Filtering is section 1–8's job and is proven
// there against the pure builder; what this half proves is who gets an answer
// at all. A model nobody scripted THROWS by name rather than answering
// "nothing" — a check must never pass because a query it did not model came
// back empty.
function stubModel(name) {
  const all = () => {
    const rows = globalThis.__FQ_ROWS[name];
    if (!rows) throw new Error(`dbStub: db.${name} is not scripted in this check`);
    return rows;
  };
  return {
    async findMany() {
      return all();
    },
    async findUnique({ where } = {}) {
      return all().find((r) => !where?.id || r.id === where.id) || null;
    },
    async findFirst({ where } = {}) {
      return all().find((r) => !where?.id || r.id === where.id) || null;
    },
  };
}

globalThis.__FQ_DB = new Proxy(
  {},
  {
    get(_t, prop) {
      if (typeof prop !== "string") return undefined;
      if (!(prop in globalThis.__FQ_ROWS)) {
        throw new Error(`dbStub: db.${prop} is not scripted in this check`);
      }
      return stubModel(prop);
    },
  },
);
globalThis.__FQ_MEMBER = async () => globalThis.__FQ_SESSION;

const HOOKS = `
const STUBS = {
  "@/lib/db": "fq-stub:db",
  "@/lib/currentMember": "fq-stub:member",
  "next/server": "fq-stub:next",
};
export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) return { url: STUBS[specifier], shortCircuit: true };
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (url === "fq-stub:db") {
    return { format: "module", shortCircuit: true,
      source: "export const db = new Proxy({}, { get: (_t, p) => globalThis.__FQ_DB[p] });" };
  }
  if (url === "fq-stub:member") {
    return { format: "module", shortCircuit: true,
      source: "export const getCurrentMember = (...a) => globalThis.__FQ_MEMBER(...a);" };
  }
  if (url === "fq-stub:next") {
    return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => ({ body, status: init?.status ?? 200 }) };" };
  }
  return nextLoad(url, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(HOOKS)}`);

const statementsRoute = await import("@/app/api/analytics/statements/route.js");

const REQUEST = (qs = `from=${FROM}&to=${TO}&basis=cash`) => ({
  url: `https://example.test/api/analytics/statements?${qs}`,
});

async function callAs(preset, { over = {}, role = null } = {}) {
  const memberId = `m_${preset}`;
  const row = {
    id: memberId,
    userId: `u_${preset}`,
    companyId: "co1",
    role: role || (preset === "owner" || preset === "admin" ? preset : PRESET_TO_ROLE[preset]),
    permissions: PERMISSION_PRESETS[preset] ? { ...PERMISSION_PRESETS[preset].values, ...over } : null,
  };
  globalThis.__FQ_ROWS.member = [row];
  globalThis.__FQ_SESSION = { id: memberId, userId: row.userId, companyId: "co1", role: row.role };
  return { res: await statementsRoute.GET(REQUEST()), member: row };
}

const crew = await callAs("worker");
ok("Crew is REFUSED the financial statements", crew.res.status === 403, crew.res.status);
// The refusal must not be a map of the permission model handed to the person
// probing it — costBasis.js makes the same argument about the same audience.
ok("...without naming which dial they are missing",
  !/jobCosting|showPricing|user:manage/.test(JSON.stringify(crew.res.body)));
ok("...and without any figure riding along on the refusal",
  crew.res.body?.profitAndLoss === undefined && crew.res.body?.cashFlow === undefined);

for (const preset of ["estimator", "dispatcher"]) {
  const r = await callAs(preset);
  ok(`${PERMISSION_PRESETS[preset].label} is refused too (jobCosting is off)`, r.res.status === 403, r.res.status);
}

const manager = await callAs("manager");
ok("Manager is allowed — jobCosting, showPricing, all expenses and user:manage", manager.res.status === 200, manager.res.body);
ok("...but WITHOUT payroll, which is its own dial", manager.res.body?.payrollVisible === false);
ok("...so the wage line is a stated absence, not a zero",
  manager.res.body?.profitAndLoss.overhead.otherLabour.available === false);
ok("...and the overhead total says so", manager.res.body?.profitAndLoss.overhead.total.complete === false);

const owner = await callAs("owner");
ok("an owner gets the statements", owner.res.status === 200, owner.res.status);
ok("...with payroll", owner.res.body?.payrollVisible === true);
ok("...and the basis on the payload", owner.res.body?.basis === "cash");

// The invariant that keeps this gate honest as the grid grows: it must never be
// weaker than the cost-basis rule the rest of the app already applies.
for (const preset of Object.keys(PERMISSION_PRESETS)) {
  const member = { role: PRESET_TO_ROLE[preset], permissions: PERMISSION_PRESETS[preset].values };
  const r = await callAs(preset);
  const allowed = r.res.status === 200;
  if (allowed) {
    ok(`${PERMISSION_PRESETS[preset].label}: allowed here ⇒ allowed the cost basis`,
      canReadCostBasis(member, "fixedCosts") === true);
  } else {
    ok(`${PERMISSION_PRESETS[preset].label}: refused here`, r.res.status === 403, r.res.status);
  }
}

// ── Each half of the gate refuses ON ITS OWN ───────────────────────────────
//
// Manager is the only shipped preset that gets in, and it holds all four
// requirements at once — so no preset can tell whether any single one of them
// is doing any work. That is exactly how a gate rots: three of its four clauses
// get deleted over a year and nothing anywhere goes red, because the fourth
// still refuses everyone who was ever tested. Manager's own grid, with one dial
// moved, is the only thing that isolates them.
//
// The audience is real, not hypothetical: costBasis.js exists because a
// Dispatcher — showPricing true, jobCosting FALSE — read the cost per job, the
// target margin and the truck loan off five endpoints that had never heard of
// the toggle.
const MANAGER_MINUS = [
  ["jobCosting", { over: { jobCosting: false } }, "no margin, no cost basis, anywhere"],
  ["showPricing", { over: { showPricing: false } }, "a revenue statement with the revenue removed is not a smaller statement"],
  ["company-wide expenses", { over: { expenses: "view_record_edit_own" } }, "a P&L is every expense row in the business"],
  ["user:manage", { role: "employee" }, "the company's commitments are not an individual's business"],
];
for (const [dial, patch, why] of MANAGER_MINUS) {
  const r = await callAs("manager", patch);
  ok(`Manager without ${dial} is refused — ${why}`, r.res.status === 403, r.res.status);
}
// And the control: the same grid, untouched, still gets in. Without this the
// four assertions above would pass just as well on a gate that refuses
// everybody.
ok("...while Manager with all four still gets in", (await callAs("manager")).res.status === 200);

// A hand-written request cannot get past the gate by lying about the range.
const badRange = await (async () => {
  globalThis.__FQ_ROWS.member = [{ id: "m_x", userId: "u_x", companyId: "co1", role: "employee", permissions: PERMISSION_PRESETS.worker.values }];
  globalThis.__FQ_SESSION = { id: "m_x", userId: "u_x", companyId: "co1", role: "employee" };
  return statementsRoute.GET(REQUEST("from=2026-03-31&to=2026-03-01"));
})();
ok("a refused caller is refused BEFORE the range is even parsed", badRange.status === 403, badRange.status);

globalThis.__FQ_ROWS.member = [{ id: "m_o", userId: "u_o", companyId: "co1", role: "owner", permissions: null }];
globalThis.__FQ_SESSION = { id: "m_o", userId: "u_o", companyId: "co1", role: "owner" };
ok("an owner asking for a backwards range gets a 400, not empty statements",
  (await statementsRoute.GET(REQUEST("from=2026-03-31&to=2026-03-01"))).status === 400);
ok("...and a junk date is a 400 too",
  (await statementsRoute.GET(REQUEST("from=banana&to=2026-03-01"))).status === 400);
ok("...and an unknown basis is a 400",
  (await statementsRoute.GET(REQUEST(`from=${FROM}&to=${TO}&basis=hybrid`))).status === 400);

// ═══════════════════════════════════════════════════════════════════════════
// The mutation runner re-invokes THIS file with --no-mutate. Without that flag
// it would mutate the module from inside a mutated run, forever.
const MUTATING = !process.argv.includes("--no-mutate");
if (!MUTATING) {
  console.log(
    fails.length
      ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
      : `\nPASSED — ${pass}/${pass} assertions`,
  );
  process.exit(fails.length ? 1 : 0);
}

console.log("\n10. Mutation pass — every guarantee above must actually be load-bearing\n");

const LIB = fileURLToPath(new URL("../lib/accounting/statements.js", import.meta.url));
const ROUTE = fileURLToPath(new URL("../app/api/analytics/statements/route.js", import.meta.url));
const SELF = fileURLToPath(import.meta.url);
const LOADER = fileURLToPath(new URL("./alias-loader.mjs", import.meta.url));

// cp, never git checkout: this tree has uncommitted work in it and `git
// restore` would hand back the last commit rather than what is on disk.
const backupDir = mkdtempSync(join(tmpdir(), "statements-"));
const ORIGINAL = { [LIB]: readFileSync(LIB, "utf8"), [ROUTE]: readFileSync(ROUTE, "utf8") };
for (const [file, src] of Object.entries(ORIGINAL)) {
  writeFileSync(join(backupDir, file.split("/").pop() + ".bak"), src);
}

const MUTATIONS = [
  [LIB, "counts an amended invoice twice", (s) =>
    s.replace("const families = invoiceFamilies(invoices);",
      "const families = invoices.map((inv) => ({ rootId: inv.id, members: [inv], root: inv.parentInvoiceId ? null : inv, latest: inv, versionCount: 1 }));")],
  [LIB, "dates an amendment from the amendment", (s) =>
    s.replace("const source = fam.root || fam.members[0];", "const source = fam.latest;")],
  [LIB, "charges the whole loan payment to profit", (s) =>
    s.replace("const interestTotal = ratedSchedules.reduce((s, x) => s + num(x.schedule.interest), 0);",
      "const interestTotal = ratedSchedules.reduce((s, x) => s + num(x.schedule.cashOut), 0);")],
  [LIB, "drops the principal out of cash flow", (s) =>
    s.replace("const debtCashOut = dueSchedules.reduce((s, x) => s + num(x.schedule.cashOut), 0);",
      "const debtCashOut = dueSchedules.reduce((s, x) => s + num(x.schedule.interest), 0);")],
  [LIB, "books a rate-less loan as zero interest", (s) =>
    s.replace("      interest: null,\n      principal: null,\n      closingBalance: null,",
      "      interest: 0,\n      principal: 0,\n      closingBalance: principal0,")],
  [LIB, "treats an unavailable line as zero in a subtotal", (s) =>
    s.replace("      missing.push({ line: f.label, reason: f.reason });\n      continue;", "      continue;")],
  [LIB, "hides that a partial figure is short", (s) =>
    s.replace('    if (f.partial) missing.push({ line: f.label, reason: f.reason || "partial", partial: true });', "")],
  [LIB, "reports an empty period as a column of zeros", (s) =>
    s.replace("  const empty =\n    paymentsIn.length === 0 &&", "  const empty = false && (\n    paymentsIn.length === 0 &&")],
  [LIB, "calls the sales-tax summary a return", (s) =>
    s.replace('"This is what you CHARGED, not a tax return.', '"This is your filed return.')],
  [LIB, "claims the tax summary IS a filing", (s) => s.replace("    isFiling: false,", "    isFiling: true,")],
  [LIB, "accepts a backwards range", (s) =>
    s.replace(/if \(fromKey > toKey\) \{[\s\S]*?\n  \}/, "")],
  [LIB, "accepts an absurd range", (s) =>
    s.replace(/if \(spanDays > MAX_RANGE_DAYS\) \{[\s\S]*?\n  \}/, "")],
  [LIB, "defaults the currency to CAD", (s) =>
    s.replace(/if \(!currency \|\| typeof currency !== "string"\) \{[\s\S]*?\n  \}/, 'currency = currency || "CAD";')],
  [LIB, "makes the period exclusive of its last day", (s) =>
    s.replace("const inRange = (key, from, to) => key !== null && key >= from && key <= to;",
      "const inRange = (key, from, to) => key !== null && key >= from && key < to;")],
  [LIB, "costs hours that nobody has approved", (s) =>
    s.replace('    if (e?.status !== "approved") {', "    if (false) {")],
  [LIB, "prices an unrated worker at zero, silently", (s) =>
    s.replace("      unratedHours += hours;\n      directHours += hours;\n      continue;", "      directHours += hours;\n      continue;")],
  [LIB, "counts the crew twice — payroll AND job hours", (s) =>
    s.replace("const otherLabourAmount = payrollGross - directLabour;", "const otherLabourAmount = payrollGross;")],
  [LIB, "treats a payroll-restricted line as zero", (s) =>
    s.replace("  if (!payrollVisible) {\n    otherLabour = absent(", "  if (false) {\n    otherLabour = absent(")],
  [LIB, "counts tax as revenue", (s) =>
    s.replace("    receiptsTax += amount * taxShare;\n    receiptsExTax += amount * (1 - taxShare);", "    receiptsExTax += amount;")],
  [LIB, "prints a balance sheet that claims to balance", (s) => s.replace("    balances: false,", "    balances: true,")],
  [ROUTE, "drops the jobCosting half of the gate", (s) =>
    s.replace('if (!hasToggle(full, "jobCosting")) missing.push("jobCosting");', "")],
  [ROUTE, "drops the user:manage half of the gate", (s) =>
    s.replace('if (!full || !can(full.role, "user:manage")) missing.push("user:manage");', "")],
  [ROUTE, "hands payroll to anyone who can read the statements", (s) =>
    s.replace("const payrollVisible = canSeeAllPay(full);", "const payrollVisible = true;")],
  [ROUTE, "names the missing dial in the refusal", (s) =>
    s.replace(
      '"You don\'t have access to the company\'s financial statements — revenue, costs, margin and what the business owes. Ask an owner or admin.",',
      '`You are missing: ${missing.join(", ")}.`,')],
];

let caught = 0;
const escaped = [];
try {
  for (const [file, label, mutate] of MUTATIONS) {
    const original = ORIGINAL[file];
    const mutated = mutate(original);
    if (mutated === original) {
      escaped.push(`${label} — the mutation did not apply (the source moved under it)`);
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
    if (survived) escaped.push(`${label} — NOT caught`);
    else {
      caught++;
      console.log(`  ✓ caught: ${label}`);
    }
  }
} finally {
  // Restore from the in-memory copies unconditionally, even if a mutation threw.
  for (const [file, src] of Object.entries(ORIGINAL)) writeFileSync(file, src);
  rmSync(backupDir, { recursive: true, force: true });
}
ok(`all ${MUTATIONS.length} mutants caught`, escaped.length === 0, escaped.join(" | "));
pass += caught;

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
