// scripts/check-platform-campaigns.mjs
//
// FieldQuo's own ad campaigns on /platform/analytics, and the Meta
// parameters behind them, executed against hostile input.
//
// What the owner saw on 2026-09-25: a campaign called "120254631999170581"
// (Meta's automatic parameters put the campaign ID in utm_campaign, with no
// name anywhere), and "new+traffic+campaign" / "new traffic campaign" as two
// campaigns. And 540 Instagram landings filed under facebook, because the
// fbclid Meta stamps on every click beat utm_source=ig. This holds:
//
//   · decoding (+, %20, %2520, %2B), case-folded grouping with the best
//     spelling displayed, bounded values, markup stripped, macros dropped;
//   · the owner's exact Ads Manager string is read field by field, and the
//     template shown is a superset of it;
//   · Instagram / Messenger / Audience Network / Threads from
//     site_source_name, the placement or utm_source=ig — over the click id;
//   · an id-only campaign is shown as an id with "name not sent", grouped
//     apart from named ones unless a landing carried both;
//   · first ad touch → SignupLead.utm.ft, set once, never from the body;
//   · conversions: signups started / trials / paying by the shared rules.
//
// Run: npm run check:platform-campaigns

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  decodeAdValue, cleanAdParams, readAdQuery, groupAdRows, compactAd, expandAd, metaNetwork,
  META_URL_PARAMETERS, META_URL_PARAMETERS_DOC, withMetaParameters, AD_VALUE_MAX,
} from "@/lib/tracking/adParams.js";
import { sanitiseEvent, trafficSource, cleanUtm, MAX_BATCH_BYTES } from "@/lib/analytics/product/events.js";
import { rollup } from "@/lib/analytics/product/rollup.js";
import { campaignRows, firstTouchOf, leadAttribution, leadOutcome, adOfLanding, CAMPAIGN_METRICS } from "@/lib/analytics/product/campaigns.js";
import { utmWithFirstTouch, normaliseCapture, planCaptureWrite } from "@/lib/signup/leads.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

let passed = 0;
const failures = [];
function ok(name, cond, detail = "") {
  if (cond) passed += 1;
  else failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

// ── 1. decodeAdValue against hostile input ─────────────────────────────────
{
  ok("+ is a space", decodeAdValue("new+traffic+campaign") === "new traffic campaign");
  ok("%20 is a space", decodeAdValue("new%20traffic%20campaign") === "new traffic campaign");
  ok("double encoding is undone (%2520, %2B)", decodeAdValue("New%2520Traffic%2BCampaign") === "New Traffic Campaign");
  ok("empty / blank / non-string is null", [undefined, null, "", "   ", "+++", 42, {}, []].every((v) => decodeAdValue(v) === null));
  ok("an unsubstituted macro is not a campaign", decodeAdValue("{{campaign.name}}") === null && decodeAdValue("x{{ad.name}}") === null && decodeAdValue("%7B%7Bcampaign.name%7D%7D") === null);
  const s = decodeAdValue("<script>alert('x')</script>");
  ok("markup characters are removed", s && !/[<>'"`\\]/.test(s), s);
  const s2 = decodeAdValue("%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
  ok("…also when percent-encoded", s2 && !/[<>]/.test(s2), s2);
  ok("control characters are removed", decodeAdValue("a\u0000b\u0007c\u009fd") === "abcd");
  const long = decodeAdValue("x".repeat(1000));
  ok("a 1000-character value is bounded", long.length === AD_VALUE_MAX);
  const emoji = decodeAdValue("🎉".repeat(400));
  ok("emoji are kept and never cut in half", Array.from(emoji).length === AD_VALUE_MAX && !/[\ud800-\udbff]$/.test(emoji));
  ok("a malformed escape is kept as text, not thrown", decodeAdValue("50%off") === "50%off" && decodeAdValue("%E0%A4%A") === "%E0%A4%A");
  ok("mixed case is kept for display", decodeAdValue("Spring Roofs") === "Spring Roofs");
  ok("the daily column is decoded and case-folded", cleanUtm("new+traffic+campaign") === "new traffic campaign" && cleanUtm("New%20Traffic%20Campaign") === "new traffic campaign");
}

// ── 2. The owner's exact Ads Manager string, field by field ─────────────────
{
  const OWNER = "utm_source=facebook&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&utm_term={{adset.name}}&campaign_id={{campaign.id}}&adset_id={{adset.id}}&ad_id={{ad.id}}&placement={{placement}}&site_source_name={{site_source_name}}";
  const ownerPairs = OWNER.split("&");
  ok("the template shown is a superset of the owner's string", ownerPairs.every((p) => META_URL_PARAMETERS.split("&").includes(p)));
  ok("the template is not URL-encoded (Meta wants the braces raw)", /\{\{campaign\.name\}\}/.test(META_URL_PARAMETERS) && !/%7B/i.test(META_URL_PARAMETERS));
  ok("the doc cited is Meta's dynamic-parameters page", META_URL_PARAMETERS_DOC === "https://www.facebook.com/business/help/2360940870872492");
  // What Meta substitutes on a real click: %20 for spaces, per its own doc.
  const clicked = OWNER
    .replace("{{campaign.name}}", "Spring%20Roofs%20%26%20Gutters")
    .replace("{{ad.name}}", "Video%201")
    .replace("{{adset.name}}", "Toronto%2035%20and%20up")
    .replace("{{campaign.id}}", "120254631999170581")
    .replace("{{adset.id}}", "120254631999170582")
    .replace("{{ad.id}}", "120254631999170583")
    .replace("{{placement}}", "instagram_stories")
    .replace("{{site_source_name}}", "ig");
  const a = cleanAdParams(readAdQuery(`?${clicked}&fbclid=IwAR123`));
  ok("campaign name + id", a.campaignName === "Spring Roofs & Gutters" && a.campaignId === "120254631999170581", JSON.stringify(a));
  ok("ad set name + id (utm_term carries the name)", a.adsetName === "Toronto 35 and up" && a.adsetId === "120254631999170582");
  // The owner's rule, and its one cost: a "+" (raw or %2B) reads as a space,
  // because that is how "new traffic campaign" arrived as
  // "new+traffic+campaign". A campaign genuinely named "35+" reads "35".
  ok("a plus in a name reads as a space (the owner's rule, stated)", decodeAdValue("Toronto%2035%2B") === "Toronto 35");
  ok("ad name + id (utm_content carries the name)", a.adName === "Video 1" && a.adId === "120254631999170583");
  ok("placement and site source", a.placement === "instagram_stories" && a.siteSource === "ig");
  ok("utm_source=facebook but the network is instagram", a.utmSource === "facebook" && a.network === "instagram");
  ok("fbclid presence only", a.hasFbclid === true && !JSON.stringify(a).includes("IwAR123"));
  ok("withMetaParameters keeps the base query and hash", withMetaParameters("https://fieldquo.com/?lang=fr#top") === `https://fieldquo.com/?lang=fr&${META_URL_PARAMETERS}#top` && withMetaParameters("javascript:alert(1)") === null);
}

// ── 3. Meta's automatic parameters (what production holds today) ───────────
{
  const auto = cleanAdParams({ utm_source: "ig", utm_medium: "paid", utm_campaign: "120254631999170581" });
  ok("a numeric utm_campaign is an id with no name", auto.campaignId === "120254631999170581" && auto.campaignName === null);
  ok("utm_source=ig is instagram", auto.network === "instagram");
  ok("numeric utm_term / utm_content are ad set / ad ids", (() => { const x = cleanAdParams({ utm_term: "120254631999170582", utm_content: "120254631999170583" }); return x.adsetId === "120254631999170582" && x.adId === "120254631999170583" && !x.adsetName && !x.adName; })());
  ok("utm_id is a campaign id", cleanAdParams({ utm_id: "120254631999170581" }).campaignId === "120254631999170581");
  ok("site source beats placement beats utm_source", metaNetwork({ siteSource: "msg", placement: "instagram_feed", utmSource: "ig" }) === "messenger" && metaNetwork({ placement: "audience_network_classic" }) === "audience_network" && metaNetwork({ placement: "threads_stream" }) === "threads" && metaNetwork({ utmSource: "facebook" }) === null);
  ok("a bad site source or placement is dropped", cleanAdParams({ site_source_name: "xx", placement: "<b>feed</b>" }).siteSource === null && cleanAdParams({ placement: "Facebook Feed!" }).placement === null);
}

// ── 4. The beacon → the stored landing ─────────────────────────────────────
{
  const pv = sanitiseEvent({ e: "page_view", p: "/pricing", r: null, us: "facebook", um: "paid_social", uc: "Spring Roofs", c: "facebook", ad: { utm_campaign: "Spring+Roofs", campaign_id: "120254631999170581", site_source_name: "ig", placement: "instagram_reels", utm_content: "Video 1" } });
  ok("an Instagram click with an fbclid is instagram, not facebook", pv.meta?.src === "instagram", JSON.stringify(pv.meta));
  ok("meta.ad keeps the display-cased names and ids", pv.meta?.ad?.cn === "Spring Roofs" && pv.meta.ad.cid === "120254631999170581" && pv.meta.ad.an === "Video 1" && pv.meta.ad.ss === "ig" && pv.meta.ad.fb === 1);
  ok("the daily utm_campaign column is the case-folded name", pv.utmCampaign === "spring roofs");
  const legacy = sanitiseEvent({ e: "page_view", p: "/pricing", r: null, us: "ig", um: "paid", uc: "120254631999170581", c: "facebook" });
  ok("an older beacon with utm_source=ig is instagram too", legacy.meta?.src === "instagram" && !legacy.meta.ad);
  const client = sanitiseEvent({ e: "page_view", p: "/book/acme", r: null, us: "facebook", ad: { campaign_name: "Contractor's own campaign" } });
  ok("a client surface never keeps a contractor's campaign", client && client.surface === "client" && !client.meta?.ad);
  const later = sanitiseEvent({ e: "page_view", p: "/pricing" });
  ok("a later (non-landing) view carries no source", later.meta === null);
  ok("trafficSource: google_ads click id is not overridden by a Meta network", trafficSource({ clickNetwork: "google_ads", network: "instagram" }) === "google_ads");
  const hostile = sanitiseEvent({ e: "page_view", p: "/", r: null, us: "x", ad: { campaign_name: "<script>alert(1)</script>".repeat(50), campaign_id: "1;DROP TABLE", ad_id: "12345678901234567890123456789" } });
  ok("hostile ad params are cleaned, not stored raw", !/[<>]/.test(JSON.stringify(hostile.meta)) && !hostile.meta.ad?.cid && !hostile.meta.ad?.aid && Array.from(hostile.meta.ad.cn).length <= AD_VALUE_MAX);
  ok("an array or string `ad` is ignored", sanitiseEvent({ e: "page_view", p: "/", r: null, ad: ["x"] }).meta?.ad === undefined && sanitiseEvent({ e: "page_view", p: "/", r: null, ad: "campaign_name=x" }).meta?.ad === undefined);
  const daily = rollup([{ ...pv, language: "en", createdAt: new Date("2026-09-25T10:00:00Z"), isDemo: false }]);
  ok("rollup writes the decoded campaign row and the instagram source row", [...daily.values()].some((d) => d.event === "utm_campaign" && d.path === "spring roofs") && [...daily.values()].some((d) => d.event === "source" && d.path === "instagram"));
  const trackLib = read("lib/analytics/track.js");
  ok("the beacon sends ad params on marketing pages only, bounded", /AD_PARAMS_SURFACES = new Set\(\["marketing"\]\)/.test(trackLib) && /AD_BEACON_MAX = 200/.test(trackLib));
  const worst = JSON.stringify({ v: 1, a: "a".repeat(40), l: "en", vp: "desktop", ev: [{ e: "page_view", p: "/pricing", r: "x".repeat(200), us: "x".repeat(200), um: "x".repeat(200), uc: "x".repeat(200), c: "facebook", ad: Object.fromEntries(["utm_content", "utm_term", "utm_id", "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name", "placement", "site_source_name", "utm_campaign"].map((k) => [k, "é".repeat(200)])) }] });
  ok("the largest landing the beacon can build fits the 8KB envelope", Buffer.byteLength(worst) < MAX_BATCH_BYTES, `${Buffer.byteLength(worst)} bytes`);
}

// ── 5. Grouping ─────────────────────────────────────────────────────────────
{
  const g = groupAdRows([
    { campaignName: "new traffic campaign", visitorId: "a", metrics: { views: 1 } },
    { campaignName: "New Traffic Campaign", visitorId: "b", metrics: { views: 1 } },
    { campaignName: "New Traffic Campaign", visitorId: "b", metrics: { views: 1 } },
    { campaignId: "120254631999170581", visitorId: "c", metrics: { views: 5 } },
    { campaignName: "🎉 Launch", visitorId: "d", metrics: { views: 2 } },
    { visitorId: "z", metrics: { views: 7 } },
  ], ["views"]);
  const named = g.campaigns.find((c) => c.key === "name:new traffic campaign");
  ok("spellings merge, best spelling shown", named && named.metrics.views === 3 && named.name === "New Traffic Campaign" && named.visitors === 2);
  const idOnly = g.campaigns.find((c) => c.key === "id:120254631999170581");
  ok("an id-only campaign stays apart, flagged name-missing", idOnly && idOnly.nameMissing === true && idOnly.name === null && idOnly.metrics.views === 5);
  ok("untagged rows are not a campaign", g.untagged.metrics.views === 7 && !g.campaigns.some((c) => c.key === "none"));
  ok("sorted by views", g.campaigns[0].key === "id:120254631999170581");
  const joined = groupAdRows([
    { campaignId: "120254631999170581", metrics: { views: 5 } },
    { campaignName: "new traffic campaign", metrics: { views: 3 } },
    { campaignName: "New Traffic Campaign", campaignId: "120254631999170581", adsetName: "CA", adName: "Video 1", metrics: { views: 1 } },
  ], ["views"]);
  ok("a landing with both id and name joins id → name", joined.campaigns.length === 1 && joined.campaigns[0].name === "New Traffic Campaign" && joined.campaigns[0].metrics.views === 9 && joined.campaigns[0].nameMissing === false);
  const ad = joined.campaigns[0].adsets.find((s) => s.name === "CA")?.ads?.[0];
  ok("ad set ▸ ad nesting", ad && ad.name === "Video 1" && ad.metrics.views === 1);
  const ambiguous = groupAdRows([
    { campaignName: "Brand", campaignId: "111111111111111111", metrics: { views: 1 } },
    { campaignName: "Brand", campaignId: "222222222222222222", metrics: { views: 1 } },
    { campaignName: "Brand", metrics: { views: 1 } },
  ], ["views"]);
  ok("a name seen with two ids is not guessed onto either", ambiguous.campaigns.length === 3);
  const html = renderToStaticMarkup(createElement("span", null, decodeAdValue("%3Cscript%3Ealert(1)%3C/script%3E") || ""));
  ok("a campaign name renders as text", !/<script/i.test(html));
  const page = read("app/platform/analytics/page.js");
  ok("the page renders names as React text only", !/dangerouslySetInnerHTML/.test(page) && /\(name not sent\)/.test(page) && /add \{MACRO_FOR\[kind\]\} to the URL parameters/.test(page));
  ok("the old utm_campaign dimension table is gone", !/By campaign \(utm_campaign\)/.test(page) && /data-campaign-table/.test(page));
  ok("the copy button reports failure honestly", /Could not copy/.test(page) && /navigator\.clipboard\?\.writeText/.test(page) && /setState\("failed"\)/.test(page));
}

// ── 6. First ad touch and conversions ──────────────────────────────────────
{
  const T = (m) => new Date(Date.UTC(2026, 8, 20, 10, m));
  const landings = [
    { createdAt: T(0), visitorId: "v1", utmSource: null, utmMedium: null, utmCampaign: null, meta: { src: "direct" } },
    { createdAt: T(5), visitorId: "v1", utmSource: "ig", utmMedium: "paid", utmCampaign: "120254631999170581", meta: { src: "instagram" } },
    { createdAt: T(9), visitorId: "v1", utmSource: "facebook", utmMedium: "paid_social", utmCampaign: "spring roofs", meta: { src: "facebook", ad: { cn: "Spring Roofs", cid: "999999999999999999" } } },
    { createdAt: T(1), visitorId: "v1", meta: null },
  ];
  const ft = firstTouchOf(landings);
  ok("first AD touch: the earliest landing naming a campaign (a direct visit before it is skipped)", ft && ft.cid === "120254631999170581" && ft.src === "instagram" && ft.at === T(5).toISOString(), JSON.stringify(ft));
  ok("no landing named a campaign → no first touch", firstTouchOf([landings[0]]) === null && firstTouchOf([]) === null && firstTouchOf("x") === null);
  ok("adOfLanding reads meta.ad over the columns", adOfLanding(landings[2]).campaignName === "Spring Roofs");

  // utm.ft: set once, never from the body.
  const stored = { utm_campaign: "old", ft: { cn: "First", cid: "120254631999170581" } };
  ok("ft is kept once set", utmWithFirstTouch(stored, { utm_campaign: "new" }, { cn: "Later" }).ft.cn === "First");
  ok("ft is set when absent", utmWithFirstTouch(null, null, { cn: "First" }).ft.cn === "First");
  ok("the three tags still follow the newest capture", utmWithFirstTouch(stored, { utm_campaign: "new" }, null).utm_campaign === "new");
  ok("nothing at all is still null", utmWithFirstTouch(null, null, null) === null);
  const body = normaliseCapture({ email: "a@b.co", step: "team", firstName: "A", utm: { utm_campaign: "x", ft: { cn: "Forged" } }, firstTouch: { cn: "Forged" } });
  ok("a posted ft / firstTouch is never read from the body", !body.lead.firstTouch && !body.lead.utm?.ft);
  const plan = planCaptureWrite({ existing: { stepReached: "account", utm: { ft: { cn: "Kept" } } }, incoming: { ...body.lead, firstTouch: { cn: "Other" } } });
  ok("planCaptureWrite keeps the stored first touch", plan.data.utm.ft.cn === "Kept" && plan.data.utm.utm_campaign === "x");
  const floor = read("lib/signup/salesFloor.js");
  ok("the capture reads the first touch on the server, once", /if \(read\.lead\.visitorId && !existing\?\.utm\?\.ft/.test(floor) && /firstTouchForVisitor\(client, read\.lead\.visitorId, now\)/.test(floor));

  const future = new Date(Date.now() + 20 * 86_400_000);
  const co = (over = {}) => ({ isDemo: false, createdAt: T(30), trialEndsAt: future, subscription: null, ...over });
  const leads = [
    { visitorId: "v1", stepReached: "services", utm: null, completedCompanyId: "c1", skipReason: null, completedCompany: co() },
    { visitorId: "v2", stepReached: "team", utm: { ft: { cn: "Spring Roofs", cid: "999999999999999999" } }, completedCompanyId: null, completedCompany: null },
    { visitorId: null, stepReached: "account", utm: { utm_campaign: "new+traffic+campaign" }, completedCompanyId: null, completedCompany: null },
    { visitorId: "v4", stepReached: "checkout", utm: null, completedCompanyId: "c4", skipReason: null, completedCompany: co({ subscription: { status: "active", accessLockedAt: null, pastDueSince: null, canceledAt: null } }) },
    { visitorId: "v5", stepReached: "services", utm: null, completedCompanyId: "c5", skipReason: "company_exists", completedCompany: co() },
    { visitorId: "v6", stepReached: "services", utm: null, completedCompanyId: "c6", skipReason: null, completedCompany: co({ isDemo: true }) },
  ];
  const byVisitor = new Map([["v1", landings]]);
  ok("attribution basis: stored ft, then the browser's landings, then the link's tags", leadAttribution(leads[1], byVisitor).basis === "stored" && leadAttribution(leads[0], byVisitor).basis === "visitor" && leadAttribution(leads[2], byVisitor).basis === "link" && leadAttribution(leads[3], byVisitor).basis === null);
  ok("a trial is the shared classification; paying is the paying bucket", leadOutcome(leads[0]).trial && !leadOutcome(leads[0]).paying && leadOutcome(leads[3]).trial && leadOutcome(leads[3]).paying);
  ok("the cron's 'company already on the books' match is not this person's trial", !leadOutcome(leads[4]).trial);
  ok("a demo company is never a trial (it never walked /signup)", !leadOutcome(leads[5]).trial);
  ok("signup started = past the account step (or finished)", !leadOutcome(leads[2]).signup && leadOutcome(leads[1]).signup && leadOutcome(leads[0]).signup);
  ok("an unloaded subscription is never read as 'no card'", !leadOutcome({ completedCompanyId: "x", stepReached: "services", completedCompany: { isDemo: false, trialEndsAt: future } }).trial);

  const r = campaignRows({ landings, dailyCampaign: [{ path: "new traffic campaign", count: 4 }], leads, visitorLandings: byVisitor });
  const g = groupAdRows(r.rows, CAMPAIGN_METRICS, { sortKey: "views" });
  const idc = g.campaigns.find((c) => c.id === "120254631999170581");
  ok("the id campaign gets v1's trial", idc && idc.metrics.trials === 1 && idc.metrics.signups === 1 && idc.metrics.views === 1, JSON.stringify(idc?.metrics));
  const spring = g.campaigns.find((c) => c.id === "999999999999999999");
  ok("the stored-ft signup lands on its campaign", spring && spring.metrics.signups === 1 && spring.metrics.trials === 0);
  const ntc = g.campaigns.find((c) => c.key === "name:new traffic campaign");
  ok("older daily views and the link-tagged signup merge into the decoded name", ntc && ntc.metrics.views === 4 && ntc.metrics.signups === 0);
  ok("breakdowns count landings and click ids", r.breakdowns.landings === 3 && r.attributionBasis.stored === 1 && r.attributionBasis.visitor === 1);
  ok("fbclid presence is counted only out of landings that could carry it", r.breakdowns.paramLandings === 1 && r.breakdowns.fbclidLandings === 0);
  const total = (k) => g.campaigns.reduce((n, c) => n + c.metrics[k], 0) + g.untagged.metrics[k];
  ok("campaigns + untagged reconcile to every signup row", total("signups") === leads.filter((l) => leadOutcome(l).signup).length && total("trials") === leads.filter((l) => leadOutcome(l).trial).length);
}

console.log(`${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
