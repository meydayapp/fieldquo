// lib/appointments/outcome.js
//
// What became of an appointment once its time has passed: held, a no-show,
// rescheduled, or cancelled. Pure.
//
// ══ Why there is an outcome at all (2026-10-05) ════════════════════════════
//
// The owner wants reply speed and no-shows tracked — "those show where the
// lost money is" — and FieldQuo could not say either about a visit: an
// appointment was scheduled, completed or cancelled, and a visit nobody
// turned up to stayed "scheduled" for ever. The agency metrics reported it as
// "unmarked", honestly, because nothing recorded the difference.
//
// ══ Reuse first ════════════════════════════════════════════════════════════
//
// Held IS `completed` and cancelled IS `cancelled` — the statuses the
// calendar's "Mark complete" and "Cancel visit" already write. Only the two
// facts nothing could record are new AppointmentStatus values: `no_show` and
// `rescheduled` (the visit did not happen at that time and was booked again —
// the new time is its own appointment, so this one stays a fact about the day
// rather than being moved over it).
//
// ══ An outcome is not a cancellation ═══════════════════════════════════════
//
// Marking a PAST visit cancelled tells nobody anything: the client is not
// sent a "your visit is cancelled" letter about a day that is over. So an
// outcome is its own route (app/api/appointments/[id]/outcome), never the
// office's PATCH, whose cancel writes to the client.
//
// ══ Who may mark it ════════════════════════════════════════════════════════
//
// The person it is assigned to, or someone who edits everyone's schedule —
// the PATCH route's own rule. A crew member marks their own visits only;
// an unassigned visit is marked by the office.

/** The outcome a person picks → the AppointmentStatus it is stored as. */
export const OUTCOME_STATUS = Object.freeze({
  held: "completed",
  no_show: "no_show",
  rescheduled: "rescheduled",
  cancelled: "cancelled",
});

export const OUTCOMES = Object.freeze(Object.keys(OUTCOME_STATUS));

/** The statuses that say the visit's outcome is not recorded yet. */
export const OPEN_STATUSES = Object.freeze(["scheduled", "needs_supervisor"]);

/** How long after its start a visit counts as over, for the nudge. */
export const ENDED_AFTER_MS = 2 * 60 * 60 * 1000;
/**
 * How far back the daily nudge looks. Bounded so the first run after this
 * shipped does not ask about every visit a company ever forgot to close —
 * a week of "did this happen?" is a question; three years is noise.
 */
export const NUDGE_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

const time = (d) => (d ? new Date(d).getTime() : NaN);

/** The stored status → the outcome it records, or null when none is. Pure. */
export function outcomeOfStatus(status) {
  for (const [outcome, s] of Object.entries(OUTCOME_STATUS)) if (s === status) return outcome;
  return null;
}

/** Has the visit's time come? An outcome is only for one that has. Pure. */
export function isPast(appt, now = new Date()) {
  const at = time(appt?.scheduledAt);
  return Number.isFinite(at) && at <= now.getTime();
}

/** Past, and nobody has said what happened. Pure. */
export function needsOutcome(appt, now = new Date()) {
  return Boolean(appt && OPEN_STATUSES.includes(appt.status) && isPast(appt, now));
}

/**
 * May this person record this visit's outcome? Pure.
 *
 * @param appt        { scheduledAt, status, assignedToId }
 * @param userId      the caller's user id
 * @param hasEditAll  schedule "edit_all" — sees and edits everyone's schedule
 * @returns {{ ok: true } | { ok: false, reason: "not_yours"|"not_yet"|"bad_outcome" }}
 */
export function mayMarkOutcome({ appt, outcome, userId = null, hasEditAll = false, now = new Date() }) {
  if (!OUTCOMES.includes(outcome)) return { ok: false, reason: "bad_outcome" };
  const mine = Boolean(userId) && appt?.assignedToId === userId;
  if (!mine && !hasEditAll) return { ok: false, reason: "not_yours" };
  if (!isPast(appt, now)) return { ok: false, reason: "not_yet" };
  return { ok: true };
}

/**
 * Who is asked "Did this visit happen?": the person it is assigned to, else
 * whoever booked it. Never a list — it is one person's day. Pure.
 */
export function nudgeRecipient(appt) {
  return appt?.assignedToId || appt?.createdById || null;
}

/** The window the daily nudge reads: started a week ago at most, over by now. Pure. */
export function nudgeWindow(now = new Date()) {
  return { gte: new Date(now.getTime() - NUDGE_LOOKBACK_MS), lte: new Date(now.getTime() - ENDED_AFTER_MS) };
}

/** "Mon, Oct 5, 10:00 AM" in the reader's language and the company's zone — the nudge's {when}. Pure. */
export function visitWhen(at, { language = "en", timeZone = "America/Toronto" } = {}) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(language, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

/**
 * Which of these appointments get the nudge today: open, inside the window,
 * someone to ask, and not asked before (`asked` — the ids a nudge already
 * went out for). One nudge per visit, not one a day: a question repeated
 * daily stops being read. Pure.
 */
export function dueForNudge(appts, { now = new Date(), asked = new Set() } = {}) {
  const w = nudgeWindow(now);
  return (Array.isArray(appts) ? appts : []).filter((a) => {
    if (!a || !OPEN_STATUSES.includes(a.status)) return false;
    const at = time(a.scheduledAt);
    if (!Number.isFinite(at) || at < w.gte.getTime() || at > w.lte.getTime()) return false;
    if (asked.has(a.id)) return false;
    return Boolean(nudgeRecipient(a));
  });
}
