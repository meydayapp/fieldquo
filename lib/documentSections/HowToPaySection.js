// lib/documentSections/HowToPaySection.js
//
// "How to pay": the online link and every offline method the company has
// switched on, each with the address to send to and the invoice number as
// the reference.
//
// ── Why a section rather than a line ────────────────────────────────────────
//
// The invoice used to end with "Accepted: Cash · E-transfer · Cheque" — the
// names of three methods and nothing a client could act on. The owner's
// brief: the options a company selects "should also appear in the invoice —
// pay online or via those options", with the e-transfer address on it. So
// this prints what the client needs to do, in the document's language, and
// prints nothing at all when nothing is on (no heading over an empty list).
//
// ── Where the words come from ───────────────────────────────────────────────
//
// Nothing here composes a sentence. `howToPayFor()` returns the block as
// stored on the invoice at send time (Invoice.howToPay — non-negotiable #6,
// a document keeps what it said), or builds it fresh from the company's live
// settings for a draft that has never been sent. This file only paints
// strings, so the PDF, the email, the portal and the quote page cannot
// disagree about an address. See lib/payments/offlineMethods.js.
//
// A paid invoice prints nothing: a receipt does not ask how to pay.
//
// The email rendering lives in lib/payments/howToPayEmail.js, not here:
// this file is JSX for @react-pdf, and lib/email/invoiceEmail.js — read by
// plain-node check scripts — must not import a module node cannot parse.

import { View, Text } from "@react-pdf/renderer";
import { documentTheme, washPair } from "@/lib/documents/theme";
import { howToPayFor } from "@/lib/payments/offlineMethods";
import { howToPayEmailHtml } from "@/lib/payments/howToPayEmail";
import { SectionLabel } from "./ScopeGroupsSection";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";

export const meta = { type: "how_to_pay", label: "How to pay" };

function settled(data) {
  const total = Number(data?.total ?? 0);
  const paid = Number(data?.amountPaid ?? 0);
  return total - paid <= 0.005;
}

/**
 * The block for THIS document. Exported so the template preview and the
 * check script read the same decision the renderers do.
 */
export function howToPayBlock({ data = {}, company = {}, language }) {
  if (settled(data)) return null;
  return howToPayFor(data, { company, language });
}

export function renderEmailHtml({ data = {}, company = {}, language }) {
  const block = howToPayBlock({ data, company, language });
  if (!block) return "";
  return howToPayEmailHtml(block, { theme: documentTheme(company) });
}

/**
 * The block's body for a PDF — the online card and one row per method.
 * Shared with PaymentTermsSection, which paints the same rows under a
 * quote's deposit cards, so the two documents cannot drift apart.
 */
export function HowToPayPdfRows({ block, theme: t }) {
  const wash = washPair(t);
  return (
    <View>
      {block.online ? (
        <View
          style={{
            backgroundColor: wash.bg,
            border: `1 solid ${t.accentRule}`,
            borderRadius: 4,
            paddingVertical: 7,
            paddingHorizontal: 9,
            marginBottom: 6,
          }}
        >
          <Text style={{ fontSize: 9, fontFamily: PDF_FONT_BOLD, color: wash.accent }}>{block.online.line}</Text>
          {block.online.at ? (
            <Text style={{ fontSize: 8, color: wash.muted, marginTop: 2 }}>{block.online.at}</Text>
          ) : null}
        </View>
      ) : null}

      {block.methods.map((m) => (
        <View key={m.method} style={{ flexDirection: "row", marginTop: 3 }}>
          <Text style={{ width: 118, fontSize: 8.5, fontFamily: PDF_FONT_BOLD, color: t.ink }}>{m.label}</Text>
          <View style={{ flex: 1 }}>
            {m.lines.length ? (
              m.lines.map((line, i) => (
                <Text key={i} style={{ fontSize: 8.5, color: t.inkMuted, lineHeight: 1.4 }}>
                  {line}
                </Text>
              ))
            ) : (
              <Text style={{ fontSize: 8.5, color: t.inkMuted }}> </Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}

export function PdfSection({ data = {}, company = {}, language }) {
  const block = howToPayBlock({ data, company, language });
  if (!block) return null;
  const t = documentTheme(company);
  return (
    <View style={{ marginTop: 14 }} wrap={false}>
      <SectionLabel theme={t}>{block.title}</SectionLabel>
      <HowToPayPdfRows block={block} theme={t} />
    </View>
  );
}
