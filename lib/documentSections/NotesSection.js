// lib/documentSections/NotesSection.js
import { View, Text } from "@react-pdf/renderer";

export const meta = { type: "notes", label: "Notes" };

export function renderEmailHtml({ data }) {
  if (!data.notes) return "";
  return `<div style="margin-top:16px;font-size:13px;color:#555;font-family:sans-serif;">${data.notes}</div>`;
}

export function PdfSection({ data }) {
  if (!data.notes) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Text style={{ fontSize: 9, color: "#666" }}>{data.notes}</Text>
    </View>
  );
}
