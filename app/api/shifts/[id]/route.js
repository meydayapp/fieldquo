// app/api/shifts/[id]/route.js — edit or delete one shift (manager only).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { db } from "@/lib/db";
import { assessShiftFit } from "@/lib/scheduling/loadShiftFit";
import { getCurrentMember } from "@/lib/currentMember";
import { can } from "@/lib/permissions";

async function ownShift(member, id) {
  return db.shift.findFirst({ where: { id, companyId: member.companyId } });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
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
  if (body.jobId !== undefined) data.jobId = body.jobId || null;

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
      if (!fit.ok) {
        return NextResponse.json(
          {
            error: `${worker.name} can't be scheduled then. ${fit.blocks.join(" ")}`,
            blocks: fit.blocks,
            warnings: fit.warnings,
          },
          { status: 409 },
        );
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
      return NextResponse.json({ ok: true, shift, warnings: fit.warnings });
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
  const existing = await ownShift(member, id);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.shift.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
