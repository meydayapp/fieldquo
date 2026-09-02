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
 * @param attempt { requestedUrl, finalUrl, status, error, redirects, offHost,
 *                  contentType, bytes, truncated, timedOut }
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
    }),
    normalizedValue: normalized,
    // An off-host redirect is a HIGH-confidence observation about the URL we
    // were given and a LOW-confidence one about the business, so the row says
    // what it is and nothing infers from it here. ProspectInference is where a
    // "this domain is parked" claim belongs, and that is a different stage.
    confidence: 1.0,
  });
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

/** The rows for a whole crawl, in page order. */
export function crawlEvidence(pages = []) {
  return (Array.isArray(pages) ? pages : [pages]).filter(Boolean).flatMap((p) => pageEvidence(p));
}
