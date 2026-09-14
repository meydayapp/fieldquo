#!/usr/bin/env node
//
// scripts/check-sales-site-kind.mjs
//
//   npm run check:sales-site-kind
//
// Whose site is the URL on a prospect's record — and what every reader does
// when it is not theirs.
//
// The case that made this a question: Ring A Ling Upholstery & Carpet
// Cleaners (Randolph NY) listed www.ethicalservices.com, a carpet-cleaner
// DIRECTORY. The crawler read it perfectly and every reader believed it was
// theirs: "Has a website of their own", "No enquiry form", "No client portal"
// (the member login was the directory's), and the directory's own service@
// became the lead's email. The fixtures under scripts/fixtures/site-kind/ are
// that site's real HTML, fetched with curl on 2026-09-14, and they travel
// through the SAME path production does — extractPage → crawlEvidence →
// pagesFromEvidence → normaliseCrawl — so the classifier is checked on what
// the database actually stores, not on a hand-shaped page.
//
// Executed, not read, wherever executing is possible: the classifier against
// the real directory, a real contractor's site, a Facebook URL, a franchise,
// a profile-path listing, hostile input; the capability consequences on the
// same crawl with and without the verdict; the analyzer handler against a
// stub database (no email written from a listing, no trade from its copy);
// the rep's sentences; the NO_WEBSITE rule firing; the lead score; the
// https→http fallback against a fake network; and the two excerpt readers
// handing a listing's pages to nobody. The few string rules are scoped to
// one brace-matched function each, for the reason check-sales-crawl.mjs
// gives.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name) => readFileSync(join(here, "fixtures", "site-kind", name), "utf8");

let fail = 0;
let pass = 0;
const ok = (message, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${message}`);
  } else {
    fail++;
    console.log(`  FAIL ${message}${got === undefined ? "" : `  — got ${JSON.stringify(got)?.slice(0, 600)}`}`);
  }
  return Boolean(cond);
};
const section = (title) => console.log(`\n${title}\n`);

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
function matchDelims(src, start) {
  const closers = { "(": ")", "{": "}", "[": "]" };
  const stack = [];
  let quote = null;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (closers[ch]) stack.push(closers[ch]);
    else if (ch === ")" || ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return -1;
      if (!stack.length) return i;
    }
  }
  return -1;
}
function functionSource(src, name) {
  const sig = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = sig.exec(src);
  if (!m) return null;
  const paramClose = matchDelims(src, m.index + m[0].length - 1);
  if (paramClose === -1) return null;
  const open = src.indexOf("{", paramClose);
  if (open === -1) return null;
  const close = matchDelims(src, open);
  return close === -1 ? null : src.slice(m.index, close + 1);
}
const read = (f) => stripComments(readFileSync(join(here, "..", f), "utf8"));

// ── A fake database, installed before anything imports lib/db ─────────────
//
// Only what the code under test asks of it: the crawler's host policy and
// evidence writes, the analyzer's reads and its transaction. Every write is
// kept so an assertion reads what was written rather than what was returned.
const store = { prospects: new Map(), evidence: [], hosts: new Map(), written: { capabilities: [], evidence: [], prospectUpdates: [], inferences: [] }, counts: 0 };
function resetStore() {
  store.prospects.clear();
  store.evidence.length = 0;
  store.hosts.clear();
  store.written = { capabilities: [], evidence: [], prospectUpdates: [], inferences: [] };
  store.counts = 0;
}
let nextId = 1;
const fakeDb = {
  async $transaction(arg) {
    if (typeof arg === "function") return arg(fakeDb);
    const out = [];
    for (const w of arg) out.push(await w);
    return out;
  },
  company: { async findUnique() { return null; } },
  prospect: {
    async findUnique({ where }) { return store.prospects.get(where.id) || null; },
    async update({ where, data }) {
      const row = store.prospects.get(where.id);
      Object.assign(row, data);
      return row;
    },
    async updateMany({ where, data }) {
      store.written.prospectUpdates.push({ where, data });
      const row = store.prospects.get(where.id);
      if (!row) return { count: 0 };
      if ("tradeKey" in where && row.tradeKey !== where.tradeKey) return { count: 0 };
      if ("hasWebsite" in where && row.hasWebsite !== where.hasWebsite) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
    async count() { return store.counts; },
  },
  prospectEvidence: {
    async createMany({ data }) { store.evidence.push(...data); return { count: data.length }; },
    async create({ data }) { store.written.evidence.push(data); return { id: `ev${nextId++}` }; },
    async deleteMany() { return { count: 0 }; },
    async findMany({ where }) {
      if (where?.normalizedValue?.startsWith) {
        return store.evidence.filter((e) => e.prospectId === where.prospectId && String(e.normalizedValue || "").startsWith(where.normalizedValue.startsWith) && (!where.detector || e.detector === where.detector));
      }
      if (where?.type === "page_content") return store.evidence.filter((e) => e.prospectId === where.prospectId && e.type === "page_content");
      return store.evidence.filter((e) => e.prospectId === where.prospectId);
    },
    async findFirst() { return null; },
  },
  prospectTechnology: { async findMany() { return []; } },
  prospectCapability: {
    async findMany() { return []; },
    async upsert({ create }) { store.written.capabilities.push(create); return create; },
  },
  prospectInference: {
    async findUnique() { return null; },
    async upsert({ create }) { store.written.inferences.push(create); return create; },
  },
  salesSuppression: { async findMany() { return []; } },
  crawlHostPolicy: {
    async findUnique({ where }) { return store.hosts.get(where.host) || null; },
    async create({ data }) {
      const row = { id: `h${store.hosts.size}`, host: data.host, robotsAllowed: null, robotsFetchedAt: null, crawlDelayMs: null, lastRequestAt: null, requestCount: 0, blockedUntil: null, blockReason: null, dnsFailures: 0, ...data };
      store.hosts.set(data.host, row);
      return row;
    },
    async update({ where, data }) {
      const row = store.hosts.get(where.host);
      for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === "object" && "increment" in v ? (row[k] || 0) + v.increment : v;
      return row;
    },
    async updateMany({ where, data }) {
      const row = store.hosts.get(where.host);
      if (!row) return { count: 0 };
      if ("lastRequestAt" in where) {
        const wanted = where.lastRequestAt;
        const have = row.lastRequestAt;
        const same = (wanted === null && have === null) || (wanted && have && new Date(wanted).getTime() === new Date(have).getTime());
        if (!same) return { count: 0 };
      }
      for (const [k, v] of Object.entries(data)) row[k] = v && typeof v === "object" && "increment" in v ? (row[k] || 0) + v.increment : v;
      return { count: 1 };
    },
  },
};
globalThis.__prisma = fakeDb;
globalThis.__pool = { query: async () => ({ rows: [] }), end: async () => {} };

// ── A fake network ─────────────────────────────────────────────────────────
function makeResponse({ status = 200, headers = {}, body = "" }) {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const parts = body ? [new TextEncoder().encode(body)] : [];
  let index = 0;
  return {
    status,
    headers: { get: (n) => lower[String(n).toLowerCase()] ?? null },
    body: { getReader() { return { async read() { if (index >= parts.length) return { done: true }; return { done: false, value: parts[index++] }; }, async cancel() {} }; } },
    async arrayBuffer() { return new ArrayBuffer(0); },
  };
}
function makeNet(routes, { fallback = { status: 404, body: "not found" } } = {}) {
  const requests = [];
  const impl = async (url) => {
    requests.push(String(url));
    const key = Object.keys(routes).find((k) => String(url) === k);
    const spec = key ? routes[key] : fallback;
    if (spec.throws) throw Object.assign(new Error(spec.throws), { code: spec.throws });
    return makeResponse(spec);
  };
  impl.requests = requests;
  return impl;
}
const publicLookup = async () => [{ address: "104.18.32.7" }];
const htmlRoute = (body) => ({ status: 200, headers: { "content-type": "text/html; charset=UTF-8" }, body });

const html = await import("@/lib/sales/crawl/html");
const evidence = await import("@/lib/sales/crawl/evidence");
const technology = await import("@/lib/sales/intel/technology");
const siteKind = await import("@/lib/sales/intel/siteKind");
const capabilityDetect = await import("@/lib/sales/intel/capabilityDetect");
const prospectView = await import("@/lib/sales/prospectView");
const rules = await import("@/lib/sales/intel/rules");
const opportunity = await import("@/lib/sales/intel/opportunity");
const confidence = await import("@/lib/sales/intel/confidence");
const leadScore = await import("@/lib/sales/intel/leadScore");
const policy = await import("@/lib/sales/crawl/policy");
const crawlSite = await import("@/lib/sales/crawl/crawlSite");
const analyze = await import("@/lib/sales/pipeline/handlers/analyzeCapabilities");
const inferFromSite = await import("@/lib/sales/pipeline/handlers/inferFromSite");
const intelDb = await import("@/lib/sales/intel/db");

const { classifySiteKind, notTheirOwnSite, siteKindFromEvidence, platformProfileHost, knownDirectoryHost, listingPath, brandAgreement, directorySignals } = siteKind;

/** A site, as the database would hand it back: extracted, written as
 *  evidence rows, rebuilt into a crawl. The production round trip. */
function storedCrawl(pages) {
  const records = pages.map(({ url, body, via = "nav" }) =>
    ({ ...html.extractPage({ html: body, finalUrl: url, requestedUrl: url, status: 200, contentType: "text/html", bytes: body.length }), via, navMatch: null }),
  );
  const rows = evidence.crawlEvidence(records);
  return { rows, crawl: technology.normaliseCrawl(technology.pagesFromEvidence(rows)) };
}

const ES = "http://www.ethicalservices.com";
const ethical = storedCrawl([
  { url: `${ES}/`, body: fixture("ethicalservices-home.html"), via: "start" },
  { url: `${ES}/about.php`, body: fixture("ethicalservices-about.html") },
  { url: `${ES}/contact.php`, body: fixture("ethicalservices-contact.html") },
]);
const RING = { businessName: "Ring A Ling Upholstery & Carpet Cleaners", websiteUrl: `${ES}`, host: "www.ethicalservices.com" };

const ROTH = "https://rothssolution.com";
const roths = storedCrawl([
  { url: `${ROTH}/`, body: fixture("roths-home.html"), via: "start" },
  { url: `${ROTH}/contact_us`, body: fixture("roths-contact.html") },
]);

const CAP = (result, code) => result.capabilities.find((c) => c.code === code);

// ═══════════════════════════════════════════════════════════════════════════
section("1. The classifier, on the real directory and a real contractor");
// ═══════════════════════════════════════════════════════════════════════════
{
  // Without the record's URL, so the KNOWN-HOST rung cannot answer and the
  // page signals have to. (ethicalservices.com is on the known list too —
  // asserted below — but the list is not what this section is about.)
  const r = classifySiteKind({ pages: ethical.crawl, businessName: RING.businessName, sharedHostCount: 0 });
  ok("Ethical Services is a directory, from its pages alone", r.kind === "directory", r);
  ok("…decided with confidence", r.confidence >= 0.85, r.confidence);
  ok("…named by its own title", r.brand === "Ethical Services", r.brand);
  ok("…because its menu says Find a Provider", r.reasons.some((x) => /find a provider/i.test(x)), r.reasons);
  ok("…and List Your Business", r.reasons.some((x) => /list your business/i.test(x)), r.reasons);
  ok("…and Search the directory", r.reasons.some((x) => /search the directory/i.test(x)), r.reasons);
  ok("…and Member Login", r.reasons.some((x) => /member login/i.test(x)), r.reasons);
  ok("…and a provider search asking for a city", r.reasons.some((x) => /provider search form.*city/i.test(x)), r.reasons);
  ok("…and a login form with a password field", r.reasons.some((x) => /login form/i.test(x)), r.reasons);
  ok("…and a brand that shares no word with Ring A Ling", r.reasons.some((x) => /shares no word/i.test(x)), r.reasons);
  ok("…with evidence rows a rep can open", r.evidence.length >= 4 && r.evidence.every((e) => e.detector === "site_kind" && e.sourceUrl), r.evidence.map((e) => e.type));
  ok("…typed as the link, form and meta observations they are", r.evidence.some((e) => e.type === "link") && r.evidence.some((e) => e.type === "form") && r.evidence.some((e) => e.type === "meta"), r.evidence.map((e) => e.type));
  ok("…each normalised under the site_kind prefix", r.evidence.every((e) => e.normalizedValue.startsWith("site_kind:")));
  ok("with the record's URL the known-host rung answers first, at 0.95", classifySiteKind({ pages: ethical.crawl, businessName: RING.businessName, websiteUrl: RING.websiteUrl }).confidence === 0.95);
  ok("…so a crawl of it that failed still says directory", classifySiteKind({ pages: null, websiteUrl: RING.websiteUrl, businessName: RING.businessName }).kind === "directory");

  const own = classifySiteKind({ pages: roths.crawl, businessName: "Roth's Solution", websiteUrl: `${ROTH}/`, sharedHostCount: 0 });
  ok("Roth's Solution is their own site", own.kind === "own", own);
  ok("…because the title names the business", own.reasons.some((x) => /title carries the business's own name/.test(x)), own.reasons);
  ok("…at high confidence", own.confidence === 0.9);
  ok("…and cites no evidence — 'own' is the premise, not a finding", own.evidence.length === 0);
  const unnamed = classifySiteKind({ pages: roths.crawl, businessName: "Northline Gutters LLC", websiteUrl: `${ROTH}/`, sharedHostCount: 0 });
  ok("the same site under a name it does not carry is STILL own — a mismatch alone decides nothing", unnamed.kind === "own", unnamed);
  ok("…at the lower confidence", unnamed.confidence === 0.6);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Platform hosts, known directories, franchises, listing paths");
// ═══════════════════════════════════════════════════════════════════════════
{
  const fb = classifySiteKind({ pages: null, businessName: "Sam's Masonry", websiteUrl: "https://www.facebook.com/samsmasonry/" });
  ok("a Facebook URL is a platform profile, with no page at all", fb.kind === "platform_profile", fb);
  ok("…at 0.95", fb.confidence === 0.95);
  ok("…citing the host", fb.evidence.length === 1 && fb.evidence[0].normalizedValue === "site_kind:platform_profile:facebook.com", fb.evidence);
  ok("m.facebook.com hits by suffix", platformProfileHost("https://m.facebook.com/x") === "facebook.com");
  ok("notfacebook.com does not", platformProfileHost("https://notfacebook.com/x") === null);
  ok("google.com/maps is a profile", platformProfileHost("https://www.google.com/maps/place/x") === "google.com/maps");
  ok("sites.google.com is a site builder, not a profile", platformProfileHost("https://sites.google.com/view/excavation-rimouski") === null);
  ok("wixsite.com is a site builder, not a profile", platformProfileHost("https://coffragelc.wixsite.com/site") === null);
  ok("business.site is a (dead) Google profile", platformProfileHost("https://sams-masonry.business.site/") === "business.site");
  ok("Pages Jaunes is a known directory", knownDirectoryHost("https://www.pj.ca/fr/business/x") === "pj.ca");
  ok("411habitation is a known directory", knownDirectoryHost("https://www.411habitation.com/plombiers/montreal/anjou-3/plomberie-anjou.htm") === "411habitation.com");
  ok("hub.biz is, by suffix", knownDirectoryHost("https://k-j-remodeling-of-ny-corporation.hub.biz/") === "hub.biz");
  const yp = classifySiteKind({ pages: null, businessName: "Paysagement Chambly", websiteUrl: "https://www.yp.ca/bus/Paysagement-Chambly/1234.html" });
  ok("a Yellow Pages URL is a directory even though the crawler cannot read it", yp.kind === "directory" && yp.confidence === 0.95, yp);

  // A franchise: hundreds of prospects share the host, the pages are the
  // franchisor's, the title names the brand. The measured trap.
  const servpro = storedCrawl([{ url: "https://www.servpro.com/locations/ny/servpro-of-north-east-bronx", body: `<html><head><title>SERVPRO of North East Bronx | Restoration and Cleaning Services near Bronx, NY</title></head><body><nav><a href="/">Home</a><a href="/services">Services</a><a href="/locations">Find a Location</a><a href="/franchise-opportunities">Own a Franchise</a></nav><p>${"Fire and water damage restoration in the Bronx. ".repeat(30)}</p><p><a href="tel:+17185551234">(718) 555-1234</a></p></body></html>`, via: "start" }]);
  const fr = classifySiteKind({ pages: servpro.crawl, businessName: "SERVPRO of North East Bronx", websiteUrl: "https://www.servpro.com/locations/ny/servpro-of-north-east-bronx", sharedHostCount: 322 });
  ok("a franchise page shared by 322 prospects is OWN — a shared host never decides alone", fr.kind === "own", fr);
  ok("…the count is recorded as a reason, not a verdict", fr.reasons.some((x) => /322 other prospects/.test(x)), fr.reasons);
  ok("…and 'Find a Location' / 'Own a Franchise' fire nothing", !fr.reasons.some((x) => /menu says/.test(x)), fr.reasons);

  // A profile path on a shared host whose pages did not load.
  const near = classifySiteKind({ pages: null, businessName: "Cellino Plumbing", websiteUrl: "http://www.plumbersnearyou.com/profile/cellino-plumbing-inc-elma-new-york.html", sharedHostCount: 55 });
  ok("a /profile/ path on a host 55 prospects share is a directory with no page read", near.kind === "directory" && near.confidence === 0.7, near);
  ok("listingPath sees /profile/…", listingPath("http://x.test/profile/cellino-plumbing.html") !== null);
  ok("…and /Contractor-SubContractor/…", listingPath("https://web.buildersinstitute.org/Contractor-SubContractor/Arnold-Wile-Associates-77") !== null);
  ok("…but not a franchise's /locations/…", listingPath("https://www.servpro.com/locations/ny/x") === null);
  ok("…nor a plain service page", listingPath("https://acme.com/services/roofing") === null);
  const nearAlone = classifySiteKind({ pages: null, businessName: "Cellino Plumbing", websiteUrl: "http://example.test/profile/cellino.html", sharedHostCount: 0 });
  ok("a /profile/ path on its own, nothing loaded, is unknown — the URL is not enough", nearAlone.kind === "unknown", nearAlone);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The signals, one at a time, and what each may not do");
// ═══════════════════════════════════════════════════════════════════════════
{
  const site = (title, nav, extra = "") =>
    storedCrawl([{ url: "https://x.test/", body: `<html><head><title>${title}</title></head><body><nav>${nav}</nav><p>${"Words about the business. ".repeat(40)}</p>${extra}</body></html>`, via: "start" }]).crawl;

  const dealer = classifySiteKind({ pages: site("Renostone | Natural stone", `<a href="/">Home</a><a href="/find-a-dealer">FIND A DEALER</a><a href="/products">Products</a>`), businessName: "Renostone", websiteUrl: "https://x.test/" });
  ok("a manufacturer's 'Find a dealer' beside its own name is own", dealer.kind === "own", dealer);
  ok("…and the link text and its path are ONE phrase, not two", dealer.reasons.filter((x) => /find a provider/.test(x)).length === 1, dealer.reasons);

  const union = classifySiteKind({ pages: site("Bricklayers Local 3", `<a href="/">Home</a><a href="/join">Become a Member</a>`, `<form action="/login" method="post"><input name="user"><input type="password" name="pw"></form>`), businessName: "Bricklayers Local 3", websiteUrl: "https://x.test/" });
  ok("a union local's 'Become a member' plus a login form is own", union.kind === "own", union);

  const offHost = classifySiteKind({ pages: site("Peranich & Shelp Construction", `<a href="/">Home</a><a href="https://www.trex.com/find-a-contractor/">Find a Contractor</a><a href="https://www.trex.com/list-your-business">List your business</a>`), businessName: "Peranich & Shelp Construction", websiteUrl: "https://x.test/" });
  ok("directory phrases on OFF-HOST links are ignored", !offHost.reasons.some((x) => /menu says/.test(x)) && offHost.kind === "own", offHost.reasons);

  const hub = classifySiteKind({ pages: site("KJ Remodeling - Hubbiz", `<a href="/">Home</a><a href="/add">Add your Company for Free</a><a href="/claim">Claim this Listing</a>`), businessName: "KJ Remodeling", websiteUrl: "https://x.test/" });
  ok("two decisive phrases decide against a title that carries the business's name — a listing page is titled after what it lists", hub.kind === "directory" && hub.confidence === 0.9, hub);

  const oneDecisive = classifySiteKind({ pages: site("Four Seasons Tree Service", `<a href="/">Home</a><a href="/list">List Your Business</a>`), businessName: "Four Seasons Tree Service", websiteUrl: "https://x.test/" });
  ok("one decisive phrase under the business's own title is own", oneDecisive.kind === "own", oneDecisive);
  const oneDecisiveMismatch = classifySiteKind({ pages: site("Hubbiz", `<a href="/">Home</a><a href="/list">List Your Business</a>`), businessName: "KJ Remodeling", websiteUrl: "https://x.test/" });
  ok("…and the same phrase under somebody else's title is a directory", oneDecisiveMismatch.kind === "directory", oneDecisiveMismatch);

  const generic = brandAgreement({ pages: technology.loadedPages(site("Home", `<a href="/">Home</a>`)), businessName: "Speakeasy Intercom" });
  ok("a title of 'Home' is not a mismatch — it is not a brand", generic.agreement === null, generic);
  const suspended = brandAgreement({ pages: technology.loadedPages(site("Account Suspended", `<a href="/">Home</a>`)), businessName: "GV Excavation" });
  ok("'Account Suspended' is not a mismatch either", suspended.agreement === null, suspended);
  const plural = brandAgreement({ pages: technology.loadedPages(site("24/7 Locksmith Services in Bronx, NY", `<a href="/">Home</a>`)), businessName: "KeyMe Locksmiths" });
  ok("'Locksmiths' shares a word with 'Locksmith Services' — a plural is not somebody else", plural.agreement !== "mismatch", plural);
  const real = brandAgreement({ pages: technology.loadedPages(site("Ethical Services | Carpet Cleaners", `<a href="/">Home</a>`)), businessName: "Ring A Ling Upholstery & Carpet Cleaners" });
  ok("'Ethical Services' against Ring A Ling IS a mismatch", real.agreement === "mismatch", real);
  const numbered = brandAgreement({ pages: technology.loadedPages(site("Ethical Services", `<a href="/">Home</a>`)), businessName: "9265-1234 Québec inc." });
  ok("a numbered company has no tokens and no agreement either way", numbered.agreement === null, numbered);

  const search = directorySignals(technology.loadedPages(site("X", `<a href="/">Home</a>`, `<form action="./listing.php" method="GET"><input name="CITY"><select name="STATE"></select></form>`)));
  ok("a GET form posting to listing.php with a CITY field is a provider search", search.searchForm !== null, search);
  const wpSearch = directorySignals(technology.loadedPages(site("X", `<a href="/">Home</a>`, `<form action="/" method="get"><input name="s"></form>`)));
  ok("a WordPress site search is not", wpSearch.searchForm === null, wpSearch);
  const post = directorySignals(technology.loadedPages(site("X", `<a href="/">Home</a>`, `<form action="/find" method="post"><input name="city"></form>`)));
  ok("a POST form is not a provider search — a quote form asks for a city too", post.searchForm === null, post);

  for (const hostile of [null, undefined, {}, [], "x", 42, { pages: "no" }, { pages: [null, 1, "x", { status: 200, text: "a", links: [null, 5] }] }]) {
    let r = null;
    let threw = false;
    try { r = classifySiteKind({ pages: hostile, businessName: hostile, websiteUrl: hostile, sharedHostCount: hostile }); } catch { threw = true; }
    ok(`hostile input ${JSON.stringify(hostile)?.slice(0, 40)} does not throw and answers a kind`, !threw && siteKind.SITE_KINDS.includes(r?.kind), r);
  }
  ok("notTheirOwnSite is the pair and nothing else", notTheirOwnSite("directory") && notTheirOwnSite("platform_profile") && !notTheirOwnSite("own") && !notTheirOwnSite("unknown") && !notTheirOwnSite(null));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The capability consequences, on the same crawl");
// ═══════════════════════════════════════════════════════════════════════════
{
  // The page-signal verdict (no record URL), so the evidence rows below are
  // the classifier's menu, form and title observations.
  const verdict = classifySiteKind({ pages: ethical.crawl, businessName: RING.businessName, sharedHostCount: 0 });
  const withVerdict = capabilityDetect.detectCapabilities({ crawl: ethical.crawl, technologies: [], prospect: { websiteUrl: RING.websiteUrl, hasWebsite: true }, siteKind: verdict });
  const without = capabilityDetect.detectCapabilities({ crawl: ethical.crawl, technologies: [], prospect: { websiteUrl: RING.websiteUrl, hasWebsite: true } });

  ok("without the verdict the crawl reads as a website of their own (the old bug, reproduced)", CAP(without, "WEBSITE").value === true);
  ok("…with a mailto: that becomes 'publishes an email'", CAP(without, "EMAIL_CONTACT").value === true);
  ok("…and absences earned off the directory's pages", ["ONLINE_BOOKING", "CLIENT_PORTAL", "ONLINE_PAYMENT"].every((c) => CAP(without, c).value === false), without.capabilities.map((c) => [c.code, c.value]));

  ok("with the verdict WEBSITE is FALSE", CAP(withVerdict, "WEBSITE").value === false, CAP(withVerdict, "WEBSITE"));
  ok("…with the reason", CAP(withVerdict, "WEBSITE").reason === "not_their_own_site");
  ok("…at the classifier's confidence", CAP(withVerdict, "WEBSITE").confidence === verdict.confidence);
  const head = CAP(withVerdict, "WEBSITE").evidence[0];
  ok("…its first evidence row is the verdict, site_kind:directory", head.type === "site_kind" && head.normalizedValue === "site_kind:directory", head);
  ok("…carrying the site's own name", head.rawValue === "brand=Ethical Services", head.rawValue);
  ok("…followed by the classifier's rows, re-stamped as the capability detector's", CAP(withVerdict, "WEBSITE").evidence.length === 1 + verdict.evidence.length && CAP(withVerdict, "WEBSITE").evidence.every((e) => e.detector === capabilityDetect.CAPABILITY_DETECTOR));
  ok("…and siteKindFromEvidence reads the kind and brand back off them", JSON.stringify(siteKindFromEvidence(CAP(withVerdict, "WEBSITE").evidence)) === JSON.stringify({ kind: "directory", brand: "Ethical Services", host: null }), siteKindFromEvidence(CAP(withVerdict, "WEBSITE").evidence));
  const withUrl = capabilityDetect.detectCapabilities({ crawl: ethical.crawl, technologies: [], prospect: { websiteUrl: RING.websiteUrl }, siteKind: classifySiteKind({ pages: ethical.crawl, businessName: RING.businessName, websiteUrl: RING.websiteUrl }) });
  ok("…and with the record's URL the verdict row carries the host: site_kind:directory:ethicalservices.com", CAP(withUrl, "WEBSITE").evidence[0].normalizedValue === "site_kind:directory:ethicalservices.com" && siteKindFromEvidence(CAP(withUrl, "WEBSITE").evidence).host === "ethicalservices.com", CAP(withUrl, "WEBSITE").evidence[0]);
  ok("…the classifier's page-signal rows alone name no kind — they are signals, the verdict row is the verdict", siteKindFromEvidence(verdict.evidence) === null);
  ok("…while a known-host row alone does name it, without a brand", siteKindFromEvidence([{ normalizedValue: "site_kind:directory:pj.ca", rawValue: "pj.ca" }])?.kind === "directory" && siteKindFromEvidence([{ normalizedValue: "site_kind:directory:pj.ca", rawValue: "pj.ca" }]).brand === null);

  // The pipeline normalises a crawl twice — loadCrawl, then the detector —
  // and that used to empty every page's anchor texts on the second pass.
  const once = ethical.crawl;
  const twice = technology.normaliseCrawl(once);
  ok("normaliseCrawl is idempotent — link texts survive a second pass", twice.pages[0].linkTexts.length === once.pages[0].linkTexts.length && once.pages[0].linkTexts.length > 20, [once.pages[0].linkTexts.length, twice.pages[0].linkTexts.length]);
  ok("…and the whole crawl deep-equals itself normalised again", JSON.stringify(twice) === JSON.stringify(once));
  ok("…so the directory is still a directory through the pipeline's double normalisation", classifySiteKind({ pages: twice, businessName: RING.businessName }).kind === "directory");

  for (const code of capabilityDetect.DETECTED_CAPABILITY_CODES) {
    if (code === "WEBSITE" || code === "EMAIL_CONTACT" || code === "PHONE_CONTACT") continue;
    const row = CAP(withVerdict, code);
    ok(`${code} is NULL on a directory — never false, whatever the pages carried`, row.value === null && row.reason === "not_their_own_site" && row.evidence.length === 0, row);
  }
  ok("EMAIL_CONTACT stays TRUE — the address on the listing is a real observation", CAP(withVerdict, "EMAIL_CONTACT").value === true);
  ok("…with the directory page as its sourceUrl", CAP(withVerdict, "EMAIL_CONTACT").evidence[0].sourceUrl.startsWith(ES), CAP(withVerdict, "EMAIL_CONTACT").evidence[0]);
  ok("PHONE_CONTACT, not found on the directory, is NULL and not false", CAP(withVerdict, "PHONE_CONTACT").value === null && CAP(withVerdict, "PHONE_CONTACT").reason === "not_their_own_site", CAP(withVerdict, "PHONE_CONTACT"));
  ok("the result names the kind", withVerdict.siteKind === "directory");

  const unknownKind = capabilityDetect.detectCapabilities({ crawl: ethical.crawl, technologies: [], prospect: { websiteUrl: RING.websiteUrl }, siteKind: { kind: "unknown", confidence: 0, reasons: [], evidence: [] } });
  ok("an UNKNOWN kind changes nothing — it is not a finding", JSON.stringify(unknownKind.capabilities.map((c) => [c.code, c.value])) === JSON.stringify(without.capabilities.map((c) => [c.code, c.value])));
  const ownKind = capabilityDetect.detectCapabilities({ crawl: roths.crawl, technologies: [], prospect: { websiteUrl: `${ROTH}/` }, siteKind: classifySiteKind({ pages: roths.crawl, businessName: "Roth's Solution", websiteUrl: `${ROTH}/` }) });
  ok("an OWN verdict on Roth's leaves WEBSITE true and the form found", CAP(ownKind, "WEBSITE").value === true && CAP(ownKind, "LEAD_CAPTURE_FORM").value === true, ownKind.capabilities.map((c) => [c.code, c.value]));

  // A platform profile with nothing loaded: WEBSITE false, everything null.
  const fbVerdict = classifySiteKind({ pages: null, businessName: "Sam's Masonry", websiteUrl: "https://www.facebook.com/samsmasonry/" });
  const fbCaps = capabilityDetect.detectCapabilities({ crawl: null, technologies: [], prospect: { websiteUrl: "https://www.facebook.com/samsmasonry/" }, siteKind: fbVerdict });
  ok("a Facebook page: WEBSITE false", CAP(fbCaps, "WEBSITE").value === false && CAP(fbCaps, "WEBSITE").evidence[0].normalizedValue === "site_kind:platform_profile:facebook.com", CAP(fbCaps, "WEBSITE"));
  ok("…and every other capability null", fbCaps.capabilities.filter((c) => c.code !== "WEBSITE").every((c) => c.value === null));

  ok("the detector version moved to 3, so a version-2 false read off a directory is superseded", capabilityDetect.CAPABILITY_DETECTOR_VERSION === "3");
  const src = read("lib/sales/intel/capabilityDetect.js");
  const fn = functionSource(src, "detectCapabilities");
  ok("detectCapabilities gates on notTheirOwnSite, before any signal is read", fn && /notTheirOwnSite\(siteKind\.kind\)/.test(fn) && fn.indexOf("KEPT_ON_A_LISTING.has(code)") < fn.indexOf("for (const signal of SIGNALS[code]"), fn?.slice(0, 200));
  ok("…and the absence branch refuses a false on a listing", fn && /allowed\s*=\s*!listing\s*&&/.test(fn));
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The analyzer: no email from a listing, no trade from its copy");
// ═══════════════════════════════════════════════════════════════════════════
{
  resetStore();
  store.prospects.set("ring", { id: "ring", businessName: RING.businessName, tradingNames: [], websiteUrl: RING.websiteUrl, domain: "ethicalservices.com", hasWebsite: true, tradeKey: null, phoneE164: "+17163584006", addressLine: null, postalCode: null, city: "Randolph" });
  const pages = ethical.crawl.pages;
  const result = await analyze.handleAnalyzeCapabilities({ task: { prospectId: "ring" }, payload: { prospectId: "ring", pages }, db: fakeDb });
  ok("the stage completes", result.done === true, result);
  ok("…and its note names the directory by title", /a directory \(Ethical Services\)/.test(result.note), result.note);
  const website = store.written.capabilities.find((c) => c.code === "WEBSITE");
  ok("WEBSITE false was written", website?.value === false, website);
  ok("…citing the verdict evidence", website && website.evidenceIds.length >= 2);
  const emailRow = store.written.capabilities.find((c) => c.code === "EMAIL_CONTACT");
  ok("EMAIL_CONTACT true was written", emailRow?.value === true, emailRow);
  ok("…but Prospect.email was NOT filled from the directory's mailto:", !store.written.prospectUpdates.some((u) => u.data?.email), store.written.prospectUpdates);
  ok("…and the note does not claim an email was written", !/email \S+@\S+ written/.test(result.note), result.note);
  ok("the trade was not established from the directory's copy", !store.written.prospectUpdates.some((u) => u.data?.tradeKey) && !/trade established/.test(result.note), result.note);
  ok("every non-contact capability was written null", store.written.capabilities.filter((c) => !["WEBSITE", "EMAIL_CONTACT", "PHONE_CONTACT"].includes(c.code)).every((c) => c.value === null), store.written.capabilities.map((c) => [c.code, c.value]));

  // The same crawl on a site that IS theirs still writes the email.
  resetStore();
  store.prospects.set("roth", { id: "roth", businessName: "Roth's Solution", tradingNames: [], websiteUrl: `${ROTH}/`, domain: "rothssolution.com", hasWebsite: true, tradeKey: null, phoneE164: null, addressLine: null, postalCode: null, city: null });
  const own = await analyze.handleAnalyzeCapabilities({ task: { prospectId: "roth" }, payload: { prospectId: "roth", pages: roths.crawl.pages }, db: fakeDb });
  ok("Roth's own site: WEBSITE true", store.written.capabilities.find((c) => c.code === "WEBSITE")?.value === true, own.note);
  ok("…and no directory note", !/directory/.test(own.note), own.note);

  const handlerSrc = read("lib/sales/pipeline/handlers/analyzeCapabilities.js");
  const wc = functionSource(handlerSrc, "writeCapabilities");
  ok("writeCapabilities gates the email write on !listing", wc && /capability\.value === true && !listing/.test(wc));
  const h = functionSource(handlerSrc, "handleAnalyzeCapabilities");
  ok("the handler passes the verdict INTO detectCapabilities", h && /detectCapabilities\(\{[^}]*siteKind/.test(h));
  ok("…and refuses the trade from a listing", h && /siteBelongsToProspect: identity\.corroborated && !listing/.test(h));
  ok("…and counts the shared host from the database", h && /countProspectsOnHost\(/.test(h));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The rep's sentences");
// ═══════════════════════════════════════════════════════════════════════════
{
  const verdict = classifySiteKind({ pages: ethical.crawl, businessName: RING.businessName, websiteUrl: RING.websiteUrl, sharedHostCount: 0 });
  const detected = capabilityDetect.detectCapabilities({ crawl: ethical.crawl, technologies: [], prospect: { websiteUrl: RING.websiteUrl }, siteKind: verdict });
  // Rows as the database would hold them: evidence with ids, capabilities citing them.
  let id = 1;
  const evidenceRows = [];
  const capabilities = detected.capabilities.map((c) => {
    const evidenceIds = c.evidence.map((e) => { const row = { id: `e${id++}`, ...e }; evidenceRows.push(row); return row.id; });
    return { code: c.code, value: c.value, confidence: c.confidence, evidenceIds };
  });
  const view = prospectView.prospectView({ prospect: { id: "ring", businessName: RING.businessName, websiteUrl: RING.websiteUrl, hasWebsite: true, email: "service@ethicalservices.com", emailSource: "mailto" }, capabilities, evidence: evidenceRows });
  const byCode = new Map(view.capabilities.map((c) => [c.code, c]));
  ok("the Website bullet: \"Their listed website is a directory (Ethical Services), not their own site\"", byCode.get("WEBSITE")?.text === "Their listed website is a directory (Ethical Services), not their own site", byCode.get("WEBSITE"));
  ok("…as a gap, known, sayable", byCode.get("WEBSITE").state === "gap" && byCode.get("WEBSITE").known === true && byCode.get("WEBSITE").sayable === true, byCode.get("WEBSITE"));
  ok("…with a detail that names the pitch", /no website of its own/.test(byCode.get("WEBSITE").detail), byCode.get("WEBSITE").detail);
  ok("the Email bullet says where the address was found", byCode.get("EMAIL_CONTACT")?.text === "An email address is listed on the directory (Ethical Services), not on a site of theirs", byCode.get("EMAIL_CONTACT"));
  ok("…and warns it may be the directory's own", /may be the directory's own address/.test(byCode.get("EMAIL_CONTACT").detail) && /service@ethicalservices\.com/.test(byCode.get("EMAIL_CONTACT").detail), byCode.get("EMAIL_CONTACT").detail);
  ok("the Client portal bullet is UNKNOWN — never 'No client portal'", byCode.get("CLIENT_PORTAL")?.state === "unknown" && byCode.get("CLIENT_PORTAL").text === "Client portal: not established", byCode.get("CLIENT_PORTAL"));
  ok("…and its detail says why: the listed site is not theirs", /Their listed website is a directory \(Ethical Services\), not their own site — nothing on it says what they can do/.test(byCode.get("CLIENT_PORTAL").detail), byCode.get("CLIENT_PORTAL").detail);
  ok("the Enquiry form bullet is unknown too, not 'No enquiry form'", byCode.get("LEAD_CAPTURE_FORM")?.state === "unknown");
  ok("the view carries the kind once at the top", view.siteKind?.kind === "directory" && view.siteKind.brand === "Ethical Services", view.siteKind);
  ok("no bullet says 'Has a website of their own'", !view.capabilities.some((c) => c.text === "Has a website of their own"));
  ok("no bullet says 'No client portal' or 'No enquiry form'", !view.capabilities.some((c) => /^No (client portal|enquiry form|online booking|way to pay)/.test(c.text)), view.capabilities.map((c) => c.text));

  const fbWords = prospectView.listingWords({ kind: "platform_profile", brand: null, host: "www.facebook.com" });
  ok("a Facebook profile is said as one", fbWords.sentence === "Their listed website is a Facebook page, not their own site", fbWords);
  const ypWords = prospectView.listingWords({ kind: "directory", brand: null, host: "www.yp.ca" });
  ok("a directory with no rendered title is named by host", ypWords.sentence === "Their listed website is a directory (yp.ca), not their own site", ypWords);

  // A site that is theirs: the sentences are exactly what they were.
  const ownView = prospectView.prospectView({ prospect: { id: "r" }, capabilities: [{ code: "WEBSITE", value: true, confidence: 0.95, evidenceIds: [] }, { code: "CLIENT_PORTAL", value: null, confidence: 0, evidenceIds: [] }], evidence: [] });
  ok("an own site keeps 'Has a website of their own'", ownView.capabilities.find((c) => c.code === "WEBSITE").text === "Has a website of their own");
  ok("…and the plain unknown detail", ownView.capabilities.find((c) => c.code === "CLIENT_PORTAL").detail === "We could not look, so nothing is claimed either way. Ask them.");
  ok("…and no siteKind", ownView.siteKind === null);
  ok("a WEBSITE false with no site_kind evidence (discovery found none) is still 'No website — we looked'", prospectView.prospectView({ prospect: { id: "n" }, capabilities: [{ code: "WEBSITE", value: false, confidence: 0.8, evidenceIds: ["g"] }], evidence: [{ id: "g", type: "google_field", normalizedValue: "WEBSITE:absent" }] }).capabilities[0].text === "No website — we looked and there is none");

  ok("site_kind evidence scores as a direct detection signal", prospectView.SIGNAL_BY_EVIDENCE_TYPE.site_kind === "detection.site_kind" && confidence.SIGNALS["detection.site_kind"]?.category === "detection_direct");
  ok("…and the seed carries it", confidence.seedConfidenceRules().some((r) => r.signal === "detection.site_kind"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The opportunity engine and the lead score");
// ═══════════════════════════════════════════════════════════════════════════
{
  const verdict = classifySiteKind({ pages: ethical.crawl, businessName: RING.businessName, websiteUrl: RING.websiteUrl, sharedHostCount: 0 });
  const detected = capabilityDetect.detectCapabilities({ crawl: ethical.crawl, technologies: [], prospect: { websiteUrl: RING.websiteUrl }, siteKind: verdict });
  let id = 1;
  const capabilities = detected.capabilities.map((c) => ({ code: c.code, value: c.value, confidence: c.confidence, evidenceIds: c.evidence.map(() => `e${id++}`) }));
  const seeded = rules.seedOpportunityRules();
  const built = opportunity.buildOpportunities({ capabilities, technologies: [], rules: seeded });
  const codes = built.opportunities.map((o) => o.ruleCode);
  ok("NO_WEBSITE fires on the directory", codes.includes("NO_WEBSITE"), codes);
  ok("…and cites the verdict evidence", built.opportunities.find((o) => o.ruleCode === "NO_WEBSITE").evidenceIds.length >= 1);
  ok("…with a reason true of a business that has only a listing", /no website of its own/.test(built.opportunities.find((o) => o.ruleCode === "NO_WEBSITE").reason), built.opportunities.find((o) => o.ruleCode === "NO_WEBSITE").reason);
  ok("WEBSITE_NO_BOOKING does NOT fire — there is no site to book on", !codes.includes("WEBSITE_NO_BOOKING"), codes);
  ok("EMAIL_ONLY_CONTACT does NOT fire — the email is the directory's", !codes.includes("EMAIL_ONLY_CONTACT"), codes);
  ok("NO_ONLINE_PAYMENT does NOT fire — nobody looked at their site", !codes.includes("NO_ONLINE_PAYMENT"), codes);
  ok("the rule's name says 'of their own'", seeded.find((r) => r.code === "NO_WEBSITE").name === "No website of their own");

  const score = leadScore.computeLeadScore({ prospect: { phoneE164: "+17163584006", websiteUrl: RING.websiteUrl, tradeKey: "cleaning" }, capabilities, technologies: [], opportunities: built.opportunities });
  ok("the lead score awards nothing for 'has a website'", !score.reasons.some((r) => /website/i.test(r.label) && r.weight > 0 && !/no website/i.test(r.label)), score.reasons);
  ok("…and does not double-count the listed URL as a missing website", !score.reasons.some((r) => /source lists no website/.test(r.label)), score.reasons);
  ok("…and counts the NO_WEBSITE opportunity as a thing to talk about", score.reasons.some((r) => /thing.* to talk about/.test(r.label) && r.weight > 0), score.reasons);
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. https → http, only when https would not connect");
// ═══════════════════════════════════════════════════════════════════════════
{
  ok("ECONNREFUSED is eligible", policy.httpFallbackEligible("ECONNREFUSED"));
  ok("a bare TypeError (undici's TLS failure) is eligible", policy.httpFallbackEligible("TypeError"));
  ok("a timeout is eligible", policy.httpFallbackEligible("timeout"));
  ok("a DNS failure is not — port 80 will not resolve either", !policy.httpFallbackEligible("unsafe_host:dns_error:ENOTFOUND") && !policy.httpFallbackEligible("ENOTFOUND"));
  ok("an unsafe URL is not", !policy.httpFallbackEligible("unsafe_url:scheme_not_allowed"));
  ok("a politeness refusal is not", !policy.httpFallbackEligible("not_permitted:blocked"));
  ok("too many redirects is not — the site answered", !policy.httpFallbackEligible("too_many_redirects"));
  ok("nothing is not", !policy.httpFallbackEligible(null) && !policy.httpFallbackEligible(""));

  const HOME = `<html><head><title>Ethical Services</title></head><body><nav><a href="/">Home</a><a href="about.php">About</a></nav><p>${"Carpet cleaners near you. ".repeat(30)}</p></body></html>`;
  const seed = (over = {}) => {
    resetStore();
    store.prospects.set("p1", { id: "p1", businessName: "Ring A Ling", domain: "ethicalservices.com", websiteUrl: "www.ethicalservices.com", hasWebsite: null, lastCrawledAt: null, contentHash: null, doNotContactAt: null, doNotContactReason: null, ...over });
  };
  let t = Date.now();
  const deps = (net) => ({ db: fakeDb, fetchImpl: net, lookup: publicLookup, sleep: async (ms) => { t += ms; }, clock: () => new Date(t) });

  {
    seed();
    const net = makeNet({
      "https://www.ethicalservices.com/robots.txt": { throws: "ECONNREFUSED" },
      "http://www.ethicalservices.com/robots.txt": { status: 404, body: "" },
      "http://www.ethicalservices.com/": htmlRoute(HOME),
      "http://www.ethicalservices.com/about.php": htmlRoute(HOME.replace("Ethical Services", "About Ethical Services")),
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: deps(net) });
    ok("a schemeless address whose https refuses is crawled over http", result.outcome === "crawled", result);
    ok("…https was tried first", net.requests[0] === "https://www.ethicalservices.com/robots.txt", net.requests);
    ok("…then http's robots.txt", net.requests[1] === "http://www.ethicalservices.com/robots.txt", net.requests);
    ok("…and no further https request was made", net.requests.slice(1).every((u) => u.startsWith("http://")), net.requests);
    ok("…the result says so", result.schemeFallback?.from === "https" && result.schemeFallback.to === "http" && result.schemeFallback.error === "ECONNREFUSED", result.schemeFallback);
    ok("…and so does the note", /https refused \(ECONNREFUSED\); crawled over http/.test(result.note), result.note);
    const envelopes = store.evidence.filter((e) => e.type === "page_fetch").map((e) => JSON.parse(e.rawValue));
    ok("every page_fetch envelope records the scheme actually used", envelopes.length >= 2 && envelopes.every((e) => e.scheme === "http"), envelopes.map((e) => [e.finalUrl, e.scheme]));
    ok("…and the fallback, with https's error", envelopes.every((e) => e.schemeFallback?.from === "https" && e.schemeFallback.error === "ECONNREFUSED"), envelopes[0]?.schemeFallback);
    ok("…and the pages rebuild with http URLs", technology.pagesFromEvidence(store.evidence).pages.every((p) => p.finalUrl.startsWith("http://")));
  }
  {
    seed({ websiteUrl: "https://www.ethicalservices.com/" });
    const net = makeNet({
      "https://www.ethicalservices.com/robots.txt": { status: 404, body: "" },
      "https://www.ethicalservices.com/": { status: 500, body: "" },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: deps(net) });
    ok("a site that ANSWERS on https — even with a 500 — is never downgraded", net.requests.every((u) => u.startsWith("https://")), net.requests);
    ok("…the result carries no fallback", result.schemeFallback === null || result.schemeFallback === undefined, result);
    const envelopes = store.evidence.filter((e) => e.type === "page_fetch").map((e) => JSON.parse(e.rawValue));
    ok("…and the envelope says https, no fallback", envelopes.every((e) => e.scheme === "https" && e.schemeFallback === null), envelopes);
  }
  {
    seed({ websiteUrl: "https://www.ethicalservices.com/" });
    const net = makeNet({
      "https://www.ethicalservices.com/robots.txt": { status: 404, body: "" },
      "https://www.ethicalservices.com/": { throws: "ECONNRESET" },
    });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: deps(net) });
    ok("a home page that fails AFTER robots answered on https is a failure, not a downgrade", result.outcome === "failed" && net.requests.every((u) => u.startsWith("https://")), { result, requests: net.requests });
  }
  {
    seed();
    const net = makeNet({
      "https://www.ethicalservices.com/robots.txt": { throws: "unsafe_host:dns_error:ENOTFOUND" },
    });
    // The fake resolver answers; the throw stands in for a resolver failure
    // surfacing from fetch. Eligibility is what is under test.
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: deps(net) });
    ok("a DNS failure is not retried over http", net.requests.length === 1 && result.outcome === "failed", net.requests);
  }
  {
    // A DERIVED address: no websiteUrl, a derived_site inference. Never plaintext.
    seed({ websiteUrl: null });
    const saved = fakeDb.prospectInference.findUnique;
    fakeDb.prospectInference.findUnique = async () => ({ value: "ethicalservices.com", confidence: 0.5, observedAt: new Date() });
    const net = makeNet({ "https://ethicalservices.com/robots.txt": { throws: "ECONNREFUSED" }, "http://ethicalservices.com/robots.txt": { status: 404, body: "" }, "http://ethicalservices.com/": htmlRoute(HOME) });
    const result = await crawlSite.crawlProspectSite({ prospectId: "p1", deps: deps(net) });
    fakeDb.prospectInference.findUnique = saved;
    ok("a derived address is never downgraded to http", net.requests.length === 1 && result.outcome === "failed", { requests: net.requests, result });
  }
  const crawlSrc = read("lib/sales/crawl/crawlSite.js");
  const fn = functionSource(crawlSrc, "crawlProspectSite");
  ok("the fallback is gated on https, !derived and httpFallbackEligible, in one condition", fn && /robotsRes\.error && crawlUrl\.protocol === "https:" && !derived && httpFallbackEligible\(robotsRes\.error\)/.test(fn));
  ok("…and the home page is fetched from the origin the fallback chose", fn && /fetchOne\(crawlUrl\.toString\(\)\)/.test(fn));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The excerpt readers hand a listing's pages to nobody");
// ═══════════════════════════════════════════════════════════════════════════
{
  resetStore();
  store.prospects.set("ring", { id: "ring", businessName: RING.businessName, tradeKey: null, city: "Randolph", province: "NY", campaignId: null, assignedRepId: null, lastCrawledAt: new Date() });
  store.evidence.push(
    { prospectId: "ring", type: "page_content", sourceUrl: `${ES}/about.php`, rawValue: "Ethical Services has served carpet cleaners since 1994. ".repeat(10), normalizedValue: `${ES}/about.php` },
    { prospectId: "ring", type: "site_kind", detector: capabilityDetect.CAPABILITY_DETECTOR, sourceUrl: `${ES}/`, rawValue: "brand=Ethical Services", normalizedValue: "site_kind:directory:www.ethicalservices.com" },
  );
  const stored = await intelDb.loadStoredSiteKind("ring", { deps: { db: fakeDb } });
  ok("loadStoredSiteKind reads the verdict back", stored?.kind === "directory" && stored.brand === "Ethical Services", stored);
  const inputs = await inferFromSite.loadSiteInferenceInputs(fakeDb, "ring");
  ok("INFER_FROM_SITE gets NO pages for a directory", inputs.pages.length === 0 && inputs.siteKind?.kind === "directory", inputs);
  store.evidence.splice(1, 1);
  const own = await inferFromSite.loadSiteInferenceInputs(fakeDb, "ring");
  ok("…and the same rows without the verdict are read as before", own.pages.length === 1 && own.siteKind === null, own);
  ok("loadStoredSiteKind is null without a verdict", (await intelDb.loadStoredSiteKind("ring", { deps: { db: fakeDb } })) === null);

  const infSrc = read("lib/sales/pipeline/handlers/inferFromSite.js");
  ok("loadSiteInferenceInputs consults loadStoredSiteKind", /loadStoredSiteKind\(prospectId/.test(functionSource(infSrc, "loadSiteInferenceInputs") || ""));
  const scriptSrc = read("lib/sales/pipeline/handlers/generateCallScript.js");
  const lcs = functionSource(scriptSrc, "loadCallScriptInputs");
  ok("loadCallScriptInputs consults loadStoredSiteKind", lcs && /loadStoredSiteKind\(prospectId/.test(lcs));
  ok("…and hands the script no pages for a listing", lcs && /pages: siteKind \? \[\] : selectPageExcerpts\(pageRows\)/.test(lcs));

  const countSrc = read("lib/sales/intel/db.js");
  const cnt = functionSource(countSrc, "countProspectsOnHost");
  ok("countProspectsOnHost counts on Prospect.domain and excludes the prospect itself", cnt && /domain: host/.test(cnt) && /id: \{ not: excludeProspectId \}/.test(cnt));
  ok("…and answers null, never 0, for nothing to count", cnt && /if \(!host\) return null/.test(cnt));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Wiring");
// ═══════════════════════════════════════════════════════════════════════════
{
  const pkg = JSON.parse(readFileSync(join(here, "..", "package.json"), "utf8"));
  ok("package.json has check:sales-site-kind", typeof pkg.scripts["check:sales-site-kind"] === "string");
  ok("…and check:all runs it", /check:sales-site-kind/.test(pkg.scripts["check:all"]));
  const doc = readFileSync(join(here, "..", "docs/sales-intel/CRAWLING.md"), "utf8");
  ok("CRAWLING.md documents directories and platform profiles", /Directories and platform profiles/.test(doc));
  ok("…and the https fallback", /https.*http/i.test(doc) && /schemeFallback/.test(doc));
  const graph = read("lib/sales/prospectView.js");
  ok("prospectView reaches siteKind.js", /from "@\/lib\/sales\/intel\/siteKind"/.test(graph));
  const sk = read("lib/sales/intel/siteKind.js");
  ok("siteKind.js imports nothing with a socket in it", !/lib\/db|suppressionRules|crawl\/url/.test(sk));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
