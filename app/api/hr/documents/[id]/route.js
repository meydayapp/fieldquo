// app/api/hr/documents/[id]/route.js
//
// Mark verified, edit the dates or the note, archive. Manager only. The
// file itself and the kind are never changed — a different file is a new
// row — and nothing is deleted: `archivedAt` is the end of a document's
// life, and "which licence were we relying on in March" stays answerable.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { parseWorkerDocumentPatch, WORKER_DOCUMENT_SELECT } from "@/lib/hr/documents";
import { reconcileRunsForWorker } from "@/lib/onboarding/service";
import { recordActivity } from "@/lib/activity/log";

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;

  const existing = await db.workerDocument.findFirst({
    where: { id, companyId: member.companyId },
    select: { id: true, workerId: true, title: true, kind: true, archivedAt: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.archivedAt) return NextResponse.json({ error: "This document is archived and can't be changed." }, { status: 409 });

  const raw = await request.json().catch(() => ({}));
  const parsed = parseWorkerDocumentPatch(raw);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: parsed.status || 400 });

  const now = new Date();
  const data = {};
  if (parsed.data.verified === true) {
    data.verifiedAt = now;
    data.verifiedById = member.userId || null;
  } else if (parsed.data.verified === false) {
    data.verifiedAt = null;
    data.verifiedById = null;
  }
  if (parsed.data.archived) {
    data.archivedAt = now;
    data.archivedById = member.userId || null;
  }
  if ("note" in parsed.data) data.note = parsed.data.note;
  if ("expiresAt" in parsed.data) {
    data.expiresAt = parsed.data.expiresAt;
    // A new date is a new countdown: the reminders already sent were about
    // the old one.
    data.reminded30At = null;
    data.reminded7At = null;
  }
  if ("number" in parsed.data) data.number = parsed.data.number;

  const document = await db.workerDocument.update({ where: { id: existing.id }, data, select: WORKER_DOCUMENT_SELECT });

  if (parsed.data.archived) {
    await reconcileRunsForWorker(db, { companyId: member.companyId, workerId: existing.workerId, actorUserId: member.userId });
  }

  await recordActivity(member, {
    action: parsed.data.archived ? "hr.document_archived" : parsed.data.verified === true ? "hr.document_verified" : "hr.document_updated",
    entityType: "worker",
    entityId: existing.workerId,
    summary: `${parsed.data.archived ? "Archived" : parsed.data.verified === true ? "Verified" : "Updated"} ${existing.kind} "${existing.title}"`,
    metadata: { documentId: existing.id, changes: Object.keys(parsed.data) },
  });
  return NextResponse.json({ document });
}
