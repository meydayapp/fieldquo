// lib/company/chat/rules.js
//
// The rules of a company's crew chat, pure, so scripts/check-company-chat.mjs
// can drive every one of them without Postgres.
//
// ══ Three kinds of room, and who is in each ═══════════════════════════════
//
//   general  everybody on the roster. One per company, nobody leaves it, and
//            a new hire is in it the first time ANYONE opens the chat after
//            they were added — the same rule lib/staff/teams.js reached after
//            a "Sales" room with nobody in it turned up at a demo.
//   job      one per ACTIVE job, named after it. Its members are DERIVED, not
//            chosen: the crew booked on the job's visits (JobVisit.assignedToId
//            — the same fact lib/permissions/enforce.js's assignedJobWhere
//            reads for "the jobs assigned to me", so the room and the job
//            list cannot disagree about who is on a job) plus the office —
//            owner, admin, supervisor — who run every job. Taking somebody off
//            the visits takes them out of the room; putting them back puts
//            them back in. Nobody adds or removes anybody by hand, because a
//            hand-kept list drifts from the schedule the first week.
//   dm       two members. Named for whoever the viewer is not.
//
// ══ Why "active" is scheduled or in progress ══════════════════════════════
//
// An unscheduled job has no visits and therefore no crew: its room would hold
// the office talking to itself about work nobody has been given. A completed
// or cancelled job's room is not made either — but one that already exists is
// KEPT, with its history, and listed under "Finished jobs" so "what did we
// agree about the Nguyen kitchen" is still answerable in March.
//
// ══ Unread is counted, never stored ═══════════════════════════════════════
//
// The same reasoning as lib/staff/rooms.js: a stored counter is a second
// source of truth that drifts the first time two tabs mark a room read at
// once. Counting rows after `lastSeenAt` cannot drift, and at a contractor's
// headcount it is arithmetic over rows already loaded for the preview.
//
// Pure. No imports from anything that touches a database.

/** The three kinds, named once so nothing else spells them. */
export const CHAT_ROOM_KINDS = Object.freeze(["general", "job", "dm"]);

/** The key of the one everybody-room. */
export const GENERAL_KEY = "general";

/** The roles that are in every job room whether or not they are booked on it. */
export const OFFICE_ROLES = Object.freeze(["owner", "admin", "supervisor"]);

/** Job statuses whose room is made and kept in sync. */
export const ACTIVE_JOB_STATUSES = Object.freeze(["scheduled", "in_progress"]);

/** The key a job's room is stored under. */
export function jobRoomKey(jobId) {
  return jobId ? `job:${jobId}` : null;
}

/**
 * The key a direct pair is stored under: sorted, so opening it from either
 * side produces the SAME string and the unique index refuses the second room.
 * Null for a pair with itself — a note-to-self is a different feature and
 * must not be made by accident — and for a malformed pair.
 */
export function directRoomKey(a, b) {
  const one = String(a || "");
  const two = String(b || "");
  if (!one || !two || one === two) return null;
  return `dm:${[one, two].sort().join("|")}`;
}

/** The two member ids a direct key names, or null. */
export function parseDirectKey(key) {
  const m = /^dm:([^|]+)\|([^|]+)$/.exec(String(key || ""));
  return m ? [m[1], m[2]] : null;
}

/** The key a mention is stored as, and its inverse. */
export function memberKey(memberId) {
  return memberId ? `member:${memberId}` : null;
}
export function parseMemberKey(key) {
  const m = /^member:(.+)$/.exec(String(key || ""));
  return m ? m[1] : null;
}

/** Is a job one whose room should exist and track its crew? */
export function isActiveJob(job) {
  if (!job) return false;
  if (job.archivedAt) return false;
  return ACTIVE_JOB_STATUSES.includes(job.status);
}

/** Does this role run every job — and so sit in every job room? */
export function isOfficeRole(role) {
  return OFFICE_ROLES.includes(role);
}

/**
 * Who belongs in a job's room right now: the office, and every active member
 * whose User is booked on one of the job's visits.
 *
 * @param job      { visits: [{ assignedToId }] }
 * @param members  the company's ACTIVE members — [{ id, userId, role }]
 * @returns the member ids, each once, in roster order
 */
export function jobRoomMemberIds(job, members = []) {
  const booked = new Set(
    (Array.isArray(job?.visits) ? job.visits : []).map((v) => v?.assignedToId).filter(Boolean),
  );
  const out = [];
  for (const m of Array.isArray(members) ? members : []) {
    if (!m?.id) continue;
    if (isOfficeRole(m.role) || booked.has(m.userId)) out.push(m.id);
  }
  return [...new Set(out)];
}

/**
 * The membership rows a sync should write for one room, given who is in it
 * now and who holds a row already.
 *
 * Three outcomes, and the third is the one that matters: a row for somebody
 * who no longer belongs is CLOSED, never deleted — their words stay
 * attributed and the row reopens if they come back. For #general nobody is
 * ever closed by this (the roster query already excludes inactive members
 * from `wanted`; a deactivated member's row is closed like anybody else's,
 * because a person who cannot sign in is not in the room).
 *
 * @param wanted    member ids that belong now
 * @param existing  [{ memberId, open }] rows the room already has
 * @returns { create: [memberId], reopen: [memberId], close: [memberId] }
 */
export function membershipDelta(wanted = [], existing = []) {
  const want = new Set(wanted);
  const have = new Map((existing || []).map((r) => [r.memberId, Boolean(r.open)]));
  const create = [];
  const reopen = [];
  const close = [];
  for (const id of want) {
    if (!have.has(id)) create.push(id);
    else if (!have.get(id)) reopen.push(id);
  }
  for (const [id, open] of have) {
    if (open && !want.has(id)) close.push(id);
  }
  return { create, reopen, close };
}

/**
 * How many messages in this room the viewer has not seen. Their own never
 * count; system lines never count; never seen at all means everything from
 * other people is unread, which is right for somebody just added.
 */
export function unreadFor({ messages = [], lastSeenAt = null, memberId = null } = {}) {
  const since = lastSeenAt ? new Date(lastSeenAt).getTime() : null;
  return (Array.isArray(messages) ? messages : []).filter((m) => {
    if (!m || m.kind === "system") return false;
    if (memberId && m.authorMemberId === memberId) return false;
    const at = m.createdAt ? new Date(m.createdAt).getTime() : null;
    if (at === null || Number.isNaN(at)) return false;
    if (since === null || Number.isNaN(since)) return true;
    return at > since;
  }).length;
}

/** How many of those unread messages say the viewer's name. */
export function mentionsFor({ messages = [], lastSeenAt = null, memberId = null } = {}) {
  const key = memberKey(memberId);
  if (!key) return 0;
  const since = lastSeenAt ? new Date(lastSeenAt).getTime() : null;
  return (Array.isArray(messages) ? messages : []).filter((m) => {
    if (!m || m.kind === "system") return false;
    if (!Array.isArray(m.mentions) || !m.mentions.includes(key)) return false;
    if (m.authorMemberId === memberId) return false;
    const at = m.createdAt ? new Date(m.createdAt).getTime() : null;
    if (at === null || Number.isNaN(at)) return false;
    if (since === null || Number.isNaN(since)) return true;
    return at > since;
  }).length;
}

/**
 * A display name for a membership or author row that carries `member.user`.
 * Never invents one: a row whose person could not be loaded reads as null
 * and the screen says "Someone who left" in the reader's language, rather
 * than an id or an empty gap.
 */
export function memberName(row) {
  const user = row?.member?.user || row?.user || null;
  return user?.name || user?.email || null;
}

/**
 * What to call a room from this viewer's side. A direct room is named for
 * the OTHER member; when that member cannot be resolved it says so rather
 * than falling back to the viewer's own name.
 *
 * Returns { name, missing } — `missing` is true when the name had to be
 * invented, so the screen can translate the placeholder.
 */
export function roomTitle(room, memberId) {
  if (!room) return { name: "", missing: true };
  if (room.kind !== "dm") return { name: room.name || "", missing: !room.name };
  const others = (room.members || []).filter((m) => m.memberId !== memberId);
  if (!others.length) return { name: "", missing: true };
  const name = memberName(others[0]);
  return name ? { name, missing: false } : { name: "", missing: true };
}

/**
 * One row of the conversation list, in the shape the screen draws.
 *
 * `active` is only meaningful for a job room: false means the job is done
 * and the room is history. `other` is the other member's id for a DM.
 */
export function roomListRow(room, memberId) {
  const messages = Array.isArray(room?.messages) ? room.messages : [];
  const spoken = messages.filter((m) => m && m.kind !== "system");
  const last = spoken.length ? spoken[spoken.length - 1] : null;
  const members = (room?.members || []).filter((m) => m && m.open !== false);
  const mine = members.find((m) => m.memberId === memberId) || null;
  const lastSeenAt = mine?.lastSeenAt || null;
  const title = roomTitle(room, memberId);
  const other = room?.kind === "dm" ? members.find((m) => m.memberId !== memberId) || null : null;
  return {
    id: room.id,
    kind: room.kind,
    jobId: room.jobId || null,
    active: room.kind === "job" ? isActiveJob(room.job) : true,
    title: title.name,
    titleMissing: title.missing,
    other: other ? other.memberId : null,
    memberCount: members.length,
    lastBody: last?.body || null,
    lastAt: last?.createdAt || room?.lastMessageAt || null,
    lastWasMine: Boolean(last && last.authorMemberId === memberId),
    lastWho: last ? memberName(last.author ? { member: last.author } : null) : null,
    unread: unreadFor({ messages, lastSeenAt, memberId }),
    mentions: mentionsFor({ messages, lastSeenAt, memberId }),
  };
}

/**
 * The whole list: unread first, then by recency. Unread first because the
 * list exists to answer "who is waiting on me".
 */
export function roomList(rooms = [], memberId = null) {
  return (Array.isArray(rooms) ? rooms : [])
    .map((r) => roomListRow(r, memberId))
    .sort((a, b) => {
      if (Boolean(a.unread) !== Boolean(b.unread)) return a.unread ? -1 : 1;
      const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return bt - at;
    });
}

/**
 * Which list group a row belongs to. `finished` is a job room whose job is
 * done — history, folded by default.
 */
export function groupOf(row, { unreadOnTop = false } = {}) {
  if (!row) return null;
  if (unreadOnTop && (row.unread > 0 || row.mentions > 0)) return "unread";
  if (row.kind === "dm") return "direct";
  if (row.kind === "job") return row.active ? "job" : "finished";
  return "general";
}

/** The group order, so every screen draws them the same way round. */
export const GROUP_ORDER = Object.freeze(["unread", "general", "job", "direct", "finished"]);

/**
 * The messages, in the shape the kit's Thread reads: `direction` "out" for
 * the viewer's own, `who` for the sender line, `mentionsMe` for the tint.
 */
export function threadMessages(messages = [], memberId = null) {
  const me = memberKey(memberId);
  return (Array.isArray(messages) ? messages : []).map((m) => ({
    id: m.id,
    body: m.body,
    at: m.createdAt,
    kind: m.kind === "system" ? "system" : undefined,
    direction: m.authorMemberId && m.authorMemberId === memberId ? "out" : "in",
    who: memberName(m.author ? { member: m.author } : null),
    whoKey: memberKey(m.authorMemberId),
    mentionsMe: Boolean(me) && Array.isArray(m.mentions) && m.mentions.includes(me),
    meta: m.kind === "system" && m.meta && typeof m.meta === "object" ? m.meta : null,
  }));
}

/**
 * May this member WRITE to the chat at all?
 *
 * A read-only support session (non-negotiable #2) can see every room in the
 * company and say nothing in any of them. Decided here as well as in
 * lib/currentMember.js's method gate — deliberately twice, the way the
 * impersonation gate itself is enforced twice — so a store call reached from
 * anywhere but a route (a cron, a script) refuses the same way. A demo
 * sandbox is a real member of a FieldQuo-owned fixture and may post.
 */
export function canWrite(member) {
  if (!member?.id || !member?.companyId) return false;
  if (member.impersonation && member.impersonationMode !== "demo_sandbox") return false;
  return true;
}

/** Does this member see every room in the company rather than their own? */
export function seesAllRooms(member) {
  return Boolean(member?.impersonation) && member.impersonationMode !== "demo_sandbox";
}
