// app/api/hr/workers/[workerId]/notes/route.js
//
// The performance file, manager side: the timeline, and adding to it. No
// PATCH, no DELETE — lib/hr/notes.js says why. A warning or write-up that
// requires acknowledgement tells the person the moment it is written.
//
// Attendance flags (late / no-show / early-out) sit on the same timeline,
// read-only, from ShiftAttendance — the rows lib/shifts/attendance.js
// computes for the time-clock watch. They are FACTS beside the notes, not
// notes: no author, no acknowledgement, and nothing here writes them. The
// read is guarded on the delegate existing because that model landed in a
// concurrent piece of work; a deploy that carries this route without that
// schema shows the notes alone rather than failing the file.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { ownWorker } from "@/lib/hr/access";
import { parseNoteBody, NOTE_SELECT } from "@/lib/hr/notes";
import { notifyWorker } from "@/lib/hr/notify";
import { recordActivity } from "@/lib/activity/log";

export async function GET(request, { params }) {
  const { workerId } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const worker = await ownWorker(db, member, workerId);
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const notes = await db.workerNote.findMany({
    where: { companyId: member.companyId, workerId: worker.id },
    select: NOTE_SELECT,
    orderBy: { occurredAt: "desc" },
  });
  const attendance = await attendanceFlags(worker.id, member.companyId);
  return NextResponse.json({ worker: { id: worker.id, name: worker.name }, notes, attendance });
}

const ATTENDANCE_DAYS = 90;

async function attendanceFlags(workerId, companyId) {
  if (!db.shiftAttendance?.findMany) return [];
  try {
    const since = new Date(Date.now() - ATTENDANCE_DAYS * 86_400_000);
    const rows = await db.shiftAttendance.findMany({
      where: { companyId, workerId, final: true, status: { in: ["late", "no_show", "early_out"] }, shift: { start: { gte: since } } },
      select: { id: true, status: true, lateMinutes: true, earlyMinutes: true, shift: { select: { start: true } } },
      orderBy: { computedAt: "desc" },
      take: 50,
    });
    return rows.map((r) => ({ id: r.id, status: r.status, occurredAt: r.shift?.start || null, lateMinutes: r.lateMinutes, earlyMinutes: r.earlyMinutes }));
  } catch {
    return [];
  }
}

export async function POST(request, { params }) {
  const { workerId } = await params;
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;
  const worker = await ownWorker(db, member, workerId);
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));
  const parsed = parseNoteBody(raw);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const author = member.userId ? await db.user.findUnique({ where: { id: member.userId }, select: { name: true } }) : null;
  const note = await db.workerNote.create({
    data: { ...parsed.data, companyId: member.companyId, workerId: worker.id, authorMemberId: member.id, authorName: author?.name || null },
    select: NOTE_SELECT,
  });

  if (note.visibleToWorker && note.requiresAcknowledgement) {
    await notifyWorker(worker, { companyId: member.companyId, type: "hr.note.toAcknowledge", entityId: note.id, params: { noteKind: note.kind }, actorUserId: member.userId }, { db });
  }
  await recordActivity(member, {
    action: `hr.note_${note.kind}`,
    entityType: "worker",
    entityId: worker.id,
    // The body is never in the activity log's summary: the log is readable
    // by every owner and admin, the note by the people on the file.
    summary: `Added a ${note.kind.replace("_", "-")} to ${worker.name}'s file`,
    metadata: { noteId: note.id, kind: note.kind, visibleToWorker: note.visibleToWorker },
  });
  return NextResponse.json({ note }, { status: 201 });
}
