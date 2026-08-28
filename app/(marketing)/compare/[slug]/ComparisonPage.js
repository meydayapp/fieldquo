// app/(marketing)/compare/[slug]/ComparisonPage.js
//
// One comparison page, rendered from lib/marketing/competitors.js and
// lib/marketing/featureMatrix.js. Everything a visitor reads that is a claim
// about anybody — us or them — comes out of one of those two modules. This
// file decides layout and nothing else.
//
// ══ Why there is no "use client" here ══════════════════════════════════════
//
// /pricing and /industries/[slug] are split into a server half and a client
// half because their copy comes from the t() catalog and translation lives in
// React context. These pages are English-only on purpose (see the header of
// ../compareCopy.js for the debt that creates), so there is no context to
// enter and the whole page renders on the server. That is not just simpler —
// it means the check script can await the real page function and get markup,
// with no provider to stand up and no hook to stub.
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
//   • name a FieldQuo feature. Feature rows are keys into the matrix and the
//     matrix's own `name` and `summary` are what get printed;
//   • say the AI receptionist is "included". It is on every plan and the talk
//     time is prepaid credit — see AVAILABILITY_WORDS below.

import Link from "next/link";
import { ArrowRight, Check, ExternalLink, Info, Minus, X as XIcon } from "lucide-react";

import {
  BILLING_MODES,
  COMPARABLE_FEATURES,
  FEATURE_ABSENT,
  FEATURE_ADD_ON,
  FEATURE_INCLUDED,
  FEATURE_INCLUDED_USAGE_EXTRA,
  FEATURE_UNKNOWN,
  FIELDQUO_CAPABILITIES,
  FIELDQUO_LACKS,
  FIELDQUO_REFERENCE,
  PRICE_AMOUNT,
  PRICE_FREE,
  PRICE_NOT_OFFERED,
  PRICE_ON_REQUEST,
  PRICE_UNKNOWN,
  TEAM_SIZES,
  allAddOns,
  claims,
  comparableTier,
  competitor as findCompetitor,
  withholdReason,
} from "@/lib/marketing/competitors";
import { matrixEntry } from "@/lib/marketing/featureMatrix";

import { COMPARE_CHROME, COMPARE_PAGES, comparePage, counterpointFor } from "../compareCopy";

// ── How a price kind reads in a sentence ───────────────────────────────────
//
// Five kinds, five different sentences, and the module exists because any two
// of them collapsing is the bug. "Not offered at this size" is not "we don't
// know", and neither is "they won't tell you" — so each gets its own words and
// none of them falls back to another. A kind with no entry here renders
// nothing rather than borrowing the nearest one.
function priceLine(price) {
  if (!price) return null;
  switch (price.kind) {
    case PRICE_AMOUNT:
      // Currency named beside the amount, always, and only ever the one the
      // figure carries. A bare "$59" on a page read in Canada is a number
      // pretending to be local.
      return `$${price.amount.toLocaleString("en-US")} ${price.currency} per ${price.per}`;
    case PRICE_FREE:
      return `Free (${price.currency})`;
    case PRICE_ON_REQUEST:
      // Their button's own words. That the words exist is the claim; it is
      // checkable by anybody in one click, which is what makes it safe.
      return `No price published — their page says “${price.ask}”`;
    case PRICE_NOT_OFFERED:
      return "Not sold at this size";
    case PRICE_UNKNOWN:
      return null;
    default:
      return null;
  }
}

// ── How a feature's availability reads ─────────────────────────────────────
//
// FEATURE_INCLUDED and FEATURE_INCLUDED_USAGE_EXTRA must never share a
// sentence. Ours is the second one: the receptionist is on every plan and the
// talk time is prepaid credit (lib/voice/credits.js), so "AI included" beside
// our price would be a false claim about our OWN price to a visitor who then
// meets a top-up on their first call. The check script asserts these two
// strings differ, because the collapse is a one-line edit that reads as tidying.
const AVAILABILITY_WORDS = {
  [FEATURE_INCLUDED]: "in the plan price",
  [FEATURE_INCLUDED_USAGE_EXTRA]:
    "on every plan, with the talk time bought separately as prepaid credit",
  [FEATURE_ADD_ON]: "a paid add-on on top of the plan",
  [FEATURE_ABSENT]: "not on that tier",
  [FEATURE_UNKNOWN]: "not established",
};

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

/** Where and when a figure was read. Never omitted from a published figure. */
function provenanceLine(figure) {
  return `Read from a ${figure.observedFrom} connection on ${figure.checked}`;
}

/** The point on a competitor's own selectors that a figure was read at. */
function coordinateLine(figure) {
  const parts = [];
  if (figure.axis?.teamSize) {
    const size = TEAM_SIZES[figure.axis.teamSize];
    parts.push(size ? size.label : figure.axis.teamSize);
  }
  if (figure.axis?.billing) {
    const mode = BILLING_MODES[figure.axis.billing];
    parts.push(mode ? mode.label : figure.axis.billing);
  }
  // A competitor with no axes has nothing to locate — ServiceTitan declares
  // none, and an invented coordinate would be worse than a missing one. So an
  // empty coordinate renders as nothing rather than as "all sizes".
  if (parts.length === 0) return null;
  return parts.join(" · ");
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
  const page = comparePage(slug);
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

  const ladder = FIELDQUO_REFERENCE.ladder;
  const otherPages = COMPARE_PAGES.filter((p) => p.slug !== slug);

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <div className="bg-muted border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {COMPARE_CHROME.eyebrow}
          </span>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold text-foreground leading-tight">
            FieldQuo vs {competitor.name}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-3xl">{page.lede}</p>

          {/* The date the page speaks as of. A static page cannot say "today",
              so it says which day it meant. See ../asOf.js. */}
          <p className="mt-4 text-sm text-muted-foreground" data-as-of={asOf}>
            <Info size={14} className="inline align-[-2px] mr-1" aria-hidden="true" />
            Prepared as of {asOf}. Every figure below also carries the day it was
            read and the country it was read from.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-primary"
            >
              {COMPARE_CHROME.ctaButton} <ArrowRight size={16} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 border border-border px-6 py-3 rounded-full text-sm font-semibold text-foreground hover:bg-card"
            >
              {COMPARE_CHROME.ctaSecondary}
            </Link>
          </div>
        </div>
      </div>

      {/* ── The concession, before anything flattering ─────────────────────
          Deliberately the first section after the hero and styled like every
          other one. A comparison made only of our wins sells a subscription
          somebody asks their money back for, and burying the gaps in a footer
          is the same lie told more quietly. */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <SectionHeading
          id="what-we-do-not-do"
          title={COMPARE_CHROME.concessionTitle}
          intro={page.concessionLede}
        />
        <p className="mt-3 text-sm text-muted-foreground max-w-3xl">
          {COMPARE_CHROME.concessionIntro}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {/* Driven by FIELDQUO_LACKS, which is derived from the capability
              ledger rather than typed out — so the day we ship a phone app,
              this panel loses a card on its own instead of being remembered.
              These are statements about US, which is why they are safe to make
              on every page whatever we did or did not verify about them. */}
          {FIELDQUO_LACKS.map((capability) => {
            const cap = FIELDQUO_CAPABILITIES[capability];
            const theirs = both.theyHaveWeDont.find((c) => c.capability === capability);
            return (
              <div
                key={capability}
                data-lacks={capability}
                className="bg-card border border-border rounded-xl p-5"
              >
                <div className="flex items-start gap-2">
                  <XIcon size={18} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="font-semibold text-foreground">{cap.label}</span>
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
                    {competitor.name} says: “{theirs.claim}”.{" "}
                    <SourceLink href={theirs.source}>
                      Read on their site {theirs.checked}
                    </SourceLink>
                  </p>
                ) : (
                  <p
                    className="mt-3 text-sm text-muted-foreground"
                    data-direction="they-have-we-dont"
                    data-capability={capability}
                    data-unverified="true"
                  >
                    {COMPARE_CHROME.unverifiedConcessionNote}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Price ─────────────────────────────────────────────────────────── */}
      <div className="bg-muted border-y border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <SectionHeading id="price" title={COMPARE_CHROME.priceTitle} />

          <div className="mt-4 rounded-xl border border-border bg-card p-5 max-w-3xl">
            <h3 className="text-sm font-semibold text-foreground">
              {COMPARE_CHROME.rulesTitle}
            </h3>
            <ul className="mt-3 space-y-2">
              {COMPARE_CHROME.rules.map((rule) => (
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
                {COMPARE_CHROME.fieldquoPriceTitle}
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
                      <div className="text-sm text-muted-foreground">
                        {tier.seats} {tier.seats === 1 ? "seat" : "seats"}, plus{" "}
                        {tier.crewSeats} crew at no charge
                      </div>
                    </div>
                    <div className="text-foreground font-semibold whitespace-nowrap">
                      ${tier.price} per month
                    </div>
                  </div>
                ))}
              </div>
              {/* Why no conversion is needed on our side either: the CAD and
                  USD rows carry the same number, so a USD competitor lines up
                  against the USD row with no arithmetic anywhere. */}
              <p className="mt-4 text-sm text-muted-foreground">
                {FIELDQUO_REFERENCE.sameNumberBothCurrencies
                  ? `The same number in each currency we sell in (${FIELDQUO_REFERENCE.currencies.join(
                      " and ",
                    )}) — $${FIELDQUO_REFERENCE.entryTier.price} in each is a real FieldQuo price, so nothing on this page has to be converted to line them up. Which currency you are billed in comes from the business address you give at signup.`
                  : `Sold in ${FIELDQUO_REFERENCE.currencies.join(" and ")}.`}
              </p>
            </div>

            {/* Their side. Published figures only — the rest is below, with
                reasons. */}
            <div>
              <h3 className="text-lg font-semibold text-foreground">{competitor.name}</h3>
              {published.length === 0 ? (
                <p className="mt-4 text-muted-foreground">
                  There is nothing on {competitor.name}&rsquo;s pricing page that we can
                  publish as a price. Every figure we hold is listed below with the
                  reason it is being withheld.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {published.map((figure) => {
                    const line = priceLine(figure.price);
                    const coordinates = coordinateLine(figure);
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
                            {figure.seatsIncluded}{" "}
                            {figure.seatsIncluded === 1 ? "user" : "users"} included
                          </div>
                        ) : null}
                        <div className="mt-2 text-xs text-muted-foreground">
                          {provenanceLine(figure)} ·{" "}
                          <SourceLink href={figure.source}>their pricing page</SourceLink>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── The withheld figures ──────────────────────────────────────
              Rendered, with reasons, rather than dropped. competitors.js is
              explicit that a labelled absence beats both a blank cell and a
              number, and this is the part of the page we are surest of. Note
              what is NOT printed here: `price.amount`. Jobber's suppressed
              annual rows hold real amounts and none of them reaches the DOM. */}
          {withheld.length > 0 ? (
            <div className="mt-12 max-w-3xl">
              <h3 className="text-lg font-semibold text-foreground">
                {COMPARE_CHROME.withheldTitle}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {COMPARE_CHROME.withheldIntro}
              </p>
              <ul className="mt-4 divide-y divide-border border border-border rounded-xl bg-card">
                {withheld.map(({ figure, reason }) => (
                  <li
                    key={figure.id}
                    data-figure-id={figure.id}
                    data-published="false"
                    data-withhold-reason={reason}
                    className="p-4"
                  >
                    <div className="font-medium text-foreground">
                      {competitor.name} {figure.label}
                      {coordinateLine(figure)
                        ? ` — ${coordinateLine(figure)}`
                        : ""}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Not published here: {reason}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── The receptionist, where there is a real answer ─────────────────
          Rendered only when comparableTier finds a tier of theirs that ACTUALLY
          carries the feature. Matching by table position instead would set our
          Scale against Jobber Grow at $399 — a plan with no receptionist —
          understating us by $200 and crediting Grow with something it lacks.
          For a competitor whose tiers were never inspected for this feature,
          the function returns null and this whole section does not exist,
          which is the correct amount to say about a thing nobody checked. */}
      {receptionistTier ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <SectionHeading
            id="receptionist"
            title={`${receptionistFeature.label}: what it costs on each side`}
            intro={`Tiers are matched on what they contain, not on where they sit in a table. This is the cheapest ${competitor.name} tier we verified as actually carrying it.`}
          />
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <div
              className="bg-card border border-border rounded-xl p-5"
              data-receptionist-figure={receptionistTier.id}
            >
              <div className="font-semibold text-foreground">
                {competitor.name} {receptionistTier.label}
              </div>
              <div className="mt-1 text-foreground">{priceLine(receptionistTier.price)}</div>
              {coordinateLine(receptionistTier) ? (
                <div className="mt-1 text-sm text-muted-foreground">
                  {coordinateLine(receptionistTier)}
                </div>
              ) : null}
              <div className="mt-2 text-sm text-muted-foreground">
                The feature is {AVAILABILITY_WORDS[FEATURE_INCLUDED]} on this tier.
              </div>
              {receptionistAddOn ? (
                <div
                  className="mt-3 text-sm text-muted-foreground"
                  data-receptionist-addon={receptionistAddOn.id}
                >
                  Lower down their range it is {AVAILABILITY_WORDS[FEATURE_ADD_ON]}:{" "}
                  {priceLine(receptionistAddOn.price)}
                  {coordinateLine(receptionistAddOn)
                    ? ` at ${coordinateLine(receptionistAddOn)}`
                    : ""}
                  . That is a floor you pay in a month when the phone never rings.
                </div>
              ) : null}
              <div className="mt-3 text-xs text-muted-foreground">
                {provenanceLine(receptionistTier)} ·{" "}
                <SourceLink href={receptionistTier.source}>their pricing page</SourceLink>
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="font-semibold text-foreground">FieldQuo</div>
              {/* The narrow claim, on purpose. "AI included" would be false —
                  the feature is on every plan and the talk time is prepaid
                  credit — and "no monthly minimum" is both true and the
                  stronger thing to say to a one-van painter in February. */}
              <div className="mt-1 text-foreground">
                {FIELDQUO_CAPABILITIES.ai_receptionist_no_monthly_floor.label}
              </div>
              <div
                className="mt-2 text-sm text-muted-foreground"
                data-fieldquo-availability={receptionistFeature.fieldquo}
              >
                It is {AVAILABILITY_WORDS[receptionistFeature.fieldquo]}. A month with no
                calls costs nothing for it.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Where we are ahead ────────────────────────────────────────────── */}
      {both.weHaveTheyDont.length > 0 ? (
        <div className="bg-muted border-y border-border">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
            <SectionHeading
              id="where-we-are-ahead"
              title={COMPARE_CHROME.advantageTitle}
              intro={COMPARE_CHROME.advantageIntro}
            />
            <div className="mt-8 space-y-4 max-w-3xl">
              {both.weHaveTheyDont
                // Held to the same bar as a price: read off their page by a
                // person who signed for it, or not printed.
                .filter((claim) => claim.publishable)
                .map((claim) => {
                  const cap = FIELDQUO_CAPABILITIES[claim.capability];
                  const counterpoint = counterpointFor(competitor.id, claim.capability);
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
                          {cap ? cap.label : claim.capability}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{claim.claim}.</p>
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
                          Read on their site {claim.checked}
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
          title={COMPARE_CHROME.featuresTitle}
          intro={COMPARE_CHROME.featuresIntro}
        />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {page.features.map((key) => {
            const entry = matrixEntry(key);
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
                    Where it stops: {entry.limits}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Close ─────────────────────────────────────────────────────────── */}
      <div className="bg-primary">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">
            {COMPARE_CHROME.ctaTitle}
          </h2>
          <p className="mt-3 text-white/90">{COMPARE_CHROME.ctaBody}</p>
          <Link
            href="/signup"
            className="mt-6 inline-flex items-center gap-2 bg-card text-foreground px-6 py-3 rounded-full text-sm font-semibold hover:bg-muted"
          >
            {COMPARE_CHROME.ctaButton} <ArrowRight size={16} />
          </Link>
        </div>
      </div>

      <div className="bg-muted border-t border-border py-12 text-center">
        <p className="text-sm text-muted-foreground mb-3">
          {COMPARE_CHROME.otherPagesTitle}
        </p>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl mx-auto px-4">
          {otherPages.map((other) => (
            <Link
              key={other.slug}
              href={`/compare/${other.slug}`}
              className="text-sm bg-card border border-border px-4 py-2 rounded-full hover:border-border"
            >
              {findCompetitor(other.competitorId)?.name || other.slug}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
