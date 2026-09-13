// app/api/cron/analytics-compact/route.js
//
// Nightly: fold raw analytics hits older than the retention window into the
// daily table and delete them. The ONE deletion FieldQuo performs on a
// schedule, and it deletes only its own page-view rows — never a customer's
// data. lib/analytics/product/rollup.js argues why and store.js does it:
// per UTC day, read, write distinct visitors onto AnalyticsDaily, delete
// that day's AnalyticsEvent rows, in that order, in one transaction.
//
// Runs at 03:10 UTC (vercel.json), after the previous day is fully behind
// the 30-day line whatever the visitor's timezone. Ten days per run at most:
// on a normal night it finds one; after a gap it catches up a few nights in
// a row rather than holding one function open for an hour.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { compactOlderThan } from "@/lib/analytics/product/store";
import { RAW_RETENTION_DAYS } from "@/lib/analytics/product/rollup";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  try {
    const result = await compactOlderThan(db, { now: new Date(), maxDays: 10 });
    return NextResponse.json({
      ok: true,
      keepDays: RAW_RETENTION_DAYS,
      cutoff: result.cutoff.toISOString().slice(0, 10),
      days: result.days.map((d) => ({
        day: d.day.toISOString().slice(0, 10),
        rowsRead: d.rowsRead,
        dailyWritten: d.dailyWritten,
        deleted: d.deleted,
      })),
    });
  } catch (err) {
    console.error("[cron/analytics-compact] failed:", err?.message || err);
    return NextResponse.json({ ok: false, error: err?.message || "compaction failed" }, { status: 500 });
  }
}
