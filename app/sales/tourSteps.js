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
// A step declares EITHER `tabLabelKey` or `tabLabel`, matching how the shell
// draws that tab — never both, never a guess. Today every tab in SalesShell
// carries a t() key, so every step below uses `tabLabelKey`; `tabLabel` stays
// supported because the day a tab is a proper noun that no language
// translates, the honest answer is a literal on both sides.
//
// ══ "Abrir Today" — why the literal had to go ═════════════════════════════
//
// SalesTour's button reads t("app.salesTour.goTo", { tab }), and `tab` is
// whatever this file says the tab is called. While the shell drew "Today" as an
// English literal, this file had to say "Today" too — the check compares the
// two — so a Spanish rep got a Spanish verb wrapped around an English noun:
// "Abrir Today". Not a translation bug in the tour, which was fully keyed: the
// tour was faithfully repeating a word the shell really did print in English.
// Translating the SCREENS, then the tabs, then this file, is what makes the
// sentence Spanish end to end. Nothing in SalesTour.js changed.
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
//
// ══ Pinned to the thing, not only to the tab ══════════════════════════════
//
// Every step used to ring the tab in the header — the step about the calling
// window rang "Queue", the same as the step about the claim button and the
// step about "Work this one as a lead". The owner's ask: "the tour should be
// pinned to each section and component". So a step now carries `target`, a
// selector for the control or section on its OWN page (a `data-tour="…"`
// attribute the page renders), and SalesTour rings that when the rep is on
// that page. When they are not, it rings the tab — the header tab from lg up,
// the bottom-bar tab below it, or the drawer row, which it opens first. The
// tab is the way there; the target is the thing.
//
// `target: null` is a deliberate value, not a missing one, and two steps
// carry it: inbound calls and transfers. The dock that shows an incoming call
// and the transfer control both exist only WHILE a call is happening — mount
// nothing otherwise, by design — so there is no element to ring at tour time,
// and pinning the step to some other card would be a ring around the wrong
// thing. Those two ring Today's tab and say what they have to say.
//
// scripts/check-sales-mobile.mjs opens each step's page source and fails if
// the target's data-tour value is not rendered there, and fails if a step
// whose tab lives in the drawer forgot to say how to open it.

import { SALES_NAV_CLOSE, SALES_NAV_OPEN, isTabBarHref } from "@/lib/sales/portalTabs";

/**
 * How a step reaches its tab on a phone.
 *
 * A tab on the bottom bar is always on screen, so nothing needs opening. A tab
 * in the drawer is not — the drawer starts closed — so the step names the
 * control that opens it and the one that closes it, exactly as the contractor
 * app's welcome tour does for AdminSidebar's drawer (app/components/tours.js).
 * From lg up neither is used: the header row is visible and the drawer never
 * renders. Derived from lib/sales/portalTabs.js rather than typed per step,
 * so a tab moved between the bar and the drawer takes its instructions with it.
 */
function reach(href) {
  return isTabBarHref(href) ? {} : { openWith: SALES_NAV_OPEN, closeWith: SALES_NAV_CLOSE };
}

/** The selector for a `data-tour` value on the step's own page. */
const at = (slug) => `[data-tour="${slug}"]`;

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
    target: at("sales-today-next"),
    ...reach("/sales"),
    tabLabelKey: "app.salesPortal.navToday",
    titleKey: "app.salesTour.todayTitle",
    bodyKey: "app.salesTour.todayBody",
  },
  {
    key: "queue",
    href: "/sales/queue",
    target: at("sales-queue-claim"),
    ...reach("/sales/queue"),
    tabLabelKey: "app.salesPortal.navQueue",
    titleKey: "app.salesTour.queueTitle",
    bodyKey: "app.salesTour.queueBody",
  },
  {
    key: "research",
    href: "/sales/queue",
    target: at("sales-queue-research"),
    ...reach("/sales/queue"),
    tabLabelKey: "app.salesPortal.navQueue",
    titleKey: "app.salesTour.researchTitle",
    bodyKey: "app.salesTour.researchBody",
  },
  {
    key: "calling",
    href: "/sales/queue",
    target: at("sales-queue-dial"),
    ...reach("/sales/queue"),
    tabLabelKey: "app.salesPortal.navQueue",
    titleKey: "app.salesTour.callingTitle",
    bodyKey: "app.salesTour.callingBody",
  },
  {
    key: "optOut",
    href: "/sales/queue",
    target: at("sales-queue-dial"),
    ...reach("/sales/queue"),
    tabLabelKey: "app.salesPortal.navQueue",
    titleKey: "app.salesTour.optOutTitle",
    bodyKey: "app.salesTour.optOutBody",
  },
  {
    key: "workAsLead",
    href: "/sales/queue",
    target: at("sales-queue-work-as-lead"),
    ...reach("/sales/queue"),
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
    target: null,
    ...reach("/sales"),
    tabLabelKey: "app.salesPortal.navToday",
    titleKey: "app.salesTour.inboundTitle",
    bodyKey: "app.salesTour.inboundBody",
  },
  {
    key: "transfer",
    href: "/sales",
    target: null,
    ...reach("/sales"),
    tabLabelKey: "app.salesPortal.navToday",
    titleKey: "app.salesTour.transferTitle",
    bodyKey: "app.salesTour.transferBody",
  },
  {
    key: "voicemail",
    href: "/sales/voicemail",
    target: at("sales-voicemail"),
    ...reach("/sales/voicemail"),
    tabLabelKey: "app.salesPortal.navVoicemail",
    titleKey: "app.salesTour.voicemailTitle",
    bodyKey: "app.salesTour.voicemailBody",
  },
  {
    key: "texts",
    href: "/sales/messages",
    target: at("sales-texts"),
    ...reach("/sales/messages"),
    tabLabelKey: "app.salesPortal.navTexts",
    titleKey: "app.salesTour.textsTitle",
    bodyKey: "app.salesTour.textsBody",
  },
  {
    key: "leads",
    href: "/sales/leads",
    target: at("sales-leads"),
    ...reach("/sales/leads"),
    tabLabelKey: "app.salesPortal.navLeads",
    titleKey: "app.salesTour.leadsTitle",
    bodyKey: "app.salesTour.leadsBody",
  },
  {
    key: "conversations",
    href: "/sales/threads",
    target: at("sales-conversations"),
    ...reach("/sales/threads"),
    tabLabelKey: "app.salesPortal.navConversations",
    titleKey: "app.salesTour.conversationsTitle",
    bodyKey: "app.salesTour.conversationsBody",
  },
  {
    key: "notes",
    href: "/sales/notes",
    target: at("sales-notes"),
    ...reach("/sales/notes"),
    tabLabelKey: "app.salesPortal.navNotes",
    titleKey: "app.salesTour.notesTitle",
    bodyKey: "app.salesTour.notesBody",
  },
  {
    key: "calendar",
    href: "/sales/calendar",
    target: at("sales-calendar"),
    ...reach("/sales/calendar"),
    tabLabelKey: "app.salesPortal.navCalendar",
    titleKey: "app.salesTour.calendarTitle",
    bodyKey: "app.salesTour.calendarBody",
  },
  {
    key: "companies",
    href: "/sales/companies",
    target: at("sales-companies"),
    ...reach("/sales/companies"),
    tabLabelKey: "app.salesPortal.myCompanies",
    titleKey: "app.salesTour.companiesTitle",
    bodyKey: "app.salesTour.companiesBody",
  },
  {
    key: "support",
    href: "/sales/support",
    target: at("sales-support"),
    ...reach("/sales/support"),
    tabLabelKey: "app.salesPortal.navSupport",
    titleKey: "app.salesTour.supportTitle",
    bodyKey: "app.salesTour.supportBody",
  },
  {
    key: "demo",
    href: "/sales/demo",
    target: at("sales-demo"),
    ...reach("/sales/demo"),
    tabLabelKey: "app.salesPortal.navDemo",
    titleKey: "app.salesTour.demoTitle",
    bodyKey: "app.salesTour.demoBody",
  },
  {
    key: "pay",
    href: "/sales/pay",
    target: at("sales-pay"),
    ...reach("/sales/pay"),
    tabLabelKey: "app.salesPortal.navPay",
    titleKey: "app.salesTour.payTitle",
    bodyKey: "app.salesTour.payBody",
  },
  // Added the same hour the tab was. check:sales-tour reads SalesShell's own
  // tab list and failed the moment Team appeared without a step here — which
  // is the check earning its place: a tour that silently skips a tab teaches a
  // new hire that the tab does not matter.
  // Added the same hour the tab was, for the same reason the Team step was:
  // check:sales-tour reads SalesShell's own tab list and goes red the moment a
  // tab appears without a step. It caught this one within minutes of the tab
  // landing, which is the check doing precisely the job it was written for.
  {
    key: "playbook",
    href: "/sales/playbook",
    target: at("sales-playbook"),
    ...reach("/sales/playbook"),
    tabLabelKey: "app.salesPortal.navPlaybook",
    titleKey: "app.salesTour.playbookTitle",
    bodyKey: "app.salesTour.playbookBody",
  },
  {
    key: "team",
    href: "/sales/team",
    target: at("sales-team"),
    ...reach("/sales/team"),
    tabLabelKey: "app.salesPortal.navTeam",
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
