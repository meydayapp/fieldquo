// app/components/marketing/Hero.js
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { FileText, Calendar, Receipt, BarChart3, ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import DemoBooking from "./DemoBooking";

// Keys and icons only — copy lives in the catalog under hero.tabs.*
//
// `image` is optional, and the tabs without one keep the gradient-and-icon
// placeholder rather than borrowing a neighbour's picture. A stock photo
// standing in for a feature it does not show is a claim, and this panel is the
// first thing a contractor comparing three products looks at.
const TABS = [
  // Intrinsic size per image, not one pair for both. They are 4:3 and 5:4, and
  // declaring 1400x1050 for the 1120-tall one made the browser reserve a box the
  // wrong shape — the layout shift Image's width/height exist to prevent, caused
  // by the numbers meant to prevent it.
  {
    key: "quotes",
    icon: FileText,
    image: "/marketing/hero-quotes.webp",
    width: 1400,
    height: 1050,
  },
  {
    key: "scheduling",
    icon: Calendar,
    image: "/marketing/hero-scheduling.webp",
    width: 1400,
    height: 1120,
  },
  {
    key: "invoicing",
    icon: Receipt,
    image: "/marketing/hero-invoicing.webp",
    width: 1400,
    height: 1050,
  },
  {
    key: "analytics",
    icon: BarChart3,
    // Drawn rather than photographed, from the real screens: the cost-per-job
    // and minimum-price figures are what /app/settings/overhead computes, and
    // the comparison rows are the shape /app/analytics/benchmark renders —
    // your average against the trade's, per service, with the sample size
    // shown. A marketing image of a screen that does not exist is the same
    // dishonesty as a control that does not work.
    image: "/marketing/hero-analytics.webp",
    // 4:3, matching the other three. The first version was 1400x742 and sat
    // visibly wider than its neighbours as the tabs switched — a panel that
    // changes shape under you reads as a layout bug, not a different picture.
    width: 1400,
    height: 1050,
  },
];

export default function Hero() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("quotes");

  const active = TABS.find((tab) => tab.key === activeTab);

  return (
    <section className="bg-linear-to-b from-muted to-card">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
          {t("hero.title")}
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("hero.subtitle")}
        </p>

        {/* ── The ask ────────────────────────────────────────────────────────
            Until this landed the homepage never asked for the signup at all.
            Every other marketing page has a /signup link; this one had none —
            the only route was the nav bar, which on a phone is behind the
            hamburger. hero.cta has existed in all nine languages the whole
            time, rendered by nothing. A conversion page that never asks is the
            dead-control rule in its mirror image: the copy was written, the
            button was not.

            Brand accent, matching the nav's signup button, so the one action
            the page is for looks the same wherever a visitor meets it. */}
        <div className="mt-9 flex flex-col sm:flex-row sm:items-start sm:justify-center gap-4 sm:gap-5">
          <div className="flex flex-col items-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 min-h-[44px] bg-brand-accent text-brand-accent-foreground px-8 py-4 rounded-full text-base font-semibold hover:brightness-95 transition"
          >
            {t("hero.cta")}
            <ArrowRight size={18} />
          </Link>

          {/* NOT hero.noCard. That key says "No credit card required" in nine
              languages and it is FALSE: /api/companies creates the company and
              then opens Stripe Checkout, and app/app/layout.js sends an owner
              whose company has no subscription back to pay before it will show
              them a dashboard. You cannot use FieldQuo without a card. The
              offer that IS true is the free first month (TRIAL_PRICE = 0), and
              pricing.firstMonth / pricing.free already state it in all nine —
              they are the same two strings PricingCard prints over the price.
              Joined with a separator rather than composed into a sentence,
              because word order is not ours to assume across nine languages. */}
            <p className="mt-3 text-sm text-muted-foreground">
              {t("pricing.firstMonth")} ·{" "}
              <span className="font-semibold text-foreground">
                {t("pricing.free")}
              </span>
            </p>
          </div>

          {/* Book a live demo — a real 30-min slot beats "we'll email you
              back", which is where most demo requests quietly die. Secondary
              and BESIDE the trial rather than under it: two brand-accent
              buttons stacked is a hero with no primary action, but two buttons
              in a row with one filled and one outlined reads as a choice. */}
          <DemoBooking variant="secondary" />
        </div>
      </div>

      {/* Tabbed feature preview */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex justify-center gap-2 mb-8 flex-wrap">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === activeTab;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground border border-border hover:border-primary/40"
                }`}
              >
                <Icon size={16} />
                {t(`hero.tabs.${tab.key}.label`)}
              </button>
            );
          })}
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-sm p-8 sm:p-12 grid sm:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-2xl font-semibold text-foreground">
              {t(`hero.tabs.${active.key}.headline`)}
            </h3>
            <p className="mt-3 text-muted-foreground leading-relaxed">
              {t(`hero.tabs.${active.key}.body`)}
            </p>
          </div>
          {/* One slot, two states. A tab with a picture shows it; a tab without
              keeps the placeholder this replaced, because half a set of real
              images is better than four with two of them lying.

              `priority` on the quotes image alone: it is the tab that opens, so
              it is above the fold on first paint. Marking all four would make
              them compete for the same bandwidth and slow the one that shows. */}
          {active.image ? (
            <Image
              src={active.image}
              alt={t(`hero.tabs.${active.key}.alt`)}
              width={active.width}
              height={active.height}
              // The panel is half of a max-w-5xl grid on desktop and full width
              // below it. Told explicitly, so the browser picks a source before
              // layout rather than fetching the widest one and throwing it away.
              sizes="(min-width: 640px) 50vw, 100vw"
              priority={active.key === "quotes"}
              className="w-full h-auto rounded-xl border border-border"
            />
          ) : (
            <div className="aspect-video bg-linear-to-br from-primary/10 via-muted to-brand-accent/10 rounded-xl border border-border flex items-center justify-center">
              <active.icon size={48} className="text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
