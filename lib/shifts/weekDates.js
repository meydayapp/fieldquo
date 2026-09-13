// lib/shifts/weekDates.js
//
// The seven local dates of the week a date falls in, from the company's
// week start — what the shift modal's "Apply to" toggles are built from.
// Pure; local Date arithmetic on purpose, so a week across a clock change
// keeps its calendar days (see lib/shifts/coverage.js for the same choice).
const pad = (n) => String(n).padStart(2, "0");
export const ymdOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** @returns [{ ymd, dow }] × 7, or [] for a date that does not parse */
export function weekDatesAround(dateStr, weekStartsOn = 0) {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return [];
  const back = (d.getDay() - weekStartsOn + 7) % 7;
  const start = new Date(d);
  start.setDate(d.getDate() - back);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(start);
    x.setDate(start.getDate() + i);
    return { ymd: ymdOf(x), dow: x.getDay() };
  });
}
