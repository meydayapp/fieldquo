// app/api/funnels/[id]/analytics/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";

// Per-step drop-off + conversion for one funnel. "60% quit at the budget
// question" is the whole reason funnels beat a static form, so this counts
// DISTINCT sessions that reached each step (in the funnel's own step order) and
// the leads that came out the end. Aggregated in JS — contractor funnels are
// low-volume, and distinct-session-per-step is awkward in a single SQL query.
export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The same gate the funnel list and detail now carry. It was left off because
  // this route is only reachable with an id, and the id comes from a list that
  // is refused — but "you would have to know the id" is not a permission, it is
  // an obstacle, and the ids are cuids that appear in a public funnel URL.
  //
  // Carved out for impersonation on this read only, matching the sibling
  // routes: non-negotiable #3, the console views everything and edits nothing.
  if (!member.impersonation) {
    try {
      requirePermission(member.role, "user:manage");
    } catch (err) {
      return NextResponse.json(
        { error: "Only owners, admins, or supervisors can see funnel analytics" },
        { status: err.status || 403 },
      );
    }
  }

  const { id } = await params;
  const funnel = await db.funnel.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, steps: true },
  });
  if (!funnel)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [events, responses] = await Promise.all([
    db.funnelEvent.findMany({
      where: { funnelId: id, kind: "view" },
      select: { stepId: true, sessionId: true },
      take: 50000,
    }),
    db.funnelResponse.count({ where: { funnelId: id } }),
  ]);

  // Distinct sessions per step.
  const perStep = new Map();
  for (const e of events) {
    if (!perStep.has(e.stepId)) perStep.set(e.stepId, new Set());
    perStep.get(e.stepId).add(e.sessionId || `_${e.stepId}`);
  }

  const orderedSteps = Array.isArray(funnel.steps) ? funnel.steps : [];
  const firstStepViews = orderedSteps.length
    ? (perStep.get(orderedSteps[0].id)?.size ?? 0)
    : 0;

  const steps = orderedSteps.map((s, i) => {
    const views = perStep.get(s.id)?.size ?? 0;
    const prev = i === 0 ? views : (perStep.get(orderedSteps[i - 1].id)?.size ?? 0);
    return {
      id: s.id,
      kind: s.kind,
      label: s.question || s.headline || s.kind,
      views,
      // Share of people who saw the previous step who also reached this one.
      retention: prev > 0 ? Math.round((views / prev) * 100) : null,
    };
  });

  return NextResponse.json({
    starts: firstStepViews,
    completions: responses,
    conversionRate: firstStepViews > 0 ? Math.round((responses / firstStepViews) * 100) : null,
    steps,
  });
}
