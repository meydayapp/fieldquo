// lib/agency/keys.js
//
// The marketing-agency key: what it looks like, how it is stored, what it may
// do. Pure (node:crypto only) so scripts/check-agency-api.mjs executes every
// branch without a database.
//
// ══ Why a key, and why per company ═════════════════════════════════════════
//
// The owner (2026-10-05): a company that works with a marketing agency gives
// that agency its marketing results, so the agency can optimise the ads
// against what actually closed. The agency connects through Zapier — ONE
// FieldQuo app on Zapier's side — so the identity that decides the tenant has
// to be something the company hands over itself, and can take back. A key the
// owner creates in Settings › Marketing agency access is exactly that, and
// the tenant is read off the key alone: no request parameter, header or body
// field can name a company (lib/agency/apiAuth.js).
//
// ══ Shown once, hashed at rest ═════════════════════════════════════════════
//
// The secret is 32 random bytes. Only its sha256 is stored (AgencyAccessKey.
// keyHash, unique), plus the last four characters so the list can tell two
// keys apart. A database read — a backup, a support session, a leaked query —
// yields nothing that authenticates. sha256 rather than a slow KDF on
// purpose: a 256-bit random secret cannot be brute-forced, and the lookup
// must be one indexed equality on every API call.
//
// ══ Scopes ═════════════════════════════════════════════════════════════════
//
//   marketing:read         every key. Metrics, funnel, lead rows, hooks.
//   marketing:write_leads  OPT-IN, ticked separately by the owner: create a
//                          lead from the agency's own funnel, move a lead
//                          along the pipeline's own allowed transitions, and
//                          set a lead's requested visit window. Nothing else.
//
// There is deliberately no scope that sends a text, an email or any message
// to a client: an outside party must never be able to message the company's
// customers (coordinator, 2026-10-05). Adding one is a product decision, not
// a scope string.

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const KEY_PREFIX = "fqa_";
export const SCOPE_READ = "marketing:read";
export const SCOPE_WRITE_LEADS = "marketing:write_leads";
export const SCOPES = Object.freeze([SCOPE_READ, SCOPE_WRITE_LEADS]);

/** How many live (unrevoked) keys one company may hold — several agencies, not a leak. */
export const MAX_LIVE_KEYS = 10;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const SECRET_BODY = /^[A-Za-z0-9]{40,64}$/;

/** base-57 text from bytes (rejection-free modulo is fine: 256 % 57 bias is irrelevant for a 43-char secret). */
function encode(bytes) {
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** A new secret: "fqa_" + 43 characters (~250 bits). Shown to the owner once. */
export function generateAgencySecret(random = randomBytes) {
  return KEY_PREFIX + encode(random(43));
}

/** What is stored: sha256 hex of the whole secret. */
export function hashAgencySecret(secret) {
  return createHash("sha256").update(String(secret), "utf8").digest("hex");
}

/** The last four characters — the list's way of telling keys apart. */
export function keyHintOf(secret) {
  return String(secret || "").slice(-4);
}

/** Does this string have the shape of an agency key? Shape only — not validity. */
export function looksLikeAgencySecret(value) {
  if (typeof value !== "string" || !value.startsWith(KEY_PREFIX)) return false;
  return SECRET_BODY.test(value.slice(KEY_PREFIX.length));
}

/**
 * The secret from an Authorization header ("Bearer fqa_…"), or null. Zapier's
 * API-key auth can also send it as `X-Api-Key`; both are read, the bearer
 * first. Never a query parameter — a key in a URL lands in every proxy log.
 */
export function secretFromHeaders(headers) {
  const get = (k) => (typeof headers?.get === "function" ? headers.get(k) : headers?.[k]) || "";
  const auth = String(get("authorization")).trim();
  const m = auth.match(/^Bearer\s+(\S+)$/i);
  const candidate = m ? m[1] : String(get("x-api-key")).trim();
  return looksLikeAgencySecret(candidate) ? candidate : null;
}

/** Constant-time comparison of two hex digests of equal length. */
export function sameHash(a, b) {
  const x = Buffer.from(String(a || ""), "utf8");
  const y = Buffer.from(String(b || ""), "utf8");
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/**
 * The scopes a new key gets: read always, write only when asked for in so
 * many words. Unknown strings are dropped, never stored.
 */
export function cleanScopes({ writeLeads = false } = {}) {
  return writeLeads === true ? [SCOPE_READ, SCOPE_WRITE_LEADS] : [SCOPE_READ];
}

/** Does this key hold `scope`? A revoked key holds nothing. */
export function keyHasScope(key, scope) {
  if (!key || key.revokedAt) return false;
  return Array.isArray(key.scopes) && key.scopes.includes(scope);
}

/** The agency's name as typed, made safe to store and render; null if empty. */
export function cleanKeyName(value) {
  if (typeof value !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = value.normalize("NFC").replace(/[\u0000-\u001f\u007f<>]/g, "").replace(/\s+/g, " ").trim();
  return s ? s.slice(0, 80) : null;
}

/** Who may create, revoke and change sharing: the owner and admins. */
export function canManageAgencyAccess(member) {
  if (!member) return false;
  // A support session is read-only by non-negotiable #2; refused here as well
  // as by getCurrentMember's own write gate, deliberately twice.
  if (member.impersonation) return false;
  return member.role === "owner" || member.role === "admin";
}

/** A key as the settings list shows it — never the hash. */
export function publicKey(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    hint: row.keyHint,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    createdAt: row.createdAt,
    createdByName: row.createdByName || null,
    lastUsedAt: row.lastUsedAt || null,
    revokedAt: row.revokedAt || null,
    revokedByName: row.revokedByName || null,
  };
}
