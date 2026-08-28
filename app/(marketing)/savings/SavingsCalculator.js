// app/(marketing)/savings/SavingsCalculator.js
//
// The calculator itself. All of the arithmetic and every coefficient live in
// lib/marketing/savings.js; this file decides only what is on the screen.
//
// ── Nothing is pre-filled ───────────────────────────────────────────────────
//
// Every box starts empty and there is no total until the required ones are
// answered. The tempting version seeds "4 employees, 8 jobs, 5,000 a job" so
// the page has a number on it when it loads — and that number is a claim about
// a business nobody described. Placeholders show the SHAPE of an answer
// ("e.g. 8") without ever being submitted as one.
//
// ── Why no currency symbol appears anywhere ─────────────────────────────────
//
// This page cannot know what money the visitor thinks in, and /pricing already
// settled how that is handled: the prices are the same NUMBER in Canadian and
// US dollars rather than a conversion, and which one you are billed in is
// decided by the business address you give at signup. There is no IP geo guess
// here — that was removed from /pricing deliberately and must not come back
// through a side door. So the figures are printed bare, with one sentence
// under them saying what money they are in and why we cannot say more.
"use client";

import { useState } from "react";
import Link from "next/link";

import {
  INPUT_FIELDS,
  ASSUMPTIONS,
  NOT_COUNTED,
  SAVINGS_DISCLOSURE,
  LADDER_CEILING,
  estimateSavings,
  formatAmount,
} from "@/lib/marketing/savings";

const EMPTY = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, ""]));

const PLACEHOLDERS = {
  seats: "e.g. 2",
  crew: "e.g. 4",
  projectsPerMonth: "e.g. 8",
  averageProjectValue: "e.g. 5000",
  adminHoursPerWeek: "e.g. 6",
  hourlyCost: "e.g. 45",
  quotesPerMonth: "e.g. 14",
};

const BASIS_NOTE = {
  arithmetic: "A definition",
  product: "Read off our own price list",
  estimate: "Our estimate, biased low",
};

function Field({ field, value, invalid, onChange }) {
  const id = `savings-${field.key}`;

  if (field.kind === "choice") {
    return (
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-foreground">{field.label}</legend>
        <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {field.options.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-2 rounded-xl border p-3 text-sm cursor-pointer ${
                value === option.value ? "border-primary bg-accent" : "border-border"
              }`}
            >
              <input
                type="radio"
                name={field.key}
                className="mt-1"
                value={option.value}
                checked={value === option.value}
                onChange={(e) => onChange(field.key, e.target.value)}
              />
              <span className="text-foreground">{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {field.label}
        {field.required ? null : (
          <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>
        )}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={field.min}
        max={field.max}
        value={value}
        placeholder={PLACEHOLDERS[field.key] || ""}
        onChange={(e) => onChange(field.key, e.target.value)}
        className={`mt-1.5 w-full rounded-lg border bg-card px-3 py-2 text-foreground ${
          invalid ? "border-red-500" : "border-border"
        }`}
      />
      <p className="mt-1 text-xs text-muted-foreground">{field.help}</p>
      {/* An out-of-range answer is REFUSED, not clamped. Clamping would print a
          total built on a number the visitor never typed. */}
      {invalid ? (
        <p className="mt-1 text-xs text-red-600">
          Needs to be between {formatAmount(field.min)} and {formatAmount(field.max)} — we
          would rather ask again than guess what you meant.
        </p>
      ) : null}
    </div>
  );
}

export default function SavingsCalculator() {
  const [answers, setAnswers] = useState(EMPTY);
  const onChange = (key, value) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const result = estimateSavings(answers);
  const invalid = new Set(result.outOfRange);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <header className="max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          What would FieldQuo be worth to you?
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Seven answers, three line items, and every coefficient behind them published
          further down the page. We have deliberately left out the things we cannot put
          an honest number on, and they are listed too.
        </p>
      </header>

      {/* ── The questions ──────────────────────────────────────────────── */}
      <section className="mt-10 rounded-2xl border border-border p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">Your business</h2>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {INPUT_FIELDS.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={answers[field.key]}
              invalid={invalid.has(field.key)}
              onChange={onChange}
            />
          ))}
        </div>
      </section>

      {/* ── The estimate ───────────────────────────────────────────────── */}
      <section className="mt-8">
        {!result.ready ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            <p className="text-foreground font-medium">No figure yet.</p>
            <p className="mt-2 text-sm">
              {result.outOfRange.length
                ? "One of the answers above is outside what we can read. Nothing is estimated from a number we had to invent."
                : "Fill in the questions above and the estimate appears here. We will not show you a number built on answers you have not given."}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-foreground">
                What we think it is worth, a year
              </h2>

              <ul className="mt-6 divide-y divide-border">
                {result.lines.map((line) => (
                  <li key={line.key} className="py-4 flex flex-wrap gap-x-6 gap-y-2">
                    <div className="flex-1 min-w-[16rem]">
                      <p className="font-medium text-foreground">{line.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{line.mechanism}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{line.workings}</p>
                    </div>
                    <div className="text-xl font-semibold text-foreground tabular-nums">
                      {formatAmount(line.amount)}
                    </div>
                  </li>
                ))}
              </ul>

              {/* A line we did NOT estimate is shown, with the reason. Dropping
                  it silently would leave two visitors comparing totals built
                  from different numbers of line items. */}
              {result.omitted.map((o) => (
                <div key={o.key} className="mt-4 rounded-xl bg-muted p-4">
                  <p className="text-sm font-medium text-foreground">
                    Not estimated: {o.label}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{o.reason}</p>
                </div>
              ))}

              <div className="mt-6 pt-6 border-t border-border flex flex-wrap items-baseline justify-between gap-4">
                <span className="text-base font-semibold text-foreground">
                  Estimated saving, a year
                </span>
                <span className="text-3xl font-bold text-foreground tabular-nums">
                  {formatAmount(result.total)}
                </span>
              </div>

              {result.capped ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Held to {formatAmount(result.annualRevenue)} — the work you told us you
                  invoice in a year. On the answers given, the lines above added up to more
                  than that, and a tool claiming to save a business more than it turns over
                  has stopped describing that business.
                </p>
              ) : null}

              <p className="mt-4 text-sm text-muted-foreground">
                All figures are in your own money. Our prices are the same number in
                Canadian and US dollars rather than a conversion, and which one you are
                billed in comes from the business address you give at signup — this page
                has no way of knowing it, and does not guess.
              </p>
            </div>

            {/* ── Against what it costs ───────────────────────────────── */}
            <div className="mt-6 rounded-2xl border border-border p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-foreground">Against what it costs</h2>
              {result.cost.fits ? (
                <>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm text-muted-foreground">Plan that fits you</dt>
                      <dd className="text-foreground font-medium">
                        {result.cost.label} — {formatAmount(result.cost.monthly)} a month
                      </dd>
                      <dd className="mt-1 text-xs text-muted-foreground">
                        {result.cost.includedSeats} writing quotes and invoices,{" "}
                        {result.cost.includedCrew} crew included free.
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">A year, month by month</dt>
                      <dd className="text-foreground font-medium tabular-nums">
                        {formatAmount(result.cost.yearAtMonthly)}
                      </dd>
                      <dd className="mt-1 text-xs text-muted-foreground">
                        Committing to a year is {formatAmount(result.cost.yearCommitted)} —
                        pay for {result.cost.payForMonths}, get {result.cost.monthsPerYear}.
                        The comparison below uses the higher, monthly figure.
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {result.paysForItself ? "Left over" : "Short by"}
                      </dt>
                      <dd className="text-foreground font-medium tabular-nums">
                        {formatAmount(Math.abs(result.netAfterCost))}
                      </dd>
                      <dd className="mt-1 text-xs text-muted-foreground">
                        {result.paysForItself
                          ? "What the estimate above is worth after the subscription."
                          : "On these answers it does not pay for itself, and we would rather say so than hide the comparison."}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    href="/pricing"
                    className="mt-5 inline-block text-sm underline text-foreground"
                  >
                    See what is in every plan
                  </Link>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  The published plans go up to {LADDER_CEILING.seats} people writing quotes
                  and invoices and {LADDER_CEILING.crew} crew. You are past that, so there
                  is no price on the list to compare against and we will not invent one —{" "}
                  <Link href="/contact" className="underline text-foreground">
                    talk to us
                  </Link>
                  .
                </p>
              )}
            </div>
          </>
        )}
      </section>

      {/* ── What we did not count ──────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">
          Things we did not put a number on
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          These are real and included. They are missing from the total because any figure
          we gave them would have been made up.
        </p>
        <ul className="mt-4 space-y-3">
          {NOT_COUNTED.map((item) => (
            <li key={item.subject} className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium text-foreground">{item.subject}</p>
              <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── The assumptions ────────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">
          Every number behind the estimate
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{SAVINGS_DISCLOSURE.headline}</span>{" "}
          {SAVINGS_DISCLOSURE.body}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3 font-medium text-foreground">What it is</th>
                <th className="p-3 font-medium text-foreground">Value</th>
                <th className="p-3 font-medium text-foreground">Why that value</th>
              </tr>
            </thead>
            <tbody>
              {ASSUMPTIONS.map((row) => (
                <tr key={row.key} className="border-t border-border align-top">
                  <td className="p-3">
                    <p className="text-foreground font-medium">{row.label}</p>
                    <p className="mt-1 text-muted-foreground">{row.represents}</p>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <p className="text-foreground font-semibold tabular-nums">{row.display}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {BASIS_NOTE[row.basis]}
                    </p>
                  </td>
                  <td className="p-3 text-muted-foreground">{row.reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 rounded-2xl border border-border p-6 sm:p-8 text-center">
        <p className="text-foreground font-medium">
          The honest way to check any of this is on your own jobs.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          The first month is free, and there is no contract.
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-primary-foreground font-medium"
        >
          Start free
        </Link>
      </div>
    </div>
  );
}
