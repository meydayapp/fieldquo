// app/api/settings/voice/topup/route.js
//
// Buying voice credit.
//
//   POST { cents }   → a Stripe Checkout URL
//   GET  ?session_id → confirm it and add the credit
//
// ── One-time payment, not a subscription ───────────────────────────────────
//
// Credit is prepaid on purpose (see lib/voice/credits.js) — a contractor will
// not accept a phone bill that can be any number. So this is `mode: "payment"`,
// which also means no card is stored beyond the charge unless they already have
// one on file for their plan.
//
// ── Credited on CONFIRMATION, never on redirect ────────────────────────────
//
// The success URL is just a URL — anyone can visit it. So the GET below asks
// Stripe whether the session was actually paid, and matches the session's own
// metadata against this company before adding a cent. Same pattern as the
// subscription reconcile, and for the same reason: the browser saying "it
// worked" is not evidence that it did.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { getAppOrigin } from "@/lib/appUrl";
import { getOrCreateStripeCustomer } from "@/lib/platform/stripeBilling";
import { addCredit, normaliseTopup, minutesFor, balanceFor } from "@/lib/voice/credits";
import { syncNumberAttachment } from "@/lib/voice/provision";
import { activeNumber } from "@/lib/voice/numbers";

async function requireAdmin(request) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { error: "Only an owner or admin can buy credit.", status: 403 };
  }
  return { member };
}

export async function POST(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  const cents = normaliseTopup(body.cents);
  if (!cents) {
    return NextResponse.json(
      { error: "Pick an amount of at least $5." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({ where: { id: member.companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const number = await activeNumber(member.companyId);
  const customerId = await getOrCreateStripeCustomer(company);
  const origin = getAppOrigin(request);

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            // Labelled in MINUTES as well as dollars. "$30" means nothing to
            // someone deciding; "about 85 calls" is a decision they can make.
            name: `Phone credit — about ${minutesFor(cents, number?.numberType)} minutes`,
          },
          unit_amount: cents,
        },
        quantity: 1,
      },
    ],
    // Checked on the way back, so a stranger visiting the success URL can't
    // credit somebody else's account.
    metadata: { companyId: member.companyId, kind: "voice_topup", cents: String(cents) },
    success_url: `${origin}/app/settings/voice?topup={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/app/settings/voice`,
  });

  return NextResponse.json({ checkoutUrl: session.url });
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "No session" }, { status: 400 });

  const session = await stripe.checkout.sessions.retrieve(sessionId);

  // Belongs to THIS company. Without this, anyone who saw a session id could
  // credit their own account with someone else's payment.
  if (session?.metadata?.companyId !== member.companyId) {
    return NextResponse.json({ error: "That payment isn't for this account." }, { status: 403 });
  }
  if (session.payment_status !== "paid") {
    return NextResponse.json({ credited: false, reason: session.payment_status });
  }

  const cents = normaliseTopup(session.metadata.cents) || session.amount_total;

  // Idempotent on the session id — this endpoint is hit on every page load
  // carrying ?topup=, including a refresh, and crediting twice for one payment
  // is the kind of generosity that's impossible to explain afterwards.
  await addCredit({
    companyId: member.companyId,
    cents,
    kind: "topup",
    stripeRef: session.id,
    note: `Top-up $${(cents / 100).toFixed(2)}`,
  });

  await recordActivity(member, {
    action: "voice.credit_added",
    entityType: "settings",
    summary: `Added $${(cents / 100).toFixed(2)} of phone credit`,
    metadata: { cents, stripeRef: session.id },
  });

  // Back in credit — put the agent back on the number if the contractor still
  // has the receptionist switched on. Without this, an account that ran dry
  // stayed silent after paying, which reads as "the top-up didn't work".
  await syncNumberAttachment(member.companyId).catch(() => {});

  const balance = await balanceFor(member.companyId);
  return NextResponse.json({ credited: true, cents, balance });
}
