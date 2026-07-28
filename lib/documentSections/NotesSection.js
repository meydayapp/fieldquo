// lib/documentSections/NotesSection.js
import { View, Text } from "@react-pdf/renderer";
import { documentLabels } from "@/lib/i18n/documentLabels";

export const meta = { type: "notes", label: "Notes" };

export function renderEmailHtml({ data, language }) {
  if (!data.notes) return "";
  const t = documentLabels(language);
  return `<div style="margin-top:16px;font-family:sans-serif;">
    <div style="font-weight:700;font-size:13px;margin-bottom:4px;">${t.notes}</div>
    <div style="font-size:13px;color:#555;">${data.notes}</div>
  </div>`;
}

export function PdfSection({ data, language }) {
  if (!data.notes) return null;
  const t = documentLabels(language);
  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 2 }}
      >
        {t.notes}
      </Text>
      <Text style={{ fontSize: 9, color: "#666" }}>{data.notes}</Text>
    </View>
  );
}
