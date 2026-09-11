// lib/staff/mentions.js
//
// Who a message names with an @.
//
// ══ Names, not usernames ══════════════════════════════════════════════════
//
// Rocket.Chat mentions @username, a single token with no spaces. FieldQuo's
// staff have no username: a rep has a name ("Jesus Gandara") and a platform
// admin has only an email. So a mention here is "@" followed by a member's
// display name — spaces included — or, for an admin, the part of their email
// before the @, so "@support" reaches support@fieldquo.com without anybody
// typing an address into a sentence.
//
// Parsed ON WRITE against the members of the room at that moment, and stored
// on the message (StaffMessage.mentions). Re-parsing on read would let a
// member added tomorrow acquire a mention from a message sent today, and a
// rename would silently drop one.
//
// Pure. The check drives it with names that contain each other.

/** The strings a member answers to when they follow an "@". */
export function handlesOf(member) {
  const out = new Set();
  const name = member?.name || member?.salesRep?.name || null;
  const email = member?.email || member?.salesRep?.email || member?.platformAdmin?.email || null;
  if (name) out.add(String(name).trim());
  if (email) {
    out.add(String(email).trim());
    const local = String(email).split("@")[0];
    if (local) out.add(local);
  }
  return [...out].filter(Boolean);
}

/** The key a mention is stored as. Same spelling as directRoomKey's halves. */
export function participantKey(p) {
  if (!p?.kind || !p?.id) return null;
  return `${p.kind}:${p.id}`;
}

/** The inverse, or null for anything that is not "kind:id". */
export function parseParticipantKey(key) {
  const m = /^(user|rep):(.+)$/.exec(String(key || ""));
  return m ? { kind: m[1], id: m[2] } : null;
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * The participant keys of every member the body mentions.
 *
 * @param body     the message text
 * @param members  [{ kind, id, name, email }] — the room's OPEN members
 *
 * A handle matches case-insensitively, must follow a non-word character or
 * the start, and must be followed by a non-letter or the end, so "@Dan" does
 * not mention Daniel and "@Daniel's" does. "@all" and "@everyone" mention
 * every member, the way Rocket.Chat's group mentions do. A member is listed
 * once however many times they are named.
 */
export function parseMentions(body, members = []) {
  const text = typeof body === "string" ? body : "";
  if (!text.includes("@")) return [];
  const rows = Array.isArray(members) ? members : [];

  const everyone = /(^|[^\w@])@(all|everyone)(?![\p{L}\p{N}_])/iu.test(text);
  const out = [];
  for (const m of rows) {
    const key = participantKey(m);
    if (!key) continue;
    if (everyone) { out.push(key); continue; }
    const hit = handlesOf(m).some((h) =>
      new RegExp(`(^|[^\\w@])@${escapeRe(h)}(?![\\p{L}\\p{N}_])`, "iu").test(text),
    );
    if (hit) out.push(key);
  }
  return [...new Set(out)];
}

/**
 * How many of these messages mention this viewer and are unread.
 *
 * Counted, never stored, for the reason unreadFor gives: a stored counter is
 * a second source of truth that drifts. A viewer's own messages never count
 * even when they @ themselves.
 */
export function mentionsFor({ messages = [], lastSeenAt = null, viewer = null } = {}) {
  const key = participantKey(viewer);
  if (!key) return 0;
  const since = lastSeenAt ? new Date(lastSeenAt).getTime() : null;
  return (Array.isArray(messages) ? messages : []).filter((m) => {
    if (!m || m.kind === "system") return false;
    if (!Array.isArray(m.mentions) || !m.mentions.includes(key)) return false;
    const mine =
      (viewer.kind === "user" && m.authorPlatformAdminId === viewer.id) ||
      (viewer.kind === "rep" && m.authorSalesRepId === viewer.id);
    if (mine) return false;
    const at = m.sentAt ? new Date(m.sentAt).getTime() : null;
    if (at === null || Number.isNaN(at)) return false;
    if (since === null || Number.isNaN(since)) return true;
    return at > since;
  }).length;
}
