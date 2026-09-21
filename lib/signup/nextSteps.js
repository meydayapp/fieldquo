// lib/signup/nextSteps.js
//
// The "next steps" letter: FieldQuo → a company whose card is in and whose
// onboarding checklist is still open, about two hours after the Subscription
// row appeared. The owner's ask (2026-09-21), from a lead-generation site's
// sequence he had just been through as a contractor: a welcome at signup, and
// two hours later a letter specific to the trade he had chosen, with a
// numbered "next steps 1-2-3" block. Ours says what is still open on THEIR
// checklist, in their language, each row a link that opens that step's
// window on the home page, and what each one unlocks for their trade.
//
// ══ Who, exactly ═══════════════════════════════════════════════════════════
//
// A Subscription row exists (they reached the end of Stripe Checkout — the
// five-minute and twenty-four-hour letters in earlyNudge.js / abandoned.js
// are for people who did not), the company is not a demo, and
// getOnboardingStatus() says `complete: false` at the moment of sending.
// Companies the platform console creates by hand (POST /api/platform/
// companies) have no Subscription row and are outside this by construction;
// a referred company still signs up through /signup and Checkout, so it is
// inside. There is no other way a company comes to exist.
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
// Subscription.nextStepsEmailSentAt is the claim and the record;
// nextStepsEmailSkipped is the record of a decision NOT to write. A row with
// either set is never looked at again. So a company that ticked everything
// inside the first two hours is skipped once and stays skipped, rather than
// being written to a week later when Stripe review knocks a tick off — the
// letter is "your next steps after signing up", not "your checklist has a
// gap", and the dashboard card already says the second thing every day.
//
// ══ The window ═════════════════════════════════════════════════════════════
//
// Due from createdAt + delay; no longer due after createdAt + delay +
// NEXT_STEPS_WINDOW_HOURS. A company whose row is older than that when the
// cron first sees it (the ones that existed before this letter did, or a
// cron that was down for four days) gets nothing: "next steps" three days
// after signing up is a different conversation, and the sales check-ins own
// it. Those rows are left unmarked — they are simply never in the query.

import { INDUSTRIES } from "@/app/data/industries";
import { normalizeTradePitchLanguage } from "@/lib/sales/tradeSellingPoints";

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
 * The createdAt range a Subscription row must fall in to be due now.
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
 * @param subscription  { createdAt, status, nextStepsEmailSentAt, nextStepsEmailSkipped }
 * @param company       { isDemo, email }
 * @param onboarding    { complete, steps } from getOnboardingStatus, read fresh
 * @param settings      normalised
 * @returns { send, reason, skip? }  `skip` is the reason to RECORD on the row
 *          (a decision, never revisited); `reason` alone is a wait or a
 *          refusal that costs nothing to re-evaluate next run.
 */
export function decideNextStepsEmail({ subscription, company, onboarding, settings, now = new Date() } = {}) {
  const s = normaliseNextStepsSettings(settings);
  if (!s.enabled) return { send: false, reason: "disabled" };
  if (!subscription) return { send: false, reason: "no_subscription" };
  if (!company) return { send: false, reason: "no_company" };
  if (company.isDemo) return { send: false, reason: "demo" };
  if (subscription.nextStepsEmailSentAt) return { send: false, reason: "already_sent" };
  if (subscription.nextStepsEmailSkipped) return { send: false, reason: "already_decided" };
  if (!["active", "trialing"].includes(String(subscription.status || ""))) return { send: false, reason: `status_${subscription.status || "unknown"}` };
  const created = subscription.createdAt ? new Date(subscription.createdAt) : null;
  if (!created || Number.isNaN(created.getTime())) return { send: false, reason: "no_created_at" };
  const { earliest, latest } = nextStepsDueRange({ now, delayHours: s.delayHours });
  if (created > latest) return { send: false, reason: "not_yet_due" };
  if (created < earliest) return { send: false, reason: "too_late" };
  // The one that must be read fresh, after the claim: the checklist.
  if (!onboarding) return { send: false, reason: "no_onboarding_status" };
  if (onboarding.complete) return { send: false, reason: "onboarding_complete", skip: "onboarding_complete" };
  const open = (onboarding.steps || []).filter((st) => st && !st.done);
  if (!open.length) return { send: false, reason: "onboarding_complete", skip: "onboarding_complete" };
  if (!String(company.email || "").trim()) return { send: false, reason: "no_recipient", skip: "no_recipient" };
  return { send: true, reason: "due" };
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

/** The language the letter is written in: en / fr / es, English otherwise. */
export function nextStepsLanguage(code) {
  return normalizeTradePitchLanguage(code) || "en";
}
