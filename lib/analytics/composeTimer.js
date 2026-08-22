// lib/analytics/composeTimer.js
//
// How long somebody ACTIVELY spent building a quote.
//
// ── Why wall-clock is the wrong answer ─────────────────────────────────────
//
// createdAt → sentAt looks like it measures this and does not. Across the
// eight real quotes in production it ranged from 0 minutes to 146 hours,
// because it captures a contractor starting a quote on Monday and sending it
// on Wednesday. Work and idleness are the same number in it.
//
// The claim this exists to support — "a quote in under a minute" — is only
// worth making if the number behind it is defensible. So this counts time the
// page was visible AND the user was doing something, and stops otherwise.
//
// ── It undercounts on purpose ──────────────────────────────────────────────
//
// Two things make it conservative rather than generous:
//
//   * the idle timeout stops the clock after inactivity, so thinking time
//     spent staring at the screen is lost
//   * a hidden tab stops it immediately
//
// Both push the number DOWN. That is the correct direction for a figure headed
// for a marketing claim: the failure mode is under-stating our own speed, not
// inflating it. A metric that flatters the product is worth nothing the first
// time someone checks it.
//
// ── What it will not do ────────────────────────────────────────────────────
//
// It does not report anything on its own, and it never reports a session with
// no interaction at all. A page that was opened and abandoned produces null,
// not zero — absence of effort is not "instant".

/// Stop counting after this much silence. Six seconds is long enough to read a
/// line and short enough that a coffee break can't be billed as work.
const IDLE_MS = 6000;

/// Below this, the session is a page-open-and-close, not a quote. Reported as
/// null so no average is dragged toward zero by accidental loads.
const MIN_MEANINGFUL_MS = 1500;

/// Above this, something is wrong — a tab left open with a stuck event
/// listener, or a shared terminal. Capped rather than discarded, because the
/// work probably did happen; we just can't prove that much of it did.
const MAX_SESSION_MS = 45 * 60 * 1000;

const ACTIVITY_EVENTS = [
  "keydown",
  "pointerdown",
  "pointermove",
  "wheel",
  "input",
  "change",
];

/**
 * Start measuring. Returns a handle with `stop()`, `seconds()` and `cancel()`.
 *
 * Deliberately imperative rather than a React hook: the quote builder, the
 * instant-quote flow and the self-quote form are three different components
 * with three different lifecycles, and a hook would have to be shaped for the
 * awkwardest of them.
 *
 * @param {object} [opts]
 * @param {Document} [opts.doc]  injected for tests
 */
export function startComposeTimer(opts = {}) {
  const doc = opts.doc || (typeof document !== "undefined" ? document : null);
  const now = () =>
    typeof performance !== "undefined" && performance.now
      ? performance.now()
      : Date.now();

  let activeMs = 0;
  let segmentStart = null;
  let idleTimer = null;
  let stopped = false;
  let sawActivity = false;

  const closeSegment = () => {
    if (segmentStart !== null) {
      activeMs += now() - segmentStart;
      segmentStart = null;
    }
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  const goIdle = () => closeSegment();

  const onActivity = () => {
    if (stopped) return;
    // A hidden tab must not resume on a stray event — some browsers still
    // deliver pointermove to a background tab in a split window.
    if (doc && doc.visibilityState === "hidden") return;

    sawActivity = true;
    if (segmentStart === null) segmentStart = now();

    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(goIdle, IDLE_MS);
  };

  const onVisibility = () => {
    if (stopped) return;
    if (doc.visibilityState === "hidden") closeSegment();
    // Deliberately NOT restarting on 'visible'. Coming back to a tab is not
    // work; the next real interaction starts the clock again.
  };

  if (doc) {
    for (const evt of ACTIVITY_EVENTS) {
      doc.addEventListener(evt, onActivity, { passive: true });
    }
    doc.addEventListener("visibilitychange", onVisibility);
  }

  const detach = () => {
    if (!doc) return;
    for (const evt of ACTIVITY_EVENTS) doc.removeEventListener(evt, onActivity);
    doc.removeEventListener("visibilitychange", onVisibility);
  };

  return {
    /** Milliseconds of active time so far, capped. */
    elapsedMs() {
      const live = segmentStart === null ? 0 : now() - segmentStart;
      return Math.min(activeMs + live, MAX_SESSION_MS);
    },

    /**
     * Finish and return whole seconds, or null when there is nothing honest to
     * report.
     *
     * Null rather than 0 for an untouched form: a quote nobody typed into did
     * not take zero seconds to write, and letting it into an average would
     * make the product look faster than it is.
     */
    stop() {
      if (stopped) return this.seconds;
      closeSegment();
      detach();
      stopped = true;
      const ms = Math.min(activeMs, MAX_SESSION_MS);
      this.seconds = sawActivity && ms >= MIN_MEANINGFUL_MS ? Math.round(ms / 1000) : null;
      return this.seconds;
    },

    /** Abandon without reporting — a cancelled form, an unmounted component. */
    cancel() {
      closeSegment();
      detach();
      stopped = true;
      this.seconds = null;
      return null;
    },

    seconds: null,
  };
}

/**
 * Summarise a set of compose times.
 *
 * Median, because one contractor who left a tab open for 44 minutes should not
 * define "how long a quote takes". Nulls are DROPPED, never counted as zero —
 * a quote from before this shipped carries no claim about its own speed.
 */
export function summariseComposeTimes(values) {
  const clean = (Array.isArray(values) ? values : [])
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (!clean.length) return { count: 0, median: null, p90: null, fastest: null };

  const at = (q) => {
    const pos = (clean.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return lo === hi ? clean[lo] : clean[lo] + (clean[hi] - clean[lo]) * (pos - lo);
  };

  return {
    count: clean.length,
    median: Math.round(at(0.5)),
    p90: Math.round(at(0.9)),
    fastest: clean[0],
    // Share finished inside a minute — the claim, stated as a proportion
    // rather than as an average, because "most quotes take under a minute" is
    // both truer and more checkable than a mean.
    underMinute: clean.filter((v) => v <= 60).length,
  };
}
