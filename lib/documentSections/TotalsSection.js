// lib/documentSections/TotalsSection.js
import { View, Text } from "@react-pdf/renderer";

export const meta = { type: "totals", label: "Totals" };

function row(label, value, bold) {
  return { label, value: `$${Number(value).toFixed(2)}`, bold };
}

export function renderEmailHtml({ data }) {
  const hasPayments = data.amountPaid !== undefined && data.amountPaid !== null;
  const balanceDue = hasPayments ? Number(data.amountDue ?? data.total) : null;

  return `
    <table style="width:100%;margin-top:16px;font-family:sans-serif;font-size:14px;">
      <tr><td>Subtotal</td><td style="text-align:right;">$${Number(data.subtotal).toFixed(2)}</td></tr>
      ${data.discount ? `<tr><td>Discount</td><td style="text-align:right;">-$${Number(data.discount).toFixed(2)}</td></tr>` : ""}
      <tr><td>Tax</td><td style="text-align:right;">$${Number(data.tax).toFixed(2)}</td></tr>
      <tr style="font-weight:700;"><td>Total</td><td style="text-align:right;">$${Number(data.total).toFixed(2)}</td></tr>
      ${
        hasPayments
          ? `
        <tr><td>Amount Paid</td><td style="text-align:right;">-$${Number(data.amountPaid).toFixed(2)}</td></tr>
        <tr style="font-weight:700;color:${balanceDue > 0 ? "#cf222e" : "#2ea043"};">
          <td>Balance Due</td><td style="text-align:right;">$${balanceDue.toFixed(2)}</td>
        </tr>
      `
          : ""
      }
    </table>
  `;
}

export function PdfSection({ data }) {
  const hasPayments = data.amountPaid !== undefined && data.amountPaid !== null;
  const balanceDue = hasPayments ? Number(data.amountDue ?? data.total) : null;

  const rows = [
    row("Subtotal", data.subtotal),
    ...(data.discount ? [row("Discount", -data.discount)] : []),
    row("Tax", data.tax),
    row("Total", data.total, true),
    ...(hasPayments ? [row("Amount Paid", -data.amountPaid)] : []),
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

      {hasPayments && (
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginTop: 4,
            paddingTop: 4,
            borderTop: "1 solid #ddd",
          }}
        >
          <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold" }}>
            Balance Due
          </Text>
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Helvetica-Bold",
              color: balanceDue > 0 ? "#cf222e" : "#2ea043",
            }}
          >
            ${balanceDue.toFixed(2)}
          </Text>
        </View>
      )}
    </View>
  );
}
