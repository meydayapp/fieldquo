// app/app/settings/products/ProductFormModal.js
//
// The Add / Edit Item form of Settings > Products & Services, as a popup of
// its own. Lifted out of ProductCatalogue.js unchanged on 2026-09-24 so the
// "Confirm what you quote" screen (app/app/settings/services/
// ConfirmServices.js) can offer "Add my own service" through THIS form and
// THIS POST — a second, smaller product form beside the first would be the
// copy that rots (AGENTS.md failure class 4). The payload, the routes and
// the refusal handling are byte-for-byte what the catalogue sent before.
//
// The caller owns whether it is open, the quote types it may link to (and
// their load error, which the form must show rather than read an empty list
// as "none exist"), and the billing currency for the benchmark range. It
// tells the caller about a save through `onSaved(answer)` — the route's JSON,
// which carries the auto-translate summary the catalogue's banner reads.
"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";
import BenchmarkRange from "@/app/components/pricing/BenchmarkRange";
import { benchmarkForSeedKey } from "@/lib/services/seeds";
import { useCommissionSettings } from "@/app/components/commissions/useCommissionSettings";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

function emptyForm() {
  return {
    name: "",
    description: "",
    type: "service",
    unitPrice: "",
    costPrice: "",
    unit: "",
    categoryIds: [],
    commissionable: true,
    workedByPct: "",
    soldByPct: "",
  };
}

function formFor(product) {
  if (!product) return emptyForm();
  return {
    name: product.name,
    description: product.description || "",
    type: product.type,
    unitPrice: product.unitPrice ?? "",
    costPrice: product.costPrice ?? "",
    unit: product.unit || "",
    categoryIds: Array.isArray(product.categories)
      ? product.categories.map((c) => c.id)
      : [],
    commissionable: product.commissionable !== false,
    workedByPct: product.workedByPct ?? "",
    soldByPct: product.soldByPct ?? "",
  };
}

/**
 * @param {object} props
 * @param {object|null} props.editing — the product being edited, or null to add
 * @param {object[]} props.quoteTypes — enabled quote types a product may link to
 * @param {string} [props.quoteTypesError] — why the quote types did not load
 * @param {string} [props.currency] — billing currency, for the benchmark range
 * @param {() => void} props.onClose
 * @param {(answer: object|null) => void|Promise<void>} props.onSaved
 */
export default function ProductFormModal({
  editing = null,
  quoteTypes = [],
  quoteTypesError = "",
  currency = "CAD",
  onClose,
  onSaved,
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => formFor(editing));
  const [saving, setSaving] = useState(false);
  // The commission override is offered only while the company pays
  // commission and to someone who may set pay (the route is owner/admin
  // either way). Off, the payload is exactly what it always was.
  const commissions = useCommissionSettings();
  const showCommission = Boolean(commissions?.enabled && commissions?.canEdit);

  function toggleCategory(id) {
    setForm((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(id)
        ? prev.categoryIds.filter((c) => c !== id)
        : [...prev.categoryIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || null,
        type: form.type,
        unitPrice: form.unitPrice ? Number(form.unitPrice) : null,
        costPrice: form.costPrice ? Number(form.costPrice) : null,
        unit: form.unit || null,
        categoryIds: form.categoryIds,
        ...(showCommission
          ? {
              commissionable: form.commissionable !== false,
              workedByPct: form.workedByPct === "" ? null : Number(form.workedByPct),
              soldByPct: form.soldByPct === "" ? null : Number(form.soldByPct),
            }
          : {}),
      };
      const res = await fetch(
        editing ? `/api/products/${editing.id}` : "/api/products",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (res.ok) {
        // What the save queued for the other languages; the caller's banner
        // reads it and asks for the truth a moment later.
        const answer = await res.json().catch(() => null);
        await onSaved?.(answer);
      } else {
        // Was silent: a failed request did nothing visible at all.
        await reportResponseError(res);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">
            {editing
              ? t("app.setProducts.editItem")
              : t("app.setProducts.addItem")}
          </h2>
          <button onClick={onClose}>
            <X size={18} className="text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            required
            placeholder={t("app.field.name")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
          <textarea
            placeholder={t("app.setProducts.description")}
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className={inputClass}
            >
              <option value="service">
                {t("app.setProducts.optService")}
              </option>
              <option value="product">
                {t("app.setProducts.optProduct")}
              </option>
            </select>
            <input
              placeholder={t("app.setProducts.unitPlaceholder")}
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("app.setProducts.unitPrice")}
              </label>
              <input
                type="number"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) =>
                  setForm({ ...form, unitPrice: e.target.value })
                }
                className={inputClass}
              />
              {/* The benchmark range for a seeded service, beside the
                  price it is a guideline for. Only a row created from a
                  trade seed has a seedKey; a product the company added
                  itself shows nothing here rather than a made-up band. */}
              {editing?.seedKey && (
                <BenchmarkRange
                  benchmark={benchmarkForSeedKey(editing.seedKey)}
                  currency={currency}
                  price={form.unitPrice ? Number(form.unitPrice) : null}
                  onUse={(v) => setForm((f) => ({ ...f, unitPrice: String(v) }))}
                />
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">
                {t("app.setProducts.costPrice")}
              </label>
              <input
                type="number"
                step="0.01"
                value={form.costPrice}
                onChange={(e) =>
                  setForm({ ...form, costPrice: e.target.value })
                }
                className={inputClass}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">
              {t("app.setProducts.availableOnTypes")}
            </label>
            {quoteTypesError ? (
              <p className="text-xs text-red-600 dark:text-red-400">
                {quoteTypesError}
              </p>
            ) : quoteTypes.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                {t("app.setProducts.noQuoteTypes")}
              </p>
            ) : (
              <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                {quoteTypes.map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={form.categoryIds.includes(c.id)}
                      onChange={() => toggleCategory(c.id)}
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {t("app.setProducts.leaveUnchecked")}
            </p>
          </div>

          {showCommission && (
            <fieldset className="border border-border rounded-lg p-3 space-y-2" data-product-commission>
              <legend className="text-xs font-semibold text-foreground px-1">
                {t("app.commissions.product.title")}
              </legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.commissionable !== false}
                  onChange={(e) => setForm({ ...form, commissionable: e.target.checked })}
                />
                {t("app.commissions.product.commissionable")}
              </label>
              {form.commissionable !== false && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {t("app.commissions.product.workedBy")}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={form.workedByPct}
                      placeholder={t("app.commissions.product.memberRate")}
                      onChange={(e) => setForm({ ...form, workedByPct: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      {t("app.commissions.product.soldBy")}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={form.soldByPct}
                      placeholder={t("app.commissions.product.memberRate")}
                      onChange={(e) => setForm({ ...form, soldByPct: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                {t("app.commissions.product.hint")}
              </p>
            </fieldset>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {saving
              ? t("app.action.saving")
              : editing
                ? t("app.setProducts.saveChanges")
                : t("app.setProducts.addItem")}
          </button>
        </form>
      </div>
    </div>
  );
}
