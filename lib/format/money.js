// lib/format/money.js
//
// One money format for the whole app, on top of the one the documents use.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// QA reported "$2100.00" on the client-facing quote. The fix went into
// documentFormatters — and the number stayed wrong, because the pages were
// never calling documentFormatters. Each had grown its own:
//
//   const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;
//
// Six private copies at last count, plus a scattering of inline
// `${x.toFixed(2)}`. toFixed does not group, so every one of them printed
// $2100.00 next to a shared-formatter $2,100.00 on the same screen. Fixing the
// shared formatter could never reach them; that is the whole failure.
//
// So this is deliberately a thin wrapper over documentFormatters rather than a
// seventh implementation. Same Intl call, same locale map, same currency
// coalesce, same NaN guard — a document and the screen that produced it cannot
// disagree about what $2,100 looks like.
//
// ── Currency and locale are different questions ────────────────────────────
//
// Currency belongs to the COMPANY: a Boston contractor bills in USD whoever is
// reading. Locale belongs to the READER: a francophone sees "2 100,00 $" for
// the same amount. Passing one where the other belongs is how "CA$" ends up in
// front of an American company's totals.

import { documentFormatters } from "@/lib/i18n/documentLabels";

/**
 * Format an amount.
 *
 * @param {number|string|null} amount
 * @param {string|null} [currency]  the COMPANY's billing currency; null/""
 *   falls back to CAD inside documentFormatters, matching the schema default.
 * @param {string} [language]       the READER's app language.
 */
export function formatAppMoney(amount, currency, language = "en") {
  return documentFormatters(language, currency).money(amount);
}

/**
 * The same thing, curried, for a component that formats several amounts.
 *
 *   const money = moneyFormatter(company?.currency, language);
 *
 * Deliberately not a React hook: plenty of call sites are outside a component,
 * and a hook would make them refactor to use it — which is exactly how the
 * private copies got written in the first place.
 */
export function moneyFormatter(currency, language = "en") {
  const { money } = documentFormatters(language, currency);
  return money;
}
