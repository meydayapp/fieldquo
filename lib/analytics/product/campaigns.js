// lib/analytics/product/campaigns.js
//
// FieldQuo's OWN ad campaigns on /platform/analytics: campaign ▸ ad set ▸ ad,
// with the landings each brought and what those people went on to do —
// signups started (the account submitted), trials started, paying.
//
// ══ Where each number comes from ═══════════════════════════════════════════
//
//   Views, visitors   AnalyticsEvent landings on the marketing site (a page
//                     view carrying source fields — the first view of a page
//                     load), inside the raw window. Their Meta parameters
//                     are meta.ad (lib/tracking/adParams.js compactAd); a
//                     landing from before 2026-09-25 has only the three utm
//                     columns, which are read the same way (a numeric
//                     utm_campaign is Meta's campaign id, name not sent).
//                     Days older than the raw window add campaign-level
//                     views from the daily utm_campaign rows, with no ad set
//                     or ad (the daily table never had them) and no visitor.
//   Conversions       SignupLead rows that STARTED in the range — the
//                     record the signup capture already keeps — each
//                     attributed to its FIRST AD TOUCH:
//                       1. utm.ft, stored on the row at capture time from
//                          the browser's own landings (firstTouchForVisitor);
//                       2. else the same thing read now from the raw window
//                          (a row captured before ft existed);
//                       3. else the three utm tags the /signup link carried.
//                     "First ad touch" is the earliest landing that named a
//                     campaign, ad set or ad; a browser with none is
//                     untagged. Signup started = got past the account step;
//                     trial started = the row's own company finished signup
//                     (subscriberBucket / hasFinishedSignup — the shared
//                     classification); paying = that company's bucket is
//                     "paying" today.
//
// No cookie, no IP, no new identifier: the anonymous id is the one the
// beacon already keeps (lib/analytics/track.js) and the capture already
// posts; the only thing added to storage is `ft` inside SignupLead.utm,
// a JSON column the row already had.

import { db } from "@/lib/db";
import { RAW_RETENTION_DAYS, utcDay, addUtcDays } from "./rollup";
import { cleanAdParams, expandAd, compactAd, hasAdIdentity } from "@/lib/tracking/adParams";
import { subscriberBucket, SUBSCRIBER_BOOK_SELECT } from "@/lib/platform/trialCounting";
import { hasFinishedSignup } from "@/lib/signup/abandoned";

export const CAMPAIGN_METRICS = Object.freeze(["views", "signups", "trials", "paying"]);

/** SignupLead.stepReached values that are past the account step. */
const PAST_ACCOUNT = new Set(["team", "goals", "industry", "services", "plan", "checkout"]);
const LANDING_CAP = 100_000;

/** The ad context of one stored landing row (AnalyticsEvent shape). */
export function adOfLanding(row) {
  if (!row || typeof row !== "object") return null;
  const meta = row.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : {};
  if (meta.ad) {
    const ad = expandAd(meta.ad);
    if (ad) return ad;
  }
  return cleanAdParams({ utm_source: row.utmSource, utm_medium: row.utmMedium, utm_campaign: row.utmCampaign });
}

/** Is this stored page view a landing (it carried source fields)? */
export function isLanding(row) {
  return Boolean(row?.meta && typeof row.meta === "object" && typeof row.meta.src === "string");
}

/**
 * The first ad touch of one browser's landings, or null when none of them
 * named a campaign / ad set / ad. Earliest first; ties keep input order.
 * Returns the compact form stored in SignupLead.utm.ft: compactAd fields plus
 * `src` (the one-word source) and `at` (the landing's ISO time).
 */
export function firstTouchOf(landings) {
  const sorted = (Array.isArray(landings) ? landings : [])
    .filter(isLanding)
    .map((r, i) => ({ r, i, t: new Date(r.createdAt).getTime() }))
    .sort((a, b) => (a.t - b.t) || (a.i - b.i));
  for (const { r } of sorted) {
    const ad = adOfLanding(r);
    if (ad && hasAdIdentity(ad)) {
      const compact = compactAd(ad) || {};
      return { ...compact, src: String(r.meta.src).slice(0, 40), at: new Date(r.createdAt).toISOString() };
    }
  }
  return null;
}

/**
 * Which campaign one signup belongs to, and on what evidence.
 * @returns { ad, basis: "stored" | "visitor" | "link" | null }
 */
export function leadAttribution(lead, landingsByVisitor = new Map()) {
  const utm = lead?.utm && typeof lead.utm === "object" && !Array.isArray(lead.utm) ? lead.utm : null;
  if (utm?.ft && typeof utm.ft === "object") {
    const ad = expandAd(utm.ft);
    if (ad && hasAdIdentity(ad)) return { ad, basis: "stored" };
  }
  if (lead?.visitorId && landingsByVisitor.has(lead.visitorId)) {
    const ft = firstTouchOf(landingsByVisitor.get(lead.visitorId));
    if (ft) return { ad: expandAd(ft), basis: "visitor" };
  }
  if (utm) {
    const ad = cleanAdParams({ utm_source: utm.utm_source, utm_medium: utm.utm_medium, utm_campaign: utm.utm_campaign });
    if (hasAdIdentity(ad)) return { ad, basis: "link" };
  }
  return { ad: null, basis: null };
}

/**
 * What one signup counts for in the table.
 *
 * No "include demo" switch here, deliberately: a demo company is seeded, it
 * never walks /signup (so it has no SignupLead), and hasFinishedSignup is
 * false for one by definition — a switch would be a control that changes
 * nothing. The page's toggle still governs every table it governed before.
 */
export function leadOutcome(lead, now = new Date()) {
  const company = lead?.completedCompany || null;
  const own = Boolean(lead?.completedCompanyId) && lead?.skipReason !== "company_exists";
  let trial = false;
  let paying = false;
  if (own && company && !company.isDemo && company.subscription !== undefined && hasFinishedSignup(company)) {
    trial = true;
    paying = subscriberBucket(company, now) === "paying";
  }
  const signup = trial || own || PAST_ACCOUNT.has(lead?.stepReached);
  return { signup, trial, paying };
}

const adFields = (ad) => ({
  campaignId: ad?.campaignId || null,
  campaignName: ad?.campaignName || null,
  adsetId: ad?.adsetId || null,
  adsetName: ad?.adsetName || null,
  adId: ad?.adId || null,
  adName: ad?.adName || null,
});

function rank(map) {
  return [...map].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/**
 * The whole report, pure: landings + older daily campaign rows + signups →
 * rows for groupAdRows, plus the Meta-parameter breakdowns.
 *
 * @param landings      AnalyticsEvent landing rows in the range's raw part
 * @param dailyCampaign [{ path, count }] utm_campaign daily rows for days
 *                      older than the raw window (campaign level only)
 * @param leads         SignupLead rows started in the range (with
 *                      completedCompany selected)
 * @param visitorLandings Map visitorId → landings, the whole raw window, for
 *                      leads without a stored first touch
 */
export function campaignRows({ landings = [], dailyCampaign = [], leads = [], visitorLandings = new Map(), now = new Date() } = {}) {
  const rows = [];
  const placements = new Map();
  const siteSources = new Map();
  const mediums = new Map();
  let fbclidLandings = 0;
  let paramLandings = 0;
  let adLandings = 0;
  for (const l of landings) {
    if (!isLanding(l)) continue;
    const ad = adOfLanding(l);
    rows.push({ ...adFields(ad), visitorId: l.visitorId || null, metrics: { views: 1 } });
    if (ad?.placement) placements.set(ad.placement, (placements.get(ad.placement) || 0) + 1);
    if (ad?.siteSource) siteSources.set(ad.siteSource, (siteSources.get(ad.siteSource) || 0) + 1);
    if (ad?.utmMedium) mediums.set(ad.utmMedium.toLowerCase(), (mediums.get(ad.utmMedium.toLowerCase()) || 0) + 1);
    // fbclid PRESENCE is only known for a landing that carried meta.ad (the
    // beacon since 2026-09-25). An older landing folded it into `src` and
    // cannot be told apart from utm_source=facebook, so it is not counted
    // either way — the page says "of N", never "of all landings".
    if (l.meta?.ad) {
      paramLandings += 1;
      if (ad?.hasFbclid) fbclidLandings += 1;
    }
    if (hasAdIdentity(ad)) adLandings += 1;
  }
  for (const d of dailyCampaign) {
    const ad = cleanAdParams({ utm_campaign: d.path });
    rows.push({ ...adFields(ad), visitorId: null, metrics: { views: Number(d.count) || 0 } });
  }
  const basis = { stored: 0, visitor: 0, link: 0, none: 0 };
  for (const lead of leads) {
    const { ad, basis: b } = leadAttribution(lead, visitorLandings);
    basis[b || "none"] += 1;
    const o = leadOutcome(lead, now);
    rows.push({ ...adFields(ad), visitorId: null, metrics: { signups: o.signup ? 1 : 0, trials: o.trial ? 1 : 0, paying: o.paying ? 1 : 0 } });
  }
  return {
    rows,
    breakdowns: {
      placements: rank(placements),
      siteSources: rank(siteSources),
      mediums: rank(mediums),
      fbclidLandings,
      paramLandings,
      adLandings,
      landings: landings.filter(isLanding).length,
    },
    attributionBasis: basis,
  };
}

// ── Reads ───────────────────────────────────────────────────────────────────

function rawFrom(start, now = new Date()) {
  const cutoff = addUtcDays(utcDay(now), -RAW_RETENTION_DAYS);
  return start > cutoff ? start : cutoff;
}

const LANDING_SELECT_SQL = (from, end) => db.$queryRaw`
  SELECT "createdAt", "visitorId", "utmSource", "utmMedium", "utmCampaign", meta
  FROM "AnalyticsEvent"
  WHERE "createdAt" >= ${from} AND "createdAt" < ${end}
    AND event = 'page_view' AND surface = 'marketing' AND "isDemo" = false
    AND meta IS NOT NULL AND meta ? 'src'
  ORDER BY "createdAt" ASC
  LIMIT ${LANDING_CAP}`;

/**
 * Everything the campaign table needs for [start, end). Read-only.
 * `daily` is the route's already-loaded daily rows (demo-filtered).
 */
export async function loadCampaignReport({ start, end, daily = [], now = new Date() } = {}) {
  const from = rawFrom(start, now);
  const windowStart = rawFrom(new Date(0), now);
  const [landings, leads] = await Promise.all([
    from < end ? LANDING_SELECT_SQL(from, end) : Promise.resolve([]),
    db.signupLead.findMany({
      where: { startedAt: { gte: start, lt: end } },
      select: {
        id: true, startedAt: true, stepReached: true, visitorId: true, utm: true, completedCompanyId: true, skipReason: true,
        completedCompany: { select: { isDemo: true, createdAt: true, trialEndsAt: true, subscription: SUBSCRIBER_BOOK_SELECT.subscription } },
      },
    }),
  ]);
  // Leads with no stored first touch: their browser's landings across the
  // whole raw window (a landing can precede the range the signup started in).
  const needVisitor = [...new Set(leads.filter((l) => l.visitorId && !l.utm?.ft).map((l) => l.visitorId))];
  const visitorLandings = new Map();
  if (needVisitor.length) {
    const rows = await db.$queryRaw`
      SELECT "createdAt", "visitorId", "utmSource", "utmMedium", "utmCampaign", meta
      FROM "AnalyticsEvent"
      WHERE "createdAt" >= ${windowStart} AND "visitorId" = ANY(${needVisitor})
        AND event = 'page_view' AND surface = 'marketing' AND meta IS NOT NULL AND meta ? 'src'`;
    for (const r of rows) {
      if (!visitorLandings.has(r.visitorId)) visitorLandings.set(r.visitorId, []);
      visitorLandings.get(r.visitorId).push(r);
    }
  }
  const dailyCampaign = daily
    .filter((r) => r.surface === "marketing" && r.event === "utm_campaign" && utcDay(r.date) < from)
    .map((r) => ({ path: r.path, count: r.count }));
  return {
    ...campaignRows({ landings, dailyCampaign, leads, visitorLandings, now }),
    rawFrom: from.toISOString().slice(0, 10),
    olderDaysFromDaily: from > start,
    truncated: landings.length >= LANDING_CAP,
  };
}

/**
 * The first ad touch of one browser, for the signup capture to keep on its
 * SignupLead (lib/signup/salesFloor.js captureSignupLead). Takes the client
 * so the capture's checks can hand in a fake; answers null — never throws —
 * when the analytics table is absent, the browser has no landing in the raw
 * window, or none of its landings named a campaign.
 */
export async function firstTouchForVisitor(client, visitorId, now = new Date()) {
  try {
    if (!visitorId || typeof client?.analyticsEvent?.findMany !== "function") return null;
    const rows = await client.analyticsEvent.findMany({
      where: {
        visitorId,
        event: "page_view",
        surface: "marketing",
        createdAt: { gte: addUtcDays(utcDay(now), -RAW_RETENTION_DAYS) },
      },
      select: { createdAt: true, utmSource: true, utmMedium: true, utmCampaign: true, meta: true },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return firstTouchOf(rows);
  } catch (err) {
    console.error("[analytics] first touch not read:", err?.message || err);
    return null;
  }
}
