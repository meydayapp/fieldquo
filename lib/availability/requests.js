// lib/availability/requests.js
//
// "My availability takes effect on Monday": a worker proposes a new week,
// a manager approves it, and the rows land in AvailabilitySchedule on the
// effective date. The pure parts (the day shape, the apply-now decision,
// the diff against the current week) are exported so the check script runs
// them; the database parts are at the bottom.
//
// ── One table, two readers, one honest label ─────────────────────────────
//
// AvailabilitySchedule is read by the shift fit (lib/scheduling/shiftFit.js
// — a shift outside it is refused) AND by the booking engine (a client may
// only book inside it). The owner's rule: no second table. So a crew member
// edits "Hours you can work"; somebody who can quote edits "Hours you can
// work and be booked for appointments" — the same rows, said by role
// (lib/booking/bookableMembers.js decides who is bookable). Nothing here
// invents a bookable window; the request carries the person's own rows.
//
// The day shape and every pure rule are in lib/availability/days.js, which
// the browser imports too; this file is the database half only.
import { db } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";
import { recordActivity } from "@/lib/activity/log";
import { hasLevel, loadEnforceableMember } from "@/lib/permissions/enforce";
import { canApprove } from "@/lib/org/reportingLine";
import { can } from "@/lib/permissions";
import { ensureConsultationEventType } from "@/lib/booking/bookableMembers";
import { DEFAULT_TZ, appliesNow, diffWeeks, effectiveDate, normaliseDays, weeklyHours } from "@/lib/availability/days";

export { appliesNow, diffWeeks, effectiveDate, normaliseDays, weeklyHours };

// ── Database ────────────────────────────────────────────────────────────────

const REQUEST_SELECT = {
  id: true,
  companyId: true,
  workerId: true,
  effectiveFrom: true,
  days: true,
  desiredHoursPerWeek: true,
  note: true,
  status: true,
  decisionNote: true,
  decidedAt: true,
  appliedAt: true,
  createdAt: true,
  worker: { select: { id: true, name: true, title: true, userId: true } },
  decidedBy: { select: { name: true } },
};

async function workerFor(member) {
  if (!member?.userId) return null;
  return db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: { id: true, name: true, title: true, userId: true, managerId: true },
  });
}

async function companyOf(member) {
  const row = await db.company.findUnique({
    where: { id: member.companyId },
    select: { availabilityNeedsApproval: true, defaultLanguage: true, timezone: true },
  });
  return {
    needsApproval: row?.availabilityNeedsApproval !== false,
    language: row?.defaultLanguage || "en",
    timeZone: row?.timezone || DEFAULT_TZ,
  };
}

async function isManager(member) {
  const full = await loadEnforceableMember(db, member.id);
  return hasLevel(full, "schedule", "edit_all");
}

/**
 * Write the request's rows as the worker's AvailabilitySchedule — the same
 * replace-the-week the settings page's PATCH does — and stamp appliedAt.
 * Inside one transaction: a week that was deleted and not rewritten is a
 * person who can never be scheduled. `tx` may be the db itself.
 */
export async function applyRequest(tx, request) {
  const worker = await tx.worker.findUnique({ where: { id: request.workerId }, select: { userId: true, companyId: true } });
  if (!worker?.userId) return { applied: false, reason: "no_login" };
  const check = normaliseDays(request.days);
  if (!check.ok) return { applied: false, reason: check.error };
  await tx.availabilitySchedule.deleteMany({ where: { userId: worker.userId } });
  await tx.availabilitySchedule.createMany({
    data: check.days.map((d) => ({ userId: worker.userId, ...d })),
  });
  await tx.availabilityRequest.update({ where: { id: request.id }, data: { appliedAt: new Date() } });
  return { applied: true, userId: worker.userId, companyId: worker.companyId };
}

/** After an apply: somebody who can quote gets their consultation event type kept in step, as the settings PATCH does. */
async function afterApply(applied) {
  if (!applied?.applied) return;
  try {
    const m = await db.member.findFirst({
      where: { companyId: applied.companyId, userId: applied.userId },
      select: { role: true, user: { select: { name: true } } },
    });
    if (m && can(m.role, "quote:create")) {
      await ensureConsultationEventType(applied.companyId, applied.userId, m.user?.name);
    }
  } catch (err) {
    console.error("[availability-requests] ensure consultation event failed:", err?.message);
  }
}

/** Everything the caller sees on "My availability". */
export async function listFor(member) {
  const [worker, manager, company] = await Promise.all([workerFor(member), isManager(member), companyOf(member)]);
  const current = member.userId
    ? await db.availabilitySchedule.findMany({
        where: { userId: member.userId },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        select: { dayOfWeek: true, startTime: true, endTime: true, timezone: true },
      })
    : [];
  const mine = worker
    ? await db.availabilityRequest.findMany({
        where: { workerId: worker.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: REQUEST_SELECT,
      })
    : [];
  const approvals = manager
    ? await db.availabilityRequest.findMany({
        where: { companyId: member.companyId, status: "pending" },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: REQUEST_SELECT,
      })
    : [];
  // For the manager's diff: the current rows of everyone with a pending request.
  const userIds = approvals.map((r) => r.worker?.userId).filter(Boolean);
  const currentRows = userIds.length
    ? await db.availabilitySchedule.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, dayOfWeek: true, startTime: true, endTime: true },
      })
    : [];
  const byUser = {};
  for (const r of currentRows) (byUser[r.userId] ||= []).push(r);
  const bookable = can(member.role, "quote:create");
  return {
    me: worker ? { id: worker.id, name: worker.name, title: worker.title } : null,
    manager,
    needsApproval: company.needsApproval,
    bookable,
    current,
    mine,
    approvals: approvals.map((r) => ({
      ...r,
      diff: diffWeeks(byUser[r.worker?.userId] || [], r.days),
      hours: weeklyHours(r.days),
    })),
  };
}

/** Submit a request (or, when the company needs no approval, apply it outright). */
export async function createRequest(member, body = {}) {
  const worker = await workerFor(member);
  if (!worker) return { error: "You're not on the roster.", status: 403 };
  const company = await companyOf(member);
  const check = normaliseDays(body.days, { timezone: company.timeZone });
  if (!check.ok) return { error: check.error, status: 400 };
  const effectiveFrom = effectiveDate(body.effectiveFrom);
  if (!effectiveFrom) return { error: "When should this take effect? Pick a date.", status: 400 };
  const desired =
    body.desiredHoursPerWeek == null || body.desiredHoursPerWeek === ""
      ? null
      : Number(body.desiredHoursPerWeek);
  if (desired != null && (!Number.isFinite(desired) || desired < 0 || desired > 168)) {
    return { error: "Desired hours per week must be a number between 0 and 168.", status: 400 };
  }
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;
  const pending = await db.availabilityRequest.findFirst({ where: { workerId: worker.id, status: "pending" }, select: { id: true } });
  if (pending) return { error: "You already have a request waiting. Withdraw it first, or wait for the answer.", status: 409 };

  const created = await db.availabilityRequest.create({
    data: {
      companyId: member.companyId,
      workerId: worker.id,
      effectiveFrom,
      days: check.days,
      desiredHoursPerWeek: desired,
      note,
      // No approval needed: approved on arrival, applied now or by the cron.
      status: company.needsApproval ? "pending" : "approved",
      ...(company.needsApproval ? {} : { decidedAt: new Date(), decidedById: member.userId }),
    },
    select: REQUEST_SELECT,
  });
  await recordActivity(member, {
    action: "availability_request.created",
    entityType: "availabilityRequest",
    entityId: created.id,
    summary: `${worker.name} requested new availability from ${effectiveFrom.toISOString().slice(0, 10)}`,
  });
  if (!company.needsApproval) {
    if (appliesNow(effectiveFrom)) {
      const applied = await db.$transaction((tx) => applyRequest(tx, created));
      await afterApply(applied);
    }
    return { request: await db.availabilityRequest.findUnique({ where: { id: created.id }, select: REQUEST_SELECT }) };
  }
  void notifyEvent({
    companyId: member.companyId,
    type: "availability.requested",
    entityId: created.id,
    actorUserId: member.userId,
    params: { workerName: worker.name, effectiveFrom: effectiveFrom.toISOString().slice(0, 10) },
  });
  return { request: created };
}

/** approve | decline | withdraw. */
export async function decide(member, id, action, body = {}) {
  const request = await db.availabilityRequest.findFirst({ where: { id, companyId: member.companyId }, select: REQUEST_SELECT });
  if (!request) return { error: "That request isn't here.", status: 404 };
  if (request.status !== "pending") return { error: `That request is already ${request.status}.`, status: 409 };
  const worker = await workerFor(member);
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;

  if (action === "withdraw") {
    if (!worker || worker.id !== request.workerId) return { error: "Only the person who asked can withdraw it.", status: 403 };
    const row = await db.availabilityRequest.update({
      where: { id },
      data: { status: "declined", decisionNote: "Withdrawn", decidedAt: new Date(), decidedById: member.userId },
      select: REQUEST_SELECT,
    });
    return { request: row };
  }

  if (action !== "approve" && action !== "decline") return { error: "approve, decline or withdraw.", status: 400 };
  let allowed = await isManager(member);
  if (!allowed && worker) {
    const workers = await db.worker.findMany({ where: { companyId: member.companyId }, select: { id: true, managerId: true } });
    const byId = new Map(workers.map((w) => [w.id, w]));
    allowed = canApprove({ actorWorkerId: worker.id, workerId: request.workerId, byId, hasManagePermission: false });
  }
  if (!allowed) return { error: "Only whoever runs the rota can decide this.", status: 403 };
  if (worker && worker.id === request.workerId) return { error: "You can't approve your own availability.", status: 403 };

  const now = new Date();
  const row = await db.$transaction(async (tx) => {
    const updated = await tx.availabilityRequest.update({
      where: { id },
      data: { status: action === "approve" ? "approved" : "declined", decisionNote: note, decidedAt: now, decidedById: member.userId },
      select: REQUEST_SELECT,
    });
    if (action === "approve" && appliesNow(updated.effectiveFrom, now)) {
      const applied = await applyRequest(tx, updated);
      updated.applied = applied;
    }
    return updated;
  });
  if (row.applied) await afterApply(row.applied);
  await recordActivity(member, {
    action: `availability_request.${action}`,
    entityType: "availabilityRequest",
    entityId: row.id,
    summary: `${action} availability request for ${row.worker?.name || ""}`,
  });
  if (row.worker?.userId) {
    void notifyEvent({
      companyId: member.companyId,
      type: "availability.decided",
      entityId: row.id,
      actorUserId: member.userId,
      recipientUserIds: [row.worker.userId],
      params: {
        outcome: row.status,
        effectiveFrom: new Date(row.effectiveFrom).toISOString().slice(0, 10),
      },
    });
  }
  return { request: await db.availabilityRequest.findUnique({ where: { id }, select: REQUEST_SELECT }) };
}

/**
 * The cron's job: every approved, unapplied request whose date has come.
 * Returns { applied, skipped }.
 */
export async function applyDue(now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const due = await db.availabilityRequest.findMany({
    where: { status: "approved", appliedAt: null, effectiveFrom: { lte: today } },
    orderBy: { effectiveFrom: "asc" },
    take: 500,
    select: REQUEST_SELECT,
  });
  let applied = 0;
  let skipped = 0;
  for (const r of due) {
    // Latest request per worker wins: two approved requests for the same
    // person, both due, are applied in date order and the later one stands.
    const result = await db.$transaction((tx) => applyRequest(tx, r));
    if (result.applied) {
      applied += 1;
      await afterApply(result);
    } else {
      skipped += 1;
      // A worker who lost their login before the date: mark it so the cron
      // does not retry forever, and say why on the row.
      await db.availabilityRequest.update({ where: { id: r.id }, data: { appliedAt: now, decisionNote: `Not applied: ${result.reason}` } });
    }
  }
  return { applied, skipped };
}
