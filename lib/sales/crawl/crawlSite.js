// lib/sales/crawl/crawlSite.js
//
// One prospect's crawl, end to end. The only file here that both talks to
// Postgres and opens sockets, and it is deliberately the thinnest thing that
// can: every decision it makes was made by a pure function in policy.js,
// url.js, robots.js, html.js or fingerprint.js, and this file's job is to
// order them and write the results down.
//
// ══ The order of the gates, and why it is this order ═══════════════════════
//
// Cheapest and most binding first. Nothing below a gate runs if the gate
// refuses, and the first four refuse WITHOUT a single packet leaving the
// building:
//
//   1. demo company        — a demo must never touch a stranger's server
//   2. do-not-contact      — a human said never again, about this business
//   3. domain suppression  — a takedown, honoured "immediately and
//                            permanently" (AUDIT-compliance.md §10)
//   4. URL safety          — SSRF, scheme, port, private address
//   5. re-crawl interval   — the politest request is the one never made
//   6. cached robots refusal — the host already said no this week
//   7. robots.txt, fetched — and only now does anything reach the network
//
// ══ The robots cache is a REFUSAL cache and never a permission cache ═══════
//
// CrawlHostPolicy.robotsAllowed holds one boolean for a host, so it cannot
// hold per-path rules; a cached `true` therefore authorises nothing. This
// function acts on the cache only when it says `false`, and every run that
// actually crawls re-fetches robots.txt and asks it about each URL. One extra
// request per prospect per month is the whole cost, and what it buys is that a
// cached verdict can never permit a path the live file forbids.
//
// ══ Failure isolation ══════════════════════════════════════════════════════
//
// This function does not throw for a site that is down. A dead domain, a
// timeout, a 500, a 200 MB body — each produces a RESULT with a reason, and
// the handler turns that into a terminal or retryable task outcome. The
// runner's per-task try/catch is the backstop, not the mechanism.
import { db as defaultDb } from "@/lib/db";
import { isDemoCompany } from "@/lib/demo/simulatedSpend";
import { findSuppressions } from "@/lib/sales/suppression";
import { loadDerivedSite } from "@/lib/sales/intel/db";
import {
  BLOCKING_STATUSES,
  CRAWL_DEADLINE_MS,
  MAX_PAGES_PER_RUN,
  MAX_ROBOTS_BYTES,
  blockUntil,
  crawlSuppressed,
  dnsBackoffDecision,
  fetchFailureOutcome,
  httpFallbackEligible,
  recrawlDecision,
  resolverBusy,
  robotsDecision,
} from "./policy";
import { PROBE_SLUGS, canonicalKey, crawlDomain, probeCandidates, rankNavigation, safeCrawlUrl, serviceMenu } from "./url";
import { childSitemapsToFollow, parseSitemap, sitemapPages, sitemapUrlsToTry } from "./sitemap";
import { WP_PAGES_PATH, WP_TYPES_PATH, looksLikeWordPress, parseWpPages, wpServiceTypes } from "./structured";
import { robotsFetchOutcome, robotsFor } from "./robots";
import { fetchCrawlPage } from "./fetchPage";
import { blockHost, ensureHostPolicy, recordDnsFailure, recordRobots, reserveHostSlot } from "./hostPolicy";
import { extractPage } from "./html";
import { crawlEvidence } from "./evidence";
import { pgSafe } from "@/lib/text/pgSafeText";
import { contentHash, hasChanged } from "./fingerprint";

/** The columns a crawl needs off the Prospect row. */
export const CRAWL_PROSPECT_SELECT = {
  id: true,
  businessName: true,
  domain: true,
  websiteUrl: true,
  hasWebsite: true,
  lastCrawledAt: true,
  contentHash: true,
  doNotContactAt: true,
  doNotContactReason: true,
};

function refusal(reason, extra = {}) {
  return { outcome: "refused", terminal: true, retry: false, reason, ...extra };
}

/**
 * Crawl one prospect's own website.
 *
 * @param prospectId  the row to crawl
 * @param companyId   present ONLY when a tenant-scoped caller triggered this.
 *                    Today nothing does — Prospect and ProspectCampaign are
 *                    FieldQuo's own tables and carry no companyId — so the
 *                    demo gate below is a precondition for a future caller
 *                    rather than a live gate. Said plainly because the
 *                    alternative is a comment implying a guard that runs.
 * @param force       ignore the re-crawl interval. Superadmin action only.
 *
 * @returns { outcome, terminal, retry, reason?, note?, ... }
 *   outcome: "crawled" | "unchanged" | "skipped" | "refused" | "failed"
 */
export async function crawlProspectSite({
  prospectId,
  companyId = null,
  force = false,
  deps = {},
} = {}) {
  const db = deps.db || defaultDb;
  const clock = deps.clock || (() => new Date());
  const isDemo = deps.isDemoCompany || isDemoCompany;
  const startedAt = clock().getTime();
  const deadlineMs = deps.deadlineMs ?? CRAWL_DEADLINE_MS;

  // ── 1. A demo company must never touch a stranger's server ──────────────
  //
  // Inside the function that acts, not in the route that calls it. That is the
  // lesson STATUS.md records from deliverOutreach, whose opt-out check lived
  // in two routes and was therefore absent from every third caller.
  if (companyId && (await isDemo(companyId))) {
    return refusal("demo_company", {
      note: "a demo account cannot crawl a real contractor's website",
    });
  }

  const prospect = await db.prospect.findUnique({ where: { id: prospectId }, select: CRAWL_PROSPECT_SELECT });
  if (!prospect) return refusal("prospect_not_found");

  // ── 2. A human said never again ─────────────────────────────────────────
  if (prospect.doNotContactAt) {
    return refusal("do_not_contact", { note: prospect.doNotContactReason || null });
  }

  // ── 2b. Which address, and whether anybody actually published it ────────
  //
  // Until Quebec's RBQ there was one answer: the website the SOURCE listed.
  // That register publishes no website column at all, so a domain is derived
  // from the licence email and stored as a `derived_site` ProspectInference —
  // see lib/sales/discovery/rbq/derivedSite.js. This is where the crawler
  // learns about it, and the `derived` flag travels with the result because
  // every consumer downstream has to know which of the two it read:
  // lib/sales/intel/tradeDetect.js may not establish a trade from a guessed
  // site that lib/sales/intel/siteIdentity.js has not corroborated.
  //
  // The listed URL always wins. A prospect that has both is one the source
  // told us about, and re-deciding that on the strength of a guess would let
  // an inference overrule a published field.
  let startUrl = typeof prospect.websiteUrl === "string" && prospect.websiteUrl.trim()
    ? prospect.websiteUrl
    : null;
  let derived = false;
  if (!startUrl) {
    const guess = await loadDerivedSite(prospect.id, { deps: { db } });
    if (guess?.domain) {
      // https, and no fallback to http here. safeCrawlUrl vets the scheme and
      // fetchCrawlPage follows a redirect to http if the site sends one; what
      // this must not do is CHOOSE plaintext for a host nobody vouched for.
      startUrl = `https://${guess.domain}`;
      derived = true;
    }
  }
  if (!startUrl) {
    // Not a failure and not a finding. "There is no address to fetch" — the
    // distinction enrichBusiness.js's closing comment refuses to blur, kept
    // here because this function can also be called directly by a superadmin.
    return refusal("no_url", { note: "no website is listed and none was derived", derived: false });
  }

  // ── 3. A takedown binds FieldQuo ────────────────────────────────────────
  const domain = prospect.domain || crawlDomain(startUrl);
  if (domain) {
    const rows = await findSuppressions(db, { domain });
    const verdict = crawlSuppressed(rows);
    if (verdict.suppressed) return refusal("domain_suppressed", { note: verdict.hit?.value || domain });
  }

  // ── 4. The URL is data from a dataset, not a URL ────────────────────────
  const vetted = safeCrawlUrl(startUrl);
  if (!vetted.ok) {
    return refusal(`unsafe_url:${vetted.reason}`, { note: vetted.detail || null, derived });
  }
  const baseHost = vetted.host;

  // ── 5. The politest request is the one never made ───────────────────────
  const due = recrawlDecision({ prospect, now: clock(), force });
  if (due.act === "skip") {
    return {
      outcome: "skipped",
      terminal: true,
      retry: false,
      reason: "crawled_recently",
      note: `next due ${due.nextDueAt?.toISOString?.() || ""}`.trim(),
    };
  }

  // ── 6. The host already said no ─────────────────────────────────────────
  const cached = await ensureHostPolicy(db, baseHost);
  const robotsCache = robotsDecision({ policy: cached, now: clock() });
  if (robotsCache.act === "disallow") {
    return refusal("robots_disallowed", { note: `${baseHost} robots.txt disallows / (cached)` });
  }

  // ── 6b. Our resolver said busy about this host, recently ────────────────
  //
  // Read off the same row as the robots cache, so it costs nothing. Retryable
  // — the site is not at fault — and the wait travels out as `retryAfterMs`
  // so the runner's ladder does not bring the task back inside the hold.
  const dnsHold = dnsBackoffDecision({ policy: cached, now: clock() });
  if (dnsHold.act === "hold") {
    return {
      outcome: "failed",
      terminal: false,
      retry: true,
      reason: "dns_backoff",
      note: `held until ${dnsHold.until.toISOString()} after ${cached?.dnsFailures ?? "?"} busy lookup(s)`,
      retryAfterMs: dnsHold.waitMs,
    };
  }

  // ── 7. robots.txt, live ─────────────────────────────────────────────────
  //
  // Fetched from the origin the crawl will use, and the ONE place the scheme
  // can change. safeCrawlUrl defaults a schemeless address to https; a site
  // that serves http only refuses the connection, and before this fallback
  // the robots fetch failed, the task retried, and the site was never read
  // (www.ethicalservices.com, a real prospect's record). So a TRANSPORT
  // failure over https — and only that, see httpFallbackEligible — is tried
  // once over http on the same host, and if http answers, the whole crawl
  // runs there and every page envelope says so (`scheme`, `schemeFallback`).
  // A site that ANSWERED on https, with any status, is never downgraded; a
  // DERIVED address never is either — the header at step 2b says why this
  // function must not choose plaintext for a host nobody vouched for.
  let crawlUrl = vetted.url;
  let schemeFallback = null;
  const robotsGate = makeRequestGate(db, deps);
  let robotsRes = await fetchCrawlPage({
    startUrl: `${crawlUrl.origin}/robots.txt`,
    baseHost,
    maxBytes: MAX_ROBOTS_BYTES,
    deps: { ...deps, onRequest: robotsGate.onRequest },
  });
  if (robotsGate.refusal) return hostSlotRefusal(robotsGate.refusal);
  if (robotsRes.error && crawlUrl.protocol === "https:" && !derived && httpFallbackEligible(robotsRes.error)) {
    const httpUrl = new URL(crawlUrl.toString());
    httpUrl.protocol = "http:";
    const httpVetted = safeCrawlUrl(httpUrl.toString());
    if (httpVetted.ok) {
      const fallbackGate = makeRequestGate(db, deps);
      const second = await fetchCrawlPage({
        startUrl: `${httpVetted.url.origin}/robots.txt`,
        baseHost,
        maxBytes: MAX_ROBOTS_BYTES,
        deps: { ...deps, onRequest: fallbackGate.onRequest },
      });
      if (fallbackGate.refusal) return hostSlotRefusal(fallbackGate.refusal);
      if (!second.error) {
        schemeFallback = { from: "https", to: "http", error: robotsRes.error };
        crawlUrl = httpVetted.url;
        robotsRes = second;
      }
    }
  }
  const robotsOutcome = robotsFetchOutcome({ status: robotsRes.status, error: robotsRes.error });

  let rules = null;
  if (robotsOutcome.act === "blocked") {
    const block = blockUntil({ status: robotsRes.status, retryAfter: robotsRes.retryAfter, now: clock() });
    await blockHost(db, { host: baseHost, until: block.until, reason: robotsOutcome.reason, deps });
    return refusal(robotsOutcome.reason, {
      note: `blocked until ${block.until.toISOString()} (${block.source})`,
      blockedUntil: block.until,
    });
  }
  if (robotsOutcome.act === "unknown") {
    // We could not tell. NOTHING is written to robotsAllowed — a `true` here
    // is the bug the three-valued column exists to prevent — and the task
    // retries rather than crawling on an assumption.
    //
    // Unless it was OUR resolver that could not tell: then the host is held
    // (policy.js, "DNS backoff") and the retry waits the hold out instead of
    // asking the same busy resolver again in a minute.
    if (resolverBusy(robotsRes.error)) {
      const held = await recordDnsFailure(db, { host: baseHost, deps });
      return {
        outcome: "failed",
        terminal: false,
        retry: true,
        reason: robotsOutcome.reason,
        note: held ? `resolver busy; host held until ${held.until.toISOString()}` : "resolver busy",
        retryAfterMs: held?.waitMs ?? null,
      };
    }
    return { outcome: "failed", terminal: false, retry: true, reason: robotsOutcome.reason };
  }
  if (robotsOutcome.act === "allow_all") {
    // A 404 is the commonest robots.txt response on the web and RFC 9309 says
    // it means allowed. This is the ONE path where robotsAllowed becomes true
    // without a file having been parsed, and it is a real answer from the
    // host rather than an assumption about silence.
    rules = robotsFor("");
    await recordRobots(db, { host: baseHost, allowed: true, crawlDelayMs: null, deps });
  } else {
    rules = robotsFor(robotsRes.body);
    await recordRobots(db, {
      host: baseHost,
      allowed: rules.rootAllowed,
      crawlDelayMs: rules.crawlDelayMs,
      deps,
    });
    if (!rules.rootAllowed) {
      return refusal("robots_disallowed", { note: `${baseHost} robots.txt disallows /` });
    }
  }

  // ── The crawl ───────────────────────────────────────────────────────────
  const pages = [];
  const seen = new Set();
  let blockedUntilAt = null;
  let partialReason = null;
  // The structured sources — sitemap files and a WordPress REST index —
  // recorded beside the pages and never AS pages: a 404 on /sitemap.xml is
  // a fact about the sitemap, not a page that errored, and
  // lib/sales/intel/technology.js's pagesFromEvidence must never see it.
  const structured = { sitemaps: [], sitemapPages: [], wp: [] };

  const fetchOne = async (url) => {
    const target = safeCrawlUrl(url);
    if (!target.ok) return { skipped: `unsafe_url:${target.reason}` };

    const verdict = rules.allows(target.url.pathname);
    if (!verdict.allowed) return { skipped: `robots_disallow:${verdict.rule}` };

    // The reservation is passed INTO the fetch rather than taken around it, so
    // that a redirect hop is spaced like the separate request it is. A gate
    // taken once outside would let a three-hop redirect fire three requests in
    // one crawl-delay window.
    const gate = makeRequestGate(db, deps);
    const res = await fetchCrawlPage({
      startUrl: target.url.toString(),
      baseHost,
      deps: { ...deps, onRequest: gate.onRequest },
    });
    if (gate.refusal) return { skipped: `slot:${gate.refusal.reason}`, slot: gate.refusal };

    if (res.status && BLOCKING_STATUSES.has(res.status)) {
      const block = blockUntil({ status: res.status, retryAfter: res.retryAfter, now: clock() });
      await blockHost(db, { host: target.host, until: block.until, reason: `http_${res.status}`, deps });
      blockedUntilAt = block.until;
      return { blocked: true, attempt: res, block };
    }

    return { attempt: res };
  };

  /**
   * One structured file — a sitemap, a REST index — through the same gates
   * a page goes through (robots, the host slot, a 429), recorded as a
   * `structured_source` and never as a page. Returns the attempt or null,
   * and sets the crawl-wide block/refusal state exactly as a page would.
   */
  const fetchStructured = async (url) => {
    if (clock().getTime() - startedAt > deadlineMs) return { skipped: "deadline" };
    const result = await fetchOne(url);
    if (result.slot) return { slot: result.slot };
    if (result.skipped) return { skipped: result.skipped };
    if (result.blocked) {
      blockedUntilAt = result.block.until;
      return { blocked: true, attempt: result.attempt };
    }
    return { attempt: result.attempt };
  };

  const home = await fetchOne(crawlUrl.toString());
  if (home.slot) return hostSlotRefusal(home.slot);
  if (home.skipped) {
    return refusal(home.skipped.startsWith("robots") ? "robots_disallowed" : home.skipped, {
      note: `home page: ${home.skipped}`,
    });
  }
  if (home.blocked) {
    return refusal(`http_${home.attempt.status}`, {
      note: `blocked until ${blockedUntilAt.toISOString()}`,
      blockedUntil: blockedUntilAt,
    });
  }

  const homeAttempt = home.attempt;
  seen.add(canonicalKey(homeAttempt.finalUrl || homeAttempt.requestedUrl));

  if (homeAttempt.error) {
    const outcome = fetchFailureOutcome(homeAttempt.error);
    // Recorded either way: "the site did not load, here is what happened" is a
    // finding, and a prospect whose website 500s is a prospect worth a call.
    await writeCrawl({
      db,
      prospect,
      pages: [pageRecordFor(homeAttempt, null, { via: "start", navMatch: null, schemeFallback })],
      now: clock(),
      hadContent: false,
      derived,
      deps,
    });
    return {
      outcome: "failed",
      terminal: outcome.terminal,
      retry: !outcome.terminal,
      reason: outcome.reason,
      note: `home page: ${homeAttempt.error}`,
    };
  }

  const homePage = pageRecordFor(homeAttempt, extractIfHtml(homeAttempt), { via: "start", navMatch: null, schemeFallback });
  pages.push(homePage);

  if (homeAttempt.offHost) {
    // The whole finding, and the end of the crawl: the URL we hold does not
    // serve this business's own site. Recorded, never followed.
    await writeCrawl({ db, prospect, pages, now: clock(), hadContent: false, derived, deps });
    return {
      outcome: "crawled",
      terminal: true,
      retry: false,
      reason: "redirects_off_host",
      note: `${startUrl} redirects to ${homeAttempt.offHostUrl}`,
      offHost: true,
      offHostUrl: homeAttempt.offHostUrl,
      pagesFetched: 1,
    };
  }

  // ── The sitemap: the pages the site publishes for exactly this reader ───
  //
  // Read AFTER the home page — a site that is down or redirects away costs
  // no extra request — and BEFORE the menu is ranked, so a navigation drawn
  // by JavaScript no longer hides `/contact` and `/services/…` from a
  // crawler that does not run it. Every URL is kept as `sitemap_url` evidence whether or not it
  // is fetched; the ones the ranking recognises join the queue as
  // `via: "sitemap"`. Bounded by sitemap.js: three files, five hundred URLs.
  // A sitemap that is not there is recorded as not there — one request,
  // one row — and the crawl goes on exactly as before.
  const sitemapSeen = new Set();
  const sitemapQueue = sitemapUrlsToTry({ baseUrl: crawlUrl.toString(), baseHost, robotsSitemaps: rules.sitemaps || [] });
  const sitemapUrls = [];
  while (sitemapQueue.length && structured.sitemaps.length < 3 && sitemapUrls.length < 500) {
    const next = sitemapQueue.shift();
    const url = typeof next === "string" ? next : next.url;
    // The default /sitemap.xml is a guess; it is not asked for when what
    // robots.txt named already answered with pages.
    if (typeof next === "object" && next.from === "default" && sitemapUrls.length) break;
    const key = canonicalKey(url);
    if (sitemapSeen.has(key)) continue;
    sitemapSeen.add(key);
    const res = await fetchStructured(url);
    if (res.slot) return hostSlotRefusal(res.slot);
    if (res.skipped) {
      if (res.skipped === "deadline") break;
      structured.sitemaps.push({ url, status: null, error: res.skipped, kind: null, urls: 0, truncated: false });
      continue;
    }
    const attempt = res.attempt;
    if (res.blocked || attempt.error || attempt.offHost || !attempt.status || attempt.status >= 300 || !attempt.body) {
      structured.sitemaps.push({
        url,
        status: attempt.status ?? null,
        error: attempt.error || (res.blocked ? `http_${attempt.status}` : attempt.offHost ? "off_host" : attempt.status >= 300 ? null : "empty"),
        kind: null,
        urls: 0,
        truncated: false,
      });
      if (res.blocked) break;
      continue;
    }
    const parsed = parseSitemap(attempt.body, { maxUrls: 500 - sitemapUrls.length });
    structured.sitemaps.push({ url, status: attempt.status, error: null, kind: parsed.kind, urls: parsed.urls.length, truncated: parsed.truncated || attempt.truncated });
    if (parsed.kind === "index") {
      // Children go to the FRONT: they are what the file robots.txt named
      // points at, and the default /sitemap.xml guess must not be asked for
      // before them.
      const children = childSitemapsToFollow(parsed.urls, { baseHost, already: sitemapSeen });
      sitemapQueue.unshift(...children.map((url) => ({ url, from: "child" })));
    } else {
      for (const loc of parsed.urls) sitemapUrls.push({ loc, from: url });
    }
  }
  if (blockedUntilAt) {
    // A 429 on the sitemap is the host speaking. The home page already
    // rendered and is written below; nothing else is asked for.
    partialReason = `http_${structured.sitemaps[structured.sitemaps.length - 1]?.status ?? "blocked"}`;
  }
  {
    const bySource = new Map(sitemapUrls.map((s) => [canonicalKey(s.loc), s.from]));
    structured.sitemapPages = sitemapPages(sitemapUrls.map((s) => s.loc), { baseHost }).map((p) => ({ ...p, sourceUrl: bySource.get(canonicalKey(p.url)) || null }));
  }

  // ── Which pages next ────────────────────────────────────────────────────
  //
  // The site's OWN navigation, ranked by the priority list — on the path AND
  // on the words of the link, so `/contact_us` and a "Make a Payment" button
  // routed to `/p/1187` both count — and the site's own SITEMAP, ranked on
  // its paths, for the menu a script draws. Blind probes only when both are
  // EMPTY: the first version probed whenever fewer than two links matched,
  // which on a site with one recognised link and twenty-six service pages
  // threw the whole menu away, guessed `/contact` and `/services`, got two
  // 404s, and wrote "no enquiry form" about a business whose form was one
  // underscore away. Every fetched page now carries how it was reached
  // (`via`) and what it was ranked as (`navMatch`), and a crawl that probed
  // says so in its result, because capabilityDetect.js must not conclude an
  // absence from guesswork.
  const navRanked = rankNavigation({
    links: homePage.links || [],
    baseHost,
    seen,
    limit: MAX_PAGES_PER_RUN - 1,
  }).map((c) => ({ ...c, via: "nav" }));
  // The sitemap's URLs, ranked on their paths alone (a bare URL has no
  // label), and merged by rank with the menu's — the menu wins a tie, since
  // a link is what a visitor sees. A page the sitemap names that the menu
  // does not is exactly what a script-built menu hides.
  const navKeys = new Set(navRanked.map((c) => canonicalKey(c.url)));
  const sitemapRanked = rankNavigation({
    links: structured.sitemapPages.map((p) => p.url),
    baseHost,
    seen: new Set([...seen, ...navKeys]),
    limit: MAX_PAGES_PER_RUN - 1,
  }).map((c) => ({ ...c, via: "sitemap" }));
  let queue = [...navRanked, ...sitemapRanked]
    .map((c, index) => ({ c, index }))
    .sort((a, b) => a.c.rank - b.c.rank || a.index - b.index)
    .map(({ c }) => c)
    .slice(0, MAX_PAGES_PER_RUN - 1);
  let probed = false;
  if (queue.length === 0) {
    // Navigation told us nothing — a JavaScript-rendered menu, or a one-page
    // site. Three blind guesses, and only here. See PROBE_SLUGS.
    probed = true;
    for (const probe of probeCandidates(crawlUrl.toString())) {
      const key = canonicalKey(probe.url);
      if (!seen.has(key) && !queue.some((q) => canonicalKey(q.url) === key)) queue.push(probe);
    }
    queue = queue.slice(0, MAX_PAGES_PER_RUN - 1);
  }

  // The service menu: every same-site link the ranking did NOT claim. Read
  // off the home page and recorded as nav_link evidence — no fetch. This is
  // what the crawler used to discard and what a rep wants to read first.
  homePage.navLinks = serviceMenu({ links: homePage.links || [], baseHost });

  const probesFailed = [];
  for (const candidate of queue) {
    const url = candidate.url;
    if (blockedUntilAt) break;
    if (pages.length >= MAX_PAGES_PER_RUN) break;
    if (clock().getTime() - startedAt > deadlineMs) {
      partialReason = "deadline";
      break;
    }

    const key = canonicalKey(url);
    if (seen.has(key)) continue;
    seen.add(key);

    const result = await fetchOne(url);
    if (result.skipped) continue;
    const provenance = { via: candidate.via, navMatch: candidate.kind || null, schemeFallback };
    if (result.blocked) {
      partialReason = `http_${result.attempt.status}`;
      pages.push(pageRecordFor(result.attempt, null, provenance));
      break;
    }
    const attempt = result.attempt;
    // A 404 on a guessed path is expected and is recorded as what it is.
    pages.push(pageRecordFor(attempt, attempt.error ? null : extractIfHtml(attempt), provenance));
    if (candidate.via === "probe" && (attempt.error || !attempt.status || attempt.status >= 400)) {
      probesFailed.push(url);
    }
  }

  // ── WordPress: the REST index of pages, when the site is one ────────────
  //
  // After the pages and under the same deadline, because it is a bonus for
  // the service list rather than a page: `/wp-json/wp/v2/pages` lists every
  // page with its title and link whatever the theme's menu plugin did to the
  // <a> tags. Then the site's declared post types, and any whose name says
  // "service" — a theme's `services` post type is the service list itself.
  // Four requests at most, each recorded as a `structured_source`, none of
  // them a page. A site whose robots.txt disallows /wp-json/ is left alone.
  if (!blockedUntilAt && looksLikeWordPress(homePage)) {
    const origin = crawlUrl.origin;
    const readWp = async (path, type) => {
      const url = `${origin}${path}`;
      const res = await fetchStructured(url);
      if (res.slot) return { stop: hostSlotRefusal(res.slot) };
      if (res.skipped) {
        if (res.skipped !== "deadline") structured.wp.push({ url, status: null, error: res.skipped, pages: [], type });
        return { stop: null, body: null, deadline: res.skipped === "deadline" };
      }
      const attempt = res.attempt;
      if (res.blocked) {
        partialReason = `http_${attempt.status}`;
        structured.wp.push({ url, status: attempt.status, error: `http_${attempt.status}`, pages: [], type });
        return { stop: null, body: null, blocked: true };
      }
      if (attempt.error || attempt.offHost || !attempt.status || attempt.status >= 300 || !attempt.body) {
        structured.wp.push({ url, status: attempt.status ?? null, error: attempt.error || (attempt.offHost ? "off_host" : attempt.status >= 300 ? null : "empty"), pages: [], type });
        return { stop: null, body: null };
      }
      return { stop: null, body: attempt.body, status: attempt.status, url };
    };

    const first = await readWp(WP_PAGES_PATH, "page");
    if (first.stop) return first.stop;
    if (first.body) {
      const parsed = parseWpPages(first.body, { baseHost });
      structured.wp.push({ url: first.url, status: first.status, error: parsed.error, pages: parsed.pages, type: "page" });
      if (!parsed.error) {
        const types = await readWp(WP_TYPES_PATH, "types");
        if (types.stop) return types.stop;
        if (types.body) {
          const serviceTypes = wpServiceTypes(types.body);
          structured.wp.push({ url: types.url, status: types.status, error: null, pages: [], type: "types", found: serviceTypes.map((t) => t.restBase) });
          for (const t of serviceTypes) {
            if (blockedUntilAt) break;
            const list = await readWp(`/wp-json/wp/v2/${t.restBase}?per_page=50&_fields=id,link,title,excerpt`, t.restBase);
            if (list.stop) return list.stop;
            if (list.deadline) break;
            if (list.body) {
              const items = parseWpPages(list.body, { baseHost });
              structured.wp.push({ url: list.url, status: list.status, error: items.error, pages: items.pages, type: t.restBase });
            }
          }
        }
      }
    }
  }

  // ── What changed, and whether to write ──────────────────────────────────
  const withContent = pages.filter((p) => p.status && p.status >= 200 && p.status < 300);
  const nextHash = contentHash(withContent);
  const changed = hasChanged(prospect.contentHash, nextHash);

  const written = await writeCrawl({
    db,
    prospect,
    pages,
    structured,
    now: clock(),
    nextHash,
    changed,
    hadContent: withContent.length > 0,
    derived,
    deps,
  });

  return {
    outcome: changed ? "crawled" : "unchanged",
    terminal: true,
    retry: false,
    reason: null,
    // Carried out of the function so the handler's note, and the task row a
    // superadmin reads, say which kind of address this was. A crawl of a
    // published site and a crawl of a guess look identical in the evidence
    // table and are not the same claim.
    derived,
    note: [
      `${pages.length} page${pages.length === 1 ? "" : "s"}`,
      changed ? "changed" : "unchanged — evidence not rewritten",
      derived ? "address derived from the licence email, not published by the source" : null,
      schemeFallback ? `https refused (${schemeFallback.error}); crawled over http` : null,
      probed
        ? `probed: navigation ranked nothing, ${probesFailed.length} of ${PROBE_SLUGS.length} blind guess(es) failed`
        : null,
      structured.sitemapPages.length
        ? `sitemap: ${structured.sitemapPages.length} page URL(s) from ${structured.sitemaps.filter((f) => !f.error && f.status < 300).length} file(s)`
        : structured.sitemaps.length
          ? `sitemap: none readable (${structured.sitemaps.map((f) => f.error || "http_" + f.status).join(", ")})`
          : null,
      structured.wp.length
        ? `wp-json: ${structured.wp.reduce((n, s) => n + (s.pages?.length || 0), 0)} page(s) from ${structured.wp.filter((s) => !s.error && s.status < 300).length} answer(s)`
        : null,
      partialReason ? `partial: ${partialReason}` : null,
      blockedUntilAt ? `host blocked until ${blockedUntilAt.toISOString()}` : null,
    ]
      .filter(Boolean)
      .join("; "),
    changed,
    contentHash: nextHash,
    pagesFetched: pages.length,
    evidenceWritten: written.evidenceWritten,
    // True on an unchanged crawl: the inference run's and the call script's
    // crawledAt moved with lastCrawledAt (writeCrawl says why).
    stampsMoved: written.stampsMoved === true,
    partial: Boolean(partialReason),
    // Whether the crawler had to GUESS. Carried out so the task note, and the
    // superadmin reading it, can tell "read the menu" from "found nothing and
    // tried three URLs" — the second is not a look at the site.
    probed,
    probesFailed,
    // The scheme the crawl actually ran on, and why it is not the one asked
    // for, when it is not. Null means the URL's own scheme was used.
    schemeFallback,
    // The structured sources: which sitemap files answered and how many page
    // URLs they gave, which REST answers came back. Counts, not contents —
    // the rows carry the contents.
    sitemap: {
      files: structured.sitemaps.map((f) => ({ url: f.url, status: f.status, error: f.error, kind: f.kind, urls: f.urls })),
      pages: structured.sitemapPages.length,
      followed: pages.filter((p) => p.via === "sitemap").length,
    },
    wp: structured.wp.map((s) => ({ url: s.url, status: s.status, error: s.error, type: s.type, pages: s.pages?.length || 0 })),
  };
}

/**
 * A per-request politeness gate, handed to fetchCrawlPage.
 *
 * It is called once per HOP, which is the point: a redirect is another request
 * to somebody's server, and spacing that only counted the first one is spacing
 * that is not happening. The refusal is remembered rather than thrown so the
 * caller can tell "the host is blocked" from "the page 404'd".
 */
function makeRequestGate(db, deps) {
  let refused = null;
  return {
    onRequest: async ({ host }) => {
      const reserved = await reserveHostSlot(db, { host, deps });
      if (reserved.ok) return { ok: true };
      refused = reserved;
      return { ok: false, reason: reserved.reason };
    },
    get refusal() {
      return refused;
    },
  };
}

/** A slot refusal, mapped to a task outcome. */
function hostSlotRefusal(slot) {
  if (slot.reason === "blocked") {
    // Respected rather than retried. The task ends `abandoned` with the time
    // in lastError; a later scheduled crawl is what tries again, and it will
    // find the block expired.
    return refusal("host_blocked", {
      note: `until ${slot.until?.toISOString?.() || slot.until} (${slot.blockReason || "blocked"})`,
      blockedUntil: slot.until,
    });
  }
  // "defer" and "slot_taken" are both "not now" rather than "not ever": the
  // crawl-delay is longer than one invocation should hold a function open, or
  // another lambda has the host. Retryable, and bounded by MAX_ATTEMPTS.
  return { outcome: "failed", terminal: false, retry: true, reason: `host_slot:${slot.reason}` };
}

/** Parse the body only when the server said it was HTML. */
function extractIfHtml(attempt) {
  const type = String(attempt.contentType || "").toLowerCase();
  const isHtml = !type || type.includes("html") || type.includes("xml");
  if (!isHtml || !attempt.body) return null;
  return extractPage({
    html: attempt.body,
    finalUrl: attempt.finalUrl,
    requestedUrl: attempt.requestedUrl,
    status: attempt.status,
    contentType: attempt.contentType,
    bytes: attempt.bytes,
    truncated: attempt.truncated,
  });
}

/** One page record, whether or not there was a document to parse.
 *
 *  `provenance` — { via, navMatch, schemeFallback } — is stamped on every
 *  record, including a failed fetch: "the probe for /contact 404'd" is the
 *  fact that stops an absence claim, and it has to survive into the
 *  page_fetch envelope. `schemeFallback` is the crawl-wide fact that https
 *  refused and http was used, repeated on each page so a single row reads
 *  true on its own. */
function pageRecordFor(attempt, extracted, provenance = { via: null, navMatch: null, schemeFallback: null }) {
  if (extracted) {
    return { ...extracted, ...provenance, redirects: attempt.redirects, offHost: attempt.offHost, error: attempt.error, timedOut: attempt.timedOut };
  }
  return {
    ...provenance,
    requestedUrl: attempt.requestedUrl,
    finalUrl: attempt.finalUrl,
    status: attempt.status,
    contentType: attempt.contentType,
    bytes: attempt.bytes,
    truncated: attempt.truncated,
    error: attempt.error,
    timedOut: attempt.timedOut,
    redirects: attempt.redirects,
    offHost: attempt.offHost,
    title: null,
    metas: [],
    text: "",
    links: [],
    scripts: [],
    iframes: [],
    forms: [],
    buttons: [],
    jsonLd: [],
    microdata: [],
    dataAttrs: [],
    contacts: [],
    inlineScripts: [],
    inlineTokens: [],
    navLinks: [],
    headings: [],
    renderedText: "",
    payload: null,
  };
}

/**
 * Write the crawl down: evidence rows, then the prospect's own columns.
 *
 * ══ Evidence is appended, never replaced ══════════════════════════════════
 *
 * No delete of the previous crawl's rows. ProspectEvidence is "something we
 * OBSERVED" with an observedAt on every row, and deleting last month's
 * observation to make room for this month's would destroy the one thing a
 * recommendation cites. Growth is bounded by the fact that an UNCHANGED site
 * writes nothing at all — which is the §20 caching, applied to storage as well
 * as to the model bill.
 *
 * A reader wanting only the current picture keeps the rows with the LATEST
 * observedAt (prospectView.js, servicesOffered.js) — not `observedAt >=
 * lastCrawledAt`, because an unchanged re-crawl moves lastCrawledAt and
 * writes no rows, and that filter would then find nothing. The two are still
 * written in one transaction so a row is never dated after a stamp that does
 * not yet exist.
 *
 * ══ An UNCHANGED re-crawl still moves every "as of" stamp ═════════════════
 *
 * lastCrawledAt is written on every crawl, changed or not: it is "when we
 * last looked", the 30-day re-crawl clock (policy.js recrawlDecision) and
 * the date a rep's card calls "checked". The inference run and the call
 * script carry their own `crawledAt` — "the crawl these rows were written
 * from" — and research.js's staleness rule re-queues a row whose crawledAt
 * is older than the prospect's. So an unchanged crawl stamps those rows
 * too, in the same transaction: the pages are byte-for-byte the pages they
 * were written from, and the rows stand for this crawl as much as for the
 * last one. Without that stamp every unchanged re-crawl would queue an
 * INFER_FROM_SITE and a GENERATE_CALL_SCRIPT whose hash gate then spends
 * nothing — a task per claim, for ever, doing nothing — and the playbook's
 * "Generated from what the crawler saw on <date>" would keep the old date
 * for a site checked this morning. A CHANGED crawl leaves them alone: they
 * are stale, and the chain regenerates them.
 *
 * ══ hasWebsite is only ever written TRUE ══════════════════════════════════
 *
 * A fetch that failed is not proof of absence. Writing false on a timeout
 * would put "they have no website" in front of a rep because a server was slow
 * for fifteen seconds — the same mistake ProspectCapability.value's nullability
 * exists to prevent, one table over.
 *
 * ══ …and NEVER from a derived address ═════════════════════════════════════
 *
 * `hasWebsite: true` is the claim "this business has a website". A page coming
 * back from a domain GUESSED out of a licence email does not establish it: the
 * page that came back from ge.com is General Electric's, and writing true off
 * it would state a fact about a Quebec coatings shop on the strength of
 * somebody else's server answering. So a derived crawl leaves the column null,
 * which is the true state — we have a page and we do not yet know whose.
 *
 * ANALYZE_CAPABILITIES fills it in when lib/sales/intel/siteIdentity.js
 * corroborates the site, which is the same stage and the same corroboration
 * that gates the trade. That is one place, not two, and it is downstream of
 * the evidence rather than ahead of it.
 */
async function writeCrawl({ db, prospect, pages, structured = null, now, nextHash = null, changed = true, hadContent = false, derived = false, deps = {} }) {
  const rows = changed ? crawlEvidence(pages, structured) : [];

  const prospectData = {
    lastCrawledAt: now,
    ...(nextHash ? { contentHash: nextHash } : {}),
    ...(hadContent && derived !== true && prospect.hasWebsite !== true ? { hasWebsite: true } : {}),
  };

  const writes = [];
  if (rows.length) {
    writes.push(
      db.prospectEvidence.createMany({
        // pgSafe at the WRITE, once — lib/text/pgSafeText.js. A page served
        // with a stray NUL byte (a truncated response, a CMS pasting from a
        // binary source) makes the whole createMany fail with "invalid byte
        // sequence for encoding UTF8: 0x00", which takes the crawl down and,
        // further downstream, killed five GENERATE_CALL_SCRIPT tasks. \n \r \t
        // survive; nothing else in C0 does.
        data: rows.map((r) => pgSafe({ ...r, prospectId: prospect.id, observedAt: now })),
      }),
    );
  }
  writes.push(db.prospect.update({ where: { id: prospect.id }, data: prospectData }));
  if (!changed) {
    // Only a genuine "same pages" — a hash on both sides that matched. An
    // empty crawl has nextHash null and hasChanged() reads it as changed, so
    // it never lands here. The models may be absent from a client generated
    // before they existed (research.js makes the same allowance), and a
    // stamp nobody can read is not worth a throw.
    for (const model of ["prospectInferenceRun", "prospectCallScript"]) {
      if (typeof db[model]?.updateMany === "function") {
        writes.push(db[model].updateMany({ where: { prospectId: prospect.id }, data: { crawledAt: now } }));
      }
    }
  }

  if (typeof db.$transaction === "function") await db.$transaction(writes);
  else for (const write of writes) await write;

  return { evidenceWritten: rows.length, stampsMoved: !changed };
}
