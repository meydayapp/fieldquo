// lib/accounting/bills.js
//
// Bills due — accounts payable, the small honest version.
//
// ── What this is NOT ───────────────────────────────────────────────────────
//
// Not a payment rail. The owner was explicit about why: "i don't think hydro
// ottawa or other companies take payments through quickbook but either credit
// card payments or payments through a bank... i would assume that they log the
// information like we do in overhead." Nobody pays their hydro bill from
// inside a quoting app, and a Pay button that only marked a row would be a
// control that appears to work and doesn't.
//
// What was actually missing is one thing: the state a cost has BEFORE it is
// paid. Owed, due on a date, not yet settled — so this month's outgoings can
// be seen coming rather than reconstructed from receipts afterwards.
//
// ── Why a bill is an Expense with a due date ───────────────────────────────
//
// See the dueDate/paidAt comment on model Expense. Short version: a separate
// Bill model would hold the same category and amount in a second table, and
// a contractor who entered the hydro bill in both would double their own price
// floor with nothing on the way telling them so.
//
// ── Why nothing here touches the burn rate ─────────────────────────────────
//
// A bill is an INSTANCE of a cost; the burn rate counts the RECURRING pattern
// (`Expense{isOverhead, recurring}`). Adding "hydro, due the 15th" to a
// company that already has "hydro, $180/month" as a recurring overhead row
// must not raise the price floor by another $180. So bills are created
// non-recurring, which lib/analytics/burnRate.js converts at a factor of zero
// — the same defence, arrived at the same way, as the one the fixed-costs
// route documents. The two lists answer different questions and are allowed to
// contain the same words.
//
// Everything here is pure. `asOf` is always passed.

/** A Date, or null. Never an Invalid Date reaching a comparison. */
function asDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Midnight, so "due today" is not "overdue by six hours". */
function startOfDay(d) {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * One bill's state.
 *
 *   paid      — settled, with the date it was settled
 *   overdue   — due before today and still unpaid
 *   due       — unpaid, due today or later
 *   undated   — has no due date, so it is not a bill at all
 *
 * `undated` exists rather than being silently treated as overdue because every
 * Expense that predates these columns has a null dueDate, and reading null as
 * "overdue since forever" would open this screen on a hundred invented
 * emergencies. Absence of a statement is not a statement.
 */
export function billStatus(bill, asOf) {
  const today = startOfDay(asDate(asOf) || new Date(0));
  if (asDate(bill?.paidAt)) return "paid";
  const due = asDate(bill?.dueDate);
  if (!due) return "undated";
  return startOfDay(due) < today ? "overdue" : "due";
}

/**
 * What is coming out, summarised for the screen.
 *
 * `dueThisMonth` is the calendar month `asOf` falls in — the question a
 * contractor actually asks at the end of a month is "what still has to go out
 * before this one closes", not "what falls due in the next thirty days".
 *
 * Amounts are summed with num(), so one unparseable row contributes zero
 * rather than turning every total on the screen into NaN.
 */
export function summariseBills(bills, asOf) {
  const now = asDate(asOf) || new Date(0);
  const rows = Array.isArray(bills) ? bills : [];

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  let outstanding = 0;
  let overdue = 0;
  let dueThisMonth = 0;
  let overdueCount = 0;
  let outstandingCount = 0;

  for (const bill of rows) {
    const status = billStatus(bill, now);
    if (status === "paid" || status === "undated") continue;
    const amount = num(bill?.amount);
    outstanding += amount;
    outstandingCount += 1;
    if (status === "overdue") {
      overdue += amount;
      overdueCount += 1;
      // An overdue bill is still money that has to leave this month — leaving
      // it out of dueThisMonth would understate the very figure the panel is
      // for, and last month's unpaid hydro does not stop being owed.
      dueThisMonth += amount;
      continue;
    }
    const due = asDate(bill?.dueDate);
    if (due && due >= monthStart && due < monthEnd) dueThisMonth += amount;
  }

  return {
    outstanding: round2(outstanding),
    outstandingCount,
    overdue: round2(overdue),
    overdueCount,
    dueThisMonth: round2(dueThisMonth),
  };
}

function round2(n) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}
