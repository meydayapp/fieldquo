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
// Everything is inline-styled and table-free where possible: Gmail strips
// <style> blocks, and Outlook's renderer is Word.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { emailCopy } from "@/lib/i18n/emailCopy";
import { documentFormatters } from "@/lib/i18n/documentLabels";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:${t.page};">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px;font-family:Helvetica,Arial,sans-serif;color:${t.ink};">

    <div style="background:#ffffff;border:1px solid #e4e2dd;border-radius:12px;overflow:hidden;">
      <div style="height:5px;background:${fill.bg};"></div>

      <div style="padding:24px;">
        ${
          company.logoUrl
            ? `<img src="${company.logoUrl}" alt="${escapeHtml(company.name)}" style="max-height:38px;display:block;margin-bottom:16px;" />`
            : `<div style="font-size:17px;font-weight:700;color:${t.accentText};margin-bottom:16px;">${escapeHtml(company.name)}</div>`
        }

        <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">
          ${escapeHtml(c.greeting(clientName))}
        </p>
        <p style="font-size:15px;line-height:1.6;margin:0 0 20px;color:${t.inkMuted};">
          ${opening}
        </p>

        <div style="background:${t.accentWash};border-radius:8px;padding:14px 16px;margin-bottom:20px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${t.inkFaint};">
            ${escapeHtml(quote.quoteNumber)}
          </div>
          <div style="font-size:26px;font-weight:800;color:${t.accentText};margin-top:2px;">
            ${total}
          </div>
          ${
            expiry
              ? `<div style="font-size:12px;color:${t.inkMuted};margin-top:4px;">${escapeHtml(c.validUntil(expiry))}</div>`
              : ""
          }
        </div>

        <!-- The one thing this email is for. Bulletproof-ish button: a
             padded anchor, no background image, no VML — renders acceptably
             everywhere including Outlook. -->
        <a href="${url}"
           style="display:block;text-align:center;background:${fill.bg};color:${fill.fg};
                  text-decoration:none;font-size:15px;font-weight:700;
                  padding:14px 20px;border-radius:999px;">
          ${escapeHtml(c.quoteCta)}
        </a>

        <p style="font-size:12px;line-height:1.6;color:${t.inkFaint};margin:16px 0 0;text-align:center;">
          ${escapeHtml(c.orPaste)}<br />
          <span style="word-break:break-all;">${escapeHtml(url)}</span>
        </p>
      </div>

      <div style="padding:16px 24px;background:#faf8f4;border-top:1px solid #efedE8;font-size:12px;color:${t.inkMuted};">
        ${escapeHtml(c.questions(company.phone))}
        <br />
        <strong style="color:${t.ink};">${escapeHtml(company.name)}</strong>
      </div>
    </div>
  </div>
</body></html>`;

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
