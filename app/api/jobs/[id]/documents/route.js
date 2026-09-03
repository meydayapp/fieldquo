// app/api/jobs/[id]/documents/route.js
//
// A job's document store. docs/construction/AUDIT-existing.md §2 graded this
// ABSENT — "plans, permits, specs, submittals, signed contracts and warranties
// have nowhere to live except a PDF wedged into a quote's photo array" — and
// noted that the plumbing was already in place: /api/upload is signed,
// authenticated and size-capped. This route is the store, not a second uploader.
//
// ══ The upload path is the existing one ════════════════════════════════════
//
// The browser POSTs the file to /api/upload, gets back a Cloudinary URL, and
// POSTs THAT here. No file bytes reach this route. isUploadedUrl() refuses a
// URL that did not come from this deployment's own cloud, because a "contract"
// row linking to somebody else's host is a phishing link filed inside the
// contractor's own back office.
//
// ══ Two gates, on two different axes ═══════════════════════════════════════
//
// LEVEL — reading is jobs:view_only, writing is jobs:view_create_edit. Filing a
// plan against a job is office work, unlike the daily log next door, which is
// crew work by definition (see that route's header for the distinction).
//
// KIND — a contract and an invoice are, in substance, the price. They are
// withheld from anyone without showPricing, which is the axis the product
// already uses for money and which the Crew preset already has switched off.
// See MONEY_KINDS in lib/jobs/documents.js for why that dial and not a new one.
//
// ══ Nothing is ever overwritten or deleted ═════════════════════════════════
//
// A revision is a NEW row pointing at the one it replaces (supersedesId), so
// "which plan were we working from in March" stays answerable. There is no
// PATCH of a url and no DELETE anywhere in this feature.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere, hasToggle, hasLevel } from "@/lib/permissions/enforce";
import {
  normaliseKind,
  normaliseName,
  normaliseSizeBytes,
  isUploadedUrl,
  canSeeKind,
  visibleDocuments,
  revisionChains,
} from "@/lib/jobs/documents";

const SELECT = {
  id: true,
  name: true,
  kind: true,
  url: true,
  sizeBytes: true,
  mimeType: true,
  supersedesId: true,
  uploadedById: true,
  uploadedAt: true,
  updatedAt: true,
};

async function ownJob(jobId, companyId, member) {
  return db.job.findFirst({
    where: { id: jobId, companyId, ...assignedJobWhere(member) },
    select: { id: true },
  });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see this job's documents",
  );
  if (denied) return denied;

  if (!(await ownJob(id, member.companyId, full)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rows = await db.jobDocument.findMany({
    where: { jobId: id, companyId: member.companyId },
    select: SELECT,
    orderBy: { uploadedAt: "desc" },
  });

  // Filtered on the SERVER, before the chains are built. Hiding a contract in
  // the component would ship it to the browser and call that access control —
  // AGENTS.md non-negotiable #2's own words, in a different feature.
  const canSeeMoney = hasToggle(full, "showPricing");
  const { documents, hiddenCount } = visibleDocuments(rows, { canSeeMoney });

  return NextResponse.json({
    chains: revisionChains(documents),
    // A COUNT, never a list. "There is nothing here" and "there is something
    // here you may not see" are different statements, and telling a crew member
    // the first when the second is true sends them chasing a filed contract.
    hiddenCount,
    // What the panel may DRAW, decided by the same member object that gates the
    // POST below. Sent rather than re-derived in the browser so an Upload button
    // cannot exist on a screen whose POST would answer 403 — which is the
    // "control that appears to work and doesn't" this codebase is swept for.
    // It is not access control; the POST's own gate is.
    canUpload: hasLevel(full, "jobs", "view_create_edit"),
    canSeeMoney,
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_create_edit",
    "add documents to this job",
  );
  if (denied) return denied;

  if (!(await ownJob(id, member.companyId, full)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));

  let kind;
  try {
    kind = normaliseKind(raw?.kind);
  } catch (err) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status || 400 },
    );
  }

  const canSeeMoney = hasToggle(full, "showPricing");
  if (!canSeeKind(kind, { canSeeMoney })) {
    // Refused on the way IN as well as on the way out. Somebody who cannot be
    // shown a contract must not be able to file one either — otherwise the
    // upload succeeds, the row vanishes from their own list, and they upload it
    // again.
    return NextResponse.json(
      {
        error: `Your access level doesn't cover ${kind} documents — ask someone who can see pricing to file this one.`,
      },
      { status: 403 },
    );
  }

  if (!isUploadedUrl(raw?.url, { cloudName: process.env.CLOUDINARY_CLOUD_NAME })) {
    return NextResponse.json(
      {
        error:
          "That file hasn't been uploaded yet. Pick the file again — documents are stored through FieldQuo's own uploader, not linked from elsewhere.",
      },
      { status: 400 },
    );
  }

  // A revision points at a document on THIS job that this member can see and
  // that nothing has already replaced.
  let supersedes = null;
  if (raw?.supersedesId) {
    supersedes = await db.jobDocument.findFirst({
      where: { id: raw.supersedesId, jobId: id, companyId: member.companyId },
      select: { id: true, kind: true, supersededBy: { select: { id: true } } },
    });
    if (!supersedes || !canSeeKind(supersedes.kind, { canSeeMoney }))
      return NextResponse.json(
        { error: "That document isn't on this job." },
        { status: 404 },
      );
    if (supersedes.supersededBy)
      return NextResponse.json(
        {
          error:
            "That version has already been replaced. Reload and revise the current one.",
          code: "already_superseded",
        },
        { status: 409 },
      );
    if (supersedes.kind !== kind)
      return NextResponse.json(
        {
          error: `A revision keeps the same type — that one is filed as "${supersedes.kind}".`,
        },
        { status: 400 },
      );
  }

  try {
    const created = await db.jobDocument.create({
      data: {
        companyId: member.companyId,
        jobId: id,
        name: normaliseName(raw?.name, "Untitled document"),
        kind,
        url: raw.url,
        // Null, never 0 — see normaliseSizeBytes and the column's own comment.
        sizeBytes: normaliseSizeBytes(raw?.sizeBytes),
        mimeType: typeof raw?.mimeType === "string" ? raw.mimeType.slice(0, 120) : null,
        supersedesId: supersedes?.id || null,
        uploadedById: full?.userId || null,
      },
      select: SELECT,
    });

    return NextResponse.json({ document: created }, { status: 201 });
  } catch (err) {
    // supersedesId is @unique, so two people revising the same drawing at once
    // race: the `supersededBy` check above has a window between reading and
    // writing, and the constraint is what closes it. Reported as the same 409
    // that check reports, because it means the identical thing — somebody
    // already filed the next revision — rather than as a 500 that tells the
    // person their upload broke. Their file is on Cloudinary either way; what
    // they have to do is reload and revise the new head.
    if (err?.code !== "P2002") throw err;
    return NextResponse.json(
      {
        error:
          "Someone filed a new version of that document a moment ago. Reload and revise the current one.",
        code: "already_superseded",
      },
      { status: 409 },
    );
  }
}
