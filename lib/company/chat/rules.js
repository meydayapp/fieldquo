// lib/company/chat/rules.js
//
// The rules of a company's crew chat, pure, so scripts/check-company-chat.mjs
// can drive every one of them without Postgres.
//
// ══ Five kinds of room, and who is in each ════════════════════════════════
//
//   general  everybody on the roster. One per company, nobody leaves it, and
//            a new hire is in it the first time ANYONE opens the chat after
//            they were added — the same rule lib/staff/teams.js reached after
//            a "Sales" room with nobody in it turned up at a demo.
//   job      one per ACTIVE job, named after it. Its members are DERIVED, not
//            chosen: the crew booked on the job's visits (JobVisit.assignedToId)
//            or on a published shift on it inside its window — the same two
//            facts lib/permissions/enforce.js's assignedJobWhere reads for
//            "the jobs assigned to me", so the room and the job list cannot
//            disagree about who is on a job — plus the office —
//            owner, admin, supervisor — who run every job. Taking somebody off
//            the visits takes them out of the room; putting them back puts
//            them back in. Nobody adds or removes anybody by hand, because a
//            hand-kept list drifts from the schedule the first week.
//   dm       two members. Named for whoever the viewer is not.
//   channel  a PLACE (#estimating, #crew-north, #announcements): a name, a
//            topic, a manager, and it outlives the people in it. Made by the
//            office only (owner, admin, supervisor — the Manager and
//            Dispatcher presets are supervisors). Public — anybody can find
//            and join it — or private — invisible to everybody not in it.
//   group    a CONVERSATION (three people sorting out tomorrow's van). Made
//            by anybody, crew included, from New message by picking two or
//            more people; no maximum size, because a big company's "whole
//            north crew" group is a real thing. Named, or named per viewer
//            for the people in it.
//
// The owner reversed the old rule on 2026-10-04: "nobody makes a group" was
// right for #general and job rooms, which stay DERIVED from the roster and
// the schedule, and wrong for everything else. Channels and groups are
// hand-made, hand-kept, and every membership change is a system line in the
// room and an activity-log row, so "who added Sam" stays answerable.
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

/** The five kinds, named once so nothing else spells them. */
export const CHAT_ROOM_KINDS = Object.freeze(["general", "job", "dm", "channel", "group"]);

/** The kinds a person makes by hand. The rest are derived or fixed. */
export const MADE_KINDS = Object.freeze(["channel", "group"]);

/** The key of the one everybody-room. */
export const GENERAL_KEY = "general";

/** The roles that are in every job room whether or not they are booked on it. */
export const OFFICE_ROLES = Object.freeze(["owner", "admin", "supervisor"]);

/** Job statuses whose room is made and kept in sync. */
export const ACTIVE_JOB_STATUSES = Object.freeze(["scheduled", "in_progress"]);

/**
 * Channel slugs the company keeps for itself. "general" is the everybody
 * room's name, and a second "#general" beside it would be a trap. Job rooms
 * need nothing reserved: their keys are "job:<id>", never "channel:…".
 */
export const RESERVED_CHANNEL_SLUGS = Object.freeze(["general"]);

/**
 * The key a channel is stored under. Its slug, namespaced, so the existing
 * unique (companyId, key) refuses a second #estimating — no new unique index
 * (memory: Prisma refuses one on a live table) — and a channel can never
 * collide with "general" or a job's key.
 */
export function channelRoomKey(slug) {
  const s = String(slug || "").trim();
  return s ? `channel:${s}` : null;
}

/**
 * The key a group is stored under: random, because a group is not unique by
 * who is in it — Ana, Bob and Cat may well have two (the van, and the
 * Nguyen punch list).
 */
export function groupRoomKey(random) {
  const s = String(random || "").trim();
  return s ? `group:${s}` : null;
}

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
 * whose User is booked on one of the job's visits or on one of its published
 * shifts. The caller loads only the shifts that currently grant the job
 * (shiftWindowWhere) — this function does not know what time it is.
 *
 * @param job      { visits: [{ assignedToId }], shifts?: [{ worker: { userId } }] }
 * @param members  the company's ACTIVE members — [{ id, userId, role }]
 * @returns the member ids, each once, in roster order
 */
export function jobRoomMemberIds(job, members = []) {
  const booked = new Set(
    [
      ...(Array.isArray(job?.visits) ? job.visits : []).map((v) => v?.assignedToId),
      ...(Array.isArray(job?.shifts) ? job.shifts : []).map((s) => s?.worker?.userId),
    ].filter(Boolean),
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
    if (!m || m.kind === "system" || m.deletedAt) return false;
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
    if (!m || m.kind === "system" || m.deletedAt) return false;
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

/** How many names a group with no name of its own is called by. */
export const GROUP_TITLE_NAMES = 3;

/**
 * What to call a room from this viewer's side. A direct room is named for
 * the OTHER member; when that member cannot be resolved it says so rather
 * than falling back to the viewer's own name. A group with no name of its
 * own is "Ana Ruiz, Bob Lee, Cat Moss" — the first few OTHER people — and
 * `extra` says how many more there are, so the screen adds "+4" in the
 * reader's language rather than this module writing English.
 *
 * Returns { name, missing, extra } — `missing` is true when the name had to
 * be invented, so the screen can translate the placeholder.
 */
export function roomTitle(room, memberId) {
  if (!room) return { name: "", missing: true, extra: 0 };
  if (room.kind === "group") {
    if (room.name) return { name: room.name, missing: false, extra: 0 };
    const open = (room.members || []).filter((m) => m && m.open !== false);
    const others = open.filter((m) => m.memberId !== memberId);
    const names = others.map((m) => memberName(m)).filter(Boolean).slice(0, GROUP_TITLE_NAMES);
    if (!names.length) return { name: "", missing: true, extra: 0 };
    // The list query carries the first few members only (store.js: a group
    // has no maximum size), so the total comes from the count it attached.
    const isIn = open.some((m) => m.memberId === memberId) || Boolean(room.mine && room.mine.open !== false);
    const othersTotal = Number.isFinite(room.memberCount) ? room.memberCount - (isIn ? 1 : 0) : others.length;
    return { name: names.join(", "), missing: false, extra: Math.max(0, othersTotal - names.length) };
  }
  if (room.kind !== "dm") return { name: room.name || "", missing: !room.name, extra: 0 };
  const others = (room.members || []).filter((m) => m.memberId !== memberId);
  if (!others.length) return { name: "", missing: true, extra: 0 };
  const name = memberName(others[0]);
  return name ? { name, missing: false, extra: 0 } : { name: "", missing: true, extra: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// Notifications: who is told, and what the tab's digit counts
// ═══════════════════════════════════════════════════════════════════════════
//
// CompanyChatMember.notify is "default" | "all" | "mentions" | "none", and
// mutedUntil snoozes. The table (plan §4, owner decisions 2026-10-04):
//
//   room            default
//   dm, group       every message   — every line in it is FOR the reader
//   general,        mentions only   — a channel is a place; pushing every
//   channel, job                      line of #general to forty phones is the
//                                     notification people switch off in a week
//
//   "none"          silences everything, mentions included, and takes the
//                   room out of the Chat tab's digit entirely
//   snoozed         behaves like "mentions": a mention still gets through,
//                   and only mentions count toward the tab's digit
//   looking         nothing is pushed to somebody with the room on screen
//                   (lastOpenedAt younger than LOOKING_MS — the staff chat's
//                   lib/staff/directPush.js rule, ported)
//   the author      is never told about their own message
//
// The unread count itself still grows in a muted room — it is drawn grey —
// because "muted" is a statement about interruptions, not about whether the
// words exist.

/** The four settings a membership may hold. */
export const NOTIFY_LEVELS = Object.freeze(["default", "all", "mentions", "none"]);

/** A reader seen more recently than this is looking at the room. Two polls
 *  of the open room (4 s each) and a margin; a tab that goes to the
 *  background stops polling and is pushed to again within half a minute. */
export const LOOKING_MS = 30 * 1000;

/** The longest a snooze may run. "Until I turn it back on" is "none". */
export const MAX_SNOOZE_MS = 366 * 24 * 60 * 60 * 1000;

/** What "default" means for a kind of room. */
export function defaultNotifyFor(kind) {
  return kind === "dm" || kind === "group" ? "all" : "mentions";
}

const timeOf = (v) => {
  if (!v) return NaN;
  const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return t;
};

/** Is the membership snoozed at `now`? */
export function isSnoozed(membership, now = new Date()) {
  const until = timeOf(membership?.mutedUntil);
  return !Number.isNaN(until) && until > timeOf(now);
}

/** Muted — set to "none", or snoozed. Drawn grey, left out of the digit. */
export function isMuted(membership, now = new Date()) {
  return membership?.notify === "none" || isSnoozed(membership, now);
}

/**
 * The level that actually applies: "all" | "mentions" | "none". A snooze
 * caps it at "mentions" (never raises "none").
 */
export function effectiveNotify(kind, membership, now = new Date()) {
  const set = NOTIFY_LEVELS.includes(membership?.notify) ? membership.notify : "default";
  if (set === "none") return "none";
  const level = set === "default" ? defaultNotifyFor(kind) : set;
  if (isSnoozed(membership, now)) return "mentions";
  return level;
}

/** Is this reader looking at the room right now? */
export function isLooking(membership, now = new Date(), lookingMs = LOOKING_MS) {
  const opened = timeOf(membership?.lastOpenedAt);
  if (Number.isNaN(opened)) return false;
  return timeOf(now) - opened < lookingMs;
}

/**
 * What ONE member is told about ONE new message.
 *
 * @returns { push: "message" | "mention" | null, bell: boolean }
 *   push "message"  — "New message from Ana" (a DM, or a room they hear
 *                     every message of)
 *   push "mention"  — "Ana mentioned you in #estimating"
 *   bell            — a row in the notification bell (chat.mention). A
 *                     mention is a thing somebody asked of THEM, and the
 *                     bell is where those are kept; a plain message is not.
 *                     Never for a DM: a DM is already addressed to them and
 *                     pushes on its own, and "Ana mentioned you in a
 *                     conversation with Ana" is noise.
 */
export function notifyVerdict({ kind, membership, mentioned = false, isAuthor = false, now = new Date(), lookingMs = LOOKING_MS } = {}) {
  const none = { push: null, bell: false };
  if (isAuthor || !membership || membership.open === false) return none;
  const level = effectiveNotify(kind, membership, now);
  if (level === "none") return none;
  if (isLooking(membership, now, lookingMs)) return none;
  if (kind === "dm") return { push: "message", bell: false };
  if (mentioned) return { push: "mention", bell: true };
  if (level === "all") return { push: "message", bell: false };
  return none;
}

/**
 * What a listed room adds to the Chat tab's digit. A room set to "none"
 * adds nothing; a snoozed room adds its mentions only; anything else adds
 * its unread, mentions inside it.
 */
export function badgeCounts(row) {
  const zero = { unread: 0, mentions: 0 };
  if (!row) return zero;
  const unread = Math.max(0, Number(row.unread) || 0);
  const mentions = Math.max(0, Number(row.mentions) || 0);
  if (row.notifyLevel === "none") return zero;
  if (row.muted) return { unread: mentions, mentions };
  return { unread, mentions };
}

/**
 * A snooze end the browser sent, checked: a Date in the future and within
 * MAX_SNOOZE_MS, or null to clear. `{ ok: false }` for anything else, so a
 * snooze to 1970 (which would read as "not snoozed" and look like the button
 * did nothing) or to the year 3000 is refused rather than stored.
 */
export function parseSnooze(value, now = new Date()) {
  if (value === null || value === undefined || value === "") return { ok: true, until: null };
  const t = timeOf(value);
  if (Number.isNaN(t)) return { ok: false };
  const n = timeOf(now);
  if (t <= n || t - n > MAX_SNOOZE_MS) return { ok: false };
  return { ok: true, until: new Date(t) };
}

/**
 * A DM or group the viewer hid, and nobody has said anything in since. The
 * next message un-hides it by construction — nothing is written to bring it
 * back, so nothing can be missed.
 */
export function isHidden(room, membership) {
  if (!membership?.hiddenAt) return false;
  if (room?.kind !== "dm" && room?.kind !== "group") return false;
  const hid = timeOf(membership.hiddenAt);
  if (Number.isNaN(hid)) return false;
  const last = timeOf(room.lastMessageAt);
  return !(last > hid);
}

// ═══════════════════════════════════════════════════════════════════════════
// The list
// ═══════════════════════════════════════════════════════════════════════════

/** "everyone" | "office" — who may post in a channel. */
export const POSTING_POLICIES = Object.freeze(["everyone", "office"]);

/** A membership's role in its room. The maker of a channel or group is its manager. */
export const ROOM_ROLES = Object.freeze(["member", "manager"]);

/**
 * One row of the conversation list, in the shape the screen draws.
 *
 * `active` is only meaningful for a job room: false means the job is done
 * and the room is history. `other` is the other member's id for a DM.
 *
 * The viewer's own membership is `room.mine` when the store attached it (it
 * does for every listed room: a group has no maximum size, so the list
 * query cannot carry every member to find the viewer among them), else it
 * is looked for in `room.members`, for a caller that handed in a whole room.
 */
export function roomListRow(room, memberId, { now = new Date() } = {}) {
  const messages = Array.isArray(room?.messages) ? room.messages : [];
  const spoken = messages.filter((m) => m && m.kind !== "system");
  const last = spoken.length ? spoken[spoken.length - 1] : null;
  const members = (room?.members || []).filter((m) => m && m.open !== false);
  const mine = room?.mine !== undefined ? room.mine : members.find((m) => m.memberId === memberId) || null;
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
    titleExtra: title.extra || 0,
    other: other ? other.memberId : null,
    memberCount: Number.isFinite(room?.memberCount) ? room.memberCount : members.length,
    // A removed message is never the preview (store.js leaves it out of the
    // preview query); checked here too for a caller that hands in a thread.
    lastBody: last && !last.deletedAt ? last.body || null : null,
    // A message with no words still previews as what it carried — counts
    // and a flag, never a file name or a card's id.
    lastFiles: last && !last.deletedAt && Array.isArray(last.attachments) ? last.attachments.length : 0,
    lastCard: Boolean(last && !last.deletedAt && last.card),
    lastAt: last?.createdAt || room?.lastMessageAt || null,
    lastWasMine: Boolean(last && last.authorMemberId === memberId),
    lastWho: last ? memberName(last.author ? { member: last.author } : null) : null,
    // The store's grouped counts when it attached them (store.js roomsFor —
    // the messages on a listed room are ONE preview row, and a count over
    // that would be wrong); otherwise the rule over the rows given, for a
    // caller that handed in the whole thread.
    unread: Number.isFinite(room?.unread) ? room.unread : unreadFor({ messages, lastSeenAt, memberId }),
    mentions: Number.isFinite(room?.mentions) ? room.mentions : mentionsFor({ messages, lastSeenAt, memberId }),
    // Channels: what the header and the row need for a lock, a topic, a
    // megaphone, and "Archived".
    topic: room?.topic || null,
    private: Boolean(room?.private),
    postingPolicy: POSTING_POLICIES.includes(room?.postingPolicy) ? room.postingPolicy : "everyone",
    autoJoin: Boolean(room?.autoJoin),
    archived: Boolean(room?.archivedAt),
    // The viewer's own settings for this room.
    role: mine ? (mine.role === "manager" ? "manager" : "member") : null,
    notify: NOTIFY_LEVELS.includes(mine?.notify) ? mine.notify : "default",
    notifyLevel: effectiveNotify(room?.kind, mine, now),
    mutedUntil: isSnoozed(mine, now) ? new Date(mine.mutedUntil).toISOString() : null,
    muted: isMuted(mine, now),
    starred: Boolean(mine?.starredAt),
    hidden: isHidden(room, mine),
  };
}

/** Does this row interrupt — unread and not muted, or a mention that is heard? */
function isLoud(row) {
  return (row.unread > 0 && !row.muted) || (row.mentions > 0 && row.notifyLevel !== "none");
}

/**
 * The whole list: unread first, then by recency. Unread first because the
 * list exists to answer "who is waiting on me" — except a MUTED room, whose
 * unread does not jump the queue (a mention in it still does). A DM or group
 * the viewer hid is left out until somebody says something in it.
 */
export function roomList(rooms = [], memberId = null, { now = new Date() } = {}) {
  return (Array.isArray(rooms) ? rooms : [])
    .map((r) => roomListRow(r, memberId, { now }))
    .filter((r) => !r.hidden)
    .sort((a, b) => {
      if (isLoud(a) !== isLoud(b)) return isLoud(a) ? -1 : 1;
      const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return bt - at;
    });
}

/**
 * Which list group a row belongs to. `finished` is a job room whose job is
 * done — history, folded by default; `archived` is a channel somebody
 * archived — read-only history, folded too. #general sits with the
 * channels: it is one, the one nobody made.
 */
export function groupOf(row, { unreadOnTop = false } = {}) {
  if (!row) return null;
  if (unreadOnTop && !row.archived && isLoud(row)) return "unread";
  if (row.archived) return "archived";
  if (row.starred) return "starred";
  if (row.kind === "dm" || row.kind === "group") return "direct";
  if (row.kind === "job") return row.active ? "job" : "finished";
  return "channel";
}

/**
 * The group order, so every screen draws them the same way round. The
 * office reads Channels before Jobs; the crew read their jobs first — the
 * room for today's work is what they opened the app for.
 */
export const GROUP_ORDER = Object.freeze(["unread", "starred", "channel", "job", "direct", "finished", "archived"]);
export const CREW_GROUP_ORDER = Object.freeze(["unread", "starred", "job", "channel", "direct", "finished", "archived"]);
export function groupOrderFor(role) {
  return isOfficeRole(role) ? GROUP_ORDER : CREW_GROUP_ORDER;
}

/** The groups folded until the reader opens them. */
export const FOLDED_GROUPS = Object.freeze(["finished", "archived"]);

/**
 * The messages, in the shape the kit's Thread reads: `direction` "out" for
 * the viewer's own, `who` for the sender line, `mentionsMe` for the tint.
 *
 * ══ A removed message says nothing, to anybody ════════════════════════════
 *
 * Owner decision 2026-10-04: a removed message is hidden from EVERY reader,
 * the owner and a support session included. The row and its body stay in the
 * database (never delete data), and this is the one function every thread
 * payload is built through, so it is the one place the body is dropped: a
 * removed row leaves here as `{ deleted: true, body: "" }` with no
 * attachments, no card, no mentions and no reply quote — nothing a reader
 * could reassemble the words from. A reply that QUOTES a removed message
 * gets the same treatment for the quote.
 *
 * Attachments leave here as display facts only (kind, name, size, pixel
 * size) — never the stored URL or public id. The store adds a short-lived
 * link per reader (lib/company/chat/fileLinks.js); the URL in the row is
 * Cloudinary's private one and is never sent to a browser.
 */
export function threadMessages(messages = [], memberId = null) {
  const me = memberKey(memberId);
  return (Array.isArray(messages) ? messages : []).map((m) => {
    const system = m.kind === "system";
    const deleted = Boolean(m.deletedAt);
    const base = {
      id: m.id,
      at: m.createdAt,
      kind: system ? "system" : undefined,
      direction: m.authorMemberId && m.authorMemberId === memberId ? "out" : "in",
      who: memberName(m.author ? { member: m.author } : null),
      whoKey: memberKey(m.authorMemberId),
    };
    if (deleted) {
      return { ...base, body: "", deleted: true, mentionsMe: false, meta: null, edited: false, pinned: false, replyTo: null, attachments: [], card: null };
    }
    return {
      ...base,
      body: m.body,
      deleted: false,
      mentionsMe: Boolean(me) && Array.isArray(m.mentions) && m.mentions.includes(me),
      meta: system && m.meta && typeof m.meta === "object" ? m.meta : null,
      edited: Boolean(m.editedAt),
      pinned: Boolean(m.pinnedAt),
      replyTo: replyQuote(m.replyTo),
      attachments: displayAttachments(m.attachments),
      // The stored card is ids only; the store resolves it per reader. What
      // leaves here is just its type, so nothing unresolved reaches a screen.
      card: null,
    };
  });
}

/** How much of a quoted message the reply strip carries. */
export const REPLY_SNIPPET = 140;

/** The small grey strip above a reply: who said it and what, or that it was removed. */
export function replyQuote(original) {
  if (!original || !original.id) return null;
  const who = memberName(original.author ? { member: original.author } : null);
  if (original.deletedAt) return { id: original.id, who, body: "", deleted: true, attachments: 0 };
  const body = String(original.body || "").replace(/\s+/g, " ").trim().slice(0, REPLY_SNIPPET);
  return { id: original.id, who, body, deleted: false, attachments: Array.isArray(original.attachments) ? original.attachments.length : 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// Photos and files (phase 3)
// ═══════════════════════════════════════════════════════════════════════════
//
// Owner decision 2026-10-04: chat photos and files are PRIVATE, like an HR
// document — stored under Cloudinary's "authenticated" delivery type, whose
// plain URL Cloudinary refuses, and opened only through
// /api/chat/files/<message>/<n>, which re-checks the reader's membership on
// every open and hands out a link that expires. A photo of an injury in a DM
// is the case that decided it.

/** How many files one message may carry. */
export const CHAT_ATTACHMENTS_MAX = 10;

/** A document's ceiling in chat. The messaging scope's 100 MB is Meta's
 *  number for WhatsApp; a crew chat has no reason to store a file that big,
 *  and the Free plan's own raw-file ceiling (10 MB) binds before it anyway. */
export const CHAT_DOCUMENT_MAX_BYTES = 25 * 1024 * 1024;

/** What the composer's pickers offer: photos, PDFs and the common office
 *  documents (lib/media/validate.js MESSAGING_DOCUMENT_TYPES). No video —
 *  not asked for, and the largest storage line by far. */
export const CHAT_PHOTO_ACCEPT = "image/*";
export const CHAT_FILE_ACCEPT =
  "image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";

/** Is this picked file one chat takes, before a byte is uploaded? */
export function chatFileVerdict(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  if (type.startsWith("video/") || /\.(mp4|mov|webm|m4v|avi|3gp)$/.test(name)) return { ok: false, code: "no_video" };
  const size = Number(file?.size);
  const isPhoto = type.startsWith("image/") || /\.(heic|heif)$/.test(name);
  if (!isPhoto && Number.isFinite(size) && size > CHAT_DOCUMENT_MAX_BYTES) return { ok: false, code: "too_large" };
  return { ok: true, kind: isPhoto ? "photo" : "document" };
}

/**
 * A stored attachment list, as the screen may see it: kind, file name, size
 * and pixel size. Never `url` or `publicId` — those are what a link is made
 * FROM, server-side, per reader.
 */
export function displayAttachments(stored) {
  if (!Array.isArray(stored)) return [];
  return stored.slice(0, CHAT_ATTACHMENTS_MAX).map((a, index) => ({
    index,
    type: a?.type === "document" ? "document" : "photo",
    name: typeof a?.filename === "string" ? a.filename.slice(0, 200) : "",
    bytes: Number.isFinite(Number(a?.bytes)) && Number(a.bytes) > 0 ? Number(a.bytes) : null,
    mimeType: typeof a?.mimeType === "string" ? a.mimeType.slice(0, 100) : null,
    width: Number.isFinite(Number(a?.width)) && Number(a.width) > 0 ? Math.round(Number(a.width)) : null,
    height: Number.isFinite(Number(a?.height)) && Number(a.height) > 0 ? Math.round(Number(a.height)) : null,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Cards: a shared job, work order or quote (phase 3)
// ═══════════════════════════════════════════════════════════════════════════
//
// CompanyChatMessage.card is { type, id } — ids only, never a title, an
// address or a number, and never money. It is resolved on READ, for each
// reader, with that reader's own access (lib/company/chat/cards.js): the
// crew see a work order for a job they are on and "Office only" on a quote;
// a total is never in any card for anybody, because a total in chat is a
// total in a screenshot.

export const CARD_TYPES = Object.freeze(["job", "work_order", "quote"]);

/** The card a browser sent, shape-checked: { type, id } or null (none) — `false` when malformed. */
export function parseCard(input) {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input !== "object" || Array.isArray(input)) return false;
  const type = typeof input.type === "string" ? input.type : "";
  const id = typeof input.id === "string" ? input.id.trim() : "";
  if (!CARD_TYPES.includes(type) || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return false;
  return { type, id };
}

// ═══════════════════════════════════════════════════════════════════════════
// Reply, edit, remove, pin (phase 4)
// ═══════════════════════════════════════════════════════════════════════════

/** How long the author may edit a message after sending it. */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/** How many messages a room may have pinned at once. */
export const PINS_MAX = 50;

/**
 * May this member edit this message now? { ok, code }.
 * The author only, a spoken message (not a system line), not removed, and
 * inside EDIT_WINDOW_MS of when it was SENT — measured by the server's clock
 * on the server; the screen's countdown is only a courtesy.
 */
export function canEditMessage(message, member, now = new Date()) {
  if (!canWrite(member)) return { ok: false, code: "read_only" };
  if (!message || message.kind === "system") return { ok: false, code: "not_allowed" };
  if (message.deletedAt) return { ok: false, code: "removed" };
  if (!message.authorMemberId || message.authorMemberId !== member.id) return { ok: false, code: "not_author" };
  const sent = timeOf(message.createdAt);
  if (Number.isNaN(sent) || timeOf(now) - sent > EDIT_WINDOW_MS) return { ok: false, code: "too_late" };
  return { ok: true, code: null };
}

/**
 * May this member remove this message? { ok, code }.
 * Their own, any time. Somebody else's only in a CHANNEL they manage
 * (rules.js canManage — the owner and admins in any channel they are in,
 * a supervisor in the channels they made). A DM, a group, #general and a
 * job room have no moderator: nobody removes another person's words there.
 */
export function canRemoveMessage(message, room, member, membership) {
  if (!canWrite(member)) return { ok: false, code: "read_only" };
  if (!message || message.kind === "system") return { ok: false, code: "not_allowed" };
  if (message.authorMemberId && message.authorMemberId === member.id) return { ok: true, code: null };
  if (room?.kind === "channel" && canManage(room, member, membership)) return { ok: true, code: null };
  return { ok: false, code: "not_allowed" };
}

/**
 * May this member pin and unpin in this room? (plan §4, owner decisions
 * 2026-10-04): the office (owner, admin, supervisor) in any room they are
 * in; a channel's or group's manager in their room; anybody in a DM or a
 * group — a conversation's own people keep its notes. Crew cannot pin in
 * #general, a job room, or a channel they do not manage. Never in an
 * archived room (read-only).
 */
export function canPin(room, member, membership) {
  if (!room || !canWrite(member) || !isOpen(membership)) return false;
  if (room.archivedAt) return false;
  if (isOfficeRole(member.role)) return true;
  if (membership.role === "manager" && MADE_KINDS.includes(room.kind)) return true;
  return room.kind === "dm" || room.kind === "group";
}

/** May this member remove OTHER people's messages here? (Drawn as the menu entry.) */
export function canModerate(room, member, membership) {
  return room?.kind === "channel" && canManage(room, member, membership);
}

// ═══════════════════════════════════════════════════════════════════════════
// Search (phase 4)
// ═══════════════════════════════════════════════════════════════════════════

export const SEARCH_MIN = 2;
export const SEARCH_MAX = 100;
export const SEARCH_TAKE = 50;

/** The search words, cleaned — or null when there is nothing worth searching for. */
export function searchTerm(q) {
  const s = String(q ?? "").replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX);
  return s.length >= SEARCH_MIN ? s : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// "Seen by" — derived from each member's read boundary, never stored per message
// ═══════════════════════════════════════════════════════════════════════════
//
// Owner decision 2026-10-04: read receipts, yes; only the room's members see
// them. A message has been seen by every OTHER open member whose lastSeenAt
// (the read boundary the thread GET already moves — store.js markRoomSeen)
// is at or past its createdAt. Nothing new is written per read:
//
//   * a receipt row per message per reader is N×M rows — a 300-person group
//     and a busy day is a hundred thousand rows a day, written on every poll
//     of every open thread, to answer a question somebody asks by tapping;
//   * lastSeenAt only moves FORWARD and only as far as the last message the
//     reader was shown (unreadQuery.js seenUpTo), so "seen up to X" is
//     exactly "seen every message up to X" — the per-message row would
//     record nothing the boundary does not already say;
//   * the count is one indexed query (CompanyChatMember @@index([roomId,
//     open, lastSeenAt])), and the list on tap is that query paginated.
//
// What it cannot say is "opened the room but scrolled past without reading"
// — no chat that infers reading from display can, and this one says "seen",
// not "read".

/**
 * How many OTHER open members have seen this message.
 * @param members  [{ memberId, open, lastSeenAt }]
 */
export function seenCount(message, members = [], authorMemberId = null) {
  const at = timeOf(message?.createdAt ?? message?.at);
  if (Number.isNaN(at)) return 0;
  const author = authorMemberId ?? message?.authorMemberId ?? null;
  return (Array.isArray(members) ? members : []).filter((m) => {
    if (!m || m.open === false || !m.memberId || m.memberId === author) return false;
    const seen = timeOf(m.lastSeenAt);
    return !Number.isNaN(seen) && seen >= at;
  }).length;
}

/**
 * The seen counts for the viewer's OWN messages in a thread payload, as
 * { messageId: count }. Their own only: a receipt answers the author's
 * question ("did the crew see it?"); nobody else's reading habits are
 * tallied for a third party.
 */
export function seenCounts(messages = [], members = [], memberId = null) {
  const out = {};
  if (!memberId) return out;
  for (const m of Array.isArray(messages) ? messages : []) {
    if (!m || m.kind === "system" || m.authorMemberId !== memberId) continue;
    out[m.id] = seenCount(m, members, memberId);
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// Who may do what
// ═══════════════════════════════════════════════════════════════════════════

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

/**
 * May this member's "@everyone" / "@all" reach the whole room?
 *
 * The office only — owner, admin, supervisor (the Manager and Dispatcher
 * presets map to supervisor, lib/permissions.js). In #general an @everyone
 * is a push to every phone on the roster; that is an announcement, and
 * announcing is the office's job. Anyone else's "@everyone" is posted as
 * the words they typed and mentions nobody (lib/staff/mentions.js), and the
 * composer says so before they send.
 */
export function mayMentionEveryone(member) {
  return isOfficeRole(member?.role);
}

/** Does this member see every room in the company rather than their own? */
export function seesAllRooms(member) {
  return Boolean(member?.impersonation) && member.impersonationMode !== "demo_sandbox";
}

/**
 * The rules matrix for channels and groups (owner decisions 2026-10-04):
 *
 *   action                      owner/admin   supervisor            crew
 *   create a channel            yes           yes                   NO
 *   start a DM or a group       yes           yes                   yes
 *   join a public channel       yes           yes                   yes
 *   rename / topic / private /  any channel   channels they manage  no
 *     office-only / archive       they are in
 *   add people to a channel     as above      as above              no
 *   remove from a channel       as above      as above              no
 *   rename a group              any member of the group
 *   add people to a group       any member of the group
 *   remove from a group         its maker (manager), or an owner/admin in it
 *   leave                       a channel or group — not #general, a job
 *                               room, a DM, or an auto-join channel
 *   post in an office-only      yes           yes                   NO (reads)
 *     channel
 *   post in an archived room    nobody — archived is read-only
 *
 * "Manage" needs an OPEN membership even for the owner: a private channel
 * is invisible to everybody not in it, the owner included, and every store
 * write answers a non-member 404 — the same answer a room that does not
 * exist gets. The office role is re-read from the session on every call, so
 * a supervisor demoted to crew stops managing the channel they made.
 */
export function canCreateChannel(member) {
  return canWrite(member) && isOfficeRole(member?.role);
}

/** Anybody who can write may start a DM or a group — crew included. */
export function canStartGroup(member) {
  return canWrite(member);
}

const isOpen = (membership) => Boolean(membership && membership.open !== false);
const isOwnerOrAdmin = (member) => member?.role === "owner" || member?.role === "admin";

/** May this member manage (rename, set topic/visibility/posting, archive, add, remove) this channel or group? */
export function canManage(room, member, membership) {
  if (!room || !canWrite(member) || !isOpen(membership)) return false;
  if (room.kind === "channel") {
    if (!isOfficeRole(member.role)) return false;
    return isOwnerOrAdmin(member) || membership.role === "manager";
  }
  if (room.kind === "group") return isOwnerOrAdmin(member) || membership.role === "manager";
  return false;
}

/** May this member rename the room? A channel: its managers. A group: anybody in it. */
export function canRename(room, member, membership) {
  if (room?.kind === "group") return canWrite(member) && isOpen(membership);
  return canManage(room, member, membership);
}

/** May this member add people? A channel: its managers. A group: anybody in it. */
export function canAddMembers(room, member, membership) {
  if (room?.archivedAt) return false;
  if (room?.kind === "group") return canWrite(member) && isOpen(membership);
  return canManage(room, member, membership);
}

/** May this member take somebody ELSE out? (Taking yourself out is leaving.) */
export function canRemoveMembers(room, member, membership) {
  return canManage(room, member, membership);
}

/** May this member archive or unarchive the room? Channels only. */
export function canArchive(room, member, membership) {
  return room?.kind === "channel" && canManage(room, member, membership);
}

/**
 * May anybody leave this room? Returns { ok, reason }.
 *
 * #general and job rooms are derived — leaving would be undone by the next
 * sync, so the control would lie. A DM is two people; hide it instead. An
 * auto-join channel (#announcements) exists so that everybody has it; mute
 * it instead.
 */
export function canLeave(room) {
  if (!room) return { ok: false, reason: "no_room" };
  if (!MADE_KINDS.includes(room.kind)) return { ok: false, reason: "fixed_room" };
  if (room.kind === "channel" && room.autoJoin) return { ok: false, reason: "auto_join" };
  return { ok: true, reason: null };
}

/**
 * May this member post in this room now? Returns { ok, code }.
 * The codes are the store's refusal codes: read_only | archived | office_only.
 */
export function canPost(room, member) {
  if (!canWrite(member)) return { ok: false, code: "read_only" };
  if (room?.archivedAt) return { ok: false, code: "archived" };
  if (room?.postingPolicy === "office" && !isOfficeRole(member?.role)) return { ok: false, code: "office_only" };
  return { ok: true, code: null };
}

/**
 * Whether a room the viewer is NOT in may be shown to them as joinable.
 * Public, unarchived channels only — a private channel's existence is a fact
 * about the people in it, and a group is a conversation, not a place.
 */
export function isJoinable(room) {
  return Boolean(room && room.kind === "channel" && !room.private && !room.archivedAt);
}

/** How many members a thread payload carries inline; past this, the panel and the @ list page through the members route. */
export const MEMBER_INLINE_MAX = 200;

/** One page of the members panel. */
export const MEMBER_PAGE = 50;
