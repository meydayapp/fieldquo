// lib/documentSections/PaymentTermsSection.js
//
// When money changes hands, as cards rather than a sentence.
//
// ── Why cards ───────────────────────────────────────────────────────────────
//
// "50% deposit, balance on completion" buried in a paragraph of terms gets
// skimmed past, and then argued about later. The same information as three
// blocks with the percentage set large is read in about a second, and a client
// who has read it doesn't ring up surprised.
//
// ── Why the schedule is parsed rather than authored here ────────────────────
//
// Company.paymentTerms is a free-text field companies already fill in — "50%
// deposit, 50% on completion", "Net 30", "Due on receipt". Rather than adding
// a second structured field they'd have to fill in again, this reads what's
// there and renders cards when it can parse a schedule out of it, falling back
// to printing the text as written when it can't.
//
// That fallback matters more than the parser. A company whose terms are
// "Payment by e-transfer within 14 days of invoice" gets their sentence
// printed verbatim, which is correct, rather than a mangled attempt at cards.
//
// Nothing is invented: with no payment terms set, this section renders nothing
// at all rather than asserting a default schedule on the company's behalf.

import { View, Text } from "@react-pdf/renderer";
import { documentTheme } from "@/lib/documents/theme";
import { parsePaymentSchedule } from "@/lib/documents/paymentSchedule";
import { SectionLabel } from "./ScopeGroupsSection";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";

export const meta = { type: "payment_terms", label: "Payment terms" };

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function methodsLine(company) {
  const methods = Array.isArray(company.paymentMethods)
    ? company.paymentMethods
    : [];
  if (!methods.length) return "";
  const pretty = methods
    .map((m) =>
      String(m)
        .replace(/_/g, "-")
        .replace(/\b\w/g, (c) => c.toUpperCase()),
    )
    .join(" · ");
  return `Accepted: ${pretty}`;
}

export function renderEmailHtml({ company = {} }) {
  const terms = company.paymentTerms;
  if (!terms) return "";

  const t = documentTheme(company);
  const schedule = parsePaymentSchedule(terms);
  const methods = methodsLine(company);

  if (!schedule) {
    return `
      <div style="margin-top:20px;font-family:Helvetica,Arial,sans-serif;">
        <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${t.accentText};margin-bottom:6px;">PAYMENT TERMS</div>
        <div style="font-size:13px;color:${t.ink};">${escapeHtml(terms)}</div>
        ${methods ? `<div style="font-size:12px;color:${t.inkMuted};margin-top:4px;">${escapeHtml(methods)}</div>` : ""}
      </div>
    `;
  }

  return `
    <div style="margin-top:20px;font-family:Helvetica,Arial,sans-serif;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${t.accentText};margin-bottom:8px;">PAYMENT TERMS</div>
      <table style="width:100%;border-collapse:separate;border-spacing:6px 0;">
        <tr>
          ${schedule
            .map(
              (s) => `
            <td style="width:${Math.floor(100 / schedule.length)}%;vertical-align:top;background:${t.accentWash};border:1px solid ${t.accentRule};border-radius:8px;padding:10px 12px;">
              <div style="font-size:22px;font-weight:800;color:${t.accentText};line-height:1;">${s.pct}</div>
              <div style="font-size:12px;font-weight:700;color:${t.ink};margin-top:3px;">${escapeHtml(s.label)}</div>
            </td>`,
            )
            .join("")}
        </tr>
      </table>
      ${methods ? `<div style="font-size:12px;color:${t.inkMuted};margin-top:8px;">${escapeHtml(methods)}</div>` : ""}
    </div>
  `;
}

export function PdfSection({ company = {} }) {
  const terms = company.paymentTerms;
  // Say nothing rather than assert a schedule the company never agreed to.
  if (!terms) return null;

  const t = documentTheme(company);
  const schedule = parsePaymentSchedule(terms);
  const methods = methodsLine(company);

  return (
    <View style={{ marginTop: 14 }} wrap={false}>
      <SectionLabel theme={t}>Payment terms</SectionLabel>

      {schedule ? (
        <View style={{ flexDirection: "row", gap: 6 }}>
          {schedule.map((s, i) => (
            <View
              key={i}
              style={{
                flex: 1,
                backgroundColor: t.accentWash,
                border: `1 solid ${t.accentRule}`,
                borderRadius: 4,
                paddingVertical: 8,
                paddingHorizontal: 9,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontFamily: PDF_FONT_BOLD,
                  color: t.accentText,
                }}
              >
                {s.pct}
              </Text>
              <Text
                style={{
                  fontSize: 8,
                  fontFamily: PDF_FONT_BOLD,
                  color: t.ink,
                  marginTop: 2,
                }}
              >
                {s.label}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={{ fontSize: 9, color: t.ink, lineHeight: 1.5 }}>
          {terms}
        </Text>
      )}

      {methods ? (
        <Text style={{ fontSize: 8, color: t.inkMuted, marginTop: 7 }}>
          {methods}
        </Text>
      ) : null}
    </View>
  );
}
