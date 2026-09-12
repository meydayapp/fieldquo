// app/api/platform/signup-origins/count/route.js
//
// How many flagged signups are waiting for a look — the rail badge beside
// "Signup origins". The owner asked for a FIRST-LEVEL flag: seen without
// opening the page.
//
// The same WHERE the page's "Flagged only" filter and the push use
// (NEEDS_REVIEW_WHERE), so the number on the rail is the number on the
// screen. Anyone who may view companies gets the count; the review action
// itself is narrower. Not cached: SignupOrigin is a small table (one row per
// company) and a count on an indexed pair is cheap.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { canPlatform } from "@/lib/platform/permissions";
import { NEEDS_REVIEW_WHERE } from "@/lib/platform/signupOrigin";

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Null, not a refusal: the rail asks on every page for every admin, and a
  // 403 on each navigation is noise. No badge is the honest answer.
  if (!canPlatform(admin.role, "company:view")) return NextResponse.json({ count: null });
  const count = await db.signupOrigin.count({ where: NEEDS_REVIEW_WHERE });
  return NextResponse.json({ count });
}
