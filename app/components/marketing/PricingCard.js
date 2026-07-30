// app/components/marketing/PricingCard.js
"use client";

import { CheckCircle2 } from "lucide-react";
import { calculatePricing , TRIAL_PRICE } from "@/lib/pricing";
import { useTranslation } from "@/app/hooks/useTranslation";

// Locale-aware, not hardcoded to en-CA. Digit grouping differs by language —
// French Canadian uses a space where English uses a comma (1 250 vs 1,250) —
// and showing an English-formatted number inside French copy reads as a bug
// to the people who notice.
function money(value, locale) {
  const number = Number(value || 0);
  if (Number.isNaN(number)) return "0";
  return number.toLocaleString(locale, { maximumFractionDigits: 0 });
}

// Maps a UI language onto a formatting locale. Punjabi and Tagalog default to
// their most common regional formatting rather than the bare language tag.
const NUMBER_LOCALES = {
  en: "en-CA",
  fr: "fr-CA",
  es: "es-MX",
  uk: "uk-UA",
  pa: "pa-IN",
  tl: "en-PH",
};

export default function PricingCard({ tier, plan, selected, onSelect }) {
  const { t, language } = useTranslation();
  const locale = NUMBER_LOCALES[language] || "en-CA";
  const isDbPlan = Boolean(plan);

  const label = isDbPlan ? plan.name : tier.label;
  const employeeCount = isDbPlan ? plan.maxUsers : tier.employeeCount;

  const calculated = calculatePricing(employeeCount || 1);

  // TRIAL_PRICE, not a literal. This was hardcoded to 1 and would have gone on
  // advertising a dollar after the real price changed in lib/pricing.js.
  const trialTotal = isDbPlan ? TRIAL_PRICE : calculated.trialTotal;
  const monthlyTotal = isDbPlan
    ? Number(plan.priceMonthly || 0)
    : calculated.monthlyTotal;

  const perLicense =
    employeeCount > 0 ? Math.round(monthlyTotal / employeeCount) : monthlyTotal;

  const popular = !isDbPlan && tier.popular;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`text-left border rounded-2xl p-6 flex flex-col relative bg-card
        transition-all duration-150 ease-out
        hover:scale-[1.03] hover:shadow-lg
        active:scale-[0.99]
        ${
          selected
            ? "border-primary shadow-md ring-2 ring-ring scale-[1.02] bg-muted"
            : "border-border hover:border-primary/40"
        }`}
    >
      {popular && (
        <span className="absolute -top-3 left-6 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
          {t("pricing.popular")}
        </span>
      )}

      {selected && (
        <span className="absolute -top-3 right-6 bg-green-600 text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1">
          <CheckCircle2 size={12} /> {t("pricing.selected")}
        </span>
      )}

      <h3 className="text-lg font-semibold text-foreground">{label}</h3>

      <div className="mt-3">
        <div className="text-sm text-muted-foreground">{t("pricing.firstMonth")}</div>

        {/* "$0" reads like a bug. Free is the offer, so it says Free. */}
        <div className="text-2xl font-bold text-foreground">
          {trialTotal > 0 ? `$${money(trialTotal, locale)}` : t("pricing.free")}
        </div>
      </div>

      <div className="mt-2 text-sm text-muted-foreground">
        {t("pricing.then")}{" "}
        <span className="font-semibold text-foreground">
          ${money(monthlyTotal, locale)}
          {t("pricing.perMonthShort")}
        </span>{" "}
        {employeeCount
          ? t("pricing.perLicense", { amount: money(perLicense, locale) })
          : ""}
      </div>

      <ul className="mt-4 space-y-2 flex-1">
        <li className="flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          {/* Separate keys rather than appending "s" — most languages don't
              pluralise by suffixing, and Ukrainian has three plural forms. */}
          {!employeeCount
            ? t("pricing.seatsUnlimited")
            : employeeCount === 1
              ? t("pricing.seatsOne")
              : t("pricing.seatsMany", { count: employeeCount })}
        </li>

        {employeeCount > 1 && (
          <li className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            {t("pricing.rbacSeats", { count: employeeCount - 1 })}
          </li>
        )}

        <li className="flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          {t("pricing.fullAccess")}
        </li>

        {isDbPlan && plan.maxQuotesPerMonth && (
          <li className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            {t("pricing.quoteLimit", { count: plan.maxQuotesPerMonth })}
          </li>
        )}

        {isDbPlan && plan.aiCopilotEnabled && (
          <li className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            {t("pricing.aiIncluded")}
          </li>
        )}
      </ul>
    </button>
  );
}
