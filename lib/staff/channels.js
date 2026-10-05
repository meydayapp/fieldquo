// lib/staff/channels.js
//
// What a channel may be called, and who may do what to one.
//
// Pure. No I/O — scripts/check-staff-chat.mjs drives every branch
// with hostile names, and the client component imports slugify to show a rep
// what "#Sales West!" is about to become before they press create.
import { TEAM_KEYS } from "./rooms";
import { participantOf, sameParticipant } from "./participants";
import { CHANNEL_NAME_MAX, slugify, validateChannelName as validateName } from "@/lib/chat/channelName";

// The name rules themselves — the ceiling, the slug, the refusal codes — are
// lib/chat/channelName.js, shared with the company crew chat so the two
// cannot drift. What is the staff chat's own is the reserved list: a team's
// slug is its key, and a user must not be able to make a second "#sales"
// beside the real one.

export { CHANNEL_NAME_MAX, slugify };

/**
 * Is this a name a staff channel may have? Returns { ok, slug, reason }.
 * The shared rule (ASCII slugs, as the staff chat's existing slugs were made)
 * with the team keys reserved.
 */
export function validateChannelName(name) {
  return validateName(name, { reserved: TEAM_KEYS });
}

/** The owner of a room, as a participant pair, or null for a team room. */
export function ownerOf(room) {
  return participantOf(room, { userField: "ownerPlatformAdminId", repField: "ownerSalesRepId" });
}

/**
 * May this viewer rename the room, set its topic, or remove somebody?
 *
 * The owner may; a superadmin may — that is FieldQuo's own staff and the
 * console rule ("view everything") does not apply to FieldQuo's own rooms.
 * A team room has no owner, so only a superadmin manages it, and even they
 * cannot rename it: the screen names teams from the catalogue by teamKey.
 */
export function canManage(room, viewer) {
  if (!room || !viewer) return false;
  if (viewer.kind === "user" && viewer.role === "superadmin") return true;
  return sameParticipant(ownerOf(room), viewer);
}

/**
 * May this viewer leave this room? Returns { ok, reason }.
 *
 * Nobody leaves the default room — its reason for existing is that everyone
 * is in it. A direct room is not left either: it is between two people and
 * "leaving" it would leave the other one talking to nobody; hide it instead.
 */
export function canLeave(room) {
  if (!room) return { ok: false, reason: "no_room" };
  if (room.isDefault) return { ok: false, reason: "default_room" };
  if (room.kind === "direct") return { ok: false, reason: "direct_room" };
  return { ok: true, reason: null };
}

/**
 * Which list group a room the viewer is in belongs to. One group per room,
 * in Rocket.Chat's order of precedence (useCategoryList's getRoomCategory):
 * unread first when the caller asks for it, then teams, channels, directs.
 */
export function groupOf(row, { unreadOnTop = false } = {}) {
  if (!row) return null;
  if (unreadOnTop && (row.unread > 0 || row.mentions > 0)) return "unread";
  if (row.kind === "direct") return "direct";
  if (row.teamKey) return "team";
  return "channel";
}

/** The group order, so every screen draws them the same way round. */
export const GROUP_ORDER = ["unread", "team", "channel", "direct"];

/**
 * Whether a room the viewer is NOT in may be shown to them as joinable.
 * Public channels only — a private channel's existence is a fact about the
 * people in it.
 */
export function isJoinable(room) {
  return Boolean(room && room.kind === "channel" && !room.private);
}
