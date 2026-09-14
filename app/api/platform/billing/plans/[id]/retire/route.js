// app/api/platform/billing/plans/[id]/retire/route.js
//
// Retire a plan, or bring it back. POST { retired: true | false }.
//
// ══ Why this is not `isPublic: false` ═══════════════════════════════════════
//
// Private takes a plan off the MENU and nothing else: /api/marketing/plans
// still hands it to anyone holding a link with its id (the bespoke-rate
// hand-off), and /api/companies and the change-plan checkout accept any plan
// that exists. The owner's "Live test — $1" was private, and it was a working
// $1 signup for as long as the link was out. It could not be deleted — Test
// Inc.'s subscription references it, and this codebase never deletes — so the
// only honest instrument is a third state: kept for its subscribers, sold to
// nobody. That is Plan.retiredAt, read by isRetired() in
// lib/platform/sellablePlans.js, which every sell path asks.
//
// ══ Superadmin, not plan:manage ═════════════════════════════════════════════
//
// plan:manage (admin and superadmin) edits prices and seats. Retiring a plan
// is a decision about what FieldQuo sells that cannot be undone by the next
// checkout — and un-retiring one puts a price back on sale that somebody
// deliberately withdrew. Both belong to the owner account, the same way
// billing:manage does (lib/platform/permissions.js). An inline role check,
// like the other superadmin-only routes, so scripts/check-platform-truth.mjs
// can prove the gate by reading it.
//
// Nothing about the plan's subscribers changes here, in either direction.
// Stripe bills them as before; retirement is a statement about NEW sales.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { isRetired } from "@/lib/platform/sellablePlans";

export async function POST(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin")
    return NextResponse.json(
      { error: "Only a superadmin can retire or un-retire a plan." },
      { status: 403 },
    );

  const body = await request.json().catch(() => ({}));
  if (typeof body?.retired !== "boolean")
    return NextResponse.json(
      { error: "Send { retired: true } to retire the plan or { retired: false } to offer it again." },
      { status: 400 },
    );

  const existing = await db.plan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Idempotent, and said: retiring a retired plan is not an error, but it is
  // not a second audit row either — the log would read as two decisions.
  if (isRetired(existing) === body.retired) {
    return NextResponse.json({ ...existing, unchanged: true });
  }

  const now = new Date();
  const subscribers = await db.subscription.count({ where: { planId: id } });

  // The write and its audit row in one transaction: a retirement nobody can
  // find in the log is a retirement nobody can explain at the next signup
  // question, and a log row for a write that did not land is worse.
  const [plan] = await db.$transaction([
    db.plan.update({
      where: { id },
      data: { retiredAt: body.retired ? now : null },
    }),
    db.platformAuditLog.create({
      data: {
        platformAdminId: admin.id,
        action: body.retired ? "plan_retired" : "plan_unretired",
        details: {
          planId: id,
          name: existing.name,
          tierKey: existing.tierKey,
          currency: existing.currency,
          priceMonthly: String(existing.priceMonthly),
          // Who is still on it, at the moment of the decision. Those
          // subscriptions are untouched — this number is what "kept for its
          // subscribers" means in the log.
          subscribersKept: subscribers,
          ...(body.retired
            ? { retiredAt: now.toISOString() }
            : { previouslyRetiredAt: existing.retiredAt?.toISOString?.() ?? String(existing.retiredAt) }),
        },
      },
    }),
  ]);

  return NextResponse.json(plan);
}
