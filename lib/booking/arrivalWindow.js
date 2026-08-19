// lib/booking/arrivalWindow.js
//
// "Between 1:45 and 2:15 PM" instead of "2:00 PM".
//
// ══ Why a window is better for both sides ══════════════════════════════════
//
// An exact time is a promise the road breaks. Traffic, a job that overruns by
// ten minutes, a parking space two streets away — none of it is anyone's fault
// and all of it makes 2:00 into 2:12, at which point the customer has been
// standing at the window for twelve minutes deciding what they think of you.
//
// A window that was honestly stated and then met is a kept promise. The same
// arrival, described accurately in advance, produces the opposite impression.
//
// ══ Client-facing only ═════════════════════════════════════════════════════
//
// The crew's schedule keeps the exact time. An estimator told "between 1:45
// and 2:15" cannot plan a day, and the slack the window absorbs is slack the
// ROUTE has — which only the real times make visible. Nothing in this file is
// used by /app.
//
// ══ Off by default ═════════════════════════════════════════════════════════
//
// Zero means an exact time. Widening what a customer was told, on a
// contractor's behalf and without being asked, changes the promise they made.

/** The widest window we'll render. Past this it stops being an appointment. */
export const MAX_WINDOW_MINUTES = 120;

export function clampWindow(minutes) {
  if (minutes == null || minutes === "") return 0;
  const n = Number(minutes);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(MAX_WINDOW_MINUTES, Math.round(n));
}

/**
 * The window around a start time.
 *
 * @returns {{ start: Date, end: Date } | null}  null when windows are off, so
 *          the caller falls through to its existing exact-time formatting
 *          rather than rendering a zero-width range.
 */
export function windowFor(startTime, minutes) {
  const half = clampWindow(minutes);
  if (!half) return null;

  // `startTime == null` before the Date(), because `new Date(null)` is the
  // epoch — a perfectly VALID date — so the NaN check below waves it through
  // and the customer is told to expect someone in January 1970.
  if (startTime == null || startTime === "") return null;

  const t = new Date(startTime);
  if (Number.isNaN(t.getTime())) return null;

  return {
    start: new Date(t.getTime() - half * 60000),
    end: new Date(t.getTime() + half * 60000),
  };
}

// ══ Six languages, because the client-facing surfaces are ═════════════════
//
// This used to be `language === "fr" ? "fr-CA" : "en-US"`, which meant a visit
// window on a page rendered in Ukrainian or Punjabi came out in English, in
// the middle of an otherwise translated sentence — the exact failure the
// document catalogue exists to prevent, and invisible from the English side.
//
// The connector is a table rather than the word "between" interpolated,
// because Punjabi puts it after the two times, not between them. en and fr are
// byte-identical to what they were: the confirmation email that already ships
// must not change wording as a side effect of adding four languages.
const LOCALES = {
  en: "en-US",
  fr: "fr-CA",
  es: "es-419",
  uk: "uk-UA",
  pa: "pa-IN",
  tl: "fil-PH",
};

const BETWEEN = {
  en: (day, from, to) => `${day}, between ${from} and ${to}`,
  fr: (day, from, to) => `${day}, entre ${from} et ${to}`,
  es: (day, from, to) => `${day}, entre las ${from} y las ${to}`,
  uk: (day, from, to) => `${day}, між ${from} та ${to}`,
  pa: (day, from, to) => `${day}, ${from} ਅਤੇ ${to} ਵਿਚਕਾਰ`,
  tl: (day, from, to) => `${day}, sa pagitan ng ${from} at ${to}`,
};

/**
 * "Tuesday, 12 August, between 1:45 and 2:15 PM"
 *
 * Returns null rather than a fallback string when there's no window, because
 * the caller already has perfectly good exact-time formatting and a second
 * copy of it here would be the one that rots.
 */
export function describeWindow(startTime, minutes, { timezone, language = "en" } = {}) {
  const w = windowFor(startTime, minutes);
  if (!w) return null;

  const locale = LOCALES[language] || LOCALES.en;
  const phrase = BETWEEN[language] || BETWEEN.en;
  const tz = timezone || undefined;

  try {
    const day = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      ...(tz && { timeZone: tz }),
    }).format(w.start);

    // Same-day is the only case worth handling specially, and it's every case
    // that matters — a 2-hour window can't straddle midnight from a working
    // day's start time.
    const time = new Intl.DateTimeFormat(locale, {
      hour: "numeric",
      minute: "2-digit",
      ...(tz && { timeZone: tz }),
    });

    const from = time.format(w.start);
    const to = time.format(w.end);

    return phrase(day, from, to);
  } catch {
    // A bad timezone string must not cost someone their confirmation email.
    return null;
  }
}
