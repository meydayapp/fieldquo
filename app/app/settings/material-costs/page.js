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
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

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
  "w-full border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

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
  const { t } = useTranslation();
  const [recipes, setRecipes] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingKey, setSavingKey] = useState(null);
  const [savedFlash, setSavedFlash] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/settings/material-recipes");
        if (!res.ok) {
          // Was silent: a failed load hung on the skeleton forever and
          // swallowed the error. Don't feed a 4xx/5xx body into the setters.
          await reportResponseError(res);
          return;
        }
        const data = await res.json();
        setRecipes(data);
        setDrafts(JSON.parse(JSON.stringify(data)));
      } catch {
        showError(t("app.error.network", "Couldn't load material costs. Check your connection and retry."));
      } finally {
        setLoading(false);
      }
    })();
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
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
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
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setSavingKey(null);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-3xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-64 bg-accent rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.settings.materialCosts")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setMaterialCosts.subtitle")}
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
            className="bg-card border border-border rounded-xl p-6"
          >
            <div className="flex items-start justify-between mb-1">
              <div className="flex items-center gap-2">
                <Droplet size={16} className="text-muted-foreground" />
                <h2 className="font-semibold text-foreground">
                  {t(`app.setMaterialCosts.cat.${categoryKey}.label`, meta.label)}
                </h2>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    hasOverrides
                      ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {hasOverrides
                    ? t("app.setMaterialCosts.custom")
                    : t("app.setMaterialCosts.default")}
                </span>
              </div>
              {hasOverrides && (
                <button
                  onClick={() => handleReset(categoryKey)}
                  disabled={savingKey === categoryKey}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  <RotateCcw size={12} /> {t("app.setMaterialCosts.resetDefaults")}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {t(`app.setMaterialCosts.cat.${categoryKey}.note`, meta.note)}
            </p>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">
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
              <div className="mt-5 pt-5 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {t("app.setMaterialCosts.consumables")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {Object.entries(CONSUMABLE_EDITABLE_FIELDS).map(([subKey, subFields]) => (
                    <div key={subKey}>
                      <div className="text-xs font-medium text-muted-foreground mb-1.5">
                        {t(
                          `app.setMaterialCosts.consumable.${subKey}`,
                          CONSUMABLE_LABELS[subKey] || subKey,
                        )}
                      </div>
                      <div className="space-y-2">
                        {subFields.map((f) => (
                          <div key={f.key}>
                            <label className="text-[11px] text-muted-foreground block mb-0.5">
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
              <div className="mt-5 pt-5 border-t border-border">
                <h3 className="text-sm font-semibold text-foreground mb-3">
                  {t("app.setMaterialCosts.paintByTier")}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  {PAINT_TIERS.map((tier) => (
                    <div key={tier.key}>
                      <label className="text-xs font-medium text-muted-foreground block mb-1">
                        {tier.label}
                      </label>
                      <input
                        type="number"
                        step={0.01}
                        className={inputClass}
                        value={draft.paintTiers?.[tier.key] ?? ""}
                        onChange={(e) =>
                          updateField(
                            categoryKey,
                            ["paintTiers", tier.key],
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
                className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-60"
              >
                <Save size={14} />
                {savingKey === categoryKey
                  ? t("app.action.saving")
                  : t("app.action.save")}
              </button>
              {savedFlash === categoryKey && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400">
                  {t("app.action.saved")}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
