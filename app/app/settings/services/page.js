"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X, Sparkles, PackagePlus } from "lucide-react";
import { INTAKE_FIELD_LIBRARY } from "@/app/data/intakeFieldLibrary";
import { hasStandardAddOns } from "@/app/data/standardAddOns";
import { categoryKeysForIndustries } from "@/app/data/industryCategories";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

function emptyCustomForm() {
  return { label: "", fieldKeys: [] };
}

export default function ServiceSettingsPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  // The industries picked at signup drive which of the ~60 catalog categories
  // are shown by default — mirrors the signup services step so a plumber lands
  // on plumbing quote types instead of the whole trade catalog. Fetched from
  // business-info rather than folded into the service-categories response,
  // whose plain-array shape several other pages already depend on.
  const [industries, setIndustries] = useState([]);
  const [categorySearch, setCategorySearch] = useState("");
  const [showAllTrades, setShowAllTrades] = useState(false);

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState(emptyCustomForm());
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");

  const [seedingId, setSeedingId] = useState(null);
  const [seedMsg, setSeedMsg] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/service-categories");
        // Was fire-and-forget: a 404/500 body was fed straight into
        // setCategories, so an error object rendered as a corrupt page and a
        // non-array crashed the .map below. Surface the failure, keep the list
        // empty so the existing empty state shows.
        if (!res.ok) {
          await reportResponseError(res);
          return;
        }
        const data = await res.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (err) {
        await reportResponseError(err);
      }
    })();

    // Industries are read-only here (chosen at signup) — a failure just means
    // no preset, so we fall back to showing everything rather than surfacing an
    // error over what is a progressive enhancement.
    (async () => {
      try {
        const res = await fetch("/api/settings/business-info");
        if (!res.ok) return;
        const data = await res.json();
        setIndustries(Array.isArray(data?.industries) ? data.industries : []);
      } catch {
        // Ignore — the list simply shows all trades when we don't know the
        // company's industry.
      }
    })();
  }, []);

  const update = (id, patch) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/service-categories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: categories.map((c) => ({
            categoryId: c.id,
            enabled: c.enabled,
            pricingModel: c.pricingModel,
            defaultRate: c.defaultRate,
            unit: c.unit,
          })),
        }),
      });
      // Was fire-and-forget: a rejected save looked exactly like a successful
      // one, so a company could turn a service off, see "Saved", and have it
      // quietly revert. Surface the failure instead.
      if (!res.ok) await reportResponseError(res);
    } catch (err) {
      await reportResponseError(err);
    } finally {
      setSaving(false);
    }
  };

  async function handleSeedStandard(categoryId, label) {
    setSeedingId(categoryId);
    setSeedMsg(null);
    try {
      const res = await fetch("/api/settings/products/seed-standard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error || t("app.setServices.addItemsError"));
      setSeedMsg({
        id: categoryId,
        text:
          data.created > 0
            ? t("app.setServices.itemsAdded", { count: data.created, label })
            : t("app.setServices.alreadyHasItems", { label }),
      });
    } catch (err) {
      setSeedMsg({ id: categoryId, text: err.message, error: true });
    } finally {
      setSeedingId(null);
    }
  }

  function toggleField(key) {
    setCustomForm((prev) => ({
      ...prev,
      fieldKeys: prev.fieldKeys.includes(key)
        ? prev.fieldKeys.filter((k) => k !== key)
        : [...prev.fieldKeys, key],
    }));
  }

  async function handleCreateCustom(e) {
    e.preventDefault();
    if (!customForm.label.trim()) return;
    setCreatingCustom(true);
    try {
      const res = await fetch("/api/settings/service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: customForm.label.trim(),
          fieldKeys: customForm.fieldKeys,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setCategories((prev) => [...prev, created]);
        setCustomForm(emptyCustomForm());
        setFieldSearch("");
        setShowCustomModal(false);
      } else {
        // Was silent: a failed request did nothing visible at all.
        await reportResponseError(res);
      }
    } finally {
      setCreatingCustom(false);
    }
  }

  const filteredFields = useMemo(() => {
    const q = fieldSearch.trim().toLowerCase();
    if (!q) return INTAKE_FIELD_LIBRARY;
    return INTAKE_FIELD_LIBRARY.filter((f) =>
      f.label.toLowerCase().includes(q),
    );
  }, [fieldSearch]);

  // The union of catalog keys the company's trade(s) actually sell. Empty when
  // the industry is blank/unknown — same guard as signup, which then shows the
  // full catalog rather than an empty list.
  const presetKeys = useMemo(
    () => categoryKeysForIndustries(industries),
    [industries],
  );

  // What to render: search filters the label across everything; the trade
  // filter hides only OTHER trades' system categories. A company's own custom
  // categories (companyId set, isSystem false) always pass the trade filter —
  // they were created deliberately and belong to no preset.
  const visibleCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    return categories.filter((c) => {
      if (q && !c.label.toLowerCase().includes(q)) return false;
      if (!c.isSystem) return true;
      if (showAllTrades || presetKeys.length === 0) return true;
      return presetKeys.includes(c.key);
    });
  }, [categories, categorySearch, showAllTrades, presetKeys]);

  // Only offer the "other trades" escape hatch when a preset is actually
  // narrowing the list — with no preset, everything is already shown.
  const hasPreset = presetKeys.length > 0;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-xl font-semibold">{t("app.settings.services")}</h1>
        <button
          onClick={() => setShowCustomModal(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-foreground shrink-0"
        >
          <Plus size={14} /> {t("app.setServices.addCustomType")}
        </button>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        {t("app.setServices.subtitle")}
      </p>

      {categories.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-4">
          <input
            type="search"
            value={categorySearch}
            onChange={(e) => setCategorySearch(e.target.value)}
            placeholder={t("app.setServices.searchPlaceholder")}
            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
          />
          {hasPreset && (
            <button
              type="button"
              onClick={() => setShowAllTrades((v) => !v)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground shrink-0 text-left sm:text-right"
            >
              {showAllTrades
                ? t("app.setServices.showMyTrade")
                : t("app.setServices.showOtherTrades")}
            </button>
          )}
        </div>
      )}

      <div className="space-y-3">
        {categories.length === 0 && (
          <div className="border rounded-lg p-6 text-sm text-muted-foreground text-center">
            {t("app.setServices.emptyState")}
          </div>
        )}
        {categories.length > 0 && visibleCategories.length === 0 && (
          <div className="border rounded-lg p-6 text-sm text-muted-foreground text-center">
            {t("app.setServices.noMatch")}
          </div>
        )}
        {visibleCategories.map((c) => (
          <div
            key={c.id}
            className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4"
          >
            <div className="flex items-start gap-4 flex-1 min-w-0">
            <input
              type="checkbox"
              checked={c.enabled}
              onChange={(e) => update(c.id, { enabled: e.target.checked })}
              className="h-5 w-5 shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {c.label}
                {!c.isSystem && (
                  <span className="flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">
                    <Sparkles size={11} /> {t("app.setServices.customBadge")}
                  </span>
                )}
              </div>
              {!c.isSystem && Array.isArray(c.customFields) && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {c.customFields.length === 0
                    ? t("app.setServices.noFieldsFlatRate")
                    : c.customFields.map((f) => f.label).join(", ")}
                </div>
              )}
              {c.enabled && hasStandardAddOns(c.key) && (
                <button
                  type="button"
                  onClick={() => handleSeedStandard(c.id, c.label)}
                  disabled={seedingId === c.id}
                  className="mt-1 flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <PackagePlus size={12} />
                  {seedingId === c.id
                    ? t("app.setServices.adding")
                    : t("app.setServices.addStandardItems")}
                </button>
              )}
              {seedMsg?.id === c.id && (
                <div
                  className={`text-xs mt-1 ${seedMsg.error ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
                >
                  {seedMsg.text}
                </div>
              )}
            </div>
            </div>

            {c.enabled && (
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:shrink-0 pl-9 sm:pl-0">
                <select
                  value={c.pricingModel}
                  onChange={(e) =>
                    update(c.id, { pricingModel: e.target.value })
                  }
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="flat">{t("app.setServices.pricingFlat")}</option>
                  <option value="per_unit">
                    {t("app.setServices.pricingPerUnit")}
                  </option>
                  <option value="hourly">
                    {t("app.setServices.pricingHourly")}
                  </option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  placeholder={t("app.setServices.ratePlaceholder")}
                  value={c.defaultRate ?? ""}
                  onChange={(e) =>
                    update(c.id, {
                      defaultRate: e.target.value
                        ? Number(e.target.value)
                        : null,
                    })
                  }
                  className="border rounded px-2 py-1 text-sm w-24"
                />

                {c.pricingModel === "per_unit" && (
                  <input
                    type="text"
                    placeholder={t("app.setServices.unitPlaceholder")}
                    value={c.unit ?? ""}
                    onChange={(e) => update(c.id, { unit: e.target.value })}
                    className="border rounded px-2 py-1 text-sm w-28"
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-6 inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60"
      >
        {saving ? t("app.action.saving") : t("app.setServices.saveSettings")}
      </button>

      {showCustomModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCustomModal(false)}
        >
          <div
            className="bg-card rounded-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-foreground">
                {t("app.setServices.addCustomType")}
              </h2>
              <button onClick={() => setShowCustomModal(false)}>
                <X size={18} className="text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {t("app.setServices.modalIntro")}
            </p>

            <form onSubmit={handleCreateCustom} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1">
                  {t("app.field.name")}
                </label>
                <input
                  required
                  autoFocus
                  placeholder={t("app.setServices.namePlaceholder")}
                  value={customForm.label}
                  onChange={(e) =>
                    setCustomForm((prev) => ({
                      ...prev,
                      label: e.target.value,
                    }))
                  }
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-foreground">
                    {t("app.setServices.fieldsSelected", {
                      count: customForm.fieldKeys.length,
                    })}
                  </label>
                  <input
                    placeholder={t("app.setServices.searchFields")}
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="border border-border rounded-lg px-2 py-1 text-xs w-40"
                  />
                </div>
                <div className="border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
                  {filteredFields.map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={customForm.fieldKeys.includes(f.key)}
                        onChange={() => toggleField(f.key)}
                      />
                      <span className="flex-1">{f.label}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {f.type}
                      </span>
                    </label>
                  ))}
                  {filteredFields.length === 0 && (
                    <p className="px-3 py-4 text-sm text-muted-foreground text-center">
                      {t("app.setServices.noFieldsMatch", { query: fieldSearch })}
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("app.setServices.noFieldsHint")}
                </p>
              </div>

              <button
                type="submit"
                disabled={creatingCustom}
                className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {creatingCustom
                  ? t("app.setServices.creating")
                  : t("app.setServices.createType")}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
