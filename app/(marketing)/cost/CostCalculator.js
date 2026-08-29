// app/(marketing)/cost/CostCalculator.js
//
// The two questions, the explainer, and the report.
//
// ── Nothing is pre-filled ───────────────────────────────────────────────────
//
// Both boxes start empty and there are no figures until both are answered. The
// tempting version seeds "2 in the office, 8 in the field" so the page has
// numbers on it when it loads — and those numbers are a claim about a business
// nobody described, sitting under five real companies' prices. Placeholders
// show the SHAPE of an answer without ever being submitted as one. Same rule as
// /savings, and the same reason: AGENTS.md failure class 5.
//
// ── Why the split ───────────────────────────────────────────────────────────
//
// This half owns the form state and the real t() out of React context. The
// other half, ./CostReport.js, owns everything that is a claim about somebody's
// prices and takes `t` as a prop — so scripts/check-cost-compare.mjs renders
// the REAL component with renderToStaticMarkup and asserts against the markup,
// rather than reading this file's source and inferring what it would do. An
// agent on this repo shipped 75 passing assertions over a page that ignored the
// function they tested; that is the failure this split is against.
"use client";

import { useState } from "react";

import { useTranslation } from "@/app/hooks/useTranslation";
import { INPUT_FIELDS, SEAT_VS_CREW, compareCosts, formatAmount } from "@/lib/marketing/costCompare";
import { renderAsOf } from "../compare/asOf";

import CostReport from "./CostReport";

const EMPTY = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, ""]));

const PLACEHOLDERS = {
  officeSeats: "e.g. 2",
  fieldCrew: "e.g. 8",
};

function Field({ field, value, invalid, onChange, t }) {
  const id = `cost-${field.key}`;
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {t(`cost.field.${field.key}.label`, field.label)}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={field.min}
        max={field.max}
        value={value}
        placeholder={PLACEHOLDERS[field.key] || ""}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={`mt-1.5 w-full rounded-lg border bg-card px-3 py-2 text-foreground ${
          invalid ? "border-red-700 dark:border-red-400" : "border-border"
        }`}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        {t(`cost.field.${field.key}.help`, field.help)}
      </p>
      {/* An out-of-range answer is REFUSED, not clamped. Clamping would price
          five companies against a number the visitor never typed. */}
      {invalid ? (
        <p className="mt-1 text-xs text-red-700 dark:text-red-400">
          {t(
            "cost.fieldRange",
            "Needs to be between {min} and {max} — we would rather ask again than guess what you meant.",
            { min: formatAmount(field.min), max: formatAmount(field.max) },
          )}
        </p>
      ) : null}
    </div>
  );
}

export default function CostCalculator({ asOf = renderAsOf() }) {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState(EMPTY);
  const onChange = (key, value) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const result = compareCosts(answers, { asOf });
  const invalid = new Set(result.outOfRange);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <header className="max-w-3xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          {t("cost.title", "What would each of them charge you?")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t(
            "cost.lede",
            "Two questions, five real companies, and every figure read off somebody's own pricing page — with the ones we will not print showing the reason instead of a blank. Where a competitor is cheaper than we are, this page says so.",
          )}
        </p>
      </header>

      {/* ── The paragraph that makes the rest of the page mean anything ──── */}
      <section className="mt-8 rounded-2xl border border-border bg-muted p-6 sm:p-8" data-seat-vs-crew>
        <h2 className="font-semibold text-foreground">
          {t("cost.seatVsCrew.headline", SEAT_VS_CREW.headline)}
        </h2>
        <p className="mt-3 text-muted-foreground">
          {t("cost.seatVsCrew.body", SEAT_VS_CREW.body)}
        </p>
      </section>

      <section className="mt-8 rounded-2xl border border-border p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">
          {t("cost.yourBusiness", "Your business")}
        </h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {INPUT_FIELDS.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={answers[field.key]}
              invalid={invalid.has(field.key)}
              onChange={onChange}
              t={t}
            />
          ))}
        </div>
      </section>

      <CostReport result={result} t={t} />
    </div>
  );
}
