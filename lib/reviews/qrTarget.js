// lib/reviews/qrTarget.js
//
// What a member-facing QR route encodes, decided from `?of=`. Two targets:
//
//   card     the digital business card, /c/<slug>?ref=<source> — the default,
//            and what the settings screen, the print sheet, the wallet pass
//            and the NFC tag all carry
//   review   the review link itself — what the review-request email and the
//            invoice footer carry, because those two have one job
//   contact  the compact vCard — "scan to save our contact"
//
// Pure resolution over a loaded card + company; the routes do the I/O.

import { cardUrl } from "./card";

export const QR_TARGETS = Object.freeze(["card", "review", "contact"]);

export function cleanQrTarget(value) {
  return QR_TARGETS.includes(value) ? value : "card";
}

export function clampQrSize(value, { min = 96, max = 2048, fallback = 512 } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * @returns {{ text: string, title: string }|null} null when the target has
 *          nothing to encode (no review link set, no company name for a card)
 */
export function qrPayload({ target, origin, slug, ref = "qr", reviewUrl = null, compactVCard = null }) {
  switch (cleanQrTarget(target)) {
    case "review":
      return reviewUrl ? { text: reviewUrl, title: "review" } : null;
    case "contact":
      return compactVCard ? { text: compactVCard, title: "contact" } : null;
    default: {
      const url = cardUrl(origin, slug, ref);
      return url ? { text: url, title: "card" } : null;
    }
  }
}
