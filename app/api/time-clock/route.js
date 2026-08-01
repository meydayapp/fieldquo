// app/api/time-clock/route.js
//
// Self-serve time clock: the logged-in person punches THEMSELVES in and out.
// The worker is resolved from the session (Worker.userId === the current user),
// never from a client-supplied id — so nobody can clock a coworker in or rack
// up hours on someone else's card. Everything writes plain TimeEntry rows, the
// same ones the manager timesheet and payroll already read; this adds no new
// pay logic and no tax/money movement — it's record-keeping only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";

// The worker record tied to the signed-in user, or null if they were never
// added under Workers (an admin has to create that link first).
async function myWorker(member) {
  return db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true, name: true, hourlyRate: true },
  });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const worker = await myWorker(member);
  if (!worker) return NextResponse.json({ worker: null, open: null, today: [], todayHours: 0 });

  const [open, today] = await Promise.all([
    db.timeEntry.findFirst({
      where: { workerId: worker.id, clockOut: null },
      orderBy: { clockIn: "desc" },
      select: { id: true, clockIn: true },
    }),
    db.timeEntry.findMany({
      where: { workerId: worker.id, clockIn: { gte: startOfToday() } },
      orderBy: { clockIn: "desc" },
      select: { id: true, clockIn: true, clockOut: true, hours: true, status: true },
    }),
  ]);

  // Today's total: booked hours on closed entries, plus live elapsed on the
  // open one so the number the person sees matches the timer ticking above it.
  let todayHours = 0;
  for (const e of today) {
    if (e.clockOut && e.hours != null) todayHours += Number(e.hours);
    else if (!e.clockOut) todayHours += (Date.now() - new Date(e.clockIn).getTime()) / 3600000;
  }
  todayHours = Math.round(todayHours * 100) / 100;

  return NextResponse.json({ worker, open, today, todayHours });
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const worker = await myWorker(member);
  if (!worker) {
    return NextResponse.json(
      { error: "You're not set up as a worker yet. Ask an admin to add you under Team → Workers." },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  const open = await db.timeEntry.findFirst({
    where: { workerId: worker.id, clockOut: null },
    orderBy: { clockIn: "desc" },
  });

  if (action === "in") {
    // One open entry at a time — the same guard the manual API enforces.
    if (open) {
      return NextResponse.json({ error: "You're already clocked in — clock out first." }, { status: 409 });
    }
    const entry = await db.timeEntry.create({
      data: { workerId: worker.id, clockIn: new Date(), status: "pending" },
      select: { id: true, clockIn: true },
    });
    return NextResponse.json({ ok: true, open: entry });
  }

  if (action === "out") {
    if (!open) {
      return NextResponse.json({ error: "You're not clocked in." }, { status: 409 });
    }
    const clockOut = new Date();
    // Same rounding the manual clock-out uses, so hours are identical whichever
    // path created them (payroll reads hours, not the timestamps).
    const hours = Math.round(((clockOut.getTime() - new Date(open.clockIn).getTime()) / 3600000) * 100) / 100;
    const entry = await db.timeEntry.update({
      where: { id: open.id },
      data: { clockOut, hours },
      select: { id: true, clockIn: true, clockOut: true, hours: true },
    });
    return NextResponse.json({ ok: true, entry });
  }

  return NextResponse.json({ error: "action must be 'in' or 'out'" }, { status: 400 });
}
