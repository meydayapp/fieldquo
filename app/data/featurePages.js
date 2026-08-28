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
// ══ English only, on purpose, and the debt that creates ════════════════════
//
// Following app/data/productFeatures.js: a plain English data module, not the
// t() catalogue. The site is six languages elsewhere, so this is a real debt
// and it is written down here rather than discovered later — see the header of
// app/(marketing)/features/[slug]/page.js for the shape the fix would take.

import { MATRIX_KEYS, matrixEntry } from "@/lib/marketing/featureMatrix";

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
          "Each lead is scored on what it looks like, so the list is already in the order worth working.",
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
    related: ["quotes", "marketing", "ai-receptionist"],
  },
  {
    slug: "ai-receptionist",
    group: "winning_work",
    label: "AI receptionist",
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
    related: ["website", "leads", "reporting"],
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

  // ── Doing the job ────────────────────────────────────────────────────────
  {
    slug: "scheduling",
    group: "doing_the_job",
    label: "Scheduling and dispatch",
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

  // ── Getting paid ─────────────────────────────────────────────────────────
  {
    slug: "invoicing",
    group: "getting_paid",
    label: "Invoicing",
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
    headline: "Let the homeowner spread the cost of the big job",
    oneLine:
      "Pay-over-time offered at checkout through Affirm, on top of card, on the jobs homeowners otherwise postpone.",
    description:
      "Offer homeowners pay-over-time at checkout through Affirm, via your own Stripe account — with the honest limits on who lends and what qualifies.",
    pains: [
      {
        pain:
          "The full kitchen is the job you want, and the homeowner keeps deferring it to next year.",
        fix:
          "They are offered a monthly option at the moment they are paying, instead of being asked for the lot in one go.",
      },
      {
        pain:
          "Signing up with a finance company is its own project, with its own paperwork.",
        fix:
          "It rides on the payment account you already connected. There is nothing separate to integrate.",
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
          "When you switch financing on, the pay page offers Affirm alongside card. It rides on the Stripe account your payments already settle into; Affirm has to be switched on in that account before it can appear.",
      },
      {
        step: "It only appears where it can actually work",
        body:
          "Affirm is offered on amounts between $50 and $30,000 in Canadian or US dollars. Outside that, the page shows card only — a pay link that works beats one that names an option and then fails.",
      },
      {
        step: "The lender decides, and says so in its own words",
        body:
          "Affirm quotes its own terms on its own page and makes its own decision. FieldQuo does not lend, does not approve anyone, and never states terms on a lender's behalf.",
      },
    ],
    features: ["financing"],
    related: ["payments", "quotes", "invoicing"],
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
