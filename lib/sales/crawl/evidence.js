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
// ══ Three type values the schema comment does not list ═════════════════════
//
// `page_fetch`, `button` and `contact`. Named here so the next agent finds
// them rather than discovering them in a query:
//
//   page_fetch — the HTTP transaction rather than the document: requested
//                URL, final URL, status, redirect chain, whether the redirect
//                left the host. Written for FAILURES too, which is the point:
//                "the site did not load" and "nobody has looked" are different
//                claims and a table with only successful rows cannot tell them
//                apart.
//   button     — §8 asks for buttons, and a <button> is not a link.
//   contact    — §8 asks for contact methods, and AUDIT-compliance.md §10
//                requires the URL and the DATE an address was found published,
//                because under CASL the sender carries the burden of proving
//                implied consent. sourceUrl and observedAt on this row are
//                that evidence.
import { CRAWLER_TOKEN } from "./policy";

/** Which detector produced these rows, and which version of it. Without the
 *  version an improvement to the extractor silently rewrites history — the
 *  schema comment's words, and they apply here first. */
export const CRAWL_DETECTOR = `${CRAWLER_TOKEN}.extract`;
export const CRAWL_DETECTOR_VERSION = "1";

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

function row({ type, sourceUrl, rawValue, normalizedValue, confidence = 1.0 }) {
  return {
    type,
    source: CRAWL_SOURCE,
    sourceUrl: sourceUrl ? String(sourceUrl).slice(0, 1000) : null,
    rawValue: rawValue === null || rawValue === undefined ? null : String(rawValue).slice(0, 20_000),
    normalizedValue:
      normalizedValue === null || normalizedValue === undefined ? null : String(normalizedValue).slice(0, 2000),
    detector: CRAWL_DETECTOR,
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
 * @param attempt { requestedUrl, finalUrl, status, error, redirects, offHost,
 *                  contentType, bytes, truncated, timedOut,
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
