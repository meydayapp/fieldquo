// lib/chat/unreadQuery.js
//
// The unread count as a QUERY, for both chats.
//
// ══ Why a count and not a slice ═══════════════════════════════════════════
//
// Both room lists used to load each room's first 200 messages and count the
// ones after the viewer's lastSeenAt in JavaScript (lib/staff/rooms.js
// unreadFor, lib/company/chat/rules.js unreadFor). "First" was the word that
// was wrong: the slice was ordered oldest-first, so once a room held more
// than 200 messages the newest ones — the only ones that can be unread —
// were never in the payload. The count would have gone to zero and stayed
// there, and the thread, sliced the same way at 500, would have stopped
// showing new messages at all. No room had reached the size when this was
// found; the arithmetic was waiting.
//
// The rule has not moved: a message is unread when it is not a system line,
// not the viewer's own, and later than the viewer's lastSeenAt — or, when
// they have never seen the room, any message from anybody else. unreadFor and
// mentionsFor still say that over rows, and scripts/check-staff-chat.mjs and
// scripts/check-company-chat.mjs execute this `where` against the same
// fixture as those functions and require the two to agree. This module turns
// the rule into Prisma's `where` once, for both message tables — the column
// names differ (sentAt / createdAt, two author columns / one) and nothing
// else does.
//
// One groupBy per fact, for all the viewer's rooms at once: an OR of one
// clause per room, each carrying that room's own lastSeenAt, grouped by
// roomId. Two round trips for a list of any length rather than two per room,
// which matters for /api/sales/badges polling every ten seconds.
//
// Pure: builds arguments and reads results. The stores run the queries.

/**
 * The `where` for "messages in these rooms the viewer has not seen".
 *
 * @param rooms    [{ id, lastSeenAt }] — lastSeenAt as the VIEWER's
 *                 membership recorded it, null when never seen
 * @param at       the timestamp column: "sentAt" (staff) or "createdAt" (company)
 * @param notMine  a where fragment excluding the viewer's own rows, e.g.
 *                 { OR: [{ authorSalesRepId: null }, { authorSalesRepId: { not: id } }] }
 *                 — spelled with the explicit null branch because SQL's
 *                 `<> id` drops NULL authors, and a platform admin's message
 *                 has a NULL rep author
 * @returns a Prisma where, or null when there are no rooms to ask about
 */
export function unreadWhere({ rooms = [], at = "sentAt", notMine = null } = {}) {
  const clauses = (Array.isArray(rooms) ? rooms : [])
    .filter((r) => r && r.id)
    .map((r) => {
      const seen = r.lastSeenAt ? new Date(r.lastSeenAt) : null;
      // Never seen: everything from other people. That is the right answer
      // for a member who has just been added to a channel.
      if (!seen || Number.isNaN(seen.getTime())) return { roomId: r.id };
      return { roomId: r.id, [at]: { gt: seen } };
    });
  if (!clauses.length) return null;
  const parts = [{ kind: { not: "system" } }];
  if (notMine) parts.push(notMine);
  parts.push({ OR: clauses });
  return { AND: parts };
}

/**
 * The same, narrowed to the messages that say the viewer's name — the
 * badge's stronger colour. `key` is the stored participant key
 * ("rep:<id>" | "user:<id>" | "member:<id>").
 */
export function mentionsWhere({ rooms, at, notMine, key } = {}) {
  const base = unreadWhere({ rooms, at, notMine });
  if (!base || !key) return null;
  return { AND: [...base.AND, { mentions: { has: key } }] };
}

/** The groupBy arguments, so both stores spell them the same way. */
export function countByRoomArgs(where) {
  return { by: ["roomId"], where, _count: { _all: true } };
}

/**
 * A groupBy result folded to roomId → count. Rooms with nothing unread are
 * absent from the result and read as 0 here.
 */
export function countsByRoom(groups = []) {
  const out = new Map();
  for (const g of Array.isArray(groups) ? groups : []) {
    if (!g || !g.roomId) continue;
    const n = g._count && typeof g._count === "object" ? g._count._all : g._count;
    out.set(g.roomId, Number.isFinite(n) ? n : 0);
  }
  return out;
}

/**
 * The moment to record as "seen up to" for a thread payload: the LAST message
 * it contained, not the clock.
 *
 * "Now" was the stamp before, and it loses a message: one that lands between
 * the SELECT that built the payload and the UPDATE that stamped the read has
 * a sentAt before the stamp and was never shown, so it is never counted. And
 * it can leave one uncleared: a message stamped by another server whose
 * clock runs a little ahead is IN the payload yet later than the stamp, and
 * the room reads as unread until the next poll — which is the report this
 * exists to close. The last message's own timestamp has neither problem:
 * it is a value from the same series the count compares against.
 *
 * Null when the payload was empty — there is nothing to have seen.
 */
export function seenUpTo(messages = [], at = "sentAt") {
  let latest = null;
  for (const m of Array.isArray(messages) ? messages : []) {
    const t = m && m[at] ? new Date(m[at]) : null;
    if (!t || Number.isNaN(t.getTime())) continue;
    if (!latest || t > latest) latest = t;
  }
  return latest;
}
