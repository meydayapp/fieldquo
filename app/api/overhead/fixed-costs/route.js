// app/api/overhead/fixed-costs/route.js
//
// The recurring fixed costs behind Settings → Overhead: rent, insurance, the
// phone bill, the software subscriptions. Everything that arrives every month
// and has no principal, no interest rate and no payoff date.
//
// ── Why these are Expense rows and not a new model ──────────────────────────
//
// lib/analytics/burnRate.js ALREADY counts `Expense{isOverhead, recurring}` in
// the monthly burn — that record has been the definition of a recurring fixed
// cost since before this route existed. It was only reachable from Settings →
// Expense Tracking, so the Overhead screen showed a "monthly fixed costs"
// total that included rows it neither listed nor let you create, and the only
// thing you COULD add there was a debt with a principal. A lease has no
// principal; the owner had nowhere to put rent.
//
// A new FixedCost model would have been the worse fix: two tables feeding one
// burn number, and a contractor who entered rent in both would double their
// own price floor with nothing on the way telling them so.
//
// ── Why this isn't just /api/expenses ───────────────────────────────────────
//
// That route scopes its list to `createdById: member.userId` for anyone
// without "expenses:view_record_edit_all" — right for receipts, wrong here.
// Burn rate is company-wide, so a list that hid a colleague's rent row would
// disagree with the total printed next to it. These are company commitments,
// gated like the salaries and debts they sit beside.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import {
  requireCostBasisRead,
  requireCostBasisWrite,
} from "@/lib/permissions/costBasis";
import { recordActivity } from "@/lib/activity/log";

// The frequencies that can be converted to a month. `one_time` is excluded on
// purpose: a one-off is not a fixed cost, and burnRate multiplies it by 0, so
// offering it here would be a row you can save that changes nothing. `hourly`
// is excluded because an Expense carries no hours — see the enum comment in
// prisma/schema.prisma.
export const FIXED_COST_FREQUENCIES = ["weekly", "monthly", "yearly"];

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The company's fixed monthly costs — rent, insurance, vehicle payments. The
  // write path is gated; the read was not. Then the read was gated on
  // `user:manage`, which a Dispatcher holds — so the itemised overhead behind
  // the margin was still readable with jobCosting:false. Both halves now go
  // through one rule; see lib/permissions/costBasis.js.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisRead(full, "fixedCosts");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const rows = await db.expense.findMany({
    where: { companyId: member.companyId, isOverhead: true, recurring: true },
    select: { id: true, category: true, amount: true, frequency: true, notes: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(rows);
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same gate as the salaries and debts on the same screen, and deliberately
  // the same rule as the GET above: these three numbers add up to the
  // company's price floor, so being able to add one while being refused the
  // list is a way to move every future quote's floor unseen.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisWrite(full, "fixedCosts");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const body = await request.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const amount = Number(body?.amount);
  const frequency = body?.frequency || "monthly";

  if (!name) {
    return NextResponse.json(
      { error: "Give the cost a name — rent, insurance, phone." },
      { status: 400 },
    );
  }
  // `> 0`, not truthy: a fixed cost of zero is a row that changes no number on
  // the screen it was entered from, and a negative one would quietly LOWER the
  // price floor.
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "Enter an amount greater than zero." },
      { status: 400 },
    );
  }
  if (!FIXED_COST_FREQUENCIES.includes(frequency)) {
    return NextResponse.json(
      { error: "Choose weekly, monthly or yearly." },
      { status: 400 },
    );
  }

  const created = await db.expense.create({
    data: {
      companyId: member.companyId,
      createdById: member.userId,
      // The name IS the category. Expense.category is free text (see the
      // preset list in Settings → Expense Tracking), so "Shop rent" becomes
      // its own bar in the category breakdown rather than disappearing into
      // an "Other" bucket.
      category: name,
      amount,
      frequency,
      isOverhead: true,
      recurring: true,
      date: new Date(),
    },
    select: { id: true, category: true, amount: true, frequency: true, notes: true },
  });

  await recordActivity(member, {
    action: "settings.fixed_cost_added",
    entityType: "settings",
    summary: `Added fixed cost ${name} at $${amount}/${frequency}`,
    metadata: { name, amount, frequency },
  });

  return NextResponse.json(created, { status: 201 });
}
