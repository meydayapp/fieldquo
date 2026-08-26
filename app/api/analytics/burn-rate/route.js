// app/api/analytics/burn-rate/route.js
export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { calculateBurnRate } from "@/lib/analytics/burnRate";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
