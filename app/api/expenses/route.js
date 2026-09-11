// app/api/expenses/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { recordActivity } from "@/lib/activity/log";
import { dayRangeUtc } from "@/lib/analytics/dayRange";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

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

  // Whole days at both ends. `lte: new Date(to)` was midnight at the START of
  // the last day, so every range a user asked for silently lost its final
  // day — see lib/analytics/dayRange.js.
  const range = dayRangeUtc(from, to);
  const expenses = await db.expense.findMany({
    where: {
      companyId: member.companyId,
      ...(seesEveryone ? {} : { createdById: member.userId }),
      ...(projectId && { projectId }),
      ...(isOverhead !== null &&
        isOverhead !== undefined && { isOverhead: isOverhead === "true" }),
      ...(range && { date: range }),
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
    assetId,
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

  // The vehicle has to be ours. A fuel receipt pinned to another tenant's van
  // would land in THEIR cost per km (lib/fleet/cost.js) — and the fleet
  // payload would then hand this company's category and amount back to them.
  const badAsset = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    assetId: assetId || null,
  });
  if (badAsset) return badAsset;

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
      // Optional. Null, not "" — an empty string is not an asset id and
      // Postgres would refuse the foreign key.
      assetId: assetId || null,
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
    metadata: {
      amount: expense.amount ?? null,
      projectId: expense.projectId ?? null,
      assetId: expense.assetId ?? null,
    },
  });

  return NextResponse.json(expense, { status: 201 });
}
