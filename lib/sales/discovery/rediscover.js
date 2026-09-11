// lib/sales/discovery/rediscover.js
//
// Bringing a running campaign's discovery back to life when its task died.
//
// ══ What happened, on the night of 2026-09-11 ═════════════════════════════
//
// Both California Overture campaigns read "running" and sat at zero for
// hours after their source was unblocked. The chain of DISCOVER_BUSINESSES
// tasks is self-queuing — each page enqueues the next — so the chain has
// exactly one thread, and when a page fails five times the runner abandons
// the task and the thread ends. The source was blocked on the fifth failure
// (discoverBusinesses.js MAX_SOURCE_FAILURES), which is right; a superadmin
// fixed the settings, which cleared the block, which is also right; and then
// nothing at all queued a new page, because the only two things that ever
// enqueue discovery are the Start button and the previous page. The
// campaign had to be requeued by hand with a made-up idempotency key.
//
// ══ The rule ══════════════════════════════════════════════════════════════
//
// A source unblocked on a RUNNING campaign whose latest discovery task is
// not live — abandoned, failed, done, or there is none — gets a fresh
// discovery task in the same transaction as the unblock. Live means queued
// or claimed: a task that is about to run will page the unblocked source
// itself, and a second task beside it would read the same page twice.
//
// The key is `discover:<campaign>:<fingerprint>:unblock-<n>`, where n is how
// many times THIS source has been unblocked (sourceState[key].unblocks,
// incremented by the unblock itself). Two presses of the same unblock
// compute the same n and collide on the unique key — one task. A later
// unblock, after the requeued task has also died, computes n+1 — a new
// task. The fingerprint carries n too (sources.js cursorFingerprint), so
// the page the requeued task enqueues after it cannot collide with the
// page that was abandoned before the block either.
//
// "Retry discovery" is the same enqueue without an unblock: a running
// campaign with no live task and nothing blocked — a task abandoned for a
// reason the source state never recorded — gets one, keyed on how many
// discovery tasks the campaign already has, the way research.js keys a
// re-queue: two clicks at once collide, a click after that task settles
// computes the next number.
//
// ══ Pure ═════════════════════════════════════════════════════════════════
//
// Plans in, specs out. The route applies them; the check drives them with
// rows. Nothing here imports the database.
import { campaignSourceKeys, cursorFingerprint, mergeSourceState, sourceIsOpen, sourceStateFor } from "./sources";

/** A discovery task in one of these states will page the campaign itself. */
export const LIVE_TASK_STATUSES = Object.freeze(["queued", "claimed"]);

export function discoveryTaskLive(task) {
  return Boolean(task) && LIVE_TASK_STATUSES.includes(task.status);
}

/** The next discovery task for this campaign as it is NOW — the open sources
 *  and the fingerprint of where they are. `suffix` makes the key new. */
export function discoverySpec(campaign, { suffix = "" } = {}) {
  const open = campaignSourceKeys(campaign).filter((key) => sourceIsOpen(sourceStateFor(campaign, key)));
  return {
    kind: "DISCOVER_BUSINESSES",
    campaignId: campaign.id,
    payload: { sources: open },
    idempotencyKey: `discover:${campaign.id}:${cursorFingerprint(campaign)}${suffix ? `:${suffix}` : ""}`,
  };
}

/**
 * Clear a source's block, and decide whether discovery needs queueing.
 *
 * @param campaign    the row as it is now
 * @param sourceKey   the source the configure action fixed
 * @param latestTask  the campaign's newest DISCOVER_BUSINESSES task, or null
 * @returns { sourceState, unblocked, enqueue: spec|null, reason }
 *
 * `sourceState` is the whole column to write (mergeSourceState), with the
 * block cleared and the counter moved. `enqueue` is null with a `reason`
 * whenever nothing should be queued: the source was not blocked (a settings
 * save on a healthy source is not a restart), the campaign is not running (a
 * paused campaign's Resume button queues its own), or a task is live.
 */
export function unblockSourcePlan({ campaign, sourceKey, latestTask = null } = {}) {
  const state = sourceStateFor(campaign, sourceKey);
  const unblocked = Boolean(state.blocked);
  const next = {
    ...state,
    blocked: null,
    failures: 0,
    lastError: null,
    lastErrorAt: null,
    unblocks: state.unblocks + (unblocked ? 1 : 0),
  };
  const sourceState = mergeSourceState(campaign, { [sourceKey]: next });
  const after = { ...campaign, sourceState };

  if (!unblocked) return { sourceState, unblocked, enqueue: null, reason: "not_blocked" };
  if (campaign?.status !== "running") return { sourceState, unblocked, enqueue: null, reason: "not_running" };
  if (discoveryTaskLive(latestTask)) return { sourceState, unblocked, enqueue: null, reason: "task_live" };

  return {
    sourceState,
    unblocked,
    enqueue: discoverySpec(after, { suffix: `unblock-${next.unblocks}` }),
    reason: null,
  };
}

/**
 * Queue discovery again by hand, for a running campaign whose thread died.
 *
 * @param campaign    the row as it is now
 * @param latestTask  the newest DISCOVER_BUSINESSES task, or null
 * @param taskCount   how many DISCOVER_BUSINESSES tasks the campaign has, any
 *                    status — the retry's sequence number
 * @returns { enqueue: spec|null, reason }
 */
export function retryDiscoveryPlan({ campaign, latestTask = null, taskCount = 0 } = {}) {
  if (campaign?.status !== "running") return { enqueue: null, reason: "not_running" };
  if (discoveryTaskLive(latestTask)) return { enqueue: null, reason: "task_live" };
  const open = campaignSourceKeys(campaign).filter((key) => sourceIsOpen(sourceStateFor(campaign, key)));
  if (!open.length) return { enqueue: null, reason: "no_open_source" };
  const n = Math.max(0, Math.floor(Number(taskCount) || 0));
  return { enqueue: discoverySpec(campaign, { suffix: `retry-${n}` }), reason: null };
}

/** Why a plan queued nothing, in a sentence for the screen. */
export const REDISCOVER_REASONS = Object.freeze({
  not_blocked: "That source was not blocked, so its settings were saved and nothing was restarted.",
  not_running: "This campaign is not running. Resume it and it queues its own discovery.",
  task_live: "A discovery task is already queued or running for this campaign; it will page the source itself.",
  no_open_source: "Every source on this campaign has ended or is blocked, so there is nothing to page.",
});
