"use client";

import { useEffect, useState } from "react";

export default function ServiceSettingsPage() {
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-xl font-semibold mb-1">Services & Pricing</h1>
      <p className="text-sm text-gray-500 mb-6">
        Turn on the services you offer and set your default rate for each. You
        can still override pricing on individual quotes.
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
              <div className="font-medium">{c.label}</div>
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
    </div>
  );
}
