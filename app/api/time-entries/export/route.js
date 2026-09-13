// app/api/time-entries/export/route.js
//
// The raw timesheet as CSV: one row per time entry — worker, title, date,
// in, out, unpaid and paid break minutes, net hours, job, status, who
// approved it, and how far from the site the phone was at clock-in when it
// answered. The accountant's file, the "send me the hours" file, the file
// a payroll bureau asks for.
//
// GET /api/time-entries/export?from=YYYY-MM-DD&to=YYYY-MM-DD[&workerId=…]
//
// ── Gated like the timesheet, not like the list ─────────────────────────────
//
// GET /api/time-entries answers a restricted member with their OWN rows; this
// answers with a file of everybody's, so it asks the level the Timesheets
// page itself sits behind — timeTracking at view_record_edit_all
// (lib/permissions/nav.js) — and refuses below it rather than exporting a
// narrower file that looks like the whole company's.
//
// ── No rate, no money ────────────────────────────────────────────────────────
//
// Hours, not pay. The hourly rate is payroll data behind its own gate
// (canSeeAllPay) and a CSV that carried it would leave the building in
// every email the file is attached to. Anyone who needs pay has the pay run.
//
// Cells go through lib/export/accountingExport.js's csvCell: RFC 4180
// quoting plus the formula guard, because a job title typed as "=HYPERLINK"
// is a job title, not a formula.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { csvCell } from "@/lib/export/accountingExport";
import { unpaidBreakMs } from "@/lib/timeclock/entryHours";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 20_000;

const HEADER = [
  "worker",
  "title",
  "date",
  "clock_in",
  "clock_out",
  "unpaid_break_minutes",
  "paid_break_minutes",
  "net_hours",
  "job",
  "status",
  "approved_by",
  "clock_in_distance_m",
  "attendance",
];

/** Wall-clock parts of an instant in a zone, for the date / in / out cells. */
function parts(instant, timeZone) {
  if (!instant) return { date: "", time: "" };
  try {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const p = Object.fromEntries(f.formatToParts(new Date(instant)).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour === "24" ? "00" : p.hour}:${p.minute}` };
  } catch {
    const d = new Date(instant).toISOString();
    return { date: d.slice(0, 10), time: d.slice(11, 16) };
  }
}

function paidBreakMinutes(breaks, clockIn, clockOut) {
  const s = new Date(clockIn).getTime();
  const e = clockOut ? new Date(clockOut).getTime() : Date.now();
  let total = 0;
  for (const b of breaks || []) {
    if (b.paid !== true) continue;
    const bs = new Date(b.start).getTime();
    const be = b.end ? new Date(b.end).getTime() : e;
    const from = Math.max(bs, s);
    const to = Math.min(be, e);
    if (to > from) total += to - from;
  }
  return Math.round(total / 60_000);
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "timeTracking", "view_record_edit_all")) {
    return NextResponse.json(
      { error: "Only someone who can review everyone's hours can export the timesheet." },
      { status: 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const workerId = searchParams.get("workerId") || null;
  if (!ISO_DAY.test(from) || !ISO_DAY.test(to) || to < from) {
    return NextResponse.json({ error: "from and to must be YYYY-MM-DD, with to on or after from." }, { status: 400 });
  }
  if (workerId) {
    const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { workerId });
    if (notOurs) return notOurs;
  }

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { timezone: true } });
  const timeZone = company?.timezone || "America/Toronto";
  // The range is calendar days in the company's zone; the query takes a
  // generous UTC window and the rows are filtered by their zoned date below,
  // so a 23:30 clock-in on the last day is in and a 00:30 one the day after
  // is out, whatever the server's clock says.
  const lo = new Date(`${from}T00:00:00Z`);
  lo.setUTCDate(lo.getUTCDate() - 1);
  const hi = new Date(`${to}T00:00:00Z`);
  hi.setUTCDate(hi.getUTCDate() + 2);

  const entries = await db.timeEntry.findMany({
    where: {
      worker: { companyId: member.companyId },
      ...(workerId ? { workerId } : {}),
      clockIn: { gte: lo, lt: hi },
    },
    orderBy: [{ clockIn: "asc" }],
    take: MAX_ROWS,
    select: {
      id: true,
      workerId: true,
      clockIn: true,
      clockOut: true,
      hours: true,
      status: true,
      worker: { select: { name: true, title: true } },
      job: { select: { title: true } },
      approvedBy: { select: { name: true, email: true } },
      breaks: { select: { start: true, end: true, paid: true } },
      locationStamps: { where: { kind: "clock_in" }, select: { distanceToSiteM: true }, take: 1 },
    },
  });

  // The attendance verdict for the shift each entry belongs to, when the
  // cron has written one — matched by worker and the entry's zoned date.
  const workerIds = [...new Set(entries.map((e) => e.workerId))];
  const attendance = workerIds.length
    ? await db.shiftAttendance.findMany({
        where: { companyId: member.companyId, workerId: { in: workerIds }, shift: { start: { gte: lo, lt: hi } } },
        select: { workerId: true, status: true, shift: { select: { start: true } } },
      })
    : [];
  const attendanceKey = (w, day) => `${w}|${day}`;
  const attendanceByDay = new Map(attendance.map((a) => [attendanceKey(a.workerId, parts(a.shift.start, timeZone).date), a.status]));

  const rows = [];
  for (const e of entries) {
    const inParts = parts(e.clockIn, timeZone);
    if (inParts.date < from || inParts.date > to) continue;
    const outParts = parts(e.clockOut, timeZone);
    rows.push(
      [
        e.worker?.name || "",
        e.worker?.title || "",
        inParts.date,
        inParts.time,
        e.clockOut ? `${outParts.date === inParts.date ? "" : `${outParts.date} `}${outParts.time}` : "",
        e.clockOut ? Math.round(unpaidBreakMs(e.breaks, e.clockIn, e.clockOut) / 60_000) : "",
        e.clockOut ? paidBreakMinutes(e.breaks, e.clockIn, e.clockOut) : "",
        e.hours == null ? "" : Number(e.hours),
        e.job?.title || "",
        e.status,
        e.status === "approved" ? e.approvedBy?.name || e.approvedBy?.email || "" : "",
        e.locationStamps?.[0]?.distanceToSiteM ?? "",
        attendanceByDay.get(attendanceKey(e.workerId, inParts.date)) || "",
      ]
        .map(csvCell)
        .join(","),
    );
  }

  const csv = [HEADER.join(","), ...rows].join("\r\n") + "\r\n";
  const suffix = workerId ? `_${workerId.slice(0, 8)}` : "";
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="timesheet_${from}_${to}${suffix}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
