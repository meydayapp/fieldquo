// lib/documentSections/ReportQuestionsSection.js
//
// "Questions about your estimate?" — on paper the three buttons become three
// links: book a visit, request a call back (which opens the online report,
// where the form lives), back to the website. Each is printed only when the
// model has a target for it: no calendar means no "book" link, no honest
// website means no website link (lib/estimate/report/website.js).

import { View, Text, Link } from "@react-pdf/renderer";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";
import { reportPalette, reportFrom, ReportHeading } from "./reportShared";

export const meta = { type: "report_questions", label: "Estimate report questions" };

export function renderEmailHtml() {
  return "";
}

function Button({ label, href, palette, primary }) {
  const bg = primary ? palette.fill.bg : palette.wash.bg;
  const fg = primary ? palette.fill.fg : palette.wash.accent;
  return (
    <Link src={href} style={{ textDecoration: "none", flex: 1, marginRight: 8 }}>
      <View style={{ backgroundColor: bg, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 10, alignItems: "center" }}>
        <Text style={{ fontSize: 8.5, fontFamily: PDF_FONT_BOLD, color: fg, textAlign: "center" }}>{label}</Text>
      </View>
    </Link>
  );
}

export function PdfSection({ company = {}, data = {} }) {
  const report = reportFrom(data);
  if (!report) return null;
  const palette = reportPalette(company);
  const q = report.questions;
  // The call-back form lives on the online report; the PDF links to it.
  const buttons = [
    q.book && { label: q.book.label, href: q.book.href, primary: true },
    report.notes.viewOnline && { label: q.callback.label, href: `${report.notes.viewOnline}#callback`, primary: !q.book },
    q.website && { label: q.website.label, href: q.website.href, primary: false },
  ].filter(Boolean);
  if (!buttons.length) return null;

  return (
    <View wrap={false}>
      <ReportHeading palette={palette}>{q.title}</ReportHeading>
      <Text style={{ fontSize: 9, color: palette.theme.inkMuted, marginBottom: 8 }}>{q.body}</Text>
      <View style={{ flexDirection: "row" }}>
        {buttons.map((b) => (
          <Button key={b.label} label={b.label} href={b.href} palette={palette} primary={b.primary} />
        ))}
      </View>
    </View>
  );
}
