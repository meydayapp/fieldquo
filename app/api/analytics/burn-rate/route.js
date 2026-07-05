// app/api/analytics/burn-rate/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { calculateBurnRate } from "@/lib/analytics/burnRate";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cashOnHand = new URL(request.url).searchParams.get("cashOnHand");
  const result = await calculateBurnRate({
    companyId: member.companyId,
    cashOnHand,
  });
  return NextResponse.json(result);
}
