"use client";

// app/components/platform/payouts/RepPaymentsPanel.js
//
// The "Payments" section inside a rep's expanded card on /platform/sales/reps:
// their payout batches newest first — week, amount (re-summed), status, and
// for paid ones where and when it was paid, the reference and the receipt —
// with Mark paid / Add proof right there for a superadmin. The owner: "I
// should be able to say where and when I paid them."
//
// Reads GET /api/platform/sales/reps/[id]/payouts, which is scoped to the rep
// in its query. Renders BatchCard, the same component the payouts screen
// uses, so the form and the proof lines are one file.
import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { centsToMoney } from "@/lib/sales/money";
import BatchCard from "./BatchCard";

/**
 * @param repId          the rep whose card is open
 * @param highlightBatch optional batch id from the period table's link
 * @param onChanged      called after a mark-paid so the page can refresh its
 *                       header totals
 */
export default function RepPaymentsPanel({ repId, highlightBatch = null, onChanged }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson(`/api/platform/sales/reps/${encodeURIComponent(repId)}/payouts`));
    } catch (err) {
      setError(err.message || "Couldn’t load this rep’s payments.");
    }
  }, [repId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="rounded-lg border border-border p-3 space-y-2" data-rep-payments={repId}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Payments</div>
        {data ? (
          <div className="text-xs text-muted-foreground">
            Accruing this week: <span className="tabular-nums text-foreground">{centsToMoney(data.accruingCents)}</span>
          </div>
        ) : null}
      </div>

      {error ? (
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      ) : !data ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </p>
      ) : data.batches.length === 0 ? (
        // Absence of a batch is absence of a closed week, not a missing
        // payment: the Monday cron creates no batch for a week with nothing
        // to pay.
        <p className="text-sm text-muted-foreground">No closed weeks yet. A week closes into a batch on Monday (UTC) when it has something to pay.</p>
      ) : (
        <div className="space-y-2">
          {data.batches.map((b) => (
            <div key={b.id} id={`batch-${b.id}`} className={highlightBatch === b.id ? "ring-2 ring-ring rounded-lg" : ""}>
              <BatchCard
                batch={b}
                canMarkPaid={data.canMarkPaid}
                onChanged={async (answer) => {
                  await load();
                  onChanged?.(answer);
                }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
