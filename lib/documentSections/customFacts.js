// lib/documentSections/customFacts.js
//
// The one place a custom field's answer is turned into a "label: value" line
// for a client-facing document. PDF (ClientInfoSection), the emailed copy
// (lib/email/quoteEmail.js, invoiceEmail.js) and the web copy (/q/[token],
// /portal/[token]) all call this, so a PO number reads identically on all
// three — invoices mirror quotes, and every copy of a document mirrors the
// others.
//
// Input is what lib/customFields/values.js loadDocumentCustomFields returns:
// already restricted to definitions flagged showOnDocuments with a non-empty
// answer. This function does not re-decide that; it only formats. JSX-free
// on purpose so the email builders can import it without pulling @react-pdf.

import { formatCustomValue } from "@/lib/customFields/validate";

/**
 * @param {Array<{ label: string, fieldType: string, value: string }>} customFields
 * @param {{ date: (v: any) => string, labels: { customYes: string, customNo: string } }} fmt
 * @returns {Array<[string, string]>}
 */
export function documentCustomFacts(customFields, { date, labels }) {
  if (!Array.isArray(customFields)) return [];
  const out = [];
  for (const f of customFields) {
    if (!f || typeof f !== "object") continue;
    const label = String(f.label || "").trim();
    if (!label) continue;
    const value = formatCustomValue(f, f.value, {
      formatDate: typeof date === "function" ? date : undefined,
      yes: labels?.customYes || "Yes",
      no: labels?.customNo || "No",
    });
    if (value === "") continue;
    out.push([label, value]);
  }
  return out;
}

// ── The emailed copy ─────────────────────────────────────────────────────────
//
// Under the amount block, one quiet line per fact ("PO number · 4471"), in
// the same muted ink the "valid until" line uses. Inline styles only — this
// is email HTML. `escape` is the caller's escapeHtml; passed in rather than
// imported so this file stays free of lib/email's own imports.
export function customFactsHtml(facts, { theme, font, escape }) {
  if (!Array.isArray(facts) || facts.length === 0) return "";
  const esc = typeof escape === "function" ? escape : (s) => String(s);
  const lines = facts
    .map(
      ([label, value]) =>
        `<span style="white-space:nowrap;">${esc(label)} · <strong style="color:${theme.ink};">${esc(value)}</strong></span>`,
    )
    .join(`<span style="color:${theme.inkMuted};">&nbsp;&nbsp;|&nbsp;&nbsp;</span>`);
  return `        <p style="font-family:${font};font-size:13px;line-height:1.7;color:${theme.inkMuted};margin:-6px 0 18px;text-align:center;">${lines}</p>\n`;
}

/** The same facts for the plain-text part: "PO number: 4471". */
export function customFactsText(facts) {
  if (!Array.isArray(facts) || facts.length === 0) return [];
  return facts.map(([label, value]) => `${label}: ${value}`);
}
