// lib/social/mockMetaGraphClient.js
//
// A stand-in for lib/social/metaGraphClient.js that never calls
// graph.facebook.com — the ONLY thing a demo company's publish attempt is
// allowed to reach. See lib/social/metaConnection.js: getMetaConnection()
// returns `mock: true` for a company with Company.isDemo, and that single
// boolean — read server-side from the database, never trusted from a
// request — is what the publish route and the scheduling cron use to pick
// this module instead of the real one. Neither ever asks the browser which
// client to use.
//
// ══ Why this file exists at all, given metaConnection.js already refuses
//    with `connected: false` for every company today ══════════════════════
//
// A demo has to be walkable end to end with no Meta app anywhere in this
// environment — that's the owner's ask, verbatim: "demo and hype and
// testing." Returning `connected: false` for a demo company would show the
// exact same "not connected yet" dead end a real prospect sees, which proves
// nothing and demos nothing. So a demo company gets `connected: true` from a
// FAKE connection (see metaConnection.js), and every Graph call that
// connection would normally drive is answered by this file instead —
// exercising the REAL orchestration in lib/social/publishDesign.js (the
// container state machine, the poll loop, the rate-limit check, the
// caption/image validation) against data that looks like Meta's, never
// against Meta.
//
// ══ Same export shape as metaGraphClient.js, on purpose ════════════════════
//
// publishDesign.js takes its Meta client as an injected parameter and calls
// it by these five names — that is what makes this file a drop-in substitute
// rather than a second, parallel implementation of the publish flow. If this
// file's shape drifts from metaGraphClient.js's, scripts/check-designer-
// reach.mjs's mock-client section catches it by calling both through the
// same orchestration functions and asserting they behave alike.
//
// ══ "Convincing in shape," per the brief ════════════════════════════════════
//
//   - Container creation and status checks take real wall-clock time (a few
//     hundred milliseconds to ~2.5s across the poll loop) rather than
//     resolving instantly — a demo where "processing" is imperceptible
//     doesn't show what the real flow looks like.
//   - Ids look like Meta's (long, opaque, prefixed) rather than "1", "2",
//     "3" — a demo salesperson reading one off screen shouldn't be able to
//     tell at a glance it's fake without the badge PublishModal.js renders.
//   - `simulateFailure` (threaded through by publishDesign.js from
//     connection.demoSimulateFailure — see that file) lets a demo operator
//     deliberately show the two failure states a real account can hit:
//     Meta's rolling rate limit, and a container Meta itself rejects after
//     accepting the create call. Both routes are the REAL refusal paths in
//     lib/social/metaSpecs.js (interpretRateLimit, nextContainerAction) —
//     this file only crafts the Meta-shaped response that drives them there,
//     it does not special-case the failure itself.
export const runtime = "nodejs";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// How long a mock container stays IN_PROGRESS before the status check starts
// answering FINISHED — long enough that the real poll loop (POLL_BACKOFF_MS
// in metaSpecs.js) genuinely polls more than once, short enough that a demo
// isn't left waiting. containerId carries its own creation timestamp (base36
// milliseconds) so status checks are stateless — no in-memory map that a
// second serverless invocation wouldn't share, no database table for
// something that must never be mistaken for real data.
const MOCK_PROCESSING_MS = 1800;
// How long the container-error simulation waits before failing — long
// enough to show one real IN_PROGRESS poll first, so "Meta rejected this"
// reads as a real attempt that failed, not an instant refusal.
const MOCK_ERROR_MS = 700;

function randomId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function containerCreatedAtMs(containerId) {
  // mock_ig_<base36 ms>_<rand> — see createInstagramContainer(). Anything
  // that doesn't parse (a hand-typed id, a real Meta id somehow reaching
  // this file) is treated as already-elapsed rather than thrown on, so a
  // status check never crashes the poll loop over a malformed id — it just
  // resolves immediately, which is the safest failure direction for a mock.
  const part = String(containerId || "").split("_")[2];
  const ms = parseInt(part, 36);
  return Number.isFinite(ms) ? ms : 0;
}

/** Mirrors metaGraphClient.js's createInstagramContainer(). */
export async function createInstagramContainer({ imageUrl, caption } = {}) {
  await sleep(350 + Math.random() * 250); // a real POST has real latency
  if (!imageUrl) return null; // same "Meta didn't return an id" shape the real client hits on a bad request
  void caption;
  return `mock_ig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Mirrors metaGraphClient.js's getInstagramContainerStatus(). `simulateFailure`
 * is not a real Graph API parameter — metaGraphClient.js's real functions
 * ignore it (they destructure only the fields Meta's own endpoints take) —
 * it exists ONLY on this file, threaded in by publishDesign.js from
 * connection.demoSimulateFailure, which the publish route only ever sets
 * when connection.mock is true. See this file's header.
 */
export async function getInstagramContainerStatus({ containerId, simulateFailure } = {}) {
  await sleep(200 + Math.random() * 150);
  const elapsed = Date.now() - containerCreatedAtMs(containerId);

  if (simulateFailure === "container_error") {
    return elapsed < MOCK_ERROR_MS ? "IN_PROGRESS" : "ERROR";
  }
  return elapsed < MOCK_PROCESSING_MS ? "IN_PROGRESS" : "FINISHED";
}

/** Mirrors metaGraphClient.js's publishInstagramContainer(). */
export async function publishInstagramContainer({ containerId } = {}) {
  await sleep(300 + Math.random() * 200);
  return `mock_post_${randomId("ig")}`;
}

/**
 * Mirrors metaGraphClient.js's getInstagramPublishingLimit(). Real shape —
 * quota_usage / config.quota_total / config.quota_duration — so
 * interpretRateLimit() (lib/social/metaSpecs.js) runs unmodified against it.
 * `simulateFailure === "rate_limited"` reports the account already at
 * Meta's own documented default cap (50 / 24h); anything else reports a
 * healthy account with room to post.
 */
export async function getInstagramPublishingLimit({ simulateFailure } = {}) {
  await sleep(150 + Math.random() * 150);
  const atCap = simulateFailure === "rate_limited";
  return {
    quota_usage: atCap ? 50 : 3,
    config: { quota_total: 50, quota_duration: 86400 },
  };
}

/**
 * Mirrors metaGraphClient.js's publishFacebookPhoto(). Facebook has no
 * container/poll step to fail partway through, so `simulateFailure` (any
 * non-empty value) simply reports the same "Meta didn't return an id" shape
 * publishToFacebook() already turns into a named PublishRefusal — there is
 * only one Facebook failure shape to demonstrate, not several.
 */
export async function publishFacebookPhoto({ simulateFailure } = {}) {
  await sleep(300 + Math.random() * 250);
  if (simulateFailure) return null;
  return `mock_fb_${randomId("post")}`;
}
