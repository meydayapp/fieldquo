// lib/jobs/visitDates.js
//
// Booking a visit gives the job its dates — without ever moving a date a
// person set.
//
// ══ Why (owner, 2026-10-04) ═════════════════════════════════════════════════
//
// A job's own start and end (Job.startDate / endDate) are what three things
// read: the "Needs a date" banner, the payment schedule's date triggers
// (lib/paymentSchedule/run.js resolveStageDueDate, re-derived by the cron on
// every run) and the client preparation guide (lib/prepGuide/schedule.js —
// N days before the start). A job booked only by its visits had none of them:
// the status flipped to "scheduled" (POST .../visits), but the deposit "on
// start" never got a date and the prep guide never went. "Booking a visit
// should give the job its dates."
//
// ══ The rule ════════════════════════════════════════════════════════════════
//
//   * The START is the calendar day of the EARLIEST visit that is not
//     cancelled; the END is the day of the LAST one. Days are the COMPANY's
//     calendar day (Company.timezone), stored at UTC midnight — the shape
//     every date-only column here has (lib/prepGuide/schedule.js says so).
//   * Only a field that is EMPTY, or that FieldQuo itself filled from the
//     visits (Job.startDateFromVisits / endDateFromVisits), is ever written.
//     A date a person typed is theirs: it is never moved, never cleared.
//   * While a field is FieldQuo's, it follows the visits: a visit booked
//     earlier moves the start, one booked later moves the end, a visit
//     rescheduled or cancelled re-derives both, and with no visit left the
//     derived value is cleared — it was only ever the visits' statement.
//   * The moment a person changes a date (PATCH /api/jobs/[id] with a value
//     that differs from what is stored), that field becomes theirs and the
//     flag goes false. Re-saving the edit form with the same dates leaves the
//     flag alone — sending back what was on screen is not a decision.
//   * A RECURRING job (a weekly clean) gets a start and no end: it has no
//     last visit — the next one is created as each is completed
//     (lib/jobs/recurrence.js) — so an end that walked forward every week
//     would be a date that is never true. (So recurrence.js, which only ever
//     adds a LATER visit to such a job, has nothing to re-derive.)
//   * Never an invalid pair (lib/jobs/validateJobDates.js): no end without a
//     start, no end before the start, no span over 366 days. Where following
//     the visits would break one of those against a person's date, the
//     visits' side is left as it was instead.
//
// ══ Why a flag and not a comparison ════════════════════════════════════════
//
// "Is the stored start equal to the first visit's day?" cannot tell a date
// FieldQuo derived from one a person typed that happens to match — and the
// person's must not move when a second, earlier visit is booked. Two booleans
// are the only honest record of who set it. Additive columns, default false,
// so every existing date reads as a person's and nothing already on a job
// changes.
//
// derivedJobDates() is PURE (scripts/check-job-visit-dates.mjs executes it
// against hostile input); syncJobDatesFromVisits() reads and writes.

import { validateJobDates } from "./validateJobDates";

const CANCELLED = new Set(["cancelled", "canceled"]);

function calendarParts(date, timeZone) {
  const zone = timeZone || "UTC";
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return { year: Number(p.year), month: Number(p.month), day: Number(p.day) };
  } catch {
    // An unknown zone reads the UTC calendar rather than throwing — the same
    // fall-back lib/marketing/videoAllowance.js takes for a bad zone.
    return calendarParts(date, "UTC");
  }
}

/** The company-local calendar day an instant falls on, at UTC midnight. PURE. */
export function visitDay(scheduledAt, timeZone) {
  const d = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(d.getTime())) return null;
  const { year, month, day } = calendarParts(d, timeZone);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

const time = (d) => (d instanceof Date ? d.getTime() : d ? new Date(d).getTime() : null);
const sameDay = (a, b) => (a == null && b == null) || (a != null && b != null && time(a) === time(b));

/**
 * What the job's dates should become, given its visits. PURE.
 *
 * @param job     { startDate, endDate, startDateFromVisits, endDateFromVisits }
 * @param visits  [{ scheduledAt, status }]
 * @param timeZone the company's zone
 * @returns {{ data: object|null, start: Date|null, end: Date|null }}
 *   `data` is the Prisma update for the fields that change (null when none).
 */
export function derivedJobDates({ job, visits = [], timeZone = null }) {
  const days = (Array.isArray(visits) ? visits : [])
    .filter((v) => v && !CANCELLED.has(String(v.status || "")))
    .map((v) => visitDay(v.scheduledAt, timeZone))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const first = days[0] || null;
  const last = job?.recurring ? null : days[days.length - 1] || null;

  const curStart = job?.startDate ? new Date(job.startDate) : null;
  const curEnd = job?.endDate ? new Date(job.endDate) : null;
  // A field is FieldQuo's to write when it is empty or FieldQuo filled it.
  const startOurs = !curStart || job?.startDateFromVisits === true;
  const endOurs = !curEnd || job?.endDateFromVisits === true;

  let start = startOurs ? first : curStart;
  let end = endOurs ? last : curEnd;

  // ── Never an invalid pair; the visits' side gives way ────────────────────
  if (end && !start) {
    // Only reachable with a person's end and a derived start cleared by the
    // last visit going: keep the start that was there.
    start = curStart;
  }
  if (start && end && end < start) {
    if (endOurs) end = null; // a person's start after every visit: no derived end
    else if (startOurs) start = curStart && curStart <= end ? curStart : null; // a person's end before the visits
  }
  if (end && !start) end = endOurs ? null : end;
  if (!validateJobDates({ startDate: start, endDate: end }).ok) {
    // A span over a year (a visit booked on the wrong year, a person's far
    // end): change nothing rather than write what the edit form would refuse.
    return { data: null, start: curStart, end: curEnd };
  }

  const data = {};
  if (startOurs && !sameDay(start, curStart)) data.startDate = start;
  if (endOurs && !sameDay(end, curEnd)) data.endDate = end;
  const startFlag = startOurs ? Boolean(start) : false;
  const endFlag = endOurs ? Boolean(end) : false;
  if (startFlag !== (job?.startDateFromVisits === true)) data.startDateFromVisits = startFlag;
  if (endFlag !== (job?.endDateFromVisits === true)) data.endDateFromVisits = endFlag;
  return { data: Object.keys(data).length ? data : null, start, end };
}

/**
 * The flags a person's PATCH leaves behind. PURE.
 *
 * A field the request SENT with a value different from what is stored is the
 * person's from now on (flag false). Sent unchanged — the edit form posts both
 * dates on every save — or not sent: the flag is untouched.
 */
export function personDateFlags({ existing, sentStart, sentEnd, nextStart, nextEnd }) {
  const out = {};
  if (sentStart !== undefined && !sameDay(nextStart, existing?.startDate) && existing?.startDateFromVisits) out.startDateFromVisits = false;
  if (sentEnd !== undefined && !sameDay(nextEnd, existing?.endDate) && existing?.endDateFromVisits) out.endDateFromVisits = false;
  return out;
}

/**
 * Re-derive and write a job's dates from its visits. Best-effort: a failure
 * here must not fail the visit booking that triggered it.
 *
 * @returns the update written, or null
 */
export async function syncJobDatesFromVisits(jobId, { prisma } = {}) {
  const client = prisma || (await import("@/lib/db")).db;
  if (!jobId) return null;
  const job = await client.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      startDateFromVisits: true,
      endDateFromVisits: true,
      recurring: true,
      company: { select: { timezone: true } },
      visits: { select: { scheduledAt: true, status: true } },
    },
  });
  if (!job) return null;
  const { data } = derivedJobDates({ job, visits: job.visits, timeZone: job.company?.timezone || null });
  if (!data) return null;
  await client.job.update({ where: { id: jobId }, data });
  return data;
}

