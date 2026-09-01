// lib/calendar/monthGrid.js
//
// The pure date math behind a month-grid calendar — extracted from
// app/app/appointments/page.js, which had its own private copies of all
// four of these before this file existed. Reused rather than duplicated a
// second time for app/app/marketing/designer/calendar/page.js (the
// scheduled social-post calendar, docs/SOCIAL-SCHEDULING.md) — AGENTS.md's
// "copy-paste duplication instead of a shared helper" failure class, applied
// to itself the moment a second calendar needed the same math.
//
// Deliberately NOT extracted further into the two pages' actual grid JSX —
// appointments' month view is filtered by crew member, status and travel
// legs; the social calendar's is filtered by platform and shows a thumbnail.
// Those are genuinely different screens that happen to lay a month out the
// same way. This file is exactly the part that's actually identical: what
// the 42 cells of a month grid are, and how to print a date/time in the
// company's interface language.
//
// No React here — every function is a plain function over Dates and
// strings, callable from a page component or a check script without JSX.

/**
 * A LOCAL calendar day key ("2026-08-31").
 *
 * Deliberately not isoDateOnly() from lib/format/companyDate: that reads its
 * getters in UTC because it exists for date-only values (a leave date, a pay
 * period). A scheduled post, like an appointment, is an INSTANT — 8pm
 * Monday in Toronto is Tuesday in UTC — grouping by the UTC day would file
 * the last post of most evenings under tomorrow. Two kinds of value, two
 * functions, on purpose.
 */
export function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The cells of a month grid, including the leading and trailing days that
 * fill out the first and last weeks.
 *
 * Built from the (year, month, day) constructor rather than by adding
 * milliseconds, so the days it produces are local midnights and a DST
 * weekend doesn't shunt half the month by an hour.
 *
 * @param weekStartsOn 0 = Sunday, 1 = Monday — the company's setting.
 */
export function monthGrid(anchor, weekStartsOn) {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  const lead = (new Date(y, m, 1).getDay() - weekStartsOn + 7) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = Math.ceil((lead + daysInMonth) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => new Date(y, m, 1 - lead + i));
}

/**
 * Intl with the app's interface language, falling back to the browser's.
 *
 * Every language code the app offers is a well-formed tag, so this can't
 * throw in practice — but a formatter that throws would take out the whole
 * calendar, and an unstyled crash is a much worse outcome than a weekday
 * name in the wrong language.
 */
export function localeFormat(date, language, opts) {
  try {
    return date.toLocaleDateString(language || undefined, opts);
  } catch {
    return date.toLocaleDateString(undefined, opts);
  }
}

/**
 * localeFormat's sibling for an INSTANT, which needs the time as well as the
 * date. Same try/catch reasoning as localeFormat.
 */
export function localeDateTime(date, language, opts) {
  try {
    return date.toLocaleString(language || undefined, opts);
  } catch {
    return date.toLocaleString(undefined, opts);
  }
}
