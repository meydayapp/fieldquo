// lib/voice/triggers.js
//
// The moments that queue an outbound call.
//
// Kept out of the route handlers themselves so the rule ("when a quote is
// approved, and the company opted in, and the client can be called, queue a
// confirmation call") lives in one readable place — and so a route that fails
// to queue a call doesn't fail the thing it was actually doing. Every trigger
// is best-effort: approving a quote must succeed even if queuing the call
// throws.
import { db } from "@/lib/db";
import { enqueueOutbound } from "./outboundCall";
// The one formatter for a spoken quote total. Shared with placeQueuedCall so
// the figure written onto the task and the figure re-derived at dial time are
// the same string — see spokenTotal.
import { spokenTotal } from "./outboundPrompt";
// Constants and copy only, no imports of its own — so the settings CARD can
// share this table without pulling Prisma into the browser bundle.
import {
  QUOTE_CALL_SCOPES,
  normaliseQuoteCallScope,
  CALLBACK_REFUSED,
} from "./quoteCallScope";

const HOUR = 60 * 60 * 1000;

/** How far ahead of a visit to place the reminder call. */
const REMIND_BEFORE_HOURS = 24;

/** Too close to bother — a reminder call minutes after booking is a nuisance. */
const MIN_LEAD_HOURS = 3;

/**
 * When to place a reminder for an appointment, or that it shouldn't be placed.
 *
 * Pure, so the timing runs in a test against the awkward cases: booked for the
 * past, booked for two hours from now (skip — they just did it), booked for
 * next week (hold until the day before).
 *
 * @returns {{ skip: boolean, notBefore: Date|null, reason?: string }}
 */
export function reminderTiming(startTime, now = new Date()) {
  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return { skip: true, notBefore: null, reason: "no start time" };

  const leadMs = start.getTime() - now.getTime();
  if (leadMs <= 0) return { skip: true, notBefore: null, reason: "in the past" };
  if (leadMs < MIN_LEAD_HOURS * HOUR) return { skip: true, notBefore: null, reason: "too soon" };

  // The day before — but never earlier than now (a booking made inside the
  // 24-hour window reminds as soon as the cron next runs in-hours).
  const target = new Date(start.getTime() - REMIND_BEFORE_HOURS * HOUR);
  return { skip: false, notBefore: target > now ? target : now };
}

/** "Tuesday, August 12 at 2:00 PM" — the phrase the agent reads back. */
export function describeAppointmentTime(startTime, { timezone, language = "en" } = {}) {
  const d = new Date(startTime);
  if (Number.isNaN(d.getTime())) return null;
  const locale = language === "fr" ? "fr-CA" : "en-US";
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(timezone ? { timeZone: timezone } : {}),
    }).format(d);
  } catch {
    return null;
  }
}

/** A short "what the work is" line from the quote's line items, or null. */
function serviceSummary(lineItems) {
  if (!Array.isArray(lineItems) || !lineItems.length) return null;
  const names = lineItems
    .map((li) => (li && typeof li === "object" ? li.name || li.description : null))
    .filter(Boolean)
    .slice(0, 3);
  return names.length ? names.join(", ") : null;
}

// Re-exported rather than defined here: server callers have always imported the
// refusal codes from this module, and the settings card needs the same table
// from a file that doesn't reach the database. One definition, two doors.
export { CALLBACK_REFUSED };

/**
 * May we ring this client about this quote?
 *
 * ── Hot lead, and still every gate ─────────────────────────────────────────
 *
 * This is not a cold call: they asked for a quote and have just been sent one.
 * That earns the call, and it earns nothing else — the consent row, the calling
 * window and the stop list are checked at dial time by mayCall exactly as they
 * are for every other outbound call, and nothing here can skip them.
 *
 * What this function adds is the rules specific to a quote:
 *
 *   THE COMPANY CHOSE THE SCOPE. `outboundQuoteCallScope` decides whether this
 *   covers instant estimates only (the default, and what shipped), every quote
 *   the company sends, or nothing. See lib/voice/quoteCallScope.js for why the
 *   narrow rule stayed the default rather than the new wide one.
 *
 *   NEVER SOMEONE WHO SAID NO. A declined quote gets no closing call. The
 *   agent's job is to answer questions and ask whether they want to go ahead;
 *   they already answered.
 *
 *   APPROVED, NEVER A DRAFT. An auto-estimated quote is FieldQuo's guess until
 *   somebody with quote:approve-estimate says otherwise. Ringing a homeowner
 *   about a figure no human has looked at is the exact failure the review queue
 *   exists to prevent, so `needsReview` still set is a refusal.
 *
 *   THE EMAIL GOES FIRST. The agent may state the quote total (outbound rule 3
 *   — a figure a human already committed to). That is only true once the client
 *   has the document in writing: then the call is about a paper they can read,
 *   not a number a robot said. `sentAt` is written only after Resend accepted
 *   the message (see app/api/quotes/[id]/send/route.js), so it is evidence of a
 *   send rather than of an intention to send.
 *
 * Pure — no database — so scripts/check-voice-quote-intake.mjs executes every
 * refusal instead of somebody reading the conditions and agreeing with them.
 *
 * @param quote { status, autoEstimated, needsReview, sentAt,
 *                company:{outboundCallsEnabled, outboundQuoteCallScope},
 *                client:{phone} }
 */
export function approvedQuoteCallGate(quote) {
  if (!quote) return { allowed: false, reason: CALLBACK_REFUSED.NO_QUOTE };
  if (!quote.company?.outboundCallsEnabled) return { allowed: false, reason: CALLBACK_REFUSED.OFF };

  // ── Scope, chosen by the company ────────────────────────────────────────
  //
  // An unset column normalises to `instant_estimates`, which is what this
  // function did unconditionally before the setting existed — so a company that
  // never opens the card sees no change at all.
  const scope = normaliseQuoteCallScope(quote.company?.outboundQuoteCallScope);
  if (scope === QUOTE_CALL_SCOPES.OFF) {
    return { allowed: false, reason: CALLBACK_REFUSED.SCOPE_OFF };
  }
  if (scope === QUOTE_CALL_SCOPES.INSTANT && !quote.autoEstimated) {
    return { allowed: false, reason: CALLBACK_REFUSED.NOT_ESTIMATE };
  }

  // A "no" already given. Nothing in the closer's brief is worth saying to
  // somebody who declined, and ringing them anyway is the badgering this
  // feature has to not be.
  if (quote.status === "declined") return { allowed: false, reason: CALLBACK_REFUSED.DECLINED };

  if (quote.needsReview) return { allowed: false, reason: CALLBACK_REFUSED.DRAFT };
  if (!quote.sentAt) return { allowed: false, reason: CALLBACK_REFUSED.NOT_EMAILED };
  if (!quote.client?.phone) return { allowed: false, reason: CALLBACK_REFUSED.NO_PHONE };
  return { allowed: true };
}

/**
 * Exactly the columns approvedQuoteCallGate reads, plus what the brief needs.
 *
 * Exported so lib/voice/quoteCallbackReport.js selects the SAME shape. A report
 * that says "this quote wasn't called because X" while selecting a different
 * set of columns is a second description of the rule, and the second one is the
 * one that rots.
 */
export const QUOTE_CALLBACK_SELECT = {
  id: true,
  companyId: true,
  clientId: true,
  status: true,
  total: true,
  lineItems: true,
  autoEstimated: true,
  needsReview: true,
  sentAt: true,
  company: {
    select: {
      name: true,
      currency: true,
      outboundCallsEnabled: true,
      outboundQuoteCallScope: true,
    },
  },
  client: { select: { phone: true } },
};

/** The one purpose this file queues for a quote. Shared with the report. */
export const QUOTE_CALLBACK_PURPOSE = "quote_approved";

/**
 * Queue the confirm-and-schedule call for an approved, emailed quote.
 *
 * One implementation behind two moments — see onQuoteApproved / onQuoteEmailed.
 * Whichever of the two happens LAST is the one that queues it, because the gate
 * only passes when both have happened. enqueueOutbound de-dupes on
 * (company, purpose, quote), so both firing costs one task.
 *
 * ── `once` — one call per quote, ever ──────────────────────────────────────
 *
 * enqueueOutbound's ordinary de-dupe only looks at LIVE tasks, which was enough
 * while both triggers fired within seconds of each other. It is not enough for
 * a re-send: a quote emailed on Monday got its call, the task went to `done`,
 * and pressing Send again on Thursday — to a client who had lost the email —
 * found no live task and queued a second call. A closer that rings twice about
 * one quote is the badgering the whole gate exists to prevent, so this asks for
 * the de-dupe that spans every status.
 *
 * The reminder and lead triggers below deliberately keep the live-only rule: a
 * visit that is rescheduled genuinely needs a second reminder.
 *
 * Consent is NOT checked here: placeQueuedCall checks it at dial time, along
 * with the calling window and the stop list, because any of the three can
 * change in the hours between queuing and dialling.
 */
async function queueApprovedQuoteCall(quoteId) {
  if (!quoteId) return null;

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: QUOTE_CALLBACK_SELECT,
  });

  const gate = approvedQuoteCallGate(quote);
  // Silent no-op. Most approvals and most sends will not queue a call, and that
  // is the correct outcome rather than an error.
  if (!gate.allowed) return null;

  const total = spokenTotal(quote.total, quote.company.currency || "CAD");

  return enqueueOutbound({
    companyId: quote.companyId,
    purpose: QUOTE_CALLBACK_PURPOSE,
    clientId: quote.clientId,
    quoteId: quote.id,
    once: true,
    context: {
      // A figure a HUMAN approved and the client has ALREADY been emailed. The
      // agent may read it back; it may not change it, and placeQueuedCall drops
      // it if the quote's total no longer matches what was queued — a figure
      // the client has not received in writing must never be spoken.
      ...(total ? { quoteTotal: total } : {}),
      ...(serviceSummary(quote.lineItems) ? { serviceSummary: serviceSummary(quote.lineItems) } : {}),
    },
  });
}

/**
 * A reviewer approved an instant estimate.
 *
 * Queues nothing on its own any more: until the client has the quote in
 * writing, there is nothing for the agent to refer to and rule 3 would have it
 * inventing a figure. The send below picks it up.
 */
export async function onQuoteApproved(quoteId) {
  return queueApprovedQuoteCall(quoteId);
}

/**
 * The quote was actually emailed — Resend accepted it and `sentAt` is written.
 *
 * The usual order (approve, then send) means this is the call that queues it.
 * The reverse order happens too — a quote sent, then adjusted and re-approved —
 * which is why both moments run the same gate rather than one of them assuming
 * the other already happened.
 */
export async function onQuoteEmailed(quoteId) {
  return queueApprovedQuoteCall(quoteId);
}

/**
 * An in-person visit was booked — queue a reminder call for the day before.
 *
 * Only for visits (a phone consult doesn't need a "still coming?" call), only
 * when the company opted into outbound calls, and only when there's time for a
 * reminder to be worth placing. Consent is a `booking` row the confirm route
 * writes; placeQueuedCall checks it at dial time like every other call.
 */
export async function onBookingConfirmed({ bookingId }) {
  if (!bookingId) return null;

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      mode: true,
      startTime: true,
      clientName: true,
      appointment: {
        select: {
          clientId: true,
          companyId: true,
          company: { select: { outboundCallsEnabled: true, timezone: true } },
          client: { select: { phone: true } },
        },
      },
    },
  });

  const appt = booking?.appointment;
  if (!appt) return null;
  if (booking.mode !== "visit") return null;
  if (!appt.company?.outboundCallsEnabled) return null;
  if (!appt.client?.phone) return null;

  const timing = reminderTiming(booking.startTime);
  if (timing.skip) return null;

  return enqueueOutbound({
    companyId: appt.companyId,
    purpose: "appointment_reminder",
    clientId: appt.clientId,
    bookingId: booking.id,
    notBefore: timing.notBefore,
    context: {
      appointmentWhen: describeAppointmentTime(booking.startTime, {
        timezone: appt.company.timezone,
      }),
    },
  });
}

/**
 * A fresh lead came in who asked to be contacted — queue the "someone will call
 * you shortly" call the intake form promised.
 *
 * Gated on the company having opted into outbound calls; the lead's own consent
 * (the disclosure they saw on the form) is a `self_quote` row and is checked at
 * dial time. A lead with no phone or name is skipped — there's nothing to dial
 * or greet.
 */
export async function onLeadCreated(leadId) {
  if (!leadId) return null;

  const lead = await db.leadRequest.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      phone: true,
      name: true,
      companyId: true,
      company: { select: { outboundCallsEnabled: true } },
    },
  });

  if (!lead) return null;
  if (!lead.company?.outboundCallsEnabled) return null;
  if (!lead.phone || !lead.name) return null;

  return enqueueOutbound({
    companyId: lead.companyId,
    purpose: "lead_follow_up",
    leadId: lead.id,
  });
}
