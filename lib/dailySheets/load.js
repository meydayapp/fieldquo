// lib/dailySheets/load.js
//
// The database side of a daily sheet: who is on the board for a day, their
// clock stamps, the plan's tasks for them, and the upsells on file for the
// job. Routes call these; the arithmetic they feed is in the pure siblings.

import { db } from "@/lib/db";
import { dayInstants, dateKeyToColumn, columnToDateKey } from "./day";
import { objectivesFromTasks } from "./objectives";

/** The Worker row behind this member's login, or null (office staff with no crew record). */
export async function ownWorker(member) {
  if (!member?.userId) return null;
  return db.worker.findFirst({
    where: { userId: member.userId, companyId: member.companyId },
    select: { id: true, name: true },
  });
}

export async function companyTimezone(companyId) {
  const c = await db.company.findUnique({ where: { id: companyId }, select: { timezone: true } });
  return c?.timezone || null;
}

/**
 * Everything the day view needs for one company-local day, narrowed by
 * `scope` (lib/dailySheets/access.js sheetScope).
 *
 * A worker appears when they clocked in that day, have a sheet, or have a
 * task due that day — the union, so a coordinator sees the person who was
 * meant to be on site and never clocked in.
 */
export async function loadDay({ companyId, dateKey, timezone, scope }) {
  const bounds = dayInstants(dateKey, timezone);
  const column = dateKeyToColumn(dateKey);
  if (!bounds || !column) return null;
  const workerFilter = scope?.workerId ? { id: scope.workerId } : {};

  const [entries, sheets, tasks, workers] = await Promise.all([
    db.timeEntry.findMany({
      where: {
        worker: { companyId, ...workerFilter },
        clockIn: { gte: bounds.start, lt: bounds.next },
      },
      orderBy: { clockIn: "asc" },
      select: {
        id: true, workerId: true, jobId: true, clockIn: true, clockOut: true, hours: true, status: true,
        job: { select: { id: true, title: true } },
        locationStamps: { select: { kind: true, distanceToSiteM: true } },
      },
    }),
    db.dailyObjectiveSheet.findMany({
      where: { companyId, date: column, ...(scope?.workerId ? { workerId: scope.workerId } : {}) },
      include: { job: { select: { id: true, title: true } }, evaluatedBy: { select: { name: true } } },
    }),
    db.task.findMany({
      where: {
        companyId,
        jobId: { not: null },
        status: { in: ["open", "in_progress", "done"] },
        dueDate: { gte: bounds.start, lt: bounds.next },
        ...(scope?.workerId ? { assignedTo: { workerProfile: { id: scope.workerId } } } : {}),
      },
      select: { id: true, title: true, status: true, jobId: true, assignedToId: true, job: { select: { id: true, title: true } } },
    }),
    db.worker.findMany({
      where: { companyId, active: true, ...workerFilter },
      select: { id: true, name: true, userId: true, title: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const byWorker = new Map(workers.map((w) => [w.id, { worker: w, entries: [], sheet: null, tasks: [] }]));
  for (const e of entries) byWorker.get(e.workerId)?.entries.push(e);
  for (const s of sheets) {
    const slot = byWorker.get(s.workerId);
    if (slot) slot.sheet = { ...s, dateKey: columnToDateKey(s.date) };
  }
  const userToWorker = new Map(workers.filter((w) => w.userId).map((w) => [w.userId, w.id]));
  for (const t of tasks) {
    const wid = t.assignedToId ? userToWorker.get(t.assignedToId) : null;
    if (wid) byWorker.get(wid)?.tasks.push(t);
  }

  return [...byWorker.values()]
    .filter((slot) => slot.entries.length || slot.sheet || slot.tasks.length || scope?.workerId)
    .map((slot) => ({
      worker: { id: slot.worker.id, name: slot.worker.name, title: slot.worker.title },
      entries: slot.entries,
      sheet: slot.sheet,
      // The plan's suggestions, in objective shape, for a sheet not yet
      // written. Once a sheet exists its own objectives are the record.
      suggestedObjectives: slot.sheet ? [] : objectivesFromTasks(slot.tasks),
      jobs: [...new Map([...slot.entries.map((e) => e.job), ...slot.tasks.map((t) => t.job)].filter(Boolean).map((j) => [j.id, j])).values()],
    }));
}

/**
 * The add-ons and change orders on file for a job, keyed the way
 * normaliseUpsells expects. Amounts in cents, from the rows — the request
 * never supplies them.
 */
export async function linkedUpsellsForJob({ companyId, jobId }) {
  if (!jobId) return { map: new Map(), options: [] };
  const job = await db.job.findFirst({
    where: { id: jobId, companyId },
    select: {
      quote: { select: { addOns: { where: { selected: true }, select: { id: true, description: true, amount: true } } } },
      changeOrders: { where: { status: "approved" }, select: { id: true, description: true, priceDelta: true } },
    },
  });
  const map = new Map();
  const options = [];
  for (const a of job?.quote?.addOns || []) {
    const amountCents = Math.round(Number(a.amount) * 100);
    map.set(`addon:${a.id}`, { description: a.description, amountCents });
    options.push({ quoteAddOnId: a.id, description: a.description, amountCents });
  }
  for (const c of job?.changeOrders || []) {
    const amountCents = Math.round(Number(c.priceDelta) * 100);
    if (amountCents <= 0) continue;
    map.set(`co:${c.id}`, { description: c.description, amountCents });
    options.push({ changeOrderId: c.id, description: c.description, amountCents });
  }
  return { map, options };
}
