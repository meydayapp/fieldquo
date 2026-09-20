// app/api/cron/google-calendar-reconcile/route.js
//
// Every connected member, brought into step with Google once an hour
// (vercel.json). Creates what is missing, updates what drifted, deletes what
// FieldQuo created and should not exist any more — and is the floor under
// the write paths the sync cannot hook directly (the public booking confirm
// route and the fee settlement, which belong to another agent's files). A
// web-booked visit reaches the assignee's phone at this run at the latest.
//
// Hourly rather than nightly because that floor is the ordinary path for a
// homeowner booking from the website, and "tomorrow morning" is too late
// for a visit booked for this afternoon. Cheap when nothing changed: one
// schedule read and one mirror read per member, and no Google request at
// all for an unchanged event (lib/calendar/googleSync.js payloadHash).
export const runtime = "nodejs";
export const maxDuration = 300;

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { googleCalendarConfigured } from "@/lib/calendar/googleClient";
import { reconcileAll } from "@/lib/calendar/googleSync";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  if (!googleCalendarConfigured()) {
    return NextResponse.json({ success: true, skipped: "not_configured" });
  }
  const summary = await reconcileAll();
  return NextResponse.json({ success: true, ...summary });
}
