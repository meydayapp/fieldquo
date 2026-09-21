// lib/reviews/testimonials.js
//
// Turning what a contractor pastes into rows worth publishing.
//
// ── Why this is pure ───────────────────────────────────────────────────────
//
// Same reason as lib/reviews/request.js next door: the interesting failures
// here are all shape failures — a blank line in the wrong place, a CSV whose
// header says "Reviewer" instead of "name", the same list pasted twice — and
// every one of them can be provoked in a test script in a millisecond. Put a
// database call in this file and none of it can be exercised without one.
//
// ── Two formats, decided by looking at the text ────────────────────────────
//
// A contractor with reviews to move has them in one of two states: a
// spreadsheet, or a browser window they are copying out of by hand. So:
//
//   CSV/TSV — recognised by a header row naming an author-ish and a quote-ish
//   column. Parsed by the caller with Papa Parse (already a dependency) and
//   handed here as objects, so quoted fields containing commas and newlines
//   work, which a hand-rolled split never does.
//
//   Blocks — name on the first line, what they said underneath, blank line
//   between reviews. Deterministic, and short enough to state in the UI in one
//   sentence. The tempting alternative — sniff whether a line "looks like a
//   name" — guesses wrong on "Great job, thanks!" and produces a testimonial
//   attributed to itself.
//
// Detection is by header, not by counting commas: a pasted review saying
// "Fast, tidy, and fair" is not a CSV, and any comma-counting heuristic
// eventually decides that it is.
//
// ── Why re-importing must not duplicate ────────────────────────────────────
//
// The realistic sequence is: paste, notice two are missing, paste the whole
// list again. Without an identity that survives the round trip, the website
// then shows every review twice, and the fix is manual deletion. So each row
// carries a content key — a hash of the author and the words — and the import
// updates the matching row instead of inserting a second one.
//
// The key deliberately covers the QUOTE, not just the name. One person can
// leave two reviews; and an edited quote is new content that should not
// silently overwrite the original under the same identity. The cost is that
// fixing a typo in the source and re-pasting adds a row rather than amending
// one — visible, and correctable in the list, which is the better failure of
// the two.
//
// ── When the paste carries a date, the identity changes ────────────────────
//
// A "Google reviews" paste — copied off the Business Profile page or exported
// from a review tool — brings a star rating and a date with every review.
// With a date in hand the identity is author + date + the first forty
// characters of the words, not the whole quote: Google truncates long reviews
// with "…More" on the page, so the same review pasted twice from two screen
// widths differs after the fold and would otherwise land twice. Two reviews
// by the same person on the same day opening with the same forty characters
// is a coincidence this file accepts. Rows with no date keep the whole-quote
// key above, so nothing that was imported before this changes identity.

import { createHash } from "node:crypto";

// Google caps a review at 4096 characters. Anything longer arriving here is a
// paste that swallowed the surrounding page, not a review.
export const MAX_QUOTE = 4096;
export const MAX_NAME = 120;
export const MAX_ROWS = 200;

// Shortest thing that is still a review. "Great" is five.
const MIN_QUOTE = 5;

// "google_import" is a PASTE the contractor made from their own Google page
// — their words to copy, no API involved (see docs/ROADMAP.md on why an API
// pull can never become a Testimonial). It is a label for the screen, not a
// different shape of row.
export const SOURCES = ["manual", "csv", "google_import"];

const RATING_KEYS = ["rating", "stars", "star", "starrating", "score"];
const DATE_KEYS = ["date", "reviewdate", "reviewed", "reviewedat", "createdat", "created", "published", "time", "when"];

/** Characters of the quote that join the identity when a date is present. */
export const KEY_PREFIX = 40;

// Header spellings seen in the exports contractors actually have: Google Takeout,
// the reviews tab of every review-widget product, and a spreadsheet someone
// typed by hand. Matched case- and separator-insensitively.
const AUTHOR_KEYS = [
  "name", "author", "authorname", "reviewer", "reviewername",
  "customer", "customername", "client", "from", "by",
];
const QUOTE_KEYS = [
  "quote", "review", "reviewtext", "comment", "comments", "text",
  "body", "content", "feedback", "message", "testimonial",
];
const TITLE_KEYS = ["title", "authortitle", "role", "jobtitle", "position"];
const COMPANY_KEYS = ["company", "companylabel", "business", "organisation", "organization", "location"];

function normaliseKey(key) {
  return String(key || "").toLowerCase().replace(/[^a-z]/g, "");
}

// First matching column wins, in the order listed above — so a sheet with both
// "name" and "customer" uses "name" rather than whichever Object.keys happens
// to yield first.
function pick(row, candidates) {
  const byNormalised = new Map();
  for (const key of Object.keys(row || {})) {
    const n = normaliseKey(key);
    if (n && !byNormalised.has(n)) byNormalised.set(n, row[key]);
  }
  for (const candidate of candidates) {
    const value = byNormalised.get(candidate);
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

// Collapse runs of whitespace but keep single newlines out entirely: the
// renderer puts these in a <blockquote> with no whitespace-pre, so an embedded
// newline is invisible in the output and merely makes two otherwise identical
// pastes hash differently.
export function tidyText(value, max) {
  if (typeof value !== "string") return "";
  const collapsed = value.replace(/\s+/g, " ").trim();
  return collapsed.length > max ? collapsed.slice(0, max).trim() : collapsed;
}

// Strip the decoration people paste along with a name: a leading em-dash from
// a pull quote, surrounding quote marks, a trailing "verified" badge's colon.
export function cleanAuthor(value) {
  const tidy = tidyText(value, MAX_NAME);
  return tidy
    .replace(/^[\s\-–—•*"“”'‘’]+/, "")
    .replace(/[\s\-–—:"“”'‘’]+$/, "")
    .trim();
}

export function cleanQuote(value) {
  const tidy = tidyText(value, MAX_QUOTE);
  // Only strip a quote mark if it is matched on both ends — a review that
  // opens with a quoted phrase and never closes it keeps its first character.
  const paired = /^["“'‘](.*)["”'’]$/s.exec(tidy);
  return (paired ? paired[1] : tidy).trim();
}

/**
 * A star rating out of five from anything a paste plausibly carries: "5",
 * "4.0", "5/5", "5 stars", "★★★★☆", "⭐⭐⭐". Null for nothing recognisable —
 * a review with no rating is a review with no rating, never a padded 3.
 */
export function parseRating(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 1 && value <= 5 ? Math.round(value) : null;
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v) return null;
  const filled = (v.match(/[★⭐]/g) || []).length;
  if (filled) return filled >= 1 && filled <= 5 ? filled : null;
  const asterisks = /^\*{1,5}$/.exec(v);
  if (asterisks) return v.length;
  const m = /^(\d(?:[.,]\d)?)\s*(?:\/\s*5|stars?|étoiles?|estrellas?|sterne|stelle)?\b/i.exec(v);
  if (!m) return null;
  const n = Math.round(Number(m[1].replace(",", ".")));
  return n >= 1 && n <= 5 ? n : null;
}

/**
 * A calendar date from a paste. Absolute dates only — "2025-03-14",
 * "March 14, 2025", "14/03/2025" — never a relative one: "3 weeks ago" is a
 * fact about the day the page was read, not about the review, and turning it
 * into a date would be invention. Null when unsure.
 */
export function parseReviewDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;
  const v = value.trim();
  if (!v || /\bago\b|il y a|hace\b|vor\b|fa\b|тому/i.test(v)) return null;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v);
  if (dmy) {
    // Day-first: every market this product sells to outside the US writes
    // dates that way, and a US contractor's spreadsheet export is ISO.
    const d = new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));
    return Number.isNaN(d.getTime()) || d.getUTCMonth() !== Number(dmy[2]) - 1 ? null : d;
  }
  const parsed = new Date(v);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  return year >= 2000 && year <= 2100 ? parsed : null;
}

const dayKey = (date) => (date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : "");

// The dedupe identity. Hashed rather than stored raw so the column stays a
// bounded size whatever the length of the quote, and normalised first so
// "  Jane   Doe " and "Jane Doe" are the same person. See the file header
// for why a dated row keys on the first forty characters instead.
export function contentKey({ authorName, quote, reviewedAt = null }) {
  const author = cleanAuthor(authorName).toLowerCase();
  const words = cleanQuote(quote).toLowerCase();
  const day = dayKey(reviewedAt);
  const basis = day ? [author, day, words.slice(0, KEY_PREFIX)].join("\u0000") : [author, words].join("\u0000");
  return createHash("sha256").update(basis).digest("hex").slice(0, 32);
}

// Does this pasted text have a CSV/TSV header naming both an author and a
// quote column? Only then is it worth handing to a CSV parser.
export function looksTabular(text) {
  if (typeof text !== "string") return false;
  const firstLine = text.split(/\r?\n/).find((line) => line.trim());
  if (!firstLine) return false;
  const cells = firstLine.split(/\t|,/).map(normaliseKey).filter(Boolean);
  if (cells.length < 2) return false;
  return (
    cells.some((c) => AUTHOR_KEYS.includes(c)) &&
    cells.some((c) => QUOTE_KEYS.includes(c))
  );
}

// ── The two parsers ────────────────────────────────────────────────────────
//
// Both return the same shape: { rows, skipped }. `skipped` counts what was
// dropped and why, because "imported 4" against a paste of 6 is a question the
// screen has to be able to answer.

function emptyResult() {
  return { rows: [], skipped: { blank: 0, tooShort: 0, noAuthor: 0, duplicate: 0, overLimit: 0 } };
}

function collect(candidates) {
  const result = emptyResult();
  const seen = new Set();

  for (const candidate of candidates) {
    const authorName = cleanAuthor(candidate.authorName);
    const quote = cleanQuote(candidate.quote);

    if (!authorName && !quote) { result.skipped.blank++; continue; }
    if (!authorName) { result.skipped.noAuthor++; continue; }
    if (quote.length < MIN_QUOTE) { result.skipped.tooShort++; continue; }

    if (result.rows.length >= MAX_ROWS) { result.skipped.overLimit++; continue; }

    const rating = parseRating(candidate.rating);
    const reviewedAt = parseReviewDate(candidate.reviewedAt);

    const externalId = contentKey({ authorName, quote, reviewedAt });
    // Within one paste, too — a list that already contains the same review
    // twice must not become two rows, or the "re-import updates" promise is
    // broken on the very first import.
    if (seen.has(externalId)) { result.skipped.duplicate++; continue; }
    seen.add(externalId);

    result.rows.push({
      authorName,
      quote,
      authorTitle: cleanAuthor(candidate.authorTitle) || null,
      companyLabel: cleanAuthor(candidate.companyLabel) || null,
      rating,
      reviewedAt,
      externalId,
    });
  }

  return result;
}

// Rows already parsed by Papa Parse with { header: true }.
export function parseTabularRows(rows) {
  if (!Array.isArray(rows)) return emptyResult();
  return collect(
    rows.map((row) => ({
      authorName: pick(row, AUTHOR_KEYS),
      quote: pick(row, QUOTE_KEYS),
      authorTitle: pick(row, TITLE_KEYS),
      companyLabel: pick(row, COMPANY_KEYS),
      rating: pick(row, RATING_KEYS),
      reviewedAt: pick(row, DATE_KEYS),
    })),
  );
}

/**
 * The second line of a block copied off a Google page: "★★★★★ 3 weeks ago",
 * "5/5 · 14 March 2025", "⭐⭐⭐⭐". Pure. Returns null when the line is not a
 * rating line — then it is part of the quote and stays there.
 */
export function parseRatingLine(line) {
  if (typeof line !== "string") return null;
  const v = line.trim();
  const m = /^([★⭐]{1,5}|\*{1,5}|\d(?:[.,]\d)?\s*(?:\/\s*5|stars?|étoiles?|estrellas?|sterne|stelle))\s*[·•\-–—,|]?\s*(.*)$/i.exec(v);
  if (!m) return null;
  const rating = parseRating(m[1]);
  if (!rating) return null;
  return { rating, reviewedAt: parseReviewDate(m[2]) };
}

// Blank-line-separated blocks: first line the name, the rest what they said.
export function parseBlocks(text) {
  if (typeof text !== "string" || !text.trim()) return emptyResult();

  const blocks = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

  return collect(
    blocks.map((block) => {
      const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
      const [first, ...rest] = lines;
      // A one-line block has no author line to give up. Its text is kept as
      // the quote and the author left empty, so it lands in the noAuthor
      // count — "one of these had no name on it" is a fixable report, where
      // the alternative (discard it, call it blank) tells the contractor a
      // paragraph of their own review simply vanished.
      if (!rest.length) return { authorName: "", quote: first };
      // A Google-page paste puts the stars and the date on the line after
      // the name. Lifted out when recognised; left in the quote when not.
      const ratingLine = rest.length >= 2 ? parseRatingLine(rest[0]) : null;
      if (ratingLine) {
        return { authorName: first, quote: rest.slice(1).join(" "), ...ratingLine };
      }
      return { authorName: first, quote: rest.join(" ") };
    }),
  );
}

// Papa Parse is deliberately NOT imported here — it is the route's job to run
// it, so this module stays runnable by a check script with no bundler and no
// dependency of its own. The route decides between the two parsers with
// looksTabular(); the browser sends raw text either way and never gets a vote,
// because a client that decides the format can get it wrong.

export function totalSkipped(skipped) {
  return Object.values(skipped || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
}
