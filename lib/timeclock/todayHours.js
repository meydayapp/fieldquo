// lib/timeclock/todayHours.js
//
// How many hours somebody has worked today — the ONE definition of it.
//
// ── Why this is a shared function and not two lines in two files ───────────
//
// GET /api/time-clock computed it server-side, at request time, and its
// comment stated the contract exactly: "booked hours on closed entries, plus
// live elapsed on the open one so the number the person sees matches the timer
// ticking above it."
//
// app/app/clock then had to keep that promise on a screen with a one-second
// heartbeat that only re-renders and never refetches. It reached for the same
// arithmetic and got:
//
//     const liveToday = clockedIn
//       ? Math.round(((data.todayHours || 0) + 0) * 100) / 100
//       : data?.todayHours || 0;
//
// Both branches are the same value, and the `+ 0` is where the elapsed time
// was meant to go. So the figure froze at whatever it was when the page
// loaded: after a shift the card showed 07:12:33 elapsed beside 0.02 hours
// today — two numbers about the same morning, disagreeing, on one card.
//
// That is AGENTS.md failure class 9. The copy is the one that rots, because it
// is the one nobody looks at. One function, called from both sides, cannot
// disagree with itself.
//
// ── What is deliberately NOT in here ──────────────────────────────────────
//
// The choice of WHICH entries count. The route selects `clockIn >= start` in
// the company's own timezone (dayBoundsInZone), and that boundary question
// needs a timezone this function has no business knowing. So the caller hands
// over today's rows and this only adds them up — which also means an open
// entry that began YESTERDAY is not in the list, is not counted, and cannot
// credit last night's hours to this morning. Both callers get that for free
// rather than each having to remember it.

/**
 * Today's hours from today's time entries.
 *
 * A closed entry contributes its booked `hours`. The open one contributes the
 * time elapsed since it was punched, so the figure moves with a clock.
 *
 * @param {Array<{clockIn: string|Date, clockOut: ?(string|Date), hours: ?number}>} entries
 *   today's rows, as the route selects them
 * @param {Date|number} [now]  when "now" is; defaults to the real clock
 * @returns {number} hours, rounded to two decimals
 */
export function todayHoursFrom(entries, now = Date.now()) {
  // Not an array is "we were not given today's rows", which is different from
  // "there were none". Returning 0 for it would be the fabricated zero this
  // codebase keeps being swept for, so the caller is handed NaN's honest
  // cousin — null — and decides what to render.
  if (!Array.isArray(entries)) return null;

  const at = now instanceof Date ? now.getTime() : Number(now);

  let total = 0;
  for (const e of entries) {
    if (!e) continue;
    if (e.clockOut) {
      // A closed entry with no booked hours is a row somebody has to fix, not
      // a row worth guessing at. `Number(null)` is 0 and 0 is finite, so this
      // asks the question the right way round.
      const booked = Number(e.hours);
      if (Number.isFinite(booked)) total += booked;
      continue;
    }
    const started = new Date(e.clockIn).getTime();
    if (!Number.isFinite(started)) continue;
    // A clock skew that puts the punch in the future must not subtract hours
    // from the day.
    total += Math.max(0, at - started) / 3_600_000;
  }

  return Math.round(total * 100) / 100;
}
