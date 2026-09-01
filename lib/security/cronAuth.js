// lib/security/cronAuth.js
//
// Every route under app/api/cron/ is reachable by anyone on the internet —
// Vercel Cron proves itself with nothing but this header, so the header IS
// the entire authentication boundary for a job that sends email, places
// outbound AI phone calls, and charges saved cards.
//
// The old, sixteen-times-copied check was:
//
//   if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`)
//
// When CRON_SECRET is unset, the template literal is not "no valid value" —
// it's the literal string "Bearer undefined", which is a fixed, publicly
// knowable password. Verified directly. A deploy that forgot to set the env
// var didn't fail closed; it opened every cron to any stranger who sent that
// exact header. Fixed here, once, instead of in sixteen copies — a copy is
// the version nobody looks at again (AGENTS.md failure class #4), and this is
// exactly the kind of bug that hides in a copy.
//
// timingSafeEqual so a byte-at-a-time timing attack against a correctly
// configured secret isn't traded in for the undefined-secret bug.
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  // Different lengths would throw inside timingSafeEqual rather than compare
  // false. The length itself leaks nothing beyond what the wire already did.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Call at the top of every app/api/cron/*\/route.js handler:
 *
 *   const denied = requireCronSecret(request);
 *   if (denied) return denied;
 *
 * Returns a 401 NextResponse when the request is not authorised — return it
 * as-is. Returns `null` when it's safe to continue.
 *
 * A missing or empty CRON_SECRET ALWAYS denies. It never falls through to
 * "so nothing matches, so nothing is authorised" the way the old per-route
 * comparison did — it refuses explicitly, and says why in the server log, so
 * a misconfigured deploy is loud on the first cron tick instead of being
 * discovered by whoever finds the hole first.
 */
export function requireCronSecret(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(
      "[cron] CRON_SECRET is not set — refusing every cron request until it is configured.",
    );
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const header = request.headers.get("authorization") || "";
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
