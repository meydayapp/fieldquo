// app/api/cron/monthly-digest/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateMonthlyDigest } from "@/lib/ai/monthlyDigest";

export async function GET(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

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
      });
      results.push({ companyId, success: true, digestId: digest.id });
    } catch (err) {
      results.push({ companyId, success: false, error: err.message });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
