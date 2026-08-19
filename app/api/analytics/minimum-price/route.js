// app/api/analytics/minimum-price/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import {
  calculateMinimumPrice,
  normaliseTargetMargin,
} from "@/lib/analytics/minimumPrice";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
