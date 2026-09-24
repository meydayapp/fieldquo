// docs/screens/app-guide/harness/TrialFrame.jsx
//
// The card-free trial (2026-09-24), photographed: the REAL BillingBanner in
// each of its trial states, the REAL AccountLocked for a trial that ran out,
// Account & Billing opened from the banner's link (?tier=crew), and the
// platform company list with its per-country tally. The fixture API answers
// every other route; this frame answers only the billing-state routes, per
// view, because the states are exactly what the harness's one fixture
// company cannot be in all at once.
import React, { useState } from "react";
import CompanyPreferencesProvider from "@/app/providers/CompanyPreferencesProvider";
import BillingBanner from "@/app/components/layout/BillingBanner";
import AccountLocked from "@/app/components/layout/AccountLocked";
import AccountBillingPage from "@/app/app/settings/account-billing/page";
import PlatformCompaniesPage from "@/app/platform/companies/page";
import SignupPage from "@/app/signup/page";
import { COMPANY, day, iso } from "./fixtures/company.js";

const CREW = { tierKey: "crew", label: "Crew", seats: 3, crewSeats: 8, counts: { seats: 3, crew: 8 } };
const SOLO = { tierKey: "solo", label: "Solo", seats: 1, crewSeats: 5, counts: { seats: 1, crew: 0 } };

// What /api/settings/subscription/access answers in each state — the shape
// app/api/settings/subscription/access/route.js returns to an owner.
const ACCESS = {
  noplan: { level: "full", daysLeft: 20, reason: "trial_no_plan", graceDays: 7, trial: { trialEndsAt: iso(day(20)), hasPlan: false, planName: null, recommended: CREW, signupTierKey: null, canChoosePlan: true } },
  // The owner's own company's shape: TrueFinish Cabinets Inc., trialing on
  // Solo with a card, 20 days left (2026-09-24).
  withplan: { level: "full", daysLeft: null, reason: "trialing", graceDays: 7, trial: { trialEndsAt: iso(day(20)), hasPlan: true, planName: "Solo", recommended: SOLO, signupTierKey: null, canChoosePlan: true } },
  expired: { level: "readonly", daysLeft: 5, reason: "trial_expired", graceDays: 7, trial: { trialEndsAt: iso(day(-2)), hasPlan: false, planName: null, recommended: CREW, signupTierKey: "crew", canChoosePlan: true } },
};

const NO_SUB = { status: null, trialEndsAt: null, plan: null, showTrialBadge: false };

// Five companies for the tally: CA and US, trialling, paying, one trial over
// with no plan (counted in neither column), one demo (never counted).
const PLATFORM_COMPANIES = [
  { id: "c1", name: "TrueFinish Cabinets Inc.", email: "owner@truefinish.ca", country: "CA", isDemo: false, onboardingStatus: "pending", trialEndsAt: iso(day(20)), createdAt: iso(day(-10)), subscription: { status: "trialing", plan: { name: "Solo" } }, _count: { members: 1, quotes: 4 } },
  { id: "c2", name: "Luma Painting", email: "hello@lumapainting.com", country: "US", isDemo: false, onboardingStatus: "pending", trialEndsAt: iso(day(30)), createdAt: iso(day(0)), subscription: null, _count: { members: 1, quotes: 0 } },
  { id: "c3", name: "Test Inc.", email: "test@example.com", country: "CA", isDemo: false, onboardingStatus: "active", trialEndsAt: iso(day(19)), createdAt: iso(day(-11)), subscription: { status: "active", plan: { name: "Crew" } }, _count: { members: 3, quotes: 12 } },
  { id: "c4", name: "Northwind Roofing", email: "ops@northwind.us", country: "US", isDemo: false, onboardingStatus: "pending", trialEndsAt: iso(day(-3)), createdAt: iso(day(-33)), subscription: null, _count: { members: 2, quotes: 1 } },
  { id: "c5", name: "Painting Demo — Rachel", email: null, country: "CA", isDemo: true, onboardingStatus: "pending", trialEndsAt: null, createdAt: iso(day(-11)), subscription: null, _count: { members: 8, quotes: 6 } },
];

// The signup page at its LAST step for a signed-in visitor: the draft the
// page keeps in sessionStorage, restored to Services with a trade and two
// services picked, under a session that already has a login and no company —
// the state the page's own resume logic lands on "services" for.
const SIGNUP_DRAFT = {
  form: { firstName: "Marc", lastName: "Tremblay", email: "marc@erabledesign.ca", companyName: "Érable Design", phone: "450-555-0181", address: "12 rue des Érables, Saint-Jérôme, QC J7Z 1A1", city: "Saint-Jérôme", province: "QC", postalCode: "J7Z 1A1", country: "CA", language: "en" },
  selectedPlanId: "",
  selectedIndustries: ["painting"],
  selectedCategoryIds: ["cat_int_paint", "cat_cab_refinish"],
  showAllServices: false,
  billingInterval: "month",
  step: "services",
};
const SIGNUP_CATEGORIES = [
  { id: "cat_int_paint", key: "interior_painting", label: "Interior painting", icon: null },
  { id: "cat_ext_paint", key: "exterior_painting", label: "Exterior painting", icon: null },
  { id: "cat_cab_refinish", key: "cabinet_refinishing", label: "Cabinet refinishing", icon: null },
  { id: "cat_stairs", key: "stairs", label: "Stairs", icon: null },
];

function status(code, body = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } }));
}

function json(body) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

/** Answer the billing-state routes for this view; everything else falls through to the fixtures. */
function install(view) {
  const prior = window.fetch;
  const state = ACCESS[view === "billing" ? "noplan" : view] || ACCESS.noplan;
  window.fetch = (input, init) => {
    const url = String(typeof input === "string" ? input : input?.url || "");
    if (url.includes("/api/settings/subscription/access")) return json(state);
    if (view === "billing" && /\/api\/settings\/subscription(\?|$)/.test(url)) return json(NO_SUB);
    if (view === "platform" && url.includes("/api/platform/companies")) return json(PLATFORM_COMPANIES);
    if (view === "platform" && url.includes("/api/platform/me")) return json({ id: "pa_1", email: "owner@fieldquo.com", role: "superadmin", permissions: [] });
    if (view === "platform" && url.includes("/api/platform/onboarding-email")) return json({ settings: { enabled: true, delayHours: 2 }, sentCount: 0 });
    if (view === "signup") {
      if (url.includes("/api/signup/resume")) return status(401, { error: "Unauthorized" });
      if (url.includes("/api/settings/business-info")) return status(401, { error: "Unauthorized" });
      if (url.includes("/api/auth/get-session")) return json({ user: { id: "u_marc", email: "marc@erabledesign.ca", name: "Marc Tremblay" }, session: { id: "s_1" } });
      if (url.includes("/api/signup/lead")) return json((init?.method || "GET") === "GET" ? { lead: null } : { ok: true });
      if (url.includes("/api/service-categories/public")) return json(SIGNUP_CATEGORIES);
      if (url.includes("/api/marketing/plans")) return json({ plans: [], unavailable: null });
      if (url.includes("/api/signup/progress")) return json({ ok: true });
    }
    return prior(input, init);
  };
  if (view === "signup") {
    try { window.sessionStorage.setItem("fieldquo:signup-draft", JSON.stringify(SIGNUP_DRAFT)); } catch {}
  }
  if (view === "billing" && !/[?&]tier=/.test(window.location.search)) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}&tier=crew`);
  }
  return true;
}

function Placeholder() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">{COMPANY.name}</h1>
      <p className="text-sm text-muted-foreground mt-1">Home — the banner above stays on every screen for the owner.</p>
      <div className="grid sm:grid-cols-3 gap-4 mt-6">
        {["Quotes", "Jobs", "Invoices"].map((label) => (
          <div key={label} className="rounded-xl border border-border bg-card p-5 h-28">
            <p className="text-sm font-semibold text-foreground">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrialFrame({ view = "noplan" }) {
  useState(() => install(view));
  if (view === "locked") {
    return <AccountLocked reason="trial_expired_locked" companyName={COMPANY.name} />;
  }
  if (view === "signup") {
    return <SignupPage />;
  }
  return (
    <CompanyPreferencesProvider initialCurrency={COMPANY.currency}>
      <div className="min-h-screen bg-background" data-trial-frame={view}>
        {view === "platform" ? (
          <div className="max-w-6xl mx-auto px-4 py-8"><PlatformCompaniesPage /></div>
        ) : (
          <>
            <BillingBanner />
            {view === "billing" ? <AccountBillingPage /> : <Placeholder />}
          </>
        )}
      </div>
    </CompanyPreferencesProvider>
  );
}
