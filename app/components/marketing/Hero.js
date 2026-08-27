// app/components/marketing/Hero.js
"use client";

import { useState } from "react";
import Image from "next/image";
import { FileText, Calendar, Receipt, BarChart3 } from "lucide-react";
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

        {/* Book a live demo — a real 30-min slot beats "we'll email you back",
            which is where most demo requests quietly die. */}
        <DemoBooking />
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
