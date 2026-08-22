// app/components/tours.js
//
// First-visit walkthroughs, keyed by the page they run on. AppTours (below,
// mounted once in the app layout) watches the pathname, and the first time a
// user lands on a matching page it opens the tour — then records it as seen,
// per-user, server-side, so it never nags twice.
//
// ── Adding a page tour ──────────────────────────────────────────────────────
// 1. Put `data-tour="some-anchor"` on the element(s) you want to point at.
// 2. Add an entry here: a unique `key` (bump the -vN suffix to re-show a
//    changed tour to everyone), a `match(pathname)` predicate, and `steps`.
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
        // Leads on screen — in all six languages — and the tour was reading
        // the internal message KEY (`app.nav.requests`) instead. A tour that
        // names a menu item something the menu doesn't say sends someone
        // hunting for a page that isn't there, on their first minute in the
        // product.
        title: "Leads land here",
        body: "Every enquiry from your website, booking link or instant estimate shows up in Leads. Start of the pipeline.",
      },
      {
        target: "[data-tour='nav-quotes']",
        openWith: "[data-tour-open='nav']",
        closeWith: "[data-tour-close='nav']",
        title: "Turn them into quotes",
        body: "Build a branded quote, send it, and get it approved and paid — all from here.",
      },
      {
        target: "[data-tour='nav-estimate-reviews']",
        openWith: "[data-tour-open='nav']",
        closeWith: "[data-tour-close='nav']",
        title: "Instant estimates to approve",
        body: "When a homeowner gets an instant price from your site, it lands here for you to confirm before it's binding.",
      },
      {
        target: "[data-tour='nav-ai']",
        openWith: "[data-tour-open='nav']",
        closeWith: "[data-tour-close='nav']",
        title: "Ask FieldQuo AI",
        body: "Questions about your own numbers — “what did I quote the Bergerons?” — answered from your data.",
      },
      {
        target: "[data-tour='nav-settings']",
        openWith: "[data-tour-open='nav']",
        closeWith: "[data-tour-close='nav']",
        title: "Set up your business",
        body: "Branding, services, pricing, payments and your instant-quote rates all live in Settings. Worth 10 minutes up front.",
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
        title: "Leads are scored for you",
        body: "Every lead is triaged hot, warm or cold from what they told you — budget, timeline, urgency. Filter to the ones ready to buy.",
      },
      {
        target: "[data-tour='leads-search']",
        title: "Find anyone fast",
        body: "Search by name, email or phone across your whole pipeline.",
      },
      {
        target: "[data-tour='leads-sort']",
        title: "Hottest first — then dig in",
        body: "Sort so the ready-to-go leads rise to the top. Click any lead to open its detail: the score and why, assign an owner, log a call-back, and Convert to quote in one tap.",
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
        title: "Build a lead funnel",
        body: "A mobile quiz for your ads and link-in-bio. Start from a TikTok, Instagram, YouTube or Web template — or describe it and let AI build it from your services. Every finished funnel drops a scored lead into your pipeline.",
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
        title: "Your steps",
        body: "Each step is one full-screen question or screen. Add, reorder or delete them here, then edit the selected step in the middle — with a live preview beside you.",
      },
      {
        target: "[data-tour='funnel-publish']",
        title: "Publish and share",
        body: "When it's ready, Publish — then copy the link onto your ad, bio or a QR code. You can't publish without a contact step, so a funnel never goes live collecting nothing.",
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
        title: "Charge for a visit",
        body: "Set a visit fee (with an optional promo price) to collect by card at booking — through your own Stripe. Later, credit it back onto the client's invoice in one tap if they hire you.",
      },
    ],
  },
  {
    key: "quotes-v1",
    match: (p) => p === "/app/quotes",
    steps: [
      { target: "[data-tour='quotes-new']", title: "Build a quote", body: "Start a new branded quote for a client — pick services, set pricing, then send it to get approved and paid." },
      { target: "[data-tour='quotes-stats']", title: "Track the pipeline", body: "See at a glance how many quotes are draft, sent and accepted." },
      { target: "[data-tour='quotes-search']", title: "Find any quote", body: "Search by quote number or client name across everything you've sent." },
    ],
  },
  {
    key: "quote-new-v1",
    match: (p) => p === "/app/quotes/new",
    steps: [
      { target: "[data-tour='client-picker']", title: "Pick the client", body: "Choose an existing client or add a new one — the quote and its emails go to them." },
      { target: "[data-tour='service-picker']", title: "Add your services", body: "Tap the services you're quoting; each drops in priced line items you can fine-tune." },
      { target: "[data-tour='totals']", title: "Review and send", body: "Check the total, then save as a draft or send it to the client for approval." },
    ],
  },
  {
    key: "estimate-reviews-v1",
    match: (p) => p === "/app/estimate-reviews",
    steps: [
      { target: "[data-tour='reviews-header']", title: "Approve instant estimates", body: "Prices your website quoted a homeowner land here first — confirm or adjust the figure before the quote can be sent." },
    ],
  },
  {
    key: "jobs-v1",
    match: (p) => p === "/app/jobs",
    steps: [
      { target: "[data-tour='jobs-filters']", title: "Work you've won", body: "Jobs are scheduled work for a client — many appear automatically when a quote is accepted. Filter by status to see what needs a date or what's in progress." },
      { target: "[data-tour='jobs-new']", title: "Add a job", body: "Create a job by hand when the work didn't come from a quote." },
      { target: "[data-tour='jobs-search']", title: "Find a job", body: "Search by job title or client name." },
    ],
  },
  {
    key: "job-builder-v1",
    match: (p) => p.startsWith("/app/jobs/") && p !== "/app/jobs/new" && p.split("/").length === 4,
    steps: [
      { target: "[data-tour='job-status']", title: "Move the job along", body: "Update the status as work progresses — from needs-a-date through to completed." },
      { target: "[data-tour='job-client']", title: "Everything for the crew", body: "Client name, phone and a tap-to-navigate address — what someone needs before they set off." },
      { target: "[data-tour='job-visits']", title: "Schedule the visits", body: "A job is done across one or more visits, each with its own date, assignee, checklist and photos. Add them here." },
    ],
  },
  {
    key: "invoices-v1",
    match: (p) => p === "/app/invoices",
    steps: [
      { target: "[data-tour='invoices-new']", title: "Bill for completed work", body: "Raise an invoice for a client, then send it and collect payment." },
      { target: "[data-tour='invoices-stats']", title: "Know what you're owed", body: "Total billed, what's been paid, and what's still outstanding — always in view." },
      { target: "[data-tour='invoices-search']", title: "Find an invoice", body: "Search by invoice number or client name." },
    ],
  },
  {
    key: "invoice-new-v1",
    match: (p) => p === "/app/invoices/new",
    steps: [
      { target: "[data-tour='invoice-client']", title: "Who's being billed", body: "Search and pick the client this invoice goes to." },
      { target: "[data-tour='invoice-items']", title: "List the work", body: "Add a line per item with quantity and rate; the totals add up as you go." },
      { target: "[data-tour='invoice-save']", title: "Save or send", body: "Save it as a draft, or send it to email the invoice straight to the client." },
    ],
  },
  {
    key: "appointments-v1",
    match: (p) => p === "/app/appointments",
    steps: [
      { target: "[data-tour='appts-new']", title: "Book a visit", body: "Add an appointment with a client, a time and a site address, and assign it to someone." },
      { target: "[data-tour='appts-filters']", title: "See what's coming", body: "Appointments list in time order with drive times between stops; filter by status to focus." },
    ],
  },
  {
    key: "tasks-v1",
    match: (p) => p === "/app/tasks",
    steps: [
      { target: "[data-tour='tasks-new']", title: "Your team's to-do list", body: "Tasks are internal reminders — follow up a client, order material, chase a deposit. Unlike a job, they're not scheduled work at a site." },
      { target: "[data-tour='tasks-showdone']", title: "Nothing slips", body: "Overdue and high-priority tasks rise to the top; flip this to review what's already done." },
    ],
  },
  {
    key: "marketing-v1",
    match: (p) => p === "/app/marketing",
    steps: [
      { target: "[data-tour='marketing-new']", title: "Run a campaign", body: "Track pamphlet drops, paid ads or an email blast — each with its own budget and progress." },
      { target: "[data-tour='marketing-subscribers']", title: "Your audience", body: "Manage the contacts your email campaigns go out to." },
    ],
  },
  {
    key: "availability-v1",
    match: (p) => p === "/app/settings/availability",
    steps: [
      { target: "[data-tour='avail-working']", title: "Your shift", body: "Working hours are when you're on the clock — used for scheduling and timesheets, never shown to clients." },
      { target: "[data-tour='avail-bookable']", title: "When clients can book you", body: "Bookable hours are the public window on your booking page — usually narrower than your shift." },
    ],
  },
  {
    key: "scheduler-v1",
    match: (p) => p === "/app/scheduler",
    steps: [
      { target: "[data-tour='scheduler-week']", title: "Plan the week", body: "This is staff shift scheduling — step through the week to see who's rostered each day." },
      { target: "[data-tour='scheduler-add']", title: "Draft, then publish", body: "Add shifts as drafts, then Publish so your team can see them — nothing shows to a worker until you do." },
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
      { target: "[data-tour='schedule-header']", title: "The team at a glance", body: "Everyone's weekly hours and what's booked in the next two weeks. People set their own under Settings → Availability, and you can set anyone's from here." },
    ],
  },
  {
    key: "expense-tracking-v1",
    match: (p) => p === "/app/settings/expense-tracking",
    steps: [
      { target: "[data-tour='expense-add']", title: "Log what you spend", body: "Record an expense and tag it to a job, to overhead, or as general spend." },
      { target: "[data-tour='expense-kpis']", title: "Burn and runway", body: "See this month's spend, your monthly burn rate and how many months of runway that leaves." },
      { target: "[data-tour='expense-ai']", title: "Ask for a read-out", body: "Generate a plain-English summary that flags anything unusual in your spending." },
    ],
  },
  {
    key: "payroll-v1",
    match: (p) => p === "/app/payroll",
    steps: [
      { target: "[data-tour='payroll-header']", title: "Payslips and pay runs", body: "FieldQuo works out pay from approved hours and your saved rates — you still move the money yourself." },
      { target: "[data-tour='payroll-run']", title: "Run a period", body: "Pick the dates and calculate; only approved timesheets are included, so approve hours first." },
    ],
  },
  {
    key: "time-off-v1",
    match: (p) => p === "/app/time-off",
    steps: [
      { target: "[data-tour='timeoff-header']", title: "Book and track time off", body: "See your balances, request vacation or sick days, and — if you manage people — approve theirs from the Team tab." },
    ],
  },
  {
    key: "timesheets-v1",
    match: (p) => p === "/app/settings/team/timesheets",
    steps: [
      { target: "[data-tour='timesheets-header']", title: "Hours worked", body: "Every clock-in and manual entry lands here for you to review before it's paid." },
      { target: "[data-tour='timesheets-add']", title: "Add hours by hand", body: "Log time after the fact — pick the worker, the date and the start and end times." },
      { target: "[data-tour='timesheets-list']", title: "Approve before payroll", body: "Clock out open entries and approve hours; only approved time flows into a pay run." },
    ],
  },
  {
    key: "voice-v1",
    match: (p) => p === "/app/settings/voice",
    steps: [
      { target: "[data-tour='voice-number']", title: "A number to answer on", body: "Get a new number or forward your own — this is what the AI receptionist picks up." },
      { target: "[data-tour='voice-credit']", title: "Pay per minute", body: "Calls draw down prepaid credit — your 30 free trial minutes are already loaded. Top up here to keep the line live." },
      { target: "[data-tour='voice-answer']", title: "Turn it on", body: "Once you've got a number and credit, switch the receptionist on to start catching missed calls." },
    ],
  },
  {
    key: "payments-v1",
    match: (p) => p === "/app/settings/payments",
    steps: [
      { target: "[data-tour='payments-header']", title: "Get paid by card", body: "Connect a payment provider so clients can pay quotes and invoices online." },
      { target: "[data-tour='payments-stripe']", title: "Connect Stripe", body: "FieldQuo uses your own Stripe account — finish the connection here and the status shows once you're live." },
    ],
  },
];

export function tourForPath(pathname) {
  return TOURS.find((t) => t.match(pathname)) || null;
}
