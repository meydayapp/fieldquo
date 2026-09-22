// lib/offline/punchMoment.js
//
// When did the punch happen?
//
// Online: now, and nothing in the body can say otherwise — a client that
// could post `at` freely could back-date a clock-in from the couch. Replayed
// from the offline queue (an X-Offline-Key is present): the moment the
// person tapped, which the phone recorded, bounded to a window wide enough
// for a weekend without signal and never in the future. Pure, so the check
// can hand it the hostile cases: a date string that is not one, a punch
// from next week, a punch from last month, `at` without a key.

/** How far back a replayed punch may be. A long weekend in a dead zone, with margin. */
export const MAX_REPLAY_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** Clock skew between the phone and the server that is still "now". */
export const FUTURE_SLACK_MS = 5 * 60 * 1000;

/**
 * @param {{ at?: any, offlineKey?: string|null, now?: Date }} p
 * @returns {{ at: Date } | { error: string }}
 */
export function punchMoment({ at, offlineKey, now = new Date() } = {}) {
  if (!offlineKey || at == null) return { at: now };
  const parsed = new Date(at);
  const t = parsed.getTime();
  if (!Number.isFinite(t)) return { error: "The queued punch has no readable time." };
  if (t > now.getTime() + FUTURE_SLACK_MS) return { error: "The queued punch is in the future." };
  if (t < now.getTime() - MAX_REPLAY_AGE_MS) return { error: "The queued punch is more than a week old — add it by hand on the timesheet." };
  return { at: parsed };
}
