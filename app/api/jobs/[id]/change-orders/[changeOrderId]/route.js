// app/api/jobs/[id]/change-orders/[changeOrderId]/route.js
//
// The ONLY thing that can change about a logged change order: its status.
//
// ── Why this exists on an append-only model ────────────────────────────────
//
// ChangeOrder shipped with no edit and no delete on purpose — "a correction is
// a new entry with a negative priceDelta", the same reasoning every other
// agreement record in this codebase uses. That is unchanged here: `description`
// and `priceDelta` are still immutable, and this route refuses to touch them.
//
// What changed is that an approved change order now moves money — it raises
// the job's contract value and can be billed onto an invoice a homeowner pays.
// A number that does that needs a way back when it was typed in error, and on
// a model with no edit and no delete there was none. A status transition is not
// rewriting history; the decision IS the record, and who made it and when are
// both stored.
//
// ── The one hard stop ──────────────────────────────────────────────────────
//
// A change order that has already been billed cannot change status. Its money
// is on a document; un-approving it would leave the invoice charging for
// something the system says was never agreed. Delete the draft invoice (which
// SetNulls the link and hands the change order back) or raise a credit — a
// second change order with a negative priceDelta, which is what this model was
// designed for.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireLevel,
  requireToggle,
  permissionErrorResponse,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import { CHANGE_ORDER_STATUSES } from "@/lib/jobs/changeOrderValue";

export async function PATCH(request, { params }) {
  // Next 16: params is a Promise.
  const { id, changeOrderId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same two gates POST uses to create one: the jobs level, and showPricing
  // because approving a priceDelta is deciding money. A member who may see the
  // job but not its prices must not be able to approve one through this door.
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "decide a change order");
    requireToggle(full, "showPricing", "decide a change order");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const job = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { status } = body;
  if (!CHANGE_ORDER_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "A change order is pending, approved or rejected." },
      { status: 400 },
    );
  }

  // Scoped to THIS job, not just to the id: a change order id from another
  // company's job would otherwise be decidable through a job this member can
  // reach.
  const existing = await db.changeOrder.findFirst({
    where: { id: changeOrderId, jobId: job.id },
    select: { id: true, status: true, invoiceId: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.invoiceId) {
    return NextResponse.json(
      {
        error:
          "This change order is already on an invoice. Credit it with a second change order rather than changing this one.",
      },
      { status: 409 },
    );
  }

  const updated = await db.changeOrder.update({
    where: { id: existing.id },
    data: {
      status,
      // Moving back to `pending` is un-deciding it, so the attribution goes
      // too — leaving a name and a date on a row that says "nobody has decided
      // yet" is the two-fields-that-disagree failure again.
      decidedAt: status === "pending" ? null : new Date(),
      decidedById: status === "pending" ? null : member.userId,
    },
    include: {
      createdBy: { select: { id: true, name: true } },
      decidedBy: { select: { id: true, name: true } },
      invoice: { select: { id: true, invoiceNumber: true, status: true } },
    },
  });

  return NextResponse.json(updated);
}
