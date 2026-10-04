// app/api/platform/costs/r2-test/route.js
//
// POST — "Test the connection" beside the video-archive line on
// /platform/costs. One signed, read-only list against FieldQuo's own R2
// bucket with the production keys, answered as a plain result: connected,
// keys rejected (and which value is probably wrong), bucket not found, account
// id wrong, not configured (with the names). Why it exists, why a list and not
// HeadBucket, and why no value is ever echoed: lib/media/r2ConnectionTest.js.
//
// ══ The gate is here, not on the button ══════════════════════════════════
//
// Superadmin-only via requirePlatformPermission(…, "storage:test") — listed
// in SUPERADMIN_ONLY_PERMISSIONS, so admin and support are refused by the
// matrix rather than by this file remembering a role name.
//
// Refused while the caller holds a live support session ("Sign in as"), as
// app/api/platform/errors/like/route.js does: middleware's read-only gate
// deliberately excludes /api/platform, so the refusal has to be stated here.
// The test writes nothing, but it acts with FieldQuo's own credentials, and
// a browser that is at that moment inside a customer's account is not where
// that should happen from.
//
// ══ 200 for every answer R2 gives ════════════════════════════════════════
//
// The request succeeded when the test ran, whatever R2 said: "keys rejected"
// is the result the owner asked for, not a failure of this route. Non-2xx is
// kept for the route itself refusing or breaking, so the page's catch branch
// means "the test did not run" and nothing else.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { IMPERSONATION_COOKIE, verifyImpersonationToken } from "@/lib/platform/impersonationToken";
import { testR2Connection } from "@/lib/media/r2ConnectionTest";

export async function POST(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "storage:test");
  } catch (err) {
    return NextResponse.json({ error: "Only superadmins can test FieldQuo's storage keys" }, { status: err.status || 403 });
  }

  const support = await verifyImpersonationToken(request.cookies.get(IMPERSONATION_COOKIE)?.value);
  if (support) {
    return NextResponse.json({ error: "End the support session (Sign in as) before testing FieldQuo's storage keys." }, { status: 403 });
  }

  try {
    return NextResponse.json(await testR2Connection());
  } catch {
    // testR2Connection classifies every network failure itself; reaching here
    // means signing threw. The error is not passed on — it was built with the
    // credentials in hand, and this answer must never risk repeating them.
    return NextResponse.json({ error: "The connection test could not run — try again." }, { status: 500 });
  }
}
