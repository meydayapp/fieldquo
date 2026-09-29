// app/api/marketing/video-posts/[id]/route.js
//
// GET   — one video post, with whether its rendition (the 9:16 MP4 that is
//         actually sent) exists yet, every platform's pre-post checks, and its
//         approval. A clip still on its way in is looked for at Cloudinary
//         here (at most every 15 s) — the fallback when the upload
//         notification never reaches us (lib/marketing/videoPostServer.js
//         checkArrival).
// PATCH — name, caption, fit, cover. Changing the fit of a clip stored at an
//         unknown shape asks Cloudinary for that rendition. A clip made 9:16
//         on arrival keeps its shape: the 4K original was never kept, which
//         is the point (lib/marketing/videoPost.js, "On arrival").
//
// Changing the caption, the cover or the shape WITHDRAWS an approval — the
// same rule as a design's words (designs/[id]/approval): a sign-off belongs to
// what was on the screen when it was given.
//
// There is no DELETE in this first version: the posts it made keep pointing
// at it (SetNull would survive it, but "delete" was not in the approved scope
// and a video post holds nothing but its own clip). docs/ROADMAP.md lists it.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { FITS, VIDEO_CAPTION_MAX, fitAllowed } from "@/lib/marketing/videoPost";
import {
  approverName,
  checkArrival,
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

/** What an approval signs — changing any of these withdraws it. */
const APPROVED_FIELDS = ["caption", "fit", "coverMode", "coverOffsetMs", "coverImageUrl"];

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = manager(member);
  if (denied) return denied;

  let post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return refuse(404, "not_found", "Not found");
  // A read-only support session looks and never writes — checkArrival stamps
  // the row and may settle it.
  if (member.impersonationMode !== "read_only") post = (await checkArrival(post)) || post;

  // No rendition is asked about for a shape nobody may post (a non-9:16 clip
  // still on "original") — there is nothing to be ready.
  const ready = post.uploadState === "ready";
  const rendition = ready && fitAllowed(post.fit, post) ? await renditionState(post) : null;
  return NextResponse.json(shapeVideoPost(post, { rendition, approvedByName: await approverName(post) }));
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = manager(member);
  if (denied) return denied;

  const post = await loadOwnedVideoPost(member.companyId, id);
  if (!post) return refuse(404, "not_found", "Not found");
  if (post.uploadState !== "ready") {
    return refuse(409, "upload_not_ready", "The clip is still being uploaded or prepared.");
  }

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
    // Made 9:16 on arrival: there is no other shape left to make it into.
    if (body.fit !== post.fit && post.preparedAs && post.preparedAs !== "limit") {
      return refuse(409, "shape_fixed_on_upload", "This clip was made 9:16 when it was uploaded. Upload it again to choose another shape.");
    }
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

  // ── Withdraw a standing approval when what was approved changes ─────────
  const changed = APPROVED_FIELDS.filter((k) => data[k] !== undefined && data[k] !== post[k]);
  const withdraw = Boolean(post.approvedAt) && changed.length > 0;
  if (withdraw) Object.assign(data, { approvedAt: null, approvedById: null, approvedFingerprint: null });

  const updated = Object.keys(data).length ? await db.videoPost.update({ where: { id: post.id }, data }) : post;
  if (withdraw) {
    await recordActivity(member, {
      action: "marketing.video_approval_withdrawn",
      entityType: "settings",
      entityId: post.id,
      summary: `Approval for "${post.name}" withdrawn — ${changed.join(", ")} changed`,
      metadata: { changed },
    }).catch(() => {});
  }
  const rendition = fitAllowed(updated.fit, updated) ? await renditionState(updated) : null;
  return NextResponse.json(shapeVideoPost(updated, { rendition, approvedByName: await approverName(updated) }));
}
