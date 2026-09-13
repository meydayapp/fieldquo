// app/api/hr/workers/[workerId]/onboarding/route.js
//
// One person's checklist from the manager's side: read it (newest run
// first, with who-did-what on every item), or start one.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { ownWorker } from "@/lib/hr/access";
import { startRun, RUN_SELECT, reconcileRunsForWorker } from "@/lib/onboarding/service";
import { describeRun } from "@/lib/onboarding/run";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request, { params }) {
  const { workerId } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const worker = await ownWorker(db, member, workerId);
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await reconcileRunsForWorker(db, { companyId: member.companyId, workerId: worker.id, actorUserId: member.userId });
  const runs = await db.onboardingRun.findMany({
    where: { companyId: member.companyId, workerId: worker.id },
    select: RUN_SELECT,
    orderBy: { startedAt: "desc" },
  });
  return NextResponse.json({ worker: { id: worker.id, name: worker.name }, runs: runs.map((r) => describeRun(r)) });
}

export async function POST(request, { params }) {
  const { workerId } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const worker = await ownWorker(db, member, workerId);
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const result = await startRun(db, {
    companyId: member.companyId,
    worker,
    templateId: typeof raw?.templateId === "string" ? raw.templateId : null,
    actorUserId: member.userId || null,
  });
  if (result.error) return NextResponse.json({ error: result.error }, { status: 409 });
  if (result.created) {
    await recordActivity(member, { action: "hr.onboarding_started", entityType: "worker", entityId: worker.id, summary: `Started onboarding checklist for ${worker.name}` });
  }
  return NextResponse.json({ run: describeRun(result.run), created: result.created }, { status: result.created ? 201 : 200 });
}
