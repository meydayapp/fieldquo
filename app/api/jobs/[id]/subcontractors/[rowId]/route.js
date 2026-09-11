// app/api/jobs/[id]/subcontractors/[rowId]/route.js
//
// Change or remove one sub on one job. Gates as the collection route: the
// job's edit level, the roster gate, and jobCosting for the money.
//
// ══ `paid` cannot be typed ═════════════════════════════════════════════════
//
// A status of `paid` is set by app/api/subcontractors/[id]/payments when the
// recorded payments cover the agreed amount, and by nothing else. Letting a
// hand set it would produce a row that says paid with no payment behind it —
// nothing on the job's cost, nothing on the sub's T5018 total — which is the
// dead control AGENTS.md forbids, wearing a green chip.
//
// ══ Remove, not delete-anything ════════════════════════════════════════════
//
// A row with payments cannot be removed: each payment points at it, and each
// wrote an expense against this job. Taking the row out would leave money in
// the ledger with nothing to explain it. The person is told to change the
// status instead. A row with no payments — a sub added by mistake — goes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere, hasToggle } from "@/lib/permissions/enforce";
import { requireSubcontractorWrite, SUBCONTRACTOR_MONEY_TOGGLE } from "@/lib/subcontractors/access";
import { parseJobSubcontractorBody, JOB_SUBCONTRACTOR_SELECT } from "@/lib/subcontractors/payload";
import { recordActivity } from "@/lib/activity/log";

/**
 * The row, once the caller has passed the two grid gates. The gates themselves
 * stay INSIDE each handler below rather than in here, because
 * scripts/check-crew-access.mjs reads every handler under app/api/jobs for a
 * levelOrRefusal call — a gate hidden in a helper reads as a handler that
 * asks nobody anything.
 */
async function loadRow({ id, rowId, member, full }) {
  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, title: true },
  });
  if (!job) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  const row = await db.jobSubcontractor.findFirst({
    where: { id: rowId, jobId: job.id, companyId: member.companyId },
    select: {
      ...JOB_SUBCONTRACTOR_SELECT,
      subcontractor: { select: { name: true } },
      payments: { select: { id: true } },
    },
  });
  if (!row) return { response: NextResponse.json({ error: "Not found" }, { status: 404 }) };

  return { job, row };
}

export async function PATCH(request, { params }) {
  const { id, rowId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_create_edit",
    "change the subcontractors on this job",
  );
  if (denied) return denied;
  try {
    requireSubcontractorWrite(full);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const g = await loadRow({ id, rowId, member, full });
  if (g.response) return g.response;
  const { job, row } = g;

  const body = await request.json().catch(() => ({}));
  const parsed = parseJobSubcontractorBody(body, { creating: false });
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const data = parsed.data;

  if (data.status === "paid" && row.status !== "paid")
    return NextResponse.json(
      { error: "Record the payment instead — the row moves to paid when payments cover the agreed amount." },
      { status: 400 },
    );

  const touchesMoney = data.agreedAmount !== undefined || (data.status !== undefined && data.status !== row.status);
  if (touchesMoney && !hasToggle(full, SUBCONTRACTOR_MONEY_TOGGLE))
    return NextResponse.json(
      { error: "Your access level doesn't include job costing, so the amount and status stay as they are." },
      { status: 403 },
    );

  // Setting an amount on a `quoted` row without saying otherwise means the
  // price was agreed — the same rule the create applies.
  if (data.agreedAmount !== undefined && data.status === undefined && row.status === "quoted")
    data.status = "agreed";

  if (data.visitId) {
    const visit = await db.jobVisit.findFirst({ where: { id: data.visitId, jobId: job.id }, select: { id: true } });
    if (!visit) return NextResponse.json({ error: "That visit isn't on this job." }, { status: 400 });
  }
  // The import link is set on create, from the job's own quote; it is not
  // re-pointed from here.
  delete data.quoteImportId;

  const updated = await db.jobSubcontractor.update({
    where: { id: row.id },
    data,
    select: JOB_SUBCONTRACTOR_SELECT,
  });

  await recordActivity(member, {
    action: "job.subcontractor_updated",
    entityType: "job",
    entityId: job.id,
    summary: `Updated ${row.subcontractor.name} on ${job.title || "the job"} (${Object.keys(data).join(", ")})`,
    metadata: { jobId: job.id, jobSubcontractorId: row.id, fields: Object.keys(data), status: updated.status },
  });

  return NextResponse.json({ jobSubcontractor: updated });
}

export async function DELETE(request, { params }) {
  const { id, rowId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_create_edit",
    "change the subcontractors on this job",
  );
  if (denied) return denied;
  try {
    requireSubcontractorWrite(full);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const g = await loadRow({ id, rowId, member, full });
  if (g.response) return g.response;
  const { job, row } = g;

  if (row.payments.length > 0)
    return NextResponse.json(
      {
        error:
          "This subcontractor has payments recorded on this job, so the row stays. Change its status instead.",
      },
      { status: 409 },
    );

  await db.jobSubcontractor.delete({ where: { id: row.id } });

  await recordActivity(member, {
    action: "job.subcontractor_removed",
    entityType: "job",
    entityId: job.id,
    summary: `Took ${row.subcontractor.name} off ${job.title || "the job"}`,
    metadata: { jobId: job.id, jobSubcontractorId: row.id, subcontractorId: row.subcontractorId },
  });

  return NextResponse.json({ ok: true });
}
