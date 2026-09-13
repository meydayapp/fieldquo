// app/api/settings/subscription/retention/route.js
//
// The cancellation save flow.
//
//   GET  ?reason=seasonal   what we can offer this company, and why
//   POST { offer, reason }  accept one
//
// On the billing allow-list (lib/billing/access.js) so an overdue company can
// still reach it — "it costs too much" is exactly why some of them stopped
// paying, and the offer that keeps them is the one they can't get to if we
// wall it off.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { recordActivity } from "@/lib/activity/log";
import {
  offersFor,
  cooldownMessage,
  isValidReason,
  offerCooldownOver,
  DISCOUNT_PERCENT,
  DISCOUNT_MONTHS,
  MAX_PAUSE_MONTHS,
  retentionCouponName,
} from "@/lib/billing/retention";
import { writeSubscriptionFromStripe } from "@/lib/platform/stripeSync";
import { isCanceledSubscriptionError } from "@/lib/billing/subscriptionFields";

async function requireOwner(request) {
  // memberOrRefusalPlain, not getCurrentMember: this helper's callers turn a
  // returned { error, status } into the response themselves, and the gates
  // inside getCurrentMember THROW. A locked-for-non-payment company hitting
  // this got a 500 with an empty body instead of the 402 that names the
  // billing screen. The plain variant is exactly for helpers shaped like this.
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  // The function was already called requireOwner and already said "owner or
  // admin" — it just checked "user:manage", which supervisors hold. Accepting
  // a retention offer changes what the company is billed (a discount coupon, a
  // paused subscription, fewer seats); that isn't a scheduling decision.
  if (!isBillingAdmin(member.role)) {
    return { error: BILLING_ADMIN_ERROR, status: 403 };
  }
  return { member };
}

/**
 * Seats paid for, and people actually using them — and the LIVE subscription,
 * because the offers below are things Stripe has to be able to do.
 *
 * ── Why the live read decides before anything is offered ─────────────────
 *
 * On 2026-09-13 a row still said `active` hours after Stripe had cancelled
 * the subscription (no webhook was reaching the deployment). This route read
 * the row, offered a pause, and Stripe answered "A canceled subscription can
 * only update its cancellation_details and metadata" — shown to the person
 * as "We couldn't apply that just now … try again", which no amount of
 * retrying would change. So the status Stripe holds is read once here; when
 * it says canceled the row is healed from it and the answer is "cancelled",
 * with no offers, rather than a 502 hiding a known state.
 */
async function seatUsage(companyId) {
  const [sub, activeMembers] = await Promise.all([
    db.subscription.findUnique({
      where: { companyId },
      include: { plan: { select: { maxUsers: true, seats: true, crewSeats: true } } },
    }),
    db.member.count({ where: { companyId, active: true } }),
  ]);

  // Seats come from STRIPE's quantity where we have it, not from the plan's
  // maxUsers — the plan is a ceiling, the quantity is what they're billed for,
  // and offering to reduce the wrong one produces a promise we can't keep.
  //
  // The fallback is the plan's SEAT count, not maxUsers: on a ladder tier
  // maxUsers is seats plus crew, so a Crew company with eight people looked
  // like eleven paid licences with three going spare, and we'd have offered to
  // remove licences that were never billed. `perSeat` then withholds that offer
  // on a flat tier entirely — see offersFor.
  const perSeat = sub?.plan?.crewSeats == null;
  let seats = sub?.plan?.seats ?? sub?.plan?.maxUsers ?? activeMembers;
  let live = null;
  let canceled = null;
  if (sub?.stripeSubscriptionId) {
    try {
      live = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const licensed = live.items?.data?.find((i) => i.quantity > 1) || live.items?.data?.[0];
      if (licensed?.quantity) seats = licensed.quantity;
    } catch (err) {
      // A Stripe hiccup shouldn't make the save flow unavailable to somebody
      // with their finger on the cancel button — fall back to the plan. But
      // "No such subscription" is not a hiccup: Stripe has nothing under that
      // id, which for the company is a cancellation (see the cancel route).
      if (isCanceledSubscriptionError(err)) {
        live = { id: sub.stripeSubscriptionId, status: "canceled", canceled_at: null };
      }
    }
  }
  if (live) {
    // Self-healing: the row learns what Stripe holds, in the same request —
    // whichever way it had drifted. Only a write when something differs.
    const { after } = await writeSubscriptionFromStripe(companyId, live, { row: sub });
    if (live.status === "canceled") canceled = { canceledAt: after?.canceledAt || null };
  } else if (sub?.status === "canceled") {
    canceled = { canceledAt: sub.canceledAt || null };
  }
  return { sub, seats, activeMembers, perSeat, live, canceled };
}

/** The answer for a subscription that is already gone: a state, not offers. */
const canceledResponse = (canceled) =>
  NextResponse.json({
    state: "canceled",
    canceledAt: canceled.canceledAt,
    offers: [],
    cooldown: null,
    message: "This subscription is already cancelled.",
  });

export async function GET(request) {
  const { member, error, status } = await requireOwner(request);
  if (error) return NextResponse.json({ error }, { status });

  const reason = new URL(request.url).searchParams.get("reason") || null;
  const { sub, seats, activeMembers, perSeat, canceled } = await seatUsage(member.companyId);
  if (canceled) return canceledResponse(canceled);

  return NextResponse.json({
    state: "live",
    offers: offersFor({ subscription: sub, seats, activeMembers, perSeat, reason }),
    // Said rather than silently omitted — "you used one in March" is a fact
    // someone can understand; a button that simply isn't there reads as broken.
    cooldown: cooldownMessage(sub),
    seats,
    activeMembers,
  });
}

export async function POST(request) {
  const { member, error, status } = await requireOwner(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  const offer = String(body.offer || "");
  const reason = isValidReason(body.reason) ? body.reason : null;

  const { sub, seats, activeMembers, perSeat, canceled } = await seatUsage(member.companyId);
  if (!sub?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "There's no active subscription to change." },
      { status: 400 },
    );
  }
  if (canceled) {
    return NextResponse.json(
      { error: "This subscription is already cancelled.", state: "canceled", canceledAt: canceled.canceledAt },
      { status: 409 },
    );
  }

  // Re-derived on the SERVER. The browser told us which button was pressed; it
  // doesn't get to tell us what the company is entitled to.
  const allowed = offersFor({ subscription: sub, seats, activeMembers, perSeat, reason });
  const chosen = allowed.find((o) => o.key === offer);
  if (!chosen) {
    return NextResponse.json(
      { error: cooldownMessage(sub) || "That offer isn't available on this account." },
      { status: 409 },
    );
  }

  try {
    let summary;
    // Stripe's reply to whichever update ran; its status / period end /
    // trial end are written onto the row below, so the screen agrees with
    // Stripe before any webhook lands.
    let updated = null;

    if (offer === "reduce_licenses") {
      const live = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const item = live.items?.data?.find((i) => i.quantity > 1) || live.items?.data?.[0];
      if (!item) throw new Error("No billable item on the subscription.");

      updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        items: [{ id: item.id, quantity: chosen.newSeats }],
        // Credit the unused portion rather than charging again. They're
        // REDUCING — billing them today for the privilege would be absurd.
        proration_behavior: "create_prorations",
      });
      summary = `Reduced from ${seats} to ${chosen.newSeats} licences`;
    } else if (offer === "discount") {
      // A fresh coupon per use rather than one shared promotion code, so a
      // discount can't leak out of the save flow and be applied by anyone who
      // finds the code.
      //
      // The name is built by retentionCouponName: Stripe caps a coupon name
      // at 40 characters and "Retention 25% — <cuid>" is 41, so every
      // discount ever accepted failed with "Invalid string … must be at most
      // 40 characters" (reproduced in test mode, 2026-09-13). The full
      // companyId stays in metadata, which is where a lookup reads it.
      const coupon = await stripe.coupons.create({
        percent_off: DISCOUNT_PERCENT,
        duration: "repeating",
        duration_in_months: DISCOUNT_MONTHS,
        name: retentionCouponName(member.companyId),
        metadata: { companyId: member.companyId, reason: reason || "" },
      });
      updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        discounts: [{ coupon: coupon.id }],
      });
      summary = `${DISCOUNT_PERCENT}% off for ${DISCOUNT_MONTHS} months`;
    } else if (offer === "pause") {
      updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        // `void` — no invoices at all while paused, rather than piling up a bill
        // to settle on return. Someone pausing for the winter cannot come back
        // in April to four months of arrears; that's a cancellation with extra
        // steps and a bad taste.
        pause_collection: { behavior: "void" },
      });
      summary = `Paused for up to ${MAX_PAUSE_MONTHS} months`;
    } else {
      return NextResponse.json({ error: "Unknown offer." }, { status: 400 });
    }

    if (updated) await writeSubscriptionFromStripe(member.companyId, updated, { row: sub });

    await db.subscription.update({
      where: { companyId: member.companyId },
      data: {
        retentionOffer: offer,
        // Reducing licences is NOT a concession — it's correcting an overcharge
        // — so it doesn't start the twelve-month cooldown. Someone who right-
        // sizes their team in March must still be able to pause in November.
        ...(offer === "reduce_licenses" ? {} : { retentionOfferAt: new Date() }),
        cancelReason: reason,
      },
    });

    await recordActivity(member, {
      action: "billing.retention_offer_accepted",
      entityType: "settings",
      summary,
      metadata: { offer, reason, seats, activeMembers },
    });

    return NextResponse.json({ accepted: offer, summary });
  } catch (err) {
    console.error("[retention] couldn't apply offer", { offer, err: err.message });
    // Stripe refused because the subscription is cancelled — a known state,
    // not a transient failure. The row is healed and the answer names the
    // state; "try again" would be a lie, because a retry cannot change it.
    if (isCanceledSubscriptionError(err)) {
      const { after } = await writeSubscriptionFromStripe(
        member.companyId,
        { id: sub.stripeSubscriptionId, status: "canceled", canceled_at: null },
        { row: sub },
      ).catch(() => ({ after: sub }));
      return NextResponse.json(
        { error: "This subscription is already cancelled.", state: "canceled", canceledAt: after?.canceledAt || null },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error:
          "We couldn't apply that just now. Nothing has changed on your account — try again, or cancel and we'll sort it out.",
      },
      { status: 502 },
    );
  }
}
