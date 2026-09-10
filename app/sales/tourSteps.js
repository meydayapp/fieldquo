// app/sales/tourSteps.js
//
// The guided tour of the sales portal, as data: what a new rep is told, and
// which control on screen each thing is about.
//
// ══ Why this is data and not JSX ══════════════════════════════════════════
//
// Two reasons, and the second is the one that made it a file.
//
// First, the same reason app/components/tours.js gives: a module with no React
// in it can be imported by a check script under bare node, so the list can be
// asserted rather than read and agreed with.
//
// Second, and specific to THIS tour: it is teaching. A step that names a tab
// the portal does not have sends a new hire hunting for a screen that is not
// there, on their first morning, while they are being told this is how the job
// works. That is "never ship a control that appears to work and doesn't" in
// its worst form, because the person reading it has no way to know the product
// is wrong rather than them. The portal grew four tabs in the last fortnight —
// Voicemail, Support, Pay and Demo — and a tour written against last month's
// nav would already be lying. So every step names its target as a ROUTE plus
// the LABEL that route's tab actually renders, and scripts/check-sales-tour.mjs
// reads app/sales/SalesShell.js and fails if either has moved.
//
// ══ Naming the tab by the word on screen, not by the key ══════════════════
//
// SalesShell's tabs are a deliberate mix: five carry t() keys because the
// screen behind them is translated, and seven are English literals because the
// screen behind them is not (docs/sales-intel/STATUS.md records that split).
// A step therefore declares EITHER `tabLabelKey` or `tabLabel`, matching how
// the shell draws that tab — never both, never a guess.
//
// This is the trap app/components/tours.js hit and documented: its welcome
// tour pointed at the Leads item and called it "Requests", because somebody
// read the message KEY instead of the rendered string. Here the check compares
// against the shell's source, so a tab renamed in one place and not the other
// is a failure rather than a rep hunting for a word that is not on screen.
//
// ══ Every string is a key ═════════════════════════════════════════════════
//
// `titleKey` / `bodyKey` name entries in the "app.salesTour.*" namespace of
// app/i18n/appMessages.js. They cannot be resolved here — this module has no
// React tree and t() needs the LanguageProvider context — so SalesTour.js
// resolves them at render time. The owner's ask was explicitly "in the
// language they select when they create the account", and an English sentence
// typed into this array is how that quietly stops being true for everyone.
// The check refuses any value that is not a resolvable app.salesTour.* key.

/**
 * The steps, in the order a rep meets them.
 *
 * The order is a working day, not the tab order: claim, research, ring,
 * handle what comes back, then the screens that support that, then the two
 * settings screens. Steps 2–6 all target the queue because the queue is where
 * five separate things a rep must understand actually happen — splitting them
 * across five tabs would be tidier and would teach less.
 */
export const SALES_TOUR_STEPS = Object.freeze([
  {
    key: "today",
    href: "/sales",
    tabLabel: "Today",
    titleKey: "app.salesTour.todayTitle",
    bodyKey: "app.salesTour.todayBody",
  },
  {
    key: "queue",
    href: "/sales/queue",
    tabLabelKey: "app.salesPortal.navQueue",
    titleKey: "app.salesTour.queueTitle",
    bodyKey: "app.salesTour.queueBody",
  },
  {
    key: "research",
    href: "/sales/queue",
    tabLabelKey: "app.salesPortal.navQueue",
    titleKey: "app.salesTour.researchTitle",
    bodyKey: "app.salesTour.researchBody",
  },
  {
    key: "calling",
    href: "/sales/queue",
    tabLabelKey: "app.salesPortal.navQueue",
    titleKey: "app.salesTour.callingTitle",
    bodyKey: "app.salesTour.callingBody",
  },
  {
    key: "optOut",
    href: "/sales/queue",
    tabLabelKey: "app.salesPortal.navQueue",
    titleKey: "app.salesTour.optOutTitle",
    bodyKey: "app.salesTour.optOutBody",
  },
  {
    key: "workAsLead",
    href: "/sales/queue",
    tabLabelKey: "app.salesPortal.navQueue",
    titleKey: "app.salesTour.workAsLeadTitle",
    bodyKey: "app.salesTour.workAsLeadBody",
  },
  {
    // The incoming-call dock is mounted in SalesShell, so it reaches a rep on
    // every screen in the portal. Targeted at Today rather than at a tab of
    // its own, because there is no such tab and inventing one here is the
    // exact failure this file's header is about.
    key: "inbound",
    href: "/sales",
    tabLabel: "Today",
    titleKey: "app.salesTour.inboundTitle",
    bodyKey: "app.salesTour.inboundBody",
  },
  {
    key: "transfer",
    href: "/sales",
    tabLabel: "Today",
    titleKey: "app.salesTour.transferTitle",
    bodyKey: "app.salesTour.transferBody",
  },
  {
    key: "voicemail",
    href: "/sales/voicemail",
    tabLabel: "Voicemail",
    titleKey: "app.salesTour.voicemailTitle",
    bodyKey: "app.salesTour.voicemailBody",
  },
  {
    key: "texts",
    href: "/sales/messages",
    tabLabel: "Texts",
    titleKey: "app.salesTour.textsTitle",
    bodyKey: "app.salesTour.textsBody",
  },
  {
    key: "leads",
    href: "/sales/leads",
    tabLabelKey: "app.salesPortal.navLeads",
    titleKey: "app.salesTour.leadsTitle",
    bodyKey: "app.salesTour.leadsBody",
  },
  {
    key: "conversations",
    href: "/sales/threads",
    tabLabelKey: "app.salesPortal.navConversations",
    titleKey: "app.salesTour.conversationsTitle",
    bodyKey: "app.salesTour.conversationsBody",
  },
  {
    key: "notes",
    href: "/sales/notes",
    tabLabel: "Notes",
    titleKey: "app.salesTour.notesTitle",
    bodyKey: "app.salesTour.notesBody",
  },
  {
    key: "calendar",
    href: "/sales/calendar",
    tabLabel: "Calendar",
    titleKey: "app.salesTour.calendarTitle",
    bodyKey: "app.salesTour.calendarBody",
  },
  {
    key: "companies",
    href: "/sales/companies",
    tabLabelKey: "app.salesPortal.myCompanies",
    titleKey: "app.salesTour.companiesTitle",
    bodyKey: "app.salesTour.companiesBody",
  },
  {
    key: "support",
    href: "/sales/support",
    tabLabel: "Support",
    titleKey: "app.salesTour.supportTitle",
    bodyKey: "app.salesTour.supportBody",
  },
  {
    key: "demo",
    href: "/sales/demo",
    tabLabel: "Demo",
    titleKey: "app.salesTour.demoTitle",
    bodyKey: "app.salesTour.demoBody",
  },
  {
    key: "pay",
    href: "/sales/pay",
    tabLabel: "Pay",
    titleKey: "app.salesTour.payTitle",
    bodyKey: "app.salesTour.payBody",
  },
  // Added the same hour the tab was. check:sales-tour reads SalesShell's own
  // tab list and failed the moment Team appeared without a step here — which
  // is the check earning its place: a tour that silently skips a tab teaches a
  // new hire that the tab does not matter.
  {
    key: "team",
    href: "/sales/team",
    tabLabel: "Team",
    titleKey: "app.salesTour.teamTitle",
    bodyKey: "app.salesTour.teamBody",
  },
]);

/** How many steps there are. One place, so a clamp and a counter agree. */
export const SALES_TOUR_LENGTH = SALES_TOUR_STEPS.length;

/**
 * A stored position, made safe to render.
 *
 * Clamped on the way OUT as well as on the way in, which is the half that
 * matters: shortening the tour leaves every rep past the new end with a stored
 * index the array cannot answer, and `steps[17]` of a 12-step tour is
 * `undefined` — a blank panel with working Next and Back buttons, which is a
 * control that appears to work and doesn't. Anything unparseable reads as the
 * beginning rather than as an error, because a tour is not worth a refusal.
 *
 * Exported and pure so scripts/check-sales-tour.mjs can run it against a
 * negative, a float, a string, a NaN and a number past the end.
 */
export function clampTourStep(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const i = Math.trunc(n);
  if (i < 0) return 0;
  if (i > SALES_TOUR_LENGTH - 1) return SALES_TOUR_LENGTH - 1;
  return i;
}

/**
 * The step at a stored position — never undefined.
 *
 * Callers get a step object or nothing sensible to render; there is no third
 * answer where they get a hole shaped like a step.
 */
export function tourStepAt(value) {
  return SALES_TOUR_STEPS[clampTourStep(value)];
}
