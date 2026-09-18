// lib/estimate/report/load.js
//
// The one loader behind the report's three readers — the public page, the
// PDF download and publishEstimateReport(). It fetches the draft and its
// company, re-prices the saved measurement, decides the website target and
// the booking target, and hands back the model.
//
// ── The share token is the only credential ──────────────────────────────────
//
// /estimate-report/<token> is public, like /q/<token>: whoever holds the link
// sees the report. The token is Quote.shareToken — the same one the quote's
// "send" and "share" routes mint — so a draft that later becomes a sent quote
// is reached by one token on both pages, and there is no second column to
// keep in step. Minted here only by publishEstimateReport(); a read never
// mints, so looking at a report cannot publish one.
//
// ── Prices are re-computed, never read ──────────────────────────────────────
//
// priceAllMaterials() prices every enabled material against the measurement
// the draft stored. Nothing on this page comes from estimateData.breakdown or
// .range: those are the record of what the homeowner was shown, and the
// report's option cards are what the company's rate card says TODAY. If the
// trade has been switched off since, the cards render without figures.

import { db } from "@/lib/db";
import { priceAllMaterials } from "@/lib/estimate/instantQuoteServer";
import { canBookVisit } from "@/lib/booking/canBookVisit";
import { getAppOrigin } from "@/lib/appUrl";
import { SENDER_SELECT } from "@/lib/email/resend";
import { buildEstimateReportModel, isInstantEstimateQuote } from "./model";
import { resolveReportWebsite } from "./website";

/** The Company columns the report reads. Exported so the check can assert it. */
export const REPORT_COMPANY_SELECT = {
  id: true,
  ...SENDER_SELECT,
  slug: true,
  bookingSlug: true,
  bookingModes: true,
  eventTypes: { where: { active: true }, select: { id: true } },
  phone: true,
  website: true,
  logoUrl: true,
  brandColor: true,
  currency: true,
  defaultLanguage: true,
  taxIdName: true,
  taxIdNumber: true,
  instantReportWebsite: true,
  site: {
    select: {
      subdomain: true,
      published: true,
      blocks: true,
      pages: true,
      handEditedAt: true,
      photoLibrary: true,
    },
  },
};

const QUOTE_SELECT = {
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
};

/** The report page URL for a token. */
export function estimateReportUrl(token, request) {
  return `${getAppOrigin(request)}/estimate-report/${encodeURIComponent(token)}`;
}

/**
 * Build the report for a loaded quote.
 *
 * @returns {{ quote, company, report }} — `report` is the model.
 */
export async function assembleEstimateReport({ quote, request, emailed = false }) {
  const company = await db.company.findUnique({
    where: { id: quote.companyId },
    select: REPORT_COMPANY_SELECT,
  });
  if (!company) return null;

  const data = quote.estimateData && typeof quote.estimateData === "object" ? quote.estimateData : {};
  const trade = data.trade || quote.quoteType;

  // Best effort: a trade the company has since disabled, or a config that no
  // longer prices, must not 500 the page — the cards go without figures.
  let options = null;
  if (trade && data.measurement) {
    try {
      options = await priceAllMaterials({
        companyId: company.id,
        trade,
        measurement: data.measurement,
        language: quote.language || "en",
      });
    } catch (err) {
      console.error("[estimate-report] re-pricing failed:", err?.message);
      options = null;
    }
  }

  const origin = getAppOrigin(request);
  const token = quote.shareToken;
  const reportUrl = token ? estimateReportUrl(token, request) : null;
  const website = resolveReportWebsite({ company, site: company.site });

  const report = buildEstimateReportModel({
    quote,
    company,
    options,
    website,
    urls: {
      report: reportUrl,
      // The report's own booking page: it mounts the same BookingFlow that
      // /book/<slug> renders, with the homeowner's details prefilled from the
      // draft and the visit tied to it by quoteId — nothing personal travels
      // in the URL. Only when the company can actually take a visit.
      book: token && canBookVisit(company) ? `${reportUrl}/book` : null,
      callbackApi: `${origin}/api/instant-quote/${encodeURIComponent(company.slug)}/callback`,
    },
    emailed,
  });

  return { quote, company, report };
}

/**
 * The report for a public token, or null when the token is unknown or the
 * quote behind it is not an instant estimate.
 */
export async function loadEstimateReportByToken(token, { request } = {}) {
  if (!token || typeof token !== "string" || token.length > 128) return null;
  const quote = await db.quote.findFirst({ where: { shareToken: token }, select: QUOTE_SELECT });
  if (!quote || !isInstantEstimateQuote(quote)) return null;
  return assembleEstimateReport({
    quote,
    request,
    // "A copy has been emailed to you" only when one WAS: publishEstimateReport
    // stamps estimateData.report.emailedAt after Resend accepts the message.
    // A draft with an address whose send failed says "keep the link" instead.
    emailed: Boolean(quote.estimateData?.report?.emailedAt),
  });
}
