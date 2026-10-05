// app/api/analytics/hourly-floor/route.js
//
// The lowest HOURLY rate that still covers the business — calculateHourlyFloor
// (lib/analytics/minimumPrice.js), which had no caller until the quote builder's
// hourly-floor warning (owner, 2026-10-03; lib/analytics/hourlyFloor.js).
//
// Gated exactly like its sibling /api/analytics/minimum-price: a price FLOOR is
// the company's cost basis read backwards, so it takes both showPricing and
// jobCosting (requireCostBasisRead) — the same audience as the Cost & margin
// panel the builder shows it beside.
//
// Inputs, and what is a default (the warning says each):
//   billable hours  ForecastSettings.billableHoursPerMonth — the owner's own
//                   answer; absent → 400 { needsHours } and no floor at all
//   monthly costs   the cost basis of Settings → Overhead (calculateBurnRate)
//   profit          0 — the floor is break-even (FieldQuo's default)
//   crew            1 — the builder compares per invoiced hour
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { calculateHourlyFloor } from "@/lib/analytics/minimumPrice";
import { billableHoursFrom } from "@/lib/analytics/hourlyFloor";
import { loadEnforceableMember, permissionErrorResponse } from "@/lib/permissions/enforce";
import { requireCostBasisRead } from "@/lib/permissions/costBasis";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisRead(full, "minimumPrice");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const forecast = await db.forecastSettings.findUnique({
    where: { companyId: member.companyId },
    select: { billableHoursPerMonth: true },
  });
  const hours = billableHoursFrom(forecast?.billableHoursPerMonth);
  if (hours === null) {
    return NextResponse.json(
      {
        needsHours: true,
        error: "Set your billable hours a month on Settings → Overhead to get an hourly floor.",
      },
      { status: 400 },
    );
  }

  const result = await calculateHourlyFloor({
    companyId: member.companyId,
    billableHoursPerMonth: hours,
    desiredMonthlyProfit: 0,
    crewSize: 1,
  });
  if (result?.needsHours) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({
    ...result,
    // Said by the screen, so it is sent rather than assumed there.
    profitIsDefault: true,
  });
}
