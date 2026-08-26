// app/api/expenses/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  const isOverhead = searchParams.get("isOverhead");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Scope to their own expenses unless they hold the "everyone's" level.
  const full = await loadEnforceableMember(db, member.id);
  const seesEveryone = hasLevel(full, "expenses", "view_record_edit_all");

  const expenses = await db.expense.findMany({
    where: {
      companyId: member.companyId,
      ...(seesEveryone ? {} : { createdById: member.userId }),
      ...(projectId && { projectId }),
      ...(isOverhead !== null &&
        isOverhead !== undefined && { isOverhead: isOverhead === "true" }),
      ...(from && to && { date: { gte: new Date(from), lte: new Date(to) } }),
    },
    include: { material: { select: { id: true, name: true } } },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(expenses);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const body = await request.json();
  const {
    category,
    amount,
    date,
    notes,
    projectId,
    isOverhead,
    recurring,
    frequency,
  } = body;

  if (!category || amount === undefined) {
    return NextResponse.json(
      { error: "category and amount are required" },
      { status: 400 },
    );
  }

  if (projectId && isOverhead) {
    return NextResponse.json(
      { error: "An expense can't be tied to a project AND marked as overhead" },
      { status: 400 },
    );
  }

  const expense = await db.expense.create({
    data: {
      companyId: member.companyId,
      // Stamped so the "their own" permission level has something to filter
      // on. Without this the level is unenforceable.
      createdById: member.userId,
      category,
      amount,
      date: date ? new Date(date) : new Date(),
      notes: notes || null,
      projectId: projectId || null,
      isOverhead: !!isOverhead,
      recurring: !!recurring,
      frequency: frequency || "one_time",
    },
  });

  // Expenses are job costs and a tax position, and they were untracked. A
  // job-tagged expense also moves that job's margin, which is the number the
  // owner runs the business on.
  await recordActivity(member, {
    action: "expense.created",
    entityType: "expense",
    entityId: expense.id,
    summary: `Recorded a ${expense.category || "general"} expense${
      expense.amount != null ? ` of ${expense.amount}` : ""
    }`,
    metadata: { amount: expense.amount ?? null, projectId: expense.projectId ?? null },
  });

  return NextResponse.json(expense, { status: 201 });
}
