// app/api/platform/companies/[id]/unlock/route.js
//
// POST { reason } — "Unlock company": undo a lock or ending FieldQuo applied
// from the cancel panel. What counts as FieldQuo's lock, what is cleared,
// and what is deliberately NOT restored (auto top-up, released numbers,
// Stripe): lib/platform/unlock.js, the function the panel renders from.
//
// ── The gates, in order ─────────────────────────────────────────────────────
//
//   1. a platform admin, holding "company:unlock" — SUPERADMIN_ONLY_PERMISSIONS
//      in lib/platform/permissions.js, so admin and support are refused by the
//      matrix rather than by this file remembering a role name;
//   2. not from inside a support session ("Sign in as"): middleware's
//      read-only gate deliberately excludes /api/platform, so the refusal is
//      stated here, as app/api/platform/errors/like does. Reopening a
//      customer's account is not something to do from a browser that is at
//      that moment looking at a customer's account;
//   3. a reason of three characters or more — the audit row's point;
//   4. the rows re-read fresh on this press and planned by unlockPlan, so a
//      stale panel cannot clear a lock that is not there (409).
//
// The clear and the audit row are one transaction, the cancel route's shape.
// Stripe is never called — not imported.
//
// Non-negotiable #3: these columns are FieldQuo's own record of its decision
// about the company (the cancel route writes them; the company never does),
// not the company's data.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { IMPERSONATION_COOKIE, verifyImpersonationToken } from "@/lib/platform/impersonationToken";
import { FIELDQUO_END_SELECT } from "@/lib/billing/access";
import { unlockPlan } from "@/lib/platform/unlock";

export async function POST(request, { params }) {
  const { id } = await params;
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "company:unlock");
  } catch (err) {
    return NextResponse.json({ error: "Only a superadmin can unlock a company." }, { status: err.status || 403 });
  }

  const support = await verifyImpersonationToken(request.cookies?.get?.(IMPERSONATION_COOKIE)?.value);
  if (support) {
    return NextResponse.json(
      { error: "End the support session (View as company) before unlocking a company." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const reason = String(body?.reason || "").trim();
  if (reason.length < 3) {
    return NextResponse.json({ error: "Say why you're unlocking this company — it goes in the audit log." }, { status: 400 });
  }

  const [company, subscription] = await Promise.all([
    db.company.findUnique({ where: { id }, select: { id: true, name: true, isDemo: true, trialEndsAt: true, ...FIELDQUO_END_SELECT } }),
    db.subscription.findUnique({
      where: { companyId: id },
      select: { stripeSubscriptionId: true, status: true, canceledAt: true, accessLockedAt: true, accessLockedReason: true },
    }),
  ]);
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plan = unlockPlan({ company, subscription: subscription ?? null });
  if (plan.refusal) return NextResponse.json({ error: plan.refusal }, { status: 409 });

  await db.$transaction([
    ...(plan.data.company ? [db.company.update({ where: { id }, data: plan.data.company })] : []),
    ...(plan.data.subscription ? [db.subscription.update({ where: { companyId: id }, data: plan.data.subscription })] : []),
    db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: "company_unlocked_by_platform",
        targetCompanyId: id,
        details: {
          reason,
          sources: plan.sources,
          previous: plan.previous,
          after: plan.after,
          notRestored: plan.notRestored,
        },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, sources: plan.sources, after: plan.after, notRestored: plan.notRestored });
}
