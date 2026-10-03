// app/api/settings/time-activities/route.js
//
// The time clock's activities: which tiles the crew see, what each is called
// here ("Supplies" → "Supply run"), and which are paid.
//
// Read by every member — the clock screen draws its tiles from the same
// resolved policy (GET /api/time-clock carries it too). Written by owners and
// admins only, the same two seats that may change when the company pays
// (app/api/settings/pay-cycle): whether a drive or a lunch is paid is a pay
// decision, and nobody else's to make.
//
// What a change does and does not touch: the `paid` rule is stamped on each
// entry when it OPENS (TimeEntry.paid), so a change applies from the next tap
// on. Hours already worked keep the rule they were worked under — a setting
// flipped on Friday never re-prices Monday.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { resolveTimeActivities, sanitiseTimeActivities } from "@/lib/timeclock/activities";
import { recordActivity } from "@/lib/activity/log";

const canEdit = (member) => ["owner", "admin"].includes(member.role);

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { timeActivities: true },
  });
  return NextResponse.json({
    activities: resolveTimeActivities(company?.timeActivities),
    // Null before anyone saved one — the defaults apply, and the screen can
    // say so rather than presenting a default as a decision.
    configured: Boolean(company?.timeActivities),
    canEdit: canEdit(member),
  });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!canEdit(member)) {
    return NextResponse.json(
      { error: "Only an owner or admin can change the time clock's activities." },
      { status: 403 },
    );
  }
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || typeof body.activities !== "object" || body.activities === null) {
    return NextResponse.json({ error: "activities must be an object keyed by activity." }, { status: 400 });
  }
  // Sanitised before storing, never after: unknown keys, Visit switched off
  // or made unpaid, a 400-character label — dropped here, so what is stored
  // is always a policy resolveTimeActivities would have produced.
  const stored = sanitiseTimeActivities(body.activities);
  await db.company.update({
    where: { id: member.companyId },
    data: { timeActivities: stored },
  });
  await recordActivity(member, {
    action: "settings.timeActivities",
    entityType: "company",
    entityId: member.companyId,
    summary: "Changed the time clock's activities",
    summaryKey: "app.activity.event.timeActivities",
    metadata: { timeActivities: stored },
  });
  return NextResponse.json({
    activities: resolveTimeActivities(stored),
    configured: true,
    canEdit: true,
  });
}
