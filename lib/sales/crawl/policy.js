// lib/sales/crawl/policy.js
//
// The numbers and the pure decisions behind crawl politeness. No IO.
//
// ══ Why every constant is in one file ══════════════════════════════════════
//
// STATUS.md's standing rule 1 says every rule a superadmin might tune belongs
// in a console screen rather than a constant. There is no crawl console yet
// and this brief did not include one, so these are constants — and they are in
// ONE file so that when the screen is written there is a single place to read
// from, rather than nine literals scattered through the fetcher. Naming that
// gap here is the honest version of "configurable"; shipping a table and a
// seed and calling it configurable is the half-done version the rule warns
// about.
//
// ══ The politeness decisions are pure on purpose ═══════════════════════════
//
// Every one of these is a decision nobody exercises by hand. Nobody reproduces
// "a host returned 429 with Retry-After: Wed, 21 Oct 2026 07:28:00 GMT while a
// second lambda held the slot" by clicking. schedule.js makes the same
// argument for the retry ladder; this is the crawl half of it, and
// scripts/check-sales-crawl.mjs runs all of it against the real functions.

// ── Identity ───────────────────────────────────────────────────────────────
//
// AUDIT-compliance.md §10: "Identify the crawler honestly in the User-Agent,
// with a URL explaining it and a contact address." The pairing that section
// calls indefensible is ignoring robots.txt WHILE spoofing a browser string,
// so the two live together — this file both declares who we are and obeys what
// the host says.
//
// The URL is /contact because it exists and a human lands on a form there
// today. lib/platform/salesAgent.js already gives out the same page as
// FieldQuo's contact point, so an annoyed contractor reaching for it finds the
// same door a prospect would. A dedicated /bot page explaining the crawler
// would be better and is named in docs/sales-intel/CRAWLING.md as owner work;
// pointing at a page that does not exist yet would be worse than pointing at a
// general one that does.

/** The product token a robots.txt group can name to address us specifically. */
export const CRAWLER_TOKEN = "FieldQuoBot";

/** Where an annoyed contractor goes to find out who is hitting them. */
export const CRAWLER_CONTACT_URL = "https://www.fieldquo.com/contact";

/** The full User-Agent header. Honest, versioned, and contactable. */
export const USER_AGENT = `${CRAWLER_TOKEN}/1.0 (+${CRAWLER_CONTACT_URL})`;

/** Sent on every request. text/html only — we parse nothing else. */
export const ACCEPT_HEADER = "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1";

// ── Pace ───────────────────────────────────────────────────────────────────

/**
 * The gap between two requests to one host when robots.txt does not say.
 *
 * §10 asks for "one request at a time per host, a real delay between them".
 * Three seconds is that delay: at six pages a prospect it costs twenty seconds
 * of wall clock and is indistinguishable from one slow human reading the site.
 */
export const DEFAULT_CRAWL_DELAY_MS = 3_000;

/**
 * The floor. A robots.txt saying `Crawl-delay: 0` is not permission to flood —
 * it usually means the directive was copied from a template. We are not
 * obliged to go faster than we chose to.
 */
export const MIN_CRAWL_DELAY_MS = 1_000;

/**
 * The longest delay one invocation will sit and wait through.
 *
 * A host asking for 300 seconds between requests is asking us not to crawl it
 * inside a lambda, and the honest answer is to defer the task rather than to
 * hold a function open for five minutes or to quietly ignore the directive.
 * Above this the crawl stops after whatever it already has.
 */
export const MAX_WAIT_MS = 30_000;

/** Nothing above this is treated as a real Crawl-delay; see clampCrawlDelay. */
export const MAX_CRAWL_DELAY_MS = 24 * 60 * 60 * 1000;

// ── Size and time ceilings ─────────────────────────────────────────────────

/**
 * Per-request timeout, matching lib/voice/retell.js's 15s and for the same
 * stated reason: well past a healthy response and well short of a function
 * timeout. A contractor's site on shared hosting is slow; it is not slow for
 * fifteen seconds and then fine.
 */
export const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Hard cap on a page body.
 *
 * Enforced by counting bytes off the stream, NOT by trusting Content-Length —
 * a header is a claim and a 200 MB body sent with `Content-Length: 1200` would
 * take the lambda down. Two megabytes is several times the largest marketing
 * page anyone builds; past it we keep the prefix and mark the page truncated,
 * because the head of a document carries the title, the meta and the scripts,
 * which is most of what §8 asks for.
 */
export const MAX_PAGE_BYTES = 2 * 1024 * 1024;

/** Google's documented robots.txt ceiling, and a sane one. */
export const MAX_ROBOTS_BYTES = 512 * 1024;

/**
 * Pages fetched per prospect per run, home page included.
 *
 * Not a whole-site crawl — the spec is explicit that a 10,000-page mirror is
 * not wanted, and §10 says "home, about, services, contact — not a full site
 * mirror". Six is that list plus two.
 */
export const MAX_PAGES_PER_RUN = 6;

/** Redirect hops followed on one URL before we call it a loop. */
export const MAX_REDIRECTS = 4;

/**
 * Wall-clock budget for one prospect's crawl.
 *
 * The runner's stale-claim window is ten minutes and a Vercel function is far
 * shorter than that, so the crawl has to stop itself. Whatever has been
 * fetched by then is kept and reported as partial — a partial crawl is data;
 * a lambda killed mid-write is a claimed row nobody settles.
 */
export const CRAWL_DEADLINE_MS = 45_000;

// ── Freshness ──────────────────────────────────────────────────────────────

/**
 * How long a cached robots.txt verdict is believed.
 *
 * Seven days. Long enough that re-crawling a hundred prospects on one host
 * does not re-fetch it a hundred times; short enough that a contractor who
 * adds a Disallow is obeyed within a week.
 */
export const ROBOTS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The floor under re-crawling. §10: "never re-crawl a site more often than the
 * data actually changes." A contractor's marketing site changes a few times a
 * year; thirty days is already generous to us rather than to them.
 */
export const MIN_RECRAWL_MS = 30 * 24 * 60 * 60 * 1000;

/** Block applied when a host says stop and does not say for how long. */
export const DEFAULT_BLOCK_MS = 60 * 60 * 1000;

/**
 * Ceiling on a block, so a hostile or broken `Retry-After: 99999999` cannot
 * park a host until the heat death of the universe. Seven days is long enough
 * that we have plainly stopped, and short enough that a fixed server is
 * reachable again without a superadmin editing a row.
 */
export const MAX_BLOCK_MS = 7 * 24 * 60 * 60 * 1000;

/** Statuses that mean "stop hitting me", as opposed to "that page is broken". */
export const BLOCKING_STATUSES = new Set([429, 503]);

// ── Pure decisions ─────────────────────────────────────────────────────────

/**
 * A Crawl-delay from robots.txt, in milliseconds, clamped.
 *
 * Returns null for anything that is not a usable number, which the caller
 * reads as "the host did not say" — NOT as zero. Absence of a statement is not
 * a statement (AGENTS.md failure class 5), and a NaN silently becoming 0 is
 * how a politeness setting turns into a flood.
 */
export function clampCrawlDelay(seconds) {
  const n = Number(seconds);
  if (!Number.isFinite(n) || n < 0) return null;
  const ms = Math.round(n * 1000);
  if (ms > MAX_CRAWL_DELAY_MS) return MAX_CRAWL_DELAY_MS;
  return Math.max(ms, MIN_CRAWL_DELAY_MS);
}

/** The delay to use for a host: what it asked for, or our default. */
export function effectiveDelayMs(policy) {
  const asked = Number(policy?.crawlDelayMs);
  if (Number.isFinite(asked) && asked > 0) {
    return Math.min(Math.max(asked, MIN_CRAWL_DELAY_MS), MAX_CRAWL_DELAY_MS);
  }
  return DEFAULT_CRAWL_DELAY_MS;
}

/**
 * `Retry-After`, in milliseconds from `now`.
 *
 * Both forms of the header are real and both appear in the wild: delta-seconds
 * ("Retry-After: 120") and an HTTP-date ("Retry-After: Wed, 21 Oct 2026
 * 07:28:00 GMT"). Parsing only the first and treating the second as absent is
 * the common bug, and it converts an explicit instruction into our default.
 *
 * Returns null when the header is missing or unparseable, and never a negative
 * — a date already in the past means "you may retry now", not "wait backwards".
 */
export function retryAfterMs(value, now = new Date()) {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  if (/^\d+$/.test(raw)) {
    const ms = Number(raw) * 1000;
    return Number.isFinite(ms) ? Math.min(ms, MAX_BLOCK_MS) : null;
  }

  const at = Date.parse(raw);
  if (Number.isNaN(at)) return null;
  const delta = at - (now instanceof Date ? now.getTime() : new Date(now).getTime());
  return Math.min(Math.max(delta, 0), MAX_BLOCK_MS);
}

/**
 * When a host that just said "stop" may be touched again.
 *
 * @returns { until: Date, ms, source: "retry-after" | "default", reason }
 */
export function blockUntil({ status, retryAfter = null, now = new Date() } = {}) {
  const at = now instanceof Date ? now : new Date(now);
  const asked = retryAfterMs(retryAfter, at);
  const ms = asked === null ? DEFAULT_BLOCK_MS : Math.min(Math.max(asked, 0), MAX_BLOCK_MS);
  return {
    until: new Date(at.getTime() + ms),
    ms,
    source: asked === null ? "default" : "retry-after",
    reason: `http_${status}`,
  };
}

/**
 * May we make one request to this host right now?
 *
 * Reads a CrawlHostPolicy row (or null for a host never seen) and answers
 * without touching the network:
 *
 *   { act: "blocked", until, reason }  — the host told us to stop
 *   { act: "wait",    waitMs }          — too soon since the last request
 *   { act: "defer",   waitMs }          — too soon, and longer than one run
 *                                         should hold a function open
 *   { act: "go" }
 *
 * "defer" exists because the alternatives are both wrong: sleeping for five
 * minutes inside a lambda burns the claim window, and ignoring a long
 * Crawl-delay is the exact discourtesy this file exists to prevent.
 */
export function hostSlotDecision({ policy = null, now = new Date(), maxWaitMs = MAX_WAIT_MS } = {}) {
  const at = (now instanceof Date ? now : new Date(now)).getTime();

  const blockedUntil = policy?.blockedUntil ? new Date(policy.blockedUntil) : null;
  if (blockedUntil && blockedUntil.getTime() > at) {
    return {
      act: "blocked",
      until: blockedUntil,
      waitMs: blockedUntil.getTime() - at,
      reason: policy?.blockReason || "blocked",
    };
  }

  const last = policy?.lastRequestAt ? new Date(policy.lastRequestAt) : null;
  if (!last || Number.isNaN(last.getTime())) return { act: "go", waitMs: 0, reason: "first_request" };

  const delay = effectiveDelayMs(policy);
  const elapsed = at - last.getTime();
  // A lastRequestAt in the future is a clock skew between two lambdas, not
  // permission to go now: elapsed is negative, so the wait comes out longer,
  // which errs towards politeness.
  if (elapsed >= delay) return { act: "go", waitMs: 0, reason: "delay_elapsed" };

  const waitMs = delay - elapsed;
  return waitMs > maxWaitMs
    ? { act: "defer", waitMs, reason: "crawl_delay_exceeds_run" }
    : { act: "wait", waitMs, reason: "crawl_delay" };
}

/**
 * Is the cached robots.txt verdict usable, and what does it say?
 *
 * THREE-VALUED, and this is the point the brief makes hardest: `robotsAllowed`
 * null means NOT YET FETCHED. It does not mean allowed. A crawler that reads
 * null as "no objection recorded" is a crawler that ignores robots.txt on
 * every host it has never seen — which is every host, the first time.
 *
 *   { act: "fetch"    } — nothing cached, or the cache has expired
 *   { act: "disallow" } — the host said no, and said it recently enough
 *   { act: "allow"    } — the host said yes, and said it recently enough
 */
export function robotsDecision({ policy = null, now = new Date(), ttlMs = ROBOTS_TTL_MS } = {}) {
  const at = (now instanceof Date ? now : new Date(now)).getTime();
  const allowed = policy?.robotsAllowed;
  const fetchedAt = policy?.robotsFetchedAt ? new Date(policy.robotsFetchedAt) : null;

  if (allowed === null || allowed === undefined) return { act: "fetch", reason: "never_fetched" };
  if (!fetchedAt || Number.isNaN(fetchedAt.getTime())) return { act: "fetch", reason: "no_fetch_time" };
  if (at - fetchedAt.getTime() > ttlMs) return { act: "fetch", reason: "stale" };

  return allowed
    ? { act: "allow", reason: "cached" }
    : { act: "disallow", reason: "robots_disallows_root" };
}

/**
 * Is it too soon to crawl this prospect again?
 *
 * The cheapest possible politeness: the request never made. §10 asks for
 * exactly this and the spec's §20 asks for the caching half of it — see
 * fingerprint.js for the other half, which stops an UNCHANGED site being
 * re-analysed after it has been re-fetched.
 */
export function recrawlDecision({ prospect = null, now = new Date(), force = false, minIntervalMs = MIN_RECRAWL_MS } = {}) {
  if (force) return { act: "crawl", reason: "forced" };
  const last = prospect?.lastCrawledAt ? new Date(prospect.lastCrawledAt) : null;
  if (!last || Number.isNaN(last.getTime())) return { act: "crawl", reason: "never_crawled" };

  const at = (now instanceof Date ? now : new Date(now)).getTime();
  const age = at - last.getTime();
  if (age >= minIntervalMs) return { act: "crawl", reason: "due" };

  return {
    act: "skip",
    reason: "crawled_recently",
    ageMs: age,
    nextDueAt: new Date(last.getTime() + minIntervalMs),
  };
}

/**
 * Is this domain on FieldQuo's do-not-contact list?
 *
 * NOT suppressionVerdict(), and the reason is worth stating: that function
 * takes a CHANNEL and refuses any channel it does not recognise — correctly,
 * because a typo'd channel silently bypassing the list is the failure it
 * exists to prevent. A crawl is not a channel, so passing it one would mean
 * either inventing a fake channel (and having every crawl refused) or lying
 * about which channel this is.
 *
 * So the question here is narrower and answered directly: has anyone at this
 * domain asked FieldQuo to stop, on any channel at all? A takedown is not
 * channel-specific — AUDIT-compliance.md §10 requires honouring one
 * "immediately and permanently", and a request to stop that still permitted us
 * to keep reading their website every month would not be honouring it.
 *
 * @param rows SalesSuppression rows already read for this domain
 */
export function crawlSuppressed(rows = []) {
  const live = (rows || []).filter((r) => r && r.kind === "domain" && !r.removedAt);
  if (!live.length) return { suppressed: false, hit: null };
  return { suppressed: true, hit: live[0] };
}

/**
 * Is a failed fetch worth trying again?
 *
 * The distinction the brief asks for: "a dead site must produce a recorded,
 * terminal outcome with a reason rather than an endless retry." Some failures
 * are unlucky and some are facts about the world.
 *
 *   terminal — the URL is not fetchable and will not become so: it failed the
 *              safety vet, or the name does not resolve at all. Retrying is
 *              five more DNS lookups arriving at the same NXDOMAIN.
 *   retry    — a timeout, a reset, a 5xx. The runner's ladder bounds it at
 *              MAX_ATTEMPTS, so "retry" is never endless either; it is five
 *              tries over about fifteen minutes and then `failed`.
 */
export function fetchFailureOutcome(error) {
  const raw = String(error || "");
  if (!raw) return { terminal: false, reason: "unknown_error" };
  if (raw.startsWith("unsafe_url:")) return { terminal: true, reason: raw };
  if (raw.includes("resolves_private")) return { terminal: true, reason: raw };
  if (raw.includes("dns_no_address")) return { terminal: true, reason: raw };
  if (/ENOTFOUND|EAI_AGAIN|NXDOMAIN/i.test(raw)) {
    // EAI_AGAIN is a temporary resolver failure and is deliberately grouped
    // with ENOTFOUND anyway: at this stage the two are indistinguishable from
    // the outside, and a prospect whose domain resolves next week is picked up
    // by the next scheduled crawl rather than by a retry ladder.
    return { terminal: true, reason: raw };
  }
  if (raw === "too_many_redirects" || raw === "bad_redirect_location") return { terminal: true, reason: raw };
  return { terminal: false, reason: raw };
}
