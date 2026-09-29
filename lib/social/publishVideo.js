// lib/social/publishVideo.js
//
// The glue between a video post and Meta — Instagram Reels and Facebook Page
// Reels — with the Graph client injected (lib/social/metaGraphClient.js, the
// demo's lib/social/mockMetaGraphClient.js, or a fake in
// scripts/check-video-posts.mjs). Same split as lib/social/publishDesign.js:
// the rules are in lib/marketing/videoPost.js, the Meta error classification
// in lib/social/metaSpecs.js, and this file only walks the calls.
//
// ══ Two halves, because a video takes minutes ══════════════════════════════
//
// An image container is ready in seconds, so publishToInstagram() polls
// inside the request. A Reel is not — Meta transcodes it — so each platform
// here has a START (called by the Post press) and an ADVANCE (called by the
// status poll, one Meta read per call). The poll is what finally calls
// media_publish for Instagram, which is why the route claims the row before
// calling advance's publish step: two polls racing must never publish twice.
//
// A failed status READ is "unreadable", never "failed": Meta may well have
// published the Reel while we could not ask, and recording a post that went
// out as a failure invites a second, duplicate post.

import { interpretRateLimit, classifyMetaPublishError, describeMetaError, isMetaGraphError, metaErrorFields } from "./metaSpecs";
import { PublishRefusal, refusalFromMeta } from "./publishDesign";
import {
  buildFacebookReelFinishParams,
  buildFacebookReelStartParams,
  buildInstagramReelParams,
  checkForPlatform,
  classifyInstagramContainerError,
  facebookReelStep,
  instagramReelStep,
} from "@/lib/marketing/videoPost";

function refuseChecks(platform, post) {
  const check = checkForPlatform(platform, post);
  if (!check.ok) {
    throw new PublishRefusal(check.errors[0], `This video can't be posted to ${platform}: ${check.errors.join(", ")}`, {
      errors: check.errors,
      retryable: false,
    });
  }
}

/**
 * Create the Reel container. Returns { containerId }.
 * @param {{connection, post, videoUrl, client}} args — `post` is the
 *   VideoPost row (fit, size, duration, caption, cover), `videoUrl` its ready
 *   rendition.
 */
export async function startInstagramReel({ connection, post, videoUrl, client }) {
  if (!connection?.connected) throw new PublishRefusal("not_connected", "Instagram isn't connected yet.");
  if (!connection.instagramUserId) {
    throw new PublishRefusal("no_instagram_account", "This Facebook Page has no linked Instagram professional account.");
  }
  refuseChecks("instagram", post);

  // Live quota, the same pre-check an image post makes: a Reel counts
  // against the same content_publishing_limit.
  const quota = await client
    .getInstagramPublishingLimit({ igUserId: connection.instagramUserId, accessToken: connection.pageAccessToken })
    .catch(() => null);
  const rate = interpretRateLimit(quota);
  if (!rate.ok) {
    throw new PublishRefusal("rate_limited", "This Instagram account has reached Meta's limit on posts published in a 24-hour period.", { rate });
  }

  let containerId;
  try {
    containerId = await client.createInstagramReelContainer({
      igUserId: connection.instagramUserId,
      accessToken: connection.pageAccessToken,
      params: buildInstagramReelParams({
        videoUrl,
        caption: post.caption || "",
        coverMode: post.coverMode,
        coverOffsetMs: post.coverOffsetMs,
        coverImageUrl: post.coverImageUrl,
      }),
    });
  } catch (err) {
    throw refusalFromMeta(err, "reel_container");
  }
  if (!containerId) throw new PublishRefusal("container_failed", "Meta did not return a container id.", { retryable: true });
  return { containerId: String(containerId) };
}

/**
 * One look at a Reel container. `claim` is called (and awaited) before
 * media_publish — the route passes an atomic row update, and only a `true`
 * lets the publish happen.
 *
 * @returns {Promise<{state: "processing"} | {state: "published", postId: string|null}
 *   | {state: "failed", code: string, detail: string|null} | {state: "claimed_elsewhere"} | {state: "unknown"}>}
 */
export async function advanceInstagramReel({ connection, containerId, client, claim }) {
  let detail;
  try {
    detail = await client.getInstagramContainerDetail({ containerId, accessToken: connection.pageAccessToken });
  } catch (err) {
    const r = refusalFromMeta(err, "reel_status");
    if (r instanceof PublishRefusal) return { state: "unreadable", code: r.code, detail: r.metaDetail || r.message };
    throw err;
  }
  const step = instagramReelStep(detail?.statusCode);
  if (step.state === "processing" || step.state === "unknown") return { state: step.state };
  if (step.state === "published") return { state: "published", postId: null };
  if (step.state === "failed") {
    const code = step.code === "container_error" ? classifyInstagramContainerError(detail?.status) : step.code;
    return { state: "failed", code, detail: detail?.status ? `Instagram container ${detail.statusCode}: ${String(detail.status).slice(0, 500)}` : null };
  }
  // FINISHED — publish exactly once.
  if (!(await claim())) return { state: "claimed_elsewhere" };
  try {
    const postId = await client.publishInstagramContainer({
      igUserId: connection.instagramUserId,
      accessToken: connection.pageAccessToken,
      containerId,
    });
    if (!postId) return { state: "failed", code: "publish_failed", detail: "Meta did not return a post id." };
    return { state: "published", postId: String(postId) };
  } catch (err) {
    if (!isMetaGraphError(err)) throw err;
    const { code } = classifyMetaPublishError(err);
    // 9007 / 2207027 "not ready" after FINISHED: give the row back to the poll.
    if (metaErrorFields(err)?.subcode === 2207027) return { state: "not_ready" };
    return { state: "failed", code, detail: describeMetaError(err, "reel_publish") };
  }
}

/**
 * Start → hosted upload → finish (video_state PUBLISHED). Returns { videoId }.
 * Meta then processes and publishes by itself; advanceFacebookReel() watches.
 */
export async function startFacebookReel({ connection, post, videoUrl, client }) {
  if (!connection?.connected) throw new PublishRefusal("not_connected", "Facebook isn't connected yet.");
  if (!connection.pageId) throw new PublishRefusal("no_page", "No Facebook Page is connected.");
  refuseChecks("facebook", post);

  let videoId;
  try {
    ({ videoId } = await client.startFacebookReel({
      pageId: connection.pageId,
      pageAccessToken: connection.pageAccessToken,
      params: buildFacebookReelStartParams(),
    }));
  } catch (err) {
    throw refusalFromMeta(err, "reel_start");
  }
  if (!videoId) throw new PublishRefusal("container_failed", "Meta did not return a video id.", { retryable: true });

  try {
    await client.uploadFacebookReelFromUrl({ videoId, pageAccessToken: connection.pageAccessToken, fileUrl: videoUrl });
  } catch (err) {
    throw refusalFromMeta(err, "reel_upload", { containerId: videoId });
  }
  try {
    const ok = await client.finishFacebookReel({
      pageId: connection.pageId,
      pageAccessToken: connection.pageAccessToken,
      params: buildFacebookReelFinishParams({ videoId, caption: post.caption || "" }),
    });
    if (!ok) throw new PublishRefusal("publish_failed", "Meta did not confirm the Reel.", { containerId: videoId, retryable: true });
  } catch (err) {
    if (err instanceof PublishRefusal) throw err;
    throw refusalFromMeta(err, "reel_finish", { containerId: videoId });
  }
  return { videoId };
}

/** One look at a Facebook Reel's processing. */
export async function advanceFacebookReel({ connection, videoId, client }) {
  let read;
  try {
    read = await client.getFacebookVideoStatus({ videoId, accessToken: connection.pageAccessToken });
  } catch (err) {
    const r = refusalFromMeta(err, "reel_status");
    if (r instanceof PublishRefusal) return { state: "unreadable", code: r.code, detail: r.metaDetail || r.message };
    throw err;
  }
  const step = facebookReelStep(read?.status);
  if (step.state === "published") return { state: "published", postId: read?.postId || null };
  if (step.state === "failed") {
    return { state: "failed", code: step.code, detail: `Facebook ${step.phase}: ${step.message || "error"}` };
  }
  return { state: step.state, stage: step.stage || null };
}
