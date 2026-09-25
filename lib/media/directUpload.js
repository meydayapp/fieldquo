// lib/media/directUpload.js
//
// The rules for a file that goes from the browser STRAIGHT to Cloudinary, with
// our server signing the request before and checking the result after.
//
// ══ Why the file no longer passes through our server ═══════════════════════
//
// Every upload used to be a multipart POST to /api/upload, which then streamed
// the bytes on to Cloudinary. On Vercel that route never runs for a body over
// ~4.5 MB — the platform answers 413 at the edge — so an ordinary phone photo
// (3–12 MB) failed with "That file couldn't be uploaded" (owner report,
// 2026-09-22). 863b2479 made the refusal name the size; this makes the photo
// actually go up. The bytes now travel browser → Cloudinary, and our server
// only handles two small JSON requests either side of that.
//
// ══ What the server still decides ══════════════════════════════════════════
//
// Moving the bytes must not move the decisions. Everything that /api/upload
// enforced is still enforced here, by us, and none of it is taken from the
// browser:
//
//   BEFORE (sign): the same classifyMedia verdict, on the type and size the
//   browser declares. We mint the public_id — folder, company, purpose and a
//   random id — and sign it, so the browser cannot choose where the file
//   lands. `overwrite=false` is signed so a signature, which Cloudinary
//   honours for an hour, cannot be replayed to swap a checked file for a
//   bigger one afterwards. `allowed_formats` is signed for photos and videos
//   so Cloudinary itself refuses a file whose CONTENT is not one of them,
//   whatever the browser called it.
//
//   AFTER (verify): the browser hands back what Cloudinary told it. That is
//   a claim, not a fact. It is accepted only when (1) the public_id is one we
//   could have minted for THIS company and purpose — exact shape, no "..",
//   no other folder; (2) Cloudinary's own response signature over
//   public_id+version checks out against our API secret, which a browser
//   cannot forge; and (3) an Admin API lookup of that public_id — Cloudinary
//   answering US, authenticated, about OUR cloud — confirms the resource
//   type, the format and the byte count against the same caps. The URL we
//   store is the one the Admin API returned, never one the browser sent.
//
// ══ Why there is no "max size" in the signed params ════════════════════════
//
// Cloudinary's upload API has no parameter that caps an upload's byte size.
// Two things bound it instead: the account plan's own per-type ceiling
// (which Cloudinary enforces at upload — see effectiveCap), and the
// authoritative `bytes` in the Admin API lookup, which verify refuses above
// our cap. A file refused at verify is never saved anywhere in FieldQuo; it
// is left in Cloudinary rather than deleted (no data deletion — see
// ROADMAP), in a folder that names the company it came from.
//
// Pure except for node:crypto. No SDK, no request, no database — so
// scripts/check-direct-upload.mjs runs every rule here against hostile input.

import { createHash, timingSafeEqual } from "node:crypto";
import {
  classifyMedia,
  uploadPublicId,
  safeFilename,
  megabytes,
  PHOTO_MAX_BYTES,
  VIDEO_MAX_BYTES,
  DOCUMENT_MAX_BYTES,
  MESSAGING_DOCUMENT_MAX_BYTES,
} from "@/lib/media/validate";
import { isOurCloudinaryUrl } from "@/lib/receipts/pdf";

// ── Purposes ────────────────────────────────────────────────────────────────
//
// A staff upload names what it is FOR, and that picks the sub-folder under the
// company's own. A closed list: a purpose the browser made up lands in
// "uploads", never in a folder named by the request. The public folders
// (portal, leads) are NOT in this list — a signed-in member cannot file
// something into the folder lib/clientTickets/rules.js trusts as "the client
// sent this".
export const MEMBER_PURPOSES = Object.freeze({
  branding: "branding",
  website: "website",
  quotes: "quotes",
  invoices: "invoices",
  jobs: "jobs",
  documents: "documents",
  receipts: "receipts",
  messaging: "messaging",
  team: "team",
  designer: "designer",
  support: "support",
  safety: "safety",
  "ai-employee": "ai-employee",
});
export const DEFAULT_MEMBER_FOLDER = "uploads";

// Cloudinary's names for the formats classifyMedia's MIME sets allow. Kept in
// step with PHOTO_TYPES / VIDEO_TYPES / LOGO_EXTRA_TYPES by the check script —
// a format signed here that classifyMedia refuses (or the reverse) is the
// picker-offers-what-the-server-rejects failure.
export const PHOTO_FORMATS = Object.freeze(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif"]);
export const LOGO_FORMATS = Object.freeze(["svg"]);
export const VIDEO_FORMATS = Object.freeze(["mp4", "mov", "webm", "ogv", "ogg", "3gp"]);

// Document extensions a raw public_id may end in, per scope. uploadPublicId
// mints them from the MIME; verify accepts nothing else.
export const DOCUMENT_EXTENSIONS = Object.freeze(["pdf"]);
export const MESSAGING_DOCUMENT_EXTENSIONS = Object.freeze([
  "pdf", "txt", "doc", "xls", "ppt", "docx", "xlsx", "pptx",
]);

// A company id goes into a folder path, so it is shape-checked like one.
const COMPANY_ID = /^[A-Za-z0-9_-]{1,64}$/;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

/**
 * Where a scope's files go, and what it may accept.
 *
 * @param {"member"|"portal"|"leads"} kind
 * @returns {{ ok: true, folder, allowLogo, allowMessagingDocuments } | { ok: false }}
 */
export function uploadScope(kind, { companyId, purpose } = {}) {
  if (typeof companyId !== "string" || !COMPANY_ID.test(companyId)) return { ok: false };
  const base = `fieldquo/companies/${companyId}`;
  if (kind === "portal") {
    // lib/clientTickets/rules.js ownUploads() accepts exactly this folder.
    return { ok: true, folder: `${base}/portal`, allowLogo: false, allowMessagingDocuments: false };
  }
  if (kind === "leads") {
    return { ok: true, folder: `${base}/leads`, allowLogo: false, allowMessagingDocuments: false };
  }
  if (kind === "member") {
    const key = typeof purpose === "string" ? purpose : "";
    const segment = Object.prototype.hasOwnProperty.call(MEMBER_PURPOSES, key)
      ? MEMBER_PURPOSES[key]
      : DEFAULT_MEMBER_FOLDER;
    // allowLogo for every staff purpose, exactly as /api/upload has always
    // had it — narrowing SVG to branding alone is a separate decision, not one
    // to smuggle in behind a transport change. The messaging widening stays
    // opt-in, for the reason MESSAGING_DOCUMENT_TYPES gives.
    return {
      ok: true,
      folder: `${base}/${segment}`,
      allowLogo: true,
      allowMessagingDocuments: key === "messaging",
    };
  }
  return { ok: false };
}

/** Our cap for one kind in one scope — classifyMedia's, restated by kind. */
export function ourCap(kind, { allowMessagingDocuments = false } = {}) {
  if (kind === "document") return allowMessagingDocuments ? MESSAGING_DOCUMENT_MAX_BYTES : DOCUMENT_MAX_BYTES;
  if (kind === "video") return VIDEO_MAX_BYTES;
  return PHOTO_MAX_BYTES;
}

/**
 * The cap that actually binds: ours, or the Cloudinary plan's if lower.
 *
 * The Free plan stores images and raw files up to 10 MB and refuses larger at
 * upload. Our photo cap is 15 MB and our document cap 25 MB, so without this a
 * 12 MB photo would pass our check, spend the person's connection, and then be
 * refused by Cloudinary. With it, the refusal happens before the upload and
 * names the real number — and rises by itself when the plan does.
 *
 * `planLimits` is Cloudinary's usage().media_limits, or null when unknown (the
 * lookup failed) — in which case our cap stands and Cloudinary's own refusal
 * is the backstop, surfaced by the client helper with the sizes it gives.
 */
export function effectiveCap(kind, resourceType, { allowMessagingDocuments = false, planLimits = null } = {}) {
  const ours = ourCap(kind, { allowMessagingDocuments });
  const key = { image: "image_max_size_bytes", video: "video_max_size_bytes", raw: "raw_max_size_bytes" }[resourceType];
  const plan = Number(planLimits?.[key]);
  return Number.isFinite(plan) && plan > 0 ? Math.min(ours, plan) : ours;
}

/**
 * Cloudinary's request signature: sorted `key=value` pairs joined by `&`,
 * secret appended, hashed. Empty values are left out, as the SDK does.
 * `version` 1 is the plain form (what response signatures use); 2 escapes `&`
 * inside a value so one parameter cannot smuggle another — no value we sign
 * can contain one, but we sign the way the SDK signs.
 */
export function cloudinarySignature(params, secret, { algorithm = "sha1", version = 2 } = {}) {
  const pairs = Object.entries(params || {})
    .map(([k, v]) => [String(k), Array.isArray(v) ? v.join(",") : v])
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([k, v]) => {
      const s = `${k}=${v}`;
      return version >= 2 ? s.replace(/&/g, "%26") : s;
    });
  return createHash(algorithm).update(pairs.join("&") + String(secret || "")).digest("hex");
}

/** Constant-time string compare — a signature check must not leak by timing. */
export function sameSignature(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Plan one upload: classify what the browser declares, mint where it goes, and
 * return the parameters to sign.
 *
 * @param {{type?: string, size?: number}} file  the browser's DECLARATION —
 *   re-checked against Cloudinary's own record at verify.
 * @returns {{ ok: true, kind, resourceType, publicId, maxBytes, params, allowedFormats }
 *         | { ok: false, error, code }}
 */
export function planUpload(file, scope, { planLimits = null, now = Date.now(), randomId } = {}) {
  if (!scope?.ok || typeof scope.folder !== "string") {
    return { ok: false, code: "bad_scope", error: "Uploads aren't available here." };
  }
  const verdict = classifyMedia(file, {
    allowLogo: scope.allowLogo,
    allowMessagingDocuments: scope.allowMessagingDocuments,
  });
  if (!verdict.ok) return { ok: false, code: "rejected", error: verdict.error };

  const maxBytes = effectiveCap(verdict.kind, verdict.resourceType, {
    allowMessagingDocuments: scope.allowMessagingDocuments,
    planLimits,
  });
  const size = Number(file?.size);
  if (size > maxBytes) {
    return {
      ok: false,
      code: "too_large",
      maxBytes,
      error: `That file is ${megabytes(size)} — the most that can be uploaded here is ${megabytes(maxBytes)}. ${
        verdict.kind === "video" ? "Trim it or upload a shorter clip." : verdict.kind === "document" ? "Try exporting it at a smaller size." : "Take the photo at a smaller size, or resize it and try again."
      }`,
    };
  }

  const mint = randomId || (() => globalThis.crypto.randomUUID());
  // Documents keep uploadPublicId's `<uuid>.<ext>` (a raw asset's
  // Content-Type follows its extension). Photos and videos get a bare uuid —
  // Cloudinary appends the format itself, and an id ending in ".jpg" would be
  // delivered as ".jpg.jpg".
  const leaf = uploadPublicId(verdict.kind, { mimeType: verdict.mimeType, randomId: mint }) || mint();
  const publicId = `${scope.folder}/${leaf}`;

  const allowedFormats =
    verdict.resourceType === "image"
      ? [...PHOTO_FORMATS, ...(scope.allowLogo ? LOGO_FORMATS : [])]
      : verdict.resourceType === "video"
        ? [...VIDEO_FORMATS]
        : null; // raw: Cloudinary does not detect a format for raw files

  // Strings only — the browser posts these exactly as given, and the
  // signature is over their string form.
  const params = {
    public_id: publicId,
    timestamp: String(Math.floor(now / 1000)),
    overwrite: "false",
    ...(allowedFormats ? { allowed_formats: allowedFormats.join(",") } : {}),
  };
  return { ok: true, kind: verdict.kind, resourceType: verdict.resourceType, publicId, maxBytes, params, allowedFormats };
}

/**
 * Is this public_id one we could have minted for this scope and resource type?
 * Exact shape only: `<folder>/<uuid>` for a photo or video,
 * `<folder>/<uuid>.<allowed ext>` for a document. Anything else — another
 * company, another purpose, a nested path, "..", a trailing extension on an
 * image — is refused.
 */
export function isOwnPublicId(publicId, scope, resourceType) {
  if (typeof publicId !== "string" || !scope?.ok) return false;
  if (publicId.length > 255) return false;
  const folder = scope.folder.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (resourceType === "raw") {
    const exts = scope.allowMessagingDocuments ? MESSAGING_DOCUMENT_EXTENSIONS : DOCUMENT_EXTENSIONS;
    return new RegExp(`^${folder}/${UUID}\\.(${exts.join("|")})$`).test(publicId);
  }
  if (resourceType === "image" || resourceType === "video") {
    return new RegExp(`^${folder}/${UUID}$`).test(publicId);
  }
  return false;
}

/**
 * Shape-check what the browser relays from Cloudinary's upload answer, before
 * anything is looked up.
 *
 * @returns {{ ok: true, claim: { publicId, version, signature, resourceType } } | { ok: false, error }}
 */
export function readClaim(body) {
  const publicId = typeof body?.publicId === "string" ? body.publicId : "";
  const version = String(body?.version ?? "");
  const signature = typeof body?.signature === "string" ? body.signature.toLowerCase() : "";
  const resourceType = typeof body?.resourceType === "string" ? body.resourceType : "";
  if (!publicId || !/^\d{1,16}$/.test(version) || !/^[0-9a-f]{40}$|^[0-9a-f]{64}$/.test(signature)) {
    return { ok: false, error: "That upload's confirmation is incomplete. Upload the file again." };
  }
  if (!["image", "video", "raw"].includes(resourceType)) {
    return { ok: false, error: "That upload's confirmation is incomplete. Upload the file again." };
  }
  return { ok: true, claim: { publicId, version, signature, resourceType } };
}

/**
 * Cloudinary signs its upload answer over public_id + version with our API
 * secret (plain, version-1 form). A browser that invents a public_id — or
 * relays someone else's with a made-up version — cannot produce this.
 */
export function responseSignatureValid(claim, secret, { algorithm = "sha1" } = {}) {
  if (!secret || !claim) return false;
  const expected = cloudinarySignature(
    { public_id: claim.publicId, version: claim.version },
    secret,
    { algorithm, version: 1 },
  );
  return sameSignature(expected, String(claim.signature || "").toLowerCase());
}

const KIND_BY_RESOURCE = { image: "photo", video: "video", raw: "document" };

/**
 * The URL to store and show. The Admin API's secure_url — except a HEIC/HEIF
 * photo, which only Safari can draw: asking Cloudinary for the same asset as
 * `.jpg` makes it convert on delivery, so the <img> works in every browser
 * while the original stays stored untouched.
 */
export function deliveryUrl(asset) {
  const url = typeof asset?.secure_url === "string" ? asset.secure_url : "";
  if (asset?.resource_type === "image" && /^(heic|heif)$/i.test(String(asset?.format || ""))) {
    return url.replace(/\.(heic|heif)$/i, ".jpg");
  }
  return url;
}

/**
 * The decision after the Admin API lookup. Everything checked against the
 * record Cloudinary returned to US; the browser's claim only says which record
 * to fetch.
 *
 * @returns {{ ok: true, entry } | { ok: false, code, error }}
 */
export function judgeUploadedAsset({ claim, asset, scope, cloudName, filename }) {
  const refuse = (code, error = "That upload could not be confirmed. Upload the file again.") => ({ ok: false, code, error });
  if (!claim || !asset || !scope?.ok) return refuse("missing");
  if (!isOwnPublicId(claim.publicId, scope, claim.resourceType)) return refuse("not_ours");
  if (asset.public_id !== claim.publicId) return refuse("not_ours");
  if (asset.resource_type !== claim.resourceType) return refuse("wrong_type");
  if ((asset.type || "upload") !== "upload") return refuse("wrong_type");
  if (String(asset.version) !== String(claim.version)) return refuse("stale");

  const kind = KIND_BY_RESOURCE[asset.resource_type];
  const format = String(asset.format || "").toLowerCase();
  if (asset.resource_type === "image") {
    const allowed = [...PHOTO_FORMATS, ...(scope.allowLogo ? LOGO_FORMATS : [])];
    if (!allowed.includes(format)) {
      return refuse("wrong_format", "Upload a photo (JPEG, PNG, HEIC…), a video (MP4, MOV, WebM) or a PDF.");
    }
  } else if (asset.resource_type === "video") {
    if (!VIDEO_FORMATS.includes(format)) {
      return refuse("wrong_format", "Upload a photo (JPEG, PNG, HEIC…), a video (MP4, MOV, WebM) or a PDF.");
    }
  }

  const bytes = Number(asset.bytes);
  const cap = ourCap(kind, { allowMessagingDocuments: scope.allowMessagingDocuments });
  if (!Number.isFinite(bytes) || bytes <= 0) return refuse("empty", "That file appears to be empty.");
  if (bytes > cap) {
    return refuse("too_large", `That file is ${megabytes(bytes)} — the most that can be uploaded here is ${megabytes(cap)}.`);
  }

  const url = deliveryUrl(asset);
  // The stored URL must be our cloud's and must name this public_id — a
  // belt-and-braces check on a value that came from the Admin API itself.
  if (!isOurCloudinaryUrl(url, cloudName) || !url.includes(`/${claim.publicId}`)) return refuse("not_ours");

  return {
    ok: true,
    entry: {
      url,
      publicId: asset.public_id,
      kind,
      filename: safeFilename(filename),
      bytes,
      format: format || null,
      width: Number.isFinite(Number(asset.width)) ? Number(asset.width) : null,
      height: Number.isFinite(Number(asset.height)) ? Number(asset.height) : null,
    },
  };
}
