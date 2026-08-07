// app/api/public/refer/[code]/route.js
//
// Public lookup for a referral code. No auth — the code is meant to be shared.
//
// Returns only what the landing page needs to say "Sunset Inc thinks you'd
// like this": the referrer's display name and branding. Not their email, not
// their plan, not how many people they've referred. A referral link handed out
// on a job site shouldn't disclose anything about the sender's account.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { findReferrer, REFEREE_BONUS_MONTHS } from "@/lib/referrals";

export async function GET(request, { params }) {
  const { code } = await params;

  const referrer = await findReferrer(code);

  if (!referrer || referrer.onboardingStatus === "churned") {
    return NextResponse.json(
      { valid: false, error: "That referral link isn't valid." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    valid: true,
    code: referrer.referralCode,
    referrerName: referrer.name,
    referrerLogoUrl: referrer.logoUrl,
    months: REFEREE_BONUS_MONTHS,
  });
}
