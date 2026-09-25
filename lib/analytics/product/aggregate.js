// lib/analytics/product/aggregate.js
//
// The arithmetic behind /platform/analytics and the sales card. Pure: every
// function takes rows shaped like AnalyticsDaily (date, surface, event, path,
// language, companyId, isDemo, count, uniqueVisitors) and returns plain
// objects. queries.js fetches; this file counts; the pages draw. The check
// script executes this file against hand-built rows, which is the only way
// the funnel maths and the 150-view gate get proved rather than eyeballed.
//
// ══ Absent is not zero ═════════════════════════════════════════════════════
//
// `uniqueVisitors` is null on a daily row until compaction fills it, and the
// console fills the raw window from AnalyticsEvent separately. Summing
// nulls as zeros would print "0 visitors" under a page with 400 views, so
// every aggregate here carries `uniqueVisitors: null` when NO row in the
// group knew, and a number only when at least one did — with `uniqueKnown`
// saying how many of the group's rows contributed.

import { SIGNUP_FUNNEL, SIGNUP_STEP_BAR, FEATURE_KEYS } from "./events";
import { APP_ROUTE_PATTERNS, featurePageFor } from "./appPages";

/** The sales portal shows product usage only past this many /app views. The owner's number. */
export const SALES_MIN_APP_VIEWS = 150;
export const SALES_TOP_N = 10;

export function excludeDemo(rows) {
  return rows.filter((r) => !r.isDemo);
}

function sumUniques(rows) {
  let total = 0;
  let known = 0;
  for (const r of rows) {
    if (Number.isInteger(r.uniqueVisitors)) {
      total += r.uniqueVisitors;
      known += 1;
    }
  }
  return { uniqueVisitors: known ? total : null, uniqueKnown: known };
}

/**
 * Group rows by one field and rank by count. `companies` is the number of
 * distinct companyIds behind the group (0 when the rows carry none).
 */
export function rankBy(rows, field, { limit = 25 } = {}) {
  const groups = new Map();
  for (const r of rows) {
    const k = r[field] ?? "";
    let g = groups.get(k);
    if (!g) {
      g = { key: k, count: 0, rows: [], companies: new Set() };
      groups.set(k, g);
    }
    g.count += Number(r.count) || 0;
    g.rows.push(r);
    if (r.companyId) g.companies.add(r.companyId);
  }
  return [...groups.values()]
    .sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)))
    .slice(0, limit)
    .map((g) => ({ key: g.key, count: g.count, companies: g.companies.size, ...sumUniques(g.rows) }));
}

/** Views per route pattern for one surface (page_view rows only). */
export function topPaths(rows, surface, { limit = 25 } = {}) {
  return rankBy(rows.filter((r) => r.surface === surface && r.event === "page_view"), "path", { limit });
}

/** Views by interface language for one surface, or for all when surface is null. */
export function byLanguage(rows, surface = null) {
  const pool = rows.filter((r) => r.event === "page_view" && (surface === null || r.surface === surface));
  return rankBy(pool, "language", { limit: 50 }).map((g) => ({ ...g, key: g.key || "unknown" }));
}

/** The dimension rows only the daily table carries: referrer, utm_campaign, utm_source, help_search, help_search_empty. */
export function dimension(rows, event, { surface = null, limit = 25 } = {}) {
  const pool = rows.filter((r) => r.event === event && (surface === null || r.surface === surface));
  return rankBy(pool, "path", { limit });
}

/** The furthest funnel bar (index into SIGNUP_FUNNEL) one visitor's evidence proves, or -1. */
export function furthestBar({ visited = false, steps = [], trial = false } = {}) {
  if (trial) return SIGNUP_FUNNEL.length - 1;
  let best = visited ? 0 : -1;
  for (const s of steps || []) {
    const bar = SIGNUP_STEP_BAR[s];
    const i = bar ? SIGNUP_FUNNEL.indexOf(bar) : -1;
    if (i > best) best = i;
  }
  return best;
}

/**
 * Per-visitor evidence → the funnel's counts, "reached this step OR LATER".
 *
 * ══ Why "or later" ═════════════════════════════════════════════════════════
 *
 * A visitor can prove a later step without the event for an earlier one: a
 * resume link lands them on Services (lib/signup/funnel.js resumeStep), Team
 * and Goals sent no beacon before 2026-09-25, and a company can be tied to a
 * browser whose step beacons were lost. Counting each step's own event made
 * "Services 13" sit above "Trades 8". Counting a visitor at every step up to
 * the furthest one they proved makes every bar ≤ the bar before it, by
 * construction — and says the same thing the builder's funnel report says
 * (lib/tracking/funnelSteps.js countSteps).
 *
 * ══ Who is in the population ═══════════════════════════════════════════════
 *
 * Browsers with a page view of /signup in the window. A browser that sent
 * signup steps but never a page view is NOT a visitor: before 2026-09-25 the
 * beacon skipped page views on localhost but not signup steps, so a
 * developer or the screenshot harness walking /signup against the production
 * database wrote steps with nobody behind them (16 browsers in the 30 days to
 * 2026-09-25). They are counted in `excluded`, never in a bar. A trial is
 * the one exception: a company that finished signup is a fact whatever the
 * beacon said, so a browser tied to one is counted even with no page view.
 *
 * @param visitors [{ visited: bool, steps: string[], trial: bool }]
 * @returns { counts: { [bar]: n }, stoppedAt: { [bar]: n }, excluded }
 */
export function funnelFromVisitors(visitors = []) {
  const counts = Object.fromEntries(SIGNUP_FUNNEL.map((k) => [k, 0]));
  const stoppedAt = Object.fromEntries(SIGNUP_FUNNEL.map((k) => [k, 0]));
  let excluded = 0;
  for (const v of visitors) {
    if (!v) continue;
    if (!v.visited && !v.trial) {
      if ((v.steps || []).length) excluded += 1;
      continue;
    }
    const far = furthestBar(v);
    if (far < 0) continue;
    for (let i = 0; i <= far; i += 1) counts[SIGNUP_FUNNEL[i]] += 1;
    stoppedAt[SIGNUP_FUNNEL[far]] += 1;
  }
  return { counts, stoppedAt, excluded };
}

/**
 * Daily counts (past the raw window) → bars that are still monotone: each
 * bar is the largest count at it or after it. Daily rows have no visitor, so
 * "reached or later" cannot be counted exactly; the running maximum is the
 * smallest monotone reading of the counts and the page labels it so.
 */
export function monotoneFromCounts(stepCounts = {}) {
  const out = {};
  let running = 0;
  for (let i = SIGNUP_FUNNEL.length - 1; i >= 0; i -= 1) {
    const k = SIGNUP_FUNNEL[i];
    running = Math.max(running, Number(stepCounts[k]) || 0);
    out[k] = running;
  }
  return out;
}

/**
 * The signup funnel: one bar per step with the drop-off from the step before.
 *
 * @param stepCounts   { [SIGNUP_FUNNEL key]: n } — already "reached or later"
 *                     (funnelFromVisitors / monotoneFromCounts), so a later
 *                     step never exceeds an earlier one
 * @param stoppedAt    { bar: visitors whose FURTHEST bar this was } from the
 *                     raw rows, or null when the window has no raw rows
 * @returns { steps: [{ key, count, dropFromPrevious, dropPct, ofFirstPct }],
 *            stoppedAt: [{ key, count, pct }] | null, basis }
 *
 * "Stopped at" leaves trial_started out: a visitor whose furthest step is a
 * trial did not stop.
 */
export function signupFunnel(stepCounts = {}, stoppedAt = null, basis = "visitors") {
  const steps = [];
  let prev = null;
  const first = Number(stepCounts[SIGNUP_FUNNEL[0]]) || 0;
  for (const key of SIGNUP_FUNNEL) {
    const count = Number(stepCounts[key]) || 0;
    const dropFromPrevious = prev === null ? null : Math.max(0, prev - count);
    const dropPct = prev === null || prev === 0 ? null : Math.round(((prev - count) / prev) * 1000) / 10;
    const ofFirstPct = first === 0 ? null : Math.round((count / first) * 1000) / 10;
    steps.push({ key, count, dropFromPrevious, dropPct, ofFirstPct });
    prev = count;
  }
  let stopped = null;
  if (stoppedAt && typeof stoppedAt === "object") {
    const keys = SIGNUP_FUNNEL.filter((k) => k !== "trial_started");
    const total = keys.reduce((n, k) => n + (Number(stoppedAt[k]) || 0), 0);
    stopped = keys.map((k) => {
      const count = Number(stoppedAt[k]) || 0;
      return { key: k, count, pct: total ? Math.round((count / total) * 1000) / 10 : null };
    });
  }
  return { steps, stoppedAt: stopped, basis };
}

/**
 * Product usage: every /app route pattern with its views and the number of
 * companies that opened it, most to least — and, separately, the patterns
 * with NO views in the window, which is the owner's "least used" answer.
 * Rows with a `feature_used` event are ranked alongside by feature key.
 *
 * @param rows  app-surface daily rows (already demo-filtered by the caller)
 * @param totalCompanies  how many companies could have used a page, for the
 *                        "3 of 40" reading; null when unknown
 */
export function featureUsage(rows, { totalCompanies = null } = {}) {
  const views = rankBy(rows.filter((r) => r.surface === "app" && r.event === "page_view"), "path", { limit: 10_000 });
  const seen = new Set(views.map((v) => v.key));
  const pages = views.map((v) => ({
    ...v,
    feature: featurePageFor(v.key),
    totalCompanies,
  }));
  const neverUsed = APP_ROUTE_PATTERNS.filter((p) => !seen.has(p)).map((p) => ({ key: p, feature: featurePageFor(p) }));

  const used = rankBy(rows.filter((r) => r.surface === "app" && r.event === "feature_used"), "path", { limit: 100 });
  const usedSeen = new Set(used.map((u) => u.key));
  const actions = FEATURE_KEYS.map((k) => used.find((u) => u.key === k) || { key: k, count: 0, companies: 0, uniqueVisitors: null, uniqueKnown: 0 })
    .sort((a, b) => b.count - a.count);
  const actionsNeverUsed = FEATURE_KEYS.filter((k) => !usedSeen.has(k));

  return { pages, neverUsed, actions, actionsNeverUsed, totalCompanies };
}

/**
 * Views grouped by FEATURE (the sidebar row), for the sales card — and the
 * gate: nothing is returned below SALES_MIN_APP_VIEWS total views, so a rep
 * never reads a top-ten drawn from a week of the owner's own clicks.
 *
 * Only `surface === "app"` page views count; marketing, help and client
 * pages cannot appear whatever the rows hold, and demo companies are
 * excluded here as well as by the caller, because this is the one figure
 * that leaves the console.
 */
export function salesTopFeatures(rows, { threshold = SALES_MIN_APP_VIEWS, limit = SALES_TOP_N } = {}) {
  const pool = rows.filter((r) => r.surface === "app" && r.event === "page_view" && !r.isDemo);
  const totalViews = pool.reduce((n, r) => n + (Number(r.count) || 0), 0);
  const eligible = totalViews >= threshold;
  if (!eligible) return { eligible: false, totalViews, threshold, items: [] };

  const groups = new Map();
  for (const r of pool) {
    const row = featurePageFor(r.path);
    if (!row) continue;
    let g = groups.get(row.href);
    if (!g) {
      g = { href: row.href, navKey: row.navKey, matrix: row.matrix, feature: row.feature, views: 0, companies: new Set() };
      groups.set(row.href, g);
    }
    g.views += Number(r.count) || 0;
    if (r.companyId) g.companies.add(r.companyId);
  }
  const items = [...groups.values()]
    .sort((a, b) => b.views - a.views || a.href.localeCompare(b.href))
    .slice(0, limit)
    .map((g, i) => ({ rank: i + 1, href: g.href, navKey: g.navKey, matrix: g.matrix, feature: g.feature, views: g.views, companies: g.companies.size }));
  return { eligible: true, totalViews, threshold, items };
}

/** One company's screens, most to least — read-only, for the console drill-down. */
export function companyScreens(rows, companyId) {
  const mine = rows.filter((r) => r.companyId === companyId && r.surface === "app");
  return {
    pages: rankBy(mine.filter((r) => r.event === "page_view"), "path", { limit: 200 }).map((p) => ({ ...p, feature: featurePageFor(p.key) })),
    actions: rankBy(mine.filter((r) => r.event === "feature_used"), "path", { limit: 50 }),
    languages: rankBy(mine.filter((r) => r.event === "page_view"), "language", { limit: 10 }),
  };
}

/** Views per UTC day for a sparkline, across whatever rows are handed in. */
export function perDay(rows, event = "page_view") {
  const days = new Map();
  for (const r of rows) {
    if (r.event !== event) continue;
    const d = (r.date instanceof Date ? r.date : new Date(r.date)).toISOString().slice(0, 10);
    days.set(d, (days.get(d) || 0) + (Number(r.count) || 0));
  }
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
}
