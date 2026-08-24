// lib/links/href.js
//
// Every href the bio-link page emits passes through here.
//
// ── Why a boundary rather than trusting the field ───────────────────────────
//
// One of these links is typed by the contractor (the custom rows) and the rest
// are derived from columns other screens wrote. Both end up as an `href` on a
// page a stranger taps, so `javascript:` and `data:` have to be impossible —
// not discouraged. The allow-list below is the whole defence: anything whose
// scheme isn't named is refused, which means a scheme invented next year is
// refused too.
//
// Refusing returns null rather than a sanitised string. A link the visitor
// can't use is the worst thing this page can contain, so the caller drops the
// row entirely instead of rendering a button that goes nowhere.

const ALLOWED_SCHEMES = new Set(["http:", "https:", "tel:", "mailto:"]);

/**
 * A URL safe to put in an href, or null.
 *
 * Bare hostnames ("northline.ca") get https:// rather than being refused: it
 * is what a contractor types, and refusing it would be a validation error on
 * the one screen where the whole job is pasting a link.
 */
export function safeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  // A control character or whitespace inside the string is how "java\nscript:"
  // slips past a naive scheme check in some parsers. Nothing legitimate here
  // contains one.
  if (/[\u0000-\u0020\u007f-\u009f]/.test(raw)) return null;

  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;

  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (!ALLOWED_SCHEMES.has(url.protocol)) return null;
  // http(s) with no host is "https:///path" — parses, resolves to nothing.
  if ((url.protocol === "http:" || url.protocol === "https:") && !url.hostname) {
    return null;
  }
  return url.toString();
}

/**
 * `tel:` for a phone number as the company typed it.
 *
 * Deliberately does NOT normalise to E.164. `tel:` is handled by the dialler,
 * which understands local formats, and guessing a country code onto a number
 * we can't parse produces a call that fails silently — see whatsappHref below,
 * where E.164 is unavoidable and the answer is to refuse instead.
 */
export function telHref(phone) {
  const raw = String(phone ?? "").trim();
  if (!raw) return null;
  // Keep +, digits and the separators diallers accept; drop everything else so
  // a stray letter can't become part of the scheme.
  const cleaned = raw.replace(/[^\d+#*,;]/g, "");
  if (cleaned.replace(/\D/g, "").length < 7) return null;
  return `tel:${cleaned}`;
}

export function mailtoHref(email) {
  const raw = String(email ?? "").trim();
  // Deliberately shallow: a full RFC check rejects addresses that work. This
  // only has to stop something that isn't an address at all becoming an href.
  if (!/^[^\s@,;:<>"']+@[^\s@,;:<>"']+\.[a-z]{2,}$/i.test(raw)) return null;
  return `mailto:${raw}`;
}

// Countries whose national numbers are unambiguously ten digits behind a
// single dialling code. Kept tiny on purpose — see whatsappHref.
const NANP = new Set(["CA", "US"]);

/**
 * `https://wa.me/<E.164 digits>`, or null when we can't be sure.
 *
 * WhatsApp has no local-format fallback: the number in the URL must be the
 * full international one, and a wrong country code opens a chat with a
 * stranger. So this refuses everything it cannot resolve confidently —
 * a number already in international form, or a ten-digit number from a country
 * we know is NANP. Anything else produces no WhatsApp row at all, and the
 * settings screen says why rather than showing a toggle that would ship a
 * broken link.
 */
export function whatsappHref(phone, country) {
  const raw = String(phone ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");

  if (raw.startsWith("+")) {
    return digits.length >= 8 ? `https://wa.me/${digits}` : null;
  }
  if (NANP.has(String(country ?? "").toUpperCase())) {
    if (digits.length === 10) return `https://wa.me/1${digits}`;
    if (digits.length === 11 && digits.startsWith("1")) return `https://wa.me/${digits}`;
  }
  return null;
}

/**
 * The page's own public URL.
 *
 * `/l/` rather than `/links/` because this string's entire job is to be pasted
 * into an Instagram bio and read off a phone screen — every character is one
 * the contractor's audience has to get right if they type it by hand.
 */
export function linkPageUrl(origin, slug) {
  const base = String(origin ?? "").replace(/\/+$/, "");
  const clean = String(slug ?? "").trim();
  if (!clean) return "";
  return `${base}/l/${encodeURIComponent(clean)}`;
}
