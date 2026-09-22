// Routes every page (or the shell) reads. See routes.js.
import { COMPANY, PEOPLE, CLIENT, QUOTE, JOB, INVOICE, day, iso } from "./company.js";

export const ROUTES_CORE = [
  { path: "/api/settings/business-info", reply: () => COMPANY },
  { path: "/api/impersonation/status", reply: () => ({ active: false }) },
  { path: "/api/settings/members/self/role", reply: () => ({ yourRole: "owner", role: "owner" }) },
  { path: "/api/settings/members", reply: () => PEOPLE },
  { path: "/api/settings/members/pending", reply: () => [] },
  { path: "/api/clients", reply: () => [CLIENT] },
  { path: "/api/quotes", reply: () => [QUOTE] },
  { path: "/api/jobs", reply: () => [JOB] },
  { path: "/api/invoices", reply: () => [INVOICE] },
  // The shell's global search (app/api/search/route.js): the fixture's own
  // client, quote, job and invoice, whatever is typed — the frame shows the
  // three-source list, not a real match.
  { path: "/api/search", reply: () => ({ results: [
    { type: "client", id: CLIENT.id, title: CLIENT.name, subtitle: CLIENT.email || null, href: `/app/clients/${CLIENT.id}` },
    { type: "quote", id: QUOTE.id, title: QUOTE.quoteNumber, subtitle: `${CLIENT.name} · ${QUOTE.status}`, href: `/app/quotes/${QUOTE.id}` },
    { type: "job", id: JOB.id, title: JOB.title, subtitle: `${CLIENT.name} · ${JOB.status}`, href: `/app/jobs/${JOB.id}` },
    { type: "invoice", id: INVOICE.id, title: INVOICE.invoiceNumber, subtitle: `${CLIENT.name} · ${INVOICE.status}`, href: `/app/invoices/${INVOICE.id}` },
  ] }) },
  { path: "/api/ui-state", reply: () => ({ seenTours: ["*"], dismissedNotices: [], account: null, notifications: { unread: 2 } }) },
  { path: "/api/settings/subscription/access", reply: () => ({ level: "full", daysLeft: null, reason: "ok", graceDays: 7 }) },
  { path: "/api/settings/subscription", reply: () => ({ status: "active", trialEndsAt: null, currentPeriodEnd: iso(day(16)), billingInterval: "month", pendingPlanId: null, pendingBillingInterval: null, pendingEffectiveAt: null, showTrialBadge: false, plan: { id: "plan_shop", name: "Shop", priceMonthly: 269, maxUsers: 6, seats: 6, crewSeats: 11, priceAnnual: 2690 } }) },
];
