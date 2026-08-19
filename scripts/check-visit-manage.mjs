// scripts/check-visit-manage.mjs
//
// The public "manage my visit" link, run against the input it will actually
// get: an expired token, a token for a booking somebody already cancelled, a
// second cancel arriving because the phone retried, a reschedule to 3am.
//
// This exercises the REAL decision functions the routes call
// (lib/booking/manageVisit.js), not a paraphrase of them — which is the only
// version of this check worth having, because the routes themselves can't run
// without Postgres and Stripe. What the routes add on top is executing the
// verdict, and the last section reads their source to confirm they still ask.
//
// Nothing here opens a connection or calls Stripe.

import {
  planCancel,
  planReschedule,
  slotIsOffered,
  visitView,
  visitWhere,
  loadVisitByToken,
  mintManageToken,
  visitManagePath,
} from "@/lib/booking/manageVisit";
import {
  buildBookingConfirmationEmail,
  buildVisitCancelledEmails,
  buildVisitRescheduledEmails,
} from "@/app/admin/lib/email/templates";
import { readFileSync } from "node:fs";

let pass = 0, fail = 0;
const ok = (n, c, got) => { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.log(`  ✗ ${n}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`); } };

// Monday 09:00 Eastern. Every "hours away" below is measured from here.
const NOW = new Date("2026-08-24T13:00:00Z");
const hoursOut = (h) => new Date(NOW.getTime() + h * 3_600_000);

const COMPANY = {
  id: "cmp_1",
  name: "Northline Refinishing",
  email: "office@northline.test",
  phone: "555-0100",
  currency: "CAD",
  timezone: "America/Toronto",
  logoUrl: null,
  brandColor: "#1F6FEB",
  bookingChangeNoticeHours: 24,
  refundVisitFeeOnCancel: false,
  refundCutoffHours: null,
};

const EVENT_TYPE = {
  id: "evt_1",
  name: "On-site estimate",
  durationMinutes: 60,
  location: "On-site visit",
  userId: "usr_1",
};

function booking(over = {}) {
  return {
    id: "bkg_1",
    status: "confirmed",
    startTime: hoursOut(72),
    endTime: hoursOut(73),
    mode: "visit",
    address: "14 Maple St, Toronto",
    clientName: "Dana Brien",
    clientEmail: "dana@example.test",
    clientPhone: "555-0199",
    feePaidCents: 0,
    feeCurrency: null,
    feeStripePaymentIntentId: null,
    feeRefundedAt: null,
    feeRefundedCents: null,
    appointmentId: "apt_1",
    quote: null,
    ...over,
  };
}

const paid = (over = {}) =>
  booking({
    feePaidCents: 12000,
    feeCurrency: "cad",
    feeStripePaymentIntentId: "pi_live_1",
    ...over,
  });

const refundsOn = (over = {}) => ({ ...COMPANY, refundVisitFeeOnCancel: true, ...over });

// ───────────────────────────────────────────────────────────────────────────
console.log("\nThe token itself");
// The routes hand a raw URL segment straight to findUnique. These are the
// values that arrive when someone edits the address bar.
ok("undefined token doesn't reach the database", (await loadVisitByToken(undefined)) === null);
ok("null token doesn't reach the database", (await loadVisitByToken(null)) === null);
ok("empty token doesn't reach the database", (await loadVisitByToken("")) === null);
ok("a short guess doesn't reach the database", (await loadVisitByToken("abc")) === null);
ok("a non-string doesn't reach the database", (await loadVisitByToken({})) === null);
const minted = mintManageToken();
ok("a minted token is long enough to be unguessable", minted.length >= 43, minted.length);
ok("a minted token is URL-safe", /^[A-Za-z0-9_-]+$/.test(minted));
ok("two mints differ", mintManageToken() !== mintManageToken());
ok("the manage path is the one the email links to", visitManagePath("abc") === "/visit/abc");

// ───────────────────────────────────────────────────────────────────────────
console.log("\nCancel — the refusals");
const unknown = planCancel(null, COMPANY, NOW);
ok("unknown token is a 404, not a 500", unknown.httpStatus === 404 && unknown.reason === "not_found", unknown);
ok("unknown token refunds nothing", unknown.refundNow === false);

// "Expired" for a link with no expiry date means the visit it points at has
// been and gone.
const expired = planCancel(booking({ startTime: hoursOut(-2), endTime: hoursOut(-1) }), COMPANY, NOW);
ok("a visit in the past can't be cancelled", expired.ok === false && expired.reason === "already_happened", expired);
ok("a past visit refunds nothing", expired.refundNow === false);

const completed = planCancel(booking({ status: "completed" }), COMPANY, NOW);
ok("a completed visit can't be cancelled", completed.ok === false && completed.reason === "already_happened");

const held = planCancel(booking({ status: "pending_payment" }), COMPANY, NOW);
ok("a pending_payment hold is a 409", held.httpStatus === 409 && held.reason === "awaiting_payment", held);
ok("a pending_payment hold refunds nothing", held.refundNow === false);

const tooLate = planCancel(booking({ startTime: hoursOut(3), endTime: hoursOut(4) }), COMPANY, NOW);
ok("inside the notice window it's a 409", tooLate.httpStatus === 409 && tooLate.reason === "too_late", tooLate);
ok("inside the notice window nothing is refunded", tooLate.refundNow === false);

// The window is the company's, not 24 by accident.
const wideNotice = planCancel(booking({ startTime: hoursOut(48) }), { ...COMPANY, bookingChangeNoticeHours: 72 }, NOW);
ok("a 72h window refuses a 48h-out cancel", wideNotice.reason === "too_late", wideNotice);
const zeroIsNotPermissive = planCancel(booking({ startTime: hoursOut(3) }), { ...COMPANY, bookingChangeNoticeHours: null }, NOW);
ok("an unset window is 24h, not 'until the van pulls up'", zeroIsNotPermissive.reason === "too_late");

// ───────────────────────────────────────────────────────────────────────────
console.log("\nCancel — pressed twice");
const first = planCancel(paid(), refundsOn(), NOW);
ok("the first press is allowed", first.ok === true && first.reason === "ok", first);
ok("the first press refunds", first.refundNow === true && first.amountCents === 12000, first);

// What the row looks like after the route has done its work.
const afterFirst = paid({ status: "cancelled", feeRefundedAt: NOW, feeRefundedCents: 12000 });
const second = planCancel(afterFirst, refundsOn(), NOW);
ok("the second press is not an error", second.ok === true && second.httpStatus === 200, second);
ok("the second press says already cancelled", second.alreadyCancelled === true && second.reason === "already_cancelled");
ok("THE SECOND PRESS DOES NOT REFUND AGAIN", second.refundNow === false, second);
ok("and says why", second.refundReason === "already_refunded", second);

// The dangerous shape: cancelled, refunds on, in time, but already refunded.
// If `alreadyCancelled` were dropped this is the case that pays twice.
const forwarded = planCancel(
  paid({ status: "cancelled", feeRefundedAt: NOW, feeRefundedCents: 12000, startTime: hoursOut(200) }),
  refundsOn(),
  NOW,
);
ok("a forwarded link on a refunded booking refunds nothing", forwarded.refundNow === false, forwarded);

// Cancelled but never refunded (policy was off at the time). Still terminal:
// the route only marks a booking cancelled once the money question is settled.
const cancelledUnrefunded = planCancel(paid({ status: "cancelled" }), refundsOn(), NOW);
ok("a cancelled booking is terminal even with refunds on", cancelledUnrefunded.refundNow === false, cancelledUnrefunded);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nCancel — the money");
const policyOff = planCancel(paid(), COMPANY, NOW);
ok("refunds off: the cancel still works", policyOff.ok === true && policyOff.reason === "ok", policyOff);
ok("refunds off: NOTHING is refunded", policyOff.refundNow === false, policyOff);
ok("refunds off: the reason is honest", policyOff.refundReason === "policy_off");
ok("refunds off: the amount is still reported so the screen can name it", policyOff.amountCents === 12000);

const freeVisit = planCancel(booking(), refundsOn(), NOW);
ok("nothing paid: nothing to refund", freeVisit.refundNow === false && freeVisit.refundReason === "nothing_paid", freeVisit);
ok("nothing paid: no phantom amount", freeVisit.amountCents === 0);

// refundCutoffHours LONGER than the change window — the combination the policy
// exists for: "move it up to a day before, but the deposit needs two days".
const twoDayMoney = refundsOn({ bookingChangeNoticeHours: 24, refundCutoffHours: 48 });
const between = planCancel(paid({ startTime: hoursOut(30) }), twoDayMoney, NOW);
ok("30h out: the cancel is allowed", between.ok === true && between.reason === "ok", between);
ok("30h out: the fee is NOT returned", between.refundNow === false && between.refundReason === "inside_cutoff", between);
const outside = planCancel(paid({ startTime: hoursOut(60) }), twoDayMoney, NOW);
ok("60h out: the fee IS returned", outside.refundNow === true && outside.amountCents === 12000, outside);

// A fee taken in cash and typed in by hand has no intent to refund against.
// refunds.create({ payment_intent: null }) throws, and the client would be told
// a refund was on its way.
const noIntent = planCancel(paid({ feeStripePaymentIntentId: null }), refundsOn(), NOW);
ok("no payment intent: no Stripe call is planned", noIntent.refundNow === false, noIntent);
ok("no payment intent: the cancel still proceeds", noIntent.ok === true && noIntent.alreadyCancelled === false);
ok("no payment intent: says so rather than implying a refund", noIntent.refundReason === "no_payment_intent");

// Only ever what was captured, never today's price list.
const promoPaid = planCancel(paid({ feePaidCents: 2000 }), refundsOn(), NOW);
ok("refunds the amount PAID, not the current fee", promoPaid.amountCents === 2000, promoPaid);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nReschedule — the refusals");
const rs = (b, c, t, now = NOW) => planReschedule(b, c, EVENT_TYPE, t, now);

ok("unknown token is a 404", rs(null, COMPANY, hoursOut(100)).httpStatus === 404);
ok("cancelled can't be moved", rs(booking({ status: "cancelled" }), COMPANY, hoursOut(100)).reason === "already_cancelled");
ok("pending_payment can't be moved", rs(booking({ status: "pending_payment" }), COMPANY, hoursOut(100)).reason === "awaiting_payment");
ok("a past visit can't be moved", rs(booking({ startTime: hoursOut(-2) }), COMPANY, hoursOut(100)).reason === "already_happened");
ok("inside the notice window it can't be moved", rs(booking({ startTime: hoursOut(3) }), COMPANY, hoursOut(100)).reason === "too_late");

ok("no time given is a 400", rs(booking(), COMPANY, undefined).reason === "no_time");
ok("null time is a 400, not the epoch", rs(booking(), COMPANY, null).reason === "no_time");
ok("empty string is a 400, not the epoch", rs(booking(), COMPANY, "").reason === "no_time");
ok("garbage is a 400", rs(booking(), COMPANY, "next tuesday-ish").reason === "bad_time");
ok("a number is a 400", rs(booking(), COMPANY, { nice: "try" }).reason === "bad_time");
ok("a time in the past is refused", rs(booking(), COMPANY, hoursOut(-5)).reason === "in_the_past");
// new Date(0) is 1970, not an invalid date. It has to be caught by the clock
// rather than by the parser, which is why "in the past" is checked at all.
ok("the epoch is refused, not booked in 1970", rs(booking(), COMPANY, 0).reason === "in_the_past", rs(booking(), COMPANY, 0));

// The whole point of applying the window to the NEW time.
const tomorrowAtSeven = rs(booking({ startTime: hoursOut(300) }), COMPANY, hoursOut(2));
ok("can't move a far-off visit to two hours from now", tomorrowAtSeven.reason === "too_soon", tomorrowAtSeven);
ok("...and that's a 409, not a 400", tomorrowAtSeven.httpStatus === 409);
const legit = rs(booking({ startTime: hoursOut(300) }), COMPANY, hoursOut(30));
ok("30h out is fine on a 24h window", legit.ok === true, legit);
ok("the new end is start + duration", legit.end.getTime() - legit.start.getTime() === 60 * 60000);
const halfHour = planReschedule(booking(), COMPANY, { ...EVENT_TYPE, durationMinutes: 30 }, hoursOut(30), NOW);
ok("a 30-minute event type gets a 30-minute end", halfHour.end.getTime() - halfHour.start.getTime() === 30 * 60000);
const noDuration = planReschedule(booking(), COMPANY, { ...EVENT_TYPE, durationMinutes: null }, hoursOut(30), NOW);
ok("a broken duration is refused rather than booking a zero-length visit", noDuration.ok === false, noDuration);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nReschedule — the slot has to be one that's offered");
const offered = [
  "2026-08-27T13:00:00.000Z",
  "2026-08-27T14:00:00.000Z",
  "2026-08-27T15:00:00.000Z",
];
ok("an offered slot passes", slotIsOffered(offered, new Date("2026-08-27T14:00:00.000Z")));
ok("3am is not availability", slotIsOffered(offered, new Date("2026-08-27T07:00:00.000Z")) === false);
ok("15 minutes off an offered slot is refused", slotIsOffered(offered, new Date("2026-08-27T14:15:00.000Z")) === false);
ok("the same instant written with an offset still passes", slotIsOffered(offered, new Date("2026-08-27T10:00:00.000-04:00")));
ok("an empty calendar offers nothing", slotIsOffered([], new Date("2026-08-27T14:00:00.000Z")) === false);
ok("no calendar at all offers nothing", slotIsOffered(null, new Date("2026-08-27T14:00:00.000Z")) === false);
ok("an unparseable request matches nothing", slotIsOffered(offered, new Date("nope")) === false);
ok("a null request matches nothing", slotIsOffered(offered, null) === false);

// ───────────────────────────────────────────────────────────────────────────
console.log("\nWhat the link is allowed to show");
const view = visitView(
  {
    booking: paid({ quote: { quoteNumber: "Q-1043" } }),
    eventType: EVENT_TYPE,
    company: COMPANY,
  },
  NOW,
);
const serialised = JSON.stringify(view);
ok("no booking id", !serialised.includes("bkg_1"), serialised.slice(0, 120));
ok("no appointment id", !serialised.includes("apt_1"));
ok("no event type id", !serialised.includes("evt_1"));
ok("no company id", !serialised.includes("cmp_1"));
ok("NO STRIPE PAYMENT INTENT", !serialised.includes("pi_live_1"));
ok("no client email", !serialised.includes("dana@example.test"));
ok("no client phone", !serialised.includes("555-0199"));
ok("no internal company email", !serialised.includes("office@northline.test"));
ok("the brand is there — this page wears the contractor's name", view.company.name === "Northline Refinishing" && view.company.brandColor === "#1F6FEB");
ok("the quote number is there when there is one", view.quoteNumber === "Q-1043");
ok("no quote number invented when there isn't", visitView({ booking: paid(), eventType: EVENT_TYPE, company: COMPANY }, NOW).quoteNumber === null);
ok("the fee shown is what was paid", view.fee.paidCents === 12000 && view.fee.currency === "CAD");
ok("the policy verdict travels with it", view.policy.canChange === true && view.policy.reason === "ok");
ok("the refund verdict travels with it", view.refund.willRefund === false && view.refund.reason === "policy_off");
const lateView = visitView({ booking: paid({ startTime: hoursOut(2) }), eventType: EVENT_TYPE, company: COMPANY }, NOW);
ok("a page rendered too late says so", lateView.policy.canChange === false && lateView.policy.reason === "too_late");

console.log("\nWhere the visit is, described once");
ok("a visit uses the address", visitWhere({ booking: booking(), eventType: EVENT_TYPE, company: COMPANY }) === "14 Maple St, Toronto");
ok("no address falls back to the event type's label", visitWhere({ booking: booking({ address: null }), eventType: EVENT_TYPE, company: COMPANY }) === "On-site visit");
ok("a call is described as a call", visitWhere({ booking: booking({ mode: "call" }), eventType: EVENT_TYPE, company: COMPANY }).startsWith("Phone call"));
ok("a call names the number they gave", visitWhere({ booking: booking({ mode: "call" }), eventType: EVENT_TYPE, company: COMPANY }).includes("555-0199"));
ok("a video call is not an address", visitWhere({ booking: booking({ mode: "video" }), eventType: EVENT_TYPE, company: COMPANY }) === "Video call — we'll email a link");

// ───────────────────────────────────────────────────────────────────────────
console.log("\nThe letters");

// Frozen rendering of the confirmation email as it was BEFORE the shared shell
// existed, whitespace-normalised. The shell was extracted so cancel and
// reschedule wouldn't be a second copy of this layout; this proves the
// extraction didn't quietly redesign the email that was already going out.
const GOLDEN_CONFIRMATION =
  '<!DOCTYPE html> <html> <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head> <body style="margin:0;padding:24px 12px;background:#F8F4EF;font-family:Arial,Helvetica,sans-serif;color:#2d2520;"> <table width="100%" cellpadding="0" cellspacing="0" role="presentation"> <tr><td align="center"> <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #eadfd4;border-radius:10px;overflow:hidden;"> <tr><td style="background:#1A1917;padding:22px 30px;"> <span style="color:#ff5a00;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">Northline Refinishing</span> </td></tr> <tr><td style="padding:30px;"> <h1 style="margin:0 0 12px;font-size:25px;line-height:1.3;font-weight:700;color:#2d2520;">You&rsquo;re booked in</h1> <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#6b5d52;"> Hi Dana &lt;O\'Brien&gt;,<br/><br/> Your On-site estimate with Northline Refinishing is confirmed. </p> <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;background:#F8F4EF;border:1px solid #eadfd4;border-radius:10px;"> <tr> <td style="padding:14px 16px;font-size:13px;color:#6b5d52;">When</td> <td style="padding:14px 16px;font-size:15px;color:#2d2520;font-weight:700;text-align:right;">Tuesday, August 25 at 2:00 PM EDT</td> </tr> <tr> <td style="padding:14px 16px;border-top:1px solid #eadfd4;font-size:13px;color:#6b5d52;">Where</td> <td style="padding:14px 16px;border-top:1px solid #eadfd4;font-size:15px;color:#2d2520;font-weight:700;text-align:right;">14 Maple St, Toronto</td> </tr> </table> <p style="margin:0;font-size:15px;line-height:1.75;color:#6b5d52;"> Need to change or cancel? Just reply to this email. </p> </td></tr> <tr><td style="background:#F8F4EF;border-top:1px solid #eadfd4;padding:20px 30px;font-size:11px;line-height:1.6;color:#6b5d52;"> Northline Refinishing </td></tr> </table> </td></tr> </table> </body> </html>';

const norm = (s) => s.replace(/\s+/g, " ").trim();
const confirmArgs = {
  companyName: "Northline Refinishing",
  clientName: "Dana <O'Brien>",
  eventTypeName: "On-site estimate",
  startTime: new Date("2026-08-25T18:00:00Z"),
  location: "14 Maple St, Toronto",
  timezone: "America/Toronto",
  arrivalWindowMinutes: 0,
};
const plainConfirm = buildBookingConfirmationEmail(confirmArgs);
ok("the confirmation email is byte-for-byte what it was (modulo whitespace)", norm(plainConfirm.html) === GOLDEN_CONFIRMATION);
ok("its subject is unchanged", plainConfirm.subject === "Confirmed: On-site estimate with Northline Refinishing");
ok("a hostile client name is escaped, not rendered", plainConfirm.html.includes("&lt;O'Brien&gt;") && !plainConfirm.html.includes("<O'Brien>"));

const linked = buildBookingConfirmationEmail({ ...confirmArgs, manageUrl: "https://x.test/visit/tok" });
ok("with a manage link the button appears", linked.html.includes('href="https://x.test/visit/tok"'));
ok("without one no dead button is printed", !plainConfirm.html.includes("<a href="));
ok("without one it still says how to change the booking", plainConfirm.html.includes("reply to this email"));

const scripted = buildBookingConfirmationEmail({
  ...confirmArgs,
  clientName: '<script>alert(1)</script>',
  manageUrl: 'https://x.test/" onmouseover="alert(1)',
});
ok("a script tag in a name is escaped", !scripted.html.includes("<script>"));
ok("a quote in the manage URL can't break out of the attribute", !/href="https:\/\/x\.test\/" onmouseover/.test(scripted.html));

console.log("\nThe cancellation letters");
const cancelled = buildVisitCancelledEmails({
  company: COMPANY,
  clientName: "Dana Brien",
  clientEmail: "dana@example.test",
  eventTypeName: "On-site estimate",
  startTime: hoursOut(72),
  location: "14 Maple St, Toronto",
  timezone: "America/Toronto",
  refund: { refunded: false, amountCents: 12000, currency: "cad", reason: "policy_off" },
});
ok("the client is written to", cancelled.client.to === "dana@example.test");
ok("the company is written to", cancelled.company.to === "office@northline.test");
ok("the client's copy says cancelled", cancelled.client.html.includes("Your visit is cancelled"));
ok("the company's copy is a different letter", cancelled.company.html.includes("A booking was cancelled"));
ok("the company's copy names the client", cancelled.company.html.includes("dana@example.test"));
ok("NOT REFUNDED never reads as refunded", !/has been refunded/.test(cancelled.client.html), cancelled.client.html.match(/refunded[^<]*/g));
ok("not refunded says the fee isn't returned automatically", cancelled.client.html.includes("isn't returned automatically"));
ok("the company is told the fee was NOT refunded", cancelled.company.html.includes("NOT refunded"));

const refunded = buildVisitCancelledEmails({
  company: refundsOn(),
  clientName: "Dana Brien",
  clientEmail: "dana@example.test",
  eventTypeName: "On-site estimate",
  startTime: hoursOut(72),
  timezone: "America/Toronto",
  refund: { refunded: true, amountCents: 12000, currency: "cad", reason: "ok" },
});
ok("a real refund is stated with the amount", refunded.client.html.includes("$120.00") && refunded.client.html.includes("has been refunded"));

const freeCancel = buildVisitCancelledEmails({
  company: COMPANY,
  clientName: "Dana Brien",
  clientEmail: "dana@example.test",
  eventTypeName: "On-site estimate",
  startTime: hoursOut(72),
  timezone: "America/Toronto",
  refund: { refunded: false, amountCents: 0, reason: "nothing_paid" },
});
ok("no fee paid: the letter says nothing about fees", !/fee/i.test(freeCancel.client.html));

const noOfficeEmail = buildVisitCancelledEmails({
  company: { ...COMPANY, email: null },
  clientName: "Dana Brien",
  clientEmail: "dana@example.test",
  eventTypeName: "On-site estimate",
  startTime: hoursOut(72),
  timezone: "America/Toronto",
  refund: {},
});
ok("a company with no address is skipped, not sent to null", noOfficeEmail.company.to === null);

console.log("\nThe reschedule letters");
const moved = buildVisitRescheduledEmails({
  company: COMPANY,
  clientName: "Dana Brien",
  clientEmail: "dana@example.test",
  eventTypeName: "On-site estimate",
  previousStartTime: new Date("2026-08-25T18:00:00Z"),
  startTime: new Date("2026-08-27T14:00:00Z"),
  location: "14 Maple St, Toronto",
  timezone: "America/Toronto",
  arrivalWindowMinutes: 0,
  manageUrl: "https://x.test/visit/tok",
});
ok("the client's copy names the new time", moved.client.html.includes("Thursday, August 27"));
ok("the client's copy still names the old one", moved.client.html.includes("Tuesday, August 25"));
ok("the company's copy names both too", moved.company.html.includes("August 27") && moved.company.html.includes("August 25"));
ok("the client keeps a working manage link", moved.client.html.includes('href="https://x.test/visit/tok"'));
ok("the client is told the fee carries over", /visit fee you already paid still stands/.test(moved.client.html));
ok("the company is told nothing was charged or refunded", /nothing was charged or refunded/.test(moved.company.html));

// An arrival window is a promise to the client, not a change to the crew's day.
const windowed = buildVisitRescheduledEmails({
  company: COMPANY,
  clientName: "Dana Brien",
  clientEmail: "dana@example.test",
  eventTypeName: "On-site estimate",
  previousStartTime: new Date("2026-08-25T18:00:00Z"),
  startTime: new Date("2026-08-27T14:00:00Z"),
  timezone: "America/Toronto",
  arrivalWindowMinutes: 60,
});
ok("the client sees the arrival window", /between/.test(windowed.client.html), windowed.client.html.match(/between[^<]*/));
ok("the crew's copy keeps the exact time", windowed.company.html.includes("10:00 AM") && !/between/.test(windowed.company.html));

// ───────────────────────────────────────────────────────────────────────────
console.log("\nThe routes still ask before acting");
//
// The decisions above are only worth anything if the handlers call them. These
// read the shipped source: a check that a guard exists somewhere is not a check
// that the money path runs it.
const cancelRoute = readFileSync(new URL("../app/api/visit/[token]/route.js", import.meta.url), "utf8");
const reschedRoute = readFileSync(new URL("../app/api/visit/[token]/reschedule/route.js", import.meta.url), "utf8");
// Comments stripped for the "doesn't do X" assertions — those routes explain in
// prose exactly what they don't touch, and the prose would fail the check that
// the prose is true.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

ok("cancel re-runs the policy server-side", /planCancel\(booking, company, now\)/.test(cancelRoute));
ok("cancel is rate limited", /rateLimit\(request, "visit-manage-cancel"/.test(cancelRoute));
ok("the GET is rate limited too", /rateLimit\(request, "visit-manage-read"/.test(cancelRoute));
ok("cancel refunds ONLY when the plan says so", /if \(plan\.refundNow\) \{[\s\S]*stripe\.refunds\.create/.test(cancelRoute));
ok("the refund is idempotent on the booking id", /idempotencyKey: `visit-cancel-refund-\$\{booking\.id\}`/.test(cancelRoute));
ok("the refund reverses the transfer to the connected account", /reverse_transfer: true/.test(cancelRoute));
ok("feeRefundedAt is written only after Stripe answered", /refundedAt = new Date\(\);/.test(cancelRoute) && /refundedAt && \{ feeRefundedAt: refundedAt/.test(cancelRoute));
ok("a failed refund cancels nothing", /reason: "refund_failed"[\s\S]*status: 502/.test(cancelRoute));
ok("the appointment is freed", /db\.appointment[\s\S]*status: "cancelled"/.test(cancelRoute));
ok("the emails can't fail the cancellation", /sendVisitCancelledEmails\([\s\S]*\}\)\.catch\(/.test(cancelRoute));
ok("params is awaited (Next 16)", /await params/.test(cancelRoute) && /await params/.test(reschedRoute));

ok("reschedule re-runs the policy server-side", /planReschedule\(booking, company, eventType, body\?\.startTime, now\)/.test(reschedRoute));
ok("reschedule is rate limited", /rateLimit\(request, "visit-manage-reschedule"/.test(reschedRoute));
ok("RESCHEDULE VALIDATES AGAINST REAL AVAILABILITY", /computeAvailableSlots\(\{/.test(reschedRoute) && /slotIsOffered\(offered, plan\.start\)/.test(reschedRoute));
ok("...excluding the booking being moved", /exclude: \{ bookingId: booking\.id, appointmentId: booking\.appointmentId \}/.test(reschedRoute));
ok("the appointment moves with it", /db\.appointment[\s\S]*scheduledAt: plan\.start/.test(reschedRoute));
ok("THE FEE CARRIES OVER — reschedule touches no fee column", !/feePaidCents|feeRefunded|feeStripePaymentIntentId/.test(code(reschedRoute)), code(reschedRoute).match(/fee\w*/g));
ok("reschedule never calls Stripe at all", !/stripe/i.test(code(reschedRoute)));
ok("the emails can't fail the move", /sendVisitRescheduledEmails\([\s\S]*\}\)\.catch\(/.test(reschedRoute));

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"} — ${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
