// app/api/platform/fx-health/route.js
//
// Is the automatic exchange-rate update working — and if not, how long has it
// been failing, and when do conversions stop?
//
// Since 2026-10-03 the rate is fetched daily (app/api/cron/fx-refresh →
// lib/marketing/fxRefresh.js) and stored as ExchangeRate rows; the converters
// read the newest one and fall back to the checked-in rate in
// lib/marketing/fx.js (lib/marketing/fxLive.js). So the banner this feeds on
// /platform means two things, in order of how bad they are:
//
//   red    the rate in use is past fx.js's 45-day window: converted ad spend is
//          being LEFT OUT of every affected company's marketing totals.
//   amber  the automatic update has not succeeded for N days (or has never
//          run — e.g. the ExchangeRate table has not been created yet).
//          Conversions continue on the last good rate; the date it stops
//          converting is stated.
//
// Each failed fetch is also a row on /platform/errors (fx_refresh_failed) with
// the reason. Reads only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { rateHealth } from "@/lib/marketing/fx";
import { loadLiveRates, refreshHealth } from "@/lib/marketing/fxLive";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const live = await loadLiveRates({ asOf: now, useCache: false });
  const inUse = rateHealth(now, live.rates);
  const updates = refreshHealth({ stored: live.stored, asOf: now });

  const problems = [];
  for (const u of updates) {
    const r = inUse.find((x) => x.pair === u.pair);
    if (r?.state === "refused") {
      problems.push(
        `${u.pair}: the rate in use (${r.rate}, for ${r.rateDate}) is ${r.ageDays} days old and no longer converts. Ad spend in that currency is being left out of every affected company's marketing totals.`,
      );
      continue;
    }
    if (!u.failing) continue;
    const stops = r?.stopsOn ? ` Conversions continue on the rate for ${r.rateDate} until ${r.stopsOn}.` : "";
    if (u.neverRan) {
      problems.push(
        `${u.pair}: the automatic exchange-rate update has not stored a rate yet${live.error ? ` (the ExchangeRate table could not be read: ${String(live.error).split("\n")[0].slice(0, 140)})` : ""}.${stops}`,
      );
    } else {
      problems.push(`${u.pair}: the automatic exchange-rate update has failed for ${u.daysSinceFetch} days (last success ${u.lastFetchedAt.slice(0, 10)}).${stops}`);
    }
  }

  return NextResponse.json({
    healthy: problems.length === 0,
    refused: inUse.some((r) => r.state === "refused"),
    rates: inUse.map((r) => ({ ...r, live: Boolean(live.rates.find((x) => `${x.base}/${x.quote}` === r.pair)?.live) })),
    updates,
    problems,
    remedy:
      "Check /platform/errors for fx_refresh_failed (the reason is in each row) and /api/cron/fx-refresh's schedule in vercel.json. The checked-in rate in lib/marketing/fx.js is the fallback while it is down.",
  });
}
