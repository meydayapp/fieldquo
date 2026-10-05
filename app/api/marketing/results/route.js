// app/api/marketing/results/route.js
//
// GET /api/marketing/results?period&from&to&source&campaign — FieldQuo's own
// Marketing results page (app/app/marketing/results). The SAME loader the
// agency API answers from (lib/agency/metricsData.js), so the owner can check
// the agency's report against FieldQuo's arithmetic rather than a copy of it.
// Money is always shown here: it is the company's own data on its own screen;
// the "Share job values" switch decides only what leaves for the agency.
//
// Same gate as the Spend page's routes (app/api/marketing-spend/*).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { resolvePeriod } from "@/lib/agency/periods";
import { loadMarketingResults, parseFilters } from "@/lib/agency/metricsData";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json({ error: "Only owners, admins, or supervisors can see marketing results" }, { status: err.status || 403 });
  }
  const q = new URL(request.url).searchParams;
  const now = new Date();
  const range = resolvePeriod({ period: q.get("period"), from: q.get("from"), to: q.get("to"), now });
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });
  const filters = parseFilters({ source: q.get("source"), campaign: q.get("campaign") });
  if (!filters.ok) return NextResponse.json({ error: filters.error }, { status: 400 });
  const data = await loadMarketingResults({ db, companyId: member.companyId, range, filters, includeMoney: true, now });
  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { agencyShareMoney: true } });
  return NextResponse.json({ ...data, sharedWithAgency: { jobValues: company?.agencyShareMoney !== false }, generatedAt: now.toISOString() });
}
