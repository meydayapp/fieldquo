// lib/documentSections/TotalsSection.js
import { View, Text } from "@react-pdf/renderer";
import {
  documentLabels,
  documentFormatters,
} from "@/lib/i18n/documentLabels";

export const meta = { type: "totals", label: "Totals" };

// `language` is threaded down from renderDocumentPdfBuffer / renderFromTemplate
// and is the language the QUOTE WAS WRITTEN IN — not a viewer preference.
// A document is produced once, in one language, and stays that way; see
// app/components/quotes/QuoteLanguageBar.js.
function row(label, value, bold, money) {
  return { label, value: money(value), bold };
}

export function renderEmailHtml({ data, language }) {
  const t = documentLabels(language);
  const { money } = documentFormatters(language);
  const hasPayments = data.amountPaid !== undefined && data.amountPaid !== null;
  const balanceDue = hasPayments ? Number(data.amountDue ?? data.total) : null;

  return `
    <table style="width:100%;margin-top:16px;font-family:sans-serif;font-size:14px;">
      <tr><td>${t.subtotal}</td><td style="text-align:right;">${money(data.subtotal)}</td></tr>
      ${data.discount ? `<tr><td>${t.discount}</td><td style="text-align:right;">-${money(data.discount)}</td></tr>` : ""}
      <tr><td>${t.tax}</td><td style="text-align:right;">${money(data.tax)}</td></tr>
      <tr style="font-weight:700;"><td>${t.total}</td><td style="text-align:right;">${money(data.total)}</td></tr>
      ${
        hasPayments
          ? `
        <tr><td>${t.amountPaid}</td><td style="text-align:right;">-${money(data.amountPaid)}</td></tr>
        <tr style="font-weight:700;color:${balanceDue > 0 ? "#cf222e" : "#2ea043"};">
          <td>${t.balanceDue}</td><td style="text-align:right;">${money(balanceDue)}</td>
        </tr>
      `
          : ""
      }
    </table>
  `;
}

export function PdfSection({ data, language }) {
  const t = documentLabels(language);
  const { money } = documentFormatters(language);
  const hasPayments = data.amountPaid !== undefined && data.amountPaid !== null;
  const balanceDue = hasPayments ? Number(data.amountDue ?? data.total) : null;

  const rows = [
    row(t.subtotal, data.subtotal, false, money),
    ...(data.discount ? [row(t.discount, -data.discount, false, money)] : []),
    row(t.tax, data.tax, false, money),
    row(t.total, data.total, true, money),
    ...(hasPayments ? [row(t.amountPaid, -data.amountPaid, false, money)] : []),
  ];

  return (
    <View style={{ marginTop: 16, borderTop: "1 solid #ddd", paddingTop: 8 }}>
      {rows.map((r, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 2,
          }}
        >
          <Text
            style={{
              fontSize: r.bold ? 11 : 10,
              fontFamily: r.bold ? "Helvetica-Bold" : "Helvetica",
            }}
          >
            {r.label}
          </Text>
          <Text
            style={{
              fontSize: r.bold ? 11 : 10,
              fontFamily: r.bold ? "Helvetica-Bold" : "Helvetica",
            }}
          >
            {r.value}
          </Text>
        </View>
      ))}

      {hasPayments && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 4,
            paddingTop: 4,
            borderTop: "1 solid #ddd",
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>
            {t.balanceDue}
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Helvetica-Bold",
              color: balanceDue > 0 ? "#cf222e" : "#2ea043",
            }}
          >
            {money(balanceDue)}
          </Text>
        </View>
      )}
    </View>
  );
}
