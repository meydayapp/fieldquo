// scripts/scrape/lib/pace.mjs
//
// Human pacing, shared by every scrape that runs from the owner's Mac.
//
// The one thing that keeps a home IP off Google's "unusual traffic" page is
// looking like one person with one browser: a pause of a few seconds
// between actions, never the same pause twice, a wheel that scrolls by
// uneven amounts, a mouse that drifts. None of it is disguise — the run is
// a real Chrome on a real machine — it is the difference between reading a
// page and hammering it. Pure functions here; the browser module applies
// them.

export const PACE_MIN_MS = 2000;
export const PACE_MAX_MS = 6000;

/** A random integer in [min, max]. `rand` is injectable so the check can
 *  pin it. */
export function jitter(min = PACE_MIN_MS, max = PACE_MAX_MS, rand = Math.random) {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return Math.floor(lo + rand() * (hi - lo + 1));
}

/** Pause for a jittered interval. Resolves with the milliseconds waited. */
export async function humanPause(min = PACE_MIN_MS, max = PACE_MAX_MS, { rand = Math.random, sleep = defaultSleep } = {}) {
  const ms = jitter(min, max, rand);
  await sleep(ms);
  return ms;
}

/** A wheel delta a person would produce: most of a screen, never exactly
 *  the same, occasionally a small correction upward. */
export function wheelDelta(rand = Math.random) {
  const r = rand();
  if (r < 0.08) return -Math.floor(80 + rand() * 160);
  return Math.floor(500 + rand() * 900);
}

/** A point inside a box, biased away from the exact edges. */
export function pointIn(box, rand = Math.random) {
  const padX = Math.min(24, box.width / 4);
  const padY = Math.min(24, box.height / 4);
  return {
    x: box.x + padX + rand() * Math.max(1, box.width - 2 * padX),
    y: box.y + padY + rand() * Math.max(1, box.height - 2 * padY),
  };
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
