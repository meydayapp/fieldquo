// app/api/platform/companies/[id]/activity/route.js
//
// Support's window into a company's action trail — the thing that was missing
// when a customer asked "who deleted this / who changed the price?". Read-only,
// company:view gated, and NEVER a write: the platform console can look at
// everything and change nothing (non-negotiable #3).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function GET(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 100));

  const entries = await db.activityLog.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      actorName: true,
      actorRole: true,
      viaImpersonation: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ entries });
}
