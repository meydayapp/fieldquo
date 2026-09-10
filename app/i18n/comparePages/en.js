// app/i18n/comparePages/en.js
//
// English source of truth for /compare — and the pin the other eight languages
// are measured against.
//
// ══ Why these strings exist here as well as in the page modules ════════════
//
// The chrome, the per-page ledes and the counterpoint are ALSO written in
// app/(marketing)/compare/compareCopy.js, and that duplication is deliberate
// and checked. compareCopy.js is what scripts/check-compare-pages.mjs asserts
// against — that the stale-reading note is not the same sentence as the
// never-checked note, for instance — and those are assertions about MEANING,
// which can only be made against one authoritative wording.
//
// So the module keeps the authority and this file carries the copy that t()
// resolves. scripts/check-marketing-i18n.mjs asserts every entry below is
// character-identical to the module's, exactly as scripts/check-feature-labels
// .mjs pins the feature matrix's names. The duplicate cannot rot into a second
// wording, and a language missing a key still prints a sentence somebody
// checked rather than a raw key.
//
// ══ What is NOT in here ═══════════════════════════════════════════════════
//
//   • any competitor's own words — tier names, the feature lists their page
//     prints, the sentence on their request-a-price button, the `claim` prose
//     recorded against a capability. Those are quotations, and a quotation that
//     has been through a translator is no longer one. See the header of
//     lib/marketing/compareLabels.js.
//   • any amount. Every figure on these pages comes from
//     lib/marketing/competitors.js through withholdReason(), and a number typed
//     into a catalogue is a number that bypasses the gate.
//   • page titles and meta descriptions. Those are what a crawler indexes and
//     stay English until the site has locale-prefixed routes.
//
// ══ For translators ═══════════════════════════════════════════════════════
//
// Never translate: FieldQuo, Jobber, Housecall Pro, ServiceTitan, Projul,
// QuoteIQ, their plan names (Core, Connect, Grow, Plus, Basic, Essentials, Max,
// Starter, The Works), QuickBooks, Xero, iOS, Android, CSV, or a currency code.
// {placeholders} are substituted at render and must survive verbatim.

const en = {
  "compare.eyebrow": "Comparison",
  "compare.indexTitle": "Compare FieldQuo",
  "compare.indexLede": "Five comparisons, each built from what the other company publishes on its own website. Nothing here is converted between currencies, nothing is a promotional rate, and anything we could not settle is named rather than guessed. One of the five starts cheaper than we do, and that page says so before it says anything else.",
  "compare.rulesTitle": "How these pages are put together",
  "compare.entryGapTitle": "They start cheaper than we do",
  "compare.entryGapIntro": "Not every comparison on this site goes our way and this one does not. The two prices below are their published figure and our own cheapest rung, both read out of the same records the rest of this page uses.",
  "compare.entryGapTheirListIntro": "What their own page lists on that plan, in their words:",
  "compare.entryGapAdvice": "If that is the work you need doing, buy theirs. We would rather write that here than sell somebody more software than they use and meet them again at the refund. What changes the answer is a crew: their plans count every login as a paid user, and ours do not.",
  "compare.theirTiersTitle": "What each of their plans adds, in their words",
  "compare.theirTiersIntro": "Their own descriptions of their own tiers, quoted as their page presents them and set beside the price each one arrives at. We have not translated any of it into our vocabulary: renaming a competitor's feature to match one of ours is how a comparison quietly becomes a straw man, so the words below are theirs and the list of ours is further down this page, separately.",
  "compare.theirTiersNoMatchNote": "Nobody has established, feature by feature, which of their tiers carries which of the capabilities we sell. Their page describes its plans in prose and our research records no tier-by-tier answer, so this page makes no matched claim in either direction — read their list, read ours, and decide.",
  "compare.matchUnknownIntro": "Nobody has established which of their tiers carries this, so this page does not name one. That is not a claim that they lack it — we did not check, and a page that treats what it did not check as an absence is a page making things up.",
  "compare.aiMeteringTitle": "How each side meters its AI",
  "compare.aiMeteringIntro": "Theirs is sold as a monthly allowance that changes with the tier, printed on their own page. Ours is not sold that way, and the honest version of that sentence has two halves.",
  "compare.aiMeteringOurs": "FieldQuo does not sell AI by the credit: there is no per-plan allowance on our pricing page to run out of and no larger bundle to move up for. The receptionist is on every plan with the talk time bought separately as prepaid credit and no monthly minimum, so a month with no calls costs nothing for it. The other half, which belongs here too: model use is metered per company against a ceiling we set internally, so nothing on this page is claiming it is unlimited.",
  "compare.concessionTitle": "What FieldQuo does not do",
  "compare.concessionIntro": "This section is on every one of these pages, in the same place, above the part where we look good. A comparison table made only of our wins sells somebody a subscription they ask for their money back on.",
  "compare.unverifiedConcessionNote": "We have not checked whether this company offers it, so we are not saying they do.",
  "compare.staleClaimNote": "That reading is more than three months old, so any amount inside it is held back until somebody checks their page again. Follow the link and see what it says today.",
  "compare.advantageTitle": "Where FieldQuo is ahead",
  "compare.advantageIntro": "Each of these was read off their own page on the date shown. Follow the link and check it — that is what the link is for.",
  "compare.priceTitle": "Price, as each company publishes it",
  "compare.featuresTitle": "What you get with FieldQuo",
  "compare.featuresIntro": "Every line below is a feature with an implementation behind it. The list is generated from the same record the engineering checks run against, so a feature that stops working stops being advertised.",
  "compare.ctaTitle": "First month free with a card on file, and you can read the price before you start",
  "compare.ctaBody": "No call to book, and the price is on the pricing page rather than behind a form. Your card is taken at signup and isn't charged until the free month ends.",
  "compare.ctaButton": "Start your free month",
  "compare.ctaSecondary": "See the pricing",
  "compare.otherPagesTitle": "The other comparisons",
  "compare.rule.1": "Every price is the regular price the company prints on its own pricing page. Sale prices are left out: a page like this one is built once and served for months, and it cannot notice that an offer ended.",
  "compare.rule.2": "Money stays in the currency it was published in. We never convert. An exchange rate is right on the day you look it up and wrong the next, and a converted figure sitting on a static page is arithmetic nobody is checking.",
  "compare.rule.3": "Where we could not settle what a figure meant, the row says so and shows no number. That happens more than you would expect, and it is the part of the page we are most confident in.",
  "compare.rule.4": "Each figure carries the date it was read and the country it was read from, because a price can differ by both.",

  "compare.lede.jobber": "Jobber sells its marketing suite, its AI receptionist and its sales pipeline as separate monthly add-ons — $177 a month on top of a plan whose price already moves with your team size. FieldQuo puts all three in every plan, at every price, and everybody in a van is free.",
  "compare.concession.jobber": "Start with what we do not have. FieldQuo is a web application: there is nothing to install from an app store, nothing works without a signal, and there is no salesperson to walk you through it.",
  "compare.lede.housecall_pro": "Housecall Pro charges for each extra user, so the plan price is only where your bill starts. FieldQuo bills the people who actually price work — quotes, jobs, invoices — and everybody in a van is crew, at no charge. Every feature is in every plan, starting at $99.",
  "compare.concession.housecall_pro": "The honest part first. Housecall Pro's page lists a phone app, offline access and a guided demo as standard. FieldQuo has none of the three, and if any of them decides it for you, they are the better buy.",
  "compare.lede.servicetitan": "ServiceTitan’s pricing page carries no dollar amount anywhere — you book a demo and the number is negotiated against your revenue and your headcount. Contractors report per-technician monthly fees on top of a five-figure implementation charge and a multi-year contract. Every FieldQuo price is on this page, there is no setup fee, and you can start tonight without speaking to anybody.",
  "compare.concession.servicetitan": "What we cannot offer, said first: no phone app, nothing that works off the network, and nobody to give you a guided tour before you decide.",
  "compare.lede.projul": "Projul asks for a flat annual commitment up front. FieldQuo is $99 a month for one seat and five crew, every feature included, and you can leave at the end of any month — you do not have to buy a year to find out whether it suits you.",
  "compare.concession.projul": "Before the rest: FieldQuo has no phone app, does not work without a signal, and has nobody who will demonstrate it to you. Projul will book you a demo.",
  "compare.lede.quoteiq": "QuoteIQ starts at $29.99, and that plan cannot build you a website, take a booking, or let a homeowner price their own job. The QuoteIQ plan that carries what FieldQuo puts in every plan is their Max tier, at $699 a month. Ours is $99 — and forty-one things on our list are not in their line-up at any price.",
  "compare.concession.quoteiq": "The price first, because it is the thing you came to check. QuoteIQ starts below our cheapest plan, ships phone apps we do not have, and will book you a walkthrough. FieldQuo is a web application with no salesperson attached.",

  "compare.counterpoint.projul.monthly_billing": "Their page makes the case for the annual plan and it is a fair one: Projul says its price carries no per-user fee and no cap on the number of projects. A shop that adds people often may be better off there.",

  "compare.capability.mobile_app": "Native mobile app (iOS / Android)",
  "compare.capability.offline_use": "Works offline",
  "compare.capability.self_serve_demo": "Book a guided demo with a salesperson",
  "compare.capability.accounting_sync": "Two-way sync with QuickBooks or Xero",
  "compare.capability.gantt_charts": "Gantt charts and linked project timelines",
  "compare.capability.purchase_orders": "Purchase orders to suppliers",
  "compare.capability.daily_logs": "Daily site logs",
  "compare.capability.geofencing": "Geolocation and geofenced clock-in",
  "compare.capability.field_worker_quotes": "Field crew can price and send a quote from the van",
  "compare.capability.entry_price_below_our_floor": "A paid plan below FieldQuo's cheapest rung",
  "compare.capability.ai_receptionist_no_monthly_floor": "AI phone receptionist on every plan, with no monthly minimum",
  "compare.capability.self_serve_signup": "Sign up and start without talking to anyone",
  "compare.capability.published_price": "Price published openly, no sales call",
  "compare.capability.monthly_billing": "Pay monthly, no annual commitment required",
  "compare.capability.free_crew_seats": "Field crew included free — only people who originate money are billed",

  "compare.teamSize.solo": "Just me",
  "compare.teamSize.2-5": "2-5 people",
  "compare.teamSize.6-10": "6-10 people",
  "compare.teamSize.11-15": "11-15 people",
  "compare.teamSize.16-plus": "16 or more",
  "compare.billing.annual_prepaid": "Annual, prepaid",
  "compare.billing.monthly_1yr": "Monthly, 1 year commitment",
  "compare.billing.monthly_none": "Monthly, no commitment",

  "compare.comparableFeature.ai_receptionist": "AI phone receptionist",

  // ── The index page ──────────────────────────────────────────────────────
  "compare.vs": "FieldQuo vs {competitor}",
  "compare.preparedAsOf": "Prepared as of {date}.",
  "compare.preparedAsOfLong": "Prepared as of {date}. Every figure below also carries the day it was read and the country it was read from.",
  "compare.readComparison": "Read the comparison",

  // What one card may claim, assembled in ../../(marketing)/compare/summary.js.
  "compare.summary.amountsSourced": "{count} of their published prices can be set beside ours, in the currency they print it in.",
  "compare.summary.amounts": "{count} of their published prices can be set beside ours.",
  "compare.summary.asserted": "{count} of those name no currency on their own page, so the comparison says whose judgement the currency is rather than printing it as theirs.",
  "compare.summary.onRequest": "{count} of their tiers publish no amount at all and ask you to request one.",
  "compare.summary.none": "Nothing they publish can be compared with a FieldQuo price.",
  "compare.summary.withheldOne": "{count} further figure is held back, shown with the reason.",
  "compare.summary.withheld": "{count} further figures are held back, each shown with the reason.",

  // ── How a price reads ───────────────────────────────────────────────────
  //
  // {currency} is a code and {ask} is their button's own words: both arrive
  // already decided and neither is translated. {per} is resolved through
  // compare.per.* below, because "per month" with an English preposition inside
  // a French sentence is what this whole change is fixing.
  "compare.price.amount": "${amount} {currency} per {per}",
  "compare.price.free": "Free ({currency})",
  "compare.price.onRequest": "No price published — their page says “{ask}”",
  "compare.price.notOffered": "Not sold at this size",
  "compare.per.month": "month",
  "compare.per.year": "year",
  "compare.pricePerMonth": "${amount} per month",
  "compare.and": " and ",

  // ── How a feature's availability reads ──────────────────────────────────
  //
  // included and includedUsageExtra must NEVER collapse into one sentence.
  // Ours is the second: the receptionist is on every plan and the talk time is
  // prepaid credit, so "included" beside our price would be a false claim about
  // our own price to somebody who then meets a top-up on their first call.
  "compare.availability.included": "in the plan price",
  "compare.availability.includedUsageExtra": "on every plan, with the talk time bought separately as prepaid credit",
  "compare.availability.addOn": "a paid add-on on top of the plan",
  "compare.availability.absent": "not on that tier",
  "compare.availability.unknown": "not established",

  // ── The price section ───────────────────────────────────────────────────
  "compare.tierSeatsOne": "{seats} seat, plus {crew} crew at no charge",
  "compare.tierSeats": "{seats} seats, plus {crew} crew at no charge",
  "compare.sameNumberBothCurrencies": "The same number in each currency we sell in ({currencies}) — ${price} in each is a real FieldQuo price, so nothing on this page has to be converted to line them up. Which currency you are billed in comes from the business address you give at signup.",
  "compare.soldIn": "Sold in {currencies}.",
  "compare.nothingPublishable": "There is nothing on {competitor}’s pricing page that we can publish as a price. Every figure we hold is listed below with the reason it is being withheld.",
  "compare.usersIncludedOne": "{count} user included",
  "compare.usersIncluded": "{count} users included",
  "compare.unlimitedUsers": "Unlimited users, so there is no seat count to compare",
  "compare.currencyNotTheirs": "The amount is theirs, off their own page. The currency is not: {provenance}",
  "compare.withheldCountOne": "{count} more {competitor} price is not shown here — either the reading has aged out, or we could not settle what the published figure meant. We would rather leave a row out than print a number we cannot stand behind.",
  "compare.withheldCount": "{count} more {competitor} prices are not shown here — either the reading has aged out, or we could not settle what the published figure meant. We would rather leave a row out than print a number we cannot stand behind.",

  // ── Their ladder, in their own words ────────────────────────────────────
  "compare.addsOverTier": "Adds over the tier below it:",
  "compare.onThisTier": "On this tier:",
  "compare.aiCreditsTier": "Their page states {count} AI credits a month on this tier.",
  "compare.thisListFrom": "This list {provenance}",
  "compare.creditsAMonth": "{count} credits a month",

  // ── The receptionist panel ──────────────────────────────────────────────
  "compare.receptionistTitle": "{feature}: what it costs on each side",
  "compare.receptionistIntro": "Tiers are matched on what they contain, not on where they sit in a table. This is the cheapest {competitor} tier we verified as actually carrying it.",
  "compare.receptionistUnknownIntro": "We cannot answer this one for {competitor}.",
  "compare.featureOnThisTier": "The feature is {availability} on this tier.",
  "compare.receptionistLowerDown": "Lower down their range it is {availability}: {price}{at}. That is a floor you pay in a month when the phone never rings.",
  "compare.atCoordinates": " at {coordinates}",
  "compare.ourAvailability": "It is {availability}. A month with no calls costs nothing for it.",
  "compare.theirWordsNotOurs": "Their plans are described on their page in their own words, and this comparison will not read those words as ours. Their list is above, unedited, and it is the thing to check on their own site.",

  // ── Where we are ahead, and where we are not ────────────────────────────
  "compare.readOnTheirSite": "Read on their site {checked}",
  "compare.theySay": "{competitor} says: “{claim}”.",
  "compare.entryOursNothingBelowOne": "{seats} seat, plus {crew} crew at no charge. There is nothing below it.",
  "compare.entryOursNothingBelow": "{seats} seats, plus {crew} crew at no charge. There is nothing below it.",

  // ── The head-to-head ────────────────────────────────────────────────────
  "compare.case.eyebrow": "Side by side",
  "compare.case.headlineOurs": "Everything FieldQuo does costs {price}.",
  "compare.case.headlineTheirs": "At {competitor} the same list is {price}.",
  "compare.case.headlineNoPricesOurs": "FieldQuo publishes every price.",
  "compare.case.headlineNoPricesTheirs": "{competitor} publishes none.",
  "compare.case.sub": "We don’t sell features by the tier. Every plan has every feature — the plans differ only by how many people are on them.",
  "compare.case.missingOne": "{count} more thing {competitor} doesn’t offer at any price.",
  "compare.case.missing": "{count} more things {competitor} doesn’t offer at any price.",
  "compare.case.missingBody": "All of them are in the {plan} plan at {price}.",
  "compare.case.shopTitle": "What it costs for a shop like yours",
  "compare.case.shopIntro": "{competitor} bills every login. We bill the people who price work; everybody in a van is crew, at no charge. That gap grows with every person you hire.",
  "compare.case.shop1": "You and two in a van",
  "compare.case.shop2": "Two estimators, four in the field",
  "compare.case.shop3": "A shop of eleven",
  "compare.case.shopSplit": "{estimators} pricing work · {crew} in the field",
  "compare.case.youKeep": "you keep",
  "compare.case.cheaperThere": "Cheaper there at one person.",
  "compare.case.calcBefore": "Put your own numbers in on the",
  "compare.case.calcLink": "cost calculator",
  "compare.case.calcAfter": "and see all five side by side.",
  "compare.case.wholeTitle": "Everything you get, in every plan",
  "compare.case.wholeIntro": "Not a highlight reel — the whole product, and whether it appears anywhere in {competitor}’s plans.",
  "compare.case.both": "Both",
  "compare.case.only": "FieldQuo only",

  // ── The head-to-head rows ───────────────────────────────────────────────
  "compare.rows.perMo": "{amount}/mo",
  "compare.rows.perYr": "{amount}/yr",
  "compare.rows.usersOne": "{count} user",
  "compare.rows.users": "{count} users",
  "compare.rows.unlimitedUsers": "unlimited users",
  "compare.rows.cheapestPlan": "Cheapest plan",
  "compare.rows.soloSub": "{plan} — 1 seat, {crew} crew free",
  "compare.rows.annualEquivalent": "{plan} — {amount} a month equivalent, billed as a year",
  "compare.rows.tierUsers": "{plan} — {users}",
  "compare.rows.parityLabel": "Cheapest plan with what FieldQuo puts in every plan",
  "compare.rows.paritySub": "The same plan. We don't gate features by tier.",
  "compare.rows.parityAnnual": "{plan} — {amount} a month equivalent",
  "compare.rows.parityTheirs": "{plan} — their cheaper plans don't carry it",
  "compare.rows.publishedPrice": "Published price",
  "compare.rows.everyPlanOnThisPage": "Every plan, on this page",
  "compare.rows.nonePublished": "None published",
  "compare.rows.bookDemo": "Book a demo; the number is negotiated on the call",
  "compare.rows.whatItCosts": "What it costs",
  "compare.rows.oneToTwentyFive": "1 to 25 people",
  "compare.rows.reportedNotPublished": "reported by contractors, not published",
  "compare.rows.setupFee": "Setup fee",
  "compare.rows.none": "None",
  "compare.rows.reported": "reported",
  "compare.rows.howYouPay": "How you pay",
  "compare.rows.monthly": "Monthly",
  "compare.rows.leaveAnyMonth": "Leave at the end of any month",
  "compare.rows.aYearUpFront": "{amount} a year, up front",
  "compare.rows.noMonthlyOption": "No monthly option is offered — their FAQ says so",
  "compare.rows.paidAddOns": "Sold as paid add-ons",
  "compare.rows.everyFeature": "Every feature is in every plan, at the plan price",
  "compare.rows.plusPerMo": "+{amount}/mo",
  "compare.rows.peopleInField": "People in the field",
  "compare.rows.free": "Free",
  "compare.rows.crewFreeSub": "Crew see the schedule and the job at no charge",
  "compare.rows.billed": "Billed",
  "compare.rows.everyLoginPaid": "Every login is a paid user at {competitor}",
  "compare.rows.biggestPlan": "Biggest plan",
  "compare.rows.biggestSub": "{seats} seats plus {crew} crew — 25 people",
  "compare.rows.onRequest": "On request",
  "compare.rows.everyPlan": "Every plan",
  "compare.rows.tierAtPrice": "{plan} — {amount}/mo",
  "compare.rows.theirCheapestWithIt": "their cheapest plan that includes it",
  "compare.rows.notInTheirPlans": "Not in their plans",
  "compare.rows.freeTrial": "Free trial",
  "compare.rows.firstMonthFree": "First month free",
  "compare.rows.noCardCharged": "No card charged until it ends",
  "compare.rows.trialOffered": "Trial offered",
  "compare.rows.seeTheirSite": "see their site for current terms",

  // ── The add-on stack ────────────────────────────────────────────────────
  //
  // Rendered on /compare/fieldquo-vs-jobber AND on /pricing. These were the
  // keys the owner's report was actually about: the block had t() calls with
  // English fallbacks and no catalogue entries behind them, so every language
  // fell through to English and "the 3 things jobber charges extra for and
  // below" stayed in English on an otherwise translated page.
  "addOns.title": "{count} things {competitor} charges extra for",
  "addOns.intro": "These sit on top of the plan on their own pricing page, each with its own monthly price. Every one of them is work FieldQuo does inside the plan you are already paying for.",
  "addOns.scope": "We read the name and the price off their pricing page and nothing else. What is inside their add-on is not something we have checked, so nothing below describes it.",
  "addOns.money": "${amount} {currency} per {per}",
  "addOns.provenance": "Read from a {country} connection on {checked}",
  "addOns.sourceLink": "their pricing page",
  "addOns.oursTitle": "In FieldQuo, on every plan:",
  "addOns.limits": "Where it stops:",
  "addOns.total": "{total} {currency} a month, on top of the plan price.",
  "addOns.totalBody": "That is what those three cost together at the point on their own selectors where we read them. In FieldQuo the same three jobs are in every plan, at every size, from the cheapest one on this page.",
  "addOns.receptionist": "Their receptionist add-on is a monthly floor: it is charged in a month when the phone never rings. Ours has no monthly minimum. The feature is on every plan and the talk time is prepaid credit you buy when you need it, so a quiet February costs nothing for it.",

  // ── /pricing's own line under the add-on stack ──────────────────────────
  //
  // Referenced by PricingPlans.js since the block was written and never
  // defined, which is the second half of the same reported bug.
  "pricing.addOnsCompare": "Every figure above was read off their own pricing page, on the date shown. The full side-by-side, including what FieldQuo does not do, is here →",
};

export default en;
