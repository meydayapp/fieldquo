// app/api/marketing-spend/summary/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { getMarketingRollup, getLeadCountsBySource } from "@/lib/analytics/marketingRollup";
import { buildBlendedCostPerLead } from "@/lib/analytics/kpis";

// The one read the marketing spend screen (app/app/marketing/spend/page.js)
// actually needs: the per-channel rollup, the REAL blended cost-per-lead
// (docs/META-ADS-INTEGRATION.md Part 2, Level 1), and which LeadRequest
// sources were excluded from it and why many. Same gate as the collection
// route beside this one.
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

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;

  const [rollup, leadCountsBySource] = await Promise.all([
    getMarketingRollup({ companyId: member.companyId, from: fromDate, to: toDate }),
    getLeadCountsBySource({ companyId: member.companyId, from: fromDate, to: toDate }),
  ]);

  const blended = buildBlendedCostPerLead({
    totalSpend: rollup.totals.spend,
    leadCountsBySource,
  });

  return NextResponse.json({
    channels: rollup.channels,
    totals: rollup.totals,
    excludedCurrencyMismatch: rollup.excludedCurrencyMismatch,
    companyCurrency: rollup.companyCurrency,
    leadCountsBySource,
    blendedCostPerLead: blended,
  });
}
