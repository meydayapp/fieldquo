// app/api/settings/ai/bundle/route.js
//
// A monthly AI credit allowance — subscribe, confirm, cancel. See
// lib/ai/creditBundle.js for the economics, the idempotent grant and why
// unused credit rolls over rather than expiring.
//
//   GET                → current subscription status + the three plans on offer
//   GET  ?session_id=…  → confirm a just-completed subscription checkout
//   POST { key }        → a Stripe Checkout URL for one bundle
//   DELETE               → cancel — stops future grants, keeps what's granted
//
// Owners and admins only — same permission as the phone credit's own
// topup/auto-topup routes, because this is a standing monthly authority to
// charge the company's card, same as those.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { getAppOrigin } from "@/lib/appUrl";
import { isAiConfigured } from "@/lib/ai/provider";
import { BUNDLES } from "@/lib/ai/imageEconomics";
import {
  bundleByKey,
  createAiBundleCheckoutSession,
  settleAiBundleCheckoutSession,
  cancelAiBundle,
  aiCreditBundleFor,
  publicAiBundle,
  BUNDLE_ROLLOVER_NOTICE,
} from "@/lib/ai/creditBundle";
import { stripe } from "@/lib/stripe";

async function requireAdmin(request) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return { error: "Only an owner or admin can manage the AI credit plan.", status: 403 };
  }
  return { member };
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const sessionId = new URL(request.url).searchParams.get("session_id");

  if (sessionId) {
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    } catch {
      return NextResponse.json(
        { ok: false, reason: "stripe_unavailable" },
        { status: 502 },
      );
    }
    if (session?.metadata?.companyId !== member.companyId) {
      return NextResponse.json({ ok: false, reason: "session_mismatch" }, { status: 403 });
    }
    const result = await settleAiBundleCheckoutSession(session);
    const row = await aiCreditBundleFor(member.companyId);
    return NextResponse.json({ ...result, config: publicAiBundle(row) });
  }

  const row = await aiCreditBundleFor(member.companyId);
  return NextResponse.json({
    // Distinguished the same way the voice picker splits "not_configured"
    // (no key on this deployment — nothing generated or reviewed here can
    // ever spend AI credit) from an ordinary failure. A company can still buy
    // ahead of a key being added, so this is informational rather than a
    // block — see the UI, which shows it as a banner rather than hiding the
    // purchase controls.
    aiConfigured: isAiConfigured(),
    bundles: BUNDLES,
    rolloverNotice: BUNDLE_ROLLOVER_NOTICE,
    config: publicAiBundle(row),
  });
}

export async function POST(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  const bundle = bundleByKey(body.key);
  if (!bundle) {
    return NextResponse.json({ error: "That isn't one of the AI credit plans on offer." }, { status: 400 });
  }

  const existing = await aiCreditBundleFor(member.companyId);
  if (existing && existing.status !== "canceled") {
    return NextResponse.json(
      { error: "You already have an AI credit plan. Cancel it before starting a different one." },
      { status: 409 },
    );
  }

  const company = await db.company.findUnique({ where: { id: member.companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const origin = getAppOrigin(request);

  let result;
  try {
    result = await createAiBundleCheckoutSession({
      company,
      bundleKey: bundle.key,
      successUrl: `${origin}/app/settings/ai-credit?aibundle={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${origin}/app/settings/ai-credit`,
    });
  } catch {
    return NextResponse.json(
      { error: "Couldn't reach the payment provider just now. Nothing was charged.", reason: "stripe_unavailable" },
      { status: 502 },
    );
  }

  if (!result.ok) {
    return NextResponse.json({ error: "Couldn't start that plan." }, { status: 400 });
  }

  return NextResponse.json({ checkoutUrl: result.checkoutUrl });
}

export async function DELETE(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const result = await cancelAiBundle(member.companyId);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Couldn't reach the payment provider to cancel just now. Nothing has changed — your plan is still active and still billing.", reason: result.reason },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, config: publicAiBundle(result.config) });
}
