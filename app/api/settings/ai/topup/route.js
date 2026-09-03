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
//
// ── The Checkout session and the confirmation now live in a shared module ───
//
// app/api/ai/topup/route.js serves the same purchase from a dialog over the
// designer's canvas, and it has to come BACK to that canvas rather than to
// this settings page. Two routes each building their own Checkout Session
// would be two demo branches and two metadata shapes; both call
// lib/ai/topupIntent.js instead. The parameters Stripe receives are unchanged
// — scripts/check-ai-topup-inline.mjs diffs them against the shape this file
// used to build inline.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { getAppOrigin } from "@/lib/appUrl";
import { normaliseTopup } from "@/lib/voice/credits";
import { startAiTopup, confirmAiTopup } from "@/lib/ai/topupIntent";

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

  // The demo branch, the Checkout session and the Stripe-unavailable refusal
  // all live in startAiTopup now — see this file's header. `returnPath` is
  // omitted rather than passed as "/app/settings/ai-credit", so the default in
  // that function stays the one place the settings landing is written down.
  const result = await startAiTopup({ company, cents, origin });

  if (!result.ok) {
    // Distinguished from every other refusal on this route on purpose — see
    // AGENTS.md's rule about honest empty states. "Couldn't reach Stripe" is
    // not the same fact as "you don't have permission" or "pick a real
    // amount", and collapsing them into one generic 500 is how a contractor
    // ends up guessing which one applies to them.
    return NextResponse.json(
      { error: "Couldn't reach the payment provider just now. Nothing was charged.", reason: result.reason },
      { status: 502 },
    );
  }

  // A demo gets a LOCAL url in `checkoutUrl` because this page's caller
  // navigates to whatever it gets — so the rep sees the same
  // click-then-land-on-the-balance flow a paying customer sees, minus the
  // payment. The param deliberately is NOT the one the success handler reads;
  // that one triggers a Stripe session lookup, which would fail on an id that
  // never existed. The dialog does not navigate at all on this branch, which
  // is why the simulated flag rather than the URL is what it reads.
  if (result.simulated) {
    return NextResponse.json({
      checkoutUrl: `${origin}/app/settings/ai-credit?demo_topup=1`,
      simulated: true,
    });
  }

  return NextResponse.json({ checkoutUrl: result.checkoutUrl });
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const sessionId = new URL(request.url).searchParams.get("session_id");
  const result = await confirmAiTopup({ sessionId, companyId: member.companyId, member });

  if (!result.ok) {
    if (result.reason === "no_session") {
      return NextResponse.json({ error: "No session" }, { status: 400 });
    }
    if (result.reason === "wrong_company") {
      return NextResponse.json({ error: "That payment isn't for this account." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Couldn't confirm that payment just now.", reason: result.reason },
      { status: 502 },
    );
  }

  // `balance` is kept as well as `balanceCents` because this page has read
  // `balance` since the route was written, and renaming a field the screen
  // already uses to make two callers match is how a balance stops rendering.
  return NextResponse.json({ ...result, balance: result.balanceCents });
}
