// app/api/marketing/video-posts/[id]/route.js
//
// GET   — one video post, with whether its rendition (the 9:16 MP4 that is
//         actually sent) exists yet, and every platform's pre-post checks.
// PATCH — name, caption, fit, cover. Changing the fit asks Cloudinary for
//         that rendition; the original upload is never touched, so switching
//         back and forth loses nothing.
//
// There is no DELETE in this first version: the posts it made keep pointing
// at it (SetNull would survive it, but "delete" was not in the approved scope
// and a video post holds nothing but its own clip). docs/ROADMAP.md lists it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { FITS, VIDEO_CAPTION_MAX, fitAllowed } from "@/lib/marketing/videoPost";
import {
  isOwnCoverUrl,
  loadOwnedVideoPost,
  renditionState,
  requestRendition,
  shapeVideoPost,
} from "@/lib/marketing/videoPostServer";

function refuse(status, code, error, extra) {
  return NextResponse.json({ error, code, ...(extra || {}) }, { status });
}

function manager(member) {
  try {
    requirePermission(member.role, "user:manage");
    return null;
  } catch (err) {
    return refuse(err.status || 403, "forbidden", "Only owners, admins, or supervisors can manage marketing");
  }
}

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = manager(member);
  if (denied) return denied;

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return refuse(404, "not_found", "Not found");

  // No rendition is asked about for a shape nobody may post (a non-9:16 clip
  // still on "original") — there is nothing to be ready.
  const rendition = fitAllowed(post.fit, post) ? await renditionState(post) : null;
  return NextResponse.json(shapeVideoPost(post, { rendition }));
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = manager(member);
  if (denied) return denied;

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return refuse(404, "not_found", "Not found");

  let body;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "bad_request", "Invalid request body.");
  }

  const data = {};
  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
    if (!name) return refuse(400, "name_required", "A name is required.");
    data.name = name;
  }
  if (body?.caption !== undefined) {
    const caption = typeof body.caption === "string" ? body.caption : "";
    // Stored up to Instagram's cap; each platform's own limit is checked
    // again before posting (lib/marketing/videoPost.js checkForPlatform).
    if ([...caption].length > VIDEO_CAPTION_MAX) return refuse(400, "caption_too_long", "The caption is too long.");
    data.caption = caption;
  }
  if (body?.fit !== undefined) {
    if (!FITS.includes(body.fit)) return refuse(400, "bad_fit", "Unknown shape.");
    // "original" only for a clip that is already 9:16 — never a way to send
    // the wrong shape.
    if (!fitAllowed(body.fit, post)) return refuse(400, "not_vertical", "This clip isn't 9:16. Choose Fit or Crop.");
    data.fit = body.fit;
  }
  if (body?.coverMode !== undefined) {
    if (!["frame", "image"].includes(body.coverMode)) return refuse(400, "bad_cover", "Unknown cover.");
    data.coverMode = body.coverMode;
  }
  if (body?.coverOffsetMs !== undefined) {
    const ms = Number(body.coverOffsetMs);
    if (!Number.isInteger(ms) || ms < 0 || ms >= post.durationSec * 1000) {
      return refuse(400, "cover_offset_out_of_range", "Pick a moment inside the clip.");
    }
    data.coverOffsetMs = ms;
  }
  if (body?.coverImageUrl !== undefined) {
    if (body.coverImageUrl === null || body.coverImageUrl === "") data.coverImageUrl = null;
    else if (!isOwnCoverUrl(member.companyId, body.coverImageUrl)) {
      return refuse(400, "cover_image_not_ours", "Upload the cover picture again.");
    } else data.coverImageUrl = body.coverImageUrl;
  }
  const nextMode = data.coverMode ?? post.coverMode;
  const nextImage = data.coverImageUrl !== undefined ? data.coverImageUrl : post.coverImageUrl;
  if (nextMode === "image" && !nextImage) return refuse(400, "cover_image_missing", "Upload a cover picture first.");

  if (data.fit && data.fit !== post.fit) {
    try {
      await requestRendition(post.videoPublicId, data.fit);
    } catch (err) {
      console.error("[video-posts] rendition request failed:", err?.message);
      return refuse(503, "cloudinary_unavailable", "Couldn't prepare that shape just now. Try again in a minute.");
    }
  }

  const updated = Object.keys(data).length
    ? await db.videoPost.update({ where: { id: post.id }, data })
    : post;
  const rendition = fitAllowed(updated.fit, updated) ? await renditionState(updated) : null;
  return NextResponse.json(shapeVideoPost(updated, { rendition }));
}
