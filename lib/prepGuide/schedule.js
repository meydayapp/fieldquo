// lib/prepGuide/schedule.js
//
// WHEN a job's preparation guide goes out, and why it might not. Pure — no
// database, no clock of its own — so scripts/check-prep-guide.mjs can run it
// against every case with a fixed `now`.
//
// ── The rule ────────────────────────────────────────────────────────────────
//
// N days before Job.startDate, where N is Company.prepGuideLeadDays (3 by
// default, 0 = the morning of the start date). "Before" is by calendar day:
// Job.startDate is a date-only value stored at UTC midnight (see the schema
// comment on the column and lib/format/companyDate.js), so the due moment is
// midnight UTC on the day N days earlier, and the daily cron that runs after
// that moment sends it.
//
// A job that gets its start date late — booked two days out with N = 3 — is
// already past due on the first run and goes straight out. That is the right
// answer: "three days before" is the latest useful moment, not the only one.
// A job whose start date has already passed is NOT sent: a guide that says
// "before we arrive on Tuesday" arriving on Wednesday reads as a company that
// has lost track of its own calendar.
//
// ── Why every refusal has a name ────────────────────────────────────────────
//
// The job page prints the reason. "Skipped" with no reason is the control
// that appears to work — the office would assume the client got it.

export const DEFAULT_LEAD_DAYS = 3;
export const MAX_LEAD_DAYS = 30;

const DAY = 24 * 60 * 60 * 1000;

/** Company.prepGuideLeadDays as a usable integer, 0..30, default 3. */
export function clampLeadDays(value) {
  if (value === null || value === undefined || value === "") return DEFAULT_LEAD_DAYS;
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_LEAD_DAYS;
  return Math.min(MAX_LEAD_DAYS, Math.max(0, Math.round(n)));
}

/** Midnight UTC of the calendar day `startDate` falls on. */
function dayStartUtc(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** The moment the guide becomes due for this job under this company's rule. */
export function prepGuideDueAt(job, company) {
  const start = job?.startDate ? dayStartUtc(job.startDate) : null;
  if (!start) return null;
  return new Date(start.getTime() - clampLeadDays(company?.prepGuideLeadDays) * DAY);
}

/**
 * Should the guide go out now, and if not, why not.
 *
 * @returns {{ send: boolean, reason: string, dueAt: Date|null }}
 *   reasons: "suppressed" | "already_sent" | "cancelled" | "archived" |
 *            "historical" | "no_start_date" | "no_client_email" |
 *            "started" | "not_yet" | "due"
 */
export function prepGuideDecision({ job, company, client, now = new Date() }) {
  const dueAt = prepGuideDueAt(job, company);
  const out = (send, reason) => ({ send, reason, dueAt });

  if (!job) return out(false, "no_job");
  if (job.prepGuideSuppressedAt) return out(false, "suppressed");
  if (job.prepGuideSentAt) return out(false, "already_sent");
  if (job.status === "cancelled") return out(false, "cancelled");
  if (job.archivedAt) return out(false, "archived");
  if (job.historicalImportedAt) return out(false, "historical");
  if (!dueAt) return out(false, "no_start_date");
  if (!String(client?.email || "").trim()) return out(false, "no_client_email");

  // The start day itself still counts — "0 = the morning of" — but the day
  // after does not.
  const startDay = dayStartUtc(job.startDate);
  if (now.getTime() >= startDay.getTime() + DAY) return out(false, "started");
  if (now.getTime() < dueAt.getTime()) return out(false, "not_yet");
  return out(true, "due");
}

/**
 * The cron's candidate window, so it reads a bounded set rather than every
 * job in the database: start dates from yesterday (a job on its start day is
 * still sendable until midnight) out to the longest lead the setting allows.
 */
export function candidateStartWindow(now = new Date()) {
  const today = dayStartUtc(now);
  return {
    gte: new Date(today.getTime() - DAY),
    lte: new Date(today.getTime() + (MAX_LEAD_DAYS + 1) * DAY),
  };
}
