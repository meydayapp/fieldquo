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
  { path: "/api/ui-state", reply: () => ({ seenTours: ["*"], dismissedNotices: [], account: null, notifications: { unread: 2 } }) },
  { path: "/api/settings/subscription/access", reply: () => ({ level: "full", daysLeft: null, reason: "ok", graceDays: 7 }) },
  { path: "/api/settings/subscription", reply: () => ({ status: "active", trialEndsAt: null, currentPeriodEnd: iso(day(16)), billingInterval: "month", pendingPlanId: null, pendingBillingInterval: null, pendingEffectiveAt: null, showTrialBadge: false, plan: { id: "plan_shop", name: "Shop", priceMonthly: 269, maxUsers: 6, seats: 6, crewSeats: 11, priceAnnual: 2690 } }) },
];
