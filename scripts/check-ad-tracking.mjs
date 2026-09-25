// scripts/check-ad-tracking.mjs
//
//   npm run check:ad-tracking
//
// A contractor's own Meta ad tracking, executed rather than read: the landing
// a public page reads (lib/tracking/landing.js), what the server keeps of it
// (lib/tracking/attribution.js cleanLanding), the first-touch carry between a
// company's pages and the fail-soft reads before the new columns exist
// (lib/tracking/visits.js, against a fake Prisma client), the campaign ▸ ad
// set ▸ ad report (lib/tracking/campaignReport.js) and the Ads Manager string
// the link builder hands out.
//
// The inputs are the hostile ones: "+" and %20 and %2520 spellings of one
// campaign, mixed case, emoji, empty values, ids with no names, 1000-character
// names, markup, unsubstituted {{macros}}, and an Instagram placement that
// also carries Meta's click id (which used to be counted as Facebook).
//
// Imports are namespaces and dynamic so that, run against the files as they
// were before this change, the script reports each failed claim instead of
// dying at link time on the first missing export.

import { register } from "node:module";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}`);

// `@/lib/db` → a fake the checks script below; everything else is the
// shipped file (alias-loader resolves the rest). Registered last, so it runs
// first.
register(
  "data:text/javascript," +
    encodeURIComponent(
      'export async function resolve(s, c, n) { if (s === "@/lib/db") return { url: "data:text/javascript,export const db = globalThis.__adTrackingDb;", shortCircuit: true }; return n(s, c); }',
    ),
);
const fakeDb = { funnelVisit: {} };
globalThis.__adTrackingDb = fakeDb;

async function load(path) {
  try {
    return await import(path);
  } catch (err) {
    ok(`${path} loads`, false, String(err?.message || err).slice(0, 160));
    return null;
  }
}

const adParams = await load("@/lib/tracking/adParams");
const landing = await load("@/lib/tracking/landing");
const attribution = await load("@/lib/tracking/attribution");
const steps = await load("@/lib/tracking/funnelSteps");
const describe = await load("@/lib/tracking/describe");
const visits = await load("@/lib/tracking/visits");
const report = await load("@/lib/tracking/campaignReport");
const touches = await load("@/lib/tracking/touches");

const fn = (mod, name) => (mod && typeof mod[name] === "function" ? mod[name] : null);
const call = (mod, name, ...args) => {
  const f = fn(mod, name);
  if (!f) return { __missing: `${name} is not exported` };
  try {
    const out = f(...args);
    return out && typeof out.then === "function" ? out.catch((err) => ({ __threw: String(err?.message || err) })) : out;
  } catch (err) {
    return { __threw: String(err?.message || err) };
  }
};

// ── 1. decodeAdValue against hostile input ──────────────────────────────────
section("decodeAdValue");
{
  const d = (v) => call(adParams, "decodeAdValue", v);
  ok('"+" is a space', d("New+Traffic+Campaign") === "New Traffic Campaign", d("New+Traffic+Campaign"));
  ok("%20 is a space", d("New%20Traffic%20Campaign") === "New Traffic Campaign");
  ok("%2520 (double-encoded) is a space", d("New%2520Traffic%2520Campaign") === "New Traffic Campaign", d("New%2520Traffic%2520Campaign"));
  ok("%2B (encoded +) is a space", d("New%2BTraffic") === "New Traffic", d("New%2BTraffic"));
  ok("empty is null", d("") === null && d("   ") === null && d(null) === null && d(undefined) === null);
  ok("an unsubstituted macro is null", d("{{campaign.name}}") === null && d("%7B%7Bad.name%7D%7D") === null);
  const script = d("<script>alert(1)</script>Spring");
  ok("markup characters are stripped", typeof script === "string" && !/[<>]/.test(script), script);
  const long = d("x".repeat(1000));
  ok("1000 characters are bounded to AD_VALUE_MAX", typeof long === "string" && Array.from(long).length === adParams?.AD_VALUE_MAX, long?.length);
  const emoji = d("🏠".repeat(200));
  ok("emoji are bounded by code point, never half a surrogate", Array.from(emoji || "").length === adParams?.AD_VALUE_MAX && !/[\ud800-\udbff]$/.test(emoji || ""));
  ok("a malformed escape does not throw", typeof d("100%zz off") === "string", d("100%zz off"));
}

// ── 2. The owner's exact Ads Manager string, read field by field ────────────
section("The owner's string, as Meta substitutes it, on an Instagram Story with an fbclid");
const OWNER =
  "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}" +
  "&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}&site_source_name={{site_source_name}}";
{
  ok("META_URL_PARAMETERS is the owner's string verbatim", adParams?.META_URL_PARAMETERS === OWNER);
  const substituted = OWNER.replace("{{campaign.name}}", "New+Traffic+Campaign")
    .replace("{{ad.name}}", "Ad%20One")
    .replace("{{adset.name}}", "Adset%2520A")
    .replace("{{campaign.id}}", "120254631999170581")
    .replace("{{adset.id}}", "120254631999170582")
    .replace("{{ad.id}}", "120254631999170583")
    .replace("{{placement}}", "instagram_stories")
    .replace("{{site_source_name}}", "ig");
  const search = `?${substituted}&fbclid=IwAR0abcDEF123_xyz-456`;
  const raw = call(landing, "readLanding", search, "https://l.instagram.com/");
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "campaign_id", "adset_id", "ad_id", "placement", "site_source_name", "fbclid"]) {
    ok(`readLanding reads ${k}`, typeof raw?.[k] === "string" && raw[k].length > 0, raw?.[k]);
  }
  const clean = call(attribution, "cleanLanding", raw, new Date(1758800000000));
  const ad = call(adParams, "expandAd", clean?.ad);
  ok("utm_source kept as written", clean?.utmSource === "facebook");
  ok("utm_medium kept", clean?.utmMedium === "paid_social");
  ok("campaign name decoded from utm_campaign", ad?.campaignName === "New Traffic Campaign", ad?.campaignName);
  ok("campaign id from campaign_id", ad?.campaignId === "120254631999170581");
  ok("ad set name decoded from utm_term (double-encoded)", ad?.adsetName === "Adset A", ad?.adsetName);
  ok("ad set id from adset_id", ad?.adsetId === "120254631999170582");
  ok("ad name decoded from utm_content", ad?.adName === "Ad One", ad?.adName);
  ok("ad id from ad_id", ad?.adId === "120254631999170583");
  ok("placement kept", ad?.placement === "instagram_stories");
  ok("site_source_name kept", ad?.siteSource === "ig");
  ok("fbclid presence kept on the ad", ad?.hasFbclid === true);
  ok("fbc kept in Meta's _fbc shape", clean?.fbc === "fb.1.1758800000000.IwAR0abcDEF123_xyz-456", clean?.fbc);
  ok("Instagram placement WITH fbclid → source instagram (not facebook)", clean?.source === "instagram", clean?.source);
}

// ── 3. site_source_name / placement decide the network ──────────────────────
section("Which Meta network");
{
  const src = (q) => call(attribution, "cleanLanding", call(landing, "readLanding", q, ""))?.source;
  ok("site_source_name=msg → messenger", src("?utm_source=facebook&fbclid=abcdefgh12&site_source_name=msg") === "messenger");
  ok("site_source_name=an → audience_network", src("?utm_source=facebook&site_source_name=an") === "audience_network");
  ok("site_source_name=th → threads", src("?utm_source=facebook&site_source_name=th") === "threads");
  ok("site_source_name=fb → facebook", src("?utm_source=facebook&fbclid=abcdefgh12&site_source_name=fb") === "facebook");
  ok("placement only (instagram_reels) → instagram", src("?fbclid=abcdefgh12&placement=instagram_reels") === "instagram");
  ok("site_source_name in capitals (IG) → instagram", src("?utm_source=facebook&site_source_name=IG") === "instagram", src("?utm_source=facebook&site_source_name=IG"));
  ok("another network's click id is not overridden", src("?gclid=abcdefgh12&site_source_name=ig") === "google_ads", src("?gclid=abcdefgh12&site_source_name=ig"));
  ok("an unknown site_source_name changes nothing", src("?utm_source=facebook&site_source_name=zz") === "facebook");
}

// ── 4. Old links still land exactly as before ───────────────────────────────
section("Links built before this change");
{
  const raw = call(landing, "readLanding", "?utm_source=facebook&utm_medium=paid_social&utm_campaign=spring_roofs&fbclid=IwAR9zzzzzzz", "");
  const clean = call(attribution, "cleanLanding", raw, new Date(1758800000000));
  ok("utm columns unchanged", clean?.utmSource === "facebook" && clean?.utmMedium === "paid_social" && clean?.utmCampaign === "spring_roofs");
  ok("click network + fbc unchanged", clean?.clickNetwork === "facebook" && clean?.fbc === "fb.1.1758800000000.IwAR9zzzzzzz");
  ok("source unchanged (facebook)", clean?.source === "facebook");
  ok("campaign grouped by name from utm_campaign", call(attribution, "adIdentityOf", clean)?.campaignName === "spring_roofs");
  const bare = call(attribution, "cleanLanding", call(landing, "readLanding", "", ""));
  ok("an untagged visit stores no ad JSON", bare && bare.ad === null, bare?.ad);
  ok("an untagged visit is direct", bare?.source === "direct");
  const legacyRow = { utmSource: "facebook", utmCampaign: "new+traffic+campaign", utmContent: null, utmTerm: null };
  ok("a stored pre-change row (no ad column) groups by its decoded utm_campaign", call(attribution, "adIdentityOf", legacyRow)?.campaignName === "new traffic campaign");
  ok("a Meta id in an old utm_campaign reads as an id, not a name", call(attribution, "adIdentityOf", { utmCampaign: "120254631999170581" })?.campaignId === "120254631999170581");
}

// ── 5. The company template is a superset of META_URL_PARAMETERS ───────────
section("The company's Ads Manager string");
{
  const tpl = call(landing, "metaUrlParameters", { source: "instagram", medium: "cpc" });
  const pairs = (s) => (typeof s === "string" ? s.split("&") : []);
  const missing = pairs(adParams?.META_URL_PARAMETERS).filter((p) => !pairs(tpl).includes(p));
  ok("every pair of META_URL_PARAMETERS is in the company template", missing.length === 0, missing);
  ok("utm_source stays facebook whatever the manual fields say", pairs(tpl).includes("utm_source=facebook"), tpl);
  const keys = pairs(tpl).map((p) => p.split("=")[0]);
  const probe = `?${keys.map((k) => `${k}=v1`).join("&")}`;
  const read = call(landing, "readLanding", probe, "");
  const unread = keys.filter((k) => !read?.[k]);
  ok("readLanding reads every parameter name the template sends", unread.length === 0, unread);
  const base = "https://app.fieldquo.com/instant-quote/sunset";
  const full = call(adParams, "withMetaParameters", base);
  ok("the full ad URL is the page plus the template", full === `${base}?${OWNER}`, full);
  const withQ = call(adParams, "withMetaParameters", "https://sunset.fieldquo.com/?lang=fr#book");
  ok("an existing query and hash are kept", withQ === `https://sunset.fieldquo.com/?lang=fr&${OWNER}#book`, withQ);
  ok("a non-http base is refused", call(adParams, "withMetaParameters", "javascript:alert(1)") === null);
  const rawBound = call(landing, "readLanding", `?campaign_id=${"9".repeat(900)}&utm_campaign=${"a".repeat(900)}`, "");
  ok("every raw value is bounded before it leaves the browser", rawBound?.campaign_id?.length <= 500 && rawBound?.utm_campaign?.length <= 500);
  ok("a malformed query string does not throw", typeof call(landing, "readLanding", "?%E0%A4%A=%", "not a url") === "object");
}

// ── 6. Own signal vs inherited landing ──────────────────────────────────────
section("landingHasOwnSignal");
{
  const own = (q, ref = "") => call(attribution, "landingHasOwnSignal", call(attribution, "cleanLanding", call(landing, "readLanding", q, ref)));
  ok("nothing at all → inherits", own("") === false);
  ok("arriving from the company's own site → inherits", own("", "https://sunset.fieldquo.com/services") === false);
  ok("a utm tag → its own", own("?utm_source=flyer") === true);
  ok("an fbclid alone → its own", own("?fbclid=abcdefgh12") === true);
  ok("Meta ids alone → its own", own("?campaign_id=120254631999170581") === true);
  ok("an external referrer → its own", own("", "https://www.google.com/search?q=x") === true);
}

// ── 7. openVisit / findVisit against a fake database ───────────────────────
section("First touch across pages, and reads before the columns exist");
if (visits) {
  const TOKEN_A = "A".repeat(32);
  const first = {
    id: "visit_first",
    companyId: "co_1",
    source: "instagram",
    utmSource: "facebook",
    utmMedium: "paid_social",
    utmCampaign: "New+Traffic+Campaign",
    utmContent: null,
    utmTerm: null,
    clickNetwork: "facebook",
    fbc: "fb.1.1.IwARxxxxxxx",
    referrerHost: null,
    ad: { cid: "120254631999170581", cn: "New Traffic Campaign", ss: "ig" },
  };
  const calls = [];
  let failNextWithMissingColumn = false;
  fakeDb.funnelVisit = {
    async findFirst(args) {
      calls.push(["findFirst", args]);
      if (args.where?.token?.in) {
        if (args.where.companyId !== "co_1") return null;
        return args.where.token.in.includes(TOKEN_A) ? first : null;
      }
      return null;
    },
    async create(args) {
      calls.push(["create", args]);
      if (failNextWithMissingColumn && ("ad" in args.data || "firstVisitId" in args.data)) {
        failNextWithMissingColumn = false;
        const e = new Error('The column `FunnelVisit.ad` does not exist in the current database.');
        e.code = "P2022";
        throw e;
      }
      return { id: "new" };
    },
    async update(args) {
      calls.push(["update", args]);
      return { id: args.where.id };
    },
  };

  const token = await call(visits, "openVisit", { companyId: "co_1", surface: "booking", landing: { referrer: "sunset.fieldquo.com" }, touches: [TOKEN_A, "short", 42] });
  const created = calls.find((c) => c[0] === "create")?.[1];
  ok("a new visit gets a token", call(visits, "isVisitToken", token));
  ok("the carry lookup is scoped to the company", calls.find((c) => c[0] === "findFirst")?.[1]?.where?.companyId === "co_1");
  ok("junk tokens are dropped before the lookup", JSON.stringify(calls.find((c) => c[0] === "findFirst")?.[1]?.where?.token?.in) === JSON.stringify([TOKEN_A]));
  ok("an inherited landing copies the first visit's source", created?.data?.source === "instagram", created?.data?.source);
  ok("… its utm_* and click id", created?.data?.utmCampaign === "New+Traffic+Campaign" && created?.data?.fbc === first.fbc);
  ok("… its ad JSON", created?.data?.ad?.cid === "120254631999170581");
  ok("… and records which visit it came from", created?.data?.firstVisitId === "visit_first");
  ok("create selects only the id (no SELECT * of columns that may not exist)", JSON.stringify(created?.select) === '{"id":true}');

  calls.length = 0;
  await call(visits, "openVisit", { companyId: "co_1", surface: "booking", landing: { utm_source: "flyer", utm_campaign: "door" }, touches: [TOKEN_A] });
  const own = calls.find((c) => c[0] === "create")?.[1];
  ok("a landing with its own tags is never overwritten", own?.data?.utmSource === "flyer" && !own?.data?.firstVisitId, own?.data);
  ok("… and does not even look up the touch", !calls.some((c) => c[0] === "findFirst"));

  calls.length = 0;
  await call(visits, "openVisit", { companyId: "co_2", surface: "booking", landing: {}, touches: [TOKEN_A] });
  const other = calls.find((c) => c[0] === "create")?.[1];
  ok("another company's token carries nothing", !other?.data?.firstVisitId && other?.data?.source === "direct", other?.data);

  calls.length = 0;
  failNextWithMissingColumn = true;
  const t2 = await call(visits, "openVisit", { companyId: "co_1", surface: "website", landing: { utm_source: "facebook", campaign_id: "120254631999170581" } });
  const creates = calls.filter((c) => c[0] === "create");
  ok("before the columns exist: the visit is still opened (retried without them)", call(visits, "isVisitToken", t2) && creates.length === 2, creates.length);
  ok("… and the retry carries the legacy columns only", creates[1]?.[1]?.data && !("ad" in creates[1][1].data) && creates[1][1].data.utmSource === "facebook");

  ok("P2022 is a missing column", call(visits, "isMissingColumn", { code: "P2022" }) === true);
  ok("Postgres' own wording is a missing column", call(visits, "isMissingColumn", new Error('column "ad" of relation "FunnelVisit" does not exist')) === true);
  ok("a different error is not", call(visits, "isMissingColumn", new Error("connection reset")) === false);
  ok("the legacy select names no new column", !("ad" in (call(visits, "visitSelect", false) || {})) && !("bookingId" in (call(visits, "visitSelect", false) || {})));
  ok("cleanTouches keeps valid tokens only, once, at most TOUCH_MAX", call(visits, "cleanTouches", [TOKEN_A, TOKEN_A, "x", null, ..."BCDEFGHIJK".split("").map((c) => c.repeat(32))]).length === visits.TOUCH_MAX);

  calls.length = 0;
  await call(visits, "linkVisitToBooking", { id: "v1", surface: "booking", stepRank: 1, bookingId: null }, "bk_1");
  const up = calls.find((c) => c[0] === "update")?.[1];
  ok("a booking visit links its booking and is marked booked", up?.data?.bookingId === "bk_1" && up?.data?.stepKey === "submitted" && up?.data?.stepRank === 2, up?.data);
  calls.length = 0;
  await call(visits, "linkVisitToBooking", { id: "v1", surface: "booking", bookingId: "bk_0" }, "bk_2");
  ok("a second booking never replaces the first", calls.length === 0);
  await call(visits, "linkVisitToBooking", { id: "v2", surface: "instant_quote" }, "bk_3");
  ok("only a booking-page visit links a booking", calls.length === 0);
} else {
  ok("lib/tracking/visits.js loads", false);
}

// ── 8. Steps for the new surfaces ───────────────────────────────────────────
section("Booking page and website steps");
{
  ok("booking and website are surfaces", steps?.SURFACES?.includes("booking") && steps?.SURFACES?.includes("website"));
  ok("booking: picked a time ranks 1, booked ranks 2", call(steps, "stepRank", "booking", "slot") === 1 && call(steps, "stepRank", "booking", "submitted") === 2);
  ok("website: only landed; it never submits", call(steps, "stepRank", "website", "landed") === 0 && call(steps, "stepRank", "website", "submitted") === null);
  ok("instant estimate order unchanged", JSON.stringify(call(steps, "reportSteps", "instant_quote")?.map?.((s) => s.key)) === JSON.stringify(["landed", "service", "details", "contact", "submitted"]));
}

// ── 9. The campaign report ──────────────────────────────────────────────────
section("Campaign ▸ ad set ▸ ad");
if (report && adParams) {
  const now = new Date("2026-09-25T12:00:00Z");
  const compact = (q) => adParams.compactAd(adParams.cleanAdParams(Object.fromEntries(new URLSearchParams(q))));
  const visitsRows = [
    // Id and name, "+" spelling.
    { id: "v1", ad: compact("utm_campaign=New+Traffic+Campaign&campaign_id=120254631999170581&utm_term=Set+A&adset_id=120254631999170582&utm_content=Ad+1&ad_id=120254631999170583") },
    // Same campaign, %20 spelling, name only — joins the id.
    { id: "v2", ad: compact("utm_campaign=New%20Traffic%20Campaign&utm_term=Set%20A&utm_content=Ad%201") },
    // Same campaign, lower case, double-encoded.
    { id: "v3", ad: compact("utm_campaign=new%2520traffic%2520campaign") },
    // Ids only: the name was never sent.
    { id: "v4", ad: compact("campaign_id=120000000000000999&adset_id=120000000000000998&ad_id=120000000000000997") },
    // A pre-change row: no ad column, utm_campaign only.
    { id: "v5", utmSource: "facebook", utmCampaign: "spring_roofs" },
    // Inherited (website → booking page): not a second visit, its booking counts.
    { id: "v6", firstVisitId: "v1", ad: compact("utm_campaign=New+Traffic+Campaign&campaign_id=120254631999170581"), bookingId: "bk_ok" },
    // A live partial, an expired one, and an untagged visit.
    { id: "v7", ad: compact("campaign_id=120254631999170581"), contactAt: new Date("2026-09-20T00:00:00Z") },
    { id: "v8", ad: compact("campaign_id=120254631999170581"), contactAt: new Date("2026-07-01T00:00:00Z") },
    { id: "v9", source: "direct" },
    // A lapsed paid hold: not a booking.
    { id: "v10", ad: compact("campaign_id=120254631999170581"), bookingId: "bk_hold" },
    // Hostile names.
    { id: "v11", ad: compact(`utm_campaign=${encodeURIComponent("<script>x</script>" + "🏠".repeat(400))}`) },
  ];
  const leads = [
    { id: "l1", attribution: { source: "instagram", ad: compact("campaign_id=120254631999170581&utm_campaign=New+Traffic+Campaign") }, quoteId: "q1" },
    { id: "l2", attribution: { source: "facebook", utmCampaign: "spring_roofs" }, quoteId: "q2" },
    { id: "l3", attribution: { source: "direct" }, quoteId: null },
    { id: "l4", attribution: null, quoteId: "q9" },
  ];
  const quotes = [
    { id: "q1", status: "accepted", sentAt: new Date(), acceptedAt: new Date(), total: "1000.10", acceptedTotal: "1200.20" },
    { id: "q2", status: "sent", sentAt: new Date(), acceptedAt: null, total: "500", acceptedTotal: null },
  ];
  const bookings = [
    { id: "bk_ok", quoteId: "q1", status: "confirmed" }, // linked by a visit AND the lead's quote: once
    { id: "bk_hold", quoteId: null, status: "pending_payment" },
  ];
  const r = call(report, "buildCampaignReport", { visits: visitsRows, leads, quotes, bookings, now });
  const byId = (id) => r?.campaigns?.find((c) => c.id === id);
  const main = byId("120254631999170581");
  ok("one campaign for +, %20, lower-case and double-encoded spellings", main && r.campaigns.filter((c) => /traffic/i.test(c.name || "")).length === 1, r?.campaigns?.map((c) => c.name));
  ok("its display name is the spelling most rows used", main?.name === "New Traffic Campaign", main?.name);
  ok("visits: landings only (v1 v2 v3 v7 v8 v10 — not the inherited v6)", main?.metrics?.visits === 6, main?.metrics);
  ok("partials: live only (v7, not the expired v8)", main?.metrics?.partials === 1);
  ok("booked: the inherited visit's confirmed booking, once, and never the lapsed hold", main?.metrics?.booked === 1, main?.metrics?.booked);
  ok("leads / quotes sent / won", main?.metrics?.leads === 1 && main?.metrics?.quotesSent === 1 && main?.metrics?.quotesWon === 1);
  ok("revenue won is the accepted total, in cents", main?.metrics?.revenueWon === 1200.2, main?.metrics?.revenueWon);
  const setA = main?.adsets?.find((s) => s.name === "Set A");
  ok("ad set Set A joins its id across spellings", setA?.id === "120254631999170582" && setA?.metrics?.visits === 2, setA);
  ok("ad Ad 1 under it", setA?.ads?.[0]?.name === "Ad 1" && setA.ads[0].id === "120254631999170583");
  const idOnly = byId("120000000000000999");
  ok("an id-only campaign is flagged nameMissing (the page prints the macro to add)", idOnly?.nameMissing === true && idOnly?.name === null);
  ok("… and so are its ad set and ad", idOnly?.adsets?.[0]?.nameMissing === true && idOnly?.adsets?.[0]?.ads?.[0]?.nameMissing === true);
  const legacy = r?.campaigns?.find((c) => c.name === "spring_roofs");
  ok("a pre-change visit and its lead still appear under utm_campaign", legacy?.metrics?.visits === 1 && legacy?.metrics?.leads === 1 && legacy?.metrics?.quotesSent === 1 && legacy?.metrics?.quotesWon === 0);
  ok("untagged visits and leads are kept apart, not an invented campaign", r?.untagged?.metrics?.visits === 1 && r?.untagged?.metrics?.leads === 1, r?.untagged);
  const hostile = r?.campaigns?.find((c) => (c.name || "").includes("🏠"));
  ok("a hostile name is stripped of markup and bounded", hostile && !/[<>]/.test(hostile.name) && Array.from(hostile.name).length <= adParams.AD_VALUE_MAX, hostile?.name?.slice(0, 30));
  const noQuotes = call(report, "redactCampaignReport", r, { quotes: false, money: false });
  ok("without quotes access: quotes and revenue are null, not 0", noQuotes?.campaigns?.[0]?.metrics?.quotesSent === null && noQuotes.campaigns[0].metrics.revenueWon === null);
  ok("… down to the ad", noQuotes?.campaigns?.[0]?.adsets?.[0]?.ads?.[0]?.metrics?.quotesWon === null);
  const noMoney = call(report, "redactCampaignReport", r, { quotes: true, money: false });
  ok("without prices: revenue null, quote counts kept", noMoney?.campaigns?.[0]?.metrics?.revenueWon === null && typeof noMoney.campaigns[0].metrics.quotesSent === "number");
  ok("the untagged row is redacted the same way", noMoney?.untagged?.metrics?.revenueWon === null);
  const empty = call(report, "buildCampaignReport", {});
  ok("nothing in, nothing out", Array.isArray(empty?.campaigns) && empty.campaigns.length === 0);
} else {
  ok("lib/tracking/campaignReport.js loads", false);
}

// ── 10. What a lead carries and how the drawer reads it ─────────────────────
section("Lead attribution");
{
  const visit = {
    source: "instagram",
    utmSource: "facebook",
    utmCampaign: "New+Traffic+Campaign",
    fbc: "fb.1.1.x",
    ad: { cid: "120254631999170581", cn: "New Traffic Campaign", an: "Ad One" },
    startedAt: new Date("2026-09-24T00:00:00Z"),
  };
  const a = call(attribution, "attributionFromVisit", visit);
  ok("the lead carries the visit's ad JSON", a?.ad?.cid === "120254631999170581");
  ok("…and never the partial contact fields", a && !("contactEmail" in a) && !("contactPhone" in a));
  const d = call(describe, "describeAttribution", a);
  ok("the drawer prints Meta's campaign name", d?.campaign === "New Traffic Campaign", d?.campaign);
  ok("…and the ad name", d?.content === "Ad One", d?.content);
  const old = call(describe, "describeAttribution", { source: "facebook", utmCampaign: "spring+roofs", utmContent: "video%201" });
  ok("an old lead's utm_campaign is decoded", old?.campaign === "spring roofs" && old?.content === "video 1", old);
  ok("Instagram and Messenger have display names", call(describe, "sourceName", "messenger") === "Messenger" && call(describe, "sourceName", "audience_network") === "Audience Network");
}

// ── 11. The tab's touch list ────────────────────────────────────────────────
section("sessionStorage touch list");
if (touches) {
  const store = new Map();
  globalThis.window = { sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) } };
  const tok = (c) => c.repeat(32);
  for (const c of "ABCDEFGHIJKL") touches.rememberTouch(tok(c));
  touches.rememberTouch("not-a-token");
  const list = touches.readTouches();
  ok("at most 8 tokens, the FIRST one always kept", list.length === 8 && list[0] === tok("A"), list.map((x) => x[0]).join(""));
  ok("a junk token is never stored", !list.includes("not-a-token"));
  store.set("fq.touch", "{not json");
  ok("a corrupt entry reads as empty, never throws", Array.isArray(touches.readTouches()) && touches.readTouches().length === 0);
  delete globalThis.window;
  ok("no window (server render) reads as empty", touches.readTouches().length === 0);
} else {
  ok("lib/tracking/touches.js loads", false);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
