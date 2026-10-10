// app/components/marketing/home/OutcomeGroups.js
//
// Section 6: what FieldQuo helps you do, grouped by outcome rather than by
// menu. Every item links to the page that explains it — /features/<slug>
// where a feature page exists, /product/scheduling for dispatch (the product
// page that covers it). check:homepage-sections resolves every slug below
// against app/data/featurePages.js and app/data/productFeatures.js, because
// /features/[slug] accepts any slug and calls notFound() on a wrong one.
//
// A few items share a page, and that is the truth rather than padding:
// deposits are part of payments (/features/payments), and conversion data is
// the per-step funnel numbers (/features/lead-funnels).
"use client";

import Link from "next/link";
import { Target, Wrench, Wallet, TrendingUp, ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export const OUTCOME_GROUPS = [
  {
    key: "win",
    icon: Target,
    items: [
      { key: "leads", href: "/features/leads" },
      { key: "quotes", href: "/features/quotes" },
      { key: "booking", href: "/features/online-booking" },
      { key: "followUps", href: "/features/automatic-follow-ups" },
      { key: "website", href: "/features/website" },
      { key: "marketing", href: "/features/marketing" },
    ],
  },
  {
    key: "run",
    icon: Wrench,
    items: [
      { key: "scheduling", href: "/features/scheduling" },
      { key: "dispatch", href: "/product/scheduling" },
      { key: "crew", href: "/features/crew" },
      { key: "timesheets", href: "/features/time-clock" },
      { key: "photos", href: "/features/job-photos" },
      { key: "tracking", href: "/features/jobs" },
    ],
  },
  {
    key: "paid",
    icon: Wallet,
    // One line under the chips: pay-over-time (Klarna through Stripe) next
    // to Payments, where a contractor reading "Get paid" is looking. The
    // sentence and its sources live in app/i18n/homePage/en.js.
    note: "paidFinancing",
    items: [
      { key: "invoices", href: "/features/invoicing" },
      { key: "payments", href: "/features/payments" },
      { key: "deposits", href: "/features/payments" },
      { key: "expenses", href: "/features/expenses" },
      { key: "payroll", href: "/features/payroll" },
    ],
  },
  {
    key: "grow",
    icon: TrendingUp,
    items: [
      { key: "analytics", href: "/features/reporting" },
      { key: "ai", href: "/features/fieldquo-ai" },
      { key: "conversion", href: "/features/lead-funnels" },
      { key: "profitability", href: "/features/job-costing" },
    ],
  },
];

export default function OutcomeGroups() {
  const { t } = useTranslation();

  return (
    <section className="bg-card border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
            {t("home.outcomes.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("home.outcomes.subtitle")}</p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {OUTCOME_GROUPS.map((group) => (
            <div key={group.key} className="flex flex-col rounded-2xl border border-border bg-muted p-6">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-card text-foreground">
                <group.icon size={20} aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t(`home.outcomes.${group.key}`)}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li key={item.key}>
                    <Link
                      href={item.href}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      {t(`home.outcomes.item.${item.key}`)}
                    </Link>
                  </li>
                ))}
              </ul>
              {group.note && (
                <p data-outcome-note={group.note} className="mt-4 text-sm leading-relaxed text-foreground">
                  {t(`home.outcomes.${group.note}`)}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/features"
            className="inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-primary hover:underline"
          >
            {t("home.outcomes.allFeatures")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
