// app/api/platform/sales/prospects/maps-scrape/route.js
//
// What the Google Maps scrape has landed in the database, for the panel on
// /platform/sales/prospects. GET only: the scrape runs on the owner's Mac
// (scripts/scrape/maps.mjs) and nothing in production can start it, so
// there is no POST — a button here would be a dead one.
//
// Replaced /api/platform/sales/prospects/enrich, the Google Places API
// route, retired 2026-09-20 (lib/sales/intel/places.js's header). Superadmin
// only, as that was: this lists sales-side counts, not a tenant's data.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { superadminOrRefusal } from "@/lib/sales/intel/configAdmin";
import { mapsScrapeStatus } from "@/lib/sales/intel/mapsScrapeStatus";

export async function GET(request) {
  const { refusal } = await superadminOrRefusal(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });
  return NextResponse.json(await mapsScrapeStatus({ db, now: new Date() }));
}
