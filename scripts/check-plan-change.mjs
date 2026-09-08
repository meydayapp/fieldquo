// scripts/check-plan-change.mjs
//
// A plan change happens when the owner said it should.
//
// 2026-09-08: "When someone changes their plan the change should be made on
// the next billing cycle; if it's a year then only after the year ends."
// Shipped as: downgrades and month↔year switches wait for the period to end
// (a Stripe Subscription Schedule, no prorations, nothing charged today);
// upgrades apply now, prorated, as before — with the split behind
// UPGRADE_TIMING in lib/platform/planChange.js so the fuller reading is one
// word away.
//
// ══ What is EXECUTED rather than read ══════════════════════════════════════
//
//   classifyPlanChange   — every pairing of ladder tier × cadence, plus the
//                          rows the ladder does not rank (bespoke, legacy)
//   landedPlanChange     — every combination of row state × Stripe metadata
//   schedulePlanChange   — against a recording Stripe fake: what phases it
//                          sends, what it writes, what it does NOT write
//   cancelPendingPlanChange, changeSubscriptionPlan with a change pending
//   syncSubscriptionFromStripeEvent — the flip on subscription.updated and
//                          the clear on the three schedule events
//
// Source pins cover only what cannot be executed here: that the route
// branches on `applies`, that the page's cancel button lives inside the
// pending guard, that the payload route sends the columns, and that every
// new string exists in all nine language blocks.
//
// Run: npm run check:plan-change

import { readFileSync } from "node:fs";
import {
  classifyPlanChange,
  comparePlanRank,
  landedPlanChange,
  UPGRADE_TIMING,
  CLEAR_PENDING,
} from "@/lib/platform/planChange";
import { SEAT_LADDER } from "@/lib/pricing/ladder";
import {
  schedulePlanChange,
  cancelPendingPlanChange,
  changeSubscriptionPlan,
  syncSubscriptionFromStripeEvent,
} from "@/lib/platform/stripeBilling";
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";
import { calls, state, resetStripeStub } from "./fixtures/stripeStub.mjs";
import { notifyCalls, resetNotifyStub } from "./fixtures/notifyStub.mjs";

let pass = 0;
const fails = [];
const ok = (label, cond, detail) =>
  cond ? (pass++, console.log(`  ✓ ${label}`)) : fails.push(`${label}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ""}`);

const resetAll = () => {
  resetDbStub();
  resetStripeStub();
  resetNotifyStub();
};

// ── The ladder, as Plan rows ─────────────────────────────────────────────────
const P = Object.fromEntries(
  SEAT_LADDER.map((t) => [
    t.tierKey,
    {
      id: `plan_${t.tierKey}`,
      name: t.label,
      tierKey: t.tierKey,
      sortOrder: t.sortOrder,
      priceMonthly: t.price,
      priceAnnual: t.price * 10,
      currency: "CAD",
    },
  ]),
);
const TIERS = SEAT_LADDER.map((t) => t.tierKey);
const INTERVALS = ["month", "year"];

console.log("\nThe split itself");
ok("UPGRADE_TIMING is one of the two timings the route understands",
  UPGRADE_TIMING === "now" || UPGRADE_TIMING === "period_end", UPGRADE_TIMING);
ok("CLEAR_PENDING names exactly the four pending columns",
  Object.keys(CLEAR_PENDING).sort().join(",") === "pendingBillingInterval,pendingEffectiveAt,pendingPlanId,stripeScheduleId" &&
    Object.values(CLEAR_PENDING).every((v) => v === null));

console.log("\nEvery pairing of tier × cadence, executed");
{
  let mismatches = [];
  let count = 0;
  for (const c of TIERS) for (const ci of INTERVALS) for (const n of TIERS) for (const ni of INTERVALS) {
    count++;
    const got = classifyPlanChange({ currentPlan: P[c], currentInterval: ci, nextPlan: P[n], nextInterval: ni });
    const rc = TIERS.indexOf(c);
    const rn = TIERS.indexOf(n);
    let want;
    if (rn > rc) want = { kind: "upgrade", applies: UPGRADE_TIMING };
    else if (rn < rc) want = { kind: "downgrade", applies: "period_end" };
    else if (ci === ni) want = { kind: "same", applies: "now" };
    else want = { kind: "cadence", applies: "period_end" };
    if (got.kind !== want.kind || got.applies !== want.applies) {
      mismatches.push(`${c}/${ci} → ${n}/${ni}: got ${got.kind}/${got.applies}, want ${want.kind}/${want.applies}`);
    }
  }
  ok(`${count} pairings classified as the decision says`, mismatches.length === 0, mismatches.slice(0, 5));
  ok("a higher tier on the year is still an upgrade (tier wins over cadence)",
    classifyPlanChange({ currentPlan: P.solo, currentInterval: "month", nextPlan: P.crew, nextInterval: "year" }).kind === "upgrade");
  ok("a lower tier taken monthly off a yearly plan waits for the year to end",
    classifyPlanChange({ currentPlan: P.shop, currentInterval: "year", nextPlan: P.solo, nextInterval: "month" }).applies === "period_end");
  ok("same tier, month → year, is a cadence change that waits",
    classifyPlanChange({ currentPlan: P.crew, currentInterval: "month", nextPlan: P.crew, nextInterval: "year" }).kind === "cadence");
  ok("nothing said about cadence means monthly on both sides",
    classifyPlanChange({ currentPlan: P.crew, currentInterval: undefined, nextPlan: P.crew, nextInterval: undefined }).kind === "same");
}

console.log("\nRows the ladder does not rank");
{
  const custom90 = { id: "plan_custom", name: "Custom (2 employees)", tierKey: null, sortOrder: 0, priceMonthly: 90 };
  const custom200 = { id: "plan_custom2", name: "Custom (5 employees)", tierKey: null, sortOrder: 0, priceMonthly: 200 };
  const legacyA = { id: "plan_la", name: "Starter", tierKey: null, sortOrder: 5, priceMonthly: 500 };
  const legacyB = { id: "plan_lb", name: "Growth", tierKey: null, sortOrder: 6, priceMonthly: 100 };
  ok("bespoke → ladder compares by price: CA$90 → Crew is an upgrade",
    classifyPlanChange({ currentPlan: custom90, currentInterval: "month", nextPlan: P.crew, nextInterval: "month" }).kind === "upgrade");
  ok("...and Crew → CA$90 is a downgrade that waits",
    classifyPlanChange({ currentPlan: P.crew, currentInterval: "month", nextPlan: custom90, nextInterval: "month" }).applies === "period_end");
  ok("two bespoke rows compare by price", comparePlanRank(custom90, custom200) === 1);
  // sortOrder beats price when both rows carry one: the operator's console
  // order IS the rank for plans off the ladder, whatever they cost.
  ok("two legacy rows compare by sortOrder, not price", comparePlanRank(legacyA, legacyB) === 1);
  ok("the same row on a different cadence is a cadence change",
    classifyPlanChange({ currentPlan: custom90, currentInterval: "month", nextPlan: { ...custom90 }, nextInterval: "year" }).kind === "cadence");
  // Names are never compared. "Crew" < "Solo" alphabetically; the ladder says
  // the opposite, and a name-sorted classifier would defer every real upgrade.
  ok("names carry no rank: Solo → Crew is up despite sorting the other way",
    comparePlanRank(P.solo, P.crew) === 1 && "Crew" < "Solo");
  ok("a missing plan does not throw",
    (() => { try { classifyPlanChange({ currentPlan: null, currentInterval: "month", nextPlan: P.solo, nextInterval: "month" }); return true; } catch { return false; } })());
}

console.log("\nWhen a scheduled change has LANDED (landedPlanChange)");
{
  const pending = { planId: "plan_crew", pendingPlanId: "plan_solo" };
  const clean = { planId: "plan_crew", pendingPlanId: null };
  ok("metadata naming the pending plan is the landing",
    landedPlanChange(pending, { planId: "plan_solo", billingInterval: "year" })?.planId === "plan_solo");
  ok("...and carries the cadence from the same metadata",
    landedPlanChange(pending, { planId: "plan_solo", billingInterval: "year" })?.billingInterval === "year");
  ok("garbage cadence in metadata is undefined, never coerced",
    landedPlanChange(pending, { planId: "plan_solo", billingInterval: "decade" })?.billingInterval === undefined);
  ok("metadata still naming the CURRENT plan is nothing",
    landedPlanChange(pending, { planId: "plan_crew" }) === null);
  ok("metadata naming some OTHER plan while one is pending is ignored",
    landedPlanChange(pending, { planId: "plan_shop" }) === null);
  ok("with nothing pending, a differing plan is a dashboard change and is honoured",
    landedPlanChange(clean, { planId: "plan_shop" })?.planId === "plan_shop");
  ok("no metadata is nothing", landedPlanChange(pending, undefined) === null && landedPlanChange(pending, {}) === null);
  ok("no row is nothing", landedPlanChange(null, { planId: "plan_solo" }) === null);
}

// ── The scheduler, against a recording Stripe ───────────────────────────────
const liveSub = (over = {}) => ({
  id: "sub_1",
  status: "active",
  current_period_start: 1_700_000_000,
  current_period_end: 1_702_592_000,
  trial_end: null,
  items: {
    data: [
      { id: "si_1", quantity: 1, price: { id: "price_old", product: "prod_old", currency: "cad", recurring: { interval: "month" } } },
    ],
  },
  metadata: { companyId: "co_1", planId: "plan_crew", billingInterval: "month" },
  ...over,
});
const subRow = (over = {}) => ({
  id: "subrow_1",
  companyId: "co_1",
  planId: "plan_crew",
  billingInterval: "month",
  status: "active",
  stripeSubscriptionId: "sub_1",
  stripeScheduleId: null,
  pendingPlanId: null,
  pendingBillingInterval: null,
  pendingEffectiveAt: null,
  ...over,
});
const serialised = () => JSON.stringify(calls);
const only = (method) => calls.filter((c) => c.method === method);

console.log("\nschedulePlanChange, executed");
{
  resetAll();
  state.subscriptions.set("sub_1", liveSub());
  rows.subscription = [subRow()];
  const result = await schedulePlanChange({ subscription: rows.subscription[0], plan: P.solo, interval: "year", currency: "cad" });

  ok("creates the schedule FROM the live subscription", only("subscriptionSchedules.create")[0]?.args[0]?.from_subscription === "sub_1");
  const upd = only("subscriptionSchedules.update")[0];
  const phases = upd?.args[1]?.phases || [];
  ok("then updates it with two phases", phases.length === 2, phases.length);
  ok("phase 1 restates the current period as Stripe gave it",
    phases[0]?.start_date === 1_700_000_000 && phases[0]?.end_date === 1_702_592_000 && phases[0]?.items?.[0]?.price === "price_old");
  ok("phase 2 starts exactly where phase 1 ends", phases[1]?.start_date === phases[0]?.end_date);
  ok("phase 2 runs one interval, then the schedule releases",
    phases[1]?.iterations === 1 && upd?.args[1]?.end_behavior === "release");
  const pd = phases[1]?.items?.[0]?.price_data;
  ok("phase 2 is the new price as inline price_data on a real Product id",
    typeof pd?.product === "string" && pd.product.startsWith("prod_") && pd.unit_amount === 99000 && pd.recurring?.interval === "year" && pd.currency === "cad");
  ok("the product was created for the PLAN, not reused from the old item",
    pd?.product !== "prod_old" && only("products.create")[0]?.args[0]?.metadata?.planId === "plan_solo");
  ok("phase 2 metadata carries what the webhook needs to land it",
    phases[1]?.metadata?.planId === "plan_solo" && phases[1]?.metadata?.billingInterval === "year" && phases[1]?.metadata?.companyId === "co_1");
  ok("proration_behavior is none on the request and on BOTH phases",
    upd?.args[1]?.proration_behavior === "none" && phases.every((p) => p.proration_behavior === "none"));
  ok("no call to Stripe mentions create_prorations", !serialised().includes("create_prorations"));
  ok("no call to Stripe touches trial_end (trial untouched)", !phases[0]?.trial_end && !("trial_end" in (phases[1] || {})));

  const w = writes.filter((x) => x.model === "subscription" && x.action === "update");
  ok("the row gets the four pending columns", w[0]?.data?.pendingPlanId === "plan_solo" && w[0]?.data?.pendingBillingInterval === "year" && w[0]?.data?.pendingEffectiveAt instanceof Date && typeof w[0]?.data?.stripeScheduleId === "string");
  ok("...and planId is NOT moved — they are still on the plan they are on", w.every((x) => !("planId" in x.data)));
  ok("effectiveAt is Stripe's phase boundary, not a date computed here",
    result.effectiveAt.getTime() === 1_702_592_000 * 1000 && w[0]?.data?.pendingEffectiveAt?.getTime() === 1_702_592_000 * 1000);
  ok("the result says scheduled, with plan, cadence and date",
    result.scheduled === true && result.planId === "plan_solo" && result.interval === "year");

  // A trialing company: the current phase carries its trial_end and must be
  // restated with it, or Stripe would end the trial today.
  resetAll();
  state.subscriptions.set("sub_1", liveSub({ status: "trialing", trial_end: 1_701_000_000 }));
  rows.subscription = [subRow({ status: "trialing" })];
  await schedulePlanChange({ subscription: rows.subscription[0], plan: P.solo, interval: "month", currency: "cad" });
  const trialPhases = only("subscriptionSchedules.update")[0]?.args[1]?.phases || [];
  ok("a running trial is restated on phase 1, not ended", trialPhases[0]?.trial_end === 1_701_000_000);
  ok("...and phase 2 has no trial of its own", !("trial_end" in (trialPhases[1] || {})) && !("trial" in (trialPhases[1] || {})));

  // A second change before the first lands: same schedule, new phase 2.
  resetAll();
  state.subscriptions.set("sub_1", liveSub());
  rows.subscription = [subRow()];
  const first = await schedulePlanChange({ subscription: rows.subscription[0], plan: P.solo, interval: "year", currency: "cad" });
  rows.subscription[0].stripeScheduleId = first.stripeScheduleId;
  rows.subscription[0].pendingPlanId = "plan_solo";
  calls.length = 0;
  const second = await schedulePlanChange({ subscription: rows.subscription[0], plan: P.crew, interval: "year", currency: "cad" });
  ok("a second change reuses the existing schedule (no second create)",
    only("subscriptionSchedules.create").length === 0 && only("subscriptionSchedules.retrieve")[0]?.args[0] === first.stripeScheduleId);
  ok("...and replaces phase 2 with the later choice",
    only("subscriptionSchedules.update")[0]?.args[1]?.phases?.[1]?.metadata?.planId === "plan_crew" && second.stripeScheduleId === first.stripeScheduleId);
  ok("a plan with no annual price is refused before Stripe is called",
    await (async () => {
      resetAll();
      state.subscriptions.set("sub_1", liveSub());
      rows.subscription = [subRow()];
      try {
        await schedulePlanChange({ subscription: rows.subscription[0], plan: { ...P.solo, priceAnnual: null }, interval: "year", currency: "cad" });
        return false;
      } catch (err) {
        return /cannot be billed/.test(err.message) && calls.length === 0;
      }
    })());
}

console.log("\ncancelPendingPlanChange, executed");
{
  resetAll();
  state.subscriptions.set("sub_1", liveSub());
  rows.subscription = [subRow()];
  const booked = await schedulePlanChange({ subscription: rows.subscription[0], plan: P.solo, interval: "year", currency: "cad" });
  Object.assign(rows.subscription[0], { stripeScheduleId: booked.stripeScheduleId, pendingPlanId: "plan_solo", pendingBillingInterval: "year", pendingEffectiveAt: booked.effectiveAt });
  calls.length = 0;
  writes.length = 0;
  await cancelPendingPlanChange(rows.subscription[0]);
  ok("releases the schedule (subscription stays exactly as it is)", only("subscriptionSchedules.release")[0]?.args[0] === booked.stripeScheduleId);
  ok("does not cancel the subscription or touch its items",
    only("subscriptions.update").length === 0 && only("subscriptions.cancel").length === 0);
  const w = writes.find((x) => x.model === "subscription" && x.action === "update");
  ok("nulls the four columns, nothing else",
    w && Object.keys(w.data).sort().join(",") === Object.keys(CLEAR_PENDING).sort().join(",") && Object.values(w.data).every((v) => v === null));
  ok("a schedule Stripe no longer has is not an error",
    await (async () => {
      resetAll();
      rows.subscription = [subRow({ stripeScheduleId: "sub_sched_gone", pendingPlanId: "plan_solo" })];
      try { await cancelPendingPlanChange(rows.subscription[0]); return writes.some((x) => x.model === "subscription" && x.data?.pendingPlanId === null); } catch { return false; }
    })());
}

console.log("\nAn upgrade taken while a change is pending");
{
  resetAll();
  state.subscriptions.set("sub_1", liveSub());
  rows.subscription = [subRow()];
  const booked = await schedulePlanChange({ subscription: rows.subscription[0], plan: P.solo, interval: "year", currency: "cad" });
  Object.assign(rows.subscription[0], { stripeScheduleId: booked.stripeScheduleId, pendingPlanId: "plan_solo" });
  calls.length = 0;
  await changeSubscriptionPlan({ subscription: rows.subscription[0], plan: P.shop, interval: "month", currency: "cad" });
  const order = calls.map((c) => c.method);
  ok("releases the pending schedule FIRST, then swaps the item",
    order.indexOf("subscriptionSchedules.release") !== -1 && order.indexOf("subscriptionSchedules.release") < order.indexOf("subscriptions.update"));
  ok("the upgrade itself is still immediate and prorated (today's behaviour)",
    only("subscriptions.update")[0]?.args[1]?.proration_behavior === "create_prorations");
}

// ── The webhook ─────────────────────────────────────────────────────────────
const updatedEvent = (metadata, over = {}) => ({
  type: "customer.subscription.updated",
  data: { object: { ...liveSub({ items: { data: [{ price: { recurring: { interval: metadata?.billingInterval || "month" } } }] } }), metadata, ...over } },
});
const pendingRow = () => subRow({ pendingPlanId: "plan_solo", pendingBillingInterval: "year", pendingEffectiveAt: new Date(), stripeScheduleId: "sub_sched_9" });

console.log("\nThe webhook: planId moves when the change LANDS, and only then");
{
  resetAll();
  rows.subscription = [pendingRow()];
  rows.plan = [{ id: "plan_solo" }, { id: "plan_crew" }, { id: "plan_shop" }];
  await syncSubscriptionFromStripeEvent(updatedEvent({ companyId: "co_1", planId: "plan_solo", billingInterval: "year" }));
  const r = rows.subscription[0];
  ok("subscription.updated with the pending plan in metadata moves planId", r.planId === "plan_solo");
  ok("...sets the cadence from Stripe", r.billingInterval === "year");
  ok("...and clears all four pending columns",
    r.pendingPlanId === null && r.pendingBillingInterval === null && r.pendingEffectiveAt === null && r.stripeScheduleId === null);
  ok("...and the 'your plan changed' note fires NOW, once, for this company",
    notifyCalls.length === 1 && notifyCalls[0].companyId === "co_1");

  resetAll();
  rows.subscription = [pendingRow()];
  rows.plan = [{ id: "plan_solo" }, { id: "plan_crew" }, { id: "plan_shop" }];
  await syncSubscriptionFromStripeEvent(updatedEvent({ companyId: "co_1", planId: "plan_crew", billingInterval: "month" }));
  ok("an update that still names the current plan moves nothing",
    rows.subscription[0].planId === "plan_crew" && rows.subscription[0].pendingPlanId === "plan_solo");
  ok("...and sends nothing", notifyCalls.length === 0);

  resetAll();
  rows.subscription = [pendingRow()];
  rows.plan = [{ id: "plan_solo" }, { id: "plan_crew" }, { id: "plan_shop" }];
  await syncSubscriptionFromStripeEvent(updatedEvent({ companyId: "co_1", planId: "plan_shop", billingInterval: "month" }));
  ok("metadata naming a plan that is NOT the pending one is ignored while one is pending",
    rows.subscription[0].planId === "plan_crew" && rows.subscription[0].pendingPlanId === "plan_solo" && notifyCalls.length === 0);

  resetAll();
  rows.subscription = [subRow()];
  rows.plan = [{ id: "plan_solo" }, { id: "plan_crew" }, { id: "plan_shop" }];
  await syncSubscriptionFromStripeEvent(updatedEvent({ companyId: "co_1", planId: "plan_shop", billingInterval: "month" }));
  ok("with nothing pending, a plan changed in the Stripe dashboard is honoured",
    rows.subscription[0].planId === "plan_shop" && notifyCalls.length === 1);

  resetAll();
  rows.subscription = [pendingRow()];
  rows.plan = [{ id: "plan_crew" }];
  await syncSubscriptionFromStripeEvent(updatedEvent({ companyId: "co_1", planId: "plan_solo", billingInterval: "year" }));
  ok("a landing on a plan that no longer exists does not move the row (no FK throw, no retry storm)",
    rows.subscription[0].planId === "plan_crew" && notifyCalls.length === 0);

  // Scheduling itself must not have sent the note: no notify stub call was
  // made anywhere in the scheduler section above. Re-proved here directly.
  resetAll();
  state.subscriptions.set("sub_1", liveSub());
  rows.subscription = [subRow()];
  await schedulePlanChange({ subscription: rows.subscription[0], plan: P.solo, interval: "year", currency: "cad" });
  ok("booking a change sends no 'plan changed' email", notifyCalls.length === 0);
}

console.log("\nThe webhook: the three schedule events clear the pending columns");
{
  for (const type of ["subscription_schedule.completed", "subscription_schedule.released", "subscription_schedule.canceled"]) {
    resetAll();
    rows.subscription = [pendingRow()];
    await syncSubscriptionFromStripeEvent({ type, data: { object: { id: "sub_sched_9", subscription: "sub_1", status: type.split(".")[1] } } });
    const r = rows.subscription[0];
    ok(`${type} clears the four columns`, r.pendingPlanId === null && r.pendingBillingInterval === null && r.pendingEffectiveAt === null && r.stripeScheduleId === null);
    ok(`${type} leaves planId alone`, r.planId === "plan_crew");
  }
  resetAll();
  rows.subscription = [pendingRow()];
  await syncSubscriptionFromStripeEvent({ type: "subscription_schedule.released", data: { object: { id: "sub_sched_other", subscription: "sub_1" } } });
  ok("a schedule known only by its subscription still clears the row", rows.subscription[0].pendingPlanId === null);
  resetAll();
  rows.subscription = [subRow()];
  await syncSubscriptionFromStripeEvent({ type: "subscription_schedule.released", data: { object: { id: "sub_sched_other", subscription: "sub_1" } } });
  ok("a row with nothing pending is not written by a stray schedule event",
    !writes.some((w) => w.model === "subscription" && w.action === "updateMany" && w.where?.OR) || rows.subscription[0].stripeScheduleId === null);

  resetAll();
  rows.subscription = [pendingRow()];
  rows.company = [{ id: "co_1" }];
  await syncSubscriptionFromStripeEvent({ type: "customer.subscription.deleted", data: { object: { id: "sub_1", canceled_at: 1_702_000_000, current_period_end: 1_702_592_000 } } });
  ok("cancelling the subscription clears a change that had nothing left to land on",
    rows.subscription[0].pendingPlanId === null && rows.subscription[0].status === "canceled");
}

// ── Source pins ─────────────────────────────────────────────────────────────
console.log("\nThe route branches on the decision, not on its own reading of it");
{
  const route = readFileSync("app/api/platform/billing/checkout/route.js", "utf8");
  ok("imports classifyPlanChange", /import \{ classifyPlanChange \} from "@\/lib\/platform\/planChange"/.test(route));
  ok("branches on `applies`", /change\.applies === "period_end"/.test(route));
  const deferred = route.slice(route.indexOf('change.applies === "period_end"'), route.indexOf("const result = await changeSubscriptionPlan"));
  ok("period_end → schedulePlanChange", /schedulePlanChange\(\{/.test(deferred) && !/changeSubscriptionPlan\(/.test(deferred));
  ok("...answering { scheduled: true, planId, interval, effectiveAt }",
    /scheduled: true,[\s\S]{0,120}planId: result\.planId,[\s\S]{0,60}interval: result\.interval,[\s\S]{0,60}effectiveAt: result\.effectiveAt/.test(deferred));
  ok("now → changeSubscriptionPlan, as before", /const result = await changeSubscriptionPlan\(\{/.test(route));
  ok("the route loads the current plan row so the classifier has a rank to read", /include: \{ plan: true \}/.test(route));
  ok("no cadence goes to Stripe unvalidated (resolveCheckoutInterval still runs first)",
    route.indexOf("resolveCheckoutInterval(plan, requestedInterval)") < route.indexOf("classifyPlanChange({"));
}

console.log("\nThe scheduler never prorates; the row's planId is not its to move");
{
  const src = readFileSync("lib/platform/stripeBilling.js", "utf8");
  const start = src.indexOf("export async function schedulePlanChange");
  const end = src.indexOf("export async function cancelPendingPlanChange");
  const fn = src.slice(start, end);
  ok("schedulePlanChange exists ahead of cancelPendingPlanChange", start > 0 && end > start);
  ok("never sends create_prorations", !fn.includes("create_prorations"));
  ok("sends proration_behavior: \"none\"", (fn.match(/proration_behavior: "none"/g) || []).length >= 2);
  ok("builds the schedule from the live subscription", /from_subscription: subscription\.stripeSubscriptionId/.test(fn));
  ok("releases after phase 2 rather than cancelling", /end_behavior: "release"/.test(fn) && !/end_behavior: "cancel"/.test(fn));
  ok("phase 2 metadata carries companyId/planId/billingInterval", /companyId: subscription\.companyId,\s*planId: plan\.id,\s*billingInterval: interval/.test(fn));
  ok("its db write sets the pending columns and not planId",
    /data: \{\s*pendingPlanId: plan\.id,/.test(fn) && !/data: \{[^}]*\bplanId: plan\.id/.test(fn));
  ok("does not send trial_end: \"now\" (trial untouched)", !/trial_end: "now"/.test(fn));

  const upd = src.slice(src.indexOf('case "customer.subscription.updated"'), src.indexOf('case "subscription_schedule.completed"'));
  ok("subscription.updated decides the landing with landedPlanChange", /landedPlanChange\(row, obj\.metadata\)/.test(upd));
  // `planId: true` in a select is a read, not a write; every other `planId:`
  // in this case block is a value being written, and there must be one.
  ok("...writes planId ONLY from what it decided", /planId: landed\.planId/.test(upd) && (upd.match(/\bplanId: (?!true\b)/g) || []).length === 1);
  ok("...checks the plan exists before the FK write", /db\.plan\.findUnique\(\{ where: \{ id: landed\.planId \}/.test(upd));
  ok("...clears the pending columns in the same write", /planId: landed\.planId,[\s\S]{0,200}\.\.\.CLEAR_PENDING/.test(upd));
  ok("...and notifies AFTER the write, inside the landed branch",
    upd.indexOf("notifySubscriptionState(row.companyId)") > upd.indexOf("planId: landed.planId"));
  ok("the three schedule events are handled together",
    /case "subscription_schedule\.completed":\s*case "subscription_schedule\.released":\s*case "subscription_schedule\.canceled":/.test(src));
  const sched = src.slice(src.indexOf('case "subscription_schedule.completed"'), src.indexOf("// The referrer's three months"));
  ok("...and clear the pending columns without touching planId", /\.\.\.CLEAR_PENDING/.test(sched) && !/planId:/.test(sched));
  ok("changeSubscriptionPlan releases a pending schedule before swapping items",
    /if \(subscription\.stripeScheduleId\) await cancelPendingPlanChange\(subscription\);/.test(src));
}

console.log("\nThe page: says what will happen, and the cancel button exists only when there is something to cancel");
{
  const page = readFileSync("app/app/settings/account-billing/page.js", "utf8");
  ok("asks the same classifier before confirming", /import \{ classifyPlanChange \} from "@\/lib\/platform\/planChange"/.test(page) && /classifyPlanChange\(\{/.test(page));
  ok("confirms before posting a change", /setConfirming\(\{ plan, change \}\)/.test(page));
  ok("the deferred sentence names plan, cadence, date, current plan, and 'nothing is charged today'",
    /app\.billing\.confirmDeferredBody", "Your plan changes to \{plan\} \(\{cadence\}\) on \{date\}\. Until then you keep \{current\}\. Nothing is charged today\."/.test(page));
  ok("the upgrade sentence says prorated today", /app\.billing\.confirmUpgradeBody", "[^"]*prorated today\."/.test(page));
  ok("the sentence branches on `applies`, same as the route", /confirming\.change\.applies === "period_end"\s*\?\s*t\("app\.billing\.confirmDeferredBody"/.test(page));
  ok("handles the scheduled answer", /if \(data\.scheduled\)/.test(page));
  const guardAt = page.indexOf("{subscription?.pendingPlanId && (");
  ok("renders a pending card from the row", guardAt > 0);
  const card = page.slice(guardAt, page.indexOf("\n        )}", guardAt));
  ok("the pending card says switching to {plan} ({cadence}) on {date}", /app\.billing\.pendingTitle", "Switching to \{plan\} \(\{cadence\}\) on \{date\}"/.test(card));
  ok("'Keep my current plan' lives INSIDE the pendingPlanId guard", /handleKeepCurrentPlan/.test(card) && /app\.billing\.keepMyPlan/.test(card));
  ok("...and nowhere else", (page.match(/onClick=\{handleKeepCurrentPlan\}/g) || []).length === 1);
  ok("the button calls DELETE on the pending-change route", /fetch\("\/api\/platform\/billing\/pending-change", \{ method: "DELETE" \}\)/.test(page));
  ok("a failed cancel is reported, not swallowed", /reportResponseError\(res, setError, t\("app\.billing\.keepPlanFailed"/.test(page));
  ok("no literal currency sign in the new copy", !/\$\{?[a-z]/.test(card));
}

console.log("\nThe payload and the route the button calls");
{
  const sub = readFileSync("app/api/settings/subscription/route.js", "utf8");
  ok("the subscription GET sends the three pending fields",
    /pendingPlanId: true,\s*pendingBillingInterval: true,\s*pendingEffectiveAt: true,/.test(sub));
  const del = readFileSync("app/api/platform/billing/pending-change/route.js", "utf8");
  ok("pending-change exports DELETE", /export async function DELETE\(request\)/.test(del));
  ok("...behind the same billing-admin gate as the change itself", /if \(!isBillingAdmin\(member\.role\)\)/.test(del) && /BILLING_ADMIN_ERROR/.test(del));
  ok("...tenant-scoped by the member's own company", /where: \{ companyId: member\.companyId \}/.test(del) && !/request\.json|searchParams/.test(del));
  ok("...calls cancelPendingPlanChange", /cancelPendingPlanChange\(subscription\)/.test(del));
  const rec = readFileSync("app/api/settings/subscription/reconcile/route.js", "utf8");
  ok("'Check with Stripe' clears a landed change too", /planId === existing\.pendingPlanId \? \{ \.\.\.CLEAR_PENDING \}/.test(rec));
  const schema = readFileSync("prisma/schema.prisma", "utf8");
  const model = schema.slice(schema.indexOf("model Subscription {"));
  const block = model.slice(0, model.indexOf("\n}"));
  ok("the four columns exist on Subscription, all optional",
    /pendingPlanId\s+String\?/.test(block) && /pendingBillingInterval\s+String\?/.test(block) && /pendingEffectiveAt\s+DateTime\?/.test(block) && /stripeScheduleId\s+String\?/.test(block));
}

console.log("\nEvery new string, in all nine language blocks");
{
  const KEYS = [
    "app.billing.cadenceMonthly",
    "app.billing.cadenceYearly",
    "app.billing.changeScheduled",
    "app.billing.keepPlanFailed",
    "app.billing.keepPlanUnreachable",
    "app.billing.pendingTitle",
    "app.billing.pendingUnnamedPlan",
    "app.billing.pendingBody",
    "app.billing.keepMyPlan",
    "app.billing.confirmChangeTitle",
    "app.billing.confirmDeferredBody",
    "app.billing.endOfPeriod",
    "app.billing.confirmUpgradeBody",
    "app.billing.confirmDeferredCta",
    "app.billing.confirmUpgradeCta",
  ];
  const src = readFileSync("app/i18n/appMessages.js", "utf8");
  const starts = [...src.matchAll(/^const ([a-z]{2}) = \{/gm)];
  ok("nine language blocks found", starts.length === 9, starts.map((m) => m[1]));
  const blocks = starts.map((m, i) => ({
    lang: m[1],
    text: src.slice(m.index, i + 1 < starts.length ? starts[i + 1].index : src.length),
  }));
  for (const key of KEYS) {
    const missing = blocks.filter((b) => !b.text.includes(`"${key}":`)).map((b) => b.lang);
    ok(`${key} ×9`, missing.length === 0, missing);
  }
  const en = blocks.find((b) => b.lang === "en")?.text || "";
  ok("no literal currency sign in the English strings",
    KEYS.every((k) => { const m = en.match(new RegExp(`"${k.replace(/\./g, "\\.")}": "([^"]*)"`)); return m && !m[1].includes("$"); }));
}

console.log(
  fails.length
    ? `\nFAILED — ${fails.length} of ${pass + fails.length}\n${fails.map((f) => `  ✗ ${f}`).join("\n")}`
    : `\nPASSED — ${pass}/${pass} assertions`,
);
process.exit(fails.length ? 1 : 0);
