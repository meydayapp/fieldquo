// app/api/platform/feedback/route.js
//
// PLATFORM-side triage. Separate route from the tenant submission endpoint so
// the permission model stays obvious: /api/feedback is "report a problem" and
// requires a tenant session; this is "work the queue" and requires staff.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

const STATUSES = ["open", "in_progress", "resolved", "wont_fix"];

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where = {
    ...(status && { status }),
    ...(type && { type }),
  };

  const [rows, counts] = await Promise.all([
    db.feedback.findMany({
      where,
      // Oldest open item first when filtering to open — the queue should
      // surface what's been waiting longest, not what arrived last.
      orderBy: status === "open" ? { createdAt: "asc" } : { createdAt: "desc" },
      take: 200,
    }),
    db.feedback.groupBy({ by: ["status"], _count: true }),
  ]);

  return NextResponse.json({
    rows,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
}

export async function PATCH(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, adminNotes } = await request.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (status !== undefined && !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const updated = await db.feedback.update({
    where: { id },
    data: {
      ...(status !== undefined && {
        status,
        // Stamp resolution time on the transition, and clear it if something
        // is reopened — otherwise a reopened item still reads as resolved.
        resolvedAt:
          status === "resolved" || status === "wont_fix" ? new Date() : null,
      }),
      ...(adminNotes !== undefined && { adminNotes }),
    },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "feedback_updated",
      targetCompanyId: updated.companyId,
      details: { feedbackId: id, status, subject: updated.subject },
    },
  });

  return NextResponse.json(updated);
}
