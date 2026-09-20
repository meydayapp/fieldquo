// lib/booking/bookingInvite.js
//
// The calendar invite (.ics) a client gets with their booking — so it lands
// in their Google, Apple or Outlook calendar with one tap, in the mode they
// chose and the language they read.
//
// ══ One UID, a rising SEQUENCE ═════════════════════════════════════════════
//
// The confirmation letter attaches METHOD:REQUEST with a UID fixed per
// booking. A move attaches the SAME UID with SEQUENCE one higher, which is
// what makes a mail client replace the event it already holds rather than
// add a second beside it; a cancellation attaches METHOD:CANCEL with that
// UID, which is what makes the event drop off. The count lives on the row
// (Booking.calendarSequence) and is bumped in the write that moves or
// cancels — see bumpSequence — because a number the sender guesses is a
// number two senders guess differently.
//
// ══ Pure builder, thin resolver ════════════════════════════════════════════
//
// buildBookingInvite takes plain values and returns the .ics text, so
// scripts/check-booking-modes.mjs can assert the UID, the SEQUENCE, the
// METHOD and the SUMMARY without a database. bookingInviteAttachment is the
// one async step — the company's sender address — wrapped for the three
// letters and the manage page's download.

import { buildIcs } from "@/lib/calendar/ics";
import { resolveSender } from "@/lib/email/companySender";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { formatMoney } from "@/lib/currency";
import {
  bookingModeLabel,
  bookingModeLine,
  bookingModeCopy,
  bookingFeeLine,
} from "@/lib/booking/bookingModes";

const PROD_ID = "-//FieldQuo//Booking//EN";

/** The one UID this booking's event ever has. */
export function bookingIcsUid(bookingId) {
  return `booking-${bookingId}@fieldquo.com`;
}

/** The address inside "Name <addr>" or a bare address. */
function addressOf(from) {
  const m = String(from || "").match(/<([^>]+)>/);
  return (m ? m[1] : String(from || "")).trim() || null;
}

/**
 * The .ics text for one booking.
 *
 * @param {object} p.booking   id, startTime, endTime, mode, address,
 *                             clientName, clientEmail, clientPhone,
 *                             feePaidCents, feeCurrency, calendarSequence
 * @param {object} p.company   name, currency
 * @param {string} p.language  the client's — the SUMMARY is in it
 * @param {"REQUEST"|"CANCEL"} [p.method]
 * @param {number} [p.sequence]  defaults to the row's calendarSequence
 * @param {string} [p.manageUrl] the client's own link, in the DESCRIPTION
 * @param {string} [p.organizerEmail] the company's sender address
 * @param {Date}   [p.dtstamp]
 */
export function buildBookingInvite({
  booking,
  company,
  language = "en",
  method = "REQUEST",
  sequence,
  manageUrl = null,
  organizerEmail = null,
  dtstamp = new Date(),
}) {
  const mode = booking?.mode || "visit";
  const copy = bookingModeCopy(language);
  const line = bookingModeLine({
    mode,
    address: booking?.address,
    phone: booking?.clientPhone,
    email: booking?.clientEmail,
    language,
  });
  const fee = bookingFeeLine({
    amountText:
      Number(booking?.feePaidCents) > 0
        ? formatMoney(Number(booking.feePaidCents) / 100, booking.feeCurrency || company?.currency)
        : null,
    language,
  });
  // The change/cancel sentence the letter carries, from the letter's own
  // copy pack, so the calendar entry says what the email said.
  const visit = emailCopy(language).visit || {};
  const change = manageUrl ? visit.changeViaLink : visit.changeViaReply;
  const description = [line, fee, manageUrl, change].filter(Boolean).join("\n");

  // LOCATION is a place for a visit and a number for a call — a mail client
  // draws a map pin from this field, and "Phone call" is not a place.
  const location =
    mode === "visit"
      ? booking?.address || null
      : mode === "call"
        ? booking?.clientPhone
          ? `${copy.phoneWord}: ${booking.clientPhone}`
          : null
        : null;

  return buildIcs({
    uid: bookingIcsUid(booking.id),
    start: booking.startTime,
    end: booking.endTime,
    summary: `${bookingModeLabel(mode, language)} — ${company?.name || ""}`.trim(),
    description,
    location,
    organizerName: company?.name || null,
    organizerEmail,
    attendeeName: booking?.clientName || null,
    attendeeEmail: booking?.clientEmail || null,
    dtstamp,
    method,
    sequence: sequence ?? booking?.calendarSequence ?? 0,
    prodId: PROD_ID,
  });
}

/** Resend's attachment shape for the .ics, or null when it cannot be built. */
export function inviteAttachment(ics, { cancelled = false } = {}) {
  if (!ics) return null;
  return {
    filename: cancelled ? "cancelled.ics" : "booking.ics",
    content: Buffer.from(ics).toString("base64"),
    contentType: `text/calendar; method=${cancelled ? "CANCEL" : "REQUEST"}`,
  };
}

/**
 * The attachment for a letter: the .ics with the company's sender as the
 * ORGANIZER. Best-effort — a sender that cannot be resolved still yields an
 * invite (without an organizer, the client's calendar shows it as an
 * event rather than an invitation), and a thrown error yields null so the
 * letter goes without it rather than not at all.
 */
export async function bookingInviteAttachment({ booking, company, language, method = "REQUEST", sequence, manageUrl }) {
  try {
    let organizerEmail = null;
    try {
      const sender = await resolveSender(company || {}, company?.id);
      organizerEmail = addressOf(sender?.from);
    } catch {
      organizerEmail = null;
    }
    const ics = buildBookingInvite({ booking, company, language, method, sequence, manageUrl, organizerEmail });
    return inviteAttachment(ics, { cancelled: method === "CANCEL" });
  } catch (err) {
    console.error("[booking] calendar invite unavailable:", err?.message);
    return null;
  }
}

/**
 * The next SEQUENCE, for a write that moves or cancels the row. The caller
 * stores it (`calendarSequence: next`) in the same update and sends the
 * invite with it, so the number on the row and the number in the client's
 * calendar can never disagree.
 */
export function nextSequence(booking) {
  const n = Number(booking?.calendarSequence);
  return (Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0) + 1;
}
