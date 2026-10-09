// scripts/check-embed-attribution.mjs
//
//   npm run check:embed-attribution
//
// An ad click on a contractor's OWN page reaching a lead made inside a
// FieldQuo embed on that page, executed end to end against hostile input:
//
//   1. the snippet's <script> (lib/embed/snippet.js forwardScript), run in a
//      fake host page with the host's URL and cookies;
//   2. the frame reading that src as its landing (lib/tracking/landing.js);
//   3. the server keeping only what cleanLanding passes
//      (lib/tracking/attribution.js), and a frozen snapshot of what it made
//      of untouched landings BEFORE this change — "a missing parameter
//      changes nothing";
//   4. the visit row (lib/tracking/visits.js, fake database) → the lead's
//      attribution → the agency channel and row (lib/agency/*).

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

register(
  "data:text/javascript," +
    encodeURIComponent(
      'export async function resolve(s, c, n) { if (s === "@/lib/db") return { url: "data:text/javascript,export const db = globalThis.__embedAttrDb;", shortCircuit: true }; return n(s, c); }',
    ),
);
const fakeDb = { funnelVisit: {} };
globalThis.__embedAttrDb = fakeDb;

const { embedSnippet, FORWARD_PARAMS } = await import("@/lib/embed/snippet");
const { readLanding } = await import("@/lib/tracking/landing");
const attribution = await import("@/lib/tracking/attribution");
const visits = await import("@/lib/tracking/visits");
const { channelOf, adAttributionOf } = await import("@/lib/agency/channels");
const { buildLeadRow } = await import("@/lib/agency/leadRow");
const { describeAttribution } = await import("@/lib/tracking/describe");

const { cleanLanding, attributionFromVisit, attributionFromLanding, landingCarriesSignal } = attribution;
const NOW = new Date("2026-10-09T12:00:00Z");
const ORIGIN = "https://www.fieldquo.com";
const GCLID = "EAIaIQobChMI0abcdefgh_-123";
const FBCLID = "IwAR0abcdefgh123";

// ── 1. The host page ────────────────────────────────────────────────────────
/** Run a snippet's script on a fake host page; returns the frame's final src. */
function hostRun(snippet, { search = "", cookie = "", pathname = "/quote" } = {}) {
  const id = snippet.split('id="')[1].split('"')[0];
  const attrs = { src: snippet.split('src="')[1].split('"')[0] };
  const frame = { id, style: {}, contentWindow: {}, getAttribute: (k) => attrs[k] ?? null, setAttribute: (k, v) => (attrs[k] = String(v)) };
  const win = { location: { search, pathname }, addEventListener() {} };
  const doc = { cookie, getElementById: (x) => (x === id ? frame : null) };
  const body = snippet.split("<script>")[1].split("</script>")[0];
  new Function("window", "document", body)(win, doc);
  return attrs.src;
}
/** What the frame reads as its own landing, from that src. */
const frameLanding = (src) => readLanding(new URL(src).search, "https://truefinishcabinets.com/");

section("1. The snippet forwards the host page's click — and only then");
const iq = embedSnippet({ origin: ORIGIN, slug: "truefinish", widget: "instant-quote", title: "Instant estimate" });
const plain = `${ORIGIN}/embed/truefinish/instant-quote`;
{
  ok("nothing to forward → src untouched (no reload, no lone ref)", hostRun(iq, { search: "", cookie: "theme=dark" }) === plain);
  ok("…and with only unrelated parameters", hostRun(iq, { search: "?page=2&ref=friend" }) === plain);
  const g = hostRun(iq, { search: `?gclid=${GCLID}&utm_source=google&utm_medium=cpc&utm_campaign=Kitchens+Ottawa` });
  const gq = new URL(g).searchParams;
  ok("gclid and utm_* copied onto the frame", gq.get("gclid") === GCLID && gq.get("utm_campaign") === "Kitchens Ottawa" && gq.get("utm_source") === "google", g);
  ok("ref is the host page's path", gq.get("ref") === "/quote");
  const c = hostRun(iq, { search: "", cookie: `_ga=GA1.1.1; _fbc=fb.1.1791540000000.${FBCLID}; _fbp=fb.1.1791530000000.987654321; _gcl_aw=GCL.1791500000.${GCLID}` });
  const cq = new URL(c).searchParams;
  ok("the _fbc, _fbp and _gcl_aw cookies become fbc, fbp, gcl_aw", cq.get("fbc") === `fb.1.1791540000000.${FBCLID}` && cq.get("fbp") === "fb.1.1791530000000.987654321" && cq.get("gcl_aw") === `GCL.1791500000.${GCLID}`, c);
  const big = hostRun(iq, { search: `?gclid=${"A".repeat(900)}&fbclid=${FBCLID}` });
  ok("an oversized value is not forwarded at all (a cut click id is a wrong one)", !new URL(big).searchParams.has("gclid") && new URL(big).searchParams.get("fbclid") === FBCLID);
  const hostile = hostRun(iq, { search: `?utm_campaign=${encodeURIComponent('"><script>alert(1)</script>')}&gclid=${GCLID}` });
  ok("hostile values are URL-encoded into the src, never markup", !/[<>"]/.test(hostile) && new URL(hostile).searchParams.get("utm_campaign") === '"><script>alert(1)</script>');
  ok("a malformed escape on the host URL does not throw", typeof hostRun(iq, { search: "?gclid=%E0%A4%A" }) === "string");
  const funnel = embedSnippet({ origin: ORIGIN, slug: "truefinish", widget: "funnel", funnelSlug: "kitchens", title: "F" });
  ok("a funnel's src gets the parameters too", new URL(hostRun(funnel, { search: `?fbclid=${FBCLID}` })).searchParams.get("fbclid") === FBCLID);
  for (const w of ["book", "quote"]) {
    ok(`${w}: forwards`, new URL(hostRun(embedSnippet({ origin: ORIGIN, slug: "t", widget: w, title: "x" }), { search: `?gclid=${GCLID}` })).searchParams.get("gclid") === GCLID);
  }
  const rev = embedSnippet({ origin: ORIGIN, slug: "t", widget: "reviews", title: "R" });
  ok("reviews take no lead and forward nothing", hostRun(rev, { search: `?gclid=${GCLID}` }) === `${ORIGIN}/embed/t/reviews`);
  ok("every click id is in the forwarded list", ["gclid", "gbraid", "wbraid", "fbclid", "ttclid", "utm_source", "utm_term", "campaign_id"].every((k) => FORWARD_PARAMS.includes(k)));
  ok("the script is ES5 (no arrow, let, const or template)", !/=>|\blet |\bconst |`/.test(iq.split("<script>")[1].split("</script>")[0]));
}

section("2–3. Frame landing → server attribution");
{
  const google = cleanLanding(frameLanding(hostRun(iq, { search: `?gclid=${GCLID}` })), NOW);
  ok("gclid in the iframe URL → clickNetwork google_ads, source google_ads", google.clickNetwork === "google_ads" && google.source === "google_ads", google);
  ok("…the gclid is kept", google.gclid === GCLID);
  ok("…and the host path", google.hostPage === "/quote");
  ok("gbraid → google_ads (no id kept)", cleanLanding({ gbraid: "0AAAAAoabcdefgh" }, NOW).clickNetwork === "google_ads");
  ok("wbraid → google_ads", cleanLanding({ wbraid: "CkQKCQjwabcdefgh" }, NOW).clickNetwork === "google_ads");
  const meta = cleanLanding(frameLanding(hostRun(iq, { search: `?fbclid=${FBCLID}` })), NOW);
  ok("fbclid → facebook, fbc stamped by the server", meta.clickNetwork === "facebook" && meta.source === "facebook" && meta.fbc === `fb.1.${NOW.getTime()}.${FBCLID}`, meta);
  const cookieFb = cleanLanding({ fbc: `fb.1.1791540000000.${FBCLID}`, fbp: "fb.1.1791530000000.987654321" }, NOW);
  ok("the _fbc cookie alone → facebook, kept verbatim with its own landing time", cookieFb.clickNetwork === "facebook" && cookieFb.fbc === `fb.1.1791540000000.${FBCLID}`);
  ok("…with the fbp beside it", cookieFb.fbp === "fb.1.1791530000000.987654321");
  ok("the same click on URL and cookie keeps the cookie's time", cleanLanding({ fbclid: FBCLID, fbc: `fb.1.1791540000000.${FBCLID}` }, NOW).fbc === `fb.1.1791540000000.${FBCLID}`);
  ok("a different, older cookie click loses to the URL's", cleanLanding({ fbclid: FBCLID, fbc: "fb.1.1791540000000.IwARolderclick99" }, NOW).fbc === `fb.1.${NOW.getTime()}.${FBCLID}`);
  const gcl = cleanLanding({ gcl_aw: `GCL.1791500000.${GCLID}` }, NOW);
  ok("the _gcl_aw cookie alone → google_ads with its gclid", gcl.clickNetwork === "google_ads" && gcl.gclid === GCLID, gcl);
  ok("two cookies: the later click wins (Google later)", cleanLanding({ fbc: `fb.1.1791400000000.${FBCLID}`, gcl_aw: `GCL.1791500000.${GCLID}` }, NOW).clickNetwork === "google_ads");
  const later = cleanLanding({ fbc: `fb.1.1791540000000.${FBCLID}`, gcl_aw: `GCL.1791500000.${GCLID}`, fbp: "fb.1.1.1" }, NOW);
  ok("two cookies: the later click wins (Meta later) — and keeps no gclid", later.clickNetwork === "facebook" && !("gclid" in later));
  const urlWins = cleanLanding({ gclid: GCLID, fbc: `fb.1.1791540000000.${FBCLID}`, fbp: "fb.1.1791530000000.1" }, NOW);
  ok("a click on the URL beats any cookie; the loser's fbc and fbp are not kept", urlWins.clickNetwork === "google_ads" && urlWins.fbc === null && !("fbp" in urlWins), urlWins);
  ok("fbp without a Meta click is not kept", !("fbp" in cleanLanding({ fbp: "fb.1.1791530000000.1" }, NOW)));

  const hostileCases = [
    ["gclid with markup", { gclid: '"><img src=x onerror=alert(1)>' }],
    ["gclid of 501 characters", { gclid: "A".repeat(501) }],
    ["gclid of 7 characters", { gclid: "abc1234" }],
    ["fbclid with a space", { fbclid: "IwAR0abc defgh" }],
    ["fbc in the wrong shape", { fbc: "fb.9.1791540000000.IwAR0abcdefgh" }],
    ["fbc from the future", { fbc: `fb.1.${NOW.getTime() + 3 * 86400000}.${FBCLID}` }],
    ["fbc with a script", { fbc: "fb.1.1791540000000.<script>" }],
    ["gcl_aw in the wrong shape", { gcl_aw: `GCL.abc.${GCLID}` }],
    ["gcl_aw from the future", { gcl_aw: `GCL.${Math.floor(NOW.getTime() / 1000) + 3 * 86400}.${GCLID}` }],
    ["gcl_aw with a huge id", { gcl_aw: `GCL.1791500000.${"A".repeat(600)}` }],
    ["a click id that is an object", { gclid: { toString: () => GCLID } }],
    ["a click id that is an array", { gclid: [GCLID] }],
  ];
  for (const [label, raw] of hostileCases) {
    const c = cleanLanding(raw, NOW);
    ok(`dropped: ${label}`, c.clickNetwork === null && c.fbc === null && !("gclid" in c) && c.source === "direct", c);
  }
  const bigRead = readLanding(`?gclid=${"A".repeat(600)}&gcl_aw=${"G".repeat(700)}&utm_campaign=${"c".repeat(900)}`, "");
  ok("readLanding drops an oversized click id or cookie instead of cutting it", !("gclid" in bigRead) && !("gcl_aw" in bigRead) && bigRead.utm_campaign.length === 500, Object.keys(bigRead));
  for (const [label, ref, want] of [
    ["a plain path", "/quote", "/quote"],
    ["its query string is cut", "/quote?email=a@b.co&token=x", "/quote"],
    ["its fragment is cut", "/contact#form", "/contact"],
    ["an encoded path is decoded once", "/caf%C3%A9", "/café"],
    ["markup is stripped", '/"><script>x', "/scriptx"],
    ["a full URL is refused", "https://evil.example/x", null],
    ["a protocol-relative path is refused", "//evil.example/x", null],
    ["a relative path is refused", "quote", null],
  ]) {
    ok(`ref: ${label}`, (cleanLanding({ ref }, NOW).hostPage ?? null) === want, cleanLanding({ ref }, NOW).hostPage);
  }
  ok("ref is bounded to 200 characters", cleanLanding({ ref: `/${"p".repeat(400)}` }, NOW).hostPage.length === 200);
}

section("3b. A missing parameter changes nothing");
{
  // cleanLanding of these at commit c9ccebf7d (before this change), frozen.
  // The ONE difference is the gclid now kept on a gclid landing.
  const CORPUS = [
    {},
    { referrer: "www.google.com" },
    { referrer: "truefinishcabinets.com" },
    { referrer: "sunset.fieldquo.com" },
    { utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "Spring Roofs & Gutters" },
    { fbclid: "IwAR0abcdefgh123" },
    { gclid: "EAIaIQobChMI0abc" },
    { ttclid: "E.C.P.abcdefgh" },
    { ttclid: "tiktokclick123" },
    { gclid: "short" },
    { utm_source: "google", utm_medium: "cpc", utm_campaign: "21000000001" },
    { utm_campaign: "{{campaign.name}}", utm_source: "facebook" },
    { campaign_id: "120254631999170581", site_source_name: "ig", fbclid: "IwAR0abcdefgh123" },
    { utm_source: "<script>alert(1)</script>", referrer: "l.facebook.com" },
  ];
  const BEFORE = JSON.parse('[{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":null,"source":"direct","ad":null},{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":"google.com","source":"google","ad":null},{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":"truefinishcabinets.com","source":"truefinishcabinets.com","ad":null},{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":"website","source":"website","ad":null},{"utmSource":"facebook","utmMedium":"paid_social","utmCampaign":"Spring Roofs & Gutters","utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":null,"source":"facebook","ad":{"cn":"Spring Roofs & Gutters","us":"facebook","um":"paid_social"}},{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":"facebook","fbc":"fb.1.1791547200000.IwAR0abcdefgh123","referrerHost":null,"source":"facebook","ad":{"fb":1}},{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":"google_ads","fbc":null,"referrerHost":null,"source":"google_ads","ad":null},{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":null,"source":"direct","ad":null},{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":"tiktok","fbc":null,"referrerHost":null,"source":"tiktok","ad":null},{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":null,"source":"direct","ad":null},{"utmSource":"google","utmMedium":"cpc","utmCampaign":"21000000001","utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":null,"source":"google_ads","ad":{"cid":"21000000001","us":"google","um":"cpc"}},{"utmSource":"facebook","utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":null,"source":"facebook","ad":{"us":"facebook"}},{"utmSource":null,"utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":"facebook","fbc":"fb.1.1791547200000.IwAR0abcdefgh123","referrerHost":null,"source":"instagram","ad":{"cid":"120254631999170581","ss":"ig","fb":1}},{"utmSource":"scriptalert(1)/script","utmMedium":null,"utmCampaign":null,"utmContent":null,"utmTerm":null,"clickNetwork":null,"fbc":null,"referrerHost":"facebook.com","source":"scriptalert_1_script","ad":{"us":"scriptalert(1)/script"}}]');
  const sorted = (o) => JSON.stringify(Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
  CORPUS.forEach((raw, i) => {
    const now = cleanLanding(raw, NOW);
    const want = i === 6 ? { ...BEFORE[i], gclid: "EAIaIQobChMI0abc" } : BEFORE[i];
    ok(`unchanged: ${JSON.stringify(raw).slice(0, 70)}`, sorted(now) === sorted(want), now);
  });
  ok("the self-quote form files nothing from a referrer alone (as before)", attributionFromLanding({ referrer: "truefinishcabinets.com" }, NOW) === null);
  ok("…or from a bare ref", attributionFromLanding({ ref: "/quote" }, NOW) === null);
  ok("the booking embed opens no visit without a signal (as before)", landingCarriesSignal({ ref: "/contact", lang: "fr" }, NOW) === false);
  ok("…and opens one with a forwarded gclid", landingCarriesSignal({ gclid: GCLID, ref: "/contact" }, NOW) === true);
}

section("4. Visit → lead → agency feed");
{
  const created = [];
  let lacksClickColumns = false;
  fakeDb.funnelVisit = {
    async findFirst() {
      return null;
    },
    async create(args) {
      if (lacksClickColumns && ["gclid", "fbp", "hostPage"].some((k) => k in args.data)) {
        const e = new Error("The column `FunnelVisit.gclid` does not exist in the current database.");
        e.code = "P2022";
        throw e;
      }
      created.push(args.data);
      return { id: "v" };
    },
  };
  const landing = frameLanding(hostRun(iq, { search: `?gclid=${GCLID}&utm_source=google&utm_medium=cpc&utm_campaign=21000000001` }));
  await visits.openVisit({ companyId: "co", surface: "instant_quote", landing, now: NOW });
  const row = created.at(-1);
  ok("the visit row keeps the gclid and the host path", row?.gclid === GCLID && row?.hostPage === "/quote" && row?.clickNetwork === "google_ads", row);
  const attr = attributionFromVisit({ ...row, startedAt: NOW });
  ok("the lead's attribution carries the gclid", attr.gclid === GCLID && attr.clickNetwork === "google_ads");
  const lead = { source: "instant_quote", attribution: attr };
  ok("gclid in the iframe URL → lead channel google_ads", channelOf(lead) === "google_ads", channelOf(lead));
  const agencyRow = buildLeadRow({ ref: "lr_0000000000000001", createdAt: NOW, name: "Ana B", channel: channelOf(lead), attribution: adAttributionOf(lead) }, { now: NOW });
  ok("the agency lead row carries the gclid", agencyRow.gclid === GCLID && agencyRow.channel === "google_ads", agencyRow.gclid);
  ok("the lead's Came-from line names Google Ads, the click and the page", (() => {
    const d = describeAttribution(attr);
    return d.source === "google_ads" && d.adClick && d.page === "truefinishcabinets.com/quote";
  })(), describeAttribution(attr));

  const fb = attributionFromVisit({ ...(await (async () => { await visits.openVisit({ companyId: "co", surface: "funnel", landing: frameLanding(hostRun(iq, { search: `?fbclid=${FBCLID}` })), now: NOW }); return created.at(-1); })()), startedAt: NOW });
  ok("fbclid in the iframe URL → lead channel facebook_ad", channelOf({ source: "funnel", attribution: fb }) === "facebook_ad", channelOf({ source: "funnel", attribution: fb }));

  const before = created.length;
  await visits.openVisit({ companyId: "co", surface: "booking", landing: {}, now: NOW });
  const bare = created.at(-1);
  ok("a landing with nothing writes none of the new columns", created.length === before + 1 && !("gclid" in bare) && !("fbp" in bare) && !("hostPage" in bare), bare);

  lacksClickColumns = true;
  await visits.openVisit({ companyId: "co", surface: "instant_quote", landing, now: NOW });
  const fallback = created.at(-1);
  ok("before the SQL runs: the visit still opens, credited to Google, without the new columns", fallback.clickNetwork === "google_ads" && !("gclid" in fallback));

  ok("an agency-posted lead with a gclid is google_ads", channelOf({ source: "agency_funnel", attribution: { source: "agency_funnel", clickNetwork: "google_ads", gclid: GCLID } }) === "google_ads");
  ok("…without one it stays agency_funnel", channelOf({ source: "agency_funnel", attribution: { source: "agency_funnel", clickNetwork: "facebook" } }) === "agency_funnel");
  const selfQuote = attributionFromLanding(frameLanding(hostRun(embedSnippet({ origin: ORIGIN, slug: "t", widget: "quote", title: "Q" }), { search: `?gclid=${GCLID}` })), NOW);
  ok("the self-quote embed's own landing becomes its lead's attribution", selfQuote?.gclid === GCLID && channelOf({ source: "self_quote", attribution: selfQuote }) === "google_ads", selfQuote);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
