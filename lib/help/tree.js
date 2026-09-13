// lib/help/tree.js
//
// The spine of the public help centre (help.fieldquo.com, also served at
// www.fieldquo.com/help): every category, every article slug, and the
// language-INDEPENDENT facts about each article — which sidebar screen it is
// about, whether it is something only FieldQuo has, what it links to.
//
// ── Why the words are not here ─────────────────────────────────────────────
//
// Titles, summaries and bodies live in content/help/<lang>/<category>.js, one
// module per category per language, so a translator is handed sentences and
// never structure. This file is what those modules are checked AGAINST:
// scripts/check-help-centre.mjs refuses a language module that is missing a
// slug listed here, or carries one that is not, so English, French and
// Spanish can never drift apart on what exists — only on how it is said.
//
// URL shape (fixed, owner 2026-09-12): /help/{lang}/{category}/{article}.
// A slug is the URL forever; renaming one is a redirect, not an edit.
//
// ── `screen` ties an article to a sidebar row ──────────────────────────────
//
// The value is the row's slug in docs/screens/app-guide/harness/screens.js,
// the same key AdminSidebar / SettingsSidebar carry as `helpArticle`. That is
// what lets /app/help say "the guide for the screen you are on" without a
// second list of screens somewhere that would rot.
//
// ── `only` is a claim, so it is checked ────────────────────────────────────
//
// `only: true` puts the article in the "Only in FieldQuo" cross-listing. It
// may be set only on an article whose `feature` key exists in
// lib/marketing/featureMatrix.js or lib/features/registry.js — the two
// proof-carrying inventories — or that carries `proof`, a list of files in
// this repo that ARE the feature (the matrix's own convention), for the four
// screens the matrix never listed: Safety, Client equipment, Vehicles and
// Purchasing. The check executes both. "Only in
// FieldQuo" is decided the way /compare decides it: the capability is not
// listed on the competitor's pricing page at any tier (lib/marketing/parity.js
// neverListed), never by assertion.
//
// ── Virtual categories ─────────────────────────────────────────────────────
//
// `only-in-fieldquo` and `videos` own no articles. They list articles that
// live elsewhere (flagged `only`, or carrying a video in
// content/help/videos.json). An article's canonical URL is always its home
// category, so a cross-listed page is one page, not two.

export const HELP_LANGS = Object.freeze(["en", "fr", "es"]);

// Every category, in the order the sidebar and the home page show them.
// `virtual` categories are cross-listings (see above).
export const HELP_CATEGORIES = Object.freeze([
  { key: "getting-started", icon: "Rocket" },
  { key: "leads-and-quotes", icon: "FileText" },
  { key: "jobs-and-scheduling", icon: "Calendar" },
  { key: "invoices-and-payments", icon: "Receipt" },
  { key: "clients", icon: "Users" },
  { key: "team-and-access", icon: "UserCog" },
  { key: "marketing-and-website", icon: "Megaphone" },
  { key: "messages", icon: "MessageCircle" },
  { key: "mobile-and-crew", icon: "Smartphone" },
  { key: "reports-and-insights", icon: "Gauge" },
  { key: "settings", icon: "Settings" },
  { key: "billing-and-subscription", icon: "CreditCard" },
  { key: "what-your-clients-see", icon: "Eye" },
  { key: "integrations", icon: "Plug" },
  { key: "only-in-fieldquo", icon: "Sparkles", virtual: "only" },
  { key: "videos", icon: "PlayCircle", virtual: "video" },
]);

export const CATEGORY_KEYS = Object.freeze(HELP_CATEGORIES.map((c) => c.key));
export const REAL_CATEGORY_KEYS = Object.freeze(
  HELP_CATEGORIES.filter((c) => !c.virtual).map((c) => c.key),
);

// One line per article. `title` is the English WORKING title used by
// content/help/TREE.md (the owner's coverage review) and as the fallback the
// day a language module has not landed; the shipped title is the content
// module's. `feature` names the featureMatrix / registry key the article is
// about, which is how check:help-centre proves every registered feature has a
// page. `related` lists slugs shown under "Related articles" (in addition to
// the category's neighbours).
const A = (slug, title, meta = {}) => Object.freeze({ slug, title, ...meta });

export const HELP_TREE = Object.freeze({
  "getting-started": [
    A("what-fieldquo-is", "What FieldQuo is, and the pipeline it runs", { feature: "white_label" }),
    A("start-your-free-trial", "Start your free trial", { related: ["your-plan-and-seats", "free-first-month"] }),
    A("your-first-day-setup-checklist", "Your first day: the setup checklist", { related: ["settings-company", "settings-branding", "connect-stripe-and-get-verified"] }),
    A("the-sidebar-and-where-everything-is", "The sidebar, and where everything is", { screen: "home" }),
    A("the-dashboard", "The dashboard: what is waiting on you", { screen: "home", feature: "dashboard" }),
    A("company-settings-basics", "Company settings basics", { screen: "settings-company" }),
    A("set-up-your-branding", "Set up your branding", { screen: "settings-branding", feature: "white_label" }),
    A("choose-your-language", "Choose your language, and your company's", { screen: "settings-language", feature: "languages" }),
    A("import-clients-from-a-csv", "Import clients from a CSV", { screen: "clients", feature: "clients" }),
    A("import-past-jobs", "Import past jobs from your old system", { screen: "jobs" }),
    // No quote importer exists beyond the subcontractor one (its own slug);
    // this is the honest list of the ways a quote made elsewhere gets in.
    A("import-a-quote-from-another-system", "Bringing quotes made elsewhere into FieldQuo", { screen: "quotes" }),
    A("the-data-migration-service", "The data migration service", { screen: "settings-migration" }),
    A("how-fieldquo-works-for-owners-and-admins", "How FieldQuo works for owners and administrators", { feature: "team_access" }),
    A("how-fieldquo-works-for-dispatchers", "How FieldQuo works for dispatchers and managers", { feature: "team_access" }),
    A("how-fieldquo-works-for-estimators", "How FieldQuo works for estimators and salespeople", { feature: "team_access" }),
    A("how-fieldquo-works-for-crew", "How FieldQuo works for crew", { feature: "crew_shifts" }),
    A("fieldquo-ai-ask-about-your-business", "FieldQuo AI: ask about your own business", { screen: "ai", feature: "ai_copilot", only: true }),
    A("replay-the-setup-walkthrough", "Replay the setup walkthrough", { screen: "help" }),
    A("how-to-get-help", "How to get help", { screen: "help" }),
    A("troubleshooting", "Troubleshooting: the five things that go wrong first"),
    A("faq", "Frequently asked questions"),
    A("glossary", "Glossary"),
    A("what-your-clients-get", "What your clients get out of it", { feature: "client_portal" }),
  ],

  "leads-and-quotes": [
    A("the-leads-board", "The Leads board", { screen: "requests", feature: "leads" }),
    A("lead-scoring-hot-warm-cold", "Lead scoring: Hot, Warm, Cold", { feature: "leads" }),
    A("where-leads-come-from", "Where leads come from", { feature: "lead_form" }),
    A("the-lead-form-on-your-website", "The lead form on your website", { screen: "settings-lead-form", feature: "lead_form" }),
    A("facebook-lead-forms", "Facebook lead forms", { screen: "settings-meta-ads", feature: "marketing_spend", proof: ["lib/meta/leadsImport.js"] }),
    A("import-leads", "Import leads", { screen: "requests" }),
    A("convert-a-lead-to-a-quote", "Convert a lead to a quote", { feature: "leads" }),
    A("the-quotes-list", "The Quotes list", { screen: "quotes", feature: "quotes" }),
    A("build-a-quote", "Build a quote", { feature: "quotes", related: ["send-a-quote", "settings-products"] }),
    A("quote-types-and-takeoffs", "Quote types and takeoffs", { screen: "settings-services", feature: "quotes" }),
    A("lines-from-your-price-book", "Lines from your price book", { screen: "settings-products", feature: "price_book" }),
    A("group-a-quote-by-room-or-scope", "Group a quote by room or scope", { feature: "quotes" }),
    A("photos-on-a-quote", "Photos on a quote", { feature: "quotes" }),
    A("ai-quote-review", "AI quote review", { feature: "ai_quote_review", only: true }),
    A("the-ai-deep-photo-read", "The AI deep photo read", { feature: "ai_vision", only: true }),
    A("upsell-add-ons", "Upsell add-ons the client can accept", { feature: "add_on_upsell", only: true }),
    A("good-better-best-options", "Good, better, best options", { feature: "priced_options" }),
    A("cost-and-margin-on-a-quote", "Cost and margin on a quote", { screen: "settings-material-costs", feature: "material_costs" }),
    A("the-break-even-price", "The break-even price", { screen: "settings-overhead", feature: "break_even", only: true }),
    A("send-a-quote", "Send a quote", { feature: "quote_send", related: ["the-quote-email", "the-quote-approval-page"] }),
    A("the-quote-pdf", "The quote PDF", { screen: "settings-pdf-templates", feature: "quote_pdf" }),
    A("quote-statuses-and-what-they-mean", "Quote statuses, and what each one means", { feature: "quotes" }),
    A("quote-validity-and-expiry", "How long a quote stays valid", { feature: "quotes" }),
    A("quote-language", "A quote keeps its language", { feature: "languages" }),
    A("online-approval-and-signature", "Online approval and signature", { feature: "online_approval" }),
    A("deposits-on-quotes", "Deposits on quotes", { feature: "booking_deposit", related: ["deposits-and-payment-schedules"] }),
    A("edit-a-sent-quote", "Edit a quote that was already sent", { feature: "quotes" }),
    A("convert-a-quote-to-a-job", "What happens when a quote is approved", { feature: "jobs" }),
    A("quotes-sent-with-no-response", "Quotes sent with no response", { feature: "follow_ups" }),
    A("estimate-reviews", "Estimate Reviews: approve instant estimates", { screen: "estimate-reviews", feature: "instant_quotes", only: true }),
    A("instant-quotes-on-your-website", "Instant quotes on your website", { screen: "settings-instant-quotes", feature: "instant_quotes", only: true }),
    A("the-self-quote-form", "The self-quote form", { feature: "self_quote", only: true }),
    A("aerial-roof-measurement", "Roof measurement from the air", { feature: "aerial_measure", only: true }),
    A("the-kitchen-designer", "The kitchen designer", { screen: "settings-cabinet-rates", feature: "kitchen_designer", only: true }),
    A("call-to-quote", "From a phone call to a draft quote", { screen: "receptionist", feature: "call_to_quote", only: true }),
    A("import-a-subcontractor-quote", "Import a subcontractor's quote", { feature: "subcontractor_bids" }),
    A("references-and-photos-in-the-quote-email", "References and before-and-after photos in the quote email", { screen: "settings-quote-email", feature: "quote_email_wording" }),
    A("scope-of-work-and-terms", "Scope of work and payment terms on every quote", { screen: "settings-company", feature: "contract_terms" }),
    A("the-large-quote-alert", "The large-quote alert", { screen: "settings-notifications" }),
  ],

  "jobs-and-scheduling": [
    A("the-jobs-list", "The Jobs list", { screen: "jobs", feature: "jobs" }),
    A("create-a-job", "Create a job", { feature: "jobs" }),
    A("the-job-page", "The job page", { feature: "jobs" }),
    A("visits-and-appointments", "Visits and appointments", { screen: "calendar", feature: "scheduling" }),
    A("the-appointments-calendar", "The Appointments calendar", { screen: "calendar", feature: "scheduling" }),
    A("book-a-visit-for-a-client", "Book a visit for a client", { feature: "scheduling" }),
    A("arrival-windows-and-travel-buffer", "Arrival windows and travel buffer", { screen: "settings-booking-page", feature: "booking_page" }),
    A("appointment-reminders", "Appointment reminders", { screen: "settings-notifications", feature: "appointment_reminders" }),
    A("the-on-my-way-text", "The “On my way” text", { screen: "settings-messages", feature: "appointment_reminders" }),
    A("clients-rescheduling-and-cancelling", "When a client reschedules or cancels", { feature: "client_reschedule" }),
    A("recurring-jobs", "Recurring jobs", { feature: "recurring_jobs" }),
    A("tasks", "Tasks", { screen: "tasks", feature: "tasks" }),
    A("suggested-tasks", "Suggested tasks", { feature: "suggested_tasks" }),
    A("checklists-on-site", "Checklists on site", { screen: "settings-checklists", feature: "checklists" }),
    A("job-photos-and-tags", "Job photos and tags", { screen: "settings-job-photo-tags", feature: "job_photos" }),
    A("job-notes", "Notes on a job", { feature: "jobs" }),
    A("work-areas", "Work areas", { screen: "settings-work-areas", feature: "work_areas" }),
    A("the-scheduler-and-crew-shifts", "The Scheduler: draft and publish the crew's week", { screen: "scheduler", feature: "crew_shifts" }),
    A("the-team-schedule", "The Team Schedule", { screen: "team-schedule", feature: "scheduling" }),
    A("the-time-clock", "The time clock", { screen: "clock", feature: "time_clock" }),
    A("timesheets-and-approving-hours", "Timesheets: review and approve hours", { screen: "timesheets", feature: "timesheets" }),
    A("time-off-requests", "Time off requests", { screen: "time-off", feature: "time_off" }),
    A("safety-incidents", "Safety incidents and near-misses", { screen: "safety", only: true, proof: ["app/app/safety/page.js", "app/api/safety-incidents/route.js"] }),
    // Not `only`: every tracked competitor lists job costing on its pricing
    // page (lib/marketing/tierFeatures), so the claim would not survive parity.
    A("job-costing", "Job costing: quoted against actual", { feature: "job_costing" }),
    A("materials-on-a-job", "Materials on a job", { feature: "materials" }),
    A("cancel-or-archive-a-job", "Cancel or archive a job", { feature: "jobs" }),
    A("when-a-job-is-completed", "When a job is completed", { feature: "review_requests" }),
    A("a-chat-room-for-every-job", "A chat room for every job", { screen: "chat", feature: "team_chat", only: true }),
    // The flag lives on Calendar appointments only; a job visit hard-codes
    // requiresSupervisor false (lib/booking). Titled accordingly.
    A("supervisor-required-visits", "Appointments that need a supervisor", { feature: "scheduling" }),
  ],

  "invoices-and-payments": [
    A("the-invoices-list", "The Invoices list", { screen: "invoices", feature: "invoices" }),
    A("create-an-invoice", "Create an invoice", { feature: "invoices" }),
    A("invoices-mirror-quotes", "Invoices mirror quotes", { feature: "invoices" }),
    A("send-an-invoice", "Send an invoice", { feature: "invoice_send", related: ["the-invoice-email-and-pay-page"] }),
    A("edit-an-invoice-after-sending", "Edit an invoice after it was sent", { feature: "invoice_changes" }),
    A("record-a-manual-payment", "Record a cash, cheque or e-transfer payment", { feature: "invoices" }),
    A("how-clients-pay-online", "How clients pay online", { feature: "card_payments" }),
    A("connect-stripe-and-get-verified", "Connecting Stripe and getting verified", { screen: "settings-payments", feature: "stripe_connect" }),
    A("what-stripe-asks-for-and-why", "What Stripe asks for, and why", { feature: "stripe_connect" }),
    A("payment-processing-fees-and-payouts", "Payment processing fees and payouts", { screen: "settings-payments", feature: "card_payments", related: ["instant-payouts", "refunds", "disputes-and-chargebacks", "the-accounting-export"] }),
    A("bank-debit-in-canada", "Bank debit in Canada: 1% capped at $5", { feature: "service_plans", only: true }),
    A("instant-payouts", "Instant payouts", { feature: "card_payments" }),
    A("payouts-held-or-under-review", "Payouts held or under review", { feature: "stripe_connect" }),
    A("refunds", "Refunds", { feature: "card_payments" }),
    A("disputes-and-chargebacks", "Disputes and chargebacks", { feature: "card_payments" }),
    // lib/paymentSchedule has no matrix key of its own (booking_deposit is the
    // visit fee); the proof is the engine that bills the stages.
    A("deposits-and-payment-schedules", "Deposits and payment schedules", { screen: "settings-company", feature: "invoices", proof: ["lib/paymentSchedule/engine.js"] }),
    A("progress-payments-by-stage", "Progress payments: how each stage is requested", { feature: "invoices", proof: ["lib/paymentSchedule/run.js"] }),
    A("invoice-reminders-and-chasing", "Invoice reminders and chasing", { screen: "settings-follow-ups", feature: "follow_ups" }),
    A("payment-terms", "Payment terms", { screen: "settings-company", feature: "contract_terms" }),
    A("sales-tax-on-invoices", "Sales tax on invoices", { screen: "settings-company", feature: "sales_tax" }),
    A("pay-over-time-financing", "Pay-over-time financing", { feature: "financing" }),
    A("service-plans", "Service plans (recurring billing)", { screen: "plans", feature: "service_plans", only: true }),
    A("service-plan-bank-debit-mandates", "Service plans paid by bank debit: the mandate", { feature: "service_plans", only: true }),
    A("the-client-portal", "The client portal", { feature: "client_portal" }),
    A("the-accounting-export", "The accounting export (CSV for QuickBooks, Xero or your bookkeeper)", { screen: "expenses", feature: "expenses" }),
    A("booking-fees-and-visit-deposits", "Booking fees and visit deposits", { screen: "settings-booking-page", feature: "booking_deposit" }),
    A("money-owed-and-receivables-aging", "Money owed and receivables aging", { screen: "home", feature: "dashboard" }),
  ],

  clients: [
    A("the-clients-list", "The Clients list", { screen: "clients", feature: "clients" }),
    A("add-a-client", "Add a client", { feature: "clients" }),
    A("the-client-record", "The client record", { feature: "clients" }),
    A("business-clients-and-contacts", "Business clients and their contact person", { feature: "clients" }),
    A("client-notes", "Client notes", { feature: "clients" }),
    A("a-clients-language", "A client's language", { feature: "languages" }),
    A("client-equipment-and-warranties", "Client equipment and warranties", { screen: "client-equipment", only: true, proof: ["app/app/equipment/page.js"] }),
    A("client-consent-and-unsubscribes", "Client consent and unsubscribes", { feature: "review_requests" }),
    A("review-requests", "Review requests after a job", { screen: "settings-reviews", feature: "review_requests" }),
    A("testimonials-on-your-website", "Testimonials on your website", { screen: "settings-reviews", feature: "testimonials" }),
    // Kept on purpose as an HONEST page: there is no homeowner referral
    // programme (Client.ReferralLink is read by nothing; /refer/[code] is
    // contractor-to-contractor). The article says what does not exist and
    // points at Refer & Earn — a reader searching "referral" deserves the
    // answer, not a 404. No `feature`: it describes an absence.
    A("referrals-from-clients", "Referrals from clients: what FieldQuo does and does not do", { related: ["refer-another-business"] }),
    A("duplicate-clients", "Duplicate clients", { feature: "clients" }),
  ],

  "team-and-access": [
    A("manage-team", "Manage Team", { screen: "team", feature: "team_access" }),
    A("invite-a-team-member", "Invite a team member", { feature: "team_access" }),
    A("access-levels-overview", "Access levels: who sees what", { feature: "team_access" }),
    A("role-crew", "The Crew level", { feature: "team_access" }),
    A("role-estimator", "The Estimator level", { feature: "team_access" }),
    A("role-dispatcher", "The Dispatcher level", { feature: "team_access" }),
    A("role-manager", "The Manager level", { feature: "team_access" }),
    A("administrators", "Administrators", { feature: "team_access" }),
    A("the-custom-access-editor", "The Custom access editor", { feature: "team_access" }),
    A("seats-and-crew-logins", "Seats and crew logins", { feature: "team_access" }),
    A("deactivate-a-team-member", "Deactivate a team member", { feature: "team_access" }),
    A("working-hours-and-bookable-hours", "Working hours and bookable hours", { screen: "settings-availability", feature: "booking_page" }),
    A("time-off-policies", "Time off policies", { screen: "settings-leave", feature: "time_off" }),
    A("payroll-runs", "Payroll runs", { screen: "payroll", feature: "payroll", only: true }),
    A("payroll-settings", "Payroll settings", { screen: "settings-payroll", feature: "payroll" }),
    A("payslips", "Payslips", { feature: "payroll" }),
    A("subcontractors-and-insurance", "Subcontractors and their insurance", { screen: "subcontractors", feature: "contractor_payouts" }),
    A("the-t5018-year-end-list", "The T5018 year-end list", { screen: "subcontractors", feature: "contractor_payouts" }),
    A("vehicles-and-fleet", "Vehicles and fleet", { screen: "fleet", only: true, proof: ["app/app/fleet/page.js"] }),
    A("purchasing-orders-stock-and-suppliers", "Purchasing: orders, stock and suppliers", { screen: "purchasing", only: true, proof: ["app/app/purchasing/page.js"] }),
    A("the-activity-log", "The Activity Log", { screen: "settings-activity", feature: "activity_log" }),
  ],

  "marketing-and-website": [
    A("the-website-builder", "The website builder", { screen: "settings-website", feature: "website_builder", only: true }),
    A("website-pages-and-blocks", "Website pages and blocks", { feature: "website_builder" }),
    // Site.subdomain only — there is no custom-domain code; the article says so.
    A("your-website-address", "Your website address", { feature: "website_builder" }),
    A("the-site-by-fieldquo-footer", "The “Site by FieldQuo” footer", { feature: "white_label" }),
    A("share-your-links", "Share your links", { screen: "settings-lead-form", feature: "embeds" }),
    A("embed-booking-and-quote-forms", "Embed booking and quote forms on any site", { feature: "embeds" }),
    A("the-bio-link", "The bio link", { screen: "settings-bio-link", feature: "bio_link" }),
    A("funnels", "Lead funnels", { screen: "funnels", feature: "funnels", only: true }),
    A("build-a-funnel", "Build a funnel and read its drop-off", { feature: "funnels" }),
    A("marketing-campaigns", "Marketing campaigns", { screen: "marketing", feature: "marketing_campaigns" }),
    A("pamphlet-routes", "Pamphlet and door-hanger routes", { feature: "door_hanger_routes", only: true }),
    A("email-campaigns-and-subscribers", "Email campaigns and subscribers", { feature: "email_campaigns" }),
    A("marketing-spend", "Marketing spend", { feature: "marketing_spend" }),
    A("the-marketing-designer", "The Marketing Designer", { screen: "marketing-designer", feature: "marketing_designer", only: true }),
    A("make-a-post-from-a-job", "Make a post from a job", { feature: "marketing_designer" }),
    A("social-posting-and-scheduling", "Post to Facebook and Instagram, now or later", { feature: "page_messaging" }),
    A("connect-meta-ads", "Connect your Meta ad account", { screen: "settings-meta-ads", feature: "marketing_spend" }),
    A("ask-for-reviews-automatically", "Ask for reviews automatically", { screen: "settings-reviews", feature: "review_requests" }),
    A("refer-another-business", "Refer another business, earn a free month", { screen: "refer", feature: "referrals" }),
    A("instant-estimates-as-marketing", "The instant estimate as a lead magnet", { feature: "instant_quotes" }),
  ],

  messages: [
    A("the-messages-inbox", "The Messages inbox", { screen: "messages", feature: "page_messaging", only: true }),
    A("connect-your-facebook-page-and-instagram", "Connecting your Facebook Page and Instagram", { screen: "settings-meta-ads", feature: "page_messaging" }),
    A("whatsapp-business", "WhatsApp Business messages", { feature: "whatsapp_messaging", only: true }),
    A("conversation-status-and-who-looks-after-it", "Conversation status and who is looking after it", { feature: "page_messaging" }),
    A("private-notes-and-temperature", "Private notes and the temperature chip", { feature: "page_messaging" }),
    A("the-ai-employee", "The AI employee: drafts you approve", { screen: "settings-ai-employee", feature: "ai_employee", only: true }),
    A("the-monthly-review", "The monthly review of your inbox", { feature: "page_messaging" }),
    A("client-texts-on-my-way-and-reminders", "The two texts your clients get", { screen: "settings-messages", feature: "appointment_reminders" }),
    A("email-templates", "Email templates", { screen: "settings-email-templates", feature: "quote_email_wording" }),
    A("follow-up-rules", "Follow-up rules", { screen: "settings-follow-ups", feature: "follow_ups" }),
    A("notifications-for-you", "Notifications for you: email and browser", { screen: "settings-notifications" }),
    A("send-from-your-own-domain", "Send email from your own domain", { screen: "settings-email-domain", feature: "own_email_domain" }),
    A("the-phone-receptionist", "The phone receptionist", { screen: "settings-voice", feature: "voice_receptionist", only: true }),
    A("the-receptionist-call-log", "The receptionist's call log", { screen: "receptionist", feature: "voice_receptionist" }),
    A("quote-callbacks", "Quote callbacks", { feature: "voice_callbacks", only: true }),
    A("the-crew-inbox", "The crew inbox: photos and updates by text", { screen: "crew-inbox", feature: "crew_inbox", only: true }),
    A("team-chat", "Team chat", { screen: "chat", feature: "team_chat", only: true }),
    A("texting-clients-what-is-and-is-not-automated", "Texting clients: what is automated and what is not", { feature: "appointment_reminders" }),
  ],

  "mobile-and-crew": [
    A("using-fieldquo-on-your-phone", "Using FieldQuo on your phone", { feature: "time_clock" }),
    A("install-it-like-an-app", "Install it like an app", { feature: "time_clock" }),
    A("the-crew-tab-bar", "The crew tab bar", { feature: "crew_shifts" }),
    A("what-a-crew-member-sees", "What a crew member sees", { feature: "team_access" }),
    A("clock-in-and-out-on-your-phone", "Clock in and out on your phone", { screen: "clock", feature: "time_clock" }),
    A("your-schedule-on-your-phone", "Your schedule on your phone", { feature: "crew_shifts" }),
    A("photos-from-the-field", "Photos from the field", { feature: "job_photos" }),
    A("text-a-photo-to-the-crew-inbox", "Text a photo in without an app", { screen: "crew-inbox", feature: "crew_inbox" }),
    A("chat-on-your-phone", "Chat on your phone", { screen: "chat", feature: "team_chat" }),
    A("time-off-on-your-phone", "Ask for time off from your phone", { screen: "time-off", feature: "time_off" }),
    A("report-a-safety-incident", "Report a safety incident", { screen: "safety", proof: ["app/app/safety/page.js"] }),
    A("push-notifications", "Push notifications", { feature: "appointment_reminders" }),
    A("bad-connections-and-offline", "Bad connections, and why there is no offline mode", { feature: "time_clock" }),
  ],

  "reports-and-insights": [
    A("the-dashboard-in-detail", "The dashboard in detail", { screen: "home", feature: "dashboard" }),
    A("the-revenue-goal", "The revenue goal", { screen: "home", feature: "goals" }),
    A("how-you-compare", "How You Compare: your prices against the platform", { screen: "insights", feature: "benchmark", only: true }),
    A("the-kpi-dashboard", "The KPI dashboard", { screen: "kpis", feature: "kpi_dashboard", only: true }),
    A("kpi-sales", "KPIs: Sales", { screen: "kpis", feature: "kpi_dashboard" }),
    A("kpi-money-flow", "KPIs: Money flow", { screen: "kpis", feature: "kpi_dashboard" }),
    A("kpi-business-costs", "KPIs: Business costs", { screen: "kpis", feature: "kpi_dashboard" }),
    A("kpi-profit", "KPIs: Profit", { screen: "kpis", feature: "kpi_dashboard" }),
    A("kpi-execution", "KPIs: Execution", { screen: "kpis", feature: "kpi_dashboard" }),
    A("kpi-quality", "KPIs: Quality", { screen: "kpis", feature: "kpi_dashboard" }),
    A("kpi-cash", "KPIs: Cash", { screen: "kpis", feature: "kpi_dashboard" }),
    A("kpi-customer", "KPIs: Customer", { screen: "kpis", feature: "kpi_dashboard" }),
    A("the-metrics-fieldquo-refuses-to-invent", "The metrics FieldQuo refuses to invent", { screen: "kpis", feature: "kpi_dashboard" }),
    A("weekly-digests", "Weekly digests", { feature: "dashboard" }),
    A("the-monthly-digest-email", "The monthly digest email", { feature: "monthly_digest" }),
    A("financial-statements", "Financial statements", { feature: "dashboard" }),
    A("won-and-lost", "Won and lost", { feature: "dashboard" }),
    A("estimate-accuracy", "Estimate accuracy", { feature: "job_costing" }),
    A("expense-tracking-and-burn-rate", "Expense tracking and your burn rate", { screen: "expenses", feature: "expenses" }),
    A("import-expenses-from-a-bank-csv", "Import expenses from a bank CSV", { screen: "expenses", feature: "expenses" }),
    A("overhead-and-your-minimum-price", "Overhead and your minimum price", { screen: "settings-overhead", feature: "break_even" }),
  ],

  settings: [
    A("the-settings-menu", "The Settings menu", { screen: "settings" }),
    A("settings-company", "Company Settings", { screen: "settings-company" }),
    A("opening-hours", "Opening hours", { screen: "settings-company", feature: "booking_page" }),
    A("tax-settings", "Tax settings", { screen: "settings-company", feature: "sales_tax" }),
    A("industry-and-quote-types", "Industry and quote types", { screen: "settings-company", feature: "quotes" }),
    A("settings-branding", "Branding", { screen: "settings-branding", feature: "white_label" }),
    A("settings-language", "Language", { screen: "settings-language", feature: "languages" }),
    A("settings-activity-log", "Activity Log", { screen: "settings-activity", feature: "activity_log" }),
    A("settings-team", "Team", { screen: "settings-team", feature: "team_access" }),
    A("settings-your-hours", "Your hours", { screen: "settings-availability", feature: "booking_page" }),
    A("settings-time-off-policies", "Time off policies", { screen: "settings-leave", feature: "time_off" }),
    A("settings-booking-page", "Booking Page", { screen: "settings-booking-page", feature: "booking_page" }),
    A("settings-work-areas", "Work Areas", { screen: "settings-work-areas", feature: "work_areas" }),
    A("settings-products", "Products & Services (the price book)", { screen: "settings-products", feature: "price_book" }),
    A("settings-services", "Services & Pricing", { screen: "settings-services", feature: "quotes" }),
    A("settings-material-costs", "Material Costs", { screen: "settings-material-costs", feature: "material_costs" }),
    A("settings-cabinet-rates", "Cabinet pricing", { screen: "settings-cabinet-rates", feature: "kitchen_designer" }),
    A("settings-overhead", "Overhead", { screen: "settings-overhead", feature: "break_even" }),
    A("settings-custom-fields", "Custom Fields", { screen: "settings-custom-fields" }),
    A("settings-quote-email", "Quote Email", { screen: "settings-quote-email", feature: "quote_email_wording" }),
    A("settings-email-templates", "Email Templates", { screen: "settings-email-templates", feature: "quote_email_wording" }),
    A("settings-pdf-templates", "PDF Templates", { screen: "settings-pdf-templates", feature: "document_layouts" }),
    A("settings-translations", "Translations", { screen: "settings-translations", feature: "languages" }),
    A("settings-checklists", "Checklists", { screen: "settings-checklists", feature: "checklists" }),
    A("settings-job-photo-tags", "Job photo tags", { screen: "settings-job-photo-tags", feature: "job_photos" }),
    A("settings-client-messages", "Client messages", { screen: "settings-messages", feature: "appointment_reminders" }),
    A("settings-follow-ups", "Follow-ups", { screen: "settings-follow-ups", feature: "follow_ups" }),
    A("settings-notifications", "Notifications", { screen: "settings-notifications" }),
    A("settings-email-domain", "Email Domain", { screen: "settings-email-domain", feature: "own_email_domain" }),
    A("settings-payments", "Payments", { screen: "settings-payments", feature: "stripe_connect" }),
    A("settings-meta-ads", "Meta Ads", { screen: "settings-meta-ads", feature: "marketing_spend" }),
    A("settings-expense-tracking", "Expense Tracking", { screen: "settings-expense-tracking", feature: "expenses" }),
    A("settings-ai-credit", "AI credit", { screen: "settings-ai-credit", feature: "ai_copilot" }),
    A("settings-payroll", "Payroll settings", { screen: "settings-payroll", feature: "payroll" }),
    A("settings-website", "Your website", { screen: "settings-website", feature: "website_builder" }),
    A("settings-instant-quotes", "Instant Quotes", { screen: "settings-instant-quotes", feature: "instant_quotes" }),
    A("settings-share-your-links", "Share your links", { screen: "settings-lead-form", feature: "embeds" }),
    A("settings-bio-link", "Bio link", { screen: "settings-bio-link", feature: "bio_link" }),
    A("settings-phone-receptionist", "Phone receptionist", { screen: "settings-voice", feature: "voice_receptionist" }),
    A("settings-ai-employee", "AI employee", { screen: "settings-ai-employee", feature: "ai_employee" }),
    A("settings-reviews", "Reviews", { screen: "settings-reviews", feature: "review_requests" }),
    A("settings-data-migration", "Data Migration", { screen: "settings-migration" }),
    A("settings-product-updates", "Product Updates", { screen: "settings-product-updates" }),
    A("settings-account-and-billing", "Account & Billing", { screen: "settings-account-billing" }),
    A("settings-refer-and-earn", "Refer & Earn", { screen: "settings-refer", feature: "referrals" }),
  ],

  "billing-and-subscription": [
    A("your-plan-and-seats", "Your plan and seats", { screen: "plan" }),
    A("the-four-plans", "The four plans: Solo, Crew, Shop, Scale", { feature: "team_access" }),
    A("free-first-month", "Your first month is free", {}),
    A("monthly-or-a-year-commitment", "Monthly, or a one-year commitment", {}),
    A("change-your-plan", "Change your plan", {}),
    A("add-a-seat-or-a-crew-login", "Add a seat, or a free crew login", { feature: "team_access" }),
    A("update-your-payment-method", "Update your payment method", {}),
    A("invoices-and-receipts-from-fieldquo", "Invoices and receipts from FieldQuo", {}),
    A("failed-payments-and-the-grace-period", "Failed payments and the grace period", {}),
    A("renewal-reminders", "Renewal reminders", {}),
    A("cancel-your-subscription", "Cancel your subscription", {}),
    A("referral-months", "Referral months", { feature: "referrals" }),
    A("ai-credit-and-phone-credit", "AI credit and phone credit", { screen: "settings-ai-credit" }),
    A("paying-for-the-migration-service", "Paying for the migration service", { screen: "settings-migration" }),
    A("taxes-and-currency-on-your-subscription", "Taxes and currency on your subscription", {}),
    A("closing-your-account", "Closing your account and your data", {}),
  ],

  "what-your-clients-see": [
    A("nothing-says-fieldquo", "Nothing says FieldQuo", { feature: "white_label", only: true }),
    A("the-quote-email", "The quote email", { feature: "quote_send" }),
    A("the-quote-approval-page", "The quote approval page", { feature: "online_approval" }),
    A("the-invoice-email-and-pay-page", "The invoice email and pay page", { feature: "invoice_send" }),
    A("the-client-portal-as-a-client", "The client portal", { feature: "client_portal" }),
    A("the-booking-page", "The booking page", { feature: "booking_page" }),
    A("managing-a-booked-visit", "Managing a booked visit", { feature: "client_reschedule" }),
    A("the-instant-estimate-page", "The instant estimate page", { feature: "instant_quotes" }),
    A("the-self-quote-form-as-a-client", "The self-quote form", { feature: "self_quote" }),
    A("the-review-request", "The review request", { feature: "review_requests" }),
    A("the-referral-page", "The referral page", { feature: "referrals" }),
    A("your-website-as-a-visitor", "Your website", { feature: "website_builder" }),
    A("the-kitchen-design-link", "The kitchen design link", { feature: "kitchen_designer" }),
    A("the-bio-link-page", "The bio link page", { feature: "bio_link" }),
    A("a-funnel-as-a-visitor", "A funnel", { feature: "funnels" }),
    A("the-texts-clients-receive", "The texts clients receive", { feature: "appointment_reminders" }),
  ],

  integrations: [
    A("stripe", "Stripe", { feature: "stripe_connect" }),
    A("facebook-and-instagram", "Facebook and Instagram (Meta)", { feature: "page_messaging" }),
    A("whatsapp", "WhatsApp Business", { feature: "whatsapp_messaging" }),
    A("phone-and-texts", "Phone numbers and texts (Twilio)", { feature: "voice_receptionist" }),
    A("google-maps-and-solar", "Google Maps and Google Solar", { feature: "aerial_measure" }),
    A("photos-and-files", "Photos and files (Cloudinary)", { feature: "job_photos" }),
    A("email-delivery", "Email delivery (Resend) and your own domain", { feature: "own_email_domain" }),
    A("quickbooks-xero-and-your-bookkeeper", "QuickBooks, Xero and your bookkeeper", { feature: "expenses" }),
    A("stock-photos-on-your-website", "Stock photos on your website (Unsplash)", { feature: "website_builder" }),
    A("data-and-privacy", "Your data, your clients' data, and deletion", {}),
    A("no-public-api-or-zapier", "No public API or Zapier, yet", {}),
  ],
});

/** Flat list of every article with its category, in tree order. */
export const HELP_ARTICLES = Object.freeze(
  REAL_CATEGORY_KEYS.flatMap((category) =>
    HELP_TREE[category].map((a) => Object.freeze({ ...a, category })),
  ),
);

const BY_SLUG = new Map(HELP_ARTICLES.map((a) => [a.slug, a]));

/** The tree entry for a slug, or null. Slugs are unique across categories. */
export function articleMeta(slug) {
  return BY_SLUG.get(slug) || null;
}

/** Category key for a slug, or null. */
export function categoryOf(slug) {
  return BY_SLUG.get(slug)?.category || null;
}

/** The article whose `screen` is this sidebar row slug, or null. */
export function articleForScreen(screen) {
  if (!screen) return null;
  return HELP_ARTICLES.find((a) => a.screen === screen) || null;
}

/** Articles a virtual category lists. `videos` needs the merged video map. */
export function virtualArticles(kind, videos = {}) {
  if (kind === "only") return HELP_ARTICLES.filter((a) => a.only);
  if (kind === "video") return HELP_ARTICLES.filter((a) => videos[a.slug]);
  return [];
}
