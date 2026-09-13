// app/api/platform/companies/[id]/sync-subscription/route.js
//
// "Sync from Stripe" on the platform company page: read the company's
// subscription from Stripe and write what Stripe says onto our row.
//
// ── Why a button ─────────────────────────────────────────────────────────────
//
// Status, period end, trial end and cancelled-at were written by webhooks and
// nothing else. On 2026-09-13 the owner cancelled his own live-test plan and
// the row said "active" for the rest of the day — no Stripe event was
// reaching the deployment. The live key lives only in Vercel (deliberately),
// so the only place FieldQuo can ask live Stripe anything is a route on the
// deployment; this is that route for one company, with the six-hourly
// /api/cron/billing-sync doing the same for every company unattended.
//
// billing:manage, not because it changes what the company is billed — it
// does not; it changes only what OUR row says about Stripe's — but because
// what it writes decides access (a status of canceled starts the 30-day
// read-only window), and that is the same weight as ending a trial. Audited
// as subscription_synced with the fields that changed, so "why did this
// account go read-only at 14:02" has an answer.
//
// Non-negotiable #3 holds: nothing of the company's own data is touched.
// The Subscription row is FieldQuo's record of its relationship with them.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { syncSubscriptionFromStripe } from "@/lib/platform/stripeSync";

export async function POST(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "billing:manage");
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Only a superadmin can sync a subscription." },
      { status: err.status || 403 },
    );
  }

  const company = await db.company.findUnique({ where: { id }, select: { id: true } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = await syncSubscriptionFromStripe(id);

  if (!result.ok) {
    const text = {
      no_row: "This company has no subscription row to sync.",
      no_stripe_subscription: "The subscription row has no Stripe subscription id — nothing to read.",
      stripe_missing: `Stripe has no subscription ${result.stripeSubscriptionId} on this key. Not written as cancelled: the likeliest cause is a test-mode id against the live key, or the reverse.`,
      stripe_error: `Stripe could not be read: ${result.error || "unknown"}`,
    }[result.reason] || "Could not sync.";
    return NextResponse.json({ error: text, reason: result.reason }, { status: 409 });
  }

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "subscription_synced",
      targetCompanyId: id,
      details: {
        stripeSubscriptionId: result.stripeSubscriptionId,
        stripeStatus: result.stripeStatus,
        changed: result.changed,
      },
    },
  });

  return NextResponse.json({
    ok: true,
    stripeStatus: result.stripeStatus,
    changed: result.changed,
    after: result.after,
  });
}
