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
//
// ── Where the phone was ────────────────────────────────────────────────────
//
// The body may carry `stamp` — the phone's position at the tap, captured once
// by lib/location/capture.js with the OS permission prompt in front of it.
// It is recorded AFTER the entry is written, through a helper that never
// throws, and nothing about the response depends on it: a refused permission,
// a desktop browser, an old client or a malformed stamp all produce exactly
// the response this route gave before the field existed. See
// lib/location/stamps.js for what "not tracking" means here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { loadEnforceableMember } from "@/lib/permissions/enforce";
import { clockJobOptions, clockableJobWhere, dayBoundsInZone } from "@/lib/timeclock/jobChoices";
import { todayHoursFrom } from "@/lib/timeclock/todayHours";
import { recordStampIfPresent } from "@/lib/location/stamps";
import { entryHours, openBreak } from "@/lib/timeclock/entryHours";
import { BREAK_KINDS } from "@/lib/shifts/coverage";
import { recordActivity } from "@/lib/activity/log";
import { canSelfEnrol } from "@/lib/timeclock/selfEnrol";

// ── Every punch leaves a row in the activity trail ──────────────────────────
//
// Manual time entries, leave and payroll were logged; the self-serve clock —
// the door most hours actually come through — was not, so "when did Marc
// say he clocked out" had no answer but the entry itself, which a manager
// can edit. The trail is the record that survives the edit. Never throws
// (recordActivity's own contract), always after the write.
const PUNCH_KEYS = {
  in: "app.activity.event.clockIn",
  out: "app.activity.event.clockOut",
  switch: "app.activity.event.clockSwitch",
  break_start: "app.activity.event.breakStart",
  break_end: "app.activity.event.breakEnd",
};
function logPunch(member, action, { worker, entry, job, hours, kind } = {}) {
  const jobTitle = job?.title || "";
  const summaries = {
    in: `${worker.name} clocked in${jobTitle ? ` on ${jobTitle}` : ""}`,
    out: `${worker.name} clocked out${hours != null ? ` — ${hours} h` : ""}`,
    switch: `${worker.name} switched to ${jobTitle || "no job"}`,
    break_start: `${worker.name} started a ${kind === "lunch" ? "lunch" : "break"}`,
    break_end: `${worker.name} ended their break`,
  };
  return recordActivity(member, {
    action: `timeClock.${action}`,
    entityType: "timeEntry",
    entityId: entry?.id || null,
    summary: summaries[action],
    summaryKey: PUNCH_KEYS[action],
    summaryParams: { name: worker.name, job: jobTitle, hours: hours ?? "", kind: kind || "" },
    metadata: { workerId: worker.id, jobId: job?.id || entry?.jobId || null, at: new Date().toISOString() },
  });
}

// The breaks on an entry, as every read of the open entry returns them: the
// clock screen needs the running one to offer "End break", and the day board
// reads the same rows to turn the dot amber.
const BREAKS_SELECT = {
  select: { id: true, start: true, end: true, kind: true, paid: true },
  orderBy: { start: "asc" },
};
const OPEN_SELECT = {
  id: true,
  clockIn: true,
  jobId: true,
  job: { select: { id: true, title: true } },
  breaks: BREAKS_SELECT,
};

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
  breaks: BREAKS_SELECT,
};

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const worker = await myWorker(member);
  if (!worker) {
    return NextResponse.json({
      worker: null,
      // Whether the screen may offer "Set yourself up to clock in" — answered
      // by the server, since it is a permission, and a button drawn on a
      // guess is the dead control AGENTS.md forbids. See
      // lib/timeclock/selfEnrol.js for who, and why it costs no seat.
      canSelfEnrol: canSelfEnrol(member),
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
      select: OPEN_SELECT,
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
  //
  // lib/timeclock/todayHours.js, not two lines here. The clock screen has to
  // keep this same promise against a one-second heartbeat that never refetches,
  // and its copy of this arithmetic had rotted into `(todayHours || 0) + 0` —
  // a figure frozen at page load beside a timer that kept ticking. One
  // function, called from both sides, cannot disagree with itself.
  const todayHours = todayHoursFrom(today);

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
    // The job rides along for the activity row a clock-out writes.
    include: { breaks: BREAKS_SELECT, job: { select: { id: true, title: true } } },
  });

  // ── Lunch and breaks, from the clock ──────────────────────────────────────
  //
  // Recorded on the TimeEntry — what happened — never on the Shift, which is
  // the plan. One running break at a time, only while clocked in. The kind
  // is the person's to say (a lunch and a coffee are paid differently in most
  // companies); `paid` is not theirs to say and is left at the schema default,
  // because a worker marking their own lunch as paid is a pay decision made
  // on a phone in a van. A manager who disagrees amends the entry.
  if (action === "break_start") {
    if (!open) {
      return NextResponse.json({ error: "You're not clocked in." }, { status: 409 });
    }
    if (openBreak(open.breaks)) {
      return NextResponse.json({ error: "You're already on a break — end it first." }, { status: 409 });
    }
    const kind = BREAK_KINDS.includes(body?.kind) ? body.kind : "break";
    await db.timeEntryBreak.create({
      data: { timeEntryId: open.id, start: new Date(), kind },
    });
    const entry = await db.timeEntry.findUnique({ where: { id: open.id }, select: OPEN_SELECT });
    await logPunch(member, "break_start", { worker, entry, kind });
    return NextResponse.json({ ok: true, open: entry });
  }

  if (action === "break_end") {
    const running = open ? openBreak(open.breaks) : null;
    if (!open || !running) {
      return NextResponse.json({ error: "You're not on a break." }, { status: 409 });
    }
    await db.timeEntryBreak.update({ where: { id: running.id }, data: { end: new Date() } });
    const entry = await db.timeEntry.findUnique({ where: { id: open.id }, select: OPEN_SELECT });
    await logPunch(member, "break_end", { worker, entry });
    return NextResponse.json({ ok: true, open: entry });
  }

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
      select: OPEN_SELECT,
    });
    // After the write, never before it, and never able to fail it.
    await recordStampIfPresent({
      db,
      companyId: member.companyId,
      kind: "clock_in",
      stamp: body?.stamp,
      workerId: worker.id,
      timeEntryId: entry.id,
      jobId: entry.jobId,
    });
    await logPunch(member, "in", { worker, entry, job: entry.job });
    return NextResponse.json({ ok: true, open: entry });
  }

  if (action === "out") {
    if (!open) {
      return NextResponse.json({ error: "You're not clocked in." }, { status: 409 });
    }
    const clockOut = new Date();
    // A break still running is closed at the same instant — a lunch that
    // never ended would otherwise eat every hour after it. Then the same
    // arithmetic the manual clock-out uses (lib/timeclock/entryHours.js), so
    // hours are identical whichever path created them: clock-in to clock-out,
    // less the unpaid breaks. Payroll reads hours, not the timestamps.
    const running = openBreak(open.breaks);
    const breaks = (open.breaks || []).map((b) =>
      running && b.id === running.id ? { ...b, end: clockOut } : b,
    );
    const hours = entryHours(open.clockIn, clockOut, breaks);
    const ops = [];
    if (running) {
      ops.push(db.timeEntryBreak.update({ where: { id: running.id }, data: { end: clockOut } }));
    }
    ops.push(
      db.timeEntry.update({
        where: { id: open.id },
        data: { clockOut, hours },
        select: { id: true, clockIn: true, clockOut: true, hours: true, jobId: true },
      }),
    );
    const entry = (await db.$transaction(ops)).at(-1);
    await recordStampIfPresent({
      db,
      companyId: member.companyId,
      kind: "clock_out",
      stamp: body?.stamp,
      workerId: worker.id,
      timeEntryId: entry.id,
      jobId: entry.jobId,
    });
    await logPunch(member, "out", { worker, entry, job: open.job, hours });
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
        select: OPEN_SELECT,
      });
      await logPunch(member, "switch", { worker, entry, job: entry.job });
      return NextResponse.json({ ok: true, open: entry, corrected: true });
    }

    // A running break is closed with the entry it belongs to, and the hours
    // are net of the unpaid ones — the same rule as clocking out, because a
    // switch IS a clock-out at this instant.
    const running = openBreak(open.breaks);
    const closedBreaks = (open.breaks || []).map((b) =>
      running && b.id === running.id ? { ...b, end: at } : b,
    );
    const hours = entryHours(open.clockIn, at, closedBreaks);
    // One transaction: a close without its reopen leaves somebody off the clock
    // who believes they are on it, and an open without its close is two open
    // entries — the state every other path in this file refuses.
    const ops = [];
    if (running) {
      ops.push(db.timeEntryBreak.update({ where: { id: running.id }, data: { end: at } }));
    }
    ops.push(
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
        select: OPEN_SELECT,
      }),
    );
    const entry = (await db.$transaction(ops)).at(-1);
    // A switch is a clock-out and a clock-in at one instant, so the one
    // position is kept beside both — the timesheet reads each entry on its
    // own and each deserves its own answer. The mis-tap branch above records
    // nothing: the entry was re-pointed, and its original clock-in stamp
    // still says where the person was when they started.
    if (body?.stamp != null) {
      await recordStampIfPresent({
        db,
        companyId: member.companyId,
        kind: "clock_out",
        stamp: body.stamp,
        workerId: worker.id,
        timeEntryId: open.id,
        jobId: open.jobId,
      });
      await recordStampIfPresent({
        db,
        companyId: member.companyId,
        kind: "clock_in",
        stamp: body.stamp,
        workerId: worker.id,
        timeEntryId: entry.id,
        jobId: entry.jobId,
      });
    }
    await logPunch(member, "switch", { worker, entry, job: entry.job, hours });
    return NextResponse.json({ ok: true, open: entry, closedHours: hours });
  }

  return NextResponse.json(
    { error: "action must be 'in', 'out', 'switch', 'break_start' or 'break_end'" },
    { status: 400 },
  );
}
