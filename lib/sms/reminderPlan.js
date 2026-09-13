// lib/sms/reminderPlan.js
//
// Which scheduled things get a reminder text on this cron run, and why not.
//
// ── Two sources, one rule ──────────────────────────────────────────────────
//
// The reminder cron read the Appointment table and nothing else, so a crew
// visit scheduled on a job — JobVisit, the row the job page, the calendar and
// the dashboard all count — reminded nobody, while Settings → Notifications
// promised "a reminder before every visit". Both kinds now go through this one
// function with the same window, the same once-only claim and the same
// opt-out gate; the cron only differs in which table it reads and stamps.
//
// Pure. The cron loads the rows; this decides. scripts/check-visit-reminders.mjs
// runs it against a crafted week without Postgres.

/** The Prisma `where` both sources share: due soon, never reminded, opted in. */
export function reminderWindow(now, horizonMs) {
  return {
    reminderSentAt: null,
    scheduledAt: { gt: now, lte: new Date(now.getTime() + horizonMs) },
  };
}

/**
 * @param {object} row  { id, kind, scheduledAt, client: { phone }, company: { appointmentReminderHours } }
 * @param {Date}   now
 * @param {function} toE164
 * @returns {{ send: boolean, reason: "not_yet"|"no_phone"|"cancelled"|"no_lead_time"|null, e164: string|null }}
 */
export function reminderVerdict(row, now, toE164) {
  const hours = Number(row?.company?.appointmentReminderHours);
  // Opt-in only: a company that never set a lead time gets nothing. The query
  // already excludes these; asked again here so the pure verdict is complete.
  if (!Number.isFinite(hours) || hours <= 0) return { send: false, reason: "no_lead_time", e164: null };

  // A visit called off is not a visit to remind anyone of. The appointment
  // query filters on status; a JobVisit's status is a plain string with two
  // spellings of cancelled (lib/jobs/visitStatus.js), so the rule lives here
  // where both kinds pass through it.
  if (["cancelled", "canceled", "completed"].includes(String(row?.status || ""))) {
    return { send: false, reason: "cancelled", e164: null };
  }

  const at = new Date(row?.scheduledAt).getTime();
  const windowStartsAt = at - hours * 60 * 60 * 1000;
  if (!Number.isFinite(at) || now.getTime() < windowStartsAt) {
    return { send: false, reason: "not_yet", e164: null };
  }

  const e164 = toE164(row?.client?.phone);
  if (!e164) return { send: false, reason: "no_phone", e164: null };

  return { send: true, reason: null, e164 };
}
