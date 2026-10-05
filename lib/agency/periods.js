// lib/agency/periods.js
//
// The periods the agency's dashboard offers, and the previous equal period
// each is compared with. Pure.
//
// ══ UTC calendar days ══════════════════════════════════════════════════════
//
// Same axis as lib/analytics/periodPresets.js and lib/analytics/dayRange.js:
// every analytics range in FieldQuo is decided on UTC calendar days, so the
// API, the internal page and the KPI screen agree about the same "October".
// A period that is still running ("this month") ends at the end of TODAY, not
// at the end of the month — there is nothing yet in the days to come, and a
// cost per lead divided across days that have not happened is not a number.
//
// ══ The previous equal period ══════════════════════════════════════════════
//
// The span of the same LENGTH immediately before — the comparison ad
// platforms use. "This month" on 5 October (five days) is compared with 26–30
// September, not with all of September: comparing five days with thirty would
// make every count look like a collapse. "Last month" (all of September, 30
// days) is compared with the 30 days before it.
//
// Weeks start on Monday (ISO 8601). Company.weekStartsOn is not read: nothing
// in analytics reads it yet (lib/analytics/dayRange.js says why a helper that
// half-did would make two reports disagree), and the agency compares one
// company against itself, so a fixed rule is the one that is never wrong
// between two calls.

const DAY = 24 * 60 * 60 * 1000;

export const PERIOD_KEYS = Object.freeze([
  "today",
  "yesterday",
  "thisWeek",
  "lastWeek",
  "thisMonth",
  "lastMonth",
  "thisQuarter",
  "lastQuarter",
  "thisYear",
  "lastYear",
  "custom",
]);

const utcDay = (y, m, d) => new Date(Date.UTC(y, m, d));
const endOfDay = (d) => new Date(d.getTime() + DAY - 1);
const iso = (d) => d.toISOString().slice(0, 10);
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDay(value) {
  if (typeof value !== "string" || !DAY_RE.test(value.trim())) return null;
  const d = new Date(`${value.trim()}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || iso(d) !== value.trim() ? null : d;
}

/**
 * @param {object} p
 * @param {string} [p.period]  one of PERIOD_KEYS; "custom" when from/to given
 * @param {string} [p.from]    YYYY-MM-DD, inclusive (custom)
 * @param {string} [p.to]      YYYY-MM-DD, inclusive (custom)
 * @param {Date}   [p.now]
 * @returns {{ ok: true, key, from: Date, to: Date, fromDay, toDay, days }
 *          | { ok: false, error: string }}
 */
export function resolvePeriod({ period = null, from = null, to = null, now = new Date() } = {}) {
  const key = period || (from || to ? "custom" : "thisMonth");
  if (!PERIOD_KEYS.includes(key)) return { ok: false, error: `Unknown period "${key}". Use one of: ${PERIOD_KEYS.join(", ")}.` };
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = utcDay(y, m, now.getUTCDate());
  let start;
  let end;
  switch (key) {
    case "today":
      start = today;
      end = endOfDay(today);
      break;
    case "yesterday":
      start = new Date(today.getTime() - DAY);
      end = endOfDay(start);
      break;
    case "thisWeek":
    case "lastWeek": {
      const dow = (today.getUTCDay() + 6) % 7; // Monday = 0
      const monday = new Date(today.getTime() - dow * DAY);
      start = key === "thisWeek" ? monday : new Date(monday.getTime() - 7 * DAY);
      end = key === "thisWeek" ? endOfDay(today) : new Date(monday.getTime() - 1);
      break;
    }
    case "thisMonth":
      start = utcDay(y, m, 1);
      end = endOfDay(today);
      break;
    case "lastMonth":
      start = utcDay(y, m - 1, 1);
      end = new Date(utcDay(y, m, 1).getTime() - 1);
      break;
    case "thisQuarter": {
      const q = Math.floor(m / 3) * 3;
      start = utcDay(y, q, 1);
      end = endOfDay(today);
      break;
    }
    case "lastQuarter": {
      const q = Math.floor(m / 3) * 3;
      start = utcDay(y, q - 3, 1);
      end = new Date(utcDay(y, q, 1).getTime() - 1);
      break;
    }
    case "thisYear":
      start = utcDay(y, 0, 1);
      end = endOfDay(today);
      break;
    case "lastYear":
      start = utcDay(y - 1, 0, 1);
      end = new Date(utcDay(y, 0, 1).getTime() - 1);
      break;
    case "custom": {
      const f = parseDay(from);
      const t = parseDay(to);
      if (!f || !t) return { ok: false, error: "A custom period needs from and to as YYYY-MM-DD." };
      if (f.getTime() > t.getTime()) return { ok: false, error: "from must not be after to." };
      // Two years is plenty for a marketing comparison and bounds the work
      // one call can ask for.
      if (t.getTime() - f.getTime() > 731 * DAY) return { ok: false, error: "A custom period can be at most two years long." };
      start = f;
      end = endOfDay(t);
      break;
    }
    default:
      return { ok: false, error: "Unknown period." };
  }
  const days = Math.round((end.getTime() + 1 - start.getTime()) / DAY);
  return { ok: true, key, from: start, to: end, fromDay: iso(start), toDay: iso(end), days };
}

/** The span of the same length immediately before `range`. */
export function previousPeriod(range) {
  const length = range.to.getTime() + 1 - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(range.from.getTime() - length);
  return { key: "previous", from, to, fromDay: iso(from), toDay: iso(to), days: range.days };
}

/** A Prisma date filter for a range. */
export function rangeFilter(range) {
  return { gte: range.from, lte: range.to };
}
