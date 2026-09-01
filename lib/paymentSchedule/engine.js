// lib/paymentSchedule/engine.js
//
// The rule-based payment schedule's arithmetic. Pure — no Prisma, no fetch,
// no un-injected Date.now() — so it can be executed against hostile input by
// scripts/check-money-flow.mjs, the same discipline every other pricing file
// in this codebase keeps (lib/servicePlans/schedule.js, .../pricing.js).
//
// ══ The owner's rules, verbatim ═════════════════════════════════════════════
//
// "With the payment schedule of the company it would be based on the start
// and end date of the job, as well as invoice creation for deposit. So if
// it's like 30% deposit, that would be when the invoice is created and sent.
// If they also add balance is due when job is completed then it needs to
// look at job end date for the 70%. But if it says 30% deposit / 40% job
// start / 15% half way / 15% job end — half way would be the job end minus
// job start to calculate how many days the job takes, divide it by 2 and add
// that to the job start. So if a project takes 6 days the half way point is
// 3 days, and if the project starts on September 1 (Tuesday) the half way
// point would be September 3, as September 1 would be the first day,
// September 2 the second and September 3 the third day, and the end date
// projected would be September 6."
//
// ══ The four triggers ═══════════════════════════════════════════════════════
//
//   on_invoice_created — the deposit. Not date-based at all: it fires the
//     moment the schedule itself is created (quote acceptance), synchronously,
//     never by a date check. resolveStageDueDate always returns a null
//     dueDate for it — callers must not poll a clock for this one.
//   job_start  — Job.startDate.
//   job_end    — Job.endDate. The owner's own words for the balance trigger
//     ("balance is due when job is completed... it needs to look at job end
//     date") equate "completed" with the job's END DATE for scheduling
//     purposes, not Job.completedAt (the timestamp the crew actually finished
//     — which can differ from the date originally projected). Implemented
//     exactly as stated: job_end reads Job.endDate.
//   halfway    — see below.
//
// A fifth trigger, "N days before start", was considered and left out — see
// the PaymentScheduleStage.trigger comment in prisma/schema.prisma for why.
//
// ══ The halfway math ════════════════════════════════════════════════════════
//
// The owner's own example decodes as INCLUSIVE day counting: Sept 1 → Sept 6
// is a 6-DAY project, not five nights. So:
//
//   durationDays     = daysBetween(start, end) + 1        // 6
//   halfwayDayIndex  = round(durationDays / 2)             // 3rd day
//   halfwayDate      = start + (halfwayDayIndex - 1) days  // Sept 1 + 2 = Sept 3
//
// ── Odd durations round UP (Math.ceil), not down ────────────────────────────
//
// A 5-day job gives durationDays/2 = 2.5, which has to round somewhere.
// Rounding down (day 2) asks for the halfway payment before the midpoint of
// the work has actually passed — the version of this feature that produces
// "you billed me for half the job when the crew had been there one day."
// Rounding up (day 3) asks a beat later, once MORE than half the job is
// genuinely done. That costs the contractor nothing (the money still arrives
// before the job ends, same as rounding down would) and removes the one
// complaint a homeowner could have with the timing. Every document a client
// sees is required by this codebase to look trustworthy (AGENTS.md's white-
// label mandate); defaulting the ambiguous case toward the interpretation
// that can't be read as jumping the gun serves that directly. A contractor
// who disagrees can always restructure their percentages — this default just
// has to pick ONE side and be consistent, which is what the owner asked for.
//
// ── Everything is UTC-midnight arithmetic ───────────────────────────────────
//
// Job.startDate/endDate are stored as UTC-midnight calendar dates, the same
// convention lib/servicePlans/schedule.js documents and relies on for the
// same reason: local-time date arithmetic drifts by a day around a DST
// change or when the server runs in a timezone west of UTC. UTC has no DST,
// so every day-count and every halfway date below is computed in it.

export const PAYMENT_SCHEDULE_TRIGGERS = [
  "on_invoice_created",
  "job_start",
  "halfway",
  "job_end",
];

/// Default label offered when a contractor adds a stage of this trigger —
/// editable afterwards, never re-derived once saved.
export const DEFAULT_STAGE_LABELS = {
  on_invoice_created: "Deposit",
  job_start: "Job start",
  halfway: "Halfway",
  job_end: "On completion",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function isValidDate(d) {
  return d instanceof Date && !Number.isNaN(d.getTime());
}

function toDate(value) {
  if (value == null) return null;
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return isValidDate(d) ? d : null;
}

function utcMidnight(date) {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function addUtcDays(date, days) {
  const d = new Date(utcMidnight(date));
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Whole calendar days between two UTC-midnight dates, ignoring time-of-day.
 * Negative when `end` is before `start` — callers decide what that means.
 */
function daysBetweenUTC(start, end) {
  return Math.round((utcMidnight(end) - utcMidnight(start)) / DAY_MS);
}

/**
 * INCLUSIVE day count — a job that starts and ends the same day is a 1-day
 * job, not zero; Sept 1 → Sept 6 is 6 days, not 5. See the header.
 *
 * @returns null when either date is missing, or when end is before start
 *   (an invalid range — a negative "duration" is not a number worth
 *   returning, it's a corrupt job that every date-based trigger must refuse
 *   rather than compute nonsense from).
 */
export function jobDurationDays(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (!start || !end) return null;
  const diff = daysBetweenUTC(start, end);
  if (diff < 0) return null;
  return diff + 1;
}

/**
 * The halfway calendar date — see the header for the worked example and the
 * rounding decision. Returns null under the same conditions
 * jobDurationDays does (either date missing, or end before start).
 */
export function halfwayDate(startDate, endDate) {
  const start = toDate(startDate);
  const duration = jobDurationDays(startDate, endDate);
  if (!start || duration == null) return null;

  const halfwayDayIndex = Math.ceil(duration / 2); // round UP — see header
  return addUtcDays(start, halfwayDayIndex - 1);
}

/**
 * Resolve ONE stage's due date from a job's current dates.
 *
 * Returns { dueDate, blockedReason }, exactly one of which is set.
 * blockedReason is never invented as "now" or "never" — see AGENTS.md's
 * "never ship a control that appears to work and doesn't" and the owner's
 * own instruction that an unresolvable date must be a VISIBLE state, not a
 * silently-skipped one.
 *
 * blockedReason ∈ "awaiting_start_date" | "awaiting_end_date" |
 *                  "invalid_date_range" | "unknown_trigger"
 */
export function resolveStageDueDate(trigger, { startDate, endDate } = {}) {
  const start = toDate(startDate);
  const end = toDate(endDate);

  if (trigger === "on_invoice_created") {
    // Fires synchronously at schedule creation — never by a date check. See
    // isStageDue below, which always reads this trigger as "not due" on
    // purpose: nothing should ever poll a clock waiting for it.
    return { dueDate: null, blockedReason: null };
  }

  if (trigger === "job_start") {
    if (!start) return { dueDate: null, blockedReason: "awaiting_start_date" };
    return { dueDate: start, blockedReason: null };
  }

  if (trigger === "job_end") {
    if (!end) return { dueDate: null, blockedReason: "awaiting_end_date" };
    if (start && daysBetweenUTC(start, end) < 0) {
      return { dueDate: null, blockedReason: "invalid_date_range" };
    }
    return { dueDate: end, blockedReason: null };
  }

  if (trigger === "halfway") {
    if (!start) return { dueDate: null, blockedReason: "awaiting_start_date" };
    if (!end) return { dueDate: null, blockedReason: "awaiting_end_date" };
    if (daysBetweenUTC(start, end) < 0) {
      return { dueDate: null, blockedReason: "invalid_date_range" };
    }
    return { dueDate: halfwayDate(start, end), blockedReason: null };
  }

  return { dueDate: null, blockedReason: "unknown_trigger" };
}

function num(value) {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Sum of every stage's percentage, unrounded — the raw figure to validate. */
export function totalPercentage(stages) {
  return (Array.isArray(stages) ? stages : []).reduce((s, st) => s + num(st?.percentage), 0);
}

// Float-safe equality, not a tolerance for a genuine mismatch. 30 + 40 + 15 +
// 15 must read as exactly 100 even after passing through Decimal → Number.
const PERCENT_EPSILON = 0.001;

/**
 * Must a company's whole stage set sum to exactly 100 before it can bill
 * anything? Yes — see the model comment on PaymentScheduleStage.percentage.
 * This function only reports; it never clamps or auto-corrects a bad set, so
 * callers can show the contractor the real number they typed.
 */
export function validateSchedulePercentages(stages) {
  const sum = totalPercentage(stages);
  return { valid: Math.abs(sum - 100) < PERCENT_EPSILON, sum };
}

/**
 * Split totalCents across stages by percentage. The LAST stage (by seq)
 * absorbs whatever rounding leaves over, so the stages sum to EXACTLY
 * totalCents rather than drifting by a cent or two.
 *
 * ── Why this differs from lib/servicePlans/pricing.js's own rounding ────────
 *
 * That file applies a discount rate independently to each occurrence and
 * accepts up to N-1 cents of drift across a term, because nothing requires a
 * service plan's occurrences to sum to any particular figure — they are
 * independent bills spread over time, sold at "$X per visit," not "$Y total
 * split N ways." A payment schedule is the opposite case: the whole point of
 * showing a homeowner "30% / 40% / 15% / 15%" is that those bills add up to
 * the number they approved. A cent that never gets billed anywhere
 * undercharges; a cent billed twice overcharges. Both are avoidable here, so
 * they're avoided, rather than accepted the way servicePlans/pricing.js
 * accepts its (structurally different, and structurally unavoidable) drift.
 *
 * Callers should only trust this when validateSchedulePercentages says the
 * set is valid — see computeSchedule, which still runs it on an invalid set
 * (for the UI to show the numbers as-typed) but flags the result unusable.
 */
export function allocateAmountCents(stages, totalCents) {
  const ordered = [...(Array.isArray(stages) ? stages : [])].sort(
    (a, b) => (a?.seq ?? 0) - (b?.seq ?? 0),
  );
  const total = Math.max(0, Math.round(num(totalCents)));
  if (ordered.length === 0) return [];

  let allocated = 0;
  const cents = ordered.map((st, i) => {
    if (i === ordered.length - 1) return null; // filled below
    const c = Math.max(0, Math.round((num(st?.percentage) / 100) * total));
    allocated += c;
    return c;
  });
  cents[cents.length - 1] = Math.max(0, total - allocated);

  return ordered.map((st, i) => ({ seq: st.seq, amountCents: cents[i] }));
}

/**
 * The whole schedule, computed fresh against a job's current dates and a
 * total. No DB — this is exactly what the check script executes.
 *
 * @param stages     [{ seq, label, trigger, percentage }] — a company
 *                   template or a job's already-created rows; either shape
 *                   works, only seq/label/trigger/percentage are read.
 * @param job        { startDate, endDate }
 * @param totalCents the amount the whole schedule bills against — always the
 *                   quote's accepted total in cents, always server-derived
 *                   (non-negotiable #5: the browser never sends money).
 * @returns {{ valid: boolean, sumPercentage: number, stages: [{ seq, label,
 *            trigger, percentage, amountCents, dueDate, blockedReason }] }}
 *   `valid` false means the percentages don't sum to 100 — every stage is
 *   still resolved (so a UI can show WHY it's invalid), but callers must
 *   refuse to persist or act on a schedule this function marks invalid.
 */
export function computeSchedule({ stages, job = {}, totalCents }) {
  const list = Array.isArray(stages) ? stages : [];
  const { valid, sum } = validateSchedulePercentages(list);
  const amountsBySeq = new Map(
    allocateAmountCents(list, totalCents).map((a) => [a.seq, a.amountCents]),
  );

  const resolved = [...list]
    .sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0))
    .map((st) => {
      const { dueDate, blockedReason } = resolveStageDueDate(st?.trigger, job);
      return {
        seq: st?.seq,
        label: st?.label,
        trigger: st?.trigger,
        percentage: num(st?.percentage),
        amountCents: amountsBySeq.get(st?.seq) ?? 0,
        dueDate,
        blockedReason,
      };
    });

  return { valid, sumPercentage: sum, stages: resolved };
}

/**
 * Is this stage's trigger satisfied right now?
 *
 * `on_invoice_created` always reads false here — it never fires off a clock,
 * only synchronously at schedule creation (see lib/paymentSchedule/run.js).
 * A stage with no dueDate (blocked, or on_invoice_created) is never due.
 */
export function isStageDue(stage, { now = new Date() } = {}) {
  if (!stage || stage.trigger === "on_invoice_created") return false;
  if (!stage.dueDate) return false;
  const due = toDate(stage.dueDate);
  if (!due) return false;
  return due.getTime() <= now.getTime();
}

/**
 * Turn a company's stage set into the plain-English sentence
 * Company.paymentTerms already carries — "30% Deposit, 40% Job start, 15%
 * Halfway, 15% On completion" — so the EXISTING cosmetic renderer
 * (lib/documents/paymentSchedule.js's parsePaymentSchedule, rendered by
 * lib/documentSections/PaymentTermsSection.js) shows the real numbers this
 * schedule actually bills, instead of a second, independently-typed
 * sentence that can drift from what's really being charged. See
 * lib/paymentSchedule/validate.js, which writes this string on save.
 *
 * Returns "" for an empty or invalid set — callers must not write an empty
 * or half-finished sentence over a company's existing free text.
 */
export function scheduleToText(stages) {
  const list = Array.isArray(stages) ? stages : [];
  const { valid } = validateSchedulePercentages(list);
  if (!valid || list.length === 0) return "";
  return [...list]
    .sort((a, b) => (a?.seq ?? 0) - (b?.seq ?? 0))
    .map((st) => `${num(st?.percentage)}% ${st?.label || DEFAULT_STAGE_LABELS[st?.trigger] || ""}`.trim())
    .join(", ");
}
