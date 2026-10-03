// scripts/fixtures/monthlySummaryFixture.mjs
//
// One demo painting company's September 2026, as raw rows — fed through the
// REAL pure builders (rollupSpendRows, buildCampaignRollup,
// monthlyConversations, buildMonthlySummary), never a hand-written summary.
// Used by scripts/check-monthly-summary.mjs and
// scripts/preview-monthly-summary.mjs, so the preview the owner sees is the
// same object the check asserts on.
//
// Northline Painting is fictional (the same name check-email-links.mjs uses).
// Its Meta ad account reports in USD while the company bills in CAD, on
// purpose: that is the case that printed "converted from USD 261.11 at
// 1.3888, rate 34 days old" in the real September email.

import { rollupSpendRows } from "../../lib/analytics/marketingRollup.js";
import { buildCampaignRollup } from "../../lib/analytics/campaignRollup.js";
import { monthlyConversations } from "../../lib/attribution/monthlyConversations.js";
import { buildMonthlySummary } from "../../lib/analytics/monthlySummary.js";
import { monthRange } from "../../lib/messaging/monthlyReview.js";

export const COMPANY = Object.freeze({
  id: "demo_northline",
  name: "Northline Painting",
  currency: "CAD",
  dateFormat: "MM/DD/YYYY",
  defaultLanguage: "en",
  createdAt: new Date("2026-03-02T15:00:00Z"),
});

export const ORIGIN = "https://www.fieldquo.com";
// The day this preview was rendered. The pinned USD/CAD rate is dated
// 2026-10-02, so a clock before that would refuse it as "dated in the future".
export const AS_OF = new Date("2026-10-03T08:00:00Z");
export const PERIOD = monthRange(2026, 9);
export const PRIOR = monthRange(2026, 8);

const d = (s) => new Date(s);

export function invoices() {
  return [
    { id: "inv1", parentInvoiceId: null, version: 1, invoiceNumber: "INV-0141", status: "paid", total: 4200, sentAt: d("2026-09-04T15:00:00Z"), createdAt: d("2026-09-04T14:00:00Z"), dueDate: d("2026-09-18T00:00:00Z"), paidDate: d("2026-09-12T16:00:00Z"), jobId: "j1", quoteId: "q1", clientId: "c1" },
    { id: "inv2", parentInvoiceId: null, version: 1, invoiceNumber: "INV-0142", status: "sent", total: 2850, sentAt: d("2026-09-10T15:00:00Z"), createdAt: d("2026-09-10T14:00:00Z"), dueDate: d("2026-09-24T00:00:00Z"), jobId: null, quoteId: "q2", clientId: "c2" },
    { id: "inv3", parentInvoiceId: null, version: 1, invoiceNumber: "INV-0138", status: "sent", total: 1980, sentAt: d("2026-08-20T15:00:00Z"), createdAt: d("2026-08-20T14:00:00Z"), dueDate: d("2026-09-03T00:00:00Z"), jobId: null, quoteId: "q3", clientId: "c3" },
    { id: "inv4", parentInvoiceId: null, version: 1, invoiceNumber: "INV-0143", status: "paid", total: 3430, sentAt: d("2026-09-18T15:00:00Z"), createdAt: d("2026-09-18T14:00:00Z"), dueDate: d("2026-10-02T00:00:00Z"), paidDate: d("2026-09-29T16:00:00Z"), jobId: "j2", quoteId: "q4", clientId: "c4" },
    { id: "inv5", parentInvoiceId: null, version: 1, invoiceNumber: "INV-0135", status: "paid", total: 5100, sentAt: d("2026-08-05T15:00:00Z"), createdAt: d("2026-08-05T14:00:00Z"), dueDate: d("2026-08-19T00:00:00Z"), paidDate: d("2026-08-15T16:00:00Z"), jobId: null, quoteId: "q5", clientId: "c5" },
    { id: "inv6", parentInvoiceId: null, version: 1, invoiceNumber: "INV-0136", status: "paid", total: 2600, sentAt: d("2026-08-12T15:00:00Z"), createdAt: d("2026-08-12T14:00:00Z"), dueDate: d("2026-08-26T00:00:00Z"), paidDate: d("2026-08-28T16:00:00Z"), jobId: null, quoteId: "q6", clientId: "c6" },
    { id: "inv7", parentInvoiceId: null, version: 1, invoiceNumber: "INV-0129", status: "overdue", total: 1250, sentAt: d("2026-07-02T15:00:00Z"), createdAt: d("2026-07-02T14:00:00Z"), dueDate: d("2026-08-01T00:00:00Z"), jobId: null, quoteId: "q7", clientId: "c7" },
    { id: "inv8", parentInvoiceId: null, version: 1, invoiceNumber: "INV-0144", status: "sent", total: 1600, sentAt: d("2026-09-25T15:00:00Z"), createdAt: d("2026-09-25T14:00:00Z"), dueDate: d("2026-10-25T00:00:00Z"), jobId: null, quoteId: "q8", clientId: "c8" },
    // A draft is not invoiced and not owed.
    { id: "inv9", parentInvoiceId: null, version: 1, invoiceNumber: null, status: "draft", total: 9999, sentAt: null, createdAt: d("2026-09-27T14:00:00Z"), dueDate: null, jobId: "j3", quoteId: "q9", clientId: "c9" },
  ];
}

export function payments() {
  return [
    { invoiceId: "inv1", amount: 4200, date: d("2026-09-12T16:00:00Z") },
    { invoiceId: "inv3", amount: 500, date: d("2026-09-05T16:00:00Z") },
    { invoiceId: "inv4", amount: 3430, date: d("2026-09-29T16:00:00Z") },
    { invoiceId: "inv5", amount: 5100, date: d("2026-08-15T16:00:00Z") },
    { invoiceId: "inv6", amount: 2600, date: d("2026-08-28T16:00:00Z") },
  ];
}

/** getAnalyticsOverview's shape, for September. */
export function overview() {
  return {
    quotesCreated: 16,
    quotesSent: 14,
    quotesAccepted: 6,
    conversionRate: 6 / 14,
    priorConversionRate: 4 / 12,
    priorQuotesSent: 12,
    revenueInvoiceCount: 2,
  };
}

function lead(id, source, day, { quoteId = null, quoteStatus = null, status = "new", metaCampaignId = null } = {}) {
  return { id, source, status: quoteId ? "converted" : status, quoteId, quoteStatus, createdAt: d(`2026-09-${String(day).padStart(2, "0")}T14:00:00Z`), metaCampaignId };
}

export function leads() {
  return [
    lead("l1", "instant_quote", 2, { quoteId: "q1", quoteStatus: "accepted" }),
    lead("l2", "instant_quote", 5, { quoteId: "q2", quoteStatus: "accepted" }),
    lead("l3", "instant_quote", 9, { quoteId: "q10", quoteStatus: "sent" }),
    lead("l4", "instant_quote", 14, { quoteId: "q11", quoteStatus: "declined" }),
    lead("l5", "instant_quote", 21, { quoteId: "q12", quoteStatus: "accepted" }),
    lead("l6", "instant_quote", 26),
    lead("l7", "instant_quote", 30),
    lead("l8", "meta_lead_form", 3, { quoteId: "q4", quoteStatus: "accepted", metaCampaignId: "A" }),
    lead("l9", "meta_lead_form", 8, { quoteId: "q13", quoteStatus: "sent", metaCampaignId: "A" }),
    lead("l10", "meta_lead_form", 17, { metaCampaignId: "A", status: "contacted" }),
    lead("l11", "meta_lead_form", 23, { metaCampaignId: "B" }),
    lead("l12", "meta_lead_form", 28, { quoteId: "q14", quoteStatus: "sent", metaCampaignId: "B" }),
    lead("l13", "phone_agent", 6, { quoteId: "q15", quoteStatus: "accepted" }),
    lead("l14", "phone_agent", 19, { quoteId: "q16", quoteStatus: "sent" }),
    lead("l15", "phone_agent", 27),
    lead("l16", "self_quote", 11, { quoteId: "q17", quoteStatus: "accepted" }),
    lead("l17", "self_quote", 24),
    lead("l18", "manual", 15, { quoteId: "q18", quoteStatus: "sent" }),
  ];
}

export const PRIOR_LEAD_COUNTS = Object.freeze({ instant_quote: 6, meta_lead_form: 3, phone_agent: 2, manual: 2 });

export function jobsCompleted() {
  return [
    { id: "j1", quoteId: "q1", completedAt: d("2026-09-10T20:00:00Z") },
    { id: "j2", quoteId: "q4", completedAt: d("2026-09-17T20:00:00Z") },
    // Two finished jobs with no issued invoice — j3 has only a DRAFT.
    { id: "j3", quoteId: "q9", completedAt: d("2026-09-25T20:00:00Z") },
    { id: "j4", quoteId: "q15", completedAt: d("2026-09-29T20:00:00Z") },
  ];
}

/** MarketingSpend rows. The Meta rows are in USD; the company bills in CAD. */
export function spendRows(month = 9) {
  if (month === 8) {
    return [
      { platform: "facebook", source: "meta_api", campaignId: "A", campaignName: "Fall interiors", amount: 210.0, currency: "USD", date: d("2026-08-15T00:00:00Z"), leads: 0 },
      { platform: "google", source: "manual", campaignId: null, amount: 100.0, currency: null, date: d("2026-08-01T00:00:00Z"), leads: 0 },
    ];
  }
  return [
    { platform: "facebook", source: "meta_api", campaignId: "A", campaignName: "Fall interiors", objective: "OUTCOME_LEADS", amount: 96.4, currency: "USD", date: d("2026-09-05T00:00:00Z"), leads: 0, impressions: 8200, clicks: 140 },
    { platform: "facebook", source: "meta_api", campaignId: "A", campaignName: "Fall interiors", objective: "OUTCOME_LEADS", amount: 84.0, currency: "USD", date: d("2026-09-19T00:00:00Z"), leads: 0, impressions: 7100, clicks: 121 },
    { platform: "facebook", source: "meta_api", campaignId: "B", campaignName: "Deck & fence staining", objective: "OUTCOME_LEADS", amount: 80.71, currency: "USD", date: d("2026-09-12T00:00:00Z"), leads: 0, impressions: 6400, clicks: 88 },
    { platform: "google", source: "manual", campaignId: null, amount: 120.0, currency: null, date: d("2026-09-01T00:00:00Z"), leads: 0 },
  ];
}

export function campaignRollup(asOf = AS_OF) {
  const ls = leads().filter((l) => l.metaCampaignId).map((l) => ({ id: l.id, metaCampaignId: l.metaCampaignId, metaCampaignName: null, quoteId: l.quoteId }));
  const jobs = [{ id: "j2", quoteId: "q4", createdAt: d("2026-09-08T12:00:00Z") }];
  const invs = invoices().filter((i) => i.status !== "draft" && (i.jobId === "j2" || i.quoteId === "q4"));
  return buildCampaignRollup({ spendRows: spendRows(9), leads: ls, jobs, invoices: invs, companyCurrency: COMPANY.currency, asOf });
}

export function conversations() {
  const row = (id, source, day, outcome, answered = true, minutes = 18) => ({
    id,
    source,
    startedAt: d(`2026-09-${String(day).padStart(2, "0")}T15:00:00Z`),
    answered,
    firstReplyMinutes: answered ? minutes : null,
    outcome: { outcome, confidence: "likely", reasons: [] },
  });
  return monthlyConversations({
    year: 2026,
    month: 9,
    conversations: [
      row("t1", "meta_messenger", 3, "won"),
      row("t2", "meta_messenger", 7, "won", true, 42),
      row("t3", "meta_messenger", 12, "quoted"),
      row("t4", "meta_messenger", 16, "no_quote", false),
      row("t5", "meta_messenger", 22, "lost", true, 95),
      row("t6", "meta_messenger", 27, "unmatched", false),
      row("t7", "meta_instagram", 9, "won", true, 11),
      row("t8", "meta_instagram", 18, "no_quote"),
      row("t9", "meta_instagram", 25, "quoted", true, 64),
    ],
  });
}

export function waitingQuotes() {
  return [
    { id: "q13", total: 3200, sentAt: d("2026-09-08T15:00:00Z") },
    { id: "q16", total: 5400, sentAt: d("2026-09-15T15:00:00Z") },
    { id: "q14", total: 2100, sentAt: d("2026-09-29T15:00:00Z") },
    { id: "q18", total: 1850, sentAt: d("2026-09-20T15:00:00Z") },
  ];
}

/** The full September summary for the demo company. */
export function septemberSummary({ asOf = AS_OF } = {}) {
  return buildMonthlySummary({
    period: PERIOD,
    prior: PRIOR,
    asOf,
    hadFullPriorMonth: COMPANY.createdAt <= PRIOR.start,
    invoices: invoices(),
    payments: payments(),
    overview: overview(),
    leads: leads(),
    priorLeadCountsBySource: { ...PRIOR_LEAD_COUNTS },
    jobsCompleted: jobsCompleted(),
    priorJobsCompleted: 3,
    marketing: rollupSpendRows({ rows: spendRows(9), companyCurrency: COMPANY.currency, asOf }),
    priorMarketing: rollupSpendRows({ rows: spendRows(8), companyCurrency: COMPANY.currency, asOf }),
    campaigns: campaignRollup(asOf),
    conversations: conversations(),
    waitingQuotes: waitingQuotes(),
  });
}

/** A company in its first month with nothing recorded — every absence at once. */
export function emptySummary({ asOf = AS_OF } = {}) {
  return buildMonthlySummary({
    period: PERIOD,
    prior: PRIOR,
    asOf,
    hadFullPriorMonth: false,
    invoices: [],
    payments: [],
    overview: { quotesCreated: 0, quotesSent: 0, quotesAccepted: 0, conversionRate: null, priorConversionRate: null, priorQuotesSent: null, revenueInvoiceCount: 0 },
    leads: [],
    priorLeadCountsBySource: null,
    jobsCompleted: [],
    priorJobsCompleted: null,
    marketing: rollupSpendRows({ rows: [], companyCurrency: COMPANY.currency, asOf }),
    priorMarketing: null,
    campaigns: buildCampaignRollup({ spendRows: [], leads: [], jobs: [], invoices: [], companyCurrency: COMPANY.currency, asOf }),
    conversations: null,
    waitingQuotes: [],
  });
}
