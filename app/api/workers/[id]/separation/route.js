// app/api/workers/[id]/separation/route.js
//
// Ending somebody's employment, and reading back how it ended.
//
//   POST — take them off payroll, scheduling and overhead (Worker.active =
//          false), record the kind of separation, the last day worked and
//          the rehire answer on the Worker row, and write the explanation into
//          their HR file as a private "separation" note. One transaction: a
//          person who is off payroll with no reason on file, or a reason on
//          file for a person still on payroll, are both records that lie.
//   GET  — the current separation for the HR file's summary card, with the
//          explanation. HR managers only.
//
// Nothing is deleted. Pay runs, timesheets, payouts and the HR file all stay;
// re-activating (PATCH { active: true }) puts them back and leaves this record
// in the file as history. See lib/team/separation.js for what this does NOT
// model (final pay, government forms).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { isPayrollAdmin } from "@/lib/permissions/settingsAccess";
import { hrManagerOrRefusal } from "@/lib/hr/gate";
import { NOTE_SELECT } from "@/lib/hr/notes";
import { recordActivity } from "@/lib/activity/log";
import {
  parseSeparation,
  isSeparated,
  splitSeparationNote,
  calendarDayOf,
} from "@/lib/team/separation";
import {
  recordLanguage,
  actorDisplayName,
  separationNoteText,
} from "@/lib/team/separationRecord";

const WORKER_SELECT = {
  id: true,
  name: true,
  active: true,
  hiredOn: true,
  separatedOn: true,
  separationType: true,
  separationRehireEligible: true,
  separatedById: true,
};

export async function GET(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { id } = await params;
  // The explanation is an HR record: the same two readers as every note in
  // the file — the managers who keep it (this gate) — and, unlike a warning,
  // NOT the person it is about. There is no "me" route for it.
  const { member, response } = await hrManagerOrRefusal(request);
  if (response) return response;

  const worker = await db.worker.findFirst({
    where: { id, companyId: member.companyId },
    select: WORKER_SELECT,
  });
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isSeparated(worker)) return NextResponse.json({ separation: null });

  const [note, recorder] = await Promise.all([
    db.workerNote.findFirst({
      where: { companyId: member.companyId, workerId: worker.id, kind: "separation" },
      orderBy: { createdAt: "desc" },
      select: NOTE_SELECT,
    }),
    // Resolved to today's name rather than trusting the note's snapshot
    // alone: the note keeps what the author was called at the time (that is
    // what a record should keep), the card says who that person is now.
    worker.separatedById
      ? db.member.findFirst({
          where: { id: worker.separatedById, companyId: member.companyId },
          select: { user: { select: { name: true, email: true } } },
        })
      : null,
  ]);

  return NextResponse.json({
    separation: {
      lastDay: calendarDayOf(worker.separatedOn),
      type: worker.separationType,
      rehireEligible: worker.separationRehireEligible,
      recordedBy:
        recorder?.user?.name || recorder?.user?.email || note?.authorName || null,
      recordedAt: note?.createdAt || null,
      explanation: note ? splitSeparationNote(note.body).explanation : null,
      noteId: note?.id || null,
    },
  });
}

export async function POST(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Two gates, both of them doors that already exist. `user:manage` is what
  // PATCH /api/workers/[id] (the Edit form's Active checkbox) requires and
  // what the HR file sits behind; payroll admin is what the Workers page
  // itself requires. Ending employment is a payroll act that writes an HR
  // record, so it needs both — a supervisor who may keep HR notes but may not
  // open Workers can't take somebody off payroll from a side door.
  try {
    requirePermission(member.role, "user:manage");
  } catch {
    return NextResponse.json(
      { error: "Only an owner or admin can end someone's employment." },
      { status: 403 },
    );
  }
  if (!isPayrollAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can end someone's employment." },
      { status: 403 },
    );
  }

  const worker = await db.worker.findFirst({
    where: { id, companyId: member.companyId },
    select: WORKER_SELECT,
  });
  if (!worker) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Refused rather than overwritten: a second separation over a current one
  // would silently replace "dismissed on the 3rd" with whatever was typed
  // second. Re-activate first and the earlier one stays in the file.
  if (isSeparated(worker)) {
    return NextResponse.json(
      {
        error: `Their employment already ended on ${calendarDayOf(worker.separatedOn)}. The record is in their HR file.`,
        code: "already_separated",
      },
      { status: 409 },
    );
  }

  const raw = await request.json().catch(() => ({}));
  const parsed = parseSeparation(raw, { hiredOn: worker.hiredOn });
  if (parsed.error) {
    return NextResponse.json(
      { error: parsed.error, field: parsed.field },
      { status: 400 },
    );
  }
  const { data } = parsed;

  const [language, authorName] = await Promise.all([
    recordLanguage(member.companyId),
    actorDisplayName(member),
  ]);
  const body = await separationNoteText({ language, data, recordedBy: authorName });

  const note = await db.$transaction(async (tx) => {
    await tx.worker.update({
      where: { id: worker.id },
      data: {
        active: false,
        separatedOn: data.lastDay,
        separationType: data.type,
        separationRehireEligible: data.rehireEligible,
        separatedById: member.id,
      },
    });
    return tx.workerNote.create({
      data: {
        companyId: member.companyId,
        workerId: worker.id,
        authorMemberId: member.id,
        authorName,
        kind: "separation",
        body,
        occurredAt: data.lastDay,
        // Private, always. An explanation of a dismissal is written for the
        // people who keep the file, not a note the person is asked to sign.
        visibleToWorker: false,
        requiresAcknowledgement: false,
      },
      select: { id: true },
    });
  });

  await recordActivity(member, {
    action: "worker.separated",
    entityType: "worker",
    entityId: worker.id,
    // The explanation never goes in the activity log — see the notes route:
    // the log is read by every owner and admin, the file by its keepers.
    summary: `Ended ${worker.name}'s employment (last day ${calendarDayOf(data.lastDay)})`,
    metadata: { noteId: note.id, separationType: data.type },
  });

  return NextResponse.json({
    ok: true,
    worker: {
      id: worker.id,
      active: false,
      separatedOn: data.lastDay,
      separationType: data.type,
    },
    noteId: note.id,
  });
}
