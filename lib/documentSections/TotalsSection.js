// lib/documentSections/TotalsSection.js
import { View, Text } from "@react-pdf/renderer";
import {
  documentLabels,
  documentFormatters,
} from "@/lib/i18n/documentLabels";
import { documentTheme, fillPair } from "@/lib/documents/theme";

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

export function PdfSection({ data, company = {}, language }) {
  const t = documentLabels(language);
  const theme = documentTheme(company);
  // Guaranteed-visible band even when the brand colour is near-white.
  const fill = fillPair(theme);
  const { money } = documentFormatters(language);
  const hasPayments = data.amountPaid !== undefined && data.amountPaid !== null;
  const balanceDue = hasPayments ? Number(data.amountDue ?? data.total) : null;

  const rows = [
    row(t.subtotal, data.subtotal, false, money),
    ...(data.discount ? [row(t.discount, -data.discount, false, money)] : []),
    row(t.tax, data.tax, false, money),
    ...(hasPayments ? [row(t.amountPaid, -data.amountPaid, false, money)] : []),
  ];

  // The headline figure sits in a filled band in the company's colour, and
  // everything above it is quiet. Previously subtotal, tax and total were the
  // same weight one line apart, so the eye had to read three numbers to find
  // the one that matters — on the single most-looked-at line of the document.
  const headlineLabel = hasPayments ? t.balanceDue : t.total;
  const headlineValue = hasPayments ? balanceDue : Number(data.total ?? 0);

  return (
    <View
      style={{ marginTop: 16, flexDirection: "row", justifyContent: "flex-end" }}
      wrap={false}
    >
      {/* Right-aligned and narrow. A totals block spanning the full page reads
          as another table; kept to a third it reads as a summary. */}
      <View style={{ width: "58%" }}>
        <View
          style={{
            paddingHorizontal: 10,
            paddingTop: 8,
            paddingBottom: 6,
            backgroundColor: theme.accentWash,
            borderTopLeftRadius: 4,
            borderTopRightRadius: 4,
          }}
        >
          {rows.map((r, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 2.5,
              }}
            >
              <Text style={{ fontSize: 9, color: theme.inkMuted }}>
                {r.label}
              </Text>
              <Text style={{ fontSize: 9, color: theme.ink }}>{r.value}</Text>
            </View>
          ))}
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            paddingHorizontal: 10,
            paddingVertical: 8,
            backgroundColor: fill.bg,
            borderBottomLeftRadius: 4,
            borderBottomRightRadius: 4,
          }}
        >
          <Text
            style={{
              fontSize: 9,
              fontFamily: "Helvetica-Bold",
              color: fill.fg,
              letterSpacing: 0.5,
            }}
          >
            {String(headlineLabel).toUpperCase()}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: "Helvetica-Bold",
              // Measured against the fill, not assumed white — a pale brand
              // colour would otherwise put white text on a white band and
              // hide the total entirely.
              color: fill.fg,
            }}
          >
            {money(headlineValue)}
          </Text>
        </View>
      </View>
    </View>
  );
}
