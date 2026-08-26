// app/api/analytics/pricing-benchmark/route.js
//
// GET — what the market charges, and where this company sits in it.
//
// ── Who may ask ────────────────────────────────────────────────────────────
//
// showPricing. The whole payload is money, so a member configured to see no
// prices has no version of this screen — refused outright rather than served
// with the numbers removed, same call as the price book.
//
// Owners and admins hold it via the grid's unrestricted-roles rule; a
// supervisor with showPricing keeps it, because deciding what to charge is
// exactly the conversation a supervisor is in.
//
// ── What crosses the tenant line, and what doesn't ─────────────────────────
//
// See the header of lib/pricing/benchmarkData.js. The short version: prices
// and item names cross, company identity does not, and nothing is published
// below the cohort floor because at two companies the "average" lets each one
// recover the other's exact price.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, requireToggle } from "@/lib/permissions/enforce";
import { benchmarkForCompany } from "@/lib/pricing/benchmarkData";
import { MIN_COHORT } from "@/lib/pricing/benchmark";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    const full = await loadEnforceableMember(db, member.id);
    requireToggle(full, "showPricing", "see pricing benchmarks");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  try {
    const result = await benchmarkForCompany(db, member.companyId);

    return NextResponse.json({
      ...result,
      // Sent so the screen can explain an empty result rather than implying
      // the company is the only one in its trade. "Not enough companies yet"
      // and "you price nothing we can compare" are different findings.
      minCohort: MIN_COHORT,
    });
  } catch (err) {
    console.error("[pricing-benchmark]", err);
    return NextResponse.json(
      { error: "Couldn't work out the market rates just now." },
      { status: 500 },
    );
  }
}
