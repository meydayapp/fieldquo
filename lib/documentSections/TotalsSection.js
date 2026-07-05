// lib/documentSections/TotalsSection.js
import { View, Text } from "@react-pdf/renderer";

export const meta = { type: "totals", label: "Totals" };

function row(label, value, bold) {
  return { label, value: `$${Number(value).toFixed(2)}`, bold };
}

export function renderEmailHtml({ data }) {
  return `
    <table style="width:100%;margin-top:16px;font-family:sans-serif;font-size:14px;">
      <tr><td>Subtotal</td><td style="text-align:right;">$${Number(data.subtotal).toFixed(2)}</td></tr>
      ${data.discount ? `<tr><td>Discount</td><td style="text-align:right;">-$${Number(data.discount).toFixed(2)}</td></tr>` : ""}
      <tr><td>Tax</td><td style="text-align:right;">$${Number(data.tax).toFixed(2)}</td></tr>
      <tr style="font-weight:700;"><td>Total</td><td style="text-align:right;">$${Number(data.total).toFixed(2)}</td></tr>
    </table>
  `;
}

export function PdfSection({ data }) {
  const rows = [
    row("Subtotal", data.subtotal),
    ...(data.discount ? [row("Discount", -data.discount)] : []),
    row("Tax", data.tax),
    row("Total", data.total, true),
  ];

  return (
    <View style={{ marginTop: 16, borderTop: "1 solid #ddd", paddingTop: 8 }}>
      {rows.map((r, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 2,
          }}
        >
          <Text
            style={{
              fontSize: r.bold ? 11 : 10,
              fontFamily: r.bold ? "Helvetica-Bold" : "Helvetica",
            }}
          >
            {r.label}
          </Text>
          <Text
            style={{
              fontSize: r.bold ? 11 : 10,
              fontFamily: r.bold ? "Helvetica-Bold" : "Helvetica",
            }}
          >
            {r.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
