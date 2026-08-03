// app/app/quotes/[id]/ImportedCostsPanel.js
//
// Importer (GC) side, on the GC's own quote detail. Lists the subcontractor
// quotes pulled INTO this quote as costs — the sub's price, the markup, the
// resulting client price — and lets the GC remove one. Removing a losing bid
// and importing the winner is how "the one they move forward with is the one
// that's added" actually works.
//
// Editable only while the quote is open; once decided, its costs are a record.
"use client";

import { useEffect, useState } from "react";
import { Layers, Trash2, Loader2, Clock, CheckCircle2, MinusCircle, Pencil } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import { useTranslation } from "@/app/hooks/useTranslation";

const STATUS = {
  pending: { key: "app.quoteImports.pending", Icon: Clock, cls: "text-amber-600 dark:text-amber-400" },
  confirmed: { key: "app.quoteImports.confirmed", Icon: CheckCircle2, cls: "text-green-600 dark:text-green-400" },
  cancelled: { key: "app.quoteImports.cancelled", Icon: MinusCircle, cls: "text-muted-foreground" },
};

const MARKUP_PRESETS = [0, 10, 20, 30];

export default function ImportedCostsPanel({ quoteId, currency, editable, onTotalChange }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState(null);
  const [removing, setRemoving] = useState("");
  const [error, setError] = useState("");

  // Inline markup editing. The received cost is fixed; only this moves.
  const [editingId, setEditingId] = useState("");
  const [mk, setMk] = useState(0);
  const [savingMk, setSavingMk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/quotes/${quoteId}/imports`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setRows(d?.asImporter || []);
      })
      .catch(() => {
        if (!cancelled) setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [quoteId]);

  if (!rows || rows.length === 0) return null;

  const money = (n) => formatMoney(n, currency);

  async function remove(importId) {
    if (removing) return;
    setRemoving(importId);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}/imports/${importId}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't remove that cost.");
      setRows((prev) => prev.filter((r) => r.id !== importId));
      if (typeof onTotalChange === "function" && data?.targetTotal != null)
        onTotalChange(data.targetTotal);
    } catch (e) {
      setError(e.message);
    } finally {
      setRemoving("");
    }
  }

  function startEdit(r) {
    setError("");
    setEditingId(r.id);
    setMk(Math.round(Number(r.markupPercent) || 0));
  }

  async function saveMarkup(r) {
    if (savingMk) return;
    setSavingMk(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}/imports/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markupPercent: Math.max(0, Number(mk) || 0) }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't update the markup.");
      setRows((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, markupPercent: data.markupPercent, clientPrice: data.clientPrice }
            : x,
        ),
      );
      if (typeof onTotalChange === "function" && data?.targetTotal != null)
        onTotalChange(data.targetTotal);
      setEditingId("");
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingMk(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-1">
        <Layers size={16} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">
          {t("app.importedCosts.title")}
        </h2>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        {t("app.importedCosts.subtitle")}
      </p>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      <ul className="space-y-2">
        {rows.map((r) => {
          const s = STATUS[r.status] || STATUS.pending;
          const { Icon } = s;
          const isEditing = editingId === r.id;
          const previewPrice =
            Math.round(Number(r.costAmount) * (1 + Math.max(0, Number(mk) || 0) / 100) * 100) / 100;
          return (
            <li
              key={r.id}
              className="rounded-lg border border-border px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {r.label || r.sourceCompanyName || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {money(r.costAmount)} + {Math.round(r.markupPercent)}% ={" "}
                    <span className="font-medium text-foreground">
                      {money(r.clientPrice)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium ${s.cls}`}>
                    <Icon size={13} />
                    {t(s.key)}
                  </span>
                  {editable && !isEditing && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(r)}
                        aria-label={t("app.importedCosts.editMarkup")}
                        className="p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        disabled={removing === r.id}
                        aria-label={t("app.importedCosts.remove")}
                        className="p-1.5 text-muted-foreground hover:text-red-600 disabled:opacity-50"
                      >
                        {removing === r.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                    {t("app.importedCosts.editMarkup")}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {MARKUP_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setMk(p)}
                        className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                          Number(mk) === p
                            ? "bg-inverted text-inverted-foreground border-transparent"
                            : "border-border text-foreground"
                        }`}
                      >
                        {p}%
                      </button>
                    ))}
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        value={mk}
                        onChange={(e) => setMk(e.target.value)}
                        className="w-16 rounded-lg border border-border bg-background px-2 py-1 text-xs"
                      />
                      <span className="text-xs text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-xs text-muted-foreground">
                      {money(r.costAmount)} →{" "}
                      <span className="font-semibold text-foreground">
                        {money(previewPrice)}
                      </span>
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setEditingId("")}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold border border-border text-foreground"
                      >
                        {t("app.action.cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveMarkup(r)}
                        disabled={savingMk}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-inverted text-inverted-foreground disabled:opacity-60 inline-flex items-center gap-1.5"
                      >
                        {savingMk && <Loader2 size={12} className="animate-spin" />}
                        {t("app.action.save")}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
