// lib/documentSections/ReportHeaderSection.js
//
// The masthead of the instant-estimate report: brand rule, logo, the CALL /
// EMAIL / WEBSITE tiles and the title block ("Your free roofing estimate —
// prepared for <address> · prepared by <company> · <date>").
//
// Everything printed comes from `data.report`, built once by
// lib/estimate/report/model.js; this file lays it out. Not the quote
// HeaderSection because that one prints "QUOTE Q-2026-0011" — a document
// word the homeowner has not been sent yet. The report is the estimate they
// asked for, and says so.
//
// Report sections are listed in sectionMeta with `types: ["estimate_report_pdf"]`
// so the template editor never offers them on a quote or invoice. Rendered
// on a document with no `report` they print nothing.

import { View, Text, Image } from "@react-pdf/renderer";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { reportPalette, reportFrom } from "./reportShared";

export const meta = { type: "report_header", label: "Estimate report header" };

export function renderEmailHtml() {
  // The covering email is lib/estimate/report/email.js; the sections are the
  // PDF only.
  return "";
}

function Tile({ label, text, palette }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.fill.bg,
        borderRadius: 6,
        paddingVertical: 7,
        paddingHorizontal: 8,
        marginRight: 6,
      }}
    >
      <Text style={{ fontSize: 7, letterSpacing: 1, fontFamily: PDF_FONT_BOLD, color: palette.fill.fg }}>
        {String(label).toUpperCase()}
      </Text>
      <Text style={{ fontSize: 8, color: palette.fill.fg, marginTop: 2 }}>{text}</Text>
    </View>
  );
}

export function PdfSection({ company = {}, data = {} }) {
  const report = reportFrom(data);
  if (!report) return null;
  const palette = reportPalette(company);
  const { theme } = palette;
  const h = report.header;
  const tiles = [
    h.call && { label: h.call.label, text: h.call.text },
    h.email && { label: h.email.label, text: h.email.text },
    h.website && { label: h.website.label, text: h.website.href.replace(/^https?:\/\//, "").replace(/\/$/, "") },
  ].filter(Boolean);

  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: 14 }}>
        <View style={{ height: 4, flex: 2, backgroundColor: palette.rule }} />
        <View style={{ height: 4, flex: 1, backgroundColor: theme.accentSoft }} />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          {h.logoUrl ? (
            <Image src={h.logoUrl} style={{ height: 34, maxWidth: 170, objectFit: "contain", alignSelf: "flex-start", marginBottom: 4 }} />
          ) : null}
          <Text style={{ fontSize: h.logoUrl ? 9 : 15, fontFamily: PDF_FONT_BOLD, color: h.logoUrl ? theme.ink : theme.accentText }}>
            {h.companyName}
          </Text>
        </View>
        {tiles.length > 0 && (
          <View style={{ flexDirection: "row", width: 300 }}>
            {tiles.map((t) => (
              <Tile key={t.label} label={t.label} text={t.text} palette={palette} />
            ))}
          </View>
        )}
      </View>

      <View style={{ marginTop: 18, paddingBottom: 12, borderBottom: `1 solid ${theme.accentRule}` }}>
        <Text style={{ fontSize: 20, fontFamily: PDF_FONT_BOLD, color: theme.ink }}>{report.title.text}</Text>
        {report.title.preparedFor && (
          <Text style={{ fontSize: 9, marginTop: 6, color: theme.inkMuted }}>
            <Text style={{ fontFamily: PDF_FONT_BOLD, letterSpacing: 1, color: theme.accentText }}>
              {String(report.title.preparedForLabel).toUpperCase()}
            </Text>
            {"  "}
            {report.title.preparedFor}
          </Text>
        )}
        <Text style={{ fontSize: 8.5, marginTop: 3, color: theme.inkMuted }}>
          {[report.title.preparedBy, report.title.date].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </View>
  );
}
