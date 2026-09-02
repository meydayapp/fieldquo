// lib/sales/crawl/url.js
//
// Deciding whether a URL may be fetched at all, and which of a site's pages
// are worth fetching. Pure — no network, no DNS. The DNS half of the SSRF
// guard lives in fetchPage.js, because it is IO; everything decidable from the
// string is decided here so a check can run it against hostile input.
//
// ══ Prospect.websiteUrl is hostile input ═══════════════════════════════════
//
// It arrives from an external dataset (Overture today) and nobody has looked
// at it. Treat it exactly as a query parameter: a string a stranger chose.
// Concretely, these have to be refused rather than fetched —
//
//   file:///etc/passwd                     a scheme that reads the disk
//   http://localhost:3000/api/...          our own app, with our own cookies
//   http://169.254.169.254/latest/meta-data/   the cloud metadata endpoint
//   http://10.0.0.5/                       whatever is next to the lambda
//   http://[::1]:5432/                     Postgres, over IPv6
//   http://user:pass@evil.tld/             credentials smuggled in a URL
//
// — and the numeric ones have to be refused in every notation, because
// http://2130706433/ and http://0177.0.0.1/ are both 127.0.0.1. That is
// handled by parsing with WHATWG URL first and testing `hostname` afterwards:
// the parser normalises all four IPv4 notations to dotted-quad, so the tests
// below see one form rather than four.
//
// ══ Same-site is anchored on the ORIGINAL host, deliberately ═══════════════
//
// The usual shape — reduce both hosts to a registrable domain and compare —
// needs a public suffix list this repo does not have, and the failure without
// one is severe rather than cosmetic: "ends with .co.uk" would make every
// British business the same site as every other. lib/sales/suppressionRules.js
// makes exactly this argument for normaliseDomain and refuses to guess.
//
// So sameSiteAs() only ever extends the host we were GIVEN downwards. A
// redirect from acme.com to shop.acme.com is the same site; a redirect to
// facebook.com or to acme-com.example is not, and no suffix list is needed to
// tell them apart.
import { normaliseDomain } from "@/lib/sales/suppressionRules";

/** Schemes a crawler may speak. Everything else is refused by name. */
export const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

/**
 * Ports a crawler may speak to.
 *
 * The default pair only. A contractor's marketing site on :8080 is imaginable
 * and rare; an internal service on :8080, :6379, :5432 or :9200 next to the
 * lambda is neither. The trade is a handful of unreachable prospects against a
 * whole class of SSRF, and it is not close.
 */
export const ALLOWED_PORTS = new Set(["", "80", "443"]);

/** Hostnames that never belong to a contractor, whatever they resolve to. */
const FORBIDDEN_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".localdomain",
  ".home.arpa",
  ".in-addr.arpa",
  ".ip6.arpa",
  ".onion",
  ".test",
  ".invalid",
  ".example",
];

const FORBIDDEN_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "169.254.169.254",
]);

/** Dotted-quad, or null. WHATWG URL has already normalised the odd notations. */
export function parseIpv4(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(host || ""));
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n >= 0 && n <= 255) ? parts : null;
}

/**
 * Is this dotted-quad somewhere a crawler must never go?
 *
 * The list is "not globally reachable" (IANA special-purpose registry) rather
 * than "RFC 1918", because the interesting attack targets are outside 1918:
 * 169.254.169.254 is the cloud metadata service and 100.64/10 is carrier-grade
 * NAT, and neither is a private address in the everyday sense.
 */
export function isPrivateIpv4(host) {
  const p = parseIpv4(host);
  if (!p) return false;
  const [a, b] = p;

  if (a === 0) return true; // 0.0.0.0/8 "this network"
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local, and cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 192 && b === 0) return true; // 192.0.0/24 and 192.0.2/24 (TEST-NET-1)
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51) return true; // TEST-NET-2
  if (a === 203 && b === 0) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

/**
 * An IPv6 address expanded to its eight 16-bit groups, or null.
 *
 * Written out rather than pattern-matched on the TEXT, because the text form
 * is not canonical and the browser rewrites it. `http://[::ffff:127.0.0.1]/`
 * comes back out of WHATWG URL as `[::ffff:7f00:1]` — the same loopback in
 * hexadecimal — and a check that only knew the dotted spelling waved it
 * straight through. That was a live bug in this file, caught by the check
 * asserting the address rather than the string.
 */
export function expandIpv6(host) {
  const raw = String(host || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  if (!raw.includes(":")) return null;
  if (!/^[0-9a-f:.]+$/.test(raw)) return null;

  const halves = raw.split("::");
  if (halves.length > 2) return null;

  const parseSide = (side) => {
    if (!side) return [];
    const parts = side.split(":");
    const groups = [];
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part === "") return null;
      if (part.includes(".")) {
        // A trailing dotted quad — the ::ffff:1.2.3.4 and ::1.2.3.4 forms.
        if (i !== parts.length - 1) return null;
        const quad = parseIpv4(part);
        if (!quad) return null;
        groups.push((quad[0] << 8) | quad[1], (quad[2] << 8) | quad[3]);
        continue;
      }
      if (part.length > 4) return null;
      const n = Number.parseInt(part, 16);
      if (!Number.isFinite(n)) return null;
      groups.push(n);
    }
    return groups;
  };

  const head = parseSide(halves[0]);
  const tail = halves.length === 2 ? parseSide(halves[1]) : [];
  if (head === null || tail === null) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;

  const fill = 8 - head.length - tail.length;
  if (fill < 0) return null;
  return [...head, ...Array(fill).fill(0), ...tail];
}

/**
 * The IPv6 half.
 *
 * The mapped and compatible forms are UNWRAPPED and asked of isPrivateIpv4
 * rather than listed separately: ::ffff:10.0.0.1 is 10.0.0.1, and any list
 * that restates the v4 ranges in v6 spelling is a list that will drift from
 * the one above it.
 */
export function isPrivateIpv6(host) {
  const g = expandIpv6(host);
  if (!g) return false;

  const asV4 = (hi, lo) => `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;

  // ::/96 (IPv4-compatible, deprecated) and ::ffff:0:0/96 (IPv4-mapped).
  // This branch also covers :: and ::1, which come out as 0.0.0.0 and 0.0.0.1
  // and are refused by the 0.0.0.0/8 rule.
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0 && (g[5] === 0 || g[5] === 0xffff)) {
    return isPrivateIpv4(asV4(g[6], g[7]));
  }
  // 64:ff9b::/96, the well-known NAT64 prefix. Same unwrapping.
  if (g[0] === 0x64 && g[1] === 0xff9b && g[2] === 0 && g[3] === 0 && g[4] === 0 && g[5] === 0) {
    return isPrivateIpv4(asV4(g[6], g[7]));
  }

  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7  unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8  multicast
  if (g[0] === 0x100 && g[1] === 0 && g[2] === 0 && g[3] === 0) return true; // 100::/64 discard
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // documentation
  return false;
}

/** Either family. Takes a bracketed or bare host. */
export function isPrivateAddress(host) {
  const raw = String(host || "").toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!raw) return true;
  if (isPrivateIpv4(raw)) return true;
  if (isPrivateIpv6(raw)) return true;
  return false;
}

/**
 * A hostname that is refused before DNS is even consulted.
 *
 * Single-label names ("intranet", "router") are in here because they resolve
 * through a search domain to whatever is on the local network. A contractor's
 * website always has a dot in it.
 */
export function isForbiddenHostname(host) {
  const raw = String(host || "").toLowerCase().replace(/\.$/, "");
  if (!raw) return true;
  if (FORBIDDEN_HOSTS.has(raw)) return true;
  if (FORBIDDEN_HOST_SUFFIXES.some((s) => raw.endsWith(s))) return true;
  if (isPrivateAddress(raw)) return true;
  // No dot at all, and not an IP literal we already rejected.
  if (!raw.includes(".") && !raw.includes(":")) return true;
  return false;
}

/**
 * Vet one URL for fetching.
 *
 * @returns { ok: true, url: URL, host, origin, isIpLiteral }
 *        | { ok: false, reason, detail }
 *
 * `reason` is a stable token rather than a sentence, because it is written to
 * SalesPipelineTask.lastError and to a ProspectEvidence row, and both of those
 * are read by machines as well as by people.
 */
export function safeCrawlUrl(input, { allowedPorts = ALLOWED_PORTS } = {}) {
  const raw = String(input ?? "").trim();
  if (!raw) return { ok: false, reason: "no_url", detail: "empty" };
  if (raw.length > 2048) return { ok: false, reason: "url_too_long", detail: String(raw.length) };
  // A newline or a control character in a URL is header-injection material and
  // has no legitimate form. Refused rather than stripped, exactly as
  // normaliseEmail refuses rather than reshapes.
  if (/[\s\u0000-\u001f\u007f]/.test(raw)) return { ok: false, reason: "control_characters", detail: null };

  let url;
  try {
    // A bare "acme.com" from a dataset is common enough to be worth handling,
    // and defaulting it to https rather than http is the safer of the two.
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: "unparseable", detail: null };
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return { ok: false, reason: "scheme_not_allowed", detail: url.protocol };
  }
  // Credentials in a URL are refused rather than dropped: a dataset row
  // carrying them is either an attack or a mistake, and fetching a stripped
  // version of it means fetching a URL nobody supplied.
  if (url.username || url.password) return { ok: false, reason: "credentials_in_url", detail: null };

  // The host is vetted BEFORE the port, deliberately. Both refuse, but the
  // reason is written to a task's lastError and to an evidence row, and
  // "http://[::1]:5432/ was refused because 5432 is not a port we speak" is
  // the wrong headline for a URL pointing at the loopback.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isForbiddenHostname(host)) {
    return { ok: false, reason: "host_not_public", detail: host };
  }
  if (!allowedPorts.has(url.port)) return { ok: false, reason: "port_not_allowed", detail: url.port };

  return {
    ok: true,
    url,
    host,
    origin: url.origin,
    isIpLiteral: Boolean(parseIpv4(host)) || host.includes(":"),
  };
}

/**
 * Is `candidateHost` the same site as the host we were given?
 *
 * Anchored on the base, never on a shared suffix — see the header. `www.` is
 * stripped from the base only, so both directions of the www redirect every
 * site performs come out as same-site.
 */
export function sameSiteAs(baseHost, candidateHost) {
  const base = String(baseHost || "").toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
  const cand = String(candidateHost || "").toLowerCase().replace(/\.$/, "");
  if (!base || !cand) return false;
  return cand === base || cand === `www.${base}` || cand.endsWith(`.${base}`);
}

/** The registrable-ish domain the rest of the product stores. Reused, not
 *  reimplemented — Prospect.domain and SalesSuppression.value are the same
 *  shape and a second normaliser would let them disagree. */
export function crawlDomain(hostOrUrl) {
  return normaliseDomain(hostOrUrl);
}

/** Absolute URL from an href found on a page, or null. Fragments dropped. */
export function resolveHref(href, baseUrl) {
  const raw = String(href ?? "").trim();
  if (!raw) return null;
  if (/^(javascript|data|about|blob|vbscript):/i.test(raw)) return null;
  try {
    const u = new URL(raw, baseUrl);
    u.hash = "";
    return u;
  } catch {
    return null;
  }
}

/**
 * The pages worth having, in the order the brief lists them.
 *
 * A ranking rather than a fetch list — see rankCandidates. Each entry is
 * matched against the PATH of an internal link, so "our-services" and
 * "/en/services/" both hit `services`.
 */
export const PRIORITY_SLUGS = [
  "about",
  "contact",
  "services",
  "pricing",
  "book",
  "booking",
  "estimate",
  "quote",
  "request-a-quote",
  "team",
  "locations",
  "careers",
];

/**
 * Slugs probed blind when a page links nowhere we recognise.
 *
 * Deliberately three, and deliberately last. Blind probing is what fills a
 * contractor's error log with 404s, which is precisely the discourtesy §10 is
 * about — so the crawler reads the site's own navigation first and only
 * guesses when the navigation told it nothing. Three guesses on a site with no
 * usable links is a rounding error; thirteen on every site is a pattern
 * somebody notices.
 */
export const PROBE_SLUGS = ["contact", "services", "about"];

/** Where a slug sits in the priority order; Infinity when it is not one. */
export function slugRank(pathname) {
  const segments = String(pathname || "")
    .toLowerCase()
    .split("/")
    .filter(Boolean)
    // "services.html", "contact.php" — the extension is not part of the name.
    .map((s) => s.replace(/\.(html?|php|aspx?)$/, ""));
  if (!segments.length) return -1; // the home page outranks everything

  let best = Infinity;
  for (const segment of segments) {
    const i = PRIORITY_SLUGS.indexOf(segment);
    if (i !== -1) best = Math.min(best, i);
  }
  return best;
}

/**
 * Which internal links to fetch, in which order.
 *
 * Ranking the site's OWN links rather than probing a fixed URL list is the
 * choice that makes this polite: a link that exists returns 200, and a slug
 * list applied blind returns ten 404s per site. The list is still the
 * priority — it is just being used to sort real URLs instead of to invent
 * them.
 *
 * @param links     [{ url }] absolute URLs already resolved against the page
 * @param baseHost  the host the crawl is anchored on
 * @param seen      URLs already fetched, as normalised keys
 * @returns absolute URL strings, best first, deduplicated
 */
export function rankCandidates({ links = [], baseHost, seen = new Set(), limit = 8 } = {}) {
  const scored = new Map();

  for (const link of links) {
    const href = link?.url || link;
    let u;
    try {
      u = href instanceof URL ? href : new URL(String(href));
    } catch {
      continue;
    }
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) continue;
    if (!sameSiteAs(baseHost, u.hostname)) continue;

    const rank = slugRank(u.pathname);
    if (rank === Infinity || rank === -1) continue; // not a priority page, or home

    // Query strings are dropped for candidate selection: "?utm_source=..." and
    // "?p=12" produce a dozen URLs for one page, and fetching them all is the
    // whole-site crawl the spec says nobody wants.
    const key = canonicalKey(u);
    if (seen.has(key) || scored.has(key)) continue;
    scored.set(key, { url: `${u.origin}${u.pathname}`, rank, depth: u.pathname.split("/").filter(Boolean).length });
  }

  return [...scored.values()]
    .sort((a, b) => a.rank - b.rank || a.depth - b.depth || a.url.localeCompare(b.url))
    .slice(0, limit)
    .map((c) => c.url);
}

/**
 * The identity of a page for "have we already fetched this".
 *
 * Scheme and query dropped, trailing slash normalised, host lowercased. So
 * http://acme.com/about/ and https://www.acme.com/about?utm=x are one page,
 * which is what stops a crawl of six pages spending its budget on one.
 */
export function canonicalKey(url) {
  let u;
  try {
    u = url instanceof URL ? url : new URL(String(url));
  } catch {
    return String(url || "");
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "") || "/";
  return `${host}${path}`;
}

/** The probe URLs for a site whose navigation told us nothing. */
export function probeUrls(baseUrl, slugs = PROBE_SLUGS) {
  const out = [];
  for (const slug of slugs) {
    try {
      out.push(new URL(`/${slug}`, baseUrl).toString());
    } catch {
      // A base that will not resolve has already been refused by safeCrawlUrl;
      // reaching here means the caller skipped it, so drop the slug rather
      // than throwing out of a pure function.
    }
  }
  return out;
}
