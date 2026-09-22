// app/components/pricing/ComplexityPicker.js
//
// The compact "Complexity" control for a scope group: four chips for the
// level, and a "Why" that opens the trade's factor list.
//
// ── NOT MOUNTED, and why ───────────────────────────────────────────────────
//
// The scope-group UI (app/components/quotes/builder/ScopeGroupCard.js,
// UnitPricingFields.js, TradeTakeoff.js) belongs to another agent working on
// the quote builder at the same time this landed. Editing their files under
// them is how two agents truncate each other's work, so this component is
// finished, styled to the builder's own idiom and exported — and nothing
// renders it yet.
//
// To mount it, inside a scope group's card:
//
//     import ComplexityPicker from "@/app/components/pricing/ComplexityPicker";
//     import { complexityFor } from "@/lib/pricing/complexity";
//     …
//     {complexityFor(group.categoryKey) && (
//       <ComplexityPicker
//         trade={group.categoryKey}
//         // stairs / roofing keep it on the takeoff; cabinets have no takeoff
//         // and keep it on the group itself.
//         value={group.takeoff?.complexity ?? group.complexity}
//         book={getPriceBook(group.categoryKey, rateOverrides)}
//         onChange={(next) => updateGroup({ complexity: next })}
//       />
//     )}
//
// `onChange` hands back the whole `{ model, factors }` object. Everything
// downstream — the price, the labour hours, the reason lines on the PDF —
// already reads it; see lib/pricing/tradeScope.js and lib/quotes/
// builderPayload.js. Nothing else has to be wired.
//
// ── What staff see and what the client sees ────────────────────────────────
//
// Staff: the level, the score, and the multiplier that will be applied to the
// labour hours. The client: only the reason lines, printed under the line item
// on the quote and the PDF. That split is the owner's, and it is enforced by
// where each one is written, not by a permission check — the reasons go into
// `detail` and the level goes into `meta`, and no client-facing renderer reads
// `meta`.
"use client";

import { useMemo, useState } from "react";
import {
  COMPLEXITY_LEVEL_KEYS,
  COMPLEXITY_LEVEL_LABELS,
  COMPLEXITY_MODEL,
  complexityFor,
  newComplexity,
  resolveComplexity,
  say,
} from "@/lib/pricing/complexity";

// The four levels, hottest last. Amber then red matches the chips the cabinet
// trade already used, so an estimator moving between the two trades is not
// learning a second colour language.
const LEVEL_TONE = {
  standard: "border-emerald-500 bg-emerald-500 text-white",
  moderate: "border-amber-500 bg-amber-500 text-white",
  complex: "border-orange-600 bg-orange-600 text-white",
  specialty: "border-red-600 bg-red-600 text-white",
};

/**
 * @param trade     the category key — "stairs", "roofing_service", …
 * @param value     the stored `{ model, factors }`, or null/undefined
 * @param book      the merged price book, for this company's own multipliers
 *                  and forcing switches
 * @param onChange  (next) => void — called with the whole object
 * @param language  the ESTIMATOR's language for the labels on this screen.
 *                  NOT the document's: the reason lines that reach the client
 *                  are rendered from the quote's language elsewhere, and the
 *                  preview below says so in as many words.
 */
export default function ComplexityPicker({
  trade,
  value,
  book = null,
  onChange,
  language = "en",
}) {
  const [open, setOpen] = useState(false);
  const list = complexityFor(trade);

  const complexity =
    value && value.model === COMPLEXITY_MODEL ? value : newComplexity(trade);

  const resolved = useMemo(
    () => resolveComplexity({ trade, complexity, book, language }),
    [trade, complexity, book, language],
  );

  // A trade with no factor list renders nothing at all, rather than an empty
  // panel titled "Complexity" — the control has to be absent, not decorative.
  if (!list || !resolved) return null;

  const pick = (factorKey, optionValue) => {
    onChange?.({
      model: COMPLEXITY_MODEL,
      factors: { ...complexity.factors, [factorKey]: optionValue },
    });
  };

  const reasonCount = resolved.reasons.length;

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">
          {say(list.label, language)}
        </span>

        {/* The chips READ the level; they do not set it. A level is what the
            answers add up to, and a chip that overrode them would be a second
            source of truth for the same fact — the estimator would set High
            and tick nothing, which is exactly the disconnect this module was
            built to remove. Clicking one opens the questions that produce it. */}
        <div className="flex flex-wrap gap-1.5" role="group">
          {COMPLEXITY_LEVEL_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setOpen(true)}
              aria-pressed={resolved.level === key}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                resolved.level === key
                  ? LEVEL_TONE[key]
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {say(COMPLEXITY_LEVEL_LABELS[key], language)}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-medium text-foreground"
        >
          {open ? "▾" : "▸"} {WHY[language] || WHY.en}
          {reasonCount > 0 && (
            <span className="rounded-full bg-inverted px-1.5 text-[10px] text-inverted-foreground">
              {reasonCount}
            </span>
          )}
        </button>
      </div>

      {/* Staff-only arithmetic. Deliberately beside the chips and not on the
          client's copy: the homeowner is owed the reasons, not the coefficient. */}
      <p className="mt-1 text-xs text-muted-foreground">
        {resolved.priced
          ? (MULTIPLIER_NOTE[language] || MULTIPLIER_NOTE.en)(
              resolved.multiplier,
              resolved.score,
              resolved.maxScore,
            )
          : NO_PRICE_NOTE[language] || NO_PRICE_NOTE.en}
      </p>

      {open && (
        <div className="mt-2 space-y-3 rounded-lg border border-border p-3">
          {list.factors.map((factor) => {
            const chosen = complexity.factors?.[factor.key];
            return (
              <div key={factor.key}>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {say(factor.label, language)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {factor.options.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => pick(factor.key, option.value)}
                      aria-pressed={chosen === option.value}
                      className={`rounded-full border px-2.5 py-1 text-xs ${
                        chosen === option.value
                          ? "border-inverted bg-inverted text-inverted-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {say(option.label, language)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {reasonCount > 0 && (
            <div className="border-t border-border pt-2">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {CLIENT_SEES[language] || CLIENT_SEES.en}
              </p>
              <ul className="space-y-0.5 text-xs text-muted-foreground">
                {resolved.reasons.map((r) => (
                  <li key={r} className="flex gap-1.5">
                    <span aria-hidden="true">·</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Kept here rather than in app/i18n/appMessages.js for the same reason
// lib/i18n/gutterEstimateCopy.js keeps its own: a closed set of five short
// strings that only this control uses, beside the control that uses them. The
// four LEVEL names are not here at all — they come from the module, so the
// chips and the resolved level cannot end up calling the same thing two
// different words. The factor wording lives with the factors, where it can be
// read against the weights it justifies.
const WHY = { en: "Why", fr: "Pourquoi", es: "Por qué" };

const CLIENT_SEES = {
  en: "What the client will read on the quote",
  fr: "Ce que le client lira sur la soumission",
  es: "Lo que el cliente leerá en la cotización",
};

const MULTIPLIER_NOTE = {
  en: (m, s, max) => `Labour hours ×${m} · ${s} of ${max} complexity points`,
  fr: (m, s, max) => `Heures de main-d'œuvre ×${m} · ${s} points de complexité sur ${max}`,
  es: (m, s, max) => `Horas de mano de obra ×${m} · ${s} de ${max} puntos de complejidad`,
};

const NO_PRICE_NOTE = {
  en: "Specialty — no automatic price. The quote says an on-site assessment is needed.",
  fr: "Spécialisé — aucun prix automatique. La soumission indique qu'une évaluation sur place est requise.",
  es: "Especializado — sin precio automático. La cotización indica que se requiere una evaluación en sitio.",
};
