// lib/signup/website.js
//
// "Do you have a website?" — the signup question (asked the way Housecall Pro
// asks it, 2026-09-24): Yes → the address, No → that answer, kept.
//
// ══ Three answers, not two ═════════════════════════════════════════════════
//
//   true   they have one, and `website` is its URL (Company.website — the
//          column the company's own site has always lived in; nothing new
//          was added for the URL itself);
//   false  they said no — the "Create your website" set-up step is for them;
//   null   never answered: every company from before the question, and
//          anybody who skipped it. Not a no. The set-up step still shows
//          (building a site is useful to them too), but nothing is recorded
//          as a statement they did not make (AGENTS.md failure class 5).
//
// ══ One reader for three boundaries ════════════════════════════════════════
//
// The browser's validator (app/signup/page.js), the capture normaliser
// (lib/signup/leads.js normaliseCapture) and POST /api/companies all go
// through readWebsiteAnswer, so what the form accepts, what the draft row
// keeps and what the company is created with cannot disagree.
//
// No imports: the signup page pulls this into a client bundle.

/** Longest URL kept. A real homepage address is a fraction of this. */
export const WEBSITE_MAX = 300;

/**
 * A website address as it should be stored: https:// added when no scheme
 * was typed, http(s) only, a host with a dot in it, no credentials, no
 * localhost or bare IP. Returns null for anything that is not one — never a
 * repaired guess.
 *
 * "yourcompany.com" → "https://yourcompany.com"
 * "http://Shop.Example.ca/about" → "http://shop.example.ca/about"
 * "javascript:alert(1)", "localhost:3000", "10.0.0.1", "not a site" → null
 */
export function normaliseWebsiteUrl(value) {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > WEBSITE_MAX || /\s/.test(raw)) return null;
  // A scheme that is not http(s) is refused outright rather than prefixed:
  // "javascript:…" must never become "https://javascript:…".
  // A dotless word before the first colon is a scheme ("mailto:", "data:");
  // "shop.example.ca:8080" has a dot there and is a host with a port.
  if (!/^https?:\/\//i.test(raw)) {
    if (raw.includes("://")) return null;
    const beforeColon = raw.split(":")[0];
    if (raw.includes(":") && !beforeColon.includes(".")) return null;
  }
  let url;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || host.endsWith(".")) return null;
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  // A bare IPv4 / IPv6 address is not a business's website.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return null;
  // Every label a real DNS label, and a top-level domain of letters.
  const labels = host.split(".");
  if (!labels.every((l) => /^[a-z0-9-]{1,63}$/.test(l) && !l.startsWith("-") && !l.endsWith("-"))) return null;
  if (!/^[a-z]{2,63}$/.test(labels[labels.length - 1]) && !/^xn--[a-z0-9-]+$/.test(labels[labels.length - 1])) return null;
  // The bare origin without the trailing slash URL() adds — "https://x.com",
  // not "https://x.com/" — so the same site typed two ways is stored one way.
  const out = url.toString();
  return url.pathname === "/" && !url.search && !url.hash ? out.replace(/\/$/, "") : out;
}

/**
 * The answer as sent, made safe: { hasWebsite: true|false|null, website:
 * string|null } or { error: "website" } when they said yes and the address
 * is not one. A "no" or an unanswered question carries no URL whatever was
 * typed (a box they filled in and then answered "no" is not a website).
 *
 * `hasWebsite` accepts the booleans and nothing else — "true", 1 and "yes"
 * are not answers this form ever sends, so they read as unanswered.
 */
export function readWebsiteAnswer({ hasWebsite, website } = {}) {
  if (hasWebsite === true) {
    const url = normaliseWebsiteUrl(website);
    if (!url) return { error: "website" };
    return { hasWebsite: true, website: url };
  }
  if (hasWebsite === false) return { hasWebsite: false, website: null };
  return { hasWebsite: null, website: null };
}
