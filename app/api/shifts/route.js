// app/api/shifts/route.js
//
// Shift scheduling. A manager (user:manage) drafts and publishes shifts; a
// worker sees only their OWN published shifts — a half-built week never lands on
// someone's phone. Pure scheduling: no pay, no money movement.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";
import { assessShiftFit } from "@/lib/scheduling/loadShiftFit";
import { workersMissingHours } from "@/lib/scheduling/shiftFit";

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range =
    from && to ? { start: { gte: new Date(from), lte: new Date(to) } } : {};

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
          published: true,
          worker: { select: { name: true } },
          job: { select: { id: true, title: true } },
        },
      }),
      // Only workers who can actually be scheduled — active, in this company.
      db.worker.findMany({
        where: { companyId: member.companyId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, userId: true },
      }),
    ]);

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

    return NextResponse.json({ manager: true, shifts, workers, missingHours });
  }

  // A worker: their own published shifts only.
  const worker = await db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true },
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
      job: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json({ manager: false, shifts, workers: [] });
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (!workerId || !s || !e || isNaN(s) || isNaN(e)) {
    return NextResponse.json(
      { error: "workerId, start and end are required." },
      { status: 400 },
    );
  }
  if (e <= s) {
    return NextResponse.json(
      { error: "The shift's end must be after its start." },
      { status: 400 },
    );
  }

  // The worker must belong to this company — never schedule across tenants.
  const worker = await db.worker.findFirst({
    where: { id: workerId, companyId: member.companyId },
    select: { id: true, name: true, userId: true },
  });
  if (!worker)
    return NextResponse.json({ error: "Unknown worker." }, { status: 404 });

  // ── Does the shift fit the person? ───────────────────────────────────────
  //
  // Until now nothing asked. A manager could put anyone on any hour of any
  // day — through their declared availability, through approved leave, through
  // a Sunday they had never agreed to work — and the only thing that would
  // object was the worker, on the morning.
  //
  // lib/scheduling/shiftFit.js draws the line the schema already implied:
  // declared availability and approved leave BLOCK, the usual working pattern
  // only warns. That last part is load-bearing — an extra day at a six o'clock
  // start is the case a rota tool exists for, and refusing it would be a rota
  // tool nobody uses.
  const fit = await assessShiftFit(worker, s, e, member.companyId);

  // Approved leave is never overridable. A company that can OK its way past a
  // holiday it already granted has not granted anything, and the way to change
  // one is to amend the leave — which involves the person whose day off it is.
  if (fit.blocks.length > 0) {
    return NextResponse.json(
      {
        error: `${worker.name} can't be scheduled then. ${fit.blocks.join(" ")}`,
        blocks: fit.blocks,
        canOverride: false,
      },
      { status: 409 },
    );
  }

  // Availability is a statement about preference, and emergencies are real —
  // so this refuses and says it CAN be overridden, rather than pretending a
  // manager never has a legitimate reason. The client re-sends override: true.
  const overriding = fit.overridable.length > 0;
  if (overriding && body.override !== true) {
    return NextResponse.json(
      {
        error: `${worker.name} said they aren't available then.`,
        blocks: fit.overridable,
        canOverride: true,
      },
      { status: 409 },
    );
  }

  const shift = await db.shift.create({
    data: {
      companyId: member.companyId,
      workerId,
      start: s,
      end: e,
      jobId: jobId || null,
      note: note?.slice(0, 300) || null,
      // Recorded on the shift, not merely confirmed in a dialog. A
      // confirmation that lives only in the manager's browser is theatre: they
      // click OK, feel informed, and the worker still finds out on the morning.
      ...(overriding && {
        availabilityOverrideAt: new Date(),
        availabilityOverrideById: member.userId,
        // Optional. The FACT is what matters and an emergency should not be
        // gated on typing, but a reason makes the record worth reading later.
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
      published: true,
      availabilityOverrideAt: true,
      availabilityOverrideNote: true,
    },
  });
  // Warnings ride back with the created shift rather than blocking it: the
  // manager meant to do this, and they should still be told it is not their
  // usual pattern so a typo reads as a typo.
  return NextResponse.json({
    ok: true,
    shift,
    // The override echoes back as a warning too, so the screen does not go
    // quiet as if nothing unusual had just been decided.
    warnings: [...(overriding ? fit.overridable : []), ...fit.warnings],
    overrode: overriding,
    notes: fit.notes,
  });
}
