// lib/influencers/gate.js
//
// The one way /app reads an influencer's ledger: through the COMPANY gate,
// scoped to the company's own influencerRepId.
//
// ══ Why not the sales gate ════════════════════════════════════════════════
//
// The ledger is a SalesRep row, and the rep portal already has routes that
// read a SalesRep's earnings and payout details. The temptation is to let
// the influencer sign into /sales. lib/influencers/index.js says why not: a
// kind "influencer" row is a customer's commission ledger, not FieldQuo
// staff, and the sales portal is full of prospects, call queues and other
// reps' numbers. So the influencer's screen lives in /app, is gated the way
// Refer & Earn is gated (owner or admin — lib/billing/billingAdmin.js), and
// every read and write is keyed on Company.influencerRepId read fresh from
// the database on this request. A body can name no rep; a company can only
// ever reach its own row.
//
// Impersonation is allowed through for reads (non-negotiable #3: the platform
// console sees everything) and refused for writes by getCurrentMember itself.
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { NextResponse } from "next/server";
import { isInfluencer } from "./index";

/**
 * Resolve the calling member, their company, and the company's ledger row.
 *
 * @returns {{ member, company, ledger, response }} — `response` is set on any
 *   refusal (not signed in, not owner/admin, not an influencer) and the
 *   caller returns it as-is.
 */
export async function influencerOrRefusal(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return { member: null, company: null, ledger: null, response };

  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return {
      member,
      company: null,
      ledger: null,
      response: NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 }),
    };
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: {
      id: true,
      name: true,
      referralCode: true,
      influencerAt: true,
      influencerRepId: true,
    },
  });

  if (!company || !isInfluencer(company)) {
    // 404, not 403: the screen behind this is only linked for an enrolled
    // company, and "not found" is the honest answer for one that is not.
    return {
      member,
      company,
      ledger: null,
      response: NextResponse.json(
        { error: "This company is not in the influencer programme.", notEnrolled: true },
        { status: 404 },
      ),
    };
  }

  const ledger = await db.salesRep.findUnique({
    where: { id: company.influencerRepId },
    select: {
      id: true,
      kind: true,
      active: true,
      endedAt: true,
      engagement: true,
      accruesPaidLeave: true,
      payoutMethod: true,
      payoutHandle: true,
      payoutConfirmedAt: true,
      commissionPlan: {
        select: {
          id: true,
          name: true,
          active: true,
          activationCents: true,
          firstPaymentCents: true,
          retentionCents: true,
          retentionDays: true,
        },
      },
    },
  });

  // A pointer to a row that is gone, or to a staff rep's row, is a broken
  // enrolment and is reported as one rather than rendered as somebody else's
  // pay.
  if (!ledger || ledger.kind !== "influencer") {
    return {
      member,
      company,
      ledger: null,
      response: NextResponse.json(
        { error: "This company's influencer ledger is missing. Contact FieldQuo.", notEnrolled: true },
        { status: 404 },
      ),
    };
  }

  return { member, company, ledger, response: null };
}
