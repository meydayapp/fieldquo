// app/api/cron/monthly-digest/route.js
//
// 08:00 UTC on the 1st (vercel.json): last month's summary email for every
// company in the audience, to its active owners and admins. See
// lib/ai/monthlyDigest.js for the letter and lib/ai/digestAudience.js for WHO.
//
// The audience used to be `onboardingStatus: "active"`, which only Stripe
// Checkout ever writes — so every card-free trial (all new companies since
// 2026-09-29) was left out. It is now the access rules themselves
// (lib/billing/access.js), read through digestAudience, and a trial whose
// month had nothing in it is skipped rather than sent a page of zeros.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { generateMonthlyDigest } from "@/lib/ai/monthlyDigest";
import { DIGEST_AUDIENCE_SELECT, digestAudience, digestAudienceWhere } from "@/lib/ai/digestAudience";
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

  const candidates = await db.company.findMany({
    where: digestAudienceWhere(now),
    select: DIGEST_AUDIENCE_SELECT,
  });

  const results = [];
  const skipped = {};
  const note = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };

  for (const company of candidates) {
    const verdict = digestAudience(company, { periodEnd, now });
    if (!verdict.send) { note(verdict.reason); continue; }
    const companyId = company.id;
    try {
      const digest = await generateMonthlyDigest({
        companyId,
        periodStart,
        periodEnd,
        origin,
        asOf: now,
        // A trial's empty month is skipped (lib/ai/digestAudience.js).
        skipWhenEmpty: verdict.trial,
      });
      if (digest?.skipped) { note(digest.skipped); continue; }
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

  return NextResponse.json({ considered: candidates.length, processed: results.length, skipped, results });
}
