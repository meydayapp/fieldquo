// app/api/analytics/minimum-price/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import {
  calculateMinimumPrice,
  normaliseTargetMargin,
} from "@/lib/analytics/minimumPrice";
import {
  loadEnforceableMember,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";
import { requireCostBasisRead } from "@/lib/permissions/costBasis";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── the computed price floor — the company's costs, backwards ──
  //
  // showPricing is what tells the app this person does not see money. The
  // price book, the job cost panel and the quote totals all honour it; these
  // aggregates did not, so the figures refused in detail were served up as
  // totals. sibling pricing-benchmark/route.js has carried this gate all
  // along, which is what makes the omission here an oversight rather than a
  // decision.
  //
  // showPricing alone was still the wrong line, and QA proved it: a Dispatcher
  // holds showPricing and NOT jobCosting, and read costPerJob, targetMargin
  // and the overhead/salaries/debt breakdown out of this response. A price
  // FLOOR is a cost, not a price. The gate is now both toggles, declared once
  // in lib/permissions/costBasis.js beside the three screens it sums up.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireCostBasisRead(full, "minimumPrice");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // `Number("abc")` is NaN and `Number("2")` is a margin above 100%; both used
  // to reach the formula untouched and produce a nonsense floor. Anything
  // unusable falls back to the 20% default rather than 400ing — the caller
  // asking for a price floor should still get the real one.
  const targetMargin = normaliseTargetMargin(
    new URL(request.url).searchParams.get("targetMargin"),
  );
  const result = await calculateMinimumPrice({
    companyId: member.companyId,
    targetMargin,
  });

  if (result.error) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
