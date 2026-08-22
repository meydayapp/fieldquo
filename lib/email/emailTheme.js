import { formatAddress } from "@/lib/format/address";
// lib/email/emailTheme.js
//
// Resolves the visual theme for a rendered email and provides the escaping
// helpers the renderer needs.
//
// Two layers, in priority order:
//   1. DocumentTemplate.theme — per-template overrides (Json?, usually null)
//   2. Company.brandColor / Company.logoUrl — the account's branding
// Anything still unset falls back to NEUTRALS below, so a template with
// `theme: null` on a company that never set a brand colour still renders a
// complete, on-brand-looking email with zero configuration.

// Fixed neutral palette. These are the "paper and ink" of the email — the
// warm off-white page, the near-black header bar, hairline borders. Only the
// ACCENT varies per company, which is what keeps every company's emails
// looking deliberate rather than like a colour-picker exploded.
export const NEUTRALS = {
  dark: "#1A1917", // header bar
  bg: "#F8F4EF", // page background + footer
  card: "#ffffff",
  border: "#eadfd4",
  text: "#2d2520",
  muted: "#6b5d52",
  track: "#e6ddd2", // unfilled progress track
  done: "#2ea043", // completed stage label
  pending: "#c9bfb4",
};

// Company.brandColor's schema default. Used when a company row somehow has
// no brand colour at all.
// Navy, matching Company.brandColor's schema default and :root in
// globals.css. All three have to agree or a company that never touches
// branding sees one colour in the app and another in its emails.
const FALLBACK_ACCENT = "#06356b";

const FONT_STACKS = {
  sans: "Arial,Helvetica,sans-serif",
  serif: "Georgia,'Times New Roman',serif",
  system:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
};

// ── Escaping ────────────────────────────────────────────────────────────
//
// Two distinct contexts, and conflating them is how injection bugs happen:
// `escapeHtml` for text nodes, `escapeAttr` for anything landing inside a
// quoted attribute (href, src, alt). The previous renderer escaped only
// & < > and then interpolated the result into href="…", so a merge value or
// image URL containing a double quote could close the attribute and inject
// markup. Both helpers below escape quotes.
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Blocks javascript:/data:/vbscript: URLs from reaching an href. A company
// admin is semi-trusted, but templates are client-facing and merge data can
// originate from client-supplied fields, so this is cheap insurance.
const SAFE_URL = /^(https?:|mailto:|tel:|#|\/)/i;

export function safeUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  return SAFE_URL.test(trimmed) ? trimmed : "";
}

// Only simple hex colours from the editor make it into inline styles.
export function safeColor(value, fallback) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(value || "")) ? value : fallback;
}

// Relative luminance → pick black or white text for a given background, so a
// company that picks a pale yellow brand colour still gets readable buttons
// instead of white-on-cream.
export function contrastText(hex) {
  const h = String(hex || "").replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6);
  if (full.length !== 6) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.55 ? "#1A1917" : "#ffffff";
}

/**
 * Build the theme object the renderer consumes.
 *
 * @param {object} company  - { name, logoUrl, brandColor, email, phone, website, address, city, province }
 * @param {object} override - DocumentTemplate.theme, or null to inherit
 */
export function resolveTheme(company = {}, override = null) {
  const o = override && typeof override === "object" ? override : {};
  const palette =
    company.brandColors && typeof company.brandColors === "object"
      ? company.brandColors
      : {};

  // PRIMARY — buttons, progress fill, the wordmark. Still read from the
  // original `brandColor` column so nothing that predates the palette breaks.
  const accent = safeColor(
    o.accent,
    safeColor(company.brandColor, FALLBACK_ACCENT),
  );

  // SECONDARY — supporting accents: section-title text on the itemized list,
  // the summary card's tint. Defaults to primary, so a company that never
  // sets it simply gets a single-colour email rather than a random second hue.
  const secondary = safeColor(
    o.secondary,
    safeColor(palette.secondary, accent),
  );

  // NEUTRAL — the header bar. Defaults to near-black rather than to primary:
  // a saturated full-width header is the fastest way to make an email look
  // cheap, so opting into that should be deliberate.
  const neutral = safeColor(o.neutral, safeColor(palette.neutral, NEUTRALS.dark));

  return {
    ...NEUTRALS,
    accent,
    accentText: contrastText(accent),
    secondary,
    secondaryText: contrastText(secondary),
    neutral,
    bg: safeColor(o.bg, NEUTRALS.bg),
    // Header defaults to the neutral role; a per-template override still wins.
    headerBg: safeColor(o.headerBg, neutral),
    font: FONT_STACKS[o.font] || FONT_STACKS.sans,
    showHeader: o.showHeader !== false,
    showFooter: o.showFooter !== false,
    logoUrl: safeUrl(o.logoUrl ?? company.logoUrl),
    companyName: company.name || "",
    // Footer contact line — assembled from whatever the company has filled in.
    footerContact: [company.phone, company.email, company.website]
      .filter(Boolean)
      .join("  ·  "),
    // Was [address, city, province].join(", ") — verbatim the hand-join
    // lib/format/address.js exists to replace. company.address is Google's
    // FORMATTED string and already contains both, so every client-facing email
    // footer read "…, Canada, Toronto, ON".
    footerAddress: formatAddress(company),
  };
}

export { FONT_STACKS };
