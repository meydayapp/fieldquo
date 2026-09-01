// app/components/tours.js
//
// First-visit walkthroughs, keyed by the page they run on. AppTours (below,
// mounted once in the app layout) watches the pathname, and the first time a
// user lands on a matching page it opens the tour — then records it as seen,
// per-user, server-side, so it never nags twice.
//
// ── Every string here is a translation key, not English text ───────────────
//
// `titleKey` / `bodyKey` name an entry in app/i18n/appMessages.js (the
// "app.tour.*" namespace); OnboardingTour.js resolves them with t() at
// RENDER time. They can't be resolved here: this module is plain data with no
// React tree, imported by scripts/check-translations.mjs under bare node, and
// t() needs the LanguageProvider context that only exists once this array is
// consumed inside a component. Baking English sentences into this array — as
// it used to do — means every account reads the tour in English regardless of
// what language they picked, which is exactly the bug this shape fixes: the
// six languages FieldQuo ships (app/i18n/languages.js) are pointless on the
// very first thing a new contractor sees if the walkthrough that greets them
// ignores all of it.
//
// ── Adding a page tour ──────────────────────────────────────────────────────
// 1. Put `data-tour="some-anchor"` on the element(s) you want to point at.
// 2. Add an entry here: a unique `key` (bump the -vN suffix to re-show a
//    changed tour to everyone), a `match(pathname)` predicate, and `steps`.
// 3. Add `app.tour.<tourSlug>.<stepSlug>Title` / `...Body` to app/i18n/
//    appMessages.js for at least English and French — `npm run
//    check:translations` fails the build on a missing English or French key,
//    same bar as every other app string. The other four languages are
//    strongly preferred (see that file's header for why they're reported,
//    not gated) — a contractor who picked Spanish for their first-run tour
//    and got half of it in English is a worse first minute than one who
//    never got a tour at all.
// Nothing else to wire — the anchor just has to exist when the page renders.
//
// ── Targets that live behind a drawer ───────────────────────────────────────
// On a phone the sidebar is a drawer that starts closed, and the desktop copy
// is `display:none` rather than unmounted — so a naive lookup finds a
// zero-size element and the spotlight lands in the corner. A step declares
// `openWith` (a selector for the control that reveals its target) and
// `closeWith` (how to put it back), and the tour handles the rest. On desktop
// the target is already visible, so neither is used.
//
// The welcome tour points at the sidebar, which is on every /app page, so it's
// reliable regardless of what the dashboard itself is showing.

export const TOURS = [
  {
    key: "welcome-v1",
    match: (p) => p === "/app",
    steps: [
      {
        target: "[data-tour='nav-requests']",
        openWith: "[data-tour-open='nav']",
        closeWith: "[data-tour-close='nav']",
        // "Leads", not "Requests". The nav item this points at is labelled
        // Leads on screen — in all six languages (app.nav.requests) — and the
        // tour was reading the internal message KEY instead. A tour that
        // names a menu item something the menu doesn't say sends someone
        // hunting for a page that isn't there, on their first minute in the
        // product. The trap generalises past English: a title/body pulled
        // from app.nav.requests's ENGLISH string would have been "Leads" in
        // every language, printing an English word on a Ukrainian or Punjabi
        // first run. Each language below names its OWN nav label
        // (app.nav.requests's translation in that language), checked against
        // the actual sidebar string, not transliterated from this comment.
        titleKey: "app.tour.welcome.leadsTitle",
        bodyKey: "app.tour.welcome.leadsBody",
      },
      {
        target: "[data-tour='nav-quotes']",
        openWith: "[data-tour-open='nav']",
        closeWith: "[data-tour-close='nav']",
        titleKey: "app.tour.welcome.quotesTitle",
        bodyKey: "app.tour.welcome.quotesBody",
      },
      {
        target: "[data-tour='nav-estimate-reviews']",
        openWith: "[data-tour-open='nav']",
        closeWith: "[data-tour-close='nav']",
        titleKey: "app.tour.welcome.estimateReviewsTitle",
        bodyKey: "app.tour.welcome.estimateReviewsBody",
      },
      {
        target: "[data-tour='nav-ai']",
        openWith: "[data-tour-open='nav']",
        closeWith: "[data-tour-close='nav']",
        titleKey: "app.tour.welcome.aiTitle",
        bodyKey: "app.tour.welcome.aiBody",
      },
      {
        target: "[data-tour='nav-settings']",
        openWith: "[data-tour-open='nav']",
        closeWith: "[data-tour-close='nav']",
        titleKey: "app.tour.welcome.settingsTitle",
        bodyKey: "app.tour.welcome.settingsBody",
      },
    ],
  },

  // ── Leads triage ─────────────────────────────────────────────────────────
  // All targets are toolbar controls that always render, so the tour is
  // reliable even before any leads have arrived.
  {
    key: "leads-v1",
    match: (p) => p === "/app/leads",
    steps: [
      {
        target: "[data-tour='leads-temp']",
        titleKey: "app.tour.leads.tempTitle",
        bodyKey: "app.tour.leads.tempBody",
      },
      {
        target: "[data-tour='leads-search']",
        titleKey: "app.tour.leads.searchTitle",
        bodyKey: "app.tour.leads.searchBody",
      },
      {
        target: "[data-tour='leads-sort']",
        // The body now also names drag-to-move (dnd-kit, LeadCard's own drag
        // handle — see app.leads.dragHandle): the board has supported it for
        // a while and the tour never mentioned it. No new anchor needed —
        // this step already sits on the toolbar next to the board it
        // describes, so the extra sentence attaches to an anchor that exists.
        titleKey: "app.tour.leads.sortTitle",
        bodyKey: "app.tour.leads.sortBody",
      },
    ],
  },

  // ── Funnels list ─────────────────────────────────────────────────────────
  {
    key: "funnels-v1",
    match: (p) => p === "/app/funnels",
    steps: [
      {
        target: "[data-tour='funnels-new']",
        titleKey: "app.tour.funnels.newTitle",
        bodyKey: "app.tour.funnels.newBody",
      },
    ],
  },

  // ── Funnel builder ───────────────────────────────────────────────────────
  // Runs on the per-funnel editor (/app/funnels/<id>). Targets appear once the
  // funnel loads; if the fetch is slow the tour simply waits for next visit.
  {
    key: "funnel-builder-v1",
    match: (p) => p.startsWith("/app/funnels/") && p !== "/app/funnels",
    steps: [
      {
        target: "[data-tour='funnel-steps']",
        titleKey: "app.tour.funnelBuilder.stepsTitle",
        bodyKey: "app.tour.funnelBuilder.stepsBody",
      },
      {
        target: "[data-tour='funnel-publish']",
        titleKey: "app.tour.funnelBuilder.publishTitle",
        bodyKey: "app.tour.funnelBuilder.publishBody",
      },
    ],
  },

  // ── Paid visit fees (booking page settings) ──────────────────────────────
  {
    key: "booking-fee-v1",
    match: (p) => p === "/app/settings/booking-page",
    steps: [
      {
        target: "[data-tour='booking-fee']",
        titleKey: "app.tour.bookingFee.feeTitle",
        bodyKey: "app.tour.bookingFee.feeBody",
      },
    ],
  },
  {
    key: "quotes-v1",
    match: (p) => p === "/app/quotes",
    steps: [
      { target: "[data-tour='quotes-new']", titleKey: "app.tour.quotes.newTitle", bodyKey: "app.tour.quotes.newBody" },
      { target: "[data-tour='quotes-stats']", titleKey: "app.tour.quotes.statsTitle", bodyKey: "app.tour.quotes.statsBody" },
      { target: "[data-tour='quotes-search']", titleKey: "app.tour.quotes.searchTitle", bodyKey: "app.tour.quotes.searchBody" },
    ],
  },
  {
    key: "quote-new-v1",
    match: (p) => p === "/app/quotes/new",
    steps: [
      { target: "[data-tour='client-picker']", titleKey: "app.tour.quoteNew.clientTitle", bodyKey: "app.tour.quoteNew.clientBody" },
      { target: "[data-tour='service-picker']", titleKey: "app.tour.quoteNew.serviceTitle", bodyKey: "app.tour.quoteNew.serviceBody" },
      { target: "[data-tour='totals']", titleKey: "app.tour.quoteNew.totalsTitle", bodyKey: "app.tour.quoteNew.totalsBody" },
    ],
  },
  {
    key: "estimate-reviews-v1",
    match: (p) => p === "/app/estimate-reviews",
    steps: [
      { target: "[data-tour='reviews-header']", titleKey: "app.tour.estimateReviews.headerTitle", bodyKey: "app.tour.estimateReviews.headerBody" },
    ],
  },
  {
    key: "jobs-v1",
    match: (p) => p === "/app/jobs",
    steps: [
      { target: "[data-tour='jobs-filters']", titleKey: "app.tour.jobs.filtersTitle", bodyKey: "app.tour.jobs.filtersBody" },
      { target: "[data-tour='jobs-new']", titleKey: "app.tour.jobs.newTitle", bodyKey: "app.tour.jobs.newBody" },
      { target: "[data-tour='jobs-search']", titleKey: "app.tour.jobs.searchTitle", bodyKey: "app.tour.jobs.searchBody" },
    ],
  },
  {
    key: "job-builder-v2",
    match: (p) => p.startsWith("/app/jobs/") && p !== "/app/jobs/new" && p.split("/").length === 4,
    steps: [
      { target: "[data-tour='job-status']", titleKey: "app.tour.jobBuilder.statusTitle", bodyKey: "app.tour.jobBuilder.statusBody" },
      { target: "[data-tour='job-client']", titleKey: "app.tour.jobBuilder.clientTitle", bodyKey: "app.tour.jobBuilder.clientBody" },
      { target: "[data-tour='job-visits']", titleKey: "app.tour.jobBuilder.visitsTitle", bodyKey: "app.tour.jobBuilder.visitsBody" },
      // New: JobCosting/JobMaterials/JobTasks (rendered just above job-visits
      // in JobDetail.js) all `return null` on a job with nothing recorded yet
      // — see JobDetail.js's own comments on each. A brand-new job is exactly
      // that empty state, so none of the three is a safe spotlight target
      // (AGENTS.md: "a panel that returns null when empty is not a reliable
      // anchor"). JobPhotoTimeline, just below the visits list, was rebuilt to
      // render even with zero photos (its own header explains why — a
      // contractor who never uses crew SMS used to see no panel at all), so
      // it's the one addition on this page that's guaranteed to be there.
      { target: "[data-tour='job-photos']", titleKey: "app.tour.jobBuilder.photosTitle", bodyKey: "app.tour.jobBuilder.photosBody" },
    ],
  },
  {
    key: "invoices-v1",
    match: (p) => p === "/app/invoices",
    steps: [
      { target: "[data-tour='invoices-new']", titleKey: "app.tour.invoices.newTitle", bodyKey: "app.tour.invoices.newBody" },
      { target: "[data-tour='invoices-stats']", titleKey: "app.tour.invoices.statsTitle", bodyKey: "app.tour.invoices.statsBody" },
      { target: "[data-tour='invoices-search']", titleKey: "app.tour.invoices.searchTitle", bodyKey: "app.tour.invoices.searchBody" },
    ],
  },
  {
    key: "invoice-new-v1",
    match: (p) => p === "/app/invoices/new",
    steps: [
      { target: "[data-tour='invoice-client']", titleKey: "app.tour.invoiceNew.clientTitle", bodyKey: "app.tour.invoiceNew.clientBody" },
      { target: "[data-tour='invoice-items']", titleKey: "app.tour.invoiceNew.itemsTitle", bodyKey: "app.tour.invoiceNew.itemsBody" },
      { target: "[data-tour='invoice-save']", titleKey: "app.tour.invoiceNew.saveTitle", bodyKey: "app.tour.invoiceNew.saveBody" },
    ],
  },
  {
    key: "appointments-v1",
    match: (p) => p === "/app/appointments",
    steps: [
      { target: "[data-tour='appts-new']", titleKey: "app.tour.appointments.newTitle", bodyKey: "app.tour.appointments.newBody" },
      { target: "[data-tour='appts-filters']", titleKey: "app.tour.appointments.filtersTitle", bodyKey: "app.tour.appointments.filtersBody" },
    ],
  },
  {
    key: "tasks-v1",
    match: (p) => p === "/app/tasks",
    steps: [
      { target: "[data-tour='tasks-new']", titleKey: "app.tour.tasks.newTitle", bodyKey: "app.tour.tasks.newBody" },
      { target: "[data-tour='tasks-showdone']", titleKey: "app.tour.tasks.showDoneTitle", bodyKey: "app.tour.tasks.showDoneBody" },
    ],
  },
  {
    key: "marketing-v1",
    match: (p) => p === "/app/marketing",
    steps: [
      { target: "[data-tour='marketing-new']", titleKey: "app.tour.marketing.newTitle", bodyKey: "app.tour.marketing.newBody" },
      { target: "[data-tour='marketing-subscribers']", titleKey: "app.tour.marketing.subscribersTitle", bodyKey: "app.tour.marketing.subscribersBody" },
    ],
  },
  {
    key: "availability-v1",
    match: (p) => p === "/app/settings/availability",
    steps: [
      { target: "[data-tour='avail-working']", titleKey: "app.tour.availability.workingTitle", bodyKey: "app.tour.availability.workingBody" },
      { target: "[data-tour='avail-bookable']", titleKey: "app.tour.availability.bookableTitle", bodyKey: "app.tour.availability.bookableBody" },
    ],
  },
  {
    key: "scheduler-v1",
    match: (p) => p === "/app/scheduler",
    steps: [
      { target: "[data-tour='scheduler-week']", titleKey: "app.tour.scheduler.weekTitle", bodyKey: "app.tour.scheduler.weekBody" },
      { target: "[data-tour='scheduler-add']", titleKey: "app.tour.scheduler.addTitle", bodyKey: "app.tour.scheduler.addBody" },
    ],
  },
  {
    key: "schedule-v1",
    match: (p) => p === "/app/schedule",
    steps: [
      // Not read-only, and hasn't been for a while: the page header on the same
      // screen says "and you can set anyone's from here", and every row carries
      // a working Edit hours button. A coach-mark that contradicts the buttons
      // beside it teaches people to stop reading coach-marks.
      { target: "[data-tour='schedule-header']", titleKey: "app.tour.schedule.headerTitle", bodyKey: "app.tour.schedule.headerBody" },
    ],
  },
  {
    key: "expense-tracking-v1",
    match: (p) => p === "/app/settings/expense-tracking",
    steps: [
      { target: "[data-tour='expense-add']", titleKey: "app.tour.expenseTracking.addTitle", bodyKey: "app.tour.expenseTracking.addBody" },
      { target: "[data-tour='expense-kpis']", titleKey: "app.tour.expenseTracking.kpisTitle", bodyKey: "app.tour.expenseTracking.kpisBody" },
      { target: "[data-tour='expense-ai']", titleKey: "app.tour.expenseTracking.aiTitle", bodyKey: "app.tour.expenseTracking.aiBody" },
    ],
  },
  {
    key: "payroll-v1",
    match: (p) => p === "/app/payroll",
    steps: [
      { target: "[data-tour='payroll-header']", titleKey: "app.tour.payroll.headerTitle", bodyKey: "app.tour.payroll.headerBody" },
      { target: "[data-tour='payroll-run']", titleKey: "app.tour.payroll.runTitle", bodyKey: "app.tour.payroll.runBody" },
    ],
  },
  {
    key: "time-off-v1",
    match: (p) => p === "/app/time-off",
    steps: [
      { target: "[data-tour='timeoff-header']", titleKey: "app.tour.timeOff.headerTitle", bodyKey: "app.tour.timeOff.headerBody" },
    ],
  },
  {
    key: "timesheets-v1",
    match: (p) => p === "/app/settings/team/timesheets",
    steps: [
      { target: "[data-tour='timesheets-header']", titleKey: "app.tour.timesheets.headerTitle", bodyKey: "app.tour.timesheets.headerBody" },
      { target: "[data-tour='timesheets-add']", titleKey: "app.tour.timesheets.addTitle", bodyKey: "app.tour.timesheets.addBody" },
      { target: "[data-tour='timesheets-list']", titleKey: "app.tour.timesheets.listTitle", bodyKey: "app.tour.timesheets.listBody" },
    ],
  },
  {
    key: "voice-v1",
    match: (p) => p === "/app/settings/voice",
    steps: [
      { target: "[data-tour='voice-number']", titleKey: "app.tour.voice.numberTitle", bodyKey: "app.tour.voice.numberBody" },
      { target: "[data-tour='voice-credit']", titleKey: "app.tour.voice.creditTitle", bodyKey: "app.tour.voice.creditBody" },
      { target: "[data-tour='voice-answer']", titleKey: "app.tour.voice.answerTitle", bodyKey: "app.tour.voice.answerBody" },
    ],
  },
  {
    key: "payments-v1",
    match: (p) => p === "/app/settings/payments",
    steps: [
      { target: "[data-tour='payments-header']", titleKey: "app.tour.payments.headerTitle", bodyKey: "app.tour.payments.headerBody" },
      { target: "[data-tour='payments-stripe']", titleKey: "app.tour.payments.stripeTitle", bodyKey: "app.tour.payments.stripeBody" },
    ],
  },

  // ═══ Added for features that had a page and no tour (docs/health/10-tour.md) ═══
  //
  // Every anchor below is new too — see docs/TOUR-COVERAGE.md for the full
  // table of what was added where, what was deliberately left alone, and what
  // could not be verified (no browser in this session).

  // ── AI receptionist call log ─────────────────────────────────────────────
  // Ranked highest by the owner: the most expensive thing a contractor can
  // switch on, and this is where the payoff (or the bill) is actually
  // checked. Setting the receptionist UP is voice-v1, above; this is the
  // page where a contractor comes back to see what it did.
  {
    key: "receptionist-v1",
    match: (p) => p === "/app/receptionist",
    steps: [
      { target: "[data-tour='receptionist-header']", titleKey: "app.tour.receptionist.logTitle", bodyKey: "app.tour.receptionist.logBody" },
      { target: "[data-tour='receptionist-settings']", titleKey: "app.tour.receptionist.settingsTitle", bodyKey: "app.tour.receptionist.settingsBody" },
    ],
  },

  // ── AI credit & top-ups ──────────────────────────────────────────────────
  // Two wallets, never merged (see the page's own header on why). Both Card
  // sections always render once the page loads — a zero balance still shows
  // the card, just with "$0.00" — so both are safe anchors even for an
  // account that has never spent a cent.
  {
    key: "ai-credit-v1",
    match: (p) => p === "/app/settings/ai-credit",
    steps: [
      { target: "[data-tour='ai-credit-voice']", titleKey: "app.tour.aiCredit.voiceTitle", bodyKey: "app.tour.aiCredit.voiceBody" },
      { target: "[data-tour='ai-credit-ai']", titleKey: "app.tour.aiCredit.imageTitle", bodyKey: "app.tour.aiCredit.imageBody" },
    ],
  },

  // ── Marketing Designer ───────────────────────────────────────────────────
  // Two separate tours, same shape as funnels-v1 / funnel-builder-v1 above:
  // an index (pick or start a campaign) and the per-design canvas editor,
  // because they're two different routes with two different jobs.
  {
    key: "marketing-designer-v1",
    match: (p) => p === "/app/marketing/designer",
    steps: [
      { target: "[data-tour='designer-new-campaign']", titleKey: "app.tour.designer.newCampaignTitle", bodyKey: "app.tour.designer.newCampaignBody" },
    ],
  },
  {
    key: "marketing-designer-editor-v1",
    match: (p) => p.startsWith("/app/marketing/designer/") && p !== "/app/marketing/designer",
    steps: [
      { target: "[data-tour='designer-ratios']", titleKey: "app.tour.designerEditor.ratiosTitle", bodyKey: "app.tour.designerEditor.ratiosBody" },
      { target: "[data-tour='designer-download']", titleKey: "app.tour.designerEditor.downloadTitle", bodyKey: "app.tour.designerEditor.downloadBody" },
    ],
  },

  // ── KPI dashboard ─────────────────────────────────────────────────────────
  // Fifteen charts, and no attempt here to walk every one of them — that's
  // the nagging AGENTS.md warns against. Two steps: the control that governs
  // every card on the page, and the one section whose whole point is a
  // philosophy (no invented numbers) rather than a figure to read.
  {
    key: "kpis-v1",
    match: (p) => p === "/app/analytics/kpis",
    steps: [
      { target: "[data-tour='kpis-period']", titleKey: "app.tour.kpis.periodTitle", bodyKey: "app.tour.kpis.periodBody" },
      { target: "[data-tour='kpis-not-tracked']", titleKey: "app.tour.kpis.notTrackedTitle", bodyKey: "app.tour.kpis.notTrackedBody" },
    ],
  },

  // ── Website builder ──────────────────────────────────────────────────────
  // Only the "already has a site" half of Builder.js has a stable anchor —
  // see docs/TOUR-COVERAGE.md for why the first-run prompt screen (a
  // completely different render tree) isn't touched here.
  {
    key: "website-v1",
    match: (p) => p === "/app/settings/website",
    steps: [
      { target: "[data-tour='website-publish']", titleKey: "app.tour.website.publishTitle", bodyKey: "app.tour.website.publishBody" },
    ],
  },

  // ── Crew inbox ────────────────────────────────────────────────────────────
  // The setup panel above the message list can return null for a member
  // without access to it (see SetupPanel's own comment), so the one anchor
  // that's always there for anyone who can open the page at all is the page
  // header.
  {
    key: "crew-inbox-v1",
    match: (p) => p === "/app/crew-inbox",
    steps: [
      { target: "[data-tour='crew-inbox-header']", titleKey: "app.tour.crewInbox.headerTitle", bodyKey: "app.tour.crewInbox.headerBody" },
    ],
  },

  // ── Service plans ────────────────────────────────────────────────────────
  {
    key: "plans-v1",
    match: (p) => p === "/app/plans",
    steps: [
      { target: "[data-tour='plans-new']", titleKey: "app.tour.plans.newTitle", bodyKey: "app.tour.plans.newBody" },
    ],
  },

  // ── Refer & Earn ──────────────────────────────────────────────────────────
  {
    key: "refer-v1",
    match: (p) => p === "/app/settings/refer",
    steps: [
      { target: "[data-tour='refer-link']", titleKey: "app.tour.refer.linkTitle", bodyKey: "app.tour.refer.linkBody" },
    ],
  },
];

export function tourForPath(pathname) {
  return TOURS.find((t) => t.match(pathname)) || null;
}
