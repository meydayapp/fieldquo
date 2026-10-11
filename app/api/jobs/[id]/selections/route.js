// app/api/jobs/[id]/selections/route.js
//
// A job's colours and materials (JobSelection) — the "Colours & materials"
// card on the job page.
//
//   GET    the rows, whether the caller may change them, the trade templates
//          the job's quote suggests, and whether there is a quote to pull from
//   POST   add one row
//   PATCH  reorder: { order: [every row id, in the new order] }
//
// One row is edited or removed at /selections/[selectionId]; the quote's rows
// are copied in at /selections/pull. Who may do what: lib/jobs/selectionsAccess.js.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { selectionsAccess } from "@/lib/jobs/selectionsAccess";
import { presentSelections } from "@/lib/jobs/selectionsServer";
import { normaliseSelectionInput, MAX_SELECTIONS_PER_JOB } from "@/lib/jobs/selections";

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await selectionsAccess(db, member, id);
  if (gate.refusal) return NextResponse.json(gate.refusal.body, { status: gate.refusal.status });
  return NextResponse.json(await presentSelections(db, { job: gate.job, companyId: member.companyId, canEdit: gate.canEdit }));
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await selectionsAccess(db, member, id, { write: true });
  if (gate.refusal) return NextResponse.json(gate.refusal.body, { status: gate.refusal.status });
  const { job, full } = gate;

  const body = await request.json().catch(() => ({}));
  const parsed = normaliseSelectionInput(body, { cloudName: process.env.CLOUDINARY_CLOUD_NAME || null });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error, code: parsed.code }, { status: 400 });

  const existing = await db.jobSelection.findMany({
    where: { jobId: job.id, companyId: member.companyId },
    select: { sortOrder: true },
  });
  if (existing.length >= MAX_SELECTIONS_PER_JOB) {
    return NextResponse.json(
      { error: `A job holds up to ${MAX_SELECTIONS_PER_JOB} colours and materials.`, code: "too_many" },
      { status: 400 },
    );
  }
  const sortOrder = existing.reduce((m, r) => Math.max(m, Number(r.sortOrder) || 0), 0) + 1;

  await db.jobSelection.create({
    data: {
      ...parsed.data,
      companyId: member.companyId,
      jobId: job.id,
      sortOrder,
      createdById: full?.userId || null,
    },
  });
  return NextResponse.json(await presentSelections(db, { job, companyId: member.companyId, canEdit: true }), { status: 201 });
}

// Reorder. The whole order, not a single move: two people nudging rows at the
// same time then each state a complete order, and the last one wins whole
// rather than the two interleaving into an order neither chose.
export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await selectionsAccess(db, member, id, { write: true });
  if (gate.refusal) return NextResponse.json(gate.refusal.body, { status: gate.refusal.status });
  const { job } = gate;

  const body = await request.json().catch(() => ({}));
  const order = Array.isArray(body?.order) ? body.order.map((x) => String(x)) : null;
  const rows = await db.jobSelection.findMany({
    where: { jobId: job.id, companyId: member.companyId },
    select: { id: true },
  });
  const ids = new Set(rows.map((r) => r.id));
  // Exactly this job's rows, each once. A stale list (somebody added a row
  // since this page loaded) is refused rather than half-applied, so a row is
  // never left with an order nobody chose.
  if (!order || order.length !== ids.size || new Set(order).size !== order.length || order.some((x) => !ids.has(x))) {
    return NextResponse.json(
      { error: "This list changed since it was opened. Reload and try again.", code: "stale_order" },
      { status: 409 },
    );
  }
  await db.$transaction(
    order.map((rowId, i) =>
      db.jobSelection.updateMany({
        where: { id: rowId, jobId: job.id, companyId: member.companyId },
        data: { sortOrder: i + 1 },
      }),
    ),
  );
  return NextResponse.json(await presentSelections(db, { job, companyId: member.companyId, canEdit: true }));
}
