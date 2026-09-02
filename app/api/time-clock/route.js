// app/api/time-clock/route.js
//
// Self-serve time clock: the logged-in person punches THEMSELVES in and out.
// The worker is resolved from the session (Worker.userId === the current user),
// never from a client-supplied id — so nobody can clock a coworker in or rack
// up hours on someone else's card. Everything writes plain TimeEntry rows, the
// same ones the manager timesheet and payroll already read; this adds no new
// pay logic and no tax/money movement — it's record-keeping only.
//
// ── Which job the hour belongs to ──────────────────────────────────────────
//
// This route used to write no `jobId` at all. Payroll never noticed, because it
// groups by worker; job costing did, because it reads
// `where: { jobId: job.id }` — so every hour a crew member punched on their own
// phone was missing from the labour cost of the job they worked. See
// lib/timeclock/jobChoices.js for what gets offered and what gets defaulted,
// and lib/costing/unattributedHours.js for what happens to the hours that
// legitimately have no job.
//
// The job stays OPTIONAL. Travel, the yard and a morning of quoting are real
// hours with no job, and a mandatory field would produce invented attributions
// rather than better ones.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { clockJobOptions, clockableJobWhere, dayBoundsInZone } from "@/lib/timeclock/jobChoices";

// The worker record tied to the signed-in user, or null if they were never
// added under Workers (an admin has to create that link first).
async function myWorker(member) {
  return db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true, name: true, hourlyRate: true },
  });
}

// The company's zone decides where "today" starts, not the server's. Midnight
// UTC on Vercel is 8pm the previous evening in Toronto, so a server-local day
// put a 7am punch on the wrong date and looked for the wrong day's visits.
// Same argument lib/time/wallClock.js makes for manual entries.
async function companyTimezone(companyId) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { timezone: true },
  });
  return company?.timezone || null;
}

// What today's entries are shown with. `job` is selected so the list on the
// clock screen can say which job each punch went to — a picker whose result you
// cannot see afterwards is a control you cannot tell is working.
const ENTRY_SELECT = {
  id: true,
  clockIn: true,
  clockOut: true,
  hours: true,
  status: true,
  jobId: true,
  job: { select: { id: true, title: true } },
};

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const worker = await myWorker(member);
  if (!worker) {
    return NextResponse.json({
      worker: null,
      open: null,
      today: [],
      todayHours: 0,
      jobOptions: [],
      todayCount: 0,
      suggestedJobId: null,
      truncated: false,
    });
  }

  const [full, timezone] = await Promise.all([
    loadEnforceableMember(db, member.id),
    companyTimezone(member.companyId),
  ]);
  const now = new Date();
  const { start } = dayBoundsInZone(now, timezone);

  const [open, today, choices] = await Promise.all([
    db.timeEntry.findFirst({
      where: { workerId: worker.id, clockOut: null },
      orderBy: { clockIn: "desc" },
      select: { id: true, clockIn: true, jobId: true, job: { select: { id: true, title: true } } },
    }),
    db.timeEntry.findMany({
      where: { workerId: worker.id, clockIn: { gte: start } },
      orderBy: { clockIn: "desc" },
      select: ENTRY_SELECT,
    }),
    clockJobOptions(db, {
      companyId: member.companyId,
      full,
      userId: member.userId,
      now,
      timezone,
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

  return NextResponse.json({
    worker,
    open,
    today,
    todayHours,
    jobOptions: choices.options,
    // How many DISTINCT jobs this person is scheduled at today. The screen
    // needs the count, not just the suggestion: "you have three visits today,
    // pick one" is a different sentence from "you have none", and a null
    // suggestion alone cannot tell them apart.
    todayCount: choices.todayCount,
    suggestedJobId: choices.suggestedJobId,
    truncated: choices.truncated,
  });
}

/**
 * Prove the job an hour is being booked against is one this person may book to.
 *
 * The `where` comes from lib/timeclock/jobChoices.js — the SAME object the GET
 * above builds its picker from, so the server cannot accept a job the screen
 * never offered or refuse one it did. `companyId` lives inside it: a time entry
 * booked against another tenant's jobId lands in THEIR job costing, which is a
 * cross-tenant WRITE and silent on both sides (the same failure
 * lib/tenant/ownedIds.js exists to stop on the manual route).
 *
 * Returns `{ jobId }` on success — null jobId included, since "no job" is a
 * legitimate answer and not an error.
 */
async function resolveJobId(rawJobId, member, full) {
  if (rawJobId === undefined || rawJobId === null || rawJobId === "") {
    return { jobId: null };
  }
  if (typeof rawJobId !== "string") {
    return { error: "That job isn't one you can record time against.", status: 400 };
  }
  const job = await db.job.findFirst({
    where: clockableJobWhere({ companyId: member.companyId, full, jobId: rawJobId }),
    select: { id: true },
  });
  if (!job) {
    return { error: "That job isn't one you can record time against.", status: 400 };
  }
  return { jobId: job.id };
}

/**
 * Below this, a "switch" re-points the open entry instead of splitting it.
 *
 * Somebody who taps Clock in, sees the wrong job on screen and fixes it ten
 * seconds later has not worked a shift on the first job. Splitting would close
 * a 0.00h entry against it — a row on a timesheet somebody has to approve, that
 * says a thing which did not happen. A minute is comfortably longer than a
 * mis-tap and comfortably shorter than any real stretch of work.
 */
const MISTAP_WINDOW_MS = 60_000;

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

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
    const full = await loadEnforceableMember(db, member.id);
    const resolved = await resolveJobId(body?.jobId, member, full);
    if (resolved.error) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const entry = await db.timeEntry.create({
      data: {
        workerId: worker.id,
        clockIn: new Date(),
        status: "pending",
        // Explicitly null rather than omitted when there is no job: the column
        // is nullable on purpose and "this hour belongs to no job" is a
        // statement the row should make, not an absence of one.
        jobId: resolved.jobId,
      },
      select: { id: true, clockIn: true, jobId: true, job: { select: { id: true, title: true } } },
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
      select: { id: true, clockIn: true, clockOut: true, hours: true, jobId: true },
    });
    return NextResponse.json({ ok: true, entry });
  }

  // ── Moving to a second job without going off the clock ────────────────────
  //
  // The manual API's rule is one open entry per worker, and this keeps it: a
  // switch CLOSES the current entry at this instant and opens a new one on the
  // new job at the same instant. It does not re-point the hours already worked,
  // which is the thing that would be a lie — a morning on the Tremblay job does
  // not become a morning on the Chen job because that is where you are at
  // noon. The one exception is the mis-tap window above.
  //
  // Clocking out and back in by hand does exactly the same thing. This exists
  // because the version people actually do in a van is neither — they stay
  // clocked in and the whole day lands on the first job.
  if (action === "switch") {
    if (!open) {
      return NextResponse.json({ error: "You're not clocked in." }, { status: 409 });
    }
    const full = await loadEnforceableMember(db, member.id);
    const resolved = await resolveJobId(body?.jobId, member, full);
    if (resolved.error) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    if ((open.jobId || null) === resolved.jobId) {
      return NextResponse.json(
        { error: "You're already clocked in on that job." },
        { status: 409 },
      );
    }

    const at = new Date();
    const elapsedMs = at.getTime() - new Date(open.clockIn).getTime();

    if (elapsedMs < MISTAP_WINDOW_MS) {
      const entry = await db.timeEntry.update({
        where: { id: open.id },
        data: { jobId: resolved.jobId },
        select: { id: true, clockIn: true, jobId: true, job: { select: { id: true, title: true } } },
      });
      return NextResponse.json({ ok: true, open: entry, corrected: true });
    }

    const hours = Math.round((elapsedMs / 3600000) * 100) / 100;
    // One transaction: a close without its reopen leaves somebody off the clock
    // who believes they are on it, and an open without its close is two open
    // entries — the state every other path in this file refuses.
    const [, entry] = await db.$transaction([
      db.timeEntry.update({
        where: { id: open.id },
        data: { clockOut: at, hours },
      }),
      db.timeEntry.create({
        data: {
          workerId: worker.id,
          clockIn: at,
          status: "pending",
          jobId: resolved.jobId,
        },
        select: { id: true, clockIn: true, jobId: true, job: { select: { id: true, title: true } } },
      }),
    ]);
    return NextResponse.json({ ok: true, open: entry, closedHours: hours });
  }

  return NextResponse.json({ error: "action must be 'in', 'out' or 'switch'" }, { status: 400 });
}
