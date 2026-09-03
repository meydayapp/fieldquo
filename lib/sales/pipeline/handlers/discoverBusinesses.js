// lib/sales/pipeline/handlers/discoverBusinesses.js
//
// DISCOVER_BUSINESSES: one page of a campaign, ingested.
//
// ══ One page per task, and the next task enqueued at the end ═══════════════
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
// Bounded on purpose. One page's worth per task, so a campaign of a thousand
// promotes across its own pages rather than queueing a thousand tasks inside
// one invocation — the same "leftovers next tick" discipline the batch itself
// keeps. `needs_review` rows are NOT promoted: a human decides those first,
// and the review screen queues research when they accept one.
//
// ══ Retryable vs terminal ══════════════════════════════════════════════════
//
// A network problem reaching the snapshot is RETRYABLE — the runner's backoff
// exists for exactly that. A misconfigured campaign is TERMINAL: nothing about
// six hours from now makes an absent snapshot URL exist, and five attempts
// would only bury the real message under a retry ladder.
import { db } from "@/lib/db";
import { haversineKm } from "@/lib/booking/travel";
import { registerHandler } from "../registry";
import { enqueuePipelineTask } from "../tasks";
import { getDiscoveryProvider } from "@/lib/sales/discovery/providers";
import { ingestPage } from "@/lib/sales/discovery/ingest";
import { discoveryStopReason } from "@/lib/sales/discovery/funnel";
import { RESEARCHABLE_STATUS } from "./enrichBusiness";

/** How many businesses one task ingests, when the payload does not say. */
export const DEFAULT_PAGE_SIZE = 100;

/** How many prospects one task may promote into research. Sized to a page, so
 *  a campaign promotes at the rate it discovers rather than in one burst. */
export const PROMOTE_LIMIT = 100;

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

  const stopBefore = discoveryStopReason(campaign, { nextCursor: campaign.discoveryCursor || "more" });
  if (stopBefore) {
    await finish(prisma, campaign, stopBefore, now);
    return { done: true, note: `stopped: ${stopBefore}` };
  }

  const provider = getDiscoveryProvider(campaign.discoveryProvider);
  if (!provider) {
    return {
      done: false,
      retry: false,
      // Names the value, because "unknown provider" with no value in it sends
      // somebody to read code to find out what the campaign actually says.
      reason: campaign.discoveryProvider
        ? `no discovery provider named "${campaign.discoveryProvider}" is registered`
        : "this campaign names no discovery provider, and there is deliberately no default",
    };
  }

  const config = campaign.providerConfig || {};
  const described = provider.describeConfig(config);
  if (!described.ok) {
    return { done: false, retry: false, reason: described.problems.join(" ") };
  }

  const page = await provider.fetchPage({
    territory: campaign.territory || null,
    tradeKey: campaign.tradeKey || null,
    cursor: campaign.discoveryCursor || null,
    limit: Number(payload?.pageSize) || DEFAULT_PAGE_SIZE,
    config,
    // haversineKm is injected rather than imported by the provider, so a
    // provider that needs no geometry does not pull in booking code, and a
    // check can drive the radius filter with its own function.
    deps: { haversineKm },
  });

  if (page?.error) {
    // Retryable: the snapshot is a URL over a network, and a 502 next tick is
    // a 200 the tick after. A CONFIGURATION problem was already caught above,
    // so anything reaching here is a transport failure.
    return { done: false, retry: true, reason: page.error };
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

  // Re-read the counters the ingest just moved, so the stop decision is made
  // against what is actually stored rather than against the snapshot of the
  // campaign taken before the page ran.
  const after = await prisma.prospectCampaign.findUnique({
    where: { id: campaign.id },
    select: { id: true, status: true, targetCount: true, acceptedCount: true },
  });

  const stopAfter = discoveryStopReason(after || campaign, { nextCursor: page.nextCursor });

  await prisma.prospectCampaign.update({
    where: { id: campaign.id },
    data: {
      discoveryCursor: page.nextCursor || null,
      ...(stopAfter ? { status: statusFor(stopAfter), completedAt: now } : {}),
    },
  });

  if (!stopAfter) {
    // The next page. The idempotency key names the cursor, so two runs that
    // both finish the same page enqueue ONE next task rather than two — the
    // unique index on idempotencyKey is what makes that a guarantee and not a
    // hope (see lib/sales/pipeline/tasks.js).
    await enqueuePipelineTask(
      {
        kind: "DISCOVER_BUSINESSES",
        campaignId: campaign.id,
        payload: { provider: provider.key },
        idempotencyKey: `discover:${campaign.id}:${page.nextCursor}`,
      },
      { deps: { db: prisma } },
    );
  }

  const promoted = await promoteToResearch({ prisma, campaignId: campaign.id });

  return {
    done: true,
    note:
      `found ${result.counters.foundCount}, accepted ${result.counters.acceptedCount}, ` +
      `review ${result.counters.needsReviewCount}, rejected ${result.counters.rejectedCount}, ` +
      `queued ${promoted} for research` +
      (stopAfter ? ` — ${stopAfter}` : ""),
  };
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
 */
export async function promoteToResearch({ prisma, campaignId, limit = PROMOTE_LIMIT }) {
  const candidates = await prisma.prospect.findMany({
    where: {
      campaignId,
      status: RESEARCHABLE_STATUS,
      // A business that asked not to be contacted is never promoted. The
      // enrich stage refuses it too — the same double gate the crawler and the
      // suppression list already keep — but there is no reason to spend a task
      // discovering that.
      doNotContactAt: null,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
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

async function finish(prisma, campaign, stopReason, now) {
  if (campaign.status === statusFor(stopReason)) return;
  await prisma.prospectCampaign.update({
    where: { id: campaign.id },
    data: { status: statusFor(stopReason), completedAt: now, discoveryCursor: null },
  });
}

registerHandler("DISCOVER_BUSINESSES", async ({ task, payload, now, db: prisma }) =>
  runDiscoverBusinesses({ task, payload, now, db: prisma || db }),
);
