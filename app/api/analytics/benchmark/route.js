// app/api/analytics/benchmark/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { getPricingBenchmark } from "@/lib/analytics/pricingBenchmark";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await getPricingBenchmark({ companyId: member.companyId });
  return NextResponse.json(result);
}
