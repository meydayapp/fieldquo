// app/api/marketing/video-posts/route.js
//
// GET  — this company's video posts, newest first (the Marketing Designer
//        index lists them under their campaign), plus the month's allowance.
// POST — start a video post: check the month's allowance, sign the upload,
//        and make the post row that the clip will arrive into. Body:
//        { campaignId, name, fit?, file: { type, size, width?, height?, durationSec? } }
//        `file` is what the browser read from the clip before uploading it
//        (lib/media/videoProbe.js) — a declaration, never stored as a fact.
//
// ══ The order of things (owner, 2026-09-29) ══════════════════════════════════
//
//   1. Allowance (lib/marketing/videoAllowance.js). Refused BEFORE a byte is
//      sent, with the count and — for an owner or admin — the way to add a
//      pack. A clip already on its way in holds its slot.
//   2. Sign (lib/marketing/videoUpload.js). The signature carries the
//      incoming transformation: Cloudinary stores the clip at 1080p, made
//      9:16 in the same pass when the person already chose Fit or Crop, and
//      trimmed at 2:30. Never the 4K original.
//   3. The browser sends the file in chunks straight to Cloudinary
//      (lib/media/chunkedUpload.js). Cloudinary converts it in the background
//      (`async`) and tells /api/marketing/video-posts/cloudinary-notify when
//      it's done; the video screen asks Cloudinary itself if that never comes.
//   4. On arrival the post becomes "ready" and is counted — once.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { getAppOrigin } from "@/lib/appUrl";
import { uploadScope } from "@/lib/media/directUpload";
import { cloudinaryUploadUrl, planLimits, uploadsConfigured } from "@/lib/media/directUploadServer";
import { CHUNK_BYTES, planVideoUpload, signedUploadFields } from "@/lib/marketing/videoUpload";
import { VIDEO_PURPOSE, allowanceBody, loadVideoAllowance, shapeVideoPost } from "@/lib/marketing/videoPostServer";
import { phoneGateResponse } from "@/lib/trial/phoneGate";

/** Where Cloudinary posts the finished upload. Declared in check:route-callers. */
const NOTIFY_PATH = "/api/marketing/video-posts/cloudinary-notify";

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

  const [posts, allowance] = await Promise.all([
    db.videoPost.findMany({ where: { companyId: member.companyId }, orderBy: { updatedAt: "desc" }, take: 100 }),
    loadVideoAllowance(member.companyId),
  ]);
  return NextResponse.json({
    videoPosts: posts.map((p) => shapeVideoPost(p)),
    allowance: allowanceBody(allowance, member),
  });
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const denied = manager(member);
  if (denied) return denied;
  // A card-free trial verifies a mobile before this spends FieldQuo money
  // (lib/trial/phoneGate.js). Paid companies never reach a refusal here.
  const phoneGate = await phoneGateResponse(member, "video_post");
  if (phoneGate) return phoneGate;
  if (!uploadsConfigured()) return refuse(503, "cloudinary_unavailable", "Uploads aren't available right now.");

  let body;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "bad_request", "Invalid request body.");
  }
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  const campaignId = typeof body?.campaignId === "string" ? body.campaignId : "";
  const fit = body?.fit === "pad" || body?.fit === "crop" ? body.fit : null;
  if (!name) return refuse(400, "name_required", "A name is required.");
  if (!campaignId) return refuse(400, "campaign_required", "campaignId is required");

  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, { campaignId });
  if (notOurs) return notOurs;

  // ── 1. The month's allowance ────────────────────────────────────────────
  const allowance = await loadVideoAllowance(member.companyId);
  if (!allowance.decision.ok) {
    return refuse(409, "allowance_used", "You've used all of this month's videos.", {
      allowance: allowanceBody(allowance, member),
    });
  }

  // ── 2. Sign ─────────────────────────────────────────────────────────────
  const scope = uploadScope("member", { companyId: member.companyId, purpose: VIDEO_PURPOSE });
  const origin = getAppOrigin(request);
  const plan = planVideoUpload(body?.file, scope, {
    fit,
    planLimits: await planLimits(),
    notificationUrl: `${origin}${NOTIFY_PATH}`,
  });
  if (!plan.ok) {
    return refuse(plan.code === "file_too_large" ? 413 : 400, plan.code, "This clip can't be uploaded.", {
      ...(plan.maxBytes ? { maxBytes: plan.maxBytes } : {}),
    });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  // The declared shape and length are written so the row is never half-empty,
  // and are OVERWRITTEN with Cloudinary's own numbers on arrival; nothing
  // reads them before then (shapeVideoPost answers state only).
  const declared = body?.file || {};
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
  const post = await db.videoPost.create({
    data: {
      companyId: member.companyId,
      campaignId,
      name,
      videoUrl: `https://res.cloudinary.com/${cloudName}/video/upload/${plan.publicId}.mp4`,
      videoPublicId: plan.publicId,
      width: Math.round(num(declared.width)),
      height: Math.round(num(declared.height)),
      durationSec: num(declared.durationSec),
      fit: "original",
      preparedAs: plan.preparedAs,
      uploadState: "uploading",
      createdById: member.userId || null,
    },
  });

  return NextResponse.json(
    {
      post: shapeVideoPost(post),
      upload: {
        url: cloudinaryUploadUrl("video"),
        fields: signedUploadFields(plan.params, {
          apiKey: process.env.CLOUDINARY_API_KEY,
          secret: process.env.CLOUDINARY_API_SECRET,
        }),
        chunkBytes: CHUNK_BYTES,
        maxBytes: plan.maxBytes,
      },
      allowance: allowanceBody({ ...allowance, reserved: allowance.reserved + 1 }, member),
    },
    { status: 201 },
  );
}
