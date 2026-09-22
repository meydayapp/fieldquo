// lib/dailySheets/weekly.js
//
// One person's week, from their daily sheets and their time entries.
// Pure: the route loads the rows, this adds them up.

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * @param {object} p
 * @param {Array} p.sheets      DailyObjectiveSheet rows for the week, any order
 * @param {Array} p.entries     TimeEntry rows (clockIn, clockOut, hours) for the week
 * @param {string[]} p.dayKeys  the seven "YYYY-MM-DD" keys, Monday first
 * @param {(entry) => string} p.dayKeyOf  which day an entry belongs to
 * @returns {{ days: Array, totals: object }}
 */
export function weeklySummary({ sheets, entries, dayKeys, dayKeyOf }) {
  const byDay = new Map(dayKeys.map((k) => [k, { dateKey: k, hours: 0, objectives: 0, done: 0, upsellCents: 0, score: null, bonusCents: null, hasSheet: false }]));

  for (const e of Array.isArray(entries) ? entries : []) {
    if (!e || !e.clockOut) continue;
    const h = Number(e.hours);
    if (!Number.isFinite(h) || h <= 0) continue;
    const k = dayKeyOf(e);
    const d = byDay.get(k);
    if (d) d.hours = round2(d.hours + h);
  }

  for (const s of Array.isArray(sheets) ? sheets : []) {
    const k = s?.dateKey;
    const d = byDay.get(k);
    if (!d) continue;
    d.hasSheet = true;
    const objectives = Array.isArray(s.objectives) ? s.objectives : [];
    d.objectives = objectives.length;
    d.done = objectives.filter((o) => o?.status === "done").length;
    d.upsellCents = (Array.isArray(s.upsells) ? s.upsells : []).reduce((sum, u) => {
      const c = Math.round(Number(u?.amountCents));
      return sum + (Number.isFinite(c) && c > 0 ? c : 0);
    }, 0);
    d.score = Number.isFinite(Number(s.evaluationScore)) && s.evaluationScore != null ? Number(s.evaluationScore) : null;
    d.bonusCents = s.bonusCents == null ? null : Number(s.bonusCents);
  }

  const days = dayKeys.map((k) => byDay.get(k));
  const scored = days.filter((d) => d.score != null);
  const totals = {
    hours: round2(days.reduce((s, d) => s + d.hours, 0)),
    objectives: days.reduce((s, d) => s + d.objectives, 0),
    done: days.reduce((s, d) => s + d.done, 0),
    upsellCents: days.reduce((s, d) => s + d.upsellCents, 0),
    // Null, not 0, when no day was scored — an average of nothing is not 0/5.
    avgScore: scored.length ? round2(scored.reduce((s, d) => s + d.score, 0) / scored.length) : null,
    // Null when no sheet carried a bonus figure (no rule), so the summary
    // prints "—" rather than "$0.00 bonus".
    bonusCents: days.some((d) => d.bonusCents != null) ? days.reduce((s, d) => s + (d.bonusCents || 0), 0) : null,
    daysWithSheet: days.filter((d) => d.hasSheet).length,
  };
  return { days, totals };
}
