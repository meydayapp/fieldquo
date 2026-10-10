// app/api/jobs/[id]/selections/pull/route.js
//
// "Pull from quote": copy the job's quote's colours — each service's cabinet
// Colour / Sheen / Door style and its added colour rows — onto the job.
//
// For the jobs created before the copy-on-acceptance existed (Maureen's job
// from Q-2026-0022 among them), and for a quote whose rows were added after
// the job was made. Idempotent: a row the job already has is left exactly as
// it is, edits included; only what is missing is added
// (lib/jobs/selectionsServer.js pullSelectionsFromQuote).
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { selectionsAccess } from "@/lib/jobs/selectionsAccess";
import { presentSelections, pullSelectionsFromQuote } from "@/lib/jobs/selectionsServer";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await selectionsAccess(db, member, id, { write: true });
  if (gate.refusal) return NextResponse.json(gate.refusal.body, { status: gate.refusal.status });
  const { job, full } = gate;

  if (!job.quoteId) {
    return NextResponse.json({ error: "This job has no quote to pull colours from.", code: "no_quote" }, { status: 400 });
  }
  const result = await pullSelectionsFromQuote(db, {
    jobId: job.id,
    companyId: member.companyId,
    quoteId: job.quoteId,
    createdById: full?.userId || null,
  });
  const shown = await presentSelections(db, { job, companyId: member.companyId, canEdit: true });
  return NextResponse.json({ ...shown, pulled: result });
}
