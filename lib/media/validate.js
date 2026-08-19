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

// Documents. PDF and nothing else, deliberately.
//
// The requirement is concrete: a cabinet company's customers arrive with an
// IKEA kitchen planner PDF and, until now, no way to send it — they were
// screenshotting pages on a phone or emailing separately, and the plan is the
// single most useful thing a quoter can be handed.
//
// Every other candidate was considered and rejected, because this allowlist is
// enforced on a PUBLIC, UNAUTHENTICATED endpoint and each entry is attack
// surface a stranger can reach:
//
//   ZIP/RAR — an archive is a container for anything, including the formats
//     rejected below. Also the classic decompression-bomb vector, and nothing
//     in the product can open one anyway.
//   DOCX/XLSX — themselves ZIP containers, and macro-bearing relatives are one
//     mistyped mime away. No customer has their kitchen plan in Word.
//   DWG/DXF — real CAD, but IKEA's planner does not emit it and no surface in
//     FieldQuo can display it. Accepting a file we can only ever show as a
//     download link nobody can open is the dead-control failure.
//
// So: one entry. Widen it when a customer actually arrives with something else,
// not in anticipation.
export const DOCUMENT_TYPES = new Set(["application/pdf"]);

// The three kinds a stored entry may claim. Every renderer switches on this, so
// it lives next to the type sets rather than being restated per component.
export const MEDIA_KINDS = new Set(["photo", "video", "document"]);

// Caps. Photos are generous enough for a raw HEIC (an 8 MB limit rejected real
// iPhone shots). Video is held at Cloudinary's free-plan ceiling so the failure
// is our clear message, not their opaque 400 after a 90-second upload on a
// driveway connection.
//
// Documents sit between the two. An IKEA planner PDF is typically 1–5 MB, and
// 20–30 MB once it carries embedded 3D renders of every elevation; 25 MB clears
// the real ones with room to spare while still bounding what an anonymous
// caller can push. It is deliberately NOT the video ceiling — nothing legitimate
// in this category is 100 MB.
export const PHOTO_MAX_BYTES = 15 * 1024 * 1024; // 15 MB
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024; // 100 MB
export const DOCUMENT_MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const MB = (n) => `${Math.round(n / (1024 * 1024))} MB`;

/**
 * Classify one file for upload.
 *
 * @param {{type?: string, size?: number}} file  a browser File, or any shape
 *   with type+size (so tests don't need a real File).
 * @param {{allowLogo?: boolean}} [opts]  allowLogo permits SVG — authenticated
 *   branding only. Defaults false: client media never accepts a vector.
 * @returns {{ ok: boolean, kind?: "photo"|"video"|"document", resourceType?: "image"|"video"|"raw", error?: string }}
 */
export function classifyMedia(file, { allowLogo = false } = {}) {
  const type = typeof file?.type === "string" ? file.type.toLowerCase() : "";
  const size = Number(file?.size);

  if (!type) {
    return { ok: false, error: "That file has no recognizable type." };
  }

  const isPhoto = PHOTO_TYPES.has(type) || (allowLogo && LOGO_EXTRA_TYPES.has(type));
  const isVideo = VIDEO_TYPES.has(type);
  const isDocument = DOCUMENT_TYPES.has(type);

  if (!isPhoto && !isVideo && !isDocument) {
    // Names what IS accepted rather than what was refused. Someone holding an
    // IKEA plan needs to read "or a PDF" here, not deduce it.
    return {
      ok: false,
      error:
        "Upload a photo (JPEG, PNG, HEIC…), a video (MP4, MOV, WebM) or a PDF.",
    };
  }

  // A missing or absurd size is a malformed upload, not a zero-byte photo we
  // should try to store. Number("") is 0, Number(undefined) is NaN — reject both.
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: "That file appears to be empty." };
  }

  const kind = isDocument ? "document" : isVideo ? "video" : "photo";
  const cap = isDocument
    ? DOCUMENT_MAX_BYTES
    : isVideo
      ? VIDEO_MAX_BYTES
      : PHOTO_MAX_BYTES;
  if (size > cap) {
    const advice = {
      video: "Trim it or upload a shorter clip.",
      photo: "Try a smaller photo.",
      document: "Try exporting the plan at a smaller size.",
    }[kind];
    const noun = kind === "document" ? "PDF" : kind;
    return { ok: false, error: `That ${noun} is larger than ${MB(cap)}. ${advice}` };
  }

  // resourceType is what Cloudinary needs; SVG is an "image" to Cloudinary.
  //
  // A PDF goes up as "raw" rather than "image". Cloudinary's own docs recommend
  // "image" so it can rasterise pages into thumbnails, and that is the right
  // call for a trusted file — but this same function guards an anonymous public
  // endpoint, and "image" means Cloudinary runs a rasteriser over a stranger's
  // PDF on every upload. "raw" stores the bytes untouched. The only thing given
  // up is a page-1 thumbnail we don't render anyway, and it matches how the app
  // already stores its own generated quote/invoice PDFs
  // (app/api/quotes/[id]/pdf/route.js).
  const resourceType = isDocument ? "raw" : isVideo ? "video" : "image";
  return { ok: true, kind, resourceType };
}

/**
 * Cloudinary serves a `raw` asset's Content-Type from the extension on its
 * public_id, and an upload_stream with no public_id gets a random one with no
 * extension at all — which comes back as application/octet-stream and makes the
 * browser download a mystery file instead of opening the plan. So documents get
 * an explicit public_id ending in .pdf.
 *
 * The id is random, never derived from the uploaded filename: public_id is a
 * path, this runs on a public endpoint, and "../" in a filename is how one
 * tenant's upload lands in another tenant's folder.
 *
 * @param {string} kind  a `kind` from classifyMedia.
 * @returns {string|undefined}  a public_id, or undefined to let Cloudinary pick.
 */
export function uploadPublicId(kind, { randomId = () => globalThis.crypto.randomUUID() } = {}) {
  return kind === "document" ? `${randomId()}.pdf` : undefined;
}

/**
 * A filename is display-only text that came from a stranger's file picker.
 * Strip any path, drop control characters, clamp the length — it is rendered
 * next to a link, so it must not be able to smuggle a newline or a 4 KB name.
 * Returns "" when there is nothing usable, and callers fall back to a label.
 */
export function safeFilename(name) {
  if (typeof name !== "string") return "";
  const base = name.split(/[/\\]/).pop() || "";
  // Control characters are stripped by codepoint, not by a literal range in the
  // source — a raw control char inside a regex literal is invisible in a diff.
  const stripped = Array.from(base).filter((ch) => {
    const c = ch.codePointAt(0);
    return c > 0x1f && c !== 0x7f;
  }).join("");
  return stripped.trim().slice(0, 120);
}

/** The `accept` attribute for a client media <input>: photos, videos and PDFs,
 * no SVG. Kept in step with the sets above — a picker that offers a type the
 * server rejects is a control that appears to work and doesn't. */
export const CLIENT_MEDIA_ACCEPT = "image/*,video/*,application/pdf";

/**
 * Normalise one stored media entry to a stable shape for display/reference.
 * A quote keeps an array of these; the UI and the PDF both read this shape, so
 * a half-populated Cloudinary result can't leak an `undefined` into a document.
 */
export function normaliseMediaEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const url = typeof entry.url === "string" ? entry.url : entry.secure_url;
  if (typeof url !== "string" || !/^https:\/\//i.test(url)) return null; // https only — no javascript: or http
  // An allowlist, not a two-way branch. The old `=== "video" ? … : "photo"`
  // silently relabelled a document as a photo, which is precisely how a PDF
  // ends up as the src of an <img>.
  const kind = MEDIA_KINDS.has(entry.kind) ? entry.kind : "photo";
  return {
    url,
    kind,
    publicId: typeof entry.publicId === "string" ? entry.publicId : entry.public_id || null,
    caption: typeof entry.caption === "string" ? entry.caption.slice(0, 300) : "",
    // Carried for documents so the tile can say "kitchen-plan.pdf" instead of a
    // random Cloudinary id. Stored for every kind rather than only documents,
    // because a conditional field is the one that goes missing after a refactor.
    filename: safeFilename(entry.filename),
  };
}

/**
 * Count a stored media list by kind.
 *
 * Three separate places need this — the lead score, the lead card's badges and
 * the AI quote review's "no photos" advice — and all three previously used
 * `clientPhotos.length`, which was correct only while the array could hold
 * nothing but photos. Writing the filter out three times is how two of them end
 * up disagreeing, so it lives here with the kinds it depends on.
 *
 * Entries without a usable URL are not counted at all. A `null` left in the
 * array is not a photo, and the naive `entry?.kind !== "document"` test counts
 * it as one — which is how a lead with two junk rows scores as though it sent
 * two photos.
 *
 * @returns {{ photos:number, videos:number, documents:number, visual:number }}
 *   `visual` is photos+videos: the two that show the actual job site, which is
 *   the distinction the review advice cares about.
 */
export function countMediaKinds(list) {
  const counts = { photos: 0, videos: 0, documents: 0, visual: 0 };
  if (!Array.isArray(list)) return counts;
  for (const entry of list) {
    // A bare string is a pre-`kind` row, and could only ever have been a photo.
    if (typeof entry === "string") {
      if (entry) {
        counts.photos++;
        counts.visual++;
      }
      continue;
    }
    if (!entry || typeof entry !== "object" || !entry.url) continue;
    if (entry.kind === "document") counts.documents++;
    else if (entry.kind === "video") {
      counts.videos++;
      counts.visual++;
    } else {
      counts.photos++;
      counts.visual++;
    }
  }
  return counts;
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
