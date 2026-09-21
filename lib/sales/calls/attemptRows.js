// lib/sales/calls/attemptRows.js
//
// The two facts about a SalesCallAttempt row that every calls module needs
// before it counts anything: did FieldQuo place it, and what became of the
// callbacks on it.
//
// ══ Why these left reporting.js ═══════════════════════════════════════════
//
// On 2026-09-21 the floor board started reading lib/sales/calls/dialTable.js
// — the four measured buckets the performance page prints — through
// repCallStats, so the two screens draw ONE definition. dialTable.js already
// imported isOutbound and callbackState from reporting.js, and reporting.js
// importing dialTable.js back would have been the cycle
// lib/sales/performanceReport.js's header refuses: it works while every
// export is a hoisted function declaration and breaks the day one becomes a
// const. So the two functions dialTable.js needs live one level down, here,
// with no import of their own, and reporting.js re-exports them so every
// existing caller keeps its import.
//
// Pure. No `@/lib/db`.

/** A Date from whatever the row carries, or null — never Invalid Date. */
export function when(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Is `at` inside [from, to]? A missing bound is open; an unreadable `at` is out. */
export function inRange(at, from, to) {
  const d = when(at);
  if (!d) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

/**
 * Did FieldQuo place this call?
 *
 * ══ Why every count of WORK filters on this ═══════════════════════════════
 *
 * SalesCallAttempt holds both directions now — app/api/rep-dial/inbound writes
 * a row when a contractor rings a sales_voice number back. A contractor
 * ringing three times is three rows in the same table as three dials, and a
 * `dials` figure computed over the lot would report a rep as having worked
 * calls they never placed. It would flatter exactly the rep whose prospects
 * chase them, which is the wrong direction for a coaching number to lie in.
 *
 * Anything OTHER than the literal "in" counts as outbound, deliberately: rows
 * written before the column had a second value carry the "out" default, and a
 * row with an unreadable direction is far more likely to be an old dial than a
 * callback. Failing that way round undercounts nothing.
 */
export function isOutbound(row) {
  return row?.direction !== "in";
}

/**
 * Callbacks: booked, still ahead, and overdue.
 *
 * "Kept" is deliberately NOT here. Keeping a callback means dialling the same
 * number again after the promised time, and while two Prospect rows may share
 * one number (dedupe flags rather than merges) that match is a heuristic, not
 * a fact. What IS a fact is that a callback time has passed and no later
 * attempt to that number exists — that is `overdue`, it is exactly what a rep
 * needs to see, and it makes no claim about intent.
 */
export function callbackState(attempts, now = new Date()) {
  if (!Array.isArray(attempts)) return null;
  const at = when(now) || new Date();

  // Latest dial per number, so "was there a later call" is one lookup.
  const latestByNumber = new Map();
  for (const row of attempts) {
    const d = when(row?.dialledAt);
    const num = typeof row?.toE164 === "string" ? row.toE164 : null;
    if (!d || !num) continue;
    const prev = latestByNumber.get(num);
    if (!prev || d > prev) latestByNumber.set(num, d);
  }

  const upcoming = [];
  const overdue = [];
  for (const row of attempts) {
    const due = when(row?.callbackAt);
    if (!due) continue;
    const num = typeof row?.toE164 === "string" ? row.toE164 : null;
    if (due > at) {
      upcoming.push({ attemptId: row.id ?? null, toE164: num, dueAt: due });
      continue;
    }
    const latest = num ? latestByNumber.get(num) : null;
    // A later dial to the same number is the only evidence available that the
    // callback was acted on. Absence of it is what puts the row on the list.
    if (!latest || latest <= when(row.dialledAt)) {
      overdue.push({ attemptId: row.id ?? null, toE164: num, dueAt: due });
    }
  }

  upcoming.sort((x, y) => x.dueAt - y.dueAt);
  overdue.sort((x, y) => x.dueAt - y.dueAt);
  return { booked: upcoming.length + overdue.length, upcoming, overdue };
}
