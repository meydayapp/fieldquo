// lib/googleAds/spendPlan.js
//
// Google Ads spend rows → a MarketingSpend write plan. Pure — no db, no
// fetch. ONE planner for both ways Google spend arrives:
//
//   source "google_ads_csv"  a report the contractor downloaded and uploaded
//                            (lib/googleAds/reportParse.js) — works today,
//                            with no Google approval of anything
//   source "google_ads_api"  the daily sync over the Google Ads API
//                            (lib/googleAds/sync.js), once FieldQuo's
//                            developer token is approved
//
// Two writers, one set of rules, so the CSV and the API cannot disagree
// about what "the same row" or "a duplicate" means. The rules are
// lib/meta/insightsImport.js's, and its header argues each one; in short:
//
// 1. Never writes MarketingSpend.leads. Google's "Conversions" is Google's
//    count of its own tag firing — it goes into `.conversions` (rounded, the
//    column is an Int) and `.conversionsExact` (Google reports 2.5 under
//    data-driven attribution), labelled "Google's conversions" on screen.
//    FieldQuo's leads from Google are counted from LeadRequest rows that
//    arrived with a gclid (lib/analytics/googleAdsRollup.js), never from here.
// 2. Never converts a currency at write time. `currency` is written only when
//    the account's currency differs from the company's (null = the company's
//    own), and lib/analytics/spendCurrency.js converts at read time.
// 3. Never overwrites a row it did not write. Updates are matched by
//    (source, externalId) — a manual row, a Meta row, and a row written by
//    the OTHER Google source are invisible to the update path by construction.
// 4. A row that looks like spend already on file from another source (a
//    hand-typed "Google" entry for that campaign and day, or the CSV and the
//    API both covering the same day) is a POSSIBLE DUPLICATE. Unlike the Meta
//    sync — which imports and flags — Google rows that collide are skipped
//    when `skipPossibleDuplicates` is set: the API sync always sets it and
//    the CSV import defaults to it, because the whole reason to import
//    Google spend is the per-channel cost per lead, and a double-counted day
//    halves the honesty of that number. Nothing already on file is changed
//    either way; the person can delete the older rows on the Spend page and
//    import again.
//
// The platform is MarketingPlatform `google` — the value the manual "Log
// spend" form has always offered as "Google". A separate enum value would
// have split one channel into two rows on the Spend page and made a
// hand-typed Google entry invisible to the duplicate check below.

import { naturalKey } from "@/lib/meta/insightsImport";
import { campaignNameKey } from "./reportParse";
import { GOOGLE_SOURCES } from "./sources";

export { GOOGLE_SOURCES };

export const GOOGLE_PLATFORM = "google";
const RANGE_RE = /:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/;

function dayOf(date) {
  if (date instanceof Date && !Number.isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  if (typeof date === "string" && /^\d{4}-\d{2}-\d{2}/.test(date)) return date.slice(0, 10);
  return null;
}

/** The period an existing or new row covers: one day, or the range in its externalId. */
function periodOf({ externalId, date }) {
  const m = typeof externalId === "string" ? RANGE_RE.exec(externalId) : null;
  if (m) return { start: m[1], end: m[2], isRange: true };
  const d = dayOf(date);
  return d ? { start: d, end: d, isRange: false } : null;
}

function overlaps(a, b) {
  return a && b && a.start <= b.end && b.start <= a.end;
}

/** The campaign identities a row answers to: its Google id, and its name. */
function campaignKeys(row) {
  const keys = [];
  if (row.campaignId) keys.push(`id:${row.campaignId}`);
  const n = campaignNameKey(row.campaignName);
  if (n) keys.push(`name:${n}`);
  return keys;
}

/**
 * @param {object} p
 * @param {object[]} p.rows            parsed rows: { externalKey, campaignId,
 *                                     campaignName, date "YYYY-MM-DD",
 *                                     amount, clicks, impressions,
 *                                     conversions, currency, objective? }
 * @param {object[]} p.existingSpend   this company's MarketingSpend rows in
 *                                     and around the period: { id, source,
 *                                     externalId, platform, date,
 *                                     campaignName, campaignId }
 * @param {string}   p.companyCurrency Company.currency
 * @param {"google_ads_csv"|"google_ads_api"} p.source
 * @param {boolean}  p.skipPossibleDuplicates
 */
export function buildGoogleSpendPlan({ rows, existingSpend, companyCurrency, source, skipPossibleDuplicates = true }) {
  if (!GOOGLE_SOURCES.includes(source)) throw new Error(`buildGoogleSpendPlan: unknown source "${source}"`);
  const incoming = Array.isArray(rows) ? rows : [];
  const existing = (Array.isArray(existingSpend) ? existingSpend : []).filter(Boolean);

  const ours = new Map();
  for (const row of existing) {
    if (row.source === source && row.externalId) ours.set(row.externalId, row);
  }

  // Every Google-platform row that is not this exact (source, externalId),
  // by campaign identity, for the collision checks.
  const googleRows = existing.filter((r) => r.platform === GOOGLE_PLATFORM);

  const toCreate = [];
  const toUpdate = [];
  const possibleDuplicates = [];
  const skipped = [];
  const currencies = new Set();

  for (const r of incoming) {
    const date = dayOf(r.date);
    if (!date || !r.externalKey) continue;
    const currency = r.currency || null;
    if (currency) currencies.add(currency);
    const rowCurrency = currency && companyCurrency && currency !== companyCurrency ? currency : null;
    const exact = r.conversions === null || r.conversions === undefined ? null : Math.round(Number(r.conversions) * 100) / 100;
    const data = {
      platform: GOOGLE_PLATFORM,
      source,
      externalId: r.externalKey,
      campaignId: r.campaignId || null,
      campaignName: r.campaignName || null,
      objective: r.objective || null,
      amount: Math.round(Number(r.amount) * 100) / 100,
      impressions: r.impressions ?? null,
      clicks: r.clicks ?? null,
      conversions: exact === null ? null : Math.round(exact),
      conversionsExact: exact,
      date: new Date(`${date}T00:00:00Z`),
      currency: rowCurrency,
    };

    const prior = ours.get(r.externalKey);
    if (prior) {
      toUpdate.push({ id: prior.id, data });
      continue;
    }

    // ── Collisions ─────────────────────────────────────────────────────────
    const myPeriod = periodOf({ externalId: r.externalKey, date });
    const myKeys = new Set(campaignKeys(r));
    const natural = naturalKey({ platform: GOOGLE_PLATFORM, date, campaignName: r.campaignName });
    const matches = [];
    for (const e of googleRows) {
      if (e.source === source && e.externalId === r.externalKey) continue;
      const theirPeriod = periodOf(e);
      // Same campaign by id or name, on an overlapping period — the CSV and
      // the API covering the same day, a monthly CSV and a daily one, or a
      // hand-typed Google entry for that campaign on that day.
      const sameCampaign = campaignKeys(e).some((k) => myKeys.has(k));
      if (sameCampaign && overlaps(myPeriod, theirPeriod)) {
        // Two rows of THIS source on different single days are not a
        // collision; two of this source where one is a range are.
        if (e.source === source && !myPeriod.isRange && !theirPeriod.isRange) continue;
        matches.push(e);
        continue;
      }
      // The source-blind natural key — the same test the Meta import runs.
      if (e.source !== source && naturalKey({ platform: e.platform, date: e.date, campaignName: e.campaignName }) === natural) {
        matches.push(e);
      }
    }

    if (matches.length) {
      const entry = {
        externalId: r.externalKey,
        campaignName: r.campaignName || null,
        date,
        amount: data.amount,
        currency,
        matches: matches.map((m) => ({ id: m.id, source: m.source })),
      };
      possibleDuplicates.push(entry);
      if (skipPossibleDuplicates) {
        skipped.push(entry);
        continue;
      }
    }
    toCreate.push(data);
  }

  return {
    toCreate,
    toUpdate,
    possibleDuplicates,
    skipped,
    currencyMismatch: [...currencies].some((c) => companyCurrency && c !== companyCurrency),
    currencies: [...currencies].sort(),
    summary: {
      totalRows: incoming.length,
      created: toCreate.length,
      updated: toUpdate.length,
      possibleDuplicates: possibleDuplicates.length,
      skipped: skipped.length,
    },
  };
}

/**
 * The date window a plan's existing-row query must cover so every collision
 * above can be seen: the incoming period widened to the start of any range
 * row that could reach into it. Ranges are at most a year in practice; the
 * caller pads by that much on the low side.
 */
export function planWindow(rows, { padDays = 370 } = {}) {
  let min = null;
  let max = null;
  for (const r of Array.isArray(rows) ? rows : []) {
    const p = periodOf({ externalId: r.externalKey, date: r.date });
    if (!p) continue;
    if (!min || p.start < min) min = p.start;
    if (!max || p.end > max) max = p.end;
  }
  if (!min || !max) return null;
  const gte = new Date(`${min}T00:00:00Z`);
  gte.setUTCDate(gte.getUTCDate() - padDays);
  return { gte, lte: new Date(`${max}T23:59:59.999Z`) };
}
