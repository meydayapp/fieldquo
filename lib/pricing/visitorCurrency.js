// lib/pricing/visitorCurrency.js
//
// Which currency /pricing prints its cards in. Pure, so
// scripts/check-pricing-page.mjs can execute it.
import { SUPPORTED_CURRENCIES } from "@/lib/pricing/ladder";

/**
 * The currency the VISITOR asked to see (`?currency=GBP`), or null.
 *
 * ── Chosen, never guessed ─────────────────────────────────────────────────
 *
 * The owner, 2026-10-04: the subscription is priced in local money for CAD,
 * USD, GBP and EUR (and AUD, 2026-09-24), and the pricing page shows the
 * visitor's currency. His earlier objection still stands and is why this is a
 * CHOICE rather than an IP read: "you can't tell if someone is from the usa
 * europe or canada until they sign up." So the page opens on the collapsed
 * grid exactly as before (one card per tier, the number every currency
 * shares) and offers "Show prices in: CA$ · US$ · A$ · £ · €"; picking one
 * re-renders the cards from THAT currency's rows — their own numbers, which an
 * operator may have edited apart from the default — with the "+ VAT" line
 * where that currency carries it. Billing still follows the business address
 * at signup; the choice only decides what this page prints.
 *
 * Only a currency the ladder prices AND that has sellable rows here is
 * honoured: GBP rows that were never seeded leave the visitor on the
 * collapsed grid rather than a page of empty cards.
 */
export function chosenCurrency(raw, sellable) {
  const code = String(Array.isArray(raw) ? raw[0] : raw || "").trim().toUpperCase();
  if (!SUPPORTED_CURRENCIES.includes(code)) return null;
  return (sellable || []).some((p) => p.tierKey && p.currency === code) ? code : null;
}

/** The currencies a visitor may pick: every ladder currency with sellable rows, in ladder order. */
export function currencyOptions(sellable) {
  const present = new Set((sellable || []).filter((p) => p.tierKey).map((p) => p.currency));
  return SUPPORTED_CURRENCIES.filter((c) => present.has(c));
}
