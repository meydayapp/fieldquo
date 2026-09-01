// lib/meta/tokenCrypto.js
//
// AES-256-GCM at rest for the one genuinely sensitive thing this integration
// stores: a contractor's Meta ad-account access token. A leaked FieldQuo
// database backup must not hand out a working Meta credential for every
// connected company — this is the only thing standing between the two.
//
// ── Why a dedicated key rather than reusing BETTER_AUTH_SECRET ─────────────
//
// Better Auth's own secret signs sessions; it was never scoped or rotated
// with "also encrypts a third-party API credential" in mind, and mixing the
// two means a session-secret rotation (a routine security response to a
// leaked cookie) would silently corrupt every stored Meta token with no
// error until the next sync tried to decrypt one. A dedicated
// META_TOKEN_ENCRYPTION_KEY can be rotated independently, and its absence is
// exactly the signal metaConfigured() (lib/meta/client.js) needs to refuse
// to render a working "Connect" button when nobody has provisioned it.
//
// ── Format ───────────────────────────────────────────────────────────────
//
// base64( 12-byte IV | 16-byte GCM auth tag | ciphertext ). One blob, one
// column (MetaAdConnection.accessTokenEnc) — no second column to keep in
// sync with the first.
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

/**
 * The raw 32-byte key, decoded from whichever encoding the env var was set
 * in. Accepts hex (64 chars) or base64 (44 chars, padding optional) so
 * whichever `openssl rand -hex 32` / `openssl rand -base64 32` the owner
 * reaches for first just works. Returns null — never throws — when unset or
 * the wrong length, so every caller can ask "do I have a real key" before
 * trying to use one.
 */
function loadKey() {
  const raw = process.env.META_TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  const trimmed = raw.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, "hex");
  }
  try {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 32) return buf;
  } catch {
    /* falls through to null below */
  }
  return null;
}

/** Is a real 32-byte key actually configured? Never throws. */
export function tokenCryptoConfigured() {
  return loadKey() !== null;
}

/**
 * Plaintext token -> the base64 blob stored in accessTokenEnc.
 * Throws if META_TOKEN_ENCRYPTION_KEY is missing or malformed — callers must
 * check tokenCryptoConfigured() (or metaConfigured()) before reaching this,
 * the same "check before you call" shape lazyClient.js's SDK wrappers use.
 */
export function encryptToken(plaintext) {
  const key = loadKey();
  if (!key) {
    throw new Error(
      "META_TOKEN_ENCRYPTION_KEY is not set (or is not a 32-byte hex/base64 value) — cannot encrypt a Meta token.",
    );
  }
  if (typeof plaintext !== "string" || !plaintext) {
    throw new Error("encryptToken: plaintext must be a non-empty string.");
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

/**
 * The base64 blob -> plaintext token, or throws.
 *
 * Two distinct failure shapes, both surfaced rather than swallowed:
 *   - malformed input (too short to contain iv+tag) -> thrown before crypto
 *     ever runs, so a truncated/corrupted row fails loud, not as "wrong key".
 *   - authentication failure (wrong key, or the ciphertext was tampered
 *     with) -> node:crypto's own throw from final(), unchanged. A caller
 *     that catches this should treat the stored token as unusable — NOT as
 *     "expired", a different failure Meta itself reports (see
 *     lib/meta/client.js's error classification).
 */
export function decryptToken(blob) {
  const key = loadKey();
  if (!key) {
    throw new Error(
      "META_TOKEN_ENCRYPTION_KEY is not set (or is not a 32-byte hex/base64 value) — cannot decrypt a Meta token.",
    );
  }
  if (typeof blob !== "string" || !blob) {
    throw new Error("decryptToken: blob must be a non-empty string.");
  }
  let buf;
  try {
    buf = Buffer.from(blob, "base64");
  } catch {
    throw new Error("decryptToken: not valid base64.");
  }
  if (buf.length <= IV_LEN + TAG_LEN) {
    throw new Error("decryptToken: blob too short to contain an iv and auth tag — corrupted row.");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
