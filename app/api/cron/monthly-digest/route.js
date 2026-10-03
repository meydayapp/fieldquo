// app/api/cron/monthly-digest/route.js
//
// 08:00 UTC on the 1st (vercel.json): last month's summary email for every
// active company, to its active owners and admins. See lib/ai/monthlyDigest.js.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { generateMonthlyDigest } from "@/lib/ai/monthlyDigest";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError, errorDetail } from "@/lib/platform/errorLog";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  const now = new Date();
  // Last month, on the UTC calendar — the month lib/analytics/monthlySummaryData.js
  // reports (monthRange's definition). Built in UTC rather than the server's
  // local clock so a run on a developer's machine reports the same month.
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 1000);
  // The email's buttons are absolute links into the app.
  const origin = getAppOrigin(request);

  const companies = await db.company.findMany({
    where: { onboardingStatus: "active" },
    select: { id: true },
  });

  const results = [];

  for (const { id: companyId } of companies) {
    try {
      const digest = await generateMonthlyDigest({
        companyId,
        periodStart,
        periodEnd,
        origin,
        asOf: now,
      });
      results.push({ companyId, success: true, digestId: digest.id });
    } catch (err) {
      results.push({ companyId, success: false, error: err.message });
      // A summary that silently fails to arrive is invisible everywhere else:
      // the cron's JSON response is read by nobody.
      await recordError({
        area: "cron",
        code: "monthly_digest_failed",
        message: `Monthly summary was not sent: ${err.message}`,
        companyId,
        detail: errorDetail(err, { periodStart, periodEnd }),
      });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
