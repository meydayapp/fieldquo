// lib/subcontractors/receivedPriceFilters.js
//
// The browser half of "Quotes from my subs" (/app/subcontractors/quotes):
// the statuses a received price can be in, and the trade / status / sub
// filters. No imports, so the page can load it without pulling the server's
// compare and change-order modules into the bundle; the decisions about what
// a row IS live in ./receivedPrices.js, which re-exports these.

/**
 * Where a price a sub sent stands, in the order a GC reads the list:
 *
 *   not_used        it arrived (a no-account sub typed it into a price
 *                   request's reply form) and the GC has not put it in the
 *                   compare yet.
 *   option          in the compare on one of the GC's quotes, on no client
 *                   document.
 *   on_quote        a line on the GC's quote to their client.
 *   extra_pending   carried by a change order the client has not signed
 *                   (not yet sent, or out for signature).
 *   extra_approved  carried by a change order the client signed.
 *   extra_declined  offered as extra work and the client said no — an
 *                   option again (lib/quotes/importOptions.js derives the
 *                   placement from the change order, never stores it).
 */
export const RECEIVED_PRICE_STATUSES = Object.freeze([
  "not_used",
  "option",
  "on_quote",
  "extra_pending",
  "extra_approved",
  "extra_declined",
]);

/** The filter selects' "all" value. */
export const ALL = "all";

/**
 * The rows that match the three filters. An unknown filter value (a stale
 * URL, a hand-edited select) matches nothing rather than everything: a
 * filter that silently stops filtering reads as "these are all of them".
 */
export function filterReceivedPrices(rows, { trade = ALL, status = ALL, sub = ALL } = {}) {
  const list = Array.isArray(rows) ? rows : [];
  return list.filter(
    (r) =>
      r &&
      (trade === ALL || r.tradeKey === trade) &&
      (status === ALL || r.status === status) &&
      (sub === ALL || r.subKey === sub),
  );
}

/**
 * The choices each filter offers: only values present in the list, each
 * once, with how many rows carry it. Statuses keep their reading order;
 * trades and subs are alphabetical by their label.
 */
export function receivedPriceFilterOptions(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter(Boolean);
  const tally = (keyOf, labelOf) => {
    const map = new Map();
    for (const r of list) {
      const key = keyOf(r);
      if (!key) continue;
      const cur = map.get(key) || { value: key, label: labelOf(r) || "", count: 0 };
      cur.count++;
      map.set(key, cur);
    }
    return [...map.values()];
  };
  const byLabel = (a, b) => a.label.localeCompare(b.label);
  const statusCounts = tally((r) => r.status, (r) => r.status);
  return {
    trades: tally((r) => r.tradeKey, (r) => r.trade).sort(byLabel),
    subs: tally((r) => r.subKey, (r) => r.subName).sort(byLabel),
    statuses: RECEIVED_PRICE_STATUSES.map((s) => statusCounts.find((x) => x.value === s)).filter(Boolean),
  };
}
