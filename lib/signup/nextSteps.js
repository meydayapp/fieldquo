// lib/signup/nextSteps.js
//
// The "finish setting up" letter (it was called "next steps", and the
// identifiers still are): FieldQuo → a new company whose onboarding checklist
// is still open, about two hours after it signed up. The owner's ask
// (2026-09-21), from a lead-generation site's sequence he had just been
// through as a contractor: a welcome at signup, and two hours later a letter
// specific to the trade he had chosen, with a numbered "next steps 1-2-3"
// block. Ours says what is still open on THEIR checklist, in their language,
// each row a link that opens that step's window on the home page, and what
// each one unlocks for their trade — then the additional set-up steps still
// on their home page (lib/setupSteps.js), and, for a company on its card-free
// trial, the one date that matters: when the free month ends.
//
// The owner again, 2026-09-24, once signup stopped taking a card: "that
// email should be about to not forget finishing the onboarding. and the
// additional set up steps" — "because they are trialling."
//
// ══ Who, exactly ═══════════════════════════════════════════════════════════
//
// Since 2026-09-24 (commit 38d3308d) signup ends without a card: a new company
// is on a thirty-day trial on Company.trialEndsAt and has NO Subscription row
// until it chooses a plan. Until this date the letter was keyed on the
// Subscription row, so every new company fell outside it — and got the
// "you didn't finish signing up" nudge instead, which was wrong twice.
//
// So a company is inside when it is not a demo, getOnboardingStatus() says
// `complete: false` at the moment of sending, and EITHER
//
//   - it has no Subscription row and a trial date (the card-free trial —
//     every new signup now), OR
//   - it has a Subscription row that is active or trialing (a company that
//     came through the older checkout path, a planId from a saved draft).
//
// A company with no Subscription AND no trial date is one the platform
// console created by hand (POST /api/platform/companies) and stays outside,
// as it always was.
//
// ══ One letter per COMPANY, whichever path ═════════════════════════════════
//
// Company.nextStepsEmailSentAt / nextStepsEmailSkipped are the claim and the
// record for everybody. Two locks — one on Company for trials, one on
// Subscription for card-backed rows — would let a trial company that chose a
// plan on day one be claimed twice, once per row, and no WHERE clause on one
// table serialises against a write to the other. One row per company does.
// Subscription's columns of the same name are the record of letters written
// before this date; they are still read (a company stamped there is never
// picked again) and no longer written.
//
// The due time is Company.createdAt + delay for both paths. It used to be
// Subscription.createdAt, which for a checkout signup is the same moment give
// or take the minutes Checkout took. For a company that trialled and then
// chose a plan it is not — that Subscription row appears weeks later, and
// "next steps after signing up" on day twenty is the wrong letter, sent on
// the wrong clock, possibly for the second time.
//
// ══ Pure, on purpose ═══════════════════════════════════════════════════════
//
// Same split as earlyNudge.js: the timing rule, the settings normalisation
// and the step → link mapping take plain values and touch nothing, so
// scripts/check-onboarding-next-steps.mjs executes them against a company
// that finished in ninety minutes, one whose row is a week old, a delay of
// "abc", and every other hostile shape. nextStepsStore.js is the database
// half; the cron owns the order of the side effects.
//
// ══ Once, decided at the due time, never revisited ═════════════════════════
//
// Company.nextStepsEmailSentAt is the claim and the record;
// nextStepsEmailSkipped is the record of a decision NOT to write. A company
// with either set is never looked at again. So a company that ticked everything
// inside the first two hours is skipped once and stays skipped, rather than
// being written to a week later when Stripe review knocks a tick off — the
// letter is "your next steps after signing up", not "your checklist has a
// gap", and the dashboard card already says the second thing every day.
//
// ══ The window ═════════════════════════════════════════════════════════════
//
// Due from Company.createdAt + delay; no longer due after createdAt + delay +
// NEXT_STEPS_WINDOW_HOURS. A company older than that when the cron first sees
// it (the ones that existed before this letter did, or a cron that was down
// for four days) gets nothing: "next steps" three days after signing up is a
// different conversation, and the sales check-ins own it. Those rows are left
// unmarked — they are simply never in the query. That is also the backlog
// guard for the trial change: the companies that signed up card-free before
// it shipped and are past the window are never mailed in bulk.

import { INDUSTRIES } from "@/app/data/industries";
import { LANGUAGE_CODES } from "@/app/i18n/languages";

/** The PlatformSetting row the console writes. */
export const NEXT_STEPS_SETTING_KEY = "onboarding.nextStepsEmail";

export const DEFAULT_NEXT_STEPS_SETTINGS = Object.freeze({
  enabled: true,
  delayHours: 2,
});

/** The console's bounds on the delay: under an hour is a second welcome, over three days is not "next steps". */
export const NEXT_STEPS_DELAY_HOURS_MIN = 1;
export const NEXT_STEPS_DELAY_HOURS_MAX = 72;

/** How long past the delay a row stays due. */
export const NEXT_STEPS_WINDOW_HOURS = 72;

/** The most steps the letter lists; the checklist has six today, and a letter with all six is still one screen. */
export const NEXT_STEPS_MAX = 5;

/**
 * The most ADDITIONAL set-up steps the letter lists by name. The card has
 * fifteen-odd rows and a letter with all of them is a wall; the rest are
 * counted in one line that points at the home page, where all of them are.
 */
export const NEXT_STEPS_MORE_MAX = 5;

/** Subscription statuses that count as "card-backed and live" for this letter. */
const LIVE_SUBSCRIPTION = ["active", "trialing"];

const validDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * The smallest sample the social-proof sentence may be computed from. Below
 * this the sentence is not printed — a median of three companies is an
 * anecdote wearing a number (AGENTS.md failure class 5).
 */
export const NEXT_STEPS_PROOF_MIN_COMPANIES = 10;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Whatever was stored (or sent), made into a settings object. Anything
 * unreadable falls to the default for THAT field: a delay of "abc" is two
 * hours, not zero, and `enabled` is only false when it was stored as false.
 */
export function normaliseNextStepsSettings(value) {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const enabled = v.enabled === false ? false : v.enabled === true ? true : DEFAULT_NEXT_STEPS_SETTINGS.enabled;
  const n = Number(v.delayHours);
  const delayHours =
    Number.isFinite(n) && n >= NEXT_STEPS_DELAY_HOURS_MIN && n <= NEXT_STEPS_DELAY_HOURS_MAX
      ? Math.round(n * 4) / 4
      : DEFAULT_NEXT_STEPS_SETTINGS.delayHours;
  return { enabled, delayHours };
}

/**
 * A PUT body → { ok, value } or { ok: false, error }. Stricter than the
 * normaliser: a person typing 500 into the box is told, not silently given 2.
 */
export function validateNextStepsSettings(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Expected an object." };
  const out = {};
  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") return { ok: false, error: "`enabled` must be true or false." };
    out.enabled = body.enabled;
  }
  if (body.delayHours !== undefined) {
    const n = Number(body.delayHours);
    if (!Number.isFinite(n) || n < NEXT_STEPS_DELAY_HOURS_MIN || n > NEXT_STEPS_DELAY_HOURS_MAX) {
      return { ok: false, error: `\`delayHours\` must be between ${NEXT_STEPS_DELAY_HOURS_MIN} and ${NEXT_STEPS_DELAY_HOURS_MAX}.` };
    }
    out.delayHours = Math.round(n * 4) / 4;
  }
  if (!Object.keys(out).length) return { ok: false, error: "Nothing to change." };
  return { ok: true, value: out };
}

/**
 * The Company.createdAt range a company must fall in to be due now.
 * Inclusive bounds; the cron passes them straight to `gte` / `lte`.
 */
export function nextStepsDueRange({ now = new Date(), delayHours = DEFAULT_NEXT_STEPS_SETTINGS.delayHours } = {}) {
  const latest = new Date(now.getTime() - delayHours * HOUR_MS);
  const earliest = new Date(latest.getTime() - NEXT_STEPS_WINDOW_HOURS * HOUR_MS);
  return { earliest, latest };
}

/**
 * Should this company get the letter now? Every input is a plain value the
 * cron read in the request that sends.
 *
 * @param company       { isDemo, email, createdAt, trialEndsAt,
 *                        nextStepsEmailSentAt, nextStepsEmailSkipped }
 * @param subscription  { status, nextStepsEmailSentAt, nextStepsEmailSkipped }
 *                      for a card-backed company, or null for one with no
 *                      Subscription row (the card-free trial). REQUIRED:
 *                      undefined throws — see below.
 * @param onboarding    { complete, steps } from getOnboardingStatus, read fresh
 * @param suppressed    FieldQuo's do-not-contact list closes this address,
 *                      read in the request that sends (lib/sales/suppression)
 * @param settings      normalised
 * @returns { send, reason, skip? }  `skip` is the reason to RECORD on the
 *          company (a decision, never revisited); `reason` alone is a wait or
 *          a refusal that costs nothing to re-evaluate next run.
 * @throws when `subscription` is undefined — the same rule
 *         earlyNudgePersonFromCompany gives. null means "no plan chosen yet,
 *         on the card-free trial"; undefined means the caller never read it,
 *         and reading that as null would put a card-backed company whose
 *         legacy Subscription stamp says it was ALREADY written to back in
 *         line for a second letter.
 */
export function decideNextStepsEmail({ subscription, company, onboarding, suppressed = false, settings, now = new Date() } = {}) {
  if (subscription === undefined) {
    throw new Error("decideNextStepsEmail: `subscription` was not read — pass null for a company with no Subscription row; undefined cannot tell 'no plan yet' from 'not loaded'");
  }
  const s = normaliseNextStepsSettings(settings);
  if (!s.enabled) return { send: false, reason: "disabled" };
  if (!company) return { send: false, reason: "no_company" };
  if (company.isDemo) return { send: false, reason: "demo" };
  // The one lock, on the company, for both paths.
  if (company.nextStepsEmailSentAt) return { send: false, reason: "already_sent" };
  if (company.nextStepsEmailSkipped) return { send: false, reason: "already_decided" };
  if (subscription) {
    // The record from before the lock moved to Company: a letter written (or
    // decided against) under the old column is still the one letter.
    if (subscription.nextStepsEmailSentAt) return { send: false, reason: "already_sent" };
    if (subscription.nextStepsEmailSkipped) return { send: false, reason: "already_decided" };
    if (!LIVE_SUBSCRIPTION.includes(String(subscription.status || ""))) return { send: false, reason: `status_${subscription.status || "unknown"}` };
  } else {
    // No plan chosen: inside only on the card-free trial. No trial date is a
    // company the console created by hand — outside, as it always was.
    const trialEnds = validDate(company.trialEndsAt);
    if (!trialEnds) return { send: false, reason: "no_trial" };
    // A trial the console ended early (/end-trial) is a read-only account;
    // "finish setting up" to it is the wrong letter. Not recorded: an
    // extension inside the window brings it back.
    if (trialEnds <= now) return { send: false, reason: "trial_ended" };
  }
  const created = validDate(company.createdAt);
  if (!created) return { send: false, reason: "no_created_at" };
  const { earliest, latest } = nextStepsDueRange({ now, delayHours: s.delayHours });
  if (created > latest) return { send: false, reason: "not_yet_due" };
  if (created < earliest) return { send: false, reason: "too_late" };
  // The one that must be read fresh, after the claim: the checklist.
  if (!onboarding) return { send: false, reason: "no_onboarding_status" };
  if (onboarding.complete) return { send: false, reason: "onboarding_complete", skip: "onboarding_complete" };
  const open = (onboarding.steps || []).filter((st) => st && !st.done);
  if (!open.length) return { send: false, reason: "onboarding_complete", skip: "onboarding_complete" };
  if (!String(company.email || "").trim()) return { send: false, reason: "no_recipient", skip: "no_recipient" };
  // The do-not-contact list, the way the letter these companies were getting
  // by mistake (the early nudge) honours it. Recorded: an address that asked
  // FieldQuo to stop is not re-asked every fifteen minutes for three days.
  if (suppressed) return { send: false, reason: "suppressed", skip: "suppressed" };
  return { send: true, reason: "due" };
}

/**
 * The trial date the letter prints, or null. Only for a company with no
 * Subscription row whose trial is still running: a card-backed company's
 * trial is Stripe's and its own confirmation letter says when it charges,
 * and a date in the past is not "runs until".
 */
export function nextStepsTrialEndsAt({ company, subscription, now = new Date() } = {}) {
  if (subscription !== null) return null;
  const d = validDate(company?.trialEndsAt);
  return d && d > now ? d : null;
}

/**
 * Where an ADDITIONAL set-up step's link lands: the row's own href from
 * lib/setupSteps.js (already carrying ?from=setup, so the target page shows
 * its "Back to home" link), made absolute. Anything that is not a plain /app
 * path is the home page instead — the href comes from a table in this repo,
 * but a letter is not where to find out a row was malformed.
 */
export function setupStepHref(step, origin = "") {
  const base = String(origin || "").replace(/\/+$/, "");
  const href = typeof step?.href === "string" ? step.href : "";
  if (!/^\/app(?:[/?#][\w\-/?=&#.]*)?$/.test(href)) return `${base}/app`;
  return `${base}${href}`;
}

/**
 * The discovery trade behind the first industry slug that maps to one, else
 * null. The same table lib/signup/leads.js reads (tradeKeyForIndustries);
 * repeated here rather than imported because leads.js pulls the whole signup
 * funnel in, and this module is meant to load under bare node in a check.
 */
export function nextStepsTradeKey(slugs = []) {
  for (const slug of Array.isArray(slugs) ? slugs : []) {
    const hit = INDUSTRIES.find((i) => i.slug === slug && i.tradeKey);
    if (hit) return hit.tradeKey;
  }
  return null;
}

/** The industry slugs that map to a discovery trade — the social-proof query's `hasSome`. */
export function industrySlugsForTrade(tradeKey) {
  return INDUSTRIES.filter((i) => i.tradeKey && i.tradeKey === tradeKey).map((i) => i.slug);
}

/**
 * Where each open step's button lands.
 *
 * Every checklist step opens in a window on the home page since 2026-09-21
 * (app/components/dashboard/StepDialog.js), and /app?step=<key> opens that
 * window on load — so the letter's link lands in the form, not in the weeds.
 * The one exception is Stripe Connect: its "window" holds a single button
 * that hands the browser to Stripe, and a link that opens a window whose only
 * content is another button is a detour. It keeps the payments page, which
 * the checklist row used before the windows existed, and the letter says
 * plainly that it opens Stripe.
 */
export function nextStepHref(step, origin = "") {
  const base = String(origin || "").replace(/\/+$/, "");
  if (!step || typeof step.key !== "string" || !/^[a-z_]+$/.test(step.key)) return `${base}/app`;
  if (step.key === "payments") return `${base}${step.href || "/app/settings/payments"}`;
  return `${base}/app?step=${encodeURIComponent(step.key)}`;
}

/**
 * The social-proof sentence's inputs, or null when the sample is too small.
 * Takes the per-company minutes (Quote.createdAt − Company.createdAt for the
 * first quote) already computed by the store; nothing is invented here.
 *
 * @returns { companies, medianMinutes } | null
 */
export function firstQuoteProof(minutesList = []) {
  // A number, not something Number() would coerce: null is 0 minutes to
  // Number(), and a null row is not a company that quoted at once.
  const clean = (Array.isArray(minutesList) ? minutesList : []).filter(
    (m) => typeof m === "number" && Number.isFinite(m) && m >= 0,
  );
  if (clean.length < NEXT_STEPS_PROOF_MIN_COMPANIES) return null;
  const sorted = clean.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { companies: clean.length, medianMinutes: Math.round(median) };
}

/**
 * The language the letter is written in: any of the eight document
 * languages (app/i18n/languages.js), English otherwise. It was en / fr / es
 * until 2026-09-24, because the trade sentences it borrows exist only in
 * those three; the letter's own sentences now exist in all eight, and in the
 * other five the trade-specific lines are replaced by the catalogue's plain
 * ones rather than printed in English (see onboardingNextStepsEmail.js).
 */
export function nextStepsLanguage(code) {
  const short = String(code || "").toLowerCase().split(/[-_]/)[0];
  return LANGUAGE_CODES.includes(short) ? short : "en";
}
