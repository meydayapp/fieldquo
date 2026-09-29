// lib/tiktok/config.js
//
// Every environment read the TikTok integration makes, in one file — so
// "is TikTok posting switched on for this deployment" has exactly one answer,
// and the settings card, the connect route, the designer and the cron all ask
// the same function rather than four copies of the same three env names.
//
// ── Switched on by configuration, never by a flag ──────────────────────────
//
// TikTok posting is available when, and only when, this deployment has the
// app's credentials (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET) AND a key to
// encrypt the tokens it would store (META_TOKEN_ENCRYPTION_KEY — the same key,
// through the same helper, that Meta tokens use: lib/meta/tokenCrypto.js).
// Missing any one of them, the settings card says "TikTok posting — coming
// soon" and draws no button, and every route refuses the same way. There is
// no TIKTOK_ENABLED switch to set wrong: a flag that could say "on" while the
// credentials are absent is the dead control AGENTS.md is written against.
//
// ── The fixed URLs ─────────────────────────────────────────────────────────
//
// TikTok matches the redirect URI EXACTLY against the one registered in its
// developer portal (https, static, no query, no fragment —
// developers.tiktok.com/doc/login-kit-web), and PULL_FROM_URL only fetches
// from a verified URL prefix (developers.tiktok.com/doc/
// content-posting-api-media-transfer-guide). Both are built from the app's
// origin (lib/appUrl.js — NEXT_PUBLIC_APP_URL, https://www.fieldquo.com in
// production) plus the paths below, which are what the portal registration
// names:
//
//   redirect  https://www.fieldquo.com/api/tiktok/callback
//   media     https://www.fieldquo.com/api/tiktok/media/
//   webhook   https://www.fieldquo.com/api/tiktok/webhook
import { tokenCryptoConfigured } from "@/lib/meta/tokenCrypto";

export const TIKTOK_CALLBACK_PATH = "/api/tiktok/callback";
export const TIKTOK_MEDIA_PATH = "/api/tiktok/media/";
export const TIKTOK_WEBHOOK_PATH = "/api/tiktok/webhook";

// Login Kit for Web, OAuth v2. No PKCE: the web flow's documented parameters
// are client_key, scope, redirect_uri, state and response_type — code_verifier
// is "required for mobile and desktop app only"
// (developers.tiktok.com/doc/oauth-user-access-token-management).
export const TIKTOK_AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
export const TIKTOK_API_BASE = "https://open.tiktokapis.com";

// user.info.basic for the nickname/avatar the settings card shows;
// video.publish for Direct Post (photo posts use the same scope —
// developers.tiktok.com/doc/content-posting-api-reference-photo-post).
// video.upload for "Send to TikTok as a draft" (post_mode MEDIA_UPLOAD: TikTok
// puts the photo in the creator's inbox and they finish it in TikTok's own
// editor). It was first left out as unused; the owner's portal app carries it
// and an audit refuses a scope nothing exercises, so the composer now has the
// draft action that uses it — every scope asked for here is one a person can
// be shown working.
export const TIKTOK_SCOPES = ["user.info.basic", "video.publish", "video.upload"];

export function tiktokClientKey() {
  return (process.env.TIKTOK_CLIENT_KEY || "").trim() || null;
}

export function tiktokClientSecret() {
  return (process.env.TIKTOK_CLIENT_SECRET || "").trim() || null;
}

/**
 * What is missing for TikTok posting to work on this deployment — empty when
 * nothing is. Names, never values. The settings card uses the list to say
 * WHY it is not available (to FieldQuo staff reading it), and the empty list
 * is the one definition of "configured".
 */
export function tiktokMissingConfig() {
  const missing = [];
  if (!tiktokClientKey()) missing.push("TIKTOK_CLIENT_KEY");
  if (!tiktokClientSecret()) missing.push("TIKTOK_CLIENT_SECRET");
  // Present AND a real 32-byte key — a malformed value would let a connect
  // run to the end and then fail to store the token it just obtained.
  if (!tokenCryptoConfigured()) missing.push("META_TOKEN_ENCRYPTION_KEY");
  return missing;
}

export function tiktokConfigured() {
  return tiktokMissingConfig().length === 0;
}

/**
 * Has TikTok audited FieldQuo's Content Posting API client?
 *
 * Nothing FieldQuo can call reports this, so it is stated by the owner the day
 * the audit passes. Until then "All content posted by unaudited clients will be
 * restricted to private viewing mode"
 * (developers.tiktok.com/doc/content-posting-api-get-started), a post to any
 * other privacy level is refused with
 * `unaudited_client_can_only_post_to_private_accounts`, and at most five
 * creators a day can post. Default: unaudited — the safe direction, because
 * the wrong answer the other way offers a "Public" option TikTok will refuse.
 */
export function tiktokAudited() {
  return String(process.env.TIKTOK_AUDITED || "").trim() === "1";
}

/**
 * The URL-prefix verification file TikTok's portal hands out. It must be served
 * byte-for-byte AT the media prefix — https://www.fieldquo.com/api/tiktok/media/
 * <filename> — as text/plain with a 200 and no redirect. The owner pastes the
 * name and the content from the portal; both unset means the route 404s, which
 * is the honest answer before there is a file to serve.
 */
export function tiktokVerificationFile() {
  const filename = String(process.env.TIKTOK_VERIFICATION_FILENAME || "").trim();
  const content = process.env.TIKTOK_VERIFICATION_CONTENT;
  if (!filename || typeof content !== "string" || !content.length) return null;
  // A path segment only: a name with a slash in it could never be the last
  // segment of /api/tiktok/media/<name>, so it can never be what TikTok asks
  // for, and refusing it keeps this from reading as a path.
  if (/[/\\]/.test(filename)) return null;
  return { filename, content };
}

/**
 * The OAuth nonce cookie, set by /api/tiktok/connect and read-then-deleted by
 * /api/tiktok/callback. Its own name, not a reuse of a Meta one, for the reason
 * lib/meta/oauthCookies.js gives: two connect flows can be in the air at once,
 * and a shared name lets the second overwrite the first. Same options
 * (baseCookieOptions — httpOnly, secure, lax, ten minutes).
 */
export const TIKTOK_STATE_COOKIE = "tiktok_oauth_state";

