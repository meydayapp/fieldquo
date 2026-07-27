// app/api/expenses/summary/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { getExpenseSummaryData } from "@/lib/analytics/expenseSummaryData";

// Powers the Expense Tracking dashboard: this month's totals, a by-category
// breakdown, a job-vs-overhead-vs-general split, a 6-month trend, and the
// burn rate (reusing your existing lib/analytics/burnRate.js — same function
// the benchmark/digest pages already use, so the numbers always agree).
export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month") || undefined; // "YYYY-MM"
  const cashOnHand = searchParams.get("cashOnHand");

  const data = await getExpenseSummaryData({
    companyId: member.companyId,
    month,
    cashOnHand: cashOnHand ? Number(cashOnHand) : undefined,
  });

  return NextResponse.json(data);
}
