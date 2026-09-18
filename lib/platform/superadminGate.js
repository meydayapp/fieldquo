// lib/platform/superadminGate.js
//
// "Only a superadmin" as one function, for the routes that hand over a
// contractor's recorded voice. Written once because the voicemail proxy and
// the floor route each spell the same two checks by hand, and a third copy
// is the one that would drift (AGENTS.md failure class 4).
import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";

/**
 * @returns {Promise<{ admin: object, refusal: null } | { admin: null, refusal: NextResponse }>}
 */
export async function requireSuperadmin(request, what = "do this") {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return { admin: null, refusal: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (admin.role !== "superadmin") {
    return { admin: null, refusal: NextResponse.json({ error: `Only superadmins can ${what}` }, { status: 403 }) };
  }
  return { admin, refusal: null };
}
