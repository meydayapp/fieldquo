// lib/agency/apiAuth.js
//
// The front door of /api/v1/*: a Bearer agency key in, a company out — or a
// refusal in the standard shape (`{ error, code }` with a 401, 403, 404 or
// 429; never a 500 for a denial — scripts/check-refusal-shape.mjs's rule).
//
// ══ The key is the only thing that names the tenant ═══════════════════════
//
// No parameter, header or body field is read for a company. The key resolves
// to exactly one AgencyAccessKey row (keyHash is unique) and its companyId is
// the tenant for everything the call does. Another company's key therefore
// reaches only that company — the check runs both directions.
//
// ══ Logged, and limited ════════════════════════════════════════════════════
//
// Every call made with a real key — refusals included — is one AgencyApiCall
// row: method, path (never the query string, which can carry a campaign name
// or a cursor), status. The settings screen lists them per key, and the rate
// limit counts them: RATE_LIMIT calls per RATE_WINDOW_MS per key, across every
// server instance, because the count is the database's, not one lambda's
// memory. A request with no valid key has no row to log against; it is
// throttled per IP in memory instead, so the key space cannot be walked.

import { hashAgencySecret, secretFromHeaders, keyHasScope } from "@/lib/agency/keys";
import { hit, clientIp } from "@/lib/rateLimit";

export const RATE_LIMIT = 120;
export const RATE_WINDOW_MS = 60 * 1000;
/** lastUsedAt is written at most this often per key — a dashboard polls. */
const LAST_USED_EVERY_MS = 60 * 1000;

/** The refusal shape every /api/v1 route answers with. */
export function refusal(status, code, error, extra = {}) {
  return { status, body: { error, code, ...extra } };
}

export const UNAUTHORIZED = refusal(
  401,
  "unauthorized",
  "Send the agency key the company created in FieldQuo (Settings › Marketing agency access) as: Authorization: Bearer fqa_…",
);

/**
 * Resolve the key on a request.
 * @returns {{ key, companyId } | { refusal: { status, body } }}
 */
export async function resolveAgencyKey(db, request, { scope = null, now = new Date() } = {}) {
  const secret = secretFromHeaders(request.headers);
  if (!secret) {
    const limited = hit(`agency-nokey:${clientIp(request)}`, { limit: 60, windowMs: 10 * 60 * 1000 });
    if (!limited.ok) return { refusal: refusal(429, "rate_limited", "Too many requests without a valid key.", { retryAfter: limited.retryAfter }) };
    return { refusal: UNAUTHORIZED };
  }
  const key = await db.agencyAccessKey.findUnique({
    where: { keyHash: hashAgencySecret(secret) },
    select: { id: true, companyId: true, name: true, scopes: true, revokedAt: true, lastUsedAt: true, createdAt: true },
  });
  if (!key) {
    const limited = hit(`agency-badkey:${clientIp(request)}`, { limit: 30, windowMs: 10 * 60 * 1000 });
    if (!limited.ok) return { refusal: refusal(429, "rate_limited", "Too many requests with an unknown key.", { retryAfter: limited.retryAfter }) };
    return { refusal: UNAUTHORIZED };
  }
  if (key.revokedAt) {
    return { key, refusal: refusal(401, "key_revoked", "This agency key was revoked by the company. Ask them for a new one.") };
  }

  // Per-key limit, counted from the call log.
  const since = new Date(now.getTime() - RATE_WINDOW_MS);
  const recent = await db.agencyApiCall.count({ where: { keyId: key.id, at: { gte: since } } });
  if (recent >= RATE_LIMIT) {
    return { key, refusal: refusal(429, "rate_limited", `At most ${RATE_LIMIT} requests a minute per key.`, { retryAfter: Math.ceil(RATE_WINDOW_MS / 1000) }) };
  }

  if (scope && !keyHasScope(key, scope)) {
    return {
      key,
      refusal: refusal(403, "scope_missing", `This key does not have the "${scope}" permission. The company can create a key that does in Settings › Marketing agency access.`),
    };
  }
  return { key, companyId: key.companyId };
}

/** One call-log row, and lastUsedAt when it is stale. Never throws. */
export async function logAgencyCall(db, key, { method, path, status, now = new Date() }) {
  if (!key?.id) return;
  try {
    await db.agencyApiCall.create({
      data: { companyId: key.companyId, keyId: key.id, method: String(method || "GET").slice(0, 10), path: String(path || "").split("?")[0].slice(0, 200), status, at: now },
    });
    const last = key.lastUsedAt ? new Date(key.lastUsedAt).getTime() : 0;
    if (!key.revokedAt && now.getTime() - last > LAST_USED_EVERY_MS) {
      await db.agencyAccessKey.update({ where: { id: key.id }, data: { lastUsedAt: now } });
    }
  } catch (err) {
    console.error("[agency-api] call log failed:", err?.message);
  }
}

/**
 * Run one /api/v1 handler: authenticate, call `fn({ key, companyId })`,
 * log, answer. `fn` returns { status, body } (refusals included). A thrown
 * error is a bug: it is logged as a 500 against the key and re-thrown, so it
 * reaches the error log rather than being laundered into a tidy refusal.
 */
export async function runAgencyCall(db, request, { scope, now = new Date() }, fn) {
  const path = new URL(request.url).pathname;
  const resolved = await resolveAgencyKey(db, request, { scope, now });
  if (resolved.refusal) {
    await logAgencyCall(db, resolved.key, { method: request.method, path, status: resolved.refusal.status, now });
    return resolved.refusal;
  }
  let result;
  try {
    result = await fn({ key: resolved.key, companyId: resolved.companyId });
  } catch (err) {
    await logAgencyCall(db, resolved.key, { method: request.method, path, status: 500, now });
    throw err;
  }
  await logAgencyCall(db, resolved.key, { method: request.method, path, status: result.status, now });
  return result;
}
