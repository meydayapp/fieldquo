// app/api/workers/attendance/route.js
//
// Each person's last thirty days against the rota: how many published shifts
// had a FINAL verdict, and how many of those were late, no-shows or early
// outs. For the worker's card in Manage Team. Counts only — the per-shift
// rows are on the day board and the timesheet.
//
// user:view, the same gate as the roster the card sits on. A member without
// it is refused, not handed an empty object that reads as "everybody on
// time".
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { summariseAttendance } from "@/lib/shifts/attendance";

const DAYS = 30;

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  if (!can(member.role, "user:view")) {
    return NextResponse.json({ error: "Only someone who can see the roster can see attendance." }, { status: 403 });
  }
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const rows = await db.shiftAttendance.findMany({
    where: { companyId: member.companyId, final: true, shift: { start: { gte: since } } },
    select: { workerId: true, status: true, final: true },
  });
  const byWorker = {};
  for (const r of rows) (byWorker[r.workerId] ||= []).push(r);
  const summary = {};
  for (const [workerId, list] of Object.entries(byWorker)) summary[workerId] = summariseAttendance(list);
  return NextResponse.json({ days: DAYS, since: since.toISOString(), summary });
}
