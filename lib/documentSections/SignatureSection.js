// lib/documentSections/SignatureSection.js
//
// Somewhere to sign.
//
// ── Why a printed quote still needs this in 2026 ────────────────────────────
//
// FieldQuo's own approval flow is a link and a button, which is better in
// every way — it timestamps, it notifies, it records which optional extras
// were ticked. But a real fraction of these documents get printed at a kitchen
// table, or forwarded to a property manager whose process is "sign and scan",
// or handed over on a clipboard because the client is eighty and doesn't do
// links. A PDF with nowhere to sign quietly excludes all of them.
//
// So: on a QUOTE, three ruled fields and a line saying what signing means.
// On an invoice this section renders nothing — an invoice isn't an offer to
// accept, and asking someone to sign one implies a dispute that isn't there.
//
// The wording is deliberately plain and short. Long acceptance language on a
// document that also has a one-click approve button is theatre, and anything
// resembling a real contract term is the company's lawyer's job, not a
// default's.

import { View, Text } from "@react-pdf/renderer";
import { documentTheme, ruleColor } from "@/lib/documents/theme";
import { documentFormatters } from "@/lib/i18n/documentLabels";

export const meta = { type: "signature", label: "Signature block" };

// Invoices carry an invoiceNumber; quotes don't. Cheaper and more reliable
// than threading the document type down through every caller.
const isInvoice = (data = {}) => Boolean(data.invoiceNumber);

export function renderEmailHtml() {
  // Never in email. A signature line in an HTML email is an image of a line —
  // it can't be signed, and it makes the email look like a fax.
  return "";
}

export function PdfSection({ data = {}, company = {}, language }) {
  if (isInvoice(data)) return null;

  const t = documentTheme(company);
  const { money } = documentFormatters(language);
  const total = Number(data.total ?? 0);

  return (
    <View
      wrap={false}
      style={{
        marginTop: 18,
        paddingTop: 12,
        borderTop: `1 solid ${ruleColor(t)}`,
      }}
    >
      <Text
        style={{
          fontSize: 9,
          fontFamily: "Helvetica-Bold",
          color: t.accentText,
          marginBottom: 3,
        }}
      >
        Approval
      </Text>

      <Text
        style={{
          fontSize: 8,
          color: t.inkMuted,
          lineHeight: 1.5,
          marginBottom: 16,
        }}
      >
        Signing below accepts this quote{total > 0 ? ` at ${money(total)}` : ""}{" "}
        and the scope of work set out above.
        {company.paymentTerms ? " Payment terms as stated." : ""}
      </Text>

      <View style={{ flexDirection: "row", gap: 16 }}>
        {["Signature", "Name", "Date"].map((label) => (
          <View key={label} style={{ flex: 1 }}>
            <View
              style={{
                borderBottom: `1 solid ${t.inkFaint}`,
                height: 18,
                marginBottom: 3,
              }}
            />
            <Text
              style={{
                fontSize: 7,
                fontFamily: "Helvetica-Bold",
                color: t.inkMuted,
              }}
            >
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
