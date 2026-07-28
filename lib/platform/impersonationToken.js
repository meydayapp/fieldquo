// lib/platform/impersonationToken.js
//
// Token verification with no database import, so it can run in Edge
// middleware.
//
// Split out of impersonate.js because that module imports Prisma for the
// audit-log writes, and Prisma can't run on the Edge runtime. Middleware is
// the right place to enforce read-only — it's one gate in front of all ~135
// API routes, rather than a check each route has to remember — but it can
// only get there if the verify path is db-free.

import { jwtVerify } from "jose";

export const IMPERSONATION_COOKIE = "impersonation-token";
export const IMPERSONATION_DURATION_SECONDS = 30 * 60;

function secret() {
  const value = process.env.IMPERSONATION_JWT_SECRET;
  if (!value) {
    const err = new Error(
      "IMPERSONATION_JWT_SECRET isn't set. It signs the short-lived read-only " +
        "support tokens. Generate one with: openssl rand -base64 32 — then add " +
        "it to .env locally and to your Vercel project settings, and redeploy.",
    );
    err.status = 500;
    throw err;
  }
  return new TextEncoder().encode(value);
}

export function impersonationSecret() {
  return secret();
}

/**
 * Returns the claims, or null for anything that doesn't verify cleanly.
 *
 * Null rather than a throw on bad input: a stale or tampered cookie should
 * degrade to "not impersonating" rather than 500 every request the browser
 * makes until someone clears their cookies. A *missing secret* still throws,
 * because that's a deployment fault worth surfacing rather than silently
 * treating every support session as invalid.
 */
export async function verifyImpersonationToken(token) {
  if (!token) return null;

  let key;
  try {
    key = secret();
  } catch {
    // No secret configured — there can be no valid tokens, so nobody is
    // impersonating. Deliberately quiet here; startImpersonation raises the
    // configuration error where someone can act on it.
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, key);
    if (!payload.impersonation) return null;
    // Only read-only tokens are honoured. If a write-capable mode is ever
    // introduced it must be opted into explicitly, not inherited by tokens
    // minted before the distinction existed.
    if (payload.mode !== "read_only") return null;
    if (!payload.companyId || !payload.platformAdminId) return null;
    return {
      platformAdminId: payload.platformAdminId,
      companyId: payload.companyId,
      mode: payload.mode,
    };
  } catch {
    return null; // expired, tampered with, or signed under a rotated secret
  }
}

/** HTTP methods a read-only support session may use. */
export function isReadOnlyMethod(method) {
  return ["GET", "HEAD", "OPTIONS"].includes(
    String(method || "GET").toUpperCase(),
  );
}
