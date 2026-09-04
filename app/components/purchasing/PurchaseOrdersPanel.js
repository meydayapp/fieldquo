// app/components/purchasing/PurchaseOrdersPanel.js
//
// Purchase orders: the list, raising one, and taking delivery of one.
//
// ── The delivery form takes what turned up, not the running total ──────────
//
// Each line's box is prefilled with what is still OUTSTANDING, and what gets
// posted is what arrived on this van. A form that asked for the running total
// would make the second person to record a delivery responsible for knowing
// what the first one said.
//
// ── The idempotency key is minted once, when the form opens ────────────────
//
// Not per submit. The whole point is that a retry — a phone on a yard's edge
// of signal, a double tap on a button — carries the SAME key the first attempt
// used, so the server's unique index recognises it and answers "already
// recorded" instead of booking the stock twice.
//
// ── No "mark as received" button ───────────────────────────────────────────
//
// Deliberately absent. The status is derived from the lines, so a button that
// set it directly would make the badge on this list disagree with the lines on
// the same screen. Send and Cancel are the two a person actually decides.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Truck } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import ListState from "@/app/components/ListState";
import { progressSummary, outstandingMilli } from "@/lib/purchasing/receiving";
import { formatMilli } from "@/lib/purchasing/quantity";

const inputClass =
  "w-full rounded border border-border bg-background px-3 py-2 text-base sm:text-sm";
const BLANK_LINE = { description: "", quantity: "", unit: "each", unitCost: "" };

const STATUS_TONE = {
  draft: "text-muted-foreground",
  sent: "text-sky-700 dark:text-sky-400",
  partial: "text-amber-700 dark:text-amber-400",
  received: "text-emerald-700 dark:text-emerald-400",
  cancelled: "text-muted-foreground line-through",
};

export default function PurchaseOrdersPanel() {
  const { t } = useTranslation();
  // The company's own currency, grouped by the reader's locale. This used to
  // be a private `$${Number(v).toFixed(2)}` — the seventh copy of the bug
  // lib/format/money.js documents, printing "$2100.00" beside a shared
  // formatter's "$2,100.00" on the same screen. Null is still null: an order
  // with no prices reads "unpriced", never "$0.00".
  const companyMoney = useCompanyMoney();
  const money = (v) => (v === null || v === undefined ? null : companyMoney(v));
  const [orders, setOrders] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ supplierId: "", expectedAt: "", lines: [{ ...BLANK_LINE }] });
  const [openId, setOpenId] = useState(null);
  const [panelError, setPanelError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ordersResult, suppliersResult] = await Promise.all([
      fetchList("/api/purchase-orders"),
      fetchList("/api/suppliers"),
    ]);
    if (!ordersResult.ok) {
      if (!ordersResult.aborted) setErrorKey(ordersResult.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setOrders(Array.isArray(ordersResult.data?.orders) ? ordersResult.data.orders : []);
    // A failed supplier load leaves the picker empty rather than faking a
    // list; the order can still be raised without one.
    if (suppliersResult.ok) {
      setSuppliers(Array.isArray(suppliersResult.data?.suppliers) ? suppliersResult.data.suppliers : []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    const lines = draft.lines.filter((l) => l.description.trim() && String(l.quantity).trim());
    if (!lines.length || busy) return;
    setBusy(true);
    setPanelError("");
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, lines }),
      });
      if (!res.ok) {
        await reportResponseError(res, setPanelError, t("app.purchasing.orders.saveFailed"));
        return;
      }
      setDraft({ supplierId: "", expectedAt: "", lines: [{ ...BLANK_LINE }] });
      setCreating(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(order, status) {
    setPanelError("");
    const res = await fetch(`/api/purchase-orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      await reportResponseError(res, setPanelError, t("app.purchasing.orders.saveFailed"));
      return;
    }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {t("app.purchasing.orders.heading")}
          </h2>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <Plus size={13} />
            {t("app.purchasing.orders.new")}
          </button>
        </div>

        {creating && (
          <form onSubmit={create} className="mt-3 space-y-2">
            <select
              value={draft.supplierId}
              onChange={(e) => setDraft((d) => ({ ...d, supplierId: e.target.value }))}
              className={inputClass}
            >
              <option value="">{t("app.purchasing.orders.noSupplier")}</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

            {draft.lines.map((line, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr]">
                <input
                  value={line.description}
                  onChange={(e) =>
                    setDraft((d) => {
                      const lines = [...d.lines];
                      lines[i] = { ...lines[i], description: e.target.value };
                      return { ...d, lines };
                    })
                  }
                  placeholder={t("app.purchasing.orders.linePlaceholder")}
                  className={inputClass}
                />
                <input
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(e) =>
                    setDraft((d) => {
                      const lines = [...d.lines];
                      lines[i] = { ...lines[i], quantity: e.target.value };
                      return { ...d, lines };
                    })
                  }
                  placeholder={t("app.purchasing.orders.qtyPlaceholder")}
                  className={inputClass}
                />
                <input
                  value={line.unit}
                  onChange={(e) =>
                    setDraft((d) => {
                      const lines = [...d.lines];
                      lines[i] = { ...lines[i], unit: e.target.value };
                      return { ...d, lines };
                    })
                  }
                  className={inputClass}
                />
                <input
                  inputMode="decimal"
                  value={line.unitCost}
                  onChange={(e) =>
                    setDraft((d) => {
                      const lines = [...d.lines];
                      lines[i] = { ...lines[i], unitCost: e.target.value };
                      return { ...d, lines };
                    })
                  }
                  placeholder={t("app.purchasing.orders.unitCostPlaceholder")}
                  className={inputClass}
                />
              </div>
            ))}

            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, lines: [...d.lines, { ...BLANK_LINE }] }))}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              + {t("app.purchasing.orders.addLine")}
            </button>

            <p className="text-xs text-muted-foreground">
              {t("app.purchasing.orders.totalNote")}
            </p>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded bg-foreground px-3 py-2 text-sm font-medium text-background disabled:opacity-50"
              >
                {t("app.purchasing.orders.raise")}
              </button>
              <button
                type="button"
                onClick={() => setCreating(false)}
                className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                {t("app.purchasing.cancel")}
              </button>
            </div>
          </form>
        )}

        {panelError && (
          <p className="mt-2 text-xs text-red-600 dark:text-red-400">{panelError}</p>
        )}

        <div className="mt-3">
          <ListState
            loading={loading}
            errorKey={errorKey}
            isEmpty={orders !== null && orders.length === 0}
            onRetry={load}
            empty={
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("app.purchasing.orders.empty")}
              </p>
            }
          >
            <ul className="divide-y divide-border">
              {(orders || []).map((order) => {
                const progress = progressSummary(order.lines);
                const open = openId === order.id;
                return (
                  <li key={order.id} className="py-2.5">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : order.id)}
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-foreground">
                          {order.number}
                          {order.supplierName ? ` · ${order.supplierName}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("app.purchasing.orders.progress", {
                            complete: String(progress.complete),
                            lines: String(progress.lines),
                          })}
                        </p>
                      </div>
                      <span className={`shrink-0 text-xs ${STATUS_TONE[order.status] || ""}`}>
                        {t(`app.purchasing.status.${order.status}`)}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {/* Null when any line is unpriced. Not "$0.00" — an
                            order whose cost nobody has entered did not cost
                            nothing. */}
                        {money(order.expectedTotal) ?? t("app.purchasing.orders.unpriced")}
                      </span>
                    </button>

                    {open && (
                      <OrderDetail
                        order={order}
                        onChanged={load}
                        onStatus={setStatus}
                        onError={setPanelError}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </ListState>
        </div>
      </div>
    </div>
  );
}

/** One order's lines, plus the delivery note form. */
function OrderDetail({ order, onChanged, onStatus, onError }) {
  const { t } = useTranslation();
  // Minted once per open, deliberately — see the file header.
  const [deliveryKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const [received, setReceived] = useState({});
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState([]);

  const canReceive = order.status === "sent" || order.status === "partial";

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const entries = Object.entries(received).filter(([, v]) => String(v).trim());
    if (!entries.length) return;
    setBusy(true);
    setOver([]);
    try {
      const res = await fetch(`/api/purchase-orders/${order.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: deliveryKey,
          received: Object.fromEntries(entries),
        }),
      });
      if (!res.ok) {
        await reportResponseError(res, onError, t("app.purchasing.orders.deliveryFailed"));
        return;
      }
      const data = await res.json();
      setOver(Array.isArray(data.overDelivered) ? data.overDelivered : []);
      setReceived({});
      await onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-border bg-background p-3">
      <ul className="space-y-1.5">
        {order.lines.map((line) => {
          const left = outstandingMilli(line);
          return (
            <li key={line.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="min-w-0 flex-1 text-foreground">{line.description}</span>
              <span className="tabular-nums text-muted-foreground">
                {t("app.purchasing.orders.lineProgress", {
                  received: formatMilli(Math.round((line.quantityReceived || 0) * 1000)),
                  ordered: formatMilli(Math.round((line.quantity || 0) * 1000)),
                  unit: line.unit || "",
                })}
              </span>
              {canReceive && left !== null && left > 0 && (
                <input
                  inputMode="decimal"
                  value={received[line.id] ?? ""}
                  onChange={(e) =>
                    setReceived((r) => ({ ...r, [line.id]: e.target.value }))
                  }
                  placeholder={formatMilli(left)}
                  aria-label={t("app.purchasing.orders.receivedFor", {
                    line: line.description,
                  })}
                  className="w-20 rounded border border-border bg-background px-2 py-1 text-base sm:text-sm"
                />
              )}
            </li>
          );
        })}
      </ul>

      {over.length > 0 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
          {t("app.purchasing.orders.overDelivered", {
            lines: over.map((o) => `${o.description} (+${o.byText})`).join(", "),
          })}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {order.status === "draft" && (
          <button
            type="button"
            onClick={() => onStatus(order, "sent")}
            className="rounded bg-foreground px-3 py-1.5 text-xs font-medium text-background"
          >
            {t("app.purchasing.orders.markSent")}
          </button>
        )}
        {canReceive && (
          <button
            type="button"
            onClick={submit}
            disabled={busy || !Object.values(received).some((v) => String(v).trim())}
            className="flex items-center gap-1 rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            <Truck size={13} />
            {t("app.purchasing.orders.recordDelivery")}
          </button>
        )}
        {order.status !== "cancelled" && order.status !== "received" && (
          <button
            type="button"
            onClick={() => onStatus(order, "cancelled")}
            className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("app.purchasing.orders.cancelOrder")}
          </button>
        )}
      </div>
    </div>
  );
}
