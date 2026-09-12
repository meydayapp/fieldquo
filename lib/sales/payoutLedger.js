// lib/sales/payoutLedger.js
//
// "How much do I need to pay them each week or period" — the owner's
// question, answered from the commission ledger.
//
// ══ Re-summed, never read from totalCentsAtClose ══════════════════════════
//
// Every figure here is a sum over SalesCommissionEntry rows. None is read from
// SalesPayoutBatch.totalCentsAtClose, for the reason lib/sales/payouts.js
// gives at its head: that column "exists and is deliberately NOT what anyone
// pays from. It is a record of what was owed at the moment the batch closed,
// useful for spotting a discrepancy, and a discrepancy is exactly the thing
// worth spotting: a reversal landing after the close SHOULD change what is
// paid." A reversal that lands on Tuesday against a batch closed on Monday
// reduces the owed figure on this screen the same day, which is what makes
// the screen usable for paying from.
//
// ══ Periods ═══════════════════════════════════════════════════════════════
//
// A week is the UTC Monday-to-Monday week lib/sales/payouts.js closes — the
// same weekBounds(), so the table's rows are the batches' rows. A month is the
// UTC calendar month. Entries are bucketed by their own occurredAt, which for
// weeks coincides with the batch they sit in (entriesForWindow is half-open on
// the same boundaries), and for months gives an exact month sum even though
// a batch's week may straddle two months.
//
// ══ Cell status ═══════════════════════════════════════════════════════════
//
//   open  — some of the cell's rows are not in a batch yet (still accruing)
//   owed  — every row is batched and at least one batch is `ready`
//   paid  — every row is batched and every batch is `paid`
//   (blank when the cell has no rows)
//
// A month cell spanning several weekly batches is "paid" only when all of
// them are. Absence of a statement is not a statement: a month with three
// paid weeks and one open is open, not "mostly paid".
//
// ══ Pure ══════════════════════════════════════════════════════════════════
//
// Takes rows the route has already read, so scripts/check-sales-payout-proof
// .mjs executes it against a fixture with two reps and a reversal landing
// after a close, and asserts the sums against the ledger directly.
import { balanceCents } from "./commission";
import { weekBounds } from "./payouts";
import { centsToMoney } from "./money";

export const PERIODS = ["week", "month"];

export function isPeriod(value) {
  return PERIODS.includes(value);
}

/** The UTC period containing `at`. */
export function periodBounds(period, at) {
  const d = at instanceof Date ? at : new Date(at);
  if (period === "month") {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    return { start, end };
  }
  return weekBounds(d);
}

/** A stable key for a period: its start instant, ISO. */
export function periodKey(period, at) {
  return periodBounds(period, at).start.toISOString();
}

/** "1–8 Sep 2026" / "September 2026", in UTC — the boundary is UTC. */
export function periodLabel(period, start) {
  const s = new Date(start);
  if (period === "month") {
    return s.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  const e = new Date(s);
  e.setUTCDate(e.getUTCDate() + 6);
  const day = (d) => d.toLocaleDateString("en-CA", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${day(s)} – ${day(e)} ${s.getUTCFullYear()}`;
}

/**
 * The three figures at the top.
 *
 * @param entries   every commission entry (all reps), with payoutBatchId.
 * @param batches   every batch, with id, status, paidAt.
 * @param period    "week" | "month" — what "this cycle" means for the paid figure.
 * @param now       the clock.
 */
export function owedSnapshot({ entries = [], batches = [], period = "week", now = new Date() } = {}) {
  const rows = Array.isArray(entries) ? entries : [];
  const byBatch = new Map((Array.isArray(batches) ? batches : []).map((b) => [b.id, b]));
  const { start, end } = periodBounds(period, now);
  const inCycle = (at) => {
    if (!at) return false;
    const t = new Date(at);
    return t >= start && t < end;
  };

  const inReady = rows.filter((e) => e.payoutBatchId && byBatch.get(e.payoutBatchId)?.status === "ready");
  const unbatched = rows.filter((e) => !e.payoutBatchId);
  const paidThisCycle = rows.filter((e) => {
    const b = e.payoutBatchId ? byBatch.get(e.payoutBatchId) : null;
    return b?.status === "paid" && inCycle(b.paidAt);
  });

  return {
    // Closed and not yet paid — what a transfer today would have to cover.
    owedNowCents: balanceCents(inReady),
    // Not in any batch yet: this week so far, plus anything a cron has not
    // closed. Both are "will be owed", neither is payable today.
    accruingCents: balanceCents(unbatched),
    // Batches whose paidAt falls in the current period.
    paidThisCycleCents: balanceCents(paidThisCycle),
    readyBatchCount: new Set(inReady.map((e) => e.payoutBatchId)).size,
    cycle: { period, start, end },
  };
}

function cellStatus(cellRows, byBatch) {
  if (!cellRows.length) return null;
  if (cellRows.some((e) => !e.payoutBatchId)) return "open";
  const statuses = cellRows.map((e) => byBatch.get(e.payoutBatchId)?.status || "open");
  if (statuses.every((s) => s === "paid")) return "paid";
  if (statuses.some((s) => s === "ready" || s === "paid")) return "owed";
  return "open";
}

/**
 * The period table: one row per period, one column per rep, a total column
 * and a total row.
 *
 * @param reps      [{ id, name }] — every column, even a rep with nothing yet.
 * @param entries   every commission entry: { salesRepId, amountCents, occurredAt, payoutBatchId }.
 * @param batches   every batch: { id, salesRepId, status, paidAt, periodStart }.
 * @param period    "week" | "month".
 * @param now       the clock — the current period is always the first row,
 *                  even when empty, so the screen says "nothing this week" in
 *                  a row rather than by omission.
 */
export function periodTable({ reps = [], entries = [], batches = [], period = "week", now = new Date() } = {}) {
  const p = isPeriod(period) ? period : "week";
  const columns = (Array.isArray(reps) ? reps : []).map((r) => ({ id: r.id, name: r.name || r.id }));
  const rows = Array.isArray(entries) ? entries : [];
  const byBatch = new Map((Array.isArray(batches) ? batches : []).map((b) => [b.id, b]));

  // Bucket every entry by (period, rep).
  const buckets = new Map(); // key -> Map(repId -> entries[])
  const put = (key, repId, e) => {
    if (!buckets.has(key)) buckets.set(key, new Map());
    const m = buckets.get(key);
    if (!m.has(repId)) m.set(repId, []);
    if (e) m.get(repId).push(e);
  };
  put(periodKey(p, now), null, null);
  for (const e of rows) {
    const at = new Date(e?.occurredAt);
    if (Number.isNaN(at.getTime()) || !e?.salesRepId) continue;
    put(periodKey(p, at), e.salesRepId, e);
  }

  const keys = [...buckets.keys()].sort().reverse(); // newest first
  const columnTotals = new Map(columns.map((c) => [c.id, 0]));

  const table = keys.map((key) => {
    const perRep = buckets.get(key);
    const cells = columns.map((c) => {
      const cellRows = perRep.get(c.id) || [];
      const cents = balanceCents(cellRows);
      columnTotals.set(c.id, columnTotals.get(c.id) + cents);
      const status = cellStatus(cellRows, byBatch);
      const batchIds = [...new Set(cellRows.map((e) => e.payoutBatchId).filter(Boolean))];
      const paidAts = batchIds
        .map((id) => byBatch.get(id)?.paidAt)
        .filter(Boolean)
        .map((d) => new Date(d).toISOString())
        .sort();
      return {
        repId: c.id,
        cents,
        status,
        // One batch → link to it; several (a month) → link to the rep.
        batchId: batchIds.length === 1 ? batchIds[0] : null,
        batchIds,
        // The latest paid date, when every batch in the cell is paid.
        paidAt: status === "paid" && paidAts.length ? paidAts[paidAts.length - 1] : null,
      };
    });
    return {
      key,
      label: periodLabel(p, key),
      cells,
      totalCents: cells.reduce((s, c) => s + c.cents, 0),
    };
  });

  return {
    period: p,
    columns,
    rows: table,
    totals: {
      byRep: columns.map((c) => ({ repId: c.id, cents: columnTotals.get(c.id) })),
      cents: [...columnTotals.values()].reduce((s, v) => s + v, 0),
    },
  };
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * The table as CSV — the same cells, the same order, one header row, one
 * total row. Status rides beside each amount so the file says "owed" and
 * "paid" as the screen does. Read-only: this is an export of a ledger, and
 * nothing that reads it can move money.
 */
export function periodTableCsv(table) {
  const header = ["Period", ...table.columns.flatMap((c) => [c.name, `${c.name} status`]), "Total"];
  const lines = [header.map(csvCell).join(",")];
  for (const row of table.rows) {
    const cells = row.cells.flatMap((c) => [
      centsToMoney(c.cents),
      c.status ? (c.status === "paid" && c.paidAt ? `paid ${c.paidAt.slice(0, 10)}` : c.status) : "",
    ]);
    lines.push([row.label, ...cells, centsToMoney(row.totalCents)].map(csvCell).join(","));
  }
  lines.push(
    ["Total", ...table.totals.byRep.flatMap((t) => [centsToMoney(t.cents), ""]), centsToMoney(table.totals.cents)]
      .map(csvCell)
      .join(","),
  );
  return lines.join("\r\n") + "\r\n";
}
