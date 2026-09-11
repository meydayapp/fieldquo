// lib/location/capture.js
//
// Ask the phone where it is, once, at the moment of a tap. Browser only.
//
// ── What a browser can and cannot do ───────────────────────────────────────
//
// It can read the position while the tab is open and in front. It cannot do
// so in the background — iOS suspends the page when the screen locks, Android
// throttles it to nothing — and there is no honest way to build "tracking" on
// top of that. So this file exposes ONE function, called from ONE place per
// screen, at the tap. There is no `watchPosition` here or anywhere else in
// the product, and scripts/check-location-stamps.mjs fails the build if one
// appears.
//
// ── Never throws, never blocks ─────────────────────────────────────────────
//
// The tap this decorates is a clock-in or a status change, and it has to
// succeed exactly as it did before this file existed. So every failure —
// no geolocation object (desktop, an old WebView, a privacy browser), a
// refused permission, no fix inside the timeout, an insecure origin —
// resolves to `null`, and the caller sends its request without a stamp.
//
// ── Ask once ───────────────────────────────────────────────────────────────
//
// A refusal is remembered for the tab's session. Prompting again on the next
// tap after somebody said no is the behaviour that makes people distrust the
// screen; they said no, and the answer stands until they open a new tab or
// change it in the browser's own settings. sessionStorage, not localStorage:
// a "no" given on a shared phone in the van should not outlive the tab.

export const CAPTURE_TIMEOUT_MS = 8000;
/** A fix up to this old is fine — the phone has not moved far in 30 seconds. */
export const CAPTURE_MAX_AGE_MS = 30000;
const DENIED_KEY = "fq.location.denied";

function deniedThisSession() {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(DENIED_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDenied() {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(DENIED_KEY, "1");
  } catch {
    // Storage refused (private mode, quota): we simply may prompt again.
  }
}

/**
 * True when a call to captureStamp() might put the browser's permission
 * prompt on screen — so the caller can show its one-line explanation FIRST.
 * Not a guarantee either way: the browser decides, and a granted permission
 * shows nothing. Feature-detected; false on a desktop with no geolocation.
 */
export function mayPromptForLocation() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return false;
  return !deniedThisSession();
}

/**
 * What the browser would do if asked right now.
 *
 * @returns {Promise<"unavailable"|"denied"|"granted"|"prompt">}
 *   `prompt` is the state the clock screen's one-line explanation exists
 *   for — the OS sheet is about to appear and the person deserves to read
 *   why before it does. Browsers without the Permissions API (older iOS)
 *   report `prompt` unless this session already saw a refusal: showing the
 *   line once too often is cheaper than a prompt with no explanation.
 */
export async function locationPermissionState() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unavailable";
  if (deniedThisSession()) return "denied";
  try {
    if (navigator.permissions?.query) {
      const status = await navigator.permissions.query({ name: "geolocation" });
      if (status?.state === "granted" || status?.state === "denied") return status.state;
    }
  } catch {
    // Some browsers throw on an unsupported permission name; fall through.
  }
  return "prompt";
}

/**
 * The phone's position at the tap, or null.
 *
 * @returns {Promise<{ latitude: number, longitude: number, accuracyM: number|null, at: string }|null>}
 */
export function captureStamp() {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  if (deniedThisSession()) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const c = pos?.coords;
          if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)) return done(null);
          done({
            latitude: c.latitude,
            longitude: c.longitude,
            accuracyM: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
            // The tap time as this device sees it. The server bounds it to a
            // window around its own clock — lib/location/stamps.js.
            at: new Date().toISOString(),
          });
        },
        (err) => {
          // PERMISSION_DENIED is 1. Anything else (no fix, timeout) may
          // succeed next time and is not remembered.
          if (err && err.code === 1) rememberDenied();
          done(null);
        },
        { enableHighAccuracy: true, timeout: CAPTURE_TIMEOUT_MS, maximumAge: CAPTURE_MAX_AGE_MS },
      );
    } catch {
      done(null);
    }
    // Belt to the timeout option's braces: some WebViews never call either
    // callback when the permission sheet is dismissed by a gesture.
    setTimeout(() => done(null), CAPTURE_TIMEOUT_MS + 500);
  });
}
