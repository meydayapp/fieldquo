// app/components/marketing/Hero.js
"use client";

import { useState } from "react";
import { FileText, Calendar, Receipt, BarChart3 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import DemoBooking from "./DemoBooking";

// Keys and icons only — copy lives in the catalog under hero.tabs.*
const TABS = [
  { key: "quotes", icon: FileText },
  { key: "scheduling", icon: Calendar },
  { key: "invoicing", icon: Receipt },
  { key: "analytics", icon: BarChart3 },
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
          {/* Placeholder visual — swap for a real screenshot/illustration per tab once the app UI exists */}
          <div className="aspect-video bg-linear-to-br from-primary/10 via-muted to-brand-accent/10 rounded-xl border border-border flex items-center justify-center">
            <active.icon size={48} className="text-muted-foreground" />
          </div>
        </div>
      </div>
    </section>
  );
}
