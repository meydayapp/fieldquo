// lib/marketing/videoPost.js
//
// Every DECISION a video post makes, as pure functions: which platforms can
// take this clip and why not, what shape it has to become, the Cloudinary URL
// of that shape, the exact request each platform is sent, and what each
// platform's processing status means. No fetch, no Prisma, no SDK — client-safe
// (the video post screen imports it to explain a refusal before anyone
// presses Post) and executed against hostile input by
// scripts/check-video-posts.mjs. The same split lib/social/metaSpecs.js and
// lib/tiktok/specs.js keep: decisions here, glue in the routes.
//
// ══ The platforms' own numbers, and where they came from (read 2026-09-29) ══
//
// Instagram Reels — developers.facebook.com/docs/instagram-platform/
//   instagram-graph-api/reference/ig-user/media/ ("Reel specifications"):
//   MOV or MP4, moov atom at the front, no edit lists; HEVC or H264,
//   progressive, closed GOP, 4:2:0; AAC ≤48 kHz; 23–60 FPS; at most 1920
//   columns; aspect 0.01:1–10:1 "but we recommend 9:16"; VBR ≤25 Mbps;
//   3 s – 15 min; 300 MB. Container params media_type=REELS, video_url,
//   caption, cover_url, thumb_offset (milliseconds), share_to_feed.
//   Container status codes: developers.facebook.com/docs/instagram-platform/
//   instagram-graph-api/reference/ig-container. Video error subcodes
//   (2207026 format, 2207057 thumb offset, 2207053 upload error, 9007/2207027
//   not ready): developers.facebook.com/docs/instagram-platform/
//   instagram-graph-api/reference/error-codes.
//
// Facebook Page Reels — developers.facebook.com/docs/video-api/guides/
//   reels-publishing: POST /{page-id}/video_reels upload_phase=start → a
//   video_id; POST rupload.facebook.com/video-upload/<ver>/<video-id> with a
//   `file_url` header (a hosted file); POST /{page-id}/video_reels
//   upload_phase=finish, video_state=PUBLISHED, description. Status:
//   GET /{video-id}?fields=status (video_status + uploading/processing/
//   publishing phases). Specs: 9:16; 1080x1920 recommended, 540x960 minimum;
//   24–60 FPS; 3–90 seconds; H.264/H.265; AAC. 30 API-published reels per
//   Page per rolling 24 hours. Chosen over POST /{page-id}/videos because
//   the Reels guide is the one that documents Page limits and a status
//   endpoint; /videos documents neither, and its `thumb` is a raw file upload.
//
// TikTok — developers.tiktok.com/doc/content-posting-api-reference-direct-post
//   (POST /v2/post/publish/video/init/, post_info.title ≤ 2200 UTF-16 runes,
//   disable_duet / disable_stitch / disable_comment, video_cover_timestamp_ms,
//   source_info PULL_FROM_URL + video_url); .../content-posting-api-reference-
//   upload-video (POST /v2/post/publish/inbox/video/init/, source_info only —
//   a draft carries no caption); .../content-posting-api-media-transfer-guide
//   (MP4/WebM/MOV; H.264/H.265/VP8/VP9; 23–60 FPS; 360–4096 px each side;
//   ≤4 GB; ≤10 min, and the creator's own max_video_post_duration_sec from
//   creator_info, which .../content-sharing-guidelines requires checking).
//
// ══ FieldQuo's own rules ════════════════════════════════════════════════════
//
//   - Every destination here is a vertical format (Reels, TikTok), so the
//     clip that is SENT must be 9:16. A clip that isn't is never reshaped
//     silently: the person picks "Fit to 9:16 (adds bars)" or "Crop to 9:16",
//     sees it, and only then can post. Instagram would technically accept
//     other shapes, but its own docs recommend 9:16 "to avoid cropping or
//     blank space" — and one clip going out in three different shapes is the
//     surprise this rule exists to prevent.
//   - What is sent is always a Cloudinary derived rendition — H.264/AAC MP4
//     at 24–60 FPS within 1080x1920 — never the phone's original file: an
//     iPhone .mov routinely has edit lists and a trailing moov atom, both of
//     which Instagram's spec refuses.
//   - Nothing is added to the video. No watermark, no FieldQuo mark, no
//     outro: white-label (AGENTS.md) and TikTok's guidelines agree.

import { VIDEO_MAX_BYTES } from "../media/validate.js";

// ── Limits ═══════════════════════════════════════════════════════════════

/** FieldQuo's own ceiling on a video post, enforced when it is created. */
export const VIDEO_POST_LIMITS = Object.freeze({
  // Instagram and Facebook both refuse under 3 s.
  minSeconds: 3,
  // TikTok's API ceiling (10 min). Instagram allows 15, but a clip longer
  // than TikTok could ever take is not a clip this screen is for, and the
  // byte cap below binds long before either on a phone's bitrate.
  maxSeconds: 600,
  maxBytes: VIDEO_MAX_BYTES,
});

export const INSTAGRAM_REEL_SPEC = Object.freeze({
  minSeconds: 3,
  maxSeconds: 15 * 60,
  maxBytes: 300 * 1024 * 1024,
  maxWidth: 1920,
  minFps: 23,
  maxFps: 60,
  minAspect: 0.01,
  maxAspect: 10,
});

export const FACEBOOK_REEL_SPEC = Object.freeze({
  minSeconds: 3,
  maxSeconds: 90,
  minWidth: 540,
  minHeight: 960,
  minFps: 24,
  maxFps: 60,
  dailyLimit: 30,
});

export const TIKTOK_VIDEO_SPEC = Object.freeze({
  minSide: 360,
  maxSide: 4096,
  maxBytes: 4 * 1024 * 1024 * 1024,
  minFps: 23,
  maxFps: 60,
  maxSecondsApi: 600,
  titleMax: 2200,
});

/** Caption rules — Instagram's, the tightest of the three (metaSpecs.js). */
export const VIDEO_CAPTION_MAX = 2200;

export const PLATFORMS = Object.freeze(["instagram", "facebook", "tiktok"]);

// ── Shape ════════════════════════════════════════════════════════════════

export const FITS = Object.freeze(["original", "pad", "crop"]);
const TARGET = Object.freeze({ width: 1080, height: 1920 });
const NINE_BY_SIXTEEN = 9 / 16;
/** 1% either way — 1080x1920, 720x1280 and 2160x3840 are 9:16; 1080x1350 is not. */
export const VERTICAL_TOLERANCE = 0.01;

export function isNineBySixteen(width, height) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return false;
  return Math.abs(w / h - NINE_BY_SIXTEEN) / NINE_BY_SIXTEEN <= VERTICAL_TOLERANCE;
}

/** A fit the person may keep for this clip: "original" only when it is already 9:16. */
export function fitAllowed(fit, { width, height }) {
  if (!FITS.includes(fit)) return false;
  if (fit === "original") return isNineBySixteen(width, height);
  return true;
}

/**
 * The pixel size of the rendition that will be sent. Pad and crop always
 * produce 1080x1920 (Cloudinary scales up a smaller clip to fill it);
 * "original" is scaled DOWN into 1080x1920 (c_limit never enlarges).
 * Null when the clip has no usable dimensions — never a guess.
 */
export function renditionSize(fit, { width, height }) {
  const w = Number(width);
  const h = Number(height);
  if (!(w > 0) || !(h > 0) || !Number.isFinite(w) || !Number.isFinite(h)) return null;
  if (fit === "pad" || fit === "crop") return { ...TARGET };
  const scale = Math.min(1, TARGET.width / w, TARGET.height / h);
  // Even numbers: H.264 at 4:2:0 needs them, and Cloudinary rounds the same way.
  const even = (n) => Math.max(2, Math.round(n / 2) * 2);
  return { width: even(w * scale), height: even(h * scale) };
}

// ── Cloudinary ═══════════════════════════════════════════════════════════
//
// Transformation syntax from cloudinary.com/documentation/
// transformation_reference (c_pad + b_black, c_fill + g_center, c_limit,
// fps_<min>-<max>, vc_h264:<profile>:<level>, ac_aac). g_center rather than
// g_auto: the preview the person approves is a centred crop, and an AI crop
// that moved between preview and post would be a different video.

const FIT_TRANSFORMS = Object.freeze({
  original: `c_limit,w_${TARGET.width},h_${TARGET.height}`,
  pad: `c_pad,w_${TARGET.width},h_${TARGET.height},b_black`,
  crop: `c_fill,w_${TARGET.width},h_${TARGET.height},g_center`,
});
const ENCODE = "ac_aac,fps_24-60,vc_h264:high:auto";

/** The transformation string for a fit — also the eager transformation requested. */
export function renditionTransformation(fit) {
  const shape = FIT_TRANSFORMS[fit];
  if (!shape) return null;
  return `${shape}/${ENCODE}`;
}

const CLOUD_NAME = /^[a-z0-9_-]{1,64}$/i;
const PUBLIC_ID = /^[A-Za-z0-9_\-/]{1,255}$/;

function safeIds(cloudName, publicId) {
  return typeof cloudName === "string" && CLOUD_NAME.test(cloudName) && typeof publicId === "string" && PUBLIC_ID.test(publicId) && !publicId.includes("..");
}

/** The MP4 every platform is sent. Null for a bad id or fit. */
export function renditionUrl({ cloudName, publicId, fit }) {
  const tx = renditionTransformation(fit);
  if (!tx || !safeIds(cloudName, publicId)) return null;
  return `https://res.cloudinary.com/${cloudName}/video/upload/${tx}/${publicId}.mp4`;
}

/** A JPEG of one frame of the rendition — the cover record and the poster. */
export function frameUrl({ cloudName, publicId, fit, offsetMs = 0 }) {
  const shape = FIT_TRANSFORMS[fit];
  if (!shape || !safeIds(cloudName, publicId)) return null;
  const ms = Math.max(0, Math.floor(Number(offsetMs) || 0));
  const seconds = (ms / 1000).toFixed(2).replace(/\.?0+$/, "") || "0";
  return `https://res.cloudinary.com/${cloudName}/video/upload/so_${seconds},${shape}/${publicId}.jpg`;
}

/**
 * Is `url` the derived rendition Cloudinary reports? Its secure_url carries a
 * version segment ours does not, so both are compared without it.
 */
export function sameDerived(derivedUrl, ours) {
  const strip = (u) => String(u || "").replace(/^https?:\/\//, "").replace(/\/v\d+\//, "/");
  return Boolean(derivedUrl) && Boolean(ours) && strip(derivedUrl) === strip(ours);
}

/**
 * What Cloudinary told US about the uploaded clip (explicit() or the Admin
 * API) → the facts a video post stores. Several places a number can live,
 * because the upload-shaped answer and the media_metadata answer differ.
 * A field that is not there is null — the caller refuses, never assumes.
 */
export function readVideoFacts(asset) {
  if (!asset || typeof asset !== "object") return null;
  const num = (v) => {
    const n = typeof v === "string" ? Number(v) : v;
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const meta = asset.video_metadata || asset.media_metadata || null;
  const streams = Array.isArray(meta?.streams) ? meta.streams : [];
  const videoStream = streams.find((s) => s?.codec_type === "video") || null;
  const rate = (r) => {
    if (typeof r === "number") return num(r);
    if (typeof r !== "string") return null;
    const [a, b] = r.split("/").map(Number);
    return b ? num(a / b) : num(a);
  };
  // A phone records portrait as landscape pixels plus a rotation flag;
  // Cloudinary's width/height already account for it, the raw stream does not.
  return {
    width: num(asset.width) ?? num(videoStream?.width),
    height: num(asset.height) ?? num(videoStream?.height),
    durationSec: num(asset.duration) ?? num(meta?.format?.duration) ?? num(videoStream?.duration),
    bytes: num(asset.bytes),
    format: typeof asset.format === "string" ? asset.format.toLowerCase() : null,
    frameRate: num(asset.frame_rate) ?? rate(videoStream?.avg_frame_rate) ?? rate(videoStream?.r_frame_rate),
    resourceType: asset.resource_type || null,
  };
}

/** The server's gate when a video post is created. */
export function checkUploadedVideo(facts) {
  const errors = [];
  if (!facts || facts.resourceType !== "video") return { ok: false, errors: ["not_a_video"] };
  if (!facts.width || !facts.height) errors.push("no_dimensions");
  if (!facts.durationSec) errors.push("no_duration");
  else if (facts.durationSec < VIDEO_POST_LIMITS.minSeconds) errors.push("too_short");
  else if (facts.durationSec > VIDEO_POST_LIMITS.maxSeconds) errors.push("too_long");
  if (facts.bytes && facts.bytes > VIDEO_POST_LIMITS.maxBytes) errors.push("file_too_large");
  return { ok: errors.length === 0, errors };
}

// ── Per-platform checks, before anything is sent ═══════════════════════════

/**
 * Every reason `platform` cannot take this post as it stands. Runs on the
 * RENDITION (what is actually sent) — its size from renditionSize(), its
 * frame rate clamped to 24–60 by the encode — and on the clip's duration,
 * which no rendition changes.
 *
 * @param {"instagram"|"facebook"|"tiktok"} platform
 * @param {{width, height, durationSec, fit, caption, coverMode, coverOffsetMs, coverImageUrl}} post
 * @param {{maxVideoPostDurationSec?: number|null}} [creator] TikTok only
 * @returns {{ ok: boolean, errors: string[], limits: object }}
 */
export function checkForPlatform(platform, post, creator = null) {
  const errors = [];
  const p = post || {};
  const duration = Number(p.durationSec);
  const hasDuration = Number.isFinite(duration) && duration > 0;
  const size = renditionSize(p.fit, p);

  if (!FITS.includes(p.fit)) errors.push("bad_fit");
  else if (!fitAllowed(p.fit, p)) errors.push("not_vertical");
  if (!size) errors.push("no_dimensions");
  if (!hasDuration) errors.push("no_duration");

  const caption = typeof p.caption === "string" ? p.caption : "";
  const offset = p.coverOffsetMs; // an Int column — a string here is not a frame
  if (p.coverMode === "frame" && (!Number.isInteger(offset) || offset < 0 || (hasDuration && offset >= duration * 1000))) {
    // Instagram's own 2207057: "Thumbnail offset must be greater than or
    // equal to 0 and less than video duration". Same rule for TikTok's
    // video_cover_timestamp_ms — a frame that does not exist.
    errors.push("cover_offset_out_of_range");
  }

  let limits = {};
  if (platform === "instagram") {
    limits = { minSeconds: INSTAGRAM_REEL_SPEC.minSeconds, maxSeconds: INSTAGRAM_REEL_SPEC.maxSeconds };
    if (hasDuration && duration < INSTAGRAM_REEL_SPEC.minSeconds) errors.push("too_short");
    if (hasDuration && duration > INSTAGRAM_REEL_SPEC.maxSeconds) errors.push("too_long");
    if (size && size.width > INSTAGRAM_REEL_SPEC.maxWidth) errors.push("too_wide");
    const length = [...caption].length;
    if (length === 0) errors.push("caption_empty");
    if (length > VIDEO_CAPTION_MAX) errors.push("caption_too_long");
    if ((caption.match(/#[^\s#@]+/g) || []).length > 30) errors.push("too_many_hashtags");
    if ((caption.match(/@[^\s#@]+/g) || []).length > 20) errors.push("too_many_mentions");
    if (p.coverMode === "image" && !isHttpsUrl(p.coverImageUrl)) errors.push("cover_image_missing");
  } else if (platform === "facebook") {
    limits = { minSeconds: FACEBOOK_REEL_SPEC.minSeconds, maxSeconds: FACEBOOK_REEL_SPEC.maxSeconds };
    if (hasDuration && duration < FACEBOOK_REEL_SPEC.minSeconds) errors.push("too_short");
    if (hasDuration && duration > FACEBOOK_REEL_SPEC.maxSeconds) errors.push("too_long");
    if (size && (size.width < FACEBOOK_REEL_SPEC.minWidth || size.height < FACEBOOK_REEL_SPEC.minHeight)) errors.push("too_small");
    if ([...caption].length > VIDEO_CAPTION_MAX) errors.push("caption_too_long");
  } else if (platform === "tiktok") {
    const creatorMax = Number(creator?.maxVideoPostDurationSec);
    const max = Number.isFinite(creatorMax) && creatorMax > 0 ? Math.min(creatorMax, TIKTOK_VIDEO_SPEC.maxSecondsApi) : TIKTOK_VIDEO_SPEC.maxSecondsApi;
    limits = { maxSeconds: max };
    if (hasDuration && duration > max) errors.push(Number.isFinite(creatorMax) && creatorMax > 0 && creatorMax < TIKTOK_VIDEO_SPEC.maxSecondsApi ? "too_long_for_creator" : "too_long");
    if (size && (Math.min(size.width, size.height) < TIKTOK_VIDEO_SPEC.minSide || Math.max(size.width, size.height) > TIKTOK_VIDEO_SPEC.maxSide)) {
      errors.push("video_size_check_failed");
    }
    if (caption.length > TIKTOK_VIDEO_SPEC.titleMax) errors.push("caption_too_long");
  } else {
    errors.push("unknown_platform");
  }
  return { ok: errors.length === 0, errors: [...new Set(errors)], limits };
}

function isHttpsUrl(value) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// ── What each platform is sent ════════════════════════════════════════════

/**
 * POST /{ig-user-id}/media for a Reel. share_to_feed true: a contractor's
 * Reel is meant to be seen on their profile grid, not only in the Reels tab.
 * Exactly one of cover_url / thumb_offset.
 */
export function buildInstagramReelParams({ videoUrl, caption, coverMode, coverOffsetMs, coverImageUrl }) {
  const params = {
    media_type: "REELS",
    video_url: videoUrl,
    caption: typeof caption === "string" ? caption : "",
    share_to_feed: "true",
  };
  if (coverMode === "image" && coverImageUrl) params.cover_url = coverImageUrl;
  else params.thumb_offset = String(Math.max(0, Math.floor(Number(coverOffsetMs) || 0)));
  return params;
}

/** POST /{page-id}/video_reels, phase 1. */
export function buildFacebookReelStartParams() {
  return { upload_phase: "start" };
}

/** POST /{page-id}/video_reels, phase 3 — publish as soon as processing finishes. */
export function buildFacebookReelFinishParams({ videoId, caption }) {
  return {
    video_id: String(videoId),
    upload_phase: "finish",
    video_state: "PUBLISHED",
    description: typeof caption === "string" ? caption : "",
  };
}

/**
 * TikTok Direct Post of a video, pulled from FieldQuo's verified prefix. Every
 * interaction flag is written from the person's own tick, never TikTok's
 * default — the same rule buildPhotoPostBody() keeps.
 */
export function buildTikTokVideoPostBody({
  privacyLevel,
  allowComment,
  allowDuet,
  allowStitch,
  commercialOn,
  yourBrand,
  brandedContent,
  title,
  videoUrl,
  coverTimestampMs,
}) {
  return {
    post_info: {
      title: typeof title === "string" ? title : "",
      privacy_level: privacyLevel,
      disable_duet: allowDuet !== true,
      disable_comment: allowComment !== true,
      disable_stitch: allowStitch !== true,
      video_cover_timestamp_ms: Math.max(0, Math.floor(Number(coverTimestampMs) || 0)),
      brand_content_toggle: commercialOn === true && brandedContent === true,
      brand_organic_toggle: commercialOn === true && yourBrand === true,
    },
    source_info: {
      source: "PULL_FROM_URL",
      video_url: videoUrl,
    },
  };
}

/** TikTok inbox draft (scope video.upload): the video only — the API takes no caption. */
export function buildTikTokVideoDraftBody({ videoUrl }) {
  return { source_info: { source: "PULL_FROM_URL", video_url: videoUrl } };
}

// ── Status ═══════════════════════════════════════════════════════════════

/**
 * An Instagram Reel container's status_code → what the poll does next.
 * "publish" means: claim the row and call media_publish exactly once.
 */
export function instagramReelStep(statusCode) {
  switch (statusCode) {
    case "IN_PROGRESS":
      return { state: "processing" };
    case "FINISHED":
      return { state: "publish" };
    case "PUBLISHED":
      return { state: "published" };
    case "ERROR":
      return { state: "failed", code: "container_error" };
    case "EXPIRED":
      return { state: "failed", code: "container_expired" };
    default:
      return { state: "unknown" };
  }
}

// Instagram's container `status` text carries the subcode when it fails
// ("Error: ... 2207026"). The ones a video can hit, from the error-code
// table in this file's header.
const IG_VIDEO_SUBCODES = Object.freeze({
  2207026: "meta_video_format",
  2207057: "cover_offset_out_of_range",
  2207053: "meta_transient",
  2207001: "meta_transient",
  2207032: "meta_transient",
  2207052: "meta_media_unreachable",
  2207003: "meta_media_unreachable",
  2207050: "meta_account",
  2207051: "meta_account",
  2207042: "rate_limited",
  2207027: "not_ready",
});

/** A failed container's status text → a code the screen has a sentence for. */
export function classifyInstagramContainerError(statusText) {
  const text = typeof statusText === "string" ? statusText : "";
  const m = text.match(/\b(22070\d\d)\b/);
  if (m && IG_VIDEO_SUBCODES[Number(m[1])]) return IG_VIDEO_SUBCODES[Number(m[1])];
  return "container_error";
}

/**
 * Facebook's GET /{video-id}?fields=status → our state. Phase statuses are
 * "complete" in Meta's sample and "completed" in its field list; both count.
 * Anything that says error in any phase fails, with the phase and Meta's own
 * message kept for the row.
 */
export function facebookReelStep(status) {
  const s = status && typeof status === "object" ? status : null;
  if (!s) return { state: "unknown" };
  const done = (v) => v === "complete" || v === "completed";
  const phases = ["uploading_phase", "processing_phase", "publishing_phase"];
  for (const phase of phases) {
    const ph = s[phase];
    if (ph && ph.status === "error") {
      const msg = ph.errors?.[0]?.message || ph.error?.message || null;
      return { state: "failed", code: "facebook_reel_failed", phase, message: typeof msg === "string" ? msg.slice(0, 500) : null };
    }
  }
  if (["error", "upload_failed"].includes(s.video_status)) {
    return { state: "failed", code: "facebook_reel_failed", phase: "video_status", message: s.video_status };
  }
  if (s.video_status === "expired") return { state: "failed", code: "container_expired", phase: "video_status", message: "expired" };
  const pub = s.publishing_phase || {};
  if (pub.publish_status === "published" || (done(pub.status) && s.video_status === "ready")) return { state: "published" };
  if (pub.publish_status === "error") {
    return { state: "failed", code: "facebook_reel_failed", phase: "publishing_phase", message: "publish_status=error" };
  }
  const stage = !done(s.uploading_phase?.status) ? "uploading" : !done(s.processing_phase?.status) ? "processing" : "publishing";
  return { state: "processing", stage };
}

// ── The code a failed row was refused with ══════════════════════════════════
//
// SocialPublish has one error column, and a design row keeps Meta's full
// answer in it. A video row keeps the same answer with the stable code in
// front — "[meta_video_format] Instagram container ERROR: …" — so a status
// read a day later can still say the translated sentence for it, without a
// new column for one feature.

export function withCode(code, detail) {
  const c = typeof code === "string" && /^[a-z0-9_]{1,60}$/.test(code) ? code : "unexpected";
  return `[${c}] ${String(detail || "").slice(0, 1900)}`;
}

export function codeFromMessage(message) {
  const m = typeof message === "string" ? message.match(/^\[([a-z0-9_]{1,60})\] /) : null;
  return m ? m[1] : null;
}

/** SocialPublish statuses a poll may still move. */
export function isOpenVideoPublish(status) {
  return status === "container_created" || status === "publishing" || status === "pending";
}
