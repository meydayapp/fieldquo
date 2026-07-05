// app/api/analytics/minimum-price/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { calculateMinimumPrice } from "@/lib/analytics/minimumPrice";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const targetMargin = Number(
    new URL(request.url).searchParams.get("targetMargin") || 0.2,
  );
  const result = await calculateMinimumPrice({
    companyId: member.companyId,
    targetMargin,
  });

  if (result.error) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
