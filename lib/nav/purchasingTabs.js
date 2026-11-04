// ── Four destinations behind one word ────────────────────────────────────
//
// The owner asked "where do I put the inventory, it is not inside
// purchasing" — and it is: the Stock tab, second of four. Search could not
// say so, because the only string it had to match was the Purchasing row's
// own label, "Purchasing". Typing "stock" or "inventory" found nothing, and
// the app says "inventory" nowhere else either.
//
// These are found, never rendered: the sidebar, the rail and the More sheet
// all read `items` and ignore `searchExtras`, so the nav keeps one
// Purchasing row. Only GlobalSearch expands them, and each one's ?tab=
// lands on that tab (the page reads it on mount).
//
// ── Why they live in their own file (2026-11-04) ─────────────────────────
//
// They were an inline `searchExtras: [ … ]` on the Purchasing row in
// AdminSidebar.js. Three scripts — check-nav-audit, check-shell and
// check-product-analytics — parse the sidebar rows with a regex, and
// check-nav-audit states the assumption they all share: every row is "a
// single flat object literal with no nested braces … that's what makes this
// safe without a real parser". The nested array broke that. The parent
// Purchasing row stopped matching and these four matched in its place, so
// check-shell reported /app/purchasing as having lost its row (it had not)
// and check-product-analytics demanded catalogue lines for four hrefs that
// are not nav rows at all.
//
// That mattered far out of proportion: check:all is a single 695-step &&
// chain, check:shell is step 64, and its failure meant steps 65-695 never
// ran — including check:nav-audit (step 304), the one script whose whole job
// is catching a page reachable from nothing. 631 guards were dark.
//
// A named constant in AdminSidebar.js would not have been enough:
// check-product-analytics scans that whole file rather than just the row
// arrays, so the hrefs would still have read as rows. Holding them here
// keeps that file free of href literals that are not rows, which is the
// distinction being drawn — /app/purchasing is one catalogued page
// (lib/analytics/product/appPages.js) and these are search aliases onto its
// tabs, not four more destinations.
export const PURCHASING_TABS = [
  { key: "app.nav.purchasing.stock", href: "/app/purchasing?tab=stock" },
  { key: "app.nav.purchasing.orders", href: "/app/purchasing?tab=orders" },
  { key: "app.nav.purchasing.suppliers", href: "/app/purchasing?tab=suppliers" },
  { key: "app.nav.purchasing.requests", href: "/app/purchasing?tab=requests" },
];
