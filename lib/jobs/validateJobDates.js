// lib/jobs/validateJobDates.js
//
// The rules for Job.startDate/endDate, pulled out of the PATCH route so they
// can be run against hostile input directly — see scripts/check-job-dates.mjs.
//
// ── What "hostile" means here ────────────────────────────────────────────────
//
//   * An end date with no start at all — either sent together, or an end sent
//     alone against a job that has never had a start. A job cannot finish on a
//     date it never started.
//   * An end before its own start, however sent — both in one request, or an
//     end that lands before a start the job already had.
//   * A span so long it is almost certainly a typo (a year picker landed on
//     the wrong decade, a `2026` became `2036`) rather than a real repaint.
//     366 rather than 365 so a real project spanning exactly one calendar
//     year, leap day included, is not the thing this refuses.
//
// Pure and synchronous on purpose: the API route calls this with what the
// request sent MERGED with what the row already has, so clearing just one of
// the two fields is validated against the row's real resulting state rather
// than the single field that happened to be in this PATCH.

const MAX_SPAN_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * @param next  { startDate, endDate } — Date objects or null, already merged
 *              with whatever the row keeps for a field this call didn't touch.
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function validateJobDates({ startDate, endDate }) {
  if (endDate && !startDate) {
    return {
      ok: false,
      error: "An end date needs a start date — set when the work begins first.",
    };
  }

  if (startDate && endDate) {
    const start = toTime(startDate);
    const end = toTime(endDate);
    if (start === null || end === null) {
      return { ok: false, error: "That date couldn't be read." };
    }
    if (end < start) {
      return {
        ok: false,
        error: "The end date can't be before the start date.",
      };
    }
    if (end - start > MAX_SPAN_DAYS * DAY_MS) {
      return {
        ok: false,
        error: `That's more than a year of work in one span (${MAX_SPAN_DAYS} days max) — check the dates, or split it into more than one job.`,
      };
    }
  }

  return { ok: true };
}

function toTime(value) {
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * `null`/`""` → null (clearing the field). Anything else is parsed, and an
 * unparseable value also comes back null — the ROUTE is what turns that into
 * a 400, because "unreadable" and "deliberately cleared" need different
 * responses and this function has no request to answer on.
 */
export function parseDateOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
