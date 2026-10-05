// app/api/settings/phone-verification/route.js
//
// The trial's mobile verification (lib/trial/phoneGate.js, phoneVerify.js).
// Paid from the company's phone & text credit (lib/trial/phoneVerifyBilling.js
// — owner, 2026-10-04); GET says what a first code costs and what is there.
//
//   GET                              → does this company need to verify, and has it
//   POST { action: "send", phone }   → text a code (rate-limited, line-type checked)
//   POST { action: "check", code }   → check it; on success the company is stamped
//
// Owner or admin only: the number verifies the COMPANY's trial, and a crew
// member's phone must not become the account's. A support session is
// read-only (non-negotiable #2) — getCurrentMember refuses its POSTs before
// this runs. Never returns a code, and never the full number of another
// company's verification.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { trialPhoneGate, PHONE_GATED_FEATURES } from "@/lib/trial/phoneGate";
import { sendCode, checkCode, maskE164, REFUSALS } from "@/lib/trial/phoneVerify";
import { recordActivity } from "@/lib/activity/log";
import { sendNeedCents } from "@/lib/trial/phoneVerifyBilling";
import { balanceFor } from "@/lib/voice/credits";

const ADMIN_ONLY = "Only the owner or an admin can verify the company's phone.";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const gate = await trialPhoneGate(member.companyId, { access: member.billingAccess || null });
  return NextResponse.json({
    required: gate.required === true,
    // Why not, when not: "not_trial" (on a plan), "verified", "demo",
    // "no_delivery_path" (FieldQuo can't text this country yet) — the screen
    // words each one differently rather than claiming a verification that
    // did not happen.
    reason: gate.reason,
    verified: Boolean(gate.company?.trialPhoneVerifiedAt) || gate.reason === "verified",
    masked: gate.company?.trialPhoneE164 ? maskE164(gate.company.trialPhoneE164) : null,
    features: Object.keys(PHONE_GATED_FEATURES),
    canVerify: isBillingAdmin(member.role),
    // What the screen says before anyone presses Send: a first code (number
    // check + text) and the phone & text credit there is. The send re-asks.
    cost: gate.required
      ? { firstCents: sendNeedCents({ lookupNeeded: true, sender: gate.deliveryPath === "verify" ? "verify" : "sms" }), balanceCents: await balanceFor(member.companyId) }
      : null,
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isBillingAdmin(member.role)) return NextResponse.json({ error: ADMIN_ONLY }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const gate = await trialPhoneGate(member.companyId, { access: member.billingAccess || null });
  // Nothing to verify: a paying company, a verified one, or a country we
  // can't text. Refused rather than spent — a code costs money.
  if (!gate.required) {
    return NextResponse.json({ error: REFUSALS.not_needed, reasonKey: "not_needed", reason: gate.reason }, { status: 409 });
  }

  if (body?.action === "send") {
    const result = await sendCode({
      companyId: member.companyId,
      userId: member.userId || null,
      phone: body.phone,
      deliveryPath: gate.deliveryPath,
    });
    if (!result.ok) {
      // 402 for "not enough phone & text credit" (owner, 2026-10-04): the
      // verification is paid from that wallet, and the screen answers it with
      // a top-up — so it carries what the send needs and what is there.
      const status =
        result.reasonKey === "no_phone_credit" ? 402
        : result.reasonKey === "too_soon" || result.reasonKey === "rate_limited" ? 429
        : result.reasonKey === "unavailable" ? 503
        : 400;
      return NextResponse.json(
        {
          error: REFUSALS[result.reasonKey] || REFUSALS.unavailable,
          reasonKey: result.reasonKey,
          ...(result.retryAfterSeconds ? { retryAfterSeconds: result.retryAfterSeconds } : {}),
          ...(result.reasonKey === "no_phone_credit"
            ? { needCents: result.needCents, balanceCents: result.balanceCents, shortfallCents: result.shortfallCents }
            : {}),
        },
        { status },
      );
    }
    return NextResponse.json({ sent: true, masked: result.masked, expiresAt: result.expiresAt, resendInSeconds: result.resendInSeconds });
  }

  if (body?.action === "check") {
    const result = await checkCode({ companyId: member.companyId, code: body.code });
    if (!result.ok) {
      return NextResponse.json({ error: REFUSALS[result.reasonKey] || REFUSALS.wrong_code, reasonKey: result.reasonKey }, { status: 400 });
    }
    await recordActivity(member, {
      action: "trial.phone_verified",
      entityType: "settings",
      summary: `Verified the trial's mobile ${result.masked}`,
      metadata: { masked: result.masked },
    }).catch(() => {});
    return NextResponse.json({ verified: true, masked: result.masked });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
