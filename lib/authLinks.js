// lib/authLinks.js
//
// The links in the account emails (confirm your address, reset your password)
// and the two questions every page they land on has to answer first: which
// LANGUAGE to speak, and — for the confirmation link — WHOSE address this was.
//
// ══ Why the language travels with the link ═════════════════════════════════
//
// 2026-09-25: the owner signed up in English, got the confirmation email in
// English, clicked it — and /verify-email rendered in SPANISH. Clicked again,
// English. Nothing about the account was consulted: the page sits under the
// root LanguageProvider, which is handed no language and falls back to the
// browser's own signals (localStorage "fieldquo-language", then
// navigator.language — lib/i18n/statedLanguage.js resolveShellLanguage). Those
// are per-browser guesses shared with the marketing site, so the answer
// depended on what that browser had last been told, not on the person — and
// it can differ between two clicks, because anything that writes that key in
// between (the header's language switcher, /app/settings/language on load,
// a booking page) changes the next render, and an email app's in-app browser
// has a different store and a different navigator.language altogether.
//
// The email already knew the answer (lib/auth.js resolves it from the account
// to write the email). So the link now carries it, AND the landing page reads
// it back from the account server-side (lib/authLinkLanguage.js) — the
// account first, because a fresh phone with no cookies and no storage has
// only the link to go on, and the link's `lang` is the fallback for when the
// account cannot be read.
//
// ══ Why the confirmation link lands on the PAGE now, not the auth API ══════
//
// It used to point at Better Auth's /api/auth/verify-email, which verifies and
// then redirects to a bare /verify-email — no token, no address. The page then
// had nothing but the browser's session to go on, and the owner clicked his
// link while signed in as a DIFFERENT test account: the page could not say
// which address had just been confirmed, and offered "Continue" into the other
// account's company. Landing on the page with the token lets the page's own
// route (app/api/verify-email) confirm through Better Auth AND say whose
// address it was, and compare that with whoever is signed in.
//
// The reset link keeps pointing at the auth API first, on purpose — see the
// RESET_PAGE note in lib/auth.js — and gets only the language.
//
// Pure apart from readVerifyToken (a signature check, no I/O). Executed by
// scripts/check-auth-link-routing.mjs.

import { jwtVerify, decodeJwt } from "jose";
import { isSupported } from "@/app/i18n/languages";

export const VERIFY_PAGE = "/verify-email";
export const RESET_PAGE = "/reset-password";

/** A supported language code, lower-cased — or null. Never a guess. */
export function linkLanguage(raw) {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toLowerCase();
  return code && isSupported(code) ? code : null;
}

function httpUrl(url) {
  try {
    const parsed = new URL(url);
    // `new URL` parses javascript: and data: happily; appending a query string
    // to one of those is nonsense. authEmails.js refuses to send them either
    // way — this just declines to dress one up first.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Forces the landing page on a link Better Auth built, and puts the
 * recipient's language on it.
 *
 * Better Auth writes `callbackURL=` (empty) or `callbackURL=%2F` when the
 * caller passed no `redirectTo` — both mean "nobody chose", so both are
 * replaced here. A caller that DID choose is left alone, so a future flow can
 * still send someone back where they started.
 *
 * Better Auth resolves the callback with `new URL(callbackURL, baseURL)` and
 * adds its own `token` / `error` to it, so a `?lang=` already on the callback
 * survives the redirect (api/routes/password.mjs redirectCallback).
 *
 * Never throws: a link we could not parse is passed through untouched, and
 * authEmails.js refuses to send a mail whose button is dead.
 */
export function withLandingPage(url, page, language = null) {
  const parsed = httpUrl(url);
  if (!parsed) return url;
  const chosen = parsed.searchParams.get("callbackURL");
  if (!chosen || chosen === "/") {
    const lang = linkLanguage(language);
    parsed.searchParams.set("callbackURL", lang ? `${page}?lang=${lang}` : page);
  }
  return parsed.href;
}

/**
 * The confirmation link: straight to /verify-email with the token and the
 * language, on the same origin Better Auth built its own link on.
 *
 * Falls back to Better Auth's link (landing page forced) when there is no
 * token to carry — a link that works the old way beats a link that does not
 * work at all.
 */
export function verifyPageLink(url, language = null) {
  const parsed = httpUrl(url);
  if (!parsed) return url;
  const token = parsed.searchParams.get("token");
  if (!token) return withLandingPage(url, VERIFY_PAGE, language);
  const out = new URL(VERIFY_PAGE, parsed.origin);
  out.searchParams.set("token", token);
  const lang = linkLanguage(language);
  if (lang) out.searchParams.set("lang", lang);
  return out.href;
}

/**
 * Reads a Better Auth email-verification token without spending it.
 *
 * The same check Better Auth makes (api/routes/email-verification.mjs: HS256
 * over the auth secret), so a forged token is "invalid" here exactly as it is
 * there — which matters because the answer names an address and picks a
 * language, and neither may be steered by somebody who made the token up.
 *
 * jose verifies the SIGNATURE before the claims, so JWTExpired is only ever
 * thrown for a token we signed: the address in an expired one is still ours
 * and still worth prefilling into "send me a new one".
 *
 * @returns { state: "valid"|"expired"|"invalid"|"change_email", email }
 */
export async function readVerifyToken(token, secret) {
  if (typeof token !== "string" || !token || token.length > 4096 || !secret) {
    return { state: "invalid", email: null };
  }
  let payload;
  let state = "valid";
  try {
    ({ payload } = await jwtVerify(token, new TextEncoder().encode(secret), { algorithms: ["HS256"] }));
  } catch (err) {
    if (err?.code !== "ERR_JWT_EXPIRED") return { state: "invalid", email: null };
    state = "expired";
    try {
      payload = err.payload || decodeJwt(token);
    } catch {
      return { state: "invalid", email: null };
    }
  }
  const email = typeof payload?.email === "string" && payload.email.includes("@") ? payload.email : null;
  if (!email) return { state: "invalid", email: null };
  // A change-of-address token. FieldQuo has no change-email flow (lib/auth.js
  // does not enable user.changeEmail), and Better Auth's handling of one
  // CREATES A SESSION when there is none — not something the page's route may
  // trigger on an unauthenticated POST. Refused rather than half-supported.
  if (payload.updateTo) return { state: "change_email", email: null };
  return { state, email };
}

/**
 * Who is signed in, relative to the address the link was for.
 *
 *   "none"   nobody — the phone that opened the email
 *   "same"   the owner of the confirmed address
 *   "other"  somebody else: a second account on the same browser. The one
 *            state the page must never paper over.
 */
export function sessionRelation(user, session) {
  if (!session?.userId) return "none";
  if (!user?.id) return "other";
  return session.userId === user.id ? "same" : "other";
}

/**
 * What /verify-email says, from what the route found.
 *
 * @param tokenState   readVerifyToken's state
 * @param user         { id, email } for the token's address, or null
 * @param wasVerified  that user's emailVerified BEFORE this request
 * @param verifyFailed Better Auth refused the exchange (reported as invalid —
 *                     the token was ours, so this is a fault, not a forgery)
 * @param session      { userId, email } of the browser's session, or null
 *
 * @returns { state, email, account: { relation, email } }
 *   state    "done" | "already" | "expired" | "invalid"
 *   email    the address the link was for — only ever from a token we signed
 *   account  the session relative to it; `email` only when relation "other",
 *            and it is the browser's OWN session's address, so naming it
 *            tells the reader nothing they do not already have.
 */
export function verifyOutcome({ tokenState, user = null, wasVerified = false, verifyFailed = false, session = null } = {}) {
  const relation = sessionRelation(user, session);
  const account = { relation, email: relation === "other" ? session?.email || null : null };
  if (tokenState !== "valid" && tokenState !== "expired") return { state: "invalid", email: null, account };
  if (!user?.email) return { state: "invalid", email: null, account };
  // Already confirmed wins over expired: an address confirmed yesterday
  // through a link that has since run out is confirmed, and "this link has
  // expired, send another" would be a lie with a form attached.
  if (wasVerified) return { state: "already", email: user.email, account };
  if (tokenState === "expired") return { state: "expired", email: user.email, account };
  if (verifyFailed) return { state: "invalid", email: user.email, account };
  return { state: "done", email: user.email, account };
}
