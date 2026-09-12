// lib/company/chat/store.js
//
// The ONE door to a company's crew chat. Every read and every write of
// CompanyChatRoom / CompanyChatMember / CompanyChatMessage goes through here,
// and every one of them is scoped by the member's companyId before anything
// else is asked.
//
// ══ Tenant scope is the first clause of every query ═══════════════════════
//
// A roomId is a string the browser sent. What makes it the caller's is not
// that it exists but that it belongs to the caller's company AND the caller
// holds an open membership in it — and both are queried, never trusted. A
// member of company A asking for a room of company B gets the same 404 a
// room that does not exist gets: not-a-member and not-there answer the same
// way on purpose, so the refusal confirms nothing about somebody else's
// conversation. scripts/check-company-chat.mjs EXECUTES that with two
// companies in one fake database.
//
// ══ Refusals are values, not throws ═══════════════════════════════════════
//
// Every write returns { ok: true, ... } or { ok: false, status, code, error }.
// The route hands `status`, `error` and `code` straight to NextResponse; the
// CODE is what the screen translates (lib/company/chat/client.js), the
// sentence is what a log sees. Same shape as lib/staff/store.js.
//
// ══ `client` is injectable ════════════════════════════════════════════════
//
// Every function takes { client = db }, the way lib/staff/teams.js does, so
// the check drives the real membership rule and the real refusals against an
// in-memory stand-in rather than reading them.
import { db } from "@/lib/db";
import { parseMentions } from "@/lib/staff/mentions";
import { appSentence, pushToUsers } from "@/lib/notify/push";
import {
  GENERAL_KEY,
  ACTIVE_JOB_STATUSES,
  jobRoomKey,
  directRoomKey,
  jobRoomMemberIds,
  membershipDelta,
  memberKey,
  parseMemberKey,
  memberName,
  canWrite,
  seesAllRooms,
} from "./rules";

const refuse = (status, code, error) => ({ ok: false, status, code, error });

// Not-a-member and does-not-exist answer the same way on purpose.
const NO_ROOM = refuse(404, "no_room", "No such conversation.");
const READ_ONLY = refuse(
  403,
  "read_only",
  "You're viewing this account read-only. Support access can't post in a customer's chat.",
);

/** The person behind a membership or an author, for names and languages. */
const MEMBER_PERSON = {
  select: {
    id: true,
    userId: true,
    role: true,
    active: true,
    user: { select: { name: true, email: true, language: true } },
  },
};

/** Loaded with every room, so titles and unread can be worked out in one pass. */
const ROOM_INCLUDE = {
  job: { select: { id: true, title: true, status: true, archivedAt: true } },
  members: {
    select: { id: true, memberId: true, open: true, lastSeenAt: true, member: MEMBER_PERSON },
  },
  messages: {
    orderBy: { createdAt: "asc" },
    // Enough for a preview and an unread count without loading a year of
    // history into a list request. The thread read loads more.
    take: 200,
    select: {
      id: true,
      body: true,
      kind: true,
      meta: true,
      mentions: true,
      createdAt: true,
      authorMemberId: true,
      author: MEMBER_PERSON,
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// The roster and the rooms that follow from it
// ═══════════════════════════════════════════════════════════════════════════

/** Everybody who can sign in to this company right now. */
export async function activeRoster(companyId, { client = db } = {}) {
  if (!companyId) return [];
  return client.member.findMany({
    where: { companyId, active: true },
    select: { id: true, userId: true, role: true, user: { select: { name: true, email: true, language: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Write one room's membership to match `wanted`. Never deletes. */
async function syncMembership(client, { companyId, roomId, wanted }) {
  const existing = await client.companyChatMember.findMany({
    where: { roomId, companyId },
    select: { id: true, memberId: true, open: true },
  });
  const delta = membershipDelta(wanted, existing);
  const rowFor = new Map(existing.map((r) => [r.memberId, r.id]));
  const now = new Date();
  const writes = [];
  for (const memberId of delta.create) {
    writes.push(client.companyChatMember.create({ data: { companyId, roomId, memberId }, select: { id: true } }));
  }
  for (const memberId of delta.reopen) {
    writes.push(
      client.companyChatMember.update({
        where: { id: rowFor.get(memberId) },
        data: { open: true, removedAt: null },
        select: { id: true },
      }),
    );
  }
  for (const memberId of delta.close) {
    writes.push(
      client.companyChatMember.update({
        where: { id: rowFor.get(memberId) },
        data: { open: false, removedAt: now },
        select: { id: true },
      }),
    );
  }
  if (writes.length) await client.$transaction(writes);
  return delta;
}

/**
 * Make sure the company's rooms exist and everybody who belongs in them is
 * in them. Idempotent, never deletes, and about EVERYBODY rather than the
 * viewer — see lib/staff/teams.js for the launch-day state that made that
 * the rule.
 *
 *   #general   every active member, open forced back to true.
 *   job rooms  one per active job (scheduled / in progress, not archived),
 *              named after the job, members = the crew on its visits + the
 *              office. Somebody taken off the visits is closed out of the
 *              room; put back on, reopened. A finished job's room is left as
 *              it is — history — and no new one is made for it.
 *
 * Called on every list read. The cost is a handful of upserts at a
 * contractor's headcount; a migration that seeded the people who existed the
 * day it ran is the alternative, and it is exactly what was wrong before.
 */
export async function ensureCompanyRooms(companyId, { client = db } = {}) {
  if (!companyId) return { general: null, jobs: [] };
  const roster = await activeRoster(companyId, { client });
  const everybody = roster.map((m) => m.id);

  // ── #general ──────────────────────────────────────────────────────────
  const general = await client.companyChatRoom.upsert({
    where: { companyId_key: { companyId, key: GENERAL_KEY } },
    update: {},
    create: { companyId, kind: "general", key: GENERAL_KEY, name: "general" },
    select: { id: true },
  });
  await syncMembership(client, { companyId, roomId: general.id, wanted: everybody });

  // ── One room per active job ───────────────────────────────────────────
  const jobs = await client.job.findMany({
    where: { companyId, status: { in: [...ACTIVE_JOB_STATUSES] }, archivedAt: null },
    select: { id: true, title: true, visits: { select: { assignedToId: true } } },
  });
  const made = [];
  for (const job of jobs) {
    const name = String(job.title || "").trim().slice(0, 120) || "Job";
    const room = await client.companyChatRoom.upsert({
      where: { companyId_key: { companyId, key: jobRoomKey(job.id) } },
      // A renamed job renames its room.
      update: { name },
      create: { companyId, kind: "job", key: jobRoomKey(job.id), jobId: job.id, name },
      select: { id: true },
    });
    await syncMembership(client, { companyId, roomId: room.id, wanted: jobRoomMemberIds(job, roster) });
    made.push({ jobId: job.id, roomId: room.id });
  }
  return { general: general.id, jobs: made };
}

/**
 * The write-path half of the rule above, for one job: called after a status
 * change or a visit assignment so the room is right before the next list
 * read. Best-effort — a chat room that lags a poll is not a reason for a
 * schedule write to fail — and scoped: the job must be the company's.
 */
export async function syncJobRoom(companyId, jobId, { client = db } = {}) {
  if (!companyId || !jobId) return null;
  try {
    const job = await client.job.findFirst({
      where: { id: jobId, companyId },
      select: { id: true, title: true, status: true, archivedAt: true, visits: { select: { assignedToId: true } } },
    });
    if (!job) return null;
    if (!ACTIVE_JOB_STATUSES.includes(job.status) || job.archivedAt) return null;
    const roster = await activeRoster(companyId, { client });
    const name = String(job.title || "").trim().slice(0, 120) || "Job";
    const room = await client.companyChatRoom.upsert({
      where: { companyId_key: { companyId, key: jobRoomKey(job.id) } },
      update: { name },
      create: { companyId, kind: "job", key: jobRoomKey(job.id), jobId: job.id, name },
      select: { id: true },
    });
    await syncMembership(client, { companyId, roomId: room.id, wanted: jobRoomMemberIds(job, roster) });
    return room.id;
  } catch (err) {
    console.error("[company chat] syncJobRoom failed:", err?.message);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Reads
// ═══════════════════════════════════════════════════════════════════════════

/** The membership `where` for this viewer: their open rooms, or — for a
 *  read-only support session — every room in the company. */
function visibleWhere(member) {
  if (seesAllRooms(member)) return {};
  return { members: { some: { memberId: member?.id || "__none__", open: true } } };
}

/** Every room this member can read, in their company. */
export async function roomsFor(member, { client = db } = {}) {
  if (!member?.companyId) return [];
  return client.companyChatRoom.findMany({
    where: { companyId: member.companyId, ...visibleWhere(member) },
    include: ROOM_INCLUDE,
    orderBy: { lastMessageAt: "desc" },
  });
}

/** One room, but only if it is the member's company's AND they are in it. */
export async function roomFor(member, roomId, { client = db } = {}) {
  if (!member?.companyId || !roomId) return null;
  return client.companyChatRoom.findFirst({
    where: { id: roomId, companyId: member.companyId, ...visibleWhere(member) },
    include: { ...ROOM_INCLUDE, messages: { ...ROOM_INCLUDE.messages, take: 500 } },
  });
}

/** The role label the screen prints beside a name. */
function labelFor(role) {
  if (role === "owner") return "owner";
  if (role === "admin") return "admin";
  if (role === "supervisor") return "supervisor";
  return "employee";
}

/**
 * Everybody in the company who can be messaged — active members only, with
 * the viewer included so the picker can exclude them by id. A person who
 * cannot sign in is not listed: a list you cannot get a reply from wastes
 * somebody's afternoon.
 *
 * @param q  optional search, matched against name and email, case-blind.
 */
export async function directoryFor(member, { q = "", client = db } = {}) {
  if (!member?.companyId) return [];
  const roster = await activeRoster(member.companyId, { client });
  const people = roster.map((m) => ({
    id: m.id,
    name: m.user?.name || m.user?.email || null,
    email: m.user?.email || null,
    role: m.role,
    label: labelFor(m.role),
    isYou: m.id === member.id,
  }));
  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return people;
  return people.filter(
    (p) => (p.name || "").toLowerCase().includes(needle) || (p.email || "").toLowerCase().includes(needle),
  );
}

/** The open members of a room as { kind, id, name, email }, for mention parsing. */
async function openMembersOf(client, companyId, roomId) {
  const rows = await client.companyChatMember.findMany({
    where: { roomId, companyId, open: true },
    select: { memberId: true, member: MEMBER_PERSON },
  });
  return rows.map((r) => ({
    kind: "member",
    id: r.memberId,
    name: memberName(r),
    email: r.member?.user?.email || null,
    userId: r.member?.userId || null,
    language: r.member?.user?.language || null,
  }));
}

/**
 * The members of a room, for the Members bar. Only for a viewer who can
 * read it. Nobody can add or remove anybody: #general is everyone, a job
 * room follows the schedule, a DM is two people — so the bar lists and
 * explains, and offers no control it could not honour.
 */
export async function membersOf(member, roomId, { client = db } = {}) {
  const room = await roomFor(member, roomId, { client });
  if (!room) return null;
  const members = (room.members || [])
    .filter((m) => m.open !== false)
    .map((m) => ({
      id: m.memberId,
      name: memberName(m),
      email: m.member?.user?.email || null,
      label: labelFor(m.member?.role),
      departed: !m.member || m.member.active === false,
      isYou: m.memberId === member.id,
    }));
  return {
    room: { id: room.id, kind: room.kind, name: room.name, jobId: room.jobId || null },
    members,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Writes
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The direct room between the viewer and another member of THEIR company,
 * made the first time. The unique (companyId, key) is what makes it safe
 * against two tabs: the loser of the race reads back the winner's row.
 */
export async function openDirect(member, otherMemberId, { client = db } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const key = directRoomKey(member.id, otherMemberId);
  if (!key) return refuse(400, "self", "You cannot start a conversation with yourself.");

  // Resolved against the live roster of the SAME company, never trusted: an
  // id the browser sent could name somebody deactivated, somebody in another
  // company, or nobody at all.
  const other = await client.member.findFirst({
    where: { id: otherMemberId, companyId: member.companyId, active: true },
    select: { id: true },
  });
  if (!other) return refuse(404, "member_unknown", "That person is not on the team any more.");

  const companyId = member.companyId;
  const existing = await client.companyChatRoom.findUnique({
    where: { companyId_key: { companyId, key } },
    select: { id: true },
  });
  if (existing) {
    // Both sides are reopened: a DM nobody can leave has no closed state to
    // honour, and a row closed by a roster sync (a member deactivated and
    // reactivated) should come back when either side opens the room again.
    await client.companyChatMember.updateMany({
      where: { roomId: existing.id, companyId, open: false },
      data: { open: true, removedAt: null },
    });
    return { ok: true, roomId: existing.id };
  }
  try {
    const room = await client.companyChatRoom.create({
      data: {
        companyId,
        kind: "dm",
        key,
        members: { create: [{ companyId, memberId: member.id }, { companyId, memberId: other.id }] },
      },
      select: { id: true },
    });
    return { ok: true, roomId: room.id };
  } catch (err) {
    // P2002 is the unique index doing its job against the other tab.
    if (err?.code === "P2002") {
      const won = await client.companyChatRoom.findUnique({
        where: { companyId_key: { companyId, key } },
        select: { id: true },
      });
      if (won) return { ok: true, roomId: won.id };
    }
    throw err;
  }
}

/**
 * A membership row for this viewer in this room, creating it when the room
 * is #general and they are an active member never put in it — so a member
 * added this morning is not refused for a row the next list read would
 * create. Returns null for a room they are genuinely not in.
 */
async function memberOrAutoJoin(client, member, room) {
  const existing = await client.companyChatMember.findFirst({
    where: { roomId: room.id, companyId: member.companyId, memberId: member.id },
    select: { id: true, open: true },
  });
  if (existing?.open) return existing;
  if (room.kind !== "general") return null;
  const active = await client.member.findFirst({
    where: { id: member.id, companyId: member.companyId, active: true },
    select: { id: true },
  });
  if (!active) return null;
  if (existing) {
    return client.companyChatMember.update({
      where: { id: existing.id },
      data: { open: true, removedAt: null },
      select: { id: true, open: true },
    });
  }
  return client.companyChatMember.create({
    data: { companyId: member.companyId, roomId: room.id, memberId: member.id },
    select: { id: true, open: true },
  });
}

/**
 * Say something. Refused for a read-only session, for an empty body, and for
 * a room that is not the member's company's or that they are not in — the
 * last two answering identically.
 *
 * Mentions are parsed against the members of the room AT THIS MOMENT and
 * stored. The room's lastMessageAt and the author's lastSeenAt are written
 * in the SAME transaction as the message, so the list's ordering can never
 * describe a message that failed to save, and saying something is seeing it.
 *
 * `notify` is the push sender; injectable so the check can assert it was
 * called with the mentioned member and not the author, without web-push.
 */
export async function postMessage({ member, roomId, body }, { client = db, notify = pushToUsers } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const text = typeof body === "string" ? body.trim() : "";
  if (!roomId || !text) return refuse(400, "empty", "Say something first.");

  const room = await client.companyChatRoom.findFirst({
    where: { id: roomId, companyId: member.companyId },
    select: { id: true, kind: true, name: true, companyId: true },
  });
  if (!room) return NO_ROOM;
  const membership = await memberOrAutoJoin(client, member, room);
  if (!membership) return NO_ROOM;

  const people = await openMembersOf(client, member.companyId, room.id);
  const mentions = parseMentions(text, people);
  const now = new Date();
  const [message] = await client.$transaction([
    client.companyChatMessage.create({
      data: { companyId: member.companyId, roomId: room.id, authorMemberId: member.id, body: text.slice(0, 4000), mentions },
      select: { id: true, body: true, createdAt: true, mentions: true },
    }),
    client.companyChatRoom.update({ where: { id: room.id }, data: { lastMessageAt: now } }),
    client.companyChatMember.update({ where: { id: membership.id }, data: { lastSeenAt: now } }),
  ]);

  // ── Who is told ────────────────────────────────────────────────────────
  //
  // A DM tells the other person; a mention tells the people named. Never the
  // author, never the whole room. Fire-and-forget after the transaction has
  // committed: the row is the record, the push is a courtesy about it.
  const author = people.find((p) => p.id === member.id) || null;
  const told = new Map();
  if (room.kind === "dm") {
    for (const p of people) if (p.id !== member.id && p.userId) told.set(p.userId, { p, why: "dm" });
  }
  for (const key of mentions) {
    const id = parseMemberKey(key);
    const p = people.find((x) => x.id === id);
    if (!p || p.id === member.id || !p.userId) continue;
    // A mention in a DM is still a DM.
    if (!told.has(p.userId)) told.set(p.userId, { p, why: "mention" });
  }
  if (told.size) {
    const authorName = author?.name || "Someone";
    const roomName = room.kind === "dm" ? authorName : `#${room.name || "general"}`;
    const snippet = text.replace(/\s+/g, " ").slice(0, 90);
    const fallbackLanguage = await companyLanguage(client, member.companyId);
    const groups = { dm: [], mention: [] };
    for (const [userId, { why }] of told) groups[why].push(userId);
    const send = (userIds, titleKey, params) =>
      notify({
        userIds,
        fallbackLanguage,
        payload: async (language) => ({
          title: await appSentence(language, titleKey, params),
          body: snippet,
          // Same tag as the screen's own notify() for the room, so a person
          // with both sees each event once.
          tag: `company-chat:${room.id}`,
          url: `/app/chat?room=${encodeURIComponent(room.id)}`,
        }),
      });
    try {
      if (groups.dm.length) void send(groups.dm, "app.notify.newMessage.title", { name: authorName });
      if (groups.mention.length) void send(groups.mention, "app.notify.mention.title", { name: authorName, room: roomName });
    } catch {
      /* a message that could not be pushed is still stored and badged */
    }
  }
  return { ok: true, message };
}

/** The company's default language — what a User with no stated language reads in. */
async function companyLanguage(client, companyId) {
  try {
    const row = await client.company.findUnique({ where: { id: companyId }, select: { defaultLanguage: true } });
    return row?.defaultLanguage || "en";
  } catch {
    return "en";
  }
}

/** Mark a room read, up to now. Silently does nothing for a non-member or a
 *  read-only session (which holds no row to stamp). */
export async function markRoomSeen(member, roomId, { client = db } = {}) {
  if (!canWrite(member) || !roomId) return false;
  const row = await client.companyChatMember.findFirst({
    where: { roomId, companyId: member.companyId, memberId: member.id, open: true },
    select: { id: true },
  });
  if (!row) return false;
  await client.companyChatMember.update({ where: { id: row.id }, data: { lastSeenAt: new Date() } });
  return true;
}

/** Re-exported so a route imports one module. */
export { memberKey, canWrite, seesAllRooms };
