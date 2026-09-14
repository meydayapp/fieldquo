// lib/sales/crawl/evidence.js
//
// Turning a page record into ProspectEvidence rows. Pure — this builds the
// create-inputs; crawlSite.js writes them.
//
// ══ Why ProspectEvidence and not a new table ═══════════════════════════════
//
// Because the table already models exactly this and says so: "Something we
// OBSERVED. The bottom of the stack; everything above cites it." Its own
// schema comment lists the types a crawl produces — page_content, script_src,
// iframe_host, form, link, meta, schema_org — and TechnologySignature.patterns
// is keyed on `script_src | iframe_host | html | link | meta`, which is the
// same vocabulary seen from the matching side. A crawl-specific table would
// have meant the fingerprinter joining two shapes to ask one question.
//
// ══ The two-column problem, and the rule that resolves it ══════════════════
//
// The row has exactly two value columns, `rawValue` ("as found") and
// `normalizedValue` ("as normalised"), and some of §8's list is not a scalar:
// a form is a method, an action and a field list; a link is a URL AND the text
// a human clicks, which is the half that says whether it is a booking link.
//
// The rule, applied everywhere below:
//
//   normalizedValue — ALWAYS a plain matchable string. This is what a
//                     TechnologySignature pattern runs against, so it must
//                     never be JSON.
//   rawValue        — the observation as found: a string when the observation
//                     is a string, and a compact JSON object when it genuinely
//                     has parts.
//
// The alternative — one JSON blob per page — is what the schema comment
// explicitly rejects, on the grounds that "why does FieldQuo think this
// company has no online booking?" is a join and a blob cannot be joined.
//
// ══ Five type values the schema comment does not list ══════════════════════
//
// `page_fetch`, `button`, `contact`, `nav_link` and `inline_token`. Named here
// so the next agent finds them rather than discovering them in a query:
//
//   page_fetch   — the HTTP transaction rather than the document: requested
//                  URL, final URL, status, redirect chain, whether the redirect
//                  left the host — and HOW the crawler got there (`via`: the
//                  start page, a link the site itself published, or a blind
//                  probe) with the navigation kind it was ranked as
//                  (`navMatch`: contact, booking, payment…). Written for
//                  FAILURES too, which is the point: "the site did not load"
//                  and "nobody has looked" are different claims and a table
//                  with only successful rows cannot tell them apart. And a
//                  crawl that GUESSED its way to two 404s is not a crawl that
//                  looked — capabilityDetect.js reads `via` to know the
//                  difference.
//   button       — §8 asks for buttons, and a <button> is not a link.
//   contact      — §8 asks for contact methods, and AUDIT-compliance.md §10
//                  requires the URL and the DATE an address was found
//                  published, because under CASL the sender carries the
//                  burden of proving implied consent. sourceUrl and observedAt
//                  on this row are that evidence.
//   nav_link     — the service menu: a same-site link on the home page that
//                  is NOT a priority page. The anchor text is the observation
//                  ("Gutter Guard Installation"), the path is the key. No
//                  extra fetch produces these; they are what the navigation
//                  said and the crawler used to throw away.
//   inline_token — a vendor's own init token found inside an inline <script>
//                  body (`LiveSite.init`, `HCPWidget`). LOOSE evidence, read
//                  by `html` signature patterns and capped below the detection
//                  threshold by technology.js. The body it came from is never
//                  stored; see html.js's scanInlineScript.
//
// ══ An inline loader is a script_src, with its provenance on the detector ══
//
// A URL a page's inline script would load — vcita's `livesite.js`, a
// CallRail tag — is written as `script_src`, so a signature written for a
// declared <script src> fires on it unchanged. Which is the point: the vendor
// is the same vendor however the tag reached the page. The row's `detector`
// carries an `.inline` suffix rather than a different `source`, because
// `source` is where the OBSERVATION came from — the website — and the one
// reader that rebuilds a crawl (lib/sales/pipeline/handlers/detectTechnology.js
// loadCrawl) filters on `source: "website"`. A row filed under another source
// would be a fact nothing could read.
import { CRAWLER_TOKEN } from "./policy";

/** Which detector produced these rows, and which version of it. Without the
 *  version an improvement to the extractor silently rewrites history — the
 *  schema comment's words, and they apply here first.
 *
 *  "2": the envelope gained `via` and `navMatch`, inline loaders became
 *  script_src rows, and nav_link / inline_token appeared. A "1" row means
 *  none of those were looked for, which is why capabilityDetect.js treats a
 *  crawl with no `via` on any page as "provenance unknown" rather than as
 *  either navigation or guesswork. */
export const CRAWL_DETECTOR = `${CRAWLER_TOKEN}.extract`;
export const CRAWL_DETECTOR_VERSION = "2";
/** The detector on a script_src row that came out of an inline body. */
export const INLINE_DETECTOR = `${CRAWL_DETECTOR}.inline`;

/** `source` on every row this file makes. */
export const CRAWL_SOURCE = "website";

export const EVIDENCE_TYPES = [
  "page_fetch",
  "page_content",
  "meta",
  "script_src",
  "iframe_host",
  "link",
  "form",
  "button",
  "schema_org",
  "dom_attr",
  "contact",
  "nav_link",
  "inline_token",
];

/** Rows per page, so one pathological page cannot write ten thousand rows. */
export const MAX_ROWS_PER_PAGE = 400;

// ══ What a crawl is allowed to write, and why there are three limits ═══════
//
// Measured, not guessed. At 2,328 crawled prospects this table held 943,540
// rows — 405 per prospect, 85% of a 512 MB database — and 367,164 of them were
// `link`. A contractor's site is a navigation repeated in the header, the
// footer and a mobile drawer, on six pages: thirteen menu items became
// seventy-eight rows saying the same thirteen things.
//
// So three limits, each answering a different failure:
//
//   MAX_ROWS_PER_PAGE    one pathological page
//   dedupe               the same fact observed twice — see dedupeKey()
//   MAX_ROWS_PER_CRAWL   a large site whose DISTINCT facts are still a flood
//
// ── Why deduping cannot cost a detection ──────────────────────────────────
//
// Because both readers already dedupe, and say so. capabilityDetect.js breaks
// out of its page loop on the first hit — "a nav link repeated on nine pages
// is one observation" — and tradeDetect.js's note() keeps the first row per
// signal KIND, "distinct kinds, not hits". A row dropped here is a row those
// two would have discarded after loading it. technology.js matches a signature
// against any page, so a link kept on the homepage fires exactly as it did
// when it was also stored five more times.
//
// The ONE thing dedupe would have broken is looksRendered(), which reads
// `page.links.length > 0` to catch a JavaScript-rendered shell. Page four's
// links are all nav, so dedupe empties it and a real page reads as a shell.
// That is why fetchEvidence() writes the pre-dedupe COUNTS into the page_fetch
// envelope and looksRendered() prefers them: the count is the observation, the
// rows are storage.
export const MAX_ROWS_PER_CRAWL = Object.freeze({
  link: 120,
  dom_attr: 40,
  meta: 40,
  script_src: 40,
  iframe_host: 20,
  button: 40,
  form: 20,
  schema_org: 20,
  contact: 20,
  nav_link: 40,
  inline_token: 20,
});

/** Types a crawl-wide dedupe must NOT touch, and the reason for each.
 *
 *  page_fetch  — one per page, and the envelope is what says the page loaded
 *                at all. Two pages that failed identically are two failures.
 *  page_content — two thin service pages can carry byte-identical body text,
 *                and dropping the second leaves a page with no text, which
 *                looksRendered() reads as a shell. The row is one per page;
 *                there is no row count to win here and a real regression to
 *                lose. */
const NEVER_DEDUPED = new Set(["page_fetch", "page_content"]);

function row({ type, sourceUrl, rawValue, normalizedValue, confidence = 1.0, detector = CRAWL_DETECTOR }) {
  return {
    type,
    source: CRAWL_SOURCE,
    sourceUrl: sourceUrl ? String(sourceUrl).slice(0, 1000) : null,
    rawValue: rawValue === null || rawValue === undefined ? null : String(rawValue).slice(0, 20_000),
    normalizedValue:
      normalizedValue === null || normalizedValue === undefined ? null : String(normalizedValue).slice(0, 2000),
    detector,
    detectorVersion: CRAWL_DETECTOR_VERSION,
    confidence,
  };
}

/**
 * The row that records the HTTP transaction, including the ones that failed.
 *
 * ══ Why the envelope counts what it does not store ════════════════════════
 *
 * `counts` is how many links, scripts, metas and data-* attributes the page
 * ACTUALLY carried, before the dedupe below threw the repeats away. It is four
 * integers on a row that already exists, and it is what lets storage shrink
 * without a reader losing a fact: lib/sales/intel/capabilityDetect.js's
 * looksRendered() asks "did this page have any links at all", because a body
 * with no links is the fingerprint of a JavaScript-rendered site handed to a
 * crawler that does not run JavaScript. Counting the rows we kept would answer
 * that question with our own storage policy.
 *
 * A row written before this field existed has no `counts`, and every reader
 * falls back to the rows — so old evidence keeps meaning exactly what it meant.
 *
 * ══ …and how the crawler got to the page ══════════════════════════════════
 *
 * `via` and `navMatch` are facts about the CRAWL, not about the site, which
 * is why they live in the envelope and not in the content hash: "start" is
 * the URL we were given, "nav" is a link the site itself published and the
 * crawler ranked, "probe" is a blind guess. A crawl whose only pages beyond
 * the front door were probes has not read the site's navigation — it may
 * have missed the contact page by one underscore — and
 * lib/sales/intel/capabilityDetect.js refuses to conclude an absence from it.
 * `navMatch` is the kind the page was ranked as (contact, booking, payment,
 * portal…), so "was a contact-like page actually fetched" is a column read
 * rather than a re-derivation from the URL.
 *
 * @param attempt { requestedUrl, finalUrl, status, error, redirects, offHost,
 *                  contentType, bytes, truncated, timedOut, via, navMatch,
 *                  links, scripts, metas, dataAttrs }
 */
export function fetchEvidence(attempt) {
  const offHost = Boolean(attempt?.offHost);
  const normalized = attempt?.error
    ? `error:${attempt.error}`
    : offHost
      ? `off_host:${attempt.finalUrl || ""}`
      : `http_${attempt?.status ?? "none"}`;

  return row({
    type: "page_fetch",
    sourceUrl: attempt?.finalUrl || attempt?.requestedUrl || null,
    rawValue: JSON.stringify({
      requestedUrl: attempt?.requestedUrl ?? null,
      finalUrl: attempt?.finalUrl ?? null,
      status: attempt?.status ?? null,
      error: attempt?.error ?? null,
      timedOut: Boolean(attempt?.timedOut),
      contentType: attempt?.contentType ?? null,
      bytes: attempt?.bytes ?? null,
      truncated: Boolean(attempt?.truncated),
      redirects: (attempt?.redirects || []).slice(0, 10),
      offHost,
      via: typeof attempt?.via === "string" ? attempt.via : null,
      navMatch: typeof attempt?.navMatch === "string" ? attempt.navMatch : null,
      // The scheme the page was actually fetched over, and — when the crawl
      // fell back from https to http (crawlSite.js step 7) — the error https
      // gave. A reader that wants to know whether a site is http-only asks
      // this row, not the URL on the prospect.
      scheme: schemeOf(attempt?.finalUrl || attempt?.requestedUrl),
      schemeFallback:
        attempt?.schemeFallback && typeof attempt.schemeFallback === "object"
          ? { from: attempt.schemeFallback.from ?? null, to: attempt.schemeFallback.to ?? null, error: attempt.schemeFallback.error ?? null }
          : null,
      counts: {
        links: countOf(attempt?.links),
        scripts: countOf(attempt?.scripts),
        metas: countOf(attempt?.metas),
        dataAttrs: countOf(attempt?.dataAttrs),
      },
    }),
    normalizedValue: normalized,
    // An off-host redirect is a HIGH-confidence observation about the URL we
    // were given and a LOW-confidence one about the business, so the row says
    // what it is and nothing infers from it here. ProspectInference is where a
    // "this domain is parked" claim belongs, and that is a different stage.
    confidence: 1.0,
  });
}

function countOf(list) {
  return Array.isArray(list) ? list.length : 0;
}

/** "http" | "https" | null, off a URL string. */
function schemeOf(url) {
  const m = /^([a-z][a-z0-9+.-]*):/i.exec(String(url || ""));
  return m ? m[1].toLowerCase() : null;
}

/**
 * Every row for one successfully fetched page.
 *
 * Ordered so that the most useful rows survive the cap: the fetch envelope and
 * the page text first, then the fingerprintable sources, then the long tail of
 * links. A cap that truncated the envelope would leave a page with content and
 * no record of where it came from.
 */
export function pageEvidence(page) {
  if (!page) return [];
  const url = page.finalUrl || page.requestedUrl || null;
  const rows = [];

  rows.push(fetchEvidence(page));

  if (page.text) {
    rows.push(
      row({
        type: "page_content",
        sourceUrl: url,
        rawValue: page.text,
        // The URL, so a `page_content` row can be found by page without
        // parsing 40 KB of text to work out which one it is.
        normalizedValue: url,
      }),
    );
  }

  if (page.title) {
    rows.push(row({ type: "meta", sourceUrl: url, rawValue: `title=${page.title}`, normalizedValue: `title=${page.title.toLowerCase()}` }));
  }

  for (const meta of page.metas || []) {
    if (!meta?.name) continue;
    const raw = `${meta.name}=${meta.content ?? ""}`;
    rows.push(row({ type: "meta", sourceUrl: url, rawValue: raw, normalizedValue: raw.toLowerCase() }));
  }

  for (const script of page.scripts || []) {
    rows.push(
      row({
        type: "script_src",
        sourceUrl: url,
        rawValue: script.src,
        normalizedValue: (script.url || script.src || "").toLowerCase(),
      }),
    );
  }

  for (const script of page.inlineScripts || []) {
    rows.push(
      row({
        type: "script_src",
        sourceUrl: url,
        // The literal as it sat in the script, so a reviewer can see that
        // `d2ra6nuwn69ktl.cloudfront.net/assets/livesite.js` was written
        // without a scheme — which is exactly why a declared-tag scan missed it.
        rawValue: script.literal || script.url,
        normalizedValue: String(script.url || "").toLowerCase(),
        detector: INLINE_DETECTOR,
      }),
    );
  }

  for (const token of page.inlineTokens || []) {
    rows.push(row({ type: "inline_token", sourceUrl: url, rawValue: token, normalizedValue: String(token).toLowerCase(), detector: INLINE_DETECTOR }));
  }

  for (const frame of page.iframes || []) {
    rows.push(
      row({
        type: "iframe_host",
        sourceUrl: url,
        rawValue: frame.src,
        // The HOST, because that is what the type is called and what a
        // signature matches: "calendly.com" identifies the widget wherever on
        // their CDN the embed happens to live this month.
        normalizedValue: (frame.host || frame.url || frame.src || "").toLowerCase(),
      }),
    );
  }

  for (const form of page.forms || []) {
    rows.push(
      row({
        type: "form",
        sourceUrl: url,
        rawValue: JSON.stringify({
          action: form.action ?? null,
          actionUrl: form.actionUrl ?? null,
          actionHost: form.actionHost ?? null,
          method: form.method ?? null,
          id: form.id ?? null,
          className: form.className ?? null,
          fields: (form.fields || []).map((f) => ({ name: f.name, type: f.type, required: f.required })),
        }),
        // Method, where it posts, and what it asks for — the three things that
        // separate "a quote request form" from "a newsletter box".
        normalizedValue: `${form.method || "get"} ${(form.actionHost || "")} ${(form.fields || [])
          .map((f) => f.name || f.type)
          .filter(Boolean)
          .join(",")}`
          .trim()
          .toLowerCase(),
      }),
    );
  }

  for (const button of page.buttons || []) {
    rows.push(row({ type: "button", sourceUrl: url, rawValue: button.text, normalizedValue: button.text.toLowerCase() }));
  }

  for (const block of page.jsonLd || []) {
    rows.push(row({ type: "schema_org", sourceUrl: url, rawValue: block, normalizedValue: schemaTypesOf(block) }));
  }
  for (const itemtype of page.microdata || []) {
    rows.push(row({ type: "schema_org", sourceUrl: url, rawValue: itemtype, normalizedValue: String(itemtype).toLowerCase() }));
  }

  for (const attr of page.dataAttrs || []) {
    rows.push(
      row({
        type: "dom_attr",
        sourceUrl: url,
        rawValue: `${attr.name}=${attr.value}`,
        normalizedValue: `${attr.name}=${String(attr.value).toLowerCase()}`.slice(0, 300),
      }),
    );
  }

  for (const contact of page.contacts || []) {
    rows.push(
      row({
        type: "contact",
        sourceUrl: url,
        rawValue: JSON.stringify({ kind: contact.kind, raw: contact.raw, found: contact.found }),
        normalizedValue: `${contact.kind}:${contact.value}`,
      }),
    );
  }

  for (const item of page.navLinks || []) {
    rows.push(
      row({
        type: "nav_link",
        sourceUrl: url,
        // The anchor text IS the observation: "Gutter Guard Installation" is
        // what the business says it does. The path is the key a reader joins
        // on, and stays a plain string as the two-column rule requires.
        rawValue: item.text,
        normalizedValue: String(item.path || "").toLowerCase(),
      }),
    );
  }

  for (const link of page.links || []) {
    rows.push(
      row({
        type: "link",
        sourceUrl: url,
        // The href AND its text. A URL alone cannot answer "does this site
        // have a booking link", because half of them are /contact-us-2 and the
        // only thing that says what it is is the word on the button.
        rawValue: JSON.stringify({ href: link.href, text: link.text, rel: link.rel }),
        normalizedValue: (link.url || link.href || "").toLowerCase(),
      }),
    );
  }

  return rows.slice(0, MAX_ROWS_PER_PAGE);
}

/**
 * The @type values inside a JSON-LD block, lowercased and comma-joined.
 *
 * Parsed rather than regexed because the answer — "is this a LocalBusiness, a
 * Product, or a breadcrumb" — is the whole value of the row, and JSON.parse
 * either succeeds or tells us the block was not JSON. A block that fails to
 * parse keeps its raw value and gets a normalized marker saying so, because
 * malformed structured data is itself a finding about a site.
 */
export function schemaTypesOf(block) {
  let parsed;
  try {
    parsed = JSON.parse(String(block));
  } catch {
    return "invalid_json_ld";
  }

  const types = new Set();
  const visit = (node, depth = 0) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 100)) visit(item, depth + 1);
      return;
    }
    if (typeof node !== "object") return;
    const t = node["@type"];
    if (typeof t === "string") types.add(t.toLowerCase());
    else if (Array.isArray(t)) for (const x of t) if (typeof x === "string") types.add(x.toLowerCase());
    for (const value of Object.values(node)) {
      if (value && typeof value === "object") visit(value, depth + 1);
    }
  };
  visit(parsed);

  return [...types].sort().join(",") || "no_type";
}

/**
 * The identity of an observation, for the crawl-wide dedupe.
 *
 * Type plus BOTH value columns. Not the normalised value alone: a link row's
 * rawValue carries the anchor text, and "Book Online → /contact-us-2" and
 * "Contact → /contact-us-2" are two different facts about the same URL — the
 * second is a route, the first is a booking affordance, and capabilityDetect's
 * labelHit() reads exactly that difference. sourceUrl is deliberately NOT in
 * the key: which of six pages the shared footer link was found on is the thing
 * we are paying 367,000 rows to record, and it is not a fact anybody reads.
 */
export function dedupeKey(row) {
  // Joined on NUL, written as an escape: a raw NUL in a source file turns
  // grep into "Binary file matches" and every source rule that reads this
  // file into a silent no-op.
  return [row.type, row.normalizedValue ?? "", row.rawValue ?? ""].join("\u0000");
}

/**
 * How informative a link row is, lowest first — the order a cap eats from the
 * bottom of.
 *
 * 0  mailto:/tel:/sms:. The contact capability is decided on these, and there
 *    are never many.
 * 1  off-host. Every third-party signal there is — the Calendly booking page,
 *    the Stripe checkout, the client portal, the Facebook page, the Google
 *    review link. This is what a TechnologySignature's `link` patterns and
 *    capabilityDetect's host lists are looking for, and it is a handful of
 *    links on a site with four hundred.
 * 2+ on-host, by path depth. /services/roofing is navigation and says what
 *    the business does; /blog/2024/05/11/how-to-clean-gutters is an archive.
 *    tradeDetect.js reads routes for trade phrases, so shallow routes are
 *    exactly the ones worth keeping when something has to go.
 */
export function linkRank(row) {
  const url = String(row.normalizedValue || "");
  if (/^(mailto|tel|sms):/i.test(url)) return 0;

  const host = hostOf(url);
  const pageHost = hostOf(row.sourceUrl);
  if (host && pageHost && host !== pageHost) return 1;
  // No host on either side means a relative href we could not resolve. Treated
  // as on-host rather than as third-party: guessing it is external would let
  // an unparseable string outrank a real Calendly link.

  const path = url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]*/i, "");
  const depth = path.split("/").filter(Boolean).length;
  return 2 + Math.min(depth, 8);
}

function hostOf(value) {
  const s = String(value || "").trim();
  if (!s) return null;
  const m = /^[a-z][a-z0-9+.-]*:\/\/([^/?#]+)/i.exec(s);
  if (!m) return null;
  return m[1].toLowerCase().replace(/^www\./, "").split(":")[0];
}

const RANKED = { link: linkRank };

/**
 * The rows for a whole crawl: page order, each distinct observation once, and
 * each type capped.
 *
 * The cap SELECTS by rank and EMITS in page order, so the page_fetch envelope
 * still leads its page and a reader walking the rows sees them in the order
 * they were found. Sorting the output instead would have put every mailto: at
 * the top of the crawl, which reads as a bug to the next person.
 */
export function crawlEvidence(pages = []) {
  const rows = (Array.isArray(pages) ? pages : [pages]).filter(Boolean).flatMap((p) => pageEvidence(p));

  const seen = new Set();
  const distinct = [];
  for (const row of rows) {
    if (NEVER_DEDUPED.has(row.type)) {
      distinct.push(row);
      continue;
    }
    const key = dedupeKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(row);
  }

  const overflowing = new Set();
  for (const [type, cap] of Object.entries(MAX_ROWS_PER_CRAWL)) {
    const ofType = distinct.filter((r) => r.type === type);
    if (ofType.length <= cap) continue;
    const rank = RANKED[type];
    const ordered = rank
      ? ofType
          .map((row, index) => ({ row, index, rank: rank(row) }))
          // Index breaks ties, so the order is total and the same crawl always
          // keeps the same rows. A comparator that returned 0 for equal ranks
          // would depend on the engine's sort stability, which is a thing to
          // rely on deliberately or not at all.
          .sort((a, b) => a.rank - b.rank || a.index - b.index)
          .map((entry) => entry.row)
      : ofType;
    for (const row of ordered.slice(cap)) overflowing.add(row);
  }

  return overflowing.size ? distinct.filter((row) => !overflowing.has(row)) : distinct;
}
