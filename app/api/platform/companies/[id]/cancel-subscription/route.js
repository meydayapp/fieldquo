// app/api/platform/companies/[id]/cancel-subscription/route.js
//
// FieldQuo ends a company's subscription from the platform console.
//
// ── Why it exists ────────────────────────────────────────────────────────────
//
// Until 2026-09-18 the only way to cancel a customer was the Stripe dashboard,
// then "Sync subscription" here to read the result back. The owner asked for
// two things that page cannot do: cancel from where he is looking at the
// company, and cancel a company that is NOT abiding by the terms — which is
// not the same act as a customer leaving. Non-negotiable #3 is about a
// company's own data; a subscription is FieldQuo's billing relationship with
// them, and ending it is FieldQuo's call.
//
// ── Three modes, because they mean three different things ──────────────────
//
//   period_end  Stripe's cancel_at_period_end. They keep full access until the
//               date they paid to; then the ordinary thirty-day read-only
//               window (lib/billing/access.js). The kind thing, the default.
//   now         Stripe cancels today, nothing more is charged, no proration
//               back; status becomes canceled and the thirty-day read-only
//               window starts now. For a company that asked to stop today.
//   terms       Same Stripe cancel as `now`, and Subscription.accessLockedAt
//               is set in the same transaction, so access.js locks the account
//               at once — no read-only window, because that window exists for
//               people who chose to leave. The reason is required and lands on
//               the row and the audit log; the locked screen says "ended by
//               FieldQuo" rather than "you cancelled".
//
// billing:manage, a reason of three characters or more, an audit row — the
// same bar as end-trial, which also moves money against the customer.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { subscriptionFieldsFromStripe } from "@/lib/billing/subscriptionFields";

export const CANCEL_MODES = Object.freeze(["period_end", "now", "terms"]);

export async function POST(request, { params }) {
  const { id } = await params;
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "billing:manage");
  } catch (err) {
    return NextResponse.json({ error: err.message || "Only a superadmin can cancel a subscription." }, { status: err.status || 403 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = String(body?.reason || "").trim();
  const mode = CANCEL_MODES.includes(body?.mode) ? body.mode : null;
  if (!mode) {
    return NextResponse.json({ error: `Say how: ${CANCEL_MODES.join(", ")}.` }, { status: 400 });
  }
  if (reason.length < 3) {
    return NextResponse.json({ error: "Say why you're cancelling — it goes in the audit log and, for a terms breach, on the locked screen." }, { status: 400 });
  }

  const [company, sub] = await Promise.all([
    db.company.findUnique({ where: { id }, select: { id: true, name: true } }),
    db.subscription.findUnique({
      where: { companyId: id },
      select: { stripeSubscriptionId: true, status: true, accessLockedAt: true, cancelAtPeriodEnd: true },
    }),
  ]);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sub?.stripeSubscriptionId) {
    return NextResponse.json({ error: "No Stripe subscription on this company — there is nothing to cancel." }, { status: 409 });
  }
  if (sub.accessLockedAt) {
    return NextResponse.json({ error: "This company is already locked by FieldQuo." }, { status: 409 });
  }

  // Stripe is the authority on the current state, as end-trial says.
  let before;
  try {
    before = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);
  } catch (err) {
    return NextResponse.json({ error: `Stripe could not be read: ${err?.message || "unknown"}` }, { status: 502 });
  }
  if (before.status === "canceled" && mode !== "terms") {
    return NextResponse.json({ error: "Stripe says this subscription is already cancelled. Press Sync subscription to read it back." }, { status: 409 });
  }
  if (mode === "period_end" && before.cancel_at_period_end) {
    return NextResponse.json({ error: "It is already booked to end at the period end." }, { status: 409 });
  }

  let after;
  try {
    if (mode === "period_end") {
      after = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
        cancellation_details: { comment: reason.slice(0, 500) },
      });
    } else if (before.status === "canceled") {
      // terms mode on a subscription Stripe already cancelled (the owner did
      // it in the dashboard first): nothing to cancel, only the lock to set.
      after = before;
    } else {
      after = await stripe.subscriptions.cancel(sub.stripeSubscriptionId, {
        invoice_now: false,
        prorate: false,
        cancellation_details: { comment: reason.slice(0, 500) },
      });
    }
  } catch (err) {
    return NextResponse.json({ error: `Stripe refused: ${err?.message || "unknown"}` }, { status: 502 });
  }

  const now = new Date();
  // A terms lock also switches automatic phone-credit top-up off in the same
  // step: a locked company must never be charged again by a cron. Their
  // prepaid balance is left exactly as it is — unspent, not refunded, not
  // taken — and the number-rent cron releases the numbers (lib/voice/
  // spendGate.js reads the "terms" access reason). No row → nothing to do.
  const topupOff =
    mode === "terms"
      ? [
          db.voiceAutoTopup.updateMany({
            where: { companyId: id, enabled: true },
            data: { enabled: false, disabledAt: now, disabledReason: "terms_lock" },
          }),
        ]
      : [];
  await db.$transaction([
    ...topupOff,
    db.subscription.update({
      where: { companyId: id },
      data: {
        ...subscriptionFieldsFromStripe(after),
        cancelReason: reason.slice(0, 500),
        ...(mode === "terms" ? { accessLockedAt: now, accessLockedReason: reason.slice(0, 500) } : {}),
      },
    }),
    db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "subscription_cancelled_by_platform",
        targetCompanyId: id,
        details: {
          mode,
          reason,
          stripeStatusBefore: before.status,
          stripeStatusAfter: after.status,
          cancelAtPeriodEnd: Boolean(after.cancel_at_period_end),
          currentPeriodEnd: after.current_period_end ? new Date(after.current_period_end * 1000).toISOString() : null,
          lockedAt: mode === "terms" ? now.toISOString() : null,
        },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    mode,
    stripeStatus: after.status,
    cancelAtPeriodEnd: Boolean(after.cancel_at_period_end),
    currentPeriodEnd: after.current_period_end ? new Date(after.current_period_end * 1000) : null,
    lockedAt: mode === "terms" ? now : null,
    access:
      mode === "period_end"
        ? "full access until the period end, then thirty days read-only"
        : mode === "now"
          ? "thirty days read-only from now, then locked"
          : "locked now — no read-only window; automatic top-up switched off; numbers released by the rent run; prepaid balance left as it is",
  });
}
