// lib/staff/rooms.js
//
// The staff conversation list, and what each room is called.
//
// ══ Unread is counted, never stored ═══════════════════════════════════════
//
// Rocket.Chat's subscription carries both `ls` (last seen) and a stored
// `unread` number. The number is the part NOT copied here, deliberately: a
// stored counter is a second source of truth about the same fact, and it
// drifts the first time a message is removed, a read is missed, or two tabs
// mark the same room read at once. Counting messages after `lastSeenAt` cannot
// drift — it is derived from the thing it describes.
//
// The cost is a count per room instead of a column read. At FieldQuo's staff
// headcount that is arithmetic over rows already loaded for the preview, so
// the trade is free; it would not be at Rocket.Chat's scale, which is why they
// store it and this does not.
//
// ══ A direct room has no name ═════════════════════════════════════════════
//
// It is named for whoever the VIEWER is not — which is a per-viewer question
// and therefore not a column. Storing "Daniel" on the room would show Daniel
// his own name in his own list, which is the small wrong detail that makes a
// chat feel like a database.
//
// Pure over rows the caller has read. scripts/check-staff-chat.mjs drives it.
import { participantOf, sameParticipant, participantName } from "./participants";

/**
 * The team rooms the seed guarantees, so a new hire always has somewhere to
 * talk. Pure data; lib/staff/teams.js is what writes them.
 *
 * `fieldquo` is the one nobody can leave. It was briefly keyed "everyone";
 * ensureTeamRooms() renames that row IN PLACE rather than creating a second
 * room beside it, so the history in it survives.
 *
 * `autoJoin` is who is put in without asking. Everybody is in all three —
 * the reps AND the people who back them up, because the owner's rule is that
 * a rep can reach anybody at FieldQuo from one screen. Only #fieldquo refuses
 * to let anybody leave.
 */
export const DEFAULT_TEAMS = [
  {
    teamKey: "fieldquo",
    name: "fieldquo",
    topic: "Everybody at FieldQuo. Nobody can leave this one.",
    isDefault: true,
    autoJoin: ["reps", "admins"],
  },
  {
    teamKey: "sales",
    name: "sales",
    topic: "The reps on the phones, and the people who back them up.",
    isDefault: false,
    autoJoin: ["reps", "admins"],
  },
  {
    teamKey: "support",
    name: "support",
    topic: "Where a rep hands a customer problem to somebody who can fix it.",
    isDefault: false,
    // Reps too, for now: at launch nobody may be locked out of a room they
    // were told about. The owner's rule is that #support is where a rep hands
    // a problem over, and a rep who is not in it cannot hand anything over.
    autoJoin: ["reps", "admins"],
  },
];

/** The team keys, so nothing else spells them. */
export const TEAM_KEYS = DEFAULT_TEAMS.map((t) => t.teamKey);

/** Is a participant of this kind put into this team without asking? */
export function autoJoins(team, kind) {
  if (!team || !Array.isArray(team.autoJoin)) return false;
  return team.autoJoin.includes(kind === "rep" ? "reps" : "admins");
}

/**
 * How many messages in this room the viewer has not seen.
 *
 * Their OWN messages never count. A room where the last word was yours is not
 * waiting on you, and counting it puts a badge on every conversation the
 * moment you speak in it.
 */
export function unreadFor({ messages = [], lastSeenAt = null, viewer = null } = {}) {
  const rows = Array.isArray(messages) ? messages : [];
  const since = lastSeenAt ? new Date(lastSeenAt).getTime() : null;
  return rows.filter((m) => {
    if (!m) return false;
    // A system line is not somebody talking to you.
    if (m.kind === "system") return false;
    const author = participantOf(m, { userField: "authorPlatformAdminId", repField: "authorSalesRepId" });
    if (viewer && sameParticipant(author, viewer)) return false;
    const at = m.sentAt ? new Date(m.sentAt).getTime() : null;
    if (at === null || Number.isNaN(at)) return false;
    // Never seen at all: everything from other people is unread. That is the
    // right answer for a member who has just been added to a channel.
    if (since === null || Number.isNaN(since)) return true;
    return at > since;
  }).length;
}

/**
 * What to call a room, from this viewer's side.
 *
 * A channel uses its own name. A direct room uses the name of the member who
 * is not the viewer — and when that member cannot be resolved, it says so
 * rather than falling back to the viewer's own name, which is the bug this
 * shape invites.
 */
export function roomTitle(room, viewer) {
  if (!room) return "Conversation";
  if (room.kind !== "direct") return room.name || "Untitled channel";
  const others = (room.members || []).filter(
    (m) => !sameParticipant(participantOf(m), viewer),
  );
  if (!others.length) return "Just you";
  return others.map((m) => participantName(m)).join(", ");
}

/**
 * One row of the conversation list, shaped to match what the SMS list renders
 * so the two screens can share a component rather than diverge.
 */
export function roomListRow(room, viewer) {
  const messages = Array.isArray(room?.messages) ? room.messages : [];
  // The last thing SOMEBODY SAID, not the last row. A system line ("Daniel
  // joined") as the preview tells the reader nothing about the conversation
  // and pushes the actual last message out of the list — the room reads as if
  // nothing has happened in it since somebody joined.
  const spoken = messages.filter((m) => m && m.kind !== "system");
  const last = spoken.length ? spoken[spoken.length - 1] : null;
  const mine = (room?.members || []).find((m) => sameParticipant(participantOf(m), viewer)) || null;
  const lastAuthor = last
    ? participantOf(last, { userField: "authorPlatformAdminId", repField: "authorSalesRepId" })
    : null;
  return {
    id: room.id,
    kind: room.kind,
    teamKey: room.teamKey || null,
    title: roomTitle(room, viewer),
    topic: room.topic || null,
    memberCount: (room?.members || []).length,
    lastBody: last?.body || null,
    lastAt: last?.sentAt || room?.lastMessageAt || null,
    // So the list can prefix "You:" exactly as the texts list does.
    lastWasMine: Boolean(lastAuthor && sameParticipant(lastAuthor, viewer)),
    unread: unreadFor({ messages, lastSeenAt: mine?.lastSeenAt || null, viewer }),
  };
}

/**
 * The whole list, unread first and then by recency.
 *
 * Unread first because the list exists to answer "who is waiting on me". A
 * strictly chronological list buries a question asked this morning under three
 * channels that got a "thanks" this afternoon.
 */
export function staffRoomList(rooms = [], viewer = null) {
  return (Array.isArray(rooms) ? rooms : [])
    .map((r) => roomListRow(r, viewer))
    .sort((a, b) => {
      if (Boolean(a.unread) !== Boolean(b.unread)) return a.unread ? -1 : 1;
      const at = a.lastAt ? new Date(a.lastAt).getTime() : 0;
      const bt = b.lastAt ? new Date(b.lastAt).getTime() : 0;
      return bt - at;
    });
}

/**
 * The messages, in the shape MessageThread already reads.
 *
 * `direction` is "out" for the viewer's own and "in" for everybody else's,
 * which is the same word the SMS thread uses — that is what lets one component
 * draw a staff channel and a text conversation without knowing the difference.
 * `who` carries the author's name so a channel with four people in it can put
 * the right name above each group, which a two-party SMS thread never needs.
 */
export function threadMessages(messages = [], viewer = null) {
  return (Array.isArray(messages) ? messages : []).map((m) => {
    const author = participantOf(m, { userField: "authorPlatformAdminId", repField: "authorSalesRepId" });
    return {
      id: m.id,
      body: m.body,
      at: m.sentAt,
      kind: m.kind === "system" ? "system" : undefined,
      direction: sameParticipant(author, viewer) ? "out" : "in",
      who: participantName(m, { userField: "authorPlatformAdmin", repField: "authorSalesRep" }),
    };
  });
}
