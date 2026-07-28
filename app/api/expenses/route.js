// app/api/expenses/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    materialId,
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
      materialId: materialId || null,
    },
  });

  // If tagged to a material, log a price entry so trend tracking picks it up
  if (materialId) {
    await db.materialPriceEntry.create({
      data: {
        materialId,
        expenseId: expense.id,
        price: amount,
        date: expense.date,
      },
    });
  }

  return NextResponse.json(expense, { status: 201 });
}
