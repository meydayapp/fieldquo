// app/api/jobs/[id]/visits/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { resolveTaskBySource } from "@/lib/tasks/autoCreate";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { requirePermission } from "@/lib/permissions";
import { normalizeChecklistItems } from "@/lib/jobs/checklistItems";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  // Scoped, then unscoped WITHIN the job: a crew member reaches this because
  // they have a visit on this job, and once they are on it they see the whole
  // day — who else is booked and when. Narrowing to their own visit would hide
  // the colleague arriving after them, which is the thing the list is for.
  const job = await db.job.findFirst({
    where: {
      id: _params.id,
      companyId: member.companyId,
      ...assignedJobWhere(full),
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const visits = await db.jobVisit.findMany({
    where: { jobId: _params.id },
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { scheduledAt: "asc" },
  });

  return NextResponse.json(visits);
}

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Deliberately view_only rather than view_create_edit. Scheduling a visit is
  // governed by the SCHEDULE category and the job:assign permission below, and
  // a member at jobs:view_only has always been able to book one from the job
  // page. This gate exists to close jobs:none, not to take that away — raising
  // it is a product decision, not a cleanup.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  // This one MATTERS, and is not the dead-code spread the write routes carry:
  // booking a visit is gated at view_only by the decision above, so a scoped
  // member really can reach it. Without the scope they could book themselves
  // (or, with job:assign, anyone) onto any job in the company — and a visit is
  // exactly what makes a job theirs, so an unscoped POST here would be a
  // self-service door into every job record the list is narrowing.
  const job = await db.job.findFirst({
    where: {
      id: _params.id,
      companyId: member.companyId,
      ...assignedJobWhere(full),
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { scheduledAt, assignedToId, checklistItems, notes } = body;

  if (!scheduledAt) {
    return NextResponse.json(
      { error: "scheduledAt is required" },
      { status: 400 },
    );
  }

  if (assignedToId && assignedToId !== member.userId) {
    try {
      requirePermission(member.role, "job:assign");
    } catch (err) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status || 403 },
      );
    }
  }

  // Normalised, not stored as posted. The browser sends whatever the picker
  // assembled — bare strings from an older client, `{label}` from a template —
  // and the job page reads `item.label`, so an unnormalised array rendered as
  // a column of "Untitled item". Null (not []) when there's nothing, so "no
  // checklist" stays distinguishable from "a checklist with no steps left".
  const items = normalizeChecklistItems(checklistItems);

  // A JobVisit has no companyId of its own — it hangs off the job, which was
  // company-scoped above. `assignedToId` does not, and the create returns
  // `include: { assignedTo: { name } }`, so an id from another tenant came
  // straight back as that company's employee name.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    assignedToId,
  });
  if (notOurs) return notOurs;

  const visit = await db.jobVisit.create({
    data: {
      jobId: _params.id,
      scheduledAt: new Date(scheduledAt),
      assignedToId: assignedToId || null,
      checklistItems: items.length ? items : null,
      notes: notes || null,
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  // Scheduling a visit IS scheduling the job — flip it off "needs a date"
  // automatically. Only from `unscheduled` so a completed/in-progress/cancelled
  // job that gains a follow-up visit isn't dragged backwards to "scheduled".
  if (job.status === "unscheduled") {
    await db.job.update({
      where: { id: _params.id },
      data: { status: "scheduled" },
    });
  }

  // Quote acceptance raises a high-priority "Schedule the job for X — the job
  // is waiting in Jobs with no date on it yet" task. It used to stay open and
  // keep saying that after the job was scheduled, so the to-do list
  // accumulated work already done and contradicted the job record.
  //
  // Keyed off the QUOTE, because that is what the task was keyed off when it
  // was created. A job with no quote behind it never had one of these.
  if (job.quoteId) {
    await resolveTaskBySource(`quote_accepted:${job.quoteId}`);
  }

  return NextResponse.json(visit, { status: 201 });
}
