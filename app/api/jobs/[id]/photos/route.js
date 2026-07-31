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
import { getCurrentMember } from "@/lib/currentMember";
import { normaliseStage, STAGES } from "@/lib/gallery/stages";

export async function GET(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId },
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
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const photoId = String(body.photoId || "");
  if (!photoId) return NextResponse.json({ error: "photoId is required." }, { status: 400 });

  // Scope: the photo must belong to a job in this company. Checked by matching
  // both, so a photo id from another tenant can't be flipped.
  const photo = await db.jobPhoto.findFirst({
    where: { id: photoId, companyId: member.companyId, jobId: id },
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
