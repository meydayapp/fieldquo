// lib/googleAds/sync.js
//
// One company's Google Ads spend, campaign × day, from the Google Ads API
// into MarketingSpend — the daily cron (app/api/cron/google-ads-sync), the
// "Sync now" button and the first sync after an account is picked all call
// syncGoogleAdsCompany(). Takes `db` and `api` so scripts/check-google-ads.mjs
// can run the whole thing against a fixture database and a scripted fake
// Google; nothing in the checks reaches Google.
//
// The import rules are lib/googleAds/spendPlan.js's, shared with the report
// upload: source "google_ads_api", externalId `<campaignId>:<day>`, updates
// only its own rows, never writes .leads, keeps the account's currency on
// the row, and SKIPS a day the uploaded report (or a hand-typed Google row)
// already covers rather than counting it twice.
//
// The window is the last 30 days by default — Google restates conversions
// for up to a month after the click, and re-reading a month nightly is one
// request — and at most 90 days on demand, the same bound the Meta sync has.

import { db as realDb } from "@/lib/db";
import { defaultGoogleAds, campaignDailyQuery, resultRows, parseCampaignDayRow } from "./client";
import { buildGoogleSpendPlan, planWindow, GOOGLE_PLATFORM } from "./spendPlan";
import { writeGoogleSpendPlan } from "./writePlan";
import { recordGoogleAdsSync } from "./connection";

export const SOURCE = "google_ads_api";
export const DEFAULT_SYNC_DAYS = 30;
export const MAX_SYNC_DAYS = 90;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function isoDaysAgo(n, now) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** The window to sync, validated. Pure. */
export function syncWindow({ since = null, until = null, days = DEFAULT_SYNC_DAYS, now = new Date() } = {}) {
  const u = DAY_RE.test(until || "") ? until : now.toISOString().slice(0, 10);
  const s = DAY_RE.test(since || "") ? since : isoDaysAgo(days, new Date(`${u}T00:00:00Z`));
  if (s > u) return { error: "`since` must not be after `until`." };
  const span = (new Date(`${u}T00:00:00Z`) - new Date(`${s}T00:00:00Z`)) / 86400000;
  if (span > MAX_SYNC_DAYS) return { error: `Sync at most ${MAX_SYNC_DAYS} days at a time.` };
  return { since: s, until: u };
}

/** Google's failure kind → the connection status it leaves behind. */
export function statusForKind(kind) {
  if (kind === "auth_error") return "needs_reauth";
  // Quota is not a broken connection; the next run will be allowed.
  if (kind === "rate_limited") return "connected";
  return "error";
}

/**
 * @returns {{ ok: true, summary, possibleDuplicates, errors } |
 *           { ok: false, kind, message }}
 */
export async function syncGoogleAdsCompany(connection, { db = realDb, api = defaultGoogleAds, since = null, until = null, days = DEFAULT_SYNC_DAYS, now = new Date() } = {}) {
  const companyId = connection?.companyId;
  if (!companyId) return { ok: false, kind: "no_connection", message: "No Google Ads connection." };
  if (!connection.customerId) return { ok: false, kind: "no_account", message: "Choose which Google Ads account to import from first." };

  const range = syncWindow({ since, until, days, now });
  if (range.error) return { ok: false, kind: "bad_range", message: range.error };

  let token;
  try {
    token = await api.accessTokenFor(connection);
  } catch {
    // The stored ciphertext will not open (key rotated, row corrupted):
    // reconnecting through Google would not fix a local decryption failure,
    // so this is "error", not "needs_reauth" — same split as the Meta sync.
    const message = "The stored Google Ads token could not be read. Disconnect and connect again.";
    await recordGoogleAdsSync(companyId, { status: "error", error: message }, db);
    return { ok: false, kind: "decrypt", message };
  }
  if (!token?.ok) {
    await recordGoogleAdsSync(companyId, { status: statusForKind(token?.kind), error: token?.message }, db);
    return { ok: false, kind: token?.kind || "auth_error", message: token?.message || "Google refused the stored token." };
  }

  const res = await api.searchStream({
    accessToken: token.accessToken,
    customerId: connection.customerId,
    loginCustomerId: connection.loginCustomerId,
    query: campaignDailyQuery(range),
  });
  if (!res.ok) {
    await recordGoogleAdsSync(companyId, { status: statusForKind(res.kind), error: res.message }, db);
    return { ok: false, kind: res.kind, message: res.message };
  }

  const rows = [];
  const errors = [];
  for (const raw of resultRows(res.data)) {
    const parsed = parseCampaignDayRow(raw, { currency: connection.currencyCode });
    if (parsed.status === "ok") rows.push(parsed.row);
    else errors.push(parsed.errors);
  }

  const company = await db.company.findUnique({ where: { id: companyId }, select: { currency: true } });
  const period = planWindow(rows);
  const existingSpend = period
    ? await db.marketingSpend.findMany({
        where: { companyId, platform: GOOGLE_PLATFORM, date: period },
        select: { id: true, source: true, externalId: true, platform: true, date: true, campaignName: true, campaignId: true },
      })
    : [];

  const plan = buildGoogleSpendPlan({
    rows,
    existingSpend,
    companyCurrency: company?.currency || null,
    source: SOURCE,
    // Always: the API never double-counts a day a report or a person already logged.
    skipPossibleDuplicates: true,
  });
  await writeGoogleSpendPlan(db, companyId, SOURCE, plan);
  await recordGoogleAdsSync(companyId, { status: "connected", error: null }, db);

  return {
    ok: true,
    window: range,
    summary: { ...plan.summary, errored: errors.length },
    possibleDuplicates: plan.possibleDuplicates.slice(0, 50),
    currencyMismatch: plan.currencyMismatch,
    errors: errors.slice(0, 20),
  };
}
