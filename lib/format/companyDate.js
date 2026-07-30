// lib/format/companyDate.js
//
// Formatting dates the way a company asked for them.
//
// ── The distinction this file exists to protect ─────────────────────────────
//
// There are two kinds of date in this product and they must NOT share a
// formatter:
//
//   CLIENT-FACING — quotes, invoices, the emails carrying them. Formatted by
//   the CLIENT's language locale, via documentFormatters() in
//   lib/i18n/documentLabels.js. A francophone homeowner reads "3 juillet
//   2026" whatever the contractor set in Settings, and a signed PDF keeps
//   saying what it said.
//
//   INTERNAL — the dashboard, lists, the email trail on a quote. This is the
//   company looking at their own data, so Company.dateFormat applies.
//
// Applying the company preference to client documents would be actively
// wrong: it would let a contractor in Gatineau who prefers DD/MM/YYYY push
// that onto a client whose locale reads it as MM/DD. On a date that decides
// when an invoice is overdue, that ambiguity is a dispute.
//
// ── Why patterns rather than Intl ───────────────────────────────────────────
//
// The three options offered in Settings are MM/DD/YYYY, DD/MM/YYYY and
// YYYY-MM-DD. Those are explicit orderings, not locales — the point of
// choosing one is to get exactly it, not whatever a locale decides. Intl is
// the right tool for the client-facing case and the wrong one here.

const PAD = (n) => String(n).padStart(2, "0");

export const DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"];

// ── Date-only values need their OWN formatter ───────────────────────────────
//
// A leave date, a pay period boundary and a hire date are calendar days, not
// instants. They arrive from a <input type="date"> as "2026-07-13", become
// `new Date("2026-07-13")` = midnight UTC, and get stored that way.
//
// Read back with getDate() — or toLocaleDateString() with no timeZone — a
// browser in Toronto is four hours behind midnight UTC and renders **12 July**.
// A payslip that says the period ended on the 25th when it ended on the 26th,
// and a booked holiday shown a day early, both from the same one-line mistake.
//
// So date-only values format from the UTC getters, and only date-only values.
// A createdAt timestamp is a real instant and must stay local — 11pm Monday
// local is Tuesday in UTC, and showing it as Tuesday would be equally wrong in
// the other direction. Two kinds of value, two functions, on purpose.

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * A calendar day, read in UTC. "Jul 13, 2026".
 *
 * @param value  Date or ISO string. Null/invalid returns "—", because a dash in
 *               a table cell is information and "Invalid Date" is a bug report
 *               aimed at the wrong person.
 */
export function formatDateOnly(value, { fallback = "—", year = true } = {}) {
  if (!value) return fallback;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  const base = `${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return year ? `${base}, ${d.getUTCFullYear()}` : base;
}

/** Same, in the company's chosen ordering rather than a month name. */
export function formatCompanyDateOnly(value, format = DEFAULT_DATE_FORMAT) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const dd = PAD(d.getUTCDate());
  const mm = PAD(d.getUTCMonth() + 1);
  const yyyy = d.getUTCFullYear();

  switch (format) {
    case "DD/MM/YYYY":
      return `${dd}/${mm}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    default:
      return `${mm}/${dd}/${yyyy}`;
  }
}

/** ISO calendar day ("2026-07-13"), for <input type="date"> and filenames. */
export function isoDateOnly(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}-${PAD(d.getUTCMonth() + 1)}-${PAD(d.getUTCDate())}`;
}

/** The app's own default, matching the settings form's initial value. */
export const DEFAULT_DATE_FORMAT = "MM/DD/YYYY";

/**
 * @param value   Date, ISO string, or anything Date can parse. Null/invalid
 *                returns "" rather than "Invalid Date", because a dash in a
 *                table cell is information and "Invalid Date" is a bug report
 *                aimed at the wrong person.
 * @param format  one of DATE_FORMATS
 */
export function formatCompanyDate(value, format = DEFAULT_DATE_FORMAT) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const dd = PAD(d.getDate());
  const mm = PAD(d.getMonth() + 1);
  const yyyy = d.getFullYear();

  switch (format) {
    case "DD/MM/YYYY":
      return `${dd}/${mm}/${yyyy}`;
    case "YYYY-MM-DD":
      return `${yyyy}-${mm}-${dd}`;
    default:
      return `${mm}/${dd}/${yyyy}`;
  }
}

/** Same date, plus the time. Times aren't ambiguous, so they stay 24h-free. */
export function formatCompanyDateTime(value, format = DEFAULT_DATE_FORMAT) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const time = d.toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${formatCompanyDate(d, format)} ${time}`;
}

/**
 * "today" / "yesterday" / "3 days ago", falling back to the formatted date
 * once it stops being useful.
 *
 * Relative age answers a different question from the date itself — "is it time
 * to chase this" rather than "when exactly" — which is why the email trail on
 * a quote shows both.
 */
export function relativeDays(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 0) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  return "";
}

// ── Week start ──────────────────────────────────────────────────────────────

/**
 * Weekday labels rotated to start on the company's chosen day.
 *
 * The underlying data never moves: AvailabilitySchedule.dayOfWeek is always
 * 0 = Sunday, matching JavaScript's getDay(). Only the DISPLAY order changes,
 * and each entry carries its true index so a click still writes the right
 * number. Reindexing the data instead is how a Monday-first company ends up
 * with their Sunday hours saved against Saturday.
 */
export function orderedWeekdays(weekStartsOn = 0) {
  const NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const start = Number(weekStartsOn) === 1 ? 1 : 0;
  return NAMES.map((label, i) => ({ label, index: i })).sort(
    (a, b) => ((a.index - start + 7) % 7) - ((b.index - start + 7) % 7),
  );
}
