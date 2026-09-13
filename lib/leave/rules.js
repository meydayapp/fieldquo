// lib/leave/rules.js
//
// The company's limits on time off — the rules that sit ABOVE any one
// policy's balance: dates nobody may book (Dec 15 – Jan 5 for a company that
// installs every kitchen before Christmas), how many people may be off at
// once, and which country's and province's statutory holidays the calendar
// follows. Stored as one Json column, Company.leaveRules, resolved here.
//
// Pure. The request route and the approval route call `blackoutRefusal` and
// `concurrentRefusal`; scripts/check-shift-notify.mjs executes both against
// the ranges that go wrong (a request that starts inside a blackout, one that
// ends inside it, one that straddles it, one the day after; a fourth person
// asking when three are already off and the cap is three).
//
// ── Why one Json column ──────────────────────────────────────────────────────
//
// Same reasoning as Company.payCycle (prisma/schema.prisma): nothing queries
// on the parts — a blackout range is read together with the cap and the
// region every time a request is judged — and a `LeaveBlackout` table with
// its own routes would be a second thing to keep tenant-scoped for a list
// that is three rows long in practice. If a company ever has a hundred
// blackouts, that is the day to promote it.
//
// ── Absent is absent ─────────────────────────────────────────────────────────
//
// `maxConcurrent: null` means "no limit", not zero (zero would refuse every
// request, which nobody has asked for and is refused by the normaliser). No
// holiday region means "the company's stated address", resolved by the
// caller from Company.country / Company.province; if THAT is not a region
// with a table, there are no holidays, and the screen says so rather than
// showing a Canadian calendar to a company in Lyon.

import { holidayRegion } from "@/lib/leave/statutoryHolidays";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_BLACKOUTS = 24;
export const MAX_BLACKOUT_LABEL = 80;

function isoDayOf(value) {
  if (value == null || value === "") return null;
  if (typeof value === "string" && ISO_DAY.test(value)) {
    const d = new Date(`${value}T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? null : value;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/**
 * What the column holds after a save, from whatever a browser sent.
 *
 * Refuses rather than repairs: a blackout whose end precedes its start, or a
 * cap of zero, comes back in `errors` and the route answers 400, because a
 * silently dropped range is a rule the owner believes exists and does not.
 *
 * @returns {{ rules: { blackouts, maxConcurrent, holidayRegion }, errors: string[] }}
 */
export function normaliseLeaveRules(input) {
  const errors = [];
  const src = input && typeof input === "object" ? input : {};

  const blackouts = [];
  const rawBlackouts = Array.isArray(src.blackouts) ? src.blackouts : [];
  if (rawBlackouts.length > MAX_BLACKOUTS) errors.push(`At most ${MAX_BLACKOUTS} blackout ranges.`);
  rawBlackouts.slice(0, MAX_BLACKOUTS).forEach((b, i) => {
    const from = isoDayOf(b?.from);
    const to = isoDayOf(b?.to);
    const label = String(b?.label ?? "").trim().slice(0, MAX_BLACKOUT_LABEL);
    if (!from || !to) {
      errors.push(`Blackout ${i + 1} needs a first and a last day.`);
      return;
    }
    if (to < from) {
      errors.push(`Blackout ${i + 1} ends before it starts.`);
      return;
    }
    blackouts.push({ from, to, label });
  });
  blackouts.sort((a, b) => a.from.localeCompare(b.from));

  let maxConcurrent = null;
  if (src.maxConcurrent !== null && src.maxConcurrent !== undefined && src.maxConcurrent !== "") {
    const n = Number(src.maxConcurrent);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      errors.push("The most people off at once must be a whole number of at least 1, or left blank for no limit.");
    } else {
      maxConcurrent = n;
    }
  }

  let region = null;
  if (src.holidayRegion && typeof src.holidayRegion === "object") {
    const r = holidayRegion(src.holidayRegion);
    if (!r.country) errors.push("The holiday calendar must be Canada (with a province) or the United States.");
    else if (r.country === "CA" && !r.province) errors.push("Pick the province or territory for the holiday calendar.");
    else region = r;
  }

  return { rules: { blackouts, maxConcurrent, holidayRegion: region }, errors };
}

/** The stored column, or the empty rules, never undefined fields. */
export function resolveLeaveRules(stored) {
  const { rules } = normaliseLeaveRules(stored || {});
  return rules;
}

/**
 * The holiday region a company follows: the stated one, else the address.
 * Returns { country: null, province: null } when neither is a region with a
 * table — the caller then produces NO holidays, and says so.
 */
export function effectiveHolidayRegion(rules, company) {
  if (rules?.holidayRegion?.country) return rules.holidayRegion;
  return holidayRegion({ country: company?.country, province: company?.province });
}

/**
 * The blackout a requested range touches, or null.
 *
 * Inclusive on both ends, on calendar days: a request ending on the first
 * blackout day is inside it, and one starting the day after is not.
 */
export function blackoutFor(rules, startDate, endDate) {
  const s = isoDayOf(startDate);
  const e = isoDayOf(endDate);
  if (!s || !e) return null;
  for (const b of rules?.blackouts || []) {
    if (b.from <= e && b.to >= s) return b;
  }
  return null;
}

/**
 * The refusal a request inside a blackout gets, or null. Names the range so
 * the person can pick dates on either side of it.
 */
export function blackoutRefusal(rules, startDate, endDate) {
  const hit = blackoutFor(rules, startDate, endDate);
  if (!hit) return null;
  return {
    reason: "blackout",
    blackout: hit,
    message: hit.label
      ? `Time off can't be booked ${hit.from} to ${hit.to} — ${hit.label}.`
      : `Time off can't be booked ${hit.from} to ${hit.to}.`,
  };
}

/**
 * Who else is off on any day of a range — the people the cap counts.
 *
 * @param {Array} others  approved requests of OTHER workers:
 *                        [{ workerId, workerName, startDate, endDate, status }]
 * @returns {Array<{ workerId, workerName, startDate, endDate }>} overlapping
 */
export function othersOffDuring(others, startDate, endDate) {
  const s = isoDayOf(startDate);
  const e = isoDayOf(endDate);
  if (!s || !e) return [];
  const seen = new Set();
  const out = [];
  for (const r of Array.isArray(others) ? others : []) {
    if (!r || r.status !== "approved") continue;
    const rs = isoDayOf(r.startDate);
    const re = isoDayOf(r.endDate);
    if (!rs || !re) continue;
    if (rs <= e && re >= s && !seen.has(r.workerId)) {
      seen.add(r.workerId);
      out.push({ workerId: r.workerId, workerName: r.workerName || "", startDate: rs, endDate: re });
    }
  }
  return out;
}

/**
 * The most people off on any single day of the range, counting the others
 * already approved. A cap of three means three people, not three requests:
 * two on Monday and one on Friday is one at a time.
 */
export function peakConcurrent(others, startDate, endDate) {
  const s = isoDayOf(startDate);
  const e = isoDayOf(endDate);
  if (!s || !e) return 0;
  const overlapping = othersOffDuring(others, s, e);
  let peak = 0;
  const day = new Date(`${s}T00:00:00Z`);
  const end = new Date(`${e}T00:00:00Z`);
  for (let t = day.getTime(); t <= end.getTime(); t += 86_400_000) {
    const d = new Date(t).toISOString().slice(0, 10);
    let n = 0;
    for (const r of overlapping) if (r.startDate <= d && r.endDate >= d) n += 1;
    if (n > peak) peak = n;
  }
  return peak;
}

/**
 * The refusal when the cap is already reached, or null. Only APPROVED leave
 * counts — a pending request is not a day off yet, and refusing somebody
 * because a colleague asked first and has not been answered would let one
 * unanswered request block the whole crew.
 */
export function concurrentRefusal(rules, others, startDate, endDate) {
  const cap = rules?.maxConcurrent;
  if (!Number.isInteger(cap) || cap < 1) return null;
  const peak = peakConcurrent(others, startDate, endDate);
  if (peak < cap) return null;
  const names = othersOffDuring(others, startDate, endDate).map((r) => r.workerName || "someone");
  return {
    reason: "max_concurrent",
    maxConcurrent: cap,
    alreadyOff: names,
    message: `${cap === 1 ? "Only one person" : `At most ${cap} people`} can be off at once, and ${names.join(", ")} ${names.length === 1 ? "is" : "are"} already off then.`,
  };
}
