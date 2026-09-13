// app/api/sales/funnel/route.js
//
// The rep's own funnel for one month, and nobody else's.
//
// Through requireSalesRep — the portal's read door — and scoped by the
// session's rep id, never a query field: a rep asking for `?rep=` gets their
// own funnel regardless, the same way /api/sales/me answers about the caller.
// scripts/check-sales-funnel.mjs asserts a rep's payload holds exactly one
// funnel and that it is theirs. The references beside each step are
// measured over every rep (lib/sales/funnelData.js), which is a floor-wide
// figure and not another rep's numbers — the same thing the growth page
// prints.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { loadRepFunnels } from "@/lib/sales/funnelData";
import { isMonthKey, monthKeyOf, shiftMonth } from "@/lib/sales/funnelStages";

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const now = new Date();
  const wanted = new URL(request.url).searchParams.get("month");
  const monthKey = isMonthKey(wanted) ? wanted : monthKeyOf(now);

  try {
    const result = await loadRepFunnels({ repIds: [rep.id], monthKey, now });
    const months = [];
    for (let i = 0; i < 6; i += 1) months.push(shiftMonth(monthKeyOf(now), -i));
    return NextResponse.json({
      monthKey: result.monthKey,
      currentMonth: monthKeyOf(now),
      months,
      funnel: result.funnels.find((f) => f.rep?.id === rep.id) || null,
      generatedAt: result.generatedAt,
    });
  } catch (err) {
    console.error("[sales/funnel] GET failed:", err);
    return NextResponse.json({ error: "Couldn't load your funnel." }, { status: 500 });
  }
}
