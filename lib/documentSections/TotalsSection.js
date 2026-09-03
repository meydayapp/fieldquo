// lib/documentSections/TotalsSection.js
import { View, Text } from "@react-pdf/renderer";
import {
  documentLabels,
  documentFormatters,
} from "@/lib/i18n/documentLabels";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { taxStatement } from "@/lib/tax/documentTax";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";

export const meta = { type: "totals", label: "Totals" };

// ── Why the tax row is not simply money(data.tax) ──────────────────────────
//
// It was, and that is how Q-2026-0011 reached a homeowner reading
//
//     Subtotal   $5,250.00
//     Tax            $0.00
//     TOTAL      $5,250.00
//
// with taxEnabled TRUE on the row. "$0.00" in a money column is a statement —
// tax was considered, and the answer was nothing — and the document was in no
// position to make it. The client's record had no province and no country, the
// company had no fallback rate, and $682.50 of Ontario HST simply went
// unmentioned.
//
// So the value in that row now depends on what the document can actually say.
// Absence of a statement is not a statement (AGENTS.md), and the four cases
// are lib/tax/documentTax.js's four kinds:
//
//   charged     a money figure, as before
//   off / none  the WORD "None" — a deliberate zero, said in words so it
//               cannot be misread as a computed one
//   unresolved  "To be confirmed" — never a figure
//
// This changes no total and re-prices nothing: `data.total` is untouched in
// every branch. A quote keeps the tax it was sent with; what changes is
// whether the document is honest about where that tax came from.
function taxRowValue(data, company, language, money) {
  const t = documentLabels(language);
  const statement = taxStatement({
    taxEnabled: data.taxEnabled,
    tax: data.tax,
    company,
    // The document row carries its client on the same object in every renderer
    // that has one. Where it does not, the statement falls back to the
    // company's own jurisdiction — which still beats printing a bare zero.
    client: data.client || null,
    lang: language,
  });

  if (statement.kind === "charged")
    return { text: money(data.tax), statement };
  if (statement.kind === "unresolved")
    return { text: t.taxUnresolved, statement };
  return { text: t.taxNone, statement };
}

/**
 * The sentence under the totals when the rate came from the COMPANY's province
 * rather than the client's, or "" when nothing was assumed.
 *
 * The homeowner is the one person who can correct this, which is why it is on
 * their copy and not only on the estimator's screen. An Ottawa contractor
 * quoting a Gatineau kitchen assumes 13% where 14.975% is owed; the client
 * reading "the Ontario rate" on a Quebec job says so immediately.
 */
function assumedNote(statement, language) {
  if (!statement?.assumed || !statement.assumedRegion) return "";
  return documentLabels(language).taxAssumedNote.replace(
    "{region}",
    statement.assumedRegion,
  );
}

// `language` is threaded down from renderDocumentPdfBuffer / renderFromTemplate
// and is the language the QUOTE WAS WRITTEN IN — not a viewer preference.
// A document is produced once, in one language, and stays that way; see
// app/components/quotes/QuoteLanguageBar.js.
function row(label, value, bold, money) {
  return { label, value: money(value), bold };
}

export function renderEmailHtml({ data, company = {}, language }) {
  const t = documentLabels(language);
  const { money } = documentFormatters(language, company?.currency);
  const hasPayments = data.amountPaid !== undefined && data.amountPaid !== null;
  const balanceDue = hasPayments ? Number(data.amountDue ?? data.total) : null;
  const tax = taxRowValue(data, company, language, money);
  const assumed = assumedNote(tax.statement, language);

  return `
    <table style="width:100%;margin-top:16px;font-family:sans-serif;font-size:14px;">
      <tr><td>${t.subtotal}</td><td style="text-align:right;">${money(data.subtotal)}</td></tr>
      ${data.discount ? `<tr><td>${t.discount}</td><td style="text-align:right;">-${money(data.discount)}</td></tr>` : ""}
      <tr><td>${t.tax}</td><td style="text-align:right;">${escapeHtml(tax.text)}</td></tr>
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
    ${
      assumed
        ? `<p style="margin:8px 0 0;font-family:sans-serif;font-size:11px;color:#6b7280;">${escapeHtml(assumed)}</p>`
        : ""
    }
  `;
}

// The labels are ours and the region names come from a closed table, so
// neither can carry markup today. Escaped anyway: this is the one function
// here that emits raw HTML, and "it can't contain a quote yet" is the
// assumption that stops being true the first time a company names a tax rate.
function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export function PdfSection({ data, company = {}, language }) {
  const t = documentLabels(language);
  const theme = documentTheme(company);
  // Guaranteed-visible band even when the brand colour is near-white.
  const fill = fillPair(theme);
  const { money } = documentFormatters(language, company?.currency);
  const hasPayments = data.amountPaid !== undefined && data.amountPaid !== null;
  const balanceDue = hasPayments ? Number(data.amountDue ?? data.total) : null;

  const tax = taxRowValue(data, company, language, money);
  const assumed = assumedNote(tax.statement, language);

  const rows = [
    row(t.subtotal, data.subtotal, false, money),
    ...(data.discount ? [row(t.discount, -data.discount, false, money)] : []),
    // Pre-formatted: this row is not always a number. See taxRowValue.
    { label: t.tax, value: tax.text, bold: false },
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
              fontFamily: PDF_FONT_BOLD,
              color: fill.fg,
              letterSpacing: 0.5,
            }}
          >
            {String(headlineLabel).toUpperCase()}
          </Text>
          <Text
            style={{
              fontSize: 14,
              fontFamily: PDF_FONT_BOLD,
              // Measured against the fill, not assumed white — a pale brand
              // colour would otherwise put white text on a white band and
              // hide the total entirely.
              color: fill.fg,
            }}
          >
            {money(headlineValue)}
          </Text>
        </View>

        {/* Under the band, quiet, and only when a province was assumed. The
            homeowner is the one person who can correct it — see assumedNote. */}
        {assumed ? (
          <Text
            style={{
              fontSize: 7.5,
              color: theme.inkMuted,
              marginTop: 4,
              lineHeight: 1.35,
            }}
          >
            {assumed}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
