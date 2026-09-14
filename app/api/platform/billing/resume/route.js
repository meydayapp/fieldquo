// app/api/platform/billing/resume/route.js
//
// Resume a cancelled or ending subscription. One button, no Checkout when
// Stripe already holds a card and a price.
//
//   GET   what pressing Resume WILL do — the banner and Account & Billing
//         label the button from this, so "Restart — your first month is
//         charged today ($1.00)" is on the button before it is pressed
//   POST  do it
//
// Both read the subscription LIVE from Stripe first (lib/billing/resume.js
// heals the row on the way through), because the row can lag Stripe and the
// decision has money on it. The four outcomes and why are in that file.
//
// The owner's rule for the second half of this (2026-09-14): one free trial
// per company, ever. A company that cancelled during its trial and presses
// Resume is charged today — lib/billing/trialOnce.js.
//
// Under /api/platform/billing because it is Stripe Billing (FieldQuo charging
// the company), not Connect — and because that prefix is on the
// always-writable list in lib/billing/access.js, which is what lets a
// read-only (cancelled) account press the one button that ends read-only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { loadResumeState, resumePreview, resumeSubscription } from "@/lib/billing/resume";
import { notifySubscriptionState } from "@/lib/billing/notify";
import { recordActivity } from "@/lib/activity/log";
import { recordError } from "@/lib/platform/errorLog";
import { getAppOrigin } from "@/lib/appUrl";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // Same gate as cancel: an estimator must not be offered a button that
  // charges the company's card. Refused with a status the banner reads as
  // "no button", not as an error.
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }
  try {
    const state = await loadResumeState(member.companyId);
    return NextResponse.json(resumePreview(state));
  } catch (err) {
    console.error("[platform/billing/resume] preview failed", err);
    return NextResponse.json({ error: "Couldn't check the subscription with Stripe." }, { status: 502 });
  }
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  let result;
  try {
    result = await resumeSubscription(member.companyId, { baseUrl: getAppOrigin(request) });
  } catch (err) {
    console.error("[platform/billing/resume]", err);
    await recordError({
      area: "billing",
      code: err?.code || err?.type || "resume_failed",
      message: `Resume failed: ${err?.message}`,
      companyId: member.companyId,
    }).catch(() => {});
    return NextResponse.json(
      { error: "Couldn't resume the plan through Stripe. Nothing was changed." },
      { status: 502 },
    );
  }

  if (result.resumed === false) {
    if (result.alreadyLive) {
      return NextResponse.json({ resumed: false, alreadyLive: true, note: "Your plan is already active." });
    }
    // Checkout: the plan cards' path, for the same plan and cadence. A null
    // URL means there was nothing to build one from (no plan on the row) and
    // the page's own cards are the way.
    return NextResponse.json({
      resumed: false,
      checkoutUrl: result.checkoutUrl || null,
      reason: result.reason,
      ...(result.note ? { note: result.note } : {}),
    });
  }

  // ── Written, so now said ─────────────────────────────────────────────────
  //
  // The activity row is the audit trail the platform console reads; the
  // "you're subscribed" note is the same one a checkout return sends, and it
  // dedupes on welcomeEmailSentAt, which the resume cleared. Neither failing
  // may turn a resumed plan into a 500.
  const summary =
    result.resumed === "uncancelled"
      ? "Resumed the FieldQuo subscription — the plan continues"
      : result.resumed === "credited"
        ? `Resumed the FieldQuo subscription — nothing charged until ${result.until.toISOString().slice(0, 10)}`
        : `Restarted the FieldQuo subscription — charged today`;
  await recordActivity(member, {
    action: "billing.resumed",
    entityType: "settings",
    summary,
    metadata: {
      mode:
        result.resumed === "uncancelled"
          ? "uncancelled"
          : result.resumed === "credited"
            ? "new_subscription_credited"
            : "new_subscription_charged",
      ...(result.until ? { creditedUntil: result.until } : {}),
      ...(result.stripeSubscriptionId ? { stripeSubscriptionId: result.stripeSubscriptionId } : {}),
      ...(result.amountPaidCents != null ? { amountPaidCents: result.amountPaidCents, currency: result.currency } : {}),
    },
  }).catch(() => {});
  if (result.resumed !== "uncancelled") {
    await notifySubscriptionState(member.companyId, request).catch(() => {});
  }

  if (result.resumed === "uncancelled") {
    return NextResponse.json({ resumed: "uncancelled", note: "Resumed — your plan continues." });
  }
  if (result.resumed === "credited") {
    return NextResponse.json({
      resumed: "credited",
      until: result.until,
      note: `Resumed — nothing is charged until ${result.until.toISOString().slice(0, 10)}.`,
    });
  }
  return NextResponse.json({
    resumed: "charged",
    amountPaidCents: result.amountPaidCents,
    currency: result.currency,
    nextBillingAt: result.nextBillingAt,
    note: `Restarted — ${(result.amountPaidCents / 100).toFixed(2)} ${result.currency.toUpperCase()} charged today.`,
  });
}
