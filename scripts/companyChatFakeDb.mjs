// scripts/companyChatFakeDb.mjs
//
// The table map for lib/company/chat/store.js, over the shared engine in
// scripts/fakePrisma.mjs, so scripts/check-company-chat.mjs can EXECUTE the
// tenant boundary, the membership rule and the unread query with two
// companies in one fake database rather than grep for them.
//
// The engine was this file's own until the staff check needed the same
// relations, orderBy and groupBy; see fakePrisma.mjs for what it models
// and what it refuses.
import { makeFakeDb } from "./fakePrisma.mjs";

const SHAPE = {
  tables: [
    "company",
    "user",
    "member",
    // Read by lib/team/workerTitles.js for the job title beside a name in
    // the directory and the Members bar. Empty here: no title, nothing
    // printed.
    "worker",
    "job",
    "jobVisit",
    "companyChatRoom",
    "companyChatMember",
    "companyChatMessage",
    "pushSubscription",
  ],
  /** Relations, per table: name → { table, kind, localKey | foreignKey }. */
  relations: {
    member: {
      user: { table: "user", kind: "one", localKey: "userId" },
    },
    job: {
      visits: { table: "jobVisit", kind: "many", foreignKey: "jobId" },
    },
    companyChatRoom: {
      job: { table: "job", kind: "one", localKey: "jobId" },
      members: { table: "companyChatMember", kind: "many", foreignKey: "roomId" },
      messages: { table: "companyChatMessage", kind: "many", foreignKey: "roomId" },
    },
    companyChatMember: {
      member: { table: "member", kind: "one", localKey: "memberId" },
      room: { table: "companyChatRoom", kind: "one", localKey: "roomId" },
    },
    companyChatMessage: {
      author: { table: "member", kind: "one", localKey: "authorMemberId" },
    },
  },
  uniques: {
    companyChatRoom: [["companyId", "key"], ["jobId"]],
    companyChatMember: [["roomId", "memberId"]],
    member: [["userId", "companyId"]],
  },
  defaults: {
    companyChatMember: { open: true, lastSeenAt: null, removedAt: null },
    companyChatMessage: { kind: "message", mentions: [], meta: null },
    companyChatRoom: { name: null, jobId: null, lastMessageAt: null },
  },
};

export function fakeDb(seed = {}) {
  return makeFakeDb(SHAPE, seed);
}
