// app/api/cron/availability-apply/route.js
//
// Daily, 05:00 UTC: approved availability requests whose effective date has
// arrived become the person's AvailabilitySchedule rows. A request approved
// for a date already past was applied at approval time and never reaches
// here; this is only for "takes effect Monday", so the change lands on
// Monday and not on the Wednesday it was approved.
//
// Its own route rather than a branch inside another cron: the time-clock
// watch runs every fifteen minutes and this needs to run once a day, and a
// branch in somebody else's file is the kind that gets removed with it.
// Invocation cost is noted in docs/VERCEL.md.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { applyDue } from "@/lib/availability/requests";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const result = await applyDue(new Date());
  return NextResponse.json({ ok: true, ...result });
}
