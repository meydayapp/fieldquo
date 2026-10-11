// lib/lifecycle/plan.js
//
// The trial sequence — which lifecycle email, if any, one company gets right
// now. PURE: plain values in, a decision out, so scripts/check-lifecycle-
// emails.mjs executes every day of a trial, every "already done", every
// collision with the 7/3/1 reminders, without a database or a clock.
//
// The owner, 2026-10-11, after reading two competitors' trial emails: "look at
// the frequency" … "can you do all of them?". What this adds to the two
// letters that already existed (the next-steps letter two hours after signup,
// lib/signup/nextSteps.js; the 7/3/1 trial reminders, lib/billing/
// trialReminder.js):
//
//   feature nudges   one per open feature — take card payments, turn on
//                    online booking, send your first quote, import your
//                    clients — about every two days through days 1–10, each
//                    SKIPPED when that thing is already done (facts read
//                    fresh by the caller);
//   milestones       "you did it, here's what's next", the day after the
//                    booking page went live / Stripe connected / the first
//                    quote went out, once each;
//   personal note    day 3, plain text, from a named FieldQuo person — only
//                    when the platform setting names one (never a fake);
//   help articles    day 5, real articles from content/help, plus the
//                    platform's customer stories when there are any;
//   trial ended      the day the trial ends with no plan chosen —
//                    transactional, with the real read-only and lock dates.
//
// ══ "A day" is the company's own calendar day ═════════════════════════════
//
// Company.timezone (Toronto when unset or unreadable). Day 0 is the local
// date of signup. Emails go out only between SEND_HOURS local — a tip at 3am
// is the one nobody reads — and NEVER two on the same local date: a day that
// already carried any lifecycle email (the next-steps letter, a trial
// reminder, one of these) gets nothing more, and a day on which the
// trial-reminder cron WILL send (its next 09:00 UTC run, predicted with the
// reminder's own pure decision) gets nothing from this sequence first. The
// reminders are transactional and run on their own clock; this sequence is
// the one that yields. The combined calendar is in docs/ONBOARDING-EMAILS.md.
//
// ══ One row per (company, kind) ═══════════════════════════════════════════
//
// LifecycleEmail is the claim, the record and the console's history. A kind
// with sentAt or `skipped` is settled for good. A claim with no sentAt is in
// flight — or, after RECLAIM_AFTER_MS, a failed send to retry. Milestones
// have one more state: `observedAt` without a claim, written the first time
// the cron sees the milestone reached (there is no other record of WHEN a
// booking page went live or Stripe was connected), so "the day after" has a
// day to be after.
//
// ══ The backlog guard ═════════════════════════════════════════════════════
//
// Only companies created on or after `sequenceStartsAt` get the sequence (the
// cron passes LIFECYCLE_SEQUENCE_STARTS_AT): the trials already running when
// this shipped are never sent a burst of "day 1" emails on day 9. The
// trial-ended letter is the exception — it is account mail — but it is only
// written in the TRIAL_ENDED_LATE_HOURS after the end, so the trials that
// ended before it existed are not written to either.

import { trialReminderDecision } from "@/lib/billing/trialReminder";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const FEATURES = Object.freeze(["payments", "booking", "quote", "import"]);
export const MILESTONES = Object.freeze(["booking", "payments", "quote"]);

export const LIFECYCLE_KINDS = Object.freeze([
  ...FEATURES.map((f) => `feature_${f}`),
  ...MILESTONES.map((m) => `milestone_${m}`),
  "personal_checkin",
  "help_articles",
  "trial_ended",
]);

/** Which preference category each kind is (lib/email/preferences.js). */
export function kindCategory(kind) {
  return kind === "trial_ended" ? "transactional" : "tips";
}

export const SCHEDULE = Object.freeze({
  featureFirstDay: 1,
  featureLastDay: 10,
  featureSpacingDays: 2,
  personalDay: 3,
  personalLastDay: 6,
  helpDay: 5,
  helpLastDay: 9,
  milestoneMaxDaysLate: 7,
  milestoneObserveMaxAgeDays: 30,
  trialEndedLateHours: 48,
  // Local hours, [from, to): 09:00 up to 17:59.
  sendFromHour: 9,
  sendToHour: 18,
});

/** The trial-reminder cron's hour (vercel.json "0 9 * * *"); the check asserts they agree. */
export const TRIAL_REMINDER_RUN_UTC_HOUR = 9;

/** A claim older than this with no sentAt is a failed send, retried. */
export const RECLAIM_AFTER_MS = 15 * 60 * 1000;

/** Companies created before this get no sequence (see the backlog guard). */
export const LIFECYCLE_SEQUENCE_STARTS_AT = new Date("2026-10-12T00:00:00Z");

export const DEFAULT_TIME_ZONE = "America/Toronto";

const asDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** A time zone Intl accepts, else Toronto. */
export function safeTimeZone(tz) {
  const z = String(tz || "").trim();
  if (!z) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: z });
    return z;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** { date: "YYYY-MM-DD", hour } of an instant in a time zone. */
export function localParts(instant, timeZone) {
  const d = asDate(instant);
  if (!d) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

/** Whole calendar days from local date a to local date b ("YYYY-MM-DD"). */
export function daysBetween(a, b) {
  const pa = Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10));
  const pb = Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10));
  return Math.round((pb - pa) / DAY);
}

/** The trial-reminder cron's next run strictly after `now`. */
export function nextTrialReminderRun(now) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), TRIAL_REMINDER_RUN_UTC_HOUR));
  return d > now ? d : new Date(d.getTime() + DAY);
}

/** When the read-only week ends and the account locks — lib/billing/access.js trialAccessFor's boundary. */
export function trialLockAt(trialEndsAt, graceDays) {
  const end = asDate(trialEndsAt);
  return end ? new Date(end.getTime() + Number(graceDays) * DAY) : null;
}

/** After a refused send, the letter waits this long before it is tried again — one retry per run would be a Resend hiccup turned into an hourly error. */
export const FAILED_BACKOFF_MS = 6 * 60 * 60 * 1000;

function rowState(row, now) {
  if (!row) return "none";
  if (row.sentAt) return "sent";
  if (row.skipped) return "skipped";
  if (row.claimedAt) {
    const age = now.getTime() - new Date(row.claimedAt).getTime();
    return age < RECLAIM_AFTER_MS ? "in_flight" : "retry";
  }
  if (row.failedAt && now.getTime() - new Date(row.failedAt).getTime() < FAILED_BACKOFF_MS) return "backoff";
  return "observed";
}

/**
 * @param now
 * @param company   { createdAt, timezone, isDemo, platformEndsAt, trialEndsAt,
 *                    hasSubscription, offerFinancing, nextStepsEmailSentAt,
 *                    nextStepsEmailSkipped, trialReminder7At, trialReminder3At,
 *                    trialReminder1At }
 * @param facts     { paymentsDone, bookingLive, firstQuoteSentAt, clientsImported }
 *                  — read in the request that decides
 * @param rows      this company's LifecycleEmail rows
 * @param personalReady   the platform names a sender and a reply-to
 * @param nextStepsPendingUntil  while the next-steps letter can still go out
 *                  (null when it never will); nothing from this sequence first
 * @param sequenceStartsAt
 * @returns { send: { kind, category } | null, reason, observe: [{ kind, at }],
 *            record: [{ kind, skipped }], dayIndex, localDate }
 */
export function planLifecycle({
  now = new Date(),
  company,
  facts = {},
  rows = [],
  personalReady = false,
  nextStepsPendingUntil = null,
  sequenceStartsAt = LIFECYCLE_SEQUENCE_STARTS_AT,
} = {}) {
  const out = { send: null, reason: "", observe: [], record: [], dayIndex: null, localDate: null };
  if (!company) return { ...out, reason: "no_company" };
  if (company.isDemo) return { ...out, reason: "demo" };
  if (company.platformEndsAt) return { ...out, reason: "ended_by_fieldquo" };
  const created = asDate(company.createdAt);
  if (!created) return { ...out, reason: "no_created_at" };

  const tz = safeTimeZone(company.timezone);
  const today = localParts(now, tz);
  const dayIndex = daysBetween(localParts(created, tz).date, today.date);
  out.dayIndex = dayIndex;
  out.localDate = today.date;

  const byKind = new Map((Array.isArray(rows) ? rows : []).filter((r) => r && r.kind).map((r) => [r.kind, r]));
  const state = (kind) => rowState(byKind.get(kind), now);
  const settled = (kind) => ["sent", "skipped", "in_flight", "backoff"].includes(state(kind));
  const recorded = new Set();
  const record = (kind, skipped) => {
    if (recorded.has(kind) || state(kind) === "sent" || state(kind) === "skipped" || state(kind) === "in_flight") return;
    recorded.add(kind);
    out.record.push({ kind, skipped });
  };

  const inSequence = created >= sequenceStartsAt;
  const trialEnds = asDate(company.trialEndsAt);
  const ageDays = (now.getTime() - created.getTime()) / DAY;

  // ── Milestones: when did each happen? ─────────────────────────────────────
  const milestoneAt = {};
  if (inSequence) {
    const firstQuote = asDate(facts.firstQuoteSentAt);
    const reached = { booking: facts.bookingLive === true, payments: facts.paymentsDone === true, quote: Boolean(firstQuote) };
    for (const m of MILESTONES) {
      const kind = `milestone_${m}`;
      const row = byKind.get(kind);
      if (row?.observedAt) milestoneAt[m] = asDate(row.observedAt);
      else if (m === "quote" && firstQuote) milestoneAt[m] = firstQuote;
      if (!row && reached[m] && ageDays <= SCHEDULE.milestoneObserveMaxAgeDays) {
        const at = m === "quote" ? firstQuote : now;
        out.observe.push({ kind, at });
        milestoneAt[m] = at;
      }
    }
  }

  // ── Decisions recorded whatever today's gate says ──────────────────────────
  if (inSequence) {
    for (const f of FEATURES) {
      const kind = `feature_${f}`;
      if (state(kind) !== "none" && state(kind) !== "retry") continue;
      if (dayIndex > SCHEDULE.featureLastDay) record(kind, "window_closed");
      else if (dayIndex >= SCHEDULE.featureFirstDay && featureDone(f, facts)) record(kind, "already_done");
    }
    for (const m of MILESTONES) {
      const kind = `milestone_${m}`;
      const at = milestoneAt[m];
      if (!at || settled(kind)) continue;
      if (now.getTime() > at.getTime() + SCHEDULE.milestoneMaxDaysLate * DAY) record(kind, "too_late");
      else if (m === "payments" && company.offerFinancing === true) record(kind, "next_step_done");
    }
    if (dayIndex > SCHEDULE.personalLastDay && !settled("personal_checkin")) {
      record("personal_checkin", personalReady ? "too_late" : "sender_not_configured");
    }
    if (dayIndex > SCHEDULE.helpLastDay && !settled("help_articles")) record("help_articles", "too_late");
  }
  if (!company.hasSubscription && trialEnds && now.getTime() > trialEnds.getTime() + SCHEDULE.trialEndedLateHours * HOUR && !settled("trial_ended")) {
    record("trial_ended", "too_late");
  }
  const decided = new Set(out.record.map((r) => r.kind));
  const open = (kind) => !settled(kind) && !decided.has(kind);

  // ── Today's gate ──────────────────────────────────────────────────────────
  if (today.hour < SCHEDULE.sendFromHour || today.hour >= SCHEDULE.sendToHour) return { ...out, reason: "outside_send_hours" };
  for (const row of byKind.values()) {
    if (row.claimedAt && !row.sentAt && rowState(row, now) === "in_flight") return { ...out, reason: "claim_in_flight" };
  }
  const sentToday = [
    ...[...byKind.values()].map((r) => r.sentAt),
    company.nextStepsEmailSentAt,
    company.trialReminder7At,
    company.trialReminder3At,
    company.trialReminder1At,
  ]
    .map(asDate)
    .filter(Boolean)
    .some((d) => localParts(d, tz).date === today.date);
  if (sentToday) return { ...out, reason: "already_emailed_today" };
  const pendingUntil = asDate(nextStepsPendingUntil);
  if (!company.nextStepsEmailSentAt && !company.nextStepsEmailSkipped && pendingUntil && now < pendingUntil) {
    return { ...out, reason: "next_steps_letter_pending" };
  }
  const run = nextTrialReminderRun(now);
  if (localParts(run, tz).date === today.date) {
    const reminder = trialReminderDecision({
      trialEndsAt: company.trialEndsAt,
      hasSubscription: Boolean(company.hasSubscription),
      isDemo: false,
      endedByFieldQuo: false,
      stamps: company,
      now: run,
    });
    if (reminder.send) return { ...out, reason: "trial_reminder_due_today" };
  }

  // ── What is due, in priority order ────────────────────────────────────────
  const pick = (kind, reason) => ({ ...out, send: { kind, category: kindCategory(kind) }, reason });

  if (!company.hasSubscription && trialEnds && now >= trialEnds && now.getTime() <= trialEnds.getTime() + SCHEDULE.trialEndedLateHours * HOUR && open("trial_ended")) {
    return pick("trial_ended", "trial_ended");
  }
  if (!inSequence) return { ...out, reason: "before_sequence_start" };

  const dueMilestones = MILESTONES.filter((m) => {
    const at = milestoneAt[m];
    if (!at || !open(`milestone_${m}`)) return false;
    return daysBetween(localParts(at, tz).date, today.date) >= 1 && now.getTime() <= at.getTime() + SCHEDULE.milestoneMaxDaysLate * DAY;
  }).sort((a, b) => milestoneAt[a] - milestoneAt[b]);
  if (dueMilestones.length) return pick(`milestone_${dueMilestones[0]}`, "milestone_day_after");

  if (dayIndex >= SCHEDULE.personalDay && dayIndex <= SCHEDULE.personalLastDay && open("personal_checkin")) {
    if (personalReady) return pick("personal_checkin", "personal_day");
  }
  if (dayIndex >= SCHEDULE.helpDay && dayIndex <= SCHEDULE.helpLastDay && open("help_articles")) {
    return pick("help_articles", "help_day");
  }
  if (dayIndex >= SCHEDULE.featureFirstDay && dayIndex <= SCHEDULE.featureLastDay) {
    const lastNudge = FEATURES.map((f) => byKind.get(`feature_${f}`)?.sentAt)
      .map(asDate)
      .filter(Boolean)
      .sort((a, b) => b - a)[0];
    if (lastNudge && daysBetween(localParts(lastNudge, tz).date, today.date) < SCHEDULE.featureSpacingDays) {
      return { ...out, reason: "feature_spacing" };
    }
    const next = FEATURES.find((f) => open(`feature_${f}`) && !featureDone(f, facts));
    if (next) return pick(`feature_${next}`, "feature_open");
    return { ...out, reason: "no_open_feature" };
  }
  return { ...out, reason: "nothing_due" };
}

/** Is this feature done, by the facts the cron read? Unknown is NOT done. */
export function featureDone(feature, facts = {}) {
  switch (feature) {
    case "payments":
      return facts.paymentsDone === true;
    case "booking":
      return facts.bookingLive === true;
    case "quote":
      return Boolean(asDate(facts.firstQuoteSentAt));
    case "import":
      return facts.clientsImported === true;
    default:
      return false;
  }
}
