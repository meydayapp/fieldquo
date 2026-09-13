// app/api/shifts/route.js
//
// Shift scheduling. A manager (user:manage) drafts and publishes shifts; a
// worker sees only their OWN published shifts — a half-built week never lands on
// someone's phone. Pure scheduling: no pay, no money movement.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { auditCreatedShifts } from "@/lib/shifts/shiftNotify";
import { managerExtras, workerExtras } from "@/lib/shifts/boardExtras";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { assessShiftFit } from "@/lib/scheduling/loadShiftFit";
import {
  workersMissingHours,
  availabilityWindowsBetween,
} from "@/lib/scheduling/shiftFit";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { localYmd, validateBreaks } from "@/lib/shifts/coverage";
import { hasBusinessHours, normaliseHours } from "@/lib/company/businessHours";
import { openShiftEligible } from "@/lib/shiftRequests/eligibility";

// What a job contributes to a block's label: the client, the SITE address and
// the title. siteAddress, never client.address — the schema is explicit that a
// null site means "not asked", and a property manager's billing office is not
// where the crew should be sent. A job with no site shows no address at all.
// (There is no job number in the schema; nothing here invents one.)
const JOB_SELECT = {
  id: true,
  title: true,
  siteAddress: true,
  siteCity: true,
  client: { select: { name: true } },
};

// Every read of a shift carries its breaks. One select shape, because the day
// board, the week list and the worker's own view must not disagree about
// whether a lunch exists.
const BREAKS_SELECT = {
  select: { id: true, start: true, end: true, kind: true, paid: true },
  orderBy: { start: "asc" },
};

// ── What the day board needs beside the shifts ──────────────────────────────
//
// The board draws three things the week list never did: approved leave as a
// full-row OUT block, the hours a person has NOT said they are available for
// as grey cells, and the company's opening hours as the axis. All three are
// answered from the same rows the create route already consults
// (lib/scheduling/loadShiftFit.js), so what the board draws grey is exactly
// what the route would refuse — a board that greyed one thing and refused
// another would be a control that appears to work and doesn't.
async function boardContext(companyId, workers, from, to) {
  if (!from || !to || isNaN(from) || isNaN(to) || to <= from) {
    return { leave: [], availability: [], visits: [], live: [], businessHours: null };
  }
  const workerIds = workers.map((w) => w.id);
  const userIds = workers.map((w) => w.userId).filter(Boolean);
  const [leave, availRows, company, visitRows, liveRows] = await Promise.all([
    workerIds.length
      ? db.leaveRequest.findMany({
          // APPROVED only, same as the fit check: a pending request is not a
          // day off yet, and drawing it as OUT would hide a person the manager
          // may be about to schedule.
          where: {
            companyId,
            workerId: { in: workerIds },
            status: "approved",
            startDate: { lte: to },
            endDate: { gte: from },
          },
          select: {
            workerId: true,
            startDate: true,
            endDate: true,
            halfDay: true,
            policy: { select: { name: true } },
          },
        })
      : [],
    userIds.length
      ? db.availabilitySchedule.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, dayOfWeek: true, startTime: true, endTime: true, timezone: true },
        })
      : [],
    db.company.findUnique({ where: { id: companyId }, select: { businessHours: true } }),
    // ── Who has been dispatched where ───────────────────────────────────
    //
    // A visit is booked from the job page and assigned to a USER; a shift is
    // built here and belongs to a WORKER. They are two records of the same
    // morning, and the board draws both on the same row so they cannot
    // disagree in silence — a visit at 9 on a row with no shift is the thing
    // a dispatcher needs to see. Visits are read-only here; they are edited
    // on the job. Cancelled ones are not a dispatch and are left out.
    userIds.length
      ? db.jobVisit.findMany({
          where: {
            job: { companyId },
            assignedToId: { in: userIds },
            scheduledAt: { gte: from, lt: to },
            status: { notIn: ["cancelled", "canceled"] },
          },
          orderBy: { scheduledAt: "asc" },
          select: {
            id: true,
            jobId: true,
            scheduledAt: true,
            status: true,
            assignedToId: true,
            job: { select: JOB_SELECT },
          },
        })
      : [],
    // ── The timer drives the dot ────────────────────────────────────────
    //
    // An OPEN TimeEntry (clocked in, not out) is the live truth about who is
    // on site right now, and a running TimeEntryBreak on it is who is at
    // lunch right now. The board turns the dot green or amber from these,
    // never from the plan: "scheduled 8–4" and "clocked in at 7:42" are
    // different facts and the whole point of the dot is telling them apart.
    // Always for now — an open entry has no day but today — and cheap: one
    // indexed read of the handful of open rows.
    workerIds.length
      ? db.timeEntry.findMany({
          where: { workerId: { in: workerIds }, clockOut: null },
          select: {
            workerId: true,
            clockIn: true,
            jobId: true,
            breaks: {
              select: { start: true, end: true, kind: true, paid: true },
              orderBy: { start: "asc" },
            },
          },
        })
      : [],
  ]);
  const workerByUser = {};
  for (const w of workers) if (w.userId) workerByUser[w.userId] = w.id;
  const visits = visitRows.map((v) => ({
    id: v.id,
    jobId: v.jobId,
    scheduledAt: v.scheduledAt,
    status: v.status,
    workerId: workerByUser[v.assignedToId] || null,
    job: v.job,
  }));
  const rowsByUser = {};
  for (const r of availRows) (rowsByUser[r.userId] ||= []).push(r);
  // Only workers who have DECLARED something get windows. A worker with no
  // rows is absent from the list, and the board greys nothing for them —
  // silence is not a refusal (shiftFit.js).
  const availability = workers
    .filter((w) => w.userId && rowsByUser[w.userId]?.length)
    .map((w) => ({
      workerId: w.id,
      windows: availabilityWindowsBetween(rowsByUser[w.userId], from, to),
    }));
  return {
    leave,
    availability,
    visits,
    live: liveRows,
    // Null when the company has never set hours, so the board falls back to
    // 7–18 rather than drawing an invented Monday-to-Friday.
    businessHours: hasBusinessHours(company?.businessHours)
      ? normaliseHours(company.businessHours)
      : null,
  };
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const fromDate = from ? new Date(from) : null;
  const toDate = to ? new Date(to) : null;
  // Overlap, not "starts inside": a 22:00–06:00 shift that began yesterday is
  // still somebody on the tools this morning, and the day board must draw it.
  // The week list groups by start day and simply does not show a shift whose
  // start falls outside its seven days, so it is unchanged by this.
  const range =
    fromDate && toDate
      ? { start: { lte: toDate }, end: { gte: fromDate } }
      : {};

  const isManager = can(member.role, "user:view");

  if (isManager) {
    const [shifts, workers] = await Promise.all([
      db.shift.findMany({
        where: { companyId: member.companyId, ...range },
        orderBy: { start: "asc" },
        select: {
          id: true,
          workerId: true,
          start: true,
          end: true,
          note: true,
          label: true,
          published: true,
          availabilityOverrideAt: true,
          availabilityOverrideNote: true,
          // Who decided to go ahead. Stored and read by nothing until now,
          // which made it the write-only column this codebase gets swept for.
          // It is the useful half of the record: "somebody overrode this" is a
          // shrug; "Sarah overrode this on the 3rd" is a conversation.
          availabilityOverrideBy: { select: { name: true } },
          worker: { select: { name: true } },
          // The client's name and street label the block on the day board —
          // "Dubois – 12 rue Principale" is what a dispatcher reads, not the
          // job's internal title.
          job: { select: JOB_SELECT },
          breaks: BREAKS_SELECT,
        },
      }),
      // Only workers who can actually be scheduled — active, in this company.
      // `title` (Foreman, Receptionist…) goes under the name on the board;
      // null shows nothing there, never a fallback word.
      db.worker.findMany({
        where: { companyId: member.companyId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, userId: true, title: true },
      }),
    ]);

    // Jobs a shift can be attached to, for the picker. Open work only — a
    // completed job is not somewhere to send anyone — and capped, because the
    // picker is a <select>, not a search.
    const jobs = await db.job.findMany({
      where: {
        companyId: member.companyId,
        status: { in: ["unscheduled", "scheduled", "in_progress"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 200,
      select: JOB_SELECT,
    });

    const board = await boardContext(member.companyId, workers, fromDate, toDate);

    // ── Who has no hours set ──────────────────────────────────────────────
    //
    // A worker with no WorkingHours has no usual pattern, so nothing warns
    // when they are scheduled at an odd time and nothing can tell payroll what
    // to expect. The rota is where somebody notices, so the count is returned
    // with the rota rather than left for a settings screen nobody opens.
    //
    // Workers with no login are EXCLUDED: they cannot have working hours, so
    // counting them would make the banner permanent and therefore invisible.
    const userIds = workers.map((w) => w.userId).filter(Boolean);
    const hoursRows = userIds.length
      ? await db.workingHours.findMany({
          where: { companyId: member.companyId, userId: { in: userIds } },
          select: { userId: true },
        })
      : [];
    const hoursByUserId = {};
    for (const r of hoursRows) (hoursByUserId[r.userId] ||= []).push(r);
    const missingHours = workersMissingHours(workers, hoursByUserId).map(
      (w) => ({
        id: w.id,
        name: w.name,
      }),
    );

    return NextResponse.json({
      manager: true,
      shifts,
      workers,
      missingHours,
      jobs,
      // The week's hours and cost, the attendance chips, the holiday band,
      // the caller's own worker row — lib/shifts/boardExtras.js. Rates only
      // for a caller canSeeAllPay admits; everyone else gets hours.
      ...(await managerExtras({ member, workers, shifts, fromDate, toDate, searchParams })),
      events: await eventsBetween(member.companyId, fromDate, toDate),
      ...board,
    });
  }

  // A worker: their own published shifts only.
  const worker = await db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true, name: true, userId: true, title: true },
  });
  if (!worker)
    return NextResponse.json({ manager: false, shifts: [], workers: [] });

  const shifts = await db.shift.findMany({
    where: {
      companyId: member.companyId,
      workerId: worker.id,
      published: true,
      ...range,
    },
    orderBy: { start: "asc" },
    select: {
      id: true,
      workerId: true,
      start: true,
      end: true,
      note: true,
      published: true,
      // The worker sees the override on their OWN shift. That is the entire
      // point of recording it rather than confirming it in a dialog: they were
      // scheduled outside what they said they were available for, and they
      // should learn it here, not on the morning.
      availabilityOverrideAt: true,
      availabilityOverrideNote: true,
      availabilityOverrideBy: { select: { name: true } },
      job: { select: JOB_SELECT },
      breaks: BREAKS_SELECT,
    },
  });
  // Their own row on the day board: their own leave, their own availability.
  // `workers` stays empty — it is the manager's dropdown, and a worker has
  // nobody to pick — so the board reads `self` for the one row it draws.
  const board = await boardContext(member.companyId, [worker], fromDate, toDate);
  // ── Open shifts they could claim ─────────────────────────────────────────
  //
  // Published shifts with nobody on them, in the same range, so the week
  // list and the employee home can offer "Open shift — claim it". Eligibility
  // is lib/shiftRequests/eligibility.js's rule (same job title first, anyone
  // active when the shift has none to match), applied here so the list a
  // worker sees is the list the claim route would accept.
  const openShifts = await openShiftsFor(member.companyId, worker, fromDate, toDate);
  return NextResponse.json({
    manager: false,
    shifts,
    workers: [],
    self: { id: worker.id, name: worker.name, title: worker.title },
    // Who else is on the same job that day, and the holidays — for the
    // worker's own schedule screen (lib/shifts/boardExtras.js).
    ...(await workerExtras({ companyId: member.companyId, worker, shifts, fromDate, toDate })),
    openShifts,
    events: await eventsBetween(member.companyId, fromDate, toDate),
    ...board,
  });
}

/** Company events on the board's days — ScheduleEvent rows, oldest first. */
async function eventsBetween(companyId, from, to) {
  if (!from || !to || isNaN(from) || isNaN(to)) return [];
  return db.scheduleEvent.findMany({
    where: { companyId, date: { gte: from, lte: to } },
    orderBy: { date: "asc" },
    select: { id: true, date: true, title: true, description: true },
  });
}

/** Published open shifts in range this worker is eligible to claim. */
async function openShiftsFor(companyId, worker, from, to) {
  if (!from || !to || isNaN(from) || isNaN(to)) return [];
  const rows = await db.shift.findMany({
    where: {
      companyId,
      workerId: null,
      published: true,
      start: { lte: to },
      end: { gte: from },
    },
    orderBy: { start: "asc" },
    select: {
      id: true,
      start: true,
      end: true,
      note: true,
      label: true,
      job: { select: JOB_SELECT },
      breaks: BREAKS_SELECT,
      requests: {
        where: { status: { in: ["pending_peer", "pending_manager"] } },
        select: { id: true, toWorkerId: true, status: true },
      },
    },
  });
  return rows
    .filter((r) => openShiftEligible(r, worker))
    .map(({ requests, ...r }) => ({
      ...r,
      // Whether THIS worker already has a claim in flight, so the button
      // reads "Claim requested" rather than offering a second one.
      myRequestId: requests.find((q) => q.toWorkerId === worker.id)?.id || null,
      claims: requests.length,
    }));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  // ── The schedule grid decides this, not the coarse role ────────────────
  //
  // `user:manage` is held by SUPERVISORS — it means "may run a crew". The
  // refusal message beside it said "Only an admin or owner", which was already
  // untrue, and the granular `schedule` level was never consulted at all. So a
  // Manager whose schedule was narrowed to their own still edited and
  // published everyone's week.
  //
  // edit_all is the level whose own label is "Edit everyone's schedule" — the
  // same one the appointments routes ask about, because a shift and a visit
  // are the same question wearing different words.
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "schedule", "edit_all")) {
    return NextResponse.json(
      {
        error:
          "You can only change your own schedule. Ask whoever runs the rota to change this.",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { workerId, start, end, jobId, note } = body;
  const s = start && new Date(start);
  const e = end && new Date(end);
  // workerId null is an OPEN shift — hours to be covered, nobody named yet.
  // `undefined` (the key missing) is still a 400: the modal always sends the
  // key, and a caller that forgot it has not asked for an open shift, it has
  // forgotten to say who. See Shift.workerId in the schema.
  const open = workerId === null;
  if ((!workerId && !open) || !s || !e || isNaN(s) || isNaN(e)) {
    return NextResponse.json(
      { error: "workerId (or null for an open shift), start and end are required." },
      { status: 400 },
    );
  }
  if (e <= s) {
    return NextResponse.json(
      { error: "The shift's end must be after its start." },
      { status: 400 },
    );
  }
  // Breaks are checked before anything is looked up: inside the shift, not
  // overlapping, a kind the schema knows. The rule lives in
  // lib/shifts/coverage.js so the edit route applies the identical one.
  const breaksCheck = validateBreaks(s, e, body.breaks);
  if (!breaksCheck.ok) {
    return NextResponse.json({ error: breaksCheck.error }, { status: 400 });
  }

  // The worker must belong to this company — never schedule across tenants.
  const worker = open
    ? null
    : await db.worker.findFirst({
        where: { id: workerId, companyId: member.companyId },
        select: { id: true, name: true, userId: true },
      });
  if (!open && !worker)
    return NextResponse.json({ error: "Unknown worker." }, { status: 404 });

  // The comment above says "never schedule across tenants" and means it about
  // the worker. The jobId beside it crossed freely: a shift in this company
  // could name another tenant's job, and the rota then renders their job title
  // to this company's crew.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { jobId });
  if (notOurs) return notOurs;

  const label =
    typeof body.label === "string" && body.label.trim()
      ? body.label.trim().slice(0, 40)
      : null;

  // ── "Apply to" — the same shift on several days of the week ─────────────
  //
  // `applyDays` is a list of YYYY-MM-DD local dates the modal computed from
  // its weekday toggles; the shift's own date is always one of them. Each day
  // gets the same wall-clock times, the same breaks moved by whole days
  // through the Date constructor (a clock change in the week must not shift
  // Thursday's lunch by an hour), and its OWN fit check — Tuesday may be fine
  // and Friday may be approved leave. Days that fit are created in ONE
  // transaction; days that do not are reported per day, never forced through
  // with an override nobody chose. When no day fits, the reply is the same
  // 409 a single refusal would have been, so the modal's override flow works
  // unchanged.
  const dates = applyDates(body.applyDays, s);
  const plans = dates.map((date) => {
    const shiftDays = dayDelta(s, date);
    const moved = (iso) => moveDays(iso, shiftDays);
    return {
      date,
      start: moved(s),
      end: moved(e),
      breaks: breaksCheck.breaks.map((b) => ({ ...b, start: moved(b.start), end: moved(b.end) })),
    };
  });

  const refused = [];
  const accepted = [];
  const warnings = [];
  let notes = [];
  for (const plan of plans) {
    // ── Does the shift fit the person? ─────────────────────────────────────
    //
    // lib/scheduling/shiftFit.js draws the line the schema already implied:
    // declared availability and approved leave BLOCK, the usual working
    // pattern only warns. An open shift has nobody to fit and is created as
    // is; the claim route re-runs this for whoever takes it.
    const fit = worker
      ? await assessShiftFit(worker, plan.start, plan.end, member.companyId)
      : { blocks: [], overridable: [], warnings: [], notes: [] };
    notes = fit.notes;
    // Approved leave is never overridable. A company that can OK its way past
    // a holiday it already granted has not granted anything.
    if (fit.blocks.length > 0) {
      refused.push({ date: plan.date, blocks: fit.blocks, canOverride: false });
      continue;
    }
    // Availability is a statement about preference, and emergencies are real —
    // so this refuses and says it CAN be overridden. The client re-sends
    // override: true.
    const overriding = fit.overridable.length > 0;
    if (overriding && body.override !== true) {
      refused.push({ date: plan.date, blocks: fit.overridable, canOverride: true });
      continue;
    }
    accepted.push({ plan, overriding, fit });
    warnings.push(...(overriding ? fit.overridable : []), ...fit.warnings);
  }

  if (accepted.length === 0) {
    const first = refused[0];
    const who = worker?.name || "This shift";
    return NextResponse.json(
      {
        error: first.canOverride
          ? `${who} said they aren't available then.`
          : `${who} can't be scheduled then. ${first.blocks.join(" ")}`,
        blocks: first.blocks,
        canOverride: refused.every((r) => r.canOverride),
        refused,
      },
      { status: 409 },
    );
  }

  // The breaks are written with the shift, in one create — a shift that saved
  // while its lunch did not would draw a person on the tools for eight hours
  // straight and tell payroll the same. All the accepted days in one
  // transaction: "Apply to Mon–Fri" that wrote three days and failed on the
  // fourth would leave a week nobody asked for.
  const created = await db.$transaction(
    accepted.map(({ plan, overriding }) =>
      db.shift.create({
        data: {
          companyId: member.companyId,
          workerId: open ? null : workerId,
          start: plan.start,
          end: plan.end,
          jobId: jobId || null,
          note: note?.slice(0, 300) || null,
          label,
          breaks: plan.breaks.length ? { create: plan.breaks } : undefined,
          // Recorded on the shift, not merely confirmed in a dialog. A
          // confirmation that lives only in the manager's browser is theatre:
          // they click OK, feel informed, and the worker still finds out on
          // the morning.
          ...(overriding && {
            availabilityOverrideAt: new Date(),
            availabilityOverrideById: member.userId,
            availabilityOverrideNote:
              typeof body.overrideNote === "string" && body.overrideNote.trim()
                ? body.overrideNote.trim().slice(0, 300)
                : null,
          }),
        },
        select: {
          id: true,
          workerId: true,
          start: true,
          end: true,
          note: true,
          label: true,
          published: true,
          availabilityOverrideAt: true,
          availabilityOverrideNote: true,
          breaks: BREAKS_SELECT,
        },
      }),
    ),
  );
  // The trail: who added what for whom (lib/shifts/shiftNotify.js). A
  // draft tells the worker nothing; publishing is what they hear about.
  await auditCreatedShifts(member, created, worker);
  // Warnings ride back with the created shift rather than blocking it: the
  // manager meant to do this, and they should still be told it is not their
  // usual pattern so a typo reads as a typo.
  return NextResponse.json({
    ok: true,
    shift: created[0],
    shifts: created,
    // The days that did not fit, with why — the modal lists them beside the
    // ones that were written, so "Apply to Mon–Fri" never silently becomes
    // Mon–Thu.
    refused,
    warnings: [...new Set(warnings)],
    overrode: accepted.some((a) => a.overriding),
    notes,
  });
}

/**
 * The local dates a shift is to be created on: the shift's own day plus any
 * extra YYYY-MM-DD strings the caller sent, deduplicated, capped at a week.
 * Junk is dropped rather than refused — the shift's own day is always there,
 * so the worst a bad list can do is add nothing.
 */
function applyDates(applyDays, start) {
  const own = localYmd(start);
  const out = [own];
  for (const d of Array.isArray(applyDays) ? applyDays : []) {
    if (typeof d !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (!out.includes(d)) out.push(d);
    if (out.length >= 7) break;
  }
  return out;
}

/** Whole local days from the start's day to `ymd`. */
function dayDelta(start, ymd) {
  const a = new Date(start);
  a.setHours(0, 0, 0, 0);
  const b = new Date(`${ymd}T00:00:00`);
  return Math.round((b - a) / 86_400_000);
}

/** Move an instant by whole local days, keeping its wall-clock time. */
function moveDays(value, days) {
  const d = new Date(value);
  if (days) d.setDate(d.getDate() + days);
  return d;
}
