// lib/sales/crawl/structured.js
//
// The structured sources a site publishes beside its HTML, read without
// running anything: the WordPress REST index of pages, and the JSON payload
// a JavaScript framework embeds in the page for its own client to render
// from. Pure — strings in, plain objects out — and bounded at every step,
// because both are files a stranger's server chose.
//
// ══ Why these two, and why now ════════════════════════════════════════════
//
// The crawler reads HTML and does not execute scripts (html.js's header says
// why, and it stands). Two large classes of site are nearly blank to such a
// reader:
//
//   · a site whose menu and copy are drawn by JavaScript from a JSON blob
//     the server put in the page — Next.js's `__NEXT_DATA__`, Nuxt's
//     `__NUXT__`, a Vuex `__INITIAL_STATE__`, Wix's warmup data,
//     Squarespace's `Static.SQUARESPACE_CONTEXT`. The words are IN the
//     document, as string values in that JSON; only the markup is missing.
//   · a WordPress site (a third of the crawled prospects carry
//     `/wp-content/`) — whose `/wp-json/wp/v2/pages` lists every page with
//     its title, its link and an excerpt, whatever theme or menu plugin hid
//     them from the home page's <a> tags.
//
// Reading the first is reading the page; reading the second is one more
// request to a URL WordPress publishes for exactly this purpose. Neither
// runs code, and neither claims anything: what comes out is text and page
// names, recorded as evidence with its source URL, for servicesOffered.js
// and capabilityDetect.js to read under the same rules as a menu link.
//
// ══ What is NEVER taken out of a payload ══════════════════════════════════
//
// Scripts, URLs, keys, tokens, ids, anything under three words. A payload
// carries API keys and session material beside its copy, and a reader that
// kept every string would store somebody's credentials in an evidence row.
// So a string is kept only when it reads as a sentence or a label — three
// words or more, letters in it, no scheme, not mostly punctuation — and the
// payload itself is never stored. The check feeds it a payload with a
// `pk_live_…` key and asserts it does not come out.

/** How much of a payload is parsed. Beyond this the string is cut and the
 *  parse falls back to scanning quoted literals — see extractPayloadText. */
export const MAX_PAYLOAD_PARSE_CHARS = 200_000;
/** Strings kept from one payload. */
export const MAX_PAYLOAD_STRINGS = 2_000;
/** Characters of recovered text kept per page, joined. */
export const MAX_RENDERED_TEXT_CHARS = 20_000;
/** A string this long is a document or a blob, not a label or a sentence. */
export const MAX_PAYLOAD_STRING_CHARS = 600;
/** Nesting the walker follows. A payload deeper than this is a tree of
 *  component props, and its copy is above this depth. */
const MAX_PAYLOAD_DEPTH = 24;

/** WordPress pages kept per crawl. */
export const MAX_WP_PAGES = 60;
/** Per-page record size cap: title + link + excerpt, as the brief asks. */
export const MAX_WP_RECORD_CHARS = 1_024;
/** REST bodies parsed at most this far. */
export const MAX_WP_PARSE_CHARS = 512 * 1024;
/** Post types besides `pages` fetched when the site declares them. */
export const MAX_WP_SERVICE_TYPES = 2;

/** The REST paths this crawler asks a WordPress site for. `_fields` keeps
 *  the body to what is read, which is also what keeps it under the byte cap
 *  on a site with two hundred pages. */
export const WP_PAGES_PATH = "/wp-json/wp/v2/pages?per_page=50&_fields=id,link,title,excerpt";
export const WP_TYPES_PATH = "/wp-json/wp/v2/types?_fields=slug,rest_base,name";

/**
 * The script ids and inline markers that carry a framework's render payload.
 * `id` entries match the <script id=…> attribute; `marker` entries are the
 * first few characters of the inline body, after whitespace. Matched in
 * html.js, which hands the BODY here and stores nothing of it.
 */
export const PAYLOAD_SCRIPTS = Object.freeze([
  { framework: "next", id: "__NEXT_DATA__" },
  { framework: "nuxt", id: "__NUXT_DATA__" },
  { framework: "wix", id: "wix-warmup-data" },
  { framework: "nuxt", marker: /^\s*window\.__NUXT__\s*=/ },
  { framework: "vuex", marker: /^\s*window\.__INITIAL_STATE__\s*=/ },
  { framework: "squarespace", marker: /^\s*Static\.SQUARESPACE_CONTEXT\s*=/ },
  { framework: "wix", marker: /^\s*(?:window\.)?warmupData\s*=/ },
]);

/** Which payload a <script> is, or null. */
export function payloadKind({ id = "", type = "", body = "" } = {}) {
  const scriptId = String(id || "");
  for (const entry of PAYLOAD_SCRIPTS) {
    if (entry.id && scriptId === entry.id) return entry.framework;
  }
  const head = String(body || "").slice(0, 200);
  for (const entry of PAYLOAD_SCRIPTS) {
    if (entry.marker && entry.marker.test(head)) return entry.framework;
  }
  // A JSON script the page names — `<script type="application/json"
  // id="__APOLLO_STATE__">` and its cousins. Read as a payload only when it
  // carries an id: an anonymous JSON block is a config nobody renders.
  if (/json/i.test(String(type || "")) && /^__[A-Z_]+__$/.test(scriptId)) return "json";
  return null;
}

/** Is this string a piece of copy a reader would see? */
export function looksLikeCopy(value) {
  if (typeof value !== "string") return false;
  const s = value.trim();
  if (s.length < 8 || s.length > MAX_PAYLOAD_STRING_CHARS) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return false;
  if (/^[\w./-]+$/.test(s) && !/\s/.test(s)) return false;
  const words = s.split(/\s+/).filter((w) => /[\p{L}]/u.test(w));
  if (words.length < 3) return false;
  const letters = (s.match(/[\p{L}]/gu) || []).length;
  if (letters / s.length < 0.5) return false;
  // A key or a token has no spaces; a base64 blob has spaces only by accident
  // and no vowels to speak of. A run of forty word characters is not a word.
  if (/[A-Za-z0-9+/=_-]{40,}/.test(s)) return false;
  if (/<[a-z][^>]*>/i.test(s) && !/[.!?]/.test(s)) return false;
  return true;
}

/** The JSON value that starts at the first `{` or `[` in `src`, cut at its
 *  matching close, or null. Balanced by counting, with strings skipped, so
 *  `window.__INITIAL_STATE__ = {...};` and Squarespace's `Static.X = {...};`
 *  both yield the object. Bounded by the parse cap. */
export function balancedJsonSlice(src) {
  const s = String(src || "").slice(0, MAX_PAYLOAD_PARSE_CHARS);
  const start = s.search(/[{[]/);
  if (start < 0) return null;
  const stack = [];
  let quote = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === '"') quote = false;
      continue;
    }
    if (ch === '"') quote = true;
    else if (ch === "{" || ch === "[") stack.push(ch === "{" ? "}" : "]");
    else if (ch === "}" || ch === "]") {
      if (stack.pop() !== ch) return null;
      if (!stack.length) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * The copy inside a framework payload, as an array of strings.
 *
 * Two readers, the second a fallback: JSON.parse over the balanced slice,
 * walking values; and — when the payload is not JSON (Nuxt 2's function
 * form, a cut file) — a scan for double-quoted literals, unescaped. Both
 * apply looksLikeCopy to every string and both stop at MAX_PAYLOAD_STRINGS.
 * Keys are never read: a key is a name in somebody's code.
 *
 * @returns { strings: string[], method: "json" | "literals" | "none",
 *            truncated: boolean }
 */
export function extractPayloadText(body, { maxStrings = MAX_PAYLOAD_STRINGS } = {}) {
  const src = String(body ?? "");
  const truncated = src.length > MAX_PAYLOAD_PARSE_CHARS;
  const slice = balancedJsonSlice(src);
  const out = [];
  const seen = new Set();
  const keep = (value) => {
    if (out.length >= maxStrings) return false;
    if (!looksLikeCopy(value)) return true;
    const cleaned = value.replace(/\s+/g, " ").trim();
    if (seen.has(cleaned)) return true;
    seen.add(cleaned);
    out.push(cleaned);
    return out.length < maxStrings;
  };

  if (slice) {
    let parsed;
    try {
      parsed = JSON.parse(slice);
    } catch {
      parsed = undefined;
    }
    if (parsed !== undefined) {
      const walk = (node, depth) => {
        if (depth > MAX_PAYLOAD_DEPTH || out.length >= maxStrings) return;
        if (typeof node === "string") {
          keep(node);
          return;
        }
        if (Array.isArray(node)) {
          for (const item of node) {
            if (out.length >= maxStrings) return;
            walk(item, depth + 1);
          }
          return;
        }
        if (node && typeof node === "object") {
          for (const value of Object.values(node)) {
            if (out.length >= maxStrings) return;
            walk(value, depth + 1);
          }
        }
      };
      walk(parsed, 0);
      return { strings: out, method: "json", truncated };
    }
  }

  // Not JSON. Quoted literals, unescaped, from the bounded slice.
  const scan = src.slice(0, MAX_PAYLOAD_PARSE_CHARS);
  const re = /"((?:[^"\\]|\\.){8,600})"/g;
  let m;
  while ((m = re.exec(scan)) && out.length < maxStrings) {
    let literal = m[1];
    try {
      literal = JSON.parse(`"${literal}"`);
    } catch {
      continue;
    }
    keep(literal);
  }
  return { strings: out, method: out.length ? "literals" : "none", truncated };
}

/** The recovered strings as one text, block-separated, capped. */
export function joinRenderedText(strings = []) {
  let total = 0;
  const parts = [];
  for (const s of Array.isArray(strings) ? strings : []) {
    if (total + s.length + 1 > MAX_RENDERED_TEXT_CHARS) break;
    parts.push(s);
    total += s.length + 1;
  }
  return parts.join("\n");
}

/* ═══════════════════════════════════════════════════════════════════════════
   WordPress
   ═══════════════════════════════════════════════════════════════════ */

/** Does this page's markup say WordPress? The URL form every WordPress
 *  install serves its theme and plugins from, on a script, a stylesheet or
 *  a link — the same token technology.js's signature seed matches. */
export function looksLikeWordPress(page) {
  const lists = [page?.scripts || [], page?.links || [], page?.metas || []];
  for (const list of lists) {
    for (const item of list) {
      const value = typeof item === "string" ? item : item?.url || item?.src || item?.href || item?.content || "";
      if (/\/wp-content\/|\/wp-includes\/|\/wp-json\b/i.test(String(value))) return true;
    }
  }
  const generator = (page?.metas || []).find((m) => String(m?.name || "").toLowerCase() === "generator");
  return /wordpress/i.test(String(generator?.content || ""));
}

/** Tags stripped, entities decoded enough for an excerpt, whitespace
 *  collapsed. A WordPress excerpt is `<p>…</p>\n` with `[&hellip;]`. */
export function plainExcerpt(html) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[&hellip;\]|&hellip;/g, "…")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "’")
    .replace(/&#8216;|&lsquo;/g, "‘")
    .replace(/&#8220;|&ldquo;/g, "“")
    .replace(/&#8221;|&rdquo;/g, "”")
    .replace(/&#038;/g, "&")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The pages a WordPress REST answer lists, same-site, as
 * `{ id, link, path, title, excerpt }`, each record bounded.
 *
 * `title.rendered` and `excerpt.rendered` are HTML; both are flattened.
 * A page whose title is empty or whose link is off-site is dropped — a
 * REST answer can be proxied from another install.
 */
export function parseWpPages(body, { baseHost, max = MAX_WP_PAGES } = {}) {
  const src = String(body ?? "").slice(0, MAX_WP_PARSE_CHARS);
  let parsed;
  try {
    parsed = JSON.parse(src);
  } catch {
    return { pages: [], error: "not_json" };
  }
  if (!Array.isArray(parsed)) return { pages: [], error: "not_a_list" };
  const out = [];
  const seen = new Set();
  for (const item of parsed) {
    if (out.length >= max) break;
    if (!item || typeof item !== "object") continue;
    const link = typeof item.link === "string" ? item.link : "";
    let u;
    try {
      u = new URL(link);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (baseHost && !sameHost(baseHost, u.hostname)) continue;
    const title = plainExcerpt(typeof item.title === "string" ? item.title : item.title?.rendered).slice(0, 200);
    if (!title) continue;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    if (seen.has(path)) continue;
    seen.add(path);
    const excerptRoom = Math.max(0, MAX_WP_RECORD_CHARS - title.length - link.length - 40);
    const excerpt = plainExcerpt(typeof item.excerpt === "string" ? item.excerpt : item.excerpt?.rendered).slice(0, excerptRoom);
    out.push({ id: Number.isInteger(item.id) ? item.id : null, link: `${u.origin}${u.pathname}`, path, title, excerpt });
  }
  return { pages: out, error: null };
}

/**
 * The custom post types worth asking a WordPress site for: those whose
 * slug or REST base names a service or a trade. `pages` and `posts` are
 * skipped — pages are fetched anyway and posts are a blog.
 *
 * @returns [{ slug, restBase, name }] at most MAX_WP_SERVICE_TYPES
 */
export function wpServiceTypes(body, { max = MAX_WP_SERVICE_TYPES } = {}) {
  const src = String(body ?? "").slice(0, MAX_WP_PARSE_CHARS);
  let parsed;
  try {
    parsed = JSON.parse(src);
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  const out = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (out.length >= max) break;
    const slug = String(value?.slug || key || "").toLowerCase();
    const restBase = String(value?.rest_base || slug || "").toLowerCase();
    if (!/^[a-z0-9_-]{1,64}$/.test(restBase)) continue;
    if (["pages", "posts", "media", "menu-items", "blocks", "templates", "navigation", "font-families"].includes(restBase)) continue;
    if (!/service|trade|offer|specialt|treatment|work|project/.test(`${slug} ${restBase}`)) continue;
    out.push({ slug, restBase, name: plainExcerpt(String(value?.name || "")).slice(0, 80) });
  }
  return out;
}

function sameHost(baseHost, candidate) {
  const base = String(baseHost || "").toLowerCase().replace(/^www\./, "");
  const cand = String(candidate || "").toLowerCase();
  return cand === base || cand === `www.${base}` || cand.endsWith(`.${base}`);
}
