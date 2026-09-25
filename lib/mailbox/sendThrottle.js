// lib/mailbox/sendThrottle.js
//
// A fixed one-hour window per mailbox, counted on the row. Pure.
//
// Providers cap how much one mailbox may send (lib/mailbox/presets.js holds
// each one's published figure). Going over is not a soft failure: the
// provider starts refusing — or suspends the mailbox, which is the
// contractor's real work address. So FieldQuo stops BEFORE the cap, at 80%
// of it, and sends the rest of the hour's client email through its own
// sender; the card says so. A fixed window rather than a sliding one because
// it is two columns and one comparison, and being conservative at the edge
// of an hour costs nothing but a few emails sent the other way.

export const WINDOW_MS = 60 * 60 * 1000;
export const HEADROOM = 0.8;

/**
 * @param conn   { sendWindowStart, sendWindowCount }
 * @param limit  the provider's hourly figure, or null for "not published"
 * @returns { ok, count, limit, next: { sendWindowStart, sendWindowCount } }
 */
export function throttleVerdict(conn, { now = new Date(), limit = null } = {}) {
  const start = conn?.sendWindowStart ? new Date(conn.sendWindowStart) : null;
  const inWindow = start && !Number.isNaN(start.getTime()) && now.getTime() - start.getTime() < WINDOW_MS && now >= start;
  const count = inWindow ? Math.max(0, Number(conn.sendWindowCount) || 0) : 0;
  const cap = Number.isFinite(limit) && limit > 0 ? Math.max(1, Math.floor(limit * HEADROOM)) : null;
  const next = inWindow ? { sendWindowStart: start, sendWindowCount: count + 1 } : { sendWindowStart: now, sendWindowCount: 1 };
  if (cap !== null && count >= cap) return { ok: false, count, limit: cap, next: null };
  return { ok: true, count, limit: cap, next };
}
