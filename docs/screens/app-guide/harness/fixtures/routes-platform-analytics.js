// docs/screens/app-guide/harness/fixtures/routes-platform-analytics.js
//
// /platform/analytics' one route, for the "adtrack-" frames (2026-09-25):
// the card-free signup funnel and FieldQuo's own ad campaigns.
//
// Built by the SHIPPED pure functions — funnelFromVisitors / signupFunnel
// for the funnel, groupAdRows for the campaign table, cleanAdParams for
// every landing — over synthetic browsers shaped like production's last 30
// days (574 visitors on /signup, 16 laptop browsers with steps and no page
// view, 6 companies finished of which 3 are tied to a browser; Meta's
// automatic parameters for one campaign, the "+"-encoded twin of another)
// plus what the owner's new Ads Manager string will send. The figure shows
// what the code does with that shape; it is not a copy of the live numbers.
import { funnelFromVisitors, signupFunnel } from "@/lib/analytics/product/aggregate";
import { cleanAdParams, groupAdRows, META_URL_PARAMETERS, META_URL_PARAMETERS_DOC } from "@/lib/tracking/adParams";

const isAdtrack = (ctx) => /^adtrack-platform/.test(ctx.screen?.slug || "");

function funnel() {
  const visitors = [];
  for (let i = 0; i < 571; i += 1) visitors.push({ visited: true, steps: [] });
  for (let i = 0; i < 16; i += 1) visitors.push({ visited: false, steps: ["account", "services"] });
  visitors.push({ visited: true, steps: ["team", "goals", "trades"] });
  visitors.push({ visited: true, steps: ["team", "goals", "trades", "services"] });
  visitors.push({ visited: true, steps: ["services"] }); // a resume link straight onto Services
  for (let i = 0; i < 2; i += 1) visitors.push({ visited: true, steps: ["team", "goals", "trades", "services", "finish"], trial: true });
  visitors.push({ visited: false, steps: [], trial: true });
  const f = funnelFromVisitors(visitors);
  return {
    ...signupFunnel(f.counts, f.stoppedAt, "visitors"),
    excluded: f.excluded,
    companiesFinished: 6,
    companiesLinked: 3,
    signupLeads: { started: 6, pastAccount: 3, withPhone: 5, hotWaiting: 2, reviewHref: "/platform/sales/review?signups=hot", signupsHref: "/platform/signups" },
  };
}

function campaigns() {
  const rows = [];
  const land = (n, raw, visitorsEvery = 1) => {
    const ad = cleanAdParams(raw);
    for (let i = 0; i < n; i += 1) rows.push({ ...ad, visitorId: `${JSON.stringify(raw)}-${Math.floor(i / visitorsEvery)}`, metrics: { views: 1 } });
  };
  const signup = (raw, { trial = false, paying = false } = {}) => rows.push({ ...cleanAdParams(raw), visitorId: null, metrics: { signups: 1, trials: trial ? 1 : 0, paying: paying ? 1 : 0 } });
  // What production holds today: Meta's automatic parameters (id only) and
  // the same campaign name spelled two ways.
  land(540, { utm_source: "ig", utm_medium: "paid", utm_campaign: "120254631999170581" }, 1.03);
  land(414, { utm_source: "fb", utm_medium: "paid", utm_campaign: "120254631999170581" }, 1.03);
  land(85, { utm_source: "facebook", utm_medium: "paid", utm_campaign: "new+traffic+campaign" });
  land(78, { utm_source: "facebook", utm_medium: "paid", utm_campaign: "new traffic campaign" });
  // What the owner's Ads Manager string sends from today.
  const spring = (adset, adsetId, ad, adId, ss, pl) => ({
    utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "Spring%20Painters%20%E2%80%94%20Free%20Trial", utm_term: adset, utm_content: ad,
    campaign_id: "120254700000000001", adset_id: adsetId, ad_id: adId, placement: pl, site_source_name: ss,
  });
  land(96, spring("Ontario%20painters%2025-55", "120254700000000011", "Before%20%2F%20after%20video", "120254700000000111", "ig", "instagram_reels"));
  land(41, spring("Ontario%20painters%2025-55", "120254700000000011", "Quote%20in%2060%20seconds", "120254700000000112", "fb", "facebook_feed"));
  land(22, spring("Retarget%20site%20visitors", "120254700000000012", "Before%20%2F%20after%20video", "120254700000000121", "ig", "instagram_stories"));
  signup(spring("Ontario%20painters%2025-55", "120254700000000011", "Before%20%2F%20after%20video", "120254700000000111", "ig", "instagram_reels"), { trial: true });
  signup(spring("Ontario%20painters%2025-55", "120254700000000011", "Before%20%2F%20after%20video", "120254700000000111", "ig", "instagram_reels"));
  signup(spring("Retarget%20site%20visitors", "120254700000000012", "Before%20%2F%20after%20video", "120254700000000121", "ig", "instagram_stories"), { trial: true, paying: true });
  // Untagged: direct, organic, a shared link.
  for (let i = 0; i < 497; i += 1) rows.push({ visitorId: `u-${i % 280}`, metrics: { views: 1 } });
  for (let i = 0; i < 3; i += 1) rows.push({ visitorId: null, metrics: { signups: 1, trials: i === 0 ? 1 : 0, paying: 0 } });
  const g = groupAdRows(rows, ["views", "signups", "trials", "paying"], { sortKey: "views" });
  return {
    metrics: ["views", "signups", "trials", "paying"],
    campaigns: g.campaigns,
    totalCampaigns: g.campaigns.length,
    untagged: g.untagged,
    breakdowns: {
      placements: [{ key: "instagram_reels", count: 96 }, { key: "facebook_feed", count: 41 }, { key: "instagram_stories", count: 22 }],
      siteSources: [{ key: "ig", count: 118 }, { key: "fb", count: 41 }],
      mediums: [{ key: "paid", count: 1117 }, { key: "paid_social", count: 159 }],
      fbclidLandings: 152,
      paramLandings: 159,
      adLandings: 1276,
      landings: 1773,
    },
    attributionBasis: { stored: 3, visitor: 0, link: 0, none: 10 },
    rawFrom: "2026-08-27",
    olderDaysFromDaily: false,
    truncated: false,
    urlParameters: META_URL_PARAMETERS,
    urlParametersDoc: META_URL_PARAMETERS_DOC,
  };
}

const rank = (pairs) => pairs.map(([key, count, uniqueVisitors = null]) => ({ key, count, companies: 0, uniqueVisitors, uniqueKnown: uniqueVisitors === null ? 0 : 1 }));

export const ROUTES_PLATFORM_ANALYTICS = [
  {
    path: "/api/platform/analytics/product",
    method: "GET",
    reply: (ctx) => {
      if (!isAdtrack(ctx)) return ctx.next();
      return {
        range: { days: 30, start: "2026-08-27", end: "2026-09-26", options: [1, 7, 30, 90, 365] },
        uniquesBasis: "range",
        includeDemo: false,
        rawRetentionDays: 30,
        totals: { views: 5734, bySurface: { marketing: 2980, help: 212, app: 2104, client: 301, sales: 88, platform: 49 } },
        marketing: {
          pages: rank([["/", 1650, 1190], ["/signup", 640, 574], ["/pricing", 402, 311], ["/features", 188, 150]]),
          languages: rank([["en", 2710, 1802], ["fr", 190, 140], ["es", 80, 61]]),
          traffic: rank([["facebook", 705], ["instagram", 518], ["direct", 363], ["google", 15]]),
          referrers: rank([["facebook.com", 651], ["instagram.com", 573], ["google.com", 15]]),
          sources: rank([["facebook", 322], ["ig", 540], ["fb", 414]]),
          perDay: [],
        },
        campaigns: campaigns(),
        funnel: funnel(),
        help: { articles: [], searches: [], searchesEmpty: [], languages: [] },
        product: { pages: [], neverUsed: [], actions: [], actionsNeverUsed: [], totalCompanies: 6, languages: [], perDay: [], featureWriters: {}, salesGate: { eligible: false, totalViews: 0, threshold: 150 }, companiesSeen: 0 },
        client: { pages: [], languages: [], surfaces: [] },
        companies: [],
        company: null,
      };
    },
  },
];
