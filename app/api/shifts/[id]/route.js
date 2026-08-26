// app/api/shifts/[id]/route.js — edit or delete one shift (manager only).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { db } from "@/lib/db";
import { assessShiftFit } from "@/lib/scheduling/loadShiftFit";
import { memberOrRefusal } from "@/lib/apiMember";
import { can } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";

async function ownShift(member, id) {
  return db.shift.findFirst({ where: { id, companyId: member.companyId } });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
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
  const existing = await ownShift(member, id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const data = {};
  if (body.start !== undefined) data.start = new Date(body.start);
  if (body.end !== undefined) data.end = new Date(body.end);
  if (body.note !== undefined)
    data.note = body.note ? String(body.note).slice(0, 300) : null;
  if (body.published !== undefined) data.published = Boolean(body.published);
  if (body.jobId !== undefined) {
    // Same tenant check the create does. Attaching a job is the one field on
    // this PATCH that names a row somebody else might own.
    const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
      jobId: body.jobId,
    });
    if (notOurs) return notOurs;
    data.jobId = body.jobId || null;
  }

  const start = data.start ?? existing.start;
  const end = data.end ?? existing.end;
  if (end <= start) {
    return NextResponse.json(
      { error: "The shift's end must be after its start." },
      { status: 400 },
    );
  }

  // Moving a shift has to face the same question creating one does. Checking
  // only on create would mean the rule holds until somebody drags the block —
  // which is how most shifts actually get their final times.
  //
  // Skipped when the times did not change: republishing a shift, renaming it or
  // attaching a job must not fail because the worker's availability was edited
  // afterwards. The shift was already agreed; this route is not the place to
  // relitigate it.
  if (data.start !== undefined || data.end !== undefined) {
    const worker = await db.worker.findFirst({
      where: { id: existing.workerId, companyId: member.companyId },
      select: { id: true, name: true, userId: true },
    });
    if (worker) {
      const fit = await assessShiftFit(worker, start, end, member.companyId);

      // Same two tiers as creating one, and for the same reason: approved
      // leave was granted and is not a manager's to OK past; availability is a
      // statement about preference and an emergency is a real reason.
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
      if (overriding) {
        data.availabilityOverrideAt = new Date();
        data.availabilityOverrideById = member.userId;
        data.availabilityOverrideNote =
          typeof body.overrideNote === "string" && body.overrideNote.trim()
            ? body.overrideNote.trim().slice(0, 300)
            : null;
      } else {
        // Moved back INSIDE what they said they were available for, so the
        // mark comes off. Leaving it would tell the worker they had been
        // overridden on a shift that now fits — a stale warning is a warning
        // people learn to ignore.
        data.availabilityOverrideAt = null;
        data.availabilityOverrideById = null;
        data.availabilityOverrideNote = null;
      }

      const shift = await db.shift.update({
        where: { id },
        data,
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
      return NextResponse.json({
        ok: true,
        shift,
        warnings: [...(overriding ? fit.overridable : []), ...fit.warnings],
        overrode: overriding,
      });
    }
  }

  const shift = await db.shift.update({
    where: { id },
    data,
    select: {
      id: true,
      workerId: true,
      start: true,
      end: true,
      note: true,
      published: true,
    },
  });
  return NextResponse.json({ ok: true, shift });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
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
  // ── …and DELETING asks the level above that ─────────────────────────────
  //
  // This handler was a copy of the PATCH gate, so it stopped at edit_all — the
  // level whose own label is "Edit everyone's schedule". The Dispatcher preset
  // is exactly edit_all and the Manager preset is edit_delete_all, so deleting
  // a shift was the one schedule verb where the two tiers came out identical,
  // and the dial the Manage Team editor offers withheld nothing.
  //
  // DELETE /api/appointments/[id] already asks for edit_delete_all, and its
  // comment says why: a deleted slot takes the agreed time with it and leaves
  // nothing behind to say it existed. A shift and a visit are the same
  // question wearing different words, so they get the same answer.
  const full = await loadEnforceableMember(db, member.id);
  if (!hasLevel(full, "schedule", "edit_delete_all")) {
    return NextResponse.json(
      {
        error:
          "Only someone who can delete from everyone's schedule can remove a shift. Ask whoever runs the rota.",
      },
      { status: 403 },
    );
  }
  const existing = await ownShift(member, id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.shift.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
