// lib/booking/manageVisit.js
//
// Everything the client-facing "manage my visit" link needs, minus the doing.
//
// The route handlers under app/api/visit/[token] are thin on purpose: they
// resolve a token, ask this module what is permitted, and then execute. The
// decisions live here because they have to be replayable — a public endpoint
// that cancels a visit and returns a card payment cannot be verified by reading
// it, and a route handler can only be tested by standing up Postgres and
// Stripe. `planCancel` and `planReschedule` take plain objects and a clock, so
// scripts/check-visit-manage.mjs runs the SAME code the route runs against
// hostile input rather than a paraphrase of it.
//
// The policy itself is lib/booking/changePolicy.js and is not restated here.
// This module composes it with the things the policy deliberately knows nothing
// about: whether a Stripe payment intent actually exists to refund against,
// whether the requested new time is one the company really offers, and what a
// stranger holding the link is allowed to see.

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import {
  canClientChange,
  refundOnCancel,
  changeNoticeHours,
  refundCutoffHours,
  hoursUntil,
} from "@/lib/booking/changePolicy";
import { bookingModeLine, bookingDurationMinutes } from "@/lib/booking/bookingModes";

/**
 * A fresh manage token. Same shape as the quote share token
 * (app/api/quotes/[id]/send/route.js) — 32 random bytes, base64url so it is
 * safe in a path segment. Guessing one is not a realistic attack; that is the
 * entire access control on this link, so it is not shortened for tidiness.
 */
export function mintManageToken() {
  return randomBytes(32).toString("base64url");
}

/**
 * Where the client's own copy of a booking lives. One function so the
 * confirmation email, the cancel notice and the reschedule notice can never
 * disagree about the path — a manage link that 404s is worse than none.
 */
export function visitManagePath(token) {
  return `/visit/${token}`;
}

/**
 * The one line every letter uses for WHAT was booked and WHERE it happens —
 * "On-site visit at 14 Maple St", "Phone call — we'll ring 555-0199",
 * "Video call — we'll email a link to d@x" — in the reader's language.
 *
 * Here rather than in each sender because the cancellation and reschedule
 * notices have to describe the same visit the confirmation described. Two
 * copies would drift, and the drift would show up as a client being told
 * "On-site visit" about the phone call they booked. The words themselves are
 * lib/booking/bookingModes.js's, shared with the manage page, the text, the
 * calendar card and the crew's day; this is the adapter from a Booking row.
 *
 * Never falls back to eventType.location — that column carried the free-text
 * "Phone or on-site visit" label this whole change exists to retire.
 */
export function visitWhere({ booking, language = "en" }) {
  return bookingModeLine({ ...visitFacts(booking), language });
}

/**
 * The four facts a letter needs to describe the appointment in ITS language:
 * { mode, address, phone, email }. Passed as `where` to the three letters in
 * app/admin/lib/email/templates.js, which build the line once for the
 * client's copy and once for the office's rather than sharing one string in
 * one language.
 */
export function visitFacts(booking) {
  return {
    mode: booking?.mode || "visit",
    address: booking?.address || null,
    phone: booking?.clientPhone || null,
    email: booking?.clientEmail || null,
  };
}

/** The Company columns this whole flow needs, in one place. */
const COMPANY_SELECT = {
  id: true,
  name: true,
  email: true,
  logoUrl: true,
  brandColor: true,
  phone: true,
  currency: true,
  timezone: true,
  arrivalWindowMinutes: true,
  // The fallback language for the manage page, when the visit has no quote
  // behind it to take one from. See `language` in visitView.
  defaultLanguage: true,
  travelCheckEnabled: true,
  travelBufferMinutes: true,
  bookingChangeNoticeHours: true,
  refundVisitFeeOnCancel: true,
  refundCutoffHours: true,
  // The per-mode lengths, so a moved phone call is re-slotted at the call's
  // length and not the visit's (planReschedule).
  defaultVisitMinutes: true,
  callMinutes: true,
  videoMinutes: true,
  // senderFor() needs these or the mail silently reverts to the shared domain.
  emailDomain: true,
  emailDomainStatus: true,
  emailFromLocal: true,
};

/**
 * Resolve a manage token to everything the routes need, or null.
 *
 * Narrow selects rather than `include`, because the row this returns is the
 * only thing standing between a public endpoint and the rest of the tenant's
 * data. Nothing is fetched that no caller reads.
 */
export async function loadVisitByToken(token) {
  // findUnique with an undefined filter throws at the adapter; an empty string
  // would be a legitimate query for a row that cannot exist. Neither should
  // reach Postgres from a public URL segment.
  if (typeof token !== "string" || token.length < 16) return null;

  const booking = await db.booking.findUnique({
    where: { manageToken: token },
    select: {
      id: true,
      status: true,
      startTime: true,
      endTime: true,
      mode: true,
      address: true,
      latitude: true,
      longitude: true,
      clientName: true,
      clientEmail: true,
      clientPhone: true,
      feePaidCents: true,
      feeCurrency: true,
      feeStripePaymentIntentId: true,
      feeRefundedAt: true,
      feeRefundedCents: true,
      appointmentId: true,
      language: true,
      // The calendar invite's running SEQUENCE — bumped by the move and the
      // cancel routes in the same write, sent with the letter.
      calendarSequence: true,
      quote: { select: { quoteNumber: true, language: true } },
      eventType: {
        select: {
          id: true,
          name: true,
          durationMinutes: true,
          bufferBefore: true,
          bufferAfter: true,
          location: true,
          userId: true,
          company: { select: COMPANY_SELECT },
        },
      },
    },
  });

  if (!booking?.eventType?.company) return null;

  return {
    booking,
    eventType: booking.eventType,
    company: booking.eventType.company,
  };
}

/** Minutes between a row's start and end, or null when it has no honest pair. */
function reservedMinutes(booking) {
  const a = new Date(booking?.startTime).getTime();
  const b = new Date(booking?.endTime).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.round((b - a) / 60000);
}

/**
 * What a stranger holding the link may see.
 *
 * Deliberately built by naming fields rather than by deleting them from the
 * row: the delete-what's-secret shape leaks the next column somebody adds. No
 * booking id, no event type id, no company id, no appointment id, and above all
 * no Stripe payment intent — the client needs to know a fee was paid, not the
 * handle that could be used to move it.
 */
export function visitView({ booking, eventType, company }, now = new Date()) {
  const change = canClientChange(booking, company, now);
  const refund = refundOnCancel(booking, company, now);

  // ── What the page is written in ──────────────────────────────────────
  //
  // Resolved HERE rather than from the browser's Accept-Language, which
  // reports the phone's setting: a francophone client whose handset is in
  // English would get an English page about a French quote, and the reverse
  // is worse (AGENTS.md non-negotiable 6).
  //
  // Booking carries no client relation — only a name and an email — but it
  // carries the language the booker chose on the form (Booking.language),
  // which stands in for the client's preference here. The quote behind the
  // visit is a document with a fixed language and wins; then the booker's
  // choice; otherwise the company default; otherwise English.
  const language = resolveClientLanguage({
    document: booking.quote,
    client: booking.language ? { language: booking.language } : null,
    company,
  });

  return {
    status: booking.status,
    clientName: booking.clientName,
    eventTypeName: eventType.name,
    startTime: booking.startTime,
    endTime: booking.endTime,
    // The length of the mode this booking is in — the row's own end minus
    // start when both are there, since that is what was reserved; the
    // per-mode length otherwise.
    durationMinutes: reservedMinutes(booking) ?? bookingDurationMinutes({ company, eventType, mode: booking.mode }),
    // The company's zone, so the page renders "Tuesday 2:00 PM EDT" the same
    // way the confirmation email did rather than in the reader's own zone.
    timezone: company.timezone || null,
    mode: booking.mode,
    // The address they gave, or nothing. This fell back to eventType.location,
    // which put the free-text "Phone or on-site visit" label on the page as
    // if it were a street.
    address: booking.address || null,
    // The one sentence for what was booked and where, in the reader's
    // language — the same one the confirmation letter and the text carry.
    where: visitWhere({ booking, language }),
    language,
    // ── The arrival window, decided here so one place decides it ─────────
    //
    // Zero for a call or a video meeting, so the page falls straight through to
    // the exact time: there is no drive to absorb, and widening "we'll ring you
    // at 2" into a half-hour band is a promise nobody made. Same rule
    // finalizeBooking applies to the confirmation email. Zero also means "off",
    // which is the default — describeWindow returns null and the caller's exact
    // formatting wins.
    arrivalWindowMinutes:
      booking.mode === "visit" ? company.arrivalWindowMinutes || 0 : 0,
    company: {
      name: company.name,
      logoUrl: company.logoUrl,
      brandColor: company.brandColor,
      phone: company.phone,
      currency: company.currency,
    },
    // What they actually paid, and what came back — never eventType.feeCents,
    // which is today's price list rather than this client's receipt.
    fee: {
      paidCents: booking.feePaidCents || 0,
      currency: (booking.feeCurrency || company.currency || "").toUpperCase() || null,
      refundedAt: booking.feeRefundedAt,
      refundedCents: booking.feeRefundedCents,
    },
    quoteNumber: booking.quote?.quoteNumber || null,
    // The verdicts, not a boolean. The page has to explain a refusal to someone
    // who cannot ask anyone, so it gets the stable reason key and the numbers
    // behind it.
    policy: {
      canChange: change.allowed,
      reason: change.reason,
      hoursLeft: change.hoursLeft,
      noticeHours: changeNoticeHours(company),
    },
    refund: {
      willRefund: refund.refund,
      reason: refund.reason,
      amountCents: refund.amountCents,
      cutoffHours: refundCutoffHours(company),
    },
  };
}

/**
 * Everything the cancel route is allowed to do, decided before it does any of
 * it.
 *
 * @returns {{
 *   ok: boolean, httpStatus: number, reason: string,
 *   alreadyCancelled: boolean, refundNow: boolean,
 *   refundReason: string, amountCents: number,
 * }}
 */
export function planCancel(booking, company, now = new Date()) {
  const deny = (httpStatus, reason) => ({
    ok: false,
    httpStatus,
    reason,
    alreadyCancelled: false,
    refundNow: false,
    refundReason: reason,
    amountCents: 0,
  });

  if (!booking) return deny(404, "not_found");

  const change = canClientChange(booking, company, now);

  // ── A second press is not an error, and not a second refund ───────────────
  //
  // The link is holdable by anyone the client forwarded it to, and a phone on a
  // bad connection retries. So an already-cancelled booking answers 200 with
  // its state — and moves no money, whatever the refund policy would say about
  // it now. Cancelled is terminal here on purpose: if the first cancel's refund
  // failed at Stripe, the row was never marked cancelled either (see the route),
  // so reaching this branch means the money question was already settled.
  if (change.reason === "already_cancelled") {
    const refund = refundOnCancel(booking, company, now);
    return {
      ok: true,
      httpStatus: 200,
      reason: "already_cancelled",
      alreadyCancelled: true,
      refundNow: false,
      refundReason: booking.feeRefundedAt ? "already_refunded" : refund.reason,
      amountCents: refund.amountCents,
    };
  }

  if (!change.allowed) {
    // 404 for a booking that isn't there, 409 for one that is but can't be
    // touched — the page shows the reason either way, but a monitor shouldn't
    // read "too late to cancel" as a broken link.
    return deny(change.reason === "not_found" ? 404 : 409, change.reason);
  }

  const refund = refundOnCancel(booking, company, now);

  // The policy answers "should this money come back". It cannot answer "is
  // there a Stripe payment to send it back through" — a fee taken in cash and
  // recorded by hand has no intent, and refunds.create would throw on null.
  // Reported as its own reason so the screen says something true rather than
  // implying a refund is on its way.
  if (refund.refund && !booking.feeStripePaymentIntentId) {
    return {
      ok: true,
      httpStatus: 200,
      reason: "ok",
      alreadyCancelled: false,
      refundNow: false,
      refundReason: "no_payment_intent",
      amountCents: refund.amountCents,
    };
  }

  return {
    ok: true,
    httpStatus: 200,
    reason: "ok",
    alreadyCancelled: false,
    refundNow: refund.refund,
    refundReason: refund.reason,
    amountCents: refund.amountCents,
  };
}

/**
 * Everything the reschedule route can decide WITHOUT asking the calendar.
 *
 * Split from the availability check because computing availability costs a
 * handful of queries and, when the visitor gave an address, a Distance Matrix
 * call. A request that fails the policy or posts "next Tuesday-ish" must not
 * pay for that first.
 *
 * @returns {{ ok, httpStatus, reason, start: Date|null, end: Date|null }}
 */
export function planReschedule(booking, company, eventType, startTime, now = new Date()) {
  const deny = (httpStatus, reason) => ({ ok: false, httpStatus, reason, start: null, end: null });

  if (!booking) return deny(404, "not_found");

  const change = canClientChange(booking, company, now);
  if (!change.allowed) {
    return deny(change.reason === "not_found" ? 404 : 409, change.reason);
  }

  // new Date(null) is the epoch and new Date(undefined) is Invalid Date; both
  // arrive from a browser as easily as a real timestamp, and only one of them
  // is obviously wrong on inspection.
  if (startTime == null || startTime === "") return deny(400, "no_time");
  const start = new Date(startTime);
  if (!Number.isFinite(start.getTime())) return deny(400, "bad_time");

  // The length of the mode the booking is IN — a moved phone call keeps the
  // call's length, a moved visit the visit's. The mode itself never changes
  // on a move: the address a visit was booked to and the phone a call was
  // booked on ride along on the row untouched, and the route re-validates
  // the new time against the calendar in that same mode.
  const duration = bookingDurationMinutes({ company, eventType, mode: booking.mode });
  if (!Number.isFinite(duration) || duration <= 0) return deny(400, "bad_time");

  // ── The notice window applies to the NEW time as well ────────────────────
  //
  // Checking only the old one lets someone with a fortnight's notice move the
  // visit to seven tomorrow morning, which is precisely the thing the window
  // exists to prevent: it is how much warning the CREW needs, not a reward for
  // having booked early. Availability alone would allow it — 7am is inside the
  // estimator's working hours.
  const leadHours = hoursUntil(start, now);
  if (leadHours === null || leadHours <= 0) return deny(400, "in_the_past");
  if (leadHours < changeNoticeHours(company)) return deny(409, "too_soon");

  return {
    ok: true,
    httpStatus: 200,
    reason: "ok",
    start,
    end: new Date(start.getTime() + duration * 60000),
  };
}

/**
 * Is this exact instant one the company is actually offering?
 *
 * Compared as instants, not strings. computeAvailableSlots emits
 * `toISOString()`; a browser may post the same moment with a `+00:00` offset or
 * a local one, and a string compare would reject a slot the company is offering
 * for no reason the client could act on.
 */
export function slotIsOffered(slots, start) {
  if (!Array.isArray(slots) || !start) return false;
  const want = new Date(start).getTime();
  if (!Number.isFinite(want)) return false;
  return slots.some((s) => new Date(s).getTime() === want);
}

/**
 * Plain-English fallback for a reason key.
 *
 * The KEY is what the page should render from — the wording is per-language and
 * belongs to the page, exactly as changePolicy.js says. This exists because a
 * JSON error body still needs an `error` string for the shared fetch helpers
 * and for anyone reading a log.
 */
export function reasonMessage(reason) {
  switch (reason) {
    case "not_found":
      return "That link doesn't match a booking.";
    case "already_cancelled":
      return "This visit has already been cancelled.";
    case "already_happened":
      return "This visit has already taken place.";
    case "awaiting_payment":
      return "This booking is still waiting on payment.";
    case "too_late":
      return "It's too close to the visit to change it here — please call us.";
    case "too_soon":
      return "That time doesn't give us enough notice — please pick a later one.";
    case "in_the_past":
      return "That time has already passed.";
    case "no_time":
    case "bad_time":
      return "That isn't a time we can read.";
    case "slot_unavailable":
      return "That time isn't available. Please pick another.";
    default:
      return "That change can't be made.";
  }
}
