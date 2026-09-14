#!/usr/bin/env node
//
// scripts/measure-sales-services.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/measure-sales-services.mjs [--sample 2000] [--seed 11]
//   node --import ./scripts/alias-loader.mjs scripts/measure-sales-services.mjs --live 50 [--seed 11]
//
// READ-ONLY against the database in both modes. Measures what the service
// extraction and the structured-data reader find, so the numbers in the
// file headers are measured rather than guessed:
//
//   default   over the STORED evidence of N random crawled prospects — the
//             schema.org reader (schemaFacts.js) and the services extractor
//             (servicesOffered.js) run on what the crawler already wrote:
//             how many sites carry JSON-LD naming a business, a phone, an
//             email, hours, a rating, a booking action, a service list; how
//             many read as a JavaScript shell; how many services per site
//             from the rows on file; and twenty sample lists to hand-check.
//   --live N  fetches N random live sites, one at a time, politely: the real
//             robots.txt parser and the real page fetcher (timeouts, byte
//             caps, SSRF vetting), three seconds between requests, no
//             database write. Reports how many had a readable sitemap, a
//             WordPress REST index that answered, JSON-LD with services, how
//             many services the full extractor finds per site, and twenty
//             sample lists. This is the measurement the sitemap and REST
//             readers need, because the stored rows predate them.
//
// Nothing here is queued, written or requeued. The count of prospects that
// would benefit from a re-crawl (a shell home page, or no service names on
// file) is printed for the owner to decide on.
import "dotenv/config";
import { db } from "@/lib/db";
import { jsShell } from "@/lib/sales/intel/capabilityDetect";
import { normaliseCrawl, pagesFromEvidence } from "@/lib/sales/intel/technology";
import { schemaFacts } from "@/lib/sales/intel/schemaFacts";
import { servicesFrom } from "@/lib/sales/intel/servicesOffered";
import { CRAWL_EVIDENCE_TYPES } from "@/lib/sales/pipeline/handlers/detectTechnology";
import { crawlEvidence } from "@/lib/sales/crawl/evidence";
import { extractPage } from "@/lib/sales/crawl/html";
import { fetchCrawlPage } from "@/lib/sales/crawl/fetchPage";
import { robotsFetchOutcome, robotsFor } from "@/lib/sales/crawl/robots";
import { safeCrawlUrl, serviceMenu } from "@/lib/sales/crawl/url";
import { childSitemapsToFollow, parseSitemap, sitemapPages, sitemapUrlsToTry } from "@/lib/sales/crawl/sitemap";
import { WP_PAGES_PATH, WP_TYPES_PATH, looksLikeWordPress, parseWpPages, wpServiceTypes } from "@/lib/sales/crawl/structured";
import { MAX_ROBOTS_BYTES } from "@/lib/sales/crawl/policy";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 && args[at + 1] && !args[at + 1].startsWith("--") ? args[at + 1] : fallback;
};
const LIVE = args.includes("--live") ? Number(flag("live", 50)) : 0;
const SAMPLE = Number(flag("sample", 2000));
const SEED = Number(flag("seed", 11));
const DELAY_MS = 3000;

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(list, rand) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "n/a");

async function randomCrawled(n, rand) {
  const rows = await db.prospect.findMany({
    where: { lastCrawledAt: { not: null }, websiteUrl: { not: null } },
    select: { id: true, businessName: true, websiteUrl: true, tradeKey: true },
    take: 20000,
  });
  return shuffle(rows, rand).slice(0, n);
}

async function stored() {
  const rand = mulberry(SEED);
  const sample = await randomCrawled(SAMPLE, rand);
  console.log(`stored evidence of ${sample.length} random crawled prospects (seed ${SEED})\n`);
  const t = {
    prospects: 0, withJsonLd: 0, business: 0, telephone: 0, email: 0, hours: 0, rating: 0, booking: 0, schemaServices: 0,
    shell: 0, shellNoText: 0, withServices: 0, servicesTotal: 0, bySource: {}, noServicesAndShell: 0,
  };
  const dist = new Map();
  const samples = [];
  for (const p of sample) {
    const rows = await db.prospectEvidence.findMany({
      where: { prospectId: p.id, source: "website", type: { in: [...CRAWL_EVIDENCE_TYPES, "nav_link", "sitemap_url", "wp_page"] } },
      orderBy: { observedAt: "desc" },
      take: 3000,
      select: { id: true, type: true, sourceUrl: true, rawValue: true, normalizedValue: true, observedAt: true },
    });
    t.prospects += 1;
    const crawl = normaliseCrawl(pagesFromEvidence(rows.filter((r) => CRAWL_EVIDENCE_TYPES.includes(r.type))));
    const facts = crawl.pages.map((pg) => schemaFacts(pg));
    const any = (pick) => facts.some((f) => f.parsed && pick(f));
    if (facts.some((f) => f.parsed)) t.withJsonLd += 1;
    if (any((f) => f.business)) t.business += 1;
    if (any((f) => f.telephone.length)) t.telephone += 1;
    if (any((f) => f.email.length)) t.email += 1;
    if (any((f) => f.hours)) t.hours += 1;
    if (any((f) => f.aggregateRating || f.reviews)) t.rating += 1;
    if (any((f) => f.bookingAction)) t.booking += 1;
    if (any((f) => f.services.length)) t.schemaServices += 1;
    const shells = crawl.pages.filter((pg) => jsShell(pg));
    if (shells.length) {
      t.shell += 1;
      if (shells.some((pg) => !pg.renderedText)) t.shellNoText += 1;
    }
    const found = servicesFrom({ evidence: rows });
    const n = found.services.length;
    dist.set(n, (dist.get(n) || 0) + 1);
    if (n) {
      t.withServices += 1;
      t.servicesTotal += n;
      for (const [k, v] of Object.entries(found.counts)) t.bySource[k] = (t.bySource[k] || 0) + v;
    }
    if (!n && shells.length) t.noServicesAndShell += 1;
    if (n && samples.length < 20 && rand() < 0.3) samples.push({ name: p.businessName, url: p.websiteUrl, trade: p.tradeKey, services: found.services.map((s) => `${s.name} [${s.source}]`) });
  }
  console.log("Measured (stored rows — no sitemap_url / wp_page / heading / rendered_text rows exist before crawler v3):");
  console.log(`  prospects                          ${t.prospects}`);
  console.log(`  JSON-LD that parses on some page   ${t.withJsonLd} (${pct(t.withJsonLd, t.prospects)})`);
  console.log(`    …naming a business               ${t.business} (${pct(t.business, t.prospects)})`);
  console.log(`    …with a telephone                ${t.telephone} (${pct(t.telephone, t.prospects)})`);
  console.log(`    …with an email                   ${t.email} (${pct(t.email, t.prospects)})`);
  console.log(`    …with opening hours              ${t.hours} (${pct(t.hours, t.prospects)})`);
  console.log(`    …with a rating or reviews        ${t.rating} (${pct(t.rating, t.prospects)})`);
  console.log(`    …with a booking action           ${t.booking} (${pct(t.booking, t.prospects)})`);
  console.log(`    …with services by name           ${t.schemaServices} (${pct(t.schemaServices, t.prospects)})`);
  console.log(`  crawl holds a JavaScript shell     ${t.shell} (${pct(t.shell, t.prospects)}), ${t.shellNoText} with no recovered text`);
  console.log(`  prospects with ≥1 service name     ${t.withServices} (${pct(t.withServices, t.prospects)}), mean ${(t.servicesTotal / Math.max(1, t.withServices)).toFixed(1)} per site with any`);
  console.log(`  names by source                    ${JSON.stringify(t.bySource)}`);
  console.log(`  distribution (n → prospects)       ${[...dist.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" ")}`);
  console.log(`  would benefit from a v3 re-crawl   ${t.noServicesAndShell} shell-and-no-services; ${t.prospects - t.withServices} with no service names at all`);
  console.log("\nSample service lists (hand-check these):");
  for (const s of samples) console.log(`  ${s.name} (${s.trade || "no trade"}) — ${s.url}\n    ${s.services.join("; ")}`);
}

/** One live site, politely, with no database write. */
async function readLive(prospect) {
  const vetted = safeCrawlUrl(prospect.websiteUrl);
  if (!vetted.ok) return { skipped: `unsafe:${vetted.reason}` };
  const baseHost = vetted.host;
  const origin = vetted.url.origin;
  const out = { url: prospect.websiteUrl, sitemap: null, sitemapPages: 0, wp: null, wpPages: 0, shell: false, services: [], jsonLdServices: 0 };
  const robotsRes = await fetchCrawlPage({ startUrl: `${origin}/robots.txt`, baseHost, maxBytes: MAX_ROBOTS_BYTES });
  await sleep(DELAY_MS);
  const outcome = robotsFetchOutcome({ status: robotsRes.status, error: robotsRes.error });
  if (outcome.act === "blocked" || outcome.act === "unknown") return { skipped: outcome.reason };
  const rules = outcome.act === "allow_all" ? robotsFor("") : robotsFor(robotsRes.body);
  if (!rules.rootAllowed) return { skipped: "robots_disallowed" };
  const allowed = (u) => rules.allows(new URL(u).pathname).allowed;

  const home = await fetchCrawlPage({ startUrl: vetted.url.toString(), baseHost });
  await sleep(DELAY_MS);
  if (home.error || home.offHost || !home.status || home.status >= 300 || !home.body) return { skipped: `home:${home.error || home.status || "off_host"}` };
  const homePage = extractPage({ html: home.body, finalUrl: home.finalUrl, requestedUrl: home.requestedUrl, status: home.status, contentType: home.contentType, bytes: home.bytes });
  homePage.navLinks = serviceMenu({ links: homePage.links, baseHost });
  const pages = [homePage];
  const structured = { sitemaps: [], sitemapPages: [], wp: [] };

  const queue = sitemapUrlsToTry({ baseUrl: vetted.url.toString(), baseHost, robotsSitemaps: rules.sitemaps || [] });
  const seen = new Set();
  const locs = [];
  while (queue.length && structured.sitemaps.length < 3) {
    const next = queue.shift();
    if (next.from === "default" && locs.length) break;
    if (seen.has(next.url) || !allowed(next.url)) continue;
    seen.add(next.url);
    const res = await fetchCrawlPage({ startUrl: next.url, baseHost });
    await sleep(DELAY_MS);
    if (res.error || !res.status || res.status >= 300 || !res.body) {
      structured.sitemaps.push({ url: next.url, status: res.status, error: res.error || null, kind: null, urls: 0 });
      continue;
    }
    const parsed = parseSitemap(res.body, { maxUrls: 500 - locs.length });
    structured.sitemaps.push({ url: next.url, status: res.status, error: null, kind: parsed.kind, urls: parsed.urls.length });
    if (parsed.kind === "index") queue.unshift(...childSitemapsToFollow(parsed.urls, { baseHost, already: seen }).map((url) => ({ url, from: "child" })));
    else for (const loc of parsed.urls) locs.push({ loc, from: next.url });
  }
  structured.sitemapPages = sitemapPages(locs.map((l) => l.loc), { baseHost }).map((p) => ({ ...p, sourceUrl: locs[0]?.from || null }));
  out.sitemap = structured.sitemaps.find((f) => !f.error && f.status < 300 && f.urls > 0) ? "yes" : structured.sitemaps.length ? `no (${structured.sitemaps.map((f) => f.error || `http_${f.status}`).join(",")})` : "not asked";
  out.sitemapPages = structured.sitemapPages.length;

  if (looksLikeWordPress(homePage)) {
    const readWp = async (path, type) => {
      const url = `${origin}${path}`;
      if (!allowed(url)) return null;
      const res = await fetchCrawlPage({ startUrl: url, baseHost });
      await sleep(DELAY_MS);
      if (res.error || !res.status || res.status >= 300 || !res.body) {
        structured.wp.push({ url, status: res.status, error: res.error || null, pages: [], type });
        return null;
      }
      return { url, status: res.status, body: res.body, type };
    };
    const first = await readWp(WP_PAGES_PATH, "page");
    if (first) {
      const parsed = parseWpPages(first.body, { baseHost });
      structured.wp.push({ url: first.url, status: first.status, error: parsed.error, pages: parsed.pages, type: "page" });
      if (!parsed.error) {
        const types = await readWp(WP_TYPES_PATH, "types");
        if (types) {
          for (const tpe of wpServiceTypes(types.body)) {
            const list = await readWp(`/wp-json/wp/v2/${tpe.restBase}?per_page=50&_fields=id,link,title,excerpt`, tpe.restBase);
            if (list) {
              const items = parseWpPages(list.body, { baseHost });
              structured.wp.push({ url: list.url, status: list.status, error: items.error, pages: items.pages, type: tpe.restBase });
            }
          }
        }
      }
    }
    out.wp = structured.wp.some((s) => !s.error && s.status < 300) ? "yes" : `no (${structured.wp.map((s) => s.error || `http_${s.status}`).join(",") || "not asked"})`;
    out.wpPages = structured.wp.reduce((n, s) => n + (s.pages?.length || 0), 0);
  } else {
    out.wp = "not wordpress";
  }

  const rows = crawlEvidence(pages, structured).map((r, i) => ({ ...r, id: `e${i}`, observedAt: new Date() }));
  const crawl = normaliseCrawl(pagesFromEvidence(rows.filter((r) => CRAWL_EVIDENCE_TYPES.includes(r.type))));
  out.shell = crawl.pages.some((pg) => jsShell(pg));
  out.jsonLdServices = crawl.pages.map((pg) => schemaFacts(pg)).reduce((n, f) => n + f.services.length, 0);
  out.services = servicesFrom({ evidence: rows }).services.map((s) => `${s.name} [${s.source}]`);
  return out;
}

async function live() {
  const rand = mulberry(SEED);
  const sample = await randomCrawled(LIVE * 2, rand);
  console.log(`live read of up to ${LIVE} random sites, one at a time, ${DELAY_MS} ms between requests (seed ${SEED})\n`);
  const t = { tried: 0, read: 0, sitemap: 0, wordpress: 0, wpAnswered: 0, jsonLdServices: 0, shell: 0, withServices: 0, servicesTotal: 0, skipped: {} };
  const lists = [];
  for (const p of sample) {
    if (t.read >= LIVE) break;
    t.tried += 1;
    let r;
    try {
      r = await readLive(p);
    } catch (err) {
      r = { skipped: `threw:${String(err?.message || err).slice(0, 60)}` };
    }
    if (r.skipped) {
      t.skipped[r.skipped.split(":")[0]] = (t.skipped[r.skipped.split(":")[0]] || 0) + 1;
      console.log(`  skip ${p.websiteUrl} — ${r.skipped}`);
      continue;
    }
    t.read += 1;
    if (r.sitemap === "yes") t.sitemap += 1;
    if (r.wp !== "not wordpress") t.wordpress += 1;
    if (r.wp === "yes") t.wpAnswered += 1;
    if (r.jsonLdServices) t.jsonLdServices += 1;
    if (r.shell) t.shell += 1;
    if (r.services.length) {
      t.withServices += 1;
      t.servicesTotal += r.services.length;
    }
    console.log(`  ${p.businessName} — ${p.websiteUrl}: sitemap ${r.sitemap} (${r.sitemapPages} pages), wp ${r.wp} (${r.wpPages} pages), JSON-LD services ${r.jsonLdServices}, shell ${r.shell}, services ${r.services.length}`);
    if (lists.length < 20 && r.services.length) lists.push({ name: p.businessName, url: p.websiteUrl, services: r.services });
  }
  console.log("\nMeasured (live):");
  console.log(`  sites tried / read                 ${t.tried} / ${t.read}  skipped: ${JSON.stringify(t.skipped)}`);
  console.log(`  readable sitemap                   ${t.sitemap} (${pct(t.sitemap, t.read)})`);
  console.log(`  WordPress                          ${t.wordpress} (${pct(t.wordpress, t.read)}), REST index answered ${t.wpAnswered} (${pct(t.wpAnswered, t.wordpress)} of WordPress)`);
  console.log(`  JSON-LD naming services            ${t.jsonLdServices} (${pct(t.jsonLdServices, t.read)})`);
  console.log(`  home page is a JavaScript shell    ${t.shell} (${pct(t.shell, t.read)})`);
  console.log(`  sites with ≥1 service name         ${t.withServices} (${pct(t.withServices, t.read)}), mean ${(t.servicesTotal / Math.max(1, t.withServices)).toFixed(1)} per site with any`);
  console.log("\nSample service lists (hand-check these):");
  for (const l of lists) console.log(`  ${l.name} — ${l.url}\n    ${l.services.join("; ")}`);
}

(LIVE ? live() : stored())
  .then(() => db.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await db.$disconnect();
    process.exit(1);
  });
