// scripts/check-subscription-refunds.mjs
//
// Refunds and chargebacks on FieldQuo's OWN subscription, EXECUTED.
//
//   npm run check:subscription-refunds
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// The platform webhook has always received charge.refunded and all three
// charge.dispute.* events, and has always handed them to a settler that only
// recognises a refund landing on an Invoice Payment row — a Connect charge, a
// homeowner paying a contractor. A FieldQuo subscription invoice has no Payment
// row, so every refund and every chargeback on a contractor's own subscription
// took the "not one of ours" branch and silently did nothing. FieldQuo could
// not see that a customer had charged back.
//
// Every assertion below is a sentence someone could otherwise get wrong again:
//
//   1. The Connect path still wins every charge it used to win.
//   2. A charge that is genuinely neither is still nobody's.
//   3. A replayed webhook is a no-op, because the figures are absolute.
//   4. An out-of-order delivery never rolls a total back or reopens a closed
//      dispute.
//   5. "warning_needs_response" and "lost" stay different facts.
//   6. Nothing is ever stamped with the current time.
//   7. A missing Subscription row is LOGGED, never silently skipped.
//   8. Zero usage produces evidence that says zero usage.
//
// NO LIVE STRIPE CALL and NO DATABASE. Both are injected — a check that needs a
// network and a secret is a check that stops being run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifySubscriptionCharge,
  planSubscriptionRefund,
  planSubscriptionDispute,
  refundedAtFrom,
  disputeOpenedAtFrom,
  invoiceSubscriptionId,
  recordSubscriptionChargeEvent,
} from "@/lib/billing/subscriptionChargeEvent";
import { settleChargeEvent } from "@/lib/stripe/settleChargeEvent";
import { assembleDisputeEvidence, MAX_EVIDENCE_FIELD } from "@/lib/billing/disputeEvidence";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Comments STRIPPED before any source-level assertion. The first version of a
// check in this repo passed because the file it was policing explained in prose
// what it must not do; assert on code, never on the words around it.
const codeOf = (f) =>
  fs
    .readFileSync(path.join(ROOT, f), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  — ${detail}` : ""}`);
}
const section = (t) => console.log(`\n${t}\n`);

const T = (isoString) => Math.floor(new Date(isoString).getTime() / 1000);

// ═══════════════════════════════════════════════════════════════════════════
section("Recognition — which charges are FieldQuo's own subscription");

{
  const base = { paymentIntentId: "pi_1", customerId: "cus_1", invoiceId: "in_1" };

  ok(
    "an Invoice Payment charge is the Connect path's, never the subscription path's",
    classifySubscriptionCharge({ ...base, hasConnectPayment: true }).kind === "connect",
  );

  ok(
    "a charge with no payment intent is nobody's",
    classifySubscriptionCharge({ ...base, paymentIntentId: null }).kind === "unknown",
  );

  // Every top-up, auto-top-up, booking fee and paid migration is a
  // mode:"payment" one-off, so none of them carries an invoice.
  ok(
    "a one-off charge with no invoice is nobody's (top-up, booking fee, migration)",
    classifySubscriptionCharge({ ...base, invoiceId: null }).kind === "not_invoice_charge",
  );

  ok(
    "an invoice charge on a known customer is the subscription's",
    classifySubscriptionCharge(base).kind === "subscription",
  );

  ok(
    "an invoice charge with no customer is nobody's",
    classifySubscriptionCharge({ ...base, customerId: null }).kind === "unknown",
  );

  // The collision app/api/platform/billing/webhook/route.js already documents
  // for invoice.payment_succeeded: a bundle bills the SAME Stripe customer.
  ok(
    "an AI credit bundle's own charge is not the plan's",
    classifySubscriptionCharge({
      ...base,
      bundleSubscriptionId: "sub_bundle",
      chargeSubscriptionId: "sub_bundle",
    }).kind === "ai_bundle",
  );

  ok(
    "a plan charge on a company that ALSO has a bundle is still the plan's",
    classifySubscriptionCharge({
      ...base,
      bundleSubscriptionId: "sub_bundle",
      chargeSubscriptionId: "sub_plan",
    }).kind === "subscription",
  );

  let threw = false;
  try {
    classifySubscriptionCharge();
    classifySubscriptionCharge({});
    classifySubscriptionCharge({ paymentIntentId: 0, customerId: false, invoiceId: NaN });
  } catch {
    threw = true;
  }
  ok("garbage input classifies rather than throwing", !threw);

  ok(
    "the invoice's subscription is read from both Stripe object shapes",
    invoiceSubscriptionId({ subscription: "sub_a" }) === "sub_a" &&
      invoiceSubscriptionId({ parent: { subscription_details: { subscription: "sub_b" } } }) === "sub_b" &&
      invoiceSubscriptionId({}) === null,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Refunds — absolute figures, Stripe's clock, replay and reordering");

{
  const t1 = new Date("2026-03-01T10:00:00Z");
  const t2 = new Date("2026-03-08T10:00:00Z");
  const empty = { refundedAt: null, refundedAmountCents: 0 };

  const first = planSubscriptionRefund({ existing: empty, refundedAmountCents: 4900, refundedAt: t1 });
  ok(
    "a first refund writes Stripe's cumulative figure and Stripe's timestamp",
    first.write && first.data.refundedAmountCents === 4900 && +first.data.refundedAt === +t1,
  );

  const stored = { refundedAt: t1, refundedAmountCents: 4900 };
  const replay = planSubscriptionRefund({ existing: stored, refundedAmountCents: 4900, refundedAt: t1 });
  ok(
    "the identical event replayed writes the identical numbers (a genuine no-op)",
    replay.write &&
      replay.data.refundedAmountCents === stored.refundedAmountCents &&
      +replay.data.refundedAt === +stored.refundedAt,
  );

  const second = planSubscriptionRefund({ existing: stored, refundedAmountCents: 7400, refundedAt: t2 });
  ok(
    "a second partial refund writes the new CUMULATIVE total, not a sum",
    second.write && second.data.refundedAmountCents === 7400,
    "4900 + 2500 must arrive as 7400 from Stripe, never be added here",
  );

  const afterSecond = { refundedAt: t2, refundedAmountCents: 7400 };
  const late = planSubscriptionRefund({ existing: afterSecond, refundedAmountCents: 4900, refundedAt: t1 });
  ok(
    "the FIRST event redelivered after the second does not roll the total back",
    !late.write && late.reason === "older_than_recorded",
  );

  ok(
    "a refund of nothing never overwrites a real figure",
    planSubscriptionRefund({ existing: stored, refundedAmountCents: 0, refundedAt: t2 }).write === false,
  );

  ok(
    "a negative or unreadable amount is refused",
    !planSubscriptionRefund({ existing: empty, refundedAmountCents: -1, refundedAt: t1 }).write &&
      !planSubscriptionRefund({ existing: empty, refundedAmountCents: NaN, refundedAt: t1 }).write &&
      !planSubscriptionRefund({ existing: empty, refundedAmountCents: "lots", refundedAt: t1 }).write,
  );

  const noStamp = planSubscriptionRefund({ existing: empty, refundedAmountCents: 4900, refundedAt: null });
  ok(
    "no Stripe timestamp means REFUSED, not stamped with now",
    !noStamp.write && noStamp.reason === "no_stripe_timestamp",
  );
  ok(
    "an unparseable timestamp is refused too",
    !planSubscriptionRefund({ existing: empty, refundedAmountCents: 4900, refundedAt: new Date("nope") }).write,
  );

  // The cumulative figure belongs to the LAST refund on the charge; dating it
  // to the first would put a $200 total on the day $50 went back.
  const charge = {
    refunds: { data: [{ created: T("2026-03-01T10:00:00Z") }, { created: T("2026-03-08T10:00:00Z") }] },
  };
  ok(
    "the refund timestamp is the LATEST refund on the charge",
    +refundedAtFrom(charge, T("2026-05-01T00:00:00Z")) === +t2,
  );
  ok(
    "with no refund list it falls back to the event's own timestamp",
    +refundedAtFrom({ refunds: { data: [] } }, T("2026-03-08T10:00:00Z")) === +t2,
  );
  ok(
    "with nothing usable it returns null, so the planner refuses",
    refundedAtFrom({}, undefined) === null && refundedAtFrom(null, 0) === null,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Disputes — Stripe's status verbatim, and no reopening");

{
  const opened = new Date("2026-04-02T09:00:00Z");
  const opened2 = new Date("2026-09-15T09:00:00Z");
  const fresh = { disputeStatus: null, disputedAt: null };

  const warn = planSubscriptionDispute({
    existing: fresh,
    status: "warning_needs_response",
    disputedAt: opened,
  });
  ok(
    'a warning is stored as "warning_needs_response", not collapsed to a boolean',
    warn.write && warn.data.disputeStatus === "warning_needs_response",
  );

  const open = { disputeStatus: "needs_response", disputedAt: opened };
  const underReview = planSubscriptionDispute({
    existing: open,
    status: "under_review",
    disputedAt: new Date("2026-04-05T09:00:00Z"),
  });
  ok(
    "a status change inside one open dispute keeps the date it opened",
    underReview.write &&
      underReview.data.disputeStatus === "under_review" &&
      +underReview.data.disputedAt === +opened,
  );

  const won = planSubscriptionDispute({ existing: open, status: "won", disputedAt: opened });
  const lost = planSubscriptionDispute({ existing: open, status: "lost", disputedAt: opened });
  ok(
    'closed "won" and closed "lost" are different recorded facts',
    won.data.disputeStatus === "won" && lost.data.disputeStatus === "lost",
  );

  const closed = { disputeStatus: "lost", disputedAt: opened };
  const reopen = planSubscriptionDispute({ existing: closed, status: "needs_response", disputedAt: opened });
  ok(
    "the created event redelivered after the closed one does NOT reopen the dispute",
    !reopen.write && reopen.reason === "already_closed",
  );

  const replay = planSubscriptionDispute({ existing: closed, status: "lost", disputedAt: opened });
  ok(
    "replaying the closed event writes the identical status and date",
    replay.write && replay.data.disputeStatus === "lost" && +replay.data.disputedAt === +opened,
  );

  const again = planSubscriptionDispute({ existing: closed, status: "needs_response", disputedAt: opened2 });
  ok(
    "a genuinely NEW dispute after a closed one is refused by the terminal rule",
    !again.write,
    "a second dispute arrives as its own charge; the terminal guard is the deliberate trade",
  );

  const wonThenLost = planSubscriptionDispute({
    existing: { disputeStatus: "won", disputedAt: opened },
    status: "lost",
    disputedAt: opened2,
  });
  ok(
    "a later terminal outcome may replace an earlier one, and restamps the date",
    wonThenLost.write && wonThenLost.data.disputeStatus === "lost" && +wonThenLost.data.disputedAt === +opened2,
  );

  ok(
    "no status, or no Stripe timestamp, means refused",
    !planSubscriptionDispute({ existing: fresh, status: null, disputedAt: opened }).write &&
      !planSubscriptionDispute({ existing: fresh, status: "lost", disputedAt: null }).write,
  );

  ok(
    "the dispute date comes from the Dispute object, falling back to the event",
    +disputeOpenedAtFrom({ created: T("2026-04-02T09:00:00Z") }, T("2026-06-01T00:00:00Z")) === +opened &&
      +disputeOpenedAtFrom({}, T("2026-04-02T09:00:00Z")) === +opened &&
      disputeOpenedAtFrom({}, null) === null,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("The dispatcher, end to end, with a fake Prisma and a fake Stripe");

// A fake Prisma: only the operations these two settlement paths perform, and
// the one semantic that matters — that an update actually changes the stored
// row, so a second delivery can be compared against the first.
function fakeDb({ payments = [], subscriptions = [], invoices = [], bundles = [] } = {}) {
  const store = {
    payments: payments.map((p) => ({ ...p })),
    subscriptions: subscriptions.map((s) => ({ ...s })),
    invoices: invoices.map((i) => ({ ...i })),
    bundles: bundles.map((b) => ({ ...b })),
  };
  const find = (rows, where) =>
    rows.find((r) => Object.entries(where).every(([k, v]) => r[k] === v)) || null;

  return {
    _store: store,
    payment: {
      findFirst: async ({ where }) => find(store.payments, where),
      update: async ({ where, data }) => Object.assign(find(store.payments, where), data),
    },
    invoice: {
      findUnique: async ({ where }) => {
        const inv = find(store.invoices, where);
        return inv ? { ...inv, payments: store.payments.filter((p) => p.invoiceId === inv.id) } : null;
      },
      update: async ({ where, data }) => Object.assign(find(store.invoices, where), data),
    },
    subscription: {
      findFirst: async ({ where }) => find(store.subscriptions, where),
      update: async ({ where, data }) => Object.assign(find(store.subscriptions, where), data),
    },
    aiCreditBundle: {
      findUnique: async ({ where }) => find(store.bundles, where),
    },
  };
}

const SUB = () => ({
  id: "sub_row_1",
  companyId: "co_1",
  stripeCustomerId: "cus_1",
  refundedAt: null,
  refundedAmountCents: 0,
  disputeStatus: null,
  disputedAt: null,
});

function logger() {
  const calls = [];
  const fn = async (entry) => {
    calls.push(entry);
  };
  fn.calls = calls;
  return fn;
}

const subCharge = (over = {}) => ({
  id: "ch_sub",
  payment_intent: "pi_sub",
  customer: "cus_1",
  invoice: "in_1",
  amount_refunded: 9900,
  refunds: { data: [{ created: T("2026-03-01T10:00:00Z") }] },
  ...over,
});

{
  // 1. The Connect path is untouched.
  const db = fakeDb({
    payments: [{ id: "pay_1", invoiceId: "inv_1", stripePaymentIntentId: "pi_connect", amount: 500, refundedAmount: 0 }],
    invoices: [{ id: "inv_1", total: 500, status: "paid", amountPaid: 500, amountDue: 0, amountRefunded: 0 }],
    subscriptions: [SUB()],
  });
  const res = await settleChargeEvent(
    {
      id: "evt_connect",
      type: "charge.refunded",
      created: T("2026-03-01T10:00:00Z"),
      data: {
        object: {
          id: "ch_connect",
          payment_intent: "pi_connect",
          customer: "cus_1",
          invoice: "in_1",
          amount_refunded: 25000,
          refunds: { data: [{ created: T("2026-03-01T10:00:00Z") }] },
        },
      },
    },
    { prisma: db, deps: { recordError: logger() } },
  );
  ok("a Connect refund still settles on the Payment/Invoice", res.kind === "refund" && res.result.recorded);
  ok(
    "a Connect refund never touches the Subscription row",
    db._store.subscriptions[0].refundedAt === null && db._store.subscriptions[0].refundedAmountCents === 0,
    "even though the charge carries an invoice and the company's own customer id",
  );
}

{
  // 2. A subscription refund is now recognised.
  const db = fakeDb({ subscriptions: [SUB()] });
  const log = logger();
  const event = {
    id: "evt_sub_refund",
    type: "charge.refunded",
    created: T("2026-03-01T10:00:00Z"),
    data: { object: subCharge() },
  };
  const res = await settleChargeEvent(event, { prisma: db, deps: { recordError: log } });
  const row = db._store.subscriptions[0];
  ok(
    "a refund on a subscription invoice lands on the Subscription row",
    res.kind === "subscription_refund" &&
      row.refundedAmountCents === 9900 &&
      +row.refundedAt === +new Date("2026-03-01T10:00:00Z"),
  );

  // 3. Replayed, byte for byte.
  const before = JSON.stringify(row);
  await settleChargeEvent(event, { prisma: db, deps: { recordError: log } });
  ok("replaying that same webhook changes nothing", JSON.stringify(db._store.subscriptions[0]) === before);

  ok("neither delivery logged an error", log.calls.length === 0);
}

{
  // 4. A charge that is genuinely neither.
  const db = fakeDb({ subscriptions: [SUB()] });
  const log = logger();
  const res = await settleChargeEvent(
    {
      id: "evt_topup",
      type: "charge.refunded",
      created: T("2026-03-01T10:00:00Z"),
      // A voice top-up: mode "payment", so no invoice, and no Payment row.
      data: { object: subCharge({ id: "ch_topup", payment_intent: "pi_topup", invoice: null }) },
    },
    { prisma: db, deps: { recordError: log } },
  );
  ok(
    'a top-up refund is still "not one of ours"',
    res.result?.subscription?.reason === "no_invoice" && res.result?.subscription?.recorded === false,
  );
  ok(
    "and it writes nothing anywhere",
    db._store.subscriptions[0].refundedAmountCents === 0 && log.calls.length === 0,
  );
}

{
  // 5. Out-of-order arrival of the row itself: the miss must be LOUD.
  const db = fakeDb({ subscriptions: [] });
  const log = logger();
  const res = await settleChargeEvent(
    { id: "evt_orphan", type: "charge.refunded", created: T("2026-03-01T10:00:00Z"), data: { object: subCharge() } },
    { prisma: db, deps: { recordError: log } },
  );
  ok("a missing Subscription row does not record", res.result?.subscription?.reason === "no_subscription_row");
  ok(
    "and it is LOGGED, not silently skipped",
    log.calls.length === 1 && log.calls[0].code === "subscription_charge_unmatched",
    log.calls.length ? log.calls[0].code : "nothing was logged",
  );
  ok(
    "the log names the charge so it can be reconciled by hand",
    log.calls[0]?.detail?.chargeId === "ch_sub" && log.calls[0]?.detail?.needsManualReconciliation === true,
  );
}

{
  // 6. A dispute: the Dispute object carries neither customer nor invoice, so
  //    the charge has to be fetched.
  const db = fakeDb({ subscriptions: [SUB()] });
  const log = logger();
  let retrieved = null;
  const fakeStripe = {
    charges: {
      retrieve: async (id) => {
        retrieved = id;
        return subCharge();
      },
    },
    invoices: { retrieve: async () => ({ subscription: "sub_plan" }) },
  };
  const created = {
    id: "evt_disp_1",
    type: "charge.dispute.created",
    created: T("2026-04-02T09:00:00Z"),
    data: {
      object: {
        id: "dp_1",
        charge: "ch_sub",
        payment_intent: "pi_sub",
        status: "warning_needs_response",
        created: T("2026-04-02T09:00:00Z"),
      },
    },
  };
  const res = await settleChargeEvent(created, { prisma: db, deps: { recordError: log, stripe: fakeStripe } });
  ok("a dispute resolves its charge from Stripe", retrieved === "ch_sub");
  ok(
    "and records Stripe's status string verbatim",
    res.kind === "subscription_dispute" && db._store.subscriptions[0].disputeStatus === "warning_needs_response",
  );

  const closedLost = {
    id: "evt_disp_2",
    type: "charge.dispute.closed",
    created: T("2026-05-20T09:00:00Z"),
    data: {
      object: { id: "dp_1", charge: "ch_sub", payment_intent: "pi_sub", status: "lost", created: T("2026-04-02T09:00:00Z") },
    },
  };
  await settleChargeEvent(closedLost, { prisma: db, deps: { recordError: log, stripe: fakeStripe } });
  ok('closing as "lost" records "lost"', db._store.subscriptions[0].disputeStatus === "lost");
  ok(
    "and the date still says when the dispute OPENED",
    +db._store.subscriptions[0].disputedAt === +new Date("2026-04-02T09:00:00Z"),
  );

  await settleChargeEvent(created, { prisma: db, deps: { recordError: log, stripe: fakeStripe } });
  ok(
    "the created event redelivered after the closure does not reopen it",
    db._store.subscriptions[0].disputeStatus === "lost",
  );
}

{
  // 7. The AI credit bundle bills the same customer. Its chargeback is not the
  //    plan's, and must not be written onto the plan's row.
  const db = fakeDb({
    subscriptions: [SUB()],
    bundles: [{ companyId: "co_1", stripeSubscriptionId: "sub_bundle" }],
  });
  const log = logger();
  const fakeStripe = {
    charges: { retrieve: async () => subCharge() },
    invoices: { retrieve: async () => ({ subscription: "sub_bundle" }) },
  };
  const res = await settleChargeEvent(
    { id: "evt_bundle", type: "charge.refunded", created: T("2026-03-01T10:00:00Z"), data: { object: subCharge() } },
    { prisma: db, deps: { recordError: log, stripe: fakeStripe } },
  );
  ok("a bundle refund is not recorded as the plan's", res.result?.subscription?.kind === "ai_bundle");
  ok("and the plan row is untouched", db._store.subscriptions[0].refundedAmountCents === 0);
  ok(
    "and it is logged rather than swallowed",
    log.calls.some((c) => c.code === "ai_bundle_charge_event"),
  );
}

{
  // 8. And a plan charge on a company that ALSO has a bundle still lands.
  const db = fakeDb({
    subscriptions: [SUB()],
    bundles: [{ companyId: "co_1", stripeSubscriptionId: "sub_bundle" }],
  });
  const fakeStripe = {
    charges: { retrieve: async () => subCharge() },
    invoices: { retrieve: async () => ({ subscription: "sub_plan" }) },
  };
  await settleChargeEvent(
    { id: "evt_plan", type: "charge.refunded", created: T("2026-03-01T10:00:00Z"), data: { object: subCharge() } },
    { prisma: db, deps: { recordError: logger(), stripe: fakeStripe } },
  );
  ok("a plan refund on a bundle-holding company still records", db._store.subscriptions[0].refundedAmountCents === 9900);
}

{
  // 9. No Stripe timestamp anywhere: refuse and say so.
  const db = fakeDb({ subscriptions: [SUB()] });
  const log = logger();
  await recordSubscriptionChargeEvent(
    db,
    { id: "evt_nots", type: "charge.refunded", data: { object: subCharge({ refunds: { data: [] } }) } },
    { deps: { recordError: log } },
  );
  ok(
    "a charge with no usable Stripe timestamp is refused, and the refusal is logged",
    db._store.subscriptions[0].refundedAt === null &&
      log.calls.some((c) => c.code === "subscription_charge_no_timestamp"),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Dispute evidence — assembled from what happened, never padded");

const COMPANY = {
  name: "Northline Painting",
  email: "hello@northline.example",
  address: "12 Rue Principale",
  city: "Gatineau",
  province: "QC",
  country: "CA",
  createdAt: new Date("2025-06-01T00:00:00Z"),
};

{
  // Zero usage. The whole point of the honesty rule.
  const out = assembleDisputeEvidence({
    company: COMPANY,
    subscription: { status: "active", planName: "Crew", billingInterval: "month", createdAt: new Date("2025-06-01T00:00:00Z") },
    quotesSent: [],
    invoicesSent: [],
    jobs: [],
    payments: [],
    devices: [],
    activity: [],
  });
  ok("a company that never used FieldQuo reports hasUsage false", out.hasUsage === false);
  ok(
    "and its evidence SAYS so in plain words",
    /NO recorded product usage/.test(out.evidence.access_activity_log),
  );
  ok(
    "and makes no claim that they used the product",
    out.evidence.uncategorized_text === undefined,
    "uncategorized_text asserts active use; it must not be emitted with no use to assert",
  );
  ok(
    "and invents no counts or dates",
    out.summary.quotesSent === 0 && out.summary.firstUsedAt === null && out.summary.lastUsedAt === null,
  );
  ok(
    "and warns the reader not to contest on these facts",
    out.gaps.some((g) => /not contestable/i.test(g)),
  );
}

{
  // Exactly one event.
  const out = assembleDisputeEvidence({
    company: COMPANY,
    subscription: null,
    quotesSent: [{ sentAt: new Date("2026-01-05T14:00:00Z"), quoteNumber: "Q-1001", sentToEmail: "owner@example.com" }],
  });
  ok("one quote is enough to count as usage", out.hasUsage === true && out.summary.quotesSent === 1);
  ok(
    "the single event dates both ends of the span",
    out.summary.firstUsedAt === out.summary.lastUsedAt && out.summary.firstUsedAt.startsWith("2026-01-05"),
  );
  ok("and it appears in the log with its number", /Q-1001/.test(out.evidence.access_activity_log));
  ok(
    "a missing subscription row is named as a gap rather than invented",
    out.gaps.some((g) => /No subscription row/i.test(g)),
  );
}

{
  // Hundreds, with the totals larger than the sample — the shape the loader
  // actually produces.
  const many = Array.from({ length: 100 }, (_, i) => ({
    sentAt: new Date(Date.UTC(2026, 0, 1 + (i % 28), 9, 0, 0)),
    quoteNumber: `Q-${2000 + i}`,
    sentToEmail: `client${i}@example.com`,
  }));
  const out = assembleDisputeEvidence({
    company: COMPANY,
    subscription: { status: "active", planName: "Crew", billingInterval: "year", createdAt: new Date("2025-06-01T00:00:00Z") },
    quotesSent: many,
    invoicesSent: many.map((m, i) => ({ sentAt: m.sentAt, invoiceNumber: `INV-${i}` })),
    jobs: many.map((m, i) => ({ createdAt: m.sentAt, title: `Job ${i}`, completedAt: m.sentAt })),
    payments: many.map((m) => ({ date: m.sentAt, amount: 1234.5, method: "card" })),
    devices: [
      { firstSeenAt: new Date("2025-06-02T00:00:00Z"), lastSeenAt: new Date("2026-08-01T00:00:00Z"), network: "203.0", userAgent: "Mozilla/5.0 (iPhone)", who: "Marc" },
    ],
    activity: many.map((m, i) => ({ createdAt: m.sentAt, action: "quote.sent", summary: `Sent quote ${i}`, actorName: "Marc" })),
    totals: { quotesSent: 412, invoicesSent: 388, jobsCreated: 300, paymentsCollected: 250, devicesSeen: 6, activityEvents: 9000 },
  });
  ok(
    "totals report the real counts, not the size of the sample",
    out.summary.quotesSent === 412 && out.summary.activityEvents === 9000,
  );
  ok("the sampled rows are still listed", /Q-2000/.test(out.evidence.access_activity_log));
  ok(
    "the log never exceeds Stripe's field limit",
    out.evidence.access_activity_log.length <= MAX_EVIDENCE_FIELD,
    `${out.evidence.access_activity_log.length} chars`,
  );
  ok(
    "and says so when it had to cut",
    out.truncated === /truncated/.test(out.evidence.access_activity_log),
  );
  ok("a used account gets the explanatory field", typeof out.evidence.uncategorized_text === "string");
  ok(
    "sign-in evidence carries the /16 only, never a full address",
    /203\.0\.x/.test(out.evidence.access_activity_log) &&
      !/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/.test(out.evidence.access_activity_log),
  );
}

{
  // What we cannot fill, we leave out.
  const bare = assembleDisputeEvidence({
    company: { name: "Solo Trades", createdAt: new Date("2026-02-01T00:00:00Z") },
    jobs: [{ createdAt: new Date("2026-02-03T00:00:00Z"), title: "Deck" }],
  });
  ok("no street address means no billing_address at all", bare.evidence.billing_address === undefined);
  ok("no email means no customer_email_address", bare.evidence.customer_email_address === undefined);
  ok("both omissions are named", bare.gaps.filter((g) => /omitted/.test(g)).length >= 3);
  ok("the name we do have is used", bare.evidence.customer_name === "Solo Trades");
  ok(
    "service_date is omitted rather than guessed from the subscription period",
    bare.evidence.service_date === undefined &&
      bare.gaps.some((g) => /service_date omitted/.test(g)),
  );

  const withPeriod = assembleDisputeEvidence({
    company: COMPANY,
    jobs: [{ createdAt: new Date("2026-02-03T00:00:00Z"), title: "Deck" }],
    servicePeriod: { start: new Date("2026-02-01T00:00:00Z"), end: new Date("2026-03-01T00:00:00Z") },
  });
  ok(
    "and IS emitted when the disputed charge's period is supplied",
    withPeriod.evidence.service_date === "2026-02-01 to 2026-03-01",
  );
  ok("an address that exists is assembled", withPeriod.evidence.billing_address === "12 Rue Principale, Gatineau, QC, CA");
}

{
  // Hostile input.
  let threw = false;
  let out = null;
  try {
    assembleDisputeEvidence();
    assembleDisputeEvidence({ company: null, quotesSent: null, jobs: "nope", devices: undefined });
    out = assembleDisputeEvidence({
      company: COMPANY,
      quotesSent: [
        { sentAt: null, quoteNumber: "Q-A" },
        { sentAt: "not a date", quoteNumber: "Q-B" },
        { sentAt: new Date("2026-01-05T14:00:00Z"), quoteNumber: "Q-C" },
      ],
    });
  } catch {
    threw = true;
  }
  ok("null and wrong-typed inputs assemble rather than throw", !threw);
  ok(
    "undated rows are dropped, never rendered as Invalid Date",
    out && out.summary.quotesSent === 1 && !/Invalid Date/.test(out.evidence.access_activity_log),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("Guarantees that live in the source, not in a comment");

{
  const settler = codeOf("lib/billing/subscriptionChargeEvent.js");
  ok(
    "the settler never stamps a row with the current time",
    !/new Date\(\s*\)/.test(settler),
    "every timestamp must come from Stripe's own event or object",
  );
  ok(
    "the refunded figure is written absolutely, never incremented",
    !/refundedAmountCents\s*:\s*\{/.test(settler) && !/\+\s*=\s*/.test(settler),
  );

  const dispatcher = codeOf("lib/stripe/settleChargeEvent.js");
  const connectAt = Math.min(
    dispatcher.indexOf("recordStripeRefund("),
    dispatcher.indexOf("recordStripeDispute("),
  );
  ok(
    "the Connect recognition runs BEFORE the subscription one",
    connectAt > -1 && connectAt < dispatcher.indexOf("recordSubscriptionChargeEvent("),
  );

  // Nothing may submit or close a dispute at Stripe. That is a decision the
  // owner has not made, and a check is the only thing that keeps it unmade.
  const forbidden = /disputes\s*\.\s*(update|close)|evidence\s*:/;
  for (const f of [
    "lib/billing/subscriptionChargeEvent.js",
    "lib/billing/disputeEvidence.js",
    "lib/billing/loadDisputeEvidence.js",
    "app/api/platform/companies/[id]/dispute-evidence/route.js",
    "app/platform/companies/[id]/CompanyDisputeEvidence.js",
  ]) {
    ok(`${f.split("/").pop()} never submits evidence to Stripe`, !forbidden.test(codeOf(f)));
  }

  const route = codeOf("app/api/platform/companies/[id]/dispute-evidence/route.js");
  ok(
    "the evidence route is superadmin-gated",
    /requirePlatformPermission\(\s*admin\.role\s*,\s*"billing:manage"\s*\)/.test(route),
    "billing:manage is in SUPERADMIN_ONLY_PERMISSIONS",
  );
  ok("and awaits its params (Next 16)", /await\s+params/.test(route));

  ok(
    "the pure evidence assembler imports nothing at all",
    !/^\s*import\s/m.test(codeOf("lib/billing/disputeEvidence.js")),
    "so it stays executable against hundreds of rows with no database",
  );
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
