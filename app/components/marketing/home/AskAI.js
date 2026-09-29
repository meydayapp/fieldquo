// app/components/marketing/home/AskAI.js
//
// Section 7: FieldQuo AI. Example QUESTIONS only — no drawn answer. An answer
// would have to contain numbers, and a made-up "your best job made $4,120"
// on a marketing page is an invented metric wearing a chat bubble. The
// questions are the kind the assistant is built for (lib/ai tools read the
// company's jobs, quotes, invoices and expenses), and the body says the rule
// non-negotiable #8 sets: it answers about your company's data only.
//
// Navy, for rhythm between two white sections. Text on it is
// primary-foreground (white) and primary-foreground/80, which
// check:marketing-contrast composites over #06356b and measures.
"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

const QUESTIONS = ["profitable", "followUp", "materials", "owed"];

export default function AskAI() {
  const { t } = useTranslation();

  return (
    <section className="bg-primary">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 grid gap-10 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-brand-accent-foreground">
            <Sparkles size={14} aria-hidden="true" />
            {t("home.ai.badge")}
          </span>
          <h2 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-primary-foreground text-balance">
            {t("home.ai.title")}
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-primary-foreground/80 text-pretty">{t("home.ai.body")}</p>
          <Link
            href="/features/fieldquo-ai"
            className="mt-6 inline-flex min-h-[44px] items-center gap-1.5 font-semibold text-primary-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-foreground"
          >
            {t("home.ai.cta")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>

        <div>
          <h3 className="sr-only">{t("home.ai.examples")}</h3>
          <ul className="space-y-3">
            {/* A static class list (odd/even variants for the stagger), so
                check:marketing-contrast can see these bubbles are bg-card and
                measure the text on them against white, not the navy behind. */}
            {QUESTIONS.map((key) => (
              <li
                key={key}
                className="flex items-start gap-3 rounded-2xl bg-card px-5 py-4 text-foreground shadow-lg shadow-black/10 sm:odd:mr-10 sm:even:ml-10"
              >
                <Sparkles size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-accent-text" />
                <span className="font-medium">{t(`home.ai.q.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
