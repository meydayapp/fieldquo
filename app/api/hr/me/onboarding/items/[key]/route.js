// app/api/hr/me/onboarding/items/[key]/route.js — I tick a TASK on my own
// checklist ("confirmed my contact details"). Evidence items refuse here
// exactly as they do for a manager.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrSelfOrRefusal } from "@/lib/hr/gate";
import { setTaskDone, runPatch, describeRun } from "@/lib/onboarding/run";
import { RUN_SELECT, announceCompletion } from "@/lib/onboarding/service";

export async function PATCH(request, { params }) {
  const { key } = await params;
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;

  const run = await db.onboardingRun.findFirst({
    where: { companyId: member.companyId, workerId: worker.id, completedAt: null },
    select: RUN_SELECT,
    orderBy: { startedAt: "desc" },
  });
  if (!run) return NextResponse.json({ error: "You have no open checklist." }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const result = setTaskDone(run.items, key, { done: raw?.done !== false, byUserId: member.userId || null, byName: worker.name || null });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  const patch = runPatch(run, result.items);
  const updated = await db.onboardingRun.update({ where: { id: run.id }, data: patch.data, select: RUN_SELECT });
  if (patch.justCompleted) await announceCompletion(db, updated, { companyId: member.companyId, actorUserId: member.userId });
  return NextResponse.json({ run: describeRun(updated) });
}
