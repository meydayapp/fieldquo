// lib/company/memberActivity.js
//
// Member.lastActiveAt: the one write (the /app keepalive) and the two reads
// (the platform console's list badge and the company page's per-member list).
// The words those reads turn into live in lib/platform/companyPresence.js,
// which is pure; this file is the database half.

import { db } from "@/lib/db";

/**
 * How long a stamp stays good before it is rewritten.
 *
 * The browser beats every minute while a person is using a visible tab
 * (app/components/layout/ActivityBeat.js); an unconditional write would be a
 * row update per member per minute for a fact the console prints to the
 * minute at best. Two minutes keeps a present person's stamp under ~3 minutes
 * old, inside the five-minute "Online now" window (ONLINE_WINDOW_MS), with
 * one missed beat to spare. Same shape as the reps' SEEN_REFRESH_MS.
 */
export const ACTIVE_STAMP_REFRESH_MS = 2 * 60 * 1000;

/**
 * May this resolved member be stamped?
 *
 * Only a real person's own membership. getCurrentMember hands back a
 * support session as `impersonation: true` — read-only with `id: null`, or a
 * demo sandbox that borrows the seeded owner's REAL member id. The second is
 * why this checks the flag and not just the id: a sales demo run inside a
 * fixture company would otherwise stamp its owner "Online now", and a
 * superadmin looking at a customer must never make that customer look active.
 */
export function shouldStamp(member) {
  if (!member || typeof member !== "object") return false;
  if (member.impersonation) return false;
  if (member.impersonationMode) return false;
  return typeof member.id === "string" && member.id.length > 0;
}

/**
 * Stamp this member as active now, if the last stamp is older than the
 * refresh interval. Returns true when a row was written.
 *
 * Conditional in the WHERE rather than read-then-write: two tabs beating at
 * once would otherwise both decide to write. The value is the server's clock
 * and nothing from the request — there is no input that changes what lands.
 *
 * Never throws. A failed stamp is a fact we did not record; turning that into
 * a failed request would put an error in a contractor's console over a
 * badge only FieldQuo staff ever see.
 */
export async function stampMemberActive(memberId, now = new Date(), client = db) {
  try {
    if (typeof memberId !== "string" || !memberId) return false;
    const res = await client.member.updateMany({
      where: {
        id: memberId,
        active: true,
        OR: [
          { lastActiveAt: null },
          { lastActiveAt: { lt: new Date(now.getTime() - ACTIVE_STAMP_REFRESH_MS) } },
        ],
      },
      data: { lastActiveAt: now },
    });
    return (res?.count || 0) > 0;
  } catch (err) {
    console.error("[memberActivity] could not stamp lastActiveAt:", err?.message);
    return false;
  }
}

/** The later of two Dates (either may be null). */
function later(a, b) {
  if (!a) return b || null;
  if (!b) return a;
  return b > a ? b : a;
}

/**
 * Newest sign-in evidence per membership, keyed `${userId}:${companyId}`.
 *
 * Two witnesses (lib/platform/companyPresence.js says why both):
 *   Session.createdAt       per USER — a login is not tied to a company, so
 *                           it is credited to every company the user is in.
 *   AccountDevice.lastSeenAt per (user, company) — the seat-sharing sampler,
 *                           which a support session never reaches.
 * createdAt only on Session — updatedAt moves on a refresh, not a person.
 *
 * `companyId` narrows the device read to one company (the company page);
 * omitted, it reads every company's (the list).
 */
async function latestSignInByMembership(members, client, companyId = null) {
  const userIds = [...new Set(members.map((m) => m.userId).filter(Boolean))];
  if (!userIds.length) return new Map();
  const [sessions, devices] = await Promise.all([
    client.session.groupBy({
      by: ["userId"],
      where: { userId: { in: userIds } },
      _max: { createdAt: true },
    }),
    client.accountDevice.groupBy({
      by: ["userId", "companyId"],
      where: companyId ? { companyId } : { userId: { in: userIds } },
      _max: { lastSeenAt: true },
    }),
  ]);
  const byUser = new Map(sessions.map((r) => [r.userId, r._max?.createdAt || null]));
  const byMembership = new Map(
    devices.map((r) => [`${r.userId}:${r.companyId}`, r._max?.lastSeenAt || null]),
  );
  const out = new Map();
  for (const m of members) {
    const key = `${m.userId}:${m.companyId}`;
    out.set(key, later(byUser.get(m.userId) || null, byMembership.get(key) || null));
  }
  return out;
}

/**
 * Every company's presence inputs, for the list's badge and its minute poll.
 *
 * Four reads whatever the number of companies — the companies' creation
 * dates, the members (user, company, stamp), and one aggregate each over
 * Session and AccountDevice — rather than a query per row. The per-company
 * max is taken here in memory from the member rows, which are already the
 * smallest thing that can answer it.
 *
 * @returns {Promise<Array<{ id, isDemo, companyCreatedAt, memberCount, lastActiveAt, signedInAt }>>}
 */
export async function presenceForCompanies(client = db) {
  const [companies, members] = await Promise.all([
    client.company.findMany({ select: { id: true, isDemo: true, createdAt: true } }),
    client.member.findMany({ select: { companyId: true, userId: true, lastActiveAt: true } }),
  ]);
  const signIns = await latestSignInByMembership(members, client);

  const byCompany = new Map();
  for (const m of members) {
    const row = byCompany.get(m.companyId) || { memberCount: 0, lastActiveAt: null, signedInAt: null };
    row.memberCount++;
    row.lastActiveAt = later(row.lastActiveAt, m.lastActiveAt || null);
    row.signedInAt = later(row.signedInAt, signIns.get(`${m.userId}:${m.companyId}`) || null);
    byCompany.set(m.companyId, row);
  }

  return companies.map((c) => {
    const p = byCompany.get(c.id) || { memberCount: 0, lastActiveAt: null, signedInAt: null };
    return {
      id: c.id,
      isDemo: Boolean(c.isDemo),
      companyCreatedAt: c.createdAt,
      memberCount: p.memberCount,
      lastActiveAt: p.lastActiveAt,
      signedInAt: p.signedInAt,
    };
  });
}

/**
 * One company's members with their own presence inputs, for the company page.
 * Returns null when the company does not exist.
 */
export async function presenceForMembers(companyId, client = db) {
  const company = await client.company.findUnique({
    where: { id: companyId },
    select: { id: true, createdAt: true, isDemo: true },
  });
  if (!company) return null;

  const members = await client.member.findMany({
    where: { companyId },
    select: {
      id: true,
      userId: true,
      role: true,
      active: true,
      createdAt: true,
      lastActiveAt: true,
      user: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const signIns = await latestSignInByMembership(
    members.map((m) => ({ userId: m.userId, companyId })),
    client,
    companyId,
  );

  return {
    id: company.id,
    isDemo: Boolean(company.isDemo),
    companyCreatedAt: company.createdAt,
    members: members.map((m) => ({
      id: m.id,
      name: m.user?.name || null,
      email: m.user?.email || null,
      role: m.role,
      active: m.active,
      joinedAt: m.createdAt,
      lastActiveAt: m.lastActiveAt,
      signedInAt: signIns.get(`${m.userId}:${companyId}`) || null,
    })),
  };
}
