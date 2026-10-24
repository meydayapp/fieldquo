// app/api/meta-ads/sync/route.js
//
// "Sync now" on Settings › Meta Ads. The pull itself lives in
// lib/meta/syncSpend.js, shared with app/api/cron/meta-ads-sync — this file
// is the HTTP shape around it: who may ask, what range they may ask for, and
// which status code each failure becomes.
//
// It used to hold the pull as well, under a header explaining that a daily
// cron "was left for a follow-up". The follow-up landed on 2026-10-24; the
// pull moved so the two callers could not drift apart.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { getConnection } from "@/lib/meta/connection";
import {
  syncMetaAdsCompany,
  DAY_RE,
  MAX_RANGE_DAYS,
  DEFAULT_LOOKBACK_DAYS,
  todayISO,
  daysAgoISO,
} from "@/lib/meta/syncSpend";

/** Each refusal the shared sync can return, as the status this caller sends. */
const HTTP_FOR_KIND = {
  token_unreadable: 500,
  auth_error: 401,
  rate_limited: 429,
  api_error: 502,
};

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isBillingAdmin(member.role)) {
    return NextResponse.json({ error: BILLING_ADMIN_ERROR }, { status: 403 });
  }

  const connection = await getConnection(member.companyId);
  if (!connection) {
    return NextResponse.json({ error: "No Meta Ads connection for this company yet." }, { status: 404 });
  }

  // Range validation stays HERE rather than moving into the shared sync: it
  // is about what a BROWSER asked for. The cron passes its own dates and has
  // nothing to validate, and a 400 is not a shape a cron can act on.
  const body = await request.json().catch(() => ({}));
  const until = DAY_RE.test(body?.until) ? body.until : todayISO();
  const since = DAY_RE.test(body?.since) ? body.since : daysAgoISO(DEFAULT_LOOKBACK_DAYS);
  if (since > until) {
    return NextResponse.json({ error: "`since` must not be after `until`." }, { status: 400 });
  }
  const rangeDays = (new Date(`${until}T00:00:00Z`) - new Date(`${since}T00:00:00Z`)) / 86400000;
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Range too wide — sync at most ${MAX_RANGE_DAYS} days at a time.` }, { status: 400 });
  }

  const result = await syncMetaAdsCompany(connection, { since, until });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, kind: result.kind, retryAfterSeconds: result.retryAfterSeconds },
      { status: HTTP_FOR_KIND[result.kind] || 502 },
    );
  }

  return NextResponse.json({
    summary: result.summary,
    currencyMismatch: result.currencyMismatch,
    possibleDuplicates: result.possibleDuplicates,
    errors: result.errors,
  });
}
