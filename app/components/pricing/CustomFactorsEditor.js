// app/components/pricing/CustomFactorsEditor.js
//
// "Your own complexity factors" — the estimator's label and adjustment, on
// any scope group of any trade (lib/pricing/customFactors.js has the model,
// the limits and the composition order; this is only the screen).
//
// ── Beside ComplexityPicker, not inside it ─────────────────────────────────
//
// The picker is a trade's own QUESTIONS and renders nothing for a trade that
// has none — correctly, because an empty question list is a control that
// does nothing. The owner's ask was the opposite case: the thing nobody
// wrote a question for, on every trade. So this renders on every group the
// estimator can edit, the picker still renders exactly where it did, and
// the two compose in the order the module documents — the picker's level is
// already inside the price this component takes a percentage of.
//
// ── What the client reads ──────────────────────────────────────────────────
//
// The label, exactly as typed, as its own line with what it adds. Not the
// percentage, not the hours: the homeowner is owed the reason and its price,
// the same split the built-in factors keep between `detail` and `meta`. The
// preview under the rows says which language it will print in, because the
// estimator's screen and the quote's language are allowed to differ and
// nothing translates the label (non-negotiable #6).
"use client";

import { useState } from "react";
import { Plus, X, BookmarkPlus, Check, Loader2 } from "lucide-react";
import {
  CUSTOM_FACTOR_LIMITS,
  MAX_CUSTOM_FACTORS,
  factorFromPreset,
  priceCustomFactors,
} from "@/lib/pricing/customFactors";

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `cf-${Math.random().toString(36).slice(2)}`;

const PROBLEM_KEYS = {
  label: "app.customFactors.problem.label",
  labelTooLong: "app.customFactors.problem.invalid",
  mode: "app.customFactors.problem.invalid",
  rate: "app.customFactors.problem.invalid",
  invalid: "app.customFactors.problem.invalid",
  value: "app.customFactors.problem.value",
  tooLarge: "app.customFactors.problem.tooLarge",
  noBase: "app.customFactors.problem.noBase",
};

/**
 * @param factors      the group's `customFactors` (may be absent)
 * @param base         the group's price before any custom factor
 *                     (groupBaseSubtotal) — what a percentage is OF
 * @param hourlyRate   the hourly SELL rate this service is sold at, or null
 *                     when it is not sold by the hour — then "Extra hours"
 *                     is not offered (hourlyRateForFactors)
 * @param money        (n) => string, in the company's currency
 * @param onChange     (nextFactors) => void
 * @param library      the company's saved factors, or null while loading
 * @param onSaveToLibrary  (factor) => Promise<row> — POST /api/complexity-factors
 * @param documentLanguageName  the quote's language, as a name, for the
 *                     "printed as typed in …" line
 * @param t            the screen's translator
 */
export default function CustomFactorsEditor({
  factors,
  base,
  hourlyRate = null,
  money,
  onChange,
  library = null,
  onSaveToLibrary = null,
  documentLanguageName = "",
  t,
}) {
  const list = Array.isArray(factors) ? factors : [];
  const priced = priceCustomFactors({ base, factors: list });
  const [saving, setSaving] = useState("");
  const [saved, setSaved] = useState({});
  const [saveError, setSaveError] = useState("");

  const full = list.length >= MAX_CUSTOM_FACTORS;

  const add = (factor) => {
    if (full) return;
    onChange?.([...list, factor]);
  };
  const addBlank = () => add({ id: newId(), label: "", mode: "percent", value: "" });
  const patch = (i, next) =>
    onChange?.(
      list.map((f, j) => {
        if (j !== i) return f;
        const merged = { ...f, ...next };
        // The rate an hours factor is sold at is captured when it becomes an
        // hours factor, from THIS service — and dropped when it stops being
        // one, so a percentage never carries a stale rate into its line.
        if (merged.mode === "hours") merged.rate = merged.rate > 0 ? merged.rate : hourlyRate;
        else delete merged.rate;
        return merged;
      }),
    );
  const remove = (i) => onChange?.(list.filter((_, j) => j !== i));

  async function saveToLibrary(factor) {
    if (!onSaveToLibrary) return;
    setSaveError("");
    setSaving(factor.id);
    try {
      await onSaveToLibrary(factor);
      setSaved((s) => ({ ...s, [factor.id]: true }));
    } catch (err) {
      setSaveError(t("app.customFactors.saveError", "Couldn't save to the library: {error}", { error: err?.message || "" }));
    } finally {
      setSaving("");
    }
  }

  const inLibrary = (factor) =>
    saved[factor.id] ||
    (Array.isArray(library) &&
      library.some(
        (p) =>
          p.mode === factor.mode &&
          String(p.label).trim().toLowerCase() === String(factor.label || "").trim().toLowerCase(),
      ));

  const presets = (Array.isArray(library) ? library : []).filter(
    (p) => !list.some((f) => f.presetId === p.id),
  );

  const box = "rounded border border-border bg-background px-2 py-1 text-sm text-foreground";

  return (
    <div className="rounded-lg border border-border p-3 space-y-2" data-custom-factors>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">
          {t("app.customFactors.title", "Your own complexity factors")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {presets.length > 0 && !full && (
            <select
              value=""
              onChange={(e) => {
                const p = presets.find((x) => x.id === e.target.value);
                const f = p ? factorFromPreset(p, { id: newId(), hourlyRate }) : null;
                if (f) add(f);
              }}
              className={`${box} text-xs`}
              aria-label={t("app.customFactors.fromLibrary", "From your library")}
              data-custom-factor-library
            >
              <option value="">{t("app.customFactors.libraryPick", "Add from your library…")}</option>
              {presets.map((p) => {
                const usable = p.mode !== "hours" || hourlyRate > 0;
                return (
                  <option key={p.id} value={p.id} disabled={!usable}>
                    {usable
                      ? `${p.label} · ${presetValueText(p, money, t)}`
                      : t("app.customFactors.libraryHoursNeedRate", "{label} — extra hours; this service isn't sold by the hour", { label: p.label })}
                  </option>
                );
              })}
            </select>
          )}
          <button
            type="button"
            onClick={addBlank}
            disabled={full}
            className="inline-flex items-center gap-1 text-xs font-medium text-foreground disabled:opacity-50"
            data-custom-factor-add
          >
            <Plus size={12} /> {t("app.customFactors.add", "Add a factor")}
          </button>
        </div>
      </div>

      {list.length === 0 && (
        <p className="text-xs text-muted-foreground">
          {t(
            "app.customFactors.intro",
            "For what the questions don't cover — tight access, a crated dog, a finish-by deadline. Each one prints on the quote as its own line, exactly as you type it.",
          )}
        </p>
      )}

      {priced.rows.map(({ factor, amount, problem }, i) => (
        <div key={factor.id || i} className="space-y-1" data-custom-factor-row>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={factor.label ?? ""}
              maxLength={CUSTOM_FACTOR_LIMITS.label}
              onChange={(e) => patch(i, { label: e.target.value })}
              placeholder={t("app.customFactors.labelPlaceholder", "e.g. Tight access — 3rd floor walk-up")}
              aria-label={t("app.customFactors.labelAria", "What it is")}
              className={`${box} min-w-0 flex-1 basis-48`}
            />
            <select
              value={factor.mode}
              onChange={(e) => patch(i, { mode: e.target.value })}
              className={box}
              aria-label={t("app.customFactors.modeAria", "How it adjusts the price")}
            >
              <option value="percent">{t("app.customFactors.mode.percent", "% of this service")}</option>
              <option value="fixed">{t("app.customFactors.mode.fixed", "Fixed amount")}</option>
              {/* Only where this service is sold by the hour — an hours
                  factor priced at a per-sq-ft rate would be a number that
                  means something else. A stored hours factor keeps its own
                  rate and stays selectable. */}
              {(hourlyRate > 0 || factor.mode === "hours") && (
                <option value="hours">{t("app.customFactors.mode.hours", "Extra hours")}</option>
              )}
            </select>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step={factor.mode === "fixed" ? "1" : "0.5"}
              value={factor.value ?? ""}
              onChange={(e) => patch(i, { value: e.target.value === "" ? "" : Number(e.target.value) })}
              aria-label={t("app.customFactors.valueAria", "Amount")}
              className={`${box} w-24 text-right tabular-nums`}
            />
            {factor.mode === "hours" && factor.rate > 0 && (
              <span className="text-xs text-muted-foreground">
                {t("app.customFactors.hoursAt", "at {rate}/h", { rate: money(factor.rate) })}
              </span>
            )}
            <span className="ml-auto text-sm font-medium tabular-nums text-foreground" data-custom-factor-amount>
              {problem ? "—" : `+ ${money(amount)}`}
            </span>
            {onSaveToLibrary && !problem && (
              inLibrary(factor) ? (
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Check size={12} /> {t("app.customFactors.savedToLibrary", "In your library")}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => saveToLibrary(factor)}
                  disabled={saving === factor.id}
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground disabled:opacity-60"
                >
                  {saving === factor.id ? <Loader2 size={12} className="animate-spin" /> : <BookmarkPlus size={12} />}
                  {t("app.customFactors.saveToLibrary", "Save to library")}
                </button>
              )
            )}
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={t("app.customFactors.remove", "Remove")}
              className="p-1 text-muted-foreground hover:text-red-600"
            >
              <X size={14} />
            </button>
          </div>
          {problem && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {t(PROBLEM_KEYS[problem] || PROBLEM_KEYS.invalid, {
                max: CUSTOM_FACTOR_LIMITS[factor.mode] ?? "",
              })}
            </p>
          )}
        </div>
      ))}

      {saveError && <p className="text-xs text-red-700 dark:text-red-400">{saveError}</p>}

      {list.length > 0 && (
        <div className="border-t border-border pt-2 space-y-0.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">
            {t("app.customFactors.total", "Custom factors add {amount}", { amount: money(priced.total) })}
          </p>
          <p>
            {t(
              "app.customFactors.order",
              "Applied after the built-in complexity: percentages of this service's price first, then fixed amounts and hours.",
            )}
          </p>
          <p>
            {t("app.customFactors.language", "Printed in {language}, exactly as typed — nothing is translated.", {
              language: documentLanguageName,
            })}
          </p>
          {full && <p>{t("app.customFactors.max", "Eight factors is the most one service carries.")}</p>}
        </div>
      )}
    </div>
  );
}

/** "15%", "$250", "1.5 h" — a library row's value, for the picker and Settings. */
export function presetValueText(p, money, t) {
  if (p?.value == null) return "";
  if (p.mode === "percent") return t("app.customFactors.valuePercent", "{value}%", { value: p.value });
  if (p.mode === "hours") return t("app.customFactors.valueHours", "{value} h", { value: p.value });
  return money(p.value);
}
