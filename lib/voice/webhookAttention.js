// lib/voice/webhookAttention.js
//
// Does a refused call-event delivery deserve the dashboard's attention NOW?
//
// ── The card that cried wolf ─────────────────────────────────────────────────
//
// /platform said "The phone pool needs attention — We turned away a call event
// from Retell (no_signature)" for eight days, on the strength of ONE
// PlatformErrorLog row from 2026-09-06, while 62 minutes of verified calls
// were served after it. No date, no count, no link. A refusal that is older
// than the last delivery we accepted is history: whatever refused it has been
// fixed by the evidence of everything that landed since. Keeping it red
// teaches people the card is decorative, which is the one thing a health card
// must never teach.
//
// So this is pure arithmetic over two facts the route fetches:
//
//   refusals        the unreviewed `webhook_rejected_*` rows, newest first
//                   (a row marked reviewed on /platform/errors is somebody
//                   saying "I looked; this is fine" — it never contributes)
//   lastAcceptedAt  the newest VoiceCall the WEBHOOK wrote (recoveredAt null
//                   — a row the hourly reconciler rescued is proof the webhook
//                   did NOT deliver, so it must not count as an acceptance)
//
// and the rule is: red when a refusal is inside the last 24 h, or is newer
// than the last accepted delivery (including "there has never been one" —
// then every refusal is newer). Otherwise the refusal is a fact for the
// footer, in muted type, with the count of deliveries accepted after it.
// Nothing here reviews the row: the owner decides that on /platform/errors.

export const ATTENTION_WINDOW_MS = 24 * 60 * 60 * 1000;

const REJECT_CODE_PREFIX = "webhook_rejected_";

/** "webhook_rejected_no_signature" → "no_signature". Any other code as is. */
export function refusalReason(code) {
  const s = String(code || "");
  return s.startsWith(REJECT_CODE_PREFIX) ? s.slice(REJECT_CODE_PREFIX.length) : s;
}

const toMs = (v) => {
  if (v === null || v === undefined) return null;
  const ms = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(ms) ? ms : null;
};

/**
 * @param {object} p
 * @param {Array<{createdAt: Date|string, code?: string, resolvedAt?: Date|string|null}>} p.refusals
 *   Refusal rows, any order; reviewed ones (resolvedAt set) are ignored here
 *   too, so the rule holds even if a caller forgets the WHERE.
 * @param {Date|string|null} p.lastAcceptedAt   newest webhook-written VoiceCall
 * @param {number} p.acceptedSince   VoiceCalls the webhook wrote AFTER the
 *   newest unreviewed refusal (0 when there is no refusal)
 * @param {Date|number} [p.now]
 * @returns {{
 *   level: "red"|"quiet"|"none",
 *   refused: number, refused24h: number, refusedSinceAccepted: number,
 *   lastRefusal: {at: string, reason: string}|null,
 *   acceptedSince: number, lastAcceptedAt: string|null,
 * }}
 */
export function webhookAttention({ refusals = [], lastAcceptedAt = null, acceptedSince = 0, now = Date.now() } = {}) {
  const nowMs = toMs(now) ?? Date.now();
  const acceptedMs = toMs(lastAcceptedAt);
  const live = (Array.isArray(refusals) ? refusals : [])
    .filter((r) => r && !r.resolvedAt)
    .map((r) => ({ at: toMs(r.createdAt), reason: refusalReason(r.code) }))
    .filter((r) => r.at !== null)
    .sort((a, b) => b.at - a.at);

  const refused24h = live.filter((r) => nowMs - r.at <= ATTENTION_WINDOW_MS).length;
  // No accepted delivery ever ⇒ every refusal is newer than the last one.
  const refusedSinceAccepted = live.filter((r) => acceptedMs === null || r.at > acceptedMs).length;
  const last = live[0] || null;

  const level = !last ? "none" : refused24h > 0 || refusedSinceAccepted > 0 ? "red" : "quiet";

  return {
    level,
    refused: live.length,
    refused24h,
    refusedSinceAccepted,
    lastRefusal: last ? { at: new Date(last.at).toISOString(), reason: last.reason } : null,
    acceptedSince: Math.max(0, Number(acceptedSince) || 0),
    lastAcceptedAt: acceptedMs === null ? null : new Date(acceptedMs).toISOString(),
  };
}

/** "3 refused deliveries" / "1 refused delivery". The page adds the times. */
export function refusedPhrase(n) {
  return `${n} refused deliver${n === 1 ? "y" : "ies"}`;
}
