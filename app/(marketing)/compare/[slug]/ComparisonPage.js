// app/(marketing)/compare/[slug]/ComparisonPage.js
//
// One comparison page, rendered from lib/marketing/competitors.js and
// lib/marketing/featureMatrix.js. Everything a visitor reads that is a claim
// about anybody — us or them — comes out of one of those two modules. This
// file decides layout and nothing else.
//
// ══ Why there IS a "use client" here now ═══════════════════════════════════
//
// This file used to open with an argument for the opposite: these pages were
// English-only on purpose, so there was no translation context to enter and the
// whole page could render on the server. The owner read /compare in Spanish and
// found it in English, which is what that decision looked like from outside.
//
// So the page joins /pricing and /industries/[slug]: copy comes from the t()
// catalogue, translation lives in React context, and the server half next door
// keeps generateMetadata and generateStaticParams. The cost is real and is
// named rather than hidden — scripts/check-compare-pages.mjs now has to wrap
// its renders in a LanguageProvider instead of awaiting a bare function. It
// still gets markup, and it still gets ENGLISH markup, because every t() call
// below carries the same English literal as its fallback.
//
// ══ Why the English fallbacks are written out at every call site ═══════════
//
// They are not belt-and-braces. They are what the check script asserts
// against, and what a visitor reads on a language whose catalogue is short a
// key. scripts/check-marketing-i18n.mjs is what stops one of them being the
// ONLY copy: it fails when a user-facing string on these surfaces has no key
// beside it.
//
// ══ The data attributes are load-bearing ═══════════════════════════════════
//
// Every figure row carries `data-figure-id` and `data-published`, every
// concession carries `data-lacks`, every feature carries `data-matrix-key`.
// They exist so scripts/check-compare-pages.mjs can assert ABOUT A ROW rather
// than about the page as a flat string, and the distinction matters here more
// than usual: Jobber's withheld annual figures carry the same amounts ($399,
// $599) as the monthly rows that DO publish, so "does the string $399 appear"
// cannot tell a published price from a suppressed one. Per-row attributes can.
// Removing them does not change what a visitor sees and does break the only
// thing standing between this page and a false public statement about a
// competitor, so they stay.
//
// ══ What this file may never do ════════════════════════════════════════════
//
//   • print an amount from a figure withholdReason() rejected — the withheld
//     list renders labels and reasons, never `price.amount`;
//   • convert a currency, or set two currencies beside one amount;
//   • print a currency as though the competitor stated it when they did not.
//     Projul's three amounts are theirs and the currency beside them is the
//     owner's assertion; currencyProvenance below is what keeps those two
//     facts apart on the page as they are kept apart in the data;
//   • match one of their tiers against one of ours on anything but a
//     structured feature map. Their prose is quoted, never translated — see
//     the receptionist block, which now says so out loud rather than vanishing;
//   • name a FieldQuo feature. Feature rows are keys into the matrix and the
//     matrix's own `name` and `summary` are what get printed;
//   • say the AI receptionist is "included". It is on every plan and the talk
//     time is prepaid credit — see availabilityWord() in
//     lib/marketing/compareLabels.js.

"use client";

import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Info, Minus, X as XIcon } from "lucide-react";

import {
  COMPARABLE_FEATURES,
  FEATURE_ADD_ON,
  FEATURE_INCLUDED,
  FIELDQUO_CAPABILITIES,
  FIELDQUO_LACKS,
  FIELDQUO_REFERENCE,
  PRICE_AMOUNT,
  PRICE_FREE,
  PRICE_NOT_OFFERED,
  PRICE_ON_REQUEST,
  PRICE_UNKNOWN,
  SOURCED_PUBLISHER,
  allAddOns,
  claims,
  comparableTier,
  competitor as findCompetitor,
  isStale,
  provenanceLabel,
  withholdReason,
} from "@/lib/marketing/competitors";
import { featureEntry } from "@/lib/marketing/featureLabels";
import { availabilityWord, capabilityLabel } from "@/lib/marketing/compareLabels";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";

import AddOnStack from "../AddOnStack";
import { coordinateLabel } from "../addOns";
import {
  COMPARE_PAGES,
  compareChrome,
  comparePageCopy,
  counterpointFor,
} from "../compareCopy";
import { entryPriceGap } from "../entryPrice";

// ── How a price kind reads in a sentence ───────────────────────────────────
//
// Five kinds, five different sentences, and the module exists because any two
// of them collapsing is the bug. "Not offered at this size" is not "we don't
// know", and neither is "they won't tell you" — so each gets its own words and
// none of them falls back to another. A kind with no entry here renders
// nothing rather than borrowing the nearest one.
import TheCase from "../TheCase";

// `price.ask` and `price.currency` are theirs and are never translated. The
// sentence AROUND them is ours: a French reader was getting "No price published
// — their page says “Request Pricing”" with our half in English and theirs in
// English too, which reads as an untranslated page rather than as a quotation.
// The digit grouping follows the reader for the same reason /pricing's does.
function priceLine(price, t, locale = "en-US") {
  if (!price) return null;
  const say = (key, fallback, values) =>
    typeof t === "function"
      ? t(key, fallback, values)
      : String(fallback).replace(/\{(\w+)\}/g, (m, name) =>
          values?.[name] !== undefined ? String(values[name]) : m,
        );
  switch (price.kind) {
    case PRICE_AMOUNT:
      // Currency named beside the amount, always, and only ever the one the
      // figure carries. A bare "$59" on a page read in Canada is a number
      // pretending to be local.
      return say("compare.price.amount", "${amount} {currency} per {per}", {
        amount: price.amount.toLocaleString(locale),
        currency: price.currency,
        per: say(`compare.per.${price.per}`, price.per),
      });
    case PRICE_FREE:
      return say("compare.price.free", "Free ({currency})", { currency: price.currency });
    case PRICE_ON_REQUEST:
      // Their button's own words. That the words exist is the claim; it is
      // checkable by anybody in one click, which is what makes it safe.
      return say(
        "compare.price.onRequest",
        "No price published — their page says “{ask}”",
        { ask: price.ask },
      );
    case PRICE_NOT_OFFERED:
      return say("compare.price.notOffered", "Not sold at this size");
    case PRICE_UNKNOWN:
      return null;
    default:
      return null;
  }
}

// ── How a feature's availability reads ─────────────────────────────────────
//
// The five words moved to lib/marketing/compareLabels.js — /pricing renders the
// same vocabulary through AddOnStack, and two copies is how one surface ends up
// calling an add-on "extra" and the other "optional". AVAILABILITY_FALLBACK
// there holds the English these five names used to hold here.
//
// The rule they encode has not moved: FEATURE_INCLUDED and
// FEATURE_INCLUDED_USAGE_EXTRA must never share a sentence. Ours is the second
// one — the receptionist is on every plan and the talk time is prepaid credit
// (lib/voice/credits.js), so "AI included" beside our price would be a false
// claim about our OWN price to a visitor who then meets a top-up on their first
// call. The check script asserts these two strings differ, because the collapse
// is a one-line edit that reads as tidying.

/**
 * A withholding reason with the money taken out of it.
 *
 * ══ Why the reason cannot be printed as written ════════════════════════════
 *
 * withholdReason() returns sentences meant for whoever maintains the data, and
 * several of them QUOTE the figure they are refusing:
 *
 *   "unresolved: the relationship between the $49/mo regular rate and the
 *    $29/mo post-promotion rate was not established …"
 *
 * Rendering that verbatim publishes $49 as Jobber's Core price on a page whose
 * entire argument is that we do not know what $49 means. A disclaimer under a
 * number does not stop a reader taking the number — competitors.js says
 * plainly that showing a labelled absence is better than showing nothing and
 * "much better than showing a number", and a number inside its own excuse is
 * still a number.
 *
 * So the reason is shown, in full, in its own words, with the amounts replaced.
 * The alternatives were both worse: dropping the row leaves a blank the module
 * forbids, and replacing the reason with a category ("unresolved") throws away
 * the only part a reader can act on.
 *
 * The pattern is deliberately wide — any `$` followed by digits, commas or a
 * decimal — because it is guarding against the amounts nobody has written yet.
 */
export function redactAmounts(reason) {
  return String(reason ?? "").replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, "[amount withheld]");
}

/**
 * A claim's own words, with the money taken out once its reading has expired.
 *
 * ══ A leak this page had from the day it was written ═══════════════════════
 *
 * withholdReason stops a stale FIGURE from publishing, and the price rows
 * empty ninety days after they were last read. Claims had no such gate:
 * claimPublishable asks who verified an entry and never asks when. So the
 * prose kept printing, and several claims QUOTE the amount they are about —
 * "Jobber's AI receptionist is a $29/mo add-on at one user, and otherwise sits
 * in the $599/mo Plus tier". Rendered at ninety-five days, the Jobber page
 * emptied every price row and went on printing $29 and $599 inside a sentence;
 * the QuoteIQ page did the same with $29.99. A competitor's price, on a static
 * page, with no reading behind it and nobody watching — the exact failure the
 * data module was built to make impossible, arriving through the one door it
 * does not guard.
 *
 * The claim itself survives, because what it SAYS is still worth reading and
 * the source link and date are right there. Only the numbers go, through the
 * same redactor the withheld rows use, and the card says why rather than
 * leaving a reader to wonder what the brackets mean. Dropping the claim
 * outright was the other option and it is worse in the concession direction:
 * "we have not checked" would be a lie about research that was done and went
 * out of date.
 */
function claimProse(entry, asOf) {
  const stale = isStale(entry, asOf);
  return { text: stale ? redactAmounts(entry.claim) : entry.claim, stale };
}

/** Where and when a figure was read. Never omitted from a published figure. */
function provenanceLine(figure, t) {
  const fallback = `Read from a ${figure.observedFrom} connection on ${figure.checked}`;
  // Deliberately the SAME key AddOnStack uses. The two surfaces print the same
  // sentence about the same kind of reading, and a second key would let one of
  // them be re-worded without the other.
  return typeof t === "function"
    ? t("addOns.provenance", fallback, {
        country: figure.observedFrom,
        checked: figure.checked,
      })
    : fallback;
}

/**
 * Where the CURRENCY came from, when it did not come from their page.
 *
 * ══ Why an amount and its currency need separate provenance ════════════════
 *
 * Projul is the case that forced this and it is now live. Their served HTML
 * prints "$4,788 Annually" and names no currency anywhere — the two dollar
 * codes and the word "dollars" appear zero times. The amount is theirs, read
 * off their own page. The currency is FieldQuo's owner asserting it because
 * Projul is a US company, which is a business judgement he is entitled to make
 * and is NOT a reading of their page.
 *
 * withholdReason accepts that assertion, so all three amounts publish. But
 * "$4,788 USD per year" rendered with nothing beside it says their page stated
 * the currency, and their page did not. That sentence is a false statement
 * about a competitor's published prices, made by a renderer rather than by the
 * data — exactly the gap between an immaculate module and a page that lies,
 * which is what this whole directory is checked for.
 *
 * So a figure whose currency is not SOURCED_PUBLISHER prints where the
 * currency came from, in provenanceLabel's own words — who asserted it, when,
 * and on what grounds. Absence of `currencySourcing` is never read as "off
 * their page": withholdReason already refuses to publish a figure that does
 * not record one, so this returning null means the currency IS theirs.
 */
function currencyProvenance(figure, subject) {
  const from = figure?.price?.currencySourcing;
  if (!from || from === SOURCED_PUBLISHER) return null;
  return provenanceLabel(
    {
      sourcing: from,
      assertedBy: figure.price.assertedBy,
      relayedBy: figure.price.relayedBy,
      checked: figure.checked,
    },
    { subject },
  );
}

/**
 * The point on a competitor's own selectors that a figure was read at.
 *
 * The mapping itself moved to ../addOns.js so the add-on block prints a
 * coordinate in exactly the same words this page does — one figure labelled
 * "6-10 people" here and "6 to 10" there is two readings of one price.
 * A competitor with no axes has nothing to locate — ServiceTitan declares none
 * — and gets nothing rather than an invented "all sizes".
 */
function coordinateLine(figure, t) {
  return coordinateLabel(figure.axis, t);
}

function SectionHeading({ title, intro, id }) {
  return (
    <div className="max-w-3xl">
      <h2 id={id} className="text-2xl sm:text-3xl font-bold text-foreground">
        {title}
      </h2>
      {intro ? <p className="mt-3 text-muted-foreground">{intro}</p> : null}
    </div>
  );
}

function SourceLink({ href, children }) {
  return (
    <a
      href={href}
      // A link to a competitor's own page, opened away from ours. rel is not
      // decoration here: noopener is the security default and nofollow keeps
      // us from handing them ranking for the privilege of being compared.
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground"
    >
      {children}
      <ExternalLink size={12} aria-hidden="true" />
    </a>
  );
}

export default function ComparisonPage({ slug, asOf }) {
  const { t, language } = useTranslation();
  const locale = numberLocaleFor(language);
  const chrome = compareChrome(t);
  const page = comparePageCopy(slug, t);
  const competitor = page ? findCompetitor(page.competitorId) : null;
  // The server half has already 404'd on an unknown slug; this is the second
  // gate, and it exists because a competitor could be removed from the data
  // module without this directory being touched.
  if (!page || !competitor) return null;

  const both = claims(competitor.id);

  // Split by whether the figure may be printed as a claim, using the module's
  // own answer rather than a rule restated here. Every figure lands in exactly
  // one of the two lists — nothing is silently dropped.
  const published = [];
  const withheld = [];
  for (const figure of competitor.figures) {
    const reason = withholdReason(figure, asOf);
    if (reason === null) published.push(figure);
    // Redacted at the boundary, not at the point it is printed, so there is
    // exactly one place a raw reason could escape from and it is this one.
    else withheld.push({ figure, reason: redactAmounts(reason) });
  }

  // The cheapest tier of theirs that ACTUALLY carries the feature, wherever it
  // sits in their table. Called with no coordinates on purpose: constraining
  // it to a team size here would be this file re-deciding what the function
  // exists to decide. Whatever it returns, its own coordinates are printed
  // beside it, because a Jobber figure quoted without its selectors is a
  // different number to a different reader.
  const receptionistFeature = COMPARABLE_FEATURES.ai_receptionist;
  const receptionistTier = comparableTier(
    competitor.id,
    { feature: receptionistFeature.key },
    asOf,
  );
  const receptionistAddOn = allAddOns().find(
    (a) =>
      a.competitorId === competitor.id &&
      a.feature === receptionistFeature.key &&
      withholdReason(a, asOf) === null,
  );

  // Do they sell something below our cheapest rung? Answered in ../entryPrice.js
  // from their published figure and our own ladder, so the concession cannot be
  // typed, softened or left behind when either side reprices. It refuses far
  // more often than it answers — see that module for every comparison it will
  // not make.
  const entryGap = entryPriceGap(competitor.id, asOf);

  // Their own descriptions of their own tiers. Only from figures that PUBLISH:
  // a tier list attached to a figure withholdReason rejected would be a
  // competitor's marketing surviving the gate its price did not.
  const theirTiers = published.filter(
    (f) =>
      (Array.isArray(f.includedFeatures) && f.includedFeatures.length > 0) ||
      (Array.isArray(f.addsOverPreviousTier) && f.addsOverPreviousTier.length > 0),
  );
  // Their AI allowance, where their page states one per tier. A number they
  // print, not a description of it: "they have AI limits" compares to nothing.
  const meteredTiers = published.filter((f) => Number.isFinite(f.aiCreditsPerMonth));

  const ladder = FIELDQUO_REFERENCE.ladder;
  const otherPages = COMPARE_PAGES.filter((p) => p.slug !== slug);

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="bg-muted border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {chrome.eyebrow}
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            {t("compare.vs", "FieldQuo vs {competitor}", { competitor: competitor.name })}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl">{page.lede}</p>

          {/* The date the page speaks as of. A static page cannot say "today",
              so it says which day it meant. See ../asOf.js. */}
          <p className="mt-4 text-sm text-muted-foreground" data-as-of={asOf}>
            <Info size={14} className="inline align-[-2px] mr-1" aria-hidden="true" />
            {t(
              "compare.preparedAsOfLong",
              "Prepared as of {date}. Every figure below also carries the day it was read and the country it was read from.",
              { date: asOf },
            )}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold transition hover:brightness-110"
            >
              {chrome.ctaButton} <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-card"
            >
              {chrome.ctaSecondary}
            </Link>
          </div>
        </div>
      </div>

      {/* ── The argument, before the catalogue ──────────────────────────
          Placed FIRST on purpose. The price tables below are reference: what
          each company publishes, with its provenance. This is what the page is
          FOR, and a reader who leaves after one screen should have read it. */}
      <TheCase competitor={competitor} t={t} locale={locale} />

      {/* ── Price ─────────────────────────────────────────────────────────── */}
      <div className="bg-muted border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <SectionHeading id="price" title={chrome.priceTitle} />

          <div className="mt-4 rounded-xl border border-border bg-card p-5 max-w-3xl">
            <h3 className="text-sm font-semibold text-foreground">
              {chrome.rulesTitle}
            </h3>
            <ul className="mt-3 space-y-2">
              {chrome.rules.map((rule) => (
                <li key={rule} className="text-sm text-muted-foreground flex gap-2">
                  <Minus size={14} className="shrink-0 mt-1" aria-hidden="true" />
                  <span>{rule}</span>
                </li>
              ))}
            </ul>
            {/* The vantage point, where the data model records one. Jobber is a
                Canadian company read from a US connection, and Canada is most
                of who FieldQuo competes for — quoting these as "Jobber's price"
                rather than "Jobber's US price" is the error this line prevents. */}
            {competitor.geoCaveat ? (
              <p className="mt-4 text-sm text-muted-foreground" data-geo-caveat="true">
                <Info size={14} className="inline align-[-2px] mr-1" aria-hidden="true" />
                {competitor.geoCaveat}
              </p>
            ) : null}
          </div>

          <div className="mt-10 grid lg:grid-cols-2 gap-8">
            {/* FieldQuo's own ladder, imported rather than restated. A rung
                repriced in lib/pricing/ladder.js changes here on its own. */}
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                {chrome.fieldquoPriceTitle}
              </h3>
              <div className="mt-4 space-y-3">
                {ladder.map((tier) => (
                  <div
                    key={tier.tierKey}
                    data-fieldquo-tier={tier.tierKey}
                    className="bg-card border border-border rounded-xl p-4 flex items-baseline justify-between gap-4"
                  >
                    <div>
                      <div className="font-semibold text-foreground">{tier.label}</div>
                      {/* Singular and plural are separate KEYS rather than an
                          appended "s": most of the languages this page is read
                          in do not pluralise by suffixing, and Ukrainian has
                          three forms. Same rule /pricing's plan cards follow. */}
                      <div className="text-sm text-muted-foreground">
                        {t(
                          tier.seats === 1 ? "compare.tierSeatsOne" : "compare.tierSeats",
                          tier.seats === 1
                            ? "{seats} seat, plus {crew} crew at no charge"
                            : "{seats} seats, plus {crew} crew at no charge",
                          { seats: tier.seats, crew: tier.crewSeats },
                        )}
                      </div>
                    </div>
                    <div className="text-foreground font-semibold whitespace-nowrap">
                      {t("compare.pricePerMonth", "${amount} per month", {
                        amount: tier.price.toLocaleString(locale),
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {/* Why no conversion is needed on our side either: the CAD and
                  USD rows carry the same number, so a USD competitor lines up
                  against the USD row with no arithmetic anywhere. */}
              <p className="mt-4 text-sm text-muted-foreground">
                {FIELDQUO_REFERENCE.sameNumberBothCurrencies
                  ? t(
                      "compare.sameNumberBothCurrencies",
                      "The same number in each currency we sell in ({currencies}) — ${price} in each is a real FieldQuo price, so nothing on this page has to be converted to line them up. Which currency you are billed in comes from the business address you give at signup.",
                      {
                        currencies: FIELDQUO_REFERENCE.currencies.join(
                          t("compare.and", " and "),
                        ),
                        price: FIELDQUO_REFERENCE.entryTier.price.toLocaleString(locale),
                      },
                    )
                  : t("compare.soldIn", "Sold in {currencies}.", {
                      currencies: FIELDQUO_REFERENCE.currencies.join(
                        t("compare.and", " and "),
                      ),
                    })}
              </p>
            </div>

            {/* Their side. Published figures only — the rest is below, with
                reasons. */}
            <div>
              <h3 className="text-lg font-semibold text-foreground">{competitor.name}</h3>
              {published.length === 0 ? (
                <p className="mt-4 text-muted-foreground">
                  {t(
                    "compare.nothingPublishable",
                    "There is nothing on {competitor}’s pricing page that we can publish as a price. Every figure we hold is listed below with the reason it is being withheld.",
                    { competitor: competitor.name },
                  )}
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {published.map((figure) => {
                    const line = priceLine(figure.price, t, locale);
                    const coordinates = coordinateLine(figure, t);
                    return (
                      <div
                        key={figure.id}
                        data-figure-id={figure.id}
                        data-published="true"
                        data-observed-from={figure.observedFrom}
                        className="bg-card border border-border rounded-xl p-4"
                      >
                        <div className="flex items-baseline justify-between gap-4">
                          <div className="font-semibold text-foreground">
                            {figure.label}
                            {figure.badge ? (
                              <span className="ml-2 text-xs font-medium text-muted-foreground">
                                {figure.badge}
                              </span>
                            ) : null}
                          </div>
                          {line ? (
                            <div className="text-foreground font-semibold text-right">
                              {line}
                            </div>
                          ) : null}
                        </div>
                        {coordinates ? (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {coordinates}
                          </div>
                        ) : null}
                        {figure.seatsIncluded ? (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {t(
                              figure.seatsIncluded === 1
                                ? "compare.usersIncludedOne"
                                : "compare.usersIncluded",
                              figure.seatsIncluded === 1
                                ? "{count} user included"
                                : "{count} users included",
                              { count: figure.seatsIncluded },
                            )}
                          </div>
                        ) : null}
                        {/* "Unlimited" is a different fact from a seat count,
                            not a large one. QuoteIQ's top tier records
                            seatsIncluded: null beside unlimitedSeats so nobody
                            invents a ceiling to divide by; printing their own
                            word is the only honest rendering of it. */}
                        {figure.unlimitedSeats ? (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {t(
                              "compare.unlimitedUsers",
                              "Unlimited users, so there is no seat count to compare",
                            )}
                          </div>
                        ) : null}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {provenanceLine(figure, t)} ·{" "}
                          <SourceLink href={figure.source}>
                            {t("addOns.sourceLink", "their pricing page")}
                          </SourceLink>
                        </div>
                        {/* The amount is theirs and the currency may not be.
                            See currencyProvenance — this is the line that stops
                            an owner-asserted currency reading as their page's
                            own statement. */}
                        {currencyProvenance(figure, competitor.name) ? (
                          <div
                            className="mt-2 text-xs text-muted-foreground border-l-2 border-border pl-3"
                            data-currency-sourcing={figure.price.currencySourcing}
                          >
                            {t(
                              "compare.currencyNotTheirs",
                              "The amount is theirs, off their own page. The currency is not: {provenance}",
                              { provenance: currencyProvenance(figure, competitor.name) },
                            )}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── One sentence, where a ledger used to be ────────────────────
              A page that showed four of fourteen plans and said nothing would
              be the blank cell at a larger scale — so the reader is still told
              rows were left out, and how many, and where the reasons live.
              What they are not given is the reasons themselves, one row at a
              time, on a page they came to in order to choose a product. */}
          {withheld.length > 0 ? (
            <p className="mt-6 max-w-3xl text-sm text-muted-foreground">
              {t(
                withheld.length === 1 ? "compare.withheldCountOne" : "compare.withheldCount",
                withheld.length === 1
                  ? "{count} more {competitor} price is not shown here — either the reading has aged out, or we could not settle what the published figure meant. We would rather leave a row out than print a number we cannot stand behind."
                  : "{count} more {competitor} prices are not shown here — either the reading has aged out, or we could not settle what the published figure meant. We would rather leave a row out than print a number we cannot stand behind.",
                { count: withheld.length, competitor: competitor.name },
              )}
            </p>
          ) : null}

          {/* ── The withheld figures are NOT printed here ──────────────────
              They were, in full, with a reason each — ten rows of
              "[amount withheld]" and "unresolved: same open question as
              jobber.core.solo.annual". The owner read it and asked what the
              purpose of this page was, and he was right to.

              This is a marketing page. Its one job is to help a contractor
              comparing two products decide. A catalogue of the figures we could
              not settle helps nobody make that decision: it is internal QA
              notes on a sales surface, it fills the page with non-information,
              and it argues against the page while the page is arguing.

              The RULE it came from is right and stays: an unverified number is
              never printed as a fact, `published:false` figures never reach the
              DOM, and the count below still tells a reader that rows were left
              out and roughly how many. What changed is that the reader gets a
              sentence instead of a ledger. The reasons are still on every
              figure in lib/marketing/competitors.js, which is where somebody
              auditing the page would look, and where an auditor is the reader.

              `withheld` is still computed above, deliberately: the count is
              read, and a variable removed here would have to come back the
              moment anybody wanted to say "3 rows" rather than "some". */}
        </div>
      </div>

      {/* ── What they sell ON TOP of the plan ──────────────────────────────
          Renders itself, or renders nothing. AddOnStack returns null unless
          the module says the add-ons may be published AND may honestly be
          totalled — same currency, same billing period, same point on their
          own selectors — so a competitor nobody has read add-on prices for
          gets no section rather than an empty one, and a stale read empties it
          the same way the price rows above empty. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <AddOnStack
          competitorId={competitor.id}
          competitorName={competitor.name}
          asOf={asOf}
          t={t}
          locale={locale}
        />
      </div>

      {/* ── Their ladder, in their own words ───────────────────────────────
          The half of a QuoteIQ comparison that cannot be made any other way.
          Their entry tier is cheaper than our cheapest; what a reader needs in
          order to decide is what climbing their ladder costs, and their own
          page answers that tier by tier.

          Every word here is theirs, quoted as competitors.js records it —
          "Kept in their words, not translated into our feature vocabulary,
          because renaming a competitor's feature is how a comparison quietly
          becomes a straw man". So this section deliberately makes NO match
          against our own list, and says so: COMPARABLE_FEATURES carries one
          key and only one competitor's figures carry a structured feature map,
          which means there is no tier-by-tier answer in the data for anybody
          else. Inventing one by matching their prose against our feature names
          is precisely the thing the data model forbids. */}
      {theirTiers.length > 0 ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <SectionHeading
            id="their-tiers"
            title={chrome.theirTiersTitle}
            intro={chrome.theirTiersIntro}
          />
          <div className="mt-8 space-y-4 max-w-3xl">
            {theirTiers.map((figure) => {
              const items = (figure.addsOverPreviousTier || figure.includedFeatures) ?? [];
              const adds = Array.isArray(figure.addsOverPreviousTier);
              // Their feature list has its own provenance where the data
              // records one — Projul's tier contents were relayed by the owner
              // rather than read by us, and that is a weaker standard than the
              // amount beside them. Printed rather than flattened into the
              // figure's own read.
              const featuresFrom = figure.featuresSourcing
                ? provenanceLabel(
                    {
                      sourcing: figure.featuresSourcing,
                      relayedBy: figure.featuresRelayedBy,
                      assertedBy: figure.featuresAssertedBy,
                      checked: figure.checked,
                    },
                    { subject: competitor.name },
                  )
                : null;
              return (
                <div
                  key={figure.id}
                  data-their-tier={figure.id}
                  className="bg-card border border-border rounded-xl p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <div className="font-semibold text-foreground">
                      {competitor.name} {figure.label}
                    </div>
                    <div className="text-foreground font-semibold whitespace-nowrap">
                      {priceLine(figure.price, t, locale)}
                    </div>
                  </div>
                  {coordinateLine(figure, t) ? (
                    <div className="mt-1 text-sm text-muted-foreground">
                      {coordinateLine(figure, t)}
                    </div>
                  ) : null}
                  <div className="mt-3 text-sm font-medium text-foreground">
                    {adds
                      ? t("compare.addsOverTier", "Adds over the tier below it:")
                      : t("compare.onThisTier", "On this tier:")}
                  </div>
                  <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                    {items.map((item) => (
                      <li
                        key={item}
                        data-their-feature={item}
                        className="text-sm text-muted-foreground flex gap-2"
                      >
                        <Minus size={13} className="shrink-0 mt-1.5" aria-hidden="true" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  {Number.isFinite(figure.aiCreditsPerMonth) ? (
                    <div
                      className="mt-3 text-sm text-muted-foreground"
                      data-ai-credits-tier={figure.id}
                      data-ai-credits={figure.aiCreditsPerMonth}
                    >
                      {t(
                        "compare.aiCreditsTier",
                        "Their page states {count} AI credits a month on this tier.",
                        { count: figure.aiCreditsPerMonth.toLocaleString(locale) },
                      )}
                    </div>
                  ) : null}
                  <div className="mt-3 text-xs text-muted-foreground">
                    {featuresFrom
                      ? t("compare.thisListFrom", "This list {provenance}", {
                          provenance: featuresFrom,
                        })
                      : provenanceLine(figure, t)}{" "}
                    · <SourceLink href={figure.source}>
                            {t("addOns.sourceLink", "their pricing page")}
                          </SourceLink>
                  </div>
                </div>
              );
            })}
          </div>
          <p
            className="mt-6 max-w-3xl text-sm text-muted-foreground border-l-2 border-border pl-4"
            data-no-tier-match="true"
          >
            {chrome.theirTiersNoMatchNote}
          </p>
        </div>
      ) : null}

      {/* ── Metered AI, both sides, and the unflattering half of ours ──────
          Their allowance is a number they print and it moves with the tier.
          Ours is not sold that way — and the sentence stops being true if it
          stops there, because lib/ai/usage.js meters every model call against
          a per-company ceiling (checkAiQuota, "You've used this month's
          FieldQuo AI allowance"). "Ours is not metered" would have been a
          false claim about our own product on a page whose whole argument is
          that we do not make those. So the panel says both halves. */}
      {meteredTiers.length > 0 ? (
        <div className="bg-muted border-y border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <SectionHeading
              id="ai-metering"
              title={chrome.aiMeteringTitle}
              intro={chrome.aiMeteringIntro}
            />
            <div className="mt-8 grid md:grid-cols-2 gap-4 max-w-4xl">
              <div
                className="bg-card border border-border rounded-xl p-5"
                data-ai-metering={competitor.id}
              >
                <div className="font-semibold text-foreground">{competitor.name}</div>
                <ul className="mt-3 space-y-1">
                  {meteredTiers.map((figure) => (
                    <li
                      key={figure.id}
                      data-ai-metering-tier={figure.id}
                      data-ai-credits={figure.aiCreditsPerMonth}
                      className="text-sm text-muted-foreground flex justify-between gap-4"
                    >
                      <span>
                        {figure.label}
                        {coordinateLine(figure, t) ? ` — ${coordinateLine(figure, t)}` : ""}
                      </span>
                      <span className="whitespace-nowrap">
                        {t("compare.creditsAMonth", "{count} credits a month", {
                          count: figure.aiCreditsPerMonth.toLocaleString(locale),
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-card border border-border rounded-xl p-5" data-ai-metering="fieldquo">
                <div className="font-semibold text-foreground">FieldQuo</div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {chrome.aiMeteringOurs}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── The receptionist, where there is a real answer ─────────────────
          Rendered only when comparableTier finds a tier of theirs that ACTUALLY
          carries the feature. Matching by table position instead would set our
          Scale against Jobber Grow at $399 — a plan with no receptionist —
          understating us by $200 and crediting Grow with something it lacks.

          When the function returns null the section still renders, and says
          that nobody established it. That is a CHANGE and the old behaviour
          was wrong in a way worth writing down: this block used to disappear
          entirely, on the reasoning that saying nothing is the correct amount
          to say about a thing nobody checked. It is not — a reader cannot tell
          an omission from an absence, and four of the five competitors here
          have tiers described in prose that no structured feature map covers.
          Silence on all four reads as "they do not have it", which is a claim
          about somebody else's product that nobody made. FEATURE_UNKNOWN is
          not FEATURE_ABSENT, and the page now says which one this is. */}
      {receptionistTier ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <SectionHeading
            id="receptionist"
            title={t("compare.receptionistTitle", "{feature}: what it costs on each side", {
              feature: t(
                "compare.comparableFeature.ai_receptionist",
                receptionistFeature.label,
              ),
            })}
            intro={t(
              "compare.receptionistIntro",
              "Tiers are matched on what they contain, not on where they sit in a table. This is the cheapest {competitor} tier we verified as actually carrying it.",
              { competitor: competitor.name },
            )}
          />
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <div
              className="bg-card border border-border rounded-xl p-5"
              data-receptionist-figure={receptionistTier.id}
            >
              <div className="font-semibold text-foreground">
                {competitor.name} {receptionistTier.label}
              </div>
              <div className="mt-1 text-foreground">{priceLine(receptionistTier.price, t, locale)}</div>
              {coordinateLine(receptionistTier, t) ? (
                <div className="mt-1 text-sm text-muted-foreground">
                  {coordinateLine(receptionistTier, t)}
                </div>
              ) : null}
              <div className="mt-2 text-sm text-muted-foreground">
                {t(
                  "compare.featureOnThisTier",
                  "The feature is {availability} on this tier.",
                  { availability: availabilityWord(FEATURE_INCLUDED, t) },
                )}
              </div>
              {receptionistAddOn ? (
                <div
                  className="mt-3 text-sm text-muted-foreground"
                  data-receptionist-addon={receptionistAddOn.id}
                >
                  {t(
                    "compare.receptionistLowerDown",
                    "Lower down their range it is {availability}: {price}{at}. That is a floor you pay in a month when the phone never rings.",
                    {
                      availability: availabilityWord(FEATURE_ADD_ON, t),
                      price: priceLine(receptionistAddOn.price, t, locale),
                      at: coordinateLine(receptionistAddOn, t)
                        ? t("compare.atCoordinates", " at {coordinates}", {
                            coordinates: coordinateLine(receptionistAddOn, t),
                          })
                        : "",
                    },
                  )}
                </div>
              ) : null}
              <div className="mt-3 text-xs text-muted-foreground">
                {provenanceLine(receptionistTier, t)} ·{" "}
                <SourceLink href={receptionistTier.source}>
                  {t("addOns.sourceLink", "their pricing page")}
                </SourceLink>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="font-semibold text-foreground">FieldQuo</div>
              {/* The narrow claim, on purpose. "AI included" would be false —
                  the feature is on every plan and the talk time is prepaid
                  credit — and "no monthly minimum" is both true and the
                  stronger thing to say to a one-van painter in February. */}
              <div className="mt-1 text-foreground">
                {capabilityLabel("ai_receptionist_no_monthly_floor", t)}
              </div>
              <div
                className="mt-2 text-sm text-muted-foreground"
                data-fieldquo-availability={receptionistFeature.fieldquo}
              >
                {t(
                  "compare.ourAvailability",
                  "It is {availability}. A month with no calls costs nothing for it.",
                  { availability: availabilityWord(receptionistFeature.fieldquo, t) },
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <SectionHeading
            id="receptionist"
            title={t("compare.receptionistTitle", "{feature}: what it costs on each side", {
              feature: t(
                "compare.comparableFeature.ai_receptionist",
                receptionistFeature.label,
              ),
            })}
            intro={t("compare.receptionistUnknownIntro", "We cannot answer this one for {competitor}.", {
              competitor: competitor.name,
            })}
          />
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <div
              className="bg-card border border-border rounded-xl p-5"
              data-capability-match={receptionistFeature.key}
              data-capability-established="false"
            >
              <div className="font-semibold text-foreground">{competitor.name}</div>
              <p className="mt-2 text-sm text-muted-foreground">
                {chrome.matchUnknownIntro}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(
                  "compare.theirWordsNotOurs",
                  "Their plans are described on their page in their own words, and this comparison will not read those words as ours. Their list is above, unedited, and it is the thing to check on their own site.",
                )}
              </p>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="font-semibold text-foreground">FieldQuo</div>
              <div className="mt-1 text-foreground">
                {capabilityLabel("ai_receptionist_no_monthly_floor", t)}
              </div>
              <div
                className="mt-2 text-sm text-muted-foreground"
                data-fieldquo-availability={receptionistFeature.fieldquo}
              >
                {t(
                  "compare.ourAvailability",
                  "It is {availability}. A month with no calls costs nothing for it.",
                  { availability: availabilityWord(receptionistFeature.fieldquo, t) },
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Where we are ahead ────────────────────────────────────────────── */}
      {both.weHaveTheyDont.length > 0 ? (
        <div className="bg-muted border-y border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <SectionHeading
              id="where-we-are-ahead"
              title={chrome.advantageTitle}
              intro={chrome.advantageIntro}
            />
            <div className="mt-8 space-y-4 max-w-3xl">
              {both.weHaveTheyDont
                // Held to the same bar as a price: read off their page by a
                // person who signed for it, or not printed.
                .filter((claim) => claim.publishable)
                .map((claim) => {
                  const cap = FIELDQUO_CAPABILITIES[claim.capability];
                  const counterpoint = counterpointFor(competitor.id, claim.capability, t);
                  return (
                    <div
                      key={claim.capability}
                      data-direction="we-have-they-dont"
                      data-capability={claim.capability}
                      className="bg-card border border-border rounded-xl p-5"
                    >
                      <div className="flex items-start gap-2">
                        <Check
                          size={18}
                          className="text-emerald-600 shrink-0 mt-0.5"
                          aria-hidden="true"
                        />
                        <span className="font-semibold text-foreground">
                          {cap ? capabilityLabel(claim.capability, t) : claim.capability}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {claimProse(claim, asOf).text}.
                      </p>
                      {claimProse(claim, asOf).stale ? (
                        <p
                          className="mt-2 text-sm text-muted-foreground"
                          data-claim-stale={claim.capability}
                        >
                          {chrome.staleClaimNote}
                        </p>
                      ) : null}
                      {/* Their own page's answer, where it has one. Quoting
                          half a sentence because the other half is
                          inconvenient is the same failure as printing a stale
                          price, with better grammar. */}
                      {counterpoint ? (
                        <p
                          className="mt-2 text-sm text-muted-foreground"
                          data-counterpoint={claim.capability}
                        >
                          {counterpoint}
                        </p>
                      ) : null}
                      <div className="mt-3 text-xs text-muted-foreground">
                        <SourceLink href={claim.source}>
                          {t("compare.readOnTheirSite", "Read on their site {checked}", {
                            checked: claim.checked,
                          })}
                        </SourceLink>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Our side, straight out of the matrix ──────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <SectionHeading
          id="what-you-get"
          title={chrome.featuresTitle}
          intro={chrome.featuresIntro}
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {page.features.map((key) => {
            // No `t` here on purpose. This is a server component with no
            // translation context — see the header — so featureEntry returns
            // the matrix's proved English, exactly what this page rendered
            // before the label layer existed. The day these pages gain a
            // language, it is one argument at this one call site rather than a
            // hunt for every place a feature name is printed.
            const entry = featureEntry(key, t);
            // A key with no matrix entry renders nothing at all. The check
            // script fails on it separately, but a page in production must not
            // improvise a feature name to fill a card.
            if (!entry) return null;
            return (
              <div
                key={key}
                data-matrix-key={key}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-start gap-2">
                  <Check
                    size={18}
                    className="text-emerald-600 shrink-0 mt-0.5"
                    aria-hidden="true"
                  />
                  <span className="font-semibold text-foreground">{entry.name}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{entry.summary}</p>
                {/* A partial feature never renders as a tick on its own. The
                    matrix requires `limits` on one for exactly this reason —
                    a hedge with no detail is a yes wearing a hat. */}
                {entry.readiness === "partial" && entry.limits ? (
                  <p
                    className="mt-2 text-sm text-muted-foreground border-l-2 border-border pl-3"
                    data-limits={key}
                  >
                    {t("addOns.limits", "Where it stops:")} {entry.limits}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── The concession, kept and moved ─────────────────────────────────
          This block used to open the page. The owner: "the first thing i see
          is the things that we don't do.. what the fuck is that." He is right,
          and it was my call to defend.

          The reasoning was sound about INCLUDING them — a table of only our
          wins is an advertisement, and somebody who buys on it and then goes
          looking for the app is a refund plus a review. It was wrong about
          ORDER. A comparison page opening with our weaknesses argues the
          other company's case in our own hero.

          So it sits after the price, the add-ons, the receptionist and where
          we are ahead: still on the page, still findable, still driven by
          FIELDQUO_LACKS so a gap cannot be quietly dropped — but it is no
          longer the first thing a stranger reads. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <SectionHeading
          id="what-we-do-not-do"
          title={chrome.concessionTitle}
          intro={page.concessionLede}
        />
        <p className="mt-3 text-sm text-muted-foreground max-w-3xl">
          {chrome.concessionIntro}
        </p>

        {/* ── The price we lose on, computed rather than written ────────────
            QuoteIQ's entry tier is a third of our cheapest rung. The two
            numbers below are their published figure and SEAT_LADDER's first
            rung, resolved in ../entryPrice.js — neither is typed anywhere in
            this directory, so this panel cannot drift from either side's real
            price and cannot be softened without deleting it outright.

            It sits HERE, with the other concessions, rather than in the hero:
            the price section above already prints their cheapest row in full,
            so the fact is not hidden, and the owner's rule about not opening a
            comparison page with our own weaknesses is kept. It is above the
            gap cards rather than below them because it is the one a reader
            came to check.

            The advice at the end is deliberate and is not a rhetorical
            concession. If somebody needs what their entry tier lists, they
            should buy it: a contractor sold more software than he uses churns,
            and the comparison that hid it is the advertisement this module was
            written to prevent. */}
        {entryGap.refusal === null ? (
          <div
            className="mt-8 rounded-xl border border-border bg-card p-5 max-w-3xl"
            data-entry-price-gap={competitor.id}
            data-entry-price-theirs={entryGap.theirs.id}
            data-entry-price-ours={entryGap.ours.tierKey}
          >
            <h3 className="text-lg font-semibold text-foreground">
              {chrome.entryGapTitle}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {chrome.entryGapIntro}
            </p>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-border p-4">
                <div className="font-semibold text-foreground">
                  {competitor.name} {entryGap.theirs.label}
                </div>
                <div className="mt-1 text-foreground">{priceLine(entryGap.theirs.price, t, locale)}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {t(
                    entryGap.theirs.seatsIncluded === 1
                      ? "compare.usersIncludedOne"
                      : "compare.usersIncluded",
                    entryGap.theirs.seatsIncluded === 1
                      ? "{count} user included"
                      : "{count} users included",
                    { count: entryGap.theirs.seatsIncluded },
                  )}
                  {coordinateLine(entryGap.theirs, t)
                    ? ` · ${coordinateLine(entryGap.theirs, t)}`
                    : ""}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {provenanceLine(entryGap.theirs, t)} ·{" "}
                  <SourceLink href={entryGap.theirs.source}>
                    {t("addOns.sourceLink", "their pricing page")}
                  </SourceLink>
                </div>
              </div>
              <div className="rounded-lg border border-border p-4">
                {/* "FieldQuo Solo" — the tier name is ours and stays as it is
                    in every language, the way a competitor's tier name does. */}
                <div className="font-semibold text-foreground">
                  FieldQuo {entryGap.ours.label}
                </div>
                <div className="mt-1 text-foreground">
                  {t("compare.pricePerMonth", "${amount} per month", {
                    amount: entryGap.ours.price.toLocaleString(locale),
                  })}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {t(
                    entryGap.ours.seats === 1
                      ? "compare.entryOursNothingBelowOne"
                      : "compare.entryOursNothingBelow",
                    entryGap.ours.seats === 1
                      ? "{seats} seat, plus {crew} crew at no charge. There is nothing below it."
                      : "{seats} seats, plus {crew} crew at no charge. There is nothing below it.",
                    { seats: entryGap.ours.seats, crew: entryGap.ours.crewSeats },
                  )}
                </div>
              </div>
            </div>
            {/* Their own list, on their own cheapest tier, quoted as their page
                presents it. It is what makes the advice below actionable: a
                reader can see exactly what the cheaper thing does. */}
            {Array.isArray(entryGap.theirs.includedFeatures) &&
            entryGap.theirs.includedFeatures.length > 0 ? (
              <div className="mt-4">
                <div className="text-sm font-medium text-foreground">
                  {chrome.entryGapTheirListIntro}
                </div>
                <ul className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1">
                  {entryGap.theirs.includedFeatures.map((item) => (
                    <li
                      key={item}
                      data-entry-price-feature={item}
                      className="text-sm text-muted-foreground flex gap-2"
                    >
                      <Minus size={13} className="shrink-0 mt-1.5" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <p className="mt-4 text-sm text-muted-foreground">
              {chrome.entryGapAdvice}
            </p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {/* Driven by FIELDQUO_LACKS, which is derived from the capability
              ledger rather than typed out — so the day we ship a phone app,
              this panel loses a card on its own instead of being remembered.
              These are statements about US, which is why they are safe to make
              on every page whatever we did or did not verify about them. */}
          {FIELDQUO_LACKS.map((capability) => {
            const theirs = both.theyHaveWeDont.find((c) => c.capability === capability);
            return (
              <div
                key={capability}
                data-lacks={capability}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-start gap-2">
                  <XIcon size={18} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="font-semibold text-foreground">
                    {capabilityLabel(capability, t)}
                  </span>
                </div>

                {/* The competitor half is attached only when somebody actually
                    read it off their page. Jobber's mobile-app entry is
                    UNVERIFIED and almost certainly true, and "almost certainly"
                    is not a standard this page publishes at — so it says what
                    it does not know instead. */}
                {theirs && theirs.publishable ? (
                  <p
                    className="mt-3 text-sm text-muted-foreground"
                    data-direction="they-have-we-dont"
                    data-capability={capability}
                  >
                    {/* Their claim is a QUOTATION off their own page and is not
                        translated — see lib/marketing/compareLabels.js. Only the
                        frame around it carries a language. */}
                    {t("compare.theySay", "{competitor} says: “{claim}”.", {
                      competitor: competitor.name,
                      claim: claimProse(theirs, asOf).text,
                    })}{" "}
                    <SourceLink href={theirs.source}>
                      {t("compare.readOnTheirSite", "Read on their site {checked}", {
                        checked: theirs.checked,
                      })}
                    </SourceLink>
                    {claimProse(theirs, asOf).stale ? (
                      <span className="block mt-2" data-claim-stale={capability}>
                        {chrome.staleClaimNote}
                      </span>
                    ) : null}
                  </p>
                ) : (
                  <p
                    className="mt-3 text-sm text-muted-foreground"
                    data-direction="they-have-we-dont"
                    data-capability={capability}
                    data-unverified="true"
                  >
                    {chrome.unverifiedConcessionNote}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      <div className="bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {chrome.ctaTitle}
          </h2>
          <p className="mt-3 text-white/90">{chrome.ctaBody}</p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-muted"
          >
            {chrome.ctaButton} <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="bg-muted border-t border-border py-12 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          {chrome.otherPagesTitle}
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto px-4">
          {otherPages.map((other) => (
            <Link
              key={other.slug}
              href={`/compare/${other.slug}`}
              className="text-sm bg-card border border-border px-4 py-2 rounded-full transition-colors hover:border-foreground/40"
            >
              {findCompetitor(other.competitorId)?.name || other.slug}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
