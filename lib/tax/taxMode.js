// lib/tax/taxMode.js
//
// Whether a company's tax is worked out from the job's province or state
// (`auto`) or taken from the rates the company typed (`manual`) — and what
// the company's own default rate is when the ladder falls all the way
// through.
//
// ── Why a mode, and why it defaults to automatic ────────────────────────────
//
// The owner, 2026-09-21, on a new quote for a client in Ottawa that opened
// on "No tax rate is known for Ottawa, ON yet — enter the rate, or switch
// tax off for this quote": "That should not be true — taxes should be
// automatically set based on the province / state." Canada's GST/HST/PST/QST
// is determined by the province (lib/tax/jurisdictions.js carries the CRA
// rates with sources and dates); for the US the owner's earlier decision
// (docs/US-SALES-TAX.md, 2026-09-19) is to apply the full combined rate by
// default and print the state's own rule as a hint. So the published table is
// consulted for every company unless the company has said otherwise.
//
// `manual` is the honest opposite: the company's own TaxRate rows, matched to
// the province by name, then its default — and never the table. It exists for
// a contractor who has a reason the tables cannot know (a registration, an
// exemption regime, a flat rate agreed with an accountant).
//
// ── Migration: what an existing company gets ────────────────────────────────
//
// Company.taxMode is nullable, and null means "never chosen". It is read
// through effectiveTaxMode() below, which derives the mode from the one
// setting that existed before it: autoApplyLocalTax. Every row in
// production on 2026-09-21 had autoApplyLocalTax = true (the column's
// default), so every existing company resolves to `auto` — which is the
// ladder they were already on. A company that had switched autoApplyLocalTax
// OFF is the only one that becomes `manual`, and that is the setting they
// chose. Nothing a company typed changes under either mode: its own named
// rates still win over the table in `auto`, and its default still applies
// wherever the table has no answer.
//
// New rows get the column default, `auto`. The settings screen writes the
// column explicitly (and keeps autoApplyLocalTax in step for anything that
// still reads it), after which the derivation is never consulted again for
// that company.

export const TAX_MODES = Object.freeze(["auto", "manual"]);

/** "auto" | "manual", never null. */
export function effectiveTaxMode(company) {
  const explicit = String(company?.taxMode || "").trim().toLowerCase();
  if (TAX_MODES.includes(explicit)) return explicit;
  return company?.autoApplyLocalTax === false ? "manual" : "auto";
}

/** Accepts "auto" / "manual" in any case; anything else is null. */
export function parseTaxMode(value) {
  const v = String(value || "").trim().toLowerCase();
  return TAX_MODES.includes(v) ? v : null;
}

/**
 * The company's own fallback rate: the TaxRate row flagged as default —
 * the one Settings → Tax shows and lets them edit — else Company.taxRate,
 * a column the settings screen never exposed and which only the demo seed
 * writes. Both zero (or absent) means the company has stated no default,
 * and the caller must say "unknown" rather than print 0%.
 *
 * @returns {{ rate: number, label: string|null }}
 */
export function companyDefaultRate(company, taxRates) {
  const rows = Array.isArray(taxRates) ? taxRates : [];
  const flagged = rows.find((r) => r && r.isDefault && Number.isFinite(Number(r.rate)) && Number(r.rate) > 0);
  if (flagged) return { rate: Number(flagged.rate), label: flagged.name || null };
  const flat = Number(company?.taxRate || 0);
  if (Number.isFinite(flat) && flat > 0) return { rate: flat, label: null };
  return { rate: 0, label: null };
}
