"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X, Sparkles, PackagePlus } from "lucide-react";
import { INTAKE_FIELD_LIBRARY } from "@/app/data/intakeFieldLibrary";
import { hasStandardAddOns } from "@/app/data/standardAddOns";
import { reportResponseError } from "@/lib/clientErrors";

function emptyCustomForm() {
  return { label: "", fieldKeys: [] };
}

export default function ServiceSettingsPage() {
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customForm, setCustomForm] = useState(emptyCustomForm());
  const [creatingCustom, setCreatingCustom] = useState(false);
  const [fieldSearch, setFieldSearch] = useState("");

  const [seedingId, setSeedingId] = useState(null);
  const [seedMsg, setSeedMsg] = useState(null);

  useEffect(() => {
    fetch("/api/settings/service-categories")
      .then((r) => r.json())
      .then(setCategories);
  }, []);

  const update = (id, patch) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const save = async () => {
    setSaving(true);
    await fetch("/api/settings/service-categories", {
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
    setSaving(false);
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
      if (!res.ok) throw new Error(data.error || "Could not add items");
      setSeedMsg({
        id: categoryId,
        text:
          data.created > 0
            ? `Added ${data.created} standard item${data.created === 1 ? "" : "s"} for ${label}. Edit them in Products & Services.`
            : `${label} already has its standard items.`,
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

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h1 className="text-xl font-semibold">Services & Pricing</h1>
        <button
          onClick={() => setShowCustomModal(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 shrink-0"
        >
          <Plus size={14} /> Add custom quote type
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Turn on the quote types you offer and set your default rate for each.
        These are what show up when you create a new quote. You can still
        override pricing on individual quotes.
      </p>

      <div className="space-y-3">
        {categories.map((c) => (
          <div
            key={c.id}
            className="border rounded-lg p-4 flex items-center gap-4"
          >
            <input
              type="checkbox"
              checked={c.enabled}
              onChange={(e) => update(c.id, { enabled: e.target.checked })}
              className="h-5 w-5"
            />
            <div className="flex-1">
              <div className="font-medium flex items-center gap-2">
                {c.label}
                {!c.isSystem && (
                  <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">
                    <Sparkles size={11} /> Custom
                  </span>
                )}
              </div>
              {!c.isSystem && Array.isArray(c.customFields) && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {c.customFields.length === 0
                    ? "No fields — flat rate only"
                    : c.customFields.map((f) => f.label).join(", ")}
                </div>
              )}
              {c.enabled && hasStandardAddOns(c.key) && (
                <button
                  type="button"
                  onClick={() => handleSeedStandard(c.id, c.label)}
                  disabled={seedingId === c.id}
                  className="mt-1 flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                >
                  <PackagePlus size={12} />
                  {seedingId === c.id
                    ? "Adding..."
                    : "Add standard items to Products & Services"}
                </button>
              )}
              {seedMsg?.id === c.id && (
                <div
                  className={`text-xs mt-1 ${seedMsg.error ? "text-red-600" : "text-green-600"}`}
                >
                  {seedMsg.text}
                </div>
              )}
            </div>

            {c.enabled && (
              <div className="flex items-center gap-2">
                <select
                  value={c.pricingModel}
                  onChange={(e) =>
                    update(c.id, { pricingModel: e.target.value })
                  }
                  className="border rounded px-2 py-1 text-sm"
                >
                  <option value="flat">Flat rate</option>
                  <option value="per_unit">Per unit</option>
                  <option value="hourly">Hourly</option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  placeholder="Rate"
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
                    placeholder="unit (sqft, door...)"
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
        className="mt-6 admin-btn-primary"
      >
        {saving ? "Saving..." : "Save Settings"}
      </button>

      {showCustomModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCustomModal(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Add custom quote type
              </h2>
              <button onClick={() => setShowCustomModal(false)}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Name it, then pick which fields it should ask for on a quote —
              chosen from fields already used across FieldQuo's other quote
              types, so it works the same way in the quote builder right
              away.
            </p>

            <form onSubmit={handleCreateCustom} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Name
                </label>
                <input
                  required
                  autoFocus
                  placeholder="e.g. Closet Organization"
                  value={customForm.label}
                  onChange={(e) =>
                    setCustomForm((prev) => ({
                      ...prev,
                      label: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">
                    Fields ({customForm.fieldKeys.length} selected)
                  </label>
                  <input
                    placeholder="Search fields..."
                    value={fieldSearch}
                    onChange={(e) => setFieldSearch(e.target.value)}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-40"
                  />
                </div>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                  {filteredFields.map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={customForm.fieldKeys.includes(f.key)}
                        onChange={() => toggleField(f.key)}
                      />
                      <span className="flex-1">{f.label}</span>
                      <span className="text-xs text-gray-400 capitalize">
                        {f.type}
                      </span>
                    </label>
                  ))}
                  {filteredFields.length === 0 && (
                    <p className="px-3 py-4 text-sm text-gray-400 text-center">
                      No fields match "{fieldSearch}"
                    </p>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  No fields selected is fine too — it'll behave like a flat
                  rate item with no extra form.
                </p>
              </div>

              <button
                type="submit"
                disabled={creatingCustom}
                className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
              >
                {creatingCustom ? "Creating..." : "Create quote type"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
