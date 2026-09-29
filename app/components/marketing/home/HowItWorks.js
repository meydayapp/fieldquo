// app/components/marketing/home/HowItWorks.js
//
// Section 4: the pipeline AGENTS.md says the product exists to serve, in the
// order a contractor lives it. Six steps and no links: every step names a
// part of FieldQuo that exists (lead inbox, quotes, scheduling, time clock,
// photos and checklists, online payment, job costing), and the outcome groups
// two sections down are where each one is linked to its own page.
"use client";

import { PhoneIncoming, FileText, CalendarDays, HardHat, CreditCard, BarChart3 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const STEPS = [
  { key: "lead", icon: PhoneIncoming },
  { key: "quote", icon: FileText },
  { key: "schedule", icon: CalendarDays },
  { key: "work", icon: HardHat },
  { key: "paid", icon: CreditCard },
  { key: "numbers", icon: BarChart3 },
];

export default function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="how-it-works" className="scroll-mt-20 bg-card border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
            {t("home.how.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">{t("home.how.subtitle")}</p>
        </div>

        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.key} className="relative rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <step.icon size={20} aria-hidden="true" />
                </span>
                <span className="text-sm font-semibold text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">{t(`home.how.${step.key}.title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`home.how.${step.key}.body`)}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
