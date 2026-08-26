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
} from "@/lib/billing/retention";

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

/** Seats paid for, and people actually using them. */
async function seatUsage(companyId) {
  const [sub, activeMembers] = await Promise.all([
    db.subscription.findUnique({
      where: { companyId },
      include: { plan: { select: { maxUsers: true } } },
    }),
    db.member.count({ where: { companyId, active: true } }),
  ]);

  // Seats come from STRIPE's quantity where we have it, not from the plan's
  // maxUsers — the plan is a ceiling, the quantity is what they're billed for,
  // and offering to reduce the wrong one produces a promise we can't keep.
  let seats = sub?.plan?.maxUsers || activeMembers;
  if (sub?.stripeSubscriptionId) {
    try {
      const live = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const licensed = live.items?.data?.find((i) => i.quantity > 1) || live.items?.data?.[0];
      if (licensed?.quantity) seats = licensed.quantity;
    } catch {
      // Falls back to the plan. A Stripe hiccup shouldn't make the save flow
      // unavailable to somebody with their finger on the cancel button.
    }
  }
  return { sub, seats, activeMembers };
}

export async function GET(request) {
  const { member, error, status } = await requireOwner(request);
  if (error) return NextResponse.json({ error }, { status });

  const reason = new URL(request.url).searchParams.get("reason") || null;
  const { sub, seats, activeMembers } = await seatUsage(member.companyId);

  return NextResponse.json({
    offers: offersFor({ subscription: sub, seats, activeMembers, reason }),
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

  const { sub, seats, activeMembers } = await seatUsage(member.companyId);
  if (!sub?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "There's no active subscription to change." },
      { status: 400 },
    );
  }

  // Re-derived on the SERVER. The browser told us which button was pressed; it
  // doesn't get to tell us what the company is entitled to.
  const allowed = offersFor({ subscription: sub, seats, activeMembers, reason });
  const chosen = allowed.find((o) => o.key === offer);
  if (!chosen) {
    return NextResponse.json(
      { error: cooldownMessage(sub) || "That offer isn't available on this account." },
      { status: 409 },
    );
  }

  try {
    let summary;

    if (offer === "reduce_licenses") {
      const live = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
      const item = live.items?.data?.find((i) => i.quantity > 1) || live.items?.data?.[0];
      if (!item) throw new Error("No billable item on the subscription.");

      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
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
      const coupon = await stripe.coupons.create({
        percent_off: DISCOUNT_PERCENT,
        duration: "repeating",
        duration_in_months: DISCOUNT_MONTHS,
        name: `Retention ${DISCOUNT_PERCENT}% — ${member.companyId}`,
        metadata: { companyId: member.companyId, reason: reason || "" },
      });
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        discounts: [{ coupon: coupon.id }],
      });
      summary = `${DISCOUNT_PERCENT}% off for ${DISCOUNT_MONTHS} months`;
    } else if (offer === "pause") {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
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
    return NextResponse.json(
      {
        error:
          "We couldn't apply that just now. Nothing has changed on your account — try again, or cancel and we'll sort it out.",
      },
      { status: 502 },
    );
  }
}
