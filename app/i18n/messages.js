// app/i18n/messages.js
//
// The message catalog. One flat object per language, dot-namespaced keys.
//
// Flat rather than nested on purpose: `t("nav.pricing")` is a single lookup,
// keys grep cleanly (search the codebase for "nav.pricing" and you find both
// the use and every translation), and there's no merge logic to get wrong.
//
// English is the source of truth. Any key missing from another language falls
// back to English rather than rendering the raw key — a French visitor seeing
// one English sentence is a much smaller failure than seeing "nav.pricing".
//
// Interpolation uses {name} placeholders — see t() in useTranslation.js.

// Extension included on purpose. Webpack resolves either way, but
// scripts/check-translations.mjs runs this file under plain node, whose ESM
// resolver does not guess extensions — without it the coverage check dies at
// import time, which is exactly how it came to be silently broken before.
import { APP_MESSAGES, APP_MESSAGE_KEYS } from "./appMessages.js";
// Same reasoning about the extension. The /features catalogue is 981 keys in
// six languages — twice this file — and lives in its own directory for the
// reason its header gives. It is merged into the MARKETING blocks below, NOT
// alongside the app catalogue, because it is public copy and must be gated at
// the marketing bar: every language, or check:translations fails.
import { FEATURE_PAGE_MESSAGES } from "./featurePages/index.js";

const en = {
  // Navigation
  "nav.features": "Features",
  "nav.product": "Product",
  "nav.pricing": "Pricing",
  "pricing.group.winning": "Winning the work",
  "pricing.group.doing": "Doing the job",
  "pricing.group.paid": "Getting paid",
  "pricing.group.running": "Running the business",
  "pricing.includedTitle": "All of it is in every plan",
  "pricing.includedBody": "There is no tier that unlocks job costing, no upgrade for the AI, no add-on for taking payment. The plans differ by how many people work in them — nothing else.",
  "pricing.includedMore": "That is the short list. See everything FieldQuo does →",
  "nav.allFeatures": "All features",
  "nav.compare": "Compare",
  "nav.savings": "Savings",
  "nav.glossary": "Trade glossary",
  "product.allFeatures.label": "All features",
  "product.allFeatures.desc": "Every part of FieldQuo, and what it does for you",
  "product.compare.label": "Compare",
  "product.compare.desc": "FieldQuo against Jobber, Housecall Pro, ServiceTitan and Projul",
  "nav.industries": "Industries",
  "nav.resources": "Resources",
  "nav.contact": "Contact",
  "nav.login": "Log in",
  "nav.signup": "Start free trial",
  "nav.dashboard": "Go to dashboard",

  // Product menu
  "product.quoting.label": "Quotes & Invoicing",
  "product.quoting.description": "Build and send professional quotes in minutes",
  "product.scheduling.label": "Scheduling & Dispatch",
  "product.scheduling.description":
    "Calendly-style booking, appointments, and job assignment",
  "product.team.label": "Team & Payroll",
  "product.team.description":
    "Timesheets, contractor payouts, role-based access",
  "product.analytics.label": "Analytics & AI",
  "product.analytics.description":
    "Know your numbers — and what to do about them",

  // Hero
  "hero.title": "Quotes, invoices and scheduling for field service teams",
  "hero.subtitle":
    "Build a quote on site, send it before you leave the driveway, and get paid without chasing anyone.",
  "hero.cta": "Start free trial",
  "hero.ctaSecondary": "See how it works",
  "hero.noCard": "No credit card required",
  "hero.emailPlaceholder": "you@yourcompany.com",
  "hero.requestDemo": "Request a demo",
  "hero.demo.title": "Book a 30-minute demo",
  "hero.demo.openCta": "Book a demo or a call back",
  "hero.demo.openHint": "30 minutes, live, no slides. Or leave your number and we'll ring you.",
  "hero.demo.close": "Close",
  "hero.demo.modeSlot": "Pick a time",
  "hero.demo.modeCallback": "Call me back",
  "hero.demo.phone": "Phone number",
  "hero.demo.whenBest": "Best time to reach you (optional)",
  "hero.demo.requestCallback": "Request a call back",
  "hero.demo.callbackSent": "Got it — we'll call you shortly.",
  "hero.demo.callbackBody": "We'll ring {phone}. If we miss you, we'll email {email}.",
  "hero.demo.subtitle": "Pick a time and we'll walk you through FieldQuo live.",
  "hero.demo.loading": "Loading times…",
  "hero.demo.noSlots": "No open times right now — email hello@fieldquo.com and we'll sort one out.",
  "hero.demo.name": "Your name",
  "hero.demo.email": "Work email",
  "hero.demo.company": "Company (optional)",
  "hero.demo.pickSlot": "Pick a time above",
  "hero.demo.confirmWithTime": "Confirm {time}",
  "hero.demo.confirmedTitle": "You're booked!",
  "hero.demo.confirmedBody": "Check {email} for your calendar invite. See you {when}.",
  "hero.demo.genericError": "Something went wrong — please try again.",
  "hero.sending": "Sending…",
  "hero.demoThanks": "Thanks — we'll be in touch shortly to set up your demo.",
  "hero.tabs.quotes.label": "Quotes",
  "hero.tabs.quotes.headline": "Send a professional quote in minutes, not hours",
  "hero.tabs.quotes.body":
    "Build quotes with your own pricing, service categories, and photos — client approves online, no back-and-forth.",
  "hero.tabs.quotes.alt": "A contractor building a quote on a tablet outside a client's home while she reviews it on her phone",
  "hero.tabs.scheduling.label": "Scheduling",
  "hero.tabs.scheduling.headline":
    "Let clients book you directly from your website",
  "hero.tabs.scheduling.body":
    "A booking page that shows your real availability, assigns the right person on your team, and confirms automatically.",
  "hero.tabs.scheduling.alt": "A client picking an appointment time on a contractor's booking page on her phone",
  "hero.tabs.invoicing.label": "Invoicing",
  "hero.tabs.invoicing.headline": "Get paid without chasing anyone down",
  "hero.tabs.invoicing.body":
    "Turn an accepted quote into an invoice with one click, and let clients pay online the moment it lands in their inbox.",
  "hero.tabs.invoicing.alt": "A client reading a quote on their phone, with an Approve button at the bottom",
  "hero.tabs.analytics.label": "Analytics",
  "hero.tabs.analytics.headline": "Know what to charge, before you're guessing",
  "hero.tabs.analytics.body":
    "See your real overhead, your minimum price per job, and how you compare to other shops in your trade.",
  "hero.tabs.analytics.alt": "A dashboard showing cost per job, minimum price and how your average prices compare to other shops in your trade",

  // Features
  "features.title": "Everything you need to run the job",
  "features.quotes.title": "Quotes in minutes",
  "features.quotes.body":
    "Price from your own catalogue, add photos, and send a quote your client can approve on their phone.",
  "features.invoices.title": "Invoices that get paid",
  "features.invoices.body":
    "Turn an approved quote into an invoice in one click, take card payments, and track what's outstanding.",
  "features.scheduling.title": "Scheduling that holds up",
  "features.scheduling.body":
    "Book jobs, assign crews, and let clients pick a slot from your real availability.",
  "features.followups.title": "Follow-ups on autopilot",
  "features.followups.body":
    "Quiet quotes and overdue invoices get chased automatically, in your words.",

  // Pricing
  "pricing.title": "Simple, transparent pricing",
  "pricing.subtitle":
    "Every plan includes quotes, invoicing, and scheduling. Pick the plan that matches the size of your team.",
  "pricing.month": "/month",
  "pricing.cta": "Start free trial",
  "pricing.empty":
    "Pricing plans are being finalized — check back shortly, or contact us for early access pricing.",

  // Contact
  "contact.title": "Talk to us",
  "contact.subtitle": "Questions about the product, pricing, or migrating your data.",
  "contact.name": "Your name",
  "contact.email": "Email",
  "contact.message": "Message",
  "contact.send": "Send message",
  "contact.sending": "Sending…",
  "contact.sent": "Thanks — we'll be in touch shortly.",
  "contact.error": "Something went wrong. Try again, or email us directly.",

  // ── The public booking page (/book/[companySlug]) ─────────────────────────
  //
  // Client-facing, so these are gated at the marketing bar — every language or
  // check:translations fails — rather than the app bar. A homeowner standing in
  // a driveway is exactly the reader who has no relationship with FieldQuo and
  // no way to guess at an English sentence.
  //
  // Worded to match the self-quote form's equivalent questions in
  // lib/i18n/clientDocCopy.js. The same person is being asked the same thing on
  // two different surfaces, and the two must not phrase it differently.
  "booking.work.serviceLabel": "What kind of work is it?",
  "booking.work.serviceUnsure": "Not sure yet",
  "booking.work.notesLabel": "Anything we should know?",
  "booking.work.notesPlaceholder":
    "What needs doing, roughly how big, anything unusual about getting to it…",
  "booking.work.notesHint": "Optional — it means we turn up prepared.",

  "features.everything": "Everything your business needs, in one place",
  "features.anyTrade": "Built for any trade",

  // FieldQuo AI section
  "ai.badge": "FieldQuo AI",
  "ai.title": "Ask your business a question, get a real answer",
  "ai.body":
    "FieldQuo AI reads your own quotes, invoices, and expenses — not generic advice. Ask how your quote conversion rate is doing this month, or whether materials were cheaper last month, and get an answer grounded in your actual numbers.",
  "ai.samples.pricing": "“Am I pricing too low compared to last quarter?”",
  "ai.samples.topClients":
    "“Which of my clients have paid the most this year?”",
  "ai.samples.materials":
    "“Should I stock up on any materials right now?”",
  "ai.chat.question": "How's my quote conversion rate this month?",
  "ai.chat.answer":
    "You've sent 14 quotes and 6 were accepted — a 43% conversion rate, up from 31% last month. Your painting quotes are converting best.",

  // Resources
  "resources.title": "Free resources",
  "resources.help.description":
    "Guides for getting set up and using FieldQuo",
  "resources.faq.description": "Quick answers to common questions",
  "resources.contact.description": "Talk to a real person",

  // Pricing card
  "pricing.popular": "Most popular",
  "pricing.selected": "Selected",
  "pricing.firstMonth": "First month",
  "pricing.free": "Free",
  "pricing.then": "Then",
  "pricing.perMonthShort": "/mo",
  "pricing.seatsUnlimited": "Unlimited employee accounts",
  "pricing.seatsOne": "1 employee account",
  "pricing.seatsMany": "{count} employee accounts",
  "pricing.rbacSeats": "1 master account + {count} RBAC seats",
  "pricing.crewIncluded": "{count} crew members included — free",
  "pricing.seatsOneIncluded": "1 seat — quoting, jobs and invoicing",
  "pricing.seatsManyIncluded": "{count} seats — quoting, jobs and invoicing",
  "pricingPage.currencyBasis": "One set of prices. Which money you're billed in comes from the business address you give when you sign up: Canadian companies are billed in Canadian dollars, US companies in US dollars — the same number either way, not a converted one.",
  "pricing.fullAccess":
    "Full access — quotes, invoicing, scheduling, analytics",
  "pricing.quoteLimit": "Up to {count} quotes per month",
  "pricing.aiIncluded": "AI copilot included",

  // FAQ
  "faq.title": "Frequently asked questions",
  "faq.items.install.q": "Do I need to install anything?",
  "faq.items.install.a":
    "No — FieldQuo runs entirely in your browser. You can also access it from your phone.",
  "faq.items.onlinePayment.q": "Can my clients pay their invoices online?",
  "faq.items.onlinePayment.a":
    "Yes. Connect your own Stripe account and clients can pay directly from the invoice email — the money goes straight to you.",
  "faq.items.financing.q": "Can my clients pay over time?",
  "faq.items.financing.a":
    "Yes. Turn on Affirm in Settings → Payments and clients can split an invoice into monthly payments at checkout — while you're still paid in full, up front.",
  "faq.items.permissions.q":
    "Can I control what my employees can see and do?",
  "faq.items.permissions.a":
    "Yes. Every team member has a role — employee, supervisor, or admin — that determines what they can create, assign, and access.",
  "faq.items.trade.q": "What if my trade isn't listed?",
  "faq.items.trade.a":
    "FieldQuo works for any contracting or home service business. You can enable or disable specific service categories and set your own pricing regardless of trade.",
  "faq.items.contract.q": "Is there a contract or long-term commitment?",
  "faq.items.contract.a": "No. Plans are month-to-month — cancel anytime.",

  // Footer
  "footer.product": "Product",
  "footer.company": "Company",
  "footer.legal": "Legal",
  "footer.privacy": "Privacy",
  "footer.terms": "Terms",
  "footer.security": "Security",
  "footer.rights": "All rights reserved.",
  "footer.tagline":
    "The all-in-one platform for contractors and home service pros — quotes, scheduling, invoicing, and payments in one place.",
  "footer.links.help": "Help Center",
  "footer.links.faq": "FAQ",
  "footer.links.blog": "Blog",
  "footer.links.contact": "Contact us",
  "footer.links.about": "About",
  "footer.links.careers": "Careers",
  "footer.links.privacy": "Privacy Policy",
  "footer.links.terms": "Terms of Service",
  "footer.links.security": "Security",

  // Theme switcher
  "theme.label": "Theme",
  "theme.light": "Light",
  "theme.dark": "Dark",
  "theme.system": "Match system",

  // Pricing page (/pricing) — the grid read live from the Plan table.
  //
  // Separate from the pricing.* card keys above: those describe ONE plan card
  // as it appears in the signup flow, these are the page around them.
  "pricingPage.title": "Simple, transparent pricing",
  "pricingPage.subtitle":
    "Every plan includes quotes, invoicing and scheduling. Pick the plan that matches the size of your team.",
  "pricingPage.perMonth": "/month",
  // A Plan row stores ONE number and Stripe charges it in the company's own
  // currency, so 700 means 700 CAD or 700 USD depending on where you are.
  // Naming the currency is the difference between a price and a guess — see
  // the header of lib/currency.js.
  "pricingPage.currencyNote":
    "All prices are in {currency}. Your billing currency is set by the country you choose when you sign up.",
  "pricingPage.taxNote": "Plus applicable taxes.",
  "pricingPage.emptyTitle":
    "Pricing plans are being finalised — check back shortly.",
  "pricingPage.emptyCta": "Ask us about early access pricing",

  // 404
  "notFound.title": "We can't find that page",
  "notFound.body":
    "The link may be broken, or the page may have moved. Long links get cut in half by text messages more often than you'd think — check you have the whole address.",
  "notFound.home": "Back to home",

  // Shared
  "common.loading": "Loading…",
  "common.learnMore": "Learn more",
  "common.getStarted": "Get started",
  "common.back": "Back",

  // ── Feature names, from lib/marketing/featureMatrix.js ──────────────────
  //
  // The Ukrainian /pricing page printed its group headings in Ukrainian and
  // every feature under them in English, because the headings come from here
  // and the names came from the matrix — an English data module, deliberately,
  // so check:translations does not gate a file whose job is to carry proof
  // paths rather than copy.
  //
  // lib/marketing/featureLabels.js is the seam. It asks t() for these keys and
  // falls back to the matrix's own English, so a language with no entry prints
  // the proved sentence rather than a raw key.
  //
  // This English block is a DUPLICATE of the matrix on purpose: the coverage
  // check compares every language against the keys of English, so a key present
  // in Ukrainian and absent here is reported as "not in English" and fails the
  // run. scripts/check-feature-labels.mjs pins every string below to be
  // character-identical to the matrix's, so the copy cannot rot into a second,
  // unproved wording.
  "feature.leads.name": "Lead tracking",
  "feature.leads.summary":
    "Every enquiry in one list, scored hot to cold, with a one-click turn into a quote.",
  "feature.lead_form.name": "Lead form for your website",
  "feature.lead_form.summary":
    "A form you can drop on any site; what comes back lands in your leads list, not an inbox.",
  "feature.quotes.name": "Quotes",
  "feature.quotes.summary":
    "Build a quote from your own rates, group it by room or scope, and add photos.",
  "feature.priced_options.name": "Good, better, best options",
  "feature.priced_options.summary":
    "Send one job at three prices and let the client pick the one they want.",
  "feature.quote_send.name": "Send a quote by email",
  "feature.quote_send.summary":
    "One button emails the quote from your address, with the PDF attached, in the client's language.",
  "feature.quote_pdf.name": "Quote PDF in your colours",
  "feature.quote_pdf.summary":
    "A PDF that carries your logo and brand colour — nothing on it says FieldQuo.",
  "feature.online_approval.name": "Client approves and signs online",
  "feature.online_approval.summary":
    "The client opens a link, picks any extras, signs, and the job is on — no printing, no phone tag.",
  "feature.ai_quote_review.name": "AI quote review",
  "feature.ai_quote_review.summary":
    "Before you send it: what you forgot, how the price sits against the ones you have won, and clearer wording.",
  "feature.add_on_upsell.name": "Suggested add-ons",
  "feature.add_on_upsell.summary":
    "Optional extras at the bottom of the quote, priced from your own history, that the client can tick.",
  "feature.follow_ups.name": "Automatic follow-ups",
  "feature.follow_ups.summary":
    "A quote that goes quiet gets chased on your schedule, in your words, without you remembering.",
  "feature.voice_receptionist.name": "AI receptionist",
  "feature.voice_receptionist.summary":
    "Answers your phone when you are on a ladder, takes the details, books the visit, and leaves you the recording.",
  "feature.voice_callbacks.name": "Confirmation calls",
  "feature.voice_callbacks.summary":
    "The assistant rings ahead to confirm tomorrow's appointments so you do not lose the morning to no-shows.",
  "feature.call_to_quote.name": "Quote drafted from the call",
  "feature.call_to_quote.summary":
    "What the caller described comes back as a draft quote you open, correct and send.",
  "feature.booking_page.name": "Online booking page",
  "feature.booking_page.summary":
    "Clients pick a slot from your real availability, with travel time and arrival windows built in.",
  "feature.booking_deposit.name": "Take a deposit to hold the slot",
  "feature.booking_deposit.summary":
    "Charge a visit fee at booking and credit it against the invoice when the work goes ahead.",
  "feature.website_builder.name": "Your own website",
  "feature.website_builder.summary":
    "A site written from what you already told us, on your own address, that you can edit block by block.",
  "feature.instant_quotes.name": "Instant online estimate",
  "feature.instant_quotes.summary":
    "A visitor answers a few questions and gets a price range on the spot, from rates you set.",
  "feature.self_quote.name": "Clients can price their own job",
  "feature.self_quote.summary":
    "A public form where a homeowner describes the work and uploads photos; it arrives as a started quote.",
  "feature.kitchen_designer.name": "Kitchen and cabinet designer",
  "feature.kitchen_designer.summary":
    "Draw the run, pick the finishes, and the cabinet prices and the floor plan go straight into the quote.",
  "feature.aerial_measure.name": "Measure from the sky",
  "feature.aerial_measure.summary":
    "Type the address and get roof area and pitch, or trace a driveway or patio, without going out there.",
  "feature.funnels.name": "Lead funnels",
  "feature.funnels.summary":
    "Multi-step landing pages for an ad or a flyer, with numbers on where people drop out.",
  "feature.email_campaigns.name": "Email campaigns",
  "feature.email_campaigns.summary":
    "Write once, send to your client list from your own address, and see who it reached.",
  "feature.door_hanger_routes.name": "Door-hanger routes",
  "feature.door_hanger_routes.summary":
    "Plan the streets, assign them, and tick off the stops as your crew works the neighbourhood.",
  "feature.review_requests.name": "Review requests",
  "feature.review_requests.summary":
    "After the job is done and paid, the client gets one polite ask for a review.",
  "feature.testimonials.name": "Testimonials on your site",
  "feature.testimonials.summary":
    "Collect what clients said and show it on your website and in your quotes.",
  "feature.referrals.name": "Refer another contractor",
  "feature.referrals.summary":
    "Send an invite; when they sign up you both get a free month added to your account.",
  "feature.embeds.name": "Drop-in widgets",
  "feature.embeds.summary":
    "Paste one line into any website you already have to embed your booking, quote form or reviews.",
  "feature.bio_link.name": "One link for your profiles",
  "feature.bio_link.summary":
    "A single branded page for your Instagram or truck decal that points at everything you offer.",
  "feature.subcontractor_bids.name": "Subcontractor prices in your bid",
  "feature.subcontractor_bids.summary":
    "Pull a sub's quote straight into yours as a cost, mark it up, and your client sees only your price.",
  "feature.jobs.name": "Jobs",
  "feature.jobs.summary":
    "An approved quote becomes a job with the scope, the address and the paperwork already on it.",
  "feature.scheduling.name": "Scheduling and dispatch",
  "feature.scheduling.summary":
    "Put visits on the calendar, assign the person going, and see the whole crew's week at once.",
  "feature.crew_shifts.name": "Crew shifts",
  "feature.crew_shifts.summary":
    "Build next week's rota, publish it, and everyone sees their own shifts.",
  "feature.recurring_jobs.name": "Repeat jobs",
  "feature.recurring_jobs.summary":
    "Weekly, monthly or seasonal work that puts itself back on the calendar.",
  "feature.appointment_reminders.name": "Appointment reminders",
  "feature.appointment_reminders.summary":
    "The client gets a text before you arrive, so fewer doors are locked when you get there.",
  "feature.client_reschedule.name": "Clients reschedule themselves",
  "feature.client_reschedule.summary":
    "A link in the confirmation lets the client move the visit without ringing you.",
  "feature.job_costing.name": "Job costing",
  "feature.job_costing.summary":
    "Labour, materials and expenses against the price you quoted, so you know what you actually made.",
  "feature.materials.name": "Materials on the job",
  "feature.materials.summary":
    "What went on site, what it cost, and what is still to buy.",
  "feature.job_photos.name": "Before and after photos",
  "feature.job_photos.summary":
    "Photos filed against the job, ready to go into the quote, the invoice or your website.",
  "feature.checklists.name": "Job checklists",
  "feature.checklists.summary":
    "A list of what has to be done on site, ticked off by the person doing it.",
  "feature.suggested_tasks.name": "Suggested next steps",
  "feature.suggested_tasks.summary":
    "The job proposes the tasks a job like this usually needs, so nothing gets forgotten.",
  "feature.tasks.name": "To-do list",
  "feature.tasks.summary":
    "Everything that needs chasing, sorted by what will hurt most if you leave it.",
  "feature.work_areas.name": "Work areas",
  "feature.work_areas.summary":
    "Break a big job into rooms or zones and hand each one to a different person.",
  "feature.time_clock.name": "Clock in and out",
  "feature.time_clock.summary":
    "Crew clock on against the job they are on, from whatever phone they have.",
  "feature.timesheets.name": "Timesheets you approve",
  "feature.timesheets.summary":
    "Hours land tied to real jobs; you approve them before they can turn into pay.",
  "feature.crew_inbox.name": "Crew inbox",
  "feature.crew_inbox.summary":
    "Your crew text photos and updates to one number and they file themselves against the right job.",
  "feature.time_off.name": "Time off and holidays",
  "feature.time_off.summary":
    "Requests go to the right manager, balances build up on their own, and the calendar knows.",
  "feature.invoices.name": "Invoices",
  "feature.invoices.summary":
    "An approved quote turns into an invoice that looks like the quote, because it is built from it.",
  "feature.invoice_send.name": "Send an invoice",
  "feature.invoice_send.summary":
    "Emailed from your address with the PDF attached and a pay-now link inside.",
  "feature.invoice_changes.name": "Changed invoices, tracked",
  "feature.invoice_changes.summary":
    "Amend an issued invoice and the old one is kept, so there is never a question about what was agreed.",
  "feature.card_payments.name": "Get paid by card",
  "feature.card_payments.summary":
    "The client pays from their phone and the money goes to your account, not ours.",
  "feature.stripe_connect.name": "Your own payout account",
  "feature.stripe_connect.summary":
    "Connect your bank once; every client payment settles into it directly.",
  "feature.financing.name": "Let clients pay monthly",
  "feature.financing.summary":
    "Turn on pay-over-time at checkout for the big jobs homeowners put off.",
  "feature.service_plans.name": "Maintenance plans",
  "feature.service_plans.summary":
    "Sign a client up to a recurring plan and the card is charged on schedule without you asking.",
  "feature.client_portal.name": "Client portal",
  "feature.client_portal.summary":
    "One link where a client sees their quotes, invoices and what they still owe.",
  "feature.sales_tax.name": "Sales tax that matches the address",
  "feature.sales_tax.summary":
    "Set your rates once; the right one lands on the document for where the work is.",
  "feature.dashboard.name": "Dashboard",
  "feature.dashboard.summary":
    "What is quoted, won, scheduled and owed, on one screen, as of this morning.",
  "feature.break_even.name": "Your break-even price",
  "feature.break_even.summary":
    "What a day has to bring in before you make a cent, worked out from your real overhead.",
  "feature.benchmark.name": "How your prices compare",
  "feature.benchmark.summary":
    "Where your rates and your win rate sit against other shops in your trade — nobody named, including you.",
  "feature.monthly_digest.name": "Monthly write-up",
  "feature.monthly_digest.summary":
    "Once a month, your numbers explained in sentences instead of charts.",
  "feature.goals.name": "Revenue goal",
  "feature.goals.summary":
    "Set a target for the year and see how far ahead or behind you are.",
  "feature.expenses.name": "Expenses and overhead",
  "feature.expenses.summary":
    "Record what you spend, split what belongs to a job from what belongs to the business.",
  "feature.marketing_spend.name": "What your advertising is worth",
  "feature.marketing_spend.summary":
    "Log what you spend by channel — including an automatic import from Meta Ads — and see a blended cost per lead across everything you do to bring in work.",
  "feature.marketing_spend.limits":
    "Cost per lead is blended across every channel, not broken out per channel or per campaign — nothing in FieldQuo links a specific dollar of spend to a specific lead yet.",
  "feature.payroll.name": "Payroll",
  "feature.payroll.summary":
    "Approved hours become a pay run with payslips you can hand over or export for your accountant.",
  "feature.contractor_payouts.name": "Pay contractors from the app",
  "feature.contractor_payouts.summary":
    "Approved hours for someone on your roster marked as a contractor go out as a real transfer to their bank.",
  "feature.price_book.name": "Your price book",
  "feature.price_book.summary":
    "Your services and rates in one place, importable from a spreadsheet and exportable back out.",
  "feature.material_costs.name": "Material costs and recipes",
  "feature.material_costs.summary":
    "What a litre of paint or a sheet of ply costs you, and how much of it a job of this size eats.",
  "feature.team_access.name": "Team roles and access",
  "feature.team_access.summary":
    "Decide, dial by dial, what each person can see and change — and it holds on the server, not just on screen.",
  "feature.white_label.name": "Everything carries your name",
  "feature.white_label.summary":
    "Your logo and your colour on every quote, invoice, page and email a homeowner sees.",
  "feature.own_email_domain.name": "Email from your own address",
  "feature.own_email_domain.summary":
    "Verify your domain once and everything goes out from you, not from a shared address.",
  "feature.quote_email_wording.name": "Write your own covering email",
  "feature.quote_email_wording.summary":
    "Change what the quote email says, section by section, and it stays in the language the quote was written in.",
  "feature.document_layouts.name": "Your own quote and invoice layout",
  "feature.document_layouts.summary":
    "Choose which sections appear on the printed document, and which one is the default.",
  "feature.contract_terms.name": "Your terms on every document",
  "feature.contract_terms.summary":
    "Payment terms and contract wording that attach themselves to what you send.",
  "feature.languages.name": "English and French",
  "feature.languages.summary":
    "Send a quote in the language your client speaks; a signed document keeps the words it was signed with.",
  "feature.ai_copilot.name": "Ask FieldQuo AI",
  "feature.ai_copilot.summary":
    "Ask a question about your own business in plain English and get the answer from your own numbers.",
  "feature.activity_log.name": "Who changed what",
  "feature.activity_log.summary":
    "A running record of every send, edit and approval, with a name and a time against it.",
  "feature.clients.name": "Client list",
  "feature.clients.summary":
    "Every client, their properties and their history, imported from wherever it lives now.",
};

const fr = {
  "nav.features": "Fonctionnalités",
  "nav.product": "Produit",
  "nav.pricing": "Tarifs",
  "pricing.group.winning": "Décrocher le contrat",
  "pricing.group.doing": "Réaliser le travail",
  "pricing.group.paid": "Se faire payer",
  "pricing.group.running": "Gérer l'entreprise",
  "pricing.includedTitle": "Tout est inclus dans chaque forfait",
  "pricing.includedBody": "Aucun palier ne débloque le calcul de rentabilité, aucune mise à niveau pour l'IA, aucun supplément pour encaisser. Les forfaits ne diffèrent que par le nombre de personnes — rien d'autre.",
  "pricing.includedMore": "Ceci est la liste courte. Voir tout ce que FieldQuo fait →",
  "nav.allFeatures": "Toutes les fonctions",
  "nav.compare": "Comparer",
  "nav.savings": "Économies",
  "nav.glossary": "Lexique du métier",
  "product.allFeatures.label": "Toutes les fonctions",
  "product.allFeatures.desc": "Chaque partie de FieldQuo, et ce qu'elle vous apporte",
  "product.compare.label": "Comparer",
  "product.compare.desc": "FieldQuo face à Jobber, Housecall Pro, ServiceTitan et Projul",
  "nav.industries": "Secteurs",
  "nav.resources": "Ressources",
  "nav.contact": "Contact",
  "nav.login": "Connexion",
  "nav.signup": "Essai gratuit",
  "nav.dashboard": "Aller au tableau de bord",

  "product.quoting.label": "Soumissions et facturation",
  "product.quoting.description":
    "Préparez et envoyez des soumissions professionnelles en quelques minutes",
  "product.scheduling.label": "Planification et répartition",
  "product.scheduling.description":
    "Réservation en ligne, rendez-vous et attribution des chantiers",
  "product.team.label": "Équipe et paie",
  "product.team.description":
    "Feuilles de temps, versements aux sous-traitants, accès par rôle",
  "product.analytics.label": "Analytique et IA",
  "product.analytics.description":
    "Connaissez vos chiffres — et quoi en faire",

  "hero.title":
    "Soumissions, factures et planification pour les équipes de terrain",
  "hero.subtitle":
    "Préparez une soumission sur place, envoyez-la avant de quitter le stationnement, et faites-vous payer sans relancer personne.",
  "hero.cta": "Essai gratuit",
  "hero.ctaSecondary": "Voir comment ça marche",
  "hero.noCard": "Aucune carte de crédit requise",
  "hero.emailPlaceholder": "vous@votreentreprise.com",
  "hero.requestDemo": "Demander une démo",
  "hero.demo.title": "Réservez une démo de 30 minutes",
  "hero.demo.openCta": "Réserver une démo ou un rappel",
  "hero.demo.openHint": "30 minutes, en direct, sans diapositives. Ou laissez votre numéro et nous vous rappellerons.",
  "hero.demo.close": "Fermer",
  "hero.demo.modeSlot": "Choisir un créneau",
  "hero.demo.modeCallback": "Rappelez-moi",
  "hero.demo.phone": "Numéro de téléphone",
  "hero.demo.whenBest": "Meilleur moment pour vous joindre (facultatif)",
  "hero.demo.requestCallback": "Demander un rappel",
  "hero.demo.callbackSent": "C'est noté — nous vous appellerons sous peu.",
  "hero.demo.callbackBody": "Nous appellerons le {phone}. Si nous vous manquons, nous écrirons à {email}.",
  "hero.demo.subtitle": "Choisissez un créneau et nous vous ferons découvrir FieldQuo en direct.",
  "hero.demo.loading": "Chargement des créneaux…",
  "hero.demo.noSlots": "Aucun créneau libre pour le moment — écrivez à hello@fieldquo.com et nous en trouverons un.",
  "hero.demo.name": "Votre nom",
  "hero.demo.email": "Courriel professionnel",
  "hero.demo.company": "Entreprise (facultatif)",
  "hero.demo.pickSlot": "Choisissez un créneau ci-dessus",
  "hero.demo.confirmWithTime": "Confirmer {time}",
  "hero.demo.confirmedTitle": "C'est réservé !",
  "hero.demo.confirmedBody": "Consultez {email} pour votre invitation au calendrier. À bientôt, {when}.",
  "hero.demo.genericError": "Une erreur s'est produite — veuillez réessayer.",
  "hero.sending": "Envoi…",
  "hero.demoThanks":
    "Merci — nous vous contacterons sous peu pour organiser votre démo.",
  "hero.tabs.quotes.label": "Soumissions",
  "hero.tabs.quotes.headline":
    "Envoyez une soumission professionnelle en minutes, pas en heures",
  "hero.tabs.quotes.body":
    "Créez des soumissions avec vos propres prix, catégories de services et photos — le client approuve en ligne, sans échanges interminables.",
  "hero.tabs.quotes.alt": "Un entrepreneur prépare une soumission sur tablette devant la maison d'une cliente, qui la consulte sur son téléphone",
  "hero.tabs.scheduling.label": "Planification",
  "hero.tabs.scheduling.headline":
    "Laissez vos clients réserver directement depuis votre site",
  "hero.tabs.scheduling.body":
    "Une page de réservation qui affiche vos vraies disponibilités, assigne la bonne personne et confirme automatiquement.",
  "hero.tabs.scheduling.alt": "Une cliente choisit un créneau de rendez-vous sur la page de réservation d'un entrepreneur, depuis son téléphone",
  "hero.tabs.invoicing.label": "Facturation",
  "hero.tabs.invoicing.headline": "Faites-vous payer sans relancer personne",
  "hero.tabs.invoicing.body":
    "Transformez une soumission acceptée en facture en un clic, et laissez le client payer en ligne dès sa réception.",
  "hero.tabs.invoicing.alt": "Un client consulte une soumission sur son téléphone, avec un bouton d'approbation en bas",
  "hero.tabs.analytics.label": "Analytique",
  "hero.tabs.analytics.headline":
    "Sachez quoi facturer, au lieu de deviner",
  "hero.tabs.analytics.body":
    "Voyez vos vrais frais généraux, votre prix minimum par chantier, et votre position face aux autres entreprises de votre métier.",
  "hero.tabs.analytics.alt": "Un tableau de bord affichant le coût par chantier, le prix minimum et la comparaison de vos prix moyens avec ceux d'autres entreprises de votre métier",

  "features.title": "Tout ce qu'il faut pour gérer le chantier",
  "features.quotes.title": "Des soumissions en minutes",
  "features.quotes.body":
    "Tarifez à partir de votre propre catalogue, ajoutez des photos, et envoyez une soumission que votre client approuve depuis son téléphone.",
  "features.invoices.title": "Des factures qui se règlent",
  "features.invoices.body":
    "Convertissez une soumission approuvée en facture en un clic, acceptez les paiements par carte, et suivez les sommes dues.",
  "features.scheduling.title": "Une planification fiable",
  "features.scheduling.body":
    "Planifiez les chantiers, assignez les équipes, et laissez vos clients choisir une plage selon vos vraies disponibilités.",
  "features.followups.title": "Relances automatiques",
  "features.followups.body":
    "Les soumissions sans réponse et les factures en retard sont relancées automatiquement, dans vos mots.",

  "pricing.title": "Tarification simple et transparente",
  "pricing.subtitle":
    "Chaque forfait comprend les soumissions, la facturation et la planification. Choisissez celui qui correspond à la taille de votre équipe.",
  "pricing.month": "/mois",
  "pricing.cta": "Essai gratuit",
  "pricing.empty":
    "Les forfaits sont en cours de finalisation — revenez bientôt, ou contactez-nous pour un tarif d'accès anticipé.",

  "contact.title": "Parlez-nous",
  "contact.subtitle":
    "Questions sur le produit, les tarifs ou la migration de vos données.",
  "contact.name": "Votre nom",
  "contact.email": "Courriel",
  "contact.message": "Message",
  "contact.send": "Envoyer",
  "contact.sending": "Envoi…",
  "contact.sent": "Merci — nous vous répondrons sous peu.",
  "contact.error": "Une erreur est survenue. Réessayez ou écrivez-nous directement.",

  "booking.work.serviceLabel": "De quel type de travaux s'agit-il ?",
  "booking.work.serviceUnsure": "Je ne sais pas encore",
  "booking.work.notesLabel": "Autre chose à nous signaler ?",
  "booking.work.notesPlaceholder":
    "Ce qu'il y a à faire, l'ampleur approximative, tout ce qui sort de l'ordinaire…",
  "booking.work.notesHint": "Facultatif — cela nous permet d'arriver préparés.",

  "features.everything":
    "Tout ce dont votre entreprise a besoin, au même endroit",
  "features.anyTrade": "Conçu pour tous les métiers",

  "ai.badge": "IA FieldQuo",
  "ai.title": "Posez une question à votre entreprise, obtenez une vraie réponse",
  "ai.body":
    "Le copilote lit vos propres soumissions, factures et dépenses — pas des conseils génériques. Demandez où en est votre taux de conversion ce mois-ci, ou si les matériaux coûtaient moins cher le mois dernier, et obtenez une réponse fondée sur vos vrais chiffres.",
  "ai.samples.pricing":
    "« Est-ce que je facture trop peu par rapport au trimestre dernier? »",
  "ai.samples.topClients":
    "« Quels clients ont payé le plus cette année? »",
  "ai.samples.materials":
    "« Devrais-je faire des réserves de matériaux maintenant? »",
  "ai.chat.question": "Où en est mon taux de conversion ce mois-ci?",
  "ai.chat.answer":
    "Vous avez envoyé 14 soumissions et 6 ont été acceptées — un taux de conversion de 43 %, en hausse par rapport à 31 % le mois dernier. Vos soumissions de peinture convertissent le mieux.",

  "resources.title": "Ressources gratuites",
  "resources.help.description":
    "Guides pour configurer et utiliser FieldQuo",
  "resources.faq.description": "Réponses rapides aux questions courantes",
  "resources.contact.description": "Parlez à une vraie personne",

  "pricing.popular": "Le plus populaire",
  "pricing.selected": "Sélectionné",
  "pricing.firstMonth": "Premier mois",
  "pricing.free": "Gratuit",
  "pricing.then": "Ensuite",
  "pricing.perMonthShort": "/mois",
  "pricing.seatsUnlimited": "Comptes employés illimités",
  "pricing.seatsOne": "1 compte employé",
  "pricing.seatsMany": "{count} comptes employés",
  "pricing.rbacSeats": "1 compte principal + {count} accès par rôle",
  "pricing.crewIncluded": "{count} équipiers inclus — gratuitement",
  "pricing.seatsOneIncluded": "1 siège — soumissions, contrats et facturation",
  "pricing.seatsManyIncluded": "{count} sièges — soumissions, contrats et facturation",
  "pricingPage.currencyBasis": "Un seul jeu de prix. La devise facturée découle de l'adresse d'entreprise fournie à l'inscription : les entreprises canadiennes sont facturées en dollars canadiens, les américaines en dollars américains — le même montant, pas une conversion.",
  "pricing.fullAccess":
    "Accès complet — soumissions, facturation, planification, analytique",
  "pricing.quoteLimit": "Jusqu'à {count} soumissions par mois",
  "pricing.aiIncluded": "IA FieldQuo incluse",

  "faq.title": "Questions fréquentes",
  "faq.items.install.q": "Dois-je installer quelque chose?",
  "faq.items.install.a":
    "Non — FieldQuo fonctionne entièrement dans votre navigateur. Vous pouvez aussi y accéder depuis votre téléphone.",
  "faq.items.onlinePayment.q":
    "Mes clients peuvent-ils payer leurs factures en ligne?",
  "faq.items.onlinePayment.a":
    "Oui. Connectez votre propre compte Stripe et vos clients paient directement depuis le courriel de facture — l'argent vous revient directement.",
  "faq.items.financing.q": "Mes clients peuvent-ils payer en plusieurs fois?",
  "faq.items.financing.a":
    "Oui. Activez Affirm dans Paramètres → Paiements et vos clients peuvent régler une facture en versements mensuels au moment du paiement, pendant que vous êtes payé intégralement et d'avance.",
  "faq.items.permissions.q":
    "Puis-je contrôler ce que mes employés voient et font?",
  "faq.items.permissions.a":
    "Oui. Chaque membre de l'équipe a un rôle — employé, superviseur ou administrateur — qui détermine ce qu'il peut créer, assigner et consulter.",
  "faq.items.trade.q": "Et si mon métier n'est pas dans la liste?",
  "faq.items.trade.a":
    "FieldQuo convient à toute entreprise de construction ou de services à domicile. Vous pouvez activer ou désactiver des catégories de services et fixer vos propres prix, peu importe le métier.",
  "faq.items.contract.q": "Y a-t-il un contrat ou un engagement à long terme?",
  "faq.items.contract.a":
    "Non. Les forfaits sont mensuels — annulez quand vous voulez.",

  "footer.product": "Produit",
  "footer.company": "Entreprise",
  "footer.legal": "Légal",
  "footer.privacy": "Confidentialité",
  "footer.terms": "Conditions",
  "footer.security": "Sécurité",
  "footer.rights": "Tous droits réservés.",
  "footer.tagline":
    "La plateforme tout-en-un pour les entrepreneurs et les services à domicile — soumissions, planification, facturation et paiements au même endroit.",
  "footer.links.help": "Centre d'aide",
  "footer.links.faq": "FAQ",
  "footer.links.blog": "Blogue",
  "footer.links.contact": "Nous joindre",
  "footer.links.about": "À propos",
  "footer.links.careers": "Carrières",
  "footer.links.privacy": "Politique de confidentialité",
  "footer.links.terms": "Conditions d'utilisation",
  "footer.links.security": "Sécurité",

  "theme.label": "Thème",
  "theme.light": "Clair",
  "theme.dark": "Sombre",
  "theme.system": "Selon le système",

  "pricingPage.title": "Une tarification simple et transparente",
  "pricingPage.subtitle":
    "Chaque forfait comprend les soumissions, la facturation et la planification. Choisissez le forfait qui correspond à la taille de votre équipe.",
  "pricingPage.perMonth": "/mois",
  "pricingPage.currencyNote":
    "Tous les prix sont en {currency}. Votre devise de facturation est déterminée par le pays que vous choisissez à l'inscription.",
  "pricingPage.taxNote": "Taxes en sus.",
  "pricingPage.emptyTitle":
    "Les forfaits sont en cours de finalisation — revenez bientôt.",
  "pricingPage.emptyCta": "Demandez-nous les tarifs d'accès anticipé",

  "notFound.title": "Page introuvable",
  "notFound.body":
    "Le lien est peut-être brisé, ou la page a été déplacée. Les messages texte coupent les longs liens en deux plus souvent qu'on ne le pense — vérifiez que vous avez l'adresse complète.",
  "notFound.home": "Retour à l'accueil",

  "common.loading": "Chargement…",
  "common.learnMore": "En savoir plus",
  "common.getStarted": "Commencer",
  "common.back": "Retour",

  // ── Feature names, from lib/marketing/featureMatrix.js ──────────────────
  //
  // Trade terms, not software words. Where the trade has its own word in this
  // language it is used in preference to a translation of the English one.
  // Where the trade genuinely says the English word, the loanword stays and
  // scripts/check-feature-labels.mjs carries the exemption with a reason, so
  // an untranslated line cannot hide behind that argument.
  "feature.leads.name": "Suivi des demandes",
  "feature.leads.summary":
    "Toutes les demandes dans une seule liste, classées de chaudes à froides, converties en soumission en un clic.",
  "feature.lead_form.name": "Formulaire de demande pour votre site",
  "feature.lead_form.summary":
    "Un formulaire à installer sur n'importe quel site; les réponses arrivent dans votre liste de demandes, pas dans un courriel.",
  "feature.quotes.name": "Soumissions",
  "feature.quotes.summary":
    "Bâtissez une soumission à partir de vos propres tarifs, regroupez-la par pièce ou par lot, et ajoutez des photos.",
  "feature.priced_options.name": "Options bon, meilleur, excellent",
  "feature.priced_options.summary":
    "Envoyez un même chantier à trois prix et laissez le client choisir celui qu'il veut.",
  "feature.quote_send.name": "Envoyer une soumission par courriel",
  "feature.quote_send.summary":
    "Un bouton envoie la soumission depuis votre adresse, PDF en pièce jointe, dans la langue du client.",
  "feature.quote_pdf.name": "Soumission PDF à vos couleurs",
  "feature.quote_pdf.summary":
    "Un PDF qui porte votre logo et votre couleur — rien dessus ne dit FieldQuo.",
  "feature.online_approval.name": "Le client approuve et signe en ligne",
  "feature.online_approval.summary":
    "Le client ouvre un lien, choisit ses extras, signe, et le chantier est parti — sans impression ni parties de téléphone.",
  "feature.ai_quote_review.name": "Révision de la soumission par l'IA",
  "feature.ai_quote_review.summary":
    "Avant l'envoi : ce que vous avez oublié, où se situe le prix par rapport à vos contrats gagnés, et une formulation plus claire.",
  "feature.add_on_upsell.name": "Extras suggérés",
  "feature.add_on_upsell.summary":
    "Des options au bas de la soumission, tarifées d'après votre historique, que le client peut cocher.",
  "feature.follow_ups.name": "Relances automatiques",
  "feature.follow_ups.summary":
    "Une soumission sans réponse est relancée selon votre calendrier, dans vos mots, sans que vous y pensiez.",
  "feature.voice_receptionist.name": "Réceptionniste IA",
  "feature.voice_receptionist.summary":
    "Répond au téléphone quand vous êtes dans l'échelle, prend les détails, fixe la visite et vous laisse l'enregistrement.",
  "feature.voice_callbacks.name": "Appels de confirmation",
  "feature.voice_callbacks.summary":
    "L'assistant appelle d'avance pour confirmer les rendez-vous du lendemain, pour ne pas perdre l'avant-midi sur des absents.",
  "feature.call_to_quote.name": "Soumission rédigée à partir de l'appel",
  "feature.call_to_quote.summary":
    "Ce que l'appelant a décrit revient en brouillon de soumission que vous ouvrez, corrigez et envoyez.",
  "feature.booking_page.name": "Page de réservation en ligne",
  "feature.booking_page.summary":
    "Les clients choisissent un créneau selon vos vraies disponibilités, temps de déplacement et plages d'arrivée compris.",
  "feature.booking_deposit.name": "Acompte pour réserver le créneau",
  "feature.booking_deposit.summary":
    "Facturez des frais de visite à la réservation et créditez-les sur la facture quand le travail se fait.",
  "feature.website_builder.name": "Votre propre site web",
  "feature.website_builder.summary":
    "Un site rédigé à partir de ce que vous nous avez déjà dit, à votre propre adresse, modifiable bloc par bloc.",
  "feature.instant_quotes.name": "Estimation en ligne instantanée",
  "feature.instant_quotes.summary":
    "Un visiteur répond à quelques questions et obtient une fourchette de prix sur-le-champ, selon vos tarifs.",
  "feature.self_quote.name": "Le client chiffre lui-même son projet",
  "feature.self_quote.summary":
    "Un formulaire public où le propriétaire décrit les travaux et téléverse des photos; ça arrive en soumission déjà commencée.",
  "feature.kitchen_designer.name": "Concepteur de cuisines et d'armoires",
  "feature.kitchen_designer.summary":
    "Dessinez la rangée, choisissez les finis, et le prix des armoires et le plan passent directement dans la soumission.",
  "feature.aerial_measure.name": "Mesurer depuis le ciel",
  "feature.aerial_measure.summary":
    "Tapez l'adresse et obtenez la superficie et la pente du toit, ou tracez une entrée ou un patio, sans vous déplacer.",
  "feature.funnels.name": "Entonnoirs de demandes",
  "feature.funnels.summary":
    "Des pages en plusieurs étapes pour une annonce ou un dépliant, avec les chiffres sur les abandons.",
  "feature.email_campaigns.name": "Campagnes par courriel",
  "feature.email_campaigns.summary":
    "Écrivez une fois, envoyez à votre liste de clients depuis votre adresse, et voyez qui l'a reçu.",
  "feature.door_hanger_routes.name": "Tournées de porte-à-porte",
  "feature.door_hanger_routes.summary":
    "Planifiez les rues, assignez-les, et cochez les arrêts pendant que votre équipe fait le quartier.",
  "feature.review_requests.name": "Demandes d'avis",
  "feature.review_requests.summary":
    "Une fois le chantier fini et payé, le client reçoit une seule demande d'avis, poliment.",
  "feature.testimonials.name": "Témoignages sur votre site",
  "feature.testimonials.summary":
    "Recueillez ce que vos clients ont dit et affichez-le sur votre site et dans vos soumissions.",
  "feature.referrals.name": "Référez un autre entrepreneur",
  "feature.referrals.summary":
    "Envoyez une invitation; à son inscription, vous obtenez chacun un mois gratuit ajouté à votre compte.",
  "feature.embeds.name": "Modules à intégrer",
  "feature.embeds.summary":
    "Collez une ligne dans le site que vous avez déjà pour y intégrer votre réservation, votre formulaire ou vos avis.",
  "feature.bio_link.name": "Un seul lien pour vos profils",
  "feature.bio_link.summary":
    "Une page à votre image, pour votre Instagram ou le lettrage du camion, qui mène à tout ce que vous offrez.",
  "feature.subcontractor_bids.name": "Prix du sous-traitant dans la soumission",
  "feature.subcontractor_bids.summary":
    "Intégrez la soumission d'un sous-traitant comme coût, appliquez votre marge, et le client ne voit que votre prix.",
  "feature.jobs.name": "Chantiers",
  "feature.jobs.summary":
    "Une soumission approuvée devient un chantier avec la description, l'adresse et les documents déjà dessus.",
  "feature.scheduling.name": "Planification et répartition",
  "feature.scheduling.summary":
    "Placez les visites au calendrier, assignez la personne qui y va, et voyez la semaine de toute l'équipe d'un coup.",
  "feature.crew_shifts.name": "Quarts de l'équipe",
  "feature.crew_shifts.summary":
    "Bâtissez l'horaire de la semaine prochaine, publiez-le, et chacun voit ses propres quarts.",
  "feature.recurring_jobs.name": "Travaux récurrents",
  "feature.recurring_jobs.summary":
    "Des travaux hebdomadaires, mensuels ou saisonniers qui se replacent seuls au calendrier.",
  "feature.appointment_reminders.name": "Rappels de rendez-vous",
  "feature.appointment_reminders.summary":
    "Le client reçoit un texto avant votre arrivée, donc moins de portes barrées quand vous arrivez.",
  "feature.client_reschedule.name": "Le client se replanifie lui-même",
  "feature.client_reschedule.summary":
    "Un lien dans la confirmation permet au client de déplacer la visite sans vous appeler.",
  "feature.job_costing.name": "Coût de revient du chantier",
  "feature.job_costing.summary":
    "Main-d'oeuvre, matériaux et dépenses face au prix soumis, pour savoir ce que vous avez vraiment fait.",
  "feature.materials.name": "Matériaux sur le chantier",
  "feature.materials.summary":
    "Ce qui est allé sur le chantier, ce que ça a coûté, et ce qu'il reste à acheter.",
  "feature.job_photos.name": "Photos avant et après",
  "feature.job_photos.summary":
    "Des photos classées avec le chantier, prêtes pour la soumission, la facture ou votre site.",
  "feature.checklists.name": "Listes de vérification de chantier",
  "feature.checklists.summary":
    "La liste de ce qui doit être fait sur place, cochée par la personne qui le fait.",
  "feature.suggested_tasks.name": "Prochaines étapes suggérées",
  "feature.suggested_tasks.summary":
    "Le chantier propose les tâches qu'un chantier comme celui-là demande d'habitude, pour ne rien oublier.",
  "feature.tasks.name": "Liste de tâches",
  "feature.tasks.summary":
    "Tout ce qu'il faut relancer, trié selon ce qui fera le plus mal si vous le laissez traîner.",
  "feature.work_areas.name": "Zones de travail",
  "feature.work_areas.summary":
    "Découpez un gros chantier en pièces ou en zones et confiez chacune à une personne différente.",
  "feature.time_clock.name": "Pointage à l'arrivée et au départ",
  "feature.time_clock.summary":
    "L'équipe pointe sur le chantier où elle est, depuis le téléphone qu'elle a.",
  "feature.timesheets.name": "Feuilles de temps que vous approuvez",
  "feature.timesheets.summary":
    "Les heures arrivent rattachées à de vrais chantiers; vous les approuvez avant qu'elles deviennent de la paie.",
  "feature.crew_inbox.name": "Boîte de réception de l'équipe",
  "feature.crew_inbox.summary":
    "Votre équipe envoie photos et nouvelles par texto à un seul numéro, et ça se classe tout seul au bon chantier.",
  "feature.time_off.name": "Congés et vacances",
  "feature.time_off.summary":
    "Les demandes vont au bon responsable, les banques d'heures se remplissent seules, et le calendrier le sait.",
  "feature.invoices.name": "Factures",
  "feature.invoices.summary":
    "Une soumission approuvée devient une facture qui ressemble à la soumission, parce qu'elle en est faite.",
  "feature.invoice_send.name": "Envoyer une facture",
  "feature.invoice_send.summary":
    "Envoyée par courriel depuis votre adresse, PDF en pièce jointe et lien de paiement à l'intérieur.",
  "feature.invoice_changes.name": "Factures modifiées, avec l'historique",
  "feature.invoice_changes.summary":
    "Modifiez une facture émise et l'ancienne est conservée, pour qu'on ne discute jamais de ce qui a été convenu.",
  "feature.card_payments.name": "Encaissez par carte",
  "feature.card_payments.summary":
    "Le client paie depuis son téléphone et l'argent va dans votre compte, pas dans le nôtre.",
  "feature.stripe_connect.name": "Votre propre compte de versement",
  "feature.stripe_connect.summary":
    "Reliez votre banque une fois; chaque paiement client s'y dépose directement.",
  "feature.financing.name": "Laissez le client payer par mois",
  "feature.financing.summary":
    "Activez le paiement échelonné au moment de payer, pour les gros chantiers que les propriétaires reportent.",
  "feature.service_plans.name": "Forfaits d'entretien",
  "feature.service_plans.summary":
    "Inscrivez un client à un forfait récurrent et la carte est débitée à l'échéance sans que vous demandiez.",
  "feature.client_portal.name": "Portail client",
  "feature.client_portal.summary":
    "Un seul lien où le client voit ses soumissions, ses factures et ce qu'il doit encore.",
  "feature.sales_tax.name": "Taxes de vente selon l'adresse",
  "feature.sales_tax.summary":
    "Réglez vos taux une fois; le bon se retrouve sur le document selon l'endroit des travaux.",
  "feature.dashboard.name": "Tableau de bord",
  "feature.dashboard.summary":
    "Ce qui est soumissionné, gagné, planifié et dû, sur un seul écran, à ce matin.",
  "feature.break_even.name": "Votre seuil de rentabilité",
  "feature.break_even.summary":
    "Ce qu'une journée doit rapporter avant que vous fassiez un sou, calculé sur vos vrais frais fixes.",
  "feature.benchmark.name": "Où se situent vos prix",
  "feature.benchmark.summary":
    "Où vos tarifs et votre taux de succès se situent face aux autres entreprises de votre métier — personne n'est nommé, vous non plus.",
  "feature.monthly_digest.name": "Bilan mensuel",
  "feature.monthly_digest.summary":
    "Une fois par mois, vos chiffres expliqués en phrases plutôt qu'en graphiques.",
  "feature.goals.name": "Objectif de revenus",
  "feature.goals.summary":
    "Fixez une cible pour l'année et voyez de combien vous êtes en avance ou en retard.",
  "feature.expenses.name": "Dépenses et frais fixes",
  "feature.expenses.summary":
    "Notez ce que vous dépensez, en séparant ce qui appartient à un chantier de ce qui appartient à l'entreprise.",
  "feature.marketing_spend.name": "Ce que votre publicité vous rapporte",
  "feature.marketing_spend.summary":
    "Enregistrez vos dépenses par canal — avec une importation automatique depuis Meta Ads — et voyez un coût par prospect moyen sur tout ce que vous faites pour obtenir des contrats.",
  "feature.marketing_spend.limits":
    "Le coût par prospect est calculé en moyenne sur tous les canaux, sans détail par canal ni par campagne — rien dans FieldQuo ne relie encore un dollar de dépense précis à un prospect précis.",
  "feature.payroll.name": "Paie",
  "feature.payroll.summary":
    "Les heures approuvées deviennent une paie avec des bulletins à remettre ou à exporter pour votre comptable.",
  "feature.contractor_payouts.name": "Payer les sous-traitants dans l'appli",
  "feature.contractor_payouts.summary":
    "Les heures approuvées d'une personne de votre équipe marquée sous-traitant partent en virement réel vers sa banque.",
  "feature.price_book.name": "Votre grille de prix",
  "feature.price_book.summary":
    "Vos services et vos tarifs au même endroit, importables d'un tableur et exportables à nouveau.",
  "feature.material_costs.name": "Coûts des matériaux et dosages",
  "feature.material_costs.summary":
    "Ce que vous coûte un litre de peinture ou une feuille de contreplaqué, et combien un chantier de cette taille en avale.",
  "feature.team_access.name": "Rôles et accès de l'équipe",
  "feature.team_access.summary":
    "Décidez, cran par cran, ce que chaque personne peut voir et modifier — et ça tient sur le serveur, pas seulement à l'écran.",
  "feature.white_label.name": "Tout porte votre nom",
  "feature.white_label.summary":
    "Votre logo et votre couleur sur chaque soumission, facture, page et courriel que le client voit.",
  "feature.own_email_domain.name": "Courriels depuis votre propre adresse",
  "feature.own_email_domain.summary":
    "Vérifiez votre domaine une fois et tout part de chez vous, pas d'une adresse partagée.",
  "feature.quote_email_wording.name": "Votre propre courriel d'accompagnement",
  "feature.quote_email_wording.summary":
    "Changez ce que dit le courriel de soumission, section par section; il reste dans la langue de la soumission.",
  "feature.document_layouts.name": "Vos gabarits de soumission et de facture",
  "feature.document_layouts.summary":
    "Choisissez les sections qui paraissent sur le document imprimé, et laquelle est celle par défaut.",
  "feature.contract_terms.name": "Vos conditions sur chaque document",
  "feature.contract_terms.summary":
    "Les conditions de paiement et le texte du contrat s'attachent d'eux-mêmes à ce que vous envoyez.",
  "feature.languages.name": "Anglais et français",
  "feature.languages.summary":
    "Envoyez une soumission dans la langue de votre client; un document signé garde les mots avec lesquels il a été signé.",
  "feature.ai_copilot.name": "Demandez à FieldQuo AI",
  "feature.ai_copilot.summary":
    "Posez une question sur votre entreprise en langage courant et obtenez la réponse à partir de vos propres chiffres.",
  "feature.activity_log.name": "Qui a changé quoi",
  "feature.activity_log.summary":
    "Un registre continu de chaque envoi, modification et approbation, avec un nom et une heure.",
  "feature.clients.name": "Liste des clients",
  "feature.clients.summary":
    "Chaque client, ses propriétés et son historique, importés d'où qu'ils se trouvent aujourd'hui.",
};

const es = {
  "nav.features": "Funciones",
  "nav.product": "Producto",
  "nav.pricing": "Precios",
  "pricing.group.winning": "Conseguir el trabajo",
  "pricing.group.doing": "Hacer el trabajo",
  "pricing.group.paid": "Cobrar",
  "pricing.group.running": "Dirigir el negocio",
  "pricing.includedTitle": "Todo está en todos los planes",
  "pricing.includedBody": "No hay un nivel que desbloquee el control de costes, ni una mejora para la IA, ni un extra para cobrar. Los planes solo se diferencian por cuánta gente trabaja en ellos.",
  "pricing.includedMore": "Esta es la lista corta. Mira todo lo que hace FieldQuo →",
  "nav.allFeatures": "Todas las funciones",
  "nav.compare": "Comparar",
  "nav.savings": "Ahorro",
  "nav.glossary": "Glosario del oficio",
  "product.allFeatures.label": "Todas las funciones",
  "product.allFeatures.desc": "Cada parte de FieldQuo y lo que hace por ti",
  "product.compare.label": "Comparar",
  "product.compare.desc": "FieldQuo frente a Jobber, Housecall Pro, ServiceTitan y Projul",
  "nav.industries": "Sectores",
  "nav.resources": "Recursos",
  "nav.contact": "Contacto",
  "nav.login": "Iniciar sesión",
  "nav.signup": "Prueba gratis",
  "nav.dashboard": "Ir al panel",

  "product.quoting.label": "Presupuestos y facturación",
  "product.quoting.description":
    "Arma y envía presupuestos profesionales en minutos",
  "product.scheduling.label": "Agenda y despacho",
  "product.scheduling.description":
    "Reservas en línea, citas y asignación de trabajos",
  "product.team.label": "Equipo y nómina",
  "product.team.description":
    "Hojas de horas, pagos a contratistas, accesos por rol",
  "product.analytics.label": "Analítica e IA",
  "product.analytics.description": "Conoce tus números — y qué hacer con ellos",

  "hero.title":
    "Presupuestos, facturas y agenda para equipos de servicio en campo",
  "hero.subtitle":
    "Arma el presupuesto en el sitio, envíalo antes de salir, y cobra sin tener que perseguir a nadie.",
  "hero.cta": "Prueba gratis",
  "hero.ctaSecondary": "Ver cómo funciona",
  "hero.noCard": "No se requiere tarjeta",
  "hero.emailPlaceholder": "tu@tuempresa.com",
  "hero.requestDemo": "Solicitar una demo",
  "hero.demo.title": "Reserva una demo de 30 minutos",
  "hero.demo.openCta": "Reservar una demo o una llamada",
  "hero.demo.openHint": "30 minutos, en vivo, sin diapositivas. O deja tu número y te llamamos.",
  "hero.demo.close": "Cerrar",
  "hero.demo.modeSlot": "Elegir una hora",
  "hero.demo.modeCallback": "Llámame",
  "hero.demo.phone": "Número de teléfono",
  "hero.demo.whenBest": "Mejor momento para localizarte (opcional)",
  "hero.demo.requestCallback": "Solicitar una llamada",
  "hero.demo.callbackSent": "Listo — te llamaremos en breve.",
  "hero.demo.callbackBody": "Llamaremos al {phone}. Si no te encontramos, escribiremos a {email}.",
  "hero.demo.subtitle": "Elige una hora y te mostraremos FieldQuo en vivo.",
  "hero.demo.loading": "Cargando horarios…",
  "hero.demo.noSlots": "No hay horarios libres ahora mismo — escribe a hello@fieldquo.com y lo arreglamos.",
  "hero.demo.name": "Tu nombre",
  "hero.demo.email": "Correo de trabajo",
  "hero.demo.company": "Empresa (opcional)",
  "hero.demo.pickSlot": "Elige una hora arriba",
  "hero.demo.confirmWithTime": "Confirmar {time}",
  "hero.demo.confirmedTitle": "¡Reservado!",
  "hero.demo.confirmedBody": "Revisa {email} para tu invitación de calendario. Nos vemos {when}.",
  "hero.demo.genericError": "Algo salió mal — inténtalo de nuevo.",
  "hero.sending": "Enviando…",
  "hero.demoThanks":
    "Gracias — te contactaremos pronto para coordinar tu demo.",
  "hero.tabs.quotes.label": "Presupuestos",
  "hero.tabs.quotes.headline":
    "Envía un presupuesto profesional en minutos, no en horas",
  "hero.tabs.quotes.body":
    "Arma presupuestos con tus propios precios, categorías de servicio y fotos — el cliente aprueba en línea, sin idas y vueltas.",
  "hero.tabs.quotes.alt": "Un contratista prepara un presupuesto en una tableta frente a la casa de una clienta, que lo revisa en su teléfono",
  "hero.tabs.scheduling.label": "Agenda",
  "hero.tabs.scheduling.headline":
    "Deja que los clientes te reserven desde tu sitio web",
  "hero.tabs.scheduling.body":
    "Una página de reservas que muestra tu disponibilidad real, asigna a la persona correcta de tu equipo y confirma automáticamente.",
  "hero.tabs.scheduling.alt": "Una clienta elige la hora de una cita en la página de reservas de un contratista desde su teléfono",
  "hero.tabs.invoicing.label": "Facturación",
  "hero.tabs.invoicing.headline": "Cobra sin tener que perseguir a nadie",
  "hero.tabs.invoicing.body":
    "Convierte un presupuesto aprobado en factura con un clic, y deja que el cliente pague en línea apenas lo recibe.",
  "hero.tabs.invoicing.alt": "Un cliente lee un presupuesto en su teléfono, con un botón de aprobación abajo",
  "hero.tabs.analytics.label": "Analítica",
  "hero.tabs.analytics.headline": "Sabe cuánto cobrar, en vez de adivinar",
  "hero.tabs.analytics.body":
    "Ve tus gastos reales, tu precio mínimo por trabajo, y cómo te comparas con otros negocios de tu oficio.",
  "hero.tabs.analytics.alt": "Un panel que muestra el costo por trabajo, el precio mínimo y cómo se comparan sus precios medios con los de otras empresas de su oficio",

  "features.title": "Todo lo necesario para manejar el trabajo",
  "features.quotes.title": "Presupuestos en minutos",
  "features.quotes.body":
    "Cotiza desde tu propio catálogo, agrega fotos, y envía un presupuesto que tu cliente aprueba desde el teléfono.",
  "features.invoices.title": "Facturas que se cobran",
  "features.invoices.body":
    "Convierte un presupuesto aprobado en factura con un clic, acepta pagos con tarjeta, y controla lo pendiente.",
  "features.scheduling.title": "Agenda que se sostiene",
  "features.scheduling.body":
    "Programa trabajos, asigna cuadrillas, y deja que los clientes elijan un horario según tu disponibilidad real.",
  "features.followups.title": "Seguimientos automáticos",
  "features.followups.body":
    "Los presupuestos sin respuesta y las facturas vencidas se recuerdan solos, con tus palabras.",

  "pricing.title": "Precios simples y transparentes",
  "pricing.subtitle":
    "Todos los planes incluyen presupuestos, facturación y agenda. Elige el que se ajuste al tamaño de tu equipo.",
  "pricing.month": "/mes",
  "pricing.cta": "Prueba gratis",
  "pricing.empty":
    "Estamos finalizando los planes — vuelve pronto, o contáctanos para precios de acceso anticipado.",

  "contact.title": "Hablemos",
  "contact.subtitle":
    "Preguntas sobre el producto, precios o migración de tus datos.",
  "contact.name": "Tu nombre",
  "contact.email": "Correo",
  "contact.message": "Mensaje",
  "contact.send": "Enviar mensaje",
  "contact.sending": "Enviando…",
  "contact.sent": "Gracias — te contactaremos pronto.",
  "contact.error": "Algo salió mal. Inténtalo de nuevo o escríbenos directamente.",

  "booking.work.serviceLabel": "¿Qué tipo de trabajo es?",
  "booking.work.serviceUnsure": "Todavía no lo sé",
  "booking.work.notesLabel": "¿Algo más que debamos saber?",
  "booking.work.notesPlaceholder":
    "Qué hay que hacer, más o menos de qué tamaño, cualquier cosa fuera de lo común…",
  "booking.work.notesHint": "Opcional — nos permite llegar preparados.",

  "features.everything": "Todo lo que tu negocio necesita, en un solo lugar",
  "features.anyTrade": "Hecho para cualquier oficio",

  "ai.badge": "IA de FieldQuo",
  "ai.title": "Hazle una pregunta a tu negocio y obtén una respuesta real",
  "ai.body":
    "El copiloto lee tus propios presupuestos, facturas y gastos — no consejos genéricos. Pregunta cómo va tu tasa de conversión este mes, o si los materiales estaban más baratos el mes pasado, y recibe una respuesta basada en tus números reales.",
  "ai.samples.pricing":
    "«¿Estoy cobrando muy poco comparado con el trimestre pasado?»",
  "ai.samples.topClients":
    "«¿Qué clientes han pagado más este año?»",
  "ai.samples.materials":
    "«¿Debería abastecerme de algún material ahora?»",
  "ai.chat.question": "¿Cómo va mi tasa de conversión este mes?",
  "ai.chat.answer":
    "Enviaste 14 presupuestos y 6 fueron aceptados — una tasa de conversión del 43 %, frente al 31 % del mes pasado. Tus presupuestos de pintura son los que mejor convierten.",

  "resources.title": "Recursos gratuitos",
  "resources.help.description": "Guías para configurar y usar FieldQuo",
  "resources.faq.description": "Respuestas rápidas a preguntas comunes",
  "resources.contact.description": "Habla con una persona real",

  "pricing.popular": "Más popular",
  "pricing.selected": "Seleccionado",
  "pricing.firstMonth": "Primer mes",
  "pricing.free": "Gratis",
  "pricing.then": "Luego",
  "pricing.perMonthShort": "/mes",
  "pricing.seatsUnlimited": "Cuentas de empleado ilimitadas",
  "pricing.seatsOne": "1 cuenta de empleado",
  "pricing.seatsMany": "{count} cuentas de empleado",
  "pricing.rbacSeats": "1 cuenta principal + {count} accesos por rol",
  "pricing.crewIncluded": "{count} miembros de cuadrilla incluidos — gratis",
  "pricing.seatsOneIncluded": "1 puesto — presupuestos, trabajos y facturación",
  "pricing.seatsManyIncluded": "{count} puestos — presupuestos, trabajos y facturación",
  "pricingPage.currencyBasis": "Un solo conjunto de precios. La moneda que se te cobra depende de la dirección comercial que indiques al registrarte: a las empresas canadienses se les cobra en dólares canadienses y a las estadounidenses en dólares estadounidenses — la misma cifra, no una conversión.",
  "pricing.fullAccess":
    "Acceso completo — presupuestos, facturación, agenda, analítica",
  "pricing.quoteLimit": "Hasta {count} presupuestos por mes",
  "pricing.aiIncluded": "IA de FieldQuo incluida",

  "faq.title": "Preguntas frecuentes",
  "faq.items.install.q": "¿Necesito instalar algo?",
  "faq.items.install.a":
    "No — FieldQuo funciona completamente en tu navegador. También puedes usarlo desde tu teléfono.",
  "faq.items.onlinePayment.q": "¿Mis clientes pueden pagar en línea?",
  "faq.items.onlinePayment.a":
    "Sí. Conecta tu propia cuenta de Stripe y tus clientes pagan directamente desde el correo de la factura — el dinero llega directo a ti.",
  "faq.items.financing.q": "¿Mis clientes pueden pagar a plazos?",
  "faq.items.financing.a":
    "Sí. Activa Affirm en Configuración → Pagos y tus clientes pueden dividir una factura en pagos mensuales al finalizar la compra, mientras tú cobras el total por adelantado.",
  "faq.items.permissions.q":
    "¿Puedo controlar lo que ven y hacen mis empleados?",
  "faq.items.permissions.a":
    "Sí. Cada miembro del equipo tiene un rol — empleado, supervisor o administrador — que determina lo que puede crear, asignar y consultar.",
  "faq.items.trade.q": "¿Y si mi oficio no aparece en la lista?",
  "faq.items.trade.a":
    "FieldQuo sirve para cualquier negocio de contratación o servicios a domicilio. Puedes activar o desactivar categorías de servicio y fijar tus propios precios, sea cual sea tu oficio.",
  "faq.items.contract.q": "¿Hay contrato o compromiso a largo plazo?",
  "faq.items.contract.a":
    "No. Los planes son mes a mes — cancela cuando quieras.",

  "footer.product": "Producto",
  "footer.company": "Empresa",
  "footer.legal": "Legal",
  "footer.privacy": "Privacidad",
  "footer.terms": "Términos",
  "footer.security": "Seguridad",
  "footer.rights": "Todos los derechos reservados.",
  "footer.tagline":
    "La plataforma todo en uno para contratistas y servicios a domicilio — presupuestos, agenda, facturación y pagos en un solo lugar.",
  "footer.links.help": "Centro de ayuda",
  "footer.links.faq": "Preguntas frecuentes",
  "footer.links.blog": "Blog",
  "footer.links.contact": "Contáctanos",
  "footer.links.about": "Acerca de",
  "footer.links.careers": "Empleo",
  "footer.links.privacy": "Política de privacidad",
  "footer.links.terms": "Términos del servicio",
  "footer.links.security": "Seguridad",

  "theme.label": "Tema",
  "theme.light": "Claro",
  "theme.dark": "Oscuro",
  "theme.system": "Según el sistema",

  "pricingPage.title": "Precios simples y transparentes",
  "pricingPage.subtitle":
    "Todos los planes incluyen presupuestos, facturación y programación. Elige el plan que se ajuste al tamaño de tu equipo.",
  "pricingPage.perMonth": "/mes",
  "pricingPage.currencyNote":
    "Todos los precios están en {currency}. Tu moneda de facturación la determina el país que elijas al registrarte.",
  "pricingPage.taxNote": "Más los impuestos aplicables.",
  "pricingPage.emptyTitle":
    "Estamos afinando los planes — vuelve a consultarlo pronto.",
  "pricingPage.emptyCta": "Pregúntanos por los precios de acceso anticipado",

  "notFound.title": "No encontramos esa página",
  "notFound.body":
    "Puede que el enlace esté roto o que la página se haya movido. Los mensajes de texto cortan los enlaces largos más de lo que crees — comprueba que tengas la dirección completa.",
  "notFound.home": "Volver al inicio",

  "common.loading": "Cargando…",
  "common.learnMore": "Saber más",
  "common.getStarted": "Comenzar",
  "common.back": "Atrás",

  // ── Feature names, from lib/marketing/featureMatrix.js ──────────────────
  //
  // Trade terms, not software words. Where the trade has its own word in this
  // language it is used in preference to a translation of the English one.
  // Where the trade genuinely says the English word, the loanword stays and
  // scripts/check-feature-labels.mjs carries the exemption with a reason, so
  // an untranslated line cannot hide behind that argument.
  "feature.leads.name": "Seguimiento de solicitudes",
  "feature.leads.summary":
    "Todas las solicitudes en una lista, clasificadas de calientes a frías, y en un clic se convierten en presupuesto.",
  "feature.lead_form.name": "Formulario de solicitud para tu web",
  "feature.lead_form.summary":
    "Un formulario que pones en cualquier sitio; lo que llega entra en tu lista de solicitudes, no en un correo.",
  "feature.quotes.name": "Presupuestos",
  "feature.quotes.summary":
    "Arma un presupuesto con tus propias tarifas, agrúpalo por habitación o por partida, y añade fotos.",
  "feature.priced_options.name": "Opciones buena, mejor y premium",
  "feature.priced_options.summary":
    "Envía el mismo trabajo con tres precios y deja que el cliente elija el que quiera.",
  "feature.quote_send.name": "Enviar el presupuesto por correo",
  "feature.quote_send.summary":
    "Un botón envía el presupuesto desde tu dirección, con el PDF adjunto y en el idioma del cliente.",
  "feature.quote_pdf.name": "Presupuesto en PDF con tus colores",
  "feature.quote_pdf.summary":
    "Un PDF con tu logo y tu color de marca — no dice FieldQuo por ninguna parte.",
  "feature.online_approval.name": "El cliente aprueba y firma en línea",
  "feature.online_approval.summary":
    "El cliente abre un enlace, elige los extras, firma, y el trabajo arranca — sin imprimir nada ni perseguirlo por teléfono.",
  "feature.ai_quote_review.name": "Revisión del presupuesto con IA",
  "feature.ai_quote_review.summary":
    "Antes de enviarlo: qué se te olvidó, cómo queda el precio frente a los que ya ganaste, y una redacción más clara.",
  "feature.add_on_upsell.name": "Extras sugeridos",
  "feature.add_on_upsell.summary":
    "Opciones al final del presupuesto, con precio sacado de tu historial, que el cliente puede marcar.",
  "feature.follow_ups.name": "Seguimientos automáticos",
  "feature.follow_ups.summary":
    "Un presupuesto que se queda callado se persigue según tu calendario, con tus palabras, sin que tengas que acordarte.",
  "feature.voice_receptionist.name": "Recepcionista con IA",
  "feature.voice_receptionist.summary":
    "Contesta el teléfono cuando estás en la escalera, toma los datos, agenda la visita y te deja la grabación.",
  "feature.voice_callbacks.name": "Llamadas de confirmación",
  "feature.voice_callbacks.summary":
    "El asistente llama antes para confirmar las citas de mañana y no perder la mañana con quien no aparece.",
  "feature.call_to_quote.name": "Presupuesto redactado desde la llamada",
  "feature.call_to_quote.summary":
    "Lo que describió quien llamó vuelve como borrador de presupuesto que abres, corriges y envías.",
  "feature.booking_page.name": "Página de reservas en línea",
  "feature.booking_page.summary":
    "Los clientes eligen un hueco según tu disponibilidad real, con tiempo de traslado y ventanas de llegada incluidos.",
  "feature.booking_deposit.name": "Cobra un anticipo para apartar la cita",
  "feature.booking_deposit.summary":
    "Cobra una tarifa de visita al reservar y descuéntala de la factura cuando el trabajo siga adelante.",
  "feature.website_builder.name": "Tu propio sitio web",
  "feature.website_builder.summary":
    "Un sitio escrito con lo que ya nos contaste, en tu propia dirección, que editas bloque por bloque.",
  "feature.instant_quotes.name": "Estimado en línea al instante",
  "feature.instant_quotes.summary":
    "Quien visita responde unas preguntas y recibe un rango de precio al momento, con las tarifas que tú fijas.",
  "feature.self_quote.name": "El cliente presupuesta su propio trabajo",
  "feature.self_quote.summary":
    "Un formulario público donde el dueño describe la obra y sube fotos; llega como presupuesto ya empezado.",
  "feature.kitchen_designer.name": "Diseñador de cocinas y gabinetes",
  "feature.kitchen_designer.summary":
    "Dibuja el tramo, elige los acabados, y el precio de los gabinetes y el plano pasan directo al presupuesto.",
  "feature.aerial_measure.name": "Medir desde el cielo",
  "feature.aerial_measure.summary":
    "Escribe la dirección y obtén el área y la pendiente del techo, o traza una entrada o un patio, sin ir hasta allá.",
  "feature.funnels.name": "Embudos de captación",
  "feature.funnels.summary":
    "Páginas de varios pasos para un anuncio o un volante, con las cifras de dónde se cae la gente.",
  "feature.email_campaigns.name": "Campañas por correo",
  "feature.email_campaigns.summary":
    "Escribe una vez, envía a tu lista de clientes desde tu dirección, y mira a quién llegó.",
  "feature.door_hanger_routes.name": "Rutas de volanteo",
  "feature.door_hanger_routes.summary":
    "Planea las calles, asígnalas, y ve marcando las paradas mientras tu equipo recorre el barrio.",
  "feature.review_requests.name": "Solicitudes de reseña",
  "feature.review_requests.summary":
    "Cuando el trabajo está hecho y pagado, el cliente recibe una sola petición amable de reseña.",
  "feature.testimonials.name": "Testimonios en tu sitio",
  "feature.testimonials.summary":
    "Recoge lo que dijeron tus clientes y muéstralo en tu sitio y en tus presupuestos.",
  "feature.referrals.name": "Recomienda a otro contratista",
  "feature.referrals.summary":
    "Envía una invitación; cuando se registre, los dos reciben un mes gratis en su cuenta.",
  "feature.embeds.name": "Widgets para pegar",
  "feature.embeds.summary":
    "Pega una línea en el sitio que ya tienes para incrustar tu reserva, tu formulario o tus reseñas.",
  "feature.bio_link.name": "Un solo enlace para tus perfiles",
  "feature.bio_link.summary":
    "Una página con tu marca, para tu Instagram o la calcomanía de la camioneta, que lleva a todo lo que ofreces.",
  "feature.subcontractor_bids.name": "Precios del subcontratista en tu oferta",
  "feature.subcontractor_bids.summary":
    "Trae el presupuesto del subcontratista como costo, súbele tu margen, y el cliente solo ve tu precio.",
  "feature.jobs.name": "Trabajos",
  "feature.jobs.summary":
    "Un presupuesto aprobado se convierte en un trabajo que ya trae el alcance, la dirección y los papeles.",
  "feature.scheduling.name": "Agenda y despacho",
  "feature.scheduling.summary":
    "Pon las visitas en el calendario, asigna quién va, y mira la semana entera del equipo de una vez.",
  "feature.crew_shifts.name": "Turnos del equipo",
  "feature.crew_shifts.summary":
    "Arma el rol de la próxima semana, publícalo, y cada quien ve sus propios turnos.",
  "feature.recurring_jobs.name": "Trabajos que se repiten",
  "feature.recurring_jobs.summary":
    "Trabajo semanal, mensual o de temporada que se vuelve a poner solo en el calendario.",
  "feature.appointment_reminders.name": "Recordatorios de cita",
  "feature.appointment_reminders.summary":
    "El cliente recibe un mensaje antes de que llegues, así encuentras menos puertas cerradas.",
  "feature.client_reschedule.name": "El cliente reprograma solo",
  "feature.client_reschedule.summary":
    "Un enlace en la confirmación deja que el cliente mueva la visita sin llamarte.",
  "feature.job_costing.name": "Control de costes por trabajo",
  "feature.job_costing.summary":
    "Mano de obra, materiales y gastos frente al precio que presupuestaste, para saber lo que de verdad ganaste.",
  "feature.materials.name": "Materiales en la obra",
  "feature.materials.summary":
    "Lo que se llevó a la obra, lo que costó, y lo que falta comprar.",
  "feature.job_photos.name": "Fotos de antes y después",
  "feature.job_photos.summary":
    "Fotos guardadas con el trabajo, listas para el presupuesto, la factura o tu sitio.",
  "feature.checklists.name": "Listas de verificación del trabajo",
  "feature.checklists.summary":
    "La lista de lo que hay que hacer en la obra, marcada por quien lo hace.",
  "feature.suggested_tasks.name": "Siguientes pasos sugeridos",
  "feature.suggested_tasks.summary":
    "El trabajo propone las tareas que suele pedir un trabajo así, para que no se olvide nada.",
  "feature.tasks.name": "Lista de pendientes",
  "feature.tasks.summary":
    "Todo lo que hay que perseguir, ordenado por lo que más duele si lo dejas.",
  "feature.work_areas.name": "Áreas de trabajo",
  "feature.work_areas.summary":
    "Divide un trabajo grande en habitaciones o zonas y dale cada una a una persona distinta.",
  "feature.time_clock.name": "Marcar entrada y salida",
  "feature.time_clock.summary":
    "El equipo marca contra el trabajo en el que está, desde el teléfono que tenga.",
  "feature.timesheets.name": "Hojas de horas que tú apruebas",
  "feature.timesheets.summary":
    "Las horas llegan atadas a trabajos reales; tú las apruebas antes de que se conviertan en pago.",
  "feature.crew_inbox.name": "Bandeja del equipo",
  "feature.crew_inbox.summary":
    "Tu equipo manda fotos y avisos por mensaje a un solo número y se archivan solos en el trabajo correcto.",
  "feature.time_off.name": "Días libres y vacaciones",
  "feature.time_off.summary":
    "Las solicitudes van al jefe correcto, los saldos se acumulan solos, y el calendario lo sabe.",
  "feature.invoices.name": "Facturas",
  "feature.invoices.summary":
    "Un presupuesto aprobado se vuelve una factura igual al presupuesto, porque está hecha de él.",
  "feature.invoice_send.name": "Enviar una factura",
  "feature.invoice_send.summary":
    "Sale por correo desde tu dirección, con el PDF adjunto y un enlace para pagar dentro.",
  "feature.invoice_changes.name": "Facturas modificadas, con historial",
  "feature.invoice_changes.summary":
    "Corrige una factura emitida y la anterior se conserva, así nunca se discute lo acordado.",
  "feature.card_payments.name": "Cobra con tarjeta",
  "feature.card_payments.summary":
    "El cliente paga desde su teléfono y el dinero va a tu cuenta, no a la nuestra.",
  "feature.stripe_connect.name": "Tu propia cuenta de cobros",
  "feature.stripe_connect.summary":
    "Conecta tu banco una vez; cada pago de cliente cae ahí directo.",
  "feature.financing.name": "Deja que el cliente pague mensual",
  "feature.financing.summary":
    "Activa el pago a plazos al momento de cobrar, para los trabajos grandes que la gente aplaza.",
  "feature.service_plans.name": "Planes de mantenimiento",
  "feature.service_plans.summary":
    "Inscribe al cliente en un plan recurrente y la tarjeta se cobra en fecha sin que tengas que pedirlo.",
  "feature.client_portal.name": "Portal del cliente",
  "feature.client_portal.summary":
    "Un enlace donde el cliente ve sus presupuestos, sus facturas y lo que aún debe.",
  "feature.sales_tax.name": "Impuesto de ventas según la dirección",
  "feature.sales_tax.summary":
    "Configura tus tasas una vez; la correcta aparece en el documento según dónde está la obra.",
  "feature.dashboard.name": "Panel",
  "feature.dashboard.summary":
    "Lo presupuestado, lo ganado, lo agendado y lo pendiente de cobro, en una pantalla, a esta mañana.",
  "feature.break_even.name": "Tu punto de equilibrio",
  "feature.break_even.summary":
    "Lo que un día tiene que dejar antes de que ganes un centavo, calculado con tus gastos fijos reales.",
  "feature.benchmark.name": "Cómo se comparan tus precios",
  "feature.benchmark.summary":
    "Dónde quedan tus tarifas y tu tasa de cierre frente a otros talleres de tu oficio — sin nombrar a nadie, ni a ti.",
  "feature.monthly_digest.name": "Resumen mensual",
  "feature.monthly_digest.summary":
    "Una vez al mes, tus números explicados en frases en lugar de gráficas.",
  "feature.goals.name": "Meta de ingresos",
  "feature.goals.summary":
    "Fija un objetivo para el año y ve qué tan adelante o atrás vas.",
  "feature.expenses.name": "Gastos y costos fijos",
  "feature.expenses.summary":
    "Anota lo que gastas y separa lo que va a un trabajo de lo que va al negocio.",
  "feature.marketing_spend.name": "Cuánto vale tu publicidad",
  "feature.marketing_spend.summary":
    "Registra lo que gastas por canal — incluida una importación automática desde Meta Ads — y ve un costo por cliente potencial promedio en todo lo que haces para conseguir trabajo.",
  "feature.marketing_spend.limits":
    "El costo por cliente potencial es un promedio combinado de todos los canales, sin desglose por canal ni por campaña — nada en FieldQuo vincula todavía un dólar de gasto concreto con un cliente potencial concreto.",
  "feature.payroll.name": "Nómina",
  "feature.payroll.summary":
    "Las horas aprobadas se vuelven una corrida de pago con recibos que puedes entregar o exportar a tu contador.",
  "feature.contractor_payouts.name": "Paga a contratistas desde la app",
  "feature.contractor_payouts.summary":
    "Las horas aprobadas de alguien de tu plantilla marcado como contratista salen como transferencia real a su banco.",
  "feature.price_book.name": "Tu catálogo de precios",
  "feature.price_book.summary":
    "Tus servicios y tarifas en un solo lugar, que se importan desde una hoja de cálculo y se exportan de vuelta.",
  "feature.material_costs.name": "Costos de materiales y recetas",
  "feature.material_costs.summary":
    "Lo que te cuesta un litro de pintura o una hoja de triplay, y cuánto se traga un trabajo de este tamaño.",
  "feature.team_access.name": "Roles y accesos del equipo",
  "feature.team_access.summary":
    "Decide, perilla por perilla, qué ve y qué cambia cada persona — y se respeta en el servidor, no solo en la pantalla.",
  "feature.white_label.name": "Todo lleva tu nombre",
  "feature.white_label.summary":
    "Tu logo y tu color en cada presupuesto, factura, página y correo que ve el cliente.",
  "feature.own_email_domain.name": "Correo desde tu propia dirección",
  "feature.own_email_domain.summary":
    "Verifica tu dominio una vez y todo sale desde ti, no desde una dirección compartida.",
  "feature.quote_email_wording.name": "Escribe tu propio correo de envío",
  "feature.quote_email_wording.summary":
    "Cambia lo que dice el correo del presupuesto, sección por sección, y se queda en el idioma en que se escribió.",
  "feature.document_layouts.name": "Tu diseño de presupuesto y factura",
  "feature.document_layouts.summary":
    "Elige qué secciones aparecen en el documento impreso, y cuál es la predeterminada.",
  "feature.contract_terms.name": "Tus condiciones en cada documento",
  "feature.contract_terms.summary":
    "Las condiciones de pago y el texto del contrato se pegan solos a lo que envías.",
  "feature.languages.name": "Inglés y francés",
  "feature.languages.summary":
    "Envía el presupuesto en el idioma de tu cliente; un documento firmado conserva las palabras con las que se firmó.",
  "feature.ai_copilot.name": "Pregúntale a FieldQuo AI",
  "feature.ai_copilot.summary":
    "Haz una pregunta sobre tu propio negocio en lenguaje corriente y recibe la respuesta desde tus propios números.",
  "feature.activity_log.name": "Quién cambió qué",
  "feature.activity_log.summary":
    "Un registro continuo de cada envío, cambio y aprobación, con un nombre y una hora al lado.",
  "feature.clients.name": "Lista de clientes",
  "feature.clients.summary":
    "Cada cliente, sus propiedades y su historial, importados de donde estén ahora.",
};

const uk = {
  "nav.features": "Можливості",
  "nav.product": "Продукт",
  "nav.pricing": "Ціни",
  "pricing.group.winning": "Отримати замовлення",
  "pricing.group.doing": "Виконати роботу",
  "pricing.group.paid": "Отримати оплату",
  "pricing.group.running": "Керувати бізнесом",
  "pricing.includedTitle": "Усе це є в кожному тарифі",
  "pricing.includedBody": "Немає рівня, який відкриває облік витрат, немає доплати за ШІ, немає надбавки за приймання оплати. Тарифи різняться лише кількістю людей — і нічим більше.",
  "pricing.includedMore": "Це короткий перелік. Подивіться все, що вміє FieldQuo →",
  "nav.allFeatures": "Усі функції",
  "nav.compare": "Порівняти",
  "nav.savings": "Заощадження",
  "nav.glossary": "Словник ремесла",
  "product.allFeatures.label": "Усі функції",
  "product.allFeatures.desc": "Кожна частина FieldQuo і що вона вам дає",
  "product.compare.label": "Порівняти",
  "product.compare.desc": "FieldQuo проти Jobber, Housecall Pro, ServiceTitan і Projul",
  "nav.industries": "Галузі",
  "nav.resources": "Ресурси",
  "nav.contact": "Контакти",
  "nav.login": "Увійти",
  "nav.signup": "Безкоштовна пробна версія",
  "nav.dashboard": "До панелі керування",

  "product.quoting.label": "Кошториси та рахунки",
  "product.quoting.description":
    "Створюйте та надсилайте професійні кошториси за хвилини",
  "product.scheduling.label": "Планування та розподіл",
  "product.scheduling.description":
    "Онлайн-бронювання, зустрічі та призначення робіт",
  "product.team.label": "Команда та зарплата",
  "product.team.description":
    "Табелі, виплати підрядникам, доступ за ролями",
  "product.analytics.label": "Аналітика та ШІ",
  "product.analytics.description": "Знайте свої цифри — і що з ними робити",

  "hero.title":
    "Кошториси, рахунки та планування для виїзних бригад",
  "hero.subtitle":
    "Складіть кошторис на місці, надішліть його ще до від'їзду та отримайте оплату без нагадувань.",
  "hero.cta": "Почати безкоштовно",
  "hero.ctaSecondary": "Як це працює",
  "hero.noCard": "Картка не потрібна",
  "hero.emailPlaceholder": "ви@вашакомпанія.com",
  "hero.requestDemo": "Замовити демо",
  "hero.demo.title": "Забронюйте 30-хвилинну демонстрацію",
  "hero.demo.openCta": "Замовити демо або зворотний дзвінок",
  "hero.demo.openHint": "30 хвилин наживо, без презентацій. Або залиште номер — і ми передзвонимо.",
  "hero.demo.close": "Закрити",
  "hero.demo.modeSlot": "Обрати час",
  "hero.demo.modeCallback": "Передзвоніть мені",
  "hero.demo.phone": "Номер телефону",
  "hero.demo.whenBest": "Найкращий час для дзвінка (необов'язково)",
  "hero.demo.requestCallback": "Замовити дзвінок",
  "hero.demo.callbackSent": "Прийнято — ми зателефонуємо найближчим часом.",
  "hero.demo.callbackBody": "Ми зателефонуємо на {phone}. Якщо не додзвонимось, напишемо на {email}.",
  "hero.demo.subtitle": "Оберіть час, і ми проведемо для вас живу демонстрацію FieldQuo.",
  "hero.demo.loading": "Завантаження часу…",
  "hero.demo.noSlots": "Наразі немає вільного часу — напишіть на hello@fieldquo.com, і ми його підберемо.",
  "hero.demo.name": "Ваше ім'я",
  "hero.demo.email": "Робоча електронна пошта",
  "hero.demo.company": "Компанія (необов'язково)",
  "hero.demo.pickSlot": "Оберіть час вище",
  "hero.demo.confirmWithTime": "Підтвердити {time}",
  "hero.demo.confirmedTitle": "Заброньовано!",
  "hero.demo.confirmedBody": "Перевірте {email} — там запрошення в календар. До зустрічі, {when}.",
  "hero.demo.genericError": "Щось пішло не так — спробуйте ще раз.",
  "hero.sending": "Надсилання…",
  "hero.demoThanks":
    "Дякуємо — ми зв'яжемося з вами найближчим часом, щоб домовитися про демо.",
  "hero.tabs.quotes.label": "Кошториси",
  "hero.tabs.quotes.headline":
    "Надсилайте професійний кошторис за хвилини, а не години",
  "hero.tabs.quotes.body":
    "Складайте кошториси з власними цінами, категоріями послуг і фото — клієнт затверджує онлайн, без нескінченного листування.",
  "hero.tabs.quotes.alt": "Підрядник складає кошторис на планшеті біля будинку клієнтки, поки вона переглядає його на телефоні",
  "hero.tabs.scheduling.label": "Планування",
  "hero.tabs.scheduling.headline":
    "Дозвольте клієнтам бронювати вас прямо з вашого сайту",
  "hero.tabs.scheduling.body":
    "Сторінка бронювання показує вашу реальну доступність, призначає потрібного працівника та підтверджує автоматично.",
  "hero.tabs.scheduling.alt": "Клієнтка обирає час зустрічі на сторінці бронювання підрядника у своєму телефоні",
  "hero.tabs.invoicing.label": "Рахунки",
  "hero.tabs.invoicing.headline": "Отримуйте оплату без нагадувань",
  "hero.tabs.invoicing.body":
    "Перетворіть затверджений кошторис на рахунок одним кліком, а клієнт оплатить онлайн щойно отримає його.",
  "hero.tabs.invoicing.alt": "Клієнт читає кошторис на телефоні, з кнопкою підтвердження внизу",
  "hero.tabs.analytics.label": "Аналітика",
  "hero.tabs.analytics.headline": "Знайте, скільки брати, замість здогадок",
  "hero.tabs.analytics.body":
    "Побачте свої реальні накладні витрати, мінімальну ціну за роботу та як ви виглядаєте на тлі інших у вашій галузі.",
  "hero.tabs.analytics.alt": "Панель із собівартістю роботи, мінімальною ціною та порівнянням ваших середніх цін із цінами інших компаній вашого фаху",

  "features.everything": "Усе потрібне вашому бізнесу — в одному місці",
  "features.anyTrade": "Створено для будь-якої галузі",

  "ai.badge": "ШІ-помічник",
  "ai.title": "Запитайте свій бізнес — і отримайте справжню відповідь",
  "ai.body":
    "Помічник читає ваші власні кошториси, рахунки та витрати — а не дає загальних порад. Запитайте, який у вас відсоток прийнятих кошторисів цього місяця або чи були матеріали дешевшими минулого місяця, і отримайте відповідь на основі ваших реальних цифр.",
  "ai.samples.pricing":
    "«Чи не занадто низькі в мене ціни порівняно з минулим кварталом?»",
  "ai.samples.topClients":
    "«Які клієнти заплатили найбільше цього року?»",
  "ai.samples.materials":
    "«Чи варто зараз закупити якісь матеріали?»",
  "ai.chat.question": "Який у мене відсоток прийнятих кошторисів цього місяця?",
  "ai.chat.answer":
    "Ви надіслали 14 кошторисів, 6 було прийнято — 43 % проти 31 % минулого місяця. Найкраще конвертуються ваші малярні кошториси.",

  "resources.title": "Безкоштовні ресурси",
  "resources.help.description":
    "Посібники з налаштування та використання FieldQuo",
  "resources.faq.description": "Швидкі відповіді на поширені запитання",
  "resources.contact.description": "Поговоріть із живою людиною",

  "pricing.popular": "Найпопулярніший",
  "pricing.selected": "Обрано",
  "pricing.firstMonth": "Перший місяць",
  "pricing.free": "Безкоштовно",
  "pricing.then": "Потім",
  "pricing.perMonthShort": "/міс",
  "pricing.seatsUnlimited": "Необмежена кількість облікових записів",
  "pricing.seatsOne": "1 обліковий запис працівника",
  "pricing.seatsMany": "Облікових записів працівників: {count}",
  "pricing.rbacSeats": "1 головний обліковий запис + {count} доступів за ролями",
  "pricing.crewIncluded": "{count} членів бригади включено — безкоштовно",
  "pricing.seatsOneIncluded": "1 місце — кошториси, роботи та рахунки",
  "pricing.seatsManyIncluded": "{count} місць — кошториси, роботи та рахунки",
  "pricingPage.currencyBasis": "Один набір цін. Валюта оплати визначається адресою бізнесу, яку ви вкажете під час реєстрації: канадські компанії оплачують у канадських доларах, американські — у доларах США. Та сама сума, не конвертація.",
  "pricing.fullAccess":
    "Повний доступ — кошториси, рахунки, планування, аналітика",
  "pricing.quoteLimit": "До {count} кошторисів на місяць",
  "pricing.aiIncluded": "ШІ-помічник включено",

  "faq.title": "Часті запитання",
  "faq.items.install.q": "Чи потрібно щось встановлювати?",
  "faq.items.install.a":
    "Ні — FieldQuo працює повністю у вашому браузері. Ви також можете користуватися ним з телефона.",
  "faq.items.onlinePayment.q": "Чи можуть клієнти оплачувати рахунки онлайн?",
  "faq.items.onlinePayment.a":
    "Так. Підключіть власний обліковий запис Stripe, і клієнти зможуть платити прямо з листа з рахунком — гроші надходять безпосередньо вам.",
  "faq.items.financing.q": "Чи можуть мої клієнти платити частинами?",
  "faq.items.financing.a":
    "Так. Увімкніть Affirm у Налаштування → Платежі, і клієнти зможуть розділити оплату рахунку на щомісячні платежі під час оформлення, а ви отримуєте повну суму одразу.",
  "faq.items.permissions.q":
    "Чи можу я контролювати, що бачать і роблять мої працівники?",
  "faq.items.permissions.a":
    "Так. Кожен член команди має роль — працівник, керівник або адміністратор — яка визначає, що він може створювати, призначати та переглядати.",
  "faq.items.trade.q": "А якщо моєї галузі немає у списку?",
  "faq.items.trade.a":
    "FieldQuo підходить для будь-якого підрядного бізнесу або послуг для дому. Ви можете вмикати чи вимикати категорії послуг і встановлювати власні ціни незалежно від галузі.",
  "faq.items.contract.q": "Чи є контракт або довгострокові зобов'язання?",
  "faq.items.contract.a":
    "Ні. Тарифи помісячні — скасуйте будь-коли.",

  "features.title": "Усе необхідне для роботи",
  "features.quotes.title": "Кошториси за хвилини",
  "features.quotes.body":
    "Формуйте ціни з власного каталогу, додавайте фото та надсилайте кошторис, який клієнт затвердить із телефона.",
  "features.invoices.title": "Рахунки, які оплачують",
  "features.invoices.body":
    "Перетворіть затверджений кошторис на рахунок одним кліком, приймайте оплату карткою та відстежуйте заборгованість.",
  "features.scheduling.title": "Надійне планування",
  "features.scheduling.body":
    "Плануйте роботи, призначайте бригади та дозвольте клієнтам обирати час із вашої реальної доступності.",
  "features.followups.title": "Автоматичні нагадування",
  "features.followups.body":
    "Кошториси без відповіді та прострочені рахунки нагадують про себе самі — вашими словами.",

  "pricing.title": "Прості та прозорі ціни",
  "pricing.subtitle":
    "Кожен тариф включає кошториси, виставлення рахунків і планування. Оберіть той, що відповідає розміру вашої команди.",
  "pricing.month": "/місяць",
  "pricing.cta": "Почати безкоштовно",
  "pricing.empty":
    "Тарифи ще формуються — завітайте пізніше або зв'яжіться з нами щодо умов раннього доступу.",

  "contact.title": "Зв'яжіться з нами",
  "contact.subtitle":
    "Питання про продукт, ціни або перенесення даних.",
  "contact.name": "Ваше ім'я",
  "contact.email": "Електронна пошта",
  "contact.message": "Повідомлення",
  "contact.send": "Надіслати",
  "contact.sending": "Надсилання…",
  "contact.sent": "Дякуємо — ми скоро відповімо.",
  "contact.error": "Щось пішло не так. Спробуйте ще раз або напишіть нам напряму.",

  "booking.work.serviceLabel": "Який це вид робіт?",
  "booking.work.serviceUnsure": "Ще не знаю",
  "booking.work.notesLabel": "Що ще нам варто знати?",
  "booking.work.notesPlaceholder":
    "Що потрібно зробити, приблизний обсяг, будь-що незвичне…",
  "booking.work.notesHint": "Необов'язково — так ми приїдемо підготовленими.",

  "footer.product": "Продукт",
  "footer.company": "Компанія",
  "footer.legal": "Правова інформація",
  "footer.privacy": "Конфіденційність",
  "footer.terms": "Умови",
  "footer.security": "Безпека",
  "footer.rights": "Усі права захищено.",
  "footer.tagline":
    "Універсальна платформа для підрядників і послуг для дому — кошториси, планування, рахунки та оплати в одному місці.",
  "footer.links.help": "Довідковий центр",
  "footer.links.faq": "Часті запитання",
  "footer.links.blog": "Блог",
  "footer.links.contact": "Зв'язатися з нами",
  "footer.links.about": "Про нас",
  "footer.links.careers": "Кар'єра",
  "footer.links.privacy": "Політика конфіденційності",
  "footer.links.terms": "Умови використання",
  "footer.links.security": "Безпека",

  "theme.label": "Тема",
  "theme.light": "Світла",
  "theme.dark": "Темна",
  "theme.system": "Як у системі",

  "pricingPage.title": "Прості та прозорі ціни",
  "pricingPage.subtitle":
    "Кожен тариф включає кошториси, виставлення рахунків і планування. Оберіть тариф за розміром вашої команди.",
  "pricingPage.perMonth": "/місяць",
  "pricingPage.currencyNote":
    "Усі ціни вказано в {currency}. Валюта оплати визначається країною, яку ви обираєте під час реєстрації.",
  "pricingPage.taxNote": "Плюс відповідні податки.",
  "pricingPage.emptyTitle":
    "Тарифи ще узгоджуються — завітайте трохи пізніше.",
  "pricingPage.emptyCta": "Запитайте нас про ціни раннього доступу",

  "notFound.title": "Ми не можемо знайти цю сторінку",
  "notFound.body":
    "Можливо, посилання пошкоджене або сторінку перенесено. SMS обрізають довгі посилання частіше, ніж здається — перевірте, чи маєте повну адресу.",
  "notFound.home": "На головну",

  "common.loading": "Завантаження…",
  "common.learnMore": "Дізнатися більше",
  "common.getStarted": "Почати",
  "common.back": "Назад",

  // ── Feature names, from lib/marketing/featureMatrix.js ──────────────────
  //
  // Trade terms, not software words. Where the trade has its own word in this
  // language it is used in preference to a translation of the English one.
  // Where the trade genuinely says the English word, the loanword stays and
  // scripts/check-feature-labels.mjs carries the exemption with a reason, so
  // an untranslated line cannot hide behind that argument.
  "feature.leads.name": "Облік запитів",
  "feature.leads.summary":
    "Усі звернення в одному списку, від гарячих до холодних, і в один клік перетворюються на кошторис.",
  "feature.lead_form.name": "Форма запиту для вашого сайту",
  "feature.lead_form.summary":
    "Форму можна поставити на будь-який сайт; відповіді потрапляють у ваш список запитів, а не на пошту.",
  "feature.quotes.name": "Кошториси",
  "feature.quotes.summary":
    "Складіть кошторис за власними розцінками, згрупуйте його за кімнатами чи розділами та додайте фото.",
  "feature.priced_options.name": "Варіанти: базовий, кращий, найкращий",
  "feature.priced_options.summary":
    "Надішліть одну роботу за трьома цінами й дайте клієнту обрати той, який він хоче.",
  "feature.quote_send.name": "Надсилання кошторису поштою",
  "feature.quote_send.summary":
    "Одна кнопка надсилає кошторис з вашої адреси, з PDF у вкладенні, мовою клієнта.",
  "feature.quote_pdf.name": "PDF кошторису у ваших кольорах",
  "feature.quote_pdf.summary":
    "PDF із вашим логотипом і фірмовим кольором — ніде не написано FieldQuo.",
  "feature.online_approval.name": "Клієнт погоджує й підписує онлайн",
  "feature.online_approval.summary":
    "Клієнт відкриває посилання, обирає додатки, підписує — і робота почалася, без друку й телефонних наздоганянь.",
  "feature.ai_quote_review.name": "Перевірка кошторису зі ШІ",
  "feature.ai_quote_review.summary":
    "Перед відправленням: що ви забули, як ціна виглядає поруч із виграними, і чіткіші формулювання.",
  "feature.add_on_upsell.name": "Пропоновані доповнення",
  "feature.add_on_upsell.summary":
    "Необов'язкові позиції внизу кошторису, з цінами з вашої історії, які клієнт може позначити.",
  "feature.follow_ups.name": "Автоматичні нагадування",
  "feature.follow_ups.summary":
    "Кошторис, на який мовчать, нагадує про себе за вашим графіком, вашими словами, без вашої участі.",
  "feature.voice_receptionist.name": "ШІ-адміністратор на телефоні",
  "feature.voice_receptionist.summary":
    "Відповідає на дзвінок, коли ви на драбині, записує деталі, бронює візит і залишає вам запис розмови.",
  "feature.voice_callbacks.name": "Дзвінки-підтвердження",
  "feature.voice_callbacks.summary":
    "Помічник телефонує наперед, щоб підтвердити завтрашні зустрічі, і ви не втрачаєте ранок на тих, хто не прийшов.",
  "feature.call_to_quote.name": "Кошторис із розмови",
  "feature.call_to_quote.summary":
    "Те, що описав той, хто дзвонив, повертається чернеткою кошторису — відкрийте, виправте, надішліть.",
  "feature.booking_page.name": "Сторінка онлайн-бронювання",
  "feature.booking_page.summary":
    "Клієнти обирають час із вашої реальної доступності, з урахуванням дороги та вікна прибуття.",
  "feature.booking_deposit.name": "Завдаток за бронювання часу",
  "feature.booking_deposit.summary":
    "Візьміть плату за виїзд під час бронювання і зарахуйте її в рахунок, коли робота піде.",
  "feature.website_builder.name": "Власний сайт",
  "feature.website_builder.summary":
    "Сайт, написаний з того, що ви вже розповіли, на вашій власній адресі, який можна редагувати блок за блоком.",
  "feature.instant_quotes.name": "Миттєвий онлайн-розрахунок",
  "feature.instant_quotes.summary":
    "Відвідувач відповідає на кілька запитань і одразу отримує діапазон ціни за вашими розцінками.",
  "feature.self_quote.name": "Клієнт сам оцінює свою роботу",
  "feature.self_quote.summary":
    "Публічна форма, де власник описує роботу й додає фото; вона приходить як уже розпочатий кошторис.",
  "feature.kitchen_designer.name": "Конструктор кухонь і шаф",
  "feature.kitchen_designer.summary":
    "Накресліть ряд, оберіть оздоблення — і ціни на шафи та план потрапляють просто в кошторис.",
  "feature.aerial_measure.name": "Заміри з висоти",
  "feature.aerial_measure.summary":
    "Введіть адресу й отримайте площу та ухил даху або обведіть під'їзд чи терасу, не виїжджаючи на місце.",
  "feature.funnels.name": "Воронки запитів",
  "feature.funnels.summary":
    "Багатокрокові сторінки під оголошення чи флаєр, із цифрами про те, де люди відпадають.",
  "feature.email_campaigns.name": "Розсилки поштою",
  "feature.email_campaigns.summary":
    "Напишіть один раз, надішліть своєму списку клієнтів з власної адреси й побачте, до кого дійшло.",
  "feature.door_hanger_routes.name": "Маршрути роздачі листівок",
  "feature.door_hanger_routes.summary":
    "Сплануйте вулиці, розподіліть їх і відмічайте зупинки, поки бригада обходить район.",
  "feature.review_requests.name": "Запити на відгук",
  "feature.review_requests.summary":
    "Коли роботу зроблено й оплачено, клієнт отримує одне ввічливе прохання залишити відгук.",
  "feature.testimonials.name": "Відгуки на вашому сайті",
  "feature.testimonials.summary":
    "Збирайте те, що сказали клієнти, і показуйте це на сайті та в кошторисах.",
  "feature.referrals.name": "Порекомендуйте іншого підрядника",
  "feature.referrals.summary":
    "Надішліть запрошення; коли він зареєструється, кожен з вас отримає безкоштовний місяць на рахунок.",
  "feature.embeds.name": "Віджети для вставки",
  "feature.embeds.summary":
    "Вставте один рядок у вже наявний сайт, щоб додати бронювання, форму запиту або відгуки.",
  "feature.bio_link.name": "Одне посилання для всіх профілів",
  "feature.bio_link.summary":
    "Одна фірмова сторінка для Instagram чи наклейки на авто, що веде до всього, що ви пропонуєте.",
  "feature.subcontractor_bids.name": "Ціни субпідрядника у вашій пропозиції",
  "feature.subcontractor_bids.summary":
    "Підтягніть кошторис субпідрядника як витрату, додайте націнку — клієнт бачить лише вашу ціну.",
  "feature.jobs.name": "Роботи",
  "feature.jobs.summary":
    "Погоджений кошторис стає роботою, на якій уже є обсяг, адреса й документи.",
  "feature.scheduling.name": "Планування та розподіл",
  "feature.scheduling.summary":
    "Ставте візити в календар, призначайте, хто їде, і бачте тиждень усієї бригади одразу.",
  "feature.crew_shifts.name": "Зміни бригади",
  "feature.crew_shifts.summary":
    "Складіть графік на наступний тиждень, опублікуйте — і кожен бачить свої зміни.",
  "feature.recurring_jobs.name": "Повторювані роботи",
  "feature.recurring_jobs.summary":
    "Щотижнева, щомісячна або сезонна робота, яка сама повертається в календар.",
  "feature.appointment_reminders.name": "Нагадування про візит",
  "feature.appointment_reminders.summary":
    "Клієнт отримує повідомлення перед вашим приїздом, тож менше зачинених дверей.",
  "feature.client_reschedule.name": "Клієнт сам переносить візит",
  "feature.client_reschedule.summary":
    "Посилання в підтвердженні дозволяє клієнту перенести візит, не телефонуючи вам.",
  "feature.job_costing.name": "Облік витрат по роботі",
  "feature.job_costing.summary":
    "Праця, матеріали й витрати проти ціни в кошторисі — щоб знати, скільки ви справді заробили.",
  "feature.materials.name": "Матеріали на об'єкті",
  "feature.materials.summary":
    "Що пішло на об'єкт, скільки це коштувало і що ще треба купити.",
  "feature.job_photos.name": "Фото до і після",
  "feature.job_photos.summary":
    "Фото, підшиті до роботи, готові піти в кошторис, рахунок або на ваш сайт.",
  "feature.checklists.name": "Чек-листи по роботі",
  "feature.checklists.summary":
    "Список того, що треба зробити на об'єкті, який відмічає той, хто робить.",
  "feature.suggested_tasks.name": "Підказані наступні кроки",
  "feature.suggested_tasks.summary":
    "Робота сама пропонує завдання, які зазвичай потрібні такій роботі, щоб нічого не забулося.",
  "feature.tasks.name": "Список справ",
  "feature.tasks.summary":
    "Усе, що потребує уваги, відсортоване за тим, що болючіше вдарить, якщо це відкласти.",
  "feature.work_areas.name": "Ділянки робіт",
  "feature.work_areas.summary":
    "Розбийте велику роботу на кімнати чи зони й доручіть кожну окремій людині.",
  "feature.time_clock.name": "Відмітка приходу й відходу",
  "feature.time_clock.summary":
    "Бригада відмічається на тій роботі, де вона є, з будь-якого свого телефона.",
  "feature.timesheets.name": "Табелі, які ви затверджуєте",
  "feature.timesheets.summary":
    "Години надходять прив'язані до реальних робіт; ви їх затверджуєте, перш ніж вони стануть зарплатою.",
  "feature.crew_inbox.name": "Скринька бригади",
  "feature.crew_inbox.summary":
    "Бригада надсилає фото й новини на один номер, і вони самі підшиваються до потрібної роботи.",
  "feature.time_off.name": "Відгули та відпустки",
  "feature.time_off.summary":
    "Заявки йдуть потрібному керівнику, залишки накопичуються самі, і календар про це знає.",
  "feature.invoices.name": "Рахунки",
  "feature.invoices.summary":
    "Погоджений кошторис перетворюється на рахунок, схожий на кошторис, бо зроблений із нього.",
  "feature.invoice_send.name": "Надсилання рахунку",
  "feature.invoice_send.summary":
    "Іде поштою з вашої адреси, з PDF у вкладенні та посиланням на оплату всередині.",
  "feature.invoice_changes.name": "Зміни в рахунках зберігаються",
  "feature.invoice_changes.summary":
    "Виправте виставлений рахунок — старий залишається, тож питання про домовлене не виникає.",
  "feature.card_payments.name": "Оплата карткою",
  "feature.card_payments.summary":
    "Клієнт платить із телефона, і гроші йдуть на ваш рахунок, а не на наш.",
  "feature.stripe_connect.name": "Власний рахунок для виплат",
  "feature.stripe_connect.summary":
    "Підключіть банк один раз — і кожна оплата клієнта надходить прямо туди.",
  "feature.financing.name": "Клієнт може платити щомісяця",
  "feature.financing.summary":
    "Увімкніть оплату частинами на етапі оплати — для великих робіт, які власники відкладають.",
  "feature.service_plans.name": "Плани обслуговування",
  "feature.service_plans.summary":
    "Підпишіть клієнта на регулярний план — і картка списується за графіком без ваших нагадувань.",
  "feature.client_portal.name": "Кабінет клієнта",
  "feature.client_portal.summary":
    "Одне посилання, де клієнт бачить свої кошториси, рахунки й залишок боргу.",
  "feature.sales_tax.name": "Податок з продажу за адресою",
  "feature.sales_tax.summary":
    "Налаштуйте ставки один раз — і в документ потрапляє та, що діє за місцем роботи.",
  "feature.dashboard.name": "Панель керування",
  "feature.dashboard.summary":
    "Що виставлено, виграно, заплановано й не сплачено — на одному екрані, станом на цей ранок.",
  "feature.break_even.name": "Ваша точка беззбитковості",
  "feature.break_even.summary":
    "Скільки день має принести, перш ніж ви заробите хоч копійку — з ваших реальних накладних витрат.",
  "feature.benchmark.name": "Як виглядають ваші ціни",
  "feature.benchmark.summary":
    "Де ваші розцінки й відсоток виграних робіт стоять поруч з іншими у вашому ремеслі — без імен, зокрема й вашого.",
  "feature.monthly_digest.name": "Місячний огляд",
  "feature.monthly_digest.summary":
    "Раз на місяць ваші цифри пояснені реченнями, а не графіками.",
  "feature.goals.name": "Ціль по виручці",
  "feature.goals.summary":
    "Поставте ціль на рік і бачте, наскільки ви попереду чи позаду.",
  "feature.expenses.name": "Витрати й накладні",
  "feature.expenses.summary":
    "Записуйте, що витрачаєте, відділяючи те, що належить роботі, від того, що належить бізнесу.",
  "feature.marketing_spend.name": "Скільки варта ваша реклама",
  "feature.marketing_spend.summary":
    "Записуйте витрати по каналах — з автоматичним імпортом із Meta Ads — і бачте усереднену вартість ліда по всьому, що ви робите, щоб отримати роботу.",
  "feature.marketing_spend.limits":
    "Вартість одного ліда усереднена по всіх каналах, без розбивки за каналом чи кампанією — наразі ніщо у FieldQuo не пов'язує конкретний долар витрат із конкретним лідом.",
  "feature.payroll.name": "Зарплата",
  "feature.payroll.summary":
    "Затверджені години стають нарахуванням із розрахунковими листками, які можна віддати або вивантажити бухгалтеру.",
  "feature.contractor_payouts.name": "Виплати підрядникам із застосунку",
  "feature.contractor_payouts.summary":
    "Затверджені години людини з вашого складу, позначеної підрядником, ідуть реальним переказом на її банківський рахунок.",
  "feature.price_book.name": "Ваш прайс-лист",
  "feature.price_book.summary":
    "Ваші послуги та розцінки в одному місці, з імпортом із таблиці та експортом назад.",
  "feature.material_costs.name": "Вартість матеріалів і норми витрат",
  "feature.material_costs.summary":
    "Скільки вам коштує літр фарби чи лист фанери, і скільки з'їдає робота такого розміру.",
  "feature.team_access.name": "Ролі та доступи команди",
  "feature.team_access.summary":
    "Вирішуйте по кожному пункту, що кожна людина бачить і змінює — і це тримається на сервері, а не лише на екрані.",
  "feature.white_label.name": "Усе під вашим іменем",
  "feature.white_label.summary":
    "Ваш логотип і ваш колір на кожному кошторисі, рахунку, сторінці й листі, які бачить власник.",
  "feature.own_email_domain.name": "Листи з вашої власної адреси",
  "feature.own_email_domain.summary":
    "Підтвердіть домен один раз — і все йде від вас, а не зі спільної адреси.",
  "feature.quote_email_wording.name": "Власний супровідний лист",
  "feature.quote_email_wording.summary":
    "Змініть текст листа з кошторисом, розділ за розділом; він залишається мовою, якою написано кошторис.",
  "feature.document_layouts.name": "Власний вигляд кошторису й рахунку",
  "feature.document_layouts.summary":
    "Оберіть, які розділи з'являються на друкованому документі і який вигляд є типовим.",
  "feature.contract_terms.name": "Ваші умови на кожному документі",
  "feature.contract_terms.summary":
    "Умови оплати й текст договору самі додаються до того, що ви надсилаєте.",
  "feature.languages.name": "Англійська та французька",
  "feature.languages.summary":
    "Надсилайте кошторис мовою, якою говорить клієнт; підписаний документ зберігає ті слова, з якими його підписали.",
  "feature.ai_copilot.name": "Запитайте FieldQuo AI",
  "feature.ai_copilot.summary":
    "Поставте запитання про власний бізнес звичайними словами й отримайте відповідь із ваших же цифр.",
  "feature.activity_log.name": "Хто що змінив",
  "feature.activity_log.summary":
    "Безперервний запис кожного надсилання, правки й погодження, з іменем і часом.",
  "feature.clients.name": "Список клієнтів",
  "feature.clients.summary":
    "Кожен клієнт, його об'єкти та історія, імпортовані звідти, де вони зараз.",
};

const pa = {
  "nav.features": "ਵਿਸ਼ੇਸ਼ਤਾਵਾਂ",
  "nav.product": "ਉਤਪਾਦ",
  "nav.pricing": "ਕੀਮਤਾਂ",
  "pricing.group.winning": "ਕੰਮ ਜਿੱਤਣਾ",
  "pricing.group.doing": "ਕੰਮ ਕਰਨਾ",
  "pricing.group.paid": "ਭੁਗਤਾਨ ਲੈਣਾ",
  "pricing.group.running": "ਕਾਰੋਬਾਰ ਚਲਾਉਣਾ",
  "pricing.includedTitle": "ਇਹ ਸਭ ਹਰ ਪਲਾਨ ਵਿੱਚ ਹੈ",
  "pricing.includedBody": "ਕੋਈ ਪੱਧਰ ਨਹੀਂ ਜੋ ਜੌਬ ਕੌਸਟਿੰਗ ਖੋਲ੍ਹੇ, AI ਲਈ ਕੋਈ ਅੱਪਗ੍ਰੇਡ ਨਹੀਂ, ਭੁਗਤਾਨ ਲੈਣ ਲਈ ਕੋਈ ਵਾਧੂ ਨਹੀਂ। ਪਲਾਨ ਸਿਰਫ਼ ਇਸ ਗੱਲ ਵਿੱਚ ਵੱਖਰੇ ਹਨ ਕਿ ਕਿੰਨੇ ਲੋਕ ਕੰਮ ਕਰਦੇ ਹਨ।",
  "pricing.includedMore": "ਇਹ ਛੋਟੀ ਸੂਚੀ ਹੈ। FieldQuo ਜੋ ਕੁਝ ਕਰਦਾ ਹੈ ਸਭ ਵੇਖੋ →",
  "nav.allFeatures": "ਸਾਰੀਆਂ ਸਹੂਲਤਾਂ",
  "nav.compare": "ਤੁਲਨਾ ਕਰੋ",
  "nav.savings": "ਬੱਚਤ",
  "nav.glossary": "ਕਿੱਤੇ ਦਾ ਸ਼ਬਦਕੋਸ਼",
  "product.allFeatures.label": "ਸਾਰੀਆਂ ਸਹੂਲਤਾਂ",
  "product.allFeatures.desc": "FieldQuo ਦਾ ਹਰ ਹਿੱਸਾ, ਅਤੇ ਇਹ ਤੁਹਾਡੇ ਲਈ ਕੀ ਕਰਦਾ ਹੈ",
  "product.compare.label": "ਤੁਲਨਾ ਕਰੋ",
  "product.compare.desc": "Jobber, Housecall Pro, ServiceTitan ਅਤੇ Projul ਦੇ ਮੁਕਾਬਲੇ FieldQuo",
  "nav.industries": "ਉਦਯੋਗ",
  "nav.resources": "ਸਰੋਤ",
  "nav.contact": "ਸੰਪਰਕ",
  "nav.login": "ਲੌਗ ਇਨ",
  "nav.signup": "ਮੁਫ਼ਤ ਅਜ਼ਮਾਇਸ਼",
  "nav.dashboard": "ਡੈਸ਼ਬੋਰਡ 'ਤੇ ਜਾਓ",

  "product.quoting.label": "ਕੋਟ ਅਤੇ ਇਨਵੌਇਸਿੰਗ",
  "product.quoting.description":
    "ਮਿੰਟਾਂ ਵਿੱਚ ਪੇਸ਼ੇਵਰ ਕੋਟ ਬਣਾਓ ਅਤੇ ਭੇਜੋ",
  "product.scheduling.label": "ਸ਼ਡਿਊਲਿੰਗ ਅਤੇ ਡਿਸਪੈਚ",
  "product.scheduling.description":
    "ਆਨਲਾਈਨ ਬੁਕਿੰਗ, ਮੁਲਾਕਾਤਾਂ ਅਤੇ ਕੰਮ ਦੀ ਵੰਡ",
  "product.team.label": "ਟੀਮ ਅਤੇ ਪੇਰੋਲ",
  "product.team.description":
    "ਟਾਈਮਸ਼ੀਟਾਂ, ਠੇਕੇਦਾਰਾਂ ਦੀ ਅਦਾਇਗੀ, ਭੂਮਿਕਾ ਅਨੁਸਾਰ ਪਹੁੰਚ",
  "product.analytics.label": "ਵਿਸ਼ਲੇਸ਼ਣ ਅਤੇ AI",
  "product.analytics.description":
    "ਆਪਣੇ ਅੰਕੜੇ ਜਾਣੋ — ਅਤੇ ਉਨ੍ਹਾਂ ਨਾਲ ਕੀ ਕਰਨਾ ਹੈ",

  "hero.title": "ਫ਼ੀਲਡ ਸਰਵਿਸ ਟੀਮਾਂ ਲਈ ਕੋਟ, ਇਨਵੌਇਸ ਅਤੇ ਸ਼ਡਿਊਲਿੰਗ",
  "hero.subtitle":
    "ਮੌਕੇ 'ਤੇ ਕੋਟ ਬਣਾਓ, ਜਾਣ ਤੋਂ ਪਹਿਲਾਂ ਭੇਜੋ, ਅਤੇ ਕਿਸੇ ਦੇ ਪਿੱਛੇ ਪਏ ਬਿਨਾਂ ਭੁਗਤਾਨ ਲਵੋ।",
  "hero.cta": "ਮੁਫ਼ਤ ਅਜ਼ਮਾਇਸ਼ ਸ਼ੁਰੂ ਕਰੋ",
  "hero.ctaSecondary": "ਇਹ ਕਿਵੇਂ ਕੰਮ ਕਰਦਾ ਹੈ",
  "hero.noCard": "ਕ੍ਰੈਡਿਟ ਕਾਰਡ ਦੀ ਲੋੜ ਨਹੀਂ",
  "hero.emailPlaceholder": "tuhada@tuhadikampani.com",
  "hero.requestDemo": "ਡੈਮੋ ਮੰਗੋ",
  "hero.demo.title": "30-ਮਿੰਟ ਦੀ ਡੈਮੋ ਬੁੱਕ ਕਰੋ",
  "hero.demo.openCta": "ਡੈਮੋ ਜਾਂ ਕਾਲ ਬੈਕ ਬੁੱਕ ਕਰੋ",
  "hero.demo.openHint": "30 ਮਿੰਟ, ਲਾਈਵ, ਬਿਨਾਂ ਸਲਾਈਡਾਂ ਦੇ। ਜਾਂ ਆਪਣਾ ਨੰਬਰ ਛੱਡੋ ਅਤੇ ਅਸੀਂ ਤੁਹਾਨੂੰ ਕਾਲ ਕਰਾਂਗੇ।",
  "hero.demo.close": "ਬੰਦ ਕਰੋ",
  "hero.demo.modeSlot": "ਸਮਾਂ ਚੁਣੋ",
  "hero.demo.modeCallback": "ਮੈਨੂੰ ਕਾਲ ਕਰੋ",
  "hero.demo.phone": "ਫ਼ੋਨ ਨੰਬਰ",
  "hero.demo.whenBest": "ਤੁਹਾਡੇ ਤੱਕ ਪਹੁੰਚਣ ਦਾ ਵਧੀਆ ਸਮਾਂ (ਵਿਕਲਪਿਕ)",
  "hero.demo.requestCallback": "ਕਾਲ ਬੈਕ ਦੀ ਬੇਨਤੀ ਕਰੋ",
  "hero.demo.callbackSent": "ਸਮਝ ਗਏ — ਅਸੀਂ ਜਲਦੀ ਹੀ ਕਾਲ ਕਰਾਂਗੇ।",
  "hero.demo.callbackBody": "ਅਸੀਂ {phone} 'ਤੇ ਕਾਲ ਕਰਾਂਗੇ। ਜੇ ਸੰਪਰਕ ਨਾ ਹੋਇਆ, ਅਸੀਂ {email} 'ਤੇ ਈਮੇਲ ਕਰਾਂਗੇ।",
  "hero.demo.subtitle": "ਇੱਕ ਸਮਾਂ ਚੁਣੋ ਅਤੇ ਅਸੀਂ ਤੁਹਾਨੂੰ FieldQuo ਲਾਈਵ ਦਿਖਾਵਾਂਗੇ।",
  "hero.demo.loading": "ਸਮੇਂ ਲੋਡ ਹੋ ਰਹੇ ਹਨ…",
  "hero.demo.noSlots": "ਇਸ ਵੇਲੇ ਕੋਈ ਖਾਲੀ ਸਮਾਂ ਨਹੀਂ — hello@fieldquo.com 'ਤੇ ਈਮੇਲ ਕਰੋ ਅਤੇ ਅਸੀਂ ਪ੍ਰਬੰਧ ਕਰਾਂਗੇ।",
  "hero.demo.name": "ਤੁਹਾਡਾ ਨਾਂ",
  "hero.demo.email": "ਕੰਮ ਦੀ ਈਮੇਲ",
  "hero.demo.company": "ਕੰਪਨੀ (ਵਿਕਲਪਿਕ)",
  "hero.demo.pickSlot": "ਉੱਪਰ ਇੱਕ ਸਮਾਂ ਚੁਣੋ",
  "hero.demo.confirmWithTime": "{time} ਪੱਕਾ ਕਰੋ",
  "hero.demo.confirmedTitle": "ਬੁੱਕ ਹੋ ਗਿਆ!",
  "hero.demo.confirmedBody": "ਆਪਣੇ ਕੈਲੰਡਰ ਸੱਦੇ ਲਈ {email} ਵੇਖੋ। {when} ਨੂੰ ਮਿਲਦੇ ਹਾਂ।",
  "hero.demo.genericError": "ਕੁਝ ਗਲਤ ਹੋ ਗਿਆ — ਕਿਰਪਾ ਕਰਕੇ ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ।",
  "hero.sending": "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  "hero.demoThanks":
    "ਧੰਨਵਾਦ — ਅਸੀਂ ਤੁਹਾਡਾ ਡੈਮੋ ਤੈਅ ਕਰਨ ਲਈ ਜਲਦੀ ਸੰਪਰਕ ਕਰਾਂਗੇ।",
  "hero.tabs.quotes.label": "ਕੋਟ",
  "hero.tabs.quotes.headline":
    "ਘੰਟਿਆਂ ਵਿੱਚ ਨਹੀਂ, ਮਿੰਟਾਂ ਵਿੱਚ ਪੇਸ਼ੇਵਰ ਕੋਟ ਭੇਜੋ",
  "hero.tabs.quotes.body":
    "ਆਪਣੀਆਂ ਕੀਮਤਾਂ, ਸੇਵਾ ਸ਼੍ਰੇਣੀਆਂ ਅਤੇ ਫ਼ੋਟੋਆਂ ਨਾਲ ਕੋਟ ਬਣਾਓ — ਗਾਹਕ ਆਨਲਾਈਨ ਮਨਜ਼ੂਰੀ ਦਿੰਦਾ ਹੈ, ਵਾਰ-ਵਾਰ ਗੱਲਬਾਤ ਦੀ ਲੋੜ ਨਹੀਂ।",
  "hero.tabs.quotes.alt": "ਇੱਕ ਠੇਕੇਦਾਰ ਗਾਹਕ ਦੇ ਘਰ ਦੇ ਬਾਹਰ ਟੈਬਲੇਟ ਉੱਤੇ ਹਵਾਲਾ ਬਣਾ ਰਿਹਾ ਹੈ, ਜਦਕਿ ਉਹ ਇਸਨੂੰ ਆਪਣੇ ਫ਼ੋਨ ਉੱਤੇ ਦੇਖ ਰਹੀ ਹੈ",
  "hero.tabs.scheduling.label": "ਸ਼ਡਿਊਲਿੰਗ",
  "hero.tabs.scheduling.headline":
    "ਗਾਹਕਾਂ ਨੂੰ ਸਿੱਧਾ ਤੁਹਾਡੀ ਵੈੱਬਸਾਈਟ ਤੋਂ ਬੁਕਿੰਗ ਕਰਨ ਦਿਓ",
  "hero.tabs.scheduling.body":
    "ਇੱਕ ਬੁਕਿੰਗ ਪੰਨਾ ਜੋ ਤੁਹਾਡੀ ਅਸਲ ਉਪਲਬਧਤਾ ਦਿਖਾਉਂਦਾ ਹੈ, ਸਹੀ ਟੀਮ ਮੈਂਬਰ ਨੂੰ ਸੌਂਪਦਾ ਹੈ, ਅਤੇ ਆਪਣੇ-ਆਪ ਪੁਸ਼ਟੀ ਕਰਦਾ ਹੈ।",
  "hero.tabs.scheduling.alt": "ਇੱਕ ਗਾਹਕ ਆਪਣੇ ਫ਼ੋਨ ਉੱਤੇ ਠੇਕੇਦਾਰ ਦੇ ਬੁਕਿੰਗ ਪੰਨੇ ਤੋਂ ਮੁਲਾਕਾਤ ਦਾ ਸਮਾਂ ਚੁਣ ਰਹੀ ਹੈ",
  "hero.tabs.invoicing.label": "ਇਨਵੌਇਸਿੰਗ",
  "hero.tabs.invoicing.headline": "ਕਿਸੇ ਦੇ ਪਿੱਛੇ ਪਏ ਬਿਨਾਂ ਭੁਗਤਾਨ ਲਵੋ",
  "hero.tabs.invoicing.body":
    "ਮਨਜ਼ੂਰ ਕੋਟ ਨੂੰ ਇੱਕ ਕਲਿੱਕ ਵਿੱਚ ਇਨਵੌਇਸ ਬਣਾਓ, ਅਤੇ ਗਾਹਕ ਇਨਬਾਕਸ ਵਿੱਚ ਪਹੁੰਚਦੇ ਹੀ ਆਨਲਾਈਨ ਭੁਗਤਾਨ ਕਰ ਸਕਦਾ ਹੈ।",
  "hero.tabs.invoicing.alt": "ਇੱਕ ਗਾਹਕ ਆਪਣੇ ਫ਼ੋਨ ਉੱਤੇ ਹਵਾਲਾ ਪੜ੍ਹ ਰਿਹਾ ਹੈ, ਹੇਠਾਂ ਮਨਜ਼ੂਰੀ ਦਾ ਬਟਨ ਹੈ",
  "hero.tabs.analytics.label": "ਵਿਸ਼ਲੇਸ਼ਣ",
  "hero.tabs.analytics.headline": "ਅੰਦਾਜ਼ਾ ਲਗਾਉਣ ਤੋਂ ਪਹਿਲਾਂ ਜਾਣੋ ਕਿ ਕੀ ਵਸੂਲਣਾ ਹੈ",
  "hero.tabs.analytics.body":
    "ਆਪਣਾ ਅਸਲ ਖਰਚਾ, ਹਰ ਕੰਮ ਲਈ ਘੱਟੋ-ਘੱਟ ਕੀਮਤ, ਅਤੇ ਆਪਣੇ ਖੇਤਰ ਦੀਆਂ ਹੋਰ ਦੁਕਾਨਾਂ ਨਾਲ ਤੁਲਨਾ ਵੇਖੋ।",
  "hero.tabs.analytics.alt": "ਇੱਕ ਡੈਸ਼ਬੋਰਡ ਜੋ ਪ੍ਰਤੀ ਕੰਮ ਲਾਗਤ, ਘੱਟੋ-ਘੱਟ ਕੀਮਤ ਅਤੇ ਤੁਹਾਡੀਆਂ ਔਸਤ ਕੀਮਤਾਂ ਦੀ ਤੁਲਨਾ ਦਿਖਾਉਂਦਾ ਹੈ",

  "features.everything": "ਤੁਹਾਡੇ ਕਾਰੋਬਾਰ ਲਈ ਲੋੜੀਂਦਾ ਸਭ ਕੁਝ, ਇੱਕੋ ਥਾਂ",
  "features.anyTrade": "ਹਰ ਕਿੱਤੇ ਲਈ ਬਣਾਇਆ ਗਿਆ",

  "ai.badge": "AI ਸਹਾਇਕ",
  "ai.title": "ਆਪਣੇ ਕਾਰੋਬਾਰ ਤੋਂ ਸਵਾਲ ਪੁੱਛੋ, ਅਸਲ ਜਵਾਬ ਪਾਓ",
  "ai.body":
    "ਸਹਾਇਕ ਤੁਹਾਡੇ ਆਪਣੇ ਕੋਟ, ਇਨਵੌਇਸ ਅਤੇ ਖਰਚੇ ਪੜ੍ਹਦਾ ਹੈ — ਆਮ ਸਲਾਹ ਨਹੀਂ ਦਿੰਦਾ। ਪੁੱਛੋ ਕਿ ਇਸ ਮਹੀਨੇ ਕਿੰਨੇ ਕੋਟ ਮਨਜ਼ੂਰ ਹੋਏ, ਜਾਂ ਪਿਛਲੇ ਮਹੀਨੇ ਸਮੱਗਰੀ ਸਸਤੀ ਸੀ ਜਾਂ ਨਹੀਂ — ਅਤੇ ਆਪਣੇ ਅਸਲ ਅੰਕੜਿਆਂ 'ਤੇ ਆਧਾਰਿਤ ਜਵਾਬ ਪਾਓ।",
  "ai.samples.pricing":
    "\"ਕੀ ਮੈਂ ਪਿਛਲੀ ਤਿਮਾਹੀ ਦੇ ਮੁਕਾਬਲੇ ਬਹੁਤ ਘੱਟ ਕੀਮਤ ਲੈ ਰਿਹਾ ਹਾਂ?\"",
  "ai.samples.topClients":
    "\"ਇਸ ਸਾਲ ਕਿਹੜੇ ਗਾਹਕਾਂ ਨੇ ਸਭ ਤੋਂ ਵੱਧ ਭੁਗਤਾਨ ਕੀਤਾ?\"",
  "ai.samples.materials":
    "\"ਕੀ ਮੈਨੂੰ ਹੁਣ ਕੋਈ ਸਮੱਗਰੀ ਸਟਾਕ ਕਰਨੀ ਚਾਹੀਦੀ ਹੈ?\"",
  "ai.chat.question": "ਇਸ ਮਹੀਨੇ ਮੇਰੇ ਕਿੰਨੇ ਕੋਟ ਮਨਜ਼ੂਰ ਹੋਏ?",
  "ai.chat.answer":
    "ਤੁਸੀਂ 14 ਕੋਟ ਭੇਜੇ ਅਤੇ 6 ਮਨਜ਼ੂਰ ਹੋਏ — 43% ਦਰ, ਪਿਛਲੇ ਮਹੀਨੇ ਦੇ 31% ਤੋਂ ਵੱਧ। ਤੁਹਾਡੇ ਪੇਂਟਿੰਗ ਕੋਟ ਸਭ ਤੋਂ ਵਧੀਆ ਚੱਲ ਰਹੇ ਹਨ।",

  "resources.title": "ਮੁਫ਼ਤ ਸਰੋਤ",
  "resources.help.description":
    "FieldQuo ਸੈੱਟਅੱਪ ਅਤੇ ਵਰਤੋਂ ਲਈ ਗਾਈਡਾਂ",
  "resources.faq.description": "ਆਮ ਸਵਾਲਾਂ ਦੇ ਤੇਜ਼ ਜਵਾਬ",
  "resources.contact.description": "ਕਿਸੇ ਅਸਲ ਵਿਅਕਤੀ ਨਾਲ ਗੱਲ ਕਰੋ",

  "pricing.popular": "ਸਭ ਤੋਂ ਪ੍ਰਸਿੱਧ",
  "pricing.selected": "ਚੁਣਿਆ ਗਿਆ",
  "pricing.firstMonth": "ਪਹਿਲਾ ਮਹੀਨਾ",
  "pricing.free": "ਮੁਫ਼ਤ",
  "pricing.then": "ਫਿਰ",
  "pricing.perMonthShort": "/ਮਹੀਨਾ",
  "pricing.seatsUnlimited": "ਅਸੀਮਤ ਕਰਮਚਾਰੀ ਖਾਤੇ",
  "pricing.seatsOne": "1 ਕਰਮਚਾਰੀ ਖਾਤਾ",
  "pricing.seatsMany": "{count} ਕਰਮਚਾਰੀ ਖਾਤੇ",
  "pricing.rbacSeats": "1 ਮੁੱਖ ਖਾਤਾ + {count} ਭੂਮਿਕਾ-ਆਧਾਰਿਤ ਪਹੁੰਚਾਂ",
  "pricing.crewIncluded": "{count} ਕਰੂ ਮੈਂਬਰ ਸ਼ਾਮਲ — ਮੁਫ਼ਤ",
  "pricing.seatsOneIncluded": "1 ਸੀਟ — ਹਵਾਲੇ, ਕੰਮ ਅਤੇ ਬਿਲਿੰਗ",
  "pricing.seatsManyIncluded": "{count} ਸੀਟਾਂ — ਹਵਾਲੇ, ਕੰਮ ਅਤੇ ਬਿਲਿੰਗ",
  "pricingPage.currencyBasis": "ਕੀਮਤਾਂ ਦਾ ਇੱਕੋ ਸੈੱਟ। ਤੁਹਾਨੂੰ ਕਿਸ ਮੁਦਰਾ ਵਿੱਚ ਬਿੱਲ ਕੀਤਾ ਜਾਵੇਗਾ, ਇਹ ਸਾਈਨ ਅੱਪ ਵੇਲੇ ਦਿੱਤੇ ਕਾਰੋਬਾਰੀ ਪਤੇ ਤੋਂ ਤੈਅ ਹੁੰਦਾ ਹੈ: ਕੈਨੇਡੀਅਨ ਕੰਪਨੀਆਂ ਨੂੰ ਕੈਨੇਡੀਅਨ ਡਾਲਰ ਵਿੱਚ ਅਤੇ ਅਮਰੀਕੀ ਕੰਪਨੀਆਂ ਨੂੰ ਅਮਰੀਕੀ ਡਾਲਰ ਵਿੱਚ — ਰਕਮ ਓਹੀ ਰਹਿੰਦੀ ਹੈ, ਕੋਈ ਬਦਲੀ ਨਹੀਂ।",
  "pricing.fullAccess":
    "ਪੂਰੀ ਪਹੁੰਚ — ਕੋਟ, ਇਨਵੌਇਸਿੰਗ, ਸ਼ਡਿਊਲਿੰਗ, ਵਿਸ਼ਲੇਸ਼ਣ",
  "pricing.quoteLimit": "ਹਰ ਮਹੀਨੇ {count} ਕੋਟ ਤੱਕ",
  "pricing.aiIncluded": "AI ਸਹਾਇਕ ਸ਼ਾਮਲ",

  "faq.title": "ਅਕਸਰ ਪੁੱਛੇ ਜਾਂਦੇ ਸਵਾਲ",
  "faq.items.install.q": "ਕੀ ਮੈਨੂੰ ਕੁਝ ਇੰਸਟਾਲ ਕਰਨਾ ਪਵੇਗਾ?",
  "faq.items.install.a":
    "ਨਹੀਂ — FieldQuo ਪੂਰੀ ਤਰ੍ਹਾਂ ਤੁਹਾਡੇ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਚੱਲਦਾ ਹੈ। ਤੁਸੀਂ ਇਸਨੂੰ ਆਪਣੇ ਫ਼ੋਨ ਤੋਂ ਵੀ ਵਰਤ ਸਕਦੇ ਹੋ।",
  "faq.items.onlinePayment.q": "ਕੀ ਮੇਰੇ ਗਾਹਕ ਆਨਲਾਈਨ ਭੁਗਤਾਨ ਕਰ ਸਕਦੇ ਹਨ?",
  "faq.items.onlinePayment.a":
    "ਹਾਂ। ਆਪਣਾ Stripe ਖਾਤਾ ਜੋੜੋ ਅਤੇ ਗਾਹਕ ਸਿੱਧਾ ਇਨਵੌਇਸ ਈਮੇਲ ਤੋਂ ਭੁਗਤਾਨ ਕਰ ਸਕਦੇ ਹਨ — ਪੈਸੇ ਸਿੱਧੇ ਤੁਹਾਨੂੰ ਜਾਂਦੇ ਹਨ।",
  "faq.items.financing.q": "ਕੀ ਮੇਰੇ ਗਾਹਕ ਸਮੇਂ ਨਾਲ ਭੁਗਤਾਨ ਕਰ ਸਕਦੇ ਹਨ?",
  "faq.items.financing.a":
    "ਹਾਂ। ਸੈਟਿੰਗਜ਼ → ਭੁਗਤਾਨ ਵਿੱਚ Affirm ਚਾਲੂ ਕਰੋ ਅਤੇ ਗਾਹਕ ਚੈੱਕਆਊਟ 'ਤੇ ਇਨਵੌਇਸ ਨੂੰ ਮਹੀਨਾਵਾਰ ਕਿਸ਼ਤਾਂ ਵਿੱਚ ਵੰਡ ਸਕਦੇ ਹਨ, ਜਦਕਿ ਤੁਹਾਨੂੰ ਪੂਰੀ ਰਕਮ ਪਹਿਲਾਂ ਹੀ ਮਿਲ ਜਾਂਦੀ ਹੈ।",
  "faq.items.permissions.q":
    "ਕੀ ਮੈਂ ਕੰਟਰੋਲ ਕਰ ਸਕਦਾ ਹਾਂ ਕਿ ਮੇਰੇ ਕਰਮਚਾਰੀ ਕੀ ਵੇਖਣ ਤੇ ਕਰਨ?",
  "faq.items.permissions.a":
    "ਹਾਂ। ਹਰ ਟੀਮ ਮੈਂਬਰ ਦੀ ਇੱਕ ਭੂਮਿਕਾ ਹੁੰਦੀ ਹੈ — ਕਰਮਚਾਰੀ, ਸੁਪਰਵਾਈਜ਼ਰ ਜਾਂ ਐਡਮਿਨ — ਜੋ ਤੈਅ ਕਰਦੀ ਹੈ ਕਿ ਉਹ ਕੀ ਬਣਾ, ਸੌਂਪ ਅਤੇ ਵੇਖ ਸਕਦਾ ਹੈ।",
  "faq.items.trade.q": "ਜੇ ਮੇਰਾ ਕੰਮ ਸੂਚੀ ਵਿੱਚ ਨਾ ਹੋਵੇ ਤਾਂ?",
  "faq.items.trade.a":
    "FieldQuo ਕਿਸੇ ਵੀ ਠੇਕੇਦਾਰੀ ਜਾਂ ਘਰੇਲੂ ਸੇਵਾ ਕਾਰੋਬਾਰ ਲਈ ਕੰਮ ਕਰਦਾ ਹੈ। ਤੁਸੀਂ ਸੇਵਾ ਸ਼੍ਰੇਣੀਆਂ ਚਾਲੂ ਜਾਂ ਬੰਦ ਕਰ ਸਕਦੇ ਹੋ ਅਤੇ ਆਪਣੀਆਂ ਕੀਮਤਾਂ ਤੈਅ ਕਰ ਸਕਦੇ ਹੋ।",
  "faq.items.contract.q": "ਕੀ ਕੋਈ ਇਕਰਾਰਨਾਮਾ ਜਾਂ ਲੰਮੀ ਵਚਨਬੱਧਤਾ ਹੈ?",
  "faq.items.contract.a":
    "ਨਹੀਂ। ਪਲਾਨ ਮਹੀਨਾਵਾਰ ਹਨ — ਕਿਸੇ ਵੀ ਵੇਲੇ ਰੱਦ ਕਰੋ।",

  "features.title": "ਕੰਮ ਚਲਾਉਣ ਲਈ ਸਭ ਕੁਝ",
  "features.quotes.title": "ਮਿੰਟਾਂ ਵਿੱਚ ਕੋਟ",
  "features.quotes.body":
    "ਆਪਣੇ ਕੈਟਾਲਾਗ ਤੋਂ ਕੀਮਤ ਲਗਾਓ, ਫ਼ੋਟੋਆਂ ਜੋੜੋ, ਅਤੇ ਅਜਿਹਾ ਕੋਟ ਭੇਜੋ ਜਿਸ ਨੂੰ ਗਾਹਕ ਫ਼ੋਨ ਤੋਂ ਮਨਜ਼ੂਰ ਕਰ ਸਕੇ।",
  "features.invoices.title": "ਇਨਵੌਇਸ ਜਿਨ੍ਹਾਂ ਦਾ ਭੁਗਤਾਨ ਹੁੰਦਾ ਹੈ",
  "features.invoices.body":
    "ਮਨਜ਼ੂਰ ਕੋਟ ਨੂੰ ਇੱਕ ਕਲਿੱਕ ਵਿੱਚ ਇਨਵੌਇਸ ਬਣਾਓ, ਕਾਰਡ ਭੁਗਤਾਨ ਲਵੋ, ਅਤੇ ਬਕਾਇਆ ਰਕਮ ਟਰੈਕ ਕਰੋ।",
  "features.scheduling.title": "ਭਰੋਸੇਯੋਗ ਸ਼ਡਿਊਲਿੰਗ",
  "features.scheduling.body":
    "ਕੰਮ ਬੁੱਕ ਕਰੋ, ਟੀਮਾਂ ਸੌਂਪੋ, ਅਤੇ ਗਾਹਕਾਂ ਨੂੰ ਤੁਹਾਡੀ ਅਸਲ ਉਪਲਬਧਤਾ ਵਿੱਚੋਂ ਸਮਾਂ ਚੁਣਨ ਦਿਓ।",
  "features.followups.title": "ਆਪਣੇ-ਆਪ ਫਾਲੋ-ਅੱਪ",
  "features.followups.body":
    "ਜਵਾਬ ਤੋਂ ਬਿਨਾਂ ਕੋਟ ਅਤੇ ਬਕਾਇਆ ਇਨਵੌਇਸ ਆਪਣੇ-ਆਪ ਯਾਦ ਕਰਵਾਏ ਜਾਂਦੇ ਹਨ, ਤੁਹਾਡੇ ਸ਼ਬਦਾਂ ਵਿੱਚ।",

  "pricing.title": "ਸਧਾਰਨ, ਪਾਰਦਰਸ਼ੀ ਕੀਮਤਾਂ",
  "pricing.subtitle":
    "ਹਰ ਪਲਾਨ ਵਿੱਚ ਕੋਟ, ਇਨਵੌਇਸਿੰਗ ਅਤੇ ਸ਼ਡਿਊਲਿੰਗ ਸ਼ਾਮਲ ਹੈ। ਆਪਣੀ ਟੀਮ ਦੇ ਆਕਾਰ ਮੁਤਾਬਕ ਚੁਣੋ।",
  "pricing.month": "/ਮਹੀਨਾ",
  "pricing.cta": "ਮੁਫ਼ਤ ਅਜ਼ਮਾਇਸ਼ ਸ਼ੁਰੂ ਕਰੋ",
  "pricing.empty":
    "ਪਲਾਨ ਤਿਆਰ ਕੀਤੇ ਜਾ ਰਹੇ ਹਨ — ਜਲਦੀ ਵਾਪਸ ਆਓ, ਜਾਂ ਸ਼ੁਰੂਆਤੀ ਕੀਮਤ ਲਈ ਸੰਪਰਕ ਕਰੋ।",

  "contact.title": "ਸਾਡੇ ਨਾਲ ਗੱਲ ਕਰੋ",
  "contact.subtitle": "ਉਤਪਾਦ, ਕੀਮਤ ਜਾਂ ਡਾਟਾ ਤਬਦੀਲੀ ਬਾਰੇ ਸਵਾਲ।",
  "contact.name": "ਤੁਹਾਡਾ ਨਾਮ",
  "contact.email": "ਈਮੇਲ",
  "contact.message": "ਸੁਨੇਹਾ",
  "contact.send": "ਸੁਨੇਹਾ ਭੇਜੋ",
  "contact.sending": "ਭੇਜਿਆ ਜਾ ਰਿਹਾ ਹੈ…",
  "contact.sent": "ਧੰਨਵਾਦ — ਅਸੀਂ ਜਲਦੀ ਸੰਪਰਕ ਕਰਾਂਗੇ।",
  "contact.error": "ਕੁਝ ਗ਼ਲਤ ਹੋ ਗਿਆ। ਦੁਬਾਰਾ ਕੋਸ਼ਿਸ਼ ਕਰੋ ਜਾਂ ਸਿੱਧਾ ਈਮੇਲ ਕਰੋ।",

  "booking.work.serviceLabel": "ਇਹ ਕਿਸ ਤਰ੍ਹਾਂ ਦਾ ਕੰਮ ਹੈ?",
  "booking.work.serviceUnsure": "ਹਾਲੇ ਪੱਕਾ ਨਹੀਂ",
  "booking.work.notesLabel": "ਹੋਰ ਕੁਝ ਜੋ ਸਾਨੂੰ ਪਤਾ ਹੋਣਾ ਚਾਹੀਦਾ ਹੈ?",
  "booking.work.notesPlaceholder":
    "ਕੀ ਕਰਨਾ ਹੈ, ਲਗਭਗ ਕਿੰਨਾ ਵੱਡਾ, ਪਹੁੰਚ ਬਾਰੇ ਕੋਈ ਖ਼ਾਸ ਗੱਲ…",
  "booking.work.notesHint": "ਚੋਣਵਾਂ — ਇਸ ਨਾਲ ਅਸੀਂ ਤਿਆਰ ਹੋ ਕੇ ਆਉਂਦੇ ਹਾਂ।",

  "footer.product": "ਉਤਪਾਦ",
  "footer.company": "ਕੰਪਨੀ",
  "footer.legal": "ਕਾਨੂੰਨੀ",
  "footer.privacy": "ਪਰਦੇਦਾਰੀ",
  "footer.terms": "ਸ਼ਰਤਾਂ",
  "footer.security": "ਸੁਰੱਖਿਆ",
  "footer.rights": "ਸਾਰੇ ਹੱਕ ਰਾਖਵੇਂ ਹਨ।",
  "footer.tagline":
    "ਠੇਕੇਦਾਰਾਂ ਅਤੇ ਘਰੇਲੂ ਸੇਵਾ ਪੇਸ਼ੇਵਰਾਂ ਲਈ ਸਭ-ਇੱਕ-ਥਾਂ ਪਲੇਟਫਾਰਮ — ਕੋਟ, ਸ਼ਡਿਊਲਿੰਗ, ਇਨਵੌਇਸਿੰਗ ਅਤੇ ਭੁਗਤਾਨ ਇੱਕੋ ਥਾਂ।",
  "footer.links.help": "ਮਦਦ ਕੇਂਦਰ",
  "footer.links.faq": "ਅਕਸਰ ਪੁੱਛੇ ਸਵਾਲ",
  "footer.links.blog": "ਬਲੌਗ",
  "footer.links.contact": "ਸਾਡੇ ਨਾਲ ਸੰਪਰਕ ਕਰੋ",
  "footer.links.about": "ਸਾਡੇ ਬਾਰੇ",
  "footer.links.careers": "ਨੌਕਰੀਆਂ",
  "footer.links.privacy": "ਪਰਦੇਦਾਰੀ ਨੀਤੀ",
  "footer.links.terms": "ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ",
  "footer.links.security": "ਸੁਰੱਖਿਆ",

  "theme.label": "ਥੀਮ",
  "theme.light": "ਹਲਕਾ",
  "theme.dark": "ਗੂੜ੍ਹਾ",
  "theme.system": "ਸਿਸਟਮ ਮੁਤਾਬਕ",

  "pricingPage.title": "ਸਧਾਰਨ, ਪਾਰਦਰਸ਼ੀ ਕੀਮਤਾਂ",
  "pricingPage.subtitle":
    "ਹਰ ਪਲਾਨ ਵਿੱਚ ਕੋਟ, ਬਿਲਿੰਗ ਅਤੇ ਸ਼ਡਿਊਲਿੰਗ ਸ਼ਾਮਲ ਹਨ। ਆਪਣੀ ਟੀਮ ਦੇ ਆਕਾਰ ਮੁਤਾਬਕ ਪਲਾਨ ਚੁਣੋ।",
  "pricingPage.perMonth": "/ਮਹੀਨਾ",
  "pricingPage.currencyNote":
    "ਸਾਰੀਆਂ ਕੀਮਤਾਂ {currency} ਵਿੱਚ ਹਨ। ਤੁਹਾਡੀ ਬਿਲਿੰਗ ਕਰੰਸੀ ਉਸ ਦੇਸ਼ ਤੋਂ ਤੈਅ ਹੁੰਦੀ ਹੈ ਜੋ ਤੁਸੀਂ ਸਾਈਨ ਅੱਪ ਵੇਲੇ ਚੁਣਦੇ ਹੋ।",
  "pricingPage.taxNote": "ਲਾਗੂ ਟੈਕਸ ਵੱਖਰੇ।",
  "pricingPage.emptyTitle":
    "ਪਲਾਨ ਅਜੇ ਤੈਅ ਹੋ ਰਹੇ ਹਨ — ਥੋੜ੍ਹੀ ਦੇਰ ਬਾਅਦ ਵੇਖੋ।",
  "pricingPage.emptyCta": "ਅਰਲੀ ਐਕਸੈਸ ਕੀਮਤਾਂ ਬਾਰੇ ਸਾਨੂੰ ਪੁੱਛੋ",

  "notFound.title": "ਸਾਨੂੰ ਉਹ ਪੰਨਾ ਨਹੀਂ ਮਿਲਿਆ",
  "notFound.body":
    "ਹੋ ਸਕਦਾ ਹੈ ਲਿੰਕ ਟੁੱਟਾ ਹੋਵੇ ਜਾਂ ਪੰਨਾ ਹਿਲਾ ਦਿੱਤਾ ਗਿਆ ਹੋਵੇ। ਲੰਮੇ ਲਿੰਕ ਟੈਕਸਟ ਸੁਨੇਹਿਆਂ ਵਿੱਚ ਅਕਸਰ ਅੱਧੇ ਕੱਟੇ ਜਾਂਦੇ ਹਨ — ਵੇਖੋ ਕਿ ਤੁਹਾਡੇ ਕੋਲ ਪੂਰਾ ਪਤਾ ਹੈ।",
  "notFound.home": "ਮੁੱਖ ਪੰਨੇ 'ਤੇ ਵਾਪਸ",

  "common.loading": "ਲੋਡ ਹੋ ਰਿਹਾ ਹੈ…",
  "common.learnMore": "ਹੋਰ ਜਾਣੋ",
  "common.getStarted": "ਸ਼ੁਰੂ ਕਰੋ",
  "common.back": "ਵਾਪਸ",

  // ── Feature names, from lib/marketing/featureMatrix.js ──────────────────
  //
  // Trade terms, not software words. Where the trade has its own word in this
  // language it is used in preference to a translation of the English one.
  // Where the trade genuinely says the English word, the loanword stays and
  // scripts/check-feature-labels.mjs carries the exemption with a reason, so
  // an untranslated line cannot hide behind that argument.
  "feature.leads.name": "ਲੀਡਾਂ ਦੀ ਟਰੈਕਿੰਗ",
  "feature.leads.summary":
    "ਹਰ ਪੁੱਛ-ਗਿੱਛ ਇੱਕੋ ਸੂਚੀ ਵਿੱਚ, ਗਰਮ ਤੋਂ ਠੰਢੀ ਤੱਕ ਦਰਜਾਬੰਦੀ ਨਾਲ, ਅਤੇ ਇੱਕ ਕਲਿੱਕ ਵਿੱਚ ਕੋਟ ਬਣ ਜਾਂਦੀ ਹੈ।",
  "feature.lead_form.name": "ਤੁਹਾਡੀ ਵੈੱਬਸਾਈਟ ਲਈ ਲੀਡ ਫਾਰਮ",
  "feature.lead_form.summary":
    "ਕਿਸੇ ਵੀ ਸਾਈਟ 'ਤੇ ਲਾਉਣ ਵਾਲਾ ਫਾਰਮ; ਜੋ ਆਉਂਦਾ ਹੈ ਉਹ ਤੁਹਾਡੀ ਲੀਡ ਸੂਚੀ ਵਿੱਚ ਜਾਂਦਾ ਹੈ, ਈਮੇਲ ਵਿੱਚ ਨਹੀਂ।",
  "feature.quotes.name": "ਕੋਟ",
  "feature.quotes.summary":
    "ਆਪਣੇ ਰੇਟਾਂ ਨਾਲ ਕੋਟ ਬਣਾਓ, ਕਮਰੇ ਜਾਂ ਕੰਮ ਦੇ ਹਿਸਾਬ ਨਾਲ ਵੰਡੋ, ਅਤੇ ਫੋਟੋਆਂ ਲਾਓ।",
  "feature.priced_options.name": "ਵਧੀਆ, ਹੋਰ ਵਧੀਆ, ਸਭ ਤੋਂ ਵਧੀਆ ਵਿਕਲਪ",
  "feature.priced_options.summary":
    "ਇੱਕੋ ਕੰਮ ਤਿੰਨ ਕੀਮਤਾਂ 'ਤੇ ਭੇਜੋ ਅਤੇ ਗਾਹਕ ਨੂੰ ਆਪਣੀ ਮਰਜ਼ੀ ਦਾ ਚੁਣਨ ਦਿਓ।",
  "feature.quote_send.name": "ਈਮੇਲ ਰਾਹੀਂ ਕੋਟ ਭੇਜੋ",
  "feature.quote_send.summary":
    "ਇੱਕ ਬਟਨ ਤੁਹਾਡੇ ਪਤੇ ਤੋਂ ਕੋਟ ਭੇਜਦਾ ਹੈ, PDF ਨਾਲ, ਗਾਹਕ ਦੀ ਭਾਸ਼ਾ ਵਿੱਚ।",
  "feature.quote_pdf.name": "ਤੁਹਾਡੇ ਰੰਗਾਂ ਵਿੱਚ ਕੋਟ PDF",
  "feature.quote_pdf.summary":
    "ਤੁਹਾਡੇ ਲੋਗੋ ਅਤੇ ਰੰਗ ਵਾਲਾ PDF — ਇਸ 'ਤੇ ਕਿਤੇ ਵੀ FieldQuo ਨਹੀਂ ਲਿਖਿਆ।",
  "feature.online_approval.name": "ਗਾਹਕ ਆਨਲਾਈਨ ਮਨਜ਼ੂਰੀ ਦੇ ਕੇ ਦਸਤਖਤ ਕਰੇ",
  "feature.online_approval.summary":
    "ਗਾਹਕ ਲਿੰਕ ਖੋਲ੍ਹਦਾ ਹੈ, ਵਾਧੂ ਕੰਮ ਚੁਣਦਾ ਹੈ, ਦਸਤਖਤ ਕਰਦਾ ਹੈ — ਕੰਮ ਸ਼ੁਰੂ, ਨਾ ਛਪਾਈ ਨਾ ਫ਼ੋਨ ਦੇ ਚੱਕਰ।",
  "feature.ai_quote_review.name": "AI ਨਾਲ ਕੋਟ ਦੀ ਜਾਂਚ",
  "feature.ai_quote_review.summary":
    "ਭੇਜਣ ਤੋਂ ਪਹਿਲਾਂ: ਕੀ ਰਹਿ ਗਿਆ, ਜਿੱਤੇ ਕੰਮਾਂ ਦੇ ਮੁਕਾਬਲੇ ਕੀਮਤ ਕਿੱਥੇ ਖੜ੍ਹੀ ਹੈ, ਅਤੇ ਸਾਫ਼ ਸ਼ਬਦ।",
  "feature.add_on_upsell.name": "ਸੁਝਾਏ ਵਾਧੂ ਕੰਮ",
  "feature.add_on_upsell.summary":
    "ਕੋਟ ਦੇ ਹੇਠਾਂ ਮਰਜ਼ੀ ਦੇ ਵਾਧੂ ਕੰਮ, ਤੁਹਾਡੇ ਪੁਰਾਣੇ ਰੇਟਾਂ ਤੋਂ ਕੀਮਤ, ਜੋ ਗਾਹਕ ਚੁਣ ਸਕਦਾ ਹੈ।",
  "feature.follow_ups.name": "ਆਪਣੇ ਆਪ ਯਾਦ-ਦਹਾਨੀਆਂ",
  "feature.follow_ups.summary":
    "ਜਿਸ ਕੋਟ ਦਾ ਜਵਾਬ ਨਾ ਆਵੇ, ਉਸ ਦਾ ਪਿੱਛਾ ਤੁਹਾਡੇ ਸਮੇਂ ਮੁਤਾਬਕ, ਤੁਹਾਡੇ ਸ਼ਬਦਾਂ ਵਿੱਚ, ਬਿਨਾਂ ਯਾਦ ਰੱਖੇ ਹੁੰਦਾ ਹੈ।",
  "feature.voice_receptionist.name": "AI ਰਿਸੈਪਸ਼ਨਿਸਟ",
  "feature.voice_receptionist.summary":
    "ਜਦੋਂ ਤੁਸੀਂ ਪੌੜੀ 'ਤੇ ਹੋ, ਫ਼ੋਨ ਚੁੱਕਦਾ ਹੈ, ਵੇਰਵੇ ਲੈਂਦਾ ਹੈ, ਮੁਲਾਕਾਤ ਬੁੱਕ ਕਰਦਾ ਹੈ ਅਤੇ ਰਿਕਾਰਡਿੰਗ ਛੱਡ ਦਿੰਦਾ ਹੈ।",
  "feature.voice_callbacks.name": "ਪੁਸ਼ਟੀ ਵਾਲੀਆਂ ਕਾਲਾਂ",
  "feature.voice_callbacks.summary":
    "ਸਹਾਇਕ ਪਹਿਲਾਂ ਹੀ ਫ਼ੋਨ ਕਰਕੇ ਕੱਲ੍ਹ ਦੀਆਂ ਮੁਲਾਕਾਤਾਂ ਪੱਕੀਆਂ ਕਰਦਾ ਹੈ, ਤਾਂ ਜੋ ਸਵੇਰ ਖਰਾਬ ਨਾ ਹੋਵੇ।",
  "feature.call_to_quote.name": "ਕਾਲ ਤੋਂ ਬਣਿਆ ਕੋਟ",
  "feature.call_to_quote.summary":
    "ਕਾਲ ਕਰਨ ਵਾਲੇ ਨੇ ਜੋ ਦੱਸਿਆ, ਉਹ ਕੋਟ ਦੇ ਖਰੜੇ ਵਜੋਂ ਵਾਪਸ ਆਉਂਦਾ ਹੈ — ਖੋਲ੍ਹੋ, ਠੀਕ ਕਰੋ, ਭੇਜੋ।",
  "feature.booking_page.name": "ਆਨਲਾਈਨ ਬੁਕਿੰਗ ਪੰਨਾ",
  "feature.booking_page.summary":
    "ਗਾਹਕ ਤੁਹਾਡੀ ਅਸਲ ਵਿਹਲ ਵਿੱਚੋਂ ਸਮਾਂ ਚੁਣਦੇ ਹਨ, ਸਫ਼ਰ ਦਾ ਸਮਾਂ ਅਤੇ ਪਹੁੰਚਣ ਦੀ ਵਿੰਡੋ ਸਮੇਤ।",
  "feature.booking_deposit.name": "ਸਮਾਂ ਰੋਕਣ ਲਈ ਪੇਸ਼ਗੀ",
  "feature.booking_deposit.summary":
    "ਬੁਕਿੰਗ ਵੇਲੇ ਵਿਜ਼ਿਟ ਦੀ ਫ਼ੀਸ ਲਵੋ ਅਤੇ ਕੰਮ ਹੋਣ 'ਤੇ ਇਨਵੌਇਸ ਵਿੱਚੋਂ ਘਟਾ ਦਿਓ।",
  "feature.website_builder.name": "ਤੁਹਾਡੀ ਆਪਣੀ ਵੈੱਬਸਾਈਟ",
  "feature.website_builder.summary":
    "ਜੋ ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਦੱਸਿਆ ਉਸ ਤੋਂ ਲਿਖੀ ਸਾਈਟ, ਤੁਹਾਡੇ ਆਪਣੇ ਪਤੇ 'ਤੇ, ਜਿਸ ਨੂੰ ਬਲਾਕ-ਦਰ-ਬਲਾਕ ਬਦਲ ਸਕਦੇ ਹੋ।",
  "feature.instant_quotes.name": "ਤੁਰੰਤ ਆਨਲਾਈਨ ਅੰਦਾਜ਼ਾ",
  "feature.instant_quotes.summary":
    "ਆਉਣ ਵਾਲਾ ਕੁਝ ਸਵਾਲਾਂ ਦੇ ਜਵਾਬ ਦਿੰਦਾ ਹੈ ਅਤੇ ਤੁਹਾਡੇ ਰੇਟਾਂ ਤੋਂ ਮੌਕੇ 'ਤੇ ਕੀਮਤ ਦਾ ਦਾਇਰਾ ਮਿਲਦਾ ਹੈ।",
  "feature.self_quote.name": "ਗਾਹਕ ਆਪ ਆਪਣੇ ਕੰਮ ਦੀ ਕੀਮਤ ਲਾਵੇ",
  "feature.self_quote.summary":
    "ਇੱਕ ਖੁੱਲ੍ਹਾ ਫਾਰਮ ਜਿੱਥੇ ਘਰ ਵਾਲਾ ਕੰਮ ਦੱਸਦਾ ਹੈ ਅਤੇ ਫੋਟੋਆਂ ਪਾਉਂਦਾ ਹੈ; ਇਹ ਸ਼ੁਰੂ ਹੋਏ ਕੋਟ ਵਜੋਂ ਆਉਂਦਾ ਹੈ।",
  "feature.kitchen_designer.name": "ਰਸੋਈ ਅਤੇ ਕੈਬਨਿਟ ਡਿਜ਼ਾਈਨਰ",
  "feature.kitchen_designer.summary":
    "ਲਾਈਨ ਵਾਹੋ, ਫਿਨਿਸ਼ ਚੁਣੋ, ਅਤੇ ਕੈਬਨਿਟ ਦੀਆਂ ਕੀਮਤਾਂ ਤੇ ਨਕਸ਼ਾ ਸਿੱਧਾ ਕੋਟ ਵਿੱਚ ਚਲੇ ਜਾਂਦੇ ਹਨ।",
  "feature.aerial_measure.name": "ਉੱਪਰੋਂ ਮਾਪ",
  "feature.aerial_measure.summary":
    "ਪਤਾ ਲਿਖੋ ਅਤੇ ਛੱਤ ਦਾ ਖੇਤਰ ਤੇ ਢਲਾਣ ਲਵੋ, ਜਾਂ ਡਰਾਈਵਵੇਅ ਜਾਂ ਵਿਹੜਾ ਖਿੱਚੋ — ਉੱਥੇ ਗਏ ਬਿਨਾਂ।",
  "feature.funnels.name": "ਲੀਡ ਫਨਲ",
  "feature.funnels.summary":
    "ਇਸ਼ਤਿਹਾਰ ਜਾਂ ਫਲਾਇਰ ਲਈ ਕਈ ਕਦਮਾਂ ਵਾਲੇ ਪੰਨੇ, ਨਾਲ ਇਹ ਅੰਕੜੇ ਕਿ ਲੋਕ ਕਿੱਥੇ ਛੱਡ ਜਾਂਦੇ ਹਨ।",
  "feature.email_campaigns.name": "ਈਮੇਲ ਮੁਹਿੰਮਾਂ",
  "feature.email_campaigns.summary":
    "ਇੱਕ ਵਾਰ ਲਿਖੋ, ਆਪਣੇ ਪਤੇ ਤੋਂ ਗਾਹਕਾਂ ਦੀ ਸੂਚੀ ਨੂੰ ਭੇਜੋ, ਅਤੇ ਵੇਖੋ ਕਿਸ ਤੱਕ ਪਹੁੰਚਿਆ।",
  "feature.door_hanger_routes.name": "ਡੋਰ-ਹੈਂਗਰ ਰੂਟ",
  "feature.door_hanger_routes.summary":
    "ਗਲੀਆਂ ਦੀ ਯੋਜਨਾ ਬਣਾਓ, ਵੰਡੋ, ਅਤੇ ਜਿਵੇਂ-ਜਿਵੇਂ ਤੁਹਾਡਾ ਕਰੂ ਮੁਹੱਲਾ ਕਰਦਾ ਹੈ, ਟਿੱਕ ਲਾਉਂਦੇ ਜਾਓ।",
  "feature.review_requests.name": "ਰਿਵਿਊ ਦੀ ਬੇਨਤੀ",
  "feature.review_requests.summary":
    "ਕੰਮ ਪੂਰਾ ਤੇ ਭੁਗਤਾਨ ਹੋਣ ਮਗਰੋਂ ਗਾਹਕ ਨੂੰ ਇੱਕ ਨਿਮਰ ਬੇਨਤੀ ਜਾਂਦੀ ਹੈ।",
  "feature.testimonials.name": "ਤੁਹਾਡੀ ਸਾਈਟ 'ਤੇ ਗਾਹਕਾਂ ਦੇ ਬੋਲ",
  "feature.testimonials.summary":
    "ਗਾਹਕਾਂ ਨੇ ਜੋ ਕਿਹਾ ਉਹ ਇਕੱਠਾ ਕਰੋ ਅਤੇ ਆਪਣੀ ਵੈੱਬਸਾਈਟ ਤੇ ਕੋਟਾਂ ਵਿੱਚ ਵਿਖਾਓ।",
  "feature.referrals.name": "ਕਿਸੇ ਹੋਰ ਠੇਕੇਦਾਰ ਨੂੰ ਸੱਦੋ",
  "feature.referrals.summary":
    "ਸੱਦਾ ਭੇਜੋ; ਜਦੋਂ ਉਹ ਸਾਈਨ ਅੱਪ ਕਰੇ, ਤੁਹਾਡੇ ਦੋਵਾਂ ਦੇ ਖਾਤੇ ਵਿੱਚ ਇੱਕ ਮੁਫ਼ਤ ਮਹੀਨਾ ਜੁੜਦਾ ਹੈ।",
  "feature.embeds.name": "ਲਾਉਣ ਵਾਲੇ ਵਿਜੇਟ",
  "feature.embeds.summary":
    "ਆਪਣੀ ਮੌਜੂਦਾ ਵੈੱਬਸਾਈਟ ਵਿੱਚ ਇੱਕ ਲਾਈਨ ਚਿਪਕਾਓ ਅਤੇ ਬੁਕਿੰਗ, ਕੋਟ ਫਾਰਮ ਜਾਂ ਰਿਵਿਊ ਲਾ ਲਵੋ।",
  "feature.bio_link.name": "ਸਾਰੇ ਪ੍ਰੋਫਾਈਲਾਂ ਲਈ ਇੱਕ ਲਿੰਕ",
  "feature.bio_link.summary":
    "ਤੁਹਾਡੇ Instagram ਜਾਂ ਟਰੱਕ ਦੇ ਸਟਿੱਕਰ ਲਈ ਇੱਕ ਹੀ ਪੰਨਾ, ਜੋ ਤੁਹਾਡੀਆਂ ਸਾਰੀਆਂ ਸੇਵਾਵਾਂ ਵੱਲ ਲੈ ਜਾਂਦਾ ਹੈ।",
  "feature.subcontractor_bids.name": "ਤੁਹਾਡੀ ਬੋਲੀ ਵਿੱਚ ਸਬ-ਠੇਕੇਦਾਰ ਦੇ ਰੇਟ",
  "feature.subcontractor_bids.summary":
    "ਸਬ-ਠੇਕੇਦਾਰ ਦਾ ਕੋਟ ਸਿੱਧਾ ਲਾਗਤ ਵਜੋਂ ਲਵੋ, ਉੱਤੇ ਮੁਨਾਫ਼ਾ ਲਾਓ, ਅਤੇ ਗਾਹਕ ਨੂੰ ਸਿਰਫ਼ ਤੁਹਾਡੀ ਕੀਮਤ ਦਿਸੇ।",
  "feature.jobs.name": "ਜੌਬਾਂ",
  "feature.jobs.summary":
    "ਮਨਜ਼ੂਰ ਹੋਇਆ ਕੋਟ ਜੌਬ ਬਣ ਜਾਂਦਾ ਹੈ, ਜਿਸ 'ਤੇ ਕੰਮ ਦਾ ਵੇਰਵਾ, ਪਤਾ ਅਤੇ ਕਾਗਜ਼ ਪਹਿਲਾਂ ਹੀ ਹੁੰਦੇ ਹਨ।",
  "feature.scheduling.name": "ਸ਼ਡਿਊਲਿੰਗ ਅਤੇ ਡਿਸਪੈਚ",
  "feature.scheduling.summary":
    "ਕੈਲੰਡਰ ਵਿੱਚ ਵਿਜ਼ਿਟ ਪਾਓ, ਜਾਣ ਵਾਲਾ ਬੰਦਾ ਲਾਓ, ਅਤੇ ਸਾਰੇ ਕਰੂ ਦਾ ਹਫ਼ਤਾ ਇੱਕੋ ਵਾਰ ਵੇਖੋ।",
  "feature.crew_shifts.name": "ਕਰੂ ਦੀਆਂ ਸ਼ਿਫਟਾਂ",
  "feature.crew_shifts.summary":
    "ਅਗਲੇ ਹਫ਼ਤੇ ਦਾ ਸ਼ਡਿਊਲ ਬਣਾਓ, ਸਾਂਝਾ ਕਰੋ, ਅਤੇ ਹਰ ਕੋਈ ਆਪਣੀਆਂ ਸ਼ਿਫਟਾਂ ਵੇਖੇ।",
  "feature.recurring_jobs.name": "ਵਾਰ-ਵਾਰ ਹੋਣ ਵਾਲੇ ਕੰਮ",
  "feature.recurring_jobs.summary":
    "ਹਫ਼ਤਾਵਾਰੀ, ਮਹੀਨਾਵਾਰ ਜਾਂ ਮੌਸਮੀ ਕੰਮ ਜੋ ਆਪਣੇ ਆਪ ਕੈਲੰਡਰ ਵਿੱਚ ਮੁੜ ਆਉਂਦਾ ਹੈ।",
  "feature.appointment_reminders.name": "ਮੁਲਾਕਾਤ ਦੇ ਰਿਮਾਈਂਡਰ",
  "feature.appointment_reminders.summary":
    "ਤੁਹਾਡੇ ਪਹੁੰਚਣ ਤੋਂ ਪਹਿਲਾਂ ਗਾਹਕ ਨੂੰ ਸੁਨੇਹਾ ਜਾਂਦਾ ਹੈ, ਤਾਂ ਜੋ ਘੱਟ ਦਰਵਾਜ਼ੇ ਬੰਦ ਮਿਲਣ।",
  "feature.client_reschedule.name": "ਗਾਹਕ ਆਪ ਸਮਾਂ ਬਦਲੇ",
  "feature.client_reschedule.summary":
    "ਪੁਸ਼ਟੀ ਵਿੱਚ ਦਿੱਤਾ ਲਿੰਕ ਗਾਹਕ ਨੂੰ ਬਿਨਾਂ ਫ਼ੋਨ ਕੀਤੇ ਵਿਜ਼ਿਟ ਬਦਲਣ ਦਿੰਦਾ ਹੈ।",
  "feature.job_costing.name": "ਜੌਬ ਕੌਸਟਿੰਗ",
  "feature.job_costing.summary":
    "ਲੇਬਰ, ਮਟੀਰੀਅਲ ਅਤੇ ਖਰਚੇ ਉਸ ਕੀਮਤ ਦੇ ਸਾਹਮਣੇ ਜੋ ਤੁਸੀਂ ਦਿੱਤੀ ਸੀ — ਤਾਂ ਜੋ ਪਤਾ ਲੱਗੇ ਅਸਲ ਵਿੱਚ ਕੀ ਬਚਿਆ।",
  "feature.materials.name": "ਕੰਮ 'ਤੇ ਲੱਗਾ ਮਟੀਰੀਅਲ",
  "feature.materials.summary":
    "ਸਾਈਟ 'ਤੇ ਕੀ ਗਿਆ, ਕਿੰਨੇ ਦਾ ਪਿਆ, ਅਤੇ ਹਾਲੇ ਕੀ ਖਰੀਦਣਾ ਹੈ।",
  "feature.job_photos.name": "ਪਹਿਲਾਂ ਅਤੇ ਬਾਅਦ ਦੀਆਂ ਫੋਟੋਆਂ",
  "feature.job_photos.summary":
    "ਜੌਬ ਨਾਲ ਜੁੜੀਆਂ ਫੋਟੋਆਂ, ਕੋਟ, ਇਨਵੌਇਸ ਜਾਂ ਵੈੱਬਸਾਈਟ ਵਿੱਚ ਪਾਉਣ ਲਈ ਤਿਆਰ।",
  "feature.checklists.name": "ਜੌਬ ਚੈੱਕਲਿਸਟ",
  "feature.checklists.summary":
    "ਸਾਈਟ 'ਤੇ ਕੀ-ਕੀ ਕਰਨਾ ਹੈ ਦੀ ਸੂਚੀ, ਜਿਸ 'ਤੇ ਕਰਨ ਵਾਲਾ ਟਿੱਕ ਲਾਉਂਦਾ ਹੈ।",
  "feature.suggested_tasks.name": "ਸੁਝਾਏ ਅਗਲੇ ਕਦਮ",
  "feature.suggested_tasks.summary":
    "ਜੌਬ ਆਪ ਉਹ ਕੰਮ ਸੁਝਾਉਂਦੀ ਹੈ ਜੋ ਅਜਿਹੀ ਜੌਬ ਵਿੱਚ ਆਮ ਤੌਰ 'ਤੇ ਲੋੜੀਂਦੇ ਹਨ, ਤਾਂ ਜੋ ਕੁਝ ਨਾ ਭੁੱਲੇ।",
  "feature.tasks.name": "ਕਰਨ ਵਾਲੇ ਕੰਮਾਂ ਦੀ ਸੂਚੀ",
  "feature.tasks.summary":
    "ਹਰ ਉਹ ਗੱਲ ਜਿਸ ਦਾ ਪਿੱਛਾ ਕਰਨਾ ਹੈ, ਇਸ ਹਿਸਾਬ ਨਾਲ ਲੱਗੀ ਕਿ ਛੱਡਣ 'ਤੇ ਸਭ ਤੋਂ ਵੱਧ ਨੁਕਸਾਨ ਕੀ ਕਰੇਗੀ।",
  "feature.work_areas.name": "ਕੰਮ ਦੇ ਖੇਤਰ",
  "feature.work_areas.summary":
    "ਵੱਡੇ ਕੰਮ ਨੂੰ ਕਮਰਿਆਂ ਜਾਂ ਹਿੱਸਿਆਂ ਵਿੱਚ ਵੰਡੋ ਅਤੇ ਹਰ ਹਿੱਸਾ ਵੱਖਰੇ ਬੰਦੇ ਨੂੰ ਦਿਓ।",
  "feature.time_clock.name": "ਕਲਾਕ ਇਨ ਅਤੇ ਆਊਟ",
  "feature.time_clock.summary":
    "ਕਰੂ ਜਿਸ ਜੌਬ 'ਤੇ ਹੈ ਉਸੇ ਲਈ ਹਾਜ਼ਰੀ ਲਾਉਂਦਾ ਹੈ, ਜਿਹੜਾ ਵੀ ਫ਼ੋਨ ਹੋਵੇ।",
  "feature.timesheets.name": "ਟਾਈਮਸ਼ੀਟਾਂ ਜੋ ਤੁਸੀਂ ਮਨਜ਼ੂਰ ਕਰਦੇ ਹੋ",
  "feature.timesheets.summary":
    "ਘੰਟੇ ਅਸਲ ਜੌਬਾਂ ਨਾਲ ਜੁੜ ਕੇ ਆਉਂਦੇ ਹਨ; ਤਨਖਾਹ ਬਣਨ ਤੋਂ ਪਹਿਲਾਂ ਤੁਸੀਂ ਮਨਜ਼ੂਰੀ ਦਿੰਦੇ ਹੋ।",
  "feature.crew_inbox.name": "ਕਰੂ ਇਨਬਾਕਸ",
  "feature.crew_inbox.summary":
    "ਤੁਹਾਡਾ ਕਰੂ ਇੱਕੋ ਨੰਬਰ 'ਤੇ ਫੋਟੋਆਂ ਤੇ ਖ਼ਬਰਾਂ ਭੇਜਦਾ ਹੈ ਅਤੇ ਉਹ ਆਪੇ ਸਹੀ ਜੌਬ ਨਾਲ ਲੱਗ ਜਾਂਦੀਆਂ ਹਨ।",
  "feature.time_off.name": "ਛੁੱਟੀਆਂ ਅਤੇ ਛੁੱਟੀ ਦੇ ਦਿਨ",
  "feature.time_off.summary":
    "ਬੇਨਤੀਆਂ ਸਹੀ ਮੈਨੇਜਰ ਕੋਲ ਜਾਂਦੀਆਂ ਹਨ, ਬਕਾਇਆ ਆਪੇ ਜੁੜਦਾ ਹੈ, ਅਤੇ ਕੈਲੰਡਰ ਨੂੰ ਪਤਾ ਹੁੰਦਾ ਹੈ।",
  "feature.invoices.name": "ਇਨਵੌਇਸ",
  "feature.invoices.summary":
    "ਮਨਜ਼ੂਰ ਕੋਟ ਇਨਵੌਇਸ ਬਣ ਜਾਂਦਾ ਹੈ ਜੋ ਕੋਟ ਵਰਗਾ ਹੀ ਲੱਗਦਾ ਹੈ, ਕਿਉਂਕਿ ਉਸੇ ਤੋਂ ਬਣਿਆ ਹੈ।",
  "feature.invoice_send.name": "ਇਨਵੌਇਸ ਭੇਜੋ",
  "feature.invoice_send.summary":
    "ਤੁਹਾਡੇ ਪਤੇ ਤੋਂ ਈਮੇਲ, ਨਾਲ PDF ਅਤੇ ਅੰਦਰ ਭੁਗਤਾਨ ਦਾ ਲਿੰਕ।",
  "feature.invoice_changes.name": "ਬਦਲੇ ਹੋਏ ਇਨਵੌਇਸ, ਰਿਕਾਰਡ ਸਮੇਤ",
  "feature.invoice_changes.summary":
    "ਜਾਰੀ ਹੋਏ ਇਨਵੌਇਸ ਵਿੱਚ ਸੋਧ ਕਰੋ ਤੇ ਪੁਰਾਣਾ ਸਾਂਭਿਆ ਰਹਿੰਦਾ ਹੈ, ਤਾਂ ਜੋ ਤੈਅ ਗੱਲ 'ਤੇ ਕਦੇ ਸਵਾਲ ਨਾ ਉੱਠੇ।",
  "feature.card_payments.name": "ਕਾਰਡ ਨਾਲ ਭੁਗਤਾਨ ਲਵੋ",
  "feature.card_payments.summary":
    "ਗਾਹਕ ਆਪਣੇ ਫ਼ੋਨ ਤੋਂ ਭੁਗਤਾਨ ਕਰਦਾ ਹੈ ਅਤੇ ਪੈਸਾ ਤੁਹਾਡੇ ਖਾਤੇ ਵਿੱਚ ਜਾਂਦਾ ਹੈ, ਸਾਡੇ ਨਹੀਂ।",
  "feature.stripe_connect.name": "ਤੁਹਾਡਾ ਆਪਣਾ ਪੇਆਊਟ ਖਾਤਾ",
  "feature.stripe_connect.summary":
    "ਬੈਂਕ ਇੱਕ ਵਾਰ ਜੋੜੋ; ਹਰ ਗਾਹਕ ਦਾ ਭੁਗਤਾਨ ਸਿੱਧਾ ਉੱਥੇ ਪਹੁੰਚਦਾ ਹੈ।",
  "feature.financing.name": "ਗਾਹਕ ਨੂੰ ਮਹੀਨਾਵਾਰ ਭਰਨ ਦਿਓ",
  "feature.financing.summary":
    "ਭੁਗਤਾਨ ਵੇਲੇ ਕਿਸ਼ਤਾਂ ਚਾਲੂ ਕਰੋ, ਉਹਨਾਂ ਵੱਡੇ ਕੰਮਾਂ ਲਈ ਜੋ ਘਰ ਵਾਲੇ ਟਾਲ ਦਿੰਦੇ ਹਨ।",
  "feature.service_plans.name": "ਮੇਨਟੇਨੈਂਸ ਪਲਾਨ",
  "feature.service_plans.summary":
    "ਗਾਹਕ ਨੂੰ ਲਗਾਤਾਰ ਚੱਲਣ ਵਾਲੇ ਪਲਾਨ 'ਤੇ ਪਾਓ ਅਤੇ ਕਾਰਡ ਸਮੇਂ ਸਿਰ ਆਪੇ ਕੱਟਿਆ ਜਾਂਦਾ ਹੈ।",
  "feature.client_portal.name": "ਗਾਹਕ ਪੋਰਟਲ",
  "feature.client_portal.summary":
    "ਇੱਕ ਲਿੰਕ ਜਿੱਥੇ ਗਾਹਕ ਆਪਣੇ ਕੋਟ, ਇਨਵੌਇਸ ਅਤੇ ਬਾਕੀ ਰਕਮ ਵੇਖਦਾ ਹੈ।",
  "feature.sales_tax.name": "ਪਤੇ ਮੁਤਾਬਕ ਸੇਲਜ਼ ਟੈਕਸ",
  "feature.sales_tax.summary":
    "ਰੇਟ ਇੱਕ ਵਾਰ ਸੈੱਟ ਕਰੋ; ਕੰਮ ਵਾਲੀ ਥਾਂ ਦਾ ਸਹੀ ਟੈਕਸ ਦਸਤਾਵੇਜ਼ 'ਤੇ ਆ ਜਾਂਦਾ ਹੈ।",
  "feature.dashboard.name": "ਡੈਸ਼ਬੋਰਡ",
  "feature.dashboard.summary":
    "ਕੀ ਕੋਟ ਹੋਇਆ, ਕੀ ਜਿੱਤਿਆ, ਕੀ ਸ਼ਡਿਊਲ ਹੈ ਅਤੇ ਕੀ ਬਕਾਇਆ — ਇੱਕੋ ਸਕਰੀਨ 'ਤੇ, ਅੱਜ ਸਵੇਰ ਤੱਕ।",
  "feature.break_even.name": "ਤੁਹਾਡੀ ਬਰੇਕ-ਈਵਨ ਕੀਮਤ",
  "feature.break_even.summary":
    "ਇੱਕ ਦਿਨ ਨੂੰ ਕਿੰਨਾ ਕਮਾਉਣਾ ਪੈਂਦਾ ਹੈ ਇਸ ਤੋਂ ਪਹਿਲਾਂ ਕਿ ਤੁਹਾਨੂੰ ਇੱਕ ਪੈਸਾ ਬਚੇ, ਤੁਹਾਡੇ ਅਸਲ ਖਰਚਿਆਂ ਤੋਂ ਕੱਢਿਆ।",
  "feature.benchmark.name": "ਤੁਹਾਡੀਆਂ ਕੀਮਤਾਂ ਦੀ ਤੁਲਨਾ",
  "feature.benchmark.summary":
    "ਤੁਹਾਡੇ ਰੇਟ ਅਤੇ ਜਿੱਤਣ ਦੀ ਦਰ ਤੁਹਾਡੇ ਕਿੱਤੇ ਦੀਆਂ ਹੋਰ ਦੁਕਾਨਾਂ ਦੇ ਮੁਕਾਬਲੇ ਕਿੱਥੇ ਹਨ — ਕਿਸੇ ਦਾ ਨਾਂ ਨਹੀਂ, ਤੁਹਾਡਾ ਵੀ ਨਹੀਂ।",
  "feature.monthly_digest.name": "ਮਹੀਨਾਵਾਰ ਲੇਖਾ-ਜੋਖਾ",
  "feature.monthly_digest.summary":
    "ਮਹੀਨੇ ਵਿੱਚ ਇੱਕ ਵਾਰ, ਤੁਹਾਡੇ ਅੰਕੜੇ ਗ੍ਰਾਫ਼ਾਂ ਦੀ ਥਾਂ ਵਾਕਾਂ ਵਿੱਚ ਸਮਝਾਏ ਜਾਂਦੇ ਹਨ।",
  "feature.goals.name": "ਆਮਦਨ ਦਾ ਟੀਚਾ",
  "feature.goals.summary":
    "ਸਾਲ ਲਈ ਟੀਚਾ ਰੱਖੋ ਅਤੇ ਵੇਖੋ ਤੁਸੀਂ ਕਿੰਨੇ ਅੱਗੇ ਜਾਂ ਪਿੱਛੇ ਹੋ।",
  "feature.expenses.name": "ਖਰਚੇ ਅਤੇ ਓਵਰਹੈੱਡ",
  "feature.expenses.summary":
    "ਜੋ ਖਰਚ ਕਰਦੇ ਹੋ ਲਿਖੋ, ਅਤੇ ਜੌਬ ਦਾ ਖਰਚ ਕਾਰੋਬਾਰ ਦੇ ਖਰਚ ਤੋਂ ਵੱਖ ਕਰੋ।",
  "feature.marketing_spend.name": "ਤੁਹਾਡੀ ਇਸ਼ਤਿਹਾਰਬਾਜ਼ੀ ਦੀ ਕੀਮਤ",
  "feature.marketing_spend.summary":
    "ਹਰ ਚੈਨਲ ਦਾ ਖਰਚ ਦਰਜ ਕਰੋ — Meta Ads ਤੋਂ ਆਟੋਮੈਟਿਕ ਇੰਪੋਰਟ ਸਮੇਤ — ਅਤੇ ਕੰਮ ਲਿਆਉਣ ਲਈ ਤੁਸੀਂ ਜੋ ਕੁਝ ਕਰਦੇ ਹੋ ਉਸ ਸਭ 'ਤੇ ਔਸਤ ਪ੍ਰਤੀ-ਲੀਡ ਲਾਗਤ ਵੇਖੋ।",
  "feature.marketing_spend.limits":
    "ਪ੍ਰਤੀ ਲੀਡ ਲਾਗਤ ਹਰ ਚੈਨਲ ਵਿੱਚ ਮਿਲਾ ਕੇ ਦਿਖਾਈ ਜਾਂਦੀ ਹੈ, ਚੈਨਲ ਜਾਂ ਮੁਹਿੰਮ ਅਨੁਸਾਰ ਵੱਖਰੀ ਨਹੀਂ ਦਿਖਾਈ ਜਾਂਦੀ — ਹਾਲੇ FieldQuo ਵਿੱਚ ਕੋਈ ਵੀ ਖਾਸ ਖਰਚੇ ਦਾ ਡਾਲਰ ਕਿਸੇ ਖਾਸ ਲੀਡ ਨਾਲ ਨਹੀਂ ਜੋੜਿਆ ਜਾਂਦਾ।",
  "feature.payroll.name": "ਪੇਰੋਲ",
  "feature.payroll.summary":
    "ਮਨਜ਼ੂਰ ਘੰਟੇ ਤਨਖਾਹ ਦੀ ਰਨ ਬਣ ਜਾਂਦੇ ਹਨ, ਨਾਲ ਪੇਅ-ਸਲਿੱਪਾਂ ਜੋ ਦੇ ਸਕਦੇ ਹੋ ਜਾਂ ਅਕਾਊਂਟੈਂਟ ਲਈ ਕੱਢ ਸਕਦੇ ਹੋ।",
  "feature.contractor_payouts.name": "ਐਪ ਤੋਂ ਠੇਕੇਦਾਰਾਂ ਨੂੰ ਭੁਗਤਾਨ",
  "feature.contractor_payouts.summary":
    "ਤੁਹਾਡੀ ਸੂਚੀ ਵਿੱਚ ਠੇਕੇਦਾਰ ਵਜੋਂ ਲੱਗੇ ਬੰਦੇ ਦੇ ਮਨਜ਼ੂਰ ਘੰਟੇ ਅਸਲ ਟ੍ਰਾਂਸਫਰ ਬਣ ਕੇ ਉਸ ਦੇ ਬੈਂਕ ਜਾਂਦੇ ਹਨ।",
  "feature.price_book.name": "ਤੁਹਾਡੀ ਪ੍ਰਾਈਸ ਬੁੱਕ",
  "feature.price_book.summary":
    "ਤੁਹਾਡੀਆਂ ਸੇਵਾਵਾਂ ਤੇ ਰੇਟ ਇੱਕੋ ਥਾਂ, ਸਪਰੈੱਡਸ਼ੀਟ ਤੋਂ ਲਿਆਏ ਜਾ ਸਕਦੇ ਹਨ ਅਤੇ ਵਾਪਸ ਕੱਢੇ ਵੀ।",
  "feature.material_costs.name": "ਮਟੀਰੀਅਲ ਦੀ ਲਾਗਤ ਅਤੇ ਖਪਤ",
  "feature.material_costs.summary":
    "ਇੱਕ ਲੀਟਰ ਪੇਂਟ ਜਾਂ ਪਲਾਈ ਦੀ ਸ਼ੀਟ ਤੁਹਾਨੂੰ ਕਿੰਨੇ ਦੀ ਪੈਂਦੀ ਹੈ, ਅਤੇ ਇਸ ਆਕਾਰ ਦੀ ਜੌਬ ਕਿੰਨਾ ਖਾਂਦੀ ਹੈ।",
  "feature.team_access.name": "ਟੀਮ ਦੀਆਂ ਭੂਮਿਕਾਵਾਂ ਅਤੇ ਪਹੁੰਚ",
  "feature.team_access.summary":
    "ਇੱਕ-ਇੱਕ ਕਰਕੇ ਤੈਅ ਕਰੋ ਕਿ ਹਰ ਬੰਦਾ ਕੀ ਵੇਖ ਤੇ ਬਦਲ ਸਕਦਾ ਹੈ — ਅਤੇ ਇਹ ਸਰਵਰ 'ਤੇ ਲਾਗੂ ਹੁੰਦਾ ਹੈ, ਸਿਰਫ਼ ਸਕਰੀਨ 'ਤੇ ਨਹੀਂ।",
  "feature.white_label.name": "ਹਰ ਚੀਜ਼ 'ਤੇ ਤੁਹਾਡਾ ਨਾਂ",
  "feature.white_label.summary":
    "ਹਰ ਕੋਟ, ਇਨਵੌਇਸ, ਪੰਨੇ ਅਤੇ ਈਮੇਲ 'ਤੇ ਤੁਹਾਡਾ ਲੋਗੋ ਤੇ ਤੁਹਾਡਾ ਰੰਗ, ਜੋ ਘਰ ਵਾਲਾ ਵੇਖਦਾ ਹੈ।",
  "feature.own_email_domain.name": "ਤੁਹਾਡੇ ਆਪਣੇ ਪਤੇ ਤੋਂ ਈਮੇਲ",
  "feature.own_email_domain.summary":
    "ਡੋਮੇਨ ਇੱਕ ਵਾਰ ਤਸਦੀਕ ਕਰੋ ਅਤੇ ਸਭ ਕੁਝ ਤੁਹਾਡੇ ਵੱਲੋਂ ਜਾਂਦਾ ਹੈ, ਕਿਸੇ ਸਾਂਝੇ ਪਤੇ ਤੋਂ ਨਹੀਂ।",
  "feature.quote_email_wording.name": "ਆਪਣੀ ਨਾਲ ਭੇਜੀ ਜਾਣ ਵਾਲੀ ਈਮੇਲ ਲਿਖੋ",
  "feature.quote_email_wording.summary":
    "ਕੋਟ ਵਾਲੀ ਈਮੇਲ ਕੀ ਕਹਿੰਦੀ ਹੈ, ਹਿੱਸਾ-ਦਰ-ਹਿੱਸਾ ਬਦਲੋ; ਇਹ ਉਸੇ ਭਾਸ਼ਾ ਵਿੱਚ ਰਹਿੰਦੀ ਹੈ ਜਿਸ ਵਿੱਚ ਕੋਟ ਬਣਿਆ ਸੀ।",
  "feature.document_layouts.name": "ਤੁਹਾਡਾ ਆਪਣਾ ਕੋਟ ਤੇ ਇਨਵੌਇਸ ਲੇਆਊਟ",
  "feature.document_layouts.summary":
    "ਚੁਣੋ ਕਿ ਛਪੇ ਦਸਤਾਵੇਜ਼ 'ਤੇ ਕਿਹੜੇ ਹਿੱਸੇ ਆਉਣ, ਅਤੇ ਕਿਹੜਾ ਮੂਲ ਰੂਪ ਵਿੱਚ ਵਰਤਿਆ ਜਾਵੇ।",
  "feature.contract_terms.name": "ਹਰ ਦਸਤਾਵੇਜ਼ 'ਤੇ ਤੁਹਾਡੀਆਂ ਸ਼ਰਤਾਂ",
  "feature.contract_terms.summary":
    "ਭੁਗਤਾਨ ਦੀਆਂ ਸ਼ਰਤਾਂ ਅਤੇ ਠੇਕੇ ਦੀ ਇਬਾਰਤ ਆਪੇ ਉਸ ਨਾਲ ਲੱਗ ਜਾਂਦੀਆਂ ਹਨ ਜੋ ਤੁਸੀਂ ਭੇਜਦੇ ਹੋ।",
  "feature.languages.name": "ਅੰਗਰੇਜ਼ੀ ਅਤੇ ਫਰਾਂਸੀਸੀ",
  "feature.languages.summary":
    "ਗਾਹਕ ਦੀ ਬੋਲੀ ਵਿੱਚ ਕੋਟ ਭੇਜੋ; ਦਸਤਖਤ ਹੋਇਆ ਦਸਤਾਵੇਜ਼ ਉਹੀ ਸ਼ਬਦ ਰੱਖਦਾ ਹੈ ਜਿਨ੍ਹਾਂ ਨਾਲ ਦਸਤਖਤ ਹੋਏ ਸਨ।",
  "feature.ai_copilot.name": "FieldQuo AI ਤੋਂ ਪੁੱਛੋ",
  "feature.ai_copilot.summary":
    "ਆਪਣੇ ਕਾਰੋਬਾਰ ਬਾਰੇ ਸਿੱਧੇ ਸ਼ਬਦਾਂ ਵਿੱਚ ਸਵਾਲ ਪੁੱਛੋ ਅਤੇ ਜਵਾਬ ਤੁਹਾਡੇ ਆਪਣੇ ਅੰਕੜਿਆਂ ਤੋਂ ਮਿਲੇ।",
  "feature.activity_log.name": "ਕਿਸ ਨੇ ਕੀ ਬਦਲਿਆ",
  "feature.activity_log.summary":
    "ਹਰ ਭੇਜਣ, ਸੋਧ ਅਤੇ ਮਨਜ਼ੂਰੀ ਦਾ ਲਗਾਤਾਰ ਰਿਕਾਰਡ, ਨਾਲ ਨਾਂ ਅਤੇ ਸਮਾਂ।",
  "feature.clients.name": "ਗਾਹਕਾਂ ਦੀ ਸੂਚੀ",
  "feature.clients.summary":
    "ਹਰ ਗਾਹਕ, ਉਸ ਦੀਆਂ ਜਾਇਦਾਦਾਂ ਅਤੇ ਇਤਿਹਾਸ, ਜਿੱਥੇ ਵੀ ਹੁਣ ਪਏ ਹਨ ਉੱਥੋਂ ਲਿਆਂਦੇ।",
};

const tl = {
  "nav.features": "Mga Feature",
  "nav.product": "Produkto",
  "nav.pricing": "Presyo",
  "pricing.group.winning": "Pagkuha ng trabaho",
  "pricing.group.doing": "Paggawa ng trabaho",
  "pricing.group.paid": "Pagsingil",
  "pricing.group.running": "Pagpapatakbo ng negosyo",
  "pricing.includedTitle": "Nasa bawat plano ang lahat",
  "pricing.includedBody": "Walang tier na nagbubukas ng job costing, walang upgrade para sa AI, walang add-on para makatanggap ng bayad. Sa dami lang ng tao nagkakaiba ang mga plano — wala nang iba.",
  "pricing.includedMore": "Maikling listahan lang iyan. Tingnan ang lahat ng ginagawa ng FieldQuo →",
  "nav.allFeatures": "Lahat ng feature",
  "nav.compare": "Ikumpara",
  "nav.savings": "Matitipid",
  "nav.glossary": "Glosaryo ng trabaho",
  "product.allFeatures.label": "Lahat ng feature",
  "product.allFeatures.desc": "Bawat bahagi ng FieldQuo, at ang silbi nito sa iyo",
  "product.compare.label": "Ikumpara",
  "product.compare.desc": "FieldQuo laban sa Jobber, Housecall Pro, ServiceTitan at Projul",
  "nav.industries": "Mga Industriya",
  "nav.resources": "Mga Resource",
  "nav.contact": "Kontak",
  "nav.login": "Mag-log in",
  "nav.signup": "Libreng subok",
  "nav.dashboard": "Pumunta sa dashboard",

  "product.quoting.label": "Quotes at Invoicing",
  "product.quoting.description":
    "Gumawa at magpadala ng propesyonal na quote sa loob ng ilang minuto",
  "product.scheduling.label": "Scheduling at Dispatch",
  "product.scheduling.description":
    "Online na booking, appointment, at pag-assign ng trabaho",
  "product.team.label": "Team at Payroll",
  "product.team.description":
    "Timesheet, bayad sa contractor, access ayon sa role",
  "product.analytics.label": "Analytics at AI",
  "product.analytics.description":
    "Alamin ang iyong mga numero — at kung ano ang gagawin dito",

  "hero.title":
    "Mga quote, invoice at scheduling para sa field service teams",
  "hero.subtitle":
    "Gumawa ng quote sa site, ipadala bago ka pa umalis, at mabayaran nang hindi na kailangang manghabol.",
  "hero.cta": "Simulan ang libreng subok",
  "hero.ctaSecondary": "Tingnan kung paano ito gumagana",
  "hero.noCard": "Walang kailangang credit card",
  "hero.emailPlaceholder": "ikaw@iyongkompanya.com",
  "hero.requestDemo": "Humiling ng demo",
  "hero.demo.title": "Mag-book ng 30-minutong demo",
  "hero.demo.openCta": "Mag-book ng demo o tawag pabalik",
  "hero.demo.openHint": "30 minuto, live, walang slides. O iwan ang numero mo at kami ang tatawag.",
  "hero.demo.close": "Isara",
  "hero.demo.modeSlot": "Pumili ng oras",
  "hero.demo.modeCallback": "Tawagan ako",
  "hero.demo.phone": "Numero ng telepono",
  "hero.demo.whenBest": "Pinakamainam na oras para tawagan ka (opsyonal)",
  "hero.demo.requestCallback": "Humiling ng tawag pabalik",
  "hero.demo.callbackSent": "Tapos na — tatawagan ka namin agad.",
  "hero.demo.callbackBody": "Tatawagan namin ang {phone}. Kung hindi ka namin maabot, ie-email namin ang {email}.",
  "hero.demo.subtitle": "Pumili ng oras at ipapakita namin sa iyo ang FieldQuo nang live.",
  "hero.demo.loading": "Naglo-load ng mga oras…",
  "hero.demo.noSlots": "Walang bukas na oras ngayon — mag-email sa hello@fieldquo.com at aayusin namin.",
  "hero.demo.name": "Iyong pangalan",
  "hero.demo.email": "Work email",
  "hero.demo.company": "Kompanya (opsyonal)",
  "hero.demo.pickSlot": "Pumili ng oras sa itaas",
  "hero.demo.confirmWithTime": "Kumpirmahin ang {time}",
  "hero.demo.confirmedTitle": "Naka-book ka na!",
  "hero.demo.confirmedBody": "Tingnan ang {email} para sa iyong calendar invite. Kita tayo sa {when}.",
  "hero.demo.genericError": "May nangyaring mali — pakisubukan ulit.",
  "hero.sending": "Ipinapadala…",
  "hero.demoThanks":
    "Salamat — makikipag-ugnayan kami agad para ayusin ang iyong demo.",
  "hero.tabs.quotes.label": "Mga Quote",
  "hero.tabs.quotes.headline":
    "Magpadala ng propesyonal na quote sa minuto, hindi oras",
  "hero.tabs.quotes.body":
    "Gumawa ng quote gamit ang sarili mong presyo, kategorya ng serbisyo at litrato — inaaprubahan ito online ng kliyente, walang paulit-ulit na usapan.",
  "hero.tabs.quotes.alt": "Isang kontratista na gumagawa ng quote sa tablet sa labas ng bahay ng kliyente habang tinitingnan niya ito sa kanyang telepono",
  "hero.tabs.scheduling.label": "Scheduling",
  "hero.tabs.scheduling.headline":
    "Hayaang mag-book ang kliyente diretso mula sa iyong website",
  "hero.tabs.scheduling.body":
    "Isang booking page na nagpapakita ng totoo mong availability, nag-a-assign ng tamang tao sa team, at kusang nagkukumpirma.",
  "hero.tabs.scheduling.alt": "Isang kliyenteng pumipili ng oras ng appointment sa booking page ng kontratista gamit ang kanyang telepono",
  "hero.tabs.invoicing.label": "Invoicing",
  "hero.tabs.invoicing.headline": "Mabayaran nang hindi na manghahabol",
  "hero.tabs.invoicing.body":
    "Gawing invoice ang aprubadong quote sa isang click, at makakabayad online ang kliyente sa oras na dumating ito sa inbox nila.",
  "hero.tabs.invoicing.alt": "Isang kliyenteng nagbabasa ng quote sa kanyang telepono, may Approve na buton sa ibaba",
  "hero.tabs.analytics.label": "Analytics",
  "hero.tabs.analytics.headline":
    "Alamin kung magkano ang sisingilin, bago ka manghula",
  "hero.tabs.analytics.body":
    "Tingnan ang totoong gastos mo, ang pinakamababang presyo bawat trabaho, at kung paano ka kumpara sa ibang negosyo sa larangan mo.",
  "hero.tabs.analytics.alt": "Isang dashboard na nagpapakita ng gastos bawat trabaho, pinakamababang presyo, at kung paano nakukumpara ang iyong mga presyo sa ibang kumpanya sa iyong hanapbuhay",

  "features.everything":
    "Lahat ng kailangan ng negosyo mo, sa iisang lugar",
  "features.anyTrade": "Ginawa para sa anumang trabaho",

  "ai.badge": "FieldQuo AI",
  "ai.title": "Magtanong sa negosyo mo, makakuha ng totoong sagot",
  "ai.body":
    "Binabasa ng FieldQuo AI ang sarili mong mga quote, invoice at gastos — hindi generic na payo. Itanong kung kumusta ang conversion rate mo ngayong buwan, o kung mas mura ba ang materyales noong isang buwan, at makakuha ng sagot base sa totoo mong numero.",
  "ai.samples.pricing":
    "“Masyado ba akong mababa magpresyo kumpara noong nakaraang quarter?”",
  "ai.samples.topClients":
    "“Sinong mga kliyente ang pinakamalaki ang binayad ngayong taon?”",
  "ai.samples.materials":
    "“Dapat ba akong mag-stock ng materyales ngayon?”",
  "ai.chat.question": "Kumusta ang quote conversion rate ko ngayong buwan?",
  "ai.chat.answer":
    "Nakapagpadala ka ng 14 na quote at 6 ang naaprubahan — 43% conversion rate, mula 31% noong isang buwan. Ang mga quote mo sa pagpipinta ang pinakamataas ang conversion.",

  "resources.title": "Libreng resources",
  "resources.help.description":
    "Mga gabay sa pag-setup at paggamit ng FieldQuo",
  "resources.faq.description": "Mabilis na sagot sa madalas itanong",
  "resources.contact.description": "Makipag-usap sa totoong tao",

  "pricing.popular": "Pinakasikat",
  "pricing.selected": "Napili",
  "pricing.firstMonth": "Unang buwan",
  "pricing.free": "Libre",
  "pricing.then": "Pagkatapos",
  "pricing.perMonthShort": "/buwan",
  "pricing.seatsUnlimited": "Walang limitasyong employee account",
  "pricing.seatsOne": "1 employee account",
  "pricing.seatsMany": "{count} na employee account",
  "pricing.rbacSeats": "1 master account + {count} na RBAC seat",
  "pricing.crewIncluded": "{count} miyembro ng crew kasama — libre",
  "pricing.seatsOneIncluded": "1 seat — quoting, trabaho at invoicing",
  "pricing.seatsManyIncluded": "{count} seats — quoting, trabaho at invoicing",
  "pricingPage.currencyBasis": "Iisang set ng presyo. Ang pera na sisingilin sa iyo ay batay sa business address na ibibigay mo sa pag-sign up: ang mga kumpanyang Canadian ay sinisingil sa Canadian dollars, ang mga US sa US dollars — parehong halaga, hindi kinonvert.",
  "pricing.fullAccess":
    "Buong access — quotes, invoicing, scheduling, analytics",
  "pricing.quoteLimit": "Hanggang {count} na quote bawat buwan",
  "pricing.aiIncluded": "Kasama ang AI copilot",

  "faq.title": "Mga madalas itanong",
  "faq.items.install.q": "Kailangan ko bang mag-install ng kahit ano?",
  "faq.items.install.a":
    "Hindi — gumagana ang FieldQuo nang buo sa iyong browser. Magagamit mo rin ito sa telepono.",
  "faq.items.onlinePayment.q":
    "Puwede bang magbayad online ang mga kliyente ko?",
  "faq.items.onlinePayment.a":
    "Oo. Ikonekta ang sarili mong Stripe account at makakabayad ang kliyente diretso mula sa invoice email — diretso sa iyo ang pera.",
  "faq.items.financing.q": "Puwede bang magbayad nang hulugan ang mga kliyente ko?",
  "faq.items.financing.a":
    "Oo. I-on ang Affirm sa Settings → Payments at puwedeng hatiin ng mga kliyente ang invoice sa buwanang hulog sa checkout, habang buo pa rin ang bayad sa iyo nang maaga.",
  "faq.items.permissions.q":
    "Makokontrol ko ba kung ano ang nakikita at ginagawa ng mga empleyado ko?",
  "faq.items.permissions.a":
    "Oo. May role ang bawat miyembro ng team — employee, supervisor o admin — na nagtatakda kung ano ang puwede nilang gawin, i-assign at makita.",
  "faq.items.trade.q": "Paano kung wala sa listahan ang trabaho ko?",
  "faq.items.trade.a":
    "Gumagana ang FieldQuo para sa anumang contracting o home service na negosyo. Puwede mong buksan o isara ang mga kategorya ng serbisyo at itakda ang sarili mong presyo.",
  "faq.items.contract.q": "May kontrata ba o pangmatagalang commitment?",
  "faq.items.contract.a":
    "Wala. Buwan-buwan ang mga plano — puwedeng kanselahin anumang oras.",

  "features.title": "Lahat ng kailangan para patakbuhin ang trabaho",
  "features.quotes.title": "Quote sa loob ng ilang minuto",
  "features.quotes.body":
    "Magpresyo mula sa sarili mong katalogo, magdagdag ng litrato, at magpadala ng quote na maaaring aprubahan ng kliyente sa telepono.",
  "features.invoices.title": "Mga invoice na nababayaran",
  "features.invoices.body":
    "Gawing invoice ang aprubadong quote sa isang click, tumanggap ng bayad sa card, at subaybayan ang natitirang balanse.",
  "features.scheduling.title": "Scheduling na maaasahan",
  "features.scheduling.body":
    "Mag-book ng trabaho, mag-assign ng crew, at hayaan ang kliyente na pumili ng oras mula sa totoo mong availability.",
  "features.followups.title": "Awtomatikong follow-up",
  "features.followups.body":
    "Ang mga quote na walang sagot at overdue na invoice ay awtomatikong pinapaalalahanan, sa sarili mong salita.",

  "pricing.title": "Simple at malinaw na presyo",
  "pricing.subtitle":
    "Kasama sa bawat plano ang quotes, invoicing at scheduling. Piliin ang akma sa laki ng inyong team.",
  "pricing.month": "/buwan",
  "pricing.cta": "Simulan ang libreng subok",
  "pricing.empty":
    "Tinatapos pa ang mga plano — bumalik mamaya, o makipag-ugnayan para sa early access na presyo.",

  "contact.title": "Kausapin kami",
  "contact.subtitle":
    "Mga tanong tungkol sa produkto, presyo, o paglipat ng inyong data.",
  "contact.name": "Pangalan mo",
  "contact.email": "Email",
  "contact.message": "Mensahe",
  "contact.send": "Ipadala ang mensahe",
  "contact.sending": "Ipinapadala…",
  "contact.sent": "Salamat — makikipag-ugnayan kami agad.",
  "contact.error": "May nagkamali. Subukan ulit, o mag-email sa amin nang diretso.",

  "booking.work.serviceLabel": "Anong klaseng trabaho ito?",
  "booking.work.serviceUnsure": "Hindi pa sigurado",
  "booking.work.notesLabel": "May iba pa bang dapat naming malaman?",
  "booking.work.notesPlaceholder":
    "Ano ang kailangang gawin, gaano kalaki, anumang hindi karaniwan…",
  "booking.work.notesHint": "Opsyonal — para handa kami pagdating.",

  "footer.product": "Produkto",
  "footer.company": "Kompanya",
  "footer.legal": "Legal",
  "footer.privacy": "Privacy",
  "footer.terms": "Mga Tuntunin",
  "footer.security": "Seguridad",
  "footer.rights": "Nakalaan ang lahat ng karapatan.",
  "footer.tagline":
    "Ang all-in-one platform para sa mga contractor at home service pro — quotes, scheduling, invoicing at bayad sa iisang lugar.",
  "footer.links.help": "Help Center",
  "footer.links.faq": "Mga madalas itanong",
  "footer.links.blog": "Blog",
  "footer.links.contact": "Makipag-ugnayan",
  "footer.links.about": "Tungkol sa amin",
  "footer.links.careers": "Mga trabaho",
  "footer.links.privacy": "Patakaran sa privacy",
  "footer.links.terms": "Mga tuntunin ng serbisyo",
  "footer.links.security": "Seguridad",

  "theme.label": "Tema",
  "theme.light": "Maliwanag",
  "theme.dark": "Madilim",
  "theme.system": "Sundan ang system",

  "pricingPage.title": "Simple at malinaw na presyo",
  "pricingPage.subtitle":
    "Kasama sa bawat plano ang mga quote, invoicing at scheduling. Piliin ang planong bagay sa laki ng inyong team.",
  "pricingPage.perMonth": "/buwan",
  "pricingPage.currencyNote":
    "Lahat ng presyo ay nasa {currency}. Ang currency ng inyong billing ay nakabatay sa bansang pipiliin ninyo sa pag-sign up.",
  "pricingPage.taxNote": "Hindi pa kasama ang mga buwis.",
  "pricingPage.emptyTitle":
    "Tinatapos pa ang mga plano — bumalik po kayo mamaya.",
  "pricingPage.emptyCta": "Tanungin kami tungkol sa early access pricing",

  "notFound.title": "Hindi namin makita ang page na iyon",
  "notFound.body":
    "Maaaring sira ang link o nailipat na ang page. Madalas naputol sa gitna ang mahahabang link sa text message — tingnan kung buo ang address na hawak ninyo.",
  "notFound.home": "Bumalik sa home",

  "common.loading": "Naglo-load…",
  "common.learnMore": "Alamin pa",
  "common.getStarted": "Magsimula",
  "common.back": "Bumalik",

  // ── Feature names, from lib/marketing/featureMatrix.js ──────────────────
  //
  // Trade terms, not software words. Where the trade has its own word in this
  // language it is used in preference to a translation of the English one.
  // Where the trade genuinely says the English word, the loanword stays and
  // scripts/check-feature-labels.mjs carries the exemption with a reason, so
  // an untranslated line cannot hide behind that argument.
  "feature.leads.name": "Pagsubaybay sa mga lead",
  "feature.leads.summary":
    "Lahat ng tanong sa isang listahan, nakaayos mula mainit hanggang malamig, at isang click para gawing quote.",
  "feature.lead_form.name": "Lead form para sa website mo",
  "feature.lead_form.summary":
    "Isang form na pwedeng ilagay sa kahit anong site; ang sagot ay dumadaan sa listahan ng lead mo, hindi sa inbox.",
  "feature.quotes.name": "Mga quote",
  "feature.quotes.summary":
    "Gumawa ng quote mula sa sarili mong presyo, hatiin ayon sa kuwarto o bahagi ng trabaho, at maglagay ng litrato.",
  "feature.priced_options.name": "Mabuti, mas mabuti, pinakamabuti",
  "feature.priced_options.summary":
    "Isang trabaho, tatlong presyo — ang kliyente ang pipili ng gusto niya.",
  "feature.quote_send.name": "Ipadala ang quote sa email",
  "feature.quote_send.summary":
    "Isang pindot at padala ang quote mula sa email mo, may kalakip na PDF, sa wika ng kliyente.",
  "feature.quote_pdf.name": "Quote PDF sa kulay mo",
  "feature.quote_pdf.summary":
    "PDF na may logo at kulay ng negosyo mo — walang nakasulat na FieldQuo.",
  "feature.online_approval.name": "Aprubado at pirmado online ng kliyente",
  "feature.online_approval.summary":
    "Bubuksan ng kliyente ang link, pipili ng dagdag, pipirma, at umaandar na ang trabaho — walang print, walang habulan sa telepono.",
  "feature.ai_quote_review.name": "Pagsusuri ng quote gamit ang AI",
  "feature.ai_quote_review.summary":
    "Bago mo ipadala: ano ang nakalimutan mo, saan tumatapat ang presyo sa mga napanalunan mo, at mas malinaw na pananalita.",
  "feature.add_on_upsell.name": "Mga mungkahing dagdag",
  "feature.add_on_upsell.summary":
    "Mga opsyonal na dagdag sa dulo ng quote, presyo mula sa dati mong trabaho, na pwedeng i-tsek ng kliyente.",
  "feature.follow_ups.name": "Awtomatikong follow-up",
  "feature.follow_ups.summary":
    "Ang quote na hindi sinasagot ay hinahabol ayon sa iskedyul mo, sa sarili mong salita, kahit hindi mo na maalala.",
  "feature.voice_receptionist.name": "AI na receptionist",
  "feature.voice_receptionist.summary":
    "Sumasagot sa telepono habang nasa hagdan ka, kinukuha ang detalye, nagbu-book ng bisita, at iniiwan sa iyo ang recording.",
  "feature.voice_callbacks.name": "Tawag ng kumpirmasyon",
  "feature.voice_callbacks.summary":
    "Tumatawag muna ang assistant para kumpirmahin ang mga appointment bukas, para hindi masayang ang umaga mo sa hindi dumating.",
  "feature.call_to_quote.name": "Quote na hango sa tawag",
  "feature.call_to_quote.summary":
    "Ang inilarawan ng tumawag ay bumabalik bilang draft na quote na bubuksan, itatama, at ipapadala mo.",
  "feature.booking_page.name": "Online na booking page",
  "feature.booking_page.summary":
    "Pumipili ang kliyente ng oras mula sa totoong bakante mo, kasama na ang biyahe at ang oras ng pagdating.",
  "feature.booking_deposit.name": "Deposito para mahawakan ang oras",
  "feature.booking_deposit.summary":
    "Singilin ang bayad sa pagbisita habang nagbu-book, at ibawas ito sa invoice kapag natuloy ang trabaho.",
  "feature.website_builder.name": "Sarili mong website",
  "feature.website_builder.summary":
    "Isang site na isinulat mula sa sinabi mo na sa amin, nasa sarili mong address, at maaari mong baguhin bawat bahagi.",
  "feature.instant_quotes.name": "Instant na online na tantiya",
  "feature.instant_quotes.summary":
    "Sumasagot ang bisita ng ilang tanong at agad na nakakakuha ng saklaw ng presyo, base sa presyong itinakda mo.",
  "feature.self_quote.name": "Ang kliyente mismo ang magpepresyo",
  "feature.self_quote.summary":
    "Isang pampublikong form kung saan inilalarawan ng may-bahay ang trabaho at naglalagay ng litrato; dumarating ito bilang simulang quote.",
  "feature.kitchen_designer.name": "Taga-disenyo ng kusina at cabinet",
  "feature.kitchen_designer.summary":
    "Iguhit ang hanay, pumili ng finish, at diretsong papasok sa quote ang presyo ng cabinet at ang floor plan.",
  "feature.aerial_measure.name": "Sukat mula sa himpapawid",
  "feature.aerial_measure.summary":
    "I-type ang address at makuha ang sukat at slope ng bubong, o bakasin ang daanan o patio, nang hindi pumupunta doon.",
  "feature.funnels.name": "Mga funnel ng lead",
  "feature.funnels.summary":
    "Mga landing page na paso-paso para sa isang ad o flyer, may bilang kung saan umaalis ang mga tao.",
  "feature.email_campaigns.name": "Mga kampanya sa email",
  "feature.email_campaigns.summary":
    "Isang sulat lang, ipadala sa listahan ng kliyente mula sa sarili mong email, at tingnan kung sino ang naabot.",
  "feature.door_hanger_routes.name": "Mga ruta ng door hanger",
  "feature.door_hanger_routes.summary":
    "Planuhin ang mga kalye, i-assign ang mga ito, at markahan ang bawat hinto habang nililibot ng crew mo ang lugar.",
  "feature.review_requests.name": "Paghingi ng review",
  "feature.review_requests.summary":
    "Kapag tapos na at bayad na ang trabaho, isang magalang na hiling ng review ang natatanggap ng kliyente.",
  "feature.testimonials.name": "Mga testimonial sa site mo",
  "feature.testimonials.summary":
    "Tipunin ang sinabi ng mga kliyente at ipakita ito sa website at sa mga quote mo.",
  "feature.referrals.name": "Mag-refer ng ibang kontratista",
  "feature.referrals.summary":
    "Magpadala ng imbitasyon; pag nag-sign up siya, parehas kayong makakakuha ng isang libreng buwan.",
  "feature.embeds.name": "Mga widget na idinidikit",
  "feature.embeds.summary":
    "Idikit ang isang linya sa website na meron ka na para ilagay ang booking, quote form o mga review mo.",
  "feature.bio_link.name": "Isang link para sa lahat ng profile",
  "feature.bio_link.summary":
    "Isang pahinang may pangalan mo, para sa Instagram o sa sticker ng trak, na nagtuturo sa lahat ng alok mo.",
  "feature.subcontractor_bids.name": "Presyo ng subcontractor sa alok mo",
  "feature.subcontractor_bids.summary":
    "Isama ang quote ng sub bilang gastos, lagyan ng patong, at ang presyo mo lang ang makikita ng kliyente.",
  "feature.jobs.name": "Mga trabaho",
  "feature.jobs.summary":
    "Ang aprubadong quote ay nagiging trabaho na may saklaw, address at papeles na kasama na.",
  "feature.scheduling.name": "Scheduling at dispatch",
  "feature.scheduling.summary":
    "Ilagay ang mga bisita sa kalendaryo, i-assign kung sino ang pupunta, at makita ang buong linggo ng crew nang sabay.",
  "feature.crew_shifts.name": "Mga shift ng crew",
  "feature.crew_shifts.summary":
    "Gawin ang rota para sa susunod na linggo, i-publish, at makikita ng bawat isa ang sarili niyang shift.",
  "feature.recurring_jobs.name": "Mga paulit-ulit na trabaho",
  "feature.recurring_jobs.summary":
    "Lingguhan, buwanan o pana-panahong trabaho na kusang bumabalik sa kalendaryo.",
  "feature.appointment_reminders.name": "Paalala sa appointment",
  "feature.appointment_reminders.summary":
    "Nakakatanggap ng text ang kliyente bago ka dumating, kaya mas kaunti ang saradong pintuan pagdating mo.",
  "feature.client_reschedule.name": "Ang kliyente na ang naglilipat ng oras",
  "feature.client_reschedule.summary":
    "May link sa kumpirmasyon para mailipat ng kliyente ang bisita nang hindi ka tinatawagan.",
  "feature.job_costing.name": "Costing ng trabaho",
  "feature.job_costing.summary":
    "Ang lakas-paggawa, materyales at gastos kumpara sa presyong ibinigay mo, para malaman mo ang totoong kinita.",
  "feature.materials.name": "Materyales sa trabaho",
  "feature.materials.summary":
    "Ano ang napunta sa site, magkano ang halaga, at ano pa ang bibilhin.",
  "feature.job_photos.name": "Litrato bago at pagkatapos",
  "feature.job_photos.summary":
    "Mga litratong nakatali sa trabaho, handang ilagay sa quote, invoice o website mo.",
  "feature.checklists.name": "Mga checklist sa trabaho",
  "feature.checklists.summary":
    "Listahan ng dapat gawin sa site, na minamarkahan ng mismong gumagawa.",
  "feature.suggested_tasks.name": "Mga mungkahing susunod na hakbang",
  "feature.suggested_tasks.summary":
    "Ang trabaho mismo ang nagmumungkahi ng mga gawaing karaniwang kailangan dito, para walang makalimutan.",
  "feature.tasks.name": "Listahan ng gagawin",
  "feature.tasks.summary":
    "Lahat ng dapat habulin, nakasunod sa kung alin ang pinakamasakit kapag hinayaan mo.",
  "feature.work_areas.name": "Mga lugar ng trabaho",
  "feature.work_areas.summary":
    "Hatiin ang malaking trabaho sa mga kuwarto o sona at ibigay ang bawat isa sa ibang tao.",
  "feature.time_clock.name": "Pag-clock in at clock out",
  "feature.time_clock.summary":
    "Nagcha-clock in ang crew sa mismong trabahong ginagawa nila, kahit anong telepono ang meron sila.",
  "feature.timesheets.name": "Timesheet na ikaw ang nag-a-aprub",
  "feature.timesheets.summary":
    "Ang oras ay nakatali sa totoong trabaho; ikaw ang nag-a-aprub bago ito maging sahod.",
  "feature.crew_inbox.name": "Inbox ng crew",
  "feature.crew_inbox.summary":
    "Nagte-text ang crew mo ng litrato at update sa isang numero, at kusang napupunta ang mga ito sa tamang trabaho.",
  "feature.time_off.name": "Mga day off at bakasyon",
  "feature.time_off.summary":
    "Ang hiling ay napupunta sa tamang manager, kusang naiipon ang balanse, at alam ito ng kalendaryo.",
  "feature.invoices.name": "Mga invoice",
  "feature.invoices.summary":
    "Ang aprubadong quote ay nagiging invoice na kamukha ng quote, dahil doon mismo galing.",
  "feature.invoice_send.name": "Magpadala ng invoice",
  "feature.invoice_send.summary":
    "Ipinapadala sa email mula sa address mo, may kalakip na PDF at link para makabayad agad.",
  "feature.invoice_changes.name": "Nababago ang invoice, may tala",
  "feature.invoice_changes.summary":
    "Baguhin ang naipadalang invoice at nananatili ang luma, kaya walang tanong sa napagkasunduan.",
  "feature.card_payments.name": "Mabayaran sa pamamagitan ng card",
  "feature.card_payments.summary":
    "Nagbabayad ang kliyente mula sa telepono niya at diretso sa account mo ang pera, hindi sa amin.",
  "feature.stripe_connect.name": "Sarili mong payout account",
  "feature.stripe_connect.summary":
    "Ikonekta ang bangko mo minsan lang; diretso doon ang bawat bayad ng kliyente.",
  "feature.financing.name": "Payagang magbayad buwan-buwan",
  "feature.financing.summary":
    "Buksan ang hulugang bayad sa checkout, para sa malalaking trabahong ipinagpapaliban ng may-bahay.",
  "feature.service_plans.name": "Mga plano sa maintenance",
  "feature.service_plans.summary":
    "Isali ang kliyente sa paulit-ulit na plano at kusang sinisingil ang card sa takdang araw.",
  "feature.client_portal.name": "Portal ng kliyente",
  "feature.client_portal.summary":
    "Isang link kung saan makikita ng kliyente ang kanyang quote, invoice at natitirang bayarin.",
  "feature.sales_tax.name": "Sales tax ayon sa address",
  "feature.sales_tax.summary":
    "Isang beses mong itakda ang mga rate; ang tama ay lalabas sa dokumento base sa lugar ng trabaho.",
  "feature.dashboard.name": "Dashboard",
  "feature.dashboard.summary":
    "Ang na-quote, napanalunan, naka-iskedyul at hindi pa bayad, nasa isang screen, hanggang ngayong umaga.",
  "feature.break_even.name": "Iyong break-even na presyo",
  "feature.break_even.summary":
    "Kung magkano ang dapat pumasok sa isang araw bago ka kumita ng kahit isang sentimo, base sa totoong gastos mo.",
  "feature.benchmark.name": "Kumusta ang presyo mo kumpara sa iba",
  "feature.benchmark.summary":
    "Kung saan nakatayo ang presyo at ang panalo mo kumpara sa ibang tindahan sa hanapbuhay mo — walang pinapangalanan, pati ikaw.",
  "feature.monthly_digest.name": "Buwanang pagsusulat",
  "feature.monthly_digest.summary":
    "Minsan sa isang buwan, ipinapaliwanag ang mga numero mo sa pangungusap sa halip na tsart.",
  "feature.goals.name": "Target na kita",
  "feature.goals.summary":
    "Magtakda ng target para sa taon at tingnan kung gaano ka nauuna o nahuhuli.",
  "feature.expenses.name": "Gastos at overhead",
  "feature.expenses.summary":
    "Itala ang ginagastos mo, at ihiwalay ang para sa trabaho sa para sa negosyo.",
  "feature.marketing_spend.name": "Kung magkano ang halaga ng ad mo",
  "feature.marketing_spend.summary":
    "Itala ang ginastos mo kada channel — kasama ang awtomatikong pag-import mula sa Meta Ads — at makita ang pinagsama-samang gastos kada lead sa lahat ng ginagawa mo para makakuha ng trabaho.",
  "feature.marketing_spend.limits":
    "Ang gastos kada lead ay pinagsama-sama sa lahat ng channel, hindi hiwa-hiwalay ayon sa channel o kampanya — wala pang koneksyon sa FieldQuo sa pagitan ng isang partikular na piso ng gastos at isang partikular na lead.",
  "feature.payroll.name": "Payroll",
  "feature.payroll.summary":
    "Ang aprubadong oras ay nagiging pay run na may payslip na pwede mong iabot o i-export para sa accountant mo.",
  "feature.contractor_payouts.name": "Bayaran ang contractor mula sa app",
  "feature.contractor_payouts.summary":
    "Ang aprubadong oras ng taong nasa roster mo na nakamarkang contractor ay lumalabas bilang tunay na transfer sa bangko niya.",
  "feature.price_book.name": "Iyong price book",
  "feature.price_book.summary":
    "Ang mga serbisyo at presyo mo sa isang lugar, puwedeng i-import mula sa spreadsheet at i-export pabalik.",
  "feature.material_costs.name": "Halaga ng materyales at rasyon",
  "feature.material_costs.summary":
    "Kung magkano sa iyo ang isang litrong pintura o isang playwud, at gaano karami ang nauubos sa ganitong laki ng trabaho.",
  "feature.team_access.name": "Mga role at access ng team",
  "feature.team_access.summary":
    "Ikaw ang magpapasya, isa-isa, kung ano ang makikita at mababago ng bawat tao — at iginagalang ito sa server, hindi lang sa screen.",
  "feature.white_label.name": "Pangalan mo ang nasa lahat",
  "feature.white_label.summary":
    "Ang logo at kulay mo sa bawat quote, invoice, pahina at email na nakikita ng may-bahay.",
  "feature.own_email_domain.name": "Email mula sa sarili mong address",
  "feature.own_email_domain.summary":
    "I-verify ang domain mo minsan lang at lahat ay galing na sa iyo, hindi sa address na hati-hati.",
  "feature.quote_email_wording.name": "Sarili mong sulat na pabalat",
  "feature.quote_email_wording.summary":
    "Baguhin ang laman ng email ng quote, bahagi bawat bahagi, at mananatili ito sa wikang ginamit sa quote.",
  "feature.document_layouts.name": "Sarili mong layout ng quote at invoice",
  "feature.document_layouts.summary":
    "Piliin kung anong bahagi ang lalabas sa nakalimbag na dokumento, at alin ang default.",
  "feature.contract_terms.name": "Mga tuntunin mo sa bawat dokumento",
  "feature.contract_terms.summary":
    "Ang mga tuntunin sa bayad at ang salita ng kontrata ay kusang nakakabit sa ipinapadala mo.",
  "feature.languages.name": "Ingles at Pranses",
  "feature.languages.summary":
    "Ipadala ang quote sa wikang sinasalita ng kliyente mo; ang napirmahang dokumento ay nananatili sa salitang pinirmahan.",
  "feature.ai_copilot.name": "Magtanong sa FieldQuo AI",
  "feature.ai_copilot.summary":
    "Magtanong tungkol sa sarili mong negosyo sa payak na salita at makuha ang sagot mula sa sarili mong mga numero.",
  "feature.activity_log.name": "Sino ang nagbago ng ano",
  "feature.activity_log.summary":
    "Tuloy-tuloy na talaan ng bawat padala, pagbabago at pag-apruba, may pangalan at oras.",
  "feature.clients.name": "Listahan ng kliyente",
  "feature.clients.summary":
    "Bawat kliyente, ang kanilang ari-arian at kasaysayan, na na-import mula saanman ito naroon ngayon.",
};

// The /app catalogue is merged in rather than pasted here — see the header of
// appMessages.js for why the two are separate files. Merging at this level
// means t(), the coverage script and every call site stay unchanged: there is
// still exactly one MESSAGES object and one flat lookup.
//
// App keys are namespaced "app.*", so a collision with a marketing key is
// impossible by construction rather than by discipline.
// The /features catalogue is merged into the MARKETING half rather than beside
// the app one. That placement is the whole point: MESSAGE_KEYS is taken from
// this object, and check:translations gates a deploy on full coverage of
// MESSAGE_KEYS in all six languages. A feature page is read by a stranger with
// no relationship to the product, which is the one surface where a missing
// string is a lost sale rather than an awkward moment.
const de = {
  "nav.features": "Funktionen",
  "nav.product": "Produkt",
  "nav.pricing": "Preise",
  "pricing.group.winning": "Aufträge gewinnen",
  "pricing.group.doing": "Aufträge ausführen",
  "pricing.group.paid": "Geld bekommen",
  "pricing.group.running": "Betrieb führen",
  "pricing.includedTitle": "Alles davon steckt in jedem Tarif",
  "pricing.includedBody": "Es gibt keine Stufe, die die Nachkalkulation freischaltet, kein Upgrade für die KI, kein Zusatzpaket fürs Kassieren. Die Tarife unterscheiden sich darin, wie viele Leute darin arbeiten — sonst nichts.",
  "pricing.includedMore": "Das ist die kurze Liste. Alles ansehen, was FieldQuo kann →",
  "nav.allFeatures": "Alle Funktionen",
  "nav.compare": "Vergleich",
  "nav.savings": "Ersparnis",
  "nav.glossary": "Handwerkslexikon",
  "product.allFeatures.label": "Alle Funktionen",
  "product.allFeatures.desc": "Jeder Teil von FieldQuo und was er für Sie tut",
  "product.compare.label": "Vergleich",
  "product.compare.desc": "FieldQuo gegen Jobber, Housecall Pro, ServiceTitan und Projul",
  "nav.industries": "Branchen",
  "nav.resources": "Ressourcen",
  "nav.contact": "Kontakt",
  "nav.login": "Anmelden",
  "nav.signup": "Kostenlos testen",
  "nav.dashboard": "Zum Dashboard",
  "product.quoting.label": "Angebote & Rechnungen",
  "product.quoting.description": "Professionelle Angebote in Minuten erstellen und senden",
  "product.scheduling.label": "Planung & Disposition",
  "product.scheduling.description": "Buchung wie bei Calendly, Termine und Auftragszuweisung",
  "product.team.label": "Team & Lohn",
  "product.team.description": "Stundenzettel, Auszahlungen an Subunternehmer, Rechte je Rolle",
  "product.analytics.label": "Auswertungen & KI",
  "product.analytics.description": "Kennen Sie Ihre Zahlen — und was daraus folgt",
  "hero.title": "Angebote, Rechnungen und Einsatzplanung für Handwerks- und Serviceteams",
  "hero.subtitle": "Erstellen Sie das Angebot vor Ort, senden Sie es, bevor Sie die Einfahrt verlassen, und bekommen Sie Ihr Geld, ohne jemandem hinterherzulaufen.",
  "hero.cta": "Kostenlos testen",
  "hero.ctaSecondary": "So funktioniert es",
  "hero.noCard": "Keine Kreditkarte nötig",
  "hero.emailPlaceholder": "sie@ihrbetrieb.de",
  "hero.requestDemo": "Demo anfragen",
  "hero.demo.title": "30-Minuten-Demo buchen",
  "hero.demo.openCta": "Demo oder Rückruf buchen",
  "hero.demo.openHint": "30 Minuten, live, ohne Folien. Oder hinterlassen Sie Ihre Nummer, dann rufen wir an.",
  "hero.demo.close": "Schließen",
  "hero.demo.modeSlot": "Zeit wählen",
  "hero.demo.modeCallback": "Rufen Sie mich zurück",
  "hero.demo.phone": "Telefonnummer",
  "hero.demo.whenBest": "Beste Zeit für einen Anruf (optional)",
  "hero.demo.requestCallback": "Rückruf anfragen",
  "hero.demo.callbackSent": "Alles klar — wir rufen Sie in Kürze an.",
  "hero.demo.callbackBody": "Wir rufen {phone} an. Wenn wir Sie nicht erreichen, schreiben wir an {email}.",
  "hero.demo.subtitle": "Wählen Sie eine Zeit, dann führen wir Sie live durch FieldQuo.",
  "hero.demo.loading": "Zeiten werden geladen…",
  "hero.demo.noSlots": "Gerade keine freien Zeiten — schreiben Sie an hello@fieldquo.com, dann finden wir eine.",
  "hero.demo.name": "Ihr Name",
  "hero.demo.email": "Geschäftliche E-Mail",
  "hero.demo.company": "Betrieb (optional)",
  "hero.demo.pickSlot": "Wählen Sie oben eine Zeit",
  "hero.demo.confirmWithTime": "{time} bestätigen",
  "hero.demo.confirmedTitle": "Ihr Termin steht!",
  "hero.demo.confirmedBody": "Die Kalendereinladung liegt in {email}. Bis {when}.",
  "hero.demo.genericError": "Etwas ist schiefgelaufen — bitte versuchen Sie es erneut.",
  "hero.sending": "Wird gesendet…",
  "hero.demoThanks": "Danke — wir melden uns in Kürze, um Ihre Demo einzurichten.",
  "hero.tabs.quotes.label": "Angebote",
  "hero.tabs.quotes.headline": "Ein professionelles Angebot in Minuten statt Stunden",
  "hero.tabs.quotes.body": "Angebote mit Ihren eigenen Preisen, Leistungsgruppen und Fotos — der Kunde nimmt online an, ohne Hin und Her.",
  "hero.tabs.quotes.alt": "Ein Handwerker erstellt vor dem Haus einer Kundin ein Angebot auf dem Tablet, während sie es auf ihrem Handy ansieht",
  "hero.tabs.scheduling.label": "Planung",
  "hero.tabs.scheduling.headline": "Lassen Sie Kunden direkt über Ihre Website buchen",
  "hero.tabs.scheduling.body": "Eine Buchungsseite, die Ihre echte Verfügbarkeit zeigt, die richtige Person aus Ihrem Team zuweist und automatisch bestätigt.",
  "hero.tabs.scheduling.alt": "Eine Kundin wählt auf dem Handy einen Termin auf der Buchungsseite eines Handwerksbetriebs",
  "hero.tabs.invoicing.label": "Rechnungen",
  "hero.tabs.invoicing.headline": "Geld bekommen, ohne jemandem hinterherzulaufen",
  "hero.tabs.invoicing.body": "Machen Sie aus einem angenommenen Angebot mit einem Klick eine Rechnung, die der Kunde online bezahlt, sobald sie in seinem Postfach liegt.",
  "hero.tabs.invoicing.alt": "Ein Kunde liest ein Angebot auf dem Handy, unten eine Schaltfläche zum Annehmen",
  "hero.tabs.analytics.label": "Auswertungen",
  "hero.tabs.analytics.headline": "Wissen, was Sie verlangen müssen, bevor Sie raten",
  "hero.tabs.analytics.body": "Sehen Sie Ihre echten Gemeinkosten, Ihren Mindestpreis je Auftrag und wie Sie im Vergleich zu anderen Betrieben Ihres Gewerks stehen.",
  "hero.tabs.analytics.alt": "Ein Dashboard mit Kosten je Auftrag, Mindestpreis und einem Vergleich Ihrer Durchschnittspreise mit anderen Betrieben Ihres Gewerks",
  "features.title": "Alles, was Sie brauchen, um den Auftrag zu fahren",
  "features.quotes.title": "Angebote in Minuten",
  "features.quotes.body": "Kalkulieren Sie aus Ihrer eigenen Preisliste, fügen Sie Fotos hinzu und senden Sie ein Angebot, das Ihr Kunde am Handy annehmen kann.",
  "features.invoices.title": "Rechnungen, die bezahlt werden",
  "features.invoices.body": "Machen Sie aus einem angenommenen Angebot mit einem Klick eine Rechnung, kassieren Sie per Karte und behalten Sie im Blick, was offen ist.",
  "features.scheduling.title": "Planung, die hält",
  "features.scheduling.body": "Aufträge einplanen, Teams zuweisen und Kunden aus Ihrer echten Verfügbarkeit einen Slot wählen lassen.",
  "features.followups.title": "Nachfassen von allein",
  "features.followups.body": "Bei stillen Angeboten und überfälligen Rechnungen wird automatisch nachgefasst — mit Ihren Worten.",
  "pricing.title": "Einfache, transparente Preise",
  "pricing.subtitle": "Jeder Tarif enthält Angebote, Rechnungen und Einsatzplanung. Wählen Sie den Tarif, der zur Größe Ihres Teams passt.",
  "pricing.month": "/Monat",
  "pricing.cta": "Kostenlos testen",
  "pricing.empty": "Die Tarife werden gerade finalisiert — schauen Sie bald wieder vorbei oder fragen Sie uns nach Preisen für den frühen Zugang.",
  "contact.title": "Sprechen Sie mit uns",
  "contact.subtitle": "Fragen zum Produkt, zu den Preisen oder zur Übernahme Ihrer Daten.",
  "contact.name": "Ihr Name",
  "contact.email": "E-Mail",
  "contact.message": "Nachricht",
  "contact.send": "Nachricht senden",
  "contact.sending": "Wird gesendet…",
  "contact.sent": "Danke — wir melden uns in Kürze.",
  "contact.error": "Etwas ist schiefgelaufen. Versuchen Sie es erneut oder schreiben Sie uns direkt.",
  "booking.work.serviceLabel": "Um welche Arbeit geht es?",
  "booking.work.serviceUnsure": "Noch unklar",
  "booking.work.notesLabel": "Sollten wir etwas wissen?",
  "booking.work.notesPlaceholder": "Was zu tun ist, ungefähr wie groß, alles Ungewöhnliche beim Zugang…",
  "booking.work.notesHint": "Optional — dann kommen wir vorbereitet.",
  "features.everything": "Alles, was Ihr Betrieb braucht, an einem Ort",
  "features.anyTrade": "Für jedes Gewerk gebaut",
  "ai.badge": "FieldQuo AI",
  "ai.title": "Stellen Sie Ihrem Betrieb eine Frage und bekommen Sie eine echte Antwort",
  "ai.body": "FieldQuo AI liest Ihre eigenen Angebote, Rechnungen und Ausgaben — keine allgemeinen Ratschläge. Fragen Sie, wie Ihre Abschlussquote diesen Monat läuft oder ob Material letzten Monat günstiger war, und Sie bekommen eine Antwort aus Ihren echten Zahlen.",
  "ai.samples.pricing": "„Kalkuliere ich zu niedrig im Vergleich zum letzten Quartal?“",
  "ai.samples.topClients": "„Welche meiner Kunden haben dieses Jahr am meisten gezahlt?“",
  "ai.samples.materials": "„Sollte ich gerade Material auf Lager legen?“",
  "ai.chat.question": "Wie ist meine Abschlussquote diesen Monat?",
  "ai.chat.answer": "Sie haben 14 Angebote gesendet, 6 wurden angenommen — eine Abschlussquote von 43 %, nach 31 % im Vormonat. Am besten laufen Ihre Malerangebote.",
  "resources.title": "Kostenlose Ressourcen",
  "resources.help.description": "Anleitungen zur Einrichtung und Nutzung von FieldQuo",
  "resources.faq.description": "Schnelle Antworten auf häufige Fragen",
  "resources.contact.description": "Sprechen Sie mit einem echten Menschen",
  "pricing.popular": "Am beliebtesten",
  "pricing.selected": "Ausgewählt",
  "pricing.firstMonth": "Erster Monat",
  "pricing.free": "Gratis",
  "pricing.then": "Danach",
  "pricing.perMonthShort": "/Mon.",
  "pricing.seatsUnlimited": "Unbegrenzt viele Mitarbeiterkonten",
  "pricing.seatsOne": "1 Mitarbeiterkonto",
  "pricing.seatsMany": "{count} Mitarbeiterkonten",
  "pricing.rbacSeats": "1 Hauptkonto + {count} Plätze mit Rollenrechten",
  "pricing.crewIncluded": "{count} Teammitglieder enthalten — gratis",
  "pricing.seatsOneIncluded": "1 Platz — Angebote, Aufträge und Rechnungen",
  "pricing.seatsManyIncluded": "{count} Plätze — Angebote, Aufträge und Rechnungen",
  "pricingPage.currencyBasis": "Ein einziger Preissatz. In welcher Währung Ihnen berechnet wird, ergibt sich aus der Geschäftsadresse, die Sie bei der Anmeldung angeben: kanadische Betriebe zahlen in kanadischen Dollar, US-Betriebe in US-Dollar — dieselbe Zahl, nicht umgerechnet.",
  "pricing.fullAccess": "Voller Zugriff — Angebote, Rechnungen, Planung, Auswertungen",
  "pricing.quoteLimit": "Bis zu {count} Angebote pro Monat",
  "pricing.aiIncluded": "KI-Assistent enthalten",
  "faq.title": "Häufige Fragen",
  "faq.items.install.q": "Muss ich etwas installieren?",
  "faq.items.install.a": "Nein — FieldQuo läuft vollständig im Browser. Sie können es auch vom Handy aus nutzen.",
  "faq.items.onlinePayment.q": "Können meine Kunden ihre Rechnungen online bezahlen?",
  "faq.items.onlinePayment.a": "Ja. Verbinden Sie Ihr eigenes Stripe-Konto, dann zahlen Kunden direkt aus der Rechnungs-E-Mail — das Geld geht direkt an Sie.",
  "faq.items.financing.q": "Können meine Kunden in Raten zahlen?",
  "faq.items.financing.a": "Ja. Aktivieren Sie Affirm unter Einstellungen → Zahlungen, dann können Kunden eine Rechnung beim Bezahlen in Monatsraten aufteilen — während Sie weiterhin sofort den vollen Betrag erhalten.",
  "faq.items.permissions.q": "Kann ich steuern, was meine Mitarbeiter sehen und tun können?",
  "faq.items.permissions.a": "Ja. Jedes Teammitglied hat eine Rolle — Mitarbeiter, Vorgesetzter oder Administrator —, die bestimmt, was es anlegen, zuweisen und öffnen kann.",
  "faq.items.trade.q": "Was, wenn mein Gewerk nicht dabei ist?",
  "faq.items.trade.a": "FieldQuo funktioniert für jeden Handwerks- und Hausservicebetrieb. Sie können einzelne Leistungsgruppen aktivieren oder abschalten und Ihre eigenen Preise setzen, egal in welchem Gewerk.",
  "faq.items.contract.q": "Gibt es einen Vertrag oder eine lange Bindung?",
  "faq.items.contract.a": "Nein. Die Tarife laufen monatlich — jederzeit kündbar.",
  "footer.product": "Produkt",
  "footer.company": "Unternehmen",
  "footer.legal": "Rechtliches",
  "footer.privacy": "Datenschutz",
  "footer.terms": "AGB",
  "footer.security": "Sicherheit",
  "footer.rights": "Alle Rechte vorbehalten.",
  "footer.tagline": "Die Komplettlösung für Handwerks- und Hausservicebetriebe — Angebote, Planung, Rechnungen und Zahlungen an einem Ort.",
  "footer.links.help": "Hilfebereich",
  "footer.links.faq": "Häufige Fragen",
  "footer.links.blog": "Blog",
  "footer.links.contact": "Kontakt",
  "footer.links.about": "Über uns",
  "footer.links.careers": "Karriere",
  "footer.links.privacy": "Datenschutzerklärung",
  "footer.links.terms": "Nutzungsbedingungen",
  "footer.links.security": "Sicherheit",
  "theme.label": "Darstellung",
  "theme.light": "Hell",
  "theme.dark": "Dunkel",
  "theme.system": "Wie das System",
  "pricingPage.title": "Einfache, transparente Preise",
  "pricingPage.subtitle": "Jeder Tarif enthält Angebote, Rechnungen und Einsatzplanung. Wählen Sie den Tarif, der zur Größe Ihres Teams passt.",
  "pricingPage.perMonth": "/Monat",
  "pricingPage.currencyNote": "Alle Preise verstehen sich in {currency}. Ihre Abrechnungswährung ergibt sich aus dem Land, das Sie bei der Anmeldung wählen.",
  "pricingPage.taxNote": "Zuzüglich anfallender Steuern.",
  "pricingPage.emptyTitle": "Die Tarife werden gerade finalisiert — schauen Sie bald wieder vorbei.",
  "pricingPage.emptyCta": "Fragen Sie uns nach Preisen für den frühen Zugang",
  "notFound.title": "Diese Seite finden wir nicht",
  "notFound.body": "Der Link ist womöglich kaputt, oder die Seite ist umgezogen. Lange Links werden von SMS häufiger in zwei Teile zerschnitten, als man denkt — prüfen Sie, ob Sie die vollständige Adresse haben.",
  "notFound.home": "Zurück zur Startseite",
  "common.loading": "Wird geladen…",
  "common.learnMore": "Mehr erfahren",
  "common.getStarted": "Loslegen",
  "common.back": "Zurück",
  "feature.leads.name": "Anfragen verfolgen",
  "feature.leads.summary": "Jede Anfrage in einer Liste, von heiß bis kalt bewertet, mit einem Klick in ein Angebot verwandelt.",
  "feature.lead_form.name": "Anfrageformular für Ihre Website",
  "feature.lead_form.summary": "Ein Formular für jede beliebige Website; was zurückkommt, landet in Ihrer Anfrageliste, nicht in einem Postfach.",
  "feature.quotes.name": "Angebote",
  "feature.quotes.summary": "Bauen Sie ein Angebot aus Ihren eigenen Sätzen, gruppieren Sie es nach Raum oder Gewerk und fügen Sie Fotos hinzu.",
  "feature.priced_options.name": "Gut, besser, am besten",
  "feature.priced_options.summary": "Schicken Sie einen Auftrag zu drei Preisen und lassen Sie den Kunden wählen.",
  "feature.quote_send.name": "Angebot per E-Mail senden",
  "feature.quote_send.summary": "Eine Schaltfläche schickt das Angebot von Ihrer Adresse, mit PDF im Anhang, in der Sprache des Kunden.",
  "feature.quote_pdf.name": "Angebots-PDF in Ihren Farben",
  "feature.quote_pdf.summary": "Ein PDF mit Ihrem Logo und Ihrer Markenfarbe — nichts darauf sagt FieldQuo.",
  "feature.online_approval.name": "Kunde nimmt online an und unterschreibt",
  "feature.online_approval.summary": "Der Kunde öffnet einen Link, wählt Zusätze, unterschreibt — und der Auftrag läuft. Kein Drucken, kein Telefonieren.",
  "feature.ai_quote_review.name": "KI-Prüfung des Angebots",
  "feature.ai_quote_review.summary": "Vor dem Senden: was fehlt, wie der Preis zu den Angeboten steht, die Sie gewonnen haben, und klarere Formulierungen.",
  "feature.add_on_upsell.name": "Vorgeschlagene Zusatzleistungen",
  "feature.add_on_upsell.summary": "Optionale Zusätze am Ende des Angebots, kalkuliert aus Ihrer eigenen Historie, die der Kunde ankreuzen kann.",
  "feature.follow_ups.name": "Automatisches Nachfassen",
  "feature.follow_ups.summary": "Bei einem Angebot, das still bleibt, wird nach Ihrem Zeitplan und mit Ihren Worten nachgefasst, ohne dass Sie daran denken.",
  "feature.voice_receptionist.name": "KI-Telefonassistent",
  "feature.voice_receptionist.summary": "Nimmt Ihr Telefon ab, wenn Sie auf der Leiter stehen, nimmt die Angaben auf, bucht den Einsatz und hinterlässt Ihnen die Aufnahme.",
  "feature.voice_callbacks.name": "Bestätigungsanrufe",
  "feature.voice_callbacks.summary": "Der Assistent ruft vorab an, um die Termine von morgen zu bestätigen, damit Sie den Vormittag nicht an Nichterscheinen verlieren.",
  "feature.call_to_quote.name": "Angebotsentwurf aus dem Anruf",
  "feature.call_to_quote.summary": "Was der Anrufer geschildert hat, kommt als Angebotsentwurf zurück, den Sie öffnen, korrigieren und senden.",
  "feature.booking_page.name": "Online-Buchungsseite",
  "feature.booking_page.summary": "Kunden wählen einen Slot aus Ihrer echten Verfügbarkeit, mit Fahrzeit und Ankunftsfenster eingerechnet.",
  "feature.booking_deposit.name": "Anzahlung, die den Termin sichert",
  "feature.booking_deposit.summary": "Berechnen Sie bei der Buchung eine Anfahrtspauschale und rechnen Sie sie auf die Rechnung an, wenn die Arbeit zustande kommt.",
  "feature.website_builder.name": "Ihre eigene Website",
  "feature.website_builder.summary": "Eine Website aus dem, was Sie uns ohnehin erzählt haben, unter Ihrer eigenen Adresse, die Sie Block für Block bearbeiten können.",
  "feature.instant_quotes.name": "Sofortpreis online",
  "feature.instant_quotes.summary": "Ein Besucher beantwortet ein paar Fragen und bekommt auf der Stelle eine Preisspanne, aus Sätzen, die Sie festlegen.",
  "feature.self_quote.name": "Kunden kalkulieren ihren Auftrag selbst",
  "feature.self_quote.summary": "Ein öffentliches Formular, in dem ein Hausbesitzer die Arbeit beschreibt und Fotos hochlädt; es kommt als begonnenes Angebot an.",
  "feature.kitchen_designer.name": "Küchen- und Möbelplaner",
  "feature.kitchen_designer.summary": "Zeile zeichnen, Oberflächen wählen — Möbelpreise und Grundriss gehen direkt ins Angebot.",
  "feature.aerial_measure.name": "Aufmaß aus der Luft",
  "feature.aerial_measure.summary": "Adresse eintippen und Dachfläche und Neigung bekommen, oder Einfahrt und Terrasse nachzeichnen, ohne hinzufahren.",
  "feature.funnels.name": "Anfrage-Funnels",
  "feature.funnels.summary": "Mehrstufige Landingpages für eine Anzeige oder einen Flyer, mit Zahlen dazu, wo Leute abspringen.",
  "feature.email_campaigns.name": "E-Mail-Kampagnen",
  "feature.email_campaigns.summary": "Einmal schreiben, von Ihrer eigenen Adresse an Ihre Kundenliste senden und sehen, wen es erreicht hat.",
  "feature.door_hanger_routes.name": "Verteilrouten für Türhänger",
  "feature.door_hanger_routes.summary": "Straßen planen, zuweisen und die Stopps abhaken, während Ihr Team durch das Viertel geht.",
  "feature.review_requests.name": "Bewertungen anfragen",
  "feature.review_requests.summary": "Wenn der Auftrag erledigt und bezahlt ist, bekommt der Kunde eine höfliche Bitte um eine Bewertung.",
  "feature.testimonials.name": "Kundenstimmen auf Ihrer Website",
  "feature.testimonials.summary": "Sammeln Sie, was Kunden gesagt haben, und zeigen Sie es auf Ihrer Website und in Ihren Angeboten.",
  "feature.referrals.name": "Einen anderen Betrieb empfehlen",
  "feature.referrals.summary": "Schicken Sie eine Einladung; wenn der Betrieb sich anmeldet, bekommen Sie beide einen Gratismonat gutgeschrieben.",
  "feature.embeds.name": "Widgets zum Einbinden",
  "feature.embeds.summary": "Eine Zeile in Ihre bestehende Website einfügen und Buchung, Angebotsformular oder Bewertungen einbetten.",
  "feature.bio_link.name": "Ein Link für Ihre Profile",
  "feature.bio_link.summary": "Eine einzige Seite in Ihrem Design für Instagram oder die Aufschrift am Transporter, die auf alles verweist, was Sie anbieten.",
  "feature.subcontractor_bids.name": "Preise von Nachunternehmern in Ihrem Angebot",
  "feature.subcontractor_bids.summary": "Übernehmen Sie das Angebot eines Nachunternehmers direkt als Kosten, schlagen Sie auf, und Ihr Kunde sieht nur Ihren Preis.",
  "feature.jobs.name": "Aufträge",
  "feature.jobs.summary": "Aus einem angenommenen Angebot wird ein Auftrag, an dem Leistungsumfang, Adresse und Papiere schon hängen.",
  "feature.scheduling.name": "Einsatzplanung und Disposition",
  "feature.scheduling.summary": "Einsätze in den Kalender setzen, die hinfahrende Person zuweisen und die ganze Woche des Teams auf einen Blick sehen.",
  "feature.crew_shifts.name": "Schichten des Teams",
  "feature.crew_shifts.summary": "Den Plan für nächste Woche bauen, veröffentlichen — und jeder sieht seine eigenen Schichten.",
  "feature.recurring_jobs.name": "Wiederkehrende Aufträge",
  "feature.recurring_jobs.summary": "Wöchentliche, monatliche oder saisonale Arbeit, die sich selbst wieder in den Kalender setzt.",
  "feature.appointment_reminders.name": "Terminerinnerungen",
  "feature.appointment_reminders.summary": "Der Kunde bekommt vor Ihrer Ankunft eine SMS, damit seltener eine Tür verschlossen ist, wenn Sie da sind.",
  "feature.client_reschedule.name": "Kunden verlegen selbst",
  "feature.client_reschedule.summary": "Ein Link in der Bestätigung lässt den Kunden den Einsatz verschieben, ohne bei Ihnen anzurufen.",
  "feature.job_costing.name": "Nachkalkulation",
  "feature.job_costing.summary": "Lohn, Material und Ausgaben gegen den angebotenen Preis, damit Sie wissen, was Sie wirklich verdient haben.",
  "feature.materials.name": "Material am Auftrag",
  "feature.materials.summary": "Was auf die Baustelle ging, was es gekostet hat und was noch zu kaufen ist.",
  "feature.job_photos.name": "Vorher-Nachher-Fotos",
  "feature.job_photos.summary": "Fotos am Auftrag abgelegt, bereit fürs Angebot, die Rechnung oder Ihre Website.",
  "feature.checklists.name": "Checklisten je Auftrag",
  "feature.checklists.summary": "Eine Liste dessen, was vor Ort zu tun ist, abgehakt von dem, der es tut.",
  "feature.suggested_tasks.name": "Vorgeschlagene nächste Schritte",
  "feature.suggested_tasks.summary": "Der Auftrag schlägt die Aufgaben vor, die ein solcher Auftrag üblicherweise braucht, damit nichts vergessen geht.",
  "feature.tasks.name": "Aufgabenliste",
  "feature.tasks.summary": "Alles, wo Sie dranbleiben müssen, sortiert danach, was am meisten wehtut, wenn Sie es liegen lassen.",
  "feature.work_areas.name": "Arbeitsbereiche",
  "feature.work_areas.summary": "Einen großen Auftrag in Räume oder Zonen teilen und jeden Teil einer anderen Person geben.",
  "feature.time_clock.name": "Ein- und ausstempeln",
  "feature.time_clock.summary": "Das Team stempelt auf den Auftrag, an dem es gerade ist — mit dem Handy, das es hat.",
  "feature.timesheets.name": "Stundenzettel, die Sie freigeben",
  "feature.timesheets.summary": "Stunden landen an echten Aufträgen; Sie geben sie frei, bevor daraus Lohn werden kann.",
  "feature.crew_inbox.name": "Team-Posteingang",
  "feature.crew_inbox.summary": "Ihr Team schickt Fotos und Updates per SMS an eine Nummer, und sie legen sich beim richtigen Auftrag ab.",
  "feature.time_off.name": "Abwesenheiten und Urlaub",
  "feature.time_off.summary": "Anträge gehen an die richtige Führungskraft, Ansprüche wachsen von selbst, und der Kalender weiß Bescheid.",
  "feature.invoices.name": "Rechnungen",
  "feature.invoices.summary": "Aus einem angenommenen Angebot wird eine Rechnung, die aussieht wie das Angebot — weil sie daraus gebaut ist.",
  "feature.invoice_send.name": "Rechnung senden",
  "feature.invoice_send.summary": "Von Ihrer Adresse verschickt, mit PDF im Anhang und einem Link zum Sofortbezahlen darin.",
  "feature.invoice_changes.name": "Geänderte Rechnungen, nachvollziehbar",
  "feature.invoice_changes.summary": "Ändern Sie eine ausgestellte Rechnung, und die alte bleibt erhalten — es gibt nie eine Frage, was vereinbart war.",
  "feature.card_payments.name": "Per Karte bezahlt werden",
  "feature.card_payments.summary": "Der Kunde zahlt vom Handy, und das Geld geht auf Ihr Konto, nicht auf unseres.",
  "feature.stripe_connect.name": "Ihr eigenes Auszahlungskonto",
  "feature.stripe_connect.summary": "Bankverbindung einmal verbinden; jede Kundenzahlung landet direkt darauf.",
  "feature.financing.name": "Kunden monatlich zahlen lassen",
  "feature.financing.summary": "Schalten Sie Ratenzahlung beim Bezahlen frei — für die großen Aufträge, die Hausbesitzer aufschieben.",
  "feature.service_plans.name": "Wartungsverträge",
  "feature.service_plans.summary": "Melden Sie einen Kunden für einen wiederkehrenden Plan an, und die Karte wird nach Plan belastet, ohne dass Sie fragen.",
  "feature.client_portal.name": "Kundenportal",
  "feature.client_portal.summary": "Ein Link, unter dem ein Kunde seine Angebote, Rechnungen und den offenen Betrag sieht.",
  "feature.sales_tax.name": "Umsatzsteuer passend zur Adresse",
  "feature.sales_tax.summary": "Sätze einmal hinterlegen; der richtige landet auf dem Dokument für den Ort der Leistung.",
  "feature.dashboard.name": "Dashboard",
  "feature.dashboard.summary": "Was angeboten, gewonnen, eingeplant und offen ist — auf einem Bildschirm, Stand heute Morgen.",
  "feature.break_even.name": "Ihr Break-even-Preis",
  "feature.break_even.summary": "Was ein Tag einbringen muss, bevor Sie einen Cent verdienen — errechnet aus Ihren echten Gemeinkosten.",
  "feature.benchmark.name": "Wie Ihre Preise dastehen",
  "feature.benchmark.summary": "Wo Ihre Sätze und Ihre Abschlussquote gegenüber anderen Betrieben Ihres Gewerks liegen — niemand wird genannt, Sie auch nicht.",
  "feature.monthly_digest.name": "Monatsbericht",
  "feature.monthly_digest.summary": "Einmal im Monat Ihre Zahlen in Sätzen erklärt statt in Diagrammen.",
  "feature.goals.name": "Umsatzziel",
  "feature.goals.summary": "Setzen Sie ein Jahresziel und sehen Sie, wie weit Sie vorn oder zurück liegen.",
  "feature.expenses.name": "Ausgaben und Gemeinkosten",
  "feature.expenses.summary": "Erfassen Sie, was Sie ausgeben, und trennen Sie, was zu einem Auftrag gehört, von dem, was zum Betrieb gehört.",
  "feature.marketing_spend.name": "Was Ihre Werbung wert ist",
  "feature.marketing_spend.summary": "Erfassen Sie Ihre Ausgaben je Kanal — samt automatischem Import aus Meta Ads — und sehen Sie gemischte Kosten je Anfrage über alles, was Sie tun, um Arbeit hereinzuholen.",
  "feature.marketing_spend.limits": "Die Kosten je Anfrage sind über alle Kanäle gemischt, nicht je Kanal oder je Kampagne aufgeschlüsselt — nichts in FieldQuo verknüpft bisher einen bestimmten ausgegebenen Betrag mit einer bestimmten Anfrage.",
  "feature.payroll.name": "Lohnabrechnung",
  "feature.payroll.summary": "Freigegebene Stunden werden zu einem Lohnlauf mit Abrechnungen, die Sie aushändigen oder für Ihre Buchhaltung exportieren können.",
  "feature.contractor_payouts.name": "Nachunternehmer aus der App bezahlen",
  "feature.contractor_payouts.summary": "Freigegebene Stunden für jemanden auf Ihrer Liste, der als Nachunternehmer geführt wird, gehen als echte Überweisung auf dessen Bankkonto.",
  "feature.price_book.name": "Ihre Preisliste",
  "feature.price_book.summary": "Ihre Leistungen und Sätze an einem Ort, importierbar aus einer Tabelle und wieder exportierbar.",
  "feature.material_costs.name": "Materialkosten und Verbrauchssätze",
  "feature.material_costs.summary": "Was Sie ein Liter Farbe oder eine Platte Sperrholz kostet und wie viel davon ein Auftrag dieser Größe frisst.",
  "feature.team_access.name": "Rollen und Zugriff im Team",
  "feature.team_access.summary": "Entscheiden Sie Schalter für Schalter, was jede Person sehen und ändern darf — und es gilt auf dem Server, nicht nur auf dem Bildschirm.",
  "feature.white_label.name": "Alles trägt Ihren Namen",
  "feature.white_label.summary": "Ihr Logo und Ihre Farbe auf jedem Angebot, jeder Rechnung, jeder Seite und jeder E-Mail, die ein Hausbesitzer sieht.",
  "feature.own_email_domain.name": "E-Mail von Ihrer eigenen Adresse",
  "feature.own_email_domain.summary": "Ihre Domain einmal bestätigen, dann geht alles von Ihnen raus, nicht von einer gemeinsamen Adresse.",
  "feature.quote_email_wording.name": "Ihr eigenes Anschreiben",
  "feature.quote_email_wording.summary": "Ändern Sie Abschnitt für Abschnitt, was die Angebots-E-Mail sagt — sie bleibt in der Sprache, in der das Angebot geschrieben wurde.",
  "feature.document_layouts.name": "Ihr eigenes Angebots- und Rechnungslayout",
  "feature.document_layouts.summary": "Wählen Sie, welche Abschnitte auf dem gedruckten Dokument erscheinen und welches Layout die Vorgabe ist.",
  "feature.contract_terms.name": "Ihre Bedingungen auf jedem Dokument",
  "feature.contract_terms.summary": "Zahlungsbedingungen und Vertragstext, die sich von selbst an das hängen, was Sie senden.",
  "feature.languages.name": "Englisch und Französisch",
  "feature.languages.summary": "Senden Sie ein Angebot in der Sprache Ihres Kunden; ein unterschriebenes Dokument behält die Worte, mit denen es unterschrieben wurde.",
  "feature.ai_copilot.name": "FieldQuo AI fragen",
  "feature.ai_copilot.summary": "Stellen Sie eine Frage zu Ihrem eigenen Betrieb in normaler Sprache und bekommen Sie die Antwort aus Ihren eigenen Zahlen.",
  "feature.activity_log.name": "Wer hat was geändert",
  "feature.activity_log.summary": "Ein laufendes Protokoll jedes Versands, jeder Änderung und jeder Freigabe, mit Name und Uhrzeit dazu.",
  "feature.clients.name": "Kundenliste",
  "feature.clients.summary": "Jeder Kunde, seine Objekte und seine Historie, importiert von dort, wo das heute liegt.",
};

const zh = {
  "nav.features": "功能",
  "nav.product": "产品",
  "nav.pricing": "价格",
  "pricing.group.winning": "接到活",
  "pricing.group.doing": "干好活",
  "pricing.group.paid": "拿到钱",
  "pricing.group.running": "把生意做下去",
  "pricing.includedTitle": "所有功能，每个套餐都有",
  "pricing.includedBody": "没有哪一档才解锁工程成本核算，AI 不用另外升级，收款也不是加购项。套餐之间只差能有多少人一起用——别的都一样。",
  "pricing.includedMore": "这只是简表。看看 FieldQuo 的全部功能 →",
  "nav.allFeatures": "全部功能",
  "nav.compare": "对比",
  "nav.savings": "省下多少",
  "nav.glossary": "行业词汇表",
  "product.allFeatures.label": "全部功能",
  "product.allFeatures.desc": "FieldQuo 的每一块，以及它能帮你做什么",
  "product.compare.label": "对比",
  "product.compare.desc": "FieldQuo 与 Jobber、Housecall Pro、ServiceTitan、Projul 的比较",
  "nav.industries": "行业",
  "nav.resources": "资源",
  "nav.contact": "联系我们",
  "nav.login": "登录",
  "nav.signup": "开始免费试用",
  "nav.dashboard": "进入工作台",
  "product.quoting.label": "报价与开账单",
  "product.quoting.description": "几分钟做出一份像样的报价单并发出去",
  "product.scheduling.label": "排期与派工",
  "product.scheduling.description": "Calendly 式的在线预约、约见和派活",
  "product.team.label": "团队与工资",
  "product.team.description": "工时表、承包工打款、按角色分权限",
  "product.analytics.label": "报表与 AI",
  "product.analytics.description": "看懂自己的数——以及该怎么办",
  "hero.title": "为上门服务团队做的报价、账单和排期",
  "hero.subtitle": "在现场做报价，车都没开出人家车道就发出去，收钱不用追着人跑。",
  "hero.cta": "开始免费试用",
  "hero.ctaSecondary": "看看怎么用",
  "hero.noCard": "无需信用卡",
  "hero.emailPlaceholder": "you@yourcompany.com",
  "hero.requestDemo": "预约演示",
  "hero.demo.title": "预约 30 分钟演示",
  "hero.demo.openCta": "预约演示，或让我们回电",
  "hero.demo.openHint": "30 分钟，真人实操，不放幻灯片。或者留个号码，我们打给你。",
  "hero.demo.close": "关闭",
  "hero.demo.modeSlot": "选个时间",
  "hero.demo.modeCallback": "回电给我",
  "hero.demo.phone": "电话号码",
  "hero.demo.whenBest": "什么时间方便接（选填）",
  "hero.demo.requestCallback": "请求回电",
  "hero.demo.callbackSent": "收到——我们很快打给你。",
  "hero.demo.callbackBody": "我们会拨 {phone}。如果没打通，会发邮件到 {email}。",
  "hero.demo.subtitle": "选个时间，我们带你实时走一遍 FieldQuo。",
  "hero.demo.loading": "正在加载可选时间…",
  "hero.demo.noSlots": "现在没有空档——发邮件到 hello@fieldquo.com，我们另外安排。",
  "hero.demo.name": "你的姓名",
  "hero.demo.email": "工作邮箱",
  "hero.demo.company": "公司（选填）",
  "hero.demo.pickSlot": "在上面选个时间",
  "hero.demo.confirmWithTime": "确认 {time}",
  "hero.demo.confirmedTitle": "约好了！",
  "hero.demo.confirmedBody": "日历邀请已发到 {email}，请查收。{when} 见。",
  "hero.demo.genericError": "出了点问题——请再试一次。",
  "hero.sending": "发送中…",
  "hero.demoThanks": "谢谢——我们很快联系你安排演示。",
  "hero.tabs.quotes.label": "报价单",
  "hero.tabs.quotes.headline": "几分钟发出一份像样的报价单，不用耗上几小时",
  "hero.tabs.quotes.body": "用你自己的价格、服务分类和照片做报价单——客户在线批准，不用来回扯皮。",
  "hero.tabs.quotes.alt": "一位师傅在客户家门外用平板做报价单，客户在手机上看",
  "hero.tabs.scheduling.label": "排期",
  "hero.tabs.scheduling.headline": "让客户直接从你的网站预约你",
  "hero.tabs.scheduling.body": "预约页显示你真实的空档，自动派给团队里合适的人，并自动确认。",
  "hero.tabs.scheduling.alt": "一位客户在手机上从师傅的预约页选时间",
  "hero.tabs.invoicing.label": "开账单",
  "hero.tabs.invoicing.headline": "收钱不用追着人跑",
  "hero.tabs.invoicing.body": "已接受的报价单一键变成账单，客户一收到就能在线付款。",
  "hero.tabs.invoicing.alt": "一位客户在手机上看报价单，底部有一个「批准」按钮",
  "hero.tabs.analytics.label": "报表",
  "hero.tabs.analytics.headline": "该收多少钱，别再靠猜",
  "hero.tabs.analytics.body": "看清你真实的经营开销、每个工程的最低价，以及你和同工种其他店铺的差距。",
  "hero.tabs.analytics.alt": "一个工作台，显示每个工程的成本、最低价，以及你的平均价与同工种其他店铺的对比",
  "features.title": "干活要用的，这里都有",
  "features.quotes.title": "几分钟出报价",
  "features.quotes.body": "从你自己的价目表取价，加上照片，发出去的报价单客户在手机上就能批准。",
  "features.invoices.title": "收得回钱的账单",
  "features.invoices.body": "已批准的报价单一键变成账单，可刷卡付款，还能盯住哪些钱没到。",
  "features.scheduling.title": "靠得住的排期",
  "features.scheduling.body": "安排工程、派班组，客户可以从你真实的空档里挑时间。",
  "features.followups.title": "自动跟进",
  "features.followups.body": "没回音的报价单和逾期的账单会自动跟进，用的是你自己的措辞。",
  "pricing.title": "价格简单，明明白白",
  "pricing.subtitle": "每个套餐都包含报价、开账单和排期。按你团队的人数选套餐。",
  "pricing.month": "/月",
  "pricing.cta": "开始免费试用",
  "pricing.empty": "价格方案正在敲定——过一会儿再来看，或联系我们了解早期价格。",
  "contact.title": "联系我们",
  "contact.subtitle": "产品、价格或数据迁移方面的问题。",
  "contact.name": "你的姓名",
  "contact.email": "邮箱",
  "contact.message": "留言",
  "contact.send": "发送留言",
  "contact.sending": "发送中…",
  "contact.sent": "谢谢——我们很快联系你。",
  "contact.error": "出了点问题。请再试一次，或直接发邮件给我们。",
  "booking.work.serviceLabel": "是什么类型的活？",
  "booking.work.serviceUnsure": "还不确定",
  "booking.work.notesLabel": "有什么我们该知道的吗？",
  "booking.work.notesPlaceholder": "要做什么，大概多大量，进场有没有什么特殊情况…",
  "booking.work.notesHint": "选填——写了我们上门时更有准备。",
  "features.everything": "生意要用的，都在一处",
  "features.anyTrade": "适合任何工种",
  "ai.badge": "FieldQuo AI",
  "ai.title": "向你的生意提个问题，拿到实在的答案",
  "ai.body": "FieldQuo AI 读的是你自己的报价单、账单和支出——不是泛泛的建议。问问这个月报价成交率如何，或者上个月材料是不是更便宜，答案都出自你真实的数字。",
  "ai.samples.pricing": "「跟上个季度比，我是不是报低了？」",
  "ai.samples.topClients": "「今年哪些客户给我的钱最多？」",
  "ai.samples.materials": "「现在有哪些材料该囤一点？」",
  "ai.chat.question": "这个月我的报价成交率怎么样？",
  "ai.chat.answer": "你发出了 14 份报价单，6 份被接受——成交率 43%，比上个月的 31% 有提升。其中油漆类报价成交得最好。",
  "resources.title": "免费资源",
  "resources.help.description": "上手设置和使用 FieldQuo 的指南",
  "resources.faq.description": "常见问题的快速解答",
  "resources.contact.description": "和真人聊聊",
  "pricing.popular": "最多人选",
  "pricing.selected": "已选",
  "pricing.firstMonth": "首月",
  "pricing.free": "免费",
  "pricing.then": "之后",
  "pricing.perMonthShort": "/月",
  "pricing.seatsUnlimited": "员工账号不限数量",
  "pricing.seatsOne": "1 个员工账号",
  "pricing.seatsMany": "{count} 个员工账号",
  "pricing.rbacSeats": "1 个主账号 + {count} 个 RBAC 席位",
  "pricing.crewIncluded": "含 {count} 名班组成员——免费",
  "pricing.seatsOneIncluded": "1 个席位——报价、工程和开账单",
  "pricing.seatsManyIncluded": "{count} 个席位——报价、工程和开账单",
  "pricingPage.currencyBasis": "只有一套价格。用哪种货币结算，取决于你注册时填的营业地址：加拿大公司按加元结算，美国公司按美元结算——数字是同一个，不是换算过来的。",
  "pricing.fullAccess": "完整功能——报价、开账单、排期、报表",
  "pricing.quoteLimit": "每月最多 {count} 份报价单",
  "pricing.aiIncluded": "含 AI 助手",
  "faq.title": "常见问题",
  "faq.items.install.q": "需要安装什么吗？",
  "faq.items.install.a": "不用——FieldQuo 完全在浏览器里运行。手机上也能打开。",
  "faq.items.onlinePayment.q": "客户可以在线付账单吗？",
  "faq.items.onlinePayment.a": "可以。连接你自己的 Stripe 账户，客户就能直接从账单邮件里付款——钱直接进你的账户。",
  "faq.items.financing.q": "客户可以分期付吗？",
  "faq.items.financing.a": "可以。在「设置 → 收款」里打开 Affirm，客户在结账时就能把一份账单拆成按月付款——而你仍然是提前一次性收到全款。",
  "faq.items.permissions.q": "我能控制员工看到什么、能做什么吗？",
  "faq.items.permissions.a": "能。每位团队成员都有一个角色——员工、主管或管理员——决定他能创建、指派和查看什么。",
  "faq.items.trade.q": "如果没有我的工种怎么办？",
  "faq.items.trade.a": "FieldQuo 适用于任何承包或上门服务生意。不管什么工种，你都可以开关具体的服务分类，并设定自己的价格。",
  "faq.items.contract.q": "有合同或长期绑定吗？",
  "faq.items.contract.a": "没有。套餐按月计费——随时可以取消。",
  "footer.product": "产品",
  "footer.company": "公司",
  "footer.legal": "法律条款",
  "footer.privacy": "隐私",
  "footer.terms": "条款",
  "footer.security": "安全",
  "footer.rights": "保留所有权利。",
  "footer.tagline": "为承包商和上门服务师傅打造的一体化平台——报价、排期、开账单和收款，都在一处。",
  "footer.links.help": "帮助中心",
  "footer.links.faq": "常见问题",
  "footer.links.blog": "博客",
  "footer.links.contact": "联系我们",
  "footer.links.about": "关于我们",
  "footer.links.careers": "招聘",
  "footer.links.privacy": "隐私政策",
  "footer.links.terms": "服务条款",
  "footer.links.security": "安全",
  "theme.label": "主题",
  "theme.light": "浅色",
  "theme.dark": "深色",
  "theme.system": "跟随系统",
  "pricingPage.title": "价格简单，明明白白",
  "pricingPage.subtitle": "每个套餐都包含报价、开账单和排期。按你团队的人数选套餐。",
  "pricingPage.perMonth": "/月",
  "pricingPage.currencyNote": "所有价格均以 {currency} 计。结算货币由你注册时选择的国家决定。",
  "pricingPage.taxNote": "另加适用税费。",
  "pricingPage.emptyTitle": "价格方案正在敲定——过一会儿再来看。",
  "pricingPage.emptyCta": "问问我们早期价格",
  "notFound.title": "找不到这个页面",
  "notFound.body": "链接可能已失效，或者页面已经挪走了。长链接被短信截成两半的情况比你想的常见——检查一下地址是不是完整的。",
  "notFound.home": "回到首页",
  "common.loading": "加载中…",
  "common.learnMore": "了解更多",
  "common.getStarted": "开始使用",
  "common.back": "返回",
  "feature.leads.name": "潜在客户跟踪",
  "feature.leads.summary": "所有询价都在一张表里，按热到冷排序，一键转成报价单。",
  "feature.lead_form.name": "放在你网站上的询价表单",
  "feature.lead_form.summary": "一个可以嵌到任何网站的表单；提交回来的内容进你的潜在客户列表，而不是收件箱。",
  "feature.quotes.name": "报价单",
  "feature.quotes.summary": "用你自己的单价做报价单，按房间或范围分组，还能加照片。",
  "feature.priced_options.name": "标准、进阶、顶配三档",
  "feature.priced_options.summary": "同一个工程给出三个价格，让客户自己挑。",
  "feature.quote_send.name": "用邮件发报价单",
  "feature.quote_send.summary": "一个按钮，从你自己的邮箱把报价单发出去，附上 PDF，用客户的语言。",
  "feature.quote_pdf.name": "带你自己配色的报价单 PDF",
  "feature.quote_pdf.summary": "PDF 上是你的 logo 和品牌色——上面没有一个字提到 FieldQuo。",
  "feature.online_approval.name": "客户在线批准并签字",
  "feature.online_approval.summary": "客户点开链接，勾选想加的项目，签字，活就定了——不用打印，也不用电话来回追。",
  "feature.ai_quote_review.name": "AI 报价复核",
  "feature.ai_quote_review.summary": "发出去之前先看看：漏了什么、这个价跟你谈成过的单子比如何、哪里可以说得更清楚。",
  "feature.add_on_upsell.name": "推荐加项",
  "feature.add_on_upsell.summary": "报价单底部的可选加项，价格出自你自己的历史记录，客户勾一下就行。",
  "feature.follow_ups.name": "自动跟进",
  "feature.follow_ups.summary": "没回音的报价单会按你设定的节奏自动跟进，用你自己的措辞，不用你记着。",
  "feature.voice_receptionist.name": "AI 接线员",
  "feature.voice_receptionist.summary": "你在梯子上时它替你接电话，问清情况，约好上门，并把录音留给你。",
  "feature.voice_callbacks.name": "确认来电",
  "feature.voice_callbacks.summary": "助手提前打电话确认明天的约见，免得一早上耗在放鸽子的客户身上。",
  "feature.call_to_quote.name": "从通话直接起草报价",
  "feature.call_to_quote.summary": "来电人描述的内容会变成一份报价草稿，你打开、改一改就能发。",
  "feature.booking_page.name": "在线预约页",
  "feature.booking_page.summary": "客户从你真实的空档里选时间，路上的时间和到场时间段都已经算进去了。",
  "feature.booking_deposit.name": "收定金锁住时段",
  "feature.booking_deposit.summary": "预约时先收一笔上门费，真接了活就在账单里抵扣掉。",
  "feature.website_builder.name": "你自己的网站",
  "feature.website_builder.summary": "用你已经告诉我们的信息写成的网站，挂在你自己的域名上，可以一个版块一个版块地改。",
  "feature.instant_quotes.name": "在线即时估价",
  "feature.instant_quotes.summary": "访客回答几个问题，当场拿到一个价格区间，用的是你设定的单价。",
  "feature.self_quote.name": "客户自己给活估价",
  "feature.self_quote.summary": "一个公开表单，业主描述要做的活并上传照片；提交后会变成一份已经开好头的报价单。",
  "feature.kitchen_designer.name": "厨房与橱柜设计器",
  "feature.kitchen_designer.summary": "画出柜体走向，选好饰面，橱柜价格和平面图直接进报价单。",
  "feature.aerial_measure.name": "从天上量尺寸",
  "feature.aerial_measure.summary": "输入地址就能拿到屋顶面积和坡度，或者描出车道、露台的轮廓，不用跑一趟。",
  "feature.funnels.name": "获客落地页",
  "feature.funnels.summary": "给广告或传单做的多步落地页，还能看到人在哪一步流失。",
  "feature.email_campaigns.name": "邮件群发",
  "feature.email_campaigns.summary": "写一次，用你自己的邮箱发给客户名单，还能看到送达情况。",
  "feature.door_hanger_routes.name": "挂门广告路线",
  "feature.door_hanger_routes.summary": "规划街道、分配给人，班组扫街时一站一站打勾。",
  "feature.review_requests.name": "邀请客户评价",
  "feature.review_requests.summary": "活干完、钱收到之后，客气地请客户留一条评价。",
  "feature.testimonials.name": "网站上的客户评价",
  "feature.testimonials.summary": "把客户说的话收集起来，展示在你的网站和报价单上。",
  "feature.referrals.name": "推荐给同行",
  "feature.referrals.summary": "发一个邀请；对方注册后，你们两边账户都多一个免费月。",
  "feature.embeds.name": "即插即用的组件",
  "feature.embeds.summary": "在你现有的网站上粘一行代码，就能嵌入你的预约、报价表单或评价。",
  "feature.bio_link.name": "一个链接串起所有主页",
  "feature.bio_link.summary": "为你的 Instagram 或车身贴做的一张品牌页，指向你提供的全部服务。",
  "feature.subcontractor_bids.name": "把分包价并进你的投标",
  "feature.subcontractor_bids.summary": "把分包商的报价直接拉进你的单子当成本，加上加价，客户只看到你的价格。",
  "feature.jobs.name": "工程",
  "feature.jobs.summary": "报价单一被批准就变成工程，施工范围、地址和相关文件都已经带上了。",
  "feature.scheduling.name": "排期与派工",
  "feature.scheduling.summary": "把上门排进日历，指定谁去，一眼看到整个班组这一周。",
  "feature.crew_shifts.name": "班组排班",
  "feature.crew_shifts.summary": "排好下周的班表，发布出去，每个人都能看到自己的班。",
  "feature.recurring_jobs.name": "重复工程",
  "feature.recurring_jobs.summary": "每周、每月或按季节的活，会自动排回日历。",
  "feature.appointment_reminders.name": "约见提醒",
  "feature.appointment_reminders.summary": "你到之前客户会收到一条短信，到了发现门锁着的情况就少了。",
  "feature.client_reschedule.name": "客户自己改时间",
  "feature.client_reschedule.summary": "确认信里的一个链接，客户不用打电话就能改上门时间。",
  "feature.job_costing.name": "工程成本核算",
  "feature.job_costing.summary": "人工、材料和支出对上你报的价，你就知道这单到底赚了多少。",
  "feature.materials.name": "工程上的材料",
  "feature.materials.summary": "现场用了什么、花了多少钱，还有什么要买。",
  "feature.job_photos.name": "施工前后照片",
  "feature.job_photos.summary": "照片归到对应的工程下，随时可以放进报价单、账单或你的网站。",
  "feature.checklists.name": "工程检查表",
  "feature.checklists.summary": "现场要做的事列成一张表，由干活的人自己打勾。",
  "feature.suggested_tasks.name": "推荐的下一步",
  "feature.suggested_tasks.summary": "工程会主动列出同类活通常需要的任务，免得漏掉什么。",
  "feature.tasks.name": "待办清单",
  "feature.tasks.summary": "所有要跟进的事，按拖着不办损失最大的排在前面。",
  "feature.work_areas.name": "施工区域",
  "feature.work_areas.summary": "把大工程拆成房间或区域，每块交给不同的人。",
  "feature.time_clock.name": "上下班打卡",
  "feature.time_clock.summary": "班组对着正在干的工程打卡，手上有什么手机都能用。",
  "feature.timesheets.name": "要你审批的工时表",
  "feature.timesheets.summary": "工时会挂到真实的工程上；你审批之后才能变成工资。",
  "feature.crew_inbox.name": "班组收件箱",
  "feature.crew_inbox.summary": "班组把照片和进度用短信发到一个号码，系统自动归到对应的工程下。",
  "feature.time_off.name": "请假与年假",
  "feature.time_off.summary": "申请自动转给对应的主管，假期余额自己累积，日历也知道。",
  "feature.invoices.name": "账单",
  "feature.invoices.summary": "被批准的报价单变成账单，长得跟报价单一样，因为本来就是从它生成的。",
  "feature.invoice_send.name": "发送账单",
  "feature.invoice_send.summary": "从你自己的邮箱发出，附上 PDF，里面带一个立即付款的链接。",
  "feature.invoice_changes.name": "改过的账单，有迹可循",
  "feature.invoice_changes.summary": "修改已开出的账单时，旧版本会保留，双方谈定的是什么永远不会说不清。",
  "feature.card_payments.name": "刷卡收款",
  "feature.card_payments.summary": "客户在手机上付款，钱进你的账户，不是我们的。",
  "feature.stripe_connect.name": "你自己的收款账户",
  "feature.stripe_connect.summary": "银行账户连接一次，之后每一笔客户付款都直接结算到那里。",
  "feature.financing.name": "让客户按月付",
  "feature.financing.summary": "结账时打开分期付款，专门对付那些业主一直往后拖的大工程。",
  "feature.service_plans.name": "保养套餐",
  "feature.service_plans.summary": "让客户签一个周期性套餐，到期自动扣卡，不用你开口。",
  "feature.client_portal.name": "客户专区",
  "feature.client_portal.summary": "一个链接，客户能看到自己的报价单、账单和还欠多少。",
  "feature.sales_tax.name": "按地址匹配的销售税",
  "feature.sales_tax.summary": "税率设一次；文件上落的就是施工所在地该用的那一个。",
  "feature.dashboard.name": "工作台",
  "feature.dashboard.summary": "报了多少、谈成多少、排了多少、欠着多少，一屏看完，数据截至今早。",
  "feature.break_even.name": "你的保本价",
  "feature.break_even.summary": "一天要进多少钱你才开始赚，由你真实的经营开销算出来。",
  "feature.benchmark.name": "你的价格比起同行如何",
  "feature.benchmark.summary": "你的单价和成交率在同工种其他店铺中处于什么位置——不点名，也包括你自己。",
  "feature.monthly_digest.name": "月度小结",
  "feature.monthly_digest.summary": "每月一次，用句子而不是图表把你的数字讲清楚。",
  "feature.goals.name": "营收目标",
  "feature.goals.summary": "定下全年目标，看看自己超前还是落后多少。",
  "feature.expenses.name": "支出与经营开销",
  "feature.expenses.summary": "记下花的钱，把属于某个工程的和属于整个生意的分开。",
  "feature.marketing_spend.name": "你的广告值不值",
  "feature.marketing_spend.summary": "按渠道记录花了多少——包括从 Meta Ads 自动导入——看到你为接活所做的一切合起来平均每个潜在客户花了多少钱。",
  "feature.payroll.name": "工资发放",
  "feature.payroll.summary": "审批过的工时变成一个发薪批次，工资单可以直接给人，也能导出给会计。",
  "feature.contractor_payouts.name": "在应用里给承包工打款",
  "feature.contractor_payouts.summary": "人员名单里标记为承包工的人，审批过的工时会作为一笔真实的银行转账打出去。",
  "feature.price_book.name": "你的价目表",
  "feature.price_book.summary": "你的服务和单价集中在一处，可以从表格导入，也能导出回去。",
  "feature.material_costs.name": "材料成本与用量配比",
  "feature.material_costs.summary": "一升漆或一张夹板对你来说多少钱，这么大的活会吃掉多少。",
  "feature.team_access.name": "团队角色与权限",
  "feature.team_access.summary": "一项一项决定每个人能看什么、能改什么——而且是在服务器上把住，不只是界面上藏起来。",
  "feature.white_label.name": "处处都是你的名字",
  "feature.white_label.summary": "业主看到的每一份报价单、账单、页面和邮件，上面是你的 logo 和你的颜色。",
  "feature.own_email_domain.name": "用你自己的邮箱地址发信",
  "feature.own_email_domain.summary": "域名验证一次，之后所有信件都从你这里发出，而不是从一个共用地址。",
  "feature.quote_email_wording.name": "自己写随附邮件",
  "feature.quote_email_wording.summary": "一段一段改写报价邮件的内容，而且它会保持报价单当初写成的语言。",
  "feature.document_layouts.name": "你自己的报价单和账单版式",
  "feature.document_layouts.summary": "选择打印文件上出现哪些段落，以及哪一套是默认的。",
  "feature.contract_terms.name": "每份文件都带上你的条款",
  "feature.contract_terms.summary": "付款条款和合同措辞会自动附在你发出去的文件上。",
  "feature.languages.name": "英语和法语",
  "feature.languages.summary": "用客户说的语言发报价单；签过字的文件保持签字时的措辞。",
  "feature.ai_copilot.name": "问问 FieldQuo AI",
  "feature.ai_copilot.summary": "用大白话问自己生意上的问题，答案出自你自己的数字。",
  "feature.activity_log.name": "谁改了什么",
  "feature.activity_log.summary": "每一次发送、修改和批准都有一条连续记录，带着名字和时间。",
  "feature.clients.name": "客户名单",
  "feature.clients.summary": "每一位客户、他们的物业和往来记录，从现在存放它们的地方导进来。",
  "feature.marketing_spend.limits": "每条线索的成本是把所有渠道混在一起算的，没有按渠道或按广告系列拆分——FieldQuo 里目前还没有任何东西能把某一笔具体的花费和某一条具体的线索对上。",
};

const it = {
  // Navigazione
  "nav.features": "Funzionalità",
  "nav.product": "Prodotto",
  "nav.pricing": "Prezzi",
  "pricing.group.winning": "Ottenere il lavoro",
  "pricing.group.doing": "Eseguire il lavoro",
  "pricing.group.paid": "Farsi pagare",
  "pricing.group.running": "Mandare avanti l'impresa",
  "pricing.includedTitle": "C'è tutto in ogni piano",
  "pricing.includedBody": "Non esiste un livello che sblocca il controllo costi, né un aggiornamento per l'AI, né un componente aggiuntivo per incassare. I piani si distinguono per quante persone ci lavorano dentro — nient'altro.",
  "pricing.includedMore": "Questo è l'elenco breve. Veda tutto quello che fa FieldQuo →",
  "nav.allFeatures": "Tutte le funzionalità",
  "nav.compare": "Confronta",
  "nav.savings": "Risparmi",
  "nav.glossary": "Glossario del mestiere",
  "product.allFeatures.label": "Tutte le funzionalità",
  "product.allFeatures.desc": "Ogni parte di FieldQuo, e che cosa fa per Lei",
  "product.compare.label": "Confronta",
  "product.compare.desc": "FieldQuo a confronto con Jobber, Housecall Pro, ServiceTitan e Projul",
  "nav.industries": "Settori",
  "nav.resources": "Risorse",
  "nav.contact": "Contatti",
  "nav.login": "Accedi",
  "nav.signup": "Inizia la prova gratuita",
  "nav.dashboard": "Vai alla dashboard",

  // Menu prodotto
  "product.quoting.label": "Preventivi e fatturazione",
  "product.quoting.description": "Crei e invii preventivi professionali in pochi minuti",
  "product.scheduling.label": "Pianificazione e assegnazione",
  "product.scheduling.description":
    "Prenotazioni in stile Calendly, appuntamenti e assegnazione dei lavori",
  "product.team.label": "Team e buste paga",
  "product.team.description":
    "Fogli ore, pagamenti ai collaboratori, accessi per ruolo",
  "product.analytics.label": "Analisi e AI",
  "product.analytics.description":
    "Conosca i suoi numeri — e sappia che cosa farci",

  // Hero
  "hero.title": "Preventivi, fatture e pianificazione per le squadre di servizi a domicilio",
  "hero.subtitle":
    "Prepari un preventivo in cantiere, lo invii prima di risalire in furgone e si faccia pagare senza rincorrere nessuno.",
  "hero.cta": "Inizia la prova gratuita",
  "hero.ctaSecondary": "Guardi come funziona",
  "hero.noCard": "Nessuna carta di credito richiesta",
  "hero.emailPlaceholder": "tu@tuaimpresa.it",
  "hero.requestDemo": "Richiedi una demo",
  "hero.demo.title": "Prenoti una demo di 30 minuti",
  "hero.demo.openCta": "Prenoti una demo o una richiamata",
  "hero.demo.openHint": "30 minuti, dal vivo, senza slide. Oppure lasci il suo numero e la richiamiamo noi.",
  "hero.demo.close": "Chiudi",
  "hero.demo.modeSlot": "Scelga un orario",
  "hero.demo.modeCallback": "Richiamatemi",
  "hero.demo.phone": "Numero di telefono",
  "hero.demo.whenBest": "Momento migliore per raggiungerla (facoltativo)",
  "hero.demo.requestCallback": "Richiedi una richiamata",
  "hero.demo.callbackSent": "Ricevuto — la chiameremo a breve.",
  "hero.demo.callbackBody": "Chiameremo il {phone}. Se non la troviamo, le scriveremo a {email}.",
  "hero.demo.subtitle": "Scelga un orario e le mostreremo FieldQuo dal vivo.",
  "hero.demo.loading": "Caricamento degli orari…",
  "hero.demo.noSlots": "Al momento non ci sono orari disponibili — scriva a hello@fieldquo.com e ne troveremo uno.",
  "hero.demo.name": "Il suo nome",
  "hero.demo.email": "Email di lavoro",
  "hero.demo.company": "Impresa (facoltativo)",
  "hero.demo.pickSlot": "Scelga un orario qui sopra",
  "hero.demo.confirmWithTime": "Conferma {time}",
  "hero.demo.confirmedTitle": "Prenotazione confermata!",
  "hero.demo.confirmedBody": "Controlli {email} per l'invito nel calendario. Ci vediamo {when}.",
  "hero.demo.genericError": "Qualcosa è andato storto — riprovi.",
  "hero.sending": "Invio…",
  "hero.demoThanks": "Grazie — la contatteremo a breve per organizzare la sua demo.",
  "hero.tabs.quotes.label": "Preventivi",
  "hero.tabs.quotes.headline": "Invii un preventivo professionale in minuti, non in ore",
  "hero.tabs.quotes.body":
    "Prepari i preventivi con i suoi prezzi, le sue categorie di servizio e le sue foto — il cliente approva online, senza rimpalli.",
  "hero.tabs.quotes.alt": "Un artigiano prepara un preventivo su un tablet davanti alla casa di una cliente, mentre lei lo legge sul telefono",
  "hero.tabs.scheduling.label": "Pianificazione",
  "hero.tabs.scheduling.headline":
    "Lasci che i clienti la prenotino direttamente dal suo sito",
  "hero.tabs.scheduling.body":
    "Una pagina di prenotazione che mostra la sua disponibilità reale, assegna la persona giusta del suo team e conferma automaticamente.",
  "hero.tabs.scheduling.alt": "Una cliente sceglie l'orario di un appuntamento sulla pagina di prenotazione di un artigiano, dal telefono",
  "hero.tabs.invoicing.label": "Fatturazione",
  "hero.tabs.invoicing.headline": "Si faccia pagare senza rincorrere nessuno",
  "hero.tabs.invoicing.body":
    "Trasformi un preventivo accettato in fattura con un clic, e lasci che i clienti paghino online appena la ricevono.",
  "hero.tabs.invoicing.alt": "Un cliente legge un preventivo sul telefono, con un pulsante Approva in fondo",
  "hero.tabs.analytics.label": "Analisi",
  "hero.tabs.analytics.headline": "Sappia quanto far pagare, prima di tirare a indovinare",
  "hero.tabs.analytics.body":
    "Veda le sue spese generali reali, il suo prezzo minimo per lavoro e come si colloca rispetto ad altre imprese del suo mestiere.",
  "hero.tabs.analytics.alt": "Una dashboard che mostra il costo per lavoro, il prezzo minimo e il confronto tra i suoi prezzi medi e quelli di altre imprese del suo mestiere",

  // Funzionalità
  "features.title": "Tutto quello che serve per mandare avanti il lavoro",
  "features.quotes.title": "Preventivi in pochi minuti",
  "features.quotes.body":
    "Valorizzi dal suo listino, aggiunga foto e invii un preventivo che il cliente può approvare dal telefono.",
  "features.invoices.title": "Fatture che vengono pagate",
  "features.invoices.body":
    "Trasformi un preventivo approvato in fattura con un clic, incassi con carta e tenga sotto controllo l'insoluto.",
  "features.scheduling.title": "Una pianificazione che regge",
  "features.scheduling.body":
    "Prenoti i lavori, assegni le squadre e lasci che i clienti scelgano uno slot dalla sua disponibilità reale.",
  "features.followups.title": "Solleciti in automatico",
  "features.followups.body":
    "Preventivi rimasti senza risposta e fatture in ritardo vengono sollecitati da soli, con parole sue.",

  // Prezzi
  "pricing.title": "Prezzi semplici e trasparenti",
  "pricing.subtitle":
    "Ogni piano comprende preventivi, fatturazione e pianificazione. Scelga il piano adatto alla dimensione del suo team.",
  "pricing.month": "/mese",
  "pricing.cta": "Inizia la prova gratuita",
  "pricing.empty":
    "I piani tariffari sono in fase di definizione — ricontrolli tra poco, oppure ci contatti per i prezzi ad accesso anticipato.",

  // Contatti
  "contact.title": "Parli con noi",
  "contact.subtitle": "Domande sul prodotto, sui prezzi o sulla migrazione dei suoi dati.",
  "contact.name": "Il suo nome",
  "contact.email": "Email",
  "contact.message": "Messaggio",
  "contact.send": "Invia il messaggio",
  "contact.sending": "Invio…",
  "contact.sent": "Grazie — la contatteremo a breve.",
  "contact.error": "Qualcosa è andato storto. Riprovi, oppure ci scriva direttamente.",

  // Pagina pubblica di prenotazione
  "booking.work.serviceLabel": "Di che tipo di lavoro si tratta?",
  "booking.work.serviceUnsure": "Non ancora sicuro",
  "booking.work.notesLabel": "C'è qualcosa che dovremmo sapere?",
  "booking.work.notesPlaceholder":
    "Che cosa c'è da fare, all'incirca quanto è grande, qualsiasi difficoltà per arrivarci…",
  "booking.work.notesHint": "Facoltativo — ci permette di arrivare preparati.",

  "features.everything": "Tutto quello che serve alla sua impresa, in un unico posto",
  "features.anyTrade": "Pensato per qualsiasi mestiere",

  // Sezione FieldQuo AI
  "ai.badge": "FieldQuo AI",
  "ai.title": "Faccia una domanda alla sua impresa e ottenga una risposta vera",
  "ai.body":
    "FieldQuo AI legge i suoi preventivi, le sue fatture e le sue spese — non consigli generici. Chieda come sta andando il suo tasso di conversione questo mese, o se i materiali costavano meno il mese scorso, e ottenga una risposta fondata sui suoi numeri reali.",
  "ai.samples.pricing": "«Sto facendo prezzi troppo bassi rispetto allo scorso trimestre?»",
  "ai.samples.topClients":
    "«Quali dei miei clienti mi hanno pagato di più quest'anno?»",
  "ai.samples.materials":
    "«Conviene fare scorta di qualche materiale in questo momento?»",
  "ai.chat.question": "Com'è il mio tasso di conversione dei preventivi questo mese?",
  "ai.chat.answer":
    "Ha inviato 14 preventivi e 6 sono stati accettati — un tasso di conversione del 43%, in crescita dal 31% del mese scorso. I preventivi di verniciatura sono quelli che convertono meglio.",

  // Risorse
  "resources.title": "Risorse gratuite",
  "resources.help.description":
    "Guide per la configurazione e l'uso di FieldQuo",
  "resources.faq.description": "Risposte rapide alle domande più comuni",
  "resources.contact.description": "Parli con una persona vera",

  // Scheda del piano
  "pricing.popular": "Il più scelto",
  "pricing.selected": "Selezionato",
  "pricing.firstMonth": "Primo mese",
  "pricing.free": "Gratuito",
  "pricing.then": "Poi",
  "pricing.perMonthShort": "/mese",
  "pricing.seatsUnlimited": "Account dipendenti illimitati",
  "pricing.seatsOne": "1 account dipendente",
  "pricing.seatsMany": "{count} account dipendenti",
  "pricing.rbacSeats": "1 account principale + {count} postazioni con permessi",
  "pricing.crewIncluded": "{count} membri della squadra inclusi — gratis",
  "pricing.seatsOneIncluded": "1 postazione — preventivi, lavori e fatturazione",
  "pricing.seatsManyIncluded": "{count} postazioni — preventivi, lavori e fatturazione",
  "pricingPage.currencyBasis": "Un solo listino. La valuta in cui le viene fatturato dipende dall'indirizzo dell'attività che indica alla registrazione: le imprese canadesi sono fatturate in dollari canadesi, quelle statunitensi in dollari statunitensi — lo stesso numero in entrambi i casi, non un importo convertito.",
  "pricing.fullAccess":
    "Accesso completo — preventivi, fatturazione, pianificazione, analisi",
  "pricing.quoteLimit": "Fino a {count} preventivi al mese",
  "pricing.aiIncluded": "Copilota AI incluso",

  // FAQ
  "faq.title": "Domande frequenti",
  "faq.items.install.q": "Devo installare qualcosa?",
  "faq.items.install.a":
    "No — FieldQuo funziona interamente nel browser. Può usarlo anche dal telefono.",
  "faq.items.onlinePayment.q": "I miei clienti possono pagare le fatture online?",
  "faq.items.onlinePayment.a":
    "Sì. Colleghi il suo account Stripe e i clienti potranno pagare direttamente dall'email della fattura — il denaro arriva a Lei.",
  "faq.items.financing.q": "I miei clienti possono pagare a rate?",
  "faq.items.financing.a":
    "Sì. Attivi Affirm in Impostazioni → Pagamenti e i clienti potranno dividere una fattura in rate mensili al momento del pagamento — mentre Lei viene comunque pagato per intero e subito.",
  "faq.items.permissions.q":
    "Posso decidere che cosa i miei dipendenti vedono e possono fare?",
  "faq.items.permissions.a":
    "Sì. Ogni membro del team ha un ruolo — dipendente, responsabile o amministratore — che determina che cosa può creare, assegnare e consultare.",
  "faq.items.trade.q": "E se il mio mestiere non è in elenco?",
  "faq.items.trade.a":
    "FieldQuo funziona per qualsiasi impresa edile o di servizi a domicilio. Può attivare o disattivare singole categorie di servizio e impostare i suoi prezzi, qualunque sia il mestiere.",
  "faq.items.contract.q": "C'è un contratto o un vincolo di durata?",
  "faq.items.contract.a": "No. I piani sono mese per mese — può disdire quando vuole.",

  // Piè di pagina
  "footer.product": "Prodotto",
  "footer.company": "Azienda",
  "footer.legal": "Note legali",
  "footer.privacy": "Privacy",
  "footer.terms": "Condizioni",
  "footer.security": "Sicurezza",
  "footer.rights": "Tutti i diritti riservati.",
  "footer.tagline":
    "La piattaforma tutto-in-uno per artigiani e professionisti dei servizi a domicilio — preventivi, pianificazione, fatturazione e pagamenti in un unico posto.",
  "footer.links.help": "Centro assistenza",
  "footer.links.faq": "Domande frequenti",
  "footer.links.blog": "Blog",
  "footer.links.contact": "Contattaci",
  "footer.links.about": "Chi siamo",
  "footer.links.careers": "Lavora con noi",
  "footer.links.privacy": "Informativa sulla privacy",
  "footer.links.terms": "Condizioni di servizio",
  "footer.links.security": "Sicurezza",

  // Tema
  "theme.label": "Tema",
  "theme.light": "Chiaro",
  "theme.dark": "Scuro",
  "theme.system": "Come il sistema",

  // Pagina dei prezzi
  "pricingPage.title": "Prezzi semplici e trasparenti",
  "pricingPage.subtitle":
    "Ogni piano comprende preventivi, fatturazione e pianificazione. Scelga il piano adatto alla dimensione del suo team.",
  "pricingPage.perMonth": "/mese",
  "pricingPage.currencyNote":
    "Tutti i prezzi sono in {currency}. La sua valuta di fatturazione è determinata dal Paese che sceglie alla registrazione.",
  "pricingPage.taxNote": "Oltre alle imposte applicabili.",
  "pricingPage.emptyTitle":
    "I piani tariffari sono in fase di definizione — ricontrolli tra poco.",
  "pricingPage.emptyCta": "Ci chieda dei prezzi ad accesso anticipato",

  // 404
  "notFound.title": "Non troviamo questa pagina",
  "notFound.body":
    "Il link potrebbe essere interrotto, oppure la pagina potrebbe essere stata spostata. Gli SMS spezzano a metà i link lunghi più spesso di quanto si creda — controlli di avere l'indirizzo completo.",
  "notFound.home": "Torna alla home",

  // Comuni
  "common.loading": "Caricamento…",
  "common.learnMore": "Scopri di più",
  "common.getStarted": "Inizia",
  "common.back": "Indietro",

  // ── Nomi delle funzionalità (lib/marketing/featureMatrix.js) ────────────
  "feature.leads.name": "Gestione dei lead",
  "feature.leads.summary":
    "Ogni richiesta in un unico elenco, classificata da calda a fredda, con un clic per trasformarla in preventivo.",
  "feature.lead_form.name": "Modulo di contatto per il suo sito",
  "feature.lead_form.summary":
    "Un modulo da inserire in qualsiasi sito; le risposte finiscono nel suo elenco lead, non in una casella di posta.",
  "feature.quotes.name": "Preventivi",
  "feature.quotes.summary":
    "Costruisca un preventivo con le sue tariffe, lo raggruppi per ambiente o per ambito e ci aggiunga le foto.",
  "feature.priced_options.name": "Opzioni base, intermedia e premium",
  "feature.priced_options.summary":
    "Invii lo stesso lavoro a tre prezzi e lasci che sia il cliente a scegliere quello che vuole.",
  "feature.quote_send.name": "Invio del preventivo per email",
  "feature.quote_send.summary":
    "Un pulsante invia il preventivo dal suo indirizzo, con il PDF allegato, nella lingua del cliente.",
  "feature.quote_pdf.name": "PDF del preventivo nei suoi colori",
  "feature.quote_pdf.summary":
    "Un PDF che porta il suo logo e il suo colore aziendale — nulla al suo interno nomina FieldQuo.",
  "feature.online_approval.name": "Il cliente approva e firma online",
  "feature.online_approval.summary":
    "Il cliente apre un link, sceglie gli eventuali extra, firma e il lavoro è confermato — senza stampe e senza rincorrersi al telefono.",
  "feature.ai_quote_review.name": "Revisione AI del preventivo",
  "feature.ai_quote_review.summary":
    "Prima dell'invio: che cosa ha dimenticato, come si colloca il prezzo rispetto a quelli che ha vinto e come renderlo più chiaro.",
  "feature.add_on_upsell.name": "Extra suggeriti",
  "feature.add_on_upsell.summary":
    "Extra facoltativi in fondo al preventivo, valorizzati dal suo storico, che il cliente può spuntare.",
  "feature.follow_ups.name": "Solleciti automatici",
  "feature.follow_ups.summary":
    "Un preventivo rimasto senza risposta viene sollecitato secondo il suo calendario, con parole sue, senza che debba ricordarsene.",
  "feature.voice_receptionist.name": "Centralino AI",
  "feature.voice_receptionist.summary":
    "Risponde al telefono quando Lei è sulla scala, raccoglie i dati, prenota la visita e le lascia la registrazione.",
  "feature.voice_callbacks.name": "Chiamate di conferma",
  "feature.voice_callbacks.summary":
    "L'assistente chiama in anticipo per confermare gli appuntamenti del giorno dopo, così non perde la mattinata per chi non si presenta.",
  "feature.call_to_quote.name": "Preventivo abbozzato dalla telefonata",
  "feature.call_to_quote.summary":
    "Quanto descritto da chi ha chiamato torna come bozza di preventivo che Lei apre, corregge e invia.",
  "feature.booking_page.name": "Pagina di prenotazione online",
  "feature.booking_page.summary":
    "I clienti scelgono uno slot dalla sua disponibilità reale, con tempi di spostamento e finestre di arrivo già considerati.",
  "feature.booking_deposit.name": "Acconto per bloccare lo slot",
  "feature.booking_deposit.summary":
    "Incassi un costo di visita al momento della prenotazione e lo porti in detrazione sulla fattura quando il lavoro parte.",
  "feature.website_builder.name": "Il suo sito web",
  "feature.website_builder.summary":
    "Un sito scritto a partire da quello che ci ha già detto, sul suo indirizzo, che può modificare blocco per blocco.",
  "feature.instant_quotes.name": "Stima immediata online",
  "feature.instant_quotes.summary":
    "Un visitatore risponde a qualche domanda e ottiene subito una fascia di prezzo, calcolata sulle tariffe che imposta Lei.",
  "feature.self_quote.name": "I clienti possono valorizzare da soli il proprio lavoro",
  "feature.self_quote.summary":
    "Un modulo pubblico dove il proprietario descrive il lavoro e carica le foto; arriva come preventivo già avviato.",
  "feature.kitchen_designer.name": "Progettista di cucine e mobili",
  "feature.kitchen_designer.summary":
    "Disegni la composizione, scelga le finiture, e i prezzi dei mobili e la pianta finiscono direttamente nel preventivo.",
  "feature.aerial_measure.name": "Misure dal cielo",
  "feature.aerial_measure.summary":
    "Digiti l'indirizzo e ottenga superficie e pendenza del tetto, oppure tracci un vialetto o un patio, senza andare sul posto.",
  "feature.funnels.name": "Funnel di acquisizione",
  "feature.funnels.summary":
    "Pagine a più passaggi per un annuncio o un volantino, con i numeri su dove le persone abbandonano.",
  "feature.email_campaigns.name": "Campagne email",
  "feature.email_campaigns.summary":
    "Scriva una volta, invii al suo elenco clienti dal suo indirizzo e veda a chi è arrivata.",
  "feature.door_hanger_routes.name": "Percorsi per i volantini porta a porta",
  "feature.door_hanger_routes.summary":
    "Pianifichi le vie, le assegni e spunti le tappe mentre la sua squadra gira il quartiere.",
  "feature.review_requests.name": "Richieste di recensione",
  "feature.review_requests.summary":
    "A lavoro finito e pagato, al cliente arriva una sola richiesta garbata di lasciare una recensione.",
  "feature.testimonials.name": "Recensioni sul suo sito",
  "feature.testimonials.summary":
    "Raccolga quello che dicono i clienti e lo mostri sul suo sito e nei suoi preventivi.",
  "feature.referrals.name": "Segnali un altro artigiano",
  "feature.referrals.summary":
    "Mandi un invito; quando si registrano, un mese gratis viene aggiunto sia al suo account sia al loro.",
  "feature.embeds.name": "Widget pronti all'uso",
  "feature.embeds.summary":
    "Incolli una riga in un sito che ha già per inserirci prenotazioni, modulo di preventivo o recensioni.",
  "feature.bio_link.name": "Un unico link per i suoi profili",
  "feature.bio_link.summary":
    "Una sola pagina personalizzata per il suo Instagram o per l'adesivo sul furgone, che rimanda a tutto ciò che offre.",
  "feature.subcontractor_bids.name": "Prezzi dei subappaltatori nella sua offerta",
  "feature.subcontractor_bids.summary":
    "Importi il preventivo di un subappaltatore nel suo come costo, ci applichi il ricarico e il cliente vedrà solo il suo prezzo.",
  "feature.jobs.name": "Lavori",
  "feature.jobs.summary":
    "Un preventivo approvato diventa un lavoro che porta già con sé l'ambito, l'indirizzo e i documenti.",
  "feature.scheduling.name": "Pianificazione e assegnazione",
  "feature.scheduling.summary":
    "Metta le visite in calendario, assegni chi ci va e veda in un colpo d'occhio la settimana di tutta la squadra.",
  "feature.crew_shifts.name": "Turni della squadra",
  "feature.crew_shifts.summary":
    "Prepari i turni della settimana successiva, li pubblichi e ciascuno vedrà i propri.",
  "feature.recurring_jobs.name": "Lavori ricorrenti",
  "feature.recurring_jobs.summary":
    "Lavori settimanali, mensili o stagionali che si rimettono da soli in calendario.",
  "feature.appointment_reminders.name": "Promemoria degli appuntamenti",
  "feature.appointment_reminders.summary":
    "Il cliente riceve un SMS prima del suo arrivo, così trova meno porte chiuse.",
  "feature.client_reschedule.name": "I clienti spostano da soli l'appuntamento",
  "feature.client_reschedule.summary":
    "Un link nella conferma permette al cliente di spostare la visita senza telefonarle.",
  "feature.job_costing.name": "Controllo costi per lavoro",
  "feature.job_costing.summary":
    "Manodopera, materiali e spese a confronto con il prezzo preventivato, così sa quanto ha guadagnato davvero.",
  "feature.materials.name": "Materiali sul lavoro",
  "feature.materials.summary":
    "Che cosa è andato in cantiere, quanto è costato e che cosa resta da comprare.",
  "feature.job_photos.name": "Foto prima e dopo",
  "feature.job_photos.summary":
    "Foto archiviate sul lavoro, pronte da inserire nel preventivo, nella fattura o nel suo sito.",
  "feature.checklists.name": "Liste di controllo dei lavori",
  "feature.checklists.summary":
    "L'elenco di ciò che va fatto in cantiere, spuntato da chi lo esegue.",
  "feature.suggested_tasks.name": "Passi successivi suggeriti",
  "feature.suggested_tasks.summary":
    "Il lavoro propone le attività che un lavoro come questo di solito richiede, così non si dimentica nulla.",
  "feature.tasks.name": "Elenco delle cose da fare",
  "feature.tasks.summary":
    "Tutto ciò che va seguito, ordinato in base a quanto costerebbe lasciarlo lì.",
  "feature.work_areas.name": "Zone di lavoro",
  "feature.work_areas.summary":
    "Divida un lavoro grande in ambienti o zone e ne affidi ciascuna a una persona diversa.",
  "feature.time_clock.name": "Timbratura di entrata e uscita",
  "feature.time_clock.summary":
    "La squadra timbra sul lavoro che sta seguendo, da qualsiasi telefono abbia in tasca.",
  "feature.timesheets.name": "Fogli ore che approva Lei",
  "feature.timesheets.summary":
    "Le ore arrivano legate a lavori reali; Lei le approva prima che possano diventare retribuzione.",
  "feature.crew_inbox.name": "Posta della squadra",
  "feature.crew_inbox.summary":
    "La sua squadra manda foto e aggiornamenti per SMS a un unico numero e si archiviano da soli sul lavoro giusto.",
  "feature.time_off.name": "Ferie e permessi",
  "feature.time_off.summary":
    "Le richieste arrivano al responsabile giusto, i saldi maturano da soli e il calendario ne tiene conto.",
  "feature.invoices.name": "Fatture",
  "feature.invoices.summary":
    "Un preventivo approvato diventa una fattura identica al preventivo, perché nasce da lui.",
  "feature.invoice_send.name": "Invio della fattura",
  "feature.invoice_send.summary":
    "Inviata dal suo indirizzo con il PDF allegato e un link per pagare subito.",
  "feature.invoice_changes.name": "Fatture modificate, con storico",
  "feature.invoice_changes.summary":
    "Rettifichi una fattura già emessa e la precedente resta agli atti, così non ci sono mai dubbi su cosa era stato concordato.",
  "feature.card_payments.name": "Incassi con carta",
  "feature.card_payments.summary":
    "Il cliente paga dal telefono e il denaro va sul suo conto, non sul nostro.",
  "feature.stripe_connect.name": "Il suo conto di accredito",
  "feature.stripe_connect.summary":
    "Colleghi la sua banca una volta sola; ogni pagamento dei clienti vi confluisce direttamente.",
  "feature.financing.name": "Faccia pagare i clienti a rate",
  "feature.financing.summary":
    "Attivi il pagamento rateale al momento del pagamento per i lavori grossi che i clienti rimandano.",
  "feature.service_plans.name": "Piani di manutenzione",
  "feature.service_plans.summary":
    "Iscriva un cliente a un piano ricorrente e la carta viene addebitata secondo il calendario senza che Lei debba chiedere nulla.",
  "feature.client_portal.name": "Portale clienti",
  "feature.client_portal.summary":
    "Un unico link dove il cliente vede i suoi preventivi, le sue fatture e quanto deve ancora.",
  "feature.sales_tax.name": "Imposta corrispondente all'indirizzo",
  "feature.sales_tax.summary":
    "Imposti le sue aliquote una volta sola; sul documento finisce quella giusta per il luogo del lavoro.",
  "feature.dashboard.name": "Dashboard",
  "feature.dashboard.summary":
    "Che cosa è preventivato, vinto, pianificato e dovuto, su un'unica schermata, aggiornata a stamattina.",
  "feature.break_even.name": "Il suo prezzo di pareggio",
  "feature.break_even.summary":
    "Quanto deve incassare una giornata prima che Lei guadagni un centesimo, calcolato sulle sue spese generali reali.",
  "feature.benchmark.name": "Come si collocano i suoi prezzi",
  "feature.benchmark.summary":
    "Dove si collocano le sue tariffe e il suo tasso di successo rispetto ad altre imprese del suo mestiere — nessuno viene nominato, Lei compreso.",
  "feature.monthly_digest.name": "Resoconto mensile",
  "feature.monthly_digest.summary":
    "Una volta al mese, i suoi numeri spiegati a parole invece che con i grafici.",
  "feature.goals.name": "Obiettivo di fatturato",
  "feature.goals.summary":
    "Fissi un obiettivo per l'anno e veda quanto è avanti o indietro.",
  "feature.expenses.name": "Spese e costi generali",
  "feature.expenses.summary":
    "Registri quanto spende, distinguendo ciò che appartiene a un lavoro da ciò che appartiene all'impresa.",
  "feature.marketing_spend.name": "Quanto vale la sua pubblicità",
  "feature.marketing_spend.summary":
    "Registri quanto spende per canale — con importazione automatica da Meta Ads — e veda un costo medio per lead su tutto quello che fa per procurarsi lavoro.",
  "feature.marketing_spend.limits":
    "Il costo per lead è una media su tutti i canali, non è suddiviso per canale né per campagna — in FieldQuo nulla collega ancora un dollaro specifico di spesa a un lead specifico.",
  "feature.payroll.name": "Buste paga",
  "feature.payroll.summary":
    "Le ore approvate diventano un'elaborazione paghe con buste paga da consegnare o da esportare per il suo commercialista.",
  "feature.contractor_payouts.name": "Paghi i collaboratori dall'applicazione",
  "feature.contractor_payouts.summary":
    "Le ore approvate di una persona in organico registrata come collaboratore autonomo partono come bonifico reale sul suo conto.",
  "feature.price_book.name": "Il suo listino prezzi",
  "feature.price_book.summary":
    "I suoi servizi e le sue tariffe in un unico posto, importabili da un foglio di calcolo ed esportabili di nuovo.",
  "feature.material_costs.name": "Costi dei materiali e ricette",
  "feature.material_costs.summary":
    "Quanto le costa un litro di vernice o un pannello di compensato, e quanto ne consuma un lavoro di queste dimensioni.",
  "feature.team_access.name": "Ruoli e accessi del team",
  "feature.team_access.summary":
    "Decida, voce per voce, che cosa ogni persona può vedere e modificare — e vale sul server, non solo a schermo.",
  "feature.white_label.name": "Tutto porta il suo nome",
  "feature.white_label.summary":
    "Il suo logo e il suo colore su ogni preventivo, fattura, pagina ed email che un cliente vede.",
  "feature.own_email_domain.name": "Email dal suo indirizzo",
  "feature.own_email_domain.summary":
    "Verifichi il suo dominio una volta sola e tutto partirà da Lei, non da un indirizzo condiviso.",
  "feature.quote_email_wording.name": "Scriva Lei l'email di accompagnamento",
  "feature.quote_email_wording.summary":
    "Cambi che cosa dice l'email del preventivo, sezione per sezione, e resterà nella lingua in cui il preventivo è stato redatto.",
  "feature.document_layouts.name": "Il layout dei suoi preventivi e delle sue fatture",
  "feature.document_layouts.summary":
    "Scelga quali sezioni compaiono sul documento stampato, e quale layout è quello predefinito.",
  "feature.contract_terms.name": "Le sue condizioni su ogni documento",
  "feature.contract_terms.summary":
    "Condizioni di pagamento e testo contrattuale che si allegano da soli a quello che invia.",
  "feature.languages.name": "Inglese e francese",
  "feature.languages.summary":
    "Invii un preventivo nella lingua che il suo cliente parla; un documento firmato conserva le parole con cui è stato firmato.",
  "feature.ai_copilot.name": "Chieda a FieldQuo AI",
  "feature.ai_copilot.summary":
    "Faccia una domanda sulla sua impresa in parole semplici e ottenga la risposta dai suoi numeri.",
  "feature.activity_log.name": "Chi ha cambiato che cosa",
  "feature.activity_log.summary":
    "Un registro continuo di ogni invio, modifica e approvazione, con un nome e un orario accanto.",
  "feature.clients.name": "Anagrafica clienti",
  "feature.clients.summary":
    "Ogni cliente, i suoi immobili e il suo storico, importati da dove si trovano adesso.",
};

const MARKETING = Object.fromEntries(
  Object.entries({ en, fr, es, uk, pa, tl, de, zh, it }).map(([code, dict]) => [
    code,
    { ...dict, ...(FEATURE_PAGE_MESSAGES[code] || {}) },
  ]),
);

export const MESSAGES = Object.fromEntries(
  Object.keys(MARKETING).map((code) => [
    code,
    { ...MARKETING[code], ...(APP_MESSAGES[code] || {}) },
  ]),
);

// Every key that exists in English. Used by the coverage check in
// scripts/check-translations.mjs so a missing translation is a caught
// omission rather than something a customer discovers.
//
// Read off MARKETING.en, not the `en` literal above: the /features keys are
// merged in and have to be gated too. Reading the literal would have shipped
// 981 keys per language that no coverage check could see, which is exactly the
// shape of hole this catalogue exists to close.
export const MESSAGE_KEYS = Object.keys(MARKETING.en);

// English keys across BOTH catalogues. Kept separate from MESSAGE_KEYS because
// the coverage script gates a deploy on full marketing coverage in all six
// languages, and the app catalogue is deliberately English + French only — see
// appMessages.js. Holding them to the same bar would either block every deploy
// or force machine-translating 640 interface strings nobody has reviewed.
export const ALL_MESSAGE_KEYS = [...MESSAGE_KEYS, ...APP_MESSAGE_KEYS];
