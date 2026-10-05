// lib/media/fileHrefs.js
//
// The paths that open a stored file — the client and platform doors of
// lib/media/fileOpen.js, which says why they exist. Pure and import-free, so
// a "use client" screen (the platform console) builds exactly the path the
// route reads, and the server builds the same one for a client page or email.
//
// The staff door's links are NOT here: they carry an HMAC bound to the
// reader and are only ever minted server-side (fileOpen.js staffFileLink).

export const STAFF_FILE_PATH = "/api/files/open";

/** A row id as it may appear in a path: a cuid, a uuid. */
export const FILE_ROW_ID = /^[A-Za-z0-9_-]{1,64}$/;

// Portal tokens and share tokens are 32 random bytes, base64url.
export const FILE_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;

/** Which kinds each client token may open. */
export const CLIENT_FILE_KINDS = Object.freeze({
  portal: Object.freeze(["waiver", "guide"]),
  quote: Object.freeze(["document"]),
});

/** The path a client page or email links to. Null for anything malformed. */
export function clientFileHref({ scope, token, kind, id } = {}) {
  if (!CLIENT_FILE_KINDS[scope]?.includes(kind)) return null;
  if (typeof token !== "string" || !FILE_TOKEN.test(token) || typeof id !== "string" || !FILE_ROW_ID.test(id)) return null;
  if (scope === "portal") return `/api/portal/${token}/files/${kind}/${id}`;
  return `/api/public/quotes/${token}/files/${kind}/${id}`;
}

export const PLATFORM_FILE_KINDS = Object.freeze(["migration-document", "payout-proof"]);

/** The path FieldQuo's own console links to. */
export function platformFileHref(kind, id) {
  if (!PLATFORM_FILE_KINDS.includes(kind) || typeof id !== "string" || !FILE_ROW_ID.test(id)) return null;
  return `/api/platform/files/open?k=${kind}&id=${id}`;
}
