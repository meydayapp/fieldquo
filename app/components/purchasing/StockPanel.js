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
  // ── Why the form opens on "Received" and not "Used on a job" ─────────────
  //
  // The owner, 2026-10-25, looking at this tab: "in purchasing stock i cannot
  // see where i can add". Adding was never missing — it is the first option
  // in the kind dropdown — but the dropdown opened on "Used on a job", so the
  // only operation on screen was the one that takes stock AWAY, and the way
  // to put stock in was hidden inside a control that looked like it did the
  // opposite.
  //
  // Receiving is also the only movement that can be FIRST for any material:
  // nothing can be used, returned, wasted or counted before some of it has
  // arrived. Their shelf read "Primer (2 coats) — 0 gal" when they wrote.
  //
  // It is a defaulted destructive action otherwise, which is the shape
  // AGENTS.md warns about from the other side: not a control that does
  // nothing, but one that quietly does the wrong thing to somebody in a hurry.
  const [draft, setDraft] = useState({ materialId: "", kind: "received", quantity: "", note: "" });
  const [saveError, setSaveError] = useState("");
  const [buy, setBuy] = useState({ name: "", quantity: "", unit: "", totalCost: "", supplier: "" });
  const [buyError, setBuyError] = useState("");
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

  async function buyStock(e) {
    e.preventDefault();
    if (busy || !buy.name.trim() || !String(buy.quantity).trim()) return;
    setBusy(true);
    setBuyError("");
    try {
      const res = await fetch("/api/stock/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buy),
      });
      if (!res.ok) {
        await reportResponseError(res, setBuyError, t("app.purchasing.stock.buyFailed"));
        return;
      }
      // The name and unit stay: somebody stocking up types one supplier and
      // several lines, and clearing the row they just used would make them
      // retype the shop every time. Quantity and cost clear, because those
      // are the two that must never be submitted twice by accident.
      setBuy((b) => ({ ...b, quantity: "", totalCost: "" }));
      await load();
    } finally {
      setBusy(false);
    }
  }

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

      {/* ── Bought for the shelf ────────────────────────────────────────────
          Unconditional, unlike the movement form below it, and that is the
          point. That one renders only when `levels.length > 0`, so a company
          whose shelf is empty — every company, on day one — was shown no way
          to put anything on it. Materials could only be born from a job's
          material list (lib/jobs/sourcingList.js held the only
          material.create in the repo), so stock bought AHEAD of a job had no
          door at all. The owner, 2026-10-25: "make somewhere i can enter
          stock i buy for future jobs and are stored as inventory." */}
      <form
        onSubmit={buyStock}
        className="space-y-2 rounded-xl border border-border bg-card p-4 sm:p-5"
      >
        <h2 className="text-sm font-semibold text-foreground">
          {t("app.purchasing.stock.buyHeading")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("app.purchasing.stock.buyHint")}
        </p>
        <input
          value={buy.name}
          onChange={(e) => setBuy((b) => ({ ...b, name: e.target.value }))}
          placeholder={t("app.purchasing.stock.buyName")}
          className={inputClass}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            inputMode="decimal"
            value={buy.quantity}
            onChange={(e) => setBuy((b) => ({ ...b, quantity: e.target.value }))}
            placeholder={t("app.purchasing.stock.buyQuantity")}
            className={inputClass}
          />
          <input
            value={buy.unit}
            onChange={(e) => setBuy((b) => ({ ...b, unit: e.target.value }))}
            placeholder={t("app.purchasing.stock.buyUnit")}
            className={inputClass}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            inputMode="decimal"
            value={buy.totalCost}
            onChange={(e) => setBuy((b) => ({ ...b, totalCost: e.target.value }))}
            placeholder={t("app.purchasing.stock.buyTotalCost")}
            className={inputClass}
          />
          <input
            value={buy.supplier}
            onChange={(e) => setBuy((b) => ({ ...b, supplier: e.target.value }))}
            placeholder={t("app.purchasing.stock.buySupplier")}
            className={inputClass}
          />
        </div>
        <button
          type="submit"
          disabled={busy || !buy.name.trim() || !String(buy.quantity).trim()}
          className="w-full rounded bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50 sm:w-auto"
        >
          {t("app.purchasing.stock.buySubmit")}
        </button>
        {buyError && <p className="text-xs text-red-600 dark:text-red-400">{buyError}</p>}
      </form>

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
