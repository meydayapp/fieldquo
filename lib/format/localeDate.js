// lib/format/localeDate.js
//
// Day names and dates in the READER's language, from Intl rather than from a
// catalogue.
//
// ── Why days and dates are not translation keys ─────────────────────────────
//
// A Spanish user reported "the dates and days are not translated" on
// /app/scheduler, /app/schedule and /app/settings/availability. The obvious
// fix — seven keys for Monday..Sunday, twelve for the months, times nine
// languages — is the wrong one twice over:
//
//   1. It is 171 strings of data every browser and every Node runtime already
//      ships, maintained by CLDR, in every language including the ones this
//      product has not translated yet. A hand-kept copy is nine copies of a
//      table that is already correct, and the copy is the one that rots.
//   2. It gets the ORDER wrong. "Jan 7" is "7 janv." in French, "7. Jan." in
//      German and "1月7日" in Chinese. A catalogue of month names still
//      concatenates them in English order.
//
// So the words come from Intl, keyed on the app language the user chose —
// and from lib/format/dayNames.js specifically, which is where the weekday
// table already lived when this file was written. Two modules asking Intl for
// the same seven words is the fourth recurring failure class in AGENTS.md; the
// copy is the one that rots. This file adds what dayNames.js deliberately does
// not do — week-start rotation, and the date/time shapes these screens need.
//
// ── Why the bare language code, with no region ──────────────────────────────
//
// lib/i18n/documentLabels.js maps language → a REGIONED tag (en-CA, fr-CA,
// es-419) because it formats CURRENCY, where the region decides digit grouping
// on a document a homeowner keeps. Nothing here formats money. For weekday and
// month names the bare code is what CLDR keys on anyway, and it avoids a
// second region table drifting from that one. Verified for all nine catalogue
// languages, including "tl", which Intl canonicalises to "fil" on its own.
//
// ── UTC versus local: two functions, on purpose ─────────────────────────────
//
// Same split as lib/format/companyDate.js, for the same reason. A pay-period
// boundary or a leave date is a CALENDAR DAY stored at midnight UTC; read in a
// Toronto browser without timeZone: "UTC" it renders as the day before. A
// shift start is a real INSTANT and must render in the viewer's own timezone,
// or a 7am start reads as 11am. Functions taking an ISO day string
// ("2026-09-06") pin UTC; functions taking a Date or timestamp do not.

import { DEFAULT_LANGUAGE } from "@/app/i18n/languages";
import { dayNames, dayNameTitle } from "@/lib/format/dayNames";

// Intl.DateTimeFormat construction is not free and these run inside renders,
// so formatters are memoised per (language, options) pair. The key space is
// tiny and fixed — nine languages times a handful of shapes.
const cache = new Map();

function formatter(language, options) {
  const lang = language || DEFAULT_LANGUAGE;
  const key = `${lang}|${JSON.stringify(options)}`;
  let f = cache.get(key);
  if (!f) {
    try {
      f = new Intl.DateTimeFormat(lang, options);
    } catch {
      // An unknown tag throws RangeError rather than falling back. English is
      // a worse answer than the reader's language and a much better one than
      // a blank screen where a date should be.
      f = new Intl.DateTimeFormat(DEFAULT_LANGUAGE, options);
    }
    cache.set(key, f);
  }
  return f;
}

function asDate(value) {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── Weekday names ───────────────────────────────────────────────────────────
//
// Indexed 0 = Sunday, matching getDay(), AvailabilitySchedule.dayOfWeek and
// PayCycle.periodEndDayOfWeek. Any other base needs a conversion at every call
// site, and one of them gets it wrong.
//
// RAW versus TITLE is a real distinction and both are needed on these screens.
// CLDR gives "domingo", "dimanche", "domenica" lowercase and "Sonntag"
// capitalised, because lowercase is correct mid-sentence in the Romance
// languages. The pay-cycle explainer puts the day mid-sentence ("El periodo
// cierra el domingo") and wants the raw form; a checkbox row and a <option> are
// headings and want the capital. Hence two functions, not a preference.

/**
 * The seven weekday names in `language`, as CLDR gives them.
 *
 * @param width  "long" (Sunday / dimanche) or "short" (Sun / dim.)
 */
export function weekdayNames(language, width = "long") {
  return dayNames(language || DEFAULT_LANGUAGE, { short: width === "short" });
}

/**
 * Weekday labels rotated to start on the company's chosen day.
 *
 * The underlying data never moves: only the DISPLAY order changes, and each
 * entry carries its true getDay() index so a click still writes the right
 * number.
 *
 * @param weekStartsOn  0 (Sunday) or 1 (Monday), from company preferences
 * @param language      app language code; omitted means English
 */
export function orderedWeekdayNames(
  weekStartsOn = 0,
  language = DEFAULT_LANGUAGE,
  width = "long",
) {
  // Title case: every caller of this is a row label or a column heading, never
  // a word inside a sentence.
  const start = Number(weekStartsOn) === 1 ? 1 : 0;
  return Array.from({ length: 7 }, (_, index) => ({
    label: weekdayName(index, language, width),
    index,
  })).sort((a, b) => ((a.index - start + 7) % 7) - ((b.index - start + 7) % 7));
}

/** One weekday name by getDay() index, capitalised. Out-of-range returns "". */
export function weekdayName(index, language, width = "long") {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0 || i > 6) return "";
  return dayNameTitle(i, language || DEFAULT_LANGUAGE, {
    short: width === "short",
  });
}

// ── Dates ───────────────────────────────────────────────────────────────────

/** "Sep 7" / "7 sept." / "9月7日" — a local Date, no year. */
export function formatDayMonth(value, language) {
  const d = asDate(value);
  if (!d) return "";
  return formatter(language, { month: "short", day: "numeric" }).format(d);
}

/** "Sunday, Sep 7" — a local Date, weekday included, no year. */
export function formatWeekdayDayMonth(value, language) {
  const d = asDate(value);
  if (!d) return "";
  return formatter(language, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** "Sep 7, 2026" — a local Date or instant, with the year. */
export function formatShortDate(value, language) {
  const d = asDate(value);
  if (!d) return "";
  return formatter(language, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/**
 * A CALENDAR DAY — an ISO "2026-09-06", or a Date stored at midnight UTC.
 * Pinned to UTC so a browser west of Greenwich does not print the day before.
 * See the note at the top of lib/format/companyDate.js.
 */
export function formatCalendarDay(value, language, { year = true } = {}) {
  const d = asDate(value);
  if (!d) return "";
  return formatter(language, {
    month: "short",
    day: "numeric",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(d);
}

/** "9:00 AM" / "09:00" — a real instant, in the viewer's own timezone. */
export function formatTimeOfDay(value, language) {
  const d = asDate(value);
  if (!d) return "";
  return formatter(language, { hour: "numeric", minute: "2-digit" }).format(d);
}
