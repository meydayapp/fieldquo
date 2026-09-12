// lib/messaging/rooms.js
//
// The buckets a Page / Instagram / WhatsApp conversation falls into on the
// inbox, and the arithmetic the kit's thread needs — decided once, with no
// DOM in it, so scripts/check-app-messages-kit.mjs executes every rule.
//
// ══ Why the groups are the status, and not a filter beside it ═════════════
//
// The old inbox drew four status chips (All · Open · Waiting · Snoozed ·
// Resolved) above a flat list. On the shared chat kit the list IS the
// sidebar: rooms in titled groups with an unread total on each header, the
// way /sales/messages and the team chat draw theirs. So the four states
// become the groups, in the order of what needs attention:
//
//   Needs a reply    our turn. The status is open and somebody is waiting —
//                    the column lib/messaging/waiting.js keeps for exactly
//                    this sentence, or (for a row written before that column
//                    existed) the last message is theirs.
//   Waiting on them  we answered. The status is pending, or it is open with
//                    nobody waiting on us.
//   Snoozed          parked until a date, and it comes back on that date
//                    (/api/cron/messaging-snooze). Drawn only when it has
//                    rows: a permanent empty "Snoozed" header is noise.
//   Done             an outcome was recorded, or the status is resolved.
//                    Both mean "nobody needs to look at this", and the
//                    month-end review reads the outcome, not the status.
//
// A conversation is in exactly ONE bucket, tested in the order written: done
// first (a resolved thread with a stale waitingSince is not waiting — see
// isWaiting in waiting.js for the same rule), then snoozed, then pending,
// then the open split.

import { readStatus } from "./outcomes";

export const GROUP_NEEDS_REPLY = "needsReply";
export const GROUP_WAITING = "waiting";
export const GROUP_SNOOZED = "snoozed";
export const GROUP_DONE = "done";

/** In display order. The screen maps each key to a translated title. */
export const GROUP_ORDER = Object.freeze([GROUP_NEEDS_REPLY, GROUP_WAITING, GROUP_SNOOZED, GROUP_DONE]);

/** The i18n key for a group's header. One place, so the check and the screen agree. */
export function groupTitleKey(key) {
  return `app.messages.group.${key}`;
}

/**
 * Which bucket one inbox row belongs in.
 *
 * @param thread  `{ status, outcome, waitingSince, lastDirection }` as
 *   /api/messaging/threads emits a row. `lastDirection` is "in" | "out" |
 *   null — the direction of the preview message.
 */
export function groupOf(thread = {}) {
  const status = readStatus(thread.status);
  if (thread.outcome || status === "resolved") return GROUP_DONE;
  if (status === "snoozed") return GROUP_SNOOZED;
  if (status === "pending") return GROUP_WAITING;
  if (thread.waitingSince || thread.lastDirection === "in") return GROUP_NEEDS_REPLY;
  return GROUP_WAITING;
}

/**
 * The list, bucketed and ordered newest-activity-first within each bucket.
 *
 * Every bucket is present even when empty, so a render never trips over a
 * missing key. Rows that are not objects are dropped rather than crashing
 * the whole list on one bad row.
 *
 * @returns `{ needsReply: [], waiting: [], snoozed: [], done: [] }`
 */
export function groupThreads(threads) {
  const groups = Object.fromEntries(GROUP_ORDER.map((k) => [k, []]));
  for (const t of Array.isArray(threads) ? threads : []) {
    if (!t || typeof t !== "object") continue;
    groups[groupOf(t)].push(t);
  }
  const at = (t) => {
    const d = t?.lastMessageAt ? new Date(t.lastMessageAt) : null;
    return d && !Number.isNaN(d.getTime()) ? d.getTime() : 0;
  };
  for (const key of GROUP_ORDER) groups[key].sort((a, b) => at(b) - at(a));
  return groups;
}

// ═══════════════════════════════════════════════════════════════════════════
// The thread: from stored rows to the kit's items
// ═══════════════════════════════════════════════════════════════════════════

/**
 * One stored Message row → one item lib/chat/threadLayout.js lays out.
 *
 * Four stored directions become three kinds:
 *
 *   in / out   a "message" — speech, from them or from us
 *   note       a private note. Its own kind so grouping.js never folds it
 *              into a run of replies, and the renderer paints it as a note.
 *   activity   a "system" row — an event, not something anybody said. The
 *              sentence is NOT built here: it is an i18n key and parameters
 *              (lib/messaging/activity.js), and the screen translates it.
 *
 * A reply the send path recorded as failed carries `status: "failed"` and
 * Meta's own sentence as `error`, which is what the kit draws under it —
 * never the brand tone a delivered reply would get.
 */
export function messageItem(m) {
  if (!m || typeof m !== "object") return null;
  const direction = m.direction;
  if (direction === "activity") {
    return { id: m.id, kind: "system", direction: "in", at: m.sentAt, body: "", activity: m.activity || null };
  }
  if (direction === "note") {
    return { id: m.id, kind: "note", direction: "out", at: m.sentAt, body: m.body || "", attachments: [] };
  }
  const out = direction === "out";
  return {
    id: m.id,
    kind: "message",
    direction: out ? "out" : "in",
    at: m.sentAt,
    body: m.body || "",
    attachments: Array.isArray(m.attachments) ? m.attachments : [],
    status: m.failedReason ? "failed" : "sent",
    error: m.failedReason || null,
    readAt: m.readAt || null,
  };
}

/**
 * Where the red "unread messages" line goes, expressed as the instant the
 * reader had last looked — the input layoutThread() takes.
 *
 * MessageThread stores a COUNT (`unread`), not a timestamp. The count is
 * "how many of their messages arrived since somebody last opened this", so
 * the first unread inbound row is the N-th from the end of the inbound rows,
 * and "last read" is one millisecond before it. Captured by the screen
 * BEFORE the read is recorded, and frozen per thread, so the line does not
 * vanish the instant the PATCH lands — the same rule /sales/messages follows
 * with its readAt.
 *
 * @returns Date | null   null = never read (the line goes above their first
 *          message); a Date past every row = nothing unread (no line).
 */
export function lastReadInstant(messages, unread) {
  const list = Array.isArray(messages) ? messages : [];
  const n = Math.max(0, Math.floor(Number(unread) || 0));
  const inbound = list.filter((m) => m && m.direction === "in" && m.sentAt);
  if (n <= 0 || !inbound.length) {
    // Everything read: an instant at or after the newest row.
    let max = 0;
    for (const m of list) {
      const t = m?.sentAt ? new Date(m.sentAt).getTime() : NaN;
      if (Number.isFinite(t) && t > max) max = t;
    }
    return max ? new Date(max) : new Date();
  }
  if (n >= inbound.length) return null;
  const first = new Date(inbound[inbound.length - n].sentAt).getTime();
  if (!Number.isFinite(first)) return null;
  return new Date(first - 1);
}
