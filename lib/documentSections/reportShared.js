// lib/documentSections/reportShared.js
//
// The primitives the six estimate-report PDF sections share: the palette
// pairs (every text/background pairing measured through
// lib/documents/theme.js, never a raw brand hex under text), a section
// heading and a key/value row. Not a section itself — the registry imports
// the Report*Section files, which import this.
//
// Kept beside the sections rather than in lib/estimate/report because it
// imports @react-pdf/renderer, which nothing on the public page or in the
// model may pull into a browser bundle.

import { View, Text } from "@react-pdf/renderer";
import { documentTheme, fillPair, washPair, neutralPair, ruleColor } from "@/lib/documents/theme";
import { PDF_FONT_BOLD } from "@/lib/documents/pdfFont";

/** The report's measured palette for a company. */
export function reportPalette(company = {}) {
  const theme = documentTheme(company);
  return {
    theme,
    fill: fillPair(theme),
    wash: washPair(theme),
    neutral: neutralPair(theme),
    rule: ruleColor(theme),
  };
}

/** The report model this document was built from, or null. */
export function reportFrom(data) {
  const r = data?.report;
  return r && typeof r === "object" && r.language ? r : null;
}

export function ReportHeading({ children, palette, style }) {
  return (
    <View
      style={{
        marginTop: 16,
        marginBottom: 8,
        paddingBottom: 4,
        borderBottom: `1 solid ${palette.theme.accentRule}`,
        ...style,
      }}
    >
      <Text
        style={{
          fontSize: 8.5,
          fontFamily: PDF_FONT_BOLD,
          letterSpacing: 1.2,
          textTransform: "uppercase",
          color: palette.theme.accentText,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function KeyValueRow({ label, value, palette, last = false }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 4,
        borderBottom: last ? undefined : `0.5 solid ${palette.theme.borderSoft}`,
      }}
    >
      <Text style={{ fontSize: 9, color: palette.theme.inkMuted, flex: 1, paddingRight: 8 }}>{label}</Text>
      <Text style={{ fontSize: 9, color: palette.theme.ink, fontFamily: PDF_FONT_BOLD, textAlign: "right", flex: 1 }}>
        {value}
      </Text>
    </View>
  );
}
