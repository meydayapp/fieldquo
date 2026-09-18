// lib/sales/calls/liveCall.js
//
// Is this rep on a call right now, as far as the rows can tell?
//
// ══ Why the server asks at all ═══════════════════════════════════════════
//
// The screen already knows: RepPresenceProvider's `callLive` is set by the
// two components that hold a Twilio call, and CallPanel refuses to dial over
// it. But a rep with two tabs open — the queue on a laptop and the same
// queue on a phone — has one tab that does not know, and on 2026-09-17 QA
// pressed the outbound Call under a LIVE inbound call and got a second
// attempt row, a second bridge, and a second write-up. A guard that lives
// only in the browser is one stale tab away from not existing, which is the
// argument the calls route makes about the calling gate: the last statement
// before something leaves the building is read fresh.
//
// ══ What counts as live, and what deliberately does not ══════════════════
//
// An OUTBOUND browser dial is live while the carrier says so — queued,
// initiated, ringing or in-progress — and neither side has reported an end:
// no `endedAt` from the status webhook, no `hungUpBy` from the panel's
// `ended` post. A handset dial is never live here: nothing reports on it,
// and "the rep dialled from their cell twelve minutes ago" is not evidence
// they are still talking.
//
// An INBOUND call is live from the moment this rep answered it
// (`answeredByRepId`) until the carrier's completion sets `endedAt` — the
// inbound leg has no per-status webhook, so the row carries no
// "in-progress" to read; the answer stamp is the fact.
//
// A row older than LIVE_CALL_WINDOW_MINUTES is not live whatever it says.
// The status webhook can be lost (the audit found exactly that in
// reconcileCalls), and a row stuck at "in-progress" forever must not lock a
// rep out of dialling for the rest of their life. Fifteen minutes is a
// stale-tab guard's horizon, not a call's: the browser's own guard holds
// for the whole call, and this one only has to outlast a tab that missed
// the hang-up.
import { PROVIDER_ENDED } from "./dispositions";

export const LIVE_CALL_WINDOW_MINUTES = 15;

/** Twilio's statuses for an outbound leg that has not ended. */
export const LIVE_PROVIDER_STATUSES = Object.freeze(["queued", "initiated", "ringing", "in-progress"]);

/** The refusal's machine-readable code — the screen keys its sentence on it. */
export const ALREADY_ON_A_CALL = "already_on_a_call";

const when = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Is one attempt row a call `repId` is on right now?
 *
 * Pure, so the check script drives it with every shape the two webhooks and
 * the panel can leave a row in.
 *
 * @param row    a SalesCallAttempt row (any select carrying the fields below).
 * @param repId  the rep asking to dial.
 * @param now    the clock.
 */
export function isLiveCall(row, { repId, now = new Date() } = {}) {
  if (!row || typeof row !== "object" || !repId) return false;
  const dialledAt = when(row.dialledAt);
  if (!dialledAt) return false;
  const at = when(now) || new Date();
  const ageMs = at.getTime() - dialledAt.getTime();
  if (ageMs < 0 || ageMs > LIVE_CALL_WINDOW_MINUTES * 60 * 1000) return false;
  if (when(row.endedAt)) return false;

  if (row.direction === "in") {
    if (row.answeredByRepId !== repId) return false;
    // The carrier's terminal word ends it even without an endedAt stamp —
    // markMissed() writes a status and no end time.
    if (typeof row.providerStatus === "string" && PROVIDER_ENDED.includes(row.providerStatus)) return false;
    return true;
  }

  if (row.salesRepId !== repId) return false;
  if (row.dialChannel !== "browser") return false;
  if (row.hungUpBy) return false;
  return typeof row.providerStatus === "string" && LIVE_PROVIDER_STATUSES.includes(row.providerStatus);
}

/**
 * The newest live call among `rows` for `repId`, or null.
 *
 * @returns {{ id, direction, dialledAt }|null}
 */
export function liveCallAmong(rows, { repId, now = new Date() } = {}) {
  if (!Array.isArray(rows)) return null;
  const live = rows.filter((r) => isLiveCall(r, { repId, now }));
  if (live.length === 0) return null;
  live.sort((a, b) => when(b.dialledAt).getTime() - when(a.dialledAt).getTime());
  const top = live[0];
  return { id: top.id, direction: top.direction === "in" ? "in" : "out", dialledAt: when(top.dialledAt).toISOString() };
}
