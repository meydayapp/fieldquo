// app/api/settings/referral/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

function generateCode(companyName) {
  const base = (companyName || "fq")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "fq"}-${suffix}`;
}

async function getOrCreateReferralCode(company) {
  if (company.referralCode) return company.referralCode;

  // Small retry loop in the unlikely event of a collision on the unique code.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCode(company.name);
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

  const rewardedCount = referred.filter(
    (c) => c.onboardingStatus === "active",
  ).length;

  return NextResponse.json({
    referralCode,
    referred,
    rewardedCount,
  });
}
