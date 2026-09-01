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
// live in lib/social/metaSpecs.js and are pure/executed there. This file has
// never made a real call: there is no Meta app, no App Review, no
// credentials in this environment. See docs/SOCIAL-PUBLISHING.md for what
// that means for shipping this feature.
export const runtime = "nodejs";

const GRAPH_API_VERSION = "v26.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

class MetaGraphError extends Error {
  constructor(message, { status, code, subcode, fbtraceId } = {}) {
    super(message);
    this.name = "MetaGraphError";
    this.status = status;
    this.code = code;
    this.subcode = subcode;
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

/** GET /{ig-user-id}/content_publishing_limit — see metaSpecs.interpretRateLimit(). */
export async function getInstagramPublishingLimit({ igUserId, accessToken }) {
  return graphFetch(`/${igUserId}/content_publishing_limit`, {
    params: { access_token: accessToken },
  });
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

export { MetaGraphError, GRAPH_API_VERSION };
