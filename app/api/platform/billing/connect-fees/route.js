// app/api/platform/billing/connect-fees/route.js
//
// Read-only totals for the rates card on /platform/billing/plans: what the
// platform recovered in Connect account fees this month and what companies
// still owe. Per currency, never summed across. Platform admins only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { connectFeeTotals } from "@/lib/stripe/connectFeeLedger";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const month = new Date().toISOString().slice(0, 7);
  try {
    const totals = await connectFeeTotals({ month });
    return NextResponse.json({ month, totals });
  } catch (err) {
    console.error("[platform/connect-fees]", err?.message);
    return NextResponse.json({ error: err?.message || "failed" }, { status: 500 });
  }
}
