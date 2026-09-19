// lib/platform/costs/providerPulls.js
//
// One pull per provider per day, from the cron that already pulls Twilio.
//
// ══ The cadence, and why the ledger decides it ═══════════════════════════
//
// Twilio is pulled hourly because Twilio revises a day for days
// (twilioUsage.js). OpenAI, Neon and Stripe each get ONE pull a day: their
// figures for a finished day do not move, and each pull is a handful of
// requests against a metered API. "A day" is measured from the provider's
// newest `fetchedAt` in PlatformCostDaily, not from a cron minute, so a
// missed tick is caught up by the next and a page's "Pull now" is the same
// call as the cron's. Each pull covers the last PULL_LOOKBACK_DAYS so a
// provider that posts a day late is still caught; the first pull ever takes
// thirty days (Neon's daily granularity allows sixty), so the page has a
// month to show rather than three days.
//
// ══ A failure names its provider ═════════════════════════════════════════
//
// Every failed pull lands in PlatformErrorLog under area "platform_costs"
// with the provider in the code ("openai_pull_failed"), so /platform/errors
// says WHICH bill stopped arriving. A provider whose key is not set is not a
// failure and is not logged: the page prints "waiting for <VAR>" for it.
import { db } from "@/lib/db";
import { recordError } from "@/lib/platform/errorLog";
import { dayDate, dayKey } from "./dailyLedger";
import { lastPullsByProvider } from "./ledgerWrite";
import { OPENAI_COSTS_SOURCE, openaiAdminConfigured, pullOpenaiCosts } from "./openaiCosts";
import { NEON_DAILY_MAX_DAYS, NEON_SOURCE, neonConfigured, pullNeonConsumption } from "./neonConsumption";
import { STRIPE_FEES_SOURCE, pullStripeFees, stripeFeesConfigured } from "./stripeFees";

export const PULL_LOOKBACK_DAYS = 3;
export const PULL_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const FIRST_PULL_DAYS = 30;
/** A "Pull now" with a range may go this far back (Neon's daily limit is the tightest). */
export const PULL_MAX_RANGE_DAYS = NEON_DAILY_MAX_DAYS;

/**
 * The providers pulled daily. `envVar` is what the page names when the
 * provider is not configured; `source` is what its rows carry.
 */
export const DAILY_PROVIDERS = Object.freeze({
  openai: { label: "OpenAI", envVar: "OPENAI_ADMIN_API_KEY", source: OPENAI_COSTS_SOURCE, configured: openaiAdminConfigured, pull: pullOpenaiCosts },
  neon: { label: "Neon", envVar: "NEON_API_KEY", source: NEON_SOURCE, configured: neonConfigured, pull: pullNeonConsumption },
  stripe: { label: "Stripe", envVar: "STRIPE_SECRET_KEY", source: STRIPE_FEES_SOURCE, configured: stripeFeesConfigured, pull: pullStripeFees },
});

/** Which of the daily providers have their key, and which are waiting. Pure over process.env. */
export function providerConfiguration() {
  const out = {};
  for (const [key, p] of Object.entries(DAILY_PROVIDERS)) out[key] = { configured: p.configured(), envVar: p.envVar, label: p.label };
  return out;
}

/**
 * Pull one provider for [from, to], bounded; failures are logged with the
 * provider named and returned, never thrown, so one provider's outage does
 * not stop the next one's pull.
 */
export async function pullProvider(provider, { from, to, client = db, now = new Date(), deps = {} } = {}) {
  const p = DAILY_PROVIDERS[provider];
  if (!p) return { ok: false, provider, reason: "unknown_provider", records: 0, rows: 0, written: 0, dropped: 0 };
  if (!p.configured()) return { ok: false, provider, reason: "not_configured", envVar: p.envVar, records: 0, rows: 0, written: 0, dropped: 0 };
  const endKey = dayKey(to || now);
  const startKey = dayKey(from || new Date(now.getTime() - PULL_LOOKBACK_DAYS * 86_400_000));
  if (!startKey || !endKey) return { ok: false, provider, reason: "bad_range", records: 0, rows: 0, written: 0, dropped: 0 };
  const span = (dayDate(endKey) - dayDate(startKey)) / 86_400_000;
  if (span < 0 || span > PULL_MAX_RANGE_DAYS) return { ok: false, provider, reason: "range_too_wide", records: 0, rows: 0, written: 0, dropped: 0 };
  try {
    const result = await p.pull({ from: dayDate(startKey), to: dayDate(endKey), client, now, ...deps });
    return { provider, ...result };
  } catch (err) {
    await recordError({
      area: "platform_costs",
      code: `${provider}_pull_failed`,
      message: `${p.label} costs for ${startKey}..${endKey} could not be pulled: ${err?.message || err}`,
    }).catch(() => {});
    return { ok: false, provider, reason: "failed", error: err?.message || String(err), from: startKey, to: endKey, records: 0, rows: 0, written: 0, dropped: 0 };
  }
}

/**
 * The cron's entry: for each configured daily provider whose newest row is
 * older than PULL_MAX_AGE_MS (or absent), pull. One groupBy read a tick
 * when nothing is due.
 */
export async function pullDailyProvidersIfStale({ client = db, now = new Date(), maxAgeMs = PULL_MAX_AGE_MS, deps = {} } = {}) {
  const last = await lastPullsByProvider({ client });
  const out = {};
  for (const provider of Object.keys(DAILY_PROVIDERS)) {
    const p = DAILY_PROVIDERS[provider];
    if (!p.configured()) {
      out[provider] = { pulled: false, reason: "not_configured", envVar: p.envVar };
      continue;
    }
    const at = last[provider] ? new Date(last[provider]).getTime() : null;
    if (at !== null && now.getTime() - at < maxAgeMs) {
      out[provider] = { pulled: false, lastPullAt: last[provider] };
      continue;
    }
    const from = at === null ? new Date(now.getTime() - FIRST_PULL_DAYS * 86_400_000) : undefined;
    // eslint-disable-next-line no-await-in-loop
    out[provider] = { pulled: true, lastPullAt: last[provider] || null, ...(await pullProvider(provider, { from, client, now, deps: deps[provider] || {} })) };
  }
  return out;
}
