// lib/reviews/qrToken.js
//
// The public address of a company's review QR as a PNG: /r/<token>/qr.png.
//
// Emails cannot carry the QR inline — Gmail and Outlook strip data: images —
// so the review-request email points at a hosted PNG instead, and that URL
// has to be public (no session, no cookie, fetched by a mail client's image
// proxy). The token is a random column on Company (Company.reviewQrToken),
// minted the first time something needs it, and NOT the company id: a
// public image URL must not double as an enumerable list of every tenant.
//
// The QR itself encodes the review URL directly — the Google page, not a
// FieldQuo redirect — so a sticker on a van keeps working whatever happens
// to this product, and nothing about FieldQuo is in the code a customer scans.

import { randomBytes } from "node:crypto";
import { getAppOrigin } from "@/lib/appUrl";

export function newReviewQrToken() {
  return randomBytes(18).toString("base64url");
}

/** What the route accepts: exactly the shape newReviewQrToken() produces. */
export function looksLikeQrToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{24}$/.test(value);
}

export function reviewQrPngUrl(token, request) {
  return `${getAppOrigin(request)}/r/${token}/qr.png`;
}

/**
 * The token for a company, minted on first use. Takes `db` so the check can
 * hand in the memory fixture; a second call returns the same token.
 */
export async function ensureReviewQrToken(db, companyId) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    select: { reviewQrToken: true },
  });
  if (company?.reviewQrToken) return company.reviewQrToken;
  const token = newReviewQrToken();
  await db.company.update({ where: { id: companyId }, data: { reviewQrToken: token } });
  return token;
}
