// app/api/public/refer/[code]/route.js
//
// Public lookup for a referral code. No auth — the code is meant to be shared.
//
// Returns only what the landing page needs to say "Sunset Inc thinks you'd
// like this": the referrer's display name and branding. Not their email, not
// their plan, not how many people they've referred. A referral link handed out
// on a job site shouldn't disclose anything about the sender's account.
//
// ── `months` is what may be PROMISED, and since 2026-10-03 it can be 0 ────
//
// The newcomer's month lands when it chooses a plan, and only if the referrer
// has chosen one (the owner: referrals "only work when they have selected a
// plan" — lib/referrals). A link shared by a company still on the free trial
// keeps working for signing up, but promises nothing: months is 0 and the
// signup page shows no bonus banner. That one bit — "this link carries a
// month" — is the least the page can know to avoid promising a month the
// grant would refuse; it is not the plan, the price or the status.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { findReferrer, companyHasSelectedPlan, REFEREE_BONUS_MONTHS } from "@/lib/referrals";

export async function GET(request, { params }) {
  const { code } = await params;

  const referrer = await findReferrer(code);

  if (!referrer || referrer.onboardingStatus === "churned") {
    return NextResponse.json(
      { valid: false, error: "That referral link isn't valid." },
      { status: 404 },
    );
  }

  const carriesMonth = await companyHasSelectedPlan(referrer.id);

  return NextResponse.json({
    valid: true,
    code: referrer.referralCode,
    referrerName: referrer.name,
    referrerLogoUrl: referrer.logoUrl,
    months: carriesMonth ? REFEREE_BONUS_MONTHS : 0,
    // When the month lands — read by the signup banner's sentence.
    appliesWhen: "plan_selected",
  });
}
