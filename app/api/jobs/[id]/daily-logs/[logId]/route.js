// app/api/jobs/[id]/daily-logs/[logId]/route.js
//
// Editing a day that already has a log — the autosave's destination.
//
// ══ Why this route is guarded and most are not ═════════════════════════════
//
// lib/concurrency/staleWrite.js's header says a guarded route is one where two
// people plausibly have the same row open. A daily log is the strongest case
// in the product: it is written at the end of a shift, by whoever is standing
// there, and on a two-crew job that is two people on two phones at 17:30. Add
// AUTOSAVE — a save the person did not ask for and does not watch — and an
// unguarded write is not a race somebody might lose, it is a race somebody
// will lose without ever knowing there was one.
//
// So the version the browser loaded travels back with every autosave, the
// guard sits inside the `where` (never in an `if` above the write, which has a
// window between the check and the write), and a miss is a 409 the person can
// act on rather than a silent overwrite.
//
// There is no DELETE. A daily log is a record of a day; a wrong one gets
// edited, and a day nobody worked simply has no row. Offering a delete would
// make the log deniable, which is most of what makes it worth writing.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import {
  DAILY_LOG_ENTITY,
  LOG_SELECT,
  readLogFields,
  shapeLog,
} from "@/lib/jobs/dailyLog";
import {
  parseExpectedVersion,
  versionWhere,
  runGuardedWrite,
  settleGuardedWrite,
} from "@/lib/concurrency/staleWrite";

export async function PATCH(request, { params }) {
  const { id, logId } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Same gate the POST makes — see that file's header. Writing down what
  // happened is not editing the job.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "write this job's daily log",
  );
  if (denied) return denied;

  // Scoped through the JOB, not just the company: a crew member may only
  // reach a log on a job they have a visit on. Spread inside `job` rather than
  // at the top level because assignedJobWhere filters `visits`, which is a
  // relation of Job — the same shape the materials route uses.
  const existing = await db.jobDailyLog.findFirst({
    where: {
      id: logId,
      jobId: id,
      companyId: member.companyId,
      job: { companyId: member.companyId, ...assignedJobWhere(full) },
    },
    select: { id: true },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));

  let fields;
  let expected;
  try {
    fields = readLogFields(raw);
    // The version the browser is editing FROM. Absent means unguarded, which
    // is the documented opt-in — but the panel always sends it, and
    // scripts/check-daily-log.mjs asserts that it does. "Missing means
    // unguarded" is a migration affordance for the 96 untouched screens, not
    // permission for a new one to skip the guard.
    expected = parseExpectedVersion(raw?.expectedUpdatedAt);
  } catch (err) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status || 400 },
    );
  }

  // logDate is deliberately NOT writable. Moving a log from Tuesday to
  // Wednesday is not an edit — it either collides with Wednesday's own log
  // (and the unique index refuses it as a raw 500) or silently re-dates
  // somebody's account of a day. A log filed against the wrong day is fixed by
  // writing the right day and emptying the wrong one.
  const outcome = await runGuardedWrite({
    expected,
    readVersion: () =>
      db.jobDailyLog.findFirst({
        where: { id: logId, companyId: member.companyId },
        select: { updatedAt: true },
      }),
    write: () =>
      db.jobDailyLog.update({
        where: { id: logId, ...versionWhere(expected) },
        data: fields,
        select: LOG_SELECT,
      }),
  });

  const refusal = await settleGuardedWrite(outcome, {
    client: db,
    companyId: member.companyId,
    entityType: DAILY_LOG_ENTITY,
    entityId: logId,
    label: "daily log",
    expected,
    member: full,
    versionAt: outcome.result?.updatedAt,
  });
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  return NextResponse.json({ log: shapeLog(outcome.result) });
}
