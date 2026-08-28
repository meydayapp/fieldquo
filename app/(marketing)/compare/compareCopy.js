// app/(marketing)/compare/compareCopy.js
//
// The English prose for /compare, and nothing else.
//
// ══ Why this is a data module and not the t() catalog ══════════════════════
//
// Every string in app/i18n/messages.js is gated: check:translations exits
// non-zero when any of the six languages is short a MARKETING key, and the
// public site is the one surface where a missing string is read by somebody
// who has no relationship with the product yet. Putting comparative
// advertising about four named companies into that catalog would mean either
// blocking the deploy on five translations of a legal claim, or machine
// translating one — and a machine-translated sentence about a competitor's
// prices is a sentence nobody has read in the language it is published in.
//
// So this follows app/data/industryContent.js and app/data/productFeatures.js:
// English, in a plain module, outside the catalog. That is a DEBT and not a
// design win — /compare is English-only on a six-language site, and the
// honest fix is locale-prefixed routes plus a human translator for these
// pages specifically, which is the plan already recorded at the end of
// docs/ROADMAP.md. Written down here rather than left for somebody to notice.
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
 * Deliberately not a number: "$4,788" is a withheld figure (their page states
 * no currency) and printing it here would smuggle it past withholdReason.
 */
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
 * ══ Why all four, including the two with no usable prices ══════════════════
 *
 * ServiceTitan publishes no price at all and Projul publishes three without a
 * currency, so both pages have a price section that reports an absence. Both
 * are built anyway, for different reasons:
 *
 *   ServiceTitan — the absence IS the comparison. "Every tier says Request
 *   Pricing" is the safest comparative claim in the whole data model, because
 *   it is about the presence of text on a public page rather than about a
 *   number, and a reader can check it in one click. A visitor searching for
 *   what ServiceTitan costs is exactly the visitor this page is for.
 *
 *   Projul — competitors.js states the preference outright: showing "Projul
 *   does not state a currency" is better comparative advertising than showing
 *   nothing, and much better than showing a number. The page also carries two
 *   claims verified off their page in both directions, so it is not a stub
 *   wrapped around an apology. What it must never do is print the amounts, and
 *   there is no mechanism here that could.
 *
 * A fifth page for a company nobody has read a pricing page for would be the
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
    title: "FieldQuo vs Jobber — what each company publishes",
    description:
      "A side-by-side of FieldQuo and Jobber built only from prices each company prints on its own site, with the combinations we could not settle named rather than guessed.",
    lede:
      "Jobber's price moves with two selectors on their own page — how many " +
      "people you have, and how you agree to pay — so there is no single " +
      "\"Jobber price\" to quote. This page carries only the combinations we " +
      "read ourselves and can still stand behind, and it names the ones we " +
      "could not settle instead of picking whichever reading flattered us.",
    // The sentence that decides whether the reader trusts the rest of the
    // page. It goes above the comparison, not under it.
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
    title: "FieldQuo vs Housecall Pro — what each company publishes",
    description:
      "Housecall Pro prints its prices and so do we, which makes this the most direct of these comparisons — and the one where FieldQuo has the most to concede.",
    lede:
      "Housecall Pro prints its prices in the open, the way we do, which " +
      "makes this the most direct comparison on the site. It is also the one " +
      "where we concede the most: three of the things on their own " +
      "\"included in every plan\" list are things FieldQuo does not do at all.",
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
    title: "FieldQuo vs ServiceTitan — one of us publishes a price",
    description:
      "ServiceTitan's pricing page contains no prices; every tier asks you to request one. FieldQuo's is on the site and you can sign up without speaking to anybody.",
    lede:
      "There is no price column on this page for ServiceTitan, and that is " +
      "not a gap in our research. Their pricing page contains no amounts at " +
      "all — each tier asks you to request one. Whether that is worth your " +
      "phone number is a real question, and it is the whole of this " +
      "comparison.",
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
    title: "FieldQuo vs Projul — the comparison we cannot complete",
    description:
      "Projul prints three annual figures and names no currency for any of them, so there is nothing here we can honestly line up against a FieldQuo price. What we can compare, we do.",
    lede:
      "This is the page where the price comparison does not work, and we " +
      "would rather say so than guess. Projul's pricing page prints three " +
      "annual figures and never names a currency for one of them, so there " +
      "is no honest way to set them beside a FieldQuo price. What we could " +
      "verify on their page — in both directions — is below.",
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
];

export const COMPARE_SLUGS = COMPARE_PAGES.map((p) => p.slug);

export function comparePage(slug) {
  return COMPARE_PAGES.find((p) => p.slug === slug) || null;
}

export function comparePageForCompetitor(competitorId) {
  return COMPARE_PAGES.find((p) => p.competitorId === competitorId) || null;
}

export function counterpointFor(competitorId, capability) {
  return COUNTERPOINTS[competitorId]?.[capability] || null;
}

/** Copy shared by every page under /compare, written once so it cannot drift. */
export const COMPARE_CHROME = {
  eyebrow: "Comparison",

  indexTitle: "Compare FieldQuo",
  indexMetaTitle: "Compare FieldQuo with Jobber, Housecall Pro, ServiceTitan and Projul",
  indexMetaDescription:
    "Side-by-side comparisons built only from what each company publishes on its own site, with every figure we could not verify named rather than filled in.",
  indexLede:
    "Four comparisons, each built from what the other company publishes on " +
    "its own website. Nothing here is converted between currencies, nothing " +
    "is a promotional rate, and anything we could not settle is named rather " +
    "than guessed.",

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

  concessionTitle: "What FieldQuo does not do",
  concessionIntro:
    "This section is on every one of these pages, in the same place, above " +
    "the part where we look good. A comparison table made only of our wins " +
    "sells somebody a subscription they ask for their money back on.",
  unverifiedConcessionNote:
    "We have not checked whether this company offers it, so we are not saying they do.",

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

  ctaTitle: "First month free, and you can read the price before you start",
  ctaBody:
    "No card to start, no call to book, and the price is on the pricing page " +
    "rather than behind a form.",
  ctaButton: "Start your free month",
  ctaSecondary: "See the pricing",

  otherPagesTitle: "The other comparisons",
};
