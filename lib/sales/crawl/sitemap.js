// lib/sales/crawl/sitemap.js
//
// Reading a site's own sitemap, so a menu the browser builds with JavaScript
// no longer hides the pages behind it. Pure: XML in, URL lists out. The
// fetching is crawlSite.js's job; the policy of how many files and how many
// URLs is here, as constants, where a check can execute it.
//
// ══ Why the sitemap, and why it is read BEFORE the menu is trusted ═════════
//
// The owner's concern, verbatim: "not identifying the services the company
// offers or not properly reading the website and making false claims". The
// crawler reads the home page's <a href> tags and ranks them; a site whose
// navigation is rendered by a script hands it a body with no links, and the
// crawler falls back to three blind probes that 404 on a site whose contact
// page is `/contact-us-2`. The sitemap is the one list of pages a site
// PUBLISHES for exactly this reader — a crawler that does not run scripts —
// and reading it costs one request that robots.txt already points at.
//
// So the sitemap's URLs join the home page's links as candidates for the
// same ranking (url.js rankNavigation, path-only for a bare URL), and every
// URL is recorded as `sitemap_url` evidence whether or not it was fetched:
// `/services/gutter-guard-installation` in a sitemap is the business saying
// it does gutter guards, in a form no menu script can hide.
//
// ══ Bounded, because a sitemap is somebody else's file ════════════════════
//
// A sitemap index can point at fifty child sitemaps of fifty thousand URLs
// each. This reader takes at most MAX_SITEMAP_FILES files and MAX_SITEMAP_URLS
// URLs per crawl, scans at most MAX_SITEMAP_SCAN_CHARS of any one file, and
// follows a child sitemap only when it is on the same site. A file that is
// not XML, or is gzipped (`.xml.gz` — a binary this crawler does not
// decompress), yields nothing rather than an exception. The check feeds it a
// 10 MB file and a sitemap index that points at itself.
//
// ══ Parsed with one pattern, not a parser ═════════════════════════════════
//
// The only element read is <loc>. That is the whole sitemap protocol as far
// as this crawler is concerned — lastmod and priority say nothing about
// what a business does — and a `<loc>` pattern over a bounded string cannot
// be made quadratic by hostile input the way a full XML parse can.
import { canonicalKey, sameSiteAs } from "./url";

/** Files per crawl: the index plus two children, or three flat sitemaps. */
export const MAX_SITEMAP_FILES = 3;
/** URLs kept per crawl, across every file read. */
export const MAX_SITEMAP_URLS = 500;
/** How much of one file is scanned. A sitemap at the protocol's own 50 MB
 *  cap is scanned for its first 2 MB, which is thousands of URLs. */
export const MAX_SITEMAP_SCAN_CHARS = 2 * 1024 * 1024;
/** Child sitemaps followed from an index, most-shallow first. */
export const MAX_CHILD_SITEMAPS = MAX_SITEMAP_FILES - 1;

/** Where a sitemap lives when robots.txt does not say. */
export const DEFAULT_SITEMAP_PATH = "/sitemap.xml";

const LOC_RE = /<loc(?:\s[^>]*)?>\s*(?:<!\[CDATA\[)?([^<\]]{1,2048})(?:\]\]>)?\s*<\/loc\s*>/gi;

/** Paths that are a feed or an archive rather than a page a business names
 *  its services on. The ARCHIVE list mirrors url.js's ARCHIVE_SEGMENT. */
const NOT_A_SERVICE_PATH = /\.(jpe?g|png|gif|webp|svg|ico|pdf|docx?|xlsx?|zip|mp4|mp3|css|js|json|txt)$|\/(feed|wp-json|wp-admin|cdn-cgi|tag|tags|category|author|page|attachment|comments)(\/|$)|\/20\d\d\//i;

/** Every `<loc>` in one sitemap file, decoded, absolute, deduplicated.
 *
 *  @returns { kind: "index" | "urlset" | "unknown", urls: string[],
 *             truncated: boolean }
 *  `kind` is read off the root element name; a file with <sitemap> children
 *  is an index whose locs are OTHER sitemaps, and a file with <url> children
 *  is the list itself. A file that names neither keeps its locs as URLs —
 *  a sitemap with a bare root is still a list of pages. */
export function parseSitemap(xml, { maxUrls = MAX_SITEMAP_URLS } = {}) {
  const src = String(xml ?? "").slice(0, MAX_SITEMAP_SCAN_CHARS);
  const head = src.slice(0, 4000).toLowerCase();
  const kind = /<sitemapindex[\s>]/.test(head) ? "index" : /<urlset[\s>]/.test(head) ? "urlset" : "unknown";
  const seen = new Set();
  const urls = [];
  let truncated = String(xml ?? "").length > MAX_SITEMAP_SCAN_CHARS;
  const re = new RegExp(LOC_RE.source, "gi");
  let m;
  while ((m = re.exec(src))) {
    if (urls.length >= maxUrls) {
      truncated = true;
      break;
    }
    const loc = decodeXml(m[1]).trim();
    if (!/^https?:\/\//i.test(loc)) continue;
    let u;
    try {
      u = new URL(loc);
    } catch {
      continue;
    }
    u.hash = "";
    const key = canonicalKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    urls.push(u.toString());
  }
  return { kind, urls, truncated };
}

/** The five XML entities and numeric references. Nothing else appears in a
 *  <loc>, and a URL with `&amp;` in it is the commonest reason a naive
 *  reader fetches the wrong page. */
export function decodeXml(value) {
  return String(value ?? "").replace(/&(amp|lt|gt|quot|apos|#x[0-9a-f]+|#\d+);/gi, (whole, body) => {
    const b = body.toLowerCase();
    if (b === "amp") return "&";
    if (b === "lt") return "<";
    if (b === "gt") return ">";
    if (b === "quot") return '"';
    if (b === "apos") return "'";
    const code = b[1] === "x" ? Number.parseInt(b.slice(2), 16) : Number.parseInt(b.slice(1), 10);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return whole;
    try {
      return String.fromCodePoint(code);
    } catch {
      return whole;
    }
  });
}

/**
 * Which sitemap files to ask for, in order: what robots.txt named, then the
 * default path. Same-site only, deduplicated, and `.gz` files are dropped —
 * this crawler reads text and does not decompress.
 *
 * @returns [{ url, from: "robots" | "default" }]
 *
 * @param baseUrl   the origin the crawl runs on
 * @param robotsSitemaps  the `Sitemap:` lines robots.js parsed
 */
export function sitemapUrlsToTry({ baseUrl, baseHost, robotsSitemaps = [], max = MAX_SITEMAP_FILES } = {}) {
  const out = [];
  const seen = new Set();
  const consider = (value, from) => {
    let u;
    try {
      u = new URL(String(value), baseUrl);
    } catch {
      return;
    }
    if (!/^https?:$/.test(u.protocol)) return;
    if (!sameSiteAs(baseHost, u.hostname)) return;
    if (/\.gz$/i.test(u.pathname)) return;
    u.hash = "";
    const key = canonicalKey(u);
    if (seen.has(key)) return;
    seen.add(key);
    if (out.length < max) out.push({ url: u.toString(), from });
  };
  for (const s of Array.isArray(robotsSitemaps) ? robotsSitemaps : []) consider(s, "robots");
  // The default is a GUESS, tried only when robots.txt named nothing that
  // answered — crawlSite.js reads `from` to stop before it.
  consider(new URL(DEFAULT_SITEMAP_PATH, baseUrl).toString(), "default");
  return out;
}

/**
 * Which child sitemaps of an index to follow: same-site, not gzipped, and
 * the ones whose NAME says pages rather than posts or images — a
 * WordPress index lists `page-sitemap.xml`, `post-sitemap.xml`,
 * `category-sitemap.xml` and `attachment-sitemap.xml`, and only the first
 * names what the business does.
 */
export function childSitemapsToFollow(urls = [], { baseHost, max = MAX_CHILD_SITEMAPS, already = new Set() } = {}) {
  const scored = [];
  for (const value of Array.isArray(urls) ? urls : []) {
    let u;
    try {
      u = new URL(String(value));
    } catch {
      continue;
    }
    if (!sameSiteAs(baseHost, u.hostname)) continue;
    if (/\.gz$/i.test(u.pathname)) continue;
    const key = canonicalKey(u);
    if (already.has(key)) continue;
    // The word "sitemap" is in every child's name; judged on what is left.
    const name = u.pathname.toLowerCase().split("/").pop().replace(/sitemap|\.xml$/g, "");
    let rank = 2;
    if (/page|service|main|site/.test(name)) rank = 0;
    else if (/post|blog|news|category|tag|author|product/.test(name)) rank = 3;
    else if (/attachment|image|video|media/.test(name)) rank = 4;
    scored.push({ url: u.toString(), rank, key });
  }
  return scored
    .sort((a, b) => a.rank - b.rank || a.url.localeCompare(b.url))
    .slice(0, max)
    .map((s) => s.url);
}

/**
 * The sitemap's URLs as evidence: same-site pages only, as
 * `{ url, path }`, shallow first. Asset URLs and archive paths are dropped
 * here rather than in the reader, so a sitemap of four hundred blog posts
 * contributes its twelve pages.
 *
 * `limit` is the storage cap (evidence.js MAX_ROWS_PER_CRAWL.sitemap_url);
 * the ordering decides which survive it: a path two segments deep is
 * navigation, six deep is an archive.
 */
export function sitemapPages(urls = [], { baseHost, limit = MAX_SITEMAP_URLS } = {}) {
  const seen = new Set();
  const out = [];
  for (const value of Array.isArray(urls) ? urls : []) {
    let u;
    try {
      u = new URL(String(value));
    } catch {
      continue;
    }
    if (!sameSiteAs(baseHost, u.hostname)) continue;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (path === "/") continue;
    if (NOT_A_SERVICE_PATH.test(path)) continue;
    const key = canonicalKey(u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: `${u.origin}${u.pathname}`, path, depth: path.split("/").filter(Boolean).length });
  }
  return out
    .sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path))
    .slice(0, limit)
    .map(({ url, path }) => ({ url, path }));
}
