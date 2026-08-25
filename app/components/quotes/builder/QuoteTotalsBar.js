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

import Link from "next/link";
import { Loader2, Save, Send, Sparkles } from "lucide-react";
import QuoteReadiness from "./QuoteReadiness";
import DiscountField from "@/app/components/quotes/DiscountField";
import { formatAppMoney } from "@/lib/format/money";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";

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
  // Editable wherever a caller passes a handler, which is now both create and
  // edit. It used to be edit-only on the grounds that a box would "fight the
  // resolver" on a new quote — true until QuoteBuilder learned to stop
  // re-resolving once the estimator types (see `taxRateTouched` there). It
  // also has to be editable on a create for the US case to work at all: the
  // resolver deliberately declines to put a state rate in the box and tells
  // the contractor to enter the address's real rate.
  onTaxRateChange = null,
  // Why THIS rate. Empty unless the company opted into per-client tax and a
  // client is selected. A tax figure that changes on its own with no
  // explanation is worse than one the user picked, however correct it is.
  taxNote = "",
  // A caveat about the rate itself rather than its provenance — PST on real
  // property in BC/MB, "this is a state base, not the rate" in the US, "you
  // told us you aren't VAT registered". Styled louder than taxNote because it
  // is the sentence that stops a wrong number going out.
  taxCaution = "",
  // A national relief scheme that isn't a reduced rate (Sweden's ROT credit,
  // Iceland's refund). Informational, so it sits with the note rather than the
  // caution.
  taxSchemeNote = "",
  // { standardRate, reducedRate, workType, conditionText, onChange } when the
  // company's country operates a reduced VAT rate for renovation work. Null
  // everywhere else, including Canada and the US.
  taxVat = null,
  total,
  taxEnabled,
  onTaxToggle,
  validUntil,
  onValidUntilChange,
  // Is the date in the box the 30-day suggestion, or one already on the quote?
  // The hint claimed "starts at 30 days from today" either way, which on an
  // existing quote is a sentence describing something that did not happen.
  validUntilDefaulted = true,
  // The company's billing currency. Hardcoded to CAD here until now, so a
  // company billing in USD watched the builder count in dollars the document
  // would not use.
  currency,
  saving,
  disabled,
  readiness,
  readinessItems,
  // What the always-present save says. "Save as draft" when there is no quote
  // yet; "Save changes" when there is. Two labels because the short one is not
  // the long one with a word hidden — French builds neither by truncation.
  primaryLabel,
  primaryLabelShort,
  onSaveDraft,
  // Both optional. A null handler renders NO button rather than a disabled or
  // inert one: sending is not offered on a quote the client already decided,
  // and "Save & review" is a create-only shortcut to a panel that is already on
  // screen once the quote exists.
  onSaveAndSend = null,
  onSaveAndReview = null,
  // Where "Cancel" goes back to, when there is somewhere to go back to.
  cancelHref = null,
}) {
  const { t, language } = useTranslation();
  // Same reason as explainTaxSource: 9,5 % not 9.5 % on a French screen.
  const pct = (n) =>
    Number(n).toLocaleString(numberLocaleFor(language), { maximumFractionDigits: 3 });
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
            {!validUntil
              ? t("app.quoteNew.validUntilCleared")
              : validUntilDefaulted
                ? t("app.quoteNew.validUntilHint")
                : t("app.quoteNew.validUntilStored")}
          </p>
        </div>

        <DiscountField
          value={discount}
          onChange={onDiscountChange}
          subtotal={subtotal}
          currency={currency}
        />

        {onTaxRateChange ? (
          <div>
            <label
              htmlFor="quote-tax-rate"
              className="block text-sm font-medium text-foreground mb-1"
            >
              {t("app.quoteEdit.taxRate")}
            </label>
            <input
              id="quote-tax-rate"
              type="number"
              min="0"
              step="0.001"
              value={taxRate}
              disabled={!taxEnabled}
              onChange={(e) => onTaxRateChange(e.target.value)}
              className="w-full sm:w-40 border border-border rounded-lg px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
            />
            <label className="flex items-center gap-2 mt-2 text-sm">
              <input
                type="checkbox"
                checked={taxEnabled}
                onChange={(e) => onTaxToggle(e.target.checked)}
              />
              {t("app.quoteEdit.chargeTax")}
            </label>
          </div>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={taxEnabled}
              onChange={(e) => onTaxToggle(e.target.checked)}
            />
            {t("app.quoteNew.applyTax", { rate: taxRate })}
          </label>
        )}

        {/* ── Standard or reduced VAT ──────────────────────────────────
            A question rather than a guess: the reduced rate's conditions
            (dwelling age, materials share, designated area) are not knowable
            from a quote, so they are printed beside the option and the
            contractor — who can check them — decides. */}
        {taxVat && (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-foreground">
              {t("app.tax.vatChoice.title")}
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="quote-vat-worktype"
                checked={taxVat.workType !== "renovation"}
                onChange={() => taxVat.onChange(null)}
              />
              {t("app.tax.vatChoice.standard", { rate: pct(taxVat.standardRate) })}
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                className="mt-1"
                name="quote-vat-worktype"
                checked={taxVat.workType === "renovation"}
                onChange={() => taxVat.onChange("renovation")}
              />
              <span>
                {t("app.tax.vatChoice.reduced", { rate: pct(taxVat.reducedRate) })}
                {taxVat.conditionText && (
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {taxVat.conditionText}
                  </span>
                )}
              </span>
            </label>
          </div>
        )}

        {taxNote && (
          <p className="text-xs text-muted-foreground -mt-2">{taxNote}</p>
        )}

        {taxSchemeNote && (
          <p className="text-xs text-muted-foreground -mt-1">{taxSchemeNote}</p>
        )}

        {taxCaution && (
          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-lg px-2.5 py-2 -mt-1">
            {taxCaution}
          </p>
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
              <span className="tabular-nums">
                -{money(subtotal - taxableBase)}
              </span>
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
      </div>

      {/* What is still missing, live and free. The sentence explaining that
          Review saves a draft first lives here too — the sticky bar has room
          for a button and not for a sentence. */}
      {readiness && (
        <div className="pt-4 border-t border-border space-y-2">
          <QuoteReadiness
            draft={readiness}
            items={readinessItems || []}
            t={t}
          />
          {/* Only alongside the button it explains. On the edit route the
              review panel is on the page already, so this sentence would be
              describing a button that isn't there. */}
          {onSaveAndReview && (
            <p className="text-xs text-muted-foreground">
              {t("app.quoteNew.saveAndReviewHint")}
            </p>
          )}
        </div>
      )}

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
      <div
        data-tour="totals"
        className="fixed bottom-0 left-0 right-0 sm:left-60 bg-card border-t border-border pl-4 sm:pl-6 pr-20 py-3 flex items-center justify-between gap-3 z-40"
      >
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
          {/* ── Review sits WITH the other actions ──────────────────────────
              It shipped at the bottom of the totals card, on the argument that
              a third button does not fit at 375px. The owner could not find
              it — they looked where the save buttons are, which is where a
              person looks for something to do to a quote. A feature nobody can
              find is not shipped, so the argument lost.

              It fits because it is an ICON ONLY below sm, where the two save
              buttons already collapse to short labels. The sentence explaining
              that it saves a draft first moves to the card above, where there
              is room for a sentence — the honest part is kept, just not
              wedged into a bar that cannot hold it. */}
          {cancelHref && (
            <Link
              href={cancelHref}
              className="border border-border text-foreground px-3 sm:px-5 py-2.5 rounded-full text-sm font-semibold inline-flex items-center"
            >
              {t("app.action.cancel")}
            </Link>
          )}

          {onSaveAndReview && (
            <button
              type="button"
              onClick={onSaveAndReview}
              disabled={saving || disabled}
              title={t("app.quoteNew.saveAndReview")}
              aria-label={t("app.quoteNew.saveAndReview")}
              className="border border-border px-3 sm:px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
            >
              {saving === "review" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Sparkles size={14} className="text-brand-accent-text" />
              )}
              <span className="whitespace-nowrap hidden sm:inline">
                {t("app.quoteNew.reviewShort")}
              </span>
            </button>
          )}

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
              {primaryLabelShort || t("app.quoteNew.saveAsDraftShort")}
            </span>
            <span className="whitespace-nowrap hidden sm:inline">
              {primaryLabel || t("app.quoteNew.saveAsDraft")}
            </span>
          </button>

          {onSaveAndSend && (
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
          )}
        </div>
      </div>
    </>
  );
}
