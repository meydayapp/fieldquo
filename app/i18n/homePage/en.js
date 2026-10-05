// app/i18n/homePage/en.js
//
// The homepage's copy (app/(marketing)/page.js and
// app/components/marketing/home/*), English — the source of truth.
//
// Numbers that are FACTS are never typed into a sentence here: the trial
// length arrives as {days} from TRIAL_DAYS, the grace period as {grace} from
// GRACE_DAYS, languages as lists built from app/i18n/languages.js, prices and
// sale figures from the resolver. check:homepage-sections fails a key in this
// namespace that contains the trial length as a literal. The research shares
// are formatted by the component from app/components/marketing/home/research.js
// so they cannot drift from the report between languages.
//
// The trade examples (home.trades.*.scope) DO carry numbers: they are the
// illustrative job an estimate card describes, labelled "Example" on the page,
// not a rate card (non-negotiable #4) and not a claim.
export const HOME_PAGE_EN = {
  // ── Hero ──────────────────────────────────────────────────────────────────
  "home.hero.title": "Run your entire field service business from one place.",
  "home.hero.subtitle":
    "Quote jobs. Schedule your crew. Invoice customers. Get paid. Grow your business — without juggling five different apps.",
  "home.hero.ctaPrimary": "Start your free trial",
  "home.hero.ctaSecondary": "See how it works",
  "home.hero.flow": "From first call → to quote → to job → to payment.",
  "home.trial.days": "{days} days free",
  "home.trial.noCard": "no card needed",
  "home.trial.allFeatures": "every feature on every plan",

  // ── Sale pill (only while a universal promotion is live) ─────────────────
  "home.sale.fallbackName": "Sale",
  "home.sale.offYear": "{percent}% off 1-year plans",
  "home.sale.offPromoFirstMonth": "{percent}% off your first month",
  "home.sale.offPromoMonths": "{percent}% off your first {months} months",
  "home.sale.offBoth": "{percent}% off monthly and 1-year plans",
  "home.sale.ends": "ends {date}",
  "home.sale.seePricing": "See pricing",

  // ── Product demo (sample data, drawn in HTML) ────────────────────────────
  "home.demo.title": "Every job, from the first call to the last payment",
  "home.demo.subtitle":
    "The office sees the whole pipeline. The crew sees today's jobs on their phone. It is the same job in both places.",
  "home.demo.sample": "Sample data — these are not real customers.",
  "home.demo.figureLabel":
    "An illustration of FieldQuo with sample jobs moving from new lead to invoice paid",
  "home.demo.nav.pipeline": "Pipeline",
  "home.demo.nav.schedule": "Schedule",
  "home.demo.nav.clients": "Clients",
  "home.demo.nav.invoices": "Invoices",
  "home.demo.stage.lead": "New lead",
  "home.demo.stage.quote": "Quote sent",
  "home.demo.stage.job": "Job scheduled",
  "home.demo.stage.paid": "Invoice paid",
  "home.demo.lead.title": "Kitchen repaint",
  "home.demo.lead.meta": "Web form · 2 min ago",
  "home.demo.quote.title": "Deck staining",
  "home.demo.quote.meta": "Viewed by the client",
  "home.demo.job.title": "Fence repair",
  "home.demo.job.meta": "Thursday 9:00 · Crew A",
  "home.demo.paid.title": "Bathroom tiling",
  "home.demo.paid.meta": "Paid online by card",
  "home.demo.phone.today": "Today",
  "home.demo.phone.paidNote": "Invoice {number} paid",
  "home.demo.phone.nextJob": "Next job",
  "home.demo.phone.onMyWay": "On my way",
  "home.demo.phone.startJob": "Start job",

  // ── Results: promises, facts, and attributed research ────────────────────
  "home.results.promise.volume": "Handle more volume without adding headcount.",
  "home.results.promise.overhead":
    "Big-company systems without the big-company overhead.",
  "home.results.promise.techs": "Get more out of every tech in the field.",
  "home.results.title":
    "What contractors report after moving to one connected platform",
  "home.results.intro":
    "Industry research. Each figure is the share of surveyed contractors who reported the improvement — not the size of it.",
  "home.results.stat.volume":
    "say their office handles more volume without adding headcount",
  "home.results.stat.revenuePerTech": "report more revenue per tech",
  "home.results.stat.margins": "report better margins",
  "home.results.stat.growth": "report revenue growth",
  "home.results.stat.invoicing": "report faster invoicing",
  "home.results.stat.quoteTurnaround": "report faster quote turnaround",
  "home.results.stat.winRate": "report higher quote win rates",
  "home.results.stat.tools": "separate tools replaced, on average",
  "home.results.source":
    "Source: {report} ({count} commercial contractors, {date}).",
  "home.results.fact.onePlatform": "One platform instead of six apps",
  "home.results.fact.allFeatures": "Every feature on every plan",

  // ── How it works ─────────────────────────────────────────────────────────
  "home.how.title": "One job. One simple workflow.",
  "home.how.subtitle": "Six steps, one record, nothing typed twice.",
  "home.how.lead.title": "Get the lead",
  "home.how.lead.body":
    "Calls, web forms, your booking page and referrals land in one place.",
  "home.how.quote.title": "Send the quote",
  "home.how.quote.body":
    "Build it on site from your own prices and send it before you leave the driveway.",
  "home.how.schedule.title": "Schedule the job",
  "home.how.schedule.body":
    "The approved quote becomes a job. Put it on the calendar and assign the crew.",
  "home.how.work.title": "Do the work",
  "home.how.work.body":
    "Your crew clocks in, adds photos and works through the checklist from their phone.",
  "home.how.paid.title": "Get paid",
  "home.how.paid.body":
    "Invoice from the job and take payment online, straight to your own bank account.",
  "home.how.numbers.title": "Know your numbers",
  "home.how.numbers.body":
    "See what each job really earned against what you quoted.",

  // ── Built for your trade ─────────────────────────────────────────────────
  "home.trades.title": "Built for your trade",
  "home.trades.subtitle":
    "Pick your trade to see the kind of estimate you would send from FieldQuo.",
  "home.trades.pick": "Choose a trade",
  "home.trades.example": "Example",
  "home.trades.estimate": "Estimate",
  "home.trades.send": "Send quote",
  "home.trades.note":
    "Illustrative figures, not a price list — in FieldQuo you set your own prices.",
  "home.trades.more": "More about FieldQuo for this trade",
  "home.trades.painting.job": "Interior painting",
  "home.trades.painting.scope": "3 rooms · 1,450 sq ft",
  "home.trades.roofing.job": "Shingle roof replacement",
  "home.trades.roofing.scope": "24 squares · tear-off and haul-away",
  "home.trades.cleaning.job": "Move-out deep clean",
  "home.trades.cleaning.scope": "3 bedrooms, 2 bathrooms · 1,800 sq ft",
  "home.trades.landscaping.job": "Backyard refresh",
  "home.trades.landscaping.scope": "600 sq ft of new sod · 3 garden beds",
  "home.trades.electrical.job": "Electrical panel upgrade",
  "home.trades.electrical.scope": "100 A to 200 A · permit included",
  "home.trades.plumbing.job": "Water heater replacement",
  "home.trades.plumbing.scope": "50-gallon gas tank · old unit removed",
  "home.trades.handyman.job": "Handyman punch list",
  "home.trades.handyman.scope": "8 small repairs · about 6 hours",
  "home.trades.construction-contracting.job": "Basement finishing",
  "home.trades.construction-contracting.scope":
    "750 sq ft · framing through paint",

  // ── What FieldQuo helps you do ───────────────────────────────────────────
  "home.outcomes.title": "What FieldQuo helps you do",
  "home.outcomes.subtitle":
    "Everything in one system, grouped by what it gets done.",
  "home.outcomes.win": "Win more work",
  "home.outcomes.run": "Run every job",
  "home.outcomes.paid": "Get paid",
  "home.outcomes.grow": "Grow smarter",
  "home.outcomes.item.leads": "Leads",
  "home.outcomes.item.quotes": "Quotes",
  "home.outcomes.item.booking": "Online booking",
  "home.outcomes.item.followUps": "Follow-ups",
  "home.outcomes.item.website": "Website",
  "home.outcomes.item.marketing": "Marketing",
  "home.outcomes.item.scheduling": "Scheduling",
  "home.outcomes.item.dispatch": "Dispatch",
  "home.outcomes.item.crew": "Crew",
  "home.outcomes.item.timesheets": "Timesheets",
  "home.outcomes.item.photos": "Photos",
  "home.outcomes.item.tracking": "Job tracking",
  "home.outcomes.item.invoices": "Invoices",
  "home.outcomes.item.payments": "Payments",
  "home.outcomes.item.deposits": "Deposits",
  "home.outcomes.item.expenses": "Expenses",
  "home.outcomes.item.payroll": "Payroll",
  "home.outcomes.item.analytics": "Analytics",
  "home.outcomes.item.ai": "AI insights",
  "home.outcomes.item.conversion": "Conversion data",
  "home.outcomes.item.profitability": "Profitability",
  "home.outcomes.allFeatures": "See every feature",

  // ── FieldQuo AI ──────────────────────────────────────────────────────────
  "home.ai.badge": "FieldQuo AI",
  "home.ai.title": "Ask your business anything.",
  "home.ai.body":
    "Ask in plain words and get an answer from your own quotes, jobs, invoices and expenses. It answers about your company's data only — never another company's.",
  "home.ai.q.profitable": "Which jobs were most profitable this month?",
  "home.ai.q.followUp": "Which quotes haven't been followed up?",
  "home.ai.q.materials": "How much did we spend on materials?",
  "home.ai.q.owed": "Which customers still owe us money?",
  "home.ai.examples": "Example questions",
  "home.ai.cta": "How FieldQuo AI works",

  // ── Why FieldQuo ─────────────────────────────────────────────────────────
  "home.why.title": "Stop running your business across five different apps.",
  "home.why.body":
    "Every separate tool keeps its own copy of your customer, and you are the one who keeps them in step. FieldQuo keeps one.",
  "home.why.before": "Separate tools",
  "home.why.tool.crm": "CRM",
  "home.why.tool.quotes": "Quotes",
  "home.why.tool.scheduling": "Scheduling",
  "home.why.tool.invoicing": "Invoicing",
  "home.why.tool.payments": "Payments",
  "home.why.tool.team": "Team",
  "home.why.tool.website": "Website",
  "home.why.tool.ai": "AI",
  "home.why.one.system": "One system",
  "home.why.one.record": "One customer record",
  "home.why.one.workflow": "One workflow",

  // ── Pricing ──────────────────────────────────────────────────────────────
  "home.pricing.title": "Every feature. Every plan.",
  "home.pricing.question": "How many people run your business?",
  "home.pricing.body":
    "Plans differ only by how many people use them. Nothing is locked behind a bigger plan.",
  "home.pricing.audience.solo": "Just me",
  "home.pricing.audience.crew": "Small team",
  "home.pricing.audience.shop": "Growing",
  "home.pricing.audience.scale": "Larger",
  "home.pricing.compare": "Compare plans",

  // ── FAQ (every answer checked against the code the day it was written) ──
  "home.faq.trial.q": "How long is the free trial?",
  "home.faq.trial.a":
    "{days} days, with every feature switched on — long enough to send real quotes to real clients.",
  "home.faq.card.q": "Do I need a credit card to start?",
  "home.faq.card.aNoCard":
    "No. Sign up without one. When you are ready, choose a plan and add a card in Account & Billing. If the trial ends without a plan, your account turns read-only for {grace} days and then locks — nothing is deleted.",
  "home.faq.card.aCard":
    "Yes — a card is taken when you sign up, and nothing is charged until the {days}-day trial ends.",
  "home.faq.cancel.q": "Can I cancel anytime?",
  "home.faq.cancel.a":
    "Yes, from Account & Billing. A paid plan keeps working until the end of the period it covers — a month, or a year on the 1-year commitment — and nothing more is charged.",
  "home.faq.switch.q": "I already use another tool. Can I bring my data?",
  "home.faq.switch.a":
    "Yes. Clients, your products and prices, and past jobs each have a spreadsheet (CSV) import, so you start with your history in place.",
  "home.faq.migration.q": "Can you move my data for me?",
  "home.faq.migration.a":
    "Yes, as a paid service. Request it in Settings → Data Migration and send us your old system's export. We quote a price; once you have accepted and paid it, our team adds your clients and quotes to your account. We only add records — we never change or delete anything already there.",
  "home.faq.languages.q": "Which languages does FieldQuo work in?",
  "home.faq.languages.a":
    "Emails to your clients can go out in any of these languages: {emailLanguages}. Every quote keeps the language it was written in. App screens fully translated today: {appLanguages}; the other languages are still being reviewed.",
  "home.faq.devices.q": "Does it work on my phone?",
  "home.faq.devices.a":
    "Yes. FieldQuo runs in the browser on a phone, tablet or computer — there is nothing to install. On a phone you can add it to your home screen like an app.",

  // ── Final ask ────────────────────────────────────────────────────────────
  "home.final.title": "Your next job can run through FieldQuo.",
  "home.final.body": "From the first call to the final payment.",
};
