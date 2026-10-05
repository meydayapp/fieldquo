// lib/billing/usdNote.js
//
// The two pure rules behind app/components/billing/UsdBillingNote.js, apart
// from the JSX so scripts/check-usd-billing-note.mjs can run them in bare Node.

/** Should the "Billed in US dollars" note show for this billing currency? */
export function needsUsdNote(currency) {
  return Boolean(currency) && String(currency).toUpperCase() !== "USD";
}

/** Two significant figures, never finer than 1 — lib/marketing/fx.js's rule. */
export function approxRounded(n) {
  if (!Number.isFinite(n) || n <= 0) return null;
  const magnitude = Math.floor(Math.log10(n));
  const step = Math.max(1, Math.pow(10, magnitude - 1));
  return Math.round(n / step) * step;
}
