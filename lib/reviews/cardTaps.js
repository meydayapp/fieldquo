// lib/reviews/cardTaps.js
//
// "23 taps from the van sticker": the card_tap counts a company sees on
// Settings → Reviews, per source, over the last thirty days.
//
// Two tables, because the analytics store keeps raw rows for
// RAW_RETENTION_DAYS and folds older days into AnalyticsDaily — but the
// daily upsert in recordRows() already increments the day's count at write
// time, so AnalyticsDaily alone carries the whole window and the raw table
// is not read at all. One query, grouped by path (the source).
//
// Takes `db` so the check can hand in the memory fixture.

import { db as realDb } from "@/lib/db";
import { CARD_SOURCES } from "./card";

const DAY = 24 * 60 * 60 * 1000;

/**
 * @returns {{ total: number, bySource: { [source]: number }, days: number }}
 *          every source present with 0 when nothing was recorded, so the
 *          screen can print a row per surface the company actually printed.
 */
export async function cardTapCounts(companyId, { days = 30, now = new Date(), db = realDb } = {}) {
  const bySource = Object.fromEntries(CARD_SOURCES.map((s) => [s, 0]));
  const out = { total: 0, bySource, days };
  if (!companyId || !db?.analyticsDaily || typeof db.analyticsDaily.findMany !== "function") return out;

  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - days));
  let rows = [];
  try {
    rows = await db.analyticsDaily.findMany({
      where: { companyId, event: "card_tap", date: { gte: since } },
      select: { path: true, count: true },
    });
  } catch {
    // The table is additive; the day it is not pushed yet is a zero, not a 500.
    return out;
  }
  for (const row of rows) {
    const source = CARD_SOURCES.includes(row.path) ? row.path : "other";
    const n = Number(row.count) || 0;
    bySource[source] += n;
    out.total += n;
  }
  return out;
}
