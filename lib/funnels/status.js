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
// ── Keys, not words ────────────────────────────────────────────────────────
//
// This map used to hold English, with a note saying it was a deliberate
// exception because the funnels tree was English-first "until the i18n pass
// happens, and this map is the one place that changes". That pass has now
// happened — both funnel screens go through t() — so this is that change, and
// the module is back in line with every other status module in the codebase:
// a key, never a word, because English in lib/ is English in every office.
//
// The key set is asserted against `enum FunnelStatus` by
// scripts/check-job-status-vocabulary.mjs, so a third status added to the
// schema fails there rather than reaching a badge as raw column text.

export const FUNNEL_STATUS_LABEL = {
  draft: "app.funnels.status.draft",
  published: "app.funnels.status.published",
};

/**
 * The catalogue KEY for a status, falling back to the raw value.
 *
 * The fallback is deliberately the value and not a generic key: t() renders an
 * unknown key as the key itself, so a status the schema grew and this map did
 * not would print the dotted key straight onto a badge. The raw column word is
 * ugly; a dotted key is a bug report shown to a customer.
 */
export function funnelStatusLabel(status) {
  return FUNNEL_STATUS_LABEL[status] || String(status || "");
}
