// lib/accounting/statements.js
//
// A profit and loss, a cash flow, a sales-tax summary and as much of a balance
// sheet as the data honestly supports — arranged the way an accountant or a
// lender reads them.
//
// ══ This is a FORMAT, not a new accounting system ═══════════════════════════
//
// FieldQuo already records every business event a small contractor generates:
// invoices, payments, expenses, timesheets, pay runs, loans. What it has never
// done is arrange them into the four statements a bookkeeper, a lender or a
// broker asks for. Nothing here writes anything, computes a new kind of cost,
// or replaces lib/costing — it groups rows that already exist and states, on
// every figure, what is inside it and what is not.
//
// Pure. No `@/lib/db`, no route, no React: every row is passed in, so
// scripts/check-statements.mjs can EXECUTE the arithmetic against a scripted
// dataset instead of reading it. That is how the real bugs in this repo get
// found (AGENTS.md, "How to verify").
//
// ══ The accounting basis, chosen and stated ═════════════════════════════════
//
// Cash and accrual produce different numbers and the first question any
// accountant asks is which one they are holding. Both are offered, the caller
// picks, and the choice is carried on the payload as `basis` plus a sentence
// (`basisStatement`) that the screen and the PDF are expected to print. A
// statement that silently mixes bases is worse than no statement at all.
//
//   cash     (the default) — revenue is money RECEIVED, cost is money SPENT.
//                            Every figure is backed by a Payment or an Expense
//                            row that actually happened. It is also the basis
//                            most owner-operators file on.
//
//   accrual  — revenue is what was INVOICED in the period, at the latest
//              version of each invoice.
//
// ── Why cash is the default, and why accrual carries a caveat ───────────────
//
// Accrual needs an issue DATE and an accounts-payable ledger. FieldQuo has
// neither: there is no invoice issue-date column (see the header of
// lib/export/accountingExport.js — the date is `sentAt`, else `createdAt`, and
// each figure says which), and there is no bill/vendor-invoice model at all, so
// the COST side of an accrual statement cannot be produced. Rather than pair
// accrual revenue with cash costs and call the result accrual — a mixed basis
// wearing one basis's name — the accrual view states on its face that its costs
// remain cash-recorded. `mixedBasisWarning` is non-null exactly when that is
// true, and the screen must render it beside the totals.
//
// ══ Absence is never a zero ════════════════════════════════════════════════
//
// AGENTS.md failure class 5. Three different things are deliberately not the
// same value here:
//
//   figure()          a real number, with the rows behind it
//   nothingRecorded() nothing of this kind exists in the period. Contributes 0
//                     to a subtotal — because "no expenses were entered" really
//                     does subtract nothing — but renders as "none recorded",
//                     never as "$0.00".
//   absent()          we cannot answer. amount is null, it contributes NOTHING
//                     to any subtotal, and every subtotal it touches comes back
//                     `complete: false` naming it. A total that quietly treats
//                     an unknown as zero is the single way this file could
//                     produce a plausible lie.
//
// ══ Amended invoices ═══════════════════════════════════════════════════════
//
// app/api/invoices/[id]/route.js does not update a sent invoice; it writes a
// NEW row with the same invoiceNumber, `parentInvoiceId` on the root and
// `version` incremented. A naive sum counts invoice 1042 twice at two different
// totals. `invoiceFamilies` from lib/export/accountingExport.js already solves
// this and is imported rather than re-derived — the copy is the one that rots.
// One row per family, at the LATEST version's money, dated from the ROOT.
//
// ══ The loan split, which is the classic small-business error ══════════════
//
// A loan repayment is cash OUT in full. Only the INTEREST is a profit-and-loss
// expense — the principal is a reduction of a liability and never touches the
// P&L. Getting this backwards overstates costs and understates profit by the
// principal, every month. So the two statements read the same schedule and take
// different halves of it, and `scheduledDebtService` returns them separately so
// neither can borrow the other's number.
//
// FieldQuo records no loan PAYMENT events — Debt holds terms (principal, rate,
// monthlyPayment, startDate) and nothing else. So this is a schedule derived
// from the terms on file, not a record of money leaving the account, and it is
// reported in its own block saying exactly that. `interestRate` defaults to 0
// in the schema, which means a zero rate cannot be told apart from a rate
// nobody typed — same trap as `taxRate: 0` in lib/tax/documentTax.js — so a
// zero-rate loan yields `interest: null` and the P&L says which loan is missing
// a rate, rather than booking $0 of interest as a fact.

// Deliberately NOT lib/invoices/lifecycle's invoiceMoney: it reads
// `amountPaid`, which is the running total as of NOW. A balance sheet dated
// last March must not change next week because a client paid yesterday, so the
// receivable below is computed from the payment rows dated on or before the
// statement date instead.
import { dayKey, invoiceFamilies } from "@/lib/export/accountingExport";
import { taxStatement } from "@/lib/tax/documentTax";

// ── Numbers ────────────────────────────────────────────────────────────────

/** Prisma Decimal | string | null → a finite number, or 0. */
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Round to cents, finite-safe in BOTH directions.
 *
 * `Math.round(1e308 * 100)` is Infinity, and an Infinity in a subtotal
 * propagates silently into every figure downstream. Same guard as
 * lib/costing/actualJobCost.js, for the same reason.
 */
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

// ── Figures ────────────────────────────────────────────────────────────────
//
// Every money value on the payload is one of these three shapes, so a screen
// never has to guess whether `0` means "nothing happened" or "we don't know".
// `includes`/`excludes` are the answer to "what is in that number", which is
// the first thing an accountant asks and the first thing a contractor
// disagrees with.

function figure(label, amount, { count = null, components = null, includes = [], excludes = [] } = {}) {
  return {
    label,
    amount: round2(amount),
    available: true,
    stated: true,
    count,
    reason: null,
    components: components ? components.map((c) => ({ ...c, amount: round2(c.amount) })) : null,
    includes,
    excludes,
  };
}

/** Nothing of this kind exists in the period. A fact, and worth 0. */
function nothingRecorded(label, { includes = [], excludes = [] } = {}) {
  return {
    label,
    amount: 0,
    available: true,
    stated: false,
    count: 0,
    reason: null,
    components: null,
    includes,
    excludes,
  };
}

/** We cannot answer. Contributes to no total and poisons every one it is in. */
function absent(label, reason, { includes = [], excludes = [] } = {}) {
  return {
    label,
    amount: null,
    available: false,
    stated: false,
    count: null,
    reason,
    components: null,
    includes,
    excludes,
  };
}

/**
 * Add figures up.
 *
 * An `absent` part is NOT treated as zero: it is skipped and named in
 * `missing`, and the subtotal reports `complete: false`. A `nothingRecorded`
 * part contributes its honest 0 and does not make the total incomplete.
 *
 * `sign` lets a subtotal subtract — gross profit is revenue minus cost — while
 * keeping one implementation of the absent rule. Two implementations is how
 * one of them ends up adding an unknown as zero.
 */
function subtotal(label, parts, { includes = [], excludes = [] } = {}) {
  let amount = 0;
  const missing = [];
  const from = [];
  for (const { figure: f, sign = 1 } of parts) {
    if (!f) continue;
    if (!f.available) {
      missing.push({ line: f.label, reason: f.reason });
      continue;
    }
    // A PARTIAL figure — a real number that is knowably short, such as interest
    // on three loans when one of them has no rate on file — contributes what it
    // has AND makes the subtotal say it is incomplete. Left out of `missing`,
    // the omission would be invisible: the total looks whole because there is a
    // number on every line above it.
    if (f.partial) missing.push({ line: f.label, reason: f.reason || "partial", partial: true });
    // A subtotal built on an incomplete subtotal is itself incomplete, and the
    // reasons travel with it. Without this, net profit reads as whole because
    // overhead — the line that is actually short — sits between them and
    // absorbs the admission. The reader of a P&L looks at the last line.
    if (f.complete === false) {
      for (const m of f.missing || []) {
        if (!missing.some((x) => x.line === m.line)) missing.push({ ...m, via: f.label });
      }
    }
    amount += sign * num(f.amount);
    from.push({ line: f.label, sign, amount: round2(f.amount) });
  }
  return {
    label,
    amount: round2(amount),
    available: true,
    stated: true,
    complete: missing.length === 0,
    missing,
    from,
    includes,
    excludes,
  };
}

// ── Dates ──────────────────────────────────────────────────────────────────
//
// Range membership is decided on UTC calendar days, exactly as
// lib/export/accountingExport.js does it, and for the same stated reason: "the
// month of January" is a calendar question, and there is no company timezone
// available to a pure module. Two reports of the same month that disagreed by
// one evening's invoices would be worse than one documented rule.

const inRange = (key, from, to) => key !== null && key >= from && key <= to;

/**
 * Ten years. A P&L nobody would file, and a real guard: the loan amortisation
 * below walks one month at a time, so an unbounded range is an unbounded loop
 * with a growing balance in it. A caller that means it can ask for ten one-year
 * statements.
 */
export const MAX_RANGE_DAYS = 3660;

const DAY_MS = 86400000;

function rangeError(message) {
  const err = new Error(message);
  err.status = 400;
  err.code = "bad_range";
  return err;
}

/** Whole calendar months from one YYYY-MM-DD to another, first inclusive. */
function monthIndex(key) {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

// ── The loan schedule ──────────────────────────────────────────────────────

/**
 * What one loan's terms say is due between two dates, and how it splits.
 *
 * Returns `{ months, cashOut, interest, principal, closingBalance, reason }`
 * with `interest`/`principal`/`closingBalance` NULL when no interest rate is
 * recorded. That is the important case: `Debt.interestRate` defaults to 0, so a
 * genuinely interest-free loan and a loan nobody finished entering are the same
 * row. Booking $0 of interest into the P&L would be inventing a fact from a
 * default — the exact failure lib/tax/documentTax.js exists to avoid on tax
 * rates — so the split is refused and the loan is named instead.
 *
 * `cashOut` survives that, because it does not depend on the rate: the monthly
 * payment is what leaves the bank whichever way the split falls.
 *
 * Negative amortisation (a payment smaller than the month's interest) is not
 * special-cased. The arithmetic is already right — the balance grows — and it
 * is flagged, because a loan going backwards is something the owner should be
 * told rather than something a report should smooth over.
 */
export function scheduledDebtService(debt, fromKey, toKey) {
  const startKey = dayKey(debt?.startDate);
  const payment = num(debt?.monthlyPayment);
  const principal0 = num(debt?.principal);
  const annualRate = num(debt?.interestRate);
  const name = debt?.name || "Unnamed loan";

  // A loan that starts after the period is not due anything in it.
  const firstKey = startKey && startKey > fromKey ? startKey : fromKey;
  if (startKey && startKey > toKey) {
    return { name, months: 0, cashOut: 0, interest: 0, principal: 0, closingBalance: principal0, reason: null, negativeAmortisation: false };
  }

  const months = Math.max(0, monthIndex(toKey) - monthIndex(firstKey) + 1);

  if (!annualRate) {
    return {
      name,
      months,
      cashOut: round2(months * payment),
      interest: null,
      principal: null,
      closingBalance: null,
      // Named so the statement can print it. "No rate on file" is actionable;
      // "$0.00 interest" is a number the owner would believe.
      reason: "no_interest_rate",
      negativeAmortisation: false,
    };
  }

  const monthlyRate = annualRate / 100 / 12;
  // Walk from the loan's own start so the opening balance at `fromKey` is the
  // real one. Capped at the range guard's worth of months either side — the
  // loop is bounded by construction, never by trusting the data.
  const startIndex = startKey ? monthIndex(startKey) : monthIndex(fromKey);
  const cap = Math.ceil(MAX_RANGE_DAYS / 28) * 2;
  let balance = principal0;
  let interest = 0;
  let repaid = 0;
  let negative = false;

  const firstIndex = monthIndex(firstKey);
  const lastIndex = monthIndex(toKey);
  for (let i = 0, idx = startIndex; idx <= lastIndex && i < cap; i++, idx++) {
    if (balance <= 0) break;
    const monthInterest = balance * monthlyRate;
    let monthPrincipal = payment - monthInterest;
    if (monthPrincipal < 0) negative = true;
    // Never repay more than is owed: a final part-payment is the amount left.
    if (monthPrincipal > balance) monthPrincipal = balance;
    if (idx >= firstIndex) {
      interest += monthInterest;
      repaid += monthPrincipal;
    }
    balance -= monthPrincipal;
  }

  return {
    name,
    months,
    cashOut: round2(interest + repaid),
    interest: round2(interest),
    principal: round2(repaid),
    closingBalance: round2(Math.max(0, balance)),
    reason: null,
    negativeAmortisation: negative,
  };
}

// ── What the statements say about themselves ───────────────────────────────

export const ACCOUNTING_BASES = ["cash", "accrual"];

const BASIS_STATEMENT = {
  cash: "Prepared on the CASH basis: revenue is money received in the period, costs are money spent in it. An invoice raised and not yet paid is not revenue here.",
  accrual:
    "Prepared on the ACCRUAL basis for revenue: an invoice counts in the period it was issued, whether or not it has been paid.",
};

/**
 * Non-null exactly when the statement's two halves do not share one basis.
 *
 * FieldQuo has no bill / accounts-payable model, so there is nothing to accrue
 * costs from. Saying so on the face of the statement is the only honest way to
 * offer an accrual view at all.
 */
const ACCRUAL_MIXED_WARNING =
  "Costs on this statement remain CASH-recorded. FieldQuo has no supplier-bill ledger, so an expense counts on the date it was entered, not on the date it was incurred. Revenue is accrual, costs are cash — read the two halves accordingly.";

/** Said out loud on the sales-tax report, every time it is rendered. */
export const TAX_SUMMARY_LIMITATIONS = [
  "This is what you CHARGED, not a tax return. Nothing here has been filed with or remitted to any tax authority.",
  "Input tax credits are not netted off. FieldQuo does not record tax on expenses, so tax you PAID on purchases is not in this figure and your actual remittance will be lower.",
  "Invoice tax is a single amount per invoice. A jurisdiction with two rates (GST and QST, for example) cannot be split out of it.",
  "There is no credit note or refund object in FieldQuo, so tax on money returned to a client is not deducted here.",
];

// ── The build ──────────────────────────────────────────────────────────────

/**
 * Every statement for one period.
 *
 * @param {object} p
 * @param {string|Date} p.from      first day of the period, inclusive
 * @param {string|Date} p.to        last day, inclusive
 * @param {"cash"|"accrual"} [p.basis]
 * @param {string} p.currency       the company's billing currency. NEVER defaulted.
 * @param {object[]} [p.invoices]   Invoice rows, any version, `client` optional
 * @param {object[]} [p.payments]   Payment rows ({ invoiceId, amount, date, method })
 * @param {object[]} [p.expenses]   Expense rows
 * @param {object[]} [p.timeEntries] TimeEntry rows with `worker: { hourlyRate }`
 * @param {object[]} [p.payRuns]    PayRun rows
 * @param {object[]} [p.debts]      Debt rows
 * @param {boolean} [p.payrollVisible]  false when the caller may not see pay.
 *                                  Payroll-derived lines become `absent`, never 0.
 * @param {object} [p.company]      for the tax statement's jurisdiction reasoning
 * @param {object[]} [p.taxRates]
 */
export function buildFinancialStatements({
  from,
  to,
  basis = "cash",
  currency,
  invoices = [],
  payments = [],
  expenses = [],
  timeEntries = [],
  payRuns = [],
  debts = [],
  payrollVisible = true,
  company = null,
  taxRates = null,
  generatedAt = new Date(),
} = {}) {
  // ── The range ───────────────────────────────────────────────────────────
  const fromKey = dayKey(from);
  const toKey = dayKey(to);
  if (!fromKey || !toKey) {
    throw rangeError("A financial statement needs a valid start and end date.");
  }
  // An inverted range must not quietly produce empty statements. Three blank
  // pages look exactly like a quiet quarter, and somebody would file them.
  if (fromKey > toKey) {
    throw rangeError(`The period runs backwards (${fromKey} to ${toKey}).`);
  }
  const spanDays = Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / DAY_MS) + 1;
  if (spanDays > MAX_RANGE_DAYS) {
    throw rangeError(
      `The period covers ${spanDays} days. Financial statements are capped at ${MAX_RANGE_DAYS} days (about ten years) — ask for one year at a time.`,
    );
  }
  // Never defaulted, for the reason buildAccountingExport gives: Company.currency
  // is nullable and printing "CAD" on an American contractor's year-end is worse
  // than refusing. Absence of a currency is not a currency.
  if (!currency || typeof currency !== "string") {
    throw rangeError("A financial statement needs the company's billing currency; it is never assumed.");
  }
  if (!ACCOUNTING_BASES.includes(basis)) {
    throw rangeError(`Unknown accounting basis "${basis}". Use "cash" or "accrual".`);
  }

  const warnings = [];
  const warn = (code, message, extra = {}) => warnings.push({ code, message, ...extra });

  // ── Invoice families, once ──────────────────────────────────────────────
  //
  // Everything invoice-shaped below reads THIS list. An amendment is one
  // document however many rows it has, and the only way to guarantee that on
  // four statements at once is to group once and never touch `invoices` again.
  const families = invoiceFamilies(invoices);
  const familyByRowId = new Map();
  for (const fam of families) for (const m of fam.members) familyByRowId.set(m.id, fam);

  /** The date a document was issued, and which column that came from. */
  const issueOf = (fam) => {
    const source = fam.root || fam.members[0];
    const sent = dayKey(source?.sentAt);
    if (sent) return { key: sent, from: "sentAt" };
    const created = dayKey(source?.createdAt);
    if (created) return { key: created, from: "createdAt" };
    return { key: null, from: null };
  };

  for (const fam of families) {
    if (!fam.root) {
      warn(
        "missing_root_version",
        `Invoice ${fam.latest?.invoiceNumber ?? fam.rootId} was amended and its original version was not loaded. Its issue date comes from version ${num(fam.members[0]?.version) || 1}.`,
      );
    }
    const l = fam.latest;
    const restated = round2(num(l?.subtotal) - num(l?.discount) + num(l?.tax));
    if (Math.abs(restated - round2(l?.total)) > 0.01) {
      warn(
        "total_mismatch",
        `Invoice ${l?.invoiceNumber ?? fam.rootId}: subtotal − discount + tax is ${restated}, but the stored total is ${round2(l?.total)}. The stored total is used.`,
        { invoiceNumber: l?.invoiceNumber ?? null },
      );
    }
  }

  // ── Rows inside the period ──────────────────────────────────────────────
  const paymentsIn = payments.filter((p) => inRange(dayKey(p?.date), fromKey, toKey));
  const expensesIn = expenses.filter((e) => inRange(dayKey(e?.date), fromKey, toKey));
  const issuedIn = families.filter((f) => inRange(issueOf(f).key, fromKey, toKey));
  // Approved hours only. Pending hours are a claim, not a cost — the same rule
  // lib/costing/actualJobCost.js states and for the same reason: counting them
  // would make every period look worse until somebody got to the timesheets.
  const timeIn = timeEntries.filter((e) => inRange(dayKey(e?.clockIn), fromKey, toKey));
  // A pay run is counted in the period its PERIOD ENDS in, and is never
  // pro-rated across a boundary. Pro-rating would invent a split of a number
  // that was approved as one number; naming the rule is better than guessing.
  const payRunsIn = payRuns.filter(
    (r) => inRange(dayKey(r?.periodEnd), fromKey, toKey) && (r?.status === "approved" || r?.status === "paid"),
  );

  const empty =
    paymentsIn.length === 0 &&
    expensesIn.length === 0 &&
    issuedIn.length === 0 &&
    timeIn.length === 0 &&
    payRunsIn.length === 0;

  // ── Revenue and the tax inside it ───────────────────────────────────────
  //
  // Tax charged to a client is NOT revenue — it is money held on somebody
  // else's behalf. So every revenue figure below is ex-tax, and the tax that
  // came out of it becomes statement 3 rather than disappearing.
  //
  // On the accrual side that split is exact: an invoice carries its own tax
  // amount. On the cash side a payment is a slice of an invoice, so it is
  // apportioned in the invoice's own tax ratio — stated on the figure, because
  // a part-payment is not actually required to be split that way and this is
  // the conventional choice rather than a recorded fact.
  const receiptsByMethod = new Map();
  let receiptsGross = 0;
  let receiptsExTax = 0;
  let receiptsTax = 0;
  let receiptsUnmatched = 0;
  let unmatchedCount = 0;

  for (const p of paymentsIn) {
    const amount = num(p?.amount);
    if (amount < 0) {
      warn(
        "negative_payment",
        `A payment of ${amount} is recorded on ${dayKey(p?.date)}. FieldQuo refuses non-positive payments and has no refund object, so this did not come from the app. It is included exactly as recorded and NOT netted away.`,
      );
    }
    receiptsGross += amount;
    const method = p?.method || "unrecorded";
    receiptsByMethod.set(method, (receiptsByMethod.get(method) || 0) + amount);

    const fam = familyByRowId.get(p?.invoiceId);
    const total = num(fam?.latest?.total);
    if (!fam) {
      receiptsUnmatched += amount;
      // Counted as well as summed. A payment row whose amount is unreadable
      // sums to nothing, and reporting only the sum would let exactly the row
      // most worth looking at pass without a word.
      unmatchedCount++;
      continue;
    }
    if (total <= 0) {
      // Nothing to apportion against. The whole receipt is treated as ex-tax
      // and said so — inventing a ratio from a zero total would be division by
      // a number nobody entered.
      receiptsExTax += amount;
      continue;
    }
    const taxShare = num(fam.latest?.tax) / total;
    receiptsTax += amount * taxShare;
    receiptsExTax += amount * (1 - taxShare);
  }

  if (unmatchedCount > 0) {
    warn(
      "unmatched_receipt",
      `${unmatchedCount} payment(s) in this period, worth ${round2(receiptsUnmatched)}, name an invoice that was not loaded, so the tax inside them could not be separated. They are counted in cash received and excluded from cash-basis revenue.`,
    );
  }

  let accrualExTax = 0;
  let accrualTax = 0;
  const accrualComponents = [];
  for (const fam of issuedIn) {
    const l = fam.latest;
    const ex = num(l?.subtotal) - num(l?.discount);
    accrualExTax += ex;
    accrualTax += num(l?.tax);
    accrualComponents.push({
      label: `${l?.invoiceNumber ?? fam.rootId}${fam.versionCount > 1 ? ` (v${num(l?.version) || 1} of ${fam.versionCount})` : ""}`,
      amount: ex,
      count: 1,
    });
  }

  const revenueIncludes =
    basis === "cash"
      ? ["Payments recorded against an invoice, dated inside the period", "Deposits and part-payments, at the point they were received"]
      : ["The latest version of every invoice issued in the period", "Invoices issued and not yet paid"];
  const revenueExcludes = [
    "Sales tax charged to the client — held on the authority's behalf, reported separately",
    basis === "cash" ? "Invoices raised in the period but not yet paid" : "Payments received against invoices issued before the period",
    "Superseded versions of an amended invoice — each document counts once, at its latest version",
  ];

  let revenue;
  if (basis === "cash") {
    revenue =
      paymentsIn.length === 0
        ? nothingRecorded("Revenue (cash received, excluding tax)", { includes: revenueIncludes, excludes: revenueExcludes })
        : figure("Revenue (cash received, excluding tax)", receiptsExTax, {
            count: paymentsIn.length,
            components: [...receiptsByMethod.entries()].map(([method, amount]) => ({ label: method, amount, count: null })),
            includes: revenueIncludes,
            excludes: [
              ...revenueExcludes,
              "Payments naming an invoice outside this report — see the warnings",
            ],
          });
  } else {
    revenue =
      issuedIn.length === 0
        ? nothingRecorded("Revenue (invoiced, excluding tax)", { includes: revenueIncludes, excludes: revenueExcludes })
        : figure("Revenue (invoiced, excluding tax)", accrualExTax, {
            count: issuedIn.length,
            components: accrualComponents,
            includes: revenueIncludes,
            excludes: revenueExcludes,
          });
  }

  // ── Cost of work done ───────────────────────────────────────────────────
  //
  // Two sources, and they do not overlap: an Expense carrying a projectId is a
  // material or a subcontractor bought FOR a job, and an approved TimeEntry
  // against a job is the labour on it. Neither is derived from the other.
  const jobExpenses = expensesIn.filter((e) => e?.projectId);
  const jobExpenseByCategory = new Map();
  let jobExpenseTotal = 0;
  for (const e of jobExpenses) {
    const amount = num(e?.amount);
    jobExpenseTotal += amount;
    const key = e?.category || "uncategorised";
    jobExpenseByCategory.set(key, (jobExpenseByCategory.get(key) || 0) + amount);
  }

  let directHours = 0;
  let directLabour = 0;
  let unratedHours = 0;
  let pendingHours = 0;
  for (const e of timeIn) {
    const hours = num(e?.hours);
    if (!hours) continue;
    if (e?.status !== "approved") {
      pendingHours += hours;
      continue;
    }
    if (!e?.jobId) continue; // company time, not the cost of a job — see overhead
    const rate = e?.worker?.hourlyRate;
    // Explicitly null-checked before Number(): Number(null) is 0, which turns
    // "nobody has set this person's rate" into "this person is free", and a
    // period showing profit only because the crew was unpriced is the worst
    // wrong number this file could print.
    if (rate === null || rate === undefined || rate === "") {
      unratedHours += hours;
      directHours += hours;
      continue;
    }
    directHours += hours;
    directLabour += hours * num(rate);
  }

  if (pendingHours > 0) {
    warn(
      "hours_awaiting_approval",
      `${round2(pendingHours)} hours in this period are still awaiting approval and are NOT costed. Approve the timesheets and the statement will change.`,
    );
  }
  if (unratedHours > 0) {
    warn(
      "unrated_hours",
      `${round2(unratedHours)} approved hours were worked by someone with no hourly rate on file. Those hours cost nothing in this statement, which understates the cost of work done.`,
    );
  }

  const materials =
    jobExpenses.length === 0
      ? nothingRecorded("Materials, subcontractors and other job costs", {
          includes: ["Expenses tagged to a job"],
          excludes: ["Expenses with no job against them — those are overhead or general costs below"],
        })
      : figure("Materials, subcontractors and other job costs", jobExpenseTotal, {
          count: jobExpenses.length,
          components: [...jobExpenseByCategory.entries()]
            .map(([label, amount]) => ({ label, amount, count: null }))
            .sort((a, b) => b.amount - a.amount),
          includes: ["Expenses tagged to a job, by the category they were entered under"],
          excludes: ["Overhead and general expenses", "Sales tax paid on purchases — FieldQuo does not record it"],
        });

  const labour =
    directHours === 0
      ? nothingRecorded("Direct labour on jobs", {
          includes: ["Approved timesheet hours against a job, at the worker's recorded rate"],
          excludes: ["Hours awaiting approval", "Time not logged against a job"],
        })
      : figure("Direct labour on jobs", directLabour, {
          count: timeIn.filter((e) => e?.status === "approved" && e?.jobId).length,
          components: [{ label: `${round2(directHours)} approved hours`, amount: directLabour, count: null }],
          includes: ["Approved timesheet hours against a job, at the worker's recorded rate"],
          excludes: [
            `${round2(pendingHours)} hours still awaiting approval`,
            unratedHours > 0 ? `${round2(unratedHours)} approved hours from workers with no rate on file — they cost nothing here` : "Time not logged against a job",
            "Employer payroll taxes and statutory contributions — not modelled per hour",
          ],
        });

  const costOfWorkDone = subtotal("Cost of work done", [{ figure: materials }, { figure: labour }], {
    includes: ["What it cost to deliver the work billed in this period"],
    excludes: ["Rent, insurance, vehicles and anything else that would be owed with no jobs on — those are overhead"],
  });

  const grossProfit = subtotal(
    "Gross profit",
    [{ figure: revenue }, { figure: costOfWorkDone, sign: -1 }],
    { includes: ["Revenue less the direct cost of doing the work"] },
  );

  // ── Overhead ────────────────────────────────────────────────────────────
  const overheadRows = expensesIn.filter((e) => e?.isOverhead);
  const generalRows = expensesIn.filter((e) => !e?.isOverhead && !e?.projectId);

  const sumBy = (rows) => {
    const byCategory = new Map();
    let total = 0;
    for (const e of rows) {
      const amount = num(e?.amount);
      total += amount;
      const key = e?.category || "uncategorised";
      byCategory.set(key, (byCategory.get(key) || 0) + amount);
    }
    return {
      total,
      components: [...byCategory.entries()].map(([label, amount]) => ({ label, amount, count: null })).sort((a, b) => b.amount - a.amount),
    };
  };

  const oh = sumBy(overheadRows);
  const gen = sumBy(generalRows);

  // ── Recurring overhead is a TEMPLATE, not one row per month ─────────────
  //
  // lib/analytics/burnRate.js multiplies a recurring Expense by a frequency
  // factor to reach a monthly figure, which only makes sense if one row means
  // "rent, every month" rather than "rent, in March". So a recurring commitment
  // lands in this statement in exactly the one period its row is dated in, and
  // is absent from every other one.
  //
  // That is a real gap in the data and it is reported rather than patched: the
  // alternative is to synthesise twelve expense rows nobody entered, which is
  // precisely the invented-data failure. The commitment total is offered
  // alongside as a separate, labelled comparison so the contractor can see the
  // size of what is missing.
  const recurringInPeriod = expensesIn.filter((e) => e?.recurring).length;
  const recurringOnFile = expenses.filter((e) => e?.recurring && e?.isOverhead).length;
  if (recurringOnFile > 0) {
    warn(
      "recurring_overhead_is_a_template",
      `${recurringOnFile} recurring overhead commitments are on file and ${recurringInPeriod} of them fall inside this period. FieldQuo stores a recurring expense as ONE row, not one row per month, so a monthly commitment appears in this statement only in the period its row is dated. Overhead below is therefore what was ENTERED in the period, not what the business is committed to.`,
    );
  }

  const overheadExpenses =
    overheadRows.length === 0
      ? nothingRecorded("Overhead (rent, insurance, vehicles, admin)", {
          includes: ["Expenses marked as overhead, dated in the period"],
          excludes: ["Recurring commitments whose single row falls outside this period — see the notes"],
        })
      : figure("Overhead (rent, insurance, vehicles, admin)", oh.total, {
          count: overheadRows.length,
          components: oh.components,
          includes: ["Expenses marked as overhead, dated in the period"],
          excludes: ["Recurring commitments whose single row falls outside this period — see the notes"],
        });

  const generalExpenses =
    generalRows.length === 0
      ? nothingRecorded("Other operating costs", {
          includes: ["Expenses with no job and not marked overhead"],
        })
      : figure("Other operating costs", gen.total, {
          count: generalRows.length,
          components: gen.components,
          includes: ["Expenses with no job against them and not marked as overhead"],
        });

  // ── Wages that are not on a job ─────────────────────────────────────────
  //
  // Pay runs are the company's real wage bill and they OVERLAP direct labour:
  // the hours a crew logged against a job are paid through the same run. Adding
  // both would count the same money twice, so the run's gross is reduced by the
  // direct labour already charged to jobs above, and only the remainder — office
  // time, travel, unlogged hours — lands in overhead.
  //
  // Gated separately from the rest of the statement. `payroll: view_all` is its
  // own dial (lib/permissions/enforce.js canSeeAllPay), and a Manager holds
  // jobCosting without it. For that reader the line is ABSENT, never zero: an
  // overhead figure silently missing the wage bill would read as a profitable
  // month.
  let payrollGross = 0;
  for (const r of payRunsIn) payrollGross += num(r?.grossTotal);
  const otherLabourAmount = payrollGross - directLabour;

  let otherLabour;
  if (!payrollVisible) {
    otherLabour = absent(
      "Wages not charged to a job",
      "payroll_restricted",
      { excludes: ["Your access level does not include everyone's pay, so this line and the totals containing it are incomplete."] },
    );
  } else if (payRunsIn.length === 0) {
    otherLabour = nothingRecorded("Wages not charged to a job", {
      includes: ["Approved or paid pay runs whose pay period ends inside this statement's period"],
      excludes: ["Draft pay runs", "Pay runs whose period ends outside this one — they are never pro-rated"],
    });
  } else if (otherLabourAmount < 0) {
    // More job time was costed than payroll approved. That is a data conflict,
    // not a negative cost, and clamping it to zero would hide it.
    warn(
      "labour_exceeds_payroll",
      `Direct labour charged to jobs (${round2(directLabour)}) exceeds the gross payroll approved for this period (${round2(payrollGross)}). Timesheet rates and the pay runs disagree; wages not charged to a job cannot be worked out from them.`,
    );
    otherLabour = absent("Wages not charged to a job", "labour_exceeds_payroll");
  } else {
    otherLabour = figure("Wages not charged to a job", otherLabourAmount, {
      count: payRunsIn.length,
      components: [
        { label: "Gross payroll approved for the period", amount: payrollGross, count: payRunsIn.length },
        { label: "less direct labour already charged to jobs", amount: -directLabour, count: null },
      ],
      includes: ["Office and admin time, travel, and any approved hours not logged against a job"],
      excludes: [
        "Hours already counted in cost of work done above — they are subtracted here so nothing is charged twice",
        "Employer statutory contributions beyond what the pay run recorded",
      ],
    });
  }

  // Payroll and expenses can be the same money entered twice, and nothing in
  // the schema can tell. Say so rather than pick.
  const payrollLikeExpense = expensesIn.filter((e) => /payroll|wage|salar|labour|labor/i.test(e?.category || ""));
  if (payrollLikeExpense.length > 0 && payRunsIn.length > 0) {
    warn(
      "possible_double_count",
      `${payrollLikeExpense.length} expense rows in this period are categorised as wages or payroll AND there are pay runs covering the period. If the same wages were entered both ways they are counted twice here. FieldQuo cannot tell them apart.`,
    );
  }

  // ── Loan interest, and only the interest ────────────────────────────────
  const schedules = debts.map((d) => ({ debt: d, schedule: scheduledDebtService(d, fromKey, toKey) }));
  const dueSchedules = schedules.filter((s) => s.schedule.months > 0);
  const ratedSchedules = dueSchedules.filter((s) => s.schedule.reason === null);
  const unratedSchedules = dueSchedules.filter((s) => s.schedule.reason === "no_interest_rate");

  for (const s of dueSchedules) {
    if (s.schedule.negativeAmortisation) {
      warn(
        "negative_amortisation",
        `"${s.schedule.name}": the monthly payment does not cover the monthly interest, so the balance is growing. The interest below is correct; the loan is not being repaid.`,
      );
    }
  }
  if (unratedSchedules.length > 0) {
    warn(
      "loan_without_rate",
      `${unratedSchedules.length} loan(s) — ${unratedSchedules.map((s) => s.schedule.name).join(", ")} — have no interest rate recorded. Interest cannot be separated from principal for them, so no interest is charged to profit and the totals say they are incomplete. Add the rate in Settings → Overhead.`,
    );
  }

  const interestExcludes = [
    "Loan PRINCIPAL. Repaying principal reduces a liability; it is cash out, not a cost, and putting it here is the most common way a small-business profit figure comes out wrong.",
    "Anything actually paid: FieldQuo records loan TERMS, not loan payments, so this is what the schedule says was due.",
  ];

  let loanInterest;
  if (dueSchedules.length === 0) {
    loanInterest = nothingRecorded("Loan interest", { excludes: interestExcludes });
  } else if (ratedSchedules.length === 0) {
    loanInterest = absent("Loan interest", "no_interest_rate", { excludes: interestExcludes });
  } else {
    const interestTotal = ratedSchedules.reduce((s, x) => s + num(x.schedule.interest), 0);
    loanInterest = figure("Loan interest", interestTotal, {
      count: ratedSchedules.length,
      components: ratedSchedules.map((x) => ({ label: x.schedule.name, amount: x.schedule.interest, count: x.schedule.months })),
      includes: ["Interest due under the loan terms on file, for the months this period covers"],
      excludes: unratedSchedules.length
        ? [...interestExcludes, `${unratedSchedules.length} loan(s) with no interest rate recorded — excluded entirely`]
        : interestExcludes,
    });
    // A partial answer must not read as a whole one. The reason rides along so
    // the subtotal above it can name WHY it is incomplete rather than just
    // saying that it is.
    if (unratedSchedules.length > 0) {
      loanInterest.partial = true;
      loanInterest.reason = "no_interest_rate";
    }
  }

  const overhead = subtotal(
    "Overhead",
    [{ figure: overheadExpenses }, { figure: generalExpenses }, { figure: otherLabour }, { figure: loanInterest }],
    {
      includes: ["What the business costs to run whether or not a job is on"],
      excludes: ["Loan principal repayments", "Owner drawings", "Anything bought for a specific job"],
    },
  );

  const netProfit = subtotal("Net profit", [{ figure: grossProfit }, { figure: overhead, sign: -1 }], {
    includes: ["Gross profit less overhead"],
    excludes: [
      "Income tax — FieldQuo does not compute or record it",
      "Depreciation on vehicles, tools and equipment — not read by this statement",
    ],
  });

  // ── Cash flow ───────────────────────────────────────────────────────────
  //
  // Money that actually moved, kept strictly apart from money a schedule says
  // is due. The first block is events; the second is terms.
  const cashIn =
    paymentsIn.length === 0
      ? nothingRecorded("Money received", {
          includes: ["Every payment recorded in the period, at its full value including tax"],
        })
      : figure("Money received", receiptsGross, {
          count: paymentsIn.length,
          components: [...receiptsByMethod.entries()].map(([label, amount]) => ({ label, amount, count: null })),
          includes: ["Every payment recorded in the period, at its full value INCLUDING the tax charged"],
          excludes: ["Invoices raised and not paid", "Money owed to you at any date — see receivables on the balance sheet"],
        });

  const expenseOut = expensesIn.reduce((s, e) => s + num(e?.amount), 0);
  const cashExpenses =
    expensesIn.length === 0
      ? nothingRecorded("Expenses paid")
      : figure("Expenses paid", expenseOut, {
          count: expensesIn.length,
          components: [
            { label: "Job costs", amount: jobExpenseTotal, count: jobExpenses.length },
            { label: "Overhead", amount: oh.total, count: overheadRows.length },
            { label: "Other operating", amount: gen.total, count: generalRows.length },
          ],
          includes: ["Every expense row dated in the period, treated as paid on that date"],
          excludes: ["Anything entered with a date outside the period, whenever it was actually paid"],
        });

  // Wages leaving the bank is `netTotal` on a run with a `paidAt` inside the
  // period — the pay run's own record of having been paid. A run approved and
  // not paid has not moved any money and is deliberately not here.
  const runsPaidIn = payRuns.filter((r) => inRange(dayKey(r?.paidAt), fromKey, toKey));
  const wagesPaidAmount = runsPaidIn.reduce((s, r) => s + num(r?.netTotal), 0);
  const deductionsWithheld = runsPaidIn.reduce((s, r) => s + num(r?.deductionTotal), 0);

  let wagesPaid;
  if (!payrollVisible) {
    wagesPaid = absent("Wages paid", "payroll_restricted");
  } else if (runsPaidIn.length === 0) {
    wagesPaid = nothingRecorded("Wages paid", {
      includes: ["Pay runs marked paid inside the period, at net"],
      excludes: ["Runs approved but not yet paid — no money has left the account"],
    });
  } else {
    wagesPaid = figure("Wages paid", wagesPaidAmount, {
      count: runsPaidIn.length,
      components: runsPaidIn.map((r) => ({ label: `Pay run to ${dayKey(r?.periodEnd) ?? "?"}`, amount: num(r?.netTotal), count: null })),
      includes: ["Net pay on pay runs marked paid in the period"],
      excludes: [
        `${round2(deductionsWithheld)} of deductions withheld from those runs. FieldQuo records no remittance to any authority, so the date that money leaves the account is unknown.`,
      ],
    });
  }

  const cashOut = subtotal("Money paid out", [{ figure: cashExpenses }, { figure: wagesPaid }], {
    excludes: ["Loan repayments — reported below, because FieldQuo records no loan payment events"],
  });
  const netCashMovement = subtotal("Net movement from recorded activity", [{ figure: cashIn }, { figure: cashOut, sign: -1 }]);

  const debtCashOut = dueSchedules.reduce((s, x) => s + num(x.schedule.cashOut), 0);
  const debtService =
    dueSchedules.length === 0
      ? nothingRecorded("Loan repayments due (from the terms on file)")
      : figure("Loan repayments due (from the terms on file)", debtCashOut, {
          count: dueSchedules.length,
          components: dueSchedules.map((x) => ({
            label: `${x.schedule.name} — ${x.schedule.months} month(s)`,
            amount: x.schedule.cashOut,
            count: x.schedule.months,
          })),
          includes: [
            "The FULL repayment: principal and interest together. Both leave the bank.",
            "Derived from each loan's recorded monthly payment, start date and rate.",
          ],
          excludes: ["Any record that these payments were made — FieldQuo does not store loan payment events."],
        });

  // Mirrors the interest line deliberately: what is known is stated, and the
  // loans whose split cannot be worked out are named rather than folded in at
  // zero. The two halves of one schedule must not disagree about how much of it
  // they can see.
  let principalPortion;
  if (dueSchedules.length === 0) {
    principalPortion = nothingRecorded("of which, principal (not a cost)");
  } else if (ratedSchedules.length === 0) {
    principalPortion = absent("of which, principal (not a cost)", "no_interest_rate");
  } else {
    principalPortion = figure(
      "of which, principal (not a cost)",
      ratedSchedules.reduce((s, x) => s + num(x.schedule.principal), 0),
      {
        count: ratedSchedules.length,
        components: ratedSchedules.map((x) => ({ label: x.schedule.name, amount: x.schedule.principal, count: null })),
        includes: ["The part of each repayment that reduces the loan balance. Cash out, never a profit-and-loss expense."],
        excludes: unratedSchedules.length
          ? [`${unratedSchedules.length} loan(s) with no interest rate recorded — their split cannot be worked out`]
          : [],
      },
    );
    if (unratedSchedules.length > 0) {
      principalPortion.partial = true;
      principalPortion.reason = "no_interest_rate";
    }
  }

  const cashFlow = {
    cashIn,
    cashOut,
    netCashMovement,
    financing: {
      debtService,
      principalPortion,
      interestPortion: loanInterest,
      recorded: false,
      statement:
        "FieldQuo records loan TERMS, not loan payments. This block is what the terms say was due in the period, not proof that money left the account — which is why it is kept out of the recorded movement above.",
    },
    netAfterScheduledDebtService: subtotal(
      "Net movement after scheduled loan repayments",
      [{ figure: netCashMovement }, { figure: debtService, sign: -1 }],
      { excludes: ["Still not a bank reconciliation — see the opening and closing balances below."] },
    ),
    openingBalance: absent("Cash at bank, opening", "not_recorded"),
    closingBalance: absent("Cash at bank, closing", "not_recorded"),
    balanceStatement:
      "FieldQuo holds no bank balance and no bank feed, so this statement shows the MOVEMENT of cash in the period and cannot show the balance at either end of it.",
  };

  // ── Sales tax collected ─────────────────────────────────────────────────
  //
  // The figure a contractor needs at filing time, and emphatically not a
  // filing. lib/tax/documentTax.js already decides what one document's tax line
  // MEANS — charged, deliberately off, genuinely none, or unresolved — and that
  // classification is reused here so an invoice charging nothing with tax
  // switched on is counted as a hole to go and look at rather than as a zero.
  const taxKinds = { charged: 0, off: 0, none: 0, unresolved: 0 };
  const unresolvedInvoices = [];
  for (const fam of issuedIn) {
    const l = fam.latest;
    const st = taxStatement({
      taxEnabled: l?.taxEnabled,
      tax: l?.tax,
      company,
      taxRates,
      client: l?.client || null,
    });
    taxKinds[st.kind] = (taxKinds[st.kind] || 0) + 1;
    if (st.kind === "unresolved") unresolvedInvoices.push(l?.invoiceNumber ?? fam.rootId);
  }
  if (unresolvedInvoices.length > 0) {
    warn(
      "tax_unresolved",
      `${unresolvedInvoices.length} invoice(s) issued in this period say tax applies and charge none, with no jurisdiction to explain it: ${unresolvedInvoices.join(", ")}. They are counted as charging nothing, which may understate what you owe.`,
    );
  }

  const salesTax = {
    charged:
      issuedIn.length === 0
        ? nothingRecorded("Tax charged on invoices issued", {
            includes: ["The tax amount on the latest version of each invoice issued in the period"],
          })
        : figure("Tax charged on invoices issued", accrualTax, {
            count: issuedIn.length,
            includes: ["The tax amount on the LATEST version of each invoice issued in the period — an amended invoice counts once"],
            excludes: ["Tax on invoices issued in another period, whenever they were paid"],
          }),
    collected:
      paymentsIn.length === 0
        ? nothingRecorded("Tax inside the money actually received", {
            includes: ["The tax share of each payment taken in the period"],
          })
        : figure("Tax inside the money actually received", receiptsTax, {
            count: paymentsIn.length,
            includes: ["Each payment apportioned in its own invoice's tax ratio"],
            excludes: [
              "Payments against invoices not loaded here — their tax share could not be worked out",
              "Any assumption that a part-payment is split pro-rata between tax and net: that is this report's convention, not a recorded fact",
            ],
          }),
    documentTaxStatements: taxKinds,
    isFiling: false,
    limitations: TAX_SUMMARY_LIMITATIONS,
  };

  // ── Balance sheet, only as far as the data honestly supports ────────────
  //
  // Two of the three sections cannot be produced today, and the page says which
  // rather than printing zeros against them. A balance sheet showing $0 of
  // fixed assets because nobody was ever asked is a worse document than one
  // that names the half it can produce — this is failure class 5 and it is the
  // single most likely way a task like this goes wrong.
  //
  // ── The unavailable lines describe THIS REPORT, not the product ─────────
  //
  // Fixed assets, depreciation and supplier bills are being built separately
  // (an asset register, lib/accounting/depreciation.js, a bill ledger). This
  // file deliberately does not import them and does not guess at their shape
  // while they are in flight.
  //
  // So every `absent` below is worded as a limit of this statement — "not read
  // by this report" — and never as a claim that FieldQuo does not hold the
  // data. The difference matters: a sentence that says "there is no asset
  // register" becomes a lie the moment one lands, and a report that lies about
  // the product is worse than one that admits its own scope. Each line is a
  // stable slot, so wiring the register in later is a change to one branch.
  const asAt = toKey;
  let receivable = 0;
  let receivableCount = 0;
  const receivableComponents = [];
  let undatedInvoices = 0;
  for (const fam of families) {
    const l = fam.latest;
    if (l?.status === "draft" || l?.status === "cancelled") continue;
    const issue = issueOf(fam);
    if (!issue.key) {
      undatedInvoices++;
      continue;
    }
    if (issue.key > asAt) continue;
    // Paid-to-date AS AT the balance-sheet date, not as at today: the row's own
    // amountPaid moves every time a payment lands, and a balance sheet for last
    // March must not change next week.
    const paidByThen = fam.members
      .flatMap((m) => payments.filter((p) => p?.invoiceId === m.id))
      .filter((p) => {
        const k = dayKey(p?.date);
        return k !== null && k <= asAt;
      })
      .reduce((s, p) => s + num(p?.amount), 0);
    const outstanding = num(l?.total) - paidByThen;
    if (Math.abs(outstanding) < 0.005) continue;
    receivable += outstanding;
    receivableCount++;
    receivableComponents.push({ label: l?.invoiceNumber ?? fam.rootId, amount: outstanding, count: null });
  }
  if (undatedInvoices > 0) {
    warn(
      "invoice_without_date",
      `${undatedInvoices} invoice(s) have neither a sent date nor a created date, so they cannot be placed in time and are left out of receivables.`,
    );
  }

  const receivables =
    receivableCount === 0
      ? nothingRecorded("Money owed to you (unpaid invoices)", {
          includes: ["Invoices issued on or before the statement date, less payments received by that date"],
        })
      : figure("Money owed to you (unpaid invoices)", receivable, {
          count: receivableCount,
          components: receivableComponents.sort((a, b) => b.amount - a.amount),
          includes: [
            "The latest version of every non-draft invoice issued on or before the statement date",
            "Less every payment recorded against that document on or before the statement date",
          ],
          excludes: ["Draft and cancelled invoices", "Quotes that have not become invoices"],
        });

  const debtBalances = debts.map((d) => ({ debt: d, schedule: scheduledDebtService(d, fromKey, toKey) }));
  const withRate = debtBalances.filter((x) => x.schedule.reason === null && num(x.debt?.principal) > 0);
  const withoutRate = debtBalances.filter((x) => x.schedule.reason === "no_interest_rate");
  let loansOutstanding;
  if (debtBalances.length === 0) {
    loansOutstanding = nothingRecorded("Loans outstanding");
  } else if (withRate.length === 0) {
    loansOutstanding = absent("Loans outstanding", "no_interest_rate");
  } else {
    loansOutstanding = figure("Loans outstanding", withRate.reduce((s, x) => s + num(x.schedule.closingBalance), 0), {
      count: withRate.length,
      components: withRate.map((x) => ({ label: x.schedule.name, amount: x.schedule.closingBalance, count: null })),
      includes: ["Each loan amortised from its recorded principal, rate, monthly payment and start date, to the statement date"],
      excludes: withoutRate.length
        ? [`${withoutRate.length} loan(s) with no interest rate recorded — their remaining balance cannot be worked out`]
        : ["Any loan payment actually made — FieldQuo records terms, not payments"],
    });
    if (withoutRate.length > 0) {
      loansOutstanding.partial = true;
      loansOutstanding.reason = "no_interest_rate";
    }
  }

  const balanceSheet = {
    asAt,
    // The honest headline. A balance sheet that does not balance must say so
    // itself rather than leave the reader to notice.
    balances: false,
    balanceStatement:
      "This is a PARTIAL balance sheet and it does not balance. It states what you are owed and what you owe on the loans recorded here. Cash at bank, fixed assets and supplier bills are not read by this report, so total assets, total liabilities and equity cannot be produced — and are shown as unavailable rather than as zero.",
    assets: {
      available: [receivables],
      unavailable: [
        absent("Cash at bank", "not_recorded", {
          excludes: ["FieldQuo holds no bank balance and no bank feed, so there is nothing to read."],
        }),
        absent("Fixed assets and accumulated depreciation", "not_in_this_report", {
          excludes: ["Vehicles, tools and equipment are not read by this statement. Nothing here is a claim that you own none."],
        }),
        absent("Stock and work in progress", "not_recorded", {
          excludes: ["Materials are recorded as expenses when bought, never as stock held."],
        }),
      ],
      total: absent("Total assets", "incomplete_sections"),
    },
    liabilities: {
      available: [loansOutstanding],
      unavailable: [
        absent("Money you owe suppliers", "not_in_this_report", {
          excludes: ["Supplier bills are not read by this statement. An unpaid supplier will not appear here."],
        }),
        absent("Sales tax owed to the authority", "no_remittance_record", {
          excludes: [
            "Tax charged is reported on the sales-tax summary, but nothing records what has been remitted or what input tax credits offset it.",
          ],
        }),
      ],
      total: absent("Total liabilities", "incomplete_sections"),
    },
    equity: {
      available: [],
      unavailable: [
        absent("Owner's equity", "requires_complete_sides", {
          excludes: ["Equity is assets less liabilities. Neither side is complete, so it cannot be derived."],
        }),
      ],
      total: absent("Total equity", "incomplete_sections"),
    },
  };

  return {
    range: { from: fromKey, to: toKey, days: spanDays },
    currency,
    generatedAt,
    basis,
    basisStatement: BASIS_STATEMENT[basis],
    mixedBasisWarning: basis === "accrual" ? ACCRUAL_MIXED_WARNING : null,
    // Nothing at all fell in the period. The screen prints this sentence
    // instead of four statements full of zeros — a zeroed P&L reads like a
    // filed statement saying the business did nothing, which is a different
    // claim from "we have no records for these dates".
    empty,
    emptyStatement: empty
      ? `Nothing is recorded between ${fromKey} and ${toKey} — no payments, no invoices issued, no expenses, no approved hours and no pay runs. That is an absence of records, not a period of zero activity.`
      : null,
    profitAndLoss: {
      revenue,
      costOfWorkDone: { total: costOfWorkDone, materials, labour },
      grossProfit,
      overhead: { total: overhead, overheadExpenses, generalExpenses, otherLabour, loanInterest },
      netProfit,
    },
    cashFlow,
    salesTax,
    balanceSheet,
    warnings,
  };
}
