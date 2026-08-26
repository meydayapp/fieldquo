// app/api/platform/billing/reconcile-session/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { reconcileCheckoutSession } from "@/lib/platform/stripeBilling";

// Fallback safety net for checkout.session.completed webhook delivery
// failures — called from the /app page right after the user is redirected
// back from Stripe Checkout, using the session_id Stripe appends to
// successUrl (see app/api/companies/route.js). Scoped to the caller's own
// company via getCurrentMember; reconcileCheckoutSession double-checks the
// session's metadata matches before writing anything.
export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { sessionId } = await request.json();
  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required" },
      { status: 400 },
    );
  }

  try {
    const subscription = await reconcileCheckoutSession(
      sessionId,
      member.companyId,
    );
    return NextResponse.json({ subscription });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
