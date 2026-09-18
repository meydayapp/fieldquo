// lib/documentSections/ReportMeasurementSection.js
//
// "Measurement summary": the measured figures the model found on the draft
// (area, squares, pitch, gutter run, downspouts, lawn or paving area, or the
// homeowner's own quantities), the imagery date, where the figure came from,
// and the line saying it must be verified before final scope.

import { View, Text } from "@react-pdf/renderer";
import { reportPalette, reportFrom, ReportHeading, KeyValueRow } from "./reportShared";

export const meta = { type: "report_measurement", label: "Estimate report measurement" };

export function renderEmailHtml() {
  return "";
}

export function PdfSection({ company = {}, data = {} }) {
  const report = reportFrom(data);
  if (!report || !report.measurement.rows.length) return null;
  const palette = reportPalette(company);
  const m = report.measurement;
  return (
    <View wrap={false}>
      <ReportHeading palette={palette}>{m.title}</ReportHeading>
      {m.rows.map((r, i) => (
        <KeyValueRow key={r.label} label={r.label} value={r.value} palette={palette} last={i === m.rows.length - 1} />
      ))}
      <Text style={{ fontSize: 8, color: palette.theme.inkMuted, marginTop: 6 }}>** {m.verifyNote}</Text>
    </View>
  );
}
