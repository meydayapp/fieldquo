// lib/quotes/textBlocks.js
//
// A library block → a quote line, and the rules both ends agree on.
//
// ── The line item IS the storage ────────────────────────────────────────────
//
// A block lands on a quote as an ordinary entry in QuoteScopeGroup.lineItems:
// `description` is its title, `detail` its body, `amount` its price — the
// three fields every renderer (PDF, covering email, approval page, detail
// page, invoice) already reads. Three more travel with it and are read by
// this file's `isTextLine` and by the work order:
//
//   kind: "text"          this line came from prose, not a rate card. Only a
//                         reader that draws prices differently for a
//                         paragraph consults it — the amount column is left
//                         blank for a "none"-priced block rather than
//                         printing $0.00 beside the exclusions.
//   priceMode             how the amount was arrived at, so reopening the
//                         quote can show hours × rate rather than a bare sum.
//   hiddenOnWorkOrder     the crew's document skips it.
//   textBlockId           traceability back to the library row; a deleted
//                         row leaves the line intact, because the line is a
//                         copy.
//
// Nothing here reads the database. The route validates with the same
// functions the builder previews with, and scripts/check-quote-text-blocks.mjs
// executes them against hostile input.

import { sanitiseRichText } from "@/lib/quotes/richText";

export const PRICE_MODES = Object.freeze(["none", "hourly", "quantity", "custom"]);
export const TEXT_LINE_KIND = "text";

const MAX_NAME = 160;
const MAX_UNIT = 24;
const MAX_TAGS = 12;

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const round2 = (n) => Math.round(n * 100) / 100;

/** A supported price mode, or "none" for anything the wire invented. */
export function normalisePriceMode(mode) {
  return PRICE_MODES.includes(mode) ? mode : "none";
}

/**
 * The boundary between a browser's JSON and a QuoteTextBlock row.
 *
 * Returns `{ ok: true, data }` or `{ ok: false, error }`. Strings are
 * trimmed and capped; the body goes through the rich-text sanitiser (which
 * strips control characters and caps length — the subset itself needs no
 * stripping because nothing ever turns it into markup); the price is a
 * non-negative number or null; tags are short lower-case strings.
 */
export function normaliseTextBlockInput(input = {}, { languages = null } = {}) {
  const name = String(input?.name ?? "").trim().slice(0, MAX_NAME);
  if (!name) return { ok: false, error: "Give the block a title." };

  const body = sanitiseRichText(input?.body);
  const priceMode = normalisePriceMode(input?.priceMode);

  let price = null;
  if (input?.price !== null && input?.price !== undefined && input?.price !== "") {
    const p = Number(input.price);
    if (!Number.isFinite(p) || p < 0) return { ok: false, error: "The price must be a number, zero or more." };
    price = round2(p);
  }

  const unit =
    priceMode === "quantity"
      ? String(input?.unit ?? "").trim().slice(0, MAX_UNIT) || null
      : null;

  const tags = Array.isArray(input?.tags)
    ? [...new Set(input.tags.map((t) => String(t ?? "").trim().toLowerCase().slice(0, 32)).filter(Boolean))].slice(0, MAX_TAGS)
    : [];

  let language = String(input?.language ?? "").trim().toLowerCase();
  if (Array.isArray(languages) && languages.length && !languages.includes(language)) language = "";

  return {
    ok: true,
    data: {
      name,
      body,
      priceMode,
      price,
      unit,
      hiddenOnWorkOrder: input?.hiddenOnWorkOrder === true,
      tags,
      ...(language ? { language } : {}),
    },
  };
}

/**
 * One language's rendering of a block: its own text when the quote is in
 * the block's language, the stored translation when there is one, and the
 * block's own text flagged `missing: true` otherwise — the builder's cue to
 * draft one before the block lands.
 */
export function resolveTextBlockText(block, language) {
  const source = { name: block?.name || "", body: block?.body || "" };
  if (!language || language === block?.language) return { ...source, missing: false };
  const entry = block?.translations?.[language];
  if (entry && typeof entry.name === "string" && entry.name.trim()) {
    return {
      name: entry.name,
      // A translated title over an untranslated body is still a document in
      // two languages; only a translation that carries both counts.
      body: typeof entry.body === "string" && (entry.body.trim() || !source.body) ? entry.body : source.body,
      missing: Boolean(source.body) && !(typeof entry.body === "string" && entry.body.trim()),
    };
  }
  return { ...source, missing: true };
}

/**
 * The stored translation object, after a human accepted a draft — only the
 * two fields, both trimmed, never a key the caller did not ask for. Returns
 * null when there is nothing worth storing.
 */
export function translationEntry({ name, body }) {
  const n = String(name ?? "").trim().slice(0, MAX_NAME);
  const b = sanitiseRichText(body);
  if (!n) return null;
  return { name: n, body: b };
}

/**
 * The amount a block comes to for the numbers the estimator typed.
 *
 *   none      0, whatever else was typed
 *   hourly    hours × rate
 *   quantity  quantity × rate
 *   custom    the amount
 */
export function priceTextBlock(priceMode, { quantity = 0, rate = 0, amount = 0 } = {}) {
  const mode = normalisePriceMode(priceMode);
  if (mode === "none") return { quantity: 1, rate: 0, amount: 0 };
  if (mode === "custom") {
    const a = round2(Math.max(0, num(amount)));
    return { quantity: 1, rate: a, amount: a };
  }
  const q = Math.max(0, num(quantity));
  const r = Math.max(0, num(rate));
  return { quantity: q, rate: r, amount: round2(q * r) };
}

/**
 * The line item a block becomes on a quote.
 *
 * @param block     the library row (or the "custom item" the dialog built)
 * @param text      { name, body } in the QUOTE's language — resolved or
 *                  drafted and reviewed before this is called; this function
 *                  never picks a language itself
 * @param pricing   { quantity, rate, amount } as typed in the dialog
 */
export function lineFromTextBlock(block, text, pricing = {}) {
  const mode = normalisePriceMode(block?.priceMode);
  const priced = priceTextBlock(mode, pricing);
  const unit =
    mode === "hourly" ? "hour" : mode === "quantity" ? String(block?.unit || "each") : "flat";
  return {
    description: String(text?.name || block?.name || "").trim(),
    detail: sanitiseRichText(text?.body ?? block?.body ?? ""),
    quantity: priced.quantity,
    unit,
    rate: priced.rate,
    amount: priced.amount,
    kind: TEXT_LINE_KIND,
    priceMode: mode,
    hiddenOnWorkOrder: block?.hiddenOnWorkOrder === true,
    ...(block?.id ? { textBlockId: block.id } : {}),
  };
}

/** A line that came from prose — see the header for what a reader does with it. */
export function isTextLine(item) {
  return item?.kind === TEXT_LINE_KIND;
}

/** A text line with no price prints no amount column at all. */
export function lineShowsAmount(item) {
  if (!isTextLine(item)) return true;
  return normalisePriceMode(item.priceMode) !== "none";
}

/**
 * The one-word chip the library list shows beside a block's name — derived
 * from the data rather than stored, so it cannot disagree with it:
 * "by qty" / "hourly" / "$120" / "text" (prose the crew does not see) /
 * "scope" (prose that also goes on the work order).
 */
export function textBlockChip(block, money = (n) => `$${n}`) {
  const mode = normalisePriceMode(block?.priceMode);
  if (mode === "quantity") return { key: "quantity", label: "by qty" };
  if (mode === "hourly") return { key: "hourly", label: "hourly" };
  if (mode === "custom") return { key: "custom", label: money(num(block?.price)) };
  return block?.hiddenOnWorkOrder ? { key: "text", label: "text" } : { key: "scope", label: "scope" };
}

/** Case-insensitive search over name, body and tags. */
export function matchesTextBlockQuery(block, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return true;
  const hay = [block?.name, block?.body, ...(Array.isArray(block?.tags) ? block.tags : [])]
    .map((s) => String(s ?? "").toLowerCase())
    .join("\n");
  return hay.includes(q);
}

/**
 * A row as the browser receives it: Decimal → number, translations always an
 * object, and `price` withheld when the caller may not see money — the words
 * are what a member without showPricing needs, and the dialog prices nothing
 * for them.
 */
export function presentTextBlock(row, { showPricing = true } = {}) {
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    priceMode: normalisePriceMode(row.priceMode),
    price: showPricing && row.price !== null && row.price !== undefined ? Number(row.price) : null,
    unit: row.unit ?? null,
    hiddenOnWorkOrder: row.hiddenOnWorkOrder === true,
    language: row.language || "en",
    translations: row.translations && typeof row.translations === "object" ? row.translations : {},
    tags: Array.isArray(row.tags) ? row.tags : [],
    seedKey: row.seedKey ?? null,
    sortOrder: row.sortOrder ?? 0,
    updatedAt: row.updatedAt ?? null,
  };
}
