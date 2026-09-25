// lib/portal/loginEmail.js
//
// The email a client receives after typing their address into "Client login"
// on a company's website: their own portal link, from the company, in the
// client's language.
//
// Pure — builds { subject, html, text } and nothing else. The route decides
// who gets it (lib/portal/loginLink.js), and scripts/check-client-portal.mjs
// renders it against hostile names and a mid-grey brand to prove the button
// is measured and nothing says FieldQuo.
//
// Poured into the same shell as the quote and invoice emails
// (lib/email/documentEmailLayout.js) so a client recognises it as coming from
// the company they already have documents from — the white-label rule, and
// the only thing that makes an unexpected "here is your link" email look
// trustworthy rather than like phishing.

import { documentTheme, fillPair } from "@/lib/documents/theme";
import { documentEmailHtml, emailButton, escapeHtml, EMAIL_FONT } from "@/lib/email/documentEmailLayout";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";

/**
 * @param company   { name, logoUrl, brandColor, email, phone }
 * @param client    { name }
 * @param url       the client's own portal link
 * @param language  the client's language (resolveClientLanguage, no document)
 * @param requested true when the CLIENT asked for it (the website's Client
 *                  login); false when the office sent it from the client page.
 *                  Only the first carries "if you didn't ask for this, ignore
 *                  it" — said to someone who did not ask, it reads as a
 *                  warning about the company's own email.
 */
export function buildPortalLinkEmail({ company = {}, client = {}, url, language = "en", requested = true }) {
  const theme = documentTheme(company);
  const fill = fillPair(theme);
  const c = clientDocCopy(language).portal;
  const first = String(client?.name || "").trim().split(/\s+/)[0] || "";
  const name = String(company?.name || "");

  const subject = c.loginEmailSubject(name);
  const body = `
            <div style="font-family:${EMAIL_FONT};font-size:15px;line-height:1.6;color:${theme.ink};">
              <p style="margin:0 0 12px;">${escapeHtml(c.loginEmailGreeting(first))}</p>
              <p style="margin:0 0 20px;">${escapeHtml(c.loginEmailIntro(name))}</p>
            </div>
${emailButton({ url, label: escapeHtml(c.loginEmailButton), fill })}
            <p style="margin:20px 0 0;font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${theme.inkMuted};">${escapeHtml(c.loginEmailKeep)}</p>
            ${requested ? `<p style="margin:8px 0 0;font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${theme.inkMuted};">${escapeHtml(c.loginEmailIgnore)}</p>` : ""}`;

  const html = documentEmailHtml({
    company,
    theme,
    fill,
    label: c.loginEmailLabel,
    reference: "",
    body,
  });

  const text = [
    c.loginEmailGreeting(first),
    "",
    c.loginEmailIntro(name),
    "",
    `${c.loginEmailButton}: ${url}`,
    "",
    c.loginEmailKeep,
    ...(requested ? [c.loginEmailIgnore] : []),
    "",
    name,
    [company.email, company.phone].filter(Boolean).join(" · "),
  ]
    .join("\n")
    .trim();

  return { subject, html, text };
}
