// app/api/ai-employee/codes/route.js
//
// The error codes extracted from this company's own manuals — the list the
// owner reviews under the Reference library. Read under the session's
// company; support may look (non-negotiable #3: view everything, edit
// nothing).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch {
      return NextResponse.json({ error: "Only an owner or admin can manage the AI employee's material." }, { status: 403 });
    }
  }
  const rows = await db.referenceCode.findMany({
    where: { companyId: member.companyId },
    orderBy: [{ sourceId: "asc" }, { page: "asc" }, { code: "asc" }],
    take: 500,
    select: {
      id: true, sourceId: true, page: true, brand: true, code: true, meaning: true, safeSteps: true, stopSigns: true,
      urgency: true, reviewedAt: true, rejectedAt: true, source: { select: { title: true } },
    },
  });
  return NextResponse.json({
    codes: rows.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      sourceTitle: r.source?.title || null,
      page: r.page,
      brand: r.brand,
      code: r.code,
      meaning: r.meaning,
      safeSteps: Array.isArray(r.safeSteps) ? r.safeSteps : [],
      stopSigns: Array.isArray(r.stopSigns) ? r.stopSigns : [],
      urgency: r.urgency,
      reviewed: Boolean(r.reviewedAt),
      rejected: Boolean(r.rejectedAt),
    })),
  });
}
