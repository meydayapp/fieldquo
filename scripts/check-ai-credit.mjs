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
  BUNDLE_ROLLOVER_NOTICE,
} from "@/lib/ai/creditBundle";
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
  const addCredit = async ({ companyId, cents, kind, stripeRef, ref, note }) => {
    if (stripeRef && rows.some((r) => r.companyId === companyId && r.stripeRef === stripeRef)) {
      return null;
    }
    if (ref && rows.some((r) => r.companyId === companyId && r.ref === ref)) {
      return null; // P2002 — the unique (companyId, ref) index refusing a second write.
    }
    const row = { id: `e${++n}`, companyId, cents, kind, pool: poolForKind(kind), stripeRef, ref, note };
    rows.push(row);
    return row;
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
    deps: { db, addCredit, balanceFor, recordActivity, stripe },
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

section("4. Cancelling stops future grants, keeps what's already granted, deletes nothing");
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
  ok("…and the balance already granted is still spendable, not clawed back",
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

  const topupRoute = code(read("app/api/settings/ai/topup/route.js"));
  ok("a Stripe failure buying AI credit is its own reason, not a generic 500",
    /reason: "stripe_unavailable"/.test(topupRoute));

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
   7. The rollover policy is one sentence, read from one place, stated before
   anyone pays.
   ═══════════════════════════════════════════════════════════════════════════ */

section("7. Rollover vs expiry is a stated decision, not silence");
{
  ok("the notice exists and says credit does not expire",
    /roll(s)? over/i.test(BUNDLE_ROLLOVER_NOTICE) && /never/i.test(BUNDLE_ROLLOVER_NOTICE));

  const page = code(read("app/app/settings/ai-credit/page.js"));
  ok("the settings page renders the SAME notice object — not a rewritten paraphrase",
    /ai\.bundleRolloverNotice/.test(page));

  const creditRoute = code(read("app/api/settings/ai/credit/route.js"));
  ok("…which the unified route actually sends to the browser",
    /bundleRolloverNotice/.test(creditRoute));

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

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
