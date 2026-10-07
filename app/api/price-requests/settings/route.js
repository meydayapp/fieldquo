// app/api/price-requests/settings/route.js
//
// The one setting the price-request flow has: after how many days a sub who
// has not answered gets ONE reminder (the owner, 2026-10-06: "default on, 3
// days"). 0 turns it off. Read by the daily follow-ups cron
// (lib/subRequests/server.js runPriceRequestReminders). Shown and set on the
// Subcontractors page, where the subs it emails are managed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, permissionErrorResponse } from "@/lib/permissions/enforce";
import { requireSubcontractorRead, requireSubcontractorWrite } from "@/lib/subcontractors/access";
import { parseReminderDays } from "@/lib/subRequests/model";

async function gate(member, write) {
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireSubcontractorRead(full);
    if (write) requireSubcontractorWrite(full);
    return null;
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = await gate(member, false);
  if (denied) return denied;
  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { subRequestReminderDays: true } });
  return NextResponse.json({ reminderDays: company?.subRequestReminderDays ?? 3 });
}

export async function PATCH(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!member.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const denied = await gate(member, true);
  if (denied) return denied;
  const body = await request.json().catch(() => null);
  const days = parseReminderDays(body?.reminderDays);
  if (days === null) return NextResponse.json({ error: "Pick a number of days from 0 (off) to 30." }, { status: 400 });
  await db.company.update({ where: { id: member.companyId }, data: { subRequestReminderDays: days } });
  return NextResponse.json({ reminderDays: days });
}
