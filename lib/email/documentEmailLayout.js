// lib/email/documentEmailLayout.js
//
// The shell both client-facing document emails are poured into: the quote that
// asks for a decision and the invoice that asks for money.
//
// ── Why one shell rather than two hand-built templates ──────────────────────
//
// quoteEmail.js and invoiceEmail.js were already deliberate siblings — same
// palette, same shape — kept in step by copying. That's the duplication class
// AGENTS.md warns about: the copy is the one that rots, because it's the one
// nobody looks at. A client who gets a quote and then an invoice from the same
// company must recognise the second as coming from the first, and the cheapest
// way to guarantee that is for both to be the same markup with different words
// in it.
//
// The two files keep their own COPY, their own figures and their own decisions
// about what the button says. Only the furniture lives here.
//
// ── Why tables and inline styles, and nothing else ──────────────────────────
//
// Gmail strips <style> blocks, Outlook renders through Word (no flexbox, no
// grid, no border-radius on a <td>), and several clients drop background
// images. So: nested tables for layout, `bgcolor` attributes beside every
// background colour, inline styles on every element, and no external asset
// other than the company's own logo, which was already there.
//
// ── Why the logo sits on a white chip inside the brand band ─────────────────
//
// The band is filled with the company's brand colour, and a logo is usually a
// PNG with the company's own ink baked into it. Dropping a navy wordmark
// straight onto a navy band makes it disappear — and unlike text, no amount of
// contrast maths can fix an image we can't recolour. So the logo keeps a white
// plate under it, which is what a sign-writer would do, and only TEXT is asked
// to survive the brand colour (via fillPair, which measures).

import { ensureContrast } from "@/lib/brand/colour";
import { ruleColor } from "@/lib/documents/theme";
import { escapeAttr } from "@/lib/email/emailTheme";
import { taxIdLine } from "@/lib/documents/taxId";

// One stack, no web fonts. A @font-face an email client honours is rarer than
// one that silently falls back, and the fallback is this anyway.
export const EMAIL_FONT = "Helvetica,Arial,sans-serif";

/**
 * Text escaping for an email body.
 *
 * emailTheme.js exports an escapeHtml that deliberately leaves quotes alone
 * (it has escapeAttr for attribute contexts). quoteEmail and invoiceEmail each
 * carried their own copy that also escaped `"`. This is that copy, once, so
 * both builders can drop theirs.
 */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The one thing the email is for.
 *
 * A padded <a> is what both files used, and it collapses to a bare link in
 * Outlook's Word renderer the moment the anchor's `display` is ignored — the
 * padding goes with it and the button becomes underlined blue text. The
 * bulletproof form puts the colour on a <td bgcolor> so the shape exists in
 * the table even when every style rule is thrown away, with the anchor filling
 * it. No VML: the conditional-comment variant only buys a rounded corner, and
 * a square button that always renders beats a rounded one that sometimes
 * doesn't.
 *
 * @param fill  a fillPair() result — bg/fg already measured at 4.5:1
 */
export function emailButton({ url, label, fill }) {
  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
          <tr>
            <td align="center" style="padding:2px 0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                <tr>
                  <td align="center" bgcolor="${fill.bg}" style="background:${fill.bg};border-radius:999px;">
                    <a href="${escapeAttr(url)}" style="display:inline-block;font-family:${EMAIL_FONT};font-size:15px;font-weight:700;line-height:1.2;color:${fill.fg};text-decoration:none;padding:15px 34px;border-radius:999px;">${label}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`;
}

/**
 * The figure the whole email is about, in a block of its own.
 *
 * Both emails already had a washed box with a big number in it; what it lacked
 * was a reason for the eye to stop there before anywhere else. The accent rule
 * down the left edge is the same device the PDF uses on a scope card, and it
 * comes from ruleColor() so a company whose brand is near-white gets ink
 * instead of an invisible line.
 *
 * @param sub       optional line under the figure (a due date, an expiry)
 * @param subColor  its colour; measured against the wash here, not by the
 *                  caller — #b91c1c "overdue" red was being placed on a tinted
 *                  wash without anyone checking what that did to it.
 */
export function amountBlock({ theme, label, amount, sub = "", subColor = "" }) {
  // accentText is measured against PAPER. The wash is a shade darker, which is
  // exactly the drop that took inkMutedOnWash below the bar (see theme.js), so
  // the headline figure gets re-measured against the surface it actually sits
  // on rather than the one it was derived for.
  const figure = ensureContrast(theme.accentText, theme.accentWash, 4.5);
  const subOn = subColor
    ? ensureContrast(subColor, theme.accentWash, 4.5)
    : theme.inkMutedOnWash;

  return `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;margin:0 0 22px;">
          <tr>
            <td width="4" bgcolor="${ruleColor(theme)}" style="width:4px;background:${ruleColor(theme)};font-size:0;line-height:0;">&nbsp;</td>
            <td bgcolor="${theme.accentWash}" style="background:${theme.accentWash};padding:15px 18px;font-family:${EMAIL_FONT};">
              <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${theme.inkMutedOnWash};">${label}</div>
              <div style="font-size:30px;font-weight:800;line-height:1.2;color:${figure};padding-top:3px;">${amount}</div>
              ${sub ? `<div style="font-size:12px;line-height:1.5;color:${subOn};padding-top:5px;">${sub}</div>` : ""}
            </td>
          </tr>
        </table>`;
}

/**
 * The "prepared for" panel — who the document is about.
 *
 * Lives here rather than in ClientInfoSection.js for two reasons. It is a pure
 * string builder that happened to sit in a file full of JSX, which meant every
 * consumer dragged @react-pdf/renderer in behind it — including a public POST
 * route that only wanted forty lines of HTML. And it was the only part of a
 * document's furniture that a non-PDF email could not reach without that
 * import, so the self-quote confirmation was one copy-paste away from
 * diverging from the quote it precedes. ClientInfoSection now calls this, so
 * there is one implementation and the PDF side keeps its API unchanged.
 *
 * @param label   "Prepared for", translated by the caller. It used to be a
 *                hardcoded English "PREPARED FOR" on a section whose PDF twin
 *                was already translated — a French quote with an English panel
 *                in the covering email.
 * @param client  { name, address, email, phone }; any of them may be absent.
 *                Returns "" when there is nothing to say rather than an empty
 *                titled box.
 */
export function preparedForBlock({ theme, label = "Prepared for", client = {} }) {
  if (!client.name && !client.address) return "";

  const contact = [client.email, client.phone].filter(Boolean).join(" · ");

  return `
    <div style="margin-bottom:16px;padding:12px 14px;background:${theme.accentWash};border-radius:8px;font-family:${EMAIL_FONT};">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;color:${theme.inkFaint};margin-bottom:4px;">${escapeHtml(String(label).toUpperCase())}</div>
      <div style="font-size:15px;font-weight:700;color:${theme.ink};">${escapeHtml(client.name || "")}</div>
      ${client.address ? `<div style="font-size:12px;color:${theme.inkMuted};">${escapeHtml(client.address)}</div>` : ""}
      ${contact ? `<div style="font-size:12px;color:${theme.inkMuted};">${escapeHtml(contact)}</div>` : ""}
    </div>
  `;
}

function mastheadIdentity(company, fill) {
  if (company.logoUrl) {
    return `
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
                      <tr>
                        <td bgcolor="#ffffff" style="background:#ffffff;border-radius:6px;padding:7px 10px;">
                          <img src="${escapeAttr(company.logoUrl)}" alt="${escapeAttr(company.name || "")}" width="auto" style="max-height:34px;max-width:170px;display:block;border:0;outline:none;text-decoration:none;" />
                        </td>
                      </tr>
                    </table>`;
  }
  return `<div style="font-family:${EMAIL_FONT};font-size:18px;font-weight:700;line-height:1.3;color:${fill.fg};">${escapeHtml(company.name || "")}</div>`;
}

/**
 * The full document.
 *
 * @param label      the document word, translated — "Quote" / "Facture"
 * @param reference  its number
 * @param body       already-built HTML for the middle of the card
 * @param footerNote the "questions?" line, already escaped by the caller
 *                   (it's one of emailCopy's sentences, not user input)
 */
export function documentEmailHtml({
  company = {},
  theme,
  fill,
  label = "",
  reference = "",
  body = "",
  footerNote = "",
}) {
  // Only what the company actually filled in. A footer that invents a line
  // because the field was blank is the "padding absent data" failure — and on
  // a client-facing surface it would be putting words under their name.
  // The tax registration number rides with the contact details — it is part of
  // who sent this, and on an invoice it is what lets the client claim the tax
  // back. Empty for a company that is not registered; see lib/documents/taxId.js.
  const contact = [company.email, company.phone, company.website, taxIdLine(company)]
    .filter(Boolean)
    .join("  ·  ");

  // Everything on the band uses fill.fg, the one foreground measured against
  // it. The obvious alternative — a softer tone for the document word, like
  // inkMuted on paper — would mean stepping that colour towards the fill, and
  // any step towards the fill costs contrast on the one surface where we have
  // none to spare. The two lines separate by size and weight instead.
  //
  // No HTML comments in the markup below. They travel to the client, and Gmail
  // clips a message at 102KB — commentary explaining our colour reasoning is
  // not what that budget is for.
  //
  // The brand band is the first mark in the message, ahead of any words: the
  // same device as the rule across the top of the PDF, so the email and the
  // document it carries read as one piece of stationery.
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<!-- Both of these were missing, and the first is not cosmetic: the footer
     separator is a middle dot and several clients — plus any browser opening a
     saved copy — fall back to Latin-1 without a declared charset and render it
     as "Â·". Accented client and company names hit the same thing. The viewport
     tag stops mobile Gmail/Outlook zooming a 560px card out to unreadable. -->
<meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:${theme.page};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${theme.page}" style="background:${theme.page};border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="560" style="width:100%;max-width:560px;border-collapse:separate;background:#ffffff;border:1px solid ${theme.border};border-radius:14px;overflow:hidden;">
          <tr>
            <td bgcolor="${fill.bg}" style="background:${fill.bg};padding:18px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td align="left" style="vertical-align:middle;">${mastheadIdentity(company, fill)}</td>
                  <td align="right" style="vertical-align:middle;text-align:right;font-family:${EMAIL_FONT};">
                    <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:${fill.fg};">${escapeHtml(String(label).toUpperCase())}</div>
                    <div style="font-size:15px;font-weight:700;line-height:1.4;color:${fill.fg};">${escapeHtml(reference)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td bgcolor="#ffffff" style="background:#ffffff;padding:26px 22px 24px;font-family:${EMAIL_FONT};color:${theme.ink};">
${body}
            </td>
          </tr>

          <tr>
            <td bgcolor="${theme.accentWash}" style="background:${theme.accentWash};border-top:1px solid ${theme.borderSoft};padding:18px 22px;font-family:${EMAIL_FONT};font-size:12px;line-height:1.6;color:${theme.inkMutedOnWash};">
              ${footerNote ? `<div style="padding-bottom:8px;">${footerNote}</div>` : ""}
              <div style="font-size:13px;font-weight:700;color:${theme.inkOnWash};">${escapeHtml(company.name || "")}</div>
              ${contact ? `<div style="padding-top:2px;">${escapeHtml(contact)}</div>` : ""}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
