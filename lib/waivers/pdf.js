// lib/waivers/pdf.js
//
// The signed waiver as a PDF: the company's letterhead rule, the title, the
// sections as the client read them, every acknowledgement with its tick and
// time, then the drawn signature, the name, the date, and the audit line
// (IP, device, hash). Filed on the job as a JobDocument of kind "waiver" and
// emailed to the client — one document, both sides.
//
// The same engine, fonts and measured theme as the quote PDF
// (app/admin/lib/pdf/renderDocumentPdf.js). Imported lazily by the signing
// route: a stranger's GET of a waiver page has no business loading a PDF
// engine.
//
// Rendered in the WAIVER's own language: the text is stored as written and
// printed as-is (AGENTS.md non-negotiable #6); the labels around it follow
// the language the client signed in.

import { Document, Page, View, Text, Image, renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts, PDF_FONT, PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { documentTheme, ruleColor } from "@/lib/documents/theme";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { sanitiseWaiverBody } from "@/lib/company/documents";

/**
 * @param company   { name, brandColor, phone, logoUrl }
 * @param document  { title, body }
 * @param record    { acknowledgements: [{ text, tickedAt }], signature, signedAt, documentHash }
 * @param language  the client's document language, for the labels
 * @param attachedTo  "Q-2026-0142" / "INV-…" / a job title — printed under the title
 */
export async function renderWaiverPdf({ company = {}, document, record, language = "en", attachedTo = "" }) {
  registerPdfFonts();
  const t = documentTheme(company);
  const rule = ruleColor(t);
  const copy = clientDocCopy(language);
  const fmt = documentFormatters(language, company.currency);
  const body = sanitiseWaiverBody(document?.body) || { sections: [], acknowledgements: [] };
  const sig = record?.signature || {};
  const ticks = Array.isArray(record?.acknowledgements) ? record.acknowledgements : [];

  const doc = (
    <Document>
      <Page size="LETTER" style={{ padding: 40, fontFamily: PDF_FONT, fontSize: 10, color: t.ink }}>
        <View style={{ flexDirection: "row", height: 5, marginBottom: 14 }}>
          <View style={{ flex: 2, backgroundColor: rule }} />
          <View style={{ flex: 1, backgroundColor: t.accentSoft }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            {company.logoUrl ? <Image src={company.logoUrl} style={{ height: 28, maxWidth: 120, objectFit: "contain" }} /> : null}
            <View>
              <Text style={{ fontFamily: PDF_FONT_BOLD, fontSize: 12 }}>{company.name || ""}</Text>
              {company.phone ? <Text style={{ fontSize: 8, color: t.inkMuted }}>{company.phone}</Text> : null}
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontFamily: PDF_FONT_BOLD, fontSize: 9, letterSpacing: 1, color: t.accentText }}>
              {copy.waiverKicker.toUpperCase()}
            </Text>
            {attachedTo ? <Text style={{ fontSize: 8, color: t.inkMuted }}>{copy.waiverAttachedTo(attachedTo)}</Text> : null}
          </View>
        </View>

        <Text style={{ fontFamily: PDF_FONT_BOLD, fontSize: 15, marginBottom: 10 }}>{document?.title || ""}</Text>

        {body.sections.map((s, i) => (
          <View key={i} style={{ marginBottom: 9 }} wrap={false}>
            {s.heading ? (
              <Text style={{ fontFamily: PDF_FONT_BOLD, fontSize: 8, letterSpacing: 0.8, color: t.accentText, marginBottom: 2 }}>
                {`${i + 1} · ${s.heading}`.toUpperCase()}
              </Text>
            ) : null}
            <Text style={{ fontSize: 9.5, lineHeight: 1.45 }}>{s.text}</Text>
          </View>
        ))}

        <View style={{ marginTop: 6, marginBottom: 12 }}>
          <Text style={{ fontFamily: PDF_FONT_BOLD, fontSize: 8, letterSpacing: 0.8, color: t.accentText, marginBottom: 4 }}>
            {copy.waiverAcknowledgements.toUpperCase()}
          </Text>
          {ticks.map((a, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 6, marginBottom: 3 }}>
              <Text style={{ fontFamily: PDF_FONT_BOLD, color: t.positive }}>✓</Text>
              <Text style={{ flex: 1, fontSize: 9 }}>
                {a.text}
                <Text style={{ color: t.inkMuted, fontSize: 7.5 }}>{`  ${fmt.date(a.tickedAt)}`}</Text>
              </Text>
            </View>
          ))}
        </View>

        <View style={{ borderTop: `1 solid ${t.border}`, paddingTop: 10, flexDirection: "row", gap: 16, alignItems: "flex-end" }} wrap={false}>
          <View style={{ flex: 1 }}>
            {sig.signatureDataUrl ? <Image src={sig.signatureDataUrl} style={{ height: 40, marginBottom: 3 }} /> : null}
            <View style={{ borderBottom: `1 solid ${t.inkFaint}`, marginBottom: 3 }} />
            <Text style={{ fontSize: 7.5, fontFamily: PDF_FONT_BOLD, color: t.inkMuted }}>{sig.name || ""}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 8, color: t.inkMuted }}>{copy.waiverSignedOn(fmt.date(record?.signedAt))}</Text>
            {sig.ip ? <Text style={{ fontSize: 7, color: t.inkFaint }}>IP {sig.ip}</Text> : null}
            {record?.documentHash ? (
              <Text style={{ fontSize: 6.5, color: t.inkFaint }}>{`SHA-256 ${String(record.documentHash).slice(0, 32)}…`}</Text>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
