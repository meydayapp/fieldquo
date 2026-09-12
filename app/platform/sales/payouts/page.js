// app/platform/sales/payouts/page.js
//
// Paying the sales team: what is owed, by period and by rep, and the batches
// to pay — each marked paid WITH proof.
//
// ══ No money moves from this screen ═══════════════════════════════════════
//
// lib/sales/payouts.js's header, in its own words: "A batch closes to
// `ready`, is exported, and is marked `paid` by a person. Paying reps
// automatically is a separate decision with its own compliance surface —
// payroll, withholding, cross-border transfer to a rep in Kyiv". This screen
// is the person's desk. It shows what to pay, the transfer happens through
// Wise or Interac or Upwork outside the product, and the person comes back
// here to say where and when — with the receipt or the reference, because a
// "paid" the rep cannot check is not a record (lib/sales/payoutProof.js).
//
// ══ Every figure is re-summed ═════════════════════════════════════════════
//
// Nothing on this page reads totalCentsAtClose as the number to pay: "a
// reversal landing after the close SHOULD change what is paid". A batch that
// moved since it closed says so on its card.
//
// ══ Who ═══════════════════════════════════════════════════════════════════
//
// Superadmin and admin read it. Only a superadmin sees the Mark paid form,
// and the route and markBatchPaid refuse anyone else regardless.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import BatchCard from "@/app/components/platform/payouts/BatchCard";
import { OwedStrip, PeriodTable } from "@/app/components/platform/payouts/OwedView";

const CARD = "rounded-xl border border-border bg-card p-4";

export default function PlatformSalesPayoutsPage() {
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson(`/api/platform/sales/payouts?period=${encodeURIComponent(period)}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  const ready = (data?.batches || []).filter((b) => b.status === "ready");
  const paid = (data?.batches || []).filter((b) => b.status === "paid");
  const other = (data?.batches || []).filter((b) => b.status !== "ready" && b.status !== "paid");

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sales payouts</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          What FieldQuo owes its sales reps, by week or month, and the closed batches to pay. Read-only
          in the sense that matters: no money moves from this screen. You pay the batch yourself — Wise,
          Interac, Upwork — then mark it paid here with the receipt or the reference, and the rep sees
          that on their own Pay screen.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Every amount is re-summed from the commission ledger. The figure a batch closed at is shown only
          when it differs — a reversal landing after the close should change what is paid.{" "}
          <Link href="/platform/sales/reps" className="underline">
            Sales reps
          </Link>{" "}
          has the same batches inside each rep&apos;s card.
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      ) : null}
      {notice ? (
        <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-xl p-4 text-sm text-green-800 dark:text-green-300" data-payout-notice>
          {notice}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : data ? (
        <>
          <OwedStrip snapshot={data.snapshot} />

          <section className={`${CARD} space-y-3`}>
            <h2 className="text-base font-semibold text-foreground">Owed by period</h2>
            <PeriodTable table={data.table} period={period} onPeriod={setPeriod} />
          </section>

          <section className={`${CARD} space-y-3`} data-ready-batches>
            <div>
              <h2 className="text-base font-semibold text-foreground">To pay</h2>
              <p className="text-xs text-muted-foreground">
                Closed weeks not yet paid. {data.canMarkPaid ? "Attach what you sent and mark each one paid." : "Only a superadmin can mark a batch paid."}
              </p>
            </div>
            {ready.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting. A week closes into a batch on Monday (UTC) when it has something to pay.</p>
            ) : (
              <div className="space-y-2">
                {ready.map((b) => (
                  <BatchCard
                    key={b.id}
                    batch={b}
                    showRep
                    canMarkPaid={data.canMarkPaid}
                    onChanged={async (answer) => {
                      setNotice(
                        `Marked paid${answer?.notified ? " — the rep has been told" : ""}.`,
                      );
                      await load();
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          {other.length ? (
            <section className={`${CARD} space-y-3`}>
              <h2 className="text-base font-semibold text-foreground">Still open</h2>
              <p className="text-xs text-muted-foreground">Batches not yet closed. They cannot be paid until the Monday run closes them.</p>
              <div className="space-y-2">
                {other.map((b) => (
                  <BatchCard key={b.id} batch={b} showRep canMarkPaid={false} />
                ))}
              </div>
            </section>
          ) : null}

          <section className={`${CARD} space-y-3`} data-paid-batches>
            <div>
              <h2 className="text-base font-semibold text-foreground">Paid</h2>
              <p className="text-xs text-muted-foreground">
                Where and when each batch was paid. Proof can be added or updated later; nothing is ever removed.
              </p>
            </div>
            {paid.length === 0 ? (
              <p className="text-sm text-muted-foreground">No batch has been marked paid yet.</p>
            ) : (
              <div className="space-y-2">
                {paid.map((b) => (
                  <BatchCard
                    key={b.id}
                    batch={b}
                    showRep
                    canMarkPaid={data.canMarkPaid}
                    onChanged={async () => {
                      setNotice("Proof saved.");
                      await load();
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
