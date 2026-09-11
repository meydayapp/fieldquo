// lib/subcontractors/money.js
//
// The three sums the subcontractor feature exists to produce, pure over rows
// the caller fetched so scripts/check-subcontractors.mjs can run every branch
// without a database:
//
//   jobSubcontractCost()   what a job's subs cost — the line job costing reads
//   yearToDatePaid()       what one sub was paid in a calendar year — the
//                          T5018 / 1099-NEC figure
//   paymentsCover()        whether the payments on one JobSubcontractor add up
//                          to the agreed amount — what flips it to `paid`
//
// ══ The double count this file exists to prevent ═══════════════════════════
//
// A sub's cost reaches the database by two roads, and job costing must count
// it by exactly one of them:
//
//   1. JobSubcontractor.agreedAmount — the fixed price the GC agreed with the
//      company. This IS the cost, whatever the GC marked it up to on the
//      client's quote and whatever has been paid so far.
//
//   2. Expense rows. Every SubcontractorPayment writes one (category
//      SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY) so the P&L and the expense
//      ledger see the money leave. And a sub's quote imported onto the GC's
//      quote is materialised into one (category SUBCONTRACT_IMPORT_EXPENSE_CATEGORY,
//      lib/quotes/importQuote.js) when the quote becomes a job.
//
// Job costing takes the AGREED AMOUNT as the cost, for the reason the
// costing header gives for approved hours: it is the liability, decided, not
// a running tally that makes a job look profitable until the last cheque
// clears. A $5,000 sub who has been paid $2,000 has cost the job $5,000.
//
// So the payment expenses are EXCLUDED from the expense sum, always: they can
// only exist under a JobSubcontractor that is counted (recording a payment
// advances a `quoted` row to `agreed`, see app/api/subcontractors/[id]/payments).
//
// The import expense is excluded only when a counted JobSubcontractor ADOPTED
// that import (quoteImportId set, and the import had materialised). A GC who
// imported a quote and never put the sub on the job keeps the old behaviour —
// the import's expense counts, exactly as it did before this feature — so no
// existing job's cost moves. That is the one case `importExpenseId` on a row
// is for.
//
// `quoted` rows are not cost. A price the sub offered and the GC has not
// accepted is a comparison, not a liability, and counting it would put every
// bid the GC collected onto the job's cost at once.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (v) => {
  const r = Math.round(num(v) * 100) / 100;
  return Number.isFinite(r) ? r : 0;
};

/**
 * The Expense.category every SubcontractorPayment writes under. A string, not
 * an enum — Expense.category is free text everywhere else — and a DIFFERENT
 * string from the import category below so costing can tell "we paid the sub"
 * from "we booked the sub's quote" without reading notes.
 */
export const SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY = "Subcontractor payment";

/**
 * The Expense.category lib/quotes/importQuote.js has always written when a
 * sub's imported quote is materialised onto a job. Named here, and imported
 * there, so the two files cannot drift apart on the one string that decides
 * whether a cost is counted once or twice.
 */
export const SUBCONTRACT_IMPORT_EXPENSE_CATEGORY = "Subcontractor";

/**
 * quoted → agreed → done → paid. Strings, not an enum, matching JobVisit —
 * and matching the schema comment on JobSubcontractor.status.
 */
export const JOB_SUBCONTRACTOR_STATUSES = Object.freeze(["quoted", "agreed", "done", "paid"]);

/** The statuses whose agreedAmount is a cost. `quoted` is deliberately absent. */
export const COSTED_STATUSES = Object.freeze(new Set(["agreed", "done", "paid"]));

export function isCostedStatus(status) {
  return COSTED_STATUSES.has(status);
}

/**
 * Sum of agreedAmount for one job, by status.
 *
 * @param {object[]} rows  JobSubcontractor rows: { agreedAmount, status,
 *                         importExpenseId? } — `importExpenseId` is the
 *                         Expense the row's adopted QuoteImport materialised
 *                         into, when the caller looked it up.
 * @returns {{ total, count, byStatus, excludedExpenseIds: string[] }}
 *
 * `total` counts agreed/done/paid only. `byStatus` reports every status,
 * `quoted` included, so a panel can say "and $3,000 more quoted, not agreed"
 * without that figure ever reaching the total.
 */
export function jobSubcontractCost(rows) {
  const byStatus = { quoted: 0, agreed: 0, done: 0, paid: 0 };
  const excludedExpenseIds = [];
  let total = 0;
  let count = 0;

  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || typeof r !== "object") continue;
    const amount = num(r.agreedAmount);
    const status = JOB_SUBCONTRACTOR_STATUSES.includes(r.status) ? r.status : null;
    // An unrecognised status is not silently `quoted` and not silently
    // `agreed`: it is skipped and, since the column has a default and the
    // route validates, cannot occur without somebody writing the database by
    // hand. Skipping is the honest answer to a row we cannot classify.
    if (!status) continue;
    byStatus[status] = round2(byStatus[status] + amount);
    if (!COSTED_STATUSES.has(status)) continue;
    total += amount;
    count += 1;
    if (typeof r.importExpenseId === "string" && r.importExpenseId) {
      excludedExpenseIds.push(r.importExpenseId);
    }
  }

  return { total: round2(total), count, byStatus, excludedExpenseIds };
}

/**
 * Should this expense row be left OUT of a job's expense sum because the
 * subcontract line already carries it?
 *
 * @param {object} expense        { id?, category }
 * @param {Set<string>} adopted   ids from jobSubcontractCost().excludedExpenseIds
 */
export function isSubcontractExpense(expense, adopted) {
  if (!expense) return false;
  if (expense.category === SUBCONTRACT_PAYMENT_EXPENSE_CATEGORY) return true;
  if (adopted && typeof expense.id === "string" && adopted.has(expense.id)) return true;
  return false;
}

/**
 * The calendar year a payment falls in, or null when it has no usable date.
 *
 * UTC, on purpose. A payment date typed into a date input arrives as
 * "2026-03-05", which `new Date()` reads as UTC midnight of that day; taking
 * the UTC year gives back the year the person typed. Reading it in the
 * server's local zone could shift a 31 December payment into next year on a
 * host west of Greenwich, which is a number on a tax form.
 */
export function paymentYear(date) {
  if (date === null || date === undefined || date === "" || date === 0) return null;
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

/**
 * What one sub was paid in one calendar year — the T5018 / 1099-NEC figure.
 *
 * @param {object[]} payments  { amount, date, method?, stripeTransferId? }
 * @param {number}   year      four-digit calendar year
 * @returns {{ year, total, count, byMethod: { [method]: number } }}
 *
 * A payment with no date, or a date that will not parse, belongs to no year
 * and is left out of every year — absence of a date is not a statement that
 * it was this year. `count` says how many rows made the total so an accountant
 * can reconcile it against the ledger.
 */
export function yearToDatePaid(payments, year) {
  const y = Number(year);
  const byMethod = {};
  let total = 0;
  let count = 0;
  if (!Number.isInteger(y)) return { year: null, total: 0, count: 0, byMethod };

  for (const p of Array.isArray(payments) ? payments : []) {
    if (!p || typeof p !== "object") continue;
    if (paymentYear(p.date) !== y) continue;
    const amount = Number(p.amount);
    // Non-finite is skipped rather than coerced: `Number("abc")` is NaN and
    // NaN + anything is NaN, which would blank the whole year's total.
    if (!Number.isFinite(amount)) continue;
    total += amount;
    count += 1;
    const method = typeof p.method === "string" && p.method ? p.method : "unknown";
    byMethod[method] = round2((byMethod[method] || 0) + amount);
  }

  return { year: y, total: round2(total), count, byMethod };
}

/**
 * The same figure for every sub at once — the year-end export.
 *
 * @param {object[]} payments  { subcontractorId, amount, date }
 * @returns {Map<string, { total, count }>} keyed by subcontractorId; a sub
 *          with no payments that year is simply absent, and the export prints
 *          0 for it from the roster rather than from here.
 */
export function yearToDatePaidBySubcontractor(payments, year) {
  const y = Number(year);
  const out = new Map();
  if (!Number.isInteger(y)) return out;
  for (const p of Array.isArray(payments) ? payments : []) {
    if (!p || typeof p !== "object" || !p.subcontractorId) continue;
    if (paymentYear(p.date) !== y) continue;
    const amount = Number(p.amount);
    if (!Number.isFinite(amount)) continue;
    const cur = out.get(p.subcontractorId) || { total: 0, count: 0 };
    cur.total = round2(cur.total + amount);
    cur.count += 1;
    out.set(p.subcontractorId, cur);
  }
  return out;
}

/**
 * Do the payments on one JobSubcontractor cover its agreed amount?
 *
 * @returns {{ paid, agreed, remaining, covered }}
 *
 * `covered` is false for an agreed amount of 0 or less: "paid in full" on a
 * row with no price is a statement about nothing, and a row that was agreed
 * for nothing has nothing to flip to `paid` over. Overpayment (`remaining`
 * negative) is reported, not clamped — a GC who paid the roofer twice needs
 * to see the minus sign, not a tidy zero.
 */
export function paymentsCover(agreedAmount, payments) {
  const agreed = round2(agreedAmount);
  let paid = 0;
  for (const p of Array.isArray(payments) ? payments : []) {
    const amount = Number(p?.amount);
    if (!Number.isFinite(amount)) continue;
    paid += amount;
  }
  paid = round2(paid);
  return {
    paid,
    agreed,
    remaining: round2(agreed - paid),
    covered: agreed > 0 && paid >= agreed,
  };
}

/**
 * The calendar year a `?year=` query asks for, or the current UTC year.
 *
 * Bounded to 2000–2100: a year outside that is a typo, and answering it
 * with an empty ledger would read as "nothing was paid" rather than "that
 * is not a year".
 */
export function requestedYear(searchParams, now = new Date()) {
  const raw = searchParams?.get?.("year");
  const y = Number(raw);
  if (raw && Number.isInteger(y) && y >= 2000 && y <= 2100) return y;
  return now.getUTCFullYear();
}
