// lib/hr/documentFile.js
//
// Where a person's HR file lives in Cloudinary, and the one way to open it.
//
// ══ Why an HR file is not a public URL any more (owner, 2026-09-29) ════════
//
// A WorkerDocument is a photo ID, a TD1 with a SIN on it, a trade ticket.
// Until this change it was uploaded like a job photo — delivery type
// "upload", a permanent public URL — so anybody who ever held the link (a
// forwarded screenshot, a browser history, a proxy log) could open that
// person's ID forever, signed in or not. Now:
//
//   - a new file is uploaded as delivery type "authenticated" (purpose "hr",
//     lib/media/directUpload.js), whose plain URL Cloudinary answers 401;
//   - every link in the app is GET /api/hr/documents/[id]/open, which applies
//     the HR file's own two doors (lib/hr/access.js) and then redirects to a
//     signed link that expires in OPEN_LINK_TTL_SECONDS;
//   - a file uploaded before this is moved in place, not copied and not
//     deleted, by scripts/migrate-hr-documents-private.mjs.
//
// ══ Why a download link and not a signed delivery URL ══════════════════════
//
// A signed "authenticated" delivery URL (`s--sig--`) never expires: it is a
// permanent public link again, only longer. Expiring delivery URLs are
// Cloudinary's token-based access, a paid add-on this account (Free plan)
// does not have. The download endpoint (utils.private_download_url) takes
// `expires_at` on every plan and, with attachment=false, serves the file
// inline. Checked against the live account on 2026-09-29: 206 inline inside
// the window, 401 once it has passed.
//
// ══ Why no new columns ═════════════════════════════════════════════════════
//
// fileUrl is Cloudinary's own secure_url, and it already spells the three
// things a signature needs: /<cloud>/<resource_type>/<type>/v<n>/<public_id>.
// A copy of them in columns would be a second truth free to disagree with the
// first. The migration rewrites `/upload/` to `/authenticated/` on the row as
// it moves the asset, so the URL stays the one truth.
//
// ══ Both states open ═══════════════════════════════════════════════════════
//
// The open route signs whatever type the URL names — "upload" for a file not
// yet migrated, "authenticated" after — so the route can ship first and the
// migration run after it, with no window in which a link is broken.
//
// Pure: no SDK, no database, no imports — lib/hr/documents.js (which a
// "use client" panel imports) reads it. The permission decision that uses
// it is lib/hr/documentOpen.js; scripts/check-hr.mjs executes both.

/** The delivery type every HR file is stored under once it is private. */
export const HR_DELIVERY_TYPE = "authenticated";

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
 * Where a document's file is, for THIS company — or why it can't be opened.
 *
 * The folder check is the tenant boundary for signing: the open route signs
 * whatever the row names, so a row must only ever name a file inside its own
 * company's folder. parseWorkerDocumentBody enforces the same at write time;
 * this is the second lock, for rows written before it did.
 *
 * @returns {{ ok: true, resourceType, deliveryType, publicId, format, tail, version }
 *         | { ok: false, code: "unreadable"|"other_company" }}
 */
export function hrFileLocation(fileUrl, { cloudName, companyId } = {}) {
  const parsed = parseCloudinaryFileUrl(fileUrl, { cloudName });
  if (!parsed) return { ok: false, code: "unreadable" };
  if (typeof companyId !== "string" || !companyId || !parsed.publicId.startsWith(`fieldquo/companies/${companyId}/`)) {
    return { ok: false, code: "other_company" };
  }
  return { ok: true, ...parsed };
}

/** Is this URL a private upload inside this company's folder? What a NEW
 *  WorkerDocument must hold. */
export function isPrivateHrFileUrl(fileUrl, { cloudName, companyId } = {}) {
  const at = hrFileLocation(fileUrl, { cloudName, companyId });
  return at.ok && at.deliveryType === HR_DELIVERY_TYPE;
}

/**
 * The same file's URL once it is private — what the migration writes back
 * after moving the asset. Null when the URL isn't one of ours.
 */
export function authenticatedUrlFor(fileUrl, { cloudName } = {}) {
  const p = parseCloudinaryFileUrl(fileUrl, { cloudName });
  if (!p) return null;
  return `https://res.cloudinary.com/${cloudName}/${p.resourceType}/${HR_DELIVERY_TYPE}/v${p.version}/${p.tail}`;
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

