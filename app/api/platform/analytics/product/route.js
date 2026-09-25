// app/api/platform/analytics/product/route.js
//
// The report behind /platform/analytics: where fieldquo.com's traffic goes,
// the signup funnel, what the help centre is asked, which /app screens are
// used and by how many companies, what the client-facing pages convert, and
// one company's screens on request.
//
//   GET ?range=7|30|90&demo=0|1&company=<id>
//
// Superadmin and platform admin. Support is not admitted: the per-company
// drill-down names a customer's screens, which is a fact about a customer
// and not a lookup. Read-only, like every route in this console
// (non-negotiable #3): nothing here writes a row anywhere.
//
// One route rather than five so the page's date range and demo toggle are
// applied to every section by the same two lines and cannot drift between
// tabs.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/platform/currentPlatformAdmin";
import {
  RANGES, rangeFor, dailyRows, rawUniques, mergeUniques, signupVisitors, signupsCompleted,
  rawUniquesByPath, clientConversions, companyDenominator, companyNames,
} from "@/lib/analytics/product/queries";
import {
  excludeDemo, topPaths, byLanguage, dimension, signupFunnel, monotoneFromCounts, featureUsage,
  companyScreens, perDay, salesTopFeatures,
} from "@/lib/analytics/product/aggregate";
import { SIGNUP_FUNNEL, SIGNUP_STEP_BAR, FEATURES } from "@/lib/analytics/product/events";
import { loadCampaignReport, CAMPAIGN_METRICS } from "@/lib/analytics/product/campaigns";
import { groupAdRows, META_URL_PARAMETERS, META_URL_PARAMETERS_DOC } from "@/lib/tracking/adParams";
import { RAW_RETENTION_DAYS } from "@/lib/analytics/product/rollup";
import { db } from "@/lib/db";
import { countUnplacedSignups } from "@/lib/signup/salesFloor";

const ALLOWED_ROLES = new Set(["superadmin", "admin"]);

export async function GET(request) {
  const admin = await getCurrentPlatformAdmin(request);
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED_ROLES.has(admin.role)) {
    return NextResponse.json({ error: "Only superadmins and platform admins can read product analytics" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const range = rangeFor(searchParams.get("range"));
  const includeDemo = searchParams.get("demo") === "1";
  const companyId = String(searchParams.get("company") || "").trim() || null;

  const [dailyAll, uniques, funnelRaw, conversions, totalCompanies, rangeUniques, completedInRange] = await Promise.all([
    dailyRows({ start: range.start, end: range.end }),
    rawUniques({ start: range.start, end: range.end }),
    signupVisitors({ start: range.start, end: range.end }),
    clientConversions({ start: range.start, end: range.end, includeDemo }),
    companyDenominator({ includeDemo }),
    rawUniquesByPath({ start: range.start, end: range.end }),
    signupsCompleted({ start: range.start, end: range.end }),
  ]);
  const merged = mergeUniques(dailyAll, uniques);
  const rows = includeDemo ? merged : excludeDemo(merged);

  // ── Visitors per page: one browser once for the whole range ────────────
  //
  // rankBy sums the per-day uniques, so a person who came back on a second
  // day is two "visitors" — /signup read 58 while the funnel, which counts a
  // browser once, read 56. When the raw rows cover the whole range the
  // range-wide distinct count replaces the sum; when they do not (90 days, a
  // year) the sum stays and `uniquesBasis` tells the page to label it.
  const uniquesBasis = rangeUniques && rangeUniques.from <= range.start ? "range" : "per-day";
  const rangeUniqueByKey = new Map();
  if (uniquesBasis === "range") {
    for (const r of rangeUniques.rows) {
      if (!includeDemo && r.isDemo) continue;
      const k = `${r.surface}|${r.path}`;
      rangeUniqueByKey.set(k, (rangeUniqueByKey.get(k) || 0) + r.uniqueVisitors);
    }
  }
  const withRangeUniques = (list, surface) =>
    uniquesBasis === "range"
      ? list.map((p) => ({ ...p, uniqueVisitors: rangeUniqueByKey.get(`${surface}|${p.key}`) ?? p.uniqueVisitors }))
      : list;

  // ── Marketing ─────────────────────────────────────────────────────────
  const marketing = {
    pages: withRangeUniques(topPaths(rows, "marketing", { limit: 25 }), "marketing"),
    languages: byLanguage(rows, "marketing"),
    // One word per landing — facebook / instagram / google / direct — with
    // click ids folded in, because the Facebook app sends no referrer.
    traffic: dimension(rows, "source", { surface: "marketing" }),
    referrers: dimension(rows, "referrer", { surface: "marketing" }),
    sources: dimension(rows, "utm_source", { surface: "marketing" }),
    perDay: perDay(rows.filter((r) => r.surface === "marketing")),
  };

  // The funnel: distinct visitors when the raw window covers the range,
  // else daily counts (labelled as such — a count is a ceiling on visitors).
  //
  // Either way every bar is "reached this step or later", so no bar can read
  // higher than the one before it (aggregate.js funnelFromVisitors) — the
  // owner's screenshot had "Account & company 581" over "Visited 565".
  let funnel;
  if (funnelRaw && funnelRaw.from <= range.start) {
    funnel = signupFunnel(funnelRaw.counts, funnelRaw.stoppedAt, "visitors");
    funnel.excluded = funnelRaw.excluded;
    funnel.companiesFinished = funnelRaw.companiesFinished;
    funnel.companiesLinked = funnelRaw.companiesLinked;
  } else {
    const counts = Object.fromEntries(SIGNUP_FUNNEL.map((k) => [k, 0]));
    for (const r of rows) {
      if (r.event === "page_view" && r.path === "/signup") counts.visited += r.count;
      else if (r.event === "signup_step" && SIGNUP_STEP_BAR[r.path]) counts[SIGNUP_STEP_BAR[r.path]] += r.count;
    }
    // Trial started is a company on every basis — completedSignupWhere,
    // never a beacon (see signupsCompleted). Past the raw window no browser
    // can be tied to it, so the bar is the companies themselves.
    counts.trial_started = completedInRange;
    funnel = signupFunnel(monotoneFromCounts(counts), funnelRaw ? funnelRaw.stoppedAt : null, "events");
    funnel.companiesFinished = completedInRange;
    funnel.companiesLinked = null;
    if (funnelRaw) funnel.stoppedAtFrom = funnelRaw.from.toISOString().slice(0, 10);
  }

  // ── Campaigns: campaign ▸ ad set ▸ ad, with what they led to ───────────
  //
  // lib/analytics/product/campaigns.js says where each column comes from.
  // A failure here costs the table, not the page.
  let campaigns = null;
  try {
    // Marketing landings are never a demo company's and a demo has no
    // SignupLead, so the demo toggle cannot move this table (campaigns.js
    // leadOutcome says why no switch is threaded through).
    const report = await loadCampaignReport({ start: range.start, end: range.end, daily: rows });
    const grouped = groupAdRows(report.rows, CAMPAIGN_METRICS, { sortKey: "views" });
    campaigns = {
      metrics: CAMPAIGN_METRICS,
      campaigns: grouped.campaigns.slice(0, 50),
      totalCampaigns: grouped.campaigns.length,
      untagged: grouped.untagged,
      breakdowns: report.breakdowns,
      attributionBasis: report.attributionBasis,
      rawFrom: report.rawFrom,
      olderDaysFromDaily: report.olderDaysFromDaily,
      truncated: report.truncated,
      urlParameters: META_URL_PARAMETERS,
      urlParametersDoc: META_URL_PARAMETERS_DOC,
    };
  } catch (err) {
    console.error("[platform/analytics] campaign report failed:", err?.message || err);
  }

  // ── The people behind the Trades drop ───────────────────────────────────
  //
  // The funnel counts browsers; lib/signup/leads.js keeps what they typed.
  // Beside the drop: how many SignupLeads in this range never became a
  // company, how many of those left a phone number, and how many are hot
  // leads nobody has placed yet (countUnplacedSignups — the same rows the
  // review folder's section lists). Demo-free by construction: a demo has
  // no SignupLead.
  let signupLeads = null;
  try {
    const now = new Date();
    const open = { startedAt: { gte: range.start, lt: range.end }, completedCompanyId: null };
    const [started, pastAccount, withPhone, hotWaiting] = await Promise.all([
      db.signupLead.count({ where: open }),
      // Of those, how many got past the account step — the funnel's
      // "Account submitted" bar, as people rather than browsers.
      db.signupLead.count({ where: { ...open, stepReached: { in: ["team", "goals", "industry", "services", "plan", "checkout"] } } }),
      db.signupLead.count({ where: { ...open, phoneE164: { not: null } } }),
      countUnplacedSignups({ client: db, now, hotOnly: true }),
    ]);
    signupLeads = { started, pastAccount, withPhone, hotWaiting, reviewHref: "/platform/sales/review?signups=hot", signupsHref: "/platform/signups" };
  } catch (err) {
    console.error("[platform/analytics] signup leads count failed:", err?.message || err);
  }
  funnel.signupLeads = signupLeads;

  // ── Help centre ───────────────────────────────────────────────────────
  const help = {
    articles: withRangeUniques(topPaths(rows, "help", { limit: 25 }), "help"),
    searches: dimension(rows, "help_search", { surface: "help" }),
    searchesEmpty: dimension(rows, "help_search_empty", { surface: "help" }),
    languages: byLanguage(rows, "help"),
  };

  // ── Product ───────────────────────────────────────────────────────────
  const appRows = rows.filter((r) => r.surface === "app");
  const usage = featureUsage(appRows, { totalCompanies });
  const product = {
    ...usage,
    languages: byLanguage(rows, "app"),
    perDay: perDay(appRows),
    featureWriters: FEATURES,
    salesGate: (() => {
      const g = salesTopFeatures(appRows);
      return { eligible: g.eligible, totalViews: g.totalViews, threshold: g.threshold };
    })(),
    companiesSeen: [...new Set(appRows.map((r) => r.companyId).filter(Boolean))].length,
  };

  // ── Client-facing ─────────────────────────────────────────────────────
  const clientPages = withRangeUniques(topPaths(rows, "client", { limit: 50 }), "client");
  const sum = (prefixes) =>
    clientPages.filter((p) => prefixes.some((pre) => p.key === pre || p.key.startsWith(`${pre}/`))).reduce((n, p) => n + p.count, 0);
  const client = {
    pages: clientPages,
    languages: byLanguage(rows, "client"),
    surfaces: [
      { key: "quote_approval", views: sum(["/q", "/quote"]), outcome: "approved", outcomes: conversions.approved },
      { key: "booking", views: sum(["/book"]), outcome: "booked", outcomes: conversions.booked },
      { key: "portal", views: sum(["/portal"]), outcome: "paid", outcomes: conversions.paid },
      { key: "website", views: sum(["/site"]), outcome: "live_sites", outcomes: conversions.sitesLive },
    ],
  };

  // ── One company, on request ───────────────────────────────────────────
  let company = null;
  if (companyId) {
    const names = await companyNames([companyId]);
    const meta = names.get(companyId) || null;
    company = { id: companyId, name: meta?.name || null, isDemo: Boolean(meta?.isDemo), ...companyScreens(merged, companyId) };
  }
  const seenIds = [...new Set(merged.filter((r) => r.surface === "app" && r.companyId).map((r) => r.companyId))];
  const names = await companyNames(seenIds);
  const companies = seenIds
    .map((id) => ({ id, name: names.get(id)?.name || id, isDemo: Boolean(names.get(id)?.isDemo) }))
    .filter((c) => includeDemo || !c.isDemo)
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    range: { days: range.days, start: range.start.toISOString().slice(0, 10), end: range.end.toISOString().slice(0, 10), options: RANGES },
    uniquesBasis,
    includeDemo,
    rawRetentionDays: RAW_RETENTION_DAYS,
    totals: {
      views: rows.filter((r) => r.event === "page_view").reduce((n, r) => n + r.count, 0),
      bySurface: Object.fromEntries(
        ["marketing", "help", "app", "sales", "platform", "client"].map((s) => [
          s, rows.filter((r) => r.surface === s && r.event === "page_view").reduce((n, r) => n + r.count, 0),
        ]),
      ),
    },
    marketing,
    campaigns,
    funnel,
    help,
    product,
    client,
    companies,
    company,
  });
}
