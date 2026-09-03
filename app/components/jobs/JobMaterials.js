// app/components/jobs/JobMaterials.js
//
// The sourcing list: what this job needs, and a tick when it has been bought.
//
// INTERNAL. Nothing here reaches the client — it is the yard's list, not the
// quote.
//
// ── The tick is the point, the receipt is optional ──────────────────────────
//
// Someone standing in a supply yard with one hand free ticks a box. Asking for
// a price and a supplier before the tick will register is how a list like this
// stops being used by the second job. So the checkbox commits on its own, and
// the cost and supplier are an expansion beside it for whoever does the
// paperwork afterwards.
//
// A price entered on the tick is not decoration: it writes into the company's
// own MaterialPriceEntry history, which is how the unit costs the price books
// ship UNSET get filled in with real numbers instead of guesses.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Camera, Check, Plus, RefreshCw, Trash2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import ReceiptScanner from "@/app/components/purchasing/ReceiptScanner";

const money = (v) => `$${(Number(v) || 0).toFixed(2)}`;
const inputClass =
  "w-full border border-border rounded px-2 py-1 text-sm bg-background";

export default function JobMaterials({ jobId }) {
  // The same question the route asks, asked of the same grid. Every write here
  // needs jobs:view_create_edit, and without this every viewer got a page full
  // of checkboxes that 403 on the first tap — a control that appears to work
  // and doesn't, which is the one rule this codebase is swept for.
  //
  // Reading the list is deliberately NOT gated beyond seeing the job: a crew
  // member who can open the job should be able to see what was meant to be
  // bought for it.
  const caller = usePermissions();
  const canEdit = hasLevel(caller, "jobs", "view_create_edit");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [draft, setDraft] = useState({ actualCost: "", supplier: "" });
  // Which line's receipt scanner is open. One at a time, and only inside the
  // expansion that already asks for a cost — the scan exists to fill in those
  // two boxes, so it belongs where they are rather than as a separate screen.
  const [scanning, setScanning] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newLine, setNewLine] = useState({ name: "", qty: 1, unit: "each" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}/materials`);
      if (!res.ok) {
        // A job with no materials is not an error; a 404 here means the job
        // itself is gone, and the panel says nothing rather than shouting.
        setData({ materials: [], progress: null });
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function send(method, body, query = "") {
    setError("");
    const res = await fetch(`/api/jobs/${jobId}/materials${query}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      // Was the failure mode this codebase gets swept for: a tick that looked
      // like it worked, reverted on reload.
      await reportResponseError(res).catch(() => {});
      setError("That didn't save. Try again.");
      return null;
    }
    const next = await res.json();
    setData(next);
    return next;
  }

  async function toggle(m) {
    setBusyId(m.id);
    try {
      if (m.purchasedAt) {
        await send("PATCH", { materialId: m.id, purchased: false });
        setExpanded(null);
      } else {
        await send("PATCH", {
          materialId: m.id,
          purchased: true,
          actualCost: draft.actualCost === "" ? null : Number(draft.actualCost),
          supplier: draft.supplier,
        });
        setDraft({ actualCost: "", supplier: "" });
        setExpanded(null);
        setScanning(null);
      }
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="h-4 w-40 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  const materials = data?.materials || [];
  const p = data?.progress;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-foreground">
          Materials to buy
          {p?.total > 0 && (
            <span
              className={`ml-2 text-xs font-normal ${p.complete ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
            >
              {p.bought} of {p.total} bought
            </span>
          )}
        </h2>
        {canEdit && (
          <button
            type="button"
            onClick={() => send("POST", { regenerate: true })}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw size={12} />
            Rebuild from the quote
          </button>
        )}
      </div>

      {materials.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {canEdit
            ? "Nothing here yet. Rebuild from the quote derives the list from the takeoff \u2014 squares into bundles, area and base depth into cubic yards \u2014 for the trades that measure. Or add a line by hand."
            : "Nothing here yet. Whoever priced this job can build the list from the quote."}
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {materials.map((m) => {
            const bought = Boolean(m.purchasedAt);
            const open = expanded === m.id;
            return (
              <li key={m.id} className="py-2">
                <div className="flex items-start gap-2.5">
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() =>
                        bought || open ? toggle(m) : setExpanded(m.id)
                      }
                      aria-label={
                        bought
                          ? `Mark ${m.name} as not bought`
                          : `Mark ${m.name} as bought`
                      }
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                        bought
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-border hover:border-foreground/40"
                      } disabled:opacity-50`}
                    >
                      {bought && <Check size={13} strokeWidth={3} />}
                    </button>
                  ) : (
                    <span
                      role="img"
                      aria-label={bought ? "Bought" : "Not bought yet"}
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                        bought
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-border"
                      }`}
                    >
                      {bought && <Check size={13} strokeWidth={3} />}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span
                        className={`text-sm ${bought ? "text-muted-foreground line-through" : "text-foreground"}`}
                      >
                        {m.name}
                        <span className="ml-2 text-xs text-muted-foreground no-underline">
                          {m.qty} {m.unit}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums">
                        {/* Costs stripped by the server for a member without
                            the jobCosting toggle. Deliberately NOT the "no
                            price set" branch below: that one is a prompt to go
                            and fill the price in, and telling a crew member to
                            price a line they are not allowed to see is the
                            absence-vs-restriction confusion in its most
                            actively misleading form. */}
                        {m.costHidden ? (
                          <span className="text-muted-foreground">—</span>
                        ) : bought && m.actualCost != null ? (
                          <span className="text-foreground">
                            {money(m.actualCost)}
                          </span>
                        ) : m.estUnitCost != null ? (
                          <span className="text-muted-foreground">
                            est {money(m.estUnitCost * m.qty)}
                          </span>
                        ) : (
                          // Not "$0.00". Nobody has priced this, and a zero
                          // would read as free.
                          <span className="text-amber-700 dark:text-amber-400">
                            no price set
                          </span>
                        )}
                      </span>
                    </div>
                    {bought && m.supplier && (
                      <p className="text-xs text-muted-foreground">
                        {m.supplier}
                      </p>
                    )}

                    {/* The receipt, asked for AFTER the tick is offered rather
                        than before it. Skipping it still ticks the line. */}
                    {open && !bought && (
                      <>
                      <div className="mt-2 flex flex-wrap items-end gap-2">
                        {/* PATCH refuses a posted actualCost without the
                            jobCosting toggle (403, not a silent drop), so
                            rendering the box would be a field that throws away
                            what you typed. Ticking the line still works, which
                            is the part of this that is crew work. */}
                        {!m.costHidden && (
                        <label className="text-xs text-muted-foreground">
                          What it cost
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={draft.actualCost}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                actualCost: e.target.value,
                              }))
                            }
                            placeholder="total on the receipt"
                            className={`${inputClass} mt-0.5 w-36`}
                          />
                        </label>
                        )}
                        <label className="text-xs text-muted-foreground">
                          Supplier
                          <input
                            value={draft.supplier}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                supplier: e.target.value,
                              }))
                            }
                            className={`${inputClass} mt-0.5 w-40`}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => toggle(m)}
                          disabled={busyId === m.id}
                          className="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          Bought
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setExpanded(null);
                            setScanning(null);
                          }}
                          className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Offered only where a cost box is offered. The scan
                          returns money and nothing else, and the server
                          refuses it (403) for a member without the jobCosting
                          toggle — so rendering the button for them would be a
                          control that appears to work and doesn't. */}
                      {!m.costHidden && scanning !== m.id && (
                        <button
                          type="button"
                          onClick={() => setScanning(m.id)}
                          className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Camera size={13} /> Scan the receipt
                        </button>
                      )}

                      {!m.costHidden && scanning === m.id && (
                        <ReceiptScanner
                          materialId={m.id}
                          draft={draft}
                          onClose={() => setScanning(null)}
                          onApply={({ values }) => {
                            // PREFILL, never replace: `values` already carries
                            // whatever was typed for any field a person had
                            // filled in. See lib/receipts/prefill.js.
                            setDraft((d) => ({
                              actualCost:
                                values.actualCost == null
                                  ? d.actualCost
                                  : String(values.actualCost),
                              supplier: values.supplier ?? d.supplier,
                            }));
                            setScanning(null);
                          }}
                        />
                      )}
                      </>
                    )}
                  </div>

                  {canEdit && (
                    <button
                      type="button"
                      onClick={() =>
                        send(
                          "DELETE",
                          null,
                          `?materialId=${encodeURIComponent(m.id)}`,
                        )
                      }
                      aria-label={`Remove ${m.name}`}
                      className="mt-0.5 shrink-0 text-muted-foreground hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* `costHidden` means the server removed the two money totals. Rendering
          the block anyway would print "Estimated $0.00" — money(undefined) is
          $0.00 — which claims the job's materials cost nothing. A withheld
          figure and a zero are different statements, and the zero is the more
          dangerous of the two. */}
      {p?.total > 0 && !p.costHidden && (
        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          <div className="flex justify-between">
            <span>Estimated</span>
            <span className="tabular-nums">{money(p.estimatedTotal)}</span>
          </div>
          {p.actualTotal > 0 && (
            <div className="flex justify-between text-foreground">
              <span>Actually paid, so far</span>
              <span className="tabular-nums">{money(p.actualTotal)}</span>
            </div>
          )}
          {p.unpriced > 0 && (
            <p className="mt-1 text-amber-700 dark:text-amber-400">
              {p.unpriced} line{p.unpriced === 1 ? " has" : "s have"} no price,
              so the estimate above is an understatement. Enter what you pay as
              you tick them off and it builds your own price history.
            </p>
          )}
        </div>
      )}

      {adding && canEdit ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newLine.name.trim()) return;
            const ok = await send("POST", newLine);
            if (ok) {
              setNewLine({ name: "", qty: 1, unit: "each" });
              setAdding(false);
            }
          }}
        >
          <input
            autoFocus
            value={newLine.name}
            onChange={(e) =>
              setNewLine((n) => ({ ...n, name: e.target.value }))
            }
            placeholder="What else does this job need?"
            className={`${inputClass} flex-1 min-w-[12rem]`}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            value={newLine.qty}
            onChange={(e) => setNewLine((n) => ({ ...n, qty: e.target.value }))}
            className={`${inputClass} w-20`}
          />
          <input
            value={newLine.unit}
            onChange={(e) =>
              setNewLine((n) => ({ ...n, unit: e.target.value }))
            }
            className={`${inputClass} w-24`}
          />
          <button
            type="submit"
            className="rounded bg-foreground px-3 py-1 text-xs font-medium text-background"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Cancel
          </button>
        </form>
      ) : (
        canEdit && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-3 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus size={13} /> Add a line
          </button>
        )
      )}

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
