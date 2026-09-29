// lib/tiktok/signing.js
//
// The three things the TikTok integration has to be able to tell apart from a
// forgery, each a pure function with the key passed in so
// scripts/check-tiktok.mjs can drive it with tampered, expired and
// other-tenant input without an environment:
//
//   1. The OAuth `state` — proves a callback belongs to the member AND company
//      that started it (not only "somebody's browser started one").
//   2. The media URL token — the unguessable, short-lived name TikTok pulls a
//      rendered design from. It is the only thing standing between a stranger
//      and a company's unpublished artwork, because the media route has no
//      session to check (TikTok's servers fetch it, not a signed-in person).
//   3. TikTok's webhook signature — HMAC-SHA256 with the client secret.
//
// ── Why the first two are keyed off META_TOKEN_ENCRYPTION_KEY ──────────────
//
// They need a secret only this server holds. TIKTOK_CLIENT_SECRET is shared
// with TikTok, so a media URL keyed on it could be minted by the one party the
// URL is handed to. The token-encryption key is server-only, is already
// required for this feature (tiktokConfigured()), and is never used raw here:
// each purpose gets its own subkey, HMAC(key, label), so a state value can
// never verify as a media token or the other way round.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { parseAesKey } from "@/lib/meta/tokenCrypto";

const STATE_LABEL = "fieldquo:tiktok:oauth-state:v1";
const MEDIA_LABEL = "fieldquo:tiktok:media-url:v1";

/** A media URL lives this long — TikTok's pull "times out one hour after the
 * download task is initiated" (content-posting-api-media-transfer-guide), and
 * the init call is made within seconds of minting, so an hour covers it. */
export const MEDIA_TOKEN_TTL_SECONDS = 60 * 60;
/** Same ten minutes the Meta OAuth cookies live (lib/meta/oauthCookies.js). */
export const OAUTH_STATE_TTL_SECONDS = 600;
/** How old a webhook timestamp may be. TikTok says to decide a tolerance
 * (developers.tiktok.com/doc/webhooks-verification); five minutes is the
 * usual replay window and far longer than a real delivery takes. */
export const WEBHOOK_TOLERANCE_SECONDS = 300;

function b64url(buf) {
  return Buffer.from(buf).toString("base64url");
}

function subkey(rootKey, label) {
  return createHmac("sha256", rootKey).update(label).digest();
}

function sign(key, payload) {
  return b64url(createHmac("sha256", key).update(payload).digest());
}

/** Constant-time compare of two strings; false on any length mismatch. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a ?? ""), "utf8");
  const bb = Buffer.from(String(b ?? ""), "utf8");
  if (ab.length === 0 || ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

function parseSigned(token) {
  if (typeof token !== "string" || token.length > 2048) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  return { encoded: parts[0], sig: parts[1], payload };
}

/** The server's root key, or null when META_TOKEN_ENCRYPTION_KEY is unset. */
export function signingRootKey() {
  return parseAesKey(process.env.META_TOKEN_ENCRYPTION_KEY);
}

// ══ 1. OAuth state ═════════════════════════════════════════════════════════

/**
 * A state value bound to one member of one company, plus the random nonce the
 * connect route also puts in an httpOnly cookie. The callback needs all three
 * to agree: the signature (we minted it), the nonce (this browser started it)
 * and the member/company (the person finishing it is the person who began it,
 * still in the same company).
 */
export function makeOAuthState({ rootKey, companyId, userId, nonce, nowSeconds }) {
  if (!rootKey || !companyId || !userId || !nonce) throw new Error("makeOAuthState: missing input");
  const payload = {
    c: String(companyId),
    u: String(userId),
    n: String(nonce),
    e: Math.floor(nowSeconds) + OAUTH_STATE_TTL_SECONDS,
  };
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(subkey(rootKey, STATE_LABEL), encoded)}`;
}

export function newOAuthNonce() {
  return randomBytes(18).toString("base64url");
}

/**
 * @returns {{ok: true} | {ok: false, reason: "malformed"|"bad_signature"|"expired"|"nonce_mismatch"|"other_member"}}
 */
export function verifyOAuthState(state, { rootKey, cookieNonce, companyId, userId, nowSeconds }) {
  if (!rootKey) return { ok: false, reason: "bad_signature" };
  const parsed = parseSigned(state);
  if (!parsed) return { ok: false, reason: "malformed" };
  if (!safeEqual(parsed.sig, sign(subkey(rootKey, STATE_LABEL), parsed.encoded))) {
    return { ok: false, reason: "bad_signature" };
  }
  const { c, u, n, e } = parsed.payload;
  if (!Number.isFinite(e) || e < Math.floor(nowSeconds)) return { ok: false, reason: "expired" };
  if (!cookieNonce || !safeEqual(n, cookieNonce)) return { ok: false, reason: "nonce_mismatch" };
  if (c !== companyId || u !== userId) return { ok: false, reason: "other_member" };
  return { ok: true };
}

// ══ 2. Media URL token ═════════════════════════════════════════════════════

/**
 * The path segment TikTok pulls one publish's image from. Names a TikTokPublish
 * row and its company; the media route re-reads the row and requires both to
 * match, so a token for company A can never be pointed at company B's row even
 * by someone holding a valid one.
 */
export function makeMediaToken({ rootKey, publishId, companyId, nowSeconds, ttlSeconds = MEDIA_TOKEN_TTL_SECONDS, index }) {
  if (!rootKey || !publishId || !companyId) throw new Error("makeMediaToken: missing input");
  const payload = { p: String(publishId), c: String(companyId), e: Math.floor(nowSeconds) + ttlSeconds };
  // Which image of a multi-photo post (TikTokPublish.imageUrls[i]). Absent for
  // a single photo, so that token is exactly the shape it always was — and it
  // is inside the signed payload, so a holder of slide 1's URL cannot turn it
  // into slide 2's.
  if (Number.isInteger(index) && index >= 0) payload.i = index;
  const encoded = b64url(JSON.stringify(payload));
  return `${encoded}.${sign(subkey(rootKey, MEDIA_LABEL), encoded)}`;
}

/**
 * Accepts the token with or without the ".jpg" the URL carries (see
 * mediaUrlFor below).
 * @returns {{ok: true, publishId: string, companyId: string} | {ok: false, reason: string}}
 */
export function verifyMediaToken(token, { rootKey, nowSeconds }) {
  if (!rootKey) return { ok: false, reason: "bad_signature" };
  const raw = typeof token === "string" ? token.replace(/\.jpg$/i, "") : token;
  const parsed = parseSigned(raw);
  if (!parsed) return { ok: false, reason: "malformed" };
  if (!safeEqual(parsed.sig, sign(subkey(rootKey, MEDIA_LABEL), parsed.encoded))) {
    return { ok: false, reason: "bad_signature" };
  }
  const { p, c, e, i } = parsed.payload;
  if (typeof p !== "string" || typeof c !== "string" || !p || !c) return { ok: false, reason: "malformed" };
  if (!Number.isFinite(e) || e < Math.floor(nowSeconds)) return { ok: false, reason: "expired" };
  if (i !== undefined && (!Number.isInteger(i) || i < 0)) return { ok: false, reason: "malformed" };
  return { ok: true, publishId: p, companyId: c, ...(i !== undefined ? { index: i } : {}) };
}

/**
 * The absolute URL handed to TikTok. ".jpg" on the end because the file IS a
 * JPEG and some fetchers sniff the extension; the route strips it again.
 */
export function mediaUrlFor(origin, token) {
  return `${String(origin).replace(/\/+$/, "")}/api/tiktok/media/${token}.jpg`;
}

// ══ 3. TikTok's webhook signature ══════════════════════════════════════════

/**
 * `TikTok-Signature: t=<unix seconds>,s=<hex HMAC-SHA256>`, where the HMAC key
 * is the app's client secret and the message is `${t}.${rawBody}`
 * (developers.tiktok.com/doc/webhooks-verification). Verified over the RAW
 * body — a re-serialised JSON object is not the bytes TikTok signed.
 *
 * @returns {{ok: true, timestamp: number} | {ok: false, reason: "no_secret"|"malformed"|"bad_signature"|"stale"}}
 */
export function verifyWebhookSignature({ header, rawBody, secret, nowSeconds, toleranceSeconds = WEBHOOK_TOLERANCE_SECONDS }) {
  if (!secret) return { ok: false, reason: "no_secret" };
  if (typeof header !== "string" || typeof rawBody !== "string") return { ok: false, reason: "malformed" };
  let t = null;
  let s = null;
  for (const part of header.split(",")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k === "t") t = v;
    else if (k === "s") s = v;
  }
  if (!t || !s || !/^\d{1,12}$/.test(t) || !/^[0-9a-f]{64}$/i.test(s)) return { ok: false, reason: "malformed" };
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  if (!safeEqual(s.toLowerCase(), expected)) return { ok: false, reason: "bad_signature" };
  const ts = Number(t);
  if (Math.abs(Math.floor(nowSeconds) - ts) > toleranceSeconds) return { ok: false, reason: "stale" };
  return { ok: true, timestamp: ts };
}
