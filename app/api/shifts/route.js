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

export async function GET(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const range = from && to ? { start: { gte: new Date(from), lte: new Date(to) } } : {};

  const isManager = can(member.role, "user:view");

  if (isManager) {
    const [shifts, workers] = await Promise.all([
      db.shift.findMany({
        where: { companyId: member.companyId, ...range },
        orderBy: { start: "asc" },
        select: {
          id: true, workerId: true, start: true, end: true, note: true, published: true,
          worker: { select: { name: true } },
          job: { select: { id: true, title: true } },
        },
      }),
      // Only workers who can actually be scheduled — active, in this company.
      db.worker.findMany({
        where: { companyId: member.companyId, active: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);
    return NextResponse.json({ manager: true, shifts, workers });
  }

  // A worker: their own published shifts only.
  const worker = await db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true },
  });
  if (!worker) return NextResponse.json({ manager: false, shifts: [], workers: [] });

  const shifts = await db.shift.findMany({
    where: { companyId: member.companyId, workerId: worker.id, published: true, ...range },
    orderBy: { start: "asc" },
    select: {
      id: true, workerId: true, start: true, end: true, note: true, published: true,
      job: { select: { id: true, title: true } },
    },
  });
  return NextResponse.json({ manager: false, shifts, workers: [] });
}

export async function POST(request) {
  const member = await getCurrentMember(request);
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      { error: "You can only change your own schedule. Ask whoever runs the rota to change this." },
      { status: 403 },
    );
  }

  const { workerId, start, end, jobId, note } = await request.json().catch(() => ({}));
  const s = start && new Date(start);
  const e = end && new Date(end);
  if (!workerId || !s || !e || isNaN(s) || isNaN(e)) {
    return NextResponse.json({ error: "workerId, start and end are required." }, { status: 400 });
  }
  if (e <= s) {
    return NextResponse.json({ error: "The shift's end must be after its start." }, { status: 400 });
  }

  // The worker must belong to this company — never schedule across tenants.
  const worker = await db.worker.findFirst({ where: { id: workerId, companyId: member.companyId }, select: { id: true } });
  if (!worker) return NextResponse.json({ error: "Unknown worker." }, { status: 404 });

  const shift = await db.shift.create({
    data: {
      companyId: member.companyId,
      workerId,
      start: s,
      end: e,
      jobId: jobId || null,
      note: note?.slice(0, 300) || null,
    },
    select: { id: true, workerId: true, start: true, end: true, note: true, published: true },
  });
  return NextResponse.json({ ok: true, shift });
}
