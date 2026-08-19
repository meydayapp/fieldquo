// app/api/settings/referral/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { getAppOrigin } from "@/lib/appUrl";
import { referralCodeFor, REFEREE_BONUS_MONTHS } from "@/lib/referrals";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";

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

// Owner/admin only, matching the POST on /invite next door.
//
// This GET had no role gate, so any employee could read the names of every
// company their employer had referred, which of them had paid, and the running
// credit balance — other companies' commercial relationships, from an account
// that couldn't even send an invite.
//
// Impersonation is allowed through: role "viewer" holds nothing, and a support
// session that couldn't see the referral ledger it is being asked about would
// break non-negotiable #3. Writes are refused for it separately in
// getCurrentMember, and the only write here is the code generation below, which
// is skipped for the same reason.
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!member.impersonation && !isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const company = await db.company.findUnique({
    where: { id: member.companyId },
  });

  // A support session never MINTS the code. getOrCreateReferralCode writes a
  // row, and the impersonation gate in getCurrentMember only blocks non-GET
  // methods — so a platform admin merely opening this page used to create a
  // referral code inside a customer's tenant. That is exactly the "view
  // everything, edit nothing" line in non-negotiable #3. A company that has
  // never had one reads as null here instead, and the page shows nothing to
  // copy, which is the truth.
  const referralCode = member.impersonation
    ? company?.referralCode || null
    : await getOrCreateReferralCode(company);

  // Guarded on referralCode being a real string. `where: { referredByCode:
  // null }` does not mean "nobody" to Prisma — it matches every company that
  // has no referrer, in every tenant, and would hand the whole list back. The
  // null case only became reachable with the impersonation branch above, which
  // is precisely why it is checked here rather than assumed away.
  const referred = referralCode
    ? await db.company.findMany({
        where: { referredByCode: referralCode },
        select: { id: true, name: true, onboardingStatus: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Credits are the truth about what was actually granted — `referred` alone
  // can't distinguish "signed up" from "paid, and you earned your credit".
  const [credits, invites] = await Promise.all([
    db.referralCredit.findMany({
      where: { companyId: company.id, role: "referrer" },
      select: { counterpartyCompanyId: true, creditCents: true, createdAt: true },
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
    // Null rather than ".../refer/null" when no code exists yet — see above.
    referralUrl: referralCode
      ? `${getAppOrigin(request)}/refer/${referralCode}`
      : null,
    // What the NEW company gets for signing up through the link.
    refereeBonusMonths: REFEREE_BONUS_MONTHS,
    // The referrer bills in their own currency; the credit is denominated in it.
    currency: company.currency || "CAD",
    referred: referred.map((c) => ({
      ...c,
      // The distinction the old page couldn't make: a referral that signed up
      // but hasn't paid (and verified) earns nothing yet, and saying otherwise
      // sets up a support conversation about a reward that never arrived.
      rewarded: creditedIds.has(c.id),
    })),
    // Total account credit earned so far, in cents (one month of each referred
    // company's plan). Bigger teams referred → bigger credit.
    creditEarnedCents: credits.reduce((sum, c) => sum + (c.creditCents || 0), 0),
    rewardedCount: credits.length,
    invites,
  });
}
