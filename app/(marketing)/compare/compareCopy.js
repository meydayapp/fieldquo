// app/(marketing)/compare/compareCopy.js
//
// The English prose for /compare, and nothing else.
//
// ══ English here, nine languages in the catalogue ══════════════════════════
//
// This file used to say /compare was English-only by decision, and recorded
// that as a debt: "a machine-translated sentence about a competitor's prices is
// a sentence nobody has read in the language it is published in." The owner
// read the pages in Spanish and found them English, which is what a debt turns
// into when nobody pays it. They are translated now.
//
// The strings below did NOT move into app/i18n/messages.js. They stayed, and
// the catalogue holds a translation of each under a `compare.*` key, resolved
// through compareChrome(t) below. Two reasons for the seam rather than a move:
//
//   • scripts/check-compare-pages.mjs reads COMPARE_CHROME.staleClaimNote and
//     COMPARE_CHROME.ctaTitle directly, and asserts things ABOUT the English —
//     that the stale note is not the same sentence as the unverified one, for
//     instance. Those assertions are about meaning, and they can only be made
//     against one authoritative wording.
//   • the fallback chain then ends somewhere real. A language missing a key
//     prints the English sentence that has been checked, never a raw key.
//
// scripts/check-marketing-i18n.mjs pins the two together: every English
// catalogue entry must be character-identical to the string here, so the
// duplicate cannot rot into a second, unchecked wording — the same guarantee
// scripts/check-feature-labels.mjs already provides for the feature matrix.
//
// The metadata strings (`title`, `description`, `indexMetaTitle`,
// `indexMetaDescription`) stay English and are NOT translated. They are what a
// crawler indexes, and serving a French <title> to an English crawler because
// the last visitor switched languages is worse than not translating it —
// the same decision /industries/[slug] records over its own generateMetadata.
// Proper multilingual SEO needs locale-prefixed routes, which is a routing
// change and is scoped at the end of docs/ROADMAP.md.
//
// ══ What may and may not live in this file ═════════════════════════════════
//
// NOT here: any number, any price, any currency, any claim about what a
// competitor charges or includes. All of that comes from
// lib/marketing/competitors.js, which is the only thing allowed to say it and
// carries the source URL, the vantage point and the verification for every
// word of it.
//
// NOT here either: the name of a single FieldQuo feature. `features` below is
// a list of KEYS into lib/marketing/featureMatrix.js, and the renderer prints
// that module's own `name` and `summary`. A page therefore cannot claim a
// capability the matrix does not carry, because there is no place in this file
// to write one down. That is the difference between a check that has to look
// for a lie and a structure that has nowhere to put one.
//
// What IS here: the editorial voice — why a visitor is on this page, what the
// comparison can honestly settle, and what it cannot.

/**
 * The one thing a competitor's own page says in THEIR favour that our data
 * model records only inside a `note`.
 *
 * lib/marketing/competitors.js flags this on the Projul entry: their page
 * reads "Projul starts at $4,788/year with no per-user fees and unlimited
 * projects", and the note warns that "an honest renderer should not quote the
 * first half without" the second. Cropping a sentence to the half that suits
 * us is the same failure as printing a stale price, with better grammar. So
 * the counterweight is copy we commit to rendering, keyed by the capability
 * whose claim it sits beside, and the check script asserts it reaches the page.
 *
 * Deliberately not a number, and the reason has CHANGED — the old one said
 * Projul's annual figures were withheld because their page states no currency.
 * That was true when it was written and is not true now: the owner asserted
 * the currency on stated grounds, withholdReason accepts a signed assertion,
 * and all three amounts publish through the renderer with whose judgement the
 * currency is printed beside them. The rule that survives is the stronger one
 * and it never depended on the figure being withheld: a number typed into this
 * file bypasses withholdReason ENTIRELY. It would still be printed on the day
 * the assertion is retracted, or the reading goes stale, or their page moves.
 * Every figure on these pages goes through the gate; nothing here is a figure.
 */
// The only import this module has, and it brings no data with it: a function
// that puts a value where a {placeholder} is. The values themselves are
// resolved by ./copyFigures.js out of the gated modules, which is the whole
// point — nothing in this file knows what any of them are.
import { fillFigures } from "./copyFigures";

const COUNTERPOINTS = {
  projul: {
    monthly_billing:
      "Their page makes the case for the annual plan and it is a fair one: " +
      "Projul says its price carries no per-user fee and no cap on the number " +
      "of projects. A shop that adds people often may be better off there.",
  },
};

/**
 * One entry per page under /compare.
 *
 * `competitorId` must name a competitor in lib/marketing/competitors.js; the
 * check script asserts it, so a page cannot exist for a company we hold no
 * verified research on.
 *
 * ══ Why all five, including the one with no prices at all ══════════════════
 *
 *   ServiceTitan — the absence IS the comparison. "Every tier says Request
 *   Pricing" is the safest comparative claim in the whole data model, because
 *   it is about the presence of text on a public page rather than about a
 *   number, and a reader can check it in one click. A visitor searching for
 *   what ServiceTitan costs is exactly the visitor this page is for.
 *
 *   Projul — this page used to be the one where the comparison could not be
 *   completed, because their three annual figures name no currency and every
 *   one of them was withheld. That is no longer the state of the data: the
 *   owner asserted the currency on stated grounds, withholdReason accepts a
 *   signed assertion, and all three amounts now publish with whose judgement
 *   the currency is stated beside each one. The copy below was rewritten to
 *   match — a lede describing a comparison this page can now make is not a
 *   stylistic preference, it is the page telling a visitor something false.
 *
 *   QuoteIQ — the page we lose the top of. Their entry tier is a third of our
 *   cheapest rung, and a comparison that opened at a size where we win would
 *   be the advertisement this whole module exists to prevent. It says so
 *   plainly, in a panel assembled from their published figure and our own
 *   ladder, and it goes further than conceding: if what somebody needs is what
 *   their entry tier lists, they should buy it. A contractor sold three times
 *   the price for software he does not use churns, and the refund is worse
 *   than the sale was good.
 *
 * A sixth page for a company nobody has read a pricing page for would be the
 * thing to refuse, and there is no way to add one without adding the research
 * first.
 */
export const COMPARE_PAGES = [
  {
    slug: "fieldquo-vs-jobber",
    competitorId: "jobber",
    // Read by generateMetadata. Written per page rather than templated: a
    // dozen tabs reading "FieldQuo" is a dozen pages competing for one query,
    // which is the lesson app/data/industryContent.js already paid for.
    title: "FieldQuo vs Jobber — every feature in every plan, from {ourEntry}",
    description:
      "Jobber sells its marketing suite, AI receptionist and sales pipeline as separate add-ons. FieldQuo includes all three in every plan, with field crew free.",
    lede:
      "Jobber sells its marketing suite, its AI receptionist and its sales pipeline as separate monthly add-ons — {addOnTotal} a month on top of a plan whose price already moves with your team size. FieldQuo puts all three in every plan, at every price, and everybody in a van is free.",
    // The sentence that decides whether the reader trusts the rest of the
    // page — and it goes UNDER the argument, not over it.
    //
    // It led the page for months, so every one of these opened by making the
    // competitor's case: "Start with what we do not have", "the one where
    // FieldQuo has the most to concede". A reader who leaves after one screen
    // had read an advertisement for somebody else. The concession is kept,
    // in full and unsoftened, because a page that hides its weakest point is
    // the page a prospect catches — it is simply no longer the opening line.
    concessionLede:
      "Start with what we do not have. FieldQuo is a web application: there " +
      "is nothing to install from an app store, nothing works without a " +
      "signal, and there is no salesperson to walk you through it.",
    features: [
      "voice_receptionist",
      "call_to_quote",
      "ai_quote_review",
      "instant_quotes",
      "white_label",
      "own_email_domain",
      "job_costing",
      "languages",
    ],
  },
  {
    slug: "fieldquo-vs-housecall-pro",
    competitorId: "housecall_pro",
    title: "FieldQuo vs Housecall Pro — every feature in every plan, from {ourEntry}",
    description:
      "Housecall Pro charges per extra user. FieldQuo bills only the people who price work and carries field crew free, with every feature in every plan.",
    lede:
      "Housecall Pro charges for each extra user, so the plan price is only where your bill starts. FieldQuo bills the people who actually price work — quotes, jobs, invoices — and everybody in a van is crew, at no charge. Every feature is in every plan, starting at {ourEntry}.",
    concessionLede:
      "The honest part first. Housecall Pro's page lists a phone app, offline " +
      "access and a guided demo as standard. FieldQuo has none of the three, " +
      "and if any of them decides it for you, they are the better buy.",
    features: [
      "white_label",
      "own_email_domain",
      "website_builder",
      "booking_page",
      "ai_quote_review",
      "self_quote",
      "kitchen_designer",
      "languages",
    ],
  },
  {
    slug: "fieldquo-vs-servicetitan",
    competitorId: "servicetitan",
    title: "FieldQuo vs ServiceTitan — a price you can read, and start tonight",
    description:
      "ServiceTitan publishes no prices; contractors report per-technician fees plus five-figure implementation. Every FieldQuo price is public and you can start tonight.",
    lede:
      "ServiceTitan’s pricing page carries no dollar amount anywhere — you book a demo and the number is negotiated against your revenue and your headcount. Contractors report per-technician monthly fees on top of a five-figure implementation charge and a multi-year contract. Every FieldQuo price is on this page, there is no setup fee, and you can start tonight without speaking to anybody.",
    concessionLede:
      "What we cannot offer, said first: no phone app, nothing that works off " +
      "the network, and nobody to give you a guided tour before you decide.",
    features: [
      "quotes",
      "invoices",
      "scheduling",
      "card_payments",
      "job_costing",
      "dashboard",
      "team_access",
      "white_label",
    ],
  },
  {
    slug: "fieldquo-vs-projul",
    competitorId: "projul",
    title: "FieldQuo vs Projul — every feature in every plan, from {ourEntry}",
    description:
      "Projul sells a flat annual fee. FieldQuo sells seats with field crew free, every feature in every plan, month to month from {ourEntry}.",
    lede:
      "Projul asks for a flat annual commitment up front. FieldQuo is {ourEntry} a month for one seat and five crew, every feature included, and you can leave at the end of any month — you do not have to buy a year to find out whether it suits you.",
    concessionLede:
      "Before the rest: FieldQuo has no phone app, does not work without a " +
      "signal, and has nobody who will demonstrate it to you. Projul will " +
      "book you a demo.",
    features: [
      "quotes",
      "jobs",
      "job_costing",
      "materials",
      "price_book",
      "subcontractor_bids",
      "invoices",
      "white_label",
    ],
  },
  {
    slug: "fieldquo-vs-quoteiq",
    competitorId: "quoteiq",
    title: "FieldQuo vs QuoteIQ — the same list, {ourEntry} against {theirParity}",
    description:
      "QuoteIQ’s cheapest plans can’t build a website, take a booking or let a homeowner price their own job. The plan that matches FieldQuo is their {theirParity} tier. Ours is {ourEntry}.",
    lede:
      "QuoteIQ starts at {theirEntry}, and that plan cannot build you a website, take a booking, or let a homeowner price their own job. The QuoteIQ plan that carries what FieldQuo puts in every plan is their Max tier, at {theirParity} a month. Ours is {ourEntry} — and forty-one things on our list are not in their line-up at any price.",
    concessionLede:
      "The price first, because it is the thing you came to check. QuoteIQ " +
      "starts below our cheapest plan, ships phone apps we do not have, and " +
      "will book you a walkthrough. FieldQuo is a web application with no " +
      "salesperson attached.",
    features: [
      "priced_options",
      "ai_quote_review",
      "instant_quotes",
      "voice_receptionist",
      "job_costing",
      "team_access",
      "white_label",
      "languages",
    ],
  },
];

export const COMPARE_SLUGS = COMPARE_PAGES.map((p) => p.slug);

export function comparePage(slug) {
  return COMPARE_PAGES.find((p) => p.slug === slug) || null;
}

export function comparePageForCompetitor(competitorId) {
  return COMPARE_PAGES.find((p) => p.competitorId === competitorId) || null;
}

export function counterpointFor(competitorId, capability, t) {
  const english = COUNTERPOINTS[competitorId]?.[capability] || null;
  if (english === null) return null;
  return typeof t === "function"
    ? t(counterpointKey(competitorId, capability), english)
    : english;
}

/** Catalogue keys. Written as functions so the prefix appears in one shape. */
export const chromeKey = (field) => `compare.${field}`;
export const ledeKey = (competitorId) => `compare.lede.${competitorId}`;
export const concessionKey = (competitorId) => `compare.concession.${competitorId}`;
export const counterpointKey = (competitorId, capability) =>
  `compare.counterpoint.${competitorId}.${capability}`;

/**
 * The chrome fields that are COPY and therefore translated.
 *
 * Everything not on this list is deliberately excluded rather than forgotten:
 * `indexMetaTitle` and `indexMetaDescription` are crawler-facing (see the file
 * header), and `fieldquoPriceTitle` is the brand name.
 *
 * `rules` is an ARRAY and gets one key per entry, indexed from 1 — a single key
 * holding four sentences would have to be re-split by every language, and the
 * first translator to join them with a different separator breaks the list.
 */
export const CHROME_COPY_FIELDS = Object.freeze([
  "eyebrow",
  "indexTitle",
  "indexLede",
  "rulesTitle",
  "entryGapTitle",
  "entryGapIntro",
  "entryGapTheirListIntro",
  "entryGapAdvice",
  "theirTiersTitle",
  "theirTiersIntro",
  "theirTiersNoMatchNote",
  "matchUnknownIntro",
  "aiMeteringTitle",
  "aiMeteringIntro",
  "aiMeteringOurs",
  "concessionTitle",
  "concessionIntro",
  "unverifiedConcessionNote",
  "staleClaimNote",
  "advantageTitle",
  "advantageIntro",
  "priceTitle",
  "featuresTitle",
  "featuresIntro",
  "ctaTitle",
  "ctaBody",
  "ctaButton",
  "ctaSecondary",
  "otherPagesTitle",
]);

/**
 * COMPARE_CHROME, said in the reader's language.
 *
 * Same optional-t contract as lib/marketing/featureLabels.js: no translator
 * means the English above, unchanged, which is what the check scripts render
 * and assert against. The untranslated fields are carried through as they are
 * rather than dropped, so a caller still reads one object.
 */
export function compareChrome(t) {
  if (typeof t !== "function") return COMPARE_CHROME;
  const said = { ...COMPARE_CHROME };
  for (const field of CHROME_COPY_FIELDS) {
    said[field] = t(chromeKey(field), COMPARE_CHROME[field]);
  }
  said.rules = COMPARE_CHROME.rules.map((rule, i) => t(chromeKey(`rule.${i + 1}`), rule));
  return said;
}

/**
 * One page's lede and concession, said in the reader's language, with any
 * amount it names filled in from the gated data.
 *
 * ══ Why the ledes carry {placeholders} rather than numbers ═════════════════
 *
 * Because this file's own header says they must, and for a while they did not.
 * Five ledes and four <title>s were written with a competitor's price typed
 * straight in, and those were the only amounts on these pages that no gate
 * could reach: a page rendered ninety-five days on emptied every price row,
 * redacted every claim that quoted a figure, and went on saying "$177 a month"
 * and "starts at $29.99" in its opening paragraph. See ./copyFigures.js.
 *
 * `figures` is optional so that a caller with no date — a check reading the
 * English, a tool listing the pages — still gets the template it asked for
 * rather than a sentence full of brackets.
 */
export function comparePageCopy(slug, t, figures = null) {
  const page = comparePage(slug);
  if (!page) return null;
  const said =
    typeof t === "function"
      ? {
          ...page,
          lede: t(ledeKey(page.competitorId), page.lede),
          concessionLede: t(concessionKey(page.competitorId), page.concessionLede),
        }
      : { ...page };
  if (!figures) return said;
  return {
    ...said,
    title: fillFigures(said.title, figures),
    description: fillFigures(said.description, figures),
    lede: fillFigures(said.lede, figures),
    concessionLede: fillFigures(said.concessionLede, figures),
  };
}

/** Copy shared by every page under /compare, written once so it cannot drift. */
export const COMPARE_CHROME = {
  eyebrow: "Comparison",

  indexTitle: "Compare FieldQuo",
  indexMetaTitle: "Compare FieldQuo with Jobber, Housecall Pro, ServiceTitan, Projul and QuoteIQ",
  indexMetaDescription:
    "Side-by-side comparisons built only from what each company publishes on its own site, with every figure we could not verify named rather than filled in.",
  indexLede:
    "Five comparisons, each built from what the other company publishes on " +
    "its own website. Nothing here is converted between currencies, nothing " +
    "is a promotional rate, and anything we could not settle is named rather " +
    "than guessed. One of the five starts cheaper than we do, and that page " +
    "says so before it says anything else.",

  // The rules panel. These are statements about how the page is built, so
  // they are safe to write as prose — none of them is a claim about anybody
  // else's business.
  rulesTitle: "How these pages are put together",
  rules: [
    "Every price is the regular price the company prints on its own pricing page. Sale prices are left out: a page like this one is built once and served for months, and it cannot notice that an offer ended.",
    "Money stays in the currency it was published in. We never convert. An exchange rate is right on the day you look it up and wrong the next, and a converted figure sitting on a static page is arithmetic nobody is checking.",
    "Where we could not settle what a figure meant, the row says so and shows no number. That happens more than you would expect, and it is the part of the page we are most confident in.",
    "Each figure carries the date it was read and the country it was read from, because a price can differ by both.",
  ],

  // ── The entry-price panel ────────────────────────────────────────────────
  //
  // Copy only. Which competitor gets this panel, and both numbers in it, come
  // from ./entryPrice.js — their published figure and our own ladder rung —
  // so there is nowhere here to soften it and nowhere to let it rot.
  entryGapTitle: "They start cheaper than we do",
  entryGapIntro:
    "Not every comparison on this site goes our way and this one does not. " +
    "The two prices below are their published figure and our own cheapest " +
    "rung, both read out of the same records the rest of this page uses.",
  entryGapTheirListIntro:
    "What their own page lists on that plan, in their words:",
  entryGapAdvice:
    "If that is the work you need doing, buy theirs. We would rather write " +
    "that here than sell somebody more software than they use and meet them " +
    "again at the refund. What changes the answer is a crew: their plans " +
    "count every login as a paid user, and ours do not.",

  // ── Their ladder, in their own words ─────────────────────────────────────
  theirTiersTitle: "What each of their plans adds, in their words",
  theirTiersIntro:
    "Their own descriptions of their own tiers, quoted as their page presents " +
    "them and set beside the price each one arrives at. We have not " +
    "translated any of it into our vocabulary: renaming a competitor's " +
    "feature to match one of ours is how a comparison quietly becomes a straw " +
    "man, so the words below are theirs and the list of ours is further down " +
    "this page, separately.",
  theirTiersNoMatchNote:
    "Nobody has established, feature by feature, which of their tiers carries " +
    "which of the capabilities we sell. Their page describes its plans in " +
    "prose and our research records no tier-by-tier answer, so this page " +
    "makes no matched claim in either direction — read their list, read " +
    "ours, and decide.",

  // ── The capability match, when there isn't one ───────────────────────────
  //
  // The section that exists to say nothing was established. Silence would read
  // as "they don't have it", and not having checked is a different fact.
  matchUnknownIntro:
    "Nobody has established which of their tiers carries this, so this page " +
    "does not name one. That is not a claim that they lack it — we did not " +
    "check, and a page that treats what it did not check as an absence is a " +
    "page making things up.",

  // ── Metered AI ───────────────────────────────────────────────────────────
  aiMeteringTitle: "How each side meters its AI",
  aiMeteringIntro:
    "Theirs is sold as a monthly allowance that changes with the tier, " +
    "printed on their own page. Ours is not sold that way, and the honest " +
    "version of that sentence has two halves.",
  aiMeteringOurs:
    "FieldQuo does not sell AI by the credit: there is no per-plan allowance " +
    "on our pricing page to run out of and no larger bundle to move up for. " +
    "The receptionist is on every plan with the talk time bought separately " +
    "as prepaid credit and no monthly minimum, so a month with no calls " +
    "costs nothing for it. The other half, which belongs here too: model use " +
    "is metered per company against a ceiling we set internally, so nothing " +
    "on this page is claiming it is unlimited.",

  concessionTitle: "What FieldQuo does not do",
  concessionIntro:
    "This section is on every one of these pages, in the same place, above " +
    "the part where we look good. A comparison table made only of our wins " +
    "sells somebody a subscription they ask for their money back on.",
  unverifiedConcessionNote:
    "We have not checked whether this company offers it, so we are not saying they do.",
  // Not the same sentence as the one above and it must never become it. That
  // one means nobody looked; this one means somebody looked and it was long
  // enough ago that we will not stand behind the figures any more. The claim
  // still says what it says — only the amounts inside it are held back.
  staleClaimNote:
    "That reading is more than three months old, so any amount inside it is " +
    "held back until somebody checks their page again. Follow the link and " +
    "see what it says today.",

  advantageTitle: "Where FieldQuo is ahead",
  advantageIntro:
    "Each of these was read off their own page on the date shown. Follow the " +
    "link and check it — that is what the link is for.",

  priceTitle: "Price, as each company publishes it",
  fieldquoPriceTitle: "FieldQuo",
  withheldTitle: "What we are not publishing, and why",
  withheldIntro:
    "These are figures we hold and will not print. Each one names the reason. " +
    "A blank cell would have been easier and would have told you nothing.",

  featuresTitle: "What you get with FieldQuo",
  featuresIntro:
    "Every line below is a feature with an implementation behind it. The list " +
    "is generated from the same record the engineering checks run against, so " +
    "a feature that stops working stops being advertised.",

  ctaTitle: "First month free with a card on file, and you can read the price before you start",
  // ══ This said "No card to start", and that was false ══════════════════════
  //
  // /api/companies commits the Company and then opens Stripe Checkout
  // (createTrialCheckoutSession), and app/app/layout.js sends an owner whose
  // company has no subscription back to pay before it will show a dashboard. A
  // card IS taken at signup; what is true is that it is not charged for thirty
  // days (subscription_data.trial_period_days, and TRIAL_PRICE = 0).
  //
  // scripts/check-marketing-cta.mjs was written to ban exactly this sentence
  // and could not see it: its ban was scoped to the `hero.noCard` catalogue key
  // and to the files the HOMEPAGE imports, while this is a hand-written English
  // literal on /compare and on all nine /compare/[slug] pages — the surface a
  // shopper reads while deciding. That check now reads the whole marketing tree
  // for the claim itself rather than for one key.
  //
  // The replacement is the wording app/i18n/industries/en.js already uses for
  // the same promise, so the site makes one statement about the card rather
  // than two.
  // Phrased so it does not repeat ctaTitle's "First month free" back at the
  // reader, and so the part that was being hidden — that a card IS taken — is
  // the part stated plainly rather than implied by an absence.
  ctaBody:
    "No call to book, and the price is on the pricing page rather than behind " +
    "a form. Your card is taken at signup and isn't charged until the free " +
    "month ends.",
  ctaButton: "Start your free month",
  ctaSecondary: "See the pricing",

  otherPagesTitle: "The other comparisons",
};

// Declared last on purpose: it READS COMPARE_CHROME and COMPARE_PAGES at module
// load, and a const cannot reach a binding declared below it. Sitting beside
// the helpers that build it would have thrown on import — a temporal dead zone
// error at the top of every /compare render, not a subtle one.
/** Every catalogue key this module can ask for, for the coverage check. */
export const COMPARE_COPY_KEYS = Object.freeze([
  ...CHROME_COPY_FIELDS.map(chromeKey),
  ...COMPARE_CHROME.rules.map((_, i) => chromeKey(`rule.${i + 1}`)),
  ...COMPARE_PAGES.flatMap((p) => [ledeKey(p.competitorId), concessionKey(p.competitorId)]),
  ...Object.entries(COUNTERPOINTS).flatMap(([id, caps]) =>
    Object.keys(caps).map((cap) => counterpointKey(id, cap)),
  ),
]);
