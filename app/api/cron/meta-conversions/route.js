// app/api/cron/meta-conversions/route.js
//
// "Send lead results to Meta", every fifteen minutes: sweep each switched-on
// company's last 35 days into the outbox, then send what is due. The work is
// lib/meta/capi/run.js; the daily catch-up is app/api/cron/meta-conversions-daily.
// Gated like every cron by requireCronSecret.
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { runMetaConversions } from "@/lib/meta/capi/run";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  return NextResponse.json(await runMetaConversions(db, { daily: false }));
}
