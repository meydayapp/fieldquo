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
 * The pages worth having, in the order the brief lists them — and every
 * spelling of each that contractors actually use.
 *
 * ══ Matched by TOKEN, and by the words on the link, not by exact segment ═══
 *
 * The first version matched a path segment exactly against a twelve-word list.
 * On a real gutter company's site the home page carried twenty-seven internal
 * links — `/contact_us`, `/painting`, `/gutter-installation`, `/reviews`,
 * `/referral`, `/service-area` — and exactly ONE of them was in the list, so
 * the crawler decided the navigation had "told it nothing", threw the site's
 * own menu away, and guessed `/contact` and `/services` blind. Both 404'd, and
 * the contact page with the form on it — `/contact_us`, one underscore away —
 * was never fetched. Every deep capability was then written `false`.
 *
 * So each entry below is a KIND with a rank, its path spellings, and a pattern
 * for the anchor text. A path segment is tokenised on `-`, `_`, `.` and
 * camel/digit boundaries before matching, so `contact_us`, `contactUs` and
 * `contact-us.html` are one spelling. And the text a human clicks counts too:
 * a site builder that routes "Pay" to `/p/1187` has a payment page whatever
 * the URL says. The evidence rows already keep the anchor text for exactly
 * this reason (evidence.js, "The href AND its text").
 *
 * The ranking semantics are unchanged: this list SORTS real links. It never
 * invents a URL — see PROBE_SLUGS for the one place that still happens.
 */
export const PRIORITY_PAGES = Object.freeze([
  {
    kind: "about",
    slugs: ["about", "about-us", "aboutus", "our-story", "who-we-are", "our-company", "company"],
    text: /^(about( us| the company)?|our (story|company)|who we are)$/,
  },
  {
    kind: "contact",
    slugs: ["contact", "contact-us", "contactus", "get-in-touch", "reach-us", "contact-form"],
    text: /^(contact( us| me)?( now| today)?|get in touch|reach (us|out)|talk to us|message us)$/,
  },
  {
    kind: "services",
    slugs: ["services", "service", "our-services", "what-we-do", "our-work"],
    text: /^((our |all )?services|what we do)$/,
  },
  {
    kind: "pricing",
    slugs: ["pricing", "prices", "rates", "packages"],
    text: /^(pricing|prices|our (prices|rates)|rates|packages)$/,
  },
  {
    kind: "booking",
    slugs: ["book", "booking", "book-online", "book-now", "schedule", "scheduling", "appointment", "appointments", "schedule-online"],
    text: /^(book( online| now| an appointment| a (visit|call|consultation))?|schedule( now| online| a (call|visit|consultation|service))?|(make|request) an appointment|appointments?)$/,
  },
  {
    kind: "quote",
    slugs: ["estimate", "estimates", "quote", "quotes", "get-a-quote", "free-estimate", "free-quote", "request-quote", "request-a-quote", "request-estimate", "request-an-estimate", "instant-quote"],
    text: /^((get|request) (a |your |my )?(free )?(quote|estimate)( now| today| online)?|free (quote|estimate)s?|(quotes?|estimates?))$/,
  },
  {
    kind: "payment",
    slugs: ["pay", "payment", "payments", "pay-online", "pay-now", "make-a-payment", "make-payment", "bill-pay", "pay-bill", "pay-invoice", "pay-my-bill"],
    text: /^(pay( online| now| here)?|make a payment|pay (my |your |an? )?(bill|invoice)( online)?|bill pay|online payments?|payments?)$/,
  },
  {
    kind: "portal",
    slugs: ["portal", "client-portal", "customer-portal", "login", "log-in", "signin", "sign-in", "account", "my-account", "client-login", "customer-login", "client-hub"],
    text: /^((client|customer) (portal|login|log in|hub|area)|my account|(log|sign) ?in|account|portal)$/,
  },
  {
    kind: "reviews",
    slugs: ["reviews", "review", "testimonials", "testimonial"],
    text: /^((our |customer |client )?(reviews|testimonials)|what (our )?(customers|clients) say)$/,
  },
  { kind: "team", slugs: ["team", "our-team", "staff", "meet-the-team"], text: /^(our team|meet the team|team|staff)$/ },
  { kind: "locations", slugs: ["locations", "location", "service-area", "service-areas", "areas-we-serve", "areas-served"], text: /^(locations?|service areas?|areas (we serve|served))$/ },
  { kind: "faq", slugs: ["faq", "faqs", "frequently-asked-questions"], text: /^(faqs?|frequently asked questions)$/ },
  { kind: "careers", slugs: ["careers", "jobs", "join-our-team", "employment"], text: /^(careers|jobs|join (our|the) team|employment|now hiring|we are hiring)$/ },
  // Lowest, deliberately: a gallery says what they do and nothing about how
  // they sell, so it is fetched only when the budget is not needed elsewhere.
  { kind: "gallery", slugs: ["gallery", "portfolio", "photos", "projects"], text: /^(gallery|portfolio|photos|(our |recent )?projects)$/ },
]);

/** Every path spelling, flat, in rank order — the form the docs and the older
 *  callers know. Derived from PRIORITY_PAGES so the two cannot disagree. */
export const PRIORITY_SLUGS = Object.freeze(PRIORITY_PAGES.flatMap((p) => p.slugs));

/**
 * Slugs probed blind when a page links nowhere we recognise.
 *
 * Deliberately three, and deliberately last. Blind probing is what fills a
 * contractor's error log with 404s, which is precisely the discourtesy §10 is
 * about — so the crawler reads the site's own navigation first and only
 * guesses when the navigation told it nothing AT ALL. Three guesses on a site
 * with no usable links is a rounding error; thirteen on every site is a
 * pattern somebody notices.
 *
 * "Nothing at all" means an EMPTY ranking, not a short one. The first version
 * probed whenever fewer than two links matched, which turned one recognised
 * link plus twenty-six unrecognised ones into two blind 404s — and a crawl
 * that guessed cannot honestly claim it looked (capabilityDetect.js).
 */
export const PROBE_SLUGS = ["contact", "services", "about"];

/** Which kind a probe slug stands for, so a probed page carries the same
 *  `navMatch` a ranked one would. */
export function probeKind(slug) {
  return PRIORITY_PAGES.find((p) => p.slugs.includes(String(slug || "").toLowerCase()))?.kind || null;
}

/**
 * One path segment as the words it is made of.
 *
 * "contact_us" → ["contact", "us"]; "contactUs" → ["contact", "us"];
 * "page2" → ["page", "2"]; "services.html" → ["services"]. The extension is
 * not part of the name and neither is the separator somebody's CMS chose.
 */
export function tokeniseSegment(segment) {
  return String(segment || "")
    .replace(/\.(html?|php|aspx?|jsp|cfm)$/i, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Za-z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/** Does `slug`'s word list appear contiguously in `tokens`? A single-word
 *  slug is a one-element window, so "contact" matches "contact-form" and
 *  "request-a-quote" matches "/request-a-quote-today". */
function tokensContain(tokens, slug) {
  const want = slug.split("-");
  if (!want.length || want.length > tokens.length) return false;
  outer: for (let i = 0; i + want.length <= tokens.length; i++) {
    for (let j = 0; j < want.length; j++) if (tokens[i + j] !== want[j]) continue outer;
    return true;
  }
  return false;
}

/** Path segments that mark an archive rather than a page: a post called
 *  "/blog/pay-your-crew-on-time" is prose about paying, not a payment page. */
const ARCHIVE_SEGMENT = /^(blog|news|posts?|articles?|category|tag|tags|author|archive|resources|20\d\d)$/;

/**
 * The kind a PATH names, or null; rank -1 for the home page.
 *
 * Two passes, most specific first. Multi-word slugs ("service-area",
 * "request-a-quote") are matched anywhere in the path, and before any
 * single word — otherwise "/service-area" would rank as `services` because
 * the word "service" is in it, when it is a `locations` page. Single-word
 * slugs are matched only in the LAST segment and only when that segment is
 * at most two words: "/contact-form" is a contact page, "/blog/pay-your-crew"
 * is not a payment page, and "/about/services" is the services page rather
 * than the about page because the first segment does not get a vote.
 */
export function slugKind(pathname) {
  const segments = String(pathname || "")
    .split("?")[0]
    .split("#")[0]
    .split("/")
    .filter(Boolean);
  if (!segments.length) return { kind: null, rank: -1 };
  if (segments.slice(0, -1).some((seg) => ARCHIVE_SEGMENT.test(seg.toLowerCase()))) {
    return { kind: null, rank: Infinity };
  }

  const tokensPer = segments.map(tokeniseSegment);
  const last = tokensPer[tokensPer.length - 1];
  const all = tokensPer.flat();

  for (let rank = 0; rank < PRIORITY_PAGES.length; rank++) {
    for (const slug of PRIORITY_PAGES[rank].slugs) {
      if (slug.includes("-") && tokensContain(all, slug)) return { kind: PRIORITY_PAGES[rank].kind, rank };
    }
  }
  if (last.length <= 2) {
    for (let rank = 0; rank < PRIORITY_PAGES.length; rank++) {
      for (const slug of PRIORITY_PAGES[rank].slugs) {
        if (!slug.includes("-") && tokensContain(last, slug)) return { kind: PRIORITY_PAGES[rank].kind, rank };
      }
    }
  }
  return { kind: null, rank: Infinity };
}

/** Where a path sits in the priority order; Infinity when it is not one,
 *  -1 for the home page. The older spelling of slugKind, kept for callers
 *  that only want the number. */
export function slugRank(pathname) {
  return slugKind(pathname).rank;
}

/**
 * The kind the words on a link name, or null.
 *
 * Anchored patterns over a normalised label — lower-cased, punctuation and
 * arrows stripped, whitespace collapsed — and only for a SHORT label. A
 * forty-word sentence containing "contact us" is a paragraph somebody linked,
 * not a menu item; the cap keeps prose out of the navigation.
 */
export function textKind(text) {
  const label = String(text || "")
    .toLowerCase()
    .replace(/[→»>›→»]+/g, " ")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!label || label.length > 40) return { kind: null, rank: Infinity };
  for (let rank = 0; rank < PRIORITY_PAGES.length; rank++) {
    if (PRIORITY_PAGES[rank].text.test(label)) return { kind: PRIORITY_PAGES[rank].kind, rank };
  }
  return { kind: null, rank: Infinity };
}

/** One link as { url: URL, text } from any of the shapes a caller passes. */
function readLink(link) {
  const href = link && typeof link === "object" && !(link instanceof URL) ? link.url || link.href : link;
  let u;
  try {
    u = href instanceof URL ? href : new URL(String(href));
  } catch {
    return null;
  }
  const text = link && typeof link === "object" && typeof link.text === "string" ? link.text : "";
  return { url: u, text };
}

/**
 * Which internal links to fetch, in which order — with WHY each one ranked.
 *
 * Ranking the site's OWN links rather than probing a fixed URL list is the
 * choice that makes this polite: a link that exists returns 200, and a slug
 * list applied blind returns ten 404s per site. The list is still the
 * priority — it is just being used to sort real URLs instead of to invent
 * them.
 *
 * A link ranks on its path OR on its label, whichever is better. The label is
 * what makes `/p/1187` labelled "Make a Payment" a payment page; the path is
 * what makes `/pay` one when its label is an icon.
 *
 * @param links     [{ url, text }] — or bare URL strings, which rank on path
 *                  alone
 * @param baseHost  the host the crawl is anchored on
 * @param seen      URLs already fetched, as normalised keys
 * @returns [{ url, kind, rank, via }] best first, deduplicated. `via` says
 *          which half ranked it: "path" or "text".
 */
export function rankNavigation({ links = [], baseHost, seen = new Set(), limit = 8 } = {}) {
  const scored = new Map();

  for (const link of links) {
    const read = readLink(link);
    if (!read) continue;
    const { url: u, text } = read;
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) continue;
    if (!sameSiteAs(baseHost, u.hostname)) continue;

    const byPath = slugKind(u.pathname);
    if (byPath.rank === -1) continue; // the home page, already fetched
    const byText = textKind(text);
    const best = byPath.rank <= byText.rank ? { ...byPath, via: "path" } : { ...byText, via: "text" };
    if (best.rank === Infinity) continue; // not a priority page

    // Query strings are dropped for candidate selection: "?utm_source=..." and
    // "?p=12" produce a dozen URLs for one page, and fetching them all is the
    // whole-site crawl the spec says nobody wants.
    const key = canonicalKey(u);
    if (seen.has(key)) continue;
    const depth = u.pathname.split("/").filter(Boolean).length;
    const existing = scored.get(key);
    if (existing && existing.rank <= best.rank) continue;
    scored.set(key, { url: `${u.origin}${u.pathname}`, kind: best.kind, rank: best.rank, via: best.via, depth });
  }

  return [...scored.values()]
    .sort((a, b) => a.rank - b.rank || a.depth - b.depth || a.url.localeCompare(b.url))
    .slice(0, limit)
    .map(({ url, kind, rank, via }) => ({ url, kind, rank, via }));
}

/** rankNavigation, as the URL strings the older callers expect. */
export function rankCandidates(options = {}) {
  return rankNavigation(options).map((c) => c.url);
}

/** A link that is plainly an asset or a feed rather than a page. */
const NOT_A_PAGE = /\.(jpe?g|png|gif|webp|svg|ico|pdf|docx?|xlsx?|zip|mp4|mp3|css|js|xml|json|txt)$|\/feed(\/|$)|\/wp-json(\/|$)|\/wp-admin(\/|$)|\/cdn-cgi(\/|$)/i;

/** Labels that are navigation chrome rather than a thing the business sells. */
const NOT_A_SERVICE = /^(home|menu|back|next|previous|prev|more|read more|learn more|click here|here|skip to (main )?content|top|close|open|toggle|search|share|print|download|blog|news|resources|privacy( policy)?|terms( of (use|service))?|sitemap|cookies?( policy)?|accessibility|referrals?|referral program|financing|coupons?|specials?|promotions?|careers|jobs|login|log in|sign in|sign up|register|cart|checkout|shop|store|subscribe|newsletter|en|fr|es|english|fran[cç]ais|espa[nñ]ol)$/i;

/**
 * The service menu: the same-site links that are NOT priority pages.
 *
 * On a contractor's site the navigation is "About · Contact · Reviews" plus
 * the list of things they do — `/painting`, `/gutter-installation`,
 * `/epoxy-flooring`. The first three rank; everything else IS the service
 * list, and it is a fact worth a rep's eye without costing a single extra
 * fetch. Recorded from the home page only: that is where a menu is complete,
 * and a deeper page's sidebar is the same menu again.
 *
 * Read off the anchor TEXT, because the path is `/alu-rex-installs` and the
 * label is "Alu-Rex Installs". Chrome ("Home", "Read more", "Privacy") and
 * assets are dropped; a label longer than a menu item is a sentence; and one
 * label per path, first seen wins, so a header, a footer and a mobile drawer
 * repeating the same nine items contribute nine.
 *
 * @returns [{ path, text }] capped, in page order
 */
export function serviceMenu({ links = [], baseHost, limit = 40 } = {}) {
  const byPath = new Map();
  for (const link of links) {
    const read = readLink(link);
    if (!read) continue;
    const { url: u, text } = read;
    if (!ALLOWED_PROTOCOLS.has(u.protocol)) continue;
    if (!sameSiteAs(baseHost, u.hostname)) continue;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (path === "/") continue;
    if (NOT_A_PAGE.test(path)) continue;
    if (path.split("/").filter(Boolean).length > 2) continue;
    if (slugKind(path).rank !== Infinity) continue;
    const label = String(text || "").replace(/\s+/g, " ").trim();
    if (label.length < 2 || label.length > 60) continue;
    if (NOT_A_SERVICE.test(label)) continue;
    if (textKind(label).rank !== Infinity) continue;
    if (byPath.has(path)) continue;
    byPath.set(path, { path, text: label.slice(0, 80) });
    if (byPath.size >= limit) break;
  }
  return [...byPath.values()];
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
  return probeCandidates(baseUrl, slugs).map((c) => c.url);
}

/** The probes with the kind each stands for, in the shape rankNavigation
 *  returns, so a crawl can record a probed page exactly as a ranked one. */
export function probeCandidates(baseUrl, slugs = PROBE_SLUGS) {
  const out = [];
  for (const slug of slugs) {
    try {
      out.push({ url: new URL(`/${slug}`, baseUrl).toString(), kind: probeKind(slug), rank: Infinity, via: "probe" });
    } catch {
      // A base that will not resolve has already been refused by safeCrawlUrl;
      // reaching here means the caller skipped it, so drop the slug rather
      // than throwing out of a pure function.
    }
  }
  return out;
}
