// app/api/funnels/[id]/analytics/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// Per-step drop-off + conversion for one funnel. "60% quit at the budget
// question" is the whole reason funnels beat a static form, so this counts
// DISTINCT sessions that reached each step (in the funnel's own step order) and
// the leads that came out the end. Aggregated in JS — contractor funnels are
// low-volume, and distinct-session-per-step is awkward in a single SQL query.
export async function GET(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
