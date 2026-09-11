// lib/sales/intel/pageExcerpts.js
//
// Which of a prospect's crawled pages a model gets to read, and how much.
//
// ══ Why the script needs the page text at all ═════════════════════════════
//
// The owner, on the first generated script: "shouldn't the SCRIPT be unique
// to this company, based on the information found and what is inferred?"
// It was not. Its inputs were the capability booleans (WEBSITE yes,
// ONLINE_BOOKING no), the two opportunities and the brief, so every script
// for a tier read as the same template with the business name pasted in.
// The crawler had already stored the text of every page it read —
// ProspectEvidence rows of type `page_content`, rawValue the page's text,
// normalizedValue its URL — and nothing downstream read a word of it.
//
// ══ What is chosen, and why in this order ═════════════════════════════════
//
// A contractor's site has six pages and the model gets about two thousand
// tokens of them. The about page first: that is where the owner's name, the
// years, the crew and the service area are written by the business itself.
// Then services — what they emphasise (emergency, commercial, a specialism).
// Then the home page, which repeats both in shorter words. Contact and the
// rest last, and usually cut. The order is a path heuristic and says so;
// a site with no /about is served whatever it has.
//
// ══ Pure ═════════════════════════════════════════════════════════════════
//
// Rows in, excerpts out. No database, no clock. The check drives it with a
// six-page fixture and asserts the about page comes first and the cap holds.

/** Roughly two thousand tokens of English prose. */
export const MAX_EXCERPT_CHARS = 8_000;

/** No single page may crowd the others out. */
export const MAX_CHARS_PER_PAGE = 3_200;

/**
 * Lower is served first. The path is what a business names its own pages
 * by, and it is the only signal available without reading the text.
 */
export function pagePriority(url) {
  let path = "";
  try {
    path = new URL(String(url || "")).pathname.toLowerCase();
  } catch {
    path = String(url || "").toLowerCase();
  }
  if (/about|our-story|our-team|who-we-are|meet|history|company/.test(path)) return 1;
  if (/service|what-we-do|residential|commercial|emergency|repair|install|specialt/.test(path)) return 2;
  if (path === "" || path === "/" || /^\/(?:index|home)(?:\.\w+)?\/?$/.test(path)) return 3;
  if (/area|location|cities|towns|coverage/.test(path)) return 4;
  if (/contact|quote|estimate|book/.test(path)) return 5;
  return 6;
}

/**
 * Whitespace-collapsed, cut at a sentence end where one falls inside the
 * last fifth of the budget, so an excerpt does not stop mid-word.
 */
export function clipExcerpt(text, max = MAX_CHARS_PER_PAGE) {
  const s = typeof text === "string" ? text.replace(/\s+/g, " ").trim() : "";
  if (s.length <= max) return s;
  const head = s.slice(0, max);
  const cut = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  return cut > max * 0.8 ? head.slice(0, cut + 1) : `${head.trimEnd()}…`;
}

/**
 * @param rows   ProspectEvidence rows of type `page_content`
 *               ({ sourceUrl, normalizedValue, rawValue }). Other types are
 *               ignored, so a caller may hand over the whole evidence list.
 * @returns [{ url, text, priority }] in serving order, total text under
 *          `maxChars`. Empty when nothing was crawled — never a placeholder.
 */
export function selectPageExcerpts(rows, { maxChars = MAX_EXCERPT_CHARS, perPage = MAX_CHARS_PER_PAGE } = {}) {
  const pages = (Array.isArray(rows) ? rows : [])
    .filter((r) => r && r.type === "page_content" && typeof r.rawValue === "string" && r.rawValue.trim())
    .map((r) => ({
      url: r.sourceUrl || r.normalizedValue || "",
      text: r.rawValue,
      priority: pagePriority(r.sourceUrl || r.normalizedValue || ""),
    }))
    .sort((a, b) => a.priority - b.priority || a.url.localeCompare(b.url));

  const out = [];
  const seen = new Set();
  let used = 0;
  for (const page of pages) {
    if (seen.has(page.url)) continue;
    seen.add(page.url);
    const room = maxChars - used;
    if (room < 200) break;
    const text = clipExcerpt(page.text, Math.min(perPage, room));
    if (!text) continue;
    out.push({ url: page.url, text, priority: page.priority });
    used += text.length;
  }
  return out;
}

// ── Numbers, as a person says them ─────────────────────────────────────────
//
// The script may not contain a digit (lib/sales/intel/callScript.js), and the
// rule is right: a digit is the commonest invented fact. A rating and a
// review count are real facts the directory supplied, so they reach the
// prompt spelled out — "four point eight out of five, from thirty-seven
// reviews" — and the model can say them without tripping the gate.

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

/** 0–999,999 in words. Anything else, or a non-integer, returns "". */
export function integerInWords(n) {
  if (!Number.isInteger(n) || n < 0 || n > 999_999) return "";
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]}` : ""}`;
  if (n < 1000) {
    const rest = n % 100;
    return `${ONES[Math.floor(n / 100)]} hundred${rest ? ` and ${integerInWords(rest)}` : ""}`;
  }
  const rest = n % 1000;
  return `${integerInWords(Math.floor(n / 1000))} thousand${rest ? ` ${rest < 100 ? "and " : ""}${integerInWords(rest)}` : ""}`;
}

/** 4.8 → "four point eight". One decimal, which is what a rating has. */
export function ratingInWords(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 5) return "";
  const whole = Math.floor(n);
  const tenth = Math.round((n - whole) * 10);
  if (tenth === 10) return integerInWords(whole + 1);
  return tenth ? `${ONES[whole]} point ${ONES[tenth]}` : ONES[whole];
}
