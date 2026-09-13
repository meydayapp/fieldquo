// docs/screens/app-guide/harness/screens.js
//
// Every row of the /app sidebar and every row of the Settings sidebar, in
// the order the product draws them. `nav` rows are read from the sidebar
// components at build time by check-sidebar.mjs; this list is the SAME
// order copied by hand, and scripts/check-app-guide-screens.mjs (see the
// harness README) fails when the two drift — a guide that shows screens in
// an order the product does not is the "control that appears to work"
// failure, in print.
//
// `href` is what usePathname() returns inside the harness so the sidebar
// highlights the row being photographed. `page` is the module the harness
// bundles. `settings` rows render inside the settings sub-shell as well.
export const SCREENS = [
  // ── The main rail ──────────────────────────────────────────────────────
  { slug: "home", nav: "app.nav.home", href: "/app", page: "app/app/page.js" },
  { slug: "ai", nav: "app.nav.ai", href: "/app/copilot", page: "app/app/copilot/page.js" },
  // Work
  { slug: "requests", nav: "app.nav.requests", href: "/app/leads", page: "app/app/leads/page.js" },
  { slug: "quotes", nav: "app.nav.quotes", href: "/app/quotes", page: "app/app/quotes/page.js" },
  { slug: "estimate-reviews", nav: "app.nav.estimateReviews", href: "/app/estimate-reviews", page: "app/app/estimate-reviews/page.js" },
  { slug: "jobs", nav: "app.nav.jobs", href: "/app/jobs", page: "app/app/jobs/page.js" },
  { slug: "invoices", nav: "app.nav.invoices", href: "/app/invoices", page: "app/app/invoices/page.js" },
  { slug: "plans", nav: "app.nav.plans", href: "/app/plans", page: "app/app/plans/page.js" },
  { slug: "calendar", nav: "app.nav.calendar", href: "/app/appointments", page: "app/app/appointments/page.js" },
  { slug: "tasks", nav: "app.nav.tasks", href: "/app/tasks", page: "app/app/tasks/page.js" },
  // People
  { slug: "clients", nav: "app.nav.clients", href: "/app/clients", page: "app/app/clients/page.js" },
  { slug: "client-equipment", nav: "app.nav.clientEquipment", href: "/app/equipment", page: "app/app/equipment/page.js" },
  // The crew chat opens on the room list; the scene opens the job room so
  // the figure shows a thread, a mention and the composer.
  { slug: "chat", nav: "app.nav.chat", href: "/app/chat", page: "app/app/chat/page.js", scene: "chat-open" },
  { slug: "team", nav: "app.nav.team", href: "/app/settings/team", page: "app/app/settings/team/page.js", settings: true },
  { slug: "subcontractors", nav: "app.nav.subcontractors", href: "/app/subcontractors", page: "app/app/subcontractors/page.js" },
  { slug: "scheduler", nav: "app.nav.scheduler", href: "/app/scheduler", page: "app/app/scheduler/page.js" },
  { slug: "team-schedule", nav: "app.nav.teamSchedule", href: "/app/schedule", page: "app/app/schedule/page.js" },
  { slug: "clock", nav: "app.nav.clock", href: "/app/clock", page: "app/app/clock/page.js" },
  { slug: "timesheets", nav: "app.nav.timesheets", href: "/app/settings/team/timesheets", page: "app/app/settings/team/timesheets/page.js", settings: true },
  { slug: "time-off", nav: "app.nav.timeOff", href: "/app/time-off", page: "app/app/time-off/page.js" },
  { slug: "safety", nav: "app.nav.safety", href: "/app/safety", page: "app/app/safety/page.js" },
  // Money
  { slug: "payroll", nav: "app.nav.payroll", href: "/app/payroll", page: "app/app/payroll/page.js" },
  { slug: "expenses", nav: "app.nav.expenses", href: "/app/settings/expense-tracking", page: "app/app/settings/expense-tracking/page.js", settings: true },
  { slug: "purchasing", nav: "app.nav.purchasing", href: "/app/purchasing", page: "app/app/purchasing/page.js" },
  { slug: "fleet", nav: "app.nav.fleet", href: "/app/fleet", page: "app/app/fleet/page.js" },
  // Insights
  { slug: "insights", nav: "app.nav.insights", href: "/app/analytics/benchmark", page: "app/app/analytics/benchmark/page.js" },
  { slug: "kpis", nav: "app.nav.kpis", href: "/app/analytics/kpis", page: "app/app/analytics/kpis/page.js" },
  // Grow
  { slug: "marketing", nav: "app.nav.marketing", href: "/app/marketing", page: "app/app/marketing/page.js" },
  { slug: "marketing-designer", nav: "app.nav.marketingDesigner", href: "/app/marketing/designer", page: "app/app/marketing/designer/page.js" },
  { slug: "funnels", nav: "app.nav.funnels", href: "/app/funnels", page: "app/app/funnels/page.js" },
  { slug: "receptionist", nav: "app.nav.receptionist", href: "/app/receptionist", page: "app/app/receptionist/page.js" },
  { slug: "crew-inbox", nav: "app.nav.crewInbox", href: "/app/crew-inbox", page: "app/app/crew-inbox/page.js" },
  { slug: "messages", nav: "app.nav.messages", href: "/app/messages", page: "app/app/messages/page.js", scene: "messages-open" },
  { slug: "refer", nav: "app.nav.refer", href: "/app/settings/refer", page: "app/app/settings/refer/page.js", settings: true },
  // Bottom of the rail
  { slug: "help", nav: "app.nav.help", href: "/app/help", page: "app/app/help/page.js" },
  { slug: "plan", nav: "app.nav.plan", href: "/app/settings/account-billing", page: "app/app/settings/account-billing/page.js", settings: true },
  // Settings itself redirects to Company; the row is photographed as the
  // settings index the sidebar opens on (Company Settings), which is what a
  // person clicking it sees.
  { slug: "settings", nav: "app.nav.settings", href: "/app/settings/company", page: "app/app/settings/company/page.js", settings: true },

  // ── The Settings sidebar ───────────────────────────────────────────────
  // Account
  { slug: "settings-account-billing", nav: "app.settings.accountBilling", href: "/app/settings/account-billing", page: "app/app/settings/account-billing/page.js", settings: true, sameAs: "plan" },
  { slug: "settings-refer", nav: "app.settings.refer", href: "/app/settings/refer", page: "app/app/settings/refer/page.js", settings: true, sameAs: "refer" },
  { slug: "settings-migration", nav: "app.settings.migration", href: "/app/settings/migration", page: "app/app/settings/migration/page.js", settings: true },
  { slug: "settings-product-updates", nav: "app.settings.productUpdates", href: "/app/settings/product-updates", page: "app/app/settings/product-updates/page.js", settings: true },
  // Business
  { slug: "settings-company", nav: "app.settings.company", href: "/app/settings/company", page: "app/app/settings/company/page.js", settings: true, sameAs: "settings" },
  { slug: "settings-branding", nav: "app.settings.branding", href: "/app/settings/branding", page: "app/app/settings/branding/page.js", settings: true },
  { slug: "settings-language", nav: "app.settings.language", href: "/app/settings/language", page: "app/app/settings/language/page.js", settings: true },
  { slug: "settings-activity", nav: "app.settings.activity", href: "/app/activity", page: "app/app/activity/page.js" },
  // Team & scheduling
  { slug: "settings-team", nav: "app.settings.team", href: "/app/settings/team", page: "app/app/settings/team/page.js", settings: true, sameAs: "team" },
  { slug: "settings-availability", nav: "app.settings.availability", href: "/app/settings/availability", page: "app/app/settings/availability/page.js", settings: true },
  { slug: "settings-leave", nav: "app.settings.leave", href: "/app/settings/leave", page: "app/app/settings/leave/page.js", settings: true },
  { slug: "settings-booking-page", nav: "app.settings.bookingPage", href: "/app/settings/booking-page", page: "app/app/settings/booking-page/page.js", settings: true },
  { slug: "settings-work-areas", nav: "app.settings.workAreas", href: "/app/settings/work-areas", page: "app/app/settings/work-areas/page.js", settings: true },
  // Services & pricing
  { slug: "settings-products", nav: "app.settings.products", href: "/app/settings/products", page: "app/app/settings/products/page.js", settings: true },
  { slug: "settings-services", nav: "app.settings.services", href: "/app/settings/services", page: "app/app/settings/services/page.js", settings: true },
  { slug: "settings-material-costs", nav: "app.settings.materialCosts", href: "/app/settings/material-costs", page: "app/app/settings/material-costs/page.js", settings: true },
  { slug: "settings-cabinet-rates", nav: "app.settings.cabinetRates", href: "/app/settings/cabinet-rates", page: "app/app/settings/cabinet-rates/page.js", settings: true },
  { slug: "settings-overhead", nav: "app.settings.overhead", href: "/app/settings/overhead", page: "app/app/settings/overhead/page.js", settings: true },
  { slug: "settings-custom-fields", nav: "app.settings.customFields", href: "/app/settings/custom-fields", page: "app/app/settings/custom-fields/page.js", settings: true },
  // Documents & templates
  { slug: "settings-quote-email", nav: "app.settings.quoteEmail", href: "/app/settings/quote-email", page: "app/app/settings/quote-email/page.js", settings: true },
  { slug: "settings-email-templates", nav: "app.settings.emailTemplates", href: "/app/settings/email-templates", page: "app/app/settings/email-templates/page.js", settings: true },
  { slug: "settings-pdf-templates", nav: "app.settings.pdfTemplates", href: "/app/settings/templates", page: "app/app/settings/templates/page.js", settings: true },
  { slug: "settings-translations", nav: "app.settings.translations", href: "/app/settings/translations", page: "app/app/settings/translations/page.js", settings: true },
  { slug: "settings-checklists", nav: "app.settings.checklists", href: "/app/settings/checklists", page: "app/app/settings/checklists/page.js", settings: true },
  { slug: "settings-job-photo-tags", nav: "app.settings.jobPhotoTags", href: "/app/settings/job-photo-tags", page: "app/app/settings/job-photo-tags/page.js", settings: true },
  // Messaging & alerts
  { slug: "settings-messages", nav: "app.settings.messages", href: "/app/settings/messages", page: "app/app/settings/messages/page.js", settings: true },
  { slug: "settings-follow-ups", nav: "app.settings.followUps", href: "/app/settings/follow-ups", page: "app/app/settings/follow-ups/page.js", settings: true },
  { slug: "settings-notifications", nav: "app.settings.notifications", href: "/app/settings/notifications", page: "app/app/settings/notifications/page.js", settings: true },
  { slug: "settings-email-domain", nav: "app.settings.emailDomain", href: "/app/settings/email-domain", page: "app/app/settings/email-domain/page.js", settings: true },
  // Getting paid
  { slug: "settings-payments", nav: "app.settings.payments", href: "/app/settings/payments", page: "app/app/settings/payments/page.js", settings: true },
  { slug: "settings-meta-ads", nav: "app.settings.metaAds", href: "/app/settings/meta-ads", page: "app/app/settings/meta-ads/page.js", settings: true },
  { slug: "settings-expense-tracking", nav: "app.settings.expenseTracking", href: "/app/settings/expense-tracking", page: "app/app/settings/expense-tracking/page.js", settings: true, sameAs: "expenses" },
  { slug: "settings-ai-credit", nav: "app.settings.aiCredit", href: "/app/settings/ai-credit", page: "app/app/settings/ai-credit/page.js", settings: true },
  { slug: "settings-payroll", nav: "app.settings.payroll", href: "/app/settings/payroll", page: "app/app/settings/payroll/page.js", settings: true },
  // Client-facing
  { slug: "settings-website", nav: "app.settings.website", href: "/app/settings/website", page: "app/app/settings/website/page.js", settings: true },
  { slug: "settings-instant-quotes", nav: "app.settings.instantQuotes", href: "/app/settings/instant-quotes", page: "app/app/settings/instant-quotes/page.js", settings: true },
  { slug: "settings-lead-form", nav: "app.settings.leadForm", href: "/app/settings/lead-form", page: "app/app/settings/lead-form/page.js", settings: true },
  { slug: "settings-bio-link", nav: "app.settings.bioLink", href: "/app/settings/links", page: "app/app/settings/links/page.js", settings: true },
  { slug: "settings-voice", nav: "app.settings.voice", href: "/app/settings/voice", page: "app/app/settings/voice/page.js", settings: true },
  { slug: "settings-ai-employee", nav: "app.settings.aiEmployee", href: "/app/settings/ai-employee", page: "app/app/settings/ai-employee/page.js", settings: true },
  { slug: "settings-reviews", nav: "app.settings.reviews", href: "/app/settings/reviews", page: "app/app/settings/reviews/page.js", settings: true },

  // ── Figures for the "Roles and access" chapter (not sidebar rows) ──────
  // Manage Team with the Custom access editor open on one member; reached
  // by operating the page's own access dropdown (guide.jsx runScene).
  { slug: "access-editor", nav: "app.settings.team", href: "/app/settings/team", page: "app/app/settings/team/page.js", settings: true, scene: "access-editor", chapter: "roles" },

  // ── Figures for the help centre (not sidebar rows) ─────────────────────
  // lib/help/figures.js resolves `harness:<slug>` to these. Appended, never
  // inserted: NN is the row's index and the files above keep their names.
  // Every row carries `chapter: "help"` so check-app-guide-screens.mjs
  // leaves it out of the sidebar comparison.
  //
  // What a homeowner opens from a link — outside the /app shell (mode:
  // "public"). Each is the client component the route's page.js mounts, with
  // the token or slug it would have been given; fixtures/routes-help.js
  // answers what the component fetches, fixtures/public.js builds the props
  // the two server-rendered pages (website, bio link) would have computed.
  // Taller frames where the point of the page is at its foot: the add-ons
  // and the Approve button, the plan under the designer's palette.
  { slug: "client-quote-approval", href: "/q/qt_8f2c1a7d4e", page: "app/q/[token]/QuoteApproval.js", props: { token: "qt_8f2c1a7d4e" }, mode: "public", height: 2400, chapter: "help" },
  { slug: "client-booking-page", href: "/book/erable-design", page: "app/book/[companySlug]/BookingFlow.js", props: { companySlug: "erable-design" }, mode: "public", wrap: "bookingPage", scene: "booking-pick", chapter: "help" },
  { slug: "client-portal", href: "/portal/pt_3a9d7c2f1b", page: "app/portal/[token]/ClientPortal.js", props: { token: "pt_3a9d7c2f1b" }, mode: "public", chapter: "help" },
  { slug: "client-instant-estimate", href: "/instant-quote/erable-design", page: "app/instant-quote/[companySlug]/InstantQuoteFlow.js", props: { companySlug: "erable-design" }, mode: "public", scene: "instant-pick", chapter: "help" },
  { slug: "client-self-quote-form", href: "/quote/erable-design", page: "app/quote/[companySlug]/SelfQuoteFlow.js", props: { companySlug: "erable-design" }, mode: "public", chapter: "help" },
  { slug: "client-visit-manage", href: "/visit/vm_5c1e8b3a2d", page: "app/visit/[token]/VisitManager.js", props: { token: "vm_5c1e8b3a2d" }, mode: "public", chapter: "help" },
  { slug: "client-website", href: "/site/erable-design", page: "app/site/[subdomain]/SiteBlocks.js", props: "site", mode: "public", wrap: "sitePage", chapter: "help" },
  { slug: "client-bio-link", href: "/l/erable-design", page: "app/components/links/LinkPageView.js", props: "bioLink", mode: "public", chapter: "help" },
  { slug: "client-funnel", href: "/f/erable-design/kitchen-quote", page: "app/f/[companySlug]/[funnelSlug]/FunnelRunner.js", props: { companySlug: "erable-design", funnelSlug: "kitchen-quote" }, mode: "public", scene: "funnel-start", chapter: "help" },
  { slug: "client-kitchen-design", href: "/design/qt_8f2c1a7d4e", page: "app/design/[token]/DesignClient.js", params: { token: "qt_8f2c1a7d4e" }, mode: "public", height: 1500, chapter: "help" },

  // The detail pages the sidebar rows link to — inside the /app shell, as
  // the owner. `params` is what useParams() hands the page; the ids are
  // company.js's quote, job, client and the group files' rows.
  { slug: "quote-detail", href: "/app/quotes", page: "app/app/quotes/[id]/page.js", params: { id: "q_1042" }, chapter: "help" },
  { slug: "quote-builder", href: "/app/quotes", page: "app/app/quotes/new/page.js", chapter: "help" },
  // app/app/jobs/[id]/page.js is a server shell (it awaits params); the
  // client component it mounts is photographed with the prop it would pass.
  { slug: "job-detail", href: "/app/jobs", page: "app/app/jobs/[id]/JobDetail.js", props: { jobId: "j_318" }, height: 2200, chapter: "help" },
  // The same job scrolled to its visits (checklist, location stamps) and the
  // photo timeline below them — the lower half of a page too tall for one frame.
  { slug: "job-detail-visits", href: "/app/jobs", page: "app/app/jobs/[id]/JobDetail.js", props: { jobId: "j_318" }, scene: "scroll-visits", height: 2000, chapter: "help" },
  { slug: "invoice-detail", href: "/app/invoices", page: "app/app/invoices/[id]/page.js", params: { id: "inv_2069" }, height: 1560, chapter: "help" },
  { slug: "client-detail", href: "/app/clients", page: "app/app/clients/[id]/page.js", params: { id: "cl_dubois" }, chapter: "help" },
  { slug: "plan-detail", href: "/app/plans", page: "app/app/plans/[id]/page.js", params: { id: "sp_dubois" }, chapter: "help" },
  { slug: "payroll-run", href: "/app/payroll", page: "app/app/payroll/[id]/page.js", params: { id: "run_0913" }, chapter: "help" },
  { slug: "funnel-builder", href: "/app/funnels", page: "app/app/funnels/[id]/page.js", params: { id: "fn_kitchen" }, chapter: "help" },
  { slug: "campaign-detail", href: "/app/marketing", page: "app/app/marketing/[id]/page.js", params: { id: "mc_flyers" }, chapter: "help" },
  { slug: "messages-review", href: "/app/messages", page: "app/app/messages/review/page.js", chapter: "help" },
  // The KPI page scrolled to its Cash section (the full page is row 27).
  { slug: "kpis-cash", href: "/app/analytics/kpis", page: "app/app/analytics/kpis/page.js", scene: "kpis-cash", chapter: "help" },

  // The crew's phone: 375 wide, Léo Bouchard (Crew preset) signed in, the
  // tab bar at the foot. The same page modules the owner's rows use — a
  // crew member has no other app — answered as the API answers him
  // (fixtures/routes-help.js, the crew block).
  { slug: "mobile-home", href: "/app", page: "app/app/page.js", member: "crew", width: 375, chapter: "help" },
  { slug: "mobile-clock", href: "/app/clock", page: "app/app/clock/page.js", member: "crew", width: 375, chapter: "help" },
  { slug: "mobile-schedule", href: "/app/schedule", page: "app/app/schedule/page.js", member: "crew", width: 375, chapter: "help" },
  { slug: "mobile-chat", href: "/app/chat", page: "app/app/chat/page.js", member: "crew", width: 375, scene: "chat-open", chapter: "help" },
  // The job scrolled to its visits: on the crew's phone the visit — On my
  // way, the checklist, Mark complete — is the page.
  { slug: "mobile-job", href: "/app/jobs", page: "app/app/jobs/[id]/JobDetail.js", props: { jobId: "j_318" }, member: "crew", width: 375, scene: "scroll-visits", chapter: "help" },
  { slug: "mobile-time-off", href: "/app/time-off", page: "app/app/time-off/page.js", member: "crew", width: 375, chapter: "help" },
  { slug: "mobile-safety-report", href: "/app/safety", page: "app/app/safety/page.js", member: "crew", width: 375, scene: "safety-report", chapter: "help" },

  // More figures the writers asked for. The same rules: real components,
  // reached by operating the page's own controls.
  { slug: "invoice-chase", href: "/app/invoices", page: "app/app/invoices/[id]/page.js", params: { id: "inv_2066" }, scene: "invoice-chase", chapter: "help" },
  { slug: "client-edit", href: "/app/clients", page: "app/app/clients/[id]/page.js", params: { id: "cl_dubois" }, scene: "client-edit", chapter: "help" },
  { slug: "clients-import", href: "/app/clients", page: "app/app/clients/import/page.js", chapter: "help" },
  { slug: "jobs-import", href: "/app/jobs", page: "app/app/jobs/import/page.js", chapter: "help" },
  { slug: "appointment-new", href: "/app/appointments", page: "app/app/appointments/page.js", scene: "appointment-new", chapter: "help" },
  // The home page as a Dispatcher and as a Crew member, at desktop width, so
  // the rail shows what each level holds (Léo's phone is mobile-home above).
  { slug: "sidebar-dispatcher", href: "/app", page: "app/app/page.js", member: "dispatcher", chapter: "help" },
  { slug: "sidebar-crew", href: "/app", page: "app/app/page.js", member: "crew", chapter: "help" },
  // A stranger with an invitation, and a stranger signing a company up.
  { slug: "accept-invitation", href: "/accept-invitation/inv_k7d2m9", page: "app/accept-invitation/[id]/page.js", params: { id: "inv_k7d2m9" }, mode: "public", chapter: "help" },
  { slug: "signup", href: "/signup", page: "app/signup/page.js", mode: "public", height: 1200, chapter: "help" },
  // A quote still out with the client — the page with Send again, Follow up
  // and Get approved on it (Q-1042 above is approved and converted).
  { slug: "quote-detail-sent", href: "/app/quotes", page: "app/app/quotes/[id]/page.js", params: { id: "q_1044" }, chapter: "help" },
];
