// lib/i18n/statedLanguage.js
//
// Which language the SHELL renders in — FieldQuo's own voice, speaking to a
// FieldQuo user or visitor — and why one page can hold more than one answer
// to that question.
//
// ── The precedence, highest first ──────────────────────────────────────────
//
//   1. The ACCOUNT. A signed-in person's saved preference (Settings ›
//      Language, or a rep's SalesRep.language), handed to a provider with
//      `fromAccount`, or announced page-wide by one (`stated`).
//   2. A SESSION switch. The marketing header's switcher, the sales invite
//      picker, the rep's picker: an explicit choice that lasts for this tab's
//      browsing session only (sessionStorage). It never changes the account —
//      Settings does that — and it never outlives the tab, so it cannot haunt
//      a link clicked days later.
//   3. The account, LEARNED on a public page. /login, /signup, the marketing
//      site and the help centre have no account prop; when this browser has a
//      signed-in session they ask for it once (GET /api/me/language). Below a
//      session switch on purpose: a signed-in person who presses "DE" in the
//      header on the marketing site gets German for that tab, as anybody would
//      — the switcher is not allowed to be a dead control for them.
//   4. A PAGE override. A booking page in the booker's language, a signup or
//      login form prefilled from a link that carried a language. That render
//      only: never stored anywhere, dropped when the page changes.
//   5. The DEVICE. navigator.languages, first supported match.
//   6. The server's default (English).
//
// A page that speaks for a CONTRACTOR — /book, /quote, /q, /portal, /site,
// /embed, /f, /instant-quote and the rest of COMPANY_VOICE_PREFIXES — skips 2
// and 3 entirely. Those pages decide their own language from the document,
// company and client (lib/i18n/clientLanguage.js, lib/i18n/bookingLanguages.js)
// and a contractor previewing their own Spanish booking page must see what the
// homeowner sees, not their own FieldQuo preference.
//
// ── What this replaced (2026-09-25) ────────────────────────────────────────
//
// Rung 2 used to be localStorage["fieldquo-language"]: PERMANENT, shared by the
// whole origin, and written by anything that called changeLanguage() — which
// included a contractor's client booking page, the signup/login prefill, and
// the email-link landings. The owner opened a Spanish booking page to test it
// and fieldquo.com was Spanish on every link he clicked afterwards, days later,
// with nothing on screen to say why. The key is now removed on load
// (lib/i18n/languageStorage.js forgetLegacyLanguage), so every browser that
// carries a stale one returns to its device language or account at once.
//
// ── The bug the announcement channel exists to stop ────────────────────────
//
// /app nests two LanguageProviders. The root one (app/layout.js) is mounted
// with no props. The inner one (app/app/layout.js) is handed the signed-in
// user's saved preference with `fromAccount`.
//
// That works for everything rendered INSIDE the inner provider. It does not
// work for anything rendered beside it — and the app shell renders four such
// things after the closing tag: AppTours, ErrorToast, PlanRequiredPrompt and
// JenniferPanel. Those read the ROOT provider, which was following
// localStorage. The owner's account is Spanish; his browser had
// "fieldquo-language" = "uk" from fieldquo.com; every /app screen rendered
// Spanish and every first-visit TOUR rendered Ukrainian. The same incident is
// on record in app/sales/layout.js, where the portal came up in German.
//
// A stated account preference is a fact about the PERSON, so it holds for the
// whole page: once any provider on the page has been told one, every other
// provider defers to it — above a session switch, so a tab that visited the
// marketing site in German cannot put German tours inside a Spanish /app.
//
// ── Why module-level stores rather than a context ──────────────────────────
//
// A context can only be read by descendants, and descendants are exactly the
// thing that already worked. The surfaces that broke are cousins of the
// provider that knows the answer, and nothing in the React tree connects them.
// The same holds for the session switch (the header's switcher sits under
// whichever provider is nearest) and for the learned account (one request per
// page, however many providers ask).
//
// Mutated only from effects and event handlers, never during render, so every
// value is null on the server and no state crosses a request boundary. This
// file does no I/O; the storage and the request live in languageStorage.js.

import { DEFAULT_LANGUAGE, isSupported } from "@/app/i18n/languages";

/**
 * Paths whose words belong to a CONTRACTOR, not to FieldQuo. The shell skips
 * the viewer's FieldQuo preferences on these (rungs 2 and 3 above).
 *
 * Its own list rather than lib/analytics/product/routes.js's CLIENT_PREFIXES,
 * because the two questions differ at the edges: /accept-invitation is a
 * "client" page for analytics (a stranger arriving from a link), but it is
 * FieldQuo speaking to somebody joining a company, and a signed-in person
 * there should read their own language. The owner's list is the first line;
 * the rest are the other homeowner-facing trees under app/.
 */
export const COMPANY_VOICE_PREFIXES = Object.freeze([
  "/book", "/quote", "/q", "/portal", "/site", "/embed", "/f", "/instant-quote",
  "/w", "/design", "/visit", "/l", "/c", "/estimate-report", "/survey", "/plan",
  "/refer", "/no-contact", "/unsubscribe",
]);

/** The path speaks for a contractor (see COMPANY_VOICE_PREFIXES). */
export function speaksForCompany(pathname) {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  return COMPANY_VOICE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

// Browsers report Tagalog as Filipino ("fil", "fil-PH") far more often than as
// "tl". Mapping the one alias is what makes rung 5 reach a supported language
// for those phones instead of falling through to English.
const DEVICE_ALIASES = Object.freeze({ fil: "tl" });

/**
 * The device's language: the first tag in `languages` (navigator.languages,
 * or a single navigator.language) whose base is supported. "fr-CA" → fr,
 * "es-419" → es, "pa-IN" → pa. Null when none is — "zh-Hant", "ja" — so the
 * caller can tell "the device said English" from "the device said nothing we
 * speak".
 */
export function deviceLanguage(languages) {
  const list = Array.isArray(languages) ? languages : [languages];
  for (const tag of list) {
    if (typeof tag !== "string") continue;
    const base = tag.trim().toLowerCase().split(/[-_]/)[0];
    const code = DEVICE_ALIASES[base] || base;
    if (isSupported(code)) return code;
  }
  return null;
}

/**
 * The single decision every LanguageProvider makes, as a pure function so it
 * can be executed against the inputs that produced the bugs — see
 * scripts/check-language-precedence.mjs and scripts/check-tour-language.mjs.
 * Every argument is a SIGNAL; the order below is the precedence in the header.
 *
 * @param initialLanguage  what the server rendered with
 * @param fromAccount      initialLanguage is a signed-in user's saved choice
 * @param stated           a choice announced by another provider on this page
 * @param session          this tab's explicit switch (sessionStorage)
 * @param account          the signed-in account's language, learned on a
 *                         public page (GET /api/me/language)
 * @param page             a this-render-only override (booking page, prefill)
 * @param browser          navigator.languages (or one navigator.language)
 * @param companyVoice     the page speaks for a contractor (speaksForCompany)
 *
 * There is deliberately no `stored` argument any more. A caller still passing
 * the old localStorage value has it ignored, which is the fix.
 */
export function resolveShellLanguage({
  initialLanguage = null,
  fromAccount = false,
  stated = null,
  session = null,
  account = null,
  page = null,
  browser = null,
  companyVoice = false,
} = {}) {
  // A stated choice ends the question. Falling through to a browser signal
  // here is what took French away from a user who had picked it in Settings.
  if (fromAccount) {
    return isSupported(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE;
  }

  // Somebody else on this page was told the account's choice. Deferring to it
  // is the whole point of the announcement channel.
  if (isSupported(stated)) return stated;

  // The viewer's FieldQuo preferences have no say over a contractor's page.
  if (!companyVoice) {
    if (isSupported(session)) return session;
    if (isSupported(account)) return account;
  }

  if (isSupported(page)) return page;

  // The device. Only when it names something we speak: an unrecognised tag
  // must not overwrite a server-rendered language with an invented English.
  const fromDevice = deviceLanguage(browser);
  if (fromDevice) return fromDevice;

  return isSupported(initialLanguage) ? initialLanguage : DEFAULT_LANGUAGE;
}

// ── Page-wide stores ───────────────────────────────────────────────────────

function store() {
  let value = null;
  const listeners = new Set();
  return {
    get: () => value,
    set(next) {
      const v = isSupported(next) ? String(next).toLowerCase() : null;
      if (v === value) return;
      value = v;
      for (const fn of [...listeners]) fn(value);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    reset() {
      value = null;
      listeners.clear();
    },
  };
}

// ── The announcement channel (rung 1, across cousins) ──────────────────────

const statedStore = store();
let owner = null;

/** The account choice announced on this page, or null. */
export function statedLanguage() {
  return statedStore.get();
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
  statedStore.set(code);
}

/**
 * Withdraw it. A navigation out of /app falls back to the rungs below — which
 * for a signed-in person still includes their account (rung 3), because the
 * /app provider also recorded it with noteAccountLanguage.
 */
export function retractStatedLanguage(ownerKey) {
  if (owner !== ownerKey) return;
  owner = null;
  statedStore.set(null);
}

/** @returns an unsubscribe function. */
export function subscribeStatedLanguage(fn) {
  return statedStore.subscribe(fn);
}

// ── The session switch (rung 2) ────────────────────────────────────────────
// In memory here; languageStorage.js mirrors it into sessionStorage so a
// reload in the same tab keeps it.

const sessionStore = store();

export function sessionLanguage() {
  return sessionStore.get();
}
export function noteSessionLanguage(code) {
  sessionStore.set(code);
}
export function subscribeSessionLanguage(fn) {
  return sessionStore.subscribe(fn);
}

// ── The learned account (rung 3) ───────────────────────────────────────────

const accountStore = store();

export function accountLanguage() {
  return accountStore.get();
}
/** Record the signed-in account's language for this page; null forgets it. */
export function noteAccountLanguage(code) {
  accountStore.set(code);
}
export function subscribeAccountLanguage(fn) {
  return accountStore.subscribe(fn);
}

// Test seam. Exported rather than reached into, so the check scripts reset the
// same way a fresh page load does.
export function __resetStatedLanguage() {
  statedStore.reset();
  sessionStore.reset();
  accountStore.reset();
  owner = null;
}
