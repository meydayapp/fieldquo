// lib/org/availability.js
//
// Is this person away? The predicate `approverFor` has always taken and nobody
// ever supplied.
//
// ── What counts as away ─────────────────────────────────────────────────────
//
// An APPROVED LeaveRequest covering the day in question, and nothing else.
// Pending is not away — asking for next Tuesday off does not stop you approving
// somebody else's holiday today, and a pending request that routed past its own
// approver would be circular. Declined and cancelled obviously do not count;
// they are the two states that exist precisely to say "this is not happening",
// and treating them as absence would hand approval to an owner every time
// somebody withdrew a request.
//
// ── Which day ───────────────────────────────────────────────────────────────
//
// The day the routing is being computed on — today — NOT the first day of the
// leave being requested. The argument is in `leaveRouting.js` where the caller
// picks it, because it is a routing decision, not a date-maths one.
//
// ── Half days ───────────────────────────────────────────────────────────────
//
// A half day counts as away. We do not store WHICH half, so the alternative is
// to guess, and the two guesses are not equally cheap: routing to somebody who
// turns out to be unreachable leaves the request sitting, while escalating past
// somebody who was in after lunch costs nothing at all — they are still allowed
// to approve it (see rule 3 in reportingLine.js). Escalation decides who a
// request waits on, so erring towards "away" errs towards it getting answered.
//
// Deliberately free of imports so it can be executed directly against
// constructed data — the leave arithmetic in lib/leave/accrual.js is pure for
// the same reason, and these two are the files where being wrong is expensive.

const MS_DAY = 24 * 60 * 60 * 1000;

// Only this one. Written as a set rather than an equality check so that adding
// a future status (a leave request in "approved, pending payroll", say) is a
// one-line decision made HERE, rather than a comparison quietly rotting.
const AWAY_STATUSES = new Set(["approved"]);

/**
 * Midnight UTC for a date-like value, or null when it isn't a plausible date.
 *
 * `new Date(null)` and `new Date(0)` are both the epoch rather than invalid, so
 * a null endDate would otherwise silently mean "away on 1 Jan 1970" — harmless
 * — while a null START date would mean "away since 1970", which reads as away
 * forever. Nobody books leave before 2000, so anything that old is a bug
 * upstream and is rejected rather than interpreted. (lib/leave/accrual.js
 * applies the same rule to the same columns; it keeps its copy private, and
 * hoisting it into a shared module would mean editing a file this change does
 * not otherwise touch.)
 */
export function utcDay(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  if (d.getUTCFullYear() < 2000) return null;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * The instant range covering one calendar day in UTC, for a database `where`.
 *
 * Exported so the query and the pure check apply ONE definition of "this day".
 * Leave is stored as midnight-UTC calendar days, but a row written by an older
 * path could carry a time component, so the query asks for overlap with the
 * whole day rather than equality with its start.
 *
 * @returns {{start:Date, end:Date}|null}
 */
export function dayBounds(when) {
  const day = utcDay(when);
  if (day == null) return null;
  return { start: new Date(day), end: new Date(day + MS_DAY - 1) };
}

/**
 * Does this leave request make its worker unavailable on `when`?
 *
 * @param leave {status, startDate, endDate} — extra fields ignored
 */
export function coversDay(leave, when) {
  if (!leave || typeof leave !== "object") return false;
  if (!AWAY_STATUSES.has(leave.status)) return false;

  const start = utcDay(leave.startDate);
  const end = utcDay(leave.endDate);
  const day = utcDay(when);
  if (start == null || end == null || day == null) return false;

  // An inverted range is a broken row, not a range that wraps around the world.
  // Silently swapping the ends would invent an absence nobody booked; the
  // honest reading of "we can't tell what this row means" is "not away", which
  // routes to the direct manager and leaves everyone above still able to act.
  if (end < start) return false;

  return day >= start && day <= end;
}

/**
 * An `isAway` predicate for `approverFor`, built from leave rows.
 *
 * @param leaveRequests rows with {workerId, status, startDate, endDate}
 * @param when          the day to judge availability on
 * @returns {{isAway:(id:string)=>boolean, awayIds:Set<string>, day:Date|null}}
 */
export function buildAwayLookup(leaveRequests, when) {
  const day = utcDay(when);
  const awayIds = new Set();

  // An unreadable reference date means we know nothing about who is away.
  // Nobody-is-away is the safe answer: it routes to the direct manager, which
  // is the behaviour before this file existed.
  if (day != null) {
    const rows = Array.isArray(leaveRequests) ? leaveRequests : [];
    for (const row of rows) {
      const id = typeof row?.workerId === "string" ? row.workerId : null;
      if (!id) continue;
      if (coversDay(row, day)) awayIds.add(id);
    }
  }

  return {
    awayIds,
    day: day == null ? null : new Date(day),
    isAway: (id) => awayIds.has(id),
  };
}
