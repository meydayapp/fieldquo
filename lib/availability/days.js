// lib/availability/days.js
//
// The pure half of an availability request: the day shape, the apply-now
// decision, the diff against the current week, the hours a week adds up
// to. No database, no clock of its own — imported by the request screen in
// the browser (to validate before submitting), by the store, and by the
// check script, which executes every rule here against hostile input.
//
// ── The day shape ────────────────────────────────────────────────────────
//
// `days` is the array /api/availability PATCH takes: [{ dayOfWeek 0–6,
// startTime "HH:MM", endTime "HH:MM", timezone }]. Several rows per day are
// "8–12 and 2–6". "All day" is 00:00–23:59 — the schedule table's time is a
// string, and a 24:00 does not parse. A day with no rows is a day they are
// not available; an empty list altogether is refused (see the schema note).

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const DEFAULT_TZ = "America/Toronto";

/**
 * Validate and normalise a `days` payload. Returns { ok, days } or
 * { ok:false, error }. Junk rows are refused, not dropped — a request that
 * silently lost its Tuesday would be approved as something the worker never
 * said.
 */
export function normaliseDays(input, { timezone = DEFAULT_TZ } = {}) {
  if (!Array.isArray(input)) return { ok: false, error: "days must be a list." };
  if (input.length === 0) return { ok: false, error: "Pick at least one day and time you can work." };
  if (input.length > 7 * 6) return { ok: false, error: "That is too many time ranges." };
  const days = [];
  for (const row of input) {
    if (!row || typeof row !== "object") return { ok: false, error: "A day is missing." };
    const dow = Number(row.dayOfWeek);
    if (!Number.isInteger(dow) || dow < 0 || dow > 6) return { ok: false, error: "A day is out of range." };
    const startTime = String(row.startTime || "");
    const endTime = String(row.endTime || "");
    if (!TIME.test(startTime) || !TIME.test(endTime)) return { ok: false, error: "Times must be HH:MM." };
    if (endTime <= startTime) return { ok: false, error: "Each range needs a start before its end." };
    const tz = typeof row.timezone === "string" && row.timezone ? row.timezone : timezone;
    days.push({ dayOfWeek: dow, startTime, endTime, timezone: tz });
  }
  // Ranges on the same day must not overlap — "8–12 and 10–14" is one range
  // said twice, and the fit check would read it as two.
  const byDay = {};
  for (const d of days) (byDay[d.dayOfWeek] ||= []).push(d);
  for (const list of Object.values(byDay)) {
    list.sort((a, b) => (a.startTime < b.startTime ? -1 : 1));
    for (let i = 1; i < list.length; i++) {
      if (list[i].startTime < list[i - 1].endTime) return { ok: false, error: "Two ranges on the same day overlap." };
    }
  }
  days.sort((a, b) => a.dayOfWeek - b.dayOfWeek || (a.startTime < b.startTime ? -1 : 1));
  return { ok: true, days };
}

/** "YYYY-MM-DD" → a UTC-midnight Date, or null. Same convention as LeaveRequest.startDate. */
export function effectiveDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Should an approved request be applied NOW? Yes when its effective date is
 * today or already past (UTC calendar days, like the cron that reads it).
 * A future date waits for /api/cron/availability-apply.
 */
export function appliesNow(effectiveFrom, now = new Date()) {
  const eff = effectiveFrom instanceof Date ? effectiveFrom : new Date(effectiveFrom);
  if (Number.isNaN(eff.getTime())) return false;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return eff.getTime() <= today.getTime();
}

/**
 * The difference between the current week and the proposed one, per day,
 * for the manager's "Needs review" card. Pure: [{ dayOfWeek, before:
 * ["08:00–16:00"], after: ["08:00–12:00"], changed }].
 */
export function diffWeeks(current, proposed) {
  const label = (rows, dow) =>
    (rows || [])
      .filter((r) => Number(r.dayOfWeek) === dow)
      .map((r) => `${r.startTime}–${r.endTime}`)
      .sort();
  return Array.from({ length: 7 }, (_, dow) => {
    const before = label(current, dow);
    const after = label(proposed, dow);
    return { dayOfWeek: dow, before, after, changed: before.join("|") !== after.join("|") };
  });
}

/** Hours per week the proposed rows add up to — a plain number for the card. */
export function weeklyHours(days) {
  let minutes = 0;
  for (const d of days || []) {
    const [sh, sm] = String(d.startTime).split(":").map(Number);
    const [eh, em] = String(d.endTime).split(":").map(Number);
    if ([sh, sm, eh, em].some((n) => !Number.isFinite(n))) continue;
    minutes += Math.max(0, eh * 60 + em - (sh * 60 + sm));
  }
  return Math.round((minutes / 60) * 100) / 100;
}

