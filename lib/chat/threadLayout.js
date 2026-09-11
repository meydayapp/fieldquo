// lib/chat/threadLayout.js
//
// The arithmetic behind a chat thread, with no DOM in it.
//
// ══ What this adds on top of lib/sales/messages/grouping.js ═══════════════
//
// grouping.js already owns the three rules every chat client agrees on — the
// sender named once per group, a group closed by a 300-second gap, a group
// broken at midnight. This file does not restate them; it CALLS groupThread
// and adds the two things a chat client draws that a text thread did not:
//
//   · the "unread messages" divider, placed above the first row somebody
//     else wrote after the reader last looked. Rocket.Chat's
//     MessageListItem draws it from `showUnreadDivider`, which its list
//     computes from the subscription's last-seen instant; here the caller
//     hands in `lastReadAt` and the placement is decided once, in one
//     function, so the sales screen and the team chat cannot disagree about
//     which row it goes above.
//
//   · SYSTEM rows — "they replied STOP", "called, no answer", "check-in
//     sent" — which are events in the conversation rather than speech.
//     They never group with a message on either side and never carry an
//     avatar. grouping.js already refuses to group anything whose `kind` is
//     not "message", so a system row only has to be marked as one.
//
// Everything here is pure and takes its clock as an argument, so
// scripts/check-chat-kit.mjs drives every branch: where the dividers land,
// which rows are sequential, where the unread line sits when the reader has
// never looked, has seen everything, or last looked mid-group.
//
// ══ Why the unread divider is placed here and not by the renderer ═════════
//
// The renderer sees one row at a time. "The first unread row" is a property
// of the whole list — the first row, in thread order, that is somebody
// else's and later than the last read. A component deciding it per row would
// draw the line above EVERY unread row, which is what a first draft of this
// did. A list-level decision made once is the fix, and a pure function is the
// version of it a check can execute.
import { GROUPING_WINDOW_SECONDS, asInstant, groupThread } from "@/lib/sales/messages/grouping";

/** The row kinds a Thread can be asked to draw. */
export const ROW_DAY = "day";
export const ROW_UNREAD = "unread";
export const ROW_MESSAGE = "message";

/** Item kinds that are events rather than speech. */
export const KIND_SYSTEM = "system";

/**
 * Is this item somebody ELSE's, for the purpose of "unread"?
 *
 * A row the reader wrote themselves is never unread — they were there when it
 * was said. Direction is the rule for a two-party text thread; a room with
 * named authors passes `mine` explicitly, because "in" means "everybody but
 * me" there and the author is the only thing that decides it.
 */
export function isTheirs(item) {
  if (!item) return false;
  if (typeof item.mine === "boolean") return !item.mine;
  return item.direction === "in";
}

/**
 * The id of the first unread row, or null.
 *
 * "Unread" is: theirs, a real message (not a draft, not a system row — an
 * event is not something they are waiting for you to read), dated, and later
 * than `lastReadAt`. With no `lastReadAt` at all, the reader has never opened
 * this thread and the first of their messages is where the line goes.
 *
 * Decided on the ORDERED list, so a message that arrived out of order still
 * gets the line where a reader scanning top-to-bottom would want it.
 */
export function firstUnreadId(orderedItems, { lastReadAt = null } = {}) {
  const seen = asInstant(lastReadAt);
  for (const item of orderedItems || []) {
    if (!item || (item.kind && item.kind !== ROW_MESSAGE)) continue;
    if (!isTheirs(item)) continue;
    const at = asInstant(item.at);
    if (!at) continue;
    if (!seen || at.getTime() > seen.getTime()) return item.id ?? null;
  }
  return null;
}

/**
 * How many of their messages are after the last read — the badge number.
 *
 * Same rule as firstUnreadId, counted rather than located, and exported so
 * the list badge and the thread divider are computed from ONE definition of
 * unread. A badge saying 3 above a thread whose line sits above the second
 * row is the kind of small lie a rep stops trusting the screen over.
 */
export function unreadCount(items, { lastReadAt = null } = {}) {
  const seen = asInstant(lastReadAt);
  let n = 0;
  for (const item of items || []) {
    if (!item || (item.kind && item.kind !== ROW_MESSAGE)) continue;
    if (!isTheirs(item)) continue;
    const at = asInstant(item.at);
    if (!at) continue;
    if (!seen || at.getTime() > seen.getTime()) n += 1;
  }
  return n;
}

/**
 * The render list.
 *
 * @param items  `{ id, direction, body, at, kind?, status?, who?, mine? }`.
 *   `kind` is "message" (default), "draft", "note" or "system".
 * @param lastReadAt  when the reader last looked, or null for never.
 * @param windowSeconds / timeZone  passed straight to groupThread.
 *
 * @returns rows of
 *   `{ kind: "day", key, dayKey, at }`
 *   `{ kind: "unread", key }`                      — at most one, above the first unread
 *   `{ kind: "message", key, item, sequential, groupStart, groupEnd,
 *      showSender, showTime, undated, system, unread }`
 *
 * The unread divider goes AFTER a day divider that lands on the same row, so
 * a reader sees "Today" and then "unread messages", which is the order
 * Rocket.Chat's MessageDivider draws them in — the date is the bubble on the
 * rule, the unread label is the rule's own caption.
 */
export function layoutThread(
  items,
  { lastReadAt = null, windowSeconds = GROUPING_WINDOW_SECONDS, timeZone = null } = {},
) {
  const grouped = groupThread(items, { windowSeconds, timeZone });
  if (!grouped.length) return [];

  const ordered = grouped.filter((r) => r.kind === ROW_MESSAGE).map((r) => r.item);
  const unreadId = firstUnreadId(ordered, { lastReadAt });
  const seen = asInstant(lastReadAt);

  const rows = [];
  for (const row of grouped) {
    if (row.kind !== ROW_MESSAGE) {
      rows.push(row);
      continue;
    }
    const item = row.item;
    const system = item.kind === KIND_SYSTEM;
    if (unreadId !== null && item.id === unreadId) {
      rows.push({ kind: ROW_UNREAD, key: `unread:${item.id}` });
    }
    const at = asInstant(item.at);
    const unread =
      !system &&
      (!item.kind || item.kind === ROW_MESSAGE) &&
      isTheirs(item) &&
      Boolean(at) &&
      (!seen || at.getTime() > seen.getTime());
    rows.push({
      ...row,
      system,
      // A system row is drawn without avatar, name or time header: the event
      // sentence carries its own time. It still counts as a group boundary,
      // which grouping.js guarantees by refusing to anchor on a non-message.
      showSender: system ? false : row.showSender,
      showTime: system ? false : row.showTime,
      unread,
    });
  }
  return rows;
}

/**
 * "Today", "Yesterday", or a date — decided, not worded.
 *
 * Returns which of the three it is and, for a date, the Date to format, so
 * the component can pick the t() key and the reader's locale does the rest.
 * Computed by comparing day keys rather than subtracting 24 hours: across a
 * daylight-saving change a message sent 23 hours ago can be two calendar days
 * back, and "Yesterday" over the wrong heading is worse than a date.
 *
 * @param dayKey  "YYYY-MM-DD", as groupThread emits it.
 */
export function dayLabelKind(dayKey, { now = new Date(), timeZone = null } = {}) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
  const today = fmt.format(now);
  const yesterday = fmt.format(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (dayKey === today) return { kind: "today", date: null };
  if (dayKey === yesterday) return { kind: "yesterday", date: null };
  const [y, m, d] = String(dayKey || "").split("-").map(Number);
  if (!y || !m || !d) return { kind: "date", date: null };
  return { kind: "date", date: new Date(y, m - 1, d), sameYear: y === now.getFullYear() };
}

// ═══════════════════════════════════════════════════════════════════════════
// Canned responses — the `!` popup's filter
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score one entry against a query: higher is better, null is no match.
 *
 * Subsequence matching on the TITLE rather than substring — "!chk" should
 * find "Check-in after first week" — with a bonus for a match that starts a
 * word and for consecutive characters, so "check" ranks "check-in" above
 * "chunky desk". The body is searched by substring only: a subsequence over
 * two sentences of text matches almost anything ("ring" is in "fRom … Is …
 * goiNG"), and a popup that lists everything for every query is no filter.
 * Case-folded. The title scores higher, because the title is what the rep
 * remembers.
 */
export function cannedScore(entry, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return 0;
  const scoreIn = (haystack, { fuzzy }) => {
    const h = String(haystack || "").toLowerCase();
    if (!h) return null;
    const direct = h.indexOf(q);
    if (direct >= 0) return 100 - Math.min(direct, 50) + (direct === 0 || /\s/.test(h[direct - 1]) ? 20 : 0);
    if (!fuzzy) return null;
    let hi = 0;
    let score = 0;
    let streak = 0;
    for (const ch of q) {
      const found = h.indexOf(ch, hi);
      if (found < 0) return null;
      const wordStart = found === 0 || /[\s\-_.,]/.test(h[found - 1]);
      streak = found === hi ? streak + 1 : 0;
      score += 1 + streak + (wordStart ? 3 : 0);
      hi = found + 1;
    }
    return score;
  };
  const byTitle = scoreIn(entry?.title, { fuzzy: true });
  if (byTitle !== null) return byTitle + 50;
  // The group next: a rep typing "!check" wants the check-in wordings, whose
  // titles are the REASONS ("Nothing looks wrong") and never say check-in.
  const byGroup = scoreIn(entry?.group, { fuzzy: true });
  if (byGroup !== null) return byGroup + 25;
  return scoreIn(entry?.text, { fuzzy: false });
}

/**
 * The catalogue, filtered and ranked for a query. Empty query → everything,
 * in the caller's order. Stable on ties so the list does not jump about
 * between keystrokes.
 */
export function filterCanned(catalogue, query) {
  const list = (Array.isArray(catalogue) ? catalogue : []).filter(Boolean);
  const q = String(query || "").trim();
  if (!q) return list;
  return list
    .map((entry, index) => ({ entry, index, score: cannedScore(entry, q) }))
    .filter((e) => e.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((e) => e.entry);
}

/**
 * The `!query` token the caret is on, if any.
 *
 * `!` opens the popup only at the start of the text or after whitespace, so
 * "wow!" and "call me at 5!" do not pop a menu mid-sentence. Returns the
 * token's start offset and the query typed after the bang, or null.
 */
export function bangTokenAt(text, caret) {
  const s = String(text || "");
  const end = Math.max(0, Math.min(caret ?? s.length, s.length));
  const head = s.slice(0, end);
  const m = /(?:^|\s)!([^\s!]*)$/.exec(head);
  if (!m) return null;
  const start = end - m[1].length - 1;
  return { start, end, query: m[1] };
}

/** `text` with the `!query` token at `token` replaced by `insert`. */
export function replaceBangToken(text, token, insert) {
  const s = String(text || "");
  if (!token) return s;
  const before = s.slice(0, token.start);
  const after = s.slice(token.end);
  const body = String(insert || "");
  // A space after the inserted text unless one is already there, so the rep
  // can keep typing without the next word gluing on.
  const glue = after.startsWith(" ") || after === "" ? "" : " ";
  return `${before}${body}${glue}${after}`;
}
