// lib/sales/auth.js
//
// The sales rep's session. A THIRD identity, beside User (a tenant's staff)
// and PlatformAdmin (FieldQuo's console) — see the SalesRep header in
// prisma/schema.prisma for why neither of those two could carry it.
//
// ══ One secret, two scopes, and a rejection that runs BOTH ways ════════════
//
// This mirrors lib/platform/currentPlatformAdmin.js almost exactly: a signed
// JWT in an httpOnly cookie, verified with jose, no Better Auth session
// anywhere near it. What it does NOT do is share the cookie.
//
// The token is signed with the SAME PLATFORM_JWT_SECRET, and that is a
// deliberate choice rather than laziness. A second secret would be a second
// environment variable that can be unset, and this codebase has already paid
// for that once — currentPlatformAdmin.js's own header is the story of a
// superadmin login that silently bounced because PLATFORM_JWT_SECRET was
// missing and the failure was swallowed. Adding SALES_JWT_SECRET would create
// a second, identical trapdoor.
//
// What makes one secret safe is that the scope claim is MANDATORY and verified
// in both directions:
//
//   · verifySalesToken() refuses any token that does not say scope: "sales".
//   · getCurrentPlatformAdmin() refuses any token that carries a scope claim
//     at all.
//
// Both halves are needed, and the second is the important one. A platform
// token is checked by a long tail of /api/platform/* routes, some of which
// only ask "is there an admin?" and never call requirePlatformPermission. If a
// rep's credential could ever be read as a platform one, that rep silently
// gains whatever the least careful of those routes grants — and nobody would
// find out from reading the sales code, because the hole would be in a file
// the sales feature never touches.
//
// ── Why "carries a scope claim at all" rather than "carries scope: sales" ──
//
// The platform login route mints its tokens with no scope claim, and it is not
// this change's file to edit. Requiring scope: "platform" there would sign out
// every live console session the moment this deploys, for no security gain —
// the sales minter below ALWAYS sets the claim, so "has a scope" and "is not a
// platform token" are the same statement today, and any future scope added by
// anyone else is refused by default rather than by remembering to list it.

import { jwtVerify, SignJWT } from "jose";

/** The rep's cookie. Deliberately NOT "platform-token". */
export const SALES_COOKIE = "sales-token";

/** The mandatory claim. A token without exactly this is not a rep session. */
export const SALES_SCOPE = "sales";

// Matches the platform console's 12 hours. A rep's session reaches other
// companies' names and billing states; it is not a shift-long login.
const SESSION_HOURS = 12;
export const SALES_SESSION_MAX_AGE = 60 * 60 * SESSION_HOURS;

/**
 * The signing key, resolved per call rather than at module load.
 *
 * Same treatment, and same reason, as lib/platform/currentPlatformAdmin.js: an
 * unset PLATFORM_JWT_SECRET encodes to a zero-length key that jose refuses, so
 * a module-level constant turns a deployment fault into a login that fails
 * closed and silently. Failing closed is right; failing silently is what cost
 * a day.
 */
function salesSecret() {
  const value = process.env.PLATFORM_JWT_SECRET;
  if (!value) {
    const err = new Error(
      "PLATFORM_JWT_SECRET isn't set. It signs both the platform console's " +
        "sessions and the sales portal's, and without it nobody can sign in " +
        "to either. Generate one with: openssl rand -base64 32 — then add it " +
        "to .env locally and to your Vercel project settings, and redeploy. " +
        "See docs/VERCEL.md.",
    );
    err.status = 500;
    throw err;
  }
  return new TextEncoder().encode(value);
}

/**
 * True when a decoded payload carries a scope claim of any kind.
 *
 * Exported so middleware.js and lib/platform/currentPlatformAdmin.js can ask
 * the question from ONE place. Two copies of "is this somebody else's token"
 * is the copy-paste failure class AGENTS.md names, and the copy that rots here
 * is the one guarding the console.
 */
export function carriesScope(payload) {
  return (
    payload !== null &&
    typeof payload === "object" &&
    payload.scope !== undefined &&
    payload.scope !== null
  );
}

/** Mints a rep session token. The scope claim is not optional. */
export async function signSalesToken(salesRepId) {
  if (!salesRepId || typeof salesRepId !== "string") {
    throw new Error("signSalesToken needs a SalesRep id");
  }
  return new SignJWT({ salesRepId, scope: SALES_SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${SESSION_HOURS}h`)
    .setIssuedAt()
    .sign(salesSecret());
}

/**
 * Verifies a rep session token.
 *
 * @returns `{ salesRepId }` or null. Null covers three different failures on
 *          purpose — no token, a bad signature, and a VALID token that is a
 *          platform admin's rather than a rep's. All three mean "not signed in
 *          here", and telling them apart in the response would tell a caller
 *          which credential they are holding.
 *
 * A missing secret still propagates as a 500 with instructions, exactly as
 * getCurrentPlatformAdmin does — a deployment fault and a bad token are
 * different things and collapsing them is what hid the last one.
 */
export async function verifySalesToken(token) {
  if (!token) return null;
  const secret = salesSecret();

  let payload;
  try {
    ({ payload } = await jwtVerify(token, secret));
  } catch {
    return null;
  }

  // The mutual half. A platform token verifies against this secret perfectly
  // well — it is the same secret — so the signature alone proves nothing about
  // WHICH identity system minted it. The scope claim is what does.
  if (payload.scope !== SALES_SCOPE) return null;
  if (!payload.salesRepId || typeof payload.salesRepId !== "string") return null;

  return { salesRepId: payload.salesRepId };
}

/**
 * The rep this request is signed in as, from the cookie.
 *
 * Identity only. It does NOT prove the rep is still allowed in — a token
 * outlives a deactivation by up to twelve hours, so every route re-reads the
 * row through lib/sales/gate.js before doing anything with the answer. Same
 * split, and same reason, as /api/platform/me re-reading the PlatformAdmin
 * rather than trusting its own JWT's role.
 */
export async function getCurrentSalesRep(request) {
  const token = request.cookies?.get?.(SALES_COOKIE)?.value;
  return verifySalesToken(token);
}
