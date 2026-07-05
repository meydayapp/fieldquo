// lib/documentSections/HeaderSection.js
import { View, Text, Image } from "@react-pdf/renderer";

export const meta = { type: "header", label: "Header" };

export function renderEmailHtml({ company }) {
  return `
    <div style="text-align:center;margin-bottom:24px;">
      ${company.logoUrl ? `<img src="${company.logoUrl}" style="max-height:64px;" />` : ""}
      <h2 style="color:${company.brandColor || "#bd9d60"};margin:8px 0;font-family:sans-serif;">
        ${company.name}
      </h2>
    </div>
  `;
}

export function PdfSection({ company }) {
  return (
    <View style={{ alignItems: "center", marginBottom: 20 }}>
      {company.logoUrl && (
        <Image
          src={company.logoUrl}
          style={{ height: 48, marginBottom: 8, objectFit: "contain" }}
        />
      )}
      <Text
        style={{
          fontSize: 16,
          fontFamily: "Helvetica-Bold",
          color: company.brandColor || "#bd9d60",
        }}
      >
        {company.name}
      </Text>
    </View>
  );
}
