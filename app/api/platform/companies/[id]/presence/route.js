// app/api/platform/companies/[id]/presence/route.js
//
// GET → { serverNow, id, isDemo, companyCreatedAt, members: [{ id, name,
//         email, role, active, joinedAt, lastActiveAt, signedInAt }] }
//
// The company page's header badge and its per-member list: who on this
// account was last in, and when. Same inputs as the list's badge
// (lib/company/memberActivity.js), per member instead of per company, so the
// two screens can never disagree about the same company.
//
// Read-only (non-negotiable #3). Nothing here writes, and viewing it does not
// stamp anyone: the stamp lives behind POST /api/presence, which a platform
// token cannot reach as a company member.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { presenceForMembers } from "@/lib/company/memberActivity";

// Next 16: params is a Promise.
export async function GET(request, { params }) {
  const { id } = await params;

  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  try {
    const presence = await presenceForMembers(id);
    if (!presence) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ serverNow: new Date().toISOString(), ...presence });
  } catch (err) {
    console.error("[platform company presence]", err);
    return NextResponse.json({ error: "Couldn't load who is signed in." }, { status: 500 });
  }
}
