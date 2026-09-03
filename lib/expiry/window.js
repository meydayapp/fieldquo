// lib/expiry/window.js
//
// "Is this still covered, and for how much longer?" — asked four times over
// two features, and answered once here.
//
// ══ Why one module rather than a copy in each ══════════════════════════════
//
// A warranty on a homeowner's furnace, a van's insurance certificate, its
// registration and its next service date are the same question with different
// nouns. AGENTS.md failure class #4 is the copy that rots because it is the
// one nobody looks at, and the two features were briefed as "the same shape
// and should feel like it" — so the shape is a module, not a convention.
//
// ══ THE RULE THIS FILE EXISTS TO ENFORCE ═══════════════════════════════════
//
//   A MISSING DATE IS "unknown". IT IS NEVER "expired".
//
// This is not a nicety. `ClientEquipment.warrantyEndsAt` is nullable and its
// schema comment says why: nobody typed a date, so nobody made a claim. A
// blank rendered as "out of warranty" turns a renewal call into an insult, and
// on a van it turns "we never recorded the insurance renewal" into "that van
// is off the road" — two different sentences with two different consequences.
//
// The same rule covers a date that will not parse. A corrupt value is an
// absence of information, not a statement that cover has lapsed, so it lands
// on `unknown` too rather than on the alarming end of the scale.
//
// AGENTS.md failure class #5 is padding absent data with defaults; treating
// null as expired is that failure pointed at a customer.

/**
 * The four answers, and the only four.
 *
 * `expired` is deliberately the word for a date in the past on all four
 * subjects, including a service that is overdue — one vocabulary means one
 * badge component, one sort order and one translation key set across both
 * features. Callers that want a kinder noun ("overdue" for a service)
 * translate at the edge; the state itself stays comparable.
 */
export const EXPIRY_STATES = Object.freeze({
  UNKNOWN: "unknown",
  OK: "ok",
  DUE_SOON: "due_soon",
  EXPIRED: "expired",
});

/**
 * How far ahead "soon" looks, in days.
 *
 * Thirty because that is the shape of the commercial act this feature exists
 * to serve: a month is long enough to ring a homeowner, quote the renewal and
 * book it, and short enough that the list is a call list rather than an
 * archive. Callers may pass their own.
 */
export const DEFAULT_SOON_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight UTC of the day a Date falls on. */
function startOfUtcDay(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * A Date, or null when the input is not one.
 *
 * Accepts a Date (what Prisma hands back), an ISO string (what a browser
 * sends) and a number. Everything else — including `""`, which is what an
 * emptied date input POSTs — is null, because it is an absence.
 */
export function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  // A numeric 0 is refused, not read as 1 January 1970. `new Date(0)` is a
  // valid date and nothing in this product means it: a warranty that ended in
  // 1970 is a coerced empty field, and it would render as forty years expired
  // — the exact wrong answer, arrived at by being permissive.
  if (value === 0) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Whole calendar days from `asOf` to `endsAt`, in UTC.
 *
 * Day-boundary rather than millisecond arithmetic, so a certificate that
 * expires at the end of today reads as 0 all day instead of flipping to -1
 * over lunch. 0 therefore means "the last covered day is today", which is
 * still covered.
 */
export function daysUntil(endsAt, asOf) {
  const end = toDate(endsAt);
  const now = toDate(asOf) || new Date();
  if (!end) return null;
  return Math.round((startOfUtcDay(end) - startOfUtcDay(now)) / DAY_MS);
}

/**
 * The state of one date.
 *
 * @param endsAt  the last day cover holds — null/blank/unparseable = unknown
 * @param opts    { asOf, soonDays }
 * @returns {{ state, endsAt: Date|null, daysRemaining: number|null, known: boolean }}
 */
export function expiryState(endsAt, { asOf, soonDays = DEFAULT_SOON_DAYS } = {}) {
  const end = toDate(endsAt);
  // The whole point of the file. No date, no claim.
  if (!end) {
    return {
      state: EXPIRY_STATES.UNKNOWN,
      endsAt: null,
      daysRemaining: null,
      known: false,
    };
  }

  // A hostile or absent window must not silently widen "soon" to everything
  // (Infinity) or narrow it to nothing (NaN compares false, so every future
  // date would read `ok` and the call list would come back empty with no
  // explanation). Fall back to the documented default instead.
  const window =
    Number.isFinite(soonDays) && soonDays >= 0 ? Math.floor(soonDays) : DEFAULT_SOON_DAYS;

  const daysRemaining = daysUntil(end, asOf);
  let state = EXPIRY_STATES.OK;
  if (daysRemaining < 0) state = EXPIRY_STATES.EXPIRED;
  else if (daysRemaining <= window) state = EXPIRY_STATES.DUE_SOON;

  return { state, endsAt: end, daysRemaining, known: true };
}

/** True for the two states that belong on a call list. */
export function needsAttention(state) {
  return state === EXPIRY_STATES.EXPIRED || state === EXPIRY_STATES.DUE_SOON;
}

/**
 * Sort key: most urgent first, unknown LAST.
 *
 * Unknown sorts to the bottom rather than the top on purpose. It is not an
 * alarm — it is a gap in the record — and putting gaps above genuinely lapsed
 * insurance would bury the thing that actually stops a van going out.
 */
export function urgencyRank(state) {
  switch (state) {
    case EXPIRY_STATES.EXPIRED:
      return 0;
    case EXPIRY_STATES.DUE_SOON:
      return 1;
    case EXPIRY_STATES.OK:
      return 2;
    default:
      return 3;
  }
}

/**
 * The worst of several states — what a row's own badge should say.
 *
 * `unknown` never wins over a real state: a van with lapsed insurance and an
 * unrecorded service is a van with lapsed insurance. It only surfaces when
 * there is nothing else to report.
 */
export function worstState(states) {
  let worst = EXPIRY_STATES.UNKNOWN;
  for (const s of states || []) {
    if (urgencyRank(s) < urgencyRank(worst)) worst = s;
  }
  return worst;
}

/**
 * Sort a list of already-stated rows by urgency, then by soonest date.
 *
 * Stable within a rank via the index tiebreak, so two rows expiring the same
 * day keep the order the caller gave them (which is the database's, i.e.
 * deterministic) rather than the engine's.
 */
export function byUrgency(rows, stateOf = (r) => r.state, dateOf = (r) => r.endsAt) {
  return (rows || [])
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const ra = urgencyRank(stateOf(a.row));
      const rb = urgencyRank(stateOf(b.row));
      if (ra !== rb) return ra - rb;
      const da = toDate(dateOf(a.row));
      const db = toDate(dateOf(b.row));
      if (da && db && da.getTime() !== db.getTime()) return da - db;
      if (da && !db) return -1;
      if (!da && db) return 1;
      return a.i - b.i;
    })
    .map(({ row }) => row);
}
