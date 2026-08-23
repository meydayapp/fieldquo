// app/api/analytics/burn-rate/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { calculateBurnRate } from "@/lib/analytics/burnRate";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── monthly burn and runway ──
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

  const cashOnHand = new URL(request.url).searchParams.get("cashOnHand");
  const result = await calculateBurnRate({
    companyId: member.companyId,
    cashOnHand,
  });
  return NextResponse.json(result);
}
