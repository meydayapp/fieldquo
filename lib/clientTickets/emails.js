// lib/clientTickets/emails.js
//
// The email a client gets when the company replies to their ticket: from the
// company, in the client's language, in the same shell as the quote and
// invoice emails, with the reply quoted and a button back to the portal where
// the conversation lives.
//
// Pure. scripts/check-client-tickets.mjs renders it with hostile names, a
// hostile reply and every language.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { documentEmailHtml, emailButton, escapeHtml, EMAIL_FONT } from "@/lib/email/documentEmailLayout";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";

export function buildTicketReplyEmail({ company = {}, client = {}, ticket = {}, reply = "", staffName = "", url = null, language = "en" }) {
  const theme = documentTheme(company);
  const fill = fillPair(theme);
  const c = clientDocCopy(language).portal;
  const name = String(company?.name || "");
  const first = String(client?.name || "").trim().split(/\s+/)[0] || "";
  const who = String(staffName || "").trim().split(/\s+/)[0] || name;
  const subject = c.ticketReplySubject(ticket.subject || "");

  const quoted = escapeHtml(reply).replace(/\n/g, "<br>");
  const body = `
            <div style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;color:${theme.ink};">
              <p style="margin:0 0 12px;">${escapeHtml(c.loginEmailGreeting(first))}</p>
              <p style="margin:0 0 14px;">${escapeHtml(c.ticketReplyIntro(who, ticket.subject || ""))}</p>
              <div style="margin:0 0 20px;padding:12px 14px;border-left:3px solid ${theme.accentRule};background:${theme.accentWash};color:${theme.inkOnWash};border-radius:6px;">${quoted}</div>
            </div>
${url ? emailButton({ url, label: escapeHtml(c.ticketReplyButton), fill }) : ""}`;

  const html = documentEmailHtml({ company, theme, fill, label: c.ticketEmailLabel, reference: "", body });
  const text = [
    c.loginEmailGreeting(first),
    "",
    c.ticketReplyIntro(who, ticket.subject || ""),
    "",
    reply,
    "",
    ...(url ? [`${c.ticketReplyButton}: ${url}`, ""] : []),
    name,
  ].join("\n");
  return { subject, html, text };
}
