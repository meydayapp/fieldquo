// lib/estimate/estimateMoney.js
//
// The one way a public estimate range is put on a screen.
//
// ══ Why this is shared and not two functions ═══════════════════════════════
//
// There were two. app/f/[companySlug]/[funnelSlug]/FunnelRunner.js had a
// correct one — currencyMeta, Intl, no fraction digits — and
// app/instant-quote/[companySlug]/InstantQuoteFlow.js had a copy that read
//
//     return "$" + Math.round(Number(n) || 0).toLocaleString();
//
// Same screen, same job, same product; one of them hardcoded a dollar sign.
// A company billing in EUR or GBP saw its own estimate range quoted in
// dollars, on the public page a homeowner uses to decide whether to call
// them. The copy is the one that rotted because it is the one nobody looks
// at, which is the failure this file exists to close rather than patch.
//
// ══ Two rules the naive version broke ══════════════════════════════════════
//
// 1. The currency is the COMPANY's, never a symbol. lib/currency.js is the
//    table; there is no second one.
//
// 2. `Number(null) || 0` is a lie. A range whose low bound failed to arrive
//    rendered as "$0 – $4,000", which reads to a homeowner as a floor of
//    nothing rather than as a number we do not have. So a non-finite amount
//    returns null and the caller renders the range only when BOTH ends
//    formatted — "we don't know" and "it is zero" are different screens.
//
// ══ Whole units, not cents ═════════════════════════════════════════════════
//
// formatMoney() in lib/currency.js renders cents, which is right for an
// invoice and wrong here: the estimators round to the nearest ten precisely so
// a figure reads as measured rather than as a machine guessing, and
// "$940.00 – $1,270.00" throws that away. Same Intl formatting, same currency
// table, no fraction digits.
//
// Pure. No I/O, no React, no database — so scripts/check-public-estimate.mjs
// can run it directly against hostile input.

import { currencyMeta } from "@/lib/currency";

/**
 * One end of an estimate range, in the company's currency.
 *
 * @param amount   a whole-unit figure from the server. Never a cent value.
 * @param currency the company's currency code (lib/currency.js)
 * @param locale   optional BCP-47 tag for grouping and symbol placement. The
 *                 CURRENCY is fixed by the company; only the way the digits are
 *                 grouped follows the reader, which is why a wrong locale is
 *                 survivable and a wrong currency is not.
 * @returns {string|null} the formatted figure, or null when there is no figure
 */
export function estimateMoney(amount, currency, locale) {
  // Only a number, or a string that is one. Everything else is absence.
  //
  // Listing the empty values instead — null, undefined, "" — leaves holes, and
  // the check script found one immediately: Number([]) is 0, so an empty array
  // arriving where a figure should be would have rendered as free. `[]`, `{}`,
  // `true` and `" "` all coerce to something a `Number.isFinite` test accepts.
  // Naming the two types that ARE money has no holes to find.
  if (typeof amount !== "number" && typeof amount !== "string") return null;
  if (typeof amount === "string" && amount.trim() === "") return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  const v = Math.round(n);
  const meta = currencyMeta(currency);
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: "currency",
      currency: meta.code,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    // An exotic runtime with no ICU data, or a locale string a caller built
    // wrong. The symbol table still knows the currency, so the figure degrades
    // to the right money rather than to no money.
    return `${meta.symbol}${v.toLocaleString()}`;
  }
}

/**
 * A whole range, or null when either end is missing.
 *
 * Returned as one string because both call sites render it as one line, and
 * because the all-or-nothing rule then lives here instead of being remembered
 * at each of them.
 *
 * @returns {string|null} e.g. "$940 – $1,270"
 */
export function estimateRange(low, high, currency, locale) {
  const lo = estimateMoney(low, currency, locale);
  const hi = estimateMoney(high, currency, locale);
  if (!lo || !hi) return null;
  // Non-breaking spaces around the en dash: this is read on a phone, and a
  // line break falling between the dash and the upper bound turns one range
  // into what looks like two separate prices.
  return `${lo} – ${hi}`;
}
