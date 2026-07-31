// lib/media/validate.js
//
// The boundary between "a file a browser handed us" and "a file we'll pay
// Cloudinary to store and then show a homeowner". One place, because there are
// now two callers — the authenticated /api/upload (staff) and the public
// self-quote upload (a stranger in a driveway) — and they must agree on what
// counts as an acceptable photo or video. A limit enforced in one and not the
// other is the gap someone drives a 2 GB file through.
//
// Pure. No Cloudinary, no request, no imports — so it runs against hostile
// input in a check script without a network or a key.

// iPhones shoot HEIC/HEIF and .mov by default — the two formats a contractor's
// phone actually produces, and the two most likely to be wrongly rejected. Both
// are here on purpose; Cloudinary transcodes them server-side.
export const PHOTO_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

export const VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime", // .mov — iPhone default
  "video/webm",
  "video/ogg",
  "video/3gpp", // older Android cameras
]);

// SVG is allowed for the ONE authenticated case that needs it (a logo upload),
// never for client media. It's a script vector, not a photo of a sofa — no
// public/anonymous path should accept it.
export const LOGO_EXTRA_TYPES = new Set(["image/svg+xml"]);

// Caps. Photos are generous enough for a raw HEIC (an 8 MB limit rejected real
// iPhone shots). Video is held at Cloudinary's free-plan ceiling so the failure
// is our clear message, not their opaque 400 after a 90-second upload on a
// driveway connection.
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
const MB = (n) => `${Math.round(n / (1024 * 1024))} MB`;

/**
 * Classify one file for upload.
 *
 * @param {{type?: string, size?: number}} file  a browser File, or any shape
 *   with type+size (so tests don't need a real File).
 * @param {{allowLogo?: boolean}} [opts]  allowLogo permits SVG — authenticated
 *   branding only. Defaults false: client media never accepts a vector.
 * @returns {{ ok: boolean, kind?: "photo"|"video", resourceType?: "image"|"video", error?: string }}
 */
export function classifyMedia(file, { allowLogo = false } = {}) {
  const type = typeof file?.type === "string" ? file.type.toLowerCase() : "";
  const size = Number(file?.size);

  if (!type) {
    return { ok: false, error: "That file has no recognizable type." };
  }

  const isPhoto = PHOTO_TYPES.has(type) || (allowLogo && LOGO_EXTRA_TYPES.has(type));
  const isVideo = VIDEO_TYPES.has(type);

  if (!isPhoto && !isVideo) {
    return {
      ok: false,
      error: "Upload a photo (JPEG, PNG, HEIC…) or a video (MP4, MOV, WebM).",
    };
  }

  // A missing or absurd size is a malformed upload, not a zero-byte photo we
  // should try to store. Number("") is 0, Number(undefined) is NaN — reject both.
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "That file appears to be empty." };
  }

  const kind = isVideo ? "video" : "photo";
  const cap = isVideo ? VIDEO_MAX_BYTES : PHOTO_MAX_BYTES;
  if (size > cap) {
    return {
      ok: false,
      error: `That ${kind} is larger than ${MB(cap)}. ${
        isVideo ? "Trim it or upload a shorter clip." : "Try a smaller photo."
      }`,
    };
  }

  // resourceType is what Cloudinary needs; SVG is an "image" to Cloudinary.
  return { ok: true, kind, resourceType: isVideo ? "video" : "image" };
}

/** The `accept` attribute for a client media <input>: photos + videos, no SVG. */
export const CLIENT_MEDIA_ACCEPT = "image/*,video/*";

/**
 * Normalise one stored media entry to a stable shape for display/reference.
 * A quote keeps an array of these; the UI and the PDF both read this shape, so
 * a half-populated Cloudinary result can't leak an `undefined` into a document.
 */
export function normaliseMediaEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const url = typeof entry.url === "string" ? entry.url : entry.secure_url;
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return null; // https only — no javascript: or http
  const kind = entry.kind === "video" ? "video" : "photo";
  return {
    url,
    kind,
    publicId: typeof entry.publicId === "string" ? entry.publicId : entry.public_id || null,
    caption: typeof entry.caption === "string" ? entry.caption.slice(0, 300) : "",
  };
}

/** Normalise a whole array, dropping anything malformed. Cap the count so a
 * client can't attach 500 clips to one estimate request. */
export function normaliseMediaList(list, { max = 20 } = {}) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const e of list) {
    const n = normaliseMediaEntry(e);
    if (n) out.push(n);
    if (out.length >= max) break;
  }
  return out;
}
