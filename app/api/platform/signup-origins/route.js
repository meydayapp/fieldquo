// app/api/platform/signup-origins/route.js
//
// GET — every signup, newest first, with where the request came from and the
// flag decided at the time. `?flagged=1` narrows to rows that need a look
// (flagged, not yet reviewed).
//
// Read-only, and reads FieldQuo's own SignupOrigin rows — never a company's
// data. The one write in this feature is the review stamp, on its own route.
// `company:view`, like the company list: the flag is a fact about the
// signup, and support sees the company list already. The review ACTION is
// narrower (signup:review) and the screen draws it only for those who hold it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { canPlatform, requirePlatformPermission } from "@/lib/platform/permissions";
import { NEEDS_REVIEW_WHERE, ORIGIN_SELECT, shapeOrigin } from "@/lib/platform/signupOrigin";

const PAGE = 200;

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    requirePlatformPermission(admin.role, "company:view");
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: err.status || 403 });
  }

  const url = new URL(request.url);
  const flaggedOnly = url.searchParams.get("flagged") === "1";

  const [rows, flaggedCount, total] = await Promise.all([
    db.signupOrigin.findMany({
      where: flaggedOnly ? NEEDS_REVIEW_WHERE : {},
      select: ORIGIN_SELECT,
      orderBy: { createdAt: "desc" },
      take: PAGE,
    }),
    db.signupOrigin.count({ where: NEEDS_REVIEW_WHERE }),
    db.signupOrigin.count(),
  ]);

  return NextResponse.json({
    origins: rows.map(shapeOrigin),
    flaggedCount,
    total,
    truncated: rows.length === PAGE,
    canReview: canPlatform(admin.role, "signup:review"),
  });
}
