// lib/reviews/card.js
//
// The digital business card's address, sources and small derivations. Pure.
//
// ── What the card IS ─────────────────────────────────────────────────────────
//
// /c/<slug> is the page a stranger lands on from the QR on the van, the NFC
// tag on the counter, the wallet pass held up at the door, or the sticker on
// the invoice: the company's logo, name, phone, email, address, and every
// public thing they can be sent to — book a visit, get an instant price,
// leave a review, the website, the socials. It reuses the bio-link page's
// rows (lib/links) so the contractor's on/off choices and social handles
// carry over, and adds the one thing a card has that a bio link does not:
// "Save our contact", which hands the phone a vCard.
//
// ── ?ref= is how "23 taps from the van sticker" is counted ───────────────────
//
// Every surface that carries the card's address stamps where it was printed:
// the QR on the settings page is `qr`, the print sheet `sticker`, the NFC
// instructions `nfc`, the wallet pass `wallet`, an email `email`, the
// invoice `invoice`. The page records one `card_tap` event with the source
// as its path (server-side, lib/analytics/product/server.js) and Settings →
// Reviews sums them per source. Unknown values become `other`; a missing
// one is `link` — a typed or shared address, which is also a fact.

export const CARD_SOURCES = Object.freeze(["qr", "sticker", "nfc", "wallet", "email", "invoice", "link", "other"]);

export function cleanCardSource(value) {
  if (value == null || value === "") return "link";
  const v = String(value).trim().toLowerCase();
  return CARD_SOURCES.includes(v) && v !== "other" ? v : "other";
}

/** The card's public address, with the source stamped on. */
export function cardUrl(origin, slug, ref = null) {
  const base = String(origin ?? "").replace(/\/+$/, "");
  const clean = String(slug ?? "").trim();
  if (!clean) return "";
  const url = `${base}/c/${encodeURIComponent(clean)}`;
  const source = ref ? cleanCardSource(ref) : null;
  return source && source !== "link" ? `${url}?ref=${source}` : url;
}

export function cardPath(slug) {
  return `/c/${encodeURIComponent(String(slug ?? "").trim())}`;
}

/** The address as one line, or null. Never padded — a missing city is missing. */
export function addressLine(company = {}) {
  const parts = [company.address, [company.city, company.province].filter(Boolean).join(", "), company.postalCode]
    .map((p) => String(p || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

/** A Google Maps search for the address: opens Maps on a phone, the site on a desktop. */
export function mapsUrl(company = {}) {
  const line = addressLine(company);
  if (!line) return null;
  const query = [line, company.country].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
