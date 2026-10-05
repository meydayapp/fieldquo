// scripts/check-ai-credit.mjs
//
// Buying AI credit — the pay-as-you-go top-up and the monthly bundle both
// shipped dead: image generation and the paid vision pass correctly refused
// with "not enough AI balance" and there was nothing anyone could do about
// it. This proves the fix actually holds money-safe, the way
// check-voice-topup.mjs and check-voice-auto-topup.mjs prove the voice side
// does.
//
//   npm run check:ai-credit
//
// Five things a reader could get wrong again, each executed rather than
// trusted:
//
//   1. A doubled webhook for a one-off AI top-up credits ONCE.
//   2. An `ai_topup` credit lands in the AI wallet and NEVER the voice one —
//      however many times it is written, or which of the two doors wrote it.
//   3. A bundle's monthly grant is idempotent WITHIN one billing period —
//      Stripe redelivering March's invoice.payment_succeeded does not grant
//      March twice — and fires again for a genuinely new period (April).
//   4. Cancelling an AI bundle stops FUTURE grants (the Stripe subscription is
//      actually cancelled) without clawing back credit already on the ledger,
//      and without deleting any row — the ledger is append-only.
//   6. (2026-10-04) Plan credit RESETS monthly and top-ups persist: the
//      reset arithmetic, the plan-first draw order and the two worked
//      examples run against a ledger fake that answers aggregate/findMany
//      the way Postgres would.
//   5. The three settlement doors this money moves through — a top-up's
//      redirect+webhook, a bundle's checkout-confirm+invoice-webhook, and the
//      platform billing webhook's own subscription events — cannot be
//      mistaken for the company's own plan subscription, which lives on the
//      SAME Stripe customer.
//
// NO DATABASE and NO STRIPE CALL. Both are injected, the same discipline
// check-voice-topup.mjs and check-voice-auto-topup.mjs use — a comment
// claiming idempotency is a claim; a stub that counts writes is a
// measurement.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import {
  poolForKind,
  POOLS,
  aiTopupRef,
  grantDemoAiCredit,
  DEMO_AI_CREDIT_CENTS,
  DEMO_AI_CREDIT_REF,
} from "@/lib/voice/credits";
import { creditAiTopup } from "@/lib/ai/topup";
import {
  bundleByKey,
  aiBundleRef,
  createAiBundleCheckoutSession,
  upsertAiCreditBundleFromSubscription,
  grantAiBundlePeriod,
  resolveAiBundleSubscription,
  settleAiBundleCheckoutSession,
  cancelAiBundle,
  BUNDLE_RESET_NOTICE,
  bundleAvailability,
  bundleCustomerKind,
  oneMonthAfter,
} from "@/lib/ai/creditBundle";
import {
  planCreditLeft,
  splitAiBalance,
  expirePlanGrant,
  expireDuePlanCredit,
  aiPlanCreditStatus,
  planExpiryRef,
  PLAN_EXPIRY_KIND,
} from "@/lib/ai/planCreditReset";
import { APP_MESSAGES } from "../app/i18n/appMessages.js";
import { settleCheckoutSession } from "@/lib/stripe/settleCheckoutSession";
import { BUNDLES } from "@/lib/ai/imageEconomics";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

/* ═══════════════════════════════════════════════════════════════════════════
   A world: a ledger with the real unique-ref index, an AiCreditBundle table,
   and a Stripe stub that records every call.
   ═══════════════════════════════════════════════════════════════════════════ */

function makeWorld({ ledger = [], bundles = [] } = {}) {
  const rows = ledger.map((r, i) => ({ id: `seed${i}`, ref: null, stripeRef: null, ...r }));
  const bundleRows = bundles.map((b) => ({ ...b }));
  let n = 0;
  const activity = [];
  const stripeCalls = { retrieve: [], cancel: [] };

  // Every subscription Stripe "knows about" — what subscriptions.retrieve
  // answers with, for the resolveAiBundleSubscription fallback path.
  const stripeSubscriptions = new Map();

  const db = {
    voiceCreditEntry: {
      findFirst: async ({ where }) => {
        const match = (r) => {
          if (where.companyId && r.companyId !== where.companyId) return false;
          if (where.stripeSubscriptionId) return false; // not a field on this table
          if (where.OR) {
            return where.OR.some((c) =>
              Object.entries(c).every(([k, v]) => v != null && r[k] === v),
            );
          }
          return Object.entries(where)
            .filter(([k]) => k !== "companyId")
            .every(([k, v]) => r[k] === v);
        };
        return rows.find(match) || null;
      },
    },
    aiCreditBundle: {
      findUnique: async ({ where }) => {
        if (where.companyId) return bundleRows.find((b) => b.companyId === where.companyId) || null;
        if (where.stripeSubscriptionId)
          return bundleRows.find((b) => b.stripeSubscriptionId === where.stripeSubscriptionId) || null;
        return null;
      },
      upsert: async ({ where, create, update }) => {
        const existing = bundleRows.find((b) => b.companyId === where.companyId);
        if (existing) {
          Object.assign(existing, update);
          return existing;
        }
        const row = { companyId: where.companyId, ...create };
        bundleRows.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const row = bundleRows.find((b) => b.companyId === where.companyId);
        if (!row) throw new Error("no such row");
        Object.assign(row, data);
        return row;
      },
    },
  };

  // The real writeEntry's pool derivation, reproduced rather than imported —
  // the whole point of check 2 below is that NOTHING in this file's own stub
  // can silently make it pass by hand-choosing the wallet. `poolForKind` is
  // the one real import; the ref-uniqueness enforcement is the one this
  // reproduces, same as check-voice-topup.mjs's fakeLedger.
  const addCredit = async ({ companyId, cents, kind, stripeRef, ref, note, expiresAt = null }) => {
    if (stripeRef && rows.some((r) => r.companyId === companyId && r.stripeRef === stripeRef)) {
      return null;
    }
    if (ref && rows.some((r) => r.companyId === companyId && r.ref === ref)) {
      return null; // P2002 — the unique (companyId, ref) index refusing a second write.
    }
    const row = { id: `e${++n}`, companyId, cents, kind, pool: poolForKind(kind), stripeRef, ref, note, expiresAt };
    rows.push(row);
    return row;
  };

  // The month-end reset grantAiBundlePeriod runs before each grant — counted
  // here, executed for real in section 6 against a ledger that can sum.
  const resetCalls = [];
  const expireDuePlanCreditStub = async (args) => {
    resetCalls.push(args?.companyId || null);
    return { grants: 0, reset: 0, expiredCents: 0 };
  };

  const balanceFor = async (companyId, _prisma, pool = POOLS.VOICE) =>
    rows
      .filter((r) => r.companyId === companyId && r.pool === pool)
      .reduce((s, r) => s + r.cents, 0);

  const recordActivity = async (member, event) => {
    activity.push({ companyId: member?.companyId, ...event });
  };

  const stripe = {
    subscriptions: {
      retrieve: async (id, opts) => {
        stripeCalls.retrieve.push(id);
        const sub = stripeSubscriptions.get(id);
        if (!sub) throw Object.assign(new Error("No such subscription"), { code: "resource_missing" });
        if (opts?.expand?.includes("latest_invoice") && typeof sub.latest_invoice === "string") {
          return { ...sub, latest_invoice: stripeSubscriptions.get(`invoice:${sub.latest_invoice}`) };
        }
        return sub;
      },
      cancel: async (id) => {
        stripeCalls.cancel.push(id);
        const sub = stripeSubscriptions.get(id);
        if (!sub) throw Object.assign(new Error("No such subscription"), { code: "resource_missing" });
        sub.status = "canceled";
        return sub;
      },
    },
  };

  return {
    rows,
    bundleRows,
    activity,
    stripeCalls,
    stripeSubscriptions,
    resetCalls,
    deps: { db, addCredit, balanceFor, recordActivity, stripe, expireDuePlanCredit: expireDuePlanCreditStub },
  };
}

const invoiceFor = (subscriptionId, periodStartUnix, over = {}) => ({
  id: `in_${subscriptionId}_${periodStartUnix}`,
  subscription: subscriptionId,
  status: "paid",
  lines: { data: [{ period: { start: periodStartUnix } }] },
  ...over,
});

const P1 = Math.floor(new Date("2026-09-01T00:00:00Z").getTime() / 1000);
const P2 = Math.floor(new Date("2026-10-01T00:00:00Z").getTime() / 1000);

/* ═══════════════════════════════════════════════════════════════════════════
   0. The checkout session itself — never a raw dollar amount from the
   browser, and never an unpriced bundle key.
   ═══════════════════════════════════════════════════════════════════════════ */

section("0. Starting a plan refuses an unpriced bundle key before touching Stripe or the database");
{
  // createAiBundleCheckoutSession takes no `deps` — it reaches the real
  // getOrCreateStripeCustomer/Stripe, which this script must never do (no
  // live secrets, no network). bundleByKey() is checked FIRST and returns
  // before either is touched, which is exactly what makes this assertion safe
  // to run here: an unknown key never reaches the network at all.
  const result = await createAiBundleCheckoutSession({
    company: { id: "co1", name: "Test Co" },
    bundleKey: "deluxe-plus",
    successUrl: "https://app/success",
    cancelUrl: "https://app/cancel",
  });
  ok("an unknown bundle key is refused, not silently priced at whatever the request said",
    result.ok === false && result.reason === "unknown_bundle");

  // ── Any company, in US dollars (owner, 2026-10-04) ───────────────────────
  for (const cur of ["CAD", "AUD", "GBP", "EUR"]) {
    const a = bundleAvailability(cur);
    ok(`a ${cur} company may start a plan, and is told it bills in US dollars`, a.ok === true && a.usdNote === true && a.currency === "USD");
    ok(`…on its separate USD add-on customer, never the ${cur} plan's customer`, bundleCustomerKind(cur) === "usd_add_ons");
  }
  ok("a USD company uses its one customer and reads no disclaimer about itself",
    bundleAvailability("USD").usdNote === false && bundleCustomerKind("USD") === "plan" && bundleCustomerKind(null) === "plan");
  for (const [cur, want] of [["GBP", "cus_usd_addons"], ["USD", "cus_plan"]]) {
    const calls = { usd: 0, plan: 0, sessions: [] };
    const fakeStripe = { checkout: { sessions: { create: async (p) => { calls.sessions.push(p); return { url: "https://checkout.stripe.test/x" }; } } } };
    const started = await createAiBundleCheckoutSession({
      company: { id: `co_${cur}`, name: "Test Co", currency: cur },
      bundleKey: "busy",
      successUrl: "https://app/success",
      cancelUrl: "https://app/cancel",
      deps: {
        stripe: fakeStripe,
        getOrCreateUsdAddOnCustomer: async () => { calls.usd++; return "cus_usd_addons"; },
        getOrCreateStripeCustomer: async () => { calls.plan++; return "cus_plan"; },
      },
    });
    const sent = calls.sessions[0];
    ok(`${cur} company: checkout opens on ${want}`, started.ok === true && sent?.customer === want && calls.usd + calls.plan === 1);
    ok(`${cur} company: the line is US$50.00 a month, whatever the company's currency`,
      sent?.line_items?.[0]?.price_data?.currency === "usd" && sent.line_items[0].price_data.unit_amount === 5000 && sent.line_items[0].price_data.recurring.interval === "month");
    ok(`${cur} company: the subscription carries companyId + kind (what settles it, never the customer)`,
      sent?.subscription_data?.metadata?.companyId === `co_${cur}` && sent.subscription_data.metadata.kind === "ai_bundle_subscription");
  }

  // resolveAiBundleSubscription: the shared lookup both the invoice-succeeded
  // path and the invoice-failed guard depend on. An id Stripe has never heard
  // of must resolve to "not a bundle" rather than throwing into the webhook.
  const w = makeWorld();
  const missing = await resolveAiBundleSubscription("sub_does_not_exist", { prisma: w.deps.db, deps: w.deps });
  ok("an unknown subscription id resolves to null rather than throwing", missing === null);
}

/* ═══════════════════════════════════════════════════════════════════════════
   1 & 2. The one-off top-up: doubled webhook credits once, and it is ALWAYS
   the AI wallet.
   ═══════════════════════════════════════════════════════════════════════════ */

section("1. A doubled webhook for an AI top-up credits ONCE");
{
  const w = makeWorld();
  const session = {
    id: "cs_ai_1",
    mode: "payment",
    payment_status: "paid",
    amount_total: 1000,
    payment_intent: "pi_ai_1",
    metadata: { companyId: "co1", kind: "ai_topup", cents: "1000" },
  };

  const first = await creditAiTopup(session, { deps: w.deps });
  ok("first delivery credits", first.credited === true && first.alreadyCredited === false);
  ok("for exactly what Stripe took", w.rows.length === 1 && w.rows[0].cents === 1000);

  const second = await creditAiTopup(session, { deps: w.deps });
  ok("redelivery does not write a second row", w.rows.length === 1);
  ok("…and says so, rather than claiming a fresh credit",
    second.credited === true && second.alreadyCredited === true);

  const third = await creditAiTopup(session, { deps: w.deps });
  ok("a third redelivery is still a no-op", w.rows.length === 1 && third.alreadyCredited === true);

  ok("keyed on the payment intent, the aiTopupRef prefix — never the voice one",
    w.rows[0].ref === aiTopupRef("pi_ai_1") && !w.rows[0].ref.startsWith("voice_topup:"));
}

section("2. ai_topup lands in the AI wallet and NEVER the voice one");
{
  const w = makeWorld();
  await creditAiTopup(
    { id: "cs_ai_2", mode: "payment", payment_status: "paid", amount_total: 500, payment_intent: "pi_ai_2",
      metadata: { companyId: "co1", kind: "ai_topup", cents: "500" } },
    { deps: w.deps },
  );
  ok("the row's derived pool is \"ai\"", w.rows[0].pool === POOLS.AI, w.rows[0].pool);
  ok("the AI balance sees it", (await w.deps.balanceFor("co1", null, POOLS.AI)) === 500);
  ok("the VOICE balance does not", (await w.deps.balanceFor("co1", null, POOLS.VOICE)) === 0);

  // Money already sitting in the OTHER wallet must not leak into this
  // balance read either — proves the read is scoped, not just the write.
  await w.deps.addCredit({ companyId: "co1", cents: 9999, kind: "topup", ref: "voice_topup:pi_x" });
  ok("a real phone top-up in the same ledger still doesn't touch the AI balance",
    (await w.deps.balanceFor("co1", null, POOLS.AI)) === 500);
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. The bundle: idempotent within a period, fires again next period.
   ═══════════════════════════════════════════════════════════════════════════ */

section("3. A bundle grant is idempotent within a period, and fires again next period");
{
  const w = makeWorld();
  w.stripeSubscriptions.set("sub_1", {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: P2,
    metadata: { companyId: "co1", kind: "ai_bundle_subscription", bundleKey: "starter" },
  });

  const bundle = bundleByKey("starter");
  ok("starter is a real, priced bundle", Boolean(bundle) && bundle.credits > 0);

  const r1 = await grantAiBundlePeriod(invoiceFor("sub_1", P1), { deps: w.deps });
  ok("first delivery of March's invoice grants", r1.handled === true && r1.granted === true);
  ok("for exactly the starter bundle's credits", w.rows.length === 1 && w.rows[0].cents === bundle.credits);
  ok("kind is ai_bundle", w.rows[0].kind === "ai_bundle");
  ok("the grant carries the month it is for: expiresAt = the period end (one calendar month on when the line has none)",
    w.rows[0].expiresAt instanceof Date && w.rows[0].expiresAt.getTime() === new Date("2026-10-01T00:00:00Z").getTime());
  ok("last month's plan credit is reset BEFORE the grant, for this company", w.resetCalls.length === 1 && w.resetCalls[0] === "co1");
  ok("the row it just created for the FIRST event this subscription ever produced",
    w.bundleRows.length === 1 && w.bundleRows[0].key === "starter");

  const r1Again = await grantAiBundlePeriod(invoiceFor("sub_1", P1), { deps: w.deps });
  ok("Stripe redelivering March's invoice.payment_succeeded does NOT grant again",
    w.rows.length === 1 && r1Again.handled === true);
  const r1ThirdTime = await grantAiBundlePeriod(invoiceFor("sub_1", P1), { deps: w.deps });
  ok("…nor a third redelivery", w.rows.length === 1);

  const r2 = await grantAiBundlePeriod(invoiceFor("sub_1", P2), { deps: w.deps });
  ok("a GENUINELY new period (April) grants again", r2.handled === true && r2.granted === true);
  ok("two periods, two credits, not one merged row",
    w.rows.length === 2 && w.rows[0].cents + w.rows[1].cents === bundle.credits * 2);
  ok("March and April keyed under different refs",
    w.rows[0].ref === aiBundleRef("sub_1", new Date(P1 * 1000)) &&
      w.rows[1].ref === aiBundleRef("sub_1", new Date(P2 * 1000)));

  const r2Again = await grantAiBundlePeriod(invoiceFor("sub_1", P2), { deps: w.deps });
  ok("April redelivered is ALSO a no-op — idempotency isn't a one-time fluke",
    w.rows.length === 2 && r2Again.handled === true);

  // An invoice line that names its end is believed over the month arithmetic.
  const w3 = makeWorld();
  w3.stripeSubscriptions.set("sub_end", {
    id: "sub_end", customer: "cus_end", status: "active", current_period_end: P2,
    metadata: { companyId: "co_end", kind: "ai_bundle_subscription", bundleKey: "busy" },
  });
  const endUnix = Math.floor(new Date("2026-09-30T12:00:00Z").getTime() / 1000);
  await grantAiBundlePeriod(invoiceFor("sub_end", P1, { lines: { data: [{ period: { start: P1, end: endUnix } }] } }), { deps: w3.deps });
  ok("the invoice's own period.end is the reset date", w3.rows[0]?.expiresAt?.getTime() === endUnix * 1000);
  ok("one month on is calendar-clamped (31 Jan → 28 Feb, 31 Aug → 30 Sep)",
    oneMonthAfter(new Date("2027-01-31T10:00:00Z")).toISOString() === "2027-02-28T10:00:00.000Z" &&
      oneMonthAfter(new Date("2026-08-31T00:00:00Z")).toISOString() === "2026-09-30T00:00:00.000Z");
}

section("3b. An invoice for a subscription that is NOT a bundle is refused, not guessed at");
{
  const w = makeWorld();
  w.stripeSubscriptions.set("sub_plan", {
    id: "sub_plan",
    customer: "cus_1",
    status: "active",
    metadata: { companyId: "co1", planId: "plan_solo" }, // the company's OWN plan — no bundle kind
  });
  const r = await grantAiBundlePeriod(invoiceFor("sub_plan", P1), { deps: w.deps });
  ok("handled: false — this is the signal the webhook route falls through on",
    r.handled === false && r.reason === "not_a_bundle");
  ok("nothing was granted for the company's own plan renewing", w.rows.length === 0);
  ok("and no AiCreditBundle row was invented for it", w.bundleRows.length === 0);
}

section("3c. The browser-return confirm and the invoice webhook are two doors, one grant");
{
  // Mirrors lib/voice/topup.js's two-doors shape, one wallet over: whichever
  // arrives first grants, and the second is a confirmed no-op — never a
  // doubled allowance, and never a missed one if the webhook is what actually
  // arrives first (Checkout's redirect can be slow, lost, or never happen).
  const w = makeWorld();
  w.stripeSubscriptions.set("sub_4", {
    id: "sub_4",
    customer: "cus_4",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: P2,
    metadata: { companyId: "co4", kind: "ai_bundle_subscription", bundleKey: "agency" },
    latest_invoice: "in4",
  });
  w.stripeSubscriptions.set("invoice:in4", invoiceFor("sub_4", P1, { id: "in4" }));

  const session = {
    id: "cs_bundle_confirm",
    mode: "subscription",
    status: "complete",
    subscription: "sub_4",
    metadata: { companyId: "co4", kind: "ai_bundle_subscription" },
  };

  // Door 1: the browser comes back and confirms.
  const confirmed = await settleAiBundleCheckoutSession(session, { deps: w.deps });
  ok("the browser-return door grants the first period",
    confirmed.ok === true && confirmed.granted?.granted === true);
  ok("exactly one row", w.rows.length === 1);

  // Door 2: the webhook's invoice.payment_succeeded for the SAME invoice,
  // arriving after (Stripe does not guarantee which door wins the race).
  const webhookSide = await grantAiBundlePeriod(invoiceFor("sub_4", P1, { id: "in4" }), { deps: w.deps });
  ok("the webhook, arriving second, is a no-op — not a doubled grant",
    webhookSide.handled === true && w.rows.length === 1);

  // And the reverse order: webhook first, browser confirm second.
  const w2 = makeWorld();
  w2.stripeSubscriptions.set("sub_5", {
    id: "sub_5", customer: "cus_5", status: "active", current_period_end: P2,
    metadata: { companyId: "co5", kind: "ai_bundle_subscription", bundleKey: "starter" },
    latest_invoice: "in5",
  });
  w2.stripeSubscriptions.set("invoice:in5", invoiceFor("sub_5", P1, { id: "in5" }));
  await grantAiBundlePeriod(invoiceFor("sub_5", P1, { id: "in5" }), { deps: w2.deps });
  ok("webhook first: one row", w2.rows.length === 1);
  const confirmedSecond = await settleAiBundleCheckoutSession(
    { id: "cs_x", mode: "subscription", status: "complete", subscription: "sub_5",
      metadata: { companyId: "co5", kind: "ai_bundle_subscription" } },
    { deps: w2.deps },
  );
  ok("browser confirm, arriving second, does not grant a second time",
    confirmedSecond.ok === true && w2.rows.length === 1);
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Cancelling stops future grants without clawing back or deleting rows.
   ═══════════════════════════════════════════════════════════════════════════ */

section("4. Cancelling stops future grants, keeps this month's credit until its reset date, deletes nothing");
{
  const w = makeWorld({
    bundleRows: [],
  });
  w.stripeSubscriptions.set("sub_2", {
    id: "sub_2",
    customer: "cus_2",
    status: "active",
    cancel_at_period_end: false,
    current_period_end: P2,
    metadata: { companyId: "co2", kind: "ai_bundle_subscription", bundleKey: "busy" },
  });
  await grantAiBundlePeriod(invoiceFor("sub_2", P1), { deps: w.deps });
  const balanceBefore = await w.deps.balanceFor("co2", null, POOLS.AI);
  const rowCountBefore = w.rows.length;
  ok("a period was granted before cancelling", balanceBefore === bundleByKey("busy").credits);

  const result = await cancelAiBundle("co2", { prisma: w.deps.db, deps: w.deps });
  ok("cancelAiBundle reports success", result.ok === true);
  ok("it actually calls Stripe to cancel the RIGHT subscription — this is the real enforcement",
    w.stripeCalls.cancel.length === 1 && w.stripeCalls.cancel[0] === "sub_2");
  ok("the row is marked canceled, not deleted", w.bundleRows.length === 1 && w.bundleRows[0].status === "canceled");

  ok("the ledger is untouched by cancelling — no row added, none removed",
    w.rows.length === rowCountBefore);
  ok("…and the month already paid for is still spendable — nothing is clawed back AT cancel; it resets on its own date (section 6)",
    (await w.deps.balanceFor("co2", null, POOLS.AI)) === balanceBefore);

  // Cancel again — must not double-cancel at Stripe or error.
  const again = await cancelAiBundle("co2", { prisma: w.deps.db, deps: w.deps });
  ok("cancelling an already-cancelled plan is a clean no-op", again.ok === true && again.reason === "already_canceled");
  ok("…and does not call Stripe a second time", w.stripeCalls.cancel.length === 1);

  // A Stripe failure must NOT be reported as success — the row would then lie
  // about a subscription that is still live and still billing.
  const w2 = makeWorld();
  w2.stripeSubscriptions.set("sub_3", {
    id: "sub_3", customer: "cus_3", status: "active",
    metadata: { companyId: "co3", kind: "ai_bundle_subscription", bundleKey: "agency" },
  });
  await upsertAiCreditBundleFromSubscription(w2.stripeSubscriptions.get("sub_3"), { prisma: w2.deps.db });
  const brokenStripe = {
    subscriptions: {
      cancel: async () => { throw Object.assign(new Error("network"), { code: "boom" }); },
    },
  };
  const failed = await cancelAiBundle("co3", { prisma: w2.deps.db, deps: { ...w2.deps, stripe: brokenStripe } });
  ok("an unreachable Stripe is reported as a FAILURE, not a silent success",
    failed.ok === false && failed.reason === "stripe_unavailable");
  ok("…and the row still says active — it must not lie about being cancelled",
    w2.bundleRows[0].status === "active");
}

/* ═══════════════════════════════════════════════════════════════════════════
   5. Cannot be mistaken for the company's own plan subscription.
   ═══════════════════════════════════════════════════════════════════════════ */

section("5. A bundle checkout is claimed by the dispatcher and never reaches plan billing");
{
  // The dispatcher's own `ai_bundle_subscription` branch reaches a real
  // Stripe subscriptions.retrieve() with no `deps` seam of its own (it defers
  // entirely to settleAiBundleCheckoutSession, which IS injectable — see the
  // 3c block above, which exercises that function directly against the fake
  // world). So this is checked from source rather than executed against a
  // live Stripe call this script must never make: the same trade-off
  // check-voice-topup.mjs makes for its own "both webhooks reach the
  // dispatcher" assertion.
  const dispatcher = code(read("lib/stripe/settleCheckoutSession.js"));
  ok("mode:\"subscription\" + kind:\"ai_bundle_subscription\" is claimed before it can reach plan billing",
    /session\?\.mode === "subscription" && kind === "ai_bundle_subscription"/.test(dispatcher) &&
      /settleAiBundleCheckoutSession\(session\)/.test(dispatcher) &&
      /return \{ handled: true, kind: "ai_bundle_subscription"/.test(dispatcher));

  const other = await settleCheckoutSession({
    id: "cs_plan_1",
    mode: "subscription",
    metadata: { companyId: "co1", planId: "plan_solo" },
  });
  ok("the company's OWN plan checkout is still NOT claimed by this dispatcher — it belongs to billing",
    other.handled === false);

  const topup = await settleCheckoutSession({
    id: "cs_ai_topup_1",
    mode: "payment",
    payment_status: "unpaid",
    metadata: { companyId: "co1", kind: "ai_topup" },
  });
  ok("an ai_topup session is claimed too", topup.handled === true && topup.kind === "ai_topup");
  ok("…and an unpaid one credits nothing", topup.result?.credited === false);
}

section("5b. The billing webhook intercepts a bundle's invoice BEFORE the company's plan handler sees it");
{
  const route = code(read("app/api/platform/billing/webhook/route.js"));
  // The exact, ANCHORED guard line — not just the presence of the two type
  // strings somewhere in the file. Mutation testing found the gap this
  // closes: `if (false && (event.type === "invoice.payment_succeeded" || …))`
  // still contains both literal comparisons, so a looser
  // `.test(route)`-per-string check passed against a guard that had been
  // switched off entirely. Anchoring on the real `if (` line is what a
  // disabled branch cannot satisfy.
  const guardLine =
    'if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {';
  ok("the exact, unconditional guard line is present — not merely the two event names somewhere in the file",
    route.includes(guardLine));
  ok("invoice.payment_succeeded is checked against the bundle table first",
    route.includes(guardLine) && /grantAiBundlePeriod\(invoice\)/.test(route));
  ok("a handled bundle invoice RETURNS before syncSubscriptionFromStripeEvent runs",
    (() => {
      const succIdx = route.indexOf(guardLine);
      const syncIdx = route.indexOf("await syncSubscriptionFromStripeEvent(event)");
      const returnIdx = route.indexOf("settled: \"ai_bundle_period\"", succIdx);
      return succIdx !== -1 && syncIdx !== -1 && returnIdx !== -1 && returnIdx < syncIdx;
    })());
  ok("invoice.payment_failed is checked too — a bundle decline must not mark the company's PLAN past-due",
    route.includes(guardLine) && /resolveAiBundleSubscription\(/.test(route));

  // Raw source, NOT comment-stripped — this is a documentation check. The
  // explanation of the collision lives entirely in the module's header
  // comment, so `code()` (which exists to keep prose out of the OTHER
  // assertions' pattern matches) would erase the very thing being checked
  // for here.
  const bundleFileRaw = read("lib/ai/creditBundle.js");
  ok("the collision this guards against is written down, not just fixed",
    /SAME Stripe customer/i.test(bundleFileRaw) && /referral-credit/i.test(bundleFileRaw));
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. Refusals are honest — the three different reasons stay different.
   ═══════════════════════════════════════════════════════════════════════════ */

section("6. Refusals distinguish not-configured, zero balance, and unreachable Stripe");
{
  const creditRoute = code(read("app/api/settings/ai/credit/route.js"));
  ok("the unified view reports whether the AI vendor is configured on this deployment",
    /vendorConfigured:\s*isAiConfigured\(\)/.test(creditRoute));

  // ── Follow the reason to where it is now produced ────────────────────────
  //
  // The Checkout session moved out of this route into lib/ai/topupIntent.js on
  // 2026-09-02, so the dialog over the designer's canvas and the settings page
  // could not build two different ones. The route no longer holds the literal;
  // it FORWARDS the reason the shared module returns. This asserts both halves
  // rather than following the string into its new home and asserting less: the
  // module still distinguishes an unreachable Stripe by name, and both routes
  // still pass a reason through instead of collapsing it into a bare 500.
  const topupIntent = code(read("lib/ai/topupIntent.js"));
  ok("an unreachable Stripe is still named, not collapsed into a generic failure",
    /reason: "stripe_unavailable"/.test(topupIntent));

  const topupRoute = code(read("app/api/settings/ai/topup/route.js"));
  const inlineTopupRoute = code(read("app/api/ai/topup/route.js"));
  ok("a Stripe failure buying AI credit is its own reason, not a generic 500",
    /reason: result\.reason/.test(topupRoute) && /reason: result\.reason/.test(inlineTopupRoute));

  const bundleRoute = code(read("app/api/settings/ai/bundle/route.js"));
  ok("…and the same is true starting a bundle plan",
    /reason: "stripe_unavailable"/.test(bundleRoute));
  ok("…and cancelling one",
    (bundleRoute.match(/reason: result\.reason/g) || []).length > 0 ||
      /reason: "stripe_unavailable"/.test(bundleRoute));

  // The pre-existing spend refusal (image generation / vision) already states
  // price, balance and shortfall — this proves that shape wasn't disturbed by
  // adding a way to fix it.
  const visionRoute = code(read("app/api/quotes/[id]/vision/route.js"));
  ok("the deep-read refusal still states the price, the balance AND the shortfall",
    /needCents/.test(visionRoute) && /balanceCents/.test(visionRoute) && /shortfallCents/.test(visionRoute));
}

/* ═══════════════════════════════════════════════════════════════════════════
   6. Plan credit resets monthly; top-ups persist — executed, not described.
   ═══════════════════════════════════════════════════════════════════════════ */

function makeSummingLedger() {
  const rows = [];
  let n = 0;
  const clock = { now: new Date("2026-10-01T00:00:00Z") };
  const cmp = (v, cond) => {
    if (cond === undefined) return true;
    if (cond === null || typeof cond !== "object" || cond instanceof Date) {
      return cond instanceof Date ? v instanceof Date && v.getTime() === cond.getTime() : v === cond;
    }
    if ("not" in cond && v === cond.not) return false;
    const t = v instanceof Date ? v.getTime() : v;
    const at = (x) => (x instanceof Date ? x.getTime() : x);
    if ("lt" in cond && !(v != null && t < at(cond.lt))) return false;
    if ("lte" in cond && !(v != null && t <= at(cond.lte))) return false;
    if ("gt" in cond && !(v != null && t > at(cond.gt))) return false;
    if ("gte" in cond && !(v != null && t >= at(cond.gte))) return false;
    return true;
  };
  const match = (where = {}) => (r) => Object.entries(where).every(([k, c]) => cmp(r[k], c));
  const ledger = {
    rows,
    clock,
    voiceCreditEntry: {
      findFirst: async ({ where, orderBy }) => {
        const hits = rows.filter(match(where));
        if (orderBy?.createdAt === "desc") hits.sort((a, b) => b.createdAt - a.createdAt);
        return hits[0] || null;
      },
      findMany: async ({ where, orderBy, take }) => {
        const hits = rows.filter(match(where));
        if (orderBy?.expiresAt === "asc") hits.sort((a, b) => a.expiresAt - b.expiresAt);
        return take ? hits.slice(0, take) : hits;
      },
      aggregate: async ({ where }) => ({ _sum: { cents: rows.filter(match(where)).reduce((s, r) => s + r.cents, 0) || null } }),
      create: async ({ data }) => {
        if (data.ref && rows.some((r) => r.companyId === data.companyId && r.ref === data.ref)) {
          throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
        }
        const row = { id: `L${++n}`, ref: null, stripeRef: null, callId: null, expiresAt: null, createdAt: new Date(clock.now), ...data };
        rows.push(row);
        return row;
      },
    },
  };
  // Writes through the REAL addCredit/debitCredit → writeEntry chain, so the
  // pool and the unique ref are the production rules, not this file's.
  ledger.at = (iso) => { clock.now = new Date(iso); };
  return ledger;
}

section("6. Plan credit resets each month; top-ups persist (owner, 2026-10-04)");
{
  const { addCredit: realAddCredit, debitCredit: realDebit } = await import("@/lib/voice/credits");
  ok("the reset row is an AI-wallet kind — never the phone balance", poolForKind(PLAN_EXPIRY_KIND) === POOLS.AI);

  // Pure arithmetic first.
  ok("quiet month: 7,000 granted, 4,000 spent → 3,000 left to reset", planCreditLeft({ grantCents: 7000, spentCents: 4000, balanceCents: 3000 }) === 3000);
  ok("busy month: 7,500 spent of a 7,000 grant → nothing left; the top-up paid the rest", planCreditLeft({ grantCents: 7000, spentCents: 7500, balanceCents: 500 }) === 0);
  ok("a balance below the grant's remainder caps it — what is not there cannot expire", planCreditLeft({ grantCents: 7000, spentCents: 0, balanceCents: 2000 }) === 2000);
  ok("an overdrawn balance resets nothing", planCreditLeft({ grantCents: 7000, spentCents: 0, balanceCents: -50 }) === 0);
  const split = splitAiBalance({ balanceCents: 7500, grantCents: 7000, spentCents: 0, resetsOn: "2026-12-01" });
  ok("the split: 7,000 plan (resets) + 500 top-up (persists)", split.planCents === 7000 && split.topupCents === 500 && split.resetsOn instanceof Date);
  ok("no plan month running → all of it persists", splitAiBalance({ balanceCents: 1200 }).planCents === 0 && splitAiBalance({ balanceCents: 1200 }).topupCents === 1200);

  // Worked example 1 — the quiet month, through the real ledger chain.
  {
    const L = makeSummingLedger();
    L.at("2026-10-01T00:05:00Z");
    const grant = await realAddCredit({ companyId: "q", cents: 7000, kind: "ai_bundle", ref: "ai_bundle:sub_q:2026-10-01", expiresAt: new Date("2026-11-01T00:00:00Z"), prisma: L });
    L.at("2026-10-12T00:00:00Z");
    await realDebit({ companyId: "q", cents: 4000, kind: "image_generation", ref: "gen:q:1", prisma: L });
    const early = await expirePlanGrant(grant, { prisma: L, now: new Date("2026-10-20T00:00:00Z") });
    ok("quiet month: nothing resets before the month ends", early.expired === 0 && early.reason === "month_not_over");
    const mid = await aiPlanCreditStatus("q", { prisma: L, now: new Date("2026-10-20T00:00:00Z") });
    ok("mid-month the screen says 3,000 plan credit, resets 1 Nov; 0 top-up", mid.planCents === 3000 && mid.topupCents === 0 && mid.resetsOn.toISOString().startsWith("2026-11-01"));
    L.at("2026-11-01T00:10:00Z");
    const r = await expireDuePlanCredit({ companyId: "q", prisma: L, now: new Date("2026-11-01T00:10:00Z") });
    ok("1 Nov: −3,000 reset, written once", r.expiredCents === 3000 && L.rows.filter((x) => x.kind === PLAN_EXPIRY_KIND).length === 1);
    const resetRow = L.rows.find((x) => x.kind === PLAN_EXPIRY_KIND);
    ok("…as a negative AI-wallet row under the grant's own ref", resetRow.cents === -3000 && resetRow.pool === POOLS.AI && resetRow.ref === planExpiryRef(grant.id));
    const again = await expireDuePlanCredit({ companyId: "q", prisma: L, now: new Date("2026-11-02T00:00:00Z") });
    ok("the daily sweep running again resets nothing twice", again.expiredCents === 0 && L.rows.filter((x) => x.kind === PLAN_EXPIRY_KIND).length === 1);
    await realAddCredit({ companyId: "q", cents: 7000, kind: "ai_bundle", ref: "ai_bundle:sub_q:2026-11-01", expiresAt: new Date("2026-12-01T00:00:00Z"), prisma: L });
    const bal = L.rows.filter((x) => x.companyId === "q" && x.pool === POOLS.AI).reduce((s, x) => s + x.cents, 0);
    ok("then +7,000 for November: balance 7,000 — last month did NOT roll over", bal === 7000);
  }

  // Worked example 2 — the busy month with a top-up.
  {
    const L = makeSummingLedger();
    L.at("2026-10-01T00:05:00Z");
    const grant = await realAddCredit({ companyId: "b", cents: 7000, kind: "ai_bundle", ref: "ai_bundle:sub_b:2026-10-01", expiresAt: new Date("2026-11-01T00:00:00Z"), prisma: L });
    L.at("2026-10-15T00:00:00Z");
    await realDebit({ companyId: "b", cents: 6500, kind: "ai_employee_reply", ref: "emp:b:1", prisma: L });
    L.at("2026-10-20T00:00:00Z");
    await realAddCredit({ companyId: "b", cents: 1000, kind: "ai_topup", ref: "ai_topup:pi_b", stripeRef: "pi_b", prisma: L });
    const after = await aiPlanCreditStatus("b", { prisma: L, now: new Date("2026-10-20T01:00:00Z") });
    ok("after the top-up: 500 plan credit (resets) + 1,000 top-up (persists)", after.planCents === 500 && after.topupCents === 1000);
    L.at("2026-10-25T00:00:00Z");
    await realDebit({ companyId: "b", cents: 1000, kind: "plan_read", ref: "read:b:1", prisma: L });
    const late = await aiPlanCreditStatus("b", { prisma: L, now: new Date("2026-10-26T00:00:00Z") });
    ok("1,000 more spent: the plan's last 500 went first, then 500 of the top-up", late.planCents === 0 && late.topupCents === 500);
    const r = await expirePlanGrant(grant, { prisma: L, now: new Date("2026-11-01T00:01:00Z") });
    ok("1 Nov: the plan month was fully spent — no reset row, and the top-up is untouched", r.expired === 0 && r.reason === "month_fully_spent" && !L.rows.some((x) => x.kind === PLAN_EXPIRY_KIND));
    L.at("2026-11-01T00:05:00Z");
    await realAddCredit({ companyId: "b", cents: 7000, kind: "ai_bundle", ref: "ai_bundle:sub_b:2026-11-01", expiresAt: new Date("2026-12-01T00:00:00Z"), prisma: L });
    const nov = await aiPlanCreditStatus("b", { prisma: L, now: new Date("2026-11-02T00:00:00Z") });
    ok("November: 7,500 = 7,000 plan (resets 1 Dec) + 500 top-up (never expires)",
      nov.balanceCents === 7500 && nov.planCents === 7000 && nov.topupCents === 500 && nov.resetsOn.toISOString().startsWith("2026-12-01"));
  }

  // A cancelled plan: the paid month runs out, then the sweep resets it.
  {
    const L = makeSummingLedger();
    L.at("2026-10-01T00:05:00Z");
    await realAddCredit({ companyId: "c", cents: 4000, kind: "ai_bundle", ref: "ai_bundle:sub_c:2026-10-01", expiresAt: new Date("2026-11-01T00:00:00Z"), prisma: L });
    await realAddCredit({ companyId: "c", cents: 1000, kind: "ai_topup", ref: "ai_topup:pi_c", stripeRef: "pi_c", prisma: L });
    const before = await expireDuePlanCredit({ prisma: L, now: new Date("2026-10-31T23:00:00Z") });
    ok("cancelled mid-month: the sweep leaves the paid month alone until it ends", before.expiredCents === 0);
    const after = await expireDuePlanCredit({ prisma: L, now: new Date("2026-11-01T05:45:00Z") });
    const bal = L.rows.filter((x) => x.companyId === "c").reduce((s, x) => s + x.cents, 0);
    ok("…then resets the unused 4,000 and leaves the 1,000 top-up", after.expiredCents === 4000 && bal === 1000);
    ok("top-ups never carry an expiry", L.rows.filter((x) => x.kind === "ai_topup").every((x) => x.expiresAt === null));
  }

  // Older grants (written before this decision) carry no expiresAt and are never reset.
  {
    const L = makeSummingLedger();
    await realAddCredit({ companyId: "old", cents: 4000, kind: "ai_bundle", ref: "ai_bundle:sub_old:2026-09-01", prisma: L });
    const r = await expireDuePlanCredit({ prisma: L, now: new Date("2027-01-01T00:00:00Z") });
    ok("a grant with no expiresAt (sold under the rollover promise) is never reset", r.grants === 0 && r.expiredCents === 0);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   7. The rollover policy is one sentence, read from one place, stated before
   anyone pays.
   ═══════════════════════════════════════════════════════════════════════════ */

section("7. Reset vs rollover is a stated decision, not silence (owner, 2026-10-04: plan credit resets, top-ups persist)");
{
  ok("the notice says plan credit resets every month and top-ups don't expire",
    /resets every month/i.test(BUNDLE_RESET_NOTICE) && /top-ups don't expire/i.test(BUNDLE_RESET_NOTICE) && !/rolls? over/i.test(BUNDLE_RESET_NOTICE));
  ok("the English the page prints IS that notice — the code and the screen cannot drift",
    APP_MESSAGES.en["app.setAiCredit.resetNotice"] === BUNDLE_RESET_NOTICE);
  for (const [lang, m] of Object.entries(APP_MESSAGES)) {
    ok(`${lang}: the reset notice, the plan/top-up split and the persists line are translated`,
      ["app.setAiCredit.resetNotice", "app.setAiCredit.planLeft", "app.setAiCredit.topupLeft", "app.setAiCredit.topupPersists", "app.setAiCredit.cancelNote", "app.setAiCredit.cancelNoteNoDate"].every((k) => String(m[k] || "").length > 10) &&
        String(m["app.setAiCredit.planLeft"]).includes("{date}") && String(m["app.setAiCredit.planLeft"]).includes("{amount}") &&
        String(m["app.setAiCredit.cancelNote"]).includes("{date}"));
  }
  ok("no language still promises plan credit never expires on cancel",
    Object.values(APP_MESSAGES).every((m) => !/never gets taken back|doesn't expire\.$/.test(String(m["app.setAiCredit.cancelNote"] || ""))));

  const page = code(read("app/app/settings/ai-credit/page.js"));
  ok("the settings page prints the translated reset notice before the Subscribe buttons",
    /"app\.setAiCredit\.resetNotice"/.test(page) && page.indexOf("app.setAiCredit.resetNotice") < page.indexOf("subscribeBundle(b.key)"));
  ok("…and the split: plan credit with its reset date, top-up credit that doesn't expire",
    /PlanCreditSplit/.test(page) && /"app\.setAiCredit\.planLeft"/.test(page) && /"app\.setAiCredit\.topupLeft"/.test(page) && /ai\.planCredit/.test(page));
  ok("the top-up card says top-ups don't expire, where they are bought",
    /"app\.setAiCredit\.topupPersists"/.test(code(read("app/app/settings/ai-credit/AiCreditCard.js"))));

  const creditRoute = code(read("app/api/settings/ai/credit/route.js"));
  ok("the unified route sends the split from the reset's own arithmetic (aiPlanCreditStatus)",
    /aiPlanCreditStatus\(/.test(creditRoute) && /planCredit:/.test(creditRoute) && /bundleResetNotice/.test(creditRoute));

  const cron = code(read("app/api/cron/ai-plan-reset/route.js"));
  const vercel = JSON.parse(read("vercel.json"));
  ok("the daily sweep for a month that ended with no renewal is a real, scheduled, authenticated cron",
    vercel.crons.some((c) => c.path === "/api/cron/ai-plan-reset") && /requireCronSecret\(request\)/.test(cron) && /expireDuePlanCredit\(/.test(cron));

  ok("BUNDLES matches the owner-approved economics (starter/busy/agency)",
    BUNDLES.length === 3 &&
      BUNDLES.find((b) => b.key === "starter")?.credits === 4000 &&
      BUNDLES.find((b) => b.key === "busy")?.credits === 7000 &&
      BUNDLES.find((b) => b.key === "agency")?.credits === 11500);
}

/* ═══════════════════════════════════════════════════════════════════════════
   8. The demo AI credit grant — a GRANT, never a bypass.
   ═══════════════════════════════════════════════════════════════════════════

   A real prisma double for voiceCreditEntry.create/findFirst — NOT the fake
   `addCredit` used above. The point of this section is to execute the ACTUAL
   grantDemoAiCredit → addCredit → writeEntry chain, including the real P2002
   collision handling, rather than a second copy of "what it should do". */

function makeRealLedgerPrisma() {
  const rows = [];
  let n = 0;
  return {
    rows,
    voiceCreditEntry: {
      findFirst: async ({ where }) =>
        rows.find((r) => {
          if (where.companyId !== undefined && r.companyId !== where.companyId) return false;
          if (where.ref !== undefined && r.ref !== where.ref) return false;
          if (where.stripeRef !== undefined && r.stripeRef !== where.stripeRef) return false;
          return true;
        }) || null,
      create: async ({ data }) => {
        // The real database's unique (companyId, ref) index, reproduced —
        // same discipline as every other fakeLedger in this repo's check
        // scripts, because modelling it as a plain push would test the happy
        // path and miss the thing that actually holds under a race.
        if (data.ref && rows.some((r) => r.companyId === data.companyId && r.ref === data.ref)) {
          throw Object.assign(new Error("Unique constraint failed on the fields: (`companyId`,`ref`)"), {
            code: "P2002",
          });
        }
        const row = { id: `r${++n}`, ...data };
        rows.push(row);
        return row;
      },
    },
  };
}

section("8. The demo AI credit grant is a GRANT, never a bypass");
{
  const prisma = makeRealLedgerPrisma();

  const first = await grantDemoAiCredit("demo1", prisma);
  ok("the real grant function writes a row", first !== null && prisma.rows.length === 1);
  ok("exactly 1,000 credits — the owner-approved figure, not a guess",
    prisma.rows[0].cents === DEMO_AI_CREDIT_CENTS, prisma.rows[0].cents);
  ok("the row's WALLET is derived from the kind, same as every other row — \"ai\", never \"voice\"",
    prisma.rows[0].pool === POOLS.AI && prisma.rows[0].pool !== POOLS.VOICE, prisma.rows[0].pool);
  ok("keyed on the one ref with no version suffix — same reasoning as TRIAL_REF",
    prisma.rows[0].ref === DEMO_AI_CREDIT_REF);

  const second = await grantDemoAiCredit("demo1", prisma);
  ok("granting the SAME demo again writes NOTHING — one row, one balance",
    prisma.rows.length === 1);
  ok("…and does not report failure — a redundant grant is a confirmed no-op, not an error",
    second !== null);

  // seedDemo.js calls this on every applyIndustry pass — creation, an
  // industry switch, a reset. Simulate three passes back to back.
  await grantDemoAiCredit("demo1", prisma);
  await grantDemoAiCredit("demo1", prisma);
  ok("three more passes through applyIndustry still leave exactly one row",
    prisma.rows.length === 1);

  const other = await grantDemoAiCredit("demo2", prisma);
  ok("a DIFFERENT demo company gets its own grant — the ref is unique per company, not global",
    other !== null && prisma.rows.length === 2);
  ok("…for the same 1,000 credits", prisma.rows[1].cents === DEMO_AI_CREDIT_CENTS);

  ok("no companyId, no grant — never writes an orphan row",
    (await grantDemoAiCredit(null, prisma)) === null && prisma.rows.length === 2);
}

section("8b. Non-demo companies never reach the grant — the guard is in the CALLER, not a spend-gate branch");
{
  const seed = code(read("lib/demo/seedDemo.js"));
  const assertIdx = seed.indexOf("async function applyIndustry");
  const body = seed.slice(assertIdx);
  const guardIdx = body.indexOf("assertDemo(companyId)");
  const grantIdx = body.indexOf("grantDemoAiCredit(companyId)");
  ok("applyIndustry calls assertDemo() BEFORE grantDemoAiCredit() — the guard runs first",
    guardIdx !== -1 && grantIdx !== -1 && guardIdx < grantIdx);

  const assertBody = seed.slice(seed.indexOf("async function assertDemo"), seed.indexOf("async function wipeContent"));
  ok("assertDemo THROWS for a company whose isDemo is not true — re-read from the database, not trusted from a caller",
    /if \(!company\.isDemo\)/.test(assertBody) && /throw/.test(assertBody));

  // The grant function itself has NO isDemo check — by design, see its own
  // header comment. Confirm that design decision is actually written down,
  // not just true by omission.
  const creditsFile = seed.includes("grantDemoAiCredit") ? read("lib/voice/credits.js") : "";
  ok("the grant function's own doc explains why callers, not itself, hold the isDemo check",
    /Callers must check `company\.isDemo`/.test(creditsFile));
}

section("8c. The spend gate has NO isDemo branch — a demo has a balance, not a bypass");
{
  // Every file a spend or a feature check could plausibly live in. A branch
  // in ANY of these would mean a demo account stops being metered the normal
  // way, which is exactly the unbounded-bill risk the design note in
  // credits.js argues against.
  const gateFiles = [
    "lib/voice/spendGate.js",
    "lib/features/gate.js",
    "lib/ai/provider.js",
    "lib/designer/aiImageAdapter.js",
    "app/api/quotes/[id]/vision/route.js",
    "app/api/designer/generate/route.js",
    "app/api/designer/remove-bg/route.js",
  ];
  for (const f of gateFiles) {
    const src = read(f);
    ok(`${f}: no isDemo branch`, !/isDemo/.test(src));
  }

  // And the reverse of 8/8b: prove a demo balance is spent through the exact
  // same accounting a paying company's is — no special-cased debit path.
  // priceSpend/checkSpend are pure functions of kind + balance; a demo
  // company's balance is just a number that happens to include an
  // "ai_demo_grant" row, and this asserts nothing in the gate can tell the
  // difference.
  const gate = read("lib/voice/spendGate.js");
  ok("checkSpend takes no isDemo-shaped parameter at all",
    !/checkSpend\([^)]*isDemo/.test(gate) && !/reserveSpend\([^)]*isDemo/.test(gate));
}

/* ═══════════════════════════════════════════════════════════════════════════
   Money-fixes finding #2: checkAiQuota BEFORE the model call, on the
   monthly-digest cron. Executed against lib/ai/monthlyDigest.js's
   buildDigestInsights (buildDigestSummaryText until 2026-10-03) with every dependency faked — the injection seam
   exists specifically so this can run without a database or an OpenAI key,
   the same discipline check-digest-transcripts.mjs already uses for
   buildCallInsights's own quota gate.

   (The other half of finding #2 — app/api/ai/ai-summary/route.js, the
   on-demand expense summary — is a two-line route guard with no logic of
   its own to execute: `if (!quota.allowed) return 429`. Covered by
   node --check plus reading the 429 body shape matches every OTHER
   quota-gated route in this codebase (app/api/quotes/[id]/review,
   app/api/ai/copilot) rather than by a fixture here.)
   ═══════════════════════════════════════════════════════════════════════════ */
{
  section("AI quota gate — monthly digest cron (money-fixes finding #2)");


  // The digest's model call is buildDigestInsights since 2026-10-03 (it words
  // the "what to act on" lines of the monthly summary email; the numbers are
  // built in code). Owner, same day: it runs ONLY for a company with AI
  // credit and is paid from it — the gate is meterFor("monthly_digest")'s
  // wallet check(). Same seam discipline: the meter is handed in as a fake.
  const { buildDigestInsights } = await import("@/lib/ai/monthlyDigest");
  const { summaryFormatter } = await import("@/lib/email/monthlySummaryEmail");
  const fmt = summaryFormatter({ language: "en", currency: "CAD" });
  const facts = [
    {
      key: "overdue",
      values: {
        overdueAmount: { kind: "money", amount: 1200 },
        overdueInvoices: { kind: "count", n: 2, noun: "invoices" },
        overdueDays: { kind: "count", n: 30, noun: "days" },
      },
    },
  ];
  const fakeMeter = (verdict, records) => ({
    payer: "company",
    ledger: "wallet",
    async check() {
      return verdict;
    },
    async record(usage, opts) {
      records.push({ usage, opts });
      return { billing: "wallet", chargedCents: 1, entry: null };
    },
  });

  // Entitled (AI credit covers a call): complete() runs, the company's own
  // ledger records it, nothing logged as an error.
  {
    let completeCalls = 0;
    let errorCalls = 0;
    const records = [];
    const result = await buildDigestInsights({
      companyId: "co1",
      companyName: "Acme Painting",
      facts,
      fmt,
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-07-31"),
      periodKey: "2026-07",
      meter: fakeMeter({ allowed: true, billing: "wallet" }, records),
      complete: async ({ onUsage }) => {
        completeCalls++;
        onUsage({ model: "gpt-5.4", promptTokens: 10, completionTokens: 20 });
        return { ok: true, data: { insights: [{ fact: "overdue", text: "Chase the {overdueAmount} owed on {overdueInvoices} today." }] } };
      },
      recordError: async () => {
        errorCalls++;
      },
    });
    ok("entitled: complete() is called exactly once", completeCalls === 1);
    ok("entitled: the company's own ledger records the call, once, with a per-month ref", records.length === 1 && records[0].opts?.ref === "monthly_digest:co1:2026-07");
    ok("entitled: the model's sentence is used, filled by the email's formatter", result.sentences?.[0]?.text?.startsWith("Chase the $1,200.00 owed on 2 invoices"));
    ok("entitled: aiSkipped is false and the charge is reported", result.aiSkipped === false && result.chargedCents === 1);
    ok("entitled: nothing logged to /platform/errors", errorCalls === 0);
  }

  // No AI credit: complete() must NEVER run and nothing is recorded — the
  // gate runs before the spend, not after. The email still goes, with the
  // catalogue's own sentences (sentences: null asks for them). Not an error:
  // it is the normal case for a company without FieldQuo AI.
  {
    let completeCalls = 0;
    let errorCalls = 0;
    const records = [];
    const result = await buildDigestInsights({
      companyId: "co2",
      companyName: "No Credit Roofing",
      facts,
      fmt,
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-07-31"),
      meter: fakeMeter({ allowed: false, code: "no_credit", reason: "AI credit is empty." }, records),
      complete: async () => {
        completeCalls++;
        return { ok: true, data: { insights: [] } };
      },
      recordError: async () => {
        errorCalls++;
      },
    });
    ok("no AI credit: complete() is NEVER called — the gate runs before the spend, not after", completeCalls === 0);
    ok("no AI credit: nothing is recorded or charged", records.length === 0 && result.chargedCents === 0);
    ok("no AI credit: the catalogue's sentences are asked for (sentences: null), never an empty section", result.sentences === null && result.chosen === null);
    ok("no AI credit: skipCode says why, so the archive can tell it from a fault", result.skipCode === "no_credit");
    ok("no AI credit: NOT logged as an error — it is the normal case", errorCalls === 0);
  }

  // Any other refusal (FieldQuo's own budget, if a superadmin moved the
  // feature there) IS a fault and is logged where a human looks.
  {
    let completeCalls = 0;
    let errorDetail = null;
    await buildDigestInsights({
      companyId: "co3",
      companyName: "Budget Painting",
      facts,
      fmt,
      periodStart: new Date("2026-07-01"),
      periodEnd: new Date("2026-07-31"),
      meter: fakeMeter({ allowed: false, code: "quota", reason: "paused" }, []),
      complete: async () => {
        completeCalls++;
        return { ok: false };
      },
      recordError: async (e) => {
        errorDetail = e;
      },
    });
    ok("another refusal: complete() is not called", completeCalls === 0);
    ok("another refusal: logged to /platform/errors", errorDetail?.area === "ai" && errorDetail?.code === "monthly_digest_ai_refused" && errorDetail?.companyId === "co3");
  }

  // Mutation pass: prove the blocks above are load-bearing by actually
  // breaking the "gate BEFORE complete()" ordering and confirming
  // THIS check catches it — guarded against re-spawning itself the same way
  // check-money-flow.mjs guards its own mutation pass.
  if (!process.argv.includes("--no-mutate")) {
    const LIB = path.join(ROOT, "lib/ai/monthlyDigest.js");
    const ORIGINAL = fs.readFileSync(LIB, "utf8");
    const SELF = fileURLToPath(import.meta.url);
    const LOADER = path.join(ROOT, "scripts/alias-loader.mjs");

    const MUTATIONS = [
      [
        "the AI-credit gate is ignored — complete() runs for a company with no AI credit",
        (s) =>
          s.replace(
            "  const gate = await m.check();\n\n  if (!gate.allowed) {",
            "  const gate = await m.check();\n\n  if (false) {",
          ),
      ],
    ];

    for (const [label, mutate] of MUTATIONS) {
      const mutated = mutate(ORIGINAL);
      if (mutated === ORIGINAL) {
        ok(`mutation applies: ${label}`, false, "— the source moved under it");
        continue;
      }
      fs.writeFileSync(LIB, mutated);
      let caught = false;
      try {
        execFileSync(process.execPath, ["--import", LOADER, SELF, "--no-mutate"], {
          stdio: ["ignore", "pipe", "pipe"],
        });
      } catch {
        caught = true; // non-zero exit = the mutant was caught
      }
      fs.writeFileSync(LIB, ORIGINAL);
      ok(`mutation caught: ${label}`, caught);
    }
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
