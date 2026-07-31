// lib/platform/currentPlatformAdmin.js
import { jwtVerify } from "jose";

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
    return { id: payload.adminId, role: payload.role };
  } catch {
    return null;
  }
}
