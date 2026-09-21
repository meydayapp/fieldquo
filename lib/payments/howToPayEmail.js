// lib/payments/howToPayEmail.js
//
// The "How to pay" block as EMAIL — HTML and its plain-text twin — painted
// from the model buildHowToPay() rendered (lib/payments/offlineMethods.js).
//
// A separate file from lib/documentSections/HowToPaySection.js, which paints
// the same block for the PDF, because that one is JSX for @react-pdf and
// lib/email/invoiceEmail.js is imported by plain-node check scripts
// (check-document-emails, check-service-plans, check-email-links) that
// cannot parse JSX. No React here; strings only.
//
// One rule this file enforces that the PDF does not: a bank account number
// never goes in an email body. `emailLinesFor` swaps a document-only method's
// lines for "the details are on the invoice", in the block's own language.

import { washPair } from "@/lib/documents/theme";
import { emailLinesFor } from "@/lib/payments/offlineMethods";

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The HTML the invoice email carries — the same block, with a bank account
 * number replaced by "the details are on the invoice" (emailLinesFor).
 * Shared by lib/email/invoiceEmail.js and the two document sections that
 * carry the block, so every email prints one thing.
 */
export function howToPayEmailHtml(block, { theme, font = "Helvetica,Arial,sans-serif", showUrl = false } = {}) {
  if (!block) return "";
  const t = theme;
  const wash = washPair(t);
  // The invoice email has the Pay button a few lines up, so the online row
  // names the methods and leaves the URL to the button (and to the "or
  // paste" line under it). `showUrl` is for a surface with no button.
  const online = block.online
    ? `<tr><td style="padding:10px 12px;background:${wash.bg};border:1px solid ${t.accentRule};border-radius:8px;">
        <div style="font-family:${font};font-size:13px;font-weight:700;color:${wash.accent};">${escapeHtml(block.online.line)}</div>
        ${showUrl && block.online.at ? `<div style="font-family:${font};font-size:12px;color:${wash.muted};margin-top:2px;word-break:break-all;">${escapeHtml(block.online.at)}</div>` : ""}
      </td></tr>`
    : "";
  const rows = block.methods
    .map(
      (m) => `<tr><td style="padding:8px 0 0;">
        <div style="font-family:${font};font-size:13px;font-weight:700;color:${t.ink};">${escapeHtml(m.label)}</div>
        ${emailLinesFor(block, m)
          .map((line) => `<div style="font-family:${font};font-size:12px;line-height:1.5;color:${t.inkMuted};">${escapeHtml(line)}</div>`)
          .join("")}
      </td></tr>`,
    )
    .join("");
  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;border-collapse:separate;">
        <tr><td style="padding:0 0 6px;font-family:${font};font-size:11px;font-weight:700;letter-spacing:1px;color:${t.accentText};">${escapeHtml(block.title).toUpperCase()}</td></tr>
        ${online}
        ${rows}
      </table>`;
}

/** The plain-text twin of howToPayEmailHtml. */
export function howToPayEmailText(block) {
  if (!block) return [];
  const out = [block.title.toUpperCase()];
  if (block.online) out.push(block.online.line);
  for (const m of block.methods) out.push(`${m.label}: ${emailLinesFor(block, m).join(" ")}`);
  return out;
}
