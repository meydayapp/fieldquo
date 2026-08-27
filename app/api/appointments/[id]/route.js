// app/api/appointments/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import {
  loadEnforceableMember,
  hasLevel,
  redactClient,
} from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

// ── The list route was scoped; this one was not ────────────────────────────
//
// GET /api/appointments narrows to `assignedToId: member.userId OR null`
// unless the caller holds schedule "edit_all". These three handlers checked
// companyId alone, so an employee on "View their own schedule" who could not
// SEE a colleague's Tuesday in the calendar could still fetch it by id, move
// it, reassign it, or delete it outright — and the response handed them the
// client's email, phone, private notes and portalToken along the way.
//
// A gate on the list and not on the row is worse than no gate: the calendar
// looks scoped, so the restriction reads as done.
//
// The levels required here are the same strings the list route and the grid
// use, not a parallel vocabulary. PERMISSION_CATEGORIES.schedule is ordered
// view_own → view_complete_own → edit_own → edit_all → edit_delete_all, and
// hasLevel is an "at least" comparison, so naming the exact level the label
// promises is enough.

/**
 * One body for "no such appointment" and for "not yours to see".
 *
 * Deliberately not a 403 on the read path. A 403 is itself an answer: it
 * confirms that an appointment with that id exists in this company, which is
 * the fact the scoping is meant to withhold. Someone walking ids off a 403 and
 * a 404 learns the shape of the whole calendar without reading one row of it.
 *
 * Shared as a constant so the two cases can never drift into distinguishable
 * sentences — which is the usual way this kind of blind 404 springs a leak.
 */
const NOT_FOUND = {
  error:
    "That appointment isn't on your schedule. If it should be, ask an owner, " +
    "admin or whoever runs the calendar to assign it to you.",
};

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const appt = await db.appointment.findFirst({
    where: { id: _params.id, companyId: member.companyId },
    include: { client: true, assignedTo: { select: { id: true, name: true } } },
  });

  if (!appt) return NextResponse.json(NOT_FOUND, { status: 404 });

  const full = await loadEnforceableMember(db, member.id);
  // Same three-way test the list route's `where` expresses, written as a
  // predicate because a single row has nothing to narrow. Unassigned stays
  // readable by everyone for the reason given on the list route: an unclaimed
  // job nobody can see is a job nobody does.
  //
  // `member.userId` is checked truthy before comparing: a session without one
  // (support impersonation) would otherwise match every appointment whose
  // assignedToId is null via `null === null`, handing the one caller that is
  // supposed to read least the rows meant for nobody in particular.
  const mine = !!member.userId && appt.assignedToId === member.userId;
  const visible =
    hasLevel(full, "schedule", "edit_all") || mine || appt.assignedToId === null;

  if (!visible) return NextResponse.json(NOT_FOUND, { status: 404 });

  // The nested client is the same record GET /api/clients redacts for
  // name_address_only — reaching it through an appointment must not pay more.
  return NextResponse.json({ ...appt, client: redactClient(full, appt.client) });
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const existing = await db.appointment.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing) return NextResponse.json(NOT_FOUND, { status: 404 });

  const body = await request.json();

  const full = await loadEnforceableMember(db, member.id);
  const mine = !!member.userId && existing.assignedToId === member.userId;

  // "edit_all" — the same level the list route treats as "sees everyone's
  // schedule", because rescheduling someone else's Tuesday is a stronger act
  // than reading it and must not be reachable on a weaker grant.
  //
  // Their OWN appointment is exempt with no level required, rather than gated
  // on "edit_own". "View and complete their own schedule" sits BELOW edit_own
  // in the grid and exists precisely so a worker can close out the visit they
  // just did; requiring edit_own here would break that level's own promise.
  //
  // Unassigned is readable above but not freely writable here. Seeing an
  // unclaimed job is how it gets done; quietly rewriting one that was never
  // yours is a different act, and the row carries no owner to check you
  // against.
  //
  // ── Except claiming it ─────────────────────────────────────────────────
  //
  // One exception, and only one: putting your OWN name on an unassigned
  // appointment. That is the point of unassigned work being visible at all,
  // it already worked before this route was scoped, and taking it away would
  // fix a hole by removing a feature.
  //
  // Deliberately narrow. The row must currently be unassigned, the new
  // assignee must be the caller themselves, and `assignedToId` must be the
  // ONLY thing the request changes — otherwise "claiming" becomes a way to
  // reschedule someone else's Tuesday by assigning it to yourself in the same
  // breath.
  const claimingUnassigned =
    existing.assignedToId === null &&
    !!member.userId &&
    body.assignedToId === member.userId &&
    Object.keys(body).every((k) => k === "assignedToId");

  if (!mine && !claimingUnassigned && !hasLevel(full, "schedule", "edit_all")) {
    return NextResponse.json(
      {
        error:
          "You can only change appointments assigned to you. Ask an owner, " +
          "admin or whoever manages the schedule to move or reassign this one.",
      },
      { status: 403 },
    );
  }

  // ── Putting your own name on, and taking your own name off ──────────────
  //
  // Changing who an appointment is assigned to requires appointment:assign,
  // with two exceptions. Both only ever move the row towards the caller or
  // away from them, so neither can be used to take a colleague's Tuesday or to
  // read anything they could not already read.
  //
  // The second one was described here and not implemented. The comment said
  // "unless someone is unassigning themselves" and the condition refused it:
  // for `{ assignedToId: null }` on your own row, `null !== existing` and
  // `null !== member.userId` both hold, so an employee dropping off a job got
  // a 403. The DELETE handler below states the same intent independently and
  // leans on it — "a worker who wants off a job unassigns themselves, which
  // PATCH already allows" is its whole argument for having no self-delete. Two
  // comments agreeing about the behaviour and one condition disagreeing meant
  // a worker had no way off a job at all, so the CODE is what was wrong.
  //
  // `!body.assignedToId` rather than `=== null`: the update below writes
  // `body.assignedToId || null`, so "" and null are the same release as far as
  // the row is concerned, and the gate has to agree with the write or one of
  // the two forms slips past. `member.userId` is checked truthy first for the
  // reason GET gives — an impersonated session has none, and `undefined` must
  // not match an unassigned row.
  const releasingOwn =
    !body.assignedToId &&
    !!member.userId &&
    existing.assignedToId === member.userId;

  if (
    "assignedToId" in body &&
    body.assignedToId !== existing.assignedToId &&
    body.assignedToId !== member.userId &&
    !releasingOwn &&
    !can(member.role, "appointment:assign")
  ) {
    return NextResponse.json(
      { error: "Only a supervisor or admin can reassign this appointment" },
      { status: 403 },
    );
  }

  // Same gap as the create route: the membership lookup below only runs for a
  // supervisor-required appointment, which is the minority case. Every reassign
  // has to name somebody on this team.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    ...("assignedToId" in body && { assignedToId: body.assignedToId }),
  });
  if (notOurs) return notOurs;

  if (
    existing.requiresSupervisor &&
    "assignedToId" in body &&
    body.assignedToId
  ) {
    const assignee = await db.member.findUnique({
      where: {
        userId_companyId: {
          userId: body.assignedToId,
          companyId: member.companyId,
        },
      },
    });
    if (
      !assignee ||
      !["owner", "admin", "supervisor"].includes(assignee.role)
    ) {
      return NextResponse.json(
        {
          error:
            "This appointment requires a supervisor or admin to be assigned",
        },
        { status: 400 },
      );
    }
  }

  const updated = await db.appointment.update({
    where: { id: _params.id },
    data: {
      ...(body.scheduledAt && { scheduledAt: new Date(body.scheduledAt) }),
      ...(body.location !== undefined && { location: body.location }),
      ...(body.status && { status: body.status }),
      ...("assignedToId" in body && {
        assignedToId: body.assignedToId || null,
        status:
          body.assignedToId && existing.status === "needs_supervisor"
            ? "scheduled"
            : existing.status,
      }),
    },
    include: { client: true, assignedTo: { select: { id: true, name: true } } },
  });

  // Redacted on the way out too. The calendar writes this response straight
  // back into its row state, so an unredacted PATCH reply would restore every
  // field the GET just stripped.
  return NextResponse.json({
    ...updated,
    client: redactClient(full, updated.client),
  });
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const existing = await db.appointment.findFirst({
    where: { id: _params.id, companyId: member.companyId },
  });
  if (!existing) return NextResponse.json(NOT_FOUND, { status: 404 });

  // "edit_delete_all", the top of the schedule grid, with no self-exception.
  //
  // The obvious alternative — let people delete their own, mirroring PATCH —
  // has nothing in the grid to hang on: the levels run
  // ... edit_own → edit_all → edit_delete_all, and there is no "delete their
  // own". Deleting is the one schedule verb the owner grants as all-or-nothing,
  // so inventing a self-delete here would grant an access level the Manage Team
  // editor gives no way to withhold.
  //
  // It is also the destructive one: a deleted appointment takes the client's
  // agreed time with it and leaves nothing behind to say it existed. A worker
  // who wants off a job unassigns themselves, which PATCH already allows.
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "schedule", "edit_delete_all")) {
    return NextResponse.json(
      {
        error:
          "Only an owner, admin or someone who can delete from everyone's " +
          "schedule can remove an appointment. Ask one of them to do it.",
      },
      { status: 403 },
    );
  }

  await db.appointment.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
