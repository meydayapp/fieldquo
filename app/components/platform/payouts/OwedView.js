"use client";

// app/components/platform/payouts/OwedView.js
//
// "How much do I need to pay them each week or period" — the owner's
// question. Two pieces, both drawn from one GET /api/platform/sales/payouts:
//
//   OwedStrip   three tiles: owed today (closed batches not yet paid), accruing
//               this week (the open week so far), paid this cycle.
//   PeriodTable rows = period (week or month), columns = rep, a total column
//               and a total row; each cell says open / owed / paid and links
//               to that rep's batch. A CSV of the same table sits beside it.
//
// Every figure is re-summed from the commission ledger — lib/sales/
// payoutLedger.js's header quotes lib/sales/payouts.js on why
// totalCentsAtClose is never the number paid from. Read-only: nothing here
// moves money; a batch is marked paid on its own card.
//
// OwedStrip sits on /platform/sales/payouts and at the top of
// /platform/sales/reps, so one file draws it.
import Link from "next/link";
import { Download } from "lucide-react";
import { centsToMoney } from "@/lib/sales/money";

function Tile({ label, cents, hint, strong = false, attr }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3" {...attr}>
      <p className={`tabular-nums ${strong ? "text-2xl font-semibold" : "text-xl"} text-foreground`}>
        {centsToMoney(cents)}
      </p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      {hint ? <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p> : null}
    </div>
  );
}

export function OwedStrip({ snapshot }) {
  if (!snapshot) return null;
  const cycle = snapshot.cycle?.period === "month" ? "this month" : "this week";
  return (
    <div className="grid gap-2 sm:grid-cols-3" data-owed-strip>
      <Tile
        label="Owed today"
        cents={snapshot.owedNowCents}
        strong
        hint={`${snapshot.readyBatchCount} closed ${snapshot.readyBatchCount === 1 ? "batch" : "batches"} not yet paid`}
        attr={{ "data-owed-now": snapshot.owedNowCents }}
      />
      <Tile
        label="Accruing this week"
        cents={snapshot.accruingCents}
        hint="Not closed into a batch yet — closes Monday (UTC)"
        attr={{ "data-accruing": snapshot.accruingCents }}
      />
      <Tile
        label={`Paid ${cycle}`}
        cents={snapshot.paidThisCycleCents}
        hint="Batches marked paid in the current period"
        attr={{ "data-paid-cycle": snapshot.paidThisCycleCents }}
      />
    </div>
  );
}

const STATUS_CHIP = {
  open: "bg-muted text-muted-foreground",
  owed: "bg-amber-500/15 text-amber-900 dark:text-amber-200",
  paid: "bg-green-500/15 text-green-900 dark:text-green-200",
};

function Cell({ cell, repHref }) {
  if (!cell.status) return <td className="px-2 py-1.5 text-right text-muted-foreground">—</td>;
  // The hash opens the rep on /platform/sales/reps; the query names the batch
  // so the Payments section can highlight it.
  const href = cell.batchId
    ? `/platform/sales/reps?batch=${encodeURIComponent(cell.batchId)}#rep-${encodeURIComponent(cell.repId)}`
    : repHref;
  const title =
    cell.status === "paid" && cell.paidAt
      ? `Paid ${new Date(cell.paidAt).toLocaleString()}`
      : cell.status === "owed"
        ? "Closed, not paid yet"
        : "Still accruing — not closed into a batch";
  return (
    <td className="px-2 py-1.5 text-right align-top" data-cell-status={cell.status} data-cell-cents={cell.cents}>
      <Link href={href} className="inline-flex flex-col items-end gap-0.5 hover:underline" title={title}>
        <span className="tabular-nums text-foreground">{centsToMoney(cell.cents)}</span>
        <span className={`rounded px-1 text-[10px] uppercase tracking-wide ${STATUS_CHIP[cell.status]}`}>
          {cell.status}
          {cell.status === "paid" && cell.paidAt ? ` ${new Date(cell.paidAt).toLocaleDateString()}` : ""}
        </span>
      </Link>
    </td>
  );
}

/**
 * @param table     periodTable() from the route
 * @param period    "week" | "month"
 * @param onPeriod  switch handler
 */
export function PeriodTable({ table, period, onPeriod }) {
  if (!table) return null;
  const csvHref = `/api/platform/sales/payouts/csv?period=${encodeURIComponent(period)}`;
  return (
    <section className="space-y-2" data-period-table data-period={period}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-border p-0.5" role="tablist" aria-label="Period">
          {["week", "month"].map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={period === p}
              onClick={() => onPeriod(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${
                period === p ? "bg-inverted text-inverted-foreground" : "text-foreground"
              }`}
              data-period-switch={p}
            >
              {p === "week" ? "By week" : "By month"}
            </button>
          ))}
        </div>
        <a
          href={csvHref}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground"
          data-csv-link
        >
          <Download size={12} /> CSV
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Weeks are Monday to Monday in UTC — the same weeks the payout run closes. Each cell links to the rep;
        a single closed week links to its batch.
      </p>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/60">
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted-foreground">Period</th>
              {table.columns.map((c) => (
                <th key={c.id} className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground whitespace-nowrap">
                  {c.name}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.key} className="border-t border-border" data-period-row={row.key}>
                <td className="px-2 py-1.5 text-foreground whitespace-nowrap">{row.label}</td>
                {row.cells.map((cell) => (
                  <Cell key={cell.repId} cell={cell} repHref={`/platform/sales/reps#rep-${encodeURIComponent(cell.repId)}`} />
                ))}
                <td className="px-2 py-1.5 text-right tabular-nums font-medium text-foreground" data-row-total={row.totalCents}>
                  {centsToMoney(row.totalCents)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-border bg-muted/40 font-medium">
              <td className="px-2 py-1.5 text-foreground">Total</td>
              {table.totals.byRep.map((t) => (
                <td key={t.repId} className="px-2 py-1.5 text-right tabular-nums text-foreground" data-col-total={t.cents}>
                  {centsToMoney(t.cents)}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right tabular-nums text-foreground" data-grand-total={table.totals.cents}>
                {centsToMoney(table.totals.cents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
