// lib/sales/intel/technology.js
//
// Whose software a prospect is already running — matched deterministically
// against `TechnologySignature.patterns`, which is DATA in the database.
//
// ══ Why there is no model anywhere in this file ════════════════════════════
//
// The spec's §58 is explicit that fingerprinting is not an AI task, and the
// reason is not purity. A competitor detection is a FACT that a rep reads
// aloud: "you're already on Jobber, so let's talk about whose name is on the
// paperwork." A model that guessed at that would be confidently wrong perhaps
// one call in twenty, and the contractor on the other end knows which software
// they pay for. The fact/inference split in the schema only means anything if
// the fact layer is produced by something that cannot guess.
//
// So: substring and host matching over strings a crawler actually saw, each
// match producing a `ProspectEvidence` row that names the pattern that fired.
// "Why do we think they run Housecall Pro" is answered by a join.
//
// ══ The input contract, and why it is declared HERE ════════════════════════
//
// The crawler is a separate piece of work. If this file matched against
// whatever shape the crawler happened to return, the two would drift and the
// seam would be a rewrite rather than an adapter. So the contract is declared
// here, `normalisePage()` is the ONLY door into it, and a crawler whose output
// differs is adapted by one function rather than by editing the matcher.
//
// A PageSnapshot — every field optional, nothing invented when absent:
//
//   {
//     url, finalUrl   the requested and post-redirect URLs
//     status          HTTP status. null means we never got one.
//     ok              did this page load. null means unknown, NOT false.
//     blocked         true when a host refused us (403/429/robots). See below.
//     error           a transport failure, as a string
//     html            the raw markup
//     text            visible text, already stripped of tags
//     scripts[]       <script src> values, absolute where the crawler could
//     iframes[]       <iframe src> values
//     links[]         <a href> values. May ALSO be given as
//                     { href, url, text } objects — the crawler keeps the
//                     anchor text because half of a contractor's routes are
//                     /contact-us-2 and the only thing that says what a link
//                     is is the word on the button. Both spellings normalise
//                     to `links` (strings) plus `linkTexts` ({ href, text }).
//     buttons[]       button/submit labels, as strings or { text }
//     stylesheets[]   <link rel=stylesheet href> values
//     meta{}          name/property -> content, lower-cased keys
//     headers{}       lower-cased response headers
//     cookies[]       cookie NAMES only. Never values — a session cookie's
//                     value is somebody's credential and has no business in
//                     an evidence row.
//     forms[]         { action, method, id, className, fields[], text }
//   }
//
// ══ blocked is not the same as failed, and neither is the same as empty ════
//
// This distinction is the whole reason capabilityDetect.js can ever say
// "false". A 403 means we were PREVENTED from looking; a 200 with an empty
// body means we looked and there was nothing; a DNS failure means we never
// got as far as looking. Collapsing them is how a rep tells a contractor they
// have no booking page when the crawler was rate-limited on the way to it.
//
// ══ Loose kinds cannot produce a detection on their own ════════════════════
//
// `html` and `text` patterns are substring matches over a page's own words.
// A painting company's blog post about "the best jobber alternatives" contains
// the string; so does a testimonial that names a competitor. Those are not
// installations. So a signature matched ONLY on loose kinds is capped below
// the detection threshold and is never emitted — the same shape as
// confidence.js's FUZZY_CEILING, and for the same reason: a weak signal may
// reinforce a strong one, it may not stand alone.
//
// The cost of that rule, stated rather than hidden: a footer that says
// "Powered by Markate" with no Markate script on the page produces no
// detection. That is the safe direction, and the evidence row still exists.

/** Bumped when a change alters what this detector DECIDES, so a stored
 *  ProspectEvidence row keeps citing the version that produced it. A comment
 *  fix is not a version. */
export const DETECTOR_NAME = "technology";
export const DETECTOR_VERSION = "1";

/**
 * The closed set of pattern kinds.
 *
 * Declared here rather than in the admin editor because the MATCHER decides
 * what a kind means. configAdmin.js imports this: a superadmin must not be
 * able to save a kind nothing matches, which would be a configuration screen
 * writing rows that never fire.
 */
export const STRUCTURAL_KINDS = Object.freeze([
  // A <script src>. The strongest single signal there is: the browser fetched
  // somebody's code from somebody's host.
  "script_src",
  // An <iframe src> host. Nearly as strong — an embedded booking widget.
  "iframe_host",
  // An <a href> or <link href> host. Weaker than a script: a link to a
  // competitor is sometimes just a link. Weight accordingly in the seed.
  "link",
  // A <meta name=... content=...>. `generator` is how site builders announce
  // themselves.
  "meta",
  // A cookie NAME. Set by the widget's own script, so it is structural.
  "cookie",
]);

export const LOOSE_KINDS = Object.freeze([
  // A substring of the raw markup. Class names, container ids, inline config.
  "html",
  // A substring of the visible text. "Powered by X" lives here.
  "text",
]);

export const PATTERN_KINDS = Object.freeze([...STRUCTURAL_KINDS, ...LOOSE_KINDS]);

/** A detection is emitted at or above this. Below it, the signature matched
 *  something and we are not willing to say so out loud. */
export const DETECTION_THRESHOLD = 0.5;

/** The most a signature may score on `html`/`text` matches alone. Deliberately
 *  under DETECTION_THRESHOLD — see the header. */
export const LOOSE_CEILING = 0.45;

/** A loose pattern shorter than this is refused at validation: a four-letter
 *  substring of a page's prose is a coincidence, not a fingerprint. */
export const MIN_LOOSE_PATTERN = 6;

/** Evidence carries the string that matched, not the page. Long enough to be
 *  reviewable, short enough that a row is not a document. */
const MAX_EVIDENCE_VALUE = 400;

const MAX_PAGES = 200;

/* ═══════════════════════════════════════════════════════════════════════════
   Normalising the input
   ═══════════════════════════════════════════════════════════════════════ */

function str(v) {
  return typeof v === "string" ? v : null;
}

function strArray(v, cap = 500) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    const s = typeof item === "string" ? item.trim() : null;
    if (s) out.push(s);
    if (out.length >= cap) break;
  }
  return out;
}

/**
 * A list of URLs that may have arrived as strings or as records.
 *
 * `{ href, url }` and `{ src, url }` both appear, and `url` is the absolute
 * form when the extractor could resolve it. The absolute one is preferred
 * because a relative `/wp-content/x.js` has no host to match on — but the
 * relative one is kept too, since a path pattern must still be able to see it.
 */
function urlArray(v, cap = 500) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    if (typeof item === "string") {
      const s = item.trim();
      if (s) out.push(s);
    } else if (item && typeof item === "object") {
      const absolute = typeof item.url === "string" ? item.url.trim() : "";
      const relative =
        typeof item.href === "string"
          ? item.href.trim()
          : typeof item.src === "string"
            ? item.src.trim()
            : "";
      if (absolute) out.push(absolute);
      if (relative && relative !== absolute) out.push(relative);
    }
    if (out.length >= cap) break;
  }
  return out;
}

function linkTextArray(v, cap = 500) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const text = typeof item.text === "string" ? item.text.trim() : "";
    if (!text) continue;
    out.push({
      href: (typeof item.url === "string" && item.url) || (typeof item.href === "string" && item.href) || null,
      text,
    });
    if (out.length >= cap) break;
  }
  return out;
}

function labelArray(v, cap = 200) {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    const text =
      typeof item === "string" ? item.trim() : item && typeof item.text === "string" ? item.text.trim() : "";
    if (text) out.push(text);
    if (out.length >= cap) break;
  }
  return out;
}

function plainObject(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out = {};
  for (const [k, val] of Object.entries(v)) {
    if (typeof k !== "string") continue;
    out[k.toLowerCase()] = typeof val === "string" ? val : val == null ? "" : String(val);
  }
  return out;
}

/**
 * True when a status code means "the host refused to let us look".
 *
 * 401/403 is an explicit refusal; 429 is "you are asking too often". Both mean
 * the page might contain the signal and we were stopped. A 404 is NOT here on
 * purpose: a missing page is a real observation about the site, and a crawler
 * that asked for /booking and got a 404 has learned something.
 */
export function statusIsBlocked(status) {
  return status === 401 || status === 403 || status === 429 || status === 451;
}

/**
 * Coerce whatever the crawler produced into a PageSnapshot.
 *
 * Hostile-input safe by construction: every field is read through a coercer
 * that returns a known-empty value rather than throwing, because this runs
 * against other people's websites and the crawler is another agent's code.
 *
 * `ok` is three-valued and computed only from what was actually observed:
 * a 2xx with a body is true, an explicit error or a non-2xx is false, and a
 * snapshot that says nothing about either stays null. Defaulting it to false
 * would turn "we have not looked" into "we looked and it is broken".
 */
export function normalisePage(raw) {
  const page = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  const status = Number.isInteger(page.status) ? page.status : null;
  const html = str(page.html);
  const error = str(page.error);

  // A document is anything the extractor kept — raw markup OR the text it
  // pulled out of it. The crawler in this repo keeps the second and not the
  // first, and requiring `html` here would have made every crawler-sourced
  // page read as "did not load", which is the null-vs-false failure arriving
  // through the normaliser instead of through the detector.
  const document = html || str(page.text);

  let ok = null;
  if (typeof page.ok === "boolean") ok = page.ok;
  else if (error) ok = false;
  else if (status != null) ok = status >= 200 && status < 300 && !!document;

  const blocked =
    page.blocked === true || (page.blocked !== false && status != null && statusIsBlocked(status));

  return {
    url: str(page.url),
    finalUrl: str(page.finalUrl) || str(page.url),
    status,
    ok,
    blocked,
    error,
    html,
    text: str(page.text),
    scripts: urlArray(page.scripts),
    iframes: urlArray(page.iframes),
    links: urlArray(page.links),
    linkTexts: linkTextArray(page.links),
    buttons: labelArray(page.buttons),
    stylesheets: urlArray(page.stylesheets),
    schema: strArray(page.schema, 100),
    domAttrs: strArray(page.domAttrs, 300),
    meta: plainObject(page.meta),
    headers: plainObject(page.headers),
    cookies: strArray(page.cookies, 100),
    forms: normaliseForms(page.forms),
    truncated: page.truncated === true,
  };
}

function normaliseForms(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 50).map((f) => {
    const form = f && typeof f === "object" && !Array.isArray(f) ? f : {};
    return {
      action: str(form.action),
      method: (str(form.method) || "get").toLowerCase(),
      id: str(form.id),
      className: str(form.className) || str(form.class),
      text: str(form.text),
      fields: Array.isArray(form.fields)
        ? form.fields.slice(0, 60).map((x) => {
            const field = x && typeof x === "object" && !Array.isArray(x) ? x : {};
            return {
              name: str(field.name) || "",
              type: (str(field.type) || "text").toLowerCase(),
              tag: (str(field.tag) || "input").toLowerCase(),
              placeholder: str(field.placeholder) || "",
            };
          })
        : [],
    };
  });
}

/**
 * A crawl: the pages, plus what the crawler is prepared to SAY about its own
 * completeness.
 *
 * `complete` is three-valued and stays that way. An explicit `false` is a veto
 * on concluding absence; a `null` is neither a veto nor a licence, and nothing
 * downstream reads it as true. What actually earns the right to say "absent"
 * is the observed page outcomes — see capabilityDetect.js's
 * `absenceEligibility`.
 */
export function normaliseCrawl(raw) {
  // A bare array of pages is a legitimate spelling and the commonest one a
  // caller reaches for. Handled first, because folding it into the object
  // branch below turns it into `{}` and silently loses every page.
  const input = Array.isArray(raw)
    ? { pages: raw }
    : raw && typeof raw === "object"
      ? raw
      : {};
  const list = Array.isArray(input.pages) ? input.pages : [];
  const pages = list.slice(0, MAX_PAGES).map(normalisePage);

  return {
    pages,
    complete: typeof input.complete === "boolean" ? input.complete : null,
    error: str(input.error),
    // Derived, not trusted: a crawl that says nothing about being blocked but
    // carries a 403 page IS blocked.
    blocked: pages.some((p) => p.blocked) || input.blocked === true,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   The adapter: stored ProspectEvidence rows back into PageSnapshots
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Rebuild a crawl from the evidence rows the crawler wrote.
 *
 * ── Why this is an adapter and not a schema ───────────────────────────────
 *
 * lib/sales/crawl/ does not keep raw markup. It extracts a page into typed
 * `ProspectEvidence` rows — one per script src, one per iframe, one per link
 * (href AND anchor text), a `page_fetch` envelope carrying the HTTP outcome —
 * and stores those. That is the right call for storage and it means this file
 * has to read them back rather than being handed a document.
 *
 * The whole coupling to the crawler lives in this ONE function, which is the
 * point: the matcher above knows nothing about how a page reached it, and a
 * crawler that changes its row shapes changes this function only.
 *
 * ── What the envelope decides ─────────────────────────────────────────────
 *
 * `page_fetch` is the only row that says whether the page LOADED, so it is the
 * only thing that sets `ok`, `blocked` and `error`. A page with content rows
 * and no envelope has an unknown outcome and stays unknown — inferring
 * "well, there is text, so it must have been a 200" would be a default
 * standing in for a missing statement, which is the exact thing this whole
 * subsystem is written to avoid.
 *
 * ── An off-host redirect is not this business's website ───────────────────
 *
 * A parked domain redirects to a registrar's holding page. Crawling that and
 * concluding "no booking, no forms, no phone number" would be a set of true
 * statements about the wrong website. So an off-host page is marked not-ok.
 */
export function pagesFromEvidence(rows = []) {
  const byUrl = new Map();
  const get = (url) => {
    const key = url || "(unknown)";
    if (!byUrl.has(key)) {
      byUrl.set(key, {
        url: url || null,
        finalUrl: url || null,
        status: null,
        ok: null,
        blocked: false,
        error: null,
        truncated: false,
        html: null,
        text: null,
        scripts: [],
        iframes: [],
        links: [],
        stylesheets: [],
        meta: {},
        cookies: [],
        forms: [],
        buttons: [],
        schema: [],
        domAttrs: [],
      });
    }
    return byUrl.get(key);
  };

  for (const raw of Array.isArray(rows) ? rows : []) {
    if (!raw || typeof raw !== "object") continue;
    const page = get(str(raw.sourceUrl));
    const rawValue = str(raw.rawValue);
    const normalized = str(raw.normalizedValue);

    switch (raw.type) {
      case "page_fetch": {
        const envelope = parseJson(rawValue) || {};
        page.status = Number.isInteger(envelope.status) ? envelope.status : null;
        page.error = str(envelope.error);
        page.truncated = envelope.truncated === true;
        page.finalUrl = str(envelope.finalUrl) || page.finalUrl;
        page.url = str(envelope.requestedUrl) || page.url;
        if (envelope.timedOut === true && !page.error) page.error = "timeout";
        if (envelope.offHost === true) {
          page.ok = false;
          page.error = page.error || "off_host_redirect";
        }
        page.blocked = statusIsBlocked(page.status);
        break;
      }
      case "page_content":
        page.text = [page.text, rawValue].filter(Boolean).join("\n") || null;
        break;
      case "meta": {
        // "name=content", written that way by the crawler and by hand in the
        // signature editor. Split on the FIRST `=` only: a content value can
        // contain them.
        const at = (rawValue || "").indexOf("=");
        if (at > 0) page.meta[rawValue.slice(0, at).toLowerCase()] = rawValue.slice(at + 1);
        break;
      }
      case "script_src":
        pushBoth(page.scripts, normalized, rawValue);
        break;
      case "iframe_host":
        // The row keeps the src raw and the HOST normalised. Both go in: a
        // host-only pattern matches the second, a host+path pattern needs the
        // first.
        pushBoth(page.iframes, rawValue, normalized);
        break;
      case "link": {
        const link = parseJson(rawValue);
        const href = normalized || (link && str(link.href));
        if (href) page.links.push({ href, url: normalized, text: link ? str(link.text) : null });
        break;
      }
      case "form": {
        const form = parseJson(rawValue);
        if (form) page.forms.push(form);
        break;
      }
      case "button":
        if (rawValue) page.buttons.push(rawValue);
        break;
      case "schema_org":
        pushBoth(page.schema, rawValue, normalized);
        break;
      case "dom_attr":
        if (rawValue) page.domAttrs.push(rawValue);
        break;
      default:
        break;
    }
  }

  // Deliberately NOT normalisePage'd here. This returns the raw shape and
  // lets normaliseCrawl do the single normalising pass — running it twice
  // would flatten `links` from records into strings on the first pass and then
  // find no anchor text to keep on the second, which is a real bug this file
  // had and the check now names.
  const pages = [...byUrl.values()];
  // A truncated body is a real, observed statement that we did not see all of
  // a page — so the crawl is incomplete, and capabilityDetect.js's deep
  // absence is vetoed. Note the asymmetry that matters: nothing here ever sets
  // `complete: true`. Saying a crawl was complete is the crawler's claim to
  // make, not a conclusion to reach from the rows it left behind.
  const truncated = pages.some((p) => p.truncated);
  return { pages, complete: truncated ? false : null, error: null, blocked: pages.some((p) => p.blocked) };
}

function pushBoth(list, a, b) {
  if (a) list.push(a);
  if (b && b !== a) list.push(b);
}

function parseJson(value) {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

/** Pages that actually loaded — the only ones an absence may be argued from. */
export function loadedPages(crawl) {
  return (crawl?.pages || []).filter((p) => p.ok === true);
}

/* ═══════════════════════════════════════════════════════════════════════════
   Matching
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * The host of a URL, lower-cased, `www.` stripped, or null.
 *
 * Deliberately tolerant: a crawler may hand us a protocol-relative
 * `//embed.tawk.to/...` or a bare `embed.tawk.to/...`, and both are the same
 * observation. Anything unparseable returns null rather than throwing — this
 * runs over other people's markup.
 */
export function hostOf(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  let candidate = raw;
  if (candidate.startsWith("//")) {
    // Protocol-relative: `//embed.tawk.to/...` is a host.
    candidate = `https:${candidate}`;
  } else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) {
    // No scheme. This is where a relative href lives, and it is the one case
    // that must NOT be given a scheme and parsed: `new URL("https:///booking")`
    // resolves to the HOST "booking", so `/booking` would report a host it does
    // not have and a link pattern for `booking.example` would then match every
    // site with a /booking page.
    //
    // One test covers both spellings. A root-relative `/booking` splits to an
    // empty authority; a document-relative `about/us` splits to `about`. A real
    // host has a dot in it and neither of those does, so both are refused here.
    // (Written as one check rather than two deliberately: a `startsWith("/")`
    // guard beside this one would be unreachable, and an unreachable guard is a
    // line nobody can break and nobody can test.)
    const authority = candidate.split(/[/?#]/, 1)[0];
    if (!authority.includes(".")) return null;
    candidate = `https://${candidate}`;
  }

  try {
    const host = new URL(candidate).hostname.toLowerCase();
    if (!host) return null;
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return null;
  }
}

/**
 * Does `host` equal `pattern`, or is it a subdomain of it?
 *
 * Suffix matching rather than `includes`, because `includes` makes
 * `notjobber.com` match `jobber.com` and `evil-getjobber.com.attacker.net`
 * match everything. A fingerprint that can be spoofed by registering a
 * lookalike domain is worse than none, because it goes into a rep's script
 * with the word "detected" on it.
 */
export function hostMatches(host, pattern) {
  if (!host || !pattern) return false;
  const want = String(pattern).trim().toLowerCase().replace(/^www\./, "").replace(/^\.+|\.+$/g, "");
  if (!want) return false;
  if (host === want) return true;
  return host.endsWith(`.${want}`);
}

/**
 * One pattern against one page.
 *
 * Returns the STRING THAT MATCHED, not merely true. An evidence row that says
 * "the jobber pattern matched" is unreviewable; one that says
 * "https://d3ey4dbjkt2f6s.cloudfront.net/assets/external/work_request_embed.js"
 * can be argued with.
 */
export function matchPattern(pattern, page) {
  const kind = pattern?.kind;
  const needle = typeof pattern?.pattern === "string" ? pattern.pattern.trim() : "";
  if (!PATTERN_KINDS.includes(kind) || !needle) return null;

  if (kind === "script_src") return matchUrlList(page.scripts, needle);
  if (kind === "iframe_host") return matchUrlList(page.iframes, needle);
  // Stylesheets are matched as links rather than as scripts: a vendor's
  // stylesheet is a <link>, and putting it under script_src would make a
  // pattern written for one kind fire on the other.
  if (kind === "link") return matchUrlList([...page.links, ...page.stylesheets], needle);

  if (kind === "cookie") {
    const want = needle.toLowerCase();
    const hit = page.cookies.find((c) => c.toLowerCase() === want);
    return hit ? { value: hit } : null;
  }

  if (kind === "meta") {
    // "name=substring" targets one tag; a bare string searches every value.
    // Both spellings exist in the wild fingerprint databases and refusing one
    // would silently drop half the signatures somebody pastes in.
    const eq = needle.indexOf("=");
    if (eq > 0) {
      const key = needle.slice(0, eq).trim().toLowerCase();
      const want = needle.slice(eq + 1).trim().toLowerCase();
      const value = page.meta[key];
      if (typeof value === "string" && want && value.toLowerCase().includes(want)) {
        return { value: `${key}=${value}` };
      }
      return null;
    }
    const want = needle.toLowerCase();
    for (const [k, v] of Object.entries(page.meta)) {
      if (typeof v === "string" && v.toLowerCase().includes(want)) return { value: `${k}=${v}` };
    }
    return null;
  }

  if (kind === "html") return matchSubstring(markupOf(page), needle);
  return matchSubstring(page.text, needle);
}

/**
 * What an `html` pattern is matched against.
 *
 * Raw markup when we have it. When we do not — and the crawler in this repo
 * deliberately does NOT keep 40 KB of markup per page, it keeps a structured
 * extraction — the haystack is the machine-readable residue it did keep:
 * data-* attributes, schema.org blocks, script and iframe URLs, link hrefs,
 * form descriptors and button labels.
 *
 * Said plainly because it changes what an `html` pattern can do: a pattern
 * targeting a CSS class name will match a page snapshot that carries raw
 * markup and will NOT match one reconstructed from stored evidence. That is
 * survivable precisely because `html` is a LOOSE kind and cannot carry a
 * detection on its own — every signature in the seed reaches the threshold on
 * script, iframe, link or meta patterns, all of which the extraction keeps.
 * If that ever stops being true, this comment is where the bug will be.
 */
export function markupOf(page) {
  if (typeof page?.html === "string" && page.html) return page.html;
  const parts = [
    ...(page?.domAttrs || []),
    ...(page?.schema || []),
    ...(page?.scripts || []),
    ...(page?.iframes || []),
    ...(page?.stylesheets || []),
    ...(page?.links || []),
    ...(page?.buttons || []),
    ...(page?.forms || []).map((f) => JSON.stringify(f)),
  ];
  return parts.join("\n");
}

/** How much document there is, however it reached us. */
export function contentSize(page) {
  const html = typeof page?.html === "string" ? page.html.length : 0;
  const text = typeof page?.text === "string" ? page.text.length : 0;
  return Math.max(html, text);
}

/**
 * Split a URL pattern into the host it claims and the path fragment it claims.
 *
 * Three shapes exist in the wild and all three are written by hand into a Json
 * column, so all three are supported explicitly rather than by accident:
 *
 *   "connect.podium.com"                    host only
 *   "markate.com/public/widget"             host AND path
 *   "/wp-content/"                          path only — every WordPress install
 *
 * The distinction matters because a bare `includes` on the whole URL makes
 * `notjobber.com` match `jobber.com`, and makes
 * `attacker.example/?u=clienthub.getjobber.com` match too. A host claim is
 * therefore always checked as a HOST (suffix, dot-anchored) and never as a
 * substring.
 */
export function splitUrlPattern(needle) {
  const trimmed = String(needle || "").trim();
  if (!trimmed) return { host: null, path: null };
  if (trimmed.startsWith("/")) return { host: null, path: trimmed.replace(/^\/+/, "").toLowerCase() };

  const slash = trimmed.indexOf("/");
  if (slash === -1) return { host: hostOf(trimmed), path: null };
  return {
    host: hostOf(trimmed.slice(0, slash)),
    path: trimmed.slice(slash).replace(/^\/+/, "").toLowerCase(),
  };
}

function matchUrlList(list, needle) {
  const { host: wantHost, path: wantPath } = splitUrlPattern(needle);
  if (!wantHost && !wantPath) return null;

  for (const value of list) {
    if (wantHost && !hostMatches(hostOf(value), wantHost)) continue;
    if (wantPath) {
      // Compared against path + query rather than the whole URL, so a pattern
      // cannot be satisfied by text in a host or a fragment. Leading slashes
      // are stripped from both sides because a real URL's path carries a
      // version segment the pattern does not know about — Meta's chat iframe
      // is /v9.0/plugins/customerchat/, and a pattern anchored at / would
      // never match it.
      if (!urlTail(value).includes(wantPath)) continue;
    }
    return { value: clip(value) };
  }
  return null;
}

/** A URL's path and query, lower-cased, with no leading slash. Falls back to
 *  the raw string when the value will not parse — a crawler can hand us a
 *  relative href, and refusing to look at it would silently drop matches. */
function urlTail(value) {
  const host = hostOf(value);
  if (!host) return String(value).toLowerCase().replace(/^\/+/, "");
  let candidate = String(value).trim();
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const u = new URL(candidate);
    return `${u.pathname}${u.search}`.toLowerCase().replace(/^\/+/, "");
  } catch {
    return String(value).toLowerCase().replace(/^\/+/, "");
  }
}

function matchSubstring(haystack, needle) {
  if (typeof haystack !== "string" || !haystack) return null;
  const at = haystack.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) return null;
  // A window around the hit, so the evidence row shows the match IN CONTEXT.
  // "jobber-work-request" on its own does not tell a reviewer whether it came
  // from a class attribute or from a sentence.
  const from = Math.max(0, at - 60);
  return { value: clip(haystack.slice(from, at + needle.length + 60)) };
}

function clip(value) {
  const s = String(value);
  return s.length > MAX_EVIDENCE_VALUE ? `${s.slice(0, MAX_EVIDENCE_VALUE)}…` : s;
}

/**
 * Combine weights into one confidence.
 *
 * Noisy-OR (1 - Π(1-w)) rather than a sum or a max. A sum passes 1.0 and stops
 * meaning anything; a max throws away the fact that three independent things
 * agreed. Noisy-OR treats each pattern as an independent chance of being right,
 * which is the actual claim: the script host, the iframe host and the meta tag
 * are three separate observations of the same installation.
 *
 * Rounded to two places because ProspectTechnology.confidence is Decimal(3,2)
 * and a figure the database cannot store is a figure that changes when it is
 * written.
 */
export function combineWeights(weights = []) {
  let miss = 1;
  for (const w of weights) {
    const n = Number(w);
    if (!Number.isFinite(n) || n <= 0) continue;
    miss *= 1 - Math.min(n, 1);
  }
  const value = 1 - miss;
  // Never 1.00. A fingerprint is very good evidence and it is not proof: the
  // markup could be a stale snippet from a platform the contractor left last
  // year. Reserving certainty keeps that honest.
  return Math.round(Math.min(value, 0.99) * 100) / 100;
}

/**
 * Every way a PATTERN LIST can be unusable, said in full rather than one at a
 * time.
 *
 * The superadmin editor calls this too (see configAdmin.js). One validator,
 * because an editor that accepts a pattern the matcher will ignore is a
 * configuration screen that appears to work and doesn't — and the reverse, a
 * matcher rule the editor does not enforce, is a signature that saves cleanly
 * and never fires.
 */
export function patternListProblems(patterns) {
  const problems = [];
  if (!Array.isArray(patterns)) return ["patterns must be a JSON list"];
  if (patterns.length === 0) {
    problems.push("a signature with no patterns can never match anything");
  }

  patterns.forEach((p, i) => {
    const at = `pattern ${i + 1}`;
    if (!p || typeof p !== "object" || Array.isArray(p)) {
      problems.push(`${at}: each pattern is an object`);
      return;
    }
    if (!PATTERN_KINDS.includes(p.kind)) {
      problems.push(`${at}: kind must be one of ${PATTERN_KINDS.join(", ")}`);
    }
    const pattern = typeof p.pattern === "string" ? p.pattern.trim() : "";
    if (!pattern) {
      problems.push(`${at}: pattern must be a non-empty string`);
    } else if (LOOSE_KINDS.includes(p.kind) && pattern.length < MIN_LOOSE_PATTERN) {
      problems.push(
        `${at}: an ${p.kind} pattern under ${MIN_LOOSE_PATTERN} characters matches prose, not markup`,
      );
    }
    if (p.weight != null) {
      const w = Number(p.weight);
      if (!Number.isFinite(w) || w <= 0 || w > 1) {
        problems.push(`${at}: weight is a number above 0 and at most 1`);
      }
    }
  });

  return problems;
}

/** The same, plus the fields only a whole signature has. */
export function signatureProblems(signature) {
  const problems = [];
  const code = typeof signature?.code === "string" ? signature.code.trim() : "";
  if (!code) problems.push("a signature needs a code");
  return problems.concat(patternListProblems(signature?.patterns));
}

/**
 * One signature against a whole crawl.
 *
 * ── Why a malformed pattern is skipped and the signature is not ───────────
 *
 * `patterns` is a Json column a human edits. One bad entry among six must not
 * silence the other five, and it must not throw out of a pipeline handler
 * either — a JSON typo would then look like a crawl failure. So the bad entry
 * is reported in `problems` and ignored, and the signature matches on what is
 * left. A signature with NO usable pattern matches nothing at all, which is
 * the honest outcome rather than a zero-confidence detection.
 */
export function matchSignature(signature, pages = []) {
  const problems = [];
  const patterns = Array.isArray(signature?.patterns) ? signature.patterns : [];
  if (!Array.isArray(signature?.patterns)) problems.push("patterns is not a list");

  const evidence = [];
  // Keyed by the STRING THAT MATCHED, not by the pattern. Two patterns written
  // at two grains — "connect.podium.com" at 0.9 and "podium.com" at 0.8 —
  // are one observation of one script tag, and noisy-OR-ing them would score
  // 0.98 for something a single pattern scores 0.90 for. Only the strongest
  // weight per distinct observation counts. This is the same argument as
  // breaking out of the page loop below: confidence tracks how many separate
  // things were seen, never how many ways of describing them were written.
  const byObservation = new Map();
  let structural = false;

  patterns.forEach((pattern, i) => {
    const bad = patternProblems(pattern);
    if (bad) {
      problems.push(`pattern ${i + 1}: ${bad}`);
      return;
    }
    const weight = pattern.weight == null ? 0.5 : Number(pattern.weight);

    for (const page of pages) {
      const hit = matchPattern(pattern, page);
      if (!hit) continue;
      if (STRUCTURAL_KINDS.includes(pattern.kind)) structural = true;
      const key = `${pattern.kind}|${hit.value}`;
      byObservation.set(key, Math.max(byObservation.get(key) || 0, weight));
      evidence.push({
        type: pattern.kind,
        source: "website",
        sourceUrl: page.finalUrl,
        rawValue: hit.value,
        normalizedValue: `${pattern.kind}:${pattern.pattern}`,
        confidence: Math.min(Math.max(weight, 0), 1),
        detector: DETECTOR_NAME,
        detectorVersion: DETECTOR_VERSION,
      });
      // One page is enough for one pattern. Counting the same script tag on
      // nine pages of the same site as nine independent observations would
      // make a big site look more certain than a small one for no reason.
      break;
    }
  });

  const raw = combineWeights([...byObservation.values()]);
  // THE cap. Loose kinds are a page's own words about itself; on their own
  // they cannot carry a detection past the threshold. See the file header.
  const confidence = structural ? raw : Math.min(raw, LOOSE_CEILING);

  return {
    code: typeof signature?.code === "string" ? signature.code : null,
    matched: evidence.length > 0 && confidence >= DETECTION_THRESHOLD,
    structural,
    confidence,
    evidence,
    problems,
  };
}

function patternProblems(pattern) {
  if (!pattern || typeof pattern !== "object" || Array.isArray(pattern)) return "not an object";
  if (!PATTERN_KINDS.includes(pattern.kind)) return `unknown kind ${JSON.stringify(pattern.kind)}`;
  const value = typeof pattern.pattern === "string" ? pattern.pattern.trim() : "";
  if (!value) return "empty pattern";
  if (LOOSE_KINDS.includes(pattern.kind) && value.length < MIN_LOOSE_PATTERN) {
    return `${pattern.kind} pattern under ${MIN_LOOSE_PATTERN} characters`;
  }
  if (pattern.weight != null) {
    const w = Number(pattern.weight);
    if (!Number.isFinite(w) || w <= 0 || w > 1) return "weight outside (0, 1]";
  }
  return null;
}

/**
 * Every technology detected on a crawl.
 *
 * @param signatures  `TechnologySignature` rows as the database holds them.
 *                    INACTIVE ONES ARE SKIPPED HERE, not filtered by the
 *                    caller — a superadmin switching a signature off is an
 *                    instruction to stop detecting it, and a caller that
 *                    forgot the `where` would otherwise quietly ignore them.
 * @param crawl       anything normaliseCrawl understands.
 */
export function detectTechnologies({ signatures = [], crawl = null } = {}) {
  const normalised = normaliseCrawl(crawl);
  const pages = loadedPages(normalised);

  const technologies = [];
  const skipped = [];

  for (const signature of Array.isArray(signatures) ? signatures : []) {
    if (signature?.active === false) {
      skipped.push({ code: signature?.code ?? null, reason: "inactive" });
      continue;
    }
    // No page loaded: nothing was observed, so nothing is claimed. Note this
    // is not the same as "no technology found" — detectTechnologies never
    // asserts an absence, which is why ProspectTechnology has no false rows.
    if (pages.length === 0) {
      skipped.push({ code: signature?.code ?? null, reason: "no_pages_loaded" });
      continue;
    }

    const result = matchSignature(signature, pages);
    if (!result.matched) {
      if (result.evidence.length) {
        skipped.push({
          code: result.code,
          reason: result.structural ? "below_threshold" : "loose_only",
          confidence: result.confidence,
        });
      }
      continue;
    }

    technologies.push({
      technologyCode: result.code,
      // Copied from the signature at detection time, not derived on read.
      // The schema comment says why: reclassifying a technology later must not
      // rewrite what a rep was told last week.
      isCompetitor: signature.isCompetitor === true,
      confidence: result.confidence,
      signatureVersion: signature.version != null ? String(signature.version) : null,
      evidence: result.evidence,
      problems: result.problems,
    });
  }

  // Highest confidence first, then by code so the order is stable across runs
  // — an unstable order makes a diff of two analyses unreadable.
  technologies.sort((a, b) => b.confidence - a.confidence || a.technologyCode.localeCompare(b.technologyCode));

  return {
    technologies,
    skipped,
    pagesConsidered: pages.length,
    pagesSeen: normalised.pages.length,
    blocked: normalised.blocked,
  };
}

/** Whether any detected technology is a FieldQuo competitor — the one fact
 *  that changes the whole sales conversation. */
export function hasCompetitor(technologies = []) {
  return technologies.some((t) => t?.isCompetitor === true);
}
