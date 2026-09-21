// app/api/jobs/[id]/work-order/areas/route.js
//
// One area's tick on the work order — and the Task row behind it.
//
// ── One write, two views ────────────────────────────────────────────────────
//
// The tick is a Task (sourceKey "work_order:<jobId>:<areaKey>", unique), so
// the office sees the same step on the job page's to-do list, and the photos
// filed against it go through the existing POST /api/tasks/[id]/photos with
// the ownership rule that route already enforces. Created lazily on the
// first tick or first photo rather than for every area up front: a Task per
// area on every job that has a quote would be a hundred to-dos nobody asked
// for.
//
// Gated the way a crew member's own to-do is: anyone who can SEE the job
// (jobs:view_only, scoped) may tick an area — the person holding the roller
// is the one who knows it is done. The area must be on the crew's copy: a
// hidden item cannot be ticked because it cannot be seen. Next 16: params is
// a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadWorkOrder } from "@/lib/workOrder/load";
import { areaTaskSourceKey } from "@/lib/workOrder/build";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { full, response: denied } = await levelOrRefusal(member, "jobs", "view_only", "see jobs");
  if (denied) return denied;

  const loaded = await loadWorkOrder(id, full);
  if (!loaded) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // The loader already matched the job inside this company and the caller's
  // scope; this re-read is the proof in THIS handler that the id the Task
  // below is written against is ours — scripts/check-tenant-scope.mjs reads
  // the handler, not the loader.
  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, quoteId: true, clientId: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const key = String(body.key || "");
  const area = loaded.model.areas.find((a) => a.key === key && !a.hidden);
  if (!area) return NextResponse.json({ error: "That area isn't on this work order." }, { status: 400 });

  const sourceKey = areaTaskSourceKey(id, key);
  let task = await db.task.findUnique({ where: { sourceKey }, select: { id: true, status: true } });
  if (!task) {
    try {
      task = await db.task.create({
        data: {
          companyId: member.companyId,
          title: `${area.label} — ${loaded.model.job.title}`,
          description: area.scope || null,
          createdById: member.userId,
          jobId: job.id,
          quoteId: job.quoteId || null,
          clientId: job.clientId || null,
          sourceKey,
          // Claimed by whoever ticks or photographs it first — the same
          // "mine or claimable" rule lib/tasks/completion.js applies.
          assignedToId: member.userId,
        },
        select: { id: true, status: true },
      });
    } catch (err) {
      // P2002: two phones ticked the same area in the same second. The row
      // exists; read it.
      if (err?.code !== "P2002") throw err;
      task = await db.task.findUnique({ where: { sourceKey }, select: { id: true, status: true } });
    }
  }

  if (body.done === true || body.done === false) {
    await db.task.update({
      where: { id: task.id, companyId: member.companyId },
      data: { status: body.done ? "done" : "open" },
    });
  }

  const again = await loadWorkOrder(id, full);
  return NextResponse.json({ taskId: task.id, workOrder: again.model });
}
