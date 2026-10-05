// app/api/cron/meta-conversions-daily/route.js
//
// "Send lead results to Meta", the daily catch-up. Meta asks for CRM stages
// to be uploaded at least once a day; this run is that guarantee even on a
// day every quarter-hour run failed. Same sweep, and the due queue drained in
// up to five passes. The work is lib/meta/capi/run.js.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { runMetaConversions } from "@/lib/meta/capi/run";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  return NextResponse.json(await runMetaConversions(db, { daily: true }));
}
