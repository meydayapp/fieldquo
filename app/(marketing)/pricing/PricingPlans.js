// app/(marketing)/pricing/PricingPlans.js
//
// The plan grid. Client half of /pricing — split from page.js because
// translation lives in React context while the Prisma read and the metadata
// export have to stay on the server. Same shape as /industries/[slug].
//
// Before this split the whole page was hardcoded English on an otherwise
// six-language site, and it printed "$45" with nothing anywhere on the page
// saying what money that was. The note under the grid is now what answers
// that, and it answers it with the address rule rather than with a geo guess.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import AiPlanAdvisor from "@/app/components/billing/AiPlanAdvisor";
import { recommendAiPlan } from "@/lib/ai/planAdvice";
import { CheckCircle2 } from "lucide-react";
import CustomSeatPicker, { pickedTier } from "@/app/components/billing/CustomSeatPicker";
import PlanOfferPrice, { OfferRibbon, offerMoney, yearTabLabel } from "@/app/components/billing/PlanOfferPrice";
import { yearTabSaving } from "@/lib/pricing/planOffer";
import { currencyMeta } from "@/lib/currency";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";
import { featureEntry } from "@/lib/marketing/featureLabels";
import { COMPETITORS } from "@/lib/marketing/competitors";
import AddOnStack from "../compare/AddOnStack";
import { addOnStack } from "../compare/addOns";
import { renderAsOf } from "../compare/asOf";
import { PROCESSING_RATES } from "@/lib/stripe/processingFee";
import {
  INCLUDED_VIDEOS_PER_MONTH,
  VIDEO_MAX_SECONDS,
  VIDEO_PACK,
  formatClipLength,
  formatPackPrice,
} from "@/lib/marketing/videoAllowance";
import { peopleLines } from "@/lib/pricing/peopleLines";

/**
 * How many columns the plan grid gets, given how many plans exist.
 *
 * It was hardcoded to three. There are four plans, so the most expensive one —
 * the $700 tier, the one worth the most per signup — sat alone on a second row
 * beside two card-widths of dead space.
 *
 * Rule: up to four plans go on one row; beyond that, pick the widest layout
 * whose LAST row is fullest, so the orphan is never a single card. Pure, and
 * exercised over 1..12 by scripts/check-pricing-page.mjs. (It named
 * check-pricing-grid.mjs, which has never existed in this repo — so the
 * comment was the only thing exercising it.)
 */
export function pricingColumns(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 1) return 1;
  if (n <= 4) return n;

  let best = 4;
  let fullestLastRow = -1;
  for (const columns of [4, 3, 2]) {
    const lastRow = n % columns === 0 ? columns : n % columns;
    if (lastRow > fullestLastRow) {
      fullestLastRow = lastRow;
      best = columns;
    }
  }
  return best;
}

// Tailwind scans source for complete class names, so these cannot be built by
// string concatenation — `lg:grid-cols-${n}` produces no CSS at all.
// ── What $99 actually buys, said on the page that asks for it ─────────────
//
// The cards said "6 employee accounts · AI copilot included" and nothing else.
// The owner read that back as a customer would: "oh i'm paying $100 for what,
// access to 9 employees and ai copilot? what is that?" He is right. A seat
// count describes what you are LIMITED to; it does not name one thing the
// product does.
//
// The competitor stacks six named features per tier and makes you climb for
// the good ones — job costing and two-way SMS are three tiers up. We cannot
// copy that ladder because our tiers are identical in features, and that is
// the stronger position rather than the weaker one: everything below is in
// Solo at $99, not four rungs above it.
//
// KEYS ONLY. Every label is read at render time through
// lib/marketing/featureLabels.js, which resolves the key against the message
// catalogue in the visitor's language and falls back to
// lib/marketing/featureMatrix.js — where each entry carries the file paths that
// implement it and a check asserts those paths still contain what they claim.
// So a pricing page cannot name a feature this product does not ship, and
// cannot drift from the wording on /features/<slug> either. featureEntry()
// returns undefined for an unknown key, so a typo here fails the build rather
// than printing a blank bullet.
//
// The `t` handed to featureEntry is what fixes the reported bug: these headings
// were translating and the bullets under them were not, because the headings
// came from t() and the names came straight off the English matrix.
const HEADLINE_FEATURES = [
  {
    titleKey: "pricing.group.winning",
    fallback: "Winning the work",
    keys: [
      "quotes",
      "ai_quote_review",
      "voice_receptionist",
      "call_to_quote",
      "instant_quotes",
      "add_on_upsell",
      "follow_ups",
      "booking_page",
      "website_builder",
    ],
  },
  {
    titleKey: "pricing.group.doing",
    fallback: "Doing the job",
    keys: [
      "scheduling",
      "jobs",
      "job_costing",
      "materials",
      "job_photos",
      "time_clock",
      "crew_inbox",
    ],
  },
  {
    titleKey: "pricing.group.paid",
    fallback: "Getting paid",
    keys: [
      "invoices",
      "card_payments",
      "financing",
      "invoice_changes",
      "client_portal",
      "sales_tax",
    ],
  },
  {
    titleKey: "pricing.group.running",
    fallback: "Running the business",
    keys: [
      "payroll",
      "break_even",
      "price_book",
      "expenses",
      "ai_copilot",
      "white_label",
      "team_access",
    ],
  },
];

function IncludedEverywhere({ t }) {
  return (
    <div className="mt-14">
      <div className="text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-foreground">
          {t("pricing.includedTitle", "All of it is in every plan")}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t(
            "pricing.includedBody",
            "There is no tier that unlocks job costing, no upgrade for the AI, no add-on for taking payment. The plans differ by how many people work in them — nothing else.",
          )}
        </p>
      </div>

      <div className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {HEADLINE_FEATURES.map((group) => (
          <div key={group.titleKey}>
            <h3 className="font-semibold text-foreground">
              {t(group.titleKey, group.fallback)}
            </h3>
            <ul className="mt-3 space-y-2">
              {group.keys.map((key) => {
                const entry = featureEntry(key, t);
                return (
                  <li
                    key={key}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <CheckCircle2
                      size={15}
                      className="text-green-600 shrink-0 mt-0.5"
                    />
                    <span className="text-foreground">{entry.name}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        {t(
          "pricing.includedMore",
          "That is the short list. See everything FieldQuo does →",
        )}{" "}
        <Link href="/features" className="underline font-medium text-foreground">
          /features
        </Link>
      </p>
    </div>
  );
}

/**
 * "…and here is what the other lot bills you separately for."
 *
 * ══ Why this belongs on /pricing and not only on /compare ══════════════════
 *
 * The block above says everything is in every plan. That is true and it is
 * abstract: a visitor has no way to price the sentence. The competitor's own
 * pricing page does it for us — three functions sold as monthly add-ons on top
 * of a plan, each with a price they publish themselves. Set beside "all of it
 * is in every plan", the sentence acquires a number.
 *
 * Every figure goes through withholdReason() and the total through the same
 * module the comparison pages use, so this page cannot print an amount
 * /compare would refuse, and the two cannot come to disagree. The whole block
 * is derived: a competitor whose add-on prices nobody has read renders nothing.
 *
 * ══ Why the date is taken at render ════════════════════════════════════════
 *
 * withholdReason needs an `asOf` and refuses to guess one — the argument is in
 * ../compare/asOf.js and the short version is that a pinned date switches off
 * the 90-day staleness rule while leaving its label on. This is a client
 * component, but /pricing is `force-dynamic`, so the server renders it per
 * request and the browser hydrates seconds later. The only thing the date
 * decides here is whether the block exists at all, which changes on one day in
 * ninety, so the two renders cannot show a visitor different prices.
 */
function AddOnComparison({ t, asOf, locale }) {
  const stacks = COMPETITORS.filter((c) => addOnStack(c.id, asOf).refusal === null);
  if (stacks.length === 0) return null;

  return (
    <>
      {stacks.map((c) => (
        <AddOnStack
          key={c.id}
          competitorId={c.id}
          competitorName={c.name}
          asOf={asOf}
          t={t}
          locale={locale}
        />
      ))}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {t(
          "pricing.addOnsCompare",
          "Every figure above was read off their own pricing page, on the date shown. The full side-by-side, including what FieldQuo does not do, is here →",
        )}{" "}
        <Link href="/compare" className="underline font-medium text-foreground">
          /compare
        </Link>
      </p>
    </>
  );
}

const COLUMN_CLASS = {
  1: "sm:grid-cols-1 lg:grid-cols-1 max-w-sm mx-auto",
  2: "sm:grid-cols-2 lg:grid-cols-2 max-w-3xl mx-auto",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
};

/**
 * What the buy button points at.
 *
 * ══ The tier, never the row ════════════════════════════════════════════════
 *
 * Every rung exists twice in the Plan table, once per currency, and the ids
 * differ. `/signup?plan=<id>` therefore hard-binds the link to whichever row
 * this page happened to render — so a visitor in Buffalo clicking the card
 * we built from the CAD row arrived at signup with the CAD row selected, on a
 * page whose whole design is that the address decides the currency.
 *
 * `?tier=<tierKey>` names the rung and says nothing about money. Signup
 * resolves it against the currency it works out from the business address,
 * three steps before the plan step (see resolvePlanSelection in
 * app/signup/page.js).
 *
 * A legacy per-headcount row has no tierKey — there is no tier to name — so it
 * keeps the id form. Those rows are currency-agnostic in practice (one row, not
 * a pair), which is exactly the case the id form is safe for.
 */
export function signupHref(plan) {
  return plan?.tierKey
    ? `/signup?tier=${encodeURIComponent(plan.tierKey)}`
    : `/signup?plan=${encodeURIComponent(plan?.id ?? "")}`;
}

// peopleLines lives in lib/pricing/peopleLines.js (the homepage uses it too)
// and is re-exported for check:pricing-page.
export { peopleLines };

/**
 * The fifth card: "Need more people? Build a custom plan."
 *
 * Scale is the floor and a hundred people the ceiling — the owner's rule,
 * derived in lib/pricing/ladder.js (customTier) and repeated nowhere else:
 * the price on this card comes from that function, with the Scale row this
 * page already renders as its base, so it is the price the row will carry.
 * The buy link names the SIZE (`?tier=custom-20`), not a row or a price,
 * exactly as the rung cards do; signup resolves it against the currency it
 * works out from the address.
 */
function CustomPlanCard({ offer, t, price, interval, locale }) {
  const [seats, setSeats] = useState(20);
  if (!offer) return null;
  const tier = pickedTier(offer, seats);
  const symbol = currencyMeta(offer.currency).symbol;
  // This size's figures on the chosen tab, resolved on the server for every
  // size (lib/billing/promotions.js customOfferTable). A year this size cannot
  // be sold on falls back to its monthly offer rather than a blank card.
  const sizeOffers = tier ? offer.offers?.[tier.seats] || null : null;
  const cardOffer = sizeOffers?.[interval]?.available ? sizeOffers[interval] : sizeOffers?.month || null;
  return (
    <div id="custom" className="relative overflow-hidden mt-6 border border-border rounded-2xl p-8 flex flex-col lg:flex-row lg:items-start gap-8 hover:border-foreground/40 transition-colors">
      <OfferRibbon offer={cardOffer} t={t} />
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-foreground pr-14 lg:pr-0">
          {t("pricing.custom.title", "Need more people? Build a custom plan.")}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {t(
            "pricing.custom.body",
            "Past {baseSeats} seats, add as many as you need. Every seat you add brings a crew member with it, at {seatPrice} a seat a month — the same step as the ladder above.",
            { baseSeats: offer.baseSeats, seatPrice: `${symbol}${price(offer.seatPriceMonthly)}` },
          )}
        </p>
        <CustomSeatPicker
          offer={offer}
          seats={seats}
          onChange={setSeats}
          idPrefix="pricing-custom"
          labels={{
            seats: t("pricing.custom.seats", "Seats"),
            quickPicks: t("pricing.custom.quickPicks", "Quick picks"),
            fewer: t("pricing.custom.fewer", "One seat fewer"),
            more: t("pricing.custom.more", "One seat more"),
          }}
        />
        <p className="mt-4 text-xs text-muted-foreground">
          {t(
            "pricing.custom.cap",
            "Up to {maxSeats} seats and {maxCrew} crew — {maxPeople} people in all. Bigger than that?",
            { maxSeats: offer.maxSeats, maxCrew: offer.maxSeats + offer.crewGap, maxPeople: offer.maxPeople },
          )}{" "}
          <Link href="/contact" className="underline text-foreground">
            {t("pricing.custom.contact", "Contact us")}
          </Link>
        </p>
      </div>
      {tier ? (
        <div className="lg:w-72 shrink-0 flex flex-col">
          <p className="text-sm font-medium text-foreground">{tier.name}</p>
          <ul className="mt-2 space-y-1.5">
            <li className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              {t("pricing.seatsManyIncluded", "{count} seats — quoting, jobs and invoicing", { count: tier.seats })}
            </li>
            <li className="flex items-center gap-2 text-sm text-foreground">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              {t("pricing.crewIncluded", "{count} crew members included — free", { count: tier.crewSeats })}
            </li>
          </ul>
          {cardOffer ? (
            <PlanOfferPrice offer={cardOffer} t={t} money={offerMoney(symbol, locale)} locale={locale} className="mt-4" />
          ) : (
            <div className="mt-4 flex items-baseline flex-wrap gap-x-1.5">
              <span className="text-3xl font-bold text-foreground">
                {symbol}
                {price(tier.price)}
              </span>
              <span className="text-sm text-muted-foreground">{t("pricingPage.perMonth")}</span>
            </div>
          )}
          <Link
            href={`/signup?tier=${encodeURIComponent(tier.tierKey)}`}
            className="mt-6 text-center bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold transition hover:brightness-110"
          >
            {t("nav.signup")}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

export default function PricingPlans({ plans, customOffer = null, asOf = renderAsOf(), aiAdvice = null }) {
  const { t, language } = useTranslation();
  // The AI advisor's plans, memoised for the same reason Account & Billing's
  // are (the advisor hands its answer back; a fresh array would loop).
  const advisorPlans = useMemo(
    () => plans.filter((p) => p.aiAllowance).map((p) => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly, allowance: p.aiAllowance })),
    [plans],
  );
  const reviewsByPlanId = useMemo(
    () => (aiAdvice?.units ? recommendAiPlan({ units: aiAdvice.units, plans: advisorPlans }).reviewsByPlanId : {}),
    [aiAdvice, advisorPlans],
  );
  const locale = numberLocaleFor(language);

  const columns = pricingColumns(plans.length);

  const price = (amount) =>
    Number(amount || 0).toLocaleString(locale, { maximumFractionDigits: 0 });

  // ── Monthly | 1-year commitment, the year first ─────────────────────────
  //
  // The owner's approved design (2026-09-28): the page opens on the 1-year
  // commitment, its tab carrying the saving the cards actually show. The
  // tabs only exist when some card sells a year — a tab whose other half
  // cannot be bought is a control that appears to work.
  const anyYear = plans.some((p) => p.offers?.year?.available);
  const [cadence, setCadence] = useState(anyYear ? "year" : "month");
  const tabSaving = yearTabSaving(plans.map((p) => p.offers));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center max-w-2xl mx-auto mb-12">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          {t("pricingPage.title")}
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          {t("pricingPage.subtitle")}
        </p>
      </div>

      {plans.length === 0 ? (
        <div className="text-center text-muted-foreground border border-border rounded-xl p-12">
          <p>{t("pricingPage.emptyTitle")}</p>
          <Link href="/contact" className="underline mt-2 inline-block">
            {t("pricingPage.emptyCta")}
          </Link>
        </div>
      ) : (
        <>
          {anyYear && (
            <div className="mb-8 flex justify-center">
              <div role="tablist" className="inline-flex flex-wrap justify-center items-center gap-1 rounded-full border border-border bg-card p-1">
                {[
                  ["year", yearTabLabel(t, tabSaving)],
                  ["month", t("pricing.offer.tabMonthly", "Monthly")],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={cadence === value}
                    onClick={() => setCadence(value)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      cadence === value ? "bg-inverted text-inverted-foreground" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={`grid gap-6 ${COLUMN_CLASS[columns]}`}>
            {plans.map((plan) => {
              const features = plan.features || {};
              // The server's offer for the chosen tab; a card with no year
              // keeps its monthly offer rather than inventing one.
              const offer = plan.offers?.[cadence]?.available ? plan.offers[cadence] : plan.offers?.month || null;
              return (
                <div
                  key={plan.id}
                  className="relative overflow-hidden border border-border rounded-2xl p-8 flex flex-col hover:border-foreground/40 transition-colors"
                >
                  <OfferRibbon offer={offer} t={t} />
                  <h3 className="text-lg font-semibold text-foreground pr-10">
                    {plan.name}
                  </h3>
                  {offer ? (
                    <PlanOfferPrice
                      offer={offer}
                      t={t}
                      money={offerMoney(currencyMeta(plan.currency).symbol, locale)}
                      locale={locale}
                      className="mt-3"
                    />
                  ) : (
                  <div className="mt-3 flex items-baseline flex-wrap gap-x-1.5">
                    <span className="text-3xl font-bold text-foreground">
                      {currencyMeta(plan.currency).symbol}
                      {price(plan.priceMonthly)}
                    </span>
                    {/* ── No currency CODE, and that is the point ──────────
                        This printed one, chosen from an IP geo guess, so the
                        page told a visitor "All prices are in CAD" on the
                        strength of where their traffic happened to enter the
                        network. The earlier argument for printing it — that
                        $700 CAD and $700 USD are $250 apart — was an argument
                        about the BILLING currency, and this page cannot know
                        it. The two rows of a tier carry the same number, so
                        there is nothing here to disambiguate; the note under
                        the grid says where the currency is actually decided.
                        The symbol comes from the row's own currency column,
                        which is a fact about the row, not about the reader. */}
                    <span className="text-sm text-muted-foreground">
                      {t("pricingPage.perMonth")}
                    </span>
                  </div>
                  )}

                  <ul className="mt-6 space-y-2.5 flex-1">
                    {/* Seats and crew as separate statements — never their sum.
                        Singular and plural are separate keys rather than an
                        appended "s": this once read "Up to 1 team members" in
                        English, and most of the other five languages don't
                        pluralise by suffixing at all — Ukrainian has three
                        plural forms. */}
                    {peopleLines(plan).map((line) => (
                      <li
                        key={line.key}
                        className="flex items-center gap-2 text-sm text-foreground"
                      >
                        <CheckCircle2
                          size={16}
                          className="text-green-600 shrink-0"
                        />
                        {t(line.key, line.fallback, line.values)}
                      </li>
                    ))}

                    {plan.maxQuotesPerMonth ? (
                      <li className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2
                          size={16}
                          className="text-green-600 shrink-0"
                        />
                        {t("pricing.quoteLimit", {
                          count: plan.maxQuotesPerMonth,
                        })}
                      </li>
                    ) : null}

                    {plan.aiCopilotEnabled ? (
                      <li className="flex items-center gap-2 text-sm text-foreground">
                        <CheckCircle2
                          size={16}
                          className="text-green-600 shrink-0"
                        />
                        {t("pricing.aiIncluded")}
                      </li>
                    ) : null}
                    {/* Capped, said as a count (owner, 2026-10-04): the plan's
                        AI allowance in quote reviews, from resolveAiCap. */}
                    {reviewsByPlanId[plan.id] != null ? (
                      <li className="flex items-center gap-2 text-sm text-foreground" data-plan-ai-reviews>
                        <CheckCircle2
                          size={16}
                          className="text-green-600 shrink-0"
                        />
                        {t("app.aiAdvisor.planLine", { reviews: reviewsByPlanId[plan.id].toLocaleString(locale) })}
                      </li>
                    ) : null}

                    {/* Free-form per-plan flags set in /platform. They're data,
                        not catalogue keys, so they stay in whatever language
                        they were typed in — same as the plan name above. */}
                    {Object.entries(features).map(([key, val]) =>
                      val ? (
                        <li
                          key={key}
                          className="flex items-center gap-2 text-sm text-foreground"
                        >
                          <CheckCircle2
                            size={16}
                            className="text-green-600 shrink-0"
                          />
                          {key.replace(/_/g, " ")}
                        </li>
                      ) : null,
                    )}
                  </ul>

                  <Link
                    href={signupHref(plan)}
                    className="mt-8 text-center bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold transition hover:brightness-110"
                  >
                    {t("nav.signup")}
                  </Link>
                </div>

              );
            })}
          </div>

          <CustomPlanCard offer={customOffer} t={t} price={price} interval={cadence} locale={locale} />

          {/* Which plan fits the AI you'll use (owner, 2026-10-04). No
              account yet, so no link to the AI credit page. */}
          {aiAdvice?.units && (
            <AiPlanAdvisor
              className="mt-8 max-w-3xl mx-auto text-left"
              units={aiAdvice.units}
              plans={advisorPlans}
              bundles={aiAdvice.bundles}
              creditHref={null}
            />
          )}

          <IncludedEverywhere t={t} />

          <AddOnComparison t={t} asOf={asOf} locale={locale} />

          {/* ── What this note may and may not claim ──────────────────────
              It used to open "All prices are in CAD", with the code filled in
              from an IP geo guess. The owner's objection, and he is right: you
              cannot tell whether a visitor is in Canada, the USA or Europe
              until they sign up, so that sentence was a guess wearing a
              statement's clothes.

              What IS true from here: the numbers are one set, not two; the
              billing currency is decided by the business address at signup;
              and the supported currencies carry the same number rather than a
              converted one (SUPPORTED_CURRENCIES — CAD, AUD and USD, the last
              for everywhere else Stripe serves; the owner, 2026-09-24: no GBP
              or EUR rows, so nothing here may imply one). Tax stays a second
              sentence because it is a second fact — Ontario adds 13% HST on
              top of whichever. The card prices keep a bare "$": a visitor's
              country is not known until the address at signup, and all
              three currencies are dollars. */}
          <p className="mt-8 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
            {t(
              "pricingPage.currencyBasis",
              "One set of prices. Which money you're billed in comes from the business address you give when you sign up: Canadian companies are billed in Canadian dollars, Australian companies in Australian dollars, and companies everywhere else in US dollars — the same number either way, not a converted one.",
            )}{" "}
            {t("pricingPage.taxNote")}
          </p>
          {/* What taking a payment costs, from the same constants the
              charge creators use (lib/stripe/processingFee.js) — the
              pricing page cannot quote a rate the checkout does not
              charge. One sentence, because the honest answer is one
              sentence: the fee comes off each payment and nothing else is
              billed for payments. */}
          <p className="mt-3 text-center text-sm text-muted-foreground max-w-2xl mx-auto">
            {t("pricingPage.processingFees", {
              card: PROCESSING_RATES.card.formula,
              debit: PROCESSING_RATES.acss_debit.formula,
            })}
          </p>
          {/* The one paid add-on a plan can carry: video posts. Every number
              from lib/marketing/videoAllowance.js — the same constants the
              upload gate enforces and the pack checkout charges. The price is
              the same number in every currency a plan bills in, and the pack
              bills in the plan's currency (owner, 2026-10-04). */}
          <p className="mt-3 text-center text-sm text-muted-foreground max-w-2xl mx-auto" data-pricing-video-pack>
            {t("pricingPage.videoPosts", {
              included: INCLUDED_VIDEOS_PER_MONTH,
              // No currency code, the way the page names none beside a card
              // price (check:pricing-page): since 2026-10-04 the pack bills in
              // the company's own currency at the same number, exactly as the
              // plans do (lib/marketing/videoAllowance.js PACK_CURRENCIES).
              price: formatPackPrice(VIDEO_PACK.priceCents),
              videos: VIDEO_PACK.videos,
              length: formatClipLength(VIDEO_MAX_SECONDS),
            })}
          </p>
        </>
      )}
    </div>
  );
}
