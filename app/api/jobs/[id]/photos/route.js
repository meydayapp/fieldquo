// app/api/jobs/[id]/photos/route.js
//
// The photos on a job, and curating them for the website.
//
// GET   → this job's JobPhoto rows (with stage + featured + tags), newest first.
// PATCH → feature/unfeature a photo, change its stage, set a caption, or
//         change which company-defined tags (lib/gallery/tags.js) sit on it.
//
// Featuring is what lifts a photo onto the public site, so it's gated on the
// same company scope every job route uses — a photo can only be curated by
// someone in the company that owns the job.
//
// ── Tags never touch `stage` ────────────────────────────────────────────────
//
// tagIds below writes JobPhotoTagOnPhoto rows only. It never sets `stage` and
// never reads a tag's NAME to decide anything — a company could name a tag
// "issue" and this route would treat it exactly like a tag named "sanding",
// because nothing here compares a tag string against the word "issue". The
// privacy boundary two blocks down (`data.featured === true` → refuse an
// `issue`-STAGE photo) is the only "issue" this file knows about, and tags
// cannot reach it. See prisma/schema.prisma's JobPhotoTag comment.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import { normaliseStage, STAGES } from "@/lib/gallery/stages";

// Same shape at every query site in this file, so GET/POST/PATCH can never
// disagree about what a "photo" looks like to the caller.
const PHOTO_SELECT = {
  id: true, url: true, stage: true, featured: true, caption: true, createdAt: true,
  tags: { select: { tag: { select: { id: true, name: true, color: true, active: true } } } },
};

/** JobPhotoTagOnPhoto rows flattened to a plain `tags: [{id,name,color,active}]` array. */
function flattenTags(photo) {
  return { ...photo, tags: (photo.tags || []).map((row) => row.tag) };
}

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
    select: PHOTO_SELECT,
  });

  // Only ACTIVE tags are offered for a NEW selection — a retired one stays
  // visible on whatever photo already carries it (see flattenTags above) but
  // drops out of the picker, same as Worker.active hides a departed worker
  // from new assignments without touching their history.
  const companyTags = await db.jobPhotoTag.findMany({
    where: { companyId: member.companyId, active: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, color: true },
  });

  return NextResponse.json({
    photos: photos.map(flattenTags),
    stages: Object.values(STAGES).map((s) => ({ key: s.key, label: s.label })),
    tags: companyTags,
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

  // The same level as re-staging a photo or editing the job itself. Filing a
  // photo is an edit to the job's record, not a view of it.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_create_edit",
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
    select: PHOTO_SELECT,
  });
  return NextResponse.json({ added: rows.length, photos: photos.map(flattenTags) });
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

  // tagIds is its own axis, separate from `data` above — it never sets
  // `stage` and is validated/applied further down. A request that changes
  // ONLY the tags (no scalar field) is legitimate, so the "nothing to change"
  // guard below has to know about it too.
  const wantsTagChange = Array.isArray(body.tagIds);

  if (!Object.keys(data).length && !wantsTagChange) {
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

  if (Object.keys(data).length) {
    await db.jobPhoto.update({ where: { id: photoId }, data });
  }

  // ── Sync tags ──────────────────────────────────────────────────────────
  //
  // Diffed against the current set rather than blindly deleteMany+createMany,
  // so a request that only re-sends the tags it already had touches nothing.
  // Only tags this COMPANY owns can be attached — a tag id from another
  // tenant is silently dropped rather than erroring, the same tolerance
  // `assignedJobWhere` extends to a stale candidate list elsewhere in this
  // codebase, because the browser's own state can be a request behind the
  // server's. A newly REQUESTED tag must be `active` (retired tags are hidden
  // from the picker); a tag the photo already carries stays even if it was
  // retired in between, because retiring must not un-tag existing photos.
  if (wantsTagChange) {
    const requestedIds = [...new Set(body.tagIds.filter((x) => typeof x === "string" && x))];
    const [companyTags, currentJoins] = await Promise.all([
      db.jobPhotoTag.findMany({
        where: { companyId: member.companyId, id: { in: requestedIds } },
        select: { id: true, active: true },
      }),
      db.jobPhotoTagOnPhoto.findMany({ where: { photoId }, select: { tagId: true } }),
    ]);
    const companyTagById = new Map(companyTags.map((t) => [t.id, t]));
    const currentIds = new Set(currentJoins.map((j) => j.tagId));

    const toAdd = requestedIds.filter((tagId) => {
      if (currentIds.has(tagId)) return false; // already on the photo
      const tag = companyTagById.get(tagId);
      return tag && tag.active; // must be ours AND currently offerable
    });
    const toRemove = [...currentIds].filter((tagId) => !requestedIds.includes(tagId));

    if (toRemove.length) {
      await db.jobPhotoTagOnPhoto.deleteMany({ where: { photoId, tagId: { in: toRemove } } });
    }
    if (toAdd.length) {
      await db.jobPhotoTagOnPhoto.createMany({
        data: toAdd.map((tagId) => ({ photoId, tagId })),
      });
    }
  }

  const updated = await db.jobPhoto.findUnique({ where: { id: photoId }, select: PHOTO_SELECT });

  return NextResponse.json({ ok: true, photo: flattenTags(updated) });
}
