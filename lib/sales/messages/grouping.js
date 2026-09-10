// lib/sales/messages/grouping.js
//
// What turns a list of rows into something that reads like a text conversation.
//
// ══ Why this is a file and not fifteen lines inside the component ══════════
//
// Grouping is the whole difference between a messenger and a table. It is also
// entirely arithmetic on timestamps — which day is this, how long since the
// last one, was it the same person — and arithmetic on timestamps is where the
// bugs are: a window that is off by a factor of a thousand, a day boundary
// computed in the wrong zone, a thread that arrives out of order because two
// rows share a second. None of that is visible by looking at a screen with
// four messages on it.
//
// So it is pure, it takes its clock and its zone as arguments, and
// scripts/check-sales-messages.mjs drives every branch with no DOM. AGENTS.md:
// "execute pure functions against hostile input" — most of the real bugs in
// this repo were found that way.
//
// ══ Where the rules came from ══════════════════════════════════════════════
//
// The behaviour is the one every chat client has converged on, and Rocket.Chat
// states it most plainly: consecutive messages from the SAME sender collapse
// into a group when they fall inside a short window; the window is measured in
// seconds and defaults to 300; grouping BREAKS at a day boundary regardless of
// the window; and system messages never group. Those four rules are
// reimplemented here from that description — no source, markup, class name or
// file was copied from that project, which is separately licensed.
//
// ══ Why the day break is not implied by the window ═════════════════════════
//
// It looks redundant: two messages 60 seconds apart are almost never on
// different days. Almost. 23:59:30 and 00:00:10 are 40 seconds apart and
// belong under different date headings, and a reader scanning for "what did
// they say on Tuesday" needs the heading to be where the date changes rather
// than where the gap happens to be long. The two rules answer different
// questions and the cheap one does not subsume the other.

/**
 * How long a group stays open, in SECONDS.
 *
 * 300 is Rocket.Chat's default `Message_GroupingPeriod` and it is the right
 * order of magnitude for this thread specifically: a rep types a reply, thinks,
 * and types a second line — that is one utterance and should look like one.
 * Ten minutes later is a new thought and gets its own timestamp.
 *
 * Not configurable per rep. A per-user setting here would mean two reps
 * describing the same conversation differently to each other, for a preference
 * nobody has ever asked for.
 */
export const GROUPING_WINDOW_SECONDS = 300;

/** Seconds → milliseconds, once, so no call site does the multiplication. */
const SECOND_MS = 1000;

/**
 * A Date, or null for anything that is not a readable instant.
 *
 * Null rather than `new Date()`. A row whose `sentAt` we cannot read is a row
 * with no position in time; giving it "now" would file it at the bottom of the
 * thread as the most recent thing said, which is an invention. AGENTS.md
 * failure class #5.
 */
export function asInstant(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Intl formatters are expensive to construct and this runs per message pair on
// every render. One per zone, built on demand.
const dayFormatters = new Map();
function dayKeyFormatter(timeZone) {
  if (!dayFormatters.has(timeZone)) {
    dayFormatters.set(
      timeZone,
      new Intl.DateTimeFormat("en-CA", {
        // en-CA gives YYYY-MM-DD, which sorts and compares as a string. The
        // parts are never parsed back into a date, so the locale is an
        // implementation detail rather than a display decision.
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        ...(timeZone ? { timeZone } : {}),
      }),
    );
  }
  return dayFormatters.get(timeZone);
}

/**
 * The calendar day an instant falls on, as a sortable string, in one zone.
 *
 * @param timeZone an IANA zone, or null for the reader's own. Null is the
 *   right default for THIS screen — the rep is the reader, the headings are
 *   for them, and a thread headed in the contractor's zone would tell a rep in
 *   Toronto that they sent something "yesterday" when they sent it this
 *   morning. The parameter exists so the check can pin a zone and so a future
 *   caller with a different reader does not have to fork the function.
 */
export function dayKey(value, timeZone = null) {
  const at = asInstant(value);
  if (!at) return null;
  try {
    return dayKeyFormatter(timeZone).format(at);
  } catch {
    // An unknown zone name makes Intl throw. Falling back to the reader's own
    // zone keeps the thread readable; silently returning null would collapse
    // every divider and hide the day boundaries entirely.
    return dayKeyFormatter(null).format(at);
  }
}

/**
 * Do these two instants fall on the same calendar day?
 *
 * A null on either side is NOT the same day — an undated row cannot be said to
 * share a day with anything.
 */
export function isSameLocalDay(a, b, timeZone = null) {
  const ka = dayKey(a, timeZone);
  const kb = dayKey(b, timeZone);
  return Boolean(ka) && ka === kb;
}

/**
 * Does `current` open a new calendar day relative to `previous`?
 *
 * True when there is no previous, so the very first message in a thread gets a
 * date heading like every other day does. A thread whose first day is the only
 * unlabelled one reads as though it started at an unknown time.
 */
export function startsNewDay(current, previous, timeZone = null) {
  if (!previous) return true;
  return !isSameLocalDay(current?.at, previous?.at, timeZone);
}

/**
 * Who said it, as an identity two rows can be compared on.
 *
 * Direction rather than a person: the outbound half of this thread goes from
 * ONE SHARED sales number, so "who sent it" is not the rep — a colleague's
 * text and this rep's text arrive on the contractor's phone from the same
 * number and are the same voice as far as the conversation is concerned.
 * Grouping on the rep id would split a group that the contractor sees as
 * continuous.
 */
export function speakerOf(item) {
  if (!item) return null;
  return item.direction === "in" ? "them" : "us";
}

/**
 * May this row be part of a group at all?
 *
 * Three kinds of row are deliberately never grouped:
 *
 *   · anything that is not a delivered message — a DRAFT waiting for the rep
 *     to press send, or a note about the conversation. Rocket.Chat's rule is
 *     "system messages never group" and this is the same rule: a row that is
 *     not somebody speaking must not be absorbed into somebody's speech.
 *   · a FAILED send. It carries its own explanation and its own retry, and
 *     tucking that under a previous message's header hides both.
 *   · a row with no readable timestamp, which has no position to group at.
 */
export function isGroupable(item) {
  if (!item) return false;
  if (item.kind && item.kind !== "message") return false;
  if (item.status === "failed") return false;
  return Boolean(asInstant(item.at));
}

/**
 * Is `current` a continuation of `previous` rather than a new group?
 *
 * The window is compared with `<`, not `<=`: at exactly the window length the
 * group breaks. That is the boundary Rocket.Chat draws and there is no reason
 * to disagree with it, but it is the kind of thing that gets flipped by
 * accident, so it is stated here and executed in the check.
 */
export function isSequential(
  current,
  previous,
  { windowSeconds = GROUPING_WINDOW_SECONDS, timeZone = null } = {},
) {
  if (!previous || !current) return false;
  if (!isGroupable(current) || !isGroupable(previous)) return false;
  if (speakerOf(current) !== speakerOf(previous)) return false;
  if (startsNewDay(current, previous, timeZone)) return false;

  const a = asInstant(previous.at);
  const b = asInstant(current.at);
  if (!a || !b) return false;
  // Absolute, so a pair that arrives out of order is not silently grouped by a
  // negative difference sneaking under the window. The sort below normally
  // prevents that; this function is exported and must be correct on its own.
  return Math.abs(b.getTime() - a.getTime()) < windowSeconds * SECOND_MS;
}

/**
 * Thread order: oldest first, deterministic.
 *
 * The database already returns `sentAt asc`, so why sort at all? Because three
 * of the four sources feeding this list are not that query — an optimistic row
 * the rep just typed, a draft with a `scheduledFor` in the future, and a row
 * whose clock skewed by a second at the carrier. A list that is 99% ordered is
 * the one nobody notices is unordered.
 *
 * Ties break on id, then on the caller's own order. Not on nothing: two rows
 * sharing a millisecond that swap places between renders make React remount
 * them and lose a text selection mid-read.
 *
 * Undated rows sort LAST and keep their relative order. They cannot be placed
 * in time and putting them first would date the whole thread from a row that
 * has no date.
 */
export function orderThread(items) {
  const list = (Array.isArray(items) ? items : []).filter(Boolean);
  return list
    .map((item, index) => ({ item, index, at: asInstant(item.at) }))
    .sort((a, b) => {
      if (!a.at && !b.at) return a.index - b.index;
      if (!a.at) return 1;
      if (!b.at) return -1;
      const byTime = a.at.getTime() - b.at.getTime();
      if (byTime !== 0) return byTime;
      const byId = String(a.item.id ?? "").localeCompare(String(b.item.id ?? ""));
      if (byId !== 0) return byId;
      return a.index - b.index;
    })
    .map((entry) => entry.item);
}

/**
 * The render list: day dividers and messages, each told what to draw.
 *
 * @param items  `{ id, direction: "in"|"out", body, at, kind?, status? }`
 *   `kind` defaults to "message"; "draft" and "note" are the non-speech rows.
 *   `status` is "sent" | "pending" | "failed" | "draft".
 * @param {number} windowSeconds  grouping period. Injectable so the check can
 *   drive the boundary without waiting five minutes.
 * @param {string|null} timeZone  the zone day boundaries are drawn in — the
 *   READER's, see dayKey.
 *
 * @returns Array of
 *   `{ kind: "day", key, at, dayKey }` and
 *   `{ kind: "message", key, item, sequential, groupStart, groupEnd, showSender, showTime, undated }`
 *
 *   `groupEnd` is computed by looking ahead, because the tail of a group needs
 *   the spacing that separates it from the next one and a renderer cannot know
 *   it is the tail until it has seen what follows.
 */
export function groupThread(items, { windowSeconds = GROUPING_WINDOW_SECONDS, timeZone = null } = {}) {
  const ordered = orderThread(items);
  const rows = [];
  if (!ordered.length) return rows;

  // Two passes. The first decides grouping and emits dividers; the second
  // fills in groupEnd. Doing it in one pass would mean mutating a row after
  // pushing it, which is the same thing with more places to get it wrong.
  let previous = null;
  for (const item of ordered) {
    const dated = Boolean(asInstant(item.at));
    const sequential = isSequential(item, previous, { windowSeconds, timeZone });

    // A divider only for dated rows: an undated one belongs to no day, and
    // emitting a heading for it would invent the date it is missing.
    if (dated && startsNewDay(item, previous, timeZone)) {
      const key = dayKey(item.at, timeZone);
      rows.push({ kind: "day", key: `day:${key}`, dayKey: key, at: asInstant(item.at) });
    }

    rows.push({
      kind: "message",
      key: `msg:${item.id ?? rows.length}`,
      item,
      sequential,
      groupStart: !sequential,
      groupEnd: true,
      // The sender is named once per group. That is the single change that
      // makes a list read as a conversation.
      showSender: !sequential,
      // …and the timestamp belongs to the group, on its first line, beside the
      // sender. Repeating it on every line is what made the old screen read as
      // a log file.
      showTime: !sequential,
      undated: !dated,
    });

    // `previous` tracks the last row that could anchor a group. A draft in the
    // middle of a thread must not become the anchor a later message groups
    // against — it was never said out loud.
    previous = isGroupable(item) ? item : null;
  }

  for (let i = 0; i < rows.length - 1; i += 1) {
    const next = rows[i + 1];
    if (rows[i].kind === "message" && next.kind === "message" && next.sequential) {
      rows[i].groupEnd = false;
    }
  }

  return rows;
}

/**
 * A one-line answer to "is anybody waiting on the rep?" for a thread.
 *
 * Here rather than in the component because the list screen and the thread
 * screen both ask it, and two copies would eventually disagree about whether a
 * draft counts. It does not: an unsent draft is the rep's own work, not
 * somebody waiting for them.
 */
export function lastSpokenRow(rows) {
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row.kind === "message" && (!row.item.kind || row.item.kind === "message")) return row;
  }
  return null;
}
