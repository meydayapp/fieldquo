// app/api/analytics/benchmark/route.js
//
// The same payload as /api/analytics/pricing-benchmark, from the same library
// function — this is the shorter-named sibling, and it shipped with no gate at
// all while the longer-named one required showPricing.
//
// The whole response is money: what this company charges per category against
// what the platform average is. A member configured to see no prices was one
// URL away from both halves, including the rate card of the company they work
// for. Gated identically rather than deleted, because an orphaned route is not
// proof nothing calls it.
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { getPricingBenchmark } from "@/lib/analytics/pricingBenchmark";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireToggle(full, "showPricing", "see pricing benchmarks");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const result = await getPricingBenchmark({ companyId: member.companyId });
  return NextResponse.json(result);
}
