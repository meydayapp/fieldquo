// app/api/upload/route.js
//
// Authenticated image upload, used by Settings > Branding (company logo) and
// anywhere else the app needs to put a user-supplied file on a CDN.
//
// Signed, server-side upload — NOT an unsigned preset. Two reasons:
//
//   1. Unsigned presets are designed for uploading straight from a browser,
//      where you can't keep a secret. This route already runs on the server
//      behind a session check, so there's nothing to hide from and no reason
//      to accept the weaker mode.
//   2. An unsigned preset is effectively a public write token. Anyone who
//      spots the preset name can upload to the account from anywhere.
//
// So this uses the API key/secret via lib/cloudinary.js. CLOUDINARY_UPLOAD_PRESET
// is no longer needed.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getCurrentMember } from "@/lib/currentMember";
import { uploadBuffer } from "@/lib/cloudinary";

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

export async function POST(request) {
  // Previously absent: this endpoint accepted uploads from anyone on the
  // internet, which is a free way to exhaust the Cloudinary quota.
  const member = await getCurrentMember(request);
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
    return NextResponse.json(
      {
        error:
          "Image uploads aren't configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env, then restart the dev server.",
      },
      { status: 503 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || typeof file.arrayBuffer !== "function") {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Upload a PNG, JPEG, WebP, GIF or SVG." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "That file is larger than 8 MB." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Foldered per company so one tenant's assets are easy to find, audit and
    // delete without trawling a flat global namespace.
    const uploaded = await uploadBuffer(buffer, {
      folder: `fieldquo/companies/${member.companyId}`,
      resourceType: "image",
    });

    return NextResponse.json({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
    });
  } catch (err) {
    console.error("[upload] Cloudinary error:", err?.message);
    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 },
    );
  }
}
