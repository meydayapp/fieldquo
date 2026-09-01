"use client";

// app/components/jobs/ChangeOrders.js
//
// Scope changes agreed after the client accepted the quote — "add this while
// you're here," a fixture swap, something discovered mid-job that changes the
// price. See prisma/schema.prisma's ChangeOrder model and
// docs/CALLBACKS-AND-CHANGE-ORDERS.md for why this is a deliberate log a
// person writes, never inferred from a quote or invoice edit: a quote is
// edited in place with no history, and an invoice version is created by ANY
// edit to a sent invoice, not just a scope change.
//
// No edit or delete here on purpose. A change order is a record of something
// that was already agreed with the client — correcting a mistake gets a new
// entry that says so, not a rewritten history, the same reasoning
// Quote.declineReason and every other append-only log in this codebase share.

import { useState } from "react";
import { Plus, FileEdit } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useHasLevel, useHasToggle } from "@/app/providers/PermissionProvider";
import { reportResponseError } from "@/lib/clientErrors";

// Matches JobMaterials.js's own choice for a job-internal figure — this panel
// never leaves /app, so a locale-aware currency lookup (which would mean a
// second fetch just for a symbol) isn't worth it here either.
const money = (v) => {
  const n = Number(v) || 0;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toFixed(2)}`;
};

export default function ChangeOrders({ jobId, changeOrders, onChanged }) {
  const { t } = useTranslation();
  // Two separate hook calls, combined afterward — `&&` between the calls
  // themselves would make the second one conditional, which breaks the rules
  // of hooks the moment the first is false.
  const hasJobsEdit = useHasLevel("jobs", "view_create_edit");
  const hasShowPricing = useHasToggle("showPricing");
  const canLog = hasJobsEdit && hasShowPricing;

  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [priceDelta, setPriceDelta] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const orders = Array.isArray(changeOrders) ? changeOrders : [];

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!description.trim()) {
      setError(t("app.changeOrder.descriptionRequired", "Describe what changed."));
      return;
    }
    const delta = Number(priceDelta);
    if (!Number.isFinite(delta)) {
      setError(t("app.changeOrder.priceRequired", "Enter the effect on price — 0 if none."));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/change-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), priceDelta: delta }),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.changeOrder.saveFailed", "Couldn't log that."));
        setError(message || t("app.changeOrder.saveFailed", "Couldn't log that."));
        return;
      }
      setDescription("");
      setPriceDelta("");
      setAdding(false);
      await onChanged?.();
    } catch {
      setError(t("app.changeOrder.saveFailed", "Couldn't log that."));
    } finally {
      setSaving(false);
    }
  }

  // Nothing recorded and nobody here can add one — an empty card with no
  // action on it is noise, the same rule JobCosting.js follows for a job with
  // no costs and no quote.
  if (orders.length === 0 && !canLog) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <FileEdit size={15} className="text-muted-foreground" />
          {t("app.changeOrder.title", "Change orders")}
        </h2>
        {canLog && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <Plus size={13} />
            {t("app.changeOrder.log", "Log a change order")}
          </button>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t(
            "app.changeOrder.none",
            "None logged. Use this once the client has agreed to a change in scope — never for an ordinary edit to the quote or invoice.",
          )}
        </p>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((co) => (
            <div key={co.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground">{co.description}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {co.createdBy?.name || t("app.changeOrder.unknownAuthor", "Someone")} ·{" "}
                  {new Date(co.createdAt).toLocaleDateString()}
                </p>
              </div>
              <span
                className={`shrink-0 tabular-nums text-sm font-semibold ${
                  Number(co.priceDelta) < 0
                    ? "text-red-600 dark:text-red-400"
                    : "text-foreground"
                }`}
              >
                {Number(co.priceDelta) > 0 ? "+" : ""}
                {money(co.priceDelta)}
              </span>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <form onSubmit={submit} className="mt-4 pt-4 border-t border-border space-y-3">
          {error && (
            <div className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.changeOrder.whatChanged", "What changed")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t("app.changeOrder.whatChangedPlaceholder", "Client asked to add a subpanel while the wall was open")}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.changeOrder.priceEffect", "Effect on price")}
            </label>
            <input
              type="number"
              step="0.01"
              value={priceDelta}
              onChange={(e) => setPriceDelta(e.target.value)}
              placeholder="0.00"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("app.changeOrder.priceEffectHint", "Positive adds to what the client owes; negative credits them.")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {saving ? t("app.changeOrder.saving", "Saving…") : t("app.changeOrder.save", "Save")}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setError("");
              }}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              {t("app.action.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
