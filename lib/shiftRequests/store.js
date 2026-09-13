// lib/shiftRequests/store.js
//
// The database half of the trade / cover / claim flow. The decisions are in
// state.js (pure); this file loads, applies, notifies.
//
// ── The swap is one transaction with its fit check ─────────────────────────
//
// Approving a swap moves Shift.workerId. Before it does, lib/scheduling/
// shiftFit.js is run for the NEW person on the shift's times — the same
// check the scheduler runs when a manager drafts a shift — inside the
// transaction that writes the status. A swap that would put Ana on approved
// leave, or outside the hours she said she can work, is DECLINED with that
// reason rather than approved and discovered on the morning; the manager
// reads the reason on the row. No override here: a manager who wants Ana
// on it anyway has the scheduler, where the override is recorded.
//
// ── Expiry is lazy ─────────────────────────────────────────────────────────
//
// `expireStale()` runs at the top of every list read and marks pending
// requests whose shift has started as expired, then notifies the people who
// were waiting. No cron: a request nobody is looking at costs nothing
// wrong, and the moment somebody looks is the moment it has to be right.
// (A shift started at 07:00 that was still "pending" at 07:05 is a row
// nobody can act on either way — the state machine refuses every action on
// a started shift regardless, so a stale row cannot be approved.)
import { db } from "@/lib/db";
import { hasLevel, loadEnforceableMember } from "@/lib/permissions/enforce";
import { canApprove } from "@/lib/org/reportingLine";
import { shiftFit } from "@/lib/scheduling/shiftFit";
import { notifyEvent } from "@/lib/notifications/notify";
import { recordActivity } from "@/lib/activity/log";
import { initialState, swapWrites, transition } from "@/lib/shiftRequests/state";
import { coverAudience, mayAccept, openShiftEligible, tradePartners } from "@/lib/shiftRequests/eligibility";

const WORKER = { id: true, name: true, title: true, userId: true, active: true, managerId: true };
const JOB = {
  id: true,
  title: true,
  siteAddress: true,
  siteCity: true,
  client: { select: { name: true } },
};
const SHIFT = {
  id: true,
  workerId: true,
  start: true,
  end: true,
  note: true,
  label: true,
  published: true,
  job: { select: JOB },
  breaks: { select: { start: true, end: true, kind: true, paid: true }, orderBy: { start: "asc" } },
};
export const REQUEST_SELECT = {
  id: true,
  companyId: true,
  shiftId: true,
  kind: true,
  fromWorkerId: true,
  toWorkerId: true,
  offeredShiftId: true,
  status: true,
  note: true,
  decisionNote: true,
  decidedById: true,
  decidedAt: true,
  createdAt: true,
  shift: { select: SHIFT },
  offeredShift: { select: SHIFT },
  fromWorker: { select: { id: true, name: true, title: true, userId: true } },
  toWorker: { select: { id: true, name: true, title: true, userId: true } },
  decidedBy: { select: { name: true } },
};

const PENDING = ["pending_peer", "pending_manager"];

/** The caller's Worker row in their company, or null (an office admin with no roster row). */
export async function workerFor(member) {
  if (!member?.userId) return null;
  return db.worker.findFirst({
    where: { companyId: member.companyId, userId: member.userId },
    select: WORKER,
  });
}

/** schedule at edit_all — the level the approval routes ask, same as POST /api/shifts. */
export async function isScheduleManager(member) {
  const full = await loadEnforceableMember(db, member.id);
  return hasLevel(full, "schedule", "edit_all");
}

/** Company.shiftSwapsNeedApproval, defaulted true when unreadable. */
async function needsApproval(companyId) {
  const row = await db.company.findUnique({
    where: { id: companyId },
    select: { shiftSwapsNeedApproval: true, defaultLanguage: true, timezone: true },
  });
  return {
    needsApproval: row?.shiftSwapsNeedApproval !== false,
    language: row?.defaultLanguage || "en",
    timeZone: row?.timezone || "America/Toronto",
  };
}

/**
 * "Mon 14 Sep, 8:00 – 16:00 — Sophie Dubois, 12 rue Principale", in one
 * language and zone, for the notification's `when` param. Written here
 * rather than imported from the rota's own notifier so this module builds
 * whichever of the two lands first — the two are the same Intl call.
 */
export function whenLabel(shift, { language = "en", timeZone = "America/Toronto" } = {}) {
  if (!shift?.start || !shift?.end) return "";
  let day;
  let time;
  try {
    day = new Intl.DateTimeFormat(language, { timeZone, weekday: "short", day: "numeric", month: "short" });
    time = new Intl.DateTimeFormat(language, { timeZone, hour: "numeric", minute: "2-digit" });
  } catch {
    day = new Intl.DateTimeFormat("en", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
    time = new Intl.DateTimeFormat("en", { timeZone: "UTC", hour: "numeric", minute: "2-digit" });
  }
  const s = new Date(shift.start);
  const e = new Date(shift.end);
  const when = `${day.format(s)}, ${time.format(s)} – ${time.format(e)}`;
  const place = [shift.job?.client?.name, shift.job?.siteAddress].filter(Boolean).join(", ");
  return place ? `${when} — ${place}` : when;
}

/**
 * Mark pending requests whose shift has started as expired, and tell the
 * people who were waiting. Returns the number changed.
 */
export async function expireStale(companyId, now = new Date()) {
  const stale = await db.shiftRequest.findMany({
    where: { companyId, status: { in: PENDING }, shift: { start: { lte: now } } },
    select: REQUEST_SELECT,
  });
  if (!stale.length) return 0;
  const ctx = await needsApproval(companyId);
  for (const r of stale) {
    const verdict = transition({ request: { ...r, shiftStart: r.shift.start }, action: "expire", actor: null, options: { now } });
    if (!verdict.ok) continue;
    await db.shiftRequest.update({
      where: { id: r.id },
      data: { status: "expired", decidedAt: now },
    });
    void notifyDecided(r, "expired", null, ctx);
  }
  return stale.length;
}

/**
 * Everything the caller can see:
 *   mine      requests they made, or that were made to them, newest first
 *   open      open covers they could accept, and open shifts they could claim
 *   approvals requests waiting on a manager, when they are one
 */
export async function listFor(member) {
  await expireStale(member.companyId);
  const [worker, manager] = await Promise.all([workerFor(member), isScheduleManager(member)]);
  const workers = await db.worker.findMany({
    where: { companyId: member.companyId, active: true },
    select: WORKER,
  });

  const mine = worker
    ? await db.shiftRequest.findMany({
        where: {
          companyId: member.companyId,
          OR: [{ fromWorkerId: worker.id }, { toWorkerId: worker.id }],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: REQUEST_SELECT,
      })
    : [];

  // Open covers: pending_peer, no toWorker, and this worker is in the cover
  // audience of the person asking — the same rule the accept route applies.
  const openCovers = worker
    ? (
        await db.shiftRequest.findMany({
          where: {
            companyId: member.companyId,
            status: "pending_peer",
            toWorkerId: null,
            fromWorkerId: { not: worker.id },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: REQUEST_SELECT,
        })
      ).filter((r) => mayAccept(r, worker, workers))
    : [];

  const approvals = manager
    ? await db.shiftRequest.findMany({
        where: { companyId: member.companyId, status: "pending_manager" },
        orderBy: { createdAt: "asc" },
        take: 100,
        select: REQUEST_SELECT,
      })
    : [];

  const company = await db.company.findUnique({
    where: { id: member.companyId },
    select: { shiftSwapsNeedApproval: true },
  });

  return {
    me: worker ? { id: worker.id, name: worker.name, title: worker.title } : null,
    manager,
    needsApproval: company?.shiftSwapsNeedApproval !== false,
    mine,
    open: openCovers,
    approvals,
    // The people a trade can name: active, with a login. Titles ride along
    // so the picker can say who somebody is.
    partners: worker ? tradePartners(worker, workers).map((w) => ({ id: w.id, name: w.name, title: w.title })) : [],
  };
}

/**
 * Create a request.
 *
 * @param member  the caller
 * @param body    { kind: "trade"|"cover", shiftId, toWorkerId?, offeredShiftId?, note? }
 *                or { claim: true, shiftId } for an open shift
 */
export async function createRequest(member, body = {}) {
  const worker = await workerFor(member);
  if (!worker) return { error: "You're not on the roster, so there's no shift of yours to give away.", status: 403 };
  const shiftId = typeof body.shiftId === "string" ? body.shiftId : null;
  if (!shiftId) return { error: "Which shift?", status: 400 };
  const shift = await db.shift.findFirst({
    where: { id: shiftId, companyId: member.companyId },
    select: SHIFT,
  });
  if (!shift) return { error: "That shift isn't here.", status: 404 };
  if (!shift.published) return { error: "That shift hasn't been published yet.", status: 409 };
  if (new Date(shift.start) <= new Date()) return { error: "That shift has already started.", status: 409 };
  const ctx = await needsApproval(member.companyId);
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;

  // ── A claim of an open shift ──────────────────────────────────────────
  if (body.claim === true || shift.workerId === null) {
    if (!openShiftEligible(shift, worker)) return { error: "That shift isn't open.", status: 409 };
    const existing = await db.shiftRequest.findFirst({
      where: { shiftId, toWorkerId: worker.id, status: { in: PENDING } },
      select: { id: true },
    });
    if (existing) return { error: "You've already asked for this shift.", status: 409 };
    const status = initialState({ kind: "cover", fromWorkerId: null, needsApproval: ctx.needsApproval });
    if (status === "approved") {
      // No approval needed: the claim IS the assignment, fit-checked like any
      // other swap. Refused here means refused, with the reason.
      const result = await applyApproved(member, {
        companyId: member.companyId,
        shiftId,
        kind: "cover",
        fromWorkerId: null,
        toWorkerId: worker.id,
        offeredShiftId: null,
        note,
        shift,
      }, ctx, { create: true });
      return result;
    }
    const created = await db.shiftRequest.create({
      data: { companyId: member.companyId, shiftId, kind: "cover", fromWorkerId: null, toWorkerId: worker.id, status, note },
      select: REQUEST_SELECT,
    });
    await recordActivity(member, {
      action: "shift_request.claimed",
      entityType: "shiftRequest",
      entityId: created.id,
      summary: `${worker.name} asked to claim an open shift`,
    });
    void notifyEvent({
      companyId: member.companyId,
      type: "shift.request.manager",
      entityId: created.id,
      actorUserId: member.userId,
      params: { fromName: worker.name, toName: worker.name, kind: "claim", when: whenLabel(shift, ctx) },
    });
    return { request: created };
  }

  // ── A trade or a cover of one's own shift ────────────────────────────
  if (shift.workerId !== worker.id) return { error: "That isn't your shift.", status: 403 };
  const kind = body.kind === "trade" ? "trade" : body.kind === "cover" ? "cover" : null;
  if (!kind) return { error: "Trade or cover?", status: 400 };
  const dup = await db.shiftRequest.findFirst({
    where: { shiftId, fromWorkerId: worker.id, status: { in: PENDING } },
    select: { id: true },
  });
  if (dup) return { error: "You already have a request open on this shift.", status: 409 };

  const workers = await db.worker.findMany({ where: { companyId: member.companyId, active: true }, select: WORKER });
  let toWorkerId = typeof body.toWorkerId === "string" && body.toWorkerId ? body.toWorkerId : null;
  let offeredShiftId = null;
  if (kind === "trade") {
    if (!toWorkerId) return { error: "A trade needs somebody to trade with.", status: 400 };
    if (!tradePartners(worker, workers).some((w) => w.id === toWorkerId)) {
      return { error: "You can only trade with a colleague who has a login.", status: 400 };
    }
    if (typeof body.offeredShiftId === "string" && body.offeredShiftId) {
      const offered = await db.shift.findFirst({
        where: { id: body.offeredShiftId, companyId: member.companyId, workerId: toWorkerId, published: true },
        select: { id: true, start: true },
      });
      if (!offered) return { error: "That isn't one of their shifts.", status: 400 };
      if (new Date(offered.start) <= new Date()) return { error: "Their shift has already started.", status: 409 };
      offeredShiftId = offered.id;
    }
  } else if (toWorkerId) {
    if (!coverAudience(worker, workers).some((w) => w.id === toWorkerId)) {
      return { error: "They can't cover this shift.", status: 400 };
    }
  }

  const created = await db.shiftRequest.create({
    data: {
      companyId: member.companyId,
      shiftId,
      kind,
      fromWorkerId: worker.id,
      toWorkerId,
      offeredShiftId,
      status: initialState({ kind, fromWorkerId: worker.id, needsApproval: ctx.needsApproval }),
      note,
    },
    select: REQUEST_SELECT,
  });
  await recordActivity(member, {
    action: `shift_request.${kind}`,
    entityType: "shiftRequest",
    entityId: created.id,
    summary: `${worker.name} asked for a ${kind} on their shift`,
  });

  // The peer, or everyone in the cover audience for an open cover. Workers
  // with no login have no phone to reach and are simply not in the list.
  const audience = toWorkerId
    ? workers.filter((w) => w.id === toWorkerId)
    : coverAudience(worker, workers);
  void notifyEvent({
    companyId: member.companyId,
    type: "shift.request.peer",
    entityId: created.id,
    actorUserId: member.userId,
    recipientUserIds: audience.map((w) => w.userId).filter(Boolean),
    params: { fromName: worker.name, kind, when: whenLabel(shift, ctx) },
  });
  return { request: created };
}

/**
 * Act on a request: accept | decline | cancel | approve.
 */
export async function actOn(member, id, action, body = {}) {
  const [worker, manager] = await Promise.all([workerFor(member), isScheduleManager(member)]);
  const request = await db.shiftRequest.findFirst({
    where: { id, companyId: member.companyId },
    select: REQUEST_SELECT,
  });
  if (!request) return { error: "That request isn't here.", status: 404 };
  const ctx = await needsApproval(member.companyId);

  // The reporting line: a manager may act when the grid says edit_all OR
  // when they are above the requester on the org chart (canApprove in
  // lib/org/reportingLine.js) — the same two doors leave approval uses.
  let isManager = manager;
  if (!isManager && worker) {
    const workers = await db.worker.findMany({
      where: { companyId: member.companyId },
      select: { id: true, managerId: true },
    });
    const byId = new Map(workers.map((w) => [w.id, w]));
    const requesterId = request.fromWorkerId || request.toWorkerId;
    isManager = canApprove({ actorWorkerId: worker.id, workerId: requesterId, byId, hasManagePermission: false });
  }

  // An open cover: the acceptor becomes the peer, if they are in the audience.
  if (action === "accept" && !request.toWorkerId && worker) {
    const workers = await db.worker.findMany({ where: { companyId: member.companyId, active: true }, select: WORKER });
    if (!mayAccept(request, worker, workers)) {
      return { error: "This cover wasn't offered to you.", status: 403 };
    }
  }

  const verdict = transition({
    request: { ...request, shiftStart: request.shift.start, toWorkerId: request.toWorkerId || (action === "accept" ? worker?.id : null) },
    action,
    actor: { workerId: worker?.id || null, isManager },
    options: { needsApproval: ctx.needsApproval },
  });
  if (!verdict.ok) {
    if (verdict.expired) await expireStale(member.companyId);
    return { error: verdict.error, status: 409 };
  }

  const decisionNote = typeof body.note === "string" && body.note.trim() ? body.note.trim().slice(0, 300) : null;
  const toWorkerId = request.toWorkerId || (action === "accept" ? worker.id : null);

  if (verdict.appliesSwap) {
    return applyApproved(member, { ...request, toWorkerId, decisionNote }, ctx, { create: false });
  }

  const updated = await db.shiftRequest.update({
    where: { id: request.id },
    data: {
      status: verdict.next,
      toWorkerId,
      ...(verdict.next === "declined" || verdict.next === "cancelled"
        ? { decidedById: member.userId, decidedAt: new Date(), decisionNote }
        : {}),
    },
    select: REQUEST_SELECT,
  });
  await recordActivity(member, {
    action: `shift_request.${action}`,
    entityType: "shiftRequest",
    entityId: updated.id,
    summary: `${action} on a shift ${updated.kind} request → ${updated.status}`,
  });

  if (verdict.next === "pending_manager") {
    void notifyEvent({
      companyId: member.companyId,
      type: "shift.request.manager",
      entityId: updated.id,
      actorUserId: member.userId,
      params: {
        fromName: updated.fromWorker?.name || updated.toWorker?.name || "",
        toName: updated.toWorker?.name || "",
        kind: updated.kind,
        when: whenLabel(updated.shift, ctx),
      },
    });
  } else if (verdict.next === "declined") {
    void notifyDecided(updated, "declined", member, ctx);
  }
  return { request: updated };
}

/**
 * Move the shift(s) and mark the request approved, in one transaction, after
 * re-running the fit check for whoever is taking each shift. A refusal
 * declines the request with the fit reason as its decision note.
 */
async function applyApproved(member, request, ctx, { create }) {
  const now = new Date();
  const writes = swapWrites(request);
  if (!writes.length) return { error: "There is nobody to give the shift to.", status: 409 };

  // Fit for every incoming person on every shift they take.
  const refusals = [];
  for (const w of writes) {
    const [shift, target] = await Promise.all([
      db.shift.findFirst({ where: { id: w.shiftId, companyId: member.companyId }, select: { start: true, end: true } }),
      db.worker.findFirst({ where: { id: w.workerId, companyId: member.companyId }, select: WORKER }),
    ]);
    if (!shift || !target || target.active === false) {
      refusals.push("That shift or person is no longer here.");
      continue;
    }
    if (!target.userId) continue; // nothing declared, nothing to check — shiftFit says so too
    const [availability, workingHours, leave] = await Promise.all([
      db.availabilitySchedule.findMany({ where: { userId: target.userId }, select: { dayOfWeek: true, startTime: true, endTime: true, timezone: true } }),
      db.workingHours.findMany({ where: { userId: target.userId, companyId: member.companyId }, select: { dayOfWeek: true, startTime: true, endTime: true, timezone: true } }),
      db.leaveRequest.findMany({
        where: { workerId: target.id, status: "approved", startDate: { lte: shift.end }, endDate: { gte: shift.start } },
        select: { status: true, startDate: true, endDate: true, halfDay: true },
      }),
    ]);
    const fit = shiftFit({ start: shift.start, end: shift.end, availability, workingHours, leave });
    if (fit.blocks.length || fit.overridable.length) {
      refusals.push(`${target.name}: ${[...fit.blocks, ...fit.overridable].join(" ")}`);
    }
  }

  if (refusals.length) {
    const note = refusals.join(" ").slice(0, 300);
    const row = create
      ? await db.shiftRequest.create({
          data: {
            companyId: member.companyId,
            shiftId: request.shiftId,
            kind: request.kind,
            fromWorkerId: request.fromWorkerId,
            toWorkerId: request.toWorkerId,
            offeredShiftId: request.offeredShiftId,
            note: request.note,
            status: "declined",
            decisionNote: note,
            decidedAt: now,
          },
          select: REQUEST_SELECT,
        })
      : await db.shiftRequest.update({
          where: { id: request.id },
          data: { status: "declined", toWorkerId: request.toWorkerId, decisionNote: note, decidedById: member.userId, decidedAt: now },
          select: REQUEST_SELECT,
        });
    void notifyDecided(row, "declined", member, ctx);
    return { request: row, refused: refusals, status: 409, error: `Can't apply this swap. ${note}` };
  }

  const row = await db.$transaction(async (tx) => {
    for (const w of writes) {
      await tx.shift.update({ where: { id: w.shiftId }, data: { workerId: w.workerId } });
    }
    const data = {
      status: "approved",
      toWorkerId: request.toWorkerId,
      decidedById: member.userId,
      decidedAt: now,
      decisionNote: request.decisionNote || null,
    };
    return create
      ? tx.shiftRequest.create({
          data: {
            companyId: member.companyId,
            shiftId: request.shiftId,
            kind: request.kind,
            fromWorkerId: request.fromWorkerId,
            offeredShiftId: request.offeredShiftId,
            note: request.note,
            ...data,
          },
          select: REQUEST_SELECT,
        })
      : tx.shiftRequest.update({ where: { id: request.id }, data, select: REQUEST_SELECT });
  });
  await recordActivity(member, {
    action: "shift_request.approved",
    entityType: "shiftRequest",
    entityId: row.id,
    summary: `Shift ${row.kind} approved: ${row.shift?.start ? new Date(row.shift.start).toISOString() : ""} → ${row.toWorker?.name || ""}`,
  });
  void notifyDecided(row, "approved", member, ctx);
  return { request: row };
}

/** Tell both workers (and, for a decline by a peer, nobody else) the outcome. */
async function notifyDecided(row, outcome, member, ctx) {
  const people = [row.fromWorker, row.toWorker].filter(Boolean);
  const ids = people.map((w) => w.userId).filter(Boolean);
  if (!ids.length) return;
  return notifyEvent({
    companyId: row.companyId,
    type: "shift.request.decided",
    entityId: row.id,
    actorUserId: member?.userId || null,
    recipientUserIds: ids,
    params: { kind: row.kind, when: whenLabel(row.shift, ctx), outcome },
  });
}
