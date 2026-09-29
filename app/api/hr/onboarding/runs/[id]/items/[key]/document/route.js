// app/api/hr/onboarding/runs/[id]/items/[key]/document/route.js
//
// A manager hands in a document or a signed tax form ON the person's behalf,
// from the checklist row — the photocopied licence, the paper TD1 somebody
// filled in at the kitchen table. Same two-step upload as the Documents card
// (app/api/hr/workers/[workerId]/documents): the browser sends the file to
// Cloudinary privately (uploadFile purpose "hr"), then POSTs its URL here.
// The file becomes an ordinary WorkerDocument — it shows in the Documents
// card too — and the item ticks from it (lib/onboarding/service.js
// handInForItem). A second upload is a new document, not a replacement of
// the first: nothing is deleted or archived, the row points at the newest.
//
// A task refuses (it is ticked — ../route.js), and so does a policy (only
// the person can sign it).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { handInForItem, handInFiles } from "@/lib/onboarding/service";
import { describeRun } from "@/lib/onboarding/run";
import { recordActivity } from "@/lib/activity/log";

export async function POST(request, { params }) {
  const { id, key } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;

  const raw = await request.json().catch(() => ({}));
  let result;
  try {
    result = await handInForItem(db, {
      companyId: member.companyId,
      runId: id,
      key,
      body: raw,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      actorUserId: member.userId || null,
    });
  } catch (err) {
    // attachHandIn refusing inside the transaction (the item vanished
    // between the read and the write) rolls the document back with it.
    if (err?.status) return NextResponse.json({ error: err.message }, { status: err.status });
    throw err;
  }
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status || 400 });

  await recordActivity(member, {
    action: "hr.document_filed",
    entityType: "worker",
    entityId: result.worker.id,
    summary: `Filed ${result.document.kind} "${result.document.title}" for ${result.worker.name} (onboarding: ${key})`,
    metadata: { workerId: result.worker.id, documentId: result.document.id, kind: result.document.kind, onboardingRunId: result.run.id, itemKey: key },
  });

  const files = await handInFiles(db, { companyId: member.companyId, workerId: result.worker.id, runs: [result.run] });
  return NextResponse.json({ document: result.document, run: describeRun(result.run), files }, { status: 201 });
}
