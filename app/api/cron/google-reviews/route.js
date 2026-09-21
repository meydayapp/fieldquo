// app/api/cron/google-reviews/route.js
//
// Nightly: refresh every connected company's Google review cache, and purge
// what is older than thirty days whether or not the refresh succeeds. One
// company at a time — the project's quota is shared across every tenant
// (300 QPM once approved), and a company's whole list is a page or two.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireCronSecret } from "@/lib/security/cronAuth";
import { db } from "@/lib/db";
import { googleCalendarConfigured } from "@/lib/calendar/googleClient";
import { refreshCompanyReviews } from "@/lib/reviews/googleBusiness/sync";

export async function GET(request) {
  const denied = requireCronSecret(request);
  if (denied) return denied;

  if (!googleCalendarConfigured()) return NextResponse.json({ skipped: "not_configured" });

  const connections = await db.companyGoogleBusiness.findMany({ where: { locationName: { not: null } } });
  const out = { companies: connections.length, refreshed: 0, failed: 0, kinds: {} };
  for (const connection of connections) {
    const result = await refreshCompanyReviews(connection);
    if (result.ok) out.refreshed++;
    else {
      out.failed++;
      out.kinds[result.kind] = (out.kinds[result.kind] || 0) + 1;
    }
  }
  return NextResponse.json(out);
}
