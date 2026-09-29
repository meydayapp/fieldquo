// app/api/marketing/designer/designs/[id]/tiktok/route.js
//
// GET — whether TikTok posting is available and connected for this company,
// the design's approval and caption, and its TikTok history. No TikTok call:
// the editor asks this on mount to decide whether to draw the TikTok button,
// and creator_info is fetched by the composer itself when it opens
// (app/api/tiktok/creator-info).
//
// POST — one Direct Post of the design's 9:16 layout as a TikTok PHOTO post.
//
// ══ Every gate the Facebook/Instagram route has, and TikTok's own ══════════
//
// Mirrors app/api/marketing/designer/designs/[id]/publish/route.js on purpose,
// so posting to TikTok can never be the easier door:
//   - user:manage, and a paid plan (planOrRefusal);
//   - a LIVE approval, re-derived from the rows on this request
//     (lib/marketing/approvalFingerprint.js);
//   - the caption is the design's; a body carrying a different one is refused.
// Then TikTok's:
//   - creator_info fetched AGAIN here, never trusted from the browser, and the
//     requested privacy level must be one it returns (and "Only me" while
//     FieldQuo is unaudited);
//   - comment only when the creator allows comments; the disclosure rules
//     (lib/tiktok/specs.js validateTikTokPost);
//   - the image is a JPEG within TikTok's photo limits.
//
// ══ How TikTok gets the image ════════════════════════════════════════════
//
// PULL_FROM_URL only fetches from a verified URL prefix, so the Cloudinary
// URL cannot be handed over. The JPEG is uploaded to Cloudinary (the same
// store the Meta flow uses), a TikTokPublish row is written, and TikTok is
// given https://www.fieldquo.com/api/tiktok/media/<signed token>.jpg — a token
// naming that row and company, valid for an hour, which
// app/api/tiktok/media/[token] checks before streaming the bytes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { planOrRefusal } from "@/lib/signup/planGate";
import { requirePermission } from "@/lib/permissions";
import { recordActivity } from "@/lib/activity/log";
import { uploadBuffer } from "@/lib/cloudinary";
import { getAppOrigin } from "@/lib/appUrl";
import { approvalState } from "@/lib/marketing/approvalFingerprint";
import { tiktokAudited, tiktokConfigured } from "@/lib/tiktok/config";
import { queryCreatorInfo, initPhotoPost } from "@/lib/tiktok/client";
import { getLiveTikTokConnection, getTikTokAccess } from "@/lib/tiktok/connection";
import { makeMediaToken, mediaUrlFor, signingRootKey } from "@/lib/tiktok/signing";
import {
  TIKTOK_RATIO_KEY,
  buildPhotoPostBody,
  classifyTikTokError,
  creatorPostingBlock,
  isJpeg,
  validateTikTokPhoto,
  validateTikTokPost,
} from "@/lib/tiktok/specs";

// Same ceiling the Meta route uses, checked before the base64 is decoded.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

async function loadOwned(companyId, id) {
  const design = await db.marketingDesign.findUnique({
    where: { id },
    include: {
      layouts: { select: { ratioKey: true, json: true, width: true, height: true } },
      approvedBy: { select: { name: true } },
    },
  });
  if (!design || design.companyId !== companyId) return null;
  return design;
}

/** The history the composer shows — never the stored Cloudinary URL. */
function historyShape(row) {
  return {
    id: row.id,
    status: row.status,
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

  const design = await loadOwned(member.companyId, id);
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const available = tiktokConfigured();
  const [connection, history] = available
    ? await Promise.all([
        getLiveTikTokConnection(member.companyId),
        db.tikTokPublish.findMany({ where: { designId: id }, orderBy: { createdAt: "desc" }, take: 10 }),
      ])
    : [null, []];

  return NextResponse.json({
    available,
    connected: Boolean(connection),
    account: connection ? { displayName: connection.displayName || null, avatarUrl: connection.avatarUrl || null } : null,
    audited: tiktokAudited(),
    approval: {
      state: approvalState(design, design.layouts).state,
      approvedAt: design.approvedAt,
      approvedByName: design.approvedBy?.name || null,
    },
    caption: design.caption || "",
    history: history.map(historyShape),
  });
}

function refuse(status, code, message, extra) {
  return NextResponse.json({ error: message, code, ...(extra || {}) }, { status });
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

  const design = await loadOwned(member.companyId, id);
  if (!design) return refuse(404, "not_found", "Not found");

  if (!tiktokConfigured()) return refuse(403, "not_available", "TikTok posting isn't available yet.");

  let body;
  try {
    body = await request.json();
  } catch {
    return refuse(400, "bad_request", "Invalid request body.");
  }

  // ── Approval, exactly as the Facebook/Instagram route checks it ──────────
  const approval = approvalState(design, design.layouts);
  if (!approval.ok) {
    return refuse(
      409,
      approval.state === "stale" ? "approval_stale" : "not_approved",
      approval.state === "stale"
        ? "This design changed after it was approved. Review it and approve it again before posting."
        : "This design hasn't been approved yet. Review it and approve it before posting.",
      { approval: { state: approval.state } },
    );
  }

  const caption = design.caption ? design.caption.trim() : "";
  if (typeof body?.caption === "string" && body.caption.trim() !== caption) {
    return refuse(409, "approval_stale", "The caption changed since this was approved. Save it on the design and approve it again.", {
      approval: { state: "stale" },
    });
  }

  // Express consent — the Post button sends it; a request without it is not
  // the person agreeing to TikTok's terms, whatever else it carries.
  if (body?.consent !== true) return refuse(400, "consent_required", "Confirm you agree to TikTok's terms to post.");

  const choice = {
    privacyLevel: typeof body?.privacyLevel === "string" ? body.privacyLevel : null,
    allowComment: body?.allowComment === true,
    commercialOn: body?.commercialOn === true,
    yourBrand: body?.yourBrand === true,
    brandedContent: body?.brandedContent === true,
  };

  // ── The image ────────────────────────────────────────────────────────────
  const dataUrl = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  if (!base64) return refuse(400, "no_image", "An image is required.");
  if (base64.length > (MAX_UPLOAD_BYTES * 4) / 3) return refuse(413, "file_too_large", "Image is too large.");
  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return refuse(400, "bad_image", "Couldn't read the image data.");
  }
  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) return refuse(413, "file_too_large", "Image is too large.");
  // TikTok photo posts take JPEG or WebP; the composer rasterises JPEG, so
  // anything else is a request this route did not build.
  if (!isJpeg(buffer)) return refuse(400, "file_format_check_failed", "The image must be a JPEG.");

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

  const check = validateTikTokPost({
    ...choice,
    description: caption,
    creatorInfo: info.data,
    audited: tiktokAudited(),
  });
  if (!check.ok) {
    // privacy_not_offered is the browser holding an option TikTok no longer
    // offers this creator — the same fact TikTok's own
    // privacy_level_option_mismatch reports, so the same sentence.
    const code = check.errors.includes("privacy_not_offered") ? "privacy_level_option_mismatch" : check.errors[0];
    return refuse(400, code, "This post can't be sent with those settings.", { errors: check.errors });
  }

  let uploaded;
  try {
    uploaded = await uploadBuffer(buffer, {
      folder: `fieldquo/companies/${member.companyId}/social`,
      resourceType: "image",
    });
  } catch (err) {
    console.error("[designer/tiktok] upload failed", err?.message);
    return refuse(502, "upload_failed", "Couldn't upload the image. Nothing was posted.");
  }

  const photo = validateTikTokPhoto({ width: uploaded.width, height: uploaded.height, bytes: uploaded.bytes });
  if (!photo.ok) {
    return refuse(400, "picture_size_check_failed", "This image is larger than TikTok accepts.", { errors: photo.errors });
  }

  const row = await db.tikTokPublish.create({
    data: {
      companyId: member.companyId,
      designId: design.id,
      openId: access.connection.openId,
      creatorNickname: info.data.nickname || null,
      ratioKey: TIKTOK_RATIO_KEY,
      caption,
      imageUrl: uploaded.secure_url,
      width: uploaded.width ?? null,
      height: uploaded.height ?? null,
      privacyLevel: choice.privacyLevel,
      disableComment: !choice.allowComment,
      brandContentToggle: choice.commercialOn && choice.brandedContent,
      brandOrganicToggle: choice.commercialOn && choice.yourBrand,
      status: "pending",
    },
  });

  const token = makeMediaToken({
    rootKey: signingRootKey(),
    publishId: row.id,
    companyId: member.companyId,
    nowSeconds: Date.now() / 1000,
  });
  const postBody = buildPhotoPostBody({
    ...choice,
    description: caption,
    photoUrl: mediaUrlFor(getAppOrigin(request), token),
  });

  const init = await initPhotoPost({ accessToken: access.accessToken, body: postBody });
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
    await logActivity(member, design, "failed", choice.privacyLevel);
    return NextResponse.json({ result: { id: row.id, status: "failed", ...c } });
  }

  await db.tikTokPublish.update({
    where: { id: row.id },
    data: { status: "processing", publishId: String(init.data.publish_id) },
  });
  await logActivity(member, design, "processing", choice.privacyLevel);

  return NextResponse.json({ result: { id: row.id, status: "processing" } });
}

async function logActivity(member, design, outcome, privacyLevel) {
  await recordActivity(member, {
    action: "marketing.social_publish",
    entityType: "settings",
    entityId: design.id,
    summary:
      outcome === "failed"
        ? `Attempted to post "${design.name}" to TikTok`
        : `Sent "${design.name}" to TikTok`,
    metadata: { platforms: ["tiktok"], results: { tiktok: outcome }, privacyLevel },
  }).catch(() => {});
}
