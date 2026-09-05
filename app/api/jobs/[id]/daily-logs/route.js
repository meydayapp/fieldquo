// app/api/jobs/[id]/daily-logs/route.js
//
// The day-shaped record docs/construction/AUDIT-existing.md §3 found missing.
//
// The audit's verdict was PARTIAL with the pieces already there: photos arrive
// from the field by text, checklists get ticked, tasks carry a completion
// comment — and nothing tied a DAY together, because JobVisit.notes is a
// pre-visit brief whose write path has no caller. This is the row that ties it,
// and the GET below is the first thing in the product that reads the day's
// photos and its finished to-dos in one query.
//
// ══ Why crew-level, not editor-level ═══════════════════════════════════════
//
// Gated at jobs:view_only on BOTH verbs, which is the same call
// app/api/jobs/[id]/asset-use/route.js makes and for the same stated reason:
// reporting what happened today is not the same act as editing the job. The
// Crew preset is `jobs: "view_only"` (lib/permissions.js), and a daily log a
// crew member cannot write is a daily log nobody writes — the office was not
// on site.
//
// Every read and write is additionally narrowed by assignedJobWhere, so "not
// your job" reads as "not found", exactly as the job route itself answers.
//
// ══ Why POST creates and PATCH updates, rather than one upsert ════════════
//
// An upsert would make the duplicate-Tuesday race INVISIBLE: two crew members
// saving the same evening would each silently win in turn, and the last one
// would overwrite the other's words with no refusal anywhere. The unique index
// on (jobId, logDate) is the thing that catches it, and it only catches it if
// somebody creates. So: POST creates and reports P2002 as a conflict, PATCH
// (in [logId]/route.js) updates behind the stale-write guard. Both refusals
// reach the browser in the SAME shape (code "stale_write"), because to the
// person typing they mean the identical thing — somebody else's version is
// stored and saving now would lose one of them — and
// app/components/StaleWriteBanner.js already knows how to say that.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { assignedJobWhere } from "@/lib/permissions/enforce";
import {
  DAILY_LOG_ENTITY,
  LOG_SELECT,
  parseLogDate,
  dayKey,
  readLogFields,
  shapeLog,
  taskLine,
} from "@/lib/jobs/dailyLog";
import { staleWriteBody, recordEdit } from "@/lib/concurrency/staleWrite";

/** How many past days the panel lists. A season of work, not the whole job. */
const LIST_LIMIT = 60;

async function ownJob(jobId, companyId, member) {
  return db.job.findFirst({
    where: { id: jobId, companyId, ...assignedJobWhere(member) },
    select: { id: true },
  });
}

/** The UTC window covering one calendar day, for the photo/task lookups. */
function dayWindow(at) {
  const end = new Date(at.getTime());
  end.setUTCDate(end.getUTCDate() + 1);
  return { gte: at, lt: end };
}

/**
 * What the product already knows about this day, for the seed.
 *
 * Photos are COUNTED rather than listed: the panel is a writing surface, and
 * JobPhotoTimeline is where the pictures live. Completed to-dos are listed,
 * because the assignee's completionComment is literally an answer to "what did
 * you do?" and is the closest thing to a daily log this product has ever had.
 *
 * Both are scoped to the company as well as the job. The job was already
 * proved, but a `where` on a tenant model that omits companyId is the shape
 * check:tenant-scope refuses, and rightly.
 */
async function dayContext(jobId, companyId, at) {
  const window = dayWindow(at);
  const [photoCount, tasks] = await Promise.all([
    db.jobPhoto.count({ where: { jobId, companyId, createdAt: window } }),
    db.task.findMany({
      // "done" is the finished state in enum TaskStatus (open | in_progress |
      // done | cancelled). "completed" is not a member, so Prisma threw on
      // every call and daily-logs was a 500 on every job — the log could never
      // be opened.
      where: { jobId, companyId, status: "done", updatedAt: window },
      select: { id: true, title: true, completionComment: true },
      orderBy: { updatedAt: "asc" },
      take: 25,
    }),
  ]);
  return { photoCount, taskLines: tasks.map(taskLine).filter(Boolean) };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see this job's daily logs",
  );
  if (denied) return denied;

  if (!(await ownJob(id, member.companyId, full)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The day the panel is showing. The BROWSER decides which calendar day the
  // person means — see lib/jobs/dailyLog.js's header for why the server must
  // not guess it from an instant. Absent means "just give me the list", which
  // is what a first paint asks for before it knows the reader's own date.
  const raw = new URL(request.url).searchParams.get("day");
  let at = null;
  if (raw) {
    try {
      at = parseLogDate(raw);
    } catch (err) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status || 400 },
      );
    }
  }

  const logs = await db.jobDailyLog.findMany({
    where: { jobId: id, companyId: member.companyId },
    select: LOG_SELECT,
    orderBy: { logDate: "desc" },
    take: LIST_LIMIT,
  });

  const payload = { logs: logs.map(shapeLog) };

  if (at) {
    const key = dayKey(at);
    payload.day = {
      key,
      // Found in the list already loaded when the day is recent; re-read when
      // somebody navigates further back than LIST_LIMIT.
      log:
        payload.logs.find((l) => l.day === key) ??
        shapeLog(
          await db.jobDailyLog.findFirst({
            where: { jobId: id, companyId: member.companyId, logDate: at },
            select: LOG_SELECT,
          }),
        ),
      ...(await dayContext(id, member.companyId, at)),
    };
  }

  return NextResponse.json(payload);
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // See the file header: the same gate asset-use makes. Writing down what
  // happened on site is the job of the person who was on site.
  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "write this job's daily log",
  );
  if (denied) return denied;

  if (!(await ownJob(id, member.companyId, full)))
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const raw = await request.json().catch(() => ({}));

  let at;
  let fields;
  try {
    at = parseLogDate(raw?.day);
    fields = readLogFields(raw);
  } catch (err) {
    return NextResponse.json(
      { error: err.message, code: err.code },
      { status: err.status || 400 },
    );
  }

  // Frozen at write time, like ActivityLog.actorName: a rename or a departed
  // employee must not erase who wrote the day's record.
  const author = full?.userId
    ? await db.user.findUnique({
        where: { id: full.userId },
        select: { name: true, email: true },
      })
    : null;

  try {
    const created = await db.jobDailyLog.create({
      data: {
        companyId: member.companyId,
        jobId: id,
        logDate: at,
        ...fields,
        authorUserId: full?.userId || null,
        authorName: author?.name || author?.email || null,
      },
      select: LOG_SELECT,
    });

    await recordEdit(db, {
      companyId: member.companyId,
      entityType: DAILY_LOG_ENTITY,
      entityId: created.id,
      editorUserId: full?.userId || null,
      versionAt: created.updatedAt,
    });

    return NextResponse.json({ log: shapeLog(created) }, { status: 201 });
  } catch (err) {
    // P2002 on (jobId, logDate) — somebody else started this day's log while
    // this one was being typed. NOT an error to swallow and not a row to
    // overwrite: two half-written logs for one Tuesday is precisely what the
    // index is for. Answered in the stale-write shape so the existing banner
    // can offer "open the saved version" and a deliberate re-save.
    if (err?.code !== "P2002") throw err;

    const existing = await db.jobDailyLog.findFirst({
      where: { jobId: id, companyId: member.companyId, logDate: at },
      select: { id: true, updatedAt: true },
    });
    // The row went between the constraint firing and this read. Nothing to
    // point the reader at, so say so plainly rather than naming a colleague.
    if (!existing)
      return NextResponse.json(
        {
          error:
            "That day's log changed while you were writing. Reload the page and try again.",
        },
        { status: 409 },
      );

    return NextResponse.json(
      await staleWriteBody(db, {
        companyId: member.companyId,
        entityType: DAILY_LOG_ENTITY,
        entityId: existing.id,
        label: "daily log",
        expected: null,
        currentUpdatedAt: existing.updatedAt,
        viewerUserId: full?.userId || null,
      }),
      { status: 409 },
    );
  }
}
