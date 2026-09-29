// lib/social/metaGraphClient.js
//
// The ONLY file that calls graph.facebook.com. Every other file in
// lib/social/ and every API route talks to Meta through the functions
// exported here — never through a scattered fetch() of its own.
//
// Why that discipline matters more than usual: docs/META-ADS-INTEGRATION.md
// Part 5 (written for the sibling ads/insights import, but the fact is the
// same fact for this feature) — Meta ships a new Graph/Marketing API version
// roughly every 4–5 months and has, on release day, blocked whole endpoint
// families without waiting for the two-year deprecation floor to run out.
// One file owning the version string means a bump is a one-line change and
// a single re-test, not a hunt through every route that happens to publish
// something. Mirrors lib/ai/provider.js's role for OpenAI and
// lib/stripe.js's warning-comment boundary for the same reason.
//
// ══ Untested by design, and why that's stated rather than hidden ═══════
//
// Every function here is a thin fetch() wrapper with no branching logic
// worth a unit test — the actual decisions (what a container status means,
// whether a caption is too long, what a rate-limit response implies) all
// live in lib/social/metaSpecs.js and are pure/executed there. This header
// used to say the file had never made a real call; on 2026-09-28 it posted a
// real Facebook Page photo from production (SocialPublish
// cmulko6ep000705k1tlgubdg1) and got a real Instagram refusal back (9004 /
// 2207052 at container creation). See docs/SOCIAL-PUBLISHING.md for the
// App Review state.
export const runtime = "nodejs";

const GRAPH_API_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Carries EVERY field of Meta's error object, not just the message. The
// 2026-09-28 Instagram failure recorded as "Unexpected error" was, in Meta's
// own words, code 9004 / subcode 2207052 — and the subcode is the part that
// says what to do (Meta's IG error table keys its "solution" column on it).
// type / error_user_title / error_user_msg / is_transient are kept for the
// same reason: they are Meta's own classification and plain-language text,
// and lib/social/metaSpecs.js's classifyMetaPublishError() reads them.
// Nothing here ever holds the request URL, which is where the token lives.
class MetaGraphError extends Error {
  constructor(message, { status, code, subcode, type, userTitle, userMsg, isTransient, fbtraceId } = {}) {
    super(message);
    this.name = "MetaGraphError";
    this.status = status;
    this.code = code;
    this.subcode = subcode;
    this.type = type;
    this.userTitle = userTitle;
    this.userMsg = userMsg;
    this.isTransient = isTransient;
    this.fbtraceId = fbtraceId;
  }
}

async function graphFetch(path, { method = "GET", params } = {}) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), { method });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || body?.error) {
    const err = body?.error || {};
    throw new MetaGraphError(err.message || `Meta API error (${res.status})`, {
      status: res.status,
      code: err.code,
      subcode: err.error_subcode,
      type: err.type,
      userTitle: err.error_user_title,
      userMsg: err.error_user_msg,
      isTransient: err.is_transient,
      fbtraceId: err.fbtrace_id,
    });
  }

  return body;
}

/**
 * Step 1 of the container-then-publish flow — POST /{ig-user-id}/media.
 * `imageUrl` MUST be publicly fetchable: Meta cURLs it server-side rather
 * than accepting bytes directly (lib/social/metaSpecs.js's header names the
 * source for this). Returns the container id.
 */
export async function createInstagramContainer({ igUserId, accessToken, imageUrl, caption }) {
  const body = await graphFetch(`/${igUserId}/media`, {
    method: "POST",
    params: { image_url: imageUrl, caption, access_token: accessToken },
  });
  return body?.id;
}

/** Step 1.5 — poll until Meta finishes processing the container. */
export async function getInstagramContainerStatus({ containerId, accessToken }) {
  const body = await graphFetch(`/${containerId}`, {
    params: { fields: "status_code,status", access_token: accessToken },
  });
  return body?.status_code;
}

/** Step 2 — POST /{ig-user-id}/media_publish. Returns the published media id. */
export async function publishInstagramContainer({ igUserId, accessToken, containerId }) {
  const body = await graphFetch(`/${igUserId}/media_publish`, {
    method: "POST",
    params: { creation_id: containerId, access_token: accessToken },
  });
  return body?.id;
}

/**
 * GET /{ig-user-id}/content_publishing_limit — see metaSpecs.interpretRateLimit().
 *
 * Meta answers `{ data: [{ quota_usage, config }] }`, and returns `config`
 * only when it is asked for by name. This used to request no fields and hand
 * back the envelope, so interpretRateLimit() never found quota_usage at the
 * top level and every real reading came out "unverified" — the pre-check
 * could never refuse. Unwrapped here, where the response shape is known; the
 * `?? body` keeps an already-flat answer (the mock's) working unchanged.
 */
export async function getInstagramPublishingLimit({ igUserId, accessToken }) {
  const body = await graphFetch(`/${igUserId}/content_publishing_limit`, {
    params: { fields: "config,quota_usage", access_token: accessToken },
  });
  return Array.isArray(body?.data) ? body.data[0] ?? null : body;
}

/**
 * A Facebook Page photo post — a single call, no container step. Meta's
 * Page-photo endpoint publishes directly from `url` + `caption`.
 * `scheduledPublishTime` (a Date) switches this to Meta's own native
 * scheduling (`published: false` + `scheduled_publish_time`) — see
 * lib/social/metaSpecs.js isValidFacebookScheduleTime() for the window Meta
 * enforces before this is even called.
 */
export async function publishFacebookPhoto({
  pageId,
  pageAccessToken,
  imageUrl,
  caption,
  scheduledPublishTime,
}) {
  const params = {
    url: imageUrl,
    caption,
    access_token: pageAccessToken,
  };
  if (scheduledPublishTime) {
    params.published = "false";
    params.scheduled_publish_time = Math.floor(new Date(scheduledPublishTime).getTime() / 1000);
  }
  const body = await graphFetch(`/${pageId}/photos`, { method: "POST", params });
  return body?.post_id || body?.id;
}

// ── Video posts (lib/marketing/videoPost.js has the rules and the sources) ──

/**
 * An Instagram Reel container — POST /{ig-user-id}/media with
 * media_type=REELS. `params` comes from buildInstagramReelParams(); the video
 * URL must be public (Meta cURLs it). Returns the container id. Unlike an
 * image, a Reel is NOT polled inside this request: processing takes minutes,
 * so the video post status route polls and publishes (see
 * app/api/marketing/video-posts/publishes/[publishId]/route.js).
 */
export async function createInstagramReelContainer({ igUserId, accessToken, params }) {
  const body = await graphFetch(`/${igUserId}/media`, {
    method: "POST",
    params: { ...params, access_token: accessToken },
  });
  return body?.id;
}

/** A container's status_code AND its status text — the text carries the subcode on ERROR. */
export async function getInstagramContainerDetail({ containerId, accessToken }) {
  const body = await graphFetch(`/${containerId}`, {
    params: { fields: "status_code,status", access_token: accessToken },
  });
  return { statusCode: body?.status_code || null, status: typeof body?.status === "string" ? body.status : null };
}

/** Facebook Reel, phase 1 — POST /{page-id}/video_reels upload_phase=start. */
export async function startFacebookReel({ pageId, pageAccessToken, params }) {
  const body = await graphFetch(`/${pageId}/video_reels`, {
    method: "POST",
    params: { ...params, access_token: pageAccessToken },
  });
  return { videoId: body?.video_id ? String(body.video_id) : null };
}

/**
 * Facebook Reel, phase 2 — a HOSTED file: POST
 * https://rupload.facebook.com/video-upload/<version>/<video-id> with the
 * token in `Authorization: OAuth …` and the URL in a `file_url` header
 * (developers.facebook.com/docs/video-api/guides/reels-publishing). The token
 * travels in a header, never a URL.
 */
export async function uploadFacebookReelFromUrl({ videoId, pageAccessToken, fileUrl }) {
  const url = `https://rupload.facebook.com/video-upload/${GRAPH_API_VERSION}/${encodeURIComponent(videoId)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `OAuth ${pageAccessToken}`, file_url: fileUrl },
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok || body?.error || body?.success !== true) {
    const err = body?.error || body?.debug_info || {};
    throw new MetaGraphError(err.message || `Meta upload error (${res.status})`, {
      status: res.status,
      code: err.code,
      subcode: err.error_subcode,
      type: err.type,
      userTitle: err.error_user_title,
      userMsg: err.error_user_msg,
      isTransient: err.is_transient,
      fbtraceId: err.fbtrace_id,
    });
  }
  return true;
}

/** Facebook Reel, phase 3 — upload_phase=finish, video_state=PUBLISHED. */
export async function finishFacebookReel({ pageId, pageAccessToken, params }) {
  const body = await graphFetch(`/${pageId}/video_reels`, {
    method: "POST",
    params: { ...params, access_token: pageAccessToken },
  });
  return body?.success === true || Boolean(body?.post_id) || Boolean(body?.id);
}

/** GET /{video-id}?fields=status,post_id — read by facebookReelStep(). */
export async function getFacebookVideoStatus({ videoId, accessToken }) {
  const body = await graphFetch(`/${videoId}`, {
    params: { fields: "status,post_id", access_token: accessToken },
  });
  return { status: body?.status || null, postId: body?.post_id ? String(body.post_id) : null };
}

export { MetaGraphError, GRAPH_API_VERSION };
