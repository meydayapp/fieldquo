// app/api/platform/billing/plans/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await db.plan.findMany({ orderBy: { priceMonthly: "asc" } });
  return NextResponse.json(plans);
}

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "plan:manage");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const body = await request.json();
  const {
    name,
    priceMonthly,
    stripePriceId,
    maxUsers,
    maxQuotesPerMonth,
    aiCopilotEnabled,
    features,
  } = body;

  // ── A plan is a PUBLIC price, and this form publishes it instantly ───────
  //
  // QA typed -5 into the price field and pressed Save. The plan was created,
  // rendered on the public pricing page as "$-5 CAD /month", and — because
  // plans sort by price ascending — took the FIRST and most prominent slot.
  // Blank seat fields also made it "Unlimited users".
  //
  // The form has min="0" on the input and doesn't use native validation, so
  // the browser never enforced it. Client-side attributes are a convenience;
  // this is the check that counts.
  const trimmedName = String(name || "").trim();
  if (!trimmedName) {
    return NextResponse.json({ error: "Give the plan a name." }, { status: 400 });
  }

  const price = Number(priceMonthly);
  if (!Number.isFinite(price)) {
    return NextResponse.json(
      { error: "The monthly price has to be a number." },
      { status: 400 },
    );
  }
  if (price < 0) {
    return NextResponse.json(
      { error: "A plan can't have a negative price." },
      { status: 400 },
    );
  }

  // Sanity ceiling. Not a business rule — a guard against a misplaced decimal
  // reaching the pricing page before anyone notices.
  if (price > 100_000) {
    return NextResponse.json(
      {
        error:
          "That price looks like a typo. If it's deliberate, raise it in the " +
          "database rather than here.",
      },
      { status: 400 },
    );
  }

  const seats = maxUsers === undefined || maxUsers === null || maxUsers === ""
    ? null
    : Number(maxUsers);
  if (seats !== null && (!Number.isInteger(seats) || seats < 1)) {
    return NextResponse.json(
      {
        error:
          "Seats must be a whole number of 1 or more. Leave it blank for " +
          "unlimited — but do that on purpose.",
      },
      { status: 400 },
    );
  }

  const plan = await db.plan.create({
    data: {
      name: trimmedName,
      priceMonthly: price,
      stripePriceId: String(stripePriceId || "").trim() || null,
      maxUsers: seats,
      maxQuotesPerMonth: maxQuotesPerMonth ?? null,
      aiCopilotEnabled: !!aiCopilotEnabled,
      features: features || null,
    },
  });

  // Plan updates and deletions were audited; creation was not — so a plan
  // could appear on the public pricing page with no record of who put it
  // there. The one mutation that ADDS a public price was the one going
  // unlogged.
  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "plan_created",
      details: {
        planId: plan.id,
        name: plan.name,
        priceMonthly: String(plan.priceMonthly),
        maxUsers: plan.maxUsers,
        // Whether it can actually be sold. A plan with no Stripe price id
        // renders on the public page and fails at checkout, so the log should
        // say which kind was created.
        sellable: Boolean(plan.stripePriceId),
      },
    },
  });

  return NextResponse.json(plan, { status: 201 });
}
