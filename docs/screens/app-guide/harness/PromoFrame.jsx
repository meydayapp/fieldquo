// docs/screens/app-guide/harness/PromoFrame.jsx
//
// Annual-first plan pickers and live promotions (2026-09-28), photographed:
// the REAL Account & Billing picker, the REAL /pricing grid and the REAL
// /platform/billing/promotions console, each fed what the server would send.
//
// The offers are computed here with the SAME pure resolver the server uses
// (lib/pricing/planOffer.js planOffer) — lib/billing/promotions.js wraps it
// with a database read and cannot be bundled for the browser — over the
// seeded ladder: the standing 1-year offer (ten months), and, in the "sale"
// views, the owner's "40% off the yearly plan, all plans, all currencies,
// ends October 31". The harness clock is pinned to 2026-09-14, inside it.
import React, { useEffect, useState } from "react";
import CompanyPreferencesProvider from "@/app/providers/CompanyPreferencesProvider";
import AccountBillingPage from "@/app/app/settings/account-billing/page";
import PricingPlans from "@/app/(marketing)/pricing/PricingPlans";
import PlatformPromotionsPage from "@/app/platform/billing/promotions/page";
import { planOffer } from "@/lib/pricing/planOffer";
import {
  SEAT_LADDER,
  SUPPORTED_CURRENCIES,
  customTier,
  defaultAnnualPrice,
  CUSTOM_MIN_SEATS,
  CUSTOM_MAX_SEATS,
  MAX_COMPANY_PEOPLE,
  CUSTOM_CREW_GAP,
  CUSTOM_SEAT_PRICE,
} from "@/lib/pricing/ladder";

export const OWNER_SALE = {
  id: "promo_owner_oct",
  label: "40% off the yearly plan",
  notes: "Owner's October sale",
  active: true,
  startsAt: null,
  // October 31, 23:59 in Toronto.
  endsAt: "2026-11-01T03:59:00.000Z",
  discountKind: "percent",
  discountValue: "40.00",
  durationMonths: 3,
  tierKeys: null,
  currencies: null,
  appliesTo: "year",
  createdAt: "2026-09-10T14:00:00.000Z",
};

const rowsFor = (currency) =>
  SEAT_LADDER.map((rung) => ({
    id: `plan_${rung.tierKey}_${currency.toLowerCase()}`,
    name: rung.label,
    priceMonthly: rung.price,
    priceAnnual: defaultAnnualPrice(rung.price),
    seats: rung.seats,
    crewSeats: rung.crewSeats,
    maxUsers: rung.seats + rung.crewSeats,
    tierKey: rung.tierKey,
    currency,
    sortOrder: rung.sortOrder,
    isPublic: true,
    retiredAt: null,
    aiCopilotEnabled: true,
    maxQuotesPerMonth: null,
    features: null,
  }));

const offersFor = (plan, promotions) => ({
  month: planOffer({ plan, interval: "month", promotions }),
  year: planOffer({ plan, interval: "year", promotions }),
});

function customOffer(currency, promotions) {
  const base = { priceMonthly: 369, priceAnnual: 3690 };
  const offers = {};
  for (let seats = CUSTOM_MIN_SEATS; seats <= CUSTOM_MAX_SEATS; seats++) {
    const t = customTier(seats, { base });
    offers[seats] = offersFor({ tierKey: t.tierKey, currency, priceMonthly: t.price, priceAnnual: t.priceAnnual }, promotions);
  }
  return {
    currency,
    minSeats: CUSTOM_MIN_SEATS,
    maxSeats: CUSTOM_MAX_SEATS,
    maxPeople: MAX_COMPANY_PEOPLE,
    crewGap: CUSTOM_CREW_GAP,
    baseSeats: 10,
    baseMonthly: 369,
    baseAnnual: 3690,
    seatPriceMonthly: CUSTOM_SEAT_PRICE,
    seatPriceAnnual: CUSTOM_SEAT_PRICE * 10,
    aiCopilotEnabled: true,
    offers,
  };
}

function json(body) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}

function install({ view, sale }) {
  const prior = window.fetch;
  const promotions = sale ? [OWNER_SALE] : [];
  window.fetch = (input, init) => {
    const url = String(typeof input === "string" ? input : input?.url || "");
    if (view === "billing") {
      if (url.includes("/api/settings/subscription/access")) return json({ level: "full", daysLeft: 20, reason: "trial_no_plan", graceDays: 7 });
      if (/\/api\/settings\/subscription(\?|$)/.test(url)) return json({ status: null, trialEndsAt: null, plan: null, showTrialBadge: false });
      if (url.includes("/api/settings/plans")) {
        return json({
          plans: rowsFor("CAD").map((p) => ({ ...p, offers: offersFor(p, promotions) })),
          currency: "CAD",
          custom: customOffer("CAD", promotions),
        });
      }
    }
    if (view === "platform") {
      if (url.includes("/api/platform/me")) return json({ id: "pa_1", email: "owner@fieldquo.com", role: "superadmin", permissions: ["*"] });
      if (url.includes("/api/platform/billing/promotions")) return json([OWNER_SALE]);
      if (url.includes("/api/platform/billing/plans")) return json(SUPPORTED_CURRENCIES.flatMap(rowsFor));
    }
    return prior(input, init);
  };
  return true;
}

// Presses a real control after the page has drawn it: the Monthly tab, or
// the sale's Edit button in the console. By attribute and position, never by
// an interface string, so the frame works in any language.
function usePress(selector) {
  useEffect(() => {
    if (!selector) return undefined;
    let tries = 0;
    const t = setInterval(() => {
      const el = typeof selector === "function" ? selector() : document.querySelector(selector);
      if (el) {
        el.click();
        clearInterval(t);
      } else if (++tries > 60) clearInterval(t);
    }, 100);
    return () => clearInterval(t);
  }, [selector]);
}

const PRESS = {
  // The in-app picker's tabs: the year first, Monthly second.
  "billing-monthly": () => document.querySelectorAll('#plans [role="tablist"] button')[1] || null,
  "pricing-monthly": () => document.querySelectorAll('[role="tablist"] [role="tab"]')[1] || null,
  // The sale's own Edit, not the standing offer's.
  platform: () => document.querySelector("[data-promotion-row] button") || null,
};

export default function PromoFrame({ view = "billing", sale = false, press = null }) {
  useState(() => install({ view, sale }));
  usePress(press ? PRESS[press] : null);
  if (view === "pricing") {
    const promotions = sale ? [OWNER_SALE] : [];
    // /pricing collapses the currency rows to one card per tier; the rows
    // carry the same number, so the CAD row stands for all three here.
    const plans = rowsFor("CAD").map((p) => ({ ...p, offers: offersFor(p, promotions) }));
    return (
      <div className="min-h-screen bg-background" data-promo-frame={view}>
        <PricingPlans plans={plans} customOffer={customOffer("CAD", promotions)} asOf="2026-09-14" />
      </div>
    );
  }
  if (view === "platform") {
    return (
      <div className="min-h-screen bg-background p-4 sm:p-6" data-promo-frame={view}>
        <PlatformPromotionsPage />
      </div>
    );
  }
  return (
    <CompanyPreferencesProvider initialCurrency="CAD">
      <div className="min-h-screen bg-background" data-promo-frame={view}>
        <AccountBillingPage />
      </div>
    </CompanyPreferencesProvider>
  );
}
