// lib/staff/directPush.js
//
// Who is told, by push, when a direct message lands.
//
// ══ Direct rooms push every message; groups push only @mentions ═══════════
//
// A channel is a place; a DM is a person. Pushing every line of #sales to
// everybody would be the notification people switch off in a week, so a
// channel pushes only when somebody's name is said (lib/staff/mentions.js).
// A direct message has exactly one reader and every message in it is FOR
// them — it is an @mention by construction — so it pushes without one.
//
// ══ Except when they are looking at it ════════════════════════════════════
//
// StaffRoomMember.lastOpenedAt is written every time the room is read
// (lib/staff/store.js markRoomSeen, on every GET of the thread — the open,
// and the 15-second poll while it stays open). A reader whose lastOpenedAt
// is younger than DIRECT_PUSH_LOOKING_MS has the conversation on screen, and
// a push for words already in front of them is noise. Thirty seconds covers
// two polls; a tab that went to the background stops polling and starts
// being pushed to within half a minute, which is the right cliff.
//
// Not lastSeenAt: that column is the READ boundary, and it moves only as far
// as the last message the reader was shown (unreadQuery.js seenUpTo). A
// reader staring at a room that has been quiet for an hour has a
// lastSeenAt an hour old and a lastOpenedAt fifteen seconds old; the second
// is the one that says they are looking.
//
// Pure. scripts/check-staff-chat.mjs executes it for a DM, a group, a
// reader who is looking, and the author.
import { participantOf, sameParticipant } from "./participants";

/** A reader seen more recently than this is looking at the room. */
export const DIRECT_PUSH_LOOKING_MS = 30 * 1000;

/** How much of the message the push shows. */
export const DIRECT_PUSH_SNIPPET_CHARS = 80;

/**
 * The one participant to push to, or null.
 *
 * @param room     `{ kind }` — only "direct" pushes
 * @param members  the room's OPEN members: `{ platformAdminId, salesRepId, lastOpenedAt }`
 * @param viewer   the author — never pushed to
 */
export function directPushRecipient({ room, members = [], viewer, now = new Date(), lookingMs = DIRECT_PUSH_LOOKING_MS } = {}) {
  if (!room || room.kind !== "direct") return null;
  const others = (Array.isArray(members) ? members : [])
    .filter((m) => m && m.open !== false)
    .map((m) => ({ participant: participantOf(m), lastOpenedAt: m.lastOpenedAt || null }))
    .filter((m) => m.participant && !sameParticipant(m.participant, viewer));
  // A direct room has two sides. More than one "other" is a broken room,
  // and pushing to a list nobody meant is worse than pushing to nobody.
  if (others.length !== 1) return null;
  const [other] = others;
  if (other.lastOpenedAt) {
    const opened = new Date(other.lastOpenedAt).getTime();
    if (!Number.isNaN(opened) && now.getTime() - opened < lookingMs) return null;
  }
  return other.participant;
}

/** The first N characters, whitespace collapsed, for the push body. */
export function directPushSnippet(text, max = DIRECT_PUSH_SNIPPET_CHARS) {
  const flat = String(text || "").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max).trimEnd()}…`;
}
