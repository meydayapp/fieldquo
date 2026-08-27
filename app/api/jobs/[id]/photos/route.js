// app/api/jobs/[id]/photos/route.js
//
// The photos on a job, and curating them for the website.
//
// GET   → this job's JobPhoto rows (with stage + featured), newest first.
// PATCH → feature/unfeature a photo, change its stage, or set a caption.
//
// Featuring is what lifts a photo onto the public site, so it's gated on the
// same company scope every job route uses — a photo can only be curated by
// someone in the company that owns the job.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { normaliseStage, STAGES } from "@/lib/gallery/stages";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  // Scoped like the job itself. Site photos carry the client's house in them,
  // which is the one thing a name-and-address member is trusted with for their
  // OWN job and nobody else's.
  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const photos = await db.jobPhoto.findMany({
    where: { jobId: id, companyId: member.companyId },
    orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, url: true, stage: true, featured: true, caption: true, createdAt: true,
    },
  });

  return NextResponse.json({
    photos,
    stages: Object.values(STAGES).map((s) => ({ key: s.key, label: s.label })),
  });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Featuring lifts a photo onto the company's public website, and this route
  // asked for nothing but a session and a company match. It sits at the same
  // level as the job's other edits — materials, status, the job itself.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_create_edit",
    "curate a job's photos",
  );
  if (denied) return denied;

  const body = await request.json().catch(() => ({}));
  const photoId = String(body.photoId || "");
  if (!photoId) return NextResponse.json({ error: "photoId is required." }, { status: 400 });

  // Scope: the photo must belong to a job in this company. Checked by matching
  // both, so a photo id from another tenant can't be flipped.
  // No-op for anyone who can reach view_create_edit (see the PATCH note in
  // app/api/jobs/[id]/route.js), applied for the same reason it is there.
  //
  // Spread CONDITIONALLY, unlike every other call site: JobPhoto.job is a
  // nullable relation, and `job: {}` is a filter on the relation existing
  // rather than the no-op an empty spread is on a scalar where. Writing it the
  // uniform way would have quietly excluded orphaned photos for everybody.
  const jobScope = assignedJobWhere(full);
  const photo = await db.jobPhoto.findFirst({
    where: {
      id: photoId,
      companyId: member.companyId,
      jobId: id,
      ...(Object.keys(jobScope).length ? { job: jobScope } : {}),
    },
    select: { id: true },
  });
  if (!photo) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data = {};
  if (typeof body.featured === "boolean") data.featured = body.featured;
  if (typeof body.stage === "string") data.stage = normaliseStage(body.stage);
  if (typeof body.caption === "string") data.caption = body.caption.trim().slice(0, 200) || null;

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  // Can't feature an "issue" shot — it's an office record, never marketing.
  // Whether the stage is changing in this request or already stored, block it.
  if (data.featured === true) {
    const current = await db.jobPhoto.findUnique({ where: { id: photoId }, select: { stage: true } });
    const stage = data.stage || current?.stage;
    if (stage === "issue") {
      return NextResponse.json(
        { error: "An issue photo can't be featured on your website. Change its stage first." },
        { status: 400 },
      );
    }
  }

  const updated = await db.jobPhoto.update({
    where: { id: photoId },
    data,
    select: { id: true, stage: true, featured: true, caption: true },
  });

  return NextResponse.json({ ok: true, photo: updated });
}
