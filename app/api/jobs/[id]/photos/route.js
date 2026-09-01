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

/**
 * File a photo against this job.
 *
 * ── The intake path that did not exist ────────────────────────────────────
 *
 * Until now a JobPhoto row could be created in exactly ONE place —
 * lib/crew/inbox.js, when a crew member texts a picture in. So a contractor who
 * does not use crew SMS could never get a photo onto a job at all, and the
 * curator below them rendered `null` rather than an empty box, which meant the
 * feature was not merely empty on their screen but invisible.
 *
 * This does NOT upload anything. /api/upload already owns that — signed,
 * authenticated, foldered per company — and the browser posts the file there
 * first and hands us the resulting URL. Two routes rather than one because the
 * upload endpoint is shared by quotes, invoices, leads and the site builder,
 * and giving each of them its own Cloudinary path is how the signing rules
 * drift apart.
 */
export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── Was view_create_edit; the real gap it created ──────────────────────
  //
  // "Filing a photo is an edit to the job's record, not a view of it" was
  // the original reasoning, and it quietly locked the Crew preset — jobs:
  // view_only, and the ONLY tier this upload control exists for — out of the
  // button this route sits behind. GET a job's photos needs only view_only;
  // POSTing a new one needed a level Crew has never held, so the upload panel
  // rendered for every crew member and 403'd for all of them: a control that
  // appears to work and doesn't, the exact failure AGENTS.md names.
  //
  // Filing was already the crew's job by SMS (lib/crew/inbox.js), with no
  // permission check on `jobs` at all — only a phone number matched against
  // the Worker roster. Requiring MORE from the web control than the text
  // line ever did was the actual bug, not a deliberate stricter gate. This
  // still can't reach another tenant's job, or (for a scoped Crew member) a
  // job they aren't on — assignedJobWhere below narrows that exactly as it
  // does for GET.
  //
  // Featuring a photo onto the public website, or re-staging it, is a
  // curation decision and stays at view_create_edit on PATCH below — that
  // distinction is deliberate, not a leftover.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "add job photos",
  );
  if (denied) return denied;

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const items = Array.isArray(body?.photos) ? body.photos : [];

  // https only, and length-capped, for the same reason lib/ai/provider.js
  // filters image URLs: a data: or blob: URL is meaningless to anything that
  // later fetches it, and would file a row pointing at nothing.
  const rows = items
    .map((it) => ({
      url: typeof it?.url === "string" ? it.url.trim().slice(0, 500) : "",
      stage: STAGES[it?.stage] ? it.stage : "progress",
      caption: typeof it?.caption === "string" ? it.caption.trim().slice(0, 200) || null : null,
    }))
    .filter((r) => /^https:\/\//.test(r.url));

  if (!rows.length) {
    // Distinguished from a server fault: nothing was wrong with us, the request
    // simply carried no usable picture.
    return NextResponse.json(
      { error: "No usable photo in that upload.", reason: "no_photos" },
      { status: 400 },
    );
  }

  // companyId is re-derived from the session on every row and never taken from
  // the body — the cross-tenant write the reference CSV importer got wrong.
  await db.jobPhoto.createMany({
    data: rows.map((r) => ({ ...r, companyId: member.companyId, jobId: id })),
  });

  const photos = await db.jobPhoto.findMany({
    where: { jobId: id, companyId: member.companyId },
    orderBy: [{ stage: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, url: true, stage: true, featured: true, caption: true, createdAt: true,
    },
  });
  return NextResponse.json({ added: rows.length, photos });
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
