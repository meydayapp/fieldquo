// app/api/platform/companies/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { QUOTE_BUILDER_LAYOUTS } from "@/lib/quotes/builderLayout";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { diagnoseNumber } from "@/lib/voice/diagnose";
import { companyStanding } from "@/lib/platform/companyStanding";
import { cancelOptions } from "@/lib/platform/cancelOptions";
import { unlockPlan } from "@/lib/platform/unlock";
import { trialAccessFor } from "@/lib/billing/access";
import { getOnboardingStatus } from "@/lib/onboarding";
import { callBackFor, needsChecklistRead } from "@/lib/platform/callBack";

// Next 16: params is a Promise and must be awaited. Reading params.id
// synchronously resolves to undefined, which turns every lookup on this route
// into a 404 that looks like missing data rather than a bug.
export async function GET(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const company = await db.company.findUnique({
    where: { id },
    include: {
      subscription: { include: { plan: true } },
      members: {
        // phone / marketingConsentAt: the owner's own number and product-news
        // consent from the one-screen signup (2026-09-29), for the call-back.
        include: { user: { select: { name: true, email: true, phone: true, marketingConsentAt: true } } },
        orderBy: { createdAt: "asc" },
      },
      // Client and quote counts only — not the records themselves. Aggregates
      // give support the context they need without putting every homeowner's
      // name and address in front of staff by default.
      // ── Every number here is billed to FieldQuo ────────────────────────
      //
      // Numbers are provisioned on FieldQuo's own Retell account and charged
      // to FieldQuo monthly, whether or not the tenant's prepaid balance ever
      // covers them. The company's own settings screen shows its numbers and
      // even warns "don't buy another one, this one is already being charged
      // for" — and nothing showed the same thing to the person actually paying.
      //
      // Big painter Inc is carrying two numbers stuck in `provisioning` and
      // one in `porting`: rent going out against lines nothing can answer on.
      // That was invisible from this console.
      voiceNumbers: {
        select: {
          id: true,
          e164: true,
          source: true,
          numberType: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { quotes: true, invoices: true, jobs: true, clients: true },
      },
    },
  });

  if (!company)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── What is actually wrong with a stuck number ──────────────────────────
  //
  // Support looking at a company should see the same diagnosis the contractor
  // does, or the two are reading different stories off the same row. Until now
  // this console said "nothing in the app can repair one", which stopped being
  // true when lib/voice/diagnose.js landed.
  //
  // Read-only, and it stays that way: diagnoseNumber() only reads — from our
  // database and from the provider — and there is deliberately no repair
  // control here. Non-negotiable #3: the platform console views everything and
  // edits nothing.
  //
  // Only run when something looks stuck. Every healthy company would otherwise
  // cost a provider round-trip on a page support opens all day, for an answer
  // that is always "ok".
  const stuck = company.voiceNumbers.some(
    (n) => n.status !== "active" && n.status !== "porting" && n.status !== "released",
  );
  const voiceDiagnosis = stuck
    ? await diagnoseNumber(id).catch(() => null)
    : null;

  // The header's status, derived rather than read off onboardingStatus —
  // lib/platform/companyStanding.js says why.
  // What the "Cancel the subscription" panel may offer THIS company, in
  // words true for it — the same pure function the cancel route decides
  // with, so the button and the write cannot disagree. trialAccess is the
  // trial's own state without any ending folded in (only trialEndsAt goes
  // in), for the sentence an expired trial's "now" carries.
  const cancel = cancelOptions({
    company,
    subscription: company.subscription ?? null,
    trialAccess: trialAccessFor({ trialEndsAt: company.trialEndsAt }),
  });
  // "Needs call back" (lib/platform/callBack.js) — the same rule as the list.
  const owner = company.members.find((m) => m.role === "owner") || null;
  const checklist = needsChecklistRead(company)
    ? await getOnboardingStatus(id, { readOnly: true }).catch(() => null)
    : null;
  const callBack = callBackFor({ company, onboarding: checklist, ownerPhone: owner?.user?.phone || null });
  // "Unlock company" — what FieldQuo locked, if anything, and what Unlock
  // would give back and leave alone. The same pure function the unlock route
  // decides with; the write set (`data`) stays on the server.
  const unlock = unlockPlan({ company, subscription: company.subscription ?? null });
  delete unlock.data;
  return NextResponse.json({ ...company, voiceDiagnosis, standing: companyStanding(company), cancelOptions: cancel, unlock, callBack });
}

export async function PATCH(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { onboardingStatus, name, quoteBuilderLayout } = body;

  // The quote-builder rollout flag. FieldQuo's own decision about which
  // screen a company gets — like /platform/features, not the company's data
  // (non-negotiable #3 is about quotes, clients and invoices; this touches
  // none of them). Closed vocabulary: anything else is refused, not stored.
  if (
    quoteBuilderLayout !== undefined &&
    !QUOTE_BUILDER_LAYOUTS.includes(quoteBuilderLayout)
  ) {
    return NextResponse.json(
      { error: `quoteBuilderLayout must be one of ${QUOTE_BUILDER_LAYOUTS.join(", ")}.` },
      { status: 400 },
    );
  }

  // Suspending a company cuts off a paying customer's access — a heavier
  // action than renaming, and gated accordingly. Support can do neither.
  const needed =
    onboardingStatus === "churned" || onboardingStatus === "suspended"
      ? "company:suspend"
      : "company:manage";

  try {
    requirePlatformPermission(admin.role, needed);
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const existing = await db.company.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await db.company.update({
    where: { id },
    data: {
      ...(onboardingStatus !== undefined && { onboardingStatus }),
      ...(name !== undefined && { name }),
      ...(quoteBuilderLayout !== undefined && { quoteBuilderLayout }),
    },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action:
        onboardingStatus === "suspended"
          ? "company_suspended"
          : "company_updated",
      targetCompanyId: id,
      // Record what it was as well as what it became — an audit entry saying
      // only "status changed to churned" can't answer "changed from what?".
      details: {
        ...body,
        previousStatus: existing.onboardingStatus,
        ...(quoteBuilderLayout !== undefined && {
          previousQuoteBuilderLayout: existing.quoteBuilderLayout,
        }),
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePlatformPermission(admin.role, "company:suspend");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  const existing = await db.company.findUnique({ where: { id } });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Suspend, don't hard-delete — a company with real client/financial data shouldn't
  // be one DELETE call away from gone. If you genuinely need permanent deletion later,
  // that should be a deliberate, separate, harder-to-trigger operation.
  await db.company.update({
    where: { id },
    data: { onboardingStatus: "churned" },
  });

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "company_deletion_requested",
      targetCompanyId: id,
      details: { previousStatus: existing.onboardingStatus },
    },
  });

  return NextResponse.json({
    success: true,
    note: "Company marked as churned, not deleted. Contact engineering for permanent deletion.",
  });
}
