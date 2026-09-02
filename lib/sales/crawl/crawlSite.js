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
import {
  BLOCKING_STATUSES,
  CRAWL_DEADLINE_MS,
  MAX_PAGES_PER_RUN,
  MAX_ROBOTS_BYTES,
  blockUntil,
  crawlSuppressed,
  fetchFailureOutcome,
  recrawlDecision,
  robotsDecision,
} from "./policy";
import { canonicalKey, crawlDomain, probeUrls, rankCandidates, safeCrawlUrl } from "./url";
import { robotsFetchOutcome, robotsFor } from "./robots";
import { fetchCrawlPage } from "./fetchPage";
import { blockHost, ensureHostPolicy, recordRobots, reserveHostSlot } from "./hostPolicy";
import { extractPage } from "./html";
import { crawlEvidence } from "./evidence";
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

  // ── 3. A takedown binds FieldQuo ────────────────────────────────────────
  const domain = prospect.domain || crawlDomain(prospect.websiteUrl);
  if (domain) {
    const rows = await findSuppressions(db, { domain });
    const verdict = crawlSuppressed(rows);
    if (verdict.suppressed) return refusal("domain_suppressed", { note: verdict.hit?.value || domain });
  }

  // ── 4. The URL is data from a dataset, not a URL ────────────────────────
  const vetted = safeCrawlUrl(prospect.websiteUrl);
  if (!vetted.ok) {
    return refusal(`unsafe_url:${vetted.reason}`, { note: vetted.detail || null });
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

  // ── 7. robots.txt, live ─────────────────────────────────────────────────
  const robotsUrl = `${vetted.url.origin}/robots.txt`;
  const robotsGate = makeRequestGate(db, deps);
  const robotsRes = await fetchCrawlPage({
    startUrl: robotsUrl,
    baseHost,
    maxBytes: MAX_ROBOTS_BYTES,
    deps: { ...deps, onRequest: robotsGate.onRequest },
  });
  if (robotsGate.refusal) return hostSlotRefusal(robotsGate.refusal);
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

  const home = await fetchOne(vetted.url.toString());
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
      pages: [pageRecordFor(homeAttempt, null)],
      now: clock(),
      hadContent: false,
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

  const homePage = pageRecordFor(homeAttempt, extractIfHtml(homeAttempt));
  pages.push(homePage);

  if (homeAttempt.offHost) {
    // The whole finding, and the end of the crawl: the URL we hold does not
    // serve this business's own site. Recorded, never followed.
    await writeCrawl({ db, prospect, pages, now: clock(), hadContent: false, deps });
    return {
      outcome: "crawled",
      terminal: true,
      retry: false,
      reason: "redirects_off_host",
      note: `${prospect.websiteUrl} redirects to ${homeAttempt.offHostUrl}`,
      offHost: true,
      offHostUrl: homeAttempt.offHostUrl,
      pagesFetched: 1,
    };
  }

  // Which pages next: the site's OWN navigation, ranked by the priority list.
  let queue = rankCandidates({
    links: (homePage.links || []).map((l) => l.url).filter(Boolean),
    baseHost,
    seen,
    limit: MAX_PAGES_PER_RUN - 1,
  });
  if (queue.length < 2) {
    // Navigation told us nothing usable — a JavaScript-rendered menu, or a
    // one-page site. Three blind guesses, and only here. See PROBE_SLUGS.
    for (const probe of probeUrls(vetted.url.toString())) {
      const key = canonicalKey(probe);
      if (!seen.has(key) && !queue.some((q) => canonicalKey(q) === key)) queue.push(probe);
    }
    queue = queue.slice(0, MAX_PAGES_PER_RUN - 1);
  }

  for (const url of queue) {
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
    if (result.blocked) {
      partialReason = `http_${result.attempt.status}`;
      pages.push(pageRecordFor(result.attempt, null));
      break;
    }
    const attempt = result.attempt;
    // A 404 on a guessed path is expected and is recorded as what it is.
    pages.push(pageRecordFor(attempt, attempt.error ? null : extractIfHtml(attempt)));
  }

  // ── What changed, and whether to write ──────────────────────────────────
  const withContent = pages.filter((p) => p.status && p.status >= 200 && p.status < 300);
  const nextHash = contentHash(withContent);
  const changed = hasChanged(prospect.contentHash, nextHash);

  const written = await writeCrawl({
    db,
    prospect,
    pages,
    now: clock(),
    nextHash,
    changed,
    hadContent: withContent.length > 0,
    deps,
  });

  return {
    outcome: changed ? "crawled" : "unchanged",
    terminal: true,
    retry: false,
    reason: null,
    note: [
      `${pages.length} page${pages.length === 1 ? "" : "s"}`,
      changed ? "changed" : "unchanged — evidence not rewritten",
      partialReason ? `partial: ${partialReason}` : null,
      blockedUntilAt ? `host blocked until ${blockedUntilAt.toISOString()}` : null,
    ]
      .filter(Boolean)
      .join("; "),
    changed,
    contentHash: nextHash,
    pagesFetched: pages.length,
    evidenceWritten: written.evidenceWritten,
    partial: Boolean(partialReason),
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

/** One page record, whether or not there was a document to parse. */
function pageRecordFor(attempt, extracted) {
  if (extracted) {
    return { ...extracted, redirects: attempt.redirects, offHost: attempt.offHost, error: attempt.error, timedOut: attempt.timedOut };
  }
  return {
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
 * A reader wanting only the current picture filters on
 * `observedAt >= prospect.lastCrawledAt`, which is why the two are written in
 * the same transaction.
 *
 * ══ hasWebsite is only ever written TRUE ══════════════════════════════════
 *
 * A fetch that failed is not proof of absence. Writing false on a timeout
 * would put "they have no website" in front of a rep because a server was slow
 * for fifteen seconds — the same mistake ProspectCapability.value's nullability
 * exists to prevent, one table over.
 */
async function writeCrawl({ db, prospect, pages, now, nextHash = null, changed = true, hadContent = false, deps = {} }) {
  const rows = changed ? crawlEvidence(pages) : [];

  const prospectData = {
    lastCrawledAt: now,
    ...(nextHash ? { contentHash: nextHash } : {}),
    ...(hadContent && prospect.hasWebsite !== true ? { hasWebsite: true } : {}),
  };

  const writes = [];
  if (rows.length) {
    writes.push(
      db.prospectEvidence.createMany({
        data: rows.map((r) => ({ ...r, prospectId: prospect.id, observedAt: now })),
      }),
    );
  }
  writes.push(db.prospect.update({ where: { id: prospect.id }, data: prospectData }));

  if (typeof db.$transaction === "function") await db.$transaction(writes);
  else for (const write of writes) await write;

  return { evidenceWritten: rows.length };
}
