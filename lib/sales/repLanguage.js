// lib/sales/repLanguage.js
//
// What language a sales rep works in — and, more importantly, how to tell
// "they chose English" apart from "nobody ever asked them".
//
// ══ The bug this exists to end ════════════════════════════════════════════
//
// app/sales/layout.js used to render:
//
//     <LanguageProvider initialLanguage="en" fromAccount>
//
// `fromAccount` is the provider's own switch for "this value is a signed-in
// user's SAVED preference", and it makes the provider skip both of its
// fallbacks — localStorage and navigator.language. Passing it beside a
// hardcoded literal told the provider a decision had been made by somebody who
// had never been offered the choice. That is AGENTS.md failure class #5:
// absence of a statement is not a statement.
//
// It was not laziness at the time — the old comment there records a real
// incident. The rep console came up in German for a rep whose browser had once
// visited fieldquo.com in German, because localStorage is per-BROWSER and the
// marketing site shares the origin. localStorage["fieldquo-language"] was "de"
// while navigator.language was "en-US", so the console was speaking a language
// nobody in the room had asked for. With no per-rep preference to appeal to,
// asserting English was the only lever available.
//
// That comment also said what would change the answer: "the day a per-rep
// language preference exists this becomes one prop instead of a rewrite."
// SalesRep.language is that day. A rep who lands in the wrong language can now
// fix it in one click on /sales/pay, and /sales/welcome asks them on their
// first morning — so a stale marketing-site click is a nuisance with two exits
// rather than a trap with none.
//
// ══ Why null is not "en" ══════════════════════════════════════════════════
//
// The column is nullable with no default, for the reason lib/i18n/
// resolveLanguage.js gives about User.language: storing "en" on somebody who
// never opened the picker freezes them there, and every later change to how the
// fallback works would then skip exactly the people who never expressed a
// preference. Null means inherit, and here inheriting means the provider's own
// guesses.
//
// ══ What a rep gets in their chosen language, honestly stated ═════════════
//
// The rep portal is PARTLY translated: the shell (SalesShell.js), the sign-in
// and invite screens, and the companies book go through t(). The outreach
// screens, notes, calendar, demo, support, voicemail and this settings screen
// are written in English literals — docs/sales-intel/STATUS.md records that
// split, and SalesShell's tab list names it per tab. So choosing French moves
// the chrome and leaves most bodies in English.
//
// The picker SAYS SO rather than implying a fully translated console. The
// alternative — hiding the control until every screen is translated — is the
// worse one: it leaves a francophone rep with nothing at all, and leaves the
// layout telling the provider a lie in the meantime.
//
// Pure. No database, no React, no next/*. scripts/check-rep-settings.mjs
// executes every function here against hostile input.

import { LANGUAGES, isSupported } from "@/app/i18n/languages";

/**
 * The languages a rep may choose from.
 *
 * Derived from app/i18n/languages.js rather than listed again here. A second
 * list is the copy-paste failure class AGENTS.md names, and the copy that rots
 * is the one nobody re-reads — a rep would be offered a language the validator
 * on the other side of the request had already dropped.
 *
 * Only what a picker needs travels: a code, and the name in that language.
 * A rep looking for their own language looks for "Français", not for "French".
 */
export const REP_LANGUAGE_OPTIONS = Object.freeze(
  LANGUAGES.map((l) => Object.freeze({ code: l.code, nativeName: l.nativeName, name: l.name })),
);

/**
 * A stated language, or null when nobody has stated one.
 *
 * @returns a supported lowercase code, or null. NEVER a default.
 *
 * ── Why this is not app/i18n/languages.js's normalizeLanguage() ───────────
 *
 * normalizeLanguage("zz") returns "en". That is right for its job — mapping a
 * browser's Accept-Language onto something renderable — and exactly wrong for
 * this one: it turns "I do not recognise this" into "they chose English",
 * which is the assertion this whole module exists to stop making.
 *
 * ── Why a region tag is refused rather than narrowed ──────────────────────
 *
 * "fr-CA" could be read as "fr". It is not, because nothing can legitimately
 * put it in this column: the only writer is /api/sales/language, which accepts
 * exact codes from REP_LANGUAGE_OPTIONS. A value that shape means a hand-edit
 * or corrupt data, and a reader that silently repairs what the writer refuses
 * is a reader and a writer that disagree about whether the column is valid.
 * Falling back to the browser for it is the honest read.
 *
 * Non-strings, objects and numbers all land on null rather than throwing: this
 * runs in a layout that renders the sign-in page, and an exception there takes
 * down the only screen that fixes anything.
 */
export function repLanguageOrNull(value) {
  if (typeof value !== "string") return null;
  const code = value.trim().toLowerCase();
  if (!code) return null;
  return isSupported(code) ? code : null;
}

/**
 * What app/sales/layout.js hands <LanguageProvider>.
 *
 * This is the whole point of the file, so it is one function rather than two
 * expressions in the layout: the language and the `fromAccount` flag must be
 * decided TOGETHER or they can disagree, and the disagreement is silent. A
 * layout that computed the code in one place and the flag in another is how
 * `fromAccount` ends up hardcoded true again.
 *
 * @param rep  the SalesRep row, or null when nobody is signed in (the sign-in
 *             and invite screens render under this layout too).
 *
 * @returns `{ language, fromAccount }`
 *
 *   · A supported stored code → `{ language: "fr", fromAccount: true }`.
 *     A decision. The provider skips localStorage and navigator, so a stale
 *     marketing-site click cannot overrule it on a shared browser.
 *
 *   · Anything else → `{ language: null, fromAccount: false }`.
 *     No statement, so the provider falls back the way it was built to:
 *     localStorage, then the browser's own language. Null rather than "en"
 *     because the provider already renders DEFAULT_LANGUAGE for an unsupported
 *     initial value, and passing "en" here would put an invented English back
 *     into the very argument that is supposed to say nothing.
 *
 * The second branch covers a case worth naming: a language DROPPED from
 * app/i18n/languages.js after a rep chose it. The stored code stops being
 * supported, this returns fromAccount: false, and the rep falls back to a
 * language that exists instead of the console rendering against a translation
 * set that is no longer there. Their column is left alone — the day the
 * language comes back, so does their choice.
 */
export function shellLanguage(rep) {
  const stated = repLanguageOrNull(rep?.language);
  return { language: stated, fromAccount: stated !== null };
}

/**
 * Validate what the picker posted.
 *
 * @returns `{ ok: true, language }` where language is a supported code or null,
 *          or `{ ok: false, error }` with a sentence a rep can act on.
 *
 * null is ACCEPTED and means "follow my browser" — the picker offers it as a
 * real option, because a rep who wants to undo a choice needs somewhere to
 * put it back. Undefined and a missing key are refused instead of being read
 * as null: a body that forgot the field and a rep who cleared their preference
 * are different events, and collapsing them would let a malformed request
 * quietly wipe a stated choice.
 */
export function parseLanguageChoice(body) {
  if (!body || typeof body !== "object" || !("language" in body)) {
    return { ok: false, error: "Send a language, or null to follow your browser." };
  }
  const raw = body.language;
  if (raw === null) return { ok: true, language: null };
  const code = repLanguageOrNull(raw);
  if (!code) {
    return {
      ok: false,
      error: "That isn't a language FieldQuo has been translated into.",
    };
  }
  return { ok: true, language: code };
}
