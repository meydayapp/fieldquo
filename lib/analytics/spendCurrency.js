// lib/analytics/spendCurrency.js
//
// A contractor's own ad spend, reported by Meta in the AD ACCOUNT's currency,
// shown in the COMPANY's currency — at read time, approximately, and saying so.
//
// ══ What this replaces, and why it was wrong for the owner ═════════════════
//
// lib/analytics/marketingRollup.js used to EXCLUDE any MarketingSpend row
// whose `currency` differed from Company.currency: "show it, don't blend it".
// That was the right instinct — a sum that silently adds US dollars to
// Canadian ones is a wrong number wearing a currency symbol — and the wrong
// outcome. The first real ad account connected to this product reports in
// USD, the company runs in CAD, and the result was a KPI card reading
// "MARKETING SPEND $0.00" over 43 rows of real spend that the Spend page
// listed one screen away. Absence read as a statement: this business spends
// nothing on ads.
//
// ══ The rule now ═══════════════════════════════════════════════════════════
//
//   • The DATA never converts. Every row keeps the amount Meta reported in
//     the currency Meta reported it in (lib/meta/insightsImport.js still
//     writes `currency` only on a mismatch). Nothing here writes anything.
//   • The conversion happens HERE, at presentation, through the one pinned
//     rate in lib/marketing/fx.js — its date, its source and its 45-day
//     refusal window included. This module holds no rate of its own and
//     cannot: a second rate table would be the drift fx.js's header argues
//     against, one file over.
//   • Every total that includes a converted row says so (`approximate: true`)
//     and carries what was converted, from what, at what age of rate, so the
//     card can print "≈ CA$1,140.90 — includes US$821.50 converted at the
//     pinned rate (14 days old)" and a reader can redo the arithmetic.
//   • When fx.js REFUSES — the rate is past its window, or the pair is one
//     it does not hold — the rows are excluded again, and the payload names
//     the currency, the amount and the reason. A refusal that leaves the
//     total quietly smaller is the $0.00 card in a different hat.
//
// ══ Why cents, when fx.js rounds to two significant figures ════════════════
//
// fx.js converts a COMPETITOR'S published price for a public comparison
// page, and rounds to two significant figures because nothing else on that
// page tells the reader how rough the number is. Three things differ here:
// the original amount is printed in the same sentence as the conversion;
// the converted figure is an ADDEND — it is summed with same-currency rows,
// and rounding an addend to two significant figures before the sum would
// inject an error larger than the rate drift the rounding exists to
// acknowledge; and this is a back-office cost figure the contractor reads
// against his own bank statement, where "≈ $1,100" is less useful than
// "≈ $1,140.90" beside "US$821.50 at 1.3888". The "≈" and the note carry
// the caveat; the cents carry the arithmetic.

import { rateFor, rateRefusal, rateAgeDays, RATE_STALE_AFTER_DAYS } from "@/lib/marketing/fx";

const CURRENCY_RE = /^[A-Z]{3}$/;

function round2(n) {
  return Math.round(n * 100) / 100;
}

/**
 * The multiplier from `from` to `to`, with the rate it came from — or a
 * refusal. `asOf` is required for the same reason it is in fx.js: a rate is
 * only fresh against a date, and defaulting to "now" inside a pure function
 * is how a check passes on Monday and fails on Tuesday.
 *
 * @returns {{ multiplier: number, rate: object, ageDays: number, inverted: boolean, refusedBecause: null }
 *        | { multiplier: null, rate: object|null, ageDays: null, inverted: false, refusedBecause: string }}
 */
export function spendRate({ from, to, asOf }) {
  if (!asOf) throw new Error("spendRate: asOf is required — a rate is only fresh against a date");
  if (!CURRENCY_RE.test(from || "")) {
    return { multiplier: null, rate: null, ageDays: null, inverted: false, refusedBecause: `"${from}" is not a currency code` };
  }
  if (!CURRENCY_RE.test(to || "")) {
    return { multiplier: null, rate: null, ageDays: null, inverted: false, refusedBecause: `"${to}" is not a currency code` };
  }
  if (from === to) {
    return { multiplier: 1, rate: null, ageDays: null, inverted: false, refusedBecause: null };
  }
  const rate = rateFor(from, to);
  const refusedBecause = rateRefusal(rate, asOf);
  if (refusedBecause) {
    return {
      multiplier: null,
      rate,
      // The age is still reported on a STALE refusal — it is the number the
      // screen prints ("the rate is 52 days old"). Null when there is no
      // rate at all, or the rate is malformed and has no measurable age.
      ageDays: rate ? rateAgeDays(rate, asOf) : null,
      inverted: false,
      refusedBecause,
      // A CODE beside fx.js's English sentence, so a screen in one of the
      // other eight languages can say why in its own words rather than
      // print an English refusal inside a French frame — the exact failure
      // the sales portal shipped and was fixed for. The sentence stays in
      // the payload for the API reader and the log.
      reasonCode: !rate ? "no_rate" : /days old/.test(refusedBecause) ? "stale_rate" : "unusable_rate",
    };
  }
  const inverted = rate.base !== from;
  return {
    multiplier: inverted ? 1 / rate.rate : rate.rate,
    rate,
    ageDays: rateAgeDays(rate, asOf),
    inverted,
    refusedBecause: null,
  };
}

/**
 * Every spend row, priced in the company's currency where that is honest.
 *
 * Takes rows shaped like MarketingSpend (`amount`, `currency`, anything else
 * passes through) and returns, for each, the amount to SUM in the company's
 * currency — or null when the row must be excluded — plus the summary a
 * screen needs to explain the total.
 *
 * Grouped by currency, not per row: one refusal reason per currency, one
 * converted subtotal per currency, so the note under a card is one sentence
 * per foreign currency rather than one per day of spend.
 *
 * @param {object[]} rows           MarketingSpend rows (amount may be a
 *                                  Prisma Decimal — Number() is applied)
 * @param {string}   companyCurrency Company.currency
 * @param {Date|string} asOf        the clock the rate's age is measured against
 */
export function priceSpendRows({ rows, companyCurrency, asOf }) {
  if (!asOf) throw new Error("priceSpendRows: asOf is required");
  const list = Array.isArray(rows) ? rows : [];

  // A row with no `currency`, or the company's own, needs no conversion.
  // A row carrying a currency code that is the company's own is treated the
  // same way — the import writes null in that case, but a company that
  // CHANGES its currency to match its ad account should not lose its history.
  const isNative = (row) => !row?.currency || row.currency === companyCurrency;

  const byCurrency = new Map();
  for (const row of list) {
    if (isNative(row)) continue;
    const cur = row.currency;
    if (!byCurrency.has(cur)) byCurrency.set(cur, { amount: 0, count: 0 });
    const g = byCurrency.get(cur);
    g.amount += Number(row.amount) || 0;
    g.count += 1;
  }

  const converted = [];
  const excluded = [];
  const multipliers = new Map();
  for (const [currency, g] of byCurrency) {
    const r = spendRate({ from: currency, to: companyCurrency, asOf });
    if (r.refusedBecause) {
      excluded.push({
        currency,
        amount: round2(g.amount),
        count: g.count,
        reason: r.refusedBecause,
        reasonCode: r.reasonCode,
        rateAgeDays: r.ageDays,
        windowDays: RATE_STALE_AFTER_DAYS,
      });
      continue;
    }
    multipliers.set(currency, r.multiplier);
    converted.push({
      currency,
      amount: round2(g.amount),
      count: g.count,
      convertedAmount: round2(g.amount * r.multiplier),
      rate: r.rate.rate,
      rateBase: r.rate.base,
      rateQuote: r.rate.quote,
      inverted: r.inverted,
      rateDate: r.rate.rateDate,
      rateAgeDays: r.ageDays,
      rateSourceName: r.rate.sourceName,
      rateSource: r.rate.source,
    });
  }

  const priced = list.map((row) => {
    if (isNative(row)) return { row, amountInCompanyCurrency: Number(row.amount) || 0, converted: false };
    const m = multipliers.get(row.currency);
    if (m === undefined) return { row, amountInCompanyCurrency: null, converted: false };
    return { row, amountInCompanyCurrency: (Number(row.amount) || 0) * m, converted: true };
  });

  return {
    priced,
    // True the moment ONE converted row is in a total. A screen prints "≈"
    // off this and nothing else.
    approximate: converted.length > 0,
    convertedFrom: converted.map((c) => c.currency),
    conversions: converted,
    excluded,
  };
}
