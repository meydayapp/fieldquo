// app/api/marketing/results/route.js
//
// GET /api/marketing/results?period&from&to&source&campaign — FieldQuo's own
// Marketing results page (app/app/marketing/results). The SAME loader the
// agency API answers from (lib/agency/metricsData.js), so the owner can check
// the agency's report against FieldQuo's arithmetic rather than a copy of it.
// Money is always shown to the company's own people: it is the company's own
// data on its own screen; the "Share job values" switch decides only what
// leaves for the agency.
//
// ── The marketing agency, signed in as a team member (2026-10-09) ──────────
//
// The same figures the agency's API key gets, decided the same way: job
// values only while "Share job values" is on (companySharing, the one reader
// of that switch for lib/agency/api.js). A member invited AS the agency is
// the agency; a second door to the same numbers that ignored the switch would
// make the switch decorative.
//
// Same gate as the Spend page's routes (app/api/marketing-spend/*), widened
// by canManageMarketing to that one role.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requireMarketingAccess, isMarketingAgency } from "@/lib/permissions/marketingAgency";
import { resolvePeriod } from "@/lib/agency/periods";
import { loadMarketingResults, parseFilters } from "@/lib/agency/metricsData";
import { companySharing } from "@/lib/agency/api";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requireMarketingAccess(member);
  } catch (err) {
    return NextResponse.json({ error: "Only owners, admins, or supervisors can see marketing results" }, { status: err.status || 403 });
  }
  const q = new URL(request.url).searchParams;
  const now = new Date();
  const range = resolvePeriod({ period: q.get("period"), from: q.get("from"), to: q.get("to"), now });
  if (!range.ok) return NextResponse.json({ error: range.error }, { status: 400 });
  const filters = parseFilters({ source: q.get("source"), campaign: q.get("campaign") });
  if (!filters.ok) return NextResponse.json({ error: filters.error }, { status: 400 });
  const sharing = await companySharing(db, member.companyId);
  const agency = isMarketingAgency(member);
  const data = await loadMarketingResults({ db, companyId: member.companyId, range, filters, includeMoney: agency ? sharing.shareMoney : true, now });
  return NextResponse.json({
    ...data,
    sharedWithAgency: { jobValues: sharing.shareMoney },
    // Tells the page whose screen this is, so it can drop the owner's links
    // (agency access, the ad accounts) that would only open a refusal.
    viewer: agency ? "agency" : "company",
    generatedAt: now.toISOString(),
  });
}
