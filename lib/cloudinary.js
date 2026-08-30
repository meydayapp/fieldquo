// lib/cloudinary.js
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Server-side upload from a Buffer (e.g. a generated PDF), not a browser File —
// the /api/upload route handles browser uploads via the unsigned preset instead.
export function uploadBuffer(
  buffer,
  { folder, publicId, resourceType = "auto" } = {},
) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, public_id: publicId, resource_type: resourceType },
      (err, result) => (err ? reject(err) : resolve(result)),
    );
    stream.end(buffer);
  });
}

export async function deleteAsset(publicId, resourceType = "image") {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}

/**
 * A resized variant of an image ALREADY uploaded to Cloudinary, via a URL
 * transformation. The first thing in this codebase to do that — every
 * Cloudinary URL until now was served at whatever resolution the phone that
 * took the photo happened to shoot at.
 *
 * ══ Why this exists ═════════════════════════════════════════════════════
 *
 * lib/ai/images.js sends an estimator's own site photo to OpenAI as the
 * reference for an image EDIT. That endpoint can only ever emit at 1024 or
 * 1536px — every pixel in a 12–48MP original above what the model can output
 * is pure waste, paid for twice: once uploading the source photo to Cloudinary
 * (already done, elsewhere), and again downloading it from Cloudinary into
 * this request. A ~1536px-wide variant carries every bit of detail the model
 * can use and is roughly 85% fewer pixels than a typical 12MP original for the
 * transfer this function feeds.
 *
 * `w_<width>,c_limit` never upscales and never crops — a photo already
 * narrower than `width` comes back unchanged, and the aspect ratio is
 * preserved either way. `q_auto,f_auto` do the same for the bytes on the wire.
 *
 * ══ Pure string surgery, on purpose ════════════════════════════════════
 *
 * This only understands URLs Cloudinary itself produced — which is every photo
 * and document URL in the product today, all built from `secure_url`. A URL
 * that doesn't contain `/upload/` is returned UNCHANGED rather than mangled:
 * a resize helper that silently corrupts a foreign URL is worse than no
 * helper, and the caller would rather fetch a full-size image than a broken
 * one.
 */
export function resizedUrl(url, { width = 1536 } = {}) {
  if (typeof url !== "string") return url;
  const marker = "/upload/";
  const i = url.indexOf(marker);
  if (i === -1) return url;

  const head = url.slice(0, i + marker.length);
  const tail = url.slice(i + marker.length);
  const w = Math.max(1, Math.round(Number(width) || 1536));
  // Valid immediately after `/upload/` whatever already follows it — a
  // version segment (`v169.../`) or an existing transformation both still
  // parse correctly with ours inserted in front.
  return `${head}w_${w},c_limit,q_auto,f_auto/${tail}`;
}

export { cloudinary };
