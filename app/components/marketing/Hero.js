// app/components/marketing/Hero.js
"use client";

import { useState } from "react";
import {
  FileText,
  Calendar,
  Receipt,
  BarChart3,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

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
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const active = TABS.find((t) => t.key === activeTab);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await fetch("/api/marketing/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source: "hero_demo_request" }),
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="bg-linear-to-b from-muted to-card">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground leading-tight">
          {t("hero.title")}
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-2xl mx-auto">
          {t("hero.subtitle")}
        </p>

        {/* Demo request — new company, no usage stats yet, so this replaces a stats band */}
        {!submitted ? (
          <form
            onSubmit={handleSubmit}
            className="mt-8 max-w-md mx-auto flex flex-col sm:flex-row gap-3"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("hero.emailPlaceholder")}
              className="flex-1 px-4 py-3 rounded-full border border-border text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center justify-center gap-2 bg-brand-accent text-brand-accent-foreground px-6 py-3 rounded-full text-sm font-semibold hover:brightness-95 transition disabled:opacity-60"
            >
              {submitting ? t("hero.sending") : t("hero.requestDemo")}
              <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div className="mt-8 max-w-md mx-auto bg-green-50 border border-green-200 text-green-800 text-sm rounded-full px-6 py-3">
            {t("hero.demoThanks")}
          </div>
        )}
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
