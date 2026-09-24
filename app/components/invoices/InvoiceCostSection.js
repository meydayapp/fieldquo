// app/components/invoices/InvoiceCostSection.js
//
// The Cost & margin panel, wired for an invoice.
//
// ── What is different from a quote, and what isn't ──────────────────────────
//
// Not the arithmetic. Crew, blended rate, unrated flagging, overhead, margin
// and the signal colours all come from the same functions the quote builder
// uses — see lib/costing/actualJobCost.js#invoiceCostSummary, which is
// estimateQuoteCost with no scope groups. What differs is where the hours come
// from: a quote predicts them, an invoice bills the ones that were worked.
//
// ── Internal, and structurally so ───────────────────────────────────────────
//
// Nothing here reaches the client. The figures live in their own table
// (InvoiceCosting) rather than on the Invoice row precisely because two live
// paths — the public portal endpoint and the PDF renderer — pass whole invoice
// rows onwards without naming fields. See the model's own comment.
//
// ── Loading state is not cosmetic here ──────────────────────────────────────
//
// The panel renders nothing until the bootstrap resolves. If it rendered
// blank-but-editable first, the very first save after a slow load would write
// an empty crew over whatever was stored — the invoice would still "save
// fine", and the hours would be gone.
//
// The load itself — and the three-way seed rule — moved to
// useInvoiceCosting.js so the document-shaped invoice builder runs the same
// fetch at the top of its screen; this card is the classic form's face of it.
"use client";

import { AlertCircle } from "lucide-react";
import CostMarginPanel from "@/app/components/quotes/builder/CostMarginPanel";
import { invoiceCostSummary } from "@/lib/costing/actualJobCost";
import { useInvoiceCosting, emptyCosting } from "./useInvoiceCosting";

export { emptyCosting };

// Same target the quote builder uses. Above it the badge is green, below it
// amber; a job is not scored against a different bar because it reached the
// invoice stage.
const MARGIN_TARGET = 30;

export default function InvoiceCostSection({
  invoiceId = null,
  subtotal = 0,
  currency,
  value,
  onChange,
}) {
  // The parent owns the value so it can post it with the invoice; the seed
  // arrives through the hook, once.
  const { boot, state } = useInvoiceCosting(invoiceId, onChange);

  if (state === "denied") return null;
  if (state === "loading")
    return <div className="h-40 animate-pulse rounded-xl bg-accent" />;
  if (state === "error")
    return (
      <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        Couldn&apos;t load the cost panel, so it isn&apos;t editable here.
        Saving this invoice will leave any costing already on it untouched.
      </div>
    );

  const v = value || emptyCosting();
  const estimate = invoiceCostSummary({
    crew: v.crew,
    materialCost: Number(v.materialCost) || 0,
    overheadPct: Number(v.overheadPct) || 0,
    overheadPerJob: boot?.overheadPerJob ?? null,
    price: subtotal,
    marginTargetPct: MARGIN_TARGET,
  });

  const patch = (p) => onChange?.({ ...v, ...p });

  const seed = boot?.seed;
  const usingSeed = Boolean(seed && !boot?.saved);

  return (
    <CostMarginPanel
      hoursAreActual
      priceLabel="Invoice total (pre-tax)"
      currency={currency ?? boot?.currency ?? null}
      estimate={estimate}
      workers={boot?.workers || []}
      crew={v.crew || []}
      onCrewChange={(crew) => patch({ crew })}
      overheadPct={v.overheadPct}
      onOverheadChange={(overheadPct) => patch({ overheadPct })}
      overheadSource={boot?.overheadSource || null}
      // Hidden in invoice mode — the crew rows are the hours — but the panel
      // still reads the value, so pass something coherent rather than leaving
      // a prop dangling.
      manualLabourHours=""
      onManualLabourHoursChange={() => {}}
      manualMaterialCost={v.materialCost}
      onManualMaterialCostChange={(materialCost) => patch({ materialCost })}
      subtotal={subtotal}
      marginTarget={MARGIN_TARGET}
      crewNotice={
        usingSeed ? (
          <>
            Filled in from {seed.approvedHours} approved{" "}
            {seed.approvedHours === 1 ? "hour" : "hours"}{" "}
            logged against this
            job. Change anything that&apos;s wrong — once you save, these hours
            are the invoice&apos;s and the timesheets stop overwriting them.
            {seed.pendingHours > 0 && (
              <span className="mt-1 block text-amber-700 dark:text-amber-300">
                {seed.pendingHours} more{" "}
                {seed.pendingHours === 1 ? "hour is" : "hours are"} still
                awaiting approval and{" "}
                {seed.pendingHours === 1 ? "was" : "were"} not included.
              </span>
            )}
          </>
        ) : null
      }
    />
  );
}
