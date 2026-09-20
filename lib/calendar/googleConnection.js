// lib/calendar/googleConnection.js
//
// The MemberGoogleCalendar row: every read and write of it, in one file, so
// the four routes and the sync cannot disagree about what "connected" means
// or let the refresh token out. Takes `db` as an argument (defaulting to the
// real client) for the same reason lib/calendar/googleSync.js does: the
// check executes these against scripts/fixtures/memoryPrisma.mjs.
import { db as realDb } from "@/lib/db";
import { encryptToken } from "@/lib/meta/tokenCrypto";

export const MY_CALENDAR_SETTINGS_PATH = "/app/settings/my-calendar";

/** The row for one member, or null. Includes the member's userId/companyId
 *  because every sync decision needs them and the join is one read. */
export async function getConnectionForMember(memberId, db = realDb) {
  if (!memberId) return null;
  return db.memberGoogleCalendar.findUnique({
    where: { memberId },
    include: { member: { select: { id: true, userId: true, companyId: true, active: true } } },
  });
}

/**
 * Every connection behind one USER — assignments are keyed by User id
 * (Appointment.assignedToId, JobVisit.assignedToId, EventType.userId), and
 * a person in two companies has two Member rows. Two reads rather than a
 * relation filter so the memory fixture can answer it, and because a Member
 * list per user is a handful of rows at most.
 */
export async function getConnectionsForUser(userId, db = realDb, { companyId = null } = {}) {
  if (!userId) return [];
  const members = await db.member.findMany({
    where: { userId, ...(companyId ? { companyId } : {}) },
    select: { id: true, userId: true, companyId: true, active: true },
  });
  if (!members.length) return [];
  const rows = await db.memberGoogleCalendar.findMany({
    where: { memberId: { in: members.map((m) => m.id) } },
  });
  const byId = new Map(members.map((m) => [m.id, m]));
  return rows.map((r) => ({ ...r, member: byId.get(r.memberId) || null }));
}

/** Connect, or reconnect: the fresh refresh token replaces the old one. */
export async function saveConnection({ memberId, refreshToken, email, calendarId = "primary" }, db = realDb) {
  const refreshTokenEnc = encryptToken(refreshToken);
  return db.memberGoogleCalendar.upsert({
    where: { memberId },
    create: { memberId, refreshTokenEnc, email: email || null, calendarId, connectedAt: new Date(), lastError: null },
    update: { refreshTokenEnc, email: email || null, calendarId, connectedAt: new Date(), lastError: null, lastSyncAt: null },
  });
}

/** The two switches. Undefined leaves a switch alone; anything else is coerced. */
export async function updateSwitches(memberId, { writeEnabled, busyReadEnabled } = {}, db = realDb) {
  const data = {};
  if (writeEnabled !== undefined) data.writeEnabled = Boolean(writeEnabled);
  if (busyReadEnabled !== undefined) data.busyReadEnabled = Boolean(busyReadEnabled);
  if (!Object.keys(data).length) return getConnectionForMember(memberId, db);
  return db.memberGoogleCalendar.update({ where: { memberId }, data });
}

export async function deleteConnection(memberId, db = realDb) {
  const existing = await db.memberGoogleCalendar.findUnique({ where: { memberId } });
  if (!existing) return null;
  await db.memberGoogleCalendar.delete({ where: { memberId } });
  return existing;
}

/** Stamp the outcome of a sync on the row. Success clears the last error. */
export async function recordSyncOutcome(memberId, { error = null } = {}, db = realDb) {
  try {
    await db.memberGoogleCalendar.update({
      where: { memberId },
      data: error ? { lastError: String(error).slice(0, 500) } : { lastError: null, lastSyncAt: new Date() },
    });
  } catch {
    // The row may have been disconnected mid-sync. Nothing to stamp.
  }
}

/**
 * What the browser may see. No token, no ciphertext — the same rule
 * lib/meta/pageConnection.js's publicPageConnectionShape enforces, and the
 * check greps the output for both.
 */
export function publicConnectionShape(row) {
  if (!row) return null;
  return {
    email: row.email || null,
    calendarId: row.calendarId || "primary",
    connectedAt: row.connectedAt ? new Date(row.connectedAt).toISOString() : null,
    lastSyncAt: row.lastSyncAt ? new Date(row.lastSyncAt).toISOString() : null,
    lastError: row.lastError || null,
    writeEnabled: row.writeEnabled !== false,
    busyReadEnabled: row.busyReadEnabled !== false,
  };
}
