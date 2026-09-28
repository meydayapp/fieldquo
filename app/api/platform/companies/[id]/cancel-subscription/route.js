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
//
// ── No Stripe subscription (2026-09-28) ────────────────────────────────────
//
// This answered 409 "there is nothing to cancel" for every company without
// one — since 2026-09-24 that is every new company, because the free trial
// takes no card. The owner: "if i lock the account because of terms break
// locked immediately it should still block the trial". So a company with no
// Stripe subscription takes the SAME three modes, written to Company
// (platformEndsAt / platformEndMode / platformEndReason — the schema says
// why there), which lib/billing/access.js reads before any trial or
// subscription rule. The words and the rules are lib/platform/cancelOptions.js,
// the file the panel renders from, so the button and the route agree.
//
// The Stripe path below the branch is untouched — same Stripe calls, same
// transaction, same audit row, same response — and
// scripts/check-platform-cancel-lock.mjs replays it against a recording
// Stripe and database to prove it. A demo is refused (FieldQuo's own
// fixture — nobody to lock out).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { subscriptionFieldsFromStripe } from "@/lib/billing/subscriptionFields";
import { trialAccessFor, FIELDQUO_END_SELECT } from "@/lib/billing/access";
import { planFieldquoEnd } from "@/lib/platform/cancelOptions";

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
    db.company.findUnique({ where: { id }, select: { id: true, name: true, isDemo: true, trialEndsAt: true, ...FIELDQUO_END_SELECT } }),
    db.subscription.findUnique({
      where: { companyId: id },
      select: { stripeSubscriptionId: true, status: true, accessLockedAt: true, cancelAtPeriodEnd: true },
    }),
  ]);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!sub?.stripeSubscriptionId) {
    return endWithoutStripe({ admin, id, company, sub: sub ?? null, mode, reason });
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

// ── The no-Stripe path ─────────────────────────────────────────────────────
//
// Read fresh by the POST above on this press, decided by planFieldquoEnd (a
// looser ending than one already set is refused; a demo is refused), and
// written in ONE transaction with its audit row — the Stripe path's shape.
// A terms lock switches automatic phone-credit top-up off in the same step,
// exactly as the Stripe path does and for the same reason: a locked company
// must never be charged again by a cron.
async function endWithoutStripe({ admin, id, company, sub, mode, reason }) {
  const now = new Date();
  // What the trial alone allows today, for the sentence an expired trial's
  // "now" is refused or accepted with. Only trialEndsAt is passed, so an
  // ending already set is not folded in.
  const trialAccess = trialAccessFor({ trialEndsAt: company.trialEndsAt }, now);
  const plan = planFieldquoEnd({ company, subscription: sub, mode, reason, trialAccess, now });
  if (plan.error) return NextResponse.json({ error: plan.error }, { status: plan.status || 409 });

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
    db.company.update({ where: { id }, data: plan.data }),
    db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "access_ended_by_platform",
        targetCompanyId: id,
        details: {
          mode,
          reason,
          kind: plan.kind,
          hadSubscriptionRow: Boolean(sub),
          trialEndsAt: company.trialEndsAt ? new Date(company.trialEndsAt).toISOString() : null,
          accessEndsAt: plan.data.platformEndsAt.toISOString(),
          lockedAt: mode === "terms" ? now.toISOString() : null,
          previous: plan.previous
            ? { ...plan.previous, endsAt: plan.previous.endsAt ? plan.previous.endsAt.toISOString() : null }
            : null,
        },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    mode,
    stripeStatus: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    accessEndsAt: plan.data.platformEndsAt,
    lockedAt: mode === "terms" ? now : null,
    access: plan.access,
  });
}
