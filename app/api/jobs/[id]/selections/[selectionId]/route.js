// app/api/jobs/[id]/selections/[selectionId]/route.js
//
// One colour / material row on a job: change it, or remove it.
//
// Remove means THIS ROW and nothing else — not the quote's colour it may have
// been copied from (that stays on the quote, and "Pull from quote" can bring
// the row back), not the job, not a photo anywhere else. The swatch URL is
// the row's own column and goes with it; the uploaded file itself is left in
// Cloudinary, as every other removed attachment in this product is.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { selectionsAccess } from "@/lib/jobs/selectionsAccess";
import { presentSelections } from "@/lib/jobs/selectionsServer";
import { normaliseSelectionInput, isBlankSelection } from "@/lib/jobs/selections";

export async function PATCH(request, { params }) {
  const { id, selectionId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await selectionsAccess(db, member, id, { write: true });
  if (gate.refusal) return NextResponse.json(gate.refusal.body, { status: gate.refusal.status });
  const { job } = gate;

  const row = await db.jobSelection.findFirst({
    where: { id: String(selectionId || ""), jobId: job.id, companyId: member.companyId },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  // Partial: only the keys sent change, so editing the notes cannot blank the
  // colour somebody else typed a minute ago.
  const parsed = normaliseSelectionInput(body, { partial: true, cloudName: process.env.CLOUDINARY_CLOUD_NAME || null });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: 400 });
  if (isBlankSelection({ ...row, ...parsed.data })) {
    return NextResponse.json(
      { error: "Say at least the area, the product or the colour — or remove the row.", code: "empty" },
      { status: 400 },
    );
  }

  await db.jobSelection.updateMany({
    where: { id: row.id, jobId: job.id, companyId: member.companyId },
    data: parsed.data,
  });
  return NextResponse.json(await presentSelections(db, { job, companyId: member.companyId, canEdit: true }));
}

export async function DELETE(request, { params }) {
  const { id, selectionId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await selectionsAccess(db, member, id, { write: true });
  if (gate.refusal) return NextResponse.json(gate.refusal.body, { status: gate.refusal.status });
  const { job } = gate;

  // The row only, held to this job AND this company in the same WHERE.
  const res = await db.jobSelection.deleteMany({
    where: { id: String(selectionId || ""), jobId: job.id, companyId: member.companyId },
  });
  if (!res?.count) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await presentSelections(db, { job, companyId: member.companyId, canEdit: true }));
}
