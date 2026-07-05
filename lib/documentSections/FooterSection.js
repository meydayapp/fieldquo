// lib/documentSections/FooterSection.js
import { View, Text } from "@react-pdf/renderer";

export const meta = { type: "footer", label: "Footer" };

export function renderEmailHtml({ company }) {
  return `
    <div style="margin-top:32px;font-size:11px;color:#999;text-align:center;font-family:sans-serif;">
      ${company.name} · ${[company.email, company.phone].filter(Boolean).join(" · ")}
    </div>
  `;
}

export function PdfSection({ company }) {
  return (
    <View
      style={{
        marginTop: 24,
        borderTop: "1 solid #eee",
        paddingTop: 8,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 8, color: "#999" }}>
        {company.name} ·{" "}
        {[company.email, company.phone].filter(Boolean).join(" · ")}
      </Text>
    </View>
  );
}
