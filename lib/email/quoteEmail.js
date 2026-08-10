// lib/email/quoteEmail.js
//
// The email a client actually receives when a quote is sent.
//
// ── Why this file exists at all ─────────────────────────────────────────────
//
// The "Send" button on the quote page called PATCH { status: "sent" } and
// nothing else. There was no quote-send route anywhere in the app. The button
// changed a word on screen, the button then disappeared because the status was
// no longer "draft", and the user reasonably concluded a quote had gone out.
// Nothing had. That's the worst class of bug in a product like this — it
// doesn't fail, it lies, and the person only finds out when a client says they
// never heard back.
//
// ── Design of the email itself ──────────────────────────────────────────────
//
// Short, and the link is the point. The full document lives at /q/<token>
// where it can be styled properly, priced with add-ons and approved in one
// tap. An email that reproduces the whole quote gives the client a second,
// worse copy to read and a reason not to click through to the one that has
// the approve button on it.
//
// Everything is inline-styled and table-based: Gmail strips <style> blocks,
// and Outlook's renderer is Word. The furniture — brand band, amount block,
// button, footer — lives in documentEmailLayout.js so the invoice that follows
// this quote is unmistakably from the same company. Only the words are here.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { documentFormatters, documentLabels } from "@/lib/i18n/documentLabels";
import {
  documentEmailHtml,
  amountBlock,
  emailButton,
  escapeHtml,
  EMAIL_FONT,
} from "@/lib/email/documentEmailLayout";

/**
 * @param kind      "quote" | "follow_up" — same layout, different opening
 *                  line. A follow-up that looks like a fresh quote reads as a
 *                  company that has lost track of what it sent.
 * @param language  the CLIENT's language, resolved by the caller. Not the
 *                  company's and not a viewer preference — a francophone
 *                  homeowner gets a French email whichever language the
 *                  contractor works in.
 */
export function buildQuoteEmail({
  quote,
  client,
  company,
  url,
  kind = "quote",
  language = "en",
}) {
  const t = documentTheme(company);
  const fill = fillPair(t);
  const c = emailCopy(language);
  // The document word on the brand band ("Quote" / "Devis" / "Presupuesto"),
  // from the same catalogue the PDF and the approval page use. Same language as
  // everything else here: the client's.
  const labels = documentLabels(language);
  // Currency stays CAD — a Ukrainian-speaking homeowner in Toronto is still
  // billed in dollars. Only the formatting shifts.
  const { money, date } = documentFormatters(language);

  const clientName = String(client?.name || "").split(" ")[0] || "";
  const total = money(quote.total);

  const isFollowUp = kind === "follow_up";
  const opening = isFollowUp ? c.followUpIntro() : c.quoteIntro();

  const subject = isFollowUp
    ? c.followUpSubject(company.name, quote.quoteNumber)
    : c.quoteSubject(company.name, quote.quoteNumber);

  const expiry = quote.validUntil ? date(quote.validUntil) : null;

  // inkMuted, not inkFaint, for the "or paste this" fallback below. inkFaint is
  // built to a 3:1 target — fine for a hairline — and measures 3.27:1 on white,
  // under the body bar for a 12px line. That line is what a client falls back
  // to when their mail client ate the button; it is the last thing in the email
  // allowed to be hard to read.
  const fallbackInk = t.inkMuted;

  const body = `
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 14px;color:${t.ink};">
          ${escapeHtml(c.greeting(clientName))}
        </p>
        <p style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;margin:0 0 22px;color:${t.inkMuted};">
          ${opening}
        </p>
${amountBlock({
  theme: t,
  // The quote number moved up to the brand band, where a reference belongs.
  // This block now says what the figure IS, which is the question a client
  // actually has when they see a number that size.
  label: escapeHtml(labels.total.toUpperCase()),
  amount: total,
  sub: expiry ? escapeHtml(c.validUntil(expiry)) : "",
})}
${emailButton({ url, label: escapeHtml(c.quoteCta), fill })}
        <p style="font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${fallbackInk};margin:16px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>`;

  const html = documentEmailHtml({
    company,
    theme: t,
    fill,
    label: labels.quote,
    reference: quote.quoteNumber,
    body,
    footerNote: escapeHtml(c.questions(company.phone)),
  });

  // A plain-text alternative is not optional here. Some corporate filters
  // score HTML-only mail as spam, and a quote landing in junk is the same
  // outcome as never sending it.
  const text = [
    c.greeting(clientName),
    "",
    opening,
    "",
    `${quote.quoteNumber} — ${total}`,
    expiry ? c.validUntil(expiry) : "",
    "",
    `${c.quoteCta}: ${url}`,
    "",
    c.questions(company.phone),
    company.name,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html, text };
}
