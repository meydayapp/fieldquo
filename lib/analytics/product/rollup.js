// lib/analytics/product/rollup.js
//
// How raw hits become the daily table, and what compaction may and may not do.
//
// ══ Two tables, one rule each ══════════════════════════════════════════════
//
// AnalyticsEvent is the raw hit: one row per page view, step, search or
// feature use, kept for RAW_RETENTION_DAYS. AnalyticsDaily is the count per
// (day, surface, event, path, language, company, demo) and is what every
// screen reads — the console never scans raw rows for a number a count
// answers. Both are written in the same transaction by store.js, so a daily
// count and the raw rows behind it cannot disagree by a failed second write.
//
// The daily table also carries DIMENSION rows the raw row already holds as
// columns: a page view from a referrer adds a `referrer` row keyed on the
// host, a UTM-tagged landing adds `utm_campaign` / `utm_source` rows, and a
// help search that found nothing adds `help_search_empty`. That is how "views
// by referrer over 90 days" can be answered after the raw rows are gone.
//
// ══ Compaction, and the one deletion this product makes ════════════════════
//
// Nothing in FieldQuo deletes a customer's data (AGENTS.md; the owner's
// standing rule). Analytics hits are not a customer's data — they are
// FieldQuo's own measurement of its pages — and keeping every one for ever is
// a table that grows by ~150k rows a month for nothing a count did not already
// say. So the nightly cron (app/api/cron/analytics-compact) does, per UTC day
// older than the retention window:
//
//   1. read that day's raw rows;
//   2. write the one figure only raw rows can give — distinct visitors per
//      daily key — onto the daily rows (SET, never added: the counts were
//      incremented at write time and must not be counted twice), creating a
//      daily row only where none exists;
//   3. delete that day's raw rows, by createdAt range, from AnalyticsEvent
//      and nothing else.
//
// compactionPlan() below is the pure half: it takes a day's rows and returns
// the daily writes and the delete WHERE. The check script asserts the plan
// never names another model and never deletes outside the day it aggregated.

import { SURFACES } from "./routes";

export const RAW_RETENTION_DAYS = 30;

/** The unit separator: refused in every input, so a key cannot be forged by a path containing it. */
const SEP = "\u001f";

/** Midnight UTC of the day a timestamp falls in. */
export function utcDay(at) {
  const d = at instanceof Date ? at : new Date(at);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function addUtcDays(day, n) {
  return new Date(day.getTime() + n * 86_400_000);
}

/** The unique key of one daily row. Every field is bounded and control-free by the time it gets here. */
export function dailyKey({ date, surface, event, path, language, companyId, isDemo }) {
  return [
    utcDay(date).toISOString().slice(0, 10),
    surface,
    event,
    path,
    language || "",
    companyId || "",
    isDemo ? "1" : "0",
  ].join(SEP);
}

/**
 * The daily increments a set of raw rows produce: one entry per key with the
 * count to add, plus the dimension rows. Pure; store.js turns each entry into
 * an upsert with `count: { increment }`.
 *
 * @param rows  row-shaped objects as store.js writes them (event, surface,
 *              path, language, companyId, isDemo, referrerHost, utm*, meta,
 *              createdAt)
 * @returns Map<key, { date, surface, event, path, language, companyId, isDemo, count }>
 */
export function rollup(rows) {
  const out = new Map();
  const add = (fields) => {
    const key = dailyKey(fields);
    const cur = out.get(key);
    if (cur) cur.count += 1;
    else out.set(key, { key, ...fields, date: utcDay(fields.date), count: 1 });
  };
  for (const r of rows) {
    if (!SURFACES.includes(r.surface)) continue;
    const base = {
      date: r.createdAt,
      surface: r.surface,
      language: r.language || "",
      companyId: r.companyId || null,
      isDemo: Boolean(r.isDemo),
    };
    add({ ...base, event: r.event, path: r.path });
    if (r.event === "page_view") {
      if (r.referrerHost) add({ ...base, event: "referrer", path: r.referrerHost });
      if (r.meta?.src) add({ ...base, event: "source", path: r.meta.src });
      if (r.utmCampaign) add({ ...base, event: "utm_campaign", path: r.utmCampaign });
      if (r.utmSource) add({ ...base, event: "utm_source", path: r.utmSource });
    }
    if (r.event === "help_search" && (r.meta?.results ?? 0) === 0) {
      add({ ...base, event: "help_search_empty", path: r.path });
    }
  }
  return out;
}

/**
 * Distinct visitors per daily key for one day's raw rows. Only the primary
 * event row of each hit carries a visitor; dimension rows do not get one
 * (a referrer's "unique visitors" is a number nobody asked for and a count
 * that would be wrong the moment two campaigns shared a host).
 *
 * @returns Map<key, { fields, uniqueVisitors, count }>
 */
export function distinctVisitors(rows) {
  const out = new Map();
  for (const r of rows) {
    if (!SURFACES.includes(r.surface)) continue;
    const fields = {
      date: utcDay(r.createdAt),
      surface: r.surface,
      event: r.event,
      path: r.path,
      language: r.language || "",
      companyId: r.companyId || null,
      isDemo: Boolean(r.isDemo),
    };
    const key = dailyKey(fields);
    let cur = out.get(key);
    if (!cur) {
      cur = { key, fields, visitors: new Set(), count: 0 };
      out.set(key, cur);
    }
    cur.count += 1;
    if (r.visitorId) cur.visitors.add(r.visitorId);
  }
  return new Map(
    [...out].map(([key, v]) => [key, { key, fields: v.fields, count: v.count, uniqueVisitors: v.visitors.size }]),
  );
}

/**
 * The plan for one UTC day: what to write onto AnalyticsDaily and exactly
 * what to delete. `day` is midnight UTC; every row handed in must fall inside
 * it — a row from another day is refused, because deleting a range wider than
 * what was aggregated is how a count goes missing.
 */
export function compactionPlan(day, rows) {
  const start = utcDay(day);
  const end = addUtcDays(start, 1);
  for (const r of rows) {
    const at = new Date(r.createdAt).getTime();
    if (!(at >= start.getTime() && at < end.getTime())) {
      throw new Error(`compactionPlan: row ${r.id || "?"} is outside ${start.toISOString().slice(0, 10)}`);
    }
  }
  const uniques = distinctVisitors(rows);
  return {
    day: start,
    // Dimension rows have no visitor figure; only primary keys are written.
    writes: [...uniques.values()].map((u) => ({
      key: u.key,
      fields: u.fields,
      uniqueVisitors: u.uniqueVisitors,
      // Used ONLY when the daily row is missing (a write-time transaction
      // that never happened). An existing row keeps its own count.
      countIfMissing: u.count,
    })),
    deleteWhere: { model: "analyticsEvent", createdAt: { gte: start, lt: end } },
    rowsRead: rows.length,
  };
}

/** The first UTC day still kept raw, for a clock. Everything before it may be compacted. */
export function retentionCutoff(now = new Date(), keepDays = RAW_RETENTION_DAYS) {
  return addUtcDays(utcDay(now), -keepDays);
}
