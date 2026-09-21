// lib/reviews/cardData.js
//
// The server half of the digital business card: one loader shared by the
// page, the vCard route and the settings screen, so the three cannot
// disagree about which rows a card has or what its address is.

import { loadLinkPageData } from "@/lib/links/load";
import { visibleLinks } from "@/lib/links/config";
import { linkLabels } from "@/lib/links/labels";
import { siteCopy } from "@/lib/site/siteCopy";
import { cardCopy } from "./cardCopy";
import { cardPath, addressLine, mapsUrl } from "./card";
import { buildVCard } from "./vcard";

/**
 * @param slug      /c/<slug> — bookingSlug or slug, the same fallback every
 *                  public route uses
 * @param language  the visitor's, already resolved by the caller
 * @param origin    this deployment's origin, for the absolute links a vCard
 *                  and a QR need
 * @returns null for no such company
 */
export async function loadCardData(slug, { language, origin } = {}) {
  const data = await loadLinkPageData(slug, { language });
  if (!data) return null;
  const { company, config, candidates } = data;
  const lang = language || company.defaultLanguage || "en";
  const copy = cardCopy(lang);
  const rows = visibleLinks(candidates, config);
  const byKey = (key) => rows.find((r) => r.key === key) || null;
  const absolute = (url) => (url && url.startsWith("/") ? `${origin || ""}${url}` : url || null);

  const text = addressLine(company);
  return {
    company,
    config,
    candidates,
    language: lang,
    copy,
    path: cardPath(company.bookingSlug || company.slug),
    saveContact: { url: `${cardPath(company.bookingSlug || company.slug)}/contact.vcf`, label: copy.saveContact },
    address: text ? { text, url: mapsUrl(company), label: copy.directions } : null,
    // For the vCard's NOTE: the booking page and the review link, absolute,
    // only when the card itself shows them.
    bookingUrl: absolute(byKey("book")?.url),
    reviewUrl: absolute(byKey("review")?.url),
  };
}

/**
 * The two vCards. `photo` is fetched by the route (network) and handed in,
 * so this stays runnable by the check with a fixture image or none.
 */
export function cardVCards(card, { origin, photo = null } = {}) {
  const labels = linkLabels(card.language);
  const site = siteCopy(card.language);
  const cardUrl = `${String(origin || "").replace(/\/+$/, "")}${card.path}`;
  return {
    full: buildVCard({
      company: card.company,
      cardUrl,
      bookingUrl: card.bookingUrl,
      reviewUrl: card.reviewUrl,
      photo,
      labels: { book: site.navBook || "Book a visit", review: labels.review || "Leave a review" },
      variant: "full",
    }),
    compact: buildVCard({ company: card.company, cardUrl: `${cardUrl}?ref=nfc`, variant: "compact" }),
  };
}

/** A safe download name: the company's name, ASCII-folded, or "contact". */
export function vcfFilename(name) {
  const base = String(name || "")
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[^A-Za-z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base || "contact"}.vcf`;
}
