// lib/documentSections/TotalsSection.js
import { View, Text } from "@react-pdf/renderer";
import {
  documentLabels,
  documentFormatters,
} from "@/lib/i18n/documentLabels";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { taxStatement } from "@/lib/tax/documentTax";
import { documentTaxSentence } from "@/lib/tax/documentSentence";
import { recordTaxResolution } from "@/lib/tax/taxResolution";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import {
  offlineDiscountAmount,
  offlineDiscountOfferLabel,
  offlineDiscountAppliedLabel,
} from "@/lib/payments/offlineDiscount";

export const meta = { type: "totals", label: "Totals" };

// ── The e-transfer / cheque discount, three ways ────────────────────────────
//
// A QUOTE that offers it prints the offer as a sentence under the totals —
// "Pay by e-transfer or cheque — 3% off (−$35.02)" — never as a row, because
// the total above it is the price before anyone has chosen. Once the client
// has chosen it (Quote.offlineDiscountChosen) AND the totals being printed
// are the accepted ones, it becomes a discount row and the total already
// reflects it: that is the signed copy and the filed copy. An unsigned copy
// of an accepted quote prints neither — its totals are the pre-acceptance
// figures and a row would contradict them. An INVOICE carries the amount
// folded into `discount` (Invoice.offlineDiscountAmount) and prints one line
// saying so under the discount row. See lib/payments/offlineDiscount.js.
function offlineDiscountFor(data, language, money) {
  if (data?.invoiceNumber) {
    const amount = Number(data.offlineDiscountAmount || 0);
    if (amount > 0) return { kind: "invoice", note: documentLabels(language).offlineDiscountIncluded };
    return null;
  }
  const pct = Number(data?.offlineDiscountPct);
  if (!Number.isFinite(pct) || pct <= 0) return null;
  const base = Math.max(0, Number(data.subtotal || 0) - Number(data.discount || 0));
  if (data.offlineDiscountChosen === true) {
    const acceptedTotal = data.acceptedTotal === null || data.acceptedTotal === undefined ? null : Number(data.acceptedTotal);
    if (acceptedTotal === null || Math.abs(Number(data.total || 0) - acceptedTotal) > 0.005) return null;
    return { kind: "row", label: offlineDiscountAppliedLabel(pct, language), amount: offlineDiscountAmount(base, pct) };
  }
  return {
    kind: "offer",
    note: `${offlineDiscountOfferLabel(pct, language)} (−${money(offlineDiscountAmount(base, pct))})`,
  };
}

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
    // What the line said when the document was written. A US document
    // explains its tax from this record, never from today's table.
    stored: data.taxResolution || null,
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

/**
 * The US line under the totals — "New York sales tax at 8.875% (ZIP 10001).
 * Rates as of September 2026." or the stated reason nothing is charged.
 * From the stored record first; from the live resolution only for a
 * document written before records existed, and only when that resolution
 * is a US one. "" for everything else — Canada and VAT have their own
 * furniture and this line is not it.
 */
function usNote(statement, language) {
  if (statement?.kind === "off") return "";
  const stored = statement?.stored;
  if (stored) return documentTaxSentence(stored, language);
  const live = statement?.resolution ? recordTaxResolution(statement.resolution) : null;
  return live?.country === "US" ? documentTaxSentence(live, language) : "";
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
  const us = usNote(tax.statement, language);
  const offline = offlineDiscountFor(data, language, money);

  return `
    <table style="width:100%;margin-top:16px;font-family:sans-serif;font-size:14px;">
      <tr><td>${t.subtotal}</td><td style="text-align:right;">${money(data.subtotal)}</td></tr>
      ${data.discount ? `<tr><td>${t.discount}</td><td style="text-align:right;">-${money(data.discount)}</td></tr>` : ""}
      ${offline?.kind === "invoice" ? `<tr><td colspan="2" style="font-size:11px;color:#6b7280;">${escapeHtml(offline.note)}</td></tr>` : ""}
      ${offline?.kind === "row" ? `<tr><td>${escapeHtml(offline.label)}</td><td style="text-align:right;">-${money(offline.amount)}</td></tr>` : ""}
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
      offline?.kind === "offer"
        ? `<p style="margin:8px 0 0;font-family:sans-serif;font-size:12px;color:#374151;">${escapeHtml(offline.note)}</p>`
        : ""
    }
    ${
      assumed
        ? `<p style="margin:8px 0 0;font-family:sans-serif;font-size:11px;color:#6b7280;">${escapeHtml(assumed)}</p>`
        : ""
    }
    ${
      us
        ? `<p style="margin:8px 0 0;font-family:sans-serif;font-size:11px;color:#6b7280;">${escapeHtml(us)}</p>`
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
  const us = usNote(tax.statement, language);
  const offline = offlineDiscountFor(data, language, money);

  const rows = [
    row(t.subtotal, data.subtotal, false, money),
    ...(data.discount ? [row(t.discount, -data.discount, false, money)] : []),
    // Under the discount row on an invoice priced for e-transfer / cheque:
    // the part of that discount which is the payment-method discount.
    ...(offline?.kind === "invoice" ? [{ label: offline.note, value: "", bold: false, note: true }] : []),
    ...(offline?.kind === "row" ? [row(offline.label, -offline.amount, false, money)] : []),
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
              <Text style={{ fontSize: r.note ? 7.5 : 9, color: theme.inkMuted, flex: 1 }}>
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

        {/* The offer, as a sentence under the band — the total above is the
            price before the client has chosen. See offlineDiscountFor. */}
        {offline?.kind === "offer" ? (
          <Text
            style={{
              fontSize: 8,
              fontFamily: PDF_FONT_BOLD,
              color: theme.ink,
              marginTop: 5,
              lineHeight: 1.35,
            }}
          >
            {offline.note}
          </Text>
        ) : null}
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
        {/* Same register: what a US tax line means, or why there is none. */}
        {us ? (
          <Text
            style={{
              fontSize: 7.5,
              color: theme.inkMuted,
              marginTop: 4,
              lineHeight: 1.35,
            }}
          >
            {us}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
