// app/api/stripe/connect/instant-payout/route.js
//
// GET  — what an instant payout would do right now: eligible or why not,
//        Stripe's gross and net, the destination card.
// POST — do it. No body is read: the amount is Stripe's own net_available
//        (non-negotiable #5 — the browser never sends money amounts).
//
// Same lock as the other doors into the company's Stripe account (connect,
// disconnect, login-link): owner or admin. Under impersonation the GET
// answers — "why can't this company pay out instantly" is a support question
// — and the POST is refused by middleware and again by getCurrentMember's
// read-only gate before this file is reached; the explicit check below is
// the third lock, because a payout is money leaving a balance and hiding a
// button is not access control.
export const runtime = "nodejs";

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import {
  INSTANT_PAYOUTS_ENABLED,
  createInstantPayout,
  instantPayoutEligibility,
  loadInstantPayoutState,
  reportedFeePercent,
} from "@/lib/stripe/instantPayout";

const COMPANY_SELECT = { id: true, stripeAccountId: true, stripeChargesEnabled: true };

// What the browser is told. Gross, net and the reported fee — never the
// platform's share of that fee as a rate.
function view(decision) {
  return {
    eligible: decision.eligible,
    reason: decision.reason,
    currency: decision.currency,
    grossCents: decision.grossCents,
    netCents: decision.netCents,
    feeCents: decision.feeCents,
    feePercent: reportedFeePercent(decision),
    expectedRate: decision.expectedRate,
    destination: decision.destination
      ? { last4: decision.destination.last4, kind: decision.destination.object }
      : null,
    accountAgeDays: decision.accountAgeDays,
  };
}

// Off by design (see INSTANT_PAYOUTS_ENABLED). A 404 rather than a 403: the
// feature does not exist on this deployment, and nobody's permissions are
// the reason.
const OFF = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export async function GET(request) {
  if (!INSTANT_PAYOUTS_ENABLED) return OFF();
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: COMPANY_SELECT,
  });
  if (!company?.stripeAccountId) {
    return NextResponse.json(view(instantPayoutEligibility({ company, account: null, balance: null })));
  }

  try {
    const { account, balance } = await loadInstantPayoutState(company);
    const recent = await db.instantPayout.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, createdAt: true, currency: true, grossCents: true, netCents: true },
    });
    return NextResponse.json({
      ...view(instantPayoutEligibility({ company, account, balance })),
      recent,
    });
  } catch (err) {
    console.error("[stripe/connect/instant-payout]", err?.message);
    return NextResponse.json(
      { error: err?.raw?.message || err?.message || "Couldn't read the Stripe balance." },
      { status: 502 },
    );
  }
}

export async function POST(request) {
  if (!INSTANT_PAYOUTS_ENABLED) return OFF();
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json(
      { error: "Support access can't move a company's money." },
      { status: 403 },
    );
  }
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: COMPANY_SELECT,
  });
  if (!company?.stripeAccountId) {
    return NextResponse.json({ error: "Stripe isn't connected yet" }, { status: 400 });
  }

  try {
    const result = await createInstantPayout({
      company,
      userId: member.userId,
      requestId: randomUUID(),
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.reason,
          reason: result.reason,
          ...(result.decision ? view(result.decision) : {}),
        },
        { status: result.status || 409 },
      );
    }
    return NextResponse.json({
      ok: true,
      payoutId: result.payout.id,
      arrival: result.payout.arrival_date || null,
      ...view(result.decision),
    });
  } catch (err) {
    console.error("[stripe/connect/instant-payout] create failed:", err?.message);
    return NextResponse.json(
      { error: err?.raw?.message || err?.message || "The payout could not be created." },
      { status: 502 },
    );
  }
}
