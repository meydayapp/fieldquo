// lib/media/signedFile.js
//
// Opening a file we stored in Cloudinary, when Cloudinary will not hand it
// to a browser by its plain URL.
//
// ══ Why this exists (2026-10-04) ═══════════════════════════════════════════
//
// The production Cloudinary account refuses to DELIVER a PDF from a public
// URL: res.cloudinary.com/<cloud>/raw/upload/…pdf (and image/upload/…pdf)
// answers 401. That is Cloudinary's account-level "PDF and ZIP delivery"
// restriction, and it is the default on a new account. A raw file stored
// with no extension is delivered, but as 206 application/octet-stream with
// the random id as its name — a quote PDF filed on a job downloads as
// "Q-1001-v1" that nothing on a phone will open.
//
// So every place that put a stored Cloudinary URL into an <a href> — a
// drawing on a quote, a homeowner's PDF in the inbox, a signed waiver in the
// portal, the company documents beside a proposal, a prep guide in an email
// — showed a link that looked like it worked and didn't.
//
// The download API is not subject to that restriction:
// utils.private_download_url signs a link to
// api.cloudinary.com/v1_1/<cloud>/<resource_type>/download, on every plan,
// for "upload" and "authenticated" files alike. lib/hr/documentFile.js has
// opened HR files that way since 2026-09-29 (and says why a download link
// rather than a signed delivery URL). This file is that parser and signer,
// lifted out so every file — not just an HR one — is opened the same way;
// lib/hr/documentFile.js re-exports it, unchanged for its callers.
//
// ══ The tenant fence ═══════════════════════════════════════════════════════
//
// Signing is power: a signed link opens ANY asset in the account. So a URL
// is only signed when (1) it is on res.cloudinary.com under OUR cloud name,
// (2) it parses as exactly the delivery URL Cloudinary itself returns — no
// query, no transformation, no "..", no escapes — and (3) its public_id sits
// in a folder that names the company asking. The folders are every one our
// uploaders write a tenant's file into (TENANT_FOLDER_ROOTS below; each
// names the uploader). A file in any other folder — FieldQuo's own sales
// inbox, marketing images, another company's — is never signed for a tenant.
//
// The URL is never one a browser sent. The routes that use this
// (app/api/files/open, the portal and quote file routes) look a ROW up by id,
// inside the company, and sign the URL the row holds.
//
// Pure: no SDK, no database, no imports. A "use client" panel can import the
// HR re-export, and scripts/check-file-open.mjs executes all of it.

/** How long an open link works. Long enough to load a large PDF on a bad
 *  connection; short enough that a copied link is dead by the time it is
 *  pasted anywhere that matters. */
export const OPEN_LINK_TTL_SECONDS = 300;

const RESOURCE_TYPES = new Set(["image", "video", "raw"]);
const DELIVERY_TYPES = new Set(["upload", "authenticated"]);
// A public_id segment as FieldQuo mints them (folder names, cuids, uuids,
// Cloudinary's random ids, "<uuid>.pdf"). Anything else — percent-escapes,
// "..", a transformation — is not a URL this app stored.
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,199}$/;

/**
 * Read one of OUR Cloudinary delivery URLs back into what signing needs.
 *
 * @returns {{ resourceType, deliveryType, version, publicId, format, tail } | null}
 *   `publicId` without the extension for an image or video (Cloudinary's own
 *   form; the extension is the delivery format), WITH it for a raw file,
 *   whose id is the file name. `tail` is everything after the version, as
 *   stored, so a rewritten URL keeps it byte for byte.
 */
export function parseCloudinaryFileUrl(url, { cloudName } = {}) {
  if (!cloudName || typeof url !== "string" || url.length > 1000) return null;
  // Read the string as written, BEFORE the URL parser tidies it: WHATWG URL
  // resolves "a/../b" and decodes nothing, so "../" in a stored URL would
  // arrive below as a clean path that is not the one that was stored. A
  // stored URL never contains a dot-segment, an escape or a backslash.
  if (/\.\.|%|\\/.test(url)) return null;
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname !== "res.cloudinary.com") return null;
  if (u.username || u.password || u.port || u.search || u.hash) return null;
  const parts = u.pathname.split("/");
  if (parts[0] !== "" || parts[1] !== cloudName) return null;
  const [, , resourceType, deliveryType, version, ...rest] = parts;
  if (!RESOURCE_TYPES.has(resourceType) || !DELIVERY_TYPES.has(deliveryType)) return null;
  if (!/^v\d{1,16}$/.test(version || "")) return null;
  if (rest.length === 0 || !rest.every((s) => SEGMENT.test(s) && !s.includes(".."))) return null;

  const tail = rest.join("/");
  let publicId = tail;
  let format = "";
  if (resourceType !== "raw") {
    const m = /^(.*)\.([A-Za-z0-9]{2,5})$/.exec(tail);
    if (m) {
      publicId = m[1];
      format = m[2].toLowerCase();
    }
  }
  return { resourceType, deliveryType, version: version.slice(1), publicId, format, tail };
}

/**
 * A signed link to one file that stops working after OPEN_LINK_TTL_SECONDS.
 *
 * @param sign  cloudinary.utils.private_download_url (injected)
 */
export function signedOpenLink(location, { sign, now = Date.now() } = {}) {
  const expiresAt = Math.floor(now / 1000) + OPEN_LINK_TTL_SECONDS;
  const url = sign(location.publicId, location.format || "", {
    resource_type: location.resourceType,
    type: location.deliveryType,
    expires_at: expiresAt,
    // Inline, as the public URL opened before: a photo ID shows in the tab,
    // it does not drop into Downloads on a shared office computer.
    attachment: false,
  });
  return { url, expiresAt };
}

/** The host every signed link must point at — Cloudinary's API, our cloud.
 *  A signer that returned anything else is not one we trust to fetch. */
export function signedLinkBase(cloudName) {
  return `https://api.cloudinary.com/v1_1/${cloudName}/`;
}

// ── The tenant folders ──────────────────────────────────────────────────────
//
// Every folder a company's own file is written under, with the uploader that
// writes it. A new uploader with a new folder must be added here, or its
// files will (correctly, and visibly) refuse to open — never the reverse.
//
//   fieldquo/companies/<id>/   lib/media/directUpload.js uploadScope (every
//                              browser upload: quotes, plans, jobs, receipts,
//                              documents, portal, leads…) and the legacy
//                              /api/upload, waivers (lib/waivers/service.js)
//   fieldquo/<id>/             the filed quote / contract / invoice PDFs and
//                              prep guides (lib/jobs/documentAutofile.js,
//                              lib/prepGuide/send.js, the quote and invoice
//                              pdf routes)
//   fieldquo/satellite/<id>/   lib/measure/satelliteCapture.js
//   messaging/<id>/            inbound customer media (lib/messaging/mediaFetch.js)
//   mailbox/<id>/              a connected mailbox's attachments (lib/mailbox/attachments.js)
//   crew/<id>/                 the crew inbox's re-hosted media (lib/crew/inbox.js)
export const TENANT_FOLDER_ROOTS = Object.freeze([
  "fieldquo/companies/",
  "fieldquo/",
  "fieldquo/satellite/",
  "messaging/",
  "mailbox/",
  "crew/",
]);

const COMPANY_ID = /^[A-Za-z0-9_-]{1,64}$/;
// Ids that would turn "fieldquo/<id>/" into ANOTHER root — "fieldquo/
// companies/" is every company's folder. A cuid can never be one of these;
// the check is here so a malformed id fails closed rather than wide open.
const RESERVED_IDS = new Set(["companies", "satellite"]);

/** The public_id prefixes that belong to one company. Empty for an id that
 *  is not a real company id. */
export function tenantFolderPrefixes(companyId) {
  if (typeof companyId !== "string" || !COMPANY_ID.test(companyId) || RESERVED_IDS.has(companyId)) return [];
  return TENANT_FOLDER_ROOTS.map((root) => `${root}${companyId}/`);
}

/**
 * Where a stored file is, for THIS company — or why it can't be opened.
 *
 * @returns {{ ok: true, resourceType, deliveryType, publicId, format, tail, version }
 *         | { ok: false, code: "unreadable"|"other_company" }}
 */
export function tenantFileLocation(fileUrl, { cloudName, companyId } = {}) {
  const parsed = parseCloudinaryFileUrl(fileUrl, { cloudName });
  if (!parsed) return { ok: false, code: "unreadable" };
  const prefixes = tenantFolderPrefixes(companyId);
  if (!prefixes.length || !prefixes.some((p) => parsed.publicId.startsWith(p))) {
    return { ok: false, code: "other_company" };
  }
  return { ok: true, ...parsed };
}

// FieldQuo's OWN files (not a tenant's) are fenced by their exact folder
// instead: a payout batch's receipt lives in fieldquo/platform/payouts/<batch>/
// (lib/sales/payoutProofRules.js proofFolderFor), and only that batch's
// folder is ever signed for that batch.
const PLATFORM_PREFIX = /^fieldquo\/platform\/(?:[A-Za-z0-9_-]{1,64}\/){1,3}$/;

/**
 * Where one of FieldQuo's own files is, inside exactly `prefix`.
 * @returns same shape as tenantFileLocation
 */
export function platformFileLocation(fileUrl, { cloudName, prefix } = {}) {
  const parsed = parseCloudinaryFileUrl(fileUrl, { cloudName });
  if (!parsed) return { ok: false, code: "unreadable" };
  if (typeof prefix !== "string" || !PLATFORM_PREFIX.test(prefix) || !parsed.publicId.startsWith(prefix)) {
    return { ok: false, code: "other_folder" };
  }
  return { ok: true, ...parsed };
}

// ── What the bytes are ──────────────────────────────────────────────────────

const TYPE_BY_EXTENSION = Object.freeze({
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  svg: "image/svg+xml",
  txt: "text/plain",
  csv: "text/csv",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  wav: "audio/wav",
  amr: "audio/amr",
  zip: "application/zip",
});
const EXTENSION_BY_TYPE = Object.freeze(
  Object.entries(TYPE_BY_EXTENSION).reduce((acc, [ext, type]) => (acc[type] ? acc : { ...acc, [type]: ext }), {}),
);

// What a browser may render in a tab from OUR origin. Everything else is a
// download. SVG and anything that sniffs as markup are the reason: served
// inline from fieldquo.com they would run script with the app's cookies.
const INLINE_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "text/plain",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
]);

export const OCTET_STREAM = "application/octet-stream";

/** The type an extension names, or null. */
export function typeForExtension(ext) {
  const key = String(ext || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(TYPE_BY_EXTENSION, key) ? TYPE_BY_EXTENSION[key] : null;
}

/** The extension a type is saved under, or "". */
export function extensionForType(type) {
  return EXTENSION_BY_TYPE[type] || "";
}

/**
 * What the first bytes of a file say it is.
 *
 * @returns {string|null} a MIME type, "markup" for anything that starts like
 *   HTML/XML/SVG (never served as itself — see INLINE_TYPES), or null.
 */
export function sniffContentType(bytes) {
  if (!bytes || !bytes.length) return null;
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ascii = (from, to) => String.fromCharCode(...b.subarray(from, to));
  if (ascii(0, 5) === "%PDF-") return "application/pdf";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(0, 4) === "PK\u0003\u0004") return "application/zip";
  // Markup after a byte-order mark (UTF-8, or UTF-16 either way round) and
  // any whitespace is still markup.
  let from = 0;
  if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) from = 3;
  else if ((b[0] === 0xfe && b[1] === 0xff) || (b[0] === 0xff && b[1] === 0xfe)) from = 2;
  const head = ascii(from, Math.min(b.length, from + 64)).replace(/\u0000/g, "").trimStart().toLowerCase();
  if (head.startsWith("<")) return "markup";
  return null;
}

/**
 * The type to SERVE, from the bytes first and the name second.
 *
 * The bytes win when they are unambiguous — a PDF filed with no extension is
 * a PDF. A zip container (.docx, .xlsx, .pptx are all zips) takes its name's
 * type. Markup is never served as itself, whatever it is called.
 */
export function servedContentType({ sniffed, extension, storedType } = {}) {
  if (sniffed === "markup") return OCTET_STREAM;
  if (sniffed && sniffed !== "application/zip") return sniffed;
  const byName = typeForExtension(extension);
  if (byName && byName !== "image/svg+xml") return byName;
  const stored = String(storedType || "").toLowerCase().split(";")[0].trim();
  if (sniffed === "application/zip") return extensionForType(stored) && stored !== "image/svg+xml" ? stored : "application/zip";
  if (extensionForType(stored) && stored !== "image/svg+xml") return stored;
  return OCTET_STREAM;
}

/** Whether a type may be shown in the tab rather than downloaded. */
export function isInlineType(type) {
  return INLINE_TYPES.has(type);
}

/** The extension at the end of a stored location, if it has one. */
export function locationExtension(location) {
  if (!location) return "";
  if (location.format) return location.format;
  const last = String(location.tail || "").split("/").pop() || "";
  const m = /\.([A-Za-z0-9]{2,5})$/.exec(last);
  return m ? m[1].toLowerCase() : "";
}

/**
 * The name a file is saved under: the name the company (or the customer's
 * phone) gave it, made safe for a header, with the extension its type needs.
 * Never the storage id, never our name.
 */
export function downloadName(name, type) {
  let base = String(name || "")
    .normalize("NFC")
    // Control characters, quotes and path separators have no place in a
    // header value or a saved file's name.
    .replace(/[\u0000-\u001f\u007f"\\/:*?<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150)
    .trim();
  if (!base || /^\.+$/.test(base)) base = "document";
  const ext = extensionForType(type);
  if (ext) {
    const has = /\.([A-Za-z0-9]{2,5})$/.exec(base);
    const same = has && (has[1].toLowerCase() === ext || typeForExtension(has[1]) === type);
    if (!same) base = `${base}.${ext}`;
  }
  return base;
}

/**
 * A Content-Disposition value: an ASCII filename for old clients and the
 * real one, UTF-8 encoded (RFC 6266 / 5987), for every current browser.
 */
export function contentDisposition(name, { inline = true } = {}) {
  const ascii = name.replace(/[^\x20-\x7e]+/g, "-").replace(/-+/g, "-") || "document";
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
