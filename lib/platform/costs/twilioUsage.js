// lib/platform/costs/twilioUsage.js
//
// Pull Twilio's Usage Records into PlatformCostDaily.
//
// ══ Once an hour, three days back ════════════════════════════════════════
//
// Twilio's daily usage for a day is complete a few hours after the day ends
// and can be revised for a couple of days after that (a recording billed on
// completion, a number's rent posted on its anniversary). So the pull is not
// "today": it is the last USAGE_LOOKBACK_DAYS, every hour, and the upsert
// replaces each (day, category). The hour comes from the ledger itself —
// the newest `fetchedAt` — rather than from a cron minute, so a missed tick
// is caught up by the next one and a page's "Pull now" is the same call.
//
// ══ One request per category ═════════════════════════════════════════════
//
// Twilio's daily list with no category returns every category it knows,
// most of them zero, paginated. Ten named requests for the categories in
// TWILIO_USAGE_CATEGORIES is smaller and lands only what the page prints.
import { db } from "@/lib/db";
import { twilioRest, twilioConfigured } from "@/lib/sms/twilioClient";
import { recordError } from "@/lib/platform/errorLog";
import { TWILIO_USAGE_CATEGORIES, dayDate, dayKey, normaliseTwilioUsage } from "./dailyLedger";
import { lastPullAt, writeDailyRows } from "./ledgerWrite";

export { writeDailyRows };

export const USAGE_LOOKBACK_DAYS = 3;
export const USAGE_MAX_AGE_MS = 60 * 60 * 1000;
/** A first pull, or a "Pull now" with a range, may go this far back. */
export const USAGE_MAX_RANGE_DAYS = 93;

/**
 * Pull [from, to] inclusive, by category, and write it.
 *
 * @returns {{ ok, from, to, records, rows, written, dropped, failed: string[] }}
 */
export async function pullTwilioUsage({ from, to, client = db, twilio = twilioRest, now = new Date() } = {}) {
  if (!twilioConfigured()) return { ok: false, reason: "twilio_not_configured", records: 0, rows: 0, written: 0, dropped: 0, failed: [] };
  const endKey = dayKey(to || now);
  const startKey = dayKey(from || new Date(now.getTime() - USAGE_LOOKBACK_DAYS * 86_400_000));
  if (!startKey || !endKey) return { ok: false, reason: "bad_range", records: 0, rows: 0, written: 0, dropped: 0, failed: [] };
  const span = (dayDate(endKey) - dayDate(startKey)) / 86_400_000;
  if (span < 0 || span > USAGE_MAX_RANGE_DAYS) return { ok: false, reason: "range_too_wide", records: 0, rows: 0, written: 0, dropped: 0, failed: [] };

  const records = [];
  const failed = [];
  for (const category of TWILIO_USAGE_CATEGORIES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const list = await twilio.usage.records.daily.list({ category, startDate: startKey, endDate: endKey, limit: 200 });
      for (const rec of list || []) records.push(rec);
    } catch (err) {
      failed.push(category);
      // eslint-disable-next-line no-await-in-loop
      await recordError({
        area: "platform_costs",
        code: "twilio_usage_failed",
        message: `Twilio usage for ${category} (${startKey}..${endKey}) could not be read: ${err?.message || err}`,
      }).catch(() => {});
    }
  }
  const { rows, dropped } = normaliseTwilioUsage(records, { fetchedAt: now });
  const written = await writeDailyRows(rows, { client });
  return { ok: failed.length < TWILIO_USAGE_CATEGORIES.length, from: startKey, to: endKey, records: records.length, rows: rows.length, written, dropped, failed };
}

/** When the Twilio ledger was last fed. Null when never. */
export async function lastTwilioPullAt({ client = db } = {}) {
  return lastPullAt("twilio", { client });
}

/**
 * The cron's entry: pull when the newest row is older than USAGE_MAX_AGE_MS
 * or there is none. A first-ever pull takes thirty days so the page has a
 * month to show rather than three days and a promise.
 */
export async function pullTwilioUsageIfStale({ client = db, twilio = twilioRest, now = new Date(), maxAgeMs = USAGE_MAX_AGE_MS } = {}) {
  const last = await lastTwilioPullAt({ client });
  if (last && now.getTime() - new Date(last).getTime() < maxAgeMs) {
    return { pulled: false, lastPullAt: last };
  }
  const from = last ? undefined : new Date(now.getTime() - 30 * 86_400_000);
  const result = await pullTwilioUsage({ from, client, twilio, now });
  return { pulled: true, lastPullAt: last, ...result };
}
