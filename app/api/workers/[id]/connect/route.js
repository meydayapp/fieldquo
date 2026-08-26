// app/api/workers/[id]/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { createConnectOnboardingLink } from "@/lib/stripe";
import { isPayrollAdmin } from "@/lib/permissions/settingsAccess";
import { getAppOrigin } from "@/lib/appUrl";

// Generates a Stripe Express onboarding link for a CONTRACTOR worker (not the
// company itself — that's app/api/stripe/connect/route.js). Same underlying Stripe
// mechanism, different subject: here the connected account belongs to an individual
// worker getting paid BY their company, not the company getting paid by clients.
export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── This mints a link to somebody's BANK DETAILS ─────────────────────────
  //
  // The only screen that calls this is /app/settings/team/workers, which is
  // isPayrollAdmin-gated — but the endpoint asked for nothing beyond a
  // session. Any member could POST a colleague's worker id and receive a
  // Stripe Express onboarding URL for the account that colleague gets PAID
  // through, then enter their own bank account into it. Same shape as the
  // company Connect login-link that was tightened for the same reason, one
  // level down: the individual's payouts rather than the company's.
  //
  // isPayrollAdmin, not user:manage — supervisors hold "may run a crew", and
  // running a crew is not authority over where their wages land. This is
  // deliberately the same predicate the Workers page already asks, so the
  // button and the route cannot disagree.
  if (!isPayrollAdmin(member.role)) {
    return NextResponse.json(
      {
        error:
          "Only an owner or admin can set up a contractor's payout account.",
      },
      { status: 403 },
    );
  }

  const worker = await db.worker.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!worker)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (worker.type !== "contractor") {
    return NextResponse.json(
      {
        error:
          "Only contractors connect their own Stripe account — employees are paid via the embedded payroll provider",
      },
      { status: 400 },
    );
  }

  const baseUrl = getAppOrigin(request);

  const { accountId, url } = await createConnectOnboardingLink({
    companyId: member.companyId, // used as metadata on the Stripe account for traceability
    stripeAccountId: worker.stripeConnectedAccountId,
    returnUrl: `${baseUrl}/app/settings/team/workers?connected=${worker.id}`,
    refreshUrl: `${baseUrl}/api/workers/${worker.id}/connect/refresh`,
  });

  if (!worker.stripeConnectedAccountId) {
    await db.worker.update({
      where: { id: worker.id },
      data: { stripeConnectedAccountId: accountId },
    });
  }

  return NextResponse.json({ url });
}
