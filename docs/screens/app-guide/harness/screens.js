// docs/screens/app-guide/harness/screens.js
//
// Every row of the /app rail (the seventeen, then More's groups, then the
// account rows) and every row of the settings list, in the order the
// product draws them. `nav` rows are read from AdminSidebar.js and
// SettingsSidebar.js at build time by check-sidebar.mjs; this list is the
// SAME order copied by hand, and scripts/check-app-guide-screens.mjs (see
// the harness README) fails when the two drift — a guide that shows
// screens in an order the product does not is the "control that appears to
// work" failure, in print.
//
// `href` is what usePathname() returns inside the harness so the sidebar
// highlights the row being photographed. `page` is the module the harness
// bundles. `settings` rows render inside the settings sub-shell as well.
// ── The intro email's per-trade frames ─────────────────────────────────────
//
// One quote card per trade for lib/sales/outreach/introScreenshots.js: the
// real TradeTakeoff (or LotAreaMeasure) seeded from fixtures/takeoffs.js,
// photographed at 1200 wide into docs/screens/intro-email/<lang>/ and then
// cropped into public/product/email/ by scripts/build-intro-screenshots.mjs.
// `chapter` keeps them out of the guide's "Every screen" walk; `out` keeps
// them unnumbered. Roofing and gutters run the measure scene so the frame
// carries the satellite still.
const INTRO_TAKEOFF_TRADES = [
  "roofing_service", "paving", "gutter_services", "siding", "insulation", "interior_painting",
  "exterior_painting", "stairs", "countertop", "garage_door", "flooring", "driveway_sealing",
  "home_inspection", "snow_removal", "landscaping_design", "lawn_care", "lawn_mowing", "irrigation",
];
export const INTRO_FRAMES = INTRO_TAKEOFF_TRADES.map((trade) => ({
  slug: `intro-${trade}`,
  href: "/app/quotes/new",
  page: "docs/screens/app-guide/harness/TakeoffFrame.jsx",
  props: { trade },
  mode: "public",
  width: 1200,
  height: 1000,
  chapter: "intro-email",
  out: "docs/screens/intro-email",
  ...(trade === "roofing_service" || trade === "gutter_services" ? { scene: "takeoff-measure" } : {}),
}));

// ── The card-free trial (2026-09-24) — docs/screens/no-card-signup ────────
// The trial banner in each state, the lock screen for a trial that ran out,
// Account & Billing opened from the banner (?tier=crew) and the platform
// list's per-country tally. TrialFrame.jsx answers the billing-state routes
// per view; everything else is the fixture company.
export const TRIAL_FRAMES = [
  ["banner-trial-no-plan", "noplan", 1280],
  ["banner-trial-no-plan-phone", "noplan", 375],
  ["banner-trial-with-plan", "withplan", 1280],
  ["banner-trial-expired", "expired", 1280],
  ["banner-trial-expired-phone", "expired", 375],
  ["locked-trial", "locked", 1280],
  ["billing-suggested-tier", "billing", 1280],
  ["platform-companies-by-country", "platform", 1280],
  ["signup-last-step", "signup", 1280],
  ["signup-last-step-phone", "signup", 375],
].map(([slug, view, width]) => ({
  slug,
  href: view === "billing" ? "/app/settings/account-billing?tier=crew" : view === "platform" ? "/platform/companies" : view === "signup" ? "/signup" : "/app",
  page: "docs/screens/app-guide/harness/TrialFrame.jsx",
  props: { view },
  mode: "public",
  width,
  height: view === "billing" ? 1400 : view === "signup" ? 1100 : 720,
  chapter: "no-card-signup",
  out: "docs/screens/no-card-signup",
}));

export const SCREENS = [
  // ── The main rail: Home, then the seventeen (2026-09-21 shell) ─────────
  { slug: "home", nav: "app.nav.home", href: "/app", page: "app/app/page.js" },
  // Work
  { slug: "requests", nav: "app.nav.requests", href: "/app/leads", page: "app/app/leads/page.js" },
  { slug: "quotes", nav: "app.nav.quotes", href: "/app/quotes", page: "app/app/quotes/page.js" },
  { slug: "estimate-reviews", nav: "app.nav.estimateReviews", href: "/app/estimate-reviews", page: "app/app/estimate-reviews/page.js" },
  { slug: "jobs", nav: "app.nav.jobs", href: "/app/jobs", page: "app/app/jobs/page.js" },
  { slug: "invoices", nav: "app.nav.invoices", href: "/app/invoices", page: "app/app/invoices/page.js" },
  { slug: "calendar", nav: "app.nav.calendar", href: "/app/appointments", page: "app/app/appointments/page.js" },
  // People
  { slug: "clients", nav: "app.nav.clients", href: "/app/clients", page: "app/app/clients/page.js" },
  // The crew chat opens on the room list; the scene opens the job room so
  // the figure shows a thread, a mention and the composer.
  { slug: "chat", nav: "app.nav.chat", href: "/app/chat", page: "app/app/chat/page.js", scene: "chat-open" },
  { slug: "scheduler", nav: "app.nav.scheduler", href: "/app/scheduler", page: "app/app/scheduler/page.js" },
  // Money
  { slug: "payroll", nav: "app.nav.payroll", href: "/app/payroll", page: "app/app/payroll/page.js" },
  { slug: "insights", nav: "app.nav.insights", href: "/app/analytics/benchmark", page: "app/app/analytics/benchmark/page.js" },
  // Grow
  { slug: "marketing", nav: "app.nav.marketing", href: "/app/marketing", page: "app/app/marketing/page.js" },
  { slug: "messages", nav: "app.nav.messages", href: "/app/messages", page: "app/app/messages/page.js", scene: "messages-open" },
  { slug: "receptionist", nav: "app.nav.receptionist", href: "/app/receptionist", page: "app/app/receptionist/page.js" },
  // AI
  { slug: "ai", nav: "app.nav.ai", href: "/app/copilot", page: "app/app/copilot/page.js" },
  { slug: "ai-team", nav: "app.nav.aiTeam", href: "/app/settings/ai-employee", page: "app/app/settings/ai-employee/page.js", settings: true },
  // More — the page the rail's last row opens
  { slug: "more", nav: "app.nav.more", href: "/app/more", page: "app/app/more/page.js" },

  // ── The More groups, in the order /app/more tiles them ─────────────────
  // Work & sales
  { slug: "plans", nav: "app.nav.plans", href: "/app/plans", page: "app/app/plans/page.js" },
  { slug: "tasks", nav: "app.nav.tasks", href: "/app/tasks", page: "app/app/tasks/page.js" },
  { slug: "funnels", nav: "app.nav.funnels", href: "/app/funnels", page: "app/app/funnels/page.js" },
  { slug: "crew-inbox", nav: "app.nav.crewInbox", href: "/app/crew-inbox", page: "app/app/crew-inbox/page.js" },
  { slug: "marketing-designer", nav: "app.nav.marketingDesigner", href: "/app/marketing/designer", page: "app/app/marketing/designer/page.js" },
  // Time & crew
  { slug: "my-home", nav: "app.nav.myHome", href: "/app/me", page: "app/app/me/page.js" },
  { slug: "team", nav: "app.nav.team", href: "/app/settings/team", page: "app/app/settings/team/page.js", settings: true },
  { slug: "team-schedule", nav: "app.nav.teamSchedule", href: "/app/schedule", page: "app/app/schedule/page.js" },
  { slug: "my-schedule", nav: "app.nav.mySchedule", href: "/app/me/schedule", page: "app/app/me/schedule/page.js" },
  { slug: "clock", nav: "app.nav.clock", href: "/app/clock", page: "app/app/clock/page.js" },
  { slug: "timesheets", nav: "app.nav.timesheets", href: "/app/settings/team/timesheets", page: "app/app/settings/team/timesheets/page.js", settings: true },
  { slug: "daily-sheets", nav: "app.nav.dailySheets", href: "/app/daily-sheets", page: "app/app/daily-sheets/page.js" },
  { slug: "time-off", nav: "app.nav.timeOff", href: "/app/time-off", page: "app/app/time-off/page.js" },
  { slug: "safety", nav: "app.nav.safety", href: "/app/safety", page: "app/app/safety/page.js" },
  { slug: "manager-log", nav: "app.nav.log", href: "/app/log", page: "app/app/log/page.js" },
  // Money & reports
  { slug: "expenses", nav: "app.nav.expenses", href: "/app/settings/expense-tracking", page: "app/app/settings/expense-tracking/page.js", settings: true },
  { slug: "purchasing", nav: "app.nav.purchasing", href: "/app/purchasing", page: "app/app/purchasing/page.js" },
  { slug: "fleet", nav: "app.nav.fleet", href: "/app/fleet", page: "app/app/fleet/page.js" },
  { slug: "kpis", nav: "app.nav.kpis", href: "/app/analytics/kpis", page: "app/app/analytics/kpis/page.js" },
  // Clients & partners
  { slug: "client-equipment", nav: "app.nav.clientEquipment", href: "/app/equipment", page: "app/app/equipment/page.js" },
  { slug: "subcontractors", nav: "app.nav.subcontractors", href: "/app/subcontractors", page: "app/app/subcontractors/page.js" },
  { slug: "refer", nav: "app.nav.refer", href: "/app/settings/refer", page: "app/app/settings/refer/page.js", settings: true },
  // Present only for a company enrolled in the influencer programme.
  { slug: "influencer", nav: "app.nav.influencer", href: "/app/influencer", page: "app/app/influencer/page.js" },

  // ── The account rows (avatar menu on desktop, the More sheet's tail on a phone) ──
  { slug: "help", nav: "app.nav.help", href: "/app/help", page: "app/app/help/page.js" },
  { slug: "plan", nav: "app.nav.plan", href: "/app/settings/account-billing", page: "app/app/settings/account-billing/page.js", settings: true },
  // Settings is an index of its own since 2026-09-21: search first, eight
  // cards, every row a link.
  { slug: "settings", nav: "app.nav.settings", href: "/app/settings", page: "app/app/settings/page.js", settings: true },

  // ── The Settings sidebar ───────────────────────────────────────────────
  // Account
  { slug: "settings-account-billing", nav: "app.settings.accountBilling", href: "/app/settings/account-billing", page: "app/app/settings/account-billing/page.js", settings: true, sameAs: "plan" },
  { slug: "settings-refer", nav: "app.settings.refer", href: "/app/settings/refer", page: "app/app/settings/refer/page.js", settings: true, sameAs: "refer" },
  { slug: "settings-migration", nav: "app.settings.migration", href: "/app/settings/migration", page: "app/app/settings/migration/page.js", settings: true },
  { slug: "settings-product-updates", nav: "app.settings.productUpdates", href: "/app/settings/product-updates", page: "app/app/settings/product-updates/page.js", settings: true },
  // Business
  { slug: "settings-company", nav: "app.settings.company", href: "/app/settings/company", page: "app/app/settings/company/page.js", settings: true },
  { slug: "settings-branding", nav: "app.settings.branding", href: "/app/settings/branding", page: "app/app/settings/branding/page.js", settings: true },
  { slug: "settings-language", nav: "app.settings.language", href: "/app/settings/language", page: "app/app/settings/language/page.js", settings: true },
  { slug: "settings-activity", nav: "app.settings.activity", href: "/app/activity", page: "app/app/activity/page.js" },
  // Team & scheduling
  { slug: "settings-team", nav: "app.settings.team", href: "/app/settings/team", page: "app/app/settings/team/page.js", settings: true, sameAs: "team" },
  { slug: "settings-availability", nav: "app.settings.availability", href: "/app/settings/availability", page: "app/app/settings/availability/page.js", settings: true },
  { slug: "settings-my-calendar", nav: "app.settings.myCalendar", href: "/app/settings/my-calendar", page: "app/app/settings/my-calendar/page.js", settings: true },
  { slug: "settings-leave", nav: "app.settings.leave", href: "/app/settings/leave", page: "app/app/settings/leave/page.js", settings: true },
  { slug: "settings-policies", nav: "app.settings.policies", href: "/app/settings/policies", page: "app/app/settings/policies/page.js", settings: true },
  { slug: "settings-booking-page", nav: "app.settings.bookingPage", href: "/app/settings/booking-page", page: "app/app/settings/booking-page/page.js", settings: true },
  { slug: "settings-work-areas", nav: "app.settings.workAreas", href: "/app/settings/work-areas", page: "app/app/settings/work-areas/page.js", settings: true },
  { slug: "settings-field-work", nav: "app.settings.fieldWork", href: "/app/settings/field-work", page: "app/app/settings/field-work/page.js", settings: true },
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
  { slug: "settings-ai-employee", nav: "app.settings.aiEmployee", href: "/app/settings/ai-employee", page: "app/app/settings/ai-employee/page.js", settings: true, sameAs: "ai-team" },
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
  { slug: "client-quote-approval", href: "/q/qt_8f2c1a7d4e", page: "app/q/[token]/QuoteApproval.js", props: { token: "qt_8f2c1a7d4e" }, mode: "public", height: 5000, chapter: "help" },
  // The same document before it is sent, opened by the office. Appended at the
  // end of the file (NN is the row's index), never here — these two are out:
  // "docs/screens/quote-preview", so they do not renumber the guide.
  { slug: "client-booking-page", href: "/book/erable-design", page: "app/book/[companySlug]/BookingFlow.js", props: { companySlug: "erable-design" }, mode: "public", wrap: "bookingPage", scene: "booking-pick", chapter: "help" },
  // The portal now opens on the job card (Done · In progress · Waiting on,
  // with CO-2 waiting on the client); taller so the balance and the
  // documents under it are still in the frame.
  { slug: "client-portal", href: "/portal/pt_3a9d7c2f1b", page: "app/portal/[token]/ClientPortal.js", props: { token: "pt_3a9d7c2f1b" }, mode: "public", height: 1700, chapter: "help" },
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
  // The instant draft and the hand-built draft of the same service, in the
  // editor — the only visible difference is the auto-estimated banner — and
  // the instant one at phone width, where the totals bar's three buttons and
  // the total have to share 375px (scripts/check-quote-builder.mjs).
  { slug: "quote-edit-instant", href: "/app/quotes", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1046" }, height: 680, chapter: "help" },
  { slug: "quote-edit-manual", href: "/app/quotes", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, height: 680, chapter: "help" },
  { slug: "quote-edit-instant-totals", href: "/app/quotes", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1046" }, height: 680, scene: "scroll-totals", chapter: "help" },
  { slug: "quote-edit-instant-mobile", href: "/app/quotes", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1046" }, width: 375, height: 812, chapter: "help" },
  { slug: "quote-edit-instant-mobile-totals", href: "/app/quotes", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1046" }, width: 375, height: 812, scene: "scroll-totals", chapter: "help" },
  { slug: "quote-edit-instant-offered", href: "/app/quotes", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1046" }, height: 680, scene: "scroll-offered", chapter: "help" },
  // The AI team's routing picture (app/components/aiEmployee/TeamFlow.js),
  // at desk width and at phone width, where its columns stack.
  { slug: "ai-team-flow", href: "/app/settings/ai-employee", page: "app/app/settings/ai-employee/page.js", settings: true, height: 1360, scene: "ai-team-flow", chapter: "help" },
  { slug: "ai-team-flow-phone", href: "/app/settings/ai-employee", page: "app/app/settings/ai-employee/page.js", settings: true, width: 375, height: 1900, scene: "ai-team-flow", chapter: "help" },
  // Materials, the crew work order and supplies (2026-09-21). The job page
  // scrolled to its grouped material list with the AI banner; the work order
  // as the office (hidden line flagged) and on the crew's phone; Purchasing on
  // its Requests tab (reached by the tab, as a person does); the crew's
  // Request a supply form.
  { slug: "job-materials", href: "/app/jobs", page: "app/app/jobs/[id]/JobDetail.js", props: { jobId: "j_318" }, scene: "scroll-materials", height: 1400, chapter: "help" },
  { slug: "work-order", href: "/app/jobs", page: "app/app/jobs/[id]/work-order/WorkOrderView.js", props: { jobId: "j_318" }, height: 1200, chapter: "help" },
  { slug: "mobile-work-order", href: "/app/jobs", page: "app/app/jobs/[id]/work-order/WorkOrderView.js", props: { jobId: "j_318" }, member: "crew", width: 375, height: 1500, chapter: "help" },
  { slug: "purchasing-requests", href: "/app/purchasing", page: "app/app/purchasing/page.js", scene: "purchasing-requests", height: 1100, chapter: "help" },
  { slug: "mobile-supplies", href: "/app/me/supplies", page: "app/app/me/supplies/page.js", member: "crew", width: 375, height: 1400, chapter: "help" },
  ...INTRO_FRAMES,
  ...TRIAL_FRAMES,

  // ── The booking page at phone width, one frame per mode ────────────────
  //
  // Unnumbered, under docs/screens/booking-modes/, so the guide's chapter
  // does not renumber. Step 3 of the flow — the details form — for a visit
  // (the address is required, the reason under Book says so) and for a phone
  // call (the number to ring is required, and the summary line names the
  // call). The same component and fixture as client-booking-page above.
  // The picker on the PAID consultation (the measurement visit, $49 promo),
  // so the chips read "On-site visit · 45 min · $49" beside "Phone call ·
  // 20 min · No charge" — the choice the owner asked the client to be able
  // to make knowingly.
  { slug: "booking-pick-375", href: "/book/erable-design", page: "app/book/[companySlug]/BookingFlow.js", props: { companySlug: "erable-design" }, mode: "public", wrap: "bookingPage", scene: "booking-pick-paid", width: 375, height: 1100, out: "docs/screens/booking-modes", chapter: "booking-modes" },
  { slug: "booking-visit-375", href: "/book/erable-design", page: "app/book/[companySlug]/BookingFlow.js", props: { companySlug: "erable-design" }, mode: "public", wrap: "bookingPage", scene: "booking-details-visit", width: 375, height: 1400, out: "docs/screens/booking-modes", chapter: "booking-modes" },
  { slug: "booking-call-375", href: "/book/erable-design", page: "app/book/[companySlug]/BookingFlow.js", props: { companySlug: "erable-design" }, mode: "public", wrap: "bookingPage", scene: "booking-details-call", width: 375, height: 1400, out: "docs/screens/booking-modes", chapter: "booking-modes" },
  // Field work (2026-09-21): the assignee's callback list (no sidebar row —
  // linked from Clients and from Settings → Follow-ups → Past clients), the
  // past-clients rule screen, one crew member's week, and the invoice editor
  // opened from a job so the clocked-hours offer shows, at phone width.
  { slug: "callbacks", href: "/app/callbacks", page: "app/app/callbacks/page.js", chapter: "help" },
  { slug: "settings-past-clients", href: "/app/settings/follow-ups/past-clients", page: "app/app/settings/follow-ups/past-clients/page.js", settings: true, chapter: "help" },
  { slug: "daily-sheet-week", href: "/app/daily-sheets/week?workerId=w_leo&weekOf=2026-09-14", page: "app/app/daily-sheets/week/page.js", chapter: "help" },
  { slug: "mobile-invoice-from-job", href: "/app/invoices/new?jobId=j_318", page: "app/app/invoices/new/page.js", width: 375, height: 1500, chapter: "help" },

  // ── The painting takeoff, step by step ─────────────────────────────────
  //
  // Unnumbered, under docs/screens/paint-takeoff/. The 2026-09-21 builder
  // mockup's sections: the estimate-type cards, the area table with its
  // options (the whole card, taller than the intro frame shows), the
  // situation-named rate picker, the substrate picker and the staining
  // table. Same TakeoffFrame and fixture as the intro frames.
  { slug: "paint-interior-full", href: "/app/quotes/new", page: "docs/screens/app-guide/harness/TakeoffFrame.jsx", props: { trade: "interior_painting" }, mode: "public", width: 1200, height: 2000, out: "docs/screens/paint-takeoff", chapter: "paint-takeoff" },
  { slug: "paint-rate-picker", href: "/app/quotes/new", page: "docs/screens/app-guide/harness/TakeoffFrame.jsx", props: { trade: "interior_painting" }, mode: "public", scene: "paint-rate-picker", width: 1200, height: 1000, out: "docs/screens/paint-takeoff", chapter: "paint-takeoff" },
  { slug: "paint-substrate-picker", href: "/app/quotes/new", page: "docs/screens/app-guide/harness/TakeoffFrame.jsx", props: { trade: "interior_painting" }, mode: "public", scene: "paint-substrate-picker", width: 1200, height: 1000, out: "docs/screens/paint-takeoff", chapter: "paint-takeoff" },
  { slug: "paint-settings-rates", href: "/app/settings/services", page: "docs/screens/app-guide/harness/PaintRatesFrame.jsx", mode: "public", scene: "paint-rates-open", width: 1000, height: 1500, out: "docs/screens/paint-takeoff", chapter: "paint-takeoff" },
  { slug: "quote-preview-draft", href: "/q/qt_2d7b4e91c0", page: "app/q/[token]/QuoteApproval.js", props: { token: "qt_2d7b4e91c0" }, mode: "public", wrap: "quotePreviewPage", width: 1280, height: 5000, out: "docs/screens/quote-preview", chapter: "quote-preview" },
  { slug: "quote-preview-draft-375", href: "/q/qt_2d7b4e91c0", page: "app/q/[token]/QuoteApproval.js", props: { token: "qt_2d7b4e91c0" }, mode: "public", wrap: "quotePreviewPage", width: 375, height: 1400, out: "docs/screens/quote-preview", chapter: "quote-preview" },
  { slug: "quote-send-menu-draft", href: "/app/quotes", page: "app/app/quotes/[id]/page.js", params: { id: "q_1045" }, scene: "send-menu-open", width: 1280, height: 900, out: "docs/screens/quote-preview", chapter: "quote-preview" },
  { slug: "quote-send-menu-draft-375", href: "/app/quotes", page: "app/app/quotes/[id]/page.js", params: { id: "q_1045" }, scene: "send-menu-open", width: 375, height: 800, out: "docs/screens/quote-preview", chapter: "quote-preview" },
  { slug: "paint-staining", href: "/app/quotes/new", page: "docs/screens/app-guide/harness/TakeoffFrame.jsx", props: { trade: "interior_painting", seed: "staining" }, mode: "public", width: 1200, height: 1400, out: "docs/screens/paint-takeoff", chapter: "paint-takeoff" },
  // The proposal at phone width (client mockup §1): the contents collapse
  // into a chip bar under the sticky header. Appended, never inserted — NN
  // is the row's index.
  { slug: "client-quote-approval-mobile", href: "/q/qt_8f2c1a7d4e", page: "app/q/[token]/QuoteApproval.js", props: { token: "qt_8f2c1a7d4e" }, mode: "public", width: 375, height: 5600, chapter: "help" },
  // Settings › Presentation (client mockup §2) — not a sidebar row; reached
  // from Quote Email, a quote's Presentation panel and the set-up steps.
  { slug: "settings-presentation", href: "/app/settings/presentation", page: "app/app/settings/presentation/page.js", chapter: "help", height: 2600 },
  // The quote page with its Presentation tab open — per-quote on/off, the
  // documents to include, the crew size behind the day plan, the waiver.
  { slug: "quote-detail-presentation", href: "/app/quotes", page: "app/app/quotes/[id]/page.js", params: { id: "q_1044" }, scene: "quote-presentation", chapter: "help", height: 1600 },
  // ── The quote's Send… menu and the line-item library ────────────────────
  //
  // Appended, so nothing above renumbers. The sent quote Q-1044 with its
  // split button open; the hand-built draft's builder with the library
  // dialog open on its list, then open on the popcorn block's editor (the
  // two frames mockup b5 and b8 proposed). Q-1044 also carries a text
  // block, a job address and the e-transfer / cheque offer, so the plain
  // quote-detail-sent frame above photographs those too.
  { slug: "quote-send-menu", href: "/app/quotes", page: "app/app/quotes/[id]/page.js", params: { id: "q_1044" }, scene: "send-menu-open", height: 900, chapter: "help" },
  { slug: "quote-line-item-library", href: "/app/quotes", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "quote-library-open", height: 900, chapter: "help" },
  { slug: "quote-text-block-editor", href: "/app/quotes", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "quote-library-popcorn", height: 1000, chapter: "help" },
  // Settings › Services with the library card unfolded — where the blocks
  // and the saved templates are edited without a quote open.
  { slug: "settings-services-library", href: "/app/settings/services", page: "app/app/settings/services/page.js", settings: true, scene: "settings-library-open", height: 1100, chapter: "help" },
  // Settings › Services for a company that also does handyman work: the
  // seeded services under the trade, the benchmark range beside each price,
  // "Use typical", and "Add missing services for my trade".
  { slug: "settings-services-seeds", href: "/app/settings/services", page: "app/app/settings/services/page.js", settings: true, scene: "settings-seeds-open", height: 1300, chapter: "help" },
  // The change-order addendum a homeowner signs (app/co/[token]).
  { slug: "client-change-order", href: "/co/co_9c2e7b1a4f", page: "app/co/[token]/ChangeOrderApproval.js", props: { token: "co_9c2e7b1a4f" }, mode: "public", height: 1500, chapter: "help" },
  // The same job scrolled to its plan: the ordered steps with their
  // dependencies, the crew day view, and the change orders under them
  // (CO-2 out with the client, CO-1 signed).
  { slug: "job-plan", href: "/app/jobs", page: "app/app/jobs/[id]/JobDetail.js", props: { jobId: "j_318" }, scene: "scroll-plan", height: 2200, chapter: "help" },

  // ── The shell itself (2026-09-21): rail expanded and collapsed, the
  //    settings index and one settings page with the rail slid, the phone's
  //    home with its tab bar and floating Create, the More sheet, the Create
  //    sheet, the top bar with the search palette open. Unnumbered, under
  //    docs/screens/shell/, so the guide's chapter does not renumber.
  { slug: "shell-rail", href: "/app", page: "app/app/page.js", out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-rail-collapsed", href: "/app", page: "app/app/page.js", scene: "rail-collapse", out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-settings-index", href: "/app/settings", page: "app/app/settings/page.js", settings: true, out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-settings-page", href: "/app/settings/branding", page: "app/app/settings/branding/page.js", settings: true, out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-more", href: "/app/more", page: "app/app/more/page.js", out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-search", href: "/app/quotes", page: "app/app/quotes/page.js", scene: "search-open", out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-account-menu", href: "/app/quotes", page: "app/app/quotes/page.js", scene: "account-open", out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-phone-home", href: "/app", page: "app/app/page.js", width: 375, height: 812, out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-phone-more", href: "/app", page: "app/app/page.js", width: 375, height: 812, scene: "more-sheet", out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-phone-create", href: "/app", page: "app/app/page.js", width: 375, height: 812, scene: "create-sheet", out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-phone-settings", href: "/app/settings/branding", page: "app/app/settings/branding/page.js", settings: true, width: 375, height: 812, out: "docs/screens/shell", chapter: "shell" },
  { slug: "shell-phone-drawer", href: "/app", page: "app/app/page.js", width: 375, height: 812, scene: "drawer-open", out: "docs/screens/shell", chapter: "shell" },
  // The builder's tax line, worked out from the client's province
  // (docs/TAX.md), and Settings → Tax with the mode and its preview.
  { slug: "quote-tax-line", href: "/app/quotes", page: "app/app/quotes/new/page.js", scene: "quote-tax-line", height: 1100, chapter: "help" },
  { slug: "settings-tax", href: "/app/settings/company", page: "app/app/settings/company/page.js", settings: true, scene: "settings-tax", height: 1400, chapter: "help" },
  // ── The document-shaped builder (mockup b7) and the painter's first screen (b1) ──
  //
  // Appended, so nothing above renumbers. "doc-builder" in a slug flips the
  // fixture company's Company.quoteBuilderLayout to "document"; "painter"
  // switches its painting trades on (fixtures/routes-help.js). The same
  // hand-built draft Q-1045 is photographed in both layouts, desktop and
  // phone; New quote for a painting company shows the estimate-type cards
  // as the first thing on the page, in both layouts. The edit rows carry
  // the REAL route as href — usePathname() in the harness answers it, and
  // the floating + hides itself on /edit (CreateMenu.js createFabHiddenOn).
  { slug: "quote-doc-builder", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, height: 1500, chapter: "help" },
  { slug: "quote-doc-builder-mobile", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, width: 375, height: 812, chapter: "help" },
  { slug: "quote-doc-builder-cost-drawer", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "doc-cost-drawer", height: 1100, chapter: "help" },
  { slug: "quote-doc-builder-work-order", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "doc-tab-workorder", height: 1100, chapter: "help" },
  { slug: "quote-classic-builder", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, height: 1500, chapter: "help" },
  { slug: "quote-classic-builder-mobile", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, width: 375, height: 812, chapter: "help" },
  { slug: "quote-new-painter-doc-builder", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", height: 1000, chapter: "help" },
  { slug: "quote-new-painter-doc-builder-mobile", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", width: 375, height: 812, chapter: "help" },
  { slug: "quote-new-painter-classic", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", height: 1000, chapter: "help" },
  { slug: "quote-new-painter-classic-mobile", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", width: 375, height: 812, chapter: "help" },
  { slug: "quote-new-painter-doc-builder-rooms", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", scene: "painter-pick-interior", height: 1400, chapter: "help" },
  // ── Many services on one quote ──────────────────────────────────────────
  //
  // Refinishing, refacing and the countertop on one document with one total,
  // reached by tapping the tile row the document draws after the last scope
  // — the control that was a closed disclosure until 2026-09-22, which is
  // what made the owner think a quote could hold one service. The shot is
  // tall because the point is the THIRD scope and the single total under it.
  { slug: "quote-doc-builder-services", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "doc-many-services", height: 2000, chapter: "help" },
  // The site-visit photos and "what happens next", each where it is now
  // written: the uploader beside the document, the process notes inside it.
  { slug: "quote-doc-builder-photos", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "doc-photos", height: 900, chapter: "help" },
  { slug: "quote-doc-builder-process", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "doc-process-editor", height: 1700, chapter: "help" },
  // ── The quote-fix frames (2026-09-22) ──────────────────────────────────
  //
  // The owner's four reports on New quote, each photographed as the flow a
  // hand takes. Unnumbered under docs/screens/quote-fix/ so the guide does
  // not renumber. "stairs" in a slug switches Stairs on for the cabinet
  // shop; "purepainter" is a painter with no cabinet trade (routes-help.js).
  { slug: "quote-fix-doc-builder-stairs-standard", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", scene: "doc-stairs-30", height: 1700, chapter: "quote-fix", out: "docs/screens/quote-fix" },
  { slug: "quote-fix-doc-builder-stairs-moderate", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", scene: "doc-stairs-30-moderate", height: 1700, chapter: "quote-fix", out: "docs/screens/quote-fix" },
  { slug: "quote-fix-painter-doc-builder-cabinets", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", scene: "painter-pick-cabinets", height: 1500, chapter: "quote-fix", out: "docs/screens/quote-fix" },
  { slug: "quote-fix-painter-doc-builder-cabinets-moderate", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", scene: "painter-pick-cabinets-moderate", height: 1500, chapter: "quote-fix", out: "docs/screens/quote-fix" },
  { slug: "quote-fix-purepainter-doc-builder-cabinets", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", scene: "painter-pick-cabinets", height: 1100, chapter: "quote-fix", out: "docs/screens/quote-fix" },
  { slug: "quote-fix-purepainter-doc-builder-staining", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", scene: "painter-pick-staining", height: 1100, chapter: "quote-fix", out: "docs/screens/quote-fix" },
  // ── One document look (2026-09-23) ──────────────────────────────────────
  //
  // The owner's ask: edit quote = new quote = edit instant estimate = new
  // invoice = edit invoice, one document builder, with Cost & margin open
  // while building and AI review + deep read on an invoice. "doc-builder"
  // in every slug keeps the fixture company on the document layout;
  // "onelook-invoice-edit" answers a saved cost panel; "onelook-invoice-
  // review" answers a stored review and a paid deep read. Unnumbered under
  // docs/screens/one-look/. The same rows shot against the pristine
  // origin/main tree are the "before" frames (see the harness README).
  { slug: "onelook-quote-new-doc-builder", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", height: 1500, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-quote-edit-doc-builder", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, height: 1500, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-quote-edit-instant-doc-builder", href: "/app/quotes/q_1046/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1046" }, height: 1500, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-invoice-new-doc-builder", href: "/app/invoices/new", page: "app/app/invoices/new/page.js", height: 1500, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-invoice-new-job-doc-builder", href: "/app/invoices/new?jobId=j_318", page: "app/app/invoices/new/page.js", scene: "invoice-pick-client", height: 1500, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-invoice-edit-doc-builder", href: "/app/invoices/inv_2069/edit", page: "app/app/invoices/[id]/edit/page.js", params: { id: "inv_2069" }, height: 1500, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-invoice-new-classic", href: "/app/invoices/new?layout=classic", page: "app/app/invoices/new/page.js", height: 1500, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-cost-popover-doc-builder", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "cost-popover", height: 1100, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-profit-card-before-doc-builder", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "profit-card-open", height: 1100, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-profit-card-after-doc-builder", href: "/app/quotes/q_1045/edit", page: "app/app/quotes/[id]/edit/page.js", params: { id: "q_1045" }, scene: "profit-card-change", height: 1100, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-invoice-review-edit-doc-builder", href: "/app/invoices/inv_2069/edit", page: "app/app/invoices/[id]/edit/page.js", params: { id: "inv_2069" }, scene: "scroll-invoice-review", height: 1300, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-invoice-new-mobile-doc-builder", href: "/app/invoices/new", page: "app/app/invoices/new/page.js", width: 390, height: 1400, chapter: "one-look", out: "docs/screens/one-look" },
  { slug: "onelook-quote-new-mobile-doc-builder", href: "/app/quotes/new", page: "app/app/quotes/new/page.js", width: 390, height: 1400, chapter: "one-look", out: "docs/screens/one-look" },
];
