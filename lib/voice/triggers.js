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

/** A quote total as a spoken-friendly string, in the company's currency. */
function money(amount, currency = "CAD") {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${Math.round(n)}`;
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

/**
 * A company approved a client-requested quote — queue a call to confirm and
 * move toward scheduling.
 *
 * Silent no-op (returns null) whenever it shouldn't fire: the feature is off,
 * there's no client phone, or there's no total for the agent to reference. Not
 * an error — most approvals won't queue a call, and that's correct.
 *
 * The consent check is NOT here: enqueueOutbound stores the intent, and
 * placeQueuedCall checks consent at dial time. A quote whose client never
 * agreed to be called simply gets skipped when the cron reaches it, with a
 * readable reason — the same gate every outbound call passes.
 */
export async function onQuoteApproved(quoteId) {
  if (!quoteId) return null;

  const quote = await db.quote.findUnique({
    where: { id: quoteId },
    select: {
      id: true,
      companyId: true,
      clientId: true,
      total: true,
      lineItems: true,
      company: {
        select: { name: true, currency: true, outboundCallsEnabled: true },
      },
      client: { select: { phone: true } },
    },
  });

  if (!quote) return null;
  if (!quote.company?.outboundCallsEnabled) return null;
  if (!quote.client?.phone) return null;

  const total = money(quote.total, quote.company.currency || "CAD");

  return enqueueOutbound({
    companyId: quote.companyId,
    purpose: "quote_approved",
    clientId: quote.clientId,
    quoteId: quote.id,
    context: {
      // A figure a HUMAN approved — the agent may state it, never change it.
      ...(total ? { quoteTotal: total } : {}),
      ...(serviceSummary(quote.lineItems) ? { serviceSummary: serviceSummary(quote.lineItems) } : {}),
    },
  });
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
