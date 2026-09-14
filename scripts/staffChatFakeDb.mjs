// scripts/staffChatFakeDb.mjs
//
// The table map for lib/staff/teams.js and lib/staff/store.js, over the
// shared engine in scripts/fakePrisma.mjs, so scripts/check-staff-chat.mjs
// can EXECUTE the membership rule and the unread query rather than grep for
// them.
//
// This file carried a smaller engine of its own — flat equality, no
// relations, no orderBy — which was enough while the check drove only
// teams.js. Driving store.js (a room with its members and messages,
// newest-first, and a grouped count) needed what the company fake already
// had, so both now share fakePrisma.mjs; see there for what is modelled and
// what refuses.
import { makeFakeDb } from "./fakePrisma.mjs";

const SHAPE = {
  tables: ["platformAdmin", "salesRep", "staffRoom", "staffRoomMember", "staffMessage"],
  relations: {
    staffRoom: {
      members: { table: "staffRoomMember", kind: "many", foreignKey: "roomId" },
      messages: { table: "staffMessage", kind: "many", foreignKey: "roomId" },
    },
    staffRoomMember: {
      platformAdmin: { table: "platformAdmin", kind: "one", localKey: "platformAdminId" },
      salesRep: { table: "salesRep", kind: "one", localKey: "salesRepId" },
      room: { table: "staffRoom", kind: "one", localKey: "roomId" },
    },
    staffMessage: {
      authorPlatformAdmin: { table: "platformAdmin", kind: "one", localKey: "authorPlatformAdminId" },
      authorSalesRep: { table: "salesRep", kind: "one", localKey: "authorSalesRepId" },
    },
  },
  uniques: {
    staffRoom: [["teamKey"], ["directKey"], ["slug"]],
    staffRoomMember: [["roomId", "platformAdminId"], ["roomId", "salesRepId"]],
  },
  defaults: {
    staffRoomMember: { open: true, lastSeenAt: null, lastOpenedAt: null, removedAt: null },
    // sentAt is the message's own clock column, filled per insert the way
    // @default(now()) fills it.
    staffMessage: () => ({ kind: "message", mentions: [], meta: null, sentAt: new Date() }),
    staffRoom: { name: null, slug: null, teamKey: null, directKey: null, private: false, isDefault: false, lastMessageAt: null },
  },
  idPrefix: { platformAdmin: "a", salesRep: "r", staffRoom: "room", staffRoomMember: "m", staffMessage: "msg" },
};

/** A fresh database. Pass rows to start with. */
export function fakeDb({ admins = [], reps = [], rooms = [], members = [], messages = [] } = {}) {
  return makeFakeDb(SHAPE, {
    platformAdmin: admins,
    salesRep: reps,
    staffRoom: rooms,
    staffRoomMember: members,
    staffMessage: messages,
  });
}
