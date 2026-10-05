// scripts/check-company-chat.mjs
//
//   npm run check:company-chat
//
// A contractor company's own crew chat: #general for the roster, a room per
// active job for the crew booked on it and the office, direct messages —
// on the chat kit, tenant-scoped, read-only for a support session.
//
// ══ Executed, not read ════════════════════════════════════════════════════
//
// Sections 1–6 run the shipped store (lib/company/chat/store.js) against an
// in-memory Prisma stand-in (scripts/companyChatFakeDb.mjs) holding TWO
// companies. The claims that matter are all properties of queries:
//
//   * a member of company A cannot read or post in a room of company B, and
//     the refusal is the same 404 a room that does not exist gets;
//   * everybody active is in #general, and a deactivated member is closed out
//     of it on the next read without a row being deleted;
//   * a job room's membership follows JobVisit.assignedToId — take somebody
//     off the visits and they are closed out, put them back and the same row
//     reopens; the office is in every job room without being booked;
//   * a read-only support session sees every room of the company it is
//     looking at and is refused every write, at the STORE — the second of
//     the two places the rule is enforced;
//   * an @mention pushes to the mentioned member, in their language, and
//     never to the author; a DM pushes to the other side.
//
// None of those can be established by reading the source with any
// confidence, which is the habit AGENTS.md says produced the bugs.
//
// Sections 26–36 (2026-10-04, phases 3–4) run the same way: private chat
// files and the reader-bound, expiring link that opens them; cards resolved
// per reader with no money key for anybody; reply, the 15-minute edit window
// on the server's clock, soft removal absent from EVERY response (the owner's
// and a support session's included), pins, search scoped by membership, the
// outbox replay that stays one message, and Save to job photos.
//
// Sections 7–9 read source DECOMMENTED, for the boundary this file discusses
// at length and would otherwise match in its own prose: the company tables
// are not the staff tables, the routes reach the database only through the
// store, and the nav and the feature registry agree about the row.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { fakeDb } from "./companyChatFakeDb.mjs";
import {
  ensureCompanyRooms,
  syncJobRoom,
  roomsFor,
  roomFor,
  directoryFor,
  membersOf,
  openDirect,
  postMessage,
  markRoomSeen,
  jobRoomIdFor,
  unreadTotalsFor,
  THREAD_TAKE,
  readThread,
  joinableRoomsFor,
  createChannel,
  createGroup,
  updateRoom,
  archiveRoom,
  joinRoom,
  leaveRoom,
  addMembers,
  removeMember,
  updateMySubscription,
  seenBy,
  lastSeenReceipt,
  locateMessage,
  PUSH_CHUNK,
} from "@/lib/company/chat/store";
import { seenUpTo } from "@/lib/chat/unreadQuery";
import {
  CHAT_ROOM_KINDS,
  OFFICE_ROLES,
  ACTIVE_JOB_STATUSES,
  jobRoomKey,
  directRoomKey,
  parseDirectKey,
  memberKey,
  parseMemberKey,
  isActiveJob,
  jobRoomMemberIds,
  membershipDelta,
  unreadFor,
  mentionsFor,
  roomTitle,
  roomListRow,
  roomList,
  groupOf,
  GROUP_ORDER,
  threadMessages,
  canWrite,
  seesAllRooms,
  mayMentionEveryone,
  CREW_GROUP_ORDER,
  groupOrderFor,
  channelRoomKey,
  canCreateChannel,
  canStartGroup,
  canManage,
  canRename,
  canAddMembers,
  canRemoveMembers,
  canArchive,
  canLeave,
  canPost,
  isJoinable,
  notifyVerdict,
  effectiveNotify,
  badgeCounts,
  parseSnooze,
  isHidden,
  seenCount,
  seenCounts,
  MEMBER_PAGE,
} from "@/lib/company/chat/rules";
import { slugify as chatSlugify, validateChannelName as validateChatName } from "@/lib/chat/channelName";
import { hrefFor } from "@/lib/notifications/render";
import { NOTIFICATION_TYPES } from "@/lib/notifications/catalog";
import { parseMentions, mentionsEveryone } from "@/lib/staff/mentions";
import { FEATURES, featureForNavKey } from "@/lib/features/registry";
import { NAV_REQUIREMENTS, navRowAllowed } from "@/lib/permissions/nav";
import { PHONE_BARS, phoneBarFor } from "@/lib/nav/phoneBar";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(cond);
}
const section = (t) => console.log(`\n${t}\n`);

function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const c = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (c === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (c === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      out += c; i++; continue;
    }
    if (state === "line") {
      if (c === "\n") { state = "code"; out += "\n"; i++; continue; }
      out += " "; i++; continue;
    }
    if (c === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
    out += c === "\n" ? "\n" : " ";
    i++;
  }
  return out;
}

// ── Two companies in one database ──────────────────────────────────────────
//
// Company A: Ana (owner), Bob and Cat (crew), Dan (a manager). Company B: Zed
// (owner). Job j1 is scheduled with Bob booked on it; j2 is completed; jB is
// company B's. The two companies share NOTHING but the tables.
function seed() {
  return fakeDb({
    company: [{ id: "A", defaultLanguage: "fr" }, { id: "B", defaultLanguage: "en" }],
    user: [
      { id: "uAna", name: "Ana Owner", email: "ana@a.test", language: null },
      { id: "uBob", name: "Bob Crew", email: "bob@a.test", language: "es" },
      { id: "uCat", name: "Cat Crew", email: "cat@a.test", language: null },
      { id: "uDan", name: "Dan Manager", email: "dan@a.test", language: "en" },
      { id: "uZed", name: "Zed B", email: "zed@b.test", language: null },
    ],
    member: [
      { id: "mAna", userId: "uAna", companyId: "A", role: "owner", active: true },
      { id: "mBob", userId: "uBob", companyId: "A", role: "employee", active: true },
      { id: "mCat", userId: "uCat", companyId: "A", role: "employee", active: true },
      { id: "mDan", userId: "uDan", companyId: "A", role: "supervisor", active: true },
      { id: "mZed", userId: "uZed", companyId: "B", role: "owner", active: true },
    ],
    job: [
      { id: "j1", companyId: "A", title: "Nguyen kitchen", status: "scheduled", archivedAt: null },
      { id: "j2", companyId: "A", title: "Old deck", status: "completed", archivedAt: null },
      { id: "j3", companyId: "A", title: "Not yet dated", status: "unscheduled", archivedAt: null },
      { id: "jB", companyId: "B", title: "B's own job", status: "in_progress", archivedAt: null },
    ],
    jobVisit: [{ id: "v1", jobId: "j1", assignedToId: "uBob" }],
  });
}
const ANA = { id: "mAna", companyId: "A", role: "owner", userId: "uAna" };
const BOB = { id: "mBob", companyId: "A", role: "employee", userId: "uBob" };
const CAT = { id: "mCat", companyId: "A", role: "employee", userId: "uCat" };
const DAN = { id: "mDan", companyId: "A", role: "supervisor", userId: "uDan" };
const ZED = { id: "mZed", companyId: "B", role: "owner", userId: "uZed" };
const SUPPORT = { id: null, userId: null, companyId: "A", role: "viewer", impersonation: true, impersonationMode: "read_only", platformAdminId: "pa1" };

const kinds = (rows) => rows.map((r) => r.kind).sort();
const roomOf = (db, key, companyId = "A") => db.tables.companyChatRoom.find((r) => r.companyId === companyId && r.key === key);
const memberRows = (db, roomId) => db.tables.companyChatMember.filter((m) => m.roomId === roomId);

// ═══════════════════════════════════════════════════════════════════════════
section("1. #general: everybody active is in it, and nobody is deleted from it");

{
  const db = seed();
  const made = await ensureCompanyRooms("A", { client: db });
  const general = roomOf(db, "general");
  ok("ensureCompanyRooms makes one #general for company A", Boolean(general) && made.general === general.id);
  ok("every active member of A holds an OPEN row in it", ["mAna", "mBob", "mCat", "mDan"].every((id) => memberRows(db, general.id).some((m) => m.memberId === id && m.open)));
  ok("nobody from company B is in A's #general", !memberRows(db, general.id).some((m) => m.memberId === "mZed"));
  const before = db.tables.companyChatRoom.length;
  await ensureCompanyRooms("A", { client: db });
  ok("a second read is idempotent — no second #general, no second rows", db.tables.companyChatRoom.length === before && memberRows(db, general.id).length === 4);

  // Cat is deactivated. Her row is CLOSED on the next read, never deleted.
  db.tables.member.find((m) => m.id === "mCat").active = false;
  await ensureCompanyRooms("A", { client: db });
  const cat = memberRows(db, general.id).find((m) => m.memberId === "mCat");
  ok("a deactivated member is closed out of #general (open=false, removedAt set)", cat && cat.open === false && cat.removedAt instanceof Date);
  ok("…and the row still exists — nothing was deleted", memberRows(db, general.id).length === 4);
  ok("a deactivated member no longer sees #general", (await roomsFor(CAT, { client: db })).length === 0);

  // Reactivated: the SAME row reopens.
  db.tables.member.find((m) => m.id === "mCat").active = true;
  await ensureCompanyRooms("A", { client: db });
  const catAgain = memberRows(db, general.id).find((m) => m.memberId === "mCat");
  ok("reactivated: the same row reopens", catAgain && catAgain.id === cat.id && catAgain.open === true && catAgain.removedAt === null);

  // A new hire posts before anybody has re-read the list.
  db.tables.user.push({ id: "uEve", name: "Eve New", email: "eve@a.test" });
  db.tables.member.push({ id: "mEve", userId: "uEve", companyId: "A", role: "employee", active: true });
  const eve = { id: "mEve", companyId: "A", role: "employee", userId: "uEve" };
  const posted = await postMessage({ member: eve, roomId: general.id, body: "hello all" }, { client: db, notify: async () => ({}) });
  ok("a member added this morning can post in #general before the next list read (auto-join)", posted.ok === true);
  ok("…which created their membership row", memberRows(db, general.id).some((m) => m.memberId === "mEve" && m.open));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Job rooms: one per ACTIVE job, membership follows the visits");

{
  const db = seed();
  await ensureCompanyRooms("A", { client: db });
  const j1 = roomOf(db, jobRoomKey("j1"));
  ok("a scheduled job gets a room named after it", j1 && j1.kind === "job" && j1.name === "Nguyen kitchen" && j1.jobId === "j1");
  ok("a completed job gets NO room", !roomOf(db, jobRoomKey("j2")));
  ok("an unscheduled job gets NO room — nobody is booked on it yet", !roomOf(db, jobRoomKey("j3")));
  ok("company B's job gets no room in A", !roomOf(db, jobRoomKey("jB")));
  const ids = memberRows(db, j1.id).filter((m) => m.open).map((m) => m.memberId).sort();
  ok("its members are the booked crew (Bob) plus the office (Ana, Dan) — not Cat", JSON.stringify(ids) === JSON.stringify(["mAna", "mBob", "mDan"]), ids);
  ok("Bob sees #general and the job room", JSON.stringify(kinds(await roomsFor(BOB, { client: db }))) === JSON.stringify(["general", "job"]));
  ok("Cat sees only #general", JSON.stringify(kinds(await roomsFor(CAT, { client: db }))) === JSON.stringify(["general"]));
  ok("Cat cannot read the job room by id", (await roomFor(CAT, j1.id, { client: db })) === null);
  const catPost = await postMessage({ member: CAT, roomId: j1.id, body: "hi" }, { client: db, notify: async () => ({}) });
  ok("Cat cannot post in it — refused 404 no_room, the same as a room that does not exist", catPost.ok === false && catPost.status === 404 && catPost.code === "no_room");

  // The office is in it without being booked.
  ok("Dan (manager) is in the job room without a visit", (await roomFor(DAN, j1.id, { client: db })) !== null);

  // Reassign the visit from Bob to Cat.
  db.tables.jobVisit[0].assignedToId = "uCat";
  await ensureCompanyRooms("A", { client: db });
  const bobRow = memberRows(db, j1.id).find((m) => m.memberId === "mBob");
  ok("Bob taken off the visit is CLOSED out of the room (row kept)", bobRow && bobRow.open === false && bobRow.removedAt instanceof Date);
  ok("Cat booked on the visit is now in the room", memberRows(db, j1.id).some((m) => m.memberId === "mCat" && m.open));
  ok("Bob no longer sees the job room", JSON.stringify(kinds(await roomsFor(BOB, { client: db }))) === JSON.stringify(["general"]));
  ok("Bob is refused when he posts in it now", (await postMessage({ member: BOB, roomId: j1.id, body: "still here?" }, { client: db, notify: async () => ({}) })).code === "no_room");

  // Back to Bob: the same row reopens.
  db.tables.jobVisit[0].assignedToId = "uBob";
  await ensureCompanyRooms("A", { client: db });
  const bobAgain = memberRows(db, j1.id).find((m) => m.memberId === "mBob");
  ok("Bob put back on the visit: the SAME row reopens", bobAgain && bobAgain.id === bobRow.id && bobAgain.open === true && bobAgain.removedAt === null);

  // The write-path hook: a job that just became scheduled gets its room now.
  db.tables.job.find((j) => j.id === "j3").status = "scheduled";
  db.tables.jobVisit.push({ id: "v3", jobId: "j3", assignedToId: "uCat" });
  const synced = await syncJobRoom("A", "j3", { client: db });
  ok("syncJobRoom makes the room for a job that just became scheduled", Boolean(synced) && roomOf(db, jobRoomKey("j3"))?.id === synced);
  ok("…with the crew booked on it", memberRows(db, synced).some((m) => m.memberId === "mCat" && m.open));
  ok("syncJobRoom refuses a job of ANOTHER company (returns null, makes nothing)", (await syncJobRoom("A", "jB", { client: db })) === null && !roomOf(db, jobRoomKey("jB")));
  ok("syncJobRoom makes nothing for a completed job", (await syncJobRoom("A", "j2", { client: db })) === null && !roomOf(db, jobRoomKey("j2")));

  // A renamed job renames its room on the next read.
  db.tables.job.find((j) => j.id === "j1").title = "Nguyen kitchen — phase 2";
  await ensureCompanyRooms("A", { client: db });
  ok("a renamed job renames its room", roomOf(db, jobRoomKey("j1")).name === "Nguyen kitchen — phase 2");

  // A job that finishes keeps its room and its history, listed as finished.
  await postMessage({ member: ANA, roomId: j1.id, body: "all done, thanks" }, { client: db, notify: async () => ({}) });
  db.tables.job.find((j) => j.id === "j1").status = "completed";
  await ensureCompanyRooms("A", { client: db });
  const listed = roomList(await roomsFor(ANA, { client: db }), "mAna");
  const finished = listed.find((r) => r.jobId === "j1");
  ok("a finished job's room is KEPT, with its messages, and listed as inactive", finished && finished.active === false && finished.lastBody === "all done, thanks");
  ok("…under the 'finished' group", groupOf(finished) === "finished");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2b. A published SHIFT on a job puts its worker in the room — a draft does not");
//
// The live test, 2026-10-04: a shift linked to a job sent the crew member
// there on My schedule while the job's chat left them out. The room now
// follows the same two facts assignedJobWhere reads: a visit, or a published
// shift inside its window (lib/permissions/enforce.js shiftWindowWhere).
{
  const DAY = 86400000;
  const db = seed();
  db.tables.worker.push({ id: "wCat", companyId: "A", userId: "uCat", name: "Cat Crew" });
  const shift = { id: "s1", companyId: "A", workerId: "wCat", jobId: "j1", published: false, start: new Date(Date.now() + DAY), end: new Date(Date.now() + DAY + 8 * 3600000) };
  db.tables.shift.push(shift);
  await ensureCompanyRooms("A", { client: db });
  const j1 = roomOf(db, jobRoomKey("j1"));
  ok("a DRAFT shift does not put Cat in the job room", !memberRows(db, j1.id).some((m) => m.memberId === "mCat" && m.open));
  shift.published = true;
  await syncJobRoom("A", "j1", { client: db });
  ok("published, it does — Cat is in the room", memberRows(db, j1.id).some((m) => m.memberId === "mCat" && m.open));
  ok("…and sees it in her list", JSON.stringify(kinds(await roomsFor(CAT, { client: db }))) === JSON.stringify(["general", "job"]));
  ok("…and Bob (on the visit) is still in it", memberRows(db, j1.id).some((m) => m.memberId === "mBob" && m.open));
  shift.start = new Date(Date.now() - 15 * DAY - 8 * 3600000);
  shift.end = new Date(Date.now() - 15 * DAY);
  await ensureCompanyRooms("A", { client: db });
  ok("a shift that ended 15 days ago no longer holds her in it (closed, row kept)", memberRows(db, j1.id).some((m) => m.memberId === "mCat" && m.open === false));
  shift.end = new Date(Date.now() + DAY);
  shift.workerId = null;
  await ensureCompanyRooms("A", { client: db });
  ok("an OPEN shift (no worker) puts nobody in", !memberRows(db, j1.id).some((m) => m.memberId === "mCat" && m.open));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. Tenant isolation, executed: company B cannot reach company A");

{
  const db = seed();
  await ensureCompanyRooms("A", { client: db });
  await ensureCompanyRooms("B", { client: db });
  const generalA = roomOf(db, "general", "A");
  const generalB = roomOf(db, "general", "B");
  const j1 = roomOf(db, jobRoomKey("j1"));
  ok("each company has its own #general", generalA && generalB && generalA.id !== generalB.id);
  ok("Zed (B) sees only B's rooms", (await roomsFor(ZED, { client: db })).every((r) => r.companyId === "B"));
  ok("Zed cannot read A's #general by id", (await roomFor(ZED, generalA.id, { client: db })) === null);
  ok("Zed cannot read A's job room by id", (await roomFor(ZED, j1.id, { client: db })) === null);
  const zedPost = await postMessage({ member: ZED, roomId: generalA.id, body: "hello A" }, { client: db, notify: async () => ({}) });
  ok("Zed cannot post in A's #general — 404 no_room, indistinguishable from a missing room", zedPost.ok === false && zedPost.status === 404 && zedPost.code === "no_room");
  ok("…and no message row was written for A", !db.tables.companyChatMessage.some((m) => m.companyId === "A" && m.body === "hello A"));
  ok("Zed cannot see A's members bar", (await membersOf(ZED, j1.id, { client: db })) === null);
  ok("Zed cannot mark A's room seen", (await markRoomSeen(ZED, generalA.id, { client: db })) === false);
  const dir = await directoryFor(ZED, { client: db });
  ok("B's directory lists B's people and none of A's", dir.length === 1 && dir[0].id === "mZed");
  const cross = await openDirect(ZED, "mAna", { client: db });
  ok("Zed cannot open a DM with somebody in A — refused member_unknown", cross.ok === false && cross.code === "member_unknown");
  ok("…and no cross-company room was made", !db.tables.companyChatRoom.some((r) => r.key === directRoomKey("mZed", "mAna")));

  // A forged companyId on the member object does not help: the membership
  // query still keys off the member's OWN id, which holds no row in A.
  const forged = { ...ZED, companyId: "A" };
  ok("a member object claiming company A but holding no membership there reads nothing", (await roomsFor(forged, { client: db })).length === 0);
  ok("…and cannot post", (await postMessage({ member: forged, roomId: generalA.id, body: "x" }, { client: db, notify: async () => ({}) })).code === "no_room");
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. Direct messages: one room per pair, same company only");

{
  const db = seed();
  await ensureCompanyRooms("A", { client: db });
  const a = await openDirect(ANA, "mBob", { client: db });
  const b = await openDirect(BOB, "mAna", { client: db });
  ok("opening a DM from either side gives ONE room", a.ok && b.ok && a.roomId === b.roomId);
  const dm = db.tables.companyChatRoom.find((r) => r.id === a.roomId);
  ok("it is a dm room keyed on the sorted pair", dm.kind === "dm" && dm.key === directRoomKey("mAna", "mBob") && dm.key === "dm:mAna|mBob");
  ok("both members hold a row; nobody else", memberRows(db, dm.id).map((m) => m.memberId).sort().join() === "mAna,mBob");
  ok("Cat cannot read it", (await roomFor(CAT, dm.id, { client: db })) === null);
  const self = await openDirect(ANA, "mAna", { client: db });
  ok("a DM with yourself is refused", self.ok === false && self.code === "self");
  db.tables.member.find((m) => m.id === "mCat").active = false;
  const gone = await openDirect(ANA, "mCat", { client: db });
  ok("a DM with a deactivated member is refused member_unknown", gone.ok === false && gone.code === "member_unknown");
  ok("roomTitle names a DM for the OTHER side", roomTitle(await roomFor(ANA, dm.id, { client: db }), "mAna").name === "Bob Crew");
  ok("…and from Bob's side, Ana", roomTitle(await roomFor(BOB, dm.id, { client: db }), "mBob").name === "Ana Owner");

  // The unique index is the race guard: a second create with the same key
  // throws P2002 in the fake as in Postgres, and openDirect reads back the
  // winner rather than failing.
  const raced = await openDirect(BOB, "mAna", { client: db });
  ok("a repeat open never makes a second room", raced.roomId === dm.id && db.tables.companyChatRoom.filter((r) => r.kind === "dm").length === 1);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Read-only support session: sees everything, writes nothing");

{
  const db = seed();
  await ensureCompanyRooms("A", { client: db });
  const dm = (await openDirect(ANA, "mBob", { client: db })).roomId;
  await postMessage({ member: ANA, roomId: dm, body: "private word" }, { client: db, notify: async () => ({}) });
  ok("canWrite is false for a read-only impersonation", canWrite(SUPPORT) === false);
  ok("seesAllRooms is true for it", seesAllRooms(SUPPORT) === true);
  ok("a demo sandbox (a real member of a FieldQuo-owned fixture) may write", canWrite({ ...ANA, impersonation: true, impersonationMode: "demo_sandbox" }) === true && seesAllRooms({ ...ANA, impersonation: true, impersonationMode: "demo_sandbox" }) === false);
  const seen = await roomsFor(SUPPORT, { client: db });
  ok("support reads every room of company A, the DM included (the console views everything)", seen.length === 3 && seen.some((r) => r.id === dm));
  ok("support reads only company A's rooms — never B's", seen.every((r) => r.companyId === "A"));
  const general = roomOf(db, "general");
  const rowsBefore = db.tables.companyChatMessage.length;
  const post = await postMessage({ member: SUPPORT, roomId: general.id, body: "from support" }, { client: db, notify: async () => ({}) });
  ok("support posting is refused 403 read_only", post.ok === false && post.status === 403 && post.code === "read_only");
  ok("…and no row was written", db.tables.companyChatMessage.length === rowsBefore);
  const dmTry = await openDirect(SUPPORT, "mBob", { client: db });
  ok("support cannot open a DM", dmTry.ok === false && dmTry.status === 403);
  ok("support cannot stamp lastSeenAt — it leaves no trace on the tenant", (await markRoomSeen(SUPPORT, general.id, { client: db })) === false);
  ok("a member with no id cannot write either", canWrite({ id: null, companyId: "A" }) === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Mentions and DMs notify the right people, in their language");

{
  const db = seed();
  await ensureCompanyRooms("A", { client: db });
  const j1 = roomOf(db, jobRoomKey("j1"));
  const calls = [];
  const notify = async (args) => { calls.push(args); return { sent: 1 }; };

  const posted = await postMessage({ member: ANA, roomId: j1.id, body: "@Bob Crew start at 8, @Dan Manager bring the ladder" }, { client: db, notify });
  ok("the message stores the mentioned members' keys", posted.ok && JSON.stringify([...posted.message.mentions].sort()) === JSON.stringify(["member:mBob", "member:mDan"]));
  ok("ONE push call for the mention", calls.length === 1 && calls[0].userIds.length === 2);
  ok("…to Bob's and Dan's USER ids, not the author's", JSON.stringify([...calls[0].userIds].sort()) === JSON.stringify(["uBob", "uDan"]));
  ok("…with the company's default language as the fallback", calls[0].fallbackLanguage === "fr");
  const es = await calls[0].payload("es");
  ok("the title is the catalogue sentence in the recipient's language (Spanish for Bob)", es.title === "Ana Owner te mencionó en #Nguyen kitchen", es.title);
  const fr = await calls[0].payload("fr");
  ok("…and French for a member with no language of their own", fr.title === APP_MESSAGES.fr["app.notify.mention.title"].replace("{name}", "Ana Owner").replace("{room}", "#Nguyen kitchen"));
  ok("the push carries the room's URL and a tag shared with the screen's own notify()", es.url === `/app/chat?room=${j1.id}` && es.tag === `company-chat:${j1.id}`);
  ok("the body is the message, not the room", es.body.startsWith("@Bob Crew start at 8"));

  calls.length = 0;
  await postMessage({ member: ANA, roomId: j1.id, body: "nothing for anybody" }, { client: db, notify });
  ok("a message with no mention pushes to nobody", calls.length === 0);

  calls.length = 0;
  await postMessage({ member: ANA, roomId: j1.id, body: "@Cat Crew are you there?" }, { client: db, notify });
  ok("naming somebody NOT in the room is not a mention and pushes to nobody", calls.length === 0);

  calls.length = 0;
  await postMessage({ member: BOB, roomId: j1.id, body: "@Bob Crew talking to myself" }, { client: db, notify });
  ok("mentioning yourself pushes to nobody", calls.length === 0);

  calls.length = 0;
  await postMessage({ member: DAN, roomId: j1.id, body: "@all lunch at noon" }, { client: db, notify });
  ok("@all reaches everybody in the room but the author", calls.length === 1 && JSON.stringify([...calls[0].userIds].sort()) === JSON.stringify(["uAna", "uBob"]));

  calls.length = 0;
  const dm = (await openDirect(ANA, "mBob", { client: db })).roomId;
  await postMessage({ member: ANA, roomId: dm, body: "can you start early?" }, { client: db, notify });
  ok("a DM pushes to the other side, once", calls.length === 1 && JSON.stringify(calls[0].userIds) === JSON.stringify(["uBob"]));
  const dmTitle = await calls[0].payload("en");
  ok("…as 'New message from Ana Owner'", dmTitle.title === "New message from Ana Owner", dmTitle.title);

  calls.length = 0;
  await postMessage({ member: ANA, roomId: dm, body: "@Bob Crew ping" }, { client: db, notify });
  ok("a mention inside a DM is told once, as a DM, not twice", calls.length === 1 && calls[0].userIds.length === 1);

  // The list's own counts, which the screen's in-tab notify() compares.
  const bobList = roomList(await roomsFor(BOB, { client: db }), "mBob");
  const bobJob = bobList.find((r) => r.id === j1.id);
  // Bob's own post stamped his lastSeenAt; only Dan's @all came after it.
  ok("Bob's list shows the job room unread with his mentions counted separately", bobJob.unread === 1 && bobJob.mentions === 1, [bobJob.unread, bobJob.mentions]);
  ok("unread rooms sort first", bobList[0].unread > 0);
  // Opening is the thread read, marked seen up to the last message IT
  // showed — what the route does (section 10 has the whole argument).
  const bobThread = await roomFor(BOB, j1.id, { client: db });
  await markRoomSeen(BOB, j1.id, { client: db, upTo: seenUpTo(bobThread.messages, "createdAt") });
  const after = roomList(await roomsFor(BOB, { client: db }), "mBob").find((r) => r.id === j1.id);
  ok("opening the room clears both counts", after.unread === 0 && after.mentions === 0);
  ok("…and stamped the last message's own time, not the clock", memberRows(db, j1.id).find((m) => m.memberId === "mBob").lastSeenAt.getTime() === new Date(bobThread.messages.at(-1).createdAt).getTime());
  const anaJob = roomList(await roomsFor(ANA, { client: db }), "mAna").find((r) => r.id === j1.id);
  // After Ana's last post: Bob's note to himself and Dan's @all.
  ok("the author's own messages never count as unread for them", anaJob.unread === 2 && anaJob.mentions === 1 && anaJob.lastWasMine === false, [anaJob.unread, anaJob.mentions]);
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Unread is a COUNT, the thread is the NEWEST, and seen is the last message shown");
// ═══════════════════════════════════════════════════════════════════════════
//
// The same three causes as scripts/check-staff-chat.mjs section 10, on the
// crew's chat: the list counted unread over each room's OLDEST 200 rows, the
// thread read its oldest 500, and the read was stamped "now". Executed here
// with 250 messages in #general, seen at #240.

{
  const db = seed();
  await ensureCompanyRooms("A", { client: db });
  const general = roomOf(db, "general");
  const t0 = new Date("2026-09-14T09:00:00Z");
  const at = (i) => new Date(t0.getTime() + i * 1000);
  // Even numbers are Ana's, odd Bob's own; #244 is a system line; #246 and
  // #248 say Bob's name.
  for (let i = 1; i <= 250; i++) {
    db.tables.companyChatMessage.push({
      id: `g${i}`,
      companyId: "A",
      roomId: general.id,
      kind: i === 244 ? "system" : "message",
      body: `message ${i}`,
      meta: i === 244 ? { system: "joined" } : null,
      mentions: i === 246 || i === 248 ? ["member:mBob"] : [],
      createdAt: at(i),
      authorMemberId: i === 244 ? null : i % 2 === 0 ? "mAna" : "mBob",
    });
  }
  const bobRow = memberRows(db, general.id).find((m) => m.memberId === "mBob");
  bobRow.lastSeenAt = at(240);

  // ── 1. The count ───────────────────────────────────────────────────────
  const rooms = await roomsFor(BOB, { client: db });
  const gen = rooms.find((r) => r.id === general.id);
  const all = db.tables.companyChatMessage.filter((m) => m.roomId === general.id);
  ok("the list counts unread with a QUERY over every message: seen at #240 of 250 → Ana's #242, #246, #248, #250", gen?.unread === 4, gen?.unread);
  ok("…the old oldest-200 slice would have said zero", unreadFor({ messages: [...all].sort((a, b) => a.createdAt - b.createdAt).slice(0, 200), lastSeenAt: at(240), memberId: "mBob" }) === 0);
  ok("…and the rule over ALL the rows agrees with the query", unreadFor({ messages: all, lastSeenAt: at(240), memberId: "mBob" }) === gen?.unread);
  ok("mentions after the boundary are counted apart: two", gen?.mentions === 2 && mentionsFor({ messages: all, lastSeenAt: at(240), memberId: "mBob" }) === 2, gen?.mentions);
  ok("the listed room carries ONE preview row, the last thing somebody said", gen?.messages?.length === 1 && gen.messages[0].id === "g250");
  const row = roomList(rooms, "mBob").find((r) => r.id === general.id);
  ok("…and the row reads the store's counts, not a count over that one row", row.unread === 4 && row.mentions === 2 && row.lastBody === "message 250", [row.unread, row.mentions]);
  ok("Ana, never having opened it, has Bob's 125", (await roomsFor(ANA, { client: db })).find((r) => r.id === general.id)?.unread === 125);
  ok("the count is scoped to the company — Zed's list has none of it", (await roomsFor(ZED, { client: db })).every((r) => r.unread === 0));

  // ── 2. The thread is the newest, oldest-first ──────────────────────────
  for (let i = 251; i <= 700; i++) db.tables.companyChatMessage.push({ id: `g${i}`, companyId: "A", roomId: general.id, kind: "message", body: `message ${i}`, mentions: [], meta: null, createdAt: at(i), authorMemberId: "mAna" });
  const long = await roomFor(BOB, general.id, { client: db });
  ok(`a 700-message room reads as its last ${THREAD_TAKE}: #201–#700, oldest first`, long.messages.length === THREAD_TAKE && long.messages[0].id === "g201" && long.messages.at(-1).id === "g700", [long.messages.length, long.messages[0]?.id, long.messages.at(-1)?.id]);

  // ── 3. Seen is the last message SHOWN, and only ever moves forward ─────
  const upTo = seenUpTo(long.messages, "createdAt");
  ok("seenUpTo is the last message's own timestamp", upTo?.getTime() === at(700).getTime());
  ok("markRoomSeen stamps it", (await markRoomSeen(BOB, general.id, { client: db, upTo })) === true && bobRow.lastSeenAt.getTime() === at(700).getTime());
  ok("…so the room is clear", (await roomsFor(BOB, { client: db })).find((r) => r.id === general.id)?.unread === 0);
  db.tables.companyChatMessage.push({ id: "late", companyId: "A", roomId: general.id, kind: "message", body: "landed during the read", mentions: [], meta: null, createdAt: at(701), authorMemberId: "mAna" });
  ok("a message that landed during the read is still unread", (await roomsFor(BOB, { client: db })).find((r) => r.id === general.id)?.unread === 1);
  await markRoomSeen(BOB, general.id, { client: db, upTo: at(650) });
  ok("an older stamp from another tab does not move lastSeenAt BACK", bobRow.lastSeenAt.getTime() === at(700).getTime());
  ok("no payload, no stamp — and still 'yes, you are a member'", (await markRoomSeen(BOB, general.id, { client: db })) === true && bobRow.lastSeenAt.getTime() === at(700).getTime());
  ok("a support session still stamps nothing", (await markRoomSeen(SUPPORT, general.id, { client: db, upTo })) === false);

  // The thread route hands the read to the store's readThread (2026-10-04,
  // so the check can execute the payload); the stamp is still the last
  // message IN THE PAYLOAD.
  const route = decomment(read("app/api/chat/rooms/[id]/route.js"));
  const storeSrc = decomment(read("lib/company/chat/store.js"));
  ok("the thread route marks seen up to the last message IN ITS PAYLOAD", /readThread\(member, id, \{ after, changedSince \}\)/.test(route) && /markRoomSeen\(member, room\.id, \{ upTo: seenUpTo\(room\.messages, "createdAt"\), client \}\)/.test(storeSrc));
  const store = decomment(read("lib/company/chat/store.js"));
  ok("the store's list include is ONE preview row, not a slice of 200", /take: 1,/.test(store) && !/take: 200/.test(store));
  ok("…the thread reads newest-first and reverses", /orderBy: \{ createdAt: "desc" \}, take: THREAD_TAKE/.test(store) && /\.reverse\(\)/.test(store));
  ok("…the counts are grouped counts scoped to the company", /companyChatMessage\.groupBy\(countByRoomArgs\(\{ AND: \[scope, /.test(store) && !/unreadFor\(/.test(store));
  ok("…and the read boundary only moves forward, in one statement", /OR: \[\{ lastSeenAt: null \}, \{ lastSeenAt: \{ lt: seen \} \}\]/.test(store));

  const screen = decomment(read("app/components/company/CompanyChat.js"));
  ok("the screen re-reads the list and announces after the OPEN's room read", /const afterSeen = useCallback\(\(\) => \{\s*loadList\(\);\s*announceBadgesChanged\(\);/.test(screen) && /loadRoom\(openId\)\.then\(\(ok\) => \{\s*if \(ok\) afterSeen\(\);/.test(screen));
  // A send now re-reads the room as a DELTA (pollRoom, ?after=) — the
  // message comes back with its id and time — and then the list follows.
  ok("…after a send", /await pollRoom\(openId\);[\s\S]{0,200}afterSeen\(\);/.test(screen));
  ok("…and after each 4-second poll that brought something new", /const fresh = await pollRoom\(openId\);\s*if \(fresh\) afterSeen\(\);/.test(screen));
  ok("…and on coming back to the tab with a room open", /addEventListener\("visibilitychange", wake\)/.test(screen) && /addEventListener\("focus", wake\)/.test(screen) && /removeEventListener\("focus", wake\)/.test(screen));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The pure rules, driven directly");

{
  ok("five kinds, named once — channels and groups since 2026-10-04", JSON.stringify(CHAT_ROOM_KINDS) === JSON.stringify(["general", "job", "dm", "channel", "group"]));
  ok("the office is owner, admin, supervisor", JSON.stringify(OFFICE_ROLES) === JSON.stringify(["owner", "admin", "supervisor"]));
  ok("active is scheduled or in_progress", JSON.stringify(ACTIVE_JOB_STATUSES) === JSON.stringify(["scheduled", "in_progress"]));
  ok("an archived job is not active whatever its status", isActiveJob({ status: "in_progress", archivedAt: new Date() }) === false);
  ok("directRoomKey is sorted and refuses a pair with itself", directRoomKey("b", "a") === "dm:a|b" && directRoomKey("a", "a") === null && directRoomKey("", "a") === null);
  ok("parseDirectKey is the inverse", JSON.stringify(parseDirectKey("dm:a|b")) === JSON.stringify(["a", "b"]) && parseDirectKey("general") === null);
  ok("memberKey / parseMemberKey round-trip", parseMemberKey(memberKey("m1")) === "m1" && parseMemberKey("user:x") === null);
  const roster = [
    { id: "o", userId: "uo", role: "owner" },
    { id: "s", userId: "us", role: "supervisor" },
    { id: "e1", userId: "ue1", role: "employee" },
    { id: "e2", userId: "ue2", role: "employee" },
  ];
  ok("jobRoomMemberIds: office + booked crew, each once, nobody unbooked", JSON.stringify(jobRoomMemberIds({ visits: [{ assignedToId: "ue2" }, { assignedToId: "ue2" }, { assignedToId: null }] }, roster)) === JSON.stringify(["o", "s", "e2"]));
  ok("jobRoomMemberIds with no visits is the office alone", JSON.stringify(jobRoomMemberIds({ visits: [] }, roster)) === JSON.stringify(["o", "s"]));
  ok("jobRoomMemberIds ignores a booked user who is not on the roster", !jobRoomMemberIds({ visits: [{ assignedToId: "stranger" }] }, roster).includes("stranger"));
  ok("jobRoomMemberIds counts a shift's worker as booked", JSON.stringify(jobRoomMemberIds({ visits: [], shifts: [{ worker: { userId: "ue1" } }, { worker: null }] }, roster)) === JSON.stringify(["o", "s", "e1"]));
  const delta = membershipDelta(["a", "b", "c"], [{ memberId: "a", open: true }, { memberId: "b", open: false }, { memberId: "d", open: true }, { memberId: "e", open: false }]);
  ok("membershipDelta: create the new, reopen the closed, close the departed, leave the rest", JSON.stringify(delta) === JSON.stringify({ create: ["c"], reopen: ["b"], close: ["d"] }), delta);
  const msgs = [
    { kind: "message", authorMemberId: "me", createdAt: "2026-09-12T10:00:00Z", mentions: ["member:me"] },
    { kind: "message", authorMemberId: "her", createdAt: "2026-09-12T10:01:00Z", mentions: ["member:me"] },
    { kind: "system", authorMemberId: null, createdAt: "2026-09-12T10:02:00Z", mentions: [] },
    { kind: "message", authorMemberId: "her", createdAt: "2026-09-12T09:00:00Z", mentions: [] },
  ];
  ok("unreadFor: not mine, not system, after lastSeenAt", unreadFor({ messages: msgs, lastSeenAt: "2026-09-12T09:30:00Z", memberId: "me" }) === 1);
  ok("unreadFor with no lastSeenAt counts everything from others", unreadFor({ messages: msgs, lastSeenAt: null, memberId: "me" }) === 2);
  ok("mentionsFor never counts my own @me", mentionsFor({ messages: msgs, lastSeenAt: null, memberId: "me" }) === 1);
  ok("roomTitle for a DM with nobody else says so rather than naming the viewer", roomTitle({ kind: "dm", members: [{ memberId: "me", member: { user: { name: "Me" } } }] }, "me").missing === true);
  ok("roomTitle for a job room is its name", roomTitle({ kind: "job", name: "Deck" }, "me").name === "Deck");
  const row = roomListRow({ id: "r", kind: "job", jobId: "j", job: { status: "scheduled" }, members: [{ memberId: "me", open: true, lastSeenAt: null }, { memberId: "her", open: true }, { memberId: "gone", open: false }], messages: msgs.map((m) => ({ ...m, body: "b", author: { user: { name: "Her" } } })) }, "me");
  ok("roomListRow: memberCount counts open rows only; lastWho names the author", row.memberCount === 2 && row.lastWho === "Her" && row.active === true);
  ok("the office's group order is unread, starred, channels, jobs, direct, finished, archived", JSON.stringify(GROUP_ORDER) === JSON.stringify(["unread", "starred", "channel", "job", "direct", "finished", "archived"]));
  ok("…the crew read their jobs before the channels", JSON.stringify(groupOrderFor("employee")) === JSON.stringify(["unread", "starred", "job", "channel", "direct", "finished", "archived"]) && groupOrderFor("supervisor") === GROUP_ORDER);
  ok("#general and channels share the Channels group; a group sits with the DMs", groupOf({ kind: "general" }) === "channel" && groupOf({ kind: "channel" }) === "channel" && groupOf({ kind: "group" }) === "direct");
  ok("an archived channel is Archived even when unread; a starred room is Starred", groupOf({ kind: "channel", archived: true, unread: 3 }, { unreadOnTop: true }) === "archived" && groupOf({ kind: "dm", starred: true }) === "starred");
  ok("a MUTED room's unread does not jump to Unread; its mention does", groupOf({ kind: "channel", unread: 4, muted: true, notifyLevel: "mentions" }, { unreadOnTop: true }) === "channel" && groupOf({ kind: "channel", unread: 4, mentions: 1, muted: true, notifyLevel: "mentions" }, { unreadOnTop: true }) === "unread");
  ok("groupOf puts an unread DM on top when asked, under direct otherwise", groupOf({ kind: "dm", unread: 1 }, { unreadOnTop: true }) === "unread" && groupOf({ kind: "dm", unread: 1 }) === "direct");
  const thread = threadMessages([{ id: "1", body: "x", createdAt: "2026-09-12T10:00:00Z", authorMemberId: "me", mentions: ["member:me"], author: { user: { name: "Me" } } }, { id: "2", body: "y", createdAt: "2026-09-12T10:01:00Z", authorMemberId: null, mentions: [], kind: "system" }], "me");
  ok("threadMessages: mine is 'out', a system row keeps kind system, a departed author has no name invented", thread[0].direction === "out" && thread[0].mentionsMe === true && thread[1].kind === "system" && thread[1].who === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. The boundary, in the source (decommented)");

{
  const schema = read("prisma/schema.prisma");
  const model = (name) => {
    const m = new RegExp(`^model ${name} \\{([\\s\\S]*?)^\\}`, "m").exec(schema);
    return m ? m[1] : "";
  };
  for (const name of ["CompanyChatRoom", "CompanyChatMember", "CompanyChatMessage"]) {
    const body = model(name);
    ok(`${name} exists`, body.length > 0);
    ok(`${name} carries companyId with cascade on Company`, /companyId\s+String/.test(body) && /onDelete: Cascade/.test(body));
    ok(`${name} references neither PlatformAdmin nor SalesRep — the staff tables stay out`, !/PlatformAdmin|SalesRep/.test(body));
  }
  ok("CompanyChatRoom is unique on (companyId, key)", /@@unique\(\[companyId, key\]\)/.test(model("CompanyChatRoom")));
  ok("CompanyChatMember is unique on (roomId, memberId)", /@@unique\(\[roomId, memberId\]\)/.test(model("CompanyChatMember")));
  ok("CompanyChatMessage's author is a Member with SetNull — a departed author's words stay", /authorMemberId\s+String\?/.test(model("CompanyChatMessage")) && /onDelete: SetNull/.test(model("CompanyChatMessage")));
  ok("StaffRoom has gained no company column", !/companyId|memberId/.test(model("StaffRoom") + model("StaffRoomMember") + model("StaffMessage")));

  const store = decomment(read("lib/company/chat/store.js"));
  ok("the store never touches a staff table", !/staffRoom|staffMessage|staffRoomMember/.test(store));
  ok("the store never touches Prisma without the injectable client", !/\bdb\.(companyChat|member|job|company)\b/.test(store));
  for (const route of [
    "app/api/chat/rooms/route.js",
    "app/api/chat/rooms/[id]/route.js",
    "app/api/chat/rooms/[id]/members/route.js",
    "app/api/chat/rooms/[id]/members/[memberId]/route.js",
    "app/api/chat/rooms/[id]/archive/route.js",
    "app/api/chat/rooms/[id]/join/route.js",
    "app/api/chat/rooms/[id]/leave/route.js",
    "app/api/chat/rooms/[id]/me/route.js",
    "app/api/chat/rooms/[id]/seen/route.js",
    "app/api/chat/messages/[id]/route.js",
    "app/api/chat/directory/route.js",
    "app/api/chat/unread/route.js",
  ]) {
    const src = decomment(read(route));
    ok(`${route} reaches the database only through the store (no db. call of its own)`, !/\bdb\s*\./.test(src) && !/@\/lib\/db/.test(src));
    ok(`${route} resolves its member through memberOrRefusal`, /memberOrRefusal\(/.test(src));
  }
  const idRoute = decomment(read("app/api/chat/rooms/[id]/route.js"));
  ok("the thread route awaits params (Next 16)", /await params/.test(idRoute));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The row, the tab, the gate and the catalogue agree");

{
  const feature = FEATURES.find((f) => f.key === "team_chat");
  ok("team_chat is in the feature registry", Boolean(feature));
  ok("…gating /app/chat and /api/chat", feature && feature.routePrefixes.includes("/app/chat") && feature.apiPrefixes.includes("/api/chat"));
  ok("…and the nav row maps back to it", featureForNavKey("app.nav.chat") === "team_chat");
  ok("app/app/chat/layout.js mounts <FeatureGate feature=\"team_chat\">", /<FeatureGate[^>]*feature=["']team_chat["']/.test(read("app/app/chat/layout.js")));
  const sidebar = decomment(read("app/components/layout/AdminSidebar.js"));
  ok("AdminSidebar has the Chat row at /app/chat", /"app\.nav\.chat"[^}]*href:\s*"\/app\/chat"/.test(sidebar));
  // The bar is per role since 2026-10-03 (lib/nav/phoneBar.js), so this is
  // executed against every set rather than read off one array's text.
  ok("every phone bar set — the crew's included — has the Chat tab at /app/chat",
    Object.values(PHONE_BARS).every((set) => set.some((row) => row.key === "app.nav.chat" && row.href === "/app/chat")));
  ok("…and it survives the Crew preset's grid on the bar they actually get",
    phoneBarFor({ role: "employee", permissions: PERMISSION_PRESETS.worker.values }).tabs.some((row) => row.href === "/app/chat"));
  ok("the Chat row has NO NAV_REQUIREMENTS entry — a Crew member keeps it", !("app.nav.chat" in NAV_REQUIREMENTS));
  const crew = { role: "employee", permissions: { jobs: "none", quotes: "none", invoices: "none", requests: "none", schedule: "view_complete_own", clientsProperties: "name_address_only" } };
  ok("navRowAllowed shows Chat to a Crew member with `none` on every document ladder", navRowAllowed("app.nav.chat", crew) === true);
  ok("…while hiding all four pipeline tabs from them", ["app.nav.requests", "app.nav.quotes", "app.nav.jobs", "app.nav.invoices"].every((k) => navRowAllowed(k, crew) === false));
  const page = decomment(read("app/app/chat/page.js"));
  ok("the page renders CompanyChat on the kit and reads ?room= for the push landing", /CompanyChat/.test(page) && /get\("room"\)/.test(page));
  const screen = decomment(read("app/components/company/CompanyChat.js"));
  ok("the screen is built on @/app/components/chat", /from "@\/app\/components\/chat"/.test(screen));
  // Mentions are the BELL's to announce since 2026-10-04 (catalog
  // "chat.mention"); the screen toasts what the reader hears every message
  // of, and never a muted room.
  ok("the screen tells DMs and every-message rooms through notify(), skipping muted rooms", /notify\(\{/.test(screen) && /app\.notify\.newMessage\.title/.test(screen) && /app\.notify\.roomMessage\.title/.test(screen) && /r\.muted \|\| r\.notifyLevel !== "all"/.test(screen));
  ok("…and does not toast mentions itself (the bell does — no double ping)", !/app\.notify\.mention\.title/.test(screen));
  const settingsPanel = decomment(read("app/components/company/chat/RoomSettings.js"));
  ok("add / remove / leave / archive are drawn only from the server's room.can (and people.can)", /people\.can\?\.add \?/.test(settingsPanel) && /people\.can\?\.remove && !m\.isYou/.test(settingsPanel) && /can\.leave \?/.test(settingsPanel) && /can\.archive \?/.test(settingsPanel));
  ok("the Channels \"+\" is drawn only for somebody the server says may create one", /canCreateChannel = Boolean\(data\?\.me\?\.canCreateChannel\) && !readOnly/.test(screen) && /if \(canCreateChannel\) \{/.test(screen));

  const chatParts = ["app/components/company/chat/parts.js", "app/components/company/chat/ChatDialogs.js", "app/components/company/chat/RoomSettings.js"].map((f) => decomment(read(f))).join("\n");
  const keys = [...new Set([...(screen + chatParts).matchAll(/t\("(app\.[A-Za-z0-9.]+)"/g)].map((m) => m[1]))];
  const notifyKeys = ["all", "mentions", "none"].map((l) => `app.companyChat.notify.${l}`);
  const crewGroupKeys = CREW_GROUP_ORDER.map((g) => `app.companyChat.group.${g}`).concat(["app.companyChat.group.myJobs"]);
  const client = read("lib/company/chat/client.js");
  const refusalKeys = [...client.matchAll(/"(app\.companyChat\.refusal\.[A-Za-z]+)"/g)].map((m) => m[1]);
  const groupKeys = GROUP_ORDER.map((g) => `app.companyChat.group.${g}`);
  const labelKeys = ["owner", "admin", "supervisor", "employee"].map((r) => `app.companyChat.label.${r}`);
  const all = [...new Set([...keys, ...refusalKeys, ...groupKeys, ...crewGroupKeys, ...notifyKeys, ...labelKeys, "app.nav.chat", "app.companyChat.heading", "app.notif.type.chat.mention"])];
  const languages = Object.keys(APP_MESSAGES);
  ok("nine languages in the catalogue", languages.length === 9, languages);
  let missing = [];
  for (const lang of languages) for (const k of all) if (APP_MESSAGES[lang][k] == null) missing.push(`${lang}:${k}`);
  ok(`every key the screen asks for exists in all ${languages.length} languages (${all.length} keys)`, missing.length === 0, missing.slice(0, 10));
  ok("the refusal codes the store stamps are all mapped for the screen", ["no_room", "read_only", "empty", "self", "member_unknown", "nobody_named"].every((c) => new RegExp(`\\b${c}:`).test(client)));
  // Every code the store can return is in that table — read off the store
  // itself, so a new refusal cannot ship untranslated.
  const stamped = [...new Set([...decomment(read("lib/company/chat/store.js")).matchAll(/refuse\(\s*\d{3},\s*"([a-z_]+)"/g)].map((m) => m[1]))];
  const reasons = ["name_missing", "name_too_long", "name_reserved"];
  const unmapped = [...stamped, ...reasons].filter((c) => !new RegExp(`\\b${c}:`).test(client));
  ok(`every refusal code the store stamps (${stamped.length} + the name reasons) maps to a catalogue key`, stamped.length >= 12 && unmapped.length === 0, unmapped);
  ok("docs/screens/company-chat has the 1280 and 375 captures", ["list-1280.png", "list-375.png", "job-1280.png", "job-375.png", "members-1280.png", "members-375.png", "mention-1280.png", "mention-375.png"].every((f) => existsSync(join(ROOT, "docs/screens/company-chat", f))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. \"Message {name}\" on the team directory lands IN the conversation");

{
  // It linked to plain /app/chat, so the person landed on the list and had
  // to find the name again. The link now names the member; the chat opens
  // the DM through the SAME openDirect the New message picker calls (section
  // 4 executes its rules: same company, active, not yourself).
  const team = decomment(read("app/app/me/team/page.js"));
  ok("the team page links to /app/chat?with=<member id>", /href=\{`\/app\/chat\?with=\$\{encodeURIComponent\(p\.id\)\}`\}/.test(team));
  ok("…only for a member with a login who is not you", /p\.kind === "member" && !p\.isYou/.test(team));
  const page = decomment(read("app/app/chat/page.js"));
  ok("the chat page reads ?with= and hands it to CompanyChat (a ?room= wins)", /initialRoomId \? null : params\?\.get\("with"\)/.test(page) && /initialWithId=\{initialWithId\}/.test(page));
  const screen = decomment(read("app/components/company/CompanyChat.js"));
  const effect = screen.slice(screen.indexOf("const openedWith"), screen.indexOf("[initialWithId, data, startDirect]"));
  ok("the screen opens it through startDirect (openDirect), once", /startDirect\(\{ id: initialWithId \}\)/.test(effect) && /openedWith\.current = true/.test(effect));
  ok("…not for a read-only support session", /data\.me\?\.readOnly\) return/.test(effect));
  ok("…and swaps the URL to ?room= so a reload does not re-open", /replaceState\([^)]*\?room=/.test(effect));
  ok("a refused open is said on the no-room pane, not swallowed", /data-action-error/.test(screen));
}

// ═══════════════════════════════════════════════════════════════════════════
section("12. The job page's \"Open job chat\": only for the room's members");

{
  // The job page had no way into the job's room. GET /api/jobs/[id] now
  // carries chatRoomId from jobRoomIdFor, and the page draws the link only
  // when it is there. Executed against the two-company fake: the office and
  // the crew booked on the visits get the id; crew not booked, another
  // company, and a job with no room get null.
  const db = seed();
  await ensureCompanyRooms("A", { client: db });
  await ensureCompanyRooms("B", { client: db });
  const j1 = roomOf(db, jobRoomKey("j1"));
  ok("the owner (office) gets the job's room", (await jobRoomIdFor(ANA, "j1", { client: db })) === j1.id);
  ok("…and the supervisor (office)", (await jobRoomIdFor(DAN, "j1", { client: db })) === j1.id);
  ok("crew booked on the visits get it", (await jobRoomIdFor(BOB, "j1", { client: db })) === j1.id);
  ok("crew NOT booked get nothing (the crew-assigned rule's own fact)", (await jobRoomIdFor(CAT, "j1", { client: db })) === null);
  ok("another company gets nothing for A's job", (await jobRoomIdFor(ZED, "j1", { client: db })) === null);
  ok("an unscheduled job has no room and so no link", (await jobRoomIdFor(ANA, "j3", { client: db })) === null);
  ok("a read-only support session gets it (it reads every room)", (await jobRoomIdFor(SUPPORT, "j1", { client: db })) === j1.id);
  // Bob taken off the visits: his row closes and the link goes with it.
  db.tables.jobVisit.length = 0;
  await syncJobRoom("A", "j1", { client: db });
  ok("crew taken off the job lose the link with the room", (await jobRoomIdFor(BOB, "j1", { client: db })) === null);

  const route = decomment(read("app/api/jobs/[id]/route.js"));
  const get = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function PATCH"));
  ok("the job GET asks jobRoomIdFor AFTER the assignedJobWhere-scoped read", /assignedJobWhere\(full\)/.test(get) && get.indexOf("assignedJobWhere(full)") < get.indexOf("jobRoomIdFor(member, job.id)"));
  ok("…best-effort: a failed chat read never fails the job page", /jobRoomIdFor\(member, job\.id\)\.catch\(\(\) => null\)/.test(get));
  ok("…and returns it as chatRoomId", /\bchatRoomId,/.test(get));
  const detail = decomment(read("app/app/jobs/[id]/JobDetail.js"));
  ok("the job page draws Open job chat only when the id came back and team_chat is usable", /\{job\.chatRoomId && chatUsable && \(/.test(detail) && /useFeatureFlags\(\)\?\.team_chat/.test(detail));
  ok("…linking into the room through the push landing (?room=)", /href=\{`\/app\/chat\?room=\$\{encodeURIComponent\(job\.chatRoomId\)\}`\}/.test(detail));
  ok("…with its label in every language", Object.values(APP_MESSAGES).every((m) => typeof m["app.companyChat.openJobChat"] === "string" && m["app.companyChat.openJobChat"].trim()));
}

// ═══════════════════════════════════════════════════════════════════════════
section("13. @everyone is the office's: anyone else's is words, not a push");

{
  // lib/staff/mentions.js treated "@all"/"@everyone" as every member, and
  // the company store passed every author through, so a crew member in
  // #general could push a notification to the whole roster.
  ok("owner, admin and supervisor (Manager/Dispatcher map here) may @everyone", ["owner", "admin", "supervisor"].every((role) => mayMentionEveryone({ role })));
  ok("crew (employee), a viewer and nobody may not", !mayMentionEveryone({ role: "employee" }) && !mayMentionEveryone({ role: "viewer" }) && !mayMentionEveryone(null));

  const room = [
    { kind: "member", id: "mAna", name: "Ana Owner" },
    { kind: "member", id: "mBob", name: "Bob Crew" },
    { kind: "member", id: "mCat", name: "Cat Crew" },
  ];
  const keys = (body, everyone) => [...parseMentions(body, room, { everyone })].sort().join();
  ok("detector: @everyone at the start", mentionsEveryone("@everyone lunch at noon"));
  ok("detector: @all at the very end", mentionsEveryone("lunch at noon @all"));
  ok("detector: any case", mentionsEveryone("heads up @EveryOne"));
  ok("detector: an email is not a mention", !mentionsEveryone("write to crew@everyone.com") && !mentionsEveryone("x@all"));
  ok("detector: a longer word is not it", !mentionsEveryone("@everyones") && !mentionsEveryone("@allison"));
  ok("allowed: @everyone names the whole room", keys("@everyone lunch", true) === "member:mAna,member:mBob,member:mCat");
  ok("refused: @everyone names nobody", keys("@everyone lunch", false) === "");
  ok("refused: a real name beside it still counts — one mention, not the room", keys("@everyone and @Ana Owner, look", false) === "member:mAna");
  ok("refused: two names and @all at the end — just the two", keys("@Bob Crew @Cat Crew see you @all", false) === "member:mBob,member:mCat");
  ok("the staff chat's default is unchanged (everyone allowed)", [...parseMentions("@all", room)].length === 3);

  const db = seed();
  await ensureCompanyRooms("A", { client: db });
  const general = roomOf(db, "general");
  const calls = [];
  const notify = async (args) => { calls.push(args); return { sent: 1 }; };

  const crew = await postMessage({ member: BOB, roomId: general.id, body: "@everyone the truck is blocking the drive" }, { client: db, notify });
  ok("crew's @everyone is posted", crew.ok === true);
  ok("…with the words exactly as typed", crew.message.body === "@everyone the truck is blocking the drive");
  ok("…mentioning nobody", crew.message.mentions.length === 0, crew.message.mentions);
  ok("…and pushing to nobody", calls.length === 0, calls.length);

  calls.length = 0;
  const crewAll = await postMessage({ member: CAT, roomId: general.id, body: "done for today @all" }, { client: db, notify });
  ok("crew's @all at the end is the same: no mention, no push", crewAll.message.mentions.length === 0 && calls.length === 0);

  calls.length = 0;
  const crewNamed = await postMessage({ member: BOB, roomId: general.id, body: "@everyone — @Ana Owner can you call the client?" }, { client: db, notify });
  ok("crew naming one person beside @everyone reaches that person only", JSON.stringify(crewNamed.message.mentions) === JSON.stringify(["member:mAna"]) && calls.length === 1 && JSON.stringify(calls[0].userIds) === JSON.stringify(["uAna"]));

  calls.length = 0;
  const office = await postMessage({ member: ANA, roomId: general.id, body: "@everyone safety meeting at 7" }, { client: db, notify });
  ok("the owner's @everyone mentions the whole room", office.message.mentions.length === 4, office.message.mentions);
  ok("…and pushes to everyone but the owner", calls.length === 1 && JSON.stringify([...calls[0].userIds].sort()) === JSON.stringify(["uBob", "uCat", "uDan"]));

  const store = decomment(read("lib/company/chat/store.js"));
  ok("the store passes the AUTHOR's verdict to the parser", /parseMentions\(text, people, \{ everyone: mayMentionEveryone\(member\) \}\)/.test(store));
  const screen = decomment(read("app/components/company/CompanyChat.js"));
  ok("the composer says so before sending, with the server's own detector and rule", /mentionsEveryone\(text\)/.test(screen) && /!mayMentionEveryone\(data\.me\)/.test(screen) && /data-everyone-hint/.test(screen) && /app\.companyChat\.everyoneOfficeOnly/.test(screen));
  ok("…not in a DM, where there is no everyone", /room\.kind !== "dm" && !mayMentionEveryone/.test(screen));
}

// ═══════════════════════════════════════════════════════════════════════════
section("14. The Chat tab's digit is the room list's counts, summed");

{
  // lib/chat/badges.js said it: "The /app chrome carries no chat digit
  // today". GET /api/chat/unread → unreadTotalsFor now feeds one shared poll
  // (app/hooks/useChatUnread.js) drawn on every Chat entry in the chrome.
  const db = seed();
  await ensureCompanyRooms("A", { client: db });
  await ensureCompanyRooms("B", { client: db });
  const general = roomOf(db, "general");
  const j1 = roomOf(db, jobRoomKey("j1"));
  const quiet = async () => ({});
  await postMessage({ member: ANA, roomId: general.id, body: "morning all" }, { client: db, notify: quiet });
  await postMessage({ member: ANA, roomId: j1.id, body: "@Bob Crew bring the sander" }, { client: db, notify: quiet });
  await postMessage({ member: DAN, roomId: j1.id, body: "and the ladder" }, { client: db, notify: quiet });
  await postMessage({ member: ZED, roomId: roomOf(db, "general", "B").id, body: "B's news" }, { client: db, notify: quiet });

  const sumOf = (rows) => rows.reduce((s, r) => ({ unread: s.unread + r.unread, mentions: s.mentions + r.mentions }), { unread: 0, mentions: 0 });
  const bobTotals = await unreadTotalsFor(BOB, { client: db });
  const bobList = sumOf(roomList(await roomsFor(BOB, { client: db }), "mBob"));
  ok("Bob's tab equals his room list, summed", JSON.stringify(bobTotals) === JSON.stringify(bobList), [bobTotals, bobList]);
  ok("…3 unread (one in #general, two in the job room), 1 of them naming him", bobTotals.unread === 3 && bobTotals.mentions === 1, bobTotals);
  const catTotals = await unreadTotalsFor(CAT, { client: db });
  ok("Cat (not on the job) counts #general only", catTotals.unread === 1 && catTotals.mentions === 0, catTotals);
  ok("the author's own words never count for them", (await unreadTotalsFor(ANA, { client: db })).unread === 1);
  ok("company B's message counts for nobody in A", (await unreadTotalsFor(CAT, { client: db })).unread === 1 && (await unreadTotalsFor(ZED, { client: db })).unread === 0);
  ok("a read-only support session gets zero, not the company's history", JSON.stringify(await unreadTotalsFor(SUPPORT, { client: db })) === JSON.stringify({ unread: 0, mentions: 0 }));
  const thread = await roomFor(BOB, j1.id, { client: db });
  await markRoomSeen(BOB, j1.id, { client: db, upTo: seenUpTo(thread.messages, "createdAt") });
  const after = await unreadTotalsFor(BOB, { client: db });
  ok("opening the job room takes its two off the tab", after.unread === 1 && after.mentions === 0, after);

  const route = decomment(read("app/api/chat/unread/route.js"));
  ok("the route seeds nothing — no ensureCompanyRooms on a poll", !/ensureCompanyRooms/.test(route) && /unreadTotalsFor\(member\)/.test(route));
  ok("the browser reaches it through chatApi.unread", /unread: \(\) => fetchJson\("\/api\/chat\/unread"\)/.test(read("lib/company/chat/client.js")));
  const hook = decomment(read("app/hooks/useChatUnread.js"));
  ok("one poll for the chrome: module-level, started by the first subscriber, stopped by the last", /listeners\.size === 1\) stopPoll = startPoll\(\)/.test(hook) && /listeners\.size === 0 && stopPoll/.test(hook));
  ok("…re-read when a chat screen announces lastSeenAt moved", /onBadgesChanged\(read\)/.test(hook));
  ok("…skipped while the tab is hidden", /document\.hidden\) return/.test(hook));
  for (const [file, place] of [
    ["app/components/layout/MobileTabBar.js", "corner"],
    ["app/components/me/MeShell.js", "corner"],
    ["app/components/layout/CrewShell.js", "inline"],
    ["app/components/layout/AdminSidebar.js", "end"],
  ]) {
    const src = decomment(read(file));
    ok(`${file} draws the digit on its /app/chat entry`, /useChatUnread\(/.test(src) && new RegExp(`href === "/app/chat" \\? <NavUnreadBadge counts=\\{chatUnread\\} placement="${place}" />`).test(src));
  }
  const badge = decomment(read("app/components/chat/NavUnreadBadge.js"));
  ok("the badge says its number to a screen reader, translated", /app\.chat\.unreadCountSr/.test(badge) && Object.values(APP_MESSAGES).every((m) => typeof m["app.chat.unreadCountSr"] === "string"));
  ok("…and draws nothing for zero or unknown", /if \(!n\) return null/.test(badge));
  // White on red-600, measured: the pill carries its own fill so the bar's
  // colour (navy, or a brand) never decides whether it can be read.
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (1 + 0.05) / (lum("#dc2626") + 0.05);
  ok(`white on red-600 clears 4.5:1 (${ratio.toFixed(2)}:1)`, ratio >= 4.5 && /bg-red-600/.test(badge) && /text-white/.test(badge));
}

// ═══════════════════════════════════════════════════════════════════════════
// CHANNELS AND GROUPS (2026-10-04) — sections 15–25
// ═══════════════════════════════════════════════════════════════════════════
//
// The owner reversed "nobody makes a group": the office makes channels,
// anybody makes a group, no maximum size; "Seen by" yes; @mentions land in
// the bell. Everything below is EXECUTED against the store and the fake
// database, with every preset the owner named — owner, admin, Manager and
// Dispatcher (both supervisors), Estimator and Crew (both employees).

const presetOf = (key) => ({ ...PERMISSION_PRESETS[key].values });
const BIG = 55;
function seedTeam() {
  const users = [
    { id: "uOwn", name: "Olga Owner", email: "olga@a.test", language: null },
    { id: "uAdm", name: "Adi Admin", email: "adi@a.test", language: null },
    { id: "uMgr", name: "Mia Manager", email: "mia@a.test", language: null },
    { id: "uDsp", name: "Dev Dispatcher", email: "dev@a.test", language: null },
    { id: "uEst", name: "Eli Estimator", email: "eli@a.test", language: null },
    { id: "uTom", name: "Tom Crew", email: "tom@a.test", language: "es" },
    { id: "uPia", name: "Pia Crew", email: "pia@a.test", language: null },
    { id: "uZoe", name: "Zoe Other", email: "zoe@b.test", language: null },
  ];
  const members = [
    { id: "mOwn", userId: "uOwn", companyId: "A", role: "owner", active: true, permissions: null },
    { id: "mAdm", userId: "uAdm", companyId: "A", role: "admin", active: true, permissions: null },
    { id: "mMgr", userId: "uMgr", companyId: "A", role: "supervisor", active: true, permissions: presetOf("manager") },
    { id: "mDsp", userId: "uDsp", companyId: "A", role: "supervisor", active: true, permissions: presetOf("dispatcher") },
    { id: "mEst", userId: "uEst", companyId: "A", role: "employee", active: true, permissions: presetOf("estimator") },
    { id: "mTom", userId: "uTom", companyId: "A", role: "employee", active: true, permissions: presetOf("worker") },
    { id: "mPia", userId: "uPia", companyId: "A", role: "employee", active: true, permissions: presetOf("worker") },
    { id: "mZoe", userId: "uZoe", companyId: "B", role: "owner", active: true, permissions: null },
  ];
  for (let i = 1; i <= BIG; i++) {
    const n = String(i).padStart(2, "0");
    users.push({ id: `uC${n}`, name: `Crew ${n}`, email: `crew${n}@a.test`, language: null });
    members.push({ id: `mC${n}`, userId: `uC${n}`, companyId: "A", role: "employee", active: true, permissions: presetOf("worker") });
  }
  return fakeDb({
    company: [{ id: "A", defaultLanguage: "en" }, { id: "B", defaultLanguage: "en" }],
    user: users,
    member: members,
    job: [],
    jobVisit: [],
  });
}
const who = (id, role) => ({ id, companyId: "A", role, userId: `u${id.slice(1)}` });
const OWN = who("mOwn", "owner");
const ADM = who("mAdm", "admin");
const MGR = who("mMgr", "supervisor");
const DSP = who("mDsp", "supervisor");
const EST = who("mEst", "employee");
const TOM = who("mTom", "employee");
const PIA = who("mPia", "employee");
const ZOE = { id: "mZoe", companyId: "B", role: "owner", userId: "uZoe" };
const SUPPORT_A = { id: null, userId: null, companyId: "A", role: "viewer", impersonation: true, impersonationMode: "read_only", platformAdminId: "pa1" };
const ROLES6 = { owner: OWN, admin: ADM, manager: MGR, dispatcher: DSP, estimator: EST, crew: TOM };
const silent = { notify: async () => ({}), bell: async () => ({}), log: async () => {} };
const crewIds = Array.from({ length: BIG }, (_, i) => `mC${String(i + 1).padStart(2, "0")}`);

// ═══════════════════════════════════════════════════════════════════════════
section("15. The rules matrix, per role: who creates, manages, joins, posts");

{
  // Pure, first: the matrix rules.js documents, asked of every preset.
  const channel = { kind: "channel", private: false, postingPolicy: "everyone", archivedAt: null };
  const asMember = { open: true, role: "member" };
  const asManager = { open: true, role: "manager" };
  const expect = {
    //            create  group  manage(member) manage(manager)
    owner: [true, true, true, true],
    admin: [true, true, true, true],
    manager: [true, true, false, true],
    dispatcher: [true, true, false, true],
    estimator: [false, true, false, false],
    crew: [false, true, false, false],
  };
  for (const [label, m] of Object.entries(ROLES6)) {
    const got = [canCreateChannel(m), canStartGroup(m), canManage(channel, m, asMember), canManage(channel, m, asManager)];
    ok(`${label}: create channel ${got[0] ? "yes" : "NO"}, start a group yes, manage a channel ${got[2] ? "any" : got[3] ? "only their own" : "never"}`, JSON.stringify(got) === JSON.stringify(expect[label]), got);
  }
  ok("rename/archive/add/remove a channel follow manage; a crew 'manager' row still cannot (role re-read)", [canRename, canArchive, canAddMembers, canRemoveMembers].every((fn) => fn(channel, TOM, asManager) === false && fn(channel, MGR, asManager) === true && fn(channel, OWN, asMember) === true));
  ok("nobody manages without an OPEN membership — the owner included (private channels stay private)", canManage(channel, OWN, null) === false && canManage(channel, OWN, { open: false, role: "manager" }) === false);
  const group = { kind: "group" };
  ok("a group: anybody in it renames and adds; only its maker (or an owner/admin in it) removes", canRename(group, TOM, asMember) && canAddMembers(group, TOM, asMember) && !canRemoveMembers(group, TOM, asMember) && canRemoveMembers(group, TOM, asManager) && canRemoveMembers(group, ADM, asMember));
  ok("#general, job rooms and DMs are managed by nobody", ["general", "job", "dm"].every((kind) => !canManage({ kind }, OWN, asManager) && !canAddMembers({ kind }, OWN, asManager)));
  ok("leave: a channel or group yes; #general, a job room, a DM, an auto-join channel no", canLeave(channel).ok && canLeave(group).ok && ["general", "job", "dm"].every((kind) => canLeave({ kind }).reason === "fixed_room") && canLeave({ ...channel, autoJoin: true }).reason === "auto_join");
  const announce = { ...channel, postingPolicy: "office" };
  ok("office-only posting: owner, admin, manager, dispatcher post; estimator and crew read", ["owner", "admin", "manager", "dispatcher"].every((r) => canPost(announce, ROLES6[r]).ok) && ["estimator", "crew"].every((r) => canPost(announce, ROLES6[r]).code === "office_only"));
  ok("an archived room refuses everybody, the owner included", canPost({ ...channel, archivedAt: new Date() }, OWN).code === "archived");
  ok("a support session posts nowhere", canPost(channel, SUPPORT_A).code === "read_only");
  ok("joinable = a public, unarchived channel — never private, archived, or a group", isJoinable(channel) && !isJoinable({ ...channel, private: true }) && !isJoinable({ ...channel, archivedAt: new Date() }) && !isJoinable(group));

  // Executed: the store refuses exactly the people the matrix refuses.
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  for (const [label, m] of Object.entries(ROLES6)) {
    const res = await createChannel(m, { name: `room ${label}` }, { client: db, log: silent.log });
    const should = expect[label][0];
    ok(`store: ${label} ${should ? "makes" : "is refused (403 not_allowed)"} a channel`, should ? res.ok === true : res.ok === false && res.status === 403 && res.code === "not_allowed", res);
  }
  ok("…and the refused ones wrote nothing", !db.tables.companyChatRoom.some((r) => r.key === channelRoomKey("room-estimator") || r.key === channelRoomKey("room-crew")));
  const mgrRoom = db.tables.companyChatRoom.find((r) => r.key === channelRoomKey("room-manager"));
  const rowsOfMgr = db.tables.companyChatMember.filter((r) => r.roomId === mgrRoom.id);
  ok("the maker is the channel's manager; createdByMemberId records who", rowsOfMgr.length === 1 && rowsOfMgr[0].memberId === "mMgr" && rowsOfMgr[0].role === "manager" && mgrRoom.createdByMemberId === "mMgr");
  // A dispatcher who did not make it cannot rename it; the manager who did can.
  await joinRoom(DSP, mgrRoom.id, { client: db });
  const dspRename = await updateRoom(DSP, mgrRoom.id, { name: "hijack" }, { client: db, log: silent.log });
  ok("a supervisor cannot rename a channel somebody else manages (403)", dspRename.ok === false && dspRename.code === "not_allowed");
  const mgrRename = await updateRoom(MGR, mgrRoom.id, { name: "Estimating", topic: "Bids and site visits" }, { client: db, log: silent.log });
  const renamed = db.tables.companyChatRoom.find((r) => r.id === mgrRoom.id);
  ok("the manager renames it: the key and the name follow the slug, the topic is set", mgrRename.ok && renamed.name === "estimating" && renamed.key === "channel:estimating" && renamed.topic === "Bids and site visits");
  await joinRoom(OWN, mgrRoom.id, { client: db });
  ok("the owner, once in it, manages any channel", (await updateRoom(OWN, mgrRoom.id, { postingPolicy: "office" }, { client: db, log: silent.log })).ok === true);
  await joinRoom(TOM, mgrRoom.id, { client: db });
  const crewPost = await postMessage({ member: TOM, roomId: mgrRoom.id, body: "can I post?" }, { client: db, ...silent });
  ok("crew in an office-only channel: post refused 403 office_only, and they still READ it", crewPost.ok === false && crewPost.code === "office_only" && Boolean(await readThread(TOM, mgrRoom.id, { client: db })));
  ok("…the dispatcher posts there", (await postMessage({ member: DSP, roomId: mgrRoom.id, body: "bids due Friday" }, { client: db, ...silent })).ok === true);
  const crewRename = await updateRoom(TOM, mgrRoom.id, { topic: "mine now" }, { client: db, log: silent.log });
  ok("crew cannot change a channel's topic (403)", crewRename.ok === false && crewRename.code === "not_allowed");
  const thread = await readThread(TOM, mgrRoom.id, { client: db });
  ok("the thread's `can` says the same to the screen: crew may not post, rename, manage, archive", thread.can.post === false && thread.can.postRefusal === "office_only" && !thread.can.rename && !thread.can.manage && !thread.can.archive && thread.can.leave === true);
  const ownThread = await readThread(OWN, mgrRoom.id, { client: db });
  ok("…and the owner may do all of it", ownThread.can.post && ownThread.can.rename && ownThread.can.manage && ownThread.can.archive && ownThread.can.add && ownThread.can.remove);

  // Two managers making #estimating at the same instant: one room.
  const [a, b] = await Promise.all([
    createChannel(ADM, { name: "Van Fleet" }, { client: db, log: silent.log }),
    createChannel(OWN, { name: "van-fleet" }, { client: db, log: silent.log }),
  ]);
  ok("two concurrent creates of the same name: one channel, one 409 name_taken", [a, b].filter((r) => r.ok).length === 1 && [a, b].some((r) => r.code === "name_taken" && r.status === 409) && db.tables.companyChatRoom.filter((r) => r.key === "channel:van-fleet").length === 1);
  ok("a second #general is refused by name (name_reserved)", (await createChannel(OWN, { name: "General" }, { client: db, log: silent.log })).code === "name_reserved");
  ok("a name of only punctuation is refused (name_missing)", (await createChannel(OWN, { name: "!!!" }, { client: db, log: silent.log })).code === "name_missing");
  ok("a Ukrainian or Punjabi name is a channel, not a refusal (unicode slugs)", chatSlugify("Бригада Північ", { unicode: true }) === "бригада-північ" && validateChatName("ਟੀਮ ਉੱਤਰ", { unicode: true }).ok && (await createChannel(OWN, { name: "Бригада" }, { client: db, log: silent.log })).ok);
  ok("…while the staff chat keeps its ASCII slugs byte-for-byte", chatSlugify("Sales West!") === "sales-west" && chatSlugify("#Équipe Québec") === "equipe-quebec");
}

// ═══════════════════════════════════════════════════════════════════════════
section("16. A private channel is invisible to everybody not in it — a 404, not a 403");

{
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  await ensureCompanyRooms("B", { client: db });
  const made = await createChannel(MGR, { name: "Office", isPrivate: true, memberIds: ["mAdm"] }, { client: db, log: silent.log });
  ok("a private channel made with one person added", made.ok);
  const id = made.roomId;
  await postMessage({ member: MGR, roomId: id, body: "payroll is Thursday" }, { client: db, ...silent });
  const msgId = db.tables.companyChatMessage.filter((m) => m.roomId === id && m.kind === "message").at(-1).id;
  for (const [label, m] of [["crew", TOM], ["the owner (not added)", OWN], ["company B", ZOE]]) {
    ok(`${label}: not in the list`, !(await roomsFor(m, { client: db })).some((r) => r.id === id));
    ok(`${label}: the thread is 404 (null)`, (await readThread(m, id, { client: db })) === null);
    ok(`${label}: the members are 404`, (await membersOf(m, id, { client: db })) === null);
    const post = await postMessage({ member: m, roomId: id, body: "let me in" }, { client: db, ...silent });
    ok(`${label}: posting answers no_room 404, like a room that does not exist`, post.ok === false && post.code === "no_room" && post.status === 404);
    const join = await joinRoom(m, id, { client: db });
    ok(`${label}: joining answers no_room 404`, join.ok === false && join.code === "no_room");
    ok(`${label}: not offered in Browse channels`, !(await joinableRoomsFor(m, { client: db })).some((r) => r.id === id));
    ok(`${label}: Seen by is 404`, (await seenBy(m, id, msgId, { client: db })) === null);
    ok(`${label}: a bell link to its message resolves to nothing`, (await locateMessage(m, msgId, { client: db })) === null);
    for (const [verb, fn] of [
      ["rename", () => updateRoom(m, id, { name: "x" }, { client: db, log: silent.log })],
      ["archive", () => archiveRoom(m, id, {}, { client: db, log: silent.log })],
      ["add people", () => addMembers(m, id, ["mTom"], { client: db, log: silent.log })],
      ["leave", () => leaveRoom(m, id, { client: db })],
      ["change notifications", () => updateMySubscription(m, id, { notify: "none" }, { client: db })],
    ]) {
      const r = await fn();
      ok(`${label}: ${verb} answers 404`, r.ok === false && r.status === 404, r);
    }
  }
  ok("the admin who was added reads it", Boolean(await readThread(ADM, id, { client: db })));
  ok("the member counts say two people", (await readThread(ADM, id, { client: db })).memberCount === 2);
  ok("a read-only support session sees it (it sees every room) and can write nothing", Boolean(await readThread(SUPPORT_A, id, { client: db })) && (await postMessage({ member: SUPPORT_A, roomId: id, body: "x" }, { client: db, ...silent })).code === "read_only");
  ok("…and is offered nothing to join", (await joinableRoomsFor(SUPPORT_A, { client: db })).length === 0);
  // Public, for contrast: Browse lists it and anybody joins.
  const pub = await createChannel(MGR, { name: "crew-north", topic: "North-side crews" }, { client: db, log: silent.log });
  const browse = await joinableRoomsFor(TOM, { client: db });
  ok("a public channel IS in Browse for crew, with its topic and head-count", browse.some((r) => r.id === pub.roomId && r.topic === "North-side crews" && r.memberCount === 1));
  ok("crew join it", (await joinRoom(TOM, pub.roomId, { client: db })).ok && (await roomsFor(TOM, { client: db })).some((r) => r.id === pub.roomId));
  ok("…and it leaves Browse once they are in", !(await joinableRoomsFor(TOM, { client: db })).some((r) => r.id === pub.roomId));
  ok("company B never sees company A's public channel", !(await joinableRoomsFor(ZOE, { client: db })).some((r) => r.id === pub.roomId) && (await joinRoom(ZOE, pub.roomId, { client: db })).code === "no_room");
  const left = await leaveRoom(TOM, pub.roomId, { client: db });
  const tomRow = db.tables.companyChatMember.find((r) => r.roomId === pub.roomId && r.memberId === "mTom");
  ok("leaving CLOSES the row — never deletes it", left.ok && tomRow && tomRow.open === false && tomRow.removedAt instanceof Date);
  ok("…a system line says so, and Browse offers it again", db.tables.companyChatMessage.some((m) => m.roomId === pub.roomId && m.meta?.system === "left") && (await joinableRoomsFor(TOM, { client: db })).some((r) => r.id === pub.roomId));
}

// ═══════════════════════════════════════════════════════════════════════════
section("17. #announcements: auto-join, office-only, and a removal the sync never undoes");

{
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  const made = await createChannel(OWN, { name: "Announcements", postingPolicy: "office", autoJoin: true }, { client: db, log: silent.log });
  const id = made.roomId;
  const open = () => db.tables.companyChatMember.filter((r) => r.roomId === id && r.open).map((r) => r.memberId);
  ok("auto-join puts every active member of A in it now (62), nobody from B", open().length === 7 + BIG && !open().includes("mZoe"), open().length);
  // A new hire, then the next chat read.
  db.tables.user.push({ id: "uNew", name: "Nia New", email: "nia@a.test", language: null });
  db.tables.member.push({ id: "mNew", userId: "uNew", companyId: "A", role: "employee", active: true, permissions: presetOf("worker") });
  await ensureCompanyRooms("A", { client: db });
  ok("a new hire is in it on the next seeding read", open().includes("mNew"));
  const removed = await removeMember(OWN, id, "mC01", { client: db, log: silent.log });
  await ensureCompanyRooms("A", { client: db });
  ok("a member the owner removed stays out — the sync only creates rows that never existed", removed.ok && !open().includes("mC01"));
  ok("leaving an auto-join channel is refused (auto_join) — mute is the escape", (await leaveRoom(TOM, id, { client: db })).code === "auto_join");
  ok("crew read it but cannot post (office_only)", (await postMessage({ member: TOM, roomId: id, body: "hi" }, { client: db, ...silent })).code === "office_only");
  ok("a private channel cannot be auto-join (switching it private turns auto-join off)", (await updateRoom(OWN, id, { private: true }, { client: db, log: silent.log })).ok && db.tables.companyChatRoom.find((r) => r.id === id).autoJoin === false);
  ok("…and asking for auto-join on a private channel is refused (bad_setting)", (await updateRoom(OWN, id, { autoJoin: true }, { client: db, log: silent.log })).code === "bad_setting");
}

// ═══════════════════════════════════════════════════════════════════════════
section("18. Archived is read-only and KEPT");

{
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  const { roomId: id } = await createChannel(MGR, { name: "old-bids", memberIds: ["mTom"] }, { client: db, log: silent.log });
  await postMessage({ member: TOM, roomId: id, body: "the Hill St bid is in" }, { client: db, ...silent });
  ok("crew cannot archive (403)", (await archiveRoom(TOM, id, {}, { client: db, log: silent.log })).code === "not_allowed");
  const before = db.tables.companyChatMessage.filter((m) => m.roomId === id).length;
  ok("its manager archives it", (await archiveRoom(MGR, id, {}, { client: db, log: silent.log })).ok);
  const room = db.tables.companyChatRoom.find((r) => r.id === id);
  ok("archivedAt and archivedByMemberId are set; the room and every message are still there", room.archivedAt instanceof Date && room.archivedByMemberId === "mMgr" && db.tables.companyChatMessage.filter((m) => m.roomId === id).length === before + 1);
  ok("posting is refused (archived), the manager's too", (await postMessage({ member: MGR, roomId: id, body: "x" }, { client: db, ...silent })).code === "archived" && (await postMessage({ member: TOM, roomId: id, body: "x" }, { client: db, ...silent })).code === "archived");
  ok("renaming and adding people are refused (archived)", (await updateRoom(MGR, id, { name: "x" }, { client: db, log: silent.log })).code === "archived" && (await addMembers(MGR, id, ["mPia"], { client: db, log: silent.log })).code === "archived");
  const row = roomList(await roomsFor(TOM, { client: db }), "mTom").find((r) => r.id === id);
  ok("it lists under Archived for its members, still readable", row.archived === true && groupOf(row, { unreadOnTop: true }) === "archived" && Boolean(await readThread(TOM, id, { client: db })));
  ok("it is not joinable while archived", !(await joinableRoomsFor(PIA, { client: db })).some((r) => r.id === id));
  ok("unarchiving brings it back, writable", (await archiveRoom(MGR, id, { archive: false }, { client: db, log: silent.log })).ok && (await postMessage({ member: TOM, roomId: id, body: "back" }, { client: db, ...silent })).ok);
  ok("a group, #general or a DM cannot be archived (fixed_room)", (await archiveRoom(OWN, roomOf(db, "general").id, {}, { client: db, log: silent.log })).code === "fixed_room");
}

// ═══════════════════════════════════════════════════════════════════════════
section("19. Groups: anybody starts one, no maximum size, and 55 people still work");

{
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  const one = await createGroup(TOM, { memberIds: ["mPia"] }, { client: db, log: silent.log });
  const dm = await openDirect(TOM, "mPia", { client: db });
  ok("one person picked is the DM — the same room openDirect gives", one.ok && one.kind === "dm" && one.roomId === dm.roomId);
  ok("nobody picked is refused (nobody_named)", (await createGroup(TOM, { memberIds: [] }, { client: db, log: silent.log })).code === "nobody_named");
  ok("an id from company B is refused whole (member_unknown) — nobody is half-added", (await createGroup(TOM, { memberIds: ["mPia", "mZoe"] }, { client: db, log: silent.log })).code === "member_unknown" && !db.tables.companyChatRoom.some((r) => r.kind === "group"));
  const small = await createGroup(TOM, { memberIds: ["mPia", "mEst"] }, { client: db, log: silent.log });
  ok("crew start a group of three", small.ok && small.kind === "group");
  const big = await createGroup(MGR, { memberIds: crewIds }, { client: db, log: silent.log });
  ok(`a group of ${BIG + 1} is made — there is no maximum`, big.ok && db.tables.companyChatMember.filter((r) => r.roomId === big.roomId && r.open).length === BIG + 1);
  const listed = roomList(await roomsFor(mkCrew(1), { client: db }), "mC01").find((r) => r.id === big.roomId);
  ok(`the list calls it by its first three other people and "+n" (+${BIG - 3}), from a ${BIG + 1}-person head-count`, listed && listed.title === "Mia Manager, Crew 02, Crew 03" && listed.titleExtra === BIG + 1 - 1 - 3 && listed.memberCount === BIG + 1, listed && [listed.title, listed.titleExtra, listed.memberCount]);
  // The list query carries the first few members only — not 56 per room per poll.
  const listRoom = (await roomsFor(MGR, { client: db })).find((r) => r.id === big.roomId);
  ok("the list query carries at most four members per room, plus the viewer's own row", listRoom.members.length <= 4 && listRoom.mine?.memberId === "mMgr");
  const page1 = await membersOf(MGR, big.roomId, { client: db });
  ok(`the members panel pages: ${MEMBER_PAGE} first, a cursor, the total`, page1.members.length === MEMBER_PAGE && page1.total === BIG + 1 && page1.nextCursor === String(MEMBER_PAGE));
  const page2 = await membersOf(MGR, big.roomId, { client: db, cursor: page1.nextCursor });
  ok("…and the rest on the next page, nobody twice", page2.members.length === BIG + 1 - MEMBER_PAGE && page2.nextCursor === null && new Set([...page1.members, ...page2.members].map((m) => m.id)).size === BIG + 1);
  const search = await membersOf(MGR, big.roomId, { client: db, q: "crew 4" });
  ok("a big room's @ list searches the server by name (\"crew 4\" → Crew 40–49, not Crew 04)", search.members.length === 10 && search.members.every((m) => /^Crew 4\d$/.test(m.name)), search.members.map((m) => m.name));
  ok("…the maker is marked manager, and everybody else 'added by' them", page1.members.find((m) => m.id === "mMgr").manager === true && page1.members.find((m) => m.id === "mC01").addedBy === "Mia Manager");
  const full = await readThread(mkCrew(1), big.roomId, { client: db });
  ok("the thread carries the members inline (56 ≤ 200), not truncated", full.members.length === BIG + 1 && full.membersTruncated === false);

  // Fan-out in a big group: every message pushes (a group's default), in slices.
  const calls = [];
  const notify = async (args) => { calls.push(args); return { sent: args.userIds.length }; };
  const bells = [];
  await postMessage({ member: MGR, roomId: big.roomId, body: "van 2 leaves at 7" }, { client: db, notify, bell: async (a) => bells.push(a), log: silent.log });
  await new Promise((r) => setTimeout(r, 20));
  const pushed = calls.flatMap((c) => c.userIds);
  // Crew 01 read the thread a moment ago (the readThread above stamped
  // lastOpenedAt): they are LOOKING, and are not pushed what is on screen.
  ok(`a group message pushes every other member once (${BIG - 1}), never the author, never somebody looking`, pushed.length === BIG - 1 && new Set(pushed).size === BIG - 1 && !pushed.includes("uMgr") && !pushed.includes("uC01"), pushed.length);
  ok(`…in slices of at most ${PUSH_CHUNK}`, calls.every((c) => c.userIds.length <= PUSH_CHUNK));
  const title = await calls[0].payload("en");
  ok("…titled with the author and the group's first OTHER people", title.title === "Mia Manager in Crew 01, Crew 02, Crew 03", title.title);
  ok("no bell row for a plain message", bells.length === 0);

  // Rename: any member; remove: the maker only; the row is closed.
  ok("a crew member in the group renames it", (await updateRoom(mkCrew(2), big.roomId, { name: "North crew" }, { client: db, log: silent.log })).ok && db.tables.companyChatRoom.find((r) => r.id === big.roomId).name === "North crew");
  ok("…but cannot remove anybody (403)", (await removeMember(mkCrew(2), big.roomId, "mC03", { client: db, log: silent.log })).code === "not_allowed");
  ok("the maker removes them; the row is closed, not deleted", (await removeMember(MGR, big.roomId, "mC03", { client: db, log: silent.log })).ok && db.tables.companyChatMember.find((r) => r.roomId === big.roomId && r.memberId === "mC03").open === false);
  ok("removing somebody not in it says not_member", (await removeMember(MGR, big.roomId, "mC03", { client: db, log: silent.log })).code === "not_member");
  ok("anybody in the group adds people back — the same row reopens", (await addMembers(mkCrew(2), big.roomId, ["mC03"], { client: db, log: silent.log })).added === 1 && db.tables.companyChatMember.filter((r) => r.roomId === big.roomId && r.memberId === "mC03").length === 1);
  ok("a member leaves the group (row closed)", (await leaveRoom(mkCrew(4), big.roomId, { client: db })).ok && db.tables.companyChatMember.find((r) => r.roomId === big.roomId && r.memberId === "mC04").open === false);
  ok("system lines record created, added, removed, renamed and left", ["created_group", "added", "removed", "renamed", "left"].every((s) => db.tables.companyChatMessage.some((m) => m.roomId === big.roomId && m.kind === "system" && m.meta?.system === s)));
}
function mkCrew(n) {
  const id = String(n).padStart(2, "0");
  return { id: `mC${id}`, companyId: "A", role: "employee", userId: `uC${id}` };
}

// ═══════════════════════════════════════════════════════════════════════════
section("20. Mute: what is pushed, what is counted, what is hidden");

{
  const NOW = new Date("2026-10-04T12:00:00Z");
  const later = new Date(NOW.getTime() + 3600e3);
  const v = (kind, membership, mentioned = false) => notifyVerdict({ kind, membership: { open: true, ...membership }, mentioned, now: NOW });
  ok("default: a DM or group pushes every message; a channel, #general, a job room only mentions", v("dm", {}).push === "message" && v("group", {}).push === "message" && v("channel", {}).push === null && v("general", {}).push === null && v("job", {}).push === null);
  ok("a mention in a channel pushes AND rings the bell", v("channel", {}, true).push === "mention" && v("channel", {}, true).bell === true);
  ok("a mention in a DM is a DM — no bell row", v("dm", {}, true).push === "message" && v("dm", {}, true).bell === false);
  ok("'all' in a channel pushes every message", v("channel", { notify: "all" }).push === "message");
  ok("'mentions' in a group silences plain messages, not mentions", v("group", { notify: "mentions" }).push === null && v("group", { notify: "mentions" }, true).push === "mention");
  ok("'none' silences everything, mentions included — and no bell", v("group", { notify: "none" }, true).push === null && v("group", { notify: "none" }, true).bell === false);
  ok("snoozed behaves like 'mentions' until it ends", v("group", { mutedUntil: later }).push === null && v("group", { mutedUntil: later }, true).push === "mention" && v("group", { mutedUntil: new Date(NOW.getTime() - 1) }).push === "message");
  ok("somebody LOOKING at the room (opened 10 s ago) is not pushed, mention or not", v("group", { lastOpenedAt: new Date(NOW.getTime() - 10e3) }, true).push === null && v("group", { lastOpenedAt: new Date(NOW.getTime() - 60e3) }).push === "message");
  ok("the author is never told", notifyVerdict({ kind: "dm", membership: { open: true }, isAuthor: true, now: NOW }).push === null);
  ok("effectiveNotify: a snooze never RAISES 'none'", effectiveNotify("group", { notify: "none", mutedUntil: later }, NOW) === "none");
  ok("badge: none adds nothing; snoozed adds mentions only; otherwise unread", JSON.stringify(badgeCounts({ unread: 5, mentions: 1, notifyLevel: "none", muted: true })) === '{"unread":0,"mentions":0}' && JSON.stringify(badgeCounts({ unread: 5, mentions: 1, notifyLevel: "mentions", muted: true })) === '{"unread":1,"mentions":1}' && JSON.stringify(badgeCounts({ unread: 5, mentions: 1, notifyLevel: "mentions", muted: false })) === '{"unread":5,"mentions":1}');
  ok("a snooze must end in the next year — 1970 and 3000 are refused, null clears", parseSnooze("1970-01-01", NOW).ok === false && parseSnooze("3000-01-01", NOW).ok === false && parseSnooze(later.toISOString(), NOW).ok && parseSnooze(null, NOW).until === null);
  ok("a hidden DM stays hidden until somebody speaks after it was hidden", isHidden({ kind: "dm", lastMessageAt: NOW }, { hiddenAt: later }) === true && isHidden({ kind: "dm", lastMessageAt: new Date(later.getTime() + 1) }, { hiddenAt: later }) === false && isHidden({ kind: "channel" }, { hiddenAt: later }) === false);

  // Executed through the store.
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  const { roomId: gid } = await createGroup(TOM, { memberIds: ["mPia", "mEst", "mMgr"] }, { client: db, log: silent.log });
  ok("a bad setting is refused (bad_setting)", (await updateMySubscription(PIA, gid, { notify: "loud" }, { client: db })).code === "bad_setting");
  await updateMySubscription(PIA, gid, { notify: "none" }, { client: db });
  await updateMySubscription(EST, gid, { mutedUntil: new Date(Date.now() + 3600e3).toISOString() }, { client: db });
  // Mia has the room open right now.
  await readThread(MGR, gid, { client: db });
  const calls = [];
  const bells = [];
  const notify = async (args) => { calls.push(args); return {}; };
  await postMessage({ member: TOM, roomId: gid, body: "who has the ladder?" }, { client: db, notify, bell: async (a) => bells.push(a) });
  await new Promise((r) => setTimeout(r, 20));
  ok("a plain group message: Pia (none), Eli (snoozed), Mia (looking) and Tom (author) are all left alone", calls.flatMap((c) => c.userIds).length === 0, calls.map((c) => c.userIds));
  calls.length = 0;
  await postMessage({ member: TOM, roomId: gid, body: "@Pia Crew @Eli Estimator @Mia Manager ladder?" }, { client: db, notify, bell: async (a) => bells.push(a) });
  await new Promise((r) => setTimeout(r, 20));
  const mentionPushed = calls.flatMap((c) => c.userIds);
  ok("a mention: snoozed Eli IS told; Pia ('none') is not; Mia (looking) is not", JSON.stringify(mentionPushed) === JSON.stringify(["uEst"]), mentionPushed);
  ok("…and the bell gets exactly the one row-recipient the push got", bells.length === 1 && JSON.stringify(bells[0].recipientUserIds) === JSON.stringify(["uEst"]) && bells[0].type === "chat.mention");
  const piaTotals = await unreadTotalsFor(PIA, { client: db });
  const estTotals = await unreadTotalsFor(EST, { client: db });
  ok("the Chat tab: Pia's 'none' group adds nothing; Eli's snoozed group adds only his mention", piaTotals.unread === 0 && estTotals.unread === 1 && estTotals.mentions === 1, [piaTotals, estTotals]);
  const piaRow = roomList(await roomsFor(PIA, { client: db }), "mPia").find((r) => r.id === gid);
  ok("…while the list still says how many are waiting (grey) — the words exist", piaRow.unread === 2 && piaRow.muted === true);
  ok("hiding a channel is refused; hiding a group works", (await updateMySubscription(PIA, roomOf(db, "general").id, { hidden: true }, { client: db })).code === "fixed_room" && (await updateMySubscription(PIA, gid, { hidden: true }, { client: db })).ok);
  ok("a hidden group leaves Pia's list and her tab", !roomList(await roomsFor(PIA, { client: db }), "mPia").some((r) => r.id === gid));
  await new Promise((r) => setTimeout(r, 5));
  await postMessage({ member: TOM, roomId: gid, body: "found it" }, { client: db, ...silent });
  ok("…and comes back with the next message, nothing written to bring it back", roomList(await roomsFor(PIA, { client: db }), "mPia").some((r) => r.id === gid));
  ok("starring is per person and drawn as Starred", (await updateMySubscription(TOM, gid, { starred: true }, { client: db })).ok && groupOf(roomList(await roomsFor(TOM, { client: db }), "mTom").find((r) => r.id === gid)) === "starred");
  ok("the support session changes nobody's settings (read_only)", (await updateMySubscription(SUPPORT_A, gid, { notify: "all" }, { client: db })).code === "read_only");
}

// ═══════════════════════════════════════════════════════════════════════════
section("21. @mention → a row in the bell, through the REAL notifyEvent");

{
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  const { roomId } = await createChannel(MGR, { name: "crew-north", memberIds: ["mTom", "mPia"] }, { client: db, log: silent.log });
  const calls = [];
  // `bell` left to its default: notifyEvent with this fake database.
  const res = await postMessage({ member: MGR, roomId, body: "@Tom Crew can you take the ladder?" }, { client: db, notify: async (a) => { calls.push(a); return {}; } });
  const events = db.tables.notificationEvent.filter((e) => e.type === "chat.mention");
  const deliveries = db.tables.notificationDelivery.filter((d) => events.some((e) => e.id === d.eventId));
  ok("one chat.mention event, about THIS message", events.length === 1 && events[0].entityId === res.message.id && events[0].companyId === "A");
  ok("one delivery — to Tom (crew), the person named; not the author, not Pia", deliveries.length === 1 && deliveries[0].memberId === "mTom");
  ok("the row carries the author and the room, never the message's words", JSON.stringify(events[0].params) === JSON.stringify({ name: "Mia Manager", room: "#crew-north" }) && !JSON.stringify(events[0]).includes("ladder"));
  ok("the catalog entry is sound: no money, the floor audience, entityType chatMessage", NOTIFICATION_TYPES["chat.mention"].money === false && NOTIFICATION_TYPES["chat.mention"].entityType === "chatMessage");
  ok("the row opens the chat AT the message", hrefFor({ entityType: "chatMessage", entityId: res.message.id }) === `/app/chat?message=${res.message.id}`);
  ok("…which resolves to the room for Tom", JSON.stringify(await locateMessage(TOM, res.message.id, { client: db })) === JSON.stringify({ roomId, messageId: res.message.id }));
  ok("the push still went too, once, to Tom", calls.length === 1 && JSON.stringify(calls[0].userIds) === JSON.stringify(["uTom"]));
  await updateMySubscription(TOM, roomId, { notify: "none" }, { client: db });
  await postMessage({ member: MGR, roomId, body: "@Tom Crew again" }, { client: db, notify: async () => ({}) });
  ok("Tom set the room to 'none': no second bell row", db.tables.notificationEvent.filter((e) => e.type === "chat.mention").length === 1);
  await leaveRoom(TOM, roomId, { client: db });
  ok("after Tom leaves, the old bell link resolves to nothing (404) — the room is not leaked", (await locateMessage(TOM, res.message.id, { client: db })) === null);
  const store = decomment(read("lib/company/chat/store.js"));
  ok("the bell is written with push: false — the chat's own push is the only one (no double ping)", /notifyEvent\(\{ \.\.\.args, push: false \}/.test(store));
  const notifySrc = decomment(read("lib/notifications/notify.js"));
  ok("notifyEvent honours push: false", /if \(!deps\.db && push !== false\)/.test(notifySrc));
}

// ═══════════════════════════════════════════════════════════════════════════
section("22. \"Seen by\": derived from each member's read boundary, for the room's members only");

{
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  const { roomId } = await createGroup(TOM, { memberIds: ["mPia", "mEst", "mMgr"] }, { client: db, log: silent.log });
  const sent = await postMessage({ member: TOM, roomId, body: "on site" }, { client: db, ...silent });
  ok("nobody has seen it yet: the receipt says 0", (await lastSeenReceipt(TOM, roomId, { client: db })).count === 0);
  await readThread(PIA, roomId, { client: db });
  await readThread(EST, roomId, { client: db });
  const receipt = await lastSeenReceipt(TOM, roomId, { client: db });
  const pureMembers = db.tables.companyChatMember.filter((r) => r.roomId === roomId);
  const msg = db.tables.companyChatMessage.find((m) => m.id === sent.message.id);
  ok("two opened the thread → \"Seen by 2\"", receipt.messageId === sent.message.id && receipt.count === 2);
  ok("the store's count IS the pure rule over the read boundaries (seenCount)", receipt.count === seenCount(msg, pureMembers, "mTom"));
  ok("seenCounts only tallies the reader's OWN messages", JSON.stringify(Object.keys(seenCounts(db.tables.companyChatMessage.filter((m) => m.roomId === roomId), pureMembers, "mTom"))) === JSON.stringify([sent.message.id]));
  const list = await seenBy(TOM, roomId, sent.message.id, { client: db });
  ok("the list on tap names exactly Pia and Eli", list.count === 2 && JSON.stringify(list.people.map((p) => p.id).sort()) === JSON.stringify(["mEst", "mPia"]));
  ok("the thread payload carries the receipt for the reader's last message", (await readThread(TOM, roomId, { client: db })).seen.count === 2);
  ok("a non-member and a support session get no receipts (404 / null)", (await seenBy(PIA, roomOf(db, "general").id, sent.message.id, { client: db })) === null && (await seenBy(SUPPORT_A, roomId, sent.message.id, { client: db })) === null && (await readThread(SUPPORT_A, roomId, { client: db })).seen === null);
  ok("company B gets nothing", (await seenBy(ZOE, roomId, sent.message.id, { client: db })) === null);
  ok("no table holds a row per message per reader — the receipt is a count", !db.tables.companyChatMessageRead && !Object.keys(db.tables).some((t) => /read|receipt/i.test(t)));
  // In a 56-person group, one count query, not 56 rows read.
  const big = await createGroup(MGR, { memberIds: crewIds }, { client: db, log: silent.log });
  await postMessage({ member: MGR, roomId: big.roomId, body: "safety meeting 7:00" }, { client: db, ...silent });
  for (let i = 1; i <= 10; i++) await readThread(mkCrew(i), big.roomId, { client: db });
  ok("a 56-person group: 10 opened it → \"Seen by 10\"", (await lastSeenReceipt(MGR, big.roomId, { client: db })).count === 10);
}

// ═══════════════════════════════════════════════════════════════════════════
section("23. The 4-second poll is a DELTA, and reading marks 'looking'");

{
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  const { roomId } = await createGroup(TOM, { memberIds: ["mPia", "mEst"] }, { client: db, log: silent.log });
  await postMessage({ member: TOM, roomId, body: "one" }, { client: db, ...silent });
  const first = await readThread(PIA, roomId, { client: db });
  const lastAt = first.messages.at(-1).at;
  ok("a full read carries the members and the messages", Array.isArray(first.members) && first.messages.length >= 2 && first.delta === false);
  const quiet = await readThread(PIA, roomId, { client: db, after: lastAt });
  ok("a delta of a quiet room is empty, and carries no member list", quiet.delta === true && quiet.messages.length === 0 && quiet.members === undefined);
  await postMessage({ member: TOM, roomId, body: "two" }, { client: db, ...silent });
  const delta = await readThread(PIA, roomId, { client: db, after: lastAt });
  ok("a delta after a new message carries just that message", delta.messages.length === 1 && delta.messages[0].body === "two");
  const pia = db.tables.companyChatMember.find((r) => r.roomId === roomId && r.memberId === "mPia");
  ok("…and moved Pia's read boundary to it", new Date(pia.lastSeenAt).getTime() === new Date(delta.messages[0].at).getTime());
  ok("reading stamps lastOpenedAt — the 'looking' clock the push reads", pia.lastOpenedAt instanceof Date && Date.now() - pia.lastOpenedAt.getTime() < 5000);
  const route = decomment(read("app/api/chat/rooms/[id]/route.js"));
  ok("the route reads ?after= and ?changed= and hands both to readThread", /sp\.get\("after"\)/.test(route) && /sp\.get\("changed"\)/.test(route) && /readThread\(member, id, \{ after, changedSince \}\)/.test(route));
  const screen = decomment(read("app/components/company/CompanyChat.js"));
  ok("the screen polls the open room every 4 s, 15 s after two quiet minutes, with ?after=", /ROOM_POLL_FAST_MS = 4000/.test(screen) && /ROOM_POLL_SLOW_MS = 15000/.test(screen) && /ROOM_IDLE_MS = 2 \* 60 \* 1000/.test(screen) && /chatApi\.room\(id, \{ after, changed: current\.changesCursor \|\| null \}\)/.test(screen));
  ok("the list seeds rooms on open and on return, never on the 15-second poll", /loadList\(\{ sync: true \}\)/.test(screen) && /searchParams\.get\("sync"\) === "1"/.test(decomment(read("app/api/chat/rooms/route.js"))));
}

// ═══════════════════════════════════════════════════════════════════════════
section("24. A read-only support session changes nothing, anywhere");

{
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  const { roomId } = await createChannel(OWN, { name: "ops" }, { client: db, log: silent.log });
  const before = JSON.stringify(db.tables.companyChatMember) + JSON.stringify(db.tables.companyChatRoom);
  for (const [verb, fn] of [
    ["create a channel", () => createChannel(SUPPORT_A, { name: "x" }, { client: db, log: silent.log })],
    ["start a group", () => createGroup(SUPPORT_A, { memberIds: ["mTom", "mPia"] }, { client: db, log: silent.log })],
    ["rename", () => updateRoom(SUPPORT_A, roomId, { name: "y" }, { client: db, log: silent.log })],
    ["archive", () => archiveRoom(SUPPORT_A, roomId, {}, { client: db, log: silent.log })],
    ["join", () => joinRoom(SUPPORT_A, roomId, { client: db })],
    ["leave", () => leaveRoom(SUPPORT_A, roomId, { client: db })],
    ["add people", () => addMembers(SUPPORT_A, roomId, ["mTom"], { client: db, log: silent.log })],
    ["remove people", () => removeMember(SUPPORT_A, roomId, "mOwn", { client: db, log: silent.log })],
  ]) {
    const r = await fn();
    ok(`support: ${verb} → 403 read_only`, r.ok === false && r.code === "read_only" && r.status === 403);
  }
  ok("…and nothing in the room or memberships moved", before === JSON.stringify(db.tables.companyChatMember) + JSON.stringify(db.tables.companyChatRoom));
  const t = await readThread(SUPPORT_A, roomId, { client: db });
  ok("the support session's thread offers no control: can.* all false", t && !t.can.post && !t.can.manage && !t.can.leave && !t.can.settings && t.readOnly === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("25. Every hand-made change is in the activity log");

{
  const db = seedTeam();
  await ensureCompanyRooms("A", { client: db });
  const logged = [];
  const log = async (member, event) => logged.push({ by: member.id, ...event });
  const { roomId } = await createChannel(MGR, { name: "Estimating", isPrivate: true }, { client: db, log });
  await updateRoom(MGR, roomId, { topic: "Bids" }, { client: db, log });
  await addMembers(MGR, roomId, ["mTom"], { client: db, log });
  await removeMember(MGR, roomId, "mTom", { client: db, log });
  await archiveRoom(MGR, roomId, {}, { client: db, log });
  await createGroup(TOM, { memberIds: ["mPia", "mEst"] }, { client: db, log });
  const actions = logged.map((l) => l.action);
  ok("created, updated, members added, member removed, archived, group created — each logged once", JSON.stringify(actions) === JSON.stringify(["chat.channel_created", "chat.room_updated", "chat.members_added", "chat.member_removed", "chat.channel_archived", "chat.group_created"]), actions);
  ok("…attributed to who did it, against the room, with an English summary", logged.every((l) => l.entityType === "chat_room" && l.entityId && typeof l.summary === "string" && l.summary.length > 5) && logged[0].by === "mMgr" && logged[5].by === "mTom");
}

// ═══════════════════════════════════════════════════════════════════════════
// Phases 3–4 (2026-10-04): photos and files, cards, reply, edit, remove,
// pins, search, the outbox, Save to job photos — EXECUTED against the store.
// ═══════════════════════════════════════════════════════════════════════════
const P34 = await import("@/lib/company/chat/store");
const R34 = await import("@/lib/company/chat/rules");
const { parseChatAttachments, chatFileLocation } = await import("@/lib/company/chat/attachments");
const { fileLinkFor, verifyFileLink, FILE_LINK_TTL_SECONDS } = await import("@/lib/company/chat/fileLinks");
const DU = await import("@/lib/media/directUpload");
const { shareCard } = await import("@/lib/quotes/shareWithStaff");

process.env.BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET || "check-company-chat-secret-0123456789";
const CLOUD = "democloud";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const chatPhoto = (n, companyId = "A") => {
  const publicId = `fieldquo/companies/${companyId}/chat/${uuid(n)}`;
  return { url: `https://res.cloudinary.com/${CLOUD}/image/authenticated/v1700000000/${publicId}.jpg`, publicId, kind: "photo", filename: `site-${n}.jpg`, bytes: 812345 };
};
const chatPdf = (n, companyId = "A") => {
  const publicId = `fieldquo/companies/${companyId}/chat/${uuid(n)}.pdf`;
  return { url: `https://res.cloudinary.com/${CLOUD}/raw/authenticated/v1700000000/${publicId}`, publicId, kind: "document", filename: `spec-${n}.pdf`, bytes: 120000 };
};
const MONEY = /\.(total|subtotal|tax|discount|amount|amountCents|amountPaid|amountDue|price|rate|unitPrice|cost|margin|markup|acceptedTotal|quoteTotal|invoiceTotal)$/i;
function keyPaths(value, path = "", out = []) {
  if (Array.isArray(value)) value.forEach((v, i) => keyPaths(v, `${path}[${i}]`, out));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) { out.push(`${path}.${k}`); keyPaths(v, `${path}.${k}`, out); }
  return out;
}
const opts = { cloudName: CLOUD, notify: async () => ({}), bell: async () => ({}) };

/** seedTeam plus two jobs (Tom is booked on j1 only), a quote with a client, and company B's job. */
function seedWork() {
  const db = seedTeam();
  db.tables.client.push({ id: "c1", companyId: "A", name: "Marie Tremblay" }, { id: "cB", companyId: "B", name: "B client" });
  db.tables.quote.push({ id: "q1", companyId: "A", clientId: "c1", quoteNumber: "Q-0042", status: "accepted", total: 9000, subtotal: 8000 });
  db.tables.job.push(
    { id: "j1", companyId: "A", title: "Tremblay kitchen", status: "scheduled", archivedAt: null, quoteId: "q1", createdAt: new Date() },
    { id: "j2", companyId: "A", title: "Roy deck", status: "scheduled", archivedAt: null, quoteId: null, createdAt: new Date() },
    { id: "jB", companyId: "B", title: "B's job", status: "scheduled", archivedAt: null, quoteId: null, createdAt: new Date() },
  );
  db.tables.jobVisit.push({ id: "v1", jobId: "j1", assignedToId: "uTom", scheduledAt: new Date(Date.now() + 86400000) });
  return db;
}

section("26. Chat files are PRIVATE: the upload scope, and what a message may carry");
{
  const scope = DU.uploadScope("member", { companyId: "A", purpose: "chat" });
  ok("the chat purpose files under the company's own chat folder", scope.ok && scope.folder === "fieldquo/companies/A/chat");
  ok("…as Cloudinary type `authenticated` — the plain URL is refused by Cloudinary itself", scope.deliveryType === "authenticated" && DU.PRIVATE_MEMBER_PURPOSES.includes("chat"));
  ok("…PDF, Word, Excel, PowerPoint and text accepted, at a 25 MB document ceiling", scope.allowMessagingDocuments === true && scope.documentMaxBytes === 25 * 1024 * 1024);
  ok("the two 25 MB constants agree (upload scope and chat rules)", DU.CHAT_DOCUMENT_MAX_BYTES === R34.CHAT_DOCUMENT_MAX_BYTES);
  const signedPhoto = DU.planUpload({ type: "image/jpeg", size: 3_000_000 }, scope, { randomId: () => uuid(1) });
  ok("a photo's signature includes type=authenticated (the browser cannot drop it)", signedPhoto.ok && signedPhoto.params.type === "authenticated");
  const bigPdf = DU.planUpload({ type: "application/pdf", size: 30 * 1024 * 1024 }, scope);
  ok("a 30 MB PDF is refused before a byte is sent (too_large)", !bigPdf.ok && bigPdf.code === "too_large");
  const docx = DU.planUpload({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 200_000 }, scope, { randomId: () => uuid(2) });
  ok("a .docx is accepted and minted with its extension", docx.ok && /\.docx$/.test(docx.publicId));
  ok("the messaging scope keeps Meta's 100 MB (unchanged by chat)", DU.ourCap("document", { allowMessagingDocuments: true }) === 100 * 1024 * 1024);
  ok("the HR scope is unchanged (private, PDF-only documents)", DU.uploadScope("member", { companyId: "A", purpose: "hr" }).deliveryType === "authenticated" && DU.uploadScope("member", { companyId: "A", purpose: "hr" }).allowMessagingDocuments === false);
  ok("the composer refuses a video before uploading", R34.chatFileVerdict({ type: "video/mp4", name: "a.mp4", size: 10 }).code === "no_video" && R34.chatFileVerdict({ type: "", name: "clip.MOV", size: 10 }).code === "no_video");

  const good = parseChatAttachments([chatPhoto(1), chatPdf(2)], { companyId: "A", cloudName: CLOUD });
  ok("a verified photo and PDF of this company's chat folder are accepted", good.ok && good.attachments.length === 2 && good.attachments[0].type === "photo" && good.attachments[1].type === "document");
  ok("…the stored URL is rebuilt from our cloud, never the browser's string", good.attachments[0].url === chatPhoto(1).url);
  const hostile = [
    ["another company's chat file", [chatPhoto(3, "B")]],
    ["a PUBLIC (upload-type) URL", [{ ...chatPhoto(4), url: chatPhoto(4).url.replace("/authenticated/", "/upload/") }]],
    ["a job-photo folder file", [{ ...chatPhoto(5), publicId: `fieldquo/companies/A/jobs/${uuid(5)}`, url: `https://res.cloudinary.com/${CLOUD}/image/authenticated/v1/fieldquo/companies/A/jobs/${uuid(5)}.jpg` }]],
    ["a URL and publicId that disagree", [{ ...chatPhoto(6), publicId: chatPhoto(7).publicId }]],
    ["another Cloudinary account", [{ ...chatPhoto(8), url: chatPhoto(8).url.replace(CLOUD, "evilcloud") }]],
    ["a path with ..", [{ ...chatPhoto(9), url: `https://res.cloudinary.com/${CLOUD}/image/authenticated/v1/fieldquo/companies/A/chat/../B/${uuid(9)}.jpg` }]],
    ["a video", [{ url: `https://res.cloudinary.com/${CLOUD}/video/authenticated/v1/fieldquo/companies/A/chat/${uuid(10)}.mp4`, publicId: `fieldquo/companies/A/chat/${uuid(10)}` }]],
    ["a data: URL", [{ url: "data:image/png;base64,AAAA", publicId: "x" }]],
    ["eleven files", Array.from({ length: 11 }, (_, i) => chatPhoto(20 + i))],
    ["not a list", "https://res.cloudinary.com/x"],
  ];
  for (const [label, list] of hostile) {
    const r = parseChatAttachments(list, { companyId: "A", cloudName: CLOUD });
    ok(`refused: ${label} (bad_attachment)`, r.ok === false && r.code === "bad_attachment", r);
  }
  ok("a stored row naming another company's file is never signed (chatFileLocation → null)", chatFileLocation({ url: chatPhoto(3, "B").url }, { companyId: "A", cloudName: CLOUD }) === null);
}

section("27. A file link is the reader's, and it EXPIRES");
{
  const now = Date.now();
  const link = fileLinkFor(TOM, "msg1", 0, "full", { now });
  const q = new URL(`https://x.test${link}`);
  const args = { messageId: "msg1", index: "0", variant: "full", exp: q.searchParams.get("exp"), sig: q.searchParams.get("sig") };
  ok("the link is our route, never Cloudinary", link.startsWith("/api/chat/files/msg1/0?") && !link.includes("cloudinary"));
  ok("valid for its reader, now", verifyFileLink(TOM, args, { now }).ok === true);
  ok(`an EXPIRED link is refused (${FILE_LINK_TTL_SECONDS}s later) — "expired"`, verifyFileLink(TOM, args, { now: now + (FILE_LINK_TTL_SECONDS + 5) * 1000 }).code === "expired");
  ok("another member's session cannot use it — even in the same room (bad_link)", verifyFileLink(PIA, args, { now }).code === "bad_link");
  ok("…and an expired link for somebody else says bad_link, not expired", verifyFileLink(PIA, args, { now: now + 10 * 3600 * 1000 }).code === "bad_link");
  ok("a changed file index, size or expiry breaks the signature", verifyFileLink(TOM, { ...args, index: "1" }, { now }).code === "bad_link" && verifyFileLink(TOM, { ...args, variant: "thumb" }, { now }).code === "bad_link" && verifyFileLink(TOM, { ...args, exp: String(Number(args.exp) + 9999) }, { now }).code === "bad_link");
  ok("no secret configured → nothing signs, nothing opens", fileLinkFor(TOM, "m", 0, "full", { secret: "" }) === null && verifyFileLink(TOM, args, { secret: "short" }).code === "unavailable");
  ok("a support session's links are bound to the platform admin", Boolean(fileLinkFor(SUPPORT_A, "m", 0, "thumb")) && verifyFileLink(TOM, { ...args }, { now }).ok);
  const route = decomment(read("app/api/chat/files/[messageId]/[index]/route.js"));
  ok("the file route checks the link BEFORE it looks for the file, and 410s an expired one", route.indexOf("verifyFileLink(") > 0 && route.indexOf("verifyFileLink(") < route.indexOf("chatFileFor(") && /answer\(410, "link_expired"/.test(route));
  ok("…redirects to the five-minute HR signer, and streams thumbnails (the signed delivery URL never leaves)", /expiringFileLink\(file\.location\)/.test(route) && /new Response\(upstream\.body/.test(route) && /private, no-store/.test(route));
}

section("28. A message with photos: stored verified, served as links — no storage URL in any payload");
{
  const db = seedWork();
  await ensureCompanyRooms("A", { client: db });
  const { roomId } = await createChannel(OWN, { name: "site-photos", isPrivate: true, memberIds: ["mTom"] }, { client: db, log: silent.log });
  const sent = await postMessage({ member: TOM, roomId, body: "", attachments: [chatPhoto(40), chatPdf(41)] }, { client: db, ...opts });
  ok("a photo-only message (no words) posts", sent.ok === true, sent);
  const row = db.tables.companyChatMessage.find((m) => m.id === sent.message.id);
  ok("…stored with the verified entries (type, url, publicId, size)", Array.isArray(row.attachments) && row.attachments.length === 2 && row.attachments[0].publicId === chatPhoto(40).publicId);
  const t = await readThread(OWN, roomId, { client: db });
  const msg = t.messages.find((m) => m.id === sent.message.id);
  ok("the thread carries a thumb + full link per photo, a full link per document", msg.attachments[0].thumb?.startsWith("/api/chat/files/") && msg.attachments[0].full?.startsWith("/api/chat/files/") && msg.attachments[1].thumb === null && msg.attachments[1].full);
  const json = JSON.stringify(t);
  ok("NO stored URL, public id, or 'cloudinary' anywhere in the payload", !json.includes("res.cloudinary.com") && !json.includes(chatPhoto(40).publicId) && !/cloudinary/i.test(json));
  ok("the member can open it: chatFileFor finds the file", Boolean(await P34.chatFileFor(TOM, sent.message.id, 0, { client: db, cloudName: CLOUD })));
  ok("a NON-MEMBER of the private channel gets 404 (null) — the owner of the company included", (await P34.chatFileFor(PIA, sent.message.id, 0, { client: db, cloudName: CLOUD })) === null && (await P34.chatFileFor(MGR, sent.message.id, 0, { client: db, cloudName: CLOUD })) === null);
  ok("company B gets 404", (await P34.chatFileFor(ZOE, sent.message.id, 0, { client: db, cloudName: CLOUD })) === null);
  ok("an index that is not there is 404", (await P34.chatFileFor(TOM, sent.message.id, 2, { client: db, cloudName: CLOUD })) === null);
  ok("a read-only support session may open it (it reads every room)", Boolean(await P34.chatFileFor(SUPPORT_A, sent.message.id, 0, { client: db, cloudName: CLOUD })));
  const before = db.tables.companyChatMessage.length;
  const bad = await postMessage({ member: TOM, roomId, body: "x", attachments: [chatPhoto(42, "B")] }, { client: db, ...opts });
  ok("a foreign file refuses the WHOLE message (bad_attachment) and writes nothing", bad.ok === false && bad.code === "bad_attachment" && db.tables.companyChatMessage.length === before);
  const list = await roomsFor(TOM, { client: db });
  const listed = roomList(list, "mTom").find((r) => r.id === roomId);
  ok("the list previews it as what it carried — a count, never a file name", listed.lastBody === null && listed.lastFiles === 2);
}

section("29. Cards: ids stored, resolved per reader — the crew never see a price");
{
  const db = seedWork();
  await ensureCompanyRooms("A", { client: db });
  const general = roomOf(db, "general");
  const wo = await postMessage({ member: OWN, roomId: general.id, body: "Tomorrow's start", card: shareCard({ quoteId: "q1", workOrderJobId: "j1" }) }, { client: db, ...opts });
  const qc = await postMessage({ member: OWN, roomId: general.id, body: "", card: { type: "quote", id: "q1" } }, { client: db, ...opts });
  ok("the office posts a work-order card and a quote card", wo.ok && qc.ok);
  const stored = db.tables.companyChatMessage.find((m) => m.id === wo.message.id).card;
  ok("the stored card is { type, id } and nothing else", JSON.stringify(stored) === JSON.stringify({ type: "work_order", id: "j1" }));
  const asTom = await readThread(TOM, general.id, { client: db });
  const asPia = await readThread(PIA, general.id, { client: db });
  const asOwn = await readThread(OWN, general.id, { client: db });
  const card = (t, id) => t.messages.find((m) => m.id === id).card;
  ok("crew ON the job: the work order opens, with NO quote link", card(asTom, wo.message.id).open === true && card(asTom, wo.message.id).href === "/app/jobs/j1/work-order" && card(asTom, wo.message.id).quoteHref === null);
  ok("crew NOT on the job: 'for the people on this job', no title", card(asPia, wo.message.id).open === false && card(asPia, wo.message.id).restricted === "job_crew" && !("title" in card(asPia, wo.message.id)));
  ok("crew on a quote card: 'Office only', no number, no client", card(asTom, qc.message.id).open === false && card(asTom, qc.message.id).restricted === "office" && !JSON.stringify(card(asTom, qc.message.id)).includes("Q-0042") && !JSON.stringify(card(asTom, qc.message.id)).includes("Marie"));
  ok("the office: the work order AND the quote's button; the quote card's number and client", card(asOwn, wo.message.id).quoteHref === "/app/quotes/q1" && card(asOwn, qc.message.id).number === "Q-0042" && card(asOwn, qc.message.id).clientName === "Marie Tremblay");
  const moneyPaths = [asTom, asPia, asOwn].flatMap((t) => keyPaths(t.messages.map((m) => m.card)).filter((p) => MONEY.test(p)));
  ok("NO money key in any card, for any reader (the quote row has a total; no card carries it)", moneyPaths.length === 0, moneyPaths);
  // Cards only: file-link signatures in the payload are hex, and "9000" can
  // turn up in one by chance.
  ok("…and the quote's total (9000) appears in no card", ![asTom, asPia, asOwn].some((t) => JSON.stringify(t.messages.map((m) => m.card)).includes("9000")));
  for (const [label, member, c] of [
    ["crew sharing a quote they cannot open", TOM, { type: "quote", id: "q1" }],
    ["crew sharing a job they are not on", TOM, { type: "job", id: "j2" }],
    ["the office sharing company B's job", OWN, { type: "job", id: "jB" }],
    ["a made-up card type", OWN, { type: "invoice_total", id: "q1" }],
    ["an id with a path in it", OWN, { type: "job", id: "../j1" }],
  ]) {
    const r = await postMessage({ member, roomId: general.id, body: "look", card: c }, { client: db, ...opts });
    ok(`refused: ${label} (bad_card)`, r.ok === false && r.code === "bad_card", r);
  }
  const crewJob = await postMessage({ member: TOM, roomId: general.id, body: "", card: { type: "job", id: "j1" } }, { client: db, ...opts });
  ok("crew may share THEIR job as a card", crewJob.ok === true);
  ok("Share with staff: a work-order card once it is a job, a quote card before", JSON.stringify(shareCard({ quoteId: "q1", workOrderJobId: "j1" })) === JSON.stringify({ type: "work_order", id: "j1" }) && JSON.stringify(shareCard({ quoteId: "q1" })) === JSON.stringify({ type: "quote", id: "q1" }));
  const modal = decomment(read("app/components/quotes/ShareWithStaffModal.js"));
  ok("…the modal posts the card, with the text links only as the bad_card fallback", /card: shareCard\(\{ quoteId, workOrderJobId \}\)/.test(modal) && /err\?\.code !== "bad_card"/.test(modal));
}

section("30. Reply-quote: one level, same room, and a removed original quotes nothing");
{
  const db = seedWork();
  await ensureCompanyRooms("A", { client: db });
  const general = roomOf(db, "general");
  const { roomId: other } = await createGroup(TOM, { memberIds: ["mPia", "mEst"] }, { client: db, log: silent.log });
  const orig = await postMessage({ member: PIA, roomId: general.id, body: "Bring the shim pack to the Tremblay job" }, { client: db, ...opts });
  const reply = await postMessage({ member: TOM, roomId: general.id, body: "On it", replyToId: orig.message.id }, { client: db, ...opts });
  ok("a reply to a message in the same room posts", reply.ok === true);
  const t = await readThread(OWN, general.id, { client: db });
  const r = t.messages.find((m) => m.id === reply.message.id).replyTo;
  ok("the reply carries the quoted words and who said them", r && r.id === orig.message.id && r.body.startsWith("Bring the shim") && r.who === "Pia Crew");
  const cross = await postMessage({ member: TOM, roomId: other, body: "x", replyToId: orig.message.id }, { client: db, ...opts });
  ok("replying to a message of ANOTHER room is refused (bad_reply)", cross.ok === false && cross.code === "bad_reply");
  await P34.removeMessage(PIA, orig.message.id, { client: db, log: silent.log });
  const t2 = await readThread(OWN, general.id, { client: db });
  const r2 = t2.messages.find((m) => m.id === reply.message.id).replyTo;
  ok("once the original is removed, the quote says removed and carries NO words", r2.deleted === true && r2.body === "" && !JSON.stringify(t2).includes("shim pack"));
  const late = await postMessage({ member: TOM, roomId: general.id, body: "x", replyToId: orig.message.id }, { client: db, ...opts });
  ok("…and a new reply to the removed message is refused", late.ok === false && late.code === "bad_reply");
}

section("31. Edit: your own, inside 15 minutes — the SERVER's clock — and the poll carries it");
{
  const db = seedWork();
  await ensureCompanyRooms("A", { client: db });
  const general = roomOf(db, "general");
  const m = await postMessage({ member: TOM, roomId: general.id, body: "Van 2 at 7" }, { client: db, ...opts });
  const first = await readThread(PIA, general.id, { client: db });
  const cursor = first.changesCursor;
  await new Promise((r) => setTimeout(r, 10));
  const e = await P34.editMessage(TOM, m.message.id, "Van 2 at 7:30", { client: db });
  ok("the author edits within the window", e.ok === true && db.tables.companyChatMessage.find((x) => x.id === m.message.id).editedAt instanceof Date);
  ok("somebody else cannot edit it (403 not_author)", (await P34.editMessage(PIA, m.message.id, "hacked", { client: db })).code === "not_author");
  ok("the owner cannot edit somebody else's words either", (await P34.editMessage(OWN, m.message.id, "hacked", { client: db })).code === "not_author");
  const later = new Date(Date.now() + R34.EDIT_WINDOW_MS + 60_000);
  const tooLate = await P34.editMessage(TOM, m.message.id, "Van 2 at 8", { client: db, now: later });
  ok("16 minutes later the server refuses (403 too_late) — whatever the browser's clock says", tooLate.ok === false && tooLate.status === 403 && tooLate.code === "too_late");
  ok("the pure window agrees at 14:59 and 15:01", R34.canEditMessage({ authorMemberId: "mTom", createdAt: new Date(0) }, TOM, new Date(R34.EDIT_WINDOW_MS - 1000)).ok && R34.canEditMessage({ authorMemberId: "mTom", createdAt: new Date(0) }, TOM, new Date(R34.EDIT_WINDOW_MS + 1000)).code === "too_late");
  ok("a support session cannot edit (read_only)", (await P34.editMessage(SUPPORT_A, m.message.id, "x", { client: db })).code === "read_only");
  const lastAt = first.messages.at(-1).at;
  const delta = await readThread(PIA, general.id, { client: db, after: lastAt, changedSince: cursor });
  const changed = delta.changed.find((x) => x.id === m.message.id);
  ok("the 4-second delta carries the edit to a reader who already had the message", changed && changed.body === "Van 2 at 7:30" && changed.edited === true && delta.messages.length === 0);
}

section("32. Remove: soft, and the words are in NO response — the owner and a support session included");
{
  const db = seedWork();
  await ensureCompanyRooms("A", { client: db });
  const general = roomOf(db, "general");
  // Letters outside hex on purpose: file-link signatures are hex, and a
  // digits-only secret could turn up inside one by chance.
  const SECRET = "the gate code is zulu";
  const keep = await postMessage({ member: PIA, roomId: general.id, body: "first" }, { client: db, ...opts });
  const m = await postMessage({ member: TOM, roomId: general.id, body: SECRET, attachments: [chatPhoto(60)] }, { client: db, ...opts });
  const reply = await postMessage({ member: PIA, roomId: general.id, body: "thanks", replyToId: m.message.id }, { client: db, ...opts });
  await P34.pinMessage(OWN, m.message.id, {}, { client: db });
  // A screen that already HAS the message, open in another tab.
  const first = await readThread(PIA, general.id, { client: db });
  ok("before removal, the reader's screen holds the words (so the next check means something)", JSON.stringify(first).includes("zulu"));
  await new Promise((r) => setTimeout(r, 10));
  ok("crew cannot remove somebody else's message in #general (not_allowed)", (await P34.removeMessage(PIA, m.message.id, { client: db, log: silent.log })).code === "not_allowed");
  const done = await P34.removeMessage(TOM, m.message.id, { client: db, log: silent.log });
  ok("the author removes their own", done.ok === true);
  const row = db.tables.companyChatMessage.find((x) => x.id === m.message.id);
  ok("SOFT: the row and its words stay in the database (never delete data)", row && row.body === SECRET && row.deletedAt instanceof Date && row.deletedByMemberId === "mTom");
  ok("…and its pin went with it", row.pinnedAt === null);
  const lastAt = first.messages.at(-1).at;
  const payloads = {
    "the owner's thread": await readThread(OWN, general.id, { client: db }),
    "the author's own thread": await readThread(TOM, general.id, { client: db }),
    "a support session's thread": await readThread(SUPPORT_A, general.id, { client: db }),
    "the 4-second delta's `changed`": await readThread(PIA, general.id, { client: db, after: lastAt, changedSince: first.changesCursor }),
    "the room list": roomList(await roomsFor(OWN, { client: db }), "mOwn"),
    // `.results`: the reply echoes the words SEARCHED for, which is the
    // searcher's own input, not the message.
    "the owner's search": (await P34.searchMessages(OWN, { q: "gate code" }, { client: db })).results,
    "a support session's search": (await P34.searchMessages(SUPPORT_A, { q: "zulu" }, { client: db })).results,
    "the file route's lookup": await P34.chatFileFor(OWN, m.message.id, 0, { client: db, cloudName: CLOUD }),
  };
  for (const [label, payload] of Object.entries(payloads)) {
    ok(`absent from ${label}`, !JSON.stringify(payload ?? null).includes("zulu") && !JSON.stringify(payload ?? null).includes(chatPhoto(60).publicId));
  }
  const ownRow = payloads["the owner's thread"].messages.find((x) => x.id === m.message.id);
  ok("the row is still THERE, drawn as 'Message removed' (deleted, no body, no files)", ownRow.deleted === true && ownRow.body === "" && ownRow.attachments.length === 0 && ownRow.card === null);
  ok("the delta tells an open screen it was removed", payloads["the 4-second delta's `changed`"].changed.some((x) => x.id === m.message.id && x.deleted === true));
  ok("the reply quoting it now quotes 'removed'", payloads["the owner's thread"].messages.find((x) => x.id === reply.message.id).replyTo.deleted === true);
  ok("the pinned bar no longer has it", !payloads["the owner's thread"].pinned.some((p) => p.id === m.message.id));
  ok("a removed message is not unread for anybody", (await unreadTotalsFor(EST, { client: db })).unread === 2 /* "first" and "thanks" */);
  ok("removing twice is a no-op", (await P34.removeMessage(TOM, m.message.id, { client: db, log: silent.log })).unchanged === true);
  // Moderation: a channel's manager may remove others' messages there, and
  // the log says who removed whose — never what it said.
  const logged = [];
  const { roomId: chan } = await createChannel(MGR, { name: "crew-north", memberIds: ["mTom", "mPia"] }, { client: db, log: silent.log });
  const crewMsg = await postMessage({ member: TOM, roomId: chan, body: "rude words here" }, { client: db, ...opts });
  ok("crew cannot moderate a channel (not_allowed)", (await P34.removeMessage(PIA, crewMsg.message.id, { client: db, log: silent.log })).code === "not_allowed");
  const mod = await P34.removeMessage(MGR, crewMsg.message.id, { client: db, log: async (mm, ev) => logged.push(ev) });
  ok("the channel's manager removes somebody else's message there", mod.ok === true);
  ok("…logged as moderation, without the words", logged.length === 1 && logged[0].action === "chat.message_removed" && !JSON.stringify(logged).includes("rude"));
  const { roomId: grp } = await createGroup(TOM, { memberIds: ["mPia", "mOwn"] }, { client: db, log: silent.log });
  const g = await postMessage({ member: PIA, roomId: grp, body: "in a group" }, { client: db, ...opts });
  ok("in a GROUP nobody removes another's words — not its maker, not the owner", (await P34.removeMessage(TOM, g.message.id, { client: db, log: silent.log })).code === "not_allowed" && (await P34.removeMessage(OWN, g.message.id, { client: db, log: silent.log })).code === "not_allowed");
  const dm = await openDirect(TOM, "mPia", { client: db });
  const d = await postMessage({ member: TOM, roomId: dm.roomId, body: "private" }, { client: db, ...opts });
  ok("the owner cannot even find a DM between two others (no_message 404)", (await P34.removeMessage(OWN, d.message.id, { client: db, log: silent.log })).status === 404);
  ok("a support session removes nothing (read_only)", (await P34.removeMessage(SUPPORT_A, keep.message.id, { client: db, log: silent.log })).code === "read_only");
}

section("33. Pins: the office and room managers; anybody in a DM or group; seen by the poll");
{
  const db = seedWork();
  await ensureCompanyRooms("A", { client: db });
  const general = roomOf(db, "general");
  const m = await postMessage({ member: TOM, roomId: general.id, body: "Van 2 key is in the lockbox" }, { client: db, ...opts });
  ok("crew cannot pin in #general (not_allowed)", (await P34.pinMessage(TOM, m.message.id, {}, { client: db })).code === "not_allowed");
  ok("a manager (supervisor) can", (await P34.pinMessage(MGR, m.message.id, {}, { client: db })).ok === true);
  const first = await readThread(PIA, general.id, { client: db });
  ok("the pinned bar carries it, and the row says pinned", first.pinned.length === 1 && first.pinned[0].id === m.message.id && first.messages.find((x) => x.id === m.message.id).pinned === true);
  ok("a system line says who pinned", db.tables.companyChatMessage.some((x) => x.kind === "system" && x.meta?.system === "pinned" && x.authorMemberId === "mMgr"));
  ok("crew are told they may not pin here (can.pin false); the office may", first.can.pin === false && (await readThread(MGR, general.id, { client: db })).can.pin === true);
  await P34.pinMessage(MGR, m.message.id, { pin: false }, { client: db });
  const delta = await readThread(PIA, general.id, { client: db, after: first.messages.at(-1).at, changedSince: first.changesCursor });
  ok("an UNPIN is seen by the next delta as an absence from the pinned list", delta.delta === true && delta.pinned.length === 0);
  const { roomId: grp } = await createGroup(PIA, { memberIds: ["mTom", "mEst"] }, { client: db, log: silent.log });
  const g = await postMessage({ member: EST, roomId: grp, body: "punch list" }, { client: db, ...opts });
  ok("crew can pin in a group they are in", (await P34.pinMessage(TOM, g.message.id, {}, { client: db })).ok === true);
  ok("the pure rule: crew in a job room no; crew manager of their group yes", R34.canPin({ kind: "job" }, TOM, { open: true, role: "member" }) === false && R34.canPin({ kind: "group" }, TOM, { open: true, role: "manager" }) === true && R34.canPin({ kind: "channel", archivedAt: new Date() }, OWN, { open: true }) === false);
  ok("a support session pins nothing", (await P34.pinMessage(SUPPORT_A, g.message.id, {}, { client: db })).code === "read_only");
}

section("34. Search: server-side, every room you can read — never a private room you are not in");
{
  const db = seedWork();
  await ensureCompanyRooms("A", { client: db });
  const general = roomOf(db, "general");
  const { roomId: priv } = await createChannel(OWN, { name: "payroll", isPrivate: true, memberIds: ["mAdm"] }, { client: db, log: silent.log });
  await postMessage({ member: OWN, roomId: priv, body: "Tremblay deposit cleared" }, { client: db, ...opts });
  await postMessage({ member: PIA, roomId: general.id, body: "Tremblay kitchen tomorrow" }, { client: db, ...opts });
  const crew = await P34.searchMessages(TOM, { q: "tremblay" }, { client: db });
  ok("crew find the #general line, case-blind", crew.results.some((r) => r.body.includes("kitchen tomorrow")));
  ok("…and NOT the private channel's line, not even its room name", !JSON.stringify(crew).includes("deposit") && !JSON.stringify(crew).includes("payroll"));
  ok("the owner, a member of it, finds both", (await P34.searchMessages(OWN, { q: "tremblay" }, { client: db })).results.length === 2);
  ok("search IN the private room as a non-member is a 404 (null)", (await P34.searchMessages(TOM, { q: "tremblay", roomId: priv }, { client: db })) === null);
  ok("company B finds nothing of company A", (await P34.searchMessages(ZOE, { q: "tremblay" }, { client: db })).results.length === 0);
  ok("one letter searches nothing (no full-table scan for 'a')", (await P34.searchMessages(OWN, { q: "a" }, { client: db })).results.length === 0);
  ok("system lines are not searched", !(await P34.searchMessages(OWN, { q: "created" }, { client: db })).results.length);
  ok("a support session searches the rooms it can read — all of them, read-only", (await P34.searchMessages(SUPPORT_A, { q: "tremblay" }, { client: db })).results.length === 2);
}

section("35. The outbox: the same send replayed is ONE message, and pushes once");
{
  const db = seedWork();
  await ensureCompanyRooms("A", { client: db });
  const dm = await openDirect(TOM, "mPia", { client: db });
  const pushes = [];
  const push = async (args) => pushes.push(args);
  const key = "qOUTBOX0123456789abcdef";
  const a = await postMessage({ member: TOM, roomId: dm.roomId, body: "in the basement", offlineKey: key }, { client: db, ...opts, notify: push });
  const b = await postMessage({ member: TOM, roomId: dm.roomId, body: "in the basement", offlineKey: key }, { client: db, ...opts, notify: push });
  ok("first send posts; the replay answers from the ledger (replayed)", a.ok && !a.replayed && b.ok && b.replayed === true && b.message.id === a.message.id);
  ok("ONE message in the room", db.tables.companyChatMessage.filter((m) => m.roomId === dm.roomId && m.body === "in the basement").length === 1);
  ok("ONE push", pushes.length === 1);
  ok("the ledger row is kind 'chat'", db.tables.offlineSyncItem.some((x) => x.clientKey === key && x.kind === "chat" && x.entityId === a.message.id));
  const screen = decomment(read("app/components/company/CompanyChat.js"));
  const outbox = decomment(read("lib/company/chat/outbox.js"));
  ok("the screen sends words through the outbox with the key, and flushes on 'online'", /chatApi\.send\(item\.roomId,[\s\S]{0,200}\{ offlineKey: item\.key \}\)/.test(screen) && /addEventListener\("online", up\)/.test(screen));
  ok("the outbox is kept per MEMBER (a shared computer never replays another person's words)", /PREFIX \+ memberId/.test(outbox));
  const route = decomment(read("app/api/chat/rooms/[id]/route.js"));
  ok("the room route reads X-Offline-Key", /offlineKey: readOfflineKey\(request\)/.test(route));
}

section("36. Save to job photos: the job-photo door, a copy, never featured");
{
  const db = seedWork();
  await ensureCompanyRooms("A", { client: db });
  const jobRoom = roomOf(db, "job:j1");
  const copies = [];
  const copy = async (location, { publicId }) => {
    copies.push({ location, publicId });
    return `https://res.cloudinary.com/${CLOUD}/image/upload/v2/${publicId}.jpg`;
  };
  const m = await postMessage({ member: TOM, roomId: jobRoom.id, body: "", attachments: [chatPhoto(70), chatPdf(71)] }, { client: db, ...opts });
  const saved = await P34.saveToJob(TOM, m.message.id, { index: 0 }, { client: db, cloudName: CLOUD, copy, log: silent.log });
  ok("crew on the job save a photo from the job room to the job's photos", saved.ok === true && saved.jobId === "j1");
  const photo = db.tables.jobPhoto.find((p) => p.id === saved.photoId);
  ok("…a progress photo, NOT featured (the website stays a curation decision)", photo.stage === "progress" && photo.featured === false && photo.companyId === "A");
  ok("…a COPY into the company's jobs folder; the chat file stays private", copies.length === 1 && copies[0].publicId === `fieldquo/companies/A/jobs/chat-${m.message.id}-0` && copies[0].location.deliveryType === "authenticated");
  const again = await P34.saveToJob(TOM, m.message.id, { index: 0 }, { client: db, cloudName: CLOUD, copy, log: silent.log });
  ok("saving it again is the same photo, not a second one", again.ok && again.already === true && db.tables.jobPhoto.length === 1 && copies.length === 1);
  ok("a document cannot be saved as a job photo (not_photo)", (await P34.saveToJob(TOM, m.message.id, { index: 1 }, { client: db, cloudName: CLOUD, copy, log: silent.log })).code === "not_photo");
  ok("crew cannot file it on a job they are not on (no_job)", (await P34.saveToJob(TOM, m.message.id, { index: 0, jobId: "j2" }, { client: db, cloudName: CLOUD, copy, log: silent.log })).code === "no_job");
  ok("nobody files it on company B's job", (await P34.saveToJob(OWN, m.message.id, { index: 0, jobId: "jB" }, { client: db, cloudName: CLOUD, copy, log: silent.log })).code === "no_job");
  ok("a support session saves nothing (read_only)", (await P34.saveToJob(SUPPORT_A, m.message.id, { index: 0 }, { client: db, cloudName: CLOUD, copy })).code === "read_only");
  const general = roomOf(db, "general");
  const g = await postMessage({ member: OWN, roomId: general.id, body: "", attachments: [chatPhoto(72)] }, { client: db, ...opts });
  ok("outside a job room a job must be picked (no_job)", (await P34.saveToJob(OWN, g.message.id, { index: 0 }, { client: db, cloudName: CLOUD, copy, log: silent.log })).code === "no_job");
  ok("…the office may pick any of the company's jobs", (await P34.saveToJob(OWN, g.message.id, { index: 0, jobId: "j2" }, { client: db, cloudName: CLOUD, copy, log: silent.log })).ok === true);
  const pick = await P34.jobsForChat(TOM, {}, { client: db });
  ok("the crew's job picker lists THEIR job only, ids and titles", pick.length === 1 && pick[0].id === "j1" && JSON.stringify(Object.keys(pick[0]).sort()) === JSON.stringify(["id", "status", "title"]));
  ok("the office's lists the company's open jobs, not company B's", (await P34.jobsForChat(OWN, {}, { client: db })).map((j) => j.id).sort().join() === "j1,j2");
  const t = await readThread(TOM, jobRoom.id, { client: db });
  ok("the thread tells the crew they may save to a job (jobs: view_only) and attach", t.can.saveToJob === true && t.can.attach === true);
  ok("no copier configured → 503 unavailable, nothing written", (await P34.saveToJob(OWN, g.message.id, { index: 0, jobId: "j1" }, { client: db, cloudName: CLOUD, copy: null, log: silent.log })).code === "unavailable");
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
