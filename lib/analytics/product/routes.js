// lib/analytics/product/routes.js
//
// A URL becomes a route pattern, and a route pattern names its surface.
//
// ══ The one privacy rule that lives here ═══════════════════════════════════
//
// Nothing about a page view is recorded below the route pattern. A quote's id,
// a portal token, a booking slug, a search string in the query — none of it
// leaves the browser, because this module runs THERE first (lib/analytics/
// track.js imports it) and the server runs it again on what arrives and
// refuses anything that does not resolve. "/app/quotes/cmf3…/edit" is
// "/app/quotes/[id]/edit" before the beacon is built; "/portal/abc123" is
// "/portal/[token]". The pattern list is the product's own page tree
// (routeCatalogue.generated.js), so a path nobody can visit is a path nobody
// can record.
//
// Pure. No React, no window, no database — scripts/check-product-analytics.mjs
// executes every function here against hostile input.

import { ROUTE_PATTERNS } from "./routeCatalogue.generated.js";

/** The six audiences a page belongs to, in the order the console lists them. */
export const SURFACES = Object.freeze(["marketing", "help", "app", "sales", "platform", "client"]);

/**
 * Client-facing prefixes: the pages a stranger with no account reaches from a
 * contractor's link. Everything under them is "client", never "marketing" —
 * a homeowner reading a quote is not a prospect reading our pricing page,
 * and the two must not share a count.
 */
const CLIENT_PREFIXES = Object.freeze([
  "/quote", "/book", "/q", "/portal", "/site", "/embed", "/f", "/l", "/instant-quote",
  "/visit", "/survey", "/plan", "/design", "/no-contact", "/unsubscribe", "/accept-invitation",
  "/refer",
  // The digital business card (app/c/[slug]) — the QR/NFC landing page.
  "/c",
]);

const seg = (p) => (p === "/" ? [] : p.slice(1).split("/"));

/** Segment-count keyed index, built once. Catch-alls sit in their own list. */
const BY_LENGTH = new Map();
const CATCH_ALL = [];
for (const pattern of ROUTE_PATTERNS) {
  const parts = seg(pattern);
  if (parts.some((s) => s.startsWith("[..."))) {
    CATCH_ALL.push({ pattern, parts });
    continue;
  }
  const list = BY_LENGTH.get(parts.length) || [];
  list.push({ pattern, parts });
  BY_LENGTH.set(parts.length, list);
}

/**
 * A pathname, cleaned: query and hash dropped, trailing slash removed, no
 * double slashes, decoded once. Returns null for anything that is not a
 * plausible path (too long, not starting with "/", control characters).
 */
export function cleanPath(input) {
  if (typeof input !== "string") return null;
  let p = input.split(/[?#]/)[0].trim();
  if (!p.startsWith("/") || p.length > 512) return null;
  try {
    p = decodeURIComponent(p);
  } catch {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(p)) return null;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p;
}

/**
 * The route pattern a pathname resolves to, or null when it is not one of
 * ours. Literal segments must match exactly; a "[param]" matches one non-empty
 * segment; a "[...rest]" matches one or more. When two patterns fit, the one
 * with more literal segments wins ("/quote/[companySlug]/kitchen" over
 * "/site/[subdomain]/[...path]" is never a contest, but "/app/quotes/new"
 * over "/app/quotes/[id]" is, and the literal must win).
 */
export function normalisePath(input) {
  const p = cleanPath(input);
  if (p === null) return null;
  const parts = seg(p);
  if (parts.some((s) => s === "")) return null;

  let best = null;
  let bestLiterals = -1;
  for (const cand of BY_LENGTH.get(parts.length) || []) {
    let literals = 0;
    let ok = true;
    for (let i = 0; i < parts.length; i += 1) {
      const c = cand.parts[i];
      if (c.startsWith("[")) continue;
      if (c !== parts[i]) {
        ok = false;
        break;
      }
      literals += 1;
    }
    if (ok && literals > bestLiterals) {
      best = cand.pattern;
      bestLiterals = literals;
    }
  }
  if (best) return best;

  for (const cand of CATCH_ALL) {
    const fixed = cand.parts.length - 1;
    if (parts.length <= fixed) continue;
    let ok = true;
    for (let i = 0; i < fixed; i += 1) {
      const c = cand.parts[i];
      if (c.startsWith("[")) continue;
      if (c !== parts[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return cand.pattern;
  }
  return null;
}

/** True when the string is exactly one of the catalogue's patterns. */
export function isRoutePattern(value) {
  return typeof value === "string" && ROUTE_PATTERNS.includes(value);
}

/**
 * Which audience a route pattern belongs to. Decided from the pattern, never
 * from what the browser claims, so a beacon cannot file a marketing hit under
 * "app" to look like product usage.
 */
export function surfaceOf(pattern) {
  if (typeof pattern !== "string") return null;
  if (pattern === "/app" || pattern.startsWith("/app/")) return "app";
  if (pattern === "/platform" || pattern.startsWith("/platform/")) return "platform";
  if (pattern === "/sales" || pattern.startsWith("/sales/")) return "sales";
  if (pattern === "/help" || pattern.startsWith("/help/")) return "help";
  for (const prefix of CLIENT_PREFIXES) {
    if (pattern === prefix || pattern.startsWith(`${prefix}/`)) return "client";
  }
  return "marketing";
}

/**
 * What the browser sees on a tenant host is "/" or "/about"; what Next
 * rendered is /site/<subdomain>[/<path>]. The beacon folds the host in before
 * normalising, so a contractor's website is counted as one, under the pattern
 * the page tree actually has — and the subdomain itself is not recorded.
 *
 * @param pathname   window.location.pathname
 * @param subdomain  lib/site/subdomain.js subdomainFromHost(host), or null
 */
export function tenantHostPath(pathname, subdomain) {
  if (!subdomain) return pathname;
  const p = cleanPath(pathname);
  if (p === null) return pathname;
  // The same list middleware.js's SUBDOMAIN_PASSTHROUGH holds: a homeowner
  // opening sunset.fieldquo.com/quote/sunset gets the quote page, not the
  // website, and is counted as such.
  if (TENANT_PASSTHROUGH.some((pre) => p.startsWith(`${pre}/`))) return p;
  return p === "/" ? "/site/x" : `/site/x${p}`;
}

/** Mirrors middleware.js SUBDOMAIN_PASSTHROUGH; check:product-analytics holds the two equal. */
export const TENANT_PASSTHROUGH = Object.freeze([
  "/quote", "/instant-quote", "/book", "/embed", "/q", "/portal", "/w", "/design", "/refer", "/l", "/f", "/visit", "/estimate-report",
  "/c",
]);

/** The pattern is one of the /app pages. */
export function isAppPattern(pattern) {
  return surfaceOf(pattern) === "app";
}
