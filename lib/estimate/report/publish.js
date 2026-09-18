// lib/estimate/report/publish.js
//
// After the price is revealed, the instant estimate becomes a report: a
// page at a tokenised public URL, a PDF, and an emailed copy. This is the
// one call the instant-quote request route makes to produce all three.
//
// ── Best effort inside, a URL out ───────────────────────────────────────────
//
// The homeowner is on the result screen waiting for a link. The link is the
// share token, and minting it is the only step that must succeed. The PDF
// and the email are attempted, logged when they fail, and never allowed to
// take the URL down with them: a homeowner whose report page works but
// whose email bounced is a lead; one who got a 500 is not.
//
// What is stamped on the draft: estimateData.report = { publishedAt,
// emailedAt } — emailedAt only after Resend accepted the message, so the
// page's "a copy has been emailed to you" is a fact, not an intention.

import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email/resend";
import { resolveSender } from "@/lib/email/companySender";
import { assembleEstimateReport, estimateReportUrl } from "./load";
import { isInstantEstimateQuote } from "./model";
import { renderEstimateReportPdf } from "./pdf";
import { buildEstimateReportEmail } from "./email";

export { estimateReportUrl };

/**
 * Publish the report for a draft.
 *
 * @param {object} p
 * @param {string} p.quoteId    the draft createEstimateDraft() returned
 * @param {string} p.companyId  the company the request route resolved — the
 *                              quote must belong to it, or nothing happens
 * @param {Request} p.request   the route's Request, for the absolute origin
 * @returns {Promise<{ url: string, reportId: string }|null>}
 *          null only when the quote is not this company's instant estimate
 */
export async function publishEstimateReport({ quoteId, companyId, request }) {
  const quote = await db.quote.findFirst({
    where: { id: quoteId, companyId },
    select: {
      id: true,
      companyId: true,
      quoteNumber: true,
      language: true,
      quoteType: true,
      estimateData: true,
      estimateSource: true,
      autoEstimated: true,
      createdVia: true,
      shareToken: true,
      createdAt: true,
      client: { select: { name: true, email: true, phone: true, address: true } },
    },
  });
  if (!quote || !isInstantEstimateQuote(quote)) return null;

  // ── The token, minted the way "send" mints it ────────────────────────────
  //
  // Same column, same shape, same randomness as app/api/quotes/[id]/send —
  // so when this draft is later approved and sent, the homeowner's report
  // link and their quote link are one token, and nothing is re-minted.
  let shareToken = quote.shareToken;
  if (!shareToken) {
    shareToken = randomBytes(32).toString("base64url");
    await db.quote.update({ where: { id: quote.id }, data: { shareToken } });
  }
  const url = estimateReportUrl(shareToken, request);
  const now = new Date();

  const stamp = async (patch) => {
    // Re-read rather than spread the copy loaded above: the callback route
    // may have written estimateData.callback in between, and a stale spread
    // would erase it.
    const fresh = await db.quote.findUnique({ where: { id: quote.id }, select: { estimateData: true } });
    const data = fresh?.estimateData && typeof fresh.estimateData === "object" ? fresh.estimateData : {};
    const report = data.report && typeof data.report === "object" ? data.report : {};
    await db.quote.update({
      where: { id: quote.id },
      data: { estimateData: { ...data, report: { ...report, ...patch } } },
    });
  };

  try {
    await stamp({ publishedAt: now.toISOString() });
  } catch (err) {
    console.error("[estimate-report] publish stamp failed:", err?.message);
  }

  // ── The PDF and the email, best effort ───────────────────────────────────
  const to = quote.client?.email;
  if (to) {
    try {
      const assembled = await assembleEstimateReport({
        quote: { ...quote, shareToken },
        request,
        // The email is about to go; the PDF inside it says a copy was emailed
        // because it is that copy. The PAGE reads the stamp instead.
        emailed: true,
      });
      if (assembled) {
        const { report, company } = assembled;
        let attachments = [];
        try {
          const pdf = await renderEstimateReportPdf({ report, company });
          attachments = [{ filename: report.email.filename, content: pdf }];
        } catch (err) {
          // The email still goes, with the link; the page has the same content.
          console.error("[estimate-report] PDF failed:", err?.message);
        }
        const { subject, html, text } = buildEstimateReportEmail({ report, company });
        const result = await sendEmail({
          companyId: company.id,
          to,
          subject,
          html,
          text,
          attachments,
          ...(await resolveSender(company, company.id)),
        });
        if (result && !result.error && !result.skipped) {
          await stamp({ emailedAt: new Date().toISOString() });
        } else if (result?.error) {
          console.error("[estimate-report] email refused:", result.error);
        }
      }
    } catch (err) {
      console.error("[estimate-report] email failed:", err?.message);
    }
  }

  return { url, reportId: quote.quoteNumber || quote.id };
}
