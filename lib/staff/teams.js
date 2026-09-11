// lib/staff/teams.js
//
// The team rooms every member of FieldQuo staff is in, and the rule that puts
// them there.
//
// ══ Why membership is asserted on EVERY list read ═════════════════════════
//
// The first version added only the VIEWER to their teams when they opened the
// list. In production that produced: "Everyone" with one member (the admin who
// opened /platform/chat), "Sales" with nobody, and a rep who could not post
// anywhere because nobody had opened the list AS HIM yet. The room a rep was
// told to talk in refused him, at a demo.
//
// So the rule is now about EVERYBODY, not the viewer: on every list read, every
// active platform admin and every rep who can sign in is upserted into every
// team room. Idempotent — the @@unique pairs on StaffRoomMember make a repeat
// a no-op — and it never deletes, so a rep who has left keeps their row and
// their history. A new hire is in #fieldquo the first time ANYONE opens the
// chat after they were added, which is day one.
//
// The cost is a handful of upserts per list read at FieldQuo's own headcount.
// That is nothing; a migration that seeded the people who existed the day it
// ran is the alternative, and it is exactly what was wrong before.
// `client` is injectable on every function, the way lib/sales/calls/store.js's
// presenceFor takes one: scripts/check-staff-chat.mjs drives the membership
// rule against an in-memory Prisma stand-in, so "a rep with no row can post
// in the default room" is EXECUTED, not read.
import { db } from "@/lib/db";
import { canAuthenticate } from "@/lib/sales/invite";
import { DEFAULT_TEAMS, autoJoins } from "./rooms";

/**
 * Everyone who counts as FieldQuo staff right now, as participant pairs.
 *
 * Reps are filtered by canAuthenticate, the same predicate the sales gate
 * uses: a rep who has not accepted their invite cannot open the chat, so
 * listing them as a member would show a name nobody can reach. They join the
 * moment they can sign in.
 */
export async function activeStaff({ client = db } = {}) {
  const [admins, reps] = await Promise.all([
    client.platformAdmin.findMany({ where: { active: true }, select: { id: true } }),
    client.salesRep.findMany({
      where: { active: true, endedAt: null },
      select: { id: true, active: true, endedAt: true, acceptedAt: true, passwordHash: true },
    }),
  ]);
  return {
    admins: admins.map((a) => a.id),
    reps: reps.filter((r) => canAuthenticate(r)).map((r) => r.id),
  };
}

/**
 * Make sure the team rooms exist and that everybody who belongs in them is in
 * them. Idempotent. Never deletes.
 *
 * Membership rows are created where none exists. A row that exists with
 * open=false is somebody who LEFT a joinable team, and that is respected —
 * except in the default room, where open is forced back to true, because the
 * whole point of that room is that nobody is outside it.
 */
export async function ensureTeamRooms({ client = db } = {}) {
  // ── The rename, once ──────────────────────────────────────────────────
  // If the everybody-room still carries its first key and no "fieldquo" room
  // exists, move the key rather than make a new room; deleting the old one
  // would delete the only room anybody had said anything in.
  const [legacy, current] = await Promise.all([
    client.staffRoom.findUnique({ where: { teamKey: "everyone" }, select: { id: true } }),
    client.staffRoom.findUnique({ where: { teamKey: "fieldquo" }, select: { id: true } }),
  ]);
  if (legacy && !current) {
    await client.staffRoom.update({
      where: { id: legacy.id },
      data: { teamKey: "fieldquo", name: "fieldquo" },
    });
  }

  const rooms = {};
  for (const team of DEFAULT_TEAMS) {
    rooms[team.teamKey] = await client.staffRoom.upsert({
      where: { teamKey: team.teamKey },
      // The slug is the key, so the unique index — not only
      // validateChannelName — is what stops a user making a second "#sales".
      update: { slug: team.teamKey },
      create: {
        kind: "channel",
        teamKey: team.teamKey,
        slug: team.teamKey,
        name: team.name,
        topic: team.topic,
        isDefault: team.isDefault,
      },
      select: { id: true, isDefault: true },
    });
  }

  const staff = await activeStaff({ client });
  const writes = [];
  for (const team of DEFAULT_TEAMS) {
    const room = rooms[team.teamKey];
    // The default room re-asserts open=true; a joinable team only creates the
    // row when there is none, so leaving it sticks.
    const update = room.isDefault ? { open: true, removedAt: null } : {};
    if (autoJoins(team, "user")) {
      for (const platformAdminId of staff.admins) {
        writes.push(
          client.staffRoomMember.upsert({
            where: { roomId_platformAdminId: { roomId: room.id, platformAdminId } },
            update,
            create: { roomId: room.id, platformAdminId },
            select: { id: true },
          }),
        );
      }
    }
    if (autoJoins(team, "rep")) {
      for (const salesRepId of staff.reps) {
        writes.push(
          client.staffRoomMember.upsert({
            where: { roomId_salesRepId: { roomId: room.id, salesRepId } },
            update,
            create: { roomId: room.id, salesRepId },
            select: { id: true },
          }),
        );
      }
    }
  }
  if (writes.length) await client.$transaction(writes);
  return rooms;
}

/**
 * A member row for this viewer in this room, creating it when the room is a
 * team room they belong in and they were never put in it.
 *
 * This is the write-path half of the rule above: a rep who posts in #sales
 * between being added and the next list read must not be refused for a
 * membership row nobody had got round to creating. Returns null for a room
 * they are genuinely not in.
 */
export async function memberOrAutoJoin(viewer, roomId, memberWhere, { client = db } = {}) {
  const existing = await client.staffRoomMember.findFirst({
    where: { roomId, ...memberWhere },
    select: { id: true, open: true },
  });
  if (existing?.open) return existing;

  const room = await client.staffRoom.findUnique({
    where: { id: roomId },
    select: { id: true, teamKey: true, isDefault: true },
  });
  if (!room?.teamKey) return existing?.open ? existing : null;
  const team = DEFAULT_TEAMS.find((t) => t.teamKey === room.teamKey);
  if (!team) return null;
  // A member who LEFT a joinable team stays out until they join again. The
  // default room and a never-joined team room let them straight in.
  if (existing && !existing.open && !room.isDefault) return null;
  if (!existing && !autoJoins(team, viewer.kind)) return null;

  const staff = await activeStaff({ client });
  const eligible =
    viewer.kind === "user" ? staff.admins.includes(viewer.id) : staff.reps.includes(viewer.id);
  if (!eligible) return null;

  if (existing) {
    return client.staffRoomMember.update({
      where: { id: existing.id },
      data: { open: true, removedAt: null },
      select: { id: true, open: true },
    });
  }
  return client.staffRoomMember.create({
    data: { roomId, ...memberWhere },
    select: { id: true, open: true },
  });
}
