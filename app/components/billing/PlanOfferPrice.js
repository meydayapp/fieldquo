// app/components/billing/PlanOfferPrice.js
//
// How a plan's price is SAID, on every surface that sells one: the in-app
// plan picker, /pricing (rungs and the custom card) and the signup plan
// cards. One component so the four cannot drift into four wordings of the
// same offer — which is how "US$990/yr" came to sit on one screen with
// nothing saying it was a deal, and "Save 17%" on another.
//
// ══ It renders an offer; it never works one out ═══════════════════════════
//
// `offer` is lib/pricing/planOffer.js's answer, resolved on the SERVER
// (lib/billing/promotions.js) and sent to the page. Nothing below multiplies
// or discounts: the crossed-out monthly, the big per-month figure, the billed
// total, the saving, the ribbon's percentage and the renewal are all fields
// of the offer. check:promotions-live asserts this file does no arithmetic on
// a price.
//
// ══ The owner's design (2026-09-28, the approved mockup) ══════════════════
//
//   1-year, standing offer:   ~~US$99/mo~~  US$82.50/mo
//                             Billed US$990 once a year · You save US$198 a year
//                             ribbon "Save 17%"
//   1-year, during a sale:    [badge: the promotion's label]
//                             ~~US$99/mo~~  US$59.40/mo
//                             For the first 12 months, then US$990/yr
//                             Billed US$712.80 for year one
//                             Offer ends Oct 31, 2026 · ribbon "Save 40%"
//   Monthly:                  US$99/mo, as before — or the same sale shape
//                             for a promotion that targets the monthly price.
//
// ══ Colours are measured, not assumed ═════════════════════════════════════
//
// The ribbon, the badge and the saving line use fixed hex pairs rather than
// palette classes so check:promotions-live can read them straight out of this
// file and measure each against the card it sits on, light and dark (the
// marketing pages are light only; /app is themeable). Every pair clears
// 4.5:1 — see the check for the numbers.
"use client";

export const RIBBON_CLASS = "bg-[#047857] text-[#ffffff]";
export const BADGE_CLASS =
  "bg-[#fef3c7] text-[#92400e] border-[#fcd34d] dark:bg-[#451a03] dark:text-[#fde68a] dark:border-[#92400e]";
export const SAVE_CLASS = "text-[#065f46] dark:text-[#6ee7b7]";

/** "US$990" / "US$82.50": whole units when whole, cents when not. */
export function offerMoney(symbol = "$", locale = "en-CA") {
  return (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return "—";
    const whole = Math.round(v * 100) % 100 === 0;
    return `${symbol}${v.toLocaleString(locale, whole ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
}

/**
 * The last day an offer runs, in the reader's calendar. A sale entered as
 * "ends 1 Nov 00:00" runs through 31 October, and "Offer ends Nov 1" would
 * promise a day that is not in it — so the day is read one millisecond
 * before the end.
 */
export function offerEndDate(endsAt, locale = "en-CA") {
  const t = endsAt ? new Date(endsAt).getTime() : NaN;
  if (!Number.isFinite(t)) return null;
  return new Date(t - 1).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

/**
 * The diagonal corner ribbon: "Save 17%". Its parent must be `relative
 * overflow-hidden`. Nothing is drawn for a zero saving — a "Save 0%" ribbon
 * is a badge with nothing behind it.
 */
export function OfferRibbon({ offer, t }) {
  if (!offer?.available || !(offer.percent > 0)) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute top-0 right-0 w-28 h-28 overflow-hidden" data-offer-ribbon>
      <div
        className={`absolute top-[18px] right-[-34px] w-[150px] rotate-45 text-center text-[11px] font-bold uppercase tracking-wide py-1 shadow-sm ${RIBBON_CLASS}`}
      >
        {t("pricing.offer.ribbon", "Save {percent}%", { percent: offer.percent })}
      </div>
    </div>
  );
}

/**
 * The price block. `money` formats a figure in the plan's currency;
 * `size` is "lg" on the big cards and "md" in the tighter in-app grid.
 */
export default function PlanOfferPrice({ offer, t, money, locale = "en-CA", size = "lg", className = "" }) {
  if (!offer?.available) return null;
  const big = size === "lg" ? "text-3xl" : "text-2xl";
  const perMonth = (amount) => t("pricing.offer.perMonth", "{amount}/mo", { amount: money(amount) });
  const ends = offer.promo ? offerEndDate(offer.promo.endsAt, locale) : null;
  const yearly = offer.interval === "year";

  return (
    <div className={className} data-offer={offer.interval} data-offer-promo={offer.promo ? "1" : "0"}>
      {offer.promo?.label && (
        <span className={`inline-block mb-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${BADGE_CLASS}`} data-offer-badge>
          {offer.promo.label}
        </span>
      )}
      {offer.crossedPerMonth ? (
        <div className="text-sm text-muted-foreground">
          <span className="line-through decoration-muted-foreground/70">{perMonth(offer.crossedPerMonth)}</span>
          <span className="sr-only"> ({t("pricing.offer.regularPrice", "regular price")})</span>
        </div>
      ) : null}
      <div className={`${big} font-bold text-foreground leading-tight`}>{perMonth(offer.perMonth)}</div>
      {yearly ? (
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {offer.promo ? (
            <>
              <p>
                {t("pricing.offer.firstYearThen", "For the first 12 months, then {amount}/yr", { amount: money(offer.renewal) })}
              </p>
              <p>{t("pricing.offer.billedYearOne", "Billed {amount} for year one", { amount: money(offer.charge) })}</p>
            </>
          ) : (
            <p>{t("pricing.offer.billedYearly", "Billed {amount} once a year", { amount: money(offer.charge) })}</p>
          )}
          {offer.saves > 0 && (
            <p className={`font-medium ${SAVE_CLASS}`}>
              {offer.promo
                ? t("pricing.offer.youSaveYearOne", "You save {amount} in year one", { amount: money(offer.saves) })
                : t("pricing.offer.youSaveYear", "You save {amount} a year", { amount: money(offer.saves) })}
            </p>
          )}
          {ends && <p>{t("pricing.offer.endsOn", "Offer ends {date}", { date: ends })}</p>}
        </div>
      ) : offer.promo ? (
        <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          <p>
            {offer.promoMonths === 1
              ? t("pricing.offer.firstMonthThen", "For the first month, then {amount}/mo", { amount: money(offer.renewal) })
              : t("pricing.offer.firstMonthsThen", "For the first {months} months, then {amount}/mo", {
                  months: offer.promoMonths,
                  amount: money(offer.renewal),
                })}
          </p>
          {ends && <p>{t("pricing.offer.endsOn", "Offer ends {date}", { date: ends })}</p>}
        </div>
      ) : null}
      {offer.withheld?.promo && (
        <p className="mt-1 text-xs text-muted-foreground" data-offer-withheld>
          {t(
            "pricing.offer.withheld",
            "The {label} price applies to a new plan or a change that starts at your renewal — not to a yearly upgrade taken today.",
            { label: offer.withheld.promo.label || "" },
          )}
        </p>
      )}
    </div>
  );
}

/**
 * The 1-year tab's label: "1-year commitment · save 17%", or "save up to
 * 40%" when the cards disagree — from yearTabSaving() over the offers the
 * page is showing.
 */
export function yearTabLabel(t, saving) {
  const base = t("pricing.offer.tabYear", "1-year commitment");
  if (!saving || !(saving.percent > 0)) return base;
  return `${base} · ${
    saving.upTo
      ? t("pricing.offer.tabSaveUpTo", "save up to {percent}%", { percent: saving.percent })
      : t("pricing.offer.tabSave", "save {percent}%", { percent: saving.percent })
  }`;
}
