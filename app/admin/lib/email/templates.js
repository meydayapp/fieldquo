// app/admin/lib/email/templates.js
//
// One-off transactional emails that aren't driven by a company's editable
// DocumentTemplate blocks. Anything a company should be able to reword
// belongs in Settings > Email Templates instead — this file is for mail with
// fixed, functional content.
//
// This module was previously empty while booking/[companySlug]/confirm
// imported from it, which broke the production build. Dev never noticed,
// because Next only compiles a route once something requests it.
//
// ── One layout, four letters ───────────────────────────────────────────────
//
// Confirming a booking, cancelling one and moving one are the same letter with
// different words in it, and the company's copy of each is the same letter
// again addressed to the other side. They share `bookingEmailShell` rather than
// four pasted tables: the pasted one is always the one that rots, because it is
// the one nobody looks at. The shell renders exactly what the confirmation
// email rendered before it existed.
//
// ── The words come from the catalogue, in the client's language ────────────
//
// These letters were English with an en-US date while the quote they were
// about had been translated — the exact failure lib/i18n/emailCopy.js was
// written to end, one letter later. Every sentence now comes from
// emailCopy(language).visit and the date is formatted in that language's
// locale, so the confirmation, the move and the cancellation are one language,
// all three at once. Nobody here decides WHICH language: callers resolve it
// with lib/i18n/clientLanguage.js (the quote's language, then the client's,
// then the company's) and pass it down. Omitted, it is English — the same
// fallback emailCopy() makes, so an unknown code still produces a sendable
// letter rather than a failed send.
//
// ── Who made the change is part of the sentence ────────────────────────────
//
// "has been cancelled, as requested" is true when the client pressed the
// button on their own link and false when the office pressed it on the
// calendar. `initiatedBy` picks the sentence; and when the office made the
// change the office does not also get a letter telling it so — the company
// copy is for hearing about something a client did.

import { sendEmail } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { describeWindow, letterLocale } from "@/lib/booking/arrivalWindow";
import { formatMoney } from "@/lib/currency";
import { emailCopy, EMAIL_COPY } from "@/lib/i18n/emailCopy";
import { bookingModeLine, bookingModeLabel, bookingModeNoun, bookingFeeLine, bookingModeCopy } from "@/lib/booking/bookingModes";

/**
 * How a letter describes the appointment, given what it knows.
 *
 * `where` is the booking's own facts — { mode, address, phone, email } — and
 * when it is there, each letter builds its line in ITS language: the client's
 * copy in the client's, the office's copy in the office's. A single
 * preformatted `location` string cannot do that, which is why the older
 * argument stays only as the fallback for a hand-booked appointment
 * (app/api/appointments, lib/schedule/clientNotice) that has no mode to name.
 *
 * With a mode, the subject and the intro name the MODE ("Confirmed: On-site
 * visit with Northline", "Your phone call with Northline is confirmed") and
 * the service moves to a row of its own; without one they name the service as
 * they always did. The owner's complaint was exactly that the letter said
 * "Consultation" and never which kind.
 */
function describeAppointment({ where, location, eventTypeName, language }) {
  const mode = where?.mode;
  if (!mode) return { subjectName: eventTypeName, introName: eventTypeName, whereLine: location, whatRow: null };
  return {
    subjectName: bookingModeLabel(mode, language),
    introName: bookingModeNoun(mode, language),
    whereLine: bookingModeLine({ ...where, language }),
    whatRow: eventTypeName || null,
  };
}

/**
 * The letter's sentences, for one language.
 *
 * Merged over English PER KEY rather than per block: emailCopy() merges the
 * top level only, so a language whose `visit` block was missing one key would
 * otherwise render "undefined" in the middle of a letter — the exact bug that
 * function's own comment describes, one level down.
 */
function visitCopy(language) {
  const dict = emailCopy(language);
  return { ...EMAIL_COPY.en.visit, ...(dict.visit || {}), greeting: dict.greeting };
}

/**
 * "Tuesday, August 12 at 2:00 PM EDT", in the reader's locale and the
 * company's zone.
 *
 * The locale comes from the same map describeWindow uses, so the exact time
 * and the arrival window on one letter are spelled by one rule; this used to
 * hardcode en-US, which for English is still what that map says.
 */
function formatWhen(startTime, timezone, language = "en") {
  const locale = letterLocale(language);
  try {
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(timezone && { timeZone: timezone }),
      timeZoneName: "short",
    }).format(new Date(startTime));
  } catch {
    // An invalid timezone string shouldn't cost someone their confirmation
    // email — fall back to the raw date rather than throwing.
    return new Date(startTime).toString();
  }
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Escaping for a value that lands inside an HTML attribute — quotes included.
 *
 * esc() alone is right for text and wrong for `href="…"`. The manage link is
 * built from getAppOrigin(request), which falls back to the x-forwarded-host /
 * host header when NEXT_PUBLIC_APP_URL isn't set, so a quote in that header
 * would otherwise close the attribute and let a stranger add their own inside
 * an email sent under the contractor's name.
 */
function escAttr(value) {
  return esc(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * The shared booking letter.
 *
 * @param {string}   companyName
 * @param {string}   headline   the <h1>. HTML, not text: the callers esc() the
 *                              catalogue sentence before passing it, so a
 *                              translation containing an apostrophe or an
 *                              ampersand renders as written.
 * @param {string[]} intro      paragraph lines, joined with a blank line. Also
 *                              HTML: callers esc() every line, values included.
 * @param {Array}    rows       [{ label, value }] — falsy values are dropped,
 *                              so an absent address leaves no empty row
 * @param {object}  [action]    { url, label } — the manage-this-visit button
 * @param {string}  [footnote]  closing line
 *
 * Colours are fixed, NOT taken from the company's brand hex. Deliberate: this
 * is the one surface where a mid-tone brand colour behind white button text
 * would ship unmeasured, and the white-on-#1A1917 pairing here is the same one
 * the header bar already uses (≈17:1). If these letters ever go brand-coloured
 * they should do it through lib/documents/theme.js, not by interpolating a hex.
 */
function bookingEmailShell({ companyName, headline, intro, rows, action, footnote }) {
  const rowsHtml = (rows || [])
    .filter((r) => r && r.value)
    .map(
      (r, i) => `<tr>
                <td style="padding:14px 16px;${i ? "border-top:1px solid #eadfd4;" : ""}font-size:13px;color:#6b5d52;">${esc(r.label)}</td>
                <td style="padding:14px 16px;${i ? "border-top:1px solid #eadfd4;" : ""}font-size:15px;color:#2d2520;font-weight:700;text-align:right;">${esc(r.value)}</td>
              </tr>`,
    )
    .join("\n              ");

  const actionHtml = action?.url
    ? `<table cellpadding="0" cellspacing="0" role="presentation" style="margin:0 0 22px;">
              <tr><td style="border-radius:8px;background:#1A1917;">
                <a href="${escAttr(action.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(action.label)}</a>
              </td></tr>
            </table>`
    : "";

  return `<!DOCTYPE html>
<html>
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:24px 12px;background:#F8F4EF;font-family:Arial,Helvetica,sans-serif;color:#2d2520;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background:#ffffff;border:1px solid #eadfd4;border-radius:10px;overflow:hidden;">
          <tr><td style="background:#1A1917;padding:22px 30px;">
            <span style="color:#ff5a00;font-size:13px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;">${esc(companyName)}</span>
          </td></tr>
          <tr><td style="padding:30px;">
            <h1 style="margin:0 0 12px;font-size:25px;line-height:1.3;font-weight:700;color:#2d2520;">${headline}</h1>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.75;color:#6b5d52;">
              ${(intro || []).join("<br/><br/>\n              ")}
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 22px;background:#F8F4EF;border:1px solid #eadfd4;border-radius:10px;">
              ${rowsHtml}
            </table>
            ${actionHtml}
            <p style="margin:0;font-size:15px;line-height:1.75;color:#6b5d52;">
              ${esc(footnote)}
            </p>
          </td></tr>
          <tr><td style="background:#F8F4EF;border-top:1px solid #eadfd4;padding:20px 30px;font-size:11px;line-height:1.6;color:#6b5d52;">
            ${esc(companyName)}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/**
 * "About your estimate Q-2026-0007" — which of their jobs this visit is for.
 *
 * Returns an ARRAY so it spreads into `intro` and disappears entirely when
 * there's no reference: a visit booked off the booking page rather than off a
 * quote must not say "About your estimate undefined", and Booking.quoteId is
 * null for most bookings. Same shape in all three letters so the homeowner
 * reads the same sentence in the confirmation, the cancellation and the move.
 */
function aboutQuoteLine(quoteNumber, copy) {
  const ref = String(quoteNumber ?? "").trim();
  return ref ? [esc(copy.aboutQuote(ref))] : [];
}

/**
 * The same sentence for whatever a hand-booked appointment is about —
 * "About your job: Kitchen repaint." / "About your invoice INV-0088." — from
 * the label lib/schedule/appointmentAbout.js aboutLabel() builds, so the
 * letter names the record exactly the way the calendar card does. A quote
 * label goes through aboutQuoteLine, so the older `quoteNumber` argument and
 * this one can never print two sentences about the same estimate: the label
 * wins when both are given, because it is the newer, more specific fact.
 *
 * @param {{ kind: string, ref?: string, title?: string } | null} about
 */
function aboutLine({ about, quoteNumber }, copy) {
  if (about?.kind === "job") {
    const title = String(about.title ?? "").trim();
    return title ? [esc(copy.aboutJob(title))] : [];
  }
  if (about?.kind === "invoice") {
    const ref = String(about.ref ?? "").trim();
    return ref ? [esc(copy.aboutInvoice(ref))] : [];
  }
  if (about?.kind === "quote") return aboutQuoteLine(about.ref, copy);
  return aboutQuoteLine(quoteNumber, copy);
}

/** "the $120.00 visit fee" — or nothing at all when no fee was taken. */
function feeAmount(cents, currency) {
  const n = Number(cents) || 0;
  if (n <= 0) return null;
  return formatMoney(n / 100, currency);
}

/**
 * Confirms a booking made through a company's public booking page.
 *
 * @param {object}  params
 * @param {string}  params.to            client's email
 * @param {string}  params.companyName
 * @param {string}  params.clientName
 * @param {string}  params.eventTypeName e.g. "On-site estimate"
 * @param {Date}    params.startTime
 * @param {string} [params.location]
 * @param {string} [params.timezone]     IANA zone for display
 * @param {string} [params.manageUrl]    the client's own link to this booking.
 *                                       Absent for bookings made before manage
 *                                       tokens existed, and when the origin
 *                                       can't be resolved — the letter then
 *                                       falls back to "reply to this email"
 *                                       rather than printing a dead button.
 * @param {string} [params.quoteNumber]  the estimate this visit is about, e.g.
 *                                       "Q-2026-0007" (Booking.quoteId → the
 *                                       quote's number). Absent renders nothing.
 * @param {object} [params.company]      full Company row, when available, so
 *                                       the mail sends from a verified domain
 */
export function buildBookingConfirmationEmail({
  companyName,
  clientName,
  eventTypeName,
  startTime,
  location,
  where = null,
  // What was paid to book, as { cents, currency } — 0 for a free booking.
  // Only a letter with a mode prints it ("$49 paid" / "No charge"): the
  // owner's point was that not every consultation costs the same, so the
  // letter says which this one did. Absent (a hand-booked appointment) says
  // nothing about money, as before.
  feePaid = null,
  timezone,
  arrivalWindowMinutes,
  manageUrl,
  quoteNumber,
  about = null,
  language = "en",
}) {
  const copy = visitCopy(language);
  const named = describeAppointment({ where, location, eventTypeName, language });
  const feeRow =
    where?.mode && feePaid
      ? {
          label: bookingModeCopy(language).feeLabel,
          value: bookingFeeLine({
            amountText: Number(feePaid.cents) > 0 ? formatMoney(Number(feePaid.cents) / 100, feePaid.currency) : null,
            language,
          }),
        }
      : null;

  // ── Window if the company set one, exact time otherwise ──────────────────
  //
  // describeWindow returns null when windows are off, so this falls straight
  // through to the formatting that was already here rather than to a second,
  // divergent copy of it. Only the CLIENT sees the window; the crew's own
  // schedule keeps the real time. See lib/booking/arrivalWindow.js.
  const when =
    describeWindow(startTime, arrivalWindowMinutes, { timezone, language }) ||
    formatWhen(startTime, timezone, language);

  const html = bookingEmailShell({
    companyName,
    headline: esc(copy.confirmedHeadline),
    intro: [
      esc(copy.greeting(clientName)),
      esc(copy.confirmedIntro(named.introName, companyName)),
      ...aboutLine({ about, quoteNumber }, copy),
    ],
    rows: [
      { label: copy.what, value: named.whatRow },
      { label: copy.when, value: when },
      { label: copy.where, value: named.whereLine },
      ...(feeRow ? [feeRow] : []),
    ],
    ...(manageUrl && { action: { url: manageUrl, label: copy.manageCta } }),
    footnote: manageUrl ? copy.changeViaLink : copy.changeViaReply,
  });

  return { subject: copy.confirmedSubject(named.subjectName, companyName), html };
}

// `attachments` is the calendar invite (lib/booking/bookingInvite.js) when
// the caller built one — the client's copy only, since the office's calendar
// already holds the appointment. Passed through untouched; this file words
// letters and never decides what rides with them.
export async function sendBookingConfirmationEmail({ to, company, attachments, ...rest }) {
  const { subject, html } = buildBookingConfirmationEmail(rest);

  return sendEmail({
    ...(Array.isArray(attachments) && attachments.length && { attachments }),
    // The tenant, so a demo company's booking confirmation is simulated rather
    // than mailed to whoever booked. Every caller passes the full row (see
    // lib/booking/finalizeBooking.js and app/api/visit/[token]/*) — a partial
    // `{ name }` would leave this undefined and the send real, which is why
    // sendEmail is given the ID rather than a boolean somebody computed here.
    companyId: company?.id,
    to,
    subject,
    html,
    // Uses the company's verified domain when the full row is passed, and
    // otherwise the DISCOVERED platform sender under the company's display
    // name — resolveSender, not the sync senderFor, which with no platform
    // sender falls back to Resend's sandbox address, and Resend refuses that
    // for any recipient but the account's own. The owner booked a visit with
    // a demo company on 2026-09-20 and got no confirmation for exactly this
    // reason: 27 "resend_rejected" rows since July, all from this path and
    // the moved/cancelled letters below.
    ...(await resolveSender(company || { name: rest.companyName }, company?.id)),
  });
}

/**
 * Both letters that go out when a client cancels a visit themselves.
 *
 * Client and company are sent in one call because they are one event: a
 * cancellation the contractor never hears about is a van in a driveway. Each
 * send is caught separately, so the company still finds out when the client's
 * address bounces (and the reverse).
 *
 * Best-effort by contract — the caller must treat a rejected send as noise, not
 * as a failed cancellation. The visit is already cancelled by the time this
 * runs.
 *
 * @param {object}  params.company        full Company row (name/email/sender)
 * @param {object}  params.refund         { refunded, amountCents, currency, reason }
 *                                        The VERDICT, decided by
 *                                        lib/booking/changePolicy.js and the
 *                                        route that acted on it. This file only
 *                                        words it — it must never work out for
 *                                        itself whether the fee comes back.
 * @param {string} [params.quoteNumber]   the estimate this visit was about
 */
export function buildVisitCancelledEmails({
  company,
  clientName,
  clientEmail,
  eventTypeName,
  startTime,
  location,
  where = null,
  timezone,
  refund = {},
  quoteNumber,
  about = null,
  language = "en",
  initiatedBy = "client",
}) {
  const companyName = company?.name || "";
  const copy = visitCopy(language);
  const named = describeAppointment({ where, location, eventTypeName, language });
  const when = formatWhen(startTime, timezone, language);
  const amount = feeAmount(refund.amountCents, refund.currency || company?.currency);
  const byOffice = initiatedBy === "office";

  // Three honest sentences, never "a refund is on its way" when it isn't. The
  // no_payment_intent case is deliberately worded as something a person will
  // deal with, because a person has to.
  const feeLine = !amount
    ? null
    : refund.refunded
      ? copy.feeRefunded(amount)
      : refund.reason === "already_refunded"
        ? copy.feeAlreadyRefunded(amount)
        : refund.reason === "no_payment_intent"
          ? copy.feeNotThroughSystem(amount)
          : copy.feeNotReturned(amount);

  const clientHtml = bookingEmailShell({
    companyName,
    headline: esc(copy.cancelledHeadline),
    intro: [
      esc(copy.greeting(clientName)),
      esc(
        byOffice
          ? copy.cancelledByOffice(named.introName, companyName)
          : copy.cancelledByYou(named.introName, companyName),
      ),
      ...aboutLine({ about, quoteNumber }, copy),
      ...(feeLine ? [esc(feeLine)] : []),
    ],
    rows: [
      { label: copy.what, value: named.whatRow },
      { label: copy.wasBookedFor, value: when },
      { label: copy.where, value: named.whereLine },
    ],
    footnote: byOffice ? copy.cancelledFootnoteByOffice : copy.cancelledFootnoteByYou,
  });

  // The office's copy is in the OFFICE's language — the company default — and
  // only exists when a client did the cancelling. An office that pressed the
  // button does not need a letter about it.
  const officeCopy = visitCopy(company?.defaultLanguage || "en");
  const officeWhen = formatWhen(startTime, timezone, company?.defaultLanguage || "en");
  const officeNamed = describeAppointment({
    where,
    location,
    eventTypeName,
    language: company?.defaultLanguage || "en",
  });
  const companyHtml = byOffice
    ? null
    : bookingEmailShell({
        companyName,
        headline: esc(officeCopy.officeCancelledHeadline),
        intro: [
          esc(officeCopy.officeCancelledIntro(clientName, officeNamed.introName)),
          ...(feeLine
            ? [
                esc(
                  refund.refunded
                    ? officeCopy.officeFeeRefunded(amount)
                    : officeCopy.officeFeeNotRefunded(amount),
                ),
              ]
            : []),
        ],
        rows: [
          { label: officeCopy.client, value: clientName },
          { label: officeCopy.email, value: clientEmail },
          { label: officeCopy.what, value: officeNamed.whatRow },
          { label: officeCopy.wasBookedFor, value: officeWhen },
          { label: officeCopy.where, value: officeNamed.whereLine },
        ],
        footnote: officeCopy.officeCancelledFootnote,
      });

  return {
    client: {
      to: clientEmail,
      subject: copy.cancelledSubject(named.subjectName, companyName),
      html: clientHtml,
    },
    company: {
      to: byOffice ? null : company?.email || null,
      subject: officeCopy.officeCancelledSubject(clientName, officeWhen),
      html: companyHtml,
    },
  };
}

export async function sendVisitCancelledEmails(params) {
  return sendBothCopies(params.company, buildVisitCancelledEmails(params), params.attachments);
}

/**
 * Sends the two halves of one event.
 *
 * Both are attempted whatever the other does: the contractor still has to hear
 * about a cancellation when the homeowner's address bounces, and vice versa.
 * Errors are returned, never thrown — the caller has already done the thing the
 * letters are about.
 */
async function sendBothCopies(company, letters, attachments = null) {
  const sender = await resolveSender(company || { name: company?.name || "" }, company?.id);
  // The calendar invite rides with the CLIENT's copy only — see
  // sendBookingConfirmationEmail.
  const clientExtras = Array.isArray(attachments) && attachments.length ? { attachments } : {};
  // Both halves carry the tenant. The company's own copy is simulated for a
  // demo too — not because a contractor's inbox needs protecting, but because
  // splitting the rule ("client mail is faked, staff mail is real") gives a
  // demo two behaviours where it should have one, and the first person to add
  // a third letter has to guess which side it lands on.
  const sendingCompanyId = company?.id;

  const [client, office] = await Promise.all([
    letters.client.to
      ? sendEmail({ companyId: sendingCompanyId, ...letters.client, ...sender, ...clientExtras }).catch((err) => ({ error: err?.message }))
      : Promise.resolve({ skipped: true }),
    letters.company.to
      ? sendEmail({ companyId: sendingCompanyId, ...letters.company, ...sender }).catch((err) => ({ error: err?.message }))
      : Promise.resolve({ skipped: true }),
  ]);

  return { client, company: office };
}

/**
 * Both letters that go out when a client moves a visit themselves.
 *
 * Says the old time as well as the new one. A message that only names the new
 * time reads identically to a confirmation, and the contractor's crew needs to
 * know which slot just freed up.
 *
 * @param {string} [params.quoteNumber]  the estimate this visit is about
 */
export function buildVisitRescheduledEmails({
  company,
  clientName,
  clientEmail,
  eventTypeName,
  previousStartTime,
  startTime,
  location,
  where = null,
  timezone,
  arrivalWindowMinutes,
  manageUrl,
  quoteNumber,
  about = null,
  language = "en",
  initiatedBy = "client",
}) {
  const companyName = company?.name || "";
  const copy = visitCopy(language);
  const named = describeAppointment({ where, location, eventTypeName, language });
  const byOffice = initiatedBy === "office";
  const wasWhen = formatWhen(previousStartTime, timezone, language);
  const clientWhen =
    describeWindow(startTime, arrivalWindowMinutes, { timezone, language }) ||
    formatWhen(startTime, timezone, language);

  const clientHtml = bookingEmailShell({
    companyName,
    headline: esc(copy.movedHeadline),
    intro: [
      esc(copy.greeting(clientName)),
      esc(
        byOffice
          ? copy.movedByOffice(named.introName, companyName)
          : copy.movedByYou(named.introName, companyName),
      ),
      ...aboutLine({ about, quoteNumber }, copy),
    ],
    rows: [
      { label: copy.what, value: named.whatRow },
      { label: copy.newTime, value: clientWhen },
      { label: copy.previously, value: wasWhen },
      { label: copy.where, value: named.whereLine },
    ],
    ...(manageUrl && { action: { url: manageUrl, label: copy.manageCta } }),
    footnote: copy.movedFootnote,
  });

  // The crew's copy always carries the exact time. An arrival window is a
  // promise made to the client, not a change to when the van leaves. Written
  // in the office's language, and only when the client did the moving.
  const officeLanguage = company?.defaultLanguage || "en";
  const officeCopy = visitCopy(officeLanguage);
  const exactWhen = formatWhen(startTime, timezone, officeLanguage);
  const officeWasWhen = formatWhen(previousStartTime, timezone, officeLanguage);
  const officeNamed = describeAppointment({ where, location, eventTypeName, language: officeLanguage });
  const companyHtml = byOffice
    ? null
    : bookingEmailShell({
        companyName,
        headline: esc(officeCopy.officeMovedHeadline),
        intro: [
          esc(officeCopy.officeMovedIntro(clientName, officeNamed.introName)),
          esc(officeCopy.officeMovedLine),
        ],
        rows: [
          { label: officeCopy.client, value: clientName },
          { label: officeCopy.email, value: clientEmail },
          { label: officeCopy.what, value: officeNamed.whatRow },
          { label: officeCopy.newTime, value: exactWhen },
          { label: officeCopy.previously, value: officeWasWhen },
          { label: officeCopy.where, value: officeNamed.whereLine },
        ],
        footnote: officeCopy.officeMovedFootnote,
      });

  return {
    client: {
      to: clientEmail,
      subject: copy.movedSubject(named.subjectName, companyName),
      html: clientHtml,
    },
    company: {
      to: byOffice ? null : company?.email || null,
      subject: officeCopy.officeMovedSubject(clientName, exactWhen),
      html: companyHtml,
    },
  };
}

export async function sendVisitRescheduledEmails(params) {
  return sendBothCopies(params.company, buildVisitRescheduledEmails(params), params.attachments);
}
