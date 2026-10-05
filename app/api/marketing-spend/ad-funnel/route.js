// app/api/marketing-spend/ad-funnel/route.js
//
// Meta's conversations → real conversations → leads → quotes → won →
// invoiced, per source, with FieldQuo's cost per real conversation and per
// lead beside Meta's own (lib/analytics/adFunnel.js). Read by the Spend page
// and the KPI page. Same gate as its siblings ../campaigns and ../summary.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { dayRangeUtc } from "@/lib/analytics/dayRange";
import { loadAdFunnel } from "@/lib/analytics/adFunnelData";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json({ error: "Only owners, admins, or supervisors can see marketing spend" }, { status: err.status || 403 });
  }
  const { searchParams } = new URL(request.url);
  const range = dayRangeUtc(searchParams.get("from"), searchParams.get("to"));
  const funnel = await loadAdFunnel({ db, companyId: member.companyId, range, asOf: new Date() });
  return NextResponse.json(funnel);
}
