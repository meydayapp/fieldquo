// docs/screens/app-guide/harness/fixtures/routes-adtracking.js
//
// A contractor's own Meta ad tracking (2026-09-25): Leads › Visits &
// unfinished with the campaign ▸ ad set ▸ ad table, and Settings › Instant
// quotes › Ad tracking with the ad-link builder. Scoped to slugs starting
// "adtrack-"; every other screen falls through.
//
// The report is built by the SHIPPED pure functions (countSteps,
// buildCampaignReport, redactCampaignReport) from fixture visits and leads —
// the same arithmetic the route runs — so a frame cannot show a total the
// code would not produce. "-restricted" in a slug answers as a member
// without prices.
import { countSteps, reportSteps } from "@/lib/tracking/funnelSteps";
import { buildCampaignReport, redactCampaignReport } from "@/lib/tracking/campaignReport";
import { cleanAdParams, compactAd } from "@/lib/tracking/adParams";

const slugOf = (ctx) => ctx.screen?.slug || "";
const isAdtrack = (ctx) => slugOf(ctx).startsWith("adtrack-");

const NOW = new Date("2026-09-25T15:00:00Z");
const daysAgo = (n) => new Date(NOW.getTime() - n * 86400000);
const ad = (q) => compactAd(cleanAdParams(Object.fromEntries(new URLSearchParams(q))));

const SPRING = "utm_source=facebook&utm_medium=paid_social&campaign_id=120254631999170581&utm_campaign=Spring+kitchens+2026";
const SET_GAT = "&adset_id=120254631999170582&utm_term=Homeowners+35-65+%E2%80%94+Gatineau";
const SET_LAL = "&adset_id=120254631999170590&utm_term=Lookalike%201%25";
const AD_CAR = "&ad_id=120254631999170583&utm_content=Before%2Fafter+carousel";
const AD_REEL = "&ad_id=120254631999170584&utm_content=Reel+%E2%80%94+15s+walkthrough";
const AD_LAL = "&ad_id=120254631999170591&utm_content=Before%2Fafter+carousel";
const IDS_ONLY = "campaign_id=120254631999170999&adset_id=120254631999171000&ad_id=120254631999171001";

function visitRows() {
  const rows = [];
  const push = (n, q, extra = {}) => {
    for (let i = 0; i < n; i++) rows.push({ id: `v${rows.length}`, ad: q ? ad(q) : null, ...extra });
  };
  push(41, `${SPRING}${SET_GAT}${AD_CAR}&site_source_name=ig&placement=instagram_stories`);
  push(23, `${SPRING}${SET_GAT}${AD_REEL}&site_source_name=fb`);
  push(17, `${SPRING}${SET_LAL}${AD_LAL}&site_source_name=ig`);
  push(3, `${SPRING}${SET_GAT}${AD_CAR}`, { contactAt: daysAgo(2) });
  push(1, `${SPRING}${SET_GAT}${AD_CAR}`, { firstVisitId: "v0", bookingId: "bk_1" });
  push(12, IDS_ONLY);
  push(1, IDS_ONLY, { contactAt: daysAgo(4) });
  rows.push(...Array.from({ length: 6 }, (_, i) => ({ id: `flyer${i}`, utmSource: "flyer", utmCampaign: "spring_flyer" })));
  push(58, null);
  return rows;
}
function leads() {
  const a = (q) => ({ source: "instagram", ad: ad(q) });
  return [
    { id: "l1", attribution: a(`${SPRING}${SET_GAT}${AD_CAR}`), quoteId: "q1" },
    { id: "l2", attribution: a(`${SPRING}${SET_GAT}${AD_CAR}`), quoteId: "q2" },
    { id: "l3", attribution: a(`${SPRING}${SET_GAT}${AD_CAR}`), quoteId: "q3" },
    { id: "l4", attribution: a(`${SPRING}${SET_GAT}${AD_REEL}`), quoteId: "q4" },
    { id: "l5", attribution: a(`${SPRING}${SET_LAL}${AD_LAL}`), quoteId: null },
    { id: "l6", attribution: a(IDS_ONLY), quoteId: "q6" },
    { id: "l7", attribution: { source: "flyer", utmCampaign: "spring_flyer" }, quoteId: "q7" },
    { id: "l8", attribution: { source: "direct" }, quoteId: null },
    { id: "l9", attribution: { source: "google" }, quoteId: null },
  ];
}
const QUOTES = [
  { id: "q1", status: "accepted", sentAt: daysAgo(9), acceptedAt: daysAgo(3), total: "18450.00", acceptedTotal: "18450.00" },
  { id: "q2", status: "sent", sentAt: daysAgo(5), acceptedAt: null, total: "12200.00", acceptedTotal: null },
  { id: "q3", status: "draft", sentAt: null, acceptedAt: null, total: "0", acceptedTotal: null },
  { id: "q4", status: "accepted", sentAt: daysAgo(12), acceptedAt: daysAgo(6), total: "9800.00", acceptedTotal: "10340.00" },
  { id: "q6", status: "sent", sentAt: daysAgo(2), acceptedAt: null, total: "7400.00", acceptedTotal: null },
  { id: "q7", status: "accepted", sentAt: daysAgo(20), acceptedAt: daysAgo(14), total: "4200.00", acceptedTotal: "4200.00" },
];
const BOOKINGS = [
  { id: "bk_1", quoteId: null, status: "confirmed" },
  { id: "bk_2", quoteId: "q2", status: "confirmed" },
];

function traffic(ctx) {
  const days = Number(ctx.search?.get("days")) || 30;
  const money = !/-restricted/.test(slugOf(ctx));
  const steps = (arr) => arr.flatMap(([rank, n, completed]) => Array.from({ length: n }, () => ({ stepRank: rank, completed })));
  const campaigns = redactCampaignReport(buildCampaignReport({ visits: visitRows(), leads: leads(), quotes: QUOTES, bookings: BOOKINGS, now: NOW }), {
    quotes: true,
    money,
  });
  return {
    days,
    since: daysAgo(days).toISOString(),
    surfaces: [
      { key: "instant_quote", kind: "instant_quote", ...countSteps(reportSteps("instant_quote"), steps([[0, 61], [1, 22], [2, 14], [3, 9], [4, 6, true]])) },
      {
        key: "funnel:f_1",
        kind: "funnel",
        funnelId: "f_1",
        name: "Kitchen refresh — free design visit",
        slug: "kitchen-refresh",
        ...(() => {
          const c = countSteps(reportSteps("funnel", [{ id: "s1", question: "What are you updating?" }, { id: "s2", question: "When would you like it done?" }, { id: "s3", headline: "Where should we send your design ideas?" }]), steps([[0, 30], [1, 21], [2, 14], [3, 5, true]]));
          return { ...c, steps: c.steps.map((s) => ({ ...s, label: { s1: "What are you updating?", s2: "When would you like it done?", s3: "Where should we send your design ideas?" }[s.key] || null })) };
        })(),
      },
      { key: "booking", kind: "booking", ...countSteps(reportSteps("booking"), steps([[0, 19], [1, 7], [2, 4, true]])) },
      { key: "website", kind: "website", ...countSteps(reportSteps("website"), steps([[0, 96]])) },
    ],
    funnelNames: { f_1: "Kitchen refresh — free design visit" },
    bySource: [
      { surfaceKey: "website", source: "instagram", visits: 44, submitted: 0 },
      { surfaceKey: "instant_quote", source: "direct", visits: 31, submitted: 2 },
      { surfaceKey: "website", source: "facebook", visits: 29, submitted: 0 },
      { surfaceKey: "funnel:f_1", source: "instagram", visits: 17, submitted: 3 },
      { surfaceKey: "instant_quote", source: "google", visits: 16, submitted: 3 },
      { surfaceKey: "booking", source: "facebook", visits: 11, submitted: 3 },
      { surfaceKey: "website", source: "flyer", visits: 6, submitted: 0 },
    ],
    campaigns: campaigns.campaigns,
    campaignsUntagged: campaigns.untagged,
    campaignAccess: { quotes: true, money },
    currency: "CAD",
    partials: [
      {
        id: "p1",
        surface: "instant_quote",
        funnelId: null,
        funnelName: null,
        trade: "cabinet_refinishing",
        stepKey: "contact",
        stepLabel: null,
        source: "instagram",
        campaign: "Spring kitchens 2026",
        contactAt: daysAgo(2).toISOString(),
        lastSeenAt: daysAgo(2).toISOString(),
        name: "Nadia Tremblay",
        email: "nadia.t@example.com",
        phone: "819-555-0142",
      },
    ],
    partialExpireDays: 30,
    truncated: false,
  };
}

const LANDINGS = [
  { key: "instant_quote", kind: "instant_quote", path: "/instant-quote/erable-design" },
  { key: "funnel:f_1", kind: "funnel", name: "Kitchen refresh — free design visit", path: "/f/erable-design/kitchen-refresh" },
  { key: "booking", kind: "booking", path: "/book/erable-design" },
  { key: "booking:in-home-estimate", kind: "booking_type", name: "In-home estimate", path: "/book/erable-design/in-home-estimate" },
  { key: "website", kind: "website", url: "https://erable-design.fieldquo.com/" },
];

export const ROUTES_ADTRACKING = [
  { path: "/api/leads/traffic", method: "GET", reply: (ctx) => (isAdtrack(ctx) ? traffic(ctx) : ctx.next()) },
  { path: "/api/leads/traffic/landings", method: "GET", reply: (ctx) => (isAdtrack(ctx) ? { landings: LANDINGS } : ctx.next()) },
  {
    path: "/api/settings/tracking",
    method: "GET",
    reply: (ctx) =>
      isAdtrack(ctx)
        ? { metaPixelId: "812345678901234", ga4Id: "", tiktokPixelId: "", pixelConsentRequired: true, canEdit: true, publicSlug: "erable-design" }
        : ctx.next(),
  },
];
