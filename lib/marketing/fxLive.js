// lib/marketing/fxLive.js
//
// The rate list the converters actually use: the newest fetched ExchangeRate
// row per pair, else the checked-in rate in lib/marketing/fx.js.
//
// ══ Why a merge and not "the table, or nothing" ═══════════════════════════
//
// The owner's rule for the automatic rate (2026-10-03): a fetch failure is a
// line on /platform/errors, never a broken conversion. So every reader goes
// through mergeRates(), which can only ever IMPROVE on the checked-in list:
//
//   • a stored row replaces a pair's fallback only when it is a usable rate
//     (positive, dated, not dated after today) AND is no older than the
//     fallback. A table that stopped updating in August never beats a
//     constant someone re-read in October.
//   • an empty table, a missing table (the deploy landed before the CREATE
//     TABLE), an unreadable one or a timed-out query all leave the fallback
//     list exactly as it is — the same numbers the product used before this
//     file existed.
//
// The rules a rate is judged by (dated, sourced, refused past 45 days) are
// fx.js's, applied by its rateRefusal() to whichever rate wins here. A stored
// row carries the same fields a checked-in one does, so nothing downstream can
// tell them apart except `live: true`.

import { db as defaultDb } from "@/lib/db";
import { RATES } from "@/lib/marketing/fx";

/** Pairs the product converts — whatever fx.js holds a rate for. */
export const FX_PAIRS = Object.freeze(RATES.map((r) => Object.freeze({ base: r.base, quote: r.quote })));

/** Days without a successful fetch before /platform says the update is failing.
 *  The cron runs daily, so two quiet days is one missed run plus slack. */
export const FETCH_FAILING_AFTER_DAYS = 2;

const DAY = 86400000;
const isoDay = (d) => {
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.toISOString().slice(0, 10);
};

/** A stored ExchangeRate row as a fx.js rate object, or null when unusable. */
export function rateFromRow(row, { fallback = null, asOf = new Date() } = {}) {
  if (!row) return null;
  const rate = Number(row.rate);
  const rateDate = isoDay(row.rateDate);
  if (!Number.isFinite(rate) || rate <= 0 || !rateDate) return null;
  // A rate dated after today is a bad row, not a fresh one (fx.js's own rule).
  const today = isoDay(asOf);
  if (today && rateDate > today) return null;
  if (!(typeof row.source === "string" && row.source.startsWith("https://"))) return null;
  return Object.freeze({
    base: row.base,
    quote: row.quote,
    rate,
    rateDate,
    readOn: isoDay(row.fetchedAt) || rateDate,
    source: row.source,
    sourceName: row.sourceName,
    readBy: "fetched automatically by /api/cron/fx-refresh (lib/marketing/fxRefresh.js) from the Bank of Canada Valet API",
    caveat: fallback?.caveat || "a central bank daily average, not a rate you can transact at — a card adds a spread on top",
    live: true,
    fetchedAt: row.fetchedAt ? new Date(row.fetchedAt).toISOString() : null,
  });
}

/**
 * The fallback list with each pair replaced by its newest stored row when that
 * row is usable and at least as new. Pure.
 *
 * @param {object[]} stored  newest ExchangeRate row per pair (any order, extras ignored)
 */
export function mergeRates({ stored = [], fallback = RATES, asOf = new Date() } = {}) {
  return fallback.map((f) => {
    const row = (stored || []).find((r) => r && r.base === f.base && r.quote === f.quote);
    const live = rateFromRow(row, { fallback: f, asOf });
    if (!live) return f;
    return live.rateDate >= f.rateDate ? live : f;
  });
}

/**
 * How the automatic update is doing, per pair. Pure.
 *
 * `failingDays` counts whole days since the last SUCCESSFUL fetch (fetchedAt),
 * so a weekend — when Friday's rate stays the newest — is not a failure.
 * `neverRan` is a table with no row for the pair at all.
 */
export function refreshHealth({ stored = [], asOf = new Date() } = {}) {
  const now = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  return FX_PAIRS.map((p) => {
    const row = (stored || []).find((r) => r && r.base === p.base && r.quote === p.quote);
    const fetched = row?.fetchedAt ? new Date(row.fetchedAt).getTime() : null;
    const daysSince = fetched !== null && Number.isFinite(fetched) ? Math.floor((now - fetched) / DAY) : null;
    return {
      pair: `${p.base}/${p.quote}`,
      neverRan: !row,
      lastFetchedAt: fetched !== null ? new Date(fetched).toISOString() : null,
      daysSinceFetch: daysSince,
      failing: !row || (daysSince !== null && daysSince >= FETCH_FAILING_AFTER_DAYS),
    };
  });
}

/** The newest stored row for each pair. Throws on a database error — callers decide. */
export async function latestStoredRates(prisma = defaultDb) {
  const rows = await Promise.all(
    FX_PAIRS.map((p) =>
      prisma.exchangeRate.findFirst({
        where: { base: p.base, quote: p.quote },
        orderBy: { rateDate: "desc" },
      }),
    ),
  );
  return rows.filter(Boolean);
}

// A short per-instance cache: getMarketingRollup runs on every Spend page and
// KPI load, and the rate changes once a day.
export const LIVE_RATES_CACHE_MS = 5 * 60 * 1000;
let cached = null;
export function clearLiveRatesCache() {
  cached = null;
}

/**
 * The rate list to convert with — never throws, never returns fewer pairs than
 * fx.js holds. `{ rates, stored, source: "live" | "fallback", error }`.
 */
export async function loadLiveRates({ prisma = defaultDb, asOf = new Date(), useCache = true } = {}) {
  const at = asOf instanceof Date ? asOf : new Date(asOf);
  if (useCache && cached && Date.now() - cached.at < LIVE_RATES_CACHE_MS) {
    return { ...cached.value, rates: mergeRates({ stored: cached.value.stored, asOf: at }) };
  }
  let stored = [];
  let error = null;
  try {
    stored = await latestStoredRates(prisma);
  } catch (err) {
    // The table may not exist yet (deployed before the CREATE TABLE ran), or
    // the database blinked. Either way the checked-in rate is used — the
    // numbers the product printed before this file existed.
    error = err?.message || String(err);
  }
  const rates = mergeRates({ stored, asOf: at });
  const value = { rates, stored, source: rates.some((r) => r.live) ? "live" : "fallback", error };
  if (useCache && !error) cached = { at: Date.now(), value };
  return value;
}
