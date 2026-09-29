// app/api/marketing/video-posts/[id]/publish/route.js
//
// GET  — can this company post this video to Instagram / Facebook, and what
//        has it already sent (the "already posted this?" cue).
// POST — start an Instagram Reel and/or a Facebook Page Reel.
//        Body: { platforms: ["instagram" | "facebook", …] }.
//
// Every gate the design publish route has that applies to a video: the
// user:manage permission, a paid plan (planOrRefusal), Meta publishing being
// available at all (isSocialPublishingVisible), a live connection. Then the
// video's own: each platform's checks (lib/marketing/videoPost.js
// checkForPlatform — shape, length, size, caption, cover) and a rendition
// that actually exists at Cloudinary. A platform that fails a check is
// refused with its reasons; the other still posts.
//
// Starting is all this route does. Meta takes minutes to process a video, so
// each attempt is recorded (SocialPublish, mediaType "reel") in its
// in-flight state and the screen polls
// app/api/marketing/video-posts/publishes/[publishId] — which is also what
// finally publishes an Instagram container once Meta says FINISHED.
//
// No approval step, unlike a design: a design's words and artwork are edited
// on other screens and approved separately, which is what its fingerprint
// guards. A video post's clip, shape, cover and caption are all on the one
// screen that posts it, in front of the person pressing Post.
export const runtime = "nodejs";
export const maxDuration = 60;

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { planOrRefusal } from "@/lib/signup/planGate";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { metaAppConfigured } from "@/lib/meta/client";
import { getMetaConnection } from "@/lib/social/metaConnection";
import { isSocialPublishingVisible, isRetryablePublishCode } from "@/lib/social/metaSpecs";
import { PublishRefusal } from "@/lib/social/publishDesign";
import { startFacebookReel, startInstagramReel } from "@/lib/social/publishVideo";
import { FACEBOOK_REEL_SPEC, checkForPlatform, fitAllowed, frameUrl, renditionUrl, withCode } from "@/lib/marketing/videoPost";
import { cloudName, loadOwnedVideoPost, publishRowShape, renditionState } from "@/lib/marketing/videoPostServer";
import * as metaGraphClient from "@/lib/social/metaGraphClient";
import * as mockMetaGraphClient from "@/lib/social/mockMetaGraphClient";

const PLATFORMS = new Set(["instagram", "facebook"]);

function refuse(status, code, error, extra) {
  return NextResponse.json({ error, code, ...(extra || {}) }, { status });
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return refuse(404, "not_found", "Not found");

  const [connection, history] = await Promise.all([
    getMetaConnection(member.companyId),
    db.socialPublish.findMany({ where: { videoPostId: post.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  const appConfigured = metaAppConfigured();
  return NextResponse.json({
    visible: isSocialPublishingVisible({ isDemo: connection.mock, appConfigured }),
    mock: Boolean(connection.mock),
    connected: Boolean(connection?.connected),
    reason: connection?.connected ? null : connection?.reason || "not_built",
    pageName: connection?.pageName || null,
    instagramUsername: connection?.instagramUsername || null,
    hasInstagram: Boolean(connection?.instagramUserId),
    history: history.map(publishRowShape),
  });
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return refuse(err.status || 403, "forbidden", "Only owners, admins, or supervisors can publish marketing content");
  }
  const { response: unpaid } = await planOrRefusal(member, "publish this video");
  if (unpaid) return unpaid;

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return refuse(404, "not_found", "Not found");

  let body;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "bad_request", "Invalid request body.");
  }
  const platforms = Array.isArray(body?.platforms) ? [...new Set(body.platforms.filter((p) => PLATFORMS.has(p)))] : [];
  if (platforms.length === 0) return refuse(400, "no_platforms", "Choose Instagram, Facebook or both.");

  const connection = await getMetaConnection(member.companyId);
  if (!isSocialPublishingVisible({ isDemo: connection.mock, appConfigured: metaAppConfigured() })) {
    return refuse(403, "not_available", "Facebook & Instagram publishing isn't available yet.");
  }
  if (!connection.connected) return refuse(409, "not_connected", "Connect Facebook & Instagram in Settings first.");

  // The shape first: nothing is sent in a shape nobody chose.
  if (!fitAllowed(post.fit, post)) return refuse(409, "not_vertical", "This clip isn't 9:16. Choose Fit or Crop first.");

  const videoUrl = renditionUrl({ cloudName: cloudName(), publicId: post.videoPublicId, fit: post.fit });
  const state = await renditionState(post);
  if (state !== "ready") {
    return refuse(409, "rendition_not_ready", "The video is still being prepared. Try again in a moment.", { rendition: state });
  }
  const coverFrame = frameUrl({ cloudName: cloudName(), publicId: post.videoPublicId, fit: post.fit, offsetMs: post.coverOffsetMs });

  const isMock = Boolean(connection.mock);
  const client = isMock ? mockMetaGraphClient : metaGraphClient;
  const results = {};

  for (const platform of platforms) {
    const check = checkForPlatform(platform, post);
    if (!check.ok) {
      results[platform] = { status: "failed", code: check.errors[0], errors: check.errors, limits: check.limits, retryable: false };
      continue;
    }
    if (platform === "facebook") {
      // Meta's own 30-a-day Reels limit, counted from what FieldQuo sent.
      // Posts made elsewhere count too — Meta's own refusal covers those.
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sent = await db.socialPublish.count({
        where: { companyId: member.companyId, platform: "facebook", mediaType: "reel", createdAt: { gte: since }, status: { in: ["publishing", "published"] } },
      });
      if (sent >= FACEBOOK_REEL_SPEC.dailyLimit) {
        results.facebook = { status: "rate_limited", code: "reel_daily_limit", retryable: false };
        continue;
      }
    }

    const row = await db.socialPublish.create({
      data: {
        companyId: member.companyId,
        videoPostId: post.id,
        ratioKey: `video_${post.fit}`,
        platform,
        mediaType: "reel",
        caption: post.caption || "",
        imageUrl: post.coverMode === "image" && platform === "instagram" && post.coverImageUrl ? post.coverImageUrl : coverFrame,
        videoUrl,
        isMock,
        status: "pending",
      },
    });

    try {
      if (platform === "instagram") {
        const { containerId } = await startInstagramReel({ connection, post, videoUrl, client });
        await db.socialPublish.update({ where: { id: row.id }, data: { status: "container_created", externalContainerId: containerId } });
        results.instagram = { id: row.id, status: "container_created" };
      } else {
        const { videoId } = await startFacebookReel({ connection, post, videoUrl, client });
        await db.socialPublish.update({ where: { id: row.id }, data: { status: "publishing", externalContainerId: videoId } });
        results.facebook = { id: row.id, status: "publishing" };
      }
    } catch (err) {
      results[platform] = await failRow(row, err, platform);
    }
  }

  await recordActivity(member, {
    action: "marketing.social_publish",
    entityType: "settings",
    entityId: post.id,
    summary: `Sent the video "${post.name}" to ${platforms.join(" and ")}`,
    metadata: { platforms, results: Object.fromEntries(Object.entries(results).map(([k, v]) => [k, v.status])), kind: "video" },
  }).catch(() => {});

  return NextResponse.json({ results });
}

async function failRow(row, err, platform) {
  if (err instanceof PublishRefusal) {
    const status = err.code === "rate_limited" ? "rate_limited" : "failed";
    await db.socialPublish.update({
      where: { id: row.id },
      data: { status, errorMessage: withCode(err.code, err.metaDetail || err.message), externalContainerId: err.containerId || null },
    });
    return {
      id: row.id,
      status,
      code: err.code,
      errors: err.errors || null,
      retryable: typeof err.retryable === "boolean" ? err.retryable : isRetryablePublishCode(err.code),
      meta: err.meta || null,
      metaDetail: err.metaDetail || null,
    };
  }
  console.error("[video-posts/publish]", platform, err);
  await db.socialPublish.update({
    where: { id: row.id },
    data: {
      status: "failed",
      errorMessage: `[unexpected] Unexpected error: ${String(err?.name || "Error")}: ${String(err?.message || "")
        .replace(/access_token=[^&\s"']+/gi, "access_token=[redacted]")
        .replace(/OAuth [A-Za-z0-9]+/g, "OAuth [redacted]")
        .slice(0, 500)}`,
    },
  });
  return { id: row.id, status: "failed", code: "unexpected", retryable: true, meta: null };
}
