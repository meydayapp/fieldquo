// app/api/platform/billing/cancel/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { cancelSubscription, cancelPendingPlanChange } from "@/lib/platform/stripeBilling";
import { notifyCancellation } from "@/lib/billing/notify";
import { recordActivity } from "@/lib/activity/log";
import { recordError } from "@/lib/platform/errorLog";
import { isValidReason } from "@/lib/billing/retention";
import { stripe } from "@/lib/stripe";
import { writeSubscriptionFromStripe } from "@/lib/platform/stripeSync";
import { isCanceledSubscriptionError, subscriptionStatusFromStripe } from "@/lib/billing/subscriptionFields";
import { cancelModeFor } from "@/lib/billing/cancelPolicy";

// Self-serve cancellation. A trial is cancelled at Stripe immediately; a PAID
// plan is cancelled at the end of the period it has paid for
// (lib/billing/cancelPolicy.js). Either way Stripe's reply is written onto
// the row in the same request.
//
// ── Immediate, or at the period end ─────────────────────────────────────────
//
// Until 2026-09-14 every cancellation was `stripe.subscriptions.cancel()` —
// the plan ended on the button press and the rest of the paid month was kept.
// The owner's rule after his own cancel test: a paid plan runs to the date
// paid for, nothing more is charged, and Resume before then costs nothing
// (app/api/platform/billing/resume/route.js). So an `active` subscription
// gets `cancel_at_period_end: true`: status stays active, the company is NOT
// churned, and canceledAt stays null — Stripe ends it on the date, the
// customer.subscription.deleted webhook (or the six-hourly sync) writes
// `canceled` then, and the 30-day read-only window starts on the real date.
// A trial has paid for nothing and is still ended at once.
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

  // ── Ask Stripe what it is before deciding how to end it ─────────────────
  //
  // The row can lag Stripe (the header). Whether this is a trial or a paid
  // plan decides whether it ends now or on the paid-to date, and that has to
  // be Stripe's word, not the row's.
  let liveStatus = subscription.status;
  try {
    const live = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    await writeSubscriptionFromStripe(member.companyId, live, { row: subscription });
    liveStatus = subscriptionStatusFromStripe(live.status) || subscription.status;
    // Stripe ended it already (the dashboard, the portal, dunning); the row
    // was just healed from the retrieve above. A state, not a failure.
    if (liveStatus === "canceled") {
      return NextResponse.json({
        ok: true,
        alreadyCancelled: true,
        canceledAt: live.canceled_at ? new Date(live.canceled_at * 1000) : subscription.canceledAt,
      });
    }
    // Already booked to end — pressing Cancel again is not a second
    // cancellation; say when it ends.
    if (live.cancel_at_period_end && LIVE.has(liveStatus)) {
      return NextResponse.json({
        ok: true,
        alreadyCancelled: true,
        atPeriodEnd: true,
        endsAt: live.cancel_at ? new Date(live.cancel_at * 1000) : subscription.currentPeriodEnd,
      });
    }
  } catch (err) {
    if (isCanceledSubscriptionError(err)) {
      const synced = await syncAlreadyCancelled(member.companyId, subscription);
      return NextResponse.json({ ok: true, alreadyCancelled: true, canceledAt: synced.canceledAt });
    }
    // Any other Stripe error: the row's word stands and the cancel call
    // below surfaces a real failure on its own.
  }

  const mode = cancelModeFor(liveStatus);

  if (mode === "period_end") {
    return cancelAtPeriodEnd(member, subscription, request, { reason, note });
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
      // Ended on the spot: the email must not say "you keep access until".
      atPeriodEnd: false,
    });

    await recordActivity(member, {
      action: "billing.cancelled",
      entityType: "settings",
      summary: "Cancelled the FieldQuo subscription",
      metadata: { stripeSubscriptionId: subscription.stripeSubscriptionId, mode: "immediate" },
    });

    return NextResponse.json({
      ok: true,
      atPeriodEnd: false,
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

const LIVE = new Set(["active", "trialing", "past_due"]);

/**
 * A paid plan: booked to end on the date paid for. Nothing more is charged,
 * nothing is refunded, the product keeps working until then, and Resume
 * (app/api/platform/billing/resume/route.js) undoes it with one Stripe update.
 *
 * A plan change booked for the same date is released first: Stripe will not
 * update a subscription a schedule is managing, and a cancellation supersedes
 * a downgrade — the person chose the later thing.
 */
async function cancelAtPeriodEnd(member, subscription, request, { reason, note }) {
  let updated;
  try {
    if (subscription.stripeScheduleId) await cancelPendingPlanChange(subscription);
    updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  } catch (err) {
    if (isCanceledSubscriptionError(err)) {
      const synced = await syncAlreadyCancelled(member.companyId, subscription);
      return NextResponse.json({ ok: true, alreadyCancelled: true, canceledAt: synced.canceledAt });
    }
    console.error("[platform/billing/cancel] period-end cancel failed", err);
    await recordError({
      area: "billing",
      code: err?.code || err?.type || "cancel_at_period_end_failed",
      message: `Stripe refused cancel_at_period_end on ${subscription.stripeSubscriptionId}: ${err?.message}`,
      companyId: member.companyId,
    }).catch(() => {});
    return NextResponse.json({ error: "Could not cancel through Stripe" }, { status: 500 });
  }

  // The row from Stripe's reply: cancelAtPeriodEnd true, cancelAt the date,
  // status still active, canceledAt untouched (null). The company is not
  // churned — it is a customer until the date.
  try {
    await writeSubscriptionFromStripe(member.companyId, updated, { row: subscription });
  } catch (err) {
    console.error("[platform/billing/cancel] Stripe booked the cancellation but the row was not written", err);
    await recordError({
      area: "billing",
      code: "cancel_row_write_failed",
      message: `Stripe booked cancel_at_period_end on ${subscription.stripeSubscriptionId} but the Subscription row could not be updated: ${err?.message}`,
      companyId: member.companyId,
    });
  }

  const endsAt = updated?.cancel_at
    ? new Date(updated.cancel_at * 1000)
    : updated?.current_period_end
      ? new Date(updated.current_period_end * 1000)
      : subscription.currentPeriodEnd || null;

  try {
    if (reason || note) {
      await db.subscription
        .update({
          where: { companyId: member.companyId },
          data: { cancelReason: [reason, note].filter(Boolean).join(" — ") },
        })
        .catch(() => {});
    }
    await notifyCancellation(member.companyId, request, { periodEnd: endsAt, atPeriodEnd: true });
    await recordActivity(member, {
      action: "billing.cancelled",
      entityType: "settings",
      summary: endsAt
        ? `Cancelled the FieldQuo subscription — ends ${endsAt.toISOString().slice(0, 10)}`
        : "Cancelled the FieldQuo subscription at the end of the period",
      metadata: { stripeSubscriptionId: subscription.stripeSubscriptionId, mode: "period_end", endsAt },
    });
    return NextResponse.json({ ok: true, atPeriodEnd: true, endsAt });
  } catch (err) {
    console.error("[platform/billing/cancel] booked, but the follow-up failed", err);
    return NextResponse.json({ ok: true, atPeriodEnd: true, endsAt, note: "Cancelled. The confirmation email may be delayed." });
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
