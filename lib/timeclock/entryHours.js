// lib/timeclock/entryHours.js
//
// The hours a time entry is worth: clock-in to clock-out, less the unpaid
// breaks the person actually took in between.
//
// One function, because `hours` is what a pay run multiplies by a rate and it
// was being computed in three places (the self-serve clock-out, the job
// switch, the manager's manual clock-out) with the same two lines each. Now
// that a break can come off it, three copies of "less the breaks" is three
// chances to pay somebody for a lunch on one path and not on another.
//
// Pure: instants and rows in, a number out. Executed by
// scripts/check-shift-board.mjs alongside the board arithmetic.

const MS_HOUR = 3_600_000;

const toMs = (v) => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (v == null || v === "") return NaN;
  return new Date(v).getTime();
};

/**
 * Milliseconds of UNPAID break inside [clockIn, clockOut].
 *
 * A break still open (no `end`) is counted up to `clockOut` — the clock-out
 * closes it, and the hours must agree with that. A break outside the entry
 * (a row a script wrote badly) counts only the part inside it. A paid break
 * counts for nothing here: it is recorded, and it changes no hours.
 */
export function unpaidBreakMs(breaks, clockIn, clockOut) {
  const s = toMs(clockIn);
  const e = toMs(clockOut);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return 0;
  let total = 0;
  for (const b of Array.isArray(breaks) ? breaks : []) {
    if (!b || b.paid === true) continue;
    const bs = toMs(b.start);
    const be = b.end == null ? e : toMs(b.end);
    if (!Number.isFinite(bs) || !Number.isFinite(be)) continue;
    const from = Math.max(bs, s);
    const to = Math.min(be, e);
    if (to > from) total += to - from;
  }
  return total;
}

/**
 * Hours for a closed entry, rounded to two decimals the way every clock-out
 * path always has. Null when the instants do not make an entry.
 */
export function entryHours(clockIn, clockOut, breaks = []) {
  const s = toMs(clockIn);
  const e = toMs(clockOut);
  if (!Number.isFinite(s) || !Number.isFinite(e) || e <= s) return null;
  const worked = e - s - unpaidBreakMs(breaks, s, e);
  return Math.round((Math.max(0, worked) / MS_HOUR) * 100) / 100;
}

/** The break with no end yet, or null. */
export function openBreak(breaks) {
  for (const b of Array.isArray(breaks) ? breaks : []) {
    if (b && b.end == null && Number.isFinite(toMs(b.start))) return b;
  }
  return null;
}
