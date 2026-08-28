// app/data/tradeGlossary.js
//
// The words a contractor meets, defined for the contractor rather than for the
// commercial construction manager who usually writes these lists.
//
// ══ Why this is a data module and not the message catalogue ════════════════
//
// Same reasoning as app/data/productFeatures.js and app/data/helpArticles.js:
// this is a long body of English prose that would swamp app/i18n/messages.js
// and gate every deploy on check:translations until six languages of it
// existed. The glossary is English-only today, deliberately and visibly, and
// docs/ROADMAP.md's locale-routing item is where a translated one belongs —
// a French glossary is not this file with t() around it, because half these
// terms have a different French word rather than a translated English one
// ("holdback" is *retenue*, and Quebec's rules under it are not Ontario's).
//
// ══ The copyright line, because the brief for this file got it half right ══
//
// A TERM is a fact. Nobody owns "change order", and a competitor publishing a
// glossary does not stop us publishing one. A DEFINITION AS WRITTEN is
// expression and belongs to whoever wrote it. So every sentence below was
// written from scratch, for our audience, and nothing here was fetched,
// quoted, reworded or arranged to mirror anybody else's list. Where a fact
// needed checking it was checked and then the sentence was written from
// understanding. If you add an entry, add it the same way.
//
// ══ Accuracy over volume, and the rule about law ═══════════════════════════
//
// A wrong definition of a legal or financial term on a public page is worse
// than a missing one: a contractor who reads "you have 45 days to lien" and
// has 30 leaves here having lost a remedy. So:
//
//   * Anything touching liens, holdbacks, bonding, insurance, employment
//     status or tax carries `varies: true`, and its definition SAYS the rule
//     is set where the work is rather than picking a jurisdiction and stating
//     it flatly. scripts/check-glossary.mjs fails the build if a `varies`
//     entry forgets to say so, and if a definition hedges without the flag.
//   * No entry states a deadline, a cap, a percentage or a threshold that is
//     set by statute. The general shape of the thing is safe to describe; the
//     number is not, because the number is different one province over.
//   * Terms we could not define confidently were LEFT OUT rather than guessed.
//     They are listed in `GLOSSARY_GAPS` below with the reason, so the gap is
//     a recorded decision instead of an oversight somebody re-litigates.
//
// ══ Scope: the van, not the tower crane ════════════════════════════════════
//
// The twelve trades in app/data/industries.js are the audience — one to twenty
// people, a van, a phone. That rules out most of what a commercial glossary is
// made of: CPM scheduling, submittals, RFIs, LEED, bid bonds on public works.
// It rules IN the vocabulary of quoting, job costing, deposits, scheduling,
// permits, and the words each trade uses on its own tools.
//
// ══ The FieldQuo sentence is optional and must never be forced ═════════════
//
// `product` links an entry to a claim in lib/marketing/featureMatrix.js. It is
// present only where the link is honest. Most entries have none, which is
// correct — "lien" does not need a call to action. The check resolves every
// `product.key` against the real matrix, so a feature that gets deleted takes
// its glossary sentence down with it instead of leaving a lie on a page.

import { INDUSTRIES } from "@/app/data/industries";

/**
 * Sections, in the order a job happens — the same argument MATRIX_GROUPS makes
 * in featureMatrix.js. An A–Z is the obvious grouping and it is the wrong one:
 * a contractor arrives here having met one word on one document, and the
 * neighbouring words on that document are what they need next, not the other
 * words starting with R.
 */
export const GLOSSARY_CATEGORIES = Object.freeze([
  Object.freeze({
    key: "estimating",
    label: "Estimating and quoting",
    blurb: "Working out what a job will cost and putting a number in front of somebody.",
  }),
  Object.freeze({
    key: "money",
    label: "Pricing, cost and profit",
    blurb: "The arithmetic that decides whether a busy year was also a profitable one.",
  }),
  Object.freeze({
    key: "payments",
    label: "Getting paid",
    blurb: "Deposits, invoices, terms, and the money actually arriving.",
  }),
  Object.freeze({
    key: "legal",
    label: "Contracts and the law",
    blurb: "The paperwork that decides who is right when a job goes wrong.",
  }),
  Object.freeze({
    key: "cover",
    label: "Insurance, bonding and licensing",
    blurb: "What a customer means when they ask if you are licensed, bonded and insured.",
  }),
  Object.freeze({
    key: "permits",
    label: "Permits, codes and inspections",
    blurb: "The authority that has to agree the work is allowed and was done properly.",
  }),
  Object.freeze({
    key: "fieldwork",
    label: "Running the job",
    blurb: "Getting the right people to the right address with the right information.",
  }),
  Object.freeze({
    key: "sales",
    label: "Winning work",
    blurb: "Where enquiries come from and what happens to them.",
  }),
  Object.freeze({
    key: "trade",
    label: "Trade talk",
    blurb: "Words that mean one thing on a roof and another on a floor.",
  }),
]);

export const GLOSSARY_CATEGORY_KEYS = Object.freeze(
  GLOSSARY_CATEGORIES.map((c) => c.key),
);

/**
 * Fields on an entry:
 *
 *   term       the headword, capitalised as it would start a sentence.
 *   slug       stable, kebab-case, the URL. Never change one — it is a link
 *              somebody else may have made.
 *   category   one of GLOSSARY_CATEGORY_KEYS.
 *   synonyms   what the same thing is called on the other side of the border,
 *              or in the next trade over. Abbreviations go here too.
 *   trades     industry slugs from app/data/industries.js where the word is
 *              most at home. Omitted when the term belongs to everybody.
 *   varies     true when the answer genuinely differs by country, province or
 *              state. Forces the definition to say so.
 *   definition plain English. The FIRST SENTENCE has to stand alone, because
 *              the index page shows only that.
 *   related    other slugs in this file. The check refuses a dangling one.
 *   product    { key, note } or null. `key` must exist in FEATURE_MATRIX.
 */
const ENTRIES = [
  /* ── Estimating and quoting ─────────────────────────────────────────── */
  {
    term: "Estimate",
    slug: "estimate",
    category: "estimating",
    synonyms: ["Ballpark", "Rough price"],
    varies: true,
    definition:
      "A price you expect the work to come to, given before anyone has committed to anything. An estimate is a considered guess rather than an offer: it can move when the job turns out to be different from the one you looked at. How far it may move before you need the customer's agreement in writing is not a matter of custom — consumer-protection law in many provinces and states puts a ceiling on the overrun, and the ceiling is different in each of them. Find out which rule applies where you work before you decide what your estimates say.",
    related: ["quote", "bid", "allowance", "change-order"],
    product: {
      key: "instant_quotes",
      note: "FieldQuo can put an instant estimate on your website, built from rates you set, so a visitor gets a range on the spot instead of waiting for a call back.",
    },
  },
  {
    term: "Quote",
    slug: "quote",
    category: "estimating",
    synonyms: ["Firm quote", "Proposal", "Fixed price"],
    varies: true,
    definition:
      "A price you are offering to hold, which becomes binding when the customer accepts it. The difference between a quote and an estimate is the whole argument in most price disputes, and the two words are not interchangeable. How firmly the number binds you, and what the customer has to be told before it does, differs by province and state, so the word on the document is worth choosing on purpose. If the scope changes after acceptance, the price changes by agreement and in writing, not by assumption.",
    related: ["estimate", "scope-of-work", "exclusions", "change-order"],
    product: {
      key: "quotes",
      note: "Quotes in FieldQuo are built from your own rates and grouped by room or by scope, so the customer reads the job the way you walked it.",
    },
  },
  {
    term: "Bid",
    slug: "bid",
    category: "estimating",
    synonyms: ["Tender"],
    definition:
      "A price submitted in competition with other contractors, usually against a scope that somebody else wrote. On commercial and public work a bid is a formal thing with a closing time and a required format. In residential work most people say bid when they mean quote, and no harm comes of it as long as the document itself is clear about which one it is.",
    related: ["quote", "scope-of-work", "close-rate"],
    product: null,
  },
  {
    term: "Scope of work",
    slug: "scope-of-work",
    category: "estimating",
    synonyms: ["Scope", "Statement of work"],
    definition:
      "The written description of exactly what you are going to do, in enough detail that you and the customer are picturing the same job. Good scope is boring and specific: which rooms, how many coats, what is being moved and by whom, what surface is being left behind. Nearly every argument about extras is really an argument about a scope that was written in one line.",
    related: ["exclusions", "quote", "change-order", "allowance"],
    product: {
      key: "quotes",
      note: "A FieldQuo quote is grouped by room or scope area rather than being one long list, which makes the boundary of the job visible to the customer before they sign.",
    },
  },
  {
    term: "Exclusions",
    slug: "exclusions",
    category: "estimating",
    synonyms: ["Not included", "Carve-outs"],
    definition:
      "The list of things your price does not cover, written down on the same document as the price. Exclusions are worth more than they look: they are the only place a customer finds out that the price excludes moving furniture, disposing of the old material, or repairing what you find under it. An exclusion agreed before the job is a conversation; the same sentence after the job is a dispute.",
    related: ["scope-of-work", "allowance", "change-order"],
    product: null,
  },
  {
    term: "Allowance",
    slug: "allowance",
    category: "estimating",
    synonyms: ["Provisional sum", "PC sum"],
    definition:
      "A placeholder amount inside a fixed price for something the customer has not chosen yet — the tile, the taps, the light fittings. If they pick something dearer the difference is added, and if they pick cheaper it comes off. Allowances are the usual way a fixed-price job quietly stops being fixed price, so say what the allowance buys and per what unit, not just what it is worth.",
    related: ["scope-of-work", "exclusions", "contingency", "estimate"],
    product: null,
  },
  {
    term: "Takeoff",
    slug: "takeoff",
    category: "estimating",
    synonyms: ["Quantity takeoff", "Material takeoff"],
    definition:
      "Measuring the quantities a job needs — square footage, linear feet, fixture counts, cubic yards — off a drawing, a photo or the site itself. The takeoff is the input to the price, so an error here is an error nothing downstream will catch. Most small-trade takeoffs are done with a tape and a phone rather than with software, which is why they are worth writing down rather than remembering.",
    related: ["waste-factor", "unit-price", "square", "linear-foot"],
    product: {
      key: "aerial_measure",
      note: "FieldQuo can measure a roof's area and pitch, or trace a driveway or patio, from the address alone — a takeoff without the drive out there.",
    },
  },
  {
    term: "Unit price",
    slug: "unit-price",
    category: "estimating",
    synonyms: ["Unit rate", "Rate"],
    definition:
      "A price for one unit of work — a square foot of floor, a linear foot of cabinet, a fixture, a visit — which you multiply by the quantity. Unit pricing is fast and it is honest as long as the unit really does cost the same each time. It stops being honest when a foot of pantry and a foot of base cabinet, or a first-storey window and a third-storey one, are priced at the same rate.",
    related: ["takeoff", "linear-foot", "markup", "time-and-materials"],
    product: {
      key: "price_book",
      note: "Your services and rates live in one price book in FieldQuo, importable from a spreadsheet, so a rate change reaches every quote you write next.",
    },
  },
  {
    term: "Good, better, best",
    slug: "good-better-best",
    category: "estimating",
    synonyms: ["Tiered pricing", "Option pricing", "Three-tier quote"],
    definition:
      "Sending one job at three prices so the customer chooses between your options rather than between you and the next contractor. The middle option is usually what you expect to sell; the cheap one gives a customer somewhere to go other than away, and the dear one makes the middle look reasonable. It works because it changes the question from whether to buy to which one to buy.",
    related: ["add-on", "quote", "close-rate"],
    product: {
      key: "priced_options",
      note: "FieldQuo sends one job at three prices on a single quote and lets the client pick the tier they want.",
    },
  },
  {
    term: "Add-on",
    slug: "add-on",
    category: "estimating",
    synonyms: ["Upsell", "Optional extra", "Upgrade"],
    definition:
      "An optional extra offered alongside the main job — the second coat, the gutter clean while the ladder is up, the drain check while the wall is open. Add-ons are the cheapest work you will ever sell because you are already on site and already set up, and they are missed mostly because nobody wrote them on the quote.",
    related: ["good-better-best", "quote"],
    product: {
      key: "add_on_upsell",
      note: "FieldQuo suggests extras at the bottom of the quote, priced from your own history, that the client can tick before they approve.",
    },
  },
  {
    term: "Contingency",
    slug: "contingency",
    category: "estimating",
    synonyms: ["Buffer", "Allowance for the unknown"],
    definition:
      "An amount added to a price to cover what you cannot see yet — the rot behind the siding, the second layer of shingles, the floor that is not level. Contingency is not profit and should not be treated as it: profit is what you earn for doing the job right, contingency is money set against a risk you named. Jobs on older buildings carry more of it, and saying so in the quote is easier than explaining it later.",
    related: ["allowance", "margin", "change-order"],
    product: null,
  },
  {
    term: "Waste factor",
    slug: "waste-factor",
    category: "estimating",
    synonyms: ["Waste allowance", "Overage", "Cut loss"],
    definition:
      "Extra material ordered on top of the measured quantity to cover offcuts, breakage and mistakes. Flooring and tile commonly carry something in the range of five to ten per cent on a simple square layout, and more where a diagonal, a pattern match or a lot of small rooms turn usable material into offcuts. Ordering short costs a second delivery and a second day, which is nearly always dearer than the waste.",
    related: ["takeoff", "material-cost", "underlayment"],
    product: {
      key: "material_costs",
      note: "FieldQuo holds what your materials cost and how much of each a job of a given size consumes, so the waste is priced rather than absorbed.",
    },
  },
  {
    term: "Change order",
    slug: "change-order",
    category: "estimating",
    synonyms: ["Variation", "Extra work order", "CO"],
    definition:
      "A written record that the job has changed, what the change is, and what it costs — agreed before the extra work starts. Doing extras on a nod is the most reliable way a small contractor ends up unpaid, because the customer remembers a favour and the contractor remembers an invoice. A change order does not have to be a form; it has to be in writing and it has to be before.",
    related: ["scope-of-work", "exclusions", "quote", "time-and-materials"],
    product: null,
  },
  {
    term: "Site visit",
    slug: "site-visit",
    category: "estimating",
    synonyms: ["Estimate appointment", "Assessment", "Survey"],
    definition:
      "Going out to look at the job before pricing it. The visit is where the things that wreck a price live — access, parking, stairs, the condition of the substrate, what the customer means by the word they used. Some trades can price from photos and measurements; most cannot, and the ones that try find out on the first morning.",
    related: ["takeoff", "estimate", "arrival-window", "deposit"],
    product: {
      key: "booking_page",
      note: "FieldQuo gives you a booking page where clients pick a site-visit slot from your real availability, with travel time already accounted for.",
    },
  },

  /* ── Pricing, cost and profit ───────────────────────────────────────── */
  {
    term: "Markup",
    slug: "markup",
    category: "money",
    synonyms: ["Mark-up"],
    definition:
      "What you add on top of your cost to reach your price, given as a percentage of the cost. Cost a job at $100, add 50 per cent markup, and the price is $150. Markup is easy to apply because you start from a number you already know, which is why nearly everyone prices this way — and why nearly everyone then reads the result as a margin, which it is not.",
    related: ["margin", "overhead", "unit-price"],
    product: null,
  },
  {
    term: "Margin",
    slug: "margin",
    category: "money",
    synonyms: ["Gross margin", "Gross profit margin", "GP"],
    definition:
      "What is left of the price once the cost of doing the work is taken out, given as a percentage of the price. That $150 job costing $100 leaves $50, which is a 33 per cent margin on a 50 per cent markup. Markup and margin are the pair most often confused, and the confusion runs one way only: it always makes the job look more profitable than it was.",
    related: ["markup", "job-costing", "overhead", "break-even"],
    product: {
      key: "job_costing",
      note: "FieldQuo sets labour, materials and expenses against the price you quoted, so the margin you actually got is a number rather than a feeling.",
    },
  },
  {
    term: "Overhead",
    slug: "overhead",
    category: "money",
    synonyms: ["Fixed costs", "Running costs", "Indirect costs"],
    definition:
      "What the business costs to run whether or not you work today — insurance, the van payment, the phone, the accountant, the software, the storage unit. Overhead cannot be charged to any one job, so it has to be recovered across all of them, which means a price that covers only labour and materials is a price that loses money quietly all year.",
    related: ["break-even", "margin", "labour-burden"],
    product: {
      key: "expenses",
      note: "FieldQuo separates what you spend on a job from what you spend on the business, which is the split overhead recovery depends on.",
    },
  },
  {
    term: "Labour burden",
    slug: "labour-burden",
    category: "money",
    synonyms: ["Burden", "Fully loaded labour cost", "Labor burden"],
    varies: true,
    definition:
      "The true cost of an hour of somebody's time, which is their wage plus everything you pay because they are on your payroll. Which items belong in the burden depends on where you employ people — employer payroll taxes, workers' compensation premiums, statutory holiday and vacation pay, and any mandatory benefits all differ by country, province and state. Pricing off the bare wage understates every job with a person on it.",
    related: ["overhead", "job-costing", "employee-vs-subcontractor", "workers-compensation"],
    product: {
      key: "job_costing",
      note: "Hours clocked against a job feed FieldQuo's job costing, so labour lands on the job it was spent on rather than in a monthly lump.",
    },
  },
  {
    term: "Break-even",
    slug: "break-even",
    category: "money",
    synonyms: ["Break-even point", "Minimum price"],
    definition:
      "The point at which a day's work has brought in enough to cover what the day cost you, before a cent of profit. Knowing it turns pricing from a nerve question into an arithmetic one: below break-even you are paying for the privilege of working, and a busy schedule of jobs priced below it is the fastest way to go under while looking successful.",
    related: ["overhead", "margin", "effective-hourly-rate"],
    product: {
      key: "break_even",
      note: "FieldQuo works out your break-even price from your own recorded overhead rather than from a rule of thumb.",
    },
  },
  {
    term: "Effective hourly rate",
    slug: "effective-hourly-rate",
    category: "money",
    synonyms: ["Real hourly rate", "Earned rate"],
    definition:
      "What you actually earn per hour once the unpaid hours are counted — quoting, driving, buying materials, chasing invoices, doing the books on a Sunday. A trade that bills $90 an hour and spends half its week not billing is earning $45. The number is uncomfortable and it is the one that explains why a full calendar can still feel like standing still.",
    related: ["break-even", "job-costing", "overhead"],
    product: null,
  },
  {
    term: "Job costing",
    slug: "job-costing",
    category: "money",
    synonyms: ["Job cost tracking", "Cost tracking"],
    definition:
      "Putting the real labour, materials and expenses of a finished job against what you charged for it, so you know what that job made. It is the only way to find out which kinds of work are worth having, and it usually surprises people: the big jobs are often thinner than the small ones, and one customer is often carrying a loss nobody had noticed.",
    related: ["margin", "labour-burden", "material-cost", "time-and-materials"],
    product: {
      key: "job_costing",
      note: "Job costing in FieldQuo compares labour, materials and expenses against the quoted price for each job.",
    },
  },
  {
    term: "Average job size",
    slug: "average-job-size",
    category: "money",
    synonyms: ["Average ticket", "Average invoice value"],
    definition:
      "The typical value of one job, worked out across everything you sold in a period. It is the lever most small trades ignore: lifting the average by a fifth does the same for revenue as finding a fifth more customers, and costs nothing in advertising. Watch it alongside the win rate, because a rising average with a falling win rate is a price rise the market is refusing.",
    related: ["close-rate", "add-on", "good-better-best"],
    product: {
      key: "dashboard",
      note: "The FieldQuo dashboard shows what is quoted, won, scheduled and owed on one screen, which is where an average job size becomes visible.",
    },
  },
  {
    term: "Cash flow",
    slug: "cash-flow",
    category: "money",
    synonyms: ["Working capital"],
    definition:
      "The timing of money coming in and going out, which is a separate question from whether the work is profitable. A profitable business runs out of money by paying for materials in week one and being paid in week eight, repeatedly. Deposits, progress payments and short terms are cash-flow tools, not greed, and they are why a small contractor can take on a job whose materials cost more than the bank balance.",
    related: ["deposit", "progress-payment", "payment-terms", "accounts-receivable"],
    product: {
      key: "dashboard",
      note: "FieldQuo shows what is owed alongside what is scheduled, so the gap between the work and the money is visible before it bites.",
    },
  },

  /* ── Getting paid ───────────────────────────────────────────────────── */
  {
    term: "Deposit",
    slug: "deposit",
    category: "payments",
    synonyms: ["Down payment", "Upfront payment"],
    varies: true,
    definition:
      "Money taken before work starts, usually to cover materials and to prove the customer is serious. What a residential contractor may ask for up front is not entirely your decision: several provinces and states cap the deposit on home-improvement contracts, or restrict what the money may be spent on before the work begins, and the cap is different in each. Check the rule where the work is before you settle on a standard percentage.",
    related: ["progress-payment", "cash-flow", "cooling-off-period", "contract"],
    product: {
      key: "booking_deposit",
      note: "FieldQuo can charge a booking fee when a client reserves the slot and credit it against the invoice when the work goes ahead.",
    },
  },
  {
    term: "Progress payment",
    slug: "progress-payment",
    category: "payments",
    synonyms: ["Draw", "Progress draw", "Milestone payment", "Stage payment"],
    definition:
      "A payment due partway through a job, tied to a stage of the work rather than to a date. Progress payments keep the money roughly level with the cost of the work, which is what stops a long job from being financed out of your own pocket. Tie each one to something visible and agreed — rough-in passed, cabinets hung — rather than to a percentage nobody can verify.",
    related: ["deposit", "cash-flow", "substantial-completion", "retainage"],
    product: {
      key: "invoices",
      note: "An invoice in FieldQuo is built from the quote it came from, so a staged invoice still reads like the document the client agreed to.",
    },
  },
  {
    term: "Retainage",
    slug: "retainage",
    category: "payments",
    synonyms: ["Holdback", "Statutory holdback", "Retention"],
    varies: true,
    definition:
      "A slice of each payment the customer keeps back until the work is finished and any claim period has passed, then releases. On many jobs it is not a negotiating position but a legal requirement: the percentage, whether it applies at all, how long it is held and what releases it are set by provincial or state statute, and those statutes do not agree with one another. Whether the money is yours to invoice yet is a question for the rule where the work is, not for the contract alone.",
    related: ["progress-payment", "substantial-completion", "lien", "lien-waiver"],
    product: null,
  },
  {
    term: "Payment terms",
    slug: "payment-terms",
    category: "payments",
    synonyms: ["Net 30", "Due on receipt", "Terms"],
    definition:
      "When payment is due, counted from the invoice date. Due on receipt means now; net 30 means thirty days. Homeowners generally pay on completion and other trades generally do not, which is why a residential contractor working as a sub suddenly discovers a thirty- or sixty-day wait they never agreed to out loud. The terms belong on the quote as well as the invoice, because that is when they can still be argued about.",
    related: ["invoice", "accounts-receivable", "cash-flow", "contract"],
    product: {
      key: "contract_terms",
      note: "FieldQuo attaches your payment terms and contract wording to the documents you send, so the terms are on the quote and not just on the invoice.",
    },
  },
  {
    term: "Invoice",
    slug: "invoice",
    category: "payments",
    synonyms: ["Bill"],
    definition:
      "The document that asks for the money, listing what was done, what it costs, any tax, and when payment is due. An invoice that does not resemble the quote the customer accepted invites a phone call, and the phone call delays the payment — so the closer it reads to the agreed document, the faster it clears.",
    related: ["payment-terms", "accounts-receivable", "sales-tax", "progress-payment"],
    product: {
      key: "invoices",
      note: "FieldQuo builds the invoice from the accepted quote, so it mirrors what the client already agreed rather than being retyped.",
    },
  },
  {
    term: "Substantial completion",
    slug: "substantial-completion",
    category: "payments",
    synonyms: ["Substantially performed", "Practical completion"],
    varies: true,
    definition:
      "The point at which the work is finished enough for the customer to use the property for what it is meant for, even though small items remain. It matters far beyond the handshake: in several provinces and states substantial completion is a statutory milestone that starts the clock on releasing holdback and on lien deadlines, the statute rather than your contract decides when it has been reached, and the definition varies between them. Do not assume the date you called it done is the date the law counts from.",
    related: ["deficiency-list", "retainage", "lien", "walkthrough"],
    product: null,
  },
  {
    term: "Accounts receivable",
    slug: "accounts-receivable",
    category: "payments",
    synonyms: ["A/R", "Aged receivables", "Debtors"],
    definition:
      "The money that has been invoiced and not yet paid, usually sorted by how long it has been outstanding. Ageing matters more than the total: an invoice at ninety days is a great deal less likely to be paid than one at thirty, and the difference between the two is almost entirely whether anybody chased it.",
    related: ["invoice", "payment-terms", "cash-flow"],
    product: {
      key: "dashboard",
      note: "What is owed sits on the FieldQuo dashboard next to what is quoted and scheduled, as of this morning.",
    },
  },
  {
    term: "Chargeback",
    slug: "chargeback",
    category: "payments",
    synonyms: ["Payment dispute", "Card dispute"],
    definition:
      "When a customer disputes a card payment with their own bank and the money is taken back out of your account while the claim is looked at. You are not asked first. Your defence is evidence that the work was agreed and delivered — a signed quote, dated photographs, a delivery note — which is why keeping that paperwork is worth the minutes it costs.",
    related: ["card-payment", "processing-fee", "invoice"],
    product: {
      key: "card_payments",
      note: "Card payments in FieldQuo settle into your own account, and the signed approval and job photos that answer a dispute are already filed against the job.",
    },
  },
  {
    term: "Card payment",
    slug: "card-payment",
    category: "payments",
    synonyms: ["Pay by card", "Online payment"],
    definition:
      "Taking payment by credit or debit card rather than by cheque, cash or transfer. Cards cost a percentage and they get paid faster, and for most small trades the second effect is worth more than the first — an invoice with a pay button on it clears in days rather than weeks.",
    related: ["processing-fee", "chargeback", "payment-terms"],
    product: {
      key: "card_payments",
      note: "The client pays from the invoice email and the money goes to your account, not to FieldQuo's.",
    },
  },
  {
    term: "Processing fee",
    slug: "processing-fee",
    category: "payments",
    synonyms: ["Merchant fee", "Card fee", "Surcharge"],
    varies: true,
    definition:
      "The cut the card networks and your payment processor keep from every card transaction. Whether you may add it back onto the customer's bill as a surcharge is restricted in some countries, provinces and states, and separately restricted by the agreement you signed with the card networks, so the answer depends both on where you are and on who processes for you. Building the cost into your rates avoids the question entirely.",
    related: ["card-payment", "chargeback", "markup"],
    product: {
      key: "card_payments",
      note: "FieldQuo takes card payments through your own connected account, so the processing terms are between you and your processor.",
    },
  },
  {
    term: "Sales tax",
    slug: "sales-tax",
    category: "payments",
    synonyms: ["GST", "HST", "PST", "QST", "VAT", "State and local sales tax"],
    varies: true,
    definition:
      "Tax added to what you charge and passed on to the government. Almost everything about it varies with where the work is done: the rate, whether you must register at all, whether labour is taxable as well as materials, and whether the rate follows your address or the customer's. It is one of the few places where guessing has a direct financial penalty attached, so get the answer for your own jurisdiction rather than copying another contractor's invoice.",
    related: ["invoice", "payment-terms"],
    product: {
      key: "sales_tax",
      note: "FieldQuo holds your rates and puts the right one on the document for where the work is, rather than a single company-wide rate.",
    },
  },
  {
    term: "Consumer financing",
    slug: "consumer-financing",
    category: "payments",
    synonyms: ["Pay over time", "Instalment plan", "Buy now pay later"],
    definition:
      "Letting a customer pay for a job in instalments through a lender, while you are paid in full. It sells work that would otherwise be postponed — the roof that can wait one more winter, the panel upgrade that is not urgent until it is — and the cost to you is a fee on the transaction.",
    related: ["deposit", "card-payment", "average-job-size"],
    product: {
      key: "financing",
      note: "FieldQuo can offer pay-over-time at checkout on the larger jobs homeowners tend to put off.",
    },
  },
  {
    term: "Maintenance plan",
    slug: "maintenance-plan",
    category: "payments",
    synonyms: ["Service agreement", "Service plan", "Recurring billing"],
    definition:
      "A standing arrangement where a customer pays regularly for scheduled work — a seasonal tune-up, a quarterly clean, a spring and autumn visit. Plans smooth out a seasonal trade's income and they make the customer yours rather than the next person who knocks, which is usually worth more than the revenue itself.",
    related: ["recurring-visit", "cash-flow", "backlog"],
    product: {
      key: "service_plans",
      note: "FieldQuo signs a client up to a recurring plan and charges the card on schedule without you raising it each time.",
    },
  },

  /* ── Contracts and the law ──────────────────────────────────────────── */
  {
    term: "Contract",
    slug: "contract",
    category: "legal",
    synonyms: ["Agreement", "Home improvement contract"],
    varies: true,
    definition:
      "The agreement between you and the customer about what will be done, for how much, and on what terms. A verbal agreement is often still a contract, but it is a contract nobody can prove. Above certain values, consumer-protection law in many provinces and states requires a residential contract to be in writing and to contain particular items — and the threshold and the required items vary, so a template bought for one jurisdiction is not automatically valid in the next.",
    related: ["quote", "payment-terms", "warranty", "cooling-off-period"],
    product: {
      key: "contract_terms",
      note: "Your own terms and contract wording attach themselves to what FieldQuo sends, so the document that goes out carries them every time.",
    },
  },
  {
    term: "Cooling-off period",
    slug: "cooling-off-period",
    category: "legal",
    synonyms: ["Right to cancel", "Right of rescission", "Cancellation period"],
    varies: true,
    definition:
      "A window after signing during which a customer may cancel and walk away without penalty, typically for contracts signed at their door rather than at your premises. Whether it applies, how long it runs, what notice you have to give them about it, and what happens to work already done all vary with the consumer-protection law of the province or state the customer lives in — and they vary a great deal. If you sell at the kitchen table, this is a rule worth knowing exactly rather than approximately.",
    related: ["contract", "deposit"],
    product: null,
  },
  {
    term: "Lien",
    slug: "lien",
    category: "legal",
    synonyms: [
      "Mechanic's lien",
      "Construction lien",
      "Builder's lien",
      "Materialman's lien",
    ],
    varies: true,
    definition:
      "A claim registered against the property you worked on, which makes it difficult for the owner to sell or refinance until you are paid. It is the trades' main remedy for non-payment and it is entirely a creature of statute: who may claim, what notice must be served first, what the claim must contain, and above all the deadline are set by the province or state the work is in. The deadline is short, it is counted from a date the statute defines rather than from the day you gave up on being paid, and missing it usually ends the right altogether. If you are heading towards one, get the rule for that jurisdiction early and from someone who practises there.",
    related: ["lien-waiver", "retainage", "substantial-completion", "contract"],
    product: null,
  },
  {
    term: "Lien waiver",
    slug: "lien-waiver",
    category: "legal",
    synonyms: ["Release of lien", "Waiver of lien", "Statutory declaration"],
    varies: true,
    definition:
      "A signed document in which you give up your right to lien for work you have been paid for. It is routine on larger jobs, where the owner will not release a payment without one from everybody who worked on it. The form it takes differs sharply: some US states prescribe the exact wording and treat anything else as invalid, while Canadian practice more often uses a statutory declaration that you have paid your own people. Signing one that covers work you have not been paid for gives away the remedy for that work, so read which it is.",
    related: ["lien", "retainage", "progress-payment"],
    product: null,
  },
  {
    term: "Warranty",
    slug: "warranty",
    category: "legal",
    synonyms: ["Guarantee", "Workmanship warranty"],
    varies: true,
    definition:
      "Your promise to put right defects in your own work for a stated period after the job. Two things run alongside it: the manufacturer's warranty on the material, which is a separate promise from a separate party and is often void if the material was installed against instructions; and the standard of workmanship that consumer law implies in most places whether or not you wrote one down. What the law implies, and how long it lasts, varies by jurisdiction — and it generally cannot be signed away by a shorter written warranty.",
    related: ["callback", "deficiency-list", "contract"],
    product: {
      key: "contract_terms",
      note: "Warranty wording lives with your other terms in FieldQuo and attaches to the documents you send.",
    },
  },
  {
    term: "Deficiency list",
    slug: "deficiency-list",
    category: "legal",
    synonyms: ["Punch list", "Snag list", "Punch-out"],
    definition:
      "The list of small items left to fix before a job is accepted as finished — the missed touch-up, the door that binds, the cover plate nobody fitted. Walking the job with the customer and writing the list together is what turns an open-ended complaint into a finite piece of work with an end to it.",
    related: ["walkthrough", "substantial-completion", "callback"],
    product: {
      key: "tasks",
      note: "FieldQuo keeps the outstanding items as a to-do list sorted by what will hurt most if it is left, so a deficiency does not live only in a text message.",
    },
  },
  {
    term: "Employee vs. subcontractor",
    slug: "employee-vs-subcontractor",
    category: "legal",
    synonyms: ["Worker classification", "Independent contractor status"],
    varies: true,
    definition:
      "Whether someone who works for you counts in law as your employee or as an independent business you hired. The line is drawn by law rather than by what the paperwork calls the arrangement, and the test differs by country, province and state — so the same working relationship can be classified one way at home and the other way across the border. Getting it wrong is expensive in back taxes, premiums and penalties, and it is decided after the fact by an authority looking at how the work actually ran. This is a question for your accountant or a lawyer where you operate, not for a glossary.",
    related: ["subcontractor", "labour-burden", "workers-compensation"],
    product: null,
  },
  {
    term: "Subcontractor",
    slug: "subcontractor",
    category: "legal",
    synonyms: ["Sub", "Trade partner"],
    definition:
      "Another business you hire to do part of a job you are responsible for — the electrician on your renovation, the crane on your tree removal. To your customer the sub's work is your work: you carry the responsibility for it, and you carry the risk if they are uninsured or unlicensed. Ask for the certificate of insurance before the first day, not after the incident.",
    related: [
      "employee-vs-subcontractor",
      "certificate-of-insurance",
      "lien",
      "markup",
    ],
    product: {
      key: "subcontractor_bids",
      note: "FieldQuo can pull a sub's price into your quote as a cost and mark it up, so your client sees one price — yours.",
    },
  },

  /* ── Insurance, bonding and licensing ───────────────────────────────── */
  {
    term: "General liability insurance",
    slug: "general-liability-insurance",
    category: "cover",
    synonyms: ["GL", "CGL", "Public liability"],
    definition:
      "Cover for damage or injury you cause to someone else or their property while working — the dropped tool through the skylight, the flood in the flat downstairs. What it generally does not cover is the quality of your own work: redoing the thing you did wrong is normally excluded, because that is a business risk rather than an accident. Customers and general contractors will ask to see it before they let you start.",
    related: ["certificate-of-insurance", "additional-insured", "workers-compensation"],
    product: null,
  },
  {
    term: "Certificate of insurance",
    slug: "certificate-of-insurance",
    category: "cover",
    synonyms: ["COI", "Proof of insurance"],
    definition:
      "A one-page summary issued by your insurer showing what cover you hold, for how much, and until when. It is evidence, not the policy — the policy wording is what actually pays a claim — and it is the document a customer or a general contractor means when they ask you to send your insurance. Keep a current one to hand, because an expired certificate is the usual reason a start date slips.",
    related: ["general-liability-insurance", "additional-insured", "subcontractor"],
    product: null,
  },
  {
    term: "Additional insured",
    slug: "additional-insured",
    category: "cover",
    synonyms: ["Named as additional insured"],
    definition:
      "A request to have your customer, or the contractor who hired you, added to your liability policy so that your cover also answers a claim brought against them arising out of your work. It is common on commercial and multi-unit jobs. Agreeing to it in a contract does not make it so — your insurer has to actually endorse the policy, and there may be a fee.",
    related: ["general-liability-insurance", "certificate-of-insurance"],
    product: null,
  },
  {
    term: "Workers' compensation",
    slug: "workers-compensation",
    category: "cover",
    synonyms: ["Workers' comp", "WCB", "WSIB", "CNESST", "Workplace insurance"],
    varies: true,
    definition:
      "No-fault cover that pays a worker who is injured on the job, funded by premiums on your payroll. It is run by the province or the state and the rules are genuinely different in each one: whether you must register, whether an owner-operator is covered or excluded, what happens if a sub you hired turns out to be uninsured, and how the premium is calculated. Assuming the arrangement you knew somewhere else still applies is a common and costly mistake.",
    related: ["labour-burden", "employee-vs-subcontractor", "general-liability-insurance"],
    product: null,
  },
  {
    term: "Surety bond",
    slug: "surety-bond",
    category: "cover",
    synonyms: ["Bond", "Licence bond", "Performance bond", "Bonded"],
    varies: true,
    definition:
      "A guarantee from a third party that you will do what you promised, which pays the customer if you do not. It is not insurance, and the difference matters: after a bond pays out, the surety comes to you for the money. When a homeowner asks whether you are bonded they usually mean a licence bond, which some jurisdictions require before they will issue a trade licence at all — and whether one is required, and for how much, varies by province and state.",
    related: ["trade-licence", "general-liability-insurance"],
    product: null,
  },
  {
    term: "Trade licence",
    slug: "trade-licence",
    category: "cover",
    synonyms: ["Contractor licence", "Certificate of qualification", "Ticket", "Trade license"],
    varies: true,
    definition:
      "Official permission to carry out a trade, or to carry it out unsupervised. Which trades need one, who issues it, whether it is held by the individual or the business, and whether it is recognised when you cross a border all vary by province and by state — electrical and plumbing are licensed nearly everywhere, while painting and landscaping often are not. Working outside a licence can void your insurance as well as attracting a fine.",
    related: ["surety-bond", "permit", "building-code"],
    product: null,
  },

  /* ── Permits, codes and inspections ─────────────────────────────────── */
  {
    term: "Permit",
    slug: "permit",
    category: "permits",
    synonyms: ["Building permit", "Trade permit", "Electrical permit"],
    varies: true,
    definition:
      "Permission from the local authority to carry out work before you start it, usually followed by one or more inspections. What needs a permit varies by municipality as well as by province or state, and the answers are not intuitive — replacing a panel usually does, replacing a faucet usually does not, and where a deck or a fence lands is a local call. Unpermitted work surfaces years later when the owner tries to sell, and it lands back on whoever did it.",
    related: ["inspection", "building-code", "trade-licence", "rough-in"],
    product: null,
  },
  {
    term: "Inspection",
    slug: "inspection",
    category: "permits",
    synonyms: ["Rough-in inspection", "Final inspection", "Sign-off"],
    definition:
      "A visit from the authority that issued the permit to confirm the work meets code before it is covered up or put into use. Inspections are the reason rough-in is a milestone: what is behind the drywall has to be seen before the drywall goes on. Book them into the schedule as real appointments, because a failed or missed inspection stops the trades behind you as well as you.",
    related: ["permit", "rough-in", "building-code", "dispatch"],
    product: {
      key: "scheduling",
      note: "An inspection can sit on the FieldQuo schedule as its own visit, so the trades booked behind it are not stacked on top of a date that has not happened yet.",
    },
  },
  {
    term: "Building code",
    slug: "building-code",
    category: "permits",
    synonyms: ["Code", "Electrical code", "Plumbing code"],
    varies: true,
    definition:
      "The rules setting out how work must be built for safety. Canada works from a national model code with provincial codes built on top of it, and a separate national electrical code adopted province by province; most US jurisdictions adopt a version of the international model codes plus the national electrical code, with local amendments. What is actually enforced on your job is whichever edition your local authority has adopted, so the rule varies from one jurisdiction to the next and is frequently not the newest book published.",
    related: ["permit", "inspection", "trade-licence", "gfci"],
    product: null,
  },
  {
    term: "Rough-in",
    slug: "rough-in",
    category: "permits",
    synonyms: ["First fix"],
    trades: ["plumbing", "electrical", "construction-contracting"],
    definition:
      "The stage where pipe, wire or duct is run through the framing before anything is closed up. It is normally where an inspection happens, because it is the last moment the work can be seen. The finishing stage that follows — fitting the fixtures, devices and trim — is the second fix, and pricing a job usually means pricing the two separately.",
    related: ["inspection", "permit", "fixture", "panel"],
    product: null,
  },

  /* ── Running the job ────────────────────────────────────────────────── */
  {
    term: "Dispatch",
    slug: "dispatch",
    category: "fieldwork",
    synonyms: ["Assigning", "Scheduling"],
    definition:
      "Deciding who goes where, and telling them. In a one-van business dispatch is a memory; from about three people it is the thing that decides whether a day is profitable, because a badly ordered day is paid driving. The information has to travel with the job — the address, the gate code, the scope, the photos — or the trip becomes a phone call.",
    related: ["work-order", "arrival-window", "crew-lead", "lead-time"],
    product: {
      key: "scheduling",
      note: "FieldQuo puts visits on the calendar with the person going assigned, and shows the whole crew's week at once.",
    },
  },
  {
    term: "Arrival window",
    slug: "arrival-window",
    category: "fieldwork",
    synonyms: ["Appointment window", "Time window"],
    definition:
      "The span of time you give the customer for your arrival, rather than a single time you will miss. A window is honest about traffic and about the job before this one, and a narrower one is a better promise only if you can keep it. What customers actually resent is not the width of the window but hearing nothing when it passes.",
    related: ["dispatch", "site-visit", "no-show"],
    product: {
      key: "booking_page",
      note: "FieldQuo's booking page builds travel time and arrival windows into the slots a client can choose.",
    },
  },
  {
    term: "Callback",
    slug: "callback",
    category: "fieldwork",
    synonyms: ["Return visit", "Warranty call", "Go-back"],
    definition:
      "A return trip to put right something that was wrong with a finished job. Callbacks are unpaid by definition, so each one comes straight out of the margin on a job you have already banked — a five per cent callback rate on thin work can be most of the profit. Worth counting by cause rather than by number, because the causes repeat. Note that the same word is also used for simply returning a customer's phone call.",
    related: ["warranty", "deficiency-list", "job-costing"],
    product: null,
  },
  {
    term: "Work order",
    slug: "work-order",
    category: "fieldwork",
    synonyms: ["Job ticket", "Job sheet"],
    definition:
      "The instruction for one piece of work: the address, what is to be done, who is doing it, and what they need to know before they get there. It is what turns a sold quote into something a crew can act on without ringing the office, and the difference between a good one and a bad one is measured in phone calls per day.",
    related: ["dispatch", "scope-of-work", "checklist"],
    product: {
      key: "jobs",
      note: "In FieldQuo an approved quote becomes a job carrying the scope, the address and the paperwork already attached.",
    },
  },
  {
    term: "Checklist",
    slug: "checklist",
    category: "fieldwork",
    synonyms: ["Job checklist", "Standard steps"],
    definition:
      "The fixed list of steps a particular kind of job always needs, ticked off by whoever is doing it. Checklists exist because the steps that get skipped are the invisible ones — the prep, the mask, the second look — and they are the ones the customer notices a month later. They also make the standard the same whoever turns up, which is the whole problem once you are more than one person.",
    related: ["work-order", "deficiency-list", "crew-lead"],
    product: {
      key: "checklists",
      note: "FieldQuo keeps per-job checklists that the person on site ticks off as they go.",
    },
  },
  {
    term: "Crew lead",
    slug: "crew-lead",
    category: "fieldwork",
    synonyms: ["Foreman", "Lead hand", "Charge hand"],
    definition:
      "The person responsible for a crew on site — the standard of the work, the order of the day, and the call to the office when something is not as quoted. Naming one is usually the first real change a growing trade makes, and it needs to come with the authority and the information to go with it, or it is a title rather than a job.",
    related: ["dispatch", "checklist", "timesheet"],
    product: {
      key: "team_access",
      note: "FieldQuo decides dial by dial what each person can see and change, and the rule holds on the server rather than only on the screen.",
    },
  },
  {
    term: "Lead time",
    slug: "lead-time",
    category: "fieldwork",
    synonyms: ["Wait time", "Booking lead time"],
    definition:
      "How far ahead you are booked, or how long a material takes to arrive. Both meanings bite: a customer who wants it next week and hears six weeks goes elsewhere, and a special-order product that takes six weeks strands a crew that was scheduled around it. Not to be confused with a sales lead, which is a different word entirely.",
    related: ["backlog", "dispatch", "lead"],
    product: null,
  },
  {
    term: "Backlog",
    slug: "backlog",
    category: "fieldwork",
    synonyms: ["Booked work", "Work in hand"],
    definition:
      "The work you have sold and not yet done. Backlog is the most honest forward indicator a small trade has: it tells you whether to hire, whether to advertise, and whether you can afford to hold your price on the next quote. A shrinking backlog in a busy month is the warning that arrives before the quiet one.",
    related: ["lead-time", "close-rate", "maintenance-plan"],
    product: {
      key: "dashboard",
      note: "Quoted, won and scheduled work sit together on the FieldQuo dashboard, which is where a backlog stops being a feeling.",
    },
  },
  {
    term: "Time and materials",
    slug: "time-and-materials",
    category: "fieldwork",
    synonyms: ["T&M", "Cost-plus", "Day rate work"],
    varies: true,
    definition:
      "Charging for the hours worked and the materials used, plus an agreed markup, instead of a fixed price. It suits work whose extent genuinely cannot be known up front — chasing a leak, opening up an old building — and it requires records the customer will accept, which means hours logged as they happen rather than reconstructed. Whether you may bill this way at all on residential work varies: some provinces and states still require a written estimate or a ceiling price, so the arrangement is not always as open-ended as it sounds.",
    related: ["job-costing", "change-order", "unit-price", "timesheet"],
    product: {
      key: "materials",
      note: "FieldQuo records what went on site and what it cost against the job, which is the record a time-and-materials bill has to stand on.",
    },
  },
  {
    term: "Timesheet",
    slug: "timesheet",
    category: "fieldwork",
    synonyms: ["Hours", "Time entry", "Clock in and out"],
    definition:
      "The record of who worked how long on what. Hours tied to a job are worth several times hours tied only to a week, because the first can be costed against a price and the second can only be paid. Approving them before they become pay is the step that catches the honest mistakes, which are the common ones.",
    related: ["labour-burden", "job-costing", "time-and-materials", "crew-lead"],
    product: {
      key: "timesheets",
      note: "Hours land against real jobs in FieldQuo and you approve them before they can turn into pay.",
    },
  },
  {
    term: "Walkthrough",
    slug: "walkthrough",
    category: "fieldwork",
    synonyms: ["Final walkthrough", "Handover", "Sign-off walk"],
    definition:
      "Walking the finished job with the customer, agreeing that it is done, and writing down anything that is not. Doing it in person and in daylight settles most of what would otherwise arrive as a text message a week later, and photographs taken on the day answer the rest.",
    related: ["deficiency-list", "substantial-completion", "warranty"],
    product: {
      key: "job_photos",
      note: "Before and after photos file themselves against the job in FieldQuo, ready to go into the invoice or onto your website.",
    },
  },
  {
    term: "No-show",
    slug: "no-show",
    category: "fieldwork",
    synonyms: ["Missed appointment", "Locked out"],
    definition:
      "Arriving to find nobody home and no way in. It costs the trip, the slot, and the job you could have booked instead, which is why it is worth a reminder the day before rather than a policy afterwards. A booking fee also changes the arithmetic, because a customer who has paid something turns up.",
    related: ["arrival-window", "site-visit", "deposit"],
    product: {
      key: "appointment_reminders",
      note: "FieldQuo texts the client before you arrive, which is the cheapest thing there is to do about a locked door.",
    },
  },
  {
    term: "Recurring visit",
    slug: "recurring-visit",
    category: "fieldwork",
    synonyms: ["Standing appointment", "Route stop", "Repeat visit"],
    trades: ["cleaning", "lawn-care", "landscaping", "pressure-washing"],
    definition:
      "Work that comes round on a cycle — the weekly cut, the fortnightly clean, the seasonal service — booked once and repeated rather than sold again each time. Recurring work is the base a seasonal trade plans against, and the whole value of it is lost if somebody has to rebook it by hand every week.",
    related: ["maintenance-plan", "dispatch", "backlog"],
    product: {
      key: "recurring_jobs",
      note: "Weekly, monthly or seasonal work puts itself back on the FieldQuo calendar instead of being rebooked by hand.",
    },
  },

  /* ── Winning work ───────────────────────────────────────────────────── */
  {
    term: "Lead",
    slug: "lead",
    category: "sales",
    synonyms: ["Enquiry", "Inquiry", "Prospect"],
    definition:
      "Somebody who has got in touch and might become a customer. Leads arrive by phone, form, referral and knock, and what they have in common is that they go cold quickly — most trades lose more work to a slow reply than to a high price. Counting them, and counting where they came from, is the start of knowing which advertising is worth paying for.",
    related: ["close-rate", "cost-per-lead", "lead-time", "service-area"],
    product: {
      key: "leads",
      note: "Every enquiry lands in one FieldQuo list, scored hot to cold, and turns into a quote in a click.",
    },
  },
  {
    term: "Close rate",
    slug: "close-rate",
    category: "sales",
    synonyms: ["Win rate", "Conversion rate", "Hit rate"],
    definition:
      "The share of quotes you send that turn into work. It is the cheapest number to improve, because it costs nothing to collect and it moves on things you control — how fast you replied, whether you followed up, how the quote read. A very high close rate is not necessarily good news: it often means the price is too low.",
    related: ["lead", "average-job-size", "good-better-best", "bid"],
    product: {
      key: "benchmark",
      note: "FieldQuo shows where your win rate and your rates sit against other shops in your trade, with nobody named, including you.",
    },
  },
  {
    term: "Cost per lead",
    slug: "cost-per-lead",
    category: "sales",
    synonyms: ["CPL"],
    definition:
      "What you paid in advertising divided by the number of enquiries it produced. Useful only alongside the close rate and the average job size, because a cheap lead that never buys is dearer than an expensive one that does. Tracked by channel it usually shows that one or two sources are carrying the rest.",
    related: ["lead", "close-rate", "average-job-size"],
    product: {
      key: "marketing_spend",
      note: "FieldQuo sets spend by channel against the jobs it actually brought in, so you can stop paying for the channels that do not.",
    },
  },
  {
    term: "Service area",
    slug: "service-area",
    category: "sales",
    synonyms: ["Coverage area", "Catchment"],
    definition:
      "How far you will travel for work, and on what terms. The edge of it is a pricing decision rather than a map one: an hour each way is two unpaid hours out of a day, so a job at the boundary has to be big enough or priced high enough to carry the drive. Saying where you work publicly also saves you the enquiries you were going to decline.",
    related: ["lead", "dispatch", "arrival-window"],
    product: null,
  },

  /* ── Trade talk ─────────────────────────────────────────────────────── */
  {
    term: "Square",
    slug: "square",
    category: "trade",
    synonyms: ["Roofing square", "SQ"],
    trades: ["roofing"],
    definition:
      "One hundred square feet of roof area, which is the unit roofing material and labour are counted in. A twenty-four square roof is 2,400 square feet — measured on the slope, not on the footprint of the house, so a steep roof holds far more squares than its plan area suggests.",
    related: ["pitch", "takeoff", "tear-off", "underlayment"],
    product: {
      key: "aerial_measure",
      note: "FieldQuo returns roof area and pitch from the address, so the squares are counted before anybody gets on a ladder.",
    },
  },
  {
    term: "Pitch",
    slug: "pitch",
    category: "trade",
    synonyms: ["Slope", "Roof pitch"],
    trades: ["roofing"],
    definition:
      "How steep a roof is, given as the rise over a twelve-inch run — a 6/12 roof rises six inches for every twelve it travels across. Pitch decides the material that may be used, how much labour and safety equipment the job needs, and how much bigger the roof is than the house underneath it, so it moves a price at least as much as the area does.",
    related: ["square", "flashing", "takeoff"],
    product: {
      key: "aerial_measure",
      note: "The pitch comes back with the area when FieldQuo measures a roof from the address.",
    },
  },
  {
    term: "Tear-off",
    slug: "tear-off",
    category: "trade",
    synonyms: ["Strip", "Rip-off", "Removal"],
    trades: ["roofing"],
    definition:
      "Stripping the old roof back to the deck instead of laying new material over it. Tear-off adds labour, disposal and a bin, and it is the only way to see the deck — which is where the surprises are, and why a tear-off quote needs a written position on what happens if rotten sheathing turns up.",
    related: ["square", "contingency", "change-order"],
    product: null,
  },
  {
    term: "Flashing",
    slug: "flashing",
    category: "trade",
    synonyms: ["Step flashing", "Counter flashing"],
    trades: ["roofing"],
    definition:
      "Sheet material worked into the joints where a roof meets something else — a wall, a chimney, a valley, a vent pipe. Most leaks are flashing failures rather than failures of the shingles around them, so reusing old flashing on a new roof is the saving that comes back as a callback.",
    related: ["tear-off", "underlayment", "callback"],
    product: null,
  },
  {
    term: "Underlayment",
    slug: "underlayment",
    category: "trade",
    synonyms: ["Underlay", "Felt", "Membrane"],
    trades: ["roofing", "construction-contracting"],
    definition:
      "A layer that goes between the structure and the finished surface, and which means two different things depending on the trade. On a roof it is the sheet laid over the deck under the shingles, the second line of defence against water. Under a floor it is the layer over the subfloor that levels small imperfections, quietens the room and, in the right form, holds back moisture. Both are the part nobody sees and the part that decides how the visible work behaves.",
    related: ["subfloor", "square", "waste-factor"],
    product: null,
  },
  {
    term: "Subfloor",
    slug: "subfloor",
    category: "trade",
    synonyms: ["Substrate", "Deck"],
    trades: ["construction-contracting", "handyman"],
    definition:
      "The structural surface a finished floor is laid on. Whether it is flat, dry and sound decides most of what happens next: nearly every flooring complaint about lipping, hollow spots or squeaks is a subfloor problem wearing the finish's clothes. It is also the part you cannot inspect properly until the old floor is up, which is what a flooring quote should say out loud.",
    related: ["underlayment", "contingency", "exclusions"],
    product: null,
  },
  {
    term: "Cut in",
    slug: "cut-in",
    category: "trade",
    synonyms: ["Cutting in", "Brush work"],
    trades: ["painting"],
    definition:
      "Painting the edges by hand with a brush — along trim, ceilings, corners and anywhere a roller cannot go. Cutting in is the slow part of a paint job and the part the customer inspects, which is why a price built only on wall area under-prices a room full of doors, windows and mouldings.",
    related: ["spread-rate", "sheen", "unit-price"],
    product: null,
  },
  {
    term: "Spread rate",
    slug: "spread-rate",
    category: "trade",
    synonyms: ["Coverage rate", "Coverage"],
    trades: ["painting"],
    definition:
      "How much surface a litre or a gallon of coating covers at the film thickness it is meant to go on at. The figure on the tin assumes a smooth, sealed, previously painted surface; texture, porosity, bare substrate and a strong colour change all drink more than that, sometimes far more. Estimating materials off the tin figure is how a job runs out of paint on a Friday.",
    related: ["mil", "cut-in", "waste-factor", "material-cost"],
    product: {
      key: "material_costs",
      note: "FieldQuo holds what a litre costs you and how much of it a job of a given size takes, so the material line is calculated rather than guessed.",
    },
  },
  {
    term: "Sheen",
    slug: "sheen",
    category: "trade",
    synonyms: ["Gloss level", "Finish"],
    trades: ["painting"],
    definition:
      "How much light a dried coating reflects, running from flat through matte, eggshell and satin to semi-gloss and gloss. Higher sheen wipes cleaner and lasts better in a kitchen or a hallway; it also shows every imperfection in the wall behind it, so choosing it commits you to more preparation.",
    related: ["cut-in", "spread-rate"],
    product: null,
  },
  {
    term: "Mil",
    slug: "mil",
    category: "trade",
    synonyms: ["Wet film thickness", "Dry film thickness", "WFT", "DFT"],
    trades: ["painting"],
    definition:
      "A thousandth of an inch, which is the unit coatings are specified in. Wet film thickness is what can be measured with a gauge while the coating is still wet; dry film thickness is what the specification usually asks for and what is left once the solvent or water has gone. The gap between the two is why a coat applied thin enough to look neat can still fail the spec.",
    related: ["spread-rate", "sheen"],
    product: null,
  },
  {
    term: "Face frame",
    slug: "face-frame",
    category: "trade",
    synonyms: ["Framed cabinet", "American cabinet"],
    trades: ["construction-contracting", "handyman"],
    definition:
      "A cabinet built with a solid wood frame across the front of the box, which the doors and drawer fronts mount to. The alternative, frameless or European construction, has no frame: the doors hang off the box itself, the opening is slightly wider, and the hardware is different. The two are not interchangeable partway through a kitchen, and a customer comparing quotes is often comparing one of each without knowing it.",
    related: ["reveal", "refacing", "linear-foot"],
    product: {
      key: "kitchen_designer",
      note: "FieldQuo's kitchen designer prices the run from the boxes and finishes you pick and puts the result straight into the quote.",
    },
  },
  {
    term: "Reveal",
    slug: "reveal",
    category: "trade",
    synonyms: ["Gap", "Frame reveal"],
    trades: ["construction-contracting", "handyman"],
    definition:
      "The strip of frame or box left visible around a closed door or drawer front. How much reveal a design carries decides how forgiving the installation is: a generous reveal absorbs an out-of-square wall, while a tight one shows every millimetre of it and turns a normal old house into a difficult day.",
    related: ["face-frame", "refacing"],
    product: null,
  },
  {
    term: "Refacing",
    slug: "refacing",
    category: "trade",
    synonyms: ["Cabinet refacing", "Refinishing", "Resurfacing"],
    trades: ["construction-contracting", "painting"],
    definition:
      "Two different jobs that get sold under one heading. Refacing replaces the doors and drawer fronts and covers the visible faces of the existing boxes, so the layout stays and the look changes completely. Refinishing keeps the existing doors and changes their colour or coating. Both are advertised as a new kitchen at a fraction of the price, and they have different costs, different timelines and different results — so the quote should name which one it is.",
    related: ["face-frame", "reveal", "sheen", "scope-of-work"],
    product: null,
  },
  {
    term: "Linear foot",
    slug: "linear-foot",
    category: "trade",
    synonyms: ["Lineal foot", "LF", "Running foot"],
    definition:
      "A foot measured along a run — of cabinet, countertop, trim, fence or gutter — regardless of how tall or deep the thing is. Pricing per linear foot is quick and it is where a lot of money goes missing, because a foot of tall pantry, a foot of base cabinet and a foot of open shelf are not the same amount of work at all.",
    related: ["unit-price", "takeoff", "face-frame"],
    product: {
      key: "price_book",
      note: "Rates in the FieldQuo price book can be held per unit, so a run priced per foot uses your own number rather than a rounded one.",
    },
  },
  {
    term: "Fixture",
    slug: "fixture",
    category: "trade",
    synonyms: ["Plumbing fixture", "Sanitaryware"],
    trades: ["plumbing"],
    definition:
      "Anything water is delivered to or drained from — sink, toilet, bath, shower, hose bib, laundry standpipe. Plumbing work is often counted and permitted in fixtures because each one is a fixed set of connections, so the fixture count is a better guide to the size of a job than the floor area is.",
    related: ["rough-in", "shut-off-valve", "permit"],
    product: null,
  },
  {
    term: "Shut-off valve",
    slug: "shut-off-valve",
    category: "trade",
    synonyms: ["Isolation valve", "Stop valve", "Stop tap"],
    trades: ["plumbing"],
    definition:
      "A valve that isolates one fixture or one branch so the rest of the building keeps its water. Finding that the only working shut-off is the main is the difference between a half-hour job and a day, and it is worth establishing on the estimate visit rather than on the morning.",
    related: ["fixture", "rough-in", "site-visit"],
    product: null,
  },
  {
    term: "Panel",
    slug: "panel",
    category: "trade",
    synonyms: ["Service panel", "Breaker panel", "Load centre", "Distribution board"],
    trades: ["electrical"],
    definition:
      "The box where the incoming electrical supply is split into circuits, each with its own breaker. Its size and its spare capacity govern what else can be added to a building, which is why quoting an addition — a hot tub, a heat pump, a car charger — starts with a look inside the panel rather than at the appliance.",
    related: ["service-upgrade", "rough-in", "gfci"],
    product: null,
  },
  {
    term: "Service upgrade",
    slug: "service-upgrade",
    category: "trade",
    synonyms: ["Service change", "Panel upgrade"],
    trades: ["electrical"],
    definition:
      "Increasing the electrical capacity coming into a building, commonly from one hundred amps to two hundred. It involves the utility as well as the inspector, so it is a job with other people's dates in it — worth scheduling as a sequence of appointments rather than as a day's work.",
    related: ["panel", "permit", "inspection", "lead-time"],
    product: null,
  },
  {
    term: "GFCI",
    slug: "gfci",
    category: "trade",
    synonyms: ["GFI", "Ground-fault circuit interrupter", "RCD"],
    trades: ["electrical"],
    varies: true,
    definition:
      "A device that cuts the power when it detects current leaking to ground, which is what protects a person rather than the wiring. Code requires it in wet and outdoor locations, but exactly which locations, and whether the protection has to be at the outlet or back at the breaker, depends on the edition of the electrical code your jurisdiction has adopted — and those editions differ. Check the one being enforced locally, not the newest one published.",
    related: ["panel", "building-code", "inspection"],
    product: null,
  },
  {
    term: "Ton",
    slug: "ton",
    category: "trade",
    synonyms: ["Tonnage", "Cooling capacity"],
    trades: ["hvac"],
    definition:
      "The unit air-conditioning capacity is sold in: one ton is 12,000 BTU per hour of cooling. It has nothing to do with the weight of the equipment, which is the first thing every homeowner assumes. Sizing by tonnage alone is how oversized systems get installed, which is a comfort problem as well as an efficiency one.",
    related: ["load-calculation"],
    product: null,
  },
  {
    term: "Load calculation",
    slug: "load-calculation",
    category: "trade",
    synonyms: ["Heat loss calculation", "Heat gain calculation", "Manual J"],
    trades: ["hvac"],
    definition:
      "Working out how much heating or cooling a building actually needs from its size, construction, insulation, windows, orientation and climate — rather than from the size of the unit being replaced or a rule of thumb per square foot. Oversized equipment short-cycles, dehumidifies poorly and wears out sooner, so the calculation is what separates a replacement from a guess.",
    related: ["ton"],
    product: null,
  },
  {
    term: "Hardscape",
    slug: "hardscape",
    category: "trade",
    synonyms: ["Softscape", "Hard landscaping"],
    trades: ["landscaping"],
    definition:
      "The built parts of a landscape — patios, walls, paths, steps, decks — as opposed to softscape, which is everything that grows. The distinction matters commercially because the two carry different skills, different equipment, different permitting and very different prices per square foot, and a customer asking for a garden usually wants both.",
    related: ["grading", "cubic-yard", "permit"],
    product: null,
  },
  {
    term: "Grading",
    slug: "grading",
    category: "trade",
    synonyms: ["Grade", "Fall", "Slope"],
    trades: ["landscaping"],
    definition:
      "Shaping the ground so that water runs where you want it to, which normally means away from the building. Grading is invisible when it is right and expensive when it is wrong, and it sits underneath most drainage complaints about patios, lawns and new beds — so it belongs in the scope rather than in the assumptions.",
    related: ["hardscape", "cubic-yard", "scope-of-work"],
    product: null,
  },
  {
    term: "Cubic yard",
    slug: "cubic-yard",
    category: "trade",
    synonyms: ["Yard", "Yd³"],
    trades: ["landscaping", "lawn-care"],
    definition:
      "How bulk material is sold — soil, mulch, gravel, sand, concrete. One cubic yard is twenty-seven cubic feet, which spreads over roughly a hundred square feet at three inches deep. That last figure is the sum most landscapers do in their head on site, and it is the one that decides how many loads the day needs.",
    related: ["takeoff", "grading", "hardscape", "material-cost"],
    product: null,
  },
  {
    term: "Soft wash",
    slug: "soft-wash",
    category: "trade",
    synonyms: ["Low-pressure cleaning"],
    trades: ["pressure-washing", "roofing"],
    definition:
      "Cleaning with a solution and low pressure rather than with force, so the chemistry does the work. It is what siding, painted surfaces, screens and roof shingles need, because high pressure on any of them drives water where it should not go or strips the surface outright. Charging the same rate for soft washing as for flat concrete misprices both.",
    related: ["psi-and-gpm", "unit-price"],
    product: null,
  },
  {
    term: "PSI and GPM",
    slug: "psi-and-gpm",
    category: "trade",
    synonyms: ["Pressure and flow"],
    trades: ["pressure-washing"],
    definition:
      "The two numbers that describe a pressure washer: pounds per square inch is the force at the nozzle, gallons per minute is how much water it moves. Flow largely determines how fast a surface gets clean and rinsed, while pressure is what cuts — and what damages. Buying on the PSI figure alone is the common mistake.",
    related: ["soft-wash"],
    product: null,
  },
  {
    term: "Crown reduction",
    slug: "crown-reduction",
    category: "trade",
    synonyms: ["Reduction pruning", "Crown thinning"],
    trades: ["tree-care"],
    definition:
      "Shortening a tree's branches back to suitable growth points to reduce its size while keeping its natural shape and leaving it able to heal. It is a different job from topping, which cuts limbs back to stubs, produces weak regrowth and damages the tree — a distinction worth explaining in the quote, because the customer asking to have a tree cut back often means the second and wants the first.",
    related: ["stump-grinding", "scope-of-work"],
    product: null,
  },
  {
    term: "Stump grinding",
    slug: "stump-grinding",
    category: "trade",
    synonyms: ["Stump removal"],
    trades: ["tree-care"],
    definition:
      "Chipping a stump away below ground level with a rotating cutting wheel, rather than digging the root plate out. It is almost always priced separately from the felling, usually by the diameter of the stump, and access is what decides the cost — a machine that cannot reach the back garden turns a short job into a long one.",
    related: ["crown-reduction", "site-visit"],
    product: null,
  },
  {
    term: "Material cost",
    slug: "material-cost",
    category: "money",
    synonyms: ["Cost of materials", "Materials"],
    definition:
      "What the stuff on the job actually costs you, as opposed to what it cost the last time you bought it. Material prices in the trades move faster than most price lists do, and a quote built on a rate from last season quietly gives the increase away. Costing the material at what you will pay, not at what you paid, is the only version that survives a busy year.",
    related: ["waste-factor", "job-costing", "markup", "spread-rate"],
    product: {
      key: "material_costs",
      note: "FieldQuo keeps what a material costs you and how much of it a job of a given size uses, so a price rise reaches the next quote.",
    },
  },
];

/**
 * Terms deliberately NOT defined here.
 *
 * Kept in the file rather than in a commit message because the reason is the
 * useful part: each of these is a term our audience genuinely meets, and each
 * one could not be defined at this level of generality without saying
 * something that would be wrong in a jurisdiction a reader actually works in.
 * A missing entry costs a search result. A wrong one about a lien deadline
 * costs somebody their remedy.
 *
 * If a human with the right expertise wants to write one, that is the point of
 * this list.
 */
export const GLOSSARY_GAPS = Object.freeze([
  Object.freeze({
    term: "Preliminary notice / Notice to Owner",
    reason:
      "Who has to serve it, on whom, and within how many days is set state by state in the US and has no single Canadian equivalent. Any definition general enough to be safe would be too vague to act on, and a specific one would be wrong somewhere it matters most.",
  }),
  Object.freeze({
    term: "Prevailing wage / Davis-Bacon",
    reason:
      "Public-works wage determination. Real, but it belongs to commercial contractors bidding government work, not to the trades this product serves.",
  }),
  Object.freeze({
    term: "1099-NEC / T4A / T5018 filing",
    reason:
      "Contractor-payment reporting thresholds and forms change and differ by country. Getting a threshold wrong on a public page is worse than staying quiet, and the correct answer is an accountant's, not a glossary's.",
  }),
  Object.freeze({
    term: "Bond claim",
    reason:
      "The procedure and the deadlines are statutory and differ by jurisdiction and by whether the work is public or private. Surety bond is defined above at a level that is safe; the claim procedure is not.",
  }),
  Object.freeze({
    term: "Joint cheque agreement",
    reason:
      "Common on larger jobs and genuinely useful, but its effect on lien and payment rights depends on the statute it sits under. Not confident enough to define it in one paragraph.",
  }),
  Object.freeze({
    term: "Substantial performance certificate",
    reason:
      "The certificate is a specific instrument under some provincial construction statutes and does not exist under others. Substantial completion is defined above as a concept; the certificate is left to somebody who can name the statute.",
  }),
  Object.freeze({
    term: "Contractor registration / home warranty enrolment",
    reason:
      "New-home warranty registration schemes exist in some provinces and states and not in others, with different names and different triggers. One definition would mislead most readers.",
  }),
]);

export const TRADE_GLOSSARY = Object.freeze(
  ENTRIES.map((entry) =>
    Object.freeze({
      ...entry,
      synonyms: Object.freeze(entry.synonyms || []),
      trades: Object.freeze(entry.trades || []),
      related: Object.freeze(entry.related || []),
      varies: entry.varies === true,
      product: entry.product ? Object.freeze({ ...entry.product }) : null,
    }),
  ),
);

export const GLOSSARY_SLUGS = Object.freeze(TRADE_GLOSSARY.map((e) => e.slug));

/**
 * The index page shows only the opening sentence of each definition.
 *
 * Derived rather than authored as a second `short` field, for the reason
 * AGENTS.md gives about copy-paste duplication: a hand-written summary beside
 * a definition is the copy nobody updates, and it rots into disagreeing with
 * the thing it summarises. The cost is that every definition has to OPEN with
 * a sentence that stands alone — which is a discipline worth having anyway,
 * and which the check enforces.
 *
 * Abbreviations ending in a full stop are the hazard, and one of them is in a
 * headword ("Employee vs. subcontractor"), so this is not hypothetical: a
 * naive split returned "A vs." as a whole sentence. Hence three conditions —
 * the stop must not follow a known abbreviation, it must be followed by
 * whitespace, and then by a capital or a digit. With no match it returns the
 * WHOLE definition rather than a truncated fragment, because a long index line
 * is a cosmetic problem and a sentence cut in half is a wrong one.
 */
export function openingSentence(definition) {
  const text = String(definition || "").trim();
  const match = text.match(
    /^[\s\S]*?(?<!\b(?:vs|etc|approx|incl|no|e\.g|i\.e|Mr|Mrs|Dr|St))[.!?](?=\s+[A-Z0-9])/,
  );
  return match ? match[0].trim() : text;
}

export function glossaryEntry(slug) {
  return TRADE_GLOSSARY.find((e) => e.slug === slug) || null;
}

export function entriesInCategory(categoryKey) {
  return TRADE_GLOSSARY.filter((e) => e.category === categoryKey);
}

/** Alphabetical, for the A–Z rail on the index. Case-insensitive by headword. */
export function alphabetical() {
  return [...TRADE_GLOSSARY].sort((a, b) =>
    a.term.localeCompare(b.term, "en", { sensitivity: "base" }),
  );
}

/**
 * Trade labels for an entry, resolved against app/data/industries.js.
 *
 * Returns only trades that really exist in the industries list — an unknown
 * slug produces nothing rather than a prettified guess, and check-glossary
 * fails on it separately. Padding an unknown slug into a plausible label is
 * exactly the "absence of a statement is not a statement" failure AGENTS.md
 * lists.
 */
export function tradeLabels(entry) {
  return (entry.trades || [])
    .map((slug) => INDUSTRIES.find((i) => i.slug === slug))
    .filter(Boolean)
    .map((i) => i.label);
}
