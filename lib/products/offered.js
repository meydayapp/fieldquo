// lib/products/offered.js
//
// Which price-book rows are still OFFERED — the one rule every picker, the
// builders and the settings lists share.
//
// ══ The archive is Product.active ══════════════════════════════════════════
//
// A service a company "removes from its list" (the untick in Confirm what you
// quote, Remove in Settings › Products & Services) is never deleted: past
// quotes, invoices, costing rows, commissions and job plans point at it by
// id, and the owner's standing rule is no data deletion. It is set
// `active: false` — a column that already existed and that the server-side
// readers (AI tools, the voice agent, the add-on offers, plan templates,
// translations, the benchmark) already filtered on. What did NOT respect it
// before 2026-09-25 were the screens that load the whole book through
// GET /api/products and filter in the browser: the quote builder's line-item
// library, the invoice builder, Settings › Services' seed and template cards
// and the benchmark page. They call `offeredOnly` below.
//
// Readers that look a product up BY ID for something already written — the
// costing write, commissions, the job plan, a plan offer's included items,
// the production-rate map — deliberately do NOT filter: a removed service is
// still what that quote was built from.
//
// The seeders see archived rows on purpose (lib/products/seedServices.js and
// seedStandardAddOns.js read every row): a removed service is "held", so
// "Add missing services" and the signup seeder never re-create it behind the
// company's back, and ticking it again restores the same row
// (app/api/settings/products/confirm-services) rather than adding a copy.
//
// Pure and dependency-free: the builders import it in the browser.

/** True unless the row has been removed from the company's list. */
export function isOffered(product) {
  return Boolean(product) && typeof product === "object" && product.active !== false;
}

/** The rows still offered, in the order given. Garbage in, [] out. */
export function offeredOnly(products) {
  return Array.isArray(products) ? products.filter(isOffered) : [];
}

/** The rows the company removed — Settings › Products & Services' "Removed" tab. */
export function removedOnly(products) {
  return Array.isArray(products)
    ? products.filter((p) => Boolean(p) && typeof p === "object" && p.active === false)
    : [];
}
