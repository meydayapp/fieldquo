// app/api/marketing-spend/campaigns/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { dayRangeUtc } from "@/lib/analytics/dayRange";
import { buildCampaignRollup } from "@/lib/analytics/campaignRollup";

// Per-campaign spend, Meta's own counts, and what each campaign became in
// FieldQuo — the "Campaigns" section of app/app/marketing/spend/page.js.
// Sibling of ../summary (same gate, same shape of read): summary is the
// whole-company picture, this is the one join it cannot make, campaign by
// campaign. Everything is fetched here and counted in
// lib/analytics/campaignRollup.js, which has no database of its own.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can see marketing spend" },
      { status: err.status || 403 },
    );
  }

  const companyId = member.companyId;
  const { searchParams } = new URL(request.url);
  // Whole days at both ends, or no bound at all — the Spend page asks
  // without one, so a campaign that ran in March is still on the list in
  // September beside the job it produced.
  const range = dayRangeUtc(searchParams.get("from"), searchParams.get("to"));

  const [company, spendRows, leads] = await Promise.all([
    db.company.findUnique({ where: { id: companyId }, select: { currency: true } }),
    db.marketingSpend.findMany({
      where: {
        companyId,
        source: "meta_api",
        campaignId: { not: null },
        ...(range && { date: range }),
      },
      select: {
        campaignId: true,
        campaignName: true,
        objective: true,
        amount: true,
        currency: true,
        date: true,
        impressions: true,
        reach: true,
        clicks: true,
        linkClicks: true,
        conversions: true,
        messagingConversations: true,
        videoViews: true,
        postEngagements: true,
      },
    }),
    // Leads that arrived in the period, from a Meta lead form, with the
    // campaign resolved. What became of them is followed below without a
    // date bound: the lead is in the period, the invoice may be later.
    db.leadRequest.findMany({
      where: {
        companyId,
        metaCampaignId: { not: null },
        ...(range && { createdAt: range }),
      },
      select: { id: true, metaCampaignId: true, metaCampaignName: true, quoteId: true },
    }),
  ]);

  const quoteIds = [...new Set(leads.map((l) => l.quoteId).filter(Boolean))];
  const jobs = quoteIds.length
    ? await db.job.findMany({
        where: { companyId, quoteId: { in: quoteIds } },
        select: { id: true, quoteId: true, createdAt: true },
        // Oldest first, so campaignRollup's "first job on a quote" is the one
        // acceptance created — the same order lib/invoices/jobLink.js uses.
        orderBy: { createdAt: "asc" },
      })
    : [];
  const jobIds = jobs.map((j) => j.id);
  // Every issued invoice billing those jobs — by the explicit Job link, or
  // (when none) by the quote. The same two-branch resolution
  // app/api/analytics/kpis/route.js runs for job revenue.
  //
  // `notIn: ["draft"]` only. InvoiceStatus has no `cancelled` member
  // (schema.prisma: draft · sent · paid · overdue · refunded ·
  // partially_refunded · disputed), and Prisma refuses a filter naming one —
  // "Invalid value for argument `notIn`. Expected InvoiceStatus." — before
  // the query reaches Postgres. Executed against the generated client while
  // writing this route; the KPI route's copy of this filter carries the
  // phantom value and is fixed in its own commit.
  const invoices = jobIds.length
    ? await db.invoice.findMany({
        where: {
          companyId,
          status: { notIn: ["draft"] },
          OR: [{ jobId: { in: jobIds } }, { jobId: null, quoteId: { in: quoteIds } }],
        },
        select: { id: true, parentInvoiceId: true, version: true, total: true, jobId: true, quoteId: true },
      })
    : [];

  const rollup = buildCampaignRollup({
    spendRows,
    leads,
    jobs,
    invoices,
    companyCurrency: company?.currency || "CAD",
    asOf: new Date(),
  });

  return NextResponse.json(rollup);
}
