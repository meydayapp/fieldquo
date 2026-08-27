// app/api/time-entries/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { resolveWallClock } from "@/lib/time/wallClock";
import { recordActivity } from "@/lib/activity/log";

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const existing = await db.timeEntry.findFirst({
    where: { id: _params.id, worker: { companyId: member.companyId } },
    include: { worker: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Company scope was the only check here, so anyone could clock a colleague
  // out — retroactively, at whatever time they chose, on the hours that feed
  // payroll. Mirrors the list endpoint's own-vs-everyone split; the separate
  // status gate below still applies on top.
  const full = await loadEnforceableMember(db, member.id);
  if (
    !hasLevel(full, "timeTracking", "view_record_edit_all") &&
    existing.worker?.userId !== member.userId
  ) {
    return NextResponse.json(
      { error: "You can only change your own time entries." },
      { status: 403 },
    );
  }

  // ── "Record" is not "edit", and the ladder says so in its own labels ─────
  //
  // timeTracking's three levels are "View and record their own", "View,
  // record, and edit their own", "View, record, and edit everyone's" — so
  // EDIT is the second rung, and it was never asked for. The check above only
  // separated own from everyone's, which meant view_record_own — the Worker
  // (limited) preset — could PATCH its own row: QA changed an entry's hours
  // from 0.01 to 1 and got a 200.
  //
  // The distinction that has to survive: estimator is view_record_edit_own
  // and MUST keep editing its own entries. This is the rung between them, not a
  // narrowing of both.
  //
  // Recording still works — POST /api/time-entries opens a shift and POST
  // /api/time-clock closes it, and neither passes through here. This route is
  // the timesheet EDITOR, which is exactly what the level withholds.
  if (!hasLevel(full, "timeTracking", "view_record_edit_own")) {
    return NextResponse.json(
      {
        error:
          "Your access level for Time Tracking & Timesheets lets you record time, not edit it. Ask a supervisor to change this entry.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { clockOut, status } = body;

  // Approving/rejecting requires a manager — editing your own open entry (clocking
  // out) doesn't
  if (
    status &&
    status !== "pending" &&
    !["owner", "admin", "supervisor"].includes(member.role)
  ) {
    return NextResponse.json(
      { error: "Only a supervisor or admin can approve time entries" },
      { status: 403 },
    );
  }

  // ── An approved timesheet is closed ─────────────────────────────────────
  //
  // The gate above stops a worker CALLING an entry approved. It never stopped
  // them editing one that already was, and `status: "pending"` slipped through
  // it entirely — the condition excludes "pending" so that clocking out can
  // leave an entry pending, which also let a worker un-approve their own. QA
  // did exactly that: hours rewritten 0.01 → 1 and the entry flipped back from
  // approved to pending, on a row a supervisor had already signed off.
  //
  // Approved hours are what a pay run multiplies by an hourly rate. Reopening
  // one after approval either changes what somebody is paid or, if the run has
  // already gone out, makes the timesheet disagree with the payslip — and the
  // person who approved it is never asked. So the same set that may approve is
  // the set that may reopen; everyone else gets a sentence naming who to ask.
  //
  // Deliberately NOT keyed on the timeTracking level: view_record_edit_all is
  // a Dispatcher's grant over other people's hours, and undoing an approval is
  // an authority question rather than a scope one. It matches the gate
  // directly above so the two cannot drift.
  if (
    existing.status === "approved" &&
    !["owner", "admin", "supervisor"].includes(member.role)
  ) {
    return NextResponse.json(
      {
        error:
          "This timesheet has already been approved and can't be changed. Ask a supervisor or admin to reopen it.",
      },
      { status: 403 },
    );
  }

  let hours = existing.hours;
  // Same wall-clock rule as the POST route — the manual form's end time is a
  // bare "2026-08-20T17:00" and only means something once resolved in the
  // company's zone. `hours` is computed from this, and `hours` is what payroll
  // pays, so getting it wrong here is money.
  const company = await db.company.findUnique({
    where: { id: member.companyId }, // the query above already scoped to it
    select: { timezone: true },
  });
  const resolvedClockOut = clockOut
    ? resolveWallClock(clockOut, company?.timezone)
    : existing.clockOut;

  if (clockOut && !resolvedClockOut) {
    return NextResponse.json(
      { error: "That end time isn't a valid date and time." },
      { status: 400 },
    );
  }

  if (resolvedClockOut) {
    const clockInMs = existing.clockIn.getTime();
    const clockOutMs = resolvedClockOut.getTime();
    if (clockOutMs <= clockInMs) {
      return NextResponse.json(
        { error: "clockOut must be after clockIn" },
        { status: 400 },
      );
    }
    hours = Math.round(((clockOutMs - clockInMs) / 3600000) * 100) / 100;
  }

  const selfApproved =
    status === "approved" && existing.worker?.userId === member.userId;

  // ── A corrected timesheet goes back in the queue ─────────────────────────
  //
  // Crew now hold timeTracking:view_record_edit_own — they fix their own
  // forgotten clock-out rather than asking someone to do it for them. What
  // must not happen is the fix inheriting the sign-off of the figure it
  // replaced: an entry that was reviewed at 6.5h and is now 9h has not been
  // reviewed at all, and `hours` is what a pay run multiplies by a rate.
  //
  // Only when the person editing is the person whose hours these are, and only
  // when they didn't say what the status should be. A supervisor correcting
  // somebody else's entry is doing the reviewing, so their edit stands.
  // Self-approval is allowed elsewhere (a sole trader has nobody else), which
  // is exactly why this applies to owners and supervisors editing their own
  // rows too — the ONE thing this closes is an approved figure changing under
  // an approval nobody re-gave.
  //
  // Note the guard above already refuses a non-supervisor editing an APPROVED
  // entry outright, so in practice this reopens two cases: a rejected entry the
  // worker has corrected, and an approver amending their own approved hours.
  const timesChanged = clockOut !== undefined;
  const selfEdited = existing.worker?.userId === member.userId;
  const reopen =
    timesChanged &&
    selfEdited &&
    status === undefined &&
    existing.status !== "pending";

  const updated = await db.timeEntry.update({
    where: { id: _params.id },
    data: {
      ...(clockOut !== undefined && { clockOut: resolvedClockOut, hours }),
      ...(reopen && { status: "pending", approvedById: null }),
      ...(status !== undefined && {
        status,
        approvedById:
          status === "approved" ? member.userId : existing.approvedById,
      }),
    },
    include: { worker: { select: { id: true, name: true } } },
  });

  // ── The trail the Activity Log page promises and didn't keep ────────────
  //
  // Approved hours are what a pay run multiplies by an hourly rate. QA created
  // entries for two colleagues, approved all three including their own, and
  // pushed them into a $332.77 pay run — with no record of any of it, while
  // the page told the owner it keeps "a record of important actions".
  //
  // Self-approval is recorded distinctly rather than refused. A sole trader
  // who is the only worker has nobody else to approve their hours, and
  // blocking it would break the smallest companies to police the larger ones.
  // Naming it in the trail is what makes it reviewable.
  if (status !== undefined) {
    await recordActivity(member, {
      action: selfApproved ? "timeEntry.selfApproved" : `timeEntry.${status}`,
      entityType: "timeEntry",
      entityId: updated.id,
      summary: selfApproved
        ? `Approved their own hours — ${updated.hours ?? "?"}h`
        : `${status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Updated"} ${updated.worker?.name || "a worker"}'s hours — ${updated.hours ?? "?"}h`,
      metadata: { hours: updated.hours ?? null, status, selfApproved },
    });
  } else if (clockOut !== undefined) {
    // A reopen is logged as its own action rather than as a clock-out: the
    // reviewable fact is that an already-decided entry went back to pending,
    // and burying that inside "Clocked out — 9h" is how it stops being visible.
    await recordActivity(member, {
      action: reopen ? "timeEntry.reopenedBySelfEdit" : "timeEntry.clockedOut",
      entityType: "timeEntry",
      entityId: updated.id,
      summary: reopen
        ? `Edited their own hours — ${updated.hours ?? "?"}h, back to pending from ${existing.status}`
        : `Clocked out ${updated.worker?.name || "a worker"} — ${updated.hours ?? "?"}h`,
      metadata: {
        hours: updated.hours ?? null,
        ...(reopen && { previousStatus: existing.status, reopened: true }),
      },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Two gates, because they answer different questions and the second one was
  // missing.
  //
  //   user:manage           — may you administer other people at all
  //   timeTracking level    — may you touch other people's hours
  //
  // Only the first existed, and supervisors hold it, so a Dispatcher whose
  // Time Tracking dial read "their own" could delete anybody's entry — while
  // the refusal sentence claimed "only owners/admins", which was never true of
  // this route either. The grid is the control an owner actually has over
  // hours; it now governs the destructive end of it, and the level's own label
  // says so (lib/permissions.js).
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      {
        error:
          "You don't have permission to delete time entries. Ask an owner or admin.",
      },
      { status: 403 },
    );
  }

  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "timeTracking", "view_record_edit_all")) {
    return NextResponse.json(
      {
        error:
          "Your access level for Time Tracking & Timesheets doesn't allow you to delete time entries.",
      },
      { status: 403 },
    );
  }

  const existing = await db.timeEntry.findFirst({
    where: { id: _params.id, worker: { companyId: member.companyId } },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (existing.status === "approved") {
    return NextResponse.json(
      {
        error:
          "Can't delete an approved time entry — it may already be reflected in a payout",
      },
      { status: 400 },
    );
  }

  await db.timeEntry.delete({ where: { id: _params.id } });
  return NextResponse.json({ success: true });
}
