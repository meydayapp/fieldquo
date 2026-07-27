// lib/documentSections/PaymentSummarySection.js
import { View, Text } from "@react-pdf/renderer";

export const meta = { type: "payment_summary", label: "Payment Summary" };

const METHOD_LABELS = {
  cash: "Cash",
  e_transfer: "E-Transfer",
  cheque: "Cheque",
  shop: "Shop Pay",
  stripe: "Stripe",
};

export function renderEmailHtml({ data }) {
  const payments = data.payments || [];
  if (payments.length === 0) return "";

  return `
    <div style="margin-top:16px;font-family:sans-serif;font-size:13px;">
      <h4 style="margin:0 0 8px 0;font-size:14px;">Payment History</h4>
      <table style="width:100%;border-collapse:collapse;">
        ${payments
          .map(
            (p) => `
          <tr>
            <td style="padding:4px 0;color:#555;">${new Date(p.date).toLocaleDateString()}</td>
            <td style="padding:4px 0;color:#555;">${METHOD_LABELS[p.method] || p.method}</td>
            <td style="padding:4px 0;text-align:right;">$${Number(p.amount).toFixed(2)}</td>
          </tr>
        `,
          )
          .join("")}
      </table>
    </div>
  `;
}

export function PdfSection({ data }) {
  const payments = data.payments || [];
  if (payments.length === 0) return null;

  return (
    <View style={{ marginTop: 16 }}>
      <Text
        style={{ fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 6 }}
      >
        Payment History
      </Text>
      {payments.map((p, i) => (
        <View
          key={i}
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 3,
          }}
        >
          <Text style={{ fontSize: 9, color: "#555" }}>
            {new Date(p.date).toLocaleDateString()} —{" "}
            {METHOD_LABELS[p.method] || p.method}
          </Text>
          <Text style={{ fontSize: 9, color: "#555" }}>
            ${Number(p.amount).toFixed(2)}
          </Text>
        </View>
      ))}
    </View>
  );
}
