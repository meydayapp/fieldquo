// lib/schedule/clientNotice.js
//
// Telling the client when the OFFICE moves or cancels their visit.
//
// ── One sender for two kinds of row ────────────────────────────────────────
//
// An Appointment and a JobVisit reach the client's inbox through the same two
// letters the client's own "manage my visit" link sends — the moved letter and
// the cancelled letter in app/admin/lib/email/templates.js — with
// `initiatedBy: "office"` picking the sentence that is true. The letters are
// reused rather than re-described so a client who moved once and was moved
// once reads the same shape twice.
//
// ── The language is the client's, decided by the one rule ──────────────────
//
// lib/i18n/clientLanguage.js: the quote this visit is about, else the client's
// saved language, else the company default. A JobVisit's job came from a quote
// with a fixed language; an Appointment may name one. Either way the office's
// own language never leaks into a letter the client reads.
//
// ── Best-effort by contract ────────────────────────────────────────────────
//
// The row has already changed by the time either of these runs. A Resend
// hiccup is logged and swallowed; the caller must never turn it into "couldn't
// move that", because it did.

import {
  sendVisitRescheduledEmails,
  sendVisitCancelledEmails,
} from "@/app/admin/lib/email/templates";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { emailCopy } from "@/lib/i18n/emailCopy";

/**
 * What to call the visit in the letter.
 *
 * A booking has an event type ("On-site estimate"); a job visit has the job's
 * title; a bare appointment has neither, and gets the catalogue's plain word
 * for a visit in the client's language rather than "undefined with Northline".
 */
export function serviceName({ eventTypeName, jobTitle, language }) {
  const named = String(eventTypeName || jobTitle || "").trim();
  if (named) return named;
  return emailCopy(language)?.visit?.serviceFallback || emailCopy("en").visit.serviceFallback;
}

/**
 * The arrival window the client is promised, if any: the company's setting,
 * for an on-site visit only. A phone or video appointment has no drive to
 * absorb, so its time stays exact — the same rule visitView applies.
 */
export function windowFor(company, mode) {
  return mode && mode !== "visit" ? 0 : company?.arrivalWindowMinutes || 0;
}

/**
 * @param {object} args
 * @param {object} args.company     full Company row (sender, zone, window, default language)
 * @param {object} args.client      { name, email, language } — email absent → nothing sent
 * @param {object} [args.quote]     { language, quoteNumber } when the visit is about one
 * @param {string} [args.eventTypeName]
 * @param {string} [args.jobTitle]
 * @param {Date}   args.previousStartTime
 * @param {Date}   args.startTime
 * @param {string} [args.location]
 * @param {string} [args.mode]      "visit" | "call" | "video"
 * @param {string} [args.manageUrl] the client's own link, when the row has one
 * @returns {Promise<{ sent: boolean, language: string }>}
 */
export async function notifyClientMoved({
  company,
  client,
  quote = null,
  eventTypeName,
  jobTitle,
  previousStartTime,
  startTime,
  location,
  mode = "visit",
  manageUrl = null,
}) {
  const language = resolveClientLanguage({ document: quote, client, company });
  const to = String(client?.email || "").trim();
  if (!to) return { sent: false, language };

  await sendVisitRescheduledEmails({
    company,
    clientName: client?.name || "",
    clientEmail: to,
    eventTypeName: serviceName({ eventTypeName, jobTitle, language }),
    previousStartTime,
    startTime,
    location,
    timezone: company?.timezone,
    arrivalWindowMinutes: windowFor(company, mode),
    manageUrl,
    quoteNumber: quote?.quoteNumber || null,
    language,
    initiatedBy: "office",
  }).catch((err) => console.error("[schedule] moved letter failed:", err?.message));

  return { sent: true, language };
}

/**
 * Same shape as notifyClientMoved. No refund is decided here: an office
 * cancelling a paid booking is a money decision the office makes on the
 * payment itself, and the letter's fee sentence says so honestly (the
 * `feeNotReturned` wording) rather than promising a refund nobody issued.
 */
export async function notifyClientCancelled({
  company,
  client,
  quote = null,
  eventTypeName,
  jobTitle,
  startTime,
  location,
  fee = null,
}) {
  const language = resolveClientLanguage({ document: quote, client, company });
  const to = String(client?.email || "").trim();
  if (!to) return { sent: false, language };

  await sendVisitCancelledEmails({
    company,
    clientName: client?.name || "",
    clientEmail: to,
    eventTypeName: serviceName({ eventTypeName, jobTitle, language }),
    startTime,
    location,
    timezone: company?.timezone,
    quoteNumber: quote?.quoteNumber || null,
    refund: fee
      ? { refunded: false, amountCents: fee.amountCents, currency: fee.currency, reason: "office_cancelled" }
      : {},
    language,
    initiatedBy: "office",
  }).catch((err) => console.error("[schedule] cancelled letter failed:", err?.message));

  return { sent: true, language };
}
