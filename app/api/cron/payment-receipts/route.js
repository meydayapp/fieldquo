// app/api/cron/payment-receipts/route.js
//
// Hourly: retry the client receipts that failed to send — each payment on its
// own, with backoff, at most five attempts within 48 hours of the first, then
// it stops and the payment row reads "Failed" with the reason
// (lib/payments/receiptState.js). Never a payment nobody tried: one recorded
// before receipts existed, or with the box unticked, has receiptAttempts 0 and
// goes only when a person presses "Send receipt".
//
// Idempotent by construction: every send is claimed on the payment row before
// it is built (lib/payments/sendReceipt.js), so an overlapping run, or a run
// racing a person's press, sends once.
//
// Same CRON_SECRET pattern as the other crons.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { retryFailedReceipts } from "@/lib/payments/sendReceipt";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    const tally = await retryFailedReceipts(db, { now: new Date() });
    return NextResponse.json({ ok: true, ...tally });
  } catch (err) {
    await recordError({
      area: "payment_receipts",
      code: "retry_failed",
      message: `The hourly payment-receipt retry failed: ${err?.message}`,
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: "retry failed" }, { status: 500 });
  }
}
