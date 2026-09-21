// lib/sales/calls/floorSettings.js
//
// The floor's two tunables, and their defaults — pure, so the presence
// derivation (agentState.js livePresence) and the check scripts read the
// same numbers the platform console saves.
//
//   afterCallSeconds  the write-up window after every call: "Busy · writing
//                     it up" with a countdown, no autodial, no inbound ring,
//                     Available at zero. OMniLeads's `auto_unpause`, the
//                     owner's sixty seconds (2026-09-21). Zero is honoured
//                     as "no window": the rep is Available the moment the
//                     call ends, as before the setting existed.
//   requireWriteUp    OMniLeads's forced disposition: a call with no outcome
//                     keeps the rep in the window past its end. On by
//                     default. "Write it up later" still frees them — that
//                     is an outcome decision, recorded as such, and the cron
//                     logs the leftovers at day end.
//
// Stored as ONE PlatformSetting row (FLOOR_SETTINGS_KEY) by
// floorSettingsStore.js; the screen is a card on /platform/sales/floor.

export const FLOOR_SETTINGS_KEY = "sales.floor";

import { DEFAULT_PAUSE_LIMITS, PAUSE_REASON_ORDER, isPauseReason } from "./agentState";

export const DEFAULT_FLOOR_SETTINGS = Object.freeze({
  afterCallSeconds: 60,
  requireWriteUp: true,
  /** Pause reason → maximum minutes (null: no limit). agentState.js has the defaults and the types. */
  pauseLimits: DEFAULT_PAUSE_LIMITS,
});

/** A pause longer than this is a shift, not a pause: the console's ceiling on any limit. */
export const PAUSE_LIMIT_MINUTES_MAX = 8 * 60;

/** Reason → minutes, every reason present, the defaults where nothing (or junk) was stored. */
export function normalisePauseLimits(value) {
  const v = value && typeof value === "object" ? value : {};
  const out = {};
  for (const code of PAUSE_REASON_ORDER) {
    const n = v[code];
    if (n === null) out[code] = null;
    else if (Number.isFinite(Number(n)) && Number(n) > 0) out[code] = Math.min(PAUSE_LIMIT_MINUTES_MAX, Math.round(Number(n)));
    else out[code] = DEFAULT_PAUSE_LIMITS[code];
  }
  return out;
}

/** The bounds the console enforces: a window longer than ten minutes is a pause, not a write-up. */
export const AFTER_CALL_SECONDS_MAX = 600;

/**
 * Whatever was stored (or sent), made into a settings object. Anything
 * unreadable falls to the default for THAT field, never to nothing — a
 * missing window would let the dialler place the next call before the
 * write-up.
 */
export function normaliseFloorSettings(value) {
  const v = value && typeof value === "object" ? value : {};
  const n = Number(v.afterCallSeconds);
  const afterCallSeconds = Number.isFinite(n) && n >= 0 ? Math.min(AFTER_CALL_SECONDS_MAX, Math.round(n)) : DEFAULT_FLOOR_SETTINGS.afterCallSeconds;
  const requireWriteUp = typeof v.requireWriteUp === "boolean" ? v.requireWriteUp : DEFAULT_FLOOR_SETTINGS.requireWriteUp;
  return { afterCallSeconds, requireWriteUp, pauseLimits: normalisePauseLimits(v.pauseLimits) };
}

/**
 * A PUT body → { ok, value } or { ok: false, error }. Refuses rather than
 * clamps, so a screen never shows a number the store silently changed.
 */
export function validateFloorSettings(body) {
  if (!body || typeof body !== "object") return { ok: false, error: "Send { afterCallSeconds, requireWriteUp }." };
  const n = body.afterCallSeconds;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > AFTER_CALL_SECONDS_MAX || Math.round(n) !== n) {
    return { ok: false, error: `afterCallSeconds must be a whole number of seconds from 0 to ${AFTER_CALL_SECONDS_MAX}.` };
  }
  if (typeof body.requireWriteUp !== "boolean") return { ok: false, error: "requireWriteUp must be true or false." };
  // The limits: a whole number of minutes per reason, or null for none;
  // a reason left out keeps its stored value (the normaliser fills it).
  const limits = body.pauseLimits === undefined ? {} : body.pauseLimits;
  if (!limits || typeof limits !== "object") return { ok: false, error: "pauseLimits must be an object of reason → minutes." };
  for (const [code, m] of Object.entries(limits)) {
    if (!isPauseReason(code)) return { ok: false, error: `"${code}" is not a pause reason.` };
    if (m === null) continue;
    if (typeof m !== "number" || !Number.isFinite(m) || m <= 0 || m > PAUSE_LIMIT_MINUTES_MAX || Math.round(m) !== m) {
      return { ok: false, error: `The ${code} limit must be a whole number of minutes from 1 to ${PAUSE_LIMIT_MINUTES_MAX}, or null for none.` };
    }
  }
  return { ok: true, value: { afterCallSeconds: n, requireWriteUp: body.requireWriteUp, pauseLimits: limits } };
}
