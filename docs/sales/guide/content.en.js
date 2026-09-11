// docs/sales/guide/content.en.js
//
// The words of the FieldQuo sales reference guide, in English.
//
// ══ Why the copy is separated from the builder ════════════════════════════
//
// Three PDFs are produced from one builder — English, French, Spanish — and a
// translator must be handed sentences, never markup. Anything structural
// (headings, ordering, anchors, the feature table) is computed by
// build-sales-guide.mjs from lib/marketing/featureMatrix.js, which is
// proof-carrying: every entry names the files and exports that must exist, and
// scripts/check-feature-matrix.mjs fails when one does not.
//
// That is the whole reason this guide can be trusted by somebody on a call.
// A rep reading it is not reading marketing copy; they are reading a list the
// build refuses to let drift from the code.
//
// ══ The one rule for whoever edits this ═══════════════════════════════════
//
// Do not describe a feature this file does not take from the matrix. If
// something is missing from the matrix, the fix is to add it there — with its
// proof — not to write a paragraph here. Two features were found missing while
// this was written (the AI vision pass and the Marketing Designer) and they are
// named in the gaps section rather than quietly asserted.
export const GUIDE = {
  lang: "en",
  dir: "ltr",
  title: "FieldQuo — the sales reference",
  subtitle: "What we sell, what it does, and where the edges are.",
  generated: "Generated",
  // The cover's one line of metadata. A template rather than a builder
  // concatenation, because "{features} features" is not a shape every language
  // has — French and Spanish both need the count elsewhere in the sentence.
  coverMeta: "Generated {date} · {features} features",
  intro: {
    heading: "How to use this",
    body: [
      "This is the reference behind the script. The playbook tells you what to say; this tells you what is true, so that when a contractor asks a question you did not expect, you can answer it without guessing.",
      "Every feature listed here is taken from the product's own feature matrix, which names the files that must exist for each one. If a feature is in this document, it is in the product. If something is not here, do not promise it.",
      "Every feature here is described as it works today. Where something is newer than the rest, the deep dive says so. If a contractor asks for something you cannot find in this document, say you will check rather than guessing — a contractor who buys on a promise you could not keep cancels in month two and tells people why.",
      "One rule about who you are handed: Quebec leads go only to reps who have set French under “Languages I can sell in” on the Pay tab. If a Quebec contractor is on your screen, that is why — take the call in French.",
    ],
  },
  pitchHeading: "The one thing to lead with",
  pitch: [
    "Every feature in this document is in every plan. All of it. The plans differ by how many people can use it and nothing else.",
    "That is the argument. A contractor comparing us to Jobber or Housecall Pro is used to a grid where the thing they actually need sits two tiers up. Here there is no tier to climb: the cheapest plan is the whole product for one person, and paying more only adds seats.",
  ],
  plansHeading: "The plans, and what actually changes",
  plansIntro: "Four plans. The only differences are seats, crew logins and price.",
  planCols: { plan: "Plan", price: "Per month", seats: "Full seats", crew: "Crew logins" },
  planNote:
    "A full seat is somebody who creates and changes quotes, jobs and invoices. A crew login is somebody who clocks in, reads their schedule and adds photos — they cost nothing and do not count as a seat.",
  deepHeading: "The parts you will be asked about",
  deepIntro:
    "Ordered the way a contractor's day runs, not the way the software is built. Each one names the feature keys behind it so you can look it up in the reference table.",
  referenceHeading: "Every feature, by part of the business",
  referenceIntro:
    "All of it, grouped by the part of the business it serves. Each row is the feature's own name and one-line description, the same words the public site uses.",
  partialHeading: "Where the edges are — read this before your first call",
  partialIntro:
    "Ten features do less than their name suggests. The wording below is the product's own, not a softened version. Say it out loud on a call and you will never be caught out; say the name alone and you will be.",
  gapsHeading: "Two things we ship and do not claim",
  gapsIntro:
    "Found while writing this guide: both are in the product and neither is in the feature matrix, so neither appears on the public comparison pages. Mention them, but say plainly that they are newer than the rest of this document.",
  glossaryHeading: "Glossary",
  glossaryIntro: "The words a contractor may not know, and the ones we use differently from our competitors.",
  contentsHeading: "Contents",
  backToContents: "Back to contents",
  limitLabel: "What it does not do",
  // Shown beside a limit sentence that has no reviewed translation yet. It is
  // printed rather than hidden: a rep reading a French guide needs to know
  // which sentence they are quoting from a language their customer may not read.
  limitInEnglish: "English original",
  seeAlso: "See",
  partialBadge: "PARTIAL",
  shippedBadge: "LIVE",
  gaps: [
    {
      title: "The AI photo read",
      body:
        "A deep read over the photos attached to a quote, charged per run against the company's AI credit. It is why a contractor can send five photos of a roof and get back something useful about the roof rather than a description of a picture. It is not in the feature matrix, so it does not appear on the public comparison pages.",
    },
    {
      title: "The Marketing Designer",
      body:
        "Ad and social artwork made inside FieldQuo, organised by campaign, using the company's own colours and job photos. A contractor who has been paying somebody to make Facebook posts will care about this one. Also missing from the matrix.",
    },
  ],
  glossary: [
    { term: "Add-on", def: "An extra the client can accept on the quote itself, priced by the server rather than the browser. The homeowner ticks it; the total updates.", key: "add_on_upsell" },
    { term: "Break-even price", def: "The price below which a job loses the contractor money, worked out from their own overhead and labour rather than a rule of thumb.", key: "break_even" },
    { term: "Crew login", def: "Somebody who clocks in, reads their schedule and adds photos. Free, and does not use a seat.", key: "crew_shifts" },
    { term: "Crew inbox", def: "Texting with crew who have no login and will not install an app. They text a number; it lands in the office filed against them.", key: "crew_inbox" },
    { term: "Instant estimate", def: "A price a homeowner produces themselves on the contractor's website, from the contractor's own rates. Never our rates.", key: "instant_quotes" },
    { term: "Job costing", def: "Quoted against actual, after the work — so next year's prices are built on what happened.", key: "job_costing" },
    { term: "Price book", def: "The contractor's own rates for labour, materials and services. Everything priced in FieldQuo comes from here.", key: "price_book" },
    { term: "Seat", def: "Somebody who creates and changes quotes, jobs and invoices. Seats are the only thing the plans differ by.", key: "team_access" },
    { term: "Takeoff", def: "The trade-specific form that turns measurements into a priced quote — squares of roof, linear feet of gutter, doors and drawers.", key: "quotes" },
    { term: "Vision pass", def: "The paid deep photo read. Distinct from the free review, which also looks at photos but does not charge." },
    { term: "White label", def: "Every document a homeowner sees carries the contractor's name and colours, not ours. This is the default, not an upgrade.", key: "white_label" },
  ],
};


/**
 * The deep dives, in the order a contractor's day runs.
 *
 * `keys` are featureMatrix keys. The builder resolves each to its real name,
 * summary and limits, so a paragraph here can never claim something the matrix
 * does not carry — and a feature renamed in the matrix renames itself here.
 */
export const DEEP_DIVES = [
  {
    id: "quoting",
    title: "Quoting, and the sixty-second version",
    keys: ["quotes", "quote_pdf", "quote_send", "instant_quotes", "self_quote", "call_to_quote", "aerial_measure"],
    body: [
      "A quote is the product. Everything else exists because a contractor who quotes faster wins more work, and most of them are quoting at nine at night on a laptop after a full day on site.",
      "There are three ways a price gets made. The estimator builds one from the price book on the tablet in the driveway. The homeowner builds one themselves from the instant estimate on the contractor's website. Or the AI receptionist takes the call and drafts one from what was said.",
      "The sixty-second claim is the second of those, and it is worth being precise about what does the work: the trade's takeoff form does the arithmetic, the price book supplies the rates, and for roofing the roof is measured from the sky rather than typed in. The contractor is picking options, not calculating.",
      "Roofing is the one to demonstrate. Type the address, and the surface area, the pitch and the linear details — eaves, rakes, ridge, hips, valleys — come back from satellite measurement. Nobody climbs anything to produce the first number.",
    ],
  },
  {
    id: "getting-paid-to-quote",
    title: "Getting paid to turn up",
    keys: ["booking_page", "booking_deposit"],
    body: [
      "Contractors who charge for an estimate usually do it because they were burned by tyre-kickers. They will ask whether the software can take that money before the visit, and it can.",
      "The booking page takes the appointment and the deposit in the same step, so the slot is only held once the card has gone through. For a company with a call-out or assessment fee, that fee is the deposit.",
      "Worth saying on the call: this is the same booking page a homeowner uses to book any visit, so a contractor who does not charge simply leaves the deposit off. It is one screen with the money switched on or off, not a separate product.",
    ],
  },
  {
    id: "cost-and-margin",
    title: "Cost, labour and the margin the contractor actually keeps",
    keys: ["job_costing", "break_even", "price_book", "material_costs", "benchmark", "expenses"],
    body: [
      "This is the part that separates us from a quoting app, and it is the part most contractors have never had. A quote screen shows the price. This shows what the job costs to do and what is left.",
      "Materials come from recipes, labour from hours at the rate they actually pay, and overhead from what they told us they spend. The margin on screen is theirs, not a percentage somebody guessed.",
      "Break-even is the one that lands emotionally. It answers the question a contractor has never been able to answer: below what price does this job lose me money. A rep who can show that number is not selling software any more.",
      "Job costing then closes the loop after the work — quoted against actual — so next year's price book is built on what happened rather than what was hoped.",
    ],
  },
  {
    id: "ai-review",
    title: "The AI review, and the photo read",
    keys: ["ai_quote_review", "add_on_upsell", "ai_copilot"],
    body: [
      "Before a quote goes out, the AI reads it and says what is missing, what is priced oddly against the contractor's own history, and which add-ons this kind of job usually needs.",
      "Two things to be careful about here, because they are what a sceptical contractor will push on. It compares against THEIR history, never another company's — their numbers never leave their account. And it suggests; it never edits the quote or sends anything.",
      "There is a deeper paid photo read as well, over the photos attached to a quote. It costs AI credit per run, which is why it is a button rather than something that happens automatically to every photo.",
    ],
  },
  {
    id: "approval-to-invoice",
    title: "Approval, signature, and the invoice that makes itself",
    keys: ["online_approval", "invoices", "invoice_send", "invoice_changes", "client_portal"],
    body: [
      "The homeowner opens the quote on their phone, approves it and signs it there. No printing, no scanning, no meeting to collect a signature.",
      "The invoice then mirrors the quote rather than being rebuilt: same lines, same layout, same branding. That mirroring is deliberate and it is worth naming, because the common failure in this category is an invoice that quietly disagrees with the quote the client signed.",
      "A changed invoice keeps its history, so a contractor can show what changed and when. On a disputed job that record is the whole argument.",
    ],
  },
  {
    id: "payments",
    title: "Getting the money",
    keys: ["card_payments", "stripe_connect", "financing", "sales_tax", "service_plans"],
    body: [
      "Card payment runs through Stripe into the contractor's OWN payout account. FieldQuo never holds their money — that is worth saying early, because contractors have been burned by platforms that sit in the middle.",
      "Cash, cheque and e-transfer are recorded against the invoice by hand, so the paid figure matches reality whatever the homeowner did.",
      "Sales tax is worked out from the job's address rather than the company's, which matters to anyone working across a boundary.",
      "Financing is the one to phrase carefully — read its limits in the last section before you offer it on a call.",
    ],
  },
  {
    id: "doing-the-work",
    title: "From invoice to crew: scheduling, dispatch and the day itself",
    keys: ["jobs", "scheduling", "crew_shifts", "time_clock", "timesheets", "job_photos", "crew_inbox", "recurring_jobs"],
    body: [
      "An approved quote becomes a job, the job gets scheduled and dispatched, and the crew see where to be and what to do.",
      "Crew clock in and out, and those hours are what timesheets, job costing and pay are built from — one set of hours, not three.",
      "The crew inbox is texting for people who do not have a login and will not download an app. A crew member texts a number and it lands in the office, filed against the right person. Contractors with subcontractors or seasonal crews find this immediately obvious.",
      "Before and after photos attach to the job, which is where a homeowner dispute usually ends.",
    ],
  },
  {
    id: "the-phone",
    title: "The phone: the AI receptionist",
    keys: ["voice_receptionist", "voice_callbacks", "call_to_quote"],
    body: [
      "A contractor on a roof does not answer the phone, and a missed call is a job that goes to whoever picked up.",
      "The receptionist answers, takes the details and books the visit. It can also ring back to confirm an appointment.",
      "The strongest demonstration is the call turning into a drafted quote — the enquiry arrives already priced enough for the contractor to look at, rather than as a voicemail to return.",
      "Two facts that come up: the contractor can keep the number on their van and forward missed calls to it, or take a new number. And it is billed by the minute from a credit balance, so a quiet month costs almost nothing.",
    ],
  },
  {
    id: "marketing",
    title: "Getting found: the website, funnels and campaigns",
    keys: ["website_builder", "lead_form", "funnels", "email_campaigns", "review_requests", "testimonials", "bio_link", "embeds", "referrals"],
    body: [
      "Most contractors either have no website or one they cannot edit. FieldQuo builds one from what they already told us — their trades, their services, their photos — and it carries their name, not ours.",
      "Lead funnels are the mobile-first version for ads: a few taps, a scored lead in the pipeline, no form to abandon.",
      "Review requests go out after the job, which is when a happy customer will actually write one.",
      "There is a Marketing Designer for ad and social artwork as well: artwork made inside FieldQuo, organised by campaign, in the company's own colours and with their own job photos. A contractor who has been paying somebody to make Facebook posts will care about this one. It is newer than most of this document.",
    ],
  },
  {
    id: "languages",
    title: "Working in more than one language",
    keys: ["languages", "white_label", "quote_email_wording", "contract_terms"],
    body: [
      "Two separate things, and reps mix them up. The first is the language the CONTRACTOR works in — the app itself. The second is the language the HOMEOWNER reads — the quote, the invoice, the emails.",
      "The second is the one that sells. A contractor whose customers are Spanish-speaking can send a quote in Spanish while working in English themselves.",
      "One rule to state plainly, because it sounds like a limitation and is actually the reassuring part: a document keeps the language it was created in. A signed quote will always say what it said when it was signed. Nothing is re-translated behind the client's back.",
      "Eight languages for the client: English, French, Spanish, Ukrainian, Punjabi, Tagalog, German and Italian. The quote PDF, the invoice, the covering email and the client portal all follow the client's language. The contractor picks it once on the client record and every document after that follows.",
    ],
  },
];
