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
import { ensureTeamRooms, memberOrAutoJoin, activeStaff } from "@/lib/staff/teams";
import { fakeDb } from "./staffChatFakeDb.mjs";
import {
  slugify,
  validateChannelName,
  canManage,
  canLeave,
  groupOf,
  isJoinable,
  CHANNEL_NAME_MAX,
} from "@/lib/staff/channels";
import { parseMentions, mentionsFor, participantKey, parseParticipantKey, handlesOf } from "@/lib/staff/mentions";

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
section("3b. Everybody is put in the team rooms, and a rep with no row can still post");
// ═══════════════════════════════════════════════════════════════════════════

{
  // What production looked like on launch day: three rooms, ONE member (the
  // admin who had opened the list), zero reps anywhere, a rep refused at a
  // demo. The first version added only the viewer to their own teams.
  const rep = { id: "r1", active: true, endedAt: null, acceptedAt: new Date(), passwordHash: "x" };
  const pending = { id: "r2", active: true, endedAt: null, acceptedAt: null, passwordHash: null };
  const gone = { id: "r3", active: false, endedAt: new Date(), acceptedAt: new Date(), passwordHash: "x" };
  const db = fakeDb({
    admins: [{ id: "a1", active: true }, { id: "a2", active: false }],
    reps: [rep, pending, gone],
    // The legacy key, seeded by the first version, with a member and history.
    rooms: [{ id: "old", kind: "channel", teamKey: "everyone", name: "Everyone", isDefault: true }],
    members: [{ id: "m0", roomId: "old", platformAdminId: "a1" }],
  });

  const staff = await activeStaff({ client: db });
  ok("active staff is the one admin who is active", staff.admins.join() === "a1", staff.admins);
  ok("…and the one rep who can sign in — not pending, not departed", staff.reps.join() === "r1", staff.reps);

  await ensureTeamRooms({ client: db });
  const rooms = db.tables.staffRoom;
  ok("three team rooms exist", rooms.length === 3, rooms.map((r) => r.teamKey));
  ok("the legacy 'everyone' room was RENAMED, not replaced", rooms.find((r) => r.id === "old")?.teamKey === "fieldquo");
  ok("…and is still the default", rooms.find((r) => r.id === "old")?.isDefault === true);
  const fq = rooms.find((r) => r.teamKey === "fieldquo");
  // The slug IS the key, so the unique index reserves a team's name at the
  // database, not only in validateChannelName.
  ok("a team room's slug is its key, so the index reserves the name", rooms.every((r) => r.slug === r.teamKey), rooms.map((r) => r.slug));
  const members = db.tables.staffRoomMember;
  const inRoom = (roomId) => members.filter((m) => m.roomId === roomId && m.open !== false);
  ok("the rep is in #fieldquo without having opened anything", inRoom(fq.id).some((m) => m.salesRepId === "r1"));
  ok("the admin is still in it — same row, not a second one", inRoom(fq.id).filter((m) => m.platformAdminId === "a1").length === 1 && members.find((m) => m.id === "m0"));
  ok("the inactive admin is not", !inRoom(fq.id).some((m) => m.platformAdminId === "a2"));
  ok("the pending rep is not", !inRoom(fq.id).some((m) => m.salesRepId === "r2"));
  ok("the departed rep is not", !inRoom(fq.id).some((m) => m.salesRepId === "r3"));
  const sales = rooms.find((r) => r.teamKey === "sales");
  ok("#sales has the rep AND the admin", inRoom(sales.id).some((m) => m.salesRepId === "r1") && inRoom(sales.id).some((m) => m.platformAdminId === "a1"));

  const before = members.length;
  await ensureTeamRooms({ client: db });
  ok("running it again writes no new rows", members.length === before, [before, members.length]);

  // The write path: a rep whose row does not exist yet posts in #sales.
  members.splice(members.findIndex((m) => m.roomId === sales.id && m.salesRepId === "r1"), 1);
  const joined = await memberOrAutoJoin({ kind: "rep", id: "r1" }, sales.id, { salesRepId: "r1" }, { client: db });
  ok("a rep with no membership row can post in a team room", Boolean(joined?.open), joined);
  ok("…and is a member afterwards", inRoom(sales.id).some((m) => m.salesRepId === "r1"));
  // Somebody who cannot sign in is not let in by the write path either.
  const notStaff = await memberOrAutoJoin({ kind: "rep", id: "r3" }, sales.id, { salesRepId: "r3" }, { client: db });
  ok("a departed rep is refused", notStaff === null);
  // A private group is not a team room; nobody is auto-joined to it.
  db.tables.staffRoom.push({ id: "g1", kind: "channel", name: "west", slug: "west", private: true });
  const stranger = await memberOrAutoJoin({ kind: "rep", id: "r1" }, "g1", { salesRepId: "r1" }, { client: db });
  ok("a group they are not in still refuses", stranger === null);
  // Leaving #sales sticks; leaving #fieldquo does not exist.
  const row = members.find((m) => m.roomId === sales.id && m.salesRepId === "r1");
  row.open = false;
  ok("a rep who left #sales is not put back by the write path", (await memberOrAutoJoin({ kind: "rep", id: "r1" }, sales.id, { salesRepId: "r1" }, { client: db })) === null);
  await ensureTeamRooms({ client: db });
  ok("…nor by the next list read", row.open === false);
  const fqRow = members.find((m) => m.roomId === fq.id && m.salesRepId === "r1");
  fqRow.open = false;
  await ensureTeamRooms({ client: db });
  ok("but nobody stays out of #fieldquo", fqRow.open === true);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3c. Groups: names, slugs, who may do what, and which list they land in");
// ═══════════════════════════════════════════════════════════════════════════

{
  ok("a name slugs to lowercase dashes", slugify("Sales West") === "sales-west", slugify("Sales West"));
  ok("…case and punctuation do not make a second channel", slugify("SALES  WEST!") === "sales-west" && slugify("sales-west") === "sales-west");
  ok("…accents keep their letter", slugify("Équipe Québec") === "equipe-quebec", slugify("Équipe Québec"));
  ok("…and nothing but punctuation is nothing", slugify("!!!") === "");
  ok("…and a long name is cut, not refused, by slugify itself", slugify("a".repeat(100)).length === CHANNEL_NAME_MAX);

  ok("a blank name is refused with a code", validateChannelName("   ").reason === "name_missing");
  ok("a punctuation-only name is refused the same way", validateChannelName("###").reason === "name_missing");
  ok("a long name is refused with its own code", validateChannelName("x".repeat(CHANNEL_NAME_MAX + 1)).reason === "name_too_long");
  // A user must not be able to make a second "#sales" beside the real one.
  ok("a team's name is reserved", validateChannelName("Sales").reason === "name_reserved");
  ok("…however it is spelled", validateChannelName("  FIELDQUO ").reason === "name_reserved");
  ok("a good name passes with its slug", validateChannelName("Sales West").ok === true && validateChannelName("Sales West").slug === "sales-west");
  ok("a non-string is refused, not thrown on", validateChannelName(null).ok === false && validateChannelName(42).ok === false);

  const owner = { kind: "rep", id: "r1" };
  const other = { kind: "rep", id: "r2" };
  const superadmin = { kind: "user", id: "a1", role: "superadmin" };
  const support = { kind: "user", id: "a2", role: "support" };
  const group = { kind: "channel", ownerSalesRepId: "r1" };
  ok("the owner manages their group", canManage(group, owner));
  ok("another rep does not", !canManage(group, other));
  ok("a superadmin does", canManage(group, superadmin));
  ok("a support admin does not", !canManage(group, support));
  ok("a team room has no owner, so only a superadmin manages it", !canManage({ kind: "channel", teamKey: "sales" }, owner) && canManage({ kind: "channel", teamKey: "sales" }, superadmin));
  ok("nobody manages nothing", !canManage(null, owner) && !canManage(group, null));

  ok("the default room cannot be left", canLeave({ isDefault: true }).reason === "default_room");
  ok("a direct message cannot be left", canLeave({ kind: "direct" }).reason === "direct_room");
  ok("a group can", canLeave({ kind: "channel" }).ok === true);
  ok("a team that is not the default can", canLeave({ kind: "channel", teamKey: "support" }).ok === true);

  ok("a public channel is joinable", isJoinable({ kind: "channel", private: false }));
  ok("a private one is not", !isJoinable({ kind: "channel", private: true }));
  ok("a direct room is not", !isJoinable({ kind: "direct", private: false }));

  // One group per room, Rocket.Chat's precedence: unread (when asked), team, channel, direct.
  ok("a team room lands under Teams", groupOf({ kind: "channel", teamKey: "sales", unread: 0 }) === "team");
  ok("a group lands under Channels", groupOf({ kind: "channel", teamKey: null, unread: 0 }) === "channel");
  ok("a DM lands under Direct messages", groupOf({ kind: "direct", unread: 0 }) === "direct");
  ok("unread on top pulls a room out of its group", groupOf({ kind: "direct", unread: 2 }, { unreadOnTop: true }) === "unread");
  ok("…but only when asked", groupOf({ kind: "direct", unread: 2 }) === "direct");
  ok("…and a mention alone counts", groupOf({ kind: "channel", teamKey: "sales", unread: 0, mentions: 1 }, { unreadOnTop: true }) === "unread");
}

// ═══════════════════════════════════════════════════════════════════════════
section("3d. Mentions: parsed on write, by name, counted apart from unread");
// ═══════════════════════════════════════════════════════════════════════════

{
  const members = [
    { kind: "rep", id: "r1", name: "Daniel", email: "daniel@x.com" },
    { kind: "rep", id: "r2", name: "Jesus Gandara", email: "jesus@x.com" },
    { kind: "user", id: "a1", name: "support@fieldquo.com", email: "support@fieldquo.com" },
  ];
  ok("a key is kind:id", participantKey({ kind: "rep", id: "r1" }) === "rep:r1");
  ok("…and parses back", parseParticipantKey("user:a1")?.id === "a1" && parseParticipantKey("user:a1")?.kind === "user");
  ok("…and garbage parses to null", parseParticipantKey("owner:1") === null && parseParticipantKey("") === null);
  ok("an admin answers to the part of the email before the @", handlesOf(members[2]).includes("support"));

  ok("@Daniel mentions Daniel", parseMentions("hey @Daniel can you take it", members).join() === "rep:r1");
  ok("…case-blind", parseMentions("@daniel?", members).join() === "rep:r1");
  ok("a two-word name works with its space", parseMentions("@Jesus Gandara look", members).join() === "rep:r2");
  ok("@support reaches the admin without an address", parseMentions("@support one for you", members).join() === "user:a1");
  ok("…and the full address works too", parseMentions("@support@fieldquo.com", members).join() === "user:a1");
  // "@Dan" is not Daniel, and an address in a sentence is not a mention of
  // whoever shares its local part.
  ok("a prefix is not a mention", parseMentions("@Dan", members).length === 0);
  ok("…and a longer name is not the shorter one — @Danielle is not Daniel", parseMentions("@Danielle is here", members).length === 0);
  ok("an email address is not a mention", parseMentions("mail daniel@x.com", members).length === 0);
  ok("a possessive still counts", parseMentions("@Daniel's turn", members).join() === "rep:r1");
  ok("no @ is nobody", parseMentions("Daniel can you", members).length === 0);
  ok("@all is everybody in the room", parseMentions("@all standup in 5", members).length === 3);
  ok("named twice is listed once", parseMentions("@Daniel @Daniel", members).length === 1);
  ok("no members is nobody", parseMentions("@Daniel", []).length === 0);
  ok("a non-string body is nobody, not a crash", parseMentions(null, members).length === 0);

  const at = (n) => new Date(Date.parse("2026-09-10T10:00:00Z") + n * 60000).toISOString();
  const viewer = { kind: "rep", id: "r1" };
  const messages = [
    { id: "1", body: "@Daniel", sentAt: at(0), authorSalesRepId: "r2", mentions: ["rep:r1"] },
    { id: "2", body: "hi", sentAt: at(5), authorSalesRepId: "r2", mentions: [] },
    { id: "3", body: "@Daniel again", sentAt: at(10), authorSalesRepId: "r2", mentions: ["rep:r1"] },
    { id: "4", body: "@Daniel me", sentAt: at(11), authorSalesRepId: "r1", mentions: ["rep:r1"] },
    { id: "5", body: "joined", kind: "system", sentAt: at(12), authorSalesRepId: "r2", mentions: ["rep:r1"] },
  ];
  ok("mentions are counted apart from unread", mentionsFor({ messages, lastSeenAt: null, viewer }) === 2 && unreadFor({ messages, lastSeenAt: null, viewer }) === 3);
  ok("seen after the first → one", mentionsFor({ messages, lastSeenAt: at(1), viewer }) === 1);
  ok("your own @you never counts", mentionsFor({ messages: [messages[3]], lastSeenAt: null, viewer }) === 0);
  ok("a system line never counts", mentionsFor({ messages: [messages[4]], lastSeenAt: null, viewer }) === 0);
  ok("somebody else's mention is not yours", mentionsFor({ messages, lastSeenAt: null, viewer: { kind: "rep", id: "r2" } }) === 0);
  ok("the list row carries both numbers", roomListRow({ id: "x", kind: "channel", name: "s", members: [{ salesRepId: "r1" }], messages }, viewer).mentions === 2);
  ok("the thread marks the messages that say your name", threadMessages(messages, viewer)[0].mentionsMe === true && threadMessages(messages, viewer)[1].mentionsMe === false);
  ok("a closed membership is not counted as a member", roomListRow({ id: "x", kind: "channel", name: "s", members: [{ salesRepId: "r1" }, { salesRepId: "r2", open: false }], messages: [] }, viewer).memberCount === 1);
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
  // "You" is a catalogue entry since the portal was translated, and this
  // component is shared with /platform — so the assertion is that the OWN-message
  // branch still resolves a first-person label rather than the sender's name.
  ok("…and your own messages stay 'You'",
    /inbound \? m\.who \|\| them : t\("app\.salesText\.senderYou"\)/.test(t));
  // The screen is BUILT ON the shared chat kit — the same pieces the texts
  // screen renders — and draws none of them itself. Two screens that should
  // feel the same are rendered by the same components, not styled twice.
  const chat = decomment(read("app/components/staff/StaffChat.js"));
  ok("the staff chat is built on the chat kit", /from "@\/app\/components\/chat"/.test(chat));
  for (const piece of ["ChatLayout", "RoomList", "Thread", "Composer", "ContextBar"]) {
    ok(`…and renders the kit's ${piece}`, new RegExp(`<${piece}[\\s>]`).test(chat));
  }
  ok("…with the kit's thread arithmetic, not its own", /layoutThread\(items, \{ lastReadAt/.test(chat));
  ok("the list is grouped by the shared rule", /groupOf\(r, \{ unreadOnTop: true \}\)/.test(chat));
  ok("…in the shared order", /GROUP_ORDER\.filter/.test(chat));
  ok("public channels the reader is not in are offered under their own group", /app\.teamChat\.group\.joinable/.test(chat));
  ok("a joinable room is joined through the API, not opened", /staffApi\.join\(row\.id\)/.test(chat));
  ok("mentions are offered from the ROOM's members, not the directory", /const mentionable = useMemo\(\s*\(\) => \(room\?\.members \|\| \[\]\)/.test(chat));
  ok("…and the kit's ! canned list is not wired here", !/canned=/.test(chat));
  ok("a system row is said in the reader's language from its meta", /app\.teamChat\.system\.\$\{meta\.system\}/.test(chat));
  ok("every refusal code the client maps has a catalogue key", (() => {
    const client = decomment(read("lib/staff/client.js"));
    const keys = [...client.matchAll(/"(app\.teamChat\.refusal\.[a-zA-Z]+)"/g)].map((m) => m[1]);
    const en = read("app/i18n/appMessages.js");
    return keys.length >= 14 && keys.every((k) => en.includes(`"${k}":`));
  })());
  // Both mounts render THIS component.
  ok("/sales/team mounts it", /<StaffChat/.test(read("app/sales/team/page.js")));
  ok("/platform/chat mounts it", /<StaffChat/.test(read("app/platform/chat/page.js")));
  ok("…and the platform heading is translated too", /t\("app\.teamChat\.heading"\)/.test(read("app/platform/chat/page.js")));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. Membership is the permission, and User is not involved");
// ═══════════════════════════════════════════════════════════════════════════

{
  const store = decomment(read("lib/staff/store.js"));
  // A role check here would mean an admin can read a DM they are not in, which
  // is not a chat anybody uses honestly.
  // …and OPEN membership: a row with open=false is somebody who left or was
  // removed, and they must not read what was said after.
  ok("a room is fetched by OPEN membership", /members: \{ some: \{ \.\.\.memberWhere\(viewer\), open: true \} \}/.test(store));
  ok("…for the list too", (store.match(/memberWhere\(viewer\)/g) || []).length >= 3);
  ok("posting re-checks membership as a QUERY", /memberOrAutoJoin\(viewer, roomId, memberWhere\(viewer\)\)/.test(store));
  ok("…and refuses rather than writing", /if \(!member\) return null;/.test(store));
  ok("saying something marks it seen", /lastSeenAt: new Date\(\)/.test(store));
  ok("the message and the room's order are one transaction", /\$transaction\(\[/.test(store));
  ok("a duplicate DM is caught by the unique index", /P2002/.test(store));

  const route = decomment(read("app/api/staff/rooms/[id]/route.js"));
  // A distinct 403 would confirm that a room with that id exists, which is a
  // fact about somebody else's private conversation.
  ok("not-a-member and does-not-exist answer identically", /status: 404/.test(route) && !/status: 403/.test(route));
  ok("params is awaited, because it is a Promise in Next 16", /await params/.test(route));

  // The bug the owner hit live: lib/jsonBody is JSON.STRINGIFY (with a
  // better error) and was being called on the REQUEST, which gave the string
  // "{}" — whose .body is undefined — so every send answered 400, member or
  // not. The routes must read the request, not serialise it.
  ok("the thread route reads the request body", /await request\.json\(\)/.test(route));
  ok("…and never stringifies the request", !/jsonBody\(request\)/.test(route));
  const list = decomment(read("app/api/staff/rooms/route.js"));
  ok("the list route reads the request body too", /await request\.json\(\)/.test(list) && !/jsonBody\(request\)/.test(list));
  ok("a named person is checked against the live directory", /resolvePeople\(\[\{ kind, id \}\]\)/.test(list));
  ok("…and a group's members are too", /resolvePeople\(members\)/.test(store));
  // Private rooms are excluded by the QUERY, never filtered after the read.
  ok("joinable rooms are public channels the viewer is not in", /kind: "channel",\s*private: false,\s*NOT: \{ members: \{ some: \{ \.\.\.memberWhere\(viewer\), open: true \} \} \}/.test(store));
  ok("joining a private room answers as if it did not exist", /if \(!room \|\| !isJoinable\(room\)\) return NO_ROOM;/.test(store));
  // Removing NEVER deletes: the row is closed and stamped.
  ok("removing closes the row and stamps removedAt", /data: \{ open: false, removedAt: new Date\(\) \}/.test(store));
  ok("nothing in lib/staff deletes a membership", !/staffRoomMember\.delete/.test(store) && !/staffRoomMember\.deleteMany/.test(store) && !/staffRoomMember\.delete/.test(decomment(read("lib/staff/teams.js"))));
  ok("…or a room", !/staffRoom\.delete/.test(store) && !/staffRoom\.delete/.test(decomment(read("lib/staff/teams.js"))));
  // Twice: once for making a group, once for renaming one.
  ok("a taken slug is the unique index refusing, read back as 409 — on create and on rename", (store.match(/P2002"\) \{?\s*return refuse\(409, "name_taken"/g) || []).length === 2, (store.match(/P2002"\) \{?\s*return refuse\(409, "name_taken"/g) || []).length);
  ok("mentions are parsed on write against the room's open members", /parseMentions\(text, await openMembersOf\(roomId\)\)/.test(store));
  ok("the default room refuses to remove anybody", /room\.isDefault\) return refuse\(400, "default_room"/.test(store));
  ok("the directory leaves out reps who cannot sign in", /reps\.filter\(\(r\) => canAuthenticate\(r\)\)/.test(store));
  ok("…and admins who are switched off", /platformAdmin\.findMany\(\{\s*where: \{ active: true \}/.test(store));

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
