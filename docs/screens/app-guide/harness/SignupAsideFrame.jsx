// docs/screens/app-guide/harness/SignupAsideFrame.jsx
//
// The reactive signup panel (2026-09-24), photographed: the REAL /signup
// page, parked on one step with a draft that carries what a visitor would
// have typed by then, so the panel beside the form draws from real state —
// the company name in the From line, the Ontario tax line, the calendar at
// each team-size band, the sample quote for four trades, the price book.
//
// The page's own resume rule decides the step (lib/signup/funnel.js
// resumeStep): a stranger with no session always lands on "account", so
// the account frame answers get-session with nobody; every later frame
// answers it with a login that has no company yet, which is the state the
// page resumes a draft from. The fixture API answers every other route;
// this frame answers only the signup routes, and the sample services come
// from the REAL lib/signup/sampleServices.js — the same words and starting
// prices production serves — never a fixture of them.
import React, { useState } from "react";
import SignupPage from "@/app/signup/page";
import { sampleQuoteForIndustry } from "@/lib/signup/sampleServices";

const FORM = {
  firstName: "Marc",
  lastName: "Tremblay",
  email: "marc@maplepainting.ca",
  companyName: "Maple Painting Co.",
  phone: "613-555-0181",
  address: "12 Elm St, Ottawa, ON K1A 0B1",
  city: "Ottawa",
  province: "ON",
  postalCode: "K1A 0B1",
  country: "CA",
  language: "en",
};

// The quote-type catalogue the services step ticks — the same shape
// /api/service-categories/public answers, four trades' worth.
const CATEGORIES = [
  { id: "cat_int_paint", key: "interior_painting", label: "Interior painting", icon: null },
  { id: "cat_ext_paint", key: "exterior_painting", label: "Exterior painting", icon: null },
  { id: "cat_cab_refinish", key: "cabinet_refinishing", label: "Cabinet refinishing", icon: null },
  { id: "cat_electrical", key: "electrical", label: "Electrical", icon: null },
  { id: "cat_roofing", key: "roofing_service", label: "Roofing", icon: null },
  { id: "cat_gutters", key: "gutter_services", label: "Gutters", icon: null },
  { id: "cat_landscaping", key: "landscaping_design", label: "Landscaping design", icon: null },
  { id: "cat_paving", key: "paving", label: "Paving", icon: null },
  { id: "cat_lawn", key: "lawn_mowing", label: "Lawn mowing", icon: null },
];

const PRESET_IDS = {
  painting: ["cat_int_paint", "cat_ext_paint", "cat_cab_refinish"],
  electrical: ["cat_electrical"],
  roofing: ["cat_roofing", "cat_gutters"],
  landscaping: ["cat_landscaping", "cat_paving"],
};

function json(body) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } }));
}
function status(code, body = {}) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: code, headers: { "Content-Type": "application/json" } }));
}

/**
 * @param step   account | team | goals | industry | services
 * @param band   a TEAM_SIZE_BANDS key for the team step, or null
 * @param goal   a SIGNUP_GOALS key for the goals step, or null
 * @param trade  an industry slug for the trades/services steps
 * @param typed  false for the account step with nothing typed yet
 */
function install({ step, band = null, goal = null, trade = "painting", typed = true }) {
  const stranger = step === "account";
  const prior = window.fetch;
  window.fetch = (input, init) => {
    const url = String(typeof input === "string" ? input : input?.url || "");
    if (url.includes("/api/signup/resume")) return status(401, { error: "Unauthorized" });
    if (url.includes("/api/settings/business-info")) return status(401, { error: "Unauthorized" });
    if (url.includes("/api/auth/get-session")) {
      return stranger ? json(null) : json({ user: { id: "u_marc", email: FORM.email, name: "Marc Tremblay" }, session: { id: "s_1" } });
    }
    if (url.includes("/api/signup/lead")) return json((init?.method || "GET") === "GET" ? { prefill: null } : { ok: true });
    if (url.includes("/api/service-categories/public")) return json(CATEGORIES);
    if (url.includes("/api/marketing/plans")) return json({ plans: [], unavailable: null });
    if (url.includes("/api/signup/progress")) return json({ ok: true });
    if (url.includes("/api/signup/sample-services")) {
      // The route's own answer, from the same module the route calls: the
      // trade's two seed services at their starting prices in the plan's
      // currency, and the trade's page wording.
      const q = new URL(url, "https://app.fieldquo.com").searchParams;
      const s = sampleQuoteForIndustry(q.get("industry"), q.get("lang") || "en", q.get("currency"));
      return json({ services: s?.services || [], categoryKey: s?.categoryKey || null, currency: s?.currency || null, group: s?.group || null, processSteps: s?.processSteps || [], glossary: s?.glossary || [] });
    }
    return prior(input, init);
  };
  const draft = {
    form: typed ? FORM : { ...FORM, firstName: "", lastName: "", email: "", companyName: "", phone: "", address: "", city: "", province: "", postalCode: "", country: "" },
    selectedPlanId: "",
    // Goals comes BEFORE Trades, so a visitor on it has picked no trade yet.
    selectedIndustries: step === "industry" || step === "services" ? [trade] : [],
    selectedCategoryIds: step === "services" ? PRESET_IDS[trade] || [] : [],
    showAllServices: false,
    billingInterval: "month",
    teamSizeBand: band,
    yearsBand: band ? "3-5" : null,
    signupGoal: goal,
    signupSource: goal ? "A friend" : "",
    step,
  };
  try {
    window.sessionStorage.setItem("fieldquo:signup-draft", JSON.stringify(draft));
  } catch {}
  return true;
}

export default function SignupAsideFrame(props) {
  useState(() => install(props));
  return <SignupPage />;
}
