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
        title: "Requests land here",
        body: "Every enquiry from your website, booking link or instant estimate shows up in Requests. Start of the pipeline.",
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
];

export function tourForPath(pathname) {
  return TOURS.find((t) => t.match(pathname)) || null;
}
