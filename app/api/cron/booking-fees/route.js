// app/api/cron/booking-fees/route.js
//
// Hourly: reconcile every held booking against Stripe.
//
// This is the backstop that makes a missed webhook survivable. A booking fee
// that was paid but never confirmed becomes a real appointment here; a checkout
// that was abandoned stops holding a slot here. Neither used to happen at all —
// a `pending_payment` row simply sat there for ever, on no screen, with nothing
// watching it.
//
// Hourly rather than daily for two different reasons pulling the same way: a
// paid visit the crew cannot see is urgent, and a slot held by an abandoned
// checkout is a slot a real customer is being refused.
//
// Same CRON_SECRET pattern as the other crons.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { heldBookings, reconcileBookingFee } from "@/lib/booking/reconcileBookingFee";
import { recordError } from "@/lib/platform/errorLog";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const held = await heldBookings();
  const tally = { checked: held.length, settled: 0, cancelled: 0, holding: 0, errors: 0 };

  for (const booking of held) {
    let result;
    try {
      result = await reconcileBookingFee(booking);
    } catch (err) {
      tally.errors += 1;
      console.error("[booking-fees] reconcile threw:", booking.id, err?.message);
      continue;
    }

    if (result.action === "settled") {
      tally.settled += 1;
      // A payment the webhook did not deliver is worth a line in the platform
      // error queue even though it ended well — it is the only signal that the
      // Stripe endpoint configuration needs looking at. Silence here would put
      // us straight back to a broken webhook nobody notices.
      await recordError({
        area: "booking-fee-reconcile",
        code: "webhook_missed",
        message:
          `Booking ${booking.id} was paid but never confirmed by the webhook — ` +
          `settled by the hourly reconciler. Check the Stripe endpoint configuration.`,
        detail: {
          bookingId: booking.id,
          appointmentId: result.appointmentId,
          amountCents: result.amountCents ?? null,
        },
      }).catch(() => {});
    } else if (result.action === "cancelled") {
      tally.cancelled += 1;
    } else if (result.action === "holding") {
      tally.holding += 1;
    } else if (result.action === "error" || result.action === "settle_failed") {
      tally.errors += 1;
    }
  }

  return NextResponse.json({ ok: true, ...tally });
}
