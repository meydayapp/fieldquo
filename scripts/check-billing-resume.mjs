// scripts/check-billing-resume.mjs
//
//   npm run check:billing-resume
//
// Cancel at the period end, Resume without a Checkout, one trial per company.
//
// ══ The morning this guards ═══════════════════════════════════════════════
//
// 2026-09-14, 07:15 and 07:17 UTC: the owner pressed the banner's "Start
// again" twice on his own cancelled $1 live-test plan. It was a link to the
// page he was on. "No window, no pop up." His rule for what it should do:
// "resume current (remaining balance on the month)". And, on the second
// look: "if I cancelled I shouldn't get a new free trial — I should go
// straight to the first month, because otherwise companies can cancel and go
// again for the first free trial."
//
// ══ What is EXECUTED rather than read ══════════════════════════════════════
//
//   cancelModeFor            trialing → immediate, active → period_end,
//                            past_due → immediate
//   resumeDecision           every state: uncancel, credited (trial_end = the
//                            old period end), charge_now (cancelled mid-trial,
//                            or the paid period elapsed), checkout (no card),
//                            none (already live)
//   priceStillMatches        the old Price is reused only when it still says
//                            what the Plan row says
//   trialDaysAllowed         a company with trialUsedAt NEVER gets a trial;
//                            one without gets the days to its trialEndsAt
//   trialStartFromStripe     trial_start, then created, then nothing
//   subscriptionFieldsFromStripe
//                            cancel_at_period_end / cancel_at land on the row;
//                            a canceled object clears both; a partial object
//                            writes neither
//   accessFor                an ending subscription is FULL with endsAt
//   resumeSubscription       under the db + Stripe fakes: the uncancel path
//                            sends cancel_at_period_end:false; the credited
//                            path creates a subscription with trial_end = the
//                            old period end and the checkout metadata; the
//                            charge_now path creates one with NO trial; a
//                            customer with no card falls through to Checkout
//                            with trial_period_days ABSENT
//   stampTrialUsed           stamps once, never moves
//
// Source pins cover only what cannot be executed offline: the routes, the
// banner never linking to the page it is on, the nine languages, the help.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//           --import ./scripts/billing-stub-loader.mjs scripts/check-billing-resume.mjs

import { readFileSync } from "node:fs";
import { cancelModeFor } from "@/lib/billing/cancelPolicy";
import { resumeDecision, priceStillMatches, resumeSubscription, loadResumeState, resumePreview, CREDIT_MIN_MS } from "@/lib/billing/resume";
import { trialDaysAllowed, trialStartFromStripe } from "@/lib/billing/trialOnce";
import { subscriptionFieldsFromStripe, SYNCED_COLUMNS } from "@/lib/billing/subscriptionFields";
import { accessFor } from "@/lib/billing/access";
import { stampTrialUsed } from "@/lib/platform/stripeSync";
import { stripe } from "@/lib/stripe";
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";
import { calls, state, resetStripeStub } from "./fixtures/stripeStub.mjs";
import { resetNotifyStub } from "./fixtures/notifyStub.mjs";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const resetAll = () => { resetDbStub(); resetStripeStub(); resetNotifyStub(); };

const DAY = 86400_000;
const NOW = new Date("2026-09-14T08:00:00Z");
const T = (d) => new Date(d);
const sec = (d) => Math.floor(d.getTime() / 1000);
const COMPANY = "cmtzyunut000004jncwlnob1g";
const SUB = "sub_1UFFM8PvqBqmizLgAAgmWLXT";
const PLAN = { id: "plan_1", name: "Live test", priceMonthly: 1, priceAnnual: null, tierKey: "solo" };
const PRICE = { id: "price_old", active: true, currency: "usd", unit_amount: 100, recurring: { interval: "month", interval_count: 1 } };

// ── 1. When a cancellation takes effect ─────────────────────────────────────
console.log("\n── 1. cancelModeFor ────────────────────────────────────────────");
{
  ok("trialing → immediate (nothing paid for)", cancelModeFor("trialing") === "immediate");
  ok("active → period_end (they paid to a date)", cancelModeFor("active") === "period_end");
  ok("past_due → immediate (the period is unpaid)", cancelModeFor("past_due") === "immediate");
  ok("canceled / unknown → immediate", cancelModeFor("canceled") === "immediate" && cancelModeFor(null) === "immediate");
}

// ── 2. What Resume will do ──────────────────────────────────────────────────
console.log("\n── 2. resumeDecision ───────────────────────────────────────────");
{
  const periodEnd = T("2026-10-13T15:30:11Z");
  const ending = resumeDecision({ status: "active", cancelAtPeriodEnd: true, currentPeriodEnd: periodEnd, hasPaymentMethod: true, now: NOW });
  ok("active + cancel_at_period_end → uncancel", ending.mode === "uncancel", ending);
  const live = resumeDecision({ status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: periodEnd, hasPaymentMethod: true, now: NOW });
  ok("active, nothing booked → none (nothing to resume)", live.mode === "none", live);

  // Test Inc., 2026-09-13: cancelled DURING the trial. trial_end is after
  // canceled_at, so there is no paid time — and no second trial.
  const testInc = resumeDecision({
    status: "canceled", currentPeriodEnd: periodEnd, trialEnd: periodEnd, canceledAt: T("2026-09-13T20:06:24Z"), hasPaymentMethod: true, now: NOW,
  });
  ok("cancelled mid-trial with a card → charge_now (one trial, ever)", testInc.mode === "charge_now" && testInc.reason === "trial_used", testInc);
  const testIncNoCard = resumeDecision({
    status: "canceled", currentPeriodEnd: periodEnd, trialEnd: periodEnd, canceledAt: T("2026-09-13T20:06:24Z"), hasPaymentMethod: false, now: NOW,
  });
  ok("cancelled mid-trial with no card → checkout", testIncNoCard.mode === "checkout" && testIncNoCard.reason === "no_payment_method", testIncNoCard);

  // A PAID month cancelled on the 13th: the weeks to the 1st are honoured.
  const paid = resumeDecision({
    status: "canceled", currentPeriodEnd: T("2026-10-01T00:00:00Z"), trialEnd: null, canceledAt: T("2026-09-13T12:00:00Z"), hasPaymentMethod: true, now: NOW,
  });
  ok("cancelled mid-PAID-period with a card → credited until the old period end", paid.mode === "credited" && paid.until?.getTime() === T("2026-10-01T00:00:00Z").getTime(), paid);
  const paidTrialOver = resumeDecision({
    status: "canceled", currentPeriodEnd: T("2026-10-01T00:00:00Z"), trialEnd: T("2026-09-01T00:00:00Z"), canceledAt: T("2026-09-13T12:00:00Z"), hasPaymentMethod: true, now: NOW,
  });
  ok("a trial that ENDED before the cancel is not 'cancelled mid-trial'", paidTrialOver.mode === "credited", paidTrialOver);
  const paidNoCard = resumeDecision({
    status: "canceled", currentPeriodEnd: T("2026-10-01T00:00:00Z"), trialEnd: null, canceledAt: T("2026-09-13T12:00:00Z"), hasPaymentMethod: false, now: NOW,
  });
  ok("…with no card → checkout, the until still reported", paidNoCard.mode === "checkout" && paidNoCard.until?.getTime() === T("2026-10-01T00:00:00Z").getTime(), paidNoCard);

  const elapsed = resumeDecision({
    status: "canceled", currentPeriodEnd: T("2026-09-01T00:00:00Z"), trialEnd: null, canceledAt: T("2026-08-13T12:00:00Z"), hasPaymentMethod: true, now: NOW,
  });
  ok("paid period in the PAST → charge_now, never a trial_end in the past", elapsed.mode === "charge_now" && elapsed.reason === "period_elapsed" && !elapsed.until, elapsed);
  const edge = resumeDecision({
    status: "canceled", currentPeriodEnd: new Date(NOW.getTime() + CREDIT_MIN_MS - 1), trialEnd: null, canceledAt: T("2026-09-13T12:00:00Z"), hasPaymentMethod: true, now: NOW,
  });
  ok(`a period end within ${CREDIT_MIN_MS / 60000} min counts as elapsed (Stripe refuses a trial_end that is not in the future)`, edge.mode === "charge_now", edge);
  const none = resumeDecision({ status: null, hasPaymentMethod: false, now: NOW });
  ok("no subscription → checkout", none.mode === "checkout" && none.reason === "no_subscription", none);
}

// ── 3. The old price is reused only when it still says what the plan says ──
console.log("\n── 3. priceStillMatches ────────────────────────────────────────");
{
  ok("same plan, cadence, currency, amount → reused", priceStillMatches(PRICE, PLAN, "month", "usd") === true);
  ok("plan price edited since → not reused (Checkout shows the number)", priceStillMatches(PRICE, { ...PLAN, priceMonthly: 2 }, "month", "usd") === false);
  ok("other currency → not reused", priceStillMatches(PRICE, PLAN, "month", "cad") === false);
  ok("other cadence → not reused", priceStillMatches(PRICE, PLAN, "year", "usd") === false);
  ok("archived price → not reused", priceStillMatches({ ...PRICE, active: false }, PLAN, "month", "usd") === false);
  ok("no annual price on the plan → a yearly price cannot match", priceStillMatches({ ...PRICE, recurring: { interval: "year" } }, PLAN, "year", "usd") === false);
}

// ── 4. One trial, ever ──────────────────────────────────────────────────────
console.log("\n── 4. trialDaysAllowed / trialStartFromStripe ──────────────────");
{
  const future = new Date(NOW.getTime() + 20 * DAY);
  ok("fresh company, trial in the future → the days to it", trialDaysAllowed({ trialUsedAt: null, trialEndsAt: future }, { now: NOW }) === 20);
  ok("fresh company, trial ended → 0", trialDaysAllowed({ trialUsedAt: null, trialEndsAt: new Date(NOW.getTime() - DAY) }, { now: NOW }) === 0);
  ok("fresh company, no date → 0", trialDaysAllowed({ trialUsedAt: null, trialEndsAt: null }, { now: NOW }) === 0 && trialDaysAllowed(null, { now: NOW }) === 0);
  ok("caller's own free-until date wins (signup passes the post-referral one)", trialDaysAllowed({ trialUsedAt: null, trialEndsAt: future }, { now: NOW, trialEndsAt: new Date(NOW.getTime() + 50 * DAY) }) === 50);
  ok("trialUsedAt set, trial date still in the future → 0 (Test Inc. today)", trialDaysAllowed({ trialUsedAt: T("2026-09-13T00:00:00Z"), trialEndsAt: future }, { now: NOW }) === 0);
  ok("trialUsedAt set, caller's date in the future → still 0", trialDaysAllowed({ trialUsedAt: T("2026-09-13T00:00:00Z") }, { now: NOW, trialEndsAt: future }) === 0);
  ok("a partial day rounds UP to 1, never 0 by accident", trialDaysAllowed({ trialUsedAt: null, trialEndsAt: new Date(NOW.getTime() + 3600_000) }, { now: NOW }) === 1);

  const ts = sec(T("2026-09-13T15:30:11Z"));
  ok("trial_start is Stripe's stamp", trialStartFromStripe({ trial_start: ts, trial_end: ts + 30 * 86400 })?.getTime() === ts * 1000);
  ok("trial_end without trial_start → created stands in", trialStartFromStripe({ trial_end: ts + 30 * 86400, created: ts })?.getTime() === ts * 1000);
  ok("no trial at all → null", trialStartFromStripe({ trial_start: null, trial_end: null, created: ts }) === null && trialStartFromStripe(null) === null);
}

// ── 5. The mapping carries the pending end ──────────────────────────────────
console.log("\n── 5. subscriptionFieldsFromStripe (cancel_at_period_end) ──────");
{
  const endSec = sec(T("2026-10-13T15:30:11Z"));
  const ending = subscriptionFieldsFromStripe({ id: SUB, status: "active", cancel_at_period_end: true, cancel_at: endSec, current_period_end: endSec, trial_end: null, items: { data: [{ price: { recurring: { interval: "month" } } }] } });
  ok("active + cancel_at_period_end → cancelAtPeriodEnd true, cancelAt the date, status active", ending.status === "active" && ending.cancelAtPeriodEnd === true && ending.cancelAt?.getTime() === endSec * 1000, ending);
  ok("…and canceledAt is NOT written (the window has not started)", !("canceledAt" in ending));
  const resumed = subscriptionFieldsFromStripe({ id: SUB, status: "active", cancel_at_period_end: false, cancel_at: null, trial_end: null });
  ok("un-cancelled → cancelAtPeriodEnd false, cancelAt null", resumed.cancelAtPeriodEnd === false && resumed.cancelAt === null, resumed);
  const gone = subscriptionFieldsFromStripe({ id: SUB, status: "canceled", cancel_at_period_end: true, cancel_at: endSec, canceled_at: endSec, trial_end: null });
  ok("canceled clears both, whatever the deleted object says", gone.cancelAtPeriodEnd === false && gone.cancelAt === null && gone.status === "canceled", gone);
  const partial = subscriptionFieldsFromStripe({ id: SUB, status: "active", trial_end: null });
  ok("a partial object writes neither (unknown is not false)", !("cancelAtPeriodEnd" in partial) && !("cancelAt" in partial), partial);
  ok("both are drift-synced columns (a dashboard cancellation reaches the banner within 6 h)", SYNCED_COLUMNS.includes("cancelAtPeriodEnd") && SYNCED_COLUMNS.includes("cancelAt"));
}

// ── 6. Access: ending is FULL, with a date ──────────────────────────────────
console.log("\n── 6. accessFor ────────────────────────────────────────────────");
{
  const endsAt = T("2026-10-13T15:30:11Z");
  const a = accessFor({ status: "active", cancelAtPeriodEnd: true, cancelAt: endsAt, currentPeriodEnd: endsAt }, NOW);
  ok("an ending subscription is FULL access with endsAt", a.level === "full" && a.endsAt?.getTime() === endsAt.getTime(), a);
  const b = accessFor({ status: "active", cancelAtPeriodEnd: true, cancelAt: null, currentPeriodEnd: endsAt }, NOW);
  ok("…falling back to currentPeriodEnd when cancelAt is null", b.endsAt?.getTime() === endsAt.getTime(), b);
  const c = accessFor({ status: "active", cancelAtPeriodEnd: false, currentPeriodEnd: endsAt }, NOW);
  ok("a live subscription has endsAt null (absence of a booking is not a date)", c.level === "full" && c.endsAt === null, c);
  const d = accessFor({ status: "canceled", canceledAt: T("2026-09-13T20:06:24Z") }, NOW);
  ok("cancelled is still read-only with the 30-day count (windows unchanged)", d.level === "readonly" && d.daysLeft === 30, d);
}

// ── 7. resumeSubscription, executed against the fakes ───────────────────────
console.log("\n── 7. resumeSubscription ───────────────────────────────────────");
// The fixture is shared and the checkout/customer namespaces are unscripted
// there; scripted here, on the same object the product imports.
let created = [];
let checkoutSessions = [];
let createShouldFail = null;
stripe.subscriptions.create = async (params) => {
  calls.push({ method: "subscriptions.create", args: [params] });
  if (createShouldFail) { const e = new Error(createShouldFail.message); e.code = createShouldFail.code; throw e; }
  const sub = {
    id: `sub_new_${created.length + 1}`,
    status: params.trial_end ? "trialing" : "active",
    customer: params.customer,
    current_period_end: params.trial_end || sec(new Date(NOW.getTime() + 30 * DAY)),
    trial_end: params.trial_end || null,
    trial_start: params.trial_end ? sec(NOW) : null,
    cancel_at_period_end: false,
    cancel_at: null,
    currency: "usd",
    items: { data: [{ price: PRICE }] },
    metadata: params.metadata,
    latest_invoice: { amount_paid: params.trial_end ? 0 : 100, currency: "usd" },
  };
  created.push(sub);
  state.subscriptions.set(sub.id, sub);
  return sub;
};
stripe.checkout = {
  sessions: {
    create: async (params) => {
      checkoutSessions.push(params);
      return { id: "cs_1", url: "https://checkout.stripe.com/c/cs_1" };
    },
  },
};
const baseRow = () => ({
  id: "s1", companyId: COMPANY, planId: PLAN.id, plan: PLAN, stripeSubscriptionId: SUB, stripeCustomerId: "cus_VFknPs1rRPeIkl",
  status: "canceled", billingInterval: "month", canceledAt: T("2026-09-13T20:06:24Z"), currentPeriodEnd: T("2026-10-13T15:30:11Z"),
  trialEndsAt: T("2026-10-13T15:30:11Z"), cancelAtPeriodEnd: false, cancelAt: null, pastDueSince: null, stripeScheduleId: null,
});
const customerWithCard = { id: "cus_VFknPs1rRPeIkl", invoice_settings: { default_payment_method: "pm_1" } };
const customerNoCard = { id: "cus_VFknPs1rRPeIkl", invoice_settings: { default_payment_method: null } };
const seed = ({ row = baseRow(), company = { id: COMPANY, currency: "USD", onboardingStatus: "churned", trialUsedAt: T("2026-09-13T15:30:11Z") }, live } = {}) => {
  resetAll(); created = []; checkoutSessions = []; createShouldFail = null;
  rows.subscription.push(row);
  rows.company.push(company);
  if (live) state.subscriptions.set(SUB, live);
};

{
  // (a) uncancel
  const endSec = sec(T("2026-10-13T15:30:11Z"));
  seed({
    row: { ...baseRow(), status: "active", canceledAt: null, trialEndsAt: null, cancelAtPeriodEnd: true, cancelAt: T("2026-10-13T15:30:11Z") },
    company: { id: COMPANY, currency: "USD", onboardingStatus: "active", trialUsedAt: T("2026-08-13T00:00:00Z") },
    live: { id: SUB, status: "active", cancel_at_period_end: true, cancel_at: endSec, current_period_end: endSec, trial_end: null, customer: customerWithCard, default_payment_method: null, items: { data: [{ price: PRICE }] } },
  });
  // The stub's update keeps the object; make it answer like Stripe would.
  const origUpdate = stripe.subscriptions.update;
  stripe.subscriptions.update = async (id, params) => {
    const sub = await origUpdate(id, params);
    if ("cancel_at_period_end" in params) { sub.cancel_at_period_end = params.cancel_at_period_end; sub.cancel_at = params.cancel_at_period_end ? sub.cancel_at : null; }
    return sub;
  };
  const r = await resumeSubscription(COMPANY, { baseUrl: "https://app.fieldquo.com", now: NOW });
  const upd = calls.find((c) => c.method === "subscriptions.update");
  ok("uncancel: subscriptions.update({ cancel_at_period_end: false }) on the SAME subscription", upd?.args[0] === SUB && upd?.args[1]?.cancel_at_period_end === false, upd);
  ok("uncancel: answers { resumed: 'uncancelled' }, nothing created, no checkout", r.resumed === "uncancelled" && created.length === 0 && checkoutSessions.length === 0, r);
  ok("uncancel: the row's cancelAtPeriodEnd is false and cancelAt null, status still active", rows.subscription[0].cancelAtPeriodEnd === false && rows.subscription[0].cancelAt === null && rows.subscription[0].status === "active", rows.subscription[0]);
  ok("uncancel: the company was never churned", rows.company[0].onboardingStatus === "active");

  // (b) credited — a PAID month cancelled on the 13th, weeks left to Oct 1
  const oct1 = T("2026-10-01T00:00:00Z");
  seed({
    row: { ...baseRow(), currentPeriodEnd: oct1, trialEndsAt: null, canceledAt: T("2026-09-13T12:00:00Z") },
    live: { id: SUB, status: "canceled", canceled_at: sec(T("2026-09-13T12:00:00Z")), current_period_end: sec(oct1), trial_end: null, cancel_at_period_end: false, cancel_at: null, customer: customerWithCard, default_payment_method: null, items: { data: [{ price: PRICE }] } },
  });
  const rb = await resumeSubscription(COMPANY, { baseUrl: "https://app.fieldquo.com", now: NOW });
  const cb = created[0];
  ok("credited: a NEW subscription is created (Stripe cannot un-cancel a cancelled one)", created.length === 1 && rb.resumed === "credited", rb);
  const pb = calls.find((c) => c.method === "subscriptions.create")?.args[0];
  ok("credited: trial_end = the OLD period end, to the second", pb?.trial_end === sec(oct1), pb?.trial_end);
  ok("credited: same customer, the old price reused, the customer's card, error_if_incomplete, no prorations", pb?.customer === "cus_VFknPs1rRPeIkl" && pb?.items?.[0]?.price === "price_old" && pb?.default_payment_method === "pm_1" && pb?.payment_behavior === "error_if_incomplete" && pb?.proration_behavior === "none", pb);
  ok("credited: the checkout metadata (companyId, planId, billingInterval) so every reader treats it as first-class", pb?.metadata?.companyId === COMPANY && pb?.metadata?.planId === PLAN.id && pb?.metadata?.billingInterval === "month", pb?.metadata);
  ok("credited: automatic tax on, like the two Checkouts", pb?.automatic_tax?.enabled === true);
  ok("credited: the row points at the new subscription, trialing to the credited date, canceledAt cleared", rows.subscription[0].stripeSubscriptionId === cb.id && rows.subscription[0].status === "trialing" && rows.subscription[0].trialEndsAt?.getTime() === oct1.getTime() && rows.subscription[0].canceledAt === null, rows.subscription[0]);
  ok("credited: company back to active", rows.company[0].onboardingStatus === "active");
  ok("credited: the response carries `until`", rb.until?.getTime() === oct1.getTime(), rb);
  ok("credited: the OLD subscription was not touched (no cancel, no delete)", !calls.some((c) => c.method === "subscriptions.cancel"), calls.map((c) => c.method));

  // (c) charge_now — Test Inc.: cancelled during the trial, card on file
  const oct13 = T("2026-10-13T15:30:11Z");
  seed({
    live: { id: SUB, status: "canceled", canceled_at: sec(T("2026-09-13T20:06:24Z")), current_period_end: sec(oct13), trial_end: sec(oct13), trial_start: sec(T("2026-09-13T15:30:11Z")), cancel_at_period_end: false, cancel_at: null, customer: customerWithCard, default_payment_method: null, items: { data: [{ price: PRICE }] } },
  });
  const rc = await resumeSubscription(COMPANY, { baseUrl: "https://app.fieldquo.com", now: NOW });
  const pc = calls.find((c) => c.method === "subscriptions.create")?.args[0];
  ok("charge_now: a new subscription with NO trial_end and NO trial_period_days", created.length === 1 && pc && !("trial_end" in pc) && !("trial_period_days" in pc), pc);
  ok("charge_now: answers { resumed: 'charged' } with the amount the first invoice took", rc.resumed === "charged" && rc.amountPaidCents === 100 && rc.currency === "usd", rc);
  ok("charge_now: the row is active on the new subscription, trialEndsAt null", rows.subscription[0].status === "active" && rows.subscription[0].trialEndsAt === null && rows.subscription[0].stripeSubscriptionId === created[0].id, rows.subscription[0]);
  ok("charge_now: no Checkout was opened", checkoutSessions.length === 0);

  // (d) no card → Checkout, with NO trial for a company that had one
  seed({
    live: { id: SUB, status: "canceled", canceled_at: sec(T("2026-09-13T20:06:24Z")), current_period_end: sec(oct13), trial_end: sec(oct13), cancel_at_period_end: false, cancel_at: null, customer: customerNoCard, default_payment_method: null, items: { data: [{ price: PRICE }] } },
  });
  const rd = await resumeSubscription(COMPANY, { baseUrl: "https://app.fieldquo.com", now: NOW });
  ok("no card: nothing created, a Checkout URL answered", created.length === 0 && rd.resumed === false && rd.checkoutUrl === "https://checkout.stripe.com/c/cs_1" && rd.reason === "no_payment_method", rd);
  const cs = checkoutSessions[0];
  ok("no card: the Checkout carries NO trial (trialUsedAt is set)", cs && !cs.subscription_data?.trial_period_days, cs?.subscription_data);
  ok("no card: the Checkout is for the same plan and cadence, with the checkout metadata", cs?.metadata?.planId === PLAN.id && cs?.metadata?.billingInterval === "month" && cs?.line_items?.[0]?.price_data?.unit_amount === 100, cs);
  ok("no card: the row was not moved off the old subscription", rows.subscription[0].stripeSubscriptionId === SUB && rows.subscription[0].status === "canceled");

  // (e) Stripe refuses the create (a decline) → Checkout, nothing written
  seed({
    live: { id: SUB, status: "canceled", canceled_at: sec(T("2026-09-13T20:06:24Z")), current_period_end: sec(oct13), trial_end: sec(oct13), cancel_at_period_end: false, cancel_at: null, customer: customerWithCard, default_payment_method: null, items: { data: [{ price: PRICE }] } },
  });
  createShouldFail = { code: "card_declined", message: "Your card was declined." };
  const re = await resumeSubscription(COMPANY, { baseUrl: "https://app.fieldquo.com", now: NOW });
  ok("declined: falls through to Checkout with the reason, the row untouched", re.resumed === false && re.checkoutUrl && re.reason === "card_declined" && rows.subscription[0].stripeSubscriptionId === SUB && rows.subscription[0].status === "canceled", re);
  ok("declined: filed to the error log", rows.platformErrorLog.length === 1 && /Resume could not create/.test(rows.platformErrorLog[0].message), rows.platformErrorLog);

  // (f) price edited since → Checkout even with a card
  seed({
    row: { ...baseRow(), plan: { ...PLAN, priceMonthly: 2 } },
    live: { id: SUB, status: "canceled", canceled_at: sec(T("2026-09-13T20:06:24Z")), current_period_end: sec(oct13), trial_end: sec(oct13), cancel_at_period_end: false, cancel_at: null, customer: customerWithCard, default_payment_method: null, items: { data: [{ price: PRICE }] } },
  });
  const rf = await resumeSubscription(COMPANY, { baseUrl: "https://app.fieldquo.com", now: NOW });
  ok("price changed since: Checkout (it shows the new number), nothing created", rf.resumed === false && rf.checkoutUrl && created.length === 0, rf);
  ok("price changed since: the Checkout charges the CURRENT plan price", checkoutSessions[0]?.line_items?.[0]?.price_data?.unit_amount === 200, checkoutSessions[0]?.line_items);

  // (g) the preview says the same thing the press would do
  seed({
    live: { id: SUB, status: "canceled", canceled_at: sec(T("2026-09-13T20:06:24Z")), current_period_end: sec(oct13), trial_end: sec(oct13), cancel_at_period_end: false, cancel_at: null, customer: customerWithCard, default_payment_method: null, items: { data: [{ price: PRICE }] } },
  });
  const pv = resumePreview(await loadResumeState(COMPANY, { now: NOW }));
  ok("preview for Test Inc.: charge_now, $1.00 monthly, plan named", pv.mode === "charge_now" && pv.amountCents === 100 && pv.currency === "usd" && pv.interval === "month" && pv.planName === PLAN.name, pv);
  ok("preview: the live read healed nothing it should not (row still canceled, old id)", rows.subscription[0].status === "canceled" && rows.subscription[0].stripeSubscriptionId === SUB);

  // (i) the plan has been RETIRED (Plan.retiredAt — the owner's own live test,
  //     2026-09-14). Cancelled with a card on file, which is the charge_now
  //     shape above: nothing may be created on a retired plan, so nothing is,
  //     no Checkout opens, and the answer names the reason.
  seed({
    row: { ...baseRow(), plan: { ...PLAN, retiredAt: T("2026-09-14T12:00:00Z") } },
    live: { id: SUB, status: "canceled", canceled_at: sec(T("2026-09-13T20:06:24Z")), current_period_end: sec(oct13), trial_end: sec(oct13), cancel_at_period_end: false, cancel_at: null, customer: customerWithCard, default_payment_method: null, items: { data: [{ price: PRICE }] } },
  });
  const rr = await resumeSubscription(COMPANY, { baseUrl: "https://app.fieldquo.com", now: NOW });
  ok("retired plan: refused — nothing created, no Checkout, reason plan_retired", rr.resumed === false && rr.retired === true && rr.reason === "plan_retired" && created.length === 0 && checkoutSessions.length === 0 && !rr.checkoutUrl, rr);
  ok("retired plan: the note says it is no longer offered", /no longer offered/.test(rr.note || ""), rr.note);
  ok("retired plan: the row is untouched (still canceled, old id)", rows.subscription[0].status === "canceled" && rows.subscription[0].stripeSubscriptionId === SUB);
  const pvr = resumePreview(await loadResumeState(COMPANY, { now: NOW }));
  ok("retired plan: the preview says retired too, so no button is drawn", pvr.mode === "retired" && pvr.reason === "plan_retired", pvr);

  // (j) …but an ENDING subscription on a retired plan is un-cancelled as
  //     before: that is an existing subscription continuing, which is exactly
  //     what retirement keeps.
  {
    const endSec2 = sec(T("2026-10-14T12:26:43Z"));
    seed({
      row: { ...baseRow(), plan: { ...PLAN, retiredAt: T("2026-09-14T12:00:00Z") }, status: "active", canceledAt: null, trialEndsAt: null, cancelAtPeriodEnd: true, cancelAt: T("2026-10-14T12:26:43Z") },
      company: { id: COMPANY, currency: "USD", onboardingStatus: "active", trialUsedAt: T("2026-08-13T00:00:00Z") },
      live: { id: SUB, status: "active", cancel_at_period_end: true, cancel_at: endSec2, current_period_end: endSec2, trial_end: null, customer: customerWithCard, default_payment_method: null, items: { data: [{ price: PRICE }] } },
    });
    const ru = await resumeSubscription(COMPANY, { baseUrl: "https://app.fieldquo.com", now: NOW });
    ok("retired plan, ending: un-cancelled (Test Inc. today), nothing created", ru.resumed === "uncancelled" && created.length === 0 && checkoutSessions.length === 0, ru);
  }

  // (h) already live → none, and the preview says so
  seed({
    row: { ...baseRow(), status: "active", canceledAt: null, trialEndsAt: null },
    company: { id: COMPANY, currency: "USD", onboardingStatus: "active", trialUsedAt: T("2026-08-13T00:00:00Z") },
    live: { id: SUB, status: "active", cancel_at_period_end: false, cancel_at: null, current_period_end: sec(oct13), trial_end: null, customer: customerWithCard, items: { data: [{ price: PRICE }] } },
  });
  const rh = await resumeSubscription(COMPANY, { baseUrl: "https://app.fieldquo.com", now: NOW });
  ok("already live: { resumed: false, alreadyLive: true }, nothing sent to Stripe but the read", rh.alreadyLive === true && !calls.some((c) => c.method !== "subscriptions.retrieve"), rh);
}

// ── 8. stampTrialUsed ───────────────────────────────────────────────────────
console.log("\n── 8. stampTrialUsed ───────────────────────────────────────────");
{
  resetAll();
  rows.company.push({ id: COMPANY, trialUsedAt: null });
  const ts = sec(T("2026-09-13T15:30:11Z"));
  const first = await stampTrialUsed(COMPANY, { id: SUB, status: "trialing", trial_start: ts, trial_end: ts + 30 * 86400 });
  ok("stamps from trial_start the first time", first === true && rows.company[0].trialUsedAt?.getTime() === ts * 1000, rows.company[0]);
  const again = await stampTrialUsed(COMPANY, { id: SUB, status: "trialing", trial_start: ts + 5, trial_end: ts + 30 * 86400 });
  ok("never moves a stamp that exists", again === false && rows.company[0].trialUsedAt?.getTime() === ts * 1000);
  resetAll();
  rows.company.push({ id: COMPANY, trialUsedAt: null });
  const noTrial = await stampTrialUsed(COMPANY, { id: SUB, status: "active", trial_start: null, trial_end: null });
  ok("a subscription with no trial stamps nothing (a restart is not a trial)", noTrial === false && rows.company[0].trialUsedAt === null);
}

// ── 9. Source pins ──────────────────────────────────────────────────────────
console.log("\n── 9. The routes and screens, pinned ───────────────────────────");
{
  const cancel = stripComments(read("app/api/platform/billing/cancel/route.js"));
  ok("cancel route decides with cancelModeFor from the LIVE status", /cancelModeFor\(liveStatus\)/.test(cancel) && /stripe\.subscriptions\.retrieve\(subscription\.stripeSubscriptionId\)/.test(cancel));
  ok("cancel route: period_end → subscriptions.update({ cancel_at_period_end: true })", /cancel_at_period_end: true/.test(cancel) && /if \(mode === "period_end"\)/.test(cancel));
  ok("cancel route: immediate path still calls cancelSubscription", /cancelSubscription\(subscription\.stripeSubscriptionId\)/.test(cancel));
  ok("cancel route: period-end path does NOT churn the company or write canceledAt by hand", !/onboardingStatus: "churned"/.test(cancel) && !/canceledAt: new Date/.test(cancel));
  ok("cancel route: notifyCancellation is told which kind (atPeriodEnd true/false)", /atPeriodEnd: true/.test(cancel) && /atPeriodEnd: false/.test(cancel));

  const resume = stripComments(read("app/api/platform/billing/resume/route.js"));
  ok("resume route: GET preview and POST, both behind isBillingAdmin", /export async function GET/.test(resume) && /export async function POST/.test(resume) && (resume.match(/isBillingAdmin\(member\.role\)/g) || []).length === 2);
  ok("resume route: records billing.resumed with the mode", /action: "billing\.resumed"/.test(resume) && /new_subscription_credited/.test(resume) && /creditedUntil/.test(resume));
  ok("resume route is on the always-writable billing prefix (a read-only account can press it)", /"\/api\/platform\/billing"/.test(read("lib/billing/access.js")));

  const checkout = stripComments(read("app/api/platform/billing/checkout/route.js"));
  ok("checkout route: trial days come from trialDaysAllowed(company), nothing else", /trialDaysAllowed\(company\)/.test(checkout) && !/company\.trialEndsAt\.getTime\(\)/.test(checkout));
  ok("checkout route: refuses a plan change on an ending subscription (Resume first)", /live\.cancel_at_period_end && LIVE\.has\(liveStatus\)/.test(checkout) && /status: 409/.test(checkout));
  const signup = stripComments(read("app/api/companies/route.js"));
  ok("signup: trial days go through trialDaysAllowed too", /trialDaysAllowed\(company, \{ trialEndsAt: effectiveTrialEnd \}\)/.test(signup));
  const resumeLib = stripComments(read("lib/billing/resume.js"));
  ok("resume's Checkout fallback: trialDaysAllowed(company)", /trialDays: trialDaysAllowed\(company\)/.test(resumeLib));
  // Every place that puts trial days on a Stripe object.
  const billing = stripComments(read("lib/platform/stripeBilling.js"));
  ok("no checkout builder reads Company.trialEndsAt itself", !/company\.trialEndsAt/.test(billing));
  ok("the webhook's created/updated handler stamps the trial", /await stampTrialUsed\(row\.companyId, obj\)/.test(billing));
  const sync = stripComments(read("lib/platform/stripeSync.js"));
  ok("writeSubscriptionFromStripe stamps the trial before the compare", sync.indexOf("await stampTrialUsed(companyId, live)") > -1 && sync.indexOf("await stampTrialUsed(companyId, live)") < sync.indexOf("if (changed.length)"));
  ok("referral months do not consult the trial rule (they are not a trial)", !/trialOnce|trialDaysAllowed/.test(read("lib/referrals/extendAccess.js")));

  const schema = read("prisma/schema.prisma");
  ok("schema: Subscription.cancelAtPeriodEnd Boolean @default(false) and cancelAt DateTime?", /cancelAtPeriodEnd Boolean\s+@default\(false\)/.test(schema) && /cancelAt\s+DateTime\?/.test(schema));
  ok("schema: Company.trialUsedAt DateTime?", /trialUsedAt\s+DateTime\?/.test(schema));
  const backfill = read("scripts/backfill-trial-used.mjs");
  ok("backfill: dry run by default, --yes writes, never moves a stamp", /process\.argv\.includes\("--yes"\)/.test(backfill) && /trialUsedAt: null/.test(backfill) && !/\.delete/.test(backfill));

  // The banner never links to the page it is on.
  const banner = read("app/components/layout/BillingBanner.js");
  ok("banner: the cancelled/ending state renders ResumePlanButton, not a link", /<ResumePlanButton/.test(banner) && !/account-billing#plans/.test(banner));
  ok("banner: an ending subscription (endsAt) gets its own strip with Resume", /state\.level === "full" && state\.endsAt/.test(banner) && /app\.billingBanner\.endsOn/.test(banner));
  ok("banner: shows the resumed note after the reload", /RESUMED_NOTE_KEY/.test(banner));
  const button = read("app/components/billing/ResumePlanButton.js");
  ok("the button POSTs and never navigates except to a checkoutUrl", /method: "POST"/.test(button) && /window\.location\.href = data\.checkoutUrl/.test(button) && !/href="\/app\/settings\/account-billing/.test(button));
  ok("the button says the charge before the press (restartCharged with {amount})", /app\.billing\.restartCharged/.test(button) && /app\.billing\.resumeCredited/.test(button));
  const page = read("app/app/settings/account-billing/page.js");
  ok("billing page: Resume is primary, 'Choose a different plan' the secondary path to the cards", /<ResumePlanButton/.test(page) && /app\.billing\.chooseDifferentPlan/.test(page) && /href="#plans"/.test(page) && /<div id="plans">/.test(page));
  ok("billing page: an ending plan shows 'ends on', not 'Next billing date', and hides Cancel plan", /!isEnding && subscription\?\.currentPeriodEnd/.test(page) && /app\.billing\.endsOn/.test(page) && /status !== "canceled" && !isEnding/.test(page));
  const flow = read("app/app/settings/account-billing/CancelFlow.js");
  ok("cancel flow: the confirm sentence branches on cancelModeFor(status)", /cancelModeFor\(status\)/.test(flow) && /app\.cancelFlow\.endsOnDate/.test(flow) && /app\.cancelFlow\.endsNow/.test(flow) && /app\.cancelFlow\.noSecondTrial/.test(flow));
  const detail = read("app/platform/companies/[id]/CompanyDetail.js");
  ok("platform company page: Ends — customer cancelled, and Trial used on", /customer cancelled/.test(detail) && /Trial used on/.test(detail) && /sub\.cancelAtPeriodEnd/.test(detail));

  const email = stripComments(read("lib/email/billingEmail.js"));
  ok("cancellation email: 'ends on {date}; nothing more will be charged' only for a booked end", /atPeriodEnd && periodEnd/.test(email) && /nothing more will be charged/.test(email));
  const notify = stripComments(read("lib/billing/notify.js"));
  ok("notifyCancellation only states a date for a booked end", /atPeriodEnd \? periodEnd/.test(notify));

  const KEYS = [
    "app.billing.resume", "app.billing.resumeCredited", "app.billing.restartCharged", "app.billing.restartChargedYear", "app.billing.resumeCheckout",
    "app.billing.resuming", "app.billing.resumedContinues", "app.billing.resumedCredited", "app.billing.resumedCharged", "app.billing.resumeFailed",
    "app.billing.resumeNothing", "app.billing.resumeUnreachable", "app.billing.endsOn", "app.billing.chooseDifferentPlan",
    "app.billingBanner.endsOn", "app.billingBanner.endsOnBody", "app.billingBanner.cancelledLocked", "app.billingBanner.cancelledLockedBody",
    "app.billingBanner.cancelledOneDay", "app.billingBanner.cancelledDays", "app.billingBanner.cancelledBody", "app.billingBanner.updateCard",
    "app.cancelFlow.endsOnDate", "app.cancelFlow.endsOnDateBody", "app.cancelFlow.noSecondTrial", "app.cancelFlow.doFirstByDate",
  ];
  const langs = Object.keys(APP_MESSAGES);
  ok(`nine language blocks present`, langs.length === 9, langs);
  for (const key of KEYS) {
    const missing = langs.filter((l) => !APP_MESSAGES[l][key]);
    ok(`${key} in all ${langs.length} languages`, missing.length === 0, missing);
  }
  for (const key of ["app.billing.restartCharged", "app.billing.restartChargedYear", "app.billing.resumedCharged"]) {
    ok(`${key} carries {amount} everywhere`, langs.every((l) => /\{amount\}/.test(APP_MESSAGES[l][key] || "")));
  }
  for (const key of ["app.billing.resumeCredited", "app.billing.resumedCredited", "app.billing.endsOn", "app.billingBanner.endsOn", "app.cancelFlow.endsOnDate", "app.cancelFlow.doFirstByDate"]) {
    ok(`${key} carries {date} everywhere`, langs.every((l) => /\{date\}/.test(APP_MESSAGES[l][key] || "")));
  }
  ok("app.billingBanner.cancelledDays carries {days} everywhere", langs.every((l) => /\{days\}/.test(APP_MESSAGES[l]["app.billingBanner.cancelledDays"] || "")));

  for (const lang of ["en", "fr", "es"]) {
    const help = read(`content/help/${lang}/billing-and-subscription-2.js`);
    ok(`help (${lang}) explains cancel-at-period-end and Resume`, /(Resume|Reprendre|Reanudar)/.test(help) && /(one free trial|un seul essai gratuit|una sola prueba gratuita)/i.test(help));
  }
}

console.log(`\n${pass} passed${fails.length ? `, ${fails.length} FAILED` : ""}`);
for (const f of fails) console.log(`  ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
