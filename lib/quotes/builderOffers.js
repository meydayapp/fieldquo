// lib/quotes/builderOffers.js
//
// "Often added with this" — the optional extras the quote builder offers
// WHILE the quote is being written, per service on it.
//
// ── The owner's report (2026-09-22) ────────────────────────────────────────
//
// "Add-ons offered when I review but not when I'm creating it." Both sources
// already existed and both only surfaced after the first save: the AI
// review's "often sold alongside" (rule-based co-occurrence over this
// company's own accepted quotes, lib/ai/quoteSuggestions.js — no model call,
// no AI cost), and the company's own catalogue extras
// (lib/quotes/offeredAddOns.js), which a hand-built quote is seeded with at
// creation and the builder never mentioned. This puts the same two sources on
// the builder, beside the service they go with.
//
// ── What one click does ────────────────────────────────────────────────────
//
// It OFFERS the extra: a QuoteAddOn row the client can tick on their copy —
// the same thing the review's suggestions become. It does not add a line the
// client is billed for without asking; the line library is where that is.
//
// The browser never sends an amount (non-negotiable #5). A click records a
// REFERENCE — { kind: "catalog", productId, categoryId } or { kind:
// "history", categoryId } — and the save route prices it from its own rows
// (lib/quotes/suggestedAddOns.js): the catalogue product at the company's
// price and this quote's own counts, the history suggestion at the median
// this company's accepted quotes carried for that service. The price on the
// chip is the same arithmetic run in the browser for display only.
//
// ── Create vs edit ─────────────────────────────────────────────────────────
//
// On a NEW quote the catalogue extras are already offered automatically when
// it is saved (seedCatalogueAddOns runs on every create with no offer of its
// own yet). Offering them again as a button would be a control whose
// un-clicked state does the same as its clicked one. So on a create they are
// shown as what they are — "offered automatically" — and only the history
// suggestions are buttons. On an EDIT nothing is seeded, so the catalogue
// extras not already offered are buttons too.
//
// "Not already on the quote" means: not an offered row already (same
// description), not a line already billed on any service, not a service
// already on the quote.
//
// Pure — shared by the builder, the save routes and
// scripts/check-builder-offers.mjs.

import { catalogueAddOnsFor } from "@/lib/quotes/offeredAddOns";

/** The editor's own cap on offered extras — more is a second quote. */
export const OFFER_CAP = 8;

export const OFFER_KINDS = ["catalog", "history"];

const str = (v) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 64) : null);
const lower = (v) => String(v ?? "").trim().toLowerCase();

/** A reference's identity — one offer per product per service, one per history service. */
export function offerKey(ref) {
  if (!ref || typeof ref !== "object") return "";
  if (ref.kind === "catalog") return `catalog:${ref.productId}:${ref.categoryId}`;
  if (ref.kind === "history") return `history:${ref.categoryId}`;
  return "";
}

/**
 * A request body's references, cleaned: known kinds, string ids, no
 * duplicates, no more than the cap. Anything else — an amount, a description,
 * a stray field — is dropped here, so nothing the browser wrote about money
 * reaches the route that writes the row.
 */
export function normaliseOfferRefs(raw) {
  const out = [];
  const seen = new Set();
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r !== "object" || !OFFER_KINDS.includes(r.kind)) continue;
    const categoryId = str(r.categoryId);
    if (!categoryId) continue;
    const ref =
      r.kind === "catalog"
        ? (() => {
            const productId = str(r.productId);
            return productId ? { kind: "catalog", productId, categoryId } : null;
          })()
        : { kind: "history", categoryId };
    if (!ref) continue;
    const key = offerKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
    if (out.length >= OFFER_CAP) break;
  }
  return out;
}

/** The one offered row a catalogue product makes on one service, or null. */
export function catalogueOfferFor({ product, group }) {
  if (!product || !group) return null;
  const [row] = catalogueAddOnsFor({ groups: [group], products: [product], room: 1 });
  return row || null;
}

/**
 * Per service on the quote, what the builder offers under it.
 *
 * @param {object} p
 * @param {Array}  p.groups     the builder's scope groups (tempId, categoryId,
 *                              intakeValues, lineItems)
 * @param {Array}  p.products   the company's Product rows, categories inline
 * @param {object} p.history    { [categoryId]: [{ categoryId, label, share, amount|null }] }
 *                              from POST /api/ai/quote-suggestions
 * @param {Array}  p.existing   the quote's QuoteAddOn rows (edit) — [] on a create
 * @param {Array}  p.pending    the references clicked this session
 * @param {boolean} p.isEdit
 * @returns {{ byGroup: Record<string, { auto: Array, offers: Array }>, used: number, room: number }}
 */
export function builderOfferRows({ groups, products, history, existing = [], pending = [], isEdit = false }) {
  const list = Array.isArray(groups) ? groups.filter((g) => g && typeof g === "object") : [];
  const prods = (Array.isArray(products) ? products : []).filter(
    (p) => p && p.active !== false && (p.type == null || p.type === "service" || p.type === "product"),
  );
  const offered = (Array.isArray(existing) ? existing : []).filter((a) => a && a.source !== "takeoff");
  const pendingRefs = normaliseOfferRefs(pending);
  const pendingKeys = new Set(pendingRefs.map(offerKey));

  // What the quote already says, in every form a duplicate could take.
  const onQuoteText = new Set([
    ...offered.map((a) => lower(a.description)),
    ...list.flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : []).map((l) => lower(l?.description))),
  ]);
  const onQuoteCategories = new Set(list.map((g) => g.categoryId).filter(Boolean));

  // A create seeds the catalogue across every group, in order, deduplicated
  // by name and capped — the same walk seedCatalogueAddOns makes.
  const autoRows = isEdit ? [] : catalogueAddOnsFor({ groups: list, products: prods, room: OFFER_CAP });
  const autoText = new Set(autoRows.map((r) => lower(r.description)));

  const used = offered.length + autoRows.length + pendingRefs.length;
  const room = Math.max(0, OFFER_CAP - used);

  const byGroup = {};
  const shownNames = new Set();
  for (const g of list) {
    const auto = [];
    const offers = [];

    for (const p of prods) {
      const linked = (Array.isArray(p.categories) ? p.categories : []).some((c) => c?.id === g.categoryId);
      if (!linked) continue;
      const row = catalogueOfferFor({ product: p, group: g });
      if (!row) continue;
      const name = lower(p.name);
      if (shownNames.has(name)) continue;
      if (!isEdit) {
        if (autoText.has(lower(row.description))) {
          shownNames.add(name);
          auto.push({ key: `auto:${p.id}`, description: row.description, amount: row.amount });
        }
        continue;
      }
      if (onQuoteText.has(lower(row.description)) || onQuoteText.has(name)) continue;
      shownNames.add(name);
      const ref = { kind: "catalog", productId: String(p.id), categoryId: g.categoryId };
      offers.push({ key: offerKey(ref), ref, description: row.description, amount: row.amount, share: null, pending: pendingKeys.has(offerKey(ref)) });
    }

    const hist = history && typeof history === "object" && Array.isArray(history[g.categoryId]) ? history[g.categoryId] : [];
    for (const s of hist) {
      if (!s || !s.categoryId || onQuoteCategories.has(s.categoryId)) continue;
      // An offer needs a number the company's own history stands behind.
      if (!(Number(s.amount) > 0)) continue;
      if (onQuoteText.has(lower(s.label)) || autoText.has(lower(s.label))) continue;
      const ref = { kind: "history", categoryId: s.categoryId };
      const key = offerKey(ref);
      // One service suggested under two groups is offered once, under the first.
      if (offers.some((o) => o.key === key) || Object.values(byGroup).some((b) => b.offers.some((o) => o.key === key))) continue;
      offers.push({ key, ref, description: s.label, amount: Number(s.amount), share: Number.isFinite(Number(s.share)) ? Number(s.share) : null, pending: pendingKeys.has(key) });
    }

    byGroup[g.tempId] = { auto, offers };
  }

  return { byGroup, used, room };
}
