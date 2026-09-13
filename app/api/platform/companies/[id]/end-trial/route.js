// app/api/platform/companies/[id]/end-trial/route.js
//
// The opposite of extend-trial: end the free period NOW so Stripe bills the
// first invoice today.
//
// ── Why it exists ────────────────────────────────────────────────────────────
//
// Going live on 2026-09-13 the owner signed his own company up on a $1 plan to
// prove the real card path — checkout, webhook, invoice, payout — and the one
// step left was "End trial now", which lives only in the Stripe dashboard.
// The live secret key sits in Vercel alone (deliberately: nobody handles it by
// hand), so the only place FieldQuo can ask Stripe to do this is a route on
// the deployment. Same bar as extend-trial — billing:manage, a reason, an
// audit row — because this one moves money in the other direction: the
// customer is charged sooner than they were promised.
//
// ── What Stripe does with trial_end: "now" ────────────────────────────────
//
// The subscription leaves `trialing`, an invoice is created for the first
// period and paid with the default payment method at once; the webhook then
// delivers customer.subscription.updated and invoice.payment_succeeded, which
// lib/platform/stripeBilling.js's syncSubscriptionFromStripeEvent already
// reads (trialEndsAt → null, status, currentPeriodEnd). Company.trialEndsAt
// is set to now here as well, so the trial countdown in /app stops even if
// the webhook is late — that is the exact gap the owner's test is meant to
// find, and it must not be hidden by a stale column.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";

export async function POST(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "billing:manage");
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Only a superadmin can end a trial." },
      { status: err.status || 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const reason = String(body?.reason || "").trim();
  if (reason.length < 3) {
    return NextResponse.json(
      { error: "Say why you're ending this trial — it goes in the audit log." },
      { status: 400 },
    );
  }

  const [company, sub] = await Promise.all([
    db.company.findUnique({ where: { id }, select: { id: true, name: true, trialEndsAt: true } }),
    db.subscription.findUnique({
      where: { companyId: id },
      select: { stripeSubscriptionId: true, status: true },
    }),
  ]);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sub?.stripeSubscriptionId) {
    return NextResponse.json(
      { error: "No Stripe subscription on this company — there is no trial to end." },
      { status: 409 },
    );
  }
  if (sub.status === "canceled") {
    return NextResponse.json({ error: "The subscription is cancelled." }, { status: 409 });
  }

  // Stripe is the authority on whether there IS a trial: our column can be
  // null while Stripe is still trialing (the webhook race the owner's test
  // surfaced), so ask Stripe rather than the column.
  let before;
  try {
    before = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  } catch (err) {
    return NextResponse.json(
      { error: `Stripe could not be read: ${err?.message || "unknown"}` },
      { status: 502 },
    );
  }
  if (before.status !== "trialing") {
    return NextResponse.json(
      { error: `Stripe says this subscription is "${before.status}", not trialing — nothing to end.`, stripeStatus: before.status },
      { status: 409 },
    );
  }

  let after;
  try {
    after = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      trial_end: "now",
      proration_behavior: "none",
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Stripe refused: ${err?.message || "unknown"}` },
      { status: 502 },
    );
  }

  const now = new Date();
  await db.$transaction([
    db.company.update({ where: { id }, data: { trialEndsAt: now } }),
    db.subscription.update({
      where: { companyId: id },
      data: {
        status: after.status,
        trialEndsAt: null,
        currentPeriodEnd: after.current_period_end ? new Date(after.current_period_end * 1000) : undefined,
      },
    }),
    db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "trial_ended",
        targetCompanyId: id,
        details: {
          reason,
          previousTrialEndsAt: company.trialEndsAt,
          stripeStatusBefore: before.status,
          stripeStatusAfter: after.status,
          latestInvoice: typeof after.latest_invoice === "string" ? after.latest_invoice : after.latest_invoice?.id || null,
        },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    stripeStatus: after.status,
    latestInvoice: typeof after.latest_invoice === "string" ? after.latest_invoice : after.latest_invoice?.id || null,
    currentPeriodEnd: after.current_period_end ? new Date(after.current_period_end * 1000) : null,
  });
}
