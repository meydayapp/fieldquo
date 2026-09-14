// lib/sales/crawl/html.js
//
// A tolerant HTML lexer, and the extraction of §8's list from the token
// stream. Pure: string in, plain object out. No DOM, no network, no eval.
//
// ══ THE PARSING DECISION, AND WHY IT IS THIS ONE ═══════════════════════════
//
// Adding a dependency is a real decision, so here is the whole argument.
//
// What we need is a FIXED list of facts — title, meta, visible text, forms,
// buttons, links, iframe srcs, script srcs, data-* attributes, JSON-LD,
// contact methods. We never need to query the document. There is no selector,
// no traversal, no mutation, no layout, no scripting. That is the entire
// requirement, and it is much smaller than what a DOM library sells.
//
// Rejected: a regex per field. This is the option that looks cheapest and is
// actually wrong, and the failures are not exotic:
//
//     <script>if (a < b) { document.write("</div>") }</script>
//     <a href="/search?q=a>b" title='He said "hi"'>Book</a>
//     <!-- <form action="/old"><input name="email"></form> -->
//
//   A per-field regex reads the first as an open <b> tag and a stray </div>,
//   the second as a tag ending at the > inside the attribute, and the third as
//   a real form. Every one of those produces a WRONG FACT rather than a
//   missing one, and a wrong fact is what a rep says out loud on a call. The
//   three cases above are in scripts/check-sales-crawl.mjs.
//
// Rejected: jsdom. It builds a full DOM, a window, a CSSOM and an event loop
// to answer questions we are not asking; it is tens of megabytes in a lambda
// that has a 45-second crawl budget; and it exists to EXECUTE pages, which is
// the last thing a crawler pointed at arbitrary third-party HTML should be
// able to do. Its own docs warn against running untrusted markup.
//
// Rejected: cheerio / parse5. This is the closest call, and parse5 is a
// genuinely excellent spec-compliant parser. Two reasons it loses here. First,
// what it buys is jQuery selectors and a spec-accurate tree — including
// foster-parenting, implied end tags and the full insertion-mode machinery —
// and none of that changes any answer we extract, because every fact on the
// list is available from a flat token stream. Second, the repo has 27
// dependencies and no HTML parser; the first one added becomes a supply-chain
// surface on the one code path that consumes bytes from strangers' servers.
// Paying that for selectors we do not use is the wrong trade.
//
// Chosen: ONE small lexer, below. It is not a spec-compliant parser and does
// not pretend to be — it has no tree, no implied end tags, no error recovery
// rules. What it does have is the part that makes regex wrong: a single scan
// that knows the difference between markup and text, handles quoted attribute
// values, skips comments and doctypes, and treats script/style/title/textarea
// as raw-text elements whose contents are not markup. That is roughly 120
// lines, it is exercised against hostile input by the check, and when it is
// wrong it is wrong by omitting a fact rather than by inventing one.
//
// The honest limit, stated rather than discovered later: a document that
// depends on implied end tags for STRUCTURE — an unclosed <form> swallowing
// the rest of the page, say — is read differently here than by a browser. That
// costs a field list, not a wrong claim, and the forms it affects are already
// broken in real browsers.
import { toE164 } from "@/lib/voice/numbers";
import { MAX_PAYLOAD_STRINGS, extractPayloadText, joinRenderedText, payloadKind } from "./structured";

// ── Caps ───────────────────────────────────────────────────────────────────
//
// Every list is capped. A page can be adversarial or merely enormous, and an
// uncapped extraction turns a 2 MB page into a hundred thousand evidence rows.

export const CAPS = {
  text: 40_000,
  links: 200,
  scripts: 60,
  iframes: 20,
  forms: 20,
  fieldsPerForm: 40,
  buttons: 40,
  metas: 60,
  jsonLd: 10,
  jsonLdChars: 20_000,
  dataAttrs: 60,
  contacts: 20,
  inlineScripts: 20,
  inlineTokens: 20,
  /** h1–h3 kept per page. A heading is the one piece of prose that names a
   *  section — "Gutter Guard Installation", "Why Choose Us" — and
   *  servicesOffered.js reads the trade-shaped ones. */
  headings: 30,
  headingChars: 120,
  /** Framework payloads read per page. One is the norm (`__NEXT_DATA__`);
   *  a second is a page that carries both a Nuxt state and a JSON island. */
  payloads: 2,
  /** How much of one inline script body is scanned. A loader is the first
   *  few lines of a tag; a 2 MB bundle inlined into the page is not going to
   *  reveal its vendor on line 40,000 and scanning it is what a hostile page
   *  would want. */
  inlineScanChars: 200_000,
};

/** Elements whose contents are text, not markup. */
const RAW_TEXT = new Set(["script", "style", "textarea", "title"]);

/** Elements whose boundaries are a line break in the visible text. */
const BLOCK = new Set([
  "address", "article", "aside", "blockquote", "br", "div", "dd", "dl", "dt",
  "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4",
  "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p", "pre", "section",
  "table", "td", "th", "tr", "ul",
]);

/** Elements whose text is never visible to a reader. */
const INVISIBLE = new Set(["script", "style", "template", "svg", "head", "title"]);

const NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  copy: "©", reg: "®", trade: "™", hellip: "…",
  mdash: "—", ndash: "–", lsquo: "‘", rsquo: "’",
  ldquo: "“", rdquo: "”", eacute: "é", egrave: "è",
  agrave: "à", ccedil: "ç", deg: "°", middot: "·",
  bull: "•", times: "×", euro: "€", pound: "£",
};

/**
 * Decode the entities that actually appear.
 *
 * Numeric references are decoded in full; named ones are decoded from the list
 * above and LEFT ALONE otherwise. Leaving `&thinsp;` as text is a cosmetic
 * flaw in a text field; guessing at it is not possible without shipping the
 * 2,231-entry HTML entity table, which is a dependency in all but name.
 */
export function decodeEntities(value) {
  const s = String(value ?? "");
  if (!s.includes("&")) return s;
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,31});/g, (whole, body) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X"
        ? Number.parseInt(body.slice(2), 16)
        : Number.parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return whole;
      // Surrogates are not characters; String.fromCodePoint would produce a
      // lone half and corrupt the string it lands in.
      if (code >= 0xd800 && code <= 0xdfff) return whole;
      try {
        return String.fromCodePoint(code);
      } catch {
        return whole;
      }
    }
    const named = NAMED_ENTITIES[body.toLowerCase()];
    return named === undefined ? whole : named;
  });
}

/**
 * Attributes of one tag, starting at the index just past the tag name.
 *
 * @returns { attrs, end, selfClosing } — `end` is the index after the ">".
 */
function readAttributes(src, start) {
  const attrs = {};
  let selfClosing = false;
  let pos = start;
  const n = src.length;

  while (pos < n) {
    while (pos < n && /\s/.test(src[pos])) pos++;
    if (pos >= n) break;

    if (src[pos] === ">") { pos++; break; }
    if (src[pos] === "/" && src[pos + 1] === ">") { selfClosing = true; pos += 2; break; }
    if (src[pos] === "/") { pos++; continue; }

    const nameStart = pos;
    while (pos < n && !/[\s/>=]/.test(src[pos])) pos++;
    const name = src.slice(nameStart, pos).toLowerCase();
    if (!name) { pos++; continue; }

    while (pos < n && /\s/.test(src[pos])) pos++;
    let value = "";
    if (src[pos] === "=") {
      pos++;
      while (pos < n && /\s/.test(src[pos])) pos++;
      const quote = src[pos];
      if (quote === '"' || quote === "'") {
        const end = src.indexOf(quote, pos + 1);
        if (end === -1) { value = src.slice(pos + 1); pos = n; }
        else { value = src.slice(pos + 1, end); pos = end + 1; }
      } else {
        const valueStart = pos;
        while (pos < n && !/[\s>]/.test(src[pos])) pos++;
        value = src.slice(valueStart, pos);
      }
    }
    // First wins. A duplicate attribute is what a browser does too, and the
    // second one is usually a templating accident.
    if (attrs[name] === undefined) attrs[name] = decodeEntities(value);
  }

  return { attrs, end: pos, selfClosing };
}

/**
 * Walk the document once, calling `visit` for every token.
 *
 * Token kinds: "open" { name, attrs, selfClosing }, "close" { name },
 * "text" { value } (entity-decoded), "raw" { name, value } (verbatim).
 */
export function forEachToken(html, visit) {
  const src = String(html ?? "");
  const n = src.length;
  let i = 0;
  let textStart = 0;

  const flushText = (end) => {
    if (end > textStart) {
      const chunk = src.slice(textStart, end);
      if (chunk) visit({ kind: "text", value: decodeEntities(chunk) });
    }
  };

  while (i < n) {
    const lt = src.indexOf("<", i);
    if (lt === -1) break;

    // A "<" that does not begin a tag is text — "5 < 6" is a real sentence on
    // real pages, and treating it as markup is how a regex-shaped reader loses
    // the rest of the document.
    const next = src[lt + 1];
    const startsTag = next === "!" || next === "/" || next === "?" || /[a-zA-Z]/.test(next || "");
    if (!startsTag) { i = lt + 1; continue; }

    flushText(lt);

    if (src.startsWith("<!--", lt)) {
      const end = src.indexOf("-->", lt + 4);
      i = end === -1 ? n : end + 3;
      textStart = i;
      continue;
    }
    if (next === "!" || next === "?") {
      const end = src.indexOf(">", lt);
      i = end === -1 ? n : end + 1;
      textStart = i;
      continue;
    }
    if (next === "/") {
      const m = /^<\/\s*([a-zA-Z][a-zA-Z0-9:_.-]*)/.exec(src.slice(lt, lt + 80));
      const end = src.indexOf(">", lt);
      i = end === -1 ? n : end + 1;
      textStart = i;
      if (m) visit({ kind: "close", name: m[1].toLowerCase() });
      continue;
    }

    const m = /^<([a-zA-Z][a-zA-Z0-9:_.-]*)/.exec(src.slice(lt, lt + 80));
    if (!m) { i = lt + 1; textStart = lt; continue; }

    const name = m[1].toLowerCase();
    const { attrs, end, selfClosing } = readAttributes(src, lt + m[0].length);
    visit({ kind: "open", name, attrs, selfClosing });
    i = end;
    textStart = end;

    if (!selfClosing && RAW_TEXT.has(name)) {
      // Raw text: the contents are NOT markup, which is the single property
      // that makes `document.write("</div>")` inside a script harmless here.
      const closeRe = new RegExp(`</\\s*${name}\\b`, "i");
      const rest = src.slice(end);
      const found = closeRe.exec(rest);
      const stop = found ? end + found.index : n;
      visit({ kind: "raw", name, value: src.slice(end, stop) });
      const after = src.indexOf(">", stop);
      i = after === -1 ? n : after + 1;
      textStart = i;
      if (found) visit({ kind: "close", name });
    }
  }

  flushText(n);
}

// ── What is read out of an inline <script>, and what is not ────────────────
//
// Inline script BODIES are otherwise discarded: they carry the per-request
// nonces the content hash must never see (fingerprint.js), and they are code
// this crawler must never execute. Both stay true. What changed is that a
// whole class of vendor is invisible without looking at them at all —
//
//     window.liveSiteAsyncInit = function(){ LiveSite.init({ id: 'WI-…' }) };
//     js.src = p + "d2ra6nuwn69ktl.cloudfront.net/assets/livesite.js?" + r;
//
// — is vcita's client portal, booking and payments widget, and it reaches the
// page through a script the page CREATES rather than one it declares. A
// gutter company running exactly this was told it had no portal, no booking
// and no way to pay, because the only `<script src>` tags on the page were
// jQuery and the site builder's runtime.
//
// So two narrow things are read, and nothing else:
//
//   1. URL literals of scripts the body would load — `https://…/x.js`,
//      `//cdn…/x.js`, and the quoted host-relative `"host.tld/path.js"` form
//      vcita's own snippet uses (the scheme is a separate variable). These
//      become `script_src` evidence exactly as a declared tag would, so the
//      signature vocabulary needs no new kind. Stored WITHOUT the query: the
//      `?` + timestamp on the end is the nonce class of thing.
//   2. A short allow-list of vendor init tokens — `LiveSite.init`,
//      `HCPWidget`, `Calendly.initInlineWidget` — the words a vendor's own
//      snippet contains and nobody else's does. These are LOOSE evidence: an
//      `html` pattern may cite them, and technology.js caps loose kinds below
//      the detection threshold, so a token alone never claims a vendor.
//
// The body itself is never stored, never hashed and never returned. Bounded:
// one scan per tag over at most CAPS.inlineScanChars, twenty of each per
// page, and a path length cap on the URL pattern so a long string literal
// cannot make the regex quadratic.

/** `https://host/path.js`, `//host/path.js`, or a quoted bare `host/path.js`. */
const INLINE_SCRIPT_URL_RE =
  /(?:(?:https?:)?\/\/|["'`])((?:[a-z0-9-]{1,63}\.){1,6}[a-z]{2,24})(\/[a-z0-9_\-./%]{0,300}?\.js)(?=[?#"'`\s<>),;]|$)/gi;

/**
 * Vendor init tokens. Each entry is the canonical token stored, and the
 * pattern that finds it. Case matters where the vendor's own casing is the
 * fingerprint (`LiveSite.init`, `HCPWidget`); a bare lower-case brand name is
 * matched as a word so "vcita" in a URL or a config key counts and
 * "advcitation" does not.
 */
export const INLINE_VENDOR_TOKENS = Object.freeze([
  { token: "LiveSite.init", re: /\bLiveSite\.init\b/ },
  { token: "vcita", re: /\bvcita\b/i },
  { token: "livesite_active_engage", re: /\blivesite_active_engage\b/ },
  { token: "HCPWidget", re: /\bHCPWidget\b/ },
  { token: "hcp-button", re: /\bhcp-button\b/ },
  { token: "clienthub_id", re: /\bclienthub_id\b/ },
  { token: "work_request_embed", re: /\bwork_request_embed\b/ },
  { token: "PodiumWebChat", re: /\bPodiumWebChat\b/ },
  { token: "podium-website-widget", re: /\bpodium-website-widget\b/ },
  { token: "bfiframe", re: /\bbfiframe\b/ },
  { token: "birdeye", re: /\bbirdeye\b/i },
  { token: "thryv", re: /\bthryv\b/i },
  { token: "Calendly.initInlineWidget", re: /\bCalendly\.init(?:Inline|Badge|Popup)Widget\b/ },
  { token: "calendly", re: /\bcalendly\b/i },
  { token: "acuityscheduling", re: /\bacuityscheduling\b/i },
  { token: "Square.payments", re: /\bSquare\.payments\b/ },
  { token: "SqPaymentForm", re: /\bSqPaymentForm\b/ },
  { token: "Stripe(", re: /\bStripe\(\s*["'`]pk_/ },
  { token: "paypal.Buttons", re: /\bpaypal\.Buttons\b/ },
  { token: "calltrk", re: /\bcalltrk\b/i },
  { token: "CallTrk", re: /\bCallTrk\b/ },
  { token: "_dm/", re: /\/_dm\// },
  { token: "dmAPI", re: /\bdmAPI\b/ },
  { token: "godaddy", re: /\bgodaddy\b/i },
  { token: "wsimg", re: /\bwsimg\b/i },
  { token: "wixBiSession", re: /\bwixBiSession\b/ },
  { token: "wix.com", re: /\bwix\.com\b/i },
]);

/**
 * The loader URLs and vendor tokens in one inline script body. Pure.
 *
 * @returns { urls: [{ url, host, literal }], tokens: [string] } — `url` is
 *          absolute and stripped of query and fragment; `literal` is the
 *          string as it appeared, so the evidence row is reviewable.
 */
export function scanInlineScript(body, { maxUrls = CAPS.inlineScripts, maxTokens = CAPS.inlineTokens } = {}) {
  const src = String(body ?? "").slice(0, CAPS.inlineScanChars);
  const urls = [];
  const tokens = [];
  if (!src) return { urls, tokens };

  const seenUrl = new Set();
  const re = new RegExp(INLINE_SCRIPT_URL_RE.source, "gi");
  let m;
  while ((m = re.exec(src)) && urls.length < maxUrls) {
    const host = m[1].toLowerCase();
    const path = m[2];
    // A host is at least "name.tld" with a real TLD; "a.b" style template
    // placeholders and version strings like "1.2.3" have already been kept
    // out by the letter-only TLD in the pattern.
    const url = `https://${host}${path}`;
    if (seenUrl.has(url)) continue;
    seenUrl.add(url);
    urls.push({ url, host, literal: m[0].replace(/^["'`]/, "").slice(0, 300) });
  }

  for (const { token, re: tokenRe } of INLINE_VENDOR_TOKENS) {
    if (tokens.length >= maxTokens) break;
    if (tokenRe.test(src)) tokens.push(token);
  }

  return { urls, tokens };
}

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,24}/gi;

/**
 * Everything §8 asks for, from one page.
 *
 * @param html      the body as text
 * @param finalUrl  the URL after redirects — every relative href resolves
 *                  against THIS, not against the requested URL, or a site that
 *                  redirects /x to /y/ produces links one directory too high
 * @returns the page record. Never throws on malformed input; a page that
 *          cannot be read produces empty lists rather than an exception, and
 *          the caller can tell the difference from `bytes` and `status`.
 */
export function extractPage({ html = "", finalUrl = "", requestedUrl = null, status = null, contentType = null, bytes = null, truncated = false } = {}) {
  const base = finalUrl || requestedUrl || "";
  const out = {
    requestedUrl: requestedUrl || finalUrl || null,
    finalUrl: finalUrl || null,
    status,
    contentType: contentType || null,
    bytes,
    truncated: Boolean(truncated),
    lang: null,
    title: null,
    canonical: null,
    metas: [],
    text: "",
    textTruncated: false,
    links: [],
    scripts: [],
    iframes: [],
    forms: [],
    buttons: [],
    jsonLd: [],
    microdata: [],
    dataAttrs: [],
    contacts: [],
    inlineScripts: [],
    inlineTokens: [],
    headings: [],
    // The copy a JavaScript framework embedded as JSON for its own client
    // to render — see structured.js. `renderedText` is the recovered
    // strings joined; `payload` says which framework and how it was read.
    // Empty and null on a page with no payload, which is most pages.
    renderedText: "",
    payload: null,
  };

  const absolute = (href) => {
    if (!base) return null;
    try {
      const u = new URL(String(href), base);
      u.hash = "";
      return u;
    } catch {
      return null;
    }
  };

  const textParts = [];
  let textLength = 0;
  const pushText = (value) => {
    if (textLength >= CAPS.text) { out.textTruncated = true; return; }
    const cleaned = String(value).replace(/\s+/g, " ");
    if (!cleaned.trim()) return;
    textParts.push(cleaned);
    textLength += cleaned.length;
  };

  // Depth counters rather than a stack: we only ever ask "am I inside a script
  // right now", and a counter answers that without a tree.
  const invisibleDepth = new Map();
  const isInvisible = () => [...invisibleDepth.values()].some((v) => v > 0);

  let currentLink = null;
  let currentButton = null;
  let currentForm = null;
  let currentHeading = null;
  // Set by the <script> open tag, read by the raw token that follows it. A
  // local rather than a field on `out`, so nothing about it can leak into the
  // page record or into the content hash.
  let scriptIsJsonLd = false;
  // Whether the <script> open tag carried a src. A body under a src tag is
  // ignored by browsers and is ignored here.
  let scriptHasSrc = false;
  // The id and type on the <script> open tag, read by the raw token that
  // follows so a framework payload (`id="__NEXT_DATA__"`) can be told from a
  // loader. Locals, like the flags above, for the same reason.
  let scriptId = "";
  let scriptType = "";
  let payloadsRead = 0;
  const payloadStrings = [];
  const seenDataAttrs = new Set();

  const noteDataAttrs = (attrs) => {
    for (const [name, value] of Object.entries(attrs)) {
      if (!name.startsWith("data-")) continue;
      if (!value) continue;
      if (out.dataAttrs.length >= CAPS.dataAttrs) return;
      const key = `${name}=${value}`.slice(0, 300);
      if (seenDataAttrs.has(key)) continue;
      seenDataAttrs.add(key);
      out.dataAttrs.push({ name, value: String(value).slice(0, 300) });
    }
  };

  const noteContact = (kind, raw, sourceHint) => {
    if (out.contacts.length >= CAPS.contacts) return;
    const value = String(raw || "").trim();
    if (!value) return;
    const normalised =
      kind === "phone" ? toE164(value) : kind === "email" ? value.toLowerCase() : value;
    if (!normalised) return;
    if (out.contacts.some((c) => c.kind === kind && c.value === normalised)) return;
    out.contacts.push({ kind, value: normalised, raw: value, found: sourceHint });
  };

  forEachToken(html, (token) => {
    if (token.kind === "text") {
      if (isInvisible()) return;
      if (currentLink) currentLink.text += token.value;
      if (currentButton) currentButton.text += token.value;
      if (currentHeading) currentHeading.text += token.value;
      pushText(token.value);
      return;
    }

    if (token.kind === "raw") {
      if (token.name === "title") {
        // An inline <svg> carries its own <title> — the accessible label on an
        // icon. On a page with no real <title> that would become the page
        // title, and "Phone icon" would be reported as a contractor's business
        // name. Found by mutation-testing the invisibility guard, which is
        // exactly the class of wrong-fact this file's header says the lexer
        // must never produce.
        if (out.title === null && !(invisibleDepth.get("svg") > 0)) {
          out.title = decodeEntities(token.value).replace(/\s+/g, " ").trim() || null;
        }
        return;
      }
      if (token.name === "script") {
        const body = token.value.trim();
        if (body && scriptIsJsonLd) {
          // Only structured-data scripts are KEPT. An inline analytics script
          // is the exact thing the content hash must not see (see
          // fingerprint.js) — its nonce changes on every request and would
          // make an unchanged site look different every time.
          if (out.jsonLd.length < CAPS.jsonLd) out.jsonLd.push(body.slice(0, CAPS.jsonLdChars));
        } else if (body && !scriptHasSrc) {
          // A framework's render payload: the page's own copy, as JSON
          // string values. Read for its sentences (structured.js) and then
          // discarded like every other body — the payload itself is never
          // stored, and nothing under three words leaves it.
          const framework = payloadsRead < CAPS.payloads ? payloadKind({ id: scriptId, type: scriptType, body }) : null;
          if (framework) {
            payloadsRead += 1;
            const found = extractPayloadText(body, { maxStrings: MAX_PAYLOAD_STRINGS - payloadStrings.length });
            for (const s of found.strings) payloadStrings.push(s);
            out.payload = {
              framework: out.payload?.framework || framework,
              method: found.method,
              strings: payloadStrings.length,
              truncated: Boolean(out.payload?.truncated) || found.truncated,
            };
          }
          // Every other body is SCANNED and discarded — see "What is read out
          // of an inline <script>" above. Only URLs and allow-listed tokens
          // leave this branch; the body does not.
          const found = scanInlineScript(body);
          for (const hit of found.urls) {
            if (out.inlineScripts.length >= CAPS.inlineScripts) break;
            if (out.inlineScripts.some((x) => x.url === hit.url)) continue;
            out.inlineScripts.push(hit);
          }
          for (const tokenName of found.tokens) {
            if (out.inlineTokens.length >= CAPS.inlineTokens) break;
            if (!out.inlineTokens.includes(tokenName)) out.inlineTokens.push(tokenName);
          }
        }
      }
      scriptIsJsonLd = false;
      scriptHasSrc = false;
      scriptId = "";
      scriptType = "";
      return;
    }

    if (token.kind === "close") {
      const depth = invisibleDepth.get(token.name);
      if (depth) invisibleDepth.set(token.name, depth - 1);
      if (BLOCK.has(token.name)) pushText("\n");

      if (token.name === "a" && currentLink) {
        finishLink(currentLink);
        currentLink = null;
      }
      if (token.name === "button" && currentButton) {
        finishButton(currentButton);
        currentButton = null;
      }
      if (token.name === "form" && currentForm) {
        out.forms.push(currentForm);
        currentForm = null;
      }
      if (/^h[1-3]$/.test(token.name) && currentHeading) {
        finishHeading(currentHeading);
        currentHeading = null;
      }
      return;
    }

    // ── open ────────────────────────────────────────────────────────────
    const { name, attrs } = token;
    if (INVISIBLE.has(name)) invisibleDepth.set(name, (invisibleDepth.get(name) || 0) + 1);
    if (BLOCK.has(name)) pushText("\n");
    noteDataAttrs(attrs);

    if (attrs.itemtype && out.microdata.length < CAPS.metas) out.microdata.push(String(attrs.itemtype).slice(0, 200));

    switch (name) {
      case "html":
        if (attrs.lang) out.lang = String(attrs.lang).slice(0, 20);
        break;

      case "meta": {
        if (out.metas.length >= CAPS.metas) break;
        const key = attrs.name || attrs.property || attrs["http-equiv"] || attrs.itemprop;
        if (!key) break;
        const content = attrs.content ?? "";
        out.metas.push({ name: String(key).toLowerCase().slice(0, 100), content: String(content).slice(0, 1000) });
        break;
      }

      case "link": {
        const rel = String(attrs.rel || "").toLowerCase();
        if (rel.includes("canonical") && attrs.href) {
          out.canonical = absolute(attrs.href)?.toString() || String(attrs.href);
        }
        break;
      }

      case "script": {
        // Flag for the raw token that follows, so JSON-LD is kept and every
        // other inline body is discarded.
        scriptIsJsonLd = String(attrs.type || "").toLowerCase().includes("ld+json");
        scriptHasSrc = Boolean(attrs.src);
        scriptId = attrs.id ? String(attrs.id).slice(0, 80) : "";
        scriptType = attrs.type ? String(attrs.type).slice(0, 80) : "";
        if (attrs.src && out.scripts.length < CAPS.scripts) {
          const u = absolute(attrs.src);
          out.scripts.push({ src: String(attrs.src).slice(0, 500), url: u ? u.toString() : null, host: u ? u.hostname : null });
        }
        break;
      }

      case "iframe":
      case "embed": {
        const src = attrs.src || attrs["data-src"];
        if (src && out.iframes.length < CAPS.iframes) {
          const u = absolute(src);
          out.iframes.push({ src: String(src).slice(0, 500), url: u ? u.toString() : null, host: u ? u.hostname : null });
        }
        break;
      }

      case "a": {
        const href = attrs.href;
        if (!href) break;
        const raw = String(href).trim();
        if (/^tel:/i.test(raw)) noteContact("phone", raw.replace(/^tel:/i, ""), "tel_link");
        else if (/^sms:/i.test(raw)) noteContact("phone", raw.replace(/^sms:/i, "").split("?")[0], "sms_link");
        else if (/^mailto:/i.test(raw)) noteContact("email", raw.replace(/^mailto:/i, "").split("?")[0], "mailto_link");
        currentLink = { href: raw.slice(0, 500), rel: String(attrs.rel || "").slice(0, 100), text: "" };
        break;
      }

      case "form": {
        if (out.forms.length >= CAPS.forms) break;
        const action = attrs.action ? String(attrs.action).slice(0, 500) : null;
        const u = action ? absolute(action) : null;
        currentForm = {
          action,
          actionUrl: u ? u.toString() : null,
          actionHost: u ? u.hostname : null,
          method: String(attrs.method || "get").toLowerCase().slice(0, 10),
          id: attrs.id ? String(attrs.id).slice(0, 100) : null,
          className: attrs.class ? String(attrs.class).slice(0, 200) : null,
          fields: [],
        };
        break;
      }

      case "input":
      case "select":
      case "textarea": {
        const field = {
          tag: name,
          name: attrs.name ? String(attrs.name).slice(0, 100) : null,
          type: String(attrs.type || (name === "input" ? "text" : name)).toLowerCase().slice(0, 30),
          required: attrs.required !== undefined,
          placeholder: attrs.placeholder ? String(attrs.placeholder).slice(0, 120) : null,
        };
        if (currentForm && currentForm.fields.length < CAPS.fieldsPerForm) currentForm.fields.push(field);
        if (name === "input" && (field.type === "submit" || field.type === "button") && attrs.value) {
          finishButton({ text: String(attrs.value), type: field.type });
        }
        break;
      }

      case "button": {
        currentButton = { text: "", type: String(attrs.type || "submit").toLowerCase().slice(0, 20) };
        break;
      }

      case "h1":
      case "h2":
      case "h3": {
        if (currentHeading) finishHeading(currentHeading);
        currentHeading = isInvisible() ? null : { level: Number(name[1]), text: "" };
        break;
      }

      default:
        break;
    }
  });

  // A document that ends inside an element still yields what it had.
  if (currentLink) finishLink(currentLink);
  if (currentButton) finishButton(currentButton);
  if (currentForm) out.forms.push(currentForm);
  if (currentHeading) finishHeading(currentHeading);
  out.renderedText = joinRenderedText(payloadStrings);

  out.text = textParts.join(" ").replace(/\s*\n\s*/g, "\n").replace(/[ \t]{2,}/g, " ").trim().slice(0, CAPS.text);
  if (textParts.join(" ").length > CAPS.text) out.textTruncated = true;

  // Contact methods that are written out rather than linked. A contractor's
  // number in the footer as plain text is the commonest case, and AUDIT
  // §10 wants the URL and the date it was found published captured at crawl
  // time — which is what the evidence row's sourceUrl and observedAt are for.
  for (const match of out.text.matchAll(EMAIL_RE)) noteContact("email", match[0], "page_text");
  for (const match of out.text.matchAll(PHONE_RE)) noteContact("phone", match[0], "page_text");

  return out;

  function finishLink(link) {
    if (out.links.length >= CAPS.links) return;
    const u = absolute(link.href);
    out.links.push({
      href: link.href,
      url: u ? u.toString() : null,
      host: u ? u.hostname : null,
      rel: link.rel || null,
      text: link.text.replace(/\s+/g, " ").trim().slice(0, 200),
    });
  }

  function finishButton(button) {
    if (out.buttons.length >= CAPS.buttons) return;
    const text = String(button.text || "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (!text) return;
    if (out.buttons.some((b) => b.text === text)) return;
    out.buttons.push({ text, type: button.type || null });
  }

  function finishHeading(heading) {
    if (out.headings.length >= CAPS.headings) return;
    const text = String(heading.text || "").replace(/\s+/g, " ").trim();
    if (text.length < 2 || text.length > CAPS.headingChars) return;
    if (out.headings.some((h) => h.text === text)) return;
    out.headings.push({ level: heading.level, text });
  }
}
