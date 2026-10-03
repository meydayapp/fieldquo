// lib/marketing/fxRefresh.js
//
// Fetch each pair's newest daily rate from the Bank of Canada Valet API and
// store it — the owner's 2026-10-03 decision to automate what lib/marketing/
// fx.js used to ask a human to re-read every month.
//
// ══ The source ═════════════════════════════════════════════════════════════
//
// https://www.bankofcanada.ca/valet/observations/FX<BASE><QUOTE>/json?recent=5
// Free, no key, published on Canadian business days (~16:30 ET). The same URL
// the checked-in rate was read from, so a fetched rate and a hand-read one are
// the same series. `recent=5` rather than 1: on a holiday Monday the newest
// observation is still Friday's, and reading a few lets the parser take the
// newest one present instead of failing on an empty list.
//
// ══ Failure is a log line, never a wrong number ════════════════════════════
//
// Every way this can fail — network, HTTP status, a JSON shape that changed, a
// value that is not a positive number, a value implausibly far from the last
// known rate — writes NOTHING and records a `fx_refresh_failed` row on
// /platform/errors. The converters keep using the newest good rate
// (lib/marketing/fxLive.js), and /platform counts the days since the last
// success. A plausibility band (half to double the fallback) is there because a
// unit change upstream (a rate quoted per 100 units, say) would otherwise be
// stored and silently multiply every company's ad spend.
//
// Writes are upserts keyed on (base, quote, rateDate): running twice in a day
// stores one row and refreshes its fetchedAt — which is what "the update is
// working" is measured by.

import { db as defaultDb } from "@/lib/db";
import { recordError as defaultRecordError } from "@/lib/platform/errorLog";
import { RATES } from "@/lib/marketing/fx";
import { FX_PAIRS, clearLiveRatesCache } from "@/lib/marketing/fxLive";

export const VALET_BASE = "https://www.bankofcanada.ca/valet/observations";
export const VALET_SOURCE_NAME = (base, quote) => `Bank of Canada, daily average ${base}/${quote} (series FX${base}${quote})`;
export const FETCH_TIMEOUT_MS = 15_000;

export function valetUrl(base, quote, recent = 5) {
  return `${VALET_BASE}/FX${base}${quote}/json?recent=${recent}`;
}

/**
 * The newest observation in a Valet response, or a reason it has none. Pure.
 * @returns {{ ok: true, rate: number, rateDate: string } | { ok: false, reason: string }}
 */
export function parseValet(json, { base, quote }) {
  const series = `FX${base}${quote}`;
  const obs = Array.isArray(json?.observations) ? json.observations : null;
  if (!obs) return { ok: false, reason: "response has no observations list" };
  const usable = obs
    .map((o) => ({ d: o?.d, v: o?.[series]?.v }))
    .filter((o) => /^\d{4}-\d{2}-\d{2}$/.test(String(o.d || "")) && o.v !== undefined && o.v !== null && o.v !== "")
    .map((o) => ({ rateDate: o.d, rate: Number(o.v) }))
    .filter((o) => Number.isFinite(o.rate) && o.rate > 0)
    .sort((a, b) => (a.rateDate < b.rateDate ? 1 : -1));
  if (!usable.length) return { ok: false, reason: `no usable ${series} observation in the response` };
  return { ok: true, ...usable[0] };
}

/** Is a fetched value within a believable distance of the last known rate? Pure. */
export function plausible(rate, reference) {
  const r = Number(reference);
  if (!Number.isFinite(r) || r <= 0) return true;
  return rate >= r / 2 && rate <= r * 2;
}

/**
 * Fetch and store every pair. Never throws.
 *
 * @param deps  { prisma, fetchImpl, recordError, now } — seams for
 *              scripts/check-fx-refresh.mjs, which never touches the network.
 * @returns {Promise<Array<{ pair, ok, rate?, rateDate?, reason? }>>}
 */
export async function refreshRates({
  prisma = defaultDb,
  fetchImpl = globalThis.fetch,
  recordError = defaultRecordError,
  now = new Date(),
} = {}) {
  const results = [];
  for (const { base, quote } of FX_PAIRS) {
    const pair = `${base}/${quote}`;
    const url = valetUrl(base, quote);
    const fail = async (reason, detail = {}) => {
      results.push({ pair, ok: false, reason });
      await recordError({
        area: "cron",
        code: "fx_refresh_failed",
        message: `Exchange rate ${pair} was not updated: ${reason}. Conversions keep using the last good rate.`,
        detail: { url, ...detail },
      });
    };

    let json;
    try {
      const res = await fetchImpl(url, {
        headers: { accept: "application/json" },
        signal: typeof AbortSignal !== "undefined" && AbortSignal.timeout ? AbortSignal.timeout(FETCH_TIMEOUT_MS) : undefined,
      });
      if (!res?.ok) {
        await fail(`the Valet API answered HTTP ${res?.status ?? "?"}`, { status: res?.status ?? null });
        continue;
      }
      json = await res.json();
    } catch (err) {
      await fail(`the Valet API could not be reached (${err?.name || "error"})`, { error: String(err?.message || err).slice(0, 200) });
      continue;
    }

    const parsed = parseValet(json, { base, quote });
    if (!parsed.ok) {
      await fail(parsed.reason);
      continue;
    }
    const reference = RATES.find((r) => r.base === base && r.quote === quote)?.rate;
    if (!plausible(parsed.rate, reference)) {
      await fail(`the fetched rate ${parsed.rate} is not within half to double of ${reference}`, { fetched: parsed.rate, reference });
      continue;
    }

    try {
      const rateDate = new Date(`${parsed.rateDate}T00:00:00Z`);
      await prisma.exchangeRate.upsert({
        where: { base_quote_rateDate: { base, quote, rateDate } },
        create: {
          base,
          quote,
          rate: parsed.rate,
          rateDate,
          source: valetUrl(base, quote, 1),
          sourceName: VALET_SOURCE_NAME(base, quote),
          fetchedAt: now,
        },
        update: { rate: parsed.rate, fetchedAt: now },
      });
      results.push({ pair, ok: true, rate: parsed.rate, rateDate: parsed.rateDate });
    } catch (err) {
      await fail(`the rate could not be stored (${String(err?.message || err).split("\n")[0].slice(0, 160)})`);
    }
  }
  clearLiveRatesCache();
  return results;
}
