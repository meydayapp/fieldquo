// lib/mailbox/sendThrottle.js
//
// A fixed window per mailbox, counted on the row. Pure.
//
// Providers cap how much one mailbox may send (lib/mailbox/presets.js holds
// each one's published figure and whether it counts per HOUR or per DAY —
// Namecheap 500/hour, GoDaddy 500/day). Going over is not a soft failure: the
// provider starts refusing — or suspends the mailbox, which is the
// contractor's real work address. So FieldQuo stops BEFORE the cap, at 80%
// of it, and sends the rest of the window's client email through its own
// sender; the card says so. A fixed window rather than a sliding one because
// it is two columns and one comparison, and being conservative at the edge
// of a window costs nothing but a few emails sent the other way. The window's
// length is the provider's own period, so one pair of columns serves both.
//
// ══ Backing off when the provider says no ═════════════════════════════════
//
// Our figure is the provider's PUBLISHED one, which is sometimes not the
// mailbox's real one: a Namecheap trial allows 20 an hour, not 500, and
// nothing we can read tells a trial from a paid mailbox. So when the
// provider itself refuses for rate (describeSmtpError's `rate_limited`, a 429
// from Gmail or Graph), that reason is recorded on the row and the mailbox
// rests for one full window before it is tried again. Without the rest, every
// quote in that hour would hit the refusal first — and a provider that sees a
// mailbox keep pushing past its limit is the one that suspends it.

export const WINDOW_MS = 60 * 60 * 1000;
export const HEADROOM = 0.8;

/**
 * @param conn   { sendWindowStart, sendWindowCount }
 * @param limit  the provider's figure for the window, or null for "not published"
 * @param windowMs  the window that figure is counted over (default one hour)
 * @returns { ok, count, limit, next: { sendWindowStart, sendWindowCount } }
 */
export function throttleVerdict(conn, { now = new Date(), limit = null, windowMs = WINDOW_MS } = {}) {
  const span = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : WINDOW_MS;
  const start = conn?.sendWindowStart ? new Date(conn.sendWindowStart) : null;
  const inWindow = start && !Number.isNaN(start.getTime()) && now.getTime() - start.getTime() < span && now >= start;
  const count = inWindow ? Math.max(0, Number(conn.sendWindowCount) || 0) : 0;
  const cap = Number.isFinite(limit) && limit > 0 ? Math.max(1, Math.floor(limit * HEADROOM)) : null;
  const next = inWindow ? { sendWindowStart: start, sendWindowCount: count + 1 } : { sendWindowStart: now, sendWindowCount: 1 };
  if (cap !== null && count >= cap) return { ok: false, count, limit: cap, next: null };
  return { ok: true, count, limit: cap, next };
}

/** The prefix send.js writes on the row when the PROVIDER refused for rate. */
export const RATE_LIMITED_PREFIX = "rate_limited:";

/**
 * Is this mailbox still resting after its provider refused for rate?
 * @param conn  { lastSendFallbackAt, lastSendFallbackReason }
 * @returns { resting: boolean, until: Date | null }
 */
export function backoffVerdict(conn, { now = new Date(), windowMs = WINDOW_MS } = {}) {
  const span = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : WINDOW_MS;
  const at = conn?.lastSendFallbackAt ? new Date(conn.lastSendFallbackAt) : null;
  if (!at || Number.isNaN(at.getTime())) return { resting: false, until: null };
  if (!String(conn.lastSendFallbackReason || "").startsWith(RATE_LIMITED_PREFIX)) return { resting: false, until: null };
  const until = new Date(at.getTime() + span);
  // A successful send after the refusal means the provider has let go.
  const sentSince = conn.lastSentAt && new Date(conn.lastSentAt) > at;
  return now < until && now >= at && !sentSince ? { resting: true, until } : { resting: false, until: null };
}
