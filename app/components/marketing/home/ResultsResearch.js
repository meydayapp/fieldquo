// app/components/marketing/home/ResultsResearch.js
//
// Section 3: results — in three kinds, kept visibly apart.
//
//   1. Promises with no number in them. What FieldQuo is built to do.
//   2. Facts about FieldQuo that the code makes true: one platform, every
//      feature on every plan, the trial line from lib/pricing.js.
//   3. Industry research, ATTRIBUTED, in its own panel with its source under
//      it. Shares of 54 surveyed contractors reporting an improvement — never
//      FieldQuo's results and never the size of the improvement. See
//      research.js for the figures and why they are worded as they are.
//
// There is no customer count, logo wall or testimonial here because FieldQuo
// has none it can stand behind yet. Absence of a statement is not a
// statement (AGENTS.md, failure class 5), and an invented one on the page a
// stranger judges us by is the worst place to make one.
"use client";

import { CheckCircle2, Layers, Unlock } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { RESEARCH_SOURCE, RESEARCH_STATS } from "./research";
import TrialLine from "./TrialLine";

const PROMISES = ["volume", "overhead", "techs"];

export default function ResultsResearch() {
  const { t, language } = useTranslation();
  const locale = numberLocaleFor(language);

  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  // UTC, so the month cannot slip to March for a reader west of Greenwich.
  const published = new Date(
    Date.UTC(RESEARCH_SOURCE.published.year, RESEARCH_SOURCE.published.month - 1, 15),
  ).toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <section className="bg-muted border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <ul className="grid gap-4 sm:grid-cols-3">
          {PROMISES.map((key) => (
            <li key={key} className="flex items-start gap-3 rounded-2xl border border-border bg-card p-5">
              <CheckCircle2 size={22} aria-hidden="true" className="mt-0.5 shrink-0 text-primary" />
              <span className="text-lg font-semibold leading-snug text-foreground">
                {t(`home.results.promise.${key}`)}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8 rounded-3xl border border-border bg-card p-6 sm:p-10">
          <h2 className="max-w-3xl text-2xl sm:text-3xl font-bold tracking-tight text-foreground text-balance">
            {t("home.results.title")}
          </h2>
          <p className="mt-3 max-w-3xl text-muted-foreground text-pretty">{t("home.results.intro")}</p>

          {/* A list, number first: a screen reader hears "80% say their
              office handles more volume…" — the same sentence a sighted
              reader sees, with no label read apart from its figure. */}
          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
            {RESEARCH_STATS.map((stat) => (
              <li key={stat.key} className="border-l-2 border-brand-accent pl-4" data-research-stat={stat.key}>
                <span className="block text-3xl sm:text-4xl font-bold tracking-tight text-primary">
                  {stat.share != null ? percent.format(stat.share) : decimal.format(stat.average)}
                </span>{" "}
                <span className="mt-1 block text-sm leading-snug text-muted-foreground">
                  {t(`home.results.stat.${stat.key}`)}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-8 border-t border-border pt-5 text-sm text-muted-foreground" data-research-source>
            {t("home.results.source", {
              report: RESEARCH_SOURCE.report,
              count: RESEARCH_SOURCE.contractors,
              date: published,
            })}
          </p>
        </div>

        <ul className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-semibold text-foreground">
          <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Layers size={16} aria-hidden="true" className="text-primary" />
            {t("home.results.fact.onePlatform")}
          </li>
          <li className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
            <Unlock size={16} aria-hidden="true" className="text-primary" />
            {t("home.results.fact.allFeatures")}
          </li>
          <li className="inline-flex items-center rounded-full border border-border bg-card px-4 py-2">
            <TrialLine />
          </li>
        </ul>
      </div>
    </section>
  );
}
