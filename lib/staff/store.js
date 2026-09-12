// lib/staff/store.js
//
// Reads and writes for the staff chat. Everything that touches the database.
//
// The rules live next door — rooms.js, participants.js, channels.js,
// mentions.js — pure, so a check can drive them without Postgres. This file
// is the part that cannot be pure, and it is deliberately thin: it loads rows,
// hands them to those functions, and writes what they decide.
//
// ══ Refusals are values, not throws ═══════════════════════════════════════
//
// Every write returns { ok: true, ... } or { ok: false, status, error, code }.
// The route hands `status`, `error` and `code` straight to NextResponse. The
// CODE is what the screen translates (lib/sales/authRefusals.js established
// the shape); the sentence is what a log or a curl sees. A thrown refusal
// would reach the browser as a 500 with no body, which is the failure
// scripts/check-refusal-shape.mjs exists to catch.
import { db } from "@/lib/db";
import { presenceFor } from "@/lib/sales/calls/store";
import { REP_STATES } from "@/lib/sales/calls/agentState";
import { canAuthenticate } from "@/lib/sales/invite";
import { ensureTeamRooms, memberOrAutoJoin } from "./teams";
import { directRoomKey, participantName, sameParticipant, participantOf } from "./participants";
import { memberWhere, authorData } from "./viewer";
import { validateChannelName, canManage, canLeave, isJoinable } from "./channels";
import { parseMentions, parseParticipantKey } from "./mentions";
import { appSentence, pushToPlatformAdmins, pushToReps } from "@/lib/notify/push";

/** Loaded with every room, so titles and unread can be worked out in one pass. */
const ROOM_INCLUDE = {
  members: {
    select: {
      id: true,
      open: true,
      platformAdminId: true,
      salesRepId: true,
      lastSeenAt: true,
      platformAdmin: { select: { email: true, role: true, lastSeenAt: true } },
      salesRep: { select: { name: true, email: true } },
    },
  },
  messages: {
    orderBy: { sentAt: "asc" },
    // Enough for a preview and an unread count without loading a year of
    // history into a list request. The thread route loads the rest.
    take: 200,
    select: {
      id: true,
      body: true,
      kind: true,
      meta: true,
      mentions: true,
      sentAt: true,
      authorPlatformAdminId: true,
      authorSalesRepId: true,
      authorPlatformAdmin: { select: { email: true } },
      authorSalesRep: { select: { name: true, email: true } },
    },
  },
};

const refuse = (status, code, error) => ({ ok: false, status, code, error });

/**
 * Make sure the team channels exist and everybody is in them.
 *
 * Lives in lib/staff/teams.js, and is about EVERYBODY rather than the viewer
 * — see that file's header for the production state that forced the change
 * (a "Sales" room with no members, at a demo). Kept under this name so the
 * route reads the same.
 */
export async function ensureStaffRooms(viewer) {
  if (!viewer) return;
  await ensureTeamRooms();
}

/** Every room this viewer is an OPEN member of. */
export async function roomsFor(viewer) {
  return db.staffRoom.findMany({
    where: { members: { some: { ...memberWhere(viewer), open: true } } },
    include: ROOM_INCLUDE,
    orderBy: { lastMessageAt: "desc" },
  });
}

/**
 * Public channels this viewer is NOT in, for "Channels you can join".
 *
 * Private channels are excluded by the query, not filtered after: a private
 * room's existence is a fact about the people in it, and it must never be in
 * a result set that reaches a non-member even briefly.
 */
export async function joinableRoomsFor(viewer) {
  return db.staffRoom.findMany({
    where: {
      kind: "channel",
      private: false,
      NOT: { members: { some: { ...memberWhere(viewer), open: true } } },
    },
    include: { members: { select: { id: true, open: true } } },
    orderBy: [{ teamKey: "asc" }, { name: "asc" }],
  });
}

/** One room, but only if they are in it. Membership IS the permission. */
export async function roomFor(viewer, roomId) {
  if (!roomId) return null;
  return db.staffRoom.findFirst({
    where: { id: roomId, members: { some: { ...memberWhere(viewer), open: true } } },
    include: {
      ...ROOM_INCLUDE,
      messages: { ...ROOM_INCLUDE.messages, take: 500 },
    },
  });
}

/** Minutes within which a platform admin who called the chat counts as here. */
const ADMIN_ONLINE_MINUTES = 5;

/**
 * Everyone at FieldQuo, for the directory, the DM picker and the members
 * picker — both kinds in one list, because the point of this feature is that
 * a rep can reach support without knowing which system support signs in to.
 *
 * Departed staff are left out: a rep who cannot sign in (canAuthenticate —
 * the same predicate the sales gate uses) and an admin switched off. A list
 * you cannot get a reply from is a list that wastes somebody's afternoon.
 *
 * Presence is two different facts and is labelled as two:
 *   - a rep DECLARES a floor state (lib/sales/calls/agentState.js), and the
 *     directory shows the same livePresence the floor board draws, so the two
 *     screens cannot disagree about whether Daniel is on a call;
 *   - an admin declares nothing; the one observed fact is when they last
 *     called the staff chat (PlatformAdmin.lastSeenAt), so their dot means
 *     "had the chat open in the last five minutes" and nothing more.
 *
 * @param q  optional search — matched against name and email, case-blind.
 */
export async function staffDirectory({ q = "", now = new Date() } = {}) {
  const [admins, reps] = await Promise.all([
    db.platformAdmin.findMany({
      where: { active: true },
      select: { id: true, email: true, role: true, lastSeenAt: true },
      orderBy: { email: "asc" },
    }),
    db.salesRep.findMany({
      where: { active: true, endedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        engagement: true,
        lastSeenAt: true,
        active: true,
        endedAt: true,
        acceptedAt: true,
        passwordHash: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);
  const liveReps = reps.filter((r) => canAuthenticate(r));

  // Null when the call store is not migrated: the directory then says
  // nothing about reps' floor state rather than inventing "offline".
  const presence = await presenceFor(liveReps.map((r) => r.id), { now }).catch(() => null);
  const byRep = new Map((presence || []).map((p) => [p.salesRepId, p.presence]));

  const people = [
    ...admins.map((a) => {
      const seen = a.lastSeenAt ? new Date(a.lastSeenAt) : null;
      const online = Boolean(seen) && now.getTime() - seen.getTime() < ADMIN_ONLINE_MINUTES * 60 * 1000;
      return {
        kind: "user",
        id: a.id,
        name: a.email,
        email: a.email,
        role: a.role,
        // The label the screen prints beside the name. "superadmin" is the
        // owner's own word for it; everyone else on the platform side is
        // FieldQuo staff.
        label: a.role === "superadmin" ? "superadmin" : "staff",
        engagement: null,
        presence: { source: "chat", online, state: online ? "online" : seen ? "away" : "never", stale: false, lastSeenAt: seen },
      };
    }),
    ...liveReps.map((r) => {
      const p = byRep.get(r.id) || null;
      const live = p ? Boolean(p.everSeen && !p.stale && REP_STATES[p.state]?.live) : null;
      return {
        kind: "rep",
        id: r.id,
        name: r.name || r.email,
        email: r.email,
        role: "rep",
        label: "rep",
        engagement: r.engagement || null,
        presence: p
          ? { source: "floor", online: live, state: p.state, pauseReason: p.pauseReason, stale: p.stale, lastSeenAt: p.lastSeenAt || p.portalSeenAt || null }
          : { source: "floor", online: null, state: null, stale: false, lastSeenAt: r.lastSeenAt || null },
      };
    }),
  ];

  const needle = String(q || "").trim().toLowerCase();
  if (!needle) return people;
  return people.filter(
    (p) => p.name.toLowerCase().includes(needle) || (p.email || "").toLowerCase().includes(needle),
  );
}

/**
 * Resolve a list of { kind, id } the browser sent against the live directory.
 *
 * Checked rather than trusted: an id the browser sent could name a
 * deactivated rep, or nobody at all, and a room with a participant who cannot
 * reply is worse than a refusal. Returns the matched people and the ones that
 * were not found, so the caller can refuse with the count.
 */
export async function resolvePeople(list) {
  const wanted = (Array.isArray(list) ? list : [])
    .map((p) => ({ kind: p?.kind, id: String(p?.id || "") }))
    .filter((p) => (p.kind === "user" || p.kind === "rep") && p.id);
  if (!wanted.length) return { people: [], missing: 0 };
  const directory = await staffDirectory();
  const people = [];
  let missing = 0;
  for (const w of wanted) {
    const found = directory.find((p) => p.kind === w.kind && p.id === w.id);
    if (found) {
      if (!people.some((p) => sameParticipant(p, found))) people.push(found);
    } else {
      missing++;
    }
  }
  return { people, missing };
}

/**
 * The direct room between two people, creating it the first time.
 *
 * The unique `directKey` is what makes this safe: two people pressing message
 * on each other at the same moment both try to create, one wins, and the loser
 * reads back the winner's row. Nothing here reads-then-writes and hopes.
 */
export async function openDirect(viewer, other) {
  const key = directRoomKey(viewer, other);
  // Null means they asked to message themselves, or handed a malformed pair.
  // Refused rather than quietly making a room nobody meant.
  if (!key) return null;

  const existing = await db.staffRoom.findUnique({ where: { directKey: key }, select: { id: true } });
  if (existing) {
    // A direct room somebody hid comes back when either side opens it.
    await db.staffRoomMember.updateMany({
      where: { roomId: existing.id, open: false },
      data: { open: true, removedAt: null },
    });
    return existing.id;
  }

  try {
    const room = await db.staffRoom.create({
      data: {
        kind: "direct",
        directKey: key,
        members: {
          create: [
            { ...memberWhere(viewer) },
            { ...memberWhere(other) },
          ],
        },
      },
      select: { id: true },
    });
    return room.id;
  } catch (err) {
    // P2002 is the unique index doing its job against the other tab.
    if (err?.code === "P2002") {
      const won = await db.staffRoom.findUnique({ where: { directKey: key }, select: { id: true } });
      return won?.id || null;
    }
    throw err;
  }
}

/**
 * A system line — "Daniel added Jesus" — written by the actor so the thread
 * can attribute it, with the facts in `meta` so the screen can say it in the
 * reader's language. The stored `body` is the English sentence.
 */
function systemLine(viewer, roomId, meta, body) {
  return db.staffMessage.create({
    data: { roomId, kind: "system", body, meta, ...authorData(viewer) },
    select: { id: true },
  });
}

/** The open members of a room as { kind, id, name, email }, for mention parsing. */
async function openMembersOf(roomId) {
  const rows = await db.staffRoomMember.findMany({
    where: { roomId, open: true },
    select: {
      platformAdminId: true,
      salesRepId: true,
      platformAdmin: { select: { email: true } },
      salesRep: { select: { name: true, email: true } },
    },
  });
  return rows
    .map((m) => {
      const p = participantOf(m);
      if (!p) return null;
      return { ...p, name: participantName(m), email: m.platformAdmin?.email || m.salesRep?.email || null };
    })
    .filter(Boolean);
}

/**
 * Make a channel.
 *
 * The creator is a member and the owner. The slug's unique index is the
 * authority on "already taken" — P2002 is read back as a refusal rather than
 * checked ahead of time, so two reps making "#west" at once get one room.
 */
export async function createChannel({ viewer, name, topic, isPrivate, members }) {
  const check = validateChannelName(name);
  if (!check.ok) {
    const sentences = {
      name_missing: "Give the group a name.",
      name_too_long: "That name is too long for a channel.",
      name_reserved: "That name belongs to a team channel.",
    };
    return refuse(400, check.reason, sentences[check.reason] || "That name will not do.");
  }
  const { people, missing } = await resolvePeople(members);
  if (missing) {
    return refuse(404, "member_unknown", "Somebody on that list is not at FieldQuo any more.");
  }
  const others = people.filter((p) => !sameParticipant(p, viewer));
  const cleanTopic = typeof topic === "string" ? topic.trim().slice(0, 200) : "";

  try {
    const room = await db.staffRoom.create({
      data: {
        kind: "channel",
        name: String(name).trim().slice(0, 40),
        slug: check.slug,
        topic: cleanTopic || null,
        private: Boolean(isPrivate),
        ...(viewer.kind === "user" ? { ownerPlatformAdminId: viewer.id } : { ownerSalesRepId: viewer.id }),
        lastMessageAt: new Date(),
        members: {
          create: [{ ...memberWhere(viewer) }, ...others.map((p) => ({ ...memberWhere(p) }))],
        },
      },
      select: { id: true, name: true, slug: true },
    });
    await systemLine(
      viewer,
      room.id,
      { system: "created", name: room.name, names: others.map((p) => p.name) },
      `${viewer.name} created #${room.slug}`,
    );
    return { ok: true, roomId: room.id };
  } catch (err) {
    if (err?.code === "P2002") {
      return refuse(409, "name_taken", "A channel with that name already exists.");
    }
    throw err;
  }
}

/** The room, with its open membership for this viewer, or a refusal. */
async function roomAndMembership(viewer, roomId) {
  const room = await db.staffRoom.findUnique({
    where: { id: roomId || "" },
    select: {
      id: true,
      kind: true,
      name: true,
      slug: true,
      teamKey: true,
      isDefault: true,
      private: true,
      ownerPlatformAdminId: true,
      ownerSalesRepId: true,
    },
  });
  if (!room) return { room: null, member: null };
  const member = await db.staffRoomMember.findFirst({
    where: { roomId: room.id, ...memberWhere(viewer), open: true },
    select: { id: true },
  });
  return { room, member };
}

// Not-a-member and does-not-exist answer the same way on purpose. A distinct
// 403 would confirm that a room with that id exists, which is a fact about
// somebody else's private conversation.
const NO_ROOM = refuse(404, "no_room", "No such conversation.");

/**
 * Add people to a room. Any open member may — the room is theirs too, and
 * Rocket.Chat's default is the same. A private room's members are the only
 * ones who can see it exists, so they are the only ones who can grow it.
 */
export async function addMembers({ viewer, roomId, members }) {
  const { room, member } = await roomAndMembership(viewer, roomId);
  if (!room || !member) return NO_ROOM;
  if (room.kind === "direct") {
    return refuse(400, "direct_room", "A direct message is between two people. Make a group to add somebody.");
  }
  const { people, missing } = await resolvePeople(members);
  if (missing) return refuse(404, "member_unknown", "Somebody on that list is not at FieldQuo any more.");
  if (!people.length) return refuse(400, "nobody_named", "Say who to add.");

  const added = [];
  for (const p of people) {
    const where =
      p.kind === "user"
        ? { roomId_platformAdminId: { roomId: room.id, platformAdminId: p.id } }
        : { roomId_salesRepId: { roomId: room.id, salesRepId: p.id } };
    const before = await db.staffRoomMember.findUnique({ where, select: { open: true } });
    if (before?.open) continue;
    await db.staffRoomMember.upsert({
      where,
      update: { open: true, removedAt: null },
      create: { roomId: room.id, ...memberWhere(p) },
      select: { id: true },
    });
    added.push(p);
  }
  if (added.length) {
    await systemLine(
      viewer,
      room.id,
      { system: "added", names: added.map((p) => p.name) },
      `${viewer.name} added ${added.map((p) => p.name).join(", ")}`,
    );
  }
  return { ok: true, added: added.map((p) => ({ kind: p.kind, id: p.id, name: p.name })) };
}

/**
 * Take somebody out of a room. The row is kept and closed — never deleted —
 * so their messages stay attributed and "was in it until March" stays true.
 *
 * The owner or a superadmin may remove anyone; anyone may remove themselves,
 * which is leaving, and follows leaving's rules.
 */
export async function removeMember({ viewer, roomId, target }) {
  if (sameParticipant(target, viewer)) return leaveRoom({ viewer, roomId });
  const { room, member } = await roomAndMembership(viewer, roomId);
  if (!room || !member) return NO_ROOM;
  if (room.isDefault) return refuse(400, "default_room", "Nobody can be removed from the team channel.");
  if (room.kind === "direct") return refuse(400, "direct_room", "A direct message cannot lose a side.");
  if (!canManage(room, viewer)) return refuse(403, "not_owner", "Only the person who made this group can remove people.");
  if (!target?.kind || !target?.id) return refuse(400, "nobody_named", "Say who to remove.");

  const row = await db.staffRoomMember.findFirst({
    where: { roomId: room.id, ...memberWhere(target), open: true },
    select: { id: true, platformAdmin: { select: { email: true } }, salesRep: { select: { name: true, email: true } } },
  });
  if (!row) return refuse(404, "not_member", "They are not in this group.");
  const name = participantName(row);
  await db.$transaction([
    db.staffRoomMember.update({ where: { id: row.id }, data: { open: false, removedAt: new Date() } }),
    db.staffMessage.create({
      data: { roomId: room.id, kind: "system", body: `${viewer.name} removed ${name}`, meta: { system: "removed", names: [name] }, ...authorData(viewer) },
    }),
  ]);
  return { ok: true };
}

/** Leave a room. Refused for the default room and for a direct message. */
export async function leaveRoom({ viewer, roomId }) {
  const { room, member } = await roomAndMembership(viewer, roomId);
  if (!room || !member) return NO_ROOM;
  const check = canLeave(room);
  if (!check.ok) {
    const sentences = {
      default_room: "Everybody is in this channel. It is the one you cannot leave.",
      direct_room: "A direct message cannot be left; it is just the two of you.",
    };
    return refuse(400, check.reason, sentences[check.reason] || "You cannot leave this one.");
  }
  await db.$transaction([
    db.staffRoomMember.update({ where: { id: member.id }, data: { open: false, removedAt: new Date() } }),
    db.staffMessage.create({
      data: { roomId: room.id, kind: "system", body: `${viewer.name} left`, meta: { system: "left" }, ...authorData(viewer) },
    }),
  ]);
  return { ok: true };
}

/** Join a public channel. A private one answers as if it did not exist. */
export async function joinRoom({ viewer, roomId }) {
  const room = await db.staffRoom.findUnique({
    where: { id: roomId || "" },
    select: { id: true, kind: true, private: true, slug: true },
  });
  if (!room || !isJoinable(room)) return NO_ROOM;
  const where =
    viewer.kind === "user"
      ? { roomId_platformAdminId: { roomId: room.id, platformAdminId: viewer.id } }
      : { roomId_salesRepId: { roomId: room.id, salesRepId: viewer.id } };
  const before = await db.staffRoomMember.findUnique({ where, select: { open: true } });
  if (before?.open) return { ok: true, roomId: room.id, already: true };
  await db.staffRoomMember.upsert({
    where,
    update: { open: true, removedAt: null },
    create: { roomId: room.id, ...memberWhere(viewer) },
    select: { id: true },
  });
  await systemLine(viewer, room.id, { system: "joined" }, `${viewer.name} joined`);
  return { ok: true, roomId: room.id };
}

/**
 * Rename a channel or set its topic. Owner or superadmin.
 *
 * A team room keeps its name: the screen names teams from the catalogue by
 * teamKey, in the reader's language, and a stored rename would be shown to
 * nobody. Its topic may change.
 */
export async function updateRoom({ viewer, roomId, name, topic }) {
  const { room, member } = await roomAndMembership(viewer, roomId);
  if (!room || !member) return NO_ROOM;
  if (room.kind === "direct") return refuse(400, "direct_room", "A direct message has no name to change.");
  if (!canManage(room, viewer)) return refuse(403, "not_owner", "Only the person who made this group can change it.");

  const data = {};
  const meta = [];
  if (typeof name === "string" && name.trim() && name.trim() !== room.name) {
    if (room.teamKey) return refuse(400, "team_room", "A team channel keeps its name.");
    const check = validateChannelName(name);
    if (!check.ok) {
      const sentences = {
        name_missing: "Give the group a name.",
        name_too_long: "That name is too long for a channel.",
        name_reserved: "That name belongs to a team channel.",
      };
      return refuse(400, check.reason, sentences[check.reason] || "That name will not do.");
    }
    data.name = name.trim().slice(0, 40);
    data.slug = check.slug;
    meta.push({ system: "renamed", from: room.name, to: data.name });
  }
  if (typeof topic === "string") {
    const clean = topic.trim().slice(0, 200);
    data.topic = clean || null;
    meta.push({ system: "topic", to: clean });
  }
  if (!Object.keys(data).length) return { ok: true, unchanged: true };

  try {
    await db.$transaction([
      db.staffRoom.update({ where: { id: room.id }, data }),
      ...meta.map((m) =>
        db.staffMessage.create({
          data: {
            roomId: room.id,
            kind: "system",
            body: m.system === "renamed" ? `${viewer.name} renamed #${room.slug || room.name} to #${data.slug}` : `${viewer.name} set the topic: ${m.to}`,
            meta: m,
            ...authorData(viewer),
          },
        }),
      ),
    ]);
  } catch (err) {
    if (err?.code === "P2002") return refuse(409, "name_taken", "A channel with that name already exists.");
    throw err;
  }
  return { ok: true };
}

/**
 * The members of a room, for the Members bar: kind, name, presence, and
 * whether the viewer may remove them. Only for a viewer who is in it.
 */
export async function membersOf(viewer, roomId) {
  const { room, member } = await roomAndMembership(viewer, roomId);
  if (!room || !member) return null;
  const rows = await db.staffRoomMember.findMany({
    where: { roomId: room.id, open: true },
    select: { platformAdminId: true, salesRepId: true },
  });
  const directory = await staffDirectory();
  const owner = participantOf(room, { userField: "ownerPlatformAdminId", repField: "ownerSalesRepId" });
  const manage = canManage(room, viewer);
  const members = rows
    .map((r) => {
      const p = participantOf(r);
      if (!p) return null;
      const person = directory.find((d) => sameParticipant(d, p));
      // A member no longer in the directory (departed) is still listed —
      // they ARE in the room — but with nothing invented about them.
      return {
        kind: p.kind,
        id: p.id,
        name: person?.name || "Someone at FieldQuo",
        email: person?.email || null,
        label: person?.label || (p.kind === "rep" ? "rep" : "staff"),
        engagement: person?.engagement || null,
        presence: person?.presence || null,
        departed: !person,
        isOwner: Boolean(owner && sameParticipant(owner, p)),
        isYou: sameParticipant(p, viewer),
        canRemove: manage && !room.isDefault && room.kind !== "direct" && !sameParticipant(p, viewer),
      };
    })
    .filter(Boolean);
  return {
    room: { id: room.id, kind: room.kind, name: room.name, slug: room.slug, teamKey: room.teamKey, isDefault: room.isDefault, private: room.private },
    canManage: manage,
    canLeave: canLeave(room).ok,
    canAdd: room.kind !== "direct",
    members,
  };
}

/**
 * Say something. Returns the created row, or null when they are not in the room.
 *
 * The membership check is a QUERY, not a trust: a roomId is a string the
 * browser sent, and "they are in this room" is the only thing that makes it
 * theirs to write to.
 */
export async function postStaffMessage({ viewer, roomId, body }) {
  const text = typeof body === "string" ? body.trim() : "";
  if (!viewer || !roomId || !text) return null;

  // A team room lets active staff in on the write path too, so a rep added
  // this morning is not refused for a row the next list read would create.
  const member = await memberOrAutoJoin(viewer, roomId, memberWhere(viewer));
  if (!member) return null;

  // Mentions are parsed against the members of the room AT THIS MOMENT and
  // stored — see lib/staff/mentions.js for why not on read.
  const mentions = parseMentions(text, await openMembersOf(roomId));

  // The room's lastMessageAt is written in the SAME transaction as the message,
  // so the list's ordering can never describe a message that failed to save.
  const [message] = await db.$transaction([
    db.staffMessage.create({
      data: { roomId, body: text.slice(0, 4000), mentions, ...authorData(viewer) },
      select: { id: true, body: true, sentAt: true, mentions: true },
    }),
    db.staffRoom.update({ where: { id: roomId }, data: { lastMessageAt: new Date() } }),
    // Saying something is seeing it. Without this a rep's own message leaves
    // their own room showing unread until they reload.
    db.staffRoomMember.update({ where: { id: member.id }, data: { lastSeenAt: new Date() } }),
  ]);
  // The push copy of an @mention — to the people named, never the whole
  // room, and never the author. Fire-and-forget after the transaction has
  // committed (lib/notify/push.js); the row is the record. Reps get it in
  // their language; platform staff in English.
  if (mentions.length) pushMentions({ viewer, roomId, text, mentions });
  return message;
}

function pushMentions({ viewer, roomId, text, mentions }) {
  try {
    const author = viewer.name || viewer.email || "";
    const repIds = [];
    const adminIds = [];
    for (const key of mentions) {
      const parsed = parseParticipantKey(key);
      if (!parsed) continue;
      if (parsed.kind === viewer.kind && parsed.id === viewer.id) continue;
      if (parsed.kind === "rep") repIds.push(parsed.id);
      else if (parsed.kind === "user") adminIds.push(parsed.id);
    }
    if (!repIds.length && !adminIds.length) return;
    const snippet = text.replace(/\s+/g, " ").slice(0, 90);
    const payloadFor = (roomName) => async (language) => ({
      title: await appSentence(language, "app.notify.mention.title", { name: author, room: roomName }),
      body: snippet,
      tag: `staff-mention:${roomId}`,
      url: "/sales/team",
    });
    void db.staffRoom
      .findUnique({ where: { id: roomId }, select: { name: true, kind: true } })
      .then((room) => {
        const roomName = room?.name ? `#${room.name}` : author;
        if (repIds.length) void pushToReps({ salesRepIds: repIds, payload: payloadFor(roomName) });
        if (adminIds.length) {
          void pushToPlatformAdmins({
            platformAdminIds: adminIds,
            payload: async () => ({ ...(await payloadFor(roomName)("en")), url: "/platform/chat" }),
          });
        }
      })
      .catch(() => null);
  } catch {
    /* a mention that could not be pushed is still stored and badged */
  }
}

/** Mark a room read, up to now. Silently does nothing for a non-member. */
export async function markRoomSeen({ viewer, roomId }) {
  if (!viewer || !roomId) return false;
  const member = await db.staffRoomMember.findFirst({
    where: { roomId, ...memberWhere(viewer), open: true },
    select: { id: true },
  });
  if (!member) return false;
  await db.staffRoomMember.update({ where: { id: member.id }, data: { lastSeenAt: new Date() } });
  return true;
}
