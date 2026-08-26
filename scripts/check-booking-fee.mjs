// scripts/check-booking-fee.mjs
//
// The paid-booking state machine, EXECUTED rather than read.
//
//   npm run check:booking-fee
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// A homeowner paid a $50 visit fee, was told "Payment received — your visit is
// confirmed", and the booking sat in `pending_payment` with no Appointment, on
// no screen, for ever. The immediate cause was a misrouted webhook: a booking
// fee is a DESTINATION charge created on the platform account, so its
// `checkout.session.completed` is a platform event, and the handler for it lived
// on a Connect endpoint that by construction never receives platform events.
//
// The deeper cause is what this check guards: nothing in the app could tell
// "they did not pay" from "we were not told they paid", and nothing ever
// revisited the question.
//
// Every assertion below is a sentence someone could otherwise get wrong again:
//
//   1. A fee-charging booking is NOT confirmed before payment, and IS after.
//   2. A free booking type confirms immediately, with an appointment.
//   3. A duplicate webhook does not produce two appointments.
//   4. An abandoned hold neither blocks a slot for ever nor vanishes.
//   5. Stripe being unreachable never cancels anybody's booking.
//   6. No client-facing screen claims a confirmed visit without asking.
//
// NO LIVE STRIPE CALL and NO DATABASE. Both are injected. A check that needs a
// network and a secret is a check that stops being run.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { effectiveBookingFeeCents, FEE_HOLD_MINUTES, feeHoldCutoff } from "@/lib/booking/fee";
import { settleBookingFee } from "@/lib/booking/settleBookingFee";
import { reconcileBookingFee } from "@/lib/booking/reconcileBookingFee";
import { settleCheckoutSession } from "@/lib/stripe/settleCheckoutSession";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

// ── A fake Prisma, just enough of one ──────────────────────────────────────
//
// Only the four operations the state machine actually performs, and the ONE
// semantic that matters: updateMany reports how many rows it matched, which is
// the entire idempotency guarantee.
function fakeDb(seed = {}) {
  const bookings = new Map(Object.entries(seed.bookings || {}));
  const appointments = new Map();
  const clients = new Map(Object.entries(seed.clients || {}));
  let n = 0;
  const id = (p) => `${p}_${++n}`;

  const matches = (row, where) =>
    Object.entries(where).every(([k, v]) => (v && typeof v === "object" ? true : row[k] === v));

  return {
    _bookings: bookings,
    _appointments: appointments,
    booking: {
      async findUnique({ where }) {
        const b = bookings.get(where.id);
        return b ? { ...b } : null;
      },
      async updateMany({ where, data }) {
        const b = bookings.get(where.id);
        if (!b || !matches(b, where)) return { count: 0 };
        bookings.set(where.id, { ...b, ...data });
        return { count: 1 };
      },
    },
    client: {
      async findFirst({ where }) {
        for (const c of clients.values()) {
          if (c.companyId === where.companyId && c.email === where.email) return { ...c };
        }
        return null;
      },
      async create({ data }) {
        const row = { id: id("client"), ...data };
        clients.set(row.id, row);
        return { ...row };
      },
    },
    appointment: {
      async create({ data }) {
        const row = { id: id("appt"), ...data };
        appointments.set(row.id, row);
        return { ...row };
      },
      delete({ where }) {
        appointments.delete(where.id);
        return Promise.resolve({});
      },
    },
  };
}

const COMPANY = { id: "co1", name: "Big Painter Inc", currency: "CAD", stripeChargesEnabled: true };
const PAID_TYPE = { id: "et_paid", name: "Consultation", userId: "u1", feeCents: 5000, durationMinutes: 30, company: COMPANY };
const FREE_TYPE = { id: "et_free", name: "Free chat", userId: "u1", feeCents: null, durationMinutes: 30, company: COMPANY };

function heldBooking(over = {}) {
  return {
    id: "bk1",
    status: "pending_payment",
    clientName: "Emilio Boves",
    clientEmail: "e@example.test",
    clientPhone: null,
    startTime: new Date("2026-08-27T19:30:00.000Z"),
    endTime: new Date("2026-08-27T20:00:00.000Z"),
    address: "917 Littlerock St, Ottawa",
    latitude: 45.32,
    longitude: -75.59,
    appointmentId: null,
    feePaidCents: null,
    feeCheckoutSessionId: "cs_test_1",
    createdAt: new Date("2026-08-26T00:29:20.000Z"),
    eventType: PAID_TYPE,
    ...over,
  };
}

// finalizeBooking sends email and writes consent; stubbed and COUNTED, because
// "was the homeowner actually told?" is part of the state machine.
function finalizeSpy() {
  const calls = [];
  const fn = async (args) => {
    calls.push(args);
    return { emailed: true };
  };
  fn.calls = calls;
  return fn;
}

const PAID_SESSION = {
  id: "cs_test_1",
  mode: "payment",
  payment_status: "paid",
  amount_total: 5000,
  currency: "cad",
  payment_intent: "pi_1",
  metadata: { bookingId: "bk1", companyId: "co1" },
};

console.log("\nWhat a paid booking type costs");
{
  const paid = effectiveBookingFeeCents(COMPANY, PAID_TYPE);
  ok("a $50 event type on a charges-enabled company costs 5000c", paid.feeCents === 5000);

  const free = effectiveBookingFeeCents(COMPANY, FREE_TYPE);
  ok("an event type with no fee is free, so it confirms without Stripe", free.feeCents === 0);

  // The one that decides whether a contractor who has not finished Stripe
  // onboarding sends clients to a checkout that cannot take their money.
  const notOnboarded = effectiveBookingFeeCents({ ...COMPANY, stripeChargesEnabled: false }, PAID_TYPE);
  ok("a company that can't collect falls back to free rather than charging",
    notOnboarded.feeCents === 0);
}

console.log("\nBefore the money lands");
{
  const db = fakeDb({ bookings: { bk1: heldBooking() } });
  const stored = await db.booking.findUnique({ where: { id: "bk1" } });
  ok("the hold exists but is NOT confirmed", stored.status === "pending_payment");
  ok("and has no appointment — nothing reaches the crew's calendar", stored.appointmentId === null);
  ok("and records no fee — absence, not a zero", stored.feePaidCents === null);
}

console.log("\nWhen the money lands");
{
  const db = fakeDb({ bookings: { bk1: heldBooking() } });
  const finalize = finalizeSpy();
  const res = await settleBookingFee("bk1", {
    amountCents: 5000, currency: "cad", paymentIntentId: "pi_1", checkoutSessionId: "cs_test_1",
  }, { db, finalize });

  const after = await db.booking.findUnique({ where: { id: "bk1" } });
  ok("settle reports it settled", res.settled === true);
  ok("the booking is confirmed", after.status === "confirmed");
  ok("an appointment now exists and is linked", Boolean(after.appointmentId) && db._appointments.has(after.appointmentId));
  ok("the appointment carries the CLIENT's address, not the event type's label",
    db._appointments.get(after.appointmentId).location === "917 Littlerock St, Ottawa");
  ok("the fee recorded is what Stripe took", after.feePaidCents === 5000 && after.feeCurrency === "cad");
  ok("the payment intent is stored, so it can never be double-credited",
    after.feeStripePaymentIntentId === "pi_1");
  ok("the homeowner is actually told — finalizeBooking ran once", finalize.calls.length === 1);
}

console.log("\nA duplicate webhook (or webhook racing the return redirect)");
{
  const db = fakeDb({ bookings: { bk1: heldBooking() } });
  const finalize = finalizeSpy();
  const payment = { amountCents: 5000, currency: "cad", paymentIntentId: "pi_1", checkoutSessionId: "cs_test_1" };

  const first = await settleBookingFee("bk1", payment, { db, finalize });
  const second = await settleBookingFee("bk1", payment, { db, finalize });

  ok("the first delivery settles", first.settled === true);
  ok("the second reports already-settled rather than settling again", second.alreadySettled === true);
  ok("EXACTLY ONE appointment exists", db._appointments.size === 1,
    `(found ${db._appointments.size})`);
  ok("the second points at the same appointment", second.appointmentId === first.appointmentId);
  ok("the homeowner is not emailed twice", finalize.calls.length === 1);
}

console.log("\nTruly concurrent deliveries (both pass the status read)");
{
  // The read-then-write fast path cannot stop this; the conditional updateMany
  // is what does. Fired together so both see pending_payment.
  const db = fakeDb({ bookings: { bk1: heldBooking() } });
  const finalize = finalizeSpy();
  const payment = { amountCents: 5000, currency: "cad", paymentIntentId: "pi_1" };
  const [a, b] = await Promise.all([
    settleBookingFee("bk1", payment, { db, finalize }),
    settleBookingFee("bk1", payment, { db, finalize }),
  ]);
  ok("exactly one of the two wins", (a.settled ? 1 : 0) + (b.settled ? 1 : 0) === 1);
  ok("the loser's speculative appointment is cleaned up — one appointment total",
    db._appointments.size === 1, `(found ${db._appointments.size})`);
  ok("one confirmation email, not two", finalize.calls.length === 1);
}

console.log("\nAn abandoned checkout");
{
  const created = new Date("2026-08-26T00:00:00.000Z");
  const unpaid = { id: "cs_test_1", payment_status: "unpaid", status: "open", metadata: { bookingId: "bk1" } };

  // Inside the promised window: leave it alone.
  {
    const db = fakeDb({ bookings: { bk1: heldBooking({ createdAt: created }) } });
    const r = await reconcileBookingFee(await db.booking.findUnique({ where: { id: "bk1" } }), {
      db, findSession: async () => unpaid, now: created.getTime() + 5 * 60 * 1000,
    });
    ok(`within ${FEE_HOLD_MINUTES} minutes the hold stands`, r.action === "holding");
    ok("and the client is told how long is left", r.minutesLeft > 0 && r.minutesLeft <= FEE_HOLD_MINUTES);
    ok("the row is untouched", (await db.booking.findUnique({ where: { id: "bk1" } })).status === "pending_payment");
  }

  // Past it: released, with a reason, and NOT deleted.
  {
    const db = fakeDb({ bookings: { bk1: heldBooking({ createdAt: created }) } });
    const r = await reconcileBookingFee(await db.booking.findUnique({ where: { id: "bk1" } }), {
      db, findSession: async () => unpaid, now: created.getTime() + (FEE_HOLD_MINUTES + 1) * 60 * 1000,
    });
    const after = await db.booking.findUnique({ where: { id: "bk1" } });
    ok("once the hold lapses it is cancelled", r.action === "cancelled");
    ok("the slot stops being blocked", after.status === "cancelled");
    ok("the row SURVIVES — a booking someone tried to make is not deleted", after !== null);
    ok("and says why, so the contractor can answer the phone call",
      after.cancelReason === "payment_incomplete");
    ok("no appointment was ever created for it", db._appointments.size === 0);
  }

  // A lapsed hold no longer blocks the slot — the confirm route's own window.
  {
    const now = created.getTime() + (FEE_HOLD_MINUTES + 1) * 60 * 1000;
    ok("a lapsed hold falls outside the conflict window the confirm route uses",
      created < feeHoldCutoff(now));
    const fresh = new Date(now - 60 * 1000);
    ok("a fresh hold is still inside it, so two people can't be sent to pay for one slot",
      !(fresh < feeHoldCutoff(now)));
  }
}

console.log("\nA payment that landed while the webhook was lost");
{
  // Exactly the owner's booking: paid at Stripe, never confirmed here.
  const db = fakeDb({ bookings: { bk1: heldBooking() } });
  const finalize = finalizeSpy();
  const r = await reconcileBookingFee(await db.booking.findUnique({ where: { id: "bk1" } }), {
    db,
    findSession: async () => PAID_SESSION,
    settle: (id, payment) => settleBookingFee(id, payment, { db, finalize }),
    // Days late. A payment that arrived is settled whenever we find out.
    now: Date.now(),
  });
  const after = await db.booking.findUnique({ where: { id: "bk1" } });
  ok("the reconciler settles it without any webhook at all", r.action === "settled");
  ok("the visit finally appears on the calendar", after.status === "confirmed" && Boolean(after.appointmentId));
  ok("and the homeowner gets the confirmation they were owed", finalize.calls.length === 1);
}

console.log("\nStripe being unreachable");
{
  const db = fakeDb({ bookings: { bk1: heldBooking({ createdAt: new Date("2020-01-01") }) } });
  const r = await reconcileBookingFee(await db.booking.findUnique({ where: { id: "bk1" } }), {
    db,
    findSession: async () => { throw new Error("ECONNRESET"); },
  });
  const after = await db.booking.findUnique({ where: { id: "bk1" } });
  ok("an outage reports an error rather than a verdict", r.action === "error");
  ok("and cancels NOBODY — not knowing is not the same as not paid",
    after.status === "pending_payment");
}

console.log("\nThe dispatcher that fixes the misrouting");
{
  const db = fakeDb({ bookings: { bk1: heldBooking() } });
  // settleCheckoutSession reaches the real db, so only its ROUTING is executed
  // here — enough to prove a booking-fee session is claimed rather than falling
  // through to the subscription handler, which is what dropped the money.
  const unknown = await settleCheckoutSession({ id: "cs_x", mode: "subscription", metadata: { companyId: "co1", planId: "p1" } });
  ok("a subscription checkout is NOT claimed — it belongs to billing",
    unknown.handled === false);

  const noMeta = await settleCheckoutSession({ id: "cs_y", mode: "payment", metadata: {} });
  ok("a session with no metadata at all is not claimed either", noMeta.handled === false);

  const unpaidBooking = await settleCheckoutSession({
    ...PAID_SESSION, payment_status: "unpaid",
  });
  ok("a booking session that isn't paid yet is claimed but NOT settled",
    unpaidBooking.handled === true && unpaidBooking.result?.settled === false,
    `(${unpaidBooking.result?.reason})`);
  void db;
}

console.log("\nWhat the screens and routes actually do");
{
  const confirm = read("app/api/booking/[companySlug]/confirm/route.js");
  ok("the paid path still creates NO appointment before payment",
    /status: "pending_payment"/.test(confirm) && !/status: "pending_payment"[\s\S]{0,400}appointment\.create/.test(confirm));
  // Matched on the successUrl line itself, not anywhere in the file — the
  // comment above it deliberately names the old `?booked=1` it replaced.
  const successUrl = confirm.match(/successUrl: `([^`]*)`/)?.[1] || "";
  ok("the success URL carries Stripe's session id, not a bare ?booked=1",
    successUrl.includes("{CHECKOUT_SESSION_ID}") && !successUrl.includes("booked=1"),
    successUrl);
  // The free path is inline in the route (there is no fee to settle, so it has
  // nothing to share with settleBookingFee). Assert it still does the whole job
  // in one go: appointment first, then a booking linked to it, then the letter.
  const freePart = confirm.slice(confirm.indexOf("// FREE:"));
  ok("a free booking type creates the appointment immediately",
    /appointment = await db\.appointment\.create/.test(freePart));
  ok("...links the booking to it in the same breath",
    /appointmentId: appointment\.id/.test(freePart));
  ok("...and never sets pending_payment", !/pending_payment/.test(freePart));
  ok("...and finalises, so a free booking is confirmed to the client too",
    /finalizeBooking\(\{/.test(freePart));

  ok("the checkout session id is stored, so reconciliation can run from our side",
    /feeCheckoutSessionId: session\.id/.test(confirm));
  ok("the conflict window comes from the shared constant, not a literal",
    confirm.includes("feeHoldCutoff()") && !/30 \* 60 \* 1000/.test(confirm));

  const flow = read("app/book/[companySlug]/BookingFlow.js");
  ok("the booking page no longer trusts a query flag for 'you're booked'",
    !/booked"\) === "1"/.test(flow));
  ok("it asks the server what actually happened", /\/settle`/.test(flow));
  ok("it can say 'payment went through but we couldn't confirm' — the state that used to lie",
    /haven't been able to confirm/.test(flow));
  ok("the page still holds the 30-minute promise it prints",
    flow.includes("held for 30 minutes") && FEE_HOLD_MINUTES === 30);

  const settle = read("app/api/booking/[companySlug]/settle/route.js");
  ok("the settle route verifies the session with Stripe rather than the browser",
    /stripe\.checkout\.sessions\.retrieve/.test(settle));
  ok("and refuses a session belonging to another tenant",
    /eventType: \{ companyId: company\.id \}/.test(settle));
  ok("and never reports confirmed on the strength of payment alone",
    /confirmed: fresh\?\.status === "confirmed"/.test(settle));

  const connect = read("app/api/stripe/webhook/route.js");
  const billing = read("app/api/platform/billing/webhook/route.js");
  ok("the Connect webhook dispatches through the shared settler",
    /settleCheckoutSession\(session\)/.test(connect));
  ok("the PLATFORM webhook — where these events actually land — does too",
    /settleCheckoutSession\(event\.data\.object\)/.test(billing));
  ok("the platform webhook tries settlement BEFORE the subscription handler",
    billing.indexOf("settleCheckoutSession") < billing.indexOf("syncSubscriptionFromStripeEvent("));
  ok("no copy of the booking-fee logic is left inline in a webhook",
    !/appointment\.create/.test(connect) && !/appointment\.create/.test(billing));

  const cron = read("app/api/cron/booking-fees/route.js");
  ok("a cron reconciles held bookings on a schedule", /reconcileBookingFee/.test(cron));
  ok("and it is registered with Vercel",
    JSON.parse(read("vercel.json")).crons.some((c) => c.path === "/api/cron/booking-fees"));
  ok("a webhook that had to be rescued is recorded, not silently patched over",
    /webhook_missed/.test(cron));

  const panel = read("app/components/dashboard/AwaitingPayment.js");
  const api = read("app/api/bookings/awaiting-payment/route.js");
  ok("held bookings are visible to the contractor somewhere",
    read("app/app/page.js").includes("<AwaitingPayment />"));
  ok("the panel renders itself away when empty rather than sitting dead",
    /rows\.length === 0\) return null/.test(panel));
  ok("the Check button is only shown to someone the API will accept",
    /canCheck: can\(member\.role, "user:manage"\)/.test(api) && /can\(member\.role, "user:manage"\)/.test(api));
  ok("pressing Check cannot cancel anybody's booking as a side effect",
    /cancelLapsed: false/.test(api));
  ok("a failed check reports rather than failing silently",
    /reportResponseError/.test(panel));
}

console.log("\nEvery new string is translated");
{
  const messages = read("app/i18n/appMessages.js");
  const keys = [
    "app.booking.awaitingPaymentTitle",
    "app.booking.awaitingPaymentBody",
    "app.booking.awaitingFee",
    "app.booking.feeTaken",
    "app.booking.paymentNotCompleted",
    "app.booking.checkPayment",
    "app.booking.checkSettled",
    "app.booking.checkAlready",
    "app.booking.checkNoPayment",
    "app.booking.checkUnreachable",
    "app.booking.checkFailed",
  ];
  for (const k of keys) {
    const n = messages.split(`"${k}":`).length - 1;
    ok(`${k} present in all 6 catalogues`, n === 6, `(found ${n})`);
  }
}

// ── Payouts are not the question ─────────────────────────────────────────
//
// A connected account in verification still takes cards; Stripe holds the money
// until the review clears. If settlement ever started asking whether the
// CONTRACTOR can be paid out, a client would be charged, get no receipt, and
// the visit would never reach the calendar — over a document the contractor
// owes Stripe. Asserted on the source because the tempting "improvement" is one
// line and reads sensible.
{
  // Comments STRIPPED before testing. The naive grep failed the moment the file
  // explained in prose why it must not do this — the same trap that made
  // check-call-quote-draft reject a transfer tool whose description said "when
  // they ask for a price". Assert on code, never on the words around it.
  const codeOf = (f) =>
    fs
      .readFileSync(path.join(ROOT, f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
  const forbidden = /payouts_enabled|payoutsEnabled|charges_enabled|chargesEnabled/;
  for (const f of [
    "lib/stripe/settleCheckoutSession.js",
    "lib/booking/settleBookingFee.js",
    "lib/booking/reconcileBookingFee.js",
  ]) {
    ok(`${f.split("/").pop()} never gates on payout or charge status`,
       !forbidden.test(codeOf(f)));
  }
}

console.log(`\n${checks - failures}/${checks} checks passed`);
if (failures) {
  console.error(`${failures} FAILED`);
  process.exit(1);
}
