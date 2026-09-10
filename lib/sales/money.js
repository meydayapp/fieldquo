// lib/sales/money.js
//
// Cents as money, in a module with NO IMPORTS.
//
// That constraint is the whole reason this file exists rather than the function
// living in earnings.js beside everything else that uses it. earnings.js pulls
// MILESTONE_ORDER and balanceCents from commission.js, commission.js imports
// `db`, and `db` drags the `pg` Pool — and therefore node's `dns` — into
// anything that imports it. A "use client" component that wanted one currency
// formatter took the whole chain with it and the Turbopack build failed on
// `Can't resolve 'dns'`.
//
// Same shape, same reason, as lib/voice/nanp.js being split out of
// numberSearch.js so a client component could ask which country an area code
// belongs to without the Twilio SDK. Keep this file dependency-free.
//
// The implementation moved here from a private copy in
// /platform/sales/performance, so the figure a rep reads on their own pay
// screen and the figure a superadmin reads in the console are formatted by one
// function rather than by two that can drift.

/**
 * Negative renders with a leading minus, never in brackets: a rep checking
 * their pay on a phone should not need an accounting convention to see that
 * something was taken back.
 *
 * Non-numeric returns an em dash rather than "$NaN" — the honest rendering of
 * "no figure" is not a figure.
 */
export function centsToMoney(cents) {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "—";
  return `${n < 0 ? "-" : ""}$${Math.abs(n / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
