// scripts/check-billing-sync.mjs
//
//   npm run check:billing-sync
//
// The Subscription row agrees with Stripe without a webhook.
//
// ══ The bug this guards ════════════════════════════════════════════════════
//
// 2026-09-13, the owner's own $1 live payment test: he cancelled from the
// product, Stripe ended the subscription at once, and the row said `active`
// for the rest of the day. The cancel route wrote nothing and waited for
// customer.subscription.deleted; no Stripe event had reached the deployment
// all day. Every screen then offered a pause, a plan change and a second
// cancel that Stripe refused, each shown as a 502 "try again". A second bug
// sat under the discount offer: the coupon name was 41 characters, Stripe's
// cap is 40, so no discount had ever been applied.
//
// ══ What is EXECUTED rather than read ══════════════════════════════════════
//
//   subscriptionFieldsFromStripe  every Stripe status, canceled_at present and
//                                 absent, the period end on the object and on
//                                 the item, trial_end present and absent
//   subscriptionDrift             which columns a row got wrong
//   isCanceledSubscriptionError   the three phrasings Stripe used that day
//   writeSubscriptionFromStripe / syncSubscriptionFromStripe
//                                 against the db and Stripe fakes: the row is
//                                 written, the company churned, a missing
//                                 subscription is NOT written as cancelled
//   syncSubscriptionFromStripeEvent (deleted) — the webhook path through the
//                                 same mapping, canceledAt from Stripe's clock
//   stampWebhookReceived / stripeWebhookHealth — the stamp round-trips, and
//                                 an endpoint that never stamped answers null
//   the billing-sync cron route   a drifted row is corrected AND filed as
//                                 billing_drift; an agreeing row files nothing
//   retentionCouponName           ≤ 40 characters for a real cuid
//
// Source pins cover only what cannot be executed offline: that the cancel
// route writes from Stripe's reply BEFORE notify/activity, that both webhook
// routes stamp after signature verification, that the retention route answers
// a cancelled state rather than offers, and that every new string is in all
// nine language blocks.
//
// Run: node --import ./scripts/alias-loader.mjs --import ./scripts/db-stub-loader.mjs \
//           --import ./scripts/billing-stub-loader.mjs scripts/check-billing-sync.mjs

import { readFileSync } from "node:fs";
import {
  subscriptionFieldsFromStripe,
  subscriptionStatusFromStripe,
  subscriptionDrift,
  isCanceledSubscriptionError,
  periodEndFromStripe,
} from "@/lib/billing/subscriptionFields";
import { retentionCouponName, STRIPE_COUPON_NAME_MAX } from "@/lib/billing/retention";
import { syncSubscriptionFromStripe, writeSubscriptionFromStripe } from "@/lib/platform/stripeSync";
import { syncSubscriptionFromStripeEvent } from "@/lib/platform/stripeBilling";
import { stampWebhookReceived, stripeWebhookHealth, webhookStampKey } from "@/lib/platform/webhookHealth";
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";
import { state, resetStripeStub } from "./fixtures/stripeStub.mjs";
import { resetNotifyStub } from "./fixtures/notifyStub.mjs";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);
const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const resetAll = () => { resetDbStub(); resetStripeStub(); resetNotifyStub(); };

const T0 = 1_757_800_000; // seconds; an instant in 2026-09
const COMPANY = "cmtzyunut000004jncwlnob1g";
const SUB = "sub_1UFFM8PvqBqmizLgAAgmWLXT";

// ── 1. The mapping ──────────────────────────────────────────────────────────
console.log("\n── 1. subscriptionFieldsFromStripe ─────────────────────────────");
{
  const canceled = subscriptionFieldsFromStripe({
    id: SUB, status: "canceled", canceled_at: T0, current_period_end: T0 + 86400 * 20, trial_end: null,
    items: { data: [{ price: { recurring: { interval: "month" } } }] },
  });
  ok("canceled → status canceled", canceled.status === "canceled", canceled);
  ok("canceledAt is STRIPE's clock, not ours", canceled.canceledAt?.getTime() === T0 * 1000, canceled.canceledAt);
  ok("period end kept from the object", canceled.currentPeriodEnd?.getTime() === (T0 + 86400 * 20) * 1000);
  ok("trialEndsAt is null when Stripe has no trial (a statement, not a gap)", canceled.trialEndsAt === null);
  ok("pastDueSince cleared and the pending change cleared", canceled.pastDueSince === null && canceled.pendingPlanId === null && canceled.stripeScheduleId === null);
  ok("billingInterval read off the item's price", canceled.billingInterval === "month");

  const NOW = new Date("2026-09-13T21:00:00Z");
  const noStamp = subscriptionFieldsFromStripe({ id: SUB, status: "canceled" }, { now: NOW });
  ok("canceled with no canceled_at falls back to the caller's `now`", noStamp.canceledAt === NOW);

  const active = subscriptionFieldsFromStripe({ id: SUB, status: "active", trial_end: null, current_period_end: T0 });
  ok("active → grace clock and both warning markers cleared", active.pastDueSince === null && active.graceWarnedAt === null && active.graceFinalWarnedAt === null);
  ok("active never writes canceledAt", !("canceledAt" in active), active);

  const trialing = subscriptionFieldsFromStripe({ id: SUB, status: "trialing", trial_end: T0 + 86400 * 30 });
  ok("trialing keeps trialEndsAt from trial_end", trialing.trialEndsAt?.getTime() === (T0 + 86400 * 30) * 1000);

  const pastDue = subscriptionFieldsFromStripe({ id: SUB, status: "past_due", current_period_end: T0 });
  ok("past_due leaves pastDueSince alone (markPastDue owns the start)", !("pastDueSince" in pastDue), pastDue);

  ok("unpaid maps to past_due — not a Prisma enum error", subscriptionStatusFromStripe("unpaid") === "past_due");
  ok("paused (Stripe's, not ours) maps to past_due", subscriptionStatusFromStripe("paused") === "past_due");
  ok("incomplete_expired maps to canceled", subscriptionStatusFromStripe("incomplete_expired") === "canceled");
  ok("incomplete writes nothing", subscriptionStatusFromStripe("incomplete") === undefined);
  const inc = subscriptionFieldsFromStripe({ id: SUB, status: "incomplete" });
  ok("…so the mapped fields carry no status for it", !("status" in inc), inc);
  ok("an unknown status writes nothing rather than a bad enum", subscriptionStatusFromStripe("whatever") === undefined);

  const onItem = periodEndFromStripe({ items: { data: [{ current_period_end: T0 + 5 }, { current_period_end: T0 + 9 }] } });
  ok("period end read off the items when the object lacks it (basil API shape)", onItem?.getTime() === (T0 + 9) * 1000);
  ok("no period end anywhere → not written", !("currentPeriodEnd" in subscriptionFieldsFromStripe({ id: SUB, status: "active" })));

  let threw = false;
  try { subscriptionFieldsFromStripe(null); } catch { threw = true; }
  ok("refuses a non-object rather than writing an empty row", threw);
  threw = false;
  try { subscriptionFieldsFromStripe({ status: "active" }); } catch { threw = true; }
  ok("refuses an object with no id", threw);
}

// ── 2. Drift ────────────────────────────────────────────────────────────────
console.log("\n── 2. subscriptionDrift ────────────────────────────────────────");
{
  const row = { status: "active", canceledAt: null, currentPeriodEnd: null, trialEndsAt: null, billingInterval: "month" };
  const fields = subscriptionFieldsFromStripe({ id: SUB, status: "canceled", canceled_at: T0 });
  const drift = subscriptionDrift(row, fields);
  const names = drift.map((d) => d.field);
  ok("the owner's row: status and canceledAt differ", names.includes("status") && names.includes("canceledAt"), names);
  ok("billingInterval not flagged when Stripe did not say", !names.includes("billingInterval"), names);
  ok("each entry carries before and after", drift.every((d) => "before" in d && "after" in d));
  const same = subscriptionDrift(
    // cancelAtPeriodEnd false / cancelAt null: what every real row holds
    // (schema defaults) — the mapping clears both on a canceled object.
    { status: "canceled", canceledAt: new Date(T0 * 1000), trialEndsAt: null, cancelAtPeriodEnd: false, cancelAt: null },
    subscriptionFieldsFromStripe({ id: SUB, status: "canceled", canceled_at: T0 }),
  );
  ok("a row that agrees drifts nowhere (dates compared by instant)", same.length === 0, same);
}

// ── 3. The three phrasings ──────────────────────────────────────────────────
console.log("\n── 3. isCanceledSubscriptionError ──────────────────────────────");
{
  const inv = (message) => Object.assign(new Error(message), { type: "StripeInvalidRequestError" });
  ok("pause: 'A canceled subscription can only update…'", isCanceledSubscriptionError(inv("A canceled subscription can only update its cancellation_details and metadata.")));
  ok("plan change: 'cannot migrate … canceled status'", isCanceledSubscriptionError(inv("You cannot migrate a subscription that is currently in the canceled status.")));
  ok("cancel again: resource_missing", isCanceledSubscriptionError(Object.assign(new Error("No such subscription: 'sub_x'"), { code: "resource_missing" })));
  ok("a card decline is NOT read as cancelled", !isCanceledSubscriptionError(Object.assign(new Error("Your card was declined."), { type: "StripeCardError", code: "card_declined" })));
  ok("a rate limit is NOT read as cancelled", !isCanceledSubscriptionError(Object.assign(new Error("Too many requests"), { type: "StripeRateLimitError" })));
  ok("null is not an error", !isCanceledSubscriptionError(null));
}

// ── 4. The write, executed against the fakes ────────────────────────────────
console.log("\n── 4. writeSubscriptionFromStripe / syncSubscriptionFromStripe ──");
{
  resetAll();
  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s1", companyId: COMPANY, stripeSubscriptionId: SUB, status: "active", canceledAt: null, currentPeriodEnd: null, trialEndsAt: null, billingInterval: "month" });
  rows.company.push({ id: COMPANY, onboardingStatus: "active" });
  state.subscriptions.set(SUB, { id: SUB, status: "canceled", canceled_at: T0, current_period_end: T0 + 100, trial_end: null, items: { data: [] } });

  const r = await syncSubscriptionFromStripe(COMPANY);
  ok("sync ok, Stripe status reported", r.ok && r.stripeStatus === "canceled", r);
  ok("before/after both present", r.before?.status === "active" && r.after?.status === "canceled", r);
  ok("changed lists status and canceledAt", r.changed.map((c) => c.field).includes("status") && r.changed.map((c) => c.field).includes("canceledAt"), r.changed);
  const row = rows.subscription[0];
  ok("the ROW now says canceled with Stripe's canceledAt", row.status === "canceled" && row.canceledAt?.getTime() === T0 * 1000, row);
  ok("the company is churned, as the deleted webhook would", rows.company[0].onboardingStatus === "churned");

  // Idempotent: a second run changes nothing and writes nothing.
  const writesBefore = writes.length;
  const r2 = await syncSubscriptionFromStripe(COMPANY);
  ok("second sync: no drift, no write", r2.ok && r2.changed.length === 0 && writes.length === writesBefore, { changed: r2.changed, writes: writes.length - writesBefore });

  // A row already cancelled keeps its own canceledAt when Stripe's is absent.
  resetAll();
  const earlier = new Date("2026-08-01T00:00:00Z");
  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s1", companyId: COMPANY, stripeSubscriptionId: SUB, status: "canceled", canceledAt: earlier, trialEndsAt: null });
  rows.company.push({ id: COMPANY });
  state.subscriptions.set(SUB, { id: SUB, status: "canceled", canceled_at: null, trial_end: null });
  const r3 = await syncSubscriptionFromStripe(COMPANY);
  ok("no canceled_at from Stripe → the row's own canceledAt is kept (window not restarted)", r3.changed.length === 0 && rows.subscription[0].canceledAt === earlier, r3.changed);

  // Missing at Stripe is NOT cancelled.
  resetAll();
  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s1", companyId: COMPANY, stripeSubscriptionId: SUB, status: "active", trialEndsAt: null });
  rows.company.push({ id: COMPANY, onboardingStatus: "active" });
  const r4 = await syncSubscriptionFromStripe(COMPANY);
  ok("'No such subscription' → reason stripe_missing, nothing written", !r4.ok && r4.reason === "stripe_missing" && rows.subscription[0].status === "active" && writes.length === 0, r4);
  ok("…and the company is not churned", rows.company[0].onboardingStatus === "active");

  resetAll();
  const r5 = await syncSubscriptionFromStripe("nobody");
  ok("no row → no_row, not a throw", !r5.ok && r5.reason === "no_row");
  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s2", companyId: "c2", stripeSubscriptionId: null, status: "trialing" });
  const r6 = await syncSubscriptionFromStripe("c2");
  ok("no Stripe id → no_stripe_subscription", !r6.ok && r6.reason === "no_stripe_subscription");

  // writeSubscriptionFromStripe directly, as the cancel route calls it.
  resetAll();
  const sub = { id: "s1", companyId: COMPANY, stripeSubscriptionId: SUB, status: "active", canceledAt: null, trialEndsAt: null };
  rows.subscription.push(sub);
  rows.company.push({ id: COMPANY, onboardingStatus: "active" });
  const w = await writeSubscriptionFromStripe(COMPANY, { id: SUB, status: "canceled", canceled_at: T0 }, { row: sub });
  ok("the cancel route's write: row cancelled from Stripe's reply, no retrieve needed", rows.subscription[0].status === "canceled" && w.changed.length >= 2 && rows.company[0].onboardingStatus === "churned", w);
}

// ── 5. The webhook path through the same mapping ────────────────────────────
console.log("\n── 5. customer.subscription.deleted ────────────────────────────");
{
  resetAll();
  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s1", companyId: COMPANY, stripeSubscriptionId: SUB, status: "active", canceledAt: null, pastDueSince: new Date(), pendingPlanId: "p9", stripeScheduleId: "sched_1" });
  rows.company.push({ id: COMPANY, onboardingStatus: "active" });
  await syncSubscriptionFromStripeEvent({ type: "customer.subscription.deleted", data: { object: { id: SUB, status: "canceled", canceled_at: T0, current_period_end: T0 + 5 } } });
  const row = rows.subscription[0];
  ok("webhook: status canceled, canceledAt from Stripe", row.status === "canceled" && row.canceledAt?.getTime() === T0 * 1000, row);
  ok("webhook: grace clock and pending change cleared", row.pastDueSince === null && row.pendingPlanId === null && row.stripeScheduleId === null, row);
  ok("webhook: company churned", rows.company[0].onboardingStatus === "churned");

  // updated with a status outside our enum must not throw.
  resetAll();
  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s1", companyId: COMPANY, stripeSubscriptionId: SUB, status: "active", planId: "p1" });
  rows.company.push({ id: COMPANY });
  let threw = null;
  try {
    await syncSubscriptionFromStripeEvent({ type: "customer.subscription.updated", data: { object: { id: SUB, status: "unpaid", metadata: {} } } });
  } catch (e) { threw = e; }
  ok("webhook: `unpaid` is mapped, not thrown at Prisma", !threw && rows.subscription[0].status === "past_due", threw?.message || rows.subscription[0].status);
}

// ── 6. The stamp ────────────────────────────────────────────────────────────
console.log("\n── 6. stampWebhookReceived / stripeWebhookHealth ───────────────");
{
  resetAll();
  const empty = await stripeWebhookHealth();
  ok("nothing stamped → both endpoints null (\"never\")", empty.billing === null && empty.connect === null, empty);
  await stampWebhookReceived("billing", { id: "evt_1", type: "invoice.paid" });
  const one = await stripeWebhookHealth();
  ok("billing stamped: at / eventId / type round-trip", one.billing?.eventId === "evt_1" && one.billing?.type === "invoice.paid" && typeof one.billing?.at === "string", one);
  ok("connect still null — the two are separate facts", one.connect === null);
  await stampWebhookReceived("billing", { id: "evt_2", type: "customer.subscription.deleted" });
  ok("a second stamp replaces the first (one row per endpoint)", rows.platformSetting.length === 1 && rows.platformSetting[0].value.eventId === "evt_2", rows.platformSetting);
  ok("key is stripe_webhook_last.<endpoint>", rows.platformSetting[0].key === webhookStampKey("billing") && webhookStampKey("connect") === "stripe_webhook_last.connect");
  await stampWebhookReceived("bogus", { id: "evt_3" });
  ok("an unknown endpoint is ignored, not stored", rows.platformSetting.length === 1);
}

// ── 7. The drift cron, executed ─────────────────────────────────────────────
console.log("\n── 7. /api/cron/billing-sync ───────────────────────────────────");
{
  resetAll();
  process.env.CRON_SECRET = "check-secret";
  const { GET } = await import("../app/api/cron/billing-sync/route.js");
  const req = (auth) => new Request("http://x/api/cron/billing-sync", { headers: auth ? { authorization: auth } : {} });

  const denied = await GET(req("Bearer wrong"));
  ok("wrong secret → 401", denied.status === 401);

  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s1", companyId: "c-drift", stripeSubscriptionId: "sub_drift", status: "active", canceledAt: null, trialEndsAt: null, updatedAt: new Date(1) });
  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s2", companyId: "c-fine", stripeSubscriptionId: "sub_fine", status: "active", canceledAt: null, trialEndsAt: null, updatedAt: new Date(2) });
  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s3", companyId: "c-gone", stripeSubscriptionId: "sub_gone", status: "active", canceledAt: null, trialEndsAt: null, updatedAt: new Date(3) });
  rows.subscription.push({ cancelAtPeriodEnd: false, cancelAt: null, id: "s4", companyId: "c-nostripe", stripeSubscriptionId: null, status: "trialing", updatedAt: new Date(4) });
  rows.company.push({ id: "c-drift", onboardingStatus: "active" }, { id: "c-fine" }, { id: "c-gone" }, { id: "c-nostripe" });
  state.subscriptions.set("sub_drift", { id: "sub_drift", status: "canceled", canceled_at: T0, trial_end: null });
  state.subscriptions.set("sub_fine", { id: "sub_fine", status: "active", trial_end: null });

  const res = await GET(req("Bearer check-secret"));
  const body = await res.json();
  ok("200 with a summary", res.status === 200 && body.ok === true, body);
  ok("the null-id row is not checked", body.checked === 3, body.checked);
  ok("one drifted, one missing, none erroring", body.drifted === 1 && body.missing === 1 && body.errors === 0, body);
  const drift = rows.platformErrorLog.filter((e) => e.code === "billing_drift");
  ok("the drifted row is filed as billing_drift for its company", drift.length === 1 && drift[0].companyId === "c-drift" && drift[0].area === "billing", drift);
  ok("…naming the fields that differed", Array.isArray(drift[0]?.detail?.changed) && drift[0].detail.changed.some((c) => c.field === "status") && /status active → canceled/.test(drift[0].message), drift[0]?.message);
  ok("…and the row itself is corrected", rows.subscription[0].status === "canceled" && rows.subscription[0].canceledAt?.getTime() === T0 * 1000);
  ok("the agreeing row files nothing", !rows.platformErrorLog.some((e) => e.companyId === "c-fine"));
  const missing = rows.platformErrorLog.filter((e) => e.code === "billing_sync_missing");
  ok("the missing-at-Stripe row is filed as billing_sync_missing and left active", missing.length === 1 && missing[0].companyId === "c-gone" && rows.subscription[2].status === "active", missing);
}

// ── 8. The coupon name ──────────────────────────────────────────────────────
console.log("\n── 8. retentionCouponName ──────────────────────────────────────");
{
  const name = retentionCouponName(COMPANY);
  ok(`"${name}" is ${name.length} chars, within Stripe's ${STRIPE_COUPON_NAME_MAX}`, name.length <= STRIPE_COUPON_NAME_MAX);
  ok("the old shape really was over the cap (the bug, reproduced)", `Retention 25% — ${COMPANY}`.length > STRIPE_COUPON_NAME_MAX);
  ok("distinct companies get distinct names", retentionCouponName("cmtzyunut000004jncwlnob1g") !== retentionCouponName("cmtzyunut000004jncwlnob2h"));
  ok("a junk id still yields a bounded name", retentionCouponName(undefined).length <= STRIPE_COUPON_NAME_MAX);
}

// ── 9. Source pins ──────────────────────────────────────────────────────────
console.log("\n── 9. The routes, pinned ───────────────────────────────────────");
{
  const cancel = stripComments(read("app/api/platform/billing/cancel/route.js"));
  ok("cancel route writes the row from Stripe's reply", /writeSubscriptionFromStripe\(member\.companyId,\s*\{\s*\.\.\.cancelled,\s*status:\s*"canceled"\s*\}/.test(cancel));
  ok("…BEFORE the email and the activity row",
    cancel.indexOf("writeSubscriptionFromStripe(member.companyId") < cancel.indexOf("notifyCancellation(") &&
    cancel.indexOf("writeSubscriptionFromStripe(member.companyId") < cancel.indexOf("recordActivity("));
  ok("…and an already-cancelled refusal from Stripe is a state, not a 500", /isCanceledSubscriptionError\(err\)/.test(cancel) && /alreadyCancelled: true/.test(cancel));
  ok("…with no 'canceledAt is NOT set here' left behind", !/canceledAt is NOT set here/.test(read("app/api/platform/billing/cancel/route.js")));

  const retention = stripComments(read("app/api/settings/subscription/retention/route.js"));
  ok("retention GET answers state: canceled with NO offers", /state: "canceled"/.test(retention) && /offers: \[\]/.test(retention) && /if \(canceled\) return canceledResponse\(canceled\)/.test(retention));
  ok("retention POST refuses 409 on a cancelled subscription, before any offer", /if \(canceled\) \{\s*return NextResponse\.json\(\s*\{ error: "This subscription is already cancelled\."/.test(retention));
  ok("retention heals the row from the live read", /writeSubscriptionFromStripe\(companyId, live, \{ row: sub \}\)/.test(retention));
  ok("retention's catch distinguishes Stripe's cancelled refusal from 'try again'", /isCanceledSubscriptionError\(err\)/.test(retention) && retention.indexOf("isCanceledSubscriptionError(err)") < retention.indexOf("We couldn't apply that just now"));
  ok("retention uses the bounded coupon name", /name: retentionCouponName\(member\.companyId\)/.test(retention) && !/Retention \$\{DISCOUNT_PERCENT\}% — /.test(retention));
  ok("every retention update writes Stripe's reply", (retention.match(/updated = await stripe\.subscriptions\.update\(/g) || []).length === 3 && /if \(updated\) await writeSubscriptionFromStripe/.test(retention));

  const checkout = stripComments(read("app/api/platform/billing/checkout/route.js"));
  ok("plan change reads Stripe first and heals the row", /stripe\.subscriptions\.retrieve\(existing\.stripeSubscriptionId\)/.test(checkout) && /writeSubscriptionFromStripe\(member\.companyId, live/.test(checkout));
  ok("…and decides 'live' from Stripe's word, in our enum", /LIVE\.has\(liveStatus\)/.test(checkout) && /subscriptionStatusFromStripe\(live\.status\)/.test(checkout));

  const billing = stripComments(read("lib/platform/stripeBilling.js"));
  ok("changeSubscriptionPlan writes the mapped reply", /\.\.\.subscriptionFieldsFromStripe\(updated\), planId: plan\.id/.test(billing));
  ok("syncStripeTrialEnd writes the mapped reply", /const updated = await stripe\.subscriptions\.update\(sub\.stripeSubscriptionId, \{\s*trial_end: Math\.floor\(end/.test(billing) && /data: subscriptionFieldsFromStripe\(updated\)/.test(billing));
  ok("the webhook's created/updated path is the shared mapping", /data: subscriptionFieldsFromStripe\(obj\),/.test(billing));
  ok("no route writes `status: obj.status` straight through any more", !/status: obj\.status,/.test(billing));

  const endTrial = stripComments(read("app/api/platform/companies/[id]/end-trial/route.js"));
  ok("end-trial writes the mapped reply", /data: subscriptionFieldsFromStripe\(after\)/.test(endTrial));
  const extend = stripComments(read("lib/referrals/extendAccess.js"));
  ok("extendAccess writes the mapped reply", /\.\.\.subscriptionFieldsFromStripe\(updated\)/.test(extend));
  const reconcile = stripComments(read("app/api/settings/subscription/reconcile/route.js"));
  ok("the Check-with-Stripe reconcile uses the mapping (so canceledAt lands there too)", /subscriptionFieldsFromStripe\(live, \{ now: existing\?\.canceledAt/.test(reconcile));

  const billingHook = stripComments(read("app/api/platform/billing/webhook/route.js"));
  const connectHook = stripComments(read("app/api/stripe/webhook/route.js"));
  const stampsAfterVerify = (src, endpoint) => {
    const verify = src.indexOf("constructEvent(");
    const stamp = src.indexOf(`stampWebhookReceived("${endpoint}", event)`);
    return verify > -1 && stamp > verify;
  };
  ok("billing webhook stamps AFTER signature verification", stampsAfterVerify(billingHook, "billing"));
  ok("connect webhook stamps AFTER signature verification", stampsAfterVerify(connectHook, "connect"));

  const dash = stripComments(read("app/platform/page.js"));
  ok("the dashboard fetches webhook-health and can print \"never\"", /\/api\/platform\/webhook-health/.test(dash) && /never — no event has reached this deployment/.test(dash));

  const settings = stripComments(read("app/api/settings/subscription/route.js"));
  ok("the billing page's data route syncs on ?live=1 only for a billing admin", /searchParams\.get\("live"\) === "1"/.test(settings) && /if \(wantsLive && seesPlan\)/.test(settings) && /canceledAt: true/.test(settings));
  // Raw, not comment-stripped: the page's JSX comments carry an unpaired
  // "/*" in prose, and the stripper swallows half the file after it.
  const page = read("app/app/settings/account-billing/page.js");
  ok("the billing page asks for the live read", /\/api\/settings\/subscription\?live=1/.test(page));
  // Since 2026-09-14 the cancelled state's primary action is the shared Resume
  // button (scripts/check-billing-resume.mjs owns it); "Choose a different
  // plan" is the secondary path to the cards.
  ok("the billing page renders the cancelled state with Resume and the path to the plan cards", /app\.billing\.cancelledOn/.test(page) && /<ResumePlanButton/.test(page) && /href="#plans"/.test(page) && /<div id="plans">/.test(page));
  ok("a cancelled company's old tier is buyable again", /status === "canceled" \? null : subscription\?\.plan\?\.id/.test(page));

  const cron = stripComments(read("app/api/cron/billing-sync/route.js"));
  ok("the cron is guarded by requireCronSecret and skips demo companies", /requireCronSecret\(request\)/.test(cron) && /isDemo: false/.test(cron));
  const vercel = JSON.parse(read("vercel.json"));
  ok("vercel.json schedules /api/cron/billing-sync every 6 h", vercel.crons.some((c) => c.path === "/api/cron/billing-sync" && /\*\/6/.test(c.schedule)));
  ok("docs/VERCEL.md names the cron and its cost", /\/api\/cron\/billing-sync/.test(read("docs/VERCEL.md")) && /4 invocations a day/.test(read("docs/VERCEL.md")));

  const actions = read("lib/platform/auditActions.js");
  ok("subscription_synced is a registered audit action", /subscription_synced:/.test(actions));
  const syncRoute = stripComments(read("app/api/platform/companies/[id]/sync-subscription/route.js"));
  ok("the platform sync route enforces billing:manage and audits", /"billing:manage"/.test(syncRoute) && /action: "subscription_synced"/.test(syncRoute));
  const script = read("scripts/sync-subscription.mjs");
  ok("the shell script refuses a test-mode key by name", /sk_test_/.test(script) && /startsWith\("sk_live_"\)/.test(script));

  for (const key of ["app.billing.cancelledOn", "app.billing.cancelledNoDate", "app.billing.chooseDifferentPlan"]) {
    const missing = Object.entries(APP_MESSAGES).filter(([, m]) => !m[key]).map(([l]) => l);
    ok(`${key} exists in all ${Object.keys(APP_MESSAGES).length} languages`, missing.length === 0, missing);
  }
  ok("cancelledOn carries the {date} slot in every language", Object.values(APP_MESSAGES).every((m) => /\{date\}/.test(m["app.billing.cancelledOn"])));

  for (const lang of ["en", "fr", "es"]) {
    const help = read(`content/help/${lang}/billing-and-subscription-2.js`);
    ok(`help (${lang}) says a cancelled subscription can only be resumed or replaced`, /(only resumed or replaced|seulement repris ou remplacé|solo reanudar o reemplazar)/.test(help));
  }
}

console.log(`\n${pass} passed${fails.length ? `, ${fails.length} FAILED` : ""}`);
for (const f of fails) console.log(`  ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
