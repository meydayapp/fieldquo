// app/api/platform/sales/review/count/route.js
//
// How many rows are waiting in the Review folder — the sidebar badge.
//
// The same WHERE the folder itself pages over (reviewFolder.js's
// reviewWhereSql with no filter), so the number on the rail is the number on
// the screen. Superadmin only, like the folder: a support admin's rail shows
// no badge rather than a count of rows they cannot open.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import { reviewWhereSql } from "@/lib/sales/discovery/reviewFolder";

// The rail asks on every navigation. A count over a 250,000-row folder is
// ~0.8 s, so it is held for a minute per instance: a badge that lags a
// minute behind is still the number that matters, and forty of these a
// minute per admin is not.
const COUNT_TTL_MS = 60 * 1000;
let countCache = { at: 0, count: null };

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Not a refusal: the rail asks on every page for every admin, and a 403 in
  // the console on each navigation is noise. No badge is the honest answer.
  if (admin.role !== "superadmin") return NextResponse.json({ count: null });

  const now = Date.now();
  if (countCache.count !== null && now - countCache.at < COUNT_TTL_MS) {
    return NextResponse.json({ count: countCache.count, cachedFor: Math.round((now - countCache.at) / 1000) });
  }
  const [{ n }] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "Prospect" WHERE ${reviewWhereSql({}, { now: new Date(now) })}`;
  countCache = { at: now, count: Number(n) };
  return NextResponse.json({ count: Number(n) });
}
