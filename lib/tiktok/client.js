// lib/tiktok/client.js
//
// The ONLY file that calls TikTok. Every route and every other lib/tiktok file
// goes through these functions — the same one-door rule
// lib/social/metaGraphClient.js keeps for graph.facebook.com, for the same
// reason: when TikTok changes an endpoint, the fix is here and nowhere else.
//
// Every function answers `{ ok: true, data }` or
// `{ ok: false, status, code, message, logId }` and never throws for a TikTok
// refusal. `code` is TikTok's own error code (or "network" when TikTok could
// not be reached), which lib/tiktok/specs.js's classifyTikTokError() turns into
// what the contractor is told. `message` is TikTok's developer-facing English,
// kept for the stored row and support — never shown as the explanation.
//
// No token is ever put in a URL or a log line: the OAuth calls send it in a
// form body, the Content Posting calls in the Authorization header.
//
// References (read 2026-09-29):
//   token / refresh / revoke  developers.tiktok.com/doc/oauth-user-access-token-management
//   user info                 developers.tiktok.com/doc/tiktok-api-v2-get-user-info
//   creator_info              developers.tiktok.com/doc/content-posting-api-reference-query-creator-info
//   photo post init           developers.tiktok.com/doc/content-posting-api-reference-photo-post
//   video post init           developers.tiktok.com/doc/content-posting-api-reference-direct-post
//   video inbox draft         developers.tiktok.com/doc/content-posting-api-reference-upload-video
//   status fetch              developers.tiktok.com/doc/content-posting-api-reference-get-video-status
import { TIKTOK_API_BASE, tiktokClientKey, tiktokClientSecret } from "./config";

const TIMEOUT_MS = 15_000;

function failure({ status = 0, code = "network", message = "", logId = null } = {}) {
  return { ok: false, status, code: String(code || "network"), message: String(message || "").slice(0, 500), logId };
}

async function send(path, { method = "POST", headers = {}, body } = {}) {
  let res;
  try {
    res = await fetch(`${TIKTOK_API_BASE}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    return { res: null, json: null, error: failure({ code: "network", message: err?.name || "fetch failed" }) };
  }
  let json = null;
  try {
    const text = await res.text();
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { res, json, error: null };
}

/** The OAuth endpoints answer errors at the TOP level: { error, error_description, log_id }. */
async function oauthCall(path, params) {
  const { res, json, error } = await send(path, {
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams(params).toString(),
  });
  if (error) return error;
  if (!res.ok || (json && typeof json.error === "string" && json.error)) {
    return failure({
      status: res.status,
      code: (json && typeof json.error === "string" && json.error) || `http_${res.status}`,
      message: json?.error_description,
      logId: json?.log_id || null,
    });
  }
  return { ok: true, data: json || {} };
}

/** The Content Posting / user-info endpoints: { data, error: { code, message, log_id } }. */
async function apiCall(path, { accessToken, method = "POST", body } = {}) {
  const { res, json, error } = await send(path, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body !== undefined ? { "Content-Type": "application/json; charset=UTF-8" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (error) return error;
  const err = json?.error;
  // creator_info answers HTTP 200 with a non-"ok" code when the creator cannot
  // post right now — that is a refusal, not a success with odd data.
  if (!res.ok || (err && err.code && err.code !== "ok")) {
    return failure({
      status: res.status,
      code: err?.code || `http_${res.status}`,
      message: err?.message,
      logId: err?.log_id || null,
    });
  }
  return { ok: true, data: json?.data || {}, logId: err?.log_id || null };
}

export async function exchangeCode({ code, redirectUri }) {
  return oauthCall("/v2/oauth/token/", {
    client_key: tiktokClientKey() || "",
    client_secret: tiktokClientSecret() || "",
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
}

/** "The returned refresh_token may be different than the one passed in" — callers store both. */
export async function refreshAccessToken({ refreshToken }) {
  return oauthCall("/v2/oauth/token/", {
    client_key: tiktokClientKey() || "",
    client_secret: tiktokClientSecret() || "",
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

/** Empty body on success. */
export async function revokeToken({ accessToken }) {
  return oauthCall("/v2/oauth/revoke/", {
    client_key: tiktokClientKey() || "",
    client_secret: tiktokClientSecret() || "",
    token: accessToken,
  });
}

/** display_name + avatar_url for the settings card (scope user.info.basic). */
export async function getUserInfo({ accessToken }) {
  return apiCall("/v2/user/info/?fields=open_id,display_name,avatar_url", { accessToken, method: "GET" });
}

/**
 * The creator the composer is about to post as — nickname, avatar, the
 * privacy levels THEY can use, and whether comments are off in their app.
 * Returned in our own camelCase shape so nothing past this file has to know
 * TikTok's field names.
 */
export async function queryCreatorInfo({ accessToken }) {
  const r = await apiCall("/v2/post/publish/creator_info/query/", { accessToken, body: {} });
  if (!r.ok) return r;
  const d = r.data || {};
  return {
    ok: true,
    data: {
      nickname: typeof d.creator_nickname === "string" ? d.creator_nickname : null,
      username: typeof d.creator_username === "string" ? d.creator_username : null,
      avatarUrl: typeof d.creator_avatar_url === "string" ? d.creator_avatar_url : null,
      privacyLevelOptions: Array.isArray(d.privacy_level_options) ? d.privacy_level_options : [],
      commentDisabled: d.comment_disabled === true,
      duetDisabled: d.duet_disabled === true,
      stitchDisabled: d.stitch_disabled === true,
      maxVideoPostDurationSec: Number.isFinite(d.max_video_post_duration_sec) ? d.max_video_post_duration_sec : null,
    },
  };
}

/** Direct Post of a photo — body from lib/tiktok/specs.js buildPhotoPostBody(). */
export async function initPhotoPost({ accessToken, body }) {
  return apiCall("/v2/post/publish/content/init/", { accessToken, body });
}

/**
 * Direct Post of a VIDEO — body from lib/marketing/videoPost.js
 * buildTikTokVideoPostBody() (developers.tiktok.com/doc/
 * content-posting-api-reference-direct-post).
 */
export async function initVideoPost({ accessToken, body }) {
  return apiCall("/v2/post/publish/video/init/", { accessToken, body });
}

/**
 * A video sent to the creator's TikTok inbox as a draft (scope video.upload) —
 * body from buildTikTokVideoDraftBody() (developers.tiktok.com/doc/
 * content-posting-api-reference-upload-video). A different endpoint from the
 * photo draft, which rides /content/init/ with post_mode MEDIA_UPLOAD.
 */
export async function initVideoDraft({ accessToken, body }) {
  return apiCall("/v2/post/publish/inbox/video/init/", { accessToken, body });
}

export async function fetchPublishStatus({ accessToken, publishId }) {
  const r = await apiCall("/v2/post/publish/status/fetch/", { accessToken, body: { publish_id: publishId } });
  if (!r.ok) return r;
  const d = r.data || {};
  const ids = Array.isArray(d.publicaly_available_post_id) ? d.publicaly_available_post_id : [];
  return {
    ok: true,
    data: {
      status: typeof d.status === "string" ? d.status : null,
      failReason: typeof d.fail_reason === "string" && d.fail_reason ? d.fail_reason : null,
      publicPostId: ids.length ? String(ids[0]) : null,
    },
  };
}
