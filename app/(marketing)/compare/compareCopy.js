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
    title: "FieldQuo vs Projul — their figures, and whose dollar they are",
    description:
      "Projul prints three annual figures and names no currency for any of them. The amounts here are theirs, read off their own page; the currency beside each one is FieldQuo's owner asserting it, and every figure says which half is which.",
    lede:
      "Projul's pricing page prints three annual figures and never names a " +
      "currency for one of them. That used to keep the whole price " +
      "comparison off this page. It no longer does, and the reason is worth " +
      "reading before the numbers: the amounts below were read off their own " +
      "page, and the currency beside each one is FieldQuo's owner asserting " +
      "it on stated grounds rather than anything Projul says. Every figure " +
      "carries that split, because their number and our judgement are not " +
      "the same kind of fact.",
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
    title: "FieldQuo vs QuoteIQ — they are cheaper to start, and here is where that turns",
    description:
      "QuoteIQ's entry plan costs a fraction of FieldQuo's cheapest, for one user. This page says so first, says who should buy it, and then says what changes once there is a crew.",
    // The one page whose lede has to concede before it argues. Everything else
    // on this site can lead with the case; a comparison against a competitor
    // who is genuinely cheaper at the size a solo contractor starts at cannot,
    // because the visitor already knows and will stop reading a page that
    // pretends otherwise.
    lede:
      "QuoteIQ is cheaper than FieldQuo at one person, and it is not close. " +
      "Their entry plan is a fraction of our cheapest rung, they print both " +
      "prices openly, and if what you need is what that plan lists, you " +
      "should buy it rather than us. What this page is for is the part after " +
      "that: their plans count every login as a paid user, ours bill only " +
      "the people who price work and put field crew on for nothing, and that " +
      "is where the arithmetic turns.",
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

export function counterpointFor(competitorId, capability) {
  return COUNTERPOINTS[competitorId]?.[capability] || null;
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

  ctaTitle: "First month free, and you can read the price before you start",
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
