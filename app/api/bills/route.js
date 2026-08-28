// app/api/bills/route.js
//
// What is owed and not yet paid — the small honest version of accounts
// payable. See lib/accounting/bills.js for why this is a due date and a
// settled date on Expense rather than a Bill model and a payment rail.
//
// ── Why the whole company, not "mine" ──────────────────────────────────────
//
// GET /api/expenses scopes its list to `createdById: member.userId` for anyone
// below "expenses:view_record_edit_all", which is right for receipts and wrong
// here: this list is summed into "what goes out this month", and a total that
// counted a colleague's rows while the list beside it hid them would be a
// screen disagreeing with itself. So the whole endpoint requires the
// company-wide level rather than filtering under it — the same argument
// app/api/overhead/fixed-costs/route.js makes for the same reason.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { summariseBills, billStatus } from "@/lib/accounting/bills";
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

// One sentence, whichever half failed, and it names no role — the same
// convention as lib/permissions/costBasis.js, for the same reason.
const DENIAL =
  "You don't have access to the company's bills. Ask an owner or admin.";

/** The company-wide expenses level, which is what a payables list is. */
async function seesCompanyBills(memberId) {
  const full = await loadEnforceableMember(db, memberId);
  return hasLevel(full, "expenses", "view_record_edit_all");
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!(await seesCompanyBills(member.id)))
    return NextResponse.json({ error: DENIAL }, { status: 403 });

  const settled = new URL(request.url).searchParams.get("settled") === "true";

  // `dueDate: { not: null }` is what MAKES a row a bill. Every Expense
  // recorded before these columns existed has a null due date, and selecting
  // on paidAt alone would drag every fuel receipt in the company's history
  // into a list of things it still owes.
  const rows = await db.expense.findMany({
    where: {
      companyId: member.companyId,
      dueDate: { not: null },
      ...(settled ? {} : { paidAt: null }),
    },
    select: SELECT,
    orderBy: { dueDate: "asc" },
  });

  const now = new Date();
  return NextResponse.json({
    bills: rows.map((row) => ({ ...row, status: billStatus(row, now) })),
    summary: summariseBills(rows, now),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!(await seesCompanyBills(member.id)))
    return NextResponse.json({ error: DENIAL }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.category === "string" ? body.category.trim() : "";
  const amount = Number(body?.amount);

  if (!name)
    return NextResponse.json(
      { error: "What's the bill for? Hydro, insurance, the supplier account." },
      { status: 400 },
    );
  if (!Number.isFinite(amount) || amount <= 0)
    return NextResponse.json({ error: "Enter an amount greater than zero." }, { status: 400 });

  // Required, not defaulted to today. A bill with an invented due date is a
  // date somebody will act on — the whole panel exists to answer "when" — and
  // defaulting it would put every row in this month whether or not it belongs
  // there (AGENTS.md #5).
  const dueDate = body?.dueDate ? new Date(body.dueDate) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime()))
    return NextResponse.json({ error: "When is it due?" }, { status: 400 });

  const created = await db.expense.create({
    data: {
      companyId: member.companyId,
      createdById: member.userId,
      category: name,
      amount,
      // `date` is when the cost belongs to, and for a bill that is the day it
      // falls due. Leaving it at now() would file January's hydro under the
      // month somebody happened to type it in.
      date: dueDate,
      dueDate,
      notes: typeof body?.notes === "string" ? body.notes.trim() || null : null,
      // A bill is one instance of a cost, never the recurring pattern. The
      // pattern lives in Settings → Overhead and is what the burn rate counts;
      // marking this recurring too would charge the same hydro bill to the
      // price floor twice. lib/analytics/burnRate.js converts `one_time` at a
      // factor of zero, so this row moves no floor by itself.
      recurring: false,
      frequency: "one_time",
      isOverhead: !!body?.isOverhead,
    },
    select: SELECT,
  });

  await recordActivity(member, {
    action: "expense.bill_added",
    entityType: "expense",
    entityId: created.id,
    summary: `Recorded a bill: ${name} for $${amount}`,
    metadata: { name, amount, dueDate: dueDate.toISOString() },
  });

  return NextResponse.json(
    { ...created, status: billStatus(created, new Date()) },
    { status: 201 },
  );
}
