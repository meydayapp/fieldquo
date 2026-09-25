// app/components/quotes/builder/OftenAddedRow.js
//
// "Often added with this" — under each service while the quote is being
// built, the optional extras this company sells alongside it (lib/quotes/
// builderOffers.js decides what, and says why a create and an edit differ).
//
// A chip OFFERS the extra to the client — a row they tick on their copy —
// and is priced by the save route from the company's own rows; the amount
// shown here is the same arithmetic, for reading. Clicked again it is taken
// back. Nothing here writes until the quote is saved, which is what the
// hint under the chips says, so a click is never mistaken for a save.
"use client";

import { Plus, Check, X } from "lucide-react";

/**
 * @param row     { auto: [{ key, description, amount }], offers: [{ key, ref,
 *                description, amount, share, pending }] } — or undefined
 * @param room    how many more options the quote can offer
 * @param money   (n) => string
 * @param onOffer (ref) => void
 * @param onUndo  (key) => void
 * @param t       the screen's translator
 */
export default function OftenAddedRow({ row, room = 0, money, onOffer, onUndo, t }) {
  const auto = Array.isArray(row?.auto) ? row.auto : [];
  const offers = Array.isArray(row?.offers) ? row.offers : [];
  // Nothing to say is said by rendering nothing — not an empty heading.
  if (!auto.length && !offers.length) return null;

  const chip = "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs";

  return (
    <div className="rounded-lg border border-dashed border-border p-3 space-y-2" data-often-added>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("app.oftenAdded.title", "Often added with this")}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {auto.map((a) => (
          <span
            key={a.key}
            className={`${chip} border-border text-muted-foreground`}
            title={t("app.oftenAdded.auto", "Offered automatically from your catalogue when this quote is saved")}
            data-often-added-auto
          >
            <Check size={12} aria-hidden="true" />
            {a.description} · {money(a.amount)}
          </span>
        ))}
        {offers.map((o) =>
          o.pending ? (
            <span key={o.key} className={`${chip} border-inverted bg-inverted text-inverted-foreground`} data-often-added-pending>
              <Check size={12} aria-hidden="true" />
              {o.description} · {money(o.amount)}
              <button
                type="button"
                onClick={() => onUndo?.(o.key)}
                aria-label={t("app.oftenAdded.undo", "Don't offer {name}", { name: o.description })}
                className="ml-0.5 rounded-full p-0.5 hover:opacity-80"
              >
                <X size={11} />
              </button>
            </span>
          ) : (
            <button
              key={o.key}
              type="button"
              onClick={() => onOffer?.(o.ref)}
              disabled={room <= 0}
              className={`${chip} border-border text-foreground hover:bg-muted disabled:opacity-50`}
              aria-label={t("app.oftenAdded.offer", "Offer {name} as an option", { name: o.description })}
              data-often-added-offer
            >
              <Plus size={12} aria-hidden="true" />
              {o.description} · {money(o.amount)}
              {o.share != null && (
                <span className="text-muted-foreground">
                  · {t("app.oftenAdded.share", "on {pct}% of your quotes", { pct: o.share })}
                </span>
              )}
            </button>
          ),
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">
        {auto.length && !offers.length
          ? t("app.oftenAdded.autoHint", "Your catalogue's extras for this service are offered automatically when the quote is saved — the client can tick them.")
          : t(
              "app.oftenAdded.hint",
              "One click offers it as an option the client can tick. It's added when you save, priced from your catalogue or from what your accepted quotes charged.",
            )}
      </p>
      {room <= 0 && offers.some((o) => !o.pending) && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          {t("app.oftenAdded.full", "This quote already offers eight options — the most one quote carries.")}
        </p>
      )}
    </div>
  );
}
