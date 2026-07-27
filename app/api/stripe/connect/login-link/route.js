// app/api/stripe/connect/login-link/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { createExpressLoginLink } from "@/lib/stripe";

// "Manage in Stripe" — a fresh, single-use link into the company's own
// Stripe Express dashboard (payout schedule, bank account, tax info). Doesn't
// require the "user:manage" gate that connect/disconnect do — any active
// member should be able to see how the company gets paid, same bar as
// viewing the Payments settings page itself.
export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { stripeAccountId: true, stripeChargesEnabled: true },
  });

  if (!company?.stripeAccountId) {
    return NextResponse.json(
      { error: "Stripe isn't connected yet" },
      { status: 400 },
    );
  }

  try {
    const url = await createExpressLoginLink(company.stripeAccountId);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[stripe/connect/login-link]", err);
    return NextResponse.json(
      { error: "Could not create a Stripe dashboard link" },
      { status: 500 },
    );
  }
}
