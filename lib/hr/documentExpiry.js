// lib/hr/documentExpiry.js
//
// Which of a company's people are carrying paper that is about to lapse —
// the forklift ticket, the driver's licence, the first-aid card.
//
// ══ One rule, borrowed, not copied ═════════════════════════════════════════
//
// lib/expiry/window.js is the same question asked about a homeowner's
// warranty and a van's insurance, and its one rule applies unchanged here:
//
//   A MISSING DATE IS "unknown". IT IS NEVER "expired".
//
// A certificate filed without a date is a gap in the record, not a lapsed
// worker. The badge says "no expiry recorded"; nobody is pulled off a site
// over a blank field.
//
// ══ Two reminders, three marks ═════════════════════════════════════════════
//
// The person is told at 30 days and again at 7; their manager is told at 7.
// Thirty is the shape of a renewal — long enough to book a course; seven is
// "this week". The cron stamps reminded30At / reminded7At on the row so a
// day it runs twice, or a document that sits at 12 days for a week, produces
// one message per mark, not one per morning. Which mark is due is decided
// HERE, pure, so the check script can run a document through every day of
// its last five weeks and count the messages.
import {
  EXPIRY_STATES,
  DEFAULT_SOON_DAYS,
  expiryState,
  needsAttention,
  byUrgency,
} from "@/lib/expiry/window";
import { EXPIRING_KINDS, REMINDER_DAYS } from "@/lib/hr/documents";

export { EXPIRY_STATES, DEFAULT_SOON_DAYS };

/** One document's standing. Archived rows are the caller's to exclude. */
export function documentExpiry(doc, { asOf, soonDays = DEFAULT_SOON_DAYS } = {}) {
  const s = expiryState(doc?.expiresAt, { asOf, soonDays });
  return { state: s.state, endsAt: s.endsAt, daysRemaining: s.daysRemaining, known: s.known };
}

/**
 * The documents worth a line on the compliance screen: expired or due within
 * the window, most urgent first. Archived rows never appear — an archived
 * ticket is one the company has replaced or stopped caring about.
 */
export function expiringDocuments(documents, { asOf, soonDays = DEFAULT_SOON_DAYS } = {}) {
  const rows = (documents || [])
    .filter((d) => d && !d.archivedAt)
    .map((d) => ({ ...d, ...documentExpiry(d, { asOf, soonDays }) }))
    .filter((d) => needsAttention(d.state));
  return byUrgency(rows);
}

/**
 * Which reminder, if any, a document is due today.
 *
 * @returns {{ worker: 30|7|null, manager: 7|null }} — the mark to fire for
 *   each side, or null when nothing is due. A mark already stamped is never
 *   fired again. A document filed already inside the 30-day window (at 20
 *   days, say) gets the first mark on the next run — the sentence carries
 *   the REAL day count, so it is "expires in 20 days", not "30".
 */
export function reminderDue(doc, { asOf } = {}) {
  const out = { worker: null, manager: null };
  if (!doc || doc.archivedAt || !EXPIRING_KINDS.has(doc.kind)) return out;
  const { known, daysRemaining } = documentExpiry(doc, { asOf });
  if (!known || daysRemaining < 0) return out;

  const [w30, w7] = REMINDER_DAYS.worker;
  if (daysRemaining <= w7 && !doc.reminded7At) out.worker = w7;
  else if (daysRemaining <= w30 && daysRemaining > w7 && !doc.reminded30At) out.worker = w30;

  const [m7] = REMINDER_DAYS.manager;
  // The manager's 7-day mark shares the worker's reminded7At stamp: both
  // fire from the same morning's run, and one stamp means one decision.
  if (daysRemaining <= m7 && !doc.reminded7At) out.manager = m7;
  return out;
}

/** The stamp to write once a reminder has gone out. */
export function stampForReminder(due, now = new Date()) {
  const data = {};
  if (due.worker === 30) data.reminded30At = now;
  if (due.worker === 7 || due.manager === 7) data.reminded7At = now;
  return data;
}
