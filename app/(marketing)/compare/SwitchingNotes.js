// app/(marketing)/compare/SwitchingNotes.js
//
// "Switching from <competitor>" and the questions that come with it — the
// migration notes and FAQ the site audit (2026-10-15, D5.3) asked the
// per-competitor pages to carry. Rendered on every /compare/<slug> page,
// below "what FieldQuo does not do" and above the closing ask.
//
// Every sentence rests on something in this repo, and none on anything we
// have not read about the competitor:
//
//   imports        the CSV imports — /app/clients/import, the price book
//                  import (/api/products/import), /app/jobs/import (past jobs).
//                  Nothing imports invoices or payment history, so the notes
//                  say so.
//   their export   NOT described. Whether and how a competitor exports to a
//                  spreadsheet is not something this repo has established, so
//                  the sentence is conditional ("if it lets you").
//   service        docs/MIGRATION-SERVICE.md — clients and quotes, created and
//                  never changed, after the company requests, accepts and pays.
//   trial          TRIAL_DAYS (lib/pricing.js).
//   brand          AGENTS.md: white-label by default — the quote, invoice and
//                  emails carry the company's logo, colour and name.
//   contract       app/api/platform/billing/cancel/route.js — a paid plan runs
//                  to the end of the period it paid for (the homepage FAQ's
//                  cancel answer says the same).
//   freshness      STALE_AFTER_DAYS (lib/marketing/competitors.js) — a figure
//                  stops publishing that many days after it was read.
"use client";

import { ArrowRight } from "lucide-react";
import FAQ from "@/app/components/marketing/FAQ";
import { TRIAL_DAYS } from "@/lib/pricing";
import { STALE_AFTER_DAYS } from "@/lib/marketing/competitors";
import { useTranslation } from "@/app/hooks/useTranslation";

const STEPS = ["csv", "service", "overlap", "notMoved"];

export default function SwitchingNotes({ competitorName }) {
  const { t } = useTranslation();
  const values = { competitor: competitorName, days: TRIAL_DAYS, staleDays: STALE_AFTER_DAYS };

  const faq = ["trial", "brand", "contract", "prices"].map((id) => ({
    id: `switch-${id}`,
    q: t(`compare.faq.${id}.q`, values),
    a: t(`compare.faq.${id}.a`, values),
  }));

  return (
    <>
      <div className="bg-card border-t border-border" data-compare-switching>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">
            {t("compare.switch.title", values)}
          </h2>
          <ul className="mt-6 space-y-4">
            {STEPS.map((key) => (
              <li key={key} className="flex items-start gap-3 text-foreground leading-relaxed">
                <ArrowRight size={18} aria-hidden="true" className="mt-1 shrink-0 text-primary" />
                <span>{t(`compare.switch.${key}`, values)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <FAQ items={faq} title={t("compare.faq.title")} />
    </>
  );
}
