// lib/booking/bookingLead.js
//
// A booking with no enquiry behind it is still a lead.
//
// ══ Why (2026-10-05) ═══════════════════════════════════════════════════════
//
// Someone who books an estimate straight on the company's booking page — or
// with the AI receptionist or the AI employee — without ever sending an
// enquiry never entered the lead funnel. The agency metrics and Marketing
// results start from LeadRequest (lib/agency/leadFacts.js), so the most
// committed visitors of all, the ones who booked a visit on their own, were
// missing from "leads", "appointments" and "closes" alike.
//
// ══ What happens ═══════════════════════════════════════════════════════════
//
// When a booking is confirmed (the free booking page path, the paid path once
// the fee settles, and the AI booking), ensureBookingLead:
//
//   * links the booking to the lead that already exists for this person —
//     the same email or phone (on the booking or on the client it landed on),
//     or the estimate the booking came from — created in the last 180 days.
//     No second lead, ever, for someone who already enquired;
//   * otherwise creates one through createScoredLead — the normal intake and
//     scoring every inbound lead gets — with source "booking_page" (or the AI
//     channel's own source for an AI booking), the booker's own "when do you
//     need this done?" answer as its timeline (scored) and intake.whenNeeded
//     (shown), the booking's notes as the
//     message, its service as the category, and the booking page visit's
//     landing (UTMs, the ad click — lib/tracking/attribution.js) as its
//     attribution, so an ad that brought a booker is credited.
//
// No notification: the booking already told the company (the confirmation,
// the calendar, the assignee's Google Calendar). A "New enquiry" bell for the
// same person a minute later would be the same news twice, so the lead is
// created with `notify: false`. The marketing agency's lead.created event
// still goes — that is the point.
//
// Best-effort by contract: the booking is what the person came to do, and a
// lead that could not be written must never cost them it. Every failure is
// logged and returned as `{ action: "failed" }`, never thrown.

import { db as realDb } from "@/lib/db";
import { normaliseEmail, normalisePhone } from "@/lib/sales/suppressionRules";
import { whenNeededFromNotes } from "@/lib/leads/tradeQuestions";
import { buildLeadIntake } from "@/lib/leads/intakeShape";

export const BOOKING_LEAD_WINDOW_DAYS = 180;
const DAY = 24 * 60 * 60 * 1000;
/** The most recent leads one booking is compared against. */
const CANDIDATE_LIMIT = 5000;

/**
 * The lead source for a booking: "booking_page" for one the person made on
 * the web; the AI channel's own source for one an AI took, so a phone booking
 * is reported as the phone, never as the website. Pure.
 */
export function bookingLeadSource(booking) {
  if (booking?.source === "phone_assistant") return "phone_agent";
  if (booking?.source === "ai_employee") return "ai_employee";
  return "booking_page";
}

/** Email and phone keys, normalised, from any number of contact records. Pure. */
export function contactKeysOf(...records) {
  const emails = new Set();
  const phones = new Set();
  for (const r of records) {
    if (!r) continue;
    const e = normaliseEmail(r.email);
    if (e) emails.add(e);
    const p = normalisePhone(r.phone);
    if (p) phones.add(p);
  }
  return { emails, phones };
}

/**
 * The existing lead this booking belongs to, or null. Pure.
 *
 * A lead counts when it was created in the last 180 days and it is the same
 * person: the estimate the booking came from, or the same email, or the same
 * phone — normalised, never a name alone. The most recent match wins.
 *
 * @param leads    { id, companyId, email, phone, quoteId, createdAt }[]
 * @param keys     contactKeysOf(booking, client)
 */
export function findBookingLead({ leads, companyId, keys, quoteId = null, now = new Date() }) {
  const floor = now.getTime() - BOOKING_LEAD_WINDOW_DAYS * DAY;
  const matches = (Array.isArray(leads) ? leads : []).filter((l) => {
    if (!l || l.companyId !== companyId) return false;
    const at = new Date(l.createdAt).getTime();
    if (!Number.isFinite(at) || at < floor) return false;
    if (quoteId && l.quoteId === quoteId) return true;
    const e = normaliseEmail(l.email);
    if (e && keys.emails.has(e)) return true;
    const p = normalisePhone(l.phone);
    return Boolean(p && keys.phones.has(p));
  });
  matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return matches[0] || null;
}

/**
 * The booker's own answer to "when do you need this done?", for the lead:
 * the cleaned answer when the caller has it (the free path, in the same
 * request), else read back from the booking's notes (the paid path, which
 * settles later — lib/leads/tradeQuestions.js whenNeededFromNotes). Null
 * for a booking that never asked (an AI booking). Pure.
 *
 * The owner, 2026-10-05: it is the client's own answer, so the score uses
 * it — LeadRequest.timeline, the 35-point factor — and the lead card shows
 * it (intake.whenNeeded, the key the instant estimate already writes).
 */
export function bookingWhen(booking, when = null) {
  if (when && typeof when === "object" && when.whenNeeded && when.timeline) return { whenNeeded: when.whenNeeded, timeline: when.timeline };
  return whenNeededFromNotes(booking?.serviceKey || "", booking?.notes || "");
}

/**
 * Link the booking to its lead, or create the lead. Never throws.
 *
 * @param p.booking      the Booking row (id, clientName, clientEmail,
 *                       clientPhone, language, notes, serviceKey, quoteId,
 *                       source, leadRequestId)
 * @param p.companyId
 * @param p.clientId     the Client the booking landed on, if known
 * @param p.attribution  the booking page visit's landing, or null
 * @param p.when         { whenNeeded, timeline } from cleanTradeAnswers, when
 *                       the caller has it; else read from the notes
 * @param p.deps         { db, createLead } — a check passes its own
 * @returns {Promise<{ action: "already"|"linked"|"created"|"failed", leadId?: string }>}
 */
export async function ensureBookingLead({ booking, companyId, clientId = null, attribution = null, when = null, now = new Date(), deps = {} } = {}) {
  const db = deps.db || realDb;
  try {
    if (!booking?.id || !companyId) return { action: "failed", reason: "missing" };
    if (booking.leadRequestId) return { action: "already", leadId: booking.leadRequestId };

    const client = clientId
      ? await db.client.findFirst({ where: { id: clientId, companyId }, select: { email: true, phone: true } })
      : null;
    const keys = contactKeysOf({ email: booking.clientEmail, phone: booking.clientPhone }, client);
    const leads = await db.leadRequest.findMany({
      where: { companyId, createdAt: { gte: new Date(now.getTime() - BOOKING_LEAD_WINDOW_DAYS * DAY) } },
      select: { id: true, companyId: true, email: true, phone: true, quoteId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: CANDIDATE_LIMIT,
    });
    const existing = findBookingLead({ leads, companyId, keys, quoteId: booking.quoteId || null, now });
    if (existing) {
      await db.booking.update({ where: { id: booking.id }, data: { leadRequestId: existing.id }, select: { id: true } });
      return { action: "linked", leadId: existing.id };
    }

    // Nothing to reach them on is not a lead anybody can work.
    if (!keys.emails.size && !keys.phones.size) return { action: "failed", reason: "no_contact" };

    const category = booking.serviceKey
      ? await db.serviceCategory.findFirst({ where: { key: booking.serviceKey }, select: { id: true } })
      : null;
    const createLead = deps.createLead || (await import("@/lib/leads/createLead")).createScoredLead;
    const answered = bookingWhen(booking, when);
    const intake = buildLeadIntake({
      address: booking.address || undefined,
      // The option they tapped, so the lead card prints its label; null when
      // the booking never asked (buildLeadIntake drops it).
      details: { whenNeeded: answered?.whenNeeded || null },
    });
    const lead = await createLead({
      companyId,
      name: booking.clientName || "Booking",
      email: booking.clientEmail || undefined,
      phone: booking.clientPhone || undefined,
      categoryId: category?.id || undefined,
      message: booking.notes || undefined,
      source: bookingLeadSource(booking),
      language: booking.language || undefined,
      // The booker's own "when do you need this done?" — scored, like every
      // channel that asked it (lib/leads/qualifiers.js ASKED_BY_SOURCE).
      ...(answered?.timeline ? { timeline: answered.timeline } : {}),
      ...(intake ? { intake } : {}),
      ...(attribution && typeof attribution === "object" ? { attribution } : {}),
      // The booking already told the company; see the header.
      notify: false,
    });
    if (!lead?.id) return { action: "failed", reason: "not_created" };
    await db.booking.update({ where: { id: booking.id }, data: { leadRequestId: lead.id }, select: { id: true } });
    return { action: "created", leadId: lead.id };
  } catch (err) {
    console.error("[booking] lead not linked:", booking?.id, err?.message);
    return { action: "failed", reason: "error" };
  }
}
