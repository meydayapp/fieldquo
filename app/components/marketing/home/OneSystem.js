// app/components/marketing/home/OneSystem.js
//
// Section 8: why one system. The separate tools are named by CATEGORY, never
// by product — no competitor names on the homepage (/compare is where named
// comparisons live, with their sources). Every category on the left is a
// part of FieldQuo, so the arrow is a true statement: CRM (clients and
// leads), quotes, scheduling, invoicing, payments, team, website, AI.
"use client";

import { ArrowRight, ArrowDown, Check } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const TOOLS = ["crm", "quotes", "scheduling", "invoicing", "payments", "team", "website", "ai"];
const ONE = ["system", "record", "workflow"];

export default function OneSystem() {
  const { t } = useTranslation();

  return (
    <section className="bg-card border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground text-balance">
            {t("home.why.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-pretty">{t("home.why.body")}</p>
        </div>

        <div className="mt-12 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <div className="rounded-3xl border border-dashed border-border bg-muted p-5 sm:p-6">
            <div className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("home.why.before")}</div>
            <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
              {TOOLS.map((key, i) => (
                <li
                  key={key}
                  className={`rounded-xl border border-border bg-card px-3 py-3 text-center text-sm font-semibold text-foreground shadow-sm ${
                    i % 2 === 0 ? "-rotate-1" : "rotate-1"
                  }`}
                >
                  {t(`home.why.tool.${key}`)}
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-center text-muted-foreground" aria-hidden="true">
            <ArrowDown size={32} className="lg:hidden" />
            <ArrowRight size={32} className="hidden lg:block" />
          </div>

          <div className="rounded-3xl bg-primary p-6 sm:p-8">
            <div className="text-2xl font-bold tracking-tight text-primary-foreground">FieldQuo</div>
            <ul className="mt-5 space-y-3">
              {ONE.map((key) => (
                <li key={key} className="flex items-center gap-3 text-lg font-semibold text-primary-foreground">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-accent text-brand-accent-foreground">
                    <Check size={16} aria-hidden="true" />
                  </span>
                  {t(`home.why.one.${key}`)}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
