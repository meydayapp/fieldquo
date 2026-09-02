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
// ── These letters are English, and that is this file's existing pattern ─────
//
// formatWhen() below hardcodes en-US and no caller passes a language, so all of
// them are English today. New wording here follows that rather than inventing a
// second, half-translated pattern. Making the set language-aware is one piece of
// work with an obvious shape: put the sentences in lib/i18n/emailCopy.js (which
// already carries all six languages for quotes and invoices), resolve the
// language with lib/i18n/clientLanguage.js at the call site, and thread it down
// — including into describeWindow(), which already accepts one. All the letters
// at once, or none: a French confirmation followed by an English cancellation is
// worse than either being consistently one language.

import { sendEmail, senderFor } from "@/lib/email/resend";
import { describeWindow } from "@/lib/booking/arrivalWindow";
import { formatMoney } from "@/lib/currency";

function formatWhen(startTime, timezone) {
  try {
    return new Intl.DateTimeFormat("en-US", {
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
 * @param {string}   headline   the <h1>. HTML, not text — the callers pass
 *                              entities (&rsquo;). Every one is a literal in
 *                              this file; nothing user-supplied reaches it.
 * @param {string[]} intro      paragraph lines, joined with a blank line. Also
 *                              HTML: callers esc() the values they interpolate.
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
function aboutQuoteLine(quoteNumber) {
  const ref = String(quoteNumber ?? "").trim();
  return ref ? [`About your estimate ${esc(ref)}.`] : [];
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
  timezone,
  arrivalWindowMinutes,
  manageUrl,
  quoteNumber,
}) {
  // ── Window if the company set one, exact time otherwise ──────────────────
  //
  // describeWindow returns null when windows are off, so this falls straight
  // through to the formatting that was already here rather than to a second,
  // divergent copy of it. Only the CLIENT sees the window; the crew's own
  // schedule keeps the real time. See lib/booking/arrivalWindow.js.
  const when =
    describeWindow(startTime, arrivalWindowMinutes, { timezone }) ||
    formatWhen(startTime, timezone);

  const html = bookingEmailShell({
    companyName,
    headline: "You&rsquo;re booked in",
    intro: [
      `Hi ${esc(clientName)},`,
      `Your ${esc(eventTypeName)} with ${esc(companyName)} is confirmed.`,
      ...aboutQuoteLine(quoteNumber),
    ],
    rows: [
      { label: "When", value: when },
      { label: "Where", value: location },
    ],
    ...(manageUrl && { action: { url: manageUrl, label: "Change or cancel this visit" } }),
    footnote: manageUrl
      ? "Need to change or cancel? Use the link above — or just reply to this email."
      : "Need to change or cancel? Just reply to this email.",
  });

  return { subject: `Confirmed: ${eventTypeName} with ${companyName}`, html };
}

export async function sendBookingConfirmationEmail({ to, company, ...rest }) {
  const { subject, html } = buildBookingConfirmationEmail(rest);

  return sendEmail({
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
    // otherwise the shared sender under the company's display name.
    ...senderFor(company || { name: rest.companyName }),
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
  timezone,
  refund = {},
  quoteNumber,
}) {
  const companyName = company?.name || "";
  const when = formatWhen(startTime, timezone);
  const amount = feeAmount(refund.amountCents, refund.currency || company?.currency);

  // Three honest sentences, never "a refund is on its way" when it isn't. The
  // no_payment_intent case is deliberately worded as something a person will
  // deal with, because a person has to.
  const feeLine = !amount
    ? null
    : refund.refunded
      ? `Your ${amount} visit fee has been refunded to the card you paid with. Cards usually take a few working days to show it.`
      : refund.reason === "already_refunded"
        ? `The ${amount} visit fee was already refunded.`
        : refund.reason === "no_payment_intent"
          ? `The ${amount} visit fee wasn't taken through this system, so it isn't returned automatically — reply to this email and we'll sort it out.`
          : `The ${amount} visit fee isn't returned automatically. Reply to this email if you'd like to talk about it.`;

  const clientHtml = bookingEmailShell({
    companyName,
    headline: "Your visit is cancelled",
    intro: [
      `Hi ${esc(clientName)},`,
      `Your ${esc(eventTypeName)} with ${esc(companyName)} has been cancelled, as requested.`,
      ...aboutQuoteLine(quoteNumber),
      ...(feeLine ? [esc(feeLine)] : []),
    ],
    rows: [
      { label: "Was booked for", value: when },
      { label: "Where", value: location },
    ],
    footnote: "Changed your mind? Reply to this email and we'll find you another time.",
  });

  const companyHtml = bookingEmailShell({
    companyName,
    headline: "A booking was cancelled",
    intro: [
      `${esc(clientName)} cancelled their ${esc(eventTypeName)} using the link in their confirmation email.`,
      ...(feeLine
        ? [
            esc(
              refund.refunded
                ? `The ${amount} visit fee was refunded automatically, per your cancellation policy.`
                : `The ${amount} visit fee was NOT refunded.`,
            ),
          ]
        : []),
    ],
    rows: [
      { label: "Client", value: clientName },
      { label: "Email", value: clientEmail },
      { label: "Was booked for", value: when },
      { label: "Where", value: location },
    ],
    footnote: "The slot is free again on your calendar.",
  });

  return {
    client: {
      to: clientEmail,
      subject: `Cancelled: ${eventTypeName} with ${companyName}`,
      html: clientHtml,
    },
    company: {
      to: company?.email || null,
      subject: `Cancelled: ${clientName} — ${when}`,
      html: companyHtml,
    },
  };
}

export async function sendVisitCancelledEmails(params) {
  return sendBothCopies(params.company, buildVisitCancelledEmails(params));
}

/**
 * Sends the two halves of one event.
 *
 * Both are attempted whatever the other does: the contractor still has to hear
 * about a cancellation when the homeowner's address bounces, and vice versa.
 * Errors are returned, never thrown — the caller has already done the thing the
 * letters are about.
 */
async function sendBothCopies(company, letters) {
  const sender = senderFor(company || { name: company?.name || "" });
  // Both halves carry the tenant. The company's own copy is simulated for a
  // demo too — not because a contractor's inbox needs protecting, but because
  // splitting the rule ("client mail is faked, staff mail is real") gives a
  // demo two behaviours where it should have one, and the first person to add
  // a third letter has to guess which side it lands on.
  const sendingCompanyId = company?.id;

  const [client, office] = await Promise.all([
    letters.client.to
      ? sendEmail({ companyId: sendingCompanyId, ...letters.client, ...sender }).catch((err) => ({ error: err?.message }))
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
  timezone,
  arrivalWindowMinutes,
  manageUrl,
  quoteNumber,
}) {
  const companyName = company?.name || "";
  const wasWhen = formatWhen(previousStartTime, timezone);
  const clientWhen =
    describeWindow(startTime, arrivalWindowMinutes, { timezone }) ||
    formatWhen(startTime, timezone);
  // The crew's copy always carries the exact time. An arrival window is a
  // promise made to the client, not a change to when the van leaves.
  const exactWhen = formatWhen(startTime, timezone);

  const clientHtml = bookingEmailShell({
    companyName,
    headline: "Your visit has moved",
    intro: [
      `Hi ${esc(clientName)},`,
      `Your ${esc(eventTypeName)} with ${esc(companyName)} is now booked for a new time.`,
      ...aboutQuoteLine(quoteNumber),
    ],
    rows: [
      { label: "New time", value: clientWhen },
      { label: "Previously", value: wasWhen },
      { label: "Where", value: location },
    ],
    ...(manageUrl && { action: { url: manageUrl, label: "Change or cancel this visit" } }),
    footnote:
      "Nothing else has changed — any visit fee you already paid still stands against this booking.",
  });

  const companyHtml = bookingEmailShell({
    companyName,
    headline: "A booking moved",
    intro: [
      `${esc(clientName)} moved their ${esc(eventTypeName)} using the link in their confirmation email.`,
      "The old slot is free again and the new one is on your calendar.",
    ],
    rows: [
      { label: "Client", value: clientName },
      { label: "Email", value: clientEmail },
      { label: "New time", value: exactWhen },
      { label: "Previously", value: wasWhen },
      { label: "Where", value: location },
    ],
    footnote: "Any visit fee already paid carries over — nothing was charged or refunded.",
  });

  return {
    client: {
      to: clientEmail,
      subject: `Moved: ${eventTypeName} with ${companyName}`,
      html: clientHtml,
    },
    company: {
      to: company?.email || null,
      subject: `Moved: ${clientName} — now ${exactWhen}`,
      html: companyHtml,
    },
  };
}

export async function sendVisitRescheduledEmails(params) {
  return sendBothCopies(params.company, buildVisitRescheduledEmails(params));
}
