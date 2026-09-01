// app/api/meta-ads/sync/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { isBillingAdmin, BILLING_ADMIN_ERROR } from "@/lib/billing/billingAdmin";
import { getCampaignInsights } from "@/lib/meta/client";
import { getConnection, getDecryptedToken, recordSyncOutcome } from "@/lib/meta/connection";
import { buildImportPlan } from "@/lib/meta/insightsImport";

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// One request, no pagination beyond Meta's own `limit` param below. A small
// contractor's handful of campaigns over a month fits in one page; a
// genuinely large account paginating past this is a real gap — see
// docs/META-ADS-BUILD.md's "what was not built" section.
const MAX_RANGE_DAYS = 90;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoISO(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Manually triggered ("Sync now" on the settings screen) rather than a cron
// — see docs/META-ADS-BUILD.md on why an automatic daily sync was left for a
// follow-up rather than bundled in here.
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

  const body = await request.json().catch(() => ({}));
  const until = DAY_RE.test(body?.until) ? body.until : todayISO();
  const since = DAY_RE.test(body?.since) ? body.since : daysAgoISO(30);
  if (since > until) {
    return NextResponse.json({ error: "`since` must not be after `until`." }, { status: 400 });
  }
  const rangeDays = (new Date(`${until}T00:00:00Z`) - new Date(`${since}T00:00:00Z`)) / 86400000;
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Range too wide — sync at most ${MAX_RANGE_DAYS} days at a time.` }, { status: 400 });
  }

  let token;
  try {
    token = getDecryptedToken(connection);
  } catch (err) {
    // A corrupted row (wrong encryption key after a rotation, truncated
    // data) is NOT the same failure as an expired Meta token — see
    // lib/meta/tokenCrypto.js's own note on this. Marked "error", not
    // "needs_reauth": reconnecting through Meta's OAuth dialog won't fix a
    // local decryption failure, and telling the contractor to do that would
    // send them on a pointless trip through Facebook's consent screen.
    await recordSyncOutcome({ companyId: member.companyId, status: "error", error: "Stored token could not be read. Disconnect and reconnect." });
    return NextResponse.json({ error: "Stored token could not be read — try disconnecting and reconnecting." }, { status: 500 });
  }

  const company = await db.company.findUnique({ where: { id: member.companyId }, select: { currency: true } });

  const insightsRes = await getCampaignInsights({ accessToken: token, adAccountId: connection.adAccountId, since, until });
  if (!insightsRes.ok) {
    // Rate-limited is NOT a broken connection — Meta will allow calls again
    // shortly, and marking the row "error"/"needs_reauth" over a transient
    // 429 would tell a contractor to reconnect for a problem reconnecting
    // doesn't fix. Only auth_error moves the connection to needs_reauth;
    // everything else that isn't rate-limiting is "error" (a real, non-token
    // problem — Meta's API being down, a malformed request).
    const status = insightsRes.kind === "auth_error" ? "needs_reauth" : insightsRes.kind === "rate_limited" ? "connected" : "error";
    await recordSyncOutcome({ companyId: member.companyId, status, error: insightsRes.message });
    const httpStatus = insightsRes.kind === "auth_error" ? 401 : insightsRes.kind === "rate_limited" ? 429 : 502;
    return NextResponse.json(
      { error: insightsRes.message, kind: insightsRes.kind, retryAfterSeconds: insightsRes.retryAfterSeconds },
      { status: httpStatus },
    );
  }

  const rawRows = Array.isArray(insightsRes.data?.data) ? insightsRes.data.data : [];

  const existingSpend = await db.marketingSpend.findMany({
    where: { companyId: member.companyId, date: { gte: new Date(`${since}T00:00:00Z`), lte: new Date(`${until}T23:59:59Z`) } },
    select: { id: true, source: true, externalId: true, platform: true, date: true, campaignName: true },
  });

  const plan = buildImportPlan({
    rawRows,
    existingSpend,
    companyCurrency: company?.currency || "CAD",
    adAccountCurrency: connection.adAccountCurrency,
  });

  for (const row of plan.toCreate) {
    // upsert, not create: a double-click on "Sync now" (or two browser tabs)
    // can race two syncs over the same range, and buildImportPlan's `toCreate`
    // list was built from a snapshot BEFORE either write landed — the second
    // request's plan doesn't know the first one already inserted this
    // externalId. A bare create() would throw a Prisma unique-constraint
    // error (companyId_source_externalId, from schema.prisma) and surface as
    // an unhandled 500 on the losing request. upsert makes the loser update
    // the row the winner just created with the SAME fresh Meta figures,
    // instead of erroring on data that was about to be correct anyway.
    await db.marketingSpend.upsert({
      where: {
        companyId_source_externalId: {
          companyId: member.companyId,
          source: row.source,
          externalId: row.externalId,
        },
      },
      create: { companyId: member.companyId, ...row },
      update: row,
    });
  }
  for (const upd of plan.toUpdate) {
    // updateMany, not update: upd.id is sourced from `existingSpend` above,
    // which was already companyId-scoped — but that's true because of how
    // buildImportPlan's pure logic happens to use it, not something a static
    // scanner (scripts/check-tenant-scope.mjs) can prove from this file
    // alone. companyId in the where clause makes it true by construction
    // here too: this can update at most the ONE row that is both this id and
    // this company's, and silently touches nothing if that's ever not the
    // same row — never another tenant's, no matter how the plan was built.
    await db.marketingSpend.updateMany({
      where: { id: upd.id, companyId: member.companyId },
      data: upd.data,
    });
  }

  await recordSyncOutcome({ companyId: member.companyId, status: "connected", error: null });

  return NextResponse.json({
    summary: plan.summary,
    currencyMismatch: plan.currencyMismatch,
    possibleDuplicates: plan.possibleDuplicates,
    errors: plan.errors,
  });
}
