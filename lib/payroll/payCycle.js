// lib/payroll/payCycle.js
//
// When a pay period starts, when it ends, and when the money goes out.
// Pure — no I/O, no clock of its own — so it runs against a fixed "today" in a
// check script and gives the same answer every time.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The payroll screen guessed: "the last fourteen days ending today". Run it on
// a Tuesday and you get a Tuesday-to-Tuesday period; run it a day late and
// every boundary shifts by a day. Nothing recorded what the company had
// actually agreed with its staff, so there was no such thing as "the current
// period" — which is why nobody could be shown what they had earned so far,
// and why no reminder could know a schedule was due.
//
// ── The period end is the anchor, not the payday ────────────────────────────
//
// A company says "we pay every second Thursday", so the obvious model is to
// anchor on the payday and count back. That is wrong here, and buildPayRun.js
// says why: it computes overtime against a WEEKLY threshold. A period that
// does not contain whole weeks splits somebody's week across two runs and
// computes their overtime twice, on two partial weeks, and understates it both
// times.
//
// So periods always end on a fixed weekday — Sunday by default — and the payday
// is the first chosen weekday AFTER that. Move payday from Thursday to Friday
// and the periods do not move; only the gap the office has to approve hours in
// changes, which is the thing a company is actually deciding when it picks a
// payday. `reviewDays` reports that gap so the setting can show it rather than
// leaving someone to count on their fingers.
//
// Semi-monthly and monthly do not align to weeks at all — they are calendar
// periods — so they are handled separately and honestly flagged, because weekly
// overtime across a 1st-to-15th period is a real limitation, not a rounding
// detail.

/** 0 = Sunday, matching Date#getUTCDay and the WorkingHours.dayOfWeek column. */
export const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export const PAY_FREQUENCIES = {
  weekly: { label: "Every week", weeks: 1, alignsToWeeks: true },
  biweekly: { label: "Every 2 weeks", weeks: 2, alignsToWeeks: true },
  semimonthly: { label: "Twice a month", weeks: null, alignsToWeeks: false },
  monthly: { label: "Once a month", weeks: null, alignsToWeeks: false },
};

/**
 * What a company gets before it has said anything.
 *
 * Periods close Sunday, payday is the Thursday after — four days to approve
 * hours, which is the arrangement most trades already run. Every field is
 * editable; none of it is guessed from the data.
 */
export const DEFAULT_PAY_CYCLE = {
  frequency: "biweekly",
  periodEndDayOfWeek: 0, // Sunday
  payDayOfWeek: 4, // Thursday
  // Which fortnight is "on". Any historical period-end date on the right
  // cadence will do; this one is a Sunday.
  anchorDate: "2026-01-04",
};

const own = (map, key) =>
  map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

const DAY_MS = 86400000;

/** A UTC midnight Date from anything date-shaped. Null when it isn't one. */
export function utcDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(
      Date.UTC(
        value.getUTCFullYear(),
        value.getUTCMonth(),
        value.getUTCDate(),
      ),
    );
  }
  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export const isoDay = (d) => (d ? d.toISOString().slice(0, 10) : null);

const addDays = (d, n) => new Date(d.getTime() + n * DAY_MS);

/** Merge a company's stored cycle over the defaults, dropping anything invalid. */
export function resolvePayCycle(stored) {
  const s = stored && typeof stored === "object" ? stored : {};
  const freq = own(PAY_FREQUENCIES, s.frequency)
    ? s.frequency
    : DEFAULT_PAY_CYCLE.frequency;
  const day = (v, fallback) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 6 ? n : fallback;
  };
  const anchor = utcDate(s.anchorDate) || utcDate(DEFAULT_PAY_CYCLE.anchorDate);
  return {
    frequency: freq,
    periodEndDayOfWeek: day(
      s.periodEndDayOfWeek,
      DEFAULT_PAY_CYCLE.periodEndDayOfWeek,
    ),
    payDayOfWeek: day(s.payDayOfWeek, DEFAULT_PAY_CYCLE.payDayOfWeek),
    anchorDate: isoDay(anchor),
  };
}

/**
 * The payday for a period that ended on `periodEnd`: the first configured
 * weekday strictly AFTER it.
 *
 * Strictly after, even when the period ends on the payday weekday itself —
 * otherwise a company paying Sunday for a period ending Sunday would be paying
 * for hours nobody could have approved, which is the arrangement the whole
 * review gap exists to avoid.
 */
export function payDateFor(periodEnd, cycle) {
  const end = utcDate(periodEnd);
  if (!end) return null;
  const c = resolvePayCycle(cycle);
  const delta = (c.payDayOfWeek - end.getUTCDay() + 7) % 7 || 7;
  return addDays(end, delta);
}

/** Days between a period closing and its payday — the time to approve hours. */
export function reviewDays(cycle) {
  const c = resolvePayCycle(cycle);
  return (c.payDayOfWeek - c.periodEndDayOfWeek + 7) % 7 || 7;
}

/**
 * The pay period containing `date`.
 *
 * @returns {{start:Date, end:Date, payDate:Date, frequency:string,
 *            alignsToWeeks:boolean, weeks:number|null}}
 */
export function payPeriodFor(date, cycle) {
  const c = resolvePayCycle(cycle);
  const on = utcDate(date);
  if (!on) return null;
  const meta = own(PAY_FREQUENCIES, c.frequency) || PAY_FREQUENCIES.biweekly;

  if (!meta.alignsToWeeks) return calendarPeriod(on, c, meta);

  const lengthDays = meta.weeks * 7;
  const anchorEnd = utcDate(c.anchorDate);

  // How far `on` is past an anchor period end, in whole periods. Floor division
  // that works for negative numbers too — a date before the anchor is a real
  // case the moment a company back-dates a run.
  const diff = Math.round((on.getTime() - anchorEnd.getTime()) / DAY_MS);
  const periodsAfter = Math.ceil(diff / lengthDays);
  const end = addDays(anchorEnd, periodsAfter * lengthDays);
  const start = addDays(end, -(lengthDays - 1));

  return {
    start,
    end,
    payDate: payDateFor(end, c),
    frequency: c.frequency,
    alignsToWeeks: true,
    weeks: meta.weeks,
  };
}

/** 1st–15th and 16th–end of month, or the whole month. */
function calendarPeriod(on, c, meta) {
  const y = on.getUTCFullYear();
  const m = on.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

  let start;
  let end;
  if (c.frequency === "semimonthly" && on.getUTCDate() > 15) {
    start = new Date(Date.UTC(y, m, 16));
    end = new Date(Date.UTC(y, m, lastDay));
  } else if (c.frequency === "semimonthly") {
    start = new Date(Date.UTC(y, m, 1));
    end = new Date(Date.UTC(y, m, 15));
  } else {
    start = new Date(Date.UTC(y, m, 1));
    end = new Date(Date.UTC(y, m, lastDay));
  }

  return {
    start,
    end,
    payDate: payDateFor(end, c),
    frequency: c.frequency,
    // Said out loud rather than left for someone to discover: a calendar
    // period splits weeks, and buildPayRun's weekly overtime threshold is
    // computed on the partial weeks that fall inside it.
    alignsToWeeks: false,
    weeks: null,
  };
}

/**
 * The period the company is IN — the one still open — and the last one closed.
 *
 * "Current" is the period containing today. The one before it has closed but
 * may not have been paid yet, which is exactly the period a payroll screen
 * should be offering to run.
 */
export function currentPayPeriod(cycle, today) {
  const now = utcDate(today);
  if (!now) return null;
  const current = payPeriodFor(now, cycle);
  if (!current) return null;
  const previous = payPeriodFor(addDays(current.start, -1), cycle);
  return { current, previous };
}

/**
 * How far through the open period we are, for a progress line on a pay page.
 * Clamped, because a company that changes its cadence mid-period can put today
 * outside the period that was open a moment ago.
 */
export function periodProgress(period, today) {
  const now = utcDate(today);
  if (!period || !now) return 0;
  const total = Math.round((period.end - period.start) / DAY_MS) + 1;
  const done = Math.round((now - period.start) / DAY_MS) + 1;
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, done / total));
}

/** One plain sentence a settings screen can print back at the user. */
export function describePayCycle(cycle) {
  const c = resolvePayCycle(cycle);
  const meta = own(PAY_FREQUENCIES, c.frequency) || PAY_FREQUENCIES.biweekly;
  const gap = reviewDays(c);
  if (!meta.alignsToWeeks) {
    return (
      `${meta.label}, paid the first ${DAY_NAMES[c.payDayOfWeek]} after the ` +
      `period ends.`
    );
  }
  return (
    `${meta.label}. The period closes ${DAY_NAMES[c.periodEndDayOfWeek]} and ` +
    `everyone is paid the ${DAY_NAMES[c.payDayOfWeek]} after — ${gap} day` +
    `${gap === 1 ? "" : "s"} to approve hours.`
  );
}
