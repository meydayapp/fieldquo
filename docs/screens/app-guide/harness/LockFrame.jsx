// docs/screens/app-guide/harness/LockFrame.jsx
//
// The platform "Cancel the subscription" panel for every kind of company
// (2026-09-28), photographed: the REAL CompanyActions, handed the options the
// REAL lib/platform/cancelOptions.js computes for a card-free trial, a trial
// that already ran out, a Stripe-subscribed company (the panel exactly as it
// was) and a demo; then what the company sees afterwards — the REAL
// AccountLocked for a terms-locked trial with FieldQuo's reason, and the REAL
// BillingBanner for a trial FieldQuo ended.
import React, { useState } from "react";
import CompanyPreferencesProvider from "@/app/providers/CompanyPreferencesProvider";
import CompanyActions from "@/app/platform/companies/[id]/CompanyActions";
import AccountLocked from "@/app/components/layout/AccountLocked";
import BillingBanner from "@/app/components/layout/BillingBanner";
import { cancelOptions } from "@/lib/platform/cancelOptions";
import { COMPANY, day, iso } from "./fixtures/company.js";

const NOW = new Date();
const COMPANIES = {
  trial: { name: "Luma Painting", company: { isDemo: false, trialEndsAt: day(26) }, subscription: null, trialAccess: { level: "full", daysLeft: 26 } },
  "trial-over": { name: "Northwind Roofing", company: { isDemo: false, trialEndsAt: day(-3) }, subscription: null, trialAccess: { level: "readonly", daysLeft: 4 } },
  subscribed: { name: "TrueFinish Cabinets Inc.", company: { isDemo: false, trialEndsAt: day(-40) }, subscription: { stripeSubscriptionId: "sub_live" }, trialAccess: null },
  demo: { name: "Painting Demo — Rachel", company: { isDemo: true, trialEndsAt: null }, subscription: null, trialAccess: null },
};

const ACCESS = {
  "banner-ended": { level: "readonly", daysLeft: 27, reason: "fieldquo_ended", graceDays: 7, endsAt: iso(day(-3)), endedByFieldQuo: true },
  "banner-ending": { level: "full", daysLeft: 26, reason: "fieldquo_ending", graceDays: 7, endsAt: iso(day(26)), endedByFieldQuo: true },
};

function json(body) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

function install(view) {
  const prior = window.fetch;
  window.fetch = (input, init) => {
    const url = String(typeof input === "string" ? input : input?.url || "");
    if (url.includes("/api/platform/me")) return json({ id: "pa_1", email: "owner@fieldquo.com", role: "superadmin", permissions: ["*"] });
    if (url.includes("/api/settings/subscription/access") && ACCESS[view]) return json(ACCESS[view]);
    return prior(input, init);
  };
  return true;
}

function Home() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">{COMPANY.name}</h1>
      <p className="text-sm text-muted-foreground mt-1">Home — the banner above stays on every screen.</p>
    </div>
  );
}

export default function LockFrame({ view = "trial" }) {
  useState(() => install(view));
  if (view === "locked-terms-trial") {
    return (
      <AccountLocked
        reason="terms"
        companyName="Luma Painting"
        lockedReason="Sent unsolicited texts to homeowners through FieldQuo after a written warning."
        endedByFieldQuo
      />
    );
  }
  if (ACCESS[view]) {
    return (
      <CompanyPreferencesProvider initialCurrency={COMPANY.currency}>
        <div className="min-h-screen bg-background">
          <BillingBanner />
          <Home />
        </div>
      </CompanyPreferencesProvider>
    );
  }
  const c = COMPANIES[view] || COMPANIES.trial;
  const options = cancelOptions({ company: c.company, subscription: c.subscription, trialAccess: c.trialAccess, now: NOW });
  return (
    <div className="min-h-screen bg-background p-6" data-lock-frame={view}>
      <div className="max-w-3xl mx-auto">
        <p className="text-xs text-muted-foreground mb-2">/platform/companies/… · {c.name}</p>
        <CompanyActions companyId="co_frame" companyName={c.name} trialEndsAt={c.company.trialEndsAt ? iso(c.company.trialEndsAt) : null} cancelOptions={options} onDone={() => {}} />
      </div>
    </div>
  );
}
