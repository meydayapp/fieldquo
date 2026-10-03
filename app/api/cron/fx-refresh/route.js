// app/api/cron/fx-refresh/route.js
//
// Daily (vercel.json): fetch the Bank of Canada's newest USD/CAD rate (and any
// other pair lib/marketing/fx.js holds) and store it. See
// lib/marketing/fxRefresh.js. A failure is logged on /platform/errors and the
// converters keep the last good rate; this route answers 200 either way so a
// central bank's bad afternoon is not retried into a storm.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { refreshRates } from "@/lib/marketing/fxRefresh";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const results = await refreshRates();
  return NextResponse.json({ ok: results.every((r) => r.ok), results });
}
