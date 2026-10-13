// lib/tenders/summary.js
//
// The win/loss card on /app/tenders: how many tenders sit in each status,
// what they are worth, and the win rate. Pure, so the check script feeds it
// hostile rows.
//
// ══ What a tender is "worth" ═══════════════════════════════════════════════
//
// The best figure the tender actually has, in this order:
//
//   1. awardedValue  — what the contract was signed for (won only)
//   2. our bid       — the linked quote's total
//   3. estimatedValue — the buyer's published estimate
//
// A tender with none of the three is COUNTED but not valued, and the card
// says how many such there are. Treating it as $0 would make a status look
// smaller than it is; leaving it out of the count would make it look emptier
// (AGENTS.md failure class #5 — absence is not zero).
//
// Sums run in integer cents: three Decimal strings added as floats is how a
// total ends in .0000000001.
import { TENDER_STATUSES } from "./constants";

function cents(value) {
  if (value === null || value === undefined || value === "") return null;
  const s = typeof value === "number" ? value.toFixed(2) : String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** The cents a tender is worth, and which figure that came from — or null. */
export function tenderValueCents(t) {
  if (!t || typeof t !== "object") return null;
  if (t.status === "won") {
    const awarded = cents(t.awardedValue);
    if (awarded !== null) return { cents: awarded, basis: "awarded" };
  }
  const bid = cents(t.quote?.total);
  if (bid !== null) return { cents: bid, basis: "bid" };
  const estimate = cents(t.estimatedValue);
  if (estimate !== null) return { cents: estimate, basis: "estimate" };
  return null;
}

/**
 * @param {Array} tenders  rows with status, awardedValue, estimatedValue, quote.total
 * @param {object} opts
 * @param {boolean} opts.canSeeMoney  false → every value is absent, counts only
 * @returns {{
 *   byStatus: Record<string, { count: number, value: number|null, unvalued: number }>,
 *   total: number,
 *   decided: number,
 *   winRate: number|null,   // won / (won + lost), 0..1; null with nothing decided
 *   canSeeMoney: boolean,
 * }}
 */
export function winLossSummary(tenders, { canSeeMoney = false } = {}) {
  const byStatus = {};
  for (const s of TENDER_STATUSES) byStatus[s] = { count: 0, cents: 0, unvalued: 0 };
  let total = 0;
  for (const t of Array.isArray(tenders) ? tenders : []) {
    if (!t || !Object.prototype.hasOwnProperty.call(byStatus, t.status)) continue;
    total += 1;
    const bucket = byStatus[t.status];
    bucket.count += 1;
    const v = canSeeMoney ? tenderValueCents(t) : null;
    if (v) bucket.cents += v.cents;
    else bucket.unvalued += 1;
  }
  const out = {};
  for (const s of TENDER_STATUSES) {
    const b = byStatus[s];
    out[s] = {
      count: b.count,
      // Absent, not zero, for a member who may not see money.
      value: canSeeMoney ? b.cents / 100 : null,
      unvalued: canSeeMoney ? b.unvalued : null,
    };
  }
  const decided = byStatus.won.count + byStatus.lost.count;
  return {
    byStatus: out,
    total,
    decided,
    winRate: decided > 0 ? byStatus.won.count / decided : null,
    canSeeMoney: !!canSeeMoney,
  };
}
