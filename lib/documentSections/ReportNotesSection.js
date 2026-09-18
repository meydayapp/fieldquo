// lib/documentSections/ReportNotesSection.js
//
// The foot of the report: "Report notes" (a copy was emailed), "What happens
// next" (two numbered steps), the two disclaimers the asterisks in the
// options and measurement sections point at, and the Report ID with the
// "View online" permalink.

import { View, Text, Link } from "@react-pdf/renderer";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { reportPalette, reportFrom, ReportHeading } from "./reportShared";

export const meta = { type: "report_notes", label: "Estimate report notes" };

export function renderEmailHtml() {
  return "";
}

export function PdfSection({ company = {}, data = {} }) {
  const report = reportFrom(data);
  if (!report) return null;
  const palette = reportPalette(company);
  const { theme, fill } = palette;
  const n = report.notes;

  return (
    <View wrap={false}>
      <ReportHeading palette={palette}>{n.title}</ReportHeading>
      <Text style={{ fontSize: 9, color: theme.ink }}>{n.emailed}</Text>

      <Text style={{ fontSize: 8, fontFamily: PDF_FONT_BOLD, letterSpacing: 1, color: theme.accentText, marginTop: 12, marginBottom: 6 }}>
        {String(n.nextTitle).toUpperCase()}
      </Text>
      {n.nextSteps.map((step, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 5 }}>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: fill.bg, alignItems: "center", justifyContent: "center", marginRight: 8 }}>
            <Text style={{ fontSize: 8, fontFamily: PDF_FONT_BOLD, color: fill.fg }}>{i + 1}</Text>
          </View>
          <Text style={{ fontSize: 9, color: theme.ink, flex: 1, lineHeight: 1.4 }}>{step}</Text>
        </View>
      ))}

      <View style={{ marginTop: 10, paddingTop: 8, borderTop: `0.5 solid ${theme.border}` }}>
        {n.disclaimers.map((d) => (
          <Text key={d} style={{ fontSize: 7.5, color: theme.inkMuted, marginBottom: 3, lineHeight: 1.4 }}>{d}</Text>
        ))}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
        <Text style={{ fontSize: 8, color: theme.inkMuted }}>
          {n.reportIdLabel}: <Text style={{ fontFamily: PDF_FONT_BOLD, color: theme.ink }}>{n.reportId || "—"}</Text>
        </Text>
        {n.viewOnline && (
          <Link src={n.viewOnline} style={{ fontSize: 8, color: theme.accentText, textDecoration: "underline" }}>
            {n.viewOnlineLabel}
          </Link>
        )}
      </View>
    </View>
  );
}
