// lib/timeclock/corrections.js
//
// "Request a correction" — the crew member's way to fix their own hours,
// which changes NOTHING until a manager approves it (owner, 2026-10-03).
// Pure: the rules here are shared by POST /api/time-entries/corrections (the
// request), PATCH /api/time-entries/corrections/[id] (the decision) and
// scripts/check-time-activities.mjs, which executes them.
//
// ── What a correction may say ──────────────────────────────────────────────
//
// A new start and end (always both — a correction states the whole stretch,
// so a reviewer reads "07:00–15:30, was 07:00–open" rather than a delta), and
// optionally a different activity and job. A reason, always: the manager is
// being asked to change pay, and "why" is the first thing they need.
//
// ── What approving does ────────────────────────────────────────────────────
//
// The entry is UPDATED, never replaced or deleted: the same row, so its
// breaks, stamps, approvals and any invoice that bills it stay attached. Its
// hours are recomputed by the one function every close path uses
// (lib/timeclock/entryHours.js), with the entry's breaks and pay rule; a
// changed activity takes the company's current pay rule for that activity,
// exactly as a fresh tap would. What the entry said before is written onto
// the correction in the same transaction (`original`), so the trail survives.
import { entryHours } from "./entryHours.js";
import { checkActivityJob, isWorkActivity, effectiveActivity } from "./activities.js";

const HOUR = 3_600_000;
/** A stretch longer than this is a typo (a date one day off), not a shift. */
export const MAX_CORRECTION_HOURS = 24;
/** Requests reach back this far — a pay period or two, not last year. */
export const MAX_CORRECTION_AGE_DAYS = 45;
export const REASON_MAX = 500;

const toMs = (v) => (v instanceof Date ? v.getTime() : v == null || v === "" ? NaN : new Date(v).getTime());

/**
 * Validate a request against the entry it corrects. Instants already
 * resolved in the company's zone. Returns `{ error }` or the normalised
 * `{ clockIn, clockOut, activity, jobId, reason }` — the entry as it should
 * READ afterwards: the resulting activity and job, stated whether or not
 * they change, so the reviewer and the trail never have to infer "unchanged"
 * from a null.
 */
export function validateCorrection({ entry, clockIn, clockOut, activity = null, jobId, reason, now = new Date() }) {
  if (!entry) return { error: "not_found" };
  const s = toMs(clockIn);
  const e = toMs(clockOut);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return { error: "times_required" };
  if (e <= s) return { error: "end_before_start" };
  if (e - s > MAX_CORRECTION_HOURS * HOUR) return { error: "too_long" };
  const nowMs = toMs(now);
  if (e > nowMs + 5 * 60_000) return { error: "in_future" };
  if (s < nowMs - MAX_CORRECTION_AGE_DAYS * 24 * HOUR) return { error: "too_old" };
  const text = typeof reason === "string" ? reason.trim().slice(0, REASON_MAX) : "";
  if (!text) return { error: "reason_required" };

  let nextActivity = null;
  if (activity != null && activity !== "") {
    if (!isWorkActivity(activity)) return { error: "bad_activity" };
    nextActivity = activity;
  }
  // The job: undefined = unchanged; "" / null = no job; a string = that job.
  const resultingActivity = nextActivity || effectiveActivity(entry);
  const resultingJob = jobId === undefined ? entry.jobId || null : jobId || null;
  const rule = checkActivityJob(resultingActivity, resultingJob, null);
  if (rule.error) return { error: rule.error };

  const changesSomething =
    s !== toMs(entry.clockIn) ||
    e !== toMs(entry.clockOut) ||
    resultingActivity !== effectiveActivity(entry) ||
    resultingJob !== (entry.jobId || null);
  if (!changesSomething) return { error: "no_change" };

  return {
    clockIn: new Date(s),
    clockOut: new Date(e),
    activity: resultingActivity,
    jobId: resultingJob,
    reason: text,
  };
}

/** Does [s, e) overlap any other entry of the same worker? Open ones run to `now`. */
export function overlapsOthers({ entryId, clockIn, clockOut, others = [], now = new Date() }) {
  const s = toMs(clockIn);
  const e = toMs(clockOut);
  return (others || []).some((o) => {
    if (!o || o.id === entryId) return false;
    const os = toMs(o.clockIn);
    const oe = o.clockOut == null ? toMs(now) : toMs(o.clockOut);
    return Number.isFinite(os) && Number.isFinite(oe) && os < e && s < oe;
  });
}

/**
 * The write approving a correction makes, and the snapshot it keeps.
 *
 * @param entry       the TimeEntry as it stands (with breaks)
 * @param correction  the stored request
 * @param policy      resolveTimeActivities(company.timeActivities)
 */
export function applyCorrection(entry, correction, policy = []) {
  const activityChanged = Boolean(correction.activity) && correction.activity !== effectiveActivity(entry);
  const jobChanged = (correction.jobId || null) !== (entry.jobId || null);
  const paid = activityChanged
    ? (policy.find((a) => a.key === correction.activity)?.paid ?? true)
    : entry.paid !== false;
  const breaks = (entry.breaks || []).map((b) => (b.end == null ? { ...b, end: correction.clockOut } : b));
  const hours = entryHours(correction.clockIn, correction.clockOut, breaks, { paid });
  const data = {
    clockIn: new Date(correction.clockIn),
    clockOut: new Date(correction.clockOut),
    hours,
    // Stated only when it changes: an old entry with no activity keeps
    // reading as it always did unless the correction says otherwise.
    ...(activityChanged ? { activity: correction.activity, paid } : {}),
    // A different job is a different job: the plan step it was booked to
    // belongs to the old one.
    ...(jobChanged ? { jobId: correction.jobId || null, taskId: null } : {}),
  };
  const original = {
    clockIn: entry.clockIn ? new Date(entry.clockIn).toISOString() : null,
    clockOut: entry.clockOut ? new Date(entry.clockOut).toISOString() : null,
    hours: entry.hours == null ? null : Number(entry.hours),
    activity: entry.activity || null,
    jobId: entry.jobId || null,
    taskId: entry.taskId || null,
    paid: entry.paid !== false,
    status: entry.status || null,
  };
  return { data, original, openBreakIds: (entry.breaks || []).filter((b) => b.end == null).map((b) => b.id) };
}

/**
 * What PATCH /api/time-entries/[id] tells a crew member who tries to change
 * their own times there directly (refused since 2026-10-03): the screen path
 * to the request, in the words the screen uses (app.nav.clock "Time clock",
 * app.clock.tabLog "Time log", app.clock.correction.request).
 */
export const CREW_SELF_EDIT_REFUSAL =
  "You can't change your own hours here. Open Time clock › Time log, pick the entry and choose \"Request a correction\" — your manager approves it, then it's changed.";

/** The sentence for each refusal lib/timeclock/corrections.js can give. */
export const CORRECTION_WORDS = {
  not_found: "That time entry isn't one of yours.",
  times_required: "Give the start and the end.",
  end_before_start: "The end has to be after the start.",
  too_long: "That's more than 24 hours — check the dates.",
  in_future: "The end is in the future.",
  too_old: "That's too far back to correct here — ask your manager.",
  reason_required: "Say why, so your manager can check it.",
  bad_activity: "That isn't one of the clock's activities.",
  job_required: "Time on site needs a job.",
  job_not_allowed: "That activity isn't linked to a job.",
  step_not_allowed: "Only time on site is booked to a step.",
  no_change: "That's what the entry already says.",
};
