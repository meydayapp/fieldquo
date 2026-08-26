// app/api/settings/voice/auto-topup/route.js
//
// Automatic phone-credit top-ups, from the company's side.
//
//   POST            agree to the terms → a Stripe setup URL to save a card
//   GET ?session_id confirm that setup and arm it
//   PUT  { enabled } switch it on or off without touching the card
//   DELETE          forget the card and switch it off
//
// ── The order is the whole design ──────────────────────────────────────────
//
// Consent is recorded BEFORE Stripe is opened, and the card is saved second. A
// company that ticks the box and abandons the card form leaves a row that says
// "agreed, never finished" — which is the truth, and which lib/voice/credits.js
// refuses to charge. Doing it the other way round would leave a saved card with
// no record of what it was saved for, and that record is the only thing that
// makes an off-session charge authorised rather than merely possible.
//
// ── Owners and admins only ─────────────────────────────────────────────────
//
// This is a standing authority to charge the company's card. An employee with
// quote access has no business granting one, so it takes the same permission as
// buying credit by hand.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stripe } from "@/lib/stripe";
import { memberOrRefusalPlain } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { getAppOrigin } from "@/lib/appUrl";
import { recordActivity } from "@/lib/activity/log";
import {
  normaliseAutoTopupThreshold,
  normaliseAutoTopupAmount,
} from "@/lib/voice/credits";
import {
  recordAutoTopupConsent,
  createAutoTopupSetupSession,
  recordAutoTopupMandate,
  autoTopupFor,
  hasMandate,
  consentMatchesSettings,
  publicAutoTopup,
} from "@/lib/voice/autoTopup";

async function requireAdmin(request) {
  const { member, refusal } = await memberOrRefusalPlain(request);
  if (refusal) return refusal;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return {
      error: "Only an owner or admin can set up automatic top-ups.",
      status: 403,
    };
  }
  return { member };
}

/**
 * The IP the consent came from, for the record.
 *
 * Best-effort by nature — behind Vercel this is a proxy header and a determined
 * client can set it. Recorded anyway because a plausible IP alongside a
 * timestamp and a user agent is what a dispute is actually argued with, and
 * null is worth nothing at all. Never used to decide anything.
 */
function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim().slice(0, 64);
  return request.headers.get("x-real-ip")?.slice(0, 64) || null;
}

export async function POST(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));

  // ── The browser never sends money ───────────────────────────────────────
  //
  // It posts a CHOICE from a closed list, and the server turns that into an
  // amount from its own constants. normaliseAutoTopupThreshold and
  // normaliseAutoTopupAmount both return null for anything not on the list, so
  // "1" and "999999" are refusals rather than clamps.
  const thresholdCents = normaliseAutoTopupThreshold(body.thresholdCents);
  const amountCents = normaliseAutoTopupAmount(body.amountCents);
  if (thresholdCents === null || amountCents === null) {
    return NextResponse.json(
      { error: "Pick one of the offered trigger levels and amounts." },
      { status: 400 },
    );
  }

  // No tick, no authority. Deliberately not inferred from the presence of the
  // other two fields: a client that forgot to send this must fail, not be
  // treated as having agreed.
  if (body.acceptTerms !== true) {
    return NextResponse.json(
      { error: "You have to agree to the terms before we can charge a card." },
      { status: 400 },
    );
  }

  const company = await db.company.findUnique({ where: { id: member.companyId } });
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const consent = await recordAutoTopupConsent({
    companyId: member.companyId,
    company,
    thresholdCents,
    amountCents,
    member,
    ip: clientIp(request),
    userAgent: request.headers.get("user-agent"),
  });
  if (!consent.ok) {
    return NextResponse.json({ error: "Those settings aren't ones we offer." }, { status: 400 });
  }

  await recordActivity(member, {
    action: "voice.auto_topup.agreed",
    entityType: "settings",
    summary: `Agreed to automatic top-ups of $${(amountCents / 100).toFixed(2)} below $${(thresholdCents / 100).toFixed(2)}`,
    metadata: { thresholdCents, amountCents, termsLanguage: consent.terms.language },
  });

  const existing = consent.config;
  const origin = getAppOrigin(request);

  // ── A card already on file needs no second trip to Stripe ───────────────
  //
  // Changing the amount re-states the terms and re-stamps the consent, which is
  // the part that matters. Sending them through the card form again to save the
  // card they already saved would be ceremony, and ceremony people learn to
  // click through is worse than none.
  if (existing.stripePaymentMethodId && existing.stripeCustomerId) {
    const armed = await db.voiceAutoTopup.update({
      where: { companyId: member.companyId },
      data: { enabled: true, disabledAt: null, disabledReason: null },
    });
    return NextResponse.json({ ok: true, armed: true, config: publicAutoTopup(armed) });
  }

  const setup = await createAutoTopupSetupSession({
    company,
    successUrl: `${origin}/app/settings/voice?autotopup={CHECKOUT_SESSION_ID}#credit`,
    cancelUrl: `${origin}/app/settings/voice#credit`,
  });

  return NextResponse.json({ ok: true, setupUrl: setup.url });
}

export async function GET(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "No session" }, { status: 400 });

  // ── One settlement, two doors ────────────────────────────────────────────
  //
  // This return redirect and the checkout.session.completed webhook both call
  // recordAutoTopupMandate, in whichever order the network decides. The
  // company-ownership check lives inside it, against Stripe's own metadata,
  // because this door is handed a session id by a browser and the other is
  // handed a signed session by Stripe.
  const result = await recordAutoTopupMandate(member.companyId, sessionId);
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  await recordActivity(member, {
    action: "voice.auto_topup.enabled",
    entityType: "settings",
    summary: "Turned on automatic phone credit top-ups",
    metadata: {
      thresholdCents: result.config.thresholdCents,
      amountCents: result.config.amountCents,
      last4: result.config.paymentMethodLast4,
    },
  });

  return NextResponse.json({ ok: true, config: publicAutoTopup(result.config) });
}

export async function PUT(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const body = await request.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const config = await autoTopupFor(member.companyId);
  if (!config) {
    return NextResponse.json(
      { error: "Automatic top-up hasn't been set up on this account yet." },
      { status: 409 },
    );
  }

  // ── Turning it ON is gated on the mandate still being intact ────────────
  //
  // A switch that flips to "on" and charges nothing is the dead control this
  // codebase keeps deleting — and here the failure is worse than usual, because
  // the contractor then believes their phone cannot run out of credit.
  if (body.enabled) {
    if (!hasMandate(config)) {
      return NextResponse.json(
        { error: "There's no card saved for this. Set it up again to save one." },
        { status: 409 },
      );
    }
    if (!consentMatchesSettings(config)) {
      return NextResponse.json(
        { error: "The amount has changed since you agreed. Please read and accept the terms again." },
        { status: 409 },
      );
    }
  }

  const updated = await db.voiceAutoTopup.update({
    where: { companyId: member.companyId },
    data: {
      enabled: body.enabled,
      // Switching it back on is a fresh start. Carrying a failure counter over
      // would switch a contractor off again on their first blip after they had
      // already fixed whatever went wrong.
      ...(body.enabled
        ? {
            consecutiveFailures: 0,
            lastFailureAt: null,
            lastFailureCode: null,
            lastFailureMessage: null,
            disabledAt: null,
            disabledReason: null,
            notifiedAt: null,
          }
        : { disabledAt: new Date(), disabledReason: "switched_off_by_company" }),
    },
  });

  await recordActivity(member, {
    action: body.enabled ? "voice.auto_topup.enabled" : "voice.auto_topup.disabled",
    entityType: "settings",
    summary: body.enabled
      ? "Turned automatic phone credit top-ups back on"
      : "Turned automatic phone credit top-ups off",
  });

  return NextResponse.json({ ok: true, config: publicAutoTopup(updated) });
}

export async function DELETE(request) {
  const { member, error, status } = await requireAdmin(request);
  if (error) return NextResponse.json({ error }, { status });

  const config = await autoTopupFor(member.companyId);
  if (!config) return NextResponse.json({ ok: true });

  // ── Two independent stops ────────────────────────────────────────────────
  //
  // The row is cleared AND the payment method is detached at Stripe. Either
  // alone would prevent a charge; both together make it structurally
  // impossible, which is the difference between "our code won't" and "it
  // can't". Same reasoning as detachPaymentMethod in the service-plan mandate.
  //
  // The database write comes first. If Stripe is unreachable, the contractor
  // still ends up switched off — which is the outcome they asked for — rather
  // than being told the removal failed while the row still says enabled.
  await db.voiceAutoTopup.update({
    where: { companyId: member.companyId },
    data: {
      enabled: false,
      stripePaymentMethodId: null,
      stripeSetupIntentId: null,
      stripeMandateId: null,
      paymentMethodType: null,
      paymentMethodBrand: null,
      paymentMethodLast4: null,
      chargeInFlightAt: null,
      chargeAttemptToken: null,
      disabledAt: new Date(),
      disabledReason: "card_removed_by_company",
    },
  });

  if (config.stripePaymentMethodId) {
    // Best-effort by contract. The revocation above has already committed and a
    // Stripe hiccup must not undo it. `resource_missing` is a success in every
    // sense that matters — the method is already gone.
    //
    // NOT the customer: it is the same platform Billing customer that holds
    // their subscription card, and deleting it would cancel their plan's
    // payment method along with this one.
    await stripe.paymentMethods.detach(config.stripePaymentMethodId).catch(() => {});
  }

  await recordActivity(member, {
    action: "voice.auto_topup.card_removed",
    entityType: "settings",
    summary: "Removed the saved card and turned automatic top-ups off",
  });

  return NextResponse.json({ ok: true });
}
