// lib/platform/currentPlatformAdmin.js
import { jwtVerify } from "jose";
import { carriesScope } from "@/lib/sales/auth";

/**
 * The signing key for platform-admin sessions.
 *
 * Resolved per call, not at module load. An unset PLATFORM_JWT_SECRET encodes
 * to a ZERO-LENGTH key, which jose refuses — so verification threw, the catch
 * below swallowed it, and the symptom was a superadmin login that appeared to
 * work and bounced straight back out with nothing in any log. It fails closed,
 * which is the safe direction, but silently, which is the expensive one.
 *
 * Now it says so. Same treatment as lib/platform/impersonationToken.js, which
 * already threw with instructions.
 */
function platformSecret() {
  const value = process.env.PLATFORM_JWT_SECRET;
  if (!value) {
    const err = new Error(
      "PLATFORM_JWT_SECRET isn't set. It signs superadmin console sessions, " +
        "and without it no one can sign in. Generate one with: " +
        "openssl rand -base64 32 — then add it to .env locally and to your " +
        "Vercel project settings, and redeploy. See docs/VERCEL.md.",
    );
    err.status = 500;
    throw err;
  }
  return new TextEncoder().encode(value);
}

export async function getCurrentPlatformAdmin(request) {
  const token = request.cookies.get("platform-token")?.value;
  if (!token) return null;

  // A missing secret is a DEPLOYMENT fault and propagates as a 500 with
  // instructions. A bad or expired token is an ordinary "not signed in" and
  // returns null. Collapsing the two is what hid this for as long as it was
  // hidden.
  const secret = platformSecret();

  try {
    const { payload } = await jwtVerify(token, secret);

    // ── The other half of the sales portal's mutual rejection ─────────────
    //
    // A sales rep's token is signed with this same secret (see lib/sales/auth.js
    // for why one secret beats a second env var that can be unset), so the
    // signature check above passes for it. What separates the two identities is
    // the scope claim, and it has to be refused HERE as well as required there
    // — a one-way check is not a boundary.
    //
    // Why it matters more in this direction: a long tail of /api/platform/*
    // routes ask only "is there an admin?" and never reach
    // requirePlatformPermission. If a rep's credential could satisfy this
    // function, that rep silently inherits whatever the least careful of those
    // routes grants — and the hole would live in files the sales feature never
    // touches, so nobody reviewing the sales code would see it.
    //
    // Refused on "carries a scope at all" rather than on "scope === sales":
    // the login route mints platform tokens with no scope claim, so any scope
    // is by definition somebody else's, and a scope invented later is refused
    // without anyone having to remember to add it to a list.
    if (carriesScope(payload)) return null;

    return { id: payload.adminId, role: payload.role };
  } catch {
    return null;
  }
}
