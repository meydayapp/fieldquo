// lib/voice/visitPath.js
//
// "Can someone come out and look at it?" — and what this particular business
// wants to happen next.
//
// ══ Why the agent must not decide this ═════════════════════════════════════
//
// There are four honest answers to that question, and which one is right is a
// fact about the company, not a judgement call:
//
//   BOOK      they have free visits with real availability → take the slot on
//             the call, exactly as before.
//   LINK      the visit costs money, or the phone cannot book their kind of
//             appointment → say so and send them to the booking page, which is
//             the only surface that can actually take the fee.
//   TRANSFER  a human is reachable and the caller wants one. Orthogonal to the
//             three above; it is always available when a number is configured.
//   CALLBACK  nothing is bookable at all → take their preferred times and say
//             someone will ring back. The honest floor.
//
// A model asked to work that out from a list of event types will guess, and the
// guess that costs money is "sure, I'll book you in" for a visit the company
// charges $79 for. So it is derived here, server-side, from the company's own
// rows, and folded into the prompt as a statement of fact — the same shape as
// factsFor() and quoteIntakeSection().
//
// ══ The hole this closes ═══════════════════════════════════════════════════
//
// `canBook` used to be `eventType.count({ active: true }) > 0`, and
// `bookableSlots` offered slots from every active event type. Neither knew what
// a booking COSTS. So a company charging a $79 diagnostic visit had a
// receptionist that booked it, for free, as a confirmed appointment — no
// pending_payment hold, no Stripe session, no fee. The web path
// (app/api/booking/[companySlug]/confirm) has had both branches since the fee
// shipped; the phone had one, and it was the wrong one.
//
// So free-vs-paid is decided HERE, once, and both the prompt (what it may say)
// and lib/voice/availability.js (what it may offer) read the same answer. A
// second copy of "is this one free?" is the copy that rots.
//
// ══ A published fee is not a quote ═════════════════════════════════════════
//
// Absolute rule 1 in prompt.js — never give a price — is about the WORK. It
// exists because a number invented on a call is a number the contractor never
// saw and may be held to. A booking fee is the opposite of that: the owner
// typed it into EventType.feeCents, it is printed on their own public booking
// page, and Stripe charges exactly it. Reading it back is quoting the business
// its own published figure.
//
// The distinction is carried in the prompt wording (see visitSection in
// prompt.js) rather than left implicit, and scripts/check-voice-visit.mjs
// asserts that the only figure anywhere in the generated text is one of these
// fees.

import { effectiveBookingFeeCents } from "@/lib/booking/fee";
import { currencyMeta, formatMoney } from "@/lib/currency";

/**
 * A fee as the agent should say it.
 *
 * Two deliberate departures from formatMoney(), and both are about this being
 * read ALOUD rather than printed:
 *
 *   • Whole amounts lose the cents. "$79" is what the owner typed and what a
 *     person says; "$79.00" spoken by a voice model comes out as "seventy nine
 *     dollars and zero cents".
 *   • The symbol, not Intl's currency style. `style: "currency"` with CAD on a
 *     server whose locale is en-US produces "CA$79" — which the model reads as
 *     "C A dollar seventy nine", and which does not match the "$79" printed on
 *     the company's own booking page. The symbol is unambiguous here because
 *     the amount is only ever spoken to someone already talking to a company
 *     that bills in one currency.
 *
 * Grouping still comes from Intl, so a four-figure fee is "$1,250" rather than
 * "$1250" — a model reading the second one says "one two five zero" often
 * enough to matter.
 */
export function feeText(cents, currency) {
  const amount = Number(cents || 0) / 100;
  const whole = Number.isInteger(amount);
  const meta = currencyMeta(currency);
  try {
    const digits = whole
      ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
    return `${meta.symbol}${new Intl.NumberFormat("en-US", digits).format(amount)}`;
  } catch {
    return formatMoney(amount, currency);
  }
}

/**
 * Does this company take IN-PERSON visits at all?
 *
 * Same reading canBookVisit() applies on the public side: an empty/absent
 * `bookingModes` is the schema default ["visit"] — "nothing chosen yet", never
 * "nothing offered" — and a company that has deliberately switched visits off
 * does phone or video consultations only.
 *
 * It gates the PHONE agent's own booking specifically, because bookSlot()
 * writes `mode: "visit"` and creates an Appointment somebody is expected to
 * drive to. It does NOT gate the link: the booking page offers whatever modes
 * the company actually has, so sending a call-only company's caller there is
 * correct.
 */
export function offersVisits(company) {
  const modes =
    Array.isArray(company?.bookingModes) && company.bookingModes.length
      ? company.bookingModes
      : ["visit"];
  return modes.includes("visit");
}

/**
 * Split a company's event types into the ones the phone may book and the ones
 * that must go through the booking page because money changes hands.
 *
 * `effectiveBookingFeeCents` is the authority, not `eventType.feeCents`. It
 * already encodes two product decisions the phone must not re-litigate: a live
 * promo replaces the standard price, and a company that cannot COLLECT (no
 * Stripe Connect charges) falls back to a free booking rather than naming a
 * price nobody can be charged. Reading feeCents directly would have the phone
 * quoting a fee the website says is free.
 */
export function classifyEventTypes({ company = {}, eventTypes = [] } = {}) {
  const free = [];
  const paid = [];

  for (const et of Array.isArray(eventTypes) ? eventTypes : []) {
    if (!et || et.active === false) continue;
    const { feeCents } = effectiveBookingFeeCents(company, et);
    if (feeCents > 0) {
      paid.push({
        id: et.id,
        name: String(et.name || "a visit"),
        feeCents,
        feeText: feeText(feeCents, company?.currency),
      });
    } else {
      free.push({ id: et.id, name: String(et.name || "a visit") });
    }
  }

  return { free, paid };
}

/**
 * Which of the four paths this company's receptionist is on.
 *
 * Pure — hand it rows, it answers. Nothing here reads the database, so the
 * check script can drive every branch without one.
 *
 * @param company      { bookingModes, stripeChargesEnabled, currency }
 * @param eventTypes   the company's ACTIVE EventType rows
 * @param canTransfer  a dialable transfer destination exists
 * @param bookingUrl   absolute /book/<slug> URL, or null when the origin or the
 *                     slug is unknown. Null means the agent is never told about
 *                     a link — an agent that knows a link exists but not what
 *                     it is invents one, and the invented one belongs to
 *                     somebody else.
 */
export function visitPolicy({
  company = {},
  eventTypes = [],
  canTransfer = false,
  bookingUrl = null,
} = {}) {
  const { free, paid } = classifyEventTypes({ company, eventTypes });

  // Booking on the call needs all three: a free appointment type, visits among
  // the offered modes, and — implicitly — the availability engine to return
  // something, which the agent discovers by calling check_availability.
  const canBook = offersVisits(company) && free.length > 0;

  const url = typeof bookingUrl === "string" && bookingUrl.trim() ? bookingUrl.trim() : null;
  const hasSomethingToBook = free.length > 0 || paid.length > 0;

  // "link" covers two different companies with the same right answer: one whose
  // visits are paid, and one whose bookable appointments are phone/video only.
  // Both have a working public booking page and neither can be booked from
  // here.
  const mode = canBook ? "book" : url && hasSomethingToBook ? "link" : "callback";

  return {
    mode,
    canBook,
    // Which slots availability may offer. Empty on every non-"book" path, so a
    // paid visit can never be reached through check_availability.
    bookableEventTypeIds: canBook ? free.map((f) => f.id) : [],
    freeVisits: free,
    paidVisits: paid,
    // Only carried when it is usable. See the bookingUrl note above.
    bookingUrl: hasSomethingToBook ? url : null,
    canTransfer: Boolean(canTransfer),
  };
}

/**
 * Can the booking link be TEXTED to the caller today?
 *
 * The owner asked for this specifically, so the answer is written down where
 * the code that would use it lives rather than left to be rediscovered.
 *
 * No, by either provider, and for two unrelated reasons:
 *
 *   RETELL — its SMS is gated on A2P 10DLC, which is "limited to US phone
 *   numbers, excluding toll-free numbers" (docs.retellai.com/deploy/enable-sms,
 *   verified August 2026). This product defaults `country` to CA and ships
 *   Quebec area codes in its own fixtures. For a Canadian tenant that is not
 *   "slow to approve", it is "not offered". Same finding as
 *   lib/crew/capability.js, which hit it first.
 *
 *   TWILIO — `sendSms` needs a `from` the Twilio account owns, and the account
 *   owns zero numbers. Every send fails with Twilio 21606 regardless of who is
 *   being texted. TWILIO_PHONE_NUMBER being SET is not the same as it being
 *   OWNED, which is why checking the env var would report the wrong answer.
 *
 * So the receptionist reads the link out and says plainly that it cannot text
 * it. Deliberately NOT a feature flag: there is no texting path to switch on,
 * and a flag for a feature that does not exist is the thing AGENTS.md lists as
 * a recurring failure. When a number is bought and A2P clears, this constant is
 * the one place that has to change, and its readers will fail loudly.
 */
export const CAN_TEXT_BOOKING_LINK = false;
