// app/api/stripe/connect/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { requirePermission } from "@/lib/permissions";
import { createConnectOnboardingLink } from "@/lib/stripe";

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only owners/admins can connect Stripe" },
      { status: 403 },
    );
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

  const { accountId, url } = await createConnectOnboardingLink({
    companyId: company.id,
    stripeAccountId: company.stripeAccountId,
    returnUrl: `${baseUrl}/app/settings/payments?connected=true`,
    refreshUrl: `${baseUrl}/api/stripe/connect/refresh?companyId=${company.id}`,
  });

  if (!company.stripeAccountId) {
    await db.company.update({
      where: { id: company.id },
      data: { stripeAccountId: accountId },
    });
  }

  return NextResponse.json({ url });
}
