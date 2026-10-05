// app/api/cron/urgent-alerts/route.js
//
// Every two minutes. Moves each open urgent alert up its on-call ladder:
// nobody pressed "I've got it" within the company's ackTimeoutMinutes → the
// next person is texted; after the last, the alert is "exhausted" and the
// owner and admins get the bell (lib/aiEmployee/urgentAlerts.js
// advanceUrgentAlerts).
//
// Two minutes, not fifteen, because the wait is the company's own setting
// (two minutes at the shortest) and a ten-minute promise kept at twenty-four
// is not the promise the owner set. Bounded: ESCALATION_BATCH alerts a run,
// oldest due first; a run with nothing due is one indexed query.
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { advanceUrgentAlerts } from "@/lib/aiEmployee/urgentAlerts";
import { loadCompanySettings } from "@/lib/aiEmployee/companySettings";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const result = await advanceUrgentAlerts({ prisma: db, now: new Date(), loadSettings: loadCompanySettings });
  return NextResponse.json({ success: true, ...result });
}
