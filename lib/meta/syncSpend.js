// lib/meta/syncSpend.js
//
// One company's Meta ad spend, pulled and written. Extracted from
// app/api/meta-ads/sync/route.js on 2026-10-24 so that the nightly cron and
// the "Sync now" button run the SAME code.
//
// ══ Why extract rather than let the cron do its own pull ═══════════════════
//
// The route's own header said the quiet part out loud: "Manually triggered
// ('Sync now' on the settings screen) rather than a cron — see
// docs/META-ADS-BUILD.md on why an automatic daily sync was left for a
// follow-up". That follow-up is the cron beside this file, and writing the
// pull a second time inside it would be AGENTS.md failure class 4 exactly:
// the copy is the one that rots, because it is the one nobody opens. Every
// judgement below — which Meta failures mean "reconnect" and which mean
// "wait", why a create is an upsert, why an update is an updateMany — would
// have had to be re-made correctly in a file nobody reads at 4am.
//
// lib/googleAds/sync.js's syncGoogleAdsCompany is the same shape for the same
// reason, and its cron is three lines long because of it.
//
// ══ What this does NOT do ══════════════════════════════════════════════════
//
// It does not decide WHO may sync. The route checks the member and the
// billing-admin role before calling in; the cron checks the cron secret. A
// permission check in here would be a third opinion on a question the two
// callers already answer differently and correctly.
import { db } from "@/lib/db";
import { getCampaignInsights } from "@/lib/meta/client";
import { getDecryptedToken, recordSyncOutcome } from "@/lib/meta/connection";
import { buildImportPlan } from "@/lib/meta/insightsImport";

/** Meta restates figures for about a month; this is the default look-back. */
export const DEFAULT_LOOKBACK_DAYS = 30;
// One request, no pagination beyond Meta's own `limit` param. A small
// contractor's handful of campaigns over a month fits in one page; a
// genuinely large account paginating past this is a real gap — see
// docs/META-ADS-BUILD.md's "what was not built" section.
export const MAX_RANGE_DAYS = 90;

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
export function daysAgoISO(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * Pull one connected company's campaign × day spend and write it.
 *
 * Records the connection's own outcome on the way through, so a caller that
 * forgets to is still honest about the state of the connection.
 *
 * @returns {Promise<
 *   | { ok: true, summary, currencyMismatch, possibleDuplicates, errors }
 *   | { ok: false, kind: "token_unreadable"|"auth_error"|"rate_limited"|"api_error",
 *       message: string, retryAfterSeconds?: number }
 * >}
 */
export async function syncMetaAdsCompany(connection, { since, until } = {}) {
  const companyId = connection.companyId;
  const to = DAY_RE.test(until) ? until : todayISO();
  const from = DAY_RE.test(since) ? since : daysAgoISO(DEFAULT_LOOKBACK_DAYS);

  let token;
  try {
    token = getDecryptedToken(connection);
  } catch {
    // A corrupted row (wrong encryption key after a rotation, truncated
    // data) is NOT the same failure as an expired Meta token — see
    // lib/meta/tokenCrypto.js's own note on this. Marked "error", not
    // "needs_reauth": reconnecting through Meta's OAuth dialog won't fix a
    // local decryption failure, and telling the contractor to do that would
    // send them on a pointless trip through Facebook's consent screen.
    await recordSyncOutcome({ companyId, status: "error", error: "Stored token could not be read. Disconnect and reconnect." });
    return { ok: false, kind: "token_unreadable", message: "Stored token could not be read — try disconnecting and reconnecting." };
  }

  const company = await db.company.findUnique({ where: { id: companyId }, select: { currency: true } });

  const insightsRes = await getCampaignInsights({ accessToken: token, adAccountId: connection.adAccountId, since: from, until: to });
  if (!insightsRes.ok) {
    // Rate-limited is NOT a broken connection — Meta will allow calls again
    // shortly, and marking the row "error"/"needs_reauth" over a transient
    // 429 would tell a contractor to reconnect for a problem reconnecting
    // doesn't fix. Only auth_error moves the connection to needs_reauth;
    // everything else that isn't rate-limiting is "error" (a real, non-token
    // problem — Meta's API being down, a malformed request).
    const status = insightsRes.kind === "auth_error" ? "needs_reauth" : insightsRes.kind === "rate_limited" ? "connected" : "error";
    await recordSyncOutcome({ companyId, status, error: insightsRes.message });
    return {
      ok: false,
      kind: insightsRes.kind === "auth_error" ? "auth_error" : insightsRes.kind === "rate_limited" ? "rate_limited" : "api_error",
      message: insightsRes.message,
      retryAfterSeconds: insightsRes.retryAfterSeconds,
    };
  }

  const rawRows = Array.isArray(insightsRes.data?.data) ? insightsRes.data.data : [];

  const existingSpend = await db.marketingSpend.findMany({
    where: { companyId, date: { gte: new Date(`${from}T00:00:00Z`), lte: new Date(`${to}T23:59:59Z`) } },
    select: { id: true, source: true, externalId: true, platform: true, date: true, campaignName: true },
  });

  const plan = buildImportPlan({
    rawRows,
    existingSpend,
    companyCurrency: company?.currency || "CAD",
    adAccountCurrency: connection.adAccountCurrency,
  });

  for (const row of plan.toCreate) {
    // upsert, not create: a double-click on "Sync now" (or two browser tabs,
    // or the cron landing on the same company a person just synced) can race
    // two syncs over the same range, and buildImportPlan's `toCreate` list
    // was built from a snapshot BEFORE either write landed — the second
    // request's plan doesn't know the first one already inserted this
    // externalId. A bare create() would throw a Prisma unique-constraint
    // error (companyId_source_externalId, from schema.prisma) and surface as
    // an unhandled 500 on the losing request. upsert makes the loser update
    // the row the winner just created with the SAME fresh Meta figures,
    // instead of erroring on data that was about to be correct anyway.
    await db.marketingSpend.upsert({
      where: { companyId_source_externalId: { companyId, source: row.source, externalId: row.externalId } },
      create: { companyId, ...row },
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
    await db.marketingSpend.updateMany({ where: { id: upd.id, companyId }, data: upd.data });
  }

  await recordSyncOutcome({ companyId, status: "connected", error: null });

  return {
    ok: true,
    summary: plan.summary,
    currencyMismatch: plan.currencyMismatch,
    possibleDuplicates: plan.possibleDuplicates,
    errors: plan.errors,
  };
}
