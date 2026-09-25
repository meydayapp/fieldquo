// app/components/invoices/useInvoiceCosting.js
//
// The one load behind an invoice's Cost & margin panel — GET
// /api/invoices/costing?invoiceId= — and the rule for what it seeds.
//
// ── Why a hook, and why the seed lives here ─────────────────────────────────
//
// InvoiceCostSection (the classic invoice form's card) carried this effect
// inline. The document-shaped invoice builder draws the same panel in a
// drawer that is not always mounted, and a panel that only loads when it is
// on screen would mean: open a new invoice from a job, never touch the
// drawer, press Save — and the crew the timesheets would have seeded is not
// on the invoice, because nothing ever asked for it. The load has to run
// once, at the top of the screen, whether or not the drawer opens. So it is
// here, and both screens call it.
//
// ── The seed's three cases, unchanged ───────────────────────────────────────
//
//   saved         the stored row wins, verbatim — the timesheets stop having
//                 an opinion once somebody has saved a cost panel
//   seed.crew     the job's approved hours, offered once (crewFromTimeEntries)
//   neither       an empty panel, overhead at the default
//
// and two answers that are not a seed: 403 (no jobCosting toggle → the
// panel is withheld entirely, and the save posts no `costing` key) and a
// failed load (the panel says so and refuses to edit — a blank panel over a
// real row would be the next save writing zeroes).
"use client";

import { useEffect, useRef, useState } from "react";

// Only consulted when the company hasn't told us their real cost per job.
export const DEFAULT_OVERHEAD_PCT = 10;

export const emptyCosting = () => ({
  crew: [],
  materialCost: "",
  overheadPct: DEFAULT_OVERHEAD_PCT,
  note: "",
});

/**
 * @param invoiceId  null on a create — the company-level half only
 * @param onSeed     called ONCE with the costing value to start from, or
 *                   null when the panel may not be shown or did not load
 * @returns { boot, state }  boot: the route's body; state: loading | ready |
 *          denied | error
 */
export function useInvoiceCosting(invoiceId, onSeed) {
  const [boot, setBoot] = useState(null);
  const [state, setState] = useState("loading");

  // A ref, so the fetch effect never re-runs because the parent re-rendered
  // with a new callback identity on every keystroke.
  const onSeedRef = useRef(onSeed);
  onSeedRef.current = onSeed;
  const seeded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const qs = invoiceId ? `?invoiceId=${encodeURIComponent(invoiceId)}` : "";
    (async () => {
      try {
        const res = await fetch(`/api/invoices/costing${qs}`);
        if (cancelled) return;
        if (res.status === 403) {
          setState("denied");
          onSeedRef.current?.(null);
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
          onSeedRef.current?.({
            crew: data.saved.crew || [],
            materialCost: data.saved.materialCost || "",
            overheadPct: data.saved.overheadPct ?? DEFAULT_OVERHEAD_PCT,
            note: data.saved.note || "",
          });
        } else if (data.seed?.crew?.length) {
          onSeedRef.current?.({ ...emptyCosting(), crew: data.seed.crew });
        } else {
          onSeedRef.current?.(emptyCosting());
        }
      } catch {
        if (cancelled) return;
        setState("error");
        onSeedRef.current?.(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  return { boot, state };
}
