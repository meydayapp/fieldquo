// app/api/marketing/video-posts/route.js
//
// GET  — this company's video posts, newest first (the Marketing Designer
//        index lists them under their campaign).
// POST — make a video post from a clip the browser has just uploaded
//        (lib/media/uploadClient.js, purpose "video"). Body:
//        { campaignId, name, publicId }.
//
// ══ What the server decides, and from what ═════════════════════════════════
//
// The browser names the clip; everything ABOUT the clip is read from
// Cloudinary here — its size, length, format and frame rate — never taken from
// the request. The public_id must be one this company's "video" upload could
// have minted (isOwnVideoId), so a post cannot be made from another company's
// clip, or from a job photo. Length is enforced here (3 s – 10 min,
// lib/marketing/videoPost.js VIDEO_POST_LIMITS); the byte cap was enforced at
// upload and is re-checked against Cloudinary's own count.
//
// A clip that is already 9:16 has its rendition requested at once; one that
// isn't gets none until the person picks "Fit" or "Crop" on the next screen —
// no transcoding is spent on a shape nobody chose.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { isOurCloudinaryUrl } from "@/lib/receipts/pdf";
import { checkUploadedVideo, isNineBySixteen } from "@/lib/marketing/videoPost";
import {
  cloudName,
  isOwnVideoId,
  lookupVideoFacts,
  requestRendition,
  shapeVideoPost,
} from "@/lib/marketing/videoPostServer";

function refuse(status, code, error, extra) {
  return NextResponse.json({ error, code, ...(extra || {}) }, { status });
}

function manager(member) {
  try {
    // Same gate as designs and publishing — lib/permissions "user:manage".
    requirePermission(member.role, "user:manage");
    return null;
  } catch (err) {
    return refuse(err.status || 403, "forbidden", "Only owners, admins, or supervisors can manage marketing");
  }
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = manager(member);
  if (denied) return denied;

  const posts = await db.videoPost.findMany({
    where: { companyId: member.companyId },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ videoPosts: posts.map((p) => shapeVideoPost(p)) });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = manager(member);
  if (denied) return denied;

  let body;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "bad_request", "Invalid request body.");
  }
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const publicId = typeof body?.publicId === "string" ? body.publicId : "";
  if (!name) return refuse(400, "name_required", "A name is required.");
  if (!campaignId) return refuse(400, "campaign_required", "campaignId is required");

  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { campaignId });
  if (notOurs) return notOurs;

  if (!isOwnVideoId(member.companyId, publicId)) {
    return refuse(403, "not_ours", "That upload could not be confirmed. Upload the clip again.");
  }

  // The facts, from Cloudinary. explicit() first (it is also how a 9:16
  // clip's rendition gets requested); the Admin API with media_metadata only
  // when explicit() left the length or frame rate out.
  let read;
  try {
    read = await requestRendition(publicId, null);
    if (!read.facts?.durationSec || !read.facts?.width) {
      const more = await lookupVideoFacts(publicId);
      read = { facts: { ...more.facts, ...Object.fromEntries(Object.entries(read.facts || {}).filter(([, v]) => v !== null)) }, secureUrl: read.secureUrl };
    }
  } catch (err) {
    console.error("[video-posts] Cloudinary read failed:", err?.error?.message || err?.message);
    return refuse(503, "cloudinary_unavailable", "The clip uploaded but couldn't be read back just now. Wait a minute and try again.");
  }

  const check = checkUploadedVideo(read.facts);
  if (!check.ok) {
    return refuse(400, check.errors[0], "This clip can't be used for a video post.", { errors: check.errors, facts: read.facts });
  }
  if (!read.secureUrl || !isOurCloudinaryUrl(read.secureUrl, cloudName())) {
    return refuse(403, "not_ours", "That upload could not be confirmed. Upload the clip again.");
  }

  const vertical = isNineBySixteen(read.facts.width, read.facts.height);
  if (vertical) {
    // Asked for now so it is usually ready by the time the caption is written.
    // A failure here is not fatal: the post screen asks again when it opens.
    await requestRendition(publicId, "original").catch((err) => {
      console.error("[video-posts] rendition request failed:", err?.message);
    });
  }

  const post = await db.videoPost.create({
    data: {
      companyId: member.companyId,
      campaignId,
      name,
      videoUrl: read.secureUrl,
      videoPublicId: publicId,
      width: Math.round(read.facts.width),
      height: Math.round(read.facts.height),
      durationSec: read.facts.durationSec,
      bytes: read.facts.bytes ? Math.round(read.facts.bytes) : null,
      format: read.facts.format,
      frameRate: read.facts.frameRate,
      fit: "original",
      createdById: member.userId || null,
    },
  });

  return NextResponse.json(shapeVideoPost(post), { status: 201 });
}
