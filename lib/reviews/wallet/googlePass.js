// lib/reviews/wallet/googlePass.js
//
// "Add to Google Wallet" for the same review QR: a generic pass, one class
// per company, defined INSIDE the save JWT rather than written through the
// Wallet API first.
//
// ── Why inline and not the API ───────────────────────────────────────────────
//
// The Wallet API needs an OAuth'd service-account client and two round trips
// (class, then object) before a link can be minted; the inline form needs a
// private key and a signature. What the API buys is the ability to correct a
// pass already on a phone — and this pass has one fact on it, the review
// URL, which changes so rarely that a NEW object (the id carries a hash of
// the URL) is the honest answer: the old pass keeps pointing where it always
// did, the new one points at the new place, and the contractor deletes the
// old one. No auth library, no API, and the check can verify the JWT with
// the public half of a throwaway key.
//
// ── Origins ──────────────────────────────────────────────────────────────────
//
// Google only honours a save link opened from a page whose origin is in the
// JWT's `origins`. The settings page is the only page that offers the link,
// so the deployment origin is the one entry.

import { createHash } from "node:crypto";
import jwt from "jsonwebtoken";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { safeUrl } from "@/lib/email/emailTheme";
import { reviewQrCopy } from "@/lib/reviews/reviewQrCopy";
import { loadGoogleWalletIssuer } from "./config";

export const GOOGLE_SAVE_URL = "https://pay.google.com/gp/v/save";

const localized = (value, language = "en") => ({ defaultValue: { language, value } });

export function googleClassId(issuerId, companyId) {
  return `${issuerId}.review-${String(companyId).replace(/[^A-Za-z0-9_-]/g, "")}`;
}

export function googleObjectId(issuerId, companyId, reviewUrl) {
  const hash = createHash("sha256").update(String(reviewUrl)).digest("hex").slice(0, 10);
  return `${googleClassId(issuerId, companyId)}-${hash}`;
}

/** The JWT payload, pure. */
export function buildGooglePassPayload({ company = {}, reviewUrl, language, issuer, origin }) {
  const url = safeUrl(reviewUrl);
  if (!url) return null;
  const lang = language || company.defaultLanguage || "en";
  const t = reviewQrCopy(lang);
  const theme = documentTheme(company);
  const { bg } = fillPair(theme);
  const name = company.name || "";
  const classId = googleClassId(issuer.issuerId, company.id || "company");
  const logo = safeUrl(company.logoUrl);

  return {
    iss: issuer.clientEmail,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    origins: origin ? [origin] : [],
    payload: {
      genericClasses: [{ id: classId }],
      genericObjects: [
        {
          id: googleObjectId(issuer.issuerId, company.id || "company", url),
          classId,
          state: "ACTIVE",
          cardTitle: localized(name || t.passTitle, lang),
          header: localized(t.passTitle, lang),
          subheader: localized(t.passHint, lang),
          hexBackgroundColor: bg,
          ...(logo ? { logo: { sourceUri: { uri: logo }, contentDescription: localized(name, lang) } } : {}),
          barcode: { type: "QR_CODE", value: url, alternateText: t.passHint },
          textModulesData: [{ id: "url", header: t.orVisit, body: url }],
        },
      ],
    },
  };
}

/**
 * The pay.google.com URL, or null when unconfigured or without a review URL.
 * The route turns null into a sentence.
 */
export function buildGoogleSaveUrl({ company, reviewUrl, language, origin, issuer = loadGoogleWalletIssuer() } = {}) {
  if (!issuer) return null;
  const payload = buildGooglePassPayload({ company, reviewUrl, language, issuer, origin });
  if (!payload) return null;
  const token = jwt.sign(payload, issuer.privateKey, { algorithm: "RS256" });
  return `${GOOGLE_SAVE_URL}/${token}`;
}
