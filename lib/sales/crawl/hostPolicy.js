// lib/sales/crawl/hostPolicy.js
//
// CrawlHostPolicy, read and written. The per-host politeness state that cannot
// live in memory.
//
// ══ Why a compare-and-set and not a read-then-write ════════════════════════
//
// The table's own schema comment names the failure: "Two lambdas hammering one
// contractor's site is how FieldQuo's crawler gets blocked and deserves to
// be." A read-then-write does not prevent that. Two invocations both read
// lastRequestAt, both compute the same "the gap has elapsed", and both fire —
// which is precisely the simultaneous pair the table exists to stop.
//
// So reserving a slot is an updateMany whose `where` names the lastRequestAt
// that was READ. The loser matches zero rows and is told so. This is the same
// discipline as claimTask in lib/sales/pipeline/runner.js and lib/voice/
// autoTopup.js's claim, applied to a resource that belongs to somebody else's
// web server instead of to us.
//
// ══ Wall-clock time, not the batch's `now` ═════════════════════════════════
//
// The runner hands every handler one `now` for the whole batch. That is right
// for deciding which rows are due and wrong for measuring the gap between two
// requests: a batch that takes forty seconds would otherwise think no time had
// passed at all and space nothing. Everything here reads a clock, and the
// clock is injectable so a check can drive it.
import { hostSlotDecision, MAX_WAIT_MS } from "./policy";

/** The columns every reader here needs. One list, so they cannot disagree. */
export const HOST_POLICY_SELECT = {
  id: true,
  host: true,
  robotsAllowed: true,
  robotsFetchedAt: true,
  crawlDelayMs: true,
  lastRequestAt: true,
  requestCount: true,
  blockedUntil: true,
  blockReason: true,
};

/** The row for a host, creating an empty one if this is the first sighting.
 *
 *  An empty row has robotsAllowed null, which is NOT "allowed" — see
 *  robotsDecision in policy.js. Creating the row up front is what lets the
 *  compare-and-set below name a value it has read. */
export async function ensureHostPolicy(db, host) {
  const key = String(host || "").toLowerCase();
  if (!key) return null;

  const existing = await db.crawlHostPolicy.findUnique({ where: { host: key }, select: HOST_POLICY_SELECT });
  if (existing) return existing;

  try {
    return await db.crawlHostPolicy.create({ data: { host: key }, select: HOST_POLICY_SELECT });
  } catch {
    // Two runs met on the same new host. The unique index decided it; re-read
    // rather than treating a lost race as an error.
    return db.crawlHostPolicy.findUnique({ where: { host: key }, select: HOST_POLICY_SELECT });
  }
}

/**
 * Take the right to make ONE request to this host.
 *
 * @returns { ok: true, policy, waitedMs }
 *        | { ok: false, reason, until?, waitMs? }
 *
 * reasons: "blocked" (the host told us to stop), "defer" (the crawl-delay is
 * longer than one invocation should wait), "still_waiting" (we waited out the
 * delay and it was still not our turn), "slot_taken" (another lambda won the
 * compare-and-set), "no_host".
 */
export async function reserveHostSlot(db, {
  host,
  maxWaitMs = MAX_WAIT_MS,
  attempts = 3,
  deps = {},
} = {}) {
  const clock = deps.clock || (() => new Date());
  const sleep = deps.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const key = String(host || "").toLowerCase();
  if (!key) return { ok: false, reason: "no_host" };

  let waitedMs = 0;
  // Remembered so the refusal can say WHICH thing went wrong. "we waited and
  // it was still not our turn" and "another lambda beat us to the write" are
  // both retryable, and a caller debugging a stalled crawl needs to know
  // which one it is looking at.
  let lastAct = null;

  for (let attempt = 0; attempt < Math.max(1, attempts); attempt++) {
    const policy = await ensureHostPolicy(db, key);
    if (!policy) return { ok: false, reason: "no_host" };

    const now = clock();
    const decision = hostSlotDecision({ policy, now, maxWaitMs });
    lastAct = decision.act;

    if (decision.act === "blocked") {
      return { ok: false, reason: "blocked", until: decision.until, blockReason: decision.reason };
    }
    if (decision.act === "defer") {
      return { ok: false, reason: "defer", waitMs: decision.waitMs };
    }
    if (decision.act === "wait") {
      await sleep(decision.waitMs);
      waitedMs += decision.waitMs;
      // Round again rather than firing: the sleep is exactly the window in
      // which another invocation could have taken the slot, so the value we
      // are about to compare-and-set against has to be re-read.
      continue;
    }

    const taken = await db.crawlHostPolicy.updateMany({
      where: { host: key, lastRequestAt: policy.lastRequestAt ?? null },
      data: { lastRequestAt: clock(), requestCount: { increment: 1 } },
    });
    if (taken.count === 1) return { ok: true, policy, waitedMs };
    // Somebody else moved lastRequestAt between our read and our write. That
    // is the race working, not an error.
    lastAct = "lost_cas";
  }

  return { ok: false, reason: lastAct === "wait" ? "still_waiting" : "slot_taken", waitedMs };
}

/**
 * Record what robots.txt said.
 *
 * `allowed` is written ONLY when we actually know. A robots.txt that could not
 * be fetched leaves the column alone — writing `true` there is the exact
 * mistake the three-valued column exists to prevent, and writing `false` would
 * claim the host refused us when it merely failed to answer.
 */
export async function recordRobots(db, { host, allowed, crawlDelayMs = null, deps = {} } = {}) {
  const clock = deps.clock || (() => new Date());
  const key = String(host || "").toLowerCase();
  if (!key || typeof allowed !== "boolean") return null;

  return db.crawlHostPolicy.update({
    where: { host: key },
    data: {
      robotsAllowed: allowed,
      robotsFetchedAt: clock(),
      // null is written through on purpose: a site that REMOVED its
      // Crawl-delay should stop being throttled by the one it used to have.
      // effectiveDelayMs() reads a null as "use our default", which is the
      // honest reading of a directive that is no longer there.
      crawlDelayMs: crawlDelayMs ?? null,
    },
    select: HOST_POLICY_SELECT,
  });
}

/**
 * Record that a host told us to stop, and until when.
 *
 * Never shortens an existing block. Two prospects on one host both getting a
 * 429 would otherwise let the second one's shorter default overwrite the first
 * one's honoured Retry-After, and we would come back early — which is the one
 * thing a 429 asks us not to do.
 */
export async function blockHost(db, { host, until, reason = "blocked", deps = {} } = {}) {
  const key = String(host || "").toLowerCase();
  if (!key || !until) return null;
  const at = until instanceof Date ? until : new Date(until);
  if (Number.isNaN(at.getTime())) return null;

  const current = await ensureHostPolicy(db, key);
  const existing = current?.blockedUntil ? new Date(current.blockedUntil) : null;
  if (existing && existing.getTime() >= at.getTime()) return current;

  return db.crawlHostPolicy.update({
    where: { host: key },
    data: { blockedUntil: at, blockReason: String(reason).slice(0, 200) },
    select: HOST_POLICY_SELECT,
  });
}
