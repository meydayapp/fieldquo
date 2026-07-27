// app/api/settings/members/pending/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { checkUserLimit } from "@/lib/platform/planLimits";

// Invited-but-not-yet-accepted rows + seat usage, for the Manage Team page.
// Kept separate from GET /api/settings/members so that endpoint's response
// shape stays the plain array other pages already depend on.
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [pending, activeCount, limitCheck] = await Promise.all([
    db.pendingTeamProfile.findMany({
      where: { companyId: member.companyId },
      orderBy: { createdAt: "desc" },
    }),
    db.member.count({ where: { companyId: member.companyId, active: true } }),
    checkUserLimit(member.companyId),
  ]);

  return NextResponse.json({
    pending,
    seats: {
      used: activeCount + pending.length,
      limit: limitCheck.limit ?? null,
    },
  });
}
