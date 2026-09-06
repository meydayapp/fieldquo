// app/api/platform/billing/checkout/route.js
//
// Only change vs. what you already have: successUrl/cancelUrl now point at
// /app/settings/account-billing instead of /app/settings/billing, matching
// the page that actually exists now.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { createBillingCheckoutSession, changeSubscriptionPlan } from "@/lib/platform/stripeBilling";
import { stripeCurrency } from "@/lib/currency";
import { recordError } from "@/lib/platform/errorLog";
import { getAppOrigin } from "@/lib/appUrl";
import { resolveCheckoutInterval } from "@/lib/billing/interval";

// Note: this is called by a COMPANY (upgrading their own plan), not a platform admin —
// hence getCurrentMember, not getCurrentPlatformAdmin. It lives under /platform/billing
// because it's Stripe Billing (FieldQuo charging the company), not Connect.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Had no role gate at all: any logged-in employee could post an
  // employeeCount and start a Stripe Checkout that raises their employer's
  // monthly bill. Same gate as the portal and cancel routes.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const { planId, interval: requestedInterval } = await request.json();

  // ── There is no self-serve headcount price any more ─────────────────────
  //
  // This used to also accept an `employeeCount` from the Team page's "Add
  // licenses" panel and mint a "Custom (N employees)" Plan on the fly at
  // $45/licence (calculatePricing + findOrCreateCustomPlan) — the pricing
  // model the owner retired 2026-08-31 in favour of the four-tier seat ladder
  // (lib/pricing/ladder.js: Solo/Crew/Shop/Scale). A seat upgrade is now the
  // same "choose a tier" flow as any other plan change: pick a planId. See
  // docs/PRICING-CLEANUP.md.
  if (!planId)
    return NextResponse.json(
      { error: "planId is required" },
      { status: 400 },
    );

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });

  const plan = await db.plan.findUnique({ where: { id: planId } });

  if (!plan)
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  // During an active trial, a plan change must stay free until the trial
  // ends — the new price only applies afterward. Carry the remaining days
  // onto the Stripe subscription's trial, same computation as signup
  // (app/api/companies/route.js). This used to be scoped to the employeeCount
  // (Add licenses) flow only, leaving a mid-trial "Choose plan" upgrade to
  // lose the days already committed; there is no reason left to treat the two
  // differently now that both arrive here as a planId. Absent/expired trial →
  // no trial days.
  let trialDays;
  if (company?.trialEndsAt && company.trialEndsAt.getTime() > Date.now()) {
    trialDays = Math.max(
      1,
      Math.ceil((company.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    );
  }

  // ── The cadence, which this route used to throw away ──────────────────────
  //
  // It passed nothing and got monthly. So a company that took the one-year
  // commitment at signup and later changed tier from Account & Billing was
  // moved to monthly without being told, losing the two free months they had
  // committed for — a control that appears to work, with money attached.
  //
  // The decision is resolveCheckoutInterval rather than an inline guard because
  // an inline guard could only be asserted by grepping this file for it, and a
  // grep passes just as happily on a guard somebody has disabled. It is pure,
  // so scripts/check-billing-interval.mjs runs it against a plan with no annual
  // price and watches it refuse.
  const cadence = resolveCheckoutInterval(plan, requestedInterval);
  if (cadence.error) {
    return NextResponse.json({ error: cadence.error }, { status: 400 });
  }
  const { interval } = cadence;

  // A company that already HAS a live subscription is changing plan, not
  // buying a second one. Opening Checkout here created a second subscription
  // on the same customer and cancelled nothing — see changeSubscriptionPlan
  // for the rest. `canceled` falls through to Checkout on purpose: that is a
  // genuinely new subscription.
  const existing = await db.subscription.findUnique({ where: { companyId: member.companyId } });
  const LIVE = new Set(["active", "trialing", "past_due"]);
  if (existing?.stripeSubscriptionId && LIVE.has(existing.status)) {
    if (existing.planId === plan.id && (existing.billingInterval || "month") === interval) {
      return NextResponse.json({ changed: false, note: "You're already on that plan." });
    }
    try {
      const result = await changeSubscriptionPlan({
        subscription: existing,
        plan,
        interval,
        currency: stripeCurrency(company?.currency),
      });
      return NextResponse.json({ changed: true, planId: result.planId, interval: result.interval });
    } catch (err) {
      await recordError({
        area: "billing",
        code: err?.code || err?.type || null,
        message: `Plan change failed: ${err?.message}`,
        companyId: member.companyId,
        detail: { fromPlanId: existing.planId, toPlanId: plan.id, interval },
      }).catch(() => {});
      return NextResponse.json(
        { error: err?.message ? `Stripe couldn't change the plan: ${err.message}` : "Couldn't change the plan just now. Nothing was changed." },
        { status: 502 },
      );
    }
  }

  const baseUrl = getAppOrigin(request);

  const session = await createBillingCheckoutSession({
    company,
    plan,
    interval,
    trialDays,
    // session_id, not just a flag. The page reconciles with it on arrival rather
    // than waiting for the checkout.session.completed webhook to land — Checkout
    // redirects in about a second and the webhook often doesn't beat it, so the
    // company was landing on "No active plan" right after paying.
    // {CHECKOUT_SESSION_ID} is substituted by Stripe.
    successUrl: `${baseUrl}/app/settings/account-billing?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/app/settings/account-billing`,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}
