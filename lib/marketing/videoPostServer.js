// lib/marketing/videoPostServer.js
//
// The server-only half of a video post: the Cloudinary calls, the ownership
// check on an uploaded clip, the connection lookups, and the one shape every
// video post route answers with. Decisions live in lib/marketing/videoPost.js;
// this file only fetches the facts those decisions run on.
//
// Since 2026-09-29 a clip is converted ON ARRIVAL (lib/marketing/videoUpload.js
// — 1080p, 9:16 when chosen, in the incoming transformation), so most posts
// are sent as stored and never need what follows. It remains for a clip whose
// shape the browser couldn't read that turns out not to be 9:16, and for rows
// made before that change.
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
  destinationState,
  frameUrl,
  readVideoFacts,
  renditionSize,
  renditionTransformation,
  renditionUrl,
  sameDerived,
  sendUrl,
} from "@/lib/marketing/videoPost";
import { judgeArrival } from "@/lib/marketing/videoUpload";
import { videoApprovalState } from "@/lib/marketing/approvalFingerprint";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import {
  UPLOAD_RESERVATION_HOURS,
  VIDEO_MAX_SECONDS,
  VIDEO_PACK,
  allowanceFor,
  decideNewVideo,
  monthWindow,
} from "@/lib/marketing/videoAllowance";
import { DEFAULT_TIMEZONE } from "@/lib/time/wallClock";

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
  if (post.uploadState && post.uploadState !== "ready") return "processing";
  // Prepared on arrival and sent as stored: the stored file IS the rendition,
  // and it exists because the post is "ready".
  if (post.preparedAs && post.fit === "original") return "ready";
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

/**
 * The post as every route answers it — URLs built here, never from the row
 * alone. A clip still on its way in answers its state and nothing about the
 * clip: until Cloudinary confirms it, the size and length columns hold only
 * what the browser declared, and showing those as facts would be showing a
 * guess.
 */
export function shapeVideoPost(post, { rendition = null, approvedByName = null } = {}) {
  const cn = cloudName();
  const ready = !post.uploadState || post.uploadState === "ready";
  const base = {
    id: post.id,
    campaignId: post.campaignId,
    name: post.name,
    uploadState: post.uploadState || "ready",
    uploadError: post.uploadState === "failed" ? post.uploadError || "unexpected" : null,
    preparedAs: post.preparedAs || null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
  if (!ready) return base;

  const size = renditionSize(post.fit, post);
  const coverFrame = frameUrl({ cloudName: cn, publicId: post.videoPublicId, fit: post.fit, offsetMs: post.coverOffsetMs });
  const checks = {
    instagram: checkForPlatform("instagram", post),
    facebook: checkForPlatform("facebook", post),
    tiktok: checkForPlatform("tiktok", post),
  };
  const approval = videoApprovalState(post);
  return {
    ...base,
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
      url: sendUrl(post, cn),
      width: size?.width ?? null,
      height: size?.height ?? null,
      state: rendition,
    },
    coverFrameUrl: coverFrame,
    // Instagram and Facebook's own checks, before any connection is asked
    // about — TikTok's needs the creator's own limit, checked in its composer.
    checks,
    // One tick box per destination; a clip-limit refusal greys it out with
    // its reason (videoPost.js destinationState).
    destinations: {
      instagram: destinationState(checks.instagram),
      facebook: destinationState(checks.facebook),
      tiktok: destinationState(checks.tiktok),
    },
    approval: {
      state: approval.state,
      fingerprint: approval.current,
      approvedAt: post.approvedAt || null,
      approvedByName,
    },
  };
}

/** The approver's name for a screen — a separate read, the column has no relation. */
export async function approverName(post) {
  if (!post?.approvedById) return null;
  const user = await db.user.findUnique({ where: { id: post.approvedById }, select: { name: true } }).catch(() => null);
  return user?.name || null;
}

// ── The month's allowance ═══════════════════════════════════════════════════

/** The allowance as a screen may show it. `canAddPack` = may buy one (owner/admin). */
export function allowanceBody(a, member) {
  return {
    used: a.used,
    reserved: a.reserved,
    total: a.allowance.total,
    included: a.allowance.included,
    packs: a.allowance.packs,
    packVideos: VIDEO_PACK.videos,
    packPriceCents: VIDEO_PACK.priceCents,
    packCurrency: VIDEO_PACK.currency,
    maxSeconds: VIDEO_MAX_SECONDS,
    month: a.window.label,
    canAddPack: isBillingAdmin(member?.role),
  };
}

/**
 * This company's video allowance right now: counted this month, on the way
 * in, and the total (plan + paid packs). Company.timezone decides where the
 * month starts.
 */
export async function loadVideoAllowance(companyId, { now = new Date(), prisma = db } = {}) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { timezone: true, currency: true } });
  const window = monthWindow(now, company?.timezone || DEFAULT_TIMEZONE);
  const reservedSince = new Date(now.getTime() - UPLOAD_RESERVATION_HOURS * 3600 * 1000);
  const [used, reserved, packs] = await Promise.all([
    prisma.videoPost.count({ where: { companyId, countedAt: { gte: window.start, lt: window.end } } }),
    prisma.videoPost.count({
      where: { companyId, uploadState: { in: ["uploading", "processing"] }, countedAt: null, createdAt: { gte: reservedSince } },
    }),
    prisma.videoPack.findMany({ where: { companyId }, orderBy: { createdAt: "asc" } }),
  ]);
  const allowance = allowanceFor(packs, now);
  return {
    window,
    used,
    reserved,
    allowance,
    decision: decideNewVideo({ used, reserved, allowance }),
    packs,
    currency: company?.currency || "USD",
  };
}

// ── Arrival ═════════════════════════════════════════════════════════════════

/**
 * The clip has arrived (Cloudinary told us, by notification or lookup).
 * Stores Cloudinary's facts, marks the post ready and COUNTS it — once:
 * the update is conditional on the post still being on its way in, so the
 * notification and a screen's lookup landing together count it one time.
 */
export async function settleArrival(post, asset, { now = new Date(), prisma = db } = {}) {
  let verdict = judgeArrival({ post, asset, cloudName: cloudName() });
  if (verdict.ok === false && verdict.code === "no_duration") {
    // The notification can leave the length out; the Admin API's
    // media_metadata has it.
    try {
      const more = await lookupVideoFacts(post.videoPublicId);
      verdict = judgeArrival({ post, asset: { ...asset, duration: more.facts?.durationSec, frame_rate: more.facts?.frameRate }, cloudName: cloudName() });
    } catch {
      // Keep the refusal; the screen can ask again.
      return { settled: false, code: "no_duration", retry: true };
    }
  }
  const pending = { id: post.id, uploadState: { in: ["uploading", "processing"] } };
  if (!verdict.ok) {
    const failed = await prisma.videoPost.updateMany({ where: pending, data: { uploadState: "failed", uploadError: verdict.code } });
    return { settled: failed.count === 1, code: verdict.code };
  }
  const f = verdict.facts;
  const won = await prisma.videoPost.updateMany({
    where: pending,
    data: {
      uploadState: "ready",
      uploadError: null,
      videoUrl: verdict.videoUrl,
      width: Math.round(f.width),
      height: Math.round(f.height),
      durationSec: f.durationSec,
      bytes: f.bytes ? Math.round(f.bytes) : null,
      format: f.format,
      frameRate: f.frameRate,
      countedAt: now,
    },
  });
  return { settled: won.count === 1, counted: won.count === 1 };
}

/** How long a clip may be "on its way in" before the reservation is released. */
const ARRIVAL_GIVE_UP_MS = UPLOAD_RESERVATION_HOURS * 3600 * 1000;
/** A screen polls every few seconds; Cloudinary is asked at most this often per post. */
const CHECK_EVERY_MS = 15_000;

/**
 * The fallback when Cloudinary's upload notification does not reach us (a
 * local server, a dropped webhook): ask Cloudinary whether the clip exists.
 * Throttled per post (uploadCheckedAt) so a polling screen cannot spend the
 * Admin API's hourly allowance.
 *
 * @returns the post, re-read if anything changed.
 */
export async function checkArrival(post, { now = new Date(), prisma = db } = {}) {
  if (!post || !["uploading", "processing"].includes(post.uploadState)) return post;
  if (post.uploadCheckedAt && now - new Date(post.uploadCheckedAt) < CHECK_EVERY_MS) return post;
  await prisma.videoPost.update({ where: { id: post.id }, data: { uploadCheckedAt: now } });

  let asset = null;
  try {
    asset = await withTimeout(cloudinary.api.resource(post.videoPublicId, { resource_type: "video", type: "upload" }));
  } catch (err) {
    const status = Number(err?.error?.http_code ?? err?.http_code);
    if (status !== 404) return post; // a blip or the quota — ask again later
    if (now - new Date(post.createdAt) > ARRIVAL_GIVE_UP_MS) {
      // Never arrived. The slot is released (it was never counted) and the
      // screen says so, rather than spinning for ever.
      await prisma.videoPost.updateMany({
        where: { id: post.id, uploadState: { in: ["uploading", "processing"] } },
        data: { uploadState: "failed", uploadError: "upload_never_arrived" },
      });
      return prisma.videoPost.findUnique({ where: { id: post.id } });
    }
    return post;
  }
  await settleArrival(post, asset, { now, prisma });
  return prisma.videoPost.findUnique({ where: { id: post.id } });
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
