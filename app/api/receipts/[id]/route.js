// app/api/receipts/[id]/route.js
//
//   GET    one receipt for the review screen — what was read, the checks, the
//          likely duplicates, the suggestions and the jobs this person may
//          link it to (lib/receipts/view.js).
//   PATCH  { action: "office" }   crew: "not sure — let the office decide"
//          { action: "void", reason, note? }   don't book this one (a
//                 duplicate, not a receipt). The row and its photo STAY —
//                 voiding is a status, never a delete.
//          { action: "restore" }  office: undo a void.
//
// Next 16: params is a Promise.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { mayTouchReceipt, receiptScope, seesAllReceipts } from "@/lib/receipts/access";
import { receiptDetail } from "@/lib/receipts/view";
import { recordActivity } from "@/lib/activity/log";

const EXPENSE_SELECT = {
  id: true,
  projectId: true,
  isOverhead: true,
  category: true,
  amount: true,
  taxAmount: true,
  taxBreakdown: true,
  receiptLines: true,
};

/** Stable codes; the screen translates them. Not exported — a route file may
 *  only export its handlers and config in Next 16. */
const VOID_REASONS = Object.freeze(["duplicate", "not_a_receipt", "personal", "other"]);

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const receipt = await db.receipt.findFirst({
    where: { id, companyId: member.companyId, ...receiptScope(full, member.userId) },
    include: { expenses: { select: EXPENSE_SELECT } },
  });
  // 404 for someone else's receipt, not 403 — a crew member probing ids must
  // not learn which ones exist.
  if (!receipt) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(await receiptDetail({ receipt, full, userId: member.userId }));
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  const receipt = await db.receipt.findFirst({
    where: { id, companyId: member.companyId, ...receiptScope(full, member.userId) },
    select: { id: true, status: true, createdById: true, extract: true },
  });
  if (!receipt || !mayTouchReceipt(full, member.userId, receipt)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const office = seesAllReceipts(full);

  if (body.action === "office") {
    if (receipt.status === "confirmed" || receipt.status === "void") {
      return NextResponse.json({ error: "This receipt is already settled." }, { status: 409 });
    }
    await db.receipt.update({ where: { id }, data: { officeDecides: true } });
    await recordActivity(member, {
      action: "receipt.office_decides",
      entityType: "receipt",
      entityId: id,
      summary: "Asked the office to decide where a receipt belongs",
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "void") {
    // A booked receipt is not voided here: its expenses are already in the
    // books, and voiding the paper while the money stays booked would make
    // the two disagree. The office re-links or removes those expenses first.
    if (receipt.status === "confirmed") {
      return NextResponse.json({ error: "This receipt is already booked. Change its expenses instead." }, { status: 409 });
    }
    if (receipt.status === "void") return NextResponse.json({ ok: true });
    const reason = VOID_REASONS.includes(body.reason) ? body.reason : "other";
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 300) : "";
    await db.receipt.update({
      where: { id },
      data: { status: "void", voidedAt: new Date(), voidReason: note ? `${reason}: ${note}` : reason, officeDecides: false },
    });
    await recordActivity(member, {
      action: "receipt.voided",
      entityType: "receipt",
      entityId: id,
      summary: `Marked a receipt as not to be booked (${reason})`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "restore") {
    if (!office) return NextResponse.json({ error: "Only the office can restore a receipt." }, { status: 403 });
    if (receipt.status !== "void") return NextResponse.json({ ok: true });
    await db.receipt.update({
      where: { id },
      data: { status: receipt.extract ? "needs_review" : "unreadable", voidedAt: null, voidReason: null },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
