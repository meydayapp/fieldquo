// app/api/platform/companies/presence/route.js
//
// GET → { serverNow, companies: [{ id, isDemo, companyCreatedAt, memberCount,
//         lastActiveAt, signedInAt }] }
//
// The inputs to the "Online now / Active 2 h ago / Signed in Sep 24" badge on
// /platform/companies, for every company, and nothing else. Split from
// GET /api/platform/companies so the list can poll THIS every minute while it
// is open without re-downloading subscriptions, plans and counts for every
// company each time — four reads total, however many companies there are
// (lib/company/memberActivity.js presenceForCompanies).
//
// Raw timestamps, not words: the page turns them into the badge with the
// viewer's own time zone ("Sep 24" is a local date) and a clock corrected by
// `serverNow` (lib/platform/companyPresence.js skewCorrectedNow).
//
// Read-only, like everything the console does to a tenant (non-negotiable #3).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { requirePlatformPermission } from "@/lib/platform/permissions";
import { presenceForCompanies } from "@/lib/company/memberActivity";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  try {
    const companies = await presenceForCompanies();
    return NextResponse.json({ serverNow: new Date().toISOString(), companies });
  } catch (err) {
    console.error("[platform companies presence]", err);
    return NextResponse.json({ error: "Couldn't load who is signed in." }, { status: 500 });
  }
}
