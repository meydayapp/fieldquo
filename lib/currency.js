// lib/currency.js
//
// One place that knows about currency: what a company may bill in, how to
// format an amount in it, and how it maps to Stripe. Pure and dependency-light
// (Intl only), so it's safe on the server and in the browser.
//
// The `connect` flag matters: Stripe CONNECT (contractor payouts) is available
// in a specific set of countries. A company can quote in any currency, but to
// take card payments it needs a Stripe account in a supported country. Ukraine
// is deliberately absent — Stripe Connect does not support it, and pretending
// otherwise would let a contractor set up a pay flow that can never pay out.

export const CURRENCIES = [
  { code: "USD", stripe: "usd", symbol: "$", label: "US Dollar", connect: true },
  { code: "CAD", stripe: "cad", symbol: "$", label: "Canadian Dollar", connect: true },
  { code: "EUR", stripe: "eur", symbol: "€", label: "Euro", connect: true },
  { code: "GBP", stripe: "gbp", symbol: "£", label: "British Pound", connect: true },
  { code: "AUD", stripe: "aud", symbol: "$", label: "Australian Dollar", connect: true },
  { code: "NZD", stripe: "nzd", symbol: "$", label: "New Zealand Dollar", connect: true },
  { code: "CHF", stripe: "chf", symbol: "CHF", label: "Swiss Franc", connect: true },
];

const DEFAULT_CODE = "CAD";

const BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

/** Currency metadata for a code, falling back to the default. Never throws. */
export function currencyMeta(code) {
  return BY_CODE.get(String(code || "").toUpperCase()) || BY_CODE.get(DEFAULT_CODE);
}

/** Lowercase Stripe currency code (what the Stripe API wants). */
export function stripeCurrency(code) {
  return currencyMeta(code).stripe;
}

/**
 * Format an amount in a currency. Uses Intl so each currency gets its own
 * symbol and grouping. `locale` is optional — the client's locale drives
 * grouping/placement, but the CURRENCY (and thus the symbol) is fixed by the
 * document, not the reader.
 */
export function formatMoney(amount, code, locale) {
  const meta = currencyMeta(code);
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: "currency",
      currency: meta.code,
    }).format(n);
  } catch {
    // Bad locale or exotic environment — fall back to symbol + fixed digits
    // rather than throwing on a client-facing money render.
    return `${meta.symbol}${n.toFixed(2)}`;
  }
}

/** Can a company billing in this currency take card payments via Stripe Connect? */
export function supportsConnect(code) {
  return Boolean(currencyMeta(code).connect);
}
