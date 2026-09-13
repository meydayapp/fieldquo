// app/api/settings/leave-rules/route.js
//
// The company's limits on time off — blackout ranges, the most people off at
// once, the statutory-holiday calendar. Company.leaveRules, through
// lib/leave/rules.js.
//
// GET — read by anyone signed in: a worker picking dates needs to know that
//       Dec 15 – Jan 5 is closed before they ask, and the request form shows
//       it. PUT — owners and admins, the same gate as the leave policies.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import { effectiveHolidayRegion, normaliseLeaveRules, resolveLeaveRules } from "@/lib/leave/rules";
import { HOLIDAY_REGIONS, holidaysFor } from "@/lib/leave/statutoryHolidays";

function isLeaveAdmin(role) {
  return role === "owner" || role === "admin";
}

async function shape(companyId) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { country: true, province: true, leaveRules: true },
  });
  const rules = resolveLeaveRules(company?.leaveRules);
  const region = effectiveHolidayRegion(rules, company);
  const year = new Date().getUTCFullYear();
  return {
    rules,
    configured: Boolean(company?.leaveRules),
    // What the calendar actually follows: the stated region, else the
    // company's address. Null when neither has a table — the screen then
    // says "no holiday calendar for this country" rather than showing one.
    effectiveRegion: region.country ? region : null,
    fromAddress: !rules.holidayRegion && Boolean(region.country),
    regions: HOLIDAY_REGIONS,
    holidays: region.country
      ? [...holidaysFor({ ...region, year }), ...holidaysFor({ ...region, year: year + 1 })]
      : [],
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  return NextResponse.json(await shape(member.companyId));
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!isLeaveAdmin(member.role)) {
    return NextResponse.json({ error: "Only an owner or admin can change time-off limits." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const { rules, errors } = normaliseLeaveRules(body);
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  }
  await db.company.update({ where: { id: member.companyId }, data: { leaveRules: rules } });
  await recordActivity(member, {
    action: "settings.leaveRules",
    entityType: "settings",
    summary: `Time-off limits changed: ${rules.blackouts.length} blackout range(s), ${rules.maxConcurrent == null ? "no limit" : `${rules.maxConcurrent} off at once`}${rules.holidayRegion ? `, holidays ${rules.holidayRegion.country}${rules.holidayRegion.province ? "-" + rules.holidayRegion.province : ""}` : ""}`,
    summaryKey: "app.activity.event.leaveRulesChanged",
    summaryParams: { blackouts: rules.blackouts.length, max: rules.maxConcurrent ?? "" },
    metadata: { rules },
  });
  return NextResponse.json(await shape(member.companyId));
}
