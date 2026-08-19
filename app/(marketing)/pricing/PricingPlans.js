// app/(marketing)/pricing/PricingPlans.js
//
// The plan grid. Client half of /pricing — split from page.js because
// translation lives in React context while the Prisma read and the metadata
// export have to stay on the server. Same shape as /industries/[slug].
//
// Before this split the whole page was hardcoded English on an otherwise
// six-language site, and it printed "$45" with no currency anywhere on it.
"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { currencyMeta } from "@/lib/currency";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";

/**
 * How many columns the plan grid gets, given how many plans exist.
 *
 * It was hardcoded to three. There are four plans, so the most expensive one —
 * the $700 tier, the one worth the most per signup — sat alone on a second row
 * beside two card-widths of dead space.
 *
 * Rule: up to four plans go on one row; beyond that, pick the widest layout
 * whose LAST row is fullest, so the orphan is never a single card. Pure, and
 * exercised over 1..12 by check-pricing-grid.mjs.
 */
export function pricingColumns(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 1) return 1;
  if (n <= 4) return n;

  let best = 4;
  let fullestLastRow = -1;
  for (const columns of [4, 3, 2]) {
    const lastRow = n % columns === 0 ? columns : n % columns;
    if (lastRow > fullestLastRow) {
      fullestLastRow = lastRow;
      best = columns;
    }
  }
  return best;
}

// Tailwind scans source for complete class names, so these cannot be built by
// string concatenation — `lg:grid-cols-${n}` produces no CSS at all.
const COLUMN_CLASS = {
  1: "sm:grid-cols-1 lg:grid-cols-1 max-w-sm mx-auto",
  2: "sm:grid-cols-2 lg:grid-cols-2 max-w-3xl mx-auto",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

export default function PricingPlans({ plans, currency }) {
  const { t, language } = useTranslation();
  const locale = numberLocaleFor(language);
  const meta = currencyMeta(currency);

  const columns = pricingColumns(plans.length);

  const price = (amount) =>
    Number(amount || 0).toLocaleString(locale, { maximumFractionDigits: 0 });

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          {t("pricingPage.title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t("pricingPage.subtitle")}
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="text-center text-muted-foreground border border-border rounded-xl p-12">
          <p>{t("pricingPage.emptyTitle")}</p>
          <Link href="/contact" className="underline mt-2 inline-block">
            {t("pricingPage.emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          <div className={`grid gap-6 ${COLUMN_CLASS[columns]}`}>
            {plans.map((plan) => {
              const features = plan.features || {};
              return (
                <div
                  key={plan.id}
                  className="border border-border rounded-2xl p-8 flex flex-col hover:border-border transition-colors"
                >
                  <h3 className="text-lg font-semibold text-foreground">
                    {plan.name}
                  </h3>
                  <div className="mt-3 flex items-baseline flex-wrap gap-x-1.5">
                    <span className="text-3xl font-bold text-foreground">
                      {meta.symbol}
                      {price(plan.priceMonthly)}
                    </span>
                    {/* The currency code, every single time. A Plan row holds
                        ONE number and Stripe bills it in the company's own
                        currency, so "$700" is $700 CAD to a Toronto contractor
                        and $700 USD to one in Buffalo — roughly $250/month
                        apart. The symbol alone does not distinguish them. */}
                    <span className="text-sm font-medium text-muted-foreground">
                      {meta.code}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {t("pricingPage.perMonth")}
                    </span>
                  </div>

                  <ul className="mt-6 space-y-2.5 flex-1">
                    {plan.maxUsers ? (
                      <li className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2
                          size={16}
                          className="text-green-600 shrink-0"
                        />
                        {/* Separate keys, not an appended "s". This read
                            "Up to 1 team members" in English, and most of the
                            other five languages don't pluralise by suffixing
                            at all — Ukrainian has three plural forms. */}
                        {plan.maxUsers === 1
                          ? t("pricing.seatsOne")
                          : t("pricing.seatsMany", { count: plan.maxUsers })}
                      </li>
                    ) : null}

                    {plan.maxQuotesPerMonth ? (
                      <li className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2
                          size={16}
                          className="text-green-600 shrink-0"
                        />
                        {t("pricing.quoteLimit", {
                          count: plan.maxQuotesPerMonth,
                        })}
                      </li>
                    ) : null}

                    {plan.aiCopilotEnabled ? (
                      <li className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2
                          size={16}
                          className="text-green-600 shrink-0"
                        />
                        {t("pricing.aiIncluded")}
                      </li>
                    ) : null}

                    {/* Free-form per-plan flags set in /platform. They're data,
                        not catalogue keys, so they stay in whatever language
                        they were typed in — same as the plan name above. */}
                    {Object.entries(features).map(([key, val]) =>
                      val ? (
                        <li
                          key={key}
                          className="flex items-center gap-2 text-sm text-foreground"
                        >
                          <CheckCircle2
                            size={16}
                            className="text-green-600 shrink-0"
                          />
                          {key.replace(/_/g, " ")}
                        </li>
                      ) : null,
                    )}
                  </ul>

                  <Link
                    href={`/signup?plan=${plan.id}`}
                    className="mt-8 text-center bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-primary"
                  >
                    {t("nav.signup")}
                  </Link>
                </div>
              );
            })}
          </div>

          {/* Two things a contractor cannot work out from the cards alone:
              which currency they'd be charged in, and whether the number is
              what leaves their account. Ontario adds 13% HST on top. */}
          <p className="mt-8 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
            {t("pricingPage.currencyNote", { currency: meta.code })}{" "}
            {t("pricingPage.taxNote")}
          </p>
        </>
      )}
    </div>
  );
}
