// lib/analytics/periodPresets.js
//
// "This month", "Last quarter", and the three others — one implementation.
//
// ── Why UTC, not the browser's clock ───────────────────────────────────────
//
// Every analytics endpoint decides range membership on UTC calendar days
// (lib/export/accountingExport.js says why). Building "this month" from the
// browser's local clock puts a document on the wrong side of a boundary for
// anyone west of Greenwich, and two screens reading the same API then disagree
// about the same month.
//
// ── Why it is shared ───────────────────────────────────────────────────────
//
// This was written inside app/app/analytics/statements/page.js, which is fine
// until a second analytics screen needs the same five buttons — and then the
// copy is the one that rots, because it is the one nobody looks at (AGENTS.md
// failure class 4). Both screens import it now.

const iso = (d) => d.toISOString().slice(0, 10);
const utc = (y, m, day) => new Date(Date.UTC(y, m, day));

/**
 * @param {string} key  one of PERIOD_PRESETS' keys
 * @param {Date}   [now]
 * @returns {{ from: string, to: string }} inclusive YYYY-MM-DD bounds
 */
export function presetRange(key, now = new Date()) {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  switch (key) {
    case "thisMonth":
      return { from: iso(utc(y, m, 1)), to: iso(utc(y, m + 1, 0)) };
    case "lastMonth":
      return { from: iso(utc(y, m - 1, 1)), to: iso(utc(y, m, 0)) };
    case "thisQuarter": {
      const q = Math.floor(m / 3) * 3;
      return { from: iso(utc(y, q, 1)), to: iso(utc(y, q + 3, 0)) };
    }
    case "yearToDate":
      return { from: iso(utc(y, 0, 1)), to: iso(utc(y, m, now.getUTCDate())) };
    case "lastYear":
      return { from: iso(utc(y - 1, 0, 1)), to: iso(utc(y - 1, 11, 31)) };
    default:
      return { from: iso(utc(y, m, 1)), to: iso(utc(y, m + 1, 0)) };
  }
}

/** [key, English label] — the label is a t() fallback, not the displayed string. */
export const PERIOD_PRESETS = [
  ["thisMonth", "This month"],
  ["lastMonth", "Last month"],
  ["thisQuarter", "This quarter"],
  ["yearToDate", "Year to date"],
  ["lastYear", "Last year"],
];
