// lib/leave/accrual.js
//
// Leave arithmetic. Pure — no I/O, no system clock — so it's unit-testable,
// which matters because these numbers decide whether someone's holiday is
// approved and whether they're paid for it.
//
// ── Working days, not calendar days ─────────────────────────────────────────
//
// A Monday-to-Friday holiday is 5 days off, not 5 calendar days that happen to
// include a weekend — and for a crew working Tuesday-to-Saturday it's a
// different set again. So the count is driven by the person's OWN working days
// (WorkingHours), falling back to Mon–Fri only when nothing is configured.
// Counting calendar days would overcharge everyone's balance by 2/7.

const MS_DAY = 24 * 60 * 60 * 1000;

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function money(n) {
  return Math.round((num(n) + Number.EPSILON) * 100) / 100;
}
function days(n) {
  return Math.round((num(n) + Number.EPSILON) * 100) / 100;
}

/** Midnight UTC for a date-like value, so day maths can't drift on DST. */
function utcDay(value) {
  // `new Date(null)` and `new Date(0)` are BOTH the epoch, not invalid dates —
  // and the epoch is a Thursday, so an empty range would silently count as one
  // working day. Rather than special-casing each falsy value, reject anything
  // that isn't a plausible date: nobody books leave in 1970, so a year that far
  // back is always a bug upstream.
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getUTCFullYear() < 2000) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Working days between two dates INCLUSIVE, for one person.
 *
 * @param workingDays  Set/array of dayOfWeek numbers this person works (0=Sun).
 *                     Empty/absent → Mon–Fri, the only defensible default.
 * @param holidays     ISO date strings to skip (statutory holidays).
 */
export function countWorkingDays(startDate, endDate, { workingDays, holidays = [] } = {}) {
  const start = utcDay(startDate);
  const end = utcDay(endDate);
  if (start == null || end == null || end < start) return 0;

  const work =
    workingDays && (workingDays.size ?? workingDays.length)
      ? new Set(Array.from(workingDays).map(Number))
      : new Set([1, 2, 3, 4, 5]);

  const skip = new Set(
    (Array.isArray(holidays) ? holidays : [])
      .map((h) => utcDay(h))
      .filter((h) => h != null),
  );

  let count = 0;
  for (let t = start; t <= end; t += MS_DAY) {
    const dow = new Date(t).getUTCDay();
    if (work.has(dow) && !skip.has(t)) count += 1;
  }
  return count;
}

/**
 * How much leave has accrued for a policy.
 *
 * annual_allotment  — the whole year's entitlement, optionally pro-rated for
 *                     someone who started mid-year. Pro-rating is opt-in: a
 *                     company that grants the full amount on day one is common,
 *                     and silently reducing it would be wrong.
 * per_period        — annualDays spread over the pay periods elapsed.
 * percent_of_gross  — vacation PAY as a share of earnings (money, not days).
 */
export function accrueForPolicy({
  policy = {},
  periodsElapsed = 0,
  periodsPerYear = 26,
  grossEarnedYtd = 0,
  fractionOfYearEmployed = 1,
  proRate = false,
} = {}) {
  const method = policy.accrualMethod || "annual_allotment";

  if (method === "percent_of_gross") {
    const pct = Math.min(100, Math.max(0, num(policy.percentOfGross)));
    return { accruedDays: 0, accruedAmount: money((num(grossEarnedYtd) * pct) / 100) };
  }

  const annual = Math.max(0, num(policy.annualDays));

  if (method === "per_period") {
    const periods = Math.max(1, num(periodsPerYear, 26));
    const elapsed = Math.max(0, Math.min(periods, num(periodsElapsed)));
    return { accruedDays: days((annual / periods) * elapsed), accruedAmount: 0 };
  }

  // annual_allotment
  const fraction = proRate
    ? Math.min(1, Math.max(0, num(fractionOfYearEmployed, 1)))
    : 1;
  return { accruedDays: days(annual * fraction), accruedAmount: 0 };
}

/**
 * What's left. Remaining is always derived — a stored remainder is the number
 * that drifts out of step with the requests behind it.
 *
 * `pendingDays` is subtracted so someone can't book the same days twice while
 * a first request is still awaiting approval.
 */
export function remainingBalance(balance = {}, { pendingDays = 0 } = {}) {
  const accrued = num(balance.accruedDays) + num(balance.carriedInDays);
  const used = num(balance.usedDays);
  const pending = Math.max(0, num(pendingDays));
  return {
    accruedDays: days(accrued),
    usedDays: days(used),
    pendingDays: days(pending),
    remainingDays: days(accrued - used - pending),
    accruedAmount: money(balance.accruedAmount),
    usedAmount: money(balance.usedAmount),
    remainingAmount: money(num(balance.accruedAmount) - num(balance.usedAmount)),
  };
}

/**
 * Days carried into a new year, honouring the policy cap.
 *
 * null cap = unlimited; 0 = use it or lose it. Those are different answers and
 * `|| 0` would silently turn "unlimited" into "none".
 */
export function carryoverDays(remainingDays, policy = {}) {
  const remaining = Math.max(0, num(remainingDays));
  const cap = policy.carryoverMaxDays;
  if (cap === null || cap === undefined) return days(remaining);
  return days(Math.min(remaining, Math.max(0, num(cap))));
}

/**
 * Can this request be approved against the balance?
 *
 * Unpaid leave isn't limited by a balance — that's the point of it — so it's
 * always allowed and simply recorded.
 */
export function canTakeLeave({ policy = {}, balance = {}, requestedDays = 0, pendingDays = 0 } = {}) {
  const requested = Math.max(0, num(requestedDays));
  if (requested <= 0) {
    return { ok: false, reason: "no_working_days", message: "That range contains no working days." };
  }
  if (policy.accrualMethod === "percent_of_gross" || policy.paid === false) {
    return { ok: true, remainingAfter: null };
  }
  const { remainingDays } = remainingBalance(balance, { pendingDays });
  if (requested > remainingDays) {
    return {
      ok: false,
      reason: "insufficient_balance",
      message: `That's ${days(requested)} day(s) but only ${days(remainingDays)} remain.`,
      remainingDays,
    };
  }
  return { ok: true, remainingAfter: days(remainingDays - requested) };
}

/**
 * Paid leave as a payroll earning: days × the person's daily rate.
 *
 * Daily rate comes from their working week, not a flat 8 hours — someone on
 * four 10-hour days loses 10 hours when they take a day off, not 8.
 */
export function leaveEarning({ paidDays = 0, hourlyRate = 0, hoursPerWorkingDay = 8 } = {}) {
  const d = Math.max(0, num(paidDays));
  const rate = Math.max(0, num(hourlyRate));
  const hours = Math.max(0, num(hoursPerWorkingDay, 8));
  if (!d || !rate || !hours) return 0;
  return money(d * hours * rate);
}
