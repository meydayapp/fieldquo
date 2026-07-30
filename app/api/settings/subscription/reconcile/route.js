// app/api/settings/subscription/reconcile/route.js
//
// Ask Stripe what this company's subscription actually is, and write it down.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The Subscription row was created in exactly one place: the
// `checkout.session.completed` webhook. So the entire flow depended on an
// ASYNCHRONOUS webhook arriving before the customer's browser finished
// redirecting back from Stripe — and on that webhook being registered and its
// signing secret being set on the current deployment.
//
// When any of that isn't true the company lands on Account & Billing, sees "No
// active plan", and has no way to tell that apart from "the payment failed".
// They then pay again. That is the worst possible failure mode for a billing
// page, and it is the one that was reported: checkout succeeded, the page said
// there was no plan.
//
// Stripe's own guidance is to do both — handle the webhook AND verify on the
// success redirect. This is the second half. It is idempotent and shares the
// same upsert the webhook uses, so whichever arrives first wins and the other
// is a no-op.
//
// ── Two modes ──────────────────────────────────────────────────────────────
//
// With a sessionId (the redirect back from Checkout): read that session.
// Without one (the "Refresh from Stripe" button): find this company's customer
// and sync whatever subscription Stripe currently holds. The second is the
// self-heal path for a company whose webhook was missed entirely — the state
// this bug leaves behind, which nothing could previously recover from.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getCurrentMember } from "@/lib/currentMember";
import { upsertSubscriptionFromCheckoutSession } from "@/lib/platform/stripeBilling";
import { recordError } from "@/lib/platform/errorLog";
import { recordActivity } from "@/lib/activity/log";
import { notifySubscriptionState } from "@/lib/billing/notify";

/** Stripe statuses that mean "this company is entitled to use the product". */
const LIVE = ["active", "trialing", "past_due"];

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (member.role !== "owner" && member.role !== "admin") {
    return NextResponse.json(
      { error: "Only an owner or admin can change billing." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : null;

  try {
    // ── Mode 1: a specific checkout session ──
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      // THE security boundary. Without it, pasting somebody else's session id
      // would attach their subscription to whichever company they belong to —
      // and, worse, let a caller drive writes against a company that isn't
      // theirs. The session must say it belongs to the caller's company.
      if (session?.metadata?.companyId !== member.companyId) {
        return NextResponse.json(
          { error: "That checkout session belongs to a different company." },
          { status: 403 },
        );
      }

      if (session.status !== "complete") {
        // Not an error — Checkout can redirect before Stripe has finalised.
        return NextResponse.json({
          reconciled: false,
          pending: true,
          message: "Stripe hasn't finished processing this payment yet.",
        });
      }

      const sub = await upsertSubscriptionFromCheckoutSession(session);
      // The webhook may never arrive — that is the whole reason this route
      // exists — so the confirmation email cannot depend on it either.
      // Idempotent, so if the webhook does land nobody gets two.
      await notifySubscriptionState(sub.companyId, request);
      await recordActivity(member, {
        action: "billing.reconciled",
        entityType: "settings",
        summary: "Subscription confirmed from the Stripe checkout return",
        metadata: { sessionId, planId: sub.planId },
      });
      return NextResponse.json({ reconciled: true, source: "checkout_session" });
    }

    // ── Mode 2: no session — sync from the customer ──
    const existing = await db.subscription.findUnique({
      where: { companyId: member.companyId },
      select: { stripeCustomerId: true, planId: true },
    });

    let customerId = existing?.stripeCustomerId || null;
    if (!customerId) {
      // No row at all: find the customer by the metadata we set when we made it.
      try {
        const found = await stripe.customers.search({
          query: `metadata['companyId']:'${member.companyId}'`,
          limit: 1,
        });
        customerId = found.data[0]?.id || null;
      } catch {
        customerId = null;
      }
    }

    if (!customerId) {
      return NextResponse.json({
        reconciled: false,
        message: "No Stripe customer for this company yet — pick a plan to start.",
      });
    }

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const live =
      subs.data.find((s) => LIVE.includes(s.status)) || subs.data[0] || null;

    if (!live) {
      return NextResponse.json({
        reconciled: false,
        message: "Stripe has no subscription for this company.",
      });
    }

    // Which plan?
    //
    // Stripe holds a price, not our plan id. We set planId on the CHECKOUT
    // SESSION's metadata — and Stripe does NOT copy session metadata onto the
    // subscription it creates. Verified against a real account: two paid sessions
    // carried planId, both resulting subscriptions had empty metadata. So reading
    // it off the subscription finds nothing and this whole path would have
    // reported "can't tell which plan" for the exact case it exists to repair.
    //
    // Order: the subscription's own metadata (set if we ever start copying it),
    // then the completed checkout session that created it, then whatever the row
    // already had. Never inferred from the AMOUNT — two plans can cost the same,
    // and writing the wrong plan silently changes the seat limit.
    let planId = live.metadata?.planId || null;
    if (!planId) {
      try {
        const sessions = await stripe.checkout.sessions.list({
          customer: customerId,
          limit: 20,
        });
        const match = sessions.data.find(
          (x) => x.subscription === live.id && x.metadata?.planId,
        );
        planId = match?.metadata?.planId || null;
      } catch {
        planId = null;
      }
    }
    if (!planId) planId = existing?.planId || null;

    // A planId from Stripe metadata is still a foreign key. A plan that was
    // deleted since checkout would make the upsert throw, and the company would
    // see a 502 rather than being told the plan is gone.
    if (planId) {
      const exists = await db.plan.findUnique({
        where: { id: planId },
        select: { id: true },
      });
      if (!exists) planId = null;
    }
    if (!planId) {
      return NextResponse.json({
        reconciled: false,
        message:
          "Found a Stripe subscription but can't tell which plan it is. Pick your plan again and it will be recorded.",
      });
    }

    await db.subscription.upsert({
      where: { companyId: member.companyId },
      update: {
        planId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: live.id,
        status: live.status,
        currentPeriodEnd: live.current_period_end
          ? new Date(live.current_period_end * 1000)
          : null,
        trialEndsAt: live.trial_end ? new Date(live.trial_end * 1000) : null,
      },
      create: {
        companyId: member.companyId,
        planId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: live.id,
        status: live.status,
        currentPeriodEnd: live.current_period_end
          ? new Date(live.current_period_end * 1000)
          : null,
        trialEndsAt: live.trial_end ? new Date(live.trial_end * 1000) : null,
      },
    });

    await notifySubscriptionState(member.companyId, request);
    await recordActivity(member, {
      action: "billing.reconciled",
      entityType: "settings",
      summary: `Subscription synced from Stripe (${live.status})`,
      metadata: { stripeSubscriptionId: live.id, status: live.status },
    });

    return NextResponse.json({ reconciled: true, source: "stripe_customer" });
  } catch (err) {
    // Visible in /platform/errors rather than only in a function log, because
    // the symptom a company reports is "it says I have no plan" and the cause is
    // always here.
    await recordError({
      area: "billing",
      code: err?.code || err?.type || null,
      message: `Subscription reconcile failed: ${err?.message}`,
      companyId: member.companyId,
      detail: { sessionId },
    });
    return NextResponse.json(
      { error: "Couldn't check your subscription with Stripe. Try again shortly." },
      { status: 502 },
    );
  }
}
