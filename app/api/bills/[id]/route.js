// app/api/bills/[id]/route.js
//
// Settling a bill, un-settling one, and removing a row that was typed wrong.
//
// ── "Mark as paid" is a record, not a payment ──────────────────────────────
//
// This moves no money and the screen must not suggest it does — the contractor
// pays hydro at the bank or on a card, then tells FieldQuo it is done. That is
// the whole feature the owner asked for, and a Pay button that only wrote a
// timestamp would be the exact control AGENTS.md forbids: one that appears to
// work and doesn't.
//
// Un-settling is supported for the same reason the asset disposal date can be
// cleared: a mis-click on the wrong row is the most likely mistake on this
// screen, and there is no other way back.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { billStatus } from "@/lib/accounting/bills";
import { recordActivity } from "@/lib/activity/log";

const SELECT = {
  id: true,
  category: true,
  amount: true,
  dueDate: true,
  paidAt: true,
  notes: true,
  isOverhead: true,
};

const DENIAL =
  "You don't have access to the company's bills. Ask an owner or admin.";

async function seesCompanyBills(memberId) {
  const full = await loadEnforceableMember(db, memberId);
  return hasLevel(full, "expenses", "view_record_edit_all");
}

/**
 * The row, scoped to the caller's company AND to being a bill.
 *
 * `dueDate: { not: null }` in the WHERE, not just companyId: this route lets
 * anyone with the company-wide expenses level edit a row they did not record,
 * which is right for a payables list and wrong for a colleague's fuel receipt.
 * Without the extra clause it would be a way to delete one by id. Same shape,
 * same reason, as app/api/overhead/fixed-costs/[id]/route.js.
 */
async function loadBill(id, companyId) {
  return db.expense.findFirst({
    where: { id, companyId, dueDate: { not: null } },
    select: { id: true, category: true },
  });
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!(await seesCompanyBills(member.id)))
    return NextResponse.json({ error: DENIAL }, { status: 403 });

  const existing = await loadBill(_params.id, member.companyId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};

  if (body?.paid !== undefined) {
    // A timestamp, not a boolean, because "paid" without "when" cannot answer
    // the question this screen exists for. `paidOn` lets the contractor record
    // the real date when they settle it days later.
    if (body.paid) {
      const when = body?.paidOn ? new Date(body.paidOn) : new Date();
      if (Number.isNaN(when.getTime()))
        return NextResponse.json({ error: "That payment date isn't a date." }, { status: 400 });
      data.paidAt = when;
    } else {
      data.paidAt = null;
    }
  }

  if (body?.dueDate !== undefined) {
    const due = body.dueDate ? new Date(body.dueDate) : null;
    // Deliberately NOT nullable here. Clearing the due date would take the row
    // out of the bills list without deleting it — it would vanish from the
    // panel and stay in the expense ledger, which is the worst of both.
    if (!due || Number.isNaN(due.getTime()))
      return NextResponse.json({ error: "When is it due?" }, { status: 400 });
    data.dueDate = due;
    data.date = due;
  }

  if (Object.keys(data).length === 0)
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });

  const updated = await db.expense.update({
    where: { id: existing.id },
    data,
    select: SELECT,
  });

  await recordActivity(member, {
    action: "expense.bill_updated",
    entityType: "expense",
    entityId: existing.id,
    summary:
      data.paidAt === undefined
        ? `Rescheduled bill ${existing.category}`
        : data.paidAt
          ? `Marked bill ${existing.category} as paid`
          : `Marked bill ${existing.category} as unpaid`,
    metadata: { name: existing.category },
  });

  return NextResponse.json({ ...updated, status: billStatus(updated, new Date()) });
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!(await seesCompanyBills(member.id)))
    return NextResponse.json({ error: DENIAL }, { status: 403 });

  const existing = await loadBill(_params.id, member.companyId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.expense.delete({ where: { id: existing.id } });

  await recordActivity(member, {
    action: "expense.bill_removed",
    entityType: "expense",
    summary: `Removed bill ${existing.category}`,
    metadata: { name: existing.category },
  });

  return NextResponse.json({ success: true });
}
