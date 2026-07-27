// app/app/settings/material-costs/page.js
//
// Lets a company punch in its own real numbers for the internal Cost &
// Margin estimate (see lib/costing/estimateJobCost.js) instead of the
// TrueFinish-derived defaults in app/data/materialRecipes.js: primer/top-coat
// coverage rates, per-gallon costs, how many coats they actually do, and
// consumable/labour numbers. Saved per company via
// /api/settings/material-recipes → MaterialRecipeSetting.
//
// The coat-count fields aren't just labels — they drive quantity directly.
// Gallons needed = (area × coats) / coverage, so bumping primer coats from 2
// to 3 already costs 50% more material with no extra math required; this
// page just lets the company set what "default" and "extra-prep" coat counts
// actually are for their shop.
"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save, Droplet } from "lucide-react";
import {
  RECIPE_EDITABLE_FIELDS,
  CONSUMABLE_EDITABLE_FIELDS,
} from "@/app/data/materialRecipes";

const CATEGORY_META = {
  cabinet_refinishing: {
    label: "Cabinet Refinishing",
    model: "cabinet_unit",
    note: "Doors/drawers × coats ÷ coverage = gallons. Changing coat counts below scales material cost automatically.",
  },
  exterior_painting: {
    model: "production_rate",
    label: "Exterior Painting",
    note: "Area ÷ production rate = labour hours; area × coats ÷ coverage = gallons.",
  },
};

// Field configs (which keys are editable, labels, number step) live in
// app/data/materialRecipes.js so the API route and this page can't drift
// apart. Only display names for the consumable groupings are local — those
// come from the recipe's own `consumables.<key>.label` at render time.
const CONSUMABLE_LABELS = {
  tape: "Painter's tape",
  maskingFilm: "Masking film",
  sandpaper: "Sandpaper / abrasives",
};

const PAINT_TIERS = [
  { key: "economy", label: "Economy" },
  { key: "standard", label: "Standard" },
  { key: "premium", label: "Premium" },
];

const inputClass =
  "w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-400";

function setPath(obj, path, value) {
  const next = { ...obj };
  let cursor = next;
  for (let i = 0; i < path.length - 1; i++) {
    cursor[path[i]] = { ...cursor[path[i]] };
    cursor = cursor[path[i]];
  }
  cursor[path[path.length - 1]] = value;
  return next;
}

export default function MaterialCostsPage() {
  const [recipes, setRecipes] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [savedFlash, setSavedFlash] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/settings/material-recipes")
      .then((r) => r.json())
      .then((data) => {
        setRecipes(data);
        setDrafts(JSON.parse(JSON.stringify(data)));
        setLoading(false);
      });
  }, []);

  function updateField(categoryKey, path, value) {
    setDrafts((prev) => ({
      ...prev,
      [categoryKey]: setPath(prev[categoryKey], path, value),
    }));
  }

  async function handleSave(categoryKey) {
    setSavingKey(categoryKey);
    const draft = drafts[categoryKey];
    // eslint-disable-next-line no-unused-vars
    const { _hasOverrides, model, label, ...overrides } = draft;
    const res = await fetch("/api/settings/material-recipes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryKey, overrides }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRecipes((prev) => ({ ...prev, [categoryKey]: updated }));
      setDrafts((prev) => ({ ...prev, [categoryKey]: JSON.parse(JSON.stringify(updated)) }));
      setSavedFlash(categoryKey);
      setTimeout(() => setSavedFlash(null), 2000);
    }
    setSavingKey(null);
  }

  async function handleReset(categoryKey) {
    setSavingKey(categoryKey);
    const res = await fetch(
      `/api/settings/material-recipes?categoryKey=${categoryKey}`,
      { method: "DELETE" },
    );
    if (res.ok) {
      const reset = await res.json();
      setRecipes((prev) => ({ ...prev, [categoryKey]: reset }));
      setDrafts((prev) => ({ ...prev, [categoryKey]: JSON.parse(JSON.stringify(reset)) }));
    }
    setSavingKey(null);
  }

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3" />
        <div className="h-64 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Material Costs</h1>
        <p className="text-sm text-gray-500 mt-1">
          These numbers drive the internal Cost &amp; Margin estimate on every
          quote — what you actually pay for materials and labour, separate
          from the price you charge the client. Leave anything you're not
          sure about at the default.
        </p>
      </div>

      {Object.entries(CATEGORY_META).map(([categoryKey, meta]) => {
        const draft = drafts[categoryKey];
        if (!draft) return null;
        const fields = RECIPE_EDITABLE_FIELDS[meta.model] || [];
        const hasOverrides = recipes?.[categoryKey]?._hasOverrides;

        return (
          <div
            key={categoryKey}
            className="bg-white border border-gray-200 rounded-xl p-6"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <Droplet size={16} className="text-gray-400" />
                <h2 className="font-semibold text-gray-900">{meta.label}</h2>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    hasOverrides
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {hasOverrides ? "Custom" : "Default"}
                </span>
              </div>
              {hasOverrides && (
                <button
                  onClick={() => handleReset(categoryKey)}
                  disabled={savingKey === categoryKey}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Reset to defaults
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-4">{meta.note}</p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-600 block mb-1">
                    {f.label}
                  </label>
                  <input
                    type="number"
                    step={f.step}
                    className={inputClass}
                    value={draft[f.key] ?? ""}
                    onChange={(e) =>
                      updateField(categoryKey, [f.key], Number(e.target.value))
                    }
                  />
                </div>
              ))}
            </div>

            {meta.model === "cabinet_unit" && draft.consumables && (
              <div className="mt-5 pt-5 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Consumables
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.entries(CONSUMABLE_EDITABLE_FIELDS).map(([subKey, subFields]) => (
                    <div key={subKey}>
                      <div className="text-xs font-medium text-gray-600 mb-1.5">
                        {CONSUMABLE_LABELS[subKey] || subKey}
                      </div>
                      <div className="space-y-2">
                        {subFields.map((f) => (
                          <div key={f.key}>
                            <label className="text-[11px] text-gray-400 block mb-0.5">
                              {f.label}
                            </label>
                            <input
                              type="number"
                              step={f.step}
                              className={inputClass}
                              value={draft.consumables?.[subKey]?.[f.key] ?? ""}
                              onChange={(e) =>
                                updateField(
                                  categoryKey,
                                  ["consumables", subKey, f.key],
                                  Number(e.target.value),
                                )
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {meta.model === "production_rate" && draft.paintTiers && (
              <div className="mt-5 pt-5 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">
                  Wall paint cost by tier ($/gal)
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  {PAINT_TIERS.map((t) => (
                    <div key={t.key}>
                      <label className="text-xs font-medium text-gray-600 block mb-1">
                        {t.label}
                      </label>
                      <input
                        type="number"
                        step={0.01}
                        className={inputClass}
                        value={draft.paintTiers?.[t.key] ?? ""}
                        onChange={(e) =>
                          updateField(
                            categoryKey,
                            ["paintTiers", t.key],
                            Number(e.target.value),
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center gap-3">
              <button
                onClick={() => handleSave(categoryKey)}
                disabled={savingKey === categoryKey}
                className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-60"
              >
                <Save size={14} />
                {savingKey === categoryKey ? "Saving…" : "Save"}
              </button>
              {savedFlash === categoryKey && (
                <span className="text-xs text-emerald-600">Saved</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
