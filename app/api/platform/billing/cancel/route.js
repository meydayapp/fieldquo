// app/api/platform/billing/cancel/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { cancelSubscription } from "@/lib/platform/stripeBilling";
import { notifyCancellation } from "@/lib/billing/notify";
import { recordActivity } from "@/lib/activity/log";
import { recordError } from "@/lib/platform/errorLog";
import { isValidReason } from "@/lib/billing/retention";
import { stripe } from "@/lib/stripe";
import { writeSubscriptionFromStripe } from "@/lib/platform/stripeSync";
import { isCanceledSubscriptionError } from "@/lib/billing/subscriptionFields";

// Self-serve cancellation. Cancels at Stripe immediately and writes Stripe's
// reply onto the row in the same request.
//
// ── This route used to write nothing ────────────────────────────────────────
//
// The header here said the webhook's customer.subscription.deleted handling
// "should be what actually flips Subscription.status", to avoid the two
// getting out of sync with what Stripe did. On 2026-09-13 the owner cancelled
// his own $1 live-test plan: Stripe ended it at 20:06 UTC, the activity row
// was written, and the Subscription row said `active` for the rest of the day
// — no Stripe event had reached the deployment at all. Every screen then
// offered a pause, a plan change and a second cancel that Stripe refused.
//
// Not touching the row did not keep it in sync with Stripe; it kept it wrong
// for exactly as long as the webhook was missing. Stripe's reply to the cancel
// call IS what Stripe did, and it is in hand — so it is written here, through
// the same mapping the webhook uses, and the webhook's later arrival is a
// no-op rather than the only hope.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Owner/admin, not "user:manage" — that permission is held by supervisors,
  // whose job is scheduling people, not ending the company's subscription.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const subscription = await db.subscription.findUnique({
    where: { companyId: member.companyId },
  });

  if (!subscription?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "No active subscription to cancel" },
      { status: 400 },
    );
  }

  // Why they're leaving, if the save flow collected it. The single most
  // valuable field in the billing tables and the one nobody remembers to
  // collect — by the time you want it, they're gone and you can't ask.
  const body = await request.json().catch(() => ({}));
  const reason = isValidReason(body?.reason) ? body.reason : null;
  const note = typeof body?.note === "string" ? body.note.slice(0, 2000) : null;

  // Already cancelled — say so. The button is hidden once the row says
  // canceled, but the row can lag Stripe (above), so the check is live below
  // as well; this one just saves the Stripe call.
  if (subscription.status === "canceled") {
    return NextResponse.json({ ok: true, alreadyCancelled: true, canceledAt: subscription.canceledAt });
  }

  let cancelled;
  try {
    cancelled = await cancelSubscription(subscription.stripeSubscriptionId);
  } catch (err) {
    // "No such subscription" / "A canceled subscription can only update…":
    // Stripe already ended it and our row did not know. That is a state, not
    // a failure — sync the row from what Stripe holds and answer honestly.
    if (isCanceledSubscriptionError(err)) {
      const synced = await syncAlreadyCancelled(member.companyId, subscription);
      return NextResponse.json({ ok: true, alreadyCancelled: true, canceledAt: synced.canceledAt });
    }
    console.error("[platform/billing/cancel]", err);
    return NextResponse.json(
      { error: "Could not cancel through Stripe" },
      { status: 500 },
    );
  }

  // ── The row, from Stripe's reply, before anything else ──────────────────
  //
  // status "canceled", canceledAt (the 30-day read-only window starts here —
  // lib/billing/access.js), the period end, and the clears a cancellation
  // implies. Written before the email and the activity row: if either of
  // those fails the one thing that must be true — the row agrees with Stripe
  // — already is.
  try {
    await writeSubscriptionFromStripe(member.companyId, { ...cancelled, status: "canceled" }, { row: subscription });
  } catch (err) {
    console.error("[platform/billing/cancel] Stripe cancelled but the row was not written", err);
    // Filed rather than swallowed: Stripe has ended the plan and our row
    // disagrees, which is the exact state this route exists to prevent. The
    // six-hourly billing-sync cron will catch it; this makes it visible now.
    await recordError({
      area: "billing",
      code: "cancel_row_write_failed",
      message: `Stripe cancelled ${subscription.stripeSubscriptionId} but the Subscription row could not be updated: ${err?.message}`,
      companyId: member.companyId,
    });
  }

  try {
    if (reason || note) {
      await db.subscription.update({
        where: { companyId: member.companyId },
        data: {
          cancelReason: [reason, note].filter(Boolean).join(" — "),
        },
      }).catch(() => {
        // Never fail a cancellation over analytics. They asked to leave; the
        // one thing that must work is leaving.
      });
    }

    // The customer.subscription.deleted webhook also sends this when it
    // arrives, but a company whose webhook isn't reaching us would otherwise
    // cancel and hear nothing at all. notifyCancellation is idempotent and
    // this is the moment the person is actually waiting for confirmation.
    await notifyCancellation(member.companyId, request, {
      periodEnd: cancelled?.current_period_end
        ? new Date(cancelled.current_period_end * 1000)
        : null,
    });

    await recordActivity(member, {
      action: "billing.cancelled",
      entityType: "settings",
      summary: "Cancelled the FieldQuo subscription",
      metadata: { stripeSubscriptionId: subscription.stripeSubscriptionId },
    });

    return NextResponse.json({
      ok: true,
      canceledAt: cancelled?.canceled_at ? new Date(cancelled.canceled_at * 1000) : new Date(),
    });
  } catch (err) {
    // Stripe HAS cancelled and the row HAS been written by this point; what
    // failed is the email or the activity row. Answering 500 here would tell
    // the person their cancellation failed when it did not.
    console.error("[platform/billing/cancel] cancelled, but the follow-up failed", err);
    return NextResponse.json({ ok: true, note: "Cancelled. The confirmation email may be delayed." });
  }
}

/**
 * Stripe refused the cancel because the subscription is already gone. Read
 * what Stripe holds and write it; if Stripe has nothing under that id at all
 * (resource_missing on the retrieve too), there is nothing left to bill the
 * company for, and "cancelled now" is the truthful state of their account.
 */
async function syncAlreadyCancelled(companyId, row) {
  let live = null;
  try {
    live = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
  } catch {
    live = null;
  }
  const obj = live
    ? { ...live, status: "canceled" }
    : { id: row.stripeSubscriptionId, status: "canceled", canceled_at: null };
  const { after } = await writeSubscriptionFromStripe(companyId, obj, { row });
  return { canceledAt: after?.canceledAt || row.canceledAt || null };
}
