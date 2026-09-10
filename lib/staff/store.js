// lib/staff/store.js
//
// Reads and writes for the staff chat. Everything that touches the database.
//
// The rules live next door in rooms.js and participants.js, pure, so a check
// can drive them without Postgres. This file is the part that cannot be pure,
// and it is deliberately thin: it loads rows, hands them to those functions,
// and writes what they decide.
import { db } from "@/lib/db";
import { DEFAULT_TEAMS } from "./rooms";
import { directRoomKey } from "./participants";
import { memberWhere, authorData } from "./viewer";

/** Loaded with every room, so titles and unread can be worked out in one pass. */
const ROOM_INCLUDE = {
  members: {
    select: {
      platformAdminId: true,
      salesRepId: true,
      lastSeenAt: true,
      platformAdmin: { select: { email: true } },
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
      sentAt: true,
      authorPlatformAdminId: true,
      authorSalesRepId: true,
      authorPlatformAdmin: { select: { email: true } },
      authorSalesRep: { select: { name: true, email: true } },
    },
  },
};

/**
 * Make sure the team channels exist, and that this viewer is in the ones they
 * belong in.
 *
 * Idempotent, and run on every list request rather than by a migration. A
 * migration seeds the people who existed the day it ran; a rep hired next month
 * would sign in to an empty screen and have no way to fix it. `teamKey` is
 * unique, so a race creates one row and the database refuses the second.
 *
 * Membership rule, stated once: EVERYBODY is in "everyone". Reps are in
 * "sales", platform staff are in "support". Nobody is added to a channel they
 * are not in already beyond that — being able to see a channel exists is not
 * the same as being put in it, and quietly joining people to rooms is how a
 * chat becomes noise nobody reads.
 */
export async function ensureStaffRooms(viewer) {
  if (!viewer) return;
  for (const team of DEFAULT_TEAMS) {
    await db.staffRoom.upsert({
      where: { teamKey: team.teamKey },
      update: {},
      create: {
        kind: "channel",
        teamKey: team.teamKey,
        name: team.name,
        topic: team.topic,
        isDefault: team.isDefault,
      },
    });
  }

  const joins = ["everyone", viewer.kind === "rep" ? "sales" : "support"];
  for (const teamKey of joins) {
    const room = await db.staffRoom.findUnique({ where: { teamKey }, select: { id: true } });
    if (!room) continue;
    const existing = await db.staffRoomMember.findFirst({
      where: { roomId: room.id, ...memberWhere(viewer) },
      select: { id: true },
    });
    if (existing) continue;
    await db.staffRoomMember.create({
      data: { roomId: room.id, ...memberWhere(viewer) },
    });
  }
}

/** Every room this viewer is a member of. */
export async function roomsFor(viewer) {
  return db.staffRoom.findMany({
    where: { members: { some: memberWhere(viewer) }, ...{} },
    include: ROOM_INCLUDE,
    orderBy: { lastMessageAt: "desc" },
  });
}

/** One room, but only if they are in it. Membership IS the permission. */
export async function roomFor(viewer, roomId) {
  if (!roomId) return null;
  return db.staffRoom.findFirst({
    where: { id: roomId, members: { some: memberWhere(viewer) } },
    include: {
      ...ROOM_INCLUDE,
      messages: { ...ROOM_INCLUDE.messages, take: 500 },
    },
  });
}

/**
 * Everyone at FieldQuo, for the "message somebody" picker.
 *
 * Both kinds in one list, because the point of this feature is that a rep can
 * reach support without knowing which system support signs in to. Inactive
 * staff are left out: a list you cannot get a reply from is a list that wastes
 * somebody's afternoon.
 */
export async function staffDirectory() {
  const [admins, reps] = await Promise.all([
    db.platformAdmin.findMany({
      where: { active: true },
      select: { id: true, email: true, role: true },
      orderBy: { email: "asc" },
    }),
    db.salesRep.findMany({
      where: { active: true, endedAt: null },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return [
    ...admins.map((a) => ({ kind: "user", id: a.id, name: a.email, role: a.role })),
    ...reps.map((r) => ({ kind: "rep", id: r.id, name: r.name || r.email, role: "rep" })),
  ];
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
  if (existing) return existing.id;

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
 * Say something. Returns the created row, or null when they are not in the room.
 *
 * The membership check is a QUERY, not a trust: a roomId is a string the
 * browser sent, and "they are in this room" is the only thing that makes it
 * theirs to write to.
 */
export async function postStaffMessage({ viewer, roomId, body }) {
  const text = typeof body === "string" ? body.trim() : "";
  if (!viewer || !roomId || !text) return null;

  const member = await db.staffRoomMember.findFirst({
    where: { roomId, ...memberWhere(viewer) },
    select: { id: true },
  });
  if (!member) return null;

  // The room's lastMessageAt is written in the SAME transaction as the message,
  // so the list's ordering can never describe a message that failed to save.
  const [message] = await db.$transaction([
    db.staffMessage.create({
      data: { roomId, body: text.slice(0, 4000), ...authorData(viewer) },
      select: { id: true, body: true, sentAt: true },
    }),
    db.staffRoom.update({ where: { id: roomId }, data: { lastMessageAt: new Date() } }),
    // Saying something is seeing it. Without this a rep's own message leaves
    // their own room showing unread until they reload.
    db.staffRoomMember.update({ where: { id: member.id }, data: { lastSeenAt: new Date() } }),
  ]);
  return message;
}

/** Mark a room read, up to now. Silently does nothing for a non-member. */
export async function markRoomSeen({ viewer, roomId }) {
  if (!viewer || !roomId) return false;
  const member = await db.staffRoomMember.findFirst({
    where: { roomId, ...memberWhere(viewer) },
    select: { id: true },
  });
  if (!member) return false;
  await db.staffRoomMember.update({ where: { id: member.id }, data: { lastSeenAt: new Date() } });
  return true;
}
