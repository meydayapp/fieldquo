// lib/analytics/product/appPages.js
//
// The /app pages as FEATURES: which sidebar row a route belongs to, what the
// product calls it in the reader's language, and the one line that says why
// a contractor would want it.
//
// ══ Why a catalogue and not the sidebar itself ═════════════════════════════
//
// app/components/layout/AdminSidebar.js and SettingsSidebar.js hold the rows
// — but they are "use client" modules full of lucide icons and JSX, and the
// two readers of this mapping are a server route (/api/sales/product-usage)
// and a bare-node check script. So the (href, i18n key) pairs are copied
// here as plain data, and scripts/check-product-analytics.mjs asserts every
// row in both sidebars appears below with the same key, and nothing below
// names an href that has no page. A row added to a sidebar without a line
// here fails the check rather than silently landing under "Settings".
//
// ══ Three sources for three words ══════════════════════════════════════════
//
//   navKey   the sidebar label — app.nav.* / app.settings.* in
//            app/i18n/appMessages.js, nine languages. What a rep reads on the
//            "What contractors use most" card is exactly the word the
//            contractor's own sidebar shows.
//   matrix   the lib/marketing/featureMatrix.js key, when the page IS one of
//            the claims on the pricing page. Its `feature.<key>.summary` in
//            app/i18n/messages.js is the "why contractors love it" line —
//            already written for a painter, already translated for the
//            marketing site, and pinned to code that exists. Null where the
//            page is furniture (Settings → Language) rather than a feature.
//   feature  the lib/features/registry.js key when FieldQuo can withhold the
//            page, so the console can say "hidden for 3 companies" beside a
//            usage bar and the "never used" list does not flag a page nobody
//            was allowed to open.
//
// `featurePageFor(pattern)` resolves any /app route pattern to its row by the
// longest href prefix, so "/app/quotes/[id]/edit" counts under Quotes and
// "/app/settings/team/new" under Team. That is the grouping the sales card
// ranks: a feature, not a URL.

import { ROUTE_PATTERNS } from "./routeCatalogue.generated.js";

/** href → { navKey, matrix, feature }. Order does not matter; prefix length does. */
export const APP_PAGES = Object.freeze([
  // ── Work ────────────────────────────────────────────────────────────────
  { href: "/app", navKey: "app.nav.home", matrix: "dashboard", feature: null },
  { href: "/app/leads", navKey: "app.nav.requests", matrix: "leads", feature: null },
  { href: "/app/quotes", navKey: "app.nav.quotes", matrix: "quotes", feature: null },
  { href: "/app/estimate-reviews", navKey: "app.nav.estimateReviews", matrix: "ai_quote_review", feature: null },
  { href: "/app/jobs", navKey: "app.nav.jobs", matrix: "jobs", feature: null },
  { href: "/app/invoices", navKey: "app.nav.invoices", matrix: "invoices", feature: null },
  { href: "/app/plans", navKey: "app.nav.plans", matrix: "service_plans", feature: null },
  { href: "/app/appointments", navKey: "app.nav.calendar", matrix: "scheduling", feature: null },
  { href: "/app/tasks", navKey: "app.nav.tasks", matrix: "tasks", feature: null },
  { href: "/app/clients", navKey: "app.nav.clients", matrix: "clients", feature: null },
  { href: "/app/equipment", navKey: "app.nav.clientEquipment", matrix: null, feature: null },
  // ── Team ────────────────────────────────────────────────────────────────
  // The employee home and its tabs. One row: "/app/me/earnings" and
  // "/app/me/requests" count under My home by the longest-prefix rule, the
  // way "/app/quotes/[id]/edit" counts under Quotes.
  { href: "/app/me", navKey: "app.nav.myHome", matrix: "crew_shifts", feature: null },
  // Its own sidebar row (My schedule), so its own catalogue line; the tab
  // bar's other hrefs still fall under My home by prefix.
  { href: "/app/me/schedule", navKey: "app.nav.mySchedule", matrix: "crew_shifts", feature: null },
  { href: "/app/chat", navKey: "app.nav.chat", matrix: null, feature: "team_chat" },
  { href: "/app/settings/team", navKey: "app.nav.team", matrix: "team_access", feature: null },
  { href: "/app/settings/team/timesheets", navKey: "app.nav.timesheets", matrix: "timesheets", feature: null },
  { href: "/app/subcontractors", navKey: "app.nav.subcontractors", matrix: "subcontractor_bids", feature: null },
  { href: "/app/scheduler", navKey: "app.nav.scheduler", matrix: "scheduling", feature: null },
  { href: "/app/schedule", navKey: "app.nav.teamSchedule", matrix: "crew_shifts", feature: null },
  { href: "/app/clock", navKey: "app.nav.clock", matrix: "time_clock", feature: null },
  { href: "/app/time-off", navKey: "app.nav.timeOff", matrix: "time_off", feature: null },
  { href: "/app/safety", navKey: "app.nav.safety", matrix: null, feature: null },
  // ── The HR file ─────────────────────────────────────────────────────────
  // Manager side under Manage Team and Settings; the worker's own screens
  // under /app/me, listed apart from My home so "opened their checklist"
  // counts as the HR feature and not as the schedule.
  { href: "/app/log", navKey: "app.nav.log", matrix: "hr_compliance", feature: null },
  { href: "/app/settings/policies", navKey: "app.settings.policies", matrix: "hr_compliance", feature: null },
  { href: "/app/settings/team/compliance", navKey: "app.hr.compliance.tab", matrix: "hr_compliance", feature: null },
  { href: "/app/settings/team/onboarding", navKey: "app.hr.templates.tab", matrix: "hr_compliance", feature: null },
  { href: "/app/settings/team/people/[workerId]", navKey: "app.hr.person.file", matrix: "hr_compliance", feature: null },
  { href: "/app/me/documents", navKey: "app.hr.me.documents", matrix: "hr_compliance", feature: null },
  { href: "/app/me/onboarding", navKey: "app.hr.me.onboarding", matrix: "hr_compliance", feature: null },
  { href: "/app/me/policies", navKey: "app.hr.me.policies", matrix: "hr_compliance", feature: null },
  { href: "/app/me/notes", navKey: "app.hr.me.notes", matrix: "hr_compliance", feature: null },
  { href: "/app/me/tax-forms", navKey: "app.hr.me.taxForms", matrix: "hr_compliance", feature: null },
  // ── Money ───────────────────────────────────────────────────────────────
  { href: "/app/payroll", navKey: "app.nav.payroll", matrix: "payroll", feature: null },
  { href: "/app/settings/expense-tracking", navKey: "app.nav.expenses", matrix: "expenses", feature: null },
  { href: "/app/purchasing", navKey: "app.nav.purchasing", matrix: "materials", feature: null },
  { href: "/app/fleet", navKey: "app.nav.fleet", matrix: null, feature: null },
  { href: "/app/analytics/benchmark", navKey: "app.nav.insights", matrix: "benchmark", feature: null },
  { href: "/app/analytics/kpis", navKey: "app.nav.kpis", matrix: "dashboard", feature: "kpi_dashboard" },
  // Four analytics screens reached from Insights rather than from the rail
  // (AdminSidebar's Money group says why), so their label is the page's own
  // title key rather than a nav key.
  { href: "/app/analytics/digest", navKey: "app.digest.title", matrix: "monthly_digest", feature: null },
  { href: "/app/analytics/estimate-accuracy", navKey: "app.estimateAccuracy.title", matrix: "job_costing", feature: null },
  { href: "/app/analytics/statements", navKey: "app.statements.title", matrix: "break_even", feature: null },
  { href: "/app/analytics/win-loss", navKey: "app.winLoss.title", matrix: "quotes", feature: null },
  // The staff-side approval screen a quote link opens; no rail row either.
  { href: "/app/quote-approval", navKey: "app.quoteApproval.title", matrix: "online_approval", feature: null },
  // ── Grow ────────────────────────────────────────────────────────────────
  { href: "/app/marketing", navKey: "app.nav.marketing", matrix: "email_campaigns", feature: "marketing_campaigns" },
  { href: "/app/marketing/designer", navKey: "app.nav.marketingDesigner", matrix: null, feature: "marketing_designer" },
  { href: "/app/funnels", navKey: "app.nav.funnels", matrix: "funnels", feature: "funnels" },
  { href: "/app/receptionist", navKey: "app.nav.receptionist", matrix: "voice_receptionist", feature: "voice_receptionist" },
  { href: "/app/crew-inbox", navKey: "app.nav.crewInbox", matrix: "crew_inbox", feature: "crew_inbox" },
  { href: "/app/messages", navKey: "app.nav.messages", matrix: null, feature: "page_messaging" },
  { href: "/app/settings/refer", navKey: "app.nav.refer", matrix: "referrals", feature: null },
  // The influencer ledger — a company enrolled by the platform sees its
  // own referral commissions here (lib/influencers/index.js). Same
  // feature family as referrals.
  { href: "/app/influencer", navKey: "app.nav.influencer", matrix: "referrals", feature: null },
  // ── The bottom of the rail ──────────────────────────────────────────────
  { href: "/app/copilot", navKey: "app.nav.ai", matrix: "ai_copilot", feature: "ai_copilot" },
  { href: "/app/help", navKey: "app.nav.help", matrix: null, feature: null },
  { href: "/app/settings/account-billing", navKey: "app.nav.plan", matrix: null, feature: null },
  { href: "/app/settings", navKey: "app.nav.settings", matrix: null, feature: null },
  // ── Settings rows ───────────────────────────────────────────────────────
  { href: "/app/activity", navKey: "app.settings.activity", matrix: "activity_log", feature: null },
  { href: "/app/settings/migration", navKey: "app.settings.migration", matrix: null, feature: null },
  { href: "/app/settings/product-updates", navKey: "app.settings.productUpdates", matrix: null, feature: null },
  { href: "/app/settings/company", navKey: "app.settings.company", matrix: null, feature: null },
  { href: "/app/settings/branding", navKey: "app.settings.branding", matrix: "white_label", feature: null },
  { href: "/app/settings/language", navKey: "app.settings.language", matrix: "languages", feature: null },
  { href: "/app/settings/availability", navKey: "app.settings.availability", matrix: "booking_page", feature: null },
  { href: "/app/settings/leave", navKey: "app.settings.leave", matrix: "time_off", feature: null },
  { href: "/app/settings/booking-page", navKey: "app.settings.bookingPage", matrix: "booking_page", feature: null },
  { href: "/app/settings/work-areas", navKey: "app.settings.workAreas", matrix: "work_areas", feature: null },
  { href: "/app/settings/products", navKey: "app.settings.products", matrix: "price_book", feature: null },
  { href: "/app/settings/services", navKey: "app.settings.services", matrix: "price_book", feature: null },
  { href: "/app/settings/material-costs", navKey: "app.settings.materialCosts", matrix: "material_costs", feature: null },
  { href: "/app/settings/cabinet-rates", navKey: "app.settings.cabinetRates", matrix: "price_book", feature: null },
  { href: "/app/settings/overhead", navKey: "app.settings.overhead", matrix: "break_even", feature: null },
  { href: "/app/settings/custom-fields", navKey: "app.settings.customFields", matrix: null, feature: null },
  { href: "/app/settings/quote-email", navKey: "app.settings.quoteEmail", matrix: "quote_email_wording", feature: null },
  { href: "/app/settings/email-templates", navKey: "app.settings.emailTemplates", matrix: "quote_email_wording", feature: null },
  { href: "/app/settings/templates", navKey: "app.settings.pdfTemplates", matrix: "document_layouts", feature: null },
  { href: "/app/settings/translations", navKey: "app.settings.translations", matrix: "languages", feature: null },
  { href: "/app/settings/checklists", navKey: "app.settings.checklists", matrix: "checklists", feature: null },
  { href: "/app/settings/job-photo-tags", navKey: "app.settings.jobPhotoTags", matrix: "job_photos", feature: null },
  { href: "/app/settings/messages", navKey: "app.settings.messages", matrix: "appointment_reminders", feature: null },
  { href: "/app/settings/follow-ups", navKey: "app.settings.followUps", matrix: "follow_ups", feature: null },
  { href: "/app/settings/notifications", navKey: "app.settings.notifications", matrix: null, feature: null },
  { href: "/app/settings/email-domain", navKey: "app.settings.emailDomain", matrix: "own_email_domain", feature: null },
  { href: "/app/settings/payments", navKey: "app.settings.payments", matrix: "card_payments", feature: null },
  { href: "/app/settings/meta-ads", navKey: "app.settings.metaAds", matrix: "marketing_spend", feature: null },
  { href: "/app/settings/ai-credit", navKey: "app.settings.aiCredit", matrix: null, feature: null },
  { href: "/app/settings/payroll", navKey: "app.settings.payroll", matrix: "payroll", feature: null },
  { href: "/app/settings/website", navKey: "app.settings.website", matrix: "website_builder", feature: "website_builder" },
  { href: "/app/settings/instant-quotes", navKey: "app.settings.instantQuotes", matrix: "instant_quotes", feature: "instant_quotes" },
  { href: "/app/settings/lead-form", navKey: "app.settings.leadForm", matrix: "lead_form", feature: null },
  { href: "/app/settings/links", navKey: "app.settings.bioLink", matrix: "bio_link", feature: null },
  { href: "/app/settings/voice", navKey: "app.settings.voice", matrix: "voice_receptionist", feature: "voice_receptionist" },
  { href: "/app/settings/ai-employee", navKey: "app.settings.aiEmployee", matrix: null, feature: "ai_employee" },
  { href: "/app/settings/reviews", navKey: "app.settings.reviews", matrix: "review_requests", feature: null },
]);

const BY_HREF = new Map(APP_PAGES.map((p) => [p.href, p]));

/** Rows whose href is a PREFIX with no page of its own (only /app/quote-approval/[id] exists). */
export const PREFIX_ONLY_HREFS = Object.freeze(["/app/quote-approval"]);

/** Every /app route pattern in the page tree. The "never used" list is drawn from this. */
export const APP_ROUTE_PATTERNS = Object.freeze(
  ROUTE_PATTERNS.filter((p) => p === "/app" || p.startsWith("/app/")),
);

/**
 * The feature row an /app route pattern belongs to: the row whose href is
 * the longest prefix of the pattern. "/app" itself only matches exactly, so
 * an unknown page does not become "Home".
 */
export function featurePageFor(pattern) {
  if (typeof pattern !== "string") return null;
  if (BY_HREF.has(pattern)) return BY_HREF.get(pattern);
  let best = null;
  for (const row of APP_PAGES) {
    if (row.href === "/app") continue;
    if (pattern.startsWith(`${row.href}/`) && (!best || row.href.length > best.href.length)) best = row;
  }
  return best;
}

/** Route patterns that belong to a feature row, keyed by href. */
export function patternsByFeature() {
  const out = new Map();
  for (const pattern of APP_ROUTE_PATTERNS) {
    const row = featurePageFor(pattern);
    if (!row) continue;
    if (!out.has(row.href)) out.set(row.href, []);
    out.get(row.href).push(pattern);
  }
  return out;
}
