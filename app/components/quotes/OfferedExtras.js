// app/components/quotes/OfferedExtras.js
//
// The offered-extras list on a quote, and the Save button that persists it.
// Lifted out of SuggestAddOns.js, still its only caller — see the comment
// on the component below for why it is a file of its own.
"use client";

import { Loader2, Trash2, Check } from "lucide-react";

/**
 * The offered-extras list and the Save button that persists it.
 *
 * Its own component for one reason: SuggestAddOns cannot be rendered
 * without a database — it opens in a loading state and fills itself from
 * two GETs — so nothing could execute the one claim that mattered here,
 * that the Save button is on screen when the list is EMPTY. It was not:
 * the bar lived inside the else branch of the row ternary, so deleting
 * the last extra unmounted the only control that could save the
 * deletion. scripts/check-offered-add-ons.mjs renders this with
 * `addOns: []` and pins the markup.
 *
 * Presentational and prop-complete on purpose — `t` and every setter come
 * from the parent, so this holds no state the parent could disagree with.
 */
export function OfferedExtras({
  addOns,
  readOnly,
  t,
  update,
  remove,
  save,
  saving,
  dirty,
  savedAt,
}) {
  return (
    <>
      {addOns.length === 0 ? (
        <p className="text-xs text-muted-foreground mt-2">
          {t("app.quoteReview.nothingOffered")}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {addOns.map((a, i) => {
            // An extra the takeoff owns. It is regenerated from the scope
            // group every time the quote is saved, so the fields are shown
            // and not offered: accepting an edit here and discarding it on
            // the next save is exactly the control-that-doesn't-work this
            // codebase gets swept for. Change the room, not this row.
            const fromTakeoff = a.source === "takeoff";
            const locked = readOnly || fromTakeoff;
            return (
            <div
              key={a.id || i}
              className="border border-border rounded-lg p-3 space-y-2"
            >
              <div className="flex gap-2">
                <input
                  value={a.description}
                  onChange={(e) => update(i, { description: e.target.value })}
                  disabled={locked}
                  placeholder={t("app.quoteReview.extraPlaceholder")}
                  className="flex-1 min-w-0 border border-border rounded-lg px-3 py-2 text-sm bg-card disabled:opacity-70"
                />
                <div className="relative w-28 shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    $
                  </span>
                  <input
                    value={a.amount}
                    onChange={(e) => update(i, { amount: e.target.value })}
                    disabled={locked}
                    inputMode="decimal"
                    placeholder="0.00"
                    className="w-full border border-border rounded-lg pl-6 pr-3 py-2 text-sm bg-card tabular-nums disabled:opacity-70"
                  />
                </div>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    className="shrink-0 text-muted-foreground hover:text-red-600 p-2"
                    aria-label={t("app.action.remove")}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <input
                value={a.detail || ""}
                onChange={(e) => update(i, { detail: e.target.value })}
                disabled={locked}
                placeholder={t("app.quoteReview.detailPlaceholder")}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card disabled:opacity-70"
              />

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={a.taxable !== false}
                  onChange={(e) => update(i, { taxable: e.target.checked })}
                  disabled={locked}
                />
                {t("app.quoteReview.taxable")}
              </label>

              {fromTakeoff && (
                <p className="text-xs text-muted-foreground">
                  {t("app.quoteReview.fromTakeoff")}
                </p>
              )}
              {/* Where a pre-filled row came from, so "why is this here"
                  has an answer on the row itself. Removable like any other. */}
              {a.source === "catalog" && (
                <p className="text-xs text-muted-foreground" data-add-on-source="catalog">
                  {t("app.quoteReview.fromCatalogue")}
                </p>
              )}
              {(a.source === "history" || a.source === "ai") && (
                <p className="text-xs text-muted-foreground" data-add-on-source="review">
                  {t("app.quoteReview.fromReview")}
                </p>
              )}

              {a.selected && (
                <p className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1">
                  <Check size={12} /> {t("app.quoteReview.clientAdded")}
                </p>
              )}
            </div>
            );
          })}
        </div>
      )}

      {/* ── Outside the list, not inside it ──────────────────────────────
          This bar used to live in the else branch above, so deleting the
          last row unmounted the only control that could persist the
          deletion: "if I delete all addons I cannot save it". An empty
          list is a decision the estimator is allowed to make and the PUT
          route has always accepted (it deletes and inserts nothing), so
          the button that makes it stick has to be on screen when the list
          is empty — which is the one state it was missing from. */}
      {!readOnly && (
        <div className="flex items-center gap-3 mt-3">
          <button
            type="button"
            onClick={() => save(addOns)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-full disabled:opacity-60"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            {t("app.quoteReview.saveExtras")}
          </button>
          {/* Saved separately from the quote, so there has to be some
              signal that pressing the quote's own Save didn't cover
              this. */}
          {dirty && (
            <span className="text-xs text-amber-600 dark:text-amber-400">
              {t("app.quoteReview.unsaved")}
            </span>
          )}
          {savedAt && !dirty && (
            <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
              <Check size={12} /> {t("app.action.saved")}
            </span>
          )}
        </div>
      )}
    </>
  );
}
