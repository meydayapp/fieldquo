// app/api/marketing-spend/campaigns/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { dayRangeUtc } from "@/lib/analytics/dayRange";
import { loadCampaignRollup } from "@/lib/analytics/campaignRollupData";
import { loadGoogleAdsRollup } from "@/lib/analytics/googleAdsRollupData";

// Per-campaign spend, Meta's own counts, and what each campaign became in
// FieldQuo — the "Campaigns" section of app/app/marketing/spend/page.js.
// Sibling of ../summary (same gate, same shape of read): summary is the
// whole-company picture, this is the one join it cannot make, campaign by
// campaign. The queries — including the confirmed-match conversion check for
// leads nobody linked to their quote, and the invoices' amountPaid — live in
// lib/analytics/campaignRollupData.js (shared with the monthly summary email,
// so the two cannot disagree about a campaign) and the counting in
// lib/analytics/campaignRollup.js, which has no database of its own.
export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can see marketing spend" },
      { status: err.status || 403 },
    );
  }

  const { searchParams } = new URL(request.url);
  // Whole days at both ends, or no bound at all — the Spend page asks
  // without one, so a campaign that ran in March is still on the list in
  // September beside the job it produced.
  const range = dayRangeUtc(searchParams.get("from"), searchParams.get("to"));

  const asOf = new Date();
  const rollup = await loadCampaignRollup({
    db,
    companyId: member.companyId,
    range,
    asOf,
  });

  // Google Ads beside it (lib/analytics/googleAdsRollupData.js): its own read
  // and its own failure — a Google query that fails must not take the Meta
  // table down with it, and must not look like "no Google spend" either.
  let google = null;
  let googleError = null;
  try {
    google = await loadGoogleAdsRollup({ db, companyId: member.companyId, range, asOf });
  } catch (err) {
    googleError = err?.message || "Google Ads figures could not be worked out.";
  }

  return NextResponse.json({ ...rollup, google, googleError });
}
