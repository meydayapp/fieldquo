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
//
// ── And this GET is no longer the only way credit arrives ──────────────────
//
// It used to be, which made a closed tab or a dropped connection between Stripe
// and the redirect into a charge with no credit and no error. The
// `checkout.session.completed` webhook now settles the same payment through
// lib/stripe/settleCheckoutSession.js. Both call creditVoiceTopup(), which is
// where the once-only guarantee lives — keep the settlement there rather than
// growing a second copy here, because the copy is the one that rots.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { getAppOrigin } from "@/lib/appUrl";
import { getOrCreateStripeCustomer } from "@/lib/platform/stripeBilling";
import { normaliseTopup, minutesFor, balanceFor } from "@/lib/voice/credits";
import { creditVoiceTopup } from "@/lib/voice/topup";
import { syncNumberAttachment } from "@/lib/voice/provision";
import { pushCallCeiling } from "@/lib/voice/callCeiling";
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
    // Load-bearing twice over. `companyId` is checked on the way back, so a
    // stranger visiting the success URL can't credit somebody else's account —
    // and `kind` is what lib/stripe/settleCheckoutSession.js dispatches the
    // webhook on. Metadata is written here and travels with the session, which
    // is the only thing about a Stripe event that doesn't depend on which
    // endpoint it happens to land at.
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
  // credit their own account with someone else's payment. The webhook path has
  // no equivalent check and needs none: it is handed the session by Stripe with
  // a verified signature, rather than a session id by a browser.
  if (session?.metadata?.companyId !== member.companyId) {
    return NextResponse.json({ error: "That payment isn't for this account." }, { status: 403 });
  }

  // ── One settlement, two doors ────────────────────────────────────────────
  //
  // This return-redirect used to hold its own copy of the crediting logic, and
  // it was the ONLY path: close the tab after paying on a phone, lose signal
  // between Stripe and the redirect, or have this one fetch fail, and the
  // charge was real and the ledger never moved. Nothing ever asked again, and
  // the client swallowed the failure in a bare catch. Both production top-ups
  // were credited here, by luck of the browser coming back.
  //
  // creditVoiceTopup is now the single settlement and the webhook calls it too,
  // so either door works and neither can credit twice.
  const result = await creditVoiceTopup(session, { member });

  // The side effects stay HERE rather than moving into the settlement, because
  // they are about this company's phone rather than about the money: a paid
  // balance is worth nothing until the number is answering again and the
  // call-length ceiling has been lifted to match it. Re-attaching without the
  // ceiling leaves someone who just bought $50 of credit still capped at the
  // one minute their empty balance bought — the phone answers and hangs up
  // mid-sentence, which is worse than not answering.
  await syncNumberAttachment(member.companyId).catch(() => {});
  await pushCallCeiling(member.companyId).catch(() => {});

  return NextResponse.json({ ...result, balance: await balanceFor(member.companyId) });
}
