// app/api/platform/companies/[id]/influencer/route.js
//
// A company's standing in the influencer programme, and the one write the
// console may make to it: enrolling the company.
//
// ══ On non-negotiable #3 ══════════════════════════════════════════════════
//
// The platform console views a company's data and edits none of it. This
// POST writes Company.influencerAt / influencerRepId and, if missing, the
// referral code — and creates a SalesRep ledger row that is FieldQuo's own
// bookkeeping, not the company's. Like extend-trial, this is FieldQuo
// changing its OWN commercial arrangement with the company, at the owner's
// explicit request ("Superadmin can also convert an EXISTING company into an
// influencer from the company page"), never a quote, a client or an invoice.
// Superadmin only, audited, and it goes through the same enrolInfluencer()
// the signup path uses so the two cannot enrol differently.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { enrolInfluencer, isInfluencer } from "@/lib/influencers";
import { resolvePlanAssignment } from "@/lib/sales/commissionPlanServer";

const REFUSALS = {
  already_influencer: "This company is already an influencer.",
  no_owner_email: "The company has no owner with an email address, so there is nobody to pay.",
  no_plan: "Pick a commission plan.",
  inactive_plan: "That plan isn't offered any more. Reactivate it, or pick one that is.",
  email_taken:
    "The owner's email is already a sales rep's login. A person cannot be both a rep and an influencer; deactivate the rep first or use a different owner.",
  unknown_company: "No such company.",
  error: "Enrolment failed — see /platform/errors.",
};

async function standing(id) {
  const company = await db.company.findUnique({
    where: { id },
    select: {
      id: true,
      influencerAt: true,
      influencerRepId: true,
      referralCode: true,
      influencerRep: {
        select: {
          id: true,
          kind: true,
          active: true,
          commissionPlan: { select: { id: true, name: true } },
          _count: { select: { attributions: true } },
        },
      },
    },
  });
  if (!company) return null;
  const enrolled = isInfluencer(company) && company.influencerRep?.kind === "influencer";
  return {
    enrolled,
    influencerAt: company.influencerAt,
    ledgerId: enrolled ? company.influencerRep.id : null,
    ledgerActive: enrolled ? company.influencerRep.active : null,
    plan: enrolled ? company.influencerRep.commissionPlan : null,
    referredCount: enrolled ? company.influencerRep._count.attributions : 0,
    referralCode: company.referralCode,
  };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const out = await standing(id);
  if (!out) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The plans the convert control can offer. Active only — the same rule
  // resolvePlanAssignment enforces on the write.
  const plans = await db.salesCommissionPlan.findMany({
    where: { active: true },
    select: { id: true, name: true, activationCents: true, firstPaymentCents: true, retentionCents: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ ...out, plans });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (admin.role !== "superadmin") {
    return NextResponse.json(
      { error: "Only a superadmin can enrol a company as an influencer." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const resolved = await resolvePlanAssignment({ db, planId: body?.commissionPlanId ?? null });
  if (resolved.error) return NextResponse.json({ error: resolved.error }, { status: 400 });
  if (!resolved.commissionPlanId) {
    return NextResponse.json({ error: REFUSALS.no_plan }, { status: 400 });
  }

  const out = await enrolInfluencer({
    companyId: id,
    commissionPlanId: resolved.commissionPlanId,
    via: `platform:${admin.id}`,
  });

  if (!out.ok) {
    const status = out.reason === "unknown_company" ? 404 : 409;
    return NextResponse.json({ error: REFUSALS[out.reason] || REFUSALS.error, reason: out.reason }, { status });
  }

  await db.platformAuditLog.create({
    data: {
      platformAdminId: admin.id,
      action: "influencer_enrolled",
      details: { companyId: id, ledgerId: out.rep.id, commissionPlanId: resolved.commissionPlanId },
    },
  });

  const fresh = await standing(id);
  return NextResponse.json(fresh, { status: 201 });
}
