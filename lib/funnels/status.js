// lib/funnels/status.js
//
// What a funnel's status is CALLED, in the one place both screens read it from.
//
// Both the funnels list and the builder header printed `{funnel.status}` — the
// column itself. `enum FunnelStatus` is lowercase, so a contractor read the
// word "draft". That is the same failure the invoices list shipped when a
// chargeback printed `partially_refunded` (lib/invoices/statusPresentation.js)
// and the jobs tree shipped three separate times; it is smaller here only
// because this enum has two values and neither has an underscore in it. The
// shape is identical, and so is the fix: one map, driven against the schema by
// check:funnel-delete-scope, so a third value added to FunnelStatus fails the
// build here rather than reaching a screen as raw column text.
//
// ── Words, not keys, and only in this file ─────────────────────────────────
//
// Every other status module in this codebase returns a translation KEY and
// refuses to hold English, because English in lib/ is English in every office.
// This one holds English on purpose, and it is a deliberate exception rather
// than an oversight: the funnels tree is English-first by a product decision
// recorded in both page headers ("a full i18n pass is a follow-up"). A single
// badge resolved through t() inside an otherwise English screen would be one
// French word in an English sentence, which is worse than the English. When
// the funnels i18n pass happens, this map is the one place that changes.

export const FUNNEL_STATUS_LABEL = {
  draft: "Draft",
  published: "Published",
};

/** The label, falling back to the raw value rather than a blank badge. */
export function funnelStatusLabel(status) {
  return FUNNEL_STATUS_LABEL[status] || String(status || "");
}
