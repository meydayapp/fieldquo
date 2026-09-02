// lib/sales/pipeline/limits.js
//
// Per-provider concurrency and rate limiting for the pipeline — the seam, and
// an honest interim implementation behind it.
//
// ══ BE HONEST ABOUT WHAT THIS IS ═══════════════════════════════════════════
//
// lib/rateLimit.js opens with the same warning and it applies here word for
// word: a counter in this module's memory is PER LAMBDA INSTANCE. Two cron
// invocations that overlap — a slow run still draining while the next tick
// fires — each get a fresh allowance, so what is enforced below is a ceiling
// per INVOCATION, not a global one.
//
// That is enough for what the ceiling is actually for right now: stopping one
// run from firing two hundred requests at one vendor in ninety seconds. It is
// NOT enough for per-host crawl politeness, and nothing here should be mistaken
// for it — CrawlHostPolicy exists as a database table precisely because
// robots.txt crawl-delay cannot live in lambda memory, and its schema comment
// says so. CRAWL_WEBSITE's handler must consult that table as well as this
// budget; this one caps how much a single run may attempt, that one decides
// whether a specific host may be touched at all.
//
// ══ The seam ═══════════════════════════════════════════════════════════════
//
// The runner never reads PROVIDER_LIMITS. It asks a budget object, and the
// budget object is injectable. Swapping the in-memory counter for a durable one
// (a Postgres row per provider per minute, the same move CrawlHostPolicy
// already made) means writing a new `take()` and passing it in — no change to
// the runner, no second place that knows what a limit means.
//
// The numbers below are DEFAULTS, chosen to be defensible rather than tuned,
// and they are live: every one of them is enforced today. They are not a
// placeholder waiting for a feature flag — AGENTS.md failure class #8 — they
// are a ceiling that a later agent with real vendor quotas should lower or
// raise with evidence.

/**
 * maxPerRun — how many tasks drawing on this provider one invocation may
 * claim. Sized against the batch (see BATCH in the cron route): the sum across
 * providers deliberately EXCEEDS the batch, so a run made entirely of one
 * stage still fills up, while a run that is all one provider cannot.
 *
 * minGapMs — the pause between two consecutive tasks on the same provider
 * inside one run. Zero means "as fast as the handler returns". It is expressed
 * here rather than inside a handler so that three stages sharing one vendor
 * share one pace.
 */
export const PROVIDER_LIMITS = {
  // A paid directory API billed per call. Kept well under the batch so a
  // single campaign's discovery cannot spend a day's quota in one tick.
  discovery: { maxPerRun: 10, minGapMs: 0 },
  // Other people's web servers, one request each. The real politeness gate is
  // CrawlHostPolicy; this only stops a run being nothing but crawling.
  http_crawl: { maxPerRun: 20, minGapMs: 0 },
  // Three stages share this budget on purpose — the vendor bills the sum.
  openai: { maxPerRun: 10, minGapMs: 0 },
  // Nothing outside the process. Throttling it would protect nothing and slow
  // the pipeline down, so it is capped only by the batch itself.
  local: { maxPerRun: Infinity, minGapMs: 0 },
};

/**
 * The ceiling applied to a provider nobody has declared.
 *
 * Deliberately restrictive rather than unlimited. A kind that reaches
 * production with an unmapped provider is a mistake, and the safe reading of a
 * mistake that spends money is "a little, then stop" — not "as much as the
 * batch allows". Absence of a limit is not a statement that there is none
 * (AGENTS.md failure class #5).
 */
export const UNKNOWN_PROVIDER_LIMIT = { maxPerRun: 2, minGapMs: 0 };

export function limitsFor(provider, limits = PROVIDER_LIMITS) {
  return limits[provider] || UNKNOWN_PROVIDER_LIMIT;
}

/**
 * A per-invocation budget.
 *
 * `take(provider)` returns true when this run may start one more task on that
 * provider, false when the ceiling is reached. A false is NOT a failure: the
 * runner leaves the row untouched — no claim, no attempt, no backoff — so the
 * next tick picks it up unchanged. Charging a deferred task an attempt would
 * let a busy provider exhaust the retry ladder of work that never ran.
 *
 * `waitMs(provider)` is how long the runner should pause before the next task
 * on that provider. Returned rather than slept here so the runner owns every
 * await and a check can drain the whole batch instantly.
 */
export function makeProviderBudget({ limits = PROVIDER_LIMITS } = {}) {
  const used = new Map();

  return {
    take(provider) {
      const cap = limitsFor(provider, limits).maxPerRun;
      const already = used.get(provider) || 0;
      if (already >= cap) return false;
      used.set(provider, already + 1);
      return true;
    },
    waitMs(provider) {
      const gap = limitsFor(provider, limits).minGapMs || 0;
      // No gap before the first one — the pause is BETWEEN requests, and
      // sleeping before the first would tax every run for nothing.
      return (used.get(provider) || 0) > 1 ? gap : 0;
    },
    spent() {
      return Object.fromEntries(used);
    },
  };
}
