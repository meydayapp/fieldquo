// app/api/hr/workers/[workerId]/documents/route.js
//
// A person's paperwork, from the manager's side: list it, file it.
//
// Same two-step upload as app/api/subcontractors/[id]/documents: the
// browser POSTs the file to /api/upload, gets a Cloudinary URL, and POSTs
// THAT here. isUploadedUrl() refuses any other host. Nothing is deleted —
// PATCH /api/hr/documents/[id] archives.
//
// Filing a document may complete an onboarding item ("upload a piece of
// ID"), so the run is reconciled after the write — see lib/onboarding/run.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { ownWorker } from "@/lib/hr/access";
import { parseWorkerDocumentBody, WORKER_DOCUMENT_SELECT } from "@/lib/hr/documents";
import { reconcileRunsForWorker } from "@/lib/onboarding/service";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request, { params }) {
  const { workerId } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;

  const worker = await ownWorker(db, member, workerId);
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
  const documents = await db.workerDocument.findMany({
    where: { companyId: member.companyId, workerId: worker.id, ...(includeArchived ? {} : { archivedAt: null }) },
    select: WORKER_DOCUMENT_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ worker: { id: worker.id, name: worker.name, title: worker.title }, documents });
}

export async function POST(request, { params }) {
  const { workerId } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;

  const worker = await ownWorker(db, member, workerId);
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const parsed = parseWorkerDocumentBody(raw, { cloudName: process.env.CLOUDINARY_CLOUD_NAME, by: "manager" });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 });

  const document = await db.workerDocument.create({
    data: { ...parsed.data, companyId: member.companyId, workerId: worker.id, uploadedById: member.userId || null },
    select: WORKER_DOCUMENT_SELECT,
  });

  await reconcileRunsForWorker(db, { companyId: member.companyId, workerId: worker.id, actorUserId: member.userId });

  await recordActivity(member, {
    action: "hr.document_filed",
    entityType: "worker",
    entityId: worker.id,
    summary: `Filed ${document.kind} "${document.title}" for ${worker.name}`,
    metadata: { workerId: worker.id, documentId: document.id, kind: document.kind },
  });
  return NextResponse.json({ document }, { status: 201 });
}
