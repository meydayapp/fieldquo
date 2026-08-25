// app/components/quotes/builder/QuoteTotalsBar.js
//
// The terms of the quote — expiry, discount, tax — the running total, and the
// three ways out of this screen.
//
// ── Why the total moved into the sticky bar ─────────────────────────────────
//
// It used to sit in a card above the action bar, which meant scrolling away
// from it the moment a quote had more than one service — exactly when the
// number matters most. It's now beside the buttons, always visible, which is
// also where someone's thumb already is on a phone.
//
// ── "Save & send" says what it does ─────────────────────────────────────────
//
// It genuinely sends now (app/api/quotes/[id]/send), so the button can promise
// it. Until recently it set a status field and emailed nothing, which is why
// the label deserves care rather than being decoration.
//
// ── Why "Save & review" is in the card and not the sticky bar ───────────────
//
// It belongs beside the save actions and it is one row above them, at the
// bottom of this card, because a third button does not fit in the sticky bar
// at 375px without truncating a label — and the label is the whole point.
// "Review" alone would be a button that silently creates a database record;
// the full sentence under it ("saves a draft first, then checks it") is what
// makes it honest, and a sticky bar has nowhere to put a sentence.
"use client";

import { Loader2, Save, Send, Sparkles } from "lucide-react";
import DiscountField from "@/app/components/quotes/DiscountField";
import { formatAppMoney } from "@/lib/format/money";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function QuoteTotalsBar({
  subtotal,
  // Post-discount, pre-tax — what the tax is actually charged on, and the
  // figure the margin panel calls "quote price". Defaults to the subtotal so a
  // caller that doesn't pass it renders "no discount" rather than "everything
  // discounted".
  taxableBase = subtotal,
  discount,
  onDiscountChange,
  tax,
  taxRate,
  // Why THIS rate. Empty unless the company opted into per-client tax and a
  // client is selected. A tax figure that changes on its own with no
  // explanation is worse than one the user picked, however correct it is.
  taxNote = "",
  total,
  taxEnabled,
  onTaxToggle,
  validUntil,
  onValidUntilChange,
  // The company's billing currency. Hardcoded to CAD here until now, so a
  // company billing in USD watched the builder count in dollars the document
  // would not use.
  currency,
  saving,
  disabled,
  onSaveDraft,
  onSaveAndSend,
  onSaveAndReview,
}) {
  const { t } = useTranslation();
  const money = (n) => formatAppMoney(n, currency, "en");

  return (
    <>
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        {/* Expiry first: it is the one term on a quote whose whole job is to
            put a deadline in front of the client, and it opens pre-filled at
            30 days — see lib/quotes/validUntil.js for why a default is a
            suggestion here and not invented data. */}
        <div>
          <label
            htmlFor="quote-valid-until"
            className="block text-sm font-medium text-foreground mb-1"
          >
            {t("app.quoteEdit.validUntil")}
          </label>
          <input
            id="quote-valid-until"
            type="date"
            value={validUntil || ""}
            onChange={(e) => onValidUntilChange(e.target.value)}
            className="w-full sm:w-auto border border-border rounded-lg px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {validUntil
              ? t("app.quoteNew.validUntilHint")
              : t("app.quoteNew.validUntilCleared")}
          </p>
        </div>

        <DiscountField
          value={discount}
          onChange={onDiscountChange}
          subtotal={subtotal}
          currency={currency}
        />

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={taxEnabled}
            onChange={(e) => onTaxToggle(e.target.checked)}
          />
          {t("app.quoteNew.applyTax", { rate: taxRate })}
        </label>

        {taxNote && (
          <p className="text-xs text-muted-foreground -mt-2">{taxNote}</p>
        )}

        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>{t("app.quoteEdit.subtotal")}</span>
            <span className="tabular-nums">{money(subtotal)}</span>
          </div>
          {/* Only when there is one. A "-$0.00" line on the screen the quote
              is built from trains people to ignore the row that matters. */}
          {subtotal - taxableBase > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>{t("app.quoteEdit.discount")}</span>
              {/* Derived from the base rather than re-reading the input box:
                  quoteTotals already capped it, and a second copy of the cap
                  here is a second chance to get it wrong. */}
              <span className="tabular-nums">-{money(subtotal - taxableBase)}</span>
            </div>
          )}
          <div className="flex justify-between text-muted-foreground">
            <span>{t("app.quoteEdit.tax")}</span>
            <span className="tabular-nums">{money(tax)}</span>
          </div>
          <div className="flex justify-between font-semibold text-foreground text-base pt-1 border-t border-border mt-1">
            <span>{t("app.quoteEdit.total")}</span>
            <span className="tabular-nums">{money(total)}</span>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <button
            type="button"
            onClick={onSaveAndReview}
            disabled={saving || disabled}
            className="w-full sm:w-auto justify-center border border-border px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {saving === "review" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} className="text-brand-accent-text" />
            )}
            {t("app.quoteNew.saveAndReview")}
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            {t("app.quoteNew.saveAndReviewHint")}
          </p>
        </div>
      </div>

      {/* left-60 clears the desktop sidebar; full width below that breakpoint
          where the sidebar collapses. */}
      {/* pr-20 (80px) reserves the corner the floating help launcher sits in.
          The launcher is 44px wide at right-6 (24px), so it occupies 24–68px
          from the right edge; 80px clears it with room to spare. pr-16 (64px)
          would NOT — it is four pixels short, which is exactly the kind of
          near-miss that looks fine on one screen and clips on another.
          It is `fixed bottom-6 right-6` at z-50 and this bar is z-40, so it
          landed ON TOP of the primary CTA — "Save & send" rendered clipped to
          "Save & se…" with the "?" bubble over it, at 1366px and at 1600px.
          Reserving the space is more robust than moving the launcher, which is
          global and knows nothing about this bar. */}
      <div data-tour="totals" className="fixed bottom-0 left-0 right-0 sm:left-60 bg-card border-t border-border pl-4 sm:pl-6 pr-20 py-3 flex items-center justify-between gap-3 z-40">
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground leading-none">
            {taxEnabled
              ? t("app.quoteNew.totalInclTax")
              : t("app.quoteNew.totalNoTax")}
          </div>
          <div className="text-lg font-bold text-foreground tabular-nums leading-tight">
            {money(total)}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={saving || disabled}
            className="border border-border px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {saving === "draft" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            {/* Two labels, not one string with a hidden fragment: "Save as "
                + "draft" only concatenates into a sentence in English. French
                is "Enregistrer le brouillon" / "Brouillon", which cannot be
                built by hiding a prefix. */}
            <span className="whitespace-nowrap sm:hidden">
              {t("app.quoteNew.saveAsDraftShort")}
            </span>
            <span className="whitespace-nowrap hidden sm:inline">
              {t("app.quoteNew.saveAsDraft")}
            </span>
          </button>

          <button
            type="button"
            onClick={onSaveAndSend}
            disabled={saving || disabled}
            className="bg-inverted text-inverted-foreground px-4 sm:px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {saving === "sent" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {/* The label must never truncate — it is the primary action and
                "Save & se…" reads as a broken build. The totals block on the
                left is min-w-0 and gives way instead. */}
            <span className="whitespace-nowrap">
              {t("app.quoteNew.saveAndSend")}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
