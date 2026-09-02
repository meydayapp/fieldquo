// lib/sales/crawl/fingerprint.js
//
// What "the site has not changed" means, exactly. Pure.
//
// ══ WHAT THE HASH COVERS, AND WHY NOT THE BYTES ════════════════════════════
//
// Prospect.contentHash exists so that an unchanged site is not re-analysed —
// the spec's §20 caching. That only works if the hash is stable across fetches
// of an unchanged site, and hashing the response body is NOT stable. On a real
// contractor's WordPress site, two fetches sixty seconds apart differ in:
//
//   · the CSRF token and the `nonce=` on every inline script
//   · `?ver=6.4.2` cache-busting query strings that change on every plugin
//     update, and `?t=1756000000` ones that change on every request
//   · a rotating testimonial, a "12 people viewing" widget, an ad slot id
//   · whitespace, because the page is assembled by a template on each hit
//
// Hashing bytes would report "changed" on every single crawl, which is the
// same as having no cache at all — and the cost is not CPU, it is an OpenAI
// call per prospect per crawl (ANALYZE_CAPABILITIES and DETECT_OPPORTUNITIES
// are both `openai` in kinds.js).
//
// So the hash covers the EXTRACTION, canonicalised:
//
//   INCLUDED, per page, in a fixed order:
//     · the page's path (host and scheme dropped — http→https is not a
//       content change, and it is a change we would otherwise report on every
//       site that installs a certificate)
//     · HTTP status
//     · title
//     · meta name=content pairs, sorted, minus the volatile ones (see
//       VOLATILE_META)
//     · script sources, sorted, WITHOUT their query strings
//     · iframe hosts + paths, sorted
//     · same-site link paths, sorted, without query strings
//     · form signatures: method + action path + sorted field names
//     · button labels, sorted
//     · JSON-LD blocks, whitespace-collapsed
//     · data-* attribute name=value pairs, sorted
//     · contact methods, sorted
//     · the visible text, whitespace-collapsed
//
//   EXCLUDED, deliberately:
//     · the raw bytes, and all response headers
//     · inline script and style BODIES — where the nonces live
//     · query strings on assets and links
//     · the order anything was found in — everything is sorted, so a shuffled
//       nav is not a content change
//     · the request time, the crawl duration, and every other fact about US
//       rather than about them
//
// ══ Why the version prefix, and what it costs ══════════════════════════════
//
// Changing what the hash covers changes every hash, so every prospect looks
// changed once and is re-analysed once. That is the correct outcome — the old
// digest genuinely no longer describes the same thing — and the prefix makes
// it visible in the column rather than mysterious. What it must NOT do is
// change silently, so it is a named constant and the check asserts it.
import { createHash } from "node:crypto";
import { canonicalKey } from "./url";

/** Bump ONLY when the canonical form below changes. Every prospect re-analyses
 *  once when it does. */
export const CONTENT_HASH_VERSION = "crawl-v1";

/**
 * Meta names whose content is per-request rather than per-page.
 *
 * Matched by substring on a lowercased name, because the same idea ships under
 * a dozen spellings (`csrf-token`, `_csrf`, `X-CSRF-TOKEN`, `request-id`).
 */
export const VOLATILE_META = ["csrf", "nonce", "token", "request-id", "correlation", "session", "timestamp"];

function isVolatileMeta(name) {
  const n = String(name || "").toLowerCase();
  return VOLATILE_META.some((v) => n.includes(v));
}

/** A URL reduced to what is stable about it: host + path, no query, no hash. */
export function stableUrl(value) {
  if (!value) return null;
  try {
    const u = new URL(String(value));
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${host}${path}`;
  } catch {
    // A src that will not parse is still a fact about the page — an inline
    // "src" template placeholder, say — so it is kept verbatim rather than
    // dropped, which would make two different pages hash the same.
    return String(value).slice(0, 300);
  }
}

const sorted = (values) => [...new Set(values.filter(Boolean).map(String))].sort();

/** The canonical, order-independent form of one page record. */
export function canonicalPage(page) {
  if (!page) return null;
  const url = page.finalUrl || page.requestedUrl || "";
  let path = "/";
  try {
    path = new URL(url).pathname.replace(/\/+$/, "") || "/";
  } catch {
    path = String(url || "/");
  }

  return {
    path,
    status: page.status ?? null,
    title: (page.title || "").replace(/\s+/g, " ").trim(),
    lang: page.lang || null,
    metas: sorted(
      (page.metas || [])
        .filter((m) => !isVolatileMeta(m?.name))
        .map((m) => `${String(m.name).toLowerCase()}=${String(m.content || "").replace(/\s+/g, " ").trim()}`),
    ),
    scripts: sorted((page.scripts || []).map((s) => stableUrl(s?.url || s?.src))),
    iframes: sorted((page.iframes || []).map((f) => stableUrl(f?.url || f?.src))),
    links: sorted((page.links || []).map((l) => stableUrl(l?.url || l?.href))),
    forms: sorted(
      (page.forms || []).map((f) => {
        const fields = sorted((f.fields || []).map((x) => `${x.name || ""}:${x.type || ""}`));
        return `${f.method || "get"} ${stableUrl(f.actionUrl) || f.action || ""} [${fields.join(",")}]`;
      }),
    ),
    buttons: sorted((page.buttons || []).map((b) => b?.text)),
    jsonLd: sorted((page.jsonLd || []).map((s) => String(s).replace(/\s+/g, " ").trim())),
    dataAttrs: sorted((page.dataAttrs || []).map((d) => `${d.name}=${d.value}`)),
    contacts: sorted((page.contacts || []).map((c) => `${c.kind}:${c.value}`)),
    text: String(page.text || "").replace(/\s+/g, " ").trim(),
  };
}

/**
 * The exact string that gets hashed. Exported so a check can diff two crawls
 * and SAY what changed, rather than reporting that two opaque digests differ.
 */
export function contentHashInput(pages = []) {
  const canonical = (Array.isArray(pages) ? pages : [pages])
    .filter(Boolean)
    .map((p) => ({ key: canonicalKey(p.finalUrl || p.requestedUrl || ""), page: canonicalPage(p) }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((x) => x.page);

  return JSON.stringify(canonical);
}

/**
 * The value written to Prospect.contentHash.
 *
 * Returns null for an empty crawl rather than the hash of an empty array. A
 * crawl that fetched nothing has learned nothing, and storing a digest for it
 * would make the NEXT crawl — the one that succeeds — look like a change from
 * a state that was never observed. Null keeps "we do not know" distinguishable
 * from "we know it is empty".
 */
export function contentHash(pages = []) {
  const list = (Array.isArray(pages) ? pages : [pages]).filter(Boolean);
  if (!list.length) return null;
  const digest = createHash("sha256").update(contentHashInput(list)).digest("hex");
  return `${CONTENT_HASH_VERSION}:${digest}`;
}

/**
 * Has the site changed since the stored hash?
 *
 * A null on EITHER side is "changed", and that is the safe direction: a
 * prospect never crawled must be analysed, and a crawl that produced nothing
 * must not be recorded as matching. The expensive mistake here is skipping
 * analysis of a site that did change; re-analysing one that did not costs an
 * OpenAI call.
 */
export function hasChanged(previousHash, nextHash) {
  if (!nextHash) return true;
  if (!previousHash) return true;
  return String(previousHash) !== String(nextHash);
}
