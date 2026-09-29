// lib/marketing/videoUpload.js
//
// How a video post's clip gets INTO Cloudinary: signed by us, sent by the
// browser in chunks, converted on arrival, confirmed back to us. Pure except
// for node:crypto — scripts/check-video-posts.mjs runs every rule here.
//
// ══ Why this is not lib/media/directUpload.js's planUpload ═══════════════════
//
// Three things a video post needs that no other upload in the product does,
// and that would widen a boundary every photo, receipt and HR document goes
// through if they were added there:
//
//   1. A larger file. A 2:30 4K phone clip is 400 MB–1.1 GB; every other video
//      upload stays at classifyMedia's 100 MB. VIDEO_UPLOAD_MAX_BYTES (2 GB),
//      bounded by the Cloudinary plan's own ceiling.
//   2. An incoming transformation, SIGNED — so what Cloudinary stores is the
//      1080p (and, when chosen, 9:16) clip, never the 4K original. The browser
//      cannot drop it to store a 4K file, nor swap it for another: it is in the
//      signature like the public_id.
//   3. `async`, because Cloudinary converts on upload synchronously only up to
//      its online-transformation limit (40 MB Free, 300 MB paid —
//      cloudinary.com/documentation/ts_troubleshooting_video_transformation_errors);
//      a larger clip must be converted in the background. So the upload
//      answers "pending", and the result arrives later — at `notification_url`
//      (verifyNotification), or when the video screen asks Cloudinary itself
//      (lib/marketing/videoPostServer.js checkArrival) if the notification
//      never reaches us.
//
// What it shares with directUpload.js, by import rather than copy: the
// signature algorithm, the public_id shape (isOwnPublicId), the accepted
// source formats, the company/purpose folder.

import { createHash } from "node:crypto";
import { cloudinarySignature, sameSignature, VIDEO_FORMATS } from "../media/directUpload.js";
import { VIDEO_TYPES, megabytes } from "../media/validate.js";
import {
  VIDEO_POST_LIMITS,
  VIDEO_UPLOAD_MAX_BYTES,
  incomingTransformation,
  isNineBySixteen,
  preparedAsFor,
  readVideoFacts,
} from "./videoPost.js";

/** Cloudinary's chunk size floor is 5 MB (all but the last chunk). 20 MB keeps
 *  a 1 GB clip at ~50 requests without any one of them long enough to die on
 *  a flaky phone connection. */
export const CHUNK_BYTES = 20 * 1024 * 1024;

/** An upload notification older than this is refused — a replayed request. */
export const NOTIFICATION_MAX_AGE_SECONDS = 2 * 60 * 60;

/**
 * The cap that binds: ours, or the Cloudinary plan's per-video ceiling if
 * lower. Same shape as directUpload.js's effectiveCap, for video posts only.
 */
export function videoUploadCap(planLimits = null) {
  const plan = Number(planLimits?.video_max_size_bytes);
  return Number.isFinite(plan) && plan > 0 ? Math.min(VIDEO_UPLOAD_MAX_BYTES, plan) : VIDEO_UPLOAD_MAX_BYTES;
}

/**
 * Plan one video-post upload from what the browser DECLARES about the file
 * (type, size, and — when it could read them — width, height, length).
 *
 * The declaration decides only what to refuse early and which incoming
 * transformation to sign. Nothing it says is stored as a fact: the clip's
 * real size, length and URL come from Cloudinary when it arrives.
 *
 * @returns {{ ok: true, publicId, preparedAs, params, maxBytes }
 *         | { ok: false, code, maxBytes? }}
 */
export function planVideoUpload(declared, scope, { fit = null, planLimits = null, now = Date.now(), randomId, notificationUrl = null } = {}) {
  if (!scope?.ok || typeof scope.folder !== "string") return { ok: false, code: "bad_scope" };
  const type = typeof declared?.type === "string" ? declared.type.toLowerCase().split(";")[0].trim() : "";
  if (!VIDEO_TYPES.has(type)) return { ok: false, code: "not_a_video" };

  const size = Number(declared?.size);
  if (!Number.isFinite(size) || size <= 0) return { ok: false, code: "not_a_video" };
  const maxBytes = videoUploadCap(planLimits);
  if (size > maxBytes) return { ok: false, code: "file_too_large", maxBytes, maxLabel: megabytes(maxBytes) };

  // A length the browser read is checked now, so a 5-minute clip is refused
  // before a gigabyte is sent. A length it could NOT read is not a pass: the
  // incoming transformation trims at 2:30 whatever arrives, and the screen
  // told the person so before they chose to upload.
  const seconds = Number(declared?.durationSec);
  if (Number.isFinite(seconds) && seconds > 0) {
    if (seconds > VIDEO_POST_LIMITS.maxSeconds + 0.5) return { ok: false, code: "too_long" };
    if (seconds < VIDEO_POST_LIMITS.minSeconds) return { ok: false, code: "too_short" };
  }

  const preparedAs = preparedAsFor({ width: declared?.width, height: declared?.height, fit });
  if (!preparedAs) return { ok: false, code: "choose_fit" };
  const transformation = incomingTransformation(preparedAs);
  if (!transformation) return { ok: false, code: "bad_fit" };

  const mint = randomId || (() => globalThis.crypto.randomUUID());
  const publicId = `${scope.folder}/${mint()}`;

  // Strings only — the browser posts them exactly, once per chunk, and the
  // signature is over their string form.
  const params = {
    public_id: publicId,
    timestamp: String(Math.floor(now / 1000)),
    overwrite: "false",
    allowed_formats: VIDEO_FORMATS.join(","),
    transformation,
    // Stored as MP4 — the container every platform takes — so the stored file
    // IS what is sent and no delivery-time conversion is ever billed.
    format: "mp4",
    async: "true",
    ...(typeof notificationUrl === "string" && /^https:\/\//.test(notificationUrl) ? { notification_url: notificationUrl } : {}),
  };
  return { ok: true, publicId, preparedAs, params, maxBytes };
}

/** The signed fields the browser sends with every chunk. */
export function signedUploadFields(params, { apiKey, secret }) {
  return { ...params, api_key: apiKey, signature: cloudinarySignature(params, secret) };
}

/**
 * Cloudinary's notification signature: SHA of (raw body + X-Cld-Timestamp +
 * API secret), hex, in X-Cld-Signature (cloudinary.com/documentation/
 * notifications, "Verifying notification signatures"). SHA-1 is the
 * account default; SHA-256 is accepted too, for an account switched to it.
 * A stale timestamp is refused — the request is a replay.
 */
export function verifyNotification({ body, timestamp, signature, secret, nowSeconds = Math.floor(Date.now() / 1000) }) {
  if (typeof body !== "string" || !secret || typeof signature !== "string") return false;
  const ts = Number(timestamp);
  if (!Number.isInteger(ts) || Math.abs(nowSeconds - ts) > NOTIFICATION_MAX_AGE_SECONDS) return false;
  const sig = signature.toLowerCase();
  for (const algorithm of ["sha1", "sha256"]) {
    const expected = createHash(algorithm).update(body + String(ts) + secret).digest("hex");
    if (sameSignature(expected, sig)) return true;
  }
  return false;
}

/**
 * Cloudinary's answer about an arrived clip → what the post stores, or why
 * it cannot be used. `asset` is either the upload notification or an Admin
 * API lookup — Cloudinary talking to us about our own cloud, never a browser.
 *
 * @returns {{ ok: true, facts, videoUrl } | { ok: false, code }}
 */
export function judgeArrival({ post, asset, cloudName }) {
  if (!post || !asset || typeof asset !== "object") return { ok: false, code: "unexpected" };
  if (asset.public_id !== post.videoPublicId) return { ok: false, code: "not_ours" };
  if (asset.resource_type && asset.resource_type !== "video") return { ok: false, code: "not_a_video" };
  const facts = readVideoFacts({ resource_type: "video", ...asset });
  const url = typeof asset.secure_url === "string" ? asset.secure_url : "";
  const ours = new RegExp(`^https://res\\.cloudinary\\.com/${String(cloudName).replace(/[^a-z0-9_-]/gi, "")}/video/upload/`, "i");
  if (!cloudName || !ours.test(url) || !url.includes(`/${post.videoPublicId}`)) return { ok: false, code: "not_ours" };
  if (!facts?.width || !facts?.height) return { ok: false, code: "no_dimensions" };
  if (!facts.durationSec) return { ok: false, code: "no_duration" };
  if (facts.durationSec < VIDEO_POST_LIMITS.minSeconds) return { ok: false, code: "too_short" };
  // eo_150 trims at 2:30; a hair over is rounding in the container.
  if (facts.durationSec > VIDEO_POST_LIMITS.maxSeconds + 1) return { ok: false, code: "too_long" };
  return { ok: true, facts, videoUrl: url };
}

/** An async-upload notification that reports a failure instead of an asset. */
export function notificationFailure(payload) {
  if (!payload || typeof payload !== "object") return null;
  const message = payload.error?.message || (payload.status === "failed" ? payload.message || "failed" : null);
  return message ? String(message).slice(0, 300) : null;
}

/** Is this stored clip already 9:16 — so it is sent as stored? */
export function arrivedVertical(facts) {
  return isNineBySixteen(facts?.width, facts?.height);
}
