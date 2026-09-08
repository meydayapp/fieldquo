// app/api/settings/cost-revision/route.js
//
// The one number behind "update your costing?": how far OVER its estimate a
// finished job has to come in before the close-out asks. The owner's "15 or
// 20% over"; Company.costRevisionThresholdPct; read by
// GET /api/jobs/[id]/costing and decided by lib/costing/costRevision.js.
//
// Beside /api/settings/material-recipes rather than inside it, because that
// route is keyed by trade (one override document per recipe) and this is a
// company-wide figure — but gated on the SAME resource, deliberately. The
// threshold decides when a person is offered a change to the cost basis, so
// whoever may edit the cost basis may set it, and nobody else. One gate,
// tenant-scoped: the row is the caller's own company, never a posted id.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, permissionErrorResponse } from "@/lib/permissions/enforce";
import { requireCostBasisRead, requireCostBasisWrite } from "@/lib/permissions/costBasis";
import { normaliseThresholdPct, DEFAULT_REVISION_THRESHOLD_PCT } from "@/lib/costing/costRevision";

const shape = (company) => ({
  thresholdPct:
    normaliseThresholdPct(company?.costRevisionThresholdPct) ?? DEFAULT_REVISION_THRESHOLD_PCT,
  defaultPct: DEFAULT_REVISION_THRESHOLD_PCT,
});

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // Impersonation reads, the way the recipes GET lets it — non-negotiable #3
  // — and PUT below does not consult it, so a write cannot borrow the carve-out.
  if (!member.impersonation) {
    const full = await loadEnforceableMember(db, member.id);
    try {
      requireCostBasisRead(full, "materialRecipes");
    } catch (err) {
      const { body, status } = permissionErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }
  const company = await db.company.findFirst({
    where: { id: member.companyId },
    select: { costRevisionThresholdPct: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(shape(company));
}

// PUT { thresholdPct } → the company's threshold, a whole percent 0–100.
export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "materialRecipes");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  let body = {};
  try {
    body = (await request.json()) || {};
  } catch {
    body = {};
  }
  // Refused, never clamped — see normaliseThresholdPct. "150" is a typo to
  // report, not a 100 to store under the person's name.
  const thresholdPct = normaliseThresholdPct(body.thresholdPct);
  if (thresholdPct === null) {
    return NextResponse.json(
      { error: "Enter a whole number from 0 to 100." },
      { status: 400 },
    );
  }

  const updated = await db.company.update({
    where: { id: member.companyId },
    data: { costRevisionThresholdPct: thresholdPct },
    select: { costRevisionThresholdPct: true },
  });
  return NextResponse.json(shape(updated));
}
