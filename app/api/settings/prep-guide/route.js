// app/api/settings/prep-guide/route.js
//
// The company-wide rule for the client preparation guide: how many days
// before a job's start date it goes out. One integer, 0–30, default 3.
//
//   GET    { leadDays }
//   PATCH  { leadDays }  →  { leadDays }
//
// Read by app/api/cron/prep-guides through lib/prepGuide/schedule.js; this
// route is the only writer. Settings > Services renders it as the sentence
// "sent {N} days before the start date; 0 = the morning of".

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { clampLeadDays, MAX_LEAD_DAYS } from "@/lib/prepGuide/schedule";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { prepGuideLeadDays: true },
  });
  return NextResponse.json({ leadDays: clampLeadDays(company?.prepGuideLeadDays), maxLeadDays: MAX_LEAD_DAYS });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json({ error: "Only owners and admins can change this." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const raw = body?.leadDays;
  const n = Number(raw);
  if (raw === undefined || raw === null || raw === "" || !Number.isFinite(n)) {
    return NextResponse.json({ error: "Send the number of days, 0 to 30." }, { status: 400 });
  }
  const leadDays = clampLeadDays(n);

  const company = await db.company.update({
    where: { id: member.companyId },
    data: { prepGuideLeadDays: leadDays },
    select: { prepGuideLeadDays: true },
  });
  await recordActivity(member, {
    action: "settings.prep_guide.updated",
    entityType: "company",
    entityId: member.companyId,
    summary: `Preparation guide now goes out ${leadDays} day${leadDays === 1 ? "" : "s"} before the start date`,
    summaryKey: "app.activity.event.prepGuideLeadDays",
    summaryParams: { days: leadDays },
  });
  return NextResponse.json({ leadDays: company.prepGuideLeadDays, maxLeadDays: MAX_LEAD_DAYS });
}
