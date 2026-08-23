// app/api/activity/route.js
//
// The company's own view of its activity trail — who did what inside their
// account. Owner/admin only: it exposes actions across every user (payments,
// deletions, price changes), which isn't line-staff's to browse.
//
// Optional ?entityType & ?entityId narrow it to one record's history — the
// "what happened to THIS quote" view.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Impersonation reads it. Non-negotiable #3 is "the platform console views
  // everything and edits nothing", and this log is where support answers "who
  // changed that price" — the question they are called about. A support
  // session's role is "viewer", which is neither owner nor admin, so without
  // this line the console got the 403 below. There is no write on this route to
  // let through: the log is appended by recordActivity from other routes, and
  // an impersonated session's own actions are stamped viaImpersonation.
  if (!member.impersonation && member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can view the activity log." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || 100));

  const where = { companyId: member.companyId };
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;

  const entries = await db.activityLog.findMany({
    where,
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
