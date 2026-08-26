// app/api/expenses/summary/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { getExpenseSummaryData } from "@/lib/analytics/expenseSummaryData";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";

// Powers the Expense Tracking dashboard: this month's totals, a by-category
// breakdown, a job-vs-overhead-vs-general split, a 6-month trend, and the
// burn rate (reusing your existing lib/analytics/burnRate.js — same function
// the benchmark/digest pages already use, so the numbers always agree).
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Company-wide expense totals, category breakdown, burn rate and runway.
  // /api/expenses scopes to the caller's own rows; this aggregate had no
  // scoping and no gate, so the number an employee was refused in detail was
  // handed to them as a total.
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "expenses", "view_record_edit_all")) {
    return NextResponse.json(
      { error: "You don't have access to company-wide expenses." },
      { status: 403 },
    );
  }

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
