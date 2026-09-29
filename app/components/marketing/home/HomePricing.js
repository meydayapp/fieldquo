// app/components/marketing/home/HomePricing.js
//
// Section 10: pricing, asked as the question a contractor can answer — "how
// many people run your business?" — with the plan that fits under each.
//
// ══ No price on this page is typed ═══════════════════════════════════════
//
// `plans` arrives from app/(marketing)/page.js already resolved through the
// functions /pricing uses (partitionPlans → oneRowPerTier → livePromotions →
// universalPromotions → withOffers), and each price block is PlanOfferPrice —
// the component /pricing, signup and the in-app picker all print offers
// with. So a sale shows here exactly as it shows there, with its crossed-out
// regular price, its end date and its renewal, and the numbers cannot drift.
//
// The offer shown is the 1-year one when the plan sells a year, because that
// is the tab /pricing opens on; the monthly price is one click away there.
//
// Every card links to /pricing, not straight to checkout: the homepage is
// answering "roughly what does it cost", and the comparison, the monthly
// tab and the custom size are on that page.
//
// If the plans could not be read, the band keeps its question and its link
// and prints no figures — never a remembered price.
"use client";

import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { currencyMeta } from "@/lib/currency";
import { peopleLines } from "@/lib/pricing/peopleLines";
import PlanOfferPrice, { OfferRibbon, offerMoney } from "@/app/components/billing/PlanOfferPrice";

// The rungs that have an audience line ("Just me", "Small team", …), by
// Plan.tierKey (SEAT_LADDER in lib/pricing/ladder.js). A tier not listed is
// not shown here, rather than shown under a guessed label.
const AUDIENCE_TIERS = ["solo", "crew", "shop", "scale"];

export default function HomePricing({ plans = [] }) {
  const { t, language } = useTranslation();
  const locale = numberLocaleFor(language);
  const cards = (plans || []).filter((p) => AUDIENCE_TIERS.includes(p.tierKey));

  return (
    <section className="bg-muted border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
            {t("home.pricing.title")}
          </h2>
          <p className="mt-4 text-xl font-semibold text-foreground">{t("home.pricing.question")}</p>
          <p className="mt-2 text-muted-foreground">{t("home.pricing.body")}</p>
        </div>

        {cards.length ? (
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((plan) => {
              const offer = plan.offers?.year?.available ? plan.offers.year : plan.offers?.month || null;
              return (
                <li key={plan.id}>
                  <Link
                    href="/pricing"
                    data-home-plan={plan.tierKey}
                    className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:border-foreground/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <OfferRibbon offer={offer} t={t} />
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-accent-text pr-12">
                      <Users size={15} aria-hidden="true" />
                      {t(`home.pricing.audience.${plan.tierKey}`)}
                    </span>
                    <h3 className="mt-2 text-xl font-bold text-foreground">{plan.name}</h3>
                    {offer ? (
                      <PlanOfferPrice
                        offer={offer}
                        t={t}
                        money={offerMoney(currencyMeta(plan.currency).symbol, locale)}
                        locale={locale}
                        size="md"
                        className="mt-3"
                      />
                    ) : null}
                    <ul className="mt-4 flex-1 space-y-1.5 text-sm text-muted-foreground">
                      {peopleLines(plan).map((line) => (
                        <li key={line.key}>{t(line.key, line.fallback, line.values)}</li>
                      ))}
                    </ul>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      {t("home.pricing.compare")}
                      <ArrowRight size={15} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="mt-10 text-center">
          <Link
            href="/pricing"
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border bg-card px-6 py-3 font-semibold text-foreground transition hover:border-foreground/40"
          >
            {t("home.pricing.compare")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
