// scripts/check-referral-reward.mjs
//
// What a referral is actually worth, on both cadences.
//
// ══ What it used to be ═════════════════════════════════════════════════════
//
// The referrer got a Stripe customer-balance credit equal to the amount the
// REFERRED company had just paid. That is "a free month" only while both sit on
// the same tier — a Scale referrer who introduced a Solo company received $129
// against a $389 bill: a third of a month, described as a month.
//
// It is a month of the product now, on both sides, which is one sentence a
// contractor can be told. The owner set both sides at ONE month, overriding the
// three in AGENTS.md; that file was corrected rather than left to disagree with
// the code.
//
// ══ The two things that must not happen ════════════════════════════════════
//
//   * A second referral must EXTEND the first, not replace it. Extending from
//     "now" instead of from the end of what they already hold would quietly
//     shorten a stacked reward, and nobody would notice — the subscriber just
//     gets billed a month earlier than they were promised.
//   * A free month must not trigger a renewal. The month is a DEFERRAL of the
//     next invoice; an annual subscriber given a free month must not be charged
//     for a second year in order to receive it.
//
// ══ Only once a plan is chosen (the owner, 2026-10-03) ══════════════════════
//
// "The referral plan we have for companies should only work when they have
// selected a plan. Not before." The second half of this file executes the
// shipped functions — lib/referrals, the signup's applySignupReferral, the
// checkout upsert that records a plan, the settings and public routes —
// against the scripted database (fixtures/dbStub.mjs) and the recording
// Stripe (fixtures/stripeStub.mjs). Nothing here reaches live Stripe.
//
// Run: npm run check:referral-reward
//   (node --import ./scripts/alias-loader.mjs --import ./scripts/route-stub-loader.mjs
//    --import ./scripts/billing-stub-loader.mjs scripts/check-referral-reward.mjs)

import { readFileSync } from "node:fs";
import { nextAccessEnd, addMonths, hasSelectedPlan } from "@/lib/referrals/extendAccess";
import {
  REFEREE_BONUS_MONTHS,
  REFERRER_BONUS_MONTHS,
  REFERRAL_TERMS_PLAN_REQUIRED,
  applySignupReferral,
  grantReferrerCredit,
  grantRefereeBonus,
  onPlanSelected,
  companyHasSelectedPlan,
} from "@/lib/referrals";
import { upsertSubscriptionFromCheckoutSession } from "@/lib/platform/stripeBilling";
import { trialDaysAllowed } from "@/lib/billing/trialOnce";
import { TRIAL_DAYS } from "@/lib/pricing";
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";
import { state as stripeState, calls as stripeCalls, resetStripeStub } from "./fixtures/stripeStub.mjs";
import { session } from "./fixtures/apiMemberStub.mjs";
import { GET as referralGET } from "@/app/api/settings/referral/route.js";
import { POST as invitePOST } from "@/app/api/settings/referral/invite/route.js";
import { GET as publicReferGET } from "@/app/api/public/refer/[code]/route.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${detail}` : ""}`);
const day = (d) => new Date(d).toISOString().slice(0, 10);
const NOW = new Date("2026-08-27T12:00:00Z");

console.log("\nBoth sides get the same thing");
ok("the referee gets one month", REFEREE_BONUS_MONTHS === 1, REFEREE_BONUS_MONTHS);
ok("the referrer gets one month", REFERRER_BONUS_MONTHS === 1, REFERRER_BONUS_MONTHS);
// The whole point of the change: a reward measured in TIME, not in the other
// company's money.
ok(
  "and they are equal — one sentence describes the programme",
  REFEREE_BONUS_MONTHS === REFERRER_BONUS_MONTHS,
);

console.log("\nThe owner's worked example: an annual year ending 2027-08-27");
let end = new Date("2027-08-27T00:00:00Z");
const got = [];
for (let i = 0; i < 3; i++) {
  const r = nextAccessEnd({ periodEnd: end, paying: true, months: 1, now: NOW });
  got.push(day(r.until));
  // Stripe reports the new trial_end as current_period_end, so the next
  // referral reads it as the anchor — which is what makes them stack.
  end = r.until;
}
ok("one referral: free to 2027-09-27", got[0] === "2027-09-27", got[0]);
ok("a second: extended to 2027-10-27, not back to September", got[1] === "2027-10-27", got[1]);
ok("a third: 2027-11-27", got[2] === "2027-11-27", got[2]);

console.log("\nMonth to month — the credit lands on the next month");
const monthly = nextAccessEnd({
  periodEnd: new Date("2026-09-27T00:00:00Z"),
  paying: true,
  months: 1,
  now: NOW,
});
ok("a monthly period ending 09-27 runs to 10-27", day(monthly.until) === "2026-10-27", day(monthly.until));
ok("...which is exactly one skipped monthly charge", monthly.from === "period");

console.log("\nStill on trial");
const trial = nextAccessEnd({
  trialEndsAt: new Date("2026-09-26T00:00:00Z"),
  paying: false,
  months: 1,
  now: NOW,
});
ok("the trial is pushed out a month", day(trial.until) === "2026-10-26", day(trial.until));
ok("...from the trial, not from today", trial.from === "trial");

console.log("\nA date in the past never shortens the reward");
// A stale column, or a lapsed subscription. Anchoring to it would hand back a
// month that has already gone by — a reward worth nothing, silently.
for (const [label, args] of [
  ["a stale period end", { periodEnd: new Date("2020-01-01"), paying: true }],
  ["an expired trial", { trialEndsAt: new Date("2020-01-01"), paying: false }],
  ["no dates at all", { paying: false }],
  ["null dates", { periodEnd: null, trialEndsAt: null, paying: true }],
  ["a junk date", { periodEnd: "not a date", paying: true }],
]) {
  const r = nextAccessEnd({ ...args, months: 1, now: NOW });
  ok(`${label} -> a full month from today`, day(r.until) === "2026-09-27" && r.from === "now", day(r.until));
}

console.log("\nCalendar arithmetic, where months are not 30 days");
ok("Jan 31 + 1 month clamps to Feb 28", day(addMonths(new Date("2027-01-31T00:00:00Z"), 1)) === "2027-02-28");
ok("...and to Feb 29 in a leap year", day(addMonths(new Date("2028-01-31T00:00:00Z"), 1)) === "2028-02-29");
ok("Dec 31 + 1 crosses the year", day(addMonths(new Date("2027-12-31T00:00:00Z"), 1)) === "2028-01-31");

console.log("\nThe gift is not taken back on the next invoice");
const src = readFileSync("lib/referrals/extendAccess.js", "utf8");
// Without this, Stripe prorates the deferred period and bills it back — giving
// the month with one hand and invoicing it with the other.
ok('proration_behavior is "none"', /proration_behavior:\s*"none"/.test(src));
ok("the deferral is trial_end on the live subscription", /trial_end:/.test(src));
// The period end is read from Stripe, not from our column: that column is
// written by a webhook, and extending from a stale one silently shortens or
// doubles the reward.
ok("the anchor is read from Stripe, not from our row",
  /stripe\.subscriptions\.retrieve/.test(src));

const ref = readFileSync("lib/referrals/index.js", "utf8");
// Pin moved 2026-10-03: both grants now go through one claim-first helper
// (claimAndExtend), so the referrer's call reads
// claimAndExtend({ companyId: referrer.id, … months: REFERRER_BONUS_MONTHS })
// rather than extendAccessByMonths(referrer.id, REFERRER_BONUS_MONTHS). Still
// access, still never a balance credit — the fixtures below execute it.
ok("the referrer's reward is access, not a balance credit",
  /claimAndExtend\(\{\s*companyId: referrer\.id,[\s\S]{0,120}months: REFERRER_BONUS_MONTHS/.test(ref) &&
    /const grant = await extendAccessByMonths\(companyId, months\)/.test(ref) &&
    !/createBalanceTransaction[\s\S]{0,400}grantReferrerCredit/.test(ref));
ok("the newcomer's month goes through the SAME helper — one way to give a month",
  /claimAndExtend\(\{\s*companyId: company\.id,[\s\S]{0,120}role: "referred",\s*months: REFEREE_BONUS_MONTHS/.test(ref));
// A row with no appliedTrialEndsAt is a reward owed and visibly unpaid. A
// missing row is a reward nobody can find, and the same referral pays twice.
ok("the credit row is written even when the extension fails",
  /appliedTrialEndsAt: grant\.ok \? grant\.until : null/.test(ref));

// ════════════════════════════════════════════════════════════════════════════
// Only once a plan is chosen — executed, not read
// ════════════════════════════════════════════════════════════════════════════

const REAL_NOW = Date.now();
const inDays = (n) => new Date(REAL_NOW + n * 86_400_000);
const SEC = (d) => Math.floor(new Date(d).getTime() / 1000);
const fromSec = (s) => new Date(s * 1000);

function company(id, extra = {}) {
  return {
    id,
    name: `Co ${id}`,
    slug: id,
    logoUrl: null,
    brandColor: null,
    currency: "CAD",
    referralCode: null,
    referredByCode: null,
    referredAt: null,
    referralTerms: null,
    onboardingStatus: "active",
    stripeChargesEnabled: true,
    trialEndsAt: inDays(TRIAL_DAYS),
    influencerAt: null,
    influencerRepId: null,
    ...extra,
  };
}

function fresh() {
  resetDbStub();
  resetStripeStub();
  session.member = null;
}

/** A live Stripe subscription the way checkout leaves it: in trial until `end`. */
function stripeSub(companyId, end, status = "trialing") {
  const id = `sub_${companyId}`;
  stripeState.subscriptions.set(id, {
    id,
    status,
    trial_end: status === "trialing" ? SEC(end) : null,
    current_period_end: SEC(end),
    items: { data: [] },
    metadata: {},
  });
  return id;
}

/** Choosing a plan, through the real writer: the checkout.session.completed upsert. */
async function choosePlan(companyId, end) {
  const subscription = stripeSub(companyId, end);
  await upsertSubscriptionFromCheckoutSession({
    id: `cs_${companyId}`,
    metadata: { companyId, planId: "plan_crew", billingInterval: "month" },
    customer: `cus_${companyId}`,
    subscription,
  });
  return subscription;
}

/** A company that already has a plan, as a row and a live Stripe object. */
function onPlan(companyId, periodEnd = inDays(20)) {
  const subscription = stripeSub(companyId, periodEnd, "active");
  rows.subscription.push({
    id: `subrow_${companyId}`,
    companyId,
    planId: "plan_crew",
    stripeCustomerId: `cus_${companyId}`,
    stripeSubscriptionId: subscription,
    status: "active",
  });
  return subscription;
}

const updatesTo = (subId) =>
  stripeCalls.filter((c) => c.method === "subscriptions.update" && c.args[0] === subId);
const credit = (companyId, role, counterpartyCompanyId) =>
  rows.referralCredit.filter(
    (r) => r.companyId === companyId && r.role === role && r.counterpartyCompanyId === counterpartyCompanyId,
  );
const asMember = (c) => {
  session.member = { companyId: c.id, role: "owner", userId: `u_${c.id}`, impersonation: null };
};
const get = (url) => new Request(url, { headers: { host: "app.fieldquo.com" } });

console.log("\nWhat \"selected a plan\" means");
ok("no Stripe subscription (the card-free trial) → no plan", !hasSelectedPlan(null) && !hasSelectedPlan({ status: "active" }));
ok("trialing, active and past_due on a Stripe subscription → a plan",
  ["trialing", "active", "past_due"].every((status) => hasSelectedPlan({ stripeSubscriptionId: "sub_x", status })));
ok("canceled → no plan", !hasSelectedPlan({ stripeSubscriptionId: "sub_x", status: "canceled" }));

// ── 1. A trial referrer: no link, no reward ─────────────────────────────────
console.log("\n1. A trial referrer: no link, no reward");
fresh();
// "oldhand" was minted before the rule — the link a trial company already
// printed on its van.
const R = company("c_ref", { referralCode: "oldhand", trialEndsAt: inDays(9) });
const N = company("c_new", { trialEndsAt: inDays(5) });
rows.company.push(R, N);
ok("a company on the free trial has not selected a plan", !(await companyHasSelectedPlan(R.id)));

asMember(R);
{
  const res = await referralGET(get("https://app.fieldquo.com/api/settings/referral"));
  const body = await res.json();
  ok("Refer & Earn answers canRefer: false for a trial company", res.status === 200 && body.canRefer === false, JSON.stringify(body));
  ok("…with no link, even though a code was minted before the rule", body.referralUrl === null && body.referralCode === null);
  ok("…and the way to choose a plan", body.choosePlanHref === "/app/settings/account-billing");
}
{
  const T = company("c_trial2");
  rows.company.push(T);
  asMember(T);
  writes.length = 0;
  const body = await (await referralGET(get("https://app.fieldquo.com/api/settings/referral"))).json();
  ok("a trial company with no code gets none minted by opening the page",
    body.referralCode === null && !writes.some((w) => w.model === "company" && w.action === "update"));
}
asMember(R);
{
  const res = await invitePOST(new Request("https://app.fieldquo.com/api/settings/referral/invite", {
    method: "POST",
    headers: { "content-type": "application/json", host: "app.fieldquo.com" },
    body: JSON.stringify({ channel: "email", contact: "dave@example.com" }),
  }));
  const body = await res.json();
  ok("sending an invite is refused (403 no_plan), not just hidden", res.status === 403 && body.code === "no_plan", `${res.status} ${JSON.stringify(body)}`);
  ok("…and nothing was sent or logged as sent", rows.referralInvite.length === 0);
}
{
  const res = await publicReferGET(get("https://app.fieldquo.com/api/public/refer/oldhand"), { params: Promise.resolve({ code: "oldhand" }) });
  const body = await res.json();
  ok("the trial company's old link still resolves — a newcomer can still sign up", res.status === 200 && body.valid === true);
  ok("…but it promises no month (months: 0, so the signup shows no bonus banner)", body.months === 0, body.months);
}
{
  const trialBefore = N.trialEndsAt.getTime();
  const signed = await applySignupReferral({ company: N, code: "OldHand" });
  const stored = rows.company.find((c) => c.id === N.id);
  ok("the newcomer signs up through the link", signed?.referrer?.id === R.id && stored.referredByCode === "oldhand");
  ok("…under the plan-required terms", stored.referralTerms === REFERRAL_TERMS_PLAN_REQUIRED, stored.referralTerms);
  ok("…promised nothing, because the referrer has no plan", signed.bonusMonths === 0);
  ok("…its trial NOT extended at signup", stored.trialEndsAt.getTime() === trialBefore);
  ok("…and no ReferralCredit row written at signup", rows.referralCredit.length === 0);
}
await choosePlan(N.id, N.trialEndsAt);
ok("the newcomer chooses a plan (through the checkout upsert)", await companyHasSelectedPlan(N.id));
ok("…and gets no month: at that moment its referrer has no plan",
  credit(N.id, "referred", R.id).length === 0 && updatesTo(`sub_${N.id}`).length === 0);
{
  const referrerTrial = rows.company.find((c) => c.id === R.id).trialEndsAt.getTime();
  const held = await grantReferrerCredit({ paidCompanyId: N.id, paidAmountCents: 12900, currency: "cad" });
  ok("the newcomer's first payment earns a plan-less referrer nothing at that moment",
    held === null && credit(R.id, "referrer", N.id).length === 0);
  ok("…not even a trial extension", rows.company.find((c) => c.id === R.id).trialEndsAt.getTime() === referrerTrial);
}

// ── 2. The referrer chooses a plan later: the reward then, once ────────────
console.log("\n2. The referrer chooses a plan later: the held month then, once");
// The newcomer's paid invoice, and an AI-bundle invoice on the same Stripe
// customer that must never be read as the plan.
stripeState.invoices.push(
  { id: "in_bundle", customer: `cus_${N.id}`, subscription: "sub_bundle", status: "paid", amount_paid: 3000, currency: "cad", billing_reason: "subscription_cycle" },
  { id: "in_n1", customer: `cus_${N.id}`, subscription: `sub_${N.id}`, status: "paid", amount_paid: 12900, currency: "cad", billing_reason: "subscription_cycle" },
);
{
  const referrerTrialEnd = rows.company.find((c) => c.id === R.id).trialEndsAt;
  const subR = await choosePlan(R.id, referrerTrialEnd);
  const rows1 = credit(R.id, "referrer", N.id);
  const expected = addMonths(fromSec(SEC(referrerTrialEnd)), REFERRER_BONUS_MONTHS);
  ok("the held month is granted the moment the referrer chooses a plan", rows1.length === 1);
  ok("…as a deferral of the referrer's first charge: its trial end + one month",
    rows1[0] && day(rows1[0].appliedTrialEndsAt) === day(expected), rows1[0] && day(rows1[0].appliedTrialEndsAt));
  const u = updatesTo(subR);
  ok("…sent to Stripe as trial_end with proration_behavior none",
    u.length === 1 && u[0].args[1].trial_end === SEC(expected) && u[0].args[1].proration_behavior === "none", JSON.stringify(u.map((c) => c.args[1])));
  ok("…found through the plan's own invoice, never the bundle's",
    stripeCalls.some((c) => c.method === "invoices.list" && c.args[0].subscription === `sub_${N.id}`));

  await onPlanSelected(R.id);
  await choosePlan(R.id, fromSec(stripeState.subscriptions.get(subR).current_period_end)).catch(() => {});
  const again = await grantReferrerCredit({ paidCompanyId: N.id, paidAmountCents: 12900, currency: "cad" });
  ok("never twice: a replayed plan selection and the next renewal grant nothing more",
    again === null && credit(R.id, "referrer", N.id).length === 1 && updatesTo(subR).length === 1, `${updatesTo(subR).length} updates`);
}
ok("the newcomer's own month is not granted after the fact — it was re-checked when it chose its plan",
  credit(N.id, "referred", R.id).length === 0);

// ── 3. The newcomer's month lands at plan selection, not signup ─────────────
console.log("\n3. The newcomer's month: at plan selection, not signup");
fresh();
const R2 = company("c_r2", { referralCode: "sunsetinc" });
// Signed up nine days ago: five days of a fourteen-day trial left.
const N2 = company("c_n2", { trialEndsAt: inDays(5) });
rows.company.push(R2, N2);
const subR2 = onPlan(R2.id, inDays(20));
{
  const body = await (await publicReferGET(get("https://app.fieldquo.com/api/public/refer/sunsetinc"), { params: Promise.resolve({ code: "sunsetinc" }) })).json();
  ok("a referrer on a plan: the link promises the month", body.months === REFEREE_BONUS_MONTHS && body.appliesWhen === "plan_selected");
  asMember(R2);
  const mine = await (await referralGET(get("https://app.fieldquo.com/api/settings/referral"))).json();
  ok("…and Refer & Earn hands it its link", mine.canRefer === true && /\/refer\/sunsetinc$/.test(mine.referralUrl || ""), mine.referralUrl);
}
const trialBefore2 = N2.trialEndsAt.getTime();
{
  const signed = await applySignupReferral({ company: N2, code: "sunsetinc" });
  ok("signup records the referral and promises one month — for later", signed?.bonusMonths === REFEREE_BONUS_MONTHS);
  ok("…but writes no month: the trial is untouched and there is no credit row",
    rows.company.find((c) => c.id === N2.id).trialEndsAt.getTime() === trialBefore2 && rows.referralCredit.length === 0);
}
const subN2 = await choosePlan(N2.id, N2.trialEndsAt);
{
  const expected = addMonths(fromSec(SEC(N2.trialEndsAt)), REFEREE_BONUS_MONTHS);
  const r = credit(N2.id, "referred", R2.id);
  ok("choosing a plan grants the newcomer's month", r.length === 1 && r[0].months === REFEREE_BONUS_MONTHS);
  const u = updatesTo(subN2);
  ok("…by moving Stripe's trial_end from the trial's end to one month later",
    u.length === 1 && u[0].args[1].trial_end === SEC(expected) && u[0].args[1].proration_behavior === "none", JSON.stringify(u.map((c) => c.args[1])));
  ok("…recorded on the row", r[0] && day(r[0].appliedTrialEndsAt) === day(expected));
  ok("…and Company.trialEndsAt (the trial itself) is not what moved", rows.company.find((c) => c.id === N2.id).trialEndsAt.getTime() === trialBefore2);
  // The webhook and the on-return reconcile both land on the upsert.
  await upsertSubscriptionFromCheckoutSession({ id: "cs_replay", metadata: { companyId: N2.id, planId: "plan_crew", billingInterval: "month" }, customer: `cus_${N2.id}`, subscription: subN2 });
  ok("a replayed checkout grants nothing more", credit(N2.id, "referred", R2.id).length === 1 && updatesTo(subN2).length === 1);
}
{
  const before = updatesTo(subR2).length;
  const g = await grantReferrerCredit({ paidCompanyId: N2.id, paidAmountCents: 12900, currency: "cad" });
  const live = stripeState.subscriptions.get(subR2);
  ok("the newcomer's first payment then earns the referrer (on a plan) its month",
    g?.referrerId === R2.id && credit(R2.id, "referrer", N2.id).length === 1 && updatesTo(subR2).length === before + 1);
  ok("…its next charge moved from its period end to one month later",
    day(fromSec(live.trial_end)) === day(addMonths(inDays(20), 1)), day(fromSec(live.trial_end)));
}

console.log("\n   Worked example — signed up 1 Oct, chose Crew 10 Oct");
{
  const SIGNUP = new Date("2026-10-01T15:00:00Z");
  const CHOSE = new Date("2026-10-10T15:00:00Z");
  const trialEnd = new Date(SIGNUP.getTime() + TRIAL_DAYS * 86_400_000);
  ok("the 14-day trial ends 15 Oct — and signup no longer adds a month to it", day(trialEnd) === "2026-10-15", day(trialEnd));
  const days = trialDaysAllowed({ trialEndsAt: trialEnd }, { now: CHOSE });
  ok("choosing Crew on 10 Oct opens Stripe with the 5 trial days left (trial_end 15 Oct)", days === 5, days);
  const stripeTrialEnd = new Date(CHOSE.getTime() + days * 86_400_000);
  const { until } = nextAccessEnd({ periodEnd: stripeTrialEnd, paying: true, months: REFEREE_BONUS_MONTHS, now: CHOSE });
  ok("the referral month moves the first charge from 15 Oct to 15 Nov", day(until) === "2026-11-15", day(until));
  const late = nextAccessEnd({ periodEnd: new Date("2026-11-20T15:00:00Z"), paying: true, months: 1, now: new Date("2026-10-20T15:00:00Z") });
  ok("chosen after the trial ran out (20 Oct, charged that day): the next charge moves 20 Nov → 20 Dec", day(late.until) === "2026-12-20", day(late.until));
}

// ── 4. A pre-change referral: untouched ─────────────────────────────────────
console.log("\n4. A referral made before the rule: untouched");
fresh();
const R0 = company("c_r0", { referralCode: "legacyco", trialEndsAt: inDays(3) });
// Referred 2026-09-20 under the old terms: the month was added to the trial
// at signup and the row says so.
const extendedTrial = inDays(25);
const L = company("c_legacy", { referredByCode: "legacyco", referredAt: new Date("2026-09-20T12:00:00Z"), referralTerms: null, trialEndsAt: extendedTrial });
rows.company.push(R0, L);
rows.referralCredit.push(
  { id: "rc_legacy", companyId: L.id, counterpartyCompanyId: R0.id, role: "referred", months: 1, appliedTrialEndsAt: extendedTrial, creditCents: null, currency: null, stripeBalanceTxnId: null, createdAt: new Date("2026-09-20T12:00:01Z") },
  // One of the two historical dollar-credit rows from before 2026-08-27.
  { id: "rc_hist", companyId: "c_old", counterpartyCompanyId: "c_oldnew", role: "referrer", months: 1, appliedTrialEndsAt: null, creditCents: 12900, currency: "CAD", stripeBalanceTxnId: "cbtxn_1", createdAt: new Date("2026-08-01T00:00:00Z") },
);
const ORIGINAL = new Set(["rc_legacy", "rc_hist"]);
const snapshot = JSON.stringify(rows.referralCredit.filter((r) => ORIGINAL.has(r.id)));
const subL = await choosePlan(L.id, extendedTrial);
ok("a newcomer referred before the rule gets no second month when it chooses a plan",
  credit(L.id, "referred", R0.id).length === 1 && updatesTo(subL).length === 0);
ok("…its extended trial end is exactly what it was",
  rows.company.find((c) => c.id === L.id).trialEndsAt.getTime() === extendedTrial.getTime());
{
  const before = rows.company.find((c) => c.id === R0.id).trialEndsAt;
  const g = await grantReferrerCredit({ paidCompanyId: L.id, paidAmountCents: 12900, currency: "cad" });
  const after = rows.company.find((c) => c.id === R0.id).trialEndsAt;
  ok("its referrer is paid on the terms of the day: on the first payment, plan or no plan",
    g?.referrerId === R0.id && credit(R0.id, "referrer", L.id).length === 1);
  ok("…which, for a referrer still on trial, is the old trial extension", day(after) === day(addMonths(before, 1)), `${day(before)} → ${day(after)}`);
}
ok("the rows that existed before are byte-for-byte unchanged",
  JSON.stringify(rows.referralCredit.filter((r) => ORIGINAL.has(r.id))) === snapshot);
ok("nothing was deleted from ReferralCredit, and every update touched a row written in this run",
  !writes.some((w) => w.model === "referralCredit" && /delete/i.test(w.action)) &&
    writes.filter((w) => w.model === "referralCredit" && w.action === "update").every((w) => !ORIGINAL.has(w.where?.id)) &&
    rows.referralCredit.length === 3);

// ── 5. Double-grant attempts ────────────────────────────────────────────────
console.log("\n5. Double-grant attempts are refused");
fresh();
const R3 = company("c_r3", { referralCode: "r3co" });
const N3 = company("c_n3", { referredByCode: "r3co", referredAt: new Date(), referralTerms: REFERRAL_TERMS_PLAN_REQUIRED, trialEndsAt: inDays(4) });
rows.company.push(R3, N3);
const subR3 = onPlan(R3.id, inDays(12));
const subN3 = onPlan(N3.id, inDays(4));
stripeState.subscriptions.get(subN3).status = "trialing";
{
  const results = await Promise.all([grantRefereeBonus(N3.id), grantRefereeBonus(N3.id), onPlanSelected(N3.id)]);
  ok("three concurrent plan-selection grants: one month, one row, one Stripe call",
    results.filter((r) => (r?.referee ?? r)?.months).length === 1 && credit(N3.id, "referred", R3.id).length === 1 && updatesTo(subN3).length === 1,
    `${credit(N3.id, "referred", R3.id).length} rows, ${updatesTo(subN3).length} calls`);
}
{
  const pays = await Promise.all([1, 2, 3].map(() => grantReferrerCredit({ paidCompanyId: N3.id, paidAmountCents: 12900, currency: "cad" })));
  ok("three concurrent paid-invoice deliveries: one referrer month",
    pays.filter(Boolean).length === 1 && credit(R3.id, "referrer", N3.id).length === 1 && updatesTo(subR3).length === 1);
}
ok("a $0 invoice earns nothing", (await grantReferrerCredit({ paidCompanyId: N3.id, paidAmountCents: 0 })) === null);
{
  // A newcomer whose only paid invoice is an AI bundle's: its referrer
  // choosing a plan must not read that as the plan being paid.
  const R4 = company("c_r4", { referralCode: "r4co", trialEndsAt: inDays(6) });
  const N4 = company("c_n4", { referredByCode: "r4co", referredAt: new Date(), referralTerms: REFERRAL_TERMS_PLAN_REQUIRED });
  rows.company.push(R4, N4);
  onPlan(N4.id, inDays(30));
  stripeState.invoices.push({ id: "in_b4", customer: `cus_${N4.id}`, subscription: "sub_bundle4", status: "paid", amount_paid: 3000, currency: "cad", billing_reason: "subscription_create" });
  await choosePlan(R4.id, R4.trialEndsAt);
  ok("a bundle invoice is not the plan paid: no referrer month from it", credit(R4.id, "referrer", N4.id).length === 0);
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
