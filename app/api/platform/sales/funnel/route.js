// app/api/platform/sales/funnel/route.js
//
// Every rep's funnel for one month — nine stages from a dial to a company
// still paying at sixty days — and the CSV of the same.
//
// ══ Read-only; superadmin and platform admin ══════════════════════════════
//
// No write in this file and none coming. A funnel is a screen an "adjust"
// button gets added to because it seemed convenient, and every number here
// is derived from rows other routes own (attempts, texts, attributions,
// subscriptions). Admin reads it as well as superadmin — the owner's brief
// names both — compared on the role directly like the performance route,
// because PLATFORM_PERMISSIONS carries no key for FieldQuo's own sales
// numbers and inventing one would imply a scoping concept the map lacks.
//
//   GET ?month=YYYY-MM&rep=<id>&format=csv
//
// `month` defaults to the current UTC month; `rep` narrows the payload to
// one rep (the references beside each step are still measured over every
// rep — lib/sales/funnelData.js); `format=csv` returns the export as a file.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { loadRepFunnels } from "@/lib/sales/funnelData";
import { funnelCsv, isMonthKey, monthKeyOf, shiftMonth, BANDS, RAMP_FACTORS, STAGES, BENCHMARK_LABEL, BENCHMARK_MIN_DIALS, BENCHMARKS } from "@/lib/sales/funnelStages";

const READERS = new Set(["superadmin", "admin"]);

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!READERS.has(admin.role)) {
    return NextResponse.json({ error: "Only superadmins and platform admins can see the sales funnel" }, { status: 403 });
  }

  const url = new URL(request.url);
  const now = new Date();
  const wanted = url.searchParams.get("month");
  const monthKey = isMonthKey(wanted) ? wanted : monthKeyOf(now);
  const repId = url.searchParams.get("rep") || null;
  const format = url.searchParams.get("format") || "json";

  try {
    const [result, reps] = await Promise.all([
      loadRepFunnels({ repIds: repId ? [repId] : null, monthKey, now }),
      db.salesRep.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, code: true, active: true } }),
    ]);

    if (format === "csv") {
      const body = funnelCsv(result.funnels);
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="fieldquo-sales-funnel-${monthKey}${repId ? `-${repId}` : ""}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // The months a switcher can offer: the current one and the eleven
    // before it. A month before FieldQuo had a rep is still a month; it
    // renders as zeros, which is true of it.
    const months = [];
    for (let i = 0; i < 12; i += 1) months.push(shiftMonth(monthKeyOf(now), -i));

    return NextResponse.json({
      ...result,
      reps,
      selectedRepId: repId,
      months,
      currentMonth: monthKeyOf(now),
      stages: STAGES,
      bands: BANDS,
      rampFactors: RAMP_FACTORS,
      benchmark: { label: BENCHMARK_LABEL, minDials: BENCHMARK_MIN_DIALS, values: BENCHMARKS },
    });
  } catch (err) {
    console.error("[platform/sales/funnel] GET failed:", err);
    return NextResponse.json({ error: "Couldn't load the funnel." }, { status: 500 });
  }
}
