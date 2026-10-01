// app/api/marketing/video-posts/[id]/tiktok/route.js
//
// GET  — is TikTok posting available and connected, the video post's caption,
//        and its TikTok history. Read by the SAME composer a design uses
//        (app/components/designer/TikTokPublishModal.js, video mode).
// POST — a Direct Post of the video (POST /v2/post/publish/video/init/), or
//        (body.mode "draft") the video sent to the creator's TikTok inbox
//        (POST /v2/post/publish/inbox/video/init/, scope video.upload).
//
// Mirrors app/api/marketing/designer/designs/[id]/tiktok/route.js — the same
// user:manage + paid-plan gates, creator_info fetched AGAIN on this request,
// the privacy level checked against it, express consent required — plus a
// video's own: the clip must be 9:16 in the shape being sent, its rendition
// must exist, and its length must be within the creator's own
// max_video_post_duration_sec (developers.tiktok.com/doc/
// content-sharing-guidelines: "API clients must check if the duration of the
// to-be-posted video follows the max_video_post_duration_sec").
//
// The caption posted is the one saved on the video post; a body carrying a
// different one is refused, so what the composer showed is what is sent.
//
// TikTok pulls the MP4 from https://www.fieldquo.com/api/tiktok/media/<signed
// token>.mp4 (a TikTokPublish row, mediaType "VIDEO"), which streams the
// Cloudinary rendition — PULL_FROM_URL only fetches from a verified prefix.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { planOrRefusal } from "@/lib/signup/planGate";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { getAppOrigin } from "@/lib/appUrl";
import { tiktokAudited, tiktokConfigured } from "@/lib/tiktok/config";
import { initVideoDraft, initVideoPost, queryCreatorInfo } from "@/lib/tiktok/client";
import { getLiveTikTokConnection, getTikTokAccess } from "@/lib/tiktok/connection";
import { makeMediaToken, mediaUrlFor, signingRootKey } from "@/lib/tiktok/signing";
import { POST_MODES, classifyTikTokError, creatorPostingBlock, validateTikTokDraft, validateTikTokPost } from "@/lib/tiktok/specs";
import {
  buildTikTokVideoDraftBody,
  buildTikTokVideoPostBody,
  checkForPlatform,
  fitAllowed,
  frameUrl,
  renditionSize,
  sendUrl,
} from "@/lib/marketing/videoPost";
import { cloudName, loadOwnedVideoPost, renditionState } from "@/lib/marketing/videoPostServer";
import { videoApprovalState } from "@/lib/marketing/approvalFingerprint";
import { claimHeld } from "@/lib/marketing/videoArchive";

function refuse(status, code, message, extra) {
  return NextResponse.json({ error: message, code, ...(extra || {}) }, { status });
}

function historyShape(row) {
  return {
    id: row.id,
    status: row.status,
    postMode: row.postMode,
    privacyLevel: row.privacyLevel,
    creatorNickname: row.creatorNickname,
    failReason: row.failReason,
    publicPostId: row.publicPostId,
    createdAt: row.createdAt,
    publishedAt: row.publishedAt,
  };
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const available = tiktokConfigured();
  const [connection, history] = available
    ? await Promise.all([
        getLiveTikTokConnection(member.companyId),
        db.tikTokPublish.findMany({ where: { videoPostId: post.id }, orderBy: { createdAt: "desc" }, take: 10 }),
      ])
    : [null, []];

  return NextResponse.json({
    available,
    connected: Boolean(connection),
    account: connection ? { displayName: connection.displayName || null, avatarUrl: connection.avatarUrl || null } : null,
    audited: tiktokAudited(),
    // The video post's own approval — the composer refuses to post without
    // it, as for a design (lib/marketing/approvalFingerprint.js).
    approval: { state: videoApprovalState(post).state, approvedAt: post.approvedAt || null },
    caption: post.caption || "",
    history: history.map(historyShape),
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
  const { response: unpaid } = await planOrRefusal(member, "post to TikTok");
  if (unpaid) return unpaid;

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return refuse(404, "not_found", "Not found");
  if (!tiktokConfigured()) return refuse(403, "not_available", "TikTok posting isn't available yet.");

  let body;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "bad_request", "Invalid request body.");
  }

  if (post.uploadState !== "ready") return refuse(409, "rendition_not_ready", "The clip is still being uploaded or prepared.");
  // The same two refusals as the Instagram/Facebook route: TikTok would pull
  // a file Cloudinary no longer has (lib/marketing/videoArchive.js).
  if (post.archivedAt) return refuse(409, "archived", "This video is archived. Restore it before posting it again.");
  if (claimHeld(post)) return refuse(409, "archiving", "This video is being moved to the archive. Try again in a few minutes.");
  // ── Approval, exactly as the Instagram/Facebook route checks it ──────────
  const approval = videoApprovalState(post);
  if (!approval.ok) {
    return refuse(
      409,
      approval.state === "stale" ? "approval_stale" : "not_approved",
      approval.state === "stale"
        ? "This video post changed after it was approved. Review it and approve it again before posting."
        : "This video post hasn't been approved yet. Review it and approve it before posting.",
      { approval: { state: approval.state } },
    );
  }

  const caption = post.caption ? post.caption.trim() : "";
  if (typeof body?.caption === "string" && body.caption.trim() !== caption) {
    return refuse(409, "caption_changed", "The caption changed. Reopen this window to post the saved caption.");
  }
  if (body?.consent !== true) return refuse(400, "consent_required", "Confirm you agree to TikTok's terms to post.");

  const isDraft = body?.mode === "draft";
  const choice = {
    privacyLevel: typeof body?.privacyLevel === "string" ? body.privacyLevel : null,
    allowComment: body?.allowComment === true,
    allowDuet: body?.allowDuet === true,
    allowStitch: body?.allowStitch === true,
    commercialOn: body?.commercialOn === true,
    yourBrand: body?.yourBrand === true,
    brandedContent: body?.brandedContent === true,
  };

  // ── The video: 9:16, prepared ────────────────────────────────────────────
  if (!fitAllowed(post.fit, post)) return refuse(409, "not_vertical", "This clip isn't 9:16. Choose Fit or Crop first.");
  const state = await renditionState(post);
  if (state !== "ready") return refuse(409, "rendition_not_ready", "The video is still being prepared. Try again in a moment.");

  // ── A token, and creator_info fetched fresh on THIS request ──────────────
  const access = await getTikTokAccess(member.companyId);
  if (!access.connected) {
    const c = classifyTikTokError({ code: access.reason === "not_connected" ? "not_connected" : "token_expired" });
    return NextResponse.json({ result: { status: "failed", ...c } });
  }
  const info = await queryCreatorInfo({ accessToken: access.accessToken });
  if (!info.ok) {
    return NextResponse.json({
      result: { status: "failed", ...classifyTikTokError(info), blocked: Boolean(creatorPostingBlock(info.code)) },
    });
  }

  const videoCheck = checkForPlatform("tiktok", post, { maxVideoPostDurationSec: info.data.maxVideoPostDurationSec });
  if (!videoCheck.ok) {
    return refuse(400, videoCheck.errors[0], "This video can't be posted to TikTok as it is.", { errors: videoCheck.errors, limits: videoCheck.limits });
  }
  const check = isDraft
    ? validateTikTokDraft({ description: caption, creatorInfo: info.data, mediaKind: "video" })
    : validateTikTokPost({ ...choice, description: caption, creatorInfo: info.data, audited: tiktokAudited(), mediaKind: "video" });
  if (!check.ok) {
    const code = check.errors.includes("privacy_not_offered") ? "privacy_level_option_mismatch" : check.errors[0];
    return refuse(400, code, "This post can't be sent with those settings.", { errors: check.errors });
  }

  const cn = cloudName();
  const videoUrl = sendUrl(post, cn);
  const size = renditionSize(post.fit, post);
  const coverMs = post.coverMode === "frame" ? post.coverOffsetMs : 0;

  const row = await db.tikTokPublish.create({
    data: {
      companyId: member.companyId,
      videoPostId: post.id,
      openId: access.connection.openId,
      creatorNickname: info.data.nickname || null,
      ratioKey: `video_${post.fit}`,
      caption: isDraft ? "" : caption,
      mediaType: "VIDEO",
      videoUrl,
      imageUrl: frameUrl({ cloudName: cn, publicId: post.videoPublicId, fit: post.fit, offsetMs: coverMs }),
      width: size?.width ?? null,
      height: size?.height ?? null,
      postMode: isDraft ? POST_MODES.draft : POST_MODES.post,
      privacyLevel: isDraft ? "" : choice.privacyLevel,
      disableComment: isDraft ? false : !choice.allowComment,
      brandContentToggle: isDraft ? false : choice.commercialOn && choice.brandedContent,
      brandOrganicToggle: isDraft ? false : choice.commercialOn && choice.yourBrand,
      status: "pending",
    },
  });

  const token = makeMediaToken({ rootKey: signingRootKey(), publishId: row.id, companyId: member.companyId, nowSeconds: Date.now() / 1000 });
  const pullUrl = mediaUrlFor(getAppOrigin(request), token, "mp4");
  const init = isDraft
    ? await initVideoDraft({ accessToken: access.accessToken, body: buildTikTokVideoDraftBody({ videoUrl: pullUrl }) })
    : await initVideoPost({
        accessToken: access.accessToken,
        body: buildTikTokVideoPostBody({ ...choice, title: caption, videoUrl: pullUrl, coverTimestampMs: coverMs }),
      });

  if (!init.ok || !init.data?.publish_id) {
    const c = init.ok ? classifyTikTokError({ code: "internal_error" }) : classifyTikTokError(init);
    await db.tikTokPublish.update({
      where: { id: row.id },
      data: {
        status: "failed",
        failReason: String(init.ok ? "no_publish_id" : init.code).slice(0, 80),
        errorDetail: init.ok ? "TikTok returned no publish_id" : `${init.message || ""}${init.logId ? ` (log ${init.logId})` : ""}`.slice(0, 500) || null,
      },
    });
    await logActivity(member, post, "failed", isDraft ? "draft" : choice.privacyLevel);
    return NextResponse.json({ result: { id: row.id, status: "failed", ...c } });
  }

  await db.tikTokPublish.update({ where: { id: row.id }, data: { status: "processing", publishId: String(init.data.publish_id) } });
  await logActivity(member, post, "processing", isDraft ? "draft" : choice.privacyLevel);
  return NextResponse.json({ result: { id: row.id, status: "processing" } });
}

async function logActivity(member, post, outcome, privacyLevel) {
  await recordActivity(member, {
    action: "marketing.social_publish",
    entityType: "settings",
    entityId: post.id,
    summary: outcome === "failed" ? `Attempted to post the video "${post.name}" to TikTok` : `Sent the video "${post.name}" to TikTok`,
    metadata: { platforms: ["tiktok"], results: { tiktok: outcome }, privacyLevel, kind: "video" },
  }).catch(() => {});
}
