// app/api/analytics/goal/route.js
//
// Set (or clear) the yearly revenue goal.
//
// A whole route for one number, because it's a decision only an owner/admin
// should make and it drives a headline on everyone's dashboard — not something
// to bury as a field in a larger form where it saves silently. GET returns the
// derived targets alongside it, so the setter can see "that's about $43k/month"
// while typing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { recordActivity } from "@/lib/activity/log";
import { normaliseGoal, deriveTargets } from "@/lib/analytics/goal";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { revenueGoalAnnual: true },
  });

  const annual = company?.revenueGoalAnnual != null ? Number(company.revenueGoalAnnual) : null;
  return NextResponse.json({ annual, targets: deriveTargets(annual) });
}

export async function PUT(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can set the revenue goal." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  // normaliseGoal turns blank/zero/garbage into null — clearing the goal — and
  // caps an absurd figure. The column stores exactly what it returns, so what's
  // saved and what the maths uses can't disagree.
  const annual = normaliseGoal(body?.annual);

  await db.company.update({
    where: { id: member.companyId },
    data: { revenueGoalAnnual: annual },
  });

  await recordActivity(member, {
    action: "revenue_goal.set",
    entityType: "company",
    entityId: member.companyId,
    summary: annual ? `Set the revenue goal to ${annual}` : "Cleared the revenue goal",
    metadata: annual ? { annual } : undefined,
  });

  return NextResponse.json({ annual, targets: deriveTargets(annual) });
}
