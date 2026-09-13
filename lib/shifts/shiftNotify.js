// lib/shifts/shiftNotify.js
//
// Telling the person on a shift that it exists, moved or is gone — and the
// audit row beside it. Called by app/api/shifts/* and app/api/shifts/publish
// AFTER the write has committed, fire-and-forget, the way every notifyEvent
// call site works (lib/notifications/notify.js).
//
// ── Only published shifts reach a phone ─────────────────────────────────────
//
// A draft is the manager's working copy. Creating one, moving one, deleting
// one, says nothing to anybody; the moment the worker learns about a shift is
// `published` flipping to true, and after that every change to its times, job
// or existence is news. `shiftEvents()` is the pure decision, executed by
// scripts/check-shift-notify.mjs against every transition.
//
// ── The sentence is composed HERE, in the recipient's language ──────────────
//
// See "shift.published" in lib/notifications/catalog.js for why this type
// departs from "compose at read time": one reader, known at write time, and
// a date that must be in the company's zone, not the phone's.

import { db } from "@/lib/db";
import { notifyEvent } from "@/lib/notifications/notify";
import { appSentence } from "@/lib/notify/push";
import { recordActivity } from "@/lib/activity/log";

/**
 * What a change to one shift means to the person on it.
 *
 * @param {object} p
 * @param {object|null} p.before  the row before ({ workerId, start, end, jobId, published }), null on create
 * @param {object|null} p.after   the row after, null on delete
 * @returns {Array<{ type: "shift.published"|"shift.changed"|"shift.cancelled", workerId: string }>}
 *
 * A shift moving between two workers while published is a cancellation for
 * one and a publication for the other; a draft becoming published is a
 * publication; a published shift's times or job moving is a change; a
 * published shift deleted or unpublished is a cancellation. Everything else —
 * a note edited, a draft moved, a draft deleted — is silence.
 */
export function shiftEvents({ before, after } = {}) {
  const out = [];
  const wasLive = Boolean(before?.published && before?.workerId);
  const isLive = Boolean(after?.published && after?.workerId);
  if (!wasLive && !isLive) return out;
  if (!wasLive && isLive) return [{ type: "shift.published", workerId: after.workerId }];
  if (wasLive && !isLive) return [{ type: "shift.cancelled", workerId: before.workerId }];
  // Both live.
  if (String(before.workerId) !== String(after.workerId)) {
    return [
      { type: "shift.cancelled", workerId: before.workerId },
      { type: "shift.published", workerId: after.workerId },
    ];
  }
  const ms = (v) => new Date(v).getTime();
  const moved = ms(before.start) !== ms(after.start) || ms(before.end) !== ms(after.end);
  const rejobbed = (before.jobId || null) !== (after.jobId || null);
  if (moved || rejobbed) out.push({ type: "shift.changed", workerId: after.workerId });
  return out;
}

/** "Sophie Dubois, 12 rue Principale" — the block's own label, or "". */
export function placeOf(job) {
  if (!job) return "";
  return [job.client?.name, job.siteAddress].filter(Boolean).join(", ") || job.title || "";
}

const fmtCache = new Map();
function fmt(language, timeZone, opts) {
  const key = `${language}|${timeZone}|${JSON.stringify(opts)}`;
  let f = fmtCache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(language || "en", { timeZone, ...opts });
    } catch {
      f = new Intl.DateTimeFormat("en", { timeZone: "UTC", ...opts });
    }
    fmtCache.set(key, f);
  }
  return f;
}

/**
 * "Mon 14 Sep, 8:00 – 16:00" in a language and zone. Pure; exported for the
 * check script. A shift that ends on another day carries the second day.
 */
export function describeShiftWhen({ start, end, language = "en", timeZone = "UTC" } = {}) {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const day = fmt(language, timeZone, { weekday: "short", day: "numeric", month: "short" });
  const time = fmt(language, timeZone, { hour: "numeric", minute: "2-digit" });
  const sameDay = day.format(s) === day.format(e);
  return sameDay
    ? `${day.format(s)}, ${time.format(s)} – ${time.format(e)}`
    : `${day.format(s)}, ${time.format(s)} – ${day.format(e)}, ${time.format(e)}`;
}

/** The recipient's language and the company's zone, for the sentence. */
async function contextFor(companyId, userId) {
  const [user, company] = await Promise.all([
    userId ? db.user.findUnique({ where: { id: userId }, select: { language: true } }) : null,
    db.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true, timezone: true } }),
  ]);
  return {
    language: user?.language || company?.defaultLanguage || "en",
    timeZone: company?.timezone || "America/Toronto",
  };
}

/**
 * The `when` param for a set of a worker's shifts: the first, with its place,
 * and "and N more" when there are several — each piece a whole sentence from
 * the catalogue in the recipient's language, never a fragment glued on.
 */
export async function composeWhen(shifts, { language, timeZone }) {
  const list = [...shifts].sort((a, b) => new Date(a.start) - new Date(b.start));
  if (!list.length) return "";
  const first = list[0];
  let when = describeShiftWhen({ start: first.start, end: first.end, language, timeZone });
  const place = placeOf(first.job);
  if (place) when = (await appSentence(language, "app.notif.shift.whenAt", { when, place })) || `${when} — ${place}`;
  if (list.length > 1) {
    when = (await appSentence(language, "app.notif.shift.andMore", { when, n: list.length - 1 })) || when;
  }
  return when;
}

const WORKER_SELECT = { id: true, name: true, userId: true };

/**
 * Deliver one event type to one worker about their shifts. Nothing for a
 * worker with no login — there is no phone to reach — and nothing when the
 * actor IS the worker (notifyEvent's own actor filter).
 */
export async function notifyWorkerShifts({ companyId, type, worker, shifts, actorUserId }) {
  if (!worker?.userId || !shifts?.length) return { created: false, reason: "no_recipient" };
  const ctx = await contextFor(companyId, worker.userId);
  const when = await composeWhen(shifts, ctx);
  return notifyEvent({
    companyId,
    type,
    entityId: shifts[0].id,
    params: { when },
    actorUserId: actorUserId || null,
    recipientUserIds: [worker.userId],
  });
}

/**
 * After a publish: the newly-live shifts, grouped per worker, one
 * notification each. `shifts` carry { id, workerId, start, end, job }.
 */
export async function notifyPublished({ companyId, shifts, actorUserId }) {
  const byWorker = new Map();
  for (const s of shifts || []) {
    if (!s?.workerId) continue;
    if (!byWorker.has(s.workerId)) byWorker.set(s.workerId, []);
    byWorker.get(s.workerId).push(s);
  }
  if (!byWorker.size) return;
  const workers = await db.worker.findMany({
    where: { id: { in: [...byWorker.keys()] }, companyId },
    select: WORKER_SELECT,
  });
  await Promise.all(
    workers.map((w) =>
      notifyWorkerShifts({ companyId, type: "shift.published", worker: w, shifts: byWorker.get(w.id), actorUserId }).catch(() => {}),
    ),
  );
}

/**
 * After one shift was created, edited or deleted: whatever shiftEvents says.
 * `before`/`after` carry { id, workerId, start, end, jobId, published, job? }.
 */
export async function notifyShiftChange({ companyId, before, after, actorUserId }) {
  const events = shiftEvents({ before, after });
  if (!events.length) return;
  const ids = [...new Set(events.map((e) => e.workerId))];
  const workers = await db.worker.findMany({ where: { id: { in: ids }, companyId }, select: WORKER_SELECT });
  const byId = new Map(workers.map((w) => [w.id, w]));
  // The cancelled sentence describes the shift as it WAS; the others as it is.
  const jobFor = async (row) => {
    if (!row) return null;
    if (row.job !== undefined) return row.job;
    if (!row.jobId) return null;
    return db.job.findUnique({ where: { id: row.jobId }, select: { title: true, siteAddress: true, client: { select: { name: true } } } });
  };
  for (const ev of events) {
    const worker = byId.get(ev.workerId);
    if (!worker) continue;
    const row = ev.type === "shift.cancelled" ? before : after;
    const shift = { ...row, job: await jobFor(row) };
    await notifyWorkerShifts({ companyId, type: ev.type, worker, shifts: [shift], actorUserId }).catch(() => {});
  }
}

// ── The audit row ───────────────────────────────────────────────────────────
//
// recordActivity is what time entries, leave and payroll already write; a
// shift edit was the one people-record with no trail. The English summary is
// required (lib/activity/log.js); the key renders in the reader's language.

const iso = (v) => (v ? new Date(v).toISOString() : null);

/**
 * @param {object} member   the actor, from memberOrRefusal
 * @param {object} p
 * @param {"created"|"changed"|"deleted"|"published"} p.verb
 * @param {object} p.shift  { id, workerId, start, end, jobId, published }
 * @param {object} [p.before] the row before an edit
 * @param {string} [p.workerName]
 * @param {string} [p.jobTitle]
 * @param {number} [p.count]  for a bulk publish
 */
export async function recordShiftActivity(member, { verb, shift, before = null, workerName = "", jobTitle = "", count = null } = {}) {
  const when = describeShiftWhen({ start: shift?.start, end: shift?.end, language: "en", timeZone: "UTC" });
  const wasWhen = before ? describeShiftWhen({ start: before.start, end: before.end, language: "en", timeZone: "UTC" }) : "";
  const who = workerName || "an open shift";
  const summaries = {
    created: `Added a shift for ${who}: ${when} (UTC)${jobTitle ? ` on ${jobTitle}` : ""}${shift?.published ? "" : " — draft"}`,
    changed: `Changed ${who}'s shift: ${wasWhen} → ${when} (UTC)${jobTitle ? ` on ${jobTitle}` : ""}`,
    deleted: `Deleted ${who}'s shift: ${when} (UTC)${shift?.published ? " — it was published" : " — draft"}`,
    published: count != null ? `Published ${count} shift(s)` : `Published ${who}'s shift: ${when} (UTC)`,
  };
  const keys = {
    created: "app.activity.event.shiftCreated",
    changed: "app.activity.event.shiftChanged",
    deleted: "app.activity.event.shiftDeleted",
    published: count != null ? "app.activity.event.shiftsPublished" : "app.activity.event.shiftPublished",
  };
  await recordActivity(member, {
    action: `shift.${verb}`,
    entityType: "shift",
    entityId: shift?.id || null,
    summary: summaries[verb],
    summaryKey: keys[verb],
    summaryParams: { name: who, when, was: wasWhen, job: jobTitle, count: count ?? 0 },
    metadata: {
      workerId: shift?.workerId || null,
      jobId: shift?.jobId || null,
      published: Boolean(shift?.published),
      start: iso(shift?.start),
      end: iso(shift?.end),
      ...(before ? { before: { start: iso(before.start), end: iso(before.end), jobId: before.jobId || null, workerId: before.workerId || null } } : {}),
    },
  });
}

// ── The three hooks the routes call ─────────────────────────────────────────
//
// One line each at the call site, after the write. Each swallows its own
// failure: a notification or an audit row must never fail the shift that
// was just saved (the same contract recordActivity and notifyEvent make).

/** POST /api/shifts — every shift the request created, as drafts. */
export async function auditCreatedShifts(member, list, worker) {
  for (const s of Array.isArray(list) ? list : []) {
    if (!s) continue;
    await recordShiftActivity(member, { verb: "created", shift: s, workerName: worker?.name || "" }).catch(() => {});
  }
}

/** PATCH /api/shifts/[id] — `before` is the row as loaded, `after` as saved. */
export async function afterShiftUpdate(member, before, saved) {
  if (!before || !saved?.id) return;
  // Re-read the row rather than trust the route's select: the PATCH answers
  // the modal with a shape that carries no jobId, and a job change is one of
  // the three things the worker is told about.
  const after = await db.shift
    .findFirst({
      where: { id: saved.id, companyId: member.companyId },
      select: {
        id: true,
        workerId: true,
        start: true,
        end: true,
        jobId: true,
        published: true,
        job: { select: { title: true, siteAddress: true, client: { select: { name: true } } } },
      },
    })
    .catch(() => null);
  if (!after) return;
  try {
    const worker = before.workerId || after.workerId
      ? await db.worker.findFirst({
          where: { id: after.workerId || before.workerId, companyId: member.companyId },
          select: { name: true },
        })
      : null;
    const flipped = !before.published && after.published;
    const ms = (v) => new Date(v).getTime();
    const moved = ms(before.start) !== ms(after.start) || ms(before.end) !== ms(after.end) || (before.jobId || null) !== (after.jobId || null);
    if (flipped) {
      await recordShiftActivity(member, { verb: "published", shift: after, workerName: worker?.name || "", jobTitle: after.job?.title || "" });
    }
    if (moved || (!flipped && before.published !== after.published)) {
      await recordShiftActivity(member, { verb: "changed", shift: after, before, workerName: worker?.name || "", jobTitle: after.job?.title || "" });
    }
  } catch (err) {
    console.error("[shifts] audit failed:", err?.message);
  }
  notifyShiftChange({ companyId: member.companyId, before, after, actorUserId: member.userId || null }).catch(() => {});
}

/** DELETE /api/shifts/[id] — `before` is the row that was just removed. */
export async function afterShiftDelete(member, before) {
  if (!before) return;
  try {
    const worker = before.workerId
      ? await db.worker.findFirst({ where: { id: before.workerId, companyId: member.companyId }, select: { name: true } })
      : null;
    await recordShiftActivity(member, { verb: "deleted", shift: before, workerName: worker?.name || "" });
  } catch (err) {
    console.error("[shifts] audit failed:", err?.message);
  }
  notifyShiftChange({ companyId: member.companyId, before, after: null, actorUserId: member.userId || null }).catch(() => {});
}
