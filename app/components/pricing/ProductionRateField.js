// app/components/pricing/ProductionRateField.js
//
// The box a service's production rate is typed into — "250 sq ft per hour",
// "12 doors per day", "1.5 h per tread" — on the two screens that edit a
// Product: Settings › Services (the template editor, ServiceTemplatesCard)
// and Settings › Products & Services (the item form, ProductFormModal). One
// component for both, so the two cannot come to disagree about what a rate
// is; the value it hands back is lib/services/productionRates.js's
// sanitiseProduction shape, and the caller saves it through the PATCH/POST it
// already makes.
//
// ── Suggested, never applied ───────────────────────────────────────────────
//
// For the trades that have a takeoff, a suggested rate (SUGGESTED_PRODUCTION,
// with its sources) is shown greyed — as the box's placeholder and as a line
// saying "Suggested: …" — beside a "Use" button. Nothing is written until the
// person presses Use and then saves: a rate the company never chose would
// feed every job's hours and margin with a number nobody decided.
"use client";

import { useMemo } from "react";
import { Timer } from "lucide-react";
import { MEASUREMENT_KEYS } from "@/lib/services/measurementKeys";
import {
  PRODUCTION_BASES,
  CREW_DAY_HOURS,
  productionKeysFor,
  suggestedProduction,
  sanitiseProduction,
} from "@/lib/services/productionRates";

/** The editable copy of a stored rate — strings in the boxes, never NaN. */
export function productionDraftFrom(production, fallbackKey = "") {
  const p = sanitiseProduction(production);
  return p
    ? { key: p.key, amount: String(p.amount), basis: p.basis }
    : { key: fallbackKey || "", amount: "", basis: PRODUCTION_BASES[0] };
}

/** What a save sends: the sanitiser's view of the draft — null for none. */
export function productionFromDraft(draft) {
  if (!draft || draft.amount === "" || draft.amount == null) return null;
  return sanitiseProduction({ key: draft.key, amount: draft.amount, basis: draft.basis });
}

/** "250 per hour" / "12 per day" / "1.5 h each", in the reader's language. */
export function formatProductionRate(production, t) {
  const p = sanitiseProduction(production);
  if (!p) return "";
  const amount = String(p.amount);
  if (p.basis === "per_day") return t("app.production.rate_per_day", "{amount} per day", { amount });
  if (p.basis === "hours_per_unit") return t("app.production.rate_hours_per_unit", "{amount} h each", { amount });
  return t("app.production.rate_per_hour", "{amount} per hour", { amount });
}

/** The measurement a rate is stated in, by the registry's translated label. */
export function productionMeasureLabel(key, t) {
  return t(`app.serviceTemplates.measure_${key}`, MEASUREMENT_KEYS[key]?.label || key);
}

/**
 * @param draft       productionDraftFrom(...)
 * @param onChange    (nextDraft) => void
 * @param tradeKeys   the quote types (ServiceCategory keys) the service is
 *                    linked to — the first orders the key picker and picks
 *                    the suggestion
 * @param disabled    read-only (a member who may not change the price book)
 * @param t           the app translator
 */
export default function ProductionRateField({ draft, onChange, tradeKeys = [], disabled = false, t, compact = false }) {
  const trades = Array.isArray(tradeKeys) ? tradeKeys.filter(Boolean) : [];
  const keys = useMemo(() => productionKeysFor(trades[0] || null), [trades[0]]); // eslint-disable-line react-hooks/exhaustive-deps
  const suggestion = draft.key ? suggestedProduction(trades, draft.key) : null;
  const set = (patch) => onChange({ ...draft, ...patch });
  const input = "rounded border border-border bg-background px-2 py-1 text-sm text-foreground disabled:opacity-60";
  const amountSet = draft.amount !== "" && draft.amount != null;
  const invalid = amountSet && !productionFromDraft(draft);

  return (
    <div data-production-rate className={compact ? "space-y-1" : "space-y-1.5"}>
      <div className="flex items-center gap-1.5">
        <Timer size={12} className="text-muted-foreground" aria-hidden="true" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("app.production.title", "Production rate")}</h4>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          className={`${input} w-24 tabular-nums ${invalid ? "border-amber-500 dark:border-amber-600" : ""}`}
          type="number"
          min="0"
          step="any"
          value={draft.amount}
          disabled={disabled}
          // Greyed in the box only when the basis beside it matches — "12"
          // beside "per crew-hour" would suggest a number nobody meant. The
          // line under the box states the suggestion either way.
          placeholder={suggestion && suggestion.basis === draft.basis ? String(suggestion.amount) : ""}
          onChange={(e) => set({ amount: e.target.value })}
          aria-label={t("app.production.amount", "Rate")}
          data-production-amount
        />
        <select className={input} value={draft.basis} disabled={disabled} onChange={(e) => set({ basis: e.target.value })} aria-label={t("app.production.basis", "Stated as")} data-production-basis>
          {PRODUCTION_BASES.map((b) => (
            <option key={b} value={b}>
              {t(`app.production.basis_${b}`, b, { hours: CREW_DAY_HOURS })}
            </option>
          ))}
        </select>
        <select className={`${input} max-w-[12rem]`} value={draft.key} disabled={disabled} onChange={(e) => set({ key: e.target.value })} aria-label={t("app.production.measure", "Of")} data-production-key>
          <option value="">{t("app.production.pickMeasure", "Pick what it measures…")}</option>
          {keys.map((k) => (
            <option key={k} value={k}>{productionMeasureLabel(k, t)}</option>
          ))}
        </select>
        {amountSet && !disabled && (
          <button type="button" onClick={() => set({ amount: "" })} className="text-xs text-muted-foreground hover:text-foreground" data-production-clear>
            {t("app.production.clear", "Clear")}
          </button>
        )}
      </div>
      {suggestion && !amountSet && (
        <p className="text-[11px] text-muted-foreground/80 italic" data-production-suggestion>
          {t("app.production.suggested", "Suggested: {rate} — a common industry figure, not yours until you use it.", { rate: formatProductionRate(suggestion, t) })}{" "}
          {!disabled && (
            <button
              type="button"
              onClick={() => set({ amount: String(suggestion.amount), basis: suggestion.basis })}
              className="not-italic font-medium text-foreground underline underline-offset-2"
              data-production-use-suggestion
            >
              {t("app.production.useSuggestion", "Use")}
            </button>
          )}
        </p>
      )}
      {invalid && (
        <p className="text-[11px] text-amber-700 dark:text-amber-500">{t("app.production.invalid", "A rate needs a number above zero and what it measures.")}</p>
      )}
      <p className="text-[11px] text-muted-foreground">
        {t("app.production.hint", "Crew-hours on a quote = the measured quantity ÷ this rate, wherever this service is added with its template lines. Used for the Cost & margin hours, the labour cost and the job plan; blank = the trade's own hours.")}
      </p>
    </div>
  );
}
