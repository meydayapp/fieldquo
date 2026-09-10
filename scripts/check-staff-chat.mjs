// scripts/check-staff-chat.mjs
//
//   npm run check:staff-chat
//
// FieldQuo's own staff chat: reps in /sales and platform staff in /platform in
// one set of conversations, drawn by the component that already draws texts.
//
// ══ What the model is, and where it came from ═════════════════════════════
//
// Rocket.Chat's, read out of packages/core-typings rather than remembered. A
// Room carries `t` ('c' channel, 'd' direct); a SUBSCRIPTION joins one user to
// one room and holds THAT USER'S state — `open`, `ls` (last seen), `unread`.
// StaffRoomMember is that subscription. A Team there is a Room plus a members
// table (ITeam.roomId), not a separate concept, which is why "sales" and
// "support" here are channels with a `teamKey` rather than a second thing with
// its own screens.
//
// The one part deliberately NOT copied is the stored `unread` number. It is a
// second source of truth about a fact already recorded, and it drifts the
// first time a read is missed. Counting from `lastSeenAt` cannot drift.
//
// ══ Two identities, and the table that is NOT involved ════════════════════
//
// A participant is a PlatformAdmin or a SalesRep, as a nullable pair. The
// first draft of this model used `User`, which is wrong in a way worth
// keeping: `User` is a CONTRACTOR'S EMPLOYEE inside a company tenant, and
// wiring FieldQuo's own staff chat to it would have put a tenant's people in
// the same table as FieldQuo's, one join from each other, on the one boundary
// this product cannot get wrong. Section 5 asserts it stays out.
//
// ══ Executed ══════════════════════════════════════════════════════════════
//
// Sections 1-3 run the shipped functions: a DM opened from either side, a room
// read by one person and not the other, a channel where four people speak in
// turn. No database — the rules are pure and the store is deliberately thin.
//
// Section 4-6 read source DECOMMENTED, because this file discusses membership,
// permissions and /platform/team at length and would match its own prose.
//
// ══ Mutation-tested ═══════════════════════════════════════════════════════
//
// Eleven mutations, all caught, each restored from a `cp` backup named after
// the file's PATH, and the backups are VERIFIED TO EXIST before anything is
// mutated. Both halves of that sentence were learned the hard way in one
// afternoon: a basename-keyed backup restored the wrong `route.js` over two
// others, and a `for f in $FILES` loop silently made no backups at all,
// because zsh does not word-split an unquoted variable — eleven mutations then
// applied cumulatively to files git could not restore, being untracked.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  participantOf,
  sameParticipant,
  directRoomKey,
  participantName,
  participantInitials,
} from "@/lib/staff/participants";
import {
  unreadFor,
  roomTitle,
  roomListRow,
  staffRoomList,
  threadMessages,
  DEFAULT_TEAMS,
} from "@/lib/staff/rooms";
import { speakerOf, groupThread } from "@/lib/sales/messages/grouping";

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

const REP = { kind: "rep", id: "r1" };
const ADMIN = { kind: "user", id: "a1" };

// ═══════════════════════════════════════════════════════════════════════════
section("1. A participant is one of two kinds, and never both");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("a rep membership reads as a rep", participantOf({ salesRepId: "r1" })?.kind === "rep");
  ok("an admin membership reads as an admin", participantOf({ platformAdminId: "a1" })?.kind === "user");
  // Both set is a row nobody can attribute, and picking one puts words in
  // somebody's mouth.
  ok("BOTH set is null, not a guess", participantOf({ salesRepId: "r", platformAdminId: "a" }) === null);
  ok("neither set is null", participantOf({}) === null);
  ok("a non-object is null", participantOf("rep") === null);
  ok("null is null", participantOf(null) === null);

  ok("the same person is the same person", sameParticipant(REP, { kind: "rep", id: "r1" }));
  // The trap this guards: a rep and an admin can share an id string across two
  // tables, and comparing ids alone would make them the same person.
  ok("…and an id alone does not make two people one", !sameParticipant(REP, { kind: "user", id: "r1" }));
  ok("null is nobody", !sameParticipant(null, REP) && !sameParticipant(REP, null));

  // The DM key is what stops two rooms existing for one pair.
  const a = directRoomKey(REP, ADMIN);
  const b = directRoomKey(ADMIN, REP);
  ok("a DM key is the same from either side", a === b && Boolean(a), [a, b]);
  ok("…and differs for a different pair", directRoomKey(REP, { kind: "user", id: "a2" }) !== a);
  ok("a pair with yourself is refused", directRoomKey(REP, REP) === null);
  ok("…including the same id in the other table", directRoomKey(REP, { kind: "rep", id: "r1" }) === null);
  ok("a malformed pair is refused", directRoomKey(REP, { kind: "rep" }) === null);
  ok("no pair at all is refused", directRoomKey(null, null) === null);

  ok("a name comes from whichever side is loaded", participantName({ salesRep: { name: "Daniel" } }) === "Daniel");
  ok("…or the admin's email", participantName({ platformAdmin: { email: "a@b.c" } }) === "a@b.c");
  // Never an id, and never blank: an id in a conversation is worse than an
  // honest placeholder, and blank renders as a gap the reader has to guess at.
  ok("…and is never an id or empty", participantName({}) === "Someone at FieldQuo");
  ok("initials match what the thread gutter draws", participantInitials("Jesus Gandara") === "JG");
  ok("…one word gives two letters", participantInitials("Daniel") === "DA");
  ok("…and nothing gives a dash, not a crash", participantInitials("") === "–");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Unread is counted from lastSeenAt, and your own words never count");
// ═══════════════════════════════════════════════════════════════════════════

{
  const at = (n) => new Date(Date.parse("2026-09-10T10:00:00Z") + n * 60000).toISOString();
  const messages = [
    { id: "1", body: "mine", sentAt: at(0), salesRepId: undefined, authorSalesRepId: "r1" },
    { id: "2", body: "theirs", sentAt: at(10), authorPlatformAdminId: "a1" },
    { id: "3", body: "theirs again", sentAt: at(20), authorPlatformAdminId: "a1" },
    { id: "4", body: "joined", kind: "system", sentAt: at(25), authorPlatformAdminId: "a1" },
  ];

  ok("never seen → every message from others", unreadFor({ messages, lastSeenAt: null, viewer: REP }) === 2, unreadFor({ messages, lastSeenAt: null, viewer: REP }));
  ok("seen at 15 → one", unreadFor({ messages, lastSeenAt: at(15), viewer: REP }) === 1);
  ok("seen after everything → none", unreadFor({ messages, lastSeenAt: at(99), viewer: REP }) === 0);
  // A room where the last word was yours is not waiting on you.
  ok("your own messages never count", unreadFor({ messages: [messages[0]], lastSeenAt: null, viewer: REP }) === 0);
  // A system line is not somebody talking to you.
  ok("a system line never counts", unreadFor({ messages: [messages[3]], lastSeenAt: null, viewer: REP }) === 0);
  ok("no messages → zero", unreadFor({ messages: [], lastSeenAt: null, viewer: REP }) === 0);
  ok("a non-array → zero", unreadFor({ messages: null, lastSeenAt: null, viewer: REP }) === 0);
  ok("an undated message is not counted", unreadFor({ messages: [{ id: "x", authorPlatformAdminId: "a1" }], lastSeenAt: null, viewer: REP }) === 0);
  // The admin's own view of the same room is the mirror image — this is the
  // whole reason unread lives on the membership and not on the room.
  ok("the same room reads differently for the other person", unreadFor({ messages, lastSeenAt: null, viewer: ADMIN }) === 1, unreadFor({ messages, lastSeenAt: null, viewer: ADMIN }));
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. A direct room is named for whoever you are NOT");
// ═══════════════════════════════════════════════════════════════════════════

{
  const room = {
    id: "d1",
    kind: "direct",
    members: [
      { salesRepId: "r1", salesRep: { name: "Daniel" } },
      { platformAdminId: "a1", platformAdmin: { email: "support@fieldquo.com" } },
    ],
    messages: [
      { id: "1", body: "hello", sentAt: "2026-09-10T10:00:00Z", authorPlatformAdminId: "a1" },
      { id: "2", body: "joined", kind: "system", sentAt: "2026-09-10T11:00:00Z", authorPlatformAdminId: "a1" },
    ],
  };
  // The bug this shape invites: showing somebody their own name in their own list.
  ok("the rep sees the admin", roomTitle(room, REP) === "support@fieldquo.com", roomTitle(room, REP));
  ok("the admin sees the rep", roomTitle(room, ADMIN) === "Daniel", roomTitle(room, ADMIN));
  ok("a channel uses its own name", roomTitle({ kind: "channel", name: "Sales" }, REP) === "Sales");
  ok("a nameless channel says so rather than reading blank", roomTitle({ kind: "channel" }, REP) === "Untitled channel");
  ok("no room at all still returns a string", typeof roomTitle(null, REP) === "string");

  const row = roomListRow(room, REP);
  // A system line as the preview tells the reader nothing and buries the last
  // real message.
  ok("the preview is the last thing SOMEBODY SAID", row.lastBody === "hello", row.lastBody);
  ok("…and it was not mine", row.lastWasMine === false);
  ok("the unread count is on the row", row.unread === 1, row.unread);
  ok("the member count is on the row", row.memberCount === 2);

  // Unread first: the list exists to answer "who is waiting on me", and a
  // strictly chronological list buries this morning's question under this
  // afternoon's "thanks".
  // Read by this viewer — a membership row WITH a lastSeenAt after its only
  // message. Without one the room would be "never seen", which is correctly
  // unread, and the fixture would be testing nothing.
  const quiet = {
    id: "q",
    kind: "channel",
    name: "Quiet",
    members: [{ salesRepId: "r1", lastSeenAt: "2026-09-11T12:00:00Z" }],
    messages: [{ id: "z", body: "hi", sentAt: "2026-09-11T10:00:00Z", authorPlatformAdminId: "a1" }],
  };
  const list = staffRoomList([quiet, room], REP);
  ok("the read room really is read", list.find((r) => r.id === "q")?.unread === 0);
  ok("…and it IS the newer one", new Date(quiet.messages[0].sentAt) > new Date(room.messages[0].sentAt));
  ok("a room with unread sorts above a newer one without", list[0].id === "d1", list.map((r) => r.id));
  ok("staffRoomList(null) is []", staffRoomList(null, REP).length === 0);

  const thread = threadMessages(room.messages, ADMIN);
  ok("my own message is outbound", thread[0].direction === "out");
  ok("…and inbound for the other side", threadMessages(room.messages, REP)[0].direction === "in");
  ok("a system row keeps its kind", thread[1].kind === "system");
  ok("every row carries an author name", thread.every((m) => typeof m.who === "string" && m.who));

  ok("there are default teams", DEFAULT_TEAMS.length >= 3, DEFAULT_TEAMS.length);
  ok("…exactly one of which everybody is in", DEFAULT_TEAMS.filter((t) => t.isDefault).length === 1);
  ok("…and every key is unique", new Set(DEFAULT_TEAMS.map((t) => t.teamKey)).size === DEFAULT_TEAMS.length);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. One thread component draws both, and a channel names each speaker");
// ═══════════════════════════════════════════════════════════════════════════

{
  // Rocket.Chat's isMessageSequential breaks a group on the AUTHOR, not the
  // side. Direction alone is the same answer only while there are two parties:
  // in a channel every message from everybody else is "in", so four people
  // talking in turn would group into one block under whoever spoke first.
  ok("an author beats direction", speakerOf({ direction: "in", who: "Daniel" }) !== speakerOf({ direction: "in", who: "Jesus" }));
  ok("…and the same author matches itself", speakerOf({ direction: "in", who: "Daniel" }) === speakerOf({ direction: "in", who: "Daniel" }));
  // SMS rows carry no `who`, and the direction rule is exact for them.
  ok("without an author it is still by side", speakerOf({ direction: "in" }) === "them" && speakerOf({ direction: "out" }) === "us");
  ok("nothing is nobody", speakerOf(null) === null);

  const at = (n) => new Date(Date.parse("2026-09-10T10:00:00Z") + n * 1000).toISOString();
  const rows = groupThread([
    { id: "1", direction: "in", who: "Daniel", body: "a", at: at(0) },
    { id: "2", direction: "in", who: "Daniel", body: "b", at: at(30) },
    { id: "3", direction: "in", who: "Jesus", body: "c", at: at(60) },
  ]).filter((r) => r.kind === "message");
  ok("the same speaker groups", rows[1].sequential === true);
  ok("a different speaker breaks the group", rows[2].sequential === false, rows.map((r) => r.sequential));
  ok("…and is named again", rows[2].showSender === true);

  const t = decomment(read("app/sales/messages/MessageThread.js"));
  ok("the thread renders an author when it has one", /m\.who \|\| them/.test(t));
  ok("…and your own messages stay 'You'", /inbound \? m\.who \|\| them : "You"/.test(t));
  const chat = decomment(read("app/components/staff/StaffChat.js"));
  ok("the staff chat reuses MessageThread rather than its own", /<MessageThread/.test(chat));
  ok("…imported from the texts screen", /from "@\/app\/sales\/messages\/MessageThread"/.test(chat));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Membership is the permission, and User is not involved");
// ═══════════════════════════════════════════════════════════════════════════

{
  const store = decomment(read("lib/staff/store.js"));
  // A role check here would mean an admin can read a DM they are not in, which
  // is not a chat anybody uses honestly.
  ok("a room is fetched by membership", /members: \{ some: memberWhere\(viewer\) \}/.test(store));
  ok("…for the list too", (store.match(/memberWhere\(viewer\)/g) || []).length >= 3);
  ok("posting re-checks membership as a QUERY", /staffRoomMember\.findFirst[\s\S]{0,200}memberWhere\(viewer\)/.test(store));
  ok("…and refuses rather than writing", /if \(!member\) return null;/.test(store));
  ok("saying something marks it seen", /lastSeenAt: new Date\(\)/.test(store));
  ok("the message and the room's order are one transaction", /\$transaction\(\[/.test(store));
  ok("a duplicate DM is caught by the unique index", /P2002/.test(store));

  const route = decomment(read("app/api/staff/rooms/[id]/route.js"));
  // A distinct 403 would confirm that a room with that id exists, which is a
  // fact about somebody else's private conversation.
  ok("not-a-member and does-not-exist answer identically", /status: 404/.test(route) && !/status: 403/.test(route));
  ok("params is awaited, because it is a Promise in Next 16", /await params/.test(route));

  const list = decomment(read("app/api/staff/rooms/route.js"));
  ok("the directory excludes the viewer", /p\.kind === viewer\.kind && p\.id === viewer\.id/.test(list));
  ok("a named person is checked against the live directory", /people\.find\(/.test(list));

  // The wrong table, kept out on purpose.
  const schema = read("prisma/schema.prisma");
  const staff = schema.slice(schema.indexOf("model StaffRoomMember"), schema.indexOf("model StaffMessage"));
  ok("a membership points at PlatformAdmin", /platformAdmin\s+PlatformAdmin\?/.test(staff));
  ok("…and never at User", !/\bUser\?/.test(staff), staff.slice(0, 200));
  const msg = schema.slice(schema.indexOf("model StaffMessage"));
  ok("an author points at PlatformAdmin", /authorPlatformAdmin\s+PlatformAdmin\?/.test(msg));
  ok("…and never at User", !/\bUser\?/.test(msg.slice(0, 1200)));
  ok("the DM key is unique in the database", /directKey String\? @unique/.test(schema));
  ok("…and so is a team's key", /teamKey String\? @unique/.test(schema));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Both screens exist, are reachable, and nothing was written over");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("the rep's screen exists", existsSync(join(ROOT, "app/sales/team/page.js")));
  ok("the platform screen exists", existsSync(join(ROOT, "app/platform/chat/page.js")));
  const sales = decomment(read("app/sales/SalesShell.js"));
  ok("the rep can reach it from the nav", /href: "\/sales\/team"/.test(sales));
  const sidebar = decomment(read("app/components/platform/PlatformSidebar.js"));
  ok("platform staff can reach it from the sidebar", /href: "\/platform\/chat"/.test(sidebar));

  // ── The collision, kept closed ─────────────────────────────────────────
  //
  // /platform/team ALREADY EXISTS and is FieldQuo's staff ACCOUNTS screen —
  // creating admins, setting roles. The chat was briefly written straight over
  // it. It came back from HEAD, but nothing would have noticed if the nav had
  // not happened to list both.
  const accounts = read("app/platform/team/page.js");
  ok("/platform/team is still the accounts screen", /FieldQuo's own staff accounts/.test(accounts), accounts.slice(0, 120));
  ok("…and is not the chat", !/StaffChat/.test(accounts));
  ok("…and is still substantial", accounts.split("\n").length > 300, accounts.split("\n").length);
  ok("the sidebar still points at it", /href: "\/platform\/team"/.test(sidebar));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The check is wired in");
// ═══════════════════════════════════════════════════════════════════════════

{
  const pkg = JSON.parse(read("package.json"));
  ok("check:staff-chat is a script", typeof pkg.scripts?.["check:staff-chat"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:staff-chat"));
}

console.log(`\n${pass} checks, ${failures.length} failure(s).`);
if (failures.length) {
  for (const f of failures) console.log(`  · ${f}`);
  process.exit(1);
}
