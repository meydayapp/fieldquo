// app/api/daily-sheets/week/route.js
//
// GET ?workerId=&weekOf=YYYY-MM-DD — one person's week: hours, objectives
// done, upsells, average score and the bonus total, day by day. Same scope
// rule as the day view: a crew member can ask only about themselves.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { sheetScope } from "@/lib/dailySheets/access";
import { ownWorker, companyTimezone } from "@/lib/dailySheets/load";
import { weekStartKey, weekKeys, dateKeyToColumn, dayInstants, columnToDateKey, todayKey } from "@/lib/dailySheets/day";
import { weeklySummary } from "@/lib/dailySheets/weekly";
import { zonedYmd } from "@/lib/booking/timezone";
import { DEFAULT_TIMEZONE } from "@/lib/time/wallClock";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const full = await loadEnforceableMember(db, member.id);
  const mine = await ownWorker(member);
  const scope = sheetScope(full, mine?.id || null);
  if (scope === null) return NextResponse.json({ error: "No crew record for you yet." }, { status: 403 });

  const timezone = (await companyTimezone(member.companyId)) || DEFAULT_TIMEZONE;
  const { searchParams } = new URL(request.url);
  const workerId = scope.workerId || searchParams.get("workerId") || mine?.id;
  if (!workerId) return NextResponse.json({ error: "workerId is required" }, { status: 400 });
  if (scope.workerId && workerId !== scope.workerId) {
    return NextResponse.json({ error: "You can only see your own week." }, { status: 403 });
  }
  const worker = await db.worker.findFirst({ where: { id: workerId, companyId: member.companyId }, select: { id: true, name: true } });
  if (!worker) return NextResponse.json({ error: "Worker not found" }, { status: 404 });

  const monday = weekStartKey(searchParams.get("weekOf") || todayKey(timezone));
  if (!monday) return NextResponse.json({ error: "weekOf must be YYYY-MM-DD" }, { status: 400 });
  const keys = weekKeys(monday);
  const first = dayInstants(keys[0], timezone);
  const last = dayInstants(keys[6], timezone);

  const [sheets, entries] = await Promise.all([
    db.dailyObjectiveSheet.findMany({
      where: { companyId: member.companyId, workerId, date: { gte: dateKeyToColumn(keys[0]), lte: dateKeyToColumn(keys[6]) } },
    }),
    db.timeEntry.findMany({
      where: { workerId, clockIn: { gte: first.start, lt: last.next } },
      select: { clockIn: true, clockOut: true, hours: true },
    }),
  ]);
  const dayKeyOf = (e) => {
    const { year, month, day } = zonedYmd(new Date(e.clockIn), timezone);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  const summary = weeklySummary({
    sheets: sheets.map((s) => ({ ...s, dateKey: columnToDateKey(s.date) })),
    entries,
    dayKeys: keys,
    dayKeyOf,
  });
  return NextResponse.json({ worker, weekOf: monday, ...summary });
}
