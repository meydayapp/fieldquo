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
"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import CostMarginPanel from "@/app/components/quotes/builder/CostMarginPanel";
import { invoiceCostSummary } from "@/lib/costing/actualJobCost";

// Same target the quote builder uses. Above it the badge is green, below it
// amber; a job is not scored against a different bar because it reached the
// invoice stage.
const MARGIN_TARGET = 30;
// Only consulted when the company hasn't told us their real cost per job.
const DEFAULT_OVERHEAD_PCT = 10;

export const emptyCosting = () => ({
  crew: [],
  materialCost: "",
  overheadPct: DEFAULT_OVERHEAD_PCT,
  note: "",
});

export default function InvoiceCostSection({
  invoiceId = null,
  subtotal = 0,
  currency,
  value,
  onChange,
}) {
  const [boot, setBoot] = useState(null);
  const [state, setState] = useState("loading"); // loading | ready | denied | error

  // The parent owns the value so it can post it with the invoice, but the
  // seed arrives here. A ref keeps the fetch effect from re-running every time
  // the user types a digit.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const seeded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const qs = invoiceId ? `?invoiceId=${encodeURIComponent(invoiceId)}` : "";
    (async () => {
      try {
        const res = await fetch(`/api/invoices/costing${qs}`);
        if (cancelled) return;
        if (res.status === 403) {
          // No jobCosting permission. Render nothing at all rather than an
          // empty panel: a panel that shows $0 margin because the reader isn't
          // allowed to see the numbers is worse than no panel.
          setState("denied");
          onChangeRef.current?.(null);
          return;
        }
        if (!res.ok) throw new Error("load failed");
        const data = await res.json();
        if (cancelled) return;
        setBoot(data);
        setState("ready");

        if (seeded.current) return;
        seeded.current = true;

        if (data.saved) {
          // Saved wins. The server doesn't even look at the timesheets once a
          // costing row exists — an edited 6.5 must not become 8 again on the
          // next page load.
          onChangeRef.current?.({
            crew: data.saved.crew || [],
            materialCost: data.saved.materialCost || "",
            overheadPct: data.saved.overheadPct ?? DEFAULT_OVERHEAD_PCT,
            note: data.saved.note || "",
          });
        } else if (data.seed?.crew?.length) {
          onChangeRef.current?.({
            ...emptyCosting(),
            crew: data.seed.crew,
          });
        } else {
          onChangeRef.current?.(emptyCosting());
        }
      } catch {
        if (cancelled) return;
        // Say so, and refuse to edit. A silent failure here means the next
        // save posts an empty crew over a real one.
        setState("error");
        onChangeRef.current?.(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

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
            {seed.approvedHours === 1 ? "hour" : "hours"} logged against this
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
