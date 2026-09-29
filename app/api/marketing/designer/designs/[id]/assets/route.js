// app/api/marketing/designer/designs/[id]/assets/route.js
//
// POST — upload ONE rendered carousel slide (a JPEG the browser rasterised
// from the design) and get back a signed receipt for it. The publish routes
// take a list of these instead of ten images in one body — see
// lib/marketing/slideAssets.js for why, and why the receipt is signed.
//
// Uploading a slide publishes nothing and approves nothing: every gate
// (approval, caption, placeholders, the destination's format) runs again on
// the publish request that uses the receipt. It is refused here only for
// what this route can already know — who is asking, whose design, and
// whether the pixels have the proportions of the format they claim to be.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { requirePermission } from "@/lib/permissions";
import { uploadBuffer } from "@/lib/cloudinary";
import { ratio as ratioByKey } from "@/lib/marketing/ratios";
import { matchesRatio } from "@/lib/marketing/destinations";
import { signSlideAsset, slideAssetSecret } from "@/lib/marketing/slideAssets";
import { isJpeg } from "@/lib/tiktok/specs";

// One slide; the same ceiling the publish routes use for their one image.
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "user:manage");
  } catch (err) {
    return NextResponse.json(
      { error: "Only owners, admins, or supervisors can publish marketing content" },
      { status: err.status || 403 },
    );
  }

  const design = await db.marketingDesign.findFirst({ where: { id, companyId: member.companyId }, select: { id: true } });
  if (!design) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!slideAssetSecret()) {
    return NextResponse.json({ error: "Image uploads aren't configured on this deployment." }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const ratioKey = typeof body?.ratioKey === "string" && ratioByKey(body.ratioKey) ? body.ratioKey : null;
  if (!ratioKey) return NextResponse.json({ error: "A valid ratioKey is required." }, { status: 400 });

  const dataUrl = typeof body?.imageBase64 === "string" ? body.imageBase64 : "";
  const base64 = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
  if (!base64) return NextResponse.json({ error: "An image is required." }, { status: 400 });
  if (base64.length > (MAX_UPLOAD_BYTES * 4) / 3) return NextResponse.json({ error: "Image is too large." }, { status: 413 });
  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return NextResponse.json({ error: "Couldn't read the image data." }, { status: 400 });
  }
  if (!buffer.length || buffer.length > MAX_UPLOAD_BYTES) return NextResponse.json({ error: "Image is too large." }, { status: 413 });
  // Instagram and TikTok both take JPEG; the editor rasterises JPEG for every
  // publish, so anything else is a request the editor did not build.
  if (!isJpeg(buffer)) return NextResponse.json({ error: "The image must be a JPEG." }, { status: 400 });

  let uploaded;
  try {
    uploaded = await uploadBuffer(buffer, {
      folder: `fieldquo/companies/${member.companyId}/social`,
      resourceType: "image",
    });
  } catch (err) {
    console.error("[designer/assets] upload failed", err?.message);
    return NextResponse.json({ error: "Couldn't upload the image. Nothing was posted." }, { status: 502 });
  }

  // Cloudinary's measurement, not the browser's: the wrong shape is refused
  // before a receipt for it exists.
  if (!matchesRatio(ratioKey, uploaded.width, uploaded.height)) {
    return NextResponse.json(
      { error: "wrong_format", message: "That image isn't the size this format needs. Nothing was posted." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    token: signSlideAsset({
      companyId: member.companyId,
      designId: design.id,
      url: uploaded.secure_url,
      width: uploaded.width,
      height: uploaded.height,
      bytes: uploaded.bytes,
      ratioKey,
    }),
    width: uploaded.width,
    height: uploaded.height,
  });
}
