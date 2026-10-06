// app/api/cron/card-payments/route.js
//
// Hourly: record every portal card payment Stripe says succeeded that has no
// Payment row yet — the backstop for the portal's own card form
// (lib/stripe/clientCardCharge.js), the flow that can carry the company's
// credit-card fee.
//
// The form records the payment from its own confirm response, and the
// payment_intent.succeeded webhook does it again on either endpoint. The gap
// this closes: 3-D Secure finished in the bank's window, the phone lost
// signal before the page could ask the server to finalize, and the webhook
// subscription for payment_intent.* is a Stripe dashboard setting no code
// can read. Without this, a client is charged and the invoice still reads
// unpaid. Every row this settles is also written to /platform/errors, because
// it means the webhook did not deliver.
//
// Same CRON_SECRET pattern as the other crons.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { reconcilePortalCardPayments } from "@/lib/stripe/clientCardCharge";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  try {
    const tally = await reconcilePortalCardPayments();
    return NextResponse.json({ ok: true, ...tally });
  } catch (err) {
    await recordError({
      area: "client_card_payments",
      code: "reconcile_failed",
      message: `The hourly portal card reconciler failed: ${err?.message}`,
      detail: { requestId: err?.requestId || null },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: "reconcile failed" }, { status: 500 });
  }
}
