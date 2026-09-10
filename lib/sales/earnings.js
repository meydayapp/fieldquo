// lib/sales/earnings.js
//
// What a rep has earned, and where each company has got to.
//
// ══ Why this did not exist ════════════════════════════════════════════════
//
// Every part of the commission machine was already built: SalesCommissionEntry
// carries an amount, SalesPayoutBatch carries a week and a paidAt, a Monday
// cron closes the batches, and /platform/sales/performance shows all of it —
// to a superadmin.
//
// A rep could see none of it. /sales/pay was a settings screen: where to send
// the money, in what language, and not one figure. /sales/companies rendered
// milestone pills through REP_MILESTONE_SELECT, which deliberately omits
// amountCents. So the answer to "what have I earned, and what is coming" was
// nowhere in the portal a salesperson lives in — the one screen where the
// answer decides whether they keep making calls.
//
// ══ Reversals net, they do not vanish ═════════════════════════════════════
//
// reverseMilestone writes a NEW row carrying the NEGATIVE, and leaves the
// original saying "earned" — the pair IS the history and neither half may be
// hidden. So a rep's total is a SUM over every row, never a sum over the rows
// that look positive, and the reversal appears in the list with its minus sign
// rather than being quietly filtered out. A screen that showed $20 earned and
// silently dropped the -$20 beside it would be lying about money, which is the
// one thing this portal cannot do and keep a salesperson.
//
// balanceCents and splitPayable already answer this for the payout closer, and
// are reused here rather than re-derived: the screen and the cheque must not be
// able to disagree.
//
// ══ Pure ══════════════════════════════════════════════════════════════════
//
// Takes rows the caller has already read. scripts/check-sales-earnings.mjs
// drives every branch — a reversal, an under-review row, a week with nothing
// in it, a company with no milestones — without a database.
import {
  MILESTONE_ORDER,
  MILESTONE_LABELS,
  MILESTONE_LABEL_KEYS,
  balanceCents,
  splitPayable,
} from "./commission";
import { centsToMoney } from "./money";

// Re-exported so existing server-side callers keep one import, while a client
// component takes it from lib/sales/money directly — this file reaches `db`
// through commission.js and cannot be pulled into a browser bundle.
export { centsToMoney };

/**
 * A milestone that has not happened is PENDING, and pending is not a promise.
 *
 * The three rungs are a fixed, known ladder — MILESTONE_ORDER — so showing all
 * three with two of them marked "not yet" states a defined progression rather
 * than inventing a timeline. That distinction is why /sales/companies still
 * says "None recorded" for a company with an empty ledger: there, nothing is
 * known, and drawing three greyed rungs would imply a clock that is not
 * running. Here at least one rung has actually fired.
 *
 * @param entries  this company's entries for this rep.
 */
export function ladderFor(entries = []) {
  const rows = Array.isArray(entries) ? entries : [];
  return MILESTONE_ORDER.map((milestone) => {
    const forThis = rows.filter((e) => e?.milestone === milestone);
    const earned = forThis.find((e) => e?.status === "earned");
    const reversed = forThis.find((e) => e?.status === "reversed");
    const review = forThis.find((e) => e?.status === "under_review");
    // Reversed outranks earned in the LABEL, because the money is not there —
    // but the earned row is still listed, because it still happened.
    const state = reversed ? "reversed" : review ? "under_review" : earned ? "earned" : "pending";
    return {
      milestone,
      label: MILESTONE_LABELS[milestone] || milestone,
      // The key beside the words, so app/components/sales/EarningsPanel.js
      // renders the rung in the rep's own language. Derived from the milestone
      // rather than written out, so a milestone added later cannot ship with
      // no key — see MILESTONE_LABEL_KEYS in ./commission.js.
      labelKey: MILESTONE_LABEL_KEYS[milestone] || null,
      state,
      occurredAt: earned?.occurredAt || review?.occurredAt || null,
      // The NET for this rung, so an earning and its reversal read as zero
      // rather than as a payment the rep will go looking for.
      cents: balanceCents(forThis),
    };
  });
}

/**
 * How far up the ladder a company is, as "2 of 3".
 *
 * Counts rungs that are actually standing — a reversed rung is not progress.
 */
export function ladderProgress(ladder = []) {
  const rungs = Array.isArray(ladder) ? ladder : [];
  return { reached: rungs.filter((r) => r.state === "earned").length, total: rungs.length };
}

/**
 * One week of pay.
 *
 * `cents` is re-summed from the entries rather than read from
 * totalCentsAtClose. That column is a record of what was owed AT THE CLOSE and
 * is deliberately not the figure paid from — a reversal landing after the close
 * has to be visible, and showing the cached total would paper over exactly the
 * case a rep needs to understand.
 */
function weekOf(batch, entries) {
  const lines = entries.filter((e) => e.payoutBatchId === batch.id);
  return {
    id: batch.id,
    periodStart: batch.periodStart,
    periodEnd: batch.periodEnd,
    status: batch.status,
    paidAt: batch.paidAt || null,
    cents: balanceCents(lines),
    closedCents: Number(batch.totalCentsAtClose) || 0,
    // Surfaced rather than hidden: if these two disagree, something moved after
    // the week closed, and the screen says so instead of picking one.
    movedSinceClose: balanceCents(lines) !== (Number(batch.totalCentsAtClose) || 0),
    lines,
  };
}

/**
 * Everything the rep's pay screen needs, in one object.
 *
 * @param entries   the rep's own entries, with company names already attached.
 * @param batches   the rep's payout batches, newest first.
 */
export function earningsView({ entries = [], batches = [] } = {}) {
  const rows = Array.isArray(entries) ? entries : [];
  const runs = Array.isArray(batches) ? batches : [];
  const { unbatched } = splitPayable(rows);

  const weeks = runs.map((b) => weekOf(b, rows));
  const paidCents = balanceCents(weeks.filter((w) => w.status === "paid").flatMap((w) => w.lines));
  const awaitingCents = balanceCents(
    weeks.filter((w) => w.status !== "paid").flatMap((w) => w.lines),
  );

  // Grouped by company so "which companies are at which stage" is answerable
  // from the same read, rather than from a second screen with its own arithmetic.
  const byCompanyId = new Map();
  for (const e of rows) {
    if (!e?.companyId) continue;
    if (!byCompanyId.has(e.companyId)) byCompanyId.set(e.companyId, []);
    byCompanyId.get(e.companyId).push(e);
  }
  const companies = [...byCompanyId.entries()]
    .map(([companyId, list]) => {
      const ladder = ladderFor(list);
      return {
        companyId,
        companyName: list.find((e) => e.companyName)?.companyName || null,
        ladder,
        progress: ladderProgress(ladder),
        cents: balanceCents(list),
      };
    })
    // Most recently active first: a rep opening this screen wants the company
    // that just moved, not the alphabetical one.
    .sort((a, b) => {
      const at = Math.max(...a.ladder.map((r) => (r.occurredAt ? new Date(r.occurredAt).getTime() : 0)));
      const bt = Math.max(...b.ladder.map((r) => (r.occurredAt ? new Date(r.occurredAt).getTime() : 0)));
      return bt - at;
    });

  return {
    totals: {
      // Every row, reversals included, which is what the rep is actually owed
      // across all time.
      lifetimeCents: balanceCents(rows),
      paidCents,
      awaitingCents,
      thisWeekCents: balanceCents(unbatched),
    },
    weeks,
    openLines: unbatched,
    companies,
  };
}
