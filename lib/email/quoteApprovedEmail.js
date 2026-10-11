// lib/email/quoteApprovedEmail.js
//
// The client's confirmation after approving a quote on /q/<token> — sent by
// app/api/public/quotes/[token]/route.js with the signed PDF attached.
//
// ── Why it is its own builder now ───────────────────────────────────────────
//
// It was four inline <p>s with no logo, no colour and no way back to the
// quote: the one email a homeowner gets at the moment they said yes looked
// nothing like the quote email they said yes to. It is now the same
// stationery (lib/email/documentEmailLayout.js — the brand band, the logo on
// its white chip, the washed footer with the company's contact line) with the
// same theme maths (lib/documents/theme.js documentTheme / fillPair, measured
// to 4.5:1 on every brand colour a contractor picks), and it says the three
// things a person who just approved wants to know:
//
//   1. it worked, and the signed copy is attached (approvedCopyIntro — the
//      sentence the old email had, unchanged);
//   2. what happens next — the contractor will be in touch about scheduling;
//   3. where to find it again — a button back to the quote, and the client's
//      own portal ("Your account with {company}") when they have one, the
//      same quiet line under the button quoteEmail.js draws.
//
// ── White-label ─────────────────────────────────────────────────────────────
//
// Nothing here names FieldQuo. The words come from the client-language
// catalogues (lib/i18n/clientDocCopy.js, lib/i18n/emailCopy.js), the colours
// from the company's own brand, the links are the company's quote and portal
// pages. The From line is the caller's (resolveSender), exactly as before.
//
// ── Language ────────────────────────────────────────────────────────────────
//
// The quote's own language (Quote.language, then the client's, then the
// company's — resolveClientLanguage), passed in by the caller: non-negotiable
// #6. The PDF attached beside it is rendered in the same one.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { documentFormatters, documentLabels } from "@/lib/i18n/documentLabels";
import { documentEmailHtml, emailButton, amountBlock, escapeHtml, EMAIL_FONT } from "@/lib/email/documentEmailLayout";

/**
 * @param quote       { quoteNumber }
 * @param company     the company row: name, logoUrl, brandColor, email, phone,
 *                    website, taxIdName, taxIdNumber, currency
 * @param client      { name } — the greeting uses the first name; none, none
 * @param language    the quote's language
 * @param quoteUrl    absolute link to /q/<token> (the page now shows it approved)
 * @param portalUrl   absolute /portal/<token> link, or null — no line then
 * @param total       the APPROVED total (extras included), from the server's
 *                    own repricing; omitted when not a finite number
 * @returns {{ subject, html, text }}
 */
export function buildQuoteApprovedEmail({ quote, company = {}, client = {}, language = "en", quoteUrl, portalUrl = null, total = null }) {
  const t = documentTheme(company);
  const fill = fillPair(t);
  const ec = emailCopy(language);
  const dc = clientDocCopy(language);
  const labels = documentLabels(language);
  const { money } = documentFormatters(language, company?.currency);
  const companyName = String(company?.name || "").trim();
  const first = String(client?.name || "").trim().split(/\s+/)[0] || "";

  const greeting = first ? ec.greeting(first) : "";
  const intro = dc.approvedCopyIntro(companyName);
  const next = dc.approvedScheduling(companyName);
  const closing = ec.questions(company?.phone);
  const amount = Number.isFinite(Number(total)) && total !== null && total !== "" ? money(Number(total)) : "";

  const link = typeof quoteUrl === "string" && /^https?:\/\//i.test(quoteUrl) ? quoteUrl : null;
  const account = typeof portalUrl === "string" && /^https?:\/\//i.test(portalUrl) ? portalUrl : null;
  const accountWords = account ? ec.accountLine(companyName) : "";

  const para = (text, color, margin = "0 0 14px") =>
    `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:${margin};color:${color};">${escapeHtml(text)}</p>`;

  const body = `${greeting ? para(greeting, t.ink) : ""}${para(intro, t.inkMuted)}
${amount ? amountBlock({ theme: t, label: escapeHtml(labels.total.toUpperCase()), amount: escapeHtml(amount) }) : ""}${para(next, t.ink, "0 0 22px")}
${link ? emailButton({ url: link, label: escapeHtml(dc.approvedViewQuote), fill }) : ""}${
    account
      ? `
        <p style="font-family:${EMAIL_FONT};font-size:13px;line-height:1.6;margin:14px 0 0;text-align:center;">
          <a href="${escapeHtml(account)}" style="color:${t.inkMuted};text-decoration:underline;">${escapeHtml(accountWords)}</a>
        </p>`
      : ""
  }`;

  const html = documentEmailHtml({
    company,
    theme: t,
    fill,
    label: labels.quote,
    reference: quote?.quoteNumber || "",
    body,
    footerNote: escapeHtml(closing),
  });

  const text = [
    greeting,
    intro,
    amount ? `${labels.total}: ${amount}` : "",
    next,
    link ? `${dc.approvedViewQuote}: ${link}` : "",
    account ? accountWords.replace(/\s*→\s*$/, "") : "",
    account || "",
    closing,
    companyName,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject: `${dc.approvedTitle} — ${quote?.quoteNumber || ""}`, html, text };
}
