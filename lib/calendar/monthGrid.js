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

/** Plain time order. Exported because the merged list re-sorts with it. */
export const byTimeAsc = (x, y) => new Date(x.scheduledAt) - new Date(y.scheduledAt);

/**
 * A schedule list opened on what happens NEXT, rather than on the oldest
 * thing in it.
 *
 * The appointments feed arrives `scheduledAt: "asc"` (lib/schedule/feed.js)
 * because the month grid needs it that way, and the list under the grid
 * inherited that order — so with no day picked it opened on the OLDEST
 * appointment the company had ever booked. The owner, 2026-10-24: it
 * "doesn't automatically show you the next appointment in the list, always
 * the older one until you click on a specific date".
 *
 * Nothing is hidden. Past visits follow, most recent first, which is the
 * order somebody looking backwards wants anyway — a list that silently
 * dropped last week would be a worse answer than one that buried it.
 *
 * Split on the DAY and not the timestamp: at 4pm this morning's 9am visit is
 * still today's business and belongs at the top with the rest of today, not
 * filed under history. `todayKey` is a dayKey, so the comparison is a string
 * one — zero-padded YYYY-MM-DD sorts chronologically.
 *
 * Rows with no usable `scheduledAt` sort to the end rather than being
 * dropped: a row the list cannot place is still a row the list has.
 */
export function upcomingFirst(rows, todayKey) {
  const future = [];
  const past = [];
  const undated = [];
  for (const row of rows || []) {
    const at = new Date(row?.scheduledAt);
    if (Number.isNaN(at.getTime())) {
      undated.push(row);
      continue;
    }
    (dayKey(at) >= todayKey ? future : past).push(row);
  }
  future.sort(byTimeAsc);
  past.sort((x, y) => byTimeAsc(y, x));
  return [...future, ...past, ...undated];
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
