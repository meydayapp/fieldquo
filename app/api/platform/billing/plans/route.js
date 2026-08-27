// app/api/platform/billing/plans/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { parsePlanFields } from "@/lib/billing/planFields";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ladder order, not price order. Sorting by price put the cheapest row
  // first, which is only coincidentally the bottom rung — and once CAD and USD
  // rows of the same tier carry the same number, price alone can't decide
  // between them. sortOrder is the number the tier itself carries; currency
  // keeps the pair of each tier adjacent.
  const plans = await db.plan.findMany({
    orderBy: [
      { sortOrder: "asc" },
      { priceMonthly: "asc" },
      { currency: "asc" },
    ],
  });
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

  // ── A plan is a PUBLIC price, and this form publishes it instantly ───────
  //
  // QA typed -5 into the price field and pressed Save. The plan was created,
  // rendered on the public pricing page as "$-5 CAD /month", and — because
  // plans sorted by price ascending — took the FIRST and most prominent slot.
  // Blank seat fields also made it "Unlimited users".
  //
  // The form has min="0" on the input and doesn't use native validation, so
  // the browser never enforced it. Client-side attributes are a convenience;
  // this is the check that counts. It lives in lib/billing/planFields.js now
  // because PATCH needed the identical rules and had none of them.
  const { data, error } = parsePlanFields(body, { partial: false });
  if (error) return NextResponse.json({ error }, { status: 400 });

  const plan = await db.plan.create({ data });

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
        priceAnnual: plan.priceAnnual === null ? null : String(plan.priceAnnual),
        seats: plan.seats,
        crewSeats: plan.crewSeats,
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
