// app/api/cron/connect-fees/route.js
//
// Daily: read the Connect account fees Stripe billed the platform in the last
// three days and write one ConnectFeeRecovery row per fee, so the company's
// next payment carries it. Three days, not one, so a missed run is caught
// up by the next; the ledger is keyed on Stripe's balance transaction id,
// so a re-read never bills twice. See lib/stripe/connectFees.js for which
// balance transactions count and why.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { collectConnectFees } from "@/lib/stripe/connectFees";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    const stats = await collectConnectFees({ days: 3 });
    return NextResponse.json({ ok: true, ...stats });
  } catch (err) {
    console.error("[cron/connect-fees]", err?.message);
    return NextResponse.json({ ok: false, error: err?.message || "failed" }, { status: 500 });
  }
}
