// lib/documentSections/ClientInfoSection.js
import { View, Text } from "@react-pdf/renderer";

export const meta = { type: "client_info", label: "Client details" };

export function renderEmailHtml({ data }) {
  const c = data.client;
  return `
    <div style="margin-bottom:16px;font-family:sans-serif;font-size:14px;">
      <strong>${c.name}</strong><br/>
      ${c.address ? `${c.address}<br/>` : ""}
      ${[c.email, c.phone].filter(Boolean).join(" · ")}
    </div>
  `;
}

export function PdfSection({ data }) {
  const c = data.client;
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>
        {c.name}
      </Text>
      {c.address && (
        <Text style={{ fontSize: 10, color: "#555" }}>{c.address}</Text>
      )}
      <Text style={{ fontSize: 10, color: "#555" }}>
        {[c.email, c.phone].filter(Boolean).join(" · ")}
      </Text>
    </View>
  );
}
