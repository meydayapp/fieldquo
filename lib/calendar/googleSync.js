// lib/calendar/googleSync.js
//
// FieldQuo → Google: the one function every write path calls.
//
//   syncEntity(kind, id)   after an appointment / visit / booking was created,
//                          moved, reassigned, cancelled or deleted. Loads the
//                          row fresh, works out WHO should hold it, and makes
//                          Google agree: creates the event on the assignee's
//                          calendar, updates it if it drifted, deletes it from
//                          anyone who no longer holds it. Idempotent — a second
//                          call with nothing changed makes no Google request
//                          at all (the mirror row's payloadHash decides).
//
//   scheduleSync(kind, id) the same, queued with next/server's after() so a
//                          Google hiccup can never fail the office action that
//                          triggered it. Falls back to fire-and-forget outside
//                          a request scope (the voice webhook's tool loop).
//
//   reconcileMember(...)   the hourly cron: creates what is missing, updates
//                          what drifted, deletes what it created and should
//                          not exist any more. Also the floor under the write
//                          paths this file cannot hook (the public booking
//                          confirm route and the fee settlement live in
//                          another agent's files) — a web-booked visit reaches
//                          Google at the next run at the latest.
//
//   removeMemberMirrors()  disconnect, or "write my visits" switched off:
//                          every event FieldQuo created leaves the calendar,
//                          and nothing else does.
//
// ── The invariant every delete path honours ───────────────────────────────
//
// An event is deleted only when (a) a CalendarMirror row names it and (b) the
// event read back from Google carries the private fieldquoId for that same
// entity — or when Google listed it under FieldQuo's own private property. A
// member's personal events satisfy neither and are unreachable from here.
//
// Every failure is stamped on the connection row (lastError) and filed on
// /platform/errors; nothing here throws past its own boundary.
import { db as realDb } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { getAppOrigin } from "@/lib/appUrl";
import { resolveUserLanguage } from "@/lib/i18n/resolveLanguage";
import { activeGoogle, googleCalendarConfigured } from "./googleClient";
import { getConnectionsForUser, getConnectionForMember, recordSyncOutcome } from "./googleConnection";
import { loadEntity, listMemberEntries } from "./googleEntities";
import {
  buildEventPayload,
  payloadHash,
  entryIsLive,
  isFieldquoEvent,
  entityKey,
  parseEntityKey,
  wantsMeetLink,
  withMeetRequest,
  meetLinkFrom,
  FIELDQUO_APP_KEY,
  FIELDQUO_APP_VALUE,
  FIELDQUO_ID_KEY,
} from "./googleEvent";

/** The labels the event summary is built from, keyed by app catalogue key. */
const LABEL_KEYS = {
  visit: "app.calendar.google.label.visit",
  call: "app.calendar.google.label.call",
  video: "app.calendar.google.label.video",
  appointment: "app.calendar.google.label.appointment",
  jobVisit: "app.calendar.google.label.jobVisit",
  managedBy: "app.calendar.google.label.managedBy",
};

/** How far back a mirror is still kept in step. Older rows are dropped from
 *  the mirror table and the event stays on the calendar as history. */
const KEEP_PAST_DAYS = 30;
/** How far ahead the reconcile looks. */
const LOOKAHEAD_DAYS = 365;

function originOrDefault() {
  try {
    return getAppOrigin();
  } catch {
    return "https://www.fieldquo.com";
  }
}

/**
 * The member's own interface language — an English-speaking estimator gets
 * "Site visit — Jane Doe" on their phone, a French one "Visite sur place".
 * Falls back to English on any doubt; never throws.
 */
async function labelsFor(connection, db) {
  let language = "en";
  try {
    const [user, company] = await Promise.all([
      connection.member?.userId ? db.user.findUnique({ where: { id: connection.member.userId }, select: { language: true } }) : null,
      connection.member?.companyId ? db.company.findUnique({ where: { id: connection.member.companyId }, select: { defaultLanguage: true } }) : null,
    ]);
    language = resolveUserLanguage(user, company);
  } catch {
    language = "en";
  }
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
  const dict = APP_MESSAGES[String(language).toLowerCase()] || {};
  const out = {};
  for (const [name, key] of Object.entries(LABEL_KEYS)) {
    const raw = dict[key] ?? APP_MESSAGES.en[key];
    out[name] = typeof raw === "string" ? raw : null;
  }
  return out;
}

function deps_(deps) {
  return { db: deps.db || realDb, google: deps.google || activeGoogle(), now: deps.now || new Date() };
}

async function fail(connection, message, { db, area = "google_calendar", code = "sync_failed", detail = null } = {}) {
  if (connection?.memberId) await recordSyncOutcome(connection.memberId, { error: message }, db);
  await recordError({
    area,
    code,
    message: `Google Calendar: ${message}`,
    companyId: connection?.member?.companyId || null,
    detail: { memberId: connection?.memberId || null, ...(detail || {}) },
  });
}

/** One access token per connection per run, so a reconcile of forty rows
 *  refreshes once. Never stored. */
function tokenCache() {
  const cache = new Map();
  return async (connection, google) => {
    if (cache.has(connection.memberId)) return cache.get(connection.memberId);
    let res;
    try {
      res = await google.accessTokenFor(connection);
    } catch (err) {
      res = { ok: false, status: 0, message: `stored token unusable: ${err?.message || "decrypt failed"}` };
    }
    cache.set(connection.memberId, res);
    return res;
  };
}

/**
 * Delete ONE mirrored event, checking FieldQuo's mark on the event first.
 *
 * @param mirror      the CalendarMirror row
 * @param connection  the holder's connection, or null when it is gone — then
 *                    only the row can be removed (there is no token to reach
 *                    Google with, and the events went when they disconnected)
 */
async function removeMirror(mirror, connection, { db, google, token }, results) {
  if (connection) {
    const auth = await token(connection, google);
    if (!auth.ok) {
      results.errors.push(`token: ${auth.message}`);
      await fail(connection, `could not reach Google to remove an event (${auth.message})`, { db, code: "token" });
      return false;
    }
    const args = { accessToken: auth.accessToken, calendarId: connection.calendarId || "primary", eventId: mirror.googleEventId };
    const read = await google.getEvent(args);
    if (read.ok) {
      const parsed = parseEntityKey(read.data?.extendedProperties?.private?.[FIELDQUO_ID_KEY]);
      const ours = parsed && isFieldquoEvent(read.data, mirror.entityKind, mirror.entityId);
      if (ours && read.data?.status !== "cancelled") {
        const del = await google.deleteEvent(args);
        if (!del.ok) {
          results.errors.push(`delete: ${del.message}`);
          await fail(connection, `could not delete an event (${del.message})`, { db, code: "delete" });
          return false;
        }
        results.deleted += 1;
      }
      // Not ours (the id was reused by something that is not FieldQuo's — or
      // the member edited the mark away): the event is left exactly as it
      // is and only the row goes.
    } else if (read.status !== 404 && read.status !== 410) {
      results.errors.push(`read: ${read.message}`);
      await fail(connection, `could not read an event before removing it (${read.message})`, { db, code: "read" });
      return false;
    }
  }
  await db.calendarMirror.deleteMany({ where: { id: mirror.id } });
  return true;
}

/**
 * A VIDEO booking gets a Google Meet room minted with the event, and the
 * link is written back onto the FieldQuo rows so the client's confirmation
 * and the manage page can print it (Appointment.meetUrl, Booking.meetUrl).
 * Only at insert, only when no link exists yet, and only when Google
 * actually returned one — a Workspace policy that refuses Meet leaves the
 * column null and the letters silent, never a dead link.
 */
async function insertWithMeet(entry, base, payload, google, db) {
  const meet = wantsMeetLink(entry);
  const body = meet ? withMeetRequest(payload, `fq-${entry.kind}-${entry.id}-${Date.now()}`) : payload;
  const inserted = await google.insertEvent({ ...base, event: body });
  if (inserted.ok && meet) {
    const url = meetLinkFrom(inserted.data);
    if (url) await writeMeetUrl(entry, url, db);
  }
  return inserted;
}

async function writeMeetUrl(entry, url, db) {
  try {
    if (entry.kind === "appointment") {
      await db.appointment.update({ where: { id: entry.id }, data: { meetUrl: url } });
      if (entry.booking?.id) await db.booking.update({ where: { id: entry.booking.id }, data: { meetUrl: url } });
    } else if (entry.kind === "booking") {
      await db.booking.update({ where: { id: entry.id }, data: { meetUrl: url } });
    }
  } catch (err) {
    console.error("[google-calendar] could not store the Meet link:", err?.message);
  }
}

/**
 * Make ONE holder's calendar carry ONE live entry. Creates, patches, or does
 * nothing — decided by the mirror row's payloadHash, never by a read.
 */
async function applyEntry(entry, connection, mine, { db, google, token }, results) {
  const labels = await labelsFor(connection, db);
  const payload = buildEventPayload(entry, { origin: originOrDefault(), labels });
  if (!payload) return;
  const hash = payloadHash(payload);
  if (mine && mine.payloadHash === hash) {
    results.unchanged += 1;
    return;
  }
  const auth = await token(connection, google);
  if (!auth.ok) {
    results.errors.push(`token: ${auth.message}`);
    await fail(connection, `could not get an access token (${auth.message})`, { db, code: "token" });
    return;
  }
  const base = { accessToken: auth.accessToken, calendarId: connection.calendarId || "primary" };

  if (mine) {
    const patched = await google.patchEvent({ ...base, eventId: mine.googleEventId, event: payload });
    if (patched.ok) {
      await db.calendarMirror.update({ where: { id: mine.id }, data: { payloadHash: hash } });
      results.updated += 1;
      return;
    }
    if (patched.status !== 404 && patched.status !== 410) {
      results.errors.push(`patch: ${patched.message}`);
      await fail(connection, `could not update an event (${patched.message})`, { db, code: "patch" });
      return;
    }
    // The member deleted our event by hand. Recreate it — the visit is still
    // booked — under the same mirror row.
    const again = await insertWithMeet(entry, base, payload, google, db);
    if (!again.ok || !again.data?.id) {
      results.errors.push(`insert: ${again.message}`);
      await fail(connection, `could not recreate an event (${again.message})`, { db, code: "insert" });
      return;
    }
    await db.calendarMirror.update({ where: { id: mine.id }, data: { googleEventId: again.data.id, payloadHash: hash } });
    results.created += 1;
    return;
  }

  const inserted = await insertWithMeet(entry, base, payload, google, db);
  if (!inserted.ok || !inserted.data?.id) {
    results.errors.push(`insert: ${inserted.message}`);
    await fail(connection, `could not create an event (${inserted.message})`, { db, code: "insert" });
    return;
  }
  await db.calendarMirror.create({
    data: {
      memberId: connection.memberId,
      entityKind: entry.kind,
      entityId: entry.id,
      googleEventId: inserted.data.id,
      payloadHash: hash,
    },
  });
  results.created += 1;
}

function newResults() {
  return { created: 0, updated: 0, deleted: 0, unchanged: 0, errors: [] };
}

/**
 * Who should hold this entry: the assignee's connection in the entry's
 * company, with writing switched on and the member still active. Null when
 * nobody — which makes every existing mirror a removal.
 */
async function holderFor(entry, db) {
  if (!entry?.assignedToId) return null;
  const conns = await getConnectionsForUser(entry.assignedToId, db, { companyId: entry.companyId || null });
  return conns.find((c) => c.writeEnabled !== false && c.member?.active !== false) || null;
}

/**
 * THE function. Safe to call for any kind/id at any time.
 *
 * @param deps.db / deps.google  injected by the check; real by default
 * @returns {{ created, updated, deleted, unchanged, errors: string[] }}
 */
export async function syncEntity(kind, id, deps = {}) {
  const d = deps_(deps);
  const results = newResults();
  if (!googleCalendarConfigured() && !deps.google) return results;
  const token = tokenCache();
  const ctx = { ...d, token };

  const entry = await loadEntity(kind, id, d.db);
  const mirrors = await d.db.calendarMirror.findMany({ where: { entityKind: kind, entityId: id } });
  const live = Boolean(entry && entryIsLive(entry));
  const holder = live ? await holderFor(entry, d.db) : null;

  for (const m of mirrors) {
    if (holder && m.memberId === holder.memberId) continue;
    const conn = await getConnectionForMember(m.memberId, d.db);
    await removeMirror(m, conn, ctx, results);
  }

  if (holder) {
    const mine = mirrors.find((m) => m.memberId === holder.memberId) || null;
    await applyEntry(entry, holder, mine, ctx, results);
    // Stamped only when Google was actually reached: an unchanged sync is
    // the common case, and a row write per no-op would be most of the load.
    const touched = results.created + results.updated + results.deleted > 0;
    if (!results.errors.length && touched) await recordSyncOutcome(holder.memberId, {}, d.db);
  }
  return results;
}

/**
 * The same, queued behind the response. Never throws, never awaited by the
 * caller — the office's action has already succeeded by the time this runs.
 */
export function scheduleSync(kind, id) {
  if (!kind || !id) return;
  const run = () =>
    syncEntity(kind, id).catch((err) => console.error(`[google-calendar] sync ${kind}:${id} failed:`, err?.message));
  // `next/server` is imported lazily, not at the top: this module is reached
  // by lib/voice/availability.js, which the bare-node checks load under the
  // alias loader alone, and bare node cannot resolve that specifier (the
  // db-stub and memory-db loaders map it; the plain one does not). The
  // bundler resolves a literal dynamic import at build time, and the async
  // context after() reads survives the promise hop. after() itself throws
  // outside a request scope; either way the caller's write has committed.
  import("next/server")
    .then(({ after }) => {
      try {
        after(run);
      } catch {
        void run();
      }
    })
    .catch(() => void run());
}

/**
 * Everything FieldQuo wrote to this member's calendar, gone. Used by
 * disconnect (with the connection still readable, so the events can be
 * deleted before the token is destroyed) and by "write my visits" → off.
 */
export async function removeMemberMirrors(memberId, deps = {}) {
  const d = deps_(deps);
  const results = newResults();
  const connection = deps.connection || (await getConnectionForMember(memberId, d.db));
  const token = tokenCache();
  const mirrors = await d.db.calendarMirror.findMany({ where: { memberId } });
  for (const m of mirrors) {
    await removeMirror(m, connection, { ...d, token }, results);
  }
  return results;
}

/**
 * One member, brought fully into step. See the file header for what it does
 * and why it exists beside syncEntity.
 *
 * @param deps.listEntries  (member, { from, to }) → feed entries; the feed
 *                          by default, injectable for the check
 */
export async function reconcileMember(connection, deps = {}) {
  const d = deps_(deps);
  const results = newResults();
  if (!connection?.member) return results;
  const listEntries = deps.listEntries || ((m, range) => listMemberEntries(m, range, d.db));
  const token = tokenCache();
  const ctx = { ...d, token };
  const now = d.now;
  const from = new Date(now.getTime() - KEEP_PAST_DAYS * 86400000);
  const to = new Date(now.getTime() + LOOKAHEAD_DAYS * 86400000);

  let entries;
  try {
    entries = await listEntries(connection.member, { from, to });
  } catch (err) {
    results.errors.push(`feed: ${err?.message}`);
    await fail(connection, `could not read the schedule (${err?.message})`, { db: d.db, code: "feed" });
    return results;
  }
  const entriesByKey = new Map();
  for (const e of entries) entriesByKey.set(entityKey(e.kind, e.id), { ...e, companyId: e.companyId || connection.member.companyId });

  const mirrors = await d.db.calendarMirror.findMany({ where: { memberId: connection.memberId } });
  const mirrorByKey = new Map(mirrors.map((m) => [entityKey(m.entityKind, m.entityId), m]));

  // ── Writing switched off: every mirror goes, nothing is created ─────────
  if (connection.writeEnabled === false) {
    for (const m of mirrors) await removeMirror(m, connection, ctx, results);
    if (!results.errors.length) await recordSyncOutcome(connection.memberId, {}, d.db);
    return results;
  }

  // ── Mirrors that no longer belong ───────────────────────────────────────
  for (const m of mirrors) {
    const key = entityKey(m.entityKind, m.entityId);
    const inWindow = entriesByKey.get(key);
    if (inWindow && entryIsLive(inWindow)) continue;
    if (inWindow) {
      // Cancelled or completed inside the window: the event goes.
      await removeMirror(m, connection, ctx, results);
      continue;
    }
    // Outside the window, or gone. Ask the row itself.
    const entity = await loadEntity(m.entityKind, m.entityId, d.db);
    const stillMine = entity && entryIsLive(entity) && entity.assignedToId === connection.member.userId;
    if (!stillMine) {
      await removeMirror(m, connection, ctx, results);
      continue;
    }
    // Live, mine, but before the window: history. Stop tracking, keep the event.
    if (new Date(entity.scheduledAt) < from) await d.db.calendarMirror.deleteMany({ where: { id: m.id } });
  }

  // ── Orphans FieldQuo created and lost track of ──────────────────────────
  //
  // BEFORE the create step, and that order is the bug this replaced: an event
  // for a live entity whose mirror row was lost must be ADOPTED (the row
  // recreated against the existing event) — run the create step first and it
  // inserts a second event, then the sweep trips over the row it just made.
  //
  // Listed by FieldQuo's own private property, so nothing the member made can
  // be in this list; anything FieldQuo-marked that names no live entity of
  // this member's is deleted.
  const auth = await token(connection, d.google);
  if (auth.ok) {
    const known = new Set([...mirrorByKey.values()].map((m) => m.googleEventId));
    let pageToken = null;
    let pages = 0;
    do {
      const page = await d.google.listByPrivateProperty({
        accessToken: auth.accessToken,
        calendarId: connection.calendarId || "primary",
        key: FIELDQUO_APP_KEY,
        value: FIELDQUO_APP_VALUE,
        pageToken,
      });
      if (!page.ok) {
        results.errors.push(`list: ${page.message}`);
        break;
      }
      for (const ev of page.data?.items || []) {
        if (!ev?.id || known.has(ev.id) || ev.status === "cancelled") continue;
        const parsed = parseEntityKey(ev.extendedProperties?.private?.[FIELDQUO_ID_KEY]);
        const key = parsed ? entityKey(parsed.kind, parsed.id) : null;
        const entry = key ? entriesByKey.get(key) : null;
        if (entry && entryIsLive(entry) && !mirrorByKey.has(key)) {
          // payloadHash null: the create step below brings the adopted event
          // up to date with one PATCH rather than trusting whatever it holds.
          const row = await d.db.calendarMirror.create({
            data: { memberId: connection.memberId, entityKind: parsed.kind, entityId: parsed.id, googleEventId: ev.id, payloadHash: null },
          });
          mirrorByKey.set(key, row);
          known.add(ev.id);
          continue;
        }
        const del = await d.google.deleteEvent({ accessToken: auth.accessToken, calendarId: connection.calendarId || "primary", eventId: ev.id });
        if (del.ok) results.deleted += 1;
        else results.errors.push(`orphan: ${del.message}`);
      }
      pageToken = page.data?.nextPageToken || null;
      pages += 1;
    } while (pageToken && pages < 20);
  }

  // ── Missing or drifted ──────────────────────────────────────────────────
  for (const [key, entry] of entriesByKey) {
    if (!entryIsLive(entry)) continue;
    await applyEntry(entry, connection, mirrorByKey.get(key) || null, ctx, results);
  }

  if (results.errors.length) await fail(connection, results.errors[0], { db: d.db, code: "reconcile", detail: { errors: results.errors.slice(0, 5) } });
  else await recordSyncOutcome(connection.memberId, {}, d.db);
  return results;
}

/**
 * Every connected member, one after another. The cron's whole body.
 */
export async function reconcileAll(deps = {}) {
  const d = deps_(deps);
  const rows = await d.db.memberGoogleCalendar.findMany({
    include: { member: { select: { id: true, userId: true, companyId: true, active: true, role: true } } },
  });
  const summary = { members: 0, created: 0, updated: 0, deleted: 0, unchanged: 0, failed: 0 };
  for (const connection of rows) {
    if (!connection.member || connection.member.active === false) continue;
    summary.members += 1;
    try {
      const r = await reconcileMember(connection, deps);
      summary.created += r.created;
      summary.updated += r.updated;
      summary.deleted += r.deleted;
      summary.unchanged += r.unchanged;
      if (r.errors.length) summary.failed += 1;
    } catch (err) {
      summary.failed += 1;
      await fail(connection, `reconcile threw (${err?.message})`, { db: d.db, code: "reconcile_throw" });
    }
  }
  return summary;
}
