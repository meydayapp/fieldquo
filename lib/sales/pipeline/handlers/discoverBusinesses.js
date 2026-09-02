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

/** How many businesses one task ingests, when the payload does not say. */
export const DEFAULT_PAGE_SIZE = 100;

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

  return {
    done: true,
    note:
      `found ${result.counters.foundCount}, accepted ${result.counters.acceptedCount}, ` +
      `review ${result.counters.needsReviewCount}, rejected ${result.counters.rejectedCount}` +
      (stopAfter ? ` — ${stopAfter}` : ""),
  };
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
