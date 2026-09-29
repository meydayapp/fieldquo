// lib/marketing/videoPostServer.js
//
// The server-only half of a video post: the Cloudinary calls, the ownership
// check on an uploaded clip, the connection lookups, and the one shape every
// video post route answers with. Decisions live in lib/marketing/videoPost.js;
// this file only fetches the facts those decisions run on.
//
// ══ Why the rendition is made ASYNCHRONOUSLY ══════════════════════════════════
//
// Cloudinary transforms a video on the fly only up to 40 MB on the Free plan
// (300 MB paid) — above that a URL request fails with "use an eager
// transformation with eager_async=true" (cloudinary.com/documentation/
// ts_troubleshooting_video_transformation_errors). A phone clip passes 40 MB
// in under a minute. So choosing a fit asks Cloudinary for that rendition
// eagerly, in the background (explicit + eager_async), and nothing is sent
// to a platform until renditionState() says it exists. Sending the URL
// before then would hand Meta or TikTok a URL that fails to download — a
// refusal after the person pressed Post, for a reason we could see first.

import { db } from "@/lib/db";
import { cloudinary } from "@/lib/cloudinary";
import { uploadScope, isOwnPublicId } from "@/lib/media/directUpload";
import {
  checkForPlatform,
  codeFromMessage,
  frameUrl,
  readVideoFacts,
  renditionSize,
  renditionTransformation,
  renditionUrl,
  sameDerived,
} from "@/lib/marketing/videoPost";

export const VIDEO_PURPOSE = "video";

const TIMEOUT_MS = 10_000;

function withTimeout(promise, ms = TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error("Cloudinary timed out");
      err.name = "TimeoutError";
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export function cloudName() {
  return process.env.CLOUDINARY_CLOUD_NAME || "";
}

/** Is this public_id a clip this company uploaded under the "video" purpose? */
export function isOwnVideoId(companyId, publicId) {
  const scope = uploadScope("member", { companyId, purpose: VIDEO_PURPOSE });
  return isOwnPublicId(publicId, scope, "video");
}

/** …and a cover picture uploaded the same way (an image in the same folder). */
export function isOwnCoverUrl(companyId, url) {
  const scope = uploadScope("member", { companyId, purpose: VIDEO_PURPOSE });
  if (!scope.ok || typeof url !== "string") return false;
  const m = url.match(/^https:\/\/res\.cloudinary\.com\/([^/]+)\/image\/upload\/(?:v\d+\/)?(.+)\.(jpg|jpeg|png|webp)$/i);
  if (!m || m[1] !== cloudName()) return false;
  return isOwnPublicId(m[2], scope, "image");
}

/**
 * Asks Cloudinary for the rendition of `fit` (in the background) and reads
 * the clip's own facts back in the same call — explicit() answers with the
 * upload-shaped record: width, height, duration, bytes, format, frame rate.
 * `fit` null reads the facts without asking for a rendition: a clip that is
 * not 9:16 gets none until the person picks pad or crop, so no transcoding
 * is paid for on a shape nobody chose. Throws on a Cloudinary failure; the
 * caller says so rather than guessing.
 *
 * @returns {Promise<{ facts: object|null, secureUrl: string|null }>}
 */
export async function requestRendition(publicId, fit) {
  const tx = fit ? renditionTransformation(fit) : null;
  if (fit && !tx) throw new Error("bad fit");
  const asset = await withTimeout(
    cloudinary.uploader.explicit(publicId, {
      type: "upload",
      resource_type: "video",
      ...(tx ? { eager: [{ raw_transformation: tx, format: "mp4" }], eager_async: true } : {}),
    }),
    20_000,
  );
  return {
    facts: readVideoFacts(asset),
    secureUrl: typeof asset?.secure_url === "string" ? asset.secure_url : null,
  };
}

/**
 * The clip's facts when explicit() left one out: the Admin API with
 * media_metadata, which carries the container's duration and the stream's
 * frame rate. One Admin API call — used only as the fallback.
 */
export async function lookupVideoFacts(publicId) {
  const asset = await withTimeout(
    cloudinary.api.resource(publicId, { resource_type: "video", type: "upload", media_metadata: true }),
  );
  return { facts: readVideoFacts(asset), derived: Array.isArray(asset?.derived) ? asset.derived : [] };
}

/**
 * Does the rendition exist yet? Checked against Cloudinary's own list of
 * derived assets first; when it is not listed, a HEAD on the URL settles it
 * (a small clip Cloudinary can make on the fly answers 200 at once).
 * @returns {Promise<"ready"|"processing"|"unknown">}
 */
export async function renditionState(post) {
  const url = renditionUrl({ cloudName: cloudName(), publicId: post.videoPublicId, fit: post.fit });
  if (!url) return "unknown";
  try {
    const { derived } = await lookupVideoFacts(post.videoPublicId);
    if (derived.some((d) => sameDerived(d?.secure_url || d?.url, url))) return "ready";
  } catch {
    // Fall through to the HEAD — the Admin API has an hourly allowance.
  }
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(8000) });
    if (res.ok && (res.headers.get("content-type") || "").startsWith("video/")) return "ready";
    return "processing";
  } catch {
    return "unknown";
  }
}

/** The post as every route answers it — URLs built here, never from the row alone. */
export function shapeVideoPost(post, { rendition = null } = {}) {
  const cn = cloudName();
  const size = renditionSize(post.fit, post);
  const coverFrame = frameUrl({ cloudName: cn, publicId: post.videoPublicId, fit: post.fit, offsetMs: post.coverOffsetMs });
  return {
    id: post.id,
    campaignId: post.campaignId,
    name: post.name,
    videoUrl: post.videoUrl,
    width: post.width,
    height: post.height,
    durationSec: post.durationSec,
    bytes: post.bytes,
    frameRate: post.frameRate,
    fit: post.fit,
    coverMode: post.coverMode,
    coverOffsetMs: post.coverOffsetMs,
    coverImageUrl: post.coverImageUrl,
    caption: post.caption || "",
    rendition: {
      url: renditionUrl({ cloudName: cn, publicId: post.videoPublicId, fit: post.fit }),
      width: size?.width ?? null,
      height: size?.height ?? null,
      state: rendition,
    },
    coverFrameUrl: coverFrame,
    // Instagram and Facebook's own checks, before any connection is asked
    // about — TikTok's needs the creator's own limit, checked in its composer.
    checks: {
      instagram: checkForPlatform("instagram", post),
      facebook: checkForPlatform("facebook", post),
      tiktok: checkForPlatform("tiktok", post),
    },
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

/**
 * A SocialPublish row as the video screen may show it — never a token, never
 * Meta's raw object. `errorMessage` is Meta's own answer (code, subcode,
 * fbtrace_id), shown small under the translated sentence for support.
 */
export function publishRowShape(row, extra = {}) {
  return {
    id: row.id,
    platform: row.platform,
    status: row.status,
    errorMessage: row.status === "failed" || row.status === "rate_limited" ? row.errorMessage : null,
    code: row.status === "failed" || row.status === "rate_limited" ? codeFromMessage(row.errorMessage) : null,
    externalPostId: row.externalPostId,
    isMock: row.isMock,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
    ...extra,
  };
}

export async function loadOwnedVideoPost(companyId, id) {
  if (typeof id !== "string" || !id) return null;
  const post = await db.videoPost.findUnique({ where: { id } });
  if (!post || post.companyId !== companyId) return null;
  return post;
}
