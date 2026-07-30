// app/api/platform/companies/[id]/extend-trial/route.js
//
// A support action with real teeth: grant a company more free time.
//
// ── Why this is the one action worth building first ──────────────────────────
//
// It's the request support gets most ("their card failed during a busy week",
// "we promised them another month at the trade show"), and doing it by hand
// means editing a database column — which, before syncStripeTrialEnd existed,
// silently did nothing because Stripe kept its own 30-day clock. This route
// writes the column AND pushes it to Stripe, so the company actually isn't
// charged.
//
// Superadmin only (billing:manage), requires a reason, and every grant writes
// an immutable audit row. Nothing about a customer's own data is touched — this
// changes FieldQuo's billing relationship, not their records, so it stays
// inside non-negotiable #3.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { syncStripeTrialEnd } from "@/lib/platform/stripeBilling";

const MAX_DAYS = 365;

export async function POST(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Deliberately a higher bar than company:view — this one moves money.
  try {
    requirePlatformPermission(admin.role, "billing:manage");
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Only a superadmin can extend a trial." },
      { status: err.status || 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const days = Math.floor(Number(body?.days));
  const reason = String(body?.reason || "").trim();

  if (!Number.isFinite(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json(
      { error: `Give a number of days between 1 and ${MAX_DAYS}.` },
      { status: 400 },
    );
  }
  // The reason is the point of the audit row, not paperwork — "why is this
  // account free until March" has to be answerable months later.
  if (reason.length < 3) {
    return NextResponse.json(
      { error: "Say why you're extending this trial — it goes in the audit log." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({
    where: { id },
    select: { id: true, name: true, trialEndsAt: true },
  });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Extend from whichever is later: an unexpired trial or now. Extending from a
  // date already in the past would hand out fewer days than promised.
  const base =
    company.trialEndsAt && company.trialEndsAt > new Date()
      ? company.trialEndsAt
      : new Date();
  const trialEndsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  await db.company.update({ where: { id }, data: { trialEndsAt } });

  // The half that actually stops the charge. Best-effort by contract — on
  // failure it records a platform error rather than throwing, and the DB grant
  // stands so support can retry.
  const sync = await syncStripeTrialEnd(id);

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "trial_extended",
      targetCompanyId: id,
      details: {
        days,
        reason,
        previousTrialEndsAt: company.trialEndsAt,
        trialEndsAt,
        stripeSynced: sync.synced,
        ...(sync.synced ? {} : { stripeSkipReason: sync.reason }),
      },
    },
  });

  return NextResponse.json({
    ok: true,
    trialEndsAt,
    stripeSynced: sync.synced,
    // Said out loud rather than implied: a grant Stripe doesn't know about will
    // still bill the customer, and support needs to know that now, not later.
    note: sync.synced
      ? null
      : sync.reason === "no_subscription"
        ? "No Stripe subscription yet — nothing to update there, the free period is recorded on the account."
        : "Warning: the free period was recorded but Stripe was not updated. Check the Errors queue.",
  });
}
