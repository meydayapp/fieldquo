// lib/staff/audit.js
//
// The owner reading the staff chat from the console. Read-only, superadmin-
// only, and announced — the rules and the reasons are in auditRules.js; this
// is the part that touches the database, and it is deliberately thin.
//
// ══ Not the store's readers ═══════════════════════════════════════════════
//
// lib/staff/store.js's roomFor() fetches by OPEN MEMBERSHIP, and that is the
// staff chat's whole permission model. This file does not call it and does
// not add a membership row to get past it — the auditor is never a member
// (auditRules.js says why). It reads StaffRoom and StaffMessage directly,
// which is exactly why it must only ever be reached through a route that
// has checked "chat:audit" (app/api/platform/chat/audit/*).
//
// ══ The write comes first ═════════════════════════════════════════════════
//
// The audit row and the system line are written BEFORE the messages are
// read, in one transaction. A read that failed after the record would be a
// recorded look at nothing, which is harmless; a record that failed after
// the read would be an unrecorded look, which is the one thing this file
// exists to prevent.
//
// `client` is injectable on both readers, the way lib/staff/teams.js's are:
// scripts/check-staff-chat.mjs drives the write path against an in-memory
// stand-in, so "every open writes the row and the line, and never a
// membership" is EXECUTED rather than read.
import { db } from "@/lib/db";
import {
  auditorDisplayName,
  auditLineBody,
  needsAuditLine,
  auditPageSize,
  auditParticipants,
  auditRoomRow,
  auditThreadMessages,
} from "./auditRules";

const MEMBER_SELECT = {
  id: true,
  open: true,
  platformAdminId: true,
  salesRepId: true,
  platformAdmin: { select: { email: true, role: true } },
  salesRep: { select: { name: true, email: true } },
};

const MESSAGE_SELECT = {
  id: true,
  body: true,
  kind: true,
  meta: true,
  sentAt: true,
  authorPlatformAdminId: true,
  authorSalesRepId: true,
  authorPlatformAdmin: { select: { email: true } },
  authorSalesRep: { select: { name: true, email: true } },
};

/**
 * Every room there is — channels, groups, DMs — with who is in each and
 * when it last moved. No audit row for the list: it is metadata (that a
 * DM exists between two people, and when), and the row is written when a
 * conversation is OPENED, which is when words are read.
 *
 * @param viewer  the auditor `{ id, email, role }` — unused here beyond
 *   the route having checked them, kept so the signature matches the
 *   thread reader and a future per-list record has its subject.
 */
export async function auditRooms(viewer, { client = db } = {}) {
  if (!viewer?.id) return [];
  const rooms = await client.staffRoom.findMany({
    include: {
      members: { select: MEMBER_SELECT },
      _count: { select: { messages: true } },
    },
    orderBy: [{ lastMessageAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
  });
  return rooms.map(auditRoomRow);
}

/**
 * One room's messages, newest page first, for the auditor.
 *
 * Records the look (PlatformAuditLog `chat_audited`) on every call, and
 * posts the system line the participants see once per look — see
 * auditRules.js for the window. Returns null when the room does not exist.
 *
 * @param before  ISO instant; only messages sent before it (paging back).
 * @param limit   page size, clamped by auditPageSize.
 */
export async function auditRoomMessages(viewer, roomId, { before = null, limit = null, now = new Date(), client = db } = {}) {
  if (!viewer?.id || !roomId) return null;
  const room = await client.staffRoom.findUnique({
    where: { id: roomId },
    include: { members: { select: MEMBER_SELECT }, _count: { select: { messages: true } } },
  });
  if (!room) return null;

  const row = auditRoomRow(room);
  const participants = auditParticipants(room.members);

  // This admin's last audit line here decides whether this is a new look.
  const latest = await client.staffMessage.findFirst({
    where: { roomId: room.id, kind: "system", authorPlatformAdminId: viewer.id },
    orderBy: { sentAt: "desc" },
    select: { sentAt: true },
  });
  const post = needsAuditLine({ latest, now });
  const name = auditorDisplayName(viewer.email);

  const writes = [
    client.platformAuditLog.create({
      data: {
        platformAdminId: viewer.id,
        action: "chat_audited",
        details: {
          roomId: room.id,
          kind: row.kind,
          title: row.title,
          participants: participants.map((p) => ({ kind: p.kind, id: p.id, name: p.name })),
          before: before || null,
          continued: !post,
        },
      },
      select: { id: true },
    }),
  ];
  if (post) {
    writes.push(
      client.staffMessage.create({
        data: {
          roomId: room.id,
          kind: "system",
          body: auditLineBody({ name, at: now }),
          // The facts, so the participants' screens can say it in their
          // own language (app.teamChat.system.audited).
          meta: { system: "audited", name, email: viewer.email, at: now.toISOString() },
          // Authored by the auditor. NOT a membership: StaffMessage's author
          // is a PlatformAdmin foreign key with no membership constraint,
          // and that is the only kind of row this file ever writes for them.
          authorPlatformAdminId: viewer.id,
          sentAt: now,
        },
        select: { id: true },
      }),
    );
  }
  await client.$transaction(writes);

  const take = auditPageSize(limit);
  const cursor = before ? new Date(before) : null;
  const rows = await client.staffMessage.findMany({
    where: {
      roomId: room.id,
      ...(cursor && !Number.isNaN(cursor.getTime()) ? { sentAt: { lt: cursor } } : {}),
    },
    orderBy: { sentAt: "desc" },
    take: take + 1,
    select: MESSAGE_SELECT,
  });
  const hasMore = rows.length > take;
  const page = rows.slice(0, take).reverse();

  return {
    room: row,
    participants,
    messages: auditThreadMessages(page),
    hasMore,
    // The oldest instant on this page, for the next `before`.
    oldestAt: page.length ? page[0].sentAt : null,
    audited: { at: now.toISOString(), announced: post, name },
  };
}
