// app/api/jobs/[id]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import {
  loadEnforceableMember,
  requireLevel,
  permissionErrorResponse,
  redactClient,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import {
  taskForCompletedJob,
  resolveTaskBySource,
} from "@/lib/tasks/autoCreate";
import { recordActivity } from "@/lib/activity/log";
import { validateJobDates, parseDateOrNull } from "@/lib/jobs/validateJobDates";

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const { full, response: denied } = await levelOrRefusal(
    member,
    "jobs",
    "view_only",
    "see jobs",
  );
  if (denied) return denied;

  // ── Not theirs reads as not there ───────────────────────────────────────
  //
  // The scope is part of the QUERY rather than a check after it, so a crew
  // member asking for somebody else's job falls into the existing `!job` 404
  // below. That is deliberate: 403 would confirm the id is real and only says
  // "not yours", which is the same leak one step removed — an id enumerated
  // off a shared screen would still tell them how many jobs the company has.
  const job = await db.job.findFirst({
    where: { id: id, companyId: member.companyId, ...assignedJobWhere(full) },
    include: {
      client: true,
      quote: { select: { id: true, quoteNumber: true } },
      visits: {
        orderBy: { scheduledAt: "asc" },
        include: { assignedTo: { select: { id: true, name: true } } },
      },
      // Empty for every job whose company has no structured payment
      // schedule — see lib/paymentSchedule/run.js. Internal staff view, so
      // the full row (including amountCents) is fine to ship as-is, unlike
      // the client-portal payload in app/api/portal/[token]/route.js, which
      // allow-lists to label + amount only.
      paymentStages: { orderBy: { seq: "asc" } },
    },
  });

  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── The job is a crew member's door onto the client record ──────────────
  //
  // Jobs are `view_only` for both Worker presets and the job page is where a
  // painter spends their day, so this is the client detail they actually
  // reach — and `include: { client: true }` handed over email, phone, private
  // notes and portalToken to someone the owner had set to name and address.
  //
  // GET /api/jobs (the list) selects { id, name } and was never exposed. The
  // detail route is the one that had no `select` at all, which is the same
  // shape as the /api/clients leak this redactor was written for.
  return NextResponse.json({ ...job, client: redactClient(full, job.client) });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Hoisted out of the try because the response below is redacted with it too —
  // re-querying the member for that would be a second round trip to learn
  // something already known. Same shape as PATCH /api/quotes/[id].
  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit", "edit jobs");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // Unreachable for a scoped member today — seesOnlyAssignedJobs only scopes
  // people who CANNOT edit jobs, so the gate above has already refused them.
  // Spread anyway: it costs one line, and the day the scope grows to cover an
  // editing tier, the write path is already narrowed instead of being the one
  // door left open.
  const existing = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json();
  const { title, status, recurring, recurrenceRule, archived, startDate, endDate } = body;

  // ── The job's own start/end, validated against the row's REAL resulting
  // state ──────────────────────────────────────────────────────────────────
  //
  // Merged with what the row already has for whichever field this PATCH
  // didn't touch — a request that only sends `endDate` still has to make
  // sense next to whatever `startDate` already is, not be validated alone and
  // let a bad combination through one field at a time. `undefined` means "not
  // in this request, keep the existing value"; an explicit `null` clears it.
  const isBlank = (v) => v === null || v === undefined || v === "";
  const nextStart = startDate !== undefined ? parseDateOrNull(startDate) : existing.startDate;
  const nextEnd = endDate !== undefined ? parseDateOrNull(endDate) : existing.endDate;
  // A blank value clears the field on purpose (`nextStart`/`nextEnd` above is
  // already null for it) — this only catches a value that was SENT and isn't
  // blank but still failed to parse, e.g. a malformed string.
  if (startDate !== undefined && !isBlank(startDate) && nextStart === null) {
    return NextResponse.json({ error: "That start date couldn't be read." }, { status: 400 });
  }
  if (endDate !== undefined && !isBlank(endDate) && nextEnd === null) {
    return NextResponse.json({ error: "That end date couldn't be read." }, { status: 400 });
  }
  const dateCheck = validateJobDates({ startDate: nextStart, endDate: nextEnd });
  if (!dateCheck.ok) {
    return NextResponse.json({ error: dateCheck.error }, { status: 400 });
  }

  // Stamp when the work actually finished.
  //
  // Set on the FIRST flip to completed and never moved afterwards. The
  // follow-up cron used to key off `updatedAt`, which meant renaming a job
  // three weeks later re-armed every "how did we do?" email attached to it.
  // Cleared if the job comes back out of completed, because a job that isn't
  // finished has no finish time.
  const completing = status === "completed" && existing.status !== "completed";
  const reopening = status !== undefined && status !== "completed" && existing.completedAt;

  // Giving the job a start date IS scheduling it — the same rule
  // POST /api/jobs/[id]/visits already applies for a first visit. Only fires
  // from `unscheduled`, so a completed/in-progress/cancelled job that later
  // gets its dates corrected isn't dragged backwards to "scheduled" — and
  // only when this request isn't ALSO setting a status itself, so an explicit
  // status change in the same PATCH is never silently overridden by this one.
  const schedulingByDate =
    status === undefined &&
    existing.status === "unscheduled" &&
    !existing.startDate &&
    nextStart;

  const updated = await db.job.update({
    where: { id: id },
    data: {
      ...(title !== undefined && { title }),
      ...(status !== undefined && { status }),
      ...(schedulingByDate && { status: "scheduled" }),
      ...(completing && { completedAt: new Date() }),
      ...(reopening && { completedAt: null }),
      ...(recurring !== undefined && { recurring }),
      ...(recurrenceRule !== undefined && { recurrenceRule }),
      ...(startDate !== undefined && { startDate: nextStart }),
      ...(endDate !== undefined && { endDate: nextEnd }),
      // Archiving is a separate axis from status — see Job.archivedAt. A job
      // can be archived whatever state the work is in, and unarchiving is
      // just as available, because nothing was destroyed.
      ...(archived !== undefined && {
        archivedAt: archived ? new Date() : null,
      }),
    },
    include: { client: true },
  });

  // Finishing the work is the moment to ask for the review, so leave a note on
  // the to-do list. Only on the FIRST flip — `completing` is already the
  // "wasn't completed before" test — and the task's own sourceKey makes a
  // reopen-then-recomplete a no-op rather than a second nag.
  if (completing) await taskForCompletedJob(id);

  // ── "Schedule the job for X" outlives the reason it exists ─────────────
  //
  // Quote acceptance raises a high-priority task saying the job is "waiting in
  // Jobs with no date on it yet". Scheduling a visit closes it. Nothing else
  // did — so a job that was CANCELLED, or completed without a visit ever being
  // recorded, left the task open, still asserting there is work to book.
  //
  // The owner cancelled two QA jobs and the task stayed. A to-do list that
  // argues with the job record is one people stop reading.
  //
  // Keyed off the quote, because that is what the task was keyed off when it
  // was created — the task carries no jobId at all, so a job-based lookup
  // would never have found it.
  if (
    existing.quoteId &&
    (status === "cancelled" || status === "completed") &&
    existing.status !== status
  ) {
    await resolveTaskBySource(`quote_accepted:${existing.quoteId}`);
  }

  // Filing a job away also settles "schedule this job" — you are not going to
  // book work you have just put in the drawer.
  if (existing.quoteId && archived === true && !existing.archivedAt) {
    await resolveTaskBySource(`quote_accepted:${existing.quoteId}`);
  }

  // Giving the job dates settles the same "schedule this job" task that a
  // first visit already closes — see POST /api/jobs/[id]/visits. Fires
  // whenever a start date newly appears, not only when it happens to also
  // flip the status: a job someone already nudged to "scheduled" by hand
  // still had the task open if nobody had booked a visit yet.
  if (existing.quoteId && !existing.startDate && nextStart) {
    await resolveTaskBySource(`quote_accepted:${existing.quoteId}`);
  }

  if (archived !== undefined && Boolean(existing.archivedAt) !== Boolean(archived)) {
    await recordActivity(member, {
      action: archived ? "job.archived" : "job.unarchived",
      entityType: "job",
      entityId: id,
      summary: `${archived ? "Archived" : "Restored"} job ${existing.title || id}`,
    });
  }

  // Same redaction as the GET above. An unredacted PATCH reply hands back
  // every field the GET just hid — renaming a job would have restored the
  // client's phone number to the browser.
  return NextResponse.json({
    ...updated,
    client: redactClient(full, updated.client),
  });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  let full = null;
  try {
    full = await loadEnforceableMember(db, member.id);
    requireLevel(full, "jobs", "view_create_edit_delete", "delete jobs");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  // Same no-op-by-construction spread as PATCH above, for the same reason.
  const existing = await db.job.findFirst({
    where: { id, companyId: member.companyId, ...assignedJobWhere(full) },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── What a job is allowed to take with it ──────────────────────────────
  //
  // Task and TimeEntry reference Job with Prisma's DEFAULT referential action,
  // which is Restrict — so this delete throws a foreign-key error on any job
  // with logged hours or an auto-created task, i.e. most real ones. There was
  // no delete button in the UI, so nobody had hit it; adding one without this
  // check would have shipped a 500 as a feature.
  //
  // Refusing is also the correct answer, not just the safe one. Approved hours
  // are a payroll record and tasks are someone's to-do list; a job with either
  // behind it is history, and history gets CANCELLED, not erased. Visits and
  // photos are different — they belong to the job and cascade or null out on
  // their own.
  const [taskCount, timeEntryCount] = await Promise.all([
    db.task.count({ where: { jobId: id } }),
    db.timeEntry.count({ where: { jobId: id } }),
  ]);

  if (taskCount || timeEntryCount) {
    const reasons = [];
    if (timeEntryCount)
      reasons.push(
        `${timeEntryCount} time ${timeEntryCount === 1 ? "entry" : "entries"}`,
      );
    if (taskCount) reasons.push(`${taskCount} ${taskCount === 1 ? "task" : "tasks"}`);
    return NextResponse.json(
      {
        error:
          `This job has ${reasons.join(" and ")} attached, so it can't be deleted — ` +
          `those are records of work. Set it to Cancelled instead; it stays on the ` +
          `books and stops appearing as live work.`,
      },
      { status: 409 },
    );
  }

  await db.job.delete({ where: { id } });

  // The quote's "schedule this job" task has nothing left to point at.
  if (existing.quoteId) {
    await resolveTaskBySource(`quote_accepted:${existing.quoteId}`);
  }

  await recordActivity(member, {
    action: "job.deleted",
    entityType: "job",
    entityId: id,
    summary: `Deleted job ${existing.title || id}`,
  });

  return NextResponse.json({ success: true });
}
