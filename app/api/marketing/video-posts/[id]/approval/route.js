// app/api/marketing/video-posts/[id]/approval/route.js
//
// GET    — is this video post approved, for what it says right now?
// POST   — approve it: who, when, and a fingerprint of the clip, shape, cover
//          and caption (lib/marketing/approvalFingerprint.js videoFingerprint).
// DELETE — withdraw the approval.
//
// The same gate as a design's (app/api/marketing/designer/designs/[id]/
// approval — owner, 2026-09-29: "the same approval as designs"): the same
// permission, the same three states (approved / not approved / stale), the
// same "the screen sends the fingerprint it was showing" guard against
// approving a version that changed while somebody looked. Posting to
// Instagram, Facebook or TikTok refuses without it
// (../publish/route.js, ../tiktok/route.js).
//
// Writes are refused to a read-only support session by middleware.js and
// lib/currentMember.js, like every other write.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { videoApprovalState } from "@/lib/marketing/approvalFingerprint";
import { approverName, loadOwnedVideoPost } from "@/lib/marketing/videoPostServer";

async function stateBody(post) {
  const state = videoApprovalState(post);
  return {
    state: state.state,
    fingerprint: state.current,
    approvedAt: post.approvedAt || null,
    approvedByName: await approverName(post),
  };
}

function approver(member) {
  try {
    // Same axis as posting itself — see the design approval route.
    requirePermission(member.role, "user:manage");
    return null;
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can approve marketing content", code: "forbidden" },
      { status: err.status || 403 },
    );
  }
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await stateBody(post));
}

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = approver(member);
  if (denied) return denied;

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.uploadState !== "ready") {
    return NextResponse.json(
      { error: "upload_not_ready", code: "upload_not_ready", message: "The clip is still being uploaded or prepared." },
      { status: 409 },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Optional body, as for designs.
  }

  const current = videoApprovalState(post).current;
  if (typeof body?.fingerprint === "string" && body.fingerprint && body.fingerprint !== current) {
    return NextResponse.json(
      {
        error: "changed_since_review",
        code: "changed_since_review",
        message: "This video post changed while you were reviewing it. Take another look, then approve.",
        current,
      },
      { status: 409 },
    );
  }

  const updated = await db.videoPost.update({
    where: { id: post.id },
    data: { approvedAt: new Date(), approvedById: member.userId, approvedFingerprint: current },
  });
  await recordActivity(member, {
    action: "marketing.video_approved",
    entityType: "settings",
    entityId: post.id,
    summary: `Approved video post "${post.name}" for posting`,
    metadata: { fingerprint: current },
  }).catch(() => {});
  return NextResponse.json(await stateBody(updated));
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = approver(member);
  if (denied) return denied;

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // A post already sent keeps its own copy of the URL and caption on its
  // SocialPublish / TikTokPublish row — withdrawing touches nothing that left.
  const updated = await db.videoPost.update({
    where: { id: post.id },
    data: { approvedAt: null, approvedById: null, approvedFingerprint: null },
  });
  await recordActivity(member, {
    action: "marketing.video_approval_withdrawn",
    entityType: "settings",
    entityId: post.id,
    summary: `Withdrew approval for video post "${post.name}"`,
  }).catch(() => {});
  return NextResponse.json(await stateBody(updated));
}
