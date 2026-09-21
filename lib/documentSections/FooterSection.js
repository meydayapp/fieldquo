// lib/documentSections/FooterSection.js
//
// The line at the foot of every quote and invoice: who sent it, how to reach
// them, and — where they are registered — their tax number.
//
// The tax number is here rather than in the header because that is the
// convention on a commercial invoice, and because it belongs with the rest of
// the sender's identifying details rather than competing with the amount. See
// lib/documents/taxId.js for why it renders at all.
//
// ── The review QR, on invoices only, only when switched on ─────────────────
//
// Company.invoiceReviewQr (Settings → Reviews, default off) adds "Enjoyed
// the work? Scan to review us" and a QR of the review link above the
// contact line — on an INVOICE, never a quote: a review asked for before
// the work is done is an ask for nothing. Three conditions, all checked
// here: the switch, a review link that validates, and a document that is an
// invoice (it carries an invoiceNumber). The switch alone must never draw a
// QR that scans to nothing, so the link is the condition, not the switch.
//
// The QR is drawn as paths from lib/reviews/qr.js — no image, no fetch —
// black on the paper, always: a camera reads dark modules on a light ground
// and a brand-coloured QR is decoration that does not scan. The caption is
// the same sentence the email and the print sheet use, in the document's
// language, in inkMuted — measured to 4.5:1 against paper by
// lib/documents/theme.js, where #999 (the contact line, 2.8:1) is a
// hairline the eye is not meant to read.
import { View, Text, Svg, Path, Rect } from "@react-pdf/renderer";
import { taxIdLine } from "@/lib/documents/taxId";
import { invoiceReviewQrWanted } from "@/lib/reviews/invoiceQr";
import { qrMatrix, qrPath } from "@/lib/reviews/qr";
import { reviewQrCopy } from "@/lib/reviews/reviewQrCopy";
import { documentTheme } from "@/lib/documents/theme";
import { escapeHtml, escapeAttr, safeUrl } from "@/lib/email/emailTheme";

export const meta = { type: "footer", label: "Footer" };

// The three conditions live in lib/reviews/invoiceQr.js (pure, executed by
// the check) so the PDF and the email here cannot disagree.

export function renderEmailHtml({ data, company, language }) {
  const parts = [company.name, company.email, company.phone, taxIdLine(company)]
    .filter(Boolean)
    .join(" · ");
  // No image in the email footer — the review-request email carries the
  // hosted QR; a document email carries the sentence and the link, which
  // is what a mail client can be trusted to render. #4b5563 on white: 7.5:1.
  const ask = invoiceReviewQrWanted({ data, company })
    ? `<div style="margin-top:20px;font-size:12px;color:#4b5563;text-align:center;font-family:sans-serif;">
        ${escapeHtml(reviewQrCopy(language).enjoyed)} —
        <a href="${escapeAttr(safeUrl(company.reviewUrl))}" style="color:#4b5563;">${escapeHtml(reviewQrCopy(language).leaveReview)}</a>
      </div>`
    : "";
  return `
    ${ask}
    <div style="margin-top:${ask ? 12 : 32}px;font-size:11px;color:#999;text-align:center;font-family:sans-serif;">
      ${parts}
    </div>
  `;
}

const QR_PT = 64;

export function PdfSection({ data, company, language }) {
  const parts = [company.name, company.email, company.phone, taxIdLine(company)]
    .filter(Boolean)
    .join(" · ");

  let ask = null;
  if (invoiceReviewQrWanted({ data, company })) {
    const theme = documentTheme(company);
    const t = reviewQrCopy(language || company.defaultLanguage || "en");
    const m = qrMatrix(company.reviewUrl);
    const margin = 2;
    const edge = m.size + margin * 2;
    ask = (
      <View
        style={{
          marginTop: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <Svg viewBox={`0 0 ${edge} ${edge}`} style={{ width: QR_PT, height: QR_PT }}>
          <Rect x={0} y={0} width={edge} height={edge} fill="#ffffff" />
          <Path d={qrPath(m, { margin })} fill="#000000" />
        </Svg>
        <View style={{ maxWidth: 220 }}>
          <Text style={{ fontSize: 9, color: theme.inkMuted, lineHeight: 1.4 }}>{t.enjoyed}</Text>
          <Text style={{ fontSize: 7, color: theme.inkMuted, marginTop: 2 }}>{company.reviewUrl}</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        marginTop: 24,
        borderTop: "1 solid #eee",
        paddingTop: 8,
        alignItems: "center",
      }}
    >
      {ask}
      <Text style={{ fontSize: 8, color: "#999", marginTop: ask ? 10 : 0 }}>{parts}</Text>
    </View>
  );
}
