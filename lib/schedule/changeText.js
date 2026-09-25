// lib/schedule/changeText.js
//
// The TEXT that goes with the moved and cancelled letters.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The owner booked with TrueFinish Cabinets and asked (2026-09-20) whether a
// client would hear about it by text if the company moved the visit. They
// would not: the confirmation texted (lib/booking/finalizeBooking.js), but a
// move or a cancel — from the office or from the client's own link — sent the
// letter only (lib/schedule/clientNotice.js, the manage routes). A homeowner
// who gave a phone and no reliable inbox waited at the old time.
//
// ── One set of gates, the confirmation's ───────────────────────────────────
//
// bookingTextVerdict is the confirmation's own verdict, called rather than
// copied: the company's booking-text switch (bookingTextOn — on unless the
// company turned it off; ONE switch for every booking text), a dialable
// phone, and maySms (a STOP, or a call opt-out, always wins). sendSms then
// picks the company's own line or the shared one (clientSmsFrom), simulates
// for a demo tenant (lib/sms/demoSms.js), and opens the delivery row the
// calendar's "Texts" line reads (purpose + ref, model SmsDelivery).
//
// ── Kept out of the letters on purpose ─────────────────────────────────────
//
// The callers already hold the language the letter was written in; they pass
// it here so the text and the letter can never disagree. The letter code is
// untouched — the text is a second, independent best-effort send, and a
// failed text is logged, never a failed move.
//
// ── No double texts ────────────────────────────────────────────────────────
//
// Each action has exactly one path that sends: the office's PATCH writes the
// booking itself (it never calls the client's reschedule route), and the
// client's link writes the appointment itself (it never calls the office's
// PATCH). The retries and double taps that COULD send twice are answered by
// the row's own state, below: a "move" to the time it already had is not a
// move, and cancelling what is already cancelled is not news. There is no
// "changes under N minutes don't count" rule in the letters, so none is
// invented here — a move is a move.
import { db } from "@/lib/db";
import { bookingTextVerdict } from "@/lib/booking/finalizeBooking";
import { sendSms } from "@/lib/sms/twilioClient";
import { clientSmsFrom } from "@/lib/sms/clientLine";
import { renderMessage } from "@/lib/sms/renderTemplate";
import { loadSmsTemplateTranslations } from "@/lib/i18n/companyText";
import { formatWhen } from "@/lib/sms/templates";
import { bookingModeLine } from "@/lib/booking/bookingModes";

/** kind → the message type (and the SmsDelivery purpose). */
export const CHANGE_TEXT_TYPES = Object.freeze({ moved: "booking_moved", cancelled: "booking_cancelled" });

/**
 * The mode line for the text, in the reader's language.
 *
 * A booking's own facts first — "Phone call — we'll ring 819-238-7263" — the
 * same line the confirmation text carried. A row with no booking (a
 * hand-booked appointment, a crew visit on a job) is a visit at its
 * location. A row with neither says nothing about where rather than
 * "address to be confirmed", which would be a claim nobody made.
 */
export function changeTextWhere({ where = null, location = null, language = "en" }) {
  if (where?.mode) return bookingModeLine({ ...where, language });
  const place = typeof location === "string" ? location.trim() : "";
  return place ? bookingModeLine({ mode: "visit", address: place, language }) : null;
}

/**
 * Why this change is not news, or null when it is.
 *
 *   unchanged          — a "move" to the instant it already had (the dialog's
 *                        Move pressed without touching the time, or a
 *                        double-submitted move whose second request found
 *                        the row already moved)
 *   already_cancelled  — cancelling a row that was already cancelled
 */
export function changeTextSkip({ kind, previousStartTime = null, startTime = null, alreadyCancelled = false }) {
  if (kind === "cancelled" && alreadyCancelled) return "already_cancelled";
  if (kind === "moved" && previousStartTime && startTime) {
    const a = new Date(previousStartTime).getTime();
    const b = new Date(startTime).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && a === b) return "unchanged";
  }
  return null;
}

/**
 * The delivery labels for a Booking: the APPOINTMENT when the booking became
 * one — that is the row the calendar draws, so it is where "Moved text:
 * delivered" has to appear — else the booking. The same rule the
 * confirmation text follows. `clientId` comes off the appointment, since a
 * Booking carries no client relation of its own.
 */
export async function bookingTextTarget(booking) {
  if (!booking?.appointmentId) {
    return { ref: { type: "booking", id: booking?.id || null }, clientId: null };
  }
  const appt = await db.appointment
    .findUnique({ where: { id: booking.appointmentId }, select: { clientId: true } })
    .catch(() => null);
  return { ref: { type: "appointment", id: booking.appointmentId }, clientId: appt?.clientId || null };
}

/**
 * Text the client that their appointment or visit moved or was cancelled.
 *
 * @param {object} args
 * @param {"moved"|"cancelled"} args.kind
 * @param {object} args.company   any Company row with `id` — the columns the
 *                                text needs are re-read here, because the
 *                                manage routes load a narrow select
 * @param {string} [args.phone]   the number to text: the booking's, else the
 *                                client's
 * @param {string} args.language  the language the letter went out in
 * @param {Date}   args.startTime the new time (moved) or the cancelled one
 * @param {Date}   [args.previousStartTime]  moved only
 * @param {object} [args.where]   the booking's facts (visitFacts), when any
 * @param {string} [args.location]
 * @param {string} [args.service] what was booked, for the {service} token
 * @param {string} [args.manageUrl] the client's own link, when the row has one
 * @param {object} args.ref       { type: "appointment"|"visit"|"booking", id }
 * @param {string} [args.clientId]
 * @param {boolean} [args.alreadyCancelled]
 * @returns {Promise<{ texted: boolean, reason: string }>}
 */
export async function textClientOfChange({
  kind,
  company,
  phone = null,
  language = "en",
  startTime,
  previousStartTime = null,
  where = null,
  location = null,
  service = null,
  manageUrl = null,
  ref = null,
  clientId = null,
  alreadyCancelled = false,
}) {
  try {
    const type = CHANGE_TEXT_TYPES[kind];
    if (!type || !company?.id) return { texted: false, reason: "bad_request" };

    const skip = changeTextSkip({ kind, previousStartTime, startTime, alreadyCancelled });
    if (skip) return { texted: false, reason: skip };

    const verdict = await bookingTextVerdict({ company, booking: { clientPhone: phone } });
    if (!verdict.send) return { texted: false, reason: verdict.reason };

    const row = await db.company.findUnique({
      where: { id: company.id },
      select: {
        id: true,
        name: true,
        phone: true,
        timezone: true,
        defaultLanguage: true,
        smsTemplates: true,
        smsFromNumber: true,
      },
    });
    if (!row) return { texted: false, reason: "no_company" };

    const when = (at) => (at ? formatWhen(at, { language, timezone: row.timezone }) : "");
    const result = await sendSms({
      to: verdict.to,
      body: renderMessage({
        type,
        templates: row.smsTemplates,
        language,
        templateLanguage: row.defaultLanguage || "en",
        // The company's wording in THIS client's language, when its draft
        // exists (lib/i18n/autoTranslate.js) — else the built-in text.
        translatedTemplates: await loadSmsTemplateTranslations(db, row, { companyId: row.id, language }),
        values: {
          company: row.name,
          service: String(service || "").trim(),
          when: when(startTime),
          ...(kind === "moved" && { previous: when(previousStartTime), link: manageUrl || null }),
          where: changeTextWhere({ where, location, language }),
          phone: row.phone || null,
        },
      }),
      from: clientSmsFrom(row),
      companyId: row.id,
      purpose: type,
      ref,
      clientId,
    });
    if (!result?.success) {
      console.error(`[schedule] ${kind} text failed:`, result?.error);
      return { texted: false, reason: "send_failed" };
    }
    return { texted: true, reason: "ok" };
  } catch (err) {
    console.error(`[schedule] ${kind} text failed:`, err?.message);
    return { texted: false, reason: "send_failed" };
  }
}
