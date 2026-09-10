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
//
// ── This page used to be English on a nine-language site ───────────────────
//
// Every sentence below now comes from app/i18n/savingsPage/, keyed by the
// stable ids the module already had (a row's `key`, a line item's `key`, a
// field's `key`). The English fallback is written beside each key on purpose:
// it is what scripts/check-savings.mjs reads — that check runs under plain
// node with no React and no language context — and it is what a language
// missing a key renders instead of the raw key.
//
// The FIGURES are the other half of the same bug, and the more interesting
// one. They were grouped with a hardcoded "en-CA", so a French or Ukrainian
// reader was shown 12,500 where their language writes 12 500, and a German or
// Italian one 12,500 where they write 12.500. /pricing and /compare had this
// fixed already and both group through numberLocaleFor(language); this file
// now does the same, and every number reaches the sentence it sits in as a
// raw value tagged with what KIND of quantity it is (money, a count, minutes,
// days, a share) rather than as a pre-formatted English string. That is why
// the module hands back `workingsValues` instead of a finished sentence.
"use client";

import { useState } from "react";
import Link from "next/link";

import { useTranslation } from "@/app/hooks/useTranslation";
// The one locale table. /pricing and /compare read the same one — a second
// copy is the copy that goes stale, because it is the one nobody looks at.
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import {
  INPUT_FIELDS,
  ASSUMPTIONS,
  CURRENCY_NOTE,
  LINE_BUILDERS,
  NOT_COUNTED,
  AI_WITHOUT_AN_UPGRADE,
  SAVINGS_DISCLOSURE,
  LADDER_CEILING,
  estimateSavings,
  formatAmount,
} from "@/lib/marketing/savings";

const EMPTY = Object.fromEntries(INPUT_FIELDS.map((f) => [f.key, ""]));

// Counted, never typed. A header that says "seven answers" beside eight boxes
// is the smallest possible version of a control that lies, and it is the one
// that survives longest because nobody re-counts a sentence.
const QUESTION_COUNT = INPUT_FIELDS.filter((f) => f.required).length;
// Counted separately for the same reason, and it is a NEW way this sentence
// could go wrong: until quoteDeskMinutes there were no optional questions, so
// "N answers" and "N boxes" happened to be the same number. They are not any
// more, and a header saying "eight answers" over nine boxes is the exact
// defect the note above describes, arrived at from the other direction.
const OPTIONAL_COUNT = INPUT_FIELDS.filter((f) => !f.required).length;
const LINE_COUNT = LINE_BUILDERS.length;

// The example, not the answer. Still a bare number here rather than a string
// with "e.g." baked in: the words are translated, the digits are not, and
// joining them in the catalogue is what lets a language put its own
// abbreviation in front of (or after) the figure.
const PLACEHOLDERS = {
  seats: 2,
  crew: 4,
  quotesPerMonth: 16,
  // Deliberately NOT the fallback coefficient's own 120. A placeholder showing
  // the number we would have used reads as a pre-filled answer, and this file's
  // header is explicit that a placeholder shows the shape of an answer and is
  // never submitted as one.
  quoteDeskMinutes: 90,
  projectsPerMonth: 8,
  averageProjectValue: 5000,
  adminHoursPerWeek: 4,
  hourlyCost: 45,
};

const BASIS_NOTE = {
  arithmetic: ["marketing.savings.basis.arithmetic", "A definition"],
  product: ["marketing.savings.basis.product", "Read off our own price list"],
  reported: ["marketing.savings.basis.reported", "Contractors' own reported figures"],
  estimate: ["marketing.savings.basis.estimate", "Our estimate"],
};

/**
 * Everything that turns a raw quantity into the text a reader sees.
 *
 * Built once per render from the reader's language, and handed down rather
 * than imported, so there is exactly one place in this file that decides how a
 * number is punctuated. The alternative — each section calling toLocaleString
 * with its own options — is how /pricing and /compare each ended up with their
 * own copy of the locale table in the first place.
 */
function formatters(t, language) {
  const locale = numberLocaleFor(language);

  const num = (n) =>
    Number.isFinite(Number(n))
      ? Number(n).toLocaleString(locale, { maximumFractionDigits: 0 })
      : "0";

  // Percent through Intl rather than by appending "%": French writes "1,2 %"
  // with a space, German "1,2 %", English "1.2%". A hand-built string gets the
  // separator right and the spacing wrong, which is the half nobody checks.
  const percent = (v) =>
    new Intl.NumberFormat(locale, {
      style: "percent",
      maximumFractionDigits: 2,
    }).format(Number(v) || 0);

  // Plural category from the reader's own language, not from `=== 1`. English
  // and German need one/other; Ukrainian needs more, and asking Intl which
  // category applies is the difference between "1 хвилина" and "1 хвилин".
  // Falls back to `other` when a catalogue does not carry the category, which
  // is the honest degradation: a slightly wrong ending beats a raw key.
  const plurals = new Intl.PluralRules(locale);
  const withUnit = (n, unit) => {
    const category = plurals.select(Math.abs(Number(n) || 0));
    const key = `marketing.savings.unit.${unit}.${category}`;
    const fallbackKey = `marketing.savings.unit.${unit}.other`;
    const english = Number(n) === 1 ? `{n} ${unit.slice(0, -1)}` : `{n} ${unit}`;
    const resolved = t(key, null);
    const template = resolved === key ? fallbackKey : key;
    return t(template, english, { n: num(n) });
  };

  return { locale, num, percent, withUnit, money: (n) => formatAmount(n, locale) };
}

/**
 * One tagged value from a builder, rendered.
 *
 * `kind` is set in lib/marketing/savings.js beside the arithmetic that
 * produced the number, which is the only place that knows whether 12 is twelve
 * dollars, twelve months or twelve minutes. Rendering it here rather than
 * there is what keeps the language table out of the price maths.
 */
function renderSpec(spec, f, t) {
  if (!spec || typeof spec !== "object") return String(spec ?? "");
  if (spec.kind === "phrase") {
    return t(spec.key, mapSpecs(spec.values, f, t));
  }
  if (spec.kind === "money") return f.money(spec.n);
  if (spec.kind === "share") return f.percent(spec.n);
  if (spec.kind === "minutes") return f.withUnit(spec.n, "minutes");
  if (spec.kind === "days") return f.withUnit(spec.n, "days");
  return f.num(spec.n);
}

function mapSpecs(values, f, t) {
  const out = {};
  for (const [name, spec] of Object.entries(values || {})) {
    out[name] = renderSpec(spec, f, t);
  }
  return out;
}

/** An assumption row's value, in the reader's punctuation and words. */
function assumptionDisplay(row, f, t) {
  if (row.unit === "share") return f.percent(row.value);
  if (row.unit === "count") return f.num(row.value);
  if (row.unit === "minutes" || row.unit === "days") {
    return f.withUnit(row.value, row.unit);
  }
  // A unit nobody has taught the page. The module's own `display` is English
  // and is better than a blank cell — an invented rendering would be worse
  // than either.
  return row.display;
}

function Field({ field, value, invalid, onChange, f, t }) {
  const id = `savings-${field.key}`;
  const label = t(`marketing.savings.field.${field.key}.label`, field.label);
  const help = t(`marketing.savings.field.${field.key}.help`, field.help);

  if (field.kind === "choice") {
    return (
      <fieldset className="sm:col-span-2">
        <legend className="text-sm font-medium text-foreground">{label}</legend>
        <p className="mt-1 text-xs text-muted-foreground">{help}</p>
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
              <span className="text-foreground">
                {t(
                  `marketing.savings.field.${field.key}.option.${option.value}`,
                  option.label,
                )}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  const example = PLACEHOLDERS[field.key];

  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
        {field.required ? null : (
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            {t("marketing.savings.form.optional", "(optional)")}
          </span>
        )}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={field.min}
        max={field.max}
        value={value}
        placeholder={
          example === undefined
            ? ""
            : t("marketing.savings.form.placeholder", "e.g. {value}", {
                value: f.num(example),
              })
        }
        onChange={(e) => onChange(field.key, e.target.value)}
        className={`mt-1.5 w-full rounded-lg border bg-card px-3 py-2 text-foreground ${
          invalid ? "border-red-500" : "border-border"
        }`}
      />
      <p className="mt-1 text-xs text-muted-foreground">{help}</p>
      {/* An out-of-range answer is REFUSED, not clamped. Clamping would print a
          total built on a number the visitor never typed. */}
      {invalid ? (
        <p className="mt-1 text-xs text-red-600">
          {t(
            "marketing.savings.form.outOfRange",
            "Needs to be between {min} and {max} — we would rather ask again than guess what you meant.",
            { min: f.num(field.min), max: f.num(field.max) },
          )}
        </p>
      ) : null}
    </div>
  );
}

export default function SavingsCalculator() {
  const { t, language } = useTranslation();
  const f = formatters(t, language);
  const [answers, setAnswers] = useState(EMPTY);
  const onChange = (key, value) => setAnswers((prev) => ({ ...prev, [key]: value }));

  const result = estimateSavings(answers);
  const invalid = new Set(result.outOfRange);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <header className="max-w-2xl">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          {t("marketing.savings.page.title", "What would FieldQuo be worth to you?")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t(
            "marketing.savings.page.intro",
            "{required} answers plus {optional} you can give us if you know it, {lines} line items, and every coefficient behind them published further down the page — including where each one came from and which end of a range we took. We have deliberately left out the things we cannot put an honest number on, and they are listed too.",
            {
              required: f.num(QUESTION_COUNT),
              optional: f.num(OPTIONAL_COUNT),
              lines: f.num(LINE_COUNT),
            },
          )}
        </p>
      </header>

      {/* ── The questions ──────────────────────────────────────────────── */}
      <section className="mt-10 rounded-2xl border border-border p-6 sm:p-8">
        <h2 className="text-lg font-semibold text-foreground">
          {t("marketing.savings.form.title", "Your business")}
        </h2>
        {/* The currency answer, at the point the question is asked.
            Two of these boxes take money and neither of them carried a unit;
            the full statement below the total was the page's only mention of
            currency, and it does not render until an estimate exists — so a
            visitor typed money into two fields having been told nothing. */}
        <p className="mt-2 text-sm text-muted-foreground">
          {t("marketing.savings.currency.short", CURRENCY_NOTE.short)}
        </p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {INPUT_FIELDS.map((field) => (
            <Field
              key={field.key}
              field={field}
              value={answers[field.key]}
              invalid={invalid.has(field.key)}
              onChange={onChange}
              f={f}
              t={t}
            />
          ))}
        </div>
      </section>

      {/* ── The estimate ───────────────────────────────────────────────── */}
      <section className="mt-8">
        {!result.ready ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">
            <p className="text-foreground font-medium">
              {t("marketing.savings.empty.title", "No figure yet.")}
            </p>
            <p className="mt-2 text-sm">
              {result.outOfRange.length
                ? t(
                    "marketing.savings.empty.outOfRange",
                    "One of the answers above is outside what we can read. Nothing is estimated from a number we had to invent.",
                  )
                : t(
                    "marketing.savings.empty.unanswered",
                    "Fill in the questions above and the estimate appears here. We will not show you a number built on answers you have not given.",
                  )}
            </p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-foreground">
                {t("marketing.savings.estimate.title", "What we think it is worth, a year")}
              </h2>

              <ul className="mt-6 divide-y divide-border">
                {result.lines.map((line) => (
                  <li key={line.key} className="py-4 flex flex-wrap gap-x-6 gap-y-2">
                    <div className="flex-1 min-w-[16rem]">
                      <p className="font-medium text-foreground">
                        {t(`marketing.savings.line.${line.key}.label`, line.label)}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t(
                          `marketing.savings.line.${line.key}.mechanism`,
                          line.mechanism,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {/* `|| ""` is not defensive clutter: t() splits the
                            key on dots, so an undefined one throws inside
                            render and takes the whole page down. A builder
                            added without a key should print its English
                            workings, not a white screen. */}
                        {t(
                          line.workingsKey || "",
                          line.workings,
                          mapSpecs(line.workingsValues, f, t),
                        )}
                      </p>
                    </div>
                    <div className="text-xl font-semibold text-foreground tabular-nums">
                      {f.money(line.amount)}
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
                    {t("marketing.savings.estimate.notEstimated", "Not estimated: {label}", {
                      label: t(`marketing.savings.line.${o.key}.label`, o.label),
                    })}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t(o.reasonKey || "", o.reason, mapSpecs(o.reasonValues, f, t))}
                  </p>
                </div>
              ))}

              <div className="mt-6 pt-6 border-t border-border flex flex-wrap items-baseline justify-between gap-4">
                <span className="text-base font-semibold text-foreground">
                  {t("marketing.savings.estimate.total", "Estimated saving, a year")}
                </span>
                <span className="text-3xl font-bold text-foreground tabular-nums">
                  {f.money(result.total)}
                </span>
              </div>

              {result.capped ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  {t(
                    "marketing.savings.estimate.capped",
                    "Held to {revenue} — the work you told us you invoice in a year. On the answers given, the lines above added up to more than that, and a tool claiming to save a business more than it turns over has stopped describing that business.",
                    { revenue: f.money(result.annualRevenue) },
                  )}
                </p>
              ) : null}

              {/* Was a hand-written paragraph saying most of this in its own
                  words, while /pricing said it in different ones. One
                  exported string now, so the two cannot drift — and this is
                  the copy that carries the concrete half the calculator's
                  version was missing. */}
              <p className="mt-4 text-sm text-muted-foreground">
                {t("marketing.savings.currency.long", CURRENCY_NOTE.long)}
              </p>
            </div>

            {/* ── Against what it costs ───────────────────────────────── */}
            <div className="mt-6 rounded-2xl border border-border p-6 sm:p-8">
              <h2 className="text-lg font-semibold text-foreground">
                {t("marketing.savings.cost.title", "Against what it costs")}
              </h2>
              {result.cost.fits ? (
                <>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t("marketing.savings.cost.planLabel", "Plan that fits you")}
                      </dt>
                      <dd className="text-foreground font-medium">
                        {t("marketing.savings.cost.planValue", "{plan} — {monthly} a month", {
                          plan: result.cost.label,
                          monthly: f.money(result.cost.monthly),
                        })}
                      </dd>
                      <dd className="mt-1 text-xs text-muted-foreground">
                        {t(
                          "marketing.savings.cost.planSeats",
                          "{seats} writing quotes and invoices, {crew} crew included free.",
                          {
                            seats: f.num(result.cost.includedSeats),
                            crew: f.num(result.cost.includedCrew),
                          },
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {t("marketing.savings.cost.yearLabel", "A year, month by month")}
                      </dt>
                      <dd className="text-foreground font-medium tabular-nums">
                        {f.money(result.cost.yearAtMonthly)}
                      </dd>
                      <dd className="mt-1 text-xs text-muted-foreground">
                        {t(
                          "marketing.savings.cost.yearNote",
                          "Committing to a year is {committed} — pay for {payFor}, get {months}. The comparison below uses the higher, monthly figure.",
                          {
                            committed: f.money(result.cost.yearCommitted),
                            payFor: f.num(result.cost.payForMonths),
                            months: f.num(result.cost.monthsPerYear),
                          },
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm text-muted-foreground">
                        {result.paysForItself
                          ? t("marketing.savings.cost.leftOver", "Left over")
                          : t("marketing.savings.cost.shortBy", "Short by")}
                      </dt>
                      <dd className="text-foreground font-medium tabular-nums">
                        {f.money(Math.abs(result.netAfterCost))}
                      </dd>
                      <dd className="mt-1 text-xs text-muted-foreground">
                        {result.paysForItself
                          ? t(
                              "marketing.savings.cost.leftOverNote",
                              "What the estimate above is worth after the subscription.",
                            )
                          : t(
                              "marketing.savings.cost.shortByNote",
                              "On these answers it does not pay for itself, and we would rather say so than hide the comparison.",
                            )}
                      </dd>
                    </div>
                  </dl>
                  <Link
                    href="/pricing"
                    className="mt-5 inline-block text-sm underline text-foreground"
                  >
                    {t("marketing.savings.cost.plansLink", "See what is in every plan")}
                  </Link>
                </>
              ) : (
                // The sentence and the invitation are two keys, not one with a
                // link spliced into the middle of it. A {link} placeholder
                // inside a paragraph forces every language to put the clause
                // where English put it, and the languages this catalogue
                // carries do not agree about that.
                <>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {t(
                      "marketing.savings.cost.offLadder",
                      "The published plans go up to {seats} people writing quotes and invoices and {crew} crew. You are past that, so there is no price on the list to compare against and we will not invent one.",
                      {
                        seats: f.num(LADDER_CEILING.seats),
                        crew: f.num(LADDER_CEILING.crew),
                      },
                    )}
                  </p>
                  <Link
                    href="/contact"
                    className="mt-2 inline-block text-sm underline text-foreground"
                  >
                    {t("marketing.savings.cost.offLadderCta", "Talk to us")}
                  </Link>
                </>
              )}
            </div>

            {/* Not a line item, deliberately — there is no honest way to price
                it without guessing how many calls a business takes. It sits
                here because "included" and "included if you pay more" is the
                distinction a buyer is actually shopping on, and this one is a
                fact about our own price list rather than a claim about
                anybody's saving. */}
            <div className="mt-6 rounded-2xl border border-border bg-muted p-6 sm:p-8">
              <p className="text-foreground font-medium">
                {t("marketing.savings.ai.headline", AI_WITHOUT_AN_UPGRADE.headline)}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("marketing.savings.ai.body", AI_WITHOUT_AN_UPGRADE.body)}
              </p>
            </div>
          </>
        )}
      </section>

      {/* ── What we did not count ──────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">
          {t("marketing.savings.notCounted.title", "Things we did not put a number on")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "marketing.savings.notCounted.intro",
            "These are real and included. They are missing from the total because any figure we gave them would have been made up.",
          )}
        </p>
        <ul className="mt-4 space-y-3">
          {NOT_COUNTED.map((item) => (
            <li key={item.key} className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium text-foreground">
                {t(`marketing.savings.notCounted.${item.key}.subject`, item.subject)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`marketing.savings.notCounted.${item.key}.reason`, item.reason)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── The assumptions ────────────────────────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-foreground">
          {t("marketing.savings.assumptions.title", "Every number behind the estimate")}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {t("marketing.savings.disclosure.headline", SAVINGS_DISCLOSURE.headline)}
          </span>{" "}
          {t("marketing.savings.disclosure.body", SAVINGS_DISCLOSURE.body)}
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm border border-border rounded-xl overflow-hidden">
            <thead className="bg-muted text-left">
              <tr>
                <th className="p-3 font-medium text-foreground">
                  {t("marketing.savings.assumptions.colWhat", "What it is")}
                </th>
                <th className="p-3 font-medium text-foreground">
                  {t("marketing.savings.assumptions.colValue", "Value")}
                </th>
                <th className="p-3 font-medium text-foreground">
                  {t("marketing.savings.assumptions.colWhy", "Why that value")}
                </th>
              </tr>
            </thead>
            <tbody>
              {ASSUMPTIONS.map((row) => (
                <tr key={row.key} className="border-t border-border align-top">
                  <td className="p-3">
                    <p className="text-foreground font-medium">
                      {t(`marketing.savings.assumption.${row.key}.label`, row.label)}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {t(
                        `marketing.savings.assumption.${row.key}.represents`,
                        row.represents,
                      )}
                    </p>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <p className="text-foreground font-semibold tabular-nums">
                      {assumptionDisplay(row, f, t)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t(BASIS_NOTE[row.basis][0], BASIS_NOTE[row.basis][1])}
                    </p>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {t(`marketing.savings.assumption.${row.key}.reasoning`, row.reasoning)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 rounded-2xl border border-border p-6 sm:p-8 text-center">
        <p className="text-foreground font-medium">
          {t(
            "marketing.savings.cta.title",
            "The honest way to check any of this is on your own jobs.",
          )}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("marketing.savings.cta.body", "The first month is free, and there is no contract.")}
        </p>
        <Link
          href="/signup"
          className="mt-4 inline-block rounded-lg bg-primary px-5 py-2.5 text-primary-foreground font-medium"
        >
          {t("marketing.savings.cta.button", "Start free")}
        </Link>
      </div>
    </div>
  );
}
