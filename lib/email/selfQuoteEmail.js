// lib/email/selfQuoteEmail.js
//
// The confirmation a homeowner receives after the self-quote form.
//
// ── There wasn't one ────────────────────────────────────────────────────────
//
// /api/self-quote created a lead and returned. The homeowner typed their name,
// their phone number and a description of their kitchen into a stranger's
// form, pressed Send, and got nothing in writing. Every other inbound path in
// the product confirms; this one told them "we've got it" on a page they then
// closed.
//
// ── Same stationery as the quote that follows it ────────────────────────────
//
// This is the first thing the company ever sends that person, and the second
// will be their actual quote. So it is poured into the SAME shell —
// documentEmailLayout.js — that quoteEmail.js and invoiceEmail.js use: brand
// band with the logo on a white chip, white card, washed footer with the
// company's real contact details. The "prepared for" panel is the same
// preparedForBlock the quote's own ClientInfoSection renders, rather than a
// lookalike built here.
//
// The obvious alternative was a short plain-text "thanks, we'll be in touch".
// It was rejected because the resemblance IS the product: a homeowner
// comparing three contractors should see one company's stationery twice, not
// one generic acknowledgement and one branded quote.
//
// ── What it must not contain ────────────────────────────────────────────────
//
// No price. Nothing here has been priced by a person, /api/self-quote returns
// no rates, and an emailed figure is the one a homeowner screenshots and holds
// the contractor to. The amount block only renders when buildConfirmation's
// gate says a figure may be shown, which for this path is never.
//
// Pure. Hand it the facts, it returns { subject, html, text }.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { emailCopy } from "@/lib/i18n/emailCopy";
import {
  documentEmailHtml,
  preparedForBlock,
  amountBlock,
  escapeHtml,
  EMAIL_FONT,
} from "@/lib/email/documentEmailLayout";
import { buildConfirmation } from "@/lib/selfQuote/confirmation";

/**
 * @param company     the company row (name, logoUrl, brandColor, email, phone…)
 * @param contact     { name, email, phone, address } as the homeowner typed it
 * @param service     { label, fields } or null
 * @param language    the language the LEAD was created in — never a preference
 *                    read at send time. See AGENTS.md non-negotiable 6.
 */
export function buildSelfQuoteEmail({
  company = {},
  contact = {},
  service = null,
  details = null,
  description = "",
  budgetBand = null,
  timeline = null,
  language = "en",
  submittedAt = new Date(),
}) {
  const doc = buildConfirmation({
    company,
    contact,
    service,
    details,
    description,
    budgetBand,
    timeline,
    language,
    submittedAt,
  });

  const t = documentTheme(company);
  const fill = fillPair(t);
  const c = emailCopy(language);
  const copy = doc.copy;

  const firstName = String(contact.name || "").split(" ")[0] || "";

  // Two panels of facts, in the order the document uses: who it's for, then
  // what they asked about. The first is the shared section; the second is
  // built here because no existing section models "a request with no prices"
  // — ScopeGroupsSection is a priced table by construction.
  const preparedFor = preparedForBlock({
    theme: t,
    label: doc.preparedForLabel,
    client: doc.client,
  });

  const requestedRows = doc.requested.lines
    .map(
      (l) => `
              <tr>
                <td style="padding:2px 0;font-size:13px;line-height:1.5;color:${t.inkMutedOnWash};">${escapeHtml(l.label)}</td>
                <td style="padding:2px 0;font-size:13px;line-height:1.5;font-weight:700;text-align:right;color:${t.inkOnWash};">${escapeHtml(l.value)}</td>
              </tr>`,
    )
    .join("");

  const requestedBlock =
    doc.requested.title || requestedRows || doc.requested.note
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 18px;">
          <tr>
            <td bgcolor="${t.accentWash}" style="background:${t.accentWash};border-radius:8px;padding:12px 14px;font-family:${EMAIL_FONT};">
              <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:${t.inkFaint};padding-bottom:4px;">${escapeHtml(doc.requested.heading.toUpperCase())}</div>
              ${doc.requested.title ? `<div style="font-size:15px;font-weight:700;color:${t.inkOnWash};padding-bottom:6px;">${escapeHtml(doc.requested.title)}</div>` : ""}
              ${
                requestedRows
                  ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${requestedRows}</table>`
                  : ""
              }
              ${doc.requested.note ? `<div style="font-size:13px;line-height:1.6;color:${t.inkOnWash};padding-top:8px;">${escapeHtml(doc.requested.note)}</div>` : ""}
            </td>
          </tr>
        </table>`
      : "";

  // The gate. `show` is false on every self-quote — the note explains why
  // rather than leaving the space where a number would be blank.
  const figureBlock = doc.amount.show
    ? amountBlock({
        theme: t,
        label: escapeHtml(doc.amount.label.toUpperCase()),
        amount: escapeHtml(doc.amount.value),
        sub: escapeHtml(doc.amount.sub),
      })
    : `
        <p style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;margin:0 0 18px;color:${t.inkMuted};">
          ${escapeHtml(doc.amount.note)}
        </p>`;

  const steps = doc.nextSteps.steps
    .map(
      (s) => `
              <tr>
                <td width="26" style="width:26px;vertical-align:top;padding:0 10px 12px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                    <tr>
                      <td align="center" bgcolor="${fill.bg}" style="background:${fill.bg};border-radius:999px;width:22px;height:22px;font-family:${EMAIL_FONT};font-size:11px;font-weight:700;color:${fill.fg};line-height:22px;">${s.num}</td>
                    </tr>
                  </table>
                </td>
                <td style="vertical-align:top;padding:0 0 12px;font-family:${EMAIL_FONT};">
                  <div style="font-size:14px;font-weight:700;color:${t.ink};">${escapeHtml(s.title)}</div>
                  <div style="font-size:13px;line-height:1.6;color:${t.inkMuted};padding-top:2px;">${escapeHtml(s.body)}</div>
                </td>
              </tr>`,
    )
    .join("");

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">
          ${escapeHtml(c.greeting(firstName))}
        </p>
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 22px;color:${t.inkMuted};">
          ${escapeHtml(copy.emailIntro(company.name || ""))}
        </p>
${preparedFor}
${requestedBlock}
${figureBlock}
        <div style="font-family:${EMAIL_FONT};font-size:11px;font-weight:700;letter-spacing:1px;color:${t.inkFaint};padding:4px 0 10px;">${escapeHtml(doc.nextSteps.heading.toUpperCase())}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${steps}</table>`;

  const html = documentEmailHtml({
    company,
    theme: t,
    fill,
    label: doc.masthead.word,
    reference: doc.masthead.reference,
    body,
    footerNote: escapeHtml(c.questions(company.phone)),
  });

  // Not optional: some corporate filters score HTML-only mail as spam, and a
  // confirmation in a junk folder is the same outcome as never sending it.
  const text = [
    c.greeting(firstName),
    "",
    copy.emailIntro(company.name || ""),
    "",
    doc.requested.title ? `${doc.requested.heading}: ${doc.requested.title}` : "",
    ...doc.requested.lines.map((l) => `${l.label}: ${l.value}`),
    doc.requested.note || "",
    "",
    doc.amount.show
      ? `${doc.amount.label}: ${doc.amount.value} (${doc.amount.sub})`
      : doc.amount.note,
    "",
    doc.nextSteps.heading,
    ...doc.nextSteps.steps.map((s) => `${s.num}. ${s.title} — ${s.body}`),
    "",
    c.questions(company.phone),
    company.name || "",
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject: copy.emailSubject(company.name || ""), html, text };
}
