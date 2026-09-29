// lib/tiktok/media.js
//
// The decision behind app/api/tiktok/media/[token]: given the last path
// segment, is this TikTok's verification file, one design image TikTok may
// pull right now, or nothing at all? A function with the row lookup injected,
// so scripts/check-tiktok.mjs can drive it with a token for another company's
// row, an expired token, a finished post and a hand-edited image URL — the
// cases that decide whether this public, session-less URL leaks artwork.
import { verifyMediaToken } from "./signing";

// Only rows TikTok could still be pulling. Once a post is published or has
// failed there is no reason for its artwork to be reachable by URL at all.
export const PULLABLE_STATUSES = new Set(["pending", "processing"]);

/**
 * The stored image is always our own Cloudinary upload (the designer route
 * writes uploadBuffer's secure_url); checked anyway so the route can never be
 * turned into a fetch-anything proxy by a row somebody edited.
 */
export function isCloudinaryUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname === "res.cloudinary.com";
  } catch {
    return false;
  }
}

/**
 * @param {Object} args
 * @param {string} args.segment — the path segment after /api/tiktok/media/
 * @param {Buffer|null} args.rootKey — signingRootKey()
 * @param {number} args.nowSeconds
 * @param {{filename: string, content: string}|null} args.verificationFile
 * @param {(publishId: string) => Promise<{companyId: string, status: string, imageUrl: string, imageUrls?: string[]}|null>} args.loadRow
 * @returns {Promise<{kind: "verification", file: object} | {kind: "image", imageUrl: string} | null>}
 */
export async function resolveMediaRequest({ segment, rootKey, nowSeconds, verificationFile, loadRow }) {
  if (verificationFile && segment === verificationFile.filename) return { kind: "verification", file: verificationFile };

  const verdict = verifyMediaToken(segment, { rootKey, nowSeconds });
  if (!verdict.ok) return null;
  const row = await loadRow(verdict.publishId);
  // A valid token for company A must never open company B's row — the token
  // names both, and both must match what the database says.
  if (!row || row.companyId !== verdict.companyId) return null;
  if (!PULLABLE_STATUSES.has(row.status)) return null;
  // A token naming image i of a multi-photo post serves imageUrls[i] and
  // nothing else; a token with no index is the single photo, imageUrl.
  const imageUrl =
    verdict.index === undefined ? row.imageUrl : Array.isArray(row.imageUrls) ? row.imageUrls[verdict.index] : undefined;
  if (!isCloudinaryUrl(imageUrl)) return null;
  return { kind: "image", imageUrl };
}
