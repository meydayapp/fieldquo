// lib/company/chat/cloudinaryFiles.js
//
// The three things the chat's file routes ask of Cloudinary, in one place:
// an expiring link to a private file, a thumbnail of a private photo, and a
// copy of a private photo into the company's (public) job-photo folder.
//
// Server-only: it holds the SDK and the API secret. The store and the pure
// rules never import it; the routes inject what they need, the way
// app/api/hr/documents/[id]/open injects the HR signer.
import { cloudinary } from "@/lib/cloudinary";
import { signedOpenLink } from "@/lib/hr/documentFile";

/** Is Cloudinary configured well enough to sign anything? */
export function cloudinaryReady() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
}

/**
 * A link to the ORIGINAL file that stops working after five minutes — the
 * same download endpoint and expiry the HR files use (lib/hr/documentFile.js
 * says why a download link and not a signed delivery URL: the latter never
 * expires on this plan).
 */
export function expiringFileLink(location) {
  return signedOpenLink(location, {
    sign: (publicId, format, options) => cloudinary.utils.private_download_url(publicId, format, options),
  }).url;
}

/** The thumbnail's long side, in pixels — a 2× tile in a 4-up grid on a phone. */
export const THUMB_PX = 640;

/**
 * A signed delivery URL for a small JPEG of a private photo. It NEVER leaves
 * the server: a signed authenticated delivery URL does not expire, so the
 * route fetches it and streams the bytes, and the browser only ever sees the
 * route's own reader-bound, expiring link.
 */
export function thumbnailSourceUrl(location) {
  return cloudinary.url(location.publicId, {
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
    format: "jpg",
    transformation: [{ width: THUMB_PX, height: THUMB_PX, crop: "limit" }, { quality: "auto" }],
  });
}

/**
 * Copy a private chat photo into a PUBLIC job-photo asset under `publicId`
 * and hand back its URL. Cloudinary fetches the source itself (a signed
 * delivery URL of the original, used once, server to server). overwrite:
 * false, so a second save of the same photo returns the asset already there.
 */
export async function copyPhotoToJob(location, { publicId }) {
  const source = cloudinary.url(location.publicId, {
    resource_type: "image",
    type: "authenticated",
    sign_url: true,
    secure: true,
    ...(location.format ? { format: location.format } : {}),
  });
  const result = await cloudinary.uploader.upload(source, {
    public_id: publicId,
    resource_type: "image",
    type: "upload",
    overwrite: false,
  });
  return result?.secure_url || null;
}
