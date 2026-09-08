// lib/quotes/lineDetail.js
//
// How a catalogue entry becomes a quote line — and, specifically, how its
// description reaches the line's scope text.
//
// ── The bug this closes ─────────────────────────────────────────────────────
//
// Every standard add-on in app/data/standardAddOns.js has carried a one-line
// description since it was written ("Install soft-close hinges, per door."),
// and seeding copied it onto the Product row. The quote builder then threw it
// away: picking that Product from "Add from Products & Services" copied the
// name, the unit and the price onto the line and nothing else. The trade's
// habitual extras in app/data/defaultLineItems.js never had a scope line to
// copy in the first place, and the cabinet upgrades the builder prices from the
// rate card (lib/pricing/tradeScope.js) were emitted with no `detail` at all.
//
// So the line reached the client's document as a bare name, and reached the AI
// review — which is shown the name AND the detail, deliberately, see
// writingPass in lib/ai/quoteReview.js — as a name with nothing under it. The
// review said the line was empty because it was. The owner read that as the
// review being wrong about soft-close hinges; the review was right about the
// quote.
//
// ── The rule ────────────────────────────────────────────────────────────────
//
// A catalogue description is copied into the line's `detail` at CREATION and
// only when the line has no detail of its own. It never overwrites something
// an estimator typed, and it is never applied to a line that already exists:
// a quote written last month keeps saying what it said (AGENTS.md
// non-negotiable 6 — the document, not just its language). lineItemsFromStored
// in lib/quotes/builderPayload.js deliberately does not call anything here.
//
// Pure, so scripts/check-addon-descriptions.mjs can execute the rule against
// fixtures rather than read it.

import { resolveProductText } from "@/lib/i18n/translateContent";

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (n) => Math.round(num(n) * 100) / 100;

/**
 * The scope text a NEW line should carry.
 *
 * @param ownDetail        whatever the line already has — kept whenever it is
 *                         non-blank, because it was typed by a person
 * @param catalogueDetail  the catalogue's description for this entry
 * @returns a string; "" when neither says anything, so a line with nothing to
 *          say does not carry `detail: ""` onto the document (the renderer
 *          prints the block only when there is text)
 */
export function detailForNewLine(ownDetail, catalogueDetail) {
  const own = String(ownDetail ?? "").trim();
  if (own) return own;
  return String(catalogueDetail ?? "").trim();
}

/**
 * A quote line from a Product row (Settings > Products & Services, or a seeded
 * standard add-on).
 *
 * `language` is the QUOTE's language — fixed at creation, never the viewer's.
 * Product.translations has been written by POST /api/products (and now by
 * seeding) since the field existed and was read by nothing: this is the first
 * reader. A French quote gets the French name and description when the row
 * has one; resolveProductText falls back to the source text otherwise, so a
 * product with no translation still lands as a complete line rather than a
 * blank one.
 */
export function lineFromProduct(product, { language = null, defaultLanguage = "en" } = {}) {
  const text = resolveProductText(product, language, defaultLanguage);
  const rate = round2(product?.unitPrice);
  const detail = detailForNewLine("", text.description);
  return {
    description: text.name,
    quantity: 1,
    unit: product?.unit || "flat",
    rate,
    amount: rate,
    ...(detail ? { detail } : {}),
  };
}

/**
 * A quote line from one of the trade's habitual extras
 * (app/data/defaultLineItems.js). Rate deliberately 0 — that file ships the
 * LIST, not prices; see the comment on addSuggestedLineItem in QuoteBuilder.
 *
 * `catalogKey` is carried so the editor can look up FieldQuo's own benchmark
 * while the rate is blank; scopeGroupPayload drops it before save.
 */
export function lineFromSuggestion(suggestion) {
  const detail = detailForNewLine("", suggestion?.detail);
  return {
    description: suggestion?.description || "",
    quantity: 1,
    unit: suggestion?.unit || "flat",
    rate: 0,
    amount: 0,
    ...(detail ? { detail } : {}),
    catalogKey: suggestion?.key,
  };
}
