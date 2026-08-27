// app/signup/page.js
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { calculatePricing , TRIAL_PRICE, trialLabel } from "@/lib/pricing";
import {
  firstStep,
  resumeStep,
  previousStep,
  nextStep,
  billingBasis,
} from "@/lib/signup/funnel";
import {
  DEFAULT_INTERVAL,
  annualPriceOf,
  annualSaving,
  chargeFor,
} from "@/lib/billing/interval";
import { currencyLabel } from "@/lib/pricing/ladder";
import { INDUSTRIES } from "@/app/data/industries";
import { categoryKeysForIndustries } from "@/app/data/industryCategories";
import PricingCard from "@/app/components/marketing/PricingCard";
import MarketingHeader from "@/app/components/marketing/MarketingHeader";

// add to imports at top of app/signup/page.js
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { formatPhoneInput, isValidPhone, isValidEmail } from "@/lib/validation";
import { LANGUAGES } from "@/app/i18n/languages";
import { COUNTRIES } from "@/lib/currency";
import { isInternalPath } from "@/lib/appUrl";

// "1 month free" / "3 months free". The banner hardcoded the plural and read
// "1 months free" for the whole life of the current one-month offer. Same
// shape as MONTHS_FREE on app/refer/[code]/page.js.
function monthsFree(n) {
  const count = Number(n) || 0;
  return `${count} ${count === 1 ? "month" : "months"} free`;
}

// Prices on this page are whole dollars in a stated currency, and the currency
// is written with the ladder's own label (CA$ / US$) rather than a bare "$" —
// this product sells in two dollars and a bare sign in front of one of them is
// the ambiguity the address rule exists to remove.
//
// A FIXED locale, not the reader's: this page renders on the server too, and a
// number grouped one way in Node and another in the browser is a hydration
// mismatch. The signup funnel is English-only copy throughout.
function money(value) {
  return Number(value || 0).toLocaleString("en-CA", {
    maximumFractionDigits: 0,
  });
}

// Where a half-finished signup is kept between visits.
//
// sessionStorage, not localStorage and not a cookie. Three reasons, in order:
// this is one person's unfinished form in one tab, so it should die with the
// tab rather than sit on a van's shared laptop; it holds their name, email,
// phone and home address, which is not something to leave behind on a machine;
// and a second tab starting a different signup must not inherit the first one's
// company. The PASSWORD is deliberately never written to it.
const DRAFT_KEY = "fieldquo:signup-draft";

// Better Auth enforces 8–128 characters on the server — its own defaults, since
// lib/auth.js sets neither minPasswordLength nor maxPasswordLength. The client
// only ever checked the minimum, so an over-long password passed validation here
// and came back from signUp as an opaque failure with nothing on the field.
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

// The company half of the form, shared by the "account" and "business" steps.
function validateCompanyFields(form) {
  const errors = {};
  if (!form.companyName.trim()) errors.companyName = "Company name is required";
  if (form.phone && !isValidPhone(form.phone))
    errors.phone = "Format: 555-123-4567";
  if (!form.address.trim())
    errors.address = "Start typing and select your address";
  return errors;
}

// Everything the account step asks for: the company rules above plus the
// personal fields only that step collects.
function validateAccountFields(form) {
  const errors = validateCompanyFields(form);
  if (!form.firstName.trim()) errors.firstName = "First name is required";
  if (!form.lastName.trim()) errors.lastName = "Last name is required";
  if (!isValidEmail(form.email)) errors.email = "Enter a valid email address";
  if (!form.password || form.password.length < PASSWORD_MIN)
    errors.password = `At least ${PASSWORD_MIN} characters`;
  else if (form.password.length > PASSWORD_MAX)
    errors.password = `At most ${PASSWORD_MAX} characters`;
  return errors;
}

// Where a visit starts before anything is known about it. Derived from the
// funnel rather than typed, so the two can't drift apart.
const INITIAL_STEP = firstStep({ accountExists: false });

// The step order, the resume rules and the country→currency read all live in
// lib/signup/funnel.js — pure, so scripts/check-signup-order.mjs executes them
// against the whole state matrix instead of this file's behaviour being argued
// about. STEPS is imported above and deliberately not redeclared here.

// The company half of the form. Rendered by two steps — "account" (new login +
// first business) and "business" (an existing login adding another) — as one
// component rather than two copies, because the copy is the one that rots.
//
// Module scope on purpose: declared inside SignupPage it would be a new
// component type on every render, remounting AddressAutocomplete and losing
// focus mid-keystroke.
function CompanyFields({ form, setForm, fieldErrors }) {
  return (
    <>
      <div>
        <label className="text-sm font-medium text-foreground">
          Company name
        </label>
        <input
          value={form.companyName}
          onChange={(e) => setForm({ ...form, companyName: e.target.value })}
          className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
            fieldErrors.companyName ? "border-red-400" : "border-border"
          }`}
        />
        {fieldErrors.companyName && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {fieldErrors.companyName}
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Phone</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) =>
            setForm({ ...form, phone: formatPhoneInput(e.target.value) })
          }
          placeholder="555-123-4567"
          className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
            fieldErrors.phone ? "border-red-400" : "border-border"
          }`}
        />
        {fieldErrors.phone && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {fieldErrors.phone}
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">Address</label>
        <AddressAutocomplete
          value={form.address}
          onChange={(val) => setForm((f) => ({ ...f, address: val }))}
          // address-jurisdiction: keeps city, province AND country.
          //
          // `country` was dropped, and it is not cosmetic here — it seeds
          // Company.country, which drives the billing currency AND is the
          // fallback jurisdiction every quote falls back to when the client's
          // own address can't answer (lib/tax/documentTax.js). Left at the
          // "CA" default, a contractor who typed a Texas address got a
          // Canadian company. Google's short_name is already ISO alpha-2.
          //
          // Only overwritten when Google actually returned one — a partial
          // place must not blank a country the user picked by hand.
          onPlaceSelected={({ address, city, province, country }) =>
            setForm((f) => ({
              ...f,
              address,
              city: city || f.city,
              province: province || f.province,
              country: country || f.country,
            }))
          }
          placeholder="Start typing your address..."
          className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
            fieldErrors.address ? "border-red-400" : "border-border"
          }`}
        />
        {fieldErrors.address && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {fieldErrors.address}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-foreground">City</label>
          <input
            value={form.city}
            readOnly
            placeholder="Auto-filled from address"
            className="w-full mt-1 border border-border bg-muted rounded-lg px-4 py-2.5 text-sm text-muted-foreground"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Province</label>
          <input
            value={form.province}
            readOnly
            placeholder="Auto-filled from address"
            className="w-full mt-1 border border-border bg-muted rounded-lg px-4 py-2.5 text-sm text-muted-foreground"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-foreground">Country</label>
          <select
            value={form.country}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            className="w-full mt-1 border border-border rounded-lg px-4 py-2.5 text-sm bg-background"
          >
            {/* An explicit empty option, because the form no longer seeds "CA".
                Without it the select would DISPLAY Canada while the value was
                "" — the screen stating something the record does not, which is
                the whole failure this change removes. */}
            <option value="">Select a country…</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {/* Filled in from the address you pick, and it decides which prices
              you are shown on the last step. */}
          <p className="text-xs text-muted-foreground mt-1">
            Filled in from your address. Sets your billing currency.
          </p>
        </div>
        <div>
          <label className="text-sm font-medium text-foreground">Language</label>
          <select
            value={form.language}
            onChange={(e) => setForm({ ...form, language: e.target.value })}
            className="w-full mt-1 border border-border rounded-lg px-4 py-2.5 text-sm bg-background"
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.nativeName}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground mt-1">
            Your default in the app.
          </p>
        </div>
      </div>
    </>
  );
}

export default function SignupPage() {
  // Signed-out is the common case, so the funnel opens on "account". A visitor
  // who turns out to have a login is moved to "business" by the resume effect
  // below, and nothing renders until that answer is in — see `entryChecked`.
  const [step, setStep] = useState(INITIAL_STEP);

  // Referral code from /refer/<code>, which links here as ?ref=<code>.
  //
  // Read from window.location rather than useSearchParams() to avoid needing a
  // Suspense boundary around this whole page — see the note in
  // app/app/layout.js about prerender failures from client-only hooks.
  //
  // Held in state and posted with the company, NOT stored in a cookie: a stale
  // referral cookie from a link someone clicked last month shouldn't silently
  // attach itself to an unrelated signup.
  const [referralCode, setReferralCode] = useState("");
  // Where to return after checkout, when signup began from a flow like "add this
  // quote to your project" (?next=/q/<token>). Internal paths only.
  const [nextPath, setNextPath] = useState("");
  const [referrer, setReferrer] = useState(null);
  // Set when someone opens a signup link while already signed in to a company.
  // Referral offers are for businesses new to FieldQuo, so they can't redeem —
  // and being told that here beats filling in the whole form first.
  const [alreadyOnFieldquo, setAlreadyOnFieldquo] = useState(null);
  // Signed in, but with NO company — someone who created their account here and
  // stopped before "Continue to Payment", which is the only thing that creates
  // the company. They have a login and nothing to log in TO, so /app sends them
  // back here (app/app/layout.js) and this page picks up where they stopped.
  const [accountReady, setAccountReady] = useState(null);
  // True only when that state was found on ARRIVAL. accountReady is also set
  // the moment this page creates an account, and explaining "you already have
  // an account" to someone who just watched us make one reads as a bug.
  const [resumedSignup, setResumedSignup] = useState(false);
  // Both of the above start unknown. Nothing may resume until the answer is in:
  // guessing "signed out" and then correcting would flash the account step at
  // someone who already has an account.
  const [entryChecked, setEntryChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // business-info is COMPANY-scoped, so its answer separates the two
        // signed-in states: 200 means a company exists (they're adding another
        // business), and 401 means specifically that no company could be
        // resolved. Any other status is a fault — a 402 from the billing gate,
        // a 500 — and must not be read as "you have no company", or a working
        // account gets offered a duplicate one.
        const res = await fetch("/api/settings/business-info");
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (!cancelled && data?.name) setAlreadyOnFieldquo(data);
          return;
        }
        if (res.status !== 401) return;

        // Same session endpoint the invitation page uses. A session here with
        // no company is the abandoned-signup state.
        const session = await fetch("/api/auth/get-session")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (!cancelled && session?.user?.id) {
          setAccountReady(session.user);
          setResumedSignup(true);
        }
      } catch {
        // Offline or blocked: fall through as a signed-out visitor, which is
        // the flow that asks for everything rather than assuming it has it.
      } finally {
        if (!cancelled) setEntryChecked(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("next");
    if (isInternalPath(raw)) setNextPath(raw);
  }, []);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("ref");
    if (!code) return;
    setReferralCode(code);

    // Confirm the code is real before promising anything. A typo'd link
    // should not produce a banner claiming free months that the API then
    // silently declines to grant.
    fetch(`/api/public/refer/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.valid && setReferrer(d))
      .catch(() => {});
  }, []);

  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [selectedPlanId, setSelectedPlanId] = useState(null);

  const [isCustom, setIsCustom] = useState(false);
  const [customCount, setCustomCount] = useState(25);

  // Monthly (no commitment) or annual (one year, one charge). Same rate either
  // way — see lib/billing/interval.js. Defaults to the option with no
  // commitment attached, because that is the safe thing to assume for someone
  // who has not chosen.
  const [billingInterval, setBillingInterval] = useState(DEFAULT_INTERVAL);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    companyName: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    // The company's own language becomes their default interface language and
    // the fallback for client documents. Country drives the billing currency
    // (derived, not asked) — see lib/currency.js currencyForCountry.
    language: "en",
    // Empty, NOT "CA". The seed here was half of the defect this step order
    // fixes: it stated a country nobody had entered, the plan step (then first)
    // priced off it, and /api/companies defaulted a second time — so a Texan
    // saw Canadian prices and got a Canadian company. Empty means unanswered,
    // and the plan step asks rather than guessing.
    country: "",
  });

  const [selectedIndustries, setSelectedIndustries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([]);
  // When on, the services step shows only the quote types preset from the
  // chosen industries; toggled off to browse/add from the full catalog.
  const [showAllServices, setShowAllServices] = useState(false);

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // add this state alongside your other useState calls
  const [fieldErrors, setFieldErrors] = useState({});

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const employeeCount = isCustom ? customCount : selectedPlan?.maxUsers || 1;

  const pricing = isCustom
    ? calculatePricing(customCount)
    : {
        trialTotal: TRIAL_PRICE,
        monthlyTotal: Number(selectedPlan?.priceMonthly || 0),
        contactSalesRequired: false,
      };

  const selectedPlanName = isCustom
    ? `Custom — ${customCount} employees`
    : selectedPlan?.name || "Selected plan";

  const hasSelection = isCustom || Boolean(selectedPlanId);
  // "There is already a login behind this" — true whether they're resuming an
  // abandoned signup or adding a second business. Both skip account CREATION.
  const accountExists = Boolean(accountReady || alreadyOnFieldquo);

  // ── Where they are, and therefore what money they see ───────────────────
  //
  // Read from the address they just gave, three steps before this matters. The
  // whole reason the plan step moved to the end.
  const basis = billingBasis(form);
  const planCurrency = basis.planCurrency;
  const symbol = currencyLabel(planCurrency);
  const currencyName =
    planCurrency === "CAD"
      ? "Canadian dollars"
      : planCurrency === "USD"
        ? "US dollars"
        : null;
  const countryName =
    COUNTRIES.find((c) => c.code === basis.country)?.name || basis.country;

  // Only this currency's rungs. The ladder rows carry the SAME NUMBER in each
  // currency rather than a conversion, so showing both would put "Solo $129"
  // next to "Solo $129" where the choice is not a currency — it is a Canadian
  // volunteering to pay about 38% more (lib/pricing/ladder.js refuses to make
  // that selectable, and this is the screen that would have anyway).
  //
  // Legacy per-headcount rows have no tierKey. They still exist, still carry
  // live subscriptions and are still sellable, so they are the FALLBACK rather
  // than being deleted from the page: a deployment where the ladder has not
  // been seeded shows what it has instead of an empty grid.
  const forCurrency = plans.filter(
    (p) => !planCurrency || !p.currency || p.currency === planCurrency,
  );
  const ladderRows = forCurrency.filter((p) => p.tierKey);
  const visiblePlans = ladderRows.length > 0 ? ladderRows : forCurrency;

  // Annual is offered per PLAN, because Plan.priceAnnual is nullable and null
  // means "this tier has no annual option" — including every bespoke Custom
  // row, which is created without one.
  const annualPrice = isCustom ? null : annualPriceOf(selectedPlan);
  const annualAvailable = annualPrice !== null;
  // What gets posted. Never `billingInterval` straight from state: a plan with
  // no annual price must not be bought on a cadence it does not have, and the
  // screen shows this same value, so the button and the charge cannot diverge.
  const effectiveInterval = annualAvailable ? billingInterval : "month";
  const charge = isCustom
    ? { interval: "month", amount: pricing.monthlyTotal }
    : chargeFor(selectedPlan, effectiveInterval);
  // Zero today — annual is the interval, not a discount. Shown only when the
  // number is real and positive, so nothing claims a saving that isn't there.
  const yearlySaving = isCustom ? null : annualSaving(selectedPlan);

  // ── The draft ───────────────────────────────────────────────────────────
  //
  // Read once on mount, written on every change afterward. `hydrated` is state
  // rather than a ref so the writer can't run until the RESTORED values have
  // actually rendered — a ref flipped inside the reader would still leave the
  // writer's first pass holding the empty initial form, and it would save that
  // over the draft it is here to preserve.
  const [hydrated, setHydrated] = useState(false);
  const draftStepRef = useRef(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        // password is never stored, and `...form` here would reintroduce it as
        // undefined and break the controlled input.
        if (draft?.form) setForm((f) => ({ ...f, ...draft.form, password: "" }));
        if (typeof draft?.isCustom === "boolean") setIsCustom(draft.isCustom);
        if (draft?.customCount) setCustomCount(Number(draft.customCount) || 1);
        if (draft?.selectedPlanId) setSelectedPlanId(draft.selectedPlanId);
        if (Array.isArray(draft?.selectedIndustries))
          setSelectedIndustries(draft.selectedIndustries);
        if (Array.isArray(draft?.selectedCategoryIds))
          setSelectedCategoryIds(draft.selectedCategoryIds);
        if (typeof draft?.showAllServices === "boolean")
          setShowAllServices(draft.showAllServices);
        // Absent on any draft written before the interval existed, which is
        // every draft in flight the day this deploys. Absent means unanswered,
        // so it stays on the no-commitment default rather than being restored
        // as a commitment nobody made.
        if (draft?.billingInterval === "year" || draft?.billingInterval === "month")
          setBillingInterval(draft.billingInterval);
        // Applied later, once we know whether the account behind it still
        // exists — see the resume effect below.
        draftStepRef.current = draft?.step || null;
      }
    } catch {
      // A corrupt or blocked store is not a reason to fail the signup — they
      // just start from the top, which is the behaviour this replaced.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      const { password, ...safeForm } = form;
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          form: safeForm,
          selectedPlanId,
          isCustom,
          customCount,
          selectedIndustries,
          selectedCategoryIds,
          showAllServices,
          billingInterval,
          step,
        }),
      );
    } catch {
      // Private mode, or a full quota. Losing the draft is a worse experience,
      // not a broken one.
    }
  }, [
    hydrated,
    form,
    selectedPlanId,
    isCustom,
    customCount,
    selectedIndustries,
    selectedCategoryIds,
    showAllServices,
    billingInterval,
    step,
  ]);

  // ── Browser history ─────────────────────────────────────────────────────
  //
  // All the steps live at /signup and none of them used to touch history, so
  // one press of Back from the last step threw the visitor out of the funnel
  // and onto the marketing homepage — three steps of work gone. One entry per
  // step forward, and Back walks them.
  //
  // The depth rides in the state rather than a counter, so going FORWARD again
  // restores the right value instead of decrementing past zero.
  const depthRef = useRef(0);
  // The step this visit started on — where a Back that lands on the entry we
  // arrived through has to return to. Kept in a ref because that entry can't be
  // relied on to carry our tag: see tagCurrentEntry.
  // Seeded with the funnel's own first step, and corrected by the resume effect
  // the moment we know whether there is a session behind this visit.
  const entryStepRef = useRef(INITIAL_STEP);

  /**
   * Add our step to whatever is already in this entry's history state.
   *
   * Both halves matter. The App Router writes its own routing tree into the
   * entry AFTER hydration, so anything we replace it with on mount is silently
   * overwritten — which is why the arrival entry is tagged lazily, on the first
   * forward move, rather than in a mount effect. And dropping Next's keys would
   * make its own popstate handler treat our entries as foreign and hard-navigate
   * back to the server, turning "go back one step" into a full page load that
   * loses the form.
   */
  function tagCurrentEntry(value, depth) {
    window.history.replaceState(
      { ...window.history.state, signupStep: value, signupDepth: depth },
      "",
    );
  }

  useEffect(() => {
    function onPopState(e) {
      // A pop that leaves /signup entirely is the router's business, not ours.
      if (window.location.pathname !== "/signup") return;
      const restored = e.state?.signupStep;
      // No tag means the entry we arrived on — the one Next overwrote. That is
      // the start of the funnel, not "not ours".
      depthRef.current = restored ? e.state.signupDepth || 0 : 0;
      setStep(restored || entryStepRef.current);
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function goToStep(next) {
    if (next === step) return;
    if (!window.history.state?.signupStep) tagCurrentEntry(step, depthRef.current);
    depthRef.current += 1;
    window.history.pushState(
      {
        ...window.history.state,
        signupStep: next,
        signupDepth: depthRef.current,
      },
      "",
    );
    setStep(next);
  }

  function goBackToStep(target) {
    // Prefer the real history entry, so this button and the browser's own Back
    // do the same thing. A RESUMED visit lands directly on a later step with
    // nothing behind it in this visit's history — going back then would drop
    // them out of signup entirely, so the step moves in place instead.
    if (depthRef.current > 0) {
      window.history.back();
      return;
    }
    entryStepRef.current = target;
    tagCurrentEntry(target, 0);
    setStep(target);
  }

  // Resume, once we know both who they are and which plans exist.
  const resumedRef = useRef(false);

  useEffect(() => {
    if (resumedRef.current) return;
    // `hydrated` as well as `entryChecked`: the draft read is what supplies the
    // company details and the trade/service picks that resumeStep judges the
    // state on, and deciding before it has landed would clamp everyone back to
    // the first step. It is a synchronous mount effect and always wins the race
    // today, which is precisely why depending on the timing rather than saying
    // so would be the kind of thing that breaks quietly later.
    //
    // `plansLoading` used to gate this too, because the first step WAS the plan
    // step. It is the last one now, so nothing about where a visitor lands
    // depends on the plan list having arrived, and waiting on that fetch would
    // hold the account form back for a round trip that answers a later
    // question.
    if (!hydrated || !entryChecked) return;
    resumedRef.current = true;

    // The live step wins once they've moved, so this also covers the race where
    // someone clicks Continue faster than the entry check comes back: a signed-in
    // person who reached "account" that way is moved to "business" rather than
    // being asked to sign up for an account they already have.
    const saved = step === INITIAL_STEP ? draftStepRef.current : step;
    const target = resumeStep(saved, {
      accountExists,
      // What the account/business step collects, judged by the same validator
      // that step uses — so "far enough to leave it" means one thing in both
      // places rather than two rules that drift.
      companyReady: Object.keys(validateCompanyFields(form)).length === 0,
      hasIndustries: selectedIndustries.length > 0,
      hasServices: selectedCategoryIds.length > 0,
    });
    if (target === step) return;
    // Replace, don't push: arriving where they left off is not a navigation
    // they made, so Back from here leaves the page rather than replaying a step
    // they never walked in this visit. The depth is carried, not zeroed — in the
    // race case above there IS a real entry behind us.
    if (depthRef.current === 0) entryStepRef.current = target;
    tagCurrentEntry(target, depthRef.current);
    setStep(target);
  }, [
    hydrated,
    entryChecked,
    accountExists,
    step,
    form,
    selectedIndustries,
    selectedCategoryIds,
  ]);

  // Re-run the rules over the errors ALREADY on screen whenever the form
  // changes, and drop the ones that now pass.
  //
  // Validation only ever ran on submit, so a password corrected from 7
  // characters to 9 kept "At least 8 characters" in red until the next submit —
  // which then succeeded. The message was both stale and false at the same
  // time. Only the fields already showing an error are re-evaluated, so typing
  // a first name still can't light up the untouched fields below it.
  useEffect(() => {
    setFieldErrors((shown) => {
      const keys = Object.keys(shown);
      if (keys.length === 0) return shown;

      const fresh = validateAccountFields(form);
      const narrowed = {};
      let changed = false;
      for (const key of keys) {
        if (fresh[key]) narrowed[key] = fresh[key];
        if (fresh[key] !== shown[key]) changed = true;
      }
      // Same object when nothing moved — a new one every keystroke would
      // re-render the whole form for no reason.
      return changed ? narrowed : shown;
    });
  }, [form]);

  useEffect(() => {
    // ?plan=<id> is what the pricing page's "Start Free Trial" buttons carry.
    // It was never read, so choosing a tier on /pricing landed here with
    // nothing selected and the Continue button disabled.
    //
    // Applied inside this .then rather than in a separate effect keyed on
    // `plans`, so it runs exactly once at load: an effect would re-assert the
    // query's plan every time the list changed and fight anyone clicking a
    // different card. Unknown ids are ignored rather than errored — a stale
    // link should still let you pick.
    const wantedPlanId = new URLSearchParams(window.location.search).get("plan");

    fetch("/api/marketing/plans")
      .then((r) => r.json())
      .then((data) => {
        // The endpoint now returns { plans, unavailable } so the page can tell
        // "no plans configured" apart from "plans exist but none can be
        // bought" — they are the same empty array and completely different
        // situations. The array form is still accepted so a cached older
        // response doesn't blank the step.
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.plans)
            ? data.plans
            : [];
        setPlans(list);
        setSelectedPlanId((current) => {
          if (wantedPlanId && list.some((p) => p.id === wantedPlanId)) {
            return wantedPlanId;
          }
          // A plan id restored from the draft is only trustworthy if the tier
          // still exists. One withdrawn since they last looked would otherwise
          // survive as a filled-in "Selected plan" and an enabled Continue
          // button that 400s with "Selected plan not found" four steps later.
          if (current && !list.some((p) => p.id === current)) return null;
          return current;
        });
      })
      .catch(() => setPlans([]))
      .finally(() => setPlansLoading(false));

    fetch("/api/service-categories/public")
      .then((r) => r.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, []);

  // ── A plan from the other currency can't stay selected ──────────────────
  //
  // The draft survives a change of address, and `selectedPlanId` in it may be
  // the CAD row of a tier for someone who has since told us they're in Texas.
  // Left alone it would show as a filled-in "Selected plan" with no card
  // matching it and an enabled Continue button, and the server would refuse the
  // mismatch four steps later. Same shape as the withdrawn-plan guard in the
  // fetch below, for the same reason.
  useEffect(() => {
    if (plansLoading || !selectedPlanId) return;
    if (visiblePlans.some((p) => p.id === selectedPlanId)) return;
    setSelectedPlanId(null);
    // Depending on the id list rather than the array, which is rebuilt every
    // render and would make this an infinite loop.
  }, [plansLoading, selectedPlanId, visiblePlans.map((p) => p.id).join(",")]);

  function selectPlan(plan) {
    setSelectedPlanId(plan.id);
    setIsCustom(false);
    setError("");
  }

  function selectCustom() {
    setIsCustom(true);
    setSelectedPlanId(null);
    setError("");
  }


  function handleBusinessSubmit(e) {
    e.preventDefault();
    setError("");

    const errors = validateCompanyFields(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Off the funnel, not typed. Every forward move on this page asks
    // lib/signup/funnel.js where it goes, so reordering the steps there cannot
    // leave a button pointing at the old next one.
    goToStep(nextStep("business", { accountExists }));
  }

  // replace handleAccountSubmit entirely
  async function handleAccountSubmit(e) {
    e.preventDefault();
    setError("");

    const errors = validateAccountFields(form);

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);

    await fetch("/api/auth/precheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.email }),
    });
    try {
      const result = await signUp.email({
        email: form.email,
        password: form.password,
        name: `${form.firstName} ${form.lastName}`.trim(),
      });

      if (result?.error) {
        // Surface Better Auth's own message on the specific field when possible,
        // otherwise fall back to the general error banner.
        const message = result.error.message || "Could not create your account";
        if (message.toLowerCase().includes("email")) {
          setFieldErrors({ email: message });
        } else {
          setError(message);
        }
        return;
      }

      // The account now exists without a company, which is exactly the state
      // this page can resume into if they stop here.
      setAccountReady({ email: form.email });
      goToStep(nextStep("account", { accountExists: true }));
    } catch (err) {
      setError(err?.message || "Could not create your account");
    } finally {
      setSubmitting(false);
    }
  }

  function toggleIndustry(slug) {
    setSelectedIndustries((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function toggleCategory(id) {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  }

  async function handleFinish() {
    setError("");

    // Refusals the button is already disabled for, restated here because a
    // disabled button is not a guard — the same three states are checked on the
    // server, and this only decides which sentence they read.
    if (!hasSelection) {
      setError("Please select a plan first.");
      return;
    }
    if (!planCurrency) {
      setError(
        basis.country
          ? `We don't have plan pricing for ${countryName} yet — get in touch and we'll sort it out.`
          : "Add your business address first — it's what tells us which currency to price in.",
      );
      return;
    }
    if (isCustom && pricing.contactSalesRequired) {
      setError("For more than 40 employees, please contact sales.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.companyName,
          phone: form.phone,
          address: form.address,
          city: form.city,
          province: form.province,
          country: form.country,
          language: form.language,
          industries: selectedIndustries,
          planId: isCustom ? null : selectedPlanId,
          employeeCount,
          serviceCategoryIds: selectedCategoryIds,
          // The CADENCE, never a price. The server reprices from its own Plan
          // row either way (non-negotiable #5) and refuses "year" outright for
          // a plan with no annual price rather than quietly billing monthly
          // under an annual label.
          billingInterval: effectiveInterval,
          referralCode: referralCode || undefined,
          next: nextPath || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not finish setting up your company");
        return;
      }

      if (!data.checkoutUrl) {
        setError("Company was created, but no checkout URL was returned.");
        return;
      }

      // The company exists now, so the draft describes work that is finished.
      // Leaving it would resume a completed signup the next time this page is
      // opened in the same tab — and offer to build the company a second time.
      try {
        sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // Nothing to do about it, and nothing that should stop checkout.
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err?.message || "Could not finish setting up your company");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <MarketingHeader />
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-muted px-4 py-12">
      <div className="w-full max-w-5xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Start your free trial
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {/* Off the trialLabel helper, never a hardcoded number — this line
                had drifted to "$1" while the system actually charges $0. */}
            {trialLabel()}
          </p>
        </div>

        {/* Already signed in. Redirect would be wrong — they may genuinely be
            setting up a second business — but they need to know the referral
            can't apply, and the useful thing to offer is their OWN link. */}
        {alreadyOnFieldquo && (
          <div className="max-w-md mx-auto mb-6 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl px-4 py-3 text-sm text-blue-900 dark:text-blue-200">
            <p>
              You&apos;re signed in as <strong>{alreadyOnFieldquo.name}</strong>.
              {" "}Carrying on here sets up an <strong>additional business</strong>
              {" "}on your existing login — it won&apos;t create a second account
              or change the business you already have.
              {referrer
                ? " Referral offers are for businesses new to FieldQuo, so this link won't apply to your account."
                : ""}
            </p>
            <p className="mt-2">
              <a href="/app" className="underline font-semibold">
                Go to your dashboard
              </a>
              {referrer && (
                <>
                  {" · "}
                  <a
                    href="/app/settings/refer"
                    className="underline font-semibold"
                  >
                    Share your own referral link
                  </a>
                </>
              )}
            </p>
          </div>
        )}

        {/* The abandoned-signup state, said plainly. They have a login and
            nothing to log in to, /app has just sent them back here, and the
            worst thing this page could do is act as though they were a
            stranger. The invitation line is there because an invited employee
            whose acceptance failed lands in exactly this state, and creating
            their own company is emphatically not the fix for that. */}
        {resumedSignup && !alreadyOnFieldquo && (
          <div className="max-w-md mx-auto mb-6 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            <p>
              You&apos;re signed in as{" "}
              <strong>{accountReady?.email || "your account"}</strong>, but your
              business was never finished — that last step is what creates it.
              Carry on below and nothing you&apos;ve already entered is lost.
            </p>
            <p className="mt-2">
              Joining a business someone invited you to? Ask them to resend the
              invitation instead — this page sets up a new business of your own.
            </p>
          </div>
        )}

        {/* Only shown once the code has been confirmed real. Carried through
            every step so someone who reaches the payment screen still sees
            what they were promised on the landing page. */}
        {referrer && !alreadyOnFieldquo && (
          <div className="max-w-md mx-auto mb-6 bg-brand-accent/10 border border-brand-accent/40 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-[#2d2520]">
              <strong>{referrer.referrerName}</strong> referred you —{" "}
              <strong>{monthsFree(referrer.months)}</strong> added to your trial.
            </p>
          </div>
        )}
        {error && (
          <div className="max-w-md mx-auto mb-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}
        {/* ── Nothing renders until we know who this is ────────────────────
            The funnel now OPENS on a form: "account" for a stranger,
            "business" for someone who already has a login. Rendering the
            account step first and swapping it a moment later would flash a
            create-a-password form at somebody who is already signed in, which
            reads as the product having forgotten them — the same complaint the
            resumed-signup banner below exists to answer. */}
        {!entryChecked && (
          <div className="max-w-lg mx-auto bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
            Getting things ready...
          </div>
        )}
        {entryChecked && step === "account" && (
          <form
            onSubmit={handleAccountSubmit}
            className="max-w-lg mx-auto bg-card border border-border rounded-xl p-6 space-y-4"
          >
            {/* No plan summary here any more. The plan is chosen on the LAST
                step now, so a box naming one would either be empty or be
                describing a choice that hasn't been made. */}
            <div>
              <h2 className="font-semibold text-foreground">
                Your account and business
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                We'll ask which trades you work in next, and you'll pick a plan
                at the end — the price depends on where your business is.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground">
                  First name
                </label>
                <input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                    fieldErrors.firstName ? "border-red-400" : "border-border"
                  }`}
                />
                {fieldErrors.firstName && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.firstName}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-foreground">
                  Last name
                </label>
                <input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                    fieldErrors.lastName ? "border-red-400" : "border-border"
                  }`}
                />
                {fieldErrors.lastName && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                    {fieldErrors.lastName}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@company.com"
                className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                  fieldErrors.email ? "border-red-400" : "border-border"
                }`}
              />
              {fieldErrors.email && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.email}
                </p>
              )}
            </div>

            <CompanyFields
              form={form}
              setForm={setForm}
              fieldErrors={fieldErrors}
            />

            <div>
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={`w-full mt-1 border rounded-lg px-4 py-2.5 text-sm ${
                  fieldErrors.password ? "border-red-400" : "border-border"
                }`}
              />
              {fieldErrors.password && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {fieldErrors.password}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
            >
              {submitting ? "Creating your account..." : "Continue"}
            </button>
          </form>
        )}
        {/* The signed-in path. Everything the account step collects about the
            BUSINESS, nothing it collects about the person — they already have a
            login, and /api/companies needs a name or it 400s. */}
        {entryChecked && step === "business" && (
          <form
            onSubmit={handleBusinessSubmit}
            className="max-w-lg mx-auto bg-card border border-border rounded-xl p-6 space-y-4"
          >
            {/* Two audiences reach this step. Someone ADDING a business needs
                to be told the existing one is untouched; someone RESUMING has
                no existing one, and that same sentence rendered as "separate
                from  — nothing there changes", pointing at a company that
                doesn't exist. */}
            <div>
              <h2 className="font-semibold text-foreground">
                {alreadyOnFieldquo ? "Your new business" : "Your business"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                This is the business your clients will see on quotes and
                invoices.{" "}
                {alreadyOnFieldquo ? (
                  <>
                    It&apos;s separate from{" "}
                    <strong>{alreadyOnFieldquo.name}</strong> — nothing there
                    changes.
                  </>
                ) : (
                  "You can change any of it later in Settings."
                )}
              </p>
            </div>

            <CompanyFields
              form={form}
              setForm={setForm}
              fieldErrors={fieldErrors}
            />

            <button
              type="submit"
              className="w-full bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold"
            >
              Continue
            </button>
          </form>
        )}
        {entryChecked && step === "industry" && (
          <div className="max-w-md mx-auto">
            <h2 className="font-semibold text-foreground mb-1">
              What trades does your company work in?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Select all that apply — this narrows down which quote types you'll
              see.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {INDUSTRIES.map((ind) => (
                <button
                  type="button"
                  key={ind.slug}
                  onClick={() => toggleIndustry(ind.slug)}
                  className={`text-left border rounded-lg px-4 py-3 text-sm ${
                    selectedIndustries.includes(ind.slug)
                      ? "border-inverted bg-muted font-medium"
                      : "border-border bg-card"
                  }`}
                >
                  {ind.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                // Preset the services step from the chosen industries — the
                // point of asking for industry at all. Maps preset category
                // keys -> the catalog ids we already loaded, and pre-checks
                // them so a painter arrives with refinishing/refacing/
                // painting already selected instead of a blank list.
                const presetKeys = categoryKeysForIndustries(
                  selectedIndustries,
                );
                const presetIds = categories
                  .filter((c) => presetKeys.includes(c.key))
                  .map((c) => c.id);
                setSelectedCategoryIds(presetIds);
                setShowAllServices(presetIds.length === 0);
                goToStep(nextStep("industry", { accountExists }));
              }}
              disabled={selectedIndustries.length === 0}
              className="w-full mt-6 bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
            >
              Continue
            </button>

            <button
              type="button"
              onClick={() => goBackToStep(previousStep("industry", { accountExists }))}
              className="w-full mt-2 text-sm text-muted-foreground"
            >
              ← Back
            </button>
          </div>
        )}
        {entryChecked && step === "services" && (
          <div className="max-w-md mx-auto">
            <h2 className="font-semibold text-foreground mb-1">
              Which services do you offer?
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {showAllServices
                ? "Browsing every quote type — turn on the ones you offer. You can change this anytime."
                : "We've preselected the usual quote types for your trade. Adjust as needed — you can change this anytime."}
            </p>
            {(() => {
              const presetKeys = categoryKeysForIndustries(selectedIndustries);
              const visible =
                showAllServices || presetKeys.length === 0
                  ? categories
                  : categories.filter((c) => presetKeys.includes(c.key));
              return (
                <div className="grid grid-cols-2 gap-2 max-h-80 overflow-y-auto">
                  {visible.map((cat) => (
                    <button
                      type="button"
                      key={cat.id}
                      onClick={() => toggleCategory(cat.id)}
                      className={`text-left border rounded-lg px-4 py-3 text-sm ${
                        selectedCategoryIds.includes(cat.id)
                          ? "border-inverted bg-muted font-medium"
                          : "border-border bg-card"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                  {categories.length === 0 && (
                    <p className="col-span-2 text-sm text-muted-foreground">
                      Loading services...
                    </p>
                  )}
                </div>
              );
            })()}

            {categoryKeysForIndustries(selectedIndustries).length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllServices((v) => !v)}
                className="w-full mt-3 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {showAllServices
                  ? "← Show just my trade's quote types"
                  : "+ Add a quote type from another trade"}
              </button>
            )}

            {/* Not "Continue to Payment" any more — the plan step is what
                leads to payment, and it comes after this one. */}
            <button
              type="button"
              onClick={() => goToStep(nextStep("services", { accountExists }))}
              disabled={selectedCategoryIds.length === 0}
              className="w-full mt-6 bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
            >
              Continue
            </button>

            <button
              type="button"
              onClick={() => goBackToStep(previousStep("services", { accountExists }))}
              className="w-full mt-2 text-sm text-muted-foreground"
            >
              ← Back
            </button>
          </div>
        )}
        {/* ── Last step, and last for a reason ─────────────────────────────
            The address three steps back is what says which currency these
            prices are in. It used to be FIRST, priced off a hardcoded "CA",
            so a contractor in Texas was shown Canadian money before anybody
            asked where he was. */}
        {entryChecked && step === "plan" && (
          <div>
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold text-foreground">
                Choose your plan
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Last step — then we'll take you to checkout.
                {currencyName ? ` Prices in ${currencyName}.` : ""}
              </p>
            </div>

            {/* ── Nobody has said where they are ───────────────────────────
                Ask. The alternative is picking a currency for them, and here
                the padding is a price: the two ladders carry the same NUMBER,
                so guessing CAD for an American is a ~38% error in his favour
                and guessing USD for a Canadian is a ~27% error in ours. */}
            {!basis.country ? (
              <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6 text-center">
                <h2 className="font-semibold text-foreground">
                  Where is your business?
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  We price in Canadian and US dollars, and the address you gave
                  us doesn't say which country you're in — so we'd be guessing
                  at your price. Add it and these plans will fill in.
                </p>
                <button
                  type="button"
                  onClick={() => goToStep(firstStep({ accountExists }))}
                  className="mt-4 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold"
                >
                  Add your business address
                </button>
              </div>
            ) : !planCurrency ? (
              /* They DID say, and it's somewhere the ladder has no prices for.
                 A different sentence from the one above — telling someone who
                 picked Ireland from a list that we can't find their address is
                 the product failing to read its own form. */
              <div className="max-w-md mx-auto bg-card border border-border rounded-xl p-6 text-center">
                <h2 className="font-semibold text-foreground">
                  We don't have pricing for {countryName} yet
                </h2>
                <p className="text-sm text-muted-foreground mt-2">
                  FieldQuo bills in Canadian and US dollars today. Get in touch
                  and we'll set your business up by hand — everything you've
                  entered here is kept in this tab in the meantime.
                </p>
                <Link
                  href="/contact"
                  className="inline-block mt-4 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold"
                >
                  Contact us
                </Link>
                <p className="text-xs text-muted-foreground mt-3">
                  Not right?{" "}
                  <button
                    type="button"
                    onClick={() => goToStep(firstStep({ accountExists }))}
                    className="underline"
                  >
                    Change your country
                  </button>
                </p>
              </div>
            ) : plansLoading ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                Loading plans...
              </div>
            ) : visiblePlans.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                No plans are available right now. Please{" "}
                <Link href="/contact" className="underline">
                  contact us
                </Link>{" "}
                to get started.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {visiblePlans.map((plan) => (
                  <PricingCard
                    key={plan.id}
                    plan={plan}
                    selected={!isCustom && selectedPlanId === plan.id}
                    onSelect={() => selectPlan(plan)}
                  />
                ))}

                <div
                  className={`text-left border rounded-2xl p-6 flex flex-col relative bg-card transition-all duration-150 ease-out hover:scale-[1.03] hover:shadow-lg ${
                    isCustom
                      ? "border-inverted ring-2 ring-ring scale-[1.02] bg-muted"
                      : "border-border hover:border-border"
                  }`}
                >
                  <button
                    type="button"
                    onClick={selectCustom}
                    className="text-left"
                  >
                    <h3 className="text-lg font-semibold text-foreground">
                      Custom
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Tell us how many employees you need, and we'll calculate
                      your rate.
                    </p>
                  </button>

                  {isCustom && (
                    <div className="mt-4">
                      <label className="text-sm font-medium text-foreground">
                        Number of employees
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={customCount}
                        onChange={(e) =>
                          setCustomCount(Number(e.target.value || 1))
                        }
                        className="w-full mt-1 border border-border rounded-lg px-3 py-2 text-sm"
                      />
                      {pricing.contactSalesRequired ? (
                        <p className="mt-4 text-sm text-foreground">
                          For more than 40 employees, pricing is custom —{" "}
                          <Link
                            href="/contact"
                            className="underline font-medium"
                          >
                            contact us
                          </Link>
                          .
                        </p>
                      ) : (
                        <p className="mt-4 text-sm text-foreground">
                          {trialLabel(pricing.trialTotal)}, then{" "}
                          <span className="font-semibold">
                            {symbol}
                            {money(pricing.monthlyTotal)}/mo
                          </span>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {planCurrency && (
              <div className="max-w-md mx-auto mt-8 bg-card border border-border rounded-xl p-5">
                <div className="text-sm text-muted-foreground">
                  Selected plan:{" "}
                  <span className="font-semibold text-foreground">
                    {hasSelection ? selectedPlanName : "None yet"}
                  </span>
                </div>

                {/* ── How often, not how much ──────────────────────────────
                    Both options carry the SAME rate. There is no annual
                    discount today, so there is no badge claiming one — what
                    differs is the commitment and the number of charges, and
                    that is what the copy says. If an operator ever types a
                    real annual discount into /platform/billing/plans, the
                    saving line below prints the number they typed. */}
                {hasSelection && !pricing.contactSalesRequired && (
                  <div className="mt-4">
                    <div className="text-sm font-medium text-foreground">
                      How would you like to be billed?
                    </div>

                    <div className="mt-2 space-y-2">
                      <label
                        className={`flex items-start gap-3 border rounded-lg px-4 py-3 cursor-pointer ${
                          effectiveInterval === "month"
                            ? "border-inverted bg-muted"
                            : "border-border"
                        }`}
                      >
                        <input
                          type="radio"
                          name="billingInterval"
                          className="mt-1"
                          checked={effectiveInterval === "month"}
                          onChange={() => setBillingInterval("month")}
                        />
                        <span className="text-sm">
                          <span className="font-medium text-foreground">
                            No commitment
                          </span>
                          <span className="block text-muted-foreground">
                            {symbol}
                            {money(pricing.monthlyTotal)} a month, cancel any
                            time.
                          </span>
                        </span>
                      </label>

                      <label
                        className={`flex items-start gap-3 border rounded-lg px-4 py-3 ${
                          !annualAvailable
                            ? "border-border opacity-60 cursor-not-allowed"
                            : effectiveInterval === "year"
                              ? "border-inverted bg-muted cursor-pointer"
                              : "border-border cursor-pointer"
                        }`}
                      >
                        <input
                          type="radio"
                          name="billingInterval"
                          className="mt-1"
                          disabled={!annualAvailable}
                          checked={effectiveInterval === "year"}
                          onChange={() => setBillingInterval("year")}
                        />
                        <span className="text-sm">
                          <span className="font-medium text-foreground">
                            1 year commitment
                          </span>
                          <span className="block text-muted-foreground">
                            {annualAvailable ? (
                              <>
                                {symbol}
                                {money(annualPrice)} a year — one charge instead
                                of twelve, for a year.
                              </>
                            ) : isCustom ? (
                              "Custom sizing is billed monthly."
                            ) : (
                              "This plan is billed monthly only."
                            )}
                          </span>
                          {annualAvailable && (
                            <span className="block text-muted-foreground mt-1">
                              {yearlySaving > 0
                                ? `That's ${symbol}${money(yearlySaving)} less than paying monthly.`
                                : "Same rate as monthly — the year is the commitment, not a discount."}
                            </span>
                          )}
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {hasSelection && !pricing.contactSalesRequired && charge && (
                  <div className="text-sm text-muted-foreground mt-4">
                    {trialLabel(pricing.trialTotal)}, then{" "}
                    <span className="font-semibold text-foreground">
                      {symbol}
                      {money(charge.amount)}
                      {charge.interval === "year" ? " a year" : "/mo"}
                    </span>
                    .
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={
                    submitting ||
                    !hasSelection ||
                    !charge ||
                    (isCustom && pricing.contactSalesRequired)
                  }
                  className="w-full mt-4 bg-inverted text-inverted-foreground py-2.5 rounded-full text-sm font-semibold disabled:opacity-40"
                >
                  {submitting ? "Setting up..." : "Continue to Payment"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    goBackToStep(previousStep("plan", { accountExists }))
                  }
                  className="w-full mt-2 text-sm text-muted-foreground"
                >
                  ← Back
                </button>
              </div>
            )}
          </div>
        )}
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline">
            Log in
          </Link>
        </p>
      </div>
      </div>
    </>
  );
}
