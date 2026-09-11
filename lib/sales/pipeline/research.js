// lib/sales/pipeline/research.js
//
// Queue whatever research a prospect is still missing — for the one a rep
// just claimed, first.
//
// ══ What was measured, and why this file exists ════════════════════════════
//
// 2026-09-11, production: 321,668 prospects. `lastCrawledAt` set on 4,224.
// `hasWebsite: true` on 46,537. Research (ENRICH → … → GENERATE_RESEARCH_BRIEF)
// had run 13,734 times, every one of them queued by DISCOVER_BUSINESSES for a
// Google/Overture campaign page; the 267,087 rows the licensing boards
// imported (us_ca_cslb 217,927, rbq 49,160) never entered it, because nothing
// but discovery ever queued an ENRICH_BUSINESS task. And CRAWL_WEBSITE had
// zero pending — 1,171 `failed`, 772 of them
// `robots_error:unsafe_host:dns_error:EBUSY`, which is the local resolver out
// of capacity and not a statement about 772 websites.
//
// So the rep's queue handed out a business with a website, a URL, no crawl,
// no capabilities and no technologies, and the playbook said "Nothing has been
// observed about this business yet". Correct, and useless.
//
// ══ The contract ═══════════════════════════════════════════════════════════
//
//   ensureResearchQueued({ db, prospectIds, priority })
//
// Idempotent: call it twice, or from two lambdas at once, and one task per
// missing stage exists. It queues the FIRST stage missing from the chain and
// stops — chain.js queues each successor when its predecessor settles, and a
// second queuer would race it into duplicates. `priority: "claimed"` puts the
// tasks ahead of the backlog (priority.js says how) and is what the claim
// route calls. `priority: "backlog"` is the cron's slice and phrases nothing.
//
// ══ What "missing" means, stage by stage ═══════════════════════════════════
//
//   ENRICH_BUSINESS         never queued for this prospect. A board row has no
//                           Google place; that stage does not care — it
//                           refuses, repairs, and routes by websiteUrl, and
//                           the note says which. `promote: false` travels
//                           with it: see enrichBusiness.js on why a claimable
//                           prospect must stay `discovered`.
//   CRAWL_WEBSITE           a website and no lastCrawledAt, and either no crawl
//                           task, or one that FAILED for a reason worth
//                           trying again (crawlRetryable). A refusal —
//                           robots.txt, a private address, an unreachable
//                           robots file — is dealt with and stays dealt with.
//   the rest                the predecessor settled and this stage was never
//                           queued (the chain was added after the predecessor
//                           ran, or its enqueue was lost).
//   GENERATE_CALL_SCRIPT    claimed lane only, after the brief. The backlog
//                           does not get scripts — cost.
//
// A stage that is queued and waiting is PROMOTED into the claimed lane rather
// than queued again: its notBefore is moved to the front and the lane written
// into its payload so the chain inherits it. A stage in flight this second is
// left alone — its successor lands in the backlog lane, and the next call
// picks it up.
//
// ══ Bounded ════════════════════════════════════════════════════════════════
//
// A transient failure is re-queued at most MAX_REQUEUES times per prospect and
// kind. The key carries the count of tasks that already exist for that pair,
// so two callers arriving together collide on the same key (dedupe) and a
// caller arriving after the retry itself failed computes the next one.
import { CLAIMED_TAIL as CHAIN_CLAIMED_TAIL, NEXT_STAGE } from "./chain";
import { enqueuePipelineTask } from "./tasks";
import { RESEARCH_PRIORITIES, notBeforeFor } from "./priority";
import { CALL_SCRIPT_VERSION } from "@/lib/sales/intel/callScript";

/** How many times a kind may be re-queued for one prospect after a transient
 *  failure. Each queued task already has five attempts behind it, so this is
 *  fifteen tries at a website before this file stops asking. */
export const MAX_REQUEUES = 2;

/** The stages a prospect WITH a website goes through, in order. Derived from
 *  the chain so there is one order, not two. */
export const RESEARCH_CHAIN = Object.freeze((() => {
  const walked = ["ENRICH_BUSINESS", "CRAWL_WEBSITE"];
  while (NEXT_STAGE[walked.at(-1)]) walked.push(NEXT_STAGE[walked.at(-1)]);
  return walked;
})());

/** …and one WITHOUT: enrich routes straight to the opportunity analysis, past
 *  the three stages that can only read a page. Mirrors routeAfterEnrich. */
export const RESEARCH_CHAIN_NO_WEBSITE = Object.freeze(
  RESEARCH_CHAIN.filter((k) => !["CRAWL_WEBSITE", "DETECT_TECHNOLOGY", "ANALYZE_CAPABILITIES"].includes(k)),
);

/** The tail only a claimed prospect gets, walked from chain.js's own table so
 *  this file cannot name a stage the chain does not queue. */
export const CLAIMED_TAIL = Object.freeze((() => {
  const walked = [];
  let kind = CHAIN_CLAIMED_TAIL[RESEARCH_CHAIN.at(-1)] || null;
  while (kind) {
    walked.push(kind);
    kind = CHAIN_CLAIMED_TAIL[kind] || null;
  }
  return walked;
})());

/** Every kind this file reads rows for. */
export const RESEARCH_KINDS = Object.freeze([...RESEARCH_CHAIN, ...CLAIMED_TAIL]);

const LIVE = new Set(["queued", "claimed"]);

/**
 * Is this crawl failure worth queueing again?
 *
 * Only the failures that are about US rather than about the site:
 *
 *   dns_error:EBUSY / EAI_AGAIN / EMFILE / ENFILE — the local resolver or
 *       file table ran out. c-ares and getaddrinfo report it on the lookup,
 *       and the lookup is ours.
 *   robots_error:TypeError — undici's "fetch failed" with its cause lost; a
 *       reset or a TLS hiccup, measured at 152 and never the same host twice.
 *   host_slot:* — another lambda held the host, or the crawl-delay outran the
 *       run. "Not now", never "not ever".
 *   dns_backoff — held by our own per-host DNS backoff (policy.js).
 *
 * Everything else — `robots_unreachable_301`, `resolves_private`,
 * `robots_disallowed`, `too_many_redirects`, a timeout five times over — is a
 * statement about the site, and a sixth try is a sixth copy of the same
 * sentence. The runner's "gave up after N attempts: " prefix is stripped
 * first because that is how every `failed` row reads.
 */
export function crawlRetryable(lastError) {
  const raw = String(lastError || "").replace(/^gave up after \d+ attempts?: /, "");
  if (!raw) return false;
  if (/dns_error:(EBUSY|EAI_AGAIN|EMFILE|ENFILE)\b/.test(raw)) return true;
  if (/^robots_error:TypeError\b/.test(raw)) return true;
  if (/^host_slot:/.test(raw)) return true;
  if (/^dns_backoff\b/.test(raw)) return true;
  return false;
}

/** The dedupe key for a stage queued by this file. The count is what lets a
 *  retry exist beside the task it retries — see the header. */
export function researchKey({ kind, prospectId, existing = 0 }) {
  return `research:${kind}:${prospectId}:${Math.max(0, Math.floor(Number(existing) || 0))}`;
}

/**
 * Decide, without a database, what one prospect still needs.
 *
 * @param prospect  { id, websiteUrl, lastCrawledAt, doNotContactAt, campaignId }
 * @param tasks     this prospect's SalesPipelineTask rows, any kind, any status
 * @param priority  "claimed" | "backlog"
 * @param script    the ProspectCallScript row, or null
 * @returns { enqueue: [spec], promote: [taskId], skipped: reason|null }
 *
 * Pure so scripts/check-pipeline-progress.mjs can drive every branch — the
 * EBUSY row, the refused row, the half-finished chain — against the real
 * function rather than a description of it.
 */
export function researchPlan({ prospect, tasks = [], priority = "backlog", script = null } = {}) {
  const none = { enqueue: [], promote: [] };
  if (!prospect?.id) return { ...none, skipped: "prospect_not_found" };
  if (!RESEARCH_PRIORITIES.includes(priority)) return { ...none, skipped: "unknown_priority" };
  if (prospect.doNotContactAt) return { ...none, skipped: "do_not_contact" };

  const byKind = new Map();
  for (const t of tasks) {
    if (!t?.kind) continue;
    if (!byKind.has(t.kind)) byKind.set(t.kind, []);
    byKind.get(t.kind).push(t);
  }
  const of = (kind) => byKind.get(kind) || [];
  // The requeue bound counts tries, not history. A task that finished is not
  // a try that failed: a prospect whose script was written twice and is stale
  // a third time — a new crawl, a new prompt version — has never been
  // re-queued after a failure at all, and counting its done rows would have
  // exhausted the bound for the one prospect the owner was reading. Found
  // exactly that way: South County had three done GENERATE_CALL_SCRIPT rows
  // and the version bump could not reach it.
  const tries = (kind) => of(kind).filter((task) => task?.status !== "done").length;
  const latest = (kind) =>
    [...of(kind)].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0] || null;

  // A listed URL, or a crawl the enrich stage already routed to — the RBQ
  // path derives a domain from the licence email and has no websiteUrl, and
  // the task row is the only sign of it here.
  const hasWebsite =
    (typeof prospect.websiteUrl === "string" && prospect.websiteUrl.trim().length > 0) ||
    of("CRAWL_WEBSITE").length > 0;
  const chain = hasWebsite ? RESEARCH_CHAIN : RESEARCH_CHAIN_NO_WEBSITE;

  const spec = (kind, extra = {}) => ({
    kind,
    prospectId: prospect.id,
    campaignId: prospect.campaignId ?? null,
    payload: {
      prospectId: prospect.id,
      priority,
      ...(priority === "backlog" ? { phrase: false } : {}),
      ...extra,
    },
    notBefore: notBeforeFor(priority),
    idempotencyKey: researchKey({ kind, prospectId: prospect.id, existing: of(kind).length }),
  });

  // A waiting task is moved into the lane rather than duplicated. Only on the
  // claimed lane: the backlog lane IS the default position.
  const promoteOrStop = (task) =>
    priority === "claimed" && task.status === "queued" && task.payload?.priority !== "claimed"
      ? { ...none, promote: [task.id], skipped: null }
      : { ...none, skipped: task.status === "claimed" ? "in_flight" : "already_queued" };

  // One live task means the chain is moving: it will queue its own successor
  // when it settles, and queueing anything else now races it into a
  // duplicate. The chain is serial per prospect, so the first live row is the
  // only one there is.
  const moving = tasks.find((t) => t?.kind && LIVE.has(t.status) && RESEARCH_KINDS.includes(t.kind));
  if (moving) return promoteOrStop(moving);

  for (const kind of chain) {
    const last = latest(kind);

    if (kind === "ENRICH_BUSINESS") {
      if (!last) return { ...none, enqueue: [spec(kind, { promote: false })], skipped: null };
      // Enrich refused — do-not-contact, suppressed, not found. The chain ends
      // here on purpose and nothing below may be queued around it.
      if (last.status === "abandoned") return { ...none, skipped: "enrich_refused" };
      continue;
    }

    if (kind === "CRAWL_WEBSITE") {
      if (prospect.lastCrawledAt) continue;
      if (!last) return { ...none, enqueue: [spec(kind)], skipped: null };
      if (last.status === "failed" && crawlRetryable(last.lastError)) {
        if (tries(kind) > MAX_REQUEUES) return { ...none, skipped: "requeues_exhausted" };
        return { ...none, enqueue: [spec(kind)], skipped: null };
      }
      // Refused, or failed for a reason about the site. Dealt with; the chain
      // advanced past it when it settled (shouldAdvance), so carry on.
      continue;
    }

    if (!last) return { ...none, enqueue: [spec(kind)], skipped: null };
  }

  if (priority !== "claimed") return { ...none, skipped: "complete" };

  for (const kind of CLAIMED_TAIL) {
    // Stale three ways: no script; a script older than the crawl; a script
    // written by an earlier prompt. The third is what makes a prompt rewrite
    // reach the rows — the owner's voice correction bumped CALL_SCRIPT_VERSION
    // and 101 stored scripts would otherwise have kept the old voice until
    // their site was crawled again. The handler's hash check is the second
    // gate: a row already at the current version spends nothing.
    const stale =
      !script ||
      (prospect.lastCrawledAt && script.crawledAt && new Date(script.crawledAt) < new Date(prospect.lastCrawledAt)) ||
      (script.promptVersion != null && script.promptVersion !== CALL_SCRIPT_VERSION);
    if (!stale) continue;
    if (tries(kind) > MAX_REQUEUES) return { ...none, skipped: "requeues_exhausted" };
    return { ...none, enqueue: [spec(kind)], skipped: null };
  }

  return { ...none, skipped: "complete" };
}

/**
 * Queue what each prospect is missing. See the header for the contract.
 *
 * @param db           a Prisma client — passed, never imported, so the claim
 *                     route's transaction client and a check's fake both work.
 * @param prospectIds  any length; read in one query each for prospects, tasks
 *                     and scripts, then planned one at a time.
 * @param priority     "claimed" | "backlog"
 * @param now          the clock, for the audit only.
 *
 * @returns { queued, promoted, prospects: [{ prospectId, queued: [kind],
 *            promoted: [kind], skipped }] }
 *
 * Never throws for a prospect that is missing, refused or complete — each is
 * a `skipped` reason on its own row. A database error does throw: the claim
 * route must know its research did not queue.
 */
export async function ensureResearchQueued({ db, prospectIds = [], priority = "claimed", now = new Date() } = {}) {
  if (!db) throw new Error("ensureResearchQueued: db is required");
  const ids = [...new Set((Array.isArray(prospectIds) ? prospectIds : []).filter((id) => typeof id === "string" && id))];
  const out = { priority, queued: 0, promoted: 0, prospects: [] };
  if (!ids.length) return out;
  if (!RESEARCH_PRIORITIES.includes(priority)) {
    throw new Error(`ensureResearchQueued: priority must be one of ${RESEARCH_PRIORITIES.join(", ")}`);
  }

  const [prospects, tasks, scripts] = await Promise.all([
    db.prospect.findMany({
      where: { id: { in: ids } },
      select: { id: true, websiteUrl: true, lastCrawledAt: true, doNotContactAt: true, campaignId: true },
    }),
    db.salesPipelineTask.findMany({
      where: { prospectId: { in: ids }, kind: { in: RESEARCH_KINDS } },
      select: { id: true, kind: true, status: true, lastError: true, payload: true, prospectId: true, createdAt: true },
    }),
    // The model may be absent from a client generated before it was added.
    typeof db.prospectCallScript?.findMany === "function"
      ? db.prospectCallScript.findMany({
          where: { prospectId: { in: ids } },
          select: { prospectId: true, crawledAt: true, generatedAt: true, promptVersion: true },
        })
      : Promise.resolve([]),
  ]);

  const prospectById = new Map(prospects.map((p) => [p.id, p]));
  const tasksById = new Map();
  for (const t of tasks) {
    if (!tasksById.has(t.prospectId)) tasksById.set(t.prospectId, []);
    tasksById.get(t.prospectId).push(t);
  }
  const scriptById = new Map(scripts.map((s) => [s.prospectId, s]));

  for (const id of ids) {
    const plan = researchPlan({
      prospect: prospectById.get(id) || null,
      tasks: tasksById.get(id) || [],
      priority,
      script: scriptById.get(id) || null,
    });
    const row = { prospectId: id, queued: [], promoted: [], skipped: plan.skipped };

    for (const s of plan.enqueue) {
      const task = await enqueuePipelineTask(s, { deps: { db } });
      // enqueuePipelineTask hands back the EXISTING row on a key collision —
      // a concurrent caller won — selected without createdAt. Counting it
      // would report work this call did not do.
      if (task && Object.hasOwn(task, "createdAt")) row.queued.push(s.kind);
    }

    for (const taskId of plan.promote) {
      const existing = (tasksById.get(id) || []).find((t) => t.id === taskId);
      const payload = existing?.payload && typeof existing.payload === "object" ? existing.payload : {};
      // The backlog lane's `phrase: false` does not survive promotion: a rep
      // is now waiting, and the brief they read should be the phrased one.
      // Found on the first live run — the backlog had reached the prospect
      // first, and a promoted task would have carried the flag to the brief.
      const { phrase: _dropped, ...kept } = payload;
      // Guarded on `queued`: a task claimed between our read and this write
      // belongs to a runner, and rewriting its payload under it would race
      // the settle. It is left alone and the next call finds it settled.
      const moved = await db.salesPipelineTask.updateMany({
        where: { id: taskId, status: "queued" },
        data: { notBefore: notBeforeFor(priority), payload: { ...kept, priority } },
      });
      if (moved.count === 1) row.promoted.push(existing?.kind || taskId);
    }

    out.queued += row.queued.length;
    out.promoted += row.promoted.length;
    out.prospects.push(row);
  }

  out.at = now instanceof Date ? now.toISOString() : String(now);
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// The backlog: every website nobody has read, a slice per run, bounded
// ═══════════════════════════════════════════════════════════════════════════
//
// ── The arithmetic, so nobody has to re-derive it ─────────────────────────
//
// Two ceilings, and the smaller one binds:
//
//   the provider budget   limits.js http_crawl.maxPerRun = 40, and the cron
//                         fires 60 times an hour, so 2,400 crawls an hour at
//                         most. 42,383 prospects had hasWebsite and no crawl
//                         on 2026-09-11 (35,578 of them claimable — status
//                         `discovered`, a websiteUrl, no do-not-contact, no
//                         enrich or crawl task yet): 42,383 / 2,400 = 17.7
//                         hours if every run spent its whole crawl budget.
//   the run's wall clock  it will not. A crawl is robots.txt plus up to
//                         MAX_PAGES_PER_RUN (6) pages with the host's
//                         crawl-delay (3 s default) between each, so roughly
//                         20 s each, sequentially, inside maxDuration = 300 s:
//                         about 14 crawls a run, 840 an hour, and the same
//                         42,383 takes about 50 hours — two days and change.
//
// Neither number is raised here. The http_crawl budget was the ceiling that
// produced EBUSY (limits.js says so), and the answer to a resolver out of
// capacity is the per-host DNS backoff in lib/sales/crawl/policy.js, not more
// concurrent lookups. What THIS bound decides is the size of the queue, not
// the speed of the drain: BACKLOG_PENDING_CEILING keeps the number of
// enrich-or-crawl tasks waiting under five thousand, so the table does not
// grow to thirty-five thousand pending rows on the first tick and the claimed
// lane still has a short list to sort ahead of.
//
// ── Free by construction ──────────────────────────────────────────────────
//
// The backlog lane carries `phrase: false` down the chain, so the brief stage
// composes its card from rows and calls no model. Nothing in this slice
// spends anything outside the process except the crawl itself. A prospect
// gets a phrased brief and a call script when a rep claims it — the claimed
// lane — and not before.

/** Waiting enrich-or-crawl tasks may not exceed this before the slice stops
 *  adding to them. See the arithmetic above. */
export const BACKLOG_PENDING_CEILING = 5_000;

/** How many prospects one run may add. A little above the crawl rate, so the
 *  pending pool fills to the ceiling and then holds there rather than
 *  starving between ticks. */
export const BACKLOG_TOPUP_PER_RUN = 60;

/** The kinds whose pending count the ceiling measures — the two the slice
 *  itself queues, since a chain further along is a crawl already paid for. */
export const BACKLOG_PENDING_KINDS = Object.freeze(["ENRICH_BUSINESS", "CRAWL_WEBSITE"]);

/** How many the slice may add this run. Pure — the number a check drives. */
export function backlogRoom({ pending = 0, ceiling = BACKLOG_PENDING_CEILING, perRun = BACKLOG_TOPUP_PER_RUN } = {}) {
  const waiting = Math.max(0, Math.floor(Number(pending) || 0));
  return Math.max(0, Math.min(Math.floor(Number(perRun) || 0), Math.floor(Number(ceiling) || 0) - waiting));
}

/**
 * Add up to `perRun` never-crawled websites to the backlog lane.
 *
 * Oldest claimable first: a `discovered` row, a websiteUrl, no do-not-contact,
 * no enrich or crawl task yet, rows with a trade ahead of rows without —
 * because a trade is what puts a row in a rep's queue at all
 * (claimCandidateWhere filters on it), and the point of reading the website
 * is that a rep dials with something to say. A prospect whose crawl already
 * failed is deliberately NOT picked up here: the claim path re-queues those,
 * bounded, when somebody is waiting.
 *
 * @returns { pending, room, considered, queued }
 */
export async function topUpResearchBacklog({
  db,
  now = new Date(),
  ceiling = BACKLOG_PENDING_CEILING,
  perRun = BACKLOG_TOPUP_PER_RUN,
} = {}) {
  if (!db) throw new Error("topUpResearchBacklog: db is required");

  const pending = await db.salesPipelineTask.count({
    where: { kind: { in: [...BACKLOG_PENDING_KINDS] }, status: { in: ["queued", "claimed"] } },
  });
  const room = backlogRoom({ pending, ceiling, perRun });
  if (!room) return { pending, room, considered: 0, queued: 0 };

  // Raw because Prospect has no relation to SalesPipelineTask — prospectId is
  // a bare column — so Prisma cannot express "no task exists" for it. The
  // shape is NOT EXISTS over the task table's prospectId index; measured at
  // 169 ms for 60 rows over 321,668 prospects.
  const rows = await db.$queryRaw`
    SELECT p.id
    FROM "Prospect" p
    WHERE p."websiteUrl" IS NOT NULL
      AND p."lastCrawledAt" IS NULL
      AND p."doNotContactAt" IS NULL
      AND p.status = 'discovered'
      AND NOT EXISTS (
        SELECT 1 FROM "SalesPipelineTask" t
        WHERE t."prospectId" = p.id AND t.kind IN ('ENRICH_BUSINESS', 'CRAWL_WEBSITE')
      )
    ORDER BY (p."tradeKey" IS NULL), p."createdAt" ASC
    LIMIT ${room}
  `;

  const ids = (Array.isArray(rows) ? rows : []).map((r) => r?.id).filter(Boolean);
  if (!ids.length) return { pending, room, considered: 0, queued: 0 };

  const result = await ensureResearchQueued({ db, prospectIds: ids, priority: "backlog", now });
  return { pending, room, considered: ids.length, queued: result.queued };
}
