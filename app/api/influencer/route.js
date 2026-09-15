// app/api/influencer/route.js
//
// The influencer's own summary: their link, the plan they earn under, and
// every company that arrived on the link with where it got to. Read-only.
//
// The COMPANY list here is the attribution table, not Company.referredByCode:
// a company that clicked the link but was refused attribution (the
// influencer's own second shop, say) is a referred company that earns
// nothing, and listing it beside the ones that do would promise money the
// ledger will never show. Read through lib/influencers/gate.js — see there
// for why this is the company gate and not the sales one.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { influencerOrRefusal } from "@/lib/influencers/gate";
import { referredStatus } from "@/lib/influencers";
import { REFEREE_BONUS_MONTHS } from "@/lib/referrals";

export async function GET(request) {
  const { company, ledger, response } = await influencerOrRefusal(request);
  if (response) return response;

  const attributions = await db.salesAttribution.findMany({
    where: { salesRepId: ledger.id },
    select: {
      capturedAt: true,
      company: {
        select: {
          id: true,
          name: true,
          createdAt: true,
          onboardingStatus: true,
          subscription: { select: { status: true } },
        },
      },
    },
    orderBy: { capturedAt: "desc" },
  });

  const plan = ledger.commissionPlan;

  return NextResponse.json({
    enrolled: true,
    influencerAt: company.influencerAt,
    referralCode: company.referralCode,
    referralUrl: company.referralCode
      ? `${getAppOrigin(request)}/refer/${company.referralCode}`
      : null,
    refereeBonusMonths: REFEREE_BONUS_MONTHS,
    // Null when FieldQuo has not attached one — the screen says so rather
    // than showing $0 milestones, because $0 is a plan and "none" is not.
    plan: plan
      ? {
          name: plan.name,
          active: plan.active,
          activationCents: plan.activationCents,
          firstPaymentCents: plan.firstPaymentCents,
          retentionCents: plan.retentionCents,
          retentionDays: plan.retentionDays,
        }
      : null,
    ledgerActive: ledger.active && !ledger.endedAt,
    companies: attributions
      .filter((a) => a.company)
      .map((a) => ({
        id: a.company.id,
        name: a.company.name,
        signedUpAt: a.company.createdAt,
        status: referredStatus(a.company),
      })),
  });
}
