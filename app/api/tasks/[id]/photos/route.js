// app/api/tasks/[id]/photos/route.js
//
// File a photo against a specific to-do — the short "open task → photo
// attached" path a crew member uses on their phone.
//
// ── Why this is its own route, not a body param on PATCH /api/tasks/[id] ────
//
// A photo is a separate row (JobPhoto), created one-or-many at a time as
// uploads finish — exactly the shape POST /api/jobs/[id]/photos already
// uses. Folding "and also create these photos" into the to-do's own PATCH
// would mean a single request doing two different kinds of write with two
// different failure modes, and a crew member who takes photo 1 of 3 in the
// driveway should have it SAVED the moment it uploads, not held in the
// browser until they also finish photo 3 and hit one combined "save".
//
// ── Gated on the to-do, not the job ──────────────────────────────────────
//
// POST /api/jobs/[id]/photos requires "jobs: view_create_edit" on the
// permission grid, which the default Crew preset does NOT hold (jobs sits at
// view_only, scoped to the crew member's own assigned jobs — see
// lib/permissions.js's "worker" preset and its own comment on why). That
// route is for curating a job's whole photo record and is deliberately held
// to the same bar as editing the job itself.
//
// This route asks a different, narrower question: "is this to-do yours to
// act on" — canEditTask()'s mine-or-claimable rule, identical to what already
// lets an assignee PATCH their own to-do's status with no grid permission at
// all. A crew member with jobs:view_only can already open their assigned
// job's page and see this to-do; gating the photo that COMPLETES it behind a
// permission they don't hold would make the requirement itself the dead
// control — visible, and impossible for the person it was assigned to.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { canEditTask } from "@/lib/tasks/completion";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const task = await db.task.findFirst({
    where: { id, companyId: member.companyId },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!canEditTask(member, task) && !can(member.role, "task:create")) {
    return NextResponse.json(
      {
        error:
          "You can only add photos to to-dos assigned to you. Ask an owner " +
          "or admin to add this one.",
      },
      { status: 403 },
    );
  }

  // A to-do created before this feature existed — or one a manager never
  // linked to a job — has nowhere for the photo to land. POST /api/tasks and
  // PATCH /api/tasks/[id] both refuse to let requiredPhotoCount be set
  // without a jobId, so this should be unreachable for anything actually
  // REQUIRING photos; it stays a real check rather than an assumption
  // because a to-do's jobId can predate that guard, or the guard could have
  // a gap this catches instead of silently filing an orphaned photo.
  if (!task.jobId) {
    return NextResponse.json(
      {
        error:
          "This to-do isn't linked to a job, so a photo has nowhere to file " +
          "against. Ask an owner or admin to link it to a job first.",
      },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body?.photos) ? body.photos : [];

  // https only, length-capped — same rule POST /api/jobs/[id]/photos applies,
  // for the same reason: a data:/blob: URL would file a row pointing at
  // nothing once anything later tries to fetch it (the AI context bridge,
  // the website curator, the photo report PDF).
  const rows = items
    .map((it) => ({
      url: typeof it?.url === "string" ? it.url.trim().slice(0, 500) : "",
      caption: typeof it?.caption === "string" ? it.caption.trim().slice(0, 200) || null : null,
    }))
    .filter((r) => /^https:\/\//.test(r.url));

  if (!rows.length) {
    return NextResponse.json(
      { error: "No usable photo in that upload.", reason: "no_photos" },
      { status: 400 },
    );
  }

  // companyId and jobId are re-derived from the loaded task, never taken from
  // the body — the same cross-tenant-write guard every other photo-filing
  // route in this codebase applies.
  await db.jobPhoto.createMany({
    data: rows.map((r) => ({
      ...r,
      companyId: member.companyId,
      jobId: task.jobId,
      taskId: task.id,
      // Not "progress" by convention alone — a required photo IS proof of
      // work in progress or finished, and defaulting it the same way the
      // general job intake does means it shows up in the job's normal photo
      // record immediately, rather than needing a second pass. The crew
      // member can re-stage it (start/finish/etc.) from JobPhotoCurator
      // afterwards the same way any other filed photo can be.
      stage: "progress",
    })),
  });

  const photos = await db.jobPhoto.findMany({
    where: { taskId: task.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true, stage: true, caption: true, createdAt: true },
  });

  return NextResponse.json({ added: rows.length, photos, photoCount: photos.length });
}
