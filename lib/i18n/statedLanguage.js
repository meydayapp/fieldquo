// lib/i18n/statedLanguage.js
//
// Which language the SHELL renders in — and why one page can hold more than
// one answer to that question.
//
// ── The bug this exists to stop ────────────────────────────────────────────
//
// /app nests two LanguageProviders. The root one (app/layout.js) is mounted
// with no props, because on the marketing site there is no account to ask and
// a stranger's browser is the only signal there is. The inner one
// (app/app/layout.js) is handed the signed-in user's saved preference with
// `fromAccount`, which is the flag that says "this is a stated CHOICE, not a
// guess" and makes it ignore localStorage.
//
// That works for everything rendered INSIDE the inner provider. It does not
// work for anything rendered beside it — and the app shell renders four such
// things after the closing tag: AppTours, ErrorToast, PlanRequiredPrompt and
// JenniferPanel. Those read the ROOT provider, which is still following
// localStorage.
//
// localStorage is per-BROWSER and this origin is shared with the marketing
// site, so the key that surface reads is whatever language the marketing site
// was last viewed in. The owner's account is Spanish; his browser had
// "fieldquo-language" = "uk" from fieldquo.com; every /app screen rendered
// Spanish and every first-visit TOUR rendered Ukrainian. The same incident is
// on record in app/sales/layout.js, where the portal came up in German.
//
// The fix is not to move a JSX tag — that repairs one mount point and leaves
// the trap armed for the next thing mounted outside the provider. A stated
// account preference is a fact about the PERSON, so it holds for the whole
// page: once any provider on the page has been told one, every other provider
// defers to it instead of to a browser guess.
//
// ── Why a module-level store rather than a context ─────────────────────────
//
// A context can only be read by descendants, and descendants are exactly the
// thing that already worked. The surfaces that broke are cousins of the
// provider that knows the answer, and nothing in the React tree connects them.
//
// Mutated only from effects, never during render, so the value is always null
// on the server and no state crosses a request boundary.

import {
  DEFAULT_LANGUAGE,
  isSupported,
  normalizeLanguage,
} from "@/app/i18n/languages";

/**
 * The single decision every LanguageProvider makes, as a pure function so it
 * can be executed against the inputs that produced the bug — see
 * scripts/check-tour-language.mjs. Every argument is a SIGNAL, in the order
 * they outrank each other:
 *
 * @param initialLanguage  what the server rendered with
 * @param fromAccount      initialLanguage is a signed-in user's saved choice
 * @param stated           a choice announced by another provider on this page
 * @param stored           localStorage["fieldquo-language"] — shared origin,
 *                         so this is the marketing site's guess as often as
 *                         it is this user's
 * @param browser          navigator.language
 */
export function resolveShellLanguage({
  initialLanguage = null,
  fromAccount = false,
  stated = null,
  stored = null,
  browser = null,
} = {}) {
  // A stated choice ends the question. Falling through to `stored` here is
  // what took French away from a user who had picked it in Settings, on any
  // browser that had ever seen the marketing site in English.
  if (fromAccount) {
    return isSupported(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE;
  }

  // Somebody else on this page was told the account's choice. Deferring to it
  // is the whole point of this module.
  if (isSupported(stated)) return stated;

  if (isSupported(stored)) return stored;

  // No preference anywhere: guess from the browser, so a francophone visitor
  // doesn't have to find the switcher on their first visit. Only when it says
  // something — normalizeLanguage answers "en" for every code it doesn't
  // recognise, and treating that as a signal would overwrite a server-rendered
  // language with an invented English.
  const fromBrowser = normalizeLanguage(browser);
  if (fromBrowser !== DEFAULT_LANGUAGE) return fromBrowser;

  return isSupported(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE;
}

// ── The announcement channel ───────────────────────────────────────────────

let stated = null;
let owner = null;
const listeners = new Set();

/** The account choice announced on this page, or null. */
export function statedLanguage() {
  return stated;
}

/**
 * Announce a stated account preference for the whole page.
 *
 * `ownerKey` is any stable per-instance object. It exists so a retract from a
 * provider that has already been superseded cannot clear a newer provider's
 * answer — which is exactly what happens under StrictMode's double mount, and
 * would blank the language for one frame on every dev render.
 */
export function announceStatedLanguage(ownerKey, code) {
  if (!isSupported(code)) return;
  owner = ownerKey;
  if (stated === code) return;
  stated = code;
  for (const fn of [...listeners]) fn(stated);
}

/** Withdraw it — a navigation out of /app puts the guesses back in charge. */
export function retractStatedLanguage(ownerKey) {
  if (owner !== ownerKey) return;
  owner = null;
  if (stated === null) return;
  stated = null;
  for (const fn of [...listeners]) fn(null);
}

/** @returns an unsubscribe function. */
export function subscribeStatedLanguage(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Test seam. Exported rather than reached into, so the check script resets the
// same way a fresh page load does.
export function __resetStatedLanguage() {
  stated = null;
  owner = null;
  listeners.clear();
}
