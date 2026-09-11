// lib/staff/channels.js
//
// What a channel may be called, and who may do what to one.
//
// Pure. No imports, no I/O — scripts/check-staff-chat.mjs drives every branch
// with hostile names, and the client component imports slugify to show a rep
// what "#Sales West!" is about to become before they press create.
import { TEAM_KEYS } from "./rooms";
import { participantOf, sameParticipant } from "./participants";

/** Rocket.Chat's channel-name ceiling, near enough. Longer is a sentence. */
export const CHANNEL_NAME_MAX = 40;

/**
 * The stored key for a channel name.
 *
 * Lowercase, spaces and runs of punctuation to one dash, nothing but
 * [a-z0-9-_] survives. "Sales West" and "sales-west" and "SALES  WEST!" are
 * the same channel, which is the whole point: the unique index on `slug` is
 * what stops a second one, and an index can only compare what it is given.
 *
 * Accented letters are stripped to their base (é → e) rather than dropped, so
 * "#Équipe Québec" becomes "equipe-quebec" and not "quipe-qubec".
 */
export function slugify(name) {
  return String(name || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, CHANNEL_NAME_MAX);
}

/**
 * Is this a name a channel may have? Returns { ok, slug, reason }.
 *
 * `reason` is a CODE — the route puts the sentence in `error` and the code in
 * `code`, the same shape lib/sales/authRefusals.js uses, so the screen can
 * say it in the reader's language.
 */
export function validateChannelName(name) {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!raw) return { ok: false, slug: null, reason: "name_missing" };
  if (raw.length > CHANNEL_NAME_MAX) return { ok: false, slug: null, reason: "name_too_long" };
  const slug = slugify(raw);
  // "!!!" slugs to nothing, and a channel called "" is not a channel.
  if (!slug) return { ok: false, slug: null, reason: "name_missing" };
  // A team's slug is its key; a user must not be able to make a second
  // "#sales" beside the real one. The index would refuse it anyway, but the
  // refusal should say why.
  if (TEAM_KEYS.includes(slug)) return { ok: false, slug, reason: "name_reserved" };
  return { ok: true, slug, reason: null };
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
