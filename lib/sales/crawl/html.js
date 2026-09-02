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
  // Set by the <script> open tag, read by the raw token that follows it. A
  // local rather than a field on `out`, so nothing about it can leak into the
  // page record or into the content hash.
  let scriptIsJsonLd = false;
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
      if (token.name === "script" && out.jsonLd.length < CAPS.jsonLd) {
        // Only structured-data scripts are kept. An inline analytics script is
        // the exact thing the content hash must not see (see fingerprint.js) —
        // its nonce changes on every request and would make an unchanged site
        // look different every time.
        const body = token.value.trim();
        if (body && scriptIsJsonLd) out.jsonLd.push(body.slice(0, CAPS.jsonLdChars));
      }
      scriptIsJsonLd = false;
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

      default:
        break;
    }
  });

  // A document that ends inside an element still yields what it had.
  if (currentLink) finishLink(currentLink);
  if (currentButton) finishButton(currentButton);
  if (currentForm) out.forms.push(currentForm);

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
}
