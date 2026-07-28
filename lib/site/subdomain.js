// lib/site/subdomain.js
//
// Turning a Host header into a company, and validating what a company may
// call itself.
//
// ── The reserved list is the security boundary ──────────────────────────────
//
// Every name below is either something FieldQuo already serves or something an
// attacker would want. If a company could register `app`, `app.fieldquo.com`
// would stop being the product and start being their marketing page — and
// every session cookie scoped to `.fieldquo.com` would be readable by a page
// they control. That's not a naming inconvenience, it's account takeover.
//
// So this list errs heavily toward refusing. A contractor told "try another
// name" loses ten seconds; the alternative loses the platform.

export const RESERVED_SUBDOMAINS = new Set([
  // Serves something today
  "www",
  "app",
  "api",
  "admin",
  "platform",
  "book",
  "quote",
  "q",
  "portal",
  "refer",
  "site",
  "send",
  "mail",
  "email",
  "smtp",
  "imap",
  "pop",
  "webmail",
  "mx",
  "ns",
  "ns1",
  "ns2",
  "dns",
  "cdn",
  "static",
  "assets",
  "media",
  "img",
  "images",
  // Would be useful to us later, and confusing in someone else's hands
  "help",
  "support",
  "docs",
  "status",
  "blog",
  "news",
  "shop",
  "store",
  "pay",
  "billing",
  "invoice",
  "invoices",
  "login",
  "signup",
  "auth",
  "account",
  "accounts",
  "dashboard",
  "staging",
  "dev",
  "test",
  "demo",
  "preview",
  "beta",
  "internal",
  "vpn",
  "ftp",
  "git",
  "ci",
  // Reads as if FieldQuo said it
  "fieldquo",
  "official",
  "security",
  "abuse",
  "postmaster",
  "hostmaster",
  "webmaster",
  "noreply",
  "no-reply",
]);

// Hosts that are FieldQuo itself rather than a tenant. Checked before any
// subdomain extraction, so the marketing site and the app are never mistaken
// for a company site even if someone registers a matching name.
const PLATFORM_HOSTS = new Set([
  "fieldquo.com",
  "www.fieldquo.com",
  "localhost",
]);

/**
 * Extract a tenant subdomain from a Host header.
 *
 * Returns null for the platform's own hosts, for Vercel preview URLs, and for
 * anything reserved — the caller then serves the normal app.
 *
 * Vercel deployment hosts (`fieldquo-abc123-team.vercel.app`) matter more than
 * they look: without excluding them, every preview deploy would read its own
 * hash as a subdomain and try to serve a company site that doesn't exist.
 */
export function subdomainFromHost(host) {
  if (!host) return null;

  // Strip the port — localhost:3000 and 127.0.0.1:3000 in development.
  const hostname = String(host).split(":")[0].toLowerCase().trim();

  if (PLATFORM_HOSTS.has(hostname)) return null;
  if (hostname.endsWith(".vercel.app")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return null;

  // Local development: <slug>.localhost:3000 works in Chrome and Safari
  // without touching /etc/hosts, which makes this testable before the DNS
  // wildcard exists.
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    return isUsableSubdomain(sub) ? sub : null;
  }

  const parts = hostname.split(".");
  // Needs at least sub.domain.tld. Two parts is the apex.
  if (parts.length < 3) return null;

  const sub = parts[0];
  return isUsableSubdomain(sub) ? sub : null;
}

function isUsableSubdomain(sub) {
  return Boolean(sub) && !RESERVED_SUBDOMAINS.has(sub);
}

/**
 * Whether a company may take this subdomain.
 *
 * @returns {{ ok: boolean, error?: string }} — the message is shown verbatim,
 *   so each one says what to do rather than what went wrong.
 */
export function validateSubdomain(value) {
  const sub = String(value || "").trim().toLowerCase();

  if (!sub) return { ok: false, error: "Choose an address for your site." };

  if (sub.length < 3) {
    return { ok: false, error: "A bit longer — at least 3 characters." };
  }
  if (sub.length > 63) {
    // 63 is the hard limit on a single DNS label, not a product choice.
    return { ok: false, error: "That's too long for a web address (max 63 characters)." };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(sub)) {
    return {
      ok: false,
      error:
        "Use lowercase letters, numbers and dashes only — no spaces, and it can't start or end with a dash.",
    };
  }
  if (sub.includes("--")) {
    // Reserved by IDNA for punycode ("xn--"). Browsers treat some of these
    // specially and it's not worth finding out which.
    return { ok: false, error: "Two dashes in a row aren't allowed." };
  }
  if (RESERVED_SUBDOMAINS.has(sub)) {
    return { ok: false, error: `"${sub}" is reserved. Try something else.` };
  }

  return { ok: true };
}

/**
 * A first suggestion, derived from the company name.
 *
 * Company.slug already exists and is unique, so it's the natural seed — but it
 * can be reserved or malformed for a name like "API Plumbing", which is why
 * this runs the same validation and falls back rather than trusting it.
 */
export function suggestSubdomain(company = {}) {
  const fromSlug = String(company.slug || "").toLowerCase();
  if (validateSubdomain(fromSlug).ok) return fromSlug;

  const fromName = String(company.name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

  if (validateSubdomain(fromName).ok) return fromName;

  // Both unusable — append a suffix rather than returning something the form
  // will immediately reject.
  const base = (fromName || fromSlug || "company").replace(/^-+|-+$/g, "");
  return `${base}-site`.slice(0, 63);
}

/** The public URL for a site, for links and copy buttons. */
export function siteUrl(subdomain, { protocol = "https", root = "fieldquo.com" } = {}) {
  return `${protocol}://${subdomain}.${root}`;
}
