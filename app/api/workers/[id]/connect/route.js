// app/api/workers/[id]/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { createConnectOnboardingLink } from "@/lib/stripe";

// Generates a Stripe Express onboarding link for a CONTRACTOR worker (not the
// company itself — that's app/api/stripe/connect/route.js). Same underlying Stripe
// mechanism, different subject: here the connected account belongs to an individual
// worker getting paid BY their company, not the company getting paid by clients.
export async function POST(request, { params }) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const worker = await db.worker.findFirst({
    where: { id: params.id, companyId: member.companyId },
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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  const { accountId, url } = await createConnectOnboardingLink({
    companyId: member.companyId, // used as metadata on the Stripe account for traceability
    stripeAccountId: worker.stripeConnectedAccountId,
    returnUrl: `${baseUrl}/app/team/workers?connected=${worker.id}`,
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
