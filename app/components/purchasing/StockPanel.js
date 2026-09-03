// app/components/purchasing/StockPanel.js
//
// What is on the shelf, and the form that moves it.
//
// ── Three states, not two ──────────────────────────────────────────────────
//
// A material is low, not low, or has no threshold set. The third is not a
// quieter version of the second: nobody has said when that material runs out,
// so nothing is claimed about it. Printing "in stock" there would be inventing
// a statement, which is AGENTS.md failure class #5, and the reorder alert would
// then be trusted for materials it has never been able to speak about.
//
// ── A correction is a movement ─────────────────────────────────────────────
//
// The form offers "Correction after a count" and that is the only kind that
// accepts a negative. Everything else has its sign forced by the server
// (lib/purchasing/stock.js's normaliseMovement), so the number typed here can
// never mean the opposite of what the label says.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import ListState from "@/app/components/ListState";
import { MOVEMENT_KIND_KEYS } from "@/lib/purchasing/stock";

const inputClass =
  "w-full rounded border border-border bg-background px-3 py-2 text-base sm:text-sm";

export default function StockPanel() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [draft, setDraft] = useState({ materialId: "", kind: "used", quantity: "", note: "" });
  const [saveError, setSaveError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/stock");
    if (!result.ok) {
      if (!result.aborted) setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const levels = data?.levels || null;
  const low = data?.low || [];

  async function record(e) {
    e.preventDefault();
    if (busy || !draft.materialId || !String(draft.quantity).trim()) return;
    setBusy(true);
    setSaveError("");
    try {
      const res = await fetch("/api/stock/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) {
        await reportResponseError(res, setSaveError, t("app.purchasing.stock.saveFailed"));
        return;
      }
      setDraft((d) => ({ ...d, quantity: "", note: "" }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {low.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">{t("app.purchasing.stock.lowHeading")}</p>
            <p className="mt-0.5">
              {low.map((l) => `${l.name} (${l.levelText} ${l.unit || ""})`.trim()).join(", ")}
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">
          {t("app.purchasing.stock.heading")}
        </h2>

        <ListState
          loading={loading}
          errorKey={errorKey}
          isEmpty={levels !== null && levels.length === 0}
          onRetry={load}
          empty={
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("app.purchasing.stock.empty")}
            </p>
          }
        >
          <ul className="mt-2 divide-y divide-border">
            {(levels || []).map((l) => (
              <li key={l.materialId} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{l.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.belowThreshold === null
                      ? t("app.purchasing.stock.noThreshold")
                      : t("app.purchasing.stock.threshold", { n: String(l.threshold) })}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-sm tabular-nums ${
                    l.belowThreshold === true
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-foreground"
                  }`}
                >
                  {/* A level that could not be summed prints a dash, never 0.
                      Zero is a claim that there are none left, and it is the
                      claim the reorder alert acts on. */}
                  {l.level === null ? "—" : `${l.levelText} ${l.unit || ""}`}
                </span>
              </li>
            ))}
          </ul>
        </ListState>

        {data?.withoutThreshold > 0 && (
          <p className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
            {t("app.purchasing.stock.withoutThreshold", {
              n: String(data.withoutThreshold),
            })}
          </p>
        )}
      </div>

      {levels && levels.length > 0 && (
        <form
          onSubmit={record}
          className="space-y-2 rounded-xl border border-border bg-card p-4 sm:p-5"
        >
          <h2 className="text-sm font-semibold text-foreground">
            {t("app.purchasing.stock.recordHeading")}
          </h2>
          <select
            value={draft.materialId}
            onChange={(e) => setDraft((d) => ({ ...d, materialId: e.target.value }))}
            className={inputClass}
          >
            <option value="">{t("app.purchasing.stock.pickMaterial")}</option>
            {levels.map((l) => (
              <option key={l.materialId} value={l.materialId}>
                {l.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <select
              value={draft.kind}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value }))}
              className={inputClass}
            >
              {MOVEMENT_KIND_KEYS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`app.purchasing.stock.kind.${kind}`)}
                </option>
              ))}
            </select>
            <input
              inputMode="decimal"
              value={draft.quantity}
              onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
              placeholder={t("app.purchasing.stock.quantityPlaceholder")}
              className={inputClass}
            />
          </div>
          {draft.kind === "adjustment" && (
            <p className="text-xs text-muted-foreground">
              {t("app.purchasing.stock.adjustmentHint")}
            </p>
          )}
          <input
            value={draft.note}
            onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            placeholder={t("app.purchasing.stock.notePlaceholder")}
            className={inputClass}
          />
          <button
            type="submit"
            disabled={busy || !draft.materialId || !String(draft.quantity).trim()}
            className="w-full rounded bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50 sm:w-auto"
          >
            {t("app.purchasing.stock.record")}
          </button>
          {saveError && (
            <p className="text-xs text-red-600 dark:text-red-400">{saveError}</p>
          )}
        </form>
      )}
    </div>
  );
}
