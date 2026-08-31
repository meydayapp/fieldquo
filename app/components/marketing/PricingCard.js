// app/components/marketing/PricingCard.js
"use client";

import { CheckCircle2 } from "lucide-react";
import { TRIAL_PRICE } from "@/lib/pricing";
import { useTranslation } from "@/app/hooks/useTranslation";
// The locale table moved to app/i18n/numberLocale.js — /pricing needed the
// same one, and two copies of a mapping is how the second copy goes stale.
import { numberLocaleFor } from "@/app/i18n/numberLocale";

// Locale-aware, not hardcoded to en-CA. Digit grouping differs by language —
// French Canadian uses a space where English uses a comma (1 250 vs 1,250) —
// and showing an English-formatted number inside French copy reads as a bug
// to the people who notice.
function money(value, locale) {
  const number = Number(value || 0);
  if (Number.isNaN(number)) return "0";
  return number.toLocaleString(locale, { maximumFractionDigits: 0 });
}

export default function PricingCard({ plan, selected, onSelect }) {
  const { t, language } = useTranslation();
  const locale = numberLocaleFor(language);

  const label = plan.name;
  const employeeCount = plan.maxUsers;

  // ── Seats and crew are two different things, and one number hid that ──────
  //
  // This card described a plan as "N users", from `maxUsers`, which under the
  // seat ladder is seats PLUS free crew added together — so Solo read "up to 6
  // users" and then "1 master account + 5 RBAC seats", which is five people the
  // owner is not charged for described as five access grants they must
  // administer. The owner called it confusing and he was right: it is two
  // separate numbers reported as one and then split along the wrong line.
  //
  // A ladder plan says what it is. A legacy plan has no crew concept and keeps
  // the old wording, because inventing "0 crew" for it would be a claim about a
  // plan that predates the idea.
  const ladderSeats = plan.crewSeats != null ? plan.seats : null;
  const ladderCrew = plan.crewSeats != null ? plan.crewSeats : null;

  // TRIAL_PRICE, not a literal. This was hardcoded to 1 and would have gone on
  // advertising a dollar after the real price changed in lib/pricing.js.
  const trialTotal = TRIAL_PRICE;
  const monthlyTotal = Number(plan.priceMonthly || 0);

  // ── There used to be a "(${amount}/licence)" line here ────────────────────
  //
  // It divided the plan's flat price by maxUsers (seats + free crew) and
  // printed the result — so Solo, a flat $99, read "$99/mo ($17/licence)" next
  // to a Custom card genuinely selling licences at $45 each. Both numbers were
  // real and they described two different products: under the seat ladder a
  // tier is a flat rate, seats are not sold individually, and crew are free.
  // The $17 was arithmetic, not a price, and calling it one was the exact
  // "you didn't remove the $45 from the previous pricing" bug the owner
  // flagged 2026-08-31 — see docs/PRICING-CLEANUP.md.
  const popular = plan.popular;

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
        </span>
      </div>

      <ul className="mt-4 space-y-2 flex-1">
        <li className="flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          {/* Separate keys rather than appending "s" — most languages don't
              pluralise by suffixing, and Ukrainian has three plural forms. */}
          {ladderSeats != null
            ? ladderSeats === 1
              ? t("pricing.seatsOne")
              : t("pricing.seatsMany", { count: ladderSeats })
            : !employeeCount
              ? t("pricing.seatsUnlimited")
              : employeeCount === 1
                ? t("pricing.seatsOne")
                : t("pricing.seatsMany", { count: employeeCount })}
        </li>

        {ladderCrew != null ? (
          <li className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            {t("pricing.crewIncluded", { count: ladderCrew })}
          </li>
        ) : (
          employeeCount > 1 && (
            <li className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              {t("pricing.rbacSeats", { count: employeeCount - 1 })}
            </li>
          )
        )}

        <li className="flex items-center gap-2 text-sm text-foreground">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          {t("pricing.fullAccess")}
        </li>

        {plan.maxQuotesPerMonth && (
          <li className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            {t("pricing.quoteLimit", { count: plan.maxQuotesPerMonth })}
          </li>
        )}

        {plan.aiCopilotEnabled && (
          <li className="flex items-center gap-2 text-sm text-foreground">
            <CheckCircle2 size={16} className="text-green-600 shrink-0" />
            {t("pricing.aiIncluded")}
          </li>
        )}
      </ul>
    </button>
  );
}
