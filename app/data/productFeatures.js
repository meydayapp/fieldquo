// app/data/productFeatures.js
//
// Everything /product/<slug> says, in English, with the screenshot beside each
// claim and the help article that explains it.
//
// ══ What these four pages are ══════════════════════════════════════════════
//
// The header dropdown, the footer and the homepage feature band all link to
// four pages: Quotes & Invoicing, Scheduling & Dispatch, Team & Payroll,
// Analytics & AI. Until 2026-09-13 each was a label, a headline, four bullets
// and two buttons — ninety-one lines of JSX, no picture, no way to tell what
// the product actually holds. The owner read them beside the real screens and
// asked for pages that "look full and complete", built from the screenshots
// and the information we already have.
//
// So each page is now: a hero with a real screenshot, five or six capability
// sections (heading, two or three sentences, three bullets, a screenshot, a
// link to the help article), the complete list of shipped capabilities under
// that heading drawn from lib/marketing/featureMatrix.js, and a short FAQ.
//
// ══ Truth over fullness ════════════════════════════════════════════════════
//
// Every sentence below was read against the code, the matrix or the help
// article it links to before it was written. The earlier version of this file
// overstated in three places — "every version tracked" (only invoices keep
// their earlier version), "reminders by email and text" (text only), "pay
// contractors directly" (people on your own roster, for clocked hours) — and
// scripts/check-feature-pages.mjs still bans those three phrases from the
// feature pages by name. They are gone from here too, and
// scripts/check-product-pages.mjs now applies the same ban to this file.
//
// The "Everything under…" grid is not written here at all. It is a list of
// matrix KEYS; the name, the summary and the honest limit of each come from
// the matrix through lib/marketing/featureLabels.js, so this page can never
// claim a capability the matrix does not prove. A partial entry renders with
// its "Where this stops" note exactly as /features and /pricing render it.
//
// ══ Screenshots ════════════════════════════════════════════════════════════
//
// public/product/<slug>/<name>[.<lang>].webp, converted from docs/screens/*
// (the live captures of the demo company, and the harness captures of the
// scheduler, employee home, team screens and HR file). A `localized` image
// exists in every language of PRODUCT_SCREEN_LANGS — the languages the live
// captures were taken in — and the page picks the reader's, falling back to
// English. The other captures are English UI and stay English; a screenshot
// is a picture, not a sentence, and nobody machine-translates a picture.
//
// Nothing from docs/screens/platform-* is used: that is FieldQuo's own back
// office, not a customer's.
//
// The hero of three pages is the existing illustration in public/marketing,
// whose alt text is already in the catalogue under hero.tabs.*.alt (`altKey`,
// the same device app/data/featurePages.js uses). The fourth (team) has no
// illustration, so its hero is a real capture and its alt lives in this file.

/**
 * The languages docs/screens/live/app/ was captured in, and therefore the
 * languages a `localized` screenshot exists in. Derived from the capture
 * folders, not from LANGUAGES: a Ukrainian reader gets the English capture,
 * which is a true picture of the product with a caption in their own language.
 */
export const PRODUCT_SCREEN_LANGS = Object.freeze(["en", "fr", "es"]);

/** The language a screenshot is served in for a reader's language. */
export function productScreenLang(language) {
  return PRODUCT_SCREEN_LANGS.includes(language) ? language : "en";
}

/**
 * The public path of a section image for a reader's language.
 *
 * A section image normally lives under public/product/<slug>/ by `name`; one
 * that reuses an illustration from public/marketing carries a full `src`
 * instead, so the file is not copied into a second place to be forgotten.
 */
export function productImageSrc(slug, image, language = "en") {
  if (image.src) return image.src;
  const suffix = image.localized ? `.${productScreenLang(language)}` : "";
  return `/product/${slug}/${image.name}${suffix}.webp`;
}

/** The public path of a hero image. Heroes carry a full `src`. */
export function productHeroSrc(hero) {
  return hero.src;
}

export const PRODUCT_FEATURES = {
  quoting: {
    label: "Quotes & Invoicing",
    headline: "Send a professional quote in minutes",
    description:
      "Build quotes using your own pricing for every service you offer, add photos, and let clients approve online — no printing, no back-and-forth phone calls.",
    bullets: [
      "Your own pricing per service category, not a generic template",
      "Client approves and e-signs online",
      "One click turns an accepted quote into an invoice",
      "Amend a sent invoice and the earlier one is kept — never a question about what was agreed",
    ],
    hero: {
      src: "/marketing/hero-quotes.webp",
      width: 1400,
      height: 1050,
      alt: "A contractor building a quote on a tablet outside a client's home while she reviews it on her phone",
      altKey: "hero.tabs.quotes.alt",
    },
    sections: [
      {
        id: "pricebook",
        heading: "Your services and your rates, set once",
        body:
          "Every service you offer has its own rate card — per square, per linear foot, per hour, whatever the trade prices by. Set it once and it fills every quote. Your product list imports from a spreadsheet and exports back out.",
        bullets: [
          "A rate card per service, in the units your trade actually uses",
          "Products and services imported from a CSV, exported the same way",
          "Material costs and recipes behind the price, never shown to the client",
        ],
        image: { name: "services", localized: true, width: 1280, height: 1000,
          alt: "The Services & Pricing screen: roofing, siding and gutters, each with its own rate card and the materials it is priced by" },
        help: "quote-types-and-takeoffs",
      },
      {
        id: "builder",
        heading: "Build the quote at the house",
        body:
          "Tap a service and your own pricing fills in. Group the lines by room or by scope, attach the photos the client sent, and keep your cost and margin on a panel the client never sees.",
        bullets: [
          "Group lines by room or scope so the quote reads the way the job goes",
          "Photos and videos from the client stay on the quote and carry to the invoice",
          "Cost & margin worked out beside the price — crew hours, materials, overhead",
        ],
        image: { name: "builder", localized: true, width: 1280, height: 1000,
          alt: "The quote builder: client, assignee, the services to tap in, and the internal cost and margin panel" },
        help: "build-a-quote",
      },
      {
        id: "review",
        heading: "A review before you send, and add-ons the client can tick",
        body:
          "Before a quote goes out, FieldQuo AI reads it: what you forgot to mention, how the price sits against the quotes you have already won, and wording that is clearer. Suggested add-ons are priced from your own history and land as optional extras the client ticks on the approval page.",
        bullets: [
          "What is missing, how the price compares, what to reword",
          "Compared against your own accepted quotes only — never another company's",
          "Add-ons are priced on your side; the client only chooses which to accept",
        ],
        image: { name: "ai-review", localized: false, width: 1283, height: 690,
          alt: "The AI review panel scoring a quote 76 out of 100 with three things worth fixing before it is sent" },
        help: "ai-quote-review",
      },
      {
        id: "approval",
        heading: "The client approves and signs from their phone",
        body:
          "The quote arrives in an email from your address, with your logo and your colour, and opens on a page that carries your name. The client picks any extras, signs, and the job is on. What they saw at the moment they signed is kept with the signature.",
        bullets: [
          "Your logo, your colour, your name — nothing on it says FieldQuo",
          "Signature recorded with the exact document the client saw",
          "A quote keeps the language it was written in; a signed document never changes its words",
        ],
        image: { src: "/marketing/hero-invoicing.webp", localized: false, width: 1400, height: 1050,
          alt: "A client reading a quote on their phone, with an Approve button at the bottom",
          altKey: "hero.tabs.invoicing.alt" },
        help: "the-quote-approval-page",
      },
      {
        id: "invoice",
        heading: "One click to invoice, paid from the phone",
        body:
          "An approved quote becomes an invoice that looks like the quote, because it is built from it. Ask for a deposit, split a big job into stages, and let the client pay by card or bank debit — the money settles into your own account, never ours.",
        bullets: [
          "Amend an issued invoice and the earlier version is kept",
          "Deposits and stage payments, requested on the schedule you set",
          "Card, or bank debit in Canada and the US, paid straight to your account",
        ],
        image: { name: "invoice", localized: true, width: 1280, height: 900,
          alt: "The new invoice screen with line items and the internal cost and margin panel" },
        help: "invoices-mirror-quotes",
      },
      {
        id: "instant",
        heading: "An instant estimate on your website",
        body:
          "A visitor answers a few questions — or traces the roof from the address — and gets a price range from rates you set. It lands in your review queue before anything is binding, and your rate card itself is never published.",
        bullets: [
          "Show a range straight away, after they submit, or not at all — your choice per service",
          "Every estimate waits in Estimate Reviews for you to confirm or adjust",
          "A self-quote form where the homeowner describes the job and uploads photos",
        ],
        image: { name: "instant", localized: true, width: 1280, height: 1000,
          alt: "Instant Quotes settings: roofing measured from the address, what the homeowner sees, and the budget bands" },
        help: "instant-quotes-on-your-website",
      },
    ],
    everything: [
      "quotes", "price_book", "material_costs", "quote_send", "quote_pdf",
      "online_approval", "ai_quote_review", "add_on_upsell", "follow_ups",
      "priced_options", "instant_quotes", "self_quote", "call_to_quote",
      "kitchen_designer", "aerial_measure", "invoices", "invoice_send",
      "invoice_changes", "card_payments", "stripe_connect", "financing",
      "service_plans", "client_portal", "sales_tax", "document_layouts",
      "contract_terms", "quote_email_wording", "languages", "white_label",
    ],
    faq: [
      {
        id: "white-label",
        q: "Do my clients see FieldQuo anywhere?",
        a: "No. The quote, the invoice, the approval page, the emails and the PDF carry your logo, your colour and your name in the From line. Our name appears in two small places only: a \"Site by FieldQuo\" line in the footer of your website while your company is not on a paid plan — gone the moment it is — and a \"Made by FieldQuo\" line at the foot of the bio link page.",
      },
      {
        id: "own-prices",
        q: "Can I use my own prices?",
        a: "That is the only way it works. Each service starts from typical rates for your trade, marked as starting points, and you edit them to your market; the quote builder fills in from your numbers, never ours. A price list also imports from a spreadsheet and exports back out.",
      },
      {
        id: "after-approval",
        q: "What happens when the client approves?",
        a: "The quote becomes a job with the scope, the address and the paperwork already on it, and one click turns it into an invoice that mirrors the quote. If you asked for a deposit, that is requested at approval.",
      },
      {
        id: "instalments",
        q: "Can clients pay in instalments?",
        a: "You can split an invoice into stages and each one is requested on your schedule. Pay-over-time at checkout is offered through Stripe, where the lender decides — FieldQuo does not lend and does not approve anyone.",
      },
    ],
  },

  scheduling: {
    label: "Scheduling & Dispatch",
    headline: "Every person, every hour, on one board",
    description:
      "Draft the crew's day and week, publish it once, and everyone sees their own shifts on their phone. Clients book visits from your real availability while you are on the job.",
    bullets: [
      "A day board with a row per person and a column per hour",
      "Shifts stay hidden from the crew until you publish",
      "Public booking page, branded with your logo and colours",
      "Buffer times and per-person availability, not a generic calendar",
    ],
    hero: {
      src: "/product/scheduling/day-board.webp",
      width: 1280,
      height: 900,
      alt: "The day board: five people in rows, the hours in columns, one on vacation, one clocked in, and the coverage strip along the top",
    },
    sections: [
      {
        id: "board",
        heading: "The day board: who is where, hour by hour",
        body:
          "One row per person, a column per hour. A shift is a block with its lunch and breaks drawn in; the time clock turns the dots green and amber as people clock on; somebody on approved vacation shows as an OUT row so nobody schedules them by mistake.",
        bullets: [
          "The coverage strip says how many people are left on site each hour — red where you are short inside opening hours",
          "A draft outside someone's stated availability is dashed and flagged, not silently allowed",
          "Late and on-time chips from the punch against the shift, on the block itself",
        ],
        image: { name: "board-attendance", localized: false, width: 1280, height: 900,
          alt: "The day board as the owner sees it: the labour line for the day and the week, overtime, and Late and On time chips on the shifts" },
        help: "the-scheduler-and-crew-shifts",
      },
      {
        id: "week",
        heading: "Plan the week, publish it once",
        body:
          "The week grid is the same shifts by weekday. Apply a shift to several days at once, post an open shift anyone can claim, and read the hours and wages in the footer before you publish. Until you do, the crew sees nothing.",
        bullets: [
          "Apply-to weekday toggles: set Monday once, tick the other four",
          "Open shifts sit in their own row until someone claims them",
          "Hours, overtime and — with payroll access — the wage bill, per day and per week",
        ],
        image: { name: "week-grid", localized: false, width: 1280, height: 1000,
          alt: "The week grid: events and open shifts rows, a shift per person per day, and the wages and hours footer" },
        help: "the-team-schedule",
      },
      {
        id: "phone",
        heading: "Published, and on every phone",
        body:
          "When you publish, each person is told on their phone, and told again if their shift moves. Their schedule is a card per day: the job, the address, who else is on it, the note you left, and a Clock in button on today's card.",
        bullets: [
          "Told when a shift is published, moved or removed — drafts never reach a phone",
          "Co-workers on the same shift, the site note, and the holiday line",
          "Clock in from the day's card; add the schedule to their phone's calendar",
        ],
        image: { name: "my-schedule-phone", localized: false, width: 700, height: 1400, phone: true,
          alt: "My schedule on a phone: a card per day with the job, the address, the crew on it and a Clock in button" },
        help: "your-schedule-on-your-phone",
      },
      {
        id: "requests",
        heading: "Trades, cover and time off, approved by the right manager",
        body:
          "A crew member asks for cover from their phone; a colleague accepts first, then the manager approves, and everyone is told at each step. Time off runs on policies you set, with balances that build up on their own, blackout dates, and the statutory holidays of your province or state.",
        bullets: [
          "Trade a shift, ask for cover, claim an open shift — all from the Requests hub",
          "Time off policies with balances, a cap on how many are off at once, and blackout dates",
          "Availability changes take effect on a date, so the board knows in advance",
        ],
        image: { name: "requests", localized: false, width: 1280, height: 1000,
          alt: "The Requests hub: time off, trade, cover and availability, with the crew member's own requests listed below" },
        help: "trading-and-covering-shifts",
      },
      {
        id: "booking",
        heading: "A booking page that fills the calendar while you work",
        body:
          "Clients pick a slot from the real availability of the person who will go, with travel time between jobs and an arrival window you promise, on a page that carries your name. A text before the visit, and a link that lets them move it themselves.",
        bullets: [
          "Travel buffer between jobs and an arrival window — exact, ±15, ±30 or ±60 minutes",
          "Take a visit fee at booking and credit it against the invoice",
          "Reminder by text before the visit; the client reschedules from the link, not by phoning you",
        ],
        image: { name: "booking-settings", localized: true, width: 1280, height: 1000,
          alt: "Booking Page settings: the embed snippet, how long a visit is, travel buffer and the arrival window promised to the client" },
        help: "the-booking-page",
      },
      {
        id: "clock",
        heading: "Clock in against the job, with breaks",
        body:
          "The crew clock on from whatever phone they have, against the job they are on — or against no job, because travel and the yard are real hours. Lunch and breaks are punched too. At the tap, the phone is asked once for its position; the timesheet then shows how far from the site it was. Nothing tracks anyone between taps.",
        bullets: [
          "Two visits today? The clock asks which; \"no job\" is always an honest option",
          "Paid and unpaid breaks, from the phone",
          "One position at the tap, never in between — refusing it changes nothing about the punch",
        ],
        image: { name: "time-clock", localized: true, width: 1280, height: 760,
          alt: "The time clock: the current time, which job, and the Clock in button" },
        help: "the-time-clock",
      },
    ],
    everything: [
      "scheduling", "crew_shifts", "jobs", "recurring_jobs", "booking_page",
      "booking_deposit", "client_reschedule", "appointment_reminders",
      "voice_callbacks", "time_clock", "timesheets", "time_off", "work_areas",
      "checklists", "tasks", "suggested_tasks", "job_photos", "materials",
      "crew_inbox",
    ],
    faq: [
      {
        id: "phone",
        q: "Does my crew need to install anything?",
        a: "No. FieldQuo runs in the phone's own browser and can be pinned to the home screen so it opens like any other icon. There is nothing to install and nothing to update.",
      },
      {
        id: "reminders",
        q: "How are clients reminded?",
        a: "By text message before the visit, with a link to move or cancel it. There is no email reminder yet, and the reminder wording is fixed — the \"on my way\" text is the one you can edit.",
      },
      {
        id: "crew-sees",
        q: "What does a crew member see?",
        a: "Their own shifts, the jobs they are assigned to, what to buy for them, and their own hours. No prices, no quotes, no invoices, no other people's requests — unless you turn a dial for them.",
      },
      {
        id: "book-account",
        q: "Do clients need an account to book?",
        a: "No. The booking page asks for a name, a phone number and an address, and the confirmation carries the link they use to manage the visit.",
      },
    ],
  },

  team: {
    label: "Team & Payroll",
    headline: "Give your team access without giving up control",
    description:
      "Preset access levels for crew, estimators, dispatchers and managers, a dial per area for anyone who needs something different, and a file per person: documents, onboarding, policies, hours and pay.",
    bullets: [
      "Crew, Estimator, Dispatcher and Manager presets, then a dial per area per person",
      "Timesheets tied to real jobs, not guesswork",
      "Pay runs and payslips from approved hours",
      "Employee documents, onboarding and policies in one file",
    ],
    hero: {
      src: "/product/team/manager-home.webp",
      width: 1280,
      height: 1200,
      alt: "The manager's home screen: paid hours and wages for today, two visits to dispatch, team status, and the requests that need review",
    },
    sections: [
      {
        id: "access",
        heading: "Job titles are words; access is a dial",
        body:
          "Start from a preset — Crew, Estimator, Dispatcher, Manager — then change any dial for that one person: what they see of the schedule, timesheets, payroll, clients, quotes, jobs, invoices. It holds on the server, not just on screen, so a hidden button is never the only thing in the way.",
        bullets: [
          "Four presets and a Custom editor, one dial per area",
          "Show Pricing, Job Costing and Payments are separate switches",
          "Crew logins are free; seats are for the people who write quotes and invoices",
        ],
        image: { name: "access-dials", localized: false, width: 720, height: 1000, tall: true,
          alt: "The permissions panel on a new team member: the Crew, Estimator, Dispatcher and Manager presets and a dial per area below them" },
        help: "access-levels-overview",
      },
      {
        id: "home",
        heading: "Each person's own home screen, on their phone",
        body:
          "A crew member opens FieldQuo to their next shift, the note you left, what they earned today, and the buttons they actually use: clock in, find cover, trade, message. A manager opens it to the day's paid hours, the visits still to dispatch, who is on site, and the requests waiting for a decision.",
        bullets: [
          "Next shift with the job, the address and who else is on it",
          "Find cover, trade a shift, ask for time off — from the same screen",
          "The manager's view: dispatch, team status, and what needs review",
        ],
        image: { name: "home-phone", localized: false, width: 700, height: 1400, phone: true,
          alt: "The employee home on a phone: good afternoon, the next shift, a note for it, Find cover and Trade, and Clock out" },
        help: "your-home-screen",
      },
      {
        id: "hr",
        heading: "An HR file per person",
        body:
          "Licences, tickets and certifications with expiry reminders. A new-hire checklist with the TD1 or W-4 answered on a phone and kept with the file — FieldQuo files nothing with any tax authority and never asks for a social insurance number. Policies are versioned and acknowledged by typed name, and a compliance view shows who is missing what.",
        bullets: [
          "Documents with an expiry date and a reminder before it",
          "Onboarding checklist: forms to fill, documents to upload, policies to sign",
          "The manager's log book for notes and write-ups, kept with the person",
        ],
        image: { name: "compliance", localized: false, width: 1280, height: 720,
          alt: "HR & compliance: a row per person showing documents to verify, onboarding progress, unsigned policies and write-ups" },
        help: "hr-and-compliance",
      },
      {
        id: "chat",
        heading: "A chat room for every job, and one for the company",
        body:
          "Every job has a room the crew on it and the office share, so the photo of the scratched drawer front is next to the job and not in someone's texts. Groups and direct messages sit beside it, with @mentions, on the phone and at the desk.",
        bullets: [
          "A room per job, opened from the job and opened back to it",
          "Groups, direct messages and @mentions",
          "Unread counts per room, on the phone",
        ],
        image: { name: "chat", localized: false, width: 1280, height: 760,
          alt: "Team chat: a job room with the crew's messages about the countertop template and the walk-through, an @mention highlighted" },
        help: "team-chat",
      },
      {
        id: "timesheets",
        heading: "Timesheets from real punches, with the flags",
        body:
          "Hours land tied to the job and the shift they were clocked against. The board shows who was late and by how much, who is over forty hours this week, and — for anyone with payroll access — what the day and the week cost in wages. You approve hours before they can become pay.",
        bullets: [
          "Late and on-time from the punch against the shift, not from memory",
          "Overtime called out per person as the week builds",
          "The wage bill for the day and the week, hidden from anyone without payroll access",
        ],
        image: { name: "board-hours", localized: false, width: 1280, height: 700,
          alt: "The day board as a dispatcher sees it: hours scheduled, overtime over forty hours, Late and On time chips, and a note that labour cost shows only to people who can see pay rates" },
        help: "timesheets-and-approving-hours",
      },
      {
        id: "payroll",
        heading: "Pay runs and payslips from approved hours",
        body:
          "Approved hours and each person's rate become a pay run for the period you choose, with a payslip per person and an export for your accountant. FieldQuo works out gross pay; it does not pay employees or file payroll taxes. Someone on your roster marked as a contractor can be paid for their clocked hours by a real transfer to their bank.",
        bullets: [
          "Pay periods on your cycle, payslips as PDF, the run exported",
          "Contractors on your roster paid for clocked hours at the rate you set",
          "Subcontracting companies kept on file with their insurance and the year-end T5018 list",
        ],
        image: { name: "payroll", localized: true, width: 1280, height: 1000,
          alt: "Payroll: this period's approved hours, gross, deductions and net, and a new pay run being set up" },
        help: "payroll-runs",
      },
    ],
    everything: [
      "team_access", "hr_compliance", "crew_shifts", "scheduling", "time_clock",
      "timesheets", "time_off", "payroll", "contractor_payouts",
      "subcontractor_bids", "work_areas", "checklists", "crew_inbox",
      "activity_log",
    ],
    faq: [
      {
        id: "taxes",
        q: "Does FieldQuo file payroll taxes?",
        a: "No. It works out gross pay from approved hours, produces the payslips and exports the run. Deductions are the ones you or your accountant supply, and nothing is filed with any tax authority.",
      },
      {
        id: "crew-free",
        q: "Are crew logins free?",
        a: "Yes. A Crew login sees their own schedule, clocks in and out, and files photos — it does not count against your seats. Seats are for the people who create and change quotes, jobs and invoices.",
      },
      {
        id: "see-pay",
        q: "Can a dispatcher see what I pay people?",
        a: "Only if you give them payroll access. Without it the board shows hours and overtime and says why the money is missing. Every rate and every wage figure is hidden on the server, not just on screen.",
      },
      {
        id: "leaves",
        q: "What happens when someone leaves?",
        a: "You deactivate them. Their hours, documents and history stay on file; they can no longer sign in, and their seat is free for the next person.",
      },
    ],
  },

  analytics: {
    label: "Analytics & AI",
    headline: "Know your numbers before you're guessing",
    description:
      "See your real overhead, your break-even price per job, and how your pricing compares to other shops in your trade — plus an AI assistant that can answer questions about your own business.",
    bullets: [
      "Burn rate and minimum price, calculated from your real expenses",
      "Marketing spend broken down by channel — Facebook, Google, TikTok, and more",
      "See how your pricing compares, anonymously, to others in your trade",
      'Ask FieldQuo AI questions like "is my conversion rate normal?"',
    ],
    hero: {
      src: "/marketing/hero-analytics.webp",
      width: 1400,
      height: 1050,
      alt: "A dashboard showing cost per job, minimum price and how your average prices compare to other shops in your trade",
      altKey: "hero.tabs.analytics.alt",
    },
    sections: [
      {
        id: "kpis",
        heading: "The KPI dashboard: sales, money, costs, profit, execution",
        body:
          "Win rate, average job value, lead-to-quote conversion, income against expenses by day, labour as a share of revenue, on-time completion. Every figure comes from what is already in FieldQuo — no bank connection, no spreadsheet. A card with nothing behind it says why, instead of showing a zero.",
        bullets: [
          "This month, last month, this quarter, year to date or last year",
          "Financial statements, won and lost, and estimate accuracy as their own reports",
          "A weekly digest, and a monthly write-up in sentences instead of charts",
        ],
        image: { name: "kpis", localized: true, width: 1280, height: 1000,
          alt: "The KPI dashboard: sales cards, money flow with income against expenses by day, and business costs" },
        help: "the-kpi-dashboard",
      },
      {
        id: "overhead",
        heading: "Overhead, and the minimum price it implies",
        body:
          "Rent, insurance, phones, the office salaries, the truck loan and what the truck is losing in value every month — entered once. Tell FieldQuo how many jobs the crew takes on in a normal week and it tells you the lowest price a job can carry and still cover the business.",
        bullets: [
          "Fixed costs, salaries, debt, assets and depreciation, bills due",
          "Paid hours that never reached a job counted as overhead, not hidden",
          "The minimum price sits beside the quote total while you build it",
        ],
        image: { name: "overhead", localized: true, width: 1280, height: 1000,
          alt: "The Overhead screen: jobs per week, paid hours that never reached a job, and the fixed costs, salaries and debt sections" },
        help: "overhead-and-your-minimum-price",
      },
      {
        id: "expenses",
        heading: "Expenses, burn rate and runway",
        body:
          "Log what you spend, or import a month of it from a bank statement CSV, and split what belongs to a job from what belongs to the business. The monthly burn rate and the runway on the cash you have follow from it.",
        bullets: [
          "Import from a bank CSV; no bank login, ever",
          "Job-related spend against business spend, by category, over six months",
          "Marketing spend by channel, with an automatic import from Meta Ads",
        ],
        image: { name: "expenses", localized: true, width: 1280, height: 1000,
          alt: "Expense Tracking: tracked expenses this month, monthly burn rate, runway, the burn breakdown and the six-month trend" },
        help: "expense-tracking-and-burn-rate",
      },
      {
        id: "costing",
        heading: "Job costing: what you quoted against what it cost",
        body:
          "The quote carries an estimated cost — crew hours, materials from the recipe, an overhead share — that the client never sees. When the job is done, the clocked hours, the materials bought and the expenses logged sit against the price, so you know what you actually made and which estimates run over.",
        bullets: [
          "Labour, materials and expenses against the quoted price, per job",
          "Estimate accuracy: the median variance across your completed jobs",
          "A nudge to revise your costing when a job runs past the threshold you set",
        ],
        image: { name: "cost-margin", localized: true, width: 950, height: 560,
          alt: "The Cost & margin panel on a quote: crew hours, overhead as a share of price, materials and labour, and the estimated cost against the quote price" },
        help: "job-costing",
      },
      {
        id: "benchmark",
        heading: "How your prices compare, with nobody named",
        body:
          "Opt in, and your average quote per service category is set against the anonymised average of other shops in your trade on the platform. Your individual quotes are never shared and no company is named — including yours.",
        bullets: [
          "Opt-in from Settings; nothing is compared until you say so",
          "Average price and win rate by service category",
          "Aggregated averages only — a category with too few shops shows nothing",
        ],
        image: { name: "benchmark", localized: true, width: 1280, height: 520,
          alt: "How You Compare, before opting in: the explanation that benchmarking is opt-in and the link to Settings" },
        help: "how-you-compare",
      },
      {
        id: "ai",
        heading: "Ask FieldQuo AI about your own business",
        body:
          "Which clients haven't been invoiced yet? What is my average quote this month? Which material costs went up the most? FieldQuo AI looks the answer up in your own quotes, invoices, clients and costs rather than guessing. It answers about your company only: it declines general questions, and it never sees another company's data.",
        bullets: [
          "Answers from your own numbers, with the figures it used",
          "Declines anything that is not about your business",
          "Metered in AI credit, with an allowance on every plan",
        ],
        image: { name: "copilot", localized: true, width: 1280, height: 720,
          alt: "FieldQuo AI: four questions to try, about unbilled clients, average quote value, material costs and unanswered quotes" },
        help: "fieldquo-ai-ask-about-your-business",
      },
    ],
    everything: [
      "dashboard", "break_even", "benchmark", "monthly_digest", "goals",
      "expenses", "marketing_spend", "job_costing", "material_costs",
      "funnels", "ai_copilot", "ai_quote_review", "voice_receptionist",
      "call_to_quote", "voice_callbacks", "activity_log",
    ],
    faq: [
      {
        id: "other-data",
        q: "Does the AI see other companies' data?",
        a: "No. FieldQuo AI reads your company's own records and nothing else. The price comparison uses anonymised averages you opt into; your quotes are never shown to anyone.",
      },
      {
        id: "general",
        q: "Can I ask it general questions?",
        a: "No. It answers questions about your own business — your quotes, jobs, invoices, clients, costs and hours — and declines anything else. It is not a general assistant.",
      },
      {
        id: "bank",
        q: "Do I need to connect my bank?",
        a: "No, and you cannot. Income comes from the payments recorded in FieldQuo; expenses are what you log or import from a bank statement CSV you download yourself.",
      },
      {
        id: "benchmark-source",
        q: "Where do the comparison numbers come from?",
        a: "From other companies in your trade on FieldQuo who also opted in, averaged by service category with nobody named. A category with too few companies behind it shows nothing rather than a misleading number.",
      },
    ],
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   The catalogue keys these four pages resolve through
   ═══════════════════════════════════════════════════════════════════════════

   Same shape as featurePageKey/featurePageStrings/featurePageCopy in
   app/data/featurePages.js, and for the same reason: the prefix is decided in
   one place, so the renderer, the nine translation modules and the check that
   compares them cannot come to disagree about what a key is called.

   ── What is NOT here: the label ────────────────────────────────────────────

   `label` is deliberately absent from productPageStrings(). It already exists
   as `product.<slug>.label` in app/i18n/messages.js, in all nine languages,
   because the header dropdown, the footer and the homepage feature band all
   render it. Copying it into a second catalogue would be a second wording of
   the same word, and the one nobody looks at is the one that rots. The page
   renders t(`product.${slug}.label`) instead, and
   scripts/check-product-pages.mjs pins the English of that key to
   PRODUCT_FEATURES[slug].label so the two can never drift apart.

   ── Nor the feature names in the "Everything under…" grid ──────────────────

   Those are `feature.<key>.name` / `.summary` / `.limits` in messages.js,
   resolved through featureEntry() in lib/marketing/featureLabels.js — the one
   seam allowed to turn a matrix key into words, already in nine languages and
   gated by check:feature-labels.

   ── Nor an image alt that already has a key ────────────────────────────────

   The three heroes borrowed from public/marketing carry `altKey`, an existing
   hero.tabs.*.alt entry, and are resolved through t(). Every other alt is a
   new sentence and lives here under `hero.alt` or `section.<id>.alt`.

   ── What IS here: the description ──────────────────────────────────────────

   `product.<slug>.description` in messages.js is the ONE-LINE nav summary
   ("Build and send professional quotes in minutes"). It is not this page's
   opening paragraph, which is three times longer and says different things.
   Rendering the nav line under the headline would print "Send a professional
   quote in minutes" above "Build and send professional quotes in minutes" —
   so the paragraph gets a key of its own. */

/** The catalogue key for one prose field of one product page. */
export function productPageKey(slug, field) {
  return `productPage.${slug}.${field}`;
}

/**
 * The page furniture every product page shares — the words that are not
 * ABOUT a feature. English is the data, as for the prose; the catalogue's
 * English block is pinned to it by the check. Keys: productPage.chrome.<field>.
 *
 * `everythingTitle` carries a {label} slot the renderer fills with the page's
 * own label (t("product.<slug>.label")), because word order around a noun is
 * not ours to assume across nine languages.
 */
export const PRODUCT_PAGE_CHROME = Object.freeze({
  readHow: "Read how it works",
  inEnglish: "in English",
  everythingTitle: "Everything under {label}",
  everythingBody:
    "Every capability listed here is in the product today. Where one stops short, it says so.",
  faqTitle: "Common questions",
});

export function productChromeKey(field) {
  return `productPage.chrome.${field}`;
}

/** Every chrome string as {field, english}, in one place for the check. */
export function productChromeStrings() {
  return Object.entries(PRODUCT_PAGE_CHROME).map(([field, english]) => ({ field, english }));
}

/**
 * Every translatable string on one product page, as {field, english}.
 *
 * One list, read by the resolver below and by scripts/check-product-pages.mjs,
 * so "every prose field" means the same thing in both places. An image whose
 * alt is borrowed through `altKey` contributes nothing — its sentence is
 * already in messages.js and pinned there.
 */
export function productPageStrings(feature) {
  const out = [
    { field: "headline", english: feature.headline },
    { field: "description", english: feature.description },
    ...feature.bullets.map((b, i) => ({ field: `bullet.${i + 1}`, english: b })),
  ];
  if (feature.hero && !feature.hero.altKey) out.push({ field: "hero.alt", english: feature.hero.alt });
  for (const s of feature.sections || []) {
    out.push({ field: `section.${s.id}.heading`, english: s.heading });
    out.push({ field: `section.${s.id}.body`, english: s.body });
    s.bullets.forEach((b, i) => out.push({ field: `section.${s.id}.bullet.${i + 1}`, english: b }));
    if (s.image && !s.image.altKey) out.push({ field: `section.${s.id}.alt`, english: s.image.alt });
  }
  for (const f of feature.faq || []) {
    out.push({ field: `faq.${f.id}.q`, english: f.q });
    out.push({ field: `faq.${f.id}.a`, english: f.a });
  }
  return out;
}

/** Every prose key on every product page, in page order, then the chrome. */
export const PRODUCT_PAGE_TEXT_KEYS = Object.freeze([
  ...Object.entries(PRODUCT_FEATURES).flatMap(([slug, feature]) =>
    productPageStrings(feature).map(({ field }) => productPageKey(slug, field)),
  ),
  ...productChromeStrings().map(({ field }) => productChromeKey(field)),
]);

/**
 * One product page with every sentence said in the reader's language.
 *
 * `say(key, english)` is passed in rather than a language code, matching
 * featurePageCopy(): the caller owns the resolution chain, and the English
 * from THIS file travels along as the last honest step, so a language with a
 * hole prints the proved English sentence rather than
 * `productPage.quoting.headline`.
 *
 * `t` is the marketing catalogue's translator, used only for the borrowed
 * alts (`altKey`). Both are optional because generateMetadata() has no React
 * context and must not gain one — a crawler indexing a French <title> because
 * the last visitor switched languages is worse than an untranslated one. Same
 * decision as /industries/[slug] and /features/[slug].
 */
export function productPageCopy(slug, say, t) {
  const feature = PRODUCT_FEATURES[slug];
  if (!feature) return undefined;

  const said = (field, english) =>
    typeof say === "function" ? say(productPageKey(slug, field), english) : english;
  const alt = (img, field) =>
    img.altKey
      ? typeof t === "function" ? t(img.altKey, img.alt) : img.alt
      : said(field, img.alt);

  return {
    ...feature,
    headline: said("headline", feature.headline),
    description: said("description", feature.description),
    bullets: feature.bullets.map((b, i) => said(`bullet.${i + 1}`, b)),
    hero: feature.hero ? { ...feature.hero, alt: alt(feature.hero, "hero.alt") } : undefined,
    sections: (feature.sections || []).map((s) => ({
      ...s,
      heading: said(`section.${s.id}.heading`, s.heading),
      body: said(`section.${s.id}.body`, s.body),
      bullets: s.bullets.map((b, i) => said(`section.${s.id}.bullet.${i + 1}`, b)),
      image: s.image ? { ...s.image, alt: alt(s.image, `section.${s.id}.alt`) } : undefined,
    })),
    faq: (feature.faq || []).map((f) => ({
      ...f,
      q: said(`faq.${f.id}.q`, f.q),
      a: said(`faq.${f.id}.a`, f.a),
    })),
  };
}

/** The chrome, said in the reader's language. */
export function productChromeCopy(say) {
  const out = {};
  for (const { field, english } of productChromeStrings()) {
    out[field] = typeof say === "function" ? say(productChromeKey(field), english) : english;
  }
  return out;
}
