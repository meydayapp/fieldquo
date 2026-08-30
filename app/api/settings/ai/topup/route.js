// app/api/settings/ai/topup/route.js
//
// Buying AI credit, pay-as-you-go — the direct mirror of
// app/api/settings/voice/topup/route.js, one wallet over.
//
//   POST { cents }   → a Stripe Checkout URL
//   GET  ?session_id → confirm it and add the credit
//
// Everything that file's own header explains applies unchanged here: prepaid
// rather than metered, credited on CONFIRMATION never on redirect, and settled
// through the same two-doors idempotent function (lib/ai/topup.js's
// creditAiTopup) the checkout.session.completed webhook also calls — see
// lib/stripe/settleCheckoutSession.js's "ai_topup" branch.
//
// The one thing that must never happen: this route naming `kind: "ai_topup"`
// is what routes the credit to the AI wallet rather than the phone one
// (lib/voice/credits.js's poolForKind). There is no `pool` argument anywhere
// in this file on purpose — see that file's header for why.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { getAppOrigin } from "@/lib/appUrl";
import { getOrCreateStripeCustomer } from "@/lib/platform/stripeBilling";
import { normaliseTopup, balanceFor, POOLS } from "@/lib/voice/credits";
import { creditAiTopup } from "@/lib/ai/topup";

async function requireAdmin(request) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { error: "Only an owner or admin can buy AI credit.", status: 403 };
  }
  return { member };
}

export async function POST(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  const cents = normaliseTopup(body.cents);
  if (!cents) {
    return NextResponse.json({ error: "Pick an amount of at least $5." }, { status: 400 });
  }

  const company = await db.company.findUnique({ where: { id: member.companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const origin = getAppOrigin(request);

  let session;
  try {
    const customerId = await getOrCreateStripeCustomer(company);
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "FieldQuo — AI credit top-up" },
            unit_amount: cents,
          },
          quantity: 1,
        },
      ],
      // Same two load-bearing keys as the voice route: `companyId` checked on
      // the way back so a stranger visiting the success URL can't credit
      // somebody else's account, and `kind` is what the webhook dispatches on.
      metadata: { companyId: member.companyId, kind: "ai_topup", cents: String(cents) },
      success_url: `${origin}/app/settings/ai-credit?aitopup={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/settings/ai-credit`,
    });
  } catch (err) {
    // Distinguished from every other refusal on this route on purpose — see
    // AGENTS.md's rule about honest empty states. "Couldn't reach Stripe" is
    // not the same fact as "you don't have permission" or "pick a real
    // amount", and collapsing them into one generic 500 is how a contractor
    // ends up guessing which one applies to them.
    return NextResponse.json(
      { error: "Couldn't reach the payment provider just now. Nothing was charged.", reason: "stripe_unavailable" },
      { status: 502 },
    );
  }

  return NextResponse.json({ checkoutUrl: session.url });
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "No session" }, { status: 400 });

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.json(
      { error: "Couldn't confirm that payment just now.", reason: "stripe_unavailable" },
      { status: 502 },
    );
  }

  if (session?.metadata?.companyId !== member.companyId) {
    return NextResponse.json({ error: "That payment isn't for this account." }, { status: 403 });
  }

  const result = await creditAiTopup(session, { member });

  return NextResponse.json({ ...result, balance: await balanceFor(member.companyId, db, POOLS.AI) });
}
