// app/api/analytics/minimum-price/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import {
  calculateMinimumPrice,
  normaliseTargetMargin,
} from "@/lib/analytics/minimumPrice";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── the computed price floor — the company's costs, backwards ──
  //
  // showPricing is what tells the app this person does not see money. The
  // price book, the job cost panel and the quote totals all honour it; these
  // aggregates did not, so the figures refused in detail were served up as
  // totals. sibling pricing-benchmark/route.js has carried this gate all
  // along, which is what makes the omission here an oversight rather than a
  // decision.
  const full = await loadEnforceableMember(db, member.id);
  try {
    requireToggle(full, "showPricing", "see this");
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
