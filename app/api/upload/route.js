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
import { classifyMedia } from "@/lib/media/validate";

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

  // Shared boundary — same rules the public self-quote upload enforces, plus
  // SVG (allowLogo) which only this authenticated branding path may accept.
  // A video now goes through cleanly as resource_type "video".
  const verdict = classifyMedia(file, { allowLogo: true });
  if (!verdict.ok) {
    return NextResponse.json({ error: verdict.error }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Foldered per company so one tenant's assets are easy to find, audit and
    // delete without trawling a flat global namespace.
    const uploaded = await uploadBuffer(buffer, {
      folder: `fieldquo/companies/${member.companyId}`,
      resourceType: verdict.resourceType,
    });

    return NextResponse.json({
      url: uploaded.secure_url,
      publicId: uploaded.public_id,
      kind: verdict.kind,
    });
  } catch (err) {
    console.error("[upload] Cloudinary error:", err?.message);
    return NextResponse.json(
      { error: explainCloudinaryError(err) },
      { status: 500 },
    );
  }
}

/**
 * Turn Cloudinary's message into one naming the fix.
 *
 * "Invalid cloud_name fieldquo" is accurate and useless: it repeats the value
 * back without saying what a cloud name IS or where to find the right one.
 * The trap is specific and easy to fall into — Cloudinary lets you NAME an API
 * key, so an account with a key called "fieldquo" makes "fieldquo" look like
 * the obvious cloud name. It isn't; the cloud name is the product environment,
 * and on a free account it's usually an auto-generated string like `dq3x9k2mv`.
 */
function explainCloudinaryError(err) {
  const message = err?.message || "";
  const httpCode = err?.http_code || err?.error?.http_code;

  // "cloud_name mismatch" (a 401) is a DIFFERENT trap from "invalid cloud_name":
  // the cloud name is a real Cloudinary environment, but the api_key/secret in
  // use belong to a *different* environment than CLOUDINARY_CLOUD_NAME. The
  // classic version of this is setting CLOUDINARY_CLOUD_NAME to "fieldquo" — the
  // name given to an API key — instead of the auto-generated environment id.
  if (/cloud_name mismatch/i.test(message)) {
    return (
      `Cloudinary says the credentials don't belong to cloud "${process.env.CLOUDINARY_CLOUD_NAME}". ` +
      "The cloud name is the environment id shown top-left in the Cloudinary console " +
      "(often an auto-generated string like dq3x9k2mv), NOT the label on your API key. " +
      "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET from the " +
      "same environment's CLOUDINARY_URL (cloudinary://key:secret@CLOUD_NAME) and redeploy."
    );
  }

  // A bare 403 with no parseable body — the SDK surfaces it as
  // "Server returned unexpected status code - 403". Cloudinary uses this for a
  // revoked/disabled API key or a suspended/locked account, not for a wrong
  // signature (that's a 401). Naming it beats leaking the SDK's opaque string.
  if (httpCode === 403 || /unexpected status code - 403/i.test(message)) {
    return (
      "Cloudinary refused the upload (403). That usually means the API key was " +
      "revoked or the account is disabled/over quota — not a wrong file. Open the " +
      "Cloudinary console, confirm the account is active and the API key is enabled, " +
      "then check CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET / CLOUDINARY_CLOUD_NAME in " +
      "Vercel match that same active environment (and match what you rotated to)."
    );
  }

  if (/invalid cloud_name/i.test(message)) {
    return (
      `Cloudinary rejected the cloud name "${process.env.CLOUDINARY_CLOUD_NAME}". ` +
      "That's the product environment name, not the name you gave your API key — " +
      "find it at the top left of the Cloudinary console, or in Settings → API Keys " +
      "as the last part of the CLOUDINARY_URL (cloudinary://key:secret@CLOUD_NAME). " +
      "Update CLOUDINARY_CLOUD_NAME and redeploy."
    );
  }

  // 401 from Cloudinary means the key/secret pair doesn't match the cloud —
  // most often a secret copied from a different product environment.
  if (/invalid signature|unknown api_key|disabled account/i.test(message)) {
    return (
      "Cloudinary rejected the API credentials. Check CLOUDINARY_API_KEY and " +
      "CLOUDINARY_API_SECRET belong to the same product environment as " +
      "CLOUDINARY_CLOUD_NAME."
    );
  }

  if (/file size too large|maximum/i.test(message)) {
    return "Cloudinary rejected the file as too large for this plan.";
  }

  return message || "Upload failed";
}
