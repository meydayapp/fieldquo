// app/api/hr/me/documents/route.js
//
// "My documents": what the company holds on me, and what I can hand in.
//
// The worker sees every non-archived row on their own file — including
// what a manager filed about them (a contract, a tax form). A file about a
// person the person cannot see is the shape of a problem, not a feature.
// They may upload their own certifications, licence and ID
// (WORKER_SELF_KINDS); those arrive unverified and a manager marks them.
// The manager's private note on a row is NOT returned here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrSelfOrRefusal } from "@/lib/hr/gate";
import { parseWorkerDocumentBody, WORKER_DOCUMENT_SELECT, WORKER_SELF_KINDS } from "@/lib/hr/documents";
import { documentExpiry } from "@/lib/hr/documentExpiry";
import { reconcileRunsForWorker } from "@/lib/onboarding/service";

const { note: _omit, ...SELF_SELECT } = WORKER_DOCUMENT_SELECT;

export async function GET(request) {
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;
  const documents = await db.workerDocument.findMany({
    where: { companyId: member.companyId, workerId: worker.id, archivedAt: null },
    select: SELF_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    worker: { id: worker.id, name: worker.name },
    documents: documents.map((d) => ({ ...d, expiry: documentExpiry(d) })),
    selfKinds: WORKER_SELF_KINDS,
  });
}

export async function POST(request) {
  const { member, worker, response } = await hrSelfOrRefusal(request);
  if (response) return response;

  const raw = await request.json().catch(() => ({}));
  const parsed = parseWorkerDocumentBody(raw, { cloudName: process.env.CLOUDINARY_CLOUD_NAME, by: "worker" });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 });

  const document = await db.workerDocument.create({
    data: { ...parsed.data, companyId: member.companyId, workerId: worker.id, uploadedById: member.userId || null },
    select: SELF_SELECT,
  });
  await reconcileRunsForWorker(db, { companyId: member.companyId, workerId: worker.id, actorUserId: member.userId });
  return NextResponse.json({ document: { ...document, expiry: documentExpiry(document) } }, { status: 201 });
}
