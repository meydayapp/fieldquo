// lib/sales/pipeline/handlers/discoverBusinesses.js
//
// DISCOVER_BUSINESSES: one page of a campaign, ingested.
//
// ══ Several sources, one page each, in order ═══════════════════════════════
//
// A campaign draws from a SET of sources. This handler takes ONE page from
// each open source per task, one after another.
//
// Sequentially, never in parallel, and that is not a style preference: the
// same painter can arrive from Overture and from the RBQ in one run, and
// cross-source duplicate detection is a DATABASE lookup. `ingestPage` loads
// the rows a page could collide with before it writes. Run two sources at
// once and neither one's lookup can see the other's rows, so the duplicate is
// not merely un-flagged — it is invisible, and two prospect rows for one
// painter reach a rep with nothing marking them. Run them in order and the
// second source's lookup finds what the first just wrote.
//
// What that flag means is worth being exact about, because dedupe across
// sources is now the COMMON case rather than the edge case. `matchExisting`
// keys on (sourceProvider, sourceRecordId) first, which cannot match across
// two providers, so a cross-source duplicate always falls to the fuzzy tail —
// phone, then domain, then name+locality. That tail fires on 0.6% of rows and
// is wrong 52.5% of the time when it does, which is exactly why it FLAGS and
// does not merge: merging destroys provenance and a wrong merge is
// unrecoverable, while a wrong flag is a line on a screen. So the second copy
// is written, counted as found and accepted, and carries
// `possibleDuplicateOfId`. `foundCount` counts SOURCE ROWS, not distinct
// businesses — see funnel.js, which now says so on the row itself.
//
// ══ One page per source per task, and the next task enqueued at the end ════
//
// Not a loop that drains a whole campaign. Three reasons, in order of how much
// they cost when ignored:
//
//  1. A thousand-prospect campaign is about two days of pipeline (the
//     arithmetic is in docs/sales-intel/STATUS.md). A handler that tried to
//     finish one in a single invocation would hit whatever the Vercel
//     dashboard's duration limit is — which this code cannot read — and die
//     with the page half written.
//  2. The runner's budget is per task. A handler that ingested twenty pages
//     would spend twenty pages' worth of provider budget against one `take()`.
//  3. Stopping is a decision that has to be re-made from fresh state. A
//     campaign paused by a superadmin while a drain is in flight must stop at
//     the next page, and it only can if there IS a next page.
//
// ══ What it refuses to do ══════════════════════════════════════════════════
//
// Report success on an empty result. A campaign with no snapshot, a provider
// nobody ships, a snapshot from a release this build cannot read — each
// returns `retry:false` with the sentence a superadmin needs, and the campaign
// screen shows it. `done: true, found: 0` would be indistinguishable from "the
// city has no painters", and that is the failure AGENTS.md names first.
//
// ══ Discovery is where the pipeline actually starts ════════════════════════
//
// Ingesting a page created rows and queued nothing, so every prospect sat at
// `discovered` for ever and the seven stages behind this one had no way to be
// reached. `promoteToResearch()` below closes that: after each page, prospects
// still at `discovered` get an ENRICH_BUSINESS task, which is the stage that
// gates, repairs, promotes and routes.
//
// Bounded twice, and the two bounds answer different questions.
//
//   per task      one page's worth, so a campaign of a thousand promotes across
//                 its own pages rather than queueing a thousand tasks inside one
//                 invocation — the same "leftovers next tick" discipline the
//                 batch itself keeps.
//   per campaign  `targetCount` in total, ever. This one is new and it is what
//                 makes an all-trades campaign safe: banking is a row, research
//                 is ~7 pipeline tasks against a platform ceiling of ~3,600 a
//                 day, so a bank of 54,264 promoted in full is 105 days of every
//                 tenant's pipeline. The bank stays unbounded; the spend does
//                 not. See researchBudget().
//
// `needs_review` rows are NOT promoted: a human decides those first, and the
// review screen queues research when they accept one.
//
// ══ Retryable vs terminal ══════════════════════════════════════════════════
//
// A network problem reaching the snapshot is RETRYABLE — the runner's backoff
// exists for exactly that. A misconfigured campaign is TERMINAL: nothing about
// six hours from now makes an absent snapshot URL exist, and five attempts
// would only bury the real message under a retry ladder.
//
// ══ One source fails: the others CONTINUE, and nothing is silent ═══════════
//
// The decision, and the argument for it. A source that fails does not abort
// the page.
//
// Aborting protects nothing. A failing source's cursor is not advanced either
// way, so its page is not lost either way — it is re-attempted on the next
// task. What aborting DOES cost is the healthy source: the task returns
// retry:true, the runner burns an attempt, and after five attempts the task is
// abandoned. That kills the chain, and a campaign drawing from two sources
// stops discovering entirely because one snapshot host answered 502. One
// flaky vendor taking down a source that was working is a worse outcome than
// the thing abort was meant to prevent.
//
// What actually needs protecting is the truth of "finished", and that is
// protected explicitly instead:
//
//   - a source that errors keeps its cursor, records the sentence and the time
//     on the campaign (`sourceState[key].lastError`), and increments its own
//     failure count;
//   - the campaign CANNOT complete while any source is still open, so a
//     campaign whose second source is failing stays `running` with a visible
//     error rather than reporting itself completed on half the data;
//   - after MAX_SOURCE_FAILURES consecutive failures the source is BLOCKED
//     with its reason, so a permanently broken source terminates instead of
//     holding a campaign open for ever — and `blocked` is a different state
//     from `ended`, which is what stops "we ran out of rows" and "it died"
//     rendering as the same word;
//   - a source whose settings or registration are broken is blocked
//     IMMEDIATELY rather than after five identical failures. Nothing about six
//     hours from now makes an absent snapshot URL exist. The block is cleared
//     by the `configure` action, which is the only thing that can fix it.
//
// And every one of those states reaches a human twice: in the task's own
// `lastError` (a `done` task's note is written there by the runner, so a
// partial failure is not silently a success), and on the campaign screen,
// per source.
import { db } from "@/lib/db";
import { haversineKm } from "@/lib/booking/travel";
import { registerHandler } from "../registry";
import { enqueuePipelineTask } from "../tasks";
import { getDiscoveryProvider } from "@/lib/sales/discovery/providers";
import { ingestPage } from "@/lib/sales/discovery/ingest";
import { discoveryStopReason } from "@/lib/sales/discovery/funnel";
import {
  MAX_SOURCE_FAILURES,
  campaignSourceKeys,
  configForSource,
  cursorFingerprint,
  mergeSourceState,
  sourceIsOpen,
  sourceStateFor,
  unavailableReasonOf,
} from "@/lib/sales/discovery/sources";
import { campaignTradeScope } from "@/lib/sales/discovery/trades";
import { RESEARCHABLE_STATUS } from "./enrichBusiness";

/** How many businesses one task ingests PER SOURCE, when the payload does not
 *  say. Per source rather than per task: a campaign with two sources should
 *  read as much of each as a single-source campaign reads of its one, or
 *  adding a second source would halve the first one's rate. */
export const DEFAULT_PAGE_SIZE = 100;

/** How many prospects one task may promote into research. Sized to a page, so
 *  a campaign promotes at the rate it discovers rather than in one burst. */
export const PROMOTE_LIMIT = 100;

/** The task every promotion queues, and therefore the thing that is counted to
 *  know how much of a campaign's research budget has been spent. */
export const RESEARCH_TASK_KIND = "ENRICH_BUSINESS";

/** Statuses in which a campaign may discover. Anything else stops the run. */
export const RUNNABLE_STATUSES = ["running"];

/**
 * The stage, as a pure-ish function over an already-loaded campaign.
 *
 * Exported separately from the registration so the check can drive it with a
 * stub provider and a stub db, and so a handler author can run one page by
 * hand without a cron.
 */
export async function runDiscoverBusinesses({ task, payload = {}, now = new Date(), db: prisma }) {
  const campaignId = task?.campaignId || payload?.campaignId || null;
  if (!campaignId) {
    return { done: false, retry: false, reason: "the task names no campaign, so there is nothing to discover" };
  }

  const campaign = await prisma.prospectCampaign.findUnique({
    where: { id: campaignId },
    include: { territory: true },
  });
  if (!campaign) {
    return { done: false, retry: false, reason: `campaign ${campaignId} no longer exists` };
  }

  // Re-read at run time, never trusted from the payload. A campaign paused
  // three hours ago must not keep discovering because the task was enqueued
  // while it was running — the same discipline lib/migrations/state.js's
  // canWrite() applies to a far more dangerous write.
  if (!RUNNABLE_STATUSES.includes(campaign.status)) {
    return { done: true, note: `campaign is ${campaign.status}, so this page was not run` };
  }

  // A campaign that names no trade AND does not say "every trade" is refused
  // rather than read as either one. Reading it as all-trades would let a
  // half-configured row bank a province; reading it as a trade nobody chose
  // would silently discover nothing. Terminal, because no amount of waiting
  // fills in a choice a human never made.
  const scope = campaignTradeScope(campaign);
  if (!scope.allTrades && !scope.tradeKey) {
    return {
      done: false,
      retry: false,
      reason:
        "this campaign names no trade and is not an all-trades campaign, so there is no way to tell " +
        "whether it should bank one trade or every trade",
    };
  }

  const keys = campaignSourceKeys(campaign);
  if (!keys.length) {
    return {
      done: false,
      retry: false,
      reason: "this campaign names no discovery source, and there is deliberately no default",
    };
  }

  // "Is there more" is now a question about the SET: a campaign is still going
  // while any one source is open. Asking it of a single cursor would have
  // stopped a two-source campaign the moment the first source ran out.
  const openBefore = keys.filter((key) => sourceIsOpen(sourceStateFor(campaign, key)));
  const stopBefore = discoveryStopReason(campaign, { nextCursor: openBefore.length ? "more" : null });
  if (stopBefore) {
    await finish(prisma, campaign, stopBefore, now);
    return { done: true, note: `stopped: ${stopBefore}` };
  }

  const limit = Number(payload?.pageSize) || DEFAULT_PAGE_SIZE;
  const patches = {};
  const notes = [];
  const failures = [];
  let ingested = 0;

  // ── One page from each open source, IN ORDER ──────────────────────────────
  //
  // `for … of` and awaited inside, not Promise.all. See the header: the
  // cross-source duplicate flag depends on the second source's dedupe lookup
  // being able to see what the first source just wrote.
  for (const key of keys) {
    const state = sourceStateFor(campaign, key);
    if (!sourceIsOpen(state)) continue;

    const provider = getDiscoveryProvider(key);
    if (!provider) {
      // Names the value, because "unknown provider" with no value in it sends
      // somebody to read code to find out what the campaign actually says.
      patches[key] = block(state, `no discovery source named "${key}" is registered in this build`, now);
      failures.push(`${key}: not registered`);
      continue;
    }

    const unavailable = unavailableReasonOf(provider);
    if (unavailable) {
      // A source that says it cannot run whatever it is configured with. The
      // create and start routes both refuse to tick it, so reaching here means
      // it became unavailable after the campaign started — which is a real
      // state and is recorded rather than retried.
      patches[key] = block(state, unavailable, now);
      failures.push(`${key}: unavailable`);
      continue;
    }

    const config = configForSource(campaign, key);
    const described = provider.describeConfig(config);
    if (!described.ok) {
      // Terminal, not retryable: nothing about six hours from now makes an
      // absent snapshot URL exist. Cleared by the `configure` action, which is
      // the only thing that can actually fix it.
      patches[key] = block(state, described.problems.join(" "), now);
      failures.push(`${key}: ${described.problems.join(" ")}`);
      continue;
    }

    const page = await provider.fetchPage({
      territory: campaign.territory || null,
      // The same one answer the ingest filters on, so a source that narrows its
      // own fetch by trade cannot be handed a different trade from the one the
      // rows are then judged against.
      tradeKey: scope.tradeKey,
      cursor: state.cursor,
      limit,
      config,
      // haversineKm is injected rather than imported by the provider, so a
      // provider that needs no geometry does not pull in booking code, and a
      // check can drive the radius filter with its own function.
      deps: { haversineKm },
    });

    if (page?.error) {
      // Retryable: the snapshot is a URL over a network, and a 502 next tick
      // is a 200 the tick after. A CONFIGURATION problem was caught above, so
      // anything reaching here is a transport failure. The cursor is NOT
      // advanced, so nothing is lost — this page is attempted again next task.
      const count = state.failures + 1;
      patches[key] =
        count >= MAX_SOURCE_FAILURES
          ? block(state, `${page.error} (gave up after ${count} attempts)`, now, count)
          : { ...state, failures: count, lastError: page.error, lastErrorAt: now.toISOString() };
      failures.push(`${key}: ${page.error}`);
      continue;
    }

    const result = await ingestPage(
      {
        campaign,
        territory: campaign.territory || null,
        businesses: page.businesses || [],
        provider: provider.key,
        release: page.release || null,
        sourceUrl: null,
        now,
      },
      { deps: { db: prisma } },
    );
    ingested++;

    patches[key] = {
      cursor: page.nextCursor || null,
      // No next cursor means this source is out of rows. Its own end, not the
      // campaign's: the other sources keep going.
      ended: !page.nextCursor,
      blocked: null,
      // Reset by a success. A source that fails twice, works, then fails again
      // is not a source four failures deep.
      failures: 0,
      lastError: null,
      lastErrorAt: null,
    };
    notes.push(
      `${key}: found ${result.counters.foundCount}, accepted ${result.counters.acceptedCount}, ` +
        `review ${result.counters.needsReviewCount}, rejected ${result.counters.rejectedCount}`,
    );
  }

  // Nothing ran and something failed: the whole page failed, which is exactly
  // the single-source case and is reported the same way — retryable, with the
  // reasons. Partial success is NOT reported this way; see the header.
  if (!ingested && failures.length) {
    const retryable = Object.values(patches).every((p) => !p.blocked);
    await writeSourceState(prisma, campaign, patches);
    return { done: false, retry: retryable, reason: failures.join(" · ") };
  }

  // Re-read the counters the ingests just moved, so the stop decision is made
  // against what is actually stored rather than against the snapshot of the
  // campaign taken before the pages ran.
  const after = await prisma.prospectCampaign.findUnique({
    where: { id: campaign.id },
    select: { id: true, status: true, targetCount: true, acceptedCount: true },
  });

  const merged = { ...campaign, sourceState: mergeSourceState(campaign, patches) };
  const stillOpen = keys.filter((key) => sourceIsOpen(sourceStateFor(merged, key)));
  const stopAfter = discoveryStopReason(after || campaign, {
    nextCursor: stillOpen.length ? "more" : null,
  });

  await prisma.prospectCampaign.update({
    where: { id: campaign.id },
    data: {
      sourceState: merged.sourceState,
      ...(stopAfter ? { status: statusFor(stopAfter), completedAt: now } : {}),
    },
  });

  if (!stopAfter) {
    // The next page. The idempotency key names where EVERY source got to, so
    // two runs that both finish the same page enqueue ONE next task rather
    // than two — the unique index on idempotencyKey is what makes that a
    // guarantee and not a hope (see lib/sales/pipeline/tasks.js).
    //
    // The payload deliberately no longer names a provider. resolveProvider()
    // reads it to pick a rate-limit budget, and a task that reads three
    // sources cannot honestly claim to spend one of them — so it falls back to
    // PROVIDER_BY_KIND's "discovery" budget, which is the one sized for this
    // stage.
    await enqueuePipelineTask(
      {
        kind: "DISCOVER_BUSINESSES",
        campaignId: campaign.id,
        payload: { sources: stillOpen },
        idempotencyKey: `discover:${campaign.id}:${cursorFingerprint(merged)}`,
      },
      { deps: { db: prisma } },
    );
  }

  // ── The gate between a big bank and a ruinous pipeline ────────────────────
  //
  // Banking is cheap; researching is not. STATUS.md's arithmetic: ~3,600
  // pipeline tasks/day platform-wide and ~7 tasks per fully-researched
  // prospect, so about 514 prospects/day for the WHOLE platform. Quebec's RBQ
  // register alone is 54,264 rows. Promoting a bank that size would be 105 days
  // of every tenant's pipeline spent on one campaign, queued by a Start button
  // that said nothing about it.
  //
  // So promotion is bounded by the number a human typed. `targetCount` already
  // means "how many prospects this campaign is for" — discovery stops at that
  // many accepted — and it now bounds the expensive half too. The bank is not
  // bounded by it: rows keep being written and stay at `discovered`, costing a
  // row each, which is the whole point of the bank/queue split.
  const spent = await prisma.salesPipelineTask.count({
    where: { kind: RESEARCH_TASK_KIND, campaignId: campaign.id },
  });
  const budget = researchBudget({ targetCount: after?.targetCount ?? campaign.targetCount, spent });
  const promoted = budget
    ? await promoteToResearch({ prisma, campaignId: campaign.id, limit: Math.min(PROMOTE_LIMIT, budget) })
    : 0;

  return {
    done: true,
    // Failures are named in the note even on a `done` page, and the runner
    // writes a completed task's note into `lastError` — so a partial failure
    // reaches the screen instead of being a success with a smaller number.
    //
    // A spent budget is named for the same reason: a campaign that keeps
    // banking rows and has stopped researching them must not read as a
    // campaign that is researching them.
    note:
      [...notes, ...failures.map((f) => `FAILED ${f}`)].join(" · ") +
      ` · queued ${promoted} for research` +
      (budget ? "" : ` (research budget spent: ${spent} of ${researchTarget(after?.targetCount ?? campaign.targetCount)})`) +
      (stopAfter ? ` — ${stopAfter}` : ""),
  };
}

/**
 * How many more of this campaign's prospects may be promoted into research.
 *
 * Pure, and exported, because it is the arithmetic that decides whether one
 * Start button spends a hundred days of the platform's pipeline — the kind of
 * decision that has to be runnable against hostile numbers rather than read.
 *
 * A target that is absent, zero, negative or not a number yields NO budget, not
 * an unlimited one. `Number(null)` is 0 and `Number(undefined)` is NaN, and
 * both mean "nobody said", which is the one input where guessing large is
 * unrecoverable: the tasks are queued before anybody sees the number.
 */
export function researchBudget({ targetCount, spent = 0 } = {}) {
  const target = researchTarget(targetCount);
  const used = Number.isFinite(Number(spent)) ? Math.max(0, Math.floor(Number(spent))) : 0;
  return Math.max(0, target - used);
}

/** The target as a whole number, or 0 for anything that is not a positive one. */
function researchTarget(targetCount) {
  const target = Number(targetCount);
  return Number.isFinite(target) && target > 0 ? Math.floor(target) : 0;
}

/**
 * A source shut off for this campaign, with the sentence saying why.
 *
 * `blocked` rather than deleting the source from the campaign: the campaign
 * still NAMED it, and a screen that shows two sources where a superadmin
 * ticked three has quietly rewritten what they asked for.
 */
function block(state, reason, now, failures = state.failures) {
  return {
    cursor: state.cursor,
    ended: state.ended,
    blocked: String(reason || "stopped for a reason nobody recorded").slice(0, 1000),
    failures,
    lastError: String(reason || "").slice(0, 1000) || null,
    lastErrorAt: now.toISOString(),
  };
}

/** Write the source states without touching anything else on the campaign. */
async function writeSourceState(prisma, campaign, patches) {
  if (!Object.keys(patches).length) return;
  await prisma.prospectCampaign.update({
    where: { id: campaign.id },
    data: { sourceState: mergeSourceState(campaign, patches) },
  });
}

/**
 * Queue research for prospects this campaign has discovered and not yet worked.
 *
 * ── Why a query rather than the ingest's own return value ─────────────────
 *
 * `ingestPage` reports counters, not ids, and reaching into it for the rows it
 * inserted would couple this handler to its internals. Asking the database
 * which prospects are still at `discovered` also picks up anything an earlier
 * page queued and a crash lost, which a list of just-inserted ids would not.
 *
 * ── Why the existing-task lookup is a fast path and not the guarantee ─────
 *
 * The unique index on `idempotencyKey` is the guarantee — enqueuePipelineTask's
 * header makes that argument. This one query saves a round trip per prospect on
 * the common case where a page is re-run and everything is already queued; two
 * concurrent runners that both miss it still produce one task each, and the
 * second gets the first's row back.
 *
 * The key is campaign-scoped rather than task-scoped, deliberately: a prospect
 * appears at `discovered` across several pages until its enrich task actually
 * runs, and a per-task key would queue it once per page.
 *
 * ── Why rows WITH a trade go first ────────────────────────────────────────
 *
 * `limit` is now a budget rather than a page size (see researchBudget), and a
 * budget spends in the order rows are handed to it. Oldest-first alone would
 * let a register import — where every row is trade-less by construction —
 * spend a painting campaign's entire research budget on businesses that are in
 * nobody's queue, while the painters it actually asked for sat at `discovered`
 * for ever. Trade-less rows are still promoted, because ANALYZE_CAPABILITIES
 * is what gives them a trade and dropping them would make the bank a dead end;
 * they are promoted second.
 */
export async function promoteToResearch({ prisma, campaignId, limit = PROMOTE_LIMIT }) {
  const room = Math.max(0, Math.floor(Number(limit) || 0));
  if (!room) return 0;

  const where = {
    campaignId,
    status: RESEARCHABLE_STATUS,
    // A business that asked not to be contacted is never promoted. The
    // enrich stage refuses it too — the same double gate the crawler and the
    // suppression list already keep — but there is no reason to spend a task
    // discovering that.
    doNotContactAt: null,
  };

  const withTrade = await prisma.prospect.findMany({
    where: { ...where, tradeKey: { not: null } },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: room,
  });
  const banked =
    withTrade.length >= room
      ? []
      : await prisma.prospect.findMany({
          where: { ...where, tradeKey: null },
          select: { id: true },
          orderBy: { createdAt: "asc" },
          take: room - withTrade.length,
        });
  const candidates = [...withTrade, ...banked];
  if (!candidates.length) return 0;

  const ids = candidates.map((p) => p.id);
  const queued = await prisma.salesPipelineTask.findMany({
    where: { kind: "ENRICH_BUSINESS", prospectId: { in: ids } },
    select: { prospectId: true },
  });
  const already = new Set(queued.map((t) => t.prospectId));

  let promoted = 0;
  for (const id of ids) {
    if (already.has(id)) continue;
    await enqueuePipelineTask(
      {
        kind: "ENRICH_BUSINESS",
        prospectId: id,
        campaignId,
        payload: { prospectId: id },
        idempotencyKey: `enrich:${campaignId || "none"}:${id}`,
      },
      { deps: { db: prisma } },
    );
    promoted++;
  }
  return promoted;
}

function statusFor(stopReason) {
  if (stopReason === "paused") return "paused";
  if (stopReason === "cancelled") return "cancelled";
  return "completed";
}

/**
 * Record that a campaign stopped.
 *
 * It no longer clears the cursor. It used to clear `discoveryCursor`, which
 * meant PAUSING a campaign threw away how far it had read and resuming
 * restarted it at row zero — re-downloading the snapshot and re-counting every
 * row it had already found. That was invisible while there was one cursor on
 * the row; with cursors held per source it would have had to clear a whole
 * map, which made the loss impossible not to notice. Positions are kept, and
 * `status` is what says whether the campaign is running.
 */
async function finish(prisma, campaign, stopReason, now) {
  if (campaign.status === statusFor(stopReason)) return;
  await prisma.prospectCampaign.update({
    where: { id: campaign.id },
    data: { status: statusFor(stopReason), completedAt: now },
  });
}

registerHandler("DISCOVER_BUSINESSES", async ({ task, payload, now, db: prisma }) =>
  runDiscoverBusinesses({ task, payload, now, db: prisma || db }),
);
