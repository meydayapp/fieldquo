// lib/leave/hourAccrual.js
//
// Leave EARNED from hours worked — the accrual method "per_hours_worked".
//
// The owner (2026-10-03): "we should be calculating the time earned for
// vacation and sick leave as that is based on time worked.. and an ability to
// register already worked hours since January 1, so that someone registering
// now can enter previous hours to better reflect employees accumulated paid
// leave".
//
// Pure: no database, no clock (callers pass `today`), so
// scripts/check-leave-hour-accrual.mjs executes every branch below against the
// inputs that go wrong — zero hours, negative hours, absurd hours, a mid-year
// start, a cap reached, a rate changed in July.
//
// ── One rule shape ──────────────────────────────────────────────────────────
//
// "Earn X hours for every Y hours worked." Every hour-based rule we have seen
// is that shape: 4% of hours is 4 per 100, California sick leave is 1 per 30,
// Washington's is 1 per 40. Stored as the two numbers rather than a ratio so
// the screen can say "1 h per 30 h worked" — the words in the statute — and
// not 0.0333.
//
// ── Which hours count ───────────────────────────────────────────────────────
//
// APPROVED time entries only (a pending entry has not been accepted as worked
// yet; it counts the moment it is approved). Every work activity counts —
// on site, driving, office, supply runs, general — because all of them are
// time worked. That includes a stretch the company has chosen not to PAY
// (TimeEntry.paid false, which books hours 0): whether a drive is paid is a
// pay decision, whether it was worked is a fact, and leave is earned on the
// second. workedHoursOfEntry re-derives that stretch's length from its clock
// times with the same arithmetic every clock-out uses (entryHours), less the
// unpaid breaks. Unpaid lunches and breaks are not work and never count.
//
// ── Rate changes ────────────────────────────────────────────────────────────
//
// A rate applies from the day it is set. Hours worked before keep the rate
// they were earned under — recomputing the whole year at a lower new rate
// would take leave back from everyone the moment an owner edited a number.
// The policy's FIRST rate reaches back to 1 January: setting up a policy is
// the company stating its rule for the year, which is exactly what an
// opening balance needs to be valued at.
//
// A person's own rate (LeaveAccrualOverride) wins from its effectiveFrom day;
// an override row with no rate hands them back to the company policy from
// that day.
//
// ── Presets ─────────────────────────────────────────────────────────────────
//
// Only rules we can cite, each with its source, and each labelled "check with
// your local rules": these are starting points a company edits, not legal
// advice, and several of them depend on employer size or service years in
// ways one number cannot express. Nothing is applied until a person picks
// one — a company with no hour-based policy accrues nothing from hours,
// because the absence of a policy is not a statement of one.

import { entryHours } from "@/lib/timeclock/entryHours";

const MS_DAY = 24 * 60 * 60 * 1000;

/** Most "per Y hours worked" we accept — a year is 8,784 hours at most. */
export const MAX_PER_HOURS_WORKED = 10000;
/** A calendar year has at most 366 × 24 hours; no cap or opening exceeds it. */
export const HOURS_IN_LEAP_YEAR = 366 * 24;
export const MAX_NOTE = 500;

/**
 * Cited, hour-based rules. Every field a preset sets is a figure the source
 * states; where a law ALLOWS an employer a cap but does not impose one, the
 * cap is left empty (more generous, never short) and the note says so.
 *
 * Sources checked 2026-10-03:
 *
 *   on_vacation_4 / on_vacation_6 — Ontario Employment Standards Act, 2000,
 *     ss. 33–35.2 (vacation with pay). Two weeks' vacation and vacation pay of
 *     4% of gross wages under five years of employment; three weeks and 6% at
 *     five years or more. https://www.ontario.ca/document/your-guide-employment-standards-act-0/vacation
 *     NOTE the statute earns vacation TIME per completed 12-month entitlement
 *     year and vacation PAY as 4%/6% of wages. Earning 4 h per 100 h worked
 *     reproduces the two weeks for a full-time year (4% of 2,080 h = 83.2 h)
 *     and is how the percentage is commonly tracked in hours — it is an
 *     approximation of the ESA rule, said so on the screen. For the money,
 *     the existing "Vacation pay (% of gross)" method is the exact rule.
 *   ca_sick — California Labor Code § 246(b)(1), as amended by SB 616
 *     (effective 2024-01-01): at least one hour per 30 hours worked. An
 *     employer MAY limit total accrual to 80 hours / 10 days and use to 40
 *     hours / 5 days a year — permitted limits, not required, so no cap is set.
 *     https://www.dir.ca.gov/dlse/paid_sick_leave.htm
 *   wa_sick — Washington RCW 49.46.210: at least one hour per 40 hours
 *     worked; up to 40 unused hours carry into the next year. No annual
 *     accrual cap. https://lni.wa.gov/workers-rights/leave/paid-sick-leave/
 *   co_sick — Colorado Healthy Families and Workplaces Act, C.R.S.
 *     8-13.3-403: one hour per 30 hours worked, up to 48 hours a year.
 *     https://cdle.colorado.gov/sites/cdle/files/info_%236b_rights_and_obligations_under_hfwa_2.27.2026.pdf
 *   ny_sick_40 / ny_sick_56 — New York Labor Law § 196-b: one hour per 30
 *     hours worked, up to 40 hours a year (5–99 employees; also 1–4 employees,
 *     paid only if net income exceeds $1M) or 56 hours (100+ employees).
 *     https://www.ny.gov/new-york-paid-sick-leave/new-york-paid-sick-leave
 */
export const ACCRUAL_PRESETS = Object.freeze([
  {
    key: "on_vacation_4",
    region: "CA-ON",
    kind: "vacation",
    name: "Vacation (4% of hours)",
    hoursEarned: 4,
    perHoursWorked: 100,
    yearlyCapHours: null,
    source: "Ontario ESA, ss. 33–35.2 (under 5 years)",
    sourceUrl: "https://www.ontario.ca/document/your-guide-employment-standards-act-0/vacation",
  },
  {
    key: "on_vacation_6",
    region: "CA-ON",
    kind: "vacation",
    name: "Vacation (6% of hours)",
    hoursEarned: 6,
    perHoursWorked: 100,
    yearlyCapHours: null,
    source: "Ontario ESA, ss. 33–35.2 (5 years or more)",
    sourceUrl: "https://www.ontario.ca/document/your-guide-employment-standards-act-0/vacation",
  },
  {
    key: "ca_sick",
    region: "US-CA",
    kind: "sick",
    name: "Paid sick leave (California)",
    hoursEarned: 1,
    perHoursWorked: 30,
    yearlyCapHours: null,
    source: "California Labor Code § 246(b)(1) (SB 616, 2024)",
    sourceUrl: "https://www.dir.ca.gov/dlse/paid_sick_leave.htm",
  },
  {
    key: "wa_sick",
    region: "US-WA",
    kind: "sick",
    name: "Paid sick leave (Washington)",
    hoursEarned: 1,
    perHoursWorked: 40,
    yearlyCapHours: null,
    source: "Washington RCW 49.46.210",
    sourceUrl: "https://lni.wa.gov/workers-rights/leave/paid-sick-leave/",
  },
  {
    key: "co_sick",
    region: "US-CO",
    kind: "sick",
    name: "Paid sick leave (Colorado)",
    hoursEarned: 1,
    perHoursWorked: 30,
    yearlyCapHours: 48,
    source: "Colorado HFWA, C.R.S. 8-13.3-403",
    sourceUrl: "https://cdle.colorado.gov/sites/cdle/files/info_%236b_rights_and_obligations_under_hfwa_2.27.2026.pdf",
  },
  {
    key: "ny_sick_40",
    region: "US-NY",
    kind: "sick",
    name: "Paid sick leave (New York, 5–99 employees)",
    hoursEarned: 1,
    perHoursWorked: 30,
    yearlyCapHours: 40,
    source: "New York Labor Law § 196-b",
    sourceUrl: "https://www.ny.gov/new-york-paid-sick-leave/new-york-paid-sick-leave",
  },
  {
    key: "ny_sick_56",
    region: "US-NY",
    kind: "sick",
    name: "Paid sick leave (New York, 100+ employees)",
    hoursEarned: 1,
    perHoursWorked: 30,
    yearlyCapHours: 56,
    source: "New York Labor Law § 196-b",
    sourceUrl: "https://www.ny.gov/new-york-paid-sick-leave/new-york-paid-sick-leave",
  },
]);

export function presetByKey(key) {
  return ACCRUAL_PRESETS.find((p) => p.key === key) || null;
}

function num(v) {
  if (v === null || v === undefined || v === "") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

const toMs = (v) => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (v == null || v === "") return NaN;
  return new Date(v).getTime();
};

/** Midnight UTC of a calendar day, from "YYYY-MM-DD" or a Date; NaN if not one. */
export function utcDayMs(value) {
  if (value == null || value === "") return NaN;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const ms = Date.parse(`${value}T00:00:00Z`);
    // Date.parse rolls 2026-02-31 into March; refuse rather than roll.
    if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return NaN;
    return ms;
  }
  const ms = toMs(value);
  if (!Number.isFinite(ms)) return NaN;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export const isoOfMs = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * A rate, or the reason it is not one.
 *
 * Refuses rather than repairs: an owner who typed "1 per 0" or "-4 per 100"
 * meant something, and a silently clamped rate is a policy they believe
 * exists and does not. More than one hour earned per hour worked is refused
 * too — no rule we know of does it, and it is the typo shape (100 per 4).
 *
 * @returns {{ rate: {hoursEarned, perHoursWorked} | null, error: string|null }}
 */
export function normaliseRate(hoursEarned, perHoursWorked) {
  const he = num(hoursEarned);
  const per = num(perHoursWorked);
  if (!Number.isFinite(he) || !Number.isFinite(per)) {
    return { rate: null, error: "Enter how many hours are earned and per how many hours worked." };
  }
  if (he <= 0 || per <= 0) {
    return { rate: null, error: "Both numbers in the accrual rate must be more than zero." };
  }
  if (per > MAX_PER_HOURS_WORKED) {
    return { rate: null, error: `"Per hours worked" can be at most ${MAX_PER_HOURS_WORKED}.` };
  }
  if (he > per) {
    return { rate: null, error: "That rate earns more than an hour of leave per hour worked — check the two numbers." };
  }
  return { rate: { hoursEarned: round4(he), perHoursWorked: round2(per) }, error: null };
}

/** A yearly cap: null (no cap) or a positive number of hours; otherwise an error. */
export function normaliseCap(value) {
  if (value === null || value === undefined || value === "") return { cap: null, error: null };
  const n = num(value);
  if (!Number.isFinite(n) || n <= 0) {
    return { cap: null, error: "The yearly cap must be more than zero, or left blank for no cap." };
  }
  if (n > HOURS_IN_LEAP_YEAR) return { cap: null, error: `The yearly cap can be at most ${HOURS_IN_LEAP_YEAR} hours.` };
  return { cap: round2(n), error: null };
}

/** Hours in one day off: required, more than 0, at most 24. */
export function normaliseHoursPerDay(value) {
  const n = num(value);
  if (!Number.isFinite(n) || n <= 0 || n > 24) {
    return { hoursPerDay: null, error: "Say how many hours one day off is worth (more than 0, at most 24)." };
  }
  return { hoursPerDay: round2(n), error: null };
}

/** The rate as a percentage of hours worked: 4 per 100 → 4, 1 per 30 → 3.33. */
export function ratePercent(rate) {
  if (!rate) return null;
  const he = num(rate.hoursEarned);
  const per = num(rate.perHoursWorked);
  if (!(he > 0) || !(per > 0)) return null;
  return round2((he / per) * 100);
}

const sameRate = (a, b) =>
  Boolean(a && b) && round4(num(a.hoursEarned)) === round4(num(b.hoursEarned)) &&
  round2(num(a.perHoursWorked)) === round2(num(b.perHoursWorked));

/** Is a policy's rate and cap still exactly the preset it says it came from? */
export function presetStillMatches(key, { hoursEarned, perHoursWorked, yearlyCapHours } = {}) {
  const p = presetByKey(key);
  if (!p) return false;
  if (!sameRate(p, { hoursEarned, perHoursWorked })) return false;
  const cap = yearlyCapHours === null || yearlyCapHours === undefined || yearlyCapHours === "" ? null : round2(num(yearlyCapHours));
  return cap === p.yearlyCapHours;
}

/** Cleaned rate history: valid entries only, oldest first. */
export function cleanRateHistory(history) {
  const out = [];
  for (const h of Array.isArray(history) ? history : []) {
    const from = typeof h?.from === "string" ? h.from : null;
    if (!from || !Number.isFinite(utcDayMs(from))) continue;
    const { rate } = normaliseRate(h.hoursEarned, h.perHoursWorked);
    if (!rate) continue;
    out.push({ from, ...rate });
  }
  return out.sort((a, b) => a.from.localeCompare(b.from));
}

/**
 * The history after a rate is saved on `todayIso`.
 *
 * Unchanged rate → unchanged history (saving the name must not add a row).
 * A second change on the same day replaces that day's entry — the rate a day
 * is earned at is the one the day ended with, not a sequence of typos.
 */
export function nextRateHistory(history, rate, todayIso) {
  const list = cleanRateHistory(history);
  const { rate: r } = normaliseRate(rate?.hoursEarned, rate?.perHoursWorked);
  if (!r) return list;
  const last = list[list.length - 1];
  if (last && sameRate(last, r)) return list;
  if (last && last.from === todayIso) return [...list.slice(0, -1), { from: todayIso, ...r }];
  return [...list, { from: todayIso, ...r }];
}

/**
 * rateAt(ms) for one person under one policy.
 *
 * @param policy     { accrualHoursEarned, accrualPerHoursWorked, accrualRateHistory }
 * @param overrides  this person's LeaveAccrualOverride rows for this policy
 * @returns (ms) => { hoursEarned, perHoursWorked, source: "policy"|"override", from } | null
 */
export function buildRateAt({ policy = {}, overrides = [] } = {}) {
  let history = cleanRateHistory(policy.accrualRateHistory);
  if (!history.length) {
    const { rate } = normaliseRate(policy.accrualHoursEarned, policy.accrualPerHoursWorked);
    history = rate ? [{ from: null, ...rate }] : [];
  }
  const policySteps = history.map((h, i) => ({
    at: i === 0 ? -Infinity : utcDayMs(h.from),
    from: i === 0 ? null : h.from,
    hoursEarned: h.hoursEarned,
    perHoursWorked: h.perHoursWorked,
  }));

  const overrideSteps = (Array.isArray(overrides) ? overrides : [])
    .map((o) => {
      const at = utcDayMs(o.effectiveFrom);
      if (!Number.isFinite(at)) return null;
      const bothBlank =
        (o.hoursEarned === null || o.hoursEarned === undefined) &&
        (o.perHoursWorked === null || o.perHoursWorked === undefined);
      const { rate } = normaliseRate(o.hoursEarned, o.perHoursWorked);
      // A malformed override (half a rate) is ignored rather than read as
      // "back to policy": the route refuses to write one, so meeting one means
      // something else wrote it, and guessing its intent either way is wrong.
      if (!rate && !bothBlank) return null;
      return { at, from: isoOfMs(at), rate, created: toMs(o.createdAt) || 0 };
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at || a.created - b.created);

  return (ms) => {
    if (!Number.isFinite(ms)) return null;
    let ov = null;
    for (const o of overrideSteps) if (o.at <= ms) ov = o;
    if (ov && ov.rate) {
      return { ...ov.rate, source: "override", from: ov.from };
    }
    let step = null;
    for (const s of policySteps) if (s.at <= ms) step = s;
    if (!step) return null;
    return {
      hoursEarned: step.hoursEarned,
      perHoursWorked: step.perHoursWorked,
      source: "policy",
      from: ov ? ov.from : step.from,
    };
  };
}

/**
 * Hours WORKED in one approved entry, for accrual.
 *
 * `hours` is paid hours, and is right for every paid stretch. A stretch the
 * company does not pay (paid === false, hours 0) was still worked, so its
 * length is re-derived from the clock times less unpaid breaks — through
 * entryHours, the one function every clock-out path uses, so the two can
 * never disagree about what a lunch takes off. Garbage reads as 0.
 */
export function workedHoursOfEntry(entry = {}) {
  if (entry.paid === false && entry.clockIn && entry.clockOut) {
    const h = entryHours(entry.clockIn, entry.clockOut, entry.breaks || []);
    return Number.isFinite(h) && h > 0 ? h : 0;
  }
  const h = num(entry.hours);
  return Number.isFinite(h) && h > 0 ? h : 0;
}

/** Days from earned hours, or null when a day's length is unknown. */
export function hoursToDays(hours, hoursPerDay) {
  const h = num(hours);
  const d = num(hoursPerDay);
  if (!Number.isFinite(h) || !(d > 0)) return null;
  return round2(h / d);
}

/**
 * Earned hours for one person, one policy, one year.
 *
 * @param entries   [{ at, hours }] — `at` the clock-in, `hours` already
 *                  through workedHoursOfEntry
 * @param opening   { hoursWorked, throughDate } | null — the newest
 *                  LeaveOpeningBalance for the year
 * @param rateAt    from buildRateAt
 * @param capHours  yearly cap, or null for none
 * @param hoursPerDay  the day length used to turn hours into days
 * @returns { accruedHours, accruedDays, basis }
 */
export function accrueFromHours({
  entries = [],
  opening = null,
  rateAt,
  capHours = null,
  hoursPerDay = null,
  year,
} = {}) {
  const yearStart = Date.UTC(year, 0, 1);
  const yearEnd = Date.UTC(year + 1, 0, 1);
  const rate = typeof rateAt === "function" ? rateAt : () => null;

  // ── The opening balance, and the day after it ──────────────────────────
  let openingPart = null;
  let cutoff = yearStart;
  if (opening) {
    const through = utcDayMs(opening.throughDate);
    if (Number.isFinite(through) && through >= yearStart && through < yearEnd) {
      cutoff = through + MS_DAY;
      const hours = Math.max(0, Number.isFinite(num(opening.hoursWorked)) ? num(opening.hoursWorked) : 0);
      // Valued at the rate in force on the last day it covers — the lump has
      // no dates inside it to split by, and that is the rate the person was
      // on when they arrived.
      const r = rate(through);
      openingPart = {
        hoursWorked: round2(hours),
        throughDate: isoOfMs(through),
        hoursEarned: r ? r.hoursEarned : null,
        perHoursWorked: r ? r.perHoursWorked : null,
        source: r ? r.source : null,
        earned: r ? (hours * r.hoursEarned) / r.perHoursWorked : 0,
      };
    }
  }

  // ── Time entries, grouped by the rate they were earned at ─────────────
  const groups = new Map();
  let excludedHours = 0;
  let unratedHours = 0;
  for (const e of Array.isArray(entries) ? entries : []) {
    const at = toMs(e?.at);
    if (!Number.isFinite(at) || at < yearStart || at >= yearEnd) continue;
    const h = num(e.hours);
    if (!Number.isFinite(h) || h <= 0) continue;
    if (at < cutoff) {
      excludedHours += h;
      continue;
    }
    const r = rate(at);
    if (!r) {
      unratedHours += h;
      continue;
    }
    const key = `${r.source}|${r.hoursEarned}|${r.perHoursWorked}|${r.from || ""}`;
    const g = groups.get(key) || {
      source: r.source,
      from: r.from || null,
      hoursEarned: r.hoursEarned,
      perHoursWorked: r.perHoursWorked,
      hoursWorked: 0,
      earned: 0,
    };
    g.hoursWorked += h;
    g.earned += (h * r.hoursEarned) / r.perHoursWorked;
    groups.set(key, g);
  }

  const parts = [...groups.values()].map((g) => ({
    ...g,
    hoursWorked: round2(g.hoursWorked),
    earned: round2(g.earned),
  }));
  const uncapped =
    (openingPart ? openingPart.earned : 0) +
    [...groups.values()].reduce((s, g) => s + g.earned, 0);

  const cap = capHours === null || capHours === undefined || capHours === "" ? null : num(capHours);
  const capped = Number.isFinite(cap) && cap >= 0 && uncapped > cap;
  const accruedHours = round2(capped ? cap : uncapped);
  const accruedDays = hoursToDays(accruedHours, hoursPerDay);

  return {
    accruedHours,
    accruedDays,
    basis: {
      method: "per_hours_worked",
      year,
      opening: openingPart ? { ...openingPart, earned: round2(openingPart.earned) } : null,
      parts,
      fieldquoHours: round2(parts.reduce((s, p) => s + p.hoursWorked, 0)),
      excludedHours: round2(excludedHours),
      unratedHours: round2(unratedHours),
      uncappedHours: round2(uncapped),
      capHours: Number.isFinite(cap) ? round2(cap) : null,
      capped,
      hoursPerDay: num(hoursPerDay) > 0 ? round2(num(hoursPerDay)) : null,
    },
  };
}

/**
 * What an opening balance may hold, from whatever a browser sent.
 *
 * Refuses rather than repairs, like the leave rules: an opening balance of
 * 9,000 hours by 30 June is a typo, and a clamped one would be a balance the
 * owner believes and nobody entered.
 *
 * @param policyIds  the company's leave policy ids (any status — a policy
 *                   retired since still had leave taken under it)
 * @param hiredOn    the person's start date, when known
 * @param todayIso   "YYYY-MM-DD" in UTC
 */
export function validateOpening({ year, hoursWorked, throughDate, taken, note, hiredOn = null, policyIds = [], todayIso } = {}) {
  const errors = [];
  const y = Number(year);
  const todayMs = utcDayMs(todayIso);
  const thisYear = Number.isFinite(todayMs) ? new Date(todayMs).getUTCFullYear() : NaN;
  if (!Number.isInteger(y) || y < 2000 || !(y <= thisYear)) {
    return { errors: ["Pick this year or an earlier one."], value: null };
  }
  const yearStart = Date.UTC(y, 0, 1);
  const yearEnd = Date.UTC(y + 1, 0, 1);

  const through = utcDayMs(throughDate);
  if (!Number.isFinite(through) || through < yearStart || through >= yearEnd) {
    errors.push(`The last day covered must be a date in ${y}.`);
  } else if (through > todayMs) {
    errors.push("The last day covered cannot be in the future.");
  }

  // Counted from the start date when it falls in this year — hours before
  // somebody was hired are not hours they worked here.
  const hired = utcDayMs(hiredOn);
  let start = yearStart;
  if (Number.isFinite(hired) && hired >= yearStart && hired < yearEnd) start = hired;
  if (Number.isFinite(hired) && hired >= yearEnd) {
    errors.push(`Their start date is after ${y}.`);
  }

  const hours = num(hoursWorked);
  if (!Number.isFinite(hours)) {
    errors.push("Enter the hours worked — 0 if there were none.");
  } else if (hours < 0) {
    errors.push("Hours worked cannot be negative.");
  }

  let spanDays = 0;
  if (Number.isFinite(through) && through >= start) spanDays = Math.round((through - start) / MS_DAY) + 1;
  if (Number.isFinite(hours) && hours > 0 && Number.isFinite(through)) {
    if (through < start) {
      errors.push("Their start date is after the last day covered, so there are no hours to enter.");
    } else if (hours > spanDays * 24) {
      errors.push(`${round2(hours)} hours is more than there are in ${spanDays} day(s) — check the figure.`);
    }
  }

  const cleanTaken = [];
  const seen = new Set();
  const allowed = new Set(policyIds);
  for (const row of Array.isArray(taken) ? taken : []) {
    const policyId = typeof row?.policyId === "string" ? row.policyId : "";
    const raw = row?.days;
    if (raw === "" || raw === null || raw === undefined) continue;
    const d = num(raw);
    if (!allowed.has(policyId)) {
      errors.push("Leave taken must be under one of the company's own policies.");
      continue;
    }
    if (seen.has(policyId)) {
      errors.push("Each kind of leave can be entered once.");
      continue;
    }
    seen.add(policyId);
    if (!Number.isFinite(d) || d < 0) {
      errors.push("Days taken must be zero or more.");
      continue;
    }
    if (d > 366 || (spanDays && d > spanDays)) {
      errors.push(`${round2(d)} days taken is more than the ${spanDays || 366} day(s) covered.`);
      continue;
    }
    if (d > 0) cleanTaken.push({ policyId, days: round2(d) });
  }

  const cleanNote = typeof note === "string" ? note.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_NOTE) : "";

  if (errors.length) return { errors, value: null };
  return {
    errors: [],
    value: {
      year: y,
      hoursWorked: round2(hours),
      throughDate: new Date(through),
      taken: cleanTaken,
      note: cleanNote || null,
    },
  };
}

/** Days taken under one policy in an opening balance's `taken` list. */
export function openingTakenFor(opening, policyId) {
  if (!opening) return 0;
  for (const row of Array.isArray(opening.taken) ? opening.taken : []) {
    if (row?.policyId === policyId) {
      const d = num(row.days);
      return Number.isFinite(d) && d > 0 ? round2(d) : 0;
    }
  }
  return 0;
}

/**
 * A per-person override, from what a browser sent. Both rate fields blank
 * means "back to the company policy from this date".
 */
export function validateOverride({ effectiveFrom, hoursEarned, perHoursWorked, note, todayIso } = {}) {
  const errors = [];
  const at = utcDayMs(effectiveFrom);
  const today = utcDayMs(todayIso);
  if (!Number.isFinite(at) || new Date(at).getUTCFullYear() < 2000) {
    errors.push("Pick the day the rate starts.");
  } else if (Number.isFinite(today) && at > today + 366 * MS_DAY) {
    errors.push("The rate can start at most a year from today.");
  }
  const blank = (v) => v === null || v === undefined || v === "";
  let rate = null;
  if (!(blank(hoursEarned) && blank(perHoursWorked))) {
    const r = normaliseRate(hoursEarned, perHoursWorked);
    if (r.error) errors.push(r.error);
    rate = r.rate;
  }
  const cleanNote = typeof note === "string" ? note.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_NOTE) : "";
  if (errors.length) return { errors, value: null };
  return {
    errors: [],
    value: {
      effectiveFrom: new Date(at),
      hoursEarned: rate ? rate.hoursEarned : null,
      perHoursWorked: rate ? rate.perHoursWorked : null,
      note: cleanNote || null,
    },
  };
}
