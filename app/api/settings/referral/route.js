// app/api/settings/referral/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { getAppOrigin } from "@/lib/appUrl";
import { referralCodeFor, REWARD_MONTHS } from "@/lib/referrals";

// Plain company name, no random suffix: this becomes /refer/sunsetinc, which
// gets read aloud, typed off a business card and printed on a van. A suffix
// like "sunsetinc-k3f9a" is unshareable in exactly those situations. Collisions
// fall back to a suffix in the retry loop below.
function generateCode(companyName, attempt = 0) {
  const base = referralCodeFor(companyName);
  return attempt === 0
    ? base
    : `${base}${Math.random().toString(36).slice(2, 5)}`;
}

async function getOrCreateReferralCode(company) {
  if (company.referralCode) return company.referralCode;

  // Small retry loop in the unlikely event of a collision on the unique code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(company.name, attempt);
    try {
      const updated = await db.company.update({
        where: { id: company.id },
        data: { referralCode: code },
      });
      return updated.referralCode;
    } catch (err) {
      if (err.code !== "P2002") throw err; // not a unique-constraint collision, rethrow
    }
  }
  throw new Error("Could not generate a unique referral code");
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });
  const referralCode = await getOrCreateReferralCode(company);

  const referred = await db.company.findMany({
    where: { referredByCode: referralCode },
    select: { id: true, name: true, onboardingStatus: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  // Credits are the truth about what was actually granted — `referred` alone
  // can't distinguish "signed up" from "paid, and you got your three months".
  const [credits, invites] = await Promise.all([
    db.referralCredit.findMany({
      where: { companyId: company.id, role: "referrer" },
      select: { counterpartyCompanyId: true, months: true, createdAt: true },
    }),
    db.referralInvite.findMany({
      where: { companyId: company.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        email: true,
        phone: true,
        channel: true,
        status: true,
        createdAt: true,
      },
    }),
  ]);

  const creditedIds = new Set(credits.map((c) => c.counterpartyCompanyId));

  return NextResponse.json({
    referralCode,
    referralUrl: `${getAppOrigin(request)}/refer/${referralCode}`,
    rewardMonths: REWARD_MONTHS,
    referred: referred.map((c) => ({
      ...c,
      // The distinction the old page couldn't make: a referral that signed up
      // but hasn't paid earns nothing yet, and saying otherwise sets up a
      // support conversation about a reward that never arrived.
      rewarded: creditedIds.has(c.id),
    })),
    monthsEarned: credits.reduce((sum, c) => sum + (c.months || 0), 0),
    rewardedCount: credits.length,
    invites,
  });
}
