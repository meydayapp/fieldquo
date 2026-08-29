// app/data/featurePages.js
//
// The copy for /features/[slug] — one page per thing a contractor would
// actually type into a search box.
//
// ══ Why this file cannot invent anything ═══════════════════════════════════
//
// lib/marketing/featureMatrix.js is the list of CLAIMS, each carrying the file
// that makes it true and each proved by scripts/check-feature-matrix.mjs. This
// file is the PROSE around those claims, and it is deliberately not allowed to
// add to them: every page names its features by matrix key, and the renderer
// prints the matrix's own `name` and `summary` for each one. So the sentence a
// homeowner-facing contractor reads on /features/invoicing is the same sentence
// a check script has already proved against app/api/invoices/route.js.
//
// The keys are validated AT MODULE LOAD, below. A typo or a feature somebody
// wished we had takes the build down rather than rendering an empty bullet —
// AGENTS.md's rule ("never ship a control that appears to work and doesn't")
// applied to a marketing page, where the blast radius is a refund rather than
// a wasted click.
//
// ══ What the prose may and may not do ══════════════════════════════════════
//
// May: describe the day this removes from a painter, a cabinet maker or a
// landscaper, and explain how the thing works here rather than in general.
//
// May not: name a capability with no matrix entry behind it. Three in
// particular, because every competitor's page has them and the shape of a
// feature page asks for them: a phone application (there is none — see
// MATRIX_EXCLUSIONS), an accounting or automation integration (there is none),
// and change orders (there is no such object anywhere in the product).
// scripts/check-feature-pages.mjs renders every page and fails on all three.
//
// ══ One page per subject, playing one of two roles ═════════════════════════
//
// /pricing names 29 features (PRICING_FEATURES below). Each one gets a page,
// and a page says which of the 29 it is by carrying `feature`.
//
// 17 of those 29 pages already existed under this route — /features/invoicing
// IS the invoices page, /features/team IS the team-access page — so they were
// declared rather than duplicated. Minting /features/invoices beside
// /features/invoicing would have put two pages about one subject on one site:
// they compete for the same search, they drift the first time one is edited,
// and whichever a visitor lands on is a coin toss. That is the marketing form
// of shipping two controls that look like they do the same thing.
//
// So the two levels are roles, not routes:
//
//   feature   set  → this page is THE page for that one of the 29, and owes
//                    the reader `details`: specifics read out of the very files
//                    that entry names in `proof`.
//   features       → everything the page claims. A canonical page whose list
//                    runs past its own `feature` is ALSO a hub, and the
//                    renderer derives a "More in this area" strip from the
//                    extra keys — so a page cannot list a feature and then
//                    fail to point at the page about it.
//
// A page with no `feature` (leads, marketing, crew, reporting, languages…) is a
// pure hub: it sells the area and hands off. Nothing was orphaned and no
// redirect was needed, because no slug moved.
//
// `image` is rare on purpose. public/marketing holds four real product
// screenshots and no more can be made — the app is behind a login — so an image
// goes only where the picture shows THAT page's subject. Two of the four are
// misnamed and their own alt text says so: hero-scheduling.webp is the client's
// booking page, hero-invoicing.webp is a quote with an Approve button. Every
// other page is built to work without one; `details` is the device that carries
// it, rather than a borrowed screenshot or a gradient block pretending to be a
// product shot.
//
// ══ English prose, translatable claims, and the debt that leaves ═══════════
//
// Following app/data/productFeatures.js: a plain English data module, not the
// t() catalogue. `headline`, `oneLine`, `description`, `pains`, `how` and
// `details` therefore render in English in all six languages, and that is a
// real debt written down here rather than discovered later.
//
// What is NOT in that debt is the part a visitor reads as a claim. Every
// feature name and summary comes from the matrix, every `Where this stops`
// limit comes from the matrix, and every image `alt` carries `altKey` — an
// existing catalogue key that is already translated into all six. Those move
// the day lib/marketing/featureLabels.js lands, without this file changing.
// See the header of app/(marketing)/features/[slug]/page.js for the seam.

import { MATRIX_KEYS, matrixEntry } from "@/lib/marketing/featureMatrix";

/**
 * The features /pricing names, in the order /pricing names them.
 *
 * The pricing page holds the same list (HEADLINE_FEATURES in PricingPlans.js)
 * and that file belongs to the pricing surface, so this is a second copy and it
 * is the one that would rot. scripts/check-feature-pages.mjs therefore reads
 * the pricing page and fails when the two lists disagree — the duplication is
 * allowed to exist only because something asserts it away.
 *
 * The contract this list creates: every key on it has exactly one page whose
 * `feature` is that key. A visitor who reads a name on the pricing page can
 * always get to the page about it.
 */
export const PRICING_FEATURES = Object.freeze([
  // Winning the work
  "quotes",
  "ai_quote_review",
  "voice_receptionist",
  "call_to_quote",
  "instant_quotes",
  "add_on_upsell",
  "follow_ups",
  "booking_page",
  "website_builder",
  // Doing the job
  "scheduling",
  "jobs",
  "job_costing",
  "materials",
  "job_photos",
  "time_clock",
  "crew_inbox",
  // Getting paid
  "invoices",
  "card_payments",
  "financing",
  "invoice_changes",
  "client_portal",
  "sales_tax",
  // Running the business
  "payroll",
  "break_even",
  "price_book",
  "expenses",
  "ai_copilot",
  "white_label",
  "team_access",
]);

/**
 * The pages, in the order the index renders them within their group.
 *
 * `features` is the contract with the matrix: a page claims exactly these
 * entries and nothing else. A key may appear on more than one page — job
 * photos matter to somebody reading about jobs AND to somebody reading about
 * their crew — but every key must appear at least once, which is what
 * `coverage()` below reports and the check script enforces.
 */
const PAGES = [
  // ── Winning the work ─────────────────────────────────────────────────────
  {
    slug: "quotes",
    group: "winning_work",
    label: "Quotes and estimates",
    image: {
      src: "/marketing/hero-quotes.webp",
      alt:
        "A contractor building a quote on a tablet outside a client's home while she reviews it on her phone",
      altKey: "hero.tabs.quotes.alt",
      width: 1400,
      height: 1050,
      caption:
        "A quote being built at the house, off the contractor's own service list and their own rates.",
    },
    inlineImage: {
      src: "/marketing/hero-invoicing.webp",
      alt:
        "A client reading a quote on their phone, with an Approve button at the bottom",
      altKey: "hero.tabs.invoicing.alt",
      width: 1400,
      height: 1050,
      caption:
        "The same quote as the client gets it: the contractor's logo, the contractor's colour, and an Approve button at the bottom. What they saw at the moment they signed is recorded with the signature.",
    },
    feature: "quotes",
    details: [
      {
        label: "One builder, two doors",
        body:
          "Creating a quote and editing one are the same screen. They were once two, and they taxed differently — one on the gross subtotal, the other after the discount — so the same quote had two totals depending on which screen saved it last.",
      },
      {
        label: "Saved first, sent second",
        body:
          "A quote is always written down as a draft before anything is emailed. A send that fails leaves you a draft to retry, never a quote marked as sent that nobody received.",
      },
      {
        label: "Your wording is copied onto the document",
        body:
          "Your terms and your what-happens-next are stored on the quote itself, so changing your defaults in March does not rewrite what you sent in February.",
      },
      {
        label: "Thirty days, unless you say otherwise",
        body:
          "Expiry defaults to thirty days, worked out from the calendar rather than from a clock so the change of hour never moves the date. Clearing the box means no expiry, and that is honoured rather than quietly refilled.",
      },
      {
        label: "The discount stored is the one that applied",
        body:
          "A discount bigger than the quote is clamped before it is saved, so a stored figure can never contradict the total printed beside it.",
      },
      {
        label: "Lines freeze when the quote is decided",
        body:
          "Once a quote is past draft or sent, its line items are locked.",
      },
    ],
    headline: "Price the job once, and send it before you leave the driveway",
    oneLine:
      "Build a quote from your own rates, send it as a PDF in your colours, and let the client sign it online.",
    description:
      "Quoting for field-service contractors: your own rates, good-better-best options, a branded PDF, and online approval with a signature.",
    pains: [
      {
        pain:
          "The numbers get written on the back of a receipt at the house and typed up at nine at night — if you are not too tired.",
        fix:
          "The lines come off your own price book while you are standing in the room, so the quote is finished when the walkthrough is.",
      },
      {
        pain:
          "The homeowner asks what it would cost to do it properly, so you rewrite the whole thing and now there are three files and nobody knows which one they read.",
        fix:
          "One job, three prices, one document. They pick the one they want and that is the one that becomes the job.",
      },
      {
        pain:
          "You ring them twice, they do not pick up, and three weeks later you find out they went with the other painter.",
        fix:
          "A quiet quote gets chased on your schedule, in your words, without you having to remember whose turn it is.",
      },
    ],
    how: [
      {
        step: "It is built from your prices, not from a template",
        body:
          "Lines come from the services and rates you set up once. Group them by room, by floor or by scope, drop in photos from the walkthrough, and the totals and the tax follow the address the work is at.",
      },
      {
        step: "It goes out looking like your company",
        body:
          "The PDF carries your logo and your brand colour, the email comes from your address, and the covering note is written in the language the quote was written in. Nothing on it says FieldQuo.",
      },
      {
        step: "The client signs it from wherever they are",
        body:
          "They open a link, tick any extras you offered, and sign. What they saw at the moment they signed is recorded with the signature, so a fortnight later there is no argument about what was agreed.",
      },
    ],
    features: [
      "quotes",
      "priced_options",
      "quote_pdf",
      "quote_send",
      "online_approval",
      "add_on_upsell",
      "follow_ups",
      "quote_email_wording",
    ],
    related: ["ai-quote-review", "price-book", "invoicing"],
  },
  {
    slug: "ai-quote-review",
    group: "winning_work",
    label: "AI quote review",
    feature: "ai_quote_review",
    details: [
      {
        label: "Most of it is arithmetic",
        body:
          "The completeness checks and the price comparison are computed, not written by a model. If the model is unavailable the computed half still comes back — you lose the wording suggestions, not the review.",
      },
      {
        label: "Compared against your own won work",
        body:
          "Prices are compared with your own accepted and declined quotes and nobody else's. With fewer than five comparable jobs it says it has not got enough to go on, rather than judging you against four.",
      },
      {
        label: "The middle, not the average",
        body:
          "One enormous job does not drag the comparison. High means above your own upper quartile and more than a quarter over the middle; low means under seventy per cent of it.",
      },
      {
        label: "What it counts as missing",
        body:
          "No expiry, an expired one, no client email, no line items, the whole job as a single line, vague descriptions, no terms, no photos. Each carries a weight and the readiness score is what is left of a hundred.",
      },
      {
        label: "It reads photos for you, not for the client",
        body:
          "Only actual photographs go to the model, the number of them is stated so it cannot invent more, and it is forbidden to state a measurement, a material or a brand from a picture. The notes come back for the estimator.",
      },
      {
        label: "It never rewrites what you wrote",
        body:
          "Suggested terms and wording are offered only when the quote has none of its own. It will not rewrite a paragraph you already wrote, so a review never quietly changes a sentence you meant to send.",
      },
    ],
    headline: "A second read of the quote before the client gets it",
    oneLine:
      "It reads the quote you just built and tells you what is missing, where the price sits against the ones you have won, and which sentences a homeowner will not understand.",
    description:
      "An AI read of your quote before you send it: forgotten line items, how the price compares to your own won work, and clearer wording.",
    pains: [
      {
        pain:
          "You priced the paint and forgot the primer, and you find out on day two when there is nothing to put on the wall.",
        fix:
          "The review lists what a job described this way usually needs and you did not include.",
      },
      {
        pain:
          "You quote from memory, and memory is two years out of date on materials.",
        fix:
          "It sets the price beside the jobs you actually won, so a number that is well off is flagged before it is sent, not after it is lost.",
      },
      {
        pain:
          "The scope reads perfectly to you because you wrote it, and the homeowner reads it as a licence to ask for more.",
        fix:
          "It rewrites the parts a person outside the trade would misread, and you keep or discard each suggestion.",
      },
    ],
    how: [
      {
        step: "It only ever reads your own work",
        body:
          "The comparison is against the quotes your company has sent and won. No other company's prices come into it, and yours never leave.",
      },
      {
        step: "You stay the one who decides",
        body:
          "Nothing is changed for you. Every suggestion is a line you accept or ignore, and the quote does not move until you move it.",
      },
      {
        step: "The extras are priced from history too",
        body:
          "Optional add-ons at the bottom of the quote are priced from what you have charged for that work before, and the client ticks the ones they want.",
      },
    ],
    features: ["ai_quote_review", "add_on_upsell", "benchmark"],
    related: ["quotes", "fieldquo-ai", "reporting"],
  },
  {
    slug: "leads",
    group: "winning_work",
    label: "Leads and clients",
    headline: "Every enquiry in one list, instead of four places",
    oneLine:
      "Calls, forms, referrals and walk-ups land in one list, scored hot to cold, one click from being a quote.",
    description:
      "Lead tracking for contractors: one list for every enquiry, scored by how likely it is to close, with a client record and history behind it.",
    pains: [
      {
        pain:
          "One enquiry is in your texts, one is on a voicemail, one is on a sticky note on the dash, and the good one is the one you forgot.",
        fix:
          "They all arrive in the same list, with the address, the job and where they came from already on them.",
      },
      {
        pain:
          "You spend Saturday morning driving to the tyre-kicker and never get to the kitchen that was ready to sign.",
        fix:
          "Each lead arrives hot, warm or cold with the handful of reasons that put it there, so the list is already in the order worth working and you can disagree with it in five seconds.",
      },
      {
        pain:
          "A client rings about the job you did for them two summers ago and you cannot remember the colour, let alone the price.",
        fix:
          "Every client keeps their properties and their history, so the last job is one click away.",
      },
    ],
    how: [
      {
        step: "The form is yours, and it does not go to an inbox",
        body:
          "Drop the lead form on the website you already have. What comes back is a lead in the list with a score on it, not an email you will read on Sunday.",
      },
      // ── Triage, described as what it is ──────────────────────────────────
      //
      // The owner asked for a page explaining "using AI to assess the Hot,
      // cold, warm". It is NOT AI, and saying it is would be the cheapest lie
      // on the site and the easiest to catch: lib/leads/score.js is a fixed
      // weighted sum whose header says why it is deliberately not a model —
      // "a black-box number nobody trusts gets ignored, and an ignored score
      // is a dead control".
      //
      // That is the better story anyway, so it is the one told here: what is
      // weighed, in the order the code weighs it, and the fact that the reasons
      // are printed beside the lead with their points. The ORDER below is not
      // decoration — scripts/check-feature-pages.mjs runs the real scorer and
      // fails if the code stops agreeing with these sentences.
      {
        step: "Hot, warm or cold — and it shows its working",
        body:
          "Every enquiry lands with a temperature and the short list of reasons that produced it, each with the points it added. You can read why this one is hot and that one is not without asking anybody.",
      },
      {
        step: "What it weighs, and in what order",
        body:
          "How soon they want to start counts for more than anything else: somebody who wants it now beats a bigger budget that is just looking. Then the budget they gave, then whether the job is an emergency, then how you can reach them — a phone number is worth more to a trade than an email address. Last comes effort, because effort predicts intent: photos of the wall, a plan they exported, a kitchen they laid out, a description they took the trouble to write. None of those can make a lead hot on its own.",
      },
      {
        step: "It is arithmetic, and you can move it",
        body:
          "There is no model here and nothing is learning about you in the background. It is a fixed set of weights you could add up on paper — which is the point, because a number nobody can argue with is a number nobody uses. If they told you on the phone that the budget was really fifteen thousand, change the answer on the lead and the temperature follows it.",
      },
      {
        step: "Everything is triaged the same way",
        body:
          "The form on your site, an instant estimate, a kitchen somebody drew, a multi-step funnel, a call the receptionist took, and the list you import in your first week all go through the same triage. One list, one meaning for hot.",
      },
      {
        step: "One click turns it into a quote",
        body:
          "The name, the address and what they asked for carry over. You are pricing, not re-typing.",
      },
      {
        step: "Bring the list you already have",
        body:
          "Clients import from wherever they live now, with their properties attached, so the first week is not spent typing.",
      },
    ],
    features: ["leads", "lead_form", "clients", "follow_ups"],
    related: ["quotes", "lead-funnels", "marketing", "ai-receptionist"],
  },
  {
    // ── Why funnels get their own page rather than a bullet on /marketing ──
    //
    // They were one line in a list of six on the marketing page, which is the
    // wrong weight for the thing a contractor points an advert at. The owner
    // asked for it by name. What earns the page is the part nobody advertises:
    // the per-step numbers, which are the only reason a funnel beats a form.
    slug: "lead-funnels",
    group: "winning_work",
    label: "Lead funnels",
    headline: "One question a screen, and you find out exactly where they leave",
    oneLine:
      "A landing page for an advert or a flyer: one question at a time on a phone, a real price partway through, and a count of how many people got that far.",
    description:
      "Multi-step lead funnels for contractors: one question per screen on a phone, an optional price from your own rates halfway through, and per-step numbers showing where people drop out.",
    pains: [
      {
        pain:
          "You pay for the click, they land on a page with a twelve-box form, and you never hear from them again.",
        fix:
          "One question a screen, answers big enough for a thumb, and the contact details asked for last — after they have already put five taps in.",
      },
      {
        pain:
          "Something on that page is losing people and you have no idea which thing it is.",
        fix:
          "Every screen carries how many reached it and what share of the screen before came through, so the one that loses half of them is the one with the number under it.",
      },
      {
        pain:
          "The people who do fill it in are half tyre-kickers, and you find that out on the phone on Saturday.",
        fix:
          "What they tapped is what the triage weighs, so the enquiry arrives hot, warm or cold with its reasons already on it.",
      },
    ],
    how: [
      {
        step: "It is built out of steps, not out of a blank page",
        body:
          "A funnel is an ordered set of screens: an opening hook, questions with one answer or several, an optional price, a place to attach photos, the contact form, and a closing screen. There is nothing else to put on one, which is why a funnel cannot end up as a layout that falls apart on a phone.",
      },
      {
        step: "An answer can decide what comes next",
        body:
          "A single-choice question can send somebody straight to a different screen, so a bathroom enquiry never has to read four questions about kitchens. Leave the branch off and it simply runs in order.",
      },
      {
        step: "A real price, halfway through",
        body:
          "One of the steps can show what the job would cost, worked out from your own rates. You write the size bands in your own words — a single room, about 200 square feet — and they tap one. The price is worked out on our side from your rates; nothing typed into the page decides it, and no figure is ever taken from the visitor.",
      },
      {
        step: "The numbers are per screen, not one rate",
        body:
          "How many started, how many became leads, the share that made it through overall, and then each screen with the share that carried on from the one before. A single conversion rate tells you something is wrong. A per-screen number tells you which screen.",
      },
      {
        step: "What comes out is a lead, not a separate inbox",
        body:
          "The end of the funnel creates the same lead the form on your website creates, triaged the same way, one click from a quote. Their answers to the budget and timing questions are the same answers the triage reads.",
      },
    ],
    features: ["funnels", "instant_quotes", "leads", "marketing_spend"],
    related: ["leads", "marketing", "instant-estimates"],
  },
  {
    slug: "ai-receptionist",
    group: "winning_work",
    label: "AI receptionist",
    feature: "voice_receptionist",
    details: [
      {
        label: "Seven rules that override anything you type into it",
        body:
          "Never give a price, not even a range. Never promise a time it has not offered. Never agree scope or a warranty. Say it is an assistant if the caller asks. Send gas, fire, flooding and sewage to emergency services and take a callback. Never guess your services or your hours. Never take card details.",
      },
      {
        label: "The company is decided by the number dialled",
        body:
          "Which company a caller has reached is worked out from the number they rang and from nothing else in the call, so nothing a caller says can put them through to another company’s diary.",
      },
      {
        label: "Three times, at most",
        body:
          "When it offers appointments it offers up to three, because a longer list read out loud is not a list.",
      },
      {
        label: "It will not take money on the phone",
        body:
          "A visit that carries a fee is not booked on the call. It points at your booking link rather than inventing a figure.",
      },
      {
        label: "What it costs, in the open",
        body:
          "Thirty-five cents a minute. A local number is four dollars a month with no per-minute surcharge; a toll-free one is nine dollars and five cents a minute on top. Outbound calling is limited to the US and Canada, which is where those rates hold.",
      },
      {
        label: "Money is added before the balance is checked",
        body:
          "When a call ends the charge is taken, any automatic top-up runs, and only then is the balance looked at again — so the phone does not go quiet in the gap.",
      },
    ],
    headline: "Your phone gets answered while you are up a ladder",
    oneLine:
      "A voice assistant on your own number takes the call, gets the details, books the visit, and leaves you the recording.",
    description:
      "An AI receptionist for contractors: answers the phone on your own number, takes the job details, books the appointment and drafts the quote.",
    pains: [
      {
        pain:
          "You cannot answer with a sander in your hands, and a homeowner who reaches voicemail rings the next name on the list.",
        fix:
          "The call is answered on the first ring, every time, including at seven on a Sunday evening.",
      },
      {
        pain:
          "You call them back at six, they call back at eight, and the week goes by without either of you catching the other.",
        fix:
          "The details are taken on the first call and the visit is on your calendar before you climb down.",
      },
      {
        pain:
          "Two of tomorrow's appointments will not be in, and you will find that out in their driveway.",
        fix:
          "The assistant rings ahead the day before to confirm, so the morning is not spent driving to locked doors.",
      },
    ],
    how: [
      {
        step: "It answers on a number you own",
        body:
          "You get a number in your own area code, or point your existing one at it. The caller hears your company's name, not ours.",
      },
      {
        step: "It knows your work, and refuses to guess",
        body:
          "It answers from what you told it about your services and your area. It does not quote a price you have not seen.",
      },
      {
        step: "The call comes back as a draft quote",
        body:
          "What the caller described arrives as a draft you open, correct and send — plus the recording and the transcript, so you can hear exactly what was promised.",
      },
    ],
    features: ["voice_receptionist", "voice_callbacks", "call_to_quote"],
    related: ["online-booking", "leads", "quotes"],
  },
  {
    slug: "online-booking",
    group: "winning_work",
    label: "Online booking",
    image: {
      src: "/marketing/hero-scheduling.webp",
      alt:
        "A client picking an appointment time on a contractor's booking page on her phone",
      altKey: "hero.tabs.scheduling.alt",
      width: 1400,
      height: 1120,
      caption:
        "The booking page as a homeowner sees it: real availability, the contractor's own name at the top, and no account to create.",
    },
    feature: "booking_page",
    details: [
      {
        label: "A quarter-hour grid, in the worker's own timezone",
        body:
          "Times come off each person's availability with the appointment's own length and the buffers either side, and anything already in the past is gone.",
      },
      {
        label: "Approved leave takes the whole day",
        body:
          "Including a half day. The request does not record which half, and inventing mornings would strand a homeowner in a driveway.",
      },
      {
        label: "Travel is checked in both directions",
        body:
          "Can they reach this slot from the job before it, and reach the next one after it. Where the distance cannot be worked out the time is still offered — an unknown never hides a slot.",
      },
      {
        label: "The address is looked up again on our side",
        body:
          "Coordinates that came from the browser are never trusted, because those coordinates decide which other times get offered.",
      },
      {
        label: "Arrival windows are off unless you set one",
        body:
          "An exact time by default, capped at two hours, and shown to the client only — your crew keeps the exact time. The wording is written per language, because Punjabi puts the connector after the two times rather than between them.",
      },
      {
        label: "A paid slot is held, not booked",
        body:
          "No appointment exists until the money lands. The hold lasts thirty minutes, and the payment can be confirmed three independent ways so a closed browser tab does not lose the booking.",
      },
    ],
    headline: "Let them book the estimate without ringing you",
    oneLine:
      "A booking page on your real availability, with travel time and arrival windows built in, and a deposit if you want one.",
    description:
      "Online booking for contractors: real availability, travel time between visits, arrival windows, reminders and an optional deposit to hold the slot.",
    pains: [
      {
        pain:
          "Booking an estimate takes four messages and still ends up on a day you are on the other side of the city.",
        fix:
          "They pick from slots that already account for where your previous job is and how long it takes to get there.",
      },
      {
        pain:
          "You block out a Tuesday morning for an estimate and nobody is home.",
        fix:
          "A reminder goes out before you set off, and if you charge a visit fee it is already paid.",
      },
      {
        pain:
          "A client needs to move the appointment and it costs you two phone calls to do it.",
        fix:
          "The confirmation carries a link that lets them move it themselves, into a slot you can actually make.",
      },
    ],
    how: [
      {
        step: "Availability that reflects the day you actually have",
        body:
          "Slots come from your working hours, the visits already booked, and the travel between them. An arrival window is offered rather than a to-the-minute time nobody can keep.",
      },
      {
        step: "A deposit that is not lost money",
        body:
          "Charge a visit fee at the point of booking, and when the work goes ahead it is credited against the invoice rather than sitting somewhere as a separate refund.",
      },
      {
        step: "It works on the site you already have",
        body:
          "Use the booking page on its own address, or paste one line into the site you already run.",
      },
    ],
    features: [
      "booking_page",
      "booking_deposit",
      "client_reschedule",
      "appointment_reminders",
    ],
    related: ["scheduling", "website", "ai-receptionist"],
  },
  {
    slug: "website",
    group: "winning_work",
    label: "Your own website",
    feature: "website_builder",
    details: [
      {
        label: "The model writes sentences and nothing else",
        body:
          "Section order, layout and style are picked from closed lists. It never emits a colour, a style rule or a piece of markup.",
      },
      {
        label: "A list of things it may not invent",
        body:
          "Years in business, certifications, awards, insurance, guarantees, team size, warranty lengths, prices, payment plans and timelines. Your service names have to be reproduced exactly.",
      },
      {
        label: "Generation is never load-bearing",
        body:
          "Every failure falls through to a site built from your own facts. The AI being down produces plainer writing, never a broken page.",
      },
      {
        label: "Regenerating reads what is saved",
        body:
          "Not what is in your browser, so unsaved edits are not quietly published — and it carries your photos and the copy you wrote across.",
      },
      {
        label: "Publishing is never a side effect",
        body:
          "Saving does not publish. It warns you before a placeholder picture goes live, and an unpublished site is visible to you and to nobody else.",
      },
      {
        label: "Five questions, all optional",
        body:
          "How long you have been going, what makes you different, the job you would rather have, the area you cover, and the style you want. A style preset writes editable words into the box rather than setting something hidden.",
      },
    ],
    headline: "A website written from what you already told us",
    oneLine:
      "Your own site, on your own address, built from your services and your photos — and editable block by block when you disagree with it.",
    description:
      "A website for your contracting business, generated from the services, photos and reviews already in your account, on your own address.",
    pains: [
      {
        pain:
          "The website has been on the list for three years. It is still on the list.",
        fix:
          "The first version is written from the services, the photos and the reviews already in your account, so there is a real site before you have written a word.",
      },
      {
        pain:
          "You paid somebody for a site and now every change is an email and a fortnight's wait.",
        fix:
          "You edit it block by block yourself, and publish when you are happy.",
      },
      {
        pain:
          "The site says one thing, the quote says another, and the Instagram bio points at a page that no longer exists.",
        fix:
          "One place holds your services and your reviews, and everything a homeowner sees is drawn from it.",
      },
    ],
    how: [
      {
        step: "Written from your data, not invented",
        body:
          "Service names, prices and testimonials come from your own records. The writing is generated; the facts are not, and a page always falls back to the plain version built from your data alone.",
      },
      {
        step: "Your address, your name on it",
        body:
          "Your own domain, your logo and your colour. The only thing that says FieldQuo is a small footer line on free sites.",
      },
      {
        step: "Or keep the site you have",
        body:
          "Paste one line into it and embed your booking, your quote form or your reviews inside the site you already run.",
      },
    ],
    features: ["website_builder", "embeds", "bio_link", "testimonials"],
    related: ["online-booking", "instant-estimates", "marketing"],
  },
  {
    slug: "instant-estimates",
    group: "winning_work",
    label: "Instant estimates",
    feature: "instant_quotes",
    details: [
      {
        label: "The browser's figure is never the one kept",
        body:
          "Everything is measured and priced again on our side. The public page is never handed your rates — publishing a rate card openly hands it to every competitor in the city.",
      },
      {
        label: "A budget answer is a position, not an amount",
        body:
          "The homeowner picks a band and the band is resolved against your own thresholds, so a cabinet shop's top band counts like a roofer's top band and neither one publishes a price.",
      },
      {
        label: "A trade cannot be switched on until it prices",
        body:
          "Turning one on runs your rate card through the real pricer first. A hand-written copy of those rules once let a trade through on a price the pricer never read.",
      },
      {
        label: "It arrives as a draft flagged for review",
        body:
          "Not as a quote to a client. You open it, correct it and send it.",
      },
      {
        label: "The measurement kept is a fixed list",
        body:
          "Area, squares, pitch, tear-off layers, door and drawer counts and the like — not the whole imagery response.",
      },
    ],
    headline: "Give a number while they are still on your website",
    oneLine:
      "A visitor answers a few questions and gets a price range from rates you set — and you can measure the roof or the driveway without driving there.",
    description:
      "Instant online estimates from your own rates, a public form clients fill in themselves, and roof and area measurement from aerial imagery.",
    pains: [
      {
        pain:
          "Half the enquiries only want a ballpark, and finding out costs you a forty-minute drive each way.",
        fix:
          "They get a range on the spot from rates you set, and the ones who are serious keep going.",
      },
      {
        pain:
          "You spend Saturday driving to measure roofs, and two of the four never had a budget.",
        fix:
          "Type the address and get the roof area and pitch, or trace the driveway or the patio, before you decide it is worth the trip.",
      },
      {
        pain:
          "The intake call is twenty minutes of the same eight questions.",
        fix:
          "A public form asks them, with photos attached, and it arrives as a quote already started.",
      },
    ],
    how: [
      {
        step: "You decide what the questions are and what they cost",
        body:
          "The range is computed from your own rates. Your rate card is never published — the public form asks about the job, not about your prices.",
      },
      {
        step: "Photos come with it",
        body:
          "The homeowner uploads what they are looking at, so you are pricing from a picture rather than from a description of a picture.",
      },
      {
        step: "It lands as work, not as an email",
        body:
          "What comes back is a started quote with the client, the address and the scope on it, ready for you to correct and send.",
      },
    ],
    features: ["instant_quotes", "self_quote", "aerial_measure"],
    related: ["quotes", "website", "leads"],
  },
  {
    slug: "kitchen-designer",
    group: "winning_work",
    label: "Kitchen and cabinet designer",
    headline: "Draw the kitchen, and the price comes with it",
    oneLine:
      "Lay out the run, pick the finishes, and the cabinet prices and the floor plan go straight onto the quote.",
    description:
      "A kitchen and cabinet designer that prices as you draw: cabinet runs, finishes and a floor plan that go straight onto the quote.",
    pains: [
      {
        pain:
          "The client cannot picture it, so they stall, and the job stalls with them.",
        fix:
          "They see the run drawn with their own finishes on it, attached to the quote they are being asked to sign.",
      },
      {
        pain:
          "Counting boxes and doors into a spreadsheet is an evening's work and one transposed number away from a loss.",
        fix:
          "The cabinets are priced from your own rates as you place them, and the total is the quote's total.",
      },
      {
        pain:
          "They change the finish and you re-price the whole kitchen by hand.",
        fix:
          "Change the finish and the price follows, because it was computed from the drawing rather than typed beside it.",
      },
    ],
    how: [
      {
        step: "Your rates, your boxes",
        body:
          "Cabinet, door and finish rates are yours. The designer does the counting and the geometry; it does not decide what anything costs.",
      },
      {
        step: "The client can open the drawing",
        body:
          "The design has its own link, so a homeowner sees the layout without needing an account or a login.",
      },
      {
        step: "It becomes part of the document",
        body:
          "The floor plan and the priced lines go onto the quote itself, so what they approve and what you build are the same thing.",
      },
    ],
    features: ["kitchen_designer", "material_costs"],
    related: ["quotes", "price-book", "job-costing"],
  },
  {
    slug: "marketing",
    group: "winning_work",
    label: "Marketing",
    headline: "Fill next month's calendar, and know which thing filled it",
    oneLine:
      "Campaigns, landing pages, door-knocking routes, review requests and referrals — with the spend set against the jobs it actually brought in.",
    description:
      "Marketing for contractors: email campaigns from your own address, multi-step landing pages, door-hanger routes, review requests, referrals and spend-per-channel reporting.",
    pains: [
      {
        pain:
          "January is dead and you find that out in January.",
        fix:
          "Write once and send to your own client list from your own address, before the quiet month arrives.",
      },
      {
        pain:
          "You spend on ads every month and could not say which of them ever produced a job.",
        fix:
          "Spend goes in by channel and sits beside the jobs it brought in, so the channel that produces nothing is visible rather than assumed.",
      },
      {
        pain:
          "Your best clients would happily recommend you and nobody ever asks them.",
        fix:
          "After the job is finished and paid, one polite ask goes out — and a contractor you refer earns you both a free month.",
      },
    ],
    how: [
      {
        step: "It goes out as you, to your own list",
        body:
          "Campaigns send from your verified address to the clients already in your account, and you can see what reached them.",
      },
      {
        step: "The neighbourhood work is planned, not remembered",
        body:
          "Plan the streets, hand them to whoever is walking them, and the stops get ticked off as they go.",
      },
      {
        step: "The ask is timed, not nagged",
        body:
          "The review request waits until the work is done and the invoice is paid, which is the only moment it is fair to ask.",
      },
    ],
    features: [
      "funnels",
      "email_campaigns",
      "door_hanger_routes",
      "review_requests",
      "referrals",
      "marketing_spend",
    ],
    related: ["website", "leads", "lead-funnels", "reporting"],
  },
  {
    slug: "subcontractors",
    group: "winning_work",
    label: "Subcontractor prices",
    headline: "Take a sub's price into your bid without re-typing it",
    oneLine:
      "Pull a subcontractor's quote in as a cost, mark it up, and your client sees only your price.",
    description:
      "Bring a subcontractor's quote into your own bid as a cost line, mark it up, and keep your client seeing one price — with the honest limits stated.",
    pains: [
      {
        pain:
          "The electrician's number arrives as a photograph of a page, and you re-type it into your bid at eleven at night.",
        fix:
          "Their quote comes in as cost lines you can mark up, with nothing re-typed and nothing transposed.",
      },
      {
        pain:
          "You mark it up in your head, forget which lines were theirs, and cannot tell afterwards what the job really made.",
        fix:
          "Their price stays on the job as a cost, so the margin on it is visible when you look at what the job made.",
      },
      {
        pain:
          "The homeowner sees a bid that reads like three different companies wrote it.",
        fix:
          "The client sees one document, in your colours, at your price.",
      },
    ],
    how: [
      {
        step: "It arrives through their quote link",
        body:
          "The subcontractor sends you the same link they would send a homeowner, and you import it as costs on your own bid instead of approving it.",
      },
      {
        step: "The markup is yours and it is not shown",
        body:
          "Imported lines land under a cost category you control. What the client reads is your price, not theirs plus a percentage.",
      },
      {
        step: "Read the limits before you switch",
        body:
          "This is a narrow, real piece of subcontractor work, not the whole of it. Exactly where it stops is written below rather than left for you to discover.",
      },
    ],
    features: ["subcontractor_bids", "contractor_payouts"],
    related: ["quotes", "payroll", "job-costing"],
  },

  {
    slug: "quote-from-the-call",
    group: "winning_work",
    label: "A quote from the call",
    feature: "call_to_quote",
    details: [
      {
        label: "No price is ever said on the phone",
        body:
          "The rules the receptionist answers under sit above anything you type into it, and the first one is that it never gives a price — not even a range, not even when pushed.",
      },
      {
        label: "The draft has no rates in it either",
        body:
          "What comes back is the work described, as scope. There is no path from a phone call to a priced document without an estimator opening it, so nothing reaches a client at a number nobody chose.",
      },
      {
        label: "Reading it again is free",
        body:
          "The draft is kept against the call, so opening it a second time costs nothing. Only asking for a new one uses your AI allowance.",
      },
      {
        label: "The quote itself is saved by a person",
        body:
          "The draft becomes a real quote only when somebody presses Save in the ordinary builder, through the ordinary checks.",
      },
      {
        label: "Four named reasons instead of one shrug",
        body:
          "AI switched off, the service switched off, a call with no words in it, or nothing in the call that described work. And where there is no recording to read, the button is absent rather than present and broken.",
      },
      {
        label: "Who can open the calls",
        body:
          "Calls open to the people who return calls. It is decided by the same access dial as the client list, so an estimator keeps them and crew do not.",
      },
    ],
    headline: "The call becomes a draft quote, not a note you have to decipher",
    oneLine:
      "What the caller described comes back written up as scope you open, correct and price — from the words on the recording, with no prices in it.",
    description:
      "Turn a recorded call into a draft quote: the scope the caller described, written up for an estimator to correct and price. No price is ever quoted on the phone.",
    pains: [
      {
        pain:
          "You listen to a two-minute voicemail three times trying to work out which side of the house she meant.",
        fix:
          "The words on the call come back written up as scope, so you are correcting a draft rather than reconstructing one.",
      },
      {
        pain:
          "Somebody rings at four, and by the time you sit down at eight you have lost half of what they said.",
        fix:
          "The call is already a draft when you open the office. You edit it instead of starting it.",
      },
      {
        pain:
          "You would never let an answering service quote a number, and every one of them wants to.",
        fix:
          "This one cannot. There is no way for it to say a price out loud, and the draft it writes has no prices on it.",
      },
    ],
    how: [
      {
        step: "It writes scope, never a price",
        body:
          "The draft is the work as the caller described it. Pricing is yours, done in the builder from your own price book, because a price given on the phone by something that has not seen the house is the fastest way to lose money on a job.",
      },
      {
        step: "You ask for it, afterwards, in the office",
        body:
          "Drafting happens later and only when somebody with quoting access asks. The call itself does nothing but record what was said.",
      },
      {
        step: "It tells you why when it cannot",
        body:
          "Four named answers rather than one error, so you know whether to turn something on, ring the caller back, or ignore it.",
      },
    ],
    features: ["call_to_quote"],
    related: ["ai-receptionist", "quotes", "online-booking"],
  },
  {
    slug: "suggested-add-ons",
    group: "winning_work",
    label: "Suggested add-ons",
    feature: "add_on_upsell",
    details: [
      {
        label: "Eight, at most",
        body:
          "A quote carries up to eight optional extras. More than a handful is a second quote, and the cap says so rather than letting a list grow until nobody reads it.",
      },
      {
        label: "Counted out of your own quotes",
        body:
          "The suggestions are the three things that most often appear alongside the work already on this quote, counted across your own recent sent and accepted quotes, each with the share of the time it turned up. There is no model involved and no other company's work in it.",
      },
      {
        label: "Nothing free is offerable",
        body:
          "Saving an extra at zero or less is refused and the offending names are read back to you. The invoice is built from what the client ticked, so an unpriced tick would be an unpriced line on a bill.",
      },
      {
        label: "Frozen once the quote is decided",
        body:
          "Editing extras on an accepted or declined quote is refused, because it would change what somebody is billed.",
      },
      {
        label: "Measured extras look after themselves",
        body:
          "Extras derived from a measurement are worked out again every time you save and sit above the ones you wrote by hand, so an edit is never quietly overwritten.",
      },
    ],
    headline: "The extras you meant to offer, at the bottom of the quote",
    oneLine:
      "Optional extras the client can tick, suggested from what you have actually sold alongside this work before, and priced by you rather than by a guess.",
    description:
      "Optional extras on a quote: suggested from your own accepted work, priced by you, ticked by the client, and carried onto the invoice exactly as they were chosen.",
    pains: [
      {
        pain:
          "You remember the handle upgrade on the drive home, and by then the quote has gone.",
        fix:
          "The extras that usually go with this work are proposed while you are still building it.",
      },
      {
        pain:
          "Upsell suggestions in other software are somebody else's catalogue with your name on the top.",
        fix:
          "The suggestion is counted out of your own quotes: what you sold beside this work, and how often.",
      },
      {
        pain:
          "A client ticks an extra and now the invoice and the quote disagree about the total.",
        fix:
          "Only the extras they ticked reach the invoice, and the invoice is built from those ticks rather than retyped.",
      },
    ],
    how: [
      {
        step: "Counted, not guessed",
        body:
          "The suggestions come from counting what appears alongside this work across your last couple of hundred quotes, with the frequency stated so you can disagree with it.",
      },
      {
        step: "You set the price, or there is no extra",
        body:
          "An extra with nothing on it is refused by name. A client cannot tick something that has no price.",
      },
      {
        step: "It stops when the quote is decided",
        body:
          "Once the client has accepted or declined, the extras are fixed and the invoice is built from the ones they chose.",
      },
    ],
    features: ["add_on_upsell"],
    related: ["quotes", "ai-quote-review", "price-book"],
  },
  {
    slug: "automatic-follow-ups",
    group: "winning_work",
    label: "Automatic follow-ups",
    feature: "follow_ups",
    details: [
      {
        label: "Three triggers, and only three",
        body:
          "A quote with no response, an invoice past its date, and a job just finished. Nothing else can be picked, because nothing else is wired to send.",
      },
      {
        label: "Three days, five days, two days",
        body:
          "The defaults, in that order. Each rule sets its own number, in hours or in days.",
      },
      {
        label: "Email, and the page says so",
        body:
          "There is one channel and it is declared once, so the diagram on your settings screen cannot draw a text-message branch that nothing would ever send. A build check fails if the drawing and the sending disagree.",
      },
      {
        label: "It cannot double-send",
        body:
          "Each send is claimed before it goes out, so two runs overlapping cannot produce two copies of the same chase.",
      },
      {
        label: "A job finished before we recorded finishing is left alone",
        body:
          "There is no date to count from, so it is skipped rather than chased on a guessed one.",
      },
      {
        label: "A client with no email is counted, not chased",
        body:
          "Clients with no address, and rules with no wording, are reported as skipped rather than failing where nobody would see it.",
      },
    ],
    headline: "The chase you keep meaning to do, done on a schedule",
    oneLine:
      "A quote that goes quiet, an invoice that goes past due and a job that has just finished each get a message on your timing, in your words.",
    description:
      "Automatic follow-up emails on three triggers: a quote with no answer, an overdue invoice and a finished job. Your wording, your delay, and the chase stops on its own.",
    pains: [
      {
        pain:
          "You ring them twice, they do not pick up, and three weeks later you hear they went with somebody else.",
        fix:
          "A quiet quote gets chased on your schedule, without you having to remember whose turn it is.",
      },
      {
        pain:
          "Chasing money makes you feel like a debt collector, so the invoice sits there instead.",
        fix:
          "The overdue note goes out in wording you wrote once, at the interval you set.",
      },
      {
        pain:
          "You send a chase and find out they paid last Tuesday.",
        fix:
          "Chasing stops because the quote or the invoice moved on. There is no separate switch to remember to flick.",
      },
    ],
    how: [
      {
        step: "Three triggers, with your own delays",
        body:
          "A quote with no answer, an invoice past due, and a job just finished, each at the interval you choose in hours or days.",
      },
      {
        step: "It stops by itself",
        body:
          "Nothing is marked as done chasing. A quote drops out because its status left sent, which means an answer, an acceptance or a payment ends the chase without anybody switching it off.",
      },
      {
        step: "What it could not do, it tells you",
        body:
          "Clients with no email address and rules with no wording are counted and reported rather than silently passed over.",
      },
    ],
    features: ["follow_ups"],
    related: ["quotes", "invoicing", "leads"],
  },
  // ── Doing the job ────────────────────────────────────────────────────────
  {
    slug: "scheduling",
    group: "doing_the_job",
    label: "Scheduling and dispatch",
    feature: "scheduling",
    details: [
      {
        label: "A visit moves the job forward, once",
        body:
          "Booking a visit moves a job from unscheduled to scheduled and no further, so a follow-up visit on a finished job does not drag it backwards.",
      },
      {
        label: "Two weeks of the team, read three ways",
        body:
          "The team calendar covers fourteen days and merges appointments, job visits and bookings — with bookings already turned into appointments left out, so nobody is counted twice. Busiest person first.",
      },
      {
        label: "Not allowed to see the team is not an error",
        body:
          "You get your own week and a plain statement that the team view is not yours. Asking after one particular person returns one deliberately generic sentence, so names cannot be fished out of the wording.",
      },
      {
        label: "Assigning yourself is not assigning somebody else",
        body:
          "Putting yourself on a visit needs nothing special. Putting somebody else on one needs the right to assign, so a crew member can pick work up without being able to hand it out.",
      },
      {
        label: "Shifts are drafted, then published",
        body:
          "An unpublished shift is invisible to the person on it. Scheduling somebody who is not available is refused with the reasons listed, and where the reason is approved leave there is no override button at all — not a greyed-out one.",
      },
    ],
    headline: "The whole crew's week on one screen",
    oneLine:
      "Put visits on the calendar, assign who is going, publish the rota, and let repeat work put itself back on.",
    description:
      "Scheduling and dispatch for field crews: visits, assignments, a published rota, recurring work, reminders and time off in one calendar.",
    pains: [
      {
        pain:
          "The schedule lives in your head and in a group chat, and the two disagree by Wednesday.",
        fix:
          "One calendar, published, where everyone sees their own week and you see all of it.",
      },
      {
        pain:
          "Two crews turn up at the same address and neither of them brought the sprayer.",
        fix:
          "Every visit carries who is going and what the job is, so the double-booking is visible before it is a wasted morning.",
      },
      {
        pain:
          "The weekly maintenance round gets forgotten the week you are busiest.",
        fix:
          "Repeat work puts itself back on the calendar without anyone remembering it.",
      },
    ],
    how: [
      {
        step: "Assign the person, not just the day",
        body:
          "A visit carries the person going, the address and the scope. The crew's own view shows their shifts and nothing they have no business seeing.",
      },
      {
        step: "Publish it once",
        body:
          "Build next week's rota, publish it, and everyone sees their own shifts. Time-off requests go to the right manager and the calendar knows about them.",
      },
      {
        step: "The client is told, and can move it",
        body:
          "A reminder goes out before you arrive, and the confirmation carries a link that lets the client move the visit without ringing you.",
      },
    ],
    features: [
      "scheduling",
      "crew_shifts",
      "recurring_jobs",
      "client_reschedule",
      "appointment_reminders",
      "time_off",
    ],
    related: ["jobs", "crew", "online-booking"],
  },
  {
    slug: "jobs",
    group: "doing_the_job",
    label: "Job management",
    feature: "jobs",
    details: [
      {
        label: "Archived and current are never mixed",
        body:
          "Asking for archived jobs returns archived jobs. No list quietly blends the two.",
      },
      {
        label: "Crew see the jobs they are on",
        body:
          "Scoped by having a visit on the job, through one shared rule rather than a copy per screen. A job with no visits on it shows to nobody, which is deliberate.",
      },
      {
        label: "Creating one is gated twice",
        body:
          "The coarse right to create a job, and then the level set on jobs itself.",
      },
      {
        label: "One definition of what a job is",
        body:
          "The same creation path serves the quote route and the invoice route, so a job raised from either place is the same thing with the same checks.",
      },
      {
        label: "Visits come back in the order they happen",
        body:
          "Each job carries its client and its visits sorted by date, so the list reads without a second lookup.",
      },
    ],
    headline: "The approved quote becomes the job, with the paperwork on it",
    oneLine:
      "Scope, address, tasks, checklists, materials and photos, in one place, for the person actually doing the work.",
    description:
      "Job management for contractors: the approved quote becomes a job carrying the scope, the address, the checklist, the materials and the photos.",
    pains: [
      {
        pain:
          "The scope was agreed six weeks ago and the person on site has never read it.",
        fix:
          "The job carries the approved scope and address, so what was sold and what gets built are the same document.",
      },
      {
        pain:
          "Three rooms, two people, and nobody is sure who was doing the trim.",
        fix:
          "Break the job into rooms or zones and hand each one to a named person.",
      },
      {
        pain:
          "You remember the touch-up list on the drive home, and forget it by the time you are home.",
        fix:
          "Everything outstanding sits in one list, ordered by what will hurt most if it is left.",
      },
    ],
    how: [
      {
        step: "Nothing is re-entered",
        body:
          "An approved quote becomes a job carrying the lines, the address and the client. The photos filed against it are ready to go into the invoice or onto your website.",
      },
      {
        step: "The list writes most of itself",
        body:
          "The job proposes the tasks a job of this kind usually needs. You keep the ones that apply.",
      },
      {
        step: "Materials are tracked as they are used",
        body:
          "What went on site, what it cost and what is still to buy, so the number at the end of the job is a real one.",
      },
    ],
    features: [
      "jobs",
      "work_areas",
      "tasks",
      "suggested_tasks",
      "checklists",
      "materials",
      "job_photos",
    ],
    related: ["scheduling", "job-costing", "crew"],
  },
  {
    slug: "crew",
    group: "doing_the_job",
    label: "Your crew in the field",
    headline: "The van reports in without anybody typing anything",
    oneLine:
      "Crew text photos and updates to one number and they file themselves against the right job; hours clock on against the job they are on.",
    description:
      "Field crew tools: a text-in inbox that files photos against the right job, clock in and out from any phone browser, and timesheets you approve.",
    pains: [
      {
        pain:
          "Progress photos live in six different phones and one group chat, and none of them are attached to a job.",
        fix:
          "The crew text them to one number and they file themselves against the job they belong to.",
      },
      {
        pain:
          "Hours arrive on Friday, written on the back of an envelope, remembered rather than recorded.",
        fix:
          "They clock on against the job they are standing on, and the hours are tied to real work when you review them.",
      },
      {
        pain:
          "You want to give the crew what they need without handing over your client list and your prices.",
        fix:
          "Crew see their own shifts and the jobs they are on. Their access is a fixed, narrow one, and it holds on the server rather than by hiding buttons.",
      },
    ],
    how: [
      {
        step: "A text message, not an installation",
        body:
          "There is nothing for the crew to install. They text one number from whatever phone they already have, and the clock and the schedule open in a phone browser.",
      },
      {
        step: "Hours land against a job",
        body:
          "Clocking on is tied to the job, not to a blank timesheet, so the labour cost lands where the job costing can see it.",
      },
      {
        step: "You approve before it counts",
        body:
          "Nothing turns into pay until you have looked at it and approved it.",
      },
    ],
    features: [
      "crew_inbox",
      "time_clock",
      "timesheets",
      "crew_shifts",
      "job_photos",
    ],
    related: ["scheduling", "payroll", "team"],
  },
  {
    slug: "job-costing",
    group: "doing_the_job",
    label: "Job costing",
    feature: "job_costing",
    details: [
      {
        label: "Only approved hours are a cost",
        body:
          "Hours still waiting on approval are reported separately and never folded into the total.",
      },
      {
        label: "An unknown rate is not free labour",
        body:
          "Somebody with no hourly rate contributes hours and no money, and the total is marked as knowably short rather than quietly low.",
      },
      {
        label: "Missing is not the same as nothing",
        body:
          "A job with no estimate has no variance and no margin figure at all — it is never reported as on budget.",
      },
      {
        label: "The estimate is a snapshot",
        body:
          "Variance is measured against the costing saved when the quote was written, not against today's price book, and the date of that snapshot is shown beside it.",
      },
      {
        label: "Nothing is recomputed while a quote sits still",
        body:
          "If a costing was saved it comes back exactly as saved — not one field refreshed — so no figure moves under you between one look and the next.",
      },
      {
        label: "It is a separate read from the quote itself",
        body:
          "The quote's own response feeds the PDF and the client's link, so cost and margin cannot leak by accident.",
      },
      {
        label: "Switched off means refused",
        body:
          "Not zeroes. A panel of zeroes reads as a job that cost nothing.",
      },
    ],
    headline: "Find out what the job made, while you can still do something about it",
    oneLine:
      "Labour, materials and expenses set against the price you quoted, job by job.",
    description:
      "Job costing for contractors: labour, materials and expenses against the quoted price, with a break-even figure worked out from your real overhead.",
    pains: [
      {
        pain:
          "The year was busy and the bank account says otherwise, and you cannot point at which jobs did it.",
        fix:
          "Every job shows what it was quoted at and what it consumed, so the losing kind of work is nameable.",
      },
      {
        pain:
          "You know your hourly rate. You do not know what an hour has to earn before you keep any of it.",
        fix:
          "Your real overhead is turned into the figure a day has to bring in before you make a cent.",
      },
      {
        pain:
          "Materials are a receipt in the glovebox and a guess in the spreadsheet.",
        fix:
          "What a litre of paint or a sheet of ply costs you is recorded once, and how much of it a job of this size eats is applied from there.",
      },
    ],
    how: [
      {
        step: "It uses the hours you already approved",
        body:
          "Labour comes from clocked, approved time against that job. It is not a separate number somebody re-enters.",
      },
      {
        step: "Job spend and business spend stay apart",
        body:
          "An expense belongs either to a job or to the business. Keeping them apart is what makes both the job margin and the overhead figure true.",
      },
      {
        step: "The quote is the yardstick",
        body:
          "Costs are shown against what you quoted, which is the comparison that tells you whether to price that kind of work differently next time.",
      },
    ],
    features: [
      "job_costing",
      "materials",
      "expenses",
      "break_even",
      "material_costs",
    ],
    related: ["jobs", "reporting", "price-book"],
  },

  {
    slug: "materials",
    group: "doing_the_job",
    label: "Materials on the job",
    feature: "materials",
    details: [
      {
        label: "The unit is part of what a material is",
        body:
          "The same material bought by the cubic yard and by the tonne is treated as two different purchases, because it is.",
      },
      {
        label: "Untick it and the price history stays",
        body:
          "Unticking clears the cost, the supplier and who bought it. What was recorded about the price stays, because the purchase did happen.",
      },
      {
        label: "Costs and counts are gated separately",
        body:
          "Somebody who may not see money still sees the list, the units and how much of it is bought. Only the amounts are removed, and the fact that they were removed is stated rather than left as a blank column.",
      },
      {
        label: "Posting a cost you may not see is refused",
        body:
          "Refused outright, not accepted and dropped. Adding a line with no price on it still works.",
      },
      {
        label: "Defaults when you add one by hand",
        body:
          "Quantity falls back to one and the unit to each. The line goes to the bottom and is marked as yours, so rebuilding the list leaves it alone.",
      },
    ],
    headline: "What went on site, what it cost, and what is still to buy",
    oneLine:
      "A buy list derived from the scope you already quoted, ticked off as it is bought, with the real prices feeding back into what the next job is estimated at.",
    description:
      "A materials list built from the quote's own scope: what to buy, what it was estimated at, what it actually cost, and a price history that improves the next estimate.",
    pains: [
      {
        pain:
          "The list is on the back of a delivery note in the van and nobody else can see it.",
        fix:
          "The list is on the job, derived from the scope you already quoted, and anybody with access can see what is left.",
      },
      {
        pain:
          "You rebuild the list after a scope change and lose the three things you already bought.",
        fix:
          "Rebuilding keeps everything already bought and everything you typed in yourself. Only unbought derived lines are replaced.",
      },
      {
        pain:
          "You are still estimating gravel at last year's price because nobody wrote down what you paid.",
        fix:
          "The price you enter when you tick a line off becomes part of what the next estimate is built on.",
      },
    ],
    how: [
      {
        step: "Derived from the scope, not typed twice",
        body:
          "Lines come from the same bill of materials the costing panel prices, using your own rate overrides where you have set them rather than a default nobody chose.",
      },
      {
        step: "Rebuilding never destroys work",
        body:
          "Anything bought and anything added by hand survives, and it reports what was created, what was kept and what was removed rather than leaving you to notice.",
      },
      {
        step: "Ticking it off teaches the price book",
        body:
          "A real cost entered on a purchase is recorded per unit and folded into a full average across every entry, so one mistyped receipt is diluted rather than becoming the new price.",
      },
    ],
    features: ["materials"],
    related: ["job-costing", "jobs", "price-book"],
  },
  {
    slug: "job-photos",
    group: "doing_the_job",
    label: "Before and after photos",
    feature: "job_photos",
    details: [
      {
        label: "Four labels, not free text",
        body:
          "Start, progress, finish and problem. A closed list, so a gallery can be built out of it and no photo ends up in a category of one.",
      },
      {
        label: "A problem photo cannot be featured",
        body:
          "Trying is refused with the reason and the fix — change the label first — rather than accepted and quietly skipped.",
      },
      {
        label: "What a caption may be",
        body:
          "Up to two hundred characters. Clearing it stores nothing rather than an empty string, and a change with nothing in it is refused instead of counting as a save.",
      },
      {
        label: "Looking and publishing are different rights",
        body:
          "Seeing the job's photos and choosing which appear on your website are separate levels, so a coordinator can look without publishing.",
      },
      {
        label: "What may be sent up",
        body:
          "Photos to fifteen megabytes, video to a hundred, documents to twenty-five. Uploads are signed on our side and require you to be signed in — never an open door on the internet.",
      },
    ],
    headline: "The photos your crew already takes, filed against the job",
    oneLine:
      "Crew text photos in, they land on the right job with a before or after label already on them, and the ones you pick go on your own website.",
    description:
      "Job photos filed from your crew's texts, sorted into start, progress, finish and problem, with the ones you choose shown on your own website and nothing else public.",
    pains: [
      {
        pain:
          "The before photos are on somebody's phone, and that somebody left in March.",
        fix:
          "Photos arrive against the job rather than into a personal camera roll, and they stay there.",
      },
      {
        pain:
          "You want a gallery on your site and rebuilding one out of four phones is a Sunday afternoon.",
        fix:
          "Tick the ones worth showing and they are on your site. Nothing is published for being recent.",
      },
      {
        pain:
          "Somebody puts a picture of a burst pipe on the website.",
        fix:
          "A photo marked as a problem cannot be featured, and the refusal tells you what to change.",
      },
    ],
    how: [
      {
        step: "They arrive by text from the phone the crew already has",
        body:
          "A photo sent to your crew number is filed against the job that person is on, and whatever they typed with it is added to the visit rather than replacing the note that is already there.",
      },
      {
        step: "Start, progress, finish or problem",
        body:
          "The label is inferred from the words in the message — problem words beat finish words, finish beats start, and anything unrecognised is progress. It is a starting point, and always yours to change.",
      },
      {
        step: "You decide what a stranger sees",
        body:
          "Nothing is public until you feature it, and a problem photo is refused rather than silently dropped, so you never wonder why it did not appear.",
      },
    ],
    features: ["job_photos"],
    related: ["crew", "jobs", "website"],
  },
  {
    slug: "time-clock",
    group: "doing_the_job",
    label: "Clock in and out",
    feature: "time_clock",
    details: [
      {
        label: "Record-keeping only",
        body:
          "No location, no boundary, no check-in photo, no break or overtime maths on this screen, and no money. What it does is record when somebody started and when they stopped.",
      },
      {
        label: "One clock at a time",
        body:
          "Clocking in while already in is refused, and so is clocking out when nothing is running. Both say which it is.",
      },
      {
        label: "The clock belongs to whoever is signed in",
        body:
          "There is no way to name somebody else, so nobody can be clocked in from the passenger seat.",
      },
      {
        label: "No job is asked for here",
        body:
          "A punch from this screen is a record of the day rather than a line in one job's cost.",
      },
      {
        label: "Entries start as pending",
        body:
          "Nothing counts until it is approved. Approved hours are what payroll and job costing read.",
      },
      {
        label: "Somebody not yet on the roster",
        body:
          "Gets a card explaining it and the exact place an admin fixes it, rather than a button that does nothing.",
      },
    ],
    headline: "Clock on from whatever phone they have, and nothing else",
    oneLine:
      "One button that starts and stops the clock, hours rounded the same way the office rounds them, and no tracking of where anybody is.",
    description:
      "A clock-in and clock-out screen for crew in a phone browser: one button, a live timer, hours in the rounding payroll reads, and no location tracking of any kind.",
    pains: [
      {
        pain:
          "Hours arrive on a scrap of paper on Friday and half of them are somebody's best recollection.",
        fix:
          "The clock is either running or it is not, and today's total is on the screen while it runs.",
      },
      {
        pain:
          "You do not want to tell your crew you are tracking where they are.",
        fix:
          "Nothing here records a location. There is no map, no boundary and no check-in photo.",
      },
      {
        pain:
          "Somebody clocks their mate on from the van.",
        fix:
          "The clock only ever belongs to whoever is signed in. There is no field for another person's name.",
      },
    ],
    how: [
      {
        step: "One button, and a timer that agrees with it",
        body:
          "In and out are the same button. Today's total blends the hours already booked with the time still running, so the figure matches the timer above it instead of jumping when you stop.",
      },
      {
        step: "Rounded once, the same way everywhere",
        body:
          "Hours are rounded when the clock stops, in exactly the rounding a hand-entered timesheet uses, so payroll reads one number whichever way the entry was made.",
      },
      {
        step: "It says what is wrong instead of doing nothing",
        body:
          "Somebody who is not set up as a worker is told so, and told where an admin fixes it. Clocking in twice, or out when you were never in, is refused with the reason.",
      },
    ],
    features: ["time_clock"],
    related: ["crew", "payroll", "job-costing"],
  },
  {
    slug: "crew-inbox",
    group: "doing_the_job",
    label: "Crew inbox",
    feature: "crew_inbox",
    details: [
      {
        label: "The company is decided by the number they texted",
        body:
          "Never by the sender. A sub who works for two companies has one phone, and a sender's number can be forged; the number they texted cannot.",
      },
      {
        label: "Ten pictures a message",
        body:
          "A message claiming a hundred attachments still yields ten. The limit is ours, not the sender's.",
      },
      {
        label: "Notes are added, never overwritten",
        body:
          "A note texted in is appended to what the visit already says.",
      },
      {
        label: "Silence is never the answer during setup",
        body:
          "An unknown number gets one sentence naming the screen where an admin adds them, for the first few messages — because silence and a broken feature look identical from a job site.",
      },
      {
        label: "The reply is what is withheld when credit runs out",
        body:
          "The message is still filed, because it has already been paid for. Only the courtesy reply is held back, and that is recorded rather than hidden.",
      },
      {
        label: "Location is not used today",
        body:
          "A job visit carries no map point, and the client's billing address is deliberately not substituted for one. What the message says is what decides.",
      },
    ],
    headline: "One number your crew texts, and the photos file themselves",
    oneLine:
      "Your crew send photos and updates to one number from the phone they already own, and they land on the right job — or you get asked which one.",
    description:
      "One texting number for your crew: photos and notes filed against the right job by what the message says, with a question asked rather than a guess made.",
    pains: [
      {
        pain:
          "Photos arrive in a group chat and nobody ever moves them anywhere.",
        fix:
          "They land on the job, in the visit, with whatever was typed alongside them.",
      },
      {
        pain:
          "You would have to buy everybody a phone to get them using anything you have to install.",
        fix:
          "There is nothing to install. It is a text message from the phone they already carry.",
      },
      {
        pain:
          "Software guesses which job a photo belongs to and is wrong twice a week.",
        fix:
          "When it is not sure it asks, with the day's jobs as buttons, and files the photo it was holding rather than the reply.",
      },
    ],
    how: [
      {
        step: "It reads the message before it guesses",
        body:
          "A client's name, a job's title, even the street number in the text is enough to file it. Two matches is a narrower question, not an answer, so it asks.",
      },
      {
        step: "One job today means one answer",
        body:
          "If the person texting has exactly one visit that day, that is where it goes. The day is worked out in your company's own timezone, using the next midnight rather than a flat twenty-four hours, so the clocks changing does not drag in yesterday.",
      },
      {
        step: "The question has a shelf life",
        body:
          "An unanswered which-job can be answered by text for twelve hours. Before and after that, anybody in the office can file the held photo from the inbox.",
      },
    ],
    features: ["crew_inbox"],
    related: ["crew", "job-photos", "jobs"],
  },
  // ── Getting paid ─────────────────────────────────────────────────────────
  {
    slug: "invoicing",
    group: "getting_paid",
    label: "Invoicing",
    feature: "invoices",
    details: [
      {
        label: "The invoice number mirrors the quote",
        body:
          "Quote Q-2026-0008 becomes invoice INV-2026-0008, so a client holding both can see they are the same job.",
      },
      {
        label: "Which means the sequence has gaps",
        body:
          "Quotes nobody accepted take their number with them. That is right where a unique reference is what is required and wrong where an unbroken sequence is, and it is written down rather than left to be discovered.",
      },
      {
        label: "Approving twice does not invoice twice",
        body:
          "Raising an invoice from a quote is keyed on the quote, so an automatic conversion and somebody pressing the button both end at one invoice.",
      },
      {
        label: "Built from what they actually agreed",
        body:
          "Scope groups are flattened with their heading in front of each line, and the totals prefer the figures accepted on the page the client clicked.",
      },
      {
        label: "Extras they declined never reach the bill",
        body:
          "An optional extra the client did not tick is simply not on the invoice. There is no line for it at zero and no note explaining what they turned down.",
      },
      {
        label: "The balance starts at the total",
        body:
          "Which sounds obvious and was not: left to its own default it started at zero, which made every new invoice read as already paid.",
      },
    ],
    headline: "The invoice looks like the quote, because it was built from it",
    oneLine:
      "Turn an approved quote into an invoice, send it with a pay link, and keep the earlier version when it has to change.",
    description:
      "Invoicing that mirrors your quote: same lines, same layout, sent from your address with a pay-now link, and the right sales tax for the address.",
    pains: [
      {
        pain:
          "The invoice is typed again from the quote, and the one line that gets missed is always the expensive one.",
        fix:
          "It is created from the approved quote, so the lines, the totals and the tax are already right.",
      },
      {
        pain:
          "The client says the invoice does not match what they signed, and neither of you can prove anything.",
        fix:
          "Amend an issued invoice and the earlier one is kept, so there is a record of what changed and when.",
      },
      {
        pain:
          "You work in two provinces and the tax on the invoice is whatever you remembered that morning.",
        fix:
          "Set your rates once and the right one lands on the document for the address the work is at.",
      },
    ],
    how: [
      {
        step: "Built from the quote, not beside it",
        body:
          "An invoice is generated from the approved quote and uses the same sections and the same layout, so the homeowner recognises the document they signed.",
      },
      {
        step: "Sent as you, with a way to pay in it",
        body:
          "It goes out from your address with the PDF attached and a pay-now link inside, in the language the document was written in.",
      },
      {
        step: "Numbered so your accountant is not angry",
        body:
          "Invoice numbers run in a sequence, and an amended invoice keeps its history rather than quietly overwriting itself.",
      },
    ],
    features: ["invoices", "invoice_send", "invoice_changes", "sales_tax"],
    related: ["payments", "quotes", "branding"],
  },
  {
    slug: "payments",
    group: "getting_paid",
    label: "Getting paid",
    feature: "card_payments",
    details: [
      {
        label: "The money goes to your account",
        body:
          "The charge is routed to your own connected account, and FieldQuo takes no cut of what your client pays.",
      },
      {
        label: "Cash you already took comes off the card amount",
        body:
          "The client is charged the balance, not the total, so a deposit taken in cash or by transfer and written down by hand is not charged a second time.",
      },
      {
        label: "A paid invoice refuses rather than errors",
        body:
          "Asking for a payment link on a zero balance is refused in plain words, instead of being handed to the card processor to fail in front of somebody.",
      },
      {
        label: "A draft cannot be paid",
        body:
          "The client's link checks in the same read that the invoice is theirs and that it was actually issued, so a guessed number does not open a payment page.",
      },
      {
        label: "Currency follows your company",
        body:
          "The checkout opens in your own company’s currency, taken from the country you signed up with, rather than in a default somebody else chose.",
      },
    ],
    headline: "They pay from the driveway, and it lands in your account",
    oneLine:
      "Card payment from the invoice or the client portal, settling into your own bank — not ours.",
    description:
      "Card payments that settle into the contractor's own bank account, a client portal showing what is owed, and recurring maintenance plans.",
    pains: [
      {
        pain:
          "The cheque is in the post, and it has been in the post for five weeks.",
        fix:
          "The invoice carries a pay link. They pay from their phone before you have finished loading the van.",
      },
      {
        pain:
          "Chasing money means ringing people you like and asking them for money.",
        fix:
          "The client can open one link and see every quote, every invoice and exactly what is still outstanding.",
      },
      {
        pain:
          "Maintenance clients are invoiced when you remember, which is not monthly.",
        fix:
          "A recurring plan charges the card on schedule without you asking anybody for anything.",
      },
    ],
    how: [
      {
        step: "The money goes to your account",
        body:
          "You connect your own bank once. Client payments settle into your account directly, with FieldQuo taking no cut of them.",
      },
      {
        step: "Deposits are handled properly",
        body:
          "A client who has already paid a deposit is asked for the balance, not for the whole amount a second time.",
      },
      {
        step: "One link for everything they owe",
        body:
          "The portal is a single link per client — no account for them to create, no password for them to forget.",
      },
    ],
    features: [
      "card_payments",
      "stripe_connect",
      "client_portal",
      "service_plans",
    ],
    related: ["invoicing", "financing", "reporting"],
  },
  {
    slug: "financing",
    group: "getting_paid",
    label: "Client financing",
    feature: "financing",
    details: [
      {
        label: "Between fifty dollars and thirty thousand",
        body:
          "Pay-over-time is offered at checkout only inside those bounds, only in US or Canadian dollars, and only when you have switched it on.",
      },
      {
        label: "Card only, unless you said otherwise",
        body:
          "The payment choices are pinned to card by default, so an account that switched a lender on in its own dashboard cannot surface it when you said no.",
      },
      {
        label: "It falls back rather than breaking",
        body:
          "Whether the lender is live on your account cannot be checked from here, so it is attempted and quietly retried as card-only when it is not — never a link that fails in front of a client.",
      },
      {
        label: "No terms means no monthly figure",
        body:
          "There is no assumed rate and no typical term. Unless you enter your own rate and your own term, no monthly figure appears anywhere on a quote.",
      },
      {
        label: "A payment that rounds below half a cent is nothing",
        body:
          "Nothing is shown at all, rather than a confident zero — a monthly payment of nothing is a promise no lender would keep.",
      },
    ],
    headline: "Let the homeowner spread the cost of the big job",
    oneLine:
      "Your clients can pay monthly through Affirm. You are paid in full, up front, on the jobs they would otherwise put off another year.",
    description:
      "Offer your clients pay-over-time through Affirm and get paid in full up front — included, with nothing extra to sign up for.",
    pains: [
      {
        pain:
          "The full kitchen is the job you want, and the homeowner keeps deferring it to next year.",
        fix:
          "They are offered a monthly option at the moment they are paying, instead of being asked for the lot in one go.",
      },
      {
        pain:
          "Every finance company wants its own application, its own contract and its own portal.",
        fix:
          "It rides on the Stripe account you already connected. One switch in Settings, and it is on your pay page.",
      },
      {
        pain:
          "You quote a monthly figure on the phone and get held to a rate nobody at your company ever agreed.",
        fix:
          "FieldQuo never invents a monthly figure. If a number appears on your quote, it was computed from the rate and term you typed in yourself.",
      },
    ],
    how: [
      {
        step: "Affirm at checkout, through your own account",
        body:
          "Switch financing on and your pay page offers Affirm beside card. It runs on the Stripe account your money already lands in, so there is no second application, no new contract, and no separate finance provider to onboard with.",
      },
      {
        step: "You get the whole job, today",
        body:
          "Affirm pays you the full amount and carries the instalments themselves — you are not waiting on your client and you are not financing them out of your own float. It covers jobs from $50 up to $30,000, in Canadian or US dollars.",
      },
      {
        step: "No rates for you to quote, and no risk you carry",
        body:
          "Affirm shows the client their own terms and makes their own decision. You never quote a rate, never chase an instalment, and never carry the credit risk. And FieldQuo will not print a monthly figure on your quote unless you typed the rate and term in yourself.",
      },
    ],
    features: ["financing"],
    related: ["payments", "quotes", "invoicing"],
  },

  {
    slug: "invoice-changes",
    group: "getting_paid",
    label: "Changed invoices, tracked",
    feature: "invoice_changes",
    details: [
      {
        label: "The reason is recorded",
        body:
          "A change carries the reason you give it, who made it and when. With no reason given it is recorded as an update rather than left blank.",
      },
      {
        label: "Only a draft can be deleted",
        body:
          "Deleting anything issued is refused. There is no state in which a sent invoice disappears.",
      },
      {
        label: "Attaching a job does not make a version",
        body:
          "Linking a job writes the link in place, deliberately — versioning it would mint a second copy of the invoice every time somebody tidied one up.",
      },
      {
        label: "A job belonging to another client is refused",
        body:
          "Linking one would put somebody else's hours into this job's margin.",
      },
      {
        label: "Banners are worked out, not stored",
        body:
          "Overdue, part paid and amended are derived when the invoice is read, so a stored flag can never disagree with the money.",
      },
    ],
    headline: "Amend an issued invoice without losing the one they already have",
    oneLine:
      "An invoice that has left the building is never edited in place: the change makes a new version under the same number, and the earlier one stays exactly as it was.",
    description:
      "Amending an issued invoice creates a new version under the same invoice number, keeping the earlier one and the reason for the change, so what was agreed is never in doubt.",
    pains: [
      {
        pain:
          "You correct an invoice and now the client is reading a different document to the one you are.",
        fix:
          "The earlier version is kept. Both of you can see what changed, when, and why.",
      },
      {
        pain:
          "Somebody asks what the original said and the honest answer is a shrug.",
        fix:
          "Every version carries a reason, a name and a time.",
      },
      {
        pain:
          "Editing an invoice quietly renumbers it and now your accountant has two.",
        fix:
          "The number does not move. Version two of an invoice is still that invoice.",
      },
    ],
    how: [
      {
        step: "Drafts are edited, issued invoices are versioned",
        body:
          "While it is a draft you change it in place. The moment it stops being one, a change writes a new version instead of overwriting what somebody is holding.",
      },
      {
        step: "The number stays put",
        body:
          "A new version carries the same invoice number and a version count beside it, so whichever copy somebody has, it is the same bill.",
      },
      {
        step: "Nothing is dropped in the copy",
        body:
          "Whether tax applies, the language it was written in, the photos on it and the costing behind it are all carried forward on purpose — dropping any one of them would silently change the document.",
      },
    ],
    features: ["invoice_changes"],
    related: ["invoicing", "payments", "client-portal"],
  },
  {
    slug: "client-portal",
    group: "getting_paid",
    label: "Client portal",
    feature: "client_portal",
    details: [
      {
        label: "Nothing about your payment setup crosses to the browser",
        body:
          "The page is told whether a card can be taken and nothing else. Your payment account details never reach it.",
      },
      {
        label: "Rounding dust does not create a debt",
        body:
          "A balance only counts as owed above half a cent, so a rounding remainder never shows a client a Pay button for nothing.",
      },
      {
        label: "The tax sentence is fixed to the document's date",
        body:
          "An invoice explains its tax as at the day it was raised, so a rate change last month cannot re-explain an older bill.",
      },
      {
        label: "Your tax settings stay yours",
        body:
          "The page carries the kind of tax charged and the region assumed. Your rate, your registration and your local-tax preference are not sent.",
      },
      {
        label: "The rule about what they may see lives in one place",
        body:
          "It is decided on our side, once. A second copy of that rule in the browser is the copy that would rot.",
      },
    ],
    headline: "One link where they can see everything you have sent them",
    oneLine:
      "Quotes, invoices and what is still owed, on one page in your colours, without the client ever making an account or remembering a password.",
    description:
      "A private link where a client sees their quotes, invoices and outstanding balance in your branding, with no account to create and nothing offered to search engines.",
    pains: [
      {
        pain:
          "Can you resend the invoice is half of your inbox.",
        fix:
          "They have a link, and it is always the current picture rather than the version you last attached.",
      },
      {
        pain:
          "Making a homeowner create a password to look at their own bill is how you lose the payment.",
        fix:
          "There is no account and no password. It is a link that works for them and nobody else.",
      },
      {
        pain:
          "A payment button that fails under your logo is worse than no button.",
        fix:
          "The Pay button appears only when a card can actually be taken. Otherwise the page tells them how to pay you instead.",
      },
    ],
    how: [
      {
        step: "A link, not an account",
        body:
          "The address is long and random, and the page asks search engines to leave it alone. Nothing about it can be guessed from a client's name.",
      },
      {
        step: "Only what you actually sent",
        body:
          "Draft quotes and unissued invoices are not on it, and an invoice counts as sent when the email was accepted for delivery rather than when a button was pressed.",
      },
      {
        step: "Their language, your currency",
        body:
          "The page settles on the client's own language, then your company default, then English — and money is shown in your currency rather than a default one.",
      },
    ],
    features: ["client_portal"],
    related: ["invoicing", "payments", "branding"],
  },
  {
    slug: "sales-tax",
    group: "getting_paid",
    label: "Sales tax by address",
    feature: "sales_tax",
    details: [
      {
        label: "Two letters, or nothing",
        body:
          "A country is a two-letter code. The word Canada typed into a box is rejected rather than half understood, because the field is filled from an address lookup or a picker.",
      },
      {
        label: "Not registered is a statement; unknown is not",
        body:
          "A company that has said it is not registered charges zero as a stated position. A company that has never said charges its default and is marked unknown, because a zero rate is not a statement.",
      },
      {
        label: "The provincial part is not silently dropped",
        body:
          "Where the provincial share may not apply to work on real property, the caution is shown rather than the rate quietly reduced. That is a fact about the job, not about the address.",
      },
      {
        label: "Reduced construction rates are never inferred",
        body:
          "Where a country has a lower rate for renovation work, it applies only when the work is declared as renovation.",
      },
      {
        label: "An assumption is labelled as one",
        body:
          "When the client's record cannot answer and your own province is used instead, the document says the region was assumed — and only when the assumption actually decided the number.",
      },
      {
        label: "Tax on, nothing charged, no explanation",
        body:
          "Refused at the moment of sending, with the missing fields listed. There is no confirm-anyway.",
      },
    ],
    headline: "The right tax for where the work is, or an honest refusal",
    oneLine:
      "Set your rates once and the correct one lands on the document for the address the job is at — and where nobody can be certain, it says so rather than inventing a number.",
    description:
      "Sales tax resolved from the job's address: your own named rates first, then the reference tables for Canada, the US and VAT countries, with a stated caution wherever the answer is incomplete.",
    pains: [
      {
        pain:
          "You work two provinces and the rate on the quote is whichever one you last typed.",
        fix:
          "The rate follows the address the work is at, not the last document you happened to write.",
      },
      {
        pain:
          "Tax software quietly assumes a rate and you find out at year end.",
        fix:
          "Where the answer is not certain it is labelled, in words, on the document — not in a footnote nobody reads.",
      },
      {
        pain:
          "A quote goes out with tax switched on and nothing charged, and nobody notices for a month.",
        fix:
          "That combination is refused at the point of sending, with the missing fields named.",
      },
    ],
    how: [
      {
        step: "Your own rates win",
        body:
          "If you have named a rate that matches the client's province, that is the one used. The reference tables are the fallback, not the boss — and matching is done on whole words, so a rate named for one province does not attach itself to a city that happens to contain the letters.",
      },
      {
        step: "Then the tables, in a fixed order",
        body:
          "For a VAT country your own country decides, because that is how supply to a homeowner works. Otherwise the client's country decides: Canada resolves to a real combined rate, while a US state's base rate is shown for information and your own default is what is applied — because district taxes are not in it, and saying so is the honest answer.",
      },
      {
        step: "A date, not only a place",
        body:
          "Rates are stored with the dates they applied from, so a document raised last year is never re-priced with this year's rate.",
      },
    ],
    features: ["sales_tax"],
    related: ["invoicing", "quotes", "price-book"],
  },
  // ── Running the business ─────────────────────────────────────────────────
  {
    slug: "reporting",
    group: "running_the_business",
    label: "Your numbers",
    headline: "Know where the year is, without building a spreadsheet",
    oneLine:
      "Quoted, won, scheduled and owed on one screen, plus your break-even figure, your goal, and how your prices sit against your trade.",
    description:
      "Reporting for contractors: a dashboard of quoted, won, scheduled and owed, a break-even price from real overhead, and an anonymous pricing benchmark.",
    pains: [
      {
        pain:
          "You find out the quarter was bad when the accountant tells you in March.",
        fix:
          "Quoted, won, scheduled and owed sit on one screen, as of this morning.",
      },
      {
        pain:
          "You have no idea whether your prices are normal or whether you are the cheapest in the city by a third.",
        fix:
          "Your rates and your win rate are set against other shops in your trade, with nobody named — including you.",
      },
      {
        pain:
          "Charts do not tell you anything you can act on before the coffee is finished.",
        fix:
          "Once a month, the numbers come back written in sentences, saying what moved and what it means.",
      },
    ],
    how: [
      {
        step: "It is your own data, and only yours",
        body:
          "The comparison is aggregated. No other company's figures are ever shown to you, and yours are never shown to them.",
      },
      {
        step: "Overhead is a real number, not a percentage",
        body:
          "Fixed costs, debt and business expenses produce the figure a day has to bring in before you make anything.",
      },
      {
        step: "Marketing spend sits beside what it produced",
        body:
          "Spend by channel against the jobs it brought in, so a channel that produces nothing is visible instead of assumed to be working.",
      },
    ],
    features: [
      "dashboard",
      "break_even",
      "benchmark",
      "monthly_digest",
      "goals",
      "marketing_spend",
      "expenses",
    ],
    related: ["job-costing", "marketing", "fieldquo-ai"],
  },
  {
    slug: "payroll",
    group: "running_the_business",
    label: "Payroll and payouts",
    feature: "payroll",
    details: [
      {
        label: "Gross pay, and the labels for the rest",
        body:
          "There are no tax tables in here. The deduction names follow your country — income tax, CPP and EI, or federal tax, Social Security and Medicare — and every amount is one you or your accountant supplied.",
      },
      {
        label: "Brackets are something you supply",
        body:
          "Progressive tax is worked out by annualising the period's gross, walking your accountant's bands and dividing back down. The bands are yours.",
      },
      {
        label: "Overtime at time and a half",
        body:
          "Over forty hours a week by default, and the threshold scales with the period — eighty regular hours in a fortnight, not forty.",
      },
      {
        label: "A payslip can never be negative",
        body:
          "Net is floored at zero and the line is flagged, and a run with any flagged line on it is refused until somebody has looked.",
      },
      {
        label: "Paying the same fortnight twice is caught",
        body:
          "An overlapping run, and a period that does not match your pay cycle, are both reported before you approve and refused at approval — while a correction run is still deliberately allowed.",
      },
      {
        label: "An empty cell is not a zero",
        body:
          "A worker with no value for a deduction column gets a blank, because we did not deduct this and we deducted nothing are different sentences.",
      },
    ],
    headline: "Approved hours become a pay run",
    oneLine:
      "Timesheets you have approved turn into gross pay, payslips and an export — and a roster contractor can be paid to their bank.",
    description:
      "Payroll from approved timesheets: gross pay, payslips and an export for your accountant, plus bank transfers to roster contractors — limits stated.",
    pains: [
      {
        pain:
          "Payroll starts with reading five people's handwriting and ends at midnight.",
        fix:
          "The hours are already in, already tied to jobs, and already approved by you.",
      },
      {
        pain:
          "The hours on the payslip and the hours on the job costing are two different numbers from two different systems.",
        fix:
          "They are the same hours. The pay run is built from the timesheets the job costing used.",
      },
      {
        pain:
          "Paying a roster contractor is a separate transfer you make by hand and forget to record.",
        fix:
          "Their approved hours go out as a real transfer to their bank, recorded against the run.",
      },
    ],
    how: [
      {
        step: "Nothing is paid that you have not approved",
        body:
          "Hours have to be approved before they can enter a pay run. Approval is the gate, and it is the only gate.",
      },
      {
        step: "Payslips come out of the run",
        body:
          "The run produces payslips you can hand over, and an export your accountant can work from.",
      },
      {
        step: "Read what this does not do",
        body:
          "FieldQuo is not a payroll bureau and does not pretend to be one. Exactly where it stops — taxes, filings, currencies — is written below.",
      },
    ],
    features: ["payroll", "contractor_payouts", "timesheets", "time_off"],
    related: ["crew", "job-costing", "team"],
  },
  {
    slug: "price-book",
    group: "running_the_business",
    label: "Your price book",
    feature: "price_book",
    details: [
      {
        label: "Prices hidden means refused, not blanked",
        body:
          "Somebody without the right to see prices is told no, rather than handed a catalogue of names with no numbers. A screen of blanks reads as broken.",
      },
      {
        label: "Categories redact instead",
        body:
          "A service category keeps its unit when prices are hidden, because per square foot is how the work is counted, not what it costs.",
      },
      {
        label: "Names translate on the way in",
        body:
          "A new service is translated into the languages you send documents in as it is created, and a translation failure never blocks the save.",
      },
      {
        label: "The import is simple, and says so",
        body:
          "Comma-separated columns, no quoted fields. Rows with no name are dropped and the count of what came in is what you are told.",
      },
      {
        label: "Overrides are sparse and whitelisted",
        body:
          "Only the fields a trade actually declares can be overridden, so everything you did not change keeps inheriting improvements to the defaults.",
      },
      {
        label: "One setting that was offered and did nothing",
        body:
          "A pricing-model choice — flat, per unit or hourly — changed no price at all. It is no longer offered, rather than left on a screen looking meaningful.",
      },
    ],
    headline: "Your prices in one place, so every quote uses the same ones",
    oneLine:
      "Services, rates, material costs and how much of each a job eats — imported from a spreadsheet and exportable back out.",
    description:
      "A price book for contractors: services and rates, material costs and recipes, spreadsheet import and export, and tax that follows the address.",
    pains: [
      {
        pain:
          "Every estimator prices the same work differently, and you find out when two neighbours compare quotes.",
        fix:
          "There is one set of rates, and every quote is built from it.",
      },
      {
        pain:
          "Material costs went up in the spring and your prices did not.",
        fix:
          "Change the cost once and the jobs priced from it follow.",
      },
      {
        pain:
          "Your prices are in a spreadsheet you do not want to retype and are not sure you want to give away.",
        fix:
          "Import it, and export it back out whenever you want. It stays yours.",
      },
    ],
    how: [
      {
        step: "Rates by service, grouped how you think",
        body:
          "Services sit in your own categories, so the price book reads the way you talk about the work rather than the way a database does.",
      },
      {
        step: "Recipes, not just unit prices",
        body:
          "What a litre of paint or a sheet of ply costs you, and how much of it a job of a given size consumes, so the materials figure is derived rather than guessed.",
      },
      {
        step: "Tax follows the work",
        body:
          "Set your rates once and the right one lands on the document for the address the job is at.",
      },
    ],
    features: ["price_book", "material_costs", "sales_tax"],
    related: ["quotes", "job-costing", "kitchen-designer"],
  },
  {
    slug: "branding",
    group: "running_the_business",
    label: "Your name on everything",
    feature: "white_label",
    details: [
      {
        label: "One colour, measured everywhere",
        body:
          "Every surface on every document derives from your one brand colour, and the contrast is computed to the 4.5:1 standard rather than eyeballed.",
      },
      {
        label: "Why the obvious rule was rejected",
        body:
          "Is it dark, use white fails on mid-tones: a mid-orange gets white text at around 3:1 and is unreadable in a driveway. Both candidates are measured and the better one wins.",
      },
      {
        label: "When the text cannot move, the fill does",
        body:
          "On a solid band the background is stepped away from the text until it passes, rather than leaving the text where nobody can read it.",
      },
      {
        label: "Grey is honest about its limit",
        body:
          "A mid-grey brand tops out at about 4.4:1 against white, which is under the target. The maths returns the best it managed and reports that it fell short, instead of pretending.",
      },
      {
        label: "The same colour twice, on purpose",
        body:
          "Your brand colour used as a fill and the same colour used as text are two different values, because they are measured against different backgrounds.",
      },
      {
        label: "Green and red are never derived",
        body:
          "Approved, overdue and warning keep fixed colours. Deriving green from a brand colour would make an approved quote look declined for a company whose brand is red.",
      },
    ],
    headline: "A homeowner should not be able to tell what you use",
    oneLine:
      "Your logo, your colour, your address in the From line, and your terms on every document a client sees.",
    description:
      "White-label by default: your logo and brand colour on every quote, invoice, page and email, sent from your own verified domain.",
    pains: [
      {
        pain:
          "You are quoting against two other painters and all three documents are obviously the same software.",
        fix:
          "Your quote carries your logo and your colour. There is no badge, no watermark and no vendor name on it.",
      },
      {
        pain:
          "The quote goes out from an address the client has never heard of and lands in junk.",
        fix:
          "Verify your domain once and everything goes out from you.",
      },
      {
        pain:
          "Your payment terms are in a paragraph you paste in by hand, when you remember.",
        fix:
          "Terms and contract wording attach themselves to what you send.",
      },
    ],
    how: [
      {
        step: "One colour, measured everywhere",
        body:
          "You pick a brand colour and every surface derives from it. Contrast is computed rather than assumed, so a yellow or a mid-grey brand does not produce a document nobody can read.",
      },
      {
        step: "Your wording, section by section",
        body:
          "Change what the covering email says, and it stays in the language the document was written in — a signed document keeps the words it was signed with.",
      },
      {
        step: "Your layout on the printed page",
        body:
          "Choose which sections appear on the document and which layout is the default one.",
      },
    ],
    features: [
      "white_label",
      "own_email_domain",
      "quote_email_wording",
      "document_layouts",
      "contract_terms",
      "quote_pdf",
    ],
    related: ["quotes", "invoicing", "languages"],
  },
  {
    slug: "languages",
    group: "running_the_business",
    label: "Six languages",
    headline: "Send the quote in the language they actually speak",
    oneLine:
      "FieldQuo is built around six languages, and a document keeps the language it was created in.",
    description:
      "Six languages: quote and invoice copy in English, French, Spanish, Ukrainian, Punjabi and Tagalog, with each document fixed in the language it was written in.",
    showLanguages: true,
    pains: [
      {
        pain:
          "The client's English is fine for a chat and not fine for a page of scope and payment terms.",
        fix:
          "The quote and the covering email go out in their language, so the part that matters is the part they can read.",
      },
      {
        pain:
          "Someone sends a translated version afterwards and now there are two documents that do not say the same thing.",
        fix:
          "A document keeps the language it was created in. Nothing is machine-translated at send time, so a signed PDF still says what it said.",
      },
      {
        pain:
          "Half your crew and half your clients do not share a first language, and the software assumes everybody does.",
        fix:
          "The languages were chosen for the trades — the ones that turn up on a job site here, not the ones with the biggest national totals.",
      },
    ],
    how: [
      {
        step: "The document decides",
        body:
          "The covering email matches the language of the document it carries. Anything not tied to a document follows the client's own language.",
      },
      {
        step: "Chosen for the trade, not from a list",
        body:
          "English and French because of where we are; Spanish for the size of it; Punjabi, Tagalog and Ukrainian because of who is actually on the sites we serve.",
      },
      {
        step: "Honest about which are finished",
        body:
          "Two of the six are finished and human-checked. The rest are translated and still being read by a speaker before they are presented as complete — the state of each is written below.",
      },
    ],
    features: ["languages"],
    related: ["branding", "quotes", "invoicing"],
  },
  {
    slug: "fieldquo-ai",
    group: "running_the_business",
    label: "FieldQuo AI",
    feature: "ai_copilot",
    details: [
      {
        label: "Nine things it can look up, and none of them change anything",
        body:
          "Conversion rate, top clients, cash flow, profit by category, repeat-customer rate, upcoming work, and finding a quote, an invoice or a job. There is nothing that creates, edits or sends.",
      },
      {
        label: "It is only told about what you may see",
        body:
          "The list is built per person. Somebody who may not see money is never told the money questions exist — rather than being told it found the invoice but is not allowed to show you the total.",
      },
      {
        label: "Anything with no rule is withheld",
        body:
          "If nobody has said who may use something, nobody may. It fails closed and records that it did.",
      },
      {
        label: "It cannot be talked into another company's data",
        body:
          "Which company it is answering about is fixed before the model runs and is never read from anything the model produces.",
      },
      {
        label: "It declines the rest in one sentence",
        body:
          "Coding, recipes, essays, homework, general knowledge — declined, with what it can help with instead. And where there is no way for it to look something up it says so, rather than working it out from something adjacent.",
      },
      {
        label: "The allowance is checked before the question is asked",
        body:
          "And the screen warns you at eighty per cent, rather than at the wall.",
      },
    ],
    headline: "Ask your own business a question and get an answer",
    oneLine:
      "Plain-English questions answered from your own numbers — plus the quote review, the monthly write-up and the tasks a job suggests.",
    description:
      "An AI assistant that answers questions about your own business from your own data, reviews quotes before you send them, and writes your month up.",
    pains: [
      {
        pain:
          "The answer is in the data and getting it out means building a report you will build once.",
        fix:
          "Ask the question in the words you would use out loud, and the answer comes back from your own records.",
      },
      {
        pain:
          "You do not trust an assistant that might be reading somebody else's numbers, or making yours available to them.",
        fix:
          "It only ever sees your company's data. Comparisons against your history use your history.",
      },
      {
        pain:
          "General-purpose assistants happily answer questions they know nothing about.",
        fix:
          "This one declines. It answers about your business and turns down everything else rather than inventing an answer.",
      },
    ],
    how: [
      {
        step: "It reads your records to answer",
        body:
          "Questions about quotes, jobs, invoices and money are answered from your own rows, so the number it gives you is a number you could go and find yourself.",
      },
      {
        step: "It shows up where the work is",
        body:
          "The same model reviews a quote before you send it, proposes the tasks a job of that kind needs, and writes your month up in sentences.",
      },
      {
        step: "Usage is metered, and visible",
        body:
          "Every AI request is counted against your account, so the cost of it is a number you can see rather than a surprise.",
      },
    ],
    features: [
      "ai_copilot",
      "ai_quote_review",
      "monthly_digest",
      "suggested_tasks",
      "call_to_quote",
    ],
    related: ["ai-quote-review", "reporting", "ai-receptionist"],
  },
  {
    slug: "team",
    group: "running_the_business",
    label: "Team and access",
    feature: "team_access",
    details: [
      {
        label: "Thirteen dials",
        body:
          "Ten ladders — schedule, time, payroll, notes, expenses, clients, requests, quotes, jobs and invoices — and three switches for prices, job costing and taking payment. Thirty-eight settings between them.",
      },
      {
        label: "Two of them are not settings",
        body:
          "Client communications and reports are shown as consequences of the others rather than as dials of their own, because a dial that decides nothing is a control that does not work.",
      },
      {
        label: "Position on the ladder, not a name match",
        body:
          "A level is compared by where it sits, so view and edit satisfies view without anybody listing the combinations.",
      },
      {
        label: "You cannot grant what you do not hold",
        body:
          "What one person may give another is capped at their own level, on the server. The editor hides what they cannot offer so nothing fails on click, and the server clamps it again anyway.",
      },
      {
        label: "The refusal direction is no",
        body:
          "A member who cannot be loaded fails every check. A stored level that is not on the ladder fails. Somebody scoped to their own records with no identity matches nothing rather than everything.",
      },
      {
        label: "Role changes go through a different door",
        body:
          "Sending a role or a set of permissions to the ordinary member update is refused with the reason, rather than accepted and ignored.",
      },
    ],
    headline: "Give people what they need and nothing else",
    oneLine:
      "Decide dial by dial what each person can see and change, and keep a record of who changed what.",
    description:
      "Team access for contractors: per-person permissions enforced on the server, and an activity record of every send, edit and approval.",
    pains: [
      {
        pain:
          "Giving the new estimator access means giving them your whole client list and every price you charge.",
        fix:
          "Access is set dial by dial. Nobody gets the client list because they needed the calendar.",
      },
      {
        pain:
          "A control was hidden from someone, and that turned out not to be the same as them not being able to reach it.",
        fix:
          "Permission is enforced on the server. Hiding a button is not access control here and never has been.",
      },
      {
        pain:
          "Something changed on a quote and nobody remembers doing it.",
        fix:
          "Every send, edit and approval is recorded with a name and a time against it.",
      },
    ],
    how: [
      {
        step: "Start from a preset, then adjust",
        body:
          "Presets get somebody working in a minute; the dials are there when a person's job does not fit one.",
      },
      {
        step: "The server is the one that refuses",
        body:
          "The same permission is checked again when the request arrives, so a hand-written request gets the same answer the screen gave.",
      },
      {
        step: "Time off goes to the right person",
        body:
          "Requests reach the manager who should see them, balances build up on their own, and the calendar knows about the days that are gone.",
      },
    ],
    features: ["team_access", "activity_log", "time_off"],
    related: ["crew", "payroll", "scheduling"],
  },
  {
    slug: "break-even",
    group: "running_the_business",
    label: "Your break-even price",
    feature: "break_even",
    image: {
      src: "/marketing/hero-analytics.webp",
      alt:
        "A dashboard showing cost per job, minimum price and how your average prices compare to other shops in your trade",
      altKey: "hero.tabs.analytics.alt",
      width: 1400,
      height: 1050,
      caption:
        "Cost per job and the minimum price it implies, built from your own overhead and your own accepted quotes.",
    },
    details: [
      {
        label: "A month is 4.33 weeks",
        body:
          "Weekly costs and weekly capacity are converted with the same figure, so the two sides of the division agree with each other.",
      },
      {
        label: "The margin is clamped",
        body:
          "Target margin defaults to twenty per cent and is capped below a hundred, because a hundred per cent margin divides by zero — and an empty box is treated as absent rather than as zero, which would quote everything at break-even.",
      },
      {
        label: "The hourly floor asks for billable hours",
        body:
          "Not hours worked. Driving, quoting and paperwork are deliberately excluded, and the per-person rate is the floor divided by the size of the crew.",
      },
      {
        label: "Depreciation is in one total and not the other",
        body:
          "Cash burn has none of it. The cost figure carries depreciation and loan interest and drops the raw monthly loan payment, so the same truck is not charged twice.",
      },
      {
        label: "An unknown frequency contributes nothing",
        body:
          "Rather than a wrong number. A salary with no hours behind it contributes nothing too, rather than being assumed to be full time.",
      },
      {
        label: "It needs your cost basis switched on",
        body:
          "Both figures need job costing and the right to see prices. Without them it refuses rather than showing zeroes, because a panel of zeroes reads as a business that costs nothing to run.",
      },
    ],
    headline: "What a day has to bring in before you make a cent",
    oneLine:
      "Your real overhead, divided by the work you can actually do, turned into the number a quote has to beat — and a refusal when nobody has told it enough to say.",
    description:
      "A price floor computed from your own overhead, salaries, debt and depreciation, divided by the capacity you stated: cost per job, a minimum price, and an hourly floor.",
    pains: [
      {
        pain:
          "You price off what the other lot charge and hope there is something left at the end.",
        fix:
          "The floor is your own numbers — your rent, your van, your salaries — rather than a rule of thumb.",
      },
      {
        pain:
          "You have a rough idea of overhead and no idea what it costs you just to turn up.",
        fix:
          "Cost per job is your monthly cost spread across the work you can actually do in a month.",
      },
      {
        pain:
          "A tool prints a minimum price without knowing how many jobs you do.",
        fix:
          "If you have not told it your capacity it refuses to print a figure, rather than defaulting to one and being confidently wrong.",
      },
    ],
    how: [
      {
        step: "Two totals, because they answer different questions",
        body:
          "One is cash out of the door each month: overhead, salaries and the full loan payments. The other is what the work actually costs you: overhead, salaries, and depreciation and interest on what you bought with a loan.",
      },
      {
        step: "The floor uses cost, not cash",
        body:
          "Cost per job is the second total divided by the jobs a month your stated capacity implies, and the minimum price is that grossed up for your target margin.",
      },
      {
        step: "Nothing is invented to fill a gap",
        body:
          "With no capacity stated there is no figure at all. A defaulted price floor is the worst kind of padding: it is a number you would act on.",
      },
    ],
    features: ["break_even"],
    related: ["reporting", "expenses", "price-book"],
  },
  {
    slug: "expenses",
    group: "running_the_business",
    label: "Expenses and overhead",
    feature: "expenses",
    details: [
      {
        label: "Weekly, monthly or yearly",
        body:
          "One-off is deliberately not offered for a fixed cost. It would be multiplied by nothing and change no figure — a row you can save that does nothing.",
      },
      {
        label: "More than zero, not merely filled in",
        body:
          "A zero fixed cost changes nothing and a negative one would lower your own price floor, so both are refused.",
      },
      {
        label: "Who entered it is recorded",
        body:
          "Stamped as the row is created, so a level that shows somebody only their own entries is something that can be enforced rather than a label on a screen.",
      },
      {
        label: "Fixed costs are read company-wide",
        body:
          "Unlike the expense list, so the breakdown agrees with the total printed beside it.",
      },
      {
        label: "A job-tagged expense cannot also be overhead",
        body:
          "Refused with the reason. They are answers to different questions, and counting it as both would double the money.",
      },
    ],
    headline: "What you spend, kept apart from what a job costs you",
    oneLine:
      "Record what goes out, tag what belongs to a job, and let the rest become the overhead that your break-even price is built on.",
    description:
      "Expense tracking for contractors: job costs kept apart from overhead, recurring fixed costs that feed the price floor, and loans amortised rather than stored as a stale balance.",
    pains: [
      {
        pain:
          "Rent, insurance and the phone bill live in a spreadsheet that only affects your mood.",
        fix:
          "Recurring costs are what the break-even figure is built from, so entering them changes a number you actually use.",
      },
      {
        pain:
          "A receipt is either a job cost or overhead, and half of them get filed as both.",
        fix:
          "An expense tagged to a job cannot also be overhead. It is refused rather than counted twice.",
      },
      {
        pain:
          "Everybody in the office can see every expense in the company.",
        fix:
          "There is a level that shows a person their own entries and nothing else.",
      },
    ],
    how: [
      {
        step: "One kind of row, not two",
        body:
          "A fixed cost is an ordinary expense marked as overhead and recurring — the same definition the break-even figure already reads. A separate list would let you enter rent twice and raise your own price floor by accident.",
      },
      {
        step: "The name becomes the heading",
        body:
          "A fixed cost called Shop rent gets its own bar in the breakdown, rather than disappearing into a bucket labelled other.",
      },
      {
        step: "Loans are worked out, not stored",
        body:
          "A balance written down is wrong the month after it is written, so what is kept is the principal, the rate and the start date, and the balance is worked out when it is needed.",
      },
    ],
    features: ["expenses"],
    related: ["reporting", "break-even", "job-costing"],
  },
];

/**
 * Matrix entries that deliberately do NOT get a marketing page.
 *
 * Empty today, and that is the honest state: all 76 claims are on a page. It is
 * a real list rather than a comment because the check script asserts
 * `covered ∪ excluded === MATRIX_KEYS`, and the day somebody decides a claim is
 * too small to sell, the decision has to be written here with a reason instead
 * of a key quietly disappearing off the site.
 *
 * @type {ReadonlyArray<{key: string, reason: string}>}
 */
export const PAGE_EXCLUSIONS = Object.freeze([]);

// ── Validation at module load ──────────────────────────────────────────────
//
// A page naming a feature the matrix does not carry is exactly the failure this
// whole arrangement exists to prevent, so it throws at import rather than
// rendering a gap. `next build` imports this file; a bad key stops the deploy.
{
  const known = new Set(MATRIX_KEYS);
  const seenSlugs = new Set();
  for (const page of PAGES) {
    if (seenSlugs.has(page.slug)) {
      throw new Error(`featurePages: duplicate slug "${page.slug}"`);
    }
    seenSlugs.add(page.slug);
    if (!page.features.length) {
      throw new Error(`featurePages: "${page.slug}" claims no features`);
    }
    for (const key of page.features) {
      if (!known.has(key)) {
        throw new Error(
          `featurePages: "${page.slug}" names "${key}", which is not in the feature matrix`,
        );
      }
    }
  }
  for (const page of PAGES) {
    for (const slug of page.related || []) {
      if (!seenSlugs.has(slug)) {
        throw new Error(`featurePages: "${page.slug}" links to missing page "${slug}"`);
      }
    }
  }
  for (const x of PAGE_EXCLUSIONS) {
    if (!known.has(x.key)) {
      throw new Error(`featurePages: excluded "${x.key}" is not in the feature matrix`);
    }
    if (!x.reason || !x.reason.trim()) {
      throw new Error(`featurePages: excluded "${x.key}" has no reason`);
    }
  }

  // ── The canonical-page contract ──────────────────────────────────────────
  //
  // Two failures worth taking the build down for. One: two pages both claiming
  // to be THE page for a feature, which is the duplicate-subject problem this
  // arrangement exists to prevent, arriving by accident instead of on purpose.
  // Two: a name on /pricing with no page behind it — the row a visitor clicks
  // and lands nowhere, which is the dead control one surface over.
  const claimed = new Map();
  for (const page of PAGES) {
    if (page.feature === undefined) continue;
    if (!known.has(page.feature)) {
      throw new Error(
        `featurePages: "${page.slug}" is canonical for "${page.feature}", which is not in the feature matrix`,
      );
    }
    if (!page.features.includes(page.feature)) {
      throw new Error(
        `featurePages: "${page.slug}" is canonical for "${page.feature}" but does not claim it`,
      );
    }
    if (claimed.has(page.feature)) {
      throw new Error(
        `featurePages: "${page.feature}" is claimed by both "${claimed.get(page.feature)}" and "${page.slug}"`,
      );
    }
    claimed.set(page.feature, page.slug);
    // A page that is the page for something owes the reader more than the
    // matrix's one sentence, or it is a bullet with a URL.
    if (!Array.isArray(page.details) || page.details.length < 3) {
      throw new Error(
        `featurePages: "${page.slug}" is canonical for "${page.feature}" and has fewer than three details`,
      );
    }
    for (const d of page.details) {
      if (!d?.label?.trim() || !d?.body?.trim()) {
        throw new Error(`featurePages: "${page.slug}" has a detail with no label or no body`);
      }
    }
  }
  for (const key of PRICING_FEATURES) {
    if (!known.has(key)) {
      throw new Error(`featurePages: /pricing names "${key}", which is not in the feature matrix`);
    }
    if (!claimed.has(key)) {
      throw new Error(`featurePages: /pricing names "${key}" and no page is the page for it`);
    }
  }
  for (const [key, slug] of claimed) {
    if (!PRICING_FEATURES.includes(key)) {
      throw new Error(
        `featurePages: "${slug}" claims to be the page for "${key}", which /pricing does not name`,
      );
    }
  }

  // Images: a src that is not a real file under public/ renders a broken
  // picture on a page selling reliability. The path shape is checked here; that
  // the file exists is asserted by scripts/check-feature-pages.mjs, which can
  // read the filesystem where a bundled module should not.
  for (const page of PAGES) {
    for (const img of [page.image, page.inlineImage]) {
      if (!img) continue;
      if (!img.src?.startsWith("/") || !/\.(webp|png|jpg|jpeg|svg)$/i.test(img.src)) {
        throw new Error(`featurePages: "${page.slug}" has an image src that is not a public path`);
      }
      if (!img.alt?.trim() || !img.altKey?.trim() || !img.caption?.trim()) {
        throw new Error(`featurePages: "${page.slug}" has an image with no alt, key or caption`);
      }
      if (!Number.isFinite(img.width) || !Number.isFinite(img.height)) {
        throw new Error(`featurePages: "${page.slug}" has an image with no intrinsic size`);
      }
    }
  }
}

export const FEATURE_PAGES = Object.freeze(PAGES.map((p) => Object.freeze({ ...p })));

export const FEATURE_PAGE_SLUGS = Object.freeze(FEATURE_PAGES.map((p) => p.slug));

const BY_SLUG = new Map(FEATURE_PAGES.map((p) => [p.slug, p]));

/** One page, or undefined. */
export function featurePage(slug) {
  return BY_SLUG.get(slug);
}

/** The pages in one matrix group, in declaration order. */
export function featurePagesForGroup(groupKey) {
  return FEATURE_PAGES.filter((p) => p.group === groupKey);
}

const BY_FEATURE = new Map(
  FEATURE_PAGES.filter((p) => p.feature).map((p) => [p.feature, p]),
);

/** The page that IS the page for a feature key, or undefined. */
export function canonicalPageFor(key) {
  return BY_FEATURE.get(key);
}

/** The 29, resolved to {key, slug, entry}, in the order /pricing names them. */
export function pricingFeatureIndex() {
  return PRICING_FEATURES.map((key) => ({
    key,
    slug: BY_FEATURE.get(key)?.slug,
    entry: matrixEntry(key),
  }));
}

/**
 * The hub half of a page: the features it claims that have a page of their own.
 *
 * Derived rather than listed beside the page, so a page cannot name a feature
 * in its "What you get" list and then quietly fail to link the page about it —
 * and adding a canonical page anywhere makes every page that mentions that
 * feature start linking it, with nobody having to remember.
 */
export function moreInThisArea(slug) {
  const page = BY_SLUG.get(slug);
  if (!page) return [];
  return page.features
    .filter((key) => key !== page.feature)
    .map((key) => ({ key, page: BY_FEATURE.get(key) }))
    .filter((x) => x.page && x.page.slug !== slug)
    .map((x) => ({ key: x.key, slug: x.page.slug, entry: matrixEntry(x.key) }));
}

/** The matrix entries a page claims, resolved. Order follows the page. */
export function featuresOnPage(slug) {
  const page = BY_SLUG.get(slug);
  if (!page) return [];
  return page.features.map((key) => matrixEntry(key)).filter(Boolean);
}

/**
 * Which matrix keys are on a page, which are excluded on purpose, and which are
 * neither.
 *
 * A function rather than a constant so it stays true by construction: add a
 * matrix entry and `missing` grows on its own, which is what the check reads.
 */
export function coverage() {
  const covered = new Set(FEATURE_PAGES.flatMap((p) => p.features));
  const excluded = new Set(PAGE_EXCLUSIONS.map((x) => x.key));
  return {
    covered,
    excluded,
    missing: MATRIX_KEYS.filter((k) => !covered.has(k) && !excluded.has(k)),
  };
}
