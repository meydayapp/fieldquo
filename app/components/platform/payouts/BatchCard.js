"use client";

// app/components/platform/payouts/BatchCard.js
//
// One payout batch as the console shows it: the week, the re-summed amount,
// the status, and — once paid — where and when it was paid and the receipt.
// Below that, the Mark paid / Add proof form for a superadmin. Mounted by
// /platform/sales/payouts and by the Payments section of a rep's card on
// /platform/sales/reps, so "the same batch looks the same on both" is a
// property of one file.
//
// paidAt is rendered with toLocaleString(), i.e. in THIS admin's timezone —
// the moment the superadmin pressed Mark paid, shown where they are. The rep
// sees the same instant in their own timezone on /sales/pay.
import { useState } from "react";
import { CheckCircle2, Clock3, ExternalLink, Pencil } from "lucide-react";
import { centsToMoney } from "@/lib/sales/money";
import MarkPaidForm from "./MarkPaidForm";

function day(value) {
  return value ? new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—";
}

function when(value) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";
}

/** The proof as text: paid on, via, reference, receipt, note. */
export function ProofLines({ batch }) {
  return (
    <dl className="grid gap-x-4 gap-y-1 text-xs sm:grid-cols-[auto_1fr]" data-batch-proof>
      <dt className="text-muted-foreground">Paid on</dt>
      <dd className="text-foreground" data-paid-at>
        {when(batch.paidAt)}
      </dd>
      <dt className="text-muted-foreground">Paid via</dt>
      <dd className="text-foreground">{batch.paidVia || <span className="text-muted-foreground">not recorded</span>}</dd>
      <dt className="text-muted-foreground">Reference</dt>
      <dd className="text-foreground break-all">
        {batch.paymentReference || <span className="text-muted-foreground">not recorded</span>}
      </dd>
      <dt className="text-muted-foreground">Receipt</dt>
      <dd>
        {batch.proofUrl ? (
          <a
            href={batch.proofUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline text-foreground"
            data-receipt-link
          >
            {batch.proofFilename || "Open"} <ExternalLink size={11} />
          </a>
        ) : (
          <span className="text-muted-foreground">none attached</span>
        )}
      </dd>
      {batch.paymentNote ? (
        <>
          <dt className="text-muted-foreground">Note</dt>
          <dd className="text-foreground whitespace-pre-wrap">{batch.paymentNote}</dd>
        </>
      ) : null}
    </dl>
  );
}

/**
 * @param batch        a batchView() from lib/sales/payoutAdmin.js
 * @param canMarkPaid  the route's verdict on this admin
 * @param onChanged    called after a successful mark/proof save
 * @param showRep      draw the rep's name (the payouts screen lists every rep)
 */
export default function BatchCard({ batch, canMarkPaid, onChanged, showRep = false }) {
  const [editing, setEditing] = useState(false);
  const paid = batch.status === "paid";
  const ready = batch.status === "ready";

  return (
    <div
      className="rounded-lg border border-border p-3 space-y-2"
      data-payout-batch={batch.id}
      data-batch-status={batch.status}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground">
            {showRep && batch.repName ? <span>{batch.repName} · </span> : null}
            {day(batch.periodStart)} – {day(batch.periodEnd)}
          </div>
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            {paid ? (
              <>
                <CheckCircle2 size={12} className="text-green-700 dark:text-green-400" /> Paid {when(batch.paidAt)}
                {batch.paidVia ? ` via ${batch.paidVia}` : ""}
              </>
            ) : ready ? (
              <>
                <Clock3 size={12} /> Closed, not paid yet
              </>
            ) : (
              <>
                <Clock3 size={12} /> {batch.status}
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-base tabular-nums font-semibold text-foreground" data-batch-cents={batch.cents}>
            {centsToMoney(batch.cents)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {batch.entryCount} {batch.entryCount === 1 ? "entry" : "entries"}
          </div>
        </div>
      </div>

      {/* Said rather than reconciled: the figure moved after the close, and
          a reversal that landed after the close SHOULD change what is paid. */}
      {batch.movedSinceClose ? (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Was {centsToMoney(batch.closedCents)} when it closed. The ledger moved since — the figure above is
          what its rows sum to now, and is the one to pay.
        </p>
      ) : null}

      {paid ? <ProofLines batch={batch} /> : null}

      {paid && !batch.hasProof ? (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          Marked paid with no proof on file — add the receipt or the reference so the rep can see what was sent.
        </p>
      ) : null}

      {canMarkPaid && (ready || paid) ? (
        editing || ready ? (
          <div className="border-t border-border pt-2">
            <MarkPaidForm
              batch={batch}
              onDone={(answer) => {
                setEditing(false);
                onChanged?.(answer);
              }}
              onCancel={paid ? () => setEditing(false) : null}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs underline text-foreground"
            data-add-proof
          >
            <Pencil size={11} /> {batch.hasProof ? "Update proof" : "Add proof"}
          </button>
        )
      ) : null}
      {!canMarkPaid && ready ? (
        <p className="text-xs text-muted-foreground">Only a superadmin can mark this paid.</p>
      ) : null}
    </div>
  );
}
