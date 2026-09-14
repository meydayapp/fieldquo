// lib/staff/auditRules.js
//
// The rules behind the owner reading a staff conversation they are not in.
//
// ══ What this is, and what it is not ══════════════════════════════════════
//
// The staff chat's permission model is "membership is the permission"
// (lib/staff/store.js): a room is readable by the people in it, and a
// superadmin who is not in a DM cannot read it through /api/staff/*. That
// stays true. This is the ONE exception, and it is shaped so the exception
// cannot quietly become the rule:
//
//   · superadmin-only — "chat:audit" is in SUPERADMIN_ONLY_PERMISSIONS
//     (lib/platform/permissions.js), and admin/support never hold it;
//   · read-only — there is no post path from the audit screen, and the
//     auditor is NEVER added as a member. A member changes a room's
//     mentions and unread for everybody in it (lib/staff/rooms.js counts
//     from lastSeenAt per member), and a room whose membership silently
//     grew would tell the two people in a DM that a third was there;
//   · announced — every open writes a PlatformAuditLog row AND posts a
//     system line into the room, visible to its participants: "Emilio
//     (owner) viewed this conversation on 14 Sep 2026". Transparency is the
//     design, not a setting. A chat people are secretly read in is not a
//     chat people use honestly; a chat where the reading is said out loud
//     is one where the reader is accountable for it.
//
// ══ Why one line per look, not one per request ════════════════════════════
//
// The audit screen pages backwards through history and polls the open room.
// A system line per HTTP request would fill the room with the owner's own
// footprints — twenty lines for one read — and the participants would stop
// reading them, which defeats the line. So the line is posted once per
// LOOK: if this same admin's last audit line in this room is younger than
// AUDIT_LINE_WINDOW_MS, the request is a continuation of that look and
// posts nothing. The PlatformAuditLog row is written on EVERY request
// regardless, with `continued: true` on the ones that posted no line — the
// log is the complete record, the line is the courtesy.
//
// Pure. scripts/check-staff-chat.mjs executes every function here.
import { participantOf, participantName } from "./participants";

/** A second request within this window is the same look, not a new one. */
export const AUDIT_LINE_WINDOW_MS = 10 * 60 * 1000;

/** The most messages one audit page returns; the screen pages for more. */
export const AUDIT_PAGE_MAX = 200;
export const AUDIT_PAGE_DEFAULT = 100;

/**
 * What to call the auditor in the room. PlatformAdmin has no name column —
 * the chat shows admins by email everywhere — but a system line that reads
 * "emilio.boves@gmail.com (owner) viewed…" reads like a log entry, not like
 * a person, so the local part's first word is capitalised: "Emilio". The
 * email travels in the line's meta so nothing is lost.
 */
export function auditorDisplayName(email) {
  const local = String(email || "").split("@")[0];
  const first = local.split(/[._\-+]/).filter(Boolean)[0] || local;
  if (!first) return "The owner";
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/** The stored English sentence. The screen says it from meta, translated. */
export function auditLineBody({ name, at }) {
  const d = at instanceof Date ? at : new Date(at);
  const date = Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
  return `${name} (owner) viewed this conversation${date ? ` on ${date}` : ""}`;
}

/**
 * Should this request post a new system line?
 *
 * @param latest  this admin's most recent audit line in this room, as
 *   `{ sentAt }`, or null when they have never looked.
 */
export function needsAuditLine({ latest = null, now = new Date(), windowMs = AUDIT_LINE_WINDOW_MS } = {}) {
  if (!latest?.sentAt) return true;
  const at = new Date(latest.sentAt).getTime();
  if (Number.isNaN(at)) return true;
  return now.getTime() - at >= windowMs;
}

/** Clamp a page size the browser sent. */
export function auditPageSize(limit) {
  const n = Number.parseInt(limit, 10);
  if (!Number.isFinite(n) || n < 1) return AUDIT_PAGE_DEFAULT;
  return Math.min(n, AUDIT_PAGE_MAX);
}

/** The people in a room, as `{ kind, id, name, email, open }`. */
export function auditParticipants(members = []) {
  return (Array.isArray(members) ? members : [])
    .map((m) => {
      const p = participantOf(m);
      if (!p) return null;
      return {
        ...p,
        name: participantName(m),
        email: m.platformAdmin?.email || m.salesRep?.email || null,
        // Closed members are listed — they were in it — but marked, so the
        // screen can say "left" rather than count them as present.
        open: m.open !== false,
      };
    })
    .filter(Boolean);
}

/**
 * One room in the audit list. Named for everyone in it, because the auditor
 * is on nobody's side: a DM is "Daniel ↔ Jesus", never "Daniel".
 */
export function auditRoomRow(room) {
  const participants = auditParticipants(room?.members);
  const present = participants.filter((p) => p.open);
  const title =
    room?.kind === "direct"
      ? present.map((p) => p.name).join(" ↔ ") || "Direct message"
      : `#${room?.slug || room?.name || "untitled"}`;
  return {
    id: room?.id,
    kind: room?.kind === "direct" ? "direct" : room?.teamKey ? "team" : "group",
    title,
    slug: room?.slug || null,
    teamKey: room?.teamKey || null,
    private: Boolean(room?.private),
    participants: present,
    memberCount: present.length,
    lastMessageAt: room?.lastMessageAt || null,
    messageCount: room?._count?.messages ?? null,
  };
}

/**
 * The messages, in the shape the chat kit's Thread reads — but with every
 * row `direction: "in"`. The auditor said none of these, so nothing is
 * "out"; the author's name is on every group instead, which is what the
 * kit already does for a channel.
 */
export function auditThreadMessages(messages = []) {
  return (Array.isArray(messages) ? messages : []).map((m) => ({
    id: m.id,
    body: m.body,
    at: m.sentAt,
    kind: m.kind === "system" ? "system" : "message",
    direction: "in",
    who: participantName(m, { userField: "authorPlatformAdmin", repField: "authorSalesRep" }),
    meta: m.kind === "system" && m.meta && typeof m.meta === "object" ? m.meta : null,
  }));
}
