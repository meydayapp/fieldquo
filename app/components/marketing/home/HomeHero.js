// app/components/marketing/home/HomeHero.js
//
// Section 1: the promise, the ask, and — only while a sale is running for
// everybody — the pill above the headline.
//
// Two buttons, one primary. The trial is the brand-accent fill the nav's
// signup button uses, so the one action the page exists for looks the same
// wherever a visitor meets it; "See how it works" is outlined and scrolls to
// the product demo directly below rather than to another page — a visitor
// not ready to sign up wants to SEE the product, not read about it elsewhere.
"use client";

import Link from "next/link";
import { ArrowRight, ArrowDown } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { offerEndDate } from "@/app/components/billing/PlanOfferPrice";
import TrialLine from "./TrialLine";

/**
 * The pill. Every figure in it is the promotion row's own, resolved on the
 * server by lib/marketing/homeSale.js — which also decided the promotion is
 * one every visitor is actually charged. Nothing here discounts anything.
 *
 * A fixed amount ("$20 off") has no single number to print across three
 * currencies' worth of plans, so it shows the sale's name and end date only
 * and lets /pricing say the rest.
 */
function SalePill({ sale }) {
  const { t, language } = useTranslation();
  const locale = numberLocaleFor(language);
  const ends = offerEndDate(sale.endsAt, locale, { month: "short", day: "numeric" });

  let off = null;
  if (sale.percent != null) {
    const both = sale.intervals.includes("month") && sale.intervals.includes("year");
    if (both) off = t("home.sale.offBoth", { percent: sale.percent });
    else if (sale.intervals.includes("year")) off = t("home.sale.offYear", { percent: sale.percent });
    else if (sale.durationMonths === 1) off = t("home.sale.offPromoFirstMonth", { percent: sale.percent });
    else off = t("home.sale.offPromoMonths", { percent: sale.percent, months: sale.durationMonths });
  }
  const detail = [off, ends ? t("home.sale.ends", { date: ends }) : null].filter(Boolean).join(" · ");

  return (
    <Link
      href="/pricing"
      data-sale-pill={sale.id}
      className="group mb-7 inline-flex max-w-full items-center gap-2.5 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-4 min-h-[44px] text-left text-sm shadow-sm transition hover:border-foreground/30"
    >
      {/* #0b1a2e on #ff5a00 measures 5.58:1. */}
      <span className="shrink-0 rounded-full bg-brand-accent px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-accent-foreground">
        {sale.name || t("home.sale.fallbackName")}
      </span>
      <span className="min-w-0 font-medium text-foreground">{detail}</span>
      <span className="sr-only"> — {t("home.sale.seePricing")}</span>
      <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export default function HomeHero({ sale = null }) {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden bg-linear-to-b from-muted to-card">
      {/* A faint grid, drawn in CSS: texture without an image to download or
          a stock photo standing in for a product it does not show. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
      />
      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-14 sm:pt-20 sm:pb-20 text-center">
        {sale ? <SalePill sale={sale} /> : null}

        <h1 className="mx-auto max-w-4xl text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-foreground text-balance leading-[1.08]">
          {t("home.hero.title")}
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl leading-relaxed text-muted-foreground text-pretty">
          {t("home.hero.subtitle")}
        </p>

        <div className="mt-9 flex flex-col sm:flex-row sm:items-center sm:justify-center gap-3 sm:gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full bg-brand-accent px-8 py-3.5 text-base font-semibold text-brand-accent-foreground shadow-sm transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("home.hero.ctaPrimary")}
            <ArrowRight size={18} aria-hidden="true" />
          </Link>
          <a
            href="#see-how-it-works"
            className="inline-flex items-center justify-center gap-2 min-h-[48px] rounded-full border border-border bg-card px-7 py-3.5 text-base font-semibold text-foreground transition hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("home.hero.ctaSecondary")}
            <ArrowDown size={18} aria-hidden="true" />
          </a>
        </div>

        <TrialLine className="mt-5 text-sm text-muted-foreground" />
        <p className="mt-8 text-sm sm:text-base font-semibold text-foreground">{t("home.hero.flow")}</p>
      </div>
    </section>
  );
}
