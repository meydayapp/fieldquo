// lib/whiteLabel/pageMetadata.js
//
// The <head> of every client-facing page: the browser tab, the favicon, and
// the link preview a homeowner sees when a contractor texts or emails a link.
//
// ══ What leaked before this file ══════════════════════════════════════════
//
// The page BODIES were white-labelled; the heads were not. Every route under
// the root layout inherited three FieldQuo things nobody had overridden:
//
//   • app/favicon.ico, app/icon.png and app/apple-icon.png — the FieldQuo mark
//     in the tab of a quote, and in the iMessage bubble when a link with no
//     og:image is shared (iMessage falls back to the apple-touch-icon).
//   • the root description, "The all-in-one system for contractors and
//     service pros" — the second line of a WhatsApp preview, under the
//     contractor's quote.
//   • /manifest.webmanifest, named and iconed FieldQuo on the apex host —
//     what Android offers if a homeowner taps "Add to home screen" on a quote.
//
// ══ What a client-facing head says now ════════════════════════════════════
//
// The company's name and the company's logo. Nothing else — a link preview
// is fetched by a THIRD party (Apple, Meta, Google), so the head carries no
// client name, no amount and no address, whatever the page body shows to the
// token holder. The document's own number may appear in the TAB title (it is
// what tells two open quotes apart); the share title (og:title) leaves it out.
//
// ══ The favicon ═══════════════════════════════════════════════════════════
//
// The logo when there is one and it is a Cloudinary upload — padded (never
// cropped: c_fill would cut the ends off a wordmark) into a square on WHITE.
// White because that is the ground the logo already sits on in every quote,
// invoice and PDF the company sends, so it is the one background the owner
// has already seen their logo work on; a transparent pad would put a navy
// wordmark on a dark-mode tab strip, and iOS fills a transparent
// apple-touch-icon with black.
//
// Otherwise — no logo, or a logo hosted somewhere Cloudinary cannot resize —
// a generated square: the company's initial on its brand colour, both colours
// from lib/documents/theme.js's fillPair, which MEASURES the pair to 4.5:1
// and moves the fill (not the text) for mid-tones. A non-Cloudinary logo is
// not handed to the browser raw as a favicon: an unknown aspect ratio is
// squashed into the tab, which looks broken rather than branded.
//
// The generated icon's URL carries only the colour and the letter — both
// already public on every document — so the route behind it
// (app/api/brand-icon) reads no database row and cannot be used to learn
// anything about a company.
//
// ══ Why not app/<segment>/icon.js ═════════════════════════════════════════
//
// The file convention cannot see the company — it is per-segment, and the
// segment here is a token. And favicon.ico at the root is special-cased by
// Next: it is prepended to EVERY route's icon list, and no metadata export
// can remove it (node_modules/next/dist/lib/metadata/resolve-metadata.js,
// postProcessMetadata). That is why the file moved to public/favicon.ico:
// still served at /favicon.ico for FieldQuo's own pages and for anything
// that asks for it by name, but no longer injected into a contractor's
// quote. app/icon.png and app/apple-icon.png stay — Next only applies the
// root's file icons when no segment set `icons`, which every page using this
// module does.

import { documentTheme, fillPair, FALLBACK_BRAND } from "@/lib/documents/theme";
import { isValidHex } from "@/lib/brand/colour";

/** The three columns a client-facing head reads. Spread into a select. */
export const CLIENT_META_COMPANY_SELECT = { name: true, logoUrl: true, brandColor: true };

/** The route behind the generated icon. */
export const BRAND_ICON_PATH = "/api/brand-icon";

/** The sizes that route draws. Anything else is answered with the default. */
export const BRAND_ICON_SIZES = [32, 180, 192];
const DEFAULT_ICON_SIZE = 192;

/**
 * An icon that is no icon. `<link rel="icon" href="data:,">` stops the
 * browser from asking the host for /favicon.ico — which on fieldquo.com is
 * FieldQuo's — on a page that has nothing of the company's to show yet (a
 * wrong or not-yet-sent link). A blank tab icon says nothing; ours would say
 * who built the software.
 */
export const BLANK_ICON = "data:,";

/**
 * The letter on the generated icon.
 *
 * Latin letters and digits only, diacritics folded ("Élan" → "E"). The
 * icon is drawn by next/og, whose bundled font is Latin: a Cyrillic or
 * Gurmukhi initial would come out as an empty box, which is worse than no
 * letter. Those names get the brand-coloured square alone.
 */
export function brandInitial(name) {
  const folded = String(name || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const m = folded.match(/[\p{L}\p{N}]/u);
  if (!m) return "";
  const ch = m[0].toUpperCase();
  return /^[A-Z0-9]$/.test(ch) ? ch : "";
}

/**
 * Background and letter colour for the generated icon, from a brand hex.
 * fillPair guarantees 4.5:1 or falls back to ink on white — measured, not
 * assumed (scripts/check-white-label-meta.mjs runs it over hostile brands).
 */
export function brandIconColours(brandColor) {
  const brand = isValidHex(brandColor) ? String(brandColor).trim() : FALLBACK_BRAND;
  const pair = fillPair(documentTheme({ brandColor: brand }));
  return { bg: pair.bg, fg: pair.fg };
}

/**
 * What the icon route draws, from its (untrusted) query string. Every input
 * is narrowed: a colour that does not parse is the fallback brand, a letter
 * outside A–Z/0–9 is no letter, a size outside the list is the default.
 */
export function brandIconSpec({ colour, letter, size } = {}) {
  const hex = typeof colour === "string" && /^[0-9a-fA-F]{6}$/.test(colour) ? `#${colour.toLowerCase()}` : FALLBACK_BRAND;
  const l = typeof letter === "string" && /^[A-Z0-9]$/.test(letter) ? letter : "";
  const n = Number(size);
  const s = BRAND_ICON_SIZES.includes(n) ? n : DEFAULT_ICON_SIZE;
  return { size: s, letter: l, ...brandIconColours(hex) };
}

/** True for a URL Cloudinary can transform (one of our own uploads). */
function isCloudinaryUpload(url) {
  return typeof url === "string" && /^https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\//.test(url);
}

/**
 * The logo padded into a `size`-pixel square on white, or null when the logo
 * is not a Cloudinary upload (nothing here can resize it).
 */
export function logoSquareUrl(logoUrl, size) {
  if (!isCloudinaryUpload(logoUrl)) return null;
  const marker = "/upload/";
  const i = logoUrl.indexOf(marker);
  const n = Math.max(16, Math.round(Number(size) || DEFAULT_ICON_SIZE));
  return `${logoUrl.slice(0, i + marker.length)}w_${n},h_${n},c_pad,b_white,q_auto,f_png/${logoUrl.slice(i + marker.length)}`;
}

/** The generated icon's URL: colour and letter, nothing else. */
export function generatedIconUrl(company, size) {
  // The BRAND colour, normalised, rather than a pair: the route measures the
  // pair itself, so a hand-edited URL cannot ask for an unreadable icon.
  const raw = isValidHex(company?.brandColor) ? String(company.brandColor).trim() : FALLBACK_BRAND;
  const hex = raw.replace(/^#/, "").toLowerCase();
  const c = hex.length === 3 ? hex.split("").map((d) => d + d).join("") : hex;
  const params = new URLSearchParams({ c, s: String(size) });
  const letter = brandInitial(company?.name);
  if (letter) params.set("l", letter);
  return `${BRAND_ICON_PATH}?${params.toString()}`;
}

/** The company's icon at `size` px — logo if it can be squared, else generated. */
export function brandIconUrl(company, size = DEFAULT_ICON_SIZE) {
  return logoSquareUrl(company?.logoUrl, size) || generatedIconUrl(company, size);
}

/** Next `icons` metadata for a company. */
export function brandIcons(company) {
  return {
    icon: [
      { url: brandIconUrl(company, 32), type: "image/png", sizes: "32x32" },
      { url: brandIconUrl(company, 192), type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: brandIconUrl(company, 180), type: "image/png", sizes: "180x180" }],
  };
}

/**
 * The link-preview image: the logo, or nothing. Never a generated card and
 * never FieldQuo's (/social-card is marketing-only — lib/marketing/metadata.js).
 * Square on white for a Cloudinary logo, so iMessage and WhatsApp show it
 * whole; any other absolute logo URL as it is.
 */
export function brandOgImages(company) {
  const name = String(company?.name || "").trim();
  const square = logoSquareUrl(company?.logoUrl, 600);
  if (square) return [{ url: square, width: 600, height: 600, alt: name }];
  if (typeof company?.logoUrl === "string" && /^https:\/\//.test(company.logoUrl)) {
    return [{ url: company.logoUrl, alt: name }];
  }
  return [];
}

/**
 * The parts of the root layout's head that must not reach a client page,
 * overridden: the FieldQuo description, the FieldQuo manifest, and (through
 * a blank icon) the FieldQuo favicon. For a page that has no company to show
 * — an unknown token, a draft link, a not-found screen.
 */
export function neutralClientMetadata(extra = {}) {
  return {
    description: null,
    icons: { icon: [{ url: BLANK_ICON }] },
    manifest: null,
    ...extra,
  };
}

/**
 * Metadata for a client-facing page that knows its company.
 *
 * @param company     needs name, logoUrl, brandColor (CLIENT_META_COMPANY_SELECT).
 *                    Null → neutralClientMetadata.
 * @param title       the tab title; defaults to the company's name.
 * @param shareTitle  og:title; defaults to the company's name. Never carries a
 *                    client's name, an amount or an address.
 * @param description defaults to the company's name — neutral, theirs, and
 *                    true in every language.
 * @param robots      passed through.
 */
export function clientPageMetadata(company, { title, shareTitle, description, robots } = {}) {
  const name = String(company?.name || "").trim();
  if (!name) {
    return neutralClientMetadata({ title: title || " ", ...(robots ? { robots } : {}) });
  }
  const desc = description || name;
  const ogTitle = shareTitle || name;
  const images = brandOgImages(company);
  return {
    title: title || name,
    description: desc,
    icons: brandIcons(company),
    manifest: null,
    // The name iOS pre-fills on "Add to Home Screen". The root deliberately
    // leaves it unset (app/layout.js); here there is a right answer. The two
    // root values are repeated because Next replaces this key, not merges it.
    appleWebApp: { capable: true, statusBarStyle: "default", title: name },
    openGraph: {
      type: "website",
      siteName: name,
      title: ogTitle,
      description: desc,
      images,
    },
    twitter: {
      // "summary", not summary_large_image: the image is a square logo, and
      // a large card would crop it to 2:1.
      card: "summary",
      title: ogTitle,
      description: desc,
      images,
    },
    ...(robots ? { robots } : {}),
  };
}

/** "Quote Q-0123 · Northline Painting" — label, optional number, company. */
export function documentTitle(label, number, companyName) {
  const head = [label, number].filter((s) => s && String(s).trim()).join(" ");
  return [head, companyName].filter(Boolean).join(" · ");
}
