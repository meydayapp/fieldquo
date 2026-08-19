// lib/i18n/duration.js
//
// One way to say "3 days" on screen, in any of the six languages.
//
// ── Why a formatter rather than two message keys ──────────────────────────
//
// The follow-ups settings page printed the delay in two places — the rule list
// and the flow diagram — and both built the sentence by hand out of a number
// and a bare plural noun ("app.time.days"). That renders "1 days" in English
// and "Attendre 1 jours" in French, and the list didn't even translate the
// unit: it printed the raw `delayUnit` column, so a French user read "1 days".
//
// Two call sites doing the same concatenation is exactly the duplication that
// rots, so the phrase is assembled in ONE place and the catalogue supplies the
// declined noun. Any future surface with a duration uses this and gets the
// plural rules for free.
//
// ── Why these keys are separate from app.time.* ───────────────────────────
//
// app.time.hours / .days / .minutes are still correct and still used: they
// label the UNIT PICKER on the same page, where a bare plural noun is what a
// dropdown option should say. app.duration.* is a different thing — a quantity
// and its noun agreeing with each other. Collapsing the two would force the
// picker to invent a count it doesn't have.

/**
 * Unit → message key. Literals in one place on purpose:
 * scripts/check-translations.mjs finds keys by scanning for "app.*" string
 * literals and is blind to computed ones, so a key built as
 * `app.duration.${unit}` would silently escape the coverage gate.
 */
export const DURATION_UNIT_KEYS = {
  minutes: "app.duration.minutes",
  hours: "app.duration.hours",
  days: "app.duration.days",
};

/**
 * "3 days" / "3 jours" / "3 дні", in the language `t` is bound to.
 *
 * An unrecognised unit falls back to days rather than throwing or printing the
 * raw column. That mirrors the automation itself: cutoffFor() in
 * app/api/cron/follow-ups/route.js treats anything that isn't "hours" as days,
 * and so does delayMs() in lib/followUps/flow.js. A rule stored with a unit
 * this build doesn't know really is chased in days, so saying "days" is the
 * honest reading, not a guess.
 *
 * @param {(key: string, values?: object) => string} t  from useTranslation()
 * @param {number|string} value
 * @param {string} unit  "minutes" | "hours" | "days"
 */
export function formatDuration(t, value, unit) {
  const key = DURATION_UNIT_KEYS[unit] || DURATION_UNIT_KEYS.days;
  return t(key, { value });
}
