// app/api/hr/onboarding/runs/[id]/items/[key]/route.js
//
// A manager ticks (or unticks) a TASK on somebody's checklist — "safety
// walk-through done", with the manager's name on it. Evidence items refuse:
// they are completed by the upload, the signature or the form
// (lib/onboarding/run.js setTaskDone).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { setTaskDone, runPatch, describeRun } from "@/lib/onboarding/run";
import { RUN_SELECT, announceCompletion } from "@/lib/onboarding/service";

export async function PATCH(request, { params }) {
  const { id, key } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;

  const run = await db.onboardingRun.findFirst({ where: { id, companyId: member.companyId }, select: RUN_SELECT });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const user = member.userId ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true } }) : null;
  const result = setTaskDone(run.items, key, { done: raw?.done !== false, byUserId: member.userId || null, byName: user?.name || null });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });

  const patch = runPatch(run, result.items);
  const updated = await db.onboardingRun.update({ where: { id: run.id }, data: patch.data, select: RUN_SELECT });
  if (patch.justCompleted) await announceCompletion(db, updated, { companyId: member.companyId, actorUserId: member.userId });
  return NextResponse.json({ run: describeRun(updated) });
}
