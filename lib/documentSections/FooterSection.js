// lib/documentSections/FooterSection.js
//
// The line at the foot of every quote and invoice: who sent it, how to reach
// them, and — where they are registered — their tax number.
//
// The tax number is here rather than in the header because that is the
// convention on a commercial invoice, and because it belongs with the rest of
// the sender's identifying details rather than competing with the amount. See
// lib/documents/taxId.js for why it renders at all.
import { View, Text } from "@react-pdf/renderer";
import { taxIdLine } from "@/lib/documents/taxId";

export const meta = { type: "footer", label: "Footer" };

export function renderEmailHtml({ company }) {
  const parts = [company.name, company.email, company.phone, taxIdLine(company)]
    .filter(Boolean)
    .join(" · ");
  return `
    <div style="margin-top:32px;font-size:11px;color:#999;text-align:center;font-family:sans-serif;">
      ${parts}
    </div>
  `;
}

export function PdfSection({ company }) {
  const parts = [company.name, company.email, company.phone, taxIdLine(company)]
    .filter(Boolean)
    .join(" · ");
  return (
    <View
      style={{
        marginTop: 24,
        borderTop: "1 solid #eee",
        paddingTop: 8,
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: 8, color: "#999" }}>{parts}</Text>
    </View>
  );
}
