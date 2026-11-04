// app/api/settings/lead-cadence/route.js
//
// Company.leadCallsPerDay — how many times a day somebody should try to reach
// an unanswered enquiry, which is what the dashboard measures recorded
// attempts against (lib/leads/attempts.js, model LeadContactAttempt).
//
// ── Why this is a company setting and not a constant ──────────────────────
//
// The owner: "in the home we should have a reminder so it doesn't fall
// through the cracks FFM say to call 2 to 3x per day." Forward Media is
// TrueFinish's marketing AGENCY, so two to three is their playbook and not a
// FieldQuo fact. A cabinet refinisher chasing kitchen quotes and a plumber
// chasing emergencies do not want the same number, and hard-coding somebody
// else's cadence into every tenant is how a product acquires opinions nobody
// asked it for.
//
// 0 is a legal value and means "no nudge". A company that finds it nagging
// must be able to switch it off without switching off the follow-ups.
//
// GET → { callsPerDay }        anyone who can open Settings › Follow-ups
// PUT { callsPerDay } → same   owners and admins (user:manage)
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { callsPerDay } from "@/lib/leads/attempts";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const row = await db.company.findUnique({
    where: { id: member.companyId },
    select: { leadCallsPerDay: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ callsPerDay: callsPerDay(row) });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (member.impersonation) {
    return NextResponse.json({ error: "Support sessions are read-only." }, { status: 403 });
  }
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners and admins can change this." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const raw = Number(body?.callsPerDay);
  // Refused rather than clamped silently. callsPerDay() clamps on the way OUT
  // so a bad stored value can never break a screen, but on the way IN a
  // number nobody could have meant is a client bug, and quietly storing 10
  // for a typed 100 would be the setting lying about what it holds.
  if (!Number.isInteger(raw) || raw < 0 || raw > 10) {
    return NextResponse.json(
      { error: "Pick a number of calls a day between 0 and 10.", reason: "out_of_range" },
      { status: 400 },
    );
  }

  const row = await db.company.update({
    where: { id: member.companyId },
    data: { leadCallsPerDay: raw },
    select: { leadCallsPerDay: true },
  });
  await recordActivity(member, {
    action: "settings.lead_cadence",
    entityType: "company",
    entityId: member.companyId,
    summary: raw === 0
      ? "Switched off the daily reminder to chase unanswered enquiries"
      : `Set the daily target for chasing unanswered enquiries to ${raw}`,
    metadata: { callsPerDay: raw },
  });
  return NextResponse.json({ callsPerDay: callsPerDay(row) });
}
