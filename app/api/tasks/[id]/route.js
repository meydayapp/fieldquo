// app/api/tasks/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import {
  canEditTask,
  completionGate,
  normaliseRequiredPhotoCount,
} from "@/lib/tasks/completion";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const existing = await db.task.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Creating was gated and editing was not ─────────────────────────────
  //
  // POST /api/tasks requires "task:create", which a Worker does not hold. This
  // route required only a session, so a Worker who could not add a to-do could
  // rename or complete ANY of the company's — including ones assigned to
  // somebody else, or to nobody.
  //
  // Your OWN task stays editable with no permission at all: ticking off the
  // job you were given is the entire point of a to-do list, and gating that on
  // task:create would make the list read-only for the people who work from it.
  //
  // An unassigned task is claimable the same way an unassigned appointment is
  // — assigning it to YOURSELF is allowed, anything else about it is not.
  //
  // canEditTask() is the "mine-or-claimable" half, shared with
  // POST /api/tasks/[id]/photos (see lib/tasks/completion.js's own comment for
  // why it's a shared helper now rather than a third inline copy).
  const editable = canEditTask(member, existing);
  if (!editable && !can(member.role, "task:create")) {
    return NextResponse.json(
      {
        error:
          "You can only change to-dos assigned to you. Ask an owner or admin " +
          "to change this one.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();

  if (
    "assignedToId" in body &&
    body.assignedToId !== existing.assignedToId &&
    body.assignedToId !== member.userId &&
    !can(member.role, "task:assign")
  ) {
    return NextResponse.json(
      { error: "Only a supervisor or admin can reassign this task" },
      { status: 403 },
    );
  }

  // ── The photo/comment requirement is a manager decision, not the ─────────
  //     assignee's to loosen
  //
  // "mine" already lets an assignee edit their own to-do freely — that's the
  // whole point of the ownership rule above. But requiredPhotoCount,
  // requiresComment and jobId are the RULE the assignee is being held to (jobId
  // decides WHERE a required photo is even allowed to land), not their own
  // content, so changing any of them is held to the same bar as task:create:
  // the same tier that can hand a to-do to someone else is the one that can
  // decide what it takes to finish it. Without this, an assignee stuck on "2
  // of 3 photos" could simply PATCH the requirement down to 2 and tick it —
  // a self-service bypass of the control this whole feature exists to add.
  const wantsPhotoCountChange = "requiredPhotoCount" in body;
  const wantsCommentFlagChange = "requiresComment" in body;
  const wantsJobChange = "jobId" in body;
  if (
    (wantsPhotoCountChange || wantsCommentFlagChange || wantsJobChange) &&
    !can(member.role, "task:create")
  ) {
    return NextResponse.json(
      {
        error:
          "Only an owner, admin or supervisor can change what this to-do requires.",
      },
      { status: 403 },
    );
  }

  let requiredPhotoCount = existing.requiredPhotoCount;
  if (wantsPhotoCountChange) {
    const parsed = normaliseRequiredPhotoCount(body.requiredPhotoCount);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    requiredPhotoCount = parsed.value;
  }

  // Would the job link be cleared in this same request? wantsJobChange rather
  // than a truthiness check on body.jobId, so a request that doesn't mention
  // jobId at all reads the EXISTING value — the same "undefined means
  // unchanged" convention every other field on this route already uses.
  const nextJobId = wantsJobChange ? body.jobId || null : existing.jobId;
  if (requiredPhotoCount && !nextJobId) {
    return NextResponse.json(
      {
        error:
          "A to-do needs to be linked to a job before it can require photos — " +
          "there's nowhere for them to land.",
      },
      { status: 400 },
    );
  }

  // POST /api/tasks proves every linked id belongs to this company. This
  // PATCH proved neither of the two it can change: `assignedToId` could name a
  // user in another tenant (whose name then comes back in
  // `include: { assignedTo }`), and `workAreaId` could name another tenant's
  // area outright. The gate above answers "may you reassign", not "to whom".
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    ...("assignedToId" in body && { assignedToId: body.assignedToId }),
    ...(body.workAreaId !== undefined && { workAreaId: body.workAreaId }),
    ...("jobId" in body && { jobId: body.jobId }),
  });
  if (notOurs) return notOurs;

  // ── The enforcement itself ────────────────────────────────────────────
  //
  // Only checked when this request is actually trying to REACH "done" — a
  // PATCH that renames a still-open to-do, or one that's already done and
  // isn't touching status, doesn't re-run the gate. See completionGate's own
  // header for why an already-done to-do is never walked back by this check.
  const enteringDone = body.status === "done" && existing.status !== "done";
  if (enteringDone) {
    const effectiveRequirement = {
      requiredPhotoCount,
      requiresComment: wantsCommentFlagChange
        ? Boolean(body.requiresComment)
        : existing.requiresComment,
    };
    const effectiveComment =
      body.completionComment !== undefined
        ? body.completionComment
        : existing.completionComment;

    const photoCount = await db.jobPhoto.count({
      where: { taskId: existing.id },
    });

    const gate = completionGate(effectiveRequirement, {
      photoCount,
      completionComment: effectiveComment,
    });
    if (!gate.ok) {
      return NextResponse.json(
        {
          error: gate.missing.map((m) => m.message).join(" "),
          missing: gate.missing,
        },
        { status: 400 },
      );
    }
  }

  const updated = await db.task.update({
    where: { id: _params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.dueDate !== undefined && {
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      }),
      ...("assignedToId" in body && {
        assignedToId: body.assignedToId || null,
      }),
      ...(body.workAreaId !== undefined && { workAreaId: body.workAreaId }),
      ...("jobId" in body && { jobId: body.jobId || null }),
      ...(wantsPhotoCountChange && { requiredPhotoCount }),
      ...(wantsCommentFlagChange && { requiresComment: Boolean(body.requiresComment) }),
      ...(body.completionComment !== undefined && {
        completionComment: body.completionComment
          ? String(body.completionComment).trim().slice(0, 2000)
          : null,
      }),
    },
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { photos: true } },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const existing = await db.task.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── The PATCH beside this was gated and this was not ───────────────────
  //
  // Editing a to-do grew the ownership rule above; deleting it kept the
  // original "any session, any row in the company" and is the more
  // destructive of the two — a renamed task is still on the list, a deleted
  // one is gone with no trace that it was ever assigned. So a Worker who
  // could not rename a colleague's to-do could remove it outright.
  //
  // Deliberately the SAME predicate as PATCH rather than a stricter one:
  // ticking something off your own list and clearing it off your own list are
  // the same act, and requiring task:create to delete your own would make the
  // list read-only for the people who work from it. Claimable-if-unassigned
  // does NOT carry over — claiming an orphan task is assigning it to
  // yourself, which is not a reason to be able to destroy it.
  const mine =
    !!member.userId &&
    (existing.assignedToId === member.userId ||
      existing.createdById === member.userId);
  if (!mine && !can(member.role, "task:create")) {
    return NextResponse.json(
      {
        error:
          "You can only delete to-dos assigned to you. Ask an owner or admin " +
          "to remove this one.",
      },
      { status: 403 },
    );
  }

  await db.task.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
