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
import { workerTitlesByUserId } from "@/lib/team/workerTitles";
import { canOpenQuote } from "@/lib/quotes/shareWithStaff";
import { shiftWindowWhere } from "@/lib/permissions/enforce";
import { isMarketingAgency } from "@/lib/permissions/marketingAgency";
import { appSentence, pushToUsers } from "@/lib/notify/push";
import { notifyEvent } from "@/lib/notifications/notify";
import { recordActivity } from "@/lib/activity/log";
import { unreadWhere, mentionsWhere, countByRoomArgs, countsByRoom, seenUpTo } from "@/lib/chat/unreadQuery";
import { validateChannelName } from "@/lib/chat/channelName";
import { withOfflineKey } from "@/lib/offline/idempotency";
import { hasLevel, assignedJobWhere } from "@/lib/permissions/enforce";
import { parseChatAttachments, chatFileLocation } from "./attachments";
import { checkCardForPoster, resolveCards, enforceableFor } from "./cards";
import { fileLinkFor } from "./fileLinks";
import {
  GENERAL_KEY,
  ACTIVE_JOB_STATUSES,
  MADE_KINDS,
  RESERVED_CHANNEL_SLUGS,
  POSTING_POLICIES,
  NOTIFY_LEVELS,
  MEMBER_INLINE_MAX,
  MEMBER_PAGE,
  jobRoomKey,
  directRoomKey,
  channelRoomKey,
  groupRoomKey,
  jobRoomMemberIds,
  membershipDelta,
  memberKey,
  parseMemberKey,
  memberName,
  roomTitle,
  roomListRow,
  threadMessages,
  isActiveJob,
  canWrite,
  seesAllRooms,
  mayMentionEveryone,
  canCreateChannel,
  canManage,
  canRename,
  canAddMembers,
  canRemoveMembers,
  canArchive,
  canLeave,
  canPost,
  isJoinable,
  notifyVerdict,
  badgeCounts,
  parseSnooze,
  effectiveNotify,
  isSnoozed,
  isMuted,
  canEditMessage,
  canRemoveMessage,
  canPin,
  canModerate,
  searchTerm,
  SEARCH_TAKE,
  PINS_MAX,
  REPLY_SNIPPET,
} from "./rules";

const refuse = (status, code, error) => ({ ok: false, status, code, error });

// The shifts that put somebody in a job's room: published, inside the window
// assignedJobWhere grants the job for (lib/permissions/enforce.js), with a
// worker. A function so "now" is read at each sync, not at module load — the
// room must drop a helper the same day the job list does.
const ROOM_SHIFTS = () => ({
  where: { ...shiftWindowWhere(), workerId: { not: null } },
  select: { worker: { select: { userId: true } } },
});

// Not-a-member and does-not-exist answer the same way on purpose.
const NO_ROOM = refuse(404, "no_room", "No such conversation.");
const READ_ONLY = refuse(
  403,
  "read_only",
  "You're viewing this account read-only. Support access can't post in a customer's chat.",
);
const NOT_ALLOWED = refuse(403, "not_allowed", "You can't change that in this conversation.");
const FIXED_ROOM = refuse(
  400,
  "fixed_room",
  "#general, job rooms and direct messages are kept by FieldQuo, so they can't be changed by hand.",
);
const ARCHIVED = refuse(400, "archived", "This channel is archived. It's kept read-only.");
const NAME_SENTENCES = {
  name_missing: "Give it a name.",
  name_too_long: "That name is too long for a channel.",
  name_reserved: "That name is taken by #general.",
};

/** How long a group's own name may be. A channel's is CHANNEL_NAME_MAX. */
export const GROUP_NAME_MAX = 80;
/** How long a channel's topic may be. */
export const TOPIC_MAX = 250;
/** How many names a "Dana added …" system line spells out before "+n". */
const NAMES_IN_LINE = 10;
/** Pushes go out in slices this big, one after the other, so a message in
 *  a 2,000-person group is not 2,000 simultaneous sends from one function. */
export const PUSH_CHUNK = 500;

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

/** One message row, as the list's preview and the thread both draw it.
 *  `body` is selected because the AUTHOR's words are what a thread is; it
 *  leaves this module only through rules.js threadMessages, which drops it
 *  for a removed row — the one door, so there is one place to get it right. */
const MESSAGE_SELECT = {
  id: true,
  body: true,
  kind: true,
  meta: true,
  mentions: true,
  createdAt: true,
  authorMemberId: true,
  author: MEMBER_PERSON,
  attachments: true,
  card: true,
  replyToId: true,
  editedAt: true,
  deletedAt: true,
  pinnedAt: true,
  replyTo: {
    select: { id: true, body: true, kind: true, deletedAt: true, authorMemberId: true, attachments: true, author: MEMBER_PERSON },
  },
};

/** The viewer's own membership: their read boundary and their settings. */
const MINE_SELECT = {
  id: true,
  roomId: true,
  memberId: true,
  open: true,
  lastSeenAt: true,
  lastOpenedAt: true,
  role: true,
  notify: true,
  mutedUntil: true,
  hiddenAt: true,
  starredAt: true,
};

/** The room columns every read and every rule needs. */
const ROOM_FIELDS = {
  id: true,
  companyId: true,
  kind: true,
  key: true,
  name: true,
  jobId: true,
  topic: true,
  private: true,
  postingPolicy: true,
  autoJoin: true,
  archivedAt: true,
  createdByMemberId: true,
  lastMessageAt: true,
};

/** How many members ride along with a listed room — enough to name a DM
 *  and a group with no name of its own ("Ana, Bob, Cat"), and no more. */
const LIST_MEMBERS_TAKE = 4;

/**
 * Loaded with every room in the LIST: the job, the first few members, and
 * the last thing somebody SAID — one row, for the preview line. Not the last
 * 200: the unread and mention counts come from a count query (withUnread
 * below), because a slice of the oldest rows stops containing the newest
 * ones the day a room outgrows it — lib/chat/unreadQuery.js has the whole
 * story.
 *
 * Not every member, either. A group has no maximum size (owner decision
 * 2026-10-04: big companies), and #general is the whole roster: loading
 * every membership of every room on every poll is a read that grows with
 * headcount × rooms. The viewer's own row comes from its own query (mineFor)
 * and the head-count from a grouped count (countsOpen).
 */
const LIST_INCLUDE = {
  job: { select: { id: true, title: true, status: true, archivedAt: true } },
  members: {
    where: { open: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: LIST_MEMBERS_TAKE,
    select: { id: true, memberId: true, open: true, lastSeenAt: true, member: MEMBER_PERSON },
  },
  // The last thing somebody said that is still THERE: a removed message is
  // never anybody's preview line (its words are hidden from everybody).
  messages: {
    where: { kind: { not: "system" }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 1,
    select: MESSAGE_SELECT,
  },
};

/** How much of a thread one read carries. The NEWEST this many. */
export const THREAD_TAKE = 500;

// ═══════════════════════════════════════════════════════════════════════════
// The roster and the rooms that follow from it
// ═══════════════════════════════════════════════════════════════════════════

/** Everybody who can sign in to this company right now. */
export async function activeRoster(companyId, { client = db } = {}) {
  if (!companyId) return [];
  const rows = await client.member.findMany({
    where: { companyId, active: true },
    // `permissions` is read for one derived boolean in directoryFor (who can
    // open a shared quote link) and never leaves this module as a grid.
    select: { id: true, userId: true, role: true, permissions: true, user: { select: { name: true, email: true, language: true } } },
    orderBy: { createdAt: "asc" },
  });
  // The marketing agency is on the roster for marketing and nothing else
  // (lib/permissions/marketingAgency.js): every /api/chat route refuses them,
  // and a member of #general or of a job's room would be listed as one — and
  // be a name staff address messages about clients to. So they are in no room.
  return (Array.isArray(rows) ? rows : []).filter((m) => !isMarketingAgency(m));
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
 *              named after the job, members = the crew on its visits and
 *              its published shifts (inside their window) + the office. Somebody taken off the visits is closed out of the
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
    select: { id: true, title: true, visits: { select: { assignedToId: true } }, shifts: ROOM_SHIFTS() },
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

  // ── Auto-join channels (#announcements) ───────────────────────────────
  await syncAutoJoin(client, companyId, everybody);
  return { general: general.id, jobs: made };
}

/**
 * Put every active member who has NEVER had a row into each public,
 * unarchived auto-join channel. Only a row that does not exist is created:
 * somebody a manager removed has a closed row and stays out — the sync must
 * never undo a person's decision, which is the difference from #general,
 * where nobody can be removed at all.
 *
 * @param roomIds  limit to these channels (a channel just switched to
 *                 auto-join); absent = every auto-join channel
 */
async function syncAutoJoin(client, companyId, everybody, roomIds = null) {
  const rooms = await client.companyChatRoom.findMany({
    where: {
      companyId,
      kind: "channel",
      autoJoin: true,
      private: false,
      archivedAt: null,
      ...(roomIds ? { id: { in: roomIds } } : {}),
    },
    select: { id: true },
  });
  if (!rooms.length || !everybody.length) return 0;
  const rows = await client.companyChatMember.findMany({
    where: { companyId, roomId: { in: rooms.map((r) => r.id) } },
    select: { roomId: true, memberId: true },
  });
  const had = new Set(rows.map((r) => `${r.roomId}|${r.memberId}`));
  const data = [];
  for (const room of rooms) {
    for (const memberId of everybody) {
      if (!had.has(`${room.id}|${memberId}`)) data.push({ companyId, roomId: room.id, memberId });
    }
  }
  if (data.length) await client.companyChatMember.createMany({ data, skipDuplicates: true });
  return data.length;
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
      select: { id: true, title: true, status: true, archivedAt: true, visits: { select: { assignedToId: true } }, shifts: ROOM_SHIFTS() },
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

/**
 * syncJobRoom for each job a shift write touched — the job it left and the
 * job it joined, when a shift is re-jobbed. Best-effort like syncJobRoom; the
 * next list read (ensureCompanyRooms) would catch it up anyway, this only
 * makes the room right before somebody opens it.
 */
export async function syncJobRooms(companyId, jobIds = [], { client = db } = {}) {
  const ids = [...new Set((Array.isArray(jobIds) ? jobIds : []).filter(Boolean))];
  for (const jobId of ids) await syncJobRoom(companyId, jobId, { client });
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

/** The where fragment that leaves the member's own messages out of a count. */
function notMineWhere(member) {
  return { OR: [{ authorMemberId: null }, { authorMemberId: { not: member.id } }] };
}

/**
 * Unread and mention counts for these rooms, as the member, by two grouped
 * counts scoped to their company. Attached to each room as `unread` and
 * `mentions`, which is what rules.js roomListRow reads.
 *
 * A read-only support session holds no membership row, so every room reads
 * as never seen and everything in it counts — the same answer the row-count
 * gave, now exact rather than capped at the slice.
 */
async function withUnread(client, member, rooms) {
  if (!rooms.length) return rooms;
  const seen = rooms.map((r) => ({
    id: r.id,
    lastSeenAt:
      r.mine !== undefined
        ? (r.mine && r.mine.open !== false ? r.mine.lastSeenAt : null) || null
        : (r.members || []).find((m) => m.open !== false && m.memberId === member.id)?.lastSeenAt || null,
  }));
  const notMine = notMineWhere(member);
  // A removed message is nothing to read: it neither counts as unread nor
  // carries a mention once it is gone.
  const scope = { companyId: member.companyId, deletedAt: null };
  const unreadArgs = unreadWhere({ rooms: seen, at: "createdAt", notMine });
  const mentionArgs = mentionsWhere({ rooms: seen, at: "createdAt", notMine, key: memberKey(member.id) });
  const [unread, mentions] = await Promise.all([
    unreadArgs ? client.companyChatMessage.groupBy(countByRoomArgs({ AND: [scope, unreadArgs] })) : [],
    mentionArgs ? client.companyChatMessage.groupBy(countByRoomArgs({ AND: [scope, mentionArgs] })) : [],
  ]);
  const unreadBy = countsByRoom(unread);
  const mentionsBy = countsByRoom(mentions);
  return rooms.map((r) => ({ ...r, unread: unreadBy.get(r.id) || 0, mentions: mentionsBy.get(r.id) || 0 }));
}

/**
 * The viewer's own membership row in each of these rooms, by roomId — open
 * or closed (a closed row still says "you were here", and a support session
 * has none at all, which reads as null).
 */
async function mineFor(client, member, roomIds) {
  const out = new Map();
  if (!member?.id || !roomIds.length) return out;
  const rows = await client.companyChatMember.findMany({
    where: { companyId: member.companyId, memberId: member.id, roomId: { in: roomIds } },
    select: MINE_SELECT,
  });
  for (const r of rows) out.set(r.roomId, r);
  return out;
}

/** How many OPEN members each room has, by one grouped count. */
async function countsOpen(client, companyId, roomIds) {
  if (!roomIds.length) return new Map();
  const groups = await client.companyChatMember.groupBy(
    countByRoomArgs({ companyId, roomId: { in: roomIds }, open: true }),
  );
  return countsByRoom(groups);
}

/** Attach `mine` and `memberCount` to listed rooms. */
async function withMineAndCounts(client, member, rooms) {
  const ids = rooms.map((r) => r.id);
  const [mine, counts] = await Promise.all([mineFor(client, member, ids), countsOpen(client, member.companyId, ids)]);
  return rooms.map((r) => ({ ...r, mine: mine.get(r.id) || null, memberCount: counts.get(r.id) || 0 }));
}

/** Every room this member can read, in their company, each with its unread counts. */
export async function roomsFor(member, { client = db } = {}) {
  if (!member?.companyId) return [];
  const rooms = await client.companyChatRoom.findMany({
    where: { companyId: member.companyId, ...visibleWhere(member) },
    include: LIST_INCLUDE,
    orderBy: { lastMessageAt: "desc" },
  });
  return withUnread(client, member, await withMineAndCounts(client, member, rooms));
}

/**
 * The public, unarchived channels of the member's company that they are NOT
 * in — Browse channels. A private channel is never listed (its existence is
 * a fact about the people in it), and a read-only support session, which
 * already sees every room, is offered nothing to join.
 */
export async function joinableRoomsFor(member, { client = db } = {}) {
  if (!member?.companyId || !member?.id || seesAllRooms(member)) return [];
  const rooms = await client.companyChatRoom.findMany({
    where: {
      companyId: member.companyId,
      kind: "channel",
      private: false,
      archivedAt: null,
      NOT: { members: { some: { memberId: member.id, open: true } } },
    },
    select: { id: true, name: true, topic: true, postingPolicy: true, lastMessageAt: true },
    orderBy: { name: "asc" },
  });
  const counts = await countsOpen(client, member.companyId, rooms.map((r) => r.id));
  return rooms.map((r) => ({ ...r, memberCount: counts.get(r.id) || 0 }));
}

/**
 * One room, but only if it is the member's company's AND they are in it.
 *
 * The thread is the NEWEST `THREAD_TAKE` messages, handed back oldest-first
 * the way the screen draws them. Newest-first at the database, because a
 * slice of the oldest rows is a thread that stops moving once the room is
 * bigger than the slice; the screen has no "load earlier" yet, so what a
 * long room loses is its beginning, never its end.
 *
 * `after` (an ISO time) makes it a DELTA: only the messages since, oldest
 * first — the 4-second poll of an open room, which for a quiet room is an
 * empty list rather than the whole thread again. Members ride along on the
 * full read only, at most MEMBER_INLINE_MAX of them (a group has no maximum
 * size; the panel and the @ list page through membersOf beyond that).
 */
export async function roomFor(member, roomId, { client = db, after = null, changedSince = null } = {}) {
  if (!member?.companyId || !roomId) return null;
  const since = after ? new Date(after) : null;
  const delta = Boolean(since) && !Number.isNaN(since.getTime());
  const changedAfter = changedSince ? new Date(changedSince) : null;
  const room = await client.companyChatRoom.findFirst({
    where: { id: roomId, companyId: member.companyId, ...visibleWhere(member) },
    include: {
      job: LIST_INCLUDE.job,
      members: delta
        ? { where: { open: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: LIST_MEMBERS_TAKE, select: LIST_INCLUDE.members.select }
        : { where: { open: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: MEMBER_INLINE_MAX, select: LIST_INCLUDE.members.select },
      messages: delta
        ? { where: { createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, take: THREAD_TAKE, select: MESSAGE_SELECT }
        : { orderBy: { createdAt: "desc" }, take: THREAD_TAKE, select: MESSAGE_SELECT },
    },
  });
  if (!room) return null;
  // The delta's second half: messages the reader ALREADY has that were
  // edited or removed since their last poll (the screen sends back the
  // `changesCursor` the previous payload carried). Pins are not here — the
  // pinned list rides on every read, so an UNpin, which leaves no timestamp
  // behind, is seen as an absence.
  const changed =
    delta && changedAfter && !Number.isNaN(changedAfter.getTime())
      ? await client.companyChatMessage.findMany({
          where: {
            roomId: room.id,
            companyId: member.companyId,
            createdAt: { lte: since },
            OR: [{ editedAt: { gt: changedAfter } }, { deletedAt: { gt: changedAfter } }],
          },
          orderBy: { createdAt: "asc" },
          take: THREAD_TAKE,
          select: MESSAGE_SELECT,
        })
      : [];
  const [mine, counts] = await Promise.all([mineFor(client, member, [room.id]), countsOpen(client, member.companyId, [room.id])]);
  return {
    ...room,
    mine: mine.get(room.id) || null,
    memberCount: counts.get(room.id) || 0,
    delta,
    messages: delta ? room.messages || [] : [...(room.messages || [])].reverse(),
    changed,
  };
}

/** How far back a changes cursor reaches past "now", so two servers whose
 *  clocks disagree by a moment cannot drop an edit between two polls. The
 *  screen merges by id, so seeing one twice costs nothing. */
const CHANGES_OVERLAP_MS = 5000;

/** The room's pinned messages, newest pin first — for the pinned bar. A
 *  removed message is never pinned (removing clears the pin) and is skipped
 *  here as well, so its words cannot ride in on the bar. */
async function pinnedFor(client, member, roomId) {
  const rows = await client.companyChatMessage.findMany({
    where: { roomId, companyId: member.companyId, pinnedAt: { not: null }, deletedAt: null, kind: "message" },
    orderBy: { pinnedAt: "desc" },
    take: PINS_MAX,
    select: { id: true, body: true, createdAt: true, pinnedAt: true, attachments: true, card: true, authorMemberId: true, author: MEMBER_PERSON },
  });
  return rows.map((m) => ({
    id: m.id,
    who: memberName(m.author ? { member: m.author } : null),
    body: String(m.body || "").replace(/\s+/g, " ").trim().slice(0, REPLY_SNIPPET * 2),
    at: m.createdAt,
    pinnedAt: m.pinnedAt,
    attachments: Array.isArray(m.attachments) ? m.attachments.length : 0,
    card: Boolean(m.card),
  }));
}

/**
 * The thread's messages, finished for ONE reader: rules.js threadMessages
 * (which drops a removed message's words), then a short-lived link per
 * attachment for this reader (fileLinks.js) and each card resolved with this
 * reader's own access (cards.js). Nothing stored — no URL, no public id, no
 * card id — reaches the payload from here.
 */
async function finishMessages(client, member, rows, { full, now = new Date() } = {}) {
  const out = threadMessages(rows, member.id);
  const cards = rows.some((r) => r && r.card && !r.deletedAt) ? await resolveCards(client, member, rows, { now, full }) : new Map();
  return out.map((m) => {
    if (m.deleted) return m;
    const attachments = (m.attachments || []).map((a) => ({
      ...a,
      thumb: a.type === "photo" ? fileLinkFor(member, m.id, a.index, "thumb", { now: now.getTime() }) : null,
      full: fileLinkFor(member, m.id, a.index, "full", { now: now.getTime() }),
    }));
    return { ...m, attachments, card: cards.get(m.id) || null };
  });
}

/**
 * "Seen by" for the viewer's LAST message in the room: { messageId, count }
 * or null. One indexed count — rules.js explains why receipts are derived
 * from each member's read boundary rather than stored per message.
 *
 * Only for somebody IN the room (owner decision: only the room's members see
 * receipts), so a read-only support session gets null.
 */
export async function lastSeenReceipt(member, roomId, { client = db } = {}) {
  if (!member?.id || !roomId || seesAllRooms(member)) return null;
  const last = await client.companyChatMessage.findFirst({
    where: { roomId, companyId: member.companyId, authorMemberId: member.id, kind: "message" },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });
  if (!last) return null;
  const count = await client.companyChatMember.count({
    where: { roomId, companyId: member.companyId, open: true, NOT: { memberId: member.id }, lastSeenAt: { gte: last.createdAt } },
  });
  return { messageId: last.id, count };
}

/**
 * The thread as the route returns it: the room, what the viewer may do in
 * it, the messages, and the receipt for their last message. Reading it is
 * seeing it — markRoomSeen moves the read boundary to the last message THIS
 * payload shows, and stamps lastOpenedAt (the "looking" clock push reads).
 *
 * Returns null for a room the viewer cannot read — the route's 404.
 */
export async function readThread(member, roomId, { client = db, after = null, changedSince = null } = {}) {
  const room = await roomFor(member, roomId, { client, after, changedSince });
  if (!room) return null;
  const mine = room.mine && room.mine.open !== false ? room.mine : null;
  // Where the member had read up to BEFORE this open — the thread draws its
  // red "unread messages" line from it. Captured first, because the next
  // line moves it.
  const lastSeenAt = mine?.lastSeenAt || null;
  await markRoomSeen(member, room.id, { upTo: seenUpTo(room.messages, "createdAt"), client });
  const now = new Date();
  const title = roomTitle(room, member.id);
  const post = canPost(room, member);
  const leave = canLeave(room);
  // The grid, read once: for the cards in this payload and for whether
  // "Save to job photos" is drawn (jobs: view_only — the same rung POST
  // /api/jobs/[id]/photos asks). A quiet delta with no card reads nothing.
  const needsGrid = !room.delta || [...room.messages, ...room.changed].some((r) => r && r.card && !r.deletedAt);
  const full = needsGrid ? await enforceableFor(client, member) : null;
  const payload = {
    id: room.id,
    delta: room.delta,
    // What the next delta poll sends back as `changed`, so edits and
    // removals made since this read come back with it.
    changesCursor: new Date(now.getTime() - CHANGES_OVERLAP_MS).toISOString(),
    lastSeenAt,
    kind: room.kind,
    jobId: room.jobId || null,
    active: room.kind === "job" ? isActiveJob(room.job) : true,
    title: title.name,
    titleMissing: title.missing,
    titleExtra: title.extra || 0,
    // A group's own name (null = called by its people), for the rename box.
    groupName: room.kind === "group" ? room.name || null : null,
    topic: room.topic || null,
    private: Boolean(room.private),
    postingPolicy: POSTING_POLICIES.includes(room.postingPolicy) ? room.postingPolicy : "everyone",
    autoJoin: Boolean(room.autoJoin),
    archived: Boolean(room.archivedAt),
    memberCount: room.memberCount,
    readOnly: seesAllRooms(member),
    // The viewer's own settings — what the bell in the header and the
    // settings panel draw.
    mine: mine
      ? {
          role: mine.role === "manager" ? "manager" : "member",
          notify: NOTIFY_LEVELS.includes(mine.notify) ? mine.notify : "default",
          notifyLevel: effectiveNotify(room.kind, mine, now),
          mutedUntil: isSnoozed(mine, now) ? new Date(mine.mutedUntil).toISOString() : null,
          muted: isMuted(mine, now),
          starred: Boolean(mine.starredAt),
        }
      : null,
    // What the controls on screen may offer. The SERVER decides each write
    // again; these only stop the screen drawing a control it would refuse.
    can: {
      post: post.ok,
      postRefusal: post.code,
      rename: canRename(room, member, mine),
      manage: canManage(room, member, mine),
      add: canAddMembers(room, member, mine),
      remove: canRemoveMembers(room, member, mine),
      archive: canArchive(room, member, mine),
      leave: Boolean(mine) && leave.ok && canWrite(member),
      leaveRefusal: leave.reason,
      hide: Boolean(mine) && canWrite(member) && (room.kind === "dm" || room.kind === "group"),
      settings: Boolean(mine) && canWrite(member),
      // Phase 3–4: what the message menu may offer. The server decides each
      // write again (editMessage, removeMessage, pinMessage, saveToJob).
      attach: post.ok && Boolean(mine),
      pin: canPin(room, member, mine),
      moderate: canModerate(room, member, mine),
      saveToJob: Boolean(mine) && canWrite(member) && Boolean(full) && hasLevel(full, "jobs", "view_only"),
    },
    messages: await finishMessages(client, member, room.messages, { full, now }),
    changed: room.delta ? await finishMessages(client, member, room.changed, { full, now }) : [],
    pinned: await pinnedFor(client, member, room.id),
    seen: mine ? await lastSeenReceipt(member, room.id, { client }) : null,
  };
  if (!room.delta) {
    const open = (room.members || []).filter((m) => m.open !== false);
    payload.members = open.map((m) => ({
      id: m.memberId,
      name: memberName(m),
      email: m.member?.user?.email || null,
      label: m.member?.role || "employee",
      isYou: m.memberId === member.id,
    }));
    payload.membersTruncated = room.memberCount > open.length;
  }
  return payload;
}

/**
 * The digits for the Chat tab: unread messages and unread mentions across
 * every room this member is in. The SAME counts the room list shows
 * (withUnread, over the same visibleWhere), summed — so the tab and the
 * list cannot disagree. Read-only: no ensureCompanyRooms, because this runs
 * on a poll from every /app screen and seeding is the list's job.
 *
 * Zero for a read-only support session: it holds no membership, so every
 * room would read as never seen and the tab would shout the company's whole
 * history at somebody who is only looking.
 */
export async function unreadTotalsFor(member, { client = db, now = new Date() } = {}) {
  const none = { unread: 0, mentions: 0 };
  if (!member?.companyId || !member?.id || seesAllRooms(member)) return none;
  const rooms = await client.companyChatRoom.findMany({
    where: { companyId: member.companyId, ...visibleWhere(member) },
    select: { id: true, kind: true, lastMessageAt: true },
  });
  const mine = await mineFor(client, member, rooms.map((r) => r.id));
  const counted = await withUnread(client, member, rooms.map((r) => ({ ...r, mine: mine.get(r.id) || null })));
  // Mute is respected HERE as well as on the list (rules.js badgeCounts): a
  // room set to "none" adds nothing, a snoozed one adds its mentions only,
  // and a DM or group the viewer hid adds nothing until somebody speaks in
  // it — the same row the list leaves out, so the digit and the list agree.
  return counted.reduce((sum, r) => {
    const row = roomListRow(r, member.id, { now });
    if (row.hidden) return sum;
    const add = badgeCounts(row);
    return { unread: sum.unread + add.unread, mentions: sum.mentions + add.mentions };
  }, none);
}

/**
 * The id of a job's room, for the job page's "Open job chat" — or null when
 * there is no room (an unscheduled job has none, rules.js says why) or the
 * viewer holds no open membership in it. The same visibleWhere every read
 * here uses, so the button is drawn for exactly the people the room would
 * open for: the office, and the crew booked on the job's visits or published
 * shifts — the facts assignedJobWhere reads, so a crew member who can see the job and a crew
 * member who is in its room are the same people.
 */
export async function jobRoomIdFor(member, jobId, { client = db } = {}) {
  if (!member?.companyId || !jobId) return null;
  const room = await client.companyChatRoom.findFirst({
    where: { companyId: member.companyId, kind: "job", jobId, ...visibleWhere(member) },
    select: { id: true },
  });
  return room?.id || null;
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
  // Job titles from the Worker rows (Receptionist, Foreman), so the picker
  // can say who somebody is; `label` stays the seat, for the rows without one.
  const titles = await workerTitlesByUserId(member.companyId, roster.map((m) => m.userId), { client });
  const people = roster.map((m) => ({
    id: m.id,
    name: m.user?.name || m.user?.email || null,
    email: m.user?.email || null,
    role: m.role,
    label: labelFor(m.role),
    title: titles.get(m.userId) || null,
    // Whether a link to /app/quotes/<id> opens for them — the same rung GET
    // /api/quotes/[id] refuses below. "Share with staff" (lib/quotes/
    // shareWithStaff.js) labels and gates on it, so a quote link is never
    // posted straight to somebody it refuses. A yes/no, not the grid.
    canOpenQuote: canOpenQuote(m),
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
 * A room the viewer can read — company first, then membership (or every room
 * for a read-only support session) — with the viewer's own row. The light
 * version of roomFor, for the writes and panels that need the room's
 * columns and not its thread. { room: null } answers like a missing room.
 */
async function visibleRoom(client, member, roomId) {
  if (!member?.companyId || !roomId || typeof roomId !== "string") return { room: null, mine: null };
  const room = await client.companyChatRoom.findFirst({
    where: { id: roomId, companyId: member.companyId, ...visibleWhere(member) },
    select: ROOM_FIELDS,
  });
  if (!room) return { room: null, mine: null };
  const mine = member.id
    ? await client.companyChatMember.findFirst({
        where: { roomId: room.id, companyId: member.companyId, memberId: member.id, open: true },
        select: MINE_SELECT,
      })
    : null;
  return { room, mine };
}

/**
 * The members of a room, for the Members panel — ONE PAGE at a time, because
 * a group has no maximum size and #general is the whole roster. Only for a
 * viewer who can read the room.
 *
 * #general and job rooms are derived and a DM is two people, so for those
 * the panel lists and explains and offers no control. For a channel or a
 * group, `can` says which controls the server will honour for THIS viewer —
 * the server decides each write again regardless.
 *
 * @param q       optional name/email search — the @ list of a big room
 * @param cursor  the offset of the page (a number as a string, from
 *                `nextCursor`); paging is by join order, which is stable
 */
export async function membersOf(member, roomId, { client = db, q = "", cursor = null, take = MEMBER_PAGE } = {}) {
  const { room, mine } = await visibleRoom(client, member, roomId);
  if (!room) return null;
  const needle = String(q || "").trim().slice(0, 80);
  const where = {
    roomId: room.id,
    companyId: member.companyId,
    open: true,
    ...(needle
      ? {
          member: {
            user: {
              OR: [{ name: { contains: needle, mode: "insensitive" } }, { email: { contains: needle, mode: "insensitive" } }],
            },
          },
        }
      : {}),
  };
  const size = Math.max(1, Math.min(Number(take) || MEMBER_PAGE, 200));
  const offset = Math.max(0, Number.parseInt(cursor, 10) || 0);
  const [rows, total] = await Promise.all([
    client.companyChatMember.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: offset,
      take: size + 1,
      select: { memberId: true, role: true, addedByMemberId: true, member: MEMBER_PERSON },
    }),
    client.companyChatMember.count({ where }),
  ]);
  const page = rows.slice(0, size);
  const titles = await workerTitlesByUserId(
    member.companyId,
    page.map((m) => m.member?.userId),
    { client },
  );
  // "added by Dana": one lookup for the page's adders, scoped to the company.
  const adderIds = [...new Set(page.map((m) => m.addedByMemberId).filter(Boolean))];
  const adders = adderIds.length
    ? await client.member.findMany({
        where: { id: { in: adderIds }, companyId: member.companyId },
        select: { id: true, user: { select: { name: true, email: true } } },
      })
    : [];
  const adderName = new Map(adders.map((a) => [a.id, a.user?.name || a.user?.email || null]));
  const members = page.map((m) => ({
    id: m.memberId,
    name: memberName(m),
    email: m.member?.user?.email || null,
    label: labelFor(m.member?.role),
    title: titles.get(m.member?.userId) || null,
    departed: !m.member || m.member.active === false,
    isYou: m.memberId === member.id,
    manager: MADE_KINDS.includes(room.kind) && m.role === "manager",
    addedBy: m.addedByMemberId && m.addedByMemberId !== m.memberId ? adderName.get(m.addedByMemberId) || null : null,
  }));
  return {
    room: {
      id: room.id,
      kind: room.kind,
      name: room.name,
      jobId: room.jobId || null,
      private: Boolean(room.private),
      autoJoin: Boolean(room.autoJoin),
      archived: Boolean(room.archivedAt),
    },
    members,
    total,
    nextCursor: rows.length > size ? String(offset + size) : null,
    can: {
      add: canAddMembers(room, member, mine),
      remove: canRemoveMembers(room, member, mine),
    },
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
    // Opening a DM you hid from your list is asking for it back.
    await client.companyChatMember.updateMany({
      where: { roomId: existing.id, companyId, memberId: member.id, NOT: { hiddenAt: null } },
      data: { hiddenAt: null },
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
 * Say something. Refused for a read-only session, for a message with no
 * words, no file and no card, for a room that is not the member's company's
 * or that they are not in — the last two answering identically — for an
 * ARCHIVED room (read-only, kept), and for an office-only channel
 * (#announcements) when the author is not the office.
 *
 * Phase 3–4 (2026-10-04) — what else a message may carry, each checked here:
 *
 *   attachments  uploadFile's entries for purpose "chat": private files in
 *                THIS company's chat folder only (attachments.js), at most
 *                CHAT_ATTACHMENTS_MAX — else `bad_attachment`, nothing saved
 *   card         { type, id } of a job, work order or quote the AUTHOR can
 *                open, in their company (cards.js) — else `bad_card`
 *   replyToId    a message in the SAME room that is still there — else
 *                `bad_reply`
 *   offlineKey   the phone's outbox key (X-Offline-Key): the same send
 *                replayed after a lost answer is ONE message, answered from
 *                the ledger (lib/offline/idempotency.js), and pushes nobody
 *                the second time
 *
 * Mentions are parsed against the members of the room AT THIS MOMENT and
 * stored. The room's lastMessageAt and the author's lastSeenAt are written
 * in the SAME transaction as the message, so the list's ordering can never
 * describe a message that failed to save, and saying something is seeing it.
 *
 * `notify` is the push sender and `bell` the notification-bell writer;
 * both injectable so the check can assert who was told, and how, without
 * web-push or the feed's tables.
 */
export async function postMessage(
  { member, roomId, body, attachments = null, card = null, replyToId = null, offlineKey = null },
  { client = db, notify = pushToUsers, bell = null, cloudName = process.env.CLOUDINARY_CLOUD_NAME } = {},
) {
  if (!canWrite(member)) return READ_ONLY;
  const text = typeof body === "string" ? body.trim() : "";
  const hasFiles = Array.isArray(attachments) && attachments.length > 0;
  const hasCard = card !== null && card !== undefined && card !== "";
  if (!roomId || (!text && !hasFiles && !hasCard)) return refuse(400, "empty", "Say something first.");

  const room = await client.companyChatRoom.findFirst({
    where: { id: roomId, companyId: member.companyId },
    select: ROOM_FIELDS,
  });
  if (!room) return NO_ROOM;
  const membership = await memberOrAutoJoin(client, member, room);
  if (!membership) return NO_ROOM;
  const allowed = canPost(room, member);
  if (!allowed.ok) {
    if (allowed.code === "archived") return ARCHIVED;
    if (allowed.code === "office_only") {
      return refuse(403, "office_only", "Only the office posts in this channel. Everyone can read it.");
    }
    return READ_ONLY;
  }

  // A replay of a send that already landed answers from the ledger before
  // anything else is checked or written — the files and card were checked
  // the first time, and a second check could only disagree with a message
  // that already exists.
  if (offlineKey) {
    const seen = await client.offlineSyncItem.findUnique({
      where: { companyId_clientKey: { companyId: member.companyId, clientKey: offlineKey } },
      select: { entityId: true },
    });
    if (seen?.entityId) {
      const prior = await client.companyChatMessage.findFirst({
        where: { id: seen.entityId, companyId: member.companyId, roomId: room.id },
        select: { id: true, createdAt: true },
      });
      if (prior) return { ok: true, replayed: true, message: { id: prior.id, createdAt: prior.createdAt } };
    }
  }

  const files = parseChatAttachments(hasFiles ? attachments : null, { companyId: member.companyId, cloudName });
  if (!files.ok) return refuse(400, files.code, files.error);
  const cardCheck = hasCard ? await checkCardForPoster(client, member, card) : { ok: true, card: null };
  if (!cardCheck.ok) return refuse(400, "bad_card", "That can't be shared here. Open it first, then share it again.");
  let replyTo = null;
  if (replyToId !== null && replyToId !== undefined && replyToId !== "") {
    replyTo =
      typeof replyToId === "string"
        ? await client.companyChatMessage.findFirst({
            where: { id: replyToId, roomId: room.id, companyId: member.companyId, kind: "message", deletedAt: null },
            select: { id: true },
          })
        : null;
    if (!replyTo) return refuse(400, "bad_reply", "That message isn't there to reply to any more.");
  }

  // Names are only needed to find an "@": a message with none mentions
  // nobody, and a 2,000-person group's roster is not loaded to learn that.
  const people = text.includes("@") ? await openMembersOf(client, member.companyId, room.id) : [];
  // "@everyone" reaches the room only from the office (rules.js
  // mayMentionEveryone). `member.role` is the session's own row, never a
  // field the browser sent. Anyone else's "@everyone" stays as words.
  const mentions = parseMentions(text, people, { everyone: mayMentionEveryone(member) });
  const now = new Date();
  const write = async (tx) => {
    const message = await tx.companyChatMessage.create({
      data: {
        companyId: member.companyId,
        roomId: room.id,
        authorMemberId: member.id,
        body: text.slice(0, 4000),
        mentions,
        ...(files.attachments.length ? { attachments: files.attachments } : {}),
        ...(cardCheck.card ? { card: cardCheck.card } : {}),
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      },
      select: { id: true, body: true, createdAt: true, mentions: true },
    });
    await tx.companyChatRoom.update({ where: { id: room.id }, data: { lastMessageAt: now } });
    await tx.companyChatMember.update({ where: { id: membership.id }, data: { lastSeenAt: now } });
    return { entityId: message.id, result: message };
  };
  const done = offlineKey
    ? await withOfflineKey({ db: client, companyId: member.companyId, memberId: member.id, key: offlineKey, kind: "chat" }, write)
    : { replayed: false, ...(await client.$transaction(write)) };
  if (done.replayed) {
    // Lost the race to an identical replay: the other one wrote it and told people.
    return { ok: true, replayed: true, message: done.entityId ? { id: done.entityId } : null };
  }
  const message = done.result;

  // ── Who is told ────────────────────────────────────────────────────────
  //
  // rules.js notifyVerdict, per member: never the author, never somebody
  // looking at the room, never a room they set to "none"; a mention for the
  // people named (push AND a bell row), every message for a DM and for a
  // room they hear everything in. Fire-and-forget after the transaction has
  // committed: the row is the record, the push is a courtesy about it. A
  // failure here never fails the post.
  try {
    // A message with no words still says something in a push: what it
    // carried, in each reader's language (tellPeople translates the key).
    const snippetKey = text
      ? null
      : files.attachments.length
        ? files.attachments.every((a) => a.type === "photo")
          ? "app.companyChat.push.photo"
          : "app.companyChat.push.file"
        : "app.companyChat.push.card";
    await tellPeople(client, { member, room, text, snippetKey, mentions, people, now, notify, bell, messageId: message.id });
  } catch (err) {
    console.error("[company chat] notify failed:", err?.message);
  }
  return { ok: true, message };
}

/**
 * The fan-out. One query for the room's open members (light columns — no
 * names unless an @ already loaded them), the pure verdict per member, then
 * the pushes in PUSH_CHUNK slices and one bell event for the mentioned.
 */
async function tellPeople(client, { member, room, text, snippetKey = null, mentions, people, now, notify, bell, messageId }) {
  const rows = await client.companyChatMember.findMany({
    where: { roomId: room.id, companyId: member.companyId, open: true, NOT: { memberId: member.id } },
    select: { memberId: true, open: true, notify: true, mutedUntil: true, lastOpenedAt: true, member: { select: { userId: true, active: true } } },
  });
  const named = new Set(mentions.map(parseMemberKey).filter(Boolean));
  const groups = { message: [], mention: [] };
  const belled = [];
  for (const row of rows) {
    const userId = row.member?.userId;
    if (!userId || row.member?.active === false) continue;
    const verdict = notifyVerdict({ kind: room.kind, membership: row, mentioned: named.has(row.memberId), isAuthor: false, now });
    if (verdict.push) groups[verdict.push].push(userId);
    if (verdict.bell) belled.push(userId);
  }
  if (!groups.message.length && !groups.mention.length && !belled.length) return;

  const author = people.find((p) => p.id === member.id) || (await authorPerson(client, member));
  const authorName = author?.name || "Someone";
  const roomName = await pushRoomName(client, room, authorName, member.id);
  const snippet = text.replace(/\s+/g, " ").slice(0, 90);
  const fallbackLanguage = await companyLanguage(client, member.companyId);
  const url = `/app/chat?room=${encodeURIComponent(room.id)}`;
  const send = (userIds, titleKey, params) => {
    // Sequential slices, each fire-and-forget: the post returns now, and a
    // huge group's pushes leave a few hundred at a time.
    let chain = Promise.resolve();
    for (let i = 0; i < userIds.length; i += PUSH_CHUNK) {
      const slice = userIds.slice(i, i + PUSH_CHUNK);
      chain = chain.then(() =>
        notify({
          userIds: slice,
          fallbackLanguage,
          payload: async (language) => ({
            title: await appSentence(language, titleKey, params),
            body: snippet || (snippetKey ? (await appSentence(language, snippetKey)) || "" : ""),
            // Same tag as the screen's own notify() for the room, so a
            // person with both sees each event once.
            tag: `company-chat:${room.id}`,
            url,
          }),
        }),
      );
    }
    void chain.catch(() => {});
  };
  if (groups.message.length) {
    if (room.kind === "dm") send(groups.message, "app.notify.newMessage.title", { name: authorName });
    else send(groups.message, "app.notify.roomMessage.title", { name: authorName, room: roomName });
  }
  if (groups.mention.length) send(groups.mention, "app.notify.mention.title", { name: authorName, room: roomName });

  // ── The bell ───────────────────────────────────────────────────────────
  //
  // Owner decision 2026-10-04: a mention also lands in the notification
  // bell, so "Ana asked me something in #estimating" survives a dismissed
  // push and a phone with notifications off. notifyEvent writes the feed
  // row ONLY (push: false) — the chat's own push above already carries the
  // mention, with the room's tag and the "looking" rule, and a second push
  // for the same words would be the double ping this exists to avoid.
  if (belled.length) {
    const write =
      bell ||
      ((args) => notifyEvent({ ...args, push: false }, client === db ? {} : { db: client }));
    await write({
      companyId: member.companyId,
      type: "chat.mention",
      entityId: messageId,
      params: { name: authorName, room: roomName },
      actorUserId: member.userId || null,
      actorName: authorName,
      recipientUserIds: belled,
    });
  }
}

/** The author's display person, when no @ loaded the room's names. */
async function authorPerson(client, member) {
  const row = await client.member.findFirst({
    where: { id: member.id, companyId: member.companyId },
    select: { user: { select: { name: true, email: true } } },
  });
  return row ? { name: row.user?.name || row.user?.email || null } : null;
}

/**
 * What a push and a bell row call the room. "#general", "#estimating", a
 * job's title with a "#" as the screen prints it, a group's name — or, for
 * a group with none, the first few people in it other than the author (the
 * title already names them: "Mia in Tom, Pia, Eli"). Stored once on a bell
 * row and read by many, so it is never "you".
 */
async function pushRoomName(client, room, authorName, authorMemberId = null) {
  if (room.kind === "dm") return authorName;
  if (room.kind === "group") {
    if (room.name) return room.name;
    const rows = await client.companyChatMember.findMany({
      where: { roomId: room.id, companyId: room.companyId, open: true, ...(authorMemberId ? { NOT: { memberId: authorMemberId } } : {}) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 3,
      select: { member: { select: { user: { select: { name: true, email: true } } } } },
    });
    return rows.map((r) => memberName(r)).filter(Boolean).join(", ") || "Group";
  }
  return `#${room.name || "general"}`;
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

/** How often lastOpenedAt is re-stamped while a room stays open. A write per
 *  4-second poll per open reader is a lot of writes to say "still here". */
const OPENED_RESTAMP_MS = 10 * 1000;

/**
 * Mark a room read, up to the last message the reader was SHOWN. Silently
 * does nothing for a non-member or a read-only session (which holds no row
 * to stamp).
 *
 * `upTo` is the createdAt of the last message in the payload the route is
 * about to return — lib/chat/unreadQuery.js seenUpTo says why it is that
 * and not the clock. It only ever moves lastSeenAt FORWARD, in the one
 * statement, so two tabs reading the same room in either order leave the
 * later boundary standing. A payload with no messages moves nothing: there
 * was nothing to have seen.
 *
 * It also stamps lastOpenedAt — "looking at it now" — on every read, empty
 * or not, at most every OPENED_RESTAMP_MS: the push rule (rules.js
 * isLooking) needs to know somebody is staring at a quiet room.
 */
export async function markRoomSeen(member, roomId, { upTo = null, client = db, now = new Date() } = {}) {
  if (!canWrite(member) || !roomId) return false;
  const row = await client.companyChatMember.findFirst({
    where: { roomId, companyId: member.companyId, memberId: member.id, open: true },
    select: { id: true },
  });
  if (!row) return false;
  await client.companyChatMember.updateMany({
    where: { id: row.id, OR: [{ lastOpenedAt: null }, { lastOpenedAt: { lt: new Date(now.getTime() - OPENED_RESTAMP_MS) } }] },
    data: { lastOpenedAt: now },
  });
  const seen = upTo ? new Date(upTo) : null;
  if (!seen || Number.isNaN(seen.getTime())) return true;
  await client.companyChatMember.updateMany({
    where: { id: row.id, OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: seen } }] },
    data: { lastSeenAt: seen },
  });
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════
// Channels and groups (2026-10-04)
// ═══════════════════════════════════════════════════════════════════════════
//
// The rules — who may make, rename, archive, add, remove, leave — are
// rules.js, pure; these are the writes. Every one:
//
//   * re-reads the room by the caller's companyId and their OPEN membership
//     (a private channel answers a non-member 404, exactly like a room that
//     does not exist — the staff chat's rule, lib/staff/store.js);
//   * resolves every member id the browser sent against the live roster of
//     the SAME company, refusing the whole call (member_unknown) when one is
//     not there, rather than quietly adding the rest;
//   * never deletes: leaving and removal CLOSE the row, archiving keeps the
//     channel and its words;
//   * writes a system line into the room (the record people read) and an
//     activity-log row (the record the owner audits).

/** The ids the browser sent, each once, as strings. */
function idList(ids) {
  return [...new Set((Array.isArray(ids) ? ids : []).filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()))];
}

/**
 * These member ids, resolved against the company's ACTIVE roster. Returns
 * { people: [{ id, name }], missing } — `missing` true when any id is not an
 * active member of THIS company (deactivated, another company's, made up).
 */
async function resolveRoster(client, companyId, ids) {
  if (!ids.length) return { people: [], missing: false };
  const rows = await client.member.findMany({
    where: { companyId, active: true, id: { in: ids } },
    select: { id: true, user: { select: { name: true, email: true } } },
  });
  const people = rows.map((r) => ({ id: r.id, name: r.user?.name || r.user?.email || null }));
  return { people, missing: people.length !== ids.length };
}

/** A system line's names: the first few, and how many more. */
function namesLine(people) {
  const names = people.map((p) => p.name).filter(Boolean);
  return { names: names.slice(0, NAMES_IN_LINE), more: Math.max(0, people.length - NAMES_IN_LINE) };
}

/** The author's own display name, for a system line's English body. */
async function nameOf(client, member) {
  return (await authorPerson(client, member))?.name || "Someone";
}

function systemLine(client, member, roomId, meta, body) {
  return client.companyChatMessage.create({
    data: { companyId: member.companyId, roomId, authorMemberId: member.id, kind: "system", body: String(body).slice(0, 4000), meta },
    select: { id: true },
  });
}

/** The activity log, never allowed to fail the write it describes. */
async function logActivity(log, member, event) {
  try {
    await log(member, { entityType: "chat_room", ...event });
  } catch {
    /* recordActivity swallows its own failures; this is belt and braces */
  }
}

/**
 * Make a channel. The office only (rules.js canCreateChannel).
 *
 * The key's unique index is the authority on "already taken" — P2002 is
 * read back as `name_taken` rather than checked ahead of time, so two
 * managers making #estimating at the same instant get one channel. An
 * ARCHIVED #estimating still holds its name: it is kept, and unarchiving it
 * must not collide.
 *
 * A public auto-join channel takes everybody now and every new hire later;
 * a private channel takes the maker and the people picked, and nobody else
 * can find it.
 */
export async function createChannel(
  member,
  { name, topic = "", isPrivate = false, postingPolicy = "everyone", autoJoin = false, memberIds = [] } = {},
  { client = db, log = recordActivity } = {},
) {
  if (!canWrite(member)) return READ_ONLY;
  if (!canCreateChannel(member)) return refuse(403, "not_allowed", "Only the office can make a channel.");
  const check = validateChannelName(name, { reserved: RESERVED_CHANNEL_SLUGS, unicode: true });
  if (!check.ok) return refuse(400, check.reason, NAME_SENTENCES[check.reason] || "That name will not do.");
  const priv = isPrivate === true;
  const auto = !priv && autoJoin === true;
  const policy = POSTING_POLICIES.includes(postingPolicy) ? postingPolicy : "everyone";
  const cleanTopic = typeof topic === "string" ? topic.trim().slice(0, TOPIC_MAX) : "";

  const ids = idList(memberIds).filter((id) => id !== member.id);
  const { people, missing } = await resolveRoster(client, member.companyId, ids);
  if (missing) return refuse(404, "member_unknown", "Somebody on that list is not on the team any more.");
  const everybody = auto ? (await activeRoster(member.companyId, { client })).map((m) => m.id) : [];
  const others = [...new Set([...people.map((p) => p.id), ...everybody])].filter((id) => id !== member.id);
  const by = await nameOf(client, member);
  const now = new Date();

  let roomId;
  try {
    roomId = await client.$transaction(async (tx) => {
      const room = await tx.companyChatRoom.create({
        data: {
          companyId: member.companyId,
          kind: "channel",
          key: channelRoomKey(check.slug),
          name: check.slug,
          topic: cleanTopic || null,
          private: priv,
          postingPolicy: policy,
          autoJoin: auto,
          createdByMemberId: member.id,
          lastMessageAt: now,
        },
        select: { id: true },
      });
      await tx.companyChatMember.createMany({
        data: [
          { companyId: member.companyId, roomId: room.id, memberId: member.id, role: "manager" },
          ...others.map((id) => ({ companyId: member.companyId, roomId: room.id, memberId: id, addedByMemberId: member.id })),
        ],
        skipDuplicates: true,
      });
      await systemLine(tx, member, room.id, { system: "created", name: check.slug, private: priv }, `${by} created #${check.slug}`);
      return room.id;
    });
  } catch (err) {
    if (err?.code === "P2002") return refuse(409, "name_taken", "A channel with that name already exists.");
    throw err;
  }
  await logActivity(log, member, {
    action: "chat.channel_created",
    entityId: roomId,
    summary: `Created ${priv ? "private" : "public"} channel #${check.slug}`,
    metadata: { private: priv, postingPolicy: policy, autoJoin: auto, members: others.length + 1 },
  });
  return { ok: true, roomId, kind: "channel" };
}

/**
 * Start a group: the maker and the people picked. Anybody may (crew
 * included); there is no maximum size. One person picked is a DM, not a
 * group of two — openDirect, so the pair keeps the one room it already has.
 */
export async function createGroup(member, { memberIds = [], name = "" } = {}, { client = db, log = recordActivity } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const ids = idList(memberIds).filter((id) => id !== member.id);
  if (!ids.length) return refuse(400, "nobody_named", "Pick at least one person.");
  const { people, missing } = await resolveRoster(client, member.companyId, ids);
  if (missing) return refuse(404, "member_unknown", "Somebody on that list is not on the team any more.");
  if (people.length === 1) {
    const dm = await openDirect(member, people[0].id, { client });
    return dm.ok ? { ...dm, kind: "dm" } : dm;
  }
  const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, GROUP_NAME_MAX) : "";
  const by = await nameOf(client, member);
  const now = new Date();
  const roomId = await client.$transaction(async (tx) => {
    const room = await tx.companyChatRoom.create({
      data: {
        companyId: member.companyId,
        kind: "group",
        key: groupRoomKey(globalThis.crypto.randomUUID()),
        name: clean || null,
        createdByMemberId: member.id,
        lastMessageAt: now,
      },
      select: { id: true },
    });
    await tx.companyChatMember.createMany({
      data: [
        { companyId: member.companyId, roomId: room.id, memberId: member.id, role: "manager" },
        ...people.map((p) => ({ companyId: member.companyId, roomId: room.id, memberId: p.id, addedByMemberId: member.id })),
      ],
      skipDuplicates: true,
    });
    await systemLine(tx, member, room.id, { system: "created_group", ...namesLine(people) }, `${by} started a group`);
    return room.id;
  });
  await logActivity(log, member, {
    action: "chat.group_created",
    entityId: roomId,
    summary: `Started a group chat with ${people.length} ${people.length === 1 ? "person" : "people"}`,
    metadata: { members: people.length + 1 },
  });
  return { ok: true, roomId, kind: "group" };
}

/**
 * Rename a channel or group, or change a channel's topic, visibility,
 * posting rule or auto-join. Each field is checked on its own; a field the
 * caller may not change refuses the whole call (`not_allowed`) rather than
 * saving the rest and implying the rest was all they asked.
 */
export async function updateRoom(member, roomId, patch = {}, { client = db, log = recordActivity } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const { room, mine } = await visibleRoom(client, member, roomId);
  if (!room || !mine) return NO_ROOM;
  if (!MADE_KINDS.includes(room.kind)) return FIXED_ROOM;
  if (room.archivedAt) return ARCHIVED;
  const p = patch && typeof patch === "object" ? patch : {};
  const isChannel = room.kind === "channel";
  const manage = canManage(room, member, mine);
  const data = {};
  const lines = [];

  if (typeof p.name === "string") {
    if (!canRename(room, member, mine)) return NOT_ALLOWED;
    if (isChannel) {
      const check = validateChannelName(p.name, { reserved: RESERVED_CHANNEL_SLUGS, unicode: true });
      if (!check.ok) return refuse(400, check.reason, NAME_SENTENCES[check.reason] || "That name will not do.");
      if (check.slug !== room.name) {
        data.name = check.slug;
        data.key = channelRoomKey(check.slug);
        lines.push({ meta: { system: "renamed", from: room.name, to: check.slug, channel: true }, body: `renamed #${room.name} to #${check.slug}` });
      }
    } else {
      const clean = p.name.trim().replace(/\s+/g, " ").slice(0, GROUP_NAME_MAX) || null;
      if (clean !== (room.name || null)) {
        data.name = clean;
        lines.push({ meta: { system: "renamed", from: room.name || null, to: clean }, body: clean ? `named the group ${clean}` : "removed the group's name" });
      }
    }
  }
  if (typeof p.topic === "string") {
    if (!isChannel || !manage) return isChannel ? NOT_ALLOWED : FIXED_ROOM;
    const clean = p.topic.trim().slice(0, TOPIC_MAX) || null;
    if (clean !== (room.topic || null)) {
      data.topic = clean;
      lines.push({ meta: { system: "topic", to: clean }, body: clean ? `set the topic: ${clean}` : "cleared the topic" });
    }
  }
  if (p.postingPolicy !== undefined) {
    if (!isChannel || !manage) return isChannel ? NOT_ALLOWED : FIXED_ROOM;
    if (!POSTING_POLICIES.includes(p.postingPolicy)) return refuse(400, "bad_setting", "That posting rule doesn't exist.");
    if (p.postingPolicy !== room.postingPolicy) {
      data.postingPolicy = p.postingPolicy;
      lines.push({ meta: { system: "policy", to: p.postingPolicy }, body: p.postingPolicy === "office" ? "made it office-only posting" : "opened posting to everyone" });
    }
  }
  if (p.private !== undefined) {
    if (!isChannel || !manage) return isChannel ? NOT_ALLOWED : FIXED_ROOM;
    const next = p.private === true;
    if (next !== Boolean(room.private)) {
      data.private = next;
      // A private channel takes nobody automatically: auto-join is a public
      // channel's property, and leaving it on would add the next hire to a
      // room the channel's own members chose to keep small.
      if (next && room.autoJoin) data.autoJoin = false;
      lines.push({ meta: { system: "visibility", to: next ? "private" : "public" }, body: next ? "made the channel private" : "made the channel public" });
    }
  }
  let turnedOnAutoJoin = false;
  if (p.autoJoin !== undefined) {
    if (!isChannel || !manage) return isChannel ? NOT_ALLOWED : FIXED_ROOM;
    const next = p.autoJoin === true;
    const privateAfter = data.private !== undefined ? data.private : Boolean(room.private);
    if (next && privateAfter) return refuse(400, "bad_setting", "A private channel can't add everyone automatically.");
    if (next !== Boolean(room.autoJoin) && data.autoJoin === undefined) {
      data.autoJoin = next;
      turnedOnAutoJoin = next;
      lines.push({ meta: { system: "autojoin", to: next }, body: next ? "set the channel to include everyone" : "stopped adding everyone automatically" });
    }
  }
  if (!Object.keys(data).length) return { ok: true, unchanged: true };

  const by = await nameOf(client, member);
  try {
    await client.$transaction([
      client.companyChatRoom.update({ where: { id: room.id }, data, select: { id: true } }),
      ...lines.map((l) => systemLine(client, member, room.id, l.meta, `${by} ${l.body}`)),
    ]);
  } catch (err) {
    if (err?.code === "P2002") return refuse(409, "name_taken", "A channel with that name already exists.");
    throw err;
  }
  if (turnedOnAutoJoin) {
    const everybody = (await activeRoster(member.companyId, { client })).map((m) => m.id);
    await syncAutoJoin(client, member.companyId, everybody, [room.id]);
  }
  await logActivity(log, member, {
    action: "chat.room_updated",
    entityId: room.id,
    summary: `Changed ${isChannel ? `#${data.name || room.name}` : "a group chat"}: ${lines.map((l) => l.meta.system).join(", ")}`,
    metadata: { changes: lines.map((l) => l.meta) },
  });
  return { ok: true };
}

/**
 * Archive a channel — or bring it back. Archived is read-only and KEPT:
 * listed under Archived, every word still there, nothing deleted. Channels
 * only; a group is left, not archived.
 */
export async function archiveRoom(member, roomId, { archive = true } = {}, { client = db, log = recordActivity } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const { room, mine } = await visibleRoom(client, member, roomId);
  if (!room || !mine) return NO_ROOM;
  if (room.kind !== "channel") return FIXED_ROOM;
  if (!canArchive(room, member, mine)) return NOT_ALLOWED;
  const want = archive !== false;
  if (want === Boolean(room.archivedAt)) return { ok: true, unchanged: true };
  const by = await nameOf(client, member);
  const now = new Date();
  await client.$transaction([
    client.companyChatRoom.update({
      where: { id: room.id },
      data: want ? { archivedAt: now, archivedByMemberId: member.id } : { archivedAt: null, archivedByMemberId: null },
      select: { id: true },
    }),
    systemLine(client, member, room.id, { system: want ? "archived" : "unarchived" }, `${by} ${want ? "archived" : "unarchived"} #${room.name}`),
  ]);
  await logActivity(log, member, {
    action: want ? "chat.channel_archived" : "chat.channel_unarchived",
    entityId: room.id,
    summary: `${want ? "Archived" : "Unarchived"} #${room.name}`,
  });
  return { ok: true };
}

/** Join a public channel. A private one answers as if it did not exist. */
export async function joinRoom(member, roomId, { client = db } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  if (!roomId || typeof roomId !== "string") return NO_ROOM;
  const room = await client.companyChatRoom.findFirst({ where: { id: roomId, companyId: member.companyId }, select: ROOM_FIELDS });
  if (!room || !isJoinable(room)) return NO_ROOM;
  const existing = await client.companyChatMember.findFirst({
    where: { roomId: room.id, companyId: member.companyId, memberId: member.id },
    select: { id: true, open: true },
  });
  if (existing?.open) return { ok: true, roomId: room.id, already: true };
  const by = await nameOf(client, member);
  await client.$transaction([
    existing
      ? client.companyChatMember.update({
          where: { id: existing.id },
          data: { open: true, removedAt: null, hiddenAt: null, addedByMemberId: null, role: "member" },
          select: { id: true },
        })
      : client.companyChatMember.create({ data: { companyId: member.companyId, roomId: room.id, memberId: member.id }, select: { id: true } }),
    systemLine(client, member, room.id, { system: "joined" }, `${by} joined`),
  ]);
  return { ok: true, roomId: room.id };
}

/** Leave a channel or group. The row is CLOSED, never deleted. */
export async function leaveRoom(member, roomId, { client = db } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const { room, mine } = await visibleRoom(client, member, roomId);
  if (!room || !mine) return NO_ROOM;
  const check = canLeave(room);
  if (!check.ok) {
    if (check.reason === "auto_join") {
      return refuse(400, "auto_join", "Everyone is in this channel. Mute it instead of leaving.");
    }
    return FIXED_ROOM;
  }
  const by = await nameOf(client, member);
  await client.$transaction([
    client.companyChatMember.update({
      where: { id: mine.id },
      // A manager who leaves is no longer one: coming back is joining.
      data: { open: false, removedAt: new Date(), role: "member" },
      select: { id: true },
    }),
    systemLine(client, member, room.id, { system: "left" }, `${by} left`),
  ]);
  return { ok: true };
}

/**
 * Put people in a channel or group. A closed row (somebody who left or was
 * removed) is reopened — the same row, so their old messages and their
 * place in the history stay theirs; a person never in it gets a new row.
 * Already-in people are skipped, not refused.
 */
export async function addMembers(member, roomId, memberIds = [], { client = db, log = recordActivity } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const { room, mine } = await visibleRoom(client, member, roomId);
  if (!room || !mine) return NO_ROOM;
  if (!MADE_KINDS.includes(room.kind)) return FIXED_ROOM;
  if (room.archivedAt) return ARCHIVED;
  if (!canAddMembers(room, member, mine)) return NOT_ALLOWED;
  const ids = idList(memberIds).filter((id) => id !== member.id);
  if (!ids.length) return refuse(400, "nobody_named", "Pick at least one person.");
  const { people, missing } = await resolveRoster(client, member.companyId, ids);
  if (missing) return refuse(404, "member_unknown", "Somebody on that list is not on the team any more.");

  const rows = await client.companyChatMember.findMany({
    where: { roomId: room.id, companyId: member.companyId, memberId: { in: people.map((p) => p.id) } },
    select: { id: true, memberId: true, open: true },
  });
  const byMember = new Map(rows.map((r) => [r.memberId, r]));
  const reopen = [];
  const create = [];
  const added = [];
  for (const p of people) {
    const row = byMember.get(p.id);
    if (row?.open) continue;
    if (row) reopen.push(row.id);
    else create.push(p.id);
    added.push(p);
  }
  if (!added.length) return { ok: true, added: 0 };
  const by = await nameOf(client, member);
  await client.$transaction([
    ...(reopen.length
      ? [
          client.companyChatMember.updateMany({
            where: { id: { in: reopen }, companyId: member.companyId },
            data: { open: true, removedAt: null, hiddenAt: null, addedByMemberId: member.id, role: "member" },
          }),
        ]
      : []),
    ...(create.length
      ? [
          client.companyChatMember.createMany({
            data: create.map((id) => ({ companyId: member.companyId, roomId: room.id, memberId: id, addedByMemberId: member.id })),
            skipDuplicates: true,
          }),
        ]
      : []),
    systemLine(client, member, room.id, { system: "added", ...namesLine(added) }, `${by} added ${added.map((p) => p.name).slice(0, NAMES_IN_LINE).join(", ")}`),
  ]);
  await logActivity(log, member, {
    action: "chat.members_added",
    entityId: room.id,
    summary: `Added ${added.length} ${added.length === 1 ? "person" : "people"} to ${room.kind === "channel" ? `#${room.name}` : "a group chat"}`,
    metadata: { memberIds: added.map((p) => p.id).slice(0, 100), count: added.length },
  });
  return { ok: true, added: added.length };
}

/**
 * Take somebody out of a channel or group. The row is CLOSED — never
 * deleted — so their messages stay attributed and "was in it until March"
 * stays true. Taking yourself out is leaving, with leaving's rules.
 */
export async function removeMember(member, roomId, targetMemberId, { client = db, log = recordActivity } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  if (targetMemberId && targetMemberId === member.id) return leaveRoom(member, roomId, { client });
  const { room, mine } = await visibleRoom(client, member, roomId);
  if (!room || !mine) return NO_ROOM;
  if (!MADE_KINDS.includes(room.kind)) return FIXED_ROOM;
  if (!canRemoveMembers(room, member, mine)) return NOT_ALLOWED;
  if (!targetMemberId || typeof targetMemberId !== "string") return refuse(400, "nobody_named", "Say who to remove.");
  const row = await client.companyChatMember.findFirst({
    where: { roomId: room.id, companyId: member.companyId, memberId: targetMemberId, open: true },
    select: { id: true, member: MEMBER_PERSON },
  });
  if (!row) return refuse(404, "not_member", "They're not in this conversation.");
  const name = memberName(row) || "Someone";
  const by = await nameOf(client, member);
  await client.$transaction([
    client.companyChatMember.update({ where: { id: row.id }, data: { open: false, removedAt: new Date(), role: "member" }, select: { id: true } }),
    systemLine(client, member, room.id, { system: "removed", names: [name], more: 0 }, `${by} removed ${name}`),
  ]);
  await logActivity(log, member, {
    action: "chat.member_removed",
    entityId: room.id,
    summary: `Removed ${name} from ${room.kind === "channel" ? `#${room.name}` : "a group chat"}`,
    metadata: { memberId: targetMemberId },
  });
  return { ok: true };
}

/**
 * The viewer's own settings for one room: notify level, snooze, hide, star.
 * Their row only — nothing here is visible to anybody else.
 */
export async function updateMySubscription(member, roomId, patch = {}, { client = db, now = new Date() } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const { room, mine } = await visibleRoom(client, member, roomId);
  if (!room || !mine) return NO_ROOM;
  const p = patch && typeof patch === "object" ? patch : {};
  const data = {};
  if (p.notify !== undefined) {
    if (!NOTIFY_LEVELS.includes(p.notify)) return refuse(400, "bad_setting", "That notification setting doesn't exist.");
    data.notify = p.notify;
  }
  if (p.mutedUntil !== undefined) {
    const snooze = parseSnooze(p.mutedUntil, now);
    if (!snooze.ok) return refuse(400, "bad_setting", "Pick a time in the next year to mute until.");
    data.mutedUntil = snooze.until;
  }
  if (p.hidden !== undefined) {
    if (p.hidden === true && room.kind !== "dm" && room.kind !== "group") return FIXED_ROOM;
    data.hiddenAt = p.hidden === true ? now : null;
  }
  if (p.starred !== undefined) data.starredAt = p.starred === true ? now : null;
  if (!Object.keys(data).length) return { ok: true, unchanged: true };
  await client.companyChatMember.update({ where: { id: mine.id }, data, select: { id: true } });
  return { ok: true };
}

/**
 * Who has seen one message: { count, people, nextCursor }. Room members
 * only (owner decision: receipts are for the room) — a read-only support
 * session and anybody not in it get null, the route's 404. Derived from each
 * member's read boundary, paged by join order; rules.js says why.
 */
export async function seenBy(member, roomId, messageId, { client = db, cursor = null, take = MEMBER_PAGE } = {}) {
  if (!member?.id || seesAllRooms(member)) return null;
  const { room, mine } = await visibleRoom(client, member, roomId);
  if (!room || !mine || !messageId || typeof messageId !== "string") return null;
  const message = await client.companyChatMessage.findFirst({
    where: { id: messageId, roomId: room.id, companyId: member.companyId, kind: "message" },
    select: { id: true, createdAt: true, authorMemberId: true },
  });
  if (!message) return null;
  const where = {
    roomId: room.id,
    companyId: member.companyId,
    open: true,
    lastSeenAt: { gte: message.createdAt },
    ...(message.authorMemberId ? { NOT: { memberId: message.authorMemberId } } : {}),
  };
  const size = Math.max(1, Math.min(Number(take) || MEMBER_PAGE, 200));
  const offset = Math.max(0, Number.parseInt(cursor, 10) || 0);
  const [rows, count] = await Promise.all([
    client.companyChatMember.findMany({
      where,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: offset,
      take: size + 1,
      select: { memberId: true, lastSeenAt: true, member: MEMBER_PERSON },
    }),
    client.companyChatMember.count({ where }),
  ]);
  return {
    count,
    people: rows.slice(0, size).map((r) => ({ id: r.memberId, name: memberName(r), isYou: r.memberId === member.id })),
    nextCursor: rows.length > size ? String(offset + size) : null,
  };
}

/**
 * Where a message lives, for a deep link (the bell's "Ana mentioned you"
 * row opens /app/chat?message=<id>). { roomId } only when the viewer can
 * read that room NOW — removed since, or another company's, is null, the
 * route's 404.
 */
export async function locateMessage(member, messageId, { client = db } = {}) {
  if (!member?.companyId || !messageId || typeof messageId !== "string") return null;
  const message = await client.companyChatMessage.findFirst({
    where: { id: messageId, companyId: member.companyId },
    select: { id: true, roomId: true },
  });
  if (!message) return null;
  const { room } = await visibleRoom(client, member, message.roomId);
  return room ? { roomId: room.id, messageId: message.id } : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Messages after they are sent: edit, remove, pin (phase 4, 2026-10-04)
// ═══════════════════════════════════════════════════════════════════════════
//
// Every one re-reads the message by the caller's companyId, then its room by
// the caller's OPEN membership (visibleRoom) — a message in a private channel
// the caller is not in answers exactly like a message that does not exist.
// The rules are rules.js (canEditMessage, canRemoveMessage, canPin), pure;
// the clock is the server's.

const NO_MESSAGE = refuse(404, "no_message", "That message isn't there any more.");
const EDIT_REFUSALS = {
  read_only: READ_ONLY,
  not_author: refuse(403, "not_author", "You can only edit your own messages."),
  too_late: refuse(403, "too_late", "Messages can be edited for 15 minutes after they're sent."),
  removed: NO_MESSAGE,
  not_allowed: NOT_ALLOWED,
};

/** A message of the caller's company, in a room they can read, with their own membership. */
async function messageInVisibleRoom(client, member, messageId) {
  if (!member?.companyId || typeof messageId !== "string" || !messageId || messageId.length > 64) return null;
  const message = await client.companyChatMessage.findFirst({
    where: { id: messageId, companyId: member.companyId },
    select: { id: true, roomId: true, kind: true, body: true, authorMemberId: true, createdAt: true, deletedAt: true, pinnedAt: true, attachments: true, card: true },
  });
  if (!message) return null;
  const { room, mine } = await visibleRoom(client, member, message.roomId);
  if (!room) return null;
  return { message, room, mine };
}

/**
 * Edit your own message within EDIT_WINDOW_MS of sending it. The row says
 * "(edited)" from then on (editedAt), and the 4-second poll carries the new
 * words to everybody with the room open (readThread `changed`). Mentions are
 * re-parsed so the tint matches the words; nobody is pushed again.
 */
export async function editMessage(member, messageId, body, { client = db, now = new Date() } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const found = await messageInVisibleRoom(client, member, messageId);
  if (!found || !found.mine) return NO_MESSAGE;
  const { message, room } = found;
  const verdict = canEditMessage(message, member, now);
  if (!verdict.ok) return EDIT_REFUSALS[verdict.code] || NOT_ALLOWED;
  const post = canPost(room, member);
  if (!post.ok) {
    if (post.code === "archived") return ARCHIVED;
    if (post.code === "office_only") return refuse(403, "office_only", "Only the office posts in this channel. Everyone can read it.");
    return READ_ONLY;
  }
  const text = typeof body === "string" ? body.trim() : "";
  const carries = (Array.isArray(message.attachments) && message.attachments.length > 0) || Boolean(message.card);
  if (!text && !carries) return refuse(400, "empty", "Say something first — or remove the message instead.");
  if (text === (message.body || "")) return { ok: true, unchanged: true };
  const people = text.includes("@") ? await openMembersOf(client, member.companyId, room.id) : [];
  const mentions = parseMentions(text, people, { everyone: mayMentionEveryone(member) });
  await client.companyChatMessage.update({
    where: { id: message.id },
    data: { body: text.slice(0, 4000), mentions, editedAt: now },
    select: { id: true },
  });
  return { ok: true, message: { id: message.id, editedAt: now } };
}

/**
 * Remove a message: your own any time; somebody else's only in a channel you
 * manage (rules.js canRemoveMessage). SOFT — deletedAt and deletedByMemberId
 * are set and the row and its words STAY in the database (never delete
 * data) — but the words are gone from every screen for everybody, the owner
 * and a support session included (owner decision 2026-10-04): every read
 * goes through rules.js threadMessages, which drops them, the list preview
 * and the unread count skip the row, search never matches it, and a reply
 * that quoted it now quotes "Message removed". A pin goes with it.
 *
 * Removing somebody ELSE's message is moderation, and lands in the activity
 * log — who removed whose, never what it said.
 */
export async function removeMessage(member, messageId, { client = db, log = recordActivity, now = new Date() } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const found = await messageInVisibleRoom(client, member, messageId);
  if (!found || !found.mine) return NO_MESSAGE;
  const { message, room, mine } = found;
  const verdict = canRemoveMessage(message, room, member, mine);
  if (!verdict.ok) return verdict.code === "read_only" ? READ_ONLY : refuse(403, "not_allowed", "You can only remove your own messages here.");
  if (room.archivedAt) return ARCHIVED;
  if (message.deletedAt) return { ok: true, unchanged: true };
  await client.companyChatMessage.update({
    where: { id: message.id },
    data: { deletedAt: now, deletedByMemberId: member.id, pinnedAt: null, pinnedByMemberId: null },
    select: { id: true },
  });
  if (message.authorMemberId !== member.id) {
    await logActivity(log, member, {
      action: "chat.message_removed",
      entityId: room.id,
      summary: `Removed somebody's message in ${room.kind === "channel" ? `#${room.name}` : "a conversation"}`,
      metadata: { messageId: message.id, authorMemberId: message.authorMemberId || null },
    });
  }
  return { ok: true };
}

/**
 * Pin or unpin a message (rules.js canPin). A system line says who did it,
 * so a pin is never anonymous; at most PINS_MAX at once per room.
 */
export async function pinMessage(member, messageId, { pin = true } = {}, { client = db } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const found = await messageInVisibleRoom(client, member, messageId);
  if (!found || !found.mine) return NO_MESSAGE;
  const { message, room, mine } = found;
  if (message.kind === "system" || message.deletedAt) return NO_MESSAGE;
  if (room.archivedAt) return ARCHIVED;
  if (!canPin(room, member, mine)) return refuse(403, "not_allowed", "Only the office and this conversation's managers pin messages here.");
  const want = pin !== false;
  if (want === Boolean(message.pinnedAt)) return { ok: true, unchanged: true };
  if (want) {
    const pinned = await client.companyChatMessage.count({ where: { roomId: room.id, companyId: member.companyId, pinnedAt: { not: null }, deletedAt: null } });
    if (pinned >= PINS_MAX) return refuse(400, "too_many_pins", `A conversation can have ${PINS_MAX} pinned messages. Unpin one first.`);
  }
  const by = await nameOf(client, member);
  await client.$transaction([
    client.companyChatMessage.update({
      where: { id: message.id },
      data: want ? { pinnedAt: new Date(), pinnedByMemberId: member.id } : { pinnedAt: null, pinnedByMemberId: null },
      select: { id: true },
    }),
    systemLine(client, member, room.id, { system: want ? "pinned" : "unpinned", messageId: message.id }, `${by} ${want ? "pinned" : "unpinned"} a message`),
  ]);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════════════
// Search (phase 4)
// ═══════════════════════════════════════════════════════════════════════════

/** A piece of the body around the first match, for the result row. */
function snippetAround(body, term, width = 120) {
  const text = String(body || "").replace(/\s+/g, " ").trim();
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0 || text.length <= width * 2) return text.slice(0, width * 2);
  const from = Math.max(0, at - width);
  return `${from > 0 ? "…" : ""}${text.slice(from, at + term.length + width)}${at + term.length + width < text.length ? "…" : ""}`;
}

/**
 * Search what was said — in one room, or across every room the member can
 * read. Server-side, and scoped by the SAME rule every read uses: the
 * member's company, then their OPEN memberships (a read-only support session
 * reads every room, as it does everywhere). A private channel's words are
 * never a result for somebody not in it; a removed message is never a
 * result for anybody; system lines are not searched. Newest SEARCH_TAKE.
 *
 * `null` is the route's 404 — a room named that the member cannot read.
 * ILIKE over the rows the scope leaves: a contractor's chat is thousands of
 * rows, not millions; a trigram index is for later, if ever.
 */
export async function searchMessages(member, { q = "", roomId = null } = {}, { client = db } = {}) {
  if (!member?.companyId) return null;
  const term = searchTerm(q);
  let scope;
  if (roomId) {
    const { room } = await visibleRoom(client, member, roomId);
    if (!room) return null;
    scope = { roomId: room.id };
  } else {
    scope = seesAllRooms(member) ? {} : { room: { members: { some: { memberId: member.id || "__none__", open: true } } } };
  }
  if (!term) return { q: null, results: [] };
  const rows = await client.companyChatMessage.findMany({
    where: { companyId: member.companyId, kind: "message", deletedAt: null, body: { contains: term, mode: "insensitive" }, ...scope },
    orderBy: { createdAt: "desc" },
    take: SEARCH_TAKE,
    select: {
      id: true,
      roomId: true,
      body: true,
      createdAt: true,
      authorMemberId: true,
      author: MEMBER_PERSON,
      room: { select: { id: true, kind: true, name: true } },
    },
  });
  return {
    q: term,
    results: rows.map((r) => ({
      id: r.id,
      roomId: r.roomId,
      roomKind: r.room?.kind || null,
      // A DM has no name of its own; the screen names it from its own list.
      roomName: r.room && r.room.kind !== "dm" ? r.room.name || null : null,
      body: snippetAround(r.body, term),
      at: r.createdAt,
      who: memberName(r.author ? { member: r.author } : null),
      mine: Boolean(member.id) && r.authorMemberId === member.id,
    })),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Files (phase 3)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Where one attachment's file is, for a reader who can read its room NOW —
 * or null (the route's 404): another company's message, a room the reader
 * left or was never in (a private channel above all), a removed message, an
 * index that is not there, or a row that does not name a private file in
 * this company's chat folder.
 */
export async function chatFileFor(member, messageId, index, { client = db, cloudName = process.env.CLOUDINARY_CLOUD_NAME } = {}) {
  const found = await messageInVisibleRoom(client, member, messageId);
  if (!found || found.message.deletedAt) return null;
  const i = Number(index);
  const list = Array.isArray(found.message.attachments) ? found.message.attachments : [];
  if (!Number.isInteger(i) || i < 0 || i >= list.length) return null;
  const a = list[i];
  const location = chatFileLocation(a, { companyId: member.companyId, cloudName });
  if (!location) return null;
  return { type: a.type === "document" ? "document" : "photo", location, filename: a.filename || null, mimeType: a.mimeType || null };
}

/**
 * The jobs this member may file a photo against, or share as a card — the
 * jobs they can see (jobs: view_only; the crew's own jobs only, through
 * assignedJobWhere), not archived, not finished. Ids and titles only.
 */
export async function jobsForChat(member, { q = "" } = {}, { client = db } = {}) {
  if (!member?.companyId) return [];
  const full = await enforceableFor(client, member);
  if (!full || !hasLevel(full, "jobs", "view_only")) return [];
  const needle = String(q || "").trim().slice(0, 80);
  const rows = await client.job.findMany({
    where: {
      companyId: member.companyId,
      archivedAt: null,
      status: { in: ["unscheduled", ...ACTIVE_JOB_STATUSES] },
      ...assignedJobWhere(full),
      ...(needle ? { title: { contains: needle, mode: "insensitive" } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, title: true, status: true },
  });
  return rows.map((j) => ({ id: j.id, title: j.title || null, status: j.status || null }));
}

/**
 * "Save to job photos": a chat photo becomes a JobPhoto on a job — the job
 * room's own job, or one the member picks. The SAME door as POST
 * /api/jobs/[id]/photos: jobs at view_only (so the crew can — filing photos
 * is their job), and the job must be one they can see (assignedJobWhere).
 * The photo is saved as an ordinary progress photo, NOT featured: putting
 * it on the website stays a curation decision (PATCH, view_create_edit).
 *
 * The chat file is private and stays private. A job photo is an ordinary
 * public asset (quotes and reports embed it), so the photo is COPIED into
 * the company's jobs folder — `copy` is injected (the route passes the
 * Cloudinary copier) — never re-typed in place, which would make the chat's
 * copy public too. The copy's id is derived from the message and the photo,
 * so saving it twice to the same job is one photo, not two.
 */
export async function saveToJob(member, messageId, { index = 0, jobId = null } = {}, { client = db, cloudName = process.env.CLOUDINARY_CLOUD_NAME, copy = null, log = recordActivity } = {}) {
  if (!canWrite(member)) return READ_ONLY;
  const found = await messageInVisibleRoom(client, member, messageId);
  if (!found || !found.mine || found.message.deletedAt) return NO_MESSAGE;
  const { message, room } = found;
  const i = Number(index);
  const list = Array.isArray(message.attachments) ? message.attachments : [];
  const a = Number.isInteger(i) && i >= 0 ? list[i] : null;
  if (!a || a.type === "document") return refuse(400, "not_photo", "Only photos can be saved to a job.");
  const location = chatFileLocation(a, { companyId: member.companyId, cloudName });
  if (!location) return refuse(409, "file_unreadable", "This photo isn't stored where FieldQuo can copy it.");
  const target = typeof jobId === "string" && jobId.trim() ? jobId.trim() : room.kind === "job" ? room.jobId : null;
  if (!target) return refuse(400, "no_job", "Pick the job to save it to.");
  const full = await enforceableFor(client, member);
  if (!full || !hasLevel(full, "jobs", "view_only")) return refuse(403, "not_allowed", "Your access level doesn't let you add job photos.");
  const job = await client.job.findFirst({
    where: { id: target, companyId: member.companyId, ...assignedJobWhere(full) },
    select: { id: true, title: true },
  });
  if (!job) return refuse(404, "no_job", "That job isn't one you can add photos to.");

  const marker = `chat-${message.id}-${i}`;
  const existing = await client.jobPhoto.findFirst({
    where: { companyId: member.companyId, jobId: job.id, url: { contains: `/${marker}` } },
    select: { id: true },
  });
  if (existing) return { ok: true, already: true, jobId: job.id, photoId: existing.id };
  if (typeof copy !== "function") return refuse(503, "unavailable", "Photos can't be copied right now — file storage isn't configured.");
  let url = null;
  try {
    url = await copy(location, { publicId: `fieldquo/companies/${member.companyId}/jobs/${marker}` });
  } catch (err) {
    console.error("[company chat] save to job copy failed:", err?.message);
  }
  if (typeof url !== "string" || !/^https:\/\//.test(url)) {
    return refuse(502, "copy_failed", "The photo couldn't be copied to the job just now. Try again.");
  }
  const photo = await client.jobPhoto.create({
    data: { companyId: member.companyId, jobId: job.id, url, stage: "progress" },
    select: { id: true },
  });
  try {
    await log(member, {
      action: "job.photosAdded",
      entityType: "job",
      entityId: job.id,
      summary: "Added 1 photo to a job from team chat",
    });
  } catch {
    /* the activity log never fails the write it describes */
  }
  return { ok: true, jobId: job.id, photoId: photo.id };
}

/** Re-exported so a route imports one module. */
export { memberKey, canWrite, seesAllRooms };
