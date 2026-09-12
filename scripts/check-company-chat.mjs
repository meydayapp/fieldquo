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
} from "@/lib/company/chat/store";
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
} from "@/lib/company/chat/rules";
import { FEATURES, featureForNavKey } from "@/lib/features/registry";
import { NAV_REQUIREMENTS, navRowAllowed } from "@/lib/permissions/nav";
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
  await markRoomSeen(BOB, j1.id, { client: db });
  const after = roomList(await roomsFor(BOB, { client: db }), "mBob").find((r) => r.id === j1.id);
  ok("opening the room clears both counts", after.unread === 0 && after.mentions === 0);
  const anaJob = roomList(await roomsFor(ANA, { client: db }), "mAna").find((r) => r.id === j1.id);
  // After Ana's last post: Bob's note to himself and Dan's @all.
  ok("the author's own messages never count as unread for them", anaJob.unread === 2 && anaJob.mentions === 1 && anaJob.lastWasMine === false, [anaJob.unread, anaJob.mentions]);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The pure rules, driven directly");

{
  ok("three kinds, named once", JSON.stringify(CHAT_ROOM_KINDS) === JSON.stringify(["general", "job", "dm"]));
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
  ok("group order is unread, general, job, direct, finished", JSON.stringify(GROUP_ORDER) === JSON.stringify(["unread", "general", "job", "direct", "finished"]));
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
    "app/api/chat/directory/route.js",
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
  const tabbar = decomment(read("app/components/layout/MobileTabBar.js"));
  ok("AdminSidebar has the Chat row at /app/chat", /"app\.nav\.chat"[^}]*href:\s*"\/app\/chat"/.test(sidebar));
  ok("MobileTabBar — the crew's shell — has the Chat tab", /"app\.nav\.chat"[^}]*href:\s*"\/app\/chat"/.test(tabbar));
  ok("the Chat row has NO NAV_REQUIREMENTS entry — a Crew member keeps it", !("app.nav.chat" in NAV_REQUIREMENTS));
  const crew = { role: "employee", permissions: { jobs: "none", quotes: "none", invoices: "none", requests: "none", schedule: "view_complete_own", clientsProperties: "name_address_only" } };
  ok("navRowAllowed shows Chat to a Crew member with `none` on every document ladder", navRowAllowed("app.nav.chat", crew) === true);
  ok("…while hiding all four pipeline tabs from them", ["app.nav.requests", "app.nav.quotes", "app.nav.jobs", "app.nav.invoices"].every((k) => navRowAllowed(k, crew) === false));
  const page = decomment(read("app/app/chat/page.js"));
  ok("the page renders CompanyChat on the kit and reads ?room= for the push landing", /CompanyChat/.test(page) && /get\("room"\)/.test(page));
  const screen = decomment(read("app/components/company/CompanyChat.js"));
  ok("the screen is built on @/app/components/chat", /from "@\/app\/components\/chat"/.test(screen));
  ok("the screen tells mentions and DMs through notify()", /notify\(\{/.test(screen) && /app\.notify\.mention\.title/.test(screen) && /app\.notify\.newMessage\.title/.test(screen));
  ok("the screen offers no add/remove/leave control (membership is derived)", !/removeMember|addMembers|leaveRoom|data-leave-button|data-add-people/.test(screen));

  const keys = [...new Set([...screen.matchAll(/t\("(app\.[A-Za-z.]+)"/g)].map((m) => m[1]))];
  const client = read("lib/company/chat/client.js");
  const refusalKeys = [...client.matchAll(/"(app\.companyChat\.refusal\.[A-Za-z]+)"/g)].map((m) => m[1]);
  const groupKeys = GROUP_ORDER.map((g) => `app.companyChat.group.${g}`);
  const labelKeys = ["owner", "admin", "supervisor", "employee"].map((r) => `app.companyChat.label.${r}`);
  const all = [...new Set([...keys, ...refusalKeys, ...groupKeys, ...labelKeys, "app.nav.chat", "app.companyChat.heading"])];
  const languages = Object.keys(APP_MESSAGES);
  ok("nine languages in the catalogue", languages.length === 9, languages);
  let missing = [];
  for (const lang of languages) for (const k of all) if (APP_MESSAGES[lang][k] == null) missing.push(`${lang}:${k}`);
  ok(`every key the screen asks for exists in all ${languages.length} languages (${all.length} keys)`, missing.length === 0, missing.slice(0, 10));
  ok("the refusal codes the store stamps are all mapped for the screen", ["no_room", "read_only", "empty", "self", "member_unknown", "nobody_named"].every((c) => new RegExp(`\\b${c}:`).test(client)));
  ok("docs/screens/company-chat has the 1280 and 375 captures", ["list-1280.png", "list-375.png", "job-1280.png", "job-375.png", "members-1280.png", "members-375.png", "mention-1280.png", "mention-375.png"].every((f) => existsSync(join(ROOT, "docs/screens/company-chat", f))));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed\n`);
if (failures.length) {
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
