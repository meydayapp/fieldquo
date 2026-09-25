// lib/i18n/languageStorage.js
//
// Everything the shell's language touches OUTSIDE memory: sessionStorage for
// a tab's explicit switch, one localStorage flag that says "this browser has
// signed in", and the one request that learns a signed-in account's language
// on a public page. The decision itself is lib/i18n/statedLanguage.js; this
// file only feeds it.
//
// Every storage call is wrapped: a browser set to block site data throws on
// the accessor itself, and a language preference is not worth a broken page.
// Every function is a no-op on the server.

import { isSupported } from "@/app/i18n/languages";
import { noteAccountLanguage, noteSessionLanguage } from "@/lib/i18n/statedLanguage";

/**
 * The PERMANENT, origin-wide key the shell used to follow — written by
 * booking pages, prefills and email-link landings as well as by the switcher.
 * Read by nothing now; removed on load so a browser still carrying one (the
 * owner's carried Spanish from a test booking page) stops being haunted by it.
 */
export const LEGACY_LANGUAGE_KEY = "fieldquo-language";

/** sessionStorage: this tab's explicit switch. Dies with the tab. */
export const SESSION_LANGUAGE_KEY = "fieldquo-language-session";

/**
 * localStorage: "1" when this browser has reached /app signed in.
 *
 * Why a flag rather than looking at the session cookie, which is what the
 * question really is: Better Auth's session cookie is httpOnly, so page
 * script cannot see it, and a request to find out would be a request for
 * every anonymous visitor on every marketing page. The flag is written by the
 * /app shell (a signed-in session, not a support session) and by the
 * marketing header when its own session lookup says signed in; removed by
 * signOut() in lib/auth-client.js, by that header seeing nobody signed in,
 * and by the endpoint saying "not signed in" — so a stale one costs at most a
 * single request, once. It carries no language: the account answers that,
 * fresh, every page load.
 */
export const SIGNED_IN_KEY = "fieldquo-signed-in";

let legacyForgotten = false;

/** Remove the old permanent key. Once per page; best-effort. */
export function forgetLegacyLanguage() {
  if (legacyForgotten || typeof window === "undefined") return;
  legacyForgotten = true;
  try {
    window.localStorage.removeItem(LEGACY_LANGUAGE_KEY);
  } catch {
    // Storage blocked: then nothing could have been read from it either.
  }
}

let sessionLoaded = false;

/** This tab's switch, loaded into the page-wide store on first ask. */
export function loadSessionLanguage() {
  if (sessionLoaded || typeof window === "undefined") return;
  sessionLoaded = true;
  try {
    const code = window.sessionStorage.getItem(SESSION_LANGUAGE_KEY);
    if (isSupported(code)) noteSessionLanguage(code);
  } catch {
    // Blocked storage: no switch survives a reload, the switch still works.
  }
}

/** An explicit choice for this tab. Null clears it. */
export function saveSessionLanguage(code) {
  const value = isSupported(code) ? String(code).toLowerCase() : null;
  noteSessionLanguage(value);
  if (typeof window === "undefined") return;
  try {
    if (value) window.sessionStorage.setItem(SESSION_LANGUAGE_KEY, value);
    else window.sessionStorage.removeItem(SESSION_LANGUAGE_KEY);
  } catch {
    // Same reasoning as loadSessionLanguage.
  }
}

// The one in-flight (or finished) account request for this page.
let accountRequest = null;

function hasSignedInFlag() {
  try {
    return window.localStorage.getItem(SIGNED_IN_KEY) === "1";
  } catch {
    return false;
  }
}

/** The /app shell: this browser holds a signed-in session. */
export function rememberSignedIn() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIGNED_IN_KEY, "1");
  } catch {
    // No flag: public pages fall back to the device, which is today's answer.
  }
}

/** Signed out (or told so by the endpoint): forget the flag and the account. */
export function forgetSignedIn() {
  noteAccountLanguage(null);
  accountRequest = null;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    // Nothing to clear.
  }
}

/**
 * Ask the server for the signed-in account's language — at most once per page,
 * and only when this browser has signed in. Anonymous visitors never make the
 * request. A failed request leaves the flag alone (a blip must not sign
 * anybody's language out) and the page on the rungs below.
 */
export function learnAccountLanguage() {
  if (accountRequest || typeof window === "undefined") return;
  if (!hasSignedInFlag()) return;
  accountRequest = fetch("/api/me/language", { credentials: "same-origin", cache: "no-store" })
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => {
      if (!body) return;
      if (body.signedIn === false) {
        forgetSignedIn();
        return;
      }
      if (isSupported(body.language)) noteAccountLanguage(body.language);
    })
    .catch(() => {
      // Offline or a deploy in flight: the device language stands in.
    });
}

/**
 * A component that already knows whether a Better Auth session exists (the
 * marketing header asks for every visitor, to draw "Log in" or the avatar)
 * reports it here. That covers a browser that is signed in but has not opened
 * /app since this shipped — the owner's, on the day it deploys — without a
 * request of our own for anybody anonymous.
 */
export function noteSessionPresence(signedIn) {
  if (typeof window === "undefined") return;
  if (signedIn) {
    rememberSignedIn();
    learnAccountLanguage();
  } else if (hasSignedInFlag()) {
    forgetSignedIn();
  }
}
