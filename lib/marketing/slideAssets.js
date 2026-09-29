// lib/marketing/slideAssets.js
//
// A carousel's images reach the publish routes one at a time.
//
// ══ Why not all in the publish request ════════════════════════════════════
//
// A single post sends its one JPEG inside the publish POST, as it always has.
// Ten slides would be ten of them in one body — several megabytes, past what a
// Vercel function accepts (4.5 MB). So each slide is uploaded on its own
// request (app/api/marketing/designer/designs/[id]/assets), and the publish
// request carries a short SIGNED receipt per slide instead of the pixels.
//
// ══ Why signed ════════════════════════════════════════════════════════════
//
// The receipt names the Cloudinary URL and the size Cloudinary reported for
// it. The publish routes check that size against the destination's format
// (lib/marketing/destinations.js matchesRatio) and Instagram's limits, so a
// receipt the browser could write for itself would let it claim any URL at
// any size. HMAC over company, design, URL, size and expiry — minted only by
// the upload route, after Cloudinary answered — makes it a fact the server
// already established rather than a claim. The key is a labelled subkey of
// CLOUDINARY_API_SECRET: server-only, and required for the upload the
// receipt describes, so the two cannot be configured apart.
//
// Pure apart from reading that secret by default; scripts/check-design-
// templates.mjs tampers with every field.
import { createHmac, timingSafeEqual } from "node:crypto";

const LABEL = "fieldquo:designer:slide-asset:v1";
export const SLIDE_ASSET_TTL_SECONDS = 60 * 60;

function key(secret) {
  return createHmac("sha256", String(secret)).update(LABEL).digest();
}

function sign(secret, payload) {
  return createHmac("sha256", key(secret)).update(payload).digest("base64url");
}

export function slideAssetSecret() {
  return (process.env.CLOUDINARY_API_SECRET || "").trim() || null;
}

/**
 * @returns {string} `${payload}.${signature}`
 */
export function signSlideAsset({ companyId, designId, url, width, height, bytes, ratioKey, nowSeconds = Date.now() / 1000, secret = slideAssetSecret() }) {
  if (!secret) throw new Error("CLOUDINARY_API_SECRET is not set — cannot sign a slide asset.");
  const payload = Buffer.from(
    JSON.stringify({
      c: String(companyId),
      d: String(designId),
      u: String(url),
      w: Number(width) || 0,
      h: Number(height) || 0,
      b: Number(bytes) || 0,
      r: String(ratioKey),
      e: Math.floor(nowSeconds) + SLIDE_ASSET_TTL_SECONDS,
    }),
  ).toString("base64url");
  return `${payload}.${sign(secret, payload)}`;
}

/**
 * @returns {{url: string, width: number, height: number, bytes: number, ratioKey: string}|null}
 *   null on ANY doubt: malformed, tampered, expired, another company's or
 *   another design's. Never throws on hostile input.
 */
export function verifySlideAsset(token, { companyId, designId, nowSeconds = Date.now() / 1000, secret = slideAssetSecret() } = {}) {
  if (!secret || typeof token !== "string" || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const expected = Buffer.from(sign(secret, parts[0]));
  const given = Buffer.from(parts[1]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  let p;
  try {
    p = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!p || typeof p !== "object") return null;
  if (p.c !== String(companyId) || p.d !== String(designId)) return null;
  if (!Number.isFinite(p.e) || p.e < Math.floor(nowSeconds)) return null;
  if (typeof p.u !== "string" || !p.u.startsWith("https://res.cloudinary.com/")) return null;
  return { url: p.u, width: p.w, height: p.h, bytes: p.b, ratioKey: p.r };
}
