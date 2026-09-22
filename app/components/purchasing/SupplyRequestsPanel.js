// app/components/purchasing/SupplyRequestsPanel.js
//
// Supply requests: what the field has asked for, and where each ask stands.
//
// ── The three states are the three columns of the funnel ───────────────────
//
// Requested — somebody at a house said "we're short". Ordered — the office
// raised or named a purchase order. Restocked — it is in the van, and the
// `received` movement is on the stock ledger. Nothing here edits a level: the
// level stays the sum of movements (lib/purchasing/stock.js), and the one
// write this panel causes is the movement "Restocked" records, once.
//
// ── The reorder banner turns into requests ─────────────────────────────────
//
// The Stock tab already knows what is below its threshold. Here that same
// arithmetic (lib/supplies/state.js lowStockPrefills) becomes a row you can
// turn into a request, pre-filled with the SHORTFALL — never a material with
// no threshold (no statement), never one already asked for.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import ListState from "@/app/components/ListState";
import { formatShortDate, formatTimeOfDay } from "@/lib/format/localeDate";

const inputClass =
  "w-full rounded border border-border bg-background px-3 py-2 text-base sm:text-sm";

const STATUS_TONE = {
  requested: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  ordered: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300",
  restocked: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  cancelled: "bg-muted text-muted-foreground",
};

export default function SupplyRequestsPanel() {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  // Which request is choosing a PO before "Ordered": { id, purchaseOrderId }.
  const [ordering, setOrdering] = useState(null);
  // Which request is saying where it landed before "Restocked": { id, note }.
  const [restocking, setRestocking] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ materialId: "", itemName: "", quantity: "", unit: "", note: "" });
  const [materials, setMaterials] = useState([]);
  const [filter, setFilter] = useState("open");

  const load = useCallback(async () => {
    setLoading(true);
    const [reqs, pos, stock] = await Promise.all([
      fetchList("/api/supply-requests"),
      fetchList("/api/purchase-orders"),
      fetchList("/api/stock"),
    ]);
    if (!reqs.ok) {
      if (!reqs.aborted) setErrorKey(reqs.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(reqs.data);
    setOrders(pos.ok && Array.isArray(pos.data?.orders) ? pos.data.orders.filter((o) => o.status !== "cancelled") : []);
    setMaterials(stock.ok && Array.isArray(stock.data?.levels) ? stock.data.levels : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function move(req, status, extra = {}) {
    setBusyId(req.id);
    setError("");
    try {
      const res = await fetch(`/api/supply-requests/${req.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      if (!res.ok) {
        await reportResponseError(res, setError, t("app.purchasing.requests.saveFailed"));
        return;
      }
      setOrdering(null);
      setRestocking(null);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function create(body) {
    setBusyId("new");
    setError("");
    try {
      const res = await fetch("/api/supply-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        await reportResponseError(res, setError, t("app.purchasing.requests.saveFailed"));
        return false;
      }
      await load();
      return true;
    } finally {
      setBusyId(null);
    }
  }

  const requests = data?.requests || [];
  const shown = requests.filter((r) =>
    filter === "open" ? r.status === "requested" || r.status === "ordered" : filter === "all" ? true : r.status === filter,
  );
  const lowStock = data?.lowStock || [];

  return (
    <div className="space-y-4">
      {lowStock.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{t("app.purchasing.requests.lowHeading")}</p>
            <ul className="mt-1 space-y-1">
              {lowStock.map((l) => (
                <li key={l.materialId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {t("app.purchasing.requests.lowRow", {
                      name: l.itemName,
                      level: String(l.level),
                      threshold: String(l.threshold),
                    })}
                  </span>
                  <button
                    type="button"
                    disabled={busyId === "new"}
                    onClick={() =>
                      create({
                        materialId: l.materialId,
                        quantity: l.quantity,
                        unit: l.unit,
                        source: "low_stock",
                      })
                    }
                    className="min-h-[36px] rounded border border-amber-700/40 px-2 py-1 text-xs font-semibold underline disabled:opacity-50"
                  >
                    {t("app.purchasing.requests.lowTurnInto", { qty: String(l.quantity), unit: l.unit || "" })}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("app.purchasing.requests.heading")}
            {data && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {t("app.purchasing.requests.openCount", { n: String(data.open || 0) })}
              </span>
            )}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className={`${inputClass} w-auto`}>
              <option value="open">{t("app.purchasing.requests.filter.open")}</option>
              <option value="requested">{t("app.purchasing.requests.status.requested")}</option>
              <option value="ordered">{t("app.purchasing.requests.status.ordered")}</option>
              <option value="restocked">{t("app.purchasing.requests.status.restocked")}</option>
              <option value="cancelled">{t("app.purchasing.requests.status.cancelled")}</option>
              <option value="all">{t("app.purchasing.requests.filter.all")}</option>
            </select>
            <button
              type="button"
              onClick={() => setCreating((v) => !v)}
              className="inline-flex min-h-[40px] items-center gap-1 rounded border border-border px-3 py-2 text-sm font-medium text-foreground"
            >
              <Plus size={14} /> {t("app.purchasing.requests.new")}
            </button>
          </div>
        </div>

        {creating && (
          <form
            className="mt-3 space-y-2 rounded-lg border border-border p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await create({
                materialId: draft.materialId || null,
                itemName: draft.itemName,
                quantity: draft.quantity,
                unit: draft.unit,
                note: draft.note,
              });
              if (ok) {
                setDraft({ materialId: "", itemName: "", quantity: "", unit: "", note: "" });
                setCreating(false);
              }
            }}
          >
            <select
              value={draft.materialId}
              onChange={(e) => {
                const m = materials.find((x) => x.materialId === e.target.value);
                setDraft((d) => ({ ...d, materialId: e.target.value, unit: m?.unit || d.unit }));
              }}
              className={inputClass}
            >
              <option value="">{t("app.purchasing.requests.pickMaterial")}</option>
              {materials.map((m) => (
                <option key={m.materialId} value={m.materialId}>
                  {m.name}
                </option>
              ))}
            </select>
            {!draft.materialId && (
              <input
                value={draft.itemName}
                onChange={(e) => setDraft((d) => ({ ...d, itemName: e.target.value }))}
                placeholder={t("app.purchasing.requests.itemPlaceholder")}
                className={inputClass}
              />
            )}
            <div className="flex gap-2">
              <input
                inputMode="decimal"
                value={draft.quantity}
                onChange={(e) => setDraft((d) => ({ ...d, quantity: e.target.value }))}
                placeholder={t("app.purchasing.requests.qtyPlaceholder")}
                className={inputClass}
              />
              <input
                value={draft.unit}
                onChange={(e) => setDraft((d) => ({ ...d, unit: e.target.value }))}
                placeholder={t("app.purchasing.requests.unitPlaceholder")}
                className={inputClass}
              />
            </div>
            <input
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              placeholder={t("app.purchasing.requests.notePlaceholder")}
              className={inputClass}
            />
            <button
              type="submit"
              disabled={busyId === "new" || !String(draft.quantity).trim() || (!draft.materialId && !draft.itemName.trim())}
              className="w-full rounded bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50 sm:w-auto"
            >
              {t("app.purchasing.requests.send")}
            </button>
          </form>
        )}

        <ListState
          loading={loading}
          errorKey={errorKey}
          isEmpty={data !== null && shown.length === 0}
          onRetry={load}
          empty={
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t("app.purchasing.requests.empty")}
            </p>
          }
        >
          <ul className="mt-2 divide-y divide-border">
            {shown.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">
                      {r.itemName}
                      <span className="ml-2 tabular-nums text-muted-foreground">
                        {r.quantity} {r.unit || ""}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[
                        r.jobTitle || t("app.purchasing.requests.forStock"),
                        r.requestedByName,
                        r.source === "low_stock"
                          ? t("app.purchasing.requests.source.low_stock")
                          : r.source === "material_list"
                            ? t("app.purchasing.requests.source.material_list")
                            : null,
                        r.createdAt ? `${formatShortDate(r.createdAt, language)} ${formatTimeOfDay(r.createdAt, language)}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {r.neededBy && (
                      <p className="text-xs text-muted-foreground">
                        {t("app.purchasing.requests.neededBy", { date: formatShortDate(r.neededBy, language) })}
                      </p>
                    )}
                    {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                    {r.photoUrl && (
                      <a href={r.photoUrl} target="_blank" rel="noopener" className="mt-1 inline-block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.photoUrl} alt="" className="h-14 w-16 rounded border border-border object-cover" />
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_TONE[r.status] || ""}`}>
                      {t(`app.purchasing.requests.status.${r.status}`)}
                    </span>
                    {r.status === "ordered" && (r.purchaseOrderNumber || r.orderedAt) && (
                      <span className="text-[11px] text-muted-foreground">
                        {[r.purchaseOrderNumber, r.orderedAt ? formatShortDate(r.orderedAt, language) : null].filter(Boolean).join(" · ")}
                      </span>
                    )}
                    {r.status === "restocked" && (
                      <span className="text-[11px] text-muted-foreground">
                        {[r.restockedAt ? formatShortDate(r.restockedAt, language) : null, r.restockNote].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </div>
                </div>

                {/* The two moves, each asking its one question first. */}
                {r.status === "requested" && ordering?.id !== r.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setOrdering({ id: r.id, purchaseOrderId: "" })}
                      className="min-h-[36px] rounded border border-border px-2 py-1 text-xs font-medium text-foreground disabled:opacity-50"
                    >
                      {t("app.purchasing.requests.markOrdered")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => move(r, "cancelled")}
                      className="min-h-[36px] px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {t("app.purchasing.cancel")}
                    </button>
                  </div>
                )}
                {r.status === "requested" && ordering?.id === r.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <select
                      value={ordering.purchaseOrderId}
                      onChange={(e) => setOrdering({ id: r.id, purchaseOrderId: e.target.value })}
                      className={`${inputClass} w-auto`}
                    >
                      <option value="">{t("app.purchasing.requests.noPo")}</option>
                      {orders.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.number}
                          {o.supplierName ? ` · ${o.supplierName}` : ""}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => move(r, "ordered", { purchaseOrderId: ordering.purchaseOrderId || null })}
                      className="min-h-[36px] rounded bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-50"
                    >
                      {t("app.purchasing.requests.confirmOrdered")}
                    </button>
                    <button type="button" onClick={() => setOrdering(null)} className="min-h-[36px] px-2 text-xs text-muted-foreground">
                      {t("app.purchasing.cancel")}
                    </button>
                  </div>
                )}
                {r.status === "ordered" && restocking?.id !== r.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => setRestocking({ id: r.id, note: "" })}
                      className="min-h-[36px] rounded border border-border px-2 py-1 text-xs font-medium text-foreground disabled:opacity-50"
                    >
                      {t("app.purchasing.requests.markRestocked")}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => move(r, "cancelled")}
                      className="min-h-[36px] px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {t("app.purchasing.cancel")}
                    </button>
                  </div>
                )}
                {r.status === "ordered" && restocking?.id === r.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <input
                      autoFocus
                      value={restocking.note}
                      onChange={(e) => setRestocking({ id: r.id, note: e.target.value })}
                      placeholder={t("app.purchasing.requests.wherePlaceholder")}
                      className={`${inputClass} w-56`}
                    />
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => move(r, "restocked", { note: restocking.note })}
                      className="min-h-[36px] rounded bg-foreground px-3 py-1 text-xs font-medium text-background disabled:opacity-50"
                    >
                      {t("app.purchasing.requests.confirmRestocked")}
                    </button>
                    <button type="button" onClick={() => setRestocking(null)} className="min-h-[36px] px-2 text-xs text-muted-foreground">
                      {t("app.purchasing.cancel")}
                    </button>
                    <p className="w-full text-[11px] text-muted-foreground">
                      {r.materialId
                        ? t("app.purchasing.requests.restockWritesMovement")
                        : t("app.purchasing.requests.restockNoMovement")}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </ListState>
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
