// app/api/jobs/[id]/plan/route.js
//
// The job plan, read whole: every plan step with its blockers, the materials
// it consumes, the hours clocked against it and the derived status
// (lib/jobs/plan.js). POST rebuilds it from the quote or reorders it.
//
// ── Why one payload and not /api/tasks?jobId= ─────────────────────────────
//
// The to-do list route answers "what may I act on" — mine, unassigned or
// created by me, unless I hold task:assign. A PLAN is a different question:
// a crew member reads the whole sequence to know what comes after the walls,
// whether or not the walls are theirs. So this route is gated the way the job
// page itself is (jobs: view_only, narrowed to assigned jobs for a scoped
// member) and returns every step. Writes still go through /api/tasks/[id],
// which keeps its own ownership rule — reading the plan is not permission to
// tick somebody else's step.
//
// No money here. estimatedHours is effort, not a rate; a crew preset with
// showPricing off sees hours and never a dollar.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { ensurePlanForJob } from "@/lib/jobs/buildPlan";
import { buildPlanPayload, PLAN_JOB_SELECT } from "@/lib/jobs/planPayload";

async function loadJob(member, full, id) {
  return db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: PLAN_JOB_SELECT,
  });
}

export async function GET(request, { params }) {
  // Next 16: params is a Promise.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see the job plan");
  if (denied) return denied;

  const job = await loadJob(member, full, id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(await buildPlanPayload(job, { companyId: member.companyId, role: member.role, permissions: full?.permissions }));
}

/**
 * POST { action: "rebuild" } — add the quote's lines the plan lacks.
 * POST { action: "reorder", ids: [...] } — the new order, every plan step.
 */
export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_create_edit", "edit the job plan");
  if (denied) return denied;

  const job = await loadJob(member, full, id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (action === "rebuild") {
    if (!job.quoteId) {
      return NextResponse.json({ error: "This job has no quote to build a plan from." }, { status: 409 });
    }
    const result = await ensurePlanForJob(job.id, { byUserId: member.userId });
    if (!result.ok) return NextResponse.json({ error: "Couldn't build the plan.", reason: result.reason }, { status: 500 });
    return NextResponse.json({ ...result, plan: await buildPlanPayload(job, { companyId: member.companyId, role: member.role, permissions: full?.permissions }) });
  }

  if (action === "reorder") {
    const ids = Array.isArray(body?.ids) ? body.ids.filter((v) => typeof v === "string") : [];
    if (!ids.length) return NextResponse.json({ error: "ids is required." }, { status: 400 });
    // Only THIS job's plan steps, and every id must be one — an id from
    // another job in the list would otherwise be silently renumbered.
    const own = await db.task.findMany({ where: { jobId: job.id, planStep: true, id: { in: ids } }, select: { id: true } });
    if (own.length !== new Set(ids).size) {
      return NextResponse.json({ error: "Every id must be a step on this job." }, { status: 400 });
    }
    await db.$transaction(ids.map((taskId, i) => db.task.update({ where: { id: taskId }, data: { sortOrder: i } })));
    return NextResponse.json({ ok: true, plan: await buildPlanPayload(job, { companyId: member.companyId, role: member.role, permissions: full?.permissions }) });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
